#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
STATE_DIR="${STATE_DIR:-$ROOT_DIR/deploy/state}"

shopt -s nullglob
env_files=("$STATE_DIR"/*.env)
if (( ${#env_files[@]} == 0 )); then
  echo "중지할 인스턴스 설정이 없습니다: $STATE_DIR" >&2
  exit 0
fi

for env_file in "${env_files[@]}"; do
  project="$(sed -n 's/^COMPOSE_PROJECT_NAME=//p' "$env_file")"
  if [[ -z "$project" ]]; then
    echo "경고: 프로젝트명이 없는 설정을 건너뜁니다: $env_file" >&2
    continue
  fi

  echo "$project 중지"
  docker compose \
    --env-file "$env_file" \
    -f "$ROOT_DIR/compose.yaml" \
    -f "$ROOT_DIR/compose.server.yaml" \
    -p "$project" \
    stop --timeout 5
done

echo
echo "전체 인스턴스를 중지했습니다. DB와 업로드 볼륨은 보존되어 다시 시작할 수 있습니다."
echo "재시작: LAB_BIND_IP=<학교 서버 IP> ./deploy/start-30-instances.sh"
