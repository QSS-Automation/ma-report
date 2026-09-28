import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva } from "class-variance-authority";
import { cn } from "lib/utils";

const buttonVariants = cva(
  // `border-0` is required, not decorative — Tailwind's preflight reset is
  // disabled app-wide (to keep legacy plain-CSS pages intact), so a plain
  // <button> keeps the browser's native default border/appearance unless a
  // border utility explicitly zeroes it out. Every variant below relies on
  // background-color alone to read as clickable, so this must stay on all of them.
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg border text-[14px] font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        // Literal #007FFF — a brighter blue than the app's own --primary
        // text/heading color (that one's kept darker for readability), used
        // specifically for button fills. Soft light-grey label at rest
        // (black read too harsh), flipping to a darker blue + white on hover.
        default: "border-transparent bg-[#007FFF] text-[#E8EDF3] hover:border-transparent hover:bg-[hsl(210,100%,32%)] hover:text-white",
        destructive: "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/90",
        // Reference app's ghost button: white fill, grey text, a visible
        // (not just hover-revealed) border at rest — border/text intensify
        // on hover for feedback.
        outline: "border-border bg-card text-subtle hover:border-primary/50 hover:bg-secondary",
        secondary: "border-border bg-card text-subtle hover:border-primary/50 hover:bg-secondary",
        ghost: "border-transparent hover:border-primary/50 hover:bg-accent hover:text-accent-foreground",
        link: "border-transparent text-primary underline-offset-4 hover:underline",
        success: "border-transparent bg-success text-success-foreground hover:bg-success/90",
      },
      size: {
        default: "h-9 px-4",
        sm: "h-[34px] rounded-lg px-3 text-[13px]",
        lg: "h-8 rounded-lg px-4 font-semibold",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

const Button = React.forwardRef(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
  );
});
Button.displayName = "Button";

export { Button, buttonVariants };
