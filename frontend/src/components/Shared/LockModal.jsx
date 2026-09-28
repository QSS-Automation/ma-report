import React, { useState } from "react";
import { Lock, TriangleAlert } from "lucide-react";
import { MN } from "../../utils/fmt";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../ui/dialog";
import { Button } from "../ui/button";
import { Label } from "../ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "../ui/select";

export default function LockModal({ open, onClose, onConfirm }) {
  const [period, setPeriod] = useState("");
  const now = new Date();
  const opts = [];
  for (let i = 0; i < 60; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const val = d.getFullYear() + "-" + (d.getMonth() < 9 ? "0" : "") + (d.getMonth() + 1);
    opts.push({ val, label: `${MN[d.getMonth()]} ${d.getFullYear()}` });
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Lock className="h-4 w-4" /> Lock period</DialogTitle>
          <DialogDescription>Once locked, all invoices become read-only.</DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label>Period to lock</Label>
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger><SelectValue placeholder="Select a period" /></SelectTrigger>
            <SelectContent>
              {opts.map(o => <SelectItem key={o.val} value={o.val}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="mt-3 flex items-start gap-2 rounded-md border border-warning/30 bg-warning/10 p-3 text-xs leading-relaxed text-warning">
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span><strong>This affects all invoices in the period.</strong> MFRS recognition figures will be snapshotted.</span>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="destructive" disabled={!period} onClick={() => period && onConfirm(period)}>
            <Lock className="h-3.5 w-3.5" /> Confirm lock
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
