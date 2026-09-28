import React, { useState, useEffect, useMemo } from "react";
import { ChevronRight, ArrowUp, ArrowDown } from "lucide-react";
import { getOrderList } from "../../services/api";
import { fmtMYR } from "../../utils/fmt";
import { showToast } from "../../utils/toast";
import OrderListEnhanced from "./OrderListEnhanced";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { PageHeader } from "../ui/page-header";
import { Badge } from "../ui/badge";
import { Input } from "../ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "../ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../ui/table";
import { cn } from "../../lib/utils";
import { FilterBar, FilterLabel } from "../ui/page-shell";
import { Segmented } from "../ui/segmented";
import { TableSkeleton, KpiSkeleton } from "../ui/skeleton";
import { EmptyState } from "../ui/empty-state";

const fmtDate = (s) => {
  if (!s) return "—";
  const d = new Date(s.slice(0, 10));
  return d.toLocaleDateString("en-MY", { day: "2-digit", month: "short", year: "numeric" });
};

// Sticky first column keeps the date visible while the rest of the mini
// sales/purchases table scrolls horizontally on narrow screens — each row
// style needs its own *opaque* background repeated on the sticky cell (a
// semi-transparent bg would let the scrolling columns show through underneath).
const STICKY = "sticky left-0 z-10";

