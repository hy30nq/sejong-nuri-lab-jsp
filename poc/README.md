# 세종누리 전체 문제 PoC

이 폴더는 현재 JSP 실습환경의 S01~S10을 실제 API로 재현합니다. 배정받은 세종누리 실습 인스턴스에서만 실행하세요. S02는 격리된 명령 샌드박스의 파일을 읽는 비파괴 명령만 사용합니다.

## 전체 실행

로컬 11191 인스턴스:

```bash
python3 poc/poc.py
```

배정된 서버 인스턴스:

```bash
python3 poc/poc.py --base-url http://13.207.37.108:11191
```

문제 하나만 실행:

```bash
python3 poc/poc.py --base-url http://127.0.0.1:11191 --only S01
```

별도 패키지는 필요하지 않으며 Python 3 표준 라이브러리만 사용합니다. 보호된 API는 고정 실습 계정 `hangaram / hangaram`으로 로그인합니다.

## 포함된 PoC

| 문제 | 취약점 | PoC 성공 판정 |
|---|---|---|
| S01 | SQL 인젝션 | 계정 열거, `NURI-7342` Blind 추론, 잘못된 비밀번호로 관리자 로그인 |
| S02 | 운영체제 명령 인젝션 | 격리 샌드박스의 `config/service.txt` 읽기 |
| S03 | 불충분한 인증 절차 | OTP 없이 `verified: true` |
| S04 | 불충분한 권한 검증/IDOR | `hangaram` 세션으로 `dajeong`의 `APP-1000` 조회 |
| S05 | 파일 다운로드/경로 추적 | 공개 자료실 밖 `var/private/operations.txt` 읽기 |
| S06 | 악성 파일 업로드 | HTML 업로드 후 동일 출처에서 `text/html`로 제공 |
| S07 | SSRF | 모의 메타데이터의 `TRAINING_ONLY_ACCESS_KEY` 조회 |
| S08 | 저장형 XSS | 게시글에 이벤트 핸들러 저장 후 `/board`에서 실행 |
| S09 | CSRF | CSRF 토큰 없는 GET으로 이메일 알림 설정 변경 |
| S10 | 프로세스 검증 누락 | 승인 전 7001 및 타 사용자 소유 7101 증명서 발급 |

## 브라우저 확인이 필요한 세 항목

S06은 전체 PoC 출력에 표시되는 `/uploads/...html` 주소를 브라우저에서 엽니다. 제목과 본문이 `s06-upload-executed`로 바뀌면 업로드된 JavaScript가 동일 출처에서 실행된 것입니다.

S08은 전체 PoC 실행 후 `/board`를 열고 개발자 도구 Console에서 다음을 확인합니다.

```js
document.documentElement.dataset.s08
```

`executed`가 반환되면 저장형 XSS가 실행된 것입니다.

S09는 포털에 로그인한 브라우저에서 이 폴더를 별도 출처로 제공한 뒤 PoC 페이지를 엽니다.

```bash
python3 -m http.server 18080 --directory poc
```

```text
http://127.0.0.1:18080/s09-csrf.html?portal=http://127.0.0.1:11191
```

페이지가 포털 API로 이동하고 `/settings`에서 이메일 알림이 꺼져 있으면 교차 출처 최상위 GET 요청에 세션 쿠키가 포함된 것입니다. 서버 주소를 사용할 때는 `portal` 값만 본인의 URL과 포트로 바꿉니다.

## 실행 후 상태

- S03은 `hangaram` 계정을 본인 확인 완료 상태로 만듭니다.
- S06은 업로드 파일 하나를 남깁니다.
- S08은 XSS 게시글 하나를 남깁니다.
- S09 자동 PoC는 이메일 알림을 끕니다. `poc.py` 내부 검증은 확인 후 다시 켭니다.
- 완전히 초기화하려면 로컬에서 `docker compose down -v && docker compose up -d --build`를 실행합니다.
