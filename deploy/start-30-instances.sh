#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
STATE_DIR="${STATE_DIR:-$ROOT_DIR/deploy/state}"
INSTANCE_COUNT="${INSTANCE_COUNT:-30}"
BASE_PORT="${BASE_PORT:-11191}"
LAB_BIND_IP="${LAB_BIND_IP:-}"
LAB_PRIVATE_PREFIX="${LAB_PRIVATE_PREFIX:-10.240}"
LAB_INGRESS_NETWORK="${LAB_INGRESS_NETWORK:-sejong-lab-ingress}"
LAB_INGRESS_SUBNET="${LAB_INGRESS_SUBNET:-10.239.255.0/24}"

if [[ -z "$LAB_BIND_IP" ]]; then
  echo "오류: 학교 서버의 내부 IPv4 주소를 LAB_BIND_IP로 지정하세요." >&2
  echo "예: LAB_BIND_IP=10.20.30.40 ./deploy/start-30-instances.sh" >&2
  exit 2
fi

if ! [[ "$INSTANCE_COUNT" =~ ^[0-9]+$ ]] || (( INSTANCE_COUNT < 1 || INSTANCE_COUNT > 200 )); then
  echo "오류: INSTANCE_COUNT는 1~200 사이의 정수여야 합니다." >&2
  exit 2
fi

if ! [[ "$BASE_PORT" =~ ^[0-9]+$ ]] || (( BASE_PORT < 1024 || BASE_PORT + INSTANCE_COUNT - 1 > 65535 )); then
  echo "오류: BASE_PORT와 인스턴스 수로 계산한 포트 범위를 확인하세요." >&2
  exit 2
fi

for command_name in docker openssl curl; do
  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "오류: $command_name 명령이 필요합니다." >&2
    exit 2
  fi
done

docker info >/dev/null
docker compose version >/dev/null

umask 077
mkdir -p "$STATE_DIR"

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
  docker compose \
    --env-file "$env_file" \
    -f "$ROOT_DIR/compose.yaml" \
    -f "$ROOT_DIR/compose.server.yaml" \
    -p "$project" \
    up -d --no-build --remove-orphans

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
    exit 1
  fi

  printf '%s\t%s\thttp://%s:%s/\t%s\t%s\n' \
    "$instance" "$project" "$LAB_BIND_IP" "$port" "$access_user" "$access_password" \
    >> "$MANIFEST_TMP"
done

mv "$MANIFEST_TMP" "$MANIFEST"
chmod 600 "$MANIFEST"

echo
echo "${INSTANCE_COUNT}개 인스턴스 시작 완료"
echo "포트 범위: $BASE_PORT-$((BASE_PORT + INSTANCE_COUNT - 1))"
echo "교육생별 접속 정보: $MANIFEST"
echo "주의: 접속 정보 파일에는 평문 비밀번호가 있으므로 강사만 읽을 수 있게 유지하세요."
