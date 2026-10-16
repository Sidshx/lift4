import { useState } from "react";
import { Link } from "wouter";
import { AlertTriangle, Check, ChevronDown, Pause, Play, CalendarRange } from "lucide-react";
import { PLAN, todayISO, weekKey } from "@/data/plan";
import { useStore, liveSets, setPause } from "@/lib/store";
import { coverage, addDays, type GroupRow, type Status } from "@/lib/coach";
import { cn } from "@/lib/utils";

const CHIP: Record<Status, { label: string; cls: string }> = {
  done: { label: "Done", cls: "bg-primary text-primary-foreground" },
  paused: { label: "Paused", cls: "bg-secondary text-muted-foreground" },
  todo: { label: "To do", cls: "bg-secondary text-foreground" },
  due: { label: "Due", cls: "bg-chart-4 text-black" },
  risk: { label: "At risk", cls: "bg-chart-2 text-white" },
  missed: { label: "Missed", cls: "bg-chart-2 text-white" },
};
const md = (iso: string) => new Date(iso + "T12:00:00").toLocaleDateString([], { month: "short", day: "numeric" });
const short = (m: string) => m.replace("Hamstrings/Glutes", "Hams");

function Row({ r, wk }: { r: GroupRow; wk: string }) {
  const [open, setOpen] = useState(false);
  const pct = Math.min(100, r.planned ? (r.done / r.planned) * 100 : 0);
  const sunday = addDays(wk, 6);
  const choose = (until: string | null) => { setPause(r.group.key, until ? `${wk}|${until}` : null); setOpen(false); };
  return (
    <li className="py-2" data-testid={`row-group-${r.group.key}`}>
      <button onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-3 text-left" aria-expanded={open} data-testid={`button-group-${r.group.key}`}>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className={cn("text-sm font-bold", r.paused && "text-muted-foreground")}>{r.group.label}</span>
            <span className="font-mono text-xs tabular-nums text-muted-foreground">{r.done}/{r.planned} sets · {r.days}/{r.plannedDays}×</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
            <div className={cn("h-full rounded-full transition-all", r.paused ? "bg-muted-foreground/40" : r.status === "done" ? "bg-primary" : r.status === "risk" || r.status === "missed" ? "bg-chart-2" : r.status === "due" ? "bg-chart-4" : "bg-primary/70")} style={{ width: `${pct}%` }} />
          </div>
          {r.perMuscle.length > 1 && (
            <div className="mt-1 font-mono text-[11px] text-muted-foreground">{r.perMuscle.map((p) => `${short(p.m)} ${p.done}/${p.planned}`).join(" · ")}</div>
          )}
        </div>
        <span className={cn("shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-bold", CHIP[r.status].cls)}>
          {r.status === "done" ? <Check className="inline h-3 w-3" strokeWidth={3} /> : null} {CHIP[r.status].label}
        </span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5" data-testid={`panel-pause-${r.group.key}`}>
          {r.paused ? (
            <>
              <span className="text-xs text-muted-foreground">Paused until {r.pausedUntil === "9999-12-31" ? "you resume" : md(r.pausedUntil!)}. Not counted as missed.</span>
              <button onClick={() => choose(null)} className="flex h-8 items-center gap-1 rounded-md bg-primary px-2.5 text-xs font-bold text-primary-foreground" data-testid={`button-resume-${r.group.key}`}><Play className="h-3 w-3" />Resume</button>
            </>
          ) : (
            <>
              <span className="flex items-center gap-1 text-xs text-muted-foreground"><Pause className="h-3 w-3" />Skip on purpose:</span>
              <button onClick={() => choose(sunday)} className="h-8 rounded-md border px-2.5 text-xs font-medium hover-elevate" data-testid={`button-pause1-${r.group.key}`}>This week</button>
              <button onClick={() => choose(addDays(sunday, 7))} className="h-8 rounded-md border px-2.5 text-xs font-medium hover-elevate" data-testid={`button-pause2-${r.group.key}`}>2 weeks</button>
              <button onClick={() => choose("9999-12-31")} className="h-8 rounded-md border px-2.5 text-xs font-medium hover-elevate" data-testid={`button-pause-${r.group.key}`}>Until I resume</button>
            </>
          )}
        </div>
      )}
    </li>
  );
}

