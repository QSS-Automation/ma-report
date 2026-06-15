import React,{useState,useCallback,useEffect} from "react";
import {getBs} from "../../services/api";
import {useMonthPicker} from "../../hooks/useMonthPicker";
import MonthPicker from "../Shared/MonthPicker";
import {fmtMYR,fmtMYRK,numFmt} from "../../utils/fmt";
import {showToast} from "../../utils/toast";

const BS_ORDER=["FA","OA","CA","RE","CL","LL","OL"];
const BS_LABEL={FA:"Fixed Assets",OA:"Other Assets",CA:"Current Assets",RE:"Retained Earnings",CL:"Current Liabilities",LL:"Long-term Liabilities",OL:"Other Liabilities"};
const ASSET_TYPES=new Set(["FA","OA","CA","RE"]);
const LIAB_TYPES=new Set(["CL","LL","OL"]);

export default function BS({ entity = "QM", setEntity, entities = [] }){
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

  const N=v=>{const n=Number(v);return<td style={{textAlign:"right",fontFamily:"Courier New,monospace",fontSize:12}} dangerouslySetInnerHTML={{__html:numFmt(n)}}/>;};
  useEffect(() => { setData(null); }, [entity]);
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

  return(
    <div style={{display:"flex",flexDirection:"column",flex:1,overflow:"hidden",minHeight:0}}>
      <div className="pg-hdr">
        <div className="pg-title">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#185FA5" strokeWidth="1.5"><rect x="2" y="3" width="12" height="10" rx="1.5"/><path d="M2 6.5h12M5.5 3v3.5M10.5 3v3.5"/></svg>
          Balance Sheet <span className="pg-badge">{entity} · {mp.fromLabel}–{mp.toLabel}</span>
        </div>
        <div className="pg-actions" onClick={exportCSV}><button className="pg-btn">Export CSV</button></div>
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
        {["ty","ly","tm","lm"].map(p=>(
          <button key={p} className={"f-pre"+(preset===p?" on":"")} onClick={()=>{setPreset(p);mp.preset(p);}}>
            {p==="ty"?"This year":p==="ly"?"Last year":p==="tm"?"This month":"Last month"}
          </button>
        ))}
        <button className="run" onClick={run} disabled={loading}>{loading?"Loading…":"Run Report"}</button>
      </div>

      {data&&(
        <div style={{padding:"14px 18px",flexShrink:0,background:"#fff",borderBottom:"1px solid #e8e7e0"}}>
          <div className="kpi-row" style={{marginBottom:0}}>
            <div className="kpi"><div className="kpi-lbl">Total Assets</div><div className="kpi-val b">{fmtMYRK(totAssets)}</div><div className="kpi-sub">FA + CA</div></div>
            <div className="kpi"><div className="kpi-lbl">Net Current Assets</div><div className={"kpi-val "+(ca-cl>=0?"g":"r")}>{fmtMYRK(ca-cl)}</div><div className="kpi-sub">CA − CL</div></div>
            <div className="kpi"><div className="kpi-lbl">Total Liabilities</div><div className="kpi-val a">{fmtMYRK(totLiab)}</div><div className="kpi-sub">CL + LL + OL</div></div>
            <div className="kpi"><div className="kpi-lbl">Equity</div><div className="kpi-val b">{fmtMYRK(totAssets-totLiab)}</div><div className="kpi-sub">Assets − Liabilities</div></div>
          </div>
        </div>
      )}

      <div className="content">
        <div className="card">
          <div className="card-hdr">
            <div className="card-title">Balance Sheet — Detail</div>
            <div className="card-sub" style={{marginLeft:"auto"}}>{entity} · {mp.fromLabel}–{mp.toLabel}</div>
          </div>
          {data&&(
            <>
              <div className="expand-bar" onClick={()=>{const all=!anyOpen;const nxt={};BS_ORDER.forEach(k=>{nxt[k]=all;});setOpen(nxt);}}>
                <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="#185FA5" strokeWidth="1.5" style={{transition:"transform .15s",transform:anyOpen?"rotate(180deg)":"none"}}><path d="M2 4l4 4 4-4"/></svg>
                <span>{anyOpen?"Collapse all sections":"Expand all sections"}</span>
              </div>
              <div className="pnl-scroll">
                <table style={{width:"100%",borderCollapse:"collapse"}}>
                  <thead><tr style={{background:"#fafaf8"}}>
                    <th style={{padding:"7px 10px",fontSize:10,fontWeight:700,color:"#888780",textTransform:"uppercase",letterSpacing:".05em",borderBottom:"1px solid #e8e7e0",textAlign:"left",minWidth:280}}>Account</th>
                      {(data.month_labels||[]).map(m=>(
                        <th key={m} style={{padding:"7px 10px",fontSize:10,fontWeight:700,color:"#888780",textTransform:"uppercase",borderBottom:"1px solid #e8e7e0",textAlign:"right",minWidth:110,whiteSpace:"nowrap"}}>{m}</th>
                      ))}
                  </tr></thead>
                  <tbody>
                    {BS_ORDER.filter(t=>groups[t]&&groups[t].length>0).map(t=>{
                      const sTotal=secTotal(t); const isOpen=open[t];
                      return(
                        <React.Fragment key={t}>
                          <tr className="sec-row" onClick={()=>toggle(t)}>
                            <td><span className={"chev"+(isOpen?" op":"")}>&#9658;</span>{BS_LABEL[t]}</td>
                            {(data.month_labels||[]).map((m,i)=>(
                              <td key={m} style={{textAlign:"right",fontFamily:"Courier New,monospace",fontSize:12,fontWeight:600}}>
                                {i===data.month_labels.length-1 ? fmtMYR(sTotal) : ""}
                              </td>
                            ))}
                          </tr>
                          {isOpen&&(groups[t]||[]).map((r,i)=>(
                            <tr key={i} className="det-row">
                              <td style={{paddingLeft:24,color:"#888780",fontSize:11}}>{r.acc_no} {r.acc_desc}</td>
                              {(data.month_labels||[]).map(m=>(
                                  <td key={m} style={{textAlign:"right",fontFamily:"Courier New,monospace",fontSize:12}}
                                    dangerouslySetInnerHTML={{__html:numFmt(Number(r.monthly?.[m]??0))}}/>
                                ))}
                            </tr>
                          ))}
                          {isOpen&&<tr className="sub-row">
                            <td>Total {BS_LABEL[t]}</td>
                            {(data.month_labels||[]).map((m,i)=>(
                              <td key={m} style={{textAlign:"right",fontFamily:"Courier New,monospace",fontWeight:600}}>
                                {i===data.month_labels.length-1 ? fmtMYR(sTotal) : ""}
                              </td>
                            ))}
                          </tr>}
                        </React.Fragment>
                      );
                    })}
                    {[
                      {label:"Net Current Assets", val:ca-cl, color:"#1D9E75"},
                      {label:"Total Assets",       val:totAssets, color:"#185FA5"},
                      {label:"Total Liabilities",  val:totLiab,   color:"#BA7517"},
                    ].map(({label,val,color})=>(
                      <tr key={label} className="sum-row">
                        <td style={{fontWeight:700,color}}>{label}</td>
                        {(data.month_labels||[]).map((m,i)=>(
                          <td key={m} style={{textAlign:"right",fontFamily:"Courier New,monospace",fontWeight:700,color}}>
                            {i===data.month_labels.length-1 ? fmtMYR(val) : ""}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
          {!data&&<div style={{padding:40,textAlign:"center",color:"#888780"}}>Select a date range and click Run Report.</div>}
          <div style={{padding:"6px 13px",background:"#fafaf8",borderTop:"1px solid #e8e7e0",fontSize:9,color:"#888780"}}>{entity} · MYR · {mp.fromLabel}–{mp.toLabel}</div>
        </div>
      </div>
    </div>
  );
}
