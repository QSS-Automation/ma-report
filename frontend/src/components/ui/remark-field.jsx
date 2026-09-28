import * as React from "react";
import { PencilLine } from "lucide-react";
import { cn } from "lib/utils";
import { Button } from "./button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "./dialog";

// Compact remark cell for dense tables: shows the remark (or a "Remark…"
// placeholder) in one line; clicking opens a dialog with a roomy text box.
// OK saves the text back to the cell, Cancel / Esc / ✕ discards the edit.
// Ctrl+Enter = OK. Works controlled (`value`) or uncontrolled
// (`defaultValue`), and always reports the new text through onChange.
export function RemarkField({ value, defaultValue, onChange, readOnly = false, width = 110, tone, placeholder = "Remark…", context, className }) {
  const controlled = value !== undefined;
  const [inner, setInner] = React.useState(defaultValue || "");
  const text = controlled ? (value || "") : inner;
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState("");

  const openEditor = () => { setDraft(text); setOpen(true); };
  const save = () => {
    const next = draft.trim();
    if (!controlled) setInner(next);
    onChange && onChange(next);
    setOpen(false);
  };

  // Block-level (not inline) so a cell's text-overflow:ellipsis never draws
  // a stray "…" after it.
  if (readOnly) {
    return (
      <div className={cn("flex h-6 items-center truncate text-[12px] text-muted-foreground", className)} style={{ width }} title={text || undefined}>
        {text || "—"}
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={openEditor}
        title={text || "Add remark"}
        className={cn(
          "flex h-6 items-center gap-1 rounded-md border bg-card px-1.5 text-left text-[12px] transition-colors hover:border-primary/60",
          tone === "primary" ? "border-primary/40" : tone === "success" ? "border-success/40" : "border-input",
          className
        )}
        style={{ width }}
      >
        <span className={cn("min-w-0 flex-1 truncate", text ? "text-foreground" : "text-muted-foreground/70")}>{text || placeholder}</span>
        <PencilLine className="h-3 w-3 shrink-0 text-muted-foreground" />
      </button>

      <Dialog open={open} onOpenChange={o => { if (!o) setOpen(false); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Remark</DialogTitle>
            {context && <DialogDescription>{context}</DialogDescription>}
          </DialogHeader>
          <textarea
            autoFocus
            rows={5}
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); save(); } }}
            placeholder="Type the remark details…"
            className="mt-3 w-full resize-y rounded-lg border border-input bg-card px-3 py-2 text-[13px] leading-relaxed text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
            <span>Ctrl + Enter to save</span>
            <span>{draft.length} characters</span>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save}>OK</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