/** Muscle groups planned vs done this week, no matter which day you trained them. */
export function WeekCoverage({ collapsible = false }: { collapsible?: boolean }) {
  const sets = useStore(liveSets);
  const pauses = useStore((s) => s.pauses ?? {});
  const today = todayISO();
  const wk = weekKey(today);
  const [open, setOpen] = useState(!collapsible);
  const c = coverage(sets, wk, pauses, today);
  const last = coverage(sets, weekKey(addDays(wk, -7)), pauses, today);
  const lastShort = last.rows.filter((r) => r.status === "missed");
  const anySetsLastWeek = last.rows.some((r) => r.done > 0);
  const urgent = c.behind.some((r) => r.status === "risk" || r.status === "due");
  const tooMany = c.needDays.length > c.daysLeft;

  return (
    <section className="rounded-xl border bg-card" data-testid="card-week-coverage">
      <button disabled={!collapsible} onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-3 px-4 py-3 text-left" data-testid="button-toggle-week">
        <CalendarRange className="h-4 w-4 shrink-0 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold">This week · {c.doneCount}/{c.active} muscle groups done</div>
          <div className="text-xs text-muted-foreground">{md(wk)} – {md(addDays(wk, 6))} · {c.daysLeft} day{c.daysLeft === 1 ? "" : "s"} left · any day counts</div>
        </div>
        {collapsible && <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />}
      </button>

      {c.behind.length > 0 && (
        <div className={cn("mx-4 mb-3 rounded-lg px-3 py-2 text-sm", tooMany ? "bg-chart-2/15" : urgent ? "bg-chart-4/15" : "bg-secondary")} data-testid="text-week-behind">
          <div className="flex items-start gap-2">
            {(urgent || tooMany) && <AlertTriangle className={cn("mt-0.5 h-4 w-4 shrink-0", tooMany ? "text-chart-2" : "text-chart-4")} />}
            <div className="min-w-0">
              <span className="font-bold">Still to hit: </span>
              {c.behind.map((r) => `${r.group.label} ${r.done}/${r.planned}`).join(", ")}
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
                <span className="text-muted-foreground">{tooMany ? `Needs ${c.needDays.length} sessions, ${c.daysLeft} day${c.daysLeft === 1 ? "" : "s"} left. Combine, or pause one:` : "Covered by"}</span>
                {c.needDays.map((n) => (
                  <Link key={n} href={`/day/${n}`} className="rounded-md bg-background px-2 py-0.5 font-bold hover-elevate" data-testid={`link-need-day-${n}`}>D{n} {PLAN.find((d) => d.n === n)?.short}</Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
      {c.behind.length === 0 && (
        <div className="mx-4 mb-3 flex items-center gap-2 rounded-lg bg-primary/10 px-3 py-2 text-sm font-medium" data-testid="text-week-done"><Check className="h-4 w-4 text-primary" strokeWidth={3} />Every active muscle group is covered this week.</div>
      )}

      {open && (
        <div className="border-t px-4 pb-2">
          <ul className="divide-y">{c.rows.map((r) => <Row key={r.group.key} r={r} wk={wk} />)}</ul>
          <p className="py-2 text-xs text-muted-foreground">Sets count toward a muscle on whatever day you do them. Tap a group to pause it on purpose so it isn't flagged.</p>
          {anySetsLastWeek && (
            <p className="pb-2 text-xs text-muted-foreground" data-testid="text-last-week">
              Last week: {lastShort.length ? <>short on <span className="font-bold text-foreground">{lastShort.map((r) => `${r.group.label} ${r.done}/${r.planned}`).join(", ")}</span></> : <span className="font-bold text-primary">everything covered</span>}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
