import { FormEvent, useEffect, useState } from 'react'
import { Link, Navigate, useLocation, useSearchParams } from 'react-router-dom'
import { ArrowRight, Bell, ClipboardCheck, Download, FileText, Link2, MessageSquareText, Paperclip, ShieldCheck, UserRound, Wifi } from 'lucide-react'
import { apiRequest } from '../api'
import { useCitizen } from '../App'
import { formatPortalTime } from '../time'

type Section = 'account' | 'complaints' | 'board' | 'documents' | 'attachments' | 'certificates' | 'settings' | 'identity' | 'status'
type Application = { id: number; displayId: string; display_id?: string; category: string; title: string; detail?: string; status: string; owner_username?: string; applicant_name?: string; applicant_phone?: string; applicant_email?: string; applicant_address?: string; createdAt?: string }
type Post = { id: number; author: string; content: string; created_at: string }
type Certificate = { id: number; title: string; status: string }

const pageInfo: Record<Section, { eyebrow: string; title: string; description: string }> = {
  account: { eyebrow: '마이페이지', title: '내 정보', description: '내 계정과 이용 중인 시민 서비스를 확인합니다.' },
  complaints: { eyebrow: '민원서비스', title: '나의 민원', description: '신청한 민원과 처리 내용을 조회합니다.' },
  board: { eyebrow: '시민참여', title: '시민 의견 게시판', description: '생활 속 불편과 제안을 시민들과 공유합니다.' },
  documents: { eyebrow: '문서·자료실', title: '공개 자료실', description: '시민 서비스 안내 문서를 내려받거나 관련 링크를 확인합니다.' },
  attachments: { eyebrow: '민원서비스', title: '증빙자료 첨부', description: '신청에 필요한 사진과 증빙자료를 등록합니다.' },
  certificates: { eyebrow: '문서·자료실', title: '결과문서 발급', description: '신청 내역에 대한 확인서를 조회하고 발급합니다.' },
  settings: { eyebrow: '마이페이지', title: '알림 설정', description: '민원 처리 소식을 받을 방법을 설정합니다.' },
  identity: { eyebrow: '마이페이지', title: '본인 확인', description: '중요 서비스 이용 전에 계정을 확인합니다.' },
  status: { eyebrow: '이용안내', title: '서비스 이용 상태', description: '세종누리 서비스 연결 상태를 확인합니다.' },
}

const links = [
  { label: '새 민원 신청', to: '/apply', icon: FileText },
  { label: '나의 민원', to: '/complaints', icon: ClipboardCheck },
  { label: '시민 의견', to: '/board', icon: MessageSquareText },
  { label: '증빙자료 첨부', to: '/attachments', icon: Paperclip },
  { label: '공개 자료실', to: '/documents', icon: Download },
  { label: '결과문서 발급', to: '/certificates', icon: FileText },
  { label: '알림 설정', to: '/settings', icon: Bell },
  { label: '본인 확인', to: '/identity', icon: ShieldCheck },
  { label: '연결 상태', to: '/status', icon: Wifi },
]

