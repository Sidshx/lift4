import { useRef, useState } from "react";
import { Check, Cloud, CloudOff, Copy, Download, ExternalLink, RefreshCw, Upload, Smartphone, AlertTriangle } from "lucide-react";
import code from "../../../apps-script/Code.gs?raw";
import { useStore, setSyncUrl, pendingCount, exportJSON, importJSON, persistent } from "@/lib/store";
import { syncNow, testUrl } from "@/lib/sync";
import { cn } from "@/lib/utils";


function Section({ title, children, testid }: { title: string; children: React.ReactNode; testid: string }) {
  return (
    <section className="rounded-xl border bg-card p-4" data-testid={testid}>
      <h2 className="mb-3 text-sm font-bold">{title}</h2>
      {children}
    </section>
  );
}

export default function SettingsPage() {
  const url = useStore((s) => s.syncUrl);
  const sheetUrl = useStore((s) => s.sheetUrl);
  const status = useStore((s) => s.status);
  const lastSync = useStore((s) => s.lastSync);
  const lastError = useStore((s) => s.lastError);
  const pending = useStore((s) => pendingCount(s));
  const [draft, setDraft] = useState(url);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const file = useRef<HTMLInputElement>(null);

  const connect = async () => {
    setBusy(true); setMsg(null);
    const err = await testUrl(draft.trim());
    if (err) { setMsg({ ok: false, text: err }); setBusy(false); return; }
    setSyncUrl(draft.trim());
    const ok = await syncNow();
    setMsg({ ok, text: ok ? "Connected. Your data is in the sheet." : "Connected, but the first sync failed. It will retry." });
    setBusy(false);
  };

  const copy = async () => {
    try { await navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch {}
  };

  const download = () => {
    const blob = new Blob([exportJSON()], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `lift4-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  };

  const statusText: Record<string, string> = {
    off: "Not connected", synced: "All synced", pending: `${pending} change${pending === 1 ? "" : "s"} waiting`,
    syncing: "Syncing…", offline: `Offline · ${pending} waiting`, error: "Sync error — will retry",
  };

  return (
    <div className="space-y-3">
      <h1 className="text-xl font-bold">Settings</h1>

      {!persistent && (
        <div className="flex gap-2 rounded-xl border border-chart-2 bg-chart-2/10 p-3 text-sm" data-testid="warn-storage">
          <AlertTriangle className="h-4 w-4 shrink-0 text-chart-2" />
          This browser view can't save data on the device. Open the app from its own link or home-screen icon.
        </div>
      )}

      <Section title="Google Sheet sync" testid="section-sync">
        <div className="mb-3 flex items-center gap-2 rounded-lg bg-secondary px-3 py-2 text-sm" data-testid="status-sync">
          {status === "off" || status === "offline" ? <CloudOff className="h-4 w-4 text-muted-foreground" /> : <Cloud className={cn("h-4 w-4", status === "error" ? "text-chart-2" : "text-primary")} />}
          <span className="font-medium">{statusText[status]}</span>
          {lastSync && <span className="ml-auto text-xs text-muted-foreground">Last {new Date(lastSync).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>}
        </div>
        {status === "error" && lastError && <p className="mb-2 font-mono text-xs text-chart-2">{lastError}</p>}

        <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground" htmlFor="sync-url">Web app URL</label>
        <input id="sync-url" value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="https://script.google.com/macros/s/…/exec"
          className="mt-1 h-11 w-full rounded-md border bg-background px-3 font-mono text-xs" data-testid="input-sync-url" autoCapitalize="off" autoCorrect="off" spellCheck={false} />
        <div className="mt-2 flex gap-2">
          <button onClick={connect} disabled={!draft.trim() || busy} className="h-10 flex-1 rounded-md bg-primary text-sm font-bold text-primary-foreground disabled:opacity-50" data-testid="button-connect">{busy ? "Checking…" : url ? "Save & sync" : "Connect"}</button>
          <button onClick={() => syncNow()} disabled={!url} className="flex h-10 items-center gap-1.5 rounded-md bg-secondary px-3 text-sm font-medium disabled:opacity-50" data-testid="button-sync-now"><RefreshCw className="h-4 w-4" />Sync</button>
          {sheetUrl && <a href={sheetUrl} target="_blank" rel="noreferrer" className="flex h-10 items-center gap-1.5 rounded-md bg-secondary px-3 text-sm font-medium" data-testid="link-sheet"><ExternalLink className="h-4 w-4" />Sheet</a>}
        </div>
        {msg && <p className={cn("mt-2 text-sm", msg.ok ? "text-primary" : "text-chart-2")} data-testid="text-sync-msg">{msg.text}</p>}
        <p className="mt-2 text-xs text-muted-foreground">Data is saved on this phone first. It syncs in the background when you're online.</p>
      </Section>

      <Section title="One-time sheet setup (desktop, 3 min)" testid="section-setup">
        <ol className="space-y-1.5 text-sm">
          {[
            <>Open your <b>Lift4 — Workout Log</b> Google Sheet → Extensions → Apps Script</>,
            <>Delete the sample code, paste the script below, press Save</>,
            <>Run <span className="font-mono">authorize</span> once → Allow</>,
            <>Deploy → New deployment → type Web app · Execute as Me · Access Anyone → Deploy</>,
            <>Copy the Web app URL (ends in /exec) → paste it above → Connect</>,
          ].map((s, i) => (
            <li key={i} className="flex gap-2"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-secondary font-mono text-[11px] font-bold">{i + 1}</span><span>{s}</span></li>
          ))}
        </ol>
        <div className="relative mt-3">
          <pre className="max-h-40 overflow-auto rounded-lg bg-secondary p-3 font-mono text-[10px] leading-snug text-muted-foreground">{code}</pre>
          <button onClick={copy} className="absolute right-2 top-2 flex h-8 items-center gap-1 rounded-md bg-primary px-2.5 text-xs font-bold text-primary-foreground" data-testid="button-copy-script">
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}{copied ? "Copied" : "Copy"}
          </button>
        </div>
      </Section>

      <Section title="Install on iPhone" testid="section-install">
        <div className="flex gap-3 text-sm">
          <Smartphone className="h-5 w-5 shrink-0 text-primary" />
          <p>Open this page in <b>Safari</b> → tap <b>Share</b> → <b>Add to Home Screen</b>. It opens full-screen and works offline at the gym.</p>
        </div>
      </Section>

      <Section title="Backup" testid="section-backup">
        <div className="flex gap-2">
          <button onClick={download} className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-md bg-secondary text-sm font-medium" data-testid="button-export"><Download className="h-4 w-4" />Export</button>
          <button onClick={() => file.current?.click()} className="flex h-10 flex-1 items-center justify-center gap-1.5 rounded-md bg-secondary text-sm font-medium" data-testid="button-import"><Upload className="h-4 w-4" />Import</button>
          <input ref={file} type="file" accept="application/json" className="hidden" onChange={async (e) => {
            const f = e.target.files?.[0]; if (!f) return;
            try { importJSON(await f.text()); setMsg({ ok: true, text: "Backup restored." }); } catch { setMsg({ ok: false, text: "That file isn't a Lift4 backup." }); }
          }} />
        </div>
      </Section>
    </div>
  );
}
