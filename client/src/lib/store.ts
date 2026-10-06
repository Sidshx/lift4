import { useMemo, useSyncExternalStore } from "react";
import { ALL_EXERCISES, PLAN, todayISO, weekKey } from "@/data/plan";

/* ---------- Types ---------- */
export type SetRec = {
  id: string; // date|exerciseId|setIndex
  date: string;
  day: number;
  exerciseId: string;
  setIndex: number;
  weight: number;
  reps: number;
  ts: number;
  dirty?: boolean;
  deleted?: boolean;
};
export type SessionRec = {
  id: string; // date|day
  date: string;
  day: number;
  sets: number;
  volume: number;
  exercises: number;
  finishedAt: number;
  dirty?: boolean;
  deleted?: boolean;
};
export type BwRec = { id: string; date: string; kg: number; ts: number; dirty?: boolean; deleted?: boolean };
export type FitbitDay = { date: string; sleep: string; deep: string; score: string; hrv: string; rhr: string; steps: string; readiness: string; tip: string };
export type SyncStatus = "off" | "synced" | "pending" | "syncing" | "offline" | "error";

type State = {
  sets: SetRec[];
  sessions: SessionRec[];
  bodyweights: BwRec[];
  syncUrl: string;
  sheetUrl: string;
  fitbit: FitbitDay[];
  lastSync: number | null;
  status: SyncStatus;
  lastError: string;
};

const KEY = "lift4:v1";

/* ---------- Persistence (device storage, falls back to memory) ---------- */
function getStorage(): Storage | null {
  try {
    const s = window.localStorage;
    s.setItem("lift4:probe", "1");
    s.removeItem("lift4:probe");
    return s;
  } catch {
    return null;
  }
}
const storage = typeof window !== "undefined" ? getStorage() : null;
export const persistent = !!storage;

function load(): State {
  const base: State = { sets: [], sessions: [], bodyweights: [], syncUrl: "", sheetUrl: "", fitbit: [], lastSync: null, status: "off", lastError: "" };
  try {
    const raw = storage?.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw);
      return { ...base, ...p, status: p.syncUrl ? "pending" : "off", lastError: "" };
    }
  } catch {}
  return base;
}

let state: State = load();
const listeners = new Set<() => void>();

function save() {
  try {
    const { status, lastError, ...rest } = state;
    storage?.setItem(KEY, JSON.stringify(rest));
  } catch {}
}

function set(patch: Partial<State>, persist = true, notifyChange = persist) {
  state = { ...state, ...patch };
  if (persist) save();
  listeners.forEach((l) => l());
  if (notifyChange) onChange?.();
}

let onChange: (() => void) | null = null;
export function setChangeHandler(fn: () => void) {
  onChange = fn;
}

export function getState() {
  return state;
}
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => { listeners.delete(l); };
};
export function useStore<T>(sel: (s: State) => T): T {
  const snap = useSyncExternalStore(subscribe, () => state);
  return useMemo(() => sel(snap), [snap, sel]);
}

/* ---------- Selectors ---------- */
export const liveSets = (s: State) => s.sets.filter((x) => !x.deleted);
export const liveSessions = (s: State) => s.sessions.filter((x) => !x.deleted);
export const liveBw = (s: State) => s.bodyweights.filter((x) => !x.deleted).sort((a, b) => a.date.localeCompare(b.date));

/* ---------- Actions ---------- */
export function logSet(r: Omit<SetRec, "id" | "ts" | "dirty" | "deleted">) {
  const id = `${r.date}|${r.exerciseId}|${r.setIndex}`;
  const rec: SetRec = { ...r, id, ts: Date.now(), dirty: true };
  set({ sets: [...state.sets.filter((s) => s.id !== id), rec] });
}

export function logSets(rs: Omit<SetRec, "id" | "ts" | "dirty" | "deleted">[]) {
  const now = Date.now();
  const recs = rs.map((r) => ({ ...r, id: `${r.date}|${r.exerciseId}|${r.setIndex}`, ts: now, dirty: true }));
  const ids = new Set(recs.map((r) => r.id));
  set({ sets: [...state.sets.filter((s) => !ids.has(s.id)), ...recs] });
}

export function unlogSet(id: string) {
  set({ sets: state.sets.map((s) => (s.id === id ? { ...s, deleted: true, dirty: true, ts: Date.now() } : s)) });
}