export default function OrderListTab({ entity = "QM", user }) {
  const [tab,       setTab]       = useState("classic"); // "classic" | "enhanced"
  const [rows,      setRows]      = useState([]);
  const [loading,   setLoading]   = useState(false);
  const [search,    setSearch]    = useState("");
  const [expanded,  setExpanded]  = useState({});

  useEffect(() => {
    if (tab !== "classic") return;
    setLoading(true);
    setExpanded({});
    getOrderList(entity)
      .then(r => setRows(r.data || []))
      .catch(e => showToast("⚠ " + e.message))
      .finally(() => setLoading(false));
  }, [entity, tab]);

  const projects = useMemo(() => {
    const map = {};
    rows.forEach(r => {
      if (!map[r.proj_no]) map[r.proj_no] = { sales: [], purchases: [] };
      if (r.journal_type === "SALES")    map[r.proj_no].sales.push(r);
      if (r.journal_type === "PURCHASE" || r.journal_type === "BANK") map[r.proj_no].purchases.push(r);
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
    const ts  = sales.reduce((a, r) => a + (Number(r.amount) || 0), 0);
    const tp  = purchases.reduce((a, r) => a + (Number(r.amount) || 0), 0);
    const gm  = ts - tp;
    const pct = ts > 0 ? (gm / ts) * 100 : 0;
    return { ts, tp, gm, pct };
  };

  const allSales     = Object.values(projects).flatMap(p => p.sales);
  const allPurchases = Object.values(projects).flatMap(p => p.purchases);
  const totSales     = allSales.reduce((a, r) => a + (Number(r.amount) || 0), 0);
  const totPurch     = allPurchases.reduce((a, r) => a + (Number(r.amount) || 0), 0);
  const totMargin    = totSales - totPurch;
  const totPct       = totSales > 0 ? (totMargin / totSales) * 100 : 0;

  const kpis = [
    { label: "Total Sales", val: totSales, tone: "text-primary", sub: `${allSales.length} lines · ${Object.keys(projects).length} projects` },
    { label: "Total Purchases", val: totPurch, tone: "text-warning", sub: `${allPurchases.length} lines` },
    { label: "Gross Margin", val: totMargin, tone: totMargin >= 0 ? "text-success" : "text-destructive", sub: `${totPct.toFixed(1)}% of sales` },
    { label: "Margin %", val: null, display: `${totPct.toFixed(1)}%`, tone: totMargin >= 0 ? "text-success" : "text-destructive", sub: `${entity} · all projects` },
  ];

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Page-level scroll (header + filters + KPIs + table all scroll
          together), matching the PnL/MFRS reference pattern — replaces the
          old fixed-toolbar-with-independent-scroll layout. */}
      <div className="flex-1 overflow-y-auto">
        <div className="space-y-5 p-4 sm:p-6">
          <PageHeader
            eyebrow="Order List"
            title="Order List"
            subtitle={`${entity} · ${tab === "classic" ? "project sales & purchases" : "SO/PO drilldown"}`}
            actions={
              <Segmented
                value={tab}
                onChange={setTab}
                options={[{ value: "classic", label: "Classic" }, { value: "enhanced", label: "Enhanced ✦" }]}
              />
            }
          />

          {/* Filters — plain inline row (no colored toolbar band). */}
          <FilterBar>
            <FilterLabel>Project</FilterLabel>
            <Input
              className="h-8 w-full sm:w-56"
              placeholder="Search project code…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {tab === "classic" && (
              <span className="text-xs text-muted-foreground">
                {loading ? "Loading…" : `${filtered.length} project${filtered.length !== 1 ? "s" : ""}`}
              </span>
            )}
          </FilterBar>

          {/* ── Classic tab ──────────────────────────────────────── */}
          {tab === "classic" && <>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-3">
              {loading && !rows.length ? <KpiSkeleton /> : kpis.map(k => (
                <Card key={k.label} className="min-w-0 px-3.5 py-2.5">
                  <div className="truncate text-xs text-muted-foreground">{k.label}</div>
                  <div className={cn("mt-0.5 truncate text-lg font-semibold leading-tight tracking-tight tabular-nums", k.tone)}>{k.display ?? fmtMYR(k.val)}</div>
                  <div className="mt-0.5 truncate text-xs text-muted-foreground">{k.sub}</div>
                </Card>
              ))}
            </div>

            <div>
              {loading && <Card><TableSkeleton rows={5} cols={5} /></Card>}

              {!loading && filtered.length === 0 && (
                <Card>
                  <EmptyState
                    title={rows.length ? "No projects match your search" : "No projects for this entity"}
                    hint={rows.length ? "Try a different project code." : "Switch entity to see other projects."}
                  />
                </Card>
              )}

              {!loading && filtered.map(proj => {
                const { ts, tp, gm, pct } = summary(proj);
                const { sales, purchases } = projects[proj];
                const isOpen = !!expanded[proj];

                return (
                  <Card key={proj} className="mb-2 overflow-hidden">
                    <div
                      className="flex cursor-pointer select-none items-center justify-between gap-3 px-[18px] pb-2.5 pt-3.5"
                      onClick={() => toggle(proj)}
                    >
                      <div className="flex flex-1 flex-wrap items-center gap-2.5">
                        <ChevronRight className={cn("h-3 w-3 shrink-0 text-muted-foreground transition-transform", isOpen && "rotate-90")} />
                        <span className="min-w-[160px] text-[14px] font-semibold">{proj}</span>
                        <Badge>{sales.length} sales</Badge>
                        <Badge variant="secondary">{purchases.length} purchases</Badge>
                        <div className="ml-auto flex flex-wrap gap-6">
                          <div className="text-right">
                            <div className="text-[11px] text-muted-foreground">Sales</div>
                            <div className="text-[13px] font-medium">{fmtMYR(ts)}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-[11px] text-muted-foreground">Purchases</div>
                            <div className="text-[13px] font-medium">{fmtMYR(tp)}</div>
                          </div>
                          <div className="text-right">
                            <div className="text-[11px] text-muted-foreground">Gross Margin</div>
                            <div className={cn("text-[13px] font-medium", gm >= 0 ? "text-success" : "text-destructive")}>
                              {fmtMYR(gm)}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-[11px] text-muted-foreground">Margin %</div>
                            <div className={cn("text-[13px] font-medium", gm >= 0 ? "text-success" : "text-destructive")}>
                              {pct.toFixed(1)}%
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {isOpen && (
                      <div className="p-3 pt-0">
                        <div className="grid grid-cols-1 items-stretch gap-2.5 lg:grid-cols-2">
                          <PaneTable title="Sales"     type="sales"     rows={sales}     />
                          <PaneTable title="Purchases" type="purchases" rows={purchases} />
                        </div>
                      </div>
                    )}
                  </Card>
                );
              })}
            </div>
          </>}

          {/* ── Enhanced tab ─────────────────────────────────────── */}
          {tab === "enhanced" && (
            <OrderListEnhanced entity={entity} search={search} user={user} />
          )}
        </div>
      </div>
    </div>
  );
}

