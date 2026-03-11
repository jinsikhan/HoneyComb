/**
 * HoneyComb – 그리기 (drawHex, draw, 파티클, 폭탄/미사일/십자 애니)
 */
(function (G) {
  'use strict';

  G.lightenColor = function (hex, amt) {
    var r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
    r = Math.min(255, r + 255 * amt); g = Math.min(255, g + 255 * amt); b = Math.min(255, b + 255 * amt);
    return '#' + [r, g, b].map(function (x) { return ('0' + Math.round(x).toString(16)).slice(-2); }).join('');
  };
  G.darkenColor = function (hex, amt) {
    var r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
    r *= (1 - amt); g *= (1 - amt); b *= (1 - amt);
    return '#' + [r, g, b].map(function (x) { return ('0' + Math.round(x).toString(16)).slice(-2); }).join('');
  };

  G.spawnBurstParticles = function (cellList) {
    var now = Date.now();
    for (var i = 0; i < cellList.length; i++) {
      var rc = cellList[i];
      var cell = G.get(rc.r, rc.c);
      if (!cell) continue;
      var p = G.hexToPixel(rc.r, rc.c);
      var sx = G.gridOffsetX + p.x * G.gridScale;
      var sy = G.gridOffsetY + p.y * G.gridScale;
      var n = 10 + Math.floor(Math.random() * 6);
      var color = cell.color;
      for (var j = 0; j < n; j++) {
        var a = (Math.PI * 2 * j) / n + Math.random() * 0.8;
        var speed = 2.5 + Math.random() * 4;
        G.burstParticles.push({
          x: sx, y: sy,
          vx: Math.cos(a) * speed, vy: Math.sin(a) * speed - 1,
          start: now, life: G.BURST_PARTICLE_LIFE_MS,
          color: color, size: 3 + Math.random() * 4
        });
      }
    }
  };
  G.updateBurstParticles = function (now) {
    for (var i = G.burstParticles.length - 1; i >= 0; i--) {
      var pt = G.burstParticles[i];
      var age = now - pt.start;
      if (age >= pt.life) { G.burstParticles.splice(i, 1); continue; }
      pt.x += pt.vx; pt.y += pt.vy;
      pt.vy += 0.12;
    }
  };
  G.drawBurstParticles = function (ctx, now) {
    for (var i = 0; i < G.burstParticles.length; i++) {
      var pt = G.burstParticles[i];
      var age = now - pt.start;
      var t = age / pt.life;
      var alpha = 1 - t * t;
      if (alpha <= 0) continue;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = pt.color;
      ctx.shadowColor = pt.color;
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.restore();
    }
  };

  G.drawHex = function (x, y, color, isBomb, isMissile, isCross, isDiamond, isSelected) {
    var ctx = G.ctx, R = G.R;
    ctx.beginPath();
    for (var i = 0; i < 6; i++) {
      var a = Math.PI / 2 + (Math.PI / 3) * i;
      var hx = x + R * Math.cos(a), hy = y + R * Math.sin(a);
      if (i === 0) ctx.moveTo(hx, hy); else ctx.lineTo(hx, hy);
    }
    ctx.closePath();
    var gr = ctx.createRadialGradient(x - R * 0.3, y - R * 0.3, 0, x, y, R * 1.2);
    gr.addColorStop(0, G.lightenColor(color, 0.25));
    gr.addColorStop(0.6, color);
    gr.addColorStop(1, G.darkenColor(color, 0.2));
    ctx.fillStyle = gr;
    ctx.fill();
    if (isSelected) {
      ctx.strokeStyle = 'rgba(255,220,120,0.95)';
      ctx.lineWidth = 3;
      ctx.shadowColor = 'rgba(255,200,80,0.6)';
      ctx.shadowBlur = 8;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 1;
    ctx.stroke();
    var iconR = R * 0.36;
    if (isBomb) {
      ctx.save();
      ctx.translate(x, y);
      ctx.fillStyle = '#333';
      ctx.beginPath();
      ctx.arc(0, 0, iconR * 0.85, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#555';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(iconR * 0.5, -iconR * 0.9);
      ctx.lineTo(iconR * 0.9, -iconR * 1.1);
      ctx.stroke();
      ctx.fillStyle = '#ff6b35';
      ctx.beginPath();
      ctx.arc(iconR * 0.9, -iconR * 1.1, iconR * 0.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    } else if (isMissile) {
      ctx.save();
      ctx.translate(x, y);
      ctx.fillStyle = '#e74c3c';
      ctx.beginPath();
      ctx.moveTo(0, -iconR);
      ctx.lineTo(iconR * 0.6, iconR * 0.8);
      ctx.lineTo(0, iconR * 0.5);
      ctx.lineTo(-iconR * 0.6, iconR * 0.8);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#c0392b';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();
    } else if (isCross) {
      ctx.save();
      ctx.translate(x, y);
      ctx.fillStyle = '#f1c40f';
      ctx.strokeStyle = '#d4ac0d';
      ctx.lineWidth = 1;
      for (var i = 0; i < 4; i++) {
        var a = (Math.PI / 2) * i;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(a) * iconR, Math.sin(a) * iconR);
        ctx.lineTo(Math.cos(a + Math.PI / 4) * iconR * 0.6, Math.sin(a + Math.PI / 4) * iconR * 0.6);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
      ctx.restore();
    } else if (isDiamond) {
      ctx.save();
      ctx.translate(x, y);
      ctx.fillStyle = '#7dd3fc';
      ctx.strokeStyle = '#0ea5e9';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, -iconR);
      ctx.lineTo(iconR * 0.85, 0);
      ctx.lineTo(0, iconR);
      ctx.lineTo(-iconR * 0.85, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  };

  G.drawBombAnim = function (bombPositions, elapsed) {
    var t = Math.min(1, elapsed / G.BOMB_ANIM_MS);
    var alpha = 1 - t * 0.9;
    if (alpha <= 0) return;
    var ctx = G.ctx;
    ctx.save();
    for (var b = 0; b < bombPositions.length; b++) {
      var bombPos = bombPositions[b];
      var nb = G.neighbors(bombPos.r, bombPos.c);
      var positions = [{ r: bombPos.r, c: bombPos.c }].concat(nb);
      for (var i = 0; i < positions.length; i++) {
        var p = G.hexToPixel(positions[i].r, positions[i].c);
        var radius = G.R * (0.6 + t * 1.4);
        var gr = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, radius);
        gr.addColorStop(0, 'rgba(255,240,200,' + alpha + ')');
        gr.addColorStop(0.4, 'rgba(255,180,60,' + alpha * 0.9 + ')');
        gr.addColorStop(0.8, 'rgba(255,80,20,' + alpha * 0.5 + ')');
        gr.addColorStop(1, 'rgba(200,40,0,0)');
        ctx.fillStyle = gr;
        ctx.beginPath();
        ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  };
  G.drawMissileAnim = function (missilePos, elapsed) {
    var p = G.hexToPixel(missilePos.r, missilePos.c);
    var t = Math.min(1, elapsed / G.MISSILE_ANIM_MS);
    var alpha = 1 - t * 0.5;
    if (alpha <= 0) return;
    G.ctx.save();
    G.ctx.strokeStyle = 'rgba(120,200,255,' + alpha + ')';
    G.ctx.lineWidth = 6;
    G.ctx.lineCap = 'round';
    G.ctx.beginPath();
    G.ctx.moveTo(0, p.y);
    G.ctx.lineTo(G.canvas.width, p.y);
    G.ctx.stroke();
    G.ctx.restore();
  };
  G.drawCrossAnim = function (crossPos, elapsed) {
    var p = G.hexToPixel(crossPos.r, crossPos.c);
    var t = Math.min(1, elapsed / G.CROSS_ANIM_MS);
    var alpha = 1 - t * 0.5;
    if (alpha <= 0) return;
    G.ctx.save();
    G.ctx.strokeStyle = 'rgba(255,210,100,' + alpha + ')';
    G.ctx.lineWidth = 8;
    G.ctx.lineCap = 'round';
    G.ctx.beginPath();
    G.ctx.moveTo(0, p.y);
    G.ctx.lineTo(G.canvas.width, p.y);
    G.ctx.stroke();
    G.ctx.beginPath();
    G.ctx.moveTo(p.x, 0);
    G.ctx.lineTo(p.x, G.canvas.height);
    G.ctx.stroke();
    G.ctx.restore();
  };

  G.draw = function () {
    var ctx = G.ctx, canvas = G.canvas;
    if (!ctx || !canvas) return;
    ctx.fillStyle = '#0d0d14';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.globalAlpha = 0.04;
    ctx.fillStyle = '#ffc857';
    var step = 24;
    for (var yy = 0; yy < canvas.height + step; yy += step) {
      for (var xx = 0; xx < canvas.width + step; xx += step) {
        if ((xx / step + yy / step) % 2 === 0) {
          ctx.beginPath();
          for (var i = 0; i < 6; i++) {
            var a = (Math.PI / 3) * i;
            var hx = xx + 6 * Math.cos(a), hy = yy + 6 * Math.sin(a);
            if (i === 0) ctx.moveTo(hx, hy); else ctx.lineTo(hx, hy);
          }
          ctx.closePath();
          ctx.fill();
        }
      }
    }
    ctx.restore();
    ctx.save();
    ctx.translate(G.gridOffsetX, G.gridOffsetY);
    ctx.scale(G.gridScale, G.gridScale);
    var sa = G.swapAnim;
    var now = Date.now();
    if (G.refillAnim && (now - G.refillAnim.start) >= G.refillAnim.duration) G.refillAnim = null;
    var refillSet = null;
    if (G.refillAnim) {
      refillSet = {};
      for (var i = 0; i < G.refillAnim.cells.length; i++) {
        var rc = G.refillAnim.cells[i];
        refillSet[rc.r + ',' + rc.c] = true;
      }
    }
    var removeSet = null;
    if (G.removeAnim) {
      removeSet = {};
      for (var i = 0; i < G.removeAnim.cells.length; i++) {
        var rc = G.removeAnim.cells[i];
        removeSet[rc.r + ',' + rc.c] = true;
      }
    }
    for (var r = 0; r < G.ROWS; r++) {
      for (var c = 0; c < G.COLS; c++) {
        if (sa && ((r === sa.r1 && c === sa.c1) || (r === sa.r2 && c === sa.c2))) continue;
        var cell = G.get(r, c);
        if (!cell) continue;
        var p = G.hexToPixel(r, c);
        var isSel = G.selected.some(function (s) { return s.r === r && s.c === c; });
        var isSwap = G.swapFirst && G.swapFirst.r === r && G.swapFirst.c === c;
        if (removeSet && removeSet[r + ',' + c]) {
          var tr = Math.min(1, (now - G.removeAnim.start) / G.removeAnim.duration);
          var easeOut = 1 - Math.pow(1 - tr, 3);
          var scale = 1 - easeOut * 0.85;
          var alpha = 1 - easeOut;
          ctx.save();
          ctx.globalAlpha = Math.max(0, alpha);
          ctx.translate(p.x, p.y);
          ctx.scale(scale, scale);
          ctx.translate(-p.x, -p.y);
          G.drawHex(p.x, p.y, cell.color, cell.bomb, cell.missile, cell.cross, cell.diamond, false);
          ctx.restore();
        } else if (refillSet && refillSet[r + ',' + c]) {
          var t = Math.min(1, (now - G.refillAnim.start) / G.refillAnim.duration);
          var ease = 1 - Math.pow(1 - t, 3);
          var scaleZ = 0.25 + 0.75 * ease;
          var alphaZ = Math.min(1, ease * 1.4);
          ctx.save();
          ctx.globalAlpha = alphaZ;
          ctx.translate(p.x, p.y);
          ctx.scale(scaleZ, scaleZ);
          ctx.translate(-p.x, -p.y);
          G.drawHex(p.x, p.y, cell.color, cell.bomb, cell.missile, cell.cross, cell.diamond, isSel || isSwap);
          ctx.restore();
        } else {
          G.drawHex(p.x, p.y, cell.color, cell.bomb, cell.missile, cell.cross, cell.diamond, isSel || isSwap);
        }
      }
    }
    if (sa) {
      var t = Math.min(1, (Date.now() - sa.start) / G.SWAP_ANIM_DURATION_MS);
      t = 1 - Math.pow(1 - t, 3);
      var p1 = G.hexToPixel(sa.r1, sa.c1), p2 = G.hexToPixel(sa.r2, sa.c2);
      var x1 = p1.x + (p2.x - p1.x) * t, y1 = p1.y + (p2.y - p1.y) * t;
      var x2 = p2.x + (p1.x - p2.x) * t, y2 = p2.y + (p1.y - p2.y) * t;
      G.drawHex(x1, y1, sa.cellA.color, sa.cellA.bomb, sa.cellA.missile, sa.cellA.cross, sa.cellA.diamond, false);
      G.drawHex(x2, y2, sa.cellB.color, sa.cellB.bomb, sa.cellB.missile, sa.cellB.cross, sa.cellB.diamond, false);
    }
    ctx.restore();
    G.updateBurstParticles(now);
    G.drawBurstParticles(ctx, now);
    if (now < G.matchFlashUntil) {
      ctx.save();
      var flashAlpha = 1 - (now - (G.matchFlashUntil - 100)) / 100;
      ctx.fillStyle = 'rgba(255,255,255,' + flashAlpha * 0.35 + ')';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
    }
    if (!G.gameOver && G.lastKnownTimeLeft <= 5 && G.lastKnownTimeLeft >= 0) {
      ctx.save();
      var flicker = 0.15 + 0.08 * Math.sin(Date.now() / 120);
      ctx.fillStyle = 'rgba(200,50,50,' + Math.max(0, flicker) + ')';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
    }
    if (now < G.comboShowUntil && G.comboText) {
      ctx.save();
      ctx.fillStyle = '#fff';
      ctx.strokeStyle = '#f1c40f';
      ctx.lineWidth = 3;
      ctx.font = 'bold 24px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.strokeText(G.comboText, canvas.width / 2, 50);
      ctx.fillText(G.comboText, canvas.width / 2, 50);
      ctx.restore();
    }
    if (now < G.missionCompleteUntil && G.missionCompleteText) {
      ctx.save();
      var age = now - (G.missionCompleteUntil - 900);
      var alpha = age < 120 ? age / 120 : (age > 780 ? (900 - age) / 120 : 1);
      ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
      ctx.fillStyle = '#fff';
      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth = 4;
      ctx.font = 'bold 28px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.strokeText(G.missionCompleteText, canvas.width / 2, 92);
      ctx.fillText(G.missionCompleteText, canvas.width / 2, 92);
      ctx.restore();
    }
    if (now < G.badgeUntil && G.badgeText) {
      ctx.save();
      var badgeAge = now - (G.badgeUntil - 1200);
      var bounce = badgeAge < 200 ? (badgeAge / 200) * 1.35 : (badgeAge < 350 ? 1.35 - (badgeAge - 200) / 150 * 0.2 : 1.15 + 0.05 * Math.sin((now - (G.badgeUntil - 1200 + 350)) / 100));
      var badgeScale = Math.min(1.2, bounce);
      var badgeAlpha = badgeAge < 80 ? badgeAge / 80 : (badgeAge > 1000 ? (1200 - badgeAge) / 200 : 1);
      ctx.globalAlpha = badgeAlpha;
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.scale(badgeScale, badgeScale);
      ctx.translate(-canvas.width / 2, -canvas.height / 2);
      ctx.shadowColor = 'rgba(255,200,80,0.9)';
      ctx.shadowBlur = 25;
      ctx.fillStyle = '#fff';
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 6;
      ctx.font = 'bold 56px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.strokeText(G.badgeText, canvas.width / 2, canvas.height / 2);
      ctx.fillText(G.badgeText, canvas.width / 2, canvas.height / 2);
      ctx.shadowBlur = 0;
      ctx.restore();
      for (var pi = G.badgeParticles.length - 1; pi >= 0; pi--) {
        var pt = G.badgeParticles[pi];
        var page = now - pt.start;
        if (page > 500) { G.badgeParticles.splice(pi, 1); continue; }
        var px = pt.x + pt.vx * page;
        var py = pt.y + pt.vy * page;
        var pa = 1 - page / 500;
        ctx.save();
        ctx.globalAlpha = pa;
        ctx.fillStyle = '#fbbf24';
        ctx.shadowColor = '#f59e0b';
        ctx.shadowBlur = 4;
        ctx.beginPath();
        ctx.arc(px, py, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.restore();
      }
    }
    for (var i = G.scorePopups.length - 1; i >= 0; i--) {
      var pop = G.scorePopups[i];
      var age = now - pop.start;
      if (age > 800) { G.scorePopups.splice(i, 1); continue; }
      var alpha = age < 100 ? 1 : 1 - (age - 100) / 700;
      ctx.save();
      ctx.font = 'bold 22px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(255,255,255,' + alpha + ')';
      ctx.fillText('+' + pop.score, pop.x, pop.y - age * 0.08);
      ctx.restore();
    }
    if (now < G.bigTextUntil && G.bigText) {
      ctx.save();
      ctx.fillStyle = '#fff';
      ctx.strokeStyle = '#f1c40f';
      ctx.lineWidth = 4;
      ctx.font = 'bold 32px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.strokeText(G.bigText, canvas.width / 2, 80);
      ctx.fillText(G.bigText, canvas.width / 2, 80);
      ctx.restore();
    }
    if (now < G.levelUpUntil) {
      var levelUpElapsed = now - G.levelUpStartTime;
      var levelUpT = Math.min(1, levelUpElapsed / G.LEVEL_UP_DURATION_MS);
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.5 + 0.2 * (1 - levelUpT))';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      var cx = canvas.width / 2, cy = canvas.height / 2;
      var hexRadius = 18;
      for (var ring = 0; ring < 3; ring++) {
        var expandT = Math.min(1, (levelUpElapsed - ring * 120) / 400);
        if (expandT <= 0) continue;
        var ease = 1 - Math.pow(1 - expandT, 2);
        var rad = 40 + ring * 38 + ease * 90;
        var alpha = (1 - levelUpT * 0.7) * (1 - ring * 0.25);
        var count = 6 + ring * 2;
        for (var i = 0; i < count; i++) {
          var a = (Math.PI * 2 * i) / count + levelUpElapsed * 0.002;
          var hx = cx + rad * Math.cos(a);
          var hy = cy + rad * Math.sin(a);
          ctx.save();
          ctx.globalAlpha = alpha;
          ctx.translate(hx, hy);
          ctx.rotate(a);
          ctx.fillStyle = ring === 0 ? 'rgba(255,200,80,0.95)' : (ring === 1 ? 'rgba(245,180,60,0.85)' : 'rgba(230,160,40,0.6)');
          ctx.strokeStyle = 'rgba(255,230,150,0.9)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          for (var v = 0; v < 6; v++) {
            var va = Math.PI / 2 + (Math.PI / 3) * v;
            var vx = hexRadius * Math.cos(va), vy = hexRadius * Math.sin(va);
            if (v === 0) ctx.moveTo(vx, vy); else ctx.lineTo(vx, vy);
          }
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          ctx.restore();
        }
      }
      var textT = Math.min(1, (levelUpElapsed - 300) / 400);
      var textAlpha = textT < 0 ? 0 : (levelUpElapsed > 1200 ? (G.LEVEL_UP_DURATION_MS - levelUpElapsed) / 600 : 1);
      if (textAlpha > 0) {
        ctx.save();
        ctx.globalAlpha = textAlpha;
        ctx.fillStyle = '#fff';
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 5;
        ctx.font = 'bold 36px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.strokeText('⭐ 레벨 ' + G.level + ' ⭐', cx, cy);
        ctx.fillText('⭐ 레벨 ' + G.level + ' ⭐', cx, cy);
        ctx.restore();
      }
      ctx.restore();
    }
    if (G.gameOver) {
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.85)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#f87171';
      ctx.font = 'bold 26px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('⏱ 시간 초과!', canvas.width / 2, canvas.height / 2 - 35);
      ctx.fillStyle = '#fbbf24';
      ctx.font = 'bold 22px sans-serif';
      ctx.fillText('최종 점수: ' + G.score, canvas.width / 2, canvas.height / 2 + 5);
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.font = '14px sans-serif';
      ctx.fillText('아래 버튼을 눌러 주세요', canvas.width / 2, canvas.height / 2 + 45);
      ctx.restore();
    }
    if (G.hexAnim) {
      ctx.save();
      ctx.translate(G.gridOffsetX, G.gridOffsetY);
      ctx.scale(G.gridScale, G.gridScale);
      ctx.globalAlpha = 1;
      ctx.shadowBlur = 0;
      var elapsed = Date.now() - G.hexAnim.start;
      if (G.hexAnim.bombPositions && G.hexAnim.bombPositions.length) G.drawBombAnim(G.hexAnim.bombPositions, elapsed);
      if (G.hexAnim.missilePos) G.drawMissileAnim(G.hexAnim.missilePos, elapsed);
      if (G.hexAnim.crossPos) G.drawCrossAnim(G.hexAnim.crossPos, elapsed);
      ctx.restore();
    }
  };
})(window.HoneyComb = window.HoneyComb || {});
