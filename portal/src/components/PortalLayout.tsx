import { Headphones, Info } from 'lucide-react'
import { Link, Outlet } from 'react-router-dom'
import { Brand } from './Brand'
import { PortalHeader } from './PortalHeader'

export function PortalLayout() {
  return (
    <div className="portal-app">
      <PortalHeader />
      <main>
        <Outlet />
      </main>
      <footer className="portal-footer">
        <div className="site-shell portal-footer__support">
          <strong><Headphones size={21} /> 상담·이용안내</strong>
          <span>민원·서비스 안내 <b>044-123-4567</b></span>
          <span>운영시간 평일 09:00 ~ 18:00 (점심시간 12:00 ~ 13:00)</span>
        </div>
        <div className="portal-footer__main">
          <div className="site-shell portal-footer__main-inner">
            <Brand compact />
            <div><nav aria-label="하단 메뉴"><Link to="/services">서비스 안내</Link><Link to="/notices">공지사항</Link><Link to="/status">이용 상태</Link></nav><p>세종누리 시민지원 통합포털 · 교육용 가상기관 · 문의번호 044-123-4567 (가상번호)</p></div>
          </div>
        </div>
        <div className="training-disclaimer">
          <div className="site-shell">
            <Info size={20} />
            <strong>보안교육을 위한 가상서비스</strong>
            <span>이 사이트는 웹 보안 학습과 실습을 위해 제작된 가상의 공공서비스입니다. 실제 민원 처리, 개인정보 수집, 행정효력은 없습니다.</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
