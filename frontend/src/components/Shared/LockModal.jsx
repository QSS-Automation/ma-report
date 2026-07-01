import React,{useState} from "react";
import {MN} from "../../utils/fmt";
export default function LockModal({open,onClose,onConfirm}){
  const [period,setPeriod]=useState("");
  if(!open)return null;
  const now=new Date(); const opts=[];
  for(let i=0;i<60;i++){
    const d=new Date(now.getFullYear(),now.getMonth()-i,1);
    const val=d.getFullYear()+"-"+(d.getMonth()<9?"0":"")+(d.getMonth()+1);
    opts.push(<option key={val} value={val}>{MN[d.getMonth()]} {d.getFullYear()}</option>);
  }
  return(
    <div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div className="modal">
        <div className="modal-title">&#128274; Lock period</div>
        <div className="modal-sub">Once locked, all invoices become read-only.</div>
        <div className="modal-field"><label>Period to lock</label>
          <select value={period} onChange={e=>setPeriod(e.target.value)}>{opts}</select></div>
        <div className="modal-warn">&#9888;&nbsp;<strong>This affects all invoices in the period.</strong> MFRS recognition figures will be snapshotted.</div>
        <div className="modal-actions">
          <button className="btn-modal-cancel" onClick={onClose}>Cancel</button>
          <button className="btn-modal-lock" onClick={()=>{if(period)onConfirm(period);}}>&#128274; Confirm lock</button>
        </div>
      </div>
    </div>
  );
}
