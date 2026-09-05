import type { Direction } from "@/types/db";

interface DirectionToggleProps {
  value: Direction;
  onChange: (direction: Direction) => void;
}

export function DirectionToggle({ value, onChange }: DirectionToggleProps): React.JSX.Element {
  return (
    <div
      role="radiogroup"
      aria-label="סוג המסמך"
      className="inline-flex rounded-lg border border-border p-1"
    >
      <button
        type="button"
        role="radio"
        aria-checked={value === "expense"}
        onClick={() => onChange("expense")}
        className={`rounded-md px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary ${
          value === "expense" ? "bg-expense text-white" : "text-foreground/70 hover:bg-foreground/5"
        }`}
      >
        הוצאה
      </button>
      <button
        type="button"
        role="radio"
        aria-checked={value === "income"}
        onClick={() => onChange("income")}
        className={`rounded-md px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary ${
          value === "income" ? "bg-income text-white" : "text-foreground/70 hover:bg-foreground/5"
        }`}
      >
        הכנסה
      </button>
    </div>
  );
}
