import React,{useState,useCallback,useRef,useEffect,useLayoutEffect} from "react";
import {Download,Lock,Unlock,Plus,ClipboardList,ExternalLink} from "lucide-react";
import {useMonthPicker} from "../../hooks/useMonthPicker";
import MonthPicker from "../Shared/MonthPicker";
import LockModal from "../Shared/LockModal";
import UnlockModal from "../Shared/UnlockModal";
import TaskModal from "../Shared/TaskModal";
import {getSales,getPurchases,saveSplits,saveManualLine,lockPeriod,getAccounts,createTask,getInvoiceFile} from "../../services/api";
import {fmtMYR,fmtDateShort} from "../../utils/fmt";
import {showToast} from "../../utils/toast";
import {useAuth} from "../../context/AuthContext";
import {Button} from "../ui/button";
import {Badge} from "../ui/badge";
import {Card} from "../ui/card";
import {PageHeader} from "../ui/page-header";
import {Input} from "../ui/input";
import {DateField} from "../ui/date-field";
import {RemarkField} from "../ui/remark-field";
import {FilterBar, FilterLabel} from "../ui/page-shell";
import {FilterPill} from "../ui/filter-pill";
import {Skeleton} from "../ui/skeleton";
import {cn} from "../../lib/utils";
import {DropdownPortal,ColumnMenu,HeaderMarks,monthKey} from "../Shared/ColumnFilter";


const FETCH={sales:getSales,pur:getPurchases};

function CatBadge({cat}){
  if(cat==="PS")  return <Badge variant="default">PS</Badge>;
  if(cat==="LIC") return <Badge className="bg-[#EEEDFE] text-[#3C3489]">LIC</Badge>;
  if(cat==="HW")  return <Badge variant="muted">HW</Badge>;
  if(cat==="AMS") return <Badge variant="success">AMS</Badge>;
  if(cat==="TRN") return <Badge variant="warning">TRN</Badge>;
  return <Badge variant="muted">{cat||"—"}</Badge>;
}

// The invoice table uses `table-layout: fixed` with an explicit pixel width
// (see sizeColumns in InvoiceTab) — that's what makes a header cell's width
// actually stick. So a resize has to grow/shrink the TABLE by the same
// amount as the column, otherwise the browser just redistributes the space.
function startResize(e,thRef){
  e.stopPropagation();
  e.preventDefault();
  const th=thRef.current;
  if(!th) return;
  const table=th.closest("table");
  const startX=e.clientX,startW=th.offsetWidth,startTW=table?table.offsetWidth:0;
  const onMove=ev=>{
    const w=Math.max(40,startW+ev.clientX-startX);
    th.style.width=w+"px";
    th.style.minWidth=w+"px";
    if(table) table.style.width=Math.max(startTW+(w-startW),table.parentElement.clientWidth)+"px";
  };
  const onUp=()=>{
    document.removeEventListener("mousemove",onMove);
    document.removeEventListener("mouseup",onUp);
  };
  document.addEventListener("mousemove",onMove);
  document.addEventListener("mouseup",onUp);
}

// Column filter kinds (see Shared/ColumnFilter): price columns filter by a
// min–max range, the Date column by month, every other column by value.
const PRICE_COLS=["home_dr","home_cr","amount"];
const colKind=col=>PRICE_COLS.includes(col)?"range":col==="trans_date"?"month":"text";

function ColHeader({label,col,minWidth=90,align="left",freezeLeft,freezeEdge=false,
                    sortKey,sortDir,colFilter,openMenu,
                    onSort,onFilter,onMenu,getUnique}){
  const thRef=useRef(null);
  const active=colFilter[col];
  const isOpen=openMenu===col;
  const isSorted=sortKey===col;
  const unique=isOpen?getUnique(col):[];
  return(
    <th ref={thRef} className={cn("relative select-none border-b border-border bg-card p-0", freezeLeft!=null&&"sticky z-30", freezeEdge&&FZ_EDGE)}
      data-minw={minWidth} style={{width:minWidth,minWidth,textAlign:align,...(freezeLeft!=null?{left:freezeLeft}:{})}}>
      <div className="flex cursor-pointer items-center gap-1 px-2.5 py-2.5"
        onMouseDown={e=>e.stopPropagation()}
        onClick={e=>{e.stopPropagation();onMenu(isOpen?null:col);}}>
        <span className="flex-1 whitespace-nowrap text-[12.5px] font-bold text-muted-foreground">
          {label}
        </span>
        <HeaderMarks isSorted={isSorted} sortDir={sortDir} active={active} isOpen={isOpen}/>
      </div>
      {isOpen&&(
        <DropdownPortal anchorRef={thRef} onClose={()=>onMenu(null)}>
          <ColumnMenu kind={colKind(col)} isSorted={isSorted} sortDir={sortDir} active={active} values={unique}
            onSort={dir=>onSort(col,dir)} onFilter={v=>onFilter(col,v)} onClose={()=>onMenu(null)}/>
        </DropdownPortal>
      )}
      <span className="resize-handle" onMouseDown={e=>startResize(e,thRef)}/>
    </th>
  );
}

function StaticTh({label,minWidth=90,align="left"}){
  const thRef=useRef(null);
  return(
    <th ref={thRef} className="relative whitespace-nowrap border-b border-border bg-card px-2.5 py-2.5 text-[12.5px] font-bold text-muted-foreground"
      data-minw={minWidth} style={{width:minWidth,minWidth,textAlign:align}}>
      {label}
      <span className="resize-handle" onMouseDown={e=>startResize(e,thRef)}/>
    </th>
  );
}

const CAT_OPTIONS = (
  <>
    <option value="">— Assign</option>
    <option value="PS">PS</option>
    <option value="LIC">LIC</option>
    <option value="HW">HW</option>
    <option value="AMS">AMS</option>
    <option value="TRN">Training</option>
  </>
);

// Sticky first column (Date) keeps row context visible while the wide
// invoice table scrolls horizontally. Each row background state below
// needs its own *opaque* approximation on the sticky cell (the row's own
// translucent tint, e.g. bg-destructive/10 or bg-accent/40, would let the
// scrolling columns underneath bleed through if reused as-is).
// Right-edge shadow on the last frozen column (Desc.), marking where the
// horizontally scrolling columns start.
const FZ_EDGE = "shadow-[6px_0_8px_-6px_rgba(0,0,0,0.18)]";
// Opaque stand-ins for the translucent split-row tints, for frozen cells.
const SPLIT_BG = "bg-[color-mix(in_srgb,hsl(var(--accent))_40%,hsl(var(--card)))]";
const SPLIT_LOCKED_BG = "bg-red-50 dark:bg-red-950";

const catSelCls = "h-6 rounded-md border border-primary/40 bg-card px-1.5 text-[12px]";
const newLineLblCls = "text-[10px] font-bold uppercase tracking-wide text-success/80";
const newLineInpCls = "h-6 rounded-md border border-success/40 bg-card px-1.5 text-[12px]";

const CAT_OPTIONS_NO_BLANK = (
  <>
    <option value="PS">PS</option>
    <option value="LIC">LIC</option>
    <option value="HW">HW</option>
    <option value="AMS">AMS</option>
    <option value="TRN">Training</option>
  </>
);

