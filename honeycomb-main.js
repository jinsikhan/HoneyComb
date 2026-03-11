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
    G.gameOverOverlay = document.getElementById('gameOverOverlay');
    G.gameOverRestartBtn = document.getElementById('gameOverRestartBtn');

    // 모바일 등 작은 화면에서 캔버스를 컨테이너 너비에 맞춤 → 블럭이 너무 작아지는 것 방지
    var wrap = document.querySelector('.hex-canvas-wrap');
    var availW = (wrap && wrap.offsetWidth > 0) ? wrap.offsetWidth : Math.min(400, (window.innerWidth || 400) - 24);
    G.CANVAS_WIDTH = Math.min(400, Math.max(280, availW));
    G.CANVAS_HEIGHT = Math.round(G.CANVAS_WIDTH * G.ASPECT_RATIO);
    canvas.width = G.CANVAS_WIDTH;
    canvas.height = G.CANVAS_HEIGHT;

    // 세션 복구(가능하면 이어하기), 실패하면 새로 시작
    var restored = false;
    if (typeof G.loadSession === 'function') restored = G.loadSession();
    var savedRows = G.ROWS;
    var savedCols = G.COLS;
    G.applyGridSize();
    if (restored && (G.ROWS !== savedRows || G.COLS !== savedCols)) G.initGrid();
    if (!restored) {
      G.initGrid();
    }
    G.updateProgressBar();
    G.startLevelTimer();
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
      G.CANVAS_HEIGHT = Math.round(w * G.ASPECT_RATIO);
      canvas.width = G.CANVAS_WIDTH;
      canvas.height = G.CANVAS_HEIGHT;
      G.applyGridSize();
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
