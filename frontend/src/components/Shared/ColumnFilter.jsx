import React,{useState,useEffect} from "react";
import ReactDOM from "react-dom";
import {MN} from "../../utils/fmt";
import {Input} from "../ui/input";
import {Button} from "../ui/button";
import {cn} from "../../lib/utils";

// Shared column-header menu (sort + filter) used by the Sales/Purchases
// invoice table and the MFRS tables, so every table filters the same way.
// Filter kinds:
//   "text"  — multi-select of the column's distinct values
//   "month" — multi-select of the months (YYYY-MM) present in a date column
//   "range" — min/max range, with predefined MYR brackets (2 decimals)
//   "count" — min/max range for plain whole numbers (e.g. Days), no brackets

export const monthKey=d=>String(d||"").slice(0,7);
export const monthLabel=k=>{const [y,m]=String(k).split("-");return (MN[+m-1]||m)+" "+y;};
export const fmt2=v=>Number(v).toLocaleString("en-MY",{minimumFractionDigits:2,maximumFractionDigits:2});
const fixed2=v=>(v===""||v==null||isNaN(Number(v)))?"":Number(v).toFixed(2);

const menuHeadCls="px-2 py-1 text-[11px] font-bold tracking-wide text-muted-foreground";
const menuRowCls="flex cursor-pointer items-center gap-2 rounded px-2.5 py-1.5 text-[12.5px]";

// Predefined MYR brackets for the price filter (max is x,999.99 so the
// brackets never overlap). "Below 0" only appears when the data has
// negative amounts (e.g. credit notes).
export const PRICE_PRESETS=[
  {label:"Below 0",            min:"",          max:"-0.01"},
  {label:"0 – 999.99",         min:"0.00",      max:"999.99"},
  {label:"1,000 – 4,999.99",   min:"1000.00",   max:"4999.99"},
  {label:"5,000 – 9,999.99",   min:"5000.00",   max:"9999.99"},
  {label:"10,000 – 49,999.99", min:"10000.00",  max:"49999.99"},
  {label:"50,000 – 99,999.99", min:"50000.00",  max:"99999.99"},
  {label:"100,000 and above",  min:"100000.00", max:""},
];
const inRange=(v,{min,max})=>(min===""||min==null||v>=Number(min))&&(max===""||max==null||v<=Number(max));

// Does one row value pass a column's active filter?
export function matchesFilter(kind,filter,value){
  if(!filter) return true;
  if(kind==="range"||kind==="count") return inRange(Number(value)||0,filter);
  if(!filter.length) return true;
  if(kind==="month") return filter.includes(monthKey(value));
  const s=String(value??"").toLowerCase();
  return filter.some(x=>String(x).toLowerCase()===s);
}

// Values offered in a column's menu: distinct values (text), distinct months
// (month), or every numeric value sorted ascending (range/count — used for
// the "In data" bounds and the per-bracket counts).
export function menuValues(kind,values){
  if(kind==="range"||kind==="count") return values.map(v=>Number(v)||0).sort((a,b)=>a-b);
  if(kind==="month") return [...new Set(values.map(monthKey).filter(Boolean))].sort();
  return [...new Set(values.filter(v=>v!=null&&v!==""))].sort();
}

export function DropdownPortal({anchorRef,children,onClose}){
  const [pos,setPos]=useState({top:0,left:0,width:200});
  useEffect(()=>{
    if(!anchorRef.current) return;
    const rect=anchorRef.current.getBoundingClientRect();
    setPos({top:rect.bottom+window.scrollY,left:rect.left+window.scrollX,width:Math.max(200,rect.width)});
  },[anchorRef]);
  useEffect(()=>{
    const close=e=>{if(!anchorRef.current?.contains(e.target)) onClose();};
    document.addEventListener("mousedown",close);
    return()=>document.removeEventListener("mousedown",close);
  },[anchorRef,onClose]);
  return ReactDOM.createPortal(
    <div className="rounded-lg border border-border bg-card text-left font-normal normal-case tracking-normal text-foreground shadow-lg"
      style={{position:"absolute",top:pos.top,left:pos.left,zIndex:99999,
        minWidth:pos.width,maxHeight:420,overflowY:"auto",padding:6}}
      onMouseDown={e=>e.stopPropagation()}>
      {children}
    </div>,
    document.body
  );
}

