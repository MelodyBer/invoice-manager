import type { ReportingFrequency, TransactionRow } from "@/types/db";
import { HEBREW_MONTH_NAMES } from "./format";
/** Monetary inputs from Postgres are shekels; all returned monetary totals are integer agorot. */
export interface ReportingPeriod {
    start: string;
    end: string;
    name: string;
}
export interface SummaryOptions {
    incomeTaxAdvanceRate?: number;
    taxReserveRate?: number;
}
export type CalcTransaction = Pick<TransactionRow, "direction" | "amount_before_vat" | "vat_amount" | "amount_total" | "vat_deductible_percent" | "currency" | "is_verified" | "category_id"> & {
    currency_review_required?: boolean;
};
export interface CategorySummary {
    categoryId: string | null;
    amountBeforeVat: number;
    vatAmount: number;
    count: number;
    percentOfExpenses: number;
}
export interface Summary {
    incomeBeforeVat: number;
    outputVat: number;
    expenseBeforeVat: number;
    inputVat: number;
    vatDue: number;
    profitBeforeTax: number;
    taxAdvance: number;
    taxReserve: number;
    countIncome: number;
    countExpense: number;
    incomeTotal: number;
    expenseTotal: number;
    unverifiedCount: number;
    foreignCurrencyCount: number;
    currencyReviewCount: number;
    byCategory: CategorySummary[];
}
const ZERO = BigInt(0), ONE = BigInt(1), TWO = BigInt(2), HUNDRED = BigInt(100);
/** Exact decimal representation, including numbers serialized with an exponent. */
function fraction(value: number): [
    bigint,
    bigint
] {
    if (!Number.isFinite(value))
        throw new Error("יש להזין מספר סופי.");
    const [mantissa, exponentText = "0"] = String(value).toLowerCase().split("e");
    const decimalPlaces = (mantissa.split(".")[1] ?? "").length;
    const power = Number(exponentText) - decimalPlaces;
    const numerator = BigInt(mantissa.replace(".", ""));
    return power >= 0 ? [numerator * BigInt(10) ** BigInt(power), ONE] : [numerator, BigInt(10) ** BigInt(-power)];
}
/** Half-up, with exact half ties rounded away from zero. */
export function roundHalfUp(numerator: bigint, denominator: bigint): bigint {
    if (denominator <= ZERO)
        throw new Error("מכנה החישוב חייב להיות חיובי.");
    const negative = numerator < ZERO;
    const absolute = negative ? -numerator : numerator;
    const result = (absolute * TWO + denominator) / (denominator * TWO);
    return negative ? -result : result;
}
function safe(value: bigint): number {
    const result = Number(value);
    if (!Number.isSafeInteger(result))
        throw new Error("הסכום גדול מדי לחישוב מדויק.");
    return result;
}
export function toCents(value: number): number { const [n, d] = fraction(value); return safe(roundHalfUp(n * HUNDRED, d)); }
/** Conversion only for presentation or the existing numeric(12,2) persistence boundary. */
export function fromCents(value: number): number { if (!Number.isSafeInteger(value))
    throw new Error("סכום באגורות חייב להיות שלם."); return value / 100; }
export function addCents(...values: number[]): number { return safe(values.reduce((sum, value) => { if (!Number.isSafeInteger(value))
    throw new Error("סכום באגורות חייב להיות שלם."); return sum + BigInt(value); }, ZERO)); }
