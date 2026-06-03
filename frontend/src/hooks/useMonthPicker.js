import { useState } from "react";
import { MN, pad2 } from "../utils/fmt";
export function useMonthPicker(fy, fm, ty, tm) {
  const [s, setS] = useState({ fromYear:fy, fromMonth:fm, toYear:ty, toMonth:tm });
  const sel = (side, year, month) => setS(p => {
    const n = {...p};
    if (side==="from") { n.fromYear=year; n.fromMonth=month;
      if(year*12+month>p.toYear*12+p.toMonth){n.toYear=year;n.toMonth=month;} }
    else { n.toYear=year; n.toMonth=month;
      if(year*12+month<p.fromYear*12+p.fromMonth){n.fromYear=year;n.fromMonth=month;} }
    return n;
  });
  const preset = p => {
    const now=new Date(); let fy,fm,ty,tm;
    if(p==="tm"){fy=now.getFullYear();fm=now.getMonth();ty=fy;tm=fm;}
    else if(p==="lm"){const d=new Date(now.getFullYear(),now.getMonth()-1,1);fy=d.getFullYear();fm=d.getMonth();ty=fy;tm=fm;}
    else if(p==="ty"){fy=now.getFullYear();fm=0;ty=fy;tm=11;}
    else{fy=now.getFullYear()-1;fm=0;ty=fy;tm=11;}
    setS({fromYear:fy,fromMonth:fm,toYear:ty,toMonth:tm});
  };
  const lastDay = new Date(s.toYear, s.toMonth+1, 0).getDate();
  return { s, sel, preset,
    fromStr: s.fromYear+"-"+pad2(s.fromMonth+1)+"-01",
    toStr:   s.toYear+"-"+pad2(s.toMonth+1)+"-"+pad2(lastDay),
    fromLabel: MN[s.fromMonth]+" "+s.fromYear,
    toLabel:   MN[s.toMonth]+" "+s.toYear };
}
