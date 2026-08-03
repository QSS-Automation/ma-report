import React, { useState, useEffect, useCallback } from "react";
import { getOrderListEnhanced } from "../../services/api";
import { fmtMYR } from "../../utils/fmt";
import { showToast } from "../../utils/toast";

// ── Status badge ───────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const map = {
    "Fully Paid":      { bg: "#E8F5E9", color: "#1B5E20" },
    "Partially Paid":  { bg: "#FFF8E1", color: "#F57F17" },
    "Unpaid":          { bg: "#FFEBEE", color: "#B71C1C" },
    "Not Billed":      { bg: "#F5F5F5", color: "#616161" },
    "Invoiced":        { bg: "#E3F2FD", color: "#0D47A1" },
    "Open":            { bg: "#F5F5F5", color: "#9E9E9E" },
    "Closed":          { bg: "#E8F5E9", color: "#1B5E20" },
    "Cancelled":       { bg: "#F3E5F5", color: "#4A148C" },
    "Credit Noted":    { bg: "#FFF3E0", color: "#E65100" },
    "Fully Billed":    { bg: "#E8F5E9", color: "#1B5E20" },
    "Partially Billed":{ bg: "#FFF8E1", color: "#F57F17" },
  };
  const s = map[status] || { bg: "#F5F5F5", color: "#616161" };
  return (
    <span className="bdg" style={{ background: s.bg, color: s.color, fontSize: 10 }}>
      {status || "—"}
    </span>
  );
}

// ── GM badge ───────────────────────────────────────────────────────────────
function GmBadge({ pct }) {
  const n = parseFloat(pct);
  const color = n >= 30 ? "#1B5E20" : n >= 0 ? "#F57F17" : "#B71C1C";
  const bg    = n >= 30 ? "#E8F5E9" : n >= 0 ? "#FFF8E1" : "#FFEBEE";
  return (
    <span className="bdg" style={{ background: bg, color, fontSize: 10, fontFamily: "monospace" }}>
      {isNaN(n) ? "—" : `${n.toFixed(1)}%`}
    </span>
  );
}

// ── View-level toggle (small pill buttons) ──────────────────────────────────
const LEVELS = [
  { key: "committed", label: "Committed" },
  { key: "accrued",   label: "Accrued" },
  { key: "realised",  label: "Realised" },
];

function LevelToggle({ value, onChange }) {
  return (
    <div style={{ display: "flex", gap: 3 }} onClick={e => e.stopPropagation()}>
      {LEVELS.map(l => (
        <button
          key={l.key}
          onClick={() => onChange(l.key)}
          className="pg-btn"
          style={{
            fontSize: 10, padding: "2px 8px",
            ...(value === l.key ? { background: "var(--bg-accent)", color: "var(--text-accent)", borderColor: "var(--border-accent)" } : {}),
          }}
        >
          {l.label}
        </button>
      ))}
    </div>
  );
}

// ── Client-side line filters — mirrors the backend's committed/accrued/
// realised SQL WHERE clauses, applied locally so switching the view per
// project/SO needs no extra API call. ───────────────────────────────────────
function passesSo(r, level) {
  if (level === "accrued")  return r.billing_status === "Invoiced";
  if (level === "realised") return r.payment_status === "Fully Paid";
  return true; // committed — all lines
}
function passesPo(r, level) {
  if (level === "accrued")  return r.line_status === "Invoiced";
  if (level === "realised") return r.payment_status === "Fully Paid";
  return true;
}

// ── Aggregation helpers ─────────────────────────────────────────────────────
const sumBy = (arr, field) => arr.reduce((s, r) => s + Number(r[field] || 0), 0);

// "Open" if ANY line still has something outstanding for this status field
// (i.e. its value is NOT in the closed set); "Closed" only if every line's
// value is in the closed set. Always computed off the FULL (unfiltered) line
// set, since this reflects the document's true state — independent of
// whichever view (committed/accrued/realised) is currently selected.
function aggStatus(lines, field, closedValues) {
  if (!lines.length) return "Open";
  const allClosed = lines.every(r => closedValues.includes(r[field]));
  return allClosed ? "Closed" : "Open";
}
const BILLING_CLOSED = ["Invoiced", "Credit Noted", "Cancelled"];
const PAYMENT_CLOSED = ["Fully Paid", "Credit Noted", "Cancelled"];

function combinedStatus(billingAgg, paymentAgg) {
  return billingAgg === "Closed" && paymentAgg === "Closed" ? "Closed" : "Open";
}

