import { FormEvent, useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { ArrowRight, Bell, ClipboardList, FileText, MessageSquareText, Users } from 'lucide-react'
import { apiRequest } from '../api'
import { useCitizen } from '../App'
import { formatPortalTime } from '../time'

type Application = { id: number; displayId: string; ownerName: string; category: string; title: string; status: string; createdAt: string }
type Post = { id: number; author: string; content: string; createdAt: string }
type Notice = { id: number; kind: string; title: string; publishedAt: string }
type Account = { username: string; displayName: string; department: string; role: string }
type Overview = {
  counts: { citizens: number; applications: number; pending: number; posts: number }
  applications: Application[]
  posts: Post[]
  notices: Notice[]
  accounts: Account[]
}
type Tab = '현황' | '민원 처리' | '시민 의견' | '공지 관리' | '계정 조회'
const tabs: Tab[] = ['현황', '민원 처리', '시민 의견', '공지 관리', '계정 조회']

export function PortalAdminPage() {
  const { user } = useCitizen()
  const [tab, setTab] = useState<Tab>('현황')
  const [overview, setOverview] = useState<Overview | null>(null)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  async function reload() {
    try { setOverview(await apiRequest<Overview>('/api/admin/overview')); setError('') }
    catch (reason) { setError(reason instanceof Error ? reason.message : '관리 정보를 불러오지 못했습니다.') }
  }

  useEffect(() => { if (user?.role === 'staff') reload() }, [user])

  async function changeStatus(id: number, status: string) {
    try {
      await apiRequest('/api/admin/applications/' + id + '/status', { method: 'PATCH', body: JSON.stringify({ status }) })
      setMessage('민원 처리 상태를 저장했습니다.')
      await reload()
    } catch (reason) { setError(reason instanceof Error ? reason.message : '상태를 저장하지 못했습니다.') }
  }

  async function createNotice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const data = new FormData(form)
    try {
      await apiRequest('/api/admin/notices', { method: 'POST', body: JSON.stringify({ title: data.get('title'), body: data.get('body'), kind: data.get('kind') }) })
      form.reset()
      setMessage('공지를 등록했습니다.')
      await reload()
    } catch (reason) { setError(reason instanceof Error ? reason.message : '공지를 등록하지 못했습니다.') }
  }

  async function deletePost(id: number) {
    if (!window.confirm('이 의견을 삭제하시겠습니까?')) return
    try {
      await apiRequest('/api/admin/board/posts/' + id, { method: 'DELETE' })
      setMessage('게시글을 삭제했습니다.')
      await reload()
    } catch (reason) { setError(reason instanceof Error ? reason.message : '게시글을 삭제하지 못했습니다.') }
  }

  if (!user) return <Navigate to="/login?next=%2Fadmin" replace />
  if (user.role !== 'staff') return <Navigate to="/account" replace />

  return <div className="site-shell portal-admin-page">
    <div className="portal-admin-heading"><div><p>세종누리 포털 관리</p><h1>시민 서비스 관리자</h1><span>민원 처리와 시민 의견, 공지와 계정 현황을 관리합니다.</span></div><Link to="/">시민포털 보기 <ArrowRight size={17} /></Link></div>
    <div className="portal-admin-layout">
      <nav className="portal-admin-nav" aria-label="포털 관리자 메뉴"><strong>관리 메뉴</strong>{tabs.map((item) => <button className={tab === item ? 'active' : ''} key={item} type="button" onClick={() => { setTab(item); setMessage('') }}>{item}</button>)}</nav>
      <div className="portal-admin-content">
        {error && <div className="civic-error" role="alert">{error}</div>}
        {message && <div className="portal-admin-message" role="status">{message}</div>}
        {!overview && !error && <div className="portal-admin-card" role="status">관리 데이터를 불러오고 있습니다.</div>}

        {overview && tab === '현황' && <>
          <div className="portal-admin-stats">
            <div><Users size={24} /><span>시민 계정</span><strong>{overview.counts.citizens}</strong></div>
            <div><ClipboardList size={24} /><span>전체 민원</span><strong>{overview.counts.applications}</strong></div>
            <div><FileText size={24} /><span>처리할 민원</span><strong>{overview.counts.pending}</strong></div>
            <div><MessageSquareText size={24} /><span>시민 의견</span><strong>{overview.counts.posts}</strong></div>
          </div>
          <section className="portal-admin-card"><div className="portal-admin-card-head"><h2>최근 민원</h2><button onClick={() => setTab('민원 처리')}>전체 보기 <ArrowRight size={16} /></button></div><div className="portal-admin-list">{overview.applications.slice(0, 5).map((item) => <div key={item.id}><span>{item.displayId}</span><strong>{item.title}</strong><small>{item.ownerName}</small><b>{item.status}</b></div>)}</div></section>
          <section className="portal-admin-card"><div className="portal-admin-card-head"><h2>최근 공지</h2><button onClick={() => setTab('공지 관리')}>공지 관리 <ArrowRight size={16} /></button></div><div className="portal-admin-list">{overview.notices.slice(0, 3).map((item) => <div key={item.id}><Bell size={16} /><strong>{item.title}</strong><small>{item.publishedAt}</small></div>)}</div></section>
        </>}

          {overview && tab === '민원 처리' && <section className="portal-admin-card"><h2>민원 처리</h2><p>접수된 민원의 진행 상태를 관리합니다.</p><div className="portal-admin-table"><div className="portal-admin-table-head"><span>접수번호</span><span>민원 내용</span><span>신청자</span><span>처리 상태</span></div>{overview.applications.map((item) => <div className="portal-admin-table-row" key={item.id}><span>{item.displayId}</span><strong>{item.title}<small>{item.category} · {formatPortalTime(item.createdAt)}</small></strong><span>{item.ownerName}</span><select aria-label={item.displayId + ' 처리 상태'} value={item.status} onChange={(event) => changeStatus(item.id, event.target.value)}><option>접수 완료</option><option>처리 중</option><option>처리 완료</option></select></div>)}</div></section>}

        {overview && tab === '시민 의견' && <section className="portal-admin-card"><h2>시민 의견 관리</h2><p>게시판에 등록된 의견을 확인하고 관리합니다.</p><div className="portal-admin-posts">{overview.posts.map((item) => <article key={item.id}><div><strong>{item.author}</strong><small>{formatPortalTime(item.createdAt)}</small><button type="button" onClick={() => deletePost(item.id)}>삭제</button></div><p>{item.content}</p></article>)}{overview.posts.length === 0 && <p>등록된 의견이 없습니다.</p>}</div></section>}

        {overview && tab === '공지 관리' && <>
          <section className="portal-admin-card"><h2>새 공지 등록</h2><form className="portal-admin-form" onSubmit={createNotice}><label>공지 분류<select name="kind"><option value="normal">일반</option><option value="important">중요</option></select></label><label>공지 제목<input name="title" maxLength={120} required placeholder="공지 제목을 입력하세요" /></label><label>공지 내용<textarea name="body" rows={6} maxLength={3000} required placeholder="시민에게 안내할 내용을 입력하세요" /></label><button type="submit">공지 등록</button></form></section>
          <section className="portal-admin-card"><h2>등록된 공지</h2><div className="portal-admin-list">{overview.notices.map((item) => <div key={item.id}><span>{item.kind === 'important' ? '중요' : '일반'}</span><strong>{item.title}</strong><small>{item.publishedAt}</small></div>)}</div></section>
        </>}

        {overview && tab === '계정 조회' && <section className="portal-admin-card"><h2>포털 계정 현황</h2><p>시민과 직원의 포털 계정을 확인합니다.</p><div className="portal-admin-table"><div className="portal-admin-table-head"><span>아이디</span><span>이름</span><span>소속·담당</span><span>권한</span></div>{overview.accounts.map((item) => <div className="portal-admin-table-row" key={item.username}><span>{item.username}</span><strong>{item.displayName}</strong><span>{item.department}</span><span>{item.role === 'staff' ? '직원' : '시민'}</span></div>)}</div></section>}
      </div>
    </div>
  </div>
}
