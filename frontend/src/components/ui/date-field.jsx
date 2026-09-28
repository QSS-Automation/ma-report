import * as React from "react";
import { createPortal } from "react-dom";
import { CalendarDays, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { cn } from "lib/utils";
import { showToast } from "../../utils/toast";

// Date field with a custom calendar popover (modelled on the Square
// Traveller DatePicker: « ‹ Month Year › » navigation, weekday grid,
// Clear / Today). The field itself is a plain text box, so a date can be
// typed, copied (Ctrl+C) and pasted (Ctrl+V) — e.g. copy a Start Date and
// paste it into End Date. Accepted input: 2026-01-15, 15/01/2026,
// 15-01-2026, 15.01.2026, 15 Jan 2026, 15-Jan-2026, 2026/01/15.
//
// value / onChange use ISO "YYYY-MM-DD" ("" = empty), same as the native
// date input it replaces. Works controlled (pass `value`) or uncontrolled
// (omit `value`; the field keeps its own state and still calls onChange).
// `copyFrom` (ISO string, or a function returning one) adds a
// "Same as start date" shortcut to the calendar footer.

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MON = ["jan","feb","mar","apr","may","jun","jul","aug","sep","oct","nov","dec"];
const pad = n => String(n).padStart(2, "0");
const toIso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromIso = s => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || "");
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
};
const fmt = iso => {
  const d = fromIso(iso);
  return d ? d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "";
};
const valid = (y, m, d) => {
  const dt = new Date(y, m - 1, d);
  return y > 1900 && dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d ? toIso(dt) : null;
};

// Parse typed/pasted text into ISO, or null if it isn't a date.
export function parseDate(text) {
  const t = String(text || "").trim().replace(/\s+/g, " ");
  if (!t) return "";
  let m;
  if ((m = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(t))) return valid(+m[1], +m[2], +m[3]);        // 2026-01-15
  if ((m = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/.exec(t))) return valid(+m[3], +m[2], +m[1]);       // 15/01/2026 (day first)
  if ((m = /^(\d{1,2})[ -]([A-Za-z]{3,9})[ -,]*(\d{4})$/.exec(t))) {                                   // 15 Jan 2026
    const mi = MON.indexOf(m[2].slice(0, 3).toLowerCase());
    return mi >= 0 ? valid(+m[3], mi + 1, +m[1]) : null;
  }
  return null;
}

function buildWeeks(year, month) {
  const start = new Date(year, month, 1);
  start.setDate(start.getDate() - start.getDay());
  return Array.from({ length: 6 }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + w * 7 + d)));
}

const navBtn = "flex h-7 w-7 items-center justify-center rounded-md border border-border bg-card text-subtle transition-colors hover:border-primary/50 hover:text-primary";

