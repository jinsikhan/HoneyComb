/**
 * HoneyComb – 세션 저장/복구 (localStorage)
 * - 새로고침/탭 복구 후에도 최근 진행(레벨/점수/보드/남은시간)을 이어서 플레이
 */
(function (G) {
  'use strict';

  var STORAGE_KEY = 'honeycomb_session_v1';
  var MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24h
  var SAVE_THROTTLE_MS = 1000;
  var lastSaveAt = 0;

  function nowMs() { return Date.now(); }

  function safeJsonParse(s) {
    try { return JSON.parse(s); } catch (e) { return null; }
  }

  function calcTimeLeftSec() {
    if (!G.levelStartTime || !G.levelTimeLimitSec) return null;
    var elapsed = (nowMs() - G.levelStartTime) / 1000;
    return Math.max(0, Math.ceil(G.levelTimeLimitSec - elapsed));
  }

  G.saveSession = function (force) {
    try {
      var t = nowMs();
      if (!force && t - lastSaveAt < SAVE_THROTTLE_MS) return;
      lastSaveAt = t;

      var timeLeft = calcTimeLeftSec();
      var payload = {
        v: 1,
        savedAt: t,
        level: G.level,
        score: G.score,
        totalRemoved: G.totalRemoved,
        removedThisLevel: G.removedThisLevel,
        diamondsRemovedThisLevel: G.diamondsRemovedThisLevel,
        itemsUnlocked: !!G.itemsUnlocked,
        rows: G.ROWS,
        cols: G.COLS,
        grid: G.grid,
        timeLeftSec: timeLeft,
        // 오버레이/애니메이션/입력 상태는 복구하지 않음(복구 시 깨끗한 상태로 시작)
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (e) {}
  };

  G.clearSession = function () {
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
  };

  G.loadSession = function () {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      var data = safeJsonParse(raw);
      if (!data || data.v !== 1 || !data.savedAt) return false;
      if (nowMs() - data.savedAt > MAX_AGE_MS) return false;

      // 기본 값 검증
      if (!data.level || !data.rows || !data.cols || !data.grid) return false;
      if (data.grid.length !== data.rows * data.cols) return false;

      // 상태 적용
      G.level = data.level;
      G.score = data.score || 0;
      G.totalRemoved = data.totalRemoved || 0;
      G.removedThisLevel = data.removedThisLevel || 0;
      G.diamondsRemovedThisLevel = data.diamondsRemovedThisLevel || 0;
      G.itemsUnlocked = !!data.itemsUnlocked;

      // 레벨 기반으로 그리드 스케일/오프셋 재계산 후 그리드 적용
      G.applyGridSize();
      G.grid = data.grid;

      // UI 반영
      if (G.scoreEl) G.scoreEl.textContent = G.score;
      if (G.levelEl) G.levelEl.textContent = G.level;
      G.updateProgressBar();

      // 타이머 복구: 남은 시간 기준으로 levelStartTime 역산
      var limit = G.getLevelTimeLimit(G.level);
      var left = (typeof data.timeLeftSec === 'number' && isFinite(data.timeLeftSec)) ? data.timeLeftSec : null;
      if (left == null) left = limit;
      left = Math.max(0, Math.min(limit, Math.round(left)));
      G.levelTimeLimitSec = limit;
      G.levelStartTime = nowMs() - (limit - left) * 1000;
      G.lastKnownTimeLeft = left;
      if (G.timerEl) G.timerEl.textContent = left;
      if (G.timerWrap) G.timerWrap.classList.remove('warning', 'danger');

      // 오버레이/진행 중 상태 정리
      G.gameOver = false;
      if (G.gameOverOverlay) G.gameOverOverlay.setAttribute('hidden', '');
      G.pendingLevelUp = false;
      G.missionCompleteUntil = 0;
      G.missionCompleteText = '';
      G.chainInProgress = false;
      if (G.chainStepTimerId) clearTimeout(G.chainStepTimerId);
      G.chainStepTimerId = null;
      if (G.hexAnimIntervalId) clearInterval(G.hexAnimIntervalId);
      G.hexAnimIntervalId = null;
      G.hexAnim = null;
      G.swapAnim = null;
      G.refillAnim = null;
      G.removeAnim = null;
      G.matchDelayUntil = 0;
      if (G.matchDelayTimerId) clearTimeout(G.matchDelayTimerId);
      G.matchDelayTimerId = null;
      G.resetInputState();

      return true;
    } catch (e) {
      return false;
    }
  };
})(window.HoneyComb = window.HoneyComb || {});

