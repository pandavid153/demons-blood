'use strict';
/* ============================================================
   DEMON'S BLOOD — sprite & animation library
   All art is procedurally drawn (canvas 2D).
   ============================================================ */

const Sprites = (() => {
  const TAU = Math.PI * 2;

  /* ---------------- color utils ---------------- */
  function parse(hex) {
    let h = hex.replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    const n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  function rgba(hex, a) {
    const c = parse(hex);
    return `rgba(${c[0]},${c[1]},${c[2]},${a})`;
  }
  function mix(hexA, hexB, t) {
    const a = parse(hexA), b = parse(hexB);
    const c = a.map((v, i) => Math.round(v + (b[i] - v) * t));
    return `rgb(${c[0]},${c[1]},${c[2]})`;
  }
  function lighten(hex, t) { return mix(hex, '#ffffff', t); }
  function darken(hex, t) { return mix(hex, '#000000', t); }

  function glow(ctx, x, y, r, color, a = 1) {
    if (r <= 0 || a <= 0) return;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, rgba(color, a));
    g.addColorStop(0.4, rgba(color, a * 0.42));
    g.addColorStop(1, rgba(color, 0));
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  }

  function mulberry32(seed) {
    let s = seed >>> 0;
    return function () {
      s = (s + 0x6D2B79F5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function poly(ctx, pts, close = true) {
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    if (close) ctx.closePath();
  }

  /* ============================================================
     STATIC BACKGROUND (corrupted wasteland + bleeding road)
     ============================================================ */
  function buildBackground(opt) {
    const { w, h, tile, waypoints, decor } = opt;
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const g = c.getContext('2d');
    const R = mulberry32(1337);

    // base ground
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#16121a');
    grad.addColorStop(0.5, '#1a141b');
    grad.addColorStop(1, '#120e15');
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);

    // mottled patches
    for (let i = 0; i < 380; i++) {
      const x = R() * w, y = R() * h, r = 8 + R() * 46;
      const dark = R() < 0.6;
      g.fillStyle = dark ? `rgba(8,5,10,${0.05 + R() * 0.1})` : `rgba(70,52,64,${0.03 + R() * 0.05})`;
      g.beginPath(); g.ellipse(x, y, r, r * (0.5 + R() * 0.6), R() * TAU, 0, TAU); g.fill();
    }
    // veins of corrupted blood in the soil
    g.lineCap = 'round';
    for (let i = 0; i < 26; i++) {
      let x = R() * w, y = R() * h;
      g.strokeStyle = `rgba(120,20,32,${0.05 + R() * 0.07})`;
      g.lineWidth = 1 + R() * 1.6;
      g.beginPath(); g.moveTo(x, y);
      for (let s = 0; s < 5; s++) {
        x += (R() - 0.5) * 90; y += (R() - 0.5) * 90;
        g.lineTo(x, y);
      }
      g.stroke();
    }

    /* ---- the road ---- */
    const road = (width, color) => {
      g.lineWidth = width; g.strokeStyle = color;
      g.lineJoin = 'round'; g.lineCap = 'round';
      g.beginPath();
      g.moveTo(waypoints[0].x, waypoints[0].y);
      for (let i = 1; i < waypoints.length; i++) g.lineTo(waypoints[i].x, waypoints[i].y);
      g.stroke();
    };
    road(tile + 30, 'rgba(0,0,0,0.55)');
    road(tile + 18, '#0d0a10');
    road(tile + 6, '#28222b');
    road(tile - 8, '#2e2732');

    // road cracks & stones
    const seg = [];
    let total = 0;
    for (let i = 1; i < waypoints.length; i++) {
      const dx = waypoints[i].x - waypoints[i - 1].x, dy = waypoints[i].y - waypoints[i - 1].y;
      const len = Math.hypot(dx, dy);
      seg.push({ x: waypoints[i - 1].x, y: waypoints[i - 1].y, dx: dx / len, dy: dy / len, len });
      total += len;
    }
    for (let i = 0; i < 300; i++) {
      const d = R() * total;
      let acc = 0, k = 0;
      for (; k < seg.length; k++) { if (acc + seg[k].len >= d) break; acc += seg[k].len; }
      if (k >= seg.length) k = seg.length - 1;
      const t = d - acc;
      const px = seg[k].x + seg[k].dx * t, py = seg[k].y + seg[k].dy * t;
      const off = (R() - 0.5) * (tile - 10);
      const x = px - seg[k].dy * off, y = py + seg[k].dx * off;
      const r = 2 + R() * 6;
      g.fillStyle = R() < 0.5 ? `rgba(52,45,56,${0.5 + R() * 0.4})` : `rgba(15,12,18,${0.5 + R() * 0.4})`;
      g.beginPath(); g.ellipse(x, y, r, r * 0.7, R() * TAU, 0, TAU); g.fill();
      if (R() < 0.25) { // small bone
        g.strokeStyle = 'rgba(196,186,166,0.5)'; g.lineWidth = 1.6;
        g.beginPath(); g.moveTo(x - 4, y); g.lineTo(x + 4, y + 1); g.stroke();
      }
    }
    // faint road center glow line (path energy)
    g.setLineDash([16, 26]);
    g.lineWidth = 2.5;
    g.strokeStyle = 'rgba(150,40,54,0.16)';
    g.beginPath();
    g.moveTo(waypoints[0].x, waypoints[0].y);
    for (let i = 1; i < waypoints.length; i++) g.lineTo(waypoints[i].x, waypoints[i].y);
    g.stroke();
    g.setLineDash([]);

    /* ---- decor ---- */
    for (const d of decor) {
      const x = (d.tx + 0.5) * tile, y = (d.ty + 0.5) * tile;
      drawDecorStatic(g, d.kind, x, y, R);
    }

    /* ---- grid hint (very faint buildable tiles) ---- */
    g.strokeStyle = 'rgba(255,255,255,0.022)';
    g.lineWidth = 1;
    for (let cx = 0; cx <= w; cx += tile) { g.beginPath(); g.moveTo(cx, 0); g.lineTo(cx, h); g.stroke(); }
    for (let cy = 0; cy <= h; cy += tile) { g.beginPath(); g.moveTo(0, cy); g.lineTo(w, cy); g.stroke(); }

    return c;
  }

  function drawDecorStatic(g, kind, x, y, R) {
    if (kind === 'rock') {
      g.fillStyle = 'rgba(0,0,0,0.4)';
      g.beginPath(); g.ellipse(x + 3, y + 14, 24, 9, 0, 0, TAU); g.fill();
      const pts = [];
      const n = 7;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * TAU;
        const r = 15 + R() * 12;
        pts.push([Math.cos(a) * r, Math.sin(a) * r * 0.72]);
      }
      g.save(); g.translate(x, y + 2);
      const rg = g.createLinearGradient(0, -18, 0, 16);
      rg.addColorStop(0, '#453b4a'); rg.addColorStop(1, '#241d29');
      g.fillStyle = rg; poly(g, pts); g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.55)'; g.lineWidth = 2; g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.05)';
      poly(g, [[-10, -8], [0, -14], [8, -6], [-2, -2]]); g.fill();
      g.restore();
    } else if (kind === 'bones' || kind === 'skulls') {
      g.save(); g.translate(x, y);
      // pile of bones
      g.strokeStyle = '#b9ae95'; g.lineCap = 'round';
      for (let i = 0; i < 7; i++) {
        g.lineWidth = 3 + R() * 2;
        const a = R() * TAU, l = 12 + R() * 16;
        const bx = (R() - 0.5) * 34, by = (R() - 0.5) * 26;
        g.beginPath();
        g.moveTo(bx - Math.cos(a) * l / 2, by - Math.sin(a) * l / 2);
        g.lineTo(bx + Math.cos(a) * l / 2, by + Math.sin(a) * l / 2);
        g.stroke();
        g.fillStyle = '#cfc4ab';
        g.beginPath(); g.arc(bx - Math.cos(a) * l / 2, by - Math.sin(a) * l / 2, 2.8, 0, TAU); g.fill();
        g.beginPath(); g.arc(bx + Math.cos(a) * l / 2, by + Math.sin(a) * l / 2, 2.8, 0, TAU); g.fill();
      }
      // skull
      g.fillStyle = '#cec3a9';
      g.beginPath(); g.ellipse(0, -4, 9, 8, 0, 0, TAU); g.fill();
      g.fillRect(-5, 1, 10, 6);
      g.fillStyle = '#241b20';
      g.beginPath(); g.ellipse(-3.5, -5, 2.6, 3, 0, 0, TAU); g.fill();
      g.beginPath(); g.ellipse(3.5, -5, 2.6, 3, 0, 0, TAU); g.fill();
      g.fillRect(-1, -1, 2, 4);
      g.restore();
    } else if (kind === 'pool') {
      // congealed blood pool
      for (let i = 0; i < 4; i++) {
        const ox = (R() - 0.5) * 26, oy = (R() - 0.5) * 20, r = 12 + R() * 14;
        const pg = g.createRadialGradient(x + ox, y + oy, 1, x + ox, y + oy, r);
        pg.addColorStop(0, 'rgba(112,14,26,0.85)');
        pg.addColorStop(0.7, 'rgba(70,8,16,0.8)');
        pg.addColorStop(1, 'rgba(40,5,10,0)');
        g.fillStyle = pg;
        g.beginPath(); g.ellipse(x + ox, y + oy, r, r * 0.7, 0, 0, TAU); g.fill();
      }
      g.fillStyle = 'rgba(200,60,70,0.25)';
      g.beginPath(); g.ellipse(x - 6, y - 5, 7, 4, 0.4, 0, TAU); g.fill();
    } else if (kind === 'tree') {
      // dead twisted tree
      g.save(); g.translate(x, y);
      g.fillStyle = 'rgba(0,0,0,0.45)';
      g.beginPath(); g.ellipse(4, 20, 22, 8, 0, 0, TAU); g.fill();
      g.strokeStyle = '#241a20'; g.lineCap = 'round';
      g.lineWidth = 9;
      g.beginPath(); g.moveTo(0, 20); g.quadraticCurveTo(-4, -4, 3, -20); g.stroke();
      g.lineWidth = 5;
      g.beginPath(); g.moveTo(2, -14); g.quadraticCurveTo(-14, -24, -20, -34); g.stroke();
      g.beginPath(); g.moveTo(2, -18); g.quadraticCurveTo(16, -26, 22, -36); g.stroke();
      g.lineWidth = 3;
      g.beginPath(); g.moveTo(-10, -26); g.quadraticCurveTo(-16, -36, -14, -44); g.stroke();
      g.beginPath(); g.moveTo(14, -30); g.quadraticCurveTo(20, -40, 18, -46); g.stroke();
      g.strokeStyle = 'rgba(120,30,44,0.35)'; g.lineWidth = 1.4;
      g.beginPath(); g.moveTo(0, 14); g.quadraticCurveTo(-2, -6, 3, -18); g.stroke();
      g.restore();
    } else if (kind === 'pillar') {
      g.save(); g.translate(x, y);
      g.fillStyle = 'rgba(0,0,0,0.5)';
      g.beginPath(); g.ellipse(2, 24, 20, 8, 0, 0, TAU); g.fill();
      // base
      g.fillStyle = '#2a2230';
      g.fillRect(-14, 14, 28, 10);
      g.strokeStyle = 'rgba(0,0,0,0.6)'; g.lineWidth = 1.5;
      g.strokeRect(-14, 14, 28, 10);
      // shaft
      const sg = g.createLinearGradient(-10, 0, 10, 0);
      sg.addColorStop(0, '#3a3043'); sg.addColorStop(0.5, '#4a3f55'); sg.addColorStop(1, '#241d2c');
      g.fillStyle = sg;
      g.fillRect(-9, -30, 18, 44);
      g.strokeRect(-9, -30, 18, 44);
      // cracks
      g.strokeStyle = 'rgba(0,0,0,0.55)'; g.lineWidth = 1.2;
      g.beginPath(); g.moveTo(-4, -24); g.lineTo(-1, -10); g.lineTo(-5, 2); g.stroke();
      g.beginPath(); g.moveTo(5, -18); g.lineTo(3, -4); g.stroke();
      // capital
      g.fillStyle = '#332a3c';
      g.fillRect(-13, -38, 26, 10);
      g.strokeRect(-13, -38, 26, 10);
      g.restore();
    } else if (kind === 'crystal_red' || kind === 'crystal_purple') {
      const col = kind === 'crystal_red' ? '#c22a3c' : '#7d3fd6';
      g.save(); g.translate(x, y);
      g.fillStyle = 'rgba(0,0,0,0.5)';
      g.beginPath(); g.ellipse(2, 22, 20, 7, 0, 0, TAU); g.fill();
      // rock base
      g.fillStyle = '#26202c';
      poly(g, [[-16, 22], [-10, 10], [0, 8], [12, 12], [17, 22]]); g.fill();
      // crystal shards
      const shard = (ox, oy, hh, ww, tilt) => {
        g.save(); g.translate(ox, oy); g.rotate(tilt);
        const cg = g.createLinearGradient(-ww, 0, ww, 0);
        cg.addColorStop(0, darken(col, 0.55));
        cg.addColorStop(0.5, lighten(col, 0.25));
        cg.addColorStop(1, darken(col, 0.35));
        g.fillStyle = cg;
        poly(g, [[0, -hh], [ww, -hh * 0.25], [ww * 0.6, 0], [-ww * 0.6, 0], [-ww, -hh * 0.25]]);
        g.fill();
        g.strokeStyle = rgba(col, 0.85); g.lineWidth = 1.2; g.stroke();
        g.fillStyle = 'rgba(255,255,255,0.35)';
        poly(g, [[0, -hh], [ww * 0.35, -hh * 0.3], [-ww * 0.2, -hh * 0.25]]); g.fill();
        g.restore();
      };
      shard(-4, 12, 34, 8, -0.16);
      shard(8, 14, 24, 6, 0.22);
      shard(-14, 16, 16, 5, -0.4);
      glow(g, 0, -6, 34, col, 0.35);
      g.restore();
    }
  }

  /* ============================================================
     ANIMATED ENVIRONMENT
     ============================================================ */
  function drawSpawnRift(ctx, x, y, t) {
    const p = (Math.sin(t * 2.2) + 1) / 2;
    glow(ctx, x, y, 66 + p * 14, '#8d1526', 0.75);
    glow(ctx, x, y, 34, '#e0374a', 0.6 + p * 0.3);
    ctx.save();
    ctx.translate(x, y);
    for (let i = 0; i < 3; i++) {
      ctx.strokeStyle = rgba('#ff5566', 0.5 - i * 0.12);
      ctx.lineWidth = 3 - i * 0.7;
      ctx.beginPath();
      const rx = 12 + i * 7 + p * 4, ry = 46 - i * 6;
      ctx.ellipse(0, 0, rx, ry, Math.sin(t * 1.4 + i) * 0.16, 0, TAU);
      ctx.stroke();
    }
    // jagged tear
    ctx.strokeStyle = '#ffd9dd'; ctx.lineWidth = 2.2;
    ctx.beginPath();
    for (let i = -5; i <= 5; i++) {
      const yy = i * 9;
      const wob = Math.sin(t * 9 + i * 2.1) * 6;
      if (i === -5) ctx.moveTo(wob, yy); else ctx.lineTo(wob, yy);
    }
    ctx.stroke();
    ctx.restore();
  }

  function drawPortal(ctx, x, y, t) {
    const p = (Math.sin(t * 1.7) + 1) / 2;
    glow(ctx, x, y, 96 + p * 16, '#6d1f8f', 0.65);
    glow(ctx, x, y, 52, '#c74bff', 0.55);
    ctx.save();
    ctx.translate(x, y);
    // vortex rings
    for (let i = 0; i < 4; i++) {
      const rot = t * (0.8 + i * 0.45) * (i % 2 ? -1 : 1);
      const r = 20 + i * 12;
      ctx.strokeStyle = rgba(i % 2 ? '#e48bff' : '#8f2fff', 0.65 - i * 0.1);
      ctx.lineWidth = 3.4 - i * 0.5;
      ctx.beginPath();
      ctx.arc(0, 0, r, rot, rot + Math.PI * 1.25);
      ctx.stroke();
    }
    // eye core
    const eg = ctx.createRadialGradient(0, 0, 2, 0, 0, 26);
    eg.addColorStop(0, '#ffffff');
    eg.addColorStop(0.3, '#ffb3ff');
    eg.addColorStop(0.75, '#a326d6');
    eg.addColorStop(1, 'rgba(90,10,130,0)');
    ctx.fillStyle = eg;
    ctx.beginPath(); ctx.ellipse(0, 0, 24 + p * 4, 30, 0, 0, TAU); ctx.fill();
    // stone arch
    ctx.strokeStyle = '#17111c'; ctx.lineWidth = 14;
    ctx.beginPath(); ctx.arc(0, 6, 52, Math.PI * 1.08, Math.PI * 1.92); ctx.stroke();
    ctx.strokeStyle = '#372c40'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(0, 6, 52, Math.PI * 1.08, Math.PI * 1.92); ctx.stroke();
    ctx.restore();
  }

  function drawDecorOverlay(ctx, decor, tile, t) {
    for (const d of decor) {
      const x = (d.tx + 0.5) * tile, y = (d.ty + 0.5) * tile;
      if (d.kind === 'crystal_red' || d.kind === 'crystal_purple') {
        const col = d.kind === 'crystal_red' ? '#ff3d52' : '#a45cff';
        const p = (Math.sin(t * 2 + d.tx * 1.7 + d.ty) + 1) / 2;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        glow(ctx, x, y - 8, 42 + p * 12, col, 0.30 + p * 0.16);
        ctx.restore();
      } else if (d.kind === 'pillar') {
        // brazier flame on capital
        const fx = x, fy = y - 42;
        const fl = Math.sin(t * 11 + d.tx * 3) * 0.5 + Math.sin(t * 7.3 + d.ty * 5) * 0.5;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        glow(ctx, fx, fy - 6, 34 + fl * 7, '#ff9a3c', 0.55);
        ctx.fillStyle = rgba('#ffd27a', 0.85);
        ctx.beginPath();
        ctx.ellipse(fx, fy - 8 + fl * 2, 4.4, 8 + fl * 3, 0, 0, TAU);
        ctx.fill();
        ctx.fillStyle = rgba('#fff6d0', 0.95);
        ctx.beginPath();
        ctx.ellipse(fx, fy - 6 + fl * 2, 2.2, 4.4, 0, 0, TAU);
        ctx.fill();
        ctx.restore();
      } else if (d.kind === 'pool') {
        const p = (Math.sin(t * 1.4 + d.tx) + 1) / 2;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        glow(ctx, x, y, 30, '#c2203a', 0.10 + p * 0.09);
        ctx.restore();
      }
    }
  }

  function drawVignette(ctx, w, h, t) {
    const p = (Math.sin(t * 0.7) + 1) / 2;
    const g = ctx.createRadialGradient(w / 2, h / 2, h * 0.42, w / 2, h / 2, h * 0.95);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, `rgba(2,1,4,${0.62 + p * 0.05})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }

  function drawFog(ctx, w, h, t) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 4; i++) {
      const x = (w * (i * 0.31 + 0.1) + Math.sin(t * 0.11 + i * 2) * 140 + w) % (w + 260) - 130;
      const y = h * (0.25 + 0.2 * Math.sin(i * 3.1)) + Math.cos(t * 0.09 + i) * 40;
      const r = 200 + i * 46;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, 'rgba(96,70,110,0.05)');
      g.addColorStop(1, 'rgba(96,70,110,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.5, 0, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  /* ============================================================
     TOWERS
     ============================================================ */
  function towerBase(ctx, t, level, accent) {
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath(); ctx.ellipse(0, 15, 26, 9, 0, 0, TAU); ctx.fill();
    // slab
    const g = ctx.createLinearGradient(0, 2, 0, 16);
    g.addColorStop(0, '#3b3340'); g.addColorStop(1, '#17131c');
    ctx.fillStyle = g;
    poly(ctx, [[-24, 6], [-19, -6], [19, -6], [24, 6], [17, 15], [-17, 15]]);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.65)'; ctx.lineWidth = 1.6; ctx.stroke();
    // rune ring
    const pulse = 0.4 + Math.sin(t * 2.1) * 0.18 + level * 0.06;
    ctx.save();
    ctx.translate(0, 5);
    ctx.rotate(t * 0.25);
    ctx.strokeStyle = rgba(accent, Math.min(0.9, pulse));
    ctx.lineWidth = 1.6;
    ctx.setLineDash([7, 9]);
    ctx.beginPath(); ctx.arc(0, 0, 21, 0, TAU); ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
    // corner rivets
    ctx.fillStyle = rgba(accent, 0.75);
    for (const [rx, ry] of [[-19, 4], [19, 4], [0, 12]]) {
      ctx.beginPath(); ctx.arc(rx, ry, 1.8, 0, TAU); ctx.fill();
    }
  }

  function aimMuzzle(ctx, angle, dist, color, t, fire) {
    const mx = Math.cos(angle) * dist, my = Math.sin(angle) * dist;
    if (fire > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      glow(ctx, mx, my, 16 + fire * 30, color, Math.min(1, fire * 5));
      ctx.restore();
    }
    return [mx, my];
  }

  function drawBloodSpire(ctx, x, y, level, o) {
    const t = o.t;
    ctx.save(); ctx.translate(x, y);
    towerBase(ctx, t, level, '#e04552');

    const h = 46 + level * 9;
    // shaft
    const sg = ctx.createLinearGradient(-13, 0, 13, 0);
    sg.addColorStop(0, '#231a26'); sg.addColorStop(0.45, '#453650'); sg.addColorStop(1, '#151019');
    ctx.fillStyle = sg;
    poly(ctx, [[-13, 4], [-8, -h], [8, -h], [13, 4]]);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.lineWidth = 1.8; ctx.stroke();
    // glowing cracks
    ctx.strokeStyle = rgba('#ff3d52', 0.55 + Math.sin(t * 3) * 0.2);
    ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(-4, 2); ctx.lineTo(-6, -h * 0.4); ctx.lineTo(-2, -h * 0.62); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(5, 0); ctx.lineTo(3, -h * 0.32); ctx.stroke();
    // spikes at level>=2
    if (level >= 2) {
      ctx.fillStyle = '#1c1520';
      poly(ctx, [[-13, -h * 0.3], [-24, -h * 0.34], [-13, -h * 0.44]]); ctx.fill();
      poly(ctx, [[13, -h * 0.5], [24, -h * 0.54], [13, -h * 0.64]]); ctx.fill();
      ctx.strokeStyle = rgba('#e04552', 0.5); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(-23, -h * 0.34); ctx.lineTo(-14, -h * 0.36); ctx.stroke();
    }
    // crown
    ctx.fillStyle = '#2a2030';
    poly(ctx, [[-9, -h], [-5, -h - 9], [0, -h - 3], [5, -h - 9], [9, -h]]); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 1.4; ctx.stroke();

    // floating gem (aims at target)
    const gx = Math.cos(o.angle) * 5, gy = -h - 16 + Math.sin(t * 2.4) * 3;
    ctx.save();
    ctx.translate(gx, gy);
    ctx.rotate(t * 1.4);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    glow(ctx, 0, 0, 20 + level * 5 + Math.sin(t * 4) * 3, '#ff2f45', 0.85);
    ctx.restore();
    const gemG = ctx.createLinearGradient(-7, -7, 7, 7);
    gemG.addColorStop(0, '#ff8b96'); gemG.addColorStop(0.5, '#d6283c'); gemG.addColorStop(1, '#71091a');
    ctx.fillStyle = gemG;
    poly(ctx, [[0, -9], [7, 0], [0, 9], [-7, 0]]); ctx.fill();
    ctx.strokeStyle = '#ffd9dd'; ctx.lineWidth = 1.1; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    poly(ctx, [[0, -9], [3.5, -1], [-2, 0]]); ctx.fill();
    ctx.restore();

    // orbiting shards (level 3)
    if (level >= 3) {
      for (let i = 0; i < 3; i++) {
        const a = t * 2 + (i / 3) * TAU;
        const ox = Math.cos(a) * 26, oy = -h * 0.6 + Math.sin(a) * 12;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        glow(ctx, ox, oy, 9, '#ff2f45', 0.6);
        ctx.restore();
        ctx.fillStyle = '#ff6b7a';
        poly(ctx, [[ox, oy - 5], [ox + 3.5, oy], [ox, oy + 5], [ox - 3.5, oy]]); ctx.fill();
      }
    }
    aimMuzzle(ctx, o.angle, 18, '#ff2f45', t, o.fire);
    ctx.restore();
  }

  function drawFrostShrine(ctx, x, y, level, o) {
    const t = o.t;
    ctx.save(); ctx.translate(x, y);
    towerBase(ctx, t, level, '#6fd6ff');

    // ring of standing stones
    const stones = 5 + level;
    for (let i = 0; i < stones; i++) {
      const a = (i / stones) * TAU + 0.3;
      const sx = Math.cos(a) * 21, sy = Math.sin(a) * 7 + 2;
      const hgt = 9 + ((i * 7) % 5);
      ctx.fillStyle = i % 2 ? '#39404d' : '#2b313c';
      poly(ctx, [[sx - 4, sy], [sx - 3, sy - hgt], [sx + 3, sy - hgt], [sx + 4, sy]]); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1; ctx.stroke();
    }

    const crystal = (cx, cy, s, phase) => {
      const p = (Math.sin(t * 3 + phase) + 1) / 2;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      glow(ctx, cx, cy, 18 * s + p * 8, '#66d9ff', 0.65);
      ctx.restore();
      ctx.save();
      ctx.translate(cx, cy + Math.sin(t * 1.8 + phase) * 2);
      const cg = ctx.createLinearGradient(-8 * s, 0, 8 * s, 0);
      cg.addColorStop(0, '#1c5f86'); cg.addColorStop(0.5, '#bdf1ff'); cg.addColorStop(1, '#2a7ba8');
      ctx.fillStyle = cg;
      // octahedron
      poly(ctx, [[0, -16 * s], [8 * s, -4 * s], [5 * s, 8 * s], [-5 * s, 8 * s], [-8 * s, -4 * s]]);
      ctx.fill();
      ctx.strokeStyle = rgba('#dffaff', 0.9); ctx.lineWidth = 1.2; ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      poly(ctx, [[0, -16 * s], [3 * s, -5 * s], [-2 * s, -3 * s]]); ctx.fill();
      // facet lines
      ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0, -16 * s); ctx.lineTo(0, 8 * s); ctx.stroke();
      ctx.restore();
    };

    crystal(0, -16, 1 + level * 0.14, 0);
    if (level >= 2) crystal(-19, -6, 0.6, 2.1);
    if (level >= 2) crystal(19, -6, 0.6, 4.2);
    if (level >= 3) {
      // frost ring
      ctx.strokeStyle = rgba('#aeeaff', 0.5 + Math.sin(t * 3) * 0.2);
      ctx.lineWidth = 2.4;
      ctx.beginPath(); ctx.ellipse(0, 4, 27, 10, 0, 0, TAU); ctx.stroke();
      // falling snow
      ctx.fillStyle = 'rgba(230,250,255,0.85)';
      for (let i = 0; i < 7; i++) {
        const a = t * (0.6 + i * 0.13) + i;
        const sx = Math.sin(a * 1.7 + i) * 26;
        const sy = -50 + ((t * 26 + i * 13) % 54);
        ctx.beginPath(); ctx.arc(sx, sy, 1.3 + (i % 2) * 0.7, 0, TAU); ctx.fill();
      }
    }
    aimMuzzle(ctx, o.angle, 22, '#66d9ff', t, o.fire);
    ctx.restore();
  }

  function drawDoomSpire(ctx, x, y, level, o) {
    const t = o.t;
    ctx.save(); ctx.translate(x, y);
    towerBase(ctx, t, level, '#b06bff');

    const h = 52 + level * 10;
    // jagged spire
    const sg = ctx.createLinearGradient(-14, 0, 14, 0);
    sg.addColorStop(0, '#120d17'); sg.addColorStop(0.5, '#2e2140'); sg.addColorStop(1, '#0d0912');
    ctx.fillStyle = sg;
    poly(ctx, [[-15, 4], [-9, -h * 0.55], [-4, -h * 0.5], [-3, -h], [4, -h * 0.94], [6, -h * 0.5], [11, -h * 0.45], [15, 4]]);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.75)'; ctx.lineWidth = 1.7; ctx.stroke();
    // purple vein glow
    ctx.strokeStyle = rgba('#a34dff', 0.5 + Math.sin(t * 3.4) * 0.22);
    ctx.lineWidth = 1.7;
    ctx.beginPath(); ctx.moveTo(-7, 2); ctx.lineTo(-5, -h * 0.45); ctx.lineTo(-2, -h * 0.7); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(8, 1); ctx.lineTo(6, -h * 0.4); ctx.stroke();

    // skull motif at level>=2
    if (level >= 2) {
      ctx.save();
      ctx.translate(0, -h * 0.34);
      ctx.fillStyle = '#c9c0ad';
      ctx.beginPath(); ctx.ellipse(0, 0, 7, 6.4, 0, 0, TAU); ctx.fill();
      ctx.fillRect(-4.5, 4, 9, 5);
      ctx.fillStyle = rgba('#a34dff', 0.9 + Math.sin(t * 5) * 0.1);
      ctx.beginPath(); ctx.ellipse(-2.6, -1, 1.9, 2.3, 0, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.ellipse(2.6, -1, 1.9, 2.3, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#241b2c';
      ctx.fillRect(-1, 5, 2, 4);
      ctx.restore();
    }

    // top orb
    const oy = -h - 12 + Math.sin(t * 2.6) * 3;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    glow(ctx, 0, oy, 24 + level * 5 + Math.sin(t * 5) * 4, '#9b3dff', 0.85);
    ctx.restore();
    const og = ctx.createRadialGradient(-3, oy - 3, 1, 0, oy, 12);
    og.addColorStop(0, '#f3dcff'); og.addColorStop(0.45, '#b061ff'); og.addColorStop(1, '#4a0f8f');
    ctx.fillStyle = og;
    ctx.beginPath(); ctx.arc(0, oy, 11, 0, TAU); ctx.fill();
    ctx.strokeStyle = rgba('#e8c6ff', 0.8); ctx.lineWidth = 1.1; ctx.stroke();
    // crackle arcs
    ctx.strokeStyle = rgba('#ffffff', 0.5 + Math.sin(t * 17) * 0.3);
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 3; i++) {
      const a = t * 6 + (i / 3) * TAU;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 6, oy + Math.sin(a) * 6);
      ctx.lineTo(Math.cos(a + 0.5) * 15, oy + Math.sin(a + 0.5) * 13);
      ctx.lineTo(Math.cos(a + 0.3) * 20, oy + Math.sin(a + 0.3) * 18);
      ctx.stroke();
    }

    if (level >= 3) {
      for (let i = 0; i < 2; i++) {
        const a = t * 1.7 + i * Math.PI;
        const sx = Math.cos(a) * 30, sy = -h * 0.55 + Math.sin(a) * 14;
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(Math.sin(a) * 0.4);
        ctx.fillStyle = '#d6cdba';
        ctx.beginPath(); ctx.ellipse(0, 0, 6, 5.4, 0, 0, TAU); ctx.fill();
        ctx.fillRect(-4, 3.5, 8, 4);
        ctx.fillStyle = '#7a2bd6';
        ctx.beginPath(); ctx.ellipse(-2.2, -0.6, 1.7, 2, 0, 0, TAU); ctx.fill();
        ctx.beginPath(); ctx.ellipse(2.2, -0.6, 1.7, 2, 0, 0, TAU); ctx.fill();
        ctx.restore();
      }
    }
    aimMuzzle(ctx, o.angle, 20, '#a34dff', t, o.fire);
    ctx.restore();
  }

  function drawSoulAltar(ctx, x, y, level, o) {
    const t = o.t;
    ctx.save(); ctx.translate(x, y);
    towerBase(ctx, t, level, '#5ce08a');

    // altar slab
    const bg = ctx.createLinearGradient(0, -14, 0, 8);
    bg.addColorStop(0, '#46404f'); bg.addColorStop(1, '#1d1824');
    ctx.fillStyle = bg;
    poly(ctx, [[-22, -14], [22, -14], [19, 4], [-19, 4]]);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.lineWidth = 1.7; ctx.stroke();
    // engraved glyphs
    ctx.strokeStyle = rgba('#5ce08a', 0.55 + Math.sin(t * 2.6) * 0.25);
    ctx.lineWidth = 1.3;
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(i * 11 - 3, -9); ctx.lineTo(i * 11 + 3, -9);
      ctx.lineTo(i * 11, -3); ctx.closePath();
      ctx.stroke();
    }
    // pedestal legs
    ctx.fillStyle = '#15111b';
    ctx.fillRect(-16, 4, 8, 9); ctx.fillRect(8, 4, 8, 9);
    // chains
    ctx.strokeStyle = '#5a4f63'; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-21, -12); ctx.quadraticCurveTo(-27, -2, -22, 6);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(21, -12); ctx.quadraticCurveTo(27, -2, 22, 6);
    ctx.stroke();

    // soul flame
    const fy = -18;
    const flick = Math.sin(t * 8.3) * 0.5 + Math.sin(t * 5.1) * 0.5;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    glow(ctx, 0, fy - 10, 26 + level * 6 + flick * 5, '#3dff8f', 0.6);
    ctx.restore();
    ctx.fillStyle = rgba('#4aff94', 0.75);
    ctx.beginPath();
    ctx.moveTo(-7, fy);
    ctx.quadraticCurveTo(-9 + flick * 3, fy - 16, 0, fy - 26 - level * 3 + flick * 4);
    ctx.quadraticCurveTo(9 + flick * 3, fy - 16, 7, fy);
    ctx.quadraticCurveTo(0, fy + 5, -7, fy);
    ctx.fill();
    ctx.fillStyle = rgba('#d6ffe8', 0.9);
    ctx.beginPath();
    ctx.moveTo(-3, fy);
    ctx.quadraticCurveTo(-4 + flick * 2, fy - 9, 0, fy - 15 + flick * 3);
    ctx.quadraticCurveTo(4 + flick * 2, fy - 9, 3, fy);
    ctx.quadraticCurveTo(0, fy + 3, -3, fy);
    ctx.fill();

    // orbiting souls
    const n = level >= 3 ? 3 : level >= 2 ? 2 : 1;
    for (let i = 0; i < n; i++) {
      const a = t * 1.9 + (i / n) * TAU;
      const sx = Math.cos(a) * 28, sy = -18 + Math.sin(a) * 12;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      glow(ctx, sx, sy, 10, '#54ff9b', 0.7);
      ctx.restore();
      ctx.fillStyle = '#d9ffe9';
      ctx.beginPath(); ctx.ellipse(sx, sy, 3.4, 4.2, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#0d3a22';
      ctx.beginPath(); ctx.arc(sx - 1.3, sy - 0.6, 0.8, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(sx + 1.3, sy - 0.6, 0.8, 0, TAU); ctx.fill();
    }
    aimMuzzle(ctx, o.angle, 24, '#5ce08a', t, o.fire);
    ctx.restore();
  }

  const TOWER_PAINT = {
    blood: drawBloodSpire,
    frost: drawFrostShrine,
    doom: drawDoomSpire,
    soul: drawSoulAltar
  };

  function drawTower(ctx, type, x, y, level, o) {
    const fn = TOWER_PAINT[type];
    if (fn) fn(ctx, x, y, level, o);
  }

  function drawRangeCircle(ctx, x, y, range, color, valid = true) {
    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = rgba(color, 0.75);
    ctx.lineWidth = 1.6;
    ctx.setLineDash([8, 7]);
    ctx.beginPath(); ctx.arc(0, 0, range, 0, TAU); ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = rgba(color, valid ? 0.07 : 0.16);
    ctx.beginPath(); ctx.arc(0, 0, range, 0, TAU); ctx.fill();
    ctx.restore();
  }

  function drawTowerIcon(canvas, type) {
    const g = canvas.getContext('2d');
    const w = canvas.width, h = canvas.height;
    g.clearRect(0, 0, w, h);
    // medallion bg
    const bg = g.createRadialGradient(w / 2, h * 0.4, 4, w / 2, h / 2, w * 0.55);
    bg.addColorStop(0, '#2d2333'); bg.addColorStop(1, '#120d16');
    g.fillStyle = bg;
    g.beginPath(); g.arc(w / 2, h / 2, w / 2 - 2, 0, TAU); g.fill();
    g.strokeStyle = 'rgba(160,120,150,0.35)'; g.lineWidth = 1.5;
    g.beginPath(); g.arc(w / 2, h / 2, w / 2 - 3, 0, TAU); g.stroke();
    g.save();
    g.translate(w / 2, h * 0.62);
    g.scale(0.82, 0.82);
    drawTower(g, type, 0, 0, 1, { t: 1.3, angle: -0.7, fire: 0 });
    g.restore();
  }

  /* ============================================================
     ENEMIES
     ============================================================ */
  function healthBar(ctx, x, y, w, frac, boss = false) {
    const h = boss ? 7 : 4.5;
    frac = Math.max(0, Math.min(1, frac));
    ctx.fillStyle = 'rgba(6,3,7,0.85)';
    ctx.fillRect(x - w / 2 - 1, y - 1, w + 2, h + 2);
    ctx.fillStyle = '#2a0d13';
    ctx.fillRect(x - w / 2, y, w, h);
    const col = frac > 0.5 ? mix('#5ad866', '#e8d14d', (1 - frac) * 2)
      : mix('#e8d14d', '#e03a3a', (0.5 - frac) * 2);
    ctx.fillStyle = col;
    ctx.fillRect(x - w / 2, y, w * frac, h);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(x - w / 2, y, w * frac, h * 0.4);
  }

  function statusMarks(ctx, e, y) {
    let x = -6;
    if (e.slowT > 0) {
      ctx.fillStyle = '#7fe3ff';
      poly(ctx, [[x, y - 4], [x + 4, y], [x, y + 4], [x - 4, y]]); ctx.fill();
      x += 11;
    }
    if (e.poisonT > 0) {
      ctx.fillStyle = '#6dff5a';
      ctx.beginPath(); ctx.arc(x, y, 3.4, 0, TAU); ctx.fill();
      ctx.fillStyle = '#143a10';
      ctx.beginPath(); ctx.arc(x - 1, y - 0.6, 0.9, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(x + 1.1, y - 0.6, 0.9, 0, TAU); ctx.fill();
    }
  }

  /* ---------------- IMP ---------------- */
  function drawImpLeg(ctx, hipX, hipY, swing, F) {
    const col = F ? '#ffffff' : '#5e1c17';
    ctx.strokeStyle = col; ctx.lineWidth = 5; ctx.lineCap = 'round';
    const kneeX = hipX + swing * 0.6, kneeY = hipY + 7;
    const footX = hipX + swing, footY = hipY + 13;
    ctx.beginPath(); ctx.moveTo(hipX, hipY); ctx.lineTo(kneeX, kneeY); ctx.stroke();
    ctx.strokeStyle = F ? '#ffffff' : '#7c2a20'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(kneeX, kneeY); ctx.lineTo(footX, footY); ctx.stroke();
    // clawed foot
    ctx.strokeStyle = F ? '#fff' : '#cfc3a8'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(footX - 3, footY); ctx.lineTo(footX + 5, footY + 1); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(footX - 2, footY + 1); ctx.lineTo(footX + 4, footY + 3); ctx.stroke();
  }

  function drawImp(ctx, x, y, o) {
    const t = o.t, ph = o.phase, F = o.flash > 0;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath(); ctx.ellipse(x, y + 15, 13, 5, 0, 0, TAU); ctx.fill();
    ctx.translate(x, y);
    ctx.scale(o.dir, 1);
    const bob = Math.sin(ph * 2) * 1.4;
    ctx.translate(0, bob);

    const skin = F ? '#ffffff' : '#7e2a22';
    const skinD = F ? '#ffe4e4' : '#48140f';
    const bone = F ? '#ffffff' : '#cfc2a6';

    // tail
    ctx.strokeStyle = F ? '#fff' : '#5c1b16'; ctx.lineWidth = 3.6; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-8, -3);
    ctx.quadraticCurveTo(-17, -1 + Math.sin(t * 5) * 3.5, -21, -11 + Math.sin(t * 4) * 2);
    ctx.stroke();
    ctx.fillStyle = skinD;
    ctx.beginPath(); ctx.moveTo(-21, -11); ctx.lineTo(-26, -16); ctx.lineTo(-18, -17); ctx.closePath(); ctx.fill();

    // legs
    drawImpLeg(ctx, 3, 3, Math.sin(ph) * 5.5, F);
    drawImpLeg(ctx, -4, 3, Math.sin(ph + Math.PI) * 5.5, F);

    // back arm
    ctx.strokeStyle = F ? '#fff' : skinD; ctx.lineWidth = 3.4;
    const ba = Math.sin(ph) * 4;
    ctx.beginPath(); ctx.moveTo(-4, -9); ctx.quadraticCurveTo(-9, -5 + ba, -12, -1 + ba); ctx.stroke();
    ctx.strokeStyle = bone; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(-12, -1 + ba); ctx.lineTo(-15, -3 + ba); ctx.stroke();

    // body
    const bgd = ctx.createLinearGradient(0, -17, 0, 3);
    bgd.addColorStop(0, F ? '#fff' : '#9a382a');
    bgd.addColorStop(1, skinD);
    ctx.fillStyle = bgd;
    ctx.beginPath(); ctx.ellipse(-1, -7, 10, 10.5, -0.12, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = 1.4; ctx.stroke();
    // belly
    ctx.fillStyle = F ? '#fff' : 'rgba(178,84,58,0.5)';
    ctx.beginPath(); ctx.ellipse(3, -5, 5.6, 6.6, 0, 0, TAU); ctx.fill();
    // back spikes
    ctx.fillStyle = F ? '#fff' : '#3d1014';
    for (let i = 0; i < 3; i++) {
      const bx = -7 - i * 1.5, by = -15 + i * 5;
      poly(ctx, [[bx, by], [bx - 6 - i, by + 2], [bx, by + 5]]); ctx.fill();
    }

    // front arm (swings)
    const aa = Math.sin(ph + Math.PI) * 4;
    ctx.strokeStyle = F ? '#fff' : skin; ctx.lineWidth = 3.6;
    ctx.beginPath(); ctx.moveTo(5, -10); ctx.quadraticCurveTo(10, -6 + aa, 12, -1 + aa); ctx.stroke();
    ctx.strokeStyle = bone; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(12, -1 + aa); ctx.lineTo(16, -4 + aa); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(12, -1 + aa); ctx.lineTo(16, 0 + aa); ctx.stroke();

    // head
    ctx.save();
    ctx.translate(4, -16);
    ctx.rotate(Math.sin(ph * 2) * 0.06);
    const hg = ctx.createLinearGradient(0, -8, 0, 7);
    hg.addColorStop(0, F ? '#fff' : '#a8442f'); hg.addColorStop(1, F ? '#fff' : '#5a1a14');
    ctx.fillStyle = hg;
    ctx.beginPath(); ctx.ellipse(1, 0, 7.5, 6.5, 0.1, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = 1.3; ctx.stroke();
    // horns
    ctx.fillStyle = bone;
    ctx.beginPath(); ctx.moveTo(-2, -5); ctx.quadraticCurveTo(-6, -13, -12, -15);
    ctx.quadraticCurveTo(-7, -11, -4, -4); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(3, -6); ctx.quadraticCurveTo(4, -13, 9, -16);
    ctx.quadraticCurveTo(6, -11, 5, -4); ctx.closePath(); ctx.fill();
    // snout + jaw
    ctx.fillStyle = F ? '#fff' : '#8f3325';
    ctx.beginPath(); ctx.ellipse(6, 2, 4.5, 3.6, 0.1, 0, TAU); ctx.fill();
    ctx.fillStyle = F ? '#fff' : '#4a120f';
    ctx.beginPath(); ctx.ellipse(5.5, 4.4, 3.6, 2, 0.1, 0, TAU); ctx.fill();
    // teeth
    ctx.fillStyle = '#f2ead6';
    for (let i = 0; i < 3; i++) {
      poly(ctx, [[3.4 + i * 1.8, 3.4], [4.3 + i * 1.8, 3.4], [3.9 + i * 1.8, 5.4]]); ctx.fill();
    }
    // eyes
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    glow(ctx, 2.4, -1.6, 6.5, '#ffcc33', 0.9);
    ctx.restore();
    ctx.fillStyle = '#ffe98a';
    ctx.beginPath(); ctx.ellipse(2.4, -1.6, 2.1, 1.7, -0.3, 0, TAU); ctx.fill();
    ctx.fillStyle = '#2a1403';
    ctx.beginPath(); ctx.ellipse(3, -1.6, 0.8, 1.3, 0, 0, TAU); ctx.fill();
    ctx.restore();

    ctx.restore();
  }

  /* ---------------- GHOUL ---------------- */
  function drawGhoul(ctx, x, y, o) {
    const t = o.t, ph = o.phase, F = o.flash > 0;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath(); ctx.ellipse(x, y + 17, 15, 5.5, 0, 0, TAU); ctx.fill();
    ctx.translate(x, y);
    ctx.scale(o.dir, 1);
    const sway = Math.sin(ph) * 2.2;
    ctx.translate(sway * 0.4, Math.abs(Math.sin(ph)) * -1.6);

    const skin = F ? '#ffffff' : '#8b9878';
    const skinD = F ? '#fff' : '#4d5642';
    const rot = F ? '#fff' : '#68714f';
    const bone = F ? '#fff' : '#ddd3ba';
    const cloth = F ? '#fff' : '#4a3b2e';

    // legs (shamble)
    const l1 = Math.sin(ph) * 5, l2 = Math.sin(ph + Math.PI) * 5;
    const leg = (hx, sw) => {
      ctx.strokeStyle = F ? '#fff' : skinD; ctx.lineWidth = 5.5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(hx, 4);
      ctx.quadraticCurveTo(hx + sw * 0.5, 10, hx + sw, 15);
      ctx.stroke();
      // foot
      ctx.strokeStyle = F ? '#fff' : '#3e4436'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.moveTo(hx + sw, 15); ctx.lineTo(hx + sw + 5, 16); ctx.stroke();
      // tattered trouser
      ctx.fillStyle = cloth;
      ctx.beginPath(); ctx.ellipse(hx, 5, 5, 6, 0, 0, Math.PI); ctx.fill();
    };
    leg(3, l1); leg(-4, l2);

    // dragging back arm
    ctx.strokeStyle = F ? '#fff' : skinD; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(-5, -13);
    ctx.quadraticCurveTo(-13, -6 + l2 * 0.4, -16, 4 + l2 * 0.3);
    ctx.stroke();
    ctx.strokeStyle = bone; ctx.lineWidth = 1.5;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(-16, 4 + l2 * 0.3);
      ctx.lineTo(-21 - i * 1.4, 3 + i * 2 + l2 * 0.3);
      ctx.stroke();
    }

    // torso (hunched forward)
    ctx.save();
    ctx.rotate(0.28);
    const tg = ctx.createLinearGradient(0, -24, 0, 4);
    tg.addColorStop(0, F ? '#fff' : '#9aa884'); tg.addColorStop(1, skinD);
    ctx.fillStyle = tg;
    ctx.beginPath(); ctx.ellipse(1, -10, 10.5, 13, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1.4; ctx.stroke();
    // rot patch
    ctx.fillStyle = F ? '#fff' : rot;
    ctx.beginPath(); ctx.ellipse(-4, -6, 5, 6, 0.3, 0, TAU); ctx.fill();
    // exposed ribs
    ctx.strokeStyle = bone; ctx.lineWidth = 1.8;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.arc(4, -16 + i * 4, 6, Math.PI * 0.15, Math.PI * 0.85);
      ctx.stroke();
    }
    // torn flesh edges
    ctx.strokeStyle = F ? '#fff' : '#5a1414'; ctx.lineWidth = 1.3;
    ctx.beginPath(); ctx.moveTo(6, -4); ctx.lineTo(9, -8); ctx.lineTo(7, -13); ctx.stroke();
    ctx.restore();

    // front arm reaching (drag)
    const fa = Math.sin(ph + Math.PI) * 3;
    ctx.strokeStyle = F ? '#fff' : skin; ctx.lineWidth = 4.2;
    ctx.beginPath(); ctx.moveTo(7, -12);
    ctx.quadraticCurveTo(14, -4 + fa, 17, 5 + fa);
    ctx.stroke();
    ctx.strokeStyle = bone; ctx.lineWidth = 1.6;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(17, 5 + fa);
      ctx.lineTo(21 + i * 1.2, 4 + i * 2.2 + fa);
      ctx.stroke();
    }

    // head (low, jutting forward)
    ctx.save();
    ctx.translate(8, -24);
    ctx.rotate(0.34 + Math.sin(ph * 2) * 0.07);
    const hg = ctx.createLinearGradient(0, -8, 0, 8);
    hg.addColorStop(0, F ? '#fff' : '#a3b18c'); hg.addColorStop(1, F ? '#fff' : '#5c6450');
    ctx.fillStyle = hg;
    ctx.beginPath(); ctx.ellipse(2, 0, 7.5, 7, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = 1.3; ctx.stroke();
    // sunken scalp
    ctx.fillStyle = F ? '#fff' : '#6a7259';
    ctx.beginPath(); ctx.ellipse(-1, -3, 5.5, 4.4, -0.3, 0, TAU); ctx.fill();
    // hanging jaw
    ctx.fillStyle = F ? '#fff' : '#77815f';
    ctx.beginPath(); ctx.ellipse(7, 4, 4.4, 3.4, 0.35, 0, TAU); ctx.fill();
    ctx.fillStyle = '#efe6d2';
    for (let i = 0; i < 4; i++) {
      poly(ctx, [[5 + i * 1.7, 1.6], [6 + i * 1.7, 1.6], [5.5 + i * 1.7, 4]]); ctx.fill();
    }
    // blood drip
    ctx.fillStyle = '#7e1420';
    ctx.beginPath(); ctx.ellipse(7, 7 + Math.sin(t * 3) * 1, 1.4, 2.4, 0, 0, TAU); ctx.fill();
    // eyes
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    glow(ctx, 3.4, -1.4, 7, '#7dff4a', 0.85);
    ctx.restore();
    ctx.fillStyle = '#c6ff9a';
    ctx.beginPath(); ctx.ellipse(3.4, -1.4, 2.2, 1.8, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#0f2408';
    ctx.beginPath(); ctx.ellipse(3.6, -1.4, 0.9, 1.4, 0, 0, TAU); ctx.fill();
    ctx.restore();

    ctx.restore();
  }

  /* ---------------- WRAITH ---------------- */
  function drawWraith(ctx, x, y, o) {
    const t = o.t, F = o.flash > 0, seed = o.seed || 0;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(x, y + 20, 11, 4, 0, 0, TAU); ctx.fill();
    ctx.translate(x, y - 12 + Math.sin(t * 2.4 + seed) * 4);
    ctx.scale(o.dir, 1);

    const robe = F ? '#ffffff' : '#453b5e';
    const robeL = F ? '#fff' : '#6d6194';
    const void_ = F ? '#fff' : '#14101f';

    // outer aura
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    glow(ctx, 0, -6, 34, '#7b66c9', 0.4);
    ctx.restore();

    // trailing wisps
    ctx.strokeStyle = F ? '#fff' : rgba('#8d7fd4', 0.55);
    ctx.lineWidth = 2.4; ctx.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      const yy = 6 + i * 5;
      ctx.beginPath();
      ctx.moveTo(-6, yy);
      ctx.quadraticCurveTo(
        -16 + Math.sin(t * 3 + i + seed) * 5, yy + 4,
        -24 - i * 3 + Math.sin(t * 2.2 + i * 2) * 6, yy + 10 + Math.cos(t * 2.6 + i) * 4
      );
      ctx.stroke();
    }

    // lower robe (tattered, wavy hem)
    const rg = ctx.createLinearGradient(0, -14, 0, 22);
    rg.addColorStop(0, F ? '#fff' : '#514676');
    rg.addColorStop(1, F ? '#fff' : '#241d3a');
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.moveTo(-11, -8);
    ctx.lineTo(-9, 16);
    for (let i = 0; i <= 5; i++) {
      const px = -9 + i * 3.6;
      const py = 16 + Math.sin(t * 4 + i * 1.4 + seed) * 3.4 + (i % 2 ? 4 : 0);
      ctx.lineTo(px, py);
    }
    ctx.lineTo(11, -8);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = F ? '#fff' : rgba('#9c8fe0', 0.55); ctx.lineWidth = 1.2; ctx.stroke();

    // torso / hood
    ctx.fillStyle = F ? '#fff' : robeL;
    ctx.beginPath();
    ctx.moveTo(-12, -8);
    ctx.quadraticCurveTo(-13, -24, 0, -27);
    ctx.quadraticCurveTo(13, -24, 12, -8);
    ctx.quadraticCurveTo(0, -2, -12, -8);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1.3; ctx.stroke();

    // shoulders tatters
    ctx.fillStyle = F ? '#fff' : robe;
    poly(ctx, [[-13, -9], [-17, -2], [-11, -3]]); ctx.fill();
    poly(ctx, [[13, -9], [17, -2], [11, -3]]); ctx.fill();

    // reaching arms
    ctx.strokeStyle = F ? '#fff' : robe; ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-8, -12); ctx.quadraticCurveTo(-14, -4, -13, 4); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(8, -13); ctx.quadraticCurveTo(16, -8, 20, -1); ctx.stroke();
    // claw hands
    ctx.strokeStyle = F ? '#fff' : '#c9bff2'; ctx.lineWidth = 1.5;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath(); ctx.moveTo(20, -1); ctx.lineTo(24 + i, -3 + i * 2.4); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-13, 4); ctx.lineTo(-17 - i, 3 + i * 2); ctx.stroke();
    }

    // hood void + face
    ctx.fillStyle = void_;
    ctx.beginPath(); ctx.ellipse(1, -16, 7.5, 7.6, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = F ? '#fff' : '#2a2340';
    ctx.beginPath();
    ctx.moveTo(-8, -16);
    ctx.quadraticCurveTo(-6, -27, 1, -28);
    ctx.quadraticCurveTo(9, -26, 9, -15);
    ctx.quadraticCurveTo(3, -20, -8, -16);
    ctx.fill();
    // eyes
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    glow(ctx, 4, -16, 9, '#9fe8ff', 0.95);
    ctx.restore();
    ctx.fillStyle = '#e8fbff';
    ctx.beginPath(); ctx.ellipse(4.4, -16.6, 2.3, 1.5, -0.25, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(4.4, -12.4, 2.0, 1.3, 0.2, 0, TAU); ctx.fill();
    ctx.fillStyle = '#0d3040';
    ctx.beginPath(); ctx.arc(5, -16.6, 0.7, 0, TAU); ctx.fill();

    ctx.restore();
  }

  /* ---------------- BONE COLOSSUS ---------------- */
  function drawColossus(ctx, x, y, o) {
    const t = o.t, ph = o.phase, F = o.flash > 0;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath(); ctx.ellipse(x, y + 26, 26, 9, 0, 0, TAU); ctx.fill();
    ctx.translate(x, y);
    ctx.scale(o.dir, 1);
    const bob = Math.sin(ph) * 2.6;
    ctx.translate(0, bob * 0.5);
    ctx.rotate(Math.sin(ph) * 0.035);

    const bone = F ? '#ffffff' : '#d5cbb4';
    const boneD = F ? '#fff' : '#8f8672';
    const crack = '#ff7b2e';

    // legs
    const leg = (hx, sw) => {
      ctx.strokeStyle = F ? '#fff' : boneD; ctx.lineWidth = 9; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(hx, 6);
      ctx.quadraticCurveTo(hx + sw * 0.4, 15, hx + sw, 21);
      ctx.stroke();
      ctx.strokeStyle = F ? '#fff' : bone; ctx.lineWidth = 7;
      ctx.beginPath(); ctx.moveTo(hx, 6); ctx.quadraticCurveTo(hx + sw * 0.4, 15, hx + sw, 21); ctx.stroke();
      // foot
      ctx.fillStyle = F ? '#fff' : boneD;
      ctx.beginPath(); ctx.ellipse(hx + sw + 4, 23, 9, 4.5, 0, 0, TAU); ctx.fill();
      // knee cap
      ctx.fillStyle = F ? '#fff' : bone;
      ctx.beginPath(); ctx.ellipse(hx + sw * 0.45, 14, 5.5, 5, 0, 0, TAU); ctx.fill();
    };
    leg(7, Math.sin(ph) * 6);
    leg(-7, Math.sin(ph + Math.PI) * 6);

    // pelvis
    ctx.fillStyle = F ? '#fff' : bone;
    ctx.beginPath(); ctx.ellipse(0, 1, 14, 8, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = F ? '#fff' : boneD; ctx.lineWidth = 1.6; ctx.stroke();

    // arms (behind torso)
    const armBack = Math.sin(ph + Math.PI) * 5;
    const armFront = Math.sin(ph) * 5;
    const boneArm = (ax, ay, sw, len, wdt) => {
      ctx.strokeStyle = F ? '#fff' : bone; ctx.lineWidth = wdt; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(ax, ay);
      ctx.quadraticCurveTo(ax - 4, ay + len * 0.55, ax - 2 + sw, ay + len);
      ctx.stroke();
      // fist
      ctx.fillStyle = F ? '#fff' : boneD;
      ctx.beginPath(); ctx.ellipse(ax - 2 + sw, ay + len + 3, 7.5, 6.5, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = F ? '#fff' : '#6d6553'; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(ax - 8 + sw, ay + len + 3); ctx.lineTo(ax + 4 + sw, ay + len + 3); ctx.stroke();
    };
    boneArm(-15, -24 + armBack * 0.3, armBack, 30, 8);
    boneArm(15, -24 + armFront * 0.3, armFront, 30, 8);

    // torso / ribcage
    const tg = ctx.createLinearGradient(0, -34, 0, 4);
    tg.addColorStop(0, F ? '#fff' : '#e6ddc7'); tg.addColorStop(1, F ? '#fff' : '#a89e87');
    ctx.fillStyle = tg;
    ctx.beginPath();
    ctx.moveTo(-14, 2);
    ctx.quadraticCurveTo(-16, -22, -11, -32);
    ctx.lineTo(11, -32);
    ctx.quadraticCurveTo(16, -22, 14, 2);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = F ? '#fff' : 'rgba(60,50,35,0.7)'; ctx.lineWidth = 1.6; ctx.stroke();
    // ribs
    ctx.strokeStyle = F ? '#fff' : boneD; ctx.lineWidth = 2.6;
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(-11, -26 + i * 7);
      ctx.quadraticCurveTo(0, -21 + i * 7, 11, -26 + i * 7);
      ctx.stroke();
    }
    // chest core
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    glow(ctx, 0, -14, 16 + Math.sin(t * 3) * 3, crack, 0.85);
    ctx.restore();
    ctx.fillStyle = crack;
    ctx.beginPath(); ctx.arc(0, -14, 5.4 + Math.sin(t * 3) * 0.7, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ffe1b0';
    ctx.beginPath(); ctx.arc(-1.4, -15.4, 2, 0, TAU); ctx.fill();
    // cracks
    ctx.strokeStyle = rgba(crack, 0.75); ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(-4, -17); ctx.lineTo(-10, -26); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(4, -11); ctx.lineTo(10, -4); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(3, -19); ctx.lineTo(7, -27); ctx.stroke();

    // shoulder plates
    ctx.fillStyle = F ? '#fff' : boneD;
    poly(ctx, [[-13, -30], [-22, -34], [-24, -26], [-14, -23]]); ctx.fill();
    poly(ctx, [[13, -30], [22, -34], [24, -26], [14, -23]]); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1.3; ctx.stroke();

    // skull head
    ctx.save();
    ctx.translate(0, -42 + Math.sin(ph * 2) * 1);
    const hg = ctx.createLinearGradient(0, -11, 0, 8);
    hg.addColorStop(0, F ? '#fff' : '#efe6d0'); hg.addColorStop(1, F ? '#fff' : '#b3a992');
    ctx.fillStyle = hg;
    ctx.beginPath(); ctx.ellipse(0, -1, 9.5, 8.5, 0, 0, TAU); ctx.fill();
    ctx.fillRect(-6, 5, 12, 7);
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 1.4; ctx.stroke();
    // eye sockets
    ctx.fillStyle = '#191309';
    ctx.beginPath(); ctx.ellipse(-4, -2, 3.2, 3.6, 0.15, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(4, -2, 3.2, 3.6, -0.15, 0, TAU); ctx.fill();
    // socket fire
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    glow(ctx, -4, -2, 7, crack, 0.9);
    glow(ctx, 4, -2, 7, crack, 0.9);
    ctx.restore();
    ctx.fillStyle = '#ffd9a0';
    ctx.beginPath(); ctx.arc(-4, -2, 1.5, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(4, -2, 1.5, 0, TAU); ctx.fill();
    // teeth
    ctx.fillStyle = '#f4ecd8';
    for (let i = 0; i < 5; i++) {
      ctx.fillRect(-5 + i * 2.2, 5, 1.5, 4.5);
    }
    // horns
    ctx.fillStyle = F ? '#fff' : '#9a9080';
    ctx.beginPath(); ctx.moveTo(-8, -7); ctx.quadraticCurveTo(-15, -13, -17, -21);
    ctx.quadraticCurveTo(-12, -14, -5, -9); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(8, -7); ctx.quadraticCurveTo(15, -13, 17, -21);
    ctx.quadraticCurveTo(12, -14, 5, -9); ctx.closePath(); ctx.fill();
    ctx.restore();

    ctx.restore();
  }

  /* ---------------- THE BLOOD WARDEN (boss) ---------------- */
  function drawWarden(ctx, x, y, o) {
    const t = o.t, ph = o.phase, F = o.flash > 0;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.beginPath(); ctx.ellipse(x, y + 38, 34, 11, 0, 0, TAU); ctx.fill();
    ctx.translate(x, y);
    ctx.scale(o.dir, 1);
    const bob = Math.sin(ph) * 3;
    ctx.translate(0, bob * 0.5);

    const armor = F ? '#ffffff' : '#2c2430';
    const armorL = F ? '#fff' : '#453a4d';
    const red = '#e03a4e';
    const bone = F ? '#fff' : '#d9cdb4';

    // aura
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    glow(ctx, 0, -30, 74, '#b3202e', 0.34 + Math.sin(t * 2) * 0.07);
    ctx.restore();

    /* wings */
    const flap = Math.sin(t * 1.6) * 0.09;
    const wing = (side) => {
      ctx.save();
      ctx.translate(-4, -52);
      ctx.rotate(side * (0.35 + flap));
      ctx.scale(side, 1);
      // membrane
      ctx.fillStyle = F ? '#fff' : '#4e1220';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(-34, -26, -62, -14);
      ctx.quadraticCurveTo(-54, -6, -58, 4);
      ctx.quadraticCurveTo(-44, 2, -46, 12);
      ctx.quadraticCurveTo(-30, 8, -28, 18);
      ctx.quadraticCurveTo(-12, 12, 0, 14);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = F ? '#fff' : '#2a0812'; ctx.lineWidth = 2; ctx.stroke();
      // bone fingers
      ctx.strokeStyle = F ? '#fff' : '#7a3040'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(0, 2); ctx.quadraticCurveTo(-30, -14, -58, -13); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, 4); ctx.quadraticCurveTo(-26, -2, -54, 4); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, 6); ctx.quadraticCurveTo(-22, 8, -44, 11); ctx.stroke();
      ctx.restore();
    };
    wing(-1); wing(1);

    /* legs (digitigrade, armored) */
    const leg = (hx, sw) => {
      ctx.strokeStyle = F ? '#fff' : armor; ctx.lineWidth = 11; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(hx, 4);
      ctx.quadraticCurveTo(hx + sw * 0.5 + 3, 16, hx + sw - 2, 24);
      ctx.stroke();
      ctx.strokeStyle = F ? '#fff' : armorL; ctx.lineWidth = 7.5;
      ctx.beginPath(); ctx.moveTo(hx, 4); ctx.quadraticCurveTo(hx + sw * 0.5 + 3, 16, hx + sw - 2, 24); ctx.stroke();
      // greave claw
      ctx.fillStyle = F ? '#fff' : '#1c1620';
      ctx.beginPath(); ctx.ellipse(hx + sw + 3, 27, 10, 5, 0, 0, TAU); ctx.fill();
      ctx.strokeStyle = rgba(red, 0.8); ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(hx + sw - 4, 24); ctx.lineTo(hx + sw + 10, 27); ctx.stroke();
    };
    leg(9, Math.sin(ph) * 8);
    leg(-9, Math.sin(ph + Math.PI) * 8);

    /* greatsword planted (right side) */
    ctx.save();
    ctx.translate(24, -6 + Math.sin(ph + Math.PI) * 3);
    ctx.rotate(-0.12 + Math.sin(ph) * 0.05);
    // blade
    const bl = ctx.createLinearGradient(-6, 0, 6, 0);
    bl.addColorStop(0, '#171219'); bl.addColorStop(0.5, '#4d4456'); bl.addColorStop(1, '#100c14');
    ctx.fillStyle = bl;
    poly(ctx, [[-5, -58], [5, -58], [6, 12], [0, 24], [-6, 12]]);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.lineWidth = 1.6; ctx.stroke();
    // glowing edge
    ctx.strokeStyle = rgba(red, 0.85 + Math.sin(t * 4) * 0.15);
    ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.moveTo(5, -56); ctx.lineTo(6, 10); ctx.stroke();
    // rune on blade
    ctx.strokeStyle = rgba('#ff8a97', 0.85); ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(-2, -34); ctx.lineTo(2, -26); ctx.lineTo(-2, -18); ctx.stroke();
    // crossguard (horned)
    ctx.fillStyle = F ? '#fff' : '#3a3040';
    poly(ctx, [[-13, -60], [13, -60], [10, -54], [-10, -54]]); ctx.fill();
    poly(ctx, [[-13, -60], [-20, -66], [-11, -57]]); ctx.fill();
    poly(ctx, [[13, -60], [20, -66], [11, -57]]); ctx.fill();
    ctx.restore();

    /* torso armor */
    const tg = ctx.createLinearGradient(0, -58, 0, 6);
    tg.addColorStop(0, F ? '#fff' : '#41364a'); tg.addColorStop(1, F ? '#fff' : '#1d1723');
    ctx.fillStyle = tg;
    ctx.beginPath();
    ctx.moveTo(-19, 4);
    ctx.lineTo(-22, -34);
    ctx.quadraticCurveTo(-20, -54, -12, -58);
    ctx.lineTo(12, -58);
    ctx.quadraticCurveTo(20, -54, 22, -34);
    ctx.lineTo(19, 4);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.75)'; ctx.lineWidth = 2; ctx.stroke();
    // abdominal plates
    ctx.strokeStyle = 'rgba(0,0,0,0.55)'; ctx.lineWidth = 1.6;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath(); ctx.moveTo(-15, -4 + i * 0); ctx.lineTo(-13, -8 + i * 0); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-16, -6 + i * 7); ctx.quadraticCurveTo(0, -2 + i * 7, 16, -6 + i * 7); ctx.stroke();
    }
    // glowing cracks + chest core
    ctx.strokeStyle = rgba(red, 0.8); ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.moveTo(-14, -40); ctx.lineTo(-8, -30); ctx.lineTo(-12, -18); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(15, -46); ctx.lineTo(9, -36); ctx.stroke();
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    glow(ctx, 0, -34, 20 + Math.sin(t * 3.2) * 4, red, 0.9);
    ctx.restore();
    ctx.fillStyle = '#ff6b7c';
    ctx.beginPath(); ctx.ellipse(0, -34, 6.4, 7.6, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ffe3e6';
    ctx.beginPath(); ctx.ellipse(-1.6, -36, 2.4, 3, -0.3, 0, TAU); ctx.fill();

    /* spiked pauldrons */
    const pauldron = (sx) => {
      ctx.fillStyle = F ? '#fff' : armorL;
      ctx.beginPath();
      ctx.ellipse(sx, -54, 13, 10, sx > 0 ? -0.3 : 0.3, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.lineWidth = 1.6; ctx.stroke();
      ctx.fillStyle = F ? '#fff' : '#1a141e';
      for (let i = 0; i < 3; i++) {
        const px = sx + (sx > 0 ? 6 - i * 7 : -6 + i * 7);
        poly(ctx, [[px - 2, -61], [px, -72 - i * 2], [px + 2, -61]]); ctx.fill();
      }
      ctx.strokeStyle = rgba(red, 0.6); ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.ellipse(sx, -54, 13, 10, sx > 0 ? -0.3 : 0.3, Math.PI * 0.9, Math.PI * 1.9); ctx.stroke();
    };
    pauldron(-20); pauldron(20);

    /* arms */
    ctx.strokeStyle = F ? '#fff' : armor; ctx.lineWidth = 9; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-20, -50); ctx.quadraticCurveTo(-27, -34, -24, -16 + Math.sin(ph) * 4); ctx.stroke();
    ctx.strokeStyle = F ? '#fff' : armorL; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(-20, -50); ctx.quadraticCurveTo(-27, -34, -24, -16 + Math.sin(ph) * 4); ctx.stroke();
    // claw hand on left
    ctx.fillStyle = F ? '#fff' : '#171120';
    ctx.beginPath(); ctx.ellipse(-24, -12 + Math.sin(ph) * 4, 6, 7, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = bone; ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(-27 + i * 3, -6 + Math.sin(ph) * 4);
      ctx.lineTo(-29 + i * 3.5, 2 + Math.sin(ph) * 4);
      ctx.stroke();
    }

    /* head: horned helm */
    ctx.save();
    ctx.translate(0, -68 + Math.sin(ph * 2) * 1.2);
    const hg = ctx.createLinearGradient(0, -12, 0, 10);
    hg.addColorStop(0, F ? '#fff' : '#4a3e52'); hg.addColorStop(1, F ? '#fff' : '#1b1521');
    ctx.fillStyle = hg;
    ctx.beginPath(); ctx.ellipse(0, -1, 10, 9.5, 0, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.lineWidth = 1.6; ctx.stroke();
    // face void
    ctx.fillStyle = '#0a0610';
    ctx.beginPath(); ctx.ellipse(3.5, 0, 6, 6.5, 0, 0, TAU); ctx.fill();
    // jaw guard
    ctx.fillStyle = F ? '#fff' : armorL;
    poly(ctx, [[-2, 5], [10, 2], [10, 9], [-1, 10]]); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 1.2; ctx.stroke();
    // great horns
    ctx.fillStyle = F ? '#fff' : bone;
    ctx.beginPath();
    ctx.moveTo(-6, -7);
    ctx.bezierCurveTo(-16, -14, -22, -28, -16, -38);
    ctx.bezierCurveTo(-16, -26, -10, -16, -3, -10);
    ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(6, -8);
    ctx.bezierCurveTo(16, -15, 21, -30, 14, -40);
    ctx.bezierCurveTo(15, -27, 10, -17, 3, -11);
    ctx.closePath(); ctx.fill();
    // eyes
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    glow(ctx, 5, -2, 12, red, 1);
    ctx.restore();
    ctx.fillStyle = '#ffd7dc';
    ctx.beginPath(); ctx.moveTo(2, -4); ctx.lineTo(9, -2.5); ctx.lineTo(2, -0.5); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(2, 2); ctx.lineTo(9, 0.6); ctx.lineTo(2, -1); ctx.closePath(); ctx.fill();
    ctx.restore();

    ctx.restore();
  }

  const ENEMY_PAINT = {
    imp: drawImp,
    ghoul: drawGhoul,
    wraith: drawWraith,
    colossus: drawColossus,
    warden: drawWarden
  };

  function drawEnemy(ctx, e, t) {
    const o = {
      t, phase: e.walkPhase, dir: e.dir || 1,
      flash: e.flash, seed: e.seed
    };
    ctx.save();
    if (e.dying) {
      const d = e.deathT;
      ctx.globalAlpha = Math.max(0, 1 - d * d);
      ctx.translate(e.x, e.y);
      ctx.rotate(e.deathRot * d);
      ctx.scale(1 + d * 0.25, Math.max(0.15, 1 - d * 0.8));
      ctx.translate(-e.x, -e.y);
    }
    const fn = ENEMY_PAINT[e.type];
    if (fn) fn(ctx, e.x, e.y, o);
    ctx.restore();

    if (!e.dying && e.hp < e.maxHp) {
      const w = e.def.barW;
      healthBar(ctx, e.x, e.y - e.def.barH, w, e.hp / e.maxHp, !!e.def.boss);
      statusMarks(ctx, e, e.y - e.def.barH - 7);
    }
  }

  /* ============================================================
     PROJECTILES / PARTICLES / DECALS
     ============================================================ */
  function drawProjectile(ctx, p, t) {
    ctx.save();
    if (p.type === 'blood') {
      // trail
      for (let i = 0; i < p.trail.length; i++) {
        const tr = p.trail[i], a = i / p.trail.length;
        ctx.fillStyle = rgba('#ff2f45', a * 0.4);
        ctx.beginPath(); ctx.arc(tr.x, tr.y, 4.4 * a + 1, 0, TAU); ctx.fill();
      }
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      glow(ctx, p.x, p.y, 14, '#ff2f45', 0.95);
      ctx.restore();
      ctx.fillStyle = '#ffb9c1';
      ctx.beginPath(); ctx.arc(p.x, p.y, 3.6, 0, TAU); ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(p.x - 1, p.y - 1, 1.5, 0, TAU); ctx.fill();
    } else if (p.type === 'frost') {
      const a = Math.atan2(p.vy, p.vx);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      glow(ctx, p.x, p.y, 13, '#66d9ff', 0.8);
      ctx.restore();
      ctx.save();
      ctx.translate(p.x, p.y); ctx.rotate(a + t * 9);
      ctx.fillStyle = '#d6f7ff';
      poly(ctx, [[7, 0], [0, 3.4], [-6, 0], [0, -3.4]]); ctx.fill();
      ctx.strokeStyle = '#66d9ff'; ctx.lineWidth = 1; ctx.stroke();
      ctx.restore();
      ctx.fillStyle = rgba('#dffaff', 0.7);
      ctx.beginPath(); ctx.arc(p.x - Math.cos(a) * 7, p.y - Math.sin(a) * 7, 1.6, 0, TAU); ctx.fill();
    } else if (p.type === 'doom') {
      for (let i = 0; i < p.trail.length; i++) {
        const tr = p.trail[i], a = i / p.trail.length;
        ctx.fillStyle = rgba('#a34dff', a * 0.35);
        ctx.beginPath(); ctx.arc(tr.x, tr.y, 7 * a + 1, 0, TAU); ctx.fill();
      }
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      glow(ctx, p.x, p.y, 22, '#9b3dff', 0.95);
      ctx.restore();
      const g = ctx.createRadialGradient(p.x - 2, p.y - 2, 1, p.x, p.y, 8);
      g.addColorStop(0, '#f6e6ff'); g.addColorStop(0.5, '#b56aff'); g.addColorStop(1, '#5c17a8');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(p.x, p.y, 7.5, 0, TAU); ctx.fill();
      ctx.strokeStyle = rgba('#ffffff', 0.5 + Math.sin(t * 21) * 0.3);
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.moveTo(p.x - 6, p.y - 3); ctx.lineTo(p.x + 1, p.y - 6); ctx.lineTo(p.x + 5, p.y + 2); ctx.lineTo(p.x - 2, p.y + 5);
      ctx.stroke();
    } else if (p.type === 'soul') {
      for (let i = 0; i < p.trail.length; i++) {
        const tr = p.trail[i], a = i / p.trail.length;
        ctx.fillStyle = rgba('#54ff9b', a * 0.35);
        ctx.beginPath(); ctx.arc(tr.x, tr.y, 4 * a + 1, 0, TAU); ctx.fill();
      }
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      glow(ctx, p.x, p.y, 16, '#3dff8f', 0.9);
      ctx.restore();
      ctx.fillStyle = '#dcffed';
      ctx.beginPath(); ctx.ellipse(p.x, p.y, 4.6, 5.6, Math.atan2(p.vy, p.vx) * 0.4, 0, TAU); ctx.fill();
      ctx.fillStyle = '#0e3a22';
      ctx.beginPath(); ctx.arc(p.x - 1.6, p.y - 1, 1, 0, TAU); ctx.fill();
      ctx.beginPath(); ctx.arc(p.x + 1.6, p.y - 1, 1, 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  function drawParticle(ctx, pt) {
    const life = pt.life / pt.maxLife;
    ctx.save();
    ctx.globalAlpha = Math.max(0, life);
    if (pt.kind === 'spark') {
      ctx.strokeStyle = pt.color; ctx.lineWidth = pt.size * life + 0.6;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(pt.x, pt.y);
      ctx.lineTo(pt.x - pt.vx * 0.05, pt.y - pt.vy * 0.05);
      ctx.stroke();
    } else if (pt.kind === 'ring') {
      ctx.strokeStyle = pt.color;
      ctx.lineWidth = 2.4 * life + 0.5;
      ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.size * (1 - life) + 2, 0, TAU); ctx.stroke();
    } else if (pt.kind === 'smoke') {
      ctx.fillStyle = pt.color;
      ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.size * (1.6 - life), 0, TAU); ctx.fill();
    } else if (pt.kind === 'blood') {
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.ellipse(pt.x, pt.y, pt.size, pt.size * (0.5 + life * 0.5), pt.rot, 0, TAU);
      ctx.fill();
    } else { // dot
      ctx.fillStyle = pt.color;
      ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.size * (0.4 + life * 0.6), 0, TAU); ctx.fill();
    }
    ctx.restore();
  }

  function drawDecal(ctx, d) {
    ctx.save();
    ctx.globalAlpha = d.alpha;
    ctx.fillStyle = d.color;
    ctx.translate(d.x, d.y);
    ctx.rotate(d.rot);
    ctx.beginPath(); ctx.ellipse(0, 0, d.r, d.r * 0.66, 0, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(d.r * 0.6, d.r * 0.3, d.r * 0.5, d.r * 0.36, 0.6, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(-d.r * 0.55, d.r * 0.25, d.r * 0.42, d.r * 0.3, -0.4, 0, TAU); ctx.fill();
    ctx.restore();
  }

  /* ============================================================
     TITLE SCREEN SCENE
     ============================================================ */
  function drawTitleScene(ctx, w, h, t, embers) {
    // sky
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#07030a');
    sky.addColorStop(0.55, '#170810');
    sky.addColorStop(1, '#0a0409');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    // stars
    ctx.fillStyle = 'rgba(255,235,240,0.5)';
    for (let i = 0; i < 46; i++) {
      const sx = (i * 97.3) % w, sy = (i * 53.7) % (h * 0.5);
      const tw = 0.4 + Math.sin(t * 2 + i) * 0.4;
      ctx.globalAlpha = tw * 0.7;
      ctx.fillRect(sx, sy, 1.6, 1.6);
    }
    ctx.globalAlpha = 1;

    // blood moon
    const mx = w * 0.72, my = h * 0.26, mr = 74;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    glow(ctx, mx, my, mr * 3.1, '#a02430', 0.5);
    ctx.restore();
    const mg = ctx.createRadialGradient(mx - 16, my - 18, 8, mx, my, mr);
    mg.addColorStop(0, '#ff9aa2');
    mg.addColorStop(0.55, '#d4404f');
    mg.addColorStop(1, '#8e1c2c');
    ctx.fillStyle = mg;
    ctx.beginPath(); ctx.arc(mx, my, mr, 0, TAU); ctx.fill();
    // craters
    ctx.fillStyle = 'rgba(90,10,22,0.4)';
    ctx.beginPath(); ctx.ellipse(mx - 20, my + 14, 17, 13, 0.3, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(mx + 22, my - 10, 12, 10, -0.2, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(mx + 8, my + 30, 9, 7, 0.5, 0, TAU); ctx.fill();

    // mountains
    const ridge = (baseY, col, seed, amp) => {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(0, h);
      ctx.lineTo(0, baseY);
      for (let x = 0; x <= w; x += 40) {
        const n = Math.sin(x * 0.013 + seed) * amp + Math.sin(x * 0.031 + seed * 2) * amp * 0.5;
        ctx.lineTo(x, baseY - Math.abs(n));
      }
      ctx.lineTo(w, h);
      ctx.closePath();
      ctx.fill();
    };
    ridge(h * 0.52, '#0e0712', 3.1, 60);
    ridge(h * 0.62, '#0a050d', 7.7, 44);

    // dead trees silhouettes
    const tree = (x, base, s) => {
      ctx.strokeStyle = '#050208';
      ctx.lineCap = 'round';
      ctx.lineWidth = 7 * s;
      ctx.beginPath(); ctx.moveTo(x, base);
      ctx.quadraticCurveTo(x - 6 * s, base - 60 * s, x + 5 * s, base - 110 * s);
      ctx.stroke();
      ctx.lineWidth = 4 * s;
      ctx.beginPath(); ctx.moveTo(x - 2 * s, base - 60 * s);
      ctx.quadraticCurveTo(x - 34 * s, base - 90 * s, x - 44 * s, base - 128 * s); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x + 3 * s, base - 78 * s);
      ctx.quadraticCurveTo(x + 32 * s, base - 104 * s, x + 40 * s, base - 140 * s); ctx.stroke();
      ctx.lineWidth = 2.4 * s;
      ctx.beginPath(); ctx.moveTo(x - 24 * s, base - 104 * s);
      ctx.quadraticCurveTo(x - 30 * s, base - 126 * s, x - 26 * s, base - 142 * s); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x + 26 * s, base - 118 * s);
      ctx.quadraticCurveTo(x + 34 * s, base - 140 * s, x + 30 * s, base - 154 * s); ctx.stroke();
    };
    tree(w * 0.13, h * 0.78, 1.25);
    tree(w * 0.88, h * 0.75, 1.05);
    tree(w * 0.05, h * 0.84, 0.85);

    // ground
    const gg = ctx.createLinearGradient(0, h * 0.7, 0, h);
    gg.addColorStop(0, '#0b060d');
    gg.addColorStop(1, '#050307');
    ctx.fillStyle = gg;
    ctx.fillRect(0, h * 0.72, w, h * 0.28);

    // gate of the abyss (center)
    const gx = w / 2, gy = h * 0.74;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    glow(ctx, gx, gy - 80, 130, '#8d1526', 0.55);
    ctx.restore();
    // pillars
    const pillar = (px) => {
      const pg = ctx.createLinearGradient(px - 16, 0, px + 16, 0);
      pg.addColorStop(0, '#191221'); pg.addColorStop(0.5, '#2b2136'); pg.addColorStop(1, '#0e0a14');
      ctx.fillStyle = pg;
      ctx.fillRect(px - 15, gy - 190, 30, 190);
      ctx.fillStyle = '#241b2d';
      ctx.fillRect(px - 22, gy - 204, 44, 16);
      ctx.fillRect(px - 20, gy - 14, 40, 14);
      ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = 2;
      ctx.strokeRect(px - 15, gy - 190, 30, 190);
      // glowing runes
      ctx.fillStyle = rgba('#e03a4e', 0.6 + Math.sin(t * 3 + px) * 0.3);
      for (let i = 0; i < 4; i++) {
        ctx.fillRect(px - 5, gy - 170 + i * 40, 10, 3);
      }
    };
    pillar(gx - 96); pillar(gx + 96);
    // arch glow
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const ag = ctx.createRadialGradient(gx, gy - 90, 8, gx, gy - 90, 96);
    ag.addColorStop(0, 'rgba(255,120,130,0.85)');
    ag.addColorStop(0.45, 'rgba(160,20,45,0.55)');
    ag.addColorStop(1, 'rgba(60,5,20,0)');
    ctx.fillStyle = ag;
    ctx.beginPath(); ctx.ellipse(gx, gy - 86, 82, 104, 0, 0, TAU); ctx.fill();
    ctx.restore();

    // demon silhouette in the gate
    ctx.save();
    ctx.translate(gx, gy + Math.sin(t * 1.1) * 2);
    const breathe = 1 + Math.sin(t * 1.1) * 0.012;
    ctx.scale(breathe, breathe);
    ctx.fillStyle = '#040107';
    // body
    ctx.beginPath();
    ctx.moveTo(-30, 0);
    ctx.quadraticCurveTo(-34, -60, -20, -96);
    ctx.quadraticCurveTo(-10, -116, 0, -118);
    ctx.quadraticCurveTo(10, -116, 20, -96);
    ctx.quadraticCurveTo(34, -60, 30, 0);
    ctx.closePath();
    ctx.fill();
    // wings
    ctx.beginPath();
    ctx.moveTo(-16, -92);
    ctx.quadraticCurveTo(-70, -128, -104, -96);
    ctx.quadraticCurveTo(-86, -92, -92, -70);
    ctx.quadraticCurveTo(-64, -78, -56, -56);
    ctx.quadraticCurveTo(-36, -70, -18, -58);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(16, -92);
    ctx.quadraticCurveTo(70, -128, 104, -96);
    ctx.quadraticCurveTo(86, -92, 92, -70);
    ctx.quadraticCurveTo(64, -78, 56, -56);
    ctx.quadraticCurveTo(36, -70, 18, -58);
    ctx.closePath();
    ctx.fill();
    // horns
    ctx.beginPath();
    ctx.moveTo(-9, -112);
    ctx.quadraticCurveTo(-24, -132, -18, -152);
    ctx.quadraticCurveTo(-12, -132, -3, -118);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(9, -112);
    ctx.quadraticCurveTo(24, -132, 18, -152);
    ctx.quadraticCurveTo(12, -132, 3, -118);
    ctx.closePath();
    ctx.fill();
    // eyes
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    glow(ctx, -6, -104, 14, '#ff2f45', 0.95 + Math.sin(t * 4) * 0.05);
    glow(ctx, 6, -104, 14, '#ff2f45', 0.95 + Math.sin(t * 4.4) * 0.05);
    ctx.restore();
    ctx.fillStyle = '#ffd9dd';
    ctx.beginPath(); ctx.ellipse(-6, -104, 2.6, 1.7, -0.3, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.ellipse(6, -104, 2.6, 1.7, 0.3, 0, TAU); ctx.fill();
    ctx.restore();

    // embers
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const e of embers) {
      const a = Math.max(0, e.life / e.maxLife);
      ctx.fillStyle = rgba(e.color, a * 0.9);
      ctx.beginPath(); ctx.arc(e.x, e.y, e.size * (0.5 + a * 0.5), 0, TAU); ctx.fill();
    }
    ctx.restore();

    // fog + vignette
    drawFog(ctx, w, h, t);
    drawVignette(ctx, w, h, t);
  }

  /* ---------------- public API ---------------- */
  return {
    rgba, mix, lighten, darken, glow, poly,
    buildBackground,
    drawSpawnRift, drawPortal, drawDecorOverlay, drawVignette, drawFog,
    drawTower, drawTowerIcon, drawRangeCircle,
    drawEnemy, healthBar,
    drawProjectile, drawParticle, drawDecal,
    drawTitleScene
  };
})();
