"use client";

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

// Side-anchored Dialog. Reused for the "Why is this a risk?" drawer.
// We piggy-back on @base-ui's Dialog primitive (focus trap, ESC, etc.)
// and only swap layout + entry animation.

function Sheet(props: DialogPrimitive.Root.Props) {
  return <DialogPrimitive.Root {...props} />;
}

function SheetTrigger(props: DialogPrimitive.Trigger.Props) {
  return <DialogPrimitive.Trigger data-slot="sheet-trigger" {...props} />;
}

type SheetContentProps = Omit<DialogPrimitive.Popup.Props, "title"> & {
  readonly title?: ReactNode;
  readonly description?: ReactNode;
  readonly side?: "right" | "left";
};

function SheetContent({
  className,
  children,
  title,
  description,
  side = "right",
  ...props
}: SheetContentProps) {
  const sideClasses =
    side === "right"
      ? "right-0 top-0 h-full w-[min(440px,92%)] border-l data-closed:translate-x-full"
      : "left-0 top-0 h-full w-[min(440px,92%)] border-r data-closed:-translate-x-full";
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Backdrop
        data-slot="sheet-backdrop"
        className="bg-foreground/40 fixed inset-0 transition-opacity data-closed:opacity-0 data-open:opacity-100 motion-reduce:transition-none"
      />
      <DialogPrimitive.Popup
        data-slot="sheet-popup"
        className={cn(
          "bg-card text-card-foreground border-border fixed z-50 flex flex-col gap-4 p-6 shadow-2xl transition-transform data-open:translate-x-0 motion-reduce:transition-none",
          sideClasses,
          className,
        )}
        {...props}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            {title && (
              <DialogPrimitive.Title className="text-base font-semibold">
                {title}
              </DialogPrimitive.Title>
            )}
            {description && (
              <DialogPrimitive.Description className="text-muted-foreground text-xs">
                {description}
              </DialogPrimitive.Description>
            )}
          </div>
          <DialogPrimitive.Close
            aria-label="Close drawer"
            className="text-muted-foreground hover:text-foreground rounded focus-visible:outline-2"
          >
            <X aria-hidden className="size-4" />
          </DialogPrimitive.Close>
        </div>
        {children}
      </DialogPrimitive.Popup>
    </DialogPrimitive.Portal>
  );
}

export { Sheet, SheetTrigger, SheetContent };
