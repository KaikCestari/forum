"use strict";

/* ====================================================================
   AquaML — painel
   Seis vistas (bacia, estação, modelos, pipeline, dados e assistente) com
   roteamento por hash. Os dados vêm da API Java, do banco H2 e do Llama;
   nada aqui é inventado no navegador.
   ==================================================================== */

/* ---------- utilidades ---------- */

const $ = (sel, root = document) => root.querySelector(sel);
const css = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const nf = (d = 0) => new Intl.NumberFormat("pt-BR", { maximumFractionDigits: d, minimumFractionDigits: d });
const fmt = (v, d = 0) => (v == null || Number.isNaN(v) ? "—" : nf(d).format(v));
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const dmy = (s) => { const [y, m, d] = s.split("-"); return `${d}/${m}/${y}`; };
const monthLabel = (s) => { const [y, m] = s.split("-"); return `${MONTHS[+m - 1]}/${y.slice(2)}`; };
const toDate = (s) => new Date(`${s}T00:00:00`);
const dayDiff = (a, b) => Math.round((toDate(b) - toDate(a)) / 86400000);
const mean = (xs) => { const v = xs.filter((x) => x != null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
const lower1 = (s) => s.charAt(0).toLowerCase() + s.slice(1);
const joinPt = (xs) => (xs.length < 2 ? xs.join("") : `${xs.slice(0, -1).join(", ")} e ${xs.at(-1)}`);

async function api(path, opts) {
  const res = await fetch(path, opts);
  const body = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, body };
}

function countUp(el, to, digits = 0) {
  if (to == null) { el.textContent = "—"; return; }
  if (reduced()) { el.textContent = fmt(to, digits); return; }
  const from = 0, dur = 1000, t0 = performance.now();
  const tick = (t) => {
    const p = Math.min(1, (t - t0) / dur);
    const e = 1 - Math.pow(1 - p, 4);
    el.textContent = fmt(from + (to - from) * e, digits);
    if (p < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

/* ---------- domínio ---------- */

const IQA_VAR = { "Ótima": "--iqa-otima", "Boa": "--iqa-boa", "Regular": "--iqa-regular", "Ruim": "--iqa-ruim", "Péssima": "--iqa-pessima" };
const iqaClass = (v) => (v == null ? null : v >= 80 ? "Ótima" : v >= 52 ? "Boa" : v >= 37 ? "Regular" : v >= 20 ? "Ruim" : "Péssima");
const SEV = {
  critico: { label: "Crítico", v: "--sev-critico" },
  alto: { label: "Alto", v: "--sev-alto" },
  atencao: { label: "Atenção", v: "--sev-atencao" },
  cronico: { label: "Recorrente", v: "--sev-cronico" },
};
const longTerm = (a) => a.category === "tendencia" || a.severity === "cronico";

/* Posição de cada estação no esquema da bacia (metrô-mapa, não geografia exata). */
const SCHEMA = {
  "RIO-01": { x: 160, y: 236, lab: "top" },
  "RIO-03": { x: 262, y: 96, lab: "right" },
  "RIO-02": { x: 410, y: 256, lab: "bottom" },
  "LAG-01": { x: 570, y: 196, lab: "top" },
  "RES-01": { x: 740, y: 262, lab: "bottom" },
  "EST-01": { x: 905, y: 300, lab: "top" },
};
const MAIN_RIVER = [[14, 262], [90, 252], [160, 236], [250, 246], [330, 238], [410, 256], [490, 226], [570, 196], [655, 222], [740, 262], [800, 280], [860, 292], [905, 300], [1000, 312]];
const TRIBUTARY = [[176, 14], [214, 54], [262, 96], [296, 170], [330, 238]];

const PARAM_ORDER = ["iqa", "do_mgl", "coliforms_nmp", "phosphorus_mgl", "nitrate_mgl", "turbidity_ntu", "ph", "temp_c", "conductivity_uscm"];
const DIGITS = { iqa: 0, ph: 2, do_mgl: 1, temp_c: 1, turbidity_ntu: 1, conductivity_uscm: 0, nitrate_mgl: 2, phosphorus_mgl: 3, coliforms_nmp: 0, do_sat_pct: 0 };

/* Limites da Resolução CONAMA 357/2005 usados pelos alertas. */
function limitFor(param, type) {
  const brackish = type === "estuario";
  switch (param) {
    case "do_mgl": return { lines: [5], bad: (v) => v < 5, text: "mínimo de 5 mg/L" };
    case "coliforms_nmp": return { lines: [1000], bad: (v) => v > 1000, text: "máximo de 1.000 NMP/100mL" };
    case "nitrate_mgl": return { lines: [10], bad: (v) => v > 10, text: "máximo de 10 mg/L" };
    case "turbidity_ntu": return { lines: [100], bad: (v) => v > 100, text: "máximo de 100 NTU" };
    case "phosphorus_mgl": {
      const l = { lago: 0.03, reservatorio: 0.03, estuario: 0.124 }[type] ?? 0.1;
      return { lines: [l], bad: (v) => v > l, text: `máximo de ${fmt(l, 3)} mg/L` };
    }
    case "ph": {
      const [lo, hi] = brackish ? [6.5, 8.5] : [6, 9];
      return { lines: [lo, hi], bad: (v) => v < lo || v > hi, text: `faixa de ${fmt(lo, 1)} a ${fmt(hi, 1)}` };
    }
    default: return null;
  }
}

/* ---------- estado ---------- */

const VIEWS = ["bacia", "estacao", "modelos", "pipeline", "dados", "assistente"];

const state = {
  data: null,
  series: {},
  view: null,
  station: null,
  param: "iqa",
  range: "365",
  focus: null,
  dirty: new Set(VIEWS),
  charts: {},
  status: null,
  alertsAll: false,
  trendsAll: false,
  layout: null,
  db: null,
  asking: false,
};

const stationById = (id) => state.data.stations.find((s) => s.id === id);
const riverOrder = () => { const { pos } = stationLayout(); return [...state.data.stations].sort((a, b) => pos[a.id].x - pos[b.id].x); };

/* Altura do rio principal num ponto x (interpolação linear entre os vértices). */
function riverY(x) {
  for (let i = 1; i < MAIN_RIVER.length; i++) {
    const [x0, y0] = MAIN_RIVER[i - 1], [x1, y1] = MAIN_RIVER[i];
    if (x <= x1) return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0);
  }
  return MAIN_RIVER.at(-1)[1];
}

/* Posições no esquema. As estações da bacia sintética têm lugar fixo; dados reais
   com outras estações são distribuídos ao longo do rio, de oeste para leste. */
function stationLayout() {
  if (state.layout) return state.layout;
  const st = state.data.stations;
  if (state.db?.dataset?.source !== "real" && st.every((s) => SCHEMA[s.id])) return (state.layout = { schematic: true, pos: SCHEMA });
  const order = [...st].sort((a, b) => (a.lon ?? 0) - (b.lon ?? 0) || a.id.localeCompare(b.id));
  const pos = {};
  order.forEach((s, i) => {
    const x = Math.round(120 + (i + 0.5) * (760 / order.length));
    pos[s.id] = { x, y: Math.round(riverY(x)), lab: i % 2 ? "bottom" : "top" };
  });
  return (state.layout = { schematic: false, pos });
}
const knownEvents = () => state.data.anomalies.evaluation?.events ?? [];

async function getSeries(id) {
  if (!state.series[id]) {
    const r = await api(`/api/stations/${encodeURIComponent(id)}/series`);
    if (!r.ok) throw new Error(r.body.error || "falha ao carregar a série");
    state.series[id] = r.body;
  }
  return state.series[id];
}

/* ---------- tooltip ---------- */

const tip = $("#tip");
function showTip(html, evt) {
  tip.innerHTML = html;
  tip.hidden = false;
  const pad = 14, w = tip.offsetWidth, h = tip.offsetHeight;
  let x = evt.clientX + pad, y = evt.clientY + pad;
  if (x + w > innerWidth - 8) x = evt.clientX - w - pad;
  if (y + h > innerHeight - 8) y = evt.clientY - h - pad;
  tip.style.left = `${x}px`;
  tip.style.top = `${y}px`;
}
const hideTip = () => { tip.hidden = true; };

/* ---------- SVG ---------- */

const SVGNS = "http://www.w3.org/2000/svg";
function el(tag, attrs = {}, parent) {
  const n = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  if (parent) parent.appendChild(n);
  return n;
}

/* Curva suave (Catmull-Rom → Bézier) passando por todos os pontos. */
function smoothPath(pts) {
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] ?? p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0]},${c1[1]} ${c2[0]},${c2[1]} ${p2[0]},${p2[1]}`;
  }
  return d;
}

function sparkline(svg, values, w, h, delay = 0) {
  const v = values.filter((x) => x != null);
  if (v.length < 2) return;
  const lo = Math.min(...v), hi = Math.max(...v), span = hi - lo || 1;
  const pts = values.map((x, i) => (x == null ? null : [(i / (values.length - 1)) * w, h - 2 - ((x - lo) / span) * (h - 4)])).filter(Boolean);
  const p = el("path", { d: `M${pts.map((q) => q.join(",")).join(" L")}`, class: "spark draw" }, svg);
  const len = Math.ceil(p.getTotalLength?.() || w * 2);
  p.style.setProperty("--len", len);
  p.style.setProperty("--d", `${delay}ms`);
}

function bucketMeans(values, size) {
  const out = [];
  for (let i = 0; i < values.length; i += size) out.push(mean(values.slice(i, i + size)));
  return out;
}

/* ====================================================================
   Vista 1 — bacia
   ==================================================================== */

function renderBasin() {
  const d = state.data;
  const st = d.stations;
  const good = st.filter((s) => ["Ótima", "Boa"].includes(iqaClass(s.iqa_30d))).length;
  $("#basin-headline").textContent = good === st.length
    ? `As ${st.length} estações com água boa ou ótima`
    : good === 0 ? "Nenhuma estação com água boa" : `${good} de ${st.length} estações com água boa ou ótima`;

  const worst = [...st].sort((a, b) => a.iqa_30d - b.iqa_30d)[0];
  const end = d.period[1];
  const recentCrit = d.alerts.filter((a) => a.severity === "critico" && dayDiff(a.end, end) <= 90).length;
  const worsening = st.filter((s) => s.worsening_trends.length).map((s) => s.name);
  $("#basin-lede").textContent =
    `O trecho mais pressionado é ${worst.name}, com IQA ${fmt(worst.iqa_30d)}. ` +
    `${recentCrit ? `${recentCrit} alerta${recentCrit > 1 ? "s" : ""} crítico${recentCrit > 1 ? "s" : ""} nos últimos 90 dias` : "Nenhum alerta crítico nos últimos 90 dias"}` +
    `${worsening.length ? `, e ${joinPt(worsening)} piora${worsening.length > 1 ? "m" : ""} ano a ano.` : "."}`;

  const top = d.alerts.filter((a) => !longTerm(a)).slice(0, 4);
  const att = $("#attention");
  att.className = "attention stagger";
  att.innerHTML = top.map((a, i) => `<li style="--n:${i}"><a href="#estacao/${esc(a.station_id)}/${esc(a.start)}" style="--sev:var(${SEV[a.severity].v})">
      <span class="sq" aria-hidden="true"></span>
      <span><strong>${esc(a.title)}</strong> em ${esc(a.station_name)}</span>
      <span class="when">${SEV[a.severity].label} · ${a.start === a.end ? dmy(a.start) : `${dmy(a.start)} a ${dmy(a.end)}`}${a.days > 1 ? ` · ${a.days} dias` : ""}</span>
    </a></li>`).join("") || `<li class="empty">Nada pede atenção agora.</li>`;

  renderMap();
  renderFacts();
  renderTimeline();
}

function renderMap() {
  const svg = $("#map");
  svg.innerHTML = "";
  const order = riverOrder();
  const { schematic, pos: positions } = stationLayout();
  const delayAt = (x) => 300 + (x / 1000) * 1600;
  $(".map figcaption").textContent = schematic
    ? "Esquema ilustrativo da bacia, da nascente ao oceano. Cor de cada estação: classe do IQA nos últimos 30 dias. Clique numa estação para abrir."
    : "Estações dispostas de oeste para leste (pela longitude, quando informada); o traçado do rio é apenas ilustrativo. Cor: classe do IQA nos últimos 30 dias.";

  if (schematic) drawTerrain(svg, delayAt);
  for (const [pts, width] of schematic ? [[TRIBUTARY, 6], [MAIN_RIVER, 10]] : [[MAIN_RIVER, 10]]) {
    const d = smoothPath(pts);
    const p = el("path", { d, class: "river river-draw", "stroke-width": width }, svg);
    p.style.setProperty("--len", Math.ceil(p.getTotalLength()));
    el("path", { d, class: "river-flow", "stroke-width": Math.max(2, width / 3) }, svg);
  }

  // Estações.
  for (const s of order) {
    const pos = positions[s.id];
    if (!pos) continue;
    const cls = iqaClass(s.iqa_30d);
    const critRecent = state.data.alerts.some((a) => a.station_id === s.id && a.severity === "critico" && dayDiff(a.end, state.data.period[1]) <= 90);
    const g = el("g", { class: "st-node appear", tabindex: 0, role: "link", "aria-label": `${s.name}: IQA ${fmt(s.iqa_30d)}, ${cls}`, style: `--d:${delayAt(pos.x) + 200}ms` }, svg);
    if (critRecent) el("circle", { cx: pos.x, cy: pos.y, r: 15, class: "halo", style: `--d:${delayAt(pos.x) + 900}ms` }, g);
    el("circle", { cx: pos.x, cy: pos.y, r: 15, class: "dot", fill: `var(${IQA_VAR[cls]})` }, g);
    const [nx, ny, sy, anchor] = {
      top: [pos.x, pos.y - 50, pos.y - 28, "middle"],
      bottom: [pos.x, pos.y + 46, pos.y + 68, "middle"],
      right: [pos.x + 28, pos.y - 3, pos.y + 19, "start"],
    }[pos.lab];
    el("text", { x: nx, y: ny, class: "st-name", "text-anchor": anchor }, g).textContent = s.name.replace("Rio Claro — ", "");
    el("text", { x: nx, y: sy, class: "st-sub", "text-anchor": anchor }, g).textContent = `IQA ${fmt(s.iqa_30d)} · ${cls}`;
    const go = () => { location.hash = `#estacao/${s.id}`; };
    g.addEventListener("click", go);
    g.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } });
    g.addEventListener("mousemove", (e) => showTip(
      `<strong>${esc(s.name)}</strong>IQA ${fmt(s.iqa_30d)} (${cls}) nos últimos 30 dias<br>${s.alerts_recent} alerta(s) recente(s) · perfil ${esc(lower1(s.cluster_label ?? "—"))}`, e));
    g.addEventListener("mouseleave", hideTip);
  }
}

