import React from "react";
import {fmtMYRK} from "../../utils/fmt";
import { Card, CardHeader, CardTitle, CardContent } from "../ui/card";

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
    <div className="flex flex-col gap-2.5">
      <Card>
        <CardHeader><CardTitle>Revenue breakdown</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-1.5">
          {slRows.slice(0,5).map(r=>{
            const tot=r.months.reduce((a,b)=>a+(Number(b)||0),0);
            const pct=Math.max((tot/maxSl)*100,2);
            return(
              <div key={r.acc_no} className="flex min-w-0 items-center gap-1.5">
                <span className="w-[82px] shrink-0 truncate text-right text-[12px] text-muted-foreground">{r.label.slice(0,14)}</span>
                <div className="h-3.5 min-w-0 flex-1 overflow-hidden rounded-[3px] bg-muted">
                  <div className="flex h-full items-center rounded-[3px] bg-primary pl-1.5 text-[10px] font-bold text-primary-foreground" style={{width:pct+"%"}}></div>
                </div>
                <span className="shrink-0 truncate whitespace-nowrap text-[12px] font-medium">{fmtMYRK(tot)}</span>
              </div>
            );
          })}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Margin summary</CardTitle></CardHeader>
        <CardContent className="pt-2">
          <div className="mb-[3px] flex items-center justify-between gap-2 text-[12px]">
            <span className="truncate">Gross margin</span><span className="shrink-0 font-bold text-success">{nsTotal?((gpT/nsTotal)*100).toFixed(1)+"%":"—"}</span>
          </div>
          <div className="mb-2 h-[5px] overflow-hidden rounded-[3px] bg-muted">
            <div className="h-[5px] rounded-[3px] bg-success" style={{width:nsTotal?((gpT/nsTotal)*100)+"%":"0"}}/>
          </div>
          <div className="mb-[3px] flex items-center justify-between gap-2 text-[12px]">
            <span className="truncate">Net margin (after tax)</span><span className="shrink-0 font-bold text-primary">{nsTotal?((patT/nsTotal)*100).toFixed(1)+"%":"—"}</span>
          </div>
          <div className="h-[5px] overflow-hidden rounded-[3px] bg-muted">
            <div className="h-[5px] rounded-[3px] bg-primary" style={{width:nsTotal?((patT/nsTotal)*100)+"%":"0"}}/>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
