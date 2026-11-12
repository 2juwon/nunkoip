# 눈코입 게임

사진에서 **왼눈·오른눈·코·입**만 하나씩 보여 주고 누군지 맞히는 파티 게임이에요.

- 바로 하기: https://2juwon.github.io/nunkoip/

## 하는 방법

1. 사진을 올려요. 여러 장을 한 번에 올릴 수 있어요.
2. 눈·코·입 위치는 자동으로 찾아요. 어긋나면 사진을 눌러 상자를 직접 옮겨요.
3. 사진마다 정답 이름을 적고, 원하면 참가자나 팀을 넣어요.
4. 게임을 시작하면 한 부위씩 공개돼요. 적게 보고 맞힐수록 점수가 커요(4·3·2·1점).

## 같이 하기 (방)

여럿이 모여서 할 때는 **📡 방 만들어 같이 하기**를 눌러요.

1. 출제자가 방을 만들면 5자리 번호, 링크, QR이 나와요.
2. 참가자는 각자 휴대폰으로 링크를 열거나 **🙋 참가자예요**에서 번호를 넣고 들어와요.
3. 출제자가 부위를 공개할 때마다 참가자 화면도 똑같이 바뀌어요. 답은 채팅이 아니라 **말로 외쳐요**.
4. 정답을 공개하면 출제자가 맞힌 사람을 골라 점수를 줘요. 참가자 화면에 "맞혔어요!"와 순위가 바로 떠요.

- 참가자에게는 공개된 부위와 정답 사진만 가요. 원본 사진과 아직 공개하지 않은 부위는 출제자 휴대폰에만 있어요.
- 방은 6시간 동안 쓰지 않으면 서버에서 모두 지워져요.
- 새로고침해도 같은 방, 같은 점수로 돌아와요.
- 방 기능은 github.io 주소에서만 돼요. claude.ai 페이지 안에서는 외부 서버에 접속할 수 없어서예요.

### 방 서버 (`server/`)

Cloudflare Workers + Durable Objects(무료 플랜)로 돌아가요. 주소는 `https://nunkoip.2juwon.workers.dev`이에요.

- `main`에서 `server/`가 바뀌면 GitHub Actions **서버 배포**가 자동으로 올려요.
- 저장소 **Settings → Secrets and variables → Actions**에 `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`가 있어야 해요. 없으면 배포를 건너뛰어요.
- 로컬에서 시험하기: `cd server && npm i && npm run dev`를 실행한 뒤 다른 창에서 `npm test`를 실행해요. `index.html`을 파일로 열면 로컬 서버(127.0.0.1:8787)에 붙어요.

## 문제 파일

만든 문제는 **📤 문제 내보내기**로 `.json` 파일로 저장해요. 다른 기기나 다른 사람은 **📥 문제 가져오기**로 그대로 불러와 쓸 수 있어요.

## 개인정보

- 사진과 얼굴 인식은 모두 **브라우저 안에서만** 처리하고, 어떤 서버로도 보내지 않아요.
- 저장은 각자 브라우저(IndexedDB)에만 해요.
- 다른 사람 사진을 쓸 때는 본인에게 먼저 말해 주세요.

## 파일

| 파일 | 내용 |
|---|---|
| `index.html` | 게임 전체 (HTML·CSS·JS 한 파일) |
| `server/` | 같이 하기 방 서버 (Cloudflare Worker) |
| `face-api.js` | 얼굴 인식 라이브러리 [@vladmandic/face-api](https://github.com/vladmandic/face-api) 1.7.15 (MIT) |
| `face-models.js` | 위 라이브러리의 모델 `ssd_mobilenetv1`, `face_landmark_68`을 base64로 담은 파일 (MIT) |

`face-models.js`에 모델을 넣어 둔 이유는 claude.ai 아티팩트에 `.bin` 파일을 올릴 수 없어서예요. 페이지가 `model/…` 요청을 가로채 이 파일에서 꺼내 써요.

## 라이선스

- `face-api.js`, `face-models.js`: MIT © Vladimir Mandic (원본 face-api © Vincent Mühler)
