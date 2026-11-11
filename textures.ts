import * as THREE from "three";

const cache = new Map<string, THREE.Texture>();

function canvas(w: number, h: number) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return [c, c.getContext("2d")!] as const;
}

function rng(seed: number) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

function finish(c: HTMLCanvasElement, repeat = true, srgb = true) {
  const t = new THREE.CanvasTexture(c);
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.generateMipmaps = true;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  return t;
}

/** Multi-octave grey noise for terrain detail (tileable by wrapping). */
export function detailTex(): THREE.Texture {
  const k = "detail";
  if (cache.has(k)) return cache.get(k)!;
  const S = 512;
  const [c, g] = canvas(S, S);
  const img = g.createImageData(S, S);
  const r = rng(42);
  const grid = (n: number) => { const a: number[] = []; for (let i = 0; i < n * n; i++) a.push(r()); return a; };
  const octs = [4, 8, 16, 32, 64, 128].map((n) => ({ n, a: grid(n) }));
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      let v = 0, amp = 0.5, tot = 0;
      for (const o of octs) {
        const fx = (x / S) * o.n, fy = (y / S) * o.n;
        const xi = Math.floor(fx), yi = Math.floor(fy), xf = fx - xi, yf = fy - yi;
        const at = (i: number, j: number) => o.a[((j % o.n) * o.n + (i % o.n))];
        const u = xf * xf * (3 - 2 * xf), w = yf * yf * (3 - 2 * yf);
        const a = at(xi, yi), b = at(xi + 1, yi), cc = at(xi, yi + 1), d = at(xi + 1, yi + 1);
        v += (a + (b - a) * u + (cc - a) * w + (a - b - cc + d) * u * w) * amp;
        tot += amp;
        amp *= 0.6;
      }
      v = v / tot;
      const p = Math.floor(150 + (v - 0.5) * 210 + (r() - 0.5) * 30);
      const i = (y * S + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = Math.max(0, Math.min(255, p));
      img.data[i + 3] = 255;
    }
  g.putImageData(img, 0, 0);
  const t = finish(c, true, false);
  cache.set(k, t);
  return t;
}

/** Runway asphalt with real ICAO-like markings. Mapped on a 45 x 800 strip. */
export function runwayTex(): THREE.Texture {
  const k = "runway";
  if (cache.has(k)) return cache.get(k)!;
  const W = 256, H = 4096;
  const [c, g] = canvas(W, H);
  const r = rng(7);
  g.fillStyle = "#3a3c3f";
  g.fillRect(0, 0, W, H);
  for (let i = 0; i < 60000; i++) {
    const v = 40 + r() * 40;
    g.fillStyle = `rgba(${v},${v},${v + 2},${0.35 + r() * 0.4})`;
    g.fillRect(r() * W, r() * H, 1 + r() * 2, 1 + r() * 2);
  }
  // tire marks near touchdown zones
  g.globalAlpha = 0.18;
  for (const base of [H * 0.12, H * 0.88]) {
    for (let i = 0; i < 70; i++) {
      g.fillStyle = "#111";
      const x = W / 2 + (r() - 0.5) * 70;
      g.fillRect(x, base + (r() - 0.5) * 500, 2 + r() * 3, 60 + r() * 200);
    }
  }
  g.globalAlpha = 1;
  g.fillStyle = "#e8e8e2";
  // edge lines
  g.fillRect(6, 0, 4, H);
  g.fillRect(W - 10, 0, 4, H);
  // centerline dashes
  for (let y = 520; y < H - 520; y += 120) g.fillRect(W / 2 - 2, y, 4, 64);
  // thresholds (piano keys)
  for (const y0 of [24, H - 24 - 150]) for (let i = 0; i < 8; i++) { const x = 18 + i * 28 + (i >= 4 ? 8 : 0); g.fillRect(x, y0, 14, 150); }
  // aiming points & touchdown zone markings
  for (const [y, dir] of [[H * 0.12, 1], [H * 0.88, -1]] as const) {
    g.fillRect(60, y, 22, 180);
    g.fillRect(W - 82, y, 22, 180);
    for (let i = 1; i < 4; i++) {
      const yy = y + dir * (i * 260);
      g.fillRect(40, yy, 8, 90); g.fillRect(52, yy, 8, 90);
      g.fillRect(W - 60, yy, 8, 90); g.fillRect(W - 48, yy, 8, 90);
    }
  }
  // runway numbers
  g.font = "bold 110px Arial";
  g.textAlign = "center";
  g.save();
  g.translate(W / 2, 260);
  g.rotate(Math.PI);
  g.fillText("36", 0, 0);
  g.restore();
  g.save();
  g.translate(W / 2, H - 260);
  g.fillText("18", 0, 0);
  g.restore();
  const t = finish(c, false);
  cache.set(k, t);
  return t;
}

