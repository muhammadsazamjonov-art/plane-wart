import * as THREE from "three";
import { panelTex, roundelTex } from "./textures";

export type PlaneType = "prop" | "swept" | "delta" | "canard" | "stealth" | "bomber" | "flying";

export type PlaneSpec = {
  id: number;
  name: string;
  country: string;
  type: PlaneType;
  twinTail: boolean;
  twinEngine: boolean;
  speed: number; // max m/s
  turn: number; // turn multiplier
  hp: number;
  gun: number; // dmg per bullet
  missiles: number;
  price: number;
  color: number;
  accent: number;
  len: number;
  span: number;
};

// [name, country, type, twinTail, twinEngine, tier(0-10)]
const BASE: [string, string, PlaneType, boolean, boolean, number][] = [
  ["Yak-3", "USSR", "prop", false, false, 0],
  ["Spitfire Mk IX", "UK", "prop", false, false, 0],
  ["P-51 Mustang", "USA", "prop", false, false, 0.5],
  ["Bf 109", "Germany", "prop", false, false, 0.5],
  ["A6M Zero", "Japan", "prop", false, false, 0.4],
  ["P-47 Thunderbolt", "USA", "prop", false, false, 0.8],
  ["F4U Corsair", "USA", "prop", false, false, 0.9],
  ["La-7", "USSR", "prop", false, false, 0.8],
  ["Hawker Hurricane", "UK", "prop", false, false, 0.3],
  ["P-38 Lightning", "USA", "prop", true, true, 1],
  ["Fw 190", "Germany", "prop", false, false, 1],
  ["Il-2 Sturmovik", "USSR", "prop", false, false, 0.7],
  ["F6F Hellcat", "USA", "prop", false, false, 0.9],
  ["Hawker Tempest", "UK", "prop", false, false, 1.1],
  ["Yak-9", "USSR", "prop", false, false, 0.6],
  ["MiG-15", "USSR", "swept", false, false, 1.5],
  ["F-86 Sabre", "USA", "swept", false, false, 1.6],
  ["MiG-17", "USSR", "swept", false, false, 1.8],
  ["Hawker Hunter", "UK", "swept", false, false, 2],
  ["MiG-21", "USSR", "delta", false, false, 2.6],
  ["F-104 Starfighter", "USA", "swept", false, false, 2.8],
  ["A-4 Skyhawk", "USA", "delta", false, false, 2.2],
  ["Mirage III", "France", "delta", false, false, 2.8],
  ["F-5 Tiger II", "USA", "swept", false, true, 3],
  ["Su-7", "USSR", "swept", false, false, 2.5],
  ["F-4 Phantom II", "USA", "swept", false, true, 3.6],
  ["MiG-23", "USSR", "swept", false, false, 3.4],
  ["Kfir", "Israel", "canard", false, false, 3.6],
  ["A-10 Warthog", "USA", "prop", true, true, 3.5],
  ["Harrier", "UK", "swept", false, false, 3.6],
  ["Tornado", "Europe", "swept", false, true, 4.2],
  ["F-14 Tomcat", "USA", "swept", true, true, 5],
  ["F-15 Eagle", "USA", "swept", true, true, 5.5],
  ["F-16 Falcon", "USA", "swept", false, false, 5.2],
  ["F/A-18 Hornet", "USA", "swept", true, true, 5.3],
  ["MiG-29 Fulcrum", "Russia", "swept", true, true, 5.3],
  ["Su-27 Flanker", "Russia", "swept", true, true, 5.7],
  ["Mirage 2000", "France", "delta", false, false, 5.2],
  ["JF-17 Thunder", "Pakistan", "swept", false, false, 4.8],
  ["Tejas", "India", "delta", false, false, 4.9],
  ["Mitsubishi F-2", "Japan", "swept", false, false, 5.4],
  ["J-10 Vigorous Dragon", "China", "canard", false, false, 5.8],
  ["JAS 39 Gripen", "Sweden", "canard", false, false, 6],
  ["Su-30", "Russia", "swept", true, true, 6.2],
  ["Su-33", "Russia", "canard", true, true, 6.2],
  ["Su-34 Fullback", "Russia", "swept", true, true, 6],
  ["Dassault Rafale", "France", "canard", false, true, 6.8],
  ["Eurofighter Typhoon", "Europe", "canard", false, true, 7],
  ["Su-35 Flanker-E", "Russia", "swept", true, true, 7.2],
  ["MiG-25 Foxbat", "USSR", "swept", true, true, 6.5],
  ["MiG-31 Foxhound", "Russia", "swept", true, true, 7],
  ["SR-71 Blackbird", "USA", "delta", true, true, 7.5],
  ["F-117 Nighthawk", "USA", "stealth", true, true, 6.6],
  ["YF-23 Black Widow", "USA", "stealth", true, true, 8],
  ["F-35 Lightning II", "USA", "stealth", true, false, 8.2],
  ["J-35", "China", "stealth", true, true, 8.3],
  ["KAAN", "Turkey", "stealth", true, true, 8.5],
  ["J-20 Mighty Dragon", "China", "stealth", true, true, 8.8],
  ["Su-57 Felon", "Russia", "stealth", true, true, 9],
  ["F-22 Raptor", "USA", "stealth", true, true, 9.4],
  ["GCAP Tempest", "UK/Japan", "stealth", true, true, 9.7],
  ["B-2 Spirit", "USA", "flying", false, true, 8.6],
  ["B-52 Stratofortress", "USA", "bomber", false, true, 5.6],
  ["Tu-95 Bear", "Russia", "bomber", false, true, 5.4],
  ["Tu-22M Backfire", "Russia", "bomber", false, true, 6.6],
  ["B-1 Lancer", "USA", "bomber", false, true, 7.4],
  ["Tu-160 White Swan", "Russia", "bomber", false, true, 7.9],
  ["F-21 NGAD", "USA", "flying", false, true, 10],
];

