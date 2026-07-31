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

// ── Aggregation helpers ─────────────────────────────────────────────────────
// Sum a numeric field across a set of lines.
const sumBy = (arr, field) => arr.reduce((s, r) => s + Number(r[field] || 0), 0);

// Sum a numeric field, de-duplicated by a key (used where the value is a
// doc-level total repeated across every detail line — e.g. billed_amount,
// paid_amount — so a straight sum would double-count).
function sumUniqueBy(arr, keyField, valField) {
  const seen = new Map();
  arr.forEach(r => {
    const k = r[keyField];
    if (k && !seen.has(k)) seen.set(k, Number(r[valField] || 0));
  });
  let total = 0;
  seen.forEach(v => { total += v; });
  return total;
}

// "Open" if ANY line still has something outstanding for this status field
// (i.e. its value is NOT in the closed set); "Closed" only if every line's
// value is in the closed set.
function aggStatus(lines, field, closedValues) {
  if (!lines.length) return "Open";
  const allClosed = lines.every(r => closedValues.includes(r[field]));
  return allClosed ? "Closed" : "Open";
}

const BILLING_CLOSED = ["Invoiced", "Credit Noted", "Cancelled"];
const PAYMENT_CLOSED = ["Fully Paid", "Credit Noted", "Cancelled"];

// One combined status: "Closed" only when BOTH billing and payment are
// fully closed; "Open" if either side still has something outstanding.
function combinedStatus(billingAgg, paymentAgg) {
  return billingAgg === "Closed" && paymentAgg === "Closed" ? "Closed" : "Open";
}

// Human-readable billing label across a set of lines: Fully/Partially/Not Billed.
function billingDisplay(lines, field) {
  if (!lines.length) return "Not Billed";
  const closedCount = lines.filter(r => BILLING_CLOSED.includes(r[field])).length;
  if (closedCount === lines.length) return "Fully Billed";
  if (closedCount === 0) return "Not Billed";
  return "Partially Billed";
}

// Human-readable payment label across a set of lines: Fully/Partially Paid/Unpaid.
function paymentDisplay(lines) {
  if (!lines.length) return "Unpaid";
  const closedCount = lines.filter(r => PAYMENT_CLOSED.includes(r.payment_status)).length;
  if (closedCount === lines.length) return "Fully Paid";
  if (closedCount === 0) return "Unpaid";
  return "Partially Paid";
}

// ── Build project tree from flat SO/PO lists ───────────────────────────────
// proj -> { soMap: { so_no -> { lines[], poMap: { po_no -> { lines[] } } } },
//           unlinkedPoMap: { po_no -> { lines[] } } }
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

// Pick the right amount basis for a subset of SO/PO lines depending on the
// selected filter level — committed uses raw SO/PO amounts, accrued uses
// billed amounts, realised uses paid amounts (de-duped by doc key).
function basisAmounts(soLines, poLines, level) {
  if (level === "accrued") {
    return {
      soAmt: sumUniqueBy(soLines, "iv_no", "iv_amount"),
      poAmt: sumUniqueBy(poLines, "po_no", "billed_amount"),
      label: "Billed",
    };
  }
  if (level === "realised") {
    return {
      soAmt: sumUniqueBy(soLines, "iv_no", "paid_amount"),
      poAmt: sumUniqueBy(poLines, "pi_no", "paid_amount"),
      label: "Paid",
    };
  }
  return { soAmt: sumBy(soLines, "so_amount"), poAmt: sumBy(poLines, "po_amount"), label: "Amount" };
}

// ── Calculate GM ───────────────────────────────────────────────────────────
function calcGM(soAmt, poAmt) {
  const gm    = soAmt - poAmt;
  const gmPct = soAmt > 0 ? (gm / soAmt) * 100 : null;
  return { gm, gmPct };
}