export function percentOfCents(cents: number, rate: number): number {
    if (!Number.isSafeInteger(cents) || rate < 0 || rate > 100)
        throw new Error("אחוז או סכום לא תקינים.");
    const [n, d] = fraction(rate);
    return safe(roundHalfUp(BigInt(cents) * n, d * HUNDRED));
}
export function splitVat(total: number, rate: number): {
    amountBeforeVat: number;
    vatAmount: number;
    amountTotal: number;
} {
    if (rate < 0 || rate > 100)
        throw new Error("שיעור מע״מ אינו תקין.");
    const amountTotal = toCents(total), [n, d] = fraction(rate);
    const amountBeforeVat = safe(roundHalfUp(BigInt(amountTotal) * HUNDRED * d, HUNDRED * d + n));
    return { amountBeforeVat, vatAmount: addCents(amountTotal, -amountBeforeVat), amountTotal };
}
export function addVat(before: number, rate: number): {
    amountBeforeVat: number;
    vatAmount: number;
    amountTotal: number;
} {
    const amountBeforeVat = toCents(before), vatAmount = percentOfCents(amountBeforeVat, rate);
    return { amountBeforeVat, vatAmount, amountTotal: addCents(amountBeforeVat, vatAmount) };
}
export function getReportingPeriods(year: number, frequency: ReportingFrequency): ReportingPeriod[] {
    if (!Number.isInteger(year) || year < 100 || year > 9999 || !["monthly", "bimonthly"].includes(frequency))
        throw new Error("שנה או תדירות דיווח אינן תקינות.");
    const step = frequency === "monthly" ? 1 : 2;
    return Array.from({ length: 12 / step }, (_, index) => {
        const first = index * step, last = first + step;
        return { start: `${String(year).padStart(4, "0")}-${String(first + 1).padStart(2, "0")}-01`, end: `${String(year).padStart(4, "0")}-${String(last).padStart(2, "0")}-${new Date(Date.UTC(year, last, 0)).getUTCDate()}`, name: `${HEBREW_MONTH_NAMES[first]}${step === 2 ? `–${HEBREW_MONTH_NAMES[first + 1]}` : ""} ${year}` };
    });
}
export function getCurrentPeriod(date: string | Date, frequency: ReportingFrequency): ReportingPeriod {
    const value = date instanceof Date ? new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem", year: "numeric", month: "2-digit", day: "2-digit" }).format(date) : date;
    const parsed = new Date(`${value}T12:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value)
        throw new Error("תאריך אינו תקין.");
    const period = getReportingPeriods(Number(value.slice(0, 4)), frequency).find(item => item.start <= value && item.end >= value);
    if (!period)
        throw new Error("לא נמצאה תקופת דיווח.");
    return period;
}
export function summarize(transactions: readonly CalcTransaction[], options: SummaryOptions = {}): Summary {
    const result: Summary = { incomeBeforeVat: 0, outputVat: 0, expenseBeforeVat: 0, inputVat: 0, vatDue: 0, profitBeforeTax: 0, taxAdvance: 0, taxReserve: 0, countIncome: 0, countExpense: 0, incomeTotal: 0, expenseTotal: 0, unverifiedCount: 0, foreignCurrencyCount: 0, currencyReviewCount: 0, byCategory: [] };
    const categories = new Map<string | null, CategorySummary>();
    for (const row of transactions) {
        if (row.is_verified === false)
            result.unverifiedCount++;
        const foreign = row.currency !== "ILS";
        if (foreign)
            result.foreignCurrencyCount++;
        if (row.currency_review_required) {
            result.currencyReviewCount++;
            continue;
        }
        // Existing DB amount_* columns are already ILS, even when currency records USD origin.
        const before = toCents(row.amount_before_vat), vat = toCents(row.vat_amount), total = toCents(row.amount_total);
        if (row.direction === "income") {
            result.countIncome++;
            result.incomeBeforeVat = addCents(result.incomeBeforeVat, before);
            result.incomeTotal = addCents(result.incomeTotal, total);
            if (!foreign)
                result.outputVat = addCents(result.outputVat, vat);
        }
        else if (row.direction === "expense") {
            result.countExpense++;
            result.expenseBeforeVat = addCents(result.expenseBeforeVat, before);
            result.expenseTotal = addCents(result.expenseTotal, total);
            if (!foreign)
                result.inputVat = addCents(result.inputVat, percentOfCents(vat, row.vat_deductible_percent));
            const key = row.category_id ?? null, category = categories.get(key) ?? { categoryId: key, amountBeforeVat: 0, vatAmount: 0, count: 0, percentOfExpenses: 0 };
            category.amountBeforeVat = addCents(category.amountBeforeVat, before);
            if (!foreign)
                category.vatAmount = addCents(category.vatAmount, vat);
            category.count++;
            categories.set(key, category);
        }
        else
            throw new Error("סוג תנועה אינו תקין.");
    }
    result.vatDue = addCents(result.outputVat, -result.inputVat);
    result.profitBeforeTax = addCents(result.incomeBeforeVat, -result.expenseBeforeVat);
    result.taxAdvance = percentOfCents(result.incomeBeforeVat, options.incomeTaxAdvanceRate ?? 0);
    result.taxReserve = percentOfCents(Math.max(0, result.profitBeforeTax), options.taxReserveRate ?? 30);
    result.byCategory = [...categories.values()].map(category => ({ ...category, percentOfExpenses: result.expenseBeforeVat === 0 ? 0 : safe(roundHalfUp(BigInt(category.amountBeforeVat) * BigInt(10000), BigInt(Math.abs(result.expenseBeforeVat)))) / 100 }));
    return result;
}
export const COMPARISON_METRICS = ["incomeBeforeVat", "outputVat", "expenseBeforeVat", "inputVat", "vatDue", "profitBeforeTax", "taxAdvance", "taxReserve", "incomeTotal", "expenseTotal", "countIncome", "countExpense"] as const;
export type Comparison = Record<(typeof COMPARISON_METRICS)[number], number | null>;
/** null means percent change is undefined (zero previous value, nonzero current). */
export function compareToPrevious(current: Summary, previous: Summary): Comparison {
    const result = {} as Comparison;
    for (const metric of COMPARISON_METRICS) {
        const now = current[metric], before = previous[metric];
        result[metric] = before === 0 ? (now === 0 ? 0 : null) : safe(roundHalfUp((BigInt(now) - BigInt(before)) * BigInt(10000), BigInt(Math.abs(before)))) / 100;
    }
    return result;
}
export type Currency = "ILS" | "USD";
export interface RateQuote {
    rate: number;
    rateDate: string;
    requestedDate: string;
    source: "בנק ישראל";
}
export interface MonetaryValues {
    currency: Currency;
    original_amount_before_vat: number;
    original_vat_amount: number;
    original_amount_total: number;
    exchange_rate: number | null;
    exchange_rate_date: string | null;
    amount_before_vat: number;
    vat_amount: number;
    amount_total: number;
    amount_total_usd: number | null;
}
export interface ConvertedMonetaryValues extends MonetaryValues {
    exchange_rate: number;
    exchange_rate_date: string;
    amount_total_usd: number;
}
export function shekelMoney(before: number, vat: number, total: number): MonetaryValues {
    const amounts = [before, vat, total];
    if (!amounts.every(Number.isFinite) || amounts.some(value => value < 0 || value >= 1e10) || total <= 0
        || amounts.some(value => fromCents(toCents(value)) !== value)
        || Math.abs(addCents(toCents(before), toCents(vat), -toCents(total))) > 1) {
        throw new Error("סכומים לא תקינים.");
    }
    return { currency: "ILS", original_amount_before_vat: before, original_vat_amount: vat, original_amount_total: total,
        amount_before_vat: before, vat_amount: fromCents(addCents(toCents(total), -toCents(before))), amount_total: total,
        exchange_rate: null, exchange_rate_date: null, amount_total_usd: null };
}
export function convertMoney(currency: Currency, before: number, vat: number, total: number, quote: RateQuote): ConvertedMonetaryValues {
    if (!["ILS", "USD"].includes(currency))
        throw new Error("מטבע לא נתמך.");
    if (![before, vat, total, quote.rate].every(Number.isFinite) || before < 0 || vat < 0 || total <= 0 || quote.rate <= 0 || Math.abs(addCents(toCents(before), toCents(vat), -toCents(total))) > 1)
        throw new Error("סכומים או שער לא תקינים.");
    const [rateNumerator, rateDenominator] = fraction(quote.rate);
    const scale = BigInt(100000000), rate = roundHalfUp(rateNumerator * scale, rateDenominator);
    if (rate <= ZERO)
        throw new Error("שער ההמרה אינו תקין.");
    const beforeCents = toCents(before), totalCents = toCents(total);
    const ilsTotal = currency === "ILS" ? totalCents : safe(roundHalfUp(BigInt(totalCents) * rate, scale));
    const ilsBefore = currency === "ILS" ? beforeCents : safe(roundHalfUp(BigInt(beforeCents) * rate, scale));
    const usdTotal = currency === "USD" ? totalCents : safe(roundHalfUp(BigInt(totalCents) * scale, rate));
    if ([ilsTotal, ilsBefore, usdTotal, totalCents].some(value => value >= 1e12))
        throw new Error("הסכום גדול מדי לשמירה.");
    return { currency, original_amount_before_vat: before, original_vat_amount: vat, original_amount_total: total, exchange_rate: quote.rate, exchange_rate_date: quote.rateDate, amount_before_vat: fromCents(ilsBefore), vat_amount: fromCents(addCents(ilsTotal, -ilsBefore)), amount_total: fromCents(ilsTotal), amount_total_usd: fromCents(usdTotal) };
}
