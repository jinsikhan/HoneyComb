/**
 * HoneyComb – 게임 로직 (타이머, 콤보, 스왑, 제거, 레벨업, 재시작)
 */
(function (G) {
  'use strict';

  G.getComboLabel = function (count) {
    if (count <= 1) return '';
    if (count === 2) return '2연쇄 콤보! (더블)';
    if (count === 3) return '3연쇄 콤보! (트리플)';
    return count + '연쇄 콤보! (익사이팅)';
  };

  G.updateProgressBar = function () {
    if (!G.levelProgressEl) return;
    var need = G.getDiamondsToNextLevel(G.level);
    var pct = need > 0 ? Math.min(100, (G.diamondsRemovedThisLevel / need) * 100) : 100;
    G.levelProgressEl.style.width = pct + '%';
    if (G.diamondsEl) G.diamondsEl.textContent = G.diamondsRemovedThisLevel + '/' + need;
  };

  G.startLevelTimer = function () {
    if (G.timerIntervalId) clearInterval(G.timerIntervalId);
    G.timerIntervalId = null;
    G.timerGeneration++;
    var generation = G.timerGeneration;
    G.levelStartTime = Date.now();
    G.levelTimeLimitSec = G.getLevelTimeLimit(G.level);
    G.timerIntervalId = setInterval(function () {
      if (generation !== G.timerGeneration) return;
      if (G.gameOver) return;
      var elapsed = (Date.now() - G.levelStartTime) / 1000;
      var left = Math.max(0, Math.ceil(G.levelTimeLimitSec - elapsed));
      G.lastKnownTimeLeft = left;
      if (G.timerEl) G.timerEl.textContent = left;
      if (G.timerWrap) {
        G.timerWrap.classList.remove('warning', 'danger');
        if (left <= 10) G.timerWrap.classList.add('danger');
        else if (left <= 20) G.timerWrap.classList.add('warning');
      }
      if (elapsed >= G.levelTimeLimitSec) {
        if (G.timerIntervalId) clearInterval(G.timerIntervalId);
        G.timerIntervalId = null;
        G.gameOver = true;
        G.gameOverUntil = Date.now();
        G.stopBGM();
        G.resetInputState();
        G.draw();
        if (G.gameOverOverlay) {
          G.gameOverOverlay.removeAttribute('hidden');
          if (G.gameOverRestartBtn) G.gameOverRestartBtn.focus();
        }
        if (typeof G.saveSession === 'function') G.saveSession(true);
      }
      if (typeof G.saveSession === 'function') G.saveSession(false);
    }, 200);
  };

  G.resetInputState = function () {
    G.selected = [];
    G.strokeColor = null;
    G.isDragging = false;
    G.pointerDownCell = null;
    G.swapFirst = null;
  };

  G.applyRemove = function (toRemove, fromSwap) {
    if (!G.chainInProgress) {
      G.chainInProgress = true;
      G.chainStartTime = Date.now();
      G.comboCount = 1;
    }
    var result = G.collectToRemove(toRemove);
    var unique = [];
    var seen = {};
    for (var i = 0; i < result.toRemove.length; i++) {
      var t = result.toRemove[i];
      var k = t.r + ',' + t.c;
      if (seen[k]) continue;
      seen[k] = true;
      unique.push(t);
    }
    var diamondsInGroup = 0;
    for (var i = 0; i < unique.length; i++) {
      var cell = G.get(unique[i].r, unique[i].c);
      if (cell && cell.diamond) diamondsInGroup++;
    }
    var hasItems = (result.bombPositions && result.bombPositions.length) || result.missilePos || result.crossPos;
    if (!hasItems) { if (G.comboCount >= 2) G.playComboMp3(); else G.playMatchMp3(); }

    G.removeAnim = {
      cells: unique.map(function (t) { return { r: t.r, c: t.c }; }),
      start: Date.now(),
      duration: G.REMOVE_ANIM_MS
    };
    G.spawnBurstParticles(unique);

    G.diamondsRemovedThisLevel += diamondsInGroup;
    if (G.comboCount === 1) G.removedThisLevel += unique.length;
    var baseScore = unique.length * 10;
    var comboBonus = G.comboCount > 1 ? (G.comboCount - 1) * 12 : 0;
    G.score += baseScore + comboBonus;
    G.scorePopups.push({ score: baseScore + comboBonus, x: G.canvas.width / 2, y: G.canvas.height / 2, start: Date.now() });
    G.comboText = G.getComboLabel(G.comboCount);
    if (G.comboCount >= 2) G.itemsUnlocked = true;
    G.comboShowUntil = Date.now() + 1200;
    if (G.comboCount === 2) { G.badgeText = 'x2!'; G.badgeUntil = Date.now() + 1200; G.badgeParticles = []; }
    else if (G.comboCount === 3) { G.badgeText = 'x3!'; G.badgeUntil = Date.now() + 1200; G.badgeParticles = []; }
    else if (G.comboCount >= 4) { G.badgeText = 'AMAZING!'; G.badgeUntil = Date.now() + 1200; G.badgeParticles = []; }
    if (G.badgeText && G.badgeParticles.length === 0) {
      for (var pi = 0; pi < 20; pi++) {
        var a = (Math.PI * 2 * pi) / 20 + Math.random() * 0.5;
        var sp = 3 + Math.random() * 4;
        G.badgeParticles.push({ x: G.canvas.width / 2, y: G.canvas.height / 2, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, start: Date.now() });
      }
    }
    G.matchFlashUntil = Date.now() + 100;
    if (G.comboCount > 1 && G.levelStartTime) G.levelStartTime -= 3000;
    if (unique.length >= 6) {
      G.bigTextUntil = Date.now() + 1000;
      G.bigText = unique.length >= 8 ? '🎉 대박!!' : '대박!';
    }
    G.comboCount++;

    G.draw();
    G.removeDrawLoop();
    setTimeout(function () {
      G.refillOnlyRemoved(unique, G.comboCount >= 2);
      G.refillAnim = { cells: unique.map(function (t) { return { r: t.r, c: t.c }; }), start: Date.now(), duration: G.REFILL_ANIM_MS };
      G.removeAnim = null;
      G.draw();

      var nextToRemove = G.findAllMatchesMerged();
      var nextGroup = (nextToRemove && nextToRemove.length >= 3) ? nextToRemove : null;

      if (nextGroup && nextGroup.length >= 3) {
        var nextCopy = nextGroup.map(function (p) { return { r: p.r, c: p.c }; });
        var delay = G.REFILL_ANIM_MS + G.CHAIN_PAUSE_AFTER_REFILL_MS;
        G.chainStepTimerId = setTimeout(function () {
          G.chainStepTimerId = null;
          G.applyRemove(nextCopy, fromSwap);
        }, delay);
        G.chainDrawLoop();
        return;
      }
      G.chainInProgress = false;
      if (G.chainStepTimerId != null) clearTimeout(G.chainStepTimerId);
      G.chainStepTimerId = null;

      if (G.scoreEl) G.scoreEl.textContent = G.score;
      var needToNext = G.getDiamondsToNextLevel(G.level);
      G.updateProgressBar();

      if (G.diamondsRemovedThisLevel >= needToNext) {
        G.pendingLevelUp = true;
        G.comboDrawLoop();
        if (typeof G.saveSession === 'function') G.saveSession(true);
        return;
      }
      G.resetInputState();
      G.comboDrawLoop();
      if (typeof G.saveSession === 'function') G.saveSession(true);
    }, G.REMOVE_ANIM_MS);
  };

  G.comboDrawLoop = function () {
    G.draw();
    var now = Date.now();
    if (G.pendingLevelUp) {
      var comboDone = now >= G.comboShowUntil && now >= G.badgeUntil && now >= G.matchFlashUntil && now >= G.bigTextUntil && G.scorePopups.length === 0;
      if (comboDone) {
        G.pendingLevelUp = false;
        G.level++;
        G.removedThisLevel = 0;
        G.diamondsRemovedThisLevel = 0;
        if (G.timerIntervalId) clearInterval(G.timerIntervalId);
        G.timerIntervalId = null;
        G.applyGridSize();
        G.initGrid();
        if (G.levelEl) G.levelEl.textContent = G.level;
        G.updateProgressBar();
        G.comboCount = 0;
        G.resetInputState();
        G.levelUpUntil = Date.now() + G.LEVEL_UP_DURATION_MS;
        G.levelUpStartTime = Date.now();
        G.levelUpDrawLoop();
        G.playLevelUp();
        if (typeof G.saveSession === 'function') G.saveSession(true);
      } else {
        requestAnimationFrame(G.comboDrawLoop);
      }
      return;
    }
    if (now < G.comboShowUntil || now < G.matchFlashUntil || now < G.bigTextUntil || now < G.badgeUntil || G.scorePopups.length > 0) {
      requestAnimationFrame(G.comboDrawLoop);
    }
  };

  G.removeDrawLoop = function () {
    G.draw();
    if (G.removeAnim && (Date.now() - G.removeAnim.start) < G.removeAnim.duration) {
      requestAnimationFrame(G.removeDrawLoop);
    }
  };

  G.levelUpDrawLoop = function () {
    G.draw();
    if (Date.now() < G.levelUpUntil) {
      requestAnimationFrame(G.levelUpDrawLoop);
    } else {
      G.levelUpUntil = 0;
      G.draw();
      G.resetInputState();
      G.startLevelTimer();
    }
  };

  G.chainDrawLoop = function () {
    G.draw();
    if (G.chainStepTimerId != null) requestAnimationFrame(G.chainDrawLoop);
  };

  G.doSwapAndCheck = function (r1, c1, r2, c2) {
    var a = G.get(r1, c1);
    var b = G.get(r2, c2);
    if (!a || !b) return;
    G.swapAnim = {
      start: Date.now(),
      r1: r1, c1: c1, r2: r2, c2: c2,
      cellA: a, cellB: b
    };
    G.swapAnimLoop();
  };

  G.swapAnimLoop = function () {
    G.draw();
    if (!G.swapAnim) return;
    var elapsed = Date.now() - G.swapAnim.start;
    if (elapsed < G.SWAP_ANIM_DURATION_MS) {
      requestAnimationFrame(G.swapAnimLoop);
    } else {
      G.endSwapAnim();
    }
  };

  G.endSwapAnim = function () {
    if (!G.swapAnim) return;
    var r1 = G.swapAnim.r1, c1 = G.swapAnim.c1, r2 = G.swapAnim.r2, c2 = G.swapAnim.c2;
    var a = G.swapAnim.cellA, b = G.swapAnim.cellB;
    G.set(r1, c1, b);
    G.set(r2, c2, a);
    G.swapAnim = null;

    var group1 = G.findGroup(r1, c1);
    var group2 = G.findGroup(r2, c2);
    var match = null;
    if (group1.length >= 3) match = group1;
    else if (group2.length >= 3) match = group2;
    if (match && match.length >= 3) {
      if (G.matchDelayTimerId != null) clearTimeout(G.matchDelayTimerId);
      G.matchDelayTimerId = null;
      G.resetInputState();
      G.draw();
      G.matchDelayUntil = Date.now() + G.MATCH_DELAY_MS;
      var result = G.collectToRemove(match);
      var toRemoveCopy = result.toRemove.map(function (p) { return { r: p.r, c: p.c }; });
      G.matchDelayTimerId = setTimeout(function () {
        G.matchDelayTimerId = null;
        G.matchDelayUntil = 0;
        try {
          G.comboCount = 1;
          if (result.bombPositions && result.bombPositions.length || result.missilePos || result.crossPos) {
            G.hexAnim = { start: Date.now(), bombPositions: result.bombPositions || [], missilePos: result.missilePos, crossPos: result.crossPos, toRemove: toRemoveCopy };
            G.startHexAnim();
          } else {
            G.applyRemove(toRemoveCopy, true);
          }
        } finally {
          G.resetInputState();
          G.draw();
        }
      }, G.MATCH_DELAY_MS);
    } else {
      G.set(r1, c1, a);
      G.set(r2, c2, b);
      G.draw();
    }
  };

  G.animateHex = function () {
    if (!G.hexAnim) return;
    var elapsed = Date.now() - G.hexAnim.start;
    var duration = 300;
    if (G.hexAnim.bombPositions && G.hexAnim.bombPositions.length) duration = Math.max(duration, G.BOMB_ANIM_MS);
    if (G.hexAnim.missilePos) duration = Math.max(duration, G.MISSILE_ANIM_MS);
    if (G.hexAnim.crossPos) duration = Math.max(duration, G.CROSS_ANIM_MS);
    G.draw();
    G.ctx.save();
    G.ctx.translate(G.gridOffsetX, G.gridOffsetY);
    G.ctx.scale(G.gridScale, G.gridScale);
    G.ctx.globalAlpha = 1;
    G.ctx.shadowBlur = 0;
    if (G.hexAnim.bombPositions && G.hexAnim.bombPositions.length) G.drawBombAnim(G.hexAnim.bombPositions, elapsed);
    if (G.hexAnim.missilePos) G.drawMissileAnim(G.hexAnim.missilePos, elapsed);
    if (G.hexAnim.crossPos) G.drawCrossAnim(G.hexAnim.crossPos, elapsed);
    G.ctx.restore();
    if (elapsed >= duration) {
      if (G.hexAnimIntervalId != null) clearInterval(G.hexAnimIntervalId);
      G.hexAnimIntervalId = null;
      G.applyRemove(G.hexAnim.toRemove, false);
      G.hexAnim = null;
      G.resetInputState();
      G.draw();
    }
  };

  G.startHexAnim = function () {
    if (G.hexAnim && G.hexAnim.bombPositions && G.hexAnim.bombPositions.length) G.playBombMp3();
    else if (G.hexAnim && (G.hexAnim.missilePos || G.hexAnim.crossPos)) G.playItemMp3();
    else G.playExplosion();
    if (G.hexAnimIntervalId != null) clearInterval(G.hexAnimIntervalId);
    G.hexAnimIntervalId = setInterval(G.animateHex, 50);
    G.animateHex();
  };

  G.restart = function () {
    G.gameOver = false;
    G.gameOverUntil = 0;
    G.levelStartTime = Date.now();
    if (G.gameOverOverlay) G.gameOverOverlay.setAttribute('hidden', '');
    if (G.timerIntervalId) clearInterval(G.timerIntervalId);
    G.timerIntervalId = null;
    G.timerGeneration++;
    G.lastKnownTimeLeft = 999;
    var currentLevel = G.level;
    G.resetInputState();
    G.swapAnim = null;
    G.hexAnim = null;
    G.refillAnim = null;
    G.removeAnim = null;
    G.burstParticles = [];
    if (G.hexAnimIntervalId != null) clearInterval(G.hexAnimIntervalId);
    G.hexAnimIntervalId = null;
    G.matchDelayUntil = 0;
    if (G.matchDelayTimerId) clearTimeout(G.matchDelayTimerId);
    G.matchDelayTimerId = null;
    G.chainInProgress = false;
    if (G.chainStepTimerId) clearTimeout(G.chainStepTimerId);
    G.chainStepTimerId = null;
    G.pendingLevelUp = false;
    G.itemsUnlocked = false;
    G.removedThisLevel = 0;
    G.diamondsRemovedThisLevel = 0;
    G.comboCount = 0;
    if (G.scoreEl) G.scoreEl.textContent = G.score;
    if (G.levelEl) G.levelEl.textContent = currentLevel;
    if (G.timerEl) G.timerEl.textContent = G.getLevelTimeLimit(currentLevel);
    if (G.timerWrap) G.timerWrap.classList.remove('warning', 'danger');
    G.applyGridSize();
    G.initGrid();
    G.updateProgressBar();
    G.startLevelTimer();
    G.draw();
    if (typeof G.saveSession === 'function') G.saveSession(true);
  };
})(window.HoneyComb = window.HoneyComb || {});