// ── Build project tree from flat SO/PO lists (always the FULL, unfiltered
// data — per-view filtering happens at render time so switching the toggle
// doesn't need a re-fetch or re-group). ─────────────────────────────────────
function buildTree(soLines, poLines) {
  const projMap = {};

  soLines.forEach(r => {
    if (!projMap[r.proj_no]) projMap[r.proj_no] = { soMap: {}, unlinkedPoMap: {} };
    if (!projMap[r.proj_no].soMap[r.so_no])
      projMap[r.proj_no].soMap[r.so_no] = { so_no: r.so_no, so_date: r.so_date, lines: [], poMap: {} };
    projMap[r.proj_no].soMap[r.so_no].lines.push(r);
  });

  poLines.forEach(r => {
    if (!projMap[r.proj_no]) projMap[r.proj_no] = { soMap: {}, unlinkedPoMap: {} };
    const proj = projMap[r.proj_no];
    const so = r.linked_so_no ? proj.soMap[r.linked_so_no] : null;

    if (so) {
      if (!so.poMap[r.po_no]) so.poMap[r.po_no] = { po_no: r.po_no, po_date: r.po_date, lines: [] };
      so.poMap[r.po_no].lines.push(r);
    } else {
      if (!proj.unlinkedPoMap[r.po_no]) proj.unlinkedPoMap[r.po_no] = { po_no: r.po_no, po_date: r.po_date, lines: [] };
      proj.unlinkedPoMap[r.po_no].lines.push(r);
    }
  });

  return projMap;
}

function calcGM(soAmt, poAmt) {
  const gm    = soAmt - poAmt;
  const gmPct = soAmt > 0 ? (gm / soAmt) * 100 : null;
  return { gm, gmPct };
}

// ── PO group block — filters its own lines to the given view level; renders
// nothing if none of its lines qualify under that view. ────────────────────
function PoGroup({ po, level }) {
  const filteredLines = po.lines.filter(r => passesPo(r, level));
  if (filteredLines.length === 0) return null;

  const poAmt = sumBy(filteredLines, "po_amount");
  // Status badges always reflect the PO's TRUE overall state (all lines),
  // not just the lines visible under the current view filter.
  const rawBilling = po.lines[0]?.po_billing_status;
  const billingAgg = rawBilling === "Fully Billed" ? "Closed" : "Open";
  const paymentAgg = aggStatus(po.lines, "payment_status", PAYMENT_CLOSED);
  const overall    = combinedStatus(billingAgg, paymentAgg);

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 0", borderBottom: "0.5px solid #f0f0ee", fontSize: 12 }}>
        <span className="mono" style={{ fontWeight: 500, color: "#185FA5", flexShrink: 0 }}>{po.po_no || "—"}</span>
        <span style={{ fontSize: 10, color: "#888780", flexShrink: 0 }}>{po.po_date ? po.po_date.slice(0, 10) : ""}</span>
        <StatusBadge status={overall} />
        <span style={{ marginLeft: "auto", fontWeight: 500, color: "#333", fontFamily: "monospace", flexShrink: 0 }}>
          {fmtMYR(poAmt)}
        </span>
      </div>
      {filteredLines.map((r, i) => (
        <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, padding: "5px 0 5px 14px", borderBottom: "0.5px solid #f0f0ee", fontSize: 12 }}>
          <span style={{ color: "#333", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={r.description}>
            {r.description || r.item_code || "—"}
          </span>
          <StatusBadge status={r.line_status} />
          <StatusBadge status={r.payment_status} />
          <span style={{ fontWeight: 500, color: "#E24B4A", fontFamily: "monospace", flexShrink: 0 }}>{fmtMYR(r.po_amount)}</span>
        </div>
      ))}
    </>
  );
}

