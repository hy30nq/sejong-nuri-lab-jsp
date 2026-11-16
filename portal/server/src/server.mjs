import { randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, renameSync, statSync, unlinkSync } from 'node:fs'
import { createServer, request as httpRequest } from 'node:http'
import { dirname, extname, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import multer from 'multer'
import { db, ensureSeeded, serverRoot } from './database.mjs'

if (process.env.TRAINING_MODE !== '1') {
  throw new Error('이 서버는 의도적인 취약점을 포함합니다. 폐쇄된 실습환경에서 TRAINING_MODE=1로만 실행하세요.')
}

ensureSeeded()

const here = dirname(fileURLToPath(import.meta.url))
const imageTrainingRoot = resolve(here, '../training_data')
const trainingRoot = imageTrainingRoot
const fileLabRoot = resolve(trainingRoot, 'file_lab')
const publicDocs = resolve(fileLabRoot, 'var/www/public')
const uploadRoot = resolve(process.env.TARGET_UPLOAD_ROOT || resolve(serverRoot, 'uploads'))
const webRoot = resolve(serverRoot, '../dist')
mkdirSync(uploadRoot, { recursive: true })

const upload = multer({ dest: uploadRoot, limits: { fileSize: 2 * 1024 * 1024 } })
const maxUploadFiles = Number(process.env.TARGET_UPLOAD_MAX_FILES || 50)
const maxUploadBytes = Number(process.env.TARGET_UPLOAD_MAX_BYTES || 64 * 1024 * 1024)
if (!Number.isSafeInteger(maxUploadFiles) || maxUploadFiles < 1 ||
  !Number.isSafeInteger(maxUploadBytes) || maxUploadBytes < 1024) {
  throw new Error('업로드 저장 한도 설정이 올바르지 않습니다.')
}
const app = express()
const port = Number(process.env.TARGET_API_PORT || 4200)
const host = process.env.TARGET_API_HOST || '127.0.0.1'
const citizenCookieName = 'sn_citizen'
const maxCitizenSessions = 1000

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character])
}

function sessionToken(req) {
  return (req.headers.cookie || '').split(';').map((value) => value.trim())
    .find((value) => value.startsWith(`${citizenCookieName}=`))?.slice(citizenCookieName.length + 1)
}

app.disable('x-powered-by')
app.use(express.json({ limit: '256kb' }))
app.use(express.urlencoded({ extended: false }))
app.use('/uploads', express.static(uploadRoot, { index: false }))
app.use('/uploads', (_req, res) => res.status(404).json({ message: '첨부파일을 찾을 수 없습니다.' }))

// The metadata endpoint is reachable from this process only. It gives the URL preview
// exercise a real internal HTTP hop without giving the lab unrestricted egress.
const metadataDocuments = new Map([
  ['/guide', '세종누리 시민지원 안내: 민원 신청, 처리현황 조회, 결과문서 발급을 이용할 수 있습니다.'],
  ['/operations', '내부 운영 메모\n- 장애 신고: 정보운영팀 내선 4026\n- 야간 당직: 운영상황실 내선 4099\n- 문서 저장소: http://document-store.internal:9000'],
  ['/network', '내부 서비스 맵\nportal.internal:4200 (시민포털)\ncitizen-db.internal:5432 (업무 DB)\ndocument-store.internal:9000 (문서 저장소)\nmetadata.internal:80 (인스턴스 메타데이터)'],
  ['/latest/meta-data/', 'instance-id\nlocal-ipv4\niam/security-credentials/'],
  ['/latest/meta-data/instance-id', 'i-sejong-training-2026'],
  ['/latest/meta-data/local-ipv4', '10.24.7.23'],
  ['/latest/meta-data/iam/security-credentials/', 'SejongNuriTrainingRole'],
  ['/latest/meta-data/iam/security-credentials/SejongNuriTrainingRole', JSON.stringify({
    Code: 'Success', AccessKeyId: 'TRAINING_ONLY_ACCESS_KEY',
    SecretAccessKey: 'TRAINING_ONLY_SECRET', Token: 'TRAINING_ONLY_SESSION_TOKEN',
    Expiration: '2026-11-16T23:59:59+09:00',
  }, null, 2)],
])

const metadataServer = createServer((req, res) => {
  if (req.method === 'GET' && metadataDocuments.has(req.url)) {
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end(metadataDocuments.get(req.url))
    return
  }
  res.writeHead(404).end('Not found')
})
await new Promise((resolveListening, rejectListening) => {
  metadataServer.once('error', rejectListening)
  metadataServer.listen(0, '127.0.0.1', resolveListening)
})
const metadataPort = metadataServer.address().port

