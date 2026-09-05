interface SpinnerProps {
  size?: number;
}

export function Spinner({ size = 20 }: SpinnerProps): React.JSX.Element {
  return (
    <span
      role="status"
      aria-label="טוען"
      className="inline-block animate-spin rounded-full border-2 border-current border-t-transparent"
      style={{ width: size, height: size }}
    />
  );
}
