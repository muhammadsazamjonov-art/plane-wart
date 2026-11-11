"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { EndInfo, Game, Hud, Mode } from "@/game/engine";
import { PLANES } from "@/game/planes";
import { MAPS } from "@/game/maps";
import { Save, defaultSave, loadSave, writeSave, Settings } from "@/game/store";
import PlanePreview from "./PlanePreview";

type Screen = "menu" | "shop" | "settings" | "multi" | "scores" | "play";
type GScore = { id: number; name: string; score: number; mode: string; map: string };

const MODES: { id: Mode; title: string; desc: string; icon: string }[] = [
  { id: "survival", title: "Omon qolish", desc: "To'lqinlar + SAM raketalar", icon: "🎯" },
  { id: "arena", title: "Arena 26 AI", desc: "Hamma hammaga qarshi, 4 daqiqa", icon: "🏟️" },
  { id: "defense", title: "Baza himoyasi", desc: "Suv osti kemalari & bombardimonchilar", icon: "🛡️" },
  { id: "multi", title: "Multiplayer", desc: "Xona yaratib do'stlar bilan", icon: "🌐" },
];

function Btn({ children, onClick, className = "", disabled }: { children: React.ReactNode; onClick?: () => void; className?: string; disabled?: boolean }) {
  return (
    <button disabled={disabled} onClick={onClick} className={`rounded-xl px-4 py-2 font-bold uppercase tracking-wide transition active:scale-95 disabled:opacity-40 ${className || "bg-cyan-400 text-slate-950 hover:bg-cyan-300 shadow-[0_0_20px_rgba(34,211,238,0.4)]"}`}>
      {children}
    </button>
  );
}

