import { PLAN, ALL_EXERCISES, KNOWN_EXERCISES, todayISO, weekKey, type Exercise, type Muscle } from "@/data/plan";
import type { FitbitDay, SetRec } from "@/lib/store";

/* ================= Fitbit readiness → decision ================= */
export type Mode = "push" | "hold" | "light" | "normal";
export type Readiness = { mode: Mode; level: string; fresh: boolean; date?: string; why: string; data?: FitbitDay };

export const MODE_TEXT: Record<Mode, { title: string; rule: string }> = {
  push: { title: "Green · Push day", rule: "Go for your targets. Weight goes up where you earned it." },
  hold: { title: "Yellow · Hold day", rule: "Same weights, match last time's reps. No weight jumps today." },
  light: { title: "Red · Go light", rule: "Same weights, 1 fewer set each, stop 1–2 reps before failure." },
  normal: { title: "No fresh Fitbit data", rule: "Targets use your normal plan. Train by feel." },
};

/** Only today's Fitbit row changes targets. Older data is shown but ignored. */
export function readiness(fitbit: FitbitDay[], date = todayISO()): Readiness {
  const row = [...fitbit].reverse().find((f) => f.readiness);
  const why = row?.tip?.includes("(") ? row.tip.split(" (")[1].replace(")", "") : "";
  if (!row || row.date !== date) return { mode: "normal", level: "", fresh: false, date: row?.date, why: "", data: row };
  const mode: Mode = row.readiness === "Green" ? "push" : row.readiness === "Yellow" ? "hold" : row.readiness === "Red" ? "light" : "normal";
  return { mode, level: row.readiness, fresh: true, date: row.date, why, data: row };
}

/* ================= Next-session targets ================= */
const DB_STEPS = [5, 8, 10, 12, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80];
export function nextWeight(e: Exercise, w: number) {
  if (e.gear === "DB" || e.gear === "Bench") return DB_STEPS.find((s) => s > w) ?? w + 5;
  return w < 20 ? w + 2.5 : w + 5; // cable stack / machine
}

/** All sets from the most recent earlier date this exercise (or its `from` predecessor) was done. */
export function lastSession(sets: SetRec[], exId: string, before: string, fromId?: string) {
  const own = sets.filter((s) => s.exerciseId === exId && s.date < before);
  const earlier = own.length ? own : fromId ? sets.filter((s) => s.exerciseId === fromId && s.date < before) : [];
  if (!earlier.length) return null;
  const date = earlier.reduce((a, s) => (s.date > a ? s.date : a), earlier[0].date);
  return { date, sets: earlier.filter((s) => s.date === date).sort((a, b) => a.setIndex - b.setIndex) };
}

export type Target = {
  weight: number; // 0 for bodyweight / timed
  reps: number;
  sets: number;
  headline: string; // "35 lb × 12"
  reason: string;
  up: boolean; // weight or reps going up
  first: boolean;
  last?: string; // "30×15 · 35×11 · 35×12"
};

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

