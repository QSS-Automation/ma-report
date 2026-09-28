import * as React from "react";
import { cn } from "lib/utils";

// Two-or-more option switch (e.g. Classic / New P&L). Shows every option
// at once, so the current choice and the alternative are both obvious.
function Segmented({ value, onChange, options, className }) {
  return (
    <div role="radiogroup" className={cn("inline-flex rounded-lg border border-border bg-secondary/60 p-0.5", className)}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => !on && onChange(o.value)}
            className={cn(
              "rounded-md px-3 py-1.5 text-[13px] font-medium text-subtle transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              on ? "bg-card font-semibold text-foreground shadow-sm" : "hover:text-foreground"
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export { Segmented };
