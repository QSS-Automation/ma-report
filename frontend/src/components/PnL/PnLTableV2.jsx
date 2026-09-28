import React, { useState } from "react";
import { ChevronRight } from "lucide-react";
import { numFmt } from "../../utils/fmt";
import { Card } from "../ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../ui/table";
import { cn } from "../../lib/utils";

// Sticky first column keeps the description visible while month columns
// scroll horizontally — each row style below needs its own *opaque*
// background repeated on the sticky cell (a semi-transparent bg would let
// the scrolling columns show through underneath it).
const STICKY = "sticky left-0 z-10 w-[260px] min-w-[260px] max-w-[260px]";
// Total sits right after Description and is frozen with it (offset = the
// Description column's fixed 260px width); the right edge shadow marks where
// the scrolling month columns start.
const TOTAL = "sticky left-[260px] z-10 min-w-[130px] border-r-2 border-border shadow-[6px_0_8px_-6px_rgba(0,0,0,0.15)]";

// Recursively renders one row + its children (if expanded). Handles
// arbitrary nesting depth: top-level tag rows -> account details,
// group rows (Other Income / Operating Expenses) -> per-tag rows ->
// account details, and MFRS rows -> per-account recognition rows.
function Row({ row, depth, path, open, toggle, cols }) {
  const hasChildren = row.children && row.children.length > 0;
  const isOpen = !!open[path];
  const isSummary = row.row_type === "summary";
  const isMfrs = row.row_type === "mfrs";

  const indentClass = depth === 0 ? "pl-2.5" : depth === 1 ? "pl-[26px]" : depth === 2 ? "pl-[42px]" : "pl-[58px]";

  if (isSummary) {
    const tone = row.section === "NET_PROFIT_BEFORE" ? "text-[#7F77DD]"
      : row.section === "NET_PROFIT_AFTER" ? "text-primary" : "text-success";
    return (
      <TableRow className="border-y-2 border-primary/20 bg-accent">
        <TableCell className={cn(STICKY, "bg-[hsl(var(--accent))] font-bold", indentClass, tone)}>{row.label}</TableCell>
        <TableCell className={cn(TOTAL, "bg-[hsl(var(--accent))]", "text-right font-mono text-xs font-bold", tone)}
          dangerouslySetInnerHTML={{ __html: numFmt(Number(row.total)) }} />
        {row.months.map((v, j) => (
          <TableCell key={j} className={cn("text-right font-mono text-xs font-bold", tone)}
            dangerouslySetInnerHTML={{ __html: numFmt(Number(v)) }} />
        ))}
      </TableRow>
    );
  }

  return (
    <React.Fragment>
      <TableRow
        className={cn(hasChildren ? "cursor-pointer bg-muted/60 hover:bg-muted" : undefined, isMfrs && "bg-muted/40")}
        onClick={() => hasChildren && toggle(path)}
      >
        <TableCell className={cn(STICKY, (isMfrs || hasChildren) ? "bg-[hsl(var(--muted))]" : "bg-card", indentClass, depth === 0 ? "text-xs font-semibold" : "text-[12px] font-normal")}>
          {hasChildren && (
            <ChevronRight className={cn("mr-1.5 inline-block h-2.5 w-2.5 text-muted-foreground transition-transform", isOpen && "rotate-90")} />
          )}
          {isMfrs && (
            <span className="mr-1.5 rounded-[2px] bg-warning px-1.5 py-px text-[10px] font-bold text-white">MFRS</span>
          )}
          {row.label}
        </TableCell>
        <TableCell className={cn(TOTAL, (isMfrs || hasChildren) ? "bg-[hsl(var(--muted))]" : "bg-card", "text-right font-mono", depth === 0 ? "text-xs font-semibold" : "text-[12px] font-normal", isMfrs ? "text-muted-foreground" : "text-foreground")}
          dangerouslySetInnerHTML={{ __html: numFmt(Number(row.total)) }} />
        {row.months.map((v, j) => (
          <TableCell key={j} className={cn("text-right font-mono", depth === 0 ? "text-xs font-semibold" : "text-[12px] font-normal", isMfrs ? "text-muted-foreground" : "text-foreground")}
            dangerouslySetInnerHTML={{ __html: numFmt(Number(v)) }} />
        ))}
      </TableRow>
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
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-[18px] pb-2.5 pt-3.5">
        <h3 className="text-base font-semibold">Profit &amp; Loss — Detail (New)</h3>
        <p className="whitespace-nowrap text-xs text-muted-foreground">{cols[0]}–{cols[cols.length - 1]} · {cols.length} months</p>
      </div>
      <div
        className="flex cursor-pointer select-none items-center gap-1.5 px-4 pb-2 text-[12px] font-medium text-primary"
        onClick={expandAll}
      >
        <ChevronRight className={cn("h-3 w-3 transition-transform", anyOpen && "rotate-90")} />
        <span>{anyOpen ? "Collapse all" : "Expand all"}</span>
      </div>
      <div className="overflow-x-auto">
        <Table className="min-w-[300px]">
          <TableHeader>
            <TableRow>
              <TableHead className={cn(STICKY, "z-20 bg-card text-left")}>Description</TableHead>
              <TableHead className={cn(TOTAL, "z-20 bg-card text-right")}>Total</TableHead>
              {cols.map(c => (
                <TableHead key={c} className="text-right">{c}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.rows.map((row, i) => (
              <Row key={"root." + i} row={row} depth={0} path={"root." + i} open={open} toggle={toggle} cols={cols} />
            ))}
          </TableBody>
        </Table>
      </div>
      <div className="px-4 py-2.5 text-[11px] text-muted-foreground">
        MYR · MFRS 15 basis · {cols.length} month columns · New category structure (Beta)
      </div>
    </Card>
  );
}
