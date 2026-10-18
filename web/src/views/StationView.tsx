import { AnimatePresence, m } from "motion/react";
import { useMemo, useState } from "react";
import { Navigate, useNavigate, useParams, useSearchParams } from "react-router";
import { useSeries } from "../api/client";
import type { Overview, Series, Station } from "../api/types";
import { AnimatedNumber } from "../components/AnimatedNumber";
import { LineChart, type Band } from "../components/LineChart";
import { SegmentedControl } from "../components/SegmentedControl";
import { Sparkline } from "../components/Sparkline";
import {
  DIGITS, IQA_COLOR, PARAM_ORDER, SEVERITY, bucketMeans, daysOutside, iqaClass, lastDays, limitFor,
  riverOrder, stationSummary, trendTone, verdictLabel,
} from "../lib/domain";
import { dateRange, dmy, fmt, lowerFirst, mean } from "../lib/format";
import { ease, item, list, spring, tap } from "../motion/tokens";

type Range = "90" | "365" | "all";
const RANGES: { value: Range; label: string }[] = [
  { value: "90", label: "90 dias" },
  { value: "365", label: "1 ano" },
  { value: "all", label: "Tudo" },
];

export default function StationView({ data }: { data: Overview }) {
  const { id } = useParams();
  const order = useMemo(() => riverOrder(data.stations), [data.stations]);
  const station = data.stations.find((s) => s.id === id);
  if (!station) return <Navigate to={`/estacoes/${order[0].id}`} replace />;
  return <StationDetail data={data} station={station} order={order} />;
}

function StationDetail({ data, station, order }: { data: Overview; station: Station; order: Station[] }) {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const focus = params.get("dia");
  const [param, setParam] = useState<string>("iqa");
  const [range, setRange] = useState<Range>("365");
  const series = useSeries(station.id).data;
  const cls = iqaClass(station.iqa_30d)!;

  return (
    <>
      <nav className="picker" aria-label="Estações, da nascente ao estuário">
        {order.map((s) => {
          const selected = s.id === station.id;
          const c = iqaClass(s.iqa_30d)!;
          return (
            <m.button
              key={s.id}
              type="button"
              className="picker-item"
              aria-current={selected ? "page" : undefined}
              onClick={() => navigate(`/estacoes/${s.id}`)}
              whileTap={tap}
            >
              <span className="picker-name">{s.name}</span>
              <span className="picker-iqa"><i style={{ background: IQA_COLOR[c] }} />IQA {fmt(s.iqa_30d)}</span>
              {selected && <m.span layoutId="picker-underline" className="picker-underline" style={{ background: IQA_COLOR[c] }} transition={spring.snappy} />}
            </m.button>
          );
        })}
      </nav>

      <section className="station-head" aria-labelledby="station-title">
        <div className="iqa-figure">
          <m.span className="iqa-number" animate={{ color: IQA_COLOR[cls] }} transition={{ duration: 0.6 }}>
            <AnimatedNumber value={station.iqa_30d} />
          </m.span>
          <AnimatePresence mode="popLayout" initial={false}>
            <m.span key={cls} className="iqa-class" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.3, ease: ease.out }}>
              Água {cls.toLowerCase()}
            </m.span>
          </AnimatePresence>
        </div>
        <AnimatePresence mode="wait" initial={false}>
          <m.div key={station.id} className="station-words" initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.35, ease: ease.out }}>
            <h1 id="station-title">{station.name}</h1>
            <p className="lede">{series ? stationSummary(station, series, data.parameters) : "Carregando a série da estação…"}</p>
            {station.predicted && (
              <p className="station-ai">
                A IA reconhece a condição atual como <strong>{station.predicted.predicted.toLowerCase()}</strong>, com {fmt(station.predicted.confidence * 100)}% de confiança.
              </p>
            )}
          </m.div>
        </AnimatePresence>
      </section>

      {series ? (
        <StationBody
          data={data} station={station} series={series}
          param={param} setParam={setParam}
          range={range} setRange={(r) => { setRange(r); if (focus) setParams({}, { replace: true }); }}
          focus={focus} clearFocus={() => setParams({}, { replace: true })}
        />
      ) : (
        <div className="station-body-loading" />
      )}

      <StationFoot data={data} station={station} />
    </>
  );
}

