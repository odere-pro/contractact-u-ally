"use client";

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

function Dialog(props: DialogPrimitive.Root.Props) {
  return <DialogPrimitive.Root {...props} />;
}

function DialogTrigger(props: DialogPrimitive.Trigger.Props) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}

type DialogContentProps = Omit<DialogPrimitive.Popup.Props, "title"> & {
  readonly title?: ReactNode;
  readonly description?: ReactNode;
  readonly hideCloseButton?: boolean;
};

function DialogContent({
  className,
  children,
  title,
  description,
  hideCloseButton,
  ...props
}: DialogContentProps) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Backdrop
        data-slot="dialog-backdrop"
        className="bg-foreground/40 fixed inset-0 transition-opacity data-closed:opacity-0 data-open:opacity-100 motion-reduce:transition-none"
      />
      <DialogPrimitive.Popup
        data-slot="dialog-popup"
        className={cn(
          "bg-card text-card-foreground border-border fixed top-1/2 left-1/2 z-50 flex w-[min(520px,92%)] -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-2xl border p-6 shadow-2xl transition-opacity data-closed:opacity-0 data-open:opacity-100 motion-reduce:transition-none",
          className,
        )}
        {...props}
      >
        {title && (
          <DialogPrimitive.Title className="text-lg font-semibold">{title}</DialogPrimitive.Title>
        )}
        {description && (
          <DialogPrimitive.Description className="text-muted-foreground text-sm">
            {description}
          </DialogPrimitive.Description>
        )}
        {children}
        {!hideCloseButton && (
          <DialogPrimitive.Close
            aria-label="Close dialog"
            className="text-muted-foreground hover:text-foreground absolute top-4 right-4 size-6 rounded focus-visible:outline-2"
          >
            <X aria-hidden className="size-4" />
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Popup>
    </DialogPrimitive.Portal>
  );
}

function DialogClose(props: DialogPrimitive.Close.Props) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
}

export { Dialog, DialogTrigger, DialogContent, DialogClose };
