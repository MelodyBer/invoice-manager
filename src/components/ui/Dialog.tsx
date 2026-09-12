"use client";
import { useEffect, useId, useRef, type ReactNode } from "react";
interface DialogProps { isOpen: boolean; onClose: () => void; title: string; children: ReactNode; }
export function Dialog({ isOpen, onClose, title, children }: DialogProps): React.JSX.Element {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (isOpen && dialog && !dialog.open) dialog.showModal();
    if (!isOpen && dialog?.open) dialog.close();
  }, [isOpen]);
  return <dialog ref={ref} aria-labelledby={titleId} onCancel={onClose} onClose={onClose} className="m-auto w-[calc(100%-2rem)] max-w-md rounded-xl border border-border bg-background p-6 text-foreground shadow-lg backdrop:bg-black/40"><h2 id={titleId} className="mb-4 text-lg font-semibold">{title}</h2>{children}</dialog>;
}