// ── Main component ─────────────────────────────────────────────────────────
export default function OrderListEnhanced({ entity = "QM" }) {
  const [tree,      setTree]      = useState({});
  const [loading,   setLoading]   = useState(false);
  const [expanded,  setExpanded]  = useState({});   // proj_no → bool
  const [soExp,     setSoExp]     = useState({});   // proj_no+so_no → bool
  const [search,    setSearch]    = useState("");
  const [projLevel, setProjLevel] = useState({});   // proj_no → committed|accrued|realised

  // Always fetch the full ("committed") dataset once — accrued/realised
  // views are derived client-side per project from billing_status /
  // line_status / payment_status, so no extra round-trip is needed when a
  // user switches a project's view.
  const run = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await getOrderListEnhanced(entity, "committed");
      const data = res.data;
      setTree(buildTree(data.so_lines || [], data.po_lines || []));
    } catch (e) {
      showToast("⚠ Failed to load: " + e.message);
    } finally {
      setLoading(false);
    }
  }, [entity]);

  useEffect(() => { run(); }, [run]);

  const toggleProj = (proj) => setExpanded(p => ({ ...p, [proj]: !p[proj] }));
  const toggleSO   = (key)  => setSoExp(p => ({ ...p, [key]: !p[key] }));
  const setLevelFor = (proj, lvl) => setProjLevel(p => ({ ...p, [proj]: lvl }));

  const projKeys = Object.keys(tree).filter(p =>
    !search || p.toLowerCase().includes(search.toLowerCase()) ||
    Object.keys(tree[p].soMap).some(s => s.toLowerCase().includes(search.toLowerCase()))
  );

  // Every project's own totals, computed under ITS OWN selected view level.
  // Used both for the grand KPI row and to avoid recomputing inside render.
  const projStats = {};
  Object.keys(tree).forEach(projNo => {
    const proj = tree[projNo];
    const lvl  = projLevel[projNo] || "committed";
    const soLinesF = Object.values(proj.soMap).flatMap(so => so.lines.filter(r => passesSo(r, lvl)));
    const poLinesF = Object.values(proj.soMap).flatMap(so => Object.values(so.poMap).flatMap(g => g.lines))
      .concat(Object.values(proj.unlinkedPoMap).flatMap(g => g.lines))
      .filter(r => passesPo(r, lvl));
    const soAmt = sumBy(soLinesF, "so_amount");
    const poAmt = sumBy(poLinesF, "po_amount");
    projStats[projNo] = { soAmt, poAmt, ...calcGM(soAmt, poAmt) };
  });

  const totSO  = Object.values(projStats).reduce((s, p) => s + p.soAmt, 0);
  const totPO  = Object.values(projStats).reduce((s, p) => s + p.poAmt, 0);
  const totGM  = totSO - totPO;
  const totPct = totSO > 0 ? (totGM / totSO) * 100 : 0;

  return (
    <div>
      {/* ── Filter bar ─────────────────────────────────────────── */}
      <div className="filter" style={{ gap: 8 }}>
        <span className="f-lbl">Order List Enhanced</span>
        <span style={{ fontSize: 10, color: "#888780" }}>View selection is now per-project — set it on each project card below.</span>
        <input
          className="search"
          style={{ marginLeft: "auto", width: 180, fontSize: 12 }}
          placeholder="Search project, SO…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <button className="pg-btn" onClick={run} disabled={loading}>
          {loading ? "Loading…" : "Refresh"}
        </button>
      </div>

      {/* ── Grand KPI row (aggregated using each project's own selected view) ── */}
      <div style={{ padding: "14px 18px", background: "#fff", borderBottom: "1px solid #e8e7e0" }}>
        <div className="kpi-row" style={{ marginBottom: 0 }}>
          <div className="kpi">
            <div className="kpi-lbl">Total SO Amount</div>
            <div className="kpi-val b">{fmtMYR(totSO)}</div>
            <div className="kpi-sub">{Object.keys(tree).length} projects</div>
          </div>
          <div className="kpi">
            <div className="kpi-lbl">Total PO Amount</div>
            <div className="kpi-val a">{fmtMYR(totPO)}</div>
          </div>
          <div className="kpi">
            <div className="kpi-lbl">Gross Margin</div>
            <div className="kpi-val" style={{ color: totGM >= 0 ? "#0C9B6E" : "#E24B4A" }}>{fmtMYR(totGM)}</div>
            <div className="kpi-sub">{totPct.toFixed(1)}% of sales</div>
          </div>
          <div className="kpi">
            <div className="kpi-lbl">Margin %</div>
            <div className="kpi-val" style={{ color: totGM >= 0 ? "#0C9B6E" : "#E24B4A" }}>{totPct.toFixed(1)}%</div>
            <div className="kpi-sub">{entity} · each project's own view</div>
          </div>
        </div>
      </div>

      {/* ── Content ────────────────────────────────────────────── */}
      <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 8, background: "#fff" }}>
        {loading && (
          <div style={{ textAlign: "center", padding: 40, color: "#888780", fontSize: 12 }}>
            Loading…
          </div>
        )}

        {!loading && projKeys.length === 0 && (
          <div className="card">
            <div style={{ textAlign: "center", padding: "2rem", color: "#888780", fontSize: 13 }}>
              No data found.
            </div>
          </div>
        )}

        {!loading && projKeys.map(projNo => {
          const proj   = tree[projNo];
          const lvl    = projLevel[projNo] || "committed";
          const isOpen = expanded[projNo];

          // SOs/POs that still have at least one line qualifying under this project's view
          const soKeys = Object.keys(proj.soMap).filter(soNo => {
            const so = proj.soMap[soNo];
            const hasSo = so.lines.some(r => passesSo(r, lvl));
            const hasPo = Object.values(so.poMap).flatMap(g => g.lines).some(r => passesPo(r, lvl));
            return hasSo || hasPo;
          });
          const unlinkedPoKeys = Object.keys(proj.unlinkedPoMap).filter(k =>
            proj.unlinkedPoMap[k].lines.some(r => passesPo(r, lvl))
          );

          const { soAmt: projSOAmt, poAmt: projPOAmt, gm: projGM, gmPct: projGMPct } = projStats[projNo];

          return (
            <div key={projNo} className="card" style={{ marginBottom: 8 }}>

              {/* Project header */}
              <div className="card-hdr" onClick={() => toggleProj(projNo)}
                style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", userSelect: "none", flexWrap: "wrap" }}>
                <span style={{
                  fontSize: 10, color: "#888780", width: 12, display: "inline-block",
                  transform: isOpen ? "rotate(90deg)" : "rotate(0deg)",
                  transition: "transform 0.15s",
                }}>▶</span>
                <span className="card-title" style={{ minWidth: 160, fontSize: 13 }}>{projNo}</span>
                <span className="bdg bdg-ps" style={{ fontSize: 10 }}>{soKeys.length} SO</span>
                {unlinkedPoKeys.length > 0 && (
                  <span className="bdg bdg-lic" style={{ fontSize: 10 }}>+{unlinkedPoKeys.length} unlinked PO</span>
                )}
                <LevelToggle value={lvl} onChange={(newLvl) => setLevelFor(projNo, newLvl)} />
                <div style={{ display: "flex", gap: 24, marginLeft: "auto", flexWrap: "wrap" }}>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 10, color: "#888780" }}>Total SO Amount</div>
                    <div style={{ fontSize: 12, fontWeight: 500 }}>{fmtMYR(projSOAmt)}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 10, color: "#888780" }}>Total PO Amount</div>
                    <div style={{ fontSize: 12, fontWeight: 500 }}>{fmtMYR(projPOAmt)}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 10, color: "#888780" }}>Gross Margin</div>
                    <div style={{ fontSize: 12, fontWeight: 500, color: projGM >= 0 ? "#0C9B6E" : "#E24B4A" }}>{fmtMYR(projGM)}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 10, color: "#888780" }}>Margin %</div>
                    <div style={{ fontSize: 12, fontWeight: 500 }}><GmBadge pct={projGMPct} /></div>
                  </div>
                </div>
              </div>

              {/* Project body */}
              {isOpen && (
                <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 8, background: "#fff" }}>

                  {/* SO rows */}
                  {soKeys.map(soNo => {
                    const so       = proj.soMap[soNo];
                    const soKey    = `${projNo}__${soNo}`;
                    const isSoOpen = soExp[soKey];
                    const poGroups = Object.values(so.poMap);

                    const soLinesF = so.lines.filter(r => passesSo(r, lvl));
                    const poLinesF = poGroups.flatMap(g => g.lines).filter(r => passesPo(r, lvl));
                    const soAmt = sumBy(soLinesF, "so_amount");
                    const poAmt = sumBy(poLinesF, "po_amount");
                    const { gm: soGM, gmPct: soGMPct } = calcGM(soAmt, poAmt);

                    // Status badges always reflect the SO's TRUE overall state
                    // (all lines), independent of the selected view.
                    const soBillingAgg = aggStatus(so.lines, "billing_status", BILLING_CLOSED);
                    const soPaymentAgg = aggStatus(so.lines, "payment_status", PAYMENT_CLOSED);
                    const soOverall    = combinedStatus(soBillingAgg, soPaymentAgg);

                    return (
                      <div key={soNo} style={{ border: "0.5px solid #e8e7e0", borderRadius: 8, overflow: "hidden", background: "#fff" }}>

                        {/* SO header */}
                        <div onClick={() => toggleSO(soKey)}
                          style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 12px", background: "#fafaf8", borderBottom: isSoOpen ? "0.5px solid #e8e7e0" : "none", cursor: "pointer", flexWrap: "wrap" }}>
                          <span style={{ fontSize: 10, color: "#888780" }}>{isSoOpen ? "▾" : "▸"}</span>
                          <span style={{ fontSize: 11, fontWeight: 500 }}>{soNo}</span>
                          <span style={{ fontSize: 10, color: "#888780" }}>
                            {so.so_date ? so.so_date.slice(0, 10) : ""}
                          </span>
                          <StatusBadge status={soOverall} />
                          {/* SO-level margin — recalculates with the project's selected view */}
                          <div style={{ display: "flex", gap: 12, marginLeft: "auto", fontSize: 10, alignItems: "center" }}>
                            <span>SO: <strong style={{ fontFamily: "monospace" }}>{fmtMYR(soAmt)}</strong></span>
                            <span>PO: <strong style={{ fontFamily: "monospace" }}>{fmtMYR(poAmt)}</strong></span>
                            <span>GM: <strong style={{ fontFamily: "monospace", color: soGM >= 0 ? "#0C9B6E" : "#E24B4A" }}>{fmtMYR(soGM)}</strong> <GmBadge pct={soGMPct} /></span>
                          </div>
                        </div>

                        {/* SO detail */}
                        {isSoOpen && (
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0, background: "#fff" }}>

                            {/* Sales lines */}
                            <div style={{ padding: "8px 12px", borderRight: "0.5px solid #e8e7e0" }}>
                              <div style={{ fontSize: 10, fontWeight: 500, color: "#888780", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 6 }}>
                                Sales (SO lines)
                              </div>
                              <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 0", borderBottom: "0.5px solid #f0f0ee", fontSize: 12 }}>
                                <span className="mono" style={{ fontWeight: 500, color: "#185FA5", flexShrink: 0 }}>{soNo}</span>
                                <span style={{ fontSize: 10, color: "#888780", flexShrink: 0 }}>{so.so_date ? so.so_date.slice(0, 10) : ""}</span>
                                <StatusBadge status={soOverall} />
                                <span style={{ marginLeft: "auto", fontWeight: 500, color: "#333", fontFamily: "monospace", flexShrink: 0 }}>
                                  {fmtMYR(soAmt)}
                                </span>
                              </div>
                              {soLinesF.length === 0 && (
                                <div style={{ fontSize: 12, color: "#888780", fontStyle: "italic", padding: "8px 0" }}>No lines under this view</div>
                              )}
                              {soLinesF.map((r, i) => (
                                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, padding: "5px 0", borderBottom: "0.5px solid #f0f0ee", fontSize: 12 }}>
                                  <span style={{ color: "#333", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={r.description}>
                                    {r.description || r.item_code || "—"}
                                  </span>
                                  <StatusBadge status={r.billing_status} />
                                  <StatusBadge status={r.payment_status} />
                                  <span style={{ fontWeight: 500, color: "#0C9B6E", fontFamily: "monospace", flexShrink: 0 }}>{fmtMYR(r.so_amount)}</span>
                                </div>
                              ))}
                            </div>

                            {/* PO groups */}
                            <div style={{ padding: "8px 12px" }}>
                              <div style={{ fontSize: 10, fontWeight: 500, color: "#888780", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 6 }}>
                                Purchases (PO)
                              </div>
                              {poGroups.length === 0 && (
                                <div style={{ fontSize: 12, color: "#888780", fontStyle: "italic" }}>No linked PO</div>
                              )}
                              {poGroups.map(g => <PoGroup key={g.po_no} po={g} level={lvl} />)}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Unlinked PO section */}
                  {unlinkedPoKeys.length > 0 && (
                    <div style={{ borderTop: "0.5px dashed #e8e7e0", paddingTop: 8 }}>
                      <div style={{ fontSize: 10, fontWeight: 500, color: "#888780", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 6 }}>
                        Purchases not linked to any SO
                      </div>
                      {unlinkedPoKeys.map(k => <PoGroup key={k} po={proj.unlinkedPoMap[k]} level={lvl} />)}
                    </div>
                  )}

                  {/* Project footer */}
                  <div style={{ display: "flex", justifyContent: "flex-end", gap: 20, padding: "8px 0", borderTop: "0.5px solid #e8e7e0", fontSize: 11 }}>
                    <span>Total SO Amount: <strong style={{ color: "#0C9B6E", fontFamily: "monospace" }}>{fmtMYR(projSOAmt)}</strong></span>
                    <span>Total PO Amount: <strong style={{ color: "#E24B4A", fontFamily: "monospace" }}>{fmtMYR(projPOAmt)}</strong></span>
                    <span>Gross Margin: <strong style={{ fontFamily: "monospace", color: projGM >= 0 ? "#0C9B6E" : "#E24B4A" }}>{fmtMYR(projGM)}</strong> <GmBadge pct={projGMPct} /></span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
