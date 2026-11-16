import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Bell } from 'lucide-react'
import { apiRequest, type Notice } from '../api'

type NoticeDetail = Notice & { body: string }

export function NoticesPage() {
  const { id } = useParams()
  const [notices, setNotices] = useState<Notice[]>([])
  const [detail, setDetail] = useState<NoticeDetail | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const controller = new AbortController()
    setError('')
    setLoading(true)
    setDetail(null)
    setNotices([])
    if (id) apiRequest<{ notice: NoticeDetail }>(`/api/public/notices/${encodeURIComponent(id)}`, { signal: controller.signal })
      .then((data) => setDetail(data.notice))
      .catch((reason) => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : '공지를 불러오지 못했습니다.') })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    else apiRequest<{ notices: Notice[] }>('/api/public/notices', { signal: controller.signal })
      .then((data) => setNotices(data.notices))
      .catch((reason) => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : '공지 목록을 불러오지 못했습니다.') })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [id])

  return <div className="site-shell notices-page">
    <div className="civic-page-heading"><p>세종누리 소식</p><h1>공지사항</h1><span>서비스 운영과 민원 이용에 필요한 소식을 알려드립니다.</span></div>
    {error && <div className="civic-error" role="alert">{error}</div>}
    {loading && <p className="complaint-empty" role="status">공지사항을 불러오는 중입니다.</p>}
    {id ? <>
      <Link className="notices-back" to="/notices"><ArrowLeft size={17} /> 목록으로 돌아가기</Link>
      {detail && <article className="notice-detail"><div className="notice-detail__head"><span>{detail.kind === 'important' ? '중요' : '일반'}</span><h2>{detail.title}</h2><time>{detail.date}</time></div><div className="notice-detail__body">{detail.body}</div></article>}
    </> : <div className="notice-directory"><div className="notice-directory__head"><span>구분</span><span>제목</span><span>등록일</span></div>{notices.map((notice) => <Link key={notice.id} to={`/notices/${notice.id}`}><span className={notice.kind === 'important' ? 'notice-kind notice-kind--important' : 'notice-kind'}>{notice.kind === 'important' ? '중요' : '일반'}</span><strong>{notice.title}</strong><time>{notice.date}</time><ArrowRight size={18} /></Link>)}{notices.length === 0 && !loading && !error && <p className="notice-directory__empty"><Bell size={20} /> 등록된 공지가 없습니다.</p>}</div>}
  </div>
}
