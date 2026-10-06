/**
 * Lift4 → Google Sheets sync.
 * Paste into Extensions → Apps Script of the "Lift4 — Workout Log" sheet,
 * then Deploy → New deployment → Web app (Execute as: Me, Access: Anyone).
 */
var TABS = {
  Log:        { cols: 11, id: 11 }, // Date|Week|Day|Exercise|Muscle|Set|Weight|Reps|Volume|Est1RM|ID
  Sessions:   { cols: 9,  id: 9 },  // Date|Week|Day|Focus|Sets|Volume|Exercises|Finished|ID
  Bodyweight: { cols: 5,  id: 5 }   // Date|Week|kg|Change|ID
};

function doGet() {
  var ss = SpreadsheetApp.getActive();
  var fb = ss.getSheetByName('Fitbit'), fitbit = [];
  if (fb && fb.getLastRow() > 1) {
    var n = Math.min(14, fb.getLastRow() - 1);
    fitbit = fb.getRange(fb.getLastRow() - n + 1, 1, n, 13).getDisplayValues().map(function (r) {
      return { date: r[0], sleep: r[1], deep: r[2], score: r[4], hrv: r[5], rhr: r[6], steps: r[7], readiness: r[11], tip: r[12] };
    });
  }
  return json_({ ok: true, app: 'lift4', sheet: ss.getUrl(), fitbit: fitbit });
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var body = JSON.parse(e.postData.contents);
    var ss = SpreadsheetApp.getActive();
    var n = 0;
    n += upsert_(ss.getSheetByName('Log'), TABS.Log, (body.sets || []).map(function (s) {
      var vol = s.weight * s.reps;
      var e1 = s.weight ? Math.round(s.weight * (1 + s.reps / 30)) : '';
      return { id: s.id, deleted: s.deleted, row: [d_(s.date), d_(s.week), 'D' + s.day, s.exercise, s.muscle, s.set, s.weight || '', s.reps, vol || '', e1, s.id] };
    }));
    n += upsert_(ss.getSheetByName('Sessions'), TABS.Sessions, (body.sessions || []).map(function (s) {
      return { id: s.id, deleted: s.deleted, row: [d_(s.date), d_(s.week), 'D' + s.day, s.focus, s.sets, s.volume, s.exercises, new Date(s.finishedAt), s.id] };
    }));
    n += upsert_(ss.getSheetByName('Bodyweight'), TABS.Bodyweight, (body.bodyweights || []).map(function (b) {
      return { id: b.id, deleted: b.deleted, row: [d_(b.date), d_(b.week), b.kg, '', b.id] };
    }));
    tidy_(ss);
    return json_({ ok: true, written: n });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function upsert_(sh, t, items) {
  if (!items.length) return 0;
  var last = sh.getLastRow();
  var ids = last > 1 ? sh.getRange(2, t.id, last - 1, 1).getValues().map(function (r) { return String(r[0]); }) : [];
  var index = {};
  ids.forEach(function (id, i) { index[id] = i + 2; });
  var toDelete = [], appends = [];
  items.forEach(function (it) {
    var r = index[it.id];
    if (it.deleted) { if (r) toDelete.push(r); return; }
    if (r) sh.getRange(r, 1, 1, t.cols).setValues([it.row]);
    else appends.push(it.row);
  });
  if (appends.length) sh.getRange(sh.getLastRow() + 1, 1, appends.length, t.cols).setValues(appends);
  toDelete.sort(function (a, b) { return b - a; }).forEach(function (r) { sh.deleteRow(r); });
  return items.length;
}

function tidy_(ss) {
  var log = ss.getSheetByName('Log');
  if (log.getLastRow() > 2) log.getRange(2, 1, log.getLastRow() - 1, TABS.Log.cols).sort([{ column: 1, ascending: true }, { column: 4, ascending: true }, { column: 6, ascending: true }]);
  var ses = ss.getSheetByName('Sessions');
  if (ses.getLastRow() > 2) ses.getRange(2, 1, ses.getLastRow() - 1, TABS.Sessions.cols).sort({ column: 1, ascending: true });
  var bw = ss.getSheetByName('Bodyweight');
  var n = bw.getLastRow() - 1;
  if (n > 0) {
    var rng = bw.getRange(2, 1, n, TABS.Bodyweight.cols);
    if (n > 1) rng.sort({ column: 1, ascending: true });
    var kg = bw.getRange(2, 3, n, 1).getValues();
    var first = kg[0][0];
    bw.getRange(2, 4, n, 1).setValues(kg.map(function (r) { return [Math.round((r[0] - first) * 10) / 10]; }));
  }
}

function d_(iso) {
  var p = String(iso).split('-');
  return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

/** Run once from the editor to approve permissions. */
function authorize() {
  SpreadsheetApp.getActive().getName();
}