export function CivicServicePage({ section }: { section: Section }) {
  const { user } = useCitizen()
  const route = useLocation()
  const [searchParams] = useSearchParams()
  const selectedReceipt = searchParams.get('receiptNo') || ''
  const [applications, setApplications] = useState<Application[]>([])
  const [posts, setPosts] = useState<Post[]>([])
  const [certificates, setCertificates] = useState<Certificate[]>([])
  const [emailEnabled, setEmailEnabled] = useState(true)
  const [identityStatus, setIdentityStatus] = useState<{ verified: boolean; verifiedAt: string | null }>({ verified: false, verifiedAt: null })
  const [uploadUrl, setUploadUrl] = useState('')
  const [result, setResult] = useState('')
  const [detail, setDetail] = useState<Application | null>(null)
  const [serviceStatus, setServiceStatus] = useState<{ available: boolean | null; checkedAt: string | null; loading: boolean }>({ available: null, checkedAt: null, loading: false })
  const info = pageInfo[section]

  useEffect(() => {
    setResult('')
    setDetail(null)
    if (section === 'complaints' && user) {
      apiRequest<{ applications: Application[] }>('/api/applications').then((data) => setApplications(data.applications)).catch(() => setResult('신청 내역을 불러오지 못했습니다.'))
      if (selectedReceipt) {
        apiRequest<{ application: Application }>(`/api/applications?receiptNo=${encodeURIComponent(selectedReceipt)}`).then((data) => setDetail(data.application)).catch((reason) => setResult(reason instanceof Error ? reason.message : '민원을 조회하지 못했습니다.'))
      }
    }
    if (section === 'board') apiRequest<{ posts: Post[] }>('/api/board/posts').then((data) => setPosts(data.posts)).catch(() => setResult('시민 의견을 불러오지 못했습니다.'))
    if (section === 'certificates' && user) apiRequest<{ certificates: Certificate[] }>('/api/certificates').then((data) => setCertificates(data.certificates)).catch(() => setResult('발급 신청 내역을 불러오지 못했습니다.'))
    if (section === 'settings' && user) apiRequest<{ emailEnabled: boolean }>('/api/citizens/preferences').then((data) => setEmailEnabled(data.emailEnabled)).catch(() => setResult('알림 설정을 불러오지 못했습니다.'))
    if (section === 'identity' && user) apiRequest<{ verified: boolean; verifiedAt: string | null }>('/api/citizens/identity/status').then(setIdentityStatus).catch(() => setResult('본인 확인 상태를 불러오지 못했습니다.'))
  }, [section, user, selectedReceipt])

  useEffect(() => {
    if (section !== 'status' || !user) return
    let active = true
    async function refreshStatus() {
      setServiceStatus((current) => ({ ...current, loading: true }))
      try {
        const data = await apiRequest<{ serviceAvailable: boolean }>('/api/service/status/check?target=portal.internal')
        if (active) setServiceStatus({ available: data.serviceAvailable, checkedAt: new Date().toISOString(), loading: false })
      } catch {
        if (active) setServiceStatus({ available: null, checkedAt: new Date().toISOString(), loading: false })
      }
    }
    refreshStatus()
    const timer = window.setInterval(refreshStatus, 30000)
    return () => { active = false; window.clearInterval(timer) }
  }, [section, user])

  async function refreshServiceStatus() {
    setServiceStatus((current) => ({ ...current, loading: true }))
    try {
      const data = await apiRequest<{ serviceAvailable: boolean }>('/api/service/status/check?target=portal.internal')
      setServiceStatus({ available: data.serviceAvailable, checkedAt: new Date().toISOString(), loading: false })
    } catch {
      setServiceStatus({ available: null, checkedAt: new Date().toISOString(), loading: false })
    }
  }

  async function findApplication(receiptNo: string) {
    setDetail(null)
    setResult('')
    try {
      const data = await apiRequest<{ application: Application }>(`/api/applications?receiptNo=${encodeURIComponent(receiptNo.trim())}`)
      setDetail(data.application)
    } catch (reason) { setResult(reason instanceof Error ? reason.message : '민원을 조회하지 못했습니다.') }
  }

  async function request(path: string, init?: RequestInit) {
    setResult('')
    try {
      const value = await apiRequest<unknown>(path, init)
      let message = typeof value === 'string' ? value : '요청이 완료되었습니다.'
      if (value && typeof value === 'object') {
        const data = value as Record<string, unknown>
        if (typeof data.message === 'string') message = data.message
        else if (typeof data.output === 'string') message = data.output
        else if (typeof data.body === 'string') message = data.body
        else if (typeof data.originalName === 'string') message = `${data.originalName} 파일이 등록되었습니다.`
        else if (typeof data.emailEnabled === 'boolean') message = `이메일 알림이 ${data.emailEnabled ? '켜졌습니다.' : '꺼졌습니다.'}`
        else if (typeof data.verified === 'boolean') message = data.verified ? '본인 확인이 완료되었습니다.' : '본인 확인에 실패했습니다.'
        else if (typeof data.id === 'number') message = '의견이 등록되었습니다.'
      }
      setResult(message)
      return value
    } catch (reason) { setResult(reason instanceof Error ? reason.message : '요청을 처리하지 못했습니다.'); return null }
  }

  function field(event: FormEvent<HTMLFormElement>, name: string) { return String(new FormData(event.currentTarget).get(name) || '') }

  if (!user && section !== 'board' && section !== 'status') return <Navigate to={`/login?next=${encodeURIComponent(route.pathname + route.search)}`} replace />

  return <div className="site-shell civic-inner-page">
    <div className="civic-page-heading"><p>{info.eyebrow}</p><h1>{info.title}</h1><span>{info.description}</span></div>
    <div className="civic-layout">
      <nav className="civic-side-nav" aria-label="서비스 메뉴">
        <strong>시민 서비스</strong>
        {links.map(({ label, to, icon: Icon }) => <Link className={route.pathname === to ? 'active' : ''} key={to} to={to}><Icon size={18} /><span>{label}</span><ArrowRight size={15} /></Link>)}
      </nav>
      <section className="civic-content" aria-label={`${info.title} 업무 내용`}>
        {section === 'account' && <>
          <div className="civic-card civic-profile"><UserRound size={31} /><div><h2>{user?.displayName}님, 안녕하세요.</h2><p>아이디 {user?.username} · 담당 {user?.department}</p></div></div>
          {user?.role === 'staff' && <div className="civic-card"><h2>운영 담당자 메모</h2><p>{user.trainingNote}</p><Link to="/admin">포털 관리로 이동 <ArrowRight size={16} /></Link></div>}
          <div className="civic-action-grid">{links.slice(0, 8).map(({ to, label, icon: Icon }) => <Link key={to} to={to}><Icon size={22} /><strong>{label}</strong><ArrowRight size={17} /></Link>)}</div>
        </>}

        {section === 'complaints' && <>
          <div className="civic-card"><h2>접수번호로 민원 조회</h2><p>접수 시 안내받은 번호를 입력하면 처리 내용을 확인할 수 있습니다.</p><form className="civic-form civic-inline-form" onSubmit={(event) => { event.preventDefault(); findApplication(field(event, 'receiptNo')) }}><label>민원 접수번호<input name="receiptNo" placeholder="예: APP-1001" required /></label><button>조회하기 <ArrowRight size={16} /></button></form></div>
          <div className="civic-card"><div className="civic-card-heading"><div><h2>신청 내역</h2><p>제목을 선택하면 접수 내용을 확인할 수 있습니다.</p></div><Link className="civic-primary-link" to="/apply">새 민원 신청 <ArrowRight size={16} /></Link></div>
            <div className="civic-list">{applications.map((item) => <button key={item.id} onClick={() => findApplication(item.displayId)}><span className="civic-list__id">{item.displayId}</span><strong>{item.title}</strong><span className="civic-list__status">{item.status}</span><ArrowRight size={17} /></button>)}</div>
            {applications.length === 0 && <p>등록된 민원이 없습니다.</p>}
          </div>
          {detail && <div className="civic-card"><h2>{detail.title}</h2><p>신청번호 {detail.display_id || detail.displayId} · 처리상태 {detail.status}</p><div className="civic-detail">{detail.detail}</div><dl className="civic-applicant-info"><div><dt>신청인</dt><dd>{detail.applicant_name}</dd></div><div><dt>연락처</dt><dd>{detail.applicant_phone}</dd></div><div><dt>이메일</dt><dd>{detail.applicant_email}</dd></div><div><dt>주소</dt><dd>{detail.applicant_address}</dd></div></dl><small>계정 {detail.owner_username}</small></div>}
        </>}

        {section === 'board' && <>
          <div className="civic-card"><h2>새 의견 등록</h2><p>생활 속 불편한 점이나 개선 제안을 남겨주세요.</p>
            {user ? <form className="civic-form" onSubmit={async (event) => { event.preventDefault(); const form = event.currentTarget; const content = field(event, 'content'); const created = await request('/api/board/posts', { method: 'POST', body: JSON.stringify({ content }) }); if (created) { form.reset(); const data = await apiRequest<{ posts: Post[] }>('/api/board/posts'); setPosts(data.posts) } }}><label>의견 내용<textarea name="content" rows={4} required placeholder="의견을 입력하세요" /></label><button>의견 등록 <ArrowRight size={17} /></button></form> : <Link className="civic-primary-link" to="/login">로그인하고 의견 등록</Link>}
          </div>
          <div className="civic-card"><h2>시민 의견</h2><div className="civic-posts">{posts.map((post) => <article key={post.id}><div><strong>{post.author}</strong><time>{formatPortalTime(post.created_at)}</time></div><div className="civic-post-body" dangerouslySetInnerHTML={{ __html: post.content }} /></article>)}{posts.length === 0 && <p>첫 의견을 남겨주세요.</p>}</div></div>
        </>}

        {section === 'documents' && <>
          <div className="civic-card"><h2>공개 안내자료</h2><p>제공 중인 시민 서비스 안내자료를 확인하세요.</p><div className="document-row"><FileText size={22} /><span><strong>세종누리 자료실 이용 안내</strong><small>일반 시민 대상 · TXT</small></span><button type="button" onClick={() => request('/api/documents/download?file=guide.txt')}>내용 미리보기 <Download size={16} /></button></div></div>
          <div className="civic-card"><h2>관련 링크 미리보기</h2><p>관련 안내 페이지의 내용을 열기 전에 확인합니다.</p><form className="civic-form civic-inline-form" onSubmit={(event) => { event.preventDefault(); request(`/api/documents/preview?url=${encodeURIComponent(field(event, 'url'))}`) }}><label>페이지 주소<input name="url" type="url" defaultValue="http://guide.sejongnuri.internal/info" required /></label><button><Link2 size={16} /> 미리보기</button></form></div>
        </>}

        {section === 'attachments' && <div className="civic-card"><h2>증빙자료 등록</h2><p>민원 접수에 필요한 자료를 첨부해 주세요. 파일당 최대 2 MB입니다.</p><form className="civic-form" onSubmit={async (event) => { event.preventDefault(); const data = await request('/api/attachments', { method: 'POST', body: new FormData(event.currentTarget) }) as { publicUrl?: string } | null; if (data?.publicUrl) setUploadUrl(data.publicUrl) }}><label>파일 선택<input name="attachment" type="file" required /></label><button><Paperclip size={16} /> 파일 등록</button></form>{uploadUrl && <a className="civic-primary-link" href={uploadUrl} target="_blank" rel="noreferrer">등록한 파일 보기 <ArrowRight size={16} /></a>}</div>}

        {section === 'certificates' && <div className="civic-card"><h2>발급 신청 내역</h2><p>승인이 완료된 문서만 전자증명서로 발급할 수 있습니다.</p><div className="certificate-list">{certificates.map((item) => <article key={item.id} className="certificate-item"><div className="certificate-item__head"><span className="civic-list__id">문서번호 {item.id}</span><span className={`certificate-status ${item.status === '승인 완료' ? 'certificate-status--approved' : ''}`}>{item.status}</span></div><h3>{item.title}</h3><div className="certificate-progress" aria-label={`처리 상태 ${item.status}`}><span className="is-done">접수</span><span className={item.status !== '승인 대기' ? 'is-done' : ''}>검토</span><span className={item.status === '승인 완료' ? 'is-done' : ''}>승인</span></div>{item.status === '승인 완료' ? <a className="certificate-download" href={`/api/certificates/${item.id}/download`} download><Download size={17} /> 전자증명서 발급</a> : <button className="certificate-download" type="button" disabled><Download size={17} /> 승인 후 발급 가능</button>}</article>)}</div></div>}

        {section === 'settings' && <div className="civic-card"><h2>처리 알림</h2><p>민원 접수와 처리 결과를 이메일로 받아보세요.</p><div className="setting-row"><Bell size={23} /><span><strong>이메일 알림</strong><small>접수·처리 단계가 변경될 때 알림</small></span><button onClick={async () => { const data = await request(`/api/citizens/preferences/email?enabled=${!emailEnabled}`) as { emailEnabled: boolean } | null; if (data) setEmailEnabled(data.emailEnabled) }}>{emailEnabled ? '사용 중' : '사용 안 함'}</button></div></div>}

        {section === 'identity' && <div className="civic-card">
          <h2>휴대전화 본인 확인</h2>
          <p>등록된 휴대전화로 무작위 8자리 인증번호를 전송했습니다. 3분 안에 입력해 주세요.</p>
          <div className={`identity-state ${identityStatus.verified ? 'identity-state--verified' : ''}`}><ShieldCheck size={20} /><span><strong>{identityStatus.verified ? '본인 확인 완료' : '본인 확인 전'}</strong><small>{identityStatus.verified ? `확인 일시 ${formatPortalTime(identityStatus.verifiedAt)}` : '인증번호 확인 후 일부 서비스를 이용할 수 있습니다.'}</small></span></div>
          <div className="identity-delivery"><span>전송 대상</span><strong>010-****-2026</strong><small>인증번호는 화면에 표시되지 않습니다.</small></div>
          <form className="civic-form" onSubmit={async (event) => { event.preventDefault(); const data = await request('/api/citizens/identity/complete', { method: 'POST', body: JSON.stringify({ verificationStep: 'verify', code: field(event, 'code') }) }) as { verified?: boolean } | null; if (data?.verified) setIdentityStatus({ verified: true, verifiedAt: new Date().toISOString() }) }}><label>인증번호<input name="code" inputMode="numeric" pattern="[0-9]{8}" maxLength={8} placeholder="8자리 인증번호" required /></label><button><ShieldCheck size={16} /> 본인 확인</button></form>
        </div>}

        {section === 'status' && <div className="civic-card"><h2>서비스 연결 상태</h2><p>세종누리 주요 서비스의 현재 운영 상태입니다.</p>{user ? <div className="service-health"><div className={`service-health__summary ${serviceStatus.available === false ? 'is-down' : ''}`}><span className="service-health__icon"><Wifi size={24} /></span><span><small>세종누리 시민지원 통합포털</small><strong>{serviceStatus.loading ? '상태 확인 중' : serviceStatus.available === true ? '정상 운영 중' : serviceStatus.available === false ? '서비스 점검 중' : '상태 확인 지연'}</strong></span><i aria-hidden="true" /></div><div className="service-health__footer"><span>{serviceStatus.checkedAt ? `마지막 확인 ${formatPortalTime(serviceStatus.checkedAt)}` : '상태 정보를 불러오는 중입니다.'}<small>상태 정보는 30초마다 자동으로 갱신됩니다.</small></span><button type="button" onClick={refreshServiceStatus} disabled={serviceStatus.loading}>새로고침</button></div></div> : <Link className="civic-primary-link" to="/login">로그인하고 연결 상태 보기</Link>}</div>}

        {result && <div className="civic-result" role="status"><strong>처리 결과</strong><pre>{result}</pre></div>}
      </section>
    </div>
  </div>
}
