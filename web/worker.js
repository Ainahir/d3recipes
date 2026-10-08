// Copyright 2026 FNG. Use, modification and redistribution are permitted under the conditions in LICENSE:
// credit the source, and visibly link to the site or repository if you use its outputs in a user-facing application.
// Runs the wasm engine off the UI thread; searches run in slices so a cancel or a new search can interrupt them.
// The `v` query param (set by index.html's stamped app.js src, forwarded through app.js's Worker URL) is appended
// to every sub-fetch below so a deploy's new wasm/data can never be served from a browser's stale HTTP cache
// under the old, unversioned URL (LEDGER V137 — this bit us during testing).
const v = new URL(self.location.href).searchParams.get("v");
const qs = v ? `?v=${v}` : "";

let engine = null;
let job = 0;

async function boot() {
  const { default: init, Engine } = await import(`./pkg/d3cube.js${qs}`);
  await init({ module_or_path: `./pkg/d3cube_bg.wasm${qs}` });
  const res = await fetch(`./data.json${qs}`);
  const text = await res.text();
  engine = new Engine(text);
  postMessage({ type: "ready", info: JSON.parse(engine.describe()) });
}

function search(id, query, budgetMs) {
  let handle;
  try {
    handle = engine.search(JSON.stringify(query));
  } catch (e) {
    postMessage({ type: "error", id, message: String(e) });
    return;
  }
  const t0 = performance.now();
  let lastPost = 0;
  const slice = () => {
    if (id !== job) { handle.free(); return; }          // cancelled or superseded
    const done = handle.run(20000);
    const now = performance.now();
    const timeUp = now - t0 > budgetMs;
    if (done || timeUp || now - lastPost > 600) {
      lastPost = now;
      const r = JSON.parse(handle.results());
      r.status.timeUp = timeUp && !done;
      r.status.ms = Math.round(now - t0);
      postMessage({ type: done || timeUp ? "done" : "progress", id, results: r });
    }
    if (done || timeUp) { handle.free(); return; }
    setTimeout(slice, 0);
  };
  setTimeout(slice, 0);
}

onmessage = (e) => {
  const m = e.data;
  if (m.type === "search") { job = m.id; search(m.id, m.query, m.budgetMs); }
  else if (m.type === "cancel") { job = -1; }
  else if (m.type === "stems") { postMessage({ type: "stems", key: m.key, stems: JSON.parse(engine.stems(m.class, m.slot, m.item || 0)), max: JSON.parse(engine.stat_max(m.class, m.slot, m.item || 0)) }); }
};

boot().catch((e) => postMessage({ type: "error", message: "Could not start: " + e }));