app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'sejong-nuri-target', trainingMode: true }))

function currentCitizen(req) {
  const token = sessionToken(req)
  if (!token) return null
  return db.prepare(`SELECT c.username, c.display_name AS displayName, c.department, c.training_note AS trainingNote,
    a.role FROM portal_sessions s JOIN citizens c ON c.username = s.username
    JOIN portal_accounts a ON a.username = s.username
    WHERE s.token = ? AND s.created_at >= datetime('now', '-12 hours')`).get(token) || null
}

function requireCitizen(req, res, next) {
  req.citizen = currentCitizen(req)
  if (!req.citizen) return res.status(401).json({ message: '로그인 후 이용할 수 있습니다.' })
  next()
}

function requirePortalStaff(req, res, next) {
  req.citizen = currentCitizen(req)
  if (!req.citizen) return res.status(401).json({ message: '로그인 후 이용할 수 있습니다.' })
  if (req.citizen.role !== 'staff') return res.status(403).json({ message: '관리자 권한이 필요합니다.' })
  next()
}

app.get('/api/citizens/session', (req, res) => res.json({ user: currentCitizen(req) }))

// 교육용 Boolean 기반 Blind SQLi: 응답에는 계정 존재 여부만 노출된다.
app.get('/api/public/account-check', (req, res) => {
  const username = String(req.query.username || '')
  if (!username || username.length > 500) return res.status(400).json({ message: '확인할 아이디를 입력해 주세요.' })
  const query = `SELECT username FROM portal_accounts WHERE username = '${username}'`
  try {
    res.json({ registered: Boolean(db.prepare(query).get()) })
  } catch {
    res.status(400).json({ message: '계정 등록 여부를 확인할 수 없습니다.' })
  }
})

// 교육용 로그인: 입력값을 SQL에 직접 연결하는 결함을 관찰한다.
app.post('/api/citizens/login', (req, res) => {
  const username = String(req.body?.username || '')
  const password = String(req.body?.password || '')
  if (username.length > 300 || password.length > 128) {
    return res.status(400).json({ message: '로그인 입력 길이를 확인해 주세요.' })
  }
  const query = `SELECT c.username, c.display_name AS displayName, c.department, c.training_note AS trainingNote, a.role
    FROM portal_accounts a JOIN citizens c ON c.username = a.username
    WHERE a.username = '${username}' AND a.password = '${password}'`
  let user
  try { user = db.prepare(query).get() } catch { return res.status(400).json({ message: '로그인을 처리할 수 없습니다.' }) }
  if (!user) return res.status(401).json({ message: '아이디 또는 비밀번호를 확인해 주세요.' })
  db.prepare("DELETE FROM portal_sessions WHERE created_at < datetime('now', '-12 hours')").run()
  db.prepare(`DELETE FROM portal_sessions WHERE token IN (
    SELECT token FROM portal_sessions ORDER BY created_at DESC, rowid DESC LIMIT -1 OFFSET ?
  )`).run(maxCitizenSessions - 1)
  const token = randomBytes(24).toString('hex')
  db.prepare('INSERT INTO portal_sessions (token, username) VALUES (?, ?)').run(token, user.username)
  res.setHeader('Set-Cookie', `${citizenCookieName}=${token}; HttpOnly; Path=/; SameSite=Lax`)
  res.json({ user })
})

app.post('/api/citizens/logout', (req, res) => {
  const token = sessionToken(req)
  if (token) db.prepare('DELETE FROM portal_sessions WHERE token = ?').run(token)
  res.setHeader('Set-Cookie', `${citizenCookieName}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`)
  res.status(204).end()
})

app.get('/api/public/dashboard', (req, res) => {
  const citizen = currentCitizen(req)
  const username = citizen?.username || 'hangaram'
  const complaints = db.prepare(`
    SELECT display_id AS id, title, status, COALESCE(updated_at, created_at) AS updatedAt, category AS department
    FROM applications WHERE owner_username = ? AND status != '처리 완료'
    ORDER BY COALESCE(updated_at, created_at) DESC, id DESC LIMIT 5
  `).all(username)
  const notices = db.prepare('SELECT id, kind, title, published_at AS date FROM notices ORDER BY id DESC LIMIT 5').all()
  res.json({ user: { username, displayName: citizen?.displayName || '방문자' }, complaints: citizen ? complaints : [], notices })
})

