# googlemap_coverage — 레포 코딩 지침

> 이 파일은 **이 저장소(`googlemap_coverage` / GeoMeasure G) 안의 코드 작성에만** 적용된다.
> 작성자: 개발5파트 / 작성일: 2026-08-06
> 계보와 사용법은 [`README.md`](README.md) — **여기는 "어떻게 쓸 것인가"만** 다룬다.

---

## 1. 이 코드는 바이브코딩 산출물이다

사람이 자연어로 지시하고 AI 에이전트가 코드를 쓰는 방식으로 개발한다. 그래서 다음을 **명시적으로 남긴다**.

- **소스 상단 헤더 주석**에 기재한다: 도구 성격(AI 협업 작성), 작성일, **계보(원본 → K → G)와 동기화 기준 커밋**, 적용 코드룰(Ponytail).
- **주석은 전부 한글로 쓴다.** 영문 주석 금지(식별자·API명 등 고유명사는 예외).
  - 이유: 작성자가 자연어로 읽고 지시하는 코드다. 주석이 대화 언어와 같아야 다음 세션에서 맥락이 즉시 붙는다.
- 주석은 **"무엇을"이 아니라 "왜"**를 쓴다. 코드를 그대로 옮겨 적은 주석은 지운다.
- **AI가 판단해서 넣은 비자명한 결정**(대안이 있었는데 하나를 고른 지점)은 한 줄 주석으로 근거를 남긴다.
- **K와 다르게 구현한 곳은 반드시 이유를 적는다.** 나중에 "이식 실수인가, 의도인가"를 구분하는 유일한 단서다.
- 커밋 메시지도 한글로 쓴다.

---

## 2. Ponytail 코드룰 (적용)

