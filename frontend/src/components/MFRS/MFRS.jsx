
import {getMfrs} from "../../services/api";
import {MN,fmtDateShort} from "../../utils/fmt";
import {showToast} from "../../utils/toast";
import React,{useState,useCallback,useEffect,useRef,useLayoutEffect} from "react";
import { Download } from "lucide-react";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { PageHeader } from "../ui/page-header";
import { PageShell, FilterBar, FilterLabel } from "../ui/page-shell";
import { FilterPill } from "../ui/filter-pill";
import { TableSkeleton } from "../ui/skeleton";
import { EmptyState } from "../ui/empty-state";
import MonthPicker from "../Shared/MonthPicker";
import { useMonthPicker } from "../../hooks/useMonthPicker";
import { DropdownPortal, ColumnMenu, HeaderMarks, matchesFilter, menuValues } from "../Shared/ColumnFilter";
import { cn } from "../../lib/utils";

const PRESETS = [
  { key: "ty", label: "This year" },
  { key: "ly", label: "Last year" },
  { key: "tm", label: "This month" },
  { key: "lm", label: "Last month" },
];

export default function MFRS({defaultSub="sales", entity = "QM" }){
  const now=new Date();
  // Same month-picker as every other report tab (was two native date inputs).
  const mp=useMonthPicker(now.getFullYear(),0,now.getFullYear(),11);
  const from=mp.fromStr, to=mp.toStr;
  const [sub,setSub]=useState(defaultSub);
  const [data,setData]=useState({sales:null,pur:null});
  const [loading,setLoading]=useState(false);
  const [preset,setPreset]=useState("ty");

  // MFRS never unmounts when switching between the sidebar's "Sales" and
  // "Purchases" MFRS entries — App.jsx just updates `defaultSub` on the
  // same mounted instance — so without this, `sub` (seeded once at mount
  // via useState) would never follow later nav clicks. The in-page
  // Sales/Purchases switcher was removed since it duplicated that nav.
  useEffect(() => { setSub(defaultSub); }, [defaultSub]);
  const run=useCallback(async()=>{
    setLoading(true);
    try{
      const [s,p]=await Promise.all([getMfrs(entity,"SALES",from,to),getMfrs(entity,"PURCHASE",from,to)]);
      setData({sales:s.data,pur:p.data});
    }catch(e){showToast("⚠ "+e.message);}
    finally{setLoading(false);}
  // `entity` must be a dependency — without it, Run Report after switching
  // entity kept fetching the previously selected one.
  },[entity,from,to]);

  // Run on first open and whenever the entity changes.
  useEffect(() => { setData(null); run(); }, [entity]);

  const applyPreset=p=>{ setPreset(p); mp.preset(p); };

  const cur=data?.[sub];
  const exportCSV = () => {
  if (!cur) { showToast("⚠ Run report first."); return; }
  const mks = cur.month_columns || [];
  const isPur = sub !== "sales";
  const headers = ["Doc Date","Debtor Name","Proj. Code","Doc No",...(isPur?["Ref. 2"]:[]),"Description","Start Date","End Date","Days","YTD",...mks];
  const rows = (cur.rows||[]).map(r => {
    const ytd = mks.reduce((sum,mk)=>sum+(Number(r.monthly?.[mk])||0), 0);
    return [
      r.trans_date ? String(r.trans_date).slice(0,10) : "", r.de_acc_desc, r.proj_no, r.doc_no, ...(isPur?[r.ref_no2]:[]), r.description,
      r.start_date ? String(r.start_date).slice(0,10) : "", r.end_date ? String(r.end_date).slice(0,10) : "",
      r.total_days,
      ytd.toFixed(2),
      ...mks.map(mk => Number(r.monthly?.[mk]||0).toFixed(2))
    ];
  });
  const csv = [headers,...rows]
    .map(r => r.map(v=>`"${String(v??"").replace(/"/g,'""')}"`).join(","))
    .join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv],{type:"text/csv"}));
  a.download = `mfrs_${sub}_${from}_${to}.csv`;
  a.click();
};
  return(
    <PageShell>
          <PageHeader
            eyebrow="MFRS"
            title={sub==="sales" ? "MFRS — Sales" : "MFRS — Purchases"}
            subtitle={`${entity} · ${mp.fromLabel}–${mp.toLabel} · daily ${sub==="sales"?"revenue":"cost"} recognition by contract period`}
            actions={<Button variant="outline" size="sm" onClick={exportCSV}><Download className="h-3.5 w-3.5" /> Export CSV</Button>}
          />

          <FilterBar>
            <FilterLabel>Period</FilterLabel>
            <MonthPicker label={mp.fromLabel} state={mp.s} side="from" onSelect={mp.sel}/>
            <span>–</span>
            <MonthPicker label={mp.toLabel} state={mp.s} side="to" onSelect={mp.sel}/>
            {PRESETS.map(p=>(
              <FilterPill key={p.key} active={preset===p.key} onClick={()=>applyPreset(p.key)}>{p.label}</FilterPill>
            ))}
            <Button className="ml-auto" size="lg" onClick={run} disabled={loading}>{loading?"Loading…":"Run Report"}</Button>
          </FilterBar>

          <p className="text-xs leading-relaxed text-muted-foreground">
            <strong className="text-foreground">MFRS 15 revenue recognition</strong> — each contract amount is spread daily over the contract period. Columns generated from your selected date range.
          </p>

          <Card className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 px-[18px] pb-2.5 pt-3.5">
              <h3 className="text-base font-semibold">{sub==="sales"?"Sales — Revenue recognition by contract":"Purchases — Cost recognition by contract"}</h3>
              <p className="text-xs text-muted-foreground">{entity}</p>
            </div>
            {cur&&cur.rows.length>0?(
              <MfrsTable key={sub} data={cur} isSales={sub==="sales"}/>
            ):(
              loading ? <TableSkeleton/> : <EmptyState/>
            )}
            <div className="flex justify-between px-4 py-2.5 text-[11px] text-muted-foreground">
              <span>{entity} · MYR · MFRS 15</span>
              <span>Value = Amount × (days overlap / total days) for each period</span>
            </div>
          </Card>
    </PageShell>
  );
}