export function finishSession(date: string, day: number) {
  const plan = PLAN.find((d) => d.n === day)!;
  const ids = [...plan.main, plan.finisher].map((e) => e.id);
  const sets = state.sets.filter((s) => !s.deleted && s.date === date && ids.includes(s.exerciseId));
  const exercises = new Set(sets.map((s) => s.exerciseId)).size;
  const volume = Math.round(sets.reduce((a, s) => a + s.weight * s.reps, 0));
  const id = `${date}|${day}`;
  const rec: SessionRec = { id, date, day, sets: sets.length, volume, exercises, finishedAt: Date.now(), dirty: true };
  set({ sessions: [...state.sessions.filter((s) => s.id !== id), rec] });
  return rec;
}

export function reopenSession(id: string) {
  set({ sessions: state.sessions.map((s) => (s.id === id ? { ...s, deleted: true, dirty: true, finishedAt: Date.now() } : s)) });
}

export function logBodyweight(kg: number, date = todayISO()) {
  const rec: BwRec = { id: date, date, kg, ts: Date.now(), dirty: true };
  set({ bodyweights: [...state.bodyweights.filter((b) => b.id !== date), rec] });
}

export function setSyncUrl(url: string) {
  // mark everything dirty so a new sheet gets a full copy
  set({
    syncUrl: url.trim(),
    status: url.trim() ? "pending" : "off",
    sets: state.sets.map((s) => ({ ...s, dirty: true })),
    sessions: state.sessions.map((s) => ({ ...s, dirty: true })),
    bodyweights: state.bodyweights.map((b) => ({ ...b, dirty: true })),
  });
}

export function setFitbit(fitbit: FitbitDay[]) {
  set({ fitbit }, true, false);
}

export function setSheetUrl(sheetUrl: string) {
  set({ sheetUrl }, true, false);
}

export function setStatus(status: SyncStatus, lastError = "") {
  set({ status, lastError }, false);
}

export function markSynced(sent: { sets: Set<string>; sessions: Set<string>; bw: Set<string> }, snapshot: { sets: Map<string, number>; sessions: Map<string, number>; bw: Map<string, number> }) {
  // Only clear dirty if the record wasn't changed again while the request was in flight.
  const clear = <T extends { id: string; dirty?: boolean; deleted?: boolean }>(arr: T[], ids: Set<string>, snap: Map<string, number>, ver: (x: T) => number) =>
    arr
      .filter((x) => !(x.deleted && ids.has(x.id) && snap.get(x.id) === ver(x)))
      .map((x) => (ids.has(x.id) && snap.get(x.id) === ver(x) ? { ...x, dirty: false } : x));
  set(
    {
      sets: clear(state.sets, sent.sets, snapshot.sets, (x) => x.ts + (x.deleted ? 1 : 0)),
      sessions: clear(state.sessions, sent.sessions, snapshot.sessions, (x) => x.finishedAt + (x.deleted ? 1 : 0)),
      bodyweights: clear(state.bodyweights, sent.bw, snapshot.bw, (x) => (x.ts ?? 0) + (x.deleted ? 1 : 0)),
      lastSync: Date.now(),
      status: "synced",
      lastError: "",
    },
    true,
    false,
  );
}

export function pendingCount(s: State = state) {
  return s.sets.filter((x) => x.dirty).length + s.sessions.filter((x) => x.dirty).length + s.bodyweights.filter((x) => x.dirty).length;
}

/* ---------- Backup ---------- */
export function exportJSON() {
  const { status, lastError, syncUrl, ...rest } = state;
  return JSON.stringify(rest, null, 2);
}
export function importJSON(text: string) {
  const p = JSON.parse(text);
  set({
    sets: (p.sets ?? []).map((x: SetRec) => ({ ...x, dirty: true })),
    sessions: (p.sessions ?? []).map((x: SessionRec) => ({ ...x, dirty: true })),
    bodyweights: (p.bodyweights ?? []).map((x: BwRec) => ({ ...x, dirty: true })),
  });
}

/* ---------- Derived helpers ---------- */
const EX = new Map(ALL_EXERCISES.map((e) => [e.id, e]));
export const exInfo = (id: string) => EX.get(id);

/** Most recent previous-week session for an exercise (falls back to any earlier day). */
export function previousFor(sets: SetRec[], exId: string, today: string) {
  const wk = weekKey(today);
  const earlier = sets.filter((s) => s.exerciseId === exId && s.date < today);
  if (!earlier.length) return null;
  const prevWeek = earlier.filter((s) => weekKey(s.date) < wk);
  const pool = prevWeek.length ? prevWeek : earlier;
  const date = pool.reduce((a, s) => (s.date > a ? s.date : a), pool[0].date);
  const list = pool.filter((s) => s.date === date).sort((a, b) => a.setIndex - b.setIndex);
  const top = list.reduce((a, s) => (s.weight > a.weight || (s.weight === a.weight && s.reps > a.reps) ? s : a), list[0]);
  return { date, sets: list, top, lastWeek: prevWeek.length > 0 };
}
