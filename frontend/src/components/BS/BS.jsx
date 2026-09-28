import React,{useState,useCallback,useEffect} from "react";
import { ChevronDown, ChevronRight, Download } from "lucide-react";
import {getBs} from "../../services/api";
import {useMonthPicker} from "../../hooks/useMonthPicker";
import MonthPicker from "../Shared/MonthPicker";
import {fmtMYR,fmtMYRK,numFmt} from "../../utils/fmt";
import {showToast} from "../../utils/toast";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { PageHeader } from "../ui/page-header";
import { PageShell, FilterBar, FilterLabel } from "../ui/page-shell";
import { FilterPill } from "../ui/filter-pill";
import { TableSkeleton, KpiSkeleton } from "../ui/skeleton";
import { EmptyState } from "../ui/empty-state";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../ui/table";
import { cn } from "../../lib/utils";

const BS_ORDER=["FA","OA","CA","RE","CL","LL","OL"];
const BS_LABEL={FA:"Fixed Assets",OA:"Other Assets",CA:"Current Assets",RE:"Retained Earnings",CL:"Current Liabilities",LL:"Long-term Liabilities",OL:"Other Liabilities"};
const ASSET_TYPES=new Set(["FA","OA","CA","RE"]);
const LIAB_TYPES=new Set(["CL","LL","OL"]);

const PRESETS = [
  { key: "ty", label: "This year" },
  { key: "ly", label: "Last year" },
  { key: "tm", label: "This month" },
  { key: "lm", label: "Last month" },
];

// Sticky first column keeps the account/section label visible while the
// month columns scroll horizontally — each row style below needs its own
// *opaque* background repeated on the sticky cell (a semi-transparent bg
// would let the scrolling columns show through underneath it).
const STICKY = "sticky left-0 z-10";

