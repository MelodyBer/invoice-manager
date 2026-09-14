"use client";
import { useState } from "react";
import { Button } from "@/components/ui";
import { TransactionDrawer } from "./TransactionDrawer";
export function EditTransactionButton({ id }: { id: string }): React.JSX.Element {
  const [open, setOpen] = useState(false);
  return <><Button onClick={() => setOpen(true)}>עריכת התנועה והצגת המסמך</Button>{open && <TransactionDrawer id={id} onClose={() => setOpen(false)} />}</>;
}
