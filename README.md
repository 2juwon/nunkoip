# 눈코입 게임

사진에서 **왼눈·오른눈·코·입**만 하나씩 보여 주고 누군지 맞히는 파티 게임이에요.

- 바로 하기: https://2juwon.github.io/nunkoip/

## 하는 방법

1. 사진을 올려요. 여러 장을 한 번에 올릴 수 있어요.
2. 눈·코·입 위치는 자동으로 찾아요. 어긋나면 사진을 눌러 상자를 직접 옮겨요.
3. 사진마다 정답 이름을 적고, 원하면 참가자나 팀을 넣어요.
4. 게임을 시작하면 한 부위씩 공개돼요. 적게 보고 맞힐수록 점수가 커요(4·3·2·1점).

만든 문제는 **📤 문제 내보내기**로 `.json` 파일로 저장해요. 다른 기기나 다른 사람은 **📥 문제 가져오기**로 그대로 불러와 쓸 수 있어요.

## 개인정보

- 사진과 얼굴 인식은 모두 **브라우저 안에서만** 처리하고, 어떤 서버로도 보내지 않아요.
- 저장은 각자 브라우저(IndexedDB)에만 해요.
- 다른 사람 사진을 쓸 때는 본인에게 먼저 말해 주세요.

## 파일

| 파일 | 내용 |
|---|---|
| `index.html` | 게임 전체 (HTML·CSS·JS 한 파일) |
| `face-api.js` | 얼굴 인식 라이브러리 [@vladmandic/face-api](https://github.com/vladmandic/face-api) 1.7.15 (MIT) |
| `face-models.js` | 위 라이브러리의 모델 `ssd_mobilenetv1`, `face_landmark_68`을 base64로 담은 파일 (MIT) |

`face-models.js`에 모델을 넣어 둔 이유는 claude.ai 아티팩트에 `.bin` 파일을 올릴 수 없어서예요. 페이지가 `model/…` 요청을 가로채 이 파일에서 꺼내 써요.

## 라이선스

- `face-api.js`, `face-models.js`: MIT © Vladimir Mandic (원본 face-api © Vincent Mühler)
