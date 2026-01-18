import clsx from "clsx";

const sizes = {
  xs: "sm:max-w-xs",
  sm: "sm:max-w-sm",
  md: "sm:max-w-md",
  lg: "sm:max-w-lg",
  xl: "sm:max-w-xl",
};

export function Card({ size = "md", children, ...props }) {
  return (
    <div
      {...props}
      className={clsx(
        sizes[size],
        "rounded-lg bg-white p-6 shadow-lg ring-1 ring-zinc-950/10 dark:bg-zinc-900 dark:ring-white/10"
      )}
    >
      {children}
    </div>
  );
}

export function CardTitle({ children, ...props }) {
  return (
    <h2
      {...props}
      className="text-lg font-semibold text-zinc-950 dark:text-white"
    >
      {children}
    </h2>
  );
}

export function CardDescription({ children, ...props }) {
  return (
    <p {...props} className="mt-2 text-zinc-500 dark:text-zinc-400">
      {children}
    </p>
  );
}

export function CardBody({ children, ...props }) {
  return (
    <div {...props} className="mt-4">
      {children}
    </div>
  );
}

export function CardActions({ children, ...props }) {
  return (
    <div {...props} className="mt-6 flex justify-end gap-4">
      {children}
    </div>
  );
}

