import React, { useState } from "react";
import { LockKeyhole } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../ui/dialog";
import { Button } from "../ui/button";
import { Label } from "../ui/label";

export default function UnlockModal({ open, invNo, onClose, onSubmit }) {
  const [r, setR] = useState("");

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><LockKeyhole className="h-4 w-4" /> Request unlock</DialogTitle>
          <DialogDescription>Submit a reason for unlocking <strong>{invNo}</strong>.</DialogDescription>
        </DialogHeader>

        <div className="mb-3 flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-xs leading-relaxed text-destructive">
          Only this invoice will be unlocked if approved.
        </div>

        <div className="space-y-1.5">
          <Label>Reason</Label>
          <textarea
            className="h-20 w-full resize-none rounded-md border border-input bg-card p-2.5 text-xs placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={r}
            onChange={e => setR(e.target.value)}
            placeholder="e.g. Wrong contract end date…"
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={!r.trim()} onClick={() => r.trim() && onSubmit(r)}>Submit request</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
