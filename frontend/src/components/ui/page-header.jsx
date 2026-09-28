import * as React from "react";
import { cn } from "lib/utils";

// Page title block (DS Ops Hub mockup `.page-head`): title + muted subtitle
// on the left, actions bottom-aligned on the right, wrapping on small
// screens. `eyebrow` is still accepted but no longer rendered — the top-bar
// breadcrumb and the active sidebar item already show the section.
// eslint-disable-next-line no-unused-vars
function PageHeader({ eyebrow, title, subtitle, actions, className }) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-4", className)}>
      <div className="min-w-0">
        <h2 className="m-0 truncate text-[22px] font-semibold leading-tight tracking-[-0.01em] text-foreground sm:text-2xl">
          {title}
        </h2>
        {subtitle && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export { PageHeader };