function RangeFilter({active,values,onApply,decimals=true,presets=PRICE_PRESETS}){
  const norm=decimals?fixed2:v=>(v===""||v==null||isNaN(Number(v)))?"":String(Math.round(Number(v)));
  const [min,setMin]=useState(norm(active?.min));
  const [max,setMax]=useState(norm(active?.max));
  const apply=()=>onApply(min===""&&max===""?null:{min,max});
  const onKey=e=>{if(e.key==="Enter")apply();};
  const bounds=values.length?[values[0],values[values.length-1]]:null;
  const shown=presets
    .map(p=>({...p,count:values.filter(v=>inRange(v,p)).length}))
    .filter(p=>p.label!=="Below 0"||p.count>0);
  const isOn=p=>norm(active?.min)===p.min&&norm(active?.max)===p.max;
  const show=v=>decimals?fmt2(v):String(v);
  return(
    <div className="space-y-2 px-2 py-1.5">
      {shown.length>0&&(
        <>
          <div className="space-y-0.5">
            {shown.map(p=>(
              <button key={p.label} type="button" disabled={!p.count}
                onClick={()=>onApply(isOn(p)?null:{min:p.min,max:p.max})}
                className={cn(menuRowCls,"w-full justify-between bg-transparent text-left disabled:cursor-default disabled:opacity-40",
                  isOn(p)?"bg-accent font-semibold text-primary":"text-foreground hover:bg-muted/60")}>
                <span>{isOn(p)&&"✓ "}{p.label}</span>
                <span className="text-[11.5px] text-muted-foreground">{p.count}</span>
              </button>
            ))}
          </div>
          <div className="border-t border-border pt-2 text-[11px] font-bold tracking-wide text-muted-foreground">CUSTOM RANGE</div>
        </>
      )}
      {bounds&&(
        <div className="text-[11.5px] text-muted-foreground">In data: {show(bounds[0])} – {show(bounds[1])}</div>
      )}
      <div className="flex items-center gap-1.5">
        <Input type="number" step={decimals?"0.01":"1"} placeholder="Min" value={min} className="h-8 text-[12.5px]"
          onChange={e=>setMin(e.target.value)} onBlur={()=>setMin(norm(min))} onKeyDown={onKey}/>
        <span className="text-muted-foreground">–</span>
        <Input type="number" step={decimals?"0.01":"1"} placeholder="Max" value={max} className="h-8 text-[12.5px]"
          onChange={e=>setMax(e.target.value)} onBlur={()=>setMax(norm(max))} onKeyDown={onKey}/>
      </div>
      <div className="flex justify-end gap-1.5">
        <Button variant="outline" size="sm" className="h-7" onClick={()=>{setMin("");setMax("");onApply(null);}}>Clear</Button>
        <Button size="sm" className="h-7" onClick={apply}>Apply</Button>
      </div>
    </div>
  );
}

function ListFilter({active,unique,onChange,label=String}){
  const [q,setQ]=useState("");
  const selected=active||[];
  const shown=q?unique.filter(v=>label(v).toLowerCase().includes(q.toLowerCase())):unique;
  const toggle=v=>{
    const next=selected.includes(v)?selected.filter(x=>x!==v):[...selected,v];
    onChange(next.length?next:null);
  };
  return(
    <>
      {unique.length>8&&(
        <div className="px-1.5 pb-1">
          <Input placeholder="Search…" value={q} onChange={e=>setQ(e.target.value)} className="h-8 text-[12.5px]"/>
        </div>
      )}
      <div className="flex items-center justify-between px-2.5 py-1 text-[12px]">
        <button type="button" className="bg-transparent font-semibold text-primary hover:underline"
          onClick={()=>onChange([...new Set([...selected,...shown])])}>Select all</button>
        <button type="button" className="bg-transparent text-muted-foreground hover:underline"
          onClick={()=>onChange(null)}>Clear</button>
      </div>
      {shown.length===0&&(
        <div className="px-2.5 py-1.5 text-[12px] italic text-muted-foreground">No values found</div>
      )}
      {shown.map(val=>{
        const on=selected.includes(val);
        return(
          <label key={val} className={cn(menuRowCls,on?"bg-accent text-primary":"text-foreground hover:bg-muted/60")}>
            <input type="checkbox" checked={on} onChange={()=>toggle(val)} className="h-3.5 w-3.5 accent-[#007FFF]"/>
            <span className="overflow-hidden text-ellipsis whitespace-nowrap">{label(val)}</span>
          </label>
        );
      })}
    </>
  );
}

const SORT_LABELS={
  range:["Low → High","High → Low"], count:["Low → High","High → Low"],
  month:["Oldest first","Newest first"], text:["A → Z","Z → A"],
};
const FILTER_TITLE={range:"FILTER BY RANGE",count:"FILTER BY RANGE",month:"FILTER BY MONTH",text:"FILTER"};

// The dropdown body: SORT options, then the kind-appropriate FILTER.
// `values` = menuValues(kind, …) for this column.
export function ColumnMenu({kind="text",isSorted,sortDir,active,values,onSort,onFilter,onClose}){
  const [asc,desc]=SORT_LABELS[kind]||SORT_LABELS.text;
  return(
    <>
      <div className={menuHeadCls}>SORT</div>
      {["asc","desc"].map(dir=>(
        <div key={dir}
          onClick={()=>{onSort(dir);onClose();}}
          className={cn(menuRowCls,isSorted&&sortDir===dir?"bg-accent text-primary":"text-foreground hover:bg-muted/60")}>
          {dir==="asc"?"↑":"↓"}&nbsp;{dir==="asc"?asc:desc}
        </div>
      ))}
      <div className="my-1 border-t border-border"/>
      <div className={menuHeadCls}>{FILTER_TITLE[kind]||"FILTER"}</div>
      {kind==="range"||kind==="count"
        ?<RangeFilter active={active} values={values} decimals={kind==="range"}
            presets={kind==="range"?PRICE_PRESETS:[]}
            onApply={v=>{onFilter(v);onClose();}}/>
        :<ListFilter active={active} unique={values} onChange={onFilter}
            label={kind==="month"?monthLabel:String}/>}
    </>
  );
}

// Header marks: sort arrow, active-filter dot (or count when several
// values are ticked), and the ▾ menu caret.
export function HeaderMarks({isSorted,sortDir,active,isOpen}){
  const count=Array.isArray(active)?active.length:0;
  return(
    <>
      {isSorted&&<span className="text-[11px] text-primary">{sortDir==="asc"?"↑":"↓"}</span>}
      {active&&(count>1
        ?<span className="rounded-full bg-primary px-1.5 text-[10px] font-bold leading-4 text-primary-foreground">{count}</span>
        :<span className="text-[10px] leading-none text-primary">●</span>)}
      <span className={cn("text-[11px]",isOpen?"text-primary":"text-muted-foreground/40")}>▾</span>
    </>
  );
}