/* Terreno e corpos d'água da bacia sintética (não se aplicam a dados reais). */
function drawTerrain(svg, delayAt) {
  // Terreno desenhado a partir do assunto: mata na nascente, lavouras no ribeirão, cidade, oceano.
  const land = el("g", {}, svg);
  [[34, 300, 16], [58, 318, 13], [84, 300, 15], [108, 322, 12], [62, 286, 10], [128, 300, 10]].forEach(([cx, cy, r]) => el("circle", { cx, cy, r, class: "land" }, land));
  el("text", { x: 34, y: 352, class: "map-label" }, land).textContent = "mata da nascente";
  for (let i = 0; i < 5; i++) el("rect", { x: 96 + i * 15, y: 60, width: 9, height: 58, class: "land" }, land);
  el("text", { x: 96, y: 46, class: "map-label" }, land).textContent = "lavouras";
  for (let r = 0; r < 2; r++) for (let c = 0; c < 5; c++) el("rect", { x: 352 + c * 22, y: 158 + r * 18, width: 16, height: 12, class: "land" }, land);
  el("text", { x: 352, y: 146, class: "map-label" }, land).textContent = "área urbana";

  // Corpos d'água e rios.
  const bodies = el("g", {}, svg);
  el("ellipse", { cx: 570, cy: 196, rx: 64, ry: 28, transform: "rotate(-14 570 196)", class: "water-body appear", style: `--d:${delayAt(570)}ms` }, bodies);
  el("ellipse", { cx: 726, cy: 258, rx: 76, ry: 24, transform: "rotate(12 726 258)", class: "water-body appear", style: `--d:${delayAt(726)}ms` }, bodies);
  el("path", { d: "M872,294 C925,292 962,280 1000,268 L1000,436 C962,390 925,330 872,306 Z", class: "water-body appear", style: `--d:${delayAt(880)}ms` }, bodies);
  el("rect", { x: 798, y: 258, width: 8, height: 40, rx: 2, transform: "rotate(12 802 278)", fill: "var(--ink-2)", class: "water-body appear", style: `--d:${delayAt(800)}ms` }, bodies);
  el("text", { x: 806, y: 352, class: "map-label" }, bodies).textContent = "barragem";
  el("text", { x: 992, y: 428, class: "map-label", "text-anchor": "end", style: "fill:var(--ink-2)" }, bodies).textContent = "oceano";
}

