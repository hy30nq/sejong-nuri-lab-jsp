import { useEffect, useState } from 'react'
import { ArrowRight, BookOpenText, ClipboardList, FileDown, FilePenLine, MessageSquareText, Paperclip, ShieldCheck, Signal } from 'lucide-react'
import { Link } from 'react-router-dom'
import { apiRequest, PublicDashboard } from '../api'
import { useCitizen } from '../App'
import { ComplaintList } from '../components/ComplaintList'
import { HeroPanel } from '../components/HeroPanel'
import { NoticeList } from '../components/NoticeList'

const frequentServices = [
  { label: '생활 민원 신청', description: '생활 속 불편 사항과 지원 신청 접수', icon: FilePenLine, to: '/apply' },
  { label: '나의 민원 조회', description: '접수번호로 신청 내역과 처리 상태 확인', icon: ClipboardList, to: '/complaints' },
  { label: '증빙자료 첨부', description: '신청에 필요한 파일을 온라인으로 등록', icon: Paperclip, to: '/attachments' },
  { label: '결과문서 발급', description: '처리된 신청의 결과문서 확인', icon: FileDown, to: '/certificates' },
  { label: '공개 자료실', description: '서비스 안내문과 공개 자료 확인', icon: BookOpenText, to: '/documents' },
  { label: '시민 의견 게시판', description: '생활 개선 의견을 작성하고 살펴보기', icon: MessageSquareText, to: '/board' },
]

export function CitizenDashboard() {
  const { user } = useCitizen()
  const [dashboard, setDashboard] = useState<PublicDashboard | null>(null)
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    apiRequest<PublicDashboard>('/api/public/dashboard').then(setDashboard).catch(() => setLoadError(true))
  }, [])

  return (
    <div className="site-shell dashboard-page portal-home">
      <HeroPanel />
      <div className="portal-home-grid">
        <section className="portal-service-list" aria-labelledby="popular-title">
          <div className="portal-section-heading"><h2 id="popular-title">자주 찾는 서비스</h2><Link to="/services">전체 서비스 보기 <ArrowRight size={16} /></Link></div>
          <div className="portal-service-list__rows">
            {frequentServices.map(({ label, description, icon: Icon, to }) => <Link key={label} to={to}>
              <Icon size={21} strokeWidth={1.8} aria-hidden="true" />
              <strong>{label}</strong>
              <span>{description}</span>
              <ArrowRight size={16} aria-hidden="true" />
            </Link>)}
          </div>
        </section>
        <NoticeList notices={dashboard?.notices ?? []} loading={!dashboard && !loadError} error={loadError} />
      </div>
      {user?.role === 'citizen' && <div className="portal-home-my"><ComplaintList complaints={dashboard?.complaints ?? []} loading={!dashboard && !loadError} error={loadError} /></div>}
      {user?.role === 'staff' && <section className="staff-home-action"><div><h2>포털 업무 관리</h2><p>접수된 민원과 시민 의견, 공지사항을 관리할 수 있습니다.</p></div><Link to="/admin">관리자 화면 열기</Link></section>}
      <section className="portal-help-strip" aria-labelledby="help-title">
        <div className="portal-help-strip__intro"><h2 id="help-title">서비스 이용안내</h2><p>이용에 필요한 내용을 확인하세요.</p></div>
        <Link to="/services"><BookOpenText size={26} /><span><strong>민원서비스 이용방법</strong><small>신청부터 처리결과 확인까지</small></span><ArrowRight size={17} /></Link>
        <Link to="/identity"><ShieldCheck size={26} /><span><strong>본인 확인 안내</strong><small>계정 확인 절차 알아보기</small></span><ArrowRight size={17} /></Link>
        <Link to="/status"><Signal size={26} /><span><strong>서비스 연결 상태</strong><small>포털 이용 상태 확인</small></span><ArrowRight size={17} /></Link>
      </section>
    </div>
  )
}
