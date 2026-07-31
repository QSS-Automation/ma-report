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

// ── Build project tree from flat SO/PO lists ───────────────────────────────
function buildTree(soLines, poLines) {
  const projMap = {};

  soLines.forEach(r => {
    if (!projMap[r.proj_no]) projMap[r.proj_no] = { soMap: {}, unlinked_po: [] };
    if (!projMap[r.proj_no].soMap[r.so_no])
      projMap[r.proj_no].soMap[r.so_no] = { so_no: r.so_no, so_date: r.so_date, lines: [], po: [] };
    projMap[r.proj_no].soMap[r.so_no].lines.push(r);
  });

  poLines.forEach(r => {
    const proj = projMap[r.proj_no];
    if (!proj) {
      if (!projMap[r.proj_no]) projMap[r.proj_no] = { soMap: {}, unlinked_po: [] };
      projMap[r.proj_no].unlinked_po.push(r);
      return;
    }
    if (r.linked_so_no && proj.soMap[r.linked_so_no]) {
      proj.soMap[r.linked_so_no].po.push(r);
    } else {
      proj.unlinked_po.push(r);
    }
  });

  return projMap;
}

// ── Calculate GM ───────────────────────────────────────────────────────────
function calcGM(soAmt, poAmt) {
  const gm    = soAmt - poAmt;
  const gmPct = soAmt > 0 ? (gm / soAmt) * 100 : null;
  return { gm, gmPct };
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
          const isOpen  = expanded[projNo];

          // Project totals
          const projSOAmt = soKeys.reduce((s, k) =>
            s + proj.soMap[k].lines.reduce((ss, r) => ss + Number(r.so_amount || 0), 0), 0);
          const projPOAmt = soKeys.reduce((s, k) =>
            s + proj.soMap[k].po.reduce((ss, r) => ss + Number(r.po_amount || 0), 0), 0)
            + proj.unlinked_po.reduce((s, r) => s + Number(r.po_amount || 0), 0);
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
                {proj.unlinked_po.length > 0 && (
                  <span className="bdg bdg-lic" style={{ fontSize: 10 }}>+{proj.unlinked_po.length} unlinked PO</span>
                )}
                <div style={{ display: "flex", gap: 24, marginLeft: "auto", flexWrap: "wrap" }}>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 10, color: "#888780" }}>Sales</div>
                    <div style={{ fontSize: 12, fontWeight: 500 }}>{fmtMYR(projSOAmt)}</div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 10, color: "#888780" }}>Purchases</div>
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
                    const soAmt  = so.lines.reduce((s, r) => s + Number(r.so_amount || 0), 0);
                    const poAmt  = so.po.reduce((s, r) => s + Number(r.po_amount || 0), 0);
                    const { gm, gmPct } = calcGM(soAmt, poAmt);

                    // Derive SO billing/payment status from lines
                    const soBilling = so.lines[0]?.billing_status || "—";
                    const soPayment = so.lines[0]?.payment_status || "—";

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
                          <StatusBadge status={soBilling} />
                          <StatusBadge status={soPayment} />
                          <div style={{ display: "flex", gap: 14, marginLeft: "auto", fontSize: 11 }}>
                            <span>Sales: <strong style={{ color: "#0C9B6E", fontFamily: "monospace" }}>{fmtMYR(soAmt)}</strong></span>
                            <span>Cost: <strong style={{ color: "#E24B4A", fontFamily: "monospace" }}>{fmtMYR(poAmt)}</strong></span>
                            <span>GM: <GmBadge pct={gmPct} /></span>
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
                              {so.lines.map((r, i) => (
                                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "3px 0", borderBottom: "0.5px solid #f0f0ee", fontSize: 11 }}>
                                  <span style={{ color: "#333", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 180 }} title={r.description}>
                                    {r.description || r.item_code || "—"}
                                  </span>
                                  <StatusBadge status={r.payment_status} />
                                  <span style={{ fontWeight: 500, color: "#0C9B6E", fontFamily: "monospace", marginLeft: 8 }}>{fmtMYR(r.so_amount)}</span>
                                </div>
                              ))}
                            </div>

                            {/* PO lines */}
                            <div style={{ padding: "8px 12px" }}>
                              <div style={{ fontSize: 10, fontWeight: 500, color: "#888780", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 6 }}>
                                Purchases (PO lines)
                              </div>
                              {so.po.length === 0 && (
                                <div style={{ fontSize: 11, color: "#888780", fontStyle: "italic" }}>No linked PO</div>
                              )}
                              {so.po.map((r, i) => (
                                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "3px 0", borderBottom: "0.5px solid #f0f0ee", fontSize: 11 }}>
                                  <span style={{ color: "#333", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 180 }} title={r.description}>
                                    {r.description || r.item_code || "—"}
                                  </span>
                                  <StatusBadge status={r.payment_status} />
                                  <span style={{ fontWeight: 500, color: "#E24B4A", fontFamily: "monospace", marginLeft: 8 }}>{fmtMYR(r.po_amount)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Unlinked PO section */}
                  {proj.unlinked_po.length > 0 && (
                    <div style={{ borderTop: "0.5px dashed #e8e7e0", paddingTop: 8 }}>
                      <div style={{ fontSize: 10, fontWeight: 500, color: "#888780", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 6 }}>
                        Purchases not linked to any SO
                      </div>
                      {proj.unlinked_po.map((r, i) => (
                        <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "3px 8px", fontSize: 11 }}>
                          <span style={{ color: "#333", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 300 }} title={r.description}>
                            {r.po_no} — {r.description || r.item_code || "—"}
                          </span>
                          <StatusBadge status={r.payment_status} />
                          <span style={{ fontWeight: 500, color: "#E24B4A", fontFamily: "monospace", marginLeft: 8 }}>{fmtMYR(r.po_amount)}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Project footer */}
                  <div style={{ display: "flex", justifyContent: "flex-end", gap: 20, padding: "8px 0", borderTop: "0.5px solid #e8e7e0", fontSize: 11 }}>
                    <span>Total Sales: <strong style={{ color: "#0C9B6E", fontFamily: "monospace" }}>{fmtMYR(projSOAmt)}</strong></span>
                    <span>Total Cost: <strong style={{ color: "#E24B4A", fontFamily: "monospace" }}>{fmtMYR(projPOAmt)}</strong></span>
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
