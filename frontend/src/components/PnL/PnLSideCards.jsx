import React from "react";
import {fmtMYRK} from "../../utils/fmt";
export default function PnLSideCards({data}){
  const secTotal=(section)=>{
    const r=data.rows.find(r=>r.section===section&&r.row_type==="subtotal");
    return r?r.months.reduce((a,b)=>a+(Number(b)||0),0):0;
  };
  const ns=data.rows.find(r=>r.row_type==="net_sales");
  const nsTotal=ns?ns.months.reduce((a,b)=>a+(Number(b)||0),0):1;
  const gp=data.rows.find(r=>r.section==="GROSS_PROFIT");
  const gpT=gp?gp.months.reduce((a,b)=>a+(Number(b)||0),0):0;
  const pat=data.rows.find(r=>r.section==="NET_PROFIT_AFTER");
  const patT=pat?pat.months.reduce((a,b)=>a+(Number(b)||0),0):0;
  const slRows=data.rows.filter(r=>r.row_type==="detail"&&r.section==="SALES");
  const maxSl=Math.max(...slRows.map(r=>Math.abs(r.months.reduce((a,b)=>a+(Number(b)||0),0))),1);
  return(
    <div className="col-r">
      <div className="card">
        <div className="card-hdr"><div className="card-title">Revenue breakdown</div></div>
        <div className="bar-chart">
          {slRows.slice(0,5).map(r=>{
            const tot=r.months.reduce((a,b)=>a+(Number(b)||0),0);
            const pct=Math.max((tot/maxSl)*100,2);
            return(
              <div key={r.acc_no} className="bar-row">
                <span className="bar-name" style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{r.label.slice(0,14)}</span>
                <div className="bar-track"><div className="bar-fill" style={{width:pct+"%",background:"#185FA5"}}></div></div>
                <span className="bar-val">{fmtMYRK(tot)}</span>
              </div>
            );
          })}
        </div>
      </div>
      <div className="card">
        <div className="card-hdr"><div className="card-title">Margin summary</div></div>
        <div className="bar-chart" style={{paddingTop:8}}>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:11,marginBottom:3}}>
            <span>Gross margin</span><span style={{fontWeight:700,color:"#1D9E75"}}>{nsTotal?((gpT/nsTotal)*100).toFixed(1)+"%":"—"}</span>
          </div>
          <div style={{height:5,background:"#f0efe8",borderRadius:3,overflow:"hidden",marginBottom:8}}>
            <div style={{height:5,background:"#1D9E75",borderRadius:3,width:nsTotal?((gpT/nsTotal)*100)+"%":"0"}}/>
          </div>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:11,marginBottom:3}}>
            <span>Net margin (after tax)</span><span style={{fontWeight:700,color:"#185FA5"}}>{nsTotal?((patT/nsTotal)*100).toFixed(1)+"%":"—"}</span>
          </div>
          <div style={{height:5,background:"#f0efe8",borderRadius:3,overflow:"hidden"}}>
            <div style={{height:5,background:"#185FA5",borderRadius:3,width:nsTotal?((patT/nsTotal)*100)+"%":"0"}}/>
          </div>
        </div>
      </div>
    </div>
  );
}