app.get('/api/public/notices', (_req, res) => {
  const notices = db.prepare('SELECT id, kind, title, published_at AS date FROM notices ORDER BY id DESC LIMIT 100').all()
  res.json({ notices })
})

app.get('/api/public/notices/:id', (req, res) => {
  const notice = db.prepare('SELECT id, kind, title, published_at AS date, body FROM notices WHERE id = ?').get(Number(req.params.id))
  if (!notice) return res.status(404).json({ message: '공지를 찾을 수 없습니다.' })
  res.json({ notice })
})

// 시민포털의 실제 운영 화면. 교육 과정 운영 DB와는 별개인 포털 업무 데이터다.
app.get('/api/admin/overview', requirePortalStaff, (_req, res) => {
  const counts = {
    citizens: db.prepare("SELECT COUNT(*) AS count FROM portal_accounts WHERE role = 'citizen'").get().count,
    applications: db.prepare('SELECT COUNT(*) AS count FROM applications').get().count,
    pending: db.prepare("SELECT COUNT(*) AS count FROM applications WHERE status != '처리 완료'").get().count,
    posts: db.prepare('SELECT COUNT(*) AS count FROM board_posts').get().count,
  }
  const applications = db.prepare(`SELECT a.id, a.display_id AS displayId, a.owner_username AS ownerUsername,
    c.display_name AS ownerName, a.category, a.title, a.status, a.created_at AS createdAt
    FROM applications a JOIN citizens c ON c.username = a.owner_username ORDER BY a.id DESC LIMIT 50`).all()
  const posts = db.prepare('SELECT id, author, content, created_at AS createdAt FROM board_posts ORDER BY id DESC LIMIT 30').all()
  const notices = db.prepare('SELECT id, kind, title, published_at AS publishedAt FROM notices ORDER BY id DESC LIMIT 30').all()
  const accounts = db.prepare(`SELECT c.username, c.display_name AS displayName, c.department, a.role
    FROM portal_accounts a JOIN citizens c ON c.username = a.username ORDER BY c.id`).all()
  res.json({ counts, applications, posts, notices, accounts })
})