function renderFacts() {
  const d = state.data;
  const ev = d.anomalies.evaluation;
  const facts = [
    ev && [`${ev.events.filter((e) => e.detected).length}`, ` de ${ev.events.length}`, "eventos ambientais encontrados pela IA"],
    [Math.round(d.classification.accuracy * 100), "%", "de acerto ao reconhecer a classe da água"],
    d.processing && [d.processing.rows_read, "", "leituras horárias processadas"],
    d.processing && [d.processing.total_ms, " ms", "para o Rust limpar e consolidar tudo"],
  ].filter(Boolean);
  const box = $("#facts");
  box.innerHTML = facts.map(([v, suf, k]) => `<div><span class="v"><span data-count="${v}">0</span>${esc(suf)}</span><span class="k">${esc(k)}</span></div>`).join("");
  watchCounts(box);
}

/* Conta os números quando entram na tela. */
function watchCounts(root) {
  const nodes = root.querySelectorAll("[data-count]");
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      countUp(e.target, Number(e.target.dataset.count));
      io.unobserve(e.target);
    }
  }, { threshold: 0.4 });
  nodes.forEach((n) => io.observe(n));
}

function renderTimeline() {
  const box = $("#timeline");
  const W = Math.max(320, box.clientWidth - 32);
  const narrow = W < 640;
  const labelW = narrow ? 0 : Math.min(230, W * 0.24);
  const rowH = narrow ? 58 : 46;
  const order = riverOrder();
  const H = order.length * rowH + 30;
  const [p0, p1] = state.data.period;
  const t0 = toDate(p0).getTime(), t1 = toDate(p1).getTime() + 86400000;
  const plotW = W - labelW;
  const x = (s) => labelW + ((toDate(s).getTime() - t0) / (t1 - t0)) * plotW;
  const xEnd = (s) => x(s) + plotW / ((t1 - t0) / 86400000);

  const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: "img", "aria-label": "Linha do tempo de alertas e anomalias por estação" });
  const eps = state.data.anomalies.episodes;
  const evs = knownEvents();

  order.forEach((s, r) => {
    const top = r * rowH;
    const cy = top + (narrow ? rowH - 18 : rowH / 2);
    const g = el("g", {}, svg);
    if (narrow) {
      el("text", { x: 0, y: top + 16, class: "tl-label" }, g).textContent = s.name;
    } else {
      el("text", { x: 0, y: cy - 2, class: "tl-label" }, g).textContent = s.name.replace("Rio Claro — ", "Rio Claro, ");
      el("text", { x: 0, y: cy + 14, class: "tl-sub" }, g).textContent = `IQA ${fmt(s.iqa_30d)} · ${iqaClass(s.iqa_30d)}`;
    }
    el("rect", { x: labelW, y: cy - 9, width: plotW, height: 18, class: "tl-track appear", style: `--d:${r * 70}ms` }, g);
    for (const e of evs.filter((e) => e.station_id === s.id)) {
      el("rect", { x: x(e.start) - 2, y: cy - 16, width: xEnd(e.end) - x(e.start) + 4, height: 32, class: "tl-event tl-mark appear", style: `--d:${500 + (x(e.start) / W) * 900}ms` }, g)
        .addEventListener("mousemove", (ev) => showTip(`<strong>Evento conhecido</strong>${esc(e.description)}<br>${dmy(e.start)} a ${dmy(e.end)} · ${e.detected ? "detectado pela IA" : "não detectado"}`, ev));
    }
    const hit = el("rect", { x: labelW, y: top, width: plotW, height: rowH, class: "tl-row-hit" }, g);
    hit.addEventListener("click", () => { location.hash = `#estacao/${s.id}`; });
    for (const a of state.data.alerts.filter((a) => a.station_id === s.id && !longTerm(a))) {
      const m = el("rect", {
        x: x(a.start), y: cy - 6, width: Math.max(4, xEnd(a.end) - x(a.start)), height: 12,
        fill: `var(${SEV[a.severity].v})`, class: "tl-mark appear", style: `--d:${600 + (x(a.start) / W) * 1100}ms`,
      }, g);
      m.addEventListener("mousemove", (ev) => showTip(`<strong>${esc(a.title)}</strong>${esc(a.message)}<br>${SEV[a.severity].label} · ${dmy(a.start)}${a.end !== a.start ? ` a ${dmy(a.end)}` : ""}`, ev));
      m.addEventListener("click", () => { location.hash = `#estacao/${s.id}/${a.start}`; });
    }
    for (const ep of eps.filter((e) => e.station_id === s.id)) {
      const mid = x(ep.start) + (xEnd(ep.end) - x(ep.start)) / 2;
      const c = el("circle", { cx: mid, cy: cy - 15, r: 3.2, fill: "var(--accent)", class: "tl-mark appear", style: `--d:${800 + (mid / W) * 1100}ms` }, g);
      c.addEventListener("mousemove", (ev) => showTip(`<strong>Dia(s) anormais segundo a IA</strong>${dmy(ep.start)}${ep.end !== ep.start ? ` a ${dmy(ep.end)}` : ""}${ep.params.length ? `<br>Mais afetados: ${esc(ep.params.map((p) => lower1(state.data.parameters[p]?.label ?? p)).join(", "))}` : ""}`, ev));
      c.addEventListener("click", () => { location.hash = `#estacao/${s.id}/${ep.start}`; });
    }
  });

  // Eixo: um rótulo a cada três meses, sem linhas de grade.
  const axisY = order.length * rowH + 22;
  const start = toDate(p0);
  for (let m = 0; m < 30; m += narrow ? 6 : 3) {
    const dte = new Date(start.getFullYear(), start.getMonth() + m, 1);
    if (dte.getTime() >= t1) break;
    const iso = `${dte.getFullYear()}-${String(dte.getMonth() + 1).padStart(2, "0")}-01`;
    el("text", { x: x(iso), y: axisY, class: "tl-axis", "text-anchor": m === 0 ? "start" : "middle" }, svg).textContent = monthLabel(iso);
  }
  svg.addEventListener("mouseleave", hideTip);
  box.replaceChildren(svg);

  $("#timeline-key").innerHTML = ["critico", "alto", "atencao"].map((k) => `<span><i style="background:var(${SEV[k].v})"></i>Alerta ${SEV[k].label.toLowerCase()}</span>`).join("") +
    `<span><i class="dot" style="background:var(--accent)"></i>Anomalia detectada pela IA</span><span><i style="background:var(--water-light)"></i>Evento conhecido</span>`;
}

/* ====================================================================
   Vista 2 — estação
   ==================================================================== */

async function renderStation() {
  const d = state.data;
  const id = state.station && stationById(state.station) ? state.station : riverOrder()[0].id;
  state.station = id;
  const s = stationById(id);
  const cls = iqaClass(s.iqa_30d);

  const picker = $("#picker");
  picker.innerHTML = riverOrder().map((x) => `<button role="tab" aria-selected="${x.id === id}" data-id="${esc(x.id)}" style="--c:var(${IQA_VAR[iqaClass(x.iqa_30d)]})">
      <span class="p-name">${esc(x.name)}</span><span class="p-iqa"><i></i>IQA ${fmt(x.iqa_30d)}</span></button>`).join("");
  picker.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => { location.hash = `#estacao/${b.dataset.id}`; }));
  picker.querySelector('[aria-selected="true"]')?.scrollIntoView({ inline: "center", block: "nearest", behavior: reduced() ? "auto" : "smooth" });

  const num = $("#st-iqa");
  num.style.setProperty("--c", `var(${IQA_VAR[cls]})`);
  num.classList.remove("bump"); void num.offsetWidth; num.classList.add("bump");
  countUp(num, s.iqa_30d);
  $("#st-class").textContent = `Água ${lower1(cls)}`;
  $("#st-name").textContent = s.name;
  $("#st-summary").textContent = "Carregando a série…";

  const series = await getSeries(id);
  if (state.station !== id) return;
  $("#st-summary").textContent = stationSummary(s, series);
  renderParams(s, series);
  renderSeriesChart(s, series);
  renderStationAlerts(s);
  renderStationTrends(s);
}

