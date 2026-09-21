import { MergeApprovedDocuments } from "@/components/transactions/MergeApprovedDocuments";
import { MoneySummary } from "@/components/transactions/MoneySummary";
import { EditTransactionButton } from "@/components/transactions/EditTransactionButton";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatDateDDMMYYYY } from "@/lib/format";

export default async function TransactionPage({ params }: { params: Promise<{ id: string }> }): Promise<React.JSX.Element> {
  const { id } = await params;
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");
  const { data } = await supabase.from("transactions").select("*").eq("user_id", auth.user.id).eq("id", id).maybeSingle();
  if (!data) notFound();
  return <section className="flex flex-col gap-4"><h1 className="text-2xl font-bold">פרטי התנועה</h1><p>{data.counterparty_name}</p><p>מספר מסמך: {data.doc_number ?? "לא צוין"}</p><p>תאריך: {formatDateDDMMYYYY(data.doc_date)}</p><MoneySummary value={data} date={data.doc_date} needsReview={data.currency_review_required} /><p>{data.notes}</p><EditTransactionButton id={id} /><MergeApprovedDocuments key={id} transaction={data} /><Link href="/transactions">חזרה לתנועות</Link></section>;
}
