import { Link } from 'react-router-dom'

type BrandProps = {
  compact?: boolean
}

export function Brand({ compact = false }: BrandProps) {
  return (
    <Link className="brand" to="/" aria-label="세종누리 시민지원 통합포털 홈">
      <img src="/assets/brand-mark.png" alt="" className="brand__mark" />
      <span className="brand__text">
        <strong>세종누리</strong>
        {!compact && <span>시민지원 통합포털</span>}
      </span>
    </Link>
  )
}