function last30(series, param) {
  return series[param].slice(-30);
}

function stationSummary(s, series) {
  const out = [];
  const delta = s.iqa_30d - s.iqa_period;
  out.push(`IQA médio de ${fmt(s.iqa_30d)} no último mês, ${Math.abs(delta) < 1.5 ? "em linha com" : delta > 0 ? "acima" : "abaixo"} ${Math.abs(delta) < 1.5 ? "" : "d"}a média de ${fmt(s.iqa_period)} dos dois anos.`);
  const off = PARAM_ORDER.map((p) => {
    const lim = limitFor(p, s.type);
    if (!lim) return null;
    const n = last30(series, p).filter((v) => v != null && lim.bad(v)).length;
    return n ? { p, n } : null;
  }).filter(Boolean).sort((a, b) => b.n - a.n);
  if (off.length) {
    const first = off[0];
    out.push(`${state.data.parameters[first.p].label} fora do limite em ${first.n} dos últimos 30 dias${off.length > 1 ? `, além de ${joinPt(off.slice(1).map((o) => lower1(state.data.parameters[o.p].label)))}` : ""}.`);
  } else {
    out.push("Todos os parâmetros ficaram dentro dos limites da CONAMA no último mês.");
  }
  if (s.worsening_trends.length) out.push(`Piora contínua em ${joinPt(s.worsening_trends.map(lower1))}.`);
  return out.join(" ");
}

function renderParams(s, series) {
  const box = $("#params");
  box.className = "params stagger";
  box.innerHTML = "";
  PARAM_ORDER.forEach((p, i) => {
    const meta = state.data.parameters[p];
    const v30 = mean(last30(series, p));
    const lim = limitFor(p, s.type);
    const bad = lim ? last30(series, p).filter((v) => v != null && lim.bad(v)).length : 0;
    const status = !lim ? (p === "iqa" ? `classe ${lower1(iqaClass(v30) ?? "—")}` : "sem limite na CONAMA")
      : bad ? `fora do limite em ${bad} de 30 dias` : "dentro do limite";
    const b = document.createElement("button");
    b.className = "param";
    b.setAttribute("role", "option");
    b.setAttribute("aria-selected", String(p === state.param));
    b.style.setProperty("--n", i);
    b.innerHTML = `<span class="p-label">${esc(meta.label)}</span>
      <span class="p-value">${fmt(v30, DIGITS[p])}${meta.unit ? ` <small>${esc(meta.unit)}</small>` : ""}</span>
      <span class="p-status${bad ? " bad" : ""}">${esc(status)}</span>`;
    const svg = el("svg", { viewBox: "0 0 88 22", "aria-hidden": "true" }, b);
    b.addEventListener("click", () => {
      state.param = p;
      box.querySelectorAll(".param").forEach((x) => x.setAttribute("aria-selected", String(x === b)));
      renderSeriesChart(s, series);
    });
    box.appendChild(b);
    sparkline(svg, bucketMeans(series[p], 14), 88, 22, 300 + i * 60);
  });
}

/* Faixas dos eventos conhecidos e do dia em foco, desenhadas atrás das linhas. */
const bandsPlugin = {
  id: "bands",
  beforeDatasetsDraw(chart, _args, opts) {
    const { ctx, chartArea: a, scales: { x } } = chart;
    if (!opts.items?.length) return;
    ctx.save();
    for (const b of opts.items) {
      const x0 = x.getPixelForValue(b.from), x1 = x.getPixelForValue(b.to);
      if (x1 < a.left || x0 > a.right) continue;
      const l = Math.max(a.left, x0 - 2), r = Math.min(a.right, x1 + 2);
      ctx.fillStyle = b.color;
      ctx.fillRect(l, a.top, Math.max(3, r - l), a.bottom - a.top);
      if (b.label) {
        ctx.fillStyle = b.ink;
        ctx.font = `500 12px Plex, system-ui, sans-serif`;
        ctx.fillText(b.label, Math.min(l + 6, a.right - ctx.measureText(b.label).width - 4), a.top + 16);
      }
    }
    ctx.restore();
  },
};

function renderSeriesChart(s, series) {
  const p = state.param;
  const meta = state.data.parameters[p];
  const n = series.dates.length;
  let i0 = 0, i1 = n;
  if (state.focus) {
    const fi = series.dates.indexOf(state.focus);
    if (fi >= 0) { i0 = Math.max(0, fi - 45); i1 = Math.min(n, fi + 46); }
  } else if (state.range !== "all") {
    i0 = Math.max(0, n - Number(state.range));
  }
  const dates = series.dates.slice(i0, i1);
  const sl = (arr) => (arr ?? []).slice(i0, i1);
  const values = sl(series[p]);
  const ma7 = series[`${p}_ma7`] ? sl(series[`${p}_ma7`]) : values.map((_, i) => mean(values.slice(Math.max(0, i - 6), i + 1)));
  const anomalies = values.map((v, i) => (series.anomaly[i0 + i] ? v : null));
  const unitTxt = meta.unit ? ` ${meta.unit}` : "";
  const lim = limitFor(p, s.type);

  document.querySelectorAll("#range button").forEach((b) => b.setAttribute("aria-pressed", String(!state.focus && b.dataset.range === state.range)));
  $("#chart-title").textContent = `${meta.label}${unitTxt ? ` (${meta.unit})` : ""}`;

  const bands = knownEvents().filter((e) => e.station_id === s.id).map((e) => ({
    from: e.start, to: e.end, color: css("--water-light"), ink: css("--ink-2"), label: e.description,
  }));
  if (state.focus) bands.push({ from: state.focus, to: state.focus, color: css("--accent"), ink: css("--ink") });

  const datasets = [
    { label: "Valor diário", data: values, borderColor: css("--water"), borderWidth: 1.25, pointRadius: 0, order: 3 },
    { label: "Média de 7 dias", data: ma7, borderColor: css("--accent"), borderWidth: 2.25, pointRadius: 0, order: 2 },
    { label: "Anomalia (IA)", data: anomalies, showLine: false, order: 1, pointRadius: 6, pointHoverRadius: 8, pointStyle: "triangle",
      pointBackgroundColor: css("--sev-critico"), pointBorderColor: css("--tone-1"), pointBorderWidth: 2 },
  ];
  (lim?.lines ?? []).forEach((v, k) => datasets.push({
    label: "Limite CONAMA", data: values.map(() => v), borderColor: css("--ink-2"), borderWidth: 1.5,
    borderDash: [6, 5], pointRadius: 0, order: 4, hideLegend: k > 0,
  }));

  const nAnom = anomalies.filter((v) => v != null).length;
  $("#chart-note").textContent = [
    state.focus ? `Mostrando 45 dias antes e depois de ${dmy(state.focus)}.` : null,
    `${nAnom} dia${nAnom === 1 ? "" : "s"} marcado${nAnom === 1 ? "" : "s"} como anormal${nAnom === 1 ? "" : "is"} pela IA neste período.`,
    lim ? `Linha tracejada: limite da CONAMA 357/2005 (${lim.text}).` : null,
    bands.length - (state.focus ? 1 : 0) > 0 ? "Faixas claras: eventos conhecidos." : null,
  ].filter(Boolean).join(" ");

  const anim = !reduced();
  const stepDelay = 900 / Math.max(1, dates.length);
  const prevY = (ctx) => (ctx.index === 0 ? ctx.chart.scales.y.getPixelForValue(ctx.chart.scales.y.min)
    : ctx.chart.getDatasetMeta(ctx.datasetIndex).data[ctx.index - 1]?.getProps(["y"], true).y);

  state.charts.series?.destroy();
  state.charts.series = new Chart($("#series-chart"), {
    type: "line",
    data: { labels: dates, datasets },
    plugins: [bandsPlugin],
    options: {
      maintainAspectRatio: false,
      animation: anim ? {
        x: { type: "number", easing: "linear", duration: stepDelay, from: NaN, delay(ctx) { if (ctx.type !== "data" || ctx.xStarted) return 0; ctx.xStarted = true; return ctx.index * stepDelay; } },
        y: { type: "number", easing: "linear", duration: stepDelay, from: prevY, delay(ctx) { if (ctx.type !== "data" || ctx.yStarted) return 0; ctx.yStarted = true; return ctx.index * stepDelay; } },
      } : false,
      interaction: { mode: "index", intersect: false },
      scales: {
        x: { grid: { display: false }, border: { color: css("--grid") }, ticks: { color: css("--muted"), maxRotation: 0, autoSkip: true, maxTicksLimit: 8,
          callback(v) { const s2 = this.getLabelForValue(v); return dates.length > 120 ? monthLabel(s2) : dmy(s2).slice(0, 5); } } },
        y: { type: p === "coliforms_nmp" ? "logarithmic" : "linear", grid: { color: css("--grid"), drawTicks: false }, border: { display: false },
          ticks: { color: css("--muted"), padding: 8, maxTicksLimit: 6, callback: (v) => fmt(v, v < 1 ? 2 : 0) } },
      },
      plugins: {
        bands: { items: bands },
        legend: { position: "bottom", align: "start", labels: { color: css("--ink-2"), usePointStyle: true, boxHeight: 7, padding: 16, font: { family: "Plex", size: 13 },
          filter: (item, data) => !data.datasets[item.datasetIndex].hideLegend } },
        tooltip: {
          backgroundColor: css("--ink"), titleColor: css("--ground"), bodyColor: css("--ground"), padding: 10, cornerRadius: 0,
          titleFont: { family: "Plex", weight: "600" }, bodyFont: { family: "Plex" }, displayColors: false,
          filter: (item) => item.raw != null && item.datasetIndex < 3,
          callbacks: {
            title: (items) => dmy(items[0].label),
            label: (item) => `${item.dataset.label}: ${fmt(item.raw, DIGITS[p] + (item.datasetIndex === 1 ? 1 : 0))}${unitTxt}`,
            afterBody: (items) => { const c = series.iqa_class[i0 + items[0].dataIndex]; return c ? `Classe do IQA: ${c}` : ""; },
          },
        },
      },
    },
  });
}

