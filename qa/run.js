/**
 * HoneyComb 자동 QA
 * 실행: npm run qa (guess-the-number 디렉터리에서)
 *
 * 검사 항목:
 *  A. 페이지 로드 / UI 기본 요소
 *  B. 그리드 상태 (빈칸/null 없음, 크기 일치)
 *  C. 보드 플레이 가능 (유효 수 존재)
 *  D. ?level=N 파라미터
 *  E. 새 게임 버튼
 *  F. 블록 스왑 → 매치 → 리필 흐름
 *  G. 아이템 사용 후 상태 유지 (미사일/폭탄 강제 주입)
 *  H. 세션 저장/복구
 *  I. 맞출 수 없을 때 자동 리셔플
 *  J. 콘솔 에러 없음
 *  K. 인접 구멍(hole) 해제 검증
 */
const path = require('path');
const { pathToFileURL } = require('url');

const projectRoot = path.resolve(__dirname, '..');
const htmlPath = path.join(projectRoot, 'HoneyComb.html');
const htmlUrl = pathToFileURL(htmlPath).href;

function levelUrl(n) {
  return htmlUrl + '?level=' + n;
}

async function runQA() {
  let playwright;
  try {
    playwright = require('playwright');
  } catch (e) {
    console.error('Playwright가 없습니다. 설치: npm install --save-dev playwright');
    process.exit(2);
  }

  const results = { pass: [], fail: [] };
  function pass(msg) { results.pass.push(msg); }
  function fail(msg) { results.fail.push(msg); }

  const browser = await playwright.chromium.launch({ headless: true });

  try {
    // ── 공통 헬퍼 ──────────────────────────────────────────────────────────
    async function freshPage(url) {
      const p = await browser.newPage();
      const errs = [];
      p.on('console', (msg) => {
        if (msg.type() === 'error') errs.push(msg.text());
      });
      await p.goto(url || htmlUrl, { waitUntil: 'networkidle', timeout: 12000 });
      await p.waitForTimeout(600);
      return { page: p, errs };
    }

    // G(HoneyComb) 상태 읽기
    function getG(page) {
      return page.evaluate(() => {
        const G = window.HoneyComb;
        if (!G) return null;
        return {
          level: G.level,
          score: G.score,
          rows: G.ROWS,
          cols: G.COLS,
          gridLen: G.grid ? G.grid.length : -1,
          gameOver: G.gameOver,
          chainInProgress: G.chainInProgress,
          hexAnim: !!G.hexAnim,
          hexAnimId: G.hexAnimIntervalId,
          refillAnim: !!G.refillAnim,
          removeAnim: !!G.removeAnim,
          nullCells: (() => {
            if (!G.grid || !G.ROWS || !G.COLS) return -1;
            let n = 0;
            for (let r = 0; r < G.ROWS; r++)
              for (let c = 0; c < G.COLS; c++) {
                if (!G.inBounds(r, c)) continue;
                if (G.isHole(r, c)) continue;
                if (!G.get(r, c)) n++;
              }
            return n;
          })(),
          hasValidMove: typeof G.hasValidMove === 'function' ? G.hasValidMove() : null,
        };
      });
    }

    // ── A. 페이지 로드 / UI 요소 ────────────────────────────────────────────
    console.log('\n[A] 페이지 로드 / UI 요소');
    {
      const { page, errs } = await freshPage();
      const canvas = await page.$('#hexCanvas');
      canvas ? pass('캔버스 #hexCanvas 존재') : fail('캔버스 #hexCanvas 없음');

      for (const id of ['hexLevel', 'hexDiamonds', 'hexScore', 'hexTimer', 'newGameBtn']) {
        (await page.$(id ? '#' + id : id))
          ? pass(id + ' 요소 존재')
          : fail(id + ' 요소 없음');
      }

      const lvText = await page.$eval('#hexLevel', el => el.textContent).catch(() => '');
      lvText.trim() === '1' ? pass('Lv.1 표시') : fail('Lv 표시 이상: ' + lvText);

      const dmText = await page.$eval('#hexDiamonds', el => el.textContent).catch(() => '');
      /^\d+\/\d+$/.test(dmText.trim()) ? pass('다이아 N/N 형식') : fail('다이아 형식 이상: ' + dmText);

      const timerVal = await page.$eval('#hexTimer', el => parseInt(el.textContent, 10)).catch(() => -1);
      timerVal > 0 ? pass('타이머 > 0') : fail('타이머 이상: ' + timerVal);

      const critical = errs.filter(t => !t.includes('audio') && !t.includes('user gesture') && !t.includes('favicon'));
      critical.length === 0 ? pass('콘솔 에러 없음(로드)') : fail('콘솔 에러: ' + critical.slice(0, 2).join('; '));
      await page.close();
    }

    // ── B. 그리드 상태 (빈칸/크기) ──────────────────────────────────────────
    console.log('\n[B] 그리드 상태 검증');
    {
      const { page } = await freshPage();
      const g = await getG(page);
      if (!g) { fail('HoneyComb 객체 없음'); }
      else {
        g.gridLen === g.rows * g.cols
          ? pass('grid.length = ROWS*COLS (' + g.rows + '×' + g.cols + ')')
          : fail('grid 크기 불일치: ' + g.gridLen + ' != ' + g.rows + '*' + g.cols);

        g.nullCells === 0
          ? pass('빈칸(null) 0개')
          : fail('빈칸(null) ' + g.nullCells + '개 존재');

        g.hasValidMove === true
          ? pass('보드 유효 수 존재')
          : fail('보드에 유효 수 없음 (hasValidMove=false)');
      }
      await page.close();
    }

    // ── C. 레벨별 그리드 크기 단계 (5레벨마다 증가) ─────────────────────────
    console.log('\n[C] 레벨별 그리드 크기 검증');
    // steps[i] = floor((lv-1)/5), 0~13
    // 0:4×5, 1:5×5, 2:5×6, 3:6×6, 4:6×7, 5:7×7, 6:7×8, 7:8×8,
    // 8:8×9, 9:9×9, 10:9×10, 11:10×10, 12:10×11, 13:11×11
    const expectedSizes = {
      1:  { rows: 4, cols: 5 },   // step 0
      6:  { rows: 5, cols: 5 },   // step 1
      11: { rows: 5, cols: 6 },   // step 2
      16: { rows: 6, cols: 6 },   // step 3
      21: { rows: 6, cols: 7 },   // step 4
      31: { rows: 7, cols: 8 },   // step 6
      41: { rows: 8, cols: 9 },   // step 8 (41-1)/5=8
      51: { rows: 9, cols: 9 },   // step 10
    };
    for (const [lv, expected] of Object.entries(expectedSizes)) {
      const { page } = await freshPage(levelUrl(lv));
      const g = await getG(page);
      if (!g) { fail('Lv' + lv + ' G 없음'); }
      else if (g.rows === expected.rows && g.cols === expected.cols) {
        pass('Lv' + lv + ' 그리드 ' + g.rows + '×' + g.cols);
      } else {
        fail('Lv' + lv + ' 그리드 기대 ' + expected.rows + '×' + expected.cols + ', 실제 ' + g.rows + '×' + g.cols);
      }
      await page.close();
    }

    // ── D. ?level=N 파라미터 ─────────────────────────────────────────────────
    console.log('\n[D] ?level=N 파라미터');
    for (const lv of [1, 10, 20, 50]) {
      const { page } = await freshPage(levelUrl(lv));
      const lvText = await page.$eval('#hexLevel', el => el.textContent).catch(() => '');
      lvText.trim() === String(lv)
        ? pass('?level=' + lv + ' 적용')
        : fail('?level=' + lv + ' 기대 ' + lv + ', 실제 ' + lvText);
      await page.close();
    }

    // ── E. 새 게임 버튼 ──────────────────────────────────────────────────────
    console.log('\n[E] 새 게임 버튼');
    {
      const { page } = await freshPage(levelUrl(15));
      await page.$eval('#newGameBtn', el => el.click());
      await page.waitForTimeout(600);
      const lvAfter = await page.$eval('#hexLevel', el => el.textContent).catch(() => '');
      lvAfter.trim() === '1' ? pass('새 게임 → Lv.1 리셋') : fail('새 게임 후 레벨 이상: ' + lvAfter);
      const g = await getG(page);
      g && g.nullCells === 0 ? pass('새 게임 후 빈칸 없음') : fail('새 게임 후 빈칸 ' + (g ? g.nullCells : '?') + '개');
      await page.close();
    }

    // ── F. 스왑 → 매치 → 리필 흐름 ─────────────────────────────────────────
    console.log('\n[F] 스왑/매치/리필 흐름');
    {
      const { page } = await freshPage();
      // 강제로 3매치 가능한 보드 세팅 후 doSwapAndCheck 호출
      const swapped = await page.evaluate(() => {
        const G = window.HoneyComb;
        if (!G || !G.ROWS) return false;
        // 1행 전체를 한 색으로, 2행 0번 셀만 다른 색으로 → 1행0·1행1·1행2 swap 시 match
        const C = G.HEX_COLORS[0], D = G.HEX_COLORS[1];
        for (let c = 0; c < G.COLS; c++) {
          const cell = G.get(0, c);
          if (cell) G.set(0, c, Object.assign({}, cell, { color: C, bomb: false, missile: false, cross: false }));
        }
        const cell01 = G.get(0, 1);
        if (cell01) G.set(0, 1, Object.assign({}, cell01, { color: D }));
        // swap 0,0 ↔ 0,1 → 매치 판단
        G.doSwapAndCheck(0, 0, 0, 1);
        return true;
      });
      swapped ? pass('doSwapAndCheck 호출 성공') : fail('doSwapAndCheck 호출 실패');
      // 리필 애니 끝날 때까지 대기
      await page.waitForTimeout(2200);
      const gAfter = await getG(page);
      gAfter && gAfter.nullCells === 0
        ? pass('스왑/매치 후 빈칸 없음')
        : fail('스왑/매치 후 빈칸 ' + (gAfter ? gAfter.nullCells : '?') + '개');
      gAfter && !gAfter.chainInProgress
        ? pass('스왑/매치 후 chainInProgress=false')
        : fail('스왑/매치 후 연쇄 미종료 (chainInProgress=true)');
      await page.close();
    }

    // ── G. 아이템(미사일) 사용 후 상태 ─────────────────────────────────────
    console.log('\n[G] 아이템(미사일) 사용 후 상태');
    {
      const { page } = await freshPage();
      const triggered = await page.evaluate(() => {
        const G = window.HoneyComb;
        if (!G || !G.ROWS || G.ROWS < 3) return 'skip';
        // 중간 행 중간 열에 미사일 블럭 강제 배치
        const mr = Math.floor(G.ROWS / 2);
        const mc = Math.floor(G.COLS / 2);
        const C = G.HEX_COLORS[0];
        // 미사일 칸 + 양옆 2칸을 같은 색으로 → findGroup이 3개 이상 연결
        const positions = [];
        for (let c = 0; c < G.COLS; c++) {
          const cell = G.get(mr, c);
          if (cell) {
            const isMissile = (c === mc);
            G.set(mr, c, { color: C, bomb: false, missile: isMissile, cross: false, diamond: false, key: false });
            positions.push({ r: mr, c: c });
          }
        }
        if (positions.length < 3) return 'skip';
        G.itemsUnlocked = true;
        G.chainInProgress = false;
        G.comboCount = 0;
        // applyRemove 호출
        try {
          G.applyRemove(positions.slice(0, 3), false);
          return 'ok';
        } catch (e) {
          return 'error:' + e.message;
        }
      });
      if (triggered === 'skip') {
        pass('미사일 테스트 건너뜀(그리드 너무 작음)');
      } else if (triggered === 'ok') {
        pass('미사일 applyRemove 호출 성공');
        await page.waitForTimeout(2500);
        const g = await getG(page);
        g && !g.hexAnim ? pass('미사일 애니 종료') : fail('미사일 애니 미종료(hexAnim 남음)');
        g && !g.chainInProgress ? pass('미사일 후 chain 종료') : fail('미사일 후 chain 미종료');
        g && g.nullCells === 0 ? pass('미사일 후 빈칸 없음') : fail('미사일 후 빈칸 ' + (g ? g.nullCells : '?') + '개');
      } else {
        fail('미사일 applyRemove 오류: ' + triggered);
      }
      await page.close();
    }

    // ── H. 세션 저장/복구 ────────────────────────────────────────────────────
    // file:// 프로토콜에서는 페이지 간 localStorage를 공유하려면 같은 browserContext 필요.
    // 1) 첫 페이지에서 saveSession → localStorage에 저장
    // 2) 같은 context에서 새 페이지 열어 복구 확인
    console.log('\n[H] 세션 저장/복구');
    {
      const ctx = await browser.newContext();
      const p1 = await ctx.newPage();
      await p1.goto(levelUrl(5), { waitUntil: 'networkidle', timeout: 12000 });
      await p1.waitForTimeout(500);

      const savedScore = await p1.evaluate(() => {
        const G = window.HoneyComb;
        G.score = 12345;
        if (G.scoreEl) G.scoreEl.textContent = G.score;
        G.saveSession(true);
        return G.score;
      });
      savedScore === 12345 ? pass('세션 저장(score=12345)') : fail('세션 저장 실패');
      await p1.close();

      const p2 = await ctx.newPage();
      await p2.goto(htmlUrl, { waitUntil: 'networkidle', timeout: 12000 });
      await p2.waitForTimeout(600);

      const restoredScore = await p2.evaluate(() => {
        const G = window.HoneyComb;
        return G ? G.score : -1;
      });
      restoredScore === 12345
        ? pass('세션 복구 성공(score=' + restoredScore + ')')
        : fail('세션 복구 실패(score=' + restoredScore + ')');

      const gRestored = await getG(p2);
      gRestored && gRestored.nullCells === 0
        ? pass('세션 복구 후 빈칸 없음')
        : fail('세션 복구 후 빈칸 ' + (gRestored ? gRestored.nullCells : '?') + '개');
      gRestored && gRestored.hasValidMove
        ? pass('세션 복구 후 유효 수 존재')
        : fail('세션 복구 후 유효 수 없음');
      await p2.close();
      await ctx.close();
    }

    // ── I. 맞출 수 없을 때 자동 리셔플 ─────────────────────────────────────
    console.log('\n[I] 맞출 수 없을 때 자동 리셔플');
    {
      const { page } = await freshPage();
      const reshuffled = await page.evaluate(() => {
        const G = window.HoneyComb;
        if (!G || !G.ROWS) return false;
        // 모든 칸을 교대 2색으로 채워 스왑해도 3매치 불가 상태 만들기
        const colors = G.HEX_COLORS;
        for (let r = 0; r < G.ROWS; r++)
          for (let c = 0; c < G.COLS; c++) {
            const cell = G.get(r, c);
            if (!cell) continue;
            G.set(r, c, { color: colors[(r + c) % 2], bomb: false, missile: false, cross: false, diamond: false, key: false });
          }
        const before = G.hasValidMove();
        G.ensurePlayableBoard();
        const after = G.hasValidMove();
        return { before, after };
      });
      if (!reshuffled) {
        fail('리셔플 테스트 실행 실패');
      } else {
        !reshuffled.before ? pass('강제 불가 상태 만들기 성공') : pass('(이미 유효 수 있음 – 리셔플 생략됨)');
        reshuffled.after ? pass('리셔플 후 유효 수 생성') : fail('리셔플 후에도 유효 수 없음');
        const g = await getG(page);
        g && g.nullCells === 0 ? pass('리셔플 후 빈칸 없음') : fail('리셔플 후 빈칸 ' + (g ? g.nullCells : '?') + '개');
      }
      await page.close();
    }

    // ── K. 인접 구멍(hole) 해제 검증 ─────────────────────────────────────────
    console.log('\n[K] 인접 구멍 해제');
    {
      // Lv.20: 구멍이 1개 생기는 레벨
      const { page } = await freshPage(levelUrl(20));
      const result = await page.evaluate(() => {
        const G = window.HoneyComb;
        if (!G || !G.ROWS) return null;
        // 구멍 없으면 강제로 1개 만들기
        const holesBefore = Object.keys(G.holes).length;
        if (holesBefore === 0) {
          for (let r = 0; r < G.ROWS; r++) {
            for (let c = 0; c < G.COLS; c++) {
              if (G.inBounds(r, c) && G.get(r, c)) {
                G.holes[r + ',' + c] = true;
                G.grid[G.id(r, c)] = null;
                // 구멍 이웃 중 유효 칸 찾기
                const nbs = G.neighbors(r, c).filter(n => G.get(n.r, n.c));
                if (nbs.length >= 2) {
                  const holeKey = r + ',' + c;
                  // 이웃 제거 → refillOnlyRemoved 직접 호출
                  G.refillOnlyRemoved(nbs.slice(0, 2), false);
                  const holesAfter = Object.keys(G.holes).length;
                  const wasUnlocked = !G.holes[holeKey];
                  return { holesBefore: 1, holesAfter, wasUnlocked, cellFilled: !!G.get(r, c) };
                }
              }
            }
          }
          return { skipped: true };
        }
        // 기존 구멍이 있을 때
        const holeKey = Object.keys(G.holes)[0];
        const [hr, hc] = holeKey.split(',').map(Number);
        const nbs = G.neighbors(hr, hc).filter(n => G.get(n.r, n.c));
        if (nbs.length === 0) return { skipped: true };
        G.refillOnlyRemoved(nbs.slice(0, Math.min(2, nbs.length)), false);
        const holesAfter = Object.keys(G.holes).length;
        const wasUnlocked = !G.holes[holeKey];
        return { holesBefore, holesAfter, wasUnlocked, cellFilled: !!G.get(hr, hc) };
      });
      if (!result || result.skipped) {
        pass('구멍 해제 테스트 건너뜀(조건 미충족)');
      } else {
        result.wasUnlocked ? pass('구멍 해제됨(holes 삭제 확인)') : fail('구멍 해제 안됨');
        result.cellFilled ? pass('해제된 구멍에 블럭 채워짐') : fail('해제된 구멍 빈칸 그대로');
        result.holesAfter < result.holesBefore ? pass('holes 개수 감소') : fail('holes 개수 변화 없음');
      }
      await page.close();
    }

    // ── J. 콘솔 에러(여러 레벨에서) ─────────────────────────────────────────
    console.log('\n[J] 콘솔 에러 (레벨 1·15·30·50)');
    for (const lv of [1, 15, 30, 50]) {
      const { page, errs } = await freshPage(levelUrl(lv));
      await page.waitForTimeout(400);
      const critical = errs.filter(t => !t.includes('audio') && !t.includes('user gesture') && !t.includes('favicon'));
      critical.length === 0
        ? pass('Lv' + lv + ' 콘솔 에러 없음')
        : fail('Lv' + lv + ' 콘솔 에러: ' + critical.slice(0, 2).join('; '));
      await page.close();
    }

  } finally {
    await browser.close();
  }

  return results;
}

runQA()
  .then((results) => {
    const total = results.pass.length + results.fail.length;
    console.log('\n══════════════════════════════');
    console.log('  HoneyComb QA 결과');
    console.log('══════════════════════════════');
    results.pass.forEach((p) => console.log('  ✓', p));
    if (results.fail.length > 0) {
      console.log('');
      results.fail.forEach((f) => console.log('  ✗', f));
    }
    console.log('──────────────────────────────');
    if (results.fail.length > 0) {
      console.log('  QA 실패: ' + results.fail.length + '/' + total);
      process.exit(1);
    }
    console.log('  QA 통과: ' + results.pass.length + '/' + total);
    process.exit(0);
  })
  .catch((err) => {
    console.error('QA 실행 오류:', err.message);
    process.exit(1);
  });
