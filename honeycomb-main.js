/**
 * HoneyComb – 진입점: DOM 바인딩 후 게임 시작
 */
(function (G) {
  'use strict';

  function run() {
    var canvas = document.getElementById('hexCanvas');
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    if (!ctx) return;

    G.canvas = canvas;
    G.ctx = ctx;
    G.scoreEl = document.getElementById('hexScore');
    G.levelEl = document.getElementById('hexLevel');
    G.timerEl = document.getElementById('hexTimer');
    G.timerWrap = document.getElementById('timerWrap');
    G.levelProgressEl = document.getElementById('levelProgress');
    G.diamondsEl = document.getElementById('hexDiamonds');
    G.keysEl = document.getElementById('hexKeys');
    G.keysWrap = document.getElementById('keysWrap');
    G.gameOverOverlay = document.getElementById('gameOverOverlay');
    G.gameOverRestartBtn = document.getElementById('gameOverRestartBtn');

    // 모바일 등 작은 화면에서 캔버스를 컨테이너 너비에 맞춤 → 블럭이 너무 작아지는 것 방지
    var wrap = document.querySelector('.hex-canvas-wrap');
    var availW = (wrap && wrap.offsetWidth > 0) ? wrap.offsetWidth : Math.min(400, (window.innerWidth || 400) - 24);
    G.CANVAS_WIDTH = Math.min(400, Math.max(280, availW));
    G.CANVAS_HEIGHT = Math.round(G.CANVAS_WIDTH * G.ASPECT_RATIO);
    canvas.width = G.CANVAS_WIDTH;
    canvas.height = G.CANVAS_HEIGHT;

    // QA: URL에 ?level=N 이 있으면 해당 레벨로 시작 (세션 무시, 1~100)
    // search가 비어도 href에서 파라미터 읽기 (GitHub Pages 등 일부 호스트 대응)
    var qaLevel = null;
    var search = window.location.search || '';
    if (!search && window.location.href) search = '?' + (window.location.href.split('?')[1] || '');
    var match = /[?&]level=(\d+)/.exec(search);
    if (match) {
      var n = parseInt(match[1], 10);
      if (n >= 1 && n <= 100) qaLevel = n;
    }
    if (qaLevel != null) {
      if (typeof G.clearSession === 'function') G.clearSession();
      G.level = qaLevel;
      G.score = 0;
      G.totalRemoved = 0;
      G.removedThisLevel = 0;
      G.diamondsRemovedThisLevel = 0;
      G.keysCollectedThisLevel = 0;
      if (G.levelEl) G.levelEl.textContent = G.level;
      var need = typeof G.getDiamondsToNextLevel === 'function' ? G.getDiamondsToNextLevel(G.level) : 3;
      if (G.diamondsEl) G.diamondsEl.textContent = '0/' + need;
      if (G.keysEl && typeof G.getKeysRequiredForLevel === 'function') {
        var kn = G.getKeysRequiredForLevel(G.level);
        if (kn <= 0 && G.keysWrap) G.keysWrap.style.display = 'none';
        else if (G.keysWrap && G.keysEl) { G.keysWrap.style.display = ''; G.keysEl.textContent = '0/' + kn; }
      }
      if (G.timerEl) G.timerEl.textContent = typeof G.getLevelTimeLimit === 'function' ? G.getLevelTimeLimit(G.level) : 30;
      if (G.scoreEl) G.scoreEl.textContent = '0';
      if (G.timerWrap) G.timerWrap.classList.remove('warning', 'danger');
    }

    // 세션 복구(가능하면 이어하기), QA 레벨이 없을 때만
    var restored = false;
    if (qaLevel == null && typeof G.loadSession === 'function') restored = G.loadSession();
    var savedRows = G.ROWS;
    var savedCols = G.COLS;
    // 복구한 경우 저장된 그리드 크기 유지하며 레이아웃만 재계산(캔버스 크기 반영)
    if (restored) {
      G.applyGridSize(savedRows, savedCols);
    } else {
      G.applyGridSize();
    }
    if (restored && (G.ROWS !== savedRows || G.COLS !== savedCols)) G.initGrid();
    if (!restored) {
      G.initGrid();
    }
    // 맞출 수 없으면 자동으로 다시 배치(리셔플)
    if (typeof G.ensurePlayableBoard === 'function') G.ensurePlayableBoard();
    G.updateProgressBar();
    G.startLevelTimer();
    if (qaLevel != null) {
      if (G.levelEl) G.levelEl.textContent = G.level;
      if (G.timerEl) G.timerEl.textContent = G.getLevelTimeLimit(G.level);
      if (G.diamondsEl) G.diamondsEl.textContent = G.diamondsRemovedThisLevel + '/' + G.getDiamondsToNextLevel(G.level);
      if (G.keysEl && typeof G.getKeysRequiredForLevel === 'function') {
        var kn = G.getKeysRequiredForLevel(G.level);
        if (kn <= 0 && G.keysWrap) G.keysWrap.style.display = 'none';
        else if (G.keysWrap && G.keysEl) { G.keysWrap.style.display = ''; G.keysEl.textContent = G.keysCollectedThisLevel + '/' + kn; }
      }
      if (G.timerWrap) G.timerWrap.classList.remove('warning', 'danger');
    }
    G.draw();
    G.attachInput();

    var newGameBtn = document.getElementById('newGameBtn');
    if (newGameBtn && typeof G.restartFromBeginning === 'function') {
      function doNewGame(e) {
        if (e) { e.preventDefault(); e.stopPropagation(); }
        G.restartFromBeginning();
      }
      newGameBtn.addEventListener('click', doNewGame);
      newGameBtn.addEventListener('touchend', function (e) {
        e.preventDefault();
        e.stopPropagation();
        G.restartFromBeginning();
      }, { passive: false });
    }

    // 리사이즈 시 캔버스·그리드 다시 맞춤 (모바일 회전 등)
    function resizeCanvas() {
      var w = (wrap && wrap.offsetWidth > 0) ? wrap.offsetWidth : Math.min(400, (window.innerWidth || 400) - 24);
      w = Math.min(400, Math.max(280, w));
      if (w === G.CANVAS_WIDTH) return;
      G.CANVAS_WIDTH = w;
      canvas.width = G.CANVAS_WIDTH;
      G.applyGridSize(); // CANVAS_HEIGHT와 canvas.height는 applyGridSize에서 자동 계산
      G.draw();
    }
    window.addEventListener('resize', resizeCanvas);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
})(window.HoneyComb = window.HoneyComb || {});
