import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Area, Bar, BarChart, CartesianGrid, ComposedChart, Line, LineChart, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Scale, Dumbbell, CalendarCheck, TrendingUp, ChevronRight } from "lucide-react";
import type { Bodyweight, SetLog } from "@shared/schema";
import { ALL_EXERCISES, MUSCLES, PLAN, PROFILE, todayISO, weekKey } from "@/data/plan";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { cn } from "@/lib/utils";

const axis = { stroke: "hsl(var(--muted-foreground))", fontSize: 11, tickLine: false, axisLine: false } as const;
const tip = {
  contentStyle: { background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 },
  labelStyle: { color: "hsl(var(--muted-foreground))" },
  itemStyle: { color: "hsl(var(--foreground))" },
};
const short = (iso: string) => { const [, m, d] = iso.split("-"); return `${Number(m)}/${Number(d)}`; };
const daysBetween = (a: string, b: string) => (new Date(b).getTime() - new Date(a).getTime()) / 86400000;

function Card({ title, right, children, testid }: { title: string; right?: React.ReactNode; children: React.ReactNode; testid: string }) {
  return (
    <section className="rounded-xl border bg-card p-4" data-testid={testid}>
      <div className="mb-3 flex items-center gap-2"><h2 className="text-sm font-bold">{title}</h2><div className="ml-auto">{right}</div></div>
      {children}
    </section>
  );
}

