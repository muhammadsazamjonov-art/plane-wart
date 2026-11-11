import * as THREE from "three";
import { PLANES, PlaneSpec, buildPlaneMesh } from "./planes";
import { MAPS, MapDef, World, buildWorld } from "./maps";
import { Sfx } from "./audio";
import { Sky } from "three/examples/jsm/objects/Sky.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import type { Settings } from "./store";

export type Mode = "survival" | "arena" | "defense" | "multi";
export type Kind = "plane" | "sub" | "sam" | "psub";

export type GameOptions = {
  mode: Mode;
  mapId: number;
  planeId: number;
  vehicle: "plane" | "sub";
  settings: Settings;
  name: string;
  room?: string;
  pid: string;
};

export type Hud = {
  speed: number; alt: number; throttle: number; hp: number; maxHp: number; missiles: number; flares: number;
  score: number; kills: number; coins: number; wave: number; time: number; baseHp: number; warning: boolean;
  lock: number; feed: string[]; fps: number; onGround: boolean; stall: boolean; oob: boolean; lives: number;
  board: { name: string; kills: number; me: boolean }[]; dead: boolean; respawnIn: number; players: number; hint: string; boost: boolean;
};

export type EndInfo = {
  type: "gameover" | "arena";
  score: number; kills: number; coins: number;
  ranking: { name: string; kills: number; plane: string; me: boolean }[];
  winner?: string; winnerPlane?: string; reason?: string;
};

interface MTarget { pos: THREE.Vector3; alive: boolean }

interface Unit extends MTarget {
  id: string; name: string; kind: Kind; spec: PlaneSpec; mesh: THREE.Object3D;
  q: THREE.Quaternion; speed: number; throttle: number; vel: THREE.Vector3;
  hp: number; maxHp: number; isPlayer: boolean; remote: boolean;
  team: number; kills: number; deaths: number;
  gunCd: number; missileCd: number; missiles: number; flares: number; flareCd: number;
  target: Unit | null; aimBase: MTarget | null; aiTimer: number; respawn: number; onGround: boolean;
  skill: number; surfaceT: number; boost: boolean; evade: number; evadeDir: THREE.Vector3;
  net?: { pos: THREE.Vector3; q: THREE.Quaternion }; lastDmg: number; smokeT: number;
}

interface Bullet { pos: THREE.Vector3; prev: THREE.Vector3; vel: THREE.Vector3; life: number; owner: Unit; dmg: number }
interface Missile {
  pos: THREE.Vector3; dir: THREE.Vector3; speed: number; target: MTarget | null; life: number; owner: Unit;
  mesh: THREE.Object3D; torpedo: boolean;
}
interface Flare extends MTarget { vel: THREE.Vector3; life: number }

const CALLSIGNS = ["Viper", "Ghost", "Maverick", "Iceman", "Falcon", "Raven", "Blaze", "Nomad", "Hunter", "Specter", "Cobra", "Phoenix", "Reaper", "Storm", "Titan", "Wolf", "Shadow", "Jester", "Rogue", "Bandit", "Hawk", "Talon", "Saber", "Omega", "Lynx", "Zeus", "Kestrel", "Dagger", "Nova", "Orion"];

function keyName(e: KeyboardEvent) {
  const c = e.code || "";
  if (c.startsWith("Key")) return c.slice(3).toLowerCase();
  if (c === "Space") return " ";
  if (c.startsWith("Shift")) return "shift";
  if (c.startsWith("Arrow")) return c.toLowerCase();
  if (c === "Escape") return "escape";
  if (c === "Enter" || c === "NumpadEnter") return "enter";
  return e.key.toLowerCase();
}
const WHITE = new THREE.Color(0.92, 0.92, 0.94), DARK = new THREE.Color(0.12, 0.12, 0.12), DUST = new THREE.Color(0.55, 0.5, 0.42);
const FIRE = new THREE.Color(1, 0.45, 0.1), BUBBLE = new THREE.Color(0.8, 0.9, 1), GOLD = new THREE.Color(1, 0.8, 0.2);
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const V = () => new THREE.Vector3();
const _v1 = V(), _v2 = V(), _v3 = V(), _v4 = V();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _m = new THREE.Matrix4();
const FWD = new THREE.Vector3(0, 0, 1);
const UP = new THREE.Vector3(0, 1, 0);

class Particles {
  max: number; geo: THREE.BufferGeometry; pts: THREE.Points;
  pos: Float32Array; col: Float32Array; vel: Float32Array; life: Float32Array; maxLife: Float32Array; base: Float32Array; drag: Float32Array;
  idx = 0; smoke: boolean; cs: number;
  constructor(max: number, size: number, tex: THREE.Texture, smoke = false) {
    this.smoke = smoke;
    this.cs = smoke ? 4 : 3;
    this.max = max;
    this.pos = new Float32Array(max * 3).fill(-99999);
    this.col = new Float32Array(max * this.cs);
    this.vel = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.maxLife = new Float32Array(max).fill(1);
    this.base = new Float32Array(max * 3);
    this.drag = new Float32Array(max);
    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute("position", new THREE.BufferAttribute(this.pos, 3));
    this.geo.setAttribute("color", new THREE.BufferAttribute(this.col, this.cs));
    const m = new THREE.PointsMaterial({ size, map: tex, vertexColors: true, transparent: true, blending: smoke ? THREE.NormalBlending : THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true });
    this.pts = new THREE.Points(this.geo, m);
    this.pts.frustumCulled = false;
  }
  spawn(p: THREE.Vector3, vx: number, vy: number, vz: number, life: number, color: THREE.Color, drag = 1) {
    const i = this.idx;
    this.idx = (this.idx + 1) % this.max;
    this.pos[i * 3] = p.x; this.pos[i * 3 + 1] = p.y; this.pos[i * 3 + 2] = p.z;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    this.life[i] = life; this.maxLife[i] = life; this.drag[i] = drag;
    this.base[i * 3] = color.r; this.base[i * 3 + 1] = color.g; this.base[i * 3 + 2] = color.b;
  }
  update(dt: number) {
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      const k = i * 3;
      const ck = i * this.cs;
      if (this.life[i] <= 0) { this.col[ck] = this.col[ck + 1] = this.col[ck + 2] = 0; if (this.smoke) this.col[ck + 3] = 0; this.pos[k + 1] = -99999; continue; }
      const d = Math.pow(this.drag[i], dt);
      this.vel[k] *= d; this.vel[k + 1] *= d; this.vel[k + 2] *= d;
      this.pos[k] += this.vel[k] * dt; this.pos[k + 1] += this.vel[k + 1] * dt; this.pos[k + 2] += this.vel[k + 2] * dt;
      const f = this.life[i] / this.maxLife[i];
      if (this.smoke) { this.col[ck] = this.base[k]; this.col[ck + 1] = this.base[k + 1]; this.col[ck + 2] = this.base[k + 2]; this.col[ck + 3] = Math.min(1, f * 1.6) * 0.55; }
      else { this.col[ck] = this.base[k] * f; this.col[ck + 1] = this.base[k + 1] * f; this.col[ck + 2] = this.base[k + 2] * f; }
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.color.needsUpdate = true;
  }
}

function dotTex() {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const g = c.getContext("2d")!;
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, "rgba(255,255,255,1)");
  gr.addColorStop(0.3, "rgba(255,255,255,0.7)");
  gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

function buildSub(color = 0x30363d): THREE.Group {
  const g = new THREE.Group();
  const m = new THREE.MeshStandardMaterial({ color, metalness: 0.6, roughness: 0.5 });
  const hull = new THREE.Mesh(new THREE.CapsuleGeometry(3, 26, 6, 12), m);
  hull.rotation.x = Math.PI / 2;
  g.add(hull);
  const sail = new THREE.Mesh(new THREE.BoxGeometry(2, 5, 7), m);
  sail.position.set(0, 4, 4);
  g.add(sail);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(9, 0.4, 2), m);
  fin.position.set(0, 4.5, 4);
  g.add(fin);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.4, 6, 3), m);
  tail.position.set(0, 0, -16);
  g.add(tail);
  const prop = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.3, 6, 12), new THREE.MeshStandardMaterial({ color: 0xccaa44, metalness: 0.9 }));
  prop.position.z = -17;
  g.add(prop);
  return g;
}

function buildSam(): THREE.Group {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.BoxGeometry(10, 3, 14), new THREE.MeshStandardMaterial({ color: 0x4a5a3a }));
  base.position.y = 1.5;
  g.add(base);
  const rack = new THREE.Mesh(new THREE.BoxGeometry(6, 3, 9), new THREE.MeshStandardMaterial({ color: 0x5a6a4a }));
  rack.position.set(0, 5, 0);
  rack.rotation.x = -0.6;
  g.add(rack);
  const tip = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff2222 }));
  tip.position.set(0, 8, 0);
  g.add(tip);
  return g;
}

export class Game {
  opts: GameOptions;
  map: MapDef;
  renderer: THREE.WebGLRenderer;
  scene = new THREE.Scene();
  camera: THREE.PerspectiveCamera;
  world: World;
  sun: THREE.DirectionalLight;
  fire: Particles; sparks: Particles; smoke: Particles;
  composer: EffectComposer | null = null; waterTex: THREE.Texture | null = null;
  sfx = new Sfx();
  units: Unit[] = [];
  player!: Unit;
  bullets: Bullet[] = [];
  bulletMesh: THREE.InstancedMesh;
  missiles: Missile[] = [];
  missilePool: THREE.Object3D[] = [];
  flares: Flare[] = [];
  flashes: { mesh: THREE.Mesh; t: number; s: number }[] = [];
  keys = new Set<string>();
  touch = { x: 0, y: 0, gas: false, brake: false, fire: false, boost: false };
  missileReq = false; flareReq = false;
  paused = false; ended = false;
  raf = 0; last = 0; fpsAcc = 0; fpsN = 0; fps = 0; hudT = 0; netT = 0;
  shake = 0;
  score = 0; coins = 0; wave = 0; waveT = 0; time = 0; baseHp = 1000; lives = 3;
  feed: string[] = []; feedT = 0;
  lockT = 0; lockUnit: Unit | null = null; warnT = 0; warning = false;
  celebrate: { unit: Unit; t: number } | null = null;
  baseTargets: MTarget[] = [];
  waterSpots: THREE.Vector3[] = [];
  onHud: (h: Hud) => void;
  onEnd: (e: EndInfo) => void;
  onPause: (p: boolean) => void;
  els: { lock?: HTMLDivElement | null; minimap?: HTMLCanvasElement | null; hit?: HTMLDivElement | null } = {};
  netBusy = false; netLastDmg: Record<string, number> = {}; netDeaths: Record<string, number> = {};
  myDmg: Record<string, number> = {}; killedBy = ""; remoteMs: THREE.Mesh[] = [];
  hitFlash = 0; sunDir = new THREE.Vector3(); sky: Sky | null = null; clock = 0;
  disposed = false;

