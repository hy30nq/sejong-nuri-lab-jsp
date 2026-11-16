import { ArrowRight } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import type { Complaint } from '../data'
import { formatPortalTime } from '../time'

export function ComplaintList({ complaints, loading, error }: { complaints: Complaint[]; loading: boolean; error: boolean }) {
  const [selected, setSelected] = useState('')
  const navigate = useNavigate()

  return (
    <section className="content-section" id="complaints" aria-labelledby="complaints-title">
      <div className="section-heading">
        <h2 id="complaints-title">진행 중인 민원</h2>
        <Link to="/complaints">전체 민원 보기 <ArrowRight size={17} /></Link>
      </div>
      <div className="complaint-table" role="table" aria-label="진행 중인 민원 목록">
        <div className="complaint-table__header" role="row">
          <span role="columnheader">민원번호</span>
          <span role="columnheader">민원내용</span>
          <span role="columnheader">처리상태</span>
          <span role="columnheader">최근 업데이트</span>
          <span role="columnheader">비고</span>
        </div>
        {complaints.map((complaint) => (
          <button
            className={`complaint-row ${selected === complaint.id ? 'is-selected' : ''}`}
            key={complaint.id}
            type="button"
            role="row"
            aria-selected={selected === complaint.id}
            onClick={() => { setSelected(complaint.id); navigate(`/complaints?receiptNo=${encodeURIComponent(complaint.id)}`) }}
          >
            <span className="complaint-id" role="cell"><i aria-hidden="true" />{complaint.id}</span>
            <span role="cell">
              <strong>{complaint.title}</strong>
              <small>{complaint.department}</small>
            </span>
            <span role="cell"><b className={`status status--${complaint.status === '처리 중' ? 'active' : 'received'}`}>{complaint.status}</b></span>
            <span role="cell">{formatPortalTime(complaint.updatedAt)}</span>
            <span className="row-action" role="cell">상세보기 <ArrowRight size={16} /></span>
          </button>
        ))}
        {loading && <p className="complaint-empty" role="status">민원 정보를 불러오는 중입니다.</p>}
        {error && <p className="complaint-empty" role="alert">민원 정보를 불러오지 못했습니다. 잠시 후 새로고침해 주세요.</p>}
        {!loading && !error && complaints.length === 0 && <p className="complaint-empty">진행 중인 민원이 없습니다.</p>}
      </div>
    </section>
  )
}
