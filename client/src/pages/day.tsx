import { useEffect, useMemo, useRef, useState } from "react";
import { useRoute } from "wouter";
import { ArrowDown, ArrowUp, Check, ChevronDown, Clock, Flame, Target, TrendingUp, Wind, Trophy, CalendarDays } from "lucide-react";
import { PLAN, imgSrc, todayISO, todaysDay, weekKey, type Exercise, type Block } from "@/data/plan";
import { useStore, liveSets, logSet, unlogSet, type SetRec } from "@/lib/store";
import { readiness, targetFor, suggestDay, MODE_TEXT, type Mode } from "@/lib/coach";
import { WeekCoverage } from "@/components/week";
import { useRestTimer } from "@/components/shell";
import { cn } from "@/lib/utils";

/* ---------- helpers ---------- */
function repLabel(e: Exercise) {
  const r = e.reps[0] === e.reps[1] ? `${e.reps[0]}` : `${e.reps[0]}–${e.reps[1]}`;
  if (e.unit === "sec") return `${r}s`;
  if (e.unit === "bw" && e.reps[1] >= 20) return "max";
  return e.perSide ? `${r}/side` : r;
}

/* ---------- Image (auto start/end flip, tap to pause) ---------- */
function ExerciseImage({ id, name }: { id: string; name: string }) {
  const [frame, setFrame] = useState<0 | 1>(0);
  const [auto, setAuto] = useState(true);
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!auto || reduce) return;
    const t = setInterval(() => setFrame((f) => (f ? 0 : 1)), 1300);
    return () => clearInterval(t);
  }, [auto]);
  return (
    <button type="button" onClick={() => { setAuto(false); setFrame((f) => (f ? 0 : 1)); }}
      className="relative block aspect-[3/2] w-full overflow-hidden rounded-lg bg-white"
      aria-label={`${name} demo, tap to switch start and end position`} data-testid={`img-exercise-${id}`}>
      {[0, 1].map((f) => (
        <img key={f} src={imgSrc(id, f as 0 | 1)} alt={`${name} ${f ? "end" : "start"} position`} loading="lazy" width={600} height={400}
          className={cn("absolute inset-0 h-full w-full object-contain transition-opacity duration-300", frame === f ? "opacity-100" : "opacity-0")} />
      ))}
      <span className="absolute left-2 top-2 rounded-md bg-black/70 px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-white">{frame ? "End" : "Start"}</span>
    </button>
  );
}

function Stat({ label, value, icon, small }: { label: string; value: string; icon?: React.ReactNode; small?: boolean }) {
  return (
    <div className="rounded-md bg-secondary px-2 py-1.5">
      <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{icon}{label}</div>
      <div className={cn("font-mono font-bold tabular-nums leading-tight", small ? "text-xs" : "text-sm")}>{value}</div>
    </div>
  );
}

