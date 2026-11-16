import { exec } from 'node:child_process'
import { existsSync, mkdirSync, unlinkSync, writeFileSync } from 'node:fs'
import http from 'node:http'
import { dirname, resolve } from 'node:path'

const socketPath = process.env.S02_SOCKET_PATH || '/run/s02/exec.sock'
const labRoot = '/lab'
const simulatedServerRoot = resolve(labRoot, 'simulated-server')
mkdirSync(resolve(labRoot, 'config'), { recursive: true })
writeFileSync(resolve(labRoot, 'config/service.txt'), '내부 서비스 점검 메모: portal.internal / 담당 정보운영팀\n', { mode: 0o600 })
mkdirSync(resolve(simulatedServerRoot, 'var/www/html'), { recursive: true })
mkdirSync(resolve(simulatedServerRoot, 'var/lib/sejong'), { recursive: true })
mkdirSync(resolve(simulatedServerRoot, 'etc'), { recursive: true })
writeFileSync(resolve(simulatedServerRoot, 'var/www/html/index.html'), '<h1>세종누리 시민지원 통합포털</h1>\n', { mode: 0o600 })
writeFileSync(resolve(simulatedServerRoot, 'etc/service.conf'), 'PORTAL_DB=citizen-db.internal:5432\nDOCUMENT_STORE=document-store.internal:9000\n', { mode: 0o600 })
writeFileSync(resolve(simulatedServerRoot, 'var/lib/sejong/citizens.csv'), [
  'TRAINING_FAKE_DATA - 실제 개인정보가 아닙니다.',
  'citizen_id,name,phone,email,address,case',
  'C-2026-001,김다정,010-0000-2026,dajeong@example.invalid,세종시 다정동 가온마을 7단지,긴급생계 상담',
  'C-2026-002,한가람,010-1111-2026,hangaram@example.invalid,세종시 한솔동 누리마을 2단지,주거환경 지원',
].join('\n') + '\n', { mode: 0o600 })
mkdirSync(dirname(socketPath), { recursive: true })
if (existsSync(socketPath)) unlinkSync(socketPath)

const server = http.createServer((req, res) => {
  if (req.method === 'GET' && req.url === '/health') {
    return res.writeHead(200, { 'Content-Type': 'application/json' }).end('{"ok":true}')
  }
  if (req.method !== 'POST' || req.url !== '/run') return res.writeHead(404).end()
  let body = ''
  req.on('data', (chunk) => {
    body += chunk
    if (body.length > 2048) req.destroy()
  })
  req.on('end', () => {
    let target
    try { target = JSON.parse(body).target } catch { return res.writeHead(400).end() }
    if (typeof target !== 'string' || target.length > 1024) return res.writeHead(400).end()
    exec(`printf 'checked: %s\n' ${target}`, {
      cwd: labRoot, timeout: 1000, maxBuffer: 16 * 1024, env: { PATH: '/usr/bin:/bin' },
    }, (error, stdout, stderr) => {
      res.writeHead(error ? 400 : 200, { 'Content-Type': 'application/json' })
        .end(JSON.stringify({
          output: `${stdout}${stderr}`.trim(),
          serviceAvailable: existsSync(simulatedServerRoot),
          isolatedTrainingContainer: true,
        }))
    })
  })
})
server.listen(socketPath)