export default function BS({ entity = "QM" }){
  const now=new Date();
  const mp=useMonthPicker(now.getFullYear(),0,now.getFullYear(),11);
  const [data,setData]=useState(null);
  const [loading,setLoading]=useState(false);
  const [open,setOpen]=useState({});
  const [preset,setPreset]=useState("ty");

  const run=useCallback(async()=>{
    setLoading(true);
    try{const res=await getBs(entity, mp.fromStr,mp.toStr);setData(res.data);}
    catch(e){showToast("⚠ "+e.message);}
    finally{setLoading(false);}
  },[entity, mp.fromStr,mp.toStr]);

  const groups={};
  (data?.rows||[]).forEach(r=>{groups[r.acc_type]=groups[r.acc_type]||[];groups[r.acc_type].push(r);});
  const lastMonth = data?.month_labels?.slice(-1)[0];
  const secTotal=(type)=>(groups[type]||[]).reduce((s,r)=>s+Number(r.monthly?.[lastMonth]??r.closing_balance),0);
  const totAssets=BS_ORDER.filter(t=>ASSET_TYPES.has(t)).reduce((s,t)=>s+secTotal(t),0);
  const totLiab=BS_ORDER.filter(t=>LIAB_TYPES.has(t)).reduce((s,t)=>s+secTotal(t),0);
  const ca=secTotal("CA"),cl=secTotal("CL");

  const toggle=k=>setOpen(p=>({...p,[k]:!p[k]}));
  const anyOpen=Object.values(open).some(Boolean);

  // Run on first open and whenever the entity changes.
  useEffect(() => { setData(null); run(); }, [entity]);
  const exportCSV = () => {
  if (!data) { showToast("⚠ Run report first."); return; }
  const headers = ["Acc No","Acc Desc","Acc Type","OB Balance","Bring Fwd","Period Net","Closing", ...(data.month_labels||[])];
  const rows = (data.rows||[]).map(r => [
    r.acc_no, r.acc_desc, r.acc_type,
    Number(r.ob_home_balance)||0,
    Number(r.bf_home_balance)||0,
    Number(r.period_home_net)||0,
    Number(r.closing_balance)||0,
    ...(data.month_labels||[]).map(m => Number(r.monthly?.[m])||0)
  ]);
  const csv = [headers,...rows]
    .map(r => r.map(v=>`"${String(v??"").replace(/"/g,'""')}"`).join(","))
    .join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv],{type:"text/csv"}));
  a.download = `bs_${mp.fromStr}_${mp.toStr}.csv`;
  a.click();
};

  const kpis = [
    { label: "Total Assets", val: totAssets, tone: "text-primary", sub: "FA + CA" },
    { label: "Net Current Assets", val: ca - cl, tone: ca - cl >= 0 ? "text-success" : "text-destructive", sub: "CA − CL" },
    { label: "Total Liabilities", val: totLiab, tone: "text-warning", sub: "CL + LL + OL" },
    { label: "Equity", val: totAssets - totLiab, tone: "text-primary", sub: "Assets − Liabilities" },
  ];

  return(
    <PageShell>
          <PageHeader
            eyebrow="Financial Reports"
            title="Balance Sheet"
            subtitle={`${entity} · ${mp.fromLabel}–${mp.toLabel}`}
            actions={
              <Button variant="outline" size="sm" onClick={exportCSV}>
                <Download className="h-3.5 w-3.5" /> Export CSV
              </Button>
            }
          />

          <FilterBar>
            <FilterLabel>Period</FilterLabel>
            <MonthPicker label={mp.fromLabel} state={mp.s} side="from" onSelect={mp.sel}/>
            <span>–</span>
            <MonthPicker label={mp.toLabel} state={mp.s} side="to" onSelect={mp.sel}/>
            {PRESETS.map(p=>(
              <FilterPill key={p.key} active={preset===p.key} onClick={()=>{setPreset(p.key);mp.preset(p.key);}}>
                {p.label}
              </FilterPill>
            ))}
            <Button className="ml-auto" size="lg" onClick={run} disabled={loading}>{loading?"Loading…":"Run Report"}</Button>
          </FilterBar>

          {(data||loading)&&(
            <div className="grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-3">
              {loading&&!data ? <KpiSkeleton/> : kpis.map(k => (
                <Card key={k.label} className="min-w-0 px-3.5 py-2.5">
                  <div className="truncate text-xs text-muted-foreground">{k.label}</div>
                  <div className={cn("mt-0.5 truncate text-lg font-semibold leading-tight tracking-tight tabular-nums", k.tone)}>{fmtMYRK(k.val)}</div>
                  <div className="mt-0.5 truncate text-xs text-muted-foreground">{k.sub}</div>
                </Card>
              ))}
            </div>
          )}

          <Card className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 px-[18px] pb-2.5 pt-3.5">
              <h3 className="text-base font-semibold">Balance Sheet — Detail</h3>
              <p className="text-xs text-muted-foreground">{entity} · {mp.fromLabel}–{mp.toLabel}</p>
            </div>
            {data?.rows?.length>0&&(
              <>
              <button
                type="button"
                className="mx-4 mb-2 flex select-none items-center gap-1.5 rounded text-[12px] font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={()=>{const all=!anyOpen;const nxt={};BS_ORDER.forEach(k=>{nxt[k]=all;});setOpen(nxt);}}
              >
                {anyOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                <span>{anyOpen?"Collapse all sections":"Expand all sections"}</span>
              </button>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className={cn(STICKY, "min-w-[200px] bg-card")}>Account</TableHead>
                      {(data.month_labels||[]).map(m=>(
                        <TableHead key={m} className="min-w-[110px] text-right">{m}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {BS_ORDER.filter(t=>groups[t]&&groups[t].length>0).map(t=>{
                      const sTotal=secTotal(t); const isOpen=open[t];
                      return(
                        <React.Fragment key={t}>
                          <TableRow className="cursor-pointer bg-muted/60 hover:bg-muted" onClick={()=>toggle(t)}>
                            <TableCell className={cn(STICKY, "flex items-center gap-1.5 bg-[hsl(var(--muted))] font-semibold")}>
                              {isOpen ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
                              {BS_LABEL[t]}
                            </TableCell>
                            {(data.month_labels||[]).map((m,i)=>(
                              <TableCell key={m} className="text-right font-mono font-semibold">
                                {i===data.month_labels.length-1 ? fmtMYR(sTotal) : ""}
                              </TableCell>
                            ))}
                          </TableRow>
                          {isOpen&&(groups[t]||[]).map((r,i)=>(
                            <TableRow key={i}>
                              <TableCell className={cn(STICKY, "bg-card pl-7 text-[12px] text-muted-foreground")}>{r.acc_no} {r.acc_desc}</TableCell>
                              {(data.month_labels||[]).map(m=>(
                                  <TableCell key={m} className="text-right font-mono"
                                    dangerouslySetInnerHTML={{__html:numFmt(Number(r.monthly?.[m]??0))}}/>
                                ))}
                            </TableRow>
                          ))}
                          {isOpen&&<TableRow className="bg-muted/40">
                            <TableCell className={cn(STICKY, "bg-[hsl(var(--muted))] font-semibold")}>Total {BS_LABEL[t]}</TableCell>
                            {(data.month_labels||[]).map((m,i)=>(
                              <TableCell key={m} className="text-right font-mono font-semibold">
                                {i===data.month_labels.length-1 ? fmtMYR(sTotal) : ""}
                              </TableCell>
                            ))}
                          </TableRow>}
                        </React.Fragment>
                      );
                    })}
                    {[
                      {label:"Net Current Assets", val:ca-cl, tone:"text-success"},
                      {label:"Total Assets",       val:totAssets, tone:"text-primary"},
                      {label:"Total Liabilities",  val:totLiab,   tone:"text-warning"},
                    ].map(({label,val,tone})=>(
                      <TableRow key={label} className="border-y-2 border-primary/20 bg-accent">
                        <TableCell className={cn(STICKY, "bg-[hsl(var(--accent))] font-bold", tone)}>{label}</TableCell>
                        {(data.month_labels||[]).map((m,i)=>(
                          <TableCell key={m} className={cn("text-right font-mono font-bold", tone)}>
                            {i===data.month_labels.length-1 ? fmtMYR(val) : ""}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              </>
            )}
            {!data?.rows?.length&&(loading ? <TableSkeleton/> : <EmptyState/>)}
            <div className="px-4 py-2.5 text-[11px] text-muted-foreground">{entity} · MYR · {mp.fromLabel}–{mp.toLabel}</div>
          </Card>
    </PageShell>
  );
}
