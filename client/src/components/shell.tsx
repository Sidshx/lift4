import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { BarChart3, Moon, Sun, Pause, Play, X, Plus } from "lucide-react";
import { PLAN, todaysDay } from "@/data/plan";
import { cn } from "@/lib/utils";

/* ---------- Logo ---------- */
export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" fill="none" aria-label="Lift4 logo" className={className}>
      <rect x="3" y="9" width="5" height="14" rx="2" fill="currentColor" />
      <rect x="24" y="9" width="5" height="14" rx="2" fill="currentColor" />
      <rect x="8" y="14" width="16" height="4" rx="1.5" fill="currentColor" opacity="0.55" />
      <path d="M17 5 L13 12 H18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-primary" style={{ stroke: "hsl(var(--primary))" }} />
    </svg>
  );
}

/* ---------- Theme ---------- */
function useTheme() {
  const [dark, setDark] = useState(true);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);
  return { dark, toggle: () => setDark((d) => !d) };
}

/* ---------- Rest timer ---------- */
type TimerCtx = { start: (sec: number, label: string) => void };
const TimerContext = createContext<TimerCtx>({ start: () => {} });
export const useRestTimer = () => useContext(TimerContext);

function beep() {
  try {
    const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
    const ctx = new Ctx();
    [0, 0.25].forEach((t) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.15, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.2);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + t);
      o.stop(ctx.currentTime + t + 0.2);
    });
    navigator.vibrate?.([200, 100, 200]);
  } catch {}
}

function RestBar({ total, left, label, paused, onPause, onAdd, onClose }: {
  total: number; left: number; label: string; paused: boolean;
  onPause: () => void; onAdd: () => void; onClose: () => void;
}) {
  const pct = total ? (left / total) * 100 : 0;
  const mm = Math.floor(left / 60);
  const ss = String(left % 60).padStart(2, "0");
  const done = left === 0;
  return (
    <div className="fixed inset-x-0 bottom-[68px] z-40 px-3 pb-2" data-testid="rest-timer">
      <div className={cn("mx-auto max-w-3xl overflow-hidden rounded-xl border bg-popover shadow-lg", done && "border-primary")}>
        <div className="flex items-center gap-3 px-4 py-2.5">
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{done ? "Go — next set" : "Rest"} · {label}</div>
            <div className={cn("font-mono text-2xl font-bold tabular-nums", done && "text-primary")} data-testid="text-timer">{mm}:{ss}</div>
          </div>
          <button onClick={onAdd} className="flex h-10 items-center gap-1 rounded-lg bg-secondary px-3 text-sm font-medium hover-elevate" data-testid="button-timer-add"><Plus className="h-4 w-4" />15s</button>
          <button onClick={onPause} aria-label={paused ? "Resume" : "Pause"} className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary hover-elevate" data-testid="button-timer-pause">
            {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
          </button>
          <button onClick={onClose} aria-label="Close timer" className="flex h-10 w-10 items-center justify-center rounded-lg bg-secondary hover-elevate" data-testid="button-timer-close"><X className="h-4 w-4" /></button>
        </div>
        <div className="h-1 bg-muted"><div className="h-full bg-primary transition-[width] duration-1000 ease-linear" style={{ width: `${pct}%` }} /></div>
      </div>
    </div>
  );
}

/* ---------- Shell ---------- */
export function Shell({ children }: { children: ReactNode }) {
  const { dark, toggle } = useTheme();
  const [loc] = useLocation();
  const today = todaysDay();

  const [timer, setTimer] = useState<{ total: number; left: number; label: string } | null>(null);
  const [paused, setPaused] = useState(false);
  const fired = useRef(false);

  useEffect(() => {
    if (!timer || paused || timer.left <= 0) return;
    const id = setInterval(() => {
      setTimer((t) => (t ? { ...t, left: Math.max(0, t.left - 1) } : t));
    }, 1000);
    return () => clearInterval(id);
  }, [timer?.left, paused, !!timer]);

  useEffect(() => {
    if (timer && timer.left === 0 && !fired.current) {
      fired.current = true;
      beep();
    }
  }, [timer?.left]);

  const start = (sec: number, label: string) => {
    fired.current = false;
    setPaused(false);
    setTimer({ total: sec, left: sec, label });
  };

  const tabs = [
    ...PLAN.map((d) => ({ href: `/day/${d.n}`, top: `D${d.n}`, sub: d.short, isToday: d.n === today.n && !today.rest })),
    { href: "/progress", top: "", sub: "Progress", isToday: false },
  ];

  return (
    <TimerContext.Provider value={{ start }}>
      <div className="min-h-dvh bg-background text-foreground">
        <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-3xl items-center gap-2 px-4">
            <Link href="/" className="flex items-center gap-2" data-testid="link-home">
              <Logo className="h-7 w-7 text-foreground" />
              <span className="text-base font-bold tracking-tight">Lift<span className="text-primary">4</span></span>
            </Link>
            <span className="ml-2 hidden text-xs text-muted-foreground sm:inline">4 days · 60 min · muscle + weight</span>
            <button onClick={toggle} aria-label="Toggle theme" className="ml-auto flex h-9 w-9 items-center justify-center rounded-lg hover-elevate" data-testid="button-theme">
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
          </div>
        </header>

        <main className={cn("mx-auto max-w-3xl px-4 pt-4", timer ? "pb-48" : "pb-28")}>{children}</main>

        {timer && (
          <RestBar
            {...timer}
            paused={paused}
            onPause={() => setPaused((p) => !p)}
            onAdd={() => { fired.current = false; setTimer((t) => (t ? { ...t, left: t.left + 15, total: Math.max(t.total, t.left + 15) } : t)); }}
            onClose={() => setTimer(null)}
          />
        )}

        <nav className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur" aria-label="Days">
          <div className="mx-auto grid h-[68px] max-w-3xl grid-cols-5 px-2 pb-[env(safe-area-inset-bottom)]">
            {tabs.map((t) => {
              const active = loc === t.href || (loc === "/" && t.href === `/day/${today.n}`);
              return (
                <Link key={t.href} href={t.href} data-testid={`link-tab-${t.sub.toLowerCase()}`}
                  className={cn("relative flex flex-col items-center justify-center gap-0.5 rounded-lg text-muted-foreground transition-colors", active && "text-foreground")}>
                  {t.top ? (
                    <span className={cn("font-mono text-base font-bold", active && "text-primary")}>{t.top}</span>
                  ) : (
                    <BarChart3 className={cn("h-5 w-5", active && "text-primary")} />
                  )}
                  <span className="text-[11px] font-medium">{t.sub}</span>
                  {t.isToday && <span className="absolute right-3 top-2 h-1.5 w-1.5 rounded-full bg-primary" aria-label="Today" />}
                  {active && <span className="absolute inset-x-5 top-0 h-0.5 rounded-full bg-primary" />}
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </TimerContext.Provider>
  );
}
