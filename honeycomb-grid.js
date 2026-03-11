/**
 * HoneyComb – 그리드/헥스/매치/리필 로직
 */
(function (G) {
  'use strict';

  function getItemThreshold() { return 3 + G.level * 2; }
  G.getItemThreshold = getItemThreshold;

  G.hexToPixel = function (r, c) {
    var x = G.GAP + (Math.sqrt(3) * G.R) / 2 + c * G.STEP_X + (r % 2) * (G.STEP_X * 0.5);
    var y = G.GAP + G.R + r * G.STEP_Y;
    return { x: x, y: y };
  };
  G.pixelToHex = function (px, py) {
    var rApprox = Math.floor((py - G.GAP - G.R) / G.STEP_Y);
    var cApprox = Math.floor((px - G.GAP - (Math.sqrt(3) * G.R) / 2 - (rApprox % 2) * (G.STEP_X * 0.5)) / G.STEP_X);
    var best = null, bestD = 1e9;
    for (var dr = -1; dr <= 1; dr++) {
      for (var dc = -1; dc <= 1; dc++) {
        var rr = rApprox + dr, cc = cApprox + dc;
        if (rr < 0 || rr >= G.ROWS || cc < 0 || cc >= G.COLS) continue;
        var p = G.hexToPixel(rr, cc);
        var d = Math.sqrt((px - p.x) * (px - p.x) + (py - p.y) * (py - p.y));
        if (d <= G.R * 0.95 && d < bestD) { bestD = d; best = { r: rr, c: cc }; }
      }
    }
    return best;
  };
  G.isAdjacent = function (r1, c1, r2, c2) {
    var nb = G.neighbors(r1, c1);
    for (var i = 0; i < nb.length; i++) if (nb[i].r === r2 && nb[i].c === c2) return true;
    return false;
  };

  G.getGridSize = function (lv) {
    if (lv <= 1) return { rows: 5, cols: 5 };
    if (lv === 2) return { rows: 6, cols: 5 };
    if (lv === 3) return { rows: 6, cols: 6 };
    if (lv === 4) return { rows: 7, cols: 6 };
    if (lv === 5) return { rows: 7, cols: 7 };
    if (lv === 6) return { rows: 8, cols: 7 };
    return { rows: 8, cols: 8 };
  };
  G.applyGridSize = function () {
    var R_BASE = 28, GAP_BASE = 5;
    var sz = G.getGridSize(G.level);
    G.ROWS = sz.rows;
    G.COLS = sz.cols;
    G.R = R_BASE;
    G.GAP = GAP_BASE;
    G.STEP_X = Math.sqrt(3) * G.R + G.GAP;
    G.STEP_Y = 1.5 * G.R + G.GAP;
    var w = 2 * G.GAP + (Math.sqrt(3) * G.R) / 2 + (G.COLS - 1) * G.STEP_X + G.STEP_X * 0.5 + 2 * G.R;
    var h = 2 * G.GAP + 2 * G.R + (G.ROWS - 1) * G.STEP_Y;
    G.gridScale = Math.min(G.CANVAS_WIDTH / w, G.CANVAS_HEIGHT / h);
    G.gridOffsetX = (G.CANVAS_WIDTH - w * G.gridScale) / 2;
    G.gridOffsetY = (G.CANVAS_HEIGHT - h * G.gridScale) / 2;
  };
  G.getColorsForLevel = function (lv) {
    var n = Math.min(3 + lv, 6);
    return G.HEX_COLORS.slice(0, n);
  };
  /**
   * 다이아 밸런스(캐주얼 곡선):
   * - 기존: 필요 다이아(2*lv+1)는 급격히 증가, 반면 최대 동시 다이아 수는 4로 고정 → 후반 난이도 급상승
   * - 변경: 필요량 증가 완만화 + 레벨이 오를수록 보드 내 다이아 상한/드랍 확률을 완만히 증가
   */
  G.getDiamondsToNextLevel = function (lv) {
    // lv1=4, lv10=16, lv12=19, lv50=68 정도(기존 lv50=101 대비 완만)
    return Math.max(3, Math.round(3 + lv * 1.3));
  };
  G.maxDiamondsOnGrid = function () {
    // 다이아가 "안 보이는" 체감을 줄이기 위해 9레벨 이후 상한을 더 빠르게 증가시킴
    // lv1~4: 4, lv5~8: 5, lv9~12: 6, lv13~16: 7 ... (상한 16)
    return Math.min(16, 4 + Math.floor(Math.max(0, G.level + 3) / 4));
  };
  function diamondChanceForLevel(lv) {
    // lv1≈0.24, lv9≈0.30, lv20≈0.39, lv30≈0.45에서 캡
    return Math.min(0.45, 0.23 + lv * 0.008);
  }
  G.countDiamondsOnGrid = function () {
    var n = 0;
    for (var r = 0; r < G.ROWS; r++)
      for (var c = 0; c < G.COLS; c++) {
        var cell = G.get(r, c);
        if (cell && cell.diamond) n++;
      }
    return n;
  };
  G.countDiamondsExcluding = function (excludeList) {
    var set = {};
    for (var i = 0; i < excludeList.length; i++) set[excludeList[i].r + ',' + excludeList[i].c] = true;
    var n = 0;
    for (var r = 0; r < G.ROWS; r++)
      for (var c = 0; c < G.COLS; c++) {
        if (set[r + ',' + c]) continue;
        var cell = G.get(r, c);
        if (cell && cell.diamond) n++;
      }
    return n;
  };

  G.randCell = function (r, c, allowDiamond) {
    var colors = G.getColorsForLevel(G.level);
    var allowItem = G.itemsUnlocked && G.totalRemoved >= getItemThreshold();
    var itemMult = 1 / (1 + (G.level - 1) * 0.28);
    var isBomb = allowItem && Math.random() < G.BOMB_CHANCE * itemMult;
    var isMissile = allowItem && !isBomb && Math.random() < G.MISSILE_CHANCE * itemMult;
    var isCross = allowItem && !isBomb && !isMissile && Math.random() < G.CROSS_CHANCE * itemMult;
    var colorIdx;
    if (r != null && c != null && G.level >= 2) {
      var nb = G.neighbors(r, c);
      var neighborColors = {};
      for (var i = 0; i < nb.length; i++) {
        var cell = G.get(nb[i].r, nb[i].c);
        if (cell) neighborColors[cell.color] = (neighborColors[cell.color] || 0) + 1;
      }
      var weights = [];
      for (var k = 0; k < colors.length; k++) weights.push(neighborColors[colors[k]] ? 0.35 : 1);
      var sum = 0;
      for (var q = 0; q < weights.length; q++) sum += weights[q];
      var rnd = Math.random() * sum;
      for (colorIdx = 0; colorIdx < weights.length; colorIdx++) {
        rnd -= weights[colorIdx];
        if (rnd <= 0) break;
      }
      if (colorIdx >= colors.length) colorIdx = colors.length - 1;
    } else {
      colorIdx = Math.floor(Math.random() * colors.length);
    }
    var isDiamond = false;
    if (allowDiamond && !isBomb && !isMissile && !isCross && Math.random() < diamondChanceForLevel(G.level)) isDiamond = true;
    return { color: colors[colorIdx], bomb: isBomb, missile: isMissile, cross: isCross, diamond: isDiamond };
  };

  G.countGroupIfSet = function (r, c, color) {
    var visited = {};
    var count = 0;
    var self = G;
    function dfs(rr, cc) {
      var i = self.id(rr, cc);
      if (visited[i]) return;
      var cell = self.get(rr, cc);
      var cellColor = (rr === r && cc === c) ? color : (cell ? cell.color : null);
      if (cellColor !== color) return;
      visited[i] = true;
      count++;
      var nb = self.neighbors(rr, cc);
      for (var j = 0; j < nb.length; j++) dfs(nb[j].r, nb[j].c);
    }
    dfs(r, c);
    return count;
  };

  G.randCellNoMatch = function (r, c, allowDiamond, allowChainMatch) {
    var colors = G.getColorsForLevel(G.level);
    var safe = [];
    for (var k = 0; k < colors.length; k++) {
      if (G.countGroupIfSet(r, c, colors[k]) < 3) safe.push(colors[k]);
    }
    var pool = safe.length > 0 ? safe : colors;
    // 연쇄 중에는 일부러 매치가 생기도록 확률을 올려 x3/x4가 더 나오게
    if (allowChainMatch && Math.random() < 0.42) pool = colors;
    var color = pool[Math.floor(Math.random() * pool.length)];
    var allowItem = G.itemsUnlocked && G.totalRemoved >= getItemThreshold();
    var itemMult = 1 / (1 + (G.level - 1) * 0.28);
    var isBomb = allowItem && Math.random() < G.BOMB_CHANCE * itemMult;
    var isMissile = allowItem && !isBomb && Math.random() < G.MISSILE_CHANCE * itemMult;
    var isCross = allowItem && !isBomb && !isMissile && Math.random() < G.CROSS_CHANCE * itemMult;
    var isDiamond = false;
    if (allowDiamond && !isBomb && !isMissile && !isCross && Math.random() < diamondChanceForLevel(G.level)) isDiamond = true;
    return { color: color, bomb: isBomb, missile: isMissile, cross: isCross, diamond: isDiamond };
  };

  G.findGroup = function (r, c) {
    var cell = G.get(r, c);
    if (!cell) return [];
    var key = cell.color;
    var visited = {};
    var list = [];
    function dfs(rr, cc) {
      var i = G.id(rr, cc);
      if (visited[i]) return;
      var c2 = G.get(rr, cc);
      if (!c2 || c2.color !== key) return;
      visited[i] = true;
      list.push({ r: rr, c: cc });
      var nb = G.neighbors(rr, cc);
      for (var j = 0; j < nb.length; j++) dfs(nb[j].r, nb[j].c);
    }
    dfs(r, c);
    return list;
  };

  G.collectToRemove = function (group) {
    var toRemove = [];
    var hasBomb = false, hasMissile = false, hasCross = false;
    var bombPositions = [], missilePos = null, crossPos = null;
    for (var i = 0; i < group.length; i++) {
      var g = group[i];
      var cell = G.get(g.r, g.c);
      if (cell && cell.bomb) { hasBomb = true; bombPositions.push({ r: g.r, c: g.c }); }
      if (cell && cell.missile) { hasMissile = true; missilePos = { r: g.r, c: g.c }; }
      if (cell && cell.cross) { hasCross = true; crossPos = { r: g.r, c: g.c }; }
      toRemove.push({ r: g.r, c: g.c });
    }
    if (hasBomb && bombPositions.length > 0) {
      var processed = {};
      var queue = bombPositions.slice();
      while (queue.length > 0) {
        var pos = queue.shift();
        var key = pos.r + ',' + pos.c;
        if (processed[key]) continue;
        processed[key] = true;
        if (!bombPositions.some(function (b) { return b.r === pos.r && b.c === pos.c; })) bombPositions.push(pos);
        var nb = G.neighbors(pos.r, pos.c);
        for (var j = 0; j < nb.length; j++) {
          var nn = nb[j];
          if (!toRemove.some(function (t) { return t.r === nn.r && t.c === nn.c; })) toRemove.push({ r: nn.r, c: nn.c });
          var ncell = G.get(nn.r, nn.c);
          var nkey = nn.r + ',' + nn.c;
          if (ncell && ncell.bomb && !processed[nkey]) queue.push({ r: nn.r, c: nn.c });
        }
      }
    }
    var seen = {};
    for (var i = 0; i < toRemove.length; i++) { var t = toRemove[i]; seen[t.r + ',' + t.c] = true; }
    for (var i = 0; i < toRemove.length; i++) {
      var t = toRemove[i];
      var cell = G.get(t.r, t.c);
      if (cell && cell.missile) {
        for (var cc = 0; cc < G.COLS; cc++) {
          var k = t.r + ',' + cc;
          if (!seen[k]) { seen[k] = true; toRemove.push({ r: t.r, c: cc }); }
        }
      }
      if (cell && cell.cross) {
        for (var cc = 0; cc < G.COLS; cc++) {
          var k = t.r + ',' + cc;
          if (!seen[k]) { seen[k] = true; toRemove.push({ r: t.r, c: cc }); }
        }
        for (var rr = 0; rr < G.ROWS; rr++) {
          var k = rr + ',' + t.c;
          if (!seen[k]) { seen[k] = true; toRemove.push({ r: rr, c: t.c }); }
        }
      }
    }
    if (hasMissile && missilePos) {
      for (var cc = 0; cc < G.COLS; cc++) {
        if (!toRemove.some(function (t) { return t.r === missilePos.r && t.c === cc; })) toRemove.push({ r: missilePos.r, c: cc });
      }
    }
    if (hasCross && crossPos) {
      for (var cc = 0; cc < G.COLS; cc++) {
        if (!toRemove.some(function (t) { return t.r === crossPos.r && t.c === cc; })) toRemove.push({ r: crossPos.r, c: cc });
      }
      for (var rr = 0; rr < G.ROWS; rr++) {
        if (!toRemove.some(function (t) { return t.r === rr && t.c === crossPos.c; })) toRemove.push({ r: rr, c: crossPos.c });
      }
    }
    return { toRemove: toRemove, bombPositions: bombPositions, missilePos: missilePos, crossPos: crossPos };
  };

  G.findAnyMatch = function () {
    var visited = {};
    for (var r = 0; r < G.ROWS; r++) {
      for (var c = 0; c < G.COLS; c++) {
        if (!G.get(r, c)) continue;
        var group = G.findGroup(r, c);
        if (group.length < 3) continue;
        var uid = group.map(function (g) { return G.id(g.r, g.c); }).sort(function (a, b) { return a - b; })[0];
        if (visited[uid]) continue;
        visited[uid] = true;
        return group;
      }
    }
    return null;
  };

  G.findAllMatchesMerged = function () {
    var visited = {};
    var merged = [];
    var seen = {};
    for (var r = 0; r < G.ROWS; r++) {
      for (var c = 0; c < G.COLS; c++) {
        if (!G.get(r, c)) continue;
        var group = G.findGroup(r, c);
        if (group.length < 3) continue;
        var uid = group.map(function (g) { return G.id(g.r, g.c); }).sort(function (a, b) { return a - b; })[0];
        if (visited[uid]) continue;
        visited[uid] = true;
        for (var i = 0; i < group.length; i++) {
          var g = group[i];
          var k = g.r + ',' + g.c;
          if (seen[k]) continue;
          seen[k] = true;
          merged.push({ r: g.r, c: g.c });
        }
      }
    }
    return merged.length > 0 ? merged : null;
  };

  G.refillOnlyRemoved = function (toRemove, allowChainMatch) {
    var seen = {};
    var list = [];
    for (var i = 0; i < toRemove.length; i++) {
      var t = toRemove[i];
      var k = t.r + ',' + t.c;
      if (seen[k]) continue;
      seen[k] = true;
      list.push(t);
    }
    var diamondCount = G.countDiamondsExcluding(list);
    for (var i = 0; i < list.length; i++) {
      var t = list[i];
      var allowDiamond = diamondCount < G.maxDiamondsOnGrid();
      G.set(t.r, t.c, G.randCellNoMatch(t.r, t.c, allowDiamond, !!allowChainMatch));
      if (G.get(t.r, t.c).diamond) diamondCount++;
    }
    G.totalRemoved += list.length;
    return list.length;
  };

  G.initGrid = function () {
    G.grid = [];
    var diamondCount = 0;
    for (var r = 0; r < G.ROWS; r++) {
      for (var c = 0; c < G.COLS; c++) {
        var allowDiamond = diamondCount < G.maxDiamondsOnGrid();
        var cell = G.randCell(r, c, allowDiamond);
        if (cell.diamond) diamondCount++;
        G.grid.push(cell);
      }
    }
    G.resolveInitialMatches();
  };

  G.resolveInitialMatches = function () {
    var limit = 300;
    var group;
    while (limit-- > 0 && (group = G.findAnyMatch()) && group.length >= 3) {
      var result = G.collectToRemove(group);
      var seen = {};
      var list = [];
      for (var i = 0; i < result.toRemove.length; i++) {
        var t = result.toRemove[i];
        var k = t.r + ',' + t.c;
        if (seen[k]) continue;
        seen[k] = true;
        list.push(t);
      }
      var diamondCount = G.countDiamondsExcluding(list);
      for (var j = 0; j < list.length; j++) {
        var t = list[j];
        var allowDiamond = diamondCount < G.maxDiamondsOnGrid();
        var cell = G.randCell(t.r, t.c, allowDiamond);
        if (cell.diamond) diamondCount++;
        G.set(t.r, t.c, cell);
      }
    }
  };

  G.getLevelTimeLimit = function (lv) {
    if (lv <= 1) return 30;
    return 55 + Math.min(lv, 10) * 5;
  };
  G.getRemovedToNextLevel = function (lv) {
    if (lv <= 1) return 10;
    if (lv === 2) return 15;
    if (lv === 3) return 25;
    if (lv === 4) return 35;
    return 35 + (lv - 4) * 10;
  };
})(window.HoneyComb = window.HoneyComb || {});
