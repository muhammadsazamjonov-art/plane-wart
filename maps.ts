import * as THREE from "three";
import { cloudTex, concreteTex, detailTex, facadeTex, runwayTex, waterNormalTex } from "./textures";
import { PLANES, buildPlaneMesh } from "./planes";

export type MapDef = {
  id: number;
  name: string;
  size: number;
  small: boolean;
  sky: number;
  fog: number;
  low: number;
  high: number;
  peak: number;
  water: number;
  sea: number;
  amp: number;
  freq: number;
  props: "city" | "trees" | "rocks" | "ice" | "pyramids" | "lava" | "islands" | "lights";
  night?: boolean;
  sun: number;
  sunElev: number;
  turbidity: number;
  clouds: number;
  desc: string;
};

export const MAPS: MapDef[] = [
  { id: 0, name: "Sahro Kanyoni", size: 2400, small: true, sky: 0xf2c48d, fog: 0xd9c3a5, low: 0xc9955a, high: 0xa86a3e, peak: 0xd8b088, water: 0x2a7a8a, sea: -40, amp: 120, freq: 1.4, props: "pyramids", sun: 0xfff0d8, sunElev: 38, turbidity: 6, clouds: 0.3, desc: "Kichik • Qum va piramidalar" },
  { id: 1, name: "Muz Fyordi", size: 2400, small: true, sky: 0xbfd9ef, fog: 0xcfdeea, low: 0x7d8f98, high: 0xdfe8ee, peak: 0xffffff, water: 0x123c58, sea: 0, amp: 160, freq: 1.6, props: "ice", sun: 0xffffff, sunElev: 18, turbidity: 2, clouds: 1, desc: "Kichik • Suv osti kemalari" },
  { id: 2, name: "Neon Shahar", size: 2400, small: true, sky: 0x0b0f2a, fog: 0x12162e, low: 0x2a2d38, high: 0x3a3d48, peak: 0x4a4d58, water: 0x0a1428, sea: -60, amp: 40, freq: 0.8, props: "city", night: true, sun: 0x8899ff, sunElev: -5, turbidity: 2, clouds: 0.4, desc: "Kichik • Tungi osmono'par binolar" },
  { id: 3, name: "Vulqon Oroli", size: 2400, small: true, sky: 0x6a4a40, fog: 0x5a4038, low: 0x2e2824, high: 0x45403b, peak: 0x6a3020, water: 0x1a2c38, sea: 0, amp: 180, freq: 1.2, props: "lava", sun: 0xffb088, sunElev: 12, turbidity: 12, clouds: 0.8, desc: "Kichik • Lava va kul" },
  { id: 4, name: "Okean Bazasi", size: 7000, small: false, sky: 0x87c3ef, fog: 0xa9c9e2, low: 0xd9c79a, high: 0x4a7a32, peak: 0x3f6a2c, water: 0x14587f, sea: 0, amp: 140, freq: 2.2, props: "islands", sun: 0xffffff, sunElev: 50, turbidity: 3, clouds: 1, desc: "Katta • Orollar, suv osti kemalari" },
  { id: 5, name: "Alp Tog'lari", size: 7000, small: false, sky: 0x9ec9f0, fog: 0xb4cde6, low: 0x4e7a34, high: 0x6d6a62, peak: 0xffffff, water: 0x235a78, sea: -30, amp: 420, freq: 2.4, props: "trees", sun: 0xfff6e8, sunElev: 32, turbidity: 2.5, clouds: 1.2, desc: "Katta • Baland cho'qqilar" },
  { id: 6, name: "Megapolis", size: 7000, small: false, sky: 0xffb38a, fog: 0xe0a888, low: 0x5a5c60, high: 0x6a6d72, peak: 0x80838a, water: 0x2a4a62, sea: -20, amp: 60, freq: 1.5, props: "city", sun: 0xffc890, sunElev: 5, turbidity: 8, clouds: 0.7, desc: "Katta • Quyosh botishi, ulkan shahar" },
  { id: 7, name: "Qizil Cho'l", size: 7000, small: false, sky: 0xd9a07a, fog: 0xc89878, low: 0xa65a32, high: 0x7e4022, peak: 0xc07a4e, water: 0x2a6070, sea: -80, amp: 300, freq: 2, props: "rocks", sun: 0xffd2a0, sunElev: 25, turbidity: 9, clouds: 0.2, desc: "Katta • Mars kabi qoyalar" },
];