> 출처: [DietrichGebert/ponytail](https://github.com/DietrichGebert/ponytail) (MIT). 원문 규칙을 이 레포에 맞게 한글로 옮긴 것이며, 판단이 갈리면 원문을 따른다.
> 핵심: **가장 게으른 시니어 개발자처럼 생각한다. 게으르다 = 효율적이다, 대충 한다가 아니다. 최고의 코드는 아예 쓰지 않은 코드다.**

### 2.1 사다리 — 코드를 쓰기 전에, 먼저 걸리는 칸에서 멈춘다

1. **이걸 만들 필요가 있나?** (YAGNI) — 없으면 안 쓴다.
2. **이 코드베이스에 이미 있나?** — 있으면 그 헬퍼·유틸·패턴을 재사용한다. 다시 쓰지 않는다.
3. **표준 라이브러리가 해주나?** — 해주면 그걸 쓴다.
4. **플랫폼 기본 기능이 커버하나?** — 커버하면 그걸 쓴다.
5. **이미 설치된 의존성이 해결하나?** — 하면 그걸 쓴다.
6. **한 줄로 되나?** — 되면 한 줄로 쓴다.
7. **그제서야** — 동작하는 최소한의 코드를 쓴다.

사다리는 **문제를 이해한 다음에** 오르는 것이지, 이해를 대신하는 게 아니다.

**버그 수정 = 증상이 아니라 근본 원인.** 건드리는 함수의 모든 호출부를 grep해서 **공유 함수를 한 번 고친다** — 티켓에 적힌 경로만 패치하면 형제 호출부가 그대로 깨진 채 남는다.

### 2.2 규칙

- 명시적으로 요청하지 않은 **추상화 금지**.
- 피할 수 있으면 **새 의존성 추가 금지**. 구글 지도 라이브러리(`libraries=`)를 늘리는 것도 여기 해당한다 — **무료 한도 관리 지점이 하나 늘어난다**(§4).
- 아무도 요청하지 않은 **보일러플레이트 금지**.
- **추가보다 삭제. 영리함보다 지루함. 파일은 최소로.**
- **가장 짧게 동작하는 diff가 이긴다** — 단, 문제를 이해한 뒤에.
- 복잡한 요청은 되묻는다: *"X가 정말 필요합니까, 아니면 Y로 충분합니까?"*
- 표준 라이브러리 접근 두 가지가 코드량이 같으면 **엣지케이스에 안전한 쪽**을 고른다.
- **의도적으로 모서리를 자른 단순화**는 `ponytail:` 주석으로 **그 한계와 개선 경로**를 적어둔다.

### 2.3 게으르면 안 되는 것

- **문제를 이해하는 것**.
- 신뢰 경계에서의 **입력 검증** — 이 레포에서는 **GeoJSON 불러오기**가 여기다. 손으로 고친 파일·다른 버전 파일·직접 건드린 localStorage가 모두 그리로 들어온다.
- 데이터 유실을 막는 **에러 처리**.
- **보안**, **접근성**.
- **실제 하드웨어에 필요한 보정** — 플랫폼은 스펙대로가 아니다. 시계는 흐르고 센서는 틀어진다.
  - 이 레포에서는 **GPS 정확도(accuracy)**가 해당한다. ±를 숫자로 띄우는 데서 끝내지 않고 **화면 배율에도 반영**한다(`accBox`/`focusOnGps`). ±20 km짜리 IP 측위를 건물 단위로 확대해 보여주면 화면이 거짓말을 한다.
- **명시적으로 요청된 것**.

### 2.4 검증은 남긴다

자명하지 않은 로직은 **깨지면 실패하는 가장 작은 확인 하나**를 남긴다. 프레임워크·픽스처 없이 `selfcheck.test.js`에 추가한다.

- **필수 기준값**: 용춘목장 A/B/C — **A↔B 196.7 m · B↔C 237.9 m · C↔A 355.5 m**.
- **이 값은 K와 같아야 한다.** 다르면 두 판이 GeoJSON을 주고받는 의미가 없어진다. 거리 계산부를 건드리면 반드시 다시 돌린다.
- **지도 렌더는 이 테스트로 검증되지 않는다.** API 키를 확보하기 전에 작성된 코드라, 지도·드로잉·측위는 **미검증 상태**다(README «검증 상태»). 실지도 확인 전에는 "동작한다"고 단정하지 말 것.

---

## 3. 웹서버 설정 (필수)

이 레포는 단일 `index.html`을 정적으로 그대로 서빙한다(빌드 없음). 그래서 **`CLAUDE.md`·`README.md`·`selfcheck.test.js`·`.gitattributes`·`.git/`이 웹루트에 그대로 놓인다** — 아래 차단이 서비스 공개의 전제조건이다.

아래 nginx/Apache 블록은 **어느 서버에나 적용되는 최소 규칙**이고, 현재 운영 서버에 실제로 들어간 값은 §3.1에 있다.

### nginx

```nginx
location ~ /\. {                                   # .git, .env 등 숨김 파일
    deny all;
    return 404;
}
location ~* \.(md|js|sh|gitignore|gitattributes)$ {  # CLAUDE.md, README.md, selfcheck.test.js
    deny all;
    return 404;
}
```

> `index.html`은 인라인 스크립트만 쓰므로 `.js` 차단이 도구 동작에 영향을 주지 않는다. 외부 `.js`를 도입하면 이 규칙부터 다시 검토할 것.

### Apache

```apache
<FilesMatch "\.(md|js|sh|gitignore|gitattributes)$">
    Require all denied
</FilesMatch>
<DirectoryMatch "/\.">
    Require all denied
</DirectoryMatch>
```

### 위치 권한 헤더 — 빠뜨리면 GPS가 통째로 죽는다

응답 헤더에 `Permissions-Policy: geolocation=()`(빈 허용목록)가 있으면 **브라우저 권한·HTTPS·OS 설정이 모두 정상이어도 측위가 무조건 실패한다.** 보안 헤더 세트에 기본으로 들어있는 경우가 많다.

```nginx
add_header Permissions-Policy "geolocation=(self), microphone=(), camera=()" always;
```

> ⚠️ `add_header`를 하위 `location` 블록에 넣으면 **상위 블록의 add_header가 그 경로에서 통째로 무효화**된다(nginx 상속 규칙). 헤더 하나 때문에 HSTS 등이 사라지지 않도록 값만 바꾸거나 `$uri`로 가른다.

### 3.1 실제 배포 (yepark.co.kr, 라즈베리파이 + nginx)

- **서비스 URL**: `https://yepark.co.kr/bovicare-gmapgoogle/`
- **실제 경로**: `/var/www/html/webpage-googlemap-coverage/`
- **설정 파일**: `/etc/nginx/sites-enabled/default` 의 `server_name yepark.co.kr` HTTPS 블록, 그리고 `/etc/nginx/conf.d/security.conf`

이 서버에는 국내판 K(`/bovicare-gmapkakao/`)와 bovicare 계열 사이트가 같이 올라가 있다. 그래서 §3의 일반 규칙을 **그대로** 넣을 수 없는 지점이 두 군데 있다 — 아래가 그 실제 적용값이다.

**(1) 서비스 경로 매핑** — 폴더명을 URL에 노출하지 않기 위해 `alias`로 붙인다. trailing slash 없이 들어와도 먹도록 301을 같이 둔다(없으면 404).

```nginx
location = /bovicare-gmapgoogle {
    return 301 /bovicare-gmapgoogle/;
}

location /bovicare-gmapgoogle/ {
    alias /var/www/html/webpage-googlemap-coverage/;
    index index.html;
    try_files $uri $uri/ =404;
}
```

**(2) 내부 폴더명 직접 접근 차단** — `alias`를 써도 `root` 하위에 실제 폴더가 있으면 폴더명으로 우회 접근된다. 형제 경로가 이미 한 줄에 모여 있으므로 **새 location을 만들지 않고 기존 regex에 폴더명을 추가**한다.

```nginx
location ~ ^/(webpage-yepark-home|...|webpage-kakaomap-coverage|webpage-googlemap-coverage)(/|$) {
    deny all;
    return 404;
}
```

**(3) 문서·스크립트 차단 — §3의 `.js` 통째 차단은 이 서버에서 쓸 수 없다.**

```nginx
location ~* \.(md|sh|gitignore|gitattributes|test\.js)$ {   # ← js 가 아니라 test\.js
    deny all;
    return 404;
}
```

이 블록은 server 전역이라 **같은 서버의 bovicare 사이트들이 서빙하는 진짜 `.js`까지 죽인다.** 그래서 `test\.js`로 좁혔다 — 이 레포에서 막아야 할 `.js`는 `selfcheck.test.js` 하나뿐이라 결과는 같다. **대신 이 레포에 `*.test.js`가 아닌 개발용 `.js`를 추가하면 그대로 공개된다** — 파일을 늘릴 때 서비스에 필요한 것인지 먼저 따지고, 아니면 이 목록에 확장자를 추가한다.

**(4) 위치 권한 헤더** — §3의 경고대로 `add_header`는 한 곳에만 두고 값만 `$uri`로 가른다. K와 G 두 경로에서만 허용한다.

```nginx
map $uri $geolocation_policy {
    default                    "geolocation=()";
    ~^/bovicare-gmapkakao/     "geolocation=(self)";
    ~^/bovicare-gmapgoogle/    "geolocation=(self)";
}

add_header Permissions-Policy "${geolocation_policy}, microphone=(), camera=()" always;
```

### 3.2 적용 절차

```bash
sudo mkdir -p /etc/nginx/backups   # sites-enabled/ 안에 백업을 두면 중복 로드된다
sudo cp /etc/nginx/sites-enabled/default /etc/nginx/backups/default.bak.$(date +%Y%m%d-%H%M%S)
sudo cp /etc/nginx/conf.d/security.conf  /etc/nginx/backups/security.conf.bak.$(date +%Y%m%d-%H%M%S)
# ... 위 설정 추가 ...
sudo nginx -t && sudo systemctl reload nginx
```

`nginx -t`가 실패하면 reload하지 않는다(`&&`로 묶는 이유). `nginx.conf`가 `include /etc/nginx/sites-enabled/*;`로 **확장자를 가리지 않고** 읽으므로 백업을 그 디렉터리에 두면 server 블록이 중복 로드된다.

### 3.3 적용 확인 — 배포 후 반드시 돌린다

```bash
for u in /bovicare-gmapgoogle /bovicare-gmapgoogle/ \
         /bovicare-gmapgoogle/CLAUDE.md /bovicare-gmapgoogle/README.md \
         /bovicare-gmapgoogle/selfcheck.test.js /bovicare-gmapgoogle/.gitattributes \
         /bovicare-gmapgoogle/.git/config /webpage-googlemap-coverage/ ; do
  printf "%-42s %s\n" "$u" "$(curl -s -o /dev/null -w '%{http_code}' https://yepark.co.kr$u)"
done
```

| 경로 | 기대 |
|---|---|
| `/bovicare-gmapgoogle` | **301** (→ `/bovicare-gmapgoogle/`) |
| `/bovicare-gmapgoogle/` | **200** |
| `/bovicare-gmapgoogle/CLAUDE.md` · `README.md` | **404** |
| `/bovicare-gmapgoogle/selfcheck.test.js` · `.gitattributes` | **404** |
| `/bovicare-gmapgoogle/.git/config` | **404** |
| `/webpage-googlemap-coverage/` | **404** |

위치 기능은 200/404로 안 잡힌다 — 헤더로 따로 본다. **K와 루트도 같이 확인한다**(값을 한 곳에서 가르므로 회귀가 나면 다른 경로에서 터진다).

```bash
curl -sI https://yepark.co.kr/bovicare-gmapgoogle/ | grep -i permissions-policy   # geolocation=(self)
curl -sI https://yepark.co.kr/bovicare-gmapkakao/  | grep -i permissions-policy   # geolocation=(self) — 회귀 확인
curl -sI https://yepark.co.kr/                     | grep -i permissions-policy   # geolocation=()     — 차단 유지
```

> **키 인증은 이 절차로 검증되지 않는다.** 리퍼러·결제·API 활성화는 브라우저에서만 판정된다. `AuthenticationService`를 `curl`로 직접 부르면 리퍼러와 무관하게 `NotLoadingAPIFromGoogleMapsError`가 돌아와 **정상과 실패를 구분하지 못한다** — 실지도 확인을 대체하려 들지 말 것.

---

## 4. 키 · 과금 취급

- **Google Maps JavaScript 키는 코드에 그대로 넣는다.** 클라이언트 노출형이고 **HTTP 리퍼러 제한**으로 보호된다 — 이게 정상 사용법이다. 콘솔 설정 절차는 [`README.md`](README.md) "사용 / 설정"에 한 곳으로 정리했다 — **여기에 중복해서 적지 않는다.**
- **할당량(Quota) 상한을 반드시 건다.** 카카오는 한도 초과 시 자동 차단이지만 **구글은 과금**이다. 예산(Budget) 알림은 사용을 막지 않는다 — 막는 것은 할당량뿐이다.
- **라이브러리·API를 늘리면 관리 지점이 늘어난다.** 새 SKU마다 무료 한도와 일 상한을 따로 걸어야 한다. 지금은 Maps JavaScript + Geocoding 둘뿐이며, 늘리기 전에 §2.2 사다리를 먼저 오른다.
- 그 외 토큰·계정정보는 이 레포에 넣지 않는다.

---

## 5. GeoMeasure K 와의 동기화 (이 레포의 고유 규칙)

K(`pye0828-lab/kakaomap_coverage`)와 **별도 저장소**다. 자동 동기화 수단이 없으므로 아래 절차를 지킨다.

### 5.1 원칙

- **엔진에 묶이지 않는 코드는 K와 같은 내용을 유지한다.** 거리·면적·GeoJSON 빌드·입력 검증·상태 구조·UI 문자열이 여기 해당한다. 손댈 이유가 없으면 문구 하나도 바꾸지 않는다 — 두 파일을 나란히 놓고 diff를 볼 때 **차이가 적을수록 이식 누락을 찾기 쉽다.**
- **엔진 차이는 흡수하되 이름은 K를 따른다.** `LL`/`toPt`/`makeDistLabel`/`makeDraggableLabel`/`normPath`처럼 K에 있는 함수는 같은 이름·같은 역할로 둔다.
- **내부 상태는 평범한 `{lat,lng}`**로 유지하고 SDK 객체는 경계에서만 만든다. 계산·저장 코드가 엔진에 묶이지 않게 하는 핵심 규율이다.

### 5.2 K의 변경을 반영하는 절차

1. K의 변경 커밋 범위를 확인한다. `git log <이전_동기화_커밋>..HEAD`
2. 그 diff가 **엔진 무관 부분인지 엔진 부분인지 가른다.**
   - 엔진 무관 → **그대로 옮긴다.**
   - 엔진 부분 → 아래 §5.3 대응표를 보고 옮기고, **다르게 한 이유를 주석으로 남긴다.**
3. `node selfcheck.test.js`를 돌린다. 용춘목장 기준값이 K와 같은지가 1차 관문이다.
4. **소스 헤더 주석과 [`README.md`](README.md)의 "기능 동기화 기준 커밋"을 새 커밋 해시로 갱신한다.** 이걸 빼먹으면 다음 사람이 어디까지 반영됐는지 알 수 없다.
5. 커밋 메시지에 **어느 커밋을 반영했는지** 적는다.

### 5.3 엔진 대응표 (K → G)

| | GeoMeasure K (카카오) | GeoMeasure G (구글) |
|---|---|---|
| SDK 로드 | `autoload=false` + `kakao.maps.load()` | 키를 URL에 담아 동적 삽입 + `callback=initMap` |
| 좌표 객체 | `new kakao.maps.LatLng(lat,lng)` | `{lat,lng}` 리터럴을 그대로 받음 |
| 좌표 읽기 | `ll.getLat()` / `getLng()` | `ll.lat()` / `lng()` — **메서드 이름이 다름** |
| 배율 | `level` 1~14, **작을수록 확대** | `zoom` 0~21, **클수록 확대** (부등호가 뒤집힘) |
| 배율 지정 | `setLevel` / `getLevel` | `setZoom` / `getZoom` |
| 범위 맞춤 | `map.setBounds(b)` — 즉시 반영 | `map.fitBounds(b)` — **줌이 늦게 반영**되어 직후 `getZoom()`이 옛값. `idle`에서 처리 |
| 지도 잠금 | `setDraggable(false)` / `setZoomable(false)` | `setOptions({gestureHandling:'none'})` |
| 컨테이너 리사이즈 | `map.relayout()` **필수** | 대개 자동, `event.trigger(map,'resize')` |
| 위성 | `MapTypeId.SKYVIEW` | `'satellite'` |
| 위성+라벨 | `MapTypeId.HYBRID` | `'hybrid'` |
| 지형 | ROADMAP + `addOverlayMapTypeId(TERRAIN)` | `'terrain'` — **오버레이가 아닌 기본 타입** |
| 마커 라벨 | 미지원 → 색 원+글자 **SVG 데이터 URI** | `label` 네이티브 + `SymbolPath.CIRCLE` |
| 마커 모양 변경 | `setImage()` | `setIcon()` + `setLabel()` |
| 원 중심 이동 | `circle.setPosition()` | `circle.setCenter()` — **이름이 반대라 헷갈림** |
| 폴리곤 경로 | `path` | `paths` (링의 배열) |
| 점선 | `strokeStyle:'shortdash'` | `strokeOpacity:0` + `icons[]` 반복 기호 |
| DOM 오버레이 | `CustomOverlay` | `OverlayView` 상속 (`HtmlOverlay`) |
| 픽셀→좌표 | `map.getProjection().coordsFromContainerPoint()` | `overlay.getProjection().fromContainerPixelToLatLng()` |
| 지도 mouseout | 이벤트 없음 → DOM `mouseleave` | 지도 이벤트 `mouseout` 있음 |
| 검색 | `services.Places` → `services.Geocoder` | `Geocoder` 하나 (**상호명 검색이 약함** — Places는 별도 SKU라 미채택) |
| 영역 그리기 완료 | `drawend` → `getData()`로 되읽기 | `polygoncomplete`가 **Polygon을 그대로 전달** |
| 영역 닫기 제스처 | 더블클릭 / 우클릭 | **첫 꼭짓점 재클릭** |
| 지도 실패 감지 | 도메인 미등록 → 타일만 안 옴 | `gm_authFailure` + `console.error` 후킹 + 타일 타임아웃 |
| 자동저장 키 | `bovicarekormap.v1` | `geomeasure.g.v1` — **반드시 달라야 함**(같은 호스트면 localStorage 공유) |
| 확대 한계 | 스카이뷰가 알아서 처리 | **G 전용** — `위성+`(오버줌) + `MaxZoomService` 잠금. §5.5 |

### 5.4 갈라서기

해외 전용 기능(현지 좌표계·현지 지도 소스·현지 규제 대응 등)이 생기면 **동기화를 그만두고 완전히 갈라선다.** 그 시점에 이 §5를 삭제하고, 언제·왜 갈라섰는지 README에 한 줄 남긴다. 억지로 맞추느라 양쪽을 다 나쁘게 만들지 않는다.

### 5.5 G 전용: '위성+' 오버줌 — K 로 옮기지 않는다

`initSatPlus()` 와 `overzoomTile()` 은 **G 에만 있는 코드다.** 카카오 스카이뷰는 배율별 이미지 유무를 스스로 처리해 대응하는 개념이 없다(K 작업지침도 이 트릭을 명시적으로 범위 밖에 뒀다). §5.2 절차에서 이 두 함수는 대조 대상이 아니다.

- 이 레이어는 `mt0~3.google.com/vt` 라는 **문서화되지 않은 타일 엔드포인트**를 쓴다. API 키·할당량·과금을 타지 않는 대신 **Google Maps Platform 약관이 허용하는 경로가 아니다.** 원본 GeoMeasure 와 화면·조작감을 맞추려고 위험을 알고 채택했다(작업자 결정 2026-08-06).
- **끊겼을 때의 복구 경로**: `initSatPlus()` 안의 `map.mapTypes.set(...)` 과 `setMapType(MAP_TYPE_PLUS)` 두 줄을 지우고 기본값을 `'satellite'` 로 되돌린다. 같은 함수의 `MaxZoomService` 잠금은 공식 API 만 쓰므로 그대로 살아있고, 도구는 확대 한계가 낮아질 뿐 정상 동작한다.
- `overzoomTile()` 을 DOM 에서 분리해 둔 이유는 하나다 — **눈으로는 맞는지 알 수 없는 계산이라서** `selfcheck.test.js` 로 검증한다. 이 함수를 고치면 반드시 테스트를 다시 돌린다.
- 이 레이어가 기본값이 되면서 **키가 잘못돼도 타일은 그려진다.** 인증 실패 감지는 `gm_authFailure` 와 `console.error` 후킹이 담당하고, 타일 타임아웃은 보조 수단으로 내려갔다.
