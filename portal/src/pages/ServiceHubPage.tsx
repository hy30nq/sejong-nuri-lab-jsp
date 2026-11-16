import { ArrowRight, FileCheck2, Search } from 'lucide-react'
import { FormEvent, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { serviceGroups } from '../data'

const destinations: Record<string, string> = {
  '새 민원 신청': '/apply', '나의 민원': '/complaints', '증빙자료 첨부': '/attachments',
  '결과문서 발급': '/certificates', '공개 자료실': '/documents', '관련 링크 미리보기': '/documents',
  '시민 의견 게시판': '/board', '본인 확인': '/identity', '알림 설정': '/settings',
}

export function ServiceHubPage() {
  const [params, setParams] = useSearchParams()
  const query = (params.get('q') || '').trim()
  const [draft, setDraft] = useState(query)
  useEffect(() => setDraft(query), [query])
  const matching = serviceGroups.map((group) => ({
    ...group,
    items: query ? group.items.filter((item) => `${group.title} ${group.description} ${item}`.toLocaleLowerCase().includes(query.toLocaleLowerCase())) : group.items,
  })).filter((group) => group.items.length > 0)
  function search(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setParams(draft.trim() ? { q: draft.trim() } : {}) }
  return (
    <div className="site-shell inner-page">
      <div className="page-title">
        <p>세종누리 시민지원 서비스</p>
        <h1>필요한 서비스를 찾아보세요</h1>
        <span>민원 신청부터 결과문서 발급까지 주요 시민 서비스를 안내합니다.</span>
      </div>
      <div className="service-hub-banner"><img src="/assets/service-neighborhood.png" alt="가상 도시의 공원과 시민 보행로" /><div><p>세종누리 시민서비스</p><strong>신청부터 조회와 발급까지<br />한곳에서 이용하세요.</strong><span>자주 이용하는 업무를 아래 목록에서 찾아 바로 시작할 수 있습니다.</span></div></div>
      <form className="service-search" role="search" onSubmit={search}><label htmlFor="service-directory-search">서비스 검색</label><div><input id="service-directory-search" value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="서비스명을 입력하세요" /><button type="submit"><Search size={18} /> 검색</button></div></form>
      {query && <p className="service-search__result">‘{query}’ 검색 결과 {matching.reduce((count, group) => count + group.items.length, 0)}건</p>}
      <div className="service-directory">
        {matching.map((group, index) => (
          <section key={group.title} className="service-group">
            <div className="service-group__number">0{index + 1}</div>
            <div className="service-group__copy">
              <h2>{group.title}</h2>
              <p>{group.description}</p>
            </div>
            <ul>
              {group.items.map((item) => (
                <li key={item}><Link to={destinations[item] || '/services'}>
                  <FileCheck2 size={18} />
                  <span>{item}</span>
                  <ArrowRight size={16} />
                </Link></li>
              ))}
            </ul>
          </section>
        ))}
        {matching.length === 0 && <div className="service-empty">검색 결과가 없습니다. 다른 서비스명을 입력해 주세요.</div>}
      </div>
      <div className="directory-action">
        <div>
          <h2>신청할 민원을 정하셨나요?</h2>
          <p>신청 전에 준비할 증빙자료와 처리 기간을 확인할 수 있습니다.</p>
        </div>
        <Link className="button button--primary" to="/apply">민원 신청하기 <ArrowRight size={18} /></Link>
      </div>
    </div>
  )
}