const LIVERIES = [0x8a96a3, 0x5b6b4b, 0x3c4a5c, 0xc2b280, 0x2b2f36, 0x9fb6c9, 0xb04a3a, 0x445566, 0x6e7f5e, 0xd8d8d8];
const ACCENTS = [0xffcc00, 0xff4444, 0x33ccff, 0xffffff, 0x66ff66, 0xff8800, 0xcc66ff];
const VARIANTS = ["Block 60", "Mk II", "Ace Edition", "Night Hawk", "Desert Viper"];

function makeSpec(id: number, b: (typeof BASE)[number], vIdx: number): PlaneSpec {
  const [name, country, type, twinTail, twinEngine, tier0] = b;
  const tier = Math.min(11, tier0 + (vIdx >= 0 ? 0.8 + vIdx * 0.2 : 0));
  const big = type === "bomber" || type === "flying";
  return {
    id,
    name: vIdx >= 0 ? `${name} ${VARIANTS[vIdx]}` : name,
    country,
    type,
    twinTail,
    twinEngine,
    speed: Math.round((type === "prop" ? 120 : 150) + tier * 14),
    turn: +((big ? 0.65 : type === "prop" ? 1.15 : 1) * (0.85 + tier * 0.04)).toFixed(2),
    hp: Math.round((big ? 260 : 100) + tier * 12),
    gun: Math.round(6 + tier * 0.8),
    missiles: big ? 10 + Math.round(tier) : type === "prop" ? 2 : 4 + Math.round(tier / 2),
    price: id < 3 ? 0 : Math.round((tier * tier * 120 + 300) / 50) * 50,
    color: LIVERIES[(id * 7 + (vIdx + 1) * 3) % LIVERIES.length],
    accent: ACCENTS[(id * 3 + vIdx + 1) % ACCENTS.length],
    len: big ? 26 : type === "prop" ? 9 : 15,
    span: big ? 34 : type === "prop" ? 11 : 11,
  };
}

