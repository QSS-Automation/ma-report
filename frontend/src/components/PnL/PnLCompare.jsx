import React, { useState } from "react";
import { ChevronRight } from "lucide-react";
import { MN } from "../../utils/fmt";
import { Card } from "../ui/card";
import { cn } from "../../lib/utils";

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
    return { pct, pos: pct >= 0, label: (pct >= 0 ? "+" : "") + pct.toFixed(1) + "%" };
  };

  const aLabel  = `${MN[mp.s.fromMonth]} ${MN[mp.s.toMonth]} ${mp.s.fromYear}`;
  const pyLabel = `${MN[mp.s.fromMonth]} ${MN[mp.s.toMonth]} ${mp.s.fromYear - 1}`;
  const fyLabel = `Full Year ${mp.s.fromYear - 1}`;

  const ROWS = [
    { key: "rev",  label: "Total Revenue",         section: "SALES",              rt: "subtotal", isSum: false },
    { key: "cogs", label: "Cost of Sales",          section: "COST OF GOODS SOLD", rt: "subtotal", isSum: false },
    { key: "gp",   label: "Gross Profit",           section: "GROSS_PROFIT",       rt: "summary",  isSum: true  },
    { key: "opex", label: "Operating Expenses",     section: "OPERATING EXPENSES", rt: "subtotal", isSum: false },
    { key: "pbt",  label: "Net Profit Before Tax",  section: "NET_PROFIT_BEFORE",  rt: "summary",  isSum: true  },
    { key: "tax",  label: "Taxation",               section: "TAXATION",           rt: "subtotal", isSum: false },
    { key: "pat",  label: "Net Profit After Tax",   section: "NET_PROFIT_AFTER",   rt: "summary",  isSum: true  },
  ];

  const histTh = "min-w-[96px] border-b border-l border-border bg-card px-3.5 py-2.5 text-right text-[12.5px] font-bold text-muted-foreground";
  const histTd = "border-b border-l border-border/70 bg-muted/30 px-3.5 py-1.5 text-right font-mono text-xs text-muted-foreground";

  return (
    <Card className="mb-0 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse whitespace-nowrap text-xs">
          <thead>
            <tr>
              <th className="sticky left-0 z-[4] min-w-[180px] border-b border-r border-border bg-card px-4 py-2.5 text-left text-[12.5px] font-bold text-muted-foreground">Description</th>
              <th className="cursor-pointer border-b border-l border-border bg-card px-2 py-1 text-center"
                onClick={() => setHistOpen(!histOpen)}>
                <span className="text-[11px] font-bold text-primary">{histOpen ? "◀" : "▶"}</span>
              </th>
              <th className={cn(histTh, !histOpen && "hidden")}>{fyLabel}</th>
              <th className={cn(histTh, !histOpen && "hidden")}>{pyLabel}</th>
              <th className="min-w-[96px] border-b border-l-2 border-primary bg-primary px-3.5 py-2.5 text-right text-[12.5px] font-bold text-primary-foreground">{aLabel}</th>
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
                  <tr className={cn("cursor-pointer bg-muted/60 hover:bg-muted/80", r.isSum && "cursor-default bg-accent hover:bg-accent")}
                    onClick={() => !r.isSum && setExpandState(p => ({ ...p, [r.key]: !p[r.key] }))}>
                    {r.isSum ? (
                      <td className="sticky left-0 z-[2] border-b border-t-2 border-r border-primary/20 bg-accent px-3.5 pb-1 pt-2.5 text-xs font-bold text-primary">
                        {r.label}
                        {yoyPy && <><br /><span className={cn("text-[11px] font-semibold", yoyPy.pos ? "text-success" : "text-destructive")}>YoY {yoyPy.label}</span></>}
                      </td>
                    ) : (
                      <td className="sticky left-0 z-[2] border-b border-r border-border bg-card px-3.5 pb-1 pt-2.5 text-xs font-semibold">
                        <ChevronRight className={cn("mr-1.5 inline-block h-2.5 w-2.5 text-muted-foreground transition-transform", isEx && "rotate-90")} />
                        {r.label}
                      </td>
                    )}
                    <td className="border-b border-l border-border bg-muted/40" />
                    <td className={cn(histTd, r.isSum && "border-t-2 border-primary/20 bg-accent font-bold", !histOpen && "hidden")}>{fmt(aFy)}</td>
                    <td className={cn(histTd, r.isSum && "border-t-2 border-primary/20 bg-accent font-bold", !histOpen && "hidden")}>{fmt(aPy)}</td>
                    <td className={cn("border-b border-l-2 border-primary bg-accent px-3.5 py-1.5 text-right font-mono text-xs font-semibold text-primary", r.isSum && "border-t-2 font-bold")}>{fmt(aCur)}</td>
                  </tr>
                  {allLabels.map((lbl, i) => {
                    const da = detsActive.find(d => d.label === lbl);
                    const dp = detsPy.find(d => d.label === lbl);
                    const df = detsFy.find(d => d.label === lbl);
                    const va = da ? da.months.reduce((a, b) => a + (Number(b) || 0), 0) : 0;
                    const vp = dp ? dp.months.reduce((a, b) => a + (Number(b) || 0), 0) : 0;
                    const vf = df ? df.months.reduce((a, b) => a + (Number(b) || 0), 0) : 0;
                    return (
                      <tr key={i} className={cn(!isEx && "hidden")}>
                        <td className="sticky left-0 z-[2] border-b border-r border-border bg-[hsl(var(--muted))] py-1.5 pl-7 pr-3 text-[12px] text-muted-foreground">{lbl}</td>
                        <td className="border-b border-l border-border bg-muted/40" />
                        <td className={cn(histTd, "text-muted-foreground/50", !histOpen && "hidden")}>{vf !== 0 ? fmt(vf) : "—"}</td>
                        <td className={cn(histTd, "text-muted-foreground/50", !histOpen && "hidden")}>{vp !== 0 ? fmt(vp) : "—"}</td>
                        <td className="border-b border-l-2 border-primary bg-accent px-3.5 py-1.5 text-right font-mono text-xs text-primary">{va !== 0 ? fmt(va) : "—"}</td>
                      </tr>
                    );
                  })}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex flex-col gap-1 px-4 py-2.5 text-[11px] text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:gap-2">
        <span>QM · MYR · Active: {aLabel} vs {pyLabel} (prior year)</span>
        <span>▶ click row to expand details · ◀/▶ to show/hide prior columns</span>
      </div>
    </Card>
  );
}
