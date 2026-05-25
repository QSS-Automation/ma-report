import React,{useState} from "react";
import {numFmt} from "../../utils/fmt";

const SECTION_KEYS={
  "SALES":"sl","RETURN INWARDS":"ri","COST OF GOODS SOLD":"co",
  "OTHER INCOME":"oi","OPERATING EXPENSES":"ep","TAXATION":"tx"
};

export default function PnLTable({data,yoy,lyData}){
  const [open,setOpen]=useState({});
  const cols=data.month_labels;
  const toggle=k=>setOpen(p=>({...p,[k]:!p[k]}));
  const anyOpen=Object.values(open).some(Boolean);

  return(
    <div className="card">
      <div className="card-hdr">
        <div className="card-title">Profit &amp; Loss — Detail</div>
        <div className="card-sub" style={{marginLeft:"auto"}}>{cols[0]}–{cols[cols.length-1]} · {cols.length} months</div>
      </div>
      <div className="expand-bar" onClick={()=>{
        const all=!anyOpen; const nxt={};
        Object.values(SECTION_KEYS).forEach(k=>{nxt[k]=all;}); setOpen(nxt);
      }}>
        <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="#185FA5" strokeWidth="1.5"
          style={{transition:"transform .15s",transform:anyOpen?"rotate(180deg)":"none"}}>
          <path d="M2 4l4 4 4-4"/>
        </svg>
        <span>{anyOpen?"Collapse all sections":"Expand all sections"}</span>
      </div>
      <div className="pnl-scroll">
        <table style={{width:"100%",borderCollapse:"collapse",minWidth:300}}>
          <thead>
            <tr style={{background:"#fafaf8"}}>
              <th style={{padding:"7px 10px",fontSize:10,fontWeight:700,color:"#888780",letterSpacing:".05em",textTransform:"uppercase",borderBottom:"1px solid #e8e7e0",textAlign:"left"}}>Description</th>
              {cols.map(c=><th key={c} style={{padding:"7px 10px",fontSize:10,fontWeight:700,color:"#888780",letterSpacing:".05em",textTransform:"uppercase",borderBottom:"1px solid #e8e7e0",textAlign:"right"}}>{c}</th>)}
              <th style={{padding:"7px 10px",fontSize:10,fontWeight:700,color:"#888780",letterSpacing:".05em",textTransform:"uppercase",borderBottom:"1px solid #e8e7e0",textAlign:"right"}}>Total</th>
                {yoy&&lyData&&<th style={{padding:"7px 10px",fontSize:10,fontWeight:700,color:"#888780",letterSpacing:".05em",textTransform:"uppercase",borderBottom:"1px solid #e8e7e0",textAlign:"right",whiteSpace:"nowrap"}}>YoY %</th>}
            </tr>
          </thead>
          <tbody>
            {data.rows.map((r,i)=>{
              const k=SECTION_KEYS[r.section]||r.section.toLowerCase().replace(/[ /]/g,"_");
              const isOpen=open[k];
              if(r.row_type==="subtotal"){
                return(
                  <React.Fragment key={i}>
                    <tr className="sec-row" onClick={()=>toggle(k)}>
                      <td><span className={"chev"+(isOpen?" op":"")} style={{fontSize:11,color:"#888780",marginRight:6,display:"inline-block",transition:"transform .15s"}}>&#9658;</span>
                        {r.tag&&<span style={{fontSize:8,padding:"1px 5px",borderRadius:2,color:"#fff",fontWeight:700,marginRight:5,background:
                          r.tag==="rev" ? "#185FA5" :
                          r.tag==="ri"  ? "#7B3FA0" :
                          r.tag==="cos" ? "#D85A30" :
                          r.tag==="oi"  ? "#1D9E75" :
                          r.tag==="ep"  ? "#BA7517" :
                          r.tag==="tx"  ? "#888780" : "#444"
                        }}>{r.tag==="ri"?"RI":r.tag.toUpperCase()}</span>}
                        {r.label}
                      </td>
                      {r.months.map((v,j)=><td key={j} style={{textAlign:"right",fontFamily:"Courier New,monospace",fontSize:12,fontWeight:600}} dangerouslySetInnerHTML={{__html:numFmt(Number(v))}}/>)}
                      <td style={{textAlign:"right",fontFamily:"Courier New,monospace",fontSize:12,fontWeight:600}} dangerouslySetInnerHTML={{__html:numFmt(Number(r.total))}}/>
                          {yoy&&lyData&&(()=>{const ly=lyData.rows.find(lr=>lr.section===r.section&&lr.row_type===r.row_type);const lyVal=ly?Number(ly.total??0):0;const cur=Number(r.total??0);if(!lyVal)return<td className="tr mono muted">—</td>;const pct=((cur-lyVal)/Math.abs(lyVal)*100).toFixed(1);const pos=parseFloat(pct)>=0;return<td style={{textAlign:"right",fontFamily:"Courier New,monospace",fontSize:11,color:pos?"#1D9E75":"#c0392b",fontWeight:600}}>{pos?"+":""}{pct}%</td>;})()}
                              </tr>
                            </React.Fragment>
                );
              }
              if((r.row_type==="detail"||r.row_type==="mfrs")&&!isOpen) return null;
              if(r.row_type==="detail"||r.row_type==="mfrs"){
                const isMfrs=r.row_type==="mfrs";
                return(
                  <tr key={i} className="det-row" style={isMfrs?{background:"#fafaf8"}:{}}>
                    <td style={{paddingLeft:24,fontSize:10,color:isMfrs?"#5f5e5a":"#1a1a18"}}>
                      {isMfrs&&<span style={{fontSize:8,padding:"1px 5px",borderRadius:2,background:"#BA7517",color:"#fff",fontWeight:700,marginRight:5}}>MFRS</span>}
                      {r.label}
                    </td>
                    {r.months.map((v,j)=><td key={j} style={{textAlign:"right",fontFamily:"Courier New,monospace",fontSize:11,color:isMfrs?"#888780":"#1a1a18"}} dangerouslySetInnerHTML={{__html:numFmt(Number(v))}}/>)}
                    <td style={{textAlign:"right",fontFamily:"Courier New,monospace",fontSize:11,color:isMfrs?"#888780":"#1a1a18"}} dangerouslySetInnerHTML={{__html:numFmt(Number(r.total))}}/>
                  </tr>
                );
              }
              if(r.row_type==="net_sales") return(
                <tr key={i} className="sub-row">
                  <td>{r.label}</td>
                  {r.months.map((v,j)=><td key={j} style={{textAlign:"right",fontFamily:"Courier New,monospace",fontSize:12,fontWeight:600}} dangerouslySetInnerHTML={{__html:numFmt(Number(v))}}/>)}
                  <td style={{textAlign:"right",fontFamily:"Courier New,monospace",fontSize:12,fontWeight:600}} dangerouslySetInnerHTML={{__html:numFmt(Number(r.total))}}/>
                      {yoy&&lyData&&(()=>{const ly=lyData.rows.find(lr=>lr.row_type==="net_sales");const lyVal=ly?Number(ly.total??0):0;const cur=Number(r.total??0);if(!lyVal)return<td className="tr mono muted">—</td>;const pct=((cur-lyVal)/Math.abs(lyVal)*100).toFixed(1);const pos=parseFloat(pct)>=0;return<td style={{textAlign:"right",fontFamily:"Courier New,monospace",fontSize:11,color:pos?"#1D9E75":"#c0392b",fontWeight:600}}>{pos?"+":""}{pct}%</td>;})()}
                      </tr>
                      );
                if(r.row_type==="summary"){
                const col=r.section==="NET_PROFIT_BEFORE"?"#7F77DD":r.section==="NET_PROFIT_AFTER"?"#185FA5":"#1D9E75";
                return(
                  <tr key={i} className="sum-row">
                    <td style={{fontWeight:700,color:col}}>{r.label}</td>
                    {r.months.map((v,j)=><td key={j} style={{textAlign:"right",fontFamily:"Courier New,monospace",fontSize:12,fontWeight:700,color:col}} dangerouslySetInnerHTML={{__html:numFmt(Number(v))}}/>)}
                    <td style={{textAlign:"right",fontFamily:"Courier New,monospace",fontSize:12,fontWeight:700,color:col}} dangerouslySetInnerHTML={{__html:numFmt(Number(r.total))}}/>
                        {yoy&&lyData&&(()=>{const ly=lyData.rows.find(lr=>lr.section===r.section&&lr.row_type==="summary");const lyVal=ly?Number(ly.total??0):0;const cur=Number(r.total??0);if(!lyVal)return<td className="tr mono muted">—</td>;const pct=((cur-lyVal)/Math.abs(lyVal)*100).toFixed(1);const pos=parseFloat(pct)>=0;return<td style={{textAlign:"right",fontFamily:"Courier New,monospace",fontSize:12,fontWeight:700,color:pos?"#1D9E75":"#c0392b"}}>{pos?"+":""}{pct}%</td>;})()}
                        </tr>
                        );
                        }
                    return null;
            })}
          </tbody>
        </table>
      </div>
      <div style={{padding:"6px 13px",background:"#fafaf8",borderTop:"1px solid #e8e7e0",fontSize:9,color:"#888780"}}>
        QM · MYR · MFRS 15 basis · {cols.length} month columns
      </div>
    </div>
  );
}
