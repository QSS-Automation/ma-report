import * as React from "react";
import { cn } from "lib/utils";

// Toggle/preset pill used by every filter row (This month, Last year,
// Tasks / Unlock Requests, vs Last Year…). One definition so every tab's
// selected/unselected look stays identical.
const FilterPill = React.forwardRef(({ active = false, className, type = "button", ...props }, ref) => (
  <button
    ref={ref}
    type={type}
    aria-pressed={active}
    className={cn(
      "inline-flex items-center gap-1.5 whitespace-nowrap min-h-8 rounded-full border border-border bg-card px-3 py-1 text-[12.5px] text-subtle transition-colors hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      active && "border-primary/30 bg-accent font-semibold text-primary hover:border-primary/30",
      className
    )}
    {...props}
  />
));
FilterPill.displayName = "FilterPill";

export { FilterPill };
