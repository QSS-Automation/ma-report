import React, { useEffect, useRef, useState } from "react";
import { CheckCircle2, AlertTriangle, Lock, Unlock, Info } from "lucide-react";
import { ToastProvider, ToastViewport, Toast as ToastPrimitive, ToastTitle, ToastClose } from "../ui/toast";

// Maps the leading glyph the app already prefixes messages with
// (✓ ⚠ 🔒 🔓) to an icon + tone, without requiring any call-site changes.
function parse(msg) {
  if (msg.startsWith("✓")) return { variant: "success", icon: CheckCircle2, text: msg.slice(1).trim() };
  if (msg.startsWith("⚠")) return { variant: "warning", icon: AlertTriangle, text: msg.slice(1).trim() };
  if (msg.startsWith("🔒")) return { variant: "destructive", icon: Lock, text: msg.slice(2).trim() };
  if (msg.startsWith("🔓")) return { variant: "default", icon: Unlock, text: msg.slice(2).trim() };
  return { variant: "default", icon: Info, text: msg };
}

export default function Toast() {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  useEffect(() => {
    function onToast(e) {
      const id = ++idRef.current;
      setToasts((prev) => [...prev, { id, ...parse(e.detail.msg) }]);
      setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3000);
    }
    window.addEventListener("qm-toast", onToast);
    return () => window.removeEventListener("qm-toast", onToast);
  }, []);

  return (
    <ToastProvider swipeDirection="right">
      {toasts.map(({ id, variant, icon: Icon, text }) => (
        <ToastPrimitive key={id} variant={variant} onOpenChange={(open) => !open && setToasts((prev) => prev.filter((t) => t.id !== id))}>
          <div className="flex items-center gap-2.5">
            <Icon className="h-4 w-4 shrink-0" />
            <ToastTitle>{text}</ToastTitle>
          </div>
          <ToastClose />
        </ToastPrimitive>
      ))}
      <ToastViewport />
    </ToastProvider>
  );
}
