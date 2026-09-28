import React,{useState, useEffect} from "react";
import { Download } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { getLog } from "../../services/api";
import { useMonthPicker } from "../../hooks/useMonthPicker";
import MonthPicker from "../Shared/MonthPicker";
import { showToast } from "../../utils/toast";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Card } from "../ui/card";
import { PageHeader } from "../ui/page-header";
import { PageShell, FilterBar, FilterLabel } from "../ui/page-shell";
import { TableSkeleton } from "../ui/skeleton";
import { EmptyState } from "../ui/empty-state";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "../ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "../ui/table";
import { cn } from "../../lib/utils";

// Sticky first (identifying) column keeps the invoice/ref visible while the
// rest of the row scrolls horizontally — needs its own *opaque* background
// matching its row so scrolled columns don't bleed through underneath it.
const STICKY = "sticky left-0 z-10";

const BADGE_VARIANT={split:"default",newline:"success",edit:"warning",unlock:"destructive"};
const LABEL={split:"SPLIT",newline:"NEW LINE",edit:"EDIT",unlock:"UNLOCK REQ"};

// The backend and mock data use different field names/values for the
// action and the Sales/Purchases side — normalise once here.
const rowType = r => r.action_type || r.type;
const isSalesRow = r => String(r.tab || r.journal_type || "").toLowerCase().startsWith("s");

export default function AdjLog({ entity = "QM" }) {
  const { user } = useAuth();
  const now=new Date();
  const mp=useMonthPicker(now.getFullYear(),now.getMonth(),now.getFullYear(),11);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [type,setType]=useState("all");
  const [tab,setTab]=useState("all");

  // The backend already filters by entity and date range, so the list
  // below only applies the Type / Tab filters client-side. (A client-side
  // date filter used to compare the display timestamp "28 Aug 2026" to ISO
  // dates as plain strings, which kept/dropped rows at random.)
  useEffect(() => {
    if (!user) return;
    setLoading(true);
    getLog(entity || "QM", user.role, user.user_id, mp.fromStr, mp.toStr)
      .then(r => setRows(Array.isArray(r.data) ? r.data : []))
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [entity, user?.user_id, mp.fromStr, mp.toStr]);

  const filtered=rows.filter(r=>
    (type==="all"||rowType(r)===type) &&
    (tab==="all"||(tab==="sales")===isSalesRow(r))
  );

  const exportCSV = () => {
    if (!filtered.length) { showToast("⚠ No log entries to export."); return; }
    const headers = ["Timestamp","User","Action","Tab","Invoice / Ref","Detail","Period"];
    const lines = filtered.map(r => [r.ts, r.user, LABEL[rowType(r)] || rowType(r), isSalesRow(r) ? "Sales" : "Purchases", r.ref, r.detail, r.period]);
    const csv = [headers, ...lines]
      .map(l => l.map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `adjustment_log_${entity}_${mp.fromStr}_${mp.toStr}.csv`;
    a.click();
  };

  return(
    <PageShell>
      <PageHeader
        eyebrow="Adjustment"
        title="Log"
        subtitle={`${entity} · ${mp.fromLabel}–${mp.toLabel} · all activity`}
        actions={<Button variant="outline" size="sm" onClick={exportCSV}><Download className="h-3.5 w-3.5" /> Export CSV</Button>}
      />

      <FilterBar>
        <FilterLabel>Period</FilterLabel>
        <MonthPicker label={mp.fromLabel} state={mp.s} side="from" onSelect={mp.sel}/>
        <span>–</span>
        <MonthPicker label={mp.toLabel} state={mp.s} side="to" onSelect={mp.sel}/>
        <FilterLabel>Type</FilterLabel>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="split">Split</SelectItem>
            <SelectItem value="newline">New line</SelectItem>
            <SelectItem value="edit">Edit</SelectItem>
            <SelectItem value="unlock">Unlock req.</SelectItem>
          </SelectContent>
        </Select>
        <FilterLabel>Tab</FilterLabel>
        <Select value={tab} onValueChange={setTab}>
          <SelectTrigger className="h-8 w-28"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="sales">Sales</SelectItem>
            <SelectItem value="pur">Purchases</SelectItem>
          </SelectContent>
        </Select>
      </FilterBar>

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 px-[18px] pb-2.5 pt-3.5">
          <h3 className="text-base font-semibold">Adjustment log</h3>
          <p className="text-xs text-muted-foreground">{filtered.length} {filtered.length === 1 ? "entry" : "entries"}</p>
        </div>
        {loading && !rows.length ? <TableSkeleton cols={7} /> : !filtered.length ? (
          <EmptyState title="No log entries" hint="Nothing matches this period and filter combination." />
        ) : (
          <div className="overflow-x-auto">
            <Table className="min-w-[900px]">
              <TableHeader>
                <TableRow>
                  {["Timestamp","User","Action","Tab","Invoice / Ref","Detail","Period"].map(h=>(
                    <TableHead key={h} className={cn(h==="Invoice / Ref" && [STICKY, "min-w-[110px] bg-card"])}>{h}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r,i)=>(
                  <TableRow key={i}>
                    <TableCell className="whitespace-nowrap">{r.ts}</TableCell>
                    <TableCell>{r.user}</TableCell>
                    <TableCell><Badge variant={BADGE_VARIANT[rowType(r)]}>{LABEL[rowType(r)] || rowType(r)}</Badge></TableCell>
                    <TableCell>
                      <Badge variant={isSalesRow(r)?"default":"success"}>{isSalesRow(r)?"Sales":"Purchases"}</Badge>
                    </TableCell>
                    <TableCell className={cn(STICKY, "bg-card font-mono text-[11px] text-primary")}>{r.ref}</TableCell>
                    <TableCell className="max-w-[300px] text-muted-foreground">{r.detail}</TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">{r.period}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>
    </PageShell>
  );
}
