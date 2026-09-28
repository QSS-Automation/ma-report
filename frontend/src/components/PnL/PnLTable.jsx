import React,{useState} from "react";
import { ChevronRight } from "lucide-react";
import {numFmt} from "../../utils/fmt";
import { Card } from "../ui/card";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../ui/table";
import { cn } from "../../lib/utils";

const SECTION_KEYS={
  "SALES":"sl","RETURN INWARDS":"ri","COST OF GOODS SOLD":"co",
  "OTHER INCOME":"oi","OPERATING EXPENSES":"ep","TAXATION":"tx"
};

const TAG_COLORS = {
  rev: "#185FA5",
  ri: "#7B3FA0",
  cos: "#D85A30",
  oi: "#1D9E75",
  ep: "#BA7517",
  tx: "#888780",
};

// Sticky first column keeps the description visible while month columns
// scroll horizontally — each row style below needs its own *opaque*
// background repeated on the sticky cell (a semi-transparent bg would let
// the scrolling columns show through underneath it).
const STICKY = "sticky left-0 z-10 w-[260px] min-w-[260px] max-w-[260px]";
// Total sits right after Description and is frozen with it (offset = the
// Description column's fixed 260px width); the right edge shadow marks where
// the scrolling month columns start.
const TOTAL = "sticky left-[260px] z-10 min-w-[130px] border-r-2 border-border shadow-[6px_0_8px_-6px_rgba(0,0,0,0.15)]";