export function targetFor(e: Exercise, sets: SetRec[], date: string, mode: Mode): Target {
  const [lo, hi] = e.reps;
  const prev = lastSession(sets, e.id, date, e.from);
  const nSets = mode === "light" ? Math.max(2, e.sets - 1) : e.sets;
  const lightNote = mode === "light" ? " Red day: 1 fewer set." : "";
  const sfx = e.timed ? "s" : "";
  if (!prev) {
    const reps = e.unit === "bw" && hi >= 20 ? lo : hi;
    return { weight: 0, reps, sets: nSets, headline: e.unit === "lb" ? `Start ${e.start}` : `${reps} reps`, reason: (e.timed ? `First time: pick a weight you can carry cleanly for ${lo}–${hi}s.` : "First time: pick a weight where the last 2 reps feel hard.") + lightNote, up: false, first: true };
  }
  const last = prev.sets.map((s) => (e.unit === "lb" ? `${fmt(s.weight)}×${s.reps}${sfx}` : `${s.reps}`)).join(" · ");

  if (e.unit !== "lb") {
    const best = Math.max(...prev.sets.map((s) => s.reps));
    const reps = mode === "push" || mode === "normal" ? best + (e.unit === "sec" ? 5 : 1) : best;
    const u = e.unit === "sec" ? "s" : " reps";
    return { weight: 0, reps, sets: nSets, headline: `${reps}${u}`, reason: (reps > best ? `Beat your best of ${best}${u} by ${e.unit === "sec" ? "5s" : "1"}.` : `Match your best of ${best}${u}.`) + lightNote, up: reps > best, first: false, last };
  }

  const W = Math.max(...prev.sets.map((s) => s.weight));
  const atW = prev.sets.filter((s) => s.weight === W);
  const bestAtW = Math.max(...atW.map((s) => s.reps));
  // Earned a jump: every planned set reached the top of the rep/time range (warm-up ramps are fine).
  const earned = prev.sets.length >= e.sets && prev.sets.every((s) => s.reps >= hi);

  if (earned && (mode === "push" || mode === "normal")) {
    const w = nextWeight(e, W);
    return { weight: w, reps: lo, sets: nSets, headline: `${fmt(w)} lb × ${lo}${sfx}`, reason: `You hit ${hi}${sfx}+ on every set, top set ${fmt(W)} lb. Go up, aim for ${lo}–${hi}${sfx}.`, up: true, first: false, last };
  }
  if (mode === "hold" || mode === "light") {
    const reps = Math.min(hi, Math.max(lo, bestAtW));
    const why = earned ? ` You've earned ${fmt(nextWeight(e, W))} lb; save it for a green day.` : "";
    return { weight: W, reps, sets: nSets, headline: `${fmt(W)} lb × ${reps}${sfx}`, reason: (mode === "hold" ? "Yellow day: match last time." : "Red day: same weight, 1 fewer set.") + why, up: false, first: false, last };
  }
  const short = atW.filter((s) => s.reps < hi).length;
  return {
    weight: W, reps: hi, sets: nSets, headline: `${fmt(W)} lb × ${hi}${sfx}`,
    reason: short === 0 ? `Get all ${e.sets} sets to ${hi}${sfx} at ${fmt(W)} lb, then the weight goes up.` : `${short} set${short > 1 ? "s" : ""} under ${hi}${sfx} last time. Hit ${hi}${sfx} on all ${e.sets} sets, then go up.`,
    up: false, first: false, last,
  };
}

/* ================= Weekly muscle coverage ================= */
export type Group = { key: string; label: string; muscles: Muscle[] };
export const GROUPS: Group[] = [
  { key: "chest", label: "Chest", muscles: ["Chest"] },
  { key: "back", label: "Back", muscles: ["Back"] },
  { key: "shoulders", label: "Shoulders", muscles: ["Shoulders"] },
  { key: "biceps", label: "Biceps", muscles: ["Biceps"] },
  { key: "triceps", label: "Triceps", muscles: ["Triceps"] },
  { key: "legs", label: "Legs", muscles: ["Quads", "Hamstrings/Glutes", "Calves"] },
  { key: "core", label: "Core", muscles: ["Core"] },
];
const EX = new Map(KNOWN_EXERCISES.map((e) => [e.id, e]));
const groupOf = (m: Muscle) => GROUPS.find((g) => g.muscles.includes(m))!;

/** Planned weekly sets and training days per group, from the plan itself. */
export const PLANNED = Object.fromEntries(
  GROUPS.map((g) => {
    const exs = ALL_EXERCISES.filter((e) => g.muscles.includes(e.muscle));
    const perMuscle = Object.fromEntries(g.muscles.map((m) => [m, exs.filter((e) => e.muscle === m).reduce((a, e) => a + e.sets, 0)]));
    return [g.key, { sets: exs.reduce((a, e) => a + e.sets, 0), days: new Set(exs.map((e) => e.day)).size, perMuscle }];
  }),
) as Record<string, { sets: number; days: number; perMuscle: Record<string, number> }>;

export type Pauses = Record<string, string>; // group key → "fromISO|untilISO" (inclusive)
export const pauseRange = (v?: string) => { if (!v) return null; const [a, b] = v.includes("|") ? v.split("|") : ["0000-01-01", v]; return { from: a, until: b }; };
/** A pause only covers weeks from when you set it through its end, never earlier weeks. */
export const isPaused = (p: Pauses, key: string, wk: string) => { const r = pauseRange(p[key]); return !!r && wk >= weekKey(r.from) && wk <= weekKey(r.until); };