/* ---------- Exercise card ---------- */
// A set is logged the moment you show it was done: type its reps (auto-saves after a short pause
// or when you leave the box) or tap the check. Pre-filled weights alone never count as done.
function ExerciseCard({ e, n, day, date, sets, tag, mode }: { e: Exercise; n: number; day: number; date: string; sets: SetRec[]; tag?: string; mode: Mode }) {
  const timer = useRestTimer();
  const todays = sets.filter((l) => l.exerciseId === e.id && l.date === date);
  // Target is fixed by sets before this date, so logging today doesn't move it.
  const earlier = useMemo(() => sets.filter((s) => s.exerciseId === e.id && s.date < date), [sets, e.id, date]);
  const target = useMemo(() => targetFor(e, earlier, date, mode), [e, earlier, date, mode]);
  const defaultW = target.weight ? String(target.weight) : "";
  const complete = todays.length >= target.sets;

  const [vals, setVals] = useState(() =>
    Array.from({ length: e.sets }, (_, i) => {
      const l = todays.find((t) => t.setIndex === i);
      return { w: l ? String(l.weight) : defaultW, r: l ? String(l.reps) : "" };
    }),
  );
  const valsRef = useRef(vals);
  valsRef.current = vals;
  const todaysRef = useRef(todays);
  todaysRef.current = todays;
  const timers = useRef<Record<number, ReturnType<typeof setTimeout>>>({});
  useEffect(() => () => Object.values(timers.current).forEach(clearTimeout), []);

  // If the target weight changes (e.g. Fitbit data arrives), refresh rows still showing the old target.
  const prevDefault = useRef(defaultW);
  useEffect(() => {
    const old = prevDefault.current;
    prevDefault.current = defaultW;
    setVals((v) => v.map((x, i) => ((x.w === "" || x.w === old) && defaultW && !todays.some((t) => t.setIndex === i) ? { ...x, w: defaultW } : x)));
  }, [defaultW]);

  // One tap on the check logs exactly what the row shows: target weight × target reps.
  const defReps = target.reps;

  const startRest = (i: number) => {
    if (i < e.sets - 1) timer.start(e.rest, `${e.name} · set ${i + 2}`);
    else timer.start(Math.max(e.rest, 90), "Next exercise");
  };

  /** Save row i from what's in the boxes: log, update, or remove. */
  const commit = (i: number) => {
    clearTimeout(timers.current[i]);
    delete timers.current[i];
    const v = valsRef.current[i];
    const logged = todaysRef.current.find((t) => t.setIndex === i);
    const reps = Number(v.r);
    const weight = e.unit === "lb" ? Number(v.w || 0) : 0;
    const ok = v.r.trim() !== "" && reps > 0 && (e.unit !== "lb" || weight > 0);
    if (!ok) {
      if (logged && v.r.trim() === "") unlogSet(logged.id);
      return;
    }
    if (logged && logged.reps === reps && logged.weight === weight) return;
    logSet({ date, day, exerciseId: e.id, setIndex: i, weight, reps });
    if (!logged) startRest(i);
  };
  const commitSoon = (i: number) => {
    clearTimeout(timers.current[i]);
    timers.current[i] = setTimeout(() => commit(i), 1500);
  };

  // Flush anything typed but not yet saved if the phone locks or the app is switched away.
  const commitRef = useRef(commit);
  commitRef.current = commit;
  useEffect(() => {
    const flush = () => { if (document.visibilityState === "hidden") Object.keys(timers.current).forEach((k) => commitRef.current(Number(k))); };
    document.addEventListener("visibilitychange", flush);
    window.addEventListener("pagehide", flush);
    return () => { document.removeEventListener("visibilitychange", flush); window.removeEventListener("pagehide", flush); };
  }, []);

  const tick = (i: number) => {
    const l = todays.find((t) => t.setIndex === i);
    if (l) {
      clearTimeout(timers.current[i]);
      setVals((v) => v.map((x, j) => (j === i ? { ...x, r: "" } : x)));
      return unlogSet(l.id);
    }
    const v = vals[i];
    const r = v.r.trim() ? v.r : String(defReps);
    if (e.unit === "lb" && !(Number(v.w) > 0)) {
      document.querySelector<HTMLInputElement>(`[data-testid="input-weight-${e.id}-${i}"]`)?.focus();
      return;
    }
    const next = vals.map((x, j) => (j === i ? { ...x, r } : x));
    valsRef.current = next;
    setVals(next);
    commit(i);
  };

  return (
    <article className={cn("rounded-xl border bg-card p-3 sm:p-4", complete && "border-primary/60")} data-testid={`card-exercise-${e.id}`}>
      <div className="mb-3 flex items-start gap-3">
        <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg font-mono text-sm font-bold", complete ? "bg-primary text-primary-foreground" : "bg-secondary")}>
          {complete ? <Check className="h-4 w-4" strokeWidth={3} /> : tag ?? n}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-bold leading-tight">{e.name}</h3>
          <div className="mt-1 flex items-center gap-1.5 text-sm text-primary"><Target className="h-3.5 w-3.5 shrink-0" /><span className="font-medium">Feel it: {e.feel}</span></div>
        </div>
        <span className="font-mono text-xs font-bold text-muted-foreground" data-testid={`text-count-${e.id}`}>{todays.length}/{target.sets}</span>
      </div>

      <div className={cn("mb-3 rounded-lg border px-3 py-2", target.up ? "border-primary bg-primary/10" : "bg-secondary/60")} data-testid={`box-target-${e.id}`}>
        <div className="flex items-center gap-2">
          {target.first ? <Flame className="h-4 w-4 shrink-0 text-chart-2" /> : <TrendingUp className={cn("h-4 w-4 shrink-0", target.up ? "text-primary" : "text-muted-foreground")} />}
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Today</span>
          <span className="font-mono text-base font-bold" data-testid={`text-target-${e.id}`}>{target.headline}</span>
          <span className="font-mono text-xs text-muted-foreground">× {target.sets} sets</span>
          {target.up && <span className="ml-auto rounded bg-primary px-1.5 py-0.5 text-[10px] font-bold uppercase text-primary-foreground">Up</span>}
        </div>
        <div className="mt-0.5 text-xs text-muted-foreground">{target.reason}</div>
        {target.last && <div className="mt-0.5 font-mono text-[11px] text-muted-foreground">Last time: {target.last}</div>}
      </div>

      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <ExerciseImage id={e.img} name={e.name} />
        <div className="flex flex-col gap-2.5">
          <div className="grid grid-cols-3 gap-1.5">
            <Stat label="Sets × Reps" value={`${e.sets} × ${repLabel(e)}`} />
            <Stat label="Rest" value={`${e.rest}s`} icon={<Clock className="h-3 w-3" />} />
            <Stat label="Start" value={e.start.replace(/ each| stack|, one DB/g, "")} small />
          </div>
          <div className="grid grid-cols-2 gap-1.5 text-sm">
            <div className="flex items-center gap-2 rounded-md bg-secondary px-2.5 py-2">
              <ArrowDown className="h-4 w-4 shrink-0 text-chart-3" />
              <div className="min-w-0"><div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Inhale</div><div className="truncate font-medium">{e.inhale}</div></div>
            </div>
            <div className="flex items-center gap-2 rounded-md bg-secondary px-2.5 py-2">
              <ArrowUp className="h-4 w-4 shrink-0 text-chart-2" />
              <div className="min-w-0"><div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Exhale</div><div className="truncate font-medium">{e.exhale}</div></div>
            </div>
          </div>
          <ul className="space-y-1 text-sm">
            {e.cues.map((c) => <li key={c} className="flex gap-2"><span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-primary" /><span>{c}</span></li>)}
          </ul>
        </div>
      </div>

      <div className="mt-3 border-t pt-2">
        <div className="grid grid-cols-[2rem_1fr_1fr_3rem] gap-2 px-1 pb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          <span className="text-center">Set</span><span>{e.unit === "lb" ? "Weight" : "Load"}</span><span>{e.unit === "sec" ? "Time" : "Reps"}</span><span className="text-center">Did it</span>
        </div>
        {vals.map((v, i) => {
          const done = todays.some((t) => t.setIndex === i);
          const optional = i >= target.sets && !done;
          return (
            <div key={i} className={cn("grid grid-cols-[2rem_1fr_1fr_3rem] items-center gap-2 rounded-lg px-1 py-1", done && "bg-primary/10", optional && "opacity-45")} data-testid={`row-set-${e.id}-${i}`}>
              <span className="text-center font-mono text-sm font-bold text-muted-foreground" title={optional ? "Optional today" : undefined}>{optional ? "–" : i + 1}</span>
              {e.unit === "lb" ? (
                <label className="relative">
                  <span className="sr-only">Weight lb</span>
                  <input inputMode="decimal" value={v.w} placeholder="0"
                    onChange={(ev) => { const w = ev.target.value; setVals((all) => all.map((x, j) => (j >= i && !todays.some((t) => t.setIndex === j) && (j === i || x.w === all[i].w) ? { ...x, w } : x))); if (done) commitSoon(i); }}
                    onBlur={() => done && commit(i)}
                    className={cn("h-11 w-full rounded-md border bg-background px-3 pr-8 font-mono text-base font-bold tabular-nums", !done && !v.r && "text-muted-foreground")} data-testid={`input-weight-${e.id}-${i}`} />
                  <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">lb</span>
                </label>
              ) : <span className="pl-2 text-sm text-muted-foreground">Bodyweight</span>}
              <label className="relative">
                <span className="sr-only">{e.unit === "sec" ? "Seconds" : "Reps"}</span>
                <input inputMode="numeric" value={v.r} placeholder={String(defReps)}
                  onChange={(ev) => { const r = ev.target.value; setVals((all) => all.map((x, j) => (j === i ? { ...x, r } : x))); commitSoon(i); }}
                  onBlur={() => commit(i)}
                  className="h-11 w-full rounded-md border bg-background px-3 pr-10 font-mono text-base font-bold tabular-nums" data-testid={`input-reps-${e.id}-${i}`} />
                <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{e.unit === "sec" ? "sec" : "reps"}</span>
              </label>
              <button onClick={() => tick(i)} aria-label={done ? `Undo set ${i + 1}` : `Complete set ${i + 1}`}
                className={cn("flex h-11 w-12 items-center justify-center rounded-md border transition-colors", done ? "border-primary bg-primary text-primary-foreground" : "bg-secondary hover-elevate")}
                data-testid={`button-done-${e.id}-${i}`}>
                <Check className="h-5 w-5" strokeWidth={3} />
              </button>
            </div>
          );
        })}
      </div>
    </article>
  );
}

function BlockList({ title, minutes, items, testid }: { title: string; minutes: string; items: Block[]; testid: string }) {
  const [open, setOpen] = useState(false);
  return (
    <section className="rounded-xl border bg-card" data-testid={testid}>
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-3 px-4 py-3 text-left" data-testid={`button-toggle-${testid}`}>
        <Wind className="h-4 w-4 text-muted-foreground" />
        <span className="font-bold">{title}</span>
        <span className="font-mono text-xs text-muted-foreground">{minutes}</span>
        <ChevronDown className={cn("ml-auto h-4 w-4 transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <ul className="divide-y border-t px-4">
          {items.map((b) => <li key={b.name} className="flex items-center justify-between py-2 text-sm"><span>{b.name}</span><span className="font-mono text-xs text-muted-foreground">{b.detail}</span></li>)}
        </ul>
      )}
    </section>
  );
}

/* ---------- Auto-saved summary (no finish button) ---------- */
function SummaryCard({ day, date, sets, all }: { day: number; date: string; sets: SetRec[]; all: Exercise[] }) {
  const ids = all.map((e) => e.id);
  const today = sets.filter((s) => s.date === date && ids.includes(s.exerciseId));
  const vol = Math.round(today.reduce((a, s) => a + s.weight * s.reps, 0));
  const exDone = all.filter((e) => today.filter((s) => s.exerciseId === e.id).length >= e.sets).length;
  const totalSets = all.reduce((a, e) => a + e.sets, 0);
  const allDone = today.length >= totalSets;

  const wk = weekKey(date);
  const prevDates = Array.from(new Set(sets.filter((s) => s.day === day && weekKey(s.date) < wk).map((s) => s.date))).sort();
  const lastDate = prevDates[prevDates.length - 1];
  const lastVol = lastDate ? Math.round(sets.filter((s) => s.date === lastDate && ids.includes(s.exerciseId)).reduce((a, s) => a + s.weight * s.reps, 0)) : 0;
  const diff = lastVol && today.length ? Math.round(((vol - lastVol) / lastVol) * 100) : null;

  if (!today.length) {
    return (
      <section className="rounded-xl border border-dashed bg-card p-4 text-center text-sm text-muted-foreground" data-testid="card-summary-empty">
        Nothing logged {date === todayISO() ? "today" : "for this date"} yet. Hit the target? Tap <Check className="inline h-3.5 w-3.5" strokeWidth={3} /> once per set. Did something different? Type the weight or reps and it saves.
      </section>
    );
  }
  const lastTs = Math.max(...today.map((s) => s.ts));
  const t = new Date(lastTs).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return (
    <section className={cn("rounded-xl border p-4", allDone ? "border-primary bg-primary/10" : "bg-card")} data-testid="card-summary">
      <div className="flex items-center gap-3">
        <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full", allDone ? "bg-primary text-primary-foreground" : "bg-secondary")}>
          {allDone ? <Trophy className="h-5 w-5" /> : <Check className="h-5 w-5" strokeWidth={3} />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="font-bold">{allDone ? "Workout complete" : "Saved as you go"} · last set {t}</div>
          <div className="font-mono text-xs text-muted-foreground">{exDone}/{all.length} exercises · {today.length}/{totalSets} sets · {vol.toLocaleString()} lb</div>
        </div>
      </div>
      {diff !== null && (
        <div className="mt-2 text-sm"><span className={cn("font-bold", diff >= 0 ? "text-primary" : "text-chart-2")}>{diff >= 0 ? "+" : ""}{diff}%</span> <span className="text-muted-foreground">total weight vs last week{allDone ? "" : " so far"} ({lastVol.toLocaleString()} lb)</span></div>
      )}
    </section>
  );
}

/* ---------- Fitbit readiness → what to do today ---------- */
function TodayCard({ logDate }: { logDate: string }) {
  const fitbit = useStore((s) => s.fitbit);
  const r = readiness(fitbit);
  const pastLog = logDate !== todayISO();
  const mode: Mode = pastLog ? "normal" : r.mode;
  const d = r.data;
  const age = r.date ? Math.round((new Date(todayISO()).getTime() - new Date(r.date).getTime()) / 86400000) : null;
  const tone = mode === "push" ? "bg-primary" : mode === "hold" ? "bg-chart-4" : mode === "light" ? "bg-chart-2" : "bg-muted-foreground";
  const text = MODE_TEXT[mode];
  return (
    <section className={cn("flex items-start gap-3 rounded-xl border bg-card px-4 py-3", mode === "light" && "border-chart-2/60", mode === "push" && "border-primary/50")} data-testid="card-today-fitbit">
      <span className={cn("mt-1 h-3 w-3 shrink-0 rounded-full", tone)} aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-bold" data-testid="text-readiness">{pastLog ? "Logging a past day · normal targets" : text.title}</div>
        <div className="text-sm text-muted-foreground">{pastLog ? "Fitbit only adjusts today's targets." : text.rule}{!pastLog && r.fresh ? " Targets below are adjusted." : ""}</div>
        {d && (
          <div className="mt-0.5 truncate font-mono text-xs text-muted-foreground">
            {r.fresh ? "" : age === 1 ? "Yesterday: " : age != null ? `${age}d ago: ` : ""}{d.sleep}h sleep · HRV {d.hrv} · RHR {d.rhr}{r.why ? ` · ${r.why}` : ""}
          </div>
        )}
      </div>
    </section>
  );
}

/* ---------- Page ---------- */
export default function DayPage() {
  const [, params] = useRoute("/day/:n");
  const t = todaysDay();
  const sets = useStore(liveSets);
  const pauses = useStore((s) => s.pauses ?? {});
  const fitbit = useStore((s) => s.fitbit);
  const suggested = useMemo(() => suggestDay(sets, pauses, todayISO(), t.n), [sets, pauses]);
  const n = params ? Number(params.n) : suggested;
  const plan = PLAN.find((d) => d.n === n) ?? PLAN[0];
  const realToday = todayISO();
  const [date, setDate] = useState(realToday);
  const mode: Mode = date === realToday ? readiness(fitbit).mode : "normal";
  const dateOptions = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - i);
    const iso = todayISO(d);
    const label = i === 0 ? "Today" : i === 1 ? "Yesterday" : d.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
    return { iso, label };
  });

  const all = [...plan.main, plan.finisher];
  const totalSets = all.reduce((a, e) => a + e.sets, 0);
  const doneSets = sets.filter((l) => l.date === date && all.some((e) => e.id === l.exerciseId)).length;
  const pct = Math.round((doneSets / totalSets) * 100);
  const isToday = suggested === n && date === realToday;

  const timeline = [
    { label: "Warm-up", min: 5, cls: "bg-muted-foreground/40" },
    { label: "Main lifts", min: 45, cls: "bg-primary" },
    { label: "Finisher", min: 8, cls: "bg-chart-2" },
    { label: "Stretch", min: 2, cls: "bg-chart-3" },
  ];

  return (
    <div className="space-y-3">
      <section className="rounded-xl border bg-card p-4" data-testid="section-day-header">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              <span>Day {plan.n} · usually {plan.weekday}</span>
              {isToday && <span className="rounded bg-primary px-1.5 py-0.5 text-primary-foreground">Suggested</span>}
            </div>
            <h1 className="mt-1 text-xl font-bold leading-tight" data-testid="text-day-title">{plan.title}</h1>
            <div className="mt-2 flex flex-wrap gap-1.5">{plan.muscles.map((m) => <span key={m} className="rounded-md bg-secondary px-2 py-0.5 text-xs font-medium">{m}</span>)}</div>
            <label className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
              <CalendarDays className="h-3.5 w-3.5" />
              <span>Logging for</span>
              <select value={date} onChange={(ev) => setDate(ev.target.value)}
                className={cn("h-7 rounded-md border bg-background px-1.5 text-xs font-medium text-foreground", date !== realToday && "border-chart-4")} data-testid="select-log-date">
                {dateOptions.map((o) => <option key={o.iso} value={o.iso}>{o.label}</option>)}
              </select>
            </label>
          </div>
          <div className="relative h-16 w-16 shrink-0" aria-label={`${pct}% of sets done`} data-testid="status-progress">
            <svg viewBox="0 0 36 36" className="h-16 w-16 -rotate-90">
              <circle cx="18" cy="18" r="15.5" fill="none" stroke="hsl(var(--muted))" strokeWidth="3.5" />
              <circle cx="18" cy="18" r="15.5" fill="none" stroke="hsl(var(--primary))" strokeWidth="3.5" strokeLinecap="round" strokeDasharray={`${(pct / 100) * 97.4} 97.4`} className="transition-all duration-500" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-mono text-sm font-bold leading-none">{doneSets}</span>
              <span className="text-[10px] text-muted-foreground">/{totalSets}</span>
            </div>
          </div>
        </div>
        <div className="mt-3">
          <div className="flex h-2 overflow-hidden rounded-full">{timeline.map((s) => <div key={s.label} className={s.cls} style={{ width: `${(s.min / 60) * 100}%` }} />)}</div>
          <div className="mt-1.5 flex justify-between text-[11px] text-muted-foreground">{timeline.map((s) => <span key={s.label}><span className="font-mono font-bold text-foreground">{s.min}′</span> {s.label}</span>)}</div>
        </div>
      </section>

      <TodayCard logDate={date} />
      <WeekCoverage collapsible />
      <BlockList title="Warm-up" minutes="5 min" items={plan.warmup} testid="section-warmup" />
      {plan.main.map((e, i) => <ExerciseCard key={`${e.id}-${date}`} e={e} n={i + 1} day={plan.n} date={date} sets={sets} mode={mode} />)}
      <div className="flex items-center gap-2 pt-2 text-xs font-bold uppercase tracking-wider text-muted-foreground"><Flame className="h-3.5 w-3.5 text-chart-2" /> Finisher</div>
      <ExerciseCard key={`${plan.finisher.id}-${date}`} e={plan.finisher} n={7} tag="F" day={plan.n} date={date} sets={sets} mode={mode} />
      <BlockList title="Stretch" minutes="2 min" items={plan.stretch} testid="section-stretch" />
      <SummaryCard day={plan.n} date={date} sets={sets} all={all} />
    </div>
  );
}
