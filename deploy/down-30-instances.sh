#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
STATE_DIR="${STATE_DIR:-$ROOT_DIR/deploy/state}"
REMOVE_VOLUMES="${REMOVE_VOLUMES:-0}"

shopt -s nullglob
env_files=("$STATE_DIR"/*.env)
if (( ${#env_files[@]} == 0 )); then
  echo "내릴 인스턴스 설정이 없습니다: $STATE_DIR" >&2
  exit 0
fi

down_args=(down --remove-orphans --timeout 10)
if [[ "$REMOVE_VOLUMES" == "1" ]]; then
  down_args+=(--volumes)
fi

for env_file in "${env_files[@]}"; do
  project="$(sed -n 's/^COMPOSE_PROJECT_NAME=//p' "$env_file")"
  if [[ -z "$project" ]]; then
    echo "경고: 프로젝트명이 없는 설정을 건너뜁니다: $env_file" >&2
    continue
  fi

  echo "$project 내리기"
  docker compose \
    --env-file "$env_file" \
    -f "$ROOT_DIR/compose.yaml" \
    -f "$ROOT_DIR/compose.server.yaml" \
    -p "$project" \
    "${down_args[@]}"
done

echo
if [[ "$REMOVE_VOLUMES" == "1" ]]; then
  echo "전체 인스턴스와 DB·업로드 볼륨을 내렸습니다."
else
  echo "전체 인스턴스를 내렸습니다. DB와 업로드 볼륨은 보존됩니다."
  echo "완전 초기화: REMOVE_VOLUMES=1 $0"
fi
