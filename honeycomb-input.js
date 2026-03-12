/**
 * HoneyComb – 입력 처리 (마우스/터치, 클릭→스왑·드래그 매치)
 */
(function (G) {
  'use strict';

  G.isInSelected = function (r, c) {
    return G.selected.some(function (s) { return s.r === r && s.c === c; });
  };
  G.isAdjacentToSelected = function (r, c) {
    for (var i = 0; i < G.selected.length; i++) {
      var nb = G.neighbors(G.selected[i].r, G.selected[i].c);
      for (var j = 0; j < nb.length; j++)
        if (nb[j].r === r && nb[j].c === c) return true;
    }
    return false;
  };

  G.clientToGridCoords = function (clientX, clientY) {
    var rect = G.canvas.getBoundingClientRect();
    var scaleX = G.canvas.width / rect.width, scaleY = G.canvas.height / rect.height;
    var canvasPx = (clientX - rect.left) * scaleX;
    var canvasPy = (clientY - rect.top) * scaleY;
    return { px: (canvasPx - G.gridOffsetX) / G.gridScale, py: (canvasPy - G.gridOffsetY) / G.gridScale };
  };

  G.getCoords = function (e, touch) {
    var clientX = touch ? e.touches[0].clientX : e.clientX;
    var clientY = touch ? e.touches[0].clientY : e.clientY;
    return G.clientToGridCoords(clientX, clientY);
  };

  G.onPointerDown = function (px, py) {
    var now = Date.now();
    if (G.gameOver) {
      G.restart();
      return;
    }
    if (G.chainInProgress) {
      if (now - G.chainStartTime > 8000) {
        G.chainInProgress = false;
        if (G.chainStepTimerId != null) clearTimeout(G.chainStepTimerId);
        G.chainStepTimerId = null;
        G.resetInputState();
      }
      return;
    }
    if (G.matchDelayUntil > 0) {
      if (now < G.matchDelayUntil) return;
      if (now > G.matchDelayUntil + 1500) {
        G.matchDelayUntil = 0;
        if (G.matchDelayTimerId != null) clearTimeout(G.matchDelayTimerId);
        G.matchDelayTimerId = null;
        G.resetInputState();
      }
    }
    if (G.hexAnim && (now - G.hexAnim.start) > 3000) {
      G.hexAnim = null;
      G.resetInputState();
    }
    if (G.hexAnim) return;
    if (G.swapAnim) return;
    var h = G.pixelToHex(px, py);
    if (!h) return;
    var cell = G.get(h.r, h.c);
    if (!cell) return;
    G.pointerDownCell = { r: h.r, c: h.c };
    G.selected = [];
    G.strokeColor = cell.color;
    G.selected.push({ r: h.r, c: h.c });
    G.isDragging = true;
    G.draw();
  };

  G.onPointerMove = function (px, py) {
    if (!G.isDragging || !G.strokeColor) return;
    var h = G.pixelToHex(px, py);
    if (!h) return;
    var cell = G.get(h.r, h.c);
    if (!cell || cell.color !== G.strokeColor) return;
    if (G.isInSelected(h.r, h.c)) return;
    if (!G.isAdjacentToSelected(h.r, h.c)) return;
    G.selected.push({ r: h.r, c: h.c });
    G.draw();
  };

  G.onPointerUp = function (px, py) {
    var h = px != null && py != null ? G.pixelToHex(px, py) : null;
    if (!G.isDragging) return;
    G.isDragging = false;

    var now = Date.now();
    if (G.gameOver) return;
    if (G.chainInProgress) {
      G.resetInputState();
      G.draw();
      return;
    }
    if (G.matchDelayUntil > 0 && now < G.matchDelayUntil) {
      G.resetInputState();
      G.draw();
      return;
    }
    if (G.hexAnim) {
      G.resetInputState();
      G.draw();
      return;
    }
    if (G.swapAnim) {
      G.resetInputState();
      G.draw();
      return;
    }

    if (G.selected.length >= 3) {
      var result = G.collectToRemove(G.selected);
      if (result.bombPositions && result.bombPositions.length || result.missilePos || result.crossPos) {
        G.hexAnim = { start: Date.now(), bombPositions: result.bombPositions || [], missilePos: result.missilePos, crossPos: result.crossPos, toRemove: result.toRemove, originalMatch: G.selected };
        G.startHexAnim();
        G.draw();
      } else {
        G.applyRemove(G.selected, false);
        G.draw();
      }
      G.resetInputState();
      return;
    }

    var releaseCell = (h && G.get(h.r, h.c)) ? h : G.pointerDownCell;
    if (releaseCell && G.selected.length >= 1) {
      var rr = releaseCell.r, rc = releaseCell.c;
      if (!G.swapFirst) {
        G.swapFirst = { r: rr, c: rc };
      } else if (G.swapFirst.r === rr && G.swapFirst.c === rc) {
        G.swapFirst = null;
      } else if (G.isAdjacent(G.swapFirst.r, G.swapFirst.c, rr, rc)) {
        G.doSwapAndCheck(G.swapFirst.r, G.swapFirst.c, rr, rc);
        G.swapFirst = null;
      } else {
        G.swapFirst = { r: rr, c: rc };
      }
    } else {
      G.swapFirst = null;
    }
    G.selected = [];
    G.strokeColor = null;
    G.pointerDownCell = null;
    G.draw();
  };

  G.attachInput = function () {
    if (!G.canvas) return;
    G.canvas.addEventListener('mousedown', function (e) {
      G.initAudio();
      G.preloadMatchComboAudio();
      var co = G.getCoords(e, false);
      G.onPointerDown(co.px, co.py);
    });
    G.canvas.addEventListener('mousemove', function (e) {
      var co = G.getCoords(e, false);
      G.onPointerMove(co.px, co.py);
    });
    G.canvas.addEventListener('mouseup', function (e) {
      var co = G.getCoords(e, false);
      G.onPointerUp(co.px, co.py);
    });
    G.canvas.addEventListener('mouseleave', function () { G.onPointerUp(null, null); });
    G.canvas.addEventListener('touchstart', function (e) {
      e.preventDefault();
      G.initAudio();
      G.preloadMatchComboAudio();
      var co = G.getCoords(e, true);
      G.onPointerDown(co.px, co.py);
    }, { passive: false });
    G.canvas.addEventListener('touchmove', function (e) {
      e.preventDefault();
      var co = G.getCoords(e, true);
      G.onPointerMove(co.px, co.py);
    }, { passive: false });
    G.canvas.addEventListener('touchend', function (e) {
      e.preventDefault();
      var px = null, py = null;
      if (e.changedTouches && e.changedTouches[0]) {
        var co = G.clientToGridCoords(e.changedTouches[0].clientX, e.changedTouches[0].clientY);
        px = co.px;
        py = co.py;
      }
      G.onPointerUp(px, py);
    }, { passive: false });

    if (G.gameOverRestartBtn) {
      function doRestart(e) {
        if (e) { e.preventDefault(); e.stopPropagation(); }
        G.restart();
      }
      G.gameOverRestartBtn.addEventListener('click', doRestart, true);
      G.gameOverRestartBtn.addEventListener('pointerdown', doRestart, true);
      G.gameOverRestartBtn.addEventListener('touchend', function (e) {
        e.preventDefault();
        e.stopPropagation();
        G.restart();
      }, { passive: false, capture: true });
    }
    if (G.gameOverOverlay) {
      function onRestartTap(e) {
        if (e) { e.preventDefault(); e.stopPropagation(); }
        G.restart();
      }
      G.gameOverOverlay.addEventListener('click', onRestartTap, true);
      G.gameOverOverlay.addEventListener('pointerdown', onRestartTap, true);
      G.gameOverOverlay.addEventListener('touchend', function (e) {
        e.preventDefault();
        e.stopPropagation();
        G.restart();
      }, { passive: false, capture: true });
    }
  };
})(window.HoneyComb = window.HoneyComb || {});