// Pasting is restricted to the one-day case: only a field given `pasteOnly`
// (the Start Date, as ISO or a function returning it) accepts a paste, and
// only when the pasted date equals it — i.e. pasting the Start Date into End
// Date for a 1-day item. Any other paste is refused with a short hint.
export function DateField({ value, defaultValue, onChange, readOnly = false, disabled = false, className, width = 104, copyFrom, pasteOnly, tone, placeholder = "dd Mmm yyyy" }) {
  const controlled = value !== undefined;
  const [inner, setInner] = React.useState(defaultValue || "");
  const iso = controlled ? (value || "") : inner;

  const [text, setText] = React.useState(fmt(iso));
  const [editing, setEditing] = React.useState(false);
  const [invalid, setInvalid] = React.useState(false);
  const [open, setOpen] = React.useState(false);
  const [pos, setPos] = React.useState(null);
  const today = new Date();
  const [view, setView] = React.useState({ y: today.getFullYear(), m: today.getMonth() });
  const wrapRef = React.useRef(null);
  const popRef = React.useRef(null);

  React.useEffect(() => { if (!editing) setText(fmt(iso)); }, [iso, editing]);

  const set = next => {
    if (!controlled) setInner(next);
    onChange && onChange(next);
    setText(fmt(next));
    setInvalid(false);
  };
  // `invalid` holds the hint text while the red outline is shown.
  const flash = msg => { showToast("⚠ " + msg); setInvalid(msg); setText(fmt(iso)); setTimeout(() => setInvalid(false), 2500); };
  const commit = raw => {
    const parsed = parseDate(raw);
    if (parsed === null) { flash("Not a date — try 15/01/2026 or 15 Jan 2026"); return; }
    if (parsed !== iso) set(parsed); else setText(fmt(iso));
  };

  const locked = readOnly || disabled;

  // Calendar popover: portaled, fixed-positioned from the field (flips up
  // when there's no room below), closes on outside click / Esc.
  React.useLayoutEffect(() => {
    if (!open) return;
    const update = () => {
      const r = wrapRef.current?.getBoundingClientRect(); if (!r) return;
      const h = 290, below = r.bottom + 4 + h <= window.innerHeight;
      setPos({ top: below ? r.bottom + 4 : Math.max(8, r.top - h - 4), left: Math.min(r.left, window.innerWidth - 240) });
    };
    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => { window.removeEventListener("scroll", update, true); window.removeEventListener("resize", update); };
  }, [open]);
  React.useEffect(() => {
    if (!open) return;
    const d = fromIso(iso) || today;
    setView({ y: d.getFullYear(), m: d.getMonth() });
    const onDown = e => { if (!wrapRef.current?.contains(e.target) && !popRef.current?.contains(e.target)) setOpen(false); };
    const onKey = e => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDown); document.removeEventListener("keydown", onKey); };
    // eslint-disable-next-line
  }, [open]);

  const shiftMonth = delta => setView(({ y, m }) => { const d = new Date(y, m + delta, 1); return { y: d.getFullYear(), m: d.getMonth() }; });
  const shiftYear = delta => setView(({ y, m }) => ({ y: y + delta, m }));
  const pick = d => { set(toIso(d)); setOpen(false); };
  const copyIso = typeof copyFrom === "function" ? copyFrom() : copyFrom;

  const selected = fromIso(iso);
  const same = (a, b) => a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  const monthLabel = new Date(view.y, view.m, 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" });

  return (
    // Block-level flex (not inline-flex): inside a table cell with
    // text-overflow:ellipsis an inline box that overflows makes the browser
    // draw a stray "…" right after the field.
    <div ref={wrapRef} className={cn("relative flex items-center", className)} style={{ width }}>
      <input
        type="text"
        value={text}
        readOnly={locked}
        disabled={disabled}
        placeholder={locked ? "—" : placeholder}
        onFocus={() => setEditing(true)}
        onChange={e => setText(e.target.value)}
        onBlur={e => { setEditing(false); if (!locked) commit(e.target.value); }}
        onKeyDown={e => {
          if (e.key === "Enter") { e.preventDefault(); commit(e.currentTarget.value); e.currentTarget.blur(); }
          if (e.key === "Escape") { setText(fmt(iso)); e.currentTarget.blur(); }
          if (e.key === "ArrowDown" && e.altKey && !locked) setOpen(true);
        }}
        onPaste={e => {
          e.preventDefault();
          if (locked) return;
          const only = typeof pasteOnly === "function" ? pasteOnly() : pasteOnly;
          const parsed = parseDate(e.clipboardData.getData("text"));
          if (only && parsed && parsed === only) { set(parsed); return; }
          flash(only
            ? "Paste is only for 1-day items: the pasted date must equal the Start Date"
            : "Pasting is only allowed into End Date, for 1-day items");
        }}
        title={invalid || undefined}
        className={cn(
          "h-full w-full rounded-md border bg-card pl-1.5 pr-6 text-[12px] text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-ring",
          invalid ? "border-destructive ring-1 ring-destructive"
            : tone === "primary" ? "border-primary/40" : tone === "success" ? "border-success/40" : "border-input",
          locked && "cursor-default bg-muted/40 text-muted-foreground"
        )}
      />
      {!locked && (
        <button type="button" tabIndex={-1} aria-label="Open calendar"
          onMouseDown={e => e.preventDefault()}
          onClick={() => setOpen(o => !o)}
          className={cn("absolute right-1 flex h-4 w-4 items-center justify-center bg-transparent text-muted-foreground hover:text-primary", open && "text-primary")}>
          <CalendarDays className="h-3.5 w-3.5" />
        </button>
      )}

      {open && pos && createPortal(
        <div ref={popRef} className="fixed z-[100000] w-[232px] rounded-xl border border-border bg-card p-2.5 text-foreground shadow-lg"
          style={{ top: pos.top, left: pos.left }}>
          <div className="mb-2 flex items-center gap-1">
            <button type="button" className={navBtn} title="Previous year" onClick={() => shiftYear(-1)}><ChevronsLeft className="h-3.5 w-3.5" /></button>
            <button type="button" className={navBtn} title="Previous month" onClick={() => shiftMonth(-1)}><ChevronLeft className="h-3.5 w-3.5" /></button>
            <span className="flex-1 text-center text-[13px] font-semibold">{monthLabel}</span>
            <button type="button" className={navBtn} title="Next month" onClick={() => shiftMonth(1)}><ChevronRight className="h-3.5 w-3.5" /></button>
            <button type="button" className={navBtn} title="Next year" onClick={() => shiftYear(1)}><ChevronsRight className="h-3.5 w-3.5" /></button>
          </div>
          <div className="mb-1 grid grid-cols-7">
            {WEEKDAYS.map(w => <div key={w} className="py-0.5 text-center text-[10.5px] font-semibold text-muted-foreground">{w}</div>)}
          </div>
          <div className="flex flex-col gap-0.5">
            {buildWeeks(view.y, view.m).map((week, wi) => (
              <div key={wi} className="grid grid-cols-7 gap-0.5">
                {week.map((d, di) => {
                  const inMonth = d.getMonth() === view.m;
                  const isSel = same(d, selected), isToday = same(d, today);
                  return (
                    <button key={di} type="button" onClick={() => pick(d)}
                      className={cn("flex h-7 items-center justify-center rounded-md bg-transparent text-[12px] transition-colors",
                        isSel ? "bg-[#007FFF] font-semibold text-white hover:bg-[#007FFF]"
                          : isToday ? "border border-primary/60 font-semibold text-primary hover:bg-accent"
                          : inMonth ? "text-foreground hover:bg-accent" : "text-muted-foreground/50 hover:bg-accent")}>
                      {d.getDate()}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
          <div className="mt-2 flex items-center justify-between gap-2 border-t border-border pt-2 text-[11.5px]">
            <button type="button" className="bg-transparent text-muted-foreground hover:text-destructive" onClick={() => { set(""); setOpen(false); }}>Clear</button>
            {copyIso && (
              <button type="button" className="bg-transparent font-semibold text-primary hover:underline" title={fmt(copyIso)}
                onClick={() => { set(copyIso); setOpen(false); }}>Same as start date</button>
            )}
            <button type="button" className="bg-transparent font-semibold text-primary hover:underline" onClick={() => pick(today)}>Today</button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
