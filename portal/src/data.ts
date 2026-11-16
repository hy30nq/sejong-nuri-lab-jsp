export type Complaint = {
  id: string
  title: string
  status: '처리 중' | '접수 완료'
  updatedAt: string
  department: string
}

export const serviceGroups = [
  {
    title: '민원 신청·조회',
    description: '생활·주거·시설 관련 민원을 신청하고 처리 단계를 확인합니다.',
    items: ['새 민원 신청', '나의 민원', '증빙자료 첨부'],
  },
  {
    title: '문서·자료실',
    description: '민원 처리 결과와 공개 안내자료를 확인하고 발급합니다.',
    items: ['결과문서 발급', '공개 자료실', '관련 링크 미리보기'],
  },
  {
    title: '시민참여·계정',
    description: '시민 의견을 나누고 계정 및 알림 정보를 관리합니다.',
    items: ['시민 의견 게시판', '본인 확인', '알림 설정'],
  },
]