function renderStationAlerts(s) {
  const list = state.data.alerts.filter((a) => a.station_id === s.id);
  const shown = state.alertsAll ? list : list.slice(0, 5);
  const ul = $("#st-alerts");
  ul.className = "alert-list stagger";
  ul.innerHTML = shown.map((a, i) => `<li style="--n:${i};--sev:var(${SEV[a.severity].v})">
      <div class="a-side"><span class="a-sev"><i></i>${SEV[a.severity].label}</span><span class="a-when">${a.category === "tendencia" || a.severity === "cronico" ? "dois anos" : dmy(a.start)}</span></div>
      <div class="a-title">${esc(a.title)}</div>
      <div class="a-msg">${esc(a.message)}</div>
      <div class="a-rec">${esc(a.recommendation)}</div></li>`).join("") || `<li class="empty">Nenhum alerta para esta estação.</li>`;
  const more = $("#st-alerts-more");
  more.hidden = list.length <= 5;
  more.textContent = state.alertsAll ? "Mostrar menos" : `Ver todos os ${list.length} alertas`;
}

function trendColor(t) {
  return t.verdict === "piora" ? "var(--bad-ink)" : t.verdict === "melhora" ? "var(--good-ink)" : "var(--ink-2)";
}

function renderStationTrends(s) {
  const list = state.data.trends.filter((t) => t.station_id === s.id && t.significant);
  const ul = $("#st-trends");
  ul.className = "trend-list stagger";
  ul.innerHTML = list.map((t, i) => `<li style="--n:${i};--tc:${trendColor(t)}">
      <span class="t-name">${esc(t.label)}</span><span class="t-val">${t.pct_per_year > 0 ? "+" : ""}${fmt(t.pct_per_year, 0)}% ao ano</span>
      <span class="t-desc">${esc(t.verdict === "piora" ? "Piora" : t.verdict === "melhora" ? "Melhora" : "Alteração")} estatisticamente significativa (p = ${fmt(t.p_value, 3)}).</span></li>`).join("")
    || `<li class="empty">Nenhum parâmetro mudou de forma significativa nos dois anos.</li>`;
}

/* ====================================================================
   Vista 3 — modelos
   ==================================================================== */

