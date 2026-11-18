# 학교 Linux 서버 배포

이 구성은 세종누리 실습환경을 교육생별로 분리하여 기본 30개 실행합니다.

- 인스턴스 01: `11191`
- 인스턴스 02: `11192`
- ...
- 인스턴스 30: `11220`
- 각 인스턴스는 독립 H2 DB, 업로드 볼륨, 세션, 내부 네트워크, Java 명령 샌드박스를 사용합니다.
- 애플리케이션 이미지는 한 번만 빌드하고 30개 인스턴스가 공유합니다.
- 외부 Basic Auth 계정은 인스턴스별로 자동 생성됩니다.

## 사전 준비

Linux 서버에 Docker Engine, Docker Compose 플러그인, `openssl`, `curl`이 필요합니다.

학교 서버의 내부 IP와 Docker 전용 대역이 충돌하지 않는지 확인합니다.

```bash
ip route
docker network ls
```

기본 Docker 대역은 다음과 같습니다.

- 공유 ingress: `10.239.255.0/24`
- 교육생 사설망: `10.240.1.0/29` ~ `10.240.30.0/29`

학교 또는 VPN이 이 대역을 이미 사용한다면 `LAB_INGRESS_SUBNET`, `LAB_PRIVATE_PREFIX`를 다른 사설 대역으로 지정하세요.

## 30개 시작

학교 서버 내부 IP가 `10.20.30.40`인 예시입니다.

```bash
chmod +x deploy/start-30-instances.sh deploy/stop-30-instances.sh deploy/down-30-instances.sh
LAB_BIND_IP=10.20.30.40 ./deploy/start-30-instances.sh
```

기본 실행 값:

```text
INSTANCE_COUNT=30
BASE_PORT=11191
LAB_PRIVATE_PREFIX=10.240
LAB_INGRESS_NETWORK=sejong-lab-ingress
LAB_INGRESS_SUBNET=10.239.255.0/24
```

값을 바꾸려면 실행 명령 앞에 지정합니다.

```bash
LAB_BIND_IP=10.20.30.40 \
INSTANCE_COUNT=30 \
BASE_PORT=11191 \
LAB_PRIVATE_PREFIX=10.240 \
./deploy/start-30-instances.sh
```

교육생별 주소와 외부 인증 계정은 다음 파일에 생성됩니다.

```text
deploy/state/credentials.tsv
```

이 파일에는 평문 비밀번호가 포함되며 권한은 `600`으로 설정됩니다. 강사만 보관하고 교육생에게 자기 행만 전달하세요.

포털 내부 실습 계정은 기존과 같습니다.

| 역할 | 아이디 | 비밀번호 |
|---|---|---|
| 시민 | `hangaram` | `hangaram` |
| 다른 시민 | `dajeong` | `dajeong` |
| 관리자 | `admin` | `admin` |

스크립트는 폴더를 30번 복사하지 않고, 동일한 이미지를 공유하는 독립 Compose 프로젝트 30개를 만듭니다. 각 프로젝트의 포트, DB·업로드 볼륨, 세션, 내부 네트워크와 Basic Auth 계정은 서로 분리됩니다.

## 전체 일시 중지

```bash
./deploy/stop-30-instances.sh
```

`stop`만 실행하므로 DB와 업로드 데이터는 보존됩니다. 다시 시작할 때 시작 스크립트를 실행하면 기존 외부 인증 비밀번호와 볼륨을 재사용합니다.

## 전체 내리기

컨테이너와 인스턴스별 네트워크를 모두 제거하되 DB와 업로드 볼륨은 보존합니다.

```bash
./deploy/down-30-instances.sh
```

DB와 업로드까지 완전히 초기화할 때만 다음처럼 실행합니다.

```bash
REMOVE_VOLUMES=1 ./deploy/down-30-instances.sh
```

`11191`부터 `11220`까지 각 포트로 들어온 요청은 리다이렉트 후에도 같은 포트를 유지합니다.

## 방화벽

`11191~11220`은 학교 교육망 또는 VPN 대역에서만 접근을 허용하세요. UFW를 사용한다면 다음 형식으로 적용할 수 있습니다.

```bash
sudo ufw allow from <교육망-CIDR> to any port 11191:11220 proto tcp
```

공개 인터넷 전체에 포트를 허용하지 마세요. Basic Auth는 HTTPS가 없으면 암호화되지 않으므로, 라우팅 가능한 외부망에서 사용할 경우 학교 VPN 또는 TLS 리버스 프록시가 필요합니다.

## 상태 확인

```bash
docker ps --filter 'name=sejong-lab-'
docker stats --no-stream
```

특정 인스턴스 로그:

```bash
docker compose \
  --env-file deploy/state/01.env \
  -f compose.yaml -f compose.server.yaml \
  -p sejong-lab-01 logs --tail=100
```

## 자원 제한

서버용 오버라이드는 인스턴스당 다음 상한을 적용합니다.

| 서비스 | 메모리 | CPU |
|---|---:|---:|
| portal (WildFly) | 512MB | 0.75 |
| command-sandbox | 64MB | 0.25 |
| web | 32MB | 0.10 |

30개 기준 메모리 상한 합계는 약 17.8GB입니다. 실제 동시 수용 수는 서버의 가용 메모리와 수업 중 요청량에 따라 달라지므로, 먼저 1~3개 인스턴스로 부하와 여유 메모리를 확인하세요. 로그는 컨테이너당 10MB 파일 2개로 순환합니다.
