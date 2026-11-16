import { readdirSync, statSync, unlinkSync } from 'node:fs'
import { resolve } from 'node:path'
import { db, serverRoot } from './database.mjs'

const code = process.argv[2]
if (!/^S(0[1-9]|10)$/.test(code || '')) {
  console.error('올바른 시나리오 코드를 지정해 주세요.')
  process.exit(2)
}

db.exec('PRAGMA busy_timeout = 5000')
switch (code) {
  case 'S01':
    db.prepare("DELETE FROM portal_sessions WHERE username = 'admin'").run()
    break
  case 'S03':
    db.prepare("DELETE FROM identity_checks WHERE username = 'hangaram'").run()
    break
  case 'S06': {
    const uploadRoot = resolve(process.env.TARGET_UPLOAD_ROOT || resolve(serverRoot, 'uploads'))
    for (const name of readdirSync(uploadRoot)) {
      const path = resolve(uploadRoot, name)
      if (statSync(path).isFile()) unlinkSync(path)
    }
    break
  }
  case 'S08':
    db.prepare('DELETE FROM board_posts').run()
    break
  case 'S09':
    db.prepare("UPDATE preferences SET email_enabled = 1 WHERE username = 'hangaram'").run()
    break
  default:
    // Other scenarios change only request/response behavior and have no target state.
    break
}
console.log(`${code} 실습 상태 초기화 완료`)