function renderModels() {
  const d = state.data;
  const names = Object.fromEntries(d.stations.map((s) => [s.id, s.name]));
  const ev = d.anomalies.evaluation;

  $(".model-anomaly .of").hidden = !ev;
  if (ev) {
    const hits = ev.events.filter((e) => e.detected).length;
    countUp($("#m-detected"), hits);
    $("#m-events").textContent = ev.events.length;
    $("#models-headline").textContent = "eventos encontrados pela IA";
    $("#m-anomaly-text").textContent =
      `O Isolation Forest não sabe onde estão os eventos plantados nos dados. Ele aprende o comportamento normal de cada estação e marca o que foge dele. ` +
      `${Math.round(ev.day_precision * 100)}% dos dias marcados caem dentro de um evento; os demais são, em geral, chuvas fortes, que também são mudanças reais na água.`;
    const ul = $("#m-events-list");
    ul.className = "event-list stagger";
    ul.innerHTML = ev.events.map((e, i) => `<li style="--n:${i}">
        <span class="e-name">${esc(e.description)}</span>
        <span class="e-hit${e.detected ? "" : " miss"}">${e.detected ? "Encontrado" : "Não encontrado"}</span>
        <span class="e-meta">${esc(names[e.station_id])} · ${dmy(e.start)} a ${dmy(e.end)}</span></li>`).join("");
  } else {
    // Dados reais costumam vir sem eventos rotulados: mostra o que a IA encontrou sozinha.
    const eps = [...d.anomalies.episodes].sort((a, b) => b.start.localeCompare(a.start));
    countUp($("#m-detected"), eps.length);
    $("#models-headline").textContent = "episódios anormais encontrados pela IA";
    $("#m-anomaly-text").textContent =
      `Sem eventos rotulados para conferir, o Isolation Forest aprende o comportamento normal de cada estação e marca os dias que fogem dele. ` +
      `Ao lado, os mais recentes: vale confirmar cada um com coleta de campo.`;
    const ul = $("#m-events-list");
    ul.className = "event-list stagger";
    ul.innerHTML = eps.slice(0, 8).map((e, i) => `<li style="--n:${i}">
        <span class="e-name">${esc(names[e.station_id] ?? e.station_id)}</span>
        <span class="e-hit">${e.days} dia${e.days > 1 ? "s" : ""}</span>
        <span class="e-meta">${dmy(e.start)}${e.end !== e.start ? ` a ${dmy(e.end)}` : ""}${e.params.length ? ` · ${esc(e.params.map((p) => lower1(d.parameters[p]?.label ?? p)).join(", "))}` : ""}</span></li>`).join("")
      || `<li class="empty">Nenhum episódio anormal.</li>`;
  }

  const c = d.classification;
  countUp($("#m-accuracy"), c.accuracy * 100);
  $("#m-clf-text").textContent =
    `Um Random Forest treinado com ${fmt(c.n_train)} dias aprendeu a reconhecer a classe do IQA direto das leituras dos sensores. ` +
    `Testado em ${fmt(c.n_test)} dias que nunca viu, ele acerta ${fmt(c.accuracy * 100)}% das vezes e ainda ${fmt(c.accuracy_one_sensor_missing * 100)}% com um sensor desligado.`;
  const maxImp = Math.max(...c.feature_importance.map((f) => f.importance));
  const bars = $("#m-importance");
  bars.innerHTML = c.feature_importance.map((f) => `<div class="bar-row"><span>${esc(d.parameters[f.feature]?.label ?? f.feature)}</span>
      <span class="track"><span class="fill" style="--w:0" data-w="${f.importance / maxImp}"></span></span><span class="pct">${fmt(f.importance * 100)}%</span></div>`).join("");
  requestAnimationFrame(() => requestAnimationFrame(() => bars.querySelectorAll(".fill").forEach((b, i) => {
    b.style.transitionDelay = `${i * 70}ms`;
    b.style.setProperty("--w", b.dataset.w);
  })));

  const m = c.confusion_matrix;
  $("#m-confusion").innerHTML = `<table class="confusion"><thead><tr><th>Real ↓ · Previsto →</th>${c.labels.map((l) => `<th>${esc(l)}</th>`).join("")}</tr></thead><tbody>` +
    m.map((row, i) => {
      const tot = row.reduce((a, b) => a + b, 0) || 1;
      return `<tr><th>${esc(c.labels[i])}</th>${row.map((v, j) => {
        const share = v / tot;
        return `<td class="appear" style="--d:${(i * row.length + j) * 40}ms;background:color-mix(in oklab, var(--series-1) ${Math.round(share * 90)}%, var(--tone-2));color:${share > 0.5 ? "#fff" : "var(--ink)"}" title="${v} de ${tot} dias">${v}</td>`;
      }).join("")}</tr>`;
    }).join("") + "</tbody></table>";

  renderClusters();
  renderModelTrends();
}

function renderClusters() {
  const c = state.data.clusters;
  const names = Object.fromEntries(state.data.stations.map((s) => [s.id, s.name]));
  const colors = ["--series-1", "--series-3", "--series-2"];
  $("#m-cluster-text").textContent =
    `O K-Means agrupou ${c.points.length} meses de todas as estações pelo que a água tinha em comum, sem saber de onde vinha cada mês. ` +
    `Os grupos se separaram sozinhos pelo grau de impacto humano.`;
  $("#m-profiles").innerHTML = c.profiles.map((p) => `<div style="--c:var(${colors[p.cluster]})"><i></i><strong>${esc(p.label)}</strong>
      <span>IQA médio ${fmt(p.mean.iqa)} · ${esc(p.stations.map((s) => names[s]).join(", "))}</span></div>`).join("");
  state.charts.clusters?.destroy();
  state.charts.clusters = new Chart($("#cluster-chart"), {
    type: "scatter",
    data: {
      datasets: c.profiles.map((p) => ({
        label: p.label,
        data: c.points.filter((pt) => pt.cluster === p.cluster).map((pt) => ({ x: pt.x, y: pt.y, pt })),
        backgroundColor: css(colors[p.cluster]), borderColor: css("--ground"), borderWidth: 2, pointRadius: 6, pointHoverRadius: 9,
      })),
    },
    options: {
      maintainAspectRatio: false,
      animation: reduced() ? false : { duration: 1200, easing: "easeOutQuart", delay: (ctx) => (ctx.type === "data" ? ctx.dataIndex * 18 + ctx.datasetIndex * 120 : 0) },
      scales: {
        x: { grid: { display: false }, border: { display: false }, ticks: { display: false }, title: { display: true, text: "Componente principal 1", color: css("--muted") } },
        y: { grid: { display: false }, border: { display: false }, ticks: { display: false }, title: { display: true, text: "Componente principal 2", color: css("--muted") } },
      },
      plugins: {
        legend: { display: false },
        tooltip: { backgroundColor: css("--ink"), titleColor: css("--ground"), bodyColor: css("--ground"), cornerRadius: 0, displayColors: false,
          callbacks: { title: (i) => names[i[0].raw.pt.station_id], label: (i) => `${monthLabel(i.raw.pt.month)} · IQA ${fmt(i.raw.pt.iqa)}` } },
      },
    },
  });
}

function renderModelTrends() {
  const names = Object.fromEntries(state.data.stations.map((s) => [s.id, s.name]));
  const list = state.data.trends.filter((t) => state.trendsAll || t.significant)
    .sort((a, b) => (b.significant - a.significant) || Math.abs(b.pct_per_year) - Math.abs(a.pct_per_year));
  const ul = $("#m-trends");
  ul.className = "trend-table stagger";
  ul.innerHTML = "";
  list.forEach((t, i) => {
    const li = document.createElement("li");
    li.style.setProperty("--n", Math.min(i, 12));
    li.style.setProperty("--tc", trendColor(t));
    li.innerHTML = `<span class="t-val">${t.pct_per_year > 0 ? "+" : ""}${fmt(t.pct_per_year, 0)}% ao ano</span>
      <span class="t-name">${esc(t.label)} em ${esc(names[t.station_id])}</span>
      <span class="t-desc">${t.significant ? `${t.verdict === "piora" ? "Piora" : t.verdict === "melhora" ? "Melhora" : "Alteração"} significativa · p = ${fmt(t.p_value, 3)}` : `Estável · p = ${fmt(t.p_value, 2)}`}</span>`;
    const svg = el("svg", { viewBox: "0 0 120 48", "aria-hidden": "true" }, li);
    ul.appendChild(li);
    sparkline(svg, t.monthly.map((m) => m.value), 120, 48, 300 + Math.min(i, 12) * 60);
  });
  if (!list.length) ul.innerHTML = `<li class="empty">Nenhuma tendência significativa.</li>`;
}

/* ====================================================================
   Vista 4 — pipeline
   ==================================================================== */

const STAGES = [
  { lang: "Dados", match: /Geração|Importação/, task: "Sensores ou simulação", what: "Leituras reais importadas de CSV ou, para demonstração, seis estações sintéticas com eventos escondidos." },
  { lang: "H2", match: /Carga|Exportação/, task: "Guarda as leituras", what: "O banco H2 é a fonte dos dados: cada execução parte do que está nele." },
  { lang: "Rust", match: /Processamento/, task: "Processa e calcula o IQA", what: "Descarta leituras impossíveis, preenche lacunas, consolida por dia e calcula o índice, em paralelo." },
  { lang: "Python", match: /Análise com/, task: "Aprende com os dados", what: "Isolation Forest, Random Forest, K-Means e Mann-Kendall transformam números em alertas." },
  { lang: "Java", match: /Gravação/, task: "Registra e entrega", what: "Grava a análise e os alertas no H2, serve a API e este painel e alimenta o Llama." },
];

function renderPipeline() {
  const st = state.status;
  const d = state.data;
  const steps = st?.steps ?? [];
  const py = d?.timings_s ? Object.values(d.timings_s).reduce((a, b) => a + b, 0) : null;
  const flow = $("#flow");
  flow.classList.toggle("running", !!st?.running);
  flow.innerHTML = STAGES.map((g, i) => {
    const step = [...steps].reverse().find((s) => g.match.test(s.name));
    let cls = "", time = "—", out = "";
    if (step) {
      cls = step.status === "ok" ? "done" : step.status === "erro" ? "fail" : "active";
      time = step.status === "executando" ? "executando…" : `${fmt(step.durationMs / 1000, 2)} s`;
      out = step.output.split("\n").at(-1);
    } else if (g.lang === "Rust" && d?.processing) {
      cls = "done"; time = `${fmt(d.processing.total_ms)} ms`;
    } else if (g.lang === "Python" && py != null) {
      cls = "done"; time = `${fmt(py, 1)} s`;
    } else if (g.lang === "Dados") {
      time = st?.running ? "aguardando" : state.db?.dataset?.source === "real" ? "dados reais" : "dados já existentes";
    } else if (g.lang === "H2") {
      cls = st?.running ? "" : "done"; time = st?.running ? "aguardando" : `${fmt(state.db?.totals?.measurements)} leituras`;
    } else if (g.lang === "Java") {
      cls = st?.running ? "active" : "done"; time = st?.running ? "coordenando" : "no ar";
    }
    return `<li class="stage ${cls}"><span class="state"></span>${i ? `<span class="pipe" aria-hidden="true"><i style="--k:0"></i><i style="--k:1"></i><i style="--k:2"></i></span>` : ""}
      <div class="lang">${g.lang}</div><div class="task">${esc(g.task)}</div><p class="what">${esc(g.what)}</p>
      <div class="time">${esc(time)}</div>${out ? `<div class="out">${esc(out)}</div>` : ""}</li>`;
  }).join("");

  const p = d?.processing;
  $("#numbers").innerHTML = p ? [
    [p.rows_read, "leituras lidas"], [p.invalid_total, "valores impossíveis descartados"], [p.missing_values, "valores ausentes"],
    [p.interpolated_hourly, "lacunas curtas preenchidas"], [p.days_output, "dias consolidados"], [p.threads, "threads em paralelo no Rust"],
  ].map(([v, k]) => `<div><dt>${esc(k)}</dt><dd data-count="${v}">0</dd></div>`).join("") : "";
  watchCounts($("#numbers"));
  $("#run-btn").disabled = !!st?.running;
}

/* ====================================================================
   Vista 5 — dados (banco H2)
   ==================================================================== */

const dmyT = (s) => (s ? dmy(s.slice(0, 10)) : "—");
const whenPt = (s) => new Date(s).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

async function loadDb() {
  const r = await api("/api/db/summary");
  if (!r.ok) return;
  state.db = r.body;
  const ds = state.db.dataset;
  $("#foot-note").textContent = `Protótipo acadêmico · Java 21, Rust, Python, H2 e Llama · ${ds?.source === "real" ? `dados reais: ${ds.name}` : "dados sintéticos"}`;
}

async function renderDados() {
  const [runs, monthly] = await Promise.all([api("/api/db/runs?limit=12"), api("/api/db/monthly"), loadDb()]);
  const ds = state.db?.dataset, t = state.db?.totals ?? {};
  $("#db-source").textContent = !ds ? "Banco H2 vazio" : ds.source === "real" ? "Dados reais" : "Dados sintéticos de demonstração";
  $("#db-headline").textContent = ds?.name ?? "Nenhum conjunto carregado";
  $("#db-lede").textContent = t.measurements
    ? `${fmt(t.measurements)} leituras de ${t.stations} estaç${t.stations > 1 ? "ões" : "ão"}, de ${dmyT(t.first_reading)} a ${dmyT(t.last_reading)}. ` +
      `O banco H2 guarda também ${t.runs} análise${t.runs === 1 ? "" : "s"} e ${t.messages} pergunta${t.messages === 1 ? "" : "s"} feita${t.messages === 1 ? "" : "s"} ao Llama.`
    : "Importe um CSV abaixo ou execute o pipeline para gerar dados de demonstração.";

  const st = state.status;
  const msg = $("#import-msg");
  if (st?.error && !st.running && !msg.textContent) {
    msg.className = "form-msg error";
    msg.textContent = `A última execução falhou: ${st.error}`;
  }

  renderHeat(monthly.ok ? monthly.body : []);

  $("#db-stations").innerHTML = (state.db?.stations ?? []).map((x) => `<li>
      <span class="s-name">${esc(x.name)}</span><span class="s-count">${fmt(x.readings)}</span>
      <span class="s-meta">${esc(x.id)} · ${esc(x.type)} · ${fmt(x.readings_per_day, 1)} leituras por dia · ${dmyT(x.first_reading)} a ${dmyT(x.last_reading)}</span></li>`).join("")
    || `<li class="empty">Nenhuma leitura no banco.</li>`;

  const list = runs.ok ? runs.body : [];
  $("#db-runs").innerHTML = list.map((r, i) => `<li class="${i === 0 ? "current" : ""}">
      <span class="r-id">nº ${r.id}</span><span class="r-name">${esc(r.dataset_name ?? "—")}</span>
      <span class="r-src">${r.source === "real" ? "real" : "sintético"}</span>
      <span class="r-meta">${whenPt(r.created_at)} · ${dmyT(r.period_start)} a ${dmyT(r.period_end)} · ${r.stations} estações · IQA médio ${fmt(r.mean_iqa)} · ${r.alerts} alertas (${r.critical_alerts} críticos)${r.accuracy != null ? ` · acurácia ${fmt(r.accuracy * 100)}%` : ""}</span></li>`).join("")
    || `<li class="empty">Nenhuma análise ainda.</li>`;
}

function renderHeat(rows) {
  const table = $("#db-monthly");
  if (!rows.length) { table.innerHTML = `<tbody><tr><td class="none">Sem série diária no banco.</td></tr></tbody>`; return; }
  const months = [...new Set(rows.map((r) => r.month))].sort();
  const by = new Map(rows.map((r) => [`${r.station_id}|${r.month}`, r]));
  const ids = state.data ? riverOrder().map((x) => x.id) : [...new Set(rows.map((r) => r.station_id))];
  const name = (id) => rows.find((r) => r.station_id === id)?.station_name ?? id;
  table.innerHTML = `<thead><tr><th></th>${months.map((m) => `<th scope="col">${monthLabel(m)}</th>`).join("")}</tr></thead><tbody>` +
    ids.map((id) => `<tr><th scope="row">${esc(name(id))}</th>${months.map((m) => {
      const r = by.get(`${id}|${m}`);
      if (!r || r.iqa_mean == null) return `<td class="none">—</td>`;
      const cls = iqaClass(r.iqa_mean);
      return `<td data-k="${esc(id)}|${m}" style="--c:var(${IQA_VAR[cls]})${cls === "Regular" ? ";color:#0c1a1d" : ""}">${fmt(r.iqa_mean)}</td>`;
    }).join("")}</tr>`).join("") + "</tbody>";
  table.onmousemove = (e) => {
    const td = e.target.closest("td[data-k]");
    if (!td) { hideTip(); return; }
    const r = by.get(td.dataset.k);
    showTip(`<strong>${esc(name(r.station_id))} · ${monthLabel(r.month)}</strong>IQA médio ${fmt(r.iqa_mean)} (${iqaClass(r.iqa_mean)}), pior dia ${fmt(r.iqa_min)}<br>` +
      `OD ${fmt(r.do_mean, 1)} mg/L · fósforo ${fmt(r.phosphorus_mean, 3)} mg/L<br>${r.anomaly_days} de ${r.days} dias anormais segundo a IA`, e);
  };
  table.onmouseleave = hideTip;
}

$("#import-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const form = e.target, msg = $("#import-msg"), btn = $("#import-btn");
  const fd = new FormData(form);
  for (const k of ["stations", "events"]) if (!fd.get(k)?.size) fd.delete(k);
  msg.className = "form-msg";
  msg.textContent = "Enviando e validando os arquivos…";
  btn.disabled = true;
  const r = await api("/api/data/import", { method: "POST", body: fd }).catch(() => ({ ok: false, body: {} }));
  btn.disabled = false;
  if (!r.ok) {
    msg.className = "form-msg error";
    msg.textContent = r.body.error || "Não foi possível importar os arquivos.";
    return;
  }
  const b = r.body;
  msg.innerHTML = `${fmt(b.measurements)} leituras de ${b.stations} estaç${b.stations > 1 ? "ões" : "ão"} recebidas (${fmt(b.readingsPerDay, 1)} por dia). ` +
    `A análise começou e o painel se atualiza sozinho ao terminar.` +
    (b.warnings.length ? `<ul>${b.warnings.map((w) => `<li>${esc(w)}</li>`).join("")}</ul>` : "");
  form.reset();
  state.status = b.pipeline;
  poll();
});

/* ====================================================================
   Vista 6 — assistente (Llama)
   ==================================================================== */

const SUGGESTIONS = [
  "Qual estação está em pior situação e por quê?",
  "Resuma os alertas críticos mais recentes.",
  "Alguma estação está piorando com o tempo?",
  "O que priorizar na fiscalização este mês?",
];

/* Markdown mínimo das respostas: parágrafos, listas, títulos, negrito e código. */
function md(text) {
  const inline = (t) => esc(t).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>").replace(/`([^`]+)`/g, "<code>$1</code>");
  const out = [];
  let list = null, para = [];
  const flushPara = () => { if (para.length) out.push(`<p>${para.map(inline).join("<br>")}</p>`); para = []; };
  const flushList = () => { if (list) out.push(`<${list.tag}>${list.items.map((i) => `<li>${inline(i)}</li>`).join("")}</${list.tag}>`); list = null; };
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    const ul = line.match(/^[-*•]\s+(.*)/), ol = line.match(/^\d+[.)]\s+(.*)/), h = line.match(/^#{1,6}\s+(.*)/);
    if (!line) { flushPara(); flushList(); continue; }
    if (h) { flushPara(); flushList(); out.push(`<h4>${inline(h[1])}</h4>`); continue; }
    if (ul || ol) {
      flushPara();
      const tag = ul ? "ul" : "ol";
      if (list?.tag !== tag) { flushList(); list = { tag, items: [] }; }
      list.items.push((ul ?? ol)[1]);
      continue;
    }
    flushList();
    para.push(line);
  }
  flushPara(); flushList();
  return out.join("");
}

