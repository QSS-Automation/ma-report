import * as React from "react";
import { cn } from "lib/utils";

// Every tab's outer layout: fills the App.jsx tab slot, page-level scroll,
// consistent padding/section spacing (DS Ops Hub mockup: 28px 32px 64px on
// desktop, 18px 14px on phones). Keeps the layout contract in one place.
function PageShell({ children, className }) {
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto">
        <div className={cn("space-y-4 px-3.5 pb-12 pt-4 sm:px-7 sm:pb-14 sm:pt-5", className)}>{children}</div>
      </div>
    </div>
  );
}

// Filter toolbar: a flat white surface holding labels + controls + an
// optional right-aligned action (mockup's `.ma-filters` card).
function FilterBar({ children, className }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-x-2.5 gap-y-2 rounded-xl border border-border bg-card px-3 py-2 text-[12.5px] text-subtle", className)}>
      {children}
    </div>
  );
}

function FilterLabel({ children }) {
  return <span className="font-semibold text-muted-foreground">{children}</span>;
}

// KPI tile: muted label, large tabular value, muted sub line.
function Kpi({ label, value, sub, tone, subTone, className }) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-0.5 rounded-xl border border-border bg-card px-3.5 py-2.5", className)}>
      <div className="truncate text-xs text-muted-foreground">{label}</div>
      <div className={cn("truncate text-lg font-semibold leading-tight tracking-tight tabular-nums", tone)}>{value}</div>
      {sub != null && sub !== "" && <div className={cn("truncate text-xs text-muted-foreground", subTone)}>{sub}</div>}
    </div>
  );
}

// Card heading row (mockup's `.card-head`): title left, meta/actions right.
function SectionHead({ title, meta, children, className }) {
  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-3 px-[18px] pb-2.5 pt-3.5", className)}>
      <h3 className="text-base font-semibold text-foreground">{title}</h3>
      {(meta || children) && (
        <div className="flex flex-wrap items-center gap-2 text-[13px] text-muted-foreground">{meta}{children}</div>
      )}
    </div>
  );
}

export { PageShell, FilterBar, FilterLabel, Kpi, SectionHead };
