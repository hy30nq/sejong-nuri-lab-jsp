import { CircleAlert } from 'lucide-react'
import type { Notice } from '../api'
import { Link } from 'react-router-dom'

export function NoticeList({ notices, loading, error }: { notices: Notice[]; loading: boolean; error: boolean }) {
  return (
    <section className="content-section notice-section" aria-labelledby="notice-title">
      <div className="section-heading">
        <h2 id="notice-title">공지사항</h2>
        <Link className="notice-section__label" to="/notices">전체보기 →</Link>
      </div>
      <div className="portal-notice-columns" aria-hidden="true"><span>구분</span><span>제목</span><span>등록일</span></div>
      <div className="notice-list">
        {notices.map((notice) => (
          <Link to={`/notices/${notice.id}`} className={notice.kind === 'important' ? 'notice-row notice-row--important' : 'notice-row'} key={notice.id}>
            <span className={notice.kind === 'important' ? 'portal-notice-kind portal-notice-kind--important' : 'portal-notice-kind'}>{notice.kind === 'important' ? <><CircleAlert size={13} /> 중요</> : '일반'}</span>
            <span>{notice.title}</span>
            <time>{notice.date}</time>
          </Link>
        ))}
        {loading && <p className="complaint-empty" role="status">공지사항을 불러오는 중입니다.</p>}
        {error && <p className="complaint-empty" role="alert">공지사항을 불러오지 못했습니다.</p>}
        {!loading && !error && notices.length === 0 && <p className="complaint-empty">등록된 공지가 없습니다.</p>}
      </div>
    </section>
  )
}