function hash(x: number, y: number) {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
function noise(x: number, y: number) {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash(xi, yi), b = hash(xi + 1, yi), c = hash(xi, yi + 1), d = hash(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

export function makeHeightFn(m: MapDef) {
  const f = m.freq / 1000;
  const ridged = m.props === "trees" || m.props === "rocks" || m.props === "ice";
  return (x: number, z: number) => {
    let h = 0, amp = 1, fr = f;
    for (let i = 0; i < 6; i++) {
      let n = (noise(x * fr + 31.7 * i, z * fr - 17.3 * i) - 0.5) * 2;
      if (ridged && i < 3) n = (1 - Math.abs(n)) * 1.6 - 0.8; // sharp ridges like real mountains
      h += n * amp;
      amp *= 0.5;
      fr *= 2.05;
    }
    h *= m.amp;
    if (m.props === "islands") h = h * 1.4 - 70;
    if (m.props === "rocks") h = Math.round(h / 40) * 40 * 0.6 + h * 0.4; // mesas / terraces
    if (m.props === "lava") {
      const d = Math.hypot(x - m.size * 0.2, z + m.size * 0.2);
      h += Math.max(0, 420 - d * 0.9) - (d < 80 ? (80 - d) * 2.5 : 0);
    }
    const dx = Math.abs(x) / 130, dz = Math.abs(z) / 460;
    const r = Math.max(dx, dz);
    const t = Math.min(1, Math.max(0, (r - 1) / 1.5));
    const baseH = Math.max(m.sea + 6, 10);
    return baseH + (h - baseH) * t * t * (3 - 2 * t);
  };
}

export type World = {
  group: THREE.Group;
  heightAt: (x: number, z: number) => number;
  baseTargets: THREE.Vector3[];
  baseCenter: THREE.Vector3;
  groundLevel: number;
  water: THREE.Mesh;
  radar: THREE.Object3D | null;
  clouds: THREE.Group;
};

const C = (h: number) => new THREE.Color(h);

export function buildWorld(m: MapDef, quality: string): World {
  const group = new THREE.Group();
  const heightAt = makeHeightFn(m);
  const q = quality;
  const hiQ = q === "2K" || q === "4K";
  const seg = q === "1K" ? 128 : q === "HD" ? 220 : q === "2K" ? 300 : 400;
  const ext = m.size * 1.6;
  const geo = new THREE.PlaneGeometry(ext, ext, seg, seg);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) pos.setY(i, heightAt(pos.getX(i), pos.getZ(i)));
  geo.computeVertexNormals();
  const nrm = geo.attributes.normal as THREE.BufferAttribute;
  const cols = new Float32Array(pos.count * 3);
  const cl = C(m.low), ch = C(m.high), cp = C(m.peak), tmp = new THREE.Color();
  const rock = C(m.high).multiplyScalar(0.75).lerp(C(0x5a5550), 0.4);
  const sand = m.props === "ice" ? C(0xcfd8de) : m.props === "lava" ? C(0x222020) : C(0xcdb98c);
  const snowLine = m.sea + m.amp * 0.65;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i), h = pos.getY(i);
    const slope = 1 - nrm.getY(i);
    const t = (h - m.sea) / (m.amp * 1.2);
    if (t < 0.45) tmp.copy(cl).lerp(ch, Math.max(0, t / 0.45));
    else tmp.copy(ch).lerp(cp, Math.min(1, (t - 0.45) / 0.55));
    // patchy variation (fields, scrub)
    const patch = noise(x * 0.01, z * 0.01);
    tmp.offsetHSL((patch - 0.5) * 0.03, (patch - 0.5) * 0.12, (patch - 0.5) * 0.08);
    if (slope > 0.18) tmp.lerp(rock, Math.min(1, (slope - 0.18) * 3.5));
    if ((m.props === "trees" || m.props === "ice") && h > snowLine && slope < 0.45) tmp.lerp(C(0xf4f7fa), Math.min(1, (h - snowLine) / 60));
    if (h < m.sea + 5 && h > m.sea - 30) tmp.lerp(sand, Math.min(1, (m.sea + 5 - h) / 6));
    if (m.props === "lava" && h > 280) tmp.lerp(C(0x1a1410), 0.7);
    // airfield grass around the base on green maps
    if ((m.props === "islands" || m.props === "trees" || m.props === "city") && Math.abs(x) < 200 && Math.abs(z) < 640) {
      const k = Math.min(1, Math.max(0, 1 - Math.max((Math.abs(x) - 140) / 60, (Math.abs(z) - 560) / 80)));
      tmp.lerp(C(0x5b7a3a).offsetHSL(0, 0, (patch - 0.5) * 0.08), k);
    }
    cols[i * 3] = tmp.r; cols[i * 3 + 1] = tmp.g; cols[i * 3 + 2] = tmp.b;
  }
  geo.setAttribute("color", new THREE.BufferAttribute(cols, 3));
  const dTex = detailTex().clone();
  dTex.needsUpdate = true;
  dTex.repeat.set(ext / 90, ext / 90);
  const terrain = new THREE.Mesh(
    geo,
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0, map: dTex, bumpMap: dTex, bumpScale: 2.5 })
  );
  terrain.receiveShadow = true;
  group.add(terrain);

  // ---- water ----
  const wn = waterNormalTex().clone();
  wn.needsUpdate = true;
  wn.repeat.set(m.size / 60, m.size / 60);
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(m.size * 4, m.size * 4),
    new THREE.MeshPhysicalMaterial({
      color: m.water, roughness: 0.08, metalness: 0.1, normalMap: wn, normalScale: new THREE.Vector2(0.6, 0.6),
      clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 1.4, transparent: true, opacity: 0.92,
    })
  );
  water.rotation.x = -Math.PI / 2;
  water.position.y = m.sea;
  water.receiveShadow = true;
  water.name = "water";
  group.add(water);

  // ---- vegetation / props ----
  const rnd = (() => { let s = m.id * 9973 + 7; return () => ((s = (s * 16807) % 2147483647) / 2147483647); })();
  const density = q === "1K" ? 0.45 : q === "HD" ? 1 : q === "2K" ? 1.6 : 2.4;
  const dummy = new THREE.Object3D();
  const spots = (n: number, filter: (x: number, z: number, h: number) => boolean, spread = 1.5) => {
    const out: [number, number, number][] = [];
    for (let i = 0; i < n * 4 && out.length < n; i++) {
      const x = (rnd() - 0.5) * m.size * spread, z = (rnd() - 0.5) * m.size * spread;
      if (Math.abs(x) < 220 && Math.abs(z) < 650) continue;
      const h = heightAt(x, z);
      if (h < m.sea + 3) continue;
      if (filter(x, z, h)) out.push([x, h, z]);
    }
    return out;
  };
  const slopeAt = (x: number, z: number) => Math.abs(heightAt(x + 6, z) - heightAt(x - 6, z)) + Math.abs(heightAt(x, z + 6) - heightAt(x, z - 6));
  const inst = (g: THREE.BufferGeometry, mat: THREE.Material, list: { p: [number, number, number]; s: THREE.Vector3; ry: number; c?: THREE.Color }[], shadow: boolean) => {
    if (!list.length) return;
    const im = new THREE.InstancedMesh(g, mat, list.length);
    list.forEach((e, i) => {
      dummy.position.set(e.p[0], e.p[1], e.p[2]);
      dummy.rotation.set(0, e.ry, 0);
      dummy.scale.copy(e.s);
      dummy.updateMatrix();
      im.setMatrixAt(i, dummy.matrix);
      if (e.c) im.setColorAt(i, e.c);
    });
    im.castShadow = shadow && hiQ;
    im.receiveShadow = true;
    group.add(im);
  };

  const treeLike = m.props === "trees" || m.props === "islands" || m.props === "pyramids" || m.props === "city";
  if (treeLike) {
    const conifer = m.props === "trees";
    const palm = m.props === "islands" || m.props === "pyramids";
    const n = Math.floor((m.small ? 900 : 2600) * density * (m.props === "pyramids" ? 0.15 : m.props === "city" ? 0.3 : 1));
    const ts = spots(n, (x, z, h) => {
      if (slopeAt(x, z) > 9) return false;
      if (conifer && h > m.sea + m.amp * 0.6) return false;
      if (m.props === "pyramids") return noise(x * 0.004, z * 0.004) > 0.68 && h < m.sea + 70; // oases
      if (m.props === "city") return Math.hypot(x, z) > (m.small ? 900 : 2600);
      return noise(x * 0.003 + 9, z * 0.003) > 0.35; // forest clusters
    });
    const trunks: { p: [number, number, number]; s: THREE.Vector3; ry: number }[] = [];
    const leaves: { p: [number, number, number]; s: THREE.Vector3; ry: number; c: THREE.Color }[] = [];
    const leaves2: typeof leaves = [];
    for (const p of ts) {
      const hgt = (conifer ? 14 : palm ? 12 : 10) * (0.7 + rnd() * 0.7);
      const ry = rnd() * 6.28;
      trunks.push({ p: [p[0], p[1] - 0.5, p[2]], s: new THREE.Vector3(1, hgt * (palm ? 1 : 0.45), 1), ry });
      const col = new THREE.Color(conifer ? 0x1f4a26 : palm ? 0x3d7a2a : 0x3e6b2a).offsetHSL((rnd() - 0.5) * 0.04, 0, (rnd() - 0.5) * 0.1);
      if (conifer) {
        leaves.push({ p: [p[0], p[1] + hgt * 0.2, p[2]], s: new THREE.Vector3(hgt * 0.32, hgt * 0.55, hgt * 0.32), ry, c: col });
        leaves2.push({ p: [p[0], p[1] + hgt * 0.5, p[2]], s: new THREE.Vector3(hgt * 0.22, hgt * 0.45, hgt * 0.22), ry: ry + 1, c: col.clone().offsetHSL(0, 0, 0.03) });
      } else if (palm) {
        leaves.push({ p: [p[0], p[1] + hgt, p[2]], s: new THREE.Vector3(hgt * 0.45, hgt * 0.12, hgt * 0.45), ry, c: col });
      } else {
        leaves.push({ p: [p[0], p[1] + hgt * 0.55, p[2]], s: new THREE.Vector3(hgt * 0.45, hgt * 0.4, hgt * 0.45), ry, c: col });
      }
    }
    const barkMat = new THREE.MeshStandardMaterial({ color: palm ? 0x8a7458 : 0x4a3424, roughness: 1 });
    inst(new THREE.CylinderGeometry(palm ? 0.25 : 0.3, palm ? 0.4 : 0.5, 1, 6).translate(0, 0.5, 0), barkMat, trunks, true);
    const leafMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, map: detailTex() });
    if (conifer) {
      inst(new THREE.ConeGeometry(1, 1, 9, 2).translate(0, 0.5, 0), leafMat, leaves, true);
      inst(new THREE.ConeGeometry(1, 1, 9, 2).translate(0, 0.5, 0), leafMat, leaves2, true);
    } else if (palm) {
      const fronds = new THREE.ConeGeometry(1, 1, 7, 1, true);
      fronds.rotateX(Math.PI);
      inst(fronds, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, side: THREE.DoubleSide }), leaves, true);
    } else {
      const g = new THREE.IcosahedronGeometry(1, 2);
      const p = g.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < p.count; i++) { const k = 0.82 + hash(p.getX(i) * 3, p.getY(i) * 5 + p.getZ(i)) * 0.3; p.setXYZ(i, p.getX(i) * k, p.getY(i) * k, p.getZ(i) * k); }
      g.computeVertexNormals();
      inst(g, leafMat, leaves, true);
    }
  }

  // rocks / boulders (all maps except city)
  if (m.props !== "city") {
    const n = Math.floor((m.small ? 220 : 600) * density * (m.props === "rocks" || m.props === "lava" ? 2.5 : 0.6));
    const rs = spots(n, () => true);
    const g = new THREE.IcosahedronGeometry(1, q === "1K" ? 1 : 2);
    const p = g.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      const k = 0.7 + noise(p.getX(i) * 2 + 5, p.getY(i) * 2 + p.getZ(i) * 2) * 0.6;
      p.setXYZ(i, p.getX(i) * k, p.getY(i) * k * 0.8, p.getZ(i) * k);
    }
    g.computeVertexNormals();
    const base = m.props === "ice" ? 0xe6f2fa : m.props === "lava" ? 0x2a2420 : m.props === "rocks" ? 0x8a4a2a : 0x7a756d;
    const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: m.props === "ice" ? 0.25 : 0.95, metalness: 0, map: detailTex(), bumpMap: detailTex(), bumpScale: 3, emissive: m.props === "lava" ? 0x551100 : 0x000000 });
    inst(g, mat, rs.map((r) => {
      const s = m.props === "rocks" ? 12 + rnd() * 50 : m.props === "ice" ? 10 + rnd() * 30 : 3 + rnd() * 14;
      const tall = m.props === "rocks" ? 1 + rnd() * 2.5 : m.props === "ice" ? 1.5 + rnd() * 3 : 0.6 + rnd() * 0.5;
      return { p: [r[0], r[1] - s * 0.2, r[2]], s: new THREE.Vector3(s, s * tall, s * (0.7 + rnd() * 0.6)), ry: rnd() * 6.28, c: new THREE.Color(base).offsetHSL(0, 0, (rnd() - 0.5) * 0.12) };
    }), true);
  }

  // pyramids
  if (m.props === "pyramids") {
    const sandstone = new THREE.MeshStandardMaterial({ color: 0xd8b47a, roughness: 0.95, map: detailTex(), bumpMap: detailTex(), bumpScale: 4, flatShading: true });
    const g = new THREE.ConeGeometry(0.7071, 1, 4, 8).rotateY(Math.PI / 4).translate(0, 0.5, 0);
    const ps = spots(Math.floor(14 * density), (x, z) => Math.hypot(x, z) > 500);
    inst(g, sandstone, ps.map((p) => { const s = 60 + rnd() * 120; return { p: [p[0], p[1] - 2, p[2]], s: new THREE.Vector3(s * 1.5, s, s * 1.5), ry: rnd() * 0.3 }; }), true);
  }

  // city buildings with window facades
  if (m.props === "city") {
    const cityR = m.small ? 900 : 2600;
    const buckets = [40, 90, 160, 260, 400];
    const night = !!m.night;
    const lists: { p: [number, number, number]; s: THREE.Vector3; ry: number }[][] = [];
    for (let v = 0; v < 5 * buckets.length; v++) lists.push([]);
    const roofs: { p: [number, number, number]; s: THREE.Vector3; ry: number }[] = [];
    const nb = Math.floor((m.small ? 420 : 1300) * Math.min(1.6, density));
    // grid-aligned blocks with streets
    const block = 70;
    for (let i = 0; i < nb * 3 && roofs.length < nb; i++) {
      const bx = Math.round(((rnd() - 0.5) * cityR * 2) / block) * block, bz = Math.round(((rnd() - 0.5) * cityR * 2) / block) * block;
      const d = Math.hypot(bx, bz);
      if (d > cityR || (Math.abs(bx) < 220 && Math.abs(bz) < 650)) continue;
      const h0 = heightAt(bx, bz);
      if (h0 < m.sea + 3) continue;
      const centre = 1 - d / cityR;
      const hgt = 20 + rnd() * (40 + centre * centre * (m.small ? 280 : 420));
      const w = 24 + rnd() * 26, dd = 24 + rnd() * 26;
      let bi = buckets.findIndex((b) => hgt <= b * 1.3);
      if (bi < 0) bi = buckets.length - 1;
      const v = Math.floor(rnd() * 5);
      lists[v * buckets.length + bi].push({ p: [bx, h0 - 2, bz], s: new THREE.Vector3(w, hgt, dd), ry: 0 });
      roofs.push({ p: [bx, h0 - 2 + hgt, bz], s: new THREE.Vector3(w * 0.4, 3 + rnd() * 5, dd * 0.4), ry: 0 });
    }
    for (let v = 0; v < 5; v++) {
      const ft = facadeTex(v, night);
      for (let b = 0; b < buckets.length; b++) {
        const list = lists[v * buckets.length + b];
        if (!list.length) continue;
        const g = new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
        const uv = g.attributes.uv as THREE.BufferAttribute;
        const nn = g.attributes.normal as THREE.BufferAttribute;
        for (let i = 0; i < uv.count; i++) {
          if (Math.abs(nn.getY(i)) > 0.5) uv.setXY(i, 0.02, 0.02); // roof samples a wall pixel
          else uv.setXY(i, uv.getX(i) * 0.6, uv.getY(i) * (buckets[b] / 70));
        }
        const mat = new THREE.MeshStandardMaterial({
          map: ft.map, emissiveMap: ft.emissive, emissive: 0xffffff, emissiveIntensity: night ? 1.6 : 0.15,
          roughness: v % 2 ? 0.15 : 0.6, metalness: v % 2 ? 0.6 : 0.1, envMapIntensity: 1.2,
        });
        inst(g, mat, list, true);
      }
    }
    inst(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), new THREE.MeshStandardMaterial({ color: 0x55585c, roughness: 0.8 }), roofs, false);
    // street grid (asphalt planes)
    const roadMat = new THREE.MeshStandardMaterial({ color: 0x2b2c2e, roughness: 0.9 });
    const roadG = new THREE.PlaneGeometry(10, cityR * 2).rotateX(-Math.PI / 2);
    for (let x = -cityR; x <= cityR; x += block * 3) {
      if (Math.abs(x) < 240) continue;
      const r = new THREE.Mesh(roadG, roadMat);
      r.position.set(x + block / 2, heightAt(x, 0) + 0.3, 0);
      r.receiveShadow = true;
      group.add(r);
    }
    if (night) {
      // street lights glow
      const lights: { p: [number, number, number]; s: THREE.Vector3; ry: number }[] = [];
      for (let i = 0; i < 600; i++) { const x = (rnd() - 0.5) * cityR * 2, z = (rnd() - 0.5) * cityR * 2; lights.push({ p: [x, heightAt(x, z) + 8, z], s: new THREE.Vector3(1.4, 1.4, 1.4), ry: 0 }); }
      inst(new THREE.SphereGeometry(1, 6, 4), new THREE.MeshBasicMaterial({ color: 0xffc070 }), lights, false);
    }
  }

  // ---- clouds ----
  const clouds = new THREE.Group();
  const ctex = cloudTex();
  const nClouds = Math.floor((m.small ? 26 : 70) * m.clouds * (q === "1K" ? 0.5 : 1));
  const tint = m.night ? 0x3a4060 : m.id === 6 ? 0xffd0b0 : m.id === 3 ? 0x8a7060 : 0xffffff;
  const cmat = new THREE.SpriteMaterial({ map: ctex, color: tint, transparent: true, depthWrite: false, opacity: 0.95, fog: true });
  for (let i = 0; i < nClouds; i++) {
    const cx = (rnd() - 0.5) * m.size * 1.4, cz = (rnd() - 0.5) * m.size * 1.4;
    const cy = Math.max(m.sea, 0) + 650 + rnd() * 600 + (m.props === "trees" ? 300 : 0);
    const puffs = 5 + Math.floor(rnd() * 6);
    const big = 140 + rnd() * 160;
    for (let k = 0; k < puffs; k++) {
      const s = new THREE.Sprite(cmat);
      s.position.set(cx + (rnd() - 0.5) * big * 1.6, cy + (rnd() - 0.3) * big * 0.35, cz + (rnd() - 0.5) * big);
      const sc = big * (0.6 + rnd() * 0.6);
      s.scale.set(sc, sc * 0.65, 1);
      clouds.add(s);
    }
  }
  group.add(clouds);

  // ---- AIR BASE ----
  const baseH = heightAt(0, 0);
  const concrete = concreteTex().clone();
  concrete.needsUpdate = true;
  concrete.repeat.set(4, 30);
  const apronMat = new THREE.MeshStandardMaterial({ map: concrete, roughness: 0.85 });
  const runway = new THREE.Mesh(new THREE.PlaneGeometry(45, 800).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: runwayTex(), roughness: 0.75 }));
  runway.position.set(0, baseH + 0.35, 0);
  runway.receiveShadow = true;
  group.add(runway);
  const shoulder = new THREE.Mesh(new THREE.PlaneGeometry(70, 860).rotateX(-Math.PI / 2), apronMat);
  shoulder.position.set(0, baseH + 0.2, 0);
  shoulder.receiveShadow = true;
  group.add(shoulder);
  // taxiway + apron
  const taxi = new THREE.Mesh(new THREE.PlaneGeometry(18, 760).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x45464a, roughness: 0.85 }));
  taxi.position.set(62, baseH + 0.3, 0);
  taxi.receiveShadow = true;
  group.add(taxi);
  const ycl = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 760).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xd8b020 }));
  ycl.position.set(62, baseH + 0.36, 0);
  group.add(ycl);
  const c2 = concreteTex().clone();
  c2.needsUpdate = true;
  c2.repeat.set(3, 9);
  const apron = new THREE.Mesh(new THREE.PlaneGeometry(90, 420).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ map: c2, roughness: 0.85 }));
  apron.position.set(120, baseH + 0.25, -20);
  apron.receiveShadow = true;
  group.add(apron);

  // runway edge & approach lights
  const edgeL = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xfff2c0, emissiveIntensity: m.night ? 3 : 1.2 });
  const thrL = new THREE.MeshStandardMaterial({ color: 0x40ff60, emissive: 0x30ff50, emissiveIntensity: 2.5 });
  const endL = new THREE.MeshStandardMaterial({ color: 0xff3030, emissive: 0xff2020, emissiveIntensity: 2.5 });
  const lg = new THREE.SphereGeometry(0.35, 6, 4);
  const edgeList: { p: [number, number, number]; s: THREE.Vector3; ry: number }[] = [];
  for (let z = -400; z <= 400; z += 30) for (const x of [-23.5, 23.5]) edgeList.push({ p: [x, baseH + 0.7, z], s: new THREE.Vector3(1, 1, 1), ry: 0 });
  for (let z = -600; z < -410; z += 15) for (let x = -8; x <= 8; x += 4) edgeList.push({ p: [x, baseH + 1.2, z], s: new THREE.Vector3(1.2, 1.2, 1.2), ry: 0 });
  inst(lg, edgeL, edgeList, false);
  const tl: typeof edgeList = [], el: typeof edgeList = [];
  for (let x = -21; x <= 21; x += 3) { tl.push({ p: [x, baseH + 0.6, -401], s: new THREE.Vector3(1, 1, 1), ry: 0 }); el.push({ p: [x, baseH + 0.6, 401], s: new THREE.Vector3(1, 1, 1), ry: 0 }); }
  inst(lg, thrL, tl, false);
  inst(lg, endL, el, false);

  // hangars (quonset with end walls & doors)
  const baseTargets: THREE.Vector3[] = [];
  const steel = new THREE.MeshStandardMaterial({ color: 0x7c847a, roughness: 0.55, metalness: 0.6, map: concreteTex() });
  const doorMat = new THREE.MeshStandardMaterial({ color: 0x5a6058, roughness: 0.6, metalness: 0.5 });
  const darkIn = new THREE.MeshStandardMaterial({ color: 0x111214, roughness: 1 });
  for (let i = 0; i < 4; i++) {
    const hg = new THREE.Group();
    const shell = new THREE.Mesh(new THREE.CylinderGeometry(15, 15, 40, 28, 1, true, -Math.PI / 2, Math.PI), steel);
    shell.rotation.z = Math.PI / 2;
    shell.material.side = THREE.DoubleSide;
    hg.add(shell);
    // ribs
    for (let r = -18; r <= 18; r += 6) {
      const rib = new THREE.Mesh(new THREE.TorusGeometry(15.15, 0.25, 4, 24, Math.PI), doorMat);
      rib.rotation.y = Math.PI / 2;
      rib.position.x = r;
      hg.add(rib);
    }
    const back = new THREE.Mesh(new THREE.CircleGeometry(15, 24, 0, Math.PI), steel);
    back.rotation.y = Math.PI / 2;
    back.position.x = 20;
    hg.add(back);
    const opening = new THREE.Mesh(new THREE.CircleGeometry(14.8, 24, 0, Math.PI), darkIn);
    opening.rotation.y = -Math.PI / 2;
    opening.position.x = -19.9;
    hg.add(opening);
    [-1, 1].forEach((sd) => {
      const door = new THREE.Mesh(new THREE.BoxGeometry(0.5, 13, 9), doorMat);
      door.position.set(-20.2, 6.5, sd * 9.5);
      hg.add(door);
    });
    hg.position.set(150, baseH, -170 + i * 75);
    hg.traverse((o) => { o.castShadow = true; o.receiveShadow = true; });
    group.add(hg);
    baseTargets.push(hg.position.clone().add(new THREE.Vector3(0, 7, 0)));
  }

  // parked aircraft on apron
  const parked = [PLANES[20 % PLANES.length], PLANES[45 % PLANES.length], PLANES[60 % PLANES.length]];
  parked.forEach((sp, i) => {
    const pm = buildPlaneMesh(sp);
    pm.position.set(105, baseH + 2.2, -150 + i * 60);
    pm.rotation.y = -Math.PI / 2;
    group.add(pm);
  });

  // control tower
  const tower = new THREE.Group();
  const towerMat = new THREE.MeshStandardMaterial({ color: 0xd6d3cc, roughness: 0.7, map: concreteTex() });
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(4, 5.5, 42, 16), towerMat);
  shaft.position.y = 21;
  tower.add(shaft);
  const deck = new THREE.Mesh(new THREE.CylinderGeometry(9.5, 7, 2, 16), towerMat);
  deck.position.y = 43;
  tower.add(deck);
  const cab = new THREE.Mesh(new THREE.CylinderGeometry(9, 8, 6, 8, 1, true), new THREE.MeshPhysicalMaterial({ color: 0x223344, metalness: 0.3, roughness: 0.03, clearcoat: 1, envMapIntensity: 2, transparent: true, opacity: 0.75, side: THREE.DoubleSide, emissive: m.night ? 0x335577 : 0x000000 }));
  cab.position.y = 47;
  tower.add(cab);
  const roof = new THREE.Mesh(new THREE.CylinderGeometry(10, 9.5, 1.2, 16), new THREE.MeshStandardMaterial({ color: 0x3a3c40, metalness: 0.6, roughness: 0.4 }));
  roof.position.y = 50.6;
  tower.add(roof);
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.2, 10, 4), new THREE.MeshStandardMaterial({ color: 0xdddddd, metalness: 0.8 }));
  mast.position.y = 56;
  tower.add(mast);
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 6), endL);
  beacon.position.y = 61;
  tower.add(beacon);
  // ops building
  const ops = new THREE.Mesh(new THREE.BoxGeometry(40, 10, 22), new THREE.MeshStandardMaterial({ map: facadeTex(4, !!m.night).map, emissiveMap: facadeTex(4, !!m.night).emissive, emissive: 0xffffff, emissiveIntensity: m.night ? 1 : 0.05, roughness: 0.7 }));
  ops.position.set(15, 5, 0);
  tower.add(ops);
  tower.position.set(-90, baseH, 80);
  tower.traverse((o) => { o.castShadow = true; o.receiveShadow = true; });
  group.add(tower);
  baseTargets.push(new THREE.Vector3(-90, baseH + 30, 80));

  // radar
  const radarBase = new THREE.Group();
  const rTruss = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 2.5, 14, 6), new THREE.MeshStandardMaterial({ color: 0x9a9a9a, metalness: 0.8, roughness: 0.4, wireframe: false }));
  rTruss.position.y = 7;
  radarBase.add(rTruss);
  const radar = new THREE.Group();
  const dish = new THREE.Mesh(new THREE.SphereGeometry(7, 20, 10, 0, Math.PI * 2, 0, Math.PI / 4), new THREE.MeshStandardMaterial({ color: 0xeeeeee, metalness: 0.4, roughness: 0.35, side: THREE.DoubleSide }));
  dish.rotation.x = Math.PI / 2 + 0.3;
  dish.scale.set(1.6, 1, 0.6);
  radar.add(dish);
  radar.position.y = 15;
  radarBase.add(radar);
  radarBase.position.set(-60, baseH, -140);
  radarBase.traverse((o) => { o.castShadow = true; });
  group.add(radarBase);

  // fuel tanks
  const tankMat = new THREE.MeshStandardMaterial({ color: 0xe8e8e0, metalness: 0.5, roughness: 0.35 });
  for (let i = 0; i < 3; i++) {
    const t = new THREE.Mesh(new THREE.CylinderGeometry(8, 8, 12, 24), tankMat);
    t.position.set(-80 + i * 20, baseH + 6, -230);
    t.castShadow = true;
    t.receiveShadow = true;
    group.add(t);
    const top = new THREE.Mesh(new THREE.SphereGeometry(8, 24, 6, 0, Math.PI * 2, 0, Math.PI / 6), tankMat);
    top.position.set(t.position.x, baseH + 5, t.position.z);
    group.add(top);
  }
  // windsock
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 10, 6), new THREE.MeshStandardMaterial({ color: 0xcccccc }));
  pole.position.set(-35, baseH + 5, -300);
  group.add(pole);
  const sock = new THREE.Mesh(new THREE.ConeGeometry(0.8, 4.5, 10, 1, true), new THREE.MeshStandardMaterial({ color: 0xff5a1a, side: THREE.DoubleSide }));
  sock.rotation.z = Math.PI / 2 - 0.2;
  sock.position.set(-37.5, baseH + 9.4, -300);
  group.add(sock);

  return { group, heightAt, baseTargets, baseCenter: new THREE.Vector3(0, baseH, 0), groundLevel: baseH, water, radar, clouds };
}
