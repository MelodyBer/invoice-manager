interface EmptyStateProps {
  title: string;
  description?: string;
}

export function EmptyState({ title, description }: EmptyStateProps): React.JSX.Element {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
      <p className="text-lg font-medium text-foreground">{title}</p>
      {description ? <p className="text-sm text-foreground/70">{description}</p> : null}
    </div>
  );
}
