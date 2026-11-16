import { Bell, Menu, UserRound, X } from 'lucide-react'
import { useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { apiRequest } from '../api'
import { useCitizen } from '../App'
import { Brand } from './Brand'

const navigation = [
  { label: '민원서비스', to: '/services' },
  { label: '나의 민원', to: '/complaints' },
  { label: '문서·자료실', to: '/documents' },
  { label: '시민 의견', to: '/board' },
  { label: '이용안내', to: '/status' },
]

export function PortalHeader() {
  const [open, setOpen] = useState(false)
  const { user, setUser } = useCitizen()

  return (
    <>
      <div className="utility-bar">
        <div className="site-shell utility-bar__inner">
          <span>세종누리 시민지원 통합포털</span>
          <nav aria-label="사이트 도구">
            <Link to="/notices">공지사항</Link>
            <Link to="/services">전체서비스</Link>
            <Link to={user ? '/account' : '/login'}>{user ? '마이페이지' : '로그인'}</Link>
          </nav>
        </div>
      </div>

      <header className="main-header">
        <div className="site-shell main-header__inner">
          <Brand />
          <nav className="main-nav" aria-label="주 메뉴">
            {navigation.map((item) => (
              <NavLink key={item.label} to={item.to}>
                {item.label}
              </NavLink>
            ))}
          </nav>
          <div className="header-actions">
            {user?.role === 'staff' && <Link className="header-admin-link" to="/admin">포털 관리</Link>}
            <Link className="icon-button notification-button" to={user ? '/settings' : '/login'} aria-label="알림 설정">
              <Bell size={22} />
            </Link>
            <Link className="account-button" to={user ? '/account' : '/login'}>
              <UserRound size={20} />
              <span>{user ? `${user.displayName}님` : '로그인'}</span>
            </Link>
            {user && <button className="header-logout" type="button" onClick={async () => { await apiRequest('/api/citizens/logout', { method: 'POST' }); setUser(null); window.location.href = '/' }}>로그아웃</button>}
            <button
              className="mobile-menu-button"
              type="button"
              aria-label={open ? '메뉴 닫기' : '메뉴 열기'}
              onClick={() => setOpen((value) => !value)}
            >
              {open ? <X /> : <Menu />}
            </button>
          </div>
        </div>
        {open && (
          <nav className="mobile-nav" aria-label="모바일 주 메뉴">
            {navigation.map((item) => (
              <NavLink key={item.label} to={item.to} onClick={() => setOpen(false)}>
                {item.label}
              </NavLink>
            ))}
            <NavLink to={user ? '/account' : '/login'} onClick={() => setOpen(false)}>{user ? '내 정보' : '로그인'}</NavLink>
            {user?.role === 'staff' && <NavLink to="/admin" onClick={() => setOpen(false)}>포털 관리</NavLink>}
          </nav>
        )}
      </header>
    </>
  )
}