function renderLlamaStatus(s) {
  const box = $("#ai-status");
  box.className = `ai-status ${s.modelInstalled ? "ok" : "off"}`;
  box.innerHTML = s.modelInstalled
    ? `<i></i><strong>Llama pronto</strong><span>Modelo <code>${esc(s.model)}</code> rodando no Ollama em ${esc(s.url)}.</span>`
    : s.available
      ? `<i></i><strong>Modelo ainda não baixado</strong><span>O Ollama está no ar. Rode <code>ollama pull ${esc(s.model)}</code> ou <code>make llama</code>.</span>`
      : `<i></i><strong>Llama fora do ar</strong><span>Instale o Ollama (ollama.com), rode <code>ollama serve</code> e depois <code>make llama</code> para baixar o <code>${esc(s.model)}</code>.</span>`;
  $("#ask-btn").disabled = state.asking;
}

const chatQ = (q) => `<li class="q">${esc(q)}</li>`;
const chatA = (m) => {
  const ms = m.duration_ms ?? m.durationMs;
  return `<li class="a">${md(m.answer)}<span class="meta">${esc(m.model)}${ms != null ? ` · ${fmt(ms / 1000, 1)} s` : ""}</span></li>`;
};
const chatEmpty = `<li class="empty">Nenhuma pergunta ainda. Comece por uma sugestão ao lado ou escreva a sua.</li>`;