// Column definitions for the MFRS table, in display order. `kind` picks the
// header filter (see Shared/ColumnFilter). `pin` columns (Days, YTD) are
// always frozen; the leading columns freeze as far as they fit (FREEZE_SHARE),
// and any columns in between slide underneath Days/YTD when scrolling.
const ytdOf = (r, mks) => mks.reduce((sum, mk) => sum + (Number(r.monthly?.[mk]) || 0), 0);
const fmtAmt = v => Number(v).toLocaleString("en-MY", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = d => (d ? fmtDateShort(String(d).slice(0, 10)) : "—");

function mfrsColumns(isSales, mks) {
  // Ref. 2 applies to Purchases only. maxWidth keeps long text compact
  // (full value in the cell's tooltip).
  return [
    { key: "trans_date", label: "Doc Date", kind: "month", minWidth: 96, get: r => r.trans_date, show: fmtDate, muted: true },
    { key: "de_acc_desc", label: "Debtor Name", kind: "text", minWidth: 150, maxWidth: 200, get: r => r.de_acc_desc, strong: true },
    { key: "proj_no", label: "Proj. Code", kind: "text", minWidth: 90, get: r => r.proj_no },
    { key: "doc_no", label: "Doc No", kind: "text", minWidth: 118, get: r => r.doc_no, muted: true },
    ...(isSales ? [] : [{ key: "ref_no2", label: "Ref. 2", kind: "text", minWidth: 90, get: r => r.ref_no2 }]),
    { key: "description", label: "Description", kind: "text", minWidth: 180, maxWidth: 240, get: r => r.description },
    { key: "start_date", label: "Start Date", kind: "month", minWidth: 96, get: r => r.start_date, show: fmtDate },
    { key: "end_date", label: "End Date", kind: "month", minWidth: 96, get: r => r.end_date, show: fmtDate },
    { key: "total_days", label: "Days", kind: "count", pin: true, minWidth: 60, get: r => r.total_days, num: true },
    { key: "ytd", label: "YTD", kind: "range", pin: true, minWidth: 110, get: r => ytdOf(r, mks), num: true, show: v => (v !== 0 ? fmtAmt(v) : null) },
  ];
}

// Frozen columns may take at most this share of the visible table width,
// so the month columns always stay reachable on smaller screens.
const FREEZE_SHARE = 0.6;

// Sticky header cell with the shared sort/filter menu.
function MfrsTh({ col, frozen, left, edge, sort, filter, openMenu, setOpenMenu, onSort, onFilter, values }) {
  const thRef = useRef(null);
  const isOpen = openMenu === col.key;
  const isSorted = sort.key === col.key;
  return (
    <th ref={thRef}
      className={cn(frozen ? "mf2-th-fix" : "mf2-th-info", edge && "mf2-edge")}
      style={{
        top: 0, position: "sticky", zIndex: frozen ? 4 : 3, minWidth: col.minWidth, padding: 0,
        ...(frozen ? { left } : {}),
      }}>
      <div className="flex cursor-pointer select-none items-center gap-1" style={{ padding: "11px 14px", justifyContent: col.num ? "flex-end" : "flex-start" }}
        onClick={() => setOpenMenu(isOpen ? null : col.key)}>
        <span className={cn("whitespace-nowrap", !col.num && "flex-1")}>{col.label}</span>
        <HeaderMarks isSorted={isSorted} sortDir={sort.dir} active={filter} isOpen={isOpen} />
      </div>
      {isOpen && (
        <DropdownPortal anchorRef={thRef} onClose={() => setOpenMenu(null)}>
          <ColumnMenu kind={col.kind} isSorted={isSorted} sortDir={sort.dir} active={filter}
            values={values()}
            onSort={dir => onSort(col.key, dir)} onFilter={v => onFilter(col.key, v)} onClose={() => setOpenMenu(null)} />
        </DropdownPortal>
      )}
    </th>
  );
}

function MfrsTable({ data, isSales }) {
  const mks = data.month_columns;
  const cols = mfrsColumns(isSales, mks);

  const [sort, setSort] = useState({ key: null, dir: "asc" });
  const [colFilter, setColFilter] = useState({});
  const [openMenu, setOpenMenu] = useState(null);

  // Freeze as many leading columns as fit in FREEZE_SHARE of the visible
  // width; offsets = running sum of the preceding header widths. Re-measured
  // when the container or any of those header cells changes size.
  const wrapRef = useRef(null);
  const headRowRef = useRef(null);
  const [layout, setLayout] = useState({ fit: cols.length, lefts: [] });
  useLayoutEffect(() => {
    const row = headRowRef.current, wrap = wrapRef.current; if (!row || !wrap) return;
    const ths = [...row.children].slice(0, cols.length);
    const measure = () => {
      const widths = ths.map(th => th.getBoundingClientRect().width);
      const pinW = cols.reduce((sum, c, i) => sum + (c.pin ? widths[i] : 0), 0);
      const limit = wrap.clientWidth * FREEZE_SHARE - pinW;
      // leading (non-pinned) columns that fit
      let x = 0, fit = 0;
      for (let i = 0; i < cols.length && !cols[i].pin; i++) { if (x + widths[i] > limit && fit > 0) break; x += widths[i]; fit++; }
      // offsets: frozen prefix from 0, pinned columns right after it
      const lefts = []; let px = 0, pinX = 0;
      cols.forEach((c, i) => {
        if (i < fit) { lefts.push(Math.round(px)); px += widths[i]; }
        else if (c.pin) { lefts.push(Math.round(px + pinX)); pinX += widths[i]; }
        else lefts.push(0);
      });
      setLayout(p => (p.fit === fit && p.lefts.length === lefts.length && p.lefts.every((v, i) => v === lefts[i]) ? p : { fit, lefts }));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ths.forEach(th => ro.observe(th)); ro.observe(wrap);
    return () => ro.disconnect();
  }, [cols.length]);

  const onFilter = (key, v) => setColFilter(p => {
    const n = { ...p };
    if (v === null || (Array.isArray(v) && !v.length)) delete n[key]; else n[key] = v;
    return n;
  });
  const onSort = (key, dir) => setSort({ key, dir });

  const rows = data.rows.filter(r => cols.every(c => matchesFilter(c.kind, colFilter[c.key], c.get(r))));
  if (sort.key) {
    const c = cols.find(x => x.key === sort.key);
    const num = c.kind === "range" || c.kind === "count";
    rows.sort((a, b) => {
      const va = c.get(a), vb = c.get(b);
      const d = num ? (Number(va) || 0) - (Number(vb) || 0) : String(va ?? "").localeCompare(String(vb ?? ""));
      return sort.dir === "asc" ? d : -d;
    });
  }

  // Totals follow the filtered rows.
  const totals = {};
  mks.forEach(mk => { totals[mk] = rows.reduce((s, r) => s + (Number(r.monthly[mk]) || 0), 0); });
  const totalYtd = mks.reduce((s, mk) => s + totals[mk], 0);

  const idx = c => cols.indexOf(c);
  const isFrozen = c => !!c.pin || idx(c) < layout.fit;
  const leftOf = c => layout.lefts[idx(c)] ?? 0;
  const lastFrozen = [...cols].reverse().find(isFrozen);
  const isEdge = c => c === lastFrozen;
  const dash = <span className="mf2-td-dash">-</span>;

  const baseStyle = c => ({
    textAlign: c.num ? "right" : "left",
    ...(isFrozen(c) ? { left: leftOf(c) } : {}),
    ...(c.maxWidth ? { maxWidth: c.maxWidth, overflow: "hidden", textOverflow: "ellipsis" } : {}),
  });

  const cell = (c, r) => {
    const v = c.get(r);
    const shown = c.show ? c.show(v) : v;
    const empty = shown === null || shown === undefined || shown === "";
    const style = {
      ...baseStyle(c),
      ...(c.strong ? { fontWeight: 500 } : {}),
      ...(c.muted ? { color: "hsl(var(--muted-foreground))" } : {}),
      ...(c.key === "ytd" ? { fontWeight: 600 } : {}),
    };
    return (
      <td key={c.key} className={cn(isFrozen(c) ? "mf2-td-fix" : "mf2-td-info", isEdge(c) && "mf2-edge")} style={style}
        title={c.maxWidth && !empty ? String(shown) : undefined}>
        {empty ? (c.key === "ytd" ? dash : "—") : shown}
      </td>
    );
  };

  const monthCell = (r, mk) => {
    const v = Number(r.monthly[mk]) || 0;
    return (
      <td key={mk} className="mf2-td-num"
        title={v ? `${MN[parseInt(mk.split("-m")[1]) - 1]} ${mk.split("-m")[0]}: ${fmtAmt(v)}` : undefined}>
        {v ? fmtAmt(v) : dash}
      </td>
    );
  };

  const filtered = Object.keys(colFilter).length > 0;
  const partlyFrozen = layout.fit < cols.filter(c => !c.pin).length;

  return (
    <>
      {(filtered || partlyFrozen) && <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-[18px] pb-2 text-[12px] text-muted-foreground">
        {filtered && (
          <span className="flex items-center gap-2">
            Showing {rows.length} of {data.rows.length} lines
            <button type="button" className="bg-transparent font-semibold text-primary hover:underline" onClick={() => setColFilter({})}>Clear filters</button>
          </span>
        )}
        {partlyFrozen && <span>Some columns scroll under Days / YTD to fit the screen — widen the window or collapse the sidebar to freeze more.</span>}
      </div>}
      {/* Own scroll area: headers stay visible while the contract lines scroll. */}
      <div ref={wrapRef} className="mf2-wrap max-h-[calc(100vh-260px)] overflow-auto border-t border-border">
        <table className="mf2-table">
          <thead><tr ref={headRowRef}>
            {cols.map(c => (
              <MfrsTh key={c.key} col={c} frozen={isFrozen(c)} left={leftOf(c)} edge={isEdge(c)} sort={sort} filter={colFilter[c.key]}
                openMenu={openMenu} setOpenMenu={setOpenMenu} onSort={onSort} onFilter={onFilter}
                values={() => menuValues(c.kind, data.rows.map(c.get))} />
            ))}
            {mks.map(mk => {
              const [yr, mpart] = mk.split("-m");
              const mo = parseInt(mpart) - 1;
              return <th key={mk} className="mf2-th-num" style={{ position: "sticky", top: 0, zIndex: 3 }}>
                {MN[mo]}<span className="mf2-yr">{yr}</span>
              </th>;
            })}
          </tr></thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.gl_dtl_key != null ? `${r.gl_dtl_key}-${r.split_index}-${r.recognised_year}` : i} className="mf2-tr-row">
                {cols.map(c => cell(c, r))}
                {mks.map(mk => monthCell(r, mk))}
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={cols.length + mks.length} className="mf2-td-info" style={{ textAlign: "left", padding: "28px 16px" }}>
                No contracts match these filters.
              </td></tr>
            )}
            <tr className="mf2-tr-total">
              {cols.map(c => (
                <td key={c.key} className={cn(isFrozen(c) ? "mf2-td-fix" : "mf2-td-info", isEdge(c) && "mf2-edge")} style={baseStyle(c)}>
                  {c === cols[0] ? "Total" : c.key === "ytd" ? fmtAmt(totalYtd) : ""}
                </td>
              ))}
              {mks.map(mk => <td key={mk} className="mf2-td-num">
                {totals[mk] !== 0 ? fmtAmt(totals[mk]) : dash}
              </td>)}
            </tr>
          </tbody>
        </table>
      </div>
    </>
  );
}