function Kpi({ icon, label, value, sub, testid }: { icon: React.ReactNode; label: string; value: string; sub?: string; testid: string }) {
  return (
    <div className="rounded-xl border bg-card p-3" data-testid={testid}>
      <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">{icon}{label}</div>
      <div className="mt-1 font-mono text-xl font-bold tabular-nums">{value}</div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <div className="flex h-40 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">{text}</div>;
}

export default function ProgressPage() {
  const { data: logs = [] } = useQuery<SetLog[]>({ queryKey: ["/api/sets"] });
  const { data: bws = [] } = useQuery<Bodyweight[]>({ queryKey: ["/api/bodyweights"] });
  const today = todayISO();
  const thisWeek = weekKey(today);

  /* KPIs */
  const sessions = useMemo(() => {
    const s = new Map<string, { date: string; day: number }>();
    logs.forEach((l) => s.set(`${l.date}-${l.day}`, { date: l.date, day: l.day }));
    return Array.from(s.values());
  }, [logs]);
  const weekSessions = sessions.filter((s) => weekKey(s.date) === thisWeek);
  const latestBw = bws.length ? bws[bws.length - 1] : null;
  const firstBw = bws.length ? bws[0] : null;
  const gain = latestBw ? latestBw.kg - PROFILE.startKg : 0;
  const weeksIn = firstBw && latestBw ? Math.max(daysBetween(firstBw.date, latestBw.date) / 7, 0) : 0;
  const perWeek = weeksIn >= 1 && firstBw && latestBw ? (latestBw.kg - firstBw.kg) / weeksIn : null;

  /* Bodyweight chart with target band */
  const bwData = useMemo(() => {
    if (!bws.length) return [];
    const start = bws[0];
    return bws.map((b) => {
      const w = daysBetween(start.date, b.date) / 7;
      const lo = +(start.kg + PROFILE.weeklyGainKg[0] * w).toFixed(2);
      const hi = +(start.kg + PROFILE.weeklyGainKg[1] * w).toFixed(2);
      return { date: short(b.date), kg: b.kg, band: [lo, hi] as [number, number] };
    });
  }, [bws]);

  /* Strength per exercise */
  const liftable = ALL_EXERCISES.filter((e) => e.unit === "lb");
  const logged = liftable.filter((e) => logs.some((l) => l.exerciseId === e.id));
  const [exId, setExId] = useState<string>("");
  const selected = exId || logged[0]?.id || liftable[0].id;
  const strength = useMemo(() => {
    const byDate = new Map<string, { top: number; e1rm: number }>();
    logs.filter((l) => l.exerciseId === selected).forEach((l) => {
      const e1 = l.weight * (1 + l.reps / 30);
      const cur = byDate.get(l.date) ?? { top: 0, e1rm: 0 };
      byDate.set(l.date, { top: Math.max(cur.top, l.weight), e1rm: Math.max(cur.e1rm, Math.round(e1)) });
    });
    return Array.from(byDate.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([d, v]) => ({ date: short(d), ...v }));
  }, [logs, selected]);

  /* Weekly volume per muscle */
  const volume = useMemo(() => {
    const exMuscle = new Map(ALL_EXERCISES.map((e) => [e.id, e.muscle]));
    const counts = Object.fromEntries(MUSCLES.map((m) => [m, 0])) as Record<string, number>;
    logs.filter((l) => weekKey(l.date) === thisWeek).forEach((l) => {
      const m = exMuscle.get(l.exerciseId);
      if (m) counts[m] += 1;
    });
    const planned = Object.fromEntries(MUSCLES.map((m) => [m, 0])) as Record<string, number>;
    ALL_EXERCISES.forEach((e) => (planned[e.muscle] += e.sets));
    return MUSCLES.map((m) => ({ muscle: m.replace("Hamstrings/Glutes", "Hams/Glutes"), done: counts[m], plan: planned[m] }));
  }, [logs, thisWeek]);

  /* Workouts per week (last 8) */
  const weekly = useMemo(() => {
    const out: { wk: string; n: number }[] = [];
    const d = new Date();
    for (let i = 7; i >= 0; i--) {
      const x = new Date(d); x.setDate(d.getDate() - i * 7);
      const k = weekKey(todayISO(x));
      out.push({ wk: short(k), n: sessions.filter((s) => weekKey(s.date) === k).length });
    }
    return out;
  }, [sessions]);

  /* Bodyweight form */
  const [kg, setKg] = useState("");
  const saveBw = useMutation({
    mutationFn: async () => (await apiRequest("POST", "/api/bodyweights", { date: today, kg: Number(kg) })).json(),
    onSuccess: () => { setKg(""); queryClient.invalidateQueries({ queryKey: ["/api/bodyweights"] }); },
  });

  return (
    <div className="space-y-3">
      <h1 className="text-xl font-bold">Progress</h1>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Kpi testid="kpi-bodyweight" icon={<Scale className="h-3.5 w-3.5" />} label="Bodyweight" value={latestBw ? `${latestBw.kg} kg` : `${PROFILE.startKg} kg`} sub={`${gain >= 0 ? "+" : ""}${gain.toFixed(1)} kg from 61`} />
        <Kpi testid="kpi-rate" icon={<TrendingUp className="h-3.5 w-3.5" />} label="Gain / week" value={perWeek != null ? `${perWeek >= 0 ? "+" : ""}${perWeek.toFixed(2)}` : "—"} sub="Target +0.25–0.5 kg" />
        <Kpi testid="kpi-week" icon={<CalendarCheck className="h-3.5 w-3.5" />} label="This week" value={`${weekSessions.length}/4`} sub="workouts" />
        <Kpi testid="kpi-total" icon={<Dumbbell className="h-3.5 w-3.5" />} label="All time" value={`${sessions.length}`} sub={`${logs.length} sets logged`} />
      </div>

      <Card testid="card-bodyweight" title="Bodyweight (kg)" right={<span className="text-xs text-muted-foreground">Band = target gain</span>}>
        <form className="mb-3 flex gap-2" onSubmit={(e) => { e.preventDefault(); if (Number(kg) > 30) saveBw.mutate(); }}>
          <input inputMode="decimal" value={kg} onChange={(e) => setKg(e.target.value)} placeholder="Today's weight, e.g. 61.2"
            className="h-10 flex-1 rounded-md border bg-background px-3 font-mono text-sm" data-testid="input-bodyweight" aria-label="Today's bodyweight in kg" />
          <button type="submit" disabled={!kg || saveBw.isPending} className="h-10 rounded-md bg-primary px-4 text-sm font-bold text-primary-foreground disabled:opacity-50" data-testid="button-save-bodyweight">Log</button>
        </form>
        {bwData.length < 2 ? <Empty text="Log weight 2+ times (same time, morning) to see the trend" /> : (
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={bwData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <CartesianGrid stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="date" {...axis} />
                <YAxis domain={["dataMin - 0.5", "dataMax + 0.5"]} {...axis} />
                <Tooltip {...tip} />
                <Area dataKey="band" stroke="none" fill="hsl(var(--primary))" fillOpacity={0.12} name="Target" isAnimationActive={false} />
                <Line dataKey="kg" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ r: 3 }} name="kg" />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      <Card testid="card-strength" title="Strength" right={
        <select value={selected} onChange={(e) => setExId(e.target.value)} className="h-8 max-w-[11rem] rounded-md border bg-background px-2 text-xs" data-testid="select-exercise" aria-label="Exercise">
          {PLAN.map((d) => (
            <optgroup key={d.n} label={`Day ${d.n}`}>
              {[...d.main, d.finisher].filter((e) => e.unit === "lb").map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </optgroup>
          ))}
        </select>
      }>
        {strength.length === 0 ? <Empty text="Log sets for this exercise to see the line" /> : (
          <>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={strength} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <CartesianGrid stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="date" {...axis} />
                  <YAxis {...axis} />
                  <Tooltip {...tip} />
                  <Line dataKey="top" name="Top lb" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={{ r: 3 }} />
                  <Line dataKey="e1rm" name="Est. 1RM" stroke="hsl(var(--chart-2))" strokeWidth={2} strokeDasharray="4 3" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-1 flex gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 bg-primary" />Top weight</span>
              <span className="flex items-center gap-1.5"><span className="h-0.5 w-4 bg-chart-2" />Est. 1-rep max</span>
            </div>
          </>
        )}
      </Card>

      <Card testid="card-volume" title="Sets this week, by muscle" right={<span className="text-xs text-muted-foreground">Band = 10–14 sweet spot</span>}>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={volume} layout="vertical" margin={{ top: 0, right: 10, left: 10, bottom: 0 }} barGap={-12}>
              <CartesianGrid stroke="hsl(var(--border))" horizontal={false} />
              <ReferenceArea x1={10} x2={14} fill="hsl(var(--primary))" fillOpacity={0.08} />
              <XAxis type="number" domain={[0, 18]} {...axis} />
              <YAxis type="category" dataKey="muscle" width={78} {...axis} />
              <Tooltip {...tip} cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }} />
              <Bar dataKey="plan" name="Planned" fill="hsl(var(--muted))" barSize={12} radius={4} />
              <Bar dataKey="done" name="Done" fill="hsl(var(--primary))" barSize={12} radius={4} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card testid="card-weekly" title="Workouts per week" right={<span className="text-xs text-muted-foreground">Goal 4</span>}>
        <div className="h-36">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weekly} margin={{ top: 5, right: 5, left: -28, bottom: 0 }}>
              <CartesianGrid stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="wk" {...axis} />
              <YAxis domain={[0, 4]} ticks={[0, 2, 4]} {...axis} />
              <Tooltip {...tip} cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }} />
              <Bar dataKey="n" name="Workouts" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card testid="card-plan" title="Weekly plan">
        <div className="divide-y">
          {PLAN.map((d) => {
            const sets = [...d.main, d.finisher].reduce((a, e) => a + e.sets, 0);
            const done = weekSessions.some((s) => s.day === d.n);
            return (
              <Link key={d.n} href={`/day/${d.n}`} className="flex items-center gap-3 py-2.5" data-testid={`link-plan-day-${d.n}`}>
                <span className={cn("flex h-8 w-8 items-center justify-center rounded-lg font-mono text-sm font-bold", done ? "bg-primary text-primary-foreground" : "bg-secondary")}>{d.n}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-bold">{d.title}</div>
                  <div className="text-xs text-muted-foreground">{d.weekday} · 7 exercises · {sets} sets</div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </Link>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
