import type { InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  warning?: string;
}

export function Input({
  label,
  error,
  warning,
  id,
  className = "",
  ...rest
}: InputProps): React.JSX.Element {
  const borderClassName = error ? "border-expense" : warning ? "border-warning" : "border-border";

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-foreground">
        {label}
      </label>
      <input
        id={id}
        className={`rounded-lg border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary ${borderClassName} ${className}`}
        {...rest}
      />
      {error ? <span className="text-xs text-expense">{error}</span> : null}
      {!error && warning ? <span className="text-xs text-warning">{warning}</span> : null}
    </div>
  );
}
