import type { SelectHTMLAttributes } from "react";

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  options: SelectOption[];
  error?: string;
  warning?: string;
}

export function Select({
  label,
  options,
  error,
  warning,
  id,
  className = "",
  ...rest
}: SelectProps): React.JSX.Element {
  const borderClassName = error ? "border-expense" : warning ? "border-warning" : "border-border";

  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium text-foreground">
        {label}
      </label>
      <select
        id={id}
        className={`rounded-lg border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary ${borderClassName} ${className}`}
        {...rest}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error ? <span className="text-xs text-expense">{error}</span> : null}
      {!error && warning ? <span className="text-xs text-warning">{warning}</span> : null}
    </div>
  );
}