function PaneTable({ title, type, rows }) {
  const isSales = type === "sales";
  const total   = rows.reduce((a, r) => a + (Number(r.amount) || 0), 0);
  const docNos  = new Set(rows.map(r => r.ref_no1).filter(Boolean)).size;

  return (
    <Card className="flex h-full flex-col overflow-hidden">
      {/* Pane header — plain title block, no colored band */}
      <div className="flex items-center justify-between gap-3 px-[18px] pb-2.5 pt-3.5">
        <div className="flex items-center gap-1.5 text-xs font-semibold">
          {isSales
            ? <ArrowUp className="h-3 w-3 text-success" />
            : <ArrowDown className="h-3 w-3 text-muted-foreground" />}
          {title}
          <Badge variant={isSales ? "default" : "secondary"} className="text-[10px]">
            {rows.length} lines
          </Badge>
        </div>
        <span className="text-xs text-muted-foreground">
          Total <b className="text-foreground">{fmtMYR(total)}</b>
        </span>
      </div>

      {/* Table */}
      {rows.length === 0 ? (
        <div className="flex-1 px-4 pb-4 text-center text-xs text-muted-foreground">
          No {title.toLowerCase()} lines
        </div>
      ) : (
        <div className="max-h-[400px] flex-1 overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 z-10">
              <TableRow>
                <TableHead className={cn(STICKY, "w-20 bg-card")}>Date</TableHead>
                <TableHead className="w-24">Doc no</TableHead>
                <TableHead>Account / Description</TableHead>
                <TableHead className="w-12">Cat</TableHead>
                <TableHead className="w-24 text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r, i) => (
                <TableRow key={i}>
                  <TableCell className={cn(STICKY, "bg-card align-top")}>
                    <span className="whitespace-nowrap text-muted-foreground">{fmtDate(r.trans_date)}</span>
                  </TableCell>
                  <TableCell className="align-top">
                    <div className="break-all font-mono text-[11px] text-primary">
                      {r.ref_no1 || "—"}
                    </div>
                    {r.ref_no2 && (
                      <div className="font-mono text-[10px] text-muted-foreground">{r.ref_no2}</div>
                    )}
                  </TableCell>
                  <TableCell className="align-top">
                    <div className="overflow-hidden text-ellipsis whitespace-nowrap">
                      {r.description || "—"}
                    </div>
                    <div className="overflow-hidden text-ellipsis whitespace-nowrap text-[11px] text-muted-foreground">
                      {r.acc_desc}
                    </div>
                  </TableCell>
                  <TableCell className="align-top">
                    {r.category
                      ? <Badge variant={r.category === "LIC" ? "secondary" : "default"} className="text-[10px]">
                          {r.category}
                        </Badge>
                      : <span className="text-muted-foreground">—</span>
                    }
                    {r.total_days && (
                      <div className="mt-0.5 text-[10px] text-muted-foreground">{r.total_days}d</div>
                    )}
                  </TableCell>
                  <TableCell className="align-top text-right">
                    <span className="font-mono">{fmtMYR(Number(r.amount))}</span>
                    {r.start_date && (
                      <div className="mt-0.5 whitespace-nowrap text-[10px] text-muted-foreground">
                        {fmtDate(r.start_date)}{r.end_date ? " – " + fmtDate(r.end_date) : ""}
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Footer — plain, no colored band */}
      <div className="flex shrink-0 items-center justify-between border-t border-border px-4 py-2.5 text-xs text-muted-foreground">
        <span>
          {rows.length} lines · {docNos} doc nos
        </span>
        <span className="font-medium text-foreground">{fmtMYR(total)}</span>
      </div>
    </Card>
  );
}