async function renderAssistant() {
  const sug = $("#ai-suggest");
  sug.innerHTML = SUGGESTIONS.map((q) => `<button type="button">${esc(q)}</button>`).join("");
  sug.querySelectorAll("button").forEach((b) => b.addEventListener("click", () => ask(b.textContent)));
  const [st, hist] = await Promise.all([api("/api/assistant/status"), api("/api/assistant/history")]);
  renderLlamaStatus(st.body);
  if (state.asking) return;
  const msgs = hist.ok ? hist.body : [];
  $("#chat").innerHTML = msgs.map((m) => chatQ(m.question) + chatA(m)).join("") || chatEmpty;
}

async function ask(question) {
  const q = question.trim();
  if (!q || state.asking) return;
  state.asking = true;
  $("#ask-btn").disabled = true;
  $("#question").value = "";
  const chat = $("#chat");
  chat.querySelector(".empty")?.remove();
  chat.insertAdjacentHTML("beforeend", chatQ(q) + `<li class="a thinking">O Llama está lendo a análise</li>`);
  const pending = chat.lastElementChild;
  pending.scrollIntoView({ block: "nearest", behavior: reduced() ? "auto" : "smooth" });
  const r = await api("/api/assistant/ask", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question: q }) })
    .catch(() => ({ ok: false, body: { error: "Sem resposta do servidor." } }));
  state.asking = false;
  $("#ask-btn").disabled = false;
  if (r.ok) {
    pending.outerHTML = chatA(r.body);
  } else {
    pending.className = "a error";
    pending.textContent = r.body.error || "O Llama não respondeu.";
    if (r.body.llama) renderLlamaStatus(r.body.llama);
  }
  chat.lastElementChild.scrollIntoView({ block: "nearest", behavior: reduced() ? "auto" : "smooth" });
}

$("#ask-form").addEventListener("submit", (e) => { e.preventDefault(); ask($("#question").value); });
$("#question").addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); ask(e.target.value); }
});
$("#chat-clear").addEventListener("click", async () => {
  if (state.asking) return;
  await api("/api/assistant/history", { method: "DELETE" });
  $("#chat").innerHTML = chatEmpty;
});

/* ====================================================================
   Navegação e ciclo de vida
   ==================================================================== */

const RENDER = { bacia: renderBasin, estacao: renderStation, modelos: renderModels, pipeline: renderPipeline, dados: renderDados, assistente: renderAssistant };

function parseHash() {
  const [view, id, date] = location.hash.replace(/^#/, "").split("/");
  return { view: RENDER[view] ? view : "bacia", id, date };
}

function moveNavMark(view) {
  const link = document.querySelector(`.views a[data-view="${view}"]`);
  const nav = $(".views");
  document.querySelectorAll(".views a").forEach((a) => { if (a === link) a.setAttribute("aria-current", "page"); else a.removeAttribute("aria-current"); });
  const mark = $(".nav-mark");
  const lx = link.getBoundingClientRect().left - nav.getBoundingClientRect().left;
  mark.style.transform = `translateX(${lx}px) scaleX(${link.offsetWidth})`;
}

async function route() {
  if (!state.data) return;
  const { view, id, date } = parseHash();
  const changedView = view !== state.view;
  if (view === "estacao") {
    const newStation = id && stationById(id) ? id : state.station;
    if (newStation !== state.station) { state.alertsAll = false; state.dirty.add("estacao"); }
    state.station = newStation;
    const newFocus = date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
    if (newFocus !== state.focus) state.dirty.add("estacao");
    state.focus = newFocus;
  }
  hideTip();
  if (changedView) {
    document.querySelectorAll(".view").forEach((v) => { v.hidden = v.id !== `view-${view}`; v.classList.remove("entering"); });
    const section = $(`#view-${view}`);
    void section.offsetWidth;
    section.classList.add("entering");
    scrollTo({ top: 0, behavior: "auto" });
    state.view = view;
    state.dirty.add(view);
    moveNavMark(view);
  }
  if (state.dirty.has(view)) {
    state.dirty.delete(view);
    await RENDER[view]();
  }
}

async function loadData() {
  const r = await api("/api/overview");
  if (!r.ok) return false;
  state.data = r.body;
  state.series = {};
  state.layout = null;
  VIEWS.forEach((v) => state.dirty.add(v));
  await loadDb();
  $("#booting").hidden = true;
  return true;
}

function setRunState(st) {
  const rs = $("#run-state");
  rs.classList.toggle("running", !!st.running);
  $("#progress").classList.toggle("on", !!st.running);
  if (st.running) {
    const step = st.steps?.at(-1);
    rs.textContent = step ? `${step.language}: ${lower1(step.name)}…` : "Iniciando o pipeline…";
  } else if (st.error) {
    rs.textContent = "O pipeline falhou";
  } else if (state.data) {
    rs.textContent = `Dados de ${dmy(state.data.period[0])} a ${dmy(state.data.period[1])}`;
  }
}

let pollTimer = null;
async function poll() {
  const { body: st } = await api("/api/pipeline/status");
  const wasRunning = state.status?.running;
  state.status = st;
  setRunState(st);
  if (!state.data) $("#booting").textContent = st.error ? `Falha no pipeline: ${st.error}` : st.running ? "Executando o pipeline pela primeira vez…" : "Carregando a bacia…";
  if (state.view === "pipeline") renderPipeline();
  if (state.view === "dados" && wasRunning && !st.running && st.error) renderDados();
  clearTimeout(pollTimer);
  if (st.running) { pollTimer = setTimeout(poll, 900); return; }
  if ((wasRunning || !state.data) && await loadData()) {
    setRunState(st);
    if (state.view === null) {
      route();
    } else {
      state.dirty.delete(state.view);
      RENDER[state.view]();
    }
  } else if (!state.data) {
    pollTimer = setTimeout(poll, 1500);
  }
}

$("#run-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const qs = new URLSearchParams({ regenerate: String($("#regenerate").checked) });
  const seed = $("#seed").value.trim();
  if (seed) qs.set("seed", seed);
  const r = await api(`/api/pipeline/run?${qs}`, { method: "POST" });
  if (!r.ok && r.status !== 409) { $("#run-state").textContent = r.body.error || "Não foi possível iniciar"; return; }
  state.status = r.body.running ? r.body : state.status;
  poll();
});

document.querySelectorAll("#range button").forEach((b) => b.addEventListener("click", () => {
  state.range = b.dataset.range;
  if (state.focus) { location.hash = `#estacao/${state.station}`; return; }
  renderSeriesChart(stationById(state.station), state.series[state.station]);
}));
$("#st-alerts-more").addEventListener("click", () => { state.alertsAll = !state.alertsAll; renderStationAlerts(stationById(state.station)); });
$("#m-trend-all").addEventListener("change", (e) => { state.trendsAll = e.target.checked; renderModelTrends(); });
addEventListener("hashchange", route);

let resizeTimer = null;
addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => { if (state.view) moveNavMark(state.view); if (state.view === "bacia" && state.data) renderTimeline(); }, 150);
});
matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
  if (!state.data) return;
  state.dirty = new Set(VIEWS);
  state.dirty.delete(state.view);
  RENDER[state.view]();
});

(async function init() {
  Chart.defaults.font.family = "Plex, system-ui, sans-serif";
  Chart.defaults.font.size = 13;
  await document.fonts?.ready;
  await poll();
})();
