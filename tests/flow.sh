#!/usr/bin/env bash
set -euo pipefail

base_url="${BASE_URL:-http://127.0.0.1:11191}"
mkdir -p build/e2e
citizen_cookie="build/e2e/citizen.cookie"
staff_cookie="build/e2e/staff.cookie"
sqli_cookie="build/e2e/sqli.cookie"
rm -f "$citizen_cookie" "$staff_cookie" "$sqli_cookie"

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

home_headers=$(curl -sS -D - -o build/e2e/home.html "$base_url/")
case "$home_headers" in
  *'sn_citizen='*|*'JSESSIONID='*) echo 'FAIL: anonymous visit created a login session' >&2; exit 1 ;;
esac
home=$(<build/e2e/home.html)
expect_contains "$home" '필요한 시민 서비스를 찾으세요'
expect_contains "$home" 'data-page="home"'
expect_contains "$home" '/assets/app.js?v=20261119-2'
expect_contains "$home" '>로그인<'
case "$home" in
  *'한가람님'*) echo 'FAIL: portal still looks automatically signed in' >&2; exit 1 ;;
esac

styles=$(curl -fsS "$base_url/assets/styles.css")
expect_contains "$styles" '.main-header'
scripts=$(curl -fsS "$base_url/assets/app.js")
expect_contains "$scripts" '/api/citizens/login'
expect_contains "$scripts" 'data-logout'

redirect_headers=$(curl -sS -D - -o /dev/null \
  -H 'Host: training.example.invalid:54321' "$base_url/complaints")
expect_contains "$redirect_headers" 'Location: /login?next=%2Fcomplaints'
case "$redirect_headers" in
  *'Location: http://'*) echo 'FAIL: redirect leaked an absolute HTTP origin' >&2; exit 1 ;;
esac

login_headers=$(curl -sS -D - -o build/e2e/login.html "$base_url/login")
expect_contains "$login_headers" 'HTTP/1.1 200'
case "$login_headers" in
  *'sn_citizen='*|*'JSESSIONID='*) echo 'FAIL: login page created a session before authentication' >&2; exit 1 ;;
esac
login_page=$(<build/e2e/login.html)
expect_contains "$login_page" 'data-page="login"'
expect_contains "$login_page" 'id="login-form"'
expect_contains "$login_page" 'name="password"'
expect_contains "$login_page" 'id="account-check-form"'

registered=$(curl -fsS --get --data-urlencode "username=admin' AND UNICODE(SUBSTR(recovery_code, 1, 1)) > 70 -- " "$base_url/api/public/account-check")
expect_contains "$registered" '"registered":true'

sqli_login=$(curl -fsS -c "$sqli_cookie" -H 'Content-Type: application/json' \
  -d '{"username":"admin'\'' -- ","password":"wrong"}' "$base_url/api/citizens/login")
expect_contains "$sqli_login" '"role":"staff"'

login=$(curl -fsS -c "$citizen_cookie" -H 'Content-Type: application/json' \
  -d '{"username":"hangaram","password":"hangaram"}' "$base_url/api/citizens/login")
expect_contains "$login" '"username":"hangaram"'

signed_in_redirect=$(curl -sS -D - -o /dev/null -b "$citizen_cookie" "$base_url/login")
expect_contains "$signed_in_redirect" 'Location: /account'

idor=$(curl -fsS -b "$citizen_cookie" --get --data-urlencode 'receiptNo=APP-1000' "$base_url/api/applications")
expect_contains "$idor" '김다정'
expect_contains "$idor" '010-0000-2026'

identity=$(curl -fsS -b "$citizen_cookie" -H 'Content-Type: application/json' \
  -d '{"verificationStep":"complete"}' "$base_url/api/citizens/identity/complete")
expect_contains "$identity" '"verified":true'

traversal=$(curl -fsS -b "$citizen_cookie" --get --data-urlencode 'file=../../private/operations.txt' "$base_url/api/documents/download")
expect_contains "$traversal" 'TRAINING ONLY'

ssrf=$(curl -fsS -b "$citizen_cookie" --get --data-urlencode 'url=http://169.254.169.254/latest/meta-data/iam/security-credentials/SejongNuriTrainingRole' "$base_url/api/documents/preview")
expect_contains "$ssrf" 'TRAINING_ONLY_ACCESS_KEY'

xss=$(curl -fsS -b "$citizen_cookie" -H 'Content-Type: application/json' \
  -d '{"content":"<img src=x onerror=console.log(\"training-xss\")>"}' "$base_url/api/board/posts")
expect_contains "$xss" 'training-xss'
posts=$(curl -fsS "$base_url/api/board/posts")
expect_contains "$posts" 'training-xss'

csrf=$(curl -fsS -b "$citizen_cookie" "$base_url/api/citizens/preferences/email?enabled=false")
expect_contains "$csrf" '"emailEnabled":false'

certificate=$(curl -fsS -b "$citizen_cookie" "$base_url/api/certificates/7001/download")
expect_contains "$certificate" '승인되지 않은 신청 건'

command=$(curl -fsS -b "$citizen_cookie" --get --data-urlencode 'target=portal.internal;cat config/service.txt' "$base_url/api/service/status/check")
expect_contains "$command" '내부 서비스 점검 메모'
expect_contains "$command" '"isolatedTrainingContainer":true'

upload=$(curl -fsS -b "$citizen_cookie" -F 'attachment=@demo/upload-demo.html;type=text/html' "$base_url/api/attachments")
expect_contains "$upload" '"publicUrl":"/uploads/'

staff=$(curl -fsS -c "$staff_cookie" -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"admin"}' "$base_url/api/citizens/login")
expect_contains "$staff" '"role":"staff"'
overview=$(curl -fsS -b "$staff_cookie" "$base_url/api/admin/overview")
expect_contains "$overview" '"applications"'
expect_contains "$overview" '"accounts"'

for path in /services /notices /login /board /status; do
  status=$(curl -sS -o /dev/null -w '%{http_code}' "$base_url$path")
  test "$status" = 200
done
for path in /account /complaints /documents /attachments /certificates /settings /identity /apply; do
  status=$(curl -sS -b "$citizen_cookie" -o /dev/null -w '%{http_code}' "$base_url$path")
  test "$status" = 200
done
status=$(curl -sS -b "$staff_cookie" -o /dev/null -w '%{http_code}' "$base_url/admin")
test "$status" = 200

logout_status=$(curl -sS -b "$citizen_cookie" -c "$citizen_cookie" -o /dev/null -w '%{http_code}' -X POST "$base_url/api/citizens/logout")
test "$logout_status" = 204
logged_out_redirect=$(curl -sS -D - -o /dev/null -b "$citizen_cookie" "$base_url/account")
expect_contains "$logged_out_redirect" 'Location: /login?next=%2Faccount'

echo 'PASS: login page, SQLi flow, logout, and JSP/WildFly training flows'
