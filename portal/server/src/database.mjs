import { mkdirSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DatabaseSync } from 'node:sqlite'

const here = dirname(fileURLToPath(import.meta.url))
export const serverRoot = resolve(here, '..')
const dbPath = process.env.TARGET_DB_PATH || resolve(serverRoot, 'data/target.sqlite')
mkdirSync(dirname(dbPath), { recursive: true })

export const db = new DatabaseSync(dbPath)
db.exec('PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;')

export function migrate() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS citizens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      department TEXT NOT NULL,
      training_note TEXT NOT NULL,
      phone TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL DEFAULT '',
      address TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS complaints (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      display_id TEXT NOT NULL UNIQUE,
      owner_username TEXT NOT NULL,
      title TEXT NOT NULL,
      status TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      department TEXT NOT NULL,
      progress INTEGER NOT NULL,
      private_note TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS notices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      kind TEXT NOT NULL,
      title TEXT NOT NULL,
      published_at TEXT NOT NULL,
      body TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS applications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      display_id TEXT NOT NULL UNIQUE,
      owner_username TEXT NOT NULL,
      category TEXT NOT NULL,
      title TEXT NOT NULL,
      detail TEXT NOT NULL,
      status TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS board_posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      author TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS preferences (
      username TEXT PRIMARY KEY,
      email_enabled INTEGER NOT NULL DEFAULT 1
    );
    CREATE TABLE IF NOT EXISTS identity_checks (
      username TEXT PRIMARY KEY,
      verified_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS certificates (
      id INTEGER PRIMARY KEY,
      owner_username TEXT NOT NULL,
      title TEXT NOT NULL,
      status TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS portal_accounts (
      username TEXT PRIMARY KEY,
      password TEXT NOT NULL,
      recovery_code TEXT NOT NULL DEFAULT '',
      role TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS portal_sessions (
      token TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS lab_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `)
  if (!db.prepare('PRAGMA table_info(notices)').all().some((column) => column.name === 'body')) {
    db.exec("ALTER TABLE notices ADD COLUMN body TEXT NOT NULL DEFAULT ''")
  }
  if (!db.prepare('PRAGMA table_info(applications)').all().some((column) => column.name === 'updated_at')) {
    db.exec('ALTER TABLE applications ADD COLUMN updated_at TEXT')
    db.exec('UPDATE applications SET updated_at = created_at WHERE updated_at IS NULL')
  }
  if (!db.prepare('PRAGMA table_info(portal_accounts)').all().some((column) => column.name === 'recovery_code')) {
    db.exec("ALTER TABLE portal_accounts ADD COLUMN recovery_code TEXT NOT NULL DEFAULT ''")
  }
  const citizenColumns = db.prepare('PRAGMA table_info(citizens)').all()
  if (!citizenColumns.some((column) => column.name === 'phone')) {
    db.exec("ALTER TABLE citizens ADD COLUMN phone TEXT NOT NULL DEFAULT ''")
  }
  if (!citizenColumns.some((column) => column.name === 'email')) {
    db.exec("ALTER TABLE citizens ADD COLUMN email TEXT NOT NULL DEFAULT ''")
  }
  if (!citizenColumns.some((column) => column.name === 'address')) {
    db.exec("ALTER TABLE citizens ADD COLUMN address TEXT NOT NULL DEFAULT ''")
  }
}

export function resetAndSeed() {
  migrate()
  db.exec(`
    DELETE FROM portal_sessions;
    DELETE FROM portal_accounts;
    DELETE FROM board_posts;
    DELETE FROM applications;
    DELETE FROM complaints;
    DELETE FROM notices;
    DELETE FROM citizens;
    DELETE FROM preferences;
    DELETE FROM identity_checks;
    DELETE FROM certificates;
    DELETE FROM lab_meta;
  `)

  const citizen = db.prepare(`INSERT INTO citizens
    (username, display_name, department, training_note, phone, email, address)
    VALUES (?, ?, ?, ?, ?, ?, ?)`)
  citizen.run('admin', '포털관리자', '정보운영팀', '민원 처리 현황과 시민 의견을 관리합니다.',
    '044-000-4026', 'admin@sejongnuri.example.invalid', '세종누리 시민지원센터 정보운영팀')
  citizen.run('hangaram', '한가람', '시민생활지원과', '일반 시민 계정',
    '010-1111-2026', 'hangaram@example.invalid', '세종시 한솔동 누리마을 2단지 202동')
  citizen.run('dajeong', '김다정', '복지서비스과', '일반 시민 계정',
    '010-0000-2026', 'dajeong@example.invalid', '세종시 다정동 가온마을 7단지 704동')

  const account = db.prepare('INSERT INTO portal_accounts (username, password, recovery_code, role) VALUES (?, ?, ?, ?)')
  account.run('admin', 'admin', 'NURI-7342', 'staff')
  account.run('hangaram', 'hangaram', 'HANG-2601', 'citizen')
  account.run('dajeong', 'dajeong', 'DAJE-8419', 'citizen')

  const complaint = db.prepare(`
    INSERT INTO complaints (display_id, owner_username, title, status, updated_at, department, progress, private_note)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `)
  complaint.run('SN-2026-1108', 'hangaram', '주거환경 개선 지원 신청', '처리 중', '2026-11-10 14:27', '시민생활지원과', 64, '신청자 본인 확인 완료')
  complaint.run('SN-2026-1103', 'hangaram', '생활지원 바우처 신청', '접수 완료', '2026-11-08 09:41', '복지서비스과', 28, '소득 증빙 서류 검토 대기')
  complaint.run('SN-2026-1097', 'dajeong', '임시주거 지원 신청', '처리 중', '2026-11-07 16:10', '주거복지과', 72, '신청인 연락처: 010-0000-2026')

  const notice = db.prepare('INSERT INTO notices (kind, title, published_at, body) VALUES (?, ?, ?, ?)')
  notice.run('important', '세종누리 시민지원 통합포털 서비스 이용 안내', '2026-11-11', '세종누리 시민지원 통합포털에서 민원 신청, 처리현황 조회, 결과문서 발급 및 시민 의견 서비스를 이용하실 수 있습니다.\n서비스 이용 전 로그인 상태와 본인 확인 정보를 확인해 주세요.')
  notice.run('normal', '민원서비스 일부 기능 점검 안내 (11.18. 20:00 ~ 22:00)', '2026-11-10', '서비스 품질 향상을 위한 정기 점검을 진행합니다.\n점검 시간: 2026년 11월 18일 20:00~22:00\n점검 중 일부 민원 신청 및 조회 기능이 일시적으로 지연될 수 있습니다.')
  notice.run('normal', '생활지원 신규 지원사업 신청 안내', '2026-11-07', '생활지원 분야의 신규 지원사업 신청을 안내합니다.\n신청을 원하시는 시민께서는 민원서비스 메뉴에서 신청 내용을 작성하고 필요한 증빙자료를 첨부해 주세요.')

  const application = db.prepare(`
    INSERT INTO applications (id, display_id, owner_username, category, title, detail, status) VALUES (?, ?, ?, ?, ?, ?, ?)
  `)
  application.run(1, 'APP-1000', 'dajeong', '생활·복지', '비공개 긴급생계 상담', '신청인 김다정. 연락처 010-0000-2026. 최근 실직으로 긴급 생계비와 방문 상담을 요청합니다.', '처리 중')
  application.run(2, 'APP-1001', 'hangaram', '주거·환경', '새롬동 공원 조명 수리 요청', '새롬동 중앙공원 산책로 3번 조명이 일주일째 켜지지 않습니다.', '접수 완료')
  application.run(3, 'APP-1002', 'dajeong', '교통·시설', '버스 승강장 전광판 장애', '다정동 104동 앞 승강장 전광판이 검은 화면으로 표시됩니다.', '접수 완료')
  application.run(4, 'APP-1003', 'dajeong', '주거·환경', '공동주택 누수 점검 지원', '다정동 가온마을 7단지 거주. 작은방 천장 누수로 현장 점검을 요청합니다.', '처리 중')
  application.run(5, 'APP-1004', 'hangaram', '교통·시설', '보행로 턱 파손 신고', '보람동 주민센터 동문 앞 보도블록이 들려 있어 보행 시 위험합니다.', '처리 완료')
  application.run(6, 'APP-1005', 'dajeong', '생활·복지', '돌봄서비스 방문 일정 변경', '신청인 가족 일정으로 11월 21일 방문을 11월 24일 오후로 변경 요청합니다.', '접수 완료')
  application.run(7, 'APP-1006', 'hangaram', '생활·복지', '청년 주거상담 예약', '전월세 계약 갱신과 보증금 지원제도 상담을 희망합니다.', '처리 중')
  application.run(8, 'APP-1007', 'dajeong', '교통·시설', '어린이보호구역 표지판 훼손', '한솔초등학교 후문 표지판이 기울어져 글자가 잘 보이지 않습니다.', '처리 완료')
  application.run(9, 'APP-1008', 'hangaram', '주거·환경', '재활용 수거 일정 문의', '나성동 상가 밀집구역의 투명 페트병 분리수거 요일을 문의합니다.', '접수 완료')
  application.run(10, 'APP-1009', 'dajeong', '생활·복지', '의료비 지원 서류 보완 문의', '가구원 확인서 보완 요청을 받았습니다. 제출 가능한 대체 서류를 문의합니다.', '처리 중')
  application.run(11, 'APP-1010', 'hangaram', '교통·시설', '공영자전거 거치대 추가 요청', '어진동 업무단지 남측 출입구에 거치 공간이 부족합니다.', '접수 완료')
  application.run(12, 'APP-1011', 'dajeong', '주거·환경', '야간 공사 소음 민원', '다정동 주상복합 공사장에서 밤 11시 이후 장비 소음이 반복됩니다.', '처리 중')
  application.run(13, 'APP-1012', 'hangaram', '생활·복지', '생활지원 바우처 사용처 문의', '바우처를 지역 서점과 체육시설에서 사용할 수 있는지 문의합니다.', '처리 완료')
  application.run(14, 'APP-1013', 'dajeong', '생활·복지', '가족돌봄 상담 기록 확인', '상담 대상자 김다정. 보호자 연락 가능 시간은 평일 18시 이후입니다. 상담 기록은 비공개로 요청합니다.', '접수 완료')

  db.prepare('INSERT INTO preferences (username, email_enabled) VALUES (?, ?)').run('hangaram', 1)
  db.prepare('INSERT INTO preferences (username, email_enabled) VALUES (?, ?)').run('dajeong', 1)
  db.prepare('INSERT INTO certificates (id, owner_username, title, status) VALUES (?, ?, ?, ?)').run(7001, 'hangaram', '주거환경 지원 확인서', '승인 대기')
  db.prepare('INSERT INTO certificates (id, owner_username, title, status) VALUES (?, ?, ?, ?)').run(7002, 'hangaram', '생활지원 신청 접수증', '승인 완료')
  db.prepare('INSERT INTO certificates (id, owner_username, title, status) VALUES (?, ?, ?, ?)').run(7003, 'hangaram', '청년 주거상담 참여확인서', '담당자 검토')
  db.prepare('INSERT INTO certificates (id, owner_username, title, status) VALUES (?, ?, ?, ?)').run(7101, 'dajeong', '긴급생활지원 상담확인서', '승인 완료')
  db.prepare('INSERT INTO lab_meta (key, value) VALUES (?, ?)').run('seed_version', '3')
}

export function ensureSeeded() {
  migrate()
  const row = db.prepare('SELECT COUNT(*) AS count FROM citizens').get()
  const seedVersion = db.prepare("SELECT value FROM lab_meta WHERE key = 'seed_version'").get()?.value
  if (Number(row.count) === 0 || seedVersion !== '3') {
    resetAndSeed()
    return
  }
  db.prepare('UPDATE notices SET title = ? WHERE title = ?').run('세종누리 시민지원 통합포털 서비스 이용 안내', '세종누리 시민지원 통합포털 보안교육용 가상서비스 이용 안내')
  const body = db.prepare('UPDATE notices SET body = ? WHERE title = ? AND body = ?')
  body.run('세종누리 시민지원 통합포털에서 민원 신청, 처리현황 조회, 결과문서 발급 및 시민 의견 서비스를 이용하실 수 있습니다.\n서비스 이용 전 로그인 상태와 본인 확인 정보를 확인해 주세요.', '세종누리 시민지원 통합포털 서비스 이용 안내', '')
  body.run('서비스 품질 향상을 위한 정기 점검을 진행합니다.\n점검 시간: 2026년 11월 18일 20:00~22:00\n점검 중 일부 민원 신청 및 조회 기능이 일시적으로 지연될 수 있습니다.', '민원서비스 일부 기능 점검 안내 (11.18. 20:00 ~ 22:00)', '')
  body.run('생활지원 분야의 신규 지원사업 신청을 안내합니다.\n신청을 원하시는 시민께서는 민원서비스 메뉴에서 신청 내용을 작성하고 필요한 증빙자료를 첨부해 주세요.', '생활지원 신규 지원사업 신청 안내', '')
}
