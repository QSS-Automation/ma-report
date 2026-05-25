import React,{useState,useCallback,useRef,useEffect} from "react";
import {useMonthPicker} from "../../hooks/useMonthPicker";
import MonthPicker from "../Shared/MonthPicker";
import LockModal from "../Shared/LockModal";
import UnlockModal from "../Shared/UnlockModal";
import TaskModal from "../Shared/TaskModal";
import {getSales,getPurchases,saveSplits,saveManualLine,lockPeriod} from "../../services/api";
import {fmtMYR,fmtMYRK,fmtDateShort,MN,pad2} from "../../utils/fmt";
import {showToast} from "../../utils/toast";

const FETCH={sales:getSales,pur:getPurchases};

export default function InvoiceTab({tab, entity = "QM", setEntity, entities = []}){
  const now=new Date();
  const mp=useMonthPicker(now.getFullYear(),now.getMonth(),now.getFullYear(),now.getMonth());
  const [preset,setPreset]=useState("tm");
  const [invoices,setInvoices]=useState([]);
  const [loading,setLoading]=useState(false);
  const [lockedPeriods,setLockedPeriods]=useState([]);
  const [lockModal,setLockModal]=useState(false);
  const [unlockModal,setUnlockModal]=useState({open:false,invNo:""});
  const [taskModal,setTaskModal]=useState(false);
  const [newLineOpen,setNewLineOpen]=useState(false);
  const [search,setSearch]=useState("");
  const [splitState,setSplitState]=useState({});
  const [expanded, setExpanded] = useState({});
  const toggleExpand = (sk) => setExpanded(p => ({...p, [sk]: !p[sk]}));
  const [rowState, setRowState] = useState({});
  const updateRow = (sk, key, val) =>
    setRowState(p => ({ ...p, [sk]: { ...p[sk], [key]: val } }));
  const getRow = (sk, key, fallback="") =>
    rowState[sk]?.[key] ?? fallback;
  const newLineRef=useRef({});
  const thRefs = useRef({});
  const startResize = (e, key) => {
  e.preventDefault();
  const th = thRefs.current[key];
  const startX = e.clientX;
  const startW = th.offsetWidth;
  const onMove = (ev) => { th.style.width = Math.max(40, startW + ev.clientX - startX) + "px"; };
  const onUp   = () => { document.removeEventListener("mousemove", onMove); document.removeEventListener("mouseup", onUp); };
  document.addEventListener("mousemove", onMove);
  document.addEventListener("mouseup", onUp);
};
  useEffect(() => { setInvoices([]); }, [entity]);
  const run=useCallback(async()=>{
    setLoading(true);
    try{
      const res=await FETCH[tab](entity, mp.fromStr,mp.toStr);
      setInvoices(res.data.invoices||[]);
    }catch(e){showToast("⚠ "+e.message);}
    finally{setLoading(false);}
  },[tab,entity,mp.fromStr,mp.toStr]);

  const isLocked=d=>{const ym=d.slice(0,7);return lockedPeriods.includes(ym);};

  // KPIs
  let totNet=0,totPS=0,totLIC=0,totUnc=0,cntUnc=0;
  invoices.forEach(inv=>{
    const n=Number(inv.amount); totNet+=n;
    if(inv.splits&&inv.splits.length){
      // invoice has splits — sum each split line by category
      inv.splits.forEach(s=>{
        if(s.category==="PS") totPS+=Number(s.split_amount);
        else if(s.category==="LIC") totLIC+=Number(s.split_amount);
      });
    } else {
      // no splits — use category field directly from API if present
      const cat=inv.category||inv._cat||"";
      if(cat==="PS") totPS+=n;
      else if(cat==="LIC") totLIC+=n;
      else { totUnc+=n; cntUnc++; }
    }
  });

  const filtered=search?invoices.filter(inv=>JSON.stringify(inv).toLowerCase().includes(search.toLowerCase())):invoices;

  const openSplit=(sk)=>{
    setSplitState(p=>({...p,[sk]:{lines:[{cat:"PS",amt:"",sd:"",ed:""},{cat:"LIC",amt:"",sd:"",ed:""}]}}));
  };
  const addSplitLine=(sk)=>{
    setSplitState(p=>({...p,[sk]:{lines:[...(p[sk]?.lines||[]),{cat:"PS",amt:"",sd:"",ed:""}]}}));
  };
  const removeSplitLine=(sk,idx)=>{
    setSplitState(p=>{const lines=[...(p[sk]?.lines||[])];lines.splice(idx,1);return{...p,[sk]:{lines}};});
  };
  const updateSplitLine=(sk,idx,key,val)=>{
    setSplitState(p=>{const lines=[...(p[sk]?.lines||[])];lines[idx]={...lines[idx],[key]:val};return{...p,[sk]:{lines}};});
  };
  const saveSplit_=async(sk,invAmt)=>{
    const lines=splitState[sk]?.lines||[];
    const total=lines.reduce((s,l)=>s+(parseFloat(l.amt)||0),0);
    if(Math.abs(total-invAmt)>=1){showToast("⚠ Amounts must sum to "+fmtMYR(invAmt));return;}
    try{
      await saveSplits({source_key:sk,journal_type:tab==="sales"?"SALES":"PURCHASE",user:"user",
        splits:lines.map(l=>({category:l.cat,split_amount:parseFloat(l.amt)||0,
          start_date:l.sd||null,end_date:l.ed||null}))});
      showToast("✓ Split saved"); setSplitState(p=>{const n={...p};delete n[sk];return n;}); run();
    }catch(e){showToast("⚠ "+e.message);}
  };

  const saveNoSplit = async (sk, invAmt) => {
  const rs = rowState[sk] || {};
  if (!rs.sd || !rs.ed) { showToast("⚠ Please enter Start Date and End Date"); return; }
  try {
    await saveSplits({
      source_key: sk,
      journal_type: tab === "sales" ? "SALES" : "PURCHASE",
      user: user.user_id,
      entity: entity,
      splits: [{
        category: null,
        split_amount: parseFloat(invAmt) || 0,
        start_date: rs.sd || null,
        end_date: rs.ed || null,
        end_user: rs.eu || null,
      }]
    });
    showToast("✓ Saved"); run();
  } catch(e) { showToast("⚠ " + e.message); }
  };


  const handleLock=async(period)=>{
    setLockModal(false);
    try{
      const r=await lockPeriod({journal_type:tab==="sales"?"SALES":"PURCHASE",lock_year_month:period,user:user.user_id, entity:entity});
      if(r.data.status==="ok"){setLockedPeriods(p=>[...new Set([...p,period])]);showToast("🔒 "+period+" locked");}
    }catch(e){showToast("⚠ "+e.message);}
  };

  const handleNewLine=async()=>{
    const f=newLineRef.current;
    try{
      await saveManualLine({journal_type:tab==="sales"?"SALES":"PURCHASE",
        trans_date:f.date||new Date().toISOString().slice(0,10),
        de_acc_desc:f.deAcc||"",proj_no:f.proj||"",ref_no1:f.ref||"",
        description:f.desc||"",home_dr:parseFloat(f.hdr)||0,home_cr:parseFloat(f.hcr)||0,
        split_amount:parseFloat(f.hdr)||0,category:f.cat||null,
        start_date:f.sd||null,end_date:f.ed||null,remark:f.rm||"",user:"user"});
      setNewLineOpen(false); showToast("✓ New deferred line saved"); run();
    }catch(e){showToast("⚠ "+e.message);}
  };

  const isSales=tab==="sales";
  const noun=isSales?"Sales":"Purchases";
  const periodLbl=mp.fromLabel==mp.toLabel?mp.fromLabel:mp.fromLabel+"–"+mp.toLabel;
  const exportCSV = () => {
  if (!invoices.length) { showToast("⚠ No data to export."); return; }
  const headers = ["Date","DE Acc Desc","Project Code","Ref 1","Ref 2","Description","Home DR","Home CR","Amount","Type","End User","Start Date","End Date","Days"];
  const rows = invoices.flatMap(inv => {
    if (inv.splits && inv.splits.length) {
      return inv.splits.map(s => [
        inv.trans_date, inv.de_acc_desc, inv.proj_no,
        inv.ref_no1, inv.ref_no2, inv.description,
        inv.home_dr, inv.home_cr, s.split_amount,
        s.category || "—", s.end_user || "—",
        s.start_date || "—", s.end_date || "—",
        s.total_days || "—"
      ]);
    }
    return [[
      inv.trans_date, inv.de_acc_desc, inv.proj_no,
      inv.ref_no1, inv.ref_no2, inv.description,
      inv.home_dr, inv.home_cr, inv.amount,
      "—","—","—","—","—"
    ]];
  });
  const csv = [headers, ...rows]
    .map(r => r.map(v => `"${String(v ?? "").replace(/"/g,'""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `${isSales ? "sales" : "purchases"}_${mp.fromStr}_${mp.toStr}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};
  return(
    <div style={{display:"flex",flexDirection:"column",flex:1,overflow:"hidden",minHeight:0}}>
      <div className="pg-hdr">
        <div className="pg-title">
          {isSales?<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#185FA5" strokeWidth="1.5"><rect x="1" y="9" width="14" height="5" rx="1.5"/><path d="M8 1v8M5.5 6l2.5 3 2.5-3"/></svg>
                  :<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#185FA5" strokeWidth="1.5"><rect x="1" y="9" width="14" height="5" rx="1.5"/><path d="M8 7V1M5.5 4l2.5-3 2.5 3"/></svg>}
          {noun} <span className="pg-badge">{entity} · {periodLbl}</span>
        </div>
        <div className="pg-actions"><button className="pg-btn" onClick={() => exportCSV()}>Export CSV</button></div>
      </div>

      <div className="filter">
        <span className="f-lbl">Entity</span>
            <select className="f-sel" value={entity} onChange={e => { setEntity(e.target.value); setInvoices([]); }}>
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
        <button className="run" onClick={run} disabled={loading}>{loading?"Loading…":"Run"}</button>
      </div>

      <div className="lock-bar">
        <span className="lock-bar-label">Period lock</span>
        <div className="lk-pills">
          {lockedPeriods.filter(ym=>{
            const [y,m]=ym.split("-");
            const from=mp.fromStr.slice(0,7),to=mp.toStr.slice(0,7);
            return ym>=from&&ym<=to;
          }).map(ym=>(
            <span key={ym} className="lk-pill locked">🔒 {MN[parseInt(ym.split("-")[1])-1]} {ym.split("-")[0]} — locked</span>
          ))}
        </div>
        <button className="btn-lock-period" onClick={()=>setLockModal(true)}>
          <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="7" width="10" height="8" rx="1.5"/><path d="M5 7V5a3 3 0 0 1 6 0v2"/></svg>
          Lock period
        </button>
      </div>

      {lockedPeriods.some(ym=>ym>=mp.fromStr.slice(0,7)&&ym<=mp.toStr.slice(0,7))&&(
        <div className="locked-banner">
          <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="#E24B4A" strokeWidth="1.5"><rect x="3" y="7" width="10" height="8" rx="1.5"/><path d="M5 7V5a3 3 0 0 1 6 0v2"/></svg>
          <strong>Period is locked.</strong>&nbsp;All invoices are read-only. Submit an unlock request to edit.
        </div>
      )}

      <div style={{padding:"14px 18px",flexShrink:0,background:"#fff",borderBottom:"1px solid #e8e7e0"}}>
        <div className="kpi-row" style={{marginBottom:0}}>
          <div className="kpi"><div className="kpi-lbl">Total {noun}</div><div className="kpi-val b">{fmtMYR(Math.abs(totNet))}</div><div className="kpi-sub">{invoices.length} invoices · {periodLbl}</div></div>
          <div className="kpi"><div className="kpi-lbl">Professional Services</div><div className="kpi-val g">{fmtMYR(Math.abs(totPS))}</div><div className="kpi-sub">{totNet?((totPS/totNet)*100).toFixed(1)+"% of total":""}</div></div>
          <div className="kpi"><div className="kpi-lbl">Licence</div><div className="kpi-val a">{fmtMYR(Math.abs(totLIC))}</div><div className="kpi-sub">{totNet?((totLIC/totNet)*100).toFixed(1)+"% of total":""}</div></div>
          <div className="kpi"><div className="kpi-lbl">Uncategorised</div><div className="kpi-val" style={{color:"#888780"}}>{fmtMYR(Math.abs(totUnc))}</div><div className="kpi-sub">{cntUnc} invoices</div></div>
        </div>
      </div>

      <div className="content">
        <div style={{background:"#FFF8E6",border:"1px solid #F5C97A",borderRadius:8,padding:"8px 14px",fontSize:11,color:"#7A5500",marginBottom:12,display:"flex",alignItems:"center",gap:8}}>
          <strong>MFRS dates</strong> — enter Start Date and End Date on each line to enable automatic recognition.
        </div>
        <div className="card">
          <div className="card-hdr">
            <div className="card-title">{noun} invoices · {periodLbl} · QM</div>
            <input className="search" placeholder={`Search ${isSales?"customer":"supplier"}, invoice…`} value={search} onChange={e=>setSearch(e.target.value)}/>
          </div>
          <div style={{overflowX:"auto"}}>
            <table className="tv-resizable" style={{tableLayout:"fixed", width:"max-content", minWidth:"100%"}}>
              <thead><tr>
                  <th ref={el=>thRefs.current["date"]=el} style={{minWidth:70,position:"relative"}}>Date<span className="resize-handle" onMouseDown={e=>startResize(e,"date")}/></th>
                <th ref={el=>thRefs.current["deacc"]=el} style={{minWidth:130,position:"relative"}}>DE Acc. Desc.<span className="resize-handle" onMouseDown={e=>startResize(e,"deacc")}/></th>
                <th ref={el=>thRefs.current["proj"]=el} style={{minWidth:110,position:"relative"}}>Project Code<span className="resize-handle" onMouseDown={e=>startResize(e,"proj")}/></th>
                <th ref={el=>thRefs.current["ref1"]=el} style={{minWidth:110,position:"relative"}}>Ref. 1<span className="resize-handle" onMouseDown={e=>startResize(e,"ref1")}/></th>
                {!isSales&&<th ref={el=>thRefs.current["ref2"]=el} style={{minWidth:100,position:"relative"}}>Ref. 2<span className="resize-handle" onMouseDown={e=>startResize(e,"ref2")}/></th>}
                <th ref={el=>thRefs.current["desc"]=el} style={{minWidth:160,position:"relative"}}>Desc.<span className="resize-handle" onMouseDown={e=>startResize(e,"desc")}/></th>
                <th ref={el=>thRefs.current["hdr"]=el} className="tr" style={{minWidth:100,position:"relative"}}>Home DR<span className="resize-handle" onMouseDown={e=>startResize(e,"hdr")}/></th>
                <th ref={el=>thRefs.current["hcr"]=el} className="tr" style={{minWidth:100,position:"relative"}}>Home CR<span className="resize-handle" onMouseDown={e=>startResize(e,"hcr")}/></th>
                <th ref={el=>thRefs.current["amt"]=el} className="tr" style={{minWidth:100,position:"relative"}}>Amount<span className="resize-handle" onMouseDown={e=>startResize(e,"amt")}/></th>
                <th ref={el=>thRefs.current["type"]=el} style={{minWidth:110,position:"relative"}}>Type<span className="resize-handle" onMouseDown={e=>startResize(e,"type")}/></th>
                <th ref={el=>thRefs.current["eu"]=el} style={{minWidth:100,position:"relative"}}>End User<span className="resize-handle" onMouseDown={e=>startResize(e,"eu")}/></th>
                <th ref={el=>thRefs.current["sd"]=el} style={{minWidth:96,position:"relative"}}>Start Date<span className="resize-handle" onMouseDown={e=>startResize(e,"sd")}/></th>
                <th ref={el=>thRefs.current["ed"]=el} style={{minWidth:96,position:"relative"}}>End Date<span className="resize-handle" onMouseDown={e=>startResize(e,"ed")}/></th>
                <th ref={el=>thRefs.current["days"]=el} className="tr" style={{minWidth:60,position:"relative"}}>Days<span className="resize-handle" onMouseDown={e=>startResize(e,"days")}/></th>
                <th ref={el=>thRefs.current["action"]=el} style={{minWidth:120,position:"relative"}}>Action<span className="resize-handle" onMouseDown={e=>startResize(e,"action")}/></th>
                </tr></thead>
              <tbody>
                {filtered.map(inv=>{
                  const locked=isLocked(inv.trans_date);
                  const hasSplit=inv.splits&&inv.splits.length>0;
                  const inDraft=splitState[inv.source_key];
                  const hdr=Number(inv.home_dr),hcr=Number(inv.home_cr),amt=Number(inv.amount);
                  let typeBdg;
                  if(hasSplit) typeBdg=<span className="bdg bdg-split" style={{cursor:"pointer"}} onClick={()=>toggleExpand(inv.source_key)}>
                    Split {expanded[inv.source_key] ? "▲" : "▼"}
                  </span>;  
                  else if(inv._cat==="PS") typeBdg=<span className="bdg bdg-ps">PS</span>;
                  else if(inv._cat==="LIC") typeBdg=<span className="bdg bdg-lic">LIC</span>;
                  else typeBdg=locked?<span className="bdg bdg-none">— Assign</span>
                    :<select className="cat-sel" onChange={e=>{inv._cat=e.target.value;}}>
                      <option value="">— Assign</option><option value="PS">PS</option><option value="LIC">LIC</option><option value="HW">HW</option><option value="AMS">AMS</option>
                    </select>;

                  return(
                    <React.Fragment key={inv.source_key}>
                      <tr className={"row-hover"+(locked?" row-locked":"")}>
                        <td className="muted">{fmtDateShort(inv.trans_date)}</td>
                        <td className="muted" style={{maxWidth:130,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{inv.de_acc_desc||"—"}</td>
                        <td className="mono" style={{fontSize:11}}>{inv.proj_no||"—"}</td>
                        <td className="mono">{locked?<>🔒 {inv.ref_no1}</>:<span style={{color:"#185FA5"}}>{inv.ref_no1||"—"}</span>}</td>
                        {!isSales&&<td className="mono muted" style={{fontSize:11}}>{inv.ref_no2||"—"}</td>}
                        <td className="muted" style={{maxWidth:130,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{inv.description||"—"}</td>
                        <td className={"tr mono"+(hasSplit?" strike muted":"")}>{fmtMYR(hdr)}</td>
                        <td className="tr mono muted">{fmtMYR(hcr)}</td>
                        <td className="tr mono">{fmtMYR(amt)}</td>
                        <td>{typeBdg}</td>
                        <td>
                            {hasSplit ? <span className="muted">—</span> :
                              <input type="text" className="f-date" value={getRow(inv.source_key,"eu")}
                                readOnly={locked} placeholder="End user"
                                onChange={e=>updateRow(inv.source_key,"eu",e.target.value)}
                                style={{width:90,fontSize:11,padding:"3px 5px"}}/>}
                        </td>
                        <td>
                        <input type="date" className="f-date"
                          value={getRow(inv.source_key,"sd")}
                          readOnly={locked||hasSplit}
                          onChange={e=>updateRow(inv.source_key,"sd",e.target.value)}
                          style={{width:96,fontSize:11,padding:"3px 5px",borderColor:hasSplit?"#e8e7e0":"#85B7EB"}}/>
                      </td>
                      <td>
                        <input type="date" className="f-date"
                          value={getRow(inv.source_key,"ed")}
                          readOnly={locked||hasSplit}
                          onChange={e=>updateRow(inv.source_key,"ed",e.target.value)}
                          style={{width:96,fontSize:11,padding:"3px 5px",borderColor:hasSplit?"#e8e7e0":"#85B7EB"}}/>
                      </td>
                      <td className="tr mono muted">
                        {(()=>{
                          const sd=getRow(inv.source_key,"sd"), ed=getRow(inv.source_key,"ed");
                          return sd&&ed ? Math.round((new Date(ed)-new Date(sd))/86400000)+1 : "—";
                        })()}
                      </td>
                        <td style={{whiteSpace:"nowrap"}}>
                            {locked
                              ? <button className="btn-unlock-req" onClick={()=>setUnlockModal({open:true,invNo:inv.ref_no1||"#"+inv.source_key})}>🔓 Request unlock</button>
                              : !hasSplit&&!inDraft
                                ? <span style={{display:"flex",gap:4}}>
                                    <button className="btn-save" onClick={()=>saveNoSplit(inv.source_key,amt)}>Save</button>
                                    <button className="btn-split" onClick={()=>openSplit(inv.source_key)}>＋ Split</button>
                                  </span>
                                : <span/>}
                          </td>
                      </tr>

                      {/* Existing splits */}
                      {hasSplit&&expanded[inv.source_key]&&inv.splits.map((line,li)=>(
                        <tr key={li} className={"row-split"+(locked?" row-split-locked":"")}>
                          <td colSpan={isSales?4:5}></td>
                          <td colSpan={2}>
                            <div style={{display:"flex",alignItems:"center",gap:6,paddingLeft:12}}>
                              <div style={{width:2,height:34,background:locked?"#F09595":"#85B7EB",flexShrink:0,marginRight:6,borderRadius:1}}></div>
                              <div>
                                <span className={line.category==="LIC"?"bdg bdg-lic":"bdg bdg-ps"}>{line.category||"—"}</span>
                                <div style={{fontSize:9,color:locked?"#c0392b":"#888780",marginTop:3}}>{locked?"🔒 Locked":"MFRS recognition period"}</div>
                              </div>
                            </div>
                          </td>
                          <td></td>
                          <td className="tr mono" style={{color:line.category==="LIC"?"#3C3489":"#0C447C"}}>{fmtMYR(Number(line.split_amount))}</td>
                          <td><span className={line.category==="LIC"?"bdg bdg-lic":"bdg bdg-ps"}>{line.category||"—"}</span></td>
                          <td></td>
                          <td><input type="date" className="f-date" defaultValue={line.start_date||""} readOnly={locked} style={{width:96,fontSize:11,padding:"3px 5px"}}/></td>
                          <td><input type="date" className="f-date" defaultValue={line.end_date||""} readOnly={locked} style={{width:96,fontSize:11,padding:"3px 5px"}}/></td>
                          <td className="tr mono muted">{line.total_days||"—"}</td>
                          <td></td>
                        </tr>
                      ))}
                      {hasSplit&&expanded[inv.source_key]&&(
                        <tr className={"row-addsplit"+(locked?" row-addsplit-locked":"")}>
                          <td colSpan={isSales?13:14} style={{textAlign:"right"}}>
                            <span className="val-ok">✓ {inv.splits.map(l=>fmtMYR(Number(l.split_amount))).join(" + ")} = {fmtMYR(amt)}</span>
                          </td>
                          <td></td>
                        </tr>
                      )}

                      {/* Draft split UI */}
                      {inDraft&&inDraft.lines.map((line,li)=>{
                        const tDays=line.sd&&line.ed?Math.round((new Date(line.ed)-new Date(line.sd))/86400000)+1:"";
                        return(
                          <tr key={"d"+li} className="row-split">
                            <td colSpan={isSales?4:5}></td>
                            <td colSpan={2}>
                              <div style={{display:"flex",alignItems:"center",gap:6,paddingLeft:12}}>
                                <div style={{width:2,height:34,background:"#85B7EB",flexShrink:0,marginRight:6,borderRadius:1}}></div>
                                <select className="cat-sel" value={line.cat} onChange={e=>updateSplitLine(inv.source_key,li,"cat",e.target.value)}>
                                  <option value="PS">PS</option><option value="LIC">LIC</option><option value="HW">HW</option><option value="AMS">AMS</option>
                                </select>
                              </div>
                            </td>
                            <td></td>
                            <td className="tr"><input type="text" className="split-amt-inp" value={line.amt} onChange={e=>updateSplitLine(inv.source_key,li,"amt",e.target.value)} placeholder="0"/></td>
                            <td><span className={line.cat==="LIC"?"bdg bdg-lic":"bdg bdg-ps"}>{line.cat}</span></td>
                            <td></td>
                            <td><input type="date" className="f-date" value={line.sd} onChange={e=>updateSplitLine(inv.source_key,li,"sd",e.target.value)} style={{width:96,fontSize:11,padding:"3px 5px",borderColor:"#85B7EB"}}/></td>
                            <td><input type="date" className="f-date" value={line.ed} onChange={e=>updateSplitLine(inv.source_key,li,"ed",e.target.value)} style={{width:96,fontSize:11,padding:"3px 5px",borderColor:"#85B7EB"}}/></td>
                            <td className="tr mono muted">{tDays||"—"}</td>
                            <td><button className="btn-del" onClick={()=>removeSplitLine(inv.source_key,li)}>✕</button></td>
                          </tr>
                        );
                      })}
                      {inDraft&&(()=>{
                        const total=inDraft.lines.reduce((s,l)=>s+(parseFloat(l.amt)||0),0);
                        const valid=Math.abs(total-amt)<1;
                        return(
                          <tr className="row-addsplit">
                            <td colSpan={isSales?11:12} style={{textAlign:"right"}}>
                              {valid?<span className="val-ok">✓ {fmtMYR(total)} = {fmtMYR(amt)}</span>
                                :<span className="val-warn">⚠ {fmtMYR(total)} / {fmtMYR(amt)}</span>}
                              &nbsp;&nbsp;
                              <button className="btn-add" onClick={()=>addSplitLine(inv.source_key)}>+ Add line</button>
                            </td>
                            <td colSpan={2} style={{textAlign:"right",whiteSpace:"nowrap"}}>
                              <button className="btn-save" onClick={()=>saveSplit_(inv.source_key,amt)} style={{marginRight:4}}>Save split</button>
                              <button className="btn-del" onClick={()=>setSplitState(p=>{const n={...p};delete n[inv.source_key];return n;})}>Cancel</button>
                            </td>
                          </tr>
                        );
                      })()}
                    </React.Fragment>
                  );
                })}
                {filtered.length===0&&(
                  <tr><td colSpan={isSales?14:15} style={{textAlign:"center",padding:24,color:"#888780"}}>
                    {invoices.length===0?"No invoices found. Select a period and click Run.":"No results match your search."}
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="tbl-foot">
            <div style={{display:"flex",gap:10,alignItems:"center"}}>
              <div className="foot-dot" style={{background:"#185FA5"}}></div><span>PS: <strong>{fmtMYR(totPS)}</strong></span>
              <div className="foot-dot" style={{background:"#7F77DD"}}></div><span>Licence: <strong>{fmtMYR(totLIC)}</strong></span>
              <div className="foot-dot" style={{background:"#e8e7e0"}}></div><span>Uncategorised: <strong>{fmtMYR(totUnc)}</strong></span>
            </div>
            <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:10}}>
              <button className="btn-newline" onClick={()=>setNewLineOpen(true)}>
                <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 3v10M3 8h10"/></svg>
                New {isSales?"sales":"purchase"} adjustment line
              </button>
              <button className="btn-newtask" onClick={()=>setTaskModal(true)}>
                <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="10" height="10" rx="1.5"/><path d="M6 8h4M8 6v4"/></svg>
                New task
              </button>
            </div>
          </div>
        </div>

        {/* New deferred line form */}
        {newLineOpen&&(
          <table style={{width:"100%",marginTop:-12}}>
            <tbody>
              <tr className="new-line-row">
                <td><span className="new-line-lbl">Date</span><input type="date" onChange={e=>{newLineRef.current.date=e.target.value;}}/></td>
                <td><span className="new-line-lbl">DE Acc. Desc.</span><input type="text" placeholder="Account description" style={{width:120}} onChange={e=>{newLineRef.current.deAcc=e.target.value;}}/></td>
                <td><span className="new-line-lbl">Project Code</span><input type="text" placeholder="PRJ-001" style={{width:90}} onChange={e=>{newLineRef.current.proj=e.target.value;}}/></td>
                <td><span className="new-line-lbl">Ref. 1</span><input type="text" placeholder="Ref no." style={{width:90}} onChange={e=>{newLineRef.current.ref=e.target.value;}}/></td>
                {!isSales&&<td><span className="new-line-lbl">Ref. 2</span><input type="text" placeholder="Ref no." style={{width:90}} onChange={e=>{newLineRef.current.ref2=e.target.value;}}/></td>}
                <td><span className="new-line-lbl">Desc.</span><input type="text" placeholder="Description" onChange={e=>{newLineRef.current.desc=e.target.value;}}/></td>
                <td><span className="new-line-lbl">Home DR</span><input type="text" placeholder="0.00" style={{width:80,textAlign:"right"}} onChange={e=>{newLineRef.current.hdr=e.target.value;}}/></td>
                <td><span className="new-line-lbl">Home CR</span><input type="text" placeholder="0.00" style={{width:80,textAlign:"right"}} onChange={e=>{newLineRef.current.hcr=e.target.value;}}/></td>
                <td><span className="new-line-lbl">Amount</span><input type="text" placeholder="0.00" style={{width:80,textAlign:"right"}} readOnly/></td>
                <td><span className="new-line-lbl">Type</span>
                  <select onChange={e=>{newLineRef.current.cat=e.target.value;}}><option value="PS">PS</option><option value="LIC">LIC</option><option value="HW">HW</option><option value="AMS">AMS</option></select>
                </td>
                <td><span className="new-line-lbl">End User</span><input type="text" placeholder="End user" style={{width:100}} onChange={e=>{newLineRef.current.eu=e.target.value;}}/></td>
                <td><span className="new-line-lbl">Start Date</span><input type="date" onChange={e=>{newLineRef.current.sd=e.target.value;}}/></td>
                <td><span className="new-line-lbl">End Date</span><input type="date" onChange={e=>{newLineRef.current.ed=e.target.value;}}/></td>
                <td><span className="new-line-lbl">Days</span><input type="text" placeholder="—" style={{width:60,textAlign:"right"}} readOnly/></td>
                <td style={{whiteSpace:"nowrap",verticalAlign:"bottom"}}>
                  <span className="new-line-lbl" style={{display:"block",marginBottom:2}}>Remark</span>
                  <input type="text" placeholder="Optional…" style={{width:110,fontSize:11,border:"1px solid #e8e7e0",borderRadius:4,padding:"3px 6px",marginBottom:3,display:"block"}} onChange={e=>{newLineRef.current.rm=e.target.value;}}/>
                  <button className="btn-save" onClick={handleNewLine} style={{marginRight:4}}>Save</button>
                  <button className="btn-del" onClick={()=>setNewLineOpen(false)}>✕</button>
                </td>
              </tr>
            </tbody>
          </table>
        )}
      </div>

      <LockModal open={lockModal} onClose={()=>setLockModal(false)} onConfirm={handleLock}/>
      <UnlockModal open={unlockModal.open} invNo={unlockModal.invNo}
        onClose={()=>setUnlockModal({open:false,invNo:""})}
        onSubmit={()=>{setUnlockModal({open:false,invNo:""});showToast("🔓 Unlock request submitted.");}}/>
      <TaskModal open={taskModal} defaultSrc={tab} onClose={()=>setTaskModal(false)}
        onSave={()=>{setTaskModal(false);showToast("✓ Task created.");}}/>
    </div>
  );
}
