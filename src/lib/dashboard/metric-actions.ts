"use server";
import { cookies } from "next/headers";
import { userContext } from "@/lib/transactions/load-range";
import { isMetricSelection, metricCookieName } from "./metrics";
export async function saveDashboardMetrics(selection: unknown): Promise<{ success: boolean; message: string }> {
    const { userId } = await userContext();
    if (!isMetricSelection(selection)) return { success: false, message: "בחירת המדדים אינה תקינה. נסי שוב." };
    try {
        const store = await cookies();
        store.set(metricCookieName(userId), JSON.stringify(selection), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/dashboard", maxAge: 31536000 });
        return { success: true, message: "התצוגה נשמרה בדפדפן הזה." };
    } catch { return { success: false, message: "לא ניתן לשמור את התצוגה. נסי שוב." }; }
}
