import React, { useState } from "react";
import { numFmt } from "../../utils/fmt";

// Recursively renders one row + its children (if expanded). Handles
// arbitrary nesting depth: top-level tag rows -> account details,
// group rows (Other Income / Operating Expenses) -> per-tag rows ->
// account details, and MFRS rows -> per-account recognition rows.
function Row({ row, depth, path, open, toggle, cols }) {
  const hasChildren = row.children && row.children.length > 0;
  const isOpen = !!open[path];
  const isSummary = row.row_type === "summary";
  const isMfrs = row.row_type === "mfrs";

  const indent = 10 + depth * 16;

  if (isSummary) {
    const col = row.section === "NET_PROFIT_BEFORE" ? "#7F77DD"
      : row.section === "NET_PROFIT_AFTER" ? "#185FA5" : "#1D9E75";
    return (
      <tr className="sum-row">
        <td style={{ fontWeight: 700, color: col, paddingLeft: indent }}>{row.label}</td>
        {row.months.map((v, j) => (
          <td key={j} style={{ textAlign: "right", fontFamily: "Courier New,monospace", fontSize: 12, fontWeight: 700, color: col }}
            dangerouslySetInnerHTML={{ __html: numFmt(Number(v)) }} />
        ))}
        <td style={{ textAlign: "right", fontFamily: "Courier New,monospace", fontSize: 12, fontWeight: 700, color: col }}
          dangerouslySetInnerHTML={{ __html: numFmt(Number(row.total)) }} />
      </tr>
    );
  }

  return (
    <React.Fragment>
      <tr
        className={hasChildren ? "sec-row" : "det-row"}
        style={{ cursor: hasChildren ? "pointer" : "default", background: isMfrs ? "#fafaf8" : undefined }}
        onClick={() => hasChildren && toggle(path)}
      >
        <td style={{ paddingLeft: indent, fontSize: depth === 0 ? 12 : 11, fontWeight: depth === 0 ? 600 : 400 }}>
          {hasChildren && (
            <span className={"chev" + (isOpen ? " op" : "")}
              style={{ fontSize: 10, color: "#888780", marginRight: 6, display: "inline-block", transition: "transform .15s" }}>
              &#9658;
            </span>
          )}
          {isMfrs && (
            <span style={{ fontSize: 8, padding: "1px 5px", borderRadius: 2, background: "#BA7517", color: "#fff", fontWeight: 700, marginRight: 5 }}>
              MFRS
            </span>
          )}
          {row.label}
        </td>
        {row.months.map((v, j) => (
          <td key={j} style={{ textAlign: "right", fontFamily: "Courier New,monospace", fontSize: depth === 0 ? 12 : 11, fontWeight: depth === 0 ? 600 : 400, color: isMfrs ? "#888780" : "#1a1a18" }}
            dangerouslySetInnerHTML={{ __html: numFmt(Number(v)) }} />
        ))}
        <td style={{ textAlign: "right", fontFamily: "Courier New,monospace", fontSize: depth === 0 ? 12 : 11, fontWeight: depth === 0 ? 600 : 400, color: isMfrs ? "#888780" : "#1a1a18" }}
          dangerouslySetInnerHTML={{ __html: numFmt(Number(row.total)) }} />
      </tr>
      {hasChildren && isOpen && row.children.map((child, i) => (
        <Row key={path + "." + i} row={child} depth={depth + 1} path={path + "." + i}
          open={open} toggle={toggle} cols={cols} />
      ))}
    </React.Fragment>
  );
}

export default function PnLTableV2({ data }) {
  const [open, setOpen] = useState({});
  const cols = data.month_labels;
  const toggle = (path) => setOpen(p => ({ ...p, [path]: !p[path] }));

  const anyOpen = Object.values(open).some(Boolean);
  const expandAll = () => {
    if (anyOpen) { setOpen({}); return; }
    // Expand every node that has children, recursively.
    const next = {};
    const walk = (rows, path) => {
      rows.forEach((r, i) => {
        const p = path + "." + i;
        if (r.children && r.children.length > 0) {
          next[p] = true;
          walk(r.children, p);
        }
      });
    };
    walk(data.rows, "root");
    setOpen(next);
  };

  return (
    <div className="card">
      <div className="card-hdr">
        <div className="card-title">Profit &amp; Loss — Detail (New)</div>
        <div className="card-sub" style={{ marginLeft: "auto" }}>{cols[0]}–{cols[cols.length - 1]} · {cols.length} months</div>
      </div>
      <div className="expand-bar" onClick={expandAll}>
        <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="#185FA5" strokeWidth="1.5"
          style={{ transition: "transform .15s", transform: anyOpen ? "rotate(180deg)" : "none" }}>
          <path d="M2 4l4 4 4-4" />
        </svg>
        <span>{anyOpen ? "Collapse all" : "Expand all"}</span>
      </div>
      <div className="pnl-scroll">
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 300 }}>
          <thead>
            <tr style={{ background: "#fafaf8" }}>
              <th style={{ padding: "7px 10px", fontSize: 10, fontWeight: 700, color: "#888780", letterSpacing: ".05em", textTransform: "uppercase", borderBottom: "1px solid #e8e7e0", textAlign: "left" }}>Description</th>
              {cols.map(c => (
                <th key={c} style={{ padding: "7px 10px", fontSize: 10, fontWeight: 700, color: "#888780", letterSpacing: ".05em", textTransform: "uppercase", borderBottom: "1px solid #e8e7e0", textAlign: "right" }}>{c}</th>
              ))}
              <th style={{ padding: "7px 10px", fontSize: 10, fontWeight: 700, color: "#888780", letterSpacing: ".05em", textTransform: "uppercase", borderBottom: "1px solid #e8e7e0", textAlign: "right" }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row, i) => (
              <Row key={"root." + i} row={row} depth={0} path={"root." + i} open={open} toggle={toggle} cols={cols} />
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ padding: "6px 13px", background: "#fafaf8", borderTop: "1px solid #e8e7e0", fontSize: 9, color: "#888780" }}>
        MYR · MFRS 15 basis · {cols.length} month columns · New category structure (Beta)
      </div>
    </div>
  );
}