interface BodyProps {
  data: Overview;
  station: Station;
  series: Series;
  param: string;
  setParam: (p: string) => void;
  range: Range;
  setRange: (r: Range) => void;
  focus: string | null;
  clearFocus: () => void;
}

function StationBody({ data, station, series, param, setParam, range, setRange, focus, clearFocus }: BodyProps) {
  const meta = data.parameters[param];
  const limit = limitFor(param, station.type);

  const view = useMemo(() => {
    const n = series.dates.length;
    let i0 = 0;
    let i1 = n;
    const fi = focus ? series.dates.indexOf(focus) : -1;
    if (fi >= 0) {
      i0 = Math.max(0, fi - 45);
      i1 = Math.min(n, fi + 46);
    } else if (range !== "all") {
      i0 = Math.max(0, n - Number(range));
    }
    const slice = <T,>(arr: T[] | undefined) => (arr ?? []).slice(i0, i1);
    const daily = slice(series[param]);
    const smooth = series[`${param}_ma7`]
      ? slice(series[`${param}_ma7`])
      : daily.map((_, i) => mean(daily.slice(Math.max(0, i - 6), i + 1)));
    const bands: Band[] = (data.anomalies.evaluation?.events ?? [])
      .filter((e) => e.station_id === station.id)
      .map((e) => ({ from: e.start, to: e.end, label: e.description, kind: "event" }));
    if (fi >= 0) bands.push({ from: focus!, to: focus!, kind: "focus" });
    return {
      dates: slice(series.dates), daily, smooth, bands,
      anomalies: slice(series.anomaly), classes: slice(series.iqa_class),
      focused: fi >= 0,
    };
  }, [series, param, range, focus, data.anomalies.evaluation, station.id]);

  const anomalyCount = view.anomalies.filter(Boolean).length;
  const drawKey = `${station.id}-${param}-${view.focused ? focus : range}`;

  return (
    <section className="station-body" aria-label="Parâmetros e série temporal">
      <m.div className="params" role="listbox" aria-label="Parâmetro exibido no gráfico" variants={list} initial="hidden" animate="show" key={station.id}>
        {PARAM_ORDER.map((p) => {
          const pm = data.parameters[p];
          const lim = limitFor(p, station.type);
          const bad = daysOutside(series[p] ?? [], lim);
          const recent = mean(lastDays(series[p] ?? []));
          const status = lim
            ? bad ? `fora do limite em ${bad} de 30 dias` : "dentro do limite"
            : p === "iqa" ? `classe ${lowerFirst(iqaClass(recent) ?? "—")}` : "sem limite na CONAMA";
          const selected = p === param;
          return (
            <m.button
              key={p}
              type="button"
              role="option"
              aria-selected={selected}
              className={`param ${selected ? "is-selected" : ""}`}
              onClick={() => setParam(p)}
              variants={item}
              whileTap={tap}
            >
              {selected && <m.span layoutId="param-active" className="param-active" transition={spring.snappy} />}
              <span className="param-label">{pm.label}</span>
              <span className="param-value">
                {fmt(recent, DIGITS[p])}
                {pm.unit && <small> {pm.unit}</small>}
              </span>
              <span className={`param-status ${bad ? "is-bad" : ""}`}>{status}</span>
              <Sparkline values={bucketMeans(series[p] ?? [], 14)} width={88} height={22} />
            </m.button>
          );
        })}
      </m.div>

      <div className="chart-panel">
        <div className="chart-head">
          <AnimatePresence mode="wait" initial={false}>
            <m.h2 key={param} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }}>
              {meta.label}{meta.unit && <span className="unit"> ({meta.unit})</span>}
            </m.h2>
          </AnimatePresence>
          <SegmentedControl id="range" label="Período" options={RANGES} value={view.focused ? null : range} onChange={setRange} />
        </div>
        <LineChart
          drawKey={drawKey}
          label={meta.label}
          dates={view.dates}
          daily={view.daily}
          smooth={view.smooth}
          anomalies={view.anomalies}
          classes={view.classes}
          limits={limit?.lines ?? []}
          bands={view.bands}
          log={param === "coliforms_nmp"}
          unit={meta.unit}
          digits={DIGITS[param] ?? 1}
        />
        <div className="chart-notes">
          <ul className="legend" aria-label="Legenda do gráfico">
            <li><i className="line" style={{ background: "var(--water)" }} />Valor diário</li>
            <li><i className="line thick" style={{ background: "var(--accent)" }} />Média de 7 dias</li>
            <li><i className="tri" />Anomalia ({anomalyCount})</li>
            {limit && <li><i className="dash" />Limite CONAMA, {limit.text}</li>}
            {view.bands.some((b) => b.kind === "event") && <li><i style={{ background: "var(--water-light)" }} />Evento conhecido</li>}
          </ul>
          {view.focused && (
            <p className="focus-note">
              Mostrando 45 dias antes e depois de {dmy(focus!)}.{" "}
              <button type="button" className="text-button" onClick={clearFocus}>Voltar ao último ano</button>
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

function StationFoot({ data, station }: { data: Overview; station: Station }) {
  const [all, setAll] = useState(false);
  const alerts = useMemo(() => data.alerts.filter((a) => a.station_id === station.id), [data.alerts, station.id]);
  const trends = useMemo(() => data.trends.filter((t) => t.station_id === station.id && t.significant), [data.trends, station.id]);
  const shown = all ? alerts : alerts.slice(0, 4);

  return (
    <section className="station-foot">
      <div>
        <h2>Alertas desta estação</h2>
        {alerts.length ? (
          <m.ul className="alert-list" layout>
            <AnimatePresence initial={false}>
              {shown.map((a, i) => (
                <m.li
                  key={a.id}
                  layout
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0, transition: { duration: 0.35, ease: ease.out, delay: Math.max(0, i - 4) * 0.04 } }}
                  exit={{ opacity: 0, transition: { duration: 0.15 } }}
                  style={{ ["--sev" as string]: SEVERITY[a.severity].color }}
                >
                  <div className="alert-side">
                    <span className="alert-sev"><i />{SEVERITY[a.severity].label}</span>
                    <span className="alert-when">{a.severity === "cronico" || a.category === "tendencia" ? "nos dois anos" : dateRange(a.start, a.end)}</span>
                  </div>
                  <div className="alert-body">
                    <strong>{a.title}</strong>
                    <p>{a.message}</p>
                    <p className="alert-rec">{a.recommendation}</p>
                  </div>
                </m.li>
              ))}
            </AnimatePresence>
          </m.ul>
        ) : (
          <p className="empty">Nenhum alerta para esta estação nos dois anos.</p>
        )}
        {alerts.length > 4 && (
          <m.button type="button" className="text-button" onClick={() => setAll((v) => !v)} whileTap={tap} layout>
            {all ? "Mostrar só os mais recentes" : `Ver todos os ${alerts.length} alertas`}
          </m.button>
        )}
      </div>
      <div>
        <h2>Tendências de longo prazo</h2>
        {trends.length ? (
          <ul className="trend-list">
            {trends.map((t) => (
              <li key={t.parameter} style={{ ["--tone" as string]: trendTone(t) }}>
                <span className="trend-name">{t.label}</span>
                <span className="trend-value">{t.pct_per_year > 0 ? "+" : ""}{fmt(t.pct_per_year)}% ao ano</span>
                <span className="trend-desc">{verdictLabel(t)} estatisticamente significativa (p = {fmt(t.p_value, 3)}).</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="empty">Nenhum parâmetro mudou de forma significativa nos dois anos.</p>
        )}
      </div>
    </section>
  );
}