app.patch('/api/admin/applications/:id/status', requirePortalStaff, (req, res) => {
  const status = String(req.body?.status || '')
  if (!['접수 완료', '처리 중', '처리 완료'].includes(status)) return res.status(400).json({ message: '올바른 처리 상태를 선택해 주세요.' })
  const result = db.prepare('UPDATE applications SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(status, Number(req.params.id))
  if (!result.changes) return res.status(404).json({ message: '민원을 찾을 수 없습니다.' })
  res.json({ updated: true, status })
})

app.post('/api/admin/notices', requirePortalStaff, (req, res) => {
  const title = String(req.body?.title || '').trim()
  const body = String(req.body?.body || '').trim()
  const kind = String(req.body?.kind || 'normal')
  if (!title || title.length > 120 || !body || body.length > 3000 || !['normal', 'important'].includes(kind)) return res.status(400).json({ message: '공지 제목과 내용을 확인해 주세요.' })
  const date = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' })
  const result = db.prepare('INSERT INTO notices (kind, title, published_at, body) VALUES (?, ?, ?, ?)').run(kind, title, date, body)
  res.status(201).json({ id: Number(result.lastInsertRowid), kind, title, body, publishedAt: date })
})

app.delete('/api/admin/board/posts/:id', requirePortalStaff, (req, res) => {
  const result = db.prepare('DELETE FROM board_posts WHERE id = ?').run(Number(req.params.id))
  if (!result.changes) return res.status(404).json({ message: '게시글을 찾을 수 없습니다.' })
  res.status(204).end()
})

app.post('/api/applications', requireCitizen, (req, res) => {
  const username = req.citizen.username
  const category = String(req.body?.category || '').trim()
  const title = String(req.body?.title || '').trim()
  const detail = String(req.body?.detail || '').trim()
  if (!['주거·환경', '생활·복지', '교통·시설'].includes(category) ||
    !title || title.length > 80 || !detail || detail.length > 3000) {
    return res.status(400).json({ message: '민원 분야와 제목(80자 이내)·상세 내용(3000자 이내)을 확인해 주세요.' })
  }
  if (db.prepare('SELECT COUNT(*) AS count FROM applications').get().count >= 500) {
    return res.status(409).json({ message: '민원 저장 한도에 도달했습니다. 강사에게 문의해 주세요.' })
  }
  const next = db.prepare('SELECT COALESCE(MAX(id), 0) + 1 AS id FROM applications').get().id
  const displayId = `SN-2026-${1110 + Number(next)}`
  const result = db.prepare(`
    INSERT INTO applications (display_id, owner_username, category, title, detail, status)
    VALUES (?, ?, ?, ?, ?, '접수 완료')
  `).run(displayId, username, category, title, detail)
  res.status(201).json({ id: Number(result.lastInsertRowid), displayId, status: '접수 완료' })
})

app.get('/api/applications', requireCitizen, (req, res) => {
  const receiptNo = String(req.query.receiptNo || '').trim()
  if (receiptNo) {
    // 접수번호 조회: 의도적으로 신청자 소유권을 확인하지 않는 교육용 결함.
    const application = db.prepare(`SELECT a.*, c.display_name AS applicant_name,
      c.phone AS applicant_phone, c.email AS applicant_email, c.address AS applicant_address
      FROM applications a JOIN citizens c ON c.username = a.owner_username
      WHERE a.display_id = ?`).get(receiptNo)
    if (!application) return res.status(404).json({ message: '해당 접수번호의 민원을 찾을 수 없습니다.' })
    return res.json({ application })
  }
  const rows = db.prepare('SELECT id, display_id AS displayId, category, title, status, created_at AS createdAt FROM applications WHERE owner_username = ? ORDER BY id DESC').all(req.citizen.username)
  res.json({ applications: rows })
})

// S02 / KISA CI: 실제 shell은 별도 네트워크 없는 컨테이너에서만 실행한다.
// GET 쿼리와 POST JSON 모두 같은 취약한 내부 처리로 전달해 HTTP 메소드와 입력 검증은
// 별개의 보안 통제라는 점을 비교할 수 있게 한다.
function checkServiceStatus(req, res) {
  const target = String(req.method === 'POST' ? req.body?.target || '' : req.query.target || '')
  if (!target || target.length > 1024) return res.status(400).json({ message: '점검 대상을 확인해 주세요.' })
  if (process.env.ENABLE_OS_COMMAND_LAB === '1') {
    const socketPath = process.env.S02_SOCKET_PATH
    if (!socketPath) return res.status(503).json({ message: '명령 실습 환경을 사용할 수 없습니다.' })
    const body = JSON.stringify({ target })
    const request = httpRequest({ socketPath, path: '/run', method: 'POST', headers: {
      'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body),
    } }, (response) => {
      let output = ''
      response.on('data', (chunk) => { output += chunk })
      response.on('end', () => {
        if (res.headersSent) return
        try { res.status(response.statusCode || 502).json(JSON.parse(output)) }
        catch { res.status(502).json({ message: '명령 실습 응답을 읽지 못했습니다.' }) }
      })
    })
    request.on('error', () => { if (!res.headersSent) res.status(503).json({ message: '명령 실습 환경에 연결하지 못했습니다.' }) })
    request.setTimeout(2500, () => request.destroy(new Error('S02 실행 시간 초과')))
    request.end(body)
    return
  }
  let output = `checked: ${target.split(/[;&|]/)[0].trim()}`
  if (/[;&|]\s*cat\s+config\/service\.txt/i.test(target)) output += '\n내부 서비스 점검 메모: portal.internal / 담당 정보운영팀'
  res.json({ output, serviceAvailable: true, mode: 'safe-simulator' })
}
app.get('/api/service/status/check', requireCitizen, checkServiceStatus)
app.post('/api/service/status/check', requireCitizen, checkServiceStatus)

// S03: 서버가 이전 인증 단계 완료 여부를 검증하지 않는 실습용 흐름.
app.get('/api/citizens/identity/status', requireCitizen, (req, res) => {
  const row = db.prepare('SELECT verified_at AS verifiedAt FROM identity_checks WHERE username = ?').get(req.citizen.username)
  res.json({ verified: Boolean(row), verifiedAt: row?.verifiedAt || null })
})
app.post('/api/citizens/identity/complete', requireCitizen, (req, res) => {
  const step = String(req.body?.verificationStep || '')
  function markVerified() {
    db.prepare('INSERT INTO identity_checks (username, verified_at) VALUES (?, CURRENT_TIMESTAMP) ON CONFLICT(username) DO UPDATE SET verified_at = excluded.verified_at').run(req.citizen.username)
  }
  if (step === 'complete') {
    markVerified()
    return res.json({ verified: true, message: '본인 확인이 완료되었습니다.' })
  }
  if (step === 'verify' && String(req.body?.code || '') === '12345678') {
    markVerified()
    return res.json({ verified: true, message: '본인 확인이 완료되었습니다.' })
  }
  res.status(400).json({ verified: false, message: '휴대전화 인증 단계가 필요합니다.' })
})

// S05: 공개 자료실 루트 밖의 교육용 내부 문서가 읽힌다.
app.get('/api/documents/download', requireCitizen, (req, res) => {
  const requested = String(req.query.file || 'guide.txt')
  const candidate = resolve(publicDocs, requested)
  if (!candidate.startsWith(`${fileLabRoot}${sep}`)) return res.status(400).json({ message: '허용되지 않는 경로입니다.' })
  res.sendFile(candidate, (error) => {
    if (error && !res.headersSent) res.status(404).json({ message: '파일을 찾을 수 없습니다.' })
  })
})

// S06: 의도적으로 확장자·콘텐츠 검증을 하지 않는 첨부 기능.
app.post('/api/attachments', requireCitizen, upload.single('attachment'), (req, res) => {
  if (!req.file) return res.status(400).json({ message: '첨부파일이 필요합니다.' })
  const stored = readdirSync(uploadRoot).map((name) => statSync(resolve(uploadRoot, name)))
  if (stored.length > maxUploadFiles || stored.reduce((total, item) => total + item.size, 0) > maxUploadBytes) {
    unlinkSync(req.file.path)
    return res.status(413).json({ message: '이 실습 포털의 첨부파일 저장 한도를 초과했습니다. 강사에게 문의해 주세요.' })
  }
  const extension = extname(req.file.originalname).toLowerCase().slice(0, 12)
  const storedName = `${req.file.filename}${extension}`
  renameSync(req.file.path, resolve(uploadRoot, storedName))
  res.status(201).json({
    storedName,
    originalName: req.file.originalname,
    publicUrl: `/uploads/${storedName}`,
  })
})

// S07: 입력한 URL이 내부 메타데이터 호스트를 가리키면 실제 내부 HTTP 서비스에 요청한다.
app.get('/api/documents/preview', requireCitizen, async (req, res) => {
  let url
  try { url = new URL(String(req.query.url || '')) } catch { return res.status(400).json({ message: '올바른 URL을 입력해 주세요.' }) }
  let internalPath = null
  if (url.protocol === 'http:' && !url.username && !url.password) {
    if (url.hostname === 'guide.sejongnuri.internal' && url.pathname === '/info') internalPath = '/guide'
    if (url.hostname === 'metadata.internal' && ['/operations', '/network'].includes(url.pathname)) internalPath = url.pathname
    if (url.hostname === '169.254.169.254' && url.pathname.startsWith('/latest/meta-data/')) internalPath = url.pathname
  }
  if (internalPath) {
    try {
      const response = await fetch(`http://127.0.0.1:${metadataPort}${internalPath}`, { signal: AbortSignal.timeout(1500), redirect: 'manual' })
      return res.json({ status: response.status, body: await response.text() })
    } catch {
      return res.status(502).json({ message: '미리보기 대상에 연결하지 못했습니다.' })
    }
  }
  res.json({ status: 200, body: '요청하신 페이지의 미리보기를 제공할 수 없습니다.' })
})

// S08: 게시글 저장 후 인코딩을 적용하지 않는 실습용 API.
app.get('/api/board/posts', (_req, res) => {
  res.json({ posts: db.prepare('SELECT * FROM board_posts ORDER BY id DESC LIMIT 100').all() })
})
app.post('/api/board/posts', requireCitizen, (req, res) => {
  const author = req.citizen.displayName
  const content = String(req.body?.content || '')
  if (!content || content.length > 3000) return res.status(400).json({ message: '의견은 1~3000자로 입력해 주세요.' })
  if (db.prepare('SELECT COUNT(*) AS count FROM board_posts').get().count >= 500) {
    return res.status(409).json({ message: '게시판 저장 한도에 도달했습니다. 강사에게 문의해 주세요.' })
  }
  const result = db.prepare('INSERT INTO board_posts (author, content) VALUES (?, ?)').run(author, content)
  res.status(201).json({ id: Number(result.lastInsertRowid), author, content })
})

// S09: GET으로 상태를 변경하며 CSRF 토큰이 없다.
app.get('/api/citizens/preferences/email', requireCitizen, (req, res) => {
  const enabled = String(req.query.enabled) !== 'false' ? 1 : 0
  db.prepare('INSERT INTO preferences (username, email_enabled) VALUES (?, ?) ON CONFLICT(username) DO UPDATE SET email_enabled = excluded.email_enabled').run(req.citizen.username, enabled)
  res.json({ emailEnabled: Boolean(enabled) })
})
app.get('/api/citizens/preferences', requireCitizen, (req, res) => {
  const row = db.prepare('SELECT email_enabled FROM preferences WHERE username = ?').get(req.citizen.username)
  res.json({ emailEnabled: Boolean(row?.email_enabled ?? 1) })
})

// S10: 승인 상태를 확인하지 않고 문서를 발급한다.
app.get('/api/certificates', requireCitizen, (req, res) => {
  res.json({ certificates: db.prepare('SELECT id, title, status FROM certificates WHERE owner_username = ?').all(req.citizen.username) })
})
app.get('/api/certificates/:id/download', requireCitizen, (req, res) => {
  const certificate = db.prepare(`SELECT cert.*, c.display_name AS owner_name
    FROM certificates cert JOIN citizens c ON c.username = cert.owner_username WHERE cert.id = ?`).get(Number(req.params.id))
  if (!certificate) return res.status(404).json({ message: '문서를 찾을 수 없습니다.' })
  const issuedAt = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })
  const filename = `sejong-certificate-${certificate.id}.html`
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
  res.type('html').send(`<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>${escapeHtml(certificate.title)}</title><style>
body{margin:0;background:#eef3f6;color:#102d4d;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.sheet{position:relative;width:min(760px,calc(100% - 48px));margin:48px auto;padding:64px;border:10px double #174266;background:#fff;box-shadow:0 16px 50px #17344d24}.mark{color:#13878b;font-size:18px;font-weight:800;letter-spacing:.12em}.sheet h1{margin:28px 0 42px;text-align:center;font-size:38px;letter-spacing:.12em}.grid{display:grid;grid-template-columns:150px 1fr;border-top:2px solid #174266}.grid>*{padding:16px;border-bottom:1px solid #cad8e2}.grid strong{background:#f0f6f8}.status{color:${certificate.status === '승인 완료' ? '#087f79' : '#c54136'};font-weight:900}.notice{margin-top:32px;padding:18px;border-left:5px solid #c54136;background:#fff2ef;color:#82362f}.footer{margin-top:45px;text-align:center}.footer b{display:block;margin-top:12px;font-size:24px}.watermark{position:absolute;right:35px;bottom:25px;color:#dbe6ec;font-size:54px;font-weight:900;transform:rotate(-12deg)}</style></head>
<body><main class="sheet"><div class="mark">SEJONG NURI DIGITAL CERTIFICATE</div><h1>전자 증명서</h1><div class="grid"><strong>문서번호</strong><span>SN-CERT-${certificate.id}-2026</span><strong>문서명</strong><span>${escapeHtml(certificate.title)}</span><strong>신청인</strong><span>${escapeHtml(certificate.owner_name)} (${escapeHtml(certificate.owner_username)})</span><strong>처리상태</strong><span class="status">${escapeHtml(certificate.status)}</span><strong>발급시각</strong><span>${escapeHtml(issuedAt)}</span></div>${certificate.status !== '승인 완료' ? '<div class="notice"><strong>검증 경고</strong><br>승인되지 않은 신청 건이지만 발급 API가 문서를 생성했습니다. 이 문서는 교육용입니다.</div>' : ''}<div class="footer">위 내용을 세종누리 시민지원 통합포털에서 발급합니다.<b>세종누리 시민지원센터</b></div><div class="watermark">TRAINING</div></main></body></html>`)
})

if (existsSync(webRoot)) {
  app.use(express.static(webRoot, { index: false }))
  app.use((req, res, next) => {
    if ((req.method === 'GET' || req.method === 'HEAD') && req.accepts('html') && !req.path.startsWith('/api/')) {
      return res.sendFile(resolve(webRoot, 'index.html'))
    }
    next()
  })
}

app.use((error, req, res, _next) => {
  console.error(`[${req.method} ${req.path}]`, error)
  res.status(500).json({ message: '실습 요청을 처리하지 못했습니다.' })
})

app.listen(port, host, () => {
  console.log(`세종누리 통합 실습 API: http://${host}:${port}`)
  console.log('경고: 의도적 취약점을 포함하므로 외부 네트워크에 공개하지 마세요.')
})