// ── PO group block (used both for SO-linked PO groups and unlinked POs) ────
function PoGroup({ po }) {
  const poAmt = sumBy(po.lines, "po_amount");
  // po_billing_status is already a doc-level aggregate from the curated layer
  // (Fully Billed / Partially Billed / Not Billed) — identical across all
  // lines of the same po_no, so it's safe to read off the first line.
  const rawBilling = po.lines[0]?.po_billing_status;
  const billingAgg = rawBilling === "Fully Billed" ? "Closed" : "Open";
  const paymentAgg = aggStatus(po.lines, "payment_status", PAYMENT_CLOSED);
  const overall     = combinedStatus(billingAgg, paymentAgg);
  const payDisplay  = paymentDisplay(po.lines);

  return (
    <>
      {/* PO header row — same row style/height as a Sales line, just bold + badges */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 0", borderBottom: "0.5px solid #f0f0ee", fontSize: 12 }}>
        <span className="mono" style={{ fontWeight: 500, color: "#185FA5", flexShrink: 0 }}>{po.po_no || "—"}</span>
        <span style={{ fontSize: 10, color: "#888780", flexShrink: 0 }}>{po.po_date ? po.po_date.slice(0, 10) : ""}</span>
        <StatusBadge status={overall} />
        <StatusBadge status={rawBilling || "Not Billed"} />
        <StatusBadge status={payDisplay} />
        <span style={{ marginLeft: "auto", fontWeight: 500, color: "#E24B4A", fontFamily: "monospace", flexShrink: 0 }}>
          {fmtMYR(poAmt)}
        </span>
      </div>
      {/* PO item lines — plain rows, same style as Sales lines */}
      {po.lines.map((r, i) => (
        <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, padding: "5px 0 5px 14px", borderBottom: "0.5px solid #f0f0ee", fontSize: 12 }}>
          <span style={{ color: "#333", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={r.description}>
            {r.description || r.item_code || "—"}
          </span>
          <span style={{ fontWeight: 500, color: "#E24B4A", fontFamily: "monospace", flexShrink: 0 }}>{fmtMYR(r.po_amount)}</span>
        </div>
      ))}
    </>
  );
}

// ── Main component ─────────────────────────────────────────────────────────
export default function OrderListEnhanced({ entity = "QM" }) {
  const [level,    setLevel]    = useState("committed");
  const [tree,     setTree]     = useState({});
  const [loading,  setLoading]  = useState(false);
  const [expanded, setExpanded] = useState({});   // proj_no → bool
  const [soExp,    setSoExp]    = useState({});    // proj_no+so_no → bool
  const [search,   setSearch]   = useState("");

  const run = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await getOrderListEnhanced(entity, level);
      const data = res.data;
      setTree(buildTree(data.so_lines || [], data.po_lines || []));
    } catch (e) {
      showToast("⚠ Failed to load: " + e.message);
    } finally {
      setLoading(false);
    }
  }, [entity, level]);

  useEffect(() => { run(); }, [run]);

  const toggleProj = (proj) => setExpanded(p => ({ ...p, [proj]: !p[proj] }));
  const toggleSO   = (key)  => setSoExp(p => ({ ...p, [key]: !p[key] }));

  // Filter by search
  const projKeys = Object.keys(tree).filter(p =>
    !search || p.toLowerCase().includes(search.toLowerCase()) ||
    Object.keys(tree[p].soMap).some(s => s.toLowerCase().includes(search.toLowerCase()))
  );

  // Grand totals across all loaded data (unaffected by search filter)
  const allSoLines = Object.values(tree).flatMap(p => Object.values(p.soMap).flatMap(so => so.lines));
  const allPoLines = Object.values(tree).flatMap(p =>
    Object.values(p.soMap).flatMap(so => Object.values(so.poMap).flatMap(g => g.lines))
      .concat(Object.values(p.unlinkedPoMap).flatMap(g => g.lines))
  );

  const totSO  = sumBy(allSoLines, "so_amount");
  const totPO  = sumBy(allPoLines, "po_amount");
  const totGM  = totSO - totPO;
  const totPct = totSO > 0 ? (totGM / totSO) * 100 : 0;

  // Accrued-level metrics: billed & paid amounts, de-duped by doc key
  const soBilledAmt = sumUniqueBy(allSoLines, "iv_no", "iv_amount");
  const soPaidAmt    = sumUniqueBy(allSoLines, "iv_no", "paid_amount");
  const poBilledAmt = sumUniqueBy(allPoLines, "po_no", "billed_amount");
  const poPaidAmt    = sumUniqueBy(allPoLines, "pi_no", "paid_amount");

  // Margin basis changes with the selected filter:
  // committed → SO/PO amount, accrued → billed amount, realised → paid amount
  const accruedGM  = soBilledAmt - poBilledAmt;
  const accruedPct = soBilledAmt > 0 ? (accruedGM / soBilledAmt) * 100 : 0;
  const realisedGM  = soPaidAmt - poPaidAmt;
  const realisedPct = soPaidAmt > 0 ? (realisedGM / soPaidAmt) * 100 : 0;

  return (
    <div>
      {/* ── Filter bar ─────────────────────────────────────────── */}
      <div className="filter" style={{ gap: 8 }}>
        <span className="f-lbl">View</span>
        {[
          { key: "committed", label: "Committed",  sub: "All SO + PO lines" },
          { key: "accrued",   label: "Accrued",    sub: "Invoiced SO + Billed PO" },
          { key: "realised",  label: "Realised",   sub: "Paid SO + Paid PO" },
        ].map(l => (
          <button key={l.key}
            className={"pg-btn" + (level === l.key ? " active" : "")}
            style={level === l.key ? { background: "var(--bg-accent)", color: "var(--text-accent)", borderColor: "var(--border-accent)" } : {}}
            onClick={() => setLevel(l.key)}>
            {l.label}
            <span style={{ fontSize: 9, color: level === l.key ? "var(--text-accent)" : "var(--text-muted)", marginLeft: 4 }}>
              {l.sub}
            </span>
          </button>
        ))}
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

      {/* ── KPI summary row(s) — content depends on selected level ─ */}
      <div style={{ padding: "14px 18px", background: "#fff", borderBottom: "1px solid #e8e7e0" }}>

        {level === "committed" && (
          <div className="kpi-row" style={{ marginBottom: 0 }}>
            <div className="kpi">
              <div className="kpi-lbl">Total Sales (SO)</div>
              <div className="kpi-val b">{fmtMYR(totSO)}</div>
              <div className="kpi-sub">{allSoLines.length} lines · {Object.keys(tree).length} projects</div>
            </div>
            <div className="kpi">
              <div className="kpi-lbl">Total Purchases (PO)</div>
              <div className="kpi-val a">{fmtMYR(totPO)}</div>
              <div className="kpi-sub">{allPoLines.length} lines</div>
            </div>
            <div className="kpi">
              <div className="kpi-lbl">Gross Margin</div>
              <div className="kpi-val" style={{ color: totGM >= 0 ? "#0C9B6E" : "#E24B4A" }}>{fmtMYR(totGM)}</div>
              <div className="kpi-sub">{totPct.toFixed(1)}% of sales</div>
            </div>
            <div className="kpi">
              <div className="kpi-lbl">Margin %</div>
              <div className="kpi-val" style={{ color: totGM >= 0 ? "#0C9B6E" : "#E24B4A" }}>{totPct.toFixed(1)}%</div>
              <div className="kpi-sub">{entity} · {level}</div>
            </div>
          </div>
        )}

        {level === "accrued" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, color: "#888780", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 6 }}>Sales (SO)</div>
              <div className="kpi-row" style={{ marginBottom: 0 }}>
                <div className="kpi">
                  <div className="kpi-lbl">Total SO Amount</div>
                  <div className="kpi-val b">{fmtMYR(totSO)}</div>
                </div>
                <div className="kpi">
                  <div className="kpi-lbl">Total Billed Amount</div>
                  <div className="kpi-val">{fmtMYR(soBilledAmt)}</div>
                </div>
                <div className="kpi">
                  <div className="kpi-lbl">Total Paid Amount</div>
                  <div className="kpi-val" style={{ color: "#0C9B6E" }}>{fmtMYR(soPaidAmt)}</div>
                </div>
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, color: "#888780", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 6 }}>Purchases (PO)</div>
              <div className="kpi-row" style={{ marginBottom: 0 }}>
                <div className="kpi">
                  <div className="kpi-lbl">Total PO Amount</div>
                  <div className="kpi-val a">{fmtMYR(totPO)}</div>
                </div>
                <div className="kpi">
                  <div className="kpi-lbl">Total Billed Amount</div>
                  <div className="kpi-val">{fmtMYR(poBilledAmt)}</div>
                </div>
                <div className="kpi">
                  <div className="kpi-lbl">Total Paid Amount</div>
                  <div className="kpi-val" style={{ color: "#E24B4A" }}>{fmtMYR(poPaidAmt)}</div>
                </div>
              </div>
            </div>
            <div className="kpi-row" style={{ marginBottom: 0 }}>
              <div className="kpi">
                <div className="kpi-lbl">Gross Margin (Billed)</div>
                <div className="kpi-val" style={{ color: accruedGM >= 0 ? "#0C9B6E" : "#E24B4A" }}>{fmtMYR(accruedGM)}</div>
              </div>
              <div className="kpi">
                <div className="kpi-lbl">Margin %</div>
                <div className="kpi-val" style={{ color: accruedGM >= 0 ? "#0C9B6E" : "#E24B4A" }}>{accruedPct.toFixed(1)}%</div>
                <div className="kpi-sub">Billed SO vs Billed PO</div>
              </div>
            </div>
          </div>
        )}

        {level === "realised" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, color: "#888780", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 6 }}>Sales (SO)</div>
              <div className="kpi-row" style={{ marginBottom: 0 }}>
                <div className="kpi">
                  <div className="kpi-lbl">Total SO Amount</div>
                  <div className="kpi-val b">{fmtMYR(totSO)}</div>
                </div>
                <div className="kpi">
                  <div className="kpi-lbl">Total Paid Amount</div>
                  <div className="kpi-val" style={{ color: "#0C9B6E" }}>{fmtMYR(soPaidAmt)}</div>
                </div>
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 600, color: "#888780", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 6 }}>Purchases (PO)</div>
              <div className="kpi-row" style={{ marginBottom: 0 }}>
                <div className="kpi">
                  <div className="kpi-lbl">Total PO Amount</div>
                  <div className="kpi-val a">{fmtMYR(totPO)}</div>
                </div>
                <div className="kpi">
                  <div className="kpi-lbl">Total Paid Amount</div>
                  <div className="kpi-val" style={{ color: "#E24B4A" }}>{fmtMYR(poPaidAmt)}</div>
                </div>
              </div>
            </div>
            <div className="kpi-row" style={{ marginBottom: 0 }}>
              <div className="kpi">
                <div className="kpi-lbl">Gross Margin (Realised)</div>
                <div className="kpi-val" style={{ color: realisedGM >= 0 ? "#0C9B6E" : "#E24B4A" }}>{fmtMYR(realisedGM)}</div>
              </div>
              <div className="kpi">
                <div className="kpi-lbl">Margin %</div>
                <div className="kpi-val" style={{ color: realisedGM >= 0 ? "#0C9B6E" : "#E24B4A" }}>{realisedPct.toFixed(1)}%</div>
                <div className="kpi-sub">Paid SO vs Paid PO</div>
              </div>
            </div>
          </div>
        )}
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
          const proj    = tree[projNo];
          const soKeys  = Object.keys(proj.soMap);
          const unlinkedPoKeys = Object.keys(proj.unlinkedPoMap);
          const isOpen  = expanded[projNo];

          const projSoLines = soKeys.flatMap(k => proj.soMap[k].lines);
          const projPoLines = soKeys.flatMap(k => Object.values(proj.soMap[k].poMap).flatMap(g => g.lines))
            .concat(unlinkedPoKeys.flatMap(k => proj.unlinkedPoMap[k].lines));

          const { soAmt: projSOAmt, poAmt: projPOAmt, label: basisLabel } = basisAmounts(projSoLines, projPoLines, level);
          const { gm: projGM, gmPct: projGMPct } = calcGM(projSOAmt, projPOAmt);

          return (
            <div key={projNo} className="card" style={{ marginBottom: 8 }}>

              {/* Project header */}
              <div className="card-hdr" onClick={() => toggleProj(projNo)}
                style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", userSelect: "none" }}>
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
                <div style={{ display: "flex", gap: 24, marginLeft: "auto", flexWrap: "wrap" }}>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 10, color: "#888780" }}>Total SO {basisLabel}</div>
                    <div style={{ fontSize: 12, fontWeight: 500 }}>{fmtMYR(projSOAmt)}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 10, color: "#888780" }}>Total PO {basisLabel}</div>
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
                    const so     = proj.soMap[soNo];
                    const soKey  = `${projNo}__${soNo}`;
                    const isSoOpen = soExp[soKey];
                    const poGroups = Object.values(so.poMap);

                    // Aggregate across ALL lines in this SO — not just the first —
                    // so a partially-invoiced/paid SO doesn't get mislabeled.
                    const soBillingAgg = aggStatus(so.lines, "billing_status", BILLING_CLOSED);
                    const soPaymentAgg = aggStatus(so.lines, "payment_status", PAYMENT_CLOSED);
                    const soOverall    = combinedStatus(soBillingAgg, soPaymentAgg);
                    const soBillDisplay = billingDisplay(so.lines, "billing_status");
                    const soPayDisplay  = paymentDisplay(so.lines);

                    return (
                      <div key={soNo} style={{ border: "0.5px solid #e8e7e0", borderRadius: 8, overflow: "hidden", background: "#fff" }}>

                        {/* SO header */}
                        <div onClick={() => toggleSO(soKey)}
                          style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 12px", background: "#fafaf8", borderBottom: isSoOpen ? "0.5px solid #e8e7e0" : "none", cursor: "pointer" }}>
                          <span style={{ fontSize: 10, color: "#888780" }}>{isSoOpen ? "▾" : "▸"}</span>
                          <span style={{ fontSize: 11, fontWeight: 500 }}>{soNo}</span>
                          <span style={{ fontSize: 10, color: "#888780" }}>
                            {so.so_date ? so.so_date.slice(0, 10) : ""}
                          </span>
                          <StatusBadge status={soOverall} />
                          <StatusBadge status={soBillDisplay} />
                          <StatusBadge status={soPayDisplay} />
                        </div>

                        {/* SO detail */}
                        {isSoOpen && (
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 0, background: "#fff" }}>

                            {/* Sales lines */}
                            <div style={{ padding: "8px 12px", borderRight: "0.5px solid #e8e7e0" }}>
                              <div style={{ fontSize: 10, fontWeight: 500, color: "#888780", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 6 }}>
                                Sales (SO lines)
                              </div>
                              {so.lines.map((r, i) => (
                                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, padding: "5px 0", borderBottom: "0.5px solid #f0f0ee", fontSize: 12 }}>
                                  <span style={{ color: "#333", flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={r.description}>
                                    {r.description || r.item_code || "—"}
                                  </span>
                                  <span style={{ fontWeight: 500, color: "#0C9B6E", fontFamily: "monospace", flexShrink: 0 }}>{fmtMYR(r.so_amount)}</span>
                                </div>
                              ))}
                            </div>

                            {/* PO groups — grouped by PO number, number shown as a header */}
                            <div style={{ padding: "8px 12px" }}>
                              <div style={{ fontSize: 10, fontWeight: 500, color: "#888780", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 6 }}>
                                Purchases (PO)
                              </div>
                              {poGroups.length === 0 && (
                                <div style={{ fontSize: 12, color: "#888780", fontStyle: "italic" }}>No linked PO</div>
                              )}
                              {poGroups.map(g => <PoGroup key={g.po_no} po={g} />)}
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
                      {unlinkedPoKeys.map(k => <PoGroup key={k} po={proj.unlinkedPoMap[k]} />)}
                    </div>
                  )}

                  {/* Project footer */}
                  <div style={{ display: "flex", justifyContent: "flex-end", gap: 20, padding: "8px 0", borderTop: "0.5px solid #e8e7e0", fontSize: 11 }}>
                    <span>Total SO {basisLabel}: <strong style={{ color: "#0C9B6E", fontFamily: "monospace" }}>{fmtMYR(projSOAmt)}</strong></span>
                    <span>Total PO {basisLabel}: <strong style={{ color: "#E24B4A", fontFamily: "monospace" }}>{fmtMYR(projPOAmt)}</strong></span>
                    <span>Gross Margin: <strong style={{ fontFamily: "monospace" }}>{fmtMYR(projGM)}</strong> <GmBadge pct={projGMPct} /></span>
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
