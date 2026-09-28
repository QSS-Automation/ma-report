import React, { useState, useEffect, useCallback, useMemo } from "react";
import { getOrderListEnhanced, linkPoToSo, getPendingLinks } from "../../services/api";
import { fmtMYR } from "../../utils/fmt";
import { showToast } from "../../utils/toast";
import { TableSkeleton } from "../ui/skeleton";
import { EmptyState } from "../ui/empty-state";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Card } from "../ui/card";
import { cn } from "../../lib/utils";

// ── Status badge ───────────────────────────────────────────────────────────
const STATUS_STYLE = {
  "Fully Paid":       "bg-success/15 text-success",
  "Partially Paid":   "bg-warning/15 text-warning",
  "Unpaid":           "bg-destructive/15 text-destructive",
  "Not Billed":       "bg-muted text-muted-foreground",
  "Invoiced":         "bg-accent text-accent-foreground",
  "Open":             "bg-muted text-muted-foreground",
  "Closed":           "bg-success/15 text-success",
  "Cancelled":        "bg-secondary text-secondary-foreground",
  "Credit Noted":     "bg-warning/15 text-warning",
  "Fully Billed":     "bg-success/15 text-success",
  "Partially Billed": "bg-warning/15 text-warning",
  "Pending Sync":     "bg-warning/15 text-warning",
};

function StatusBadge({ status }) {
  return (
    <Badge className={cn("text-[11px]", STATUS_STYLE[status] || "bg-muted text-muted-foreground")}>
      {status || "—"}
    </Badge>
  );
}

