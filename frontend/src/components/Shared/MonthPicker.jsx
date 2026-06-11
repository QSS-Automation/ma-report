import React,{useState,useEffect, useRef} from "react";

import {MN} from "../../utils/fmt";
export default function MonthPicker({label,state,side,onSelect}){
  const [open,setOpen]=useState(false);
  const curYear=side==="from"?state.fromYear:state.toYear;
  const curMonth=side==="from"?state.fromMonth:state.toMonth;
  const [vy,setVy]=useState(curYear);
  const fa=state.fromYear*12+state.fromMonth, ta=state.toYear*12+state.toMonth;
  const ref = useRef(null);
  useEffect(() => {
  if (!open) return;
  const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
  document.addEventListener("mousedown", handler);
  return () => document.removeEventListener("mousedown", handler);
}, [open]);
  return(
    <div className="mp-wrap" ref={ref}>
      <button className="mp-btn" onClick={()=>{setOpen(!open);setVy(curYear);}}>
        {label}&nbsp;<span>&#9660;</span>
      </button>
      {open&&<div className="mp-drop">
        <div className="mp-yr-nav">
          <button onClick={e=>{e.stopPropagation();setVy(v=>v-1);}}>«</button>
          <span className="mp-yr-lbl">{vy}</span>
          <button onClick={e=>{e.stopPropagation();setVy(v=>v+1);}}>»</button>
        </div>
        <div className="mp-grid">
          {MN.map((m,i)=>{
            const abs=vy*12+i,isSel=vy===curYear&&i===curMonth,inR=!isSel&&abs>fa&&abs<ta;
            return<div key={i} className={"mp-mon"+(isSel?" selected":"")+(inR?" in-range":"")}
              onClick={()=>{onSelect(side,vy,i);setOpen(false);}}>{m}</div>;
          })}
        </div>
      </div>}
    </div>
  );
}
