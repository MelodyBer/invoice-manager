import type { ReactNode } from "react";

export type BadgeVariant = "default" | "income" | "expense";

interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
}

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  default: "bg-foreground/10 text-foreground",
  income: "bg-income/10 text-income",
  expense: "bg-expense/10 text-expense",
};

export function Badge({ children, variant = "default" }: BadgeProps): React.JSX.Element {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${VARIANT_CLASSES[variant]}`}
    >
      {children}
    </span>
  );
}
