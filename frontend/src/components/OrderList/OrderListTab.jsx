import React, { useState, useEffect, useMemo } from "react";
import { getOrderList } from "../../services/api";
import { fmtMYR } from "../../utils/fmt";
import { showToast } from "../../utils/toast";

const fmtDate = (s) => {
  if (!s) return "—";
  const d = new Date(s.slice(0, 10));
  return d.toLocaleDateString("en-MY", { day: "2-digit", month: "short", year: "numeric" });
};

export default function OrderListTab({ entity = "QM", setEntity, entities = [] }) {
  const [rows, setRows]         = useState([]);
  const [loading, setLoading]   = useState(false);
  const [search, setSearch]     = useState("");
  const [expanded, setExpanded] = useState({});

  useEffect(() => {
    setLoading(true);
    setExpanded({});
    getOrderList(entity)
      .then(r => setRows(r.data || []))
      .catch(e => showToast("⚠ " + e.message))
      .finally(() => setLoading(false));
  }, [entity]);

  const projects = useMemo(() => {
    const map = {};
    rows.forEach(r => {
      if (!map[r.proj_no]) map[r.proj_no] = { sales: [], purchases: [] };
      if (r.journal_type === "SALES")    map[r.proj_no].sales.push(r);
      if (r.journal_type === "PURCHASE") map[r.proj_no].purchases.push(r);
    });
    return map;
  }, [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return Object.keys(projects)
      .filter(p => !q || p.toLowerCase().includes(q))
      .sort();
  }, [projects, search]);

  const toggle = proj => setExpanded(prev => ({ ...prev, [proj]: !prev[proj] }));

  const summary = proj => {
    const { sales, purchases } = projects[proj];
    const ts = sales.reduce((a, r) => a + (Number(r.amount) || 0), 0);
    const tp = purchases.reduce((a, r) => a + (Number(r.amount) || 0), 0);
    const gm = ts - tp;
    const pct = ts > 0 ? (gm / ts) * 100 : 0;
    return { ts, tp, gm, pct };
  };

  const allSales     = rows.filter(r => r.journal_type === "SALES");
  const allPurchases = rows.filter(r => r.journal_type === "PURCHASE");
  const totSales     = allSales.reduce((a, r) => a + (Number(r.amount) || 0), 0);
  const totPurch     = allPurchases.reduce((a, r) => a + (Number(r.amount) || 0), 0);
  const totMargin    = totSales - totPurch;
  const totPct       = totSales > 0 ? (totMargin / totSales) * 100 : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden", minHeight: 0 }}>

      <div className="pg-hdr">
        <div className="pg-title">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#185FA5" strokeWidth="1.5">
            <rect x="1" y="3" width="14" height="10" rx="1.5"/>
            <path d="M1 6h14M5 6v7M11 6v7"/>
          </svg>
          Order List <span className="pg-badge">{entity}</span>
        </div>
      </div>

      <div className="filter">
        <span className="f-lbl">Entity</span>
        <select className="f-sel" value={entity} onChange={e => setEntity(e.target.value)}>
          {entities.map(e => (
            <option key={e.entity_code} value={e.entity_code}>{e.entity_code}</option>
          ))}
        </select>
        <div className="f-div"/>
        <span className="f-lbl">Project</span>
        <input
          className="search"
          style={{ width: 220, fontSize: 12 }}
          placeholder="Search project code…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <span className="f-lbl" style={{ marginLeft: 8 }}>
          {loading ? "Loading…" : `${filtered.length} project${filtered.length !== 1 ? "s" : ""}`}
        </span>
      </div>

      <div style={{ padding: "14px 18px", flexShrink: 0, background: "#fff", borderBottom: "1px solid #e8e7e0" }}>
        <div className="kpi-row" style={{ marginBottom: 0 }}>
          <div className="kpi">
            <div className="kpi-lbl">Total Sales</div>
            <div className="kpi-val b">{fmtMYR(totSales)}</div>
            <div className="kpi-sub">{allSales.length} lines · {Object.keys(projects).length} projects</div>
          </div>
          <div className="kpi">
            <div className="kpi-lbl">Total Purchases</div>
            <div className="kpi-val a">{fmtMYR(totPurch)}</div>
            <div className="kpi-sub">{allPurchases.length} lines</div>
          </div>
          <div className="kpi">
            <div className="kpi-lbl">Gross Margin</div>
            <div className="kpi-val" style={{ color: totMargin >= 0 ? "#0C9B6E" : "#E24B4A" }}>
              {fmtMYR(totMargin)}
            </div>
            <div className="kpi-sub">{totPct.toFixed(1)}% of sales</div>
          </div>
          <div className="kpi">
            <div className="kpi-lbl">Margin %</div>
            <div className="kpi-val" style={{ color: totMargin >= 0 ? "#0C9B6E" : "#E24B4A" }}>
              {totPct.toFixed(1)}%
            </div>
            <div className="kpi-sub">{entity} · all projects</div>
          </div>
        </div>
      </div>

      <div className="content">
        {loading && (
          <div style={{ padding: "2rem", textAlign: "center", color: "#888780", fontSize: 13 }}>
            Loading…
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div className="card">
            <div style={{ padding: "2rem", textAlign: "center", color: "#888780", fontSize: 13 }}>
              No projects found.
            </div>
          </div>
        )}

        {!loading && filtered.map(proj => {
          const { ts, tp, gm, pct } = summary(proj);
          const { sales, purchases } = projects[proj];
          const isOpen = !!expanded[proj];

          return (
            <div key={proj} className="card" style={{ marginBottom: 8 }}>
              <div
                className="card-hdr"
                style={{ cursor: "pointer", userSelect: "none" }}
                onClick={() => toggle(proj)}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10, flex: 1, flexWrap: "wrap" }}>
                  <span style={{
                    fontSize: 10, color: "#888780", width: 12, display: "inline-block",
                    transform: isOpen ? "rotate(90deg)" : "rotate(0deg)",
                    transition: "transform 0.15s",
                  }}>▶</span>
                  <span className="card-title" style={{ minWidth: 160, fontSize: 13 }}>
                    {proj}
                  </span>
                  <span className="bdg bdg-ps" style={{ fontSize: 10 }}>
                    {sales.length} sales
                  </span>
                  <span className="bdg bdg-lic" style={{ fontSize: 10 }}>
                    {purchases.length} purchases
                  </span>
                  <div style={{ display: "flex", gap: 24, marginLeft: "auto", flexWrap: "wrap" }}>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 10, color: "#888780" }}>Sales</div>
                      <div style={{ fontSize: 12, fontWeight: 500 }}>{fmtMYR(ts)}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 10, color: "#888780" }}>Purchases</div>
                      <div style={{ fontSize: 12, fontWeight: 500 }}>{fmtMYR(tp)}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 10, color: "#888780" }}>Gross Margin</div>
                      <div style={{ fontSize: 12, fontWeight: 500, color: gm >= 0 ? "#0C9B6E" : "#E24B4A" }}>
                        {fmtMYR(gm)}
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 10, color: "#888780" }}>Margin %</div>
                      <div style={{ fontSize: 12, fontWeight: 500, color: gm >= 0 ? "#0C9B6E" : "#E24B4A" }}>
                        {pct.toFixed(1)}%
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {isOpen && (
                <div style={{ padding: 12 }}>
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(0,1fr) minmax(0,1fr)",
                    gap: 10,
                    alignItems: "stretch",
                  }}>
                    <PaneTable title="Sales"     type="sales"     rows={sales}     />
                    <PaneTable title="Purchases" type="purchases" rows={purchases} />
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

