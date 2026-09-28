import React,{useState,useCallback,useEffect} from "react";
import { RefreshCw, Download, FileSpreadsheet } from "lucide-react";
import {getPnl, getPnlV2, refreshStaging, exportExcel} from "../../services/api";
import {useMonthPicker} from "../../hooks/useMonthPicker";
import MonthPicker from "../Shared/MonthPicker";
import {fmtMYRK} from "../../utils/fmt";
import {showToast} from "../../utils/toast";
import PnLTable from "./PnLTable";
import PnLTableV2 from "./PnLTableV2";
import PnLCompare from "./PnLCompare";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { PageHeader } from "../ui/page-header";
import { PageShell, FilterBar, FilterLabel } from "../ui/page-shell";
import { FilterPill } from "../ui/filter-pill";
import { Segmented } from "../ui/segmented";
import { TableSkeleton, KpiSkeleton } from "../ui/skeleton";
import { EmptyState } from "../ui/empty-state";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../ui/tabs";
import { cn } from "../../lib/utils";

const PRESETS = ["tm","lm","ty","ly"];
const PRESET_LABEL = { tm:"This month", lm:"Last month", ty:"This year", ly:"Last year" };
const VERSIONS = [{ value: "v1", label: "Classic P&L" }, { value: "v2", label: "New P&L (Beta)" }];

