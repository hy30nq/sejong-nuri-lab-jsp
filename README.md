# 세종누리 시민지원 통합포털 — JSP/WildFly 교육판

로그인, 민원, 문서, 게시판, 알림, 본인 확인, 결과문서 발급을 한 사이트에서 사용하는 JSP 기반 웹 보안 실습환경입니다. 화면에 시나리오 선택이나 플래그 제출 기능은 없습니다.

## 구성

- Java 21 + Jakarta Servlet/JSP 3.x
- WildFly 39 (무료 JBoss 계열 애플리케이션 서버)
- Gradle WAR 빌드 + H2 파일 데이터베이스
- Nginx 비특권 리버스 프록시
- 네트워크가 차단된 Java 명령 실습 샌드박스

React, Vite, Node.js 런타임은 사용하지 않습니다. 모든 화면은 `WEB-INF/jsp`에서 서버 렌더링하며, 동적 상호작용만 바닐라 JavaScript로 처리합니다.

## 실행

Docker Desktop을 켠 뒤 이 폴더에서 다음 명령을 실행합니다.

```bash
docker compose up -d --build
```

브라우저 주소: **http://127.0.0.1:11191/** 또는 `http://<서버-IP>:11191/`

기본 포트 바인딩은 안전한 로컬 전용 `127.0.0.1:11191`입니다. 학교 내부망에서 접속시킬 때만 다음처럼 서버 주소를 명시하세요.

```bash
LAB_BIND_IP=10.20.30.40 docker compose up -d --build
```

| 계정 | 아이디 | 비밀번호 |
|---|---|---|
| 시민 | `hangaram` | `hangaram` |
| 다른 시민 | `dajeong` | `dajeong` |
| 포털 관리자 | `admin` | `admin` |

개발자 도구 Network 기반 진행 절차는 [교육생용 실습가이드](./교육생용_실습가이드.md), 정답과 수업 운영 방법은 [강사용 라이트업](./강사용_라이트업.md)에 있습니다.

## 점검과 종료

```bash
./gradlew --no-daemon test
./tests/flow.sh
docker compose ps
docker compose down
```

실습 내용을 초기화하려면 `docker compose down -v` 후 다시 실행합니다. `-v`는 이 실습의 DB와 업로드를 삭제합니다.

명령 인젝션 실습은 네트워크가 없는 별도 Java 컨테이너에서 실행하고, 자료 열람·내부 URL 미리보기도 실습 데이터 범위로 제한합니다. 의도적인 취약점이 있으므로 외부 주소에 바인딩할 때는 반드시 학교 방화벽·보안그룹에서 교육망 또는 지정된 교육생 IP만 허용하세요. 공개 인터넷 전체(`0.0.0.0/0`)에는 열지 마세요.

## 개발 구조

| 경로 | 역할 |
|---|---|
| `src/main/java/com/sejongnuri/lab` | Servlet, JDBC, 세션, 명령 샌드박스 |
| `src/main/webapp/WEB-INF/jsp` | JSP 화면과 공통 조각 |
| `src/main/webapp/assets` | CSS, 바닐라 JS, 이미지, 글꼴 |
| `src/main/webapp/WEB-INF/training_data` | 실습 전용 가상 파일 |
| `src/test` · `tests/flow.sh` | 단위·통합 검증 |
| `docs/design` | 전면 개편 시 사용한 디자인 콘셉트 |

## 학교 서버에 교육생별 30개 배포

`11191`부터 `11220`까지 교육생별 독립 인스턴스를 실행하는 `deploy/start-30-instances.sh`, 일시 중지하는 `deploy/stop-30-instances.sh`, 컨테이너를 모두 내리는 `deploy/down-30-instances.sh`가 준비되어 있습니다. 자세한 내용은 [학교 Linux 서버 배포 안내](./deploy/README.md)를 참고하세요.