function buildCatalog(): PlaneSpec[] {
  const list: PlaneSpec[] = [];
  BASE.forEach((b) => list.push(makeSpec(list.length, b, -1)));
  // variants of jets to exceed 100 aircraft
  const jets = BASE.filter((b) => b[2] !== "prop" || b[5] > 0.8);
  let v = 0;
  while (list.length < 124) {
    const b = jets[v % jets.length];
    list.push(makeSpec(list.length, b, Math.floor(v / jets.length) % VARIANTS.length));
    v++;
  }
  return list.sort((a, b) => a.price - b.price).map((p, i) => ({ ...p, id: i, price: i < 3 ? 0 : p.price }));
}

export const PLANES: PlaneSpec[] = buildCatalog();

const matCache = new Map<string, THREE.Material>();
function skin(color: number, prop: boolean) {
  const k = `skin-${color}-${prop}`;
  let m = matCache.get(k);
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      color,
      map: panelTex(),
      metalness: prop ? 0.15 : 0.45,
      roughness: prop ? 0.7 : 0.42,
      envMapIntensity: prop ? 0.6 : 1.1,
    });
    matCache.set(k, m);
  }
  return m;
}
function solid(key: string, make: () => THREE.Material) {
  let m = matCache.get(key);
  if (!m) { m = make(); matCache.set(key, m); }
  return m;
}
const darkMetal = () => solid("dark", () => new THREE.MeshStandardMaterial({ color: 0x2a2c30, metalness: 0.85, roughness: 0.35 }));
const nozzleMat = () => solid("nozzle", () => new THREE.MeshStandardMaterial({ color: 0x55504a, metalness: 1, roughness: 0.28 }));
const glassMat = () => solid("glass", () => new THREE.MeshPhysicalMaterial({ color: 0x1a2a38, metalness: 0.2, roughness: 0.02, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 2.2, transparent: true, opacity: 0.82 }));
const goldGlass = () => solid("goldglass", () => new THREE.MeshPhysicalMaterial({ color: 0xb08a3a, metalness: 0.9, roughness: 0.05, clearcoat: 1, envMapIntensity: 2.4 }));
const tireMat = () => solid("tire", () => new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.9 }));
const strutMat = () => solid("strut", () => new THREE.MeshStandardMaterial({ color: 0xc8c8c8, metalness: 0.9, roughness: 0.25 }));
const missileMat = () => solid("missile", () => new THREE.MeshStandardMaterial({ color: 0xe8e8e8, metalness: 0.3, roughness: 0.4 }));
const redMat = () => solid("red", () => new THREE.MeshStandardMaterial({ color: 0xff2020, emissive: 0xff0000, emissiveIntensity: 2 }));
const greenMat = () => solid("green", () => new THREE.MeshStandardMaterial({ color: 0x20ff40, emissive: 0x00ff30, emissiveIntensity: 2 }));
const pilotMat = () => solid("pilot", () => new THREE.MeshStandardMaterial({ color: 0x2b3020, roughness: 0.8 }));
const visorMat = () => solid("visor", () => new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.9, roughness: 0.1 }));

function scaleUV(g: THREE.BufferGeometry, sx: number, sy: number) {
  const uv = g.attributes.uv as THREE.BufferAttribute;
  if (!uv) return g;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * sx, uv.getY(i) * sy);
  uv.needsUpdate = true;
  return g;
}

/** Smooth fuselage from a radius profile along Z (forward = +Z). */
function fuselageGeo(L: number, R: number, noseFrac: number, tailR: number, flatBottom = 1) {
  const pts: THREE.Vector2[] = [];
  const N = 28;
  for (let i = 0; i <= N; i++) {
    const t = i / N; // 0 = tail, 1 = nose tip
    let r: number;
    const noseStart = 1 - noseFrac;
    if (t > noseStart) {
      const k = (t - noseStart) / noseFrac;
      r = R * Math.sqrt(Math.max(0, 1 - k * k)) * (1 - k * 0.15);
    } else if (t < 0.3) {
      const k = t / 0.3;
      r = tailR + (R - tailR) * Math.sin((k * Math.PI) / 2);
    } else r = R;
    pts.push(new THREE.Vector2(Math.max(0.001, r), (t - 0.5) * L));
  }
  const g = new THREE.LatheGeometry(pts, 20);
  g.rotateX(Math.PI / 2);
  if (flatBottom !== 1) g.scale(1, flatBottom, 1);
  return scaleUV(g, 3, 4);
}

