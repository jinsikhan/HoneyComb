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

    G.CANVAS_HEIGHT = Math.round(G.CANVAS_WIDTH * G.ASPECT_RATIO);
    canvas.width = G.CANVAS_WIDTH;
    canvas.height = G.CANVAS_HEIGHT;

    // 세션 복구(가능하면 이어하기), 실패하면 새로 시작
    var restored = false;
    if (typeof G.loadSession === 'function') restored = G.loadSession();
    if (!restored) {
      G.applyGridSize();
      G.initGrid();
      G.updateProgressBar();
    }
    G.startLevelTimer();
    G.draw();
    G.attachInput();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
})(window.HoneyComb = window.HoneyComb || {});
