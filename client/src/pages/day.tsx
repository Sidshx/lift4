import { useEffect, useMemo, useRef, useState } from "react";
import { useRoute } from "wouter";
import { ArrowDown, ArrowUp, Check, ChevronDown, Clock, Flame, Target, TrendingUp, Wind, Trophy, RotateCcw } from "lucide-react";
import { PLAN, imgSrc, todayISO, todaysDay, weekKey, type Exercise, type Block } from "@/data/plan";
import { useStore, liveSets, liveSessions, logSet, logSets, unlogSet, finishSession, reopenSession, previousFor, type SetRec } from "@/lib/store";
import { useRestTimer } from "@/components/shell";
import { cn } from "@/lib/utils";

/* ---------- helpers ---------- */
function repLabel(e: Exercise) {
  const r = e.reps[0] === e.reps[1] ? `${e.reps[0]}` : `${e.reps[0]}–${e.reps[1]}`;
  if (e.unit === "sec") return `${r}s`;
  if (e.unit === "bw" && e.reps[1] >= 20) return "max";
  return e.perSide ? `${r}/side` : r;
}

type Prev = ReturnType<typeof previousFor>;
function nextTarget(e: Exercise, prev: Prev) {
  if (!prev) return null;
  const { top, sets } = prev;
  const allTop = sets.length >= e.sets && sets.every((s) => s.reps >= e.reps[1] && s.weight >= top.weight);
  const lastTxt = e.unit === "lb" ? `${top.weight} lb × ${top.reps}` : e.unit === "sec" ? `${top.reps}s` : `${top.reps} reps`;
  if (e.unit === "lb" && allTop) return { last: lastTxt, next: `Go ${top.weight + 5} lb`, weight: top.weight + 5, up: true };
  if (e.unit === "sec") return { last: lastTxt, next: `Hold ${top.reps + 5}s`, weight: 0, up: false };
  return { last: lastTxt, next: `Try ${top.reps + 1} reps`, weight: top.weight, up: false };
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
type Registry = Map<string, () => Omit<SetRec, "id" | "ts" | "dirty" | "deleted">[]>;
function ExerciseCard({ e, n, day, date, sets, tag, registry }: { e: Exercise; n: number; day: number; date: string; sets: SetRec[]; tag?: string; registry: Registry }) {
  const timer = useRestTimer();
  const todays = sets.filter((l) => l.exerciseId === e.id && l.date === date);
  const prev = useMemo(() => previousFor(sets, e.id, date), [sets, e.id, date]);
  const target = nextTarget(e, prev);
  const defaultW = target?.weight ? String(target.weight) : "";
  const complete = todays.length >= e.sets;

  const [vals, setVals] = useState(() =>
    Array.from({ length: e.sets }, (_, i) => {
      const l = todays.find((t) => t.setIndex === i);
      return { w: l ? String(l.weight) : defaultW, r: l ? String(l.reps) : "" };
    }),
  );
  useEffect(() => {
    setVals((v) => v.map((x, i) => {
      const l = todays.find((t) => t.setIndex === i);
      return l ? { w: String(l.weight), r: String(l.reps) } : x.w === "" && defaultW ? { ...x, w: defaultW } : x;
    }));
  }, [todays.length, defaultW]);

  const defReps = e.unit === "bw" && e.reps[1] >= 20 ? e.reps[0] : e.reps[1];
  const rec = (i: number) => ({
    date, day, exerciseId: e.id, setIndex: i,
    weight: e.unit === "lb" ? Number(vals[i].w || 0) : 0,
    reps: Number(vals[i].r || defReps),
  });

  const tick = (i: number) => {
    const l = todays.find((t) => t.setIndex === i);
    if (l) return unlogSet(l.id);
    logSet(rec(i));
    if (!vals[i].r) setVals((v) => v.map((x, j) => (j === i ? { ...x, r: String(defReps) } : x)));
    if (i < e.sets - 1) timer.start(e.rest, `${e.name} · set ${i + 2}`);
    else timer.start(Math.max(e.rest, 90), "Next exercise");
  };

  // Unticked sets with values are logged by the single "Finish workout" button.
  registry.set(e.id, () =>
    Array.from({ length: e.sets }, (_, i) => i)
      .filter((i) => !todays.some((t) => t.setIndex === i))
      .filter((i) => e.unit !== "lb" || Number(vals[i].w) > 0)
      .map(rec),
  );

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
        {prev?.lastWeek && e.unit === "lb" ? (
          <span className="shrink-0 rounded-md border px-1.5 py-0.5 text-right leading-tight" title="Your top weight last week" data-testid={`chip-lastweek-${e.id}`}>
            <span className="block text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Last wk</span>
            <span className="font-mono text-xs font-bold">{prev.top.weight} lb</span>
          </span>
        ) : (
          <span className="font-mono text-xs font-bold text-muted-foreground">{todays.length}/{e.sets}</span>
        )}
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
          {target ? (
            <div className={cn("flex items-center gap-2 rounded-md border border-dashed px-2.5 py-1.5 text-sm", target.up && "border-primary bg-primary/10")} data-testid={`text-hint-${e.id}`}>
              <TrendingUp className="h-4 w-4 shrink-0 text-primary" />
              <span className="text-muted-foreground">{prev?.lastWeek ? "Last wk" : "Last"}: <span className="font-mono font-bold text-foreground">{target.last}</span></span>
              <span className="ml-auto font-bold text-primary">{target.next}</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-md border border-dashed px-2.5 py-1.5 text-sm text-muted-foreground"><Flame className="h-4 w-4 shrink-0" /> First time: last 2 reps should feel hard</div>
          )}
        </div>
      </div>

      <div className="mt-3 border-t pt-2">
        <div className="grid grid-cols-[2rem_1fr_1fr_3rem] gap-2 px-1 pb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          <span className="text-center">Set</span><span>{e.unit === "lb" ? "Weight" : "Load"}</span><span>{e.unit === "sec" ? "Time" : "Reps"}</span><span className="text-center">Done</span>
        </div>
        {vals.map((v, i) => {
          const done = todays.some((t) => t.setIndex === i);
          return (
            <div key={i} className={cn("grid grid-cols-[2rem_1fr_1fr_3rem] items-center gap-2 rounded-lg px-1 py-1", done && "bg-primary/10")} data-testid={`row-set-${e.id}-${i}`}>
              <span className="text-center font-mono text-sm font-bold text-muted-foreground">{i + 1}</span>
              {e.unit === "lb" ? (
                <label className="relative">
                  <span className="sr-only">Weight lb</span>
                  <input inputMode="decimal" value={v.w} disabled={done} placeholder="0"
                    onChange={(ev) => setVals((all) => all.map((x, j) => (j >= i && !todays.some((t) => t.setIndex === j) && (j === i || x.w === all[i].w) ? { ...x, w: ev.target.value } : x)))}
                    className="h-11 w-full rounded-md border bg-background px-3 pr-8 font-mono text-base font-bold tabular-nums disabled:opacity-80" data-testid={`input-weight-${e.id}-${i}`} />
                  <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">lb</span>
                </label>
              ) : <span className="pl-2 text-sm text-muted-foreground">Bodyweight</span>}
              <label className="relative">
                <span className="sr-only">{e.unit === "sec" ? "Seconds" : "Reps"}</span>
                <input inputMode="numeric" value={v.r} disabled={done} placeholder={String(defReps)}
                  onChange={(ev) => setVals((all) => all.map((x, j) => (j === i ? { ...x, r: ev.target.value } : x)))}
                  className="h-11 w-full rounded-md border bg-background px-3 pr-10 font-mono text-base font-bold tabular-nums disabled:opacity-80" data-testid={`input-reps-${e.id}-${i}`} />
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

/* ---------- Finish workout ---------- */
function FinishCard({ day, date, sets, all, registry }: { day: number; date: string; sets: SetRec[]; all: Exercise[]; registry: Registry }) {
  const timer = useRestTimer();
  const sessions = useStore(liveSessions);
  const session = sessions.find((s) => s.date === date && s.day === day);
  const ids = all.map((e) => e.id);
  const today = sets.filter((s) => s.date === date && ids.includes(s.exerciseId));
  const vol = Math.round(today.reduce((a, s) => a + s.weight * s.reps, 0));
  const exDone = all.filter((e) => today.filter((s) => s.exerciseId === e.id).length >= e.sets).length;

  // last week's same-day volume
  const wk = weekKey(date);
  const prevDates = Array.from(new Set(sets.filter((s) => s.day === day && weekKey(s.date) < wk).map((s) => s.date))).sort();
  const lastDate = prevDates[prevDates.length - 1];
  const lastVol = lastDate ? Math.round(sets.filter((s) => s.date === lastDate && ids.includes(s.exerciseId)).reduce((a, s) => a + s.weight * s.reps, 0)) : 0;
  const diff = lastVol ? Math.round(((vol - lastVol) / lastVol) * 100) : null;

  if (session) {
    const t = new Date(session.finishedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    return (
      <section className="rounded-xl border border-primary bg-primary/10 p-4" data-testid="card-finished">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground"><Trophy className="h-5 w-5" /></span>
          <div className="flex-1">
            <div className="font-bold">Workout complete · {t}</div>
            <div className="font-mono text-xs text-muted-foreground">{session.exercises}/{all.length} exercises · {session.sets} sets · {session.volume.toLocaleString()} lb</div>
          </div>
          <button onClick={() => reopenSession(session.id)} className="flex h-9 items-center gap-1 rounded-md bg-background px-2.5 text-xs font-medium hover-elevate" data-testid="button-reopen"><RotateCcw className="h-3.5 w-3.5" />Undo</button>
        </div>
        {diff !== null && (
          <div className="mt-2 text-sm"><span className={cn("font-bold", diff >= 0 ? "text-primary" : "text-chart-2")}>{diff >= 0 ? "+" : ""}{diff}%</span> <span className="text-muted-foreground">total weight vs last week ({lastVol.toLocaleString()} lb)</span></div>
        )}
      </section>
    );
  }

  return (
    <section className="rounded-xl border bg-card p-4" data-testid="card-finish">
      <div className="mb-3 grid grid-cols-3 gap-2 text-center">
        <div><div className="font-mono text-lg font-bold">{exDone}/{all.length}</div><div className="text-[11px] text-muted-foreground">exercises</div></div>
        <div><div className="font-mono text-lg font-bold">{today.length}</div><div className="text-[11px] text-muted-foreground">sets</div></div>
        <div><div className="font-mono text-lg font-bold">{vol.toLocaleString()}</div><div className="text-[11px] text-muted-foreground">lb lifted</div></div>
      </div>
      <button onClick={() => { const pending = Array.from(registry.values()).flatMap((f) => f()); if (pending.length) logSets(pending); finishSession(date, day); timer.stop(); }}
        className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-primary text-base font-bold text-primary-foreground hover-elevate disabled:opacity-40" data-testid="button-finish-workout">
        <Check className="h-5 w-5" strokeWidth={3} /> Workout done
      </button>
      <p className="mt-2 text-center text-xs text-muted-foreground">Logs every set you filled in and marks today done</p>
    </section>
  );
}

/* ---------- Fitbit readiness ---------- */
function TodayCard() {
  const fitbit = useStore((s) => s.fitbit);
  const last = fitbit[fitbit.length - 1];
  if (!last?.readiness) return null;
  const fresh = last.date === todayISO();
  const age = Math.round((new Date(todayISO()).getTime() - new Date(last.date).getTime()) / 86400000);
  if (age > 3) return null;
  const tone = !fresh ? "bg-muted-foreground" : last.readiness === "Green" ? "bg-primary" : last.readiness === "Yellow" ? "bg-chart-4" : "bg-chart-2";
  const [head, why] = last.tip.split(" (");
  return (
    <section className={cn("flex items-center gap-3 rounded-xl border bg-card px-4 py-3", !fresh && "opacity-60")} data-testid="card-today-fitbit">
      <span className={cn("h-3 w-3 shrink-0 rounded-full", tone)} aria-label={`Readiness ${last.readiness}`} />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-bold">{fresh ? head : `${age === 1 ? "Yesterday" : `${age} days ago`} · waiting for today's sync`}</div>
        <div className="truncate font-mono text-xs text-muted-foreground">
          {last.sleep}h sleep · HRV {last.hrv} · RHR {last.rhr}{why ? ` · ${why.replace(")", "")}` : ""}
        </div>
      </div>
    </section>
  );
}

/* ---------- Page ---------- */
export default function DayPage() {
  const [, params] = useRoute("/day/:n");
  const t = todaysDay();
  const n = params ? Number(params.n) : t.n;
  const plan = PLAN.find((d) => d.n === n) ?? PLAN[0];
  const date = todayISO();
  const sets = useStore(liveSets);
  const registry = useRef<Registry>(new Map()).current;

  const all = [...plan.main, plan.finisher];
  const totalSets = all.reduce((a, e) => a + e.sets, 0);
  const doneSets = sets.filter((l) => l.date === date && all.some((e) => e.id === l.exerciseId)).length;
  const pct = Math.round((doneSets / totalSets) * 100);
  const isToday = !t.rest && t.n === n;

  // last week's best for this day (motivation line)
  const wk = weekKey(date);
  const lastWeekTops = plan.main.filter((e) => e.unit === "lb").map((e) => {
    const prev = previousFor(sets, e.id, date);
    return prev?.lastWeek ? { name: e.name.split(" ").slice(-2).join(" "), w: prev.top.weight } : null;
  }).filter(Boolean) as { name: string; w: number }[];

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
              <span>Day {plan.n} · {plan.weekday}</span>
              {isToday && <span className="rounded bg-primary px-1.5 py-0.5 text-primary-foreground">Today</span>}
              {t.rest && t.n === n && <span className="rounded bg-secondary px-1.5 py-0.5">Rest day · next up</span>}
            </div>
            <h1 className="mt-1 text-xl font-bold leading-tight" data-testid="text-day-title">{plan.title}</h1>
            <div className="mt-2 flex flex-wrap gap-1.5">{plan.muscles.map((m) => <span key={m} className="rounded-md bg-secondary px-2 py-0.5 text-xs font-medium">{m}</span>)}</div>
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
        {lastWeekTops.length > 0 && (
          <div className="mt-3 flex items-center gap-2 overflow-x-auto rounded-lg bg-secondary px-2.5 py-2 text-xs" data-testid="strip-lastweek">
            <TrendingUp className="h-3.5 w-3.5 shrink-0 text-primary" />
            <span className="shrink-0 font-bold">Last wk — beat it:</span>
            {lastWeekTops.map((x) => <span key={x.name} className="shrink-0 whitespace-nowrap text-muted-foreground">{x.name} <span className="font-mono font-bold text-foreground">{x.w}</span></span>)}
          </div>
        )}
      </section>

      <TodayCard />
      <BlockList title="Warm-up" minutes="5 min" items={plan.warmup} testid="section-warmup" />
      {plan.main.map((e, i) => <ExerciseCard key={`${e.id}-${date}`} e={e} n={i + 1} day={plan.n} date={date} sets={sets} registry={registry} />)}
      <div className="flex items-center gap-2 pt-2 text-xs font-bold uppercase tracking-wider text-muted-foreground"><Flame className="h-3.5 w-3.5 text-chart-2" /> Finisher</div>
      <ExerciseCard key={`${plan.finisher.id}-${date}`} e={plan.finisher} n={7} tag="F" day={plan.n} date={date} sets={sets} registry={registry} />
      <BlockList title="Stretch" minutes="2 min" items={plan.stretch} testid="section-stretch" />
      <FinishCard day={plan.n} date={date} sets={sets} all={all} registry={registry} />
    </div>
  );
}
