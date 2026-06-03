import React, { useState } from "react";
import { MN } from "../../utils/fmt";

export default function PnLCompare({ cmpData, mp }) {
  const [histOpen, setHistOpen] = useState(true);
  const [expandState, setExpandState] = useState({});

  const { active, priorSame, priorFull } = cmpData;

  const sumSec = (dataset, section, rowType) => {
    if (!dataset) return 0;
    const r = dataset.rows.find(r => r.section === section && r.row_type === rowType);
    return r ? r.months.reduce((a, b) => a + (Number(b) || 0), 0) : 0;
  };

  const getDets = (dataset, section) =>
    dataset ? dataset.rows.filter(r => r.section === section && r.row_type === "detail") : [];

  const fmt = n => {
    const a = Math.abs(n);
    const s = a >= 1e6 ? (a / 1e6).toFixed(2) + "M" : a.toLocaleString("en-MY");
    return n < 0 ? "(" + s + ")" : s;
  };

  const yoy = (cur, prior) => {
    if (!prior || prior === 0) return null;
    const pct = ((cur - prior) / Math.abs(prior)) * 100;
    return { pct, color: pct >= 0 ? "#1D9E75" : "#c0392b", label: (pct >= 0 ? "+" : "") + pct.toFixed(1) + "%" };
  };

  const aLabel  = `${MN[mp.s.fromMonth]} ${MN[mp.s.toMonth]} ${mp.s.fromYear}`;
  const pyLabel = `${MN[mp.s.fromMonth]} ${MN[mp.s.toMonth]} ${mp.s.fromYear - 1}`;
  const fyLabel = `Full Year ${mp.s.fromYear - 1}`;

  const ROWS = [
    { key: "rev",  label: "Total Revenue",         section: "SALES",              rt: "subtotal", isSum: false },
    { key: "cogs", label: "Cost of Goods Sold",     section: "COST OF GOODS SOLD", rt: "subtotal", isSum: false },
    { key: "gp",   label: "Gross Profit",           section: "GROSS_PROFIT",       rt: "summary",  isSum: true  },
    { key: "opex", label: "Operating Expenses",     section: "OPERATING EXPENSES", rt: "subtotal", isSum: false },
    { key: "pbt",  label: "Net Profit Before Tax",  section: "NET_PROFIT_BEFORE",  rt: "summary",  isSum: true  },
    { key: "tax",  label: "Taxation",               section: "TAXATION",           rt: "subtotal", isSum: false },
    { key: "pat",  label: "Net Profit After Tax",   section: "NET_PROFIT_AFTER",   rt: "summary",  isSum: true  },
  ];

  return (
    <div className="card" style={{ overflow: "hidden", marginBottom: 0 }}>
      <div className="tv-scroll">
        <table className="tv-table">
          <thead>
            <tr>
              <th className="tv-th-desc">Description</th>
              <th className="tv-th-toggle"
                onClick={() => setHistOpen(!histOpen)}
                style={{ padding: "4px 8px", cursor: "pointer", textAlign: "center", borderLeft: "1px solid #e8e7e0", borderBottom: "1px solid #e8e7e0" }}>
                <span style={{ fontSize: 10, color: "#185FA5", fontWeight: 700 }}>{histOpen ? "◀" : "▶"}</span>
              </th>
              <th className={"tv-th-num tv-th-prior tv-hist" + (histOpen ? " show" : "")}>{fyLabel}</th>
              <th className={"tv-th-num tv-th-prior tv-hist" + (histOpen ? " show" : "")}>{pyLabel}</th>
              <th className="tv-th-num tv-th-active">{aLabel}</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map(r => {
              const aCur  = sumSec(active,     r.section, r.rt);
              const aPy   = sumSec(priorSame,  r.section, r.rt);
              const aFy   = sumSec(priorFull,  r.section, r.rt);
              const yoyPy = yoy(aCur, aPy);
              const isEx  = expandState[r.key];
              const detsActive = getDets(active,    r.section);
              const detsPy     = getDets(priorSame, r.section);
              const detsFy     = getDets(priorFull, r.section);

              // build a unified label list across all datasets
              const allLabels = [...new Set([
                ...detsActive.map(d => d.label),
                ...detsPy.map(d => d.label),
                ...detsFy.map(d => d.label),
              ])];

              return (
                <React.Fragment key={r.key}>
                  <tr className={r.isSum ? "tv-sec-sum" : "tv-sec-row"}
                    onClick={() => !r.isSum && setExpandState(p => ({ ...p, [r.key]: !p[r.key] }))}>
                    {r.isSum ? (
                      <td className="tv-td-sum">
                        {r.label}
                        {yoyPy && <><br /><span style={{ fontSize: 10, color: yoyPy.color, fontWeight: 600 }}>YoY {yoyPy.label}</span></>}
                      </td>
                    ) : (
                      <td className="tv-td-desc">
                        <span style={{ fontSize: 10, color: "#b4b2a9", marginRight: 6, display: "inline-block", transition: "transform .15s", transform: isEx ? "rotate(90deg)" : "none" }}>▶</span>
                        {r.label}
                      </td>
                    )}
                    <td className="tv-td-toggle" />
                    <td className={"tv-td-num tv-td-prior tv-hist" + (histOpen ? " show" : "") + (r.isSum ? " tv-sum-num" : "")}>{fmt(aFy)}</td>
                    <td className={"tv-td-num tv-td-prior tv-hist" + (histOpen ? " show" : "") + (r.isSum ? " tv-sum-num" : "")}>{fmt(aPy)}</td>
                    <td className={"tv-td-num tv-td-active" + (r.isSum ? " tv-sum-num" : "")}>{fmt(aCur)}</td>
                  </tr>
                  {allLabels.map((lbl, i) => {
                    const da = detsActive.find(d => d.label === lbl);
                    const dp = detsPy.find(d => d.label === lbl);
                    const df = detsFy.find(d => d.label === lbl);
                    const va = da ? da.months.reduce((a, b) => a + (Number(b) || 0), 0) : 0;
                    const vp = dp ? dp.months.reduce((a, b) => a + (Number(b) || 0), 0) : 0;
                    const vf = df ? df.months.reduce((a, b) => a + (Number(b) || 0), 0) : 0;
                    return (
                      <tr key={i} className={"tv-row-det" + (isEx ? " show" : "")}>
                        <td className="tv-td-det">{lbl}</td>
                        <td className="tv-td-toggle" />
                        <td className={"tv-td-num tv-td-prior tv-hist" + (histOpen ? " show" : "") + " tv-muted"}>{vf !== 0 ? fmt(vf) : "—"}</td>
                        <td className={"tv-td-num tv-td-prior tv-hist" + (histOpen ? " show" : "") + " tv-muted"}>{vp !== 0 ? fmt(vp) : "—"}</td>
                        <td className="tv-td-num tv-td-active">{va !== 0 ? fmt(va) : "—"}</td>
                      </tr>
                    );
                  })}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="tv-foot">
        <span>QM · MYR · Active: {aLabel} vs {pyLabel} (prior year)</span>
        <span>▶ click row to expand details · ◀/▶ to show/hide prior columns</span>
      </div>
    </div>
  );
}