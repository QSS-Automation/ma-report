import * as React from "react";
import { cn } from "lib/utils";
import { Card } from "./card";

function Skeleton({ className, ...props }) {
  return <div className={cn("animate-pulse rounded-md bg-muted", className)} {...props} />;
}

// Placeholder for a loading data table, shown inside the table's Card.
function TableSkeleton({ rows = 8, cols = 6 }) {
  return (
    <div className="space-y-2.5 p-4" aria-busy="true" aria-label="Loading">
      <div className="flex gap-3">
        {Array.from({ length: cols }).map((_, i) => <Skeleton key={i} className="h-3 flex-1" />)}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-3">
          {Array.from({ length: cols }).map((_, i) => (
            <Skeleton key={i} className={cn("h-4 flex-1", i === 0 && "flex-[2]")} />
          ))}
        </div>
      ))}
    </div>
  );
}

// Placeholder for a row of KPI cards.
function KpiSkeleton({ count = 4 }) {
  return Array.from({ length: count }).map((_, i) => (
    <Card key={i} className="min-w-0 space-y-1.5 px-3.5 py-2.5">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-5 w-28" />
      <Skeleton className="h-3 w-20" />
    </Card>
  ));
}

export { Skeleton, TableSkeleton, KpiSkeleton };
