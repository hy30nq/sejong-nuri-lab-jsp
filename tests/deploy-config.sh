#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

expect_contains() {
  case "$1" in
    *"$2"*) ;;
    *) echo "FAIL: expected '$2'" >&2; exit 1 ;;
  esac
}

expect_not_contains() {
  case "$1" in
    *"$2"*) echo "FAIL: did not expect '$2'" >&2; exit 1 ;;
    *) ;;
  esac
}

for script in deploy/start-30-instances.sh deploy/stop-30-instances.sh deploy/down-30-instances.sh; do
  bash -n "$script"
done

default_config="$(docker compose -f compose.yaml config)"
expect_not_contains "$default_config" 'host_ip:'
expect_contains "$default_config" 'target: 11191'
expect_contains "$default_config" 'published: "11191"'

server_config="$(
  COMPOSE_PROJECT_NAME=sejong-lab-30 \
  LAB_PORT=11220 \
  LAB_PRIVATE_SUBNET=10.240.30.0/29 \
  LAB_INGRESS_NETWORK=sejong-lab-ingress \
  docker compose -f compose.yaml -f compose.server.yaml -p sejong-lab-30 config
)"
expect_not_contains "$server_config" 'host_ip:'
expect_contains "$server_config" 'target: 11191'
expect_contains "$server_config" 'published: "11220"'
expect_contains "$server_config" 'name: sejong-lab-ingress'

nginx_server_config="$(<deploy/nginx.server.conf)"
expect_not_contains "$nginx_server_config" 'auth_basic'
expect_not_contains "$nginx_server_config" 'auth.htpasswd'

echo 'PASS: deployment scripts and port mappings'
