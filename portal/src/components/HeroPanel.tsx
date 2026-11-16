import { ArrowRight, ClipboardList, FileDown, FilePenLine, ScanFace, Search } from 'lucide-react'
import { FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

const quickServices = [
  { label: '민원 신청', detail: '생활 민원을 온라인으로 신청', icon: FilePenLine, to: '/apply' },
  { label: '나의 민원 조회', detail: '신청 내역과 처리 상태 확인', icon: ClipboardList, to: '/complaints' },
  { label: '결과문서 발급', detail: '처리 완료 문서 확인 및 발급', icon: FileDown, to: '/certificates' },
  { label: '본인 확인', detail: '계정 확인과 인증 절차', icon: ScanFace, to: '/identity' },
]

export function HeroPanel() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    navigate(`/services?q=${encodeURIComponent(query.trim())}`)
  }

  return (
    <section aria-label="주요 민원 서비스" className="portal-home-lead">
      <div className="portal-hero">
        <div className="portal-hero__inner">
          <h1>필요한 시민 서비스를<span> 찾으세요</span></h1>
          <p>민원 신청부터 생활지원, 처리결과 확인까지 세종누리에서 한 번에 이용할 수 있습니다.</p>
          <form className="portal-search" role="search" onSubmit={search}>
            <label htmlFor="service-search" className="sr-only">민원 및 서비스 검색</label>
            <input id="service-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="서비스명 또는 민원명을 입력해 주세요" />
            <button type="submit" aria-label="서비스 검색"><Search size={25} /></button>
          </form>
        </div>
      </div>
      <div className="portal-shortcuts" aria-label="주요 서비스 바로가기">
        {quickServices.map(({ label, detail, icon: Icon, to }) => <Link key={label} to={to}>
          <Icon size={30} strokeWidth={1.7} aria-hidden="true" />
          <strong>{label}</strong><small>{detail}</small>
          <ArrowRight className="portal-shortcuts__arrow" size={15} aria-hidden="true" />
        </Link>)}
      </div>
    </section>
  )
}