export default function PnL({ entity = "QM" }){
  const now=new Date();
  const mp=useMonthPicker(now.getFullYear(),0,now.getFullYear(),11);
  const [data,setData]=useState(null);
  const [dataV2,setDataV2]=useState(null);
  const [pnlVersion,setPnlVersion]=useState("v1"); // "v1" | "v2"
  const [loading,setLoading]=useState(false);
  const [view,setView]=useState("detail");
  const [yoy,setYoy]=useState(false);
  const [lyData, setLyData] = useState(null);
  const [preset,setPreset]=useState("ty");
  const [cmpData, setCmpData] = useState(null);
  const [rebuilding, setRebuilding] = useState(false);
  const rebuild = useCallback(async () => {
    setRebuilding(true);
    try {
      await refreshStaging(entity, "web");
      showToast("✓ Staging rebuilt for " + entity);
    } catch (e) {
      showToast("⚠ Rebuild failed: " + e.message);
    } finally {
      setRebuilding(false);
    }
  }, [entity]);
  const run = useCallback(async () => {
  setLoading(true);
  try {
    // Prior same period: shift both dates back exactly 1 year
    const pyFrom = mp.fromStr.replace(/^(\d{4})/, y => +y - 1);
    const pyTo   = mp.toStr.replace(/^(\d{4})/, y => +y - 1);
    // Prior full year: Jan 01 – Dec 31 of prior year
    const pyYear = mp.s.fromYear - 1;
    const pyFyFrom = `${pyYear}-01-01`;
    const pyFyTo   = `${pyYear}-12-31`;

    const [res, pyRes, pyFyRes] = await Promise.all([
      getPnl(entity, mp.fromStr, mp.toStr),
      getPnl(entity,pyFrom, pyTo),
      getPnl(entity,pyFyFrom, pyFyTo),
    ]);
    setData(res.data);
    // The "vs Last Year" column is exactly the prior-same-period figures
    // fetched above — reuse them so the comparison always matches the
    // current entity + period (it used to be fetched once and never
    // refreshed, and without the entity argument).
    setLyData(pyRes.data);
    setCmpData({ active: res.data, priorSame: pyRes.data, priorFull: pyFyRes.data });

    if (pnlVersion === "v2") {
      try {
        const v2res = await getPnlV2(entity, mp.fromStr, mp.toStr);
        setDataV2(v2res.data);
      } catch (e) { showToast("⚠ New P&L failed: " + e.message); }
    }
  } catch (e) { showToast("⚠ " + e.message); }
  finally { setLoading(false); }
}, [entity, mp.fromStr, mp.toStr, mp.s.fromYear, pnlVersion]);

  // Run automatically when the tab first opens, and again whenever the
  // entity or P&L version changes; period changes still wait for Run Report.
  useEffect(() => {
    setData(null); setDataV2(null); setLyData(null); setCmpData(null);
    run();
  }, [entity, pnlVersion]);

  const kpi=(section)=>{
    if(!data)return 0;
    const r=data.rows.find(r=>r.section===section&&(r.row_type==="summary"||r.row_type==="net_sales"));
    return r?r.months.reduce((a,b)=>a+(Number(b)||0),0):0;
  };
  const ns=kpi("NET_SALES"),gp=kpi("GROSS_PROFIT"),pbt=kpi("NET_PROFIT_BEFORE"),pat=kpi("NET_PROFIT_AFTER");
  const handleExportExcel = async () => {
    if (!data) { showToast("⚠ Run report first."); return; }
    try {
        const res = await exportExcel(entity, mp.fromStr, mp.toStr);
        const url = window.URL.createObjectURL(new Blob([res.data]));
        const a = document.createElement("a");
        a.href = url;
        a.download = `MA_Report_${entity}_${mp.fromStr}_${mp.toStr}.xlsx`;
        a.click();
        window.URL.revokeObjectURL(url);
    } catch(e) { showToast("⚠ Export failed: " + e.message); }
};
  const exportCSV = () => {
  if (!data) { showToast("⚠ Run report first."); return; }
  const headers = ["Section","Label","Row Type", ...data.month_labels, "Total"];
  const rows = data.rows.map(r => [
    r.section, r.label, r.row_type,
    ...r.months.map(v => Number(v)||0),
    Number(r.total)||0
  ]);
  const csv = [headers,...rows]
    .map(r => r.map(v=>`"${String(v??"").replace(/"/g,'""')}"`).join(","))
    .join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv],{type:"text/csv"}));
  a.download = `pnl_${mp.fromStr}_${mp.toStr}.csv`;
  a.click();
};

  const kpis = [
    { label: "Net Sales", val: ns, tone: "text-primary", sub: "MYR" },
    { label: "Gross Profit", val: gp, tone: gp>=0?"text-success":"text-destructive", sub: ns?((gp/ns)*100).toFixed(1)+"% margin":"—", subTone: ns?(gp/ns>=0?"text-success":"text-destructive"):"" },
    { label: "Net Profit (before tax)", val: pbt, tone: pbt>=0?"text-success":"text-destructive", sub: ns?((pbt/ns)*100).toFixed(1)+"% margin":"—", subTone: ns?(pbt/ns>=0?"text-success":"text-destructive"):"" },
    { label: "Net Profit (after tax)", val: pat, tone: pat>=0?"text-success":"text-destructive", sub: ns?((pat/ns)*100).toFixed(1)+"% margin":"—", subTone: ns?(pat/ns>=0?"text-success":"text-destructive"):"" },
  ];

  const detail = pnlVersion === "v2" ? dataV2 : data;

  return(
    <PageShell>
      <PageHeader
        eyebrow="Financial Reports"
        title="P&L Statement"
        subtitle={`${entity} · ${mp.fromLabel}–${mp.toLabel}`}
        actions={
          <>
            <Segmented value={pnlVersion} onChange={setPnlVersion} options={VERSIONS} />
            <Button variant="secondary" size="sm" onClick={rebuild} disabled={rebuilding}>
              <RefreshCw className={cn("h-3.5 w-3.5", rebuilding && "animate-spin")} />
              {rebuilding?"Rebuilding…":"Refresh staging"}
            </Button>
            <Button variant="outline" size="sm" onClick={handleExportExcel}>
              <FileSpreadsheet className="h-3.5 w-3.5" /> Export Excel
            </Button>
            <Button variant="outline" size="sm" onClick={exportCSV}>
              <Download className="h-3.5 w-3.5" /> Export CSV
            </Button>
          </>
        }
      />

      <FilterBar>
        <FilterLabel>Period</FilterLabel>
        <MonthPicker label={mp.fromLabel} state={mp.s} side="from" onSelect={mp.sel}/>
        <span>–</span>
        <MonthPicker label={mp.toLabel} state={mp.s} side="to" onSelect={mp.sel}/>
        {PRESETS.map(p=>(
          <FilterPill key={p} active={preset===p} onClick={()=>{setPreset(p);mp.preset(p);}}>
            {PRESET_LABEL[p]}
          </FilterPill>
        ))}
        <Button className="ml-auto" size="lg" onClick={run} disabled={loading}>{loading?"Loading…":"Run Report"}</Button>
      </FilterBar>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-3">
        {loading && !data ? <KpiSkeleton /> : kpis.map(k => (
          <Card key={k.label} className="min-w-0 px-3.5 py-2.5">
            <div className="truncate text-xs text-muted-foreground">{k.label}</div>
            <div className={cn("mt-0.5 truncate text-lg font-semibold leading-tight tracking-tight tabular-nums", k.tone)}>{fmtMYRK(k.val)}</div>
            <div className={cn("mt-0.5 truncate text-xs text-muted-foreground", k.subTone)}>{k.sub}</div>
          </Card>
        ))}
      </div>

      <Tabs value={view} onValueChange={setView}>
        <TabsList>
          <TabsTrigger value="detail">P&amp;L Detail</TabsTrigger>
          <TabsTrigger value="cmp">Period Comparison</TabsTrigger>
        </TabsList>

        <TabsContent value="detail" className="pt-4">
          {pnlVersion==="v1"&&(
            <div className="mb-3 flex items-center gap-2.5">
              <FilterPill active={yoy} onClick={()=>setYoy(v=>!v)} disabled={!lyData}>
                {yoy?"Hide comparison":"vs Last Year"}
              </FilterPill>
              <span className="text-[11px] text-muted-foreground">Adds a YoY % column against the same period last year</span>
            </div>
          )}
          {loading && !detail
            ? <Card><TableSkeleton /></Card>
            : !detail
              ? <Card><EmptyState /></Card>
              : pnlVersion==="v2"
                ? <PnLTableV2 data={dataV2}/>
                : <PnLTable data={data} yoy={yoy} lyData={lyData}/>}
        </TabsContent>

        <TabsContent value="cmp" className="pt-4">
          {loading && !cmpData
            ? <Card><TableSkeleton rows={7} cols={4} /></Card>
            : cmpData
              ? <PnLCompare cmpData={cmpData} mp={mp} />
              : <Card><EmptyState /></Card>}
        </TabsContent>
      </Tabs>
    </PageShell>
  );
}
