#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
STATE_DIR="${STATE_DIR:-$ROOT_DIR/deploy/state}"
INSTANCE_COUNT="${INSTANCE_COUNT:-30}"
BASE_PORT="${BASE_PORT:-11191}"
LAB_BIND_IP="${LAB_BIND_IP:-0.0.0.0}"
LAB_ACCESS_HOST="${LAB_ACCESS_HOST:-}"
LAB_PRIVATE_PREFIX="${LAB_PRIVATE_PREFIX:-10.240}"
LAB_INGRESS_NETWORK="${LAB_INGRESS_NETWORK:-sejong-lab-ingress}"
LAB_INGRESS_SUBNET="${LAB_INGRESS_SUBNET:-10.239.255.0/24}"
RESET_EXISTING_INSTANCES="${RESET_EXISTING_INSTANCES:-1}"
REPLACE_PORT_OWNERS="${REPLACE_PORT_OWNERS:-1}"

if ! [[ "$INSTANCE_COUNT" =~ ^[0-9]+$ ]] || (( INSTANCE_COUNT < 1 || INSTANCE_COUNT > 200 )); then
  echo "오류: INSTANCE_COUNT는 1~200 사이의 정수여야 합니다." >&2
  exit 2
fi

if ! [[ "$BASE_PORT" =~ ^[0-9]+$ ]] || (( BASE_PORT < 1024 || BASE_PORT + INSTANCE_COUNT - 1 > 65535 )); then
  echo "오류: BASE_PORT와 인스턴스 수로 계산한 포트 범위를 확인하세요." >&2
  exit 2
fi

for boolean_name in RESET_EXISTING_INSTANCES REPLACE_PORT_OWNERS; do
  if [[ "${!boolean_name}" != "0" && "${!boolean_name}" != "1" ]]; then
    echo "오류: $boolean_name 값은 0 또는 1이어야 합니다." >&2
    exit 2
  fi
done

for command_name in docker openssl curl find grep; do
  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "오류: $command_name 명령이 필요합니다." >&2
    exit 2
  fi
done

docker info >/dev/null
docker compose version >/dev/null

compose_instance() {
  local env_file="$1"
  local project="$2"
  shift 2
  docker compose \
    --env-file "$env_file" \
    -f "$ROOT_DIR/compose.yaml" \
    -f "$ROOT_DIR/compose.server.yaml" \
    -p "$project" \
    "$@"
}

validate_resolved_port() {
  local env_file="$1"
  local project="$2"
  local port="$3"
  local resolved_config

  resolved_config="$(compose_instance "$env_file" "$project" config)"
  if ! grep -Fq "host_ip: $LAB_BIND_IP" <<< "$resolved_config"; then
    echo "오류: $project 설정에 호스트 바인딩 $LAB_BIND_IP가 반영되지 않았습니다." >&2
    echo "확인: docker compose --env-file '$env_file' -f '$ROOT_DIR/compose.yaml' -f '$ROOT_DIR/compose.server.yaml' -p '$project' config" >&2
    return 1
  fi
  if ! grep -Fq "published: \"$port\"" <<< "$resolved_config"; then
    echo "오류: $project 설정에 호스트 포트 $port가 반영되지 않았습니다." >&2
    echo "확인: docker compose --env-file '$env_file' -f '$ROOT_DIR/compose.yaml' -f '$ROOT_DIR/compose.server.yaml' -p '$project' config" >&2
    return 1
  fi
}

ensure_published_port() {
  local env_file="$1"
  local project="$2"
  local port="$3"
  local endpoint

  endpoint="$(compose_instance "$env_file" "$project" port web 11191 2>/dev/null || true)"
  if [[ "$endpoint" != *":$port" ]]; then
    echo "경고: $project 호스트 포트가 게시되지 않아 web 컨테이너를 재생성합니다." >&2
    compose_instance "$env_file" "$project" \
      up -d --no-build --no-deps --force-recreate web
    endpoint="$(compose_instance "$env_file" "$project" port web 11191 2>/dev/null || true)"
  fi

  if [[ "$endpoint" != *":$port" ]]; then
    echo "오류: $project web 컨테이너가 호스트 포트 $port를 게시하지 못했습니다." >&2
    compose_instance "$env_file" "$project" ps >&2 || true
    echo "확인: docker inspect ${project}-web-1 --format '{{json .HostConfig.PortBindings}}'" >&2
    return 1
  fi

  echo "[$project] 실제 포트 게시 확인: $endpoint"
}

prepare_host_port() {
  local project="$1"
  local port="$2"
  local owner_id owner_name ports owner_project project_container_id project_network_id

  while IFS=$'\t' read -r owner_id owner_name ports; do
    [[ -n "$owner_id" && "$ports" == *":$port->"* ]] || continue
    if [[ "$REPLACE_PORT_OWNERS" == "1" ]]; then
      owner_project="$(docker inspect --format '{{ index .Config.Labels "com.docker.compose.project" }}' "$owner_id" 2>/dev/null || true)"
      if [[ -n "$owner_project" && "$owner_project" != "<no value>" ]]; then
        echo "[$project] 포트 $port 사용 Compose 프로젝트 내리기: $owner_project"
        while IFS= read -r project_container_id; do
          [[ -n "$project_container_id" ]] && docker rm --force "$project_container_id" >/dev/null
        done < <(docker ps -aq --filter "label=com.docker.compose.project=$owner_project")
        while IFS= read -r project_network_id; do
          [[ -n "$project_network_id" ]] && docker network rm "$project_network_id" >/dev/null 2>&1 || true
        done < <(docker network ls -q --filter "label=com.docker.compose.project=$owner_project")
      else
        echo "[$project] 포트 $port 사용 컨테이너 제거: $owner_name"
        docker rm --force "$owner_id" >/dev/null
      fi
    elif [[ "$owner_name" != "${project}-web-1" ]]; then
      echo "오류: 호스트 포트 $port를 다른 컨테이너가 사용 중입니다: $owner_name" >&2
      echo "REPLACE_PORT_OWNERS=1로 실행하면 해당 포트 사용 컨테이너를 교체합니다." >&2
      return 1
    fi
  done < <(docker ps --format '{{.ID}}\t{{.Names}}\t{{.Ports}}')
}

