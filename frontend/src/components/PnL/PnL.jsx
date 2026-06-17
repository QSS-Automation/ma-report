import React,{useState,useCallback,useEffect} from "react";
import {getPnl, getBs,refreshStaging }from"../../services/api";
import {useMonthPicker} from "../../hooks/useMonthPicker";
import MonthPicker from "../Shared/MonthPicker";
import {fmtMYRK,numFmt,MN} from "../../utils/fmt";
import {showToast} from "../../utils/toast";
import PnLTable from "./PnLTable";
import PnLCompare from "./PnLCompare";
import PnLSideCards from "./PnLSideCards";

export default function PnL({ entity = "QM", setEntity, entities = [] }){
  const now=new Date();
  const mp=useMonthPicker(now.getFullYear(),0,now.getFullYear(),11);
  const [data,setData]=useState(null);
  const [loading,setLoading]=useState(false);
  const [view,setView]=useState("detail");
  const [yoy,setYoy]=useState(false);
  const [lyData, setLyData] = useState(null);
  const [preset,setPreset]=useState("ty");
  const [cmpData, setCmpData] = useState(null);
  const [rebuilding, setRebuilding] = useState(false);
  useEffect(() => { setData(null); }, [entity]);
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
    setCmpData({ active: res.data, priorSame: pyRes.data, priorFull: pyFyRes.data });
  } catch (e) { showToast("⚠ " + e.message); }
  finally { setLoading(false); }
}, [entity, mp.fromStr, mp.toStr, mp.s.fromYear]);

  const kpi=(section)=>{
    if(!data)return 0;
    const r=data.rows.find(r=>r.section===section&&(r.row_type==="summary"||r.row_type==="net_sales"));
    return r?r.months.reduce((a,b)=>a+(Number(b)||0),0):0;
  };
  const ns=kpi("NET_SALES"),gp=kpi("GROSS_PROFIT"),pbt=kpi("NET_PROFIT_BEFORE"),pat=kpi("NET_PROFIT_AFTER");
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

  return(
    <div style={{display:"flex",flexDirection:"column",flex:1,overflow:"hidden",minHeight:0}}>
      <div className="pg-hdr">
        <div className="pg-title">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#185FA5" strokeWidth="1.5"><rect x="2" y="2" width="12" height="12" rx="2"/><path d="M4 11l2.5-3.5 2 2.5L11 5"/></svg>
          P&amp;L Statement
          <span className="pg-badge">{entity} · {mp.fromLabel}–{mp.toLabel}</span>
        </div>
        <div className="pg-actions">
        <button className="pg-btn" onClick={rebuild} disabled={rebuilding}
          style={{background:rebuilding?"#888780":"#6B7280", marginRight:6, color:"white"}}>
          {rebuilding?"Rebuilding…":"Refresh"}
        </button>
        <button className="pg-btn" onClick={exportCSV}>Export CSV</button>
      </div>
      </div>

      <div className="filter">
        <span className="f-lbl">Entity</span>
          <select className="f-sel" value={entity} onChange={e => { setEntity(e.target.value); setData(null); }}>
            {entities.map(e => (
              <option key={e.entity_code} value={e.entity_code}>{e.entity_code}</option>
            ))}
          </select>
          <div className="f-div"/>
        <span className="f-lbl">From</span>
        <MonthPicker label={mp.fromLabel} state={mp.s} side="from" onSelect={mp.sel}/>
        <span className="f-lbl">To</span>
        <MonthPicker label={mp.toLabel} state={mp.s} side="to" onSelect={mp.sel}/>
        <div className="f-div"/>
        {["tm","lm","ty","ly"].map(p=>(
          <button key={p} className={"f-pre"+(preset===p?" on":"")}
            onClick={()=>{setPreset(p);mp.preset(p);}}>
            {p==="tm"?"This month":p==="lm"?"Last month":p==="ty"?"This year":"Last year"}
          </button>
        ))}
        <button className="run" onClick={run} disabled={loading}>{loading?"Loading…":"Run Report"}</button>
      
      </div>

      <div style={{padding:"12px 18px 0",flexShrink:0,background:"#fff",borderBottom:"1px solid #e8e7e0"}}>
        <div className="kpi-row" style={{marginBottom:0}}>
          <div className="kpi"><div className="kpi-lbl">Net Sales</div><div className="kpi-val b">{fmtMYRK(ns)}</div><div className="kpi-sub">MYR</div></div>
          <div className="kpi"><div className="kpi-lbl">Gross Profit</div><div className={"kpi-val "+(gp>=0?"g":"r")}>{fmtMYRK(gp)}</div><div className="kpi-sub" style={{color:ns?(gp/ns)>=0?"#1D9E75":"#c0392b":"inherit"}}>{ns?((gp/ns)*100).toFixed(1)+"% margin":"—"}</div></div>
          <div className="kpi"><div className="kpi-lbl">Net Profit (before tax)</div><div className={"kpi-val "+(pbt>=0?"g":"r")}>{fmtMYRK(pbt)}</div><div className="kpi-sub" style={{color:ns?(pbt/ns)>=0?"#1D9E75":"#c0392b":"inherit"}}>{ns?((pbt/ns)*100).toFixed(1)+"% margin":"—"}</div></div>
          <div className="kpi"><div className="kpi-lbl">Net Profit (after tax)</div><div className={"kpi-val "+(pat>=0?"g":"r")}>{fmtMYRK(pat)}</div><div className="kpi-sub" style={{color:ns?(pat/ns)>=0?"#1D9E75":"#c0392b":"inherit"}}>{ns?((pat/ns)*100).toFixed(1)+"% margin":"—"}</div></div>
        </div>
      </div>

      <div className="view-tabs">
        <div className={"view-tab"+(view==="detail"?" on":"")} onClick={()=>setView("detail")}>P&amp;L Detail</div>
        <div className={"view-tab"+(view==="cmp"?" on":"")} onClick={()=>setView("cmp")}>Period Comparison</div>
      </div>

      {view==="detail"&&(
        <div style={{flex:1,overflowY:"auto",padding:"16px 18px"}}>
          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
            <button className={"btn-yoy"+(yoy?" on":"")} onClick={async()=>{
            const next=!yoy; setYoy(next);
            if(next && data && !lyData){
              try{
                const lyFrom=mp.fromStr.replace(/^(\d{4})/,y=>+y-1);
                const lyTo=mp.toStr.replace(/^(\d{4})/,y=>+y-1);
                const res=await getPnl(lyFrom,lyTo);
                setLyData(res.data);
              }catch(e){showToast("⚠ "+e.message);}
            }
          }}>
            {yoy?"Hide comparison":"vs Last Year"}
          </button>
            <span style={{fontSize:10,color:"#888780"}}>Toggle prior year comparison</span>
          </div>
          <div className="two-col">
            {data?<PnLTable data={data} yoy={yoy} lyData={lyData}/>:<div className="card" style={{padding:40,textAlign:"center",color:"#888780"}}>Select a date range and click Run Report.</div>}
            {data&&<PnLSideCards data={data}/>}
          </div>
        </div>
      )}
      {view === "cmp" && (
        <div style={{flex:1, overflowY:"auto", padding:"16px 18px"}}>
          {cmpData
          ? <PnLCompare cmpData={cmpData} mp={mp} />
          : <div className="card" style={{padding:40,textAlign:"center",color:"#888780"}}>Run report first.</div>}
          </div>
        )}
    </div>
  );
}
