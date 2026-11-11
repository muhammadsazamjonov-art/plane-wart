export type Settings = {
  fps: number; // 20,60,120,240,0=unlimited
  quality: "1K" | "HD" | "2K" | "4K";
  control: "easy" | "pro";
  touchButtons: boolean;
  sensitivity: number;
  invertY: boolean;
  sound: boolean;
  shake: boolean;
};

export type LocalScore = { name: string; score: number; mode: string; map: string; date: number };

export type Save = {
  coins: number;
  owned: number[];
  selected: number;
  name: string;
  settings: Settings;
  scores: LocalScore[];
};

const KEY = "skyace-save-v1";

export const defaultSave = (): Save => ({
  coins: 500,
  owned: [0, 1, 2],
  selected: 0,
  name: "Pilot" + Math.floor(Math.random() * 900 + 100),
  settings: { fps: 60, quality: "HD", control: "easy", touchButtons: true, sensitivity: 1, invertY: false, sound: true, shake: true },
  scores: [],
});

export function loadSave(): Save {
  if (typeof window === "undefined") return defaultSave();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultSave();
    const d = defaultSave();
    const s = JSON.parse(raw);
    return { ...d, ...s, settings: { ...d.settings, ...(s.settings || {}) } };
  } catch {
    return defaultSave();
  }
}

export function writeSave(s: Save) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(s));
}
