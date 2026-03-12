/**
 * HoneyComb – 공용 상태 객체와 그리드 기본 함수 (id, get, set, neighbors)
 */
(function (G) {
  'use strict';

  G.CANVAS_WIDTH = 400;
  G.ASPECT_RATIO = 1.4;
  G.CANVAS_HEIGHT = Math.round(G.CANVAS_WIDTH * G.ASPECT_RATIO);
  G.R = 28;
  G.GAP = 5;
  G.COLS = 5;
  G.ROWS = 5;
  G.HEX_W = 2 * G.R;
  G.HEX_H = Math.sqrt(3) * G.R;
  G.STEP_X = 0;
  G.STEP_Y = 0;
  G.gridOffsetX = 0;
  G.gridOffsetY = 0;
  G.gridScale = 1;
  // 기본 6색 + (Lv.71+) 7번째 색 추가 (블루와 확실히 구분되도록 핑크 계열)
  G.HEX_COLORS = ['#e74c3c', '#f1c40f', '#2ecc71', '#3498db', '#9b59b6', '#e67e22', '#ec4899'];
  G.POINTS_PER_LEVEL = 450;
  G.BOMB_CHANCE = 0.07;
  G.MISSILE_CHANCE = 0.05;
  G.CROSS_CHANCE = 0.05;
  G.REFILL_ANIM_MS = 880;
  G.REMOVE_ANIM_MS = 420;
  G.BOMB_ANIM_MS = 520;
  G.MISSILE_ANIM_MS = 400;
  G.CROSS_ANIM_MS = 450;
  G.MATCH_DELAY_MS = 500;
  G.CHAIN_PAUSE_AFTER_REFILL_MS = 280;
  // 연쇄 상한(표시/연출용). 실제 연쇄 확률은 리필 로직에서 결정.
  G.MAX_CHAIN_COMBO = 4;
  G.BURST_PARTICLE_LIFE_MS = 480;
  G.LEVEL_UP_DURATION_MS = 1800;
  G.SWAP_ANIM_DURATION_MS = 220;

  G.canvas = null;
  G.ctx = null;
  G.scoreEl = null;
  G.levelEl = null;
  G.timerEl = null;
  G.timerWrap = null;
  G.levelProgressEl = null;
  G.diamondsEl = null;
  G.gameOverOverlay = null;
  G.gameOverRestartBtn = null;

  G.grid = [];
  G.score = 0;
  G.level = 1;
  /** 육각형 보드 반경(0이면 직사각형 전체 사용). applyGridSize에서 설정 */
  G.hexRadius = 0;
  /** 보드 중간 빈 슬롯(구멍). initGrid에서 레벨에 따라 설정. "r,c" -> true */
  G.holes = {};
  G.totalRemoved = 0;
  G.removedThisLevel = 0;
  G.diamondsRemovedThisLevel = 0;
  /** 레벨업에 필요한 열쇠(이 레벨에서 수집한 수) */
  G.keysCollectedThisLevel = 0;
  G.comboCount = 0;
  G.itemsUnlocked = false;

  G.selected = [];
  G.strokeColor = null;
  G.isDragging = false;
  G.pointerDownCell = null;
  G.swapFirst = null;

  G.hexAnim = null;
  G.hexAnimIntervalId = null;
  G.refillAnim = null;
  G.removeAnim = null;
  G.matchDelayUntil = 0;
  G.matchDelayTimerId = null;
  G.chainInProgress = false;
  G.chainStepTimerId = null;
  G.chainStartTime = 0;
  G.scorePopups = [];
  G.bigTextUntil = 0;
  G.bigText = '';
  G.comboShowUntil = 0;
  G.comboText = '';
  G.badgeUntil = 0;
  G.badgeText = '';
  G.pendingLevelUp = false;
  G.badgeParticles = [];
  G.burstParticles = [];
  G.matchFlashUntil = 0;
  G.levelUpUntil = 0;
  G.levelUpStartTime = 0;

  G.audioCtx = null;
  G.audioReady = false;
  G.audioResumePromise = null;
  G.matchAudio = null;
  G.comboAudio = null;
  G.levelupAudio = null;
  G.bombAudio = null;
  G.itemAudio = null;
  G.bgmGainNode = null;
  G.bgmOsc = null;
  G.bgmInterval = null;

  G.swapAnim = null;
  G.levelStartTime = 0;
  G.levelTimeLimitSec = 30;
  G.gameOver = false;
  G.gameOverUntil = 0;
  G.timerIntervalId = null;
  G.timerGeneration = 0;
  G.lastKnownTimeLeft = 999;

  G.id = function (r, c) { return r * G.COLS + c; };
  /** 육각형 보드: 중심에서 육각 거리(hex radius) 이내만 유효. 직사각형이 아닌 육각형 실루엣. */
  G.inBounds = function (r, c) {
    if (r < 0 || r >= G.ROWS || c < 0 || c >= G.COLS) return false;
    if (G.hexRadius == null || G.hexRadius <= 0) return true;
    var cr = Math.floor(G.ROWS / 2), cc = Math.floor(G.COLS / 2);
    var q = c, r_ax = r - Math.floor((c - (c & 1)) / 2);
    var q0 = cc, r0 = cr - Math.floor((cc - (cc & 1)) / 2);
    var x = q, z = r_ax, y = -x - z;
    var x0 = q0, z0 = r0, y0 = -x0 - z0;
    var dist = (Math.abs(x - x0) + Math.abs(y - y0) + Math.abs(z - z0)) / 2;
    return dist <= G.hexRadius;
  };
  G.neighbors = function (r, c) {
    var dcEven = [-1, 0, -1, 1, -1, 0], dcOdd = [0, 1, -1, 1, 0, 1], dr = [-1, -1, 0, 0, 1, 1];
    var dc = (r % 2 === 0) ? dcEven : dcOdd;
    var out = [];
    for (var i = 0; i < 6; i++) {
      var nr = r + dr[i], nc = c + dc[i];
      if (G.inBounds(nr, nc)) out.push({ r: nr, c: nc });
    }
    return out;
  };
  G.get = function (r, c) { if (!G.inBounds(r, c) || G.holes[r + ',' + c]) return null; return G.grid[G.id(r, c)]; };
  G.set = function (r, c, cell) { if (!G.inBounds(r, c) || G.holes[r + ',' + c]) return; G.grid[G.id(r, c)] = cell; };
})(window.HoneyComb = window.HoneyComb || {});