umask 077
mkdir -p "$STATE_DIR"

if [[ "$RESET_EXISTING_INSTANCES" == "1" ]]; then
  while IFS= read -r -d '' existing_env_file; do
    existing_project="$(sed -n 's/^COMPOSE_PROJECT_NAME=//p' "$existing_env_file")"
    if [[ -n "$existing_project" ]]; then
      echo "기존 인스턴스 내리기: $existing_project"
      compose_instance "$existing_env_file" "$existing_project" \
        down --remove-orphans --timeout 10
    fi
  done < <(find "$STATE_DIR" -maxdepth 1 -type f -name '*.env' -print0)
fi

if ! docker network inspect "$LAB_INGRESS_NETWORK" >/dev/null 2>&1; then
  echo "공유 ingress 네트워크 생성: $LAB_INGRESS_NETWORK ($LAB_INGRESS_SUBNET)"
  docker network create \
    --driver bridge \
    --subnet "$LAB_INGRESS_SUBNET" \
    "$LAB_INGRESS_NETWORK" >/dev/null
fi

echo "공통 애플리케이션 이미지를 한 번만 빌드합니다."
docker compose -f "$ROOT_DIR/compose.yaml" build command-sandbox portal

MANIFEST_TMP="$STATE_DIR/credentials.tsv.tmp"
MANIFEST="$STATE_DIR/credentials.tsv"
printf 'instance\tproject\turl\taccess_user\taccess_password\n' > "$MANIFEST_TMP"

health_host="$LAB_BIND_IP"
if [[ "$health_host" == "0.0.0.0" ]]; then
  health_host="127.0.0.1"
fi
access_host="${LAB_ACCESS_HOST:-$health_host}"

for ((number = 1; number <= INSTANCE_COUNT; number++)); do
  instance="$(printf '%02d' "$number")"
  project="sejong-lab-$instance"
  port=$((BASE_PORT + number - 1))
  private_subnet="$LAB_PRIVATE_PREFIX.$number.0/29"
  env_file="$STATE_DIR/$instance.env"
  access_file="$STATE_DIR/$instance.access"
  htpasswd_file="$STATE_DIR/$instance.htpasswd"

  access_user="trainee$instance"
  if [[ -f "$access_file" ]]; then
    # shellcheck disable=SC1090
    source "$access_file"
    access_user="$LAB_ACCESS_USER"
    access_password="$LAB_ACCESS_PASSWORD"
  else
    access_password="$(openssl rand -hex 8)"
    {
      printf 'LAB_ACCESS_USER=%q\n' "$access_user"
      printf 'LAB_ACCESS_PASSWORD=%q\n' "$access_password"
    } > "$access_file"
  fi

  printf '%s:%s\n' "$access_user" "$(openssl passwd -apr1 "$access_password")" > "$htpasswd_file"
  chmod 644 "$htpasswd_file"

  cat > "$env_file" <<EOF
COMPOSE_PROJECT_NAME=$project
LAB_BIND_IP=$LAB_BIND_IP
LAB_PORT=$port
LAB_PRIVATE_SUBNET=$private_subnet
LAB_INGRESS_NETWORK=$LAB_INGRESS_NETWORK
LAB_HTPASSWD_FILE=$htpasswd_file
EOF

  echo "[$instance/$INSTANCE_COUNT] $project 시작: $LAB_BIND_IP:$port"
  validate_resolved_port "$env_file" "$project" "$port"
  prepare_host_port "$project" "$port"

  compose_instance "$env_file" "$project" \
    up -d --no-build --remove-orphans
  ensure_published_port "$env_file" "$project" "$port"

  healthy=0
  for _attempt in {1..30}; do
    if curl --silent --show-error --fail \
      --user "$access_user:$access_password" \
      "http://$health_host:$port/api/health" >/dev/null 2>&1; then
      healthy=1
      break
    fi
    sleep 1
  done
  if (( healthy == 0 )); then
    echo "오류: $project 헬스 체크가 실패했습니다. 이미 시작한 인스턴스는 유지됩니다." >&2
    compose_instance "$env_file" "$project" ps >&2 || true
    compose_instance "$env_file" "$project" logs --tail=80 web portal >&2 || true
    exit 1
  fi

  printf '%s\t%s\thttp://%s:%s/\t%s\t%s\n' \
    "$instance" "$project" "$access_host" "$port" "$access_user" "$access_password" \
    >> "$MANIFEST_TMP"
done

mv "$MANIFEST_TMP" "$MANIFEST"
chmod 600 "$MANIFEST"

echo
echo "${INSTANCE_COUNT}개 인스턴스 시작 완료"
echo "포트 범위: $BASE_PORT-$((BASE_PORT + INSTANCE_COUNT - 1))"
echo "로컬 접속 범위: http://$access_host:$BASE_PORT/ ~ http://$access_host:$((BASE_PORT + INSTANCE_COUNT - 1))/"
echo "교육생별 접속 정보: $MANIFEST"
echo "주의: 접속 정보 파일에는 평문 비밀번호가 있으므로 강사만 읽을 수 있게 유지하세요."
