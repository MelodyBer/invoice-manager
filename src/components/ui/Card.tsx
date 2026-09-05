import type { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
}

export function Card({ children, className = "" }: CardProps): React.JSX.Element {
  return (
    <div className={`rounded-xl border border-border bg-background p-6 shadow-sm ${className}`}>
      {children}
    </div>
  );
}
