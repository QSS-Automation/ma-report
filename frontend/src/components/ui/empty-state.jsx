import * as React from "react";
import { Inbox } from "lucide-react";
import { cn } from "lib/utils";

// One wording + look for "nothing to show" across every tab.
function EmptyState({ title = "No data for this period", hint = "Try a different period or entity.", className }) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-1.5 px-6 py-12 text-center", className)}>
      <Inbox className="mb-1 h-7 w-7 text-muted-foreground/60" />
      <div className="text-sm font-semibold text-foreground">{title}</div>
      {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

export { EmptyState };