export default function InvoiceTab({tab,entity="QM"}){
  const {user}=useAuth();
  const now=new Date();
  const mp=useMonthPicker(now.getFullYear(),now.getMonth(),now.getFullYear(),now.getMonth());
  const [preset,setPreset]=useState("tm");
  const [invoices,setInvoices]=useState([]);
  const [loading,setLoading]=useState(false);
  const [lockedPeriods,setLockedPeriods]=useState([]);
  const [lockModal,setLockModal]=useState(false);
  const [unlockModal,setUnlockModal]=useState({open:false,invNo:"",sourceKey:null,journalType:""});
  const [taskModal,setTaskModal]=useState(false);
  const [newLineOpen,setNewLineOpen]=useState(false);
  const [newLineSaving,setNewLineSaving]=useState(false);
  const [search,setSearch]=useState("");
  const [sortKey,setSortKey]=useState("trans_date");
  const [sortDir,setSortDir]=useState("desc");
  const [colFilter,setColFilter]=useState({});
  const [openMenu,setOpenMenu]=useState(null);
  const [splitState,setSplitState]=useState({});
  const [expanded,setExpanded]=useState({});
  const [rowState,setRowState]=useState({});
  const [editState,setEditState]=useState({});
  const newLineRef=useRef({});
  const [accounts,setAccounts]=useState([]);
  const [deAccounts,setDeAccounts]=useState([]);
  useEffect(()=>{
      if(!newLineOpen) return;
      getAccounts(entity,tab==="sales"?"SALES":"PURCHASE")
          .then(res => {
              setAccounts(res.data.accounts || []);
              setDeAccounts(res.data.de_accounts || []);
          })
          .catch(()=>{});
  },[newLineOpen,entity,tab]);

  const toggleExpand=sk=>setExpanded(p=>({...p,[sk]:!p[sk]}));
  const updateRow=(sk,key,val)=>setRowState(p=>({...p,[sk]:{...p[sk],[key]:val}}));
  const getRow=(sk,key,fallback="")=>rowState[sk]?.[key]??fallback;

  const startEdit=(sk,split)=>setEditState(p=>({...p,[sk]:{
    cat: split.category||"",
    eu:  split.end_user||"",
    sd:  split.start_date||"",
    ed:  split.end_date||"",
    rm:  split.remark||"",
  }}));

  const startMultiEdit=(sk,splits)=>{
    setSplitState(p=>({...p,[sk]:{lines:splits.map(s=>({
      cat: s.category||"PS",
      amt: String(s.net_amount||""),
      sd:  s.start_date||"",
      ed:  s.end_date||"",
      rm:  s.remark||"",
    }))}}));
    setExpanded(p=>({...p,[sk]:true}));
  };

  const cancelEdit=sk=>setEditState(p=>{const n={...p};delete n[sk];return n;});
  const updateEdit=(sk,key,val)=>setEditState(p=>({...p,[sk]:{...p[sk],[key]:val}}));

  const run=useCallback(async()=>{
    setLoading(true);
    try{
      const res=await FETCH[tab](entity,mp.fromStr,mp.toStr);
      setInvoices(res.data.invoices||[]);
    }catch(e){showToast("⚠ "+e.message);}
    finally{setLoading(false);}
  },[tab,entity,mp.fromStr,mp.toStr]);

  // Run on first open and whenever the entity changes.
  useEffect(()=>{setInvoices([]);run();},[entity,tab]);

  const isLocked=d=>lockedPeriods.includes(d.slice(0,7));

  let totNet=0,totPS=0,totLIC=0,totHW=0,totAMS=0,totTRN=0,totUnc=0,cntUnc=0;
  invoices.forEach(inv=>{
    const n=Number(inv.amount);totNet+=n;
    if(inv.splits&&inv.splits.length){
      inv.splits.forEach(s=>{
        if(s.category==="PS")       totPS+=Number(s.net_amount);
        else if(s.category==="LIC") totLIC+=Number(s.net_amount);
        else if(s.category==="HW")  totHW+=Number(s.net_amount);
        else if(s.category==="AMS") totAMS+=Number(s.net_amount);
        else if(s.category==="TRN") totTRN+=Number(s.net_amount);
      });
    }else{
      const cat=inv.category||inv._cat||"";
      if(cat==="PS")       totPS+=n;
      else if(cat==="LIC") totLIC+=n;
      else if(cat==="HW")  totHW+=n;
      else if(cat==="AMS") totAMS+=n;
      else if(cat==="TRN") totTRN+=n;
      else{totUnc+=n;cntUnc++;}
    }
  });

  const handleSort=(key,dir)=>{setSortKey(key);setSortDir(dir);};
  const handleFilter=(col,val)=>setColFilter(p=>{
    const n={...p};
    if(val===null||(Array.isArray(val)&&!val.length))delete n[col];else n[col]=val;
    return n;
  });

  const COL_FIELD={
    trans_date:"trans_date",acc_no:"acc_no",acc_desc:"acc_desc",de_acc_desc:"de_acc_desc",
    proj_no:"proj_no",ref_no1:"ref_no1",ref_no2:"ref_no2",
    description:"description",home_dr:"home_dr",home_cr:"home_cr",amount:"amount",
    category:"category"
  };

  const getUnique=col=>{
    if(col==="category"){
      return[...new Set(invoices.flatMap(inv=>
        inv.splits&&inv.splits.length
          ?inv.splits.map(s=>s.category)
          :[inv.category]
      ).filter(v=>v!=null&&v!==""))].sort();
    }
    if(col==="trans_date"){
      return[...new Set(invoices.map(inv=>monthKey(inv.trans_date)).filter(Boolean))].sort();
    }
    const field=COL_FIELD[col]||col;
    if(PRICE_COLS.includes(col)){
      return invoices.map(inv=>Number(inv[field])||0).sort((a,b)=>a-b);
    }
    return[...new Set(invoices.map(inv=>inv[field]).filter(v=>v!=null&&v!==""))].sort();
  };

  const colFiltered=invoices.filter(inv=>
    Object.entries(colFilter).every(([col,val])=>{
      if(!val)return true;
      const field=COL_FIELD[col]||col;
      if(PRICE_COLS.includes(col)){
        const v=Number(inv[field])||0;
        if(val.min!==""&&val.min!=null&&v<Number(val.min))return false;
        if(val.max!==""&&val.max!=null&&v>Number(val.max))return false;
        return true;
      }
      if(!val.length)return true;
      if(col==="category"){
        if(inv.splits&&inv.splits.length)
          return inv.splits.some(s=>val.includes(s.category));
        return val.includes(inv.category||"");
      }
      if(col==="trans_date")return val.includes(monthKey(inv.trans_date));
      const s=String(inv[field]??"").toLowerCase();
      return val.some(x=>String(x).toLowerCase()===s);
    })
  );
  const searched=search
    ?colFiltered.filter(inv=>JSON.stringify(inv).toLowerCase().includes(search.toLowerCase()))
    :colFiltered;
  const filtered=[...searched].sort((a,b)=>{
    const field=COL_FIELD[sortKey]||sortKey;
    const va=a[field]??"",vb=b[field]??"";
    if(va<vb)return sortDir==="asc"?-1:1;
    if(va>vb)return sortDir==="asc"?1:-1;
    return 0;
  });

  const chProps={sortKey,sortDir,colFilter,openMenu,
    onSort:handleSort,onFilter:handleFilter,onMenu:setOpenMenu,getUnique};

  const openSplit=sk=>setSplitState(p=>({...p,[sk]:{lines:[
    {cat:"PS",amt:"",sd:"",ed:"",rm:""},
    {cat:"LIC",amt:"",sd:"",ed:"",rm:""}
  ]}}));
  const addSplitLine=sk=>setSplitState(p=>({...p,[sk]:{lines:[...(p[sk]?.lines||[]),{cat:"PS",amt:"",sd:"",ed:"",rm:""}]}}));
  const removeSplitLine=(sk,idx)=>setSplitState(p=>{
    const lines=[...(p[sk]?.lines||[])];lines.splice(idx,1);return{...p,[sk]:{lines}};
  });
  const updateSplitLine=(sk,idx,key,val)=>setSplitState(p=>{
    const lines=[...(p[sk]?.lines||[])];lines[idx]={...lines[idx],[key]:val};return{...p,[sk]:{lines}};
  });

  const saveSplit_=async(sk,invAmt)=>{
    const lines=splitState[sk]?.lines||[];
    const total=lines.reduce((s,l)=>s+(parseFloat(l.amt)||0),0);
    if(Math.abs(total-invAmt)>=1){showToast("⚠ Amounts must sum to "+fmtMYR(invAmt));return;}
    try{
      const res=await saveSplits({source_key:sk,journal_type:tab==="sales"?"SALES":"PURCHASE",
        user:user?.user_id||"user",entity,
        splits:lines.map(l=>({category:l.cat,split_amount:parseFloat(l.amt)||0,
          start_date:l.sd||null,end_date:l.ed||null,remark:l.rm||null}))});
      if(res.data.status==="error"){showToast("⚠ "+res.data.message);return;}
      showToast("✓ Split saved");
      setSplitState(p=>{const n={...p};delete n[sk];return n;});
      run();
    }catch(e){showToast("⚠ "+e.message);}
  };

  const saveNoSplit=async(sk,invAmt)=>{
    const rs=rowState[sk]||{};
    if(!rs.sd||!rs.ed){showToast("⚠ Please enter Start Date and End Date");return;}
    try{
      const res=await saveSplits({source_key:sk,
        journal_type:tab==="sales"?"SALES":"PURCHASE",
        user:user?.user_id||"user",entity,
        splits:[{
          category:     rs.cat||null,
          split_amount: parseFloat(invAmt)||0,
          start_date:   rs.sd||null,
          end_date:     rs.ed||null,
          end_user:     rs.eu||null,
          remark:       rs.rm||null
        }]});
      if(res.data.status==="error"){showToast("⚠ "+res.data.message);return;}
      showToast("✓ Saved");run();
    }catch(e){showToast("⚠ "+e.message);}
  };

  const saveEdit=async(sk,invAmt)=>{
    const es=editState[sk]||{};
    if(!es.sd||!es.ed){showToast("⚠ Please enter Start Date and End Date");return;}
    try{
      const res=await saveSplits({source_key:sk,
        journal_type:tab==="sales"?"SALES":"PURCHASE",
        user:user?.user_id||"user",entity,
        splits:[{
          category:     es.cat||null,
          split_amount: parseFloat(invAmt)||0,
          start_date:   es.sd||null,
          end_date:     es.ed||null,
          end_user:     es.eu||null,
          remark:       es.rm||null
        }]});
      if(res.data.status==="error"){showToast("⚠ "+res.data.message);return;}
      cancelEdit(sk);
      showToast("✓ Updated.");
      run();
    }catch(e){showToast("⚠ "+e.message);}
  };

  const handleLock=async period=>{
    setLockModal(false);
    try{
      const r=await lockPeriod({journal_type:tab==="sales"?"SALES":"PURCHASE",
        lock_year_month:period,user:user?.user_id||"user",entity});
      if(r.data.status==="ok"){
        setLockedPeriods(p=>[...new Set([...p,period])]);
        showToast("🔒 "+period+" locked");
      }
    }catch(e){showToast("⚠ "+e.message);}
  };
  const handleNewLine=async()=>{
    const f=newLineRef.current;
    const dr=parseFloat((f.hdr||"").replace(/,/g,""))||0;
    const cr=parseFloat((f.hcr||"").replace(/,/g,""))||0;
    const amt=Math.abs(dr-cr);
    const cat=f.cat||"PS";
    if(amt<=0){showToast("⚠ Please enter Home DR or Home CR amount");return;}
    if(!f.sd||!f.ed){showToast("⚠ Please enter Start Date and End Date");return;}
    setNewLineSaving(true);
    try{
      const res=await saveManualLine({journal_type:tab==="sales"?"SALES":"PURCHASE",
        trans_date:f.date||new Date().toISOString().slice(0,10),acc_no:f.accNo||"",de_acc_no:  f.deAccNo ||"",
        de_acc_desc:f.deAcc||"",proj_no:f.proj||"",ref_no1:f.ref||"",
        description:f.desc||"",
        home_dr:dr,
        home_cr:cr,
        split_amount:amt,
        category:cat,end_user:f.eu||null,
        start_date:f.sd||null,end_date:f.ed||null,remark:f.rm||"",
        user:user?.user_id||"user",entity});
      if(res.data.status==="error"){showToast("⚠ "+res.data.message);return;}
      setNewLineOpen(false);showToast("✓ New deferred line saved — refreshing in 8s…");
      setTimeout(()=>{showToast("✓ Refreshed");run();}, 8000);
    }catch(e){showToast("⚠ "+e.message);}
    finally{setNewLineSaving(false);}
  };
  const exportCSV=()=>{
    if(!invoices.length){showToast("⚠ No data to export.");return;}
    const headers=["Date","Acc No","Acc Desc","Project Code","Ref 1","Ref 2",
      "Description","Home DR","Home CR","Amount","Type","End User","Start Date","End Date","Days","Remark"];
    const rows=invoices.flatMap(inv=>{
      if(inv.splits&&inv.splits.length){
        return inv.splits.map(s=>[inv.trans_date,inv.acc_no,inv.de_acc_desc,inv.proj_no,
          inv.ref_no1,inv.ref_no2,inv.description,inv.home_dr,inv.home_cr,
          s.net_amount,s.category||"—",s.end_user||"—",s.start_date||"—",s.end_date||"—",s.total_days||"—",s.remark||"—"]);
      }
      return[[inv.trans_date,inv.acc_no,inv.de_acc_desc,inv.proj_no,
        inv.ref_no1,inv.ref_no2,inv.description,inv.home_dr,inv.home_cr,
        inv.amount,"—","—","—","—","—","—"]];
    });
    const csv=[headers,...rows]
      .map(r=>r.map(v=>`"${String(v??"").replace(/"/g,'""')}"`).join(","))
      .join("\n");
    const a=document.createElement("a");
    a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"}));
    a.download=`${isSales?"sales":"purchases"}_${mp.fromStr}_${mp.toStr}.csv`;
    a.click();
  };

  const isSales=tab==="sales";
  const noun=isSales?"Sales":"Purchases";
  const periodLbl=mp.fromLabel===mp.toLabel?mp.fromLabel:mp.fromLabel+"–"+mp.toLabel;
  const colSpanFull=isSales?18:19;

  // Sales "Ref. 1" is the invoice number; its PDF ("{ref}_….pdf") sits in
  // SharePoint in the doc-date year's folder. The backend finds the exact
  // file (/api/invoice-file) and we open it in a new tab. Only entities
  // with a configured SharePoint folder get links (see sharepoint_service).
  // Entities with a SharePoint invoice folder (both the app entity name and
  // the short folder code are accepted; see backend COMPANIES).
  const INVOICE_LINK_ENTITIES=["QM","QA","QAW","Daltos","DT","QSG","CC","QArmour","QAR","QOmnitech","OMT"].map(e=>e.toLowerCase());
  const invoiceLinks=isSales&&INVOICE_LINK_ENTITIES.includes(String(entity).toLowerCase());
  const openInvoice=async inv=>{
    // Open the tab right away, inside the click, so popup blockers allow it;
    // point it at the file once the lookup returns.
    const w=window.open("","_blank");
    if(w){
      w.document.title="Opening invoice…";
      const msg=w.document.createElement("p");
      msg.style.cssText="font:14px system-ui,sans-serif;padding:24px;color:#555";
      msg.textContent=`Opening ${inv.ref_no1}…`;
      w.document.body.appendChild(msg);
    }
    try{
      const r=await getInvoiceFile(entity,inv.ref_no1,String(inv.trans_date).slice(0,10));
      if(!r.data?.url){ if(w) w.close(); showToast(`Mock mode — would open ${r.data?.name||inv.ref_no1}`); return; }
      if(w){ w.opener=null; w.location.replace(r.data.url); }
      else window.open(r.data.url,"_blank","noopener");
    }catch(e){
      if(w) w.close();
      showToast("⚠ "+(e.response?.data?.detail||e.message));
    }
  };

  // Columns Date to Desc. stay frozen while the rest scroll sideways. Their
  // left offsets are measured from the header cells (columns are resizable)
  // and re-measured whenever a frozen header cell changes width.
  const FROZEN=isSales?7:8;
  const headRowRef=useRef(null);

  // Column sizing: the first time invoices arrive, lock each column to the
  // width its content needs, and give the table an explicit total width.
  // With table-layout:fixed that makes the widths authoritative, so the
  // resize handles can widen AND narrow columns (text then ends in "…").
  // Content width is measured from the body rows too — a fixed layout only
  // sizes columns from the header row, which clipped the Action buttons and
  // the date/remark fields. Long text columns are capped (COL_CAP) and
  // simply truncate. Done once per tab, so the user's resizing survives.
  const sizedRef=useRef(false);
  useLayoutEffect(()=>{
    const row=headRowRef.current;
    if(sizedRef.current||!row||!invoices.length) return;
    const table=row.closest("table");
    const ths=[...row.children];
    const COL_CAP=320;
    const bodyRows=[...(table.tBodies[0]?.rows||[])].filter(r=>r.cells.length===ths.length).slice(0,80);
    const widths=ths.map((th,i)=>{
      // Never below the column's declared minimum: the browser squeezes an
      // auto-width table to the screen before sizing, which can shrink a
      // column (e.g. Action) below its widest button state.
      let w=Math.max(th.offsetWidth,Number(th.dataset.minw)||0);
      if(i<ths.length-1) bodyRows.forEach(r=>{ w=Math.max(w,Math.min(r.cells[i].scrollWidth+2,COL_CAP)); });
      return Math.ceil(w);
    });
    ths.forEach((th,i)=>{
      if(i===ths.length-1) return; // trailing filler column takes any leftover space
      th.style.width=widths[i]+"px";
      th.style.minWidth=widths[i]+"px";
    });
    const sum=widths.slice(0,-1).reduce((a,b)=>a+b,0);
    table.style.width=Math.max(sum,table.parentElement.clientWidth)+"px";
    sizedRef.current=true;
  },[invoices.length]);
  // The table's scroll box ends at the bottom of the window, so its
  // horizontal scrollbar is always on screen (it used to sit below the fold
  // until the whole page was scrolled). Measured from the box's position
  // within the page, and re-measured on window resize.
  const scrollRef=useRef(null);
  const [tableMaxH,setTableMaxH]=useState("calc(100vh - 230px)");
  useLayoutEffect(()=>{
    const measure=()=>{
      const el=scrollRef.current; if(!el||!el.offsetParent) return; // tab hidden: keep the last value
      const pageScroller=el.closest(".overflow-y-auto");
      const top=el.getBoundingClientRect().top+(pageScroller?pageScroller.scrollTop:0);
      setTableMaxH(Math.max(320,Math.round(window.innerHeight-top-12))+"px");
    };
    measure();
    window.addEventListener("resize",measure);
    return()=>window.removeEventListener("resize",measure);
  },[invoices.length,loading]);
  const [lefts,setLefts]=useState([]);
  useLayoutEffect(()=>{
    const row=headRowRef.current; if(!row) return;
    const ths=[...row.children].slice(0,FROZEN);
    // Offsets = running sum of the preceding frozen columns' widths. (Not
    // th.offsetLeft: on a sticky cell that already includes the sticky
    // shift, so after a column is narrowed the stale, larger offsets would
    // keep pinning the following columns in place and leave a gap.)
    const measure=()=>{
      let x=0;
      const next=ths.map(th=>{const l=x;x+=th.getBoundingClientRect().width;return Math.round(l);});
      setLefts(p=>p.length===next.length&&p.every((v,i)=>v===next[i])?p:next);
    };
    measure();
    const ro=new ResizeObserver(measure);
    ths.forEach(th=>ro.observe(th));
    return()=>ro.disconnect();
  },[FROZEN]);
  const fh=i=>({freezeLeft:lefts[i]??0,freezeEdge:i===FROZEN-1});
  const fz=(i,bg)=>({className:cn("sticky z-10",bg,i===FROZEN-1&&FZ_EDGE),style:{left:lefts[i]??0}});

  return(
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Page-level scroll (header + filters + lock-bar + KPIs + table all
          scroll together), matching the finalized PnL.jsx/MFRS.jsx pattern —
          replaces the old fixed-toolbar-with-independent-scroll layout. */}
      <div className="flex-1 overflow-y-auto">
        <div className="space-y-5 p-4 sm:p-6">
          <PageHeader
            eyebrow="Adjustment"
            title={noun}
            subtitle={`${entity} · ${periodLbl}`}
            actions={
              <>
                <Button variant="outline" size="sm" onClick={exportCSV}>
                  <Download className="h-3.5 w-3.5"/> Export CSV
                </Button>
                {/* Kept away from Run Report and styled as a secondary action:
                    locking is irreversible, so it shouldn't carry the same
                    visual weight or sit where a quick click might land. */}
                <Button variant="outline" size="sm" className="gap-1.5 text-destructive hover:border-destructive/50 hover:text-destructive" onClick={()=>setLockModal(true)}>
                  <Lock className="h-3.5 w-3.5"/> Lock period
                </Button>
              </>
            }
          />

          <FilterBar>
            <FilterLabel>Period</FilterLabel>
            <MonthPicker label={mp.fromLabel} state={mp.s} side="from" onSelect={mp.sel}/>
            <span>–</span>
            <MonthPicker label={mp.toLabel} state={mp.s} side="to" onSelect={mp.sel}/>
            {["tm","lm","ty","ly"].map(p=>(
              <FilterPill key={p} active={preset===p} onClick={()=>{setPreset(p);mp.preset(p);}}>
                {p==="tm"?"This month":p==="lm"?"Last month":p==="ty"?"This year":"Last year"}
              </FilterPill>
            ))}
            <Button className="ml-auto" size="lg" onClick={run} disabled={loading}>
              {loading?"Loading…":"Run Report"}
            </Button>
          </FilterBar>

          {lockedPeriods.some(ym=>ym>=mp.fromStr.slice(0,7)&&ym<=mp.toStr.slice(0,7))&&(
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-[13px] text-destructive">
              <Lock className="h-3.5 w-3.5"/>
              <strong>Period is locked.</strong>&nbsp;All invoices are read-only. Submit an unlock request to edit.
            </div>
          )}

          {/* KPI grid — plain white Cards */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 min-[1280px]:grid-cols-7 [&_.text-lg]:text-base">
            <Card className="min-w-0 px-3.5 py-2.5">
              <div className="truncate text-xs text-muted-foreground">Total {noun}</div>
              <div className="mt-0.5 truncate text-lg font-semibold leading-tight tracking-tight tabular-nums text-primary">{fmtMYR(Math.abs(totNet))}</div>
              <div className="mt-0.5 truncate text-xs text-muted-foreground">{invoices.length} invoices · {periodLbl}</div>
            </Card>
            <Card className="min-w-0 px-3.5 py-2.5">
              <div className="truncate text-xs text-muted-foreground">Professional Services</div>
              <div className="mt-0.5 truncate text-lg font-semibold leading-tight tracking-tight tabular-nums text-success">{fmtMYR(Math.abs(totPS))}</div>
              <div className="mt-0.5 truncate text-xs text-muted-foreground">{totNet?((totPS/totNet)*100).toFixed(1)+"% of total":""}</div>
            </Card>
            <Card className="min-w-0 px-3.5 py-2.5">
              <div className="truncate text-xs text-muted-foreground">Licence</div>
              <div className="mt-0.5 truncate text-lg font-semibold leading-tight tracking-tight tabular-nums text-warning">{fmtMYR(Math.abs(totLIC))}</div>
              <div className="mt-0.5 truncate text-xs text-muted-foreground">{totNet?((totLIC/totNet)*100).toFixed(1)+"% of total":""}</div>
            </Card>
            <Card className="min-w-0 px-3.5 py-2.5">
              <div className="truncate text-xs text-muted-foreground">Hardware</div>
              <div className="mt-0.5 truncate text-lg font-semibold leading-tight tracking-tight tabular-nums text-muted-foreground">{fmtMYR(Math.abs(totHW))}</div>
              <div className="mt-0.5 truncate text-xs text-muted-foreground">{totNet?((totHW/totNet)*100).toFixed(1)+"% of total":""}</div>
            </Card>
            <Card className="min-w-0 px-3.5 py-2.5">
              <div className="truncate text-xs text-muted-foreground">AMS</div>
              <div className="mt-0.5 truncate text-lg font-semibold leading-tight tracking-tight tabular-nums text-[#1B5E20]">{fmtMYR(Math.abs(totAMS))}</div>
              <div className="mt-0.5 truncate text-xs text-muted-foreground">{totNet?((totAMS/totNet)*100).toFixed(1)+"% of total":""}</div>
            </Card>
            <Card className="min-w-0 px-3.5 py-2.5">
              <div className="truncate text-xs text-muted-foreground">Training</div>
              <div className="mt-0.5 truncate text-lg font-semibold leading-tight tracking-tight tabular-nums text-[#F57F17]">{fmtMYR(Math.abs(totTRN))}</div>
              <div className="mt-0.5 truncate text-xs text-muted-foreground">{totNet?((totTRN/totNet)*100).toFixed(1)+"% of total":""}</div>
            </Card>
            <Card className="min-w-0 px-3.5 py-2.5">
              <div className="truncate text-xs text-muted-foreground">Uncategorised</div>
              <div className="mt-0.5 truncate text-lg font-semibold leading-tight tracking-tight tabular-nums text-destructive">{fmtMYR(Math.abs(totUnc))}</div>
              <div className="mt-0.5 truncate text-xs text-muted-foreground">{cntUnc} invoices</div>
            </Card>
          </div>

          <div className="flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3.5 py-2 text-[12px] text-warning">
            <strong>MFRS dates</strong> — enter Start Date and End Date on each line to enable automatic recognition.
          </div>

          <Card className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 px-[18px] pb-2.5 pt-3.5">
              <h3 className="text-base font-semibold">{noun} invoices · {periodLbl} · {entity}</h3>
              <Input className="w-48"
                placeholder={`Search ${isSales?"customer":"supplier"}, invoice…`}
                value={search} onChange={e=>setSearch(e.target.value)}/>
            </div>

            {/* Own scroll area: the header row stays visible while invoice lines scroll. */}
            <div ref={scrollRef} className="min-h-[320px] w-full overflow-auto" style={{maxHeight:tableMaxH}}>
              <table className="table-fixed border-collapse text-[13px] [&_td]:overflow-hidden [&_td]:text-ellipsis [&_td]:whitespace-nowrap [&_td]:px-2.5 [&_td]:py-2 [&_td]:align-middle">
              <thead className="sticky top-0 z-30">
                <tr ref={headRowRef}>
                  <ColHeader label="Date"         col="trans_date"  minWidth={100}  {...fh(0)} {...chProps}/>
                  <ColHeader label="Acc. No."     col="acc_no"      minWidth={90}  {...fh(1)} {...chProps}/>
                  <ColHeader label="Acc. Desc."   col="acc_desc"    minWidth={130} {...fh(2)} {...chProps}/>
                  <ColHeader label="Debtor Desc." col="de_acc_desc" minWidth={150} {...fh(3)} {...chProps}/>
                  <ColHeader label="Project Code" col="proj_no"     minWidth={110} {...fh(4)} {...chProps}/>
                  <ColHeader label="Ref. 1"       col="ref_no1"     minWidth={110} {...fh(5)} {...chProps}/>
                  {!isSales&&<ColHeader label="Ref. 2" col="ref_no2" minWidth={100} {...fh(6)} {...chProps}/>}
                  <ColHeader label="Desc."        col="description" minWidth={160} {...fh(FROZEN-1)} {...chProps}/>
                  <ColHeader label="Home DR"      col="home_dr"     minWidth={100} align="right" {...chProps}/>
                  <ColHeader label="Home CR"      col="home_cr"     minWidth={100} align="right" {...chProps}/>
                  <ColHeader label="Amount"       col="amount"      minWidth={100} align="right" {...chProps}/>
                  <ColHeader label="Type"         col="category"    minWidth={110} {...chProps}/>
                  {/* Floors sized to the widest control each column can hold
                      (edit mode, Update + ✕, Request unlock), so nothing is
                      clipped even when those states appear after sizing. */}
                  <StaticTh label="End User"   minWidth={112}/>
                  <StaticTh label="Start Date" minWidth={126}/>
                  <StaticTh label="End Date"   minWidth={126}/>
                  <StaticTh label="Days"       minWidth={60} align="right"/>
                  <StaticTh label="Remark"     minWidth={132}/>
                  <StaticTh label="Action"     minWidth={180}/>
                  <th className="border-b border-border bg-card"/>
                </tr>
              </thead>
              <tbody>
                {filtered.map(inv=>{
                  const locked=isLocked(inv.trans_date);
                  const hasSplit=inv.splits&&inv.splits.length>0;
                  const isMultiSplit=inv.splits&&inv.splits.length>1;
                  const singleSplit=hasSplit&&!isMultiSplit?inv.splits[0]:null;
                  // FIX: `locked` alone only reflects whether THIS browser
                  // session personally clicked "Lock period" — it resets to
                  // false on every page load/refresh, since lockedPeriods
                  // starts empty and is never re-hydrated from the backend.
                  // The real, persisted lock state lives on each split's
                  // own is_locked flag. Combine both so a genuinely locked
                  // invoice still shows "Request unlock" after a fresh
                  // reload, not just immediately after locking it in the
                  // current session.
                  const reallyLocked = locked
                    || (singleSplit && singleSplit.is_locked)
                    || (hasSplit && inv.splits.some(s => s.is_locked));
                  const inDraft=splitState[inv.source_key];
                  const inEdit=editState[inv.source_key];
                  const hdr=Number(inv.home_dr),hcr=Number(inv.home_cr),amt=Number(inv.amount);
                  const isEx=expanded[inv.source_key];

                  let typeBdg;
                  const savedCat=inv.category||getRow(inv.source_key,"cat","");
                  if(isMultiSplit){
                    typeBdg=<Badge variant="muted" className="cursor-pointer"
                      onClick={()=>toggleExpand(inv.source_key)}>
                      Split {isEx?"▲":"▼"}
                    </Badge>;
                  }else if(inEdit){
                    typeBdg=<select className={catSelCls} value={inEdit.cat}
                      onChange={e=>updateEdit(inv.source_key,"cat",e.target.value)}>
                      {CAT_OPTIONS}
                    </select>;
                  }else if(singleSplit){
                    typeBdg=<CatBadge cat={singleSplit.category}/>;
                  }else if(savedCat){
                    typeBdg=<CatBadge cat={savedCat}/>;
                  }else{
                    typeBdg=reallyLocked
                      ?<Badge variant="muted">— Assign</Badge>
                      :<select className={catSelCls} value={getRow(inv.source_key,"cat","")}
                          onChange={e=>updateRow(inv.source_key,"cat",e.target.value)}>
                          {CAT_OPTIONS}
                        </select>;
                  }

                  // Opaque background for the frozen cells, matching the row state.
                  const fzBg=reallyLocked?"bg-red-50 dark:bg-red-950":inEdit?SPLIT_BG:"bg-card";
                  const FZ=(i,cls)=>{const z=fz(i,fzBg);return{className:cn(z.className,cls),style:z.style};};
                  return(
                    <React.Fragment key={inv.source_key}>
                      <tr className={cn("border-b border-border/60 hover:bg-muted/40",
                        reallyLocked&&"bg-red-50 dark:bg-red-950",inEdit&&SPLIT_BG)}>
                        <td {...FZ(0,"text-muted-foreground")}>
                          {fmtDateShort(inv.trans_date)}
                        </td>
                        <td {...FZ(1,"font-mono text-[11px] text-muted-foreground")}>{inv.acc_no||"—"}</td>
                        <td {...FZ(2,"overflow-hidden text-ellipsis whitespace-nowrap text-muted-foreground")}>
                          {inv.acc_desc||"—"}
                        </td>
                        <td {...FZ(3,"overflow-hidden text-ellipsis whitespace-nowrap text-muted-foreground")}>
                          {inv.de_acc_desc||"—"}
                        </td>
                        <td {...FZ(4,"font-mono text-[11px]")}>{inv.proj_no||"—"}</td>
                        <td {...FZ(5,"font-mono")}>
                          {invoiceLinks&&inv.ref_no1
                            ?<button type="button" onClick={()=>openInvoice(inv)} title="Open invoice PDF (SharePoint)"
                                className="inline-flex max-w-full items-center gap-1 bg-transparent p-0 text-primary underline-offset-2 hover:underline">
                                <span className="truncate">{reallyLocked&&"🔒 "}{inv.ref_no1}</span>
                                <ExternalLink className="h-3 w-3 shrink-0 opacity-60"/>
                              </button>
                            :reallyLocked
                              ?<>🔒 {inv.ref_no1}</>
                              :<span className="text-primary">{inv.ref_no1||"—"}</span>}
                        </td>
                        {!isSales&&<td {...FZ(6,"font-mono text-[11px] text-muted-foreground")}>{inv.ref_no2||"—"}</td>}
                        <td {...FZ(FROZEN-1,"overflow-hidden text-ellipsis whitespace-nowrap text-muted-foreground")}>
                          {inv.description||"—"}
                        </td>
                        <td className={cn("text-right font-mono",hasSplit&&"line-through text-muted-foreground/70")}>{fmtMYR(hdr)}</td>
                        <td className="text-right font-mono text-muted-foreground">{fmtMYR(hcr)}</td>
                        <td className="text-right font-mono">{fmtMYR(amt)}</td>
                        <td>{typeBdg}</td>

                        {/* End User */}
                        <td>
                          {inEdit
                            ?<Input type="text" className="h-6 border-primary/40 px-1.5 text-[12px]"
                                value={inEdit.eu} placeholder="End user"
                                onChange={e=>updateEdit(inv.source_key,"eu",e.target.value)}
                                style={{width:90}}/>
                            :singleSplit
                              ?<span className="text-[12px] text-foreground/80">{singleSplit.end_user||"—"}</span>
                              :hasSplit
                                ?<span className="text-muted-foreground">—</span>
                                :<Input type="text" className="h-6 px-1.5 text-[12px]"
                                    value={getRow(inv.source_key,"eu")} readOnly={reallyLocked}
                                    placeholder="End user"
                                    onChange={e=>updateRow(inv.source_key,"eu",e.target.value)}
                                    style={{width:90}}/>}
                        </td>

                        {/* Start Date */}
                        <td>
                          {inEdit
                            ?<DateField className="h-6" tone="primary" value={inEdit.sd}
                                onChange={v=>updateEdit(inv.source_key,"sd",v)}/>
                            :singleSplit
                              ?<span className="text-[12px] text-foreground/80">{singleSplit.start_date?fmtDateShort(singleSplit.start_date):"—"}</span>
                              :<DateField className="h-6" tone={!hasSplit?"primary":undefined}
                                value={getRow(inv.source_key,"sd")} readOnly={reallyLocked||isMultiSplit}
                                onChange={v=>updateRow(inv.source_key,"sd",v)}/>}
                        </td>

                        {/* End Date */}
                        <td>
                          {inEdit
                            ?<DateField className="h-6" tone="primary" value={inEdit.ed} copyFrom={inEdit.sd} pasteOnly={inEdit.sd}
                                onChange={v=>updateEdit(inv.source_key,"ed",v)}/>
                            :singleSplit
                              ?<span className="text-[12px] text-foreground/80">{singleSplit.end_date?fmtDateShort(singleSplit.end_date):"—"}</span>
                              :<DateField className="h-6" tone={!hasSplit?"primary":undefined}
                                value={getRow(inv.source_key,"ed")} readOnly={reallyLocked||isMultiSplit}
                                copyFrom={getRow(inv.source_key,"sd")} pasteOnly={getRow(inv.source_key,"sd")}
                                onChange={v=>updateRow(inv.source_key,"ed",v)}/>}
                        </td>

                        {/* Days */}
                        <td className="text-right font-mono text-muted-foreground">
                          {inEdit
                            ?(()=>{const sd=inEdit.sd,ed=inEdit.ed;
                              return sd&&ed?Math.round((new Date(ed)-new Date(sd))/86400000)+1:"—";})()
                            :singleSplit
                              ?singleSplit.total_days||"—"
                              :(()=>{const sd=getRow(inv.source_key,"sd"),ed=getRow(inv.source_key,"ed");
                                return sd&&ed?Math.round((new Date(ed)-new Date(sd))/86400000)+1:"—";})()}
                        </td>

                        {/* Remark */}
                        <td>
                          {inEdit
                            ?<RemarkField tone="primary" value={inEdit.rm||""} context={`${inv.ref_no1||"Invoice"} · ${inv.acc_desc||""}`}
                                onChange={v=>updateEdit(inv.source_key,"rm",v)}/>
                            :singleSplit
                              ?<span className="text-[12px] text-muted-foreground">{singleSplit.remark||"—"}</span>
                              :hasSplit
                                ?<span className="text-muted-foreground">—</span>
                                :<RemarkField value={getRow(inv.source_key,"rm")} readOnly={reallyLocked} context={`${inv.ref_no1||"Invoice"} · ${inv.acc_desc||""}`}
                                    onChange={v=>updateRow(inv.source_key,"rm",v)}/>}
                        </td>

                        {/* Action */}
                        <td className="whitespace-nowrap ![text-overflow:clip]">
                          {reallyLocked
                            ?<Button variant="outline" size="sm"
                                className="h-6 border-destructive/40 px-2 text-[11px] text-destructive hover:bg-destructive/10"
                                onClick={()=>setUnlockModal({
                                  open:true,
                                  invNo:inv.ref_no1||"#"+inv.source_key,
                                  sourceKey:inv.source_key,
                                  journalType:tab==="sales"?"SALES":"PURCHASE"
                                })}>
                                🔓 Request unlock
                              </Button>
                            :inEdit
                              ?<span className="flex gap-1">
                                  <Button size="sm" className="h-6 px-2 text-[11px]" onClick={()=>saveEdit(inv.source_key,amt)}>Update</Button>
                                  <Button variant="outline" size="sm" className="h-6 border-destructive/40 px-2 text-[11px] text-destructive" onClick={()=>cancelEdit(inv.source_key)}>✕</Button>
                                </span>
                              :singleSplit
                                ?<Button variant="outline" size="sm" className="h-6 border-primary/40 px-2 text-[11px] text-primary" onClick={()=>startEdit(inv.source_key,singleSplit)}>✎ Edit</Button>
                                :!hasSplit&&!inDraft
                                  ?<span className="flex gap-1">
                                      <Button size="sm" className="h-6 px-2 text-[11px]" onClick={()=>saveNoSplit(inv.source_key,amt)}>Save</Button>
                                      <Button variant="outline" size="sm" className="h-6 border-primary/40 px-2 text-[11px] text-primary" onClick={()=>openSplit(inv.source_key)}>＋ Split</Button>
                                    </span>
                                  :<span/>}
                        </td>
                        <td/>
                      </tr>

                      {/* ── Existing multi-split rows ── */}
                      {isMultiSplit&&isEx&&inv.splits.map((line,li)=>(
                        <tr key={"s"+li} className={cn("border-b border-border/40",reallyLocked?SPLIT_LOCKED_BG:SPLIT_BG)}>
                          {/* One cell per header column so every value sits under
                              the same column as the invoice row above it. */}
                          <td colSpan={isSales?6:7} {...fz(0,reallyLocked?SPLIT_LOCKED_BG:SPLIT_BG)}/>
                          {/* Desc. */}
                          <td {...fz(FROZEN-1,reallyLocked?SPLIT_LOCKED_BG:SPLIT_BG)}>
                            <div className="flex items-center gap-2 pl-1">
                              <div className={cn("h-[30px] w-0.5 shrink-0 rounded-sm",reallyLocked?"bg-destructive/50":"bg-primary/40")}/>
                              <div className="leading-tight">
                                <div className="text-[12px] font-semibold text-foreground">Split {li+1} of {inv.splits.length}</div>
                                <div className={cn("text-[10.5px]",reallyLocked?"text-destructive":"text-muted-foreground")}>
                                  {reallyLocked?"🔒 Locked":"MFRS recognition period"}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td/>{/* Home DR */}
                          <td/>{/* Home CR */}
                          {/* Amount */}
                          <td className={cn("text-right font-mono",line.category==="LIC"?"text-[#3C3489]":"text-[#0C447C]")}>
                            {fmtMYR(Number(line.net_amount))}
                          </td>
                          <td><CatBadge cat={line.category}/></td>
                          <td><span className="text-[12px] text-foreground/80">{line.end_user||"—"}</span></td>
                          <td><DateField className="h-6" defaultValue={line.start_date||""} readOnly={reallyLocked}/></td>
                          <td><DateField className="h-6" defaultValue={line.end_date||""} readOnly={reallyLocked} copyFrom={line.start_date||""} pasteOnly={line.start_date||""}/></td>
                          <td className="text-right font-mono text-muted-foreground">{line.total_days||"—"}</td>
                          <td><span className="text-[12px] text-muted-foreground">{line.remark||"—"}</span></td>
                          <td/>{/* Action */}
                          <td/>
                        </tr>
                      ))}
                      {isMultiSplit&&isEx&&(
                        <tr className={cn("border-b-2",reallyLocked?"border-destructive/30 bg-destructive/10":"border-border bg-accent/20")}>
                          <td colSpan={colSpanFull-3} className="text-right">
                            <span className="text-[11px] font-semibold text-success">
                              ✓ {inv.splits.map(l=>fmtMYR(Number(l.net_amount))).join(" + ")} = {fmtMYR(amt)}
                            </span>
                            &nbsp;&nbsp;
                            {!reallyLocked&&<Button variant="outline" size="sm" className="h-6 border-primary/40 px-2 text-[11px] text-primary"
                              onClick={()=>startMultiEdit(inv.source_key,inv.splits)}>
                              ✎ Edit
                            </Button>}
                          </td>
                          <td colSpan={3}/>
                        </tr>
                      )}

                      {/* ── Draft split UI ── */}
                      {inDraft&&inDraft.lines.map((line,li)=>{
                        const tDays=line.sd&&line.ed
                          ?Math.round((new Date(line.ed)-new Date(line.sd))/86400000)+1:"";
                        return(
                          <tr key={"d"+li} className={cn("border-b border-border/40",SPLIT_BG)}>
                            <td colSpan={isSales?6:7} {...fz(0,SPLIT_BG)}/>
                            {/* Desc. */}
                            <td {...fz(FROZEN-1,SPLIT_BG)}>
                              <div className="flex items-center gap-2 pl-1">
                                <div className="h-[30px] w-0.5 shrink-0 rounded-sm bg-primary/40"/>
                                <span className="text-[12px] font-semibold text-foreground">Split line {li+1}</span>
                              </div>
                            </td>
                            <td/>{/* Home DR */}
                            <td/>{/* Home CR */}
                            {/* Amount */}
                            <td className="text-right">
                              <Input type="text" className="ml-auto h-6 w-[90px] border-primary/40 px-1.5 text-right font-mono text-[12px]" value={line.amt}
                                onChange={e=>updateSplitLine(inv.source_key,li,"amt",e.target.value)}
                                placeholder="0.00"/>
                            </td>
                            {/* Type */}
                            <td>
                              <select className={catSelCls} value={line.cat}
                                onChange={e=>updateSplitLine(inv.source_key,li,"cat",e.target.value)}>
                                {CAT_OPTIONS_NO_BLANK}
                              </select>
                            </td>
                            <td><span className="text-muted-foreground">—</span></td>{/* End User */}
                            <td>
                              <DateField className="h-6" tone="primary" value={line.sd}
                                onChange={v=>updateSplitLine(inv.source_key,li,"sd",v)}/>
                            </td>
                            <td>
                              <DateField className="h-6" tone="primary" value={line.ed} copyFrom={line.sd} pasteOnly={line.sd}
                                onChange={v=>updateSplitLine(inv.source_key,li,"ed",v)}/>
                            </td>
                            <td className="text-right font-mono text-muted-foreground">{tDays||"—"}</td>
                            <td>
                              <RemarkField tone="primary" width={96} value={line.rm||""} context={`${inv.ref_no1||"Invoice"} · split line ${li+1}`}
                                onChange={v=>updateSplitLine(inv.source_key,li,"rm",v)}/>
                            </td>
                            <td className="whitespace-nowrap">
                              <Button variant="outline" size="sm" className="h-6 border-destructive/40 px-2 text-[11px] text-destructive" onClick={()=>removeSplitLine(inv.source_key,li)}>✕</Button>
                            </td>
                            <td/>
                          </tr>
                        );
                      })}
                      {inDraft&&(()=>{
                        const total=inDraft.lines.reduce((s,l)=>s+(parseFloat(l.amt)||0),0);
                        const valid=Math.abs(total-amt)<1;
                        return(
                          <tr className="border-b-2 border-border bg-accent/20">
                            <td colSpan={colSpanFull-3} className="text-right">
                              {valid
                                ?<span className="text-[11px] font-semibold text-success">✓ {fmtMYR(total)} = {fmtMYR(amt)}</span>
                                :<span className="text-[11px] font-semibold text-warning">⚠ {fmtMYR(total)} / {fmtMYR(amt)}</span>}
                              &nbsp;&nbsp;
                              <Button variant="outline" size="sm" className="h-6 border-dashed border-primary/40 px-2 text-[11px] text-primary" onClick={()=>addSplitLine(inv.source_key)}>+ Add line</Button>
                            </td>
                            <td colSpan={2} className="whitespace-nowrap text-right">
                              <Button size="sm" className="mr-1 h-6 px-2 text-[11px]" onClick={()=>saveSplit_(inv.source_key,amt)}>Save split</Button>
                              <Button variant="outline" size="sm" className="h-6 border-destructive/40 px-2 text-[11px] text-destructive" onClick={()=>setSplitState(p=>{const n={...p};delete n[inv.source_key];return n;})}>Cancel</Button>
                            </td>
                            <td/>
                          </tr>
                        );
                      })()}
                    </React.Fragment>
                  );
                })}

                {filtered.length===0&&(loading ? (
                  Array.from({length:6}).map((_,i)=>(
                    <tr key={"sk"+i}><td colSpan={colSpanFull+1} className="px-4 py-2"><Skeleton className="h-4 w-full"/></td></tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={colSpanFull+1} className="py-10 text-center">
                      <div className="text-sm font-semibold text-foreground">
                        {invoices.length===0 ? "No data for this period" : "No results match your search"}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {invoices.length===0 ? "Try a different period or entity." : "Clear the search or column filters to see all invoices."}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center gap-3.5 px-4 py-2.5 text-[12px]">
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="h-1.5 w-1.5 shrink-0 rounded-sm" style={{background:"#185FA5"}}/>
              <span>PS: <strong>{fmtMYR(totPS)}</strong></span>
              <div className="h-1.5 w-1.5 shrink-0 rounded-sm" style={{background:"#7F77DD"}}/>
              <span>Licence: <strong>{fmtMYR(totLIC)}</strong></span>
              <div className="h-1.5 w-1.5 shrink-0 rounded-sm" style={{background:"#E65100"}}/>
              <span>HW: <strong>{fmtMYR(totHW)}</strong></span>
              <div className="h-1.5 w-1.5 shrink-0 rounded-sm" style={{background:"#1B5E20"}}/>
              <span>AMS: <strong>{fmtMYR(totAMS)}</strong></span>
              <div className="h-1.5 w-1.5 shrink-0 rounded-sm" style={{background:"#F57F17"}}/>
              <span>Training: <strong>{fmtMYR(totTRN)}</strong></span>
              <div className="h-1.5 w-1.5 shrink-0 rounded-sm bg-border"/>
              <span>Uncategorised: <strong>{fmtMYR(totUnc)}</strong></span>
            </div>
            <div className="ml-auto flex flex-wrap items-center gap-2.5">
              <Button variant="success" size="sm" className="gap-1.5" onClick={()=>setNewLineOpen(true)}>
                <Plus className="h-3 w-3"/>
                New {isSales?"sales":"purchase"} adjustment line
              </Button>
              <Button size="sm" className="gap-1.5" onClick={()=>setTaskModal(true)}>
                <ClipboardList className="h-3 w-3"/>
                New task
              </Button>
            </div>
          </div>
        </Card>

        {newLineOpen&&(
          <div className="w-full overflow-x-auto" style={{overflowY:"visible"}}>
            <table className="border-collapse">
              <tbody>
                <tr className="border-b-2 border-success/50 bg-success/10">
                  <td className="px-2 py-1.5"><span className={newLineLblCls}>Date</span>
                    <DateField className="h-6" tone="success" onChange={v=>{newLineRef.current.date=v;}}/></td>
                  <td colSpan={2} className="px-2 py-1.5"><span className={newLineLblCls}>Account</span>
                      <select className={cn(newLineInpCls,"block")} style={{width:220}}
                        onChange={e=>{
                          const opt = e.target.options[e.target.selectedIndex];
                          newLineRef.current.accNo = opt.value;
                          newLineRef.current.deAcc = opt.dataset.desc;
                        }}>
                        <option value="">— Select account</option>
                        {accounts.map(a=>(
                          <option key={a.acc_no} value={a.acc_no} data-desc={a.acc_desc}>
                            {a.acc_no} — {a.acc_desc}
                          </option>
                        ))}
                      </select>
                  </td>
                  <td colSpan={2} className="px-2 py-1.5"><span className={newLineLblCls}>Debtor / Creditor</span>
                      <select className={cn(newLineInpCls,"block")} style={{width:220}}
                          defaultValue=""
                          onChange={e=>{
                              newLineRef.current.deAccNo=e.target.value;
                          }}>
                          <option value="">— Select debtor/creditor</option>
                          {deAccounts.map(a=>(
                              <option key={a.acc_no} value={a.acc_no}>
                                  {a.acc_no} — {a.acc_desc}
                              </option>
                          ))}
                      </select>
                  </td>
                  <td className="px-2 py-1.5"><span className={newLineLblCls}>Project Code</span>
                    <Input type="text" className={newLineInpCls} placeholder="PRJ-001" style={{width:90}}
                      onChange={e=>{newLineRef.current.proj=e.target.value;}}/></td>
                  <td className="px-2 py-1.5"><span className={newLineLblCls}>Ref. 1</span>
                    <Input type="text" className={newLineInpCls} placeholder="Ref no." style={{width:90}}
                      onChange={e=>{newLineRef.current.ref=e.target.value;}}/></td>
                  {!isSales&&<td className="px-2 py-1.5"><span className={newLineLblCls}>Ref. 2</span>
                    <Input type="text" className={newLineInpCls} placeholder="Ref no." style={{width:90}}
                      onChange={e=>{newLineRef.current.ref2=e.target.value;}}/></td>}
                  <td className="px-2 py-1.5"><span className={newLineLblCls}>Desc.</span>
                    <Input type="text" className={newLineInpCls} placeholder="Description"
                      onChange={e=>{newLineRef.current.desc=e.target.value;}}/></td>
                  <td className="px-2 py-1.5"><span className={newLineLblCls}>Home DR</span>
                    <Input type="text" className={cn(newLineInpCls,"text-right")} placeholder="0.00" style={{width:80}}
                      onChange={e=>{newLineRef.current.hdr=e.target.value;}}/></td>
                  <td className="px-2 py-1.5"><span className={newLineLblCls}>Home CR</span>
                    <Input type="text" className={cn(newLineInpCls,"text-right")} placeholder="0.00" style={{width:80}}
                      onChange={e=>{newLineRef.current.hcr=e.target.value;}}/></td>
                  <td className="px-2 py-1.5"><span className={newLineLblCls}>Amount</span>
                    <Input type="text" className={cn(newLineInpCls,"text-right")} placeholder="0.00" style={{width:80}} readOnly/></td>
                  <td className="px-2 py-1.5"><span className={newLineLblCls}>Type</span>
                    <select className={cn(newLineInpCls,"block")} onChange={e=>{newLineRef.current.cat=e.target.value;}}>
                      {CAT_OPTIONS_NO_BLANK}
                    </select></td>
                  <td className="px-2 py-1.5"><span className={newLineLblCls}>End User</span>
                    <Input type="text" className={newLineInpCls} placeholder="End user" style={{width:100}}
                      onChange={e=>{newLineRef.current.eu=e.target.value;}}/></td>
                  <td className="px-2 py-1.5"><span className={newLineLblCls}>Start Date</span>
                    <DateField className="h-6" tone="success" onChange={v=>{newLineRef.current.sd=v;}}/></td>
                  <td className="px-2 py-1.5"><span className={newLineLblCls}>End Date</span>
                    <DateField className="h-6" tone="success" copyFrom={()=>newLineRef.current.sd} pasteOnly={()=>newLineRef.current.sd} onChange={v=>{newLineRef.current.ed=v;}}/></td>
                  <td className="px-2 py-1.5"><span className={newLineLblCls}>Days</span>
                    <Input type="text" className={cn(newLineInpCls,"text-right")} placeholder="—" style={{width:60}} readOnly/></td>
                  <td colSpan={2} className="whitespace-nowrap px-2 py-1.5 align-bottom">
                    <span className={cn(newLineLblCls,"mb-0.5 block")}>Remark</span>
                    <RemarkField tone="success" placeholder="Optional…" className="mb-1" context="New manual line"
                      onChange={v=>{newLineRef.current.rm=v;}}/>
                    <Button size="sm" className="mr-1 h-6 px-2 text-[11px]" onClick={handleNewLine} disabled={newLineSaving}>{newLineSaving?"Saving…":"Save"}</Button>
                    <Button variant="outline" size="sm" className="h-6 border-destructive/40 px-2 text-[11px] text-destructive" onClick={()=>setNewLineOpen(false)}>✕</Button>
                  </td>
                  <td/>
                </tr>
              </tbody>
            </table>
          </div>
        )}
        </div>
      </div>

      <LockModal open={lockModal} onClose={()=>setLockModal(false)} onConfirm={handleLock}/>
      <UnlockModal open={unlockModal.open} invNo={unlockModal.invNo}
        onClose={()=>setUnlockModal({open:false,invNo:"",sourceKey:null,journalType:""})}
        onSubmit={async(reason)=>{
            try{
                await createTask({
                    entity,
                    todo:         "Unlock request: "+unlockModal.invNo,
                    description:  reason,
                    remark:       reason,
                    source:       tab==="sales"?"sales":"purchases",
                    source_key:   unlockModal.sourceKey,
                    journal_type: unlockModal.journalType,
                    ref_no:       unlockModal.invNo,
                    assigned_to:  null,
                    due_date:     null,
                    task_type:    "unlock_request",
                    created_by:   user?.user_id,
                });
                setUnlockModal({open:false,invNo:"",sourceKey:null,journalType:""});
                showToast("🔓 Unlock request submitted.");
            }catch(e){
                showToast("⚠ Failed to submit unlock request: "+e.message);
            }
        }}/>
      <TaskModal open={taskModal} defaultSrc={tab==="sales"?"sales":"purchases"} onClose={()=>setTaskModal(false)}
        onSave={async(form)=>{
            try{
                await createTask({
                    entity,
                    todo:        form.todo,
                    description: form.desc,
                    remark:      form.remark,
                    source:      tab==="sales"?"sales":"purchases",
                    assigned_to: form.assignee,
                    due_date:    form.due,
                    task_type:   "general",
                    created_by:  user?.user_id,
                });
                setTaskModal(false);
                showToast("✓ Task created.");
            }catch(e){
                showToast("⚠ Failed to create task: "+e.message);
            }
        }}/>
    </div>
  );
}
