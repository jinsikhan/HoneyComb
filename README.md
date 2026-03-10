# HoneyComb – 벌집 퍼즐

헥스(벌집) 그리드에서 같은 색 블록을 3개 이상 맞추어 제거하는 퍼즐 게임입니다.  
클릭↔클릭으로 인접 블록을 맞바꾸거나, 같은 색을 드래그해 한 번에 제거할 수 있습니다.

## 실행 방법

1. 이 폴더(`HoneyComb`)를 로컬 웹 서버로 연다거나, `HoneyComb.html`을 브라우저에서 직접 연다.
2. **권장:** 로컬 서버 사용 시 사운드가 정상 재생됩니다.
   ```bash
   # Python 3
   python3 -m http.server 8080
   # 또는 Node (npx)
   npx serve -p 8080
   ```
   브라우저에서 `http://localhost:8080/HoneyComb/HoneyComb.html` 접속.

## 조작법

| 조작 | 설명 |
|------|------|
| **클릭 → 클릭** | 두 칸을 순서대로 클릭하면 인접해 있을 때 서로 맞바꿈. 3개 이상 연결되면 제거. |
| **드래그** | 같은 색 블록을 드래그로 이어 3개 이상 맞추면 한 번에 제거. |
| **다이아몬드(💎)** | 레벨업 조건. 제거할수록 진행 바가 채워지고, 목표 달성 시 레벨 업. |
| **제한 시간** | 레벨마다 제한 시간이 있으며, 시간 내에 다이아몬드를 모아야 함. |

- **연쇄(콤보):** 리필 후 다시 3개 이상 맞추면 연쇄. 더블·트리플·익사이팅 보너스.
- **특수 블록:** 폭탄(주변 제거), 미사일(가로 한 줄), 십자(가로+세로) 등이 등장할 수 있음.

## 폴더 구조

```
HoneyComb/
├── HoneyComb.html    # 진입 HTML
├── honeycomb.css     # 스타일
├── honeycomb-state.js   # 공용 상태(G), id/get/set/neighbors
├── honeycomb-grid.js    # 그리드·헥스·매치·리필 로직
├── honeycomb-draw.js    # 그리기(drawHex, draw, 파티클, 아이템 애니)
├── honeycomb-audio.js   # BGM·효과음
├── honeycomb-game.js    # 타이머, 콤보, 스왑, 제거, 레벨업, 재시작
├── honeycomb-input.js   # 마우스·터치 입력
├── honeycomb-main.js    # DOM 바인딩 후 게임 시작
├── match.mp3            # 매치 효과음
├── combo.mp3            # 콤보 효과음
├── levelup.mp3          # 레벨업 효과음
├── bomb.mp3             # 폭탄 효과음
├── Missile.mp3          # 아이템(미사일/십자) 효과음
└── README.md            # 이 파일
```

## 모듈 설명

| 파일 | 역할 |
|------|------|
| **honeycomb-state.js** | 전역 상태 객체 `window.HoneyComb`(G) 초기화, 그리드 기본 함수(`id`, `get`, `set`, `neighbors`). |
| **honeycomb-grid.js** | 헥스 좌표 변환, 그리드 크기/색/다이아몬드 규칙, 매치 탐색·수집·리필, `initGrid`. |
| **honeycomb-draw.js** | 셀·배경·UI 그리기, 제거/리필/스왑 애니메이션, 폭탄/미사일/십자 연출, 파티클. |
| **honeycomb-audio.js** | 효과음 로드·재생(매치, 콤보, 레벨업, 폭탄, 아이템). |
| **honeycomb-game.js** | 레벨 타이머, 진행 바, 제거/연쇄/스왑 처리, 레벨업·재시작. |
| **honeycomb-input.js** | 캔버스 마우스/터치 이벤트, 스왑·드래그 매치, 재시작 버튼. |
| **honeycomb-main.js** | DOM 요소 바인딩 후 그리드·타이머·그리기·입력 연결 및 게임 시작. |

스크립트는 **위 목록 순서대로** 로드해야 합니다(상태 → 그리드 → 그리기 → 오디오 → 게임 → 입력 → 메인).

## 기술 스택

- HTML5, CSS3, Vanilla JavaScript(ES5 스타일 IIFE)
- Canvas 2D 렌더링
- 반응형 레이아웃(viewport, safe-area)
- Web Audio API 사용(선택적)

## 라이선스

이 프로젝트의 라이선스는 저장소/상위 프로젝트 정책을 따릅니다.
