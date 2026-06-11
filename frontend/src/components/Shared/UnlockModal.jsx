import React,{useState} from "react";
export default function UnlockModal({open,invNo,onClose,onSubmit}){
  const [r,setR]=useState("");
  if(!open)return null;
  return(
    <div className="modal-bg" onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div className="modal">
        <div className="modal-title">&#128275; Request unlock</div>
        <div className="modal-sub">Submit a reason for unlocking <strong>{invNo}</strong>.</div>
        <div className="modal-danger">&#128274;&nbsp;Only this invoice will be unlocked if approved.</div>
        <div className="modal-field"><label>Reason</label>
          <textarea value={r} onChange={e=>setR(e.target.value)} placeholder="e.g. Wrong contract end date…"/></div>
        <div className="modal-actions">
          <button className="btn-modal-cancel" onClick={onClose}>Cancel</button>
          <button className="btn-modal-submit" onClick={()=>{if(r.trim())onSubmit(r);}}>Submit request</button>
        </div>
      </div>
    </div>
  );
}