export type Status = "done" | "paused" | "todo" | "due" | "risk" | "missed";
export type GroupRow = {
  group: Group; done: number; planned: number; days: number; plannedDays: number;
  perMuscle: { m: Muscle; done: number; planned: number }[]; status: Status; paused: boolean; pausedUntil?: string;
};

export function addDays(iso: string, n: number) {
  const [y, m, d] = iso.split("-").map(Number);
  return todayISO(new Date(y, m - 1, d + n));
}
/** 0 = Monday … 6 = Sunday */
export const weekIdx = (iso: string) => { const [y, m, d] = iso.split("-").map(Number); return (new Date(y, m - 1, d).getDay() + 6) % 7; };

export function coverage(sets: SetRec[], wk: string, pauses: Pauses, today = todayISO()) {
  const inWeek = sets.filter((s) => weekKey(s.date) === wk);
  const past = wk < weekKey(today);
  const idx = past ? 7 : weekIdx(today);
  const rows: GroupRow[] = GROUPS.map((g) => {
    const mine = inWeek.filter((s) => { const e = EX.get(s.exerciseId); return e && g.muscles.includes(e.muscle); });
    const done = mine.length;
    const { sets: planned, days: plannedDays, perMuscle } = PLANNED[g.key];
    const days = new Set(mine.map((s) => s.date)).size;
    const paused = isPaused(pauses, g.key, wk);
    const pct = planned ? done / planned : 1;
    let status: Status = "todo";
    if (paused) status = "paused";
    else if (done >= planned) status = "done";
    else if (past) status = "missed";
    else if (idx >= 5) status = "risk"; // Sat/Sun with work left
    else if (idx >= 3 && pct < 0.5) status = "due"; // Thu/Fri and under half done
    return {
      group: g, done, planned, days, plannedDays, paused, pausedUntil: paused ? pauseRange(pauses[g.key])!.until : undefined, status,
      perMuscle: g.muscles.map((m) => ({ m, planned: perMuscle[m], done: mine.filter((s) => EX.get(s.exerciseId)?.muscle === m).length })),
    };
  });
  const behind = rows.filter((r) => !r.paused && r.done < r.planned);
  const daysLeft = past ? 0 : 7 - idx;
  // Fewest plan days that still cover everything behind (greedy).
  const need = new Set(behind.map((r) => r.group.key));
  const pick: number[] = [];
  while (need.size) {
    let best = -1, bestN = 0;
    for (const d of PLAN) {
      if (pick.includes(d.n)) continue;
      const n = [...d.main, d.finisher].filter((e) => need.has(groupOf(e.muscle).key)).length;
      if (n > bestN) { bestN = n; best = d.n; }
    }
    if (best < 0) break;
    pick.push(best);
    const d = PLAN.find((x) => x.n === best)!;
    [...d.main, d.finisher].forEach((e) => need.delete(groupOf(e.muscle).key));
  }
  return { rows, behind, daysLeft, needDays: pick.sort(), doneCount: rows.filter((r) => r.status === "done").length, active: rows.filter((r) => !r.paused).length };
}

/** Which plan day best covers what's still missing this week. Sticks to the day you've started today. */
export function suggestDay(sets: SetRec[], pauses: Pauses, today = todayISO(), weekdayDefault = 1) {
  const todays = sets.filter((s) => s.date === today);
  if (todays.length) {
    const count = new Map<number, number>();
    todays.forEach((s) => count.set(s.day, (count.get(s.day) ?? 0) + 1));
    return Array.from(count.entries()).sort((a, b) => b[1] - a[1])[0][0];
  }
  const { rows } = coverage(sets, weekKey(today), pauses, today);
  const left = new Map<Muscle, number>();
  rows.forEach((r) => { if (!r.paused) r.perMuscle.forEach((p) => left.set(p.m, Math.max(0, p.planned - p.done))); });
  let best = weekdayDefault, bestScore = 0;
  for (const d of PLAN) {
    const per = new Map<Muscle, number>();
    [...d.main, d.finisher].forEach((e) => per.set(e.muscle, (per.get(e.muscle) ?? 0) + e.sets));
    let score = 0;
    per.forEach((n, m) => (score += Math.min(n, left.get(m) ?? 0)));
    if (score > bestScore || (score === bestScore && score > 0 && d.n === weekdayDefault)) { best = d.n; bestScore = score; }
  }
  return best;
}