export default function PnLTable({data,yoy,lyData}){
  const [open,setOpen]=useState({});
  const cols=data.month_labels;
  const toggle=k=>setOpen(p=>({...p,[k]:!p[k]}));
  const anyOpen=Object.values(open).some(Boolean);

  return(
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-[18px] pb-2.5 pt-3.5">
        <h3 className="text-base font-semibold">Profit &amp; Loss — Detail</h3>
        <p className="whitespace-nowrap text-xs text-muted-foreground">{cols[0]}–{cols[cols.length-1]} · {cols.length} months</p>
      </div>
      <div
        className="flex cursor-pointer select-none items-center gap-1.5 px-4 pb-2 text-[12px] font-medium text-primary"
        onClick={()=>{
          const all=!anyOpen; const nxt={};
          Object.values(SECTION_KEYS).forEach(k=>{nxt[k]=all;}); setOpen(nxt);
        }}
      >
        <ChevronRight className={cn("h-3 w-3 transition-transform", anyOpen && "rotate-90")} />
        <span>{anyOpen?"Collapse all sections":"Expand all sections"}</span>
      </div>
      <div className="overflow-x-auto">
        <Table className="min-w-[300px]">
          <TableHeader>
            <TableRow>
              <TableHead className={cn(STICKY, "z-20 bg-card text-left")}>Description</TableHead>
              <TableHead className={cn(TOTAL, "z-20 bg-card text-right")}>Total</TableHead>
              {cols.map(c=><TableHead key={c} className="text-right">{c}</TableHead>)}
              {yoy&&lyData&&<TableHead className="whitespace-nowrap text-right">YoY %</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.rows.map((r,i)=>{
              const k=SECTION_KEYS[r.section]||r.section.toLowerCase().replace(/[ /]/g,"_");
              const isOpen=open[k];
              if(r.row_type==="subtotal"){
                return(
                  <React.Fragment key={i}>
                    <TableRow className="cursor-pointer bg-muted/60 hover:bg-muted" onClick={()=>toggle(k)}>
                      <TableCell className={cn(STICKY, "bg-[hsl(var(--muted))] font-semibold")}>
                        <ChevronRight className={cn("mr-1.5 inline-block h-3 w-3 text-muted-foreground transition-transform", isOpen && "rotate-90")} />
                        {r.tag&&<span className="mr-1.5 rounded-[2px] px-1.5 py-px text-[10px] font-bold text-white" style={{background:TAG_COLORS[r.tag]||"#444"}}>{r.tag==="ri"?"RI":r.tag.toUpperCase()}</span>}
                        {r.label}
                      </TableCell>
                      <TableCell className={cn(TOTAL, "bg-[hsl(var(--muted))]", "text-right font-mono text-xs font-semibold")} dangerouslySetInnerHTML={{__html:numFmt(Number(r.total))}}/>
                      {r.months.map((v,j)=><TableCell key={j} className="text-right font-mono text-xs font-semibold" dangerouslySetInnerHTML={{__html:numFmt(Number(v))}}/>)}
                      {yoy&&lyData&&(()=>{const ly=lyData.rows.find(lr=>lr.section===r.section&&lr.row_type===r.row_type);const lyVal=ly?Number(ly.total??0):0;const cur=Number(r.total??0);if(!lyVal)return<TableCell className="text-right font-mono text-muted-foreground">—</TableCell>;const pct=((cur-lyVal)/Math.abs(lyVal)*100).toFixed(1);const pos=parseFloat(pct)>=0;return<TableCell className={cn("text-right font-mono text-[12px] font-semibold",pos?"text-success":"text-destructive")}>{pos?"+":""}{pct}%</TableCell>;})()}
                    </TableRow>
                  </React.Fragment>
                );
              }
              if((r.row_type==="detail"||r.row_type==="mfrs")&&!isOpen) return null;
              if(r.row_type==="detail"||r.row_type==="mfrs"){
                const isMfrs=r.row_type==="mfrs";
                return(
                  <TableRow key={i} className={isMfrs?"bg-muted/40":undefined}>
                    <TableCell className={cn(STICKY, isMfrs?"bg-[hsl(var(--muted))]":"bg-card", "pl-6 text-[11px]", isMfrs?"text-muted-foreground":"text-foreground")}>
                      {isMfrs&&<span className="mr-1.5 rounded-[2px] bg-warning px-1.5 py-px text-[10px] font-bold text-white">MFRS</span>}
                      {r.label}
                    </TableCell>
                    <TableCell className={cn(TOTAL, isMfrs?"bg-[hsl(var(--muted))]":"bg-card", "text-right font-mono text-[12px]", isMfrs?"text-muted-foreground":"text-foreground")} dangerouslySetInnerHTML={{__html:numFmt(Number(r.total))}}/>
                    {r.months.map((v,j)=><TableCell key={j} className={cn("text-right font-mono text-[12px]", isMfrs?"text-muted-foreground":"text-foreground")} dangerouslySetInnerHTML={{__html:numFmt(Number(v))}}/>)}
                  </TableRow>
                );
              }
              if(r.row_type==="net_sales") return(
                <TableRow key={i} className="bg-muted/40 font-semibold">
                  <TableCell className={cn(STICKY, "bg-[hsl(var(--muted))]")}>{r.label}</TableCell>
                  <TableCell className={cn(TOTAL, "bg-[hsl(var(--muted))]", "text-right font-mono text-xs font-semibold")} dangerouslySetInnerHTML={{__html:numFmt(Number(r.total))}}/>
                  {r.months.map((v,j)=><TableCell key={j} className="text-right font-mono text-xs font-semibold" dangerouslySetInnerHTML={{__html:numFmt(Number(v))}}/>)}
                  {yoy&&lyData&&(()=>{const ly=lyData.rows.find(lr=>lr.row_type==="net_sales");const lyVal=ly?Number(ly.total??0):0;const cur=Number(r.total??0);if(!lyVal)return<TableCell className="text-right font-mono text-muted-foreground">—</TableCell>;const pct=((cur-lyVal)/Math.abs(lyVal)*100).toFixed(1);const pos=parseFloat(pct)>=0;return<TableCell className={cn("text-right font-mono text-[12px] font-semibold",pos?"text-success":"text-destructive")}>{pos?"+":""}{pct}%</TableCell>;})()}
                </TableRow>
              );
              if(r.row_type==="summary"){
                const tone=r.section==="NET_PROFIT_BEFORE"?"text-[#7F77DD]":r.section==="NET_PROFIT_AFTER"?"text-primary":"text-success";
                return(
                  <TableRow key={i} className="border-y-2 border-primary/20 bg-accent">
                    <TableCell className={cn(STICKY, "bg-[hsl(var(--accent))] font-bold", tone)}>{r.label}</TableCell>
                    <TableCell className={cn(TOTAL, "bg-[hsl(var(--accent))]", "text-right font-mono text-xs font-bold", tone)} dangerouslySetInnerHTML={{__html:numFmt(Number(r.total))}}/>
                    {r.months.map((v,j)=><TableCell key={j} className={cn("text-right font-mono text-xs font-bold", tone)} dangerouslySetInnerHTML={{__html:numFmt(Number(v))}}/>)}
                    {yoy&&lyData&&(()=>{const ly=lyData.rows.find(lr=>lr.section===r.section&&lr.row_type==="summary");const lyVal=ly?Number(ly.total??0):0;const cur=Number(r.total??0);if(!lyVal)return<TableCell className="text-right font-mono text-muted-foreground">—</TableCell>;const pct=((cur-lyVal)/Math.abs(lyVal)*100).toFixed(1);const pos=parseFloat(pct)>=0;return<TableCell className={cn("text-right font-mono text-xs font-bold",pos?"text-success":"text-destructive")}>{pos?"+":""}{pct}%</TableCell>;})()}
                  </TableRow>
                );
              }
              return null;
            })}
          </TableBody>
        </Table>
      </div>
      <div className="px-4 py-2.5 text-[11px] text-muted-foreground">
        QM · MYR · MFRS 15 basis · {cols.length} month columns
      </div>
    </Card>
  );
}
