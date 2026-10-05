import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { ArrowDown, ArrowUp, Check, ChevronDown, Clock, Flame, Target, TrendingUp, Wind } from "lucide-react";
import type { SetLog } from "@shared/schema";
import { PLAN, imgSrc, todayISO, todaysDay, type Exercise, type Block } from "@/data/plan";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useRestTimer } from "@/components/shell";
import { cn } from "@/lib/utils";

/* ---------- helpers ---------- */
function repLabel(e: Exercise) {
  const r = e.reps[0] === e.reps[1] ? `${e.reps[0]}` : `${e.reps[0]}–${e.reps[1]}`;
  if (e.unit === "sec") return `${r}s`;
  if (e.unit === "bw" && e.reps[1] >= 20) return "max";
  return e.perSide ? `${r}/side` : r;
}

function lastSession(logs: SetLog[], exId: string, today: string) {
  const prev = logs.filter((l) => l.exerciseId === exId && l.date < today);
  if (!prev.length) return null;
  const date = prev.reduce((a, l) => (l.date > a ? l.date : a), prev[0].date);
  const sets = prev.filter((l) => l.date === date).sort((a, b) => a.setIndex - b.setIndex);
  return { date, sets };
}

function overloadHint(e: Exercise, last: ReturnType<typeof lastSession>) {
  if (!last) return null;
  const top = last.sets.reduce((a, s) => (s.weight > a.weight || (s.weight === a.weight && s.reps > a.reps) ? s : a), last.sets[0]);
  const allTop = last.sets.length >= e.sets && last.sets.every((s) => s.reps >= e.reps[1] && s.weight >= top.weight);
  const unit = e.unit === "lb" ? " lb" : "";
  const w = e.unit === "lb" ? `${top.weight}${unit} × ` : "";
  const r = e.unit === "sec" ? `${top.reps}s` : `${top.reps}`;
  if (e.unit === "lb" && allTop) return { last: `${w}${r}`, next: `Go ${top.weight + 5} lb`, up: true, weight: top.weight + 5 };
  const nextReps = Math.min(top.reps + 1, e.unit === "sec" ? 90 : 30);
  return { last: `${w}${r}`, next: e.unit === "sec" ? `Hold ${nextReps + 4}s` : `Try ${nextReps} reps`, up: false, weight: top.weight };
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
    <button
      type="button"
      onClick={() => { setAuto(false); setFrame((f) => (f ? 0 : 1)); }}
      className="relative block aspect-[3/2] w-full overflow-hidden rounded-lg bg-white"
      aria-label={`${name} demo, tap to switch start and end position`}
      data-testid={`img-exercise-${id}`}
    >
      {[0, 1].map((f) => (
        <img key={f} src={imgSrc(id, f as 0 | 1)} alt={`${name} ${f ? "end" : "start"} position`} loading="lazy" width={600} height={400}
          className={cn("absolute inset-0 h-full w-full object-contain transition-opacity duration-300", frame === f ? "opacity-100" : "opacity-0")} />
      ))}
      <span className="absolute left-2 top-2 rounded-md bg-black/70 px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wider text-white">
        {frame ? "End" : "Start"}
      </span>
    </button>
  );
}

