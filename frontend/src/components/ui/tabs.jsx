import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "lib/utils";

const Tabs = TabsPrimitive.Root;

// Rounded segmented-control style (replaces the old underline-tab look) —
// a soft pill track with a solid rounded pill for the active trigger.
const TabsList = React.forwardRef(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn("flex w-fit flex-wrap gap-1.5", className)}
    {...props}
  />
));
TabsList.displayName = TabsPrimitive.List.displayName;

const TabsTrigger = React.forwardRef(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "min-h-9 rounded-full border border-border bg-card px-4 py-1.5 text-sm text-subtle transition-colors hover:border-primary/50 data-[state=active]:border-primary/30 data-[state=active]:bg-accent data-[state=active]:font-semibold data-[state=active]:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      className
    )}
    {...props}
  />
));
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef(({ className, ...props }, ref) => (
  <TabsPrimitive.Content ref={ref} className={cn("focus-visible:outline-none", className)} {...props} />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };
