import Link from "next/link";
import { DashboardView } from "@/components/dashboard/DashboardView";
import { loadDashboard } from "@/lib/dashboard/load-dashboard";
import { userContext } from "@/lib/transactions/load-range";
import type { SearchValues } from "@/lib/transactions/reporting";
export default async function DashboardPage({ searchParams }: { searchParams: Promise<SearchValues> }): Promise<React.JSX.Element> {
    const { supabase, userId } = await userContext();
    const params = await searchParams;
    try {
        const data = await loadDashboard(supabase, userId, params);
        return <DashboardView data={data} />;
    } catch (error: unknown) {
        return <section className="rounded-xl border border-border p-6"><h1 className="text-xl font-semibold">לא ניתן להציג את הדשבורד</h1><p role="alert" className="my-4">{error instanceof Error && /^[א-ת]/u.test(error.message) ? error.message : "אירעה תקלה בטעינת הנתונים. נסי שוב."}</p><Link href="/dashboard" className="text-primary underline">חזרה לתקופה הנוכחית</Link></section>;
    }
}
