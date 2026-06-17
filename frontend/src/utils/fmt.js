export const MN = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
export const pad2 = n => n < 10 ? "0" + n : String(n);
export const fmtMYR = n => {
  if (n === null || n === undefined) return "—";
  const abs = Math.abs(Number(n));
  const fmt = abs.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return Number(n) < 0 ? `(${fmt})` : fmt;
};("en-MY");

export const fmtMYRK = n => {
  const v = Number(n);
  if (!v) return "0.00";
  const abs = Math.abs(v);
  if (abs >= 1e6) return (v < 0 ? "-" : "") + (abs / 1e6).toFixed(2) + "M";
  if (abs >= 1e3) return (v < 0 ? "-" : "") + (abs / 1e3).toFixed(2) + "K";
  return v.toFixed(2);
};
export const numFmt = n => {
  if (!n && n !== 0) return "<span class='muted'>—</span>";
  const abs = Math.abs(Number(n));
  const fmt = abs.toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return Number(n) < 0
    ? `<span class='neg'>(${fmt})</span>`
    : fmt;
};
export function fmtDateShort(s) {
  const d = new Date(s+"T00:00:00");
  return d.getDate()+" "+MN[d.getMonth()]+ " "+d.getFullYear();
}
export function monthStarts(from, to) {
  const cols=[]; let y=from.getFullYear(),m=from.getMonth();
  const ey=to.getFullYear(),em=to.getMonth();
  while(y<ey||(y===ey&&m<=em)){cols.push(new Date(y,m,1));m++;if(m>11){m=0;y++;}}
  return cols;
}
export const ymStr = d => d.getFullYear()+"-"+pad2(d.getMonth()+1);
