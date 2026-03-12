/**
 * HoneyComb 자동 QA – 페이지 로드, DOM·레벨 파라미터, 기본 동작 검증
 * 실행: npm run qa (guess-the-number 디렉터리에서)
 */
const path = require('path');
const { pathToFileURL } = require('url');

const projectRoot = path.resolve(__dirname, '..');
const htmlPath = path.join(projectRoot, 'HoneyComb.html');
const htmlUrl = pathToFileURL(htmlPath).href;

async function runQA() {
  let playwright;
  try {
    playwright = require('playwright');
  } catch (e) {
    console.error('Playwright가 없습니다. 설치: npm install --save-dev playwright');
    process.exit(2);
  }

  const results = { pass: [], fail: [] };
  const browser = await playwright.chromium.launch({ headless: true });

  try {
    const page = await browser.newPage();

    // 콘솔 에러 수집 (치명적만)
    const consoleErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    // 1) 기본 로드
    await page.goto(htmlUrl, { waitUntil: 'networkidle', timeout: 10000 });
    await page.waitForTimeout(500);

    const canvas = await page.$('#hexCanvas');
    if (!canvas) results.fail.push('캔버스 #hexCanvas 없음');
    else results.pass.push('캔버스 로드');

    const levelEl = await page.$('#hexLevel');
    const levelText = levelEl ? await levelEl.textContent() : '';
    if (levelText.trim() !== '1') results.fail.push('레벨 표시 기대 1, 실제: ' + levelText);
    else results.pass.push('레벨 1 표시');

    const diamondsEl = await page.$('#hexDiamonds');
    const diamondsText = diamondsEl ? await diamondsEl.textContent() : '';
    if (!/^\d+\/\d+$/.test(diamondsText.trim())) results.fail.push('다이아 표시 형식 이상: ' + diamondsText);
    else results.pass.push('다이아 표시');

    const timerEl = await page.$('#hexTimer');
    if (!timerEl) results.fail.push('타이머 요소 없음');
    else results.pass.push('타이머 표시');

    if (consoleErrors.length > 0) {
      const critical = consoleErrors.filter((t) => !t.includes('audio') && !t.includes('user gesture'));
      if (critical.length > 0) results.fail.push('콘솔 에러: ' + critical.slice(0, 2).join('; '));
    }

    // 2) ?level=10 으로 새로 로드
    const level10Url = htmlUrl + (htmlUrl.includes('?') ? '&' : '?') + 'level=10';
    await page.goto(level10Url, { waitUntil: 'networkidle', timeout: 10000 });
    await page.waitForTimeout(300);

    const level10Text = await page.$eval('#hexLevel', (el) => el.textContent).catch(() => '');
    if (level10Text.trim() !== '10') results.fail.push('?level=10 기대 10, 실제: ' + level10Text);
    else results.pass.push('?level=10 적용');

    // 3) 새 게임 버튼 존재·클릭 가능
    const newGameBtn = await page.$('#newGameBtn');
    if (!newGameBtn) results.fail.push('새 게임 버튼 없음');
    else {
      await newGameBtn.click();
      await page.waitForTimeout(400);
      const levelAfter = await page.$eval('#hexLevel', (el) => el.textContent).catch(() => '');
      if (levelAfter.trim() !== '1') results.fail.push('새 게임 클릭 후 레벨 기대 1, 실제: ' + levelAfter);
      else results.pass.push('새 게임 클릭 → 레벨 1');
    }
  } finally {
    await browser.close();
  }

  return results;
}

runQA()
  .then((results) => {
    const total = results.pass.length + results.fail.length;
    console.log('\n--- HoneyComb QA ---');
    results.pass.forEach((p) => console.log('  ✓', p));
    results.fail.forEach((f) => console.log('  ✗', f));
    console.log('---');
    if (results.fail.length > 0) {
      console.log('QA 실패:', results.fail.length + '/' + total);
      process.exit(1);
    }
    console.log('QA 통과:', results.pass.length + '/' + total);
    process.exit(0);
  })
  .catch((err) => {
    console.error('QA 실행 오류:', err.message);
    process.exit(1);
  });