export function concreteTex(): THREE.Texture {
  const k = "concrete";
  if (cache.has(k)) return cache.get(k)!;
  const S = 512;
  const [c, g] = canvas(S, S);
  const r = rng(99);
  g.fillStyle = "#8d8c86";
  g.fillRect(0, 0, S, S);
  for (let i = 0; i < 30000; i++) {
    const v = 110 + r() * 60;
    g.fillStyle = `rgba(${v},${v},${v - 4},0.35)`;
    g.fillRect(r() * S, r() * S, 2, 2);
  }
  g.strokeStyle = "rgba(40,40,40,0.55)";
  g.lineWidth = 2;
  for (let i = 0; i <= S; i += 128) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, S); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(S, i); g.stroke(); }
  for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(30,25,20,${r() * 0.15})`; g.beginPath(); g.arc(r() * S, r() * S, 5 + r() * 30, 0, 7); g.fill(); }
  const t = finish(c);
  cache.set(k, t);
  return t;
}

/** Building facade with windows; emissive map variant for night. */
export function facadeTex(variant: number, night: boolean): { map: THREE.Texture; emissive: THREE.Texture } {
  const k = `facade-${variant}-${night}`;
  if (cache.has(k)) return { map: cache.get(k)!, emissive: cache.get(k + "e")! };
  const W = 256, H = 512;
  const [c, g] = canvas(W, H);
  const [ce, ge] = canvas(W, H);
  const r = rng(variant * 31 + 3);
  const styles = [
    { wall: "#b9b4aa", win: "#2b3d4f", cols: 6, rows: 16, glass: false },
    { wall: "#5d6f80", win: "#9cc4e0", cols: 8, rows: 24, glass: true },
    { wall: "#8a6e5a", win: "#2a2a30", cols: 5, rows: 14, glass: false },
    { wall: "#2c3640", win: "#7fa8c8", cols: 10, rows: 30, glass: true },
    { wall: "#d8d4c8", win: "#3a4a58", cols: 4, rows: 12, glass: false },
  ];
  const st = styles[variant % styles.length];
  g.fillStyle = st.wall;
  g.fillRect(0, 0, W, H);
  ge.fillStyle = "#000";
  ge.fillRect(0, 0, W, H);
  for (let i = 0; i < 4000; i++) { g.fillStyle = `rgba(0,0,0,${r() * 0.06})`; g.fillRect(r() * W, r() * H, 2, 2); }
  const cw = W / st.cols, rh = H / st.rows;
  for (let y = 0; y < st.rows; y++)
    for (let x = 0; x < st.cols; x++) {
      const px = x * cw + cw * (st.glass ? 0.06 : 0.2), py = y * rh + rh * (st.glass ? 0.08 : 0.22);
      const w = cw * (st.glass ? 0.88 : 0.6), h = rh * (st.glass ? 0.84 : 0.56);
      const grad = g.createLinearGradient(px, py, px + w, py + h);
      grad.addColorStop(0, st.win);
      grad.addColorStop(1, r() < 0.5 ? "#c8dcea" : "#1a2530");
      g.fillStyle = grad;
      g.globalAlpha = st.glass ? 0.85 : 1;
      g.fillRect(px, py, w, h);
      g.globalAlpha = 1;
      if (r() < (night ? 0.45 : 0.1)) {
        const warm = r() < 0.7;
        ge.fillStyle = warm ? `rgb(255,${200 + r() * 40},${120 + r() * 60})` : "rgb(190,220,255)";
        ge.globalAlpha = 0.5 + r() * 0.5;
        ge.fillRect(px, py, w, h);
        ge.globalAlpha = 1;
      }
    }
  // horizontal floor bands
  g.fillStyle = "rgba(0,0,0,0.12)";
  for (let y = 0; y < st.rows; y++) g.fillRect(0, y * rh, W, 2);
  const m = finish(c);
  const e = finish(ce);
  cache.set(k, m);
  cache.set(k + "e", e);
  return { map: m, emissive: e };
}

/** Tileable water normal map built from summed sine waves. */
export function waterNormalTex(): THREE.Texture {
  const k = "waternormal";
  if (cache.has(k)) return cache.get(k)!;
  const S = 256;
  const [c, g] = canvas(S, S);
  const img = g.createImageData(S, S);
  const r = rng(5);
  const waves = Array.from({ length: 14 }, () => ({ kx: Math.floor(r() * 9 - 4) || 1, ky: Math.floor(r() * 9 - 4), a: 0.3 + r(), p: r() * 6.28 }));
  for (let y = 0; y < S; y++)
    for (let x = 0; x < S; x++) {
      let dx = 0, dy = 0;
      for (const w of waves) {
        const ph = ((w.kx * x + w.ky * y) / S) * Math.PI * 2 + w.p;
        const cs = Math.cos(ph) * w.a;
        dx += cs * w.kx * 0.08;
        dy += cs * w.ky * 0.08;
      }
      const n = new THREE.Vector3(-dx, -dy, 1).normalize();
      const i = (y * S + x) * 4;
      img.data[i] = (n.x * 0.5 + 0.5) * 255;
      img.data[i + 1] = (n.y * 0.5 + 0.5) * 255;
      img.data[i + 2] = (n.z * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  g.putImageData(img, 0, 0);
  const t = finish(c, true, false);
  cache.set(k, t);
  return t;
}

/** Soft cumulus puff for cloud sprites. */
export function cloudTex(): THREE.Texture {
  const k = "cloud";
  if (cache.has(k)) return cache.get(k)!;
  const S = 256;
  const [c, g] = canvas(S, S);
  const r = rng(11);
  for (let i = 0; i < 40; i++) {
    const x = S / 2 + (r() - 0.5) * S * 0.5, y = S / 2 + (r() - 0.5) * S * 0.35, rad = S * (0.1 + r() * 0.18);
    const gr = g.createRadialGradient(x, y, 0, x, y, rad);
    const shade = 235 + r() * 20;
    gr.addColorStop(0, `rgba(${shade},${shade},${shade + 5},0.35)`);
    gr.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = gr;
    g.beginPath();
    g.arc(x, y, rad, 0, 7);
    g.fill();
  }
  const t = finish(c, false);
  cache.set(k, t);
  return t;
}

/** Aircraft skin with panel lines, rivets and weathering. */
export function panelTex(): THREE.Texture {
  const k = "panel";
  if (cache.has(k)) return cache.get(k)!;
  const S = 512;
  const [c, g] = canvas(S, S);
  const r = rng(77);
  g.fillStyle = "#ffffff";
  g.fillRect(0, 0, S, S);
  for (let i = 0; i < 18000; i++) { const v = 225 + r() * 30; g.fillStyle = `rgba(${v},${v},${v},0.5)`; g.fillRect(r() * S, r() * S, 2, 2); }
  g.strokeStyle = "rgba(60,60,60,0.45)";
  g.lineWidth = 1.2;
  let y = 0;
  while (y < S) {
    const h = 40 + r() * 70;
    let x = 0;
    while (x < S) {
      const w = 50 + r() * 110;
      g.strokeRect(x + 0.5, y + 0.5, w, h);
      g.fillStyle = `rgba(0,0,0,${r() * 0.05})`;
      g.fillRect(x, y, w, h);
      g.fillStyle = "rgba(70,70,70,0.35)";
      for (let rx = x + 4; rx < x + w; rx += 7) g.fillRect(rx, y + 3, 1, 1);
      x += w;
    }
    y += h;
  }
  // streaks
  for (let i = 0; i < 50; i++) { g.fillStyle = `rgba(40,35,30,${r() * 0.06})`; g.fillRect(r() * S, r() * S, 1 + r() * 3, 30 + r() * 120); }
  const t = finish(c);
  cache.set(k, t);
  return t;
}

/** National insignia roundel (generic). */
export function roundelTex(country: string): THREE.Texture {
  const k = "roundel-" + country;
  if (cache.has(k)) return cache.get(k)!;
  const S = 128;
  const [c, g] = canvas(S, S);
  const ring = (rad: number, col: string) => { g.fillStyle = col; g.beginPath(); g.arc(S / 2, S / 2, rad, 0, 7); g.fill(); };
  if (country === "USA") {
    ring(60, "#1d2b5a");
    g.fillStyle = "#fff";
    g.beginPath();
    for (let i = 0; i < 10; i++) { const a = (i * Math.PI) / 5 - Math.PI / 2, rr = i % 2 ? 22 : 54; g.lineTo(S / 2 + Math.cos(a) * rr, S / 2 + Math.sin(a) * rr); }
    g.fill();
  } else if (["USSR", "Russia", "China"].includes(country)) {
    g.fillStyle = "#c8102e";
    g.beginPath();
    for (let i = 0; i < 10; i++) { const a = (i * Math.PI) / 5 - Math.PI / 2, rr = i % 2 ? 24 : 60; g.lineTo(S / 2 + Math.cos(a) * rr, S / 2 + Math.sin(a) * rr); }
    g.fill();
  } else if (country === "Germany") {
    g.fillStyle = "#fff"; g.fillRect(24, 54, 80, 20); g.fillRect(54, 24, 20, 80);
    g.fillStyle = "#111"; g.fillRect(30, 58, 68, 12); g.fillRect(58, 30, 12, 68);
  } else if (country === "Japan") {
    ring(60, "#fff"); ring(48, "#bc002d");
  } else if (country === "France") {
    ring(60, "#0055a4"); ring(40, "#fff"); ring(20, "#ef4135");
  } else if (country === "Turkey") {
    ring(60, "#e30a17"); ring(36, "#fff"); ring(18, "#e30a17");
  } else {
    ring(60, "#1d3d8f"); ring(40, "#fff"); ring(20, "#c8102e");
  }
  const t = finish(c, false);
  cache.set(k, t);
  return t;
}
