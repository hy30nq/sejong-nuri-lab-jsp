#!/usr/bin/env bash
set -euo pipefail

base_url="${BASE_URL:-http://127.0.0.1:11191}"
mkdir -p build/e2e

expect_contains() {
  case "$1" in
    *"$2"*) ;;
    *) echo "FAIL: expected '$2'" >&2; exit 1 ;;
  esac
}

compose_config=$(docker compose config)
expect_contains "$compose_config" 'published: "11191"'

health=$(curl -fsS "$base_url/api/health")
expect_contains "$health" '"runtime":"WildFly"'

home=$(curl -fsS "$base_url/")
expect_contains "$home" '필요한 시민 서비스를 찾으세요'
expect_contains "$home" 'data-page="home"'
expect_contains "$home" '/assets/app.js?v=20261118-3'

styles=$(curl -fsS "$base_url/assets/styles.css")
expect_contains "$styles" '.main-header'
scripts=$(curl -fsS "$base_url/assets/app.js")
case "$scripts" in
  *'/api/citizens/login'*|*'data-logout'*) echo 'FAIL: login client code still exists' >&2; exit 1 ;;
esac

direct_status=$(curl -sS -o /dev/null -w '%{http_code}' -H 'Host: training.example.invalid:54321' "$base_url/complaints")
test "$direct_status" = 200

registered=$(curl -fsS --get --data-urlencode "username=admin' AND UNICODE(SUBSTR(recovery_code, 1, 1)) > 70 -- " "$base_url/api/public/account-check")
expect_contains "$registered" '"registered":true'

login_api_status=$(curl -sS -o /dev/null -w '%{http_code}' -H 'Content-Type: application/json' \
  -d '{}' "$base_url/api/citizens/login")
test "$login_api_status" = 404
login_page_headers=$(curl -sS -D - -o /dev/null "$base_url/login")
expect_contains "$login_page_headers" 'Location: /'

idor=$(curl -fsS --get --data-urlencode 'receiptNo=APP-1000' "$base_url/api/applications")
expect_contains "$idor" '김다정'
expect_contains "$idor" '010-0000-2026'

identity=$(curl -fsS -H 'Content-Type: application/json' \
  -d '{"verificationStep":"complete"}' "$base_url/api/citizens/identity/complete")
expect_contains "$identity" '"verified":true'

traversal=$(curl -fsS --get --data-urlencode 'file=../../private/operations.txt' "$base_url/api/documents/download")
expect_contains "$traversal" 'TRAINING ONLY'

ssrf=$(curl -fsS --get --data-urlencode 'url=http://169.254.169.254/latest/meta-data/iam/security-credentials/SejongNuriTrainingRole' "$base_url/api/documents/preview")
expect_contains "$ssrf" 'TRAINING_ONLY_ACCESS_KEY'

xss=$(curl -fsS -H 'Content-Type: application/json' \
  -d '{"content":"<img src=x onerror=console.log(\"training-xss\")>"}' "$base_url/api/board/posts")
expect_contains "$xss" 'training-xss'
korean_post=$(curl -fsS -H 'Content-Type: application/json' \
  -d '{"content":"한글 의견 등록 확인"}' "$base_url/api/board/posts")
expect_contains "$korean_post" '한글 의견 등록 확인'
posts=$(curl -fsS "$base_url/api/board/posts")
expect_contains "$posts" 'training-xss'
expect_contains "$posts" '한글 의견 등록 확인'

csrf=$(curl -fsS "$base_url/api/citizens/preferences/email?enabled=false")
expect_contains "$csrf" '"emailEnabled":false'

certificate=$(curl -fsS "$base_url/api/certificates/7001/download")
expect_contains "$certificate" '승인되지 않은 신청 건'

command=$(curl -fsS --get --data-urlencode 'target=portal.internal;cat config/service.txt' "$base_url/api/service/status/check")
expect_contains "$command" '내부 서비스 점검 메모'
expect_contains "$command" '"isolatedTrainingContainer":true'

upload=$(curl -fsS -F 'attachment=@demo/upload-demo.html;type=text/html' "$base_url/api/attachments")
expect_contains "$upload" '"publicUrl":"/uploads/'

overview=$(curl -fsS "$base_url/api/admin/overview")
expect_contains "$overview" '"applications"'
expect_contains "$overview" '"accounts"'

for path in /services /notices /board /status /account /complaints /documents /attachments /certificates /settings /identity /apply /admin; do
  status=$(curl -sS -o /dev/null -w '%{http_code}' "$base_url$path")
  test "$status" = 200
done

echo 'PASS: login-free JSP/WildFly portal and training flows'
