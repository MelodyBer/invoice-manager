import { Spinner } from "@/components/ui";

export default function Loading(): React.JSX.Element {
  return <div className="flex items-center gap-3 p-6" role="status"><Spinner /><span>טוען את הנתונים…</span></div>;
}
