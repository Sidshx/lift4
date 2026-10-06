import { PLAN, weekKey } from "@/data/plan";
import { exInfo, getState, markSynced, setChangeHandler, setStatus, setSheetUrl, setFitbit } from "@/lib/store";

let timer: ReturnType<typeof setTimeout> | null = null;
let inFlight = false;

export async function syncNow(): Promise<boolean> {
  const s = getState();
  if (!s.syncUrl) { setStatus("off"); return false; }
  if (!navigator.onLine) { setStatus("offline"); return false; }
  if (inFlight) return false;

  const sets = s.sets.filter((x) => x.dirty);
  const sessions = s.sessions.filter((x) => x.dirty);
  const bws = s.bodyweights.filter((x) => x.dirty);
  if (!sets.length && !sessions.length && !bws.length) { setStatus("synced"); return true; }

  const payload = {
    app: "lift4",
    sets: sets.map((x) => {
      const e = exInfo(x.exerciseId);
      return {
        id: x.id, date: x.date, week: weekKey(x.date), day: x.day,
        exercise: e?.name ?? x.exerciseId, muscle: e?.muscle ?? "", set: x.setIndex + 1,
        weight: x.weight, reps: x.reps, deleted: !!x.deleted,
      };
    }),
    sessions: sessions.map((x) => ({
      id: x.id, date: x.date, week: weekKey(x.date), day: x.day,
      focus: PLAN.find((d) => d.n === x.day)?.title ?? "", sets: x.sets, volume: x.volume,
      exercises: x.exercises, finishedAt: x.finishedAt, deleted: !!x.deleted,
    })),
    bodyweights: bws.map((x) => ({ id: x.id, date: x.date, week: weekKey(x.date), kg: x.kg, deleted: !!x.deleted })),
  };
  const snapshot = {
    sets: new Map(sets.map((x) => [x.id, x.ts + (x.deleted ? 1 : 0)])),
    sessions: new Map(sessions.map((x) => [x.id, x.finishedAt + (x.deleted ? 1 : 0)])),
    bw: new Map(bws.map((x) => [x.id, (x.ts ?? 0) + (x.deleted ? 1 : 0)])),
  };

  inFlight = true;
  setStatus("syncing");
  try {
    // text/plain avoids a CORS preflight; Apps Script reads e.postData.contents
    const res = await fetch(s.syncUrl, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(payload), redirect: "follow" });
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || "Sheet rejected the data");
    markSynced({ sets: new Set(snapshot.sets.keys()), sessions: new Set(snapshot.sessions.keys()), bw: new Set(snapshot.bw.keys()) }, snapshot);
    inFlight = false;
    // something changed meanwhile? go again
    const again = getState();
    if (again.sets.some((x) => x.dirty) || again.sessions.some((x) => x.dirty) || again.bodyweights.some((x) => x.dirty)) schedule(1500);
    return true;
  } catch (err: any) {
    inFlight = false;
    setStatus(navigator.onLine ? "error" : "offline", String(err?.message ?? err));
    return false;
  }
}

export async function testUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { method: "GET", redirect: "follow" });
    const json = await res.json();
    if (json.ok && json.app === "lift4" && json.sheet) setSheetUrl(json.sheet);
    if (json.ok && Array.isArray(json.fitbit)) setFitbit(json.fitbit);
    return json.ok && json.app === "lift4" ? null : "That link didn't answer like the Lift4 script.";
  } catch {
    return "Couldn't reach that link. Check it's the Web app URL ending in /exec and access is 'Anyone'.";
  }
}

let lastPull = 0;
export async function pullFitbit(force = false) {
  const s = getState();
  if (!s.syncUrl || !navigator.onLine || (!force && Date.now() - lastPull < 10 * 60 * 1000)) return;
  lastPull = Date.now();
  try {
    const json = await (await fetch(s.syncUrl, { redirect: "follow" })).json();
    if (json.ok && Array.isArray(json.fitbit)) setFitbit(json.fitbit);
  } catch {}
}

/** Ask the sheet to start a Fitbit sync, then poll for fresh rows for ~4 min. */
export async function requestFitbitSync(onUpdate: (msg: string, done?: boolean) => void) {
  const s = getState();
  if (!s.syncUrl) return onUpdate("Connect the sheet first.", true);
  if (!navigator.onLine) return onUpdate("You're offline.", true);
  try {
    const json = await (await fetch(s.syncUrl + (s.syncUrl.includes("?") ? "&" : "?") + "refresh=1", { redirect: "follow" })).json();
    if (!json.ok) throw new Error();
    if (json.requested === false) onUpdate(`Sync already requested. Checking for new data…`);
    else if (json.requested !== true) return onUpdate("Update the sheet script (Settings → setup) to enable this.", true);
    else onUpdate("Sync started. New data in about 1–3 min…");
  } catch {
    return onUpdate("Couldn't reach the sheet.", true);
  }
  const before = JSON.stringify(getState().fitbit.slice(-2));
  for (let i = 0; i < 8; i++) {
    await new Promise((r) => setTimeout(r, 30000));
    await pullFitbit(true);
    if (JSON.stringify(getState().fitbit.slice(-2)) !== before) return onUpdate("Fitbit data updated.", true);
  }
  onUpdate("No new data yet. Open the Fitbit app to sync your watch, then try again.", true);
}

function schedule(ms = 2500) {
  if (timer) clearTimeout(timer);
  timer = setTimeout(() => { timer = null; syncNow(); }, ms);
}

export function startSync() {
  setChangeHandler(() => {
    const s = getState();
    if (!s.syncUrl) return;
    setStatus(navigator.onLine ? "pending" : "offline");
    schedule();
  });
  window.addEventListener("online", () => schedule(500));
  window.addEventListener("offline", () => getState().syncUrl && setStatus("offline"));
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") { schedule(800); pullFitbit(); } });
  setInterval(() => { const s = getState(); if (s.syncUrl && s.status !== "synced") syncNow(); }, 60000);
  schedule(1000);
  pullFitbit();
}
