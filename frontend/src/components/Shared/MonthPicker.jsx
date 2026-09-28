import React, { useState } from "react";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { MN } from "../../utils/fmt";
import { cn } from "../../lib/utils";
import { Popover, PopoverTrigger, PopoverContent } from "../ui/popover";

export default function MonthPicker({ label, state, side, onSelect }) {
  const [open, setOpen] = useState(false);
  const curYear = side === "from" ? state.fromYear : state.toYear;
  const curMonth = side === "from" ? state.fromMonth : state.toMonth;
  const [vy, setVy] = useState(curYear);
  const fa = state.fromYear * 12 + state.fromMonth, ta = state.toYear * 12 + state.toMonth;

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (o) setVy(curYear); }}>
      <PopoverTrigger asChild>
        <button className="flex h-8 min-w-[104px] items-center justify-between gap-2 whitespace-nowrap rounded-lg border border-input bg-card px-2.5 text-[13px] text-foreground hover:border-primary/50">
          {label}
          <ChevronDown className="h-3.5 w-3.5 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-64 rounded-xl p-4">
        <div className="mb-3 flex items-center justify-between border-b border-border pb-3">
          <button className="flex h-7 w-7 items-center justify-center rounded-full text-primary transition-colors hover:bg-accent" onClick={() => setVy(v => v - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-base font-bold">{vy}</span>
          <button className="flex h-7 w-7 items-center justify-center rounded-full text-primary transition-colors hover:bg-accent" onClick={() => setVy(v => v + 1)}>
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          {MN.map((m, i) => {
            const abs = vy * 12 + i, isSel = vy === curYear && i === curMonth, inR = !isSel && abs > fa && abs < ta;
            return (
              <div
                key={i}
                className={cn(
                  "cursor-pointer rounded-lg border border-transparent px-1 py-2 text-center text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground",
                  isSel && "bg-primary font-bold text-primary-foreground hover:bg-primary hover:text-primary-foreground",
                  inR && "bg-accent text-accent-foreground"
                )}
                onClick={() => { onSelect(side, vy, i); setOpen(false); }}
              >
                {m}
              </div>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
