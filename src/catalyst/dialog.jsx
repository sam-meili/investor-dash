import * as Headless from "@headlessui/react";
import clsx from "clsx";

const sizes = {
  xs: "w-1/5 min-w-xs",
  sm: "w-1/4 min-w-xs",
  md: "w-1/3 min-w-xs",
  lg: "w-1/2 min-w-xs",
  xl: "w-2/3 min-w-xs",
  "2xl": "w-3/4 min-w-xs max-h-screenMargin",
  "3xl": "w-4/5 min-w-xs",
  "4xl": "w-5/6 min-w-xs",
  "5xl": "w-11/12 min-w-xs",
  full: "w-[calc(100vw-2rem)] h-[calc(100vh-2rem)]",
};

export function Dialog({ size = "lg", className, children, ...props }) {
  return (
    <Headless.Dialog {...props}>
      <Headless.DialogBackdrop
        transition
        className="fixed inset-0 bg-zinc-950/25 dark:bg-zinc-950/50 transition-opacity duration-100 focus:outline-0 data-[closed]:opacity-0 data-[enter]:ease-out data-[leave]:ease-in"
      />
      <div className="fixed inset-[-1rem] flex justify-center items-center overflow-hidden sm:p-4">
        <Headless.DialogPanel
          transition
          className={clsx(
            className,
            sizes[size],
            "relative min-w-0 max-w-none rounded-t-3xl bg-white p-[--gutter] shadow-lg ring-1 ring-zinc-950/10 [--gutter:theme(spacing.8)] sm:rounded-2xl dark:bg-zinc-900 dark:ring-white/10 forced-colors:outline",
            "transition duration-100 will-change-transform data-[closed]:translate-y-12 data-[closed]:opacity-0 data-[enter]:ease-out data-[leave]:ease-in sm:data-[closed]:translate-y-0 sm:data-[closed]:data-[enter]:scale-95"
          )}
        >
          {children}
        </Headless.DialogPanel>
      </div>
    </Headless.Dialog>
  );
}

export function DialogTitle({ className, ...props }) {
  return (
    <Headless.DialogTitle
      {...props}
      className={clsx(
        className,
        "text-balance text-lg/6 font-semibold text-zinc-950 sm:text-base/6 dark:text-white"
      )}
    />
  );
}

export function DialogDescription({ className, ...props }) {
  return (
    <Headless.Description
      as="p"
      {...props}
      className={clsx(className, "mt-2 text-pretty")}
    />
  );
}

export function DialogBody({ className, ...props }) {
  return <div {...props} className={clsx(className, "mt-6")} />;
}

export function DialogActions({ className, align, ...props }) {
  let classes = clsx(
    className,
    "mt-8 flex flex-col-reverse items-center gap-3 *:w-full sm:flex-row sm:*:w-auto",
    align === "center" ? "justify-between" : "justify-end"
  );
  return <div {...props} className={classes} />;
}

