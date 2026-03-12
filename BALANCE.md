# HoneyComb 밸런스 가이드 (Balance Design Doc)

이 문서는 **전략/밸런스 기획** 기준입니다. 난이도·페이싱·보상 조정 시 여기를 참고하고, 변경 후 이 문서도 함께 갱신하세요.

---

## 1. 설계 목표

| 구간 | 레벨 | 목표 체감 |
|------|------|------------|
| 초반 | 1~10 | 캐주얼, 블럭 수 적당, 이탈 방지 |
| 중반 | 11~40 | 점진적 도전, 콤보/아이템 활용 |
| 후반 | 41~70 | 6색 한계 활용, 시간·다이아 관리 (밸런스 조절 구간 끝) |
| 엔드 | 71+ | 7색 추가, 그리드는 70과 동일 유지 |

---

## 2. 튜닝 가능 파라미터 & 코드 위치

### 2.1 그리드(블럭 수)

| 항목 | 파일 | 함수/상수 | 설명 |
|------|------|-----------|------|
| 레벨별 행/열 | honeycomb-grid.js | `getGridSize(lv)` | **레벨 70까지** 밸런스. 정사각형이 아닌 **(rows, cols) 조합 테이블**로 7레벨 단위 확대. 4×4 → 4×5 → 5×6 → 6×6 → 6×7 → 7×8 → 8×8 → 8×9 → 9×10 → 10×11. 71+는 70과 동일. |
| 모바일 캡 | honeycomb-grid.js | `applyGridSize()` 내 `maxRC` | CANVAS_WIDTH < 380 → 최대 9×9 |
| 보드 모양 | honeycomb-state.js / honeycomb-grid.js | `inBounds(r,c)`, `hexRadius` | **육각형 실루엣**: 직사각형이 아닌 중심 거리(hex radius) 이내만 유효. `hexRadius = min(floor(ROWS/2), floor(COLS/2))` |
| 보드 구멍 | honeycomb-grid.js | `getHoleCountForLevel(lv)`, `G.holes` | 레벨 15~24: 1개, 25~34: 2개 … 55+: 5개. 중간 빈 슬롯으로 난이도 상승 |
| 열쇠(키) | honeycomb-grid.js / honeycomb-game.js | `getKeysRequiredForLevel(lv)`, `keysCollectedThisLevel` | Lv20+: 2개, 40+: 3개, 60+: 4개 필요. 키 블럭 매치 시 수집, 다이아+열쇠 모두 충족 시 레벨업 |

- **목표**: 레벨 70까지 밸런스 조절. 행/열을 행렬 공식이 아니라 (rows, cols) 조합으로 두어 4×5, 6×7 등 비정사각형 비중을 높임. 7레벨 단위로 완만히 확대.

### 2.2 다이아몬드(미션 목표)

| 항목 | 파일 | 함수/상수 | 설명 |
|------|------|-----------|------|
| 레벨당 필요 다이아 | honeycomb-grid.js | `getDiamondsToNextLevel(lv)` | `max(3, round(3 + lv * 0.95))` |
| 보드 내 다이아 상한 | honeycomb-grid.js | `maxDiamondsOnGrid()` | 4 + floor((level+3)/4), 상한 16 |
| 다이아 드랍 확률 | honeycomb-grid.js | `diamondChanceForLevel(lv)` | 0.26 + lv*0.0075, 상한 0.48 |
| 보드 최소 다이아 수 | honeycomb-grid.js | `minDiamondsOnGridForLevel(lv)` | Lv 1~8:2, 9~18:3, 19~30:4, 31~45:5, 46+:6 |

### 2.3 시간 제한

| 항목 | 파일 | 함수/상수 | 설명 |
|------|------|-----------|------|
| 레벨당 제한 시간(초) | honeycomb-grid.js | `getLevelTimeLimit(lv)` | Lv1: 38, 이후 65 + min(lv,14)*3 |

### 2.4 제거 블럭 수(레벨업 보조 지표)

| 항목 | 파일 | 함수/상수 | 설명 |
|------|------|-----------|------|
| 레벨당 목표 제거 수 | honeycomb-grid.js | `getRemovedToNextLevel(lv)` | Lv1:10, 2:14, 3:22, 4:30, 5+: 30+(lv-4)*8 |

(현재 게임 승패는 **다이아 수** 기준이며, 제거 수는 참고용일 수 있음.)

### 2.5 색상 수

| 항목 | 파일 | 함수/상수 | 설명 |
|------|------|-----------|------|
| 레벨별 색 수 | honeycomb-grid.js | `getColorsForLevel(lv)` | min(3+lv, 6) 단 Lv71+ 상한 7 |
| 색 팔레트 | honeycomb-state.js | `HEX_COLORS` | 7색 정의 |

### 2.6 아이템(폭탄/미사일/십자)

| 항목 | 파일 | 함수/상수 | 설명 |
|------|------|-----------|------|
| 아이템 해금 조건 | honeycomb-grid.js | `getItemThreshold()` | totalRemoved >= 2 + level*2 |
| 기본 드랍 확률 | honeycomb-state.js | `BOMB_CHANCE`, `MISSILE_CHANCE`, `CROSS_CHANCE` | 0.07, 0.05, 0.05 |
| 콤보 시 레벨 보정 | honeycomb-grid.js | `randCellNoMatch(..., allowChainMatch)` 내 `itemMult` | 콤보 시 min(1.6, 0.55 + level*0.032) |

### 2.7 연쇄(콤보) 매치

| 항목 | 파일 | 함수/상수 | 설명 |
|------|------|-----------|------|
| 연쇄 시 랜덤 매치 허용 확률 | honeycomb-grid.js | `randCellNoMatch` 내 `pool = colors` | 0.18 (높을수록 x3/x4 자주) |

### 2.8 애니메이션/연출

| 항목 | 파일 | 상수 | 설명 |
|------|------|------|------|
| 리필/제거/폭탄 등 지속 시간 | honeycomb-state.js | `REFILL_ANIM_MS`, `REMOVE_ANIM_MS` 등 | 밸런스보다 연출용 |

---

## 3. 변경 시 체크리스트

- [ ] 변경한 수식/상수가 위 표의 파일·함수와 일치하는지 확인
- [ ] Lv 1, 10, 30, 70 구간에서 한 번씩 플레이로 체감 확인
- [ ] 이 문서의 수식/숫자를 실제 코드와 동기화

---

## 4. 변경 이력 (선택)

- **그리드 레벨 70·비정사각형 테이블**: getGridSize를 (rows, cols) 조합 테이블로 변경. 4×4~10×11, 7레벨 단위. 정사각형에 얽매이지 않고 4×5, 6×7, 9×10 등 사용. 71+는 70과 동일.
  - 다이아: 필요량 `lv*1.1` → `lv*0.95`, 드랍 `0.24+lv*0.0085` → `0.26+lv*0.0075`(캡 0.48), 최소 보드 다이아 Lv 1~8:2 등으로 완만화.  
  - 시간: Lv1 35→38초, 이후 `65 + min(lv,14)*3`으로 초반 여유 확대.  
  - 아이템: 해금 `3+lv*2` → `2+lv*2`, 기본 확률 0.06/0.04/0.04 → 0.07/0.05/0.05, 콤보 보정 min(1.6, 0.55+lv*0.032).  
  - 목표: 초반 캐주얼·이탈 방지, 중반 아이템 활용 강화.
- 최초 작성: 레벨 1~10 그리드 완만화, Lv 21~100 12×12 고정 반영 기준 정리.
