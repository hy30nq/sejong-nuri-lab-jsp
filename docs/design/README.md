# 세종누리 JSP 전환 디자인 명세

Image Gen으로 만든 세 화면을 JSP 구현의 시각 기준으로 사용한다.

- `home-concept.png`: 홈 전체 구조와 공통 헤더·푸터
- `citizen-workspace-concept.png`: 시민 업무 화면, 좌측 메뉴, 표와 상세 정보
- `admin-concept.png`: 관리자 현황과 운영 표

## 디자인 토큰

- 배경: `#ffffff`
- 네이비: `#17375e`
- 틸: `#167f86`
- 옅은 청회색: `#eef6fa`
- 선: `#c9d8e3`
- 본문: `#24384a`
- 모서리: 4px, 8px
- 글꼴: Pretendard Variable, 시스템 sans-serif

텍스트와 컨트롤은 모두 JSP/HTML로 구현하며 콘셉트 이미지를 UI로 직접 사용하지 않는다.