export default function GameApp({ initialMode, autostart }: { initialMode?: Mode; autostart?: boolean }) {
  const [save, setSave] = useState<Save>(defaultSave);
  const [loaded, setLoaded] = useState(false);
  const [screen, setScreen] = useState<Screen>("menu");
  const [mode, setMode] = useState<Mode>(initialMode ?? "survival");
  const [mapId, setMapId] = useState(0);
  const [vehicle, setVehicle] = useState<"plane" | "sub">("plane");
  const [room, setRoom] = useState("");
  const [hud, setHud] = useState<Hud | null>(null);
  const [paused, setPaused] = useState(false);
  const [end, setEnd] = useState<EndInfo | null>(null);
  const [runId, setRunId] = useState(0);
  const [gscores, setGscores] = useState<GScore[]>([]);
  const [installEvt, setInstallEvt] = useState<(Event & { prompt: () => void }) | null>(null);
  const [isTouch, setIsTouch] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const lockRef = useRef<HTMLDivElement>(null);
  const miniRef = useRef<HTMLCanvasElement>(null);
  const hitRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Game | null>(null);
  const pidRef = useRef("");
  const saveRef = useRef(save);
  saveRef.current = save;

  const update = useCallback((f: (s: Save) => Save) => {
    setSave((s) => { const n = f(s); writeSave(n); return n; });
  }, []);

  useEffect(() => {
    const s = loadSave();
    setSave(s);
    setLoaded(true);
    pidRef.current = Math.random().toString(36).slice(2, 12);
    setIsTouch("ontouchstart" in window || matchMedia("(pointer: coarse)").matches);
    const params = new URLSearchParams(location.search);
    const r = params.get("room");
    if (r) { setRoom(r.toUpperCase()); setMode("multi"); setScreen("multi"); }
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
    const h = (e: Event) => { e.preventDefault(); setInstallEvt(e as Event & { prompt: () => void }); };
    window.addEventListener("beforeinstallprompt", h);
    return () => window.removeEventListener("beforeinstallprompt", h);
  }, []);

  const loadScores = useCallback(() => {
    fetch("/api/scores").then((r) => r.json()).then(setGscores).catch(() => {});
  }, []);
  useEffect(() => { loadScores(); }, [loadScores]);

  const start = useCallback((m: Mode = mode, roomCode = room, map = mapId) => {
    setMode(m); setMapId(map); setRoom(roomCode);
    setEnd(null); setPaused(false); setHud(null);
    setScreen("play");
    setRunId((x) => x + 1);
  }, [mode, room, mapId]);

  // autostart for /arena
  const auto = useRef(false);
  useEffect(() => {
    if (loaded && autostart && !auto.current) { auto.current = true; start(initialMode ?? "arena", "", mapId); }
  }, [loaded, autostart, initialMode, start, mapId]);

  // create/destroy game
  useEffect(() => {
    if (screen !== "play" || !canvasRef.current) return;
    let g: Game | null = null;
    let cancelled = false;
    import("@/game/engine").then(({ Game }) => {
      if (cancelled || !canvasRef.current) return;
      const s = saveRef.current;
      g = new Game(canvasRef.current, {
        mode, mapId, planeId: s.owned.includes(s.selected) ? s.selected : 0, vehicle, settings: s.settings, name: s.name, room, pid: pidRef.current,
      }, {
        onHud: setHud,
        onPause: setPaused,
        onEnd: (e) => {
          setEnd(e);
          const entry = { name: saveRef.current.name, score: e.score, mode, map: MAPS[mapId].name, date: Date.now() };
          update((sv) => ({ ...sv, coins: sv.coins + e.coins, scores: [...sv.scores, entry].sort((a, b) => b.score - a.score).slice(0, 10) }));
          if (g) g.coins = 0;
          if (e.score > 0) fetch("/api/scores", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(entry) }).then(loadScores).catch(() => {});
        },
      });
      g.els = { lock: lockRef.current, minimap: miniRef.current, hit: hitRef.current };
      gameRef.current = g;
    });
    return () => {
      cancelled = true;
      if (g) {
        if (g.coins > 0) { const c = g.coins; update((sv) => ({ ...sv, coins: sv.coins + c })); }
        g.dispose();
      }
      gameRef.current = null;
    };
  }, [screen, runId, mode, mapId, vehicle, room, update, loadScores]);

  // R to restart, M menu
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (screen !== "play") return;
      if (e.code === "KeyR" && (end || paused)) start();
      if (e.code === "KeyM" && (end || paused)) setScreen("menu");
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [screen, end, paused, start]);

  const setSetting = <K extends keyof Settings>(k: K, v: Settings[K]) => update((s) => ({ ...s, settings: { ...s.settings, [k]: v } }));
  const plane = PLANES[save.selected] ?? PLANES[0];

  if (screen === "play") {
    const showTouch = save.settings.touchButtons && isTouch;
    return (
      <div className="fixed inset-0 select-none overflow-hidden bg-black text-white touch-none">
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
        <div ref={hitRef} className="pointer-events-none absolute inset-0 bg-red-600 opacity-0 transition-opacity duration-150" />
        <div className="pointer-events-none absolute inset-0">
          <div ref={lockRef} className="absolute left-0 top-0 hidden h-12 w-12 rounded border-2 border-yellow-300" />
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-2xl text-cyan-200/80">⊕</div>
          <div data-hitmark className="absolute left-1/2 top-1/2 text-3xl font-black text-red-400 opacity-0 transition-all" style={{ transform: "translate(-50%,-50%)" }}>✕</div>
        </div>
        {hud && <HudView hud={hud} mode={mode} plane={plane.name} />}
        <canvas ref={miniRef} width={150} height={150} className="pointer-events-none absolute right-3 top-3 h-[110px] w-[110px] sm:h-[150px] sm:w-[150px]" />
        <button onClick={() => gameRef.current?.setPaused(true)} className="absolute left-1/2 top-2 -translate-x-1/2 rounded-full bg-black/40 px-4 py-1 text-lg backdrop-blur">⏸</button>
        {showTouch && !end && <TouchControls gameRef={gameRef} />}
        {paused && !end && (
          <Overlay>
            <h2 className="text-5xl font-black text-cyan-300">PAUZA</h2>
            <div className="flex flex-col gap-3">
              <Btn onClick={() => gameRef.current?.setPaused(false)}>▶ Davom etish</Btn>
              <Btn onClick={() => start()} className="bg-amber-400 text-black">↻ Qayta boshlash (R)</Btn>
              <Btn onClick={() => setScreen("menu")} className="bg-slate-700 text-white">☰ Menyu (M)</Btn>
            </div>
            <Controls />
          </Overlay>
        )}
        {end && (
          <Overlay transparent={end.type === "arena"}>
            {end.type === "arena" ? (
              <>
                <div className="text-6xl">🏆</div>
                <h2 className="text-4xl font-black text-yellow-300 drop-shadow">{end.winner} G&apos;OLIB!</h2>
                <p className="text-cyan-200">{end.winnerPlane} osmonda zafar parvozida ✈</p>
                <div className="w-full max-w-sm rounded-xl bg-black/50 p-3 text-left text-sm">
                  {end.ranking.slice(0, 8).map((r, i) => (
                    <div key={i} className={`flex justify-between ${r.me ? "font-bold text-yellow-300" : ""}`}><span>{i + 1}. {r.name} <span className="opacity-60">({r.plane})</span></span><span>{r.kills} kill</span></div>
                  ))}
                </div>
              </>
            ) : (
              <>
                <h2 className="text-5xl font-black text-red-400">O&apos;YIN TUGADI</h2>
                <p className="text-slate-300">{end.reason}</p>
              </>
            )}
            <div className="text-2xl font-bold">Ochko: <span className="text-cyan-300">{end.score}</span> • Kill: {end.kills} • <span className="text-yellow-300">+{end.coins} 🪙</span></div>
            {save.scores[0] && end.score >= save.scores[0].score && end.score > 0 && <div className="animate-pulse text-xl font-black text-yellow-300">★ YANGI REKORD! ★</div>}
            <div className="flex gap-3">
              <Btn onClick={() => start()}>↻ Qayta (R)</Btn>
              <Btn onClick={() => setScreen("shop")} className="bg-yellow-400 text-black">🛒 Do&apos;kon</Btn>
              <Btn onClick={() => setScreen("menu")} className="bg-slate-700 text-white">☰ Menyu</Btn>
            </div>
          </Overlay>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,#0e3a5c,#050b18_70%)] text-white">
      <div className="mx-auto max-w-6xl px-4 py-6">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div onClick={() => setScreen("menu")} className="cursor-pointer">
            <h1 className="bg-gradient-to-r from-cyan-300 via-sky-400 to-yellow-300 bg-clip-text text-4xl font-black italic tracking-tight text-transparent sm:text-5xl">SKY ACE 3D</h1>
            <p className="text-xs uppercase tracking-[0.3em] text-cyan-200/70">Havo jangi • 8 xarita • {PLANES.length} samolyot</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-yellow-400/15 px-4 py-2 font-bold text-yellow-300">🪙 {save.coins}</span>
            {installEvt && <Btn onClick={() => installEvt.prompt()} className="bg-emerald-400 text-black">📲 O&apos;rnatish</Btn>}
            {(["menu", "shop", "scores", "settings"] as Screen[]).map((s) => (
              <button key={s} onClick={() => setScreen(s)} className={`rounded-lg px-3 py-2 text-sm font-semibold ${screen === s ? "bg-cyan-400 text-black" : "bg-white/10 hover:bg-white/20"}`}>
                {{ menu: "🏠 Bosh", shop: "🛒 Do'kon", scores: "🏆 Rekordlar", settings: "⚙ Sozlamalar", multi: "", play: "" }[s]}
              </button>
            ))}
          </div>
        </header>

        {screen === "menu" && (
          <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
            <div className="space-y-6">
              <section>
                <h2 className="mb-2 text-sm font-bold uppercase tracking-widest text-cyan-300">1. Rejim</h2>
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                  {MODES.map((m) => (
                    <button key={m.id} onClick={() => { setMode(m.id); if (m.id === "multi") setScreen("multi"); }} className={`rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 ${mode === m.id ? "border-cyan-300 bg-cyan-400/20 shadow-[0_0_25px_rgba(34,211,238,0.3)]" : "border-white/10 bg-white/5"}`}>
                      <div className="text-3xl">{m.icon}</div>
                      <div className="mt-1 font-bold">{m.title}</div>
                      <div className="text-xs text-slate-300">{m.desc}</div>
                    </button>
                  ))}
                </div>
                {mode === "defense" && (
                  <div className="mt-3 flex items-center gap-2 text-sm">
                    <span className="text-slate-300">Transport:</span>
                    {(["plane", "sub"] as const).map((v) => (
                      <button key={v} onClick={() => setVehicle(v)} className={`rounded-lg px-3 py-1 ${vehicle === v ? "bg-cyan-400 text-black" : "bg-white/10"}`}>{v === "plane" ? "✈ Samolyot" : "🚢 Suv osti kemasi"}</button>
                    ))}
                    {vehicle === "sub" && <span className="text-xs text-amber-300">Suvli xaritalar: Muz Fyordi, Vulqon Oroli, Okean Bazasi</span>}
                  </div>
                )}
              </section>
              <MapPicker mapId={mapId} setMapId={setMapId} />
            </div>
            <aside className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4">
              <label className="text-xs uppercase tracking-widest text-cyan-300">Uchuvchi ismi</label>
              <input value={save.name} maxLength={16} onChange={(e) => update((s) => ({ ...s, name: e.target.value }))} className="w-full rounded-lg bg-black/40 px-3 py-2 outline-none ring-cyan-400 focus:ring-2" />
              <PlanePreview planeId={save.selected} className="h-44 w-full" />
              <div className="text-center">
                <div className="text-lg font-bold">{plane.name}</div>
                <div className="text-xs text-slate-400">{plane.country} • {plane.type}</div>
              </div>
              <Stats p={plane} />
              <Btn onClick={() => setScreen("shop")} className="w-full bg-white/10 text-white">Samolyot almashtirish</Btn>
              <Btn onClick={() => (mode === "multi" ? setScreen("multi") : start())} className="w-full bg-gradient-to-r from-cyan-400 to-sky-500 py-4 text-xl text-black shadow-[0_0_30px_rgba(34,211,238,0.5)]">▶ PARVOZ!</Btn>
              <Controls />
            </aside>
          </div>
        )}

        {screen === "shop" && <Shop save={save} update={update} />}
        {screen === "settings" && <SettingsView s={save.settings} set={setSetting} />}
        {screen === "multi" && <Lobby mapId={mapId} setMapId={setMapId} name={save.name} room={room} setRoom={setRoom} onStart={(code, map) => start("multi", code, map)} />}
        {screen === "scores" && (
          <div className="grid gap-6 md:grid-cols-2">
            <ScoreTable title="Mahalliy rekordlar" rows={save.scores.map((s, i) => ({ id: i, ...s }))} />
            <ScoreTable title="Global reyting" rows={gscores} />
          </div>
        )}
      </div>
    </div>
  );
}

function Overlay({ children, transparent }: { children: React.ReactNode; transparent?: boolean }) {
  return (
    <div className={`absolute inset-0 z-30 flex flex-col items-center justify-center gap-4 overflow-auto p-4 text-center ${transparent ? "bg-gradient-to-b from-black/10 via-transparent to-black/70" : "bg-slate-950/80 backdrop-blur-sm"}`}>
      {children}
    </div>
  );
}

function Controls() {
  return (
    <div className="rounded-xl bg-black/30 p-3 text-left text-xs leading-5 text-slate-300">
      <b className="text-cyan-300">Boshqaruv:</b> W gaz • S tormoz • Shift forsaj<br />
      ←/→ yoki A/D burilish • ↑/↓ burun • Q/E rul<br />
      Space o&apos;q • F raketa (qulflanib) • X issiqlik nishonlari<br />
      P/Esc pauza • R qayta • Yerdan: gaz bering, ↑ bilan ko&apos;tariling
    </div>
  );
}

function Stats({ p }: { p: (typeof PLANES)[number] }) {
  const row = (l: string, v: number, max: number) => (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-16 text-slate-400">{l}</span>
      <div className="h-2 flex-1 rounded bg-white/10"><div className="h-2 rounded bg-gradient-to-r from-cyan-400 to-yellow-300" style={{ width: `${Math.min(100, (v / max) * 100)}%` }} /></div>
    </div>
  );
  return (
    <div className="space-y-1">
      {row("Tezlik", p.speed, 300)}
      {row("Manevr", p.turn, 1.4)}
      {row("Zirh", p.hp, 400)}
      {row("Qurol", p.gun, 16)}
      {row("Raketa", p.missiles, 22)}
    </div>
  );
}

function MapPicker({ mapId, setMapId }: { mapId: number; setMapId: (n: number) => void }) {
  return (
    <section>
      <h2 className="mb-2 text-sm font-bold uppercase tracking-widest text-cyan-300">2. Xarita (4 kichik • 4 katta)</h2>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {MAPS.map((m) => {
          const hex = (n: number) => "#" + n.toString(16).padStart(6, "0");
          return (
            <button key={m.id} onClick={() => setMapId(m.id)} className={`overflow-hidden rounded-2xl border text-left transition hover:-translate-y-0.5 ${mapId === m.id ? "border-cyan-300 ring-2 ring-cyan-300" : "border-white/10"}`}>
              <div className="relative h-20" style={{ background: `linear-gradient(180deg, ${hex(m.sky)} 0%, ${hex(m.fog)} 45%, ${hex(m.high)} 55%, ${hex(m.low)} 100%)` }}>
                <span className={`absolute right-2 top-2 rounded px-2 text-[10px] font-bold ${m.small ? "bg-emerald-400 text-black" : "bg-orange-500"}`}>{m.small ? "KICHIK" : "KATTA"}</span>
              </div>
              <div className="bg-black/40 p-2">
                <div className="font-bold">{m.name}</div>
                <div className="text-[11px] text-slate-300">{m.desc}</div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function Shop({ save, update }: { save: Save; update: (f: (s: Save) => Save) => void }) {
  const [sel, setSel] = useState(save.selected);
  const [filter, setFilter] = useState("all");
  const p = PLANES[sel];
  const owned = save.owned.includes(sel);
  const list = PLANES.filter((x) => filter === "all" || (filter === "owned" ? save.owned.includes(x.id) : x.type === filter));
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div>
        <div className="mb-3 flex flex-wrap gap-2">
          {["all", "owned", "prop", "swept", "delta", "canard", "stealth", "bomber", "flying"].map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={`rounded-full px-3 py-1 text-xs font-bold uppercase ${filter === f ? "bg-cyan-400 text-black" : "bg-white/10"}`}>{f === "all" ? `Hammasi (${PLANES.length})` : f === "owned" ? "Meniki" : f}</button>
          ))}
        </div>
        <div className="grid max-h-[70vh] grid-cols-2 gap-2 overflow-auto pr-1 sm:grid-cols-3 md:grid-cols-4">
          {list.map((x) => {
            const o = save.owned.includes(x.id);
            return (
              <button key={x.id} onClick={() => setSel(x.id)} className={`rounded-xl border p-2 text-left text-xs transition ${sel === x.id ? "border-cyan-300 bg-cyan-400/20" : "border-white/10 bg-white/5 hover:bg-white/10"}`}>
                <div className="flex items-center justify-between"><span className="text-lg">{x.type === "prop" ? "🛩️" : x.type === "bomber" || x.type === "flying" ? "🛫" : "✈️"}</span>{save.selected === x.id && <span className="text-emerald-300">✔</span>}</div>
                <div className="truncate font-bold">{x.name}</div>
                <div className="text-slate-400">{x.country}</div>
                <div className={o ? "text-emerald-300" : "text-yellow-300"}>{o ? "Sizda bor" : `🪙 ${x.price}`}</div>
              </button>
            );
          })}
        </div>
      </div>
      <aside className="space-y-3 rounded-2xl border border-white/10 bg-white/5 p-4">
        <PlanePreview planeId={sel} className="h-56 w-full" />
        <div className="text-center"><div className="text-xl font-black">{p.name}</div><div className="text-xs text-slate-400">{p.country} • {p.type} {p.twinEngine ? "• 2 dvigatel" : ""}</div></div>
        <Stats p={p} />
        <div className="grid grid-cols-3 gap-1 text-center text-xs text-slate-300">
          <div>{Math.round(p.speed * 3.6)} km/s</div><div>{p.hp} HP</div><div>{p.missiles} raketa</div>
        </div>
        {owned ? (
          <Btn onClick={() => update((s) => ({ ...s, selected: sel }))} className="w-full" disabled={save.selected === sel}>{save.selected === sel ? "Tanlangan" : "Tanlash"}</Btn>
        ) : (
          <Btn disabled={save.coins < p.price} onClick={() => update((s) => ({ ...s, coins: s.coins - p.price, owned: [...s.owned, sel], selected: sel }))} className="w-full bg-yellow-400 text-black">Sotib olish 🪙 {p.price}</Btn>
        )}
        <p className="text-center text-xs text-slate-400">Har bir kill = 100 🪙 • Arena g&apos;olibi = +1000 🪙</p>
      </aside>
    </div>
  );
}

function SettingsView({ s, set }: { s: Settings; set: <K extends keyof Settings>(k: K, v: Settings[K]) => void }) {
  const Opt = <K extends keyof Settings>({ k, label, opts }: { k: K; label: string; opts: [Settings[K], string][] }) => (
    <div className="rounded-xl bg-white/5 p-4">
      <div className="mb-2 text-sm font-bold text-cyan-300">{label}</div>
      <div className="flex flex-wrap gap-2">
        {opts.map(([v, l]) => (
          <button key={String(v)} onClick={() => set(k, v)} className={`rounded-lg px-3 py-2 text-sm font-bold ${s[k] === v ? "bg-cyan-400 text-black" : "bg-white/10"}`}>{l}</button>
        ))}
      </div>
    </div>
  );
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Opt k="fps" label="FPS chegarasi" opts={[[20, "20"], [60, "60"], [120, "120"], [240, "240"], [0, "Cheksiz"]]} />
      <Opt k="quality" label="Grafika sifati" opts={[["1K", "1K (tez)"], ["HD", "HD"], ["2K", "2K + soya"], ["4K", "4K Ultra"]]} />
      <Opt k="control" label="Boshqaruv turi" opts={[["easy", "🟢 Oson (avto-muvozanat)"], ["pro", "🔴 Pro (to'liq)"]]} />
      <Opt k="touchButtons" label="Ekrandagi tugmalar (telefon)" opts={[[true, "Yoqilgan"], [false, "O'chirilgan"]]} />
      <Opt k="sensitivity" label="Sezgirlik" opts={[[0.6, "Past"], [1, "O'rta"], [1.4, "Yuqori"]]} />
      <Opt k="invertY" label="Y o'qini teskari" opts={[[false, "Yo'q"], [true, "Ha (sim)"]]} />
      <Opt k="sound" label="Ovoz" opts={[[true, "🔊 Yoqilgan"], [false, "🔇 O'chirilgan"]]} />
      <Opt k="shake" label="Ekran silkinishi" opts={[[true, "Yoqilgan"], [false, "O'chirilgan"]]} />
    </div>
  );
}

function Lobby({ mapId, setMapId, name, room, setRoom, onStart }: { mapId: number; setMapId: (n: number) => void; name: string; room: string; setRoom: (s: string) => void; onStart: (code: string, map: number) => void }) {
  const [err, setErr] = useState("");
  const [rooms, setRooms] = useState<{ code: string; map: string; host: string }[]>([]);
  const [created, setCreated] = useState("");
  useEffect(() => { fetch("/api/rooms").then((r) => r.json()).then(setRooms).catch(() => {}); }, []);
  const create = async () => {
    const r = await fetch("/api/rooms", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ map: String(mapId), name }) });
    const d = await r.json();
    setCreated(d.code); setRoom(d.code);
  };
  const join = async (code: string) => {
    setErr("");
    const r = await fetch(`/api/rooms/${code}`);
    if (!r.ok) { setErr("Xona topilmadi"); return; }
    const d = await r.json();
    onStart(d.code, Number(d.map) || 0);
  };
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl bg-white/5 p-5">
          <h3 className="mb-2 text-xl font-black text-cyan-300">🏗 Xona yaratish</h3>
          <p className="mb-3 text-sm text-slate-300">Xaritani pastdan tanlang, so&apos;ng kodni do&apos;stlaringizga yuboring.</p>
          {created ? (
            <div className="space-y-3">
              <div className="text-5xl font-black tracking-[0.3em] text-yellow-300">{created}</div>
              <button onClick={() => navigator.clipboard?.writeText(`${location.origin}/?room=${created}`)} className="text-sm text-cyan-300 underline">🔗 Havolani nusxalash</button>
              <Btn onClick={() => onStart(created, mapId)} className="w-full bg-emerald-400 text-black">▶ Xonaga kirish</Btn>
            </div>
          ) : <Btn onClick={create}>Xona yaratish ({MAPS[mapId].name})</Btn>}
        </div>
        <div className="rounded-2xl bg-white/5 p-5">
          <h3 className="mb-2 text-xl font-black text-cyan-300">🔑 Xonaga qo&apos;shilish</h3>
          <div className="flex gap-2">
            <input value={room} onChange={(e) => setRoom(e.target.value.toUpperCase())} placeholder="KOD" maxLength={6} className="w-full rounded-lg bg-black/40 px-3 py-2 text-2xl font-bold tracking-widest outline-none" />
            <Btn onClick={() => join(room)} disabled={room.length < 4}>Kirish</Btn>
          </div>
          {err && <p className="mt-2 text-red-400">{err}</p>}
          <div className="mt-4 space-y-1">
            <div className="text-xs uppercase text-slate-400">So&apos;nggi xonalar</div>
            {rooms.map((r) => (
              <button key={r.code} onClick={() => join(r.code)} className="flex w-full justify-between rounded-lg bg-black/30 px-3 py-2 text-sm hover:bg-black/50">
                <span className="font-bold text-yellow-300">{r.code}</span><span>{MAPS[Number(r.map)]?.name}</span><span className="text-slate-400">{r.host}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
      <MapPicker mapId={mapId} setMapId={setMapId} />
    </div>
  );
}

function ScoreTable({ title, rows }: { title: string; rows: { id: number; name: string; score: number; mode: string; map: string }[] }) {
  return (
    <div className="rounded-2xl bg-white/5 p-5">
      <h3 className="mb-3 text-xl font-black text-cyan-300">{title}</h3>
      {rows.length === 0 && <p className="text-slate-400">Hali rekord yo&apos;q — birinchi bo&apos;ling!</p>}
      {rows.slice(0, 10).map((r, i) => (
        <div key={r.id + "-" + i} className="flex items-center justify-between border-b border-white/5 py-2 text-sm">
          <span className="w-8 font-black text-yellow-300">{i + 1}</span>
          <span className="flex-1 font-bold">{r.name}</span>
          <span className="w-28 truncate text-xs text-slate-400">{r.mode} • {r.map}</span>
          <span className="w-16 text-right font-mono text-cyan-300">{r.score}</span>
        </div>
      ))}
    </div>
  );
}

function HudView({ hud, mode, plane }: { hud: Hud; mode: Mode; plane: string }) {
  const hpPct = (hud.hp / hud.maxHp) * 100;
  return (
    <div className="pointer-events-none absolute inset-0 font-mono text-sm">
      <div className="absolute left-3 top-3 space-y-1 rounded-xl bg-black/35 p-3 backdrop-blur-sm">
        <div className="text-2xl font-black text-cyan-300">{hud.score.toLocaleString()}</div>
        <div>✈ Kill: <b>{hud.kills}</b> • <span className="text-yellow-300">+{hud.coins} 🪙</span></div>
        {mode === "arena" && <div className="text-amber-300">⏱ {Math.floor(hud.time / 60)}:{String(hud.time % 60).padStart(2, "0")}</div>}
        {(mode === "survival" || mode === "defense") && <div>🌊 To&apos;lqin {hud.wave}</div>}
        {mode === "defense" && (
          <>
            <div>❤ Hayot: {"♥".repeat(Math.max(0, hud.lives))}</div>
            <div className="w-36"><div className="text-xs">Baza {hud.baseHp}</div><div className="h-2 rounded bg-white/20"><div className="h-2 rounded bg-sky-400" style={{ width: `${hud.baseHp / 10}%` }} /></div></div>
          </>
        )}
        {mode === "multi" && <div>👥 {hud.players} o&apos;yinchi</div>}
        <div className="text-[10px] text-slate-400">{hud.fps} FPS • {plane}</div>
      </div>
      {hud.board.length > 0 && (
        <div className="absolute right-3 top-[125px] w-44 rounded-xl bg-black/35 p-2 text-xs backdrop-blur-sm sm:top-[165px]">
          {hud.board.map((b, i) => (
            <div key={i} className={`flex justify-between ${b.me ? "font-bold text-yellow-300" : ""}`}><span className="truncate">{i + 1}. {b.name}</span><span>{b.kills}</span></div>
          ))}
        </div>
      )}
      <div className="absolute left-1/2 top-12 w-[90%] max-w-md -translate-x-1/2 space-y-1 text-center">
        {hud.feed.map((f, i) => <div key={i} className="animate-[fadeIn_.3s] rounded bg-black/40 px-2 py-0.5 text-xs">{f}</div>)}
      </div>
      {hud.warning && <div className="absolute left-1/2 top-1/3 -translate-x-1/2 animate-pulse rounded-lg border-2 border-red-500 bg-red-600/40 px-6 py-2 text-2xl font-black text-white">⚠ RAKETA! X — issiqlik nishoni</div>}
      {hud.stall && <div className="absolute left-1/2 top-[40%] -translate-x-1/2 animate-pulse text-xl font-black text-orange-400">STALL — GAZ BERING!</div>}
      {hud.oob && <div className="absolute left-1/2 top-[45%] -translate-x-1/2 text-lg font-black text-amber-300">⟲ Xarita chegarasi — orqaga qayting</div>}
      {hud.hint && <div className="absolute bottom-40 left-1/2 -translate-x-1/2 animate-bounce rounded-full bg-cyan-500/80 px-5 py-2 text-base font-bold text-black">{hud.hint}</div>}
      {hud.dead && hud.respawnIn > 0 && <div className="absolute left-1/2 top-1/2 -translate-x-1/2 text-3xl font-black text-red-400">Qayta tug&apos;ilish: {hud.respawnIn}</div>}
      {hud.lock >= 1 && <div className="absolute left-1/2 top-[58%] -translate-x-1/2 font-black text-red-400">🔒 QULFLANDI — F</div>}
      <div className="absolute bottom-3 left-3 space-y-1 rounded-xl bg-black/35 p-3 backdrop-blur-sm max-sm:bottom-auto max-sm:top-[150px]">
        <div className="text-xl font-black">{hud.speed} <span className="text-xs">km/s</span></div>
        <div>ALT {hud.alt} m</div>
        <div className="flex items-center gap-1 text-xs">GAZ<div className="h-2 w-24 rounded bg-white/20"><div className={`h-2 rounded ${hud.boost ? "bg-orange-400" : "bg-emerald-400"}`} style={{ width: `${hud.throttle * 100}%` }} /></div></div>
      </div>
      <div className="absolute bottom-3 left-1/2 w-64 -translate-x-1/2 max-sm:bottom-auto max-sm:top-[calc(100%-40px)] max-sm:w-40">
        <div className="mb-1 flex justify-between text-xs"><span>🚀 {hud.missiles}</span><span>✨ {hud.flares}</span><span>{hud.hp} HP</span></div>
        <div className="h-3 rounded-full bg-white/20"><div className={`h-3 rounded-full transition-all ${hpPct > 50 ? "bg-emerald-400" : hpPct > 25 ? "bg-amber-400" : "bg-red-500"}`} style={{ width: `${hpPct}%` }} /></div>
      </div>
    </div>
  );
}

function TouchControls({ gameRef }: { gameRef: React.RefObject<Game | null> }) {
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const origin = useRef<{ x: number; y: number; id: number } | null>(null);
  const setT = (k: "gas" | "brake" | "fire" | "boost", v: boolean) => { const g = gameRef.current; if (g) g.touch[k] = v; };
  const hold = (k: "gas" | "brake" | "fire" | "boost", label: string, cls: string) => (
    <button
      onPointerDown={(e) => { e.preventDefault(); setT(k, true); }}
      onPointerUp={() => setT(k, false)} onPointerLeave={() => setT(k, false)} onPointerCancel={() => setT(k, false)}
      className={`flex h-16 w-16 items-center justify-center rounded-full text-xs font-black active:scale-90 ${cls}`}>{label}</button>
  );
  return (
    <>
      <div
        className="absolute bottom-6 left-6 h-40 w-40 rounded-full border-2 border-white/30 bg-white/10"
        onPointerDown={(e) => { (e.target as HTMLElement).setPointerCapture(e.pointerId); const r = e.currentTarget.getBoundingClientRect(); origin.current = { x: r.left + r.width / 2, y: r.top + r.height / 2, id: e.pointerId }; }}
        onPointerMove={(e) => {
          if (!origin.current) return;
          let dx = (e.clientX - origin.current.x) / 60, dy = (e.clientY - origin.current.y) / 60;
          const l = Math.hypot(dx, dy);
          if (l > 1) { dx /= l; dy /= l; }
          setKnob({ x: dx, y: dy });
          const g = gameRef.current; if (g) { g.touch.x = dx; g.touch.y = dy; }
        }}
        onPointerUp={() => { origin.current = null; setKnob({ x: 0, y: 0 }); const g = gameRef.current; if (g) { g.touch.x = 0; g.touch.y = 0; } }}
      >
        <div className="absolute left-1/2 top-1/2 h-16 w-16 rounded-full bg-cyan-300/60" style={{ transform: `translate(calc(-50% + ${knob.x * 50}px), calc(-50% + ${knob.y * 50}px))` }} />
      </div>
      <div className="absolute bottom-6 right-4 grid grid-cols-3 gap-2">
        {hold("brake", "TORMOZ", "bg-red-500/60")}
        {hold("gas", "GAZ", "bg-emerald-500/60")}
        {hold("boost", "FORSAJ", "bg-orange-500/60")}
        <button onPointerDown={() => { const g = gameRef.current; if (g) g.flareReq = true; }} className="h-16 w-16 rounded-full bg-yellow-400/60 text-xs font-black active:scale-90">FLARE</button>
        <button onPointerDown={() => { const g = gameRef.current; if (g) g.missileReq = true; }} className="h-16 w-16 rounded-full bg-sky-500/60 text-xs font-black active:scale-90">RAKETA</button>
        {hold("fire", "O'Q", "bg-rose-600/70")}
      </div>
    </>
  );
}
