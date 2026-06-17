import React,{useState, useEffect} from "react";
import { useAuth } from "../../context/AuthContext";
import { getLog } from "../../services/api";

const SAMPLE=[
  {ts:"03 Jan 2025 14:22",user:"Ahmad Razif",type:"split",tab:"sales",ref:"INV-2025-001",detail:"Split PS 200,000 + LIC 120,000. Contract 2026-01-15 → 2027-01-14",period:"Jan 2025"},
  {ts:"05 Jan 2025 09:14",user:"Farah Nadia",type:"split",tab:"pur",ref:"SUP-2025-041",detail:"Split PS 300,000 + LIC 150,000. Contract 2025-12-01 → 2026-11-30",period:"Jan 2025"},
  {ts:"07 Jan 2025 11:03",user:"Ahmad Razif",type:"edit",tab:"sales",ref:"INV-2025-002",detail:"Category changed: Unassigned → PS. Start 2025-01-07, End 2025-12-31",period:"Jan 2025"},
  {ts:"28 Jan 2025 09:00",user:"Finance Manager",type:"newline",tab:"sales",ref:"DR-2025-001",detail:"New deferred revenue line. LIC 480,000. Contract 2025-02-01 → 2026-01-31",period:"Jan 2025"},
];
const BADGE={split:"log-split",newline:"log-newline",edit:"log-edit",unlock:"log-unlock"};
const LABEL={split:"SPLIT",newline:"NEW LINE",edit:"EDIT",unlock:"UNLOCK REQ"};

export default function AdjLog({ entity = "QM", entities = [] }) {
 const { user } = useAuth();
  const [rows, setRows] = useState([]);

  useEffect(() => {
    if (!user) return;
    getLog(entity || "QM", user.role, user.user_id,  fromDate, toDate)
      .then(r => setRows(r.data))
      .catch(() => setRows([]));
  }, [entity, user?.user_id,fromDate, toDate]);
  const [type,setType]=useState("all");
  const [fEntity, setFEntity] = useState("all");
  const [tab,setTab]=useState("all");
  const now=new Date();
  const [fromDate,setFromDate]=useState(now.getFullYear()+"-"+String(now.getMonth()+1).padStart(2,"0")+"-01");
  const [toDate,setToDate]=useState(now.getFullYear()+"-12-31");
  const filtered=rows.filter(r=>
    (type==="all"||r.action_type===type||r.type===type) &&
    (tab==="all"||r.journal_type===tab||r.tab===tab) &&
    (fEntity==="all"||r.entity===fEntity) &&
    (!r.ts||(r.ts>=fromDate&&r.ts<=toDate+"\uffff"))
  );
  return(
    <div style={{display:"flex",flexDirection:"column",flex:1,overflow:"hidden",minHeight:0}}>
      <div className="pg-hdr">
        <div className="pg-title">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="#185FA5" strokeWidth="1.5"><rect x="2" y="2" width="12" height="12" rx="1.5"/><path d="M5 6h6M5 9h4"/></svg>
          Adjustment Log <span className="pg-badge">All activity</span>
        </div>
        <div className="pg-actions"><button className="pg-btn">Export CSV</button></div>
      </div>
      <div className="filter">
        <span className="f-lbl">Entity</span>
          <select className="f-sel" value={fEntity} onChange={e => setFEntity(e.target.value)}>
            <option value="all">All</option>
            {entities.map(e => <option key={e.entity_code} value={e.entity_code}>{e.entity_code}</option>)}
          </select>
          <div className="f-div"/>
        <span className="f-lbl">Type</span>
        <select className="f-sel" value={type} onChange={e=>setType(e.target.value)}>
          <option value="all">All</option><option value="split">Split</option>
          <option value="newline">New line</option><option value="edit">Edit</option><option value="unlock">Unlock req.</option>
        </select>
        <div className="f-div"/>
        <span className="f-lbl">Tab</span>
        <select className="f-sel" value={tab} onChange={e=>setTab(e.target.value)}>
          <option value="all">All</option><option value="sales">Sales</option><option value="pur">Purchases</option>
        </select>
        <div className="f-div"/>
        <span className="f-lbl">From</span><input type="date" className="f-date" value={fromDate} onChange={e=>setFromDate(e.target.value)}/>
        <span className="f-lbl">To</span><input type="date" className="f-date" value={toDate} onChange={e=>setToDate(e.target.value)}/>
      </div>
      <div className="content" style={{padding:0}}>
        <table style={{width:"100%",borderCollapse:"collapse"}}>
          <thead><tr style={{background:"#fafaf8"}}>
            {["Timestamp","User","Action","Tab","Invoice / Ref","Detail","Period"].map(h=>(
              <th key={h} style={{padding:"8px 12px",fontSize:9,fontWeight:700,color:"#888780",textTransform:"uppercase",borderBottom:"1px solid #e8e7e0",whiteSpace:"nowrap"}}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {filtered.map((r,i)=>(
              <tr key={i} className="log-row">
                <td>{r.ts}</td>
                <td>{r.user}</td>
                <td><span className={"log-badge "+BADGE[r.type]}>{LABEL[r.type]}</span></td>
                <td><span className={"bdg "+(r.tab==="sales"?"bdg-ps":"")} style={r.tab==="pur"?{fontSize:8,background:"#E8F5E9",color:"#1B5E20"}:{fontSize:8}}>{r.tab==="sales"?"Sales":"Purchases"}</span></td>
                <td style={{fontFamily:"Courier New,monospace",color:"#185FA5",fontSize:10}}>{r.ref}</td>
                <td style={{color:"#5f5e5a",maxWidth:300}}>{r.detail}</td>
                <td style={{color:"#888780",whiteSpace:"nowrap"}}>{r.period}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
