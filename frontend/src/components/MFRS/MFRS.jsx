import React,{useState,useCallback,useEffect} from "react";
import {getMfrs} from "../../services/api";
import {MN,pad2,fmtMYRK} from "../../utils/fmt";
import {showToast} from "../../utils/toast";

export default function MFRS({defaultSub="sales", entity = "QM", setEntity, entities = [] }){
  const now=new Date();
  const [from,setFrom]=useState(now.getFullYear()+"-01-01");
  const [to,setTo]=useState(now.getFullYear()+"-12-31");
  const [sub,setSub]=useState(defaultSub);
  const [data,setData]=useState({sales:null,pur:null});
  const [loading,setLoading]=useState(false);
  useEffect(() => { setData(null); }, [entity]);
  const run=useCallback(async()=>{
    setLoading(true);
    try{
      const [s,p]=await Promise.all([getMfrs(entity,"SALES",from,to),getMfrs(entity,"PURCHASE",from,to)]);
      setData({sales:s.data,pur:p.data});
    }catch(e){showToast("⚠ "+e.message);}
    finally{setLoading(false);}
  },[from,to]);

  const preset=p=>{
    const y=new Date().getFullYear();
    if(p==="ty"){setFrom(y+"-01-01");setTo(y+"-12-31");}
    else{setFrom((y-1)+"-01-01");setTo((y-1)+"-12-31");}
  };

  const cur=data?.[sub];
  const exportCSV = () => {
  if (!data) { showToast("⚠ Run report first."); return; }
  const headers = ["Doc No","Description","Split Index","Start Date","End Date","Total Days","Net Amount",...(data.month_labels||[])];
  const rows = (data.rows||[]).map(r => [
    r.doc_no, r.description, r.split_index,
    r.start_date, r.end_date, r.total_days, Number(r.net_amount)||0,
    ...(data.month_labels||[]).map(m => Number(r.monthly?.[m])||0)
  ]);
  const csv = [headers,...rows]
    .map(r => r.map(v=>`"${String(v??"").replace(/"/g,'""')}"`).join(","))
    .join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv],{type:"text/csv"}));
  a.download = `mfrs_${sub}_${from}_${to}.csv`;
  a.click();
};
  return(
    <div style={{display:"flex",flexDirection:"column",flex:1,overflow:"hidden",minHeight:0}}>
      <div className="pg-hdr">
        <div className="pg-title">
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="#185FA5" strokeWidth="1.5"><rect x="2" y="2" width="12" height="12" rx="1.5"/><path d="M2 6h12M6 6v8"/></svg>
          MFRS <span className="pg-badge">{sub==="sales"?"Sales":"Purchases"}</span>
          <span style={{fontSize:10,color:"#888780",fontWeight:400,marginLeft:4}}>daily revenue recognition by contract period</span>
        </div>
        <button className="pg-btn" onClick={exportCSV}>Export CSV</button>
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
        <input type="date" className="f-date" value={from} onChange={e=>setFrom(e.target.value)}/>
        <span className="f-lbl">To</span>
        <input type="date" className="f-date" value={to} onChange={e=>setTo(e.target.value)}/>
        <div className="f-div"/>
        <button className="f-pre on" onClick={()=>preset("ty")}>This year</button>
        <button className="f-pre" onClick={()=>preset("ly")}>Last year</button>
        <button className="run" onClick={run} disabled={loading}>{loading?"Loading…":"Run Report"}</button>
      </div>

      <div className="mfrs-sub-bar">
        <div className={"mfrs-tab"+(sub==="sales"?" on":"")} onClick={()=>setSub("sales")}>Sales</div>
        <div className={"mfrs-tab"+(sub==="pur"?" on":"")} onClick={()=>setSub("pur")}>Purchases</div>
      </div>

      <div className="content">
        <div style={{background:"#E6F1FB",borderRadius:8,padding:"8px 14px",fontSize:11,color:"#0C447C",marginBottom:12,lineHeight:1.6}}>
          <strong>MFRS 15 revenue recognition</strong> — each contract amount is spread daily over the contract period.
          Columns generated from your selected date range.
        </div>
        <div className="card">
          <div className="card-hdr">
            <div className="card-title">{sub==="sales"?"Sales — Revenue recognition by contract":"Purchases — Cost recognition by contract"}</div>
            <div className="card-sub">QM</div>
          </div>
          {cur&&cur.rows.length>0?(
            <MfrsTable data={cur}/>
          ):(
            <div style={{padding:40,textAlign:"center",color:"#888780"}}>
              {loading?"Loading…":"Run report to populate the MFRS recognition table."}
            </div>
          )}
          <div style={{padding:"5px 13px",background:"#fafaf8",borderTop:"1px solid #e8e7e0",fontSize:9,color:"#888780",display:"flex",justifyContent:"space-between"}}>
            <span>QM · MYR · MFRS 15</span>
            <span>Value = Amount × (days overlap / total days) for each period</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function MfrsTable({data}){
  const mks=data.month_columns;
  const allCols=["description","doc_no","total_days",...mks];
  const totals={};
  mks.forEach(mk=>{totals[mk]=0;});
  data.rows.forEach(r=>{ mks.forEach(mk=>{ if(r.monthly[mk])totals[mk]+=Number(r.monthly[mk]); }); });

  return(
    <div className="mf2-wrap">
      <table className="mf2-table">
        <thead><tr>
          <th className="mf2-th-fix" style={{minWidth:150}}>Description</th>
          <th className="mf2-th-fix" style={{minWidth:80,left:150}}>Doc No</th>
          <th className="mf2-th-fix" style={{minWidth:70,left:230,textAlign:"right",paddingRight:10}}>Days</th>
          {mks.map(mk=>{
            const mo=parseInt(mk.slice(1))-1;
            return<th key={mk} className="mf2-th-num mf2-th-active">{MN[mo]}<br/><span style={{fontWeight:400,fontSize:8}}>month</span></th>;
          })}
        </tr></thead>
        <tbody>
          {data.rows.map((r,i)=>(
            <tr key={i}>
              <td className="mf2-td-fix" style={{fontWeight:500}}>{r.description||"—"}</td>
              <td className="mf2-td-fix" style={{left:150,color:"#888780"}}>{r.doc_no||"—"}</td>
              <td className="mf2-td-fix" style={{left:230,textAlign:"right",paddingRight:10,color:"#5f5e5a"}}>{r.total_days||"—"}</td>
              {mks.map(mk=>{
                const v=r.monthly[mk];
                return<td key={mk} className={"mf2-td-num mf2-td-active"}>
                  {v&&Number(v)!==0?Number(v).toLocaleString("en-MY",{minimumFractionDigits:2,maximumFractionDigits:2}):<span className="mf2-td-dash">-</span>}
                </td>;
              })}
            </tr>
          ))}
          <tr className="mf2-tr-total">
            <td className="mf2-td-fix" colSpan={2}>Total</td>
            <td className="mf2-td-fix" style={{left:230,textAlign:"right",paddingRight:10}}>—</td>
            {mks.map(mk=><td key={mk} className="mf2-td-num mf2-td-active" style={{fontWeight:700}}>
              {totals[mk]>0?totals[mk].toLocaleString("en-MY",{minimumFractionDigits:2,maximumFractionDigits:2}):<span className="mf2-td-dash">-</span>}
            </td>)}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