/* ---------- Set row ---------- */
function SetRow({ e, idx, day, date, logged, defaultWeight }: {
  e: Exercise; idx: number; day: number; date: string; logged?: SetLog; defaultWeight: number | null;
}) {
  const timer = useRestTimer();
  const [weight, setWeight] = useState<string>(logged ? String(logged.weight) : defaultWeight != null ? String(defaultWeight) : "");
  const [reps, setReps] = useState<string>(logged ? String(logged.reps) : "");
  useEffect(() => {
    if (logged) { setWeight(String(logged.weight)); setReps(String(logged.reps)); }
  }, [logged?.id]);
  useEffect(() => {
    if (!logged && defaultWeight != null && weight === "") setWeight(String(defaultWeight));
  }, [defaultWeight]);

  const save = useMutation({
    mutationFn: async () => {
      const r = Number(reps || e.reps[1]);
      const w = e.unit === "lb" ? Number(weight || 0) : 0;
      return (await apiRequest("POST", "/api/sets", { date, day, exerciseId: e.id, setIndex: idx, weight: w, reps: r })).json();
    },
    onSuccess: () => {
      if (!reps) setReps(String(e.reps[1]));
      queryClient.invalidateQueries({ queryKey: ["/api/sets"] });
      if (idx < e.sets - 1) timer.start(e.rest, `${e.name} · set ${idx + 2}`);
      else timer.start(Math.max(e.rest, 90), "Next exercise");
    },
  });
  const undo = useMutation({
    mutationFn: async () => apiRequest("DELETE", `/api/sets/${logged!.id}`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/sets"] }),
  });

  const done = !!logged;
  const repsPh = e.unit === "sec" ? `${e.reps[1]}s` : `${e.reps[1]}`;
  return (
    <div className={cn("grid grid-cols-[2rem_1fr_1fr_3rem] items-center gap-2 rounded-lg px-1 py-1", done && "bg-primary/10")} data-testid={`row-set-${e.id}-${idx}`}>
      <span className="text-center font-mono text-sm font-bold text-muted-foreground">{idx + 1}</span>
      {e.unit === "lb" ? (
        <label className="relative">
          <span className="sr-only">Weight lb</span>
          <input inputMode="decimal" value={weight} onChange={(ev) => setWeight(ev.target.value)} disabled={done} placeholder="0"
            className="h-11 w-full rounded-md border bg-background px-3 pr-8 font-mono text-base font-bold tabular-nums disabled:opacity-80" data-testid={`input-weight-${e.id}-${idx}`} />
          <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">lb</span>
        </label>
      ) : (
        <span className="pl-2 text-sm text-muted-foreground">Bodyweight</span>
      )}
      <label className="relative">
        <span className="sr-only">{e.unit === "sec" ? "Seconds" : "Reps"}</span>
        <input inputMode="numeric" value={reps} onChange={(ev) => setReps(ev.target.value)} disabled={done} placeholder={repsPh}
          className="h-11 w-full rounded-md border bg-background px-3 pr-10 font-mono text-base font-bold tabular-nums disabled:opacity-80" data-testid={`input-reps-${e.id}-${idx}`} />
        <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{e.unit === "sec" ? "sec" : "reps"}</span>
      </label>
      <button
        onClick={() => (done ? undo.mutate() : save.mutate())}
        disabled={save.isPending || undo.isPending}
        aria-label={done ? `Undo set ${idx + 1}` : `Complete set ${idx + 1}`}
        className={cn("flex h-11 w-12 items-center justify-center rounded-md border transition-colors",
          done ? "border-primary bg-primary text-primary-foreground" : "bg-secondary hover-elevate")}
        data-testid={`button-done-${e.id}-${idx}`}
      >
        <Check className="h-5 w-5" strokeWidth={3} />
      </button>
    </div>
  );
}

/* ---------- Exercise card ---------- */
function ExerciseCard({ e, n, day, date, logs, tag }: { e: Exercise; n: number; day: number; date: string; logs: SetLog[]; tag?: string }) {
  const todays = logs.filter((l) => l.exerciseId === e.id && l.date === date);
  const last = lastSession(logs, e.id, date);
  const hint = overloadHint(e, last);
  const doneCount = todays.length;
  const complete = doneCount >= e.sets;
  return (
    <article className={cn("rounded-xl border bg-card p-3 sm:p-4", complete && "border-primary/60")} data-testid={`card-exercise-${e.id}`}>
      <div className="mb-3 flex items-start gap-3">
        <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg font-mono text-sm font-bold",
          complete ? "bg-primary text-primary-foreground" : "bg-secondary")}>{complete ? <Check className="h-4 w-4" strokeWidth={3} /> : tag ?? n}</span>
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-bold leading-tight">{e.name}</h3>
          <div className="mt-1 flex items-center gap-1.5 text-sm text-primary">
            <Target className="h-3.5 w-3.5 shrink-0" />
            <span className="font-medium">Feel it: {e.feel}</span>
          </div>
        </div>
        <span className="font-mono text-xs font-bold text-muted-foreground">{doneCount}/{e.sets}</span>
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
            {e.cues.map((c) => (
              <li key={c} className="flex gap-2"><span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-primary" /><span>{c}</span></li>
            ))}
          </ul>

          {hint ? (
            <div className="flex items-center gap-2 rounded-md border border-dashed px-2.5 py-1.5 text-sm" data-testid={`text-hint-${e.id}`}>
              <TrendingUp className="h-4 w-4 shrink-0 text-primary" />
              <span className="text-muted-foreground">Last: <span className="font-mono font-bold text-foreground">{hint.last}</span></span>
              <span className="ml-auto font-bold text-primary">{hint.next}</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 rounded-md border border-dashed px-2.5 py-1.5 text-sm text-muted-foreground">
              <Flame className="h-4 w-4 shrink-0" /> First time: last 2 reps should feel hard
            </div>
          )}
        </div>
      </div>

      <div className="mt-3 border-t pt-2">
        <div className="grid grid-cols-[2rem_1fr_1fr_3rem] gap-2 px-1 pb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          <span className="text-center">Set</span><span>{e.unit === "lb" ? "Weight" : "Load"}</span><span>{e.unit === "sec" ? "Time" : "Reps"}</span><span className="text-center">Done</span>
        </div>
        {Array.from({ length: e.sets }).map((_, i) => (
          <SetRow key={`${e.id}-${i}-${date}`} e={e} idx={i} day={day} date={date}
            logged={todays.find((l) => l.setIndex === i)} defaultWeight={hint?.weight ?? null} />
        ))}
      </div>
    </article>
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
          {items.map((b) => (
            <li key={b.name} className="flex items-center justify-between py-2 text-sm">
              <span>{b.name}</span><span className="font-mono text-xs text-muted-foreground">{b.detail}</span>
            </li>
          ))}
        </ul>
      )}
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
  const { data: logs = [], isLoading } = useQuery<SetLog[]>({ queryKey: ["/api/sets"] });

  const all = [...plan.main, plan.finisher];
  const totalSets = all.reduce((a, e) => a + e.sets, 0);
  const doneSets = useMemo(() => logs.filter((l) => l.date === date && all.some((e) => e.id === l.exerciseId)).length, [logs, date, n]);
  const pct = Math.round((doneSets / totalSets) * 100);
  const isToday = !t.rest && t.n === n;

  const timeline = [
    { label: "Warm-up", min: 5, cls: "bg-muted-foreground/40" },
    { label: "Main lifts", min: 45, cls: "bg-primary" },
    { label: "Finisher", min: 8, cls: "bg-chart-2" },
    { label: "Stretch", min: 2, cls: "bg-chart-3" },
  ];

  return (
    <div className="space-y-3">
      {/* Header */}
      <section className="rounded-xl border bg-card p-4" data-testid="section-day-header">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              <span>Day {plan.n} · {plan.weekday}</span>
              {isToday && <span className="rounded bg-primary px-1.5 py-0.5 text-primary-foreground">Today</span>}
              {t.rest && t.n === n && <span className="rounded bg-secondary px-1.5 py-0.5">Rest day · next up</span>}
            </div>
            <h1 className="mt-1 text-xl font-bold leading-tight" data-testid="text-day-title">{plan.title}</h1>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {plan.muscles.map((m) => <span key={m} className="rounded-md bg-secondary px-2 py-0.5 text-xs font-medium">{m}</span>)}
            </div>
          </div>
          <div className="relative h-16 w-16 shrink-0" aria-label={`${pct}% of sets done`} data-testid="status-progress">
            <svg viewBox="0 0 36 36" className="h-16 w-16 -rotate-90">
              <circle cx="18" cy="18" r="15.5" fill="none" stroke="hsl(var(--muted))" strokeWidth="3.5" />
              <circle cx="18" cy="18" r="15.5" fill="none" stroke="hsl(var(--primary))" strokeWidth="3.5" strokeLinecap="round"
                strokeDasharray={`${(pct / 100) * 97.4} 97.4`} className="transition-all duration-500" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-mono text-sm font-bold leading-none">{doneSets}</span>
              <span className="text-[10px] text-muted-foreground">/{totalSets}</span>
            </div>
          </div>
        </div>
        <div className="mt-3">
          <div className="flex h-2 overflow-hidden rounded-full">
            {timeline.map((s) => <div key={s.label} className={s.cls} style={{ width: `${(s.min / 60) * 100}%` }} />)}
          </div>
          <div className="mt-1.5 flex justify-between text-[11px] text-muted-foreground">
            {timeline.map((s) => <span key={s.label}><span className="font-mono font-bold text-foreground">{s.min}′</span> {s.label}</span>)}
          </div>
        </div>
      </section>

      <BlockList title="Warm-up" minutes="5 min" items={plan.warmup} testid="section-warmup" />

      {isLoading
        ? Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-80 animate-pulse rounded-xl bg-card" />)
        : (
          <>
            {plan.main.map((e, i) => <ExerciseCard key={e.id} e={e} n={i + 1} day={plan.n} date={date} logs={logs} />)}
            <div className="flex items-center gap-2 pt-2 text-xs font-bold uppercase tracking-wider text-muted-foreground"><Flame className="h-3.5 w-3.5 text-chart-2" /> Finisher</div>
            <ExerciseCard e={plan.finisher} n={7} tag="F" day={plan.n} date={date} logs={logs} />
          </>
        )}

      <BlockList title="Stretch" minutes="2 min" items={plan.stretch} testid="section-stretch" />
    </div>
  );
}
