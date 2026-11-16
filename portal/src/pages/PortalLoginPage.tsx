import { FormEvent, useState } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowRight, LockKeyhole, ShieldCheck } from 'lucide-react'
import { apiRequest } from '../api'
import { Citizen, useCitizen } from '../App'

const returnRoutes = new Set(['/apply', '/account', '/admin', '/complaints', '/board', '/documents', '/attachments', '/certificates', '/settings', '/identity', '/status'])

export function PortalLoginPage() {
  const { user, setUser } = useCitizen()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const requested = searchParams.get('next') || ''
  const safeNext = returnRoutes.has(requested.split(/[?#]/)[0]) && !requested.includes('\\') ? requested : ''
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)
  const [accountCheck, setAccountCheck] = useState('')

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    setPending(true)
    setError('')
    try {
      const response = await apiRequest<{ user: Citizen }>('/api/citizens/login', {
        method: 'POST', body: JSON.stringify({ username: form.get('username'), password: form.get('password') }),
      })
      setUser(response.user)
      navigate(safeNext || (response.user.role === 'staff' ? '/admin' : '/account'), { replace: true })
    } catch (reason) { setError(reason instanceof Error ? reason.message : '로그인에 실패했습니다.') }
    finally { setPending(false) }
  }

  async function checkAccount(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const username = String(new FormData(event.currentTarget).get('accountUsername') || '')
    setAccountCheck('확인 중...')
    try {
      const response = await apiRequest<{ registered: boolean }>(`/api/public/account-check?username=${encodeURIComponent(username)}`)
      setAccountCheck(response.registered
        ? `'${username}' 아이디는 등록되어 있습니다.`
        : `'${username}' 아이디는 등록되어 있지 않습니다.`)
    } catch (reason) {
      setAccountCheck(reason instanceof Error ? reason.message : '계정을 확인하지 못했습니다.')
    }
  }

  if (user) return <Navigate to={safeNext || (user.role === 'staff' ? '/admin' : '/account')} replace />
  return <div className="site-shell civic-inner-page auth-layout">
    <div className="auth-story"><p>세종누리 시민지원 통합포털</p><h1>내 생활에 필요한 서비스를<br /> 한곳에서 이용하세요.</h1><span>민원 신청과 처리 조회, 문서 발급, 시민 의견까지 편리하게 이용할 수 있습니다.</span><img src="/assets/civic-hero.png" alt="시민지원센터 일러스트" /></div>
    <div className="auth-card"><div className="auth-card__icon"><LockKeyhole size={26} /></div><h2>세종누리 로그인</h2><p>세종누리 계정으로 로그인하고 서비스를 이용하세요.</p>
      <form onSubmit={submit}>
        <label>아이디<input name="username" autoComplete="username" placeholder="아이디를 입력하세요" required autoFocus /></label>
        <label>비밀번호<input name="password" type="password" autoComplete="current-password" placeholder="비밀번호를 입력하세요" required /></label>
        {error && <div className="civic-error" role="alert">{error}</div>}
        <button type="submit" disabled={pending}>{pending ? '로그인 중...' : '로그인'} <ArrowRight size={18} /></button>
      </form>
      <div className="auth-card__help"><ShieldCheck size={18} /> 계정 이용에 관한 안내는 담당자에게 문의하세요.</div>
      <details className="account-check-panel">
        <summary>계정 등록 여부 확인</summary>
        <p>로그인 전에 아이디가 등록되어 있는지 확인할 수 있습니다.</p>
        <form onSubmit={checkAccount}><label>확인할 아이디<input name="accountUsername" autoComplete="off" required /></label><button type="submit">등록 여부 확인</button></form>
        {accountCheck && <div className="account-check-result" role="status">{accountCheck}</div>}
      </details>
      <Link to="/services">이용 가능한 서비스 보기</Link>
    </div>
  </div>
}