  constructor(canvas: HTMLCanvasElement, opts: GameOptions, cb: { onHud: (h: Hud) => void; onEnd: (e: EndInfo) => void; onPause: (p: boolean) => void }) {
    this.opts = opts;
    this.onHud = cb.onHud; this.onEnd = cb.onEnd; this.onPause = cb.onPause;
    this.map = MAPS[opts.mapId] ?? MAPS[0];
    const q = opts.settings.quality;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: q === "2K" || q === "4K", powerPreference: "high-performance" });
    const dpr = window.devicePixelRatio || 1;
    const pr = q === "1K" ? 0.55 : q === "HD" ? Math.min(1, dpr) : q === "2K" ? Math.min(1.5, dpr) : Math.min(3, dpr * 1.5);
    this.renderer.setPixelRatio(pr);
    this.renderer.shadowMap.enabled = q !== "1K";
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = this.map.night ? 1.0 : 0.5;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.camera = new THREE.PerspectiveCamera(70, 1, 0.5, this.map.size * 3);
    this.scene.background = new THREE.Color(this.map.sky);
    this.scene.fog = new THREE.Fog(this.map.fog, this.map.size * 0.15, this.map.size * (this.map.small ? 1.0 : 0.75));
    // physically based sky + image based lighting from the sky
    const elev = THREE.MathUtils.degToRad(Math.max(2, this.map.sunElev));
    this.sunDir.setFromSphericalCoords(1, Math.PI / 2 - elev, THREE.MathUtils.degToRad(200));
    if (!this.map.night) {
      const sky = new Sky();
      sky.scale.setScalar(this.map.size * 2.5);
      const u = sky.material.uniforms;
      u["turbidity"].value = this.map.turbidity;
      u["rayleigh"].value = this.map.sunElev < 10 ? 3 : 1.6;
      u["mieCoefficient"].value = 0.005;
      u["mieDirectionalG"].value = 0.8;
      u["sunPosition"].value.copy(this.sunDir);
      (sky.material as THREE.ShaderMaterial).fog = false;
      this.sky = sky;
      this.scene.add(sky);
      const pm = new THREE.PMREMGenerator(this.renderer);
      const envScene = new THREE.Scene();
      const sky2 = new Sky();
      sky2.scale.setScalar(1000);
      Object.keys(u).forEach((k) => { (sky2.material.uniforms as Record<string, { value: unknown }>)[k].value = u[k].value; });
      envScene.add(sky2);
      this.scene.environment = pm.fromScene(envScene, 0.02).texture;
      pm.dispose();
      this.scene.background = null;
    } else {
      const pm = new THREE.PMREMGenerator(this.renderer);
      const envScene = new THREE.Scene();
      envScene.background = new THREE.Color(0x1a2240);
      const glow = new THREE.Mesh(new THREE.SphereGeometry(50, 16, 8), new THREE.MeshBasicMaterial({ color: 0x334488, side: THREE.BackSide }));
      envScene.add(glow);
      this.scene.environment = pm.fromScene(envScene, 0.04).texture;
      pm.dispose();
    }
    this.scene.environmentIntensity = this.map.night ? 0.5 : 0.7;
    this.scene.add(new THREE.HemisphereLight(this.map.night ? 0x334466 : 0xcfe4ff, this.map.low, this.map.night ? 0.35 : 0.4));
    this.sun = new THREE.DirectionalLight(this.map.sun, this.map.night ? 0.5 : this.map.sunElev < 10 ? 2.4 : 2.9);
    this.sun.position.copy(this.sunDir).multiplyScalar(800);
    this.sun.castShadow = this.renderer.shadowMap.enabled;
    const ss = q === "4K" ? 4096 : q === "HD" ? 1024 : 2048;
    this.sun.shadow.mapSize.set(ss, ss);
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.6;
    const sc = this.sun.shadow.camera;
    const ext = q === "HD" ? 120 : 200;
    sc.left = sc.bottom = -ext; sc.right = sc.top = ext; sc.near = 10; sc.far = 2000;
    this.scene.add(this.sun, this.sun.target);
    if (this.map.night) this.addStars();

    this.world = buildWorld(this.map, q);
    this.scene.add(this.world.group);
    this.baseTargets = this.world.baseTargets.map((p) => ({ pos: p, alive: true }));

    const tex = dotTex();
    this.fire = new Particles(q === "1K" ? 1500 : 3000, 16, tex);
    this.sparks = new Particles(q === "1K" ? 1000 : 2000, 3.5, tex);
    this.smoke = new Particles(q === "1K" ? 1500 : 3500, 26, tex, true);
    this.scene.add(this.smoke.pts, this.fire.pts, this.sparks.pts);
    const wm = this.world.water.material as THREE.MeshPhysicalMaterial;
    this.waterTex = wm.normalMap;
    if (q === "2K" || q === "4K") {
      const comp = new EffectComposer(this.renderer);
      comp.addPass(new RenderPass(this.scene, this.camera));
      comp.addPass(new UnrealBloomPass(new THREE.Vector2(512, 512), this.map.night ? 0.9 : 0.35, 0.5, 0.88));
      comp.addPass(new OutputPass());
      this.composer = comp;
    }

    this.bulletMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.35, 0.35, 9), new THREE.MeshBasicMaterial({ color: 0xffdd55 }), 800);
    this.bulletMesh.frustumCulled = false;
    this.bulletMesh.count = 0;
    this.scene.add(this.bulletMesh);
    const mBody = new THREE.MeshStandardMaterial({ color: 0xeeeeee, metalness: 0.5 });
    const mTip = new THREE.MeshBasicMaterial({ color: 0xff3333 });
    for (let i = 0; i < 80; i++) {
      const g = new THREE.Group();
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 4, 6), mBody);
      b.rotation.x = Math.PI / 2;
      const t = new THREE.Mesh(new THREE.ConeGeometry(0.3, 1, 6), mTip);
      t.rotation.x = Math.PI / 2;
      t.position.z = 2.5;
      g.add(b, t);
      g.visible = false;
      this.scene.add(g);
      this.missilePool.push(g);
    }
    for (let i = 0; i < 6; i++) {
      const f = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffaa44, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
      f.visible = false;
      this.scene.add(f);
      this.flashes.push({ mesh: f, t: 0, s: 1 });
    }
    // water spots for subs
    for (let i = 0; i < 400 && this.waterSpots.length < 40; i++) {
      const x = (Math.random() - 0.5) * this.map.size * 1.2, z = (Math.random() - 0.5) * this.map.size * 1.2;
      if (this.world.heightAt(x, z) < this.map.sea - 18 && Math.hypot(x, z) > 900) this.waterSpots.push(new THREE.Vector3(x, this.map.sea - 10, z));
    }

    this.setupMode();
    this.sfx.init(opts.settings.sound);
    this.bindInput();
    this.resize();
    for (const u of this.units) { u.mesh.position.copy(u.pos); u.mesh.quaternion.copy(u.q); }
    this.updateCamera(0.016);
    try { this.renderer.compile(this.scene, this.camera); } catch { /* ignore */ }
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.loop);
  }

  addStars() {
    const n = 1500, p = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const v = _v1.set(Math.random() - 0.5, Math.random() * 0.8 + 0.05, Math.random() - 0.5).normalize().multiplyScalar(this.map.size * 1.4);
      p.set([v.x, v.y, v.z], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(p, 3));
    const s = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 2, sizeAttenuation: false, fog: false }));
    this.scene.add(s);
  }

  // ---------- setup ----------
  makeUnit(kind: Kind, spec: PlaneSpec, name: string, team: number, isPlayer: boolean, color?: number): Unit {
    const mesh = kind === "plane" ? buildPlaneMesh(spec, color) : kind === "sam" ? buildSam() : buildSub(kind === "psub" ? 0x2a4a6a : 0x30363d);
    this.scene.add(mesh);
    const hp = kind === "plane" ? spec.hp : kind === "sam" ? 60 : kind === "sub" ? 120 : 220;
    const u: Unit = {
      id: Math.random().toString(36).slice(2), name, kind, spec, mesh, pos: V(), q: new THREE.Quaternion(), speed: 0, throttle: 0.8, vel: V(),
      hp, maxHp: hp, alive: true, isPlayer, remote: false, team, kills: 0, deaths: 0,
      gunCd: 0, missileCd: 2 + Math.random() * 4, missiles: spec.missiles, flares: 12, flareCd: 0,
      target: null, aimBase: null, aiTimer: 0, respawn: 0, onGround: false, skill: 0.5, surfaceT: Math.random() * 10, boost: false,
      evade: 0, evadeDir: V(), lastDmg: 0, smokeT: 0,
    };
    this.units.push(u);
    return u;
  }

  setupMode() {
    const o = this.opts;
    const spec = PLANES[o.planeId] ?? PLANES[0];
    const kind: Kind = o.mode === "defense" && o.vehicle === "sub" && this.waterSpots.length ? "psub" : "plane";
    this.player = this.makeUnit(kind, spec, o.name, 1, true);
    if (kind === "psub") {
      this.player.missiles = 16;
      const s = this.waterSpots.reduce((a, b) => (a.length() < b.length() ? a : b));
      this.player.pos.set(s.x * 0.5, this.map.sea - 6, s.z * 0.5);
      if (this.world.heightAt(this.player.pos.x, this.player.pos.z) > this.map.sea - 10) this.player.pos.copy(s);
      this.player.speed = 10;
    } else this.placeOnRunway(this.player);

    if (o.mode === "arena") {
      for (let i = 0; i < 26; i++) {
        const sp = PLANES[Math.floor(Math.random() * PLANES.length)];
        const u = this.makeUnit("plane", sp, CALLSIGNS[i % CALLSIGNS.length] + " AI", 10 + i, false);
        u.skill = 0.3 + Math.random() * 0.6;
        this.spawnAir(u);
      }
      this.time = 240;
    } else if (o.mode === "survival") {
      const n = this.map.small ? 5 : 10;
      for (let i = 0; i < n; i++) {
        let x = 0, z = 0, h = 0;
        for (let k = 0; k < 30; k++) {
          x = (Math.random() - 0.5) * this.map.size * 1.1; z = (Math.random() - 0.5) * this.map.size * 1.1;
          h = this.world.heightAt(x, z);
          if (h > this.map.sea + 2 && Math.hypot(x, z) > 700) break;
        }
        const s = this.makeUnit("sam", spec, "SAM", 2, false);
        s.pos.set(x, h, z);
        s.missileCd = 4 + Math.random() * 6;
      }
      this.wave = 0;
      this.waveT = 6;
    } else if (o.mode === "defense") {
      this.wave = 0;
      this.waveT = 8;
      this.lives = 3;
    } else if (o.mode === "multi") {
      this.lives = 999;
    }
  }

  placeOnRunway(u: Unit) {
    const g = this.world.groundLevel;
    u.pos.set(0, g + 2.75, -360);
    u.q.identity();
    u.speed = 0; u.throttle = 0; u.onGround = true;
  }

  spawnAir(u: Unit) {
    const a = Math.random() * Math.PI * 2, r = this.map.size * (0.15 + Math.random() * 0.3);
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    u.pos.set(x, Math.max(this.world.heightAt(x, z), this.map.sea) + 300 + Math.random() * 300, z);
    _v1.set(-x, 0, -z).normalize();
    u.q.setFromUnitVectors(FWD, _v1);
    u.speed = u.spec.speed * 0.7; u.throttle = 0.8; u.onGround = false;
    u.hp = u.maxHp; u.alive = true; u.mesh.visible = true; u.missiles = u.spec.missiles; u.flares = 12;
  }

  spawnWave() {
    this.wave++;
    const o = this.opts.mode;
    const n = o === "survival" ? Math.min(14, 1 + this.wave) : Math.min(12, 1 + this.wave);
    for (let i = 0; i < n; i++) {
      const sp = PLANES[Math.min(PLANES.length - 1, Math.floor(Math.random() * (10 + this.wave * 10)))];
      const u = this.makeUnit("plane", sp, CALLSIGNS[(i + this.wave * 3) % CALLSIGNS.length], 2, false, 0x7a2a2a);
      u.skill = Math.min(0.95, 0.25 + this.wave * 0.07 + Math.random() * 0.2);
      this.spawnAir(u);
      if (o === "defense" && Math.random() < 0.6) u.aimBase = this.baseTargets[Math.floor(Math.random() * this.baseTargets.length)];
    }
    if (o === "defense" && this.waterSpots.length) {
      for (let i = 0; i < Math.min(8, this.wave); i++) {
        const s = this.makeUnit("sub", PLANES[0], "Suv osti kemasi", 2, false);
        s.pos.copy(this.waterSpots[Math.floor(Math.random() * this.waterSpots.length)]);
        s.speed = 14;
        s.aimBase = this.baseTargets[Math.floor(Math.random() * this.baseTargets.length)];
      }
    }
    this.addFeed(`⚠ ${this.wave}-to'lqin: ${n} dushman!`);
    if (this.player.alive) { this.player.hp = Math.min(this.player.maxHp, this.player.hp + this.player.maxHp * 0.3); this.player.missiles = Math.max(this.player.missiles, this.player.spec.missiles); }
  }

  // ---------- input ----------
  kd = (e: KeyboardEvent) => {
    const k = keyName(e);
    if ([" ", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(k)) e.preventDefault();
    if (k === "p" || k === "escape") { this.togglePause(); return; }
    if (k === "f" || k === "enter") this.missileReq = true;
    if (k === "x" || k === "c") this.flareReq = true;
    this.keys.add(k);
  };
  ku = (e: KeyboardEvent) => { this.keys.delete(keyName(e)); };
  blur = () => { this.keys.clear(); if (!this.ended && !this.paused) this.togglePause(); };
  resize = () => {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.composer?.setSize(w, h);
    this.composer?.setPixelRatio(this.renderer.getPixelRatio());
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  };
  bindInput() {
    window.addEventListener("keydown", this.kd);
    window.addEventListener("keyup", this.ku);
    window.addEventListener("resize", this.resize);
    window.addEventListener("blur", this.blur);
  }
  togglePause() {
    if (this.ended) return;
    this.paused = !this.paused;
    this.onPause(this.paused);
  }
  setPaused(p: boolean) { if (this.paused !== p) this.togglePause(); }

  // ---------- loop ----------
  loop = (t: number) => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.loop);
    const cap = this.opts.settings.fps;
    const el = t - this.last;
    if (cap > 0 && el < 1000 / cap - 1) return;
    const dt = Math.min(0.05, el / 1000);
    this.last = t;
    this.fpsAcc += el; this.fpsN++;
    if (this.fpsAcc > 500) { this.fps = Math.round((this.fpsN * 1000) / this.fpsAcc); this.fpsAcc = 0; this.fpsN = 0; }
    if (!this.paused) this.update(dt);
    if (this.composer) this.composer.render(dt); else this.renderer.render(this.scene, this.camera);
  };

  update(dt: number) {
    this.clock += dt;
    if (this.waterTex) this.waterTex.offset.set(this.clock * 0.012, this.clock * 0.008);
    if (this.world.radar) this.world.radar.rotation.y += dt * 1.4;
    if (this.sky) this.sky.position.copy(this.camera.position);
    if (this.celebrate) { this.updateCelebrate(dt); this.fire.update(dt); this.sparks.update(dt); this.smoke.update(dt); return; }
    const mode = this.opts.mode;
    // timers / waves
    if (!this.ended) {
      if (mode === "arena") {
        this.time -= dt;
        if (this.time <= 0) this.endArena();
      } else if (mode === "survival" || mode === "defense") {
        this.time += dt;
        const enemies = this.units.some((u) => u.alive && u.team === 2 && (u.kind === "plane" || u.kind === "sub"));
        if (!enemies) {
          this.waveT -= dt;
          if (this.waveT <= 0) { if (this.wave > 0) this.score += 250 * this.wave; this.spawnWave(); this.waveT = 5; }
        }
      }
    }
    for (const u of this.units) {
      if (!u.alive) {
        if (u.respawn > 0) {
          u.respawn -= dt;
          if (u.respawn <= 0) this.respawnUnit(u);
        }
        continue;
      }
      if (u.isPlayer) this.updatePlayer(u, dt);
      else if (u.remote) this.updateRemote(u, dt);
      else if (u.kind === "plane") this.updateAI(u, dt);
      else if (u.kind === "sam") this.updateSam(u, dt);
      else if (u.kind === "sub") this.updateSub(u, dt);
      u.mesh.position.copy(u.pos);
      u.mesh.quaternion.copy(u.q);
      // engine glow & prop
      const glows = u.mesh.userData.glows as THREE.Mesh[] | undefined;
      if (glows) for (const g of glows) { const s = 0.4 + u.throttle * (u.boost ? 1.8 : 1) + Math.random() * 0.15; g.scale.set(1, s, 1); g.position.z = g.position.z; }
      const prop = u.mesh.getObjectByName("prop");
      if (prop) {
        const spin = (u.onGround ? u.throttle : 0.6 + u.throttle) * 60;
        prop.rotation.z += dt * spin;
        const disc = prop.getObjectByName("propdisc") as THREE.Mesh | undefined;
        if (disc) (disc.material as THREE.MeshBasicMaterial).opacity = Math.min(0.28, spin / 200);
      }
      const gear = u.mesh.getObjectByName("gear");
      if (gear) {
        const low = u.onGround || (u.isPlayer && u.pos.y - this.world.groundLevel < 60 && u.speed < 110 && Math.abs(u.pos.x) < 60 && Math.abs(u.pos.z) < 700);
        gear.visible = low;
      }
      // contrails at altitude / high G vapor for nearby planes
      if (u.kind === "plane" && !u.onGround && u.pos.y - this.map.sea > 900 && u.speed > 120 && u.pos.distanceToSquared(this.camera.position) < 1500 * 1500 && Math.random() < 0.7) {
        const fw = _v2.copy(FWD).applyQuaternion(u.q);
        for (const sd of [1, -1]) {
          _v3.set(sd * u.spec.span * 0.45, 0, -2).applyQuaternion(u.q).add(u.pos);
          this.smoke.spawn(_v3, -fw.x * 4, 0.5, -fw.z * 4, 3.5, WHITE, 0.95);
        }
      }
      // damage smoke
      if (u.hp < u.maxHp * 0.4 && u.kind === "plane") {
        u.smokeT -= dt;
        if (u.smokeT <= 0) { u.smokeT = 0.03; if (u.hp < u.maxHp * 0.2) this.fire.spawn(u.pos, (Math.random() - 0.5) * 4, 4, (Math.random() - 0.5) * 4, 0.5, FIRE, 0.6); this.smoke.spawn(u.pos, (Math.random() - 0.5) * 4, 4, (Math.random() - 0.5) * 4, 2.2, DARK, 0.6); }
      }
    }
    this.units = this.units.filter((u) => u.alive || u.respawn > 0 || u.isPlayer || u.remote || this.disposeUnit(u));
    this.updateBullets(dt);
    this.updateMissiles(dt);
    this.updateFlares(dt);
    for (const f of this.flashes) {
      if (f.t <= 0) continue;
      f.t -= dt * 3;
      f.mesh.visible = f.t > 0;
      f.mesh.scale.setScalar(f.s * (1.6 - f.t));
      (f.mesh.material as THREE.MeshBasicMaterial).opacity = Math.max(0, f.t);
    }
    this.fire.update(dt);
    this.sparks.update(dt);
    this.smoke.update(dt);
    this.updateCamera(dt);
    if (mode === "multi") { this.netT -= dt; if (this.netT <= 0) { this.netT = 0.1; this.netSync(); } }
    this.hudT -= dt;
    if (this.hudT <= 0) { this.hudT = 0.1; this.emitHud(); }
    this.drawMinimap();
    if (this.feedT > 0) { this.feedT -= dt; if (this.feedT <= 0 && this.feed.length) { this.feed.shift(); this.feedT = this.feed.length ? 3 : 0; } }
  }

  disposeUnit(u: Unit) { this.scene.remove(u.mesh); return false; }

  respawnUnit(u: Unit) {
    if (u.isPlayer) {
      if (this.opts.mode === "arena" || this.opts.mode === "multi" || this.opts.mode === "defense") {
        if (u.kind === "psub") { u.alive = true; u.hp = u.maxHp; u.mesh.visible = true; u.pos.copy(this.waterSpots[0]); u.missiles = 16; return; }
        this.spawnAir(u);
      }
    } else this.spawnAir(u);
  }

  // ---------- flight ----------
  flight(u: Unit, pitch: number, roll: number, yaw: number, dt: number) {
    const r = u.spec.turn;
    const auth = clamp(u.speed / 110, 0.35, 1.15);
    _e.set(-pitch * 1.35 * r * auth * dt, -yaw * 0.45 * r * auth * dt, roll * 2.8 * r * dt, "XYZ");
    _q.setFromEuler(_e);
    u.q.multiply(_q).normalize();
    const f = _v1.copy(FWD).applyQuaternion(u.q);
    const maxS = u.spec.speed * (u.boost ? 1.3 : 1);
    const tgt = 40 + (maxS - 40) * u.throttle;
    u.speed += (tgt - u.speed) * 0.55 * dt - f.y * 22 * dt;
    u.speed = clamp(u.speed, 18, maxS * 1.2);
    u.vel.copy(f).multiplyScalar(u.speed);
    u.pos.addScaledVector(u.vel, dt);
    if (u.speed < 48) {
      u.pos.y -= (48 - u.speed) * 0.8 * dt;
      // nose drops during stall
      _q.setFromAxisAngle(_v2.set(1, 0, 0), (48 - u.speed) * 0.01 * dt);
      u.q.multiply(_q);
    }
  }

  bankOf(u: Unit) {
    const right = _v4.set(-1, 0, 0).applyQuaternion(u.q);
    return Math.asin(clamp(-right.y, -1, 1));
  }

  input() {
    const k = this.keys, t = this.touch, s = this.opts.settings;
    const left = (k.has("arrowleft") || k.has("a") ? 1 : 0) + (t.x < 0 ? -t.x : 0);
    const right = (k.has("arrowright") || k.has("d") ? 1 : 0) + (t.x > 0 ? t.x : 0);
    let pitch = (k.has("arrowup") ? 1 : 0) - (k.has("arrowdown") ? 1 : 0) + -t.y;
    if (s.invertY) pitch = -pitch;
    const yawK = (k.has("q") ? -1 : 0) + (k.has("e") ? 1 : 0);
    return {
      steer: clamp((right - left) * s.sensitivity, -1, 1),
      pitch: clamp(pitch * s.sensitivity, -1, 1),
      yaw: yawK,
      gas: k.has("w") || k.has("shift") && false || t.gas,
      brake: k.has("s") || t.brake,
      boost: k.has("shift") || t.boost,
      fire: k.has(" ") || k.has("j") || t.fire,
    };
  }

  updatePlayer(u: Unit, dt: number) {
    const inp = this.input();
    const easy = this.opts.settings.control === "easy";
    // on the ground, ↑ / joystick-up also spools the engine so takeoff always works
    const groundGas = u.onGround && inp.pitch > 0.2 && u.throttle < 1;
    if (inp.gas || groundGas) u.throttle = Math.min(1, u.throttle + dt * 0.8);
    if (inp.brake) u.throttle = Math.max(0, u.throttle - dt * 0.9);
    u.boost = inp.boost && u.throttle > 0.5;

    if (u.kind === "psub") return this.updatePlayerSub(u, inp, dt);

    if (u.onGround) {
      const maxS = u.spec.speed * 0.55;
      u.speed += (u.throttle * maxS * (u.boost ? 1.3 : 1) - u.speed) * 0.5 * dt;
      if (inp.brake) u.speed = Math.max(0, u.speed - 30 * dt);
      _q.setFromAxisAngle(UP, -inp.steer * 0.4 * dt * clamp(u.speed / 30, 0, 1));
      u.q.premultiply(_q);
      const f = _v1.copy(FWD).applyQuaternion(u.q);
      f.y = 0; f.normalize();
      u.q.setFromUnitVectors(FWD, f);
      u.pos.addScaledVector(f, u.speed * dt);
      u.pos.y = this.world.heightAt(u.pos.x, u.pos.z) + 2.75;
      if (u.speed > 25 && Math.random() < 0.12) this.sparks.spawn(_v2.copy(u.pos).addScaledVector(f, -6).setY(u.pos.y - 2.4), (Math.random() - 0.5) * 3, 1, (Math.random() - 0.5) * 3, 0.5, DUST, 0.5);
      if (u.speed > 55 && (inp.pitch > 0.2 || (easy && u.speed > 72))) {
        u.onGround = false;
        _q.setFromAxisAngle(_v2.set(1, 0, 0), -0.2);
        u.q.multiply(_q);
        u.pos.y += 1;
        this.addFeed("🛫 Havoga ko'tarildingiz!");
        this.shake = Math.max(this.shake, 0.3);
      }
      if (Math.abs(u.pos.z) > 420 || Math.abs(u.pos.x) > 25) { if (u.speed > 30) this.crash(u); }
    } else {
      let pitch = inp.pitch, roll = 0, yaw = inp.yaw;
      if (easy) {
        const bank = this.bankOf(u);
        const tb = inp.steer * 1.15;
        roll = clamp((tb - bank) * 3, -1, 1);
        const upY = _v3.set(0, 1, 0).applyQuaternion(u.q).y;
        if (upY < 0) roll = bank > 0 ? -1 : 1;
        pitch = pitch + Math.abs(inp.steer) * 0.55;
        if (inp.pitch === 0 && inp.steer === 0) {
          const fy = _v2.copy(FWD).applyQuaternion(u.q).y;
          pitch += clamp(-fy * 2, -0.4, 0.4);
        }
        yaw += inp.steer * 0.35;
        // auto-return from map edge
        const lim = this.map.size * 0.62;
        if (Math.abs(u.pos.x) > lim || Math.abs(u.pos.z) > lim) {
          const d = _v2.set(-u.pos.x, 0, -u.pos.z).normalize().applyQuaternion(_q.copy(u.q).invert());
          yaw += clamp(-d.x * 2, -1, 1);
        }
        // ground avoidance assist
        const ah = this.world.heightAt(u.pos.x + u.vel.x * 1.5, u.pos.z + u.vel.z * 1.5);
        if (u.pos.y - Math.max(ah, this.map.sea) < 40 && u.vel.y < 0) pitch = Math.max(pitch, 0.8);
      } else {
        roll = inp.steer;
      }
      this.flight(u, clamp(pitch, -1, 1), roll, clamp(yaw, -1, 1), dt);
      // hard boundary
      const hard = this.map.size * 0.8;
      if (Math.abs(u.pos.x) > hard || Math.abs(u.pos.z) > hard) { u.pos.x = clamp(u.pos.x, -hard, hard); u.pos.z = clamp(u.pos.z, -hard, hard); }
      if (u.pos.y > 3000) u.pos.y = 3000;
      // vapor trails on high G
      if (Math.abs(pitch) > 0.7 && u.speed > 130) {
        const f = _v2.copy(FWD).applyQuaternion(u.q);
        for (const sd of [1, -1]) {
          _v3.set(sd * u.spec.span * 0.5, 0, -2).applyQuaternion(u.q).add(u.pos);
          this.sparks.spawn(_v3, -f.x * 10, -f.y * 10, -f.z * 10, 0.5, new THREE.Color(0.5, 0.5, 0.55), 0.9);
        }
      }
      if (u.boost) {
        const f = _v2.copy(FWD).applyQuaternion(u.q);
        _v3.copy(u.pos).addScaledVector(f, -u.spec.len * 0.6);
        this.fire.spawn(_v3, -f.x * 30, -f.y * 30, -f.z * 30, 0.25, new THREE.Color(1, 0.5, 0.15), 0.5);
      }
      // ground/water collision or landing
      const gh = this.world.heightAt(u.pos.x, u.pos.z);
      if (u.pos.y < this.map.sea + 1) this.crash(u);
      else if (u.pos.y < gh + 2.2) {
        const up = _v3.set(0, 1, 0).applyQuaternion(u.q);
        const f = _v2.copy(FWD).applyQuaternion(u.q);
        if (Math.abs(u.pos.x) < 22 && Math.abs(u.pos.z) < 400 && u.speed < 120 && up.y > 0.85 && f.y > -0.25) {
          u.onGround = true;
          u.hp = u.maxHp; u.missiles = u.spec.missiles; u.flares = 12;
          this.addFeed("🛬 Qo'ndingiz — ta'mirlandi va qurollandi!");
          this.shake = 0.4;
        } else this.crash(u);
      }
    }
    this.sfx.setEngine(u.throttle, u.speed);
    // weapons
    u.gunCd -= dt; u.flareCd -= dt;
    if (inp.fire && u.gunCd <= 0 && !u.onGround) {
      u.gunCd = 0.075;
      this.fireGun(u, 0.004);
      this.shake = Math.max(this.shake, 0.06);
      if (Math.random() < 0.6) this.sfx.gun();
    }
    this.updateLock(u, dt);
    if (this.missileReq) {
      this.missileReq = false;
      if (u.missiles > 0 && !u.onGround) {
        u.missiles--;
        this.fireMissile(u, this.lockT >= 0.7 ? this.lockUnit : null);
        this.shake = Math.max(this.shake, 0.25);
      }
    }
    if (this.flareReq) {
      this.flareReq = false;
      if (u.flares > 0 && u.flareCd <= 0) { u.flares--; u.flareCd = 0.6; this.dropFlares(u); }
    }
    // missile warning
    let warn = false;
    for (const m of this.missiles) if (m.target === u && m.pos.distanceTo(u.pos) < 1800) warn = true;
    this.warning = warn;
    if (warn) { this.warnT -= dt; if (this.warnT <= 0) { this.warnT = 0.25; this.sfx.warn(); } }
  }

  updatePlayerSub(u: Unit, inp: ReturnType<Game["input"]>, dt: number) {
    const maxS = u.boost ? 45 : 32;
    u.speed += (u.throttle * maxS - u.speed) * 0.6 * dt;
    const f0 = _v1.copy(FWD).applyQuaternion(u.q);
    let yawA = Math.atan2(f0.x, f0.z) - inp.steer * 0.8 * dt;
    let pitchA = Math.asin(clamp(f0.y, -1, 1)) + inp.pitch * 0.6 * dt;
    pitchA = clamp(pitchA, -0.5, 0.5);
    _e.set(-pitchA, yawA, 0, "YXZ");
    u.q.setFromEuler(_e);
    void yawA;
    yawA = 0;
    const f = _v1.copy(FWD).applyQuaternion(u.q);
    u.vel.copy(f).multiplyScalar(u.speed);
    u.pos.addScaledVector(u.vel, dt);
    const floor = this.world.heightAt(u.pos.x, u.pos.z) + 4;
    if (u.pos.y < floor) { u.pos.y = floor; u.speed *= 0.97; }
    u.pos.y = Math.min(u.pos.y, this.map.sea - 2);
    const hard = this.map.size * 0.8;
    u.pos.x = clamp(u.pos.x, -hard, hard); u.pos.z = clamp(u.pos.z, -hard, hard);
    if (Math.random() < 0.4) this.sparks.spawn(_v2.copy(u.pos).addScaledVector(f, -16), (Math.random() - 0.5) * 3, 3, (Math.random() - 0.5) * 3, 1.5, new THREE.Color(0.5, 0.7, 0.9), 0.8);
    this.sfx.setEngine(u.throttle * 0.4, u.speed);
    u.gunCd -= dt;
    if (inp.fire && u.gunCd <= 0) { u.gunCd = 0.15; this.fireGun(u, 0.01); this.sfx.gun(); }
    this.updateLock(u, dt);
    if (this.missileReq) {
      this.missileReq = false;
      if (u.missiles > 0) { u.missiles--; this.fireMissile(u, this.lockT >= 0.7 ? this.lockUnit : null); }
    }
    this.flareReq = false;
    let warn = false;
    for (const m of this.missiles) if (m.target === u && m.pos.distanceTo(u.pos) < 1500) warn = true;
    this.warning = warn;
  }

  updateLock(u: Unit, dt: number) {
    const f = _v1.copy(FWD).applyQuaternion(u.q);
    let best: Unit | null = null, bestA = 0.32;
    for (const o of this.units) {
      if (!o.alive || o === u || o.team === u.team) continue;
      _v2.subVectors(o.pos, u.pos);
      const d = _v2.length();
      if (d > 2400) continue;
      const a = f.angleTo(_v2);
      if (a < bestA) { bestA = a; best = o; }
    }
    if (best && best === this.lockUnit) {
      const before = this.lockT;
      this.lockT += dt;
      if (before < 0.7 && this.lockT >= 0.7) this.sfx.beep(1600, 0.15, 0.08, "sine");
    } else { this.lockUnit = best; this.lockT = 0; }
    const el = this.els.lock;
    if (el) {
      if (this.lockUnit) {
        _v3.copy(this.lockUnit.pos).project(this.camera);
        if (_v3.z < 1) {
          el.style.display = "block";
          el.style.transform = `translate(${((_v3.x + 1) / 2) * window.innerWidth - 24}px, ${((1 - _v3.y) / 2) * window.innerHeight - 24}px)`;
          el.style.borderColor = this.lockT >= 0.7 ? "#ff3344" : "#ffd84a";
          el.dataset.locked = this.lockT >= 0.7 ? "1" : "0";
        } else el.style.display = "none";
      } else el.style.display = "none";
    }
  }

  crash(u: Unit) {
    this.explode(u.pos, 2.2);
    this.kill(u, null);
  }

  // ---------- AI ----------
  isEnemy(a: Unit, b: Unit) { return a.team !== b.team; }

  updateAI(u: Unit, dt: number) {
    u.aiTimer -= dt;
    if (u.aiTimer <= 0 || (u.target && !u.target.alive)) {
      u.aiTimer = 2 + Math.random() * 3;
      let best: Unit | null = null, bd = Infinity;
      for (const o of this.units) {
        if (!o.alive || o === u || !this.isEnemy(u, o) || o.kind === "sam" || o.kind === "sub") continue;
        const d = o.pos.distanceTo(u.pos) * (o.isPlayer && this.opts.mode !== "arena" ? 0.6 : 1) * (0.7 + Math.random() * 0.6);
        if (d < bd) { bd = d; best = o; }
      }
      u.target = best;
    }
    const f = _v1.copy(FWD).applyQuaternion(u.q);
    const desired = _v2;
    let aimPos: THREE.Vector3 | null = null;
    if (u.aimBase && u.aimBase.alive && this.baseHp > 0 && (!u.target || u.target.pos.distanceTo(u.pos) > 700)) {
      aimPos = u.aimBase.pos;
      desired.subVectors(aimPos, u.pos);
      if (desired.length() < 250) desired.y += 200; // pull out after strafing
    } else if (u.target) {
      const d = u.target.pos.distanceTo(u.pos);
      aimPos = _v3.copy(u.target.pos).addScaledVector(u.target.vel, (d / 800) * u.skill);
      desired.subVectors(aimPos, u.pos);
    } else desired.set(-u.pos.x, 0, -u.pos.z);
    desired.normalize();
    // evade incoming missiles
    if (u.evade > 0) { u.evade -= dt; desired.lerp(u.evadeDir, 0.85).normalize(); }
    else if (Math.random() < dt * 2) {
      for (const m of this.missiles) if (m.target === u && m.pos.distanceTo(u.pos) < 700) {
        u.evade = 2; u.evadeDir.set(Math.random() - 0.5, 0.3, Math.random() - 0.5).normalize();
        if (u.flares > 0 && Math.random() < u.skill) { u.flares--; this.dropFlares(u); }
        break;
      }
    }
    // avoidance
    const ahead = this.world.heightAt(u.pos.x + f.x * 300, u.pos.z + f.z * 300);
    const gnd = Math.max(ahead, this.world.heightAt(u.pos.x, u.pos.z), this.map.sea);
    if (u.pos.y - gnd < 150) desired.y = Math.max(desired.y, 0.7);
    if (u.pos.y > 2200) desired.y = Math.min(desired.y, -0.3);
    const lim = this.map.size * 0.6;
    if (Math.abs(u.pos.x) > lim || Math.abs(u.pos.z) > lim) desired.lerp(_v4.set(-u.pos.x, 0, -u.pos.z).normalize(), 0.7).normalize();
    // convert to controls
    const inv = _q.copy(u.q).invert();
    const l = desired.applyQuaternion(inv);
    const r = -l.x, up = l.y;
    let roll = 0, pitch = 0;
    if (Math.hypot(r, up) > 0.08 || l.z < 0) {
      roll = clamp(Math.atan2(r, Math.max(up, -0.2) + (l.z < 0 ? 0.5 : 0)) * 2.2, -1, 1);
      pitch = l.z < 0 ? 1 : clamp(up * 4 + 0.1, -0.5, 1);
    } else {
      roll = clamp(-this.bankOf(u) * 2, -1, 1);
      pitch = clamp(up * 3, -1, 1);
    }
    const dist = aimPos ? aimPos.distanceTo(u.pos) : 9999;
    u.throttle = dist > 900 ? 1 : 0.75;
    u.boost = dist > 1500;
    this.flight(u, pitch * (0.6 + u.skill * 0.4), roll, clamp(-l.x * 2, -1, 1), dt);
    const gh = this.world.heightAt(u.pos.x, u.pos.z);
    if (u.pos.y < Math.max(gh, this.map.sea) + 2) { this.crash(u); return; }
    // weapons
    u.gunCd -= dt; u.missileCd -= dt;
    if (aimPos) {
      const ang = f.angleTo(_v4.subVectors(aimPos, u.pos));
      if (dist < 750 && ang < 0.06 + (1 - u.skill) * 0.03 && u.gunCd <= 0) {
        u.gunCd = 0.11 + (1 - u.skill) * 0.08;
        this.fireGun(u, 0.008 + (1 - u.skill) * 0.02);
      }
      if (u.target && dist < 1800 && dist > 300 && ang < 0.3 && u.missileCd <= 0 && u.missiles > 0) {
        u.missileCd = 7 + Math.random() * 8 - u.skill * 3;
        u.missiles--;
        this.fireMissile(u, u.target);
      }
      if (u.aimBase && aimPos === u.aimBase.pos && dist < 1500 && ang < 0.3 && u.missileCd <= 0 && u.missiles > 0) {
        u.missileCd = 8; u.missiles--;
        this.fireMissile(u, u.aimBase);
      }
    }
  }

  updateSam(u: Unit, dt: number) {
    u.missileCd -= dt;
    if (u.missileCd > 0) return;
    const p = this.player;
    if (!p.alive || p.onGround || p.kind === "psub") return;
    const d = p.pos.distanceTo(u.pos);
    if (d < 2600) {
      u.missileCd = 6 + Math.random() * 5;
      u.q.setFromUnitVectors(FWD, _v1.set(0, 1, 0));
      this.fireMissile(u, p);
      this.addFeed("🚀 SAM raketa uchirdi! Qoching!");
    } else u.missileCd = 1;
  }

  updateSub(u: Unit, dt: number) {
    const tgt = u.aimBase?.pos ?? this.world.baseCenter;
    const d = Math.hypot(tgt.x - u.pos.x, tgt.z - u.pos.z);
    u.surfaceT -= dt;
    const surfaced = u.surfaceT < 0;
    if (u.surfaceT < -8) u.surfaceT = 10 + Math.random() * 8;
    const wantY = surfaced ? this.map.sea - 1.5 : this.map.sea - 14;
    u.pos.y += (wantY - u.pos.y) * dt * 0.8;
    const dir = _v1.set(tgt.x - u.pos.x, 0, tgt.z - u.pos.z).normalize();
    if (d < 900) dir.set(-dir.z, 0, dir.x); // circle
    const nx = u.pos.x + dir.x * u.speed * dt, nz = u.pos.z + dir.z * u.speed * dt;
    if (this.world.heightAt(nx, nz) < this.map.sea - 8) { u.pos.x = nx; u.pos.z = nz; }
    else { u.pos.x += dir.z * u.speed * dt; u.pos.z -= dir.x * u.speed * dt; }
    _q.setFromUnitVectors(FWD, dir);
    u.q.slerp(_q, dt * 2);
    u.vel.copy(dir).multiplyScalar(u.speed);
    u.missileCd -= dt;
    if (surfaced) {
      if (Math.random() < 0.3) this.sparks.spawn(u.pos, (Math.random() - 0.5) * 8, 4, (Math.random() - 0.5) * 8, 0.8, new THREE.Color(0.8, 0.9, 1), 0.8);
      if (u.missileCd <= 0 && d < 2600) {
        u.missileCd = 6;
        u.q.setFromUnitVectors(FWD, _v2.set(0, 1, 0));
        const p = this.player;
        const atPlayer = p.alive && p.kind === "plane" && !p.onGround && p.pos.distanceTo(u.pos) < 1800 && Math.random() < 0.5;
        this.fireMissile(u, atPlayer ? p : u.aimBase ?? this.baseTargets[0]);
      }
    }
  }

  updateRemote(u: Unit, dt: number) {
    if (!u.net) return;
    const k = 1 - Math.exp(-dt * 10);
    _v1.copy(u.pos);
    u.pos.lerp(u.net.pos, k);
    u.q.slerp(u.net.q, k);
    u.vel.subVectors(u.pos, _v1).divideScalar(Math.max(dt, 0.001));
  }

  // ---------- weapons ----------
  fireGun(u: Unit, spread: number) {
    const f = _v1.copy(FWD).applyQuaternion(u.q);
    const offs = u.kind === "plane" ? [u.spec.span * 0.22, -u.spec.span * 0.22] : [0];
    for (const ox of offs) {
      if (this.bullets.length >= 780) break;
      const p = _v2.set(ox, -0.3, u.spec.len * 0.4).applyQuaternion(u.q).add(u.pos);
      const dir = _v3.copy(f).add(_v4.set((Math.random() - 0.5) * spread, (Math.random() - 0.5) * spread, (Math.random() - 0.5) * spread)).normalize();
      const sp = u.kind === "psub" ? 160 : 850;
      this.bullets.push({ pos: p.clone(), prev: p.clone(), vel: dir.multiplyScalar(sp).add(u.vel).clone(), life: u.kind === "psub" ? 4 : 1.5, owner: u, dmg: u.kind === "plane" ? u.spec.gun : 20 });
      if (u.isPlayer) this.sparks.spawn(p, f.x * 50, f.y * 50, f.z * 50, 0.06, new THREE.Color(1, 0.8, 0.3));
    }
  }

  fireMissile(u: Unit, target: MTarget | null) {
    const mesh = this.missilePool.find((m) => !m.visible);
    if (!mesh) return;
    mesh.visible = true;
    const dir = V().copy(FWD).applyQuaternion(u.q);
    const torpedo = u.kind === "psub";
    this.missiles.push({ pos: u.pos.clone().addScaledVector(dir, 6).add(_v1.set(0, -2, 0)), dir, speed: Math.max(u.speed, 60), target, life: torpedo ? 14 : 10, owner: u, mesh, torpedo });
    if (u.isPlayer || u.pos.distanceTo(this.camera.position) < 600) this.sfx.missile();
  }

  dropFlares(u: Unit) {
    for (let i = 0; i < 4; i++) {
      const v = _v1.set((Math.random() - 0.5) * 60, -20 - Math.random() * 20, (Math.random() - 0.5) * 60).add(_v2.copy(u.vel).multiplyScalar(0.4));
      this.flares.push({ pos: u.pos.clone(), vel: v.clone(), life: 3, alive: true });
    }
    for (const m of this.missiles) {
      if (m.target === u && Math.random() < 0.7 && m.pos.distanceTo(u.pos) < 1500) m.target = this.flares[this.flares.length - 1];
    }
    if (u.isPlayer) this.sfx.beep(400, 0.2, 0.06, "sawtooth");
  }

  updateFlares(dt: number) {
    for (const f of this.flares) {
      f.life -= dt;
      f.vel.y -= 15 * dt;
      f.vel.multiplyScalar(Math.pow(0.6, dt));
      f.pos.addScaledVector(f.vel, dt);
      this.fire.spawn(f.pos, 0, 0, 0, 0.4, new THREE.Color(1, 0.85, 0.5), 1);
      if (f.life <= 0) f.alive = false;
    }
    this.flares = this.flares.filter((f) => f.alive);
  }

  segHit(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, r: number) {
    _v1.subVectors(b, a);
    const len2 = _v1.lengthSq();
    let t = len2 > 0 ? _v2.subVectors(c, a).dot(_v1) / len2 : 0;
    t = clamp(t, 0, 1);
    _v3.copy(a).addScaledVector(_v1, t);
    return _v3.distanceToSquared(c) < r * r;
  }

  updateBullets(dt: number) {
    let n = 0;
    const live: Bullet[] = [];
    for (const b of this.bullets) {
      b.life -= dt;
      b.prev.copy(b.pos);
      b.pos.addScaledVector(b.vel, dt);
      let dead = b.life <= 0;
      if (!dead && b.owner.kind === "psub" && b.pos.y > this.map.sea + 30) dead = true;
      if (!dead) {
        for (const u of this.units) {
          if (!u.alive || u === b.owner || u.team === b.owner.team) continue;
          if (u.kind === "sub" && u.pos.y < this.map.sea - 4 && b.owner.kind !== "psub") continue;
          const r = u.kind === "plane" ? Math.max(7, u.spec.span * 0.45) : u.kind === "sam" ? 10 : 16;
          if (this.segHit(b.prev, b.pos, u.pos, r)) {
            this.damage(u, b.dmg, b.owner);
            this.sparks.spawn(b.pos, (Math.random() - 0.5) * 40, (Math.random() - 0.5) * 40, (Math.random() - 0.5) * 40, 0.3, new THREE.Color(1, 0.7, 0.2));
            dead = true;
            break;
          }
        }
        if (!dead && this.opts.mode === "defense" && b.owner.team === 2) {
          for (const t of this.baseTargets) if (this.segHit(b.prev, b.pos, t.pos, 25)) { this.baseHp -= b.dmg * 0.3; dead = true; this.sparks.spawn(b.pos, 0, 20, 0, 0.4, new THREE.Color(1, 0.6, 0.2)); break; }
        }
        if (!dead && b.owner.kind !== "psub") {
          const gh = this.world.heightAt(b.pos.x, b.pos.z);
          if (b.pos.y < gh || b.pos.y < this.map.sea) {
            dead = true;
            if (b.owner.isPlayer) this.smoke.spawn(b.pos, 0, 8, 0, 1, DUST, 0.5);
          }
        }
      }
      if (!dead) {
        live.push(b);
        if (n < 800) {
          _q.setFromUnitVectors(FWD, _v4.copy(b.vel).normalize());
          _m.compose(b.pos, _q, _v1.set(1, 1, 1));
          this.bulletMesh.setMatrixAt(n++, _m);
        }
      }
    }
    this.bullets = live;
    this.bulletMesh.count = n;
    this.bulletMesh.instanceMatrix.needsUpdate = true;
  }

  updateMissiles(dt: number) {
    const live: Missile[] = [];
    for (const m of this.missiles) {
      m.life -= dt;
      const maxS = m.torpedo ? 70 : 430;
      m.speed = Math.min(maxS, m.speed + (m.torpedo ? 30 : 220) * dt);
      if (m.target && m.target.alive) {
        _v1.subVectors(m.target.pos, m.pos);
        const d = _v1.length();
        _v1.normalize();
        const ang = m.dir.angleTo(_v1);
        const maxTurn = (m.torpedo ? 1.2 : 2.1) * dt;
        if (ang > 1.4 && d > 80) m.target = null; // overshoot -> lost lock
        else if (ang > 0.0001) {
          const t = Math.min(1, maxTurn / ang);
          m.dir.lerp(_v1, t).normalize();
        }
        if (d < (m.torpedo ? 18 : 11)) {
          const tgtUnit = this.units.find((u) => u === m.target);
          if (tgtUnit) this.damage(tgtUnit, 60, m.owner);
          else if (m.target && this.baseTargets.includes(m.target)) { this.baseHp -= 70; this.addFeed("💥 Baza zarba oldi!"); }
          this.explode(m.pos, 1.2);
          m.life = 0;
        }
      }
      m.pos.addScaledVector(m.dir, m.speed * dt);
      const gh = this.world.heightAt(m.pos.x, m.pos.z);
      if (m.torpedo ? m.pos.y < gh : m.pos.y < Math.max(gh, this.map.sea - (m.owner.kind === "sub" ? 30 : 0)) && m.life < (m.owner.kind === "sub" ? 9 : 99)) { this.explode(m.pos, 0.8); m.life = 0; }
      if (m.life <= 0) { m.mesh.visible = false; continue; }
      m.mesh.position.copy(m.pos);
      m.mesh.quaternion.setFromUnitVectors(FWD, m.dir);
      this.smoke.spawn(m.pos, (Math.random() - 0.5) * 3, (Math.random() - 0.5) * 3, (Math.random() - 0.5) * 3, m.torpedo ? 1.5 : 2.6, m.torpedo ? BUBBLE : WHITE, 0.7);
      this.sparks.spawn(m.pos, -m.dir.x * 40, -m.dir.y * 40, -m.dir.z * 40, 0.08, new THREE.Color(1, 0.7, 0.3));
      live.push(m);
    }
    this.missiles = live;
  }

  damage(u: Unit, dmg: number, by: Unit | null) {
    if (!u.alive) return;
    if (u.remote) {
      // multiplayer: report damage, authority is the remote client
      if (by?.isPlayer) { this.myDmg[u.id] = (this.myDmg[u.id] || 0) + dmg; this.hitMarker(); }
      return;
    }
    u.hp -= dmg;
    if (by?.isPlayer) this.hitMarker();
    if (u.isPlayer) {
      this.shake = Math.max(this.shake, dmg > 30 ? 1 : 0.35);
      this.hitFlash = 1;
      if (this.els.hit) { this.els.hit.style.opacity = "0.55"; setTimeout(() => this.els.hit && (this.els.hit.style.opacity = "0"), 120); }
    }
    if (u.hp <= 0) {
      this.explode(u.pos, u.kind === "plane" ? 1.6 : 2);
      this.kill(u, by);
    }
  }

  hitMarker() {
    this.sfx.hit();
    const el = this.els.lock?.parentElement?.querySelector("[data-hitmark]") as HTMLElement | null;
    if (el) { el.style.opacity = "1"; el.style.transform = "translate(-50%,-50%) scale(1.3)"; setTimeout(() => { el.style.opacity = "0"; el.style.transform = "translate(-50%,-50%) scale(1)"; }, 90); }
  }

  kill(u: Unit, by: Unit | null) {
    if (!u.alive) return;
    u.alive = false;
    u.mesh.visible = false;
    u.deaths++;
    if (by && by !== u) {
      by.kills++;
      if (by.isPlayer) {
        this.score += 100;
        this.coins += 100;
        this.sfx.coin();
        this.addFeed(`✈ ${by.name} ➜ ${u.name}  +100 🪙`);
      } else if (u.isPlayer || this.opts.mode === "arena") this.addFeed(`${by.name} ➜ ${u.name}`);
    } else if (u.isPlayer) this.addFeed("💀 Halokatga uchradingiz!");
    if (by?.remote && u.isPlayer) this.killedBy = by.id;
    const m = this.opts.mode;
    if (u.isPlayer) {
      this.missileReq = false;
      if (m === "arena" || m === "multi") u.respawn = 3;
      else if (m === "defense") {
        this.lives--;
        if (this.lives <= 0) this.gameOver("Barcha hayotlar tugadi");
        else u.respawn = 3;
      } else this.gameOver("Samolyotingiz urib tushirildi");
    } else if (m === "arena") u.respawn = 4;
    else u.respawn = 0;
  }

  explode(p: THREE.Vector3, scale: number) {
    const c1 = new THREE.Color(1, 0.55, 0.15), c2 = new THREE.Color(1, 0.85, 0.4), c3 = new THREE.Color(0.16, 0.15, 0.14);
    for (let i = 0; i < 40 * scale; i++) {
      const a = Math.random() * Math.PI * 2, b = Math.random() * Math.PI - Math.PI / 2, s = (20 + Math.random() * 60) * scale;
      if (Math.random() < 0.6) this.fire.spawn(p, Math.cos(a) * Math.cos(b) * s, Math.sin(b) * s, Math.sin(a) * Math.cos(b) * s, 0.5 + Math.random() * 0.6, c1, 0.15);
      else this.smoke.spawn(p, Math.cos(a) * Math.cos(b) * s * 0.5, Math.sin(b) * s * 0.5 + 6, Math.sin(a) * Math.cos(b) * s * 0.5, 2.5 + Math.random() * 2, c3, 0.3);
    }
    for (let i = 0; i < 50 * scale; i++) {
      const s = (60 + Math.random() * 140) * scale;
      _v4.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize().multiplyScalar(s);
      this.sparks.spawn(p, _v4.x, _v4.y, _v4.z, 0.4 + Math.random() * 0.8, c2, 0.4);
    }
    const f = this.flashes.find((x) => x.t <= 0) ?? this.flashes[0];
    f.t = 1; f.s = 10 * scale; f.mesh.position.copy(p); f.mesh.visible = true;
    const d = p.distanceTo(this.camera.position);
    const near = clamp(1 - d / 1500, 0, 1);
    this.shake = Math.max(this.shake, near * 1.2 * scale);
    if (near > 0) this.sfx.boom(near);
  }

  addFeed(s: string) {
    if (this.feed.includes(s)) { this.feedT = 3; return; }
    this.feed.push(s);
    if (this.feed.length > 5) this.feed.shift();
    this.feedT = 3;
  }

  // ---------- camera ----------
  camPos = V();
  updateCamera(dt: number) {
    const p = this.player;
    const target = p.alive ? p : this.units.find((u) => u.alive && u.kind === "plane") ?? p;
    const f = _v1.copy(FWD).applyQuaternion(target.q);
    const up = _v2.set(0, 1, 0).applyQuaternion(target.q);
    const isSub = target.kind === "psub";
    const back = isSub ? 55 : target.kind === "plane" ? 20 + target.spec.len * 0.5 : 30;
    const want = _v3.copy(target.pos).addScaledVector(f, -back).addScaledVector(up, isSub ? 14 : 4.5 + target.spec.len * 0.12);
    const k = 1 - Math.exp(-dt * (p.alive ? 9 : 2));
    this.camPos.lerp(want, k);
    if (this.camPos.lengthSq() === 0 || this.camPos.distanceTo(want) > 400) this.camPos.copy(want);
    this.camera.position.copy(this.camPos);
    const camGround = Math.max(this.world.heightAt(this.camPos.x, this.camPos.z) + 3, isSub ? -9999 : -9999);
    if (this.camera.position.y < camGround) this.camera.position.y = camGround;
    if (this.opts.settings.shake && this.shake > 0.001) {
      const s = this.shake * 1.6;
      this.camera.position.x += (Math.random() - 0.5) * s;
      this.camera.position.y += (Math.random() - 0.5) * s;
      this.camera.position.z += (Math.random() - 0.5) * s;
    }
    this.shake *= Math.pow(0.02, dt);
    this.camera.up.lerp(up, k * 0.6).normalize();
    this.camera.lookAt(_v4.copy(target.pos).addScaledVector(f, 30).addScaledVector(up, 3.5));
    const fov = 68 + clamp((target.speed - 100) / 10, 0, 14) + (target.boost ? 6 : 0);
    if (Math.abs(this.camera.fov - fov) > 0.1) { this.camera.fov += (fov - this.camera.fov) * k; this.camera.updateProjectionMatrix(); }
    // underwater look
    const under = this.camera.position.y < this.map.sea;
    const fog = this.scene.fog as THREE.Fog;
    if (under) {
      if (!(this.scene.background instanceof THREE.Color)) this.scene.background = new THREE.Color();
      (this.scene.background as THREE.Color).setHex(0x0a3a5a); fog.color.setHex(0x0a3a5a); fog.near = 5; fog.far = 380;
      if (this.sky) this.sky.visible = false;
    } else {
      if (this.sky) { this.sky.visible = true; this.scene.background = null; }
      else (this.scene.background as THREE.Color).setHex(this.map.sky);
      fog.color.setHex(this.map.fog); fog.near = this.map.size * 0.2; fog.far = this.map.size * (this.map.small ? 1.1 : 0.85);
    }
    // shadow follows player
    this.sun.position.copy(target.pos).addScaledVector(this.sunDir, 800);
    this.sun.target.position.copy(target.pos);
  }

  // ---------- celebrate ----------
  updateCelebrate(dt: number) {
    const c = this.celebrate!;
    c.t += dt;
    const u = c.unit;
    const r = 260, a = c.t * 0.5;
    const base = this.world.groundLevel + 400 + c.t * 15;
    u.pos.set(Math.cos(a) * r, base + Math.sin(c.t * 1.3) * 30, Math.sin(a) * r);
    const dir = _v1.set(-Math.sin(a), Math.cos(c.t * 1.3) * 0.15, Math.cos(a)).normalize();
    u.q.setFromUnitVectors(FWD, dir);
    _q.setFromAxisAngle(FWD, -0.6 + (Math.floor(c.t / 4) % 2 === 0 ? Math.max(0, Math.sin(c.t * 1.6)) * Math.PI * 2 * 0 : 0) + (c.t % 6 < 1.2 ? (c.t % 6) / 1.2 * Math.PI * 2 : 0));
    u.q.multiply(_q);
    u.mesh.visible = true;
    u.mesh.position.copy(u.pos);
    u.mesh.quaternion.copy(u.q);
    u.throttle = 1; u.boost = true;
    const glows = u.mesh.userData.glows as THREE.Mesh[] | undefined;
    if (glows) for (const g of glows) g.scale.set(1, 2.4 + Math.random() * 0.3, 1);
    const f = _v2.copy(FWD).applyQuaternion(u.q);
    for (const sd of [1, -1]) {
      _v3.set(sd * u.spec.span * 0.5, 0, -2).applyQuaternion(u.q).add(u.pos);
      this.smoke.spawn(_v3, -f.x * 5, -f.y * 5, -f.z * 5, 4, sd > 0 ? GOLD : WHITE, 0.95);
    }
    if (Math.random() < dt * 3) {
      const p = _v4.copy(u.pos).add(_v3.set((Math.random() - 0.5) * 300, 50 + Math.random() * 150, (Math.random() - 0.5) * 300));
      const col = new THREE.Color().setHSL(Math.random(), 1, 0.6);
      for (let i = 0; i < 80; i++) {
        _v1.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize().multiplyScalar(60 + Math.random() * 30);
        this.sparks.spawn(p, _v1.x, _v1.y, _v1.z, 1.6, col, 0.5);
      }
      this.sfx.boom(0.25);
    }
    const ca = c.t * 0.25;
    this.camera.position.set(u.pos.x + Math.cos(ca) * 90, u.pos.y + 25, u.pos.z + Math.sin(ca) * 90);
    this.camera.up.set(0, 1, 0);
    this.camera.lookAt(u.pos);
  }

  endArena() {
    if (this.ended) return;
    this.ended = true;
    const planes = this.units.filter((u) => u.kind === "plane");
    const ranking = planes.map((u) => ({ name: u.name, kills: u.kills, plane: u.spec.name, me: u.isPlayer })).sort((a, b) => b.kills - a.kills);
    const winnerU = planes.slice().sort((a, b) => b.kills - a.kills || (b.isPlayer ? 1 : 0) - (a.isPlayer ? 1 : 0))[0];
    for (const u of this.units) if (u !== winnerU) u.mesh.visible = false;
    for (const m of this.missiles) m.mesh.visible = false;
    this.missiles = []; this.bullets = []; this.bulletMesh.count = 0;
    if (winnerU.isPlayer) { this.coins += 1000; this.score += 1000; }
    this.celebrate = { unit: winnerU, t: 0 };
    if (this.els.lock) this.els.lock.style.display = "none";
    this.onEnd({ type: "arena", score: this.score, kills: this.player.kills, coins: this.coins, ranking, winner: winnerU.name, winnerPlane: winnerU.spec.name });
  }

  gameOver(reason: string) {
    if (this.ended) return;
    this.ended = true;
    this.score += Math.floor(this.time) * 2;
    setTimeout(() => {
      if (this.disposed) return;
      const ranking = this.units.filter((u) => u.isPlayer).map((u) => ({ name: u.name, kills: u.kills, plane: u.spec.name, me: true }));
      this.onEnd({ type: "gameover", score: this.score, kills: this.player.kills, coins: this.coins, ranking, reason });
    }, 1400);
  }

  // ---------- HUD ----------
  emitHud() {
    const p = this.player;
    if (this.opts.mode === "defense" && this.baseHp <= 0 && !this.ended) { this.baseHp = 0; this.explode(this.world.baseCenter, 3); this.gameOver("Baza yo'q qilindi"); }
    const planes = this.units.filter((u) => u.kind === "plane");
    const board = (this.opts.mode === "arena" || this.opts.mode === "multi")
      ? planes.slice().sort((a, b) => b.kills - a.kills).slice(0, 6).map((u) => ({ name: u.name, kills: u.kills, me: u.isPlayer }))
      : [];
    let hint = "";
    if (p.alive && p.onGround && p.kind === "plane") hint = p.speed < 20 ? "W / GAZ ni bosib dvigatelni yurgizing" : p.speed < 55 ? "Tezlik oshmoqda..." : "↑ bosib havoga ko'tariling!";
    this.onHud({
      speed: Math.round(p.speed * 3.6), alt: Math.round(p.pos.y - this.map.sea), throttle: p.throttle, hp: Math.max(0, Math.round(p.hp)), maxHp: p.maxHp,
      missiles: p.missiles, flares: p.flares, score: this.score, kills: p.kills, coins: this.coins, wave: this.wave, time: Math.max(0, Math.round(this.time)),
      baseHp: Math.max(0, Math.round(this.baseHp)), warning: this.warning, lock: this.lockUnit ? Math.min(1, this.lockT / 0.7) : 0, feed: [...this.feed], fps: this.fps,
      onGround: p.onGround, stall: !p.onGround && p.kind === "plane" && p.speed < 48, oob: Math.abs(p.pos.x) > this.map.size * 0.62 || Math.abs(p.pos.z) > this.map.size * 0.62,
      lives: this.lives, board, dead: !p.alive, respawnIn: Math.max(0, Math.ceil(p.respawn)), players: this.units.filter((u) => u.remote).length + 1, hint, boost: p.boost,
    });
  }

  drawMinimap() {
    const c = this.els.minimap;
    if (!c) return;
    const g = c.getContext("2d");
    if (!g) return;
    const W = c.width, H = c.height, p = this.player;
    g.clearRect(0, 0, W, H);
    g.fillStyle = "rgba(5,15,30,0.55)";
    g.beginPath(); g.arc(W / 2, H / 2, W / 2, 0, Math.PI * 2); g.fill();
    g.strokeStyle = "rgba(120,220,255,0.5)"; g.lineWidth = 2; g.stroke();
    const f = _v1.copy(FWD).applyQuaternion(p.q);
    const hd = Math.atan2(f.x, f.z);
    const scale = (W / 2) / (this.map.small ? 1500 : 3000);
    const pt = (x: number, z: number): [number, number] => {
      const dx = x - p.pos.x, dz = z - p.pos.z;
      const c0 = Math.cos(hd), s0 = Math.sin(hd);
      const rx = dx * c0 - dz * s0, rz = dx * s0 + dz * c0;
      return [W / 2 - rx * scale, H / 2 - rz * scale];
    };
    const clampR = (x: number, y: number): [number, number] => {
      const dx = x - W / 2, dy = y - H / 2, d = Math.hypot(dx, dy), m = W / 2 - 5;
      return d > m ? [W / 2 + (dx / d) * m, H / 2 + (dy / d) * m] : [x, y];
    };
    const [bx, by] = clampR(...pt(0, 0));
    g.fillStyle = "#3ab0ff"; g.fillRect(bx - 4, by - 4, 8, 8);
    for (const u of this.units) {
      if (!u.alive || u.isPlayer) continue;
      const [x, y] = clampR(...pt(u.pos.x, u.pos.z));
      g.fillStyle = u.team === p.team ? "#5f5" : u.kind === "sam" ? "#fa0" : u.kind === "sub" ? (u.pos.y > this.map.sea - 4 ? "#f6f" : "rgba(255,100,255,0.4)") : u.remote ? "#ff0" : "#f44";
      g.beginPath(); g.arc(x, y, u === this.lockUnit ? 4.5 : 3, 0, Math.PI * 2); g.fill();
    }
    for (const m of this.missiles) {
      if (m.target !== p) continue;
      const [x, y] = clampR(...pt(m.pos.x, m.pos.z));
      g.fillStyle = Math.floor(performance.now() / 150) % 2 ? "#fff" : "#f00";
      g.fillRect(x - 2, y - 2, 4, 4);
    }
    g.fillStyle = "#fff";
    g.beginPath(); g.moveTo(W / 2, H / 2 - 7); g.lineTo(W / 2 - 5, H / 2 + 5); g.lineTo(W / 2 + 5, H / 2 + 5); g.fill();
  }

  // ---------- multiplayer ----------
  async netSync() {
    if (this.netBusy || !this.opts.room) return;
    this.netBusy = true;
    const p = this.player;
    const state = {
      x: +p.pos.x.toFixed(1), y: +p.pos.y.toFixed(1), z: +p.pos.z.toFixed(1),
      qx: +p.q.x.toFixed(4), qy: +p.q.y.toFixed(4), qz: +p.q.z.toFixed(4), qw: +p.q.w.toFixed(4),
      sp: Math.round(p.speed), th: +p.throttle.toFixed(2), hp: Math.round(p.hp), alive: p.alive, plane: p.spec.id,
      kills: p.kills, deaths: p.deaths, killedBy: this.killedBy, dmg: this.myDmg,
      ms: this.missiles.filter((m) => m.owner === p).slice(0, 6).map((m) => [Math.round(m.pos.x), Math.round(m.pos.y), Math.round(m.pos.z)]),
    };
    try {
      const r = await fetch(`/api/rooms/${this.opts.room}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ pid: this.opts.pid, name: this.opts.name, state }) });
      if (!r.ok || this.disposed) return;
      type RS = typeof state;
      const others: { pid: string; name: string; state: RS }[] = await r.json();
      const seen = new Set<string>();
      let msIdx = 0;
      for (const o of others) {
        seen.add(o.pid);
        const s = o.state;
        let u = this.units.find((x) => x.remote && x.id === o.pid);
        if (!u) {
          u = this.makeUnit("plane", PLANES[s.plane] ?? PLANES[0], o.name, 100 + this.units.length, false, 0xd9a400);
          u.remote = true; u.id = o.pid;
          u.pos.set(s.x, s.y, s.z);
          u.net = { pos: V(), q: new THREE.Quaternion() };
          this.netLastDmg[o.pid] = s.dmg?.[this.opts.pid] ?? 0;
          this.netDeaths[o.pid] = s.deaths;
          this.addFeed(`👋 ${o.name} xonaga qo'shildi`);
        }
        u.net!.pos.set(s.x, s.y, s.z);
        u.net!.q.set(s.qx, s.qy, s.qz, s.qw);
        u.throttle = s.th; u.speed = s.sp; u.hp = s.hp; u.kills = s.kills;
        if (u.alive && !s.alive) { this.explode(u.pos, 1.6); }
        if (!u.alive && s.alive) u.pos.set(s.x, s.y, s.z);
        u.alive = s.alive; u.mesh.visible = s.alive;
        const total = s.dmg?.[this.opts.pid] ?? 0;
        const delta = total - (this.netLastDmg[o.pid] ?? 0);
        this.netLastDmg[o.pid] = total;
        if (delta > 0 && p.alive) this.damage(p, delta, u);
        if (s.deaths > (this.netDeaths[o.pid] ?? 0)) {
          if (s.killedBy === this.opts.pid) { p.kills++; this.score += 100; this.coins += 100; this.sfx.coin(); this.addFeed(`✈ ${p.name} ➜ ${o.name}  +100 🪙`); }
          this.netDeaths[o.pid] = s.deaths;
        }
        for (const m of s.ms || []) {
          let mm = this.remoteMs[msIdx];
          if (!mm) { mm = new THREE.Mesh(new THREE.SphereGeometry(1.2, 6, 4), new THREE.MeshBasicMaterial({ color: 0xff5533 })); this.scene.add(mm); this.remoteMs.push(mm); }
          mm.visible = true; mm.position.set(m[0], m[1], m[2]);
          this.smoke.spawn(mm.position, 0, 0, 0, 2, WHITE, 1);
          msIdx++;
        }
      }
      for (let i = msIdx; i < this.remoteMs.length; i++) this.remoteMs[i].visible = false;
      for (const u of this.units) if (u.remote && !seen.has(u.id)) { u.alive = false; u.mesh.visible = false; u.remote = false; u.respawn = 0; }
    } catch { /* offline */ } finally { this.netBusy = false; }
  }

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener("keydown", this.kd);
    window.removeEventListener("keyup", this.ku);
    window.removeEventListener("resize", this.resize);
    window.removeEventListener("blur", this.blur);
    this.sfx.dispose();
    this.scene.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
    });
    this.renderer.dispose();
  }
}