/** Wing panel with thickness and rounded leading edge (bevel). Root at x=0, extends to +X. */
function wingGeo(root: number, tip: number, span: number, sweep: number, thick: number) {
  const s = new THREE.Shape();
  s.moveTo(0, root / 2);
  s.lineTo(span, root / 2 - sweep);
  s.lineTo(span, root / 2 - sweep - tip);
  s.lineTo(0, -root / 2);
  s.closePath();
  const bev = Math.min(thick * 0.45, 0.25);
  const g = new THREE.ExtrudeGeometry(s, { depth: Math.max(0.02, thick - bev * 2), bevelEnabled: true, bevelThickness: bev, bevelSize: bev * 0.9, bevelSegments: 3, curveSegments: 1 });
  g.rotateX(Math.PI / 2);
  g.translate(0, thick / 2 - bev, 0);
  g.computeVertexNormals();
  return scaleUV(g, 0.08, 0.08);
}

function vertTailGeo(L: number, h: number, thick: number) {
  const vt = new THREE.Shape();
  vt.moveTo(0, 0);
  vt.lineTo(L * 0.24, 0);
  vt.lineTo(L * 0.13 + h * 0.25, h);
  vt.lineTo(h * 0.55, h);
  vt.closePath();
  const bev = thick * 0.4;
  const g = new THREE.ExtrudeGeometry(vt, { depth: thick - bev * 2, bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelSegments: 2 });
  g.translate(0, 0, -thick / 2 + bev);
  g.rotateY(-Math.PI / 2);
  return scaleUV(g, 0.08, 0.08);
}

function missileMesh(len: number) {
  const g = new THREE.Group();
  const b = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, len, 8), missileMat());
  b.rotation.x = Math.PI / 2;
  const n = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.5, 8), darkMetal());
  n.rotation.x = Math.PI / 2;
  n.position.z = len / 2 + 0.25;
  g.add(b, n);
  for (let i = 0; i < 4; i++) {
    const f = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.35, 0.4), missileMat());
    f.position.z = -len / 2 + 0.2;
    f.rotation.z = (i * Math.PI) / 2;
    f.position.x = Math.sin((i * Math.PI) / 2) * 0.15;
    f.position.y = Math.cos((i * Math.PI) / 2) * 0.15;
    g.add(f);
  }
  return g;
}

function decal(tex: THREE.Texture, size: number) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.6, metalness: 0.2, polygonOffset: true, polygonOffsetFactor: -4, depthWrite: false }));
  return m;
}

