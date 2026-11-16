import { ArrowLeft, CheckCircle2 } from 'lucide-react'
import { FormEvent, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { apiRequest } from '../api'
import { useCitizen } from '../App'

export function CivilApplicationPage() {
  const { user } = useCitizen()
  const [submitted, setSubmitted] = useState(false)
  const [receipt, setReceipt] = useState('')
  const [error, setError] = useState('')

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    const form = new FormData(event.currentTarget)
    try {
      const result = await apiRequest<{ displayId: string }>('/api/applications', {
        method: 'POST',
        body: JSON.stringify({ category: form.get('category'), title: form.get('title'), detail: form.get('detail') }),
      })
      setReceipt(result.displayId)
      setSubmitted(true)
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '민원을 접수하지 못했습니다.')
    }
  }

  if (!user) return <Navigate to="/login?next=%2Fapply" replace />
  return (
    <div className="site-shell form-page">
      <Link className="back-link" to="/"><ArrowLeft size={18} /> 홈으로 돌아가기</Link>
      <div className="form-page__heading">
        <h1>새 민원 신청</h1>
        <p>신청 내용을 확인할 수 있도록 필요한 항목을 정확히 입력해 주세요.</p>
      </div>
      {submitted ? (
        <div className="success-panel" role="status">
          <CheckCircle2 size={42} />
          <h2>민원 신청이 접수되었습니다</h2>
          <p>접수번호는 <strong>{receipt}</strong>입니다. 나의 민원에서 처리 상태를 확인할 수 있습니다.</p>
          <Link className="button button--primary" to="/">대시보드로 이동</Link>
        </div>
      ) : (
        <div className="application-layout"><form className="application-form" onSubmit={handleSubmit}>
          {error && <div className="form-error" role="alert">{error}</div>}
          <div className="form-section-title">
            <span>1</span>
            <div><h2>신청 정보</h2><p>민원 분야와 제목을 입력합니다.</p></div>
          </div>
          <label>
            <span>민원 분야 <b>*</b></span>
            <select name="category" required defaultValue="">
              <option value="" disabled>분야를 선택하세요</option>
              <option>주거·환경</option>
              <option>생활·복지</option>
              <option>교통·시설</option>
            </select>
          </label>
          <label>
            <span>민원 제목 <b>*</b></span>
            <input name="title" required maxLength={80} placeholder="민원 내용을 알 수 있는 제목을 입력하세요" />
          </label>
          <div className="form-section-title">
            <span>2</span>
            <div><h2>상세 내용</h2><p>사실 관계와 요청 사항을 구체적으로 작성합니다.</p></div>
          </div>
          <label>
            <span>상세 내용 <b>*</b></span>
            <textarea name="detail" required maxLength={3000} rows={8} placeholder="민원이 발생한 위치, 일시, 요청 사항을 작성하세요" />
          </label>
          <label className="consent-row">
            <input type="checkbox" required />
            <span>입력한 내용이 본 서비스의 가상 민원 처리에 사용됨을 확인했습니다.</span>
          </label>
          <div className="form-actions">
            <Link className="button button--secondary" to="/">취소</Link>
            <button className="button button--primary" type="submit">민원 신청</button>
          </div>
        </form><aside className="application-guide"><img src="/assets/service-application.png" alt="시민지원 창구에서 서비스를 이용하는 모습" /><div><p>신청 전 확인</p><h2>민원을 접수하기 전에</h2><ol><li>민원 분야와 요청 내용을 정확히 작성해 주세요.</li><li>사진이나 관련 문서가 있다면 접수 후 증빙자료 첨부 메뉴를 이용하세요.</li><li>접수번호를 보관하면 나의 민원에서 처리현황을 조회할 수 있습니다.</li></ol><Link to="/services">서비스 전체보기 <ArrowLeft size={15} /></Link></div></aside></div>
      )}
    </div>
  )
}