// ── GM badge ───────────────────────────────────────────────────────────────
function GmBadge({ pct }) {
  const n = parseFloat(pct);
  const style = n >= 30 ? "bg-success/15 text-success" : n >= 0 ? "bg-warning/15 text-warning" : "bg-destructive/15 text-destructive";
  return (
    <Badge className={cn("font-mono text-[11px]", style)}>
      {isNaN(n) ? "—" : `${n.toFixed(1)}%`}
    </Badge>
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
    <div className="flex gap-1" onClick={e => e.stopPropagation()}>
      {LEVELS.map(l => (
        <Button
          key={l.key}
          variant="outline"
          size="sm"
          className={cn("h-6 px-2 text-[11px]", value === l.key && "border-primary/40 bg-accent text-primary")}
          onClick={() => onChange(l.key)}
        >
          {l.label}
        </Button>
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
// nothing if none of its lines qualify under that view. When `unlinked` is
// true, shows either a "Link to SO" picker (not yet linked) or a
// "Pending Sync" badge (link submitted, waiting for the next curated
// rebuild to actually move it under the SO). ────────────────────────────────
function PoGroup({ po, level, unlinked, soOptions, isPending, onLink, linking }) {
  const filteredLines = po.lines.filter(r => passesPo(r, level));
  if (filteredLines.length === 0) return null;

  const poAmt = sumBy(filteredLines, "po_amount");
  // Status badges always reflect the PO's TRUE overall state (all lines),
  // not just the lines visible under the current view filter.
  const rawBilling = po.lines[0]?.po_billing_status;
  const billingAgg = rawBilling === "Fully Billed" ? "Closed" : "Open";
  const paymentAgg = aggStatus(po.lines, "payment_status", PAYMENT_CLOSED);
  const overall    = combinedStatus(billingAgg, paymentAgg);

  const [selectedSo, setSelectedSo] = useState("");

  return (
    <>
      <div className="flex flex-wrap items-center gap-1.5 border-b border-border/60 py-1.5 text-[13px]">
        <span className="shrink-0 font-mono font-medium text-primary">{po.po_no || "—"}</span>
        <span className="shrink-0 text-[11px] text-muted-foreground">{po.po_date ? po.po_date.slice(0, 10) : ""}</span>
        <StatusBadge status={overall} />

        {unlinked && isPending && <StatusBadge status="Pending Sync" />}

        {unlinked && !isPending && (
          <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
            <select
              value={selectedSo}
              onChange={e => setSelectedSo(e.target.value)}
              className="rounded-md border border-input bg-card px-1 py-0.5 text-[11px]"
            >
              <option value="">Link to SO…</option>
              {soOptions.map(so => <option key={so} value={so}>{so}</option>)}
            </select>
            <Button
              size="sm"
              className="h-6 px-2 text-[11px]"
              disabled={!selectedSo || linking}
              onClick={() => onLink(po.po_no, po.lines[0]?.proj_no, selectedSo)}
            >
              {linking ? "…" : "Link"}
            </Button>
          </div>
        )}

        <span className="ml-auto shrink-0 font-mono font-medium">
          {fmtMYR(poAmt)}
        </span>
      </div>
      {filteredLines.map((r, i) => (
        <div key={i} className="flex items-center justify-between gap-2 border-b border-border/60 py-1.5 pl-3.5 text-[13px]">
          <span className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap" title={r.description}>
            {r.description || r.item_code || "—"}
          </span>
          <StatusBadge status={r.line_status} />
          <StatusBadge status={r.payment_status} />
          <span className="shrink-0 font-mono font-medium text-destructive">{fmtMYR(r.po_amount)}</span>
        </div>
      ))}
    </>
  );
}

// ── Main component ─────────────────────────────────────────────────────────
export default function OrderListEnhanced({ entity = "QM", search = "", user }) {
  const [tree,      setTree]      = useState({});
  const [loading,   setLoading]   = useState(false);
  const [expanded,  setExpanded]  = useState({});   // proj_no → bool
  const [soExp,     setSoExp]     = useState({});   // proj_no+so_no → bool
  const [projLevel, setProjLevel] = useState({});   // proj_no → committed|accrued|realised
  const [pendingLinks, setPendingLinks] = useState([]); // override rows with applied_at IS NULL
  const [linkingPo, setLinkingPo] = useState(null);  // po_no currently being submitted

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

  const loadPendingLinks = useCallback(async () => {
    try {
      const res = await getPendingLinks(entity);
      setPendingLinks(res.data || []);
    } catch (e) {
      // Non-critical — badge just won't show if this fails
      console.error("[OrderList] Failed to load pending links:", e);
    }
  }, [entity]);

  useEffect(() => { run(); }, [run]);
  useEffect(() => { loadPendingLinks(); }, [loadPendingLinks]);

  const pendingPoSet = useMemo(() => new Set(pendingLinks.map(p => p.po_no)), [pendingLinks]);

  const handleLinkPo = async (poNo, projNo, soNo) => {
    if (!soNo) return;
    setLinkingPo(poNo);
    try {
      await linkPoToSo({
        entity, user: user?.user_id,
        po_no: poNo, so_no: soNo, proj_no: projNo,
      });
      showToast(`✓ ${poNo} linked to ${soNo} — will appear under the SO after the next data sync.`);
      await loadPendingLinks();
    } catch (e) {
      showToast("⚠ Failed to save link: " + (e?.response?.data?.detail || e.message));
    } finally {
      setLinkingPo(null);
    }
  };

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
      {/* ── Filter bar — plain inline row (no colored toolbar band) ── */}
      <div className="mb-5 flex flex-wrap items-center gap-2.5 text-xs text-subtle">
        <span className="font-medium">Order List Enhanced</span>
        <span className="text-muted-foreground">View selection is now per-project — set it on each project card below.</span>
        <Button size="sm" className="ml-auto" onClick={run} disabled={loading}>
          {loading ? "Loading…" : "Refresh"}
        </Button>
      </div>

      {/* ── Grand KPI row (aggregated using each project's own selected view) ── */}
      <div className="mb-5 grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-3">
        <Card className="min-w-0 px-3.5 py-2.5">
          <div className="truncate text-xs text-muted-foreground">Total SO Amount</div>
          <div className="mt-0.5 truncate text-lg font-semibold leading-tight tracking-tight tabular-nums text-primary">{fmtMYR(totSO)}</div>
          <div className="mt-0.5 truncate text-xs text-muted-foreground">{Object.keys(tree).length} projects</div>
        </Card>
        <Card className="min-w-0 px-3.5 py-2.5">
          <div className="truncate text-xs text-muted-foreground">Total PO Amount</div>
          <div className="mt-0.5 truncate text-lg font-semibold leading-tight tracking-tight tabular-nums text-warning">{fmtMYR(totPO)}</div>
        </Card>
        <Card className="min-w-0 px-3.5 py-2.5">
          <div className="truncate text-xs text-muted-foreground">Gross Margin</div>
          <div className={cn("mt-0.5 truncate text-lg font-semibold leading-tight tracking-tight tabular-nums", totGM >= 0 ? "text-success" : "text-destructive")}>{fmtMYR(totGM)}</div>
          <div className="mt-0.5 truncate text-xs text-muted-foreground">{totPct.toFixed(1)}% of sales</div>
        </Card>
        <Card className="min-w-0 px-3.5 py-2.5">
          <div className="truncate text-xs text-muted-foreground">Margin %</div>
          <div className={cn("mt-0.5 truncate text-lg font-semibold leading-tight tracking-tight tabular-nums", totGM >= 0 ? "text-success" : "text-destructive")}>{totPct.toFixed(1)}%</div>
          <div className="mt-0.5 truncate text-xs text-muted-foreground">{entity} · each project's own view</div>
        </Card>
      </div>

      {/* ── Content ────────────────────────────────────────────── */}
      <div className="flex flex-col gap-2 bg-card p-4">
        {loading && <TableSkeleton rows={5} cols={5} />}

        {!loading && projKeys.length === 0 && (
          <EmptyState title="No projects for this entity" hint="Switch entity or try a different project code." />
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
            <div key={projNo} className="mb-2 overflow-hidden rounded-xl border border-border bg-card shadow-sm">

              {/* Project header */}
              <div
                className="flex cursor-pointer select-none flex-wrap items-center gap-2.5 border-b border-border bg-muted/40 px-3.5 py-2.5"
                onClick={() => toggleProj(projNo)}
              >
                <ChevronRightIcon open={isOpen} />
                <span className="min-w-[160px] text-[14px] font-semibold">{projNo}</span>
                <Badge>{soKeys.length} SO</Badge>
                {unlinkedPoKeys.length > 0 && (
                  <Badge variant="secondary">+{unlinkedPoKeys.length} unlinked PO</Badge>
                )}
                <LevelToggle value={lvl} onChange={(newLvl) => setLevelFor(projNo, newLvl)} />
                <div className="ml-auto flex flex-wrap gap-6">
                  <div className="text-right">
                    <div className="text-[11px] text-muted-foreground">Total SO Amount</div>
                    <div className="text-[13px] font-medium">{fmtMYR(projSOAmt)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[11px] text-muted-foreground">Total PO Amount</div>
                    <div className="text-[13px] font-medium">{fmtMYR(projPOAmt)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[11px] text-muted-foreground">Gross Margin</div>
                    <div className={cn("text-[13px] font-medium", projGM >= 0 ? "text-success" : "text-destructive")}>{fmtMYR(projGM)}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[11px] text-muted-foreground">Margin %</div>
                    <div className="text-[13px] font-medium"><GmBadge pct={projGMPct} /></div>
                  </div>
                </div>
              </div>

              {/* Project body */}
              {isOpen && (
                <div className="flex flex-col gap-2 bg-card p-3">

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
                      <div key={soNo} className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">

                        {/* SO header */}
                        <div
                          onClick={() => toggleSO(soKey)}
                          className={cn(
                            "flex cursor-pointer flex-wrap items-center gap-2 bg-muted/40 px-3 py-1.5",
                            isSoOpen && "border-b border-border"
                          )}
                        >
                          <span className="text-[11px] text-muted-foreground">{isSoOpen ? "▾" : "▸"}</span>
                          <span className="text-[12px] font-medium">{soNo}</span>
                          <span className="text-[11px] text-muted-foreground">
                            {so.so_date ? so.so_date.slice(0, 10) : ""}
                          </span>
                          <StatusBadge status={soOverall} />
                          {/* SO-level margin — recalculates with the project's selected view */}
                          <div className="ml-auto flex items-center gap-3 text-[11px]">
                            <span>SO: <strong className="font-mono">{fmtMYR(soAmt)}</strong></span>
                            <span>PO: <strong className="font-mono">{fmtMYR(poAmt)}</strong></span>
                            <span>GM: <strong className={cn("font-mono", soGM >= 0 ? "text-success" : "text-destructive")}>{fmtMYR(soGM)}</strong> <GmBadge pct={soGMPct} /></span>
                          </div>
                        </div>

                        {/* SO detail */}
                        {isSoOpen && (
                          <div className="grid grid-cols-1 bg-card md:grid-cols-2">

                            {/* Sales lines */}
                            <div className="border-b border-border p-3 md:border-b-0 md:border-r">
                              <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                                Sales (SO lines)
                              </div>
                              <div className="flex items-center gap-1.5 border-b border-border/60 py-1.5 text-[13px]">
                                <span className="shrink-0 font-mono font-medium text-primary">{soNo}</span>
                                <span className="shrink-0 text-[11px] text-muted-foreground">{so.so_date ? so.so_date.slice(0, 10) : ""}</span>
                                <StatusBadge status={soOverall} />
                                <span className="ml-auto shrink-0 font-mono font-medium">
                                  {fmtMYR(soAmt)}
                                </span>
                              </div>
                              {soLinesF.length === 0 && (
                                <div className="py-2 text-[13px] italic text-muted-foreground">No lines under this view</div>
                              )}
                              {soLinesF.map((r, i) => (
                                <div key={i} className="flex items-center justify-between gap-2 border-b border-border/60 py-1.5 text-[13px]">
                                  <span className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap" title={r.description}>
                                    {r.description || r.item_code || "—"}
                                  </span>
                                  <StatusBadge status={r.billing_status} />
                                  <StatusBadge status={r.payment_status} />
                                  <span className="shrink-0 font-mono font-medium text-success">{fmtMYR(r.so_amount)}</span>
                                </div>
                              ))}
                            </div>

                            {/* PO groups */}
                            <div className="p-3">
                              <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                                Purchases (PO)
                              </div>
                              {poGroups.length === 0 && (
                                <div className="text-[13px] italic text-muted-foreground">No linked PO</div>
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
                    <div className="border-t border-dashed border-border pt-2">
                      <div className="mb-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                        Purchases not linked to any SO
                      </div>
                      {unlinkedPoKeys.map(k => (
                        <PoGroup
                          key={k}
                          po={proj.unlinkedPoMap[k]}
                          level={lvl}
                          unlinked
                          soOptions={soKeys}
                          isPending={pendingPoSet.has(proj.unlinkedPoMap[k].po_no)}
                          onLink={handleLinkPo}
                          linking={linkingPo === proj.unlinkedPoMap[k].po_no}
                        />
                      ))}
                    </div>
                  )}

                  {/* Project footer */}
                  <div className="flex justify-end gap-5 border-t border-border py-2 text-[12px]">
                    <span>Total SO Amount: <strong className="font-mono text-success">{fmtMYR(projSOAmt)}</strong></span>
                    <span>Total PO Amount: <strong className="font-mono text-destructive">{fmtMYR(projPOAmt)}</strong></span>
                    <span>Gross Margin: <strong className={cn("font-mono", projGM >= 0 ? "text-success" : "text-destructive")}>{fmtMYR(projGM)}</strong> <GmBadge pct={projGMPct} /></span>
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

function ChevronRightIcon({ open }) {
  return (
    <span className={cn("inline-block w-3 shrink-0 text-[11px] text-muted-foreground transition-transform", open && "rotate-90")}>
      ▶
    </span>
  );
}