/** Builds a plane mesh. Forward = +Z, up = +Y, left = +X. */
export function buildPlaneMesh(spec: PlaneSpec, colorOverride?: number): THREE.Group {
  const g = new THREE.Group();
  const isProp = spec.type === "prop";
  const big = spec.type === "bomber" || spec.type === "flying";
  const body = skin(colorOverride ?? spec.color, isProp);
  const L = spec.len;
  const S = spec.span;
  const R = spec.type === "bomber" ? 1.6 : isProp ? 0.7 : 0.85;
  const half = S / 2;

  if (spec.type !== "flying") {
    const fus = new THREE.Mesh(fuselageGeo(L, R, isProp ? 0.12 : spec.type === "bomber" ? 0.12 : 0.3, isProp ? 0.18 : R * 0.7, spec.type === "stealth" ? 0.7 : 1), body);
    g.add(fus);
    if (spec.type === "stealth") {
      // chined edges for stealth fuselage
      const chine = new THREE.Mesh(wingGeo(L * 0.7, 0.2, R * 1.6, L * 0.5, 0.15), body);
      chine.position.set(0, 0, L * 0.12);
      g.add(chine);
      const c2 = chine.clone(); c2.scale.x = -1; g.add(c2);
    }
    // canopy
    const canR = isProp ? R * 0.62 : R * 0.68;
    const can = new THREE.Mesh(new THREE.SphereGeometry(canR, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), spec.type === "stealth" ? goldGlass() : glassMat());
    can.scale.set(0.85, 1.05, isProp ? 2.1 : spec.type === "bomber" ? 1.2 : 3.0);
    can.position.set(0, R * 0.62, isProp ? -L * 0.02 : spec.type === "bomber" ? L * 0.38 : L * 0.22);
    g.add(can);
    // pilot (visible through glass)
    if (!big) {
      const helm = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), pilotMat());
      helm.position.set(0, R * 0.72, can.position.z - 0.2);
      const visor = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 6, 0, Math.PI * 2, Math.PI * 0.3, Math.PI * 0.35), visorMat());
      visor.position.copy(helm.position).add(new THREE.Vector3(0, 0, 0.08));
      g.add(helm, visor);
    }
    // canopy frame
    const frame = new THREE.Mesh(new THREE.TorusGeometry(canR * 0.86, 0.04, 6, 16, Math.PI), darkMetal());
    frame.position.set(0, R * 0.62, can.position.z - canR * (isProp ? 0.6 : 1.1));
    g.add(frame);
    // pitot
    if (!isProp) {
      const pit = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.4, 4), strutMat());
      pit.rotation.x = Math.PI / 2;
      pit.position.z = L / 2 + 0.6;
      g.add(pit);
    }
    // jet intakes
    if (!isProp && spec.type !== "bomber") {
      [1, -1].forEach((sd) => {
        const intake = new THREE.Mesh(new THREE.BoxGeometry(0.6, R * 1.1, L * 0.32), body);
        intake.position.set(sd * R * 0.95, -R * 0.15, L * 0.02);
        g.add(intake);
        const lip = new THREE.Mesh(new THREE.BoxGeometry(0.5, R * 0.95, 0.05), darkMetal());
        lip.position.set(sd * R * 0.95, -R * 0.15, L * 0.18 + 0.01);
        g.add(lip);
      });
    }
  }

  let wing: THREE.BufferGeometry;
  const wt = isProp ? 0.35 : big ? 0.6 : 0.3;
  switch (spec.type) {
    case "prop": wing = wingGeo(2.6, 1.2, half, 0.35, wt); break;
    case "delta": wing = wingGeo(L * 0.55, 0.5, half * 0.9, L * 0.5, wt); break;
    case "canard": wing = wingGeo(L * 0.45, 0.8, half, L * 0.38, wt); break;
    case "stealth": wing = wingGeo(L * 0.42, 1.4, half, L * 0.3, wt); break;
    case "bomber": wing = wingGeo(5.5, 1.8, half, 7, wt); break;
    case "flying": wing = wingGeo(L * 0.9, 1.5, half, L * 0.55, 1.3); break;
    default: wing = wingGeo(L * 0.3, 1.1, half, L * 0.22, wt);
  }
  const zOff = spec.type === "delta" || spec.type === "flying" ? 0 : isProp ? 0.8 : -L * 0.05;
  const wl = new THREE.Mesh(wing, body);
  wl.position.set(0, isProp ? -R * 0.4 : -R * 0.1, zOff + (spec.type === "flying" ? L * 0.3 : 0));
  if (isProp) wl.rotation.z = 0.06; // dihedral
  g.add(wl);
  const wr = wl.clone();
  wr.scale.x = -1;
  wr.rotation.z = -wl.rotation.z;
  g.add(wr);

  // roundels on wings
  const rTex = roundelTex(spec.country);
  [1, -1].forEach((sd) => {
    const d = decal(rTex, big ? 4 : isProp ? 1.6 : 1.4);
    d.rotation.x = -Math.PI / 2;
    d.position.set(sd * half * 0.7, wl.position.y + wt / 2 + 0.03 + (isProp ? half * 0.7 * 0.06 : 0), zOff - (isProp ? 0.2 : spec.type === "delta" ? L * 0.15 : L * 0.12));
    g.add(d);
  });

  // nav lights
  const nl = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 4), redMat());
  const tipZ = zOff - (isProp ? 0.2 : spec.type === "delta" ? L * 0.25 : L * 0.17);
  nl.position.set(half, wl.position.y + (isProp ? half * 0.06 : 0), tipZ);
  const nr = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 4), greenMat());
  nr.position.set(-half, nl.position.y, tipZ);
  g.add(nl, nr);

  if (spec.type === "flying") {
    const hump = new THREE.Mesh(new THREE.SphereGeometry(2.4, 24, 12), body);
    hump.scale.set(1.6, 0.55, 3.2);
    hump.position.z = L * 0.15;
    g.add(hump);
    const win = new THREE.Mesh(new THREE.SphereGeometry(0.9, 12, 6, 0, Math.PI * 2, 0, Math.PI / 2), glassMat());
    win.scale.set(1.4, 0.4, 0.8);
    win.position.set(0, 1.1, L * 0.3);
    g.add(win);
  }

  // horizontal tail
  if (spec.type !== "delta" && spec.type !== "flying") {
    const ht = wingGeo(L * 0.16, 0.8, half * 0.42, L * 0.08, 0.18);
    const h1 = new THREE.Mesh(ht, body);
    h1.position.set(0, isProp ? 0.1 : 0, -L * 0.4);
    g.add(h1);
    const h2 = h1.clone(); h2.scale.x = -1; g.add(h2);
  }
  if (spec.type === "canard") {
    const c = wingGeo(L * 0.1, 0.4, half * 0.3, L * 0.05, 0.12);
    const c1 = new THREE.Mesh(c, body);
    c1.position.set(0, R * 0.3, L * 0.28);
    g.add(c1);
    const c2 = c1.clone(); c2.scale.x = -1; g.add(c2);
  }
  // vertical tail
  if (spec.type !== "flying") {
    const h = spec.type === "bomber" ? 6.5 : isProp ? 2.2 : 3.4;
    const vg = vertTailGeo(L, h, isProp ? 0.25 : 0.22);
    const tails = spec.twinTail ? [1.5, -1.5] : [0];
    tails.forEach((x) => {
      const m = new THREE.Mesh(vg, body);
      m.position.set(x, R * 0.45, -L * 0.5);
      if (spec.twinTail) m.rotation.z = x > 0 ? -0.22 : 0.22;
      g.add(m);
      // tail flash in accent color
      const flash = new THREE.Mesh(new THREE.BoxGeometry(0.26, h * 0.18, L * 0.12), solid("acc" + spec.accent, () => new THREE.MeshStandardMaterial({ color: spec.accent, roughness: 0.5, metalness: 0.2 })));
      flash.position.set(x, R * 0.45 + h * 0.8, -L * 0.5 + h * 0.62);
      if (spec.twinTail) flash.rotation.z = m.rotation.z;
      g.add(flash);
    });
  }

  // weapons on pylons
  if (!isProp && !big) {
    [0.45, 0.75].forEach((f) => {
      [1, -1].forEach((sd) => {
        const ms = missileMesh(2.6);
        ms.position.set(sd * half * f, wl.position.y - 0.35, zOff - L * 0.05);
        g.add(ms);
      });
    });
  }

  // engines / glow
  const glowMat = new THREE.MeshBasicMaterial({ color: 0xff9a40, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
  const coreMat = new THREE.MeshBasicMaterial({ color: 0xbfe0ff, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
  const engines: number[] = spec.type === "bomber" ? [4, 8, -4, -8] : spec.twinEngine ? [0.75, -0.75] : [0];
  const glows: THREE.Mesh[] = [];
  if (isProp) {
    const hub = new THREE.Group();
    const spinner = new THREE.Mesh(new THREE.ConeGeometry(0.32, 0.9, 16), solid("spin" + spec.accent, () => new THREE.MeshStandardMaterial({ color: spec.accent, metalness: 0.4, roughness: 0.4 })));
    spinner.rotation.x = Math.PI / 2;
    spinner.position.z = 0.35;
    hub.add(spinner);
    const bladeGeo = new THREE.BoxGeometry(0.22, 1.7, 0.05).translate(0, 0.85, 0);
    for (let i = 0; i < 3; i++) {
      const b = new THREE.Mesh(bladeGeo, darkMetal());
      b.rotation.z = (i * Math.PI * 2) / 3;
      b.rotation.y = 0.25;
      hub.add(b);
    }
    const disc = new THREE.Mesh(new THREE.CircleGeometry(1.75, 32), new THREE.MeshBasicMaterial({ color: 0x222222, transparent: true, opacity: 0.18, depthWrite: false, side: THREE.DoubleSide }));
    disc.name = "propdisc";
    hub.add(disc);
    hub.position.z = L * 0.5 + 0.05;
    hub.name = "prop";
    g.add(hub);
    // exhaust stacks
    [1, -1].forEach((sd) => {
      const ex = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.15, 1), darkMetal());
      ex.position.set(sd * R * 0.9, R * 0.2, L * 0.35);
      g.add(ex);
    });
  } else {
    engines.forEach((x) => {
      const z = spec.type === "bomber" ? 1 : -L * 0.5;
      const y = spec.type === "bomber" ? -0.9 : 0;
      if (spec.type === "bomber") {
        const pod = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.7, 4, 14), body);
        pod.rotation.x = Math.PI / 2;
        pod.position.set(x, y, z + 2);
        g.add(pod);
      }
      const n = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.62, 1.4, 16, 1, true), nozzleMat());
      n.rotation.x = Math.PI / 2;
      n.position.set(x, y, z);
      g.add(n);
      const inner = new THREE.Mesh(new THREE.CircleGeometry(0.48, 16), solid("innerburn", () => new THREE.MeshBasicMaterial({ color: 0xff7a30 })));
      inner.rotation.y = Math.PI;
      inner.position.set(x, y, z + 0.3);
      g.add(inner);
      const gl = new THREE.Mesh(new THREE.ConeGeometry(0.42, 3.2, 12, 1, true), glowMat);
      gl.rotation.x = -Math.PI / 2;
      gl.position.set(x, y, z - 2.2);
      glows.push(gl);
      g.add(gl);
      const core = new THREE.Mesh(new THREE.ConeGeometry(0.22, 1.6, 10, 1, true), coreMat);
      core.rotation.x = -Math.PI / 2;
      core.position.set(0, -0.8, 0);
      gl.add(core);
    });
  }
  g.userData.glows = glows;

  // landing gear (shown only on ground)
  const gear = new THREE.Group();
  gear.name = "gear";
  const wheel = (x: number, z: number, r: number, h: number) => {
    const s = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, h, 6), strutMat());
    s.position.set(x, -R - h / 2 + 0.2, z);
    const t = new THREE.Mesh(new THREE.CylinderGeometry(r, r, r * 0.6, 14), tireMat());
    t.rotation.z = Math.PI / 2;
    t.position.set(x, -R - h + 0.2, z);
    gear.add(s, t);
  };
  const gh = isProp ? 1.2 : big ? 1.6 : 1.3;
  if (isProp) {
    wheel(1.6, L * 0.12, 0.35, gh);
    wheel(-1.6, L * 0.12, 0.35, gh);
    wheel(0, -L * 0.42, 0.15, 0.4);
  } else {
    wheel(0, L * 0.3, 0.28, gh);
    wheel(big ? 3 : 1.4, -L * 0.08, big ? 0.6 : 0.38, gh);
    wheel(big ? -3 : -1.4, -L * 0.08, big ? 0.6 : 0.38, gh);
  }
  g.add(gear);

  g.traverse((o) => {
    if ((o as THREE.Mesh).isMesh) {
      const m = (o as THREE.Mesh).material as THREE.Material;
      if (!(m as THREE.MeshBasicMaterial).blending || (m as THREE.MeshBasicMaterial).blending === THREE.NormalBlending) o.castShadow = true;
    }
  });
  const sc = big ? 0.8 : 1;
  g.scale.setScalar(sc);
  return g;
}
