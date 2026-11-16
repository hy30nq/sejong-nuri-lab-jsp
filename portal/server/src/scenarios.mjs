export const scenarios = [
  { code: 'S01', guideCode: 'SI', severity: '상', title: 'SQL 인젝션', business: '시민 계정 조회', goal: '인증 우회와 참·거짓 응답 변화로 비인가된 데이터베이스 접근 가능 여부 확인' },
  { code: 'S02', guideCode: 'CI', severity: '상', title: '코드 인젝션(운영체제 명령실행)', business: '서비스 연결 점검', goal: 'GET·POST 파라미터 변조로 비인가된 시스템 정보 노출과 명령 실행 가능 여부 확인' },
  { code: 'S03', guideCode: 'IA', severity: '상', title: '불충분한 인증 절차', business: '본인 확인', goal: '로직·파라미터 변조로 인증 절차 우회 가능 여부 확인' },
  { code: 'S04', guideCode: 'IN', severity: '상', title: '불충분한 권한 검증', business: '민원 상세 조회', goal: '일련번호 변조로 타 사용자의 비공개 정보와 개인정보 접근 가능 여부 확인' },
  { code: 'S05', guideCode: 'FD', severity: '상', title: '파일 다운로드', business: '공개 자료실', goal: '다운로드 요청 파라미터 변조로 허용 경로 밖 파일 접근 가능 여부 확인' },
  { code: 'S06', guideCode: 'FU', severity: '상', title: '악성 파일 업로드', business: '증빙자료 첨부', goal: '확장자 검증 없이 업로드된 파일의 실행 가능 여부 확인' },
  { code: 'S07', guideCode: 'SF', severity: '상', title: '서버사이드 요청 위조(SSRF)', business: '외부 문서 미리보기', goal: '허용되지 않은 내부 자원과 메타데이터 접근 가능 여부 확인' },
  { code: 'S08', guideCode: 'XS', severity: '상', title: '크로스사이트 스크립트', business: '시민 의견 게시판', goal: '저장된 입력값을 통해 다른 사용자의 브라우저에서 스크립트 실행 가능 여부 확인' },
  { code: 'S09', guideCode: 'CF', severity: '상', title: '크로스사이트 요청 위조(CSRF)', business: '알림 설정', goal: '인증 세션을 악용한 위조 요청으로 의도하지 않은 상태 변경 가능 여부 확인' },
  { code: 'S10', guideCode: 'PV', severity: '상', title: '프로세스 검증 누락', business: '결과문서 발급', goal: 'URL 직접 접근과 프로세스 우회로 승인 전 문서 발급 가능 여부 확인' },
]
