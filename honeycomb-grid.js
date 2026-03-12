/**
 * HoneyComb – 그리드/헥스/매치/리필 로직
 */
(function (G) {
  'use strict';

  function getItemThreshold() { return 2 + G.level * 2; }
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
        if (!G.inBounds(rr, cc)) continue;
        var p = G.hexToPixel(rr, cc);
        var d = Math.sqrt((px - p.x) * (px - p.x) + (py - p.y) * (py - p.y));
        if (d <= G.R * 0.95 && d < bestD) { bestD = d; best = { r: rr, c: cc }; }
      }
    }
    if (best) return best;
    // 클릭이 보드 밖(육각형 빈 모서리)이면 가장 가까운 보드 내 육각 반환
    for (var r = 0; r < G.ROWS; r++) {
      for (var c = 0; c < G.COLS; c++) {
        if (!G.inBounds(r, c)) continue;
        var p = G.hexToPixel(r, c);
        var d = Math.sqrt((px - p.x) * (px - p.x) + (py - p.y) * (py - p.y));
        if (d < bestD) { bestD = d; best = { r: r, c: c }; }
      }
    }
    return best;
  };
  G.isAdjacent = function (r1, c1, r2, c2) {
    var nb = G.neighbors(r1, c1);
    for (var i = 0; i < nb.length; i++) if (nb[i].r === r2 && nb[i].c === c2) return true;
    return false;
  };

  /**
   * 레벨 70까지 밸런스. 정사각형이 아닌 행×열 조합으로 단계별 확대.
   * 퍼센티지처럼 조금씩 늘리기 위해 단계를 촘촘히(약 5레벨마다 한 단계).
   */
  G.getGridSize = function (lv) {
    var capped = Math.min(Math.max(1, lv), 70);
    // 레벨 구간별 (rows, cols) — 14단계, 5레벨마다 한 단계로 완만히 확대
    var steps = [
      { rows: 4, cols: 5 },   // 1–5
      { rows: 5, cols: 5 },   // 6–10
      { rows: 5, cols: 6 },   // 11–15
      { rows: 6, cols: 6 },   // 16–20
      { rows: 6, cols: 7 },   // 21–25
      { rows: 7, cols: 7 },   // 26–30
      { rows: 7, cols: 8 },   // 31–35
      { rows: 8, cols: 8 },   // 36–40
      { rows: 8, cols: 9 },   // 41–45
      { rows: 9, cols: 9 },   // 46–50
      { rows: 9, cols: 10 },  // 51–55
      { rows: 10, cols: 10 }, // 56–60
      { rows: 10, cols: 11 }, // 61–65
      { rows: 11, cols: 11 }  // 66–70
    ];
    var step = Math.min(steps.length - 1, Math.floor((capped - 1) / 5));
    var sz = steps[step];
    return { rows: sz.rows, cols: sz.cols };
  };
  G.applyGridSize = function (overrideRows, overrideCols) {
    var R_BASE = 28, GAP_BASE = 5;
    var sz;
    if (overrideRows != null && overrideCols != null) {
      sz = { rows: overrideRows, cols: overrideCols };
    } else {
      sz = G.getGridSize(G.level);
      // 모바일 등 작은 캔버스에서는 그리드 최대 크기 제한 → 블럭이 너무 작아지지 않도록
      var maxRC = (G.CANVAS_WIDTH >= 380) ? 12 : 9;
      if (sz.rows > maxRC || sz.cols > maxRC) {
        sz = { rows: Math.min(maxRC, sz.rows), cols: Math.min(maxRC, sz.cols) };
      }
    }
    G.ROWS = sz.rows;
    G.COLS = sz.cols;
    /** 육각형 실루엣: 중심에서 이 거리 이내의 육각만 보드에 둠 (직사각형 아님) */
    G.hexRadius = Math.min(Math.floor(G.ROWS / 2), Math.floor(G.COLS / 2));
    G.R = R_BASE;
    G.GAP = GAP_BASE;
    G.STEP_X = Math.sqrt(3) * G.R + G.GAP;
    G.STEP_Y = 1.5 * G.R + G.GAP;
    var w = 2 * G.GAP + (Math.sqrt(3) * G.R) / 2 + (G.COLS - 1) * G.STEP_X + G.STEP_X * 0.5 + 2 * G.R;
    var h = 2 * G.GAP + 2 * G.R + (G.ROWS - 1) * G.STEP_Y;
    // 세로를 꽉 채우기 우선. 가로가 넘치면 맞춤으로 전환, 수직 가운데 정렬
    G.gridScale = G.CANVAS_HEIGHT / h;
    var fitsWidth = (w * G.gridScale <= G.CANVAS_WIDTH);
    if (!fitsWidth) G.gridScale = Math.min(G.CANVAS_WIDTH / w, G.CANVAS_HEIGHT / h);
    G.gridOffsetX = (G.CANVAS_WIDTH - w * G.gridScale) / 2;
    G.gridOffsetY = (G.CANVAS_HEIGHT - h * G.gridScale) / 2;
  };
  G.getColorsForLevel = function (lv) {
    // Lv.70까지는 최대 6색, Lv.71부터 7번째 색을 추가해 난이도 한 단계 상승
    var cap = (lv >= 71) ? 7 : 6;
    // 초반·중반 보드(1~10)는 색을 5개로 제한 → 맞출 수 없는 상태 방지
    if (lv <= 10) cap = Math.min(cap, 5);
    var n = Math.min(3 + lv, cap);
    return G.HEX_COLORS.slice(0, n);
  };
  /**
   * 다이아 밸런스(캐주얼 곡선):
   * - 기존: 필요 다이아(2*lv+1)는 급격히 증가, 반면 최대 동시 다이아 수는 4로 고정 → 후반 난이도 급상승
   * - 변경: 필요량 증가 완만화 + 레벨이 오를수록 보드 내 다이아 상한/드랍 확률을 완만히 증가
   */
  G.getDiamondsToNextLevel = function (lv) {
    return Math.max(3, Math.round(3 + lv * 0.95));
  };
  /** 레벨업에 필요한 열쇠 개수. 난이도 올라가면 2개 이상 필요 */
  G.getKeysRequiredForLevel = function (lv) {
    if (lv <= 19) return 0;
    if (lv <= 39) return 2;
    if (lv <= 59) return 3;
    return 4;
  };
  G.maxDiamondsOnGrid = function () {
    // 다이아가 "안 보이는" 체감을 줄이기 위해 9레벨 이후 상한을 더 빠르게 증가시킴
    // lv1~4: 4, lv5~8: 5, lv9~12: 6, lv13~16: 7 ... (상한 16)
    return Math.min(16, 4 + Math.floor(Math.max(0, G.level + 3) / 4));
  };
  G.maxKeysOnGrid = function () {
    var need = G.getKeysRequiredForLevel(G.level);
    return need <= 0 ? 0 : Math.min(need + 2, 5);
  };
  function keyChanceForLevel(lv) {
    if (G.getKeysRequiredForLevel(lv) <= 0) return 0;
    return Math.min(0.22, 0.08 + lv * 0.002);
  }
  /** 레벨에 따른 보드 중간 빈 슬롯(구멍) 개수. 난이도 상승 시 빈 자리 증가 */
  G.getHoleCountForLevel = function (lv) {
    if (lv <= 64) return 0;
    if (lv <= 66) return 1;
    if (lv <= 68) return 2;
    return 3;
  };
  function diamondChanceForLevel(lv) {
    return Math.min(0.48, 0.26 + lv * 0.0075);
  }
  G.isHole = function (r, c) { return G.holes && G.holes[r + ',' + c]; };
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
  G.countKeysOnGrid = function () {
    var n = 0;
    for (var r = 0; r < G.ROWS; r++)
      for (var c = 0; c < G.COLS; c++) {
        var cell = G.get(r, c);
        if (cell && cell.key) n++;
      }
    return n;
  };
  G.countKeysExcluding = function (excludeList) {
    var set = {};
    for (var i = 0; i < excludeList.length; i++) set[excludeList[i].r + ',' + excludeList[i].c] = true;
    var n = 0;
    for (var r = 0; r < G.ROWS; r++)
      for (var c = 0; c < G.COLS; c++) {
        if (set[r + ',' + c]) continue;
        var cell = G.get(r, c);
        if (cell && cell.key) n++;
      }
    return n;
  };

  G.randCell = function (r, c, allowDiamond, allowKey) {
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
    var isKey = !isDiamond && allowKey && !isBomb && !isMissile && !isCross && Math.random() < keyChanceForLevel(G.level);
    return { color: colors[colorIdx], bomb: isBomb, missile: isMissile, cross: isCross, diamond: isDiamond, key: isKey };
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

  G.randCellNoMatch = function (r, c, allowDiamond, allowChainMatch, allowKey) {
    var colors = G.getColorsForLevel(G.level);
    var safe = [];
    for (var k = 0; k < colors.length; k++) {
      if (G.countGroupIfSet(r, c, colors[k]) < 3) safe.push(colors[k]);
    }
    var pool = safe.length > 0 ? safe : colors;
    // 연쇄 중에도 x3/x4가 "너무 자주" 뜨지 않도록 확률을 보수적으로 조정
    if (allowChainMatch && Math.random() < 0.18) pool = colors;
    var color = pool[Math.floor(Math.random() * pool.length)];
    var allowItem = G.itemsUnlocked && G.totalRemoved >= getItemThreshold();
    /* 콤보 리필 시: 레벨이 올라갈수록 아이템 드랍 확률 상승 (고레벨에서도 폭탄/미사일/십자 나오도록) */
    var itemMult = allowChainMatch
      ? Math.min(1.6, 0.55 + G.level * 0.032)
      : 1 / (1 + (G.level - 1) * 0.28);
    var isBomb = allowItem && Math.random() < G.BOMB_CHANCE * itemMult;
    var isMissile = allowItem && !isBomb && Math.random() < G.MISSILE_CHANCE * itemMult;
    var isCross = allowItem && !isBomb && !isMissile && Math.random() < G.CROSS_CHANCE * itemMult;
    var isDiamond = false;
    if (allowDiamond && !isBomb && !isMissile && !isCross && Math.random() < diamondChanceForLevel(G.level)) isDiamond = true;
    var allowKeyVal = allowKey !== undefined ? allowKey : (G.getKeysRequiredForLevel(G.level) > 0);
    var isKey = !isDiamond && allowKeyVal && !isBomb && !isMissile && !isCross && Math.random() < keyChanceForLevel(G.level);
    return { color: color, bomb: isBomb, missile: isMissile, cross: isCross, diamond: isDiamond, key: isKey };
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
    var toDowngrade = []; // 열쇠 블럭: 여기 넣으면 제거되지 않고 열쇠만 사라짐(두 번 깨야 없어짐)
    var hasBomb = false, hasMissile = false, hasCross = false;
    var bombPositions = [], missilePos = null, crossPos = null;
    function addToRemove(rr, cc) {
      var cell = G.get(rr, cc);
      if (!cell) return;
      var k = rr + ',' + cc;
      for (var ii = 0; ii < toRemove.length; ii++) {
        var t = toRemove[ii];
        if (t.r === rr && t.c === cc) return;
      }
      toRemove.push({ r: rr, c: cc });
    }
    for (var i = 0; i < group.length; i++) {
      var g = group[i];
      var cell = G.get(g.r, g.c);
      if (cell && cell.bomb) { hasBomb = true; bombPositions.push({ r: g.r, c: g.c }); }
      if (cell && cell.missile) { hasMissile = true; missilePos = { r: g.r, c: g.c }; }
      if (cell && cell.cross) { hasCross = true; crossPos = { r: g.r, c: g.c }; }
      if (cell && cell.key) {
        toDowngrade.push({ r: g.r, c: g.c });
      } else {
        addToRemove(g.r, g.c);
      }
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
          addToRemove(nn.r, nn.c);
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
          if (!G.get(t.r, cc)) continue;
          var k = t.r + ',' + cc;
          if (!seen[k]) { seen[k] = true; toRemove.push({ r: t.r, c: cc }); }
        }
      }
      if (cell && cell.cross) {
        for (var cc = 0; cc < G.COLS; cc++) {
          if (!G.get(t.r, cc)) continue;
          var k = t.r + ',' + cc;
          if (!seen[k]) { seen[k] = true; toRemove.push({ r: t.r, c: cc }); }
        }
        for (var rr = 0; rr < G.ROWS; rr++) {
          if (!G.get(rr, t.c)) continue;
          var k = rr + ',' + t.c;
          if (!seen[k]) { seen[k] = true; toRemove.push({ r: rr, c: t.c }); }
        }
      }
    }
    if (hasMissile && missilePos) {
      for (var cc = 0; cc < G.COLS; cc++) {
        if (!G.get(missilePos.r, cc)) continue;
        addToRemove(missilePos.r, cc);
      }
    }
    if (hasCross && crossPos) {
      for (var cc = 0; cc < G.COLS; cc++) {
        if (!G.get(crossPos.r, cc)) continue;
        addToRemove(crossPos.r, cc);
      }
      for (var rr = 0; rr < G.ROWS; rr++) {
        if (!G.get(rr, crossPos.c)) continue;
        addToRemove(rr, crossPos.c);
      }
    }
    return { toRemove: toRemove, toDowngrade: toDowngrade, bombPositions: bombPositions, missilePos: missilePos, crossPos: crossPos };
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

  /**
   * 인접한 두 칸을 맞바꿨을 때 3개 이상 매치가 생기는 수가 하나라도 있으면 true.
   * (시작 직후·리필 후 움직일 수 없는 상태 방지용)
   */
  G.hasValidMove = function () {
    for (var r1 = 0; r1 < G.ROWS; r1++) {
      for (var c1 = 0; c1 < G.COLS; c1++) {
        if (!G.inBounds(r1, c1)) continue;
        var cellA = G.get(r1, c1);
        if (!cellA) continue;
        var nb = G.neighbors(r1, c1);
        for (var i = 0; i < nb.length; i++) {
          var r2 = nb[i].r, c2 = nb[i].c;
          var cellB = G.get(r2, c2);
          if (!cellB) continue;
          if (G.countGroupIfSet(r1, c1, cellB.color) >= 3 || G.countGroupIfSet(r2, c2, cellA.color) >= 3) return true;
        }
      }
    }
    return false;
  };

  /** 보드 내용만 다시 채움(구멍·크기 유지). 셔플 후 유효 수 없으면 반복할 때 사용 */
  function refillAllCells() {
    var diamondCount = 0;
    var keyCount = 0;
    for (var r = 0; r < G.ROWS; r++) {
      for (var c = 0; c < G.COLS; c++) {
        if (!G.inBounds(r, c)) continue;
        if (G.holes[r + ',' + c]) continue;
        var allowDiamond = diamondCount < G.maxDiamondsOnGrid();
        var needKeys = G.getKeysRequiredForLevel(G.level) > 0;
        var allowKey = needKeys && keyCount < G.maxKeysOnGrid();
        var cell = G.randCell(r, c, allowDiamond, allowKey);
        if (cell.diamond) diamondCount++;
        if (cell.key) keyCount++;
        G.set(r, c, cell);
      }
    }
  }

  /** 인접한 한 셀과 그 인접 두 칸을 같은 색으로 만들어 확실히 3매치 생성 (육각·구멍 대응) */
  function forceValidMove() {
    var colors = G.getColorsForLevel(G.level);
    if (colors.length < 1) return;
    var C = colors[0];
    var candidates = [];
    for (var r = 0; r < G.ROWS; r++) {
      for (var c = 0; c < G.COLS; c++) {
        if (!G.inBounds(r, c) || G.holes[r + ',' + c]) continue;
        if (!G.get(r, c)) continue;
        var nb = G.neighbors(r, c);
        if (nb.length < 2) continue;
        for (var i = 0; i < nb.length; i++) {
          var n1 = nb[i];
          if (!G.inBounds(n1.r, n1.c) || G.holes[n1.r + ',' + n1.c]) continue;
          if (!G.get(n1.r, n1.c)) continue;
          for (var j = i + 1; j < nb.length; j++) {
            var n2 = nb[j];
            if (!G.inBounds(n2.r, n2.c) || G.holes[n2.r + ',' + n2.c]) continue;
            if (!G.get(n2.r, n2.c)) continue;
            candidates.push({ r: r, c: c, n1: n1, n2: n2 });
          }
        }
      }
    }
    if (candidates.length === 0) return;
    var pick = candidates[Math.floor(Math.random() * candidates.length)];
    var cell0 = G.get(pick.r, pick.c);
    var cell1 = G.get(pick.n1.r, pick.n1.c);
    var cell2 = G.get(pick.n2.r, pick.n2.c);
    if (!cell0 || !cell1 || !cell2) return;
    G.set(pick.r, pick.c, { color: C, bomb: false, missile: false, cross: false, diamond: cell0.diamond, key: cell0.key });
    G.set(pick.n1.r, pick.n1.c, { color: C, bomb: false, missile: false, cross: false, diamond: cell1.diamond, key: cell1.key });
    G.set(pick.n2.r, pick.n2.c, { color: C, bomb: false, missile: false, cross: false, diamond: cell2.diamond, key: cell2.key });
  }

  /** 리필 후 움직일 수 없을 때 한 번 보드를 다시 채워 유효 수가 나오게 함 */
  G.reshuffleBoard = function () {
    var limit = 50;
    while (!G.hasValidMove() && limit-- > 0) {
      refillAllCells();
      G.resolveInitialMatches();
      ensureMinimumDiamonds();
    }
    if (!G.hasValidMove()) forceValidMove();
  };

  /** 맞출 게 없으면 새로 배치 후 그리기. (연쇄 종료 시·클릭 시 공통) 리셔플했으면 true. */
  G.ensurePlayableBoard = function () {
    if (!G.hasValidMove() && typeof G.reshuffleBoard === 'function') {
      G.reshuffleBoard();
      if (typeof G.draw === 'function') G.draw();
      return true;
    }
    return false;
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

  function minDiamondsOnGridForLevel(lv) {
    if (lv <= 8) return 2;
    if (lv <= 18) return 3;
    if (lv <= 30) return 4;
    if (lv <= 45) return 5;
    return 6;
  }
  function ensureMinimumDiamonds() {
    var want = Math.min(G.maxDiamondsOnGrid(), minDiamondsOnGridForLevel(G.level));
    var cur = G.countDiamondsOnGrid();
    if (cur >= want) return;

    // 아이템/다이아가 아닌 일반 셀을 랜덤하게 다이아로 승격
    var candidates = [];
    for (var r = 0; r < G.ROWS; r++) {
      for (var c = 0; c < G.COLS; c++) {
        var cell = G.get(r, c);
        if (!cell) continue;
        if (cell.diamond || cell.bomb || cell.missile || cell.cross) continue;
        candidates.push({ r: r, c: c });
      }
    }
    for (var i = candidates.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = candidates[i]; candidates[i] = candidates[j]; candidates[j] = tmp;
    }
    for (var k = 0; k < candidates.length && cur < want; k++) {
      var p = candidates[k];
      var cc = G.get(p.r, p.c);
      if (!cc || cc.diamond || cc.bomb || cc.missile || cc.cross) continue;
      cc.diamond = true;
      G.set(p.r, p.c, cc);
      cur++;
    }
  }

  G.refillOnlyRemoved = function (toRemove, allowChainMatch) {
    var seen = {};
    var list = [];
    for (var i = 0; i < toRemove.length; i++) {
      var t = toRemove[i];
      var k = t.r + ',' + t.c;
      if (seen[k]) continue;
      seen[k] = true;
      // 빈칸(구멍/범위 밖/null)은 리필 대상에서 제외
      if (!G.get(t.r, t.c)) continue;
      list.push(t);
    }

    // 제거된 블럭에 인접한 구멍이 있으면 구멍을 해제하고 리필 목록에 추가
    var holeSeen = {};
    for (var i = 0; i < toRemove.length; i++) {
      var t = toRemove[i];
      var nbs = G.neighbors(t.r, t.c);
      for (var j = 0; j < nbs.length; j++) {
        var n = nbs[j];
        var hk = n.r + ',' + n.c;
        if (G.holes[hk] && !holeSeen[hk]) {
          holeSeen[hk] = true;
          delete G.holes[hk];
          list.push({ r: n.r, c: n.c });
        }
      }
    }
    var diamondCount = G.countDiamondsExcluding(list);
    var keyCount = G.countKeysExcluding(list);
    for (var i = 0; i < list.length; i++) {
      var t = list[i];
      var allowDiamond = diamondCount < G.maxDiamondsOnGrid();
      var needKeys = G.getKeysRequiredForLevel(G.level) > 0;
      var allowKey = needKeys && keyCount < G.maxKeysOnGrid();
      G.set(t.r, t.c, G.randCellNoMatch(t.r, t.c, allowDiamond, !!allowChainMatch, allowKey));
      var cc = G.get(t.r, t.c);
      if (cc && cc.diamond) diamondCount++;
      if (cc && cc.key) keyCount++;
    }
    G.totalRemoved += list.length;
    ensureMinimumDiamonds();
    if (!G.hasValidMove()) {
      var limit = 30;
      while (!G.hasValidMove() && limit-- > 0) {
        refillAllCells();
        G.resolveInitialMatches();
        ensureMinimumDiamonds();
      }
      if (!G.hasValidMove()) forceValidMove();
    }
    return list.length;
  };

  G.initGrid = function () {
    var n = G.ROWS * G.COLS;
    G.grid = [];
    for (var i = 0; i < n; i++) G.grid[i] = null;
    G.holes = {};

    // 보드 내부(육각형) 중 빈 슬롯(구멍): 레벨이 올라갈수록 일부 자리를 비움
    var allInBounds = [];
    for (var r = 0; r < G.ROWS; r++)
      for (var c = 0; c < G.COLS; c++)
        if (G.inBounds(r, c)) allInBounds.push({ r: r, c: c });
    var holeCount = Math.min(G.getHoleCountForLevel(G.level), Math.max(0, allInBounds.length - 5));
    for (var h = 0; h < holeCount; h++) {
      var idx = Math.floor(Math.random() * allInBounds.length);
      var p = allInBounds[idx];
      G.holes[p.r + ',' + p.c] = true;
      allInBounds.splice(idx, 1);
    }
    var positions = allInBounds;

    for (var i = positions.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = positions[i]; positions[i] = positions[j]; positions[j] = t;
    }
    var diamondCount = 0;
    var keyCount = 0;
    for (var idx = 0; idx < positions.length; idx++) {
      var p = positions[idx];
      var allowDiamond = diamondCount < G.maxDiamondsOnGrid();
      var needKeys = G.getKeysRequiredForLevel(G.level) > 0;
      var allowKey = needKeys && keyCount < G.maxKeysOnGrid();
      var cell = G.randCell(p.r, p.c, allowDiamond, allowKey);
      if (cell.diamond) diamondCount++;
      if (cell.key) keyCount++;
      G.set(p.r, p.c, cell);
    }
    G.resolveInitialMatches();
    ensureMinimumDiamonds();
    var shuffleLimit = 50;
    while (!G.hasValidMove() && shuffleLimit-- > 0) {
      refillAllCells();
      G.resolveInitialMatches();
      ensureMinimumDiamonds();
    }
    if (!G.hasValidMove()) forceValidMove();
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
        var cell = G.randCell(t.r, t.c, allowDiamond, G.getKeysRequiredForLevel(G.level) > 0 && G.countKeysOnGrid() < G.maxKeysOnGrid());
        if (cell.diamond) diamondCount++;
        G.set(t.r, t.c, cell);
      }
    }
  };

  G.getLevelTimeLimit = function (lv) {
    if (lv <= 1) return 38;
    return 65 + Math.min(lv, 14) * 3;
  };
  G.getRemovedToNextLevel = function (lv) {
    if (lv <= 1) return 10;
    if (lv === 2) return 14;
    if (lv === 3) return 22;
    if (lv === 4) return 30;
    return 30 + (lv - 4) * 8;
  };
})(window.HoneyComb = window.HoneyComb || {});