function PaneTable({ title, type, rows }) {
  const isSales = type === "sales";
  const total   = rows.reduce((a, r) => a + (Number(r.amount) || 0), 0);
  const docNos  = new Set(rows.map(r => r.ref_no1)).size;

  return (
    <div style={{
      border: "0.5px solid #e8e7e0",
      borderRadius: 8,
      overflow: "hidden",
      background: "#fff",
      display: "flex",
      flexDirection: "column",
      height: "100%",
    }}>
      {/* Pane header */}
      <div style={{
        padding: "7px 10px",
        borderBottom: "0.5px solid #e8e7e0",
        background: "#fafaf8",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 500 }}>
          <span style={{ color: isSales ? "#0C9B6E" : "#888780" }}>{isSales ? "↑" : "↓"}</span>
          {title}
          <span className={`bdg ${isSales ? "bdg-ps" : "bdg-lic"}`} style={{ fontSize: 9 }}>
            {rows.length} lines
          </span>
        </div>
        <span style={{ fontSize: 10, color: "#888780" }}>
          Total <b style={{ color: "#333" }}>{fmtMYR(total)}</b>
        </span>
      </div>

      {/* Table */}
      {rows.length === 0 ? (
        <div style={{ padding: "32px 20px", textAlign: "center", fontSize: 11, color: "#888780", flex: 1 }}>
          No {title.toLowerCase()} lines
        </div>
      ) : (
        <div style={{ overflowX: "auto", overflowY: "auto", maxHeight: 400, flex: 1 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11, tableLayout: "fixed" }}>
            <colgroup>
              <col style={{ width: 80 }}/>   {/* Date */}
              <col style={{ width: 96 }}/>   {/* Doc no */}
              <col/>                          {/* Account / Desc — takes remaining space */}
              <col style={{ width: 50 }}/>   {/* Cat */}
              <col style={{ width: 96 }}/>   {/* Amount */}
            </colgroup>
            <thead>
              <tr>
                <th style={TH()}>Date</th>
                <th style={TH()}>Doc no</th>
                <th style={TH()}>Account / Description</th>
                <th style={TH()}>Cat</th>
                <th style={{ ...TH(), textAlign: "right" }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="row-hover">
                  <td style={TD()}>
                    <span className="muted" style={{ whiteSpace: "nowrap" }}>{fmtDate(r.trans_date)}</span>
                  </td>
                  <td style={TD()}>
                    <div className="mono" style={{ fontSize: 10, color: "#185FA5", wordBreak: "break-all" }}>
                      {r.ref_no1 || "—"}
                    </div>
                    {r.ref_no2 && (
                      <div className="mono muted" style={{ fontSize: 9 }}>{r.ref_no2}</div>
                    )}
                  </td>
                  <td style={TD()}>
                    <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {r.description || "—"}
                    </div>
                    <div className="muted" style={{ fontSize: 10, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {r.acc_desc}
                    </div>
                  </td>
                  <td style={TD()}>
                    {r.category
                      ? <span className={r.category === "LIC" ? "bdg bdg-lic" : "bdg bdg-ps"} style={{ fontSize: 9 }}>
                          {r.category}
                        </span>
                      : <span className="muted">—</span>
                    }
                    {r.total_days && (
                      <div className="muted" style={{ fontSize: 9, marginTop: 2 }}>{r.total_days}d</div>
                    )}
                  </td>
                  <td style={{ ...TD(), textAlign: "right" }}>
                    <span className="mono">{fmtMYR(Number(r.amount))}</span>
                    {r.start_date && (
                      <div className="muted" style={{ fontSize: 9, marginTop: 2, whiteSpace: "nowrap" }}>
                        {fmtDate(r.start_date)}{r.end_date ? " – " + fmtDate(r.end_date) : ""}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Footer */}
      <div style={{
        padding: "6px 10px",
        borderTop: "0.5px solid #e8e7e0",
        background: "#fafaf8",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexShrink: 0,
      }}>
        <span className="muted" style={{ fontSize: 10 }}>
          {rows.length} lines · {docNos} doc nos
        </span>
        <span style={{ fontSize: 12, fontWeight: 500 }}>{fmtMYR(total)}</span>
      </div>
    </div>
  );
}

const TH = (extra = {}) => ({
  fontSize: 9,
  fontWeight: 700,
  color: "#888780",
  textTransform: "uppercase",
  letterSpacing: ".05em",
  padding: "5px 8px",
  textAlign: "left",
  background: "#fafaf8",
  borderBottom: "0.5px solid #e8e7e0",
  position: "sticky",
  top: 0,
  zIndex: 1,
  ...extra,
});

const TD = () => ({
  padding: "6px 8px",
  borderBottom: "0.5px solid #f0f0ee",
  verticalAlign: "top",
  lineHeight: 1.4,
});
