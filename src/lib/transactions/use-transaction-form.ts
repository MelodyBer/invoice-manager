"use client";
import { splitVat, addVat, toCents, fromCents, addCents } from "@/lib/calc";
import { useCallback, useState } from "react";
import type { TransactionFormValues } from "@/types/transaction-form";
function toNumber(value: string): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
}
export interface UseTransactionFormResult {
    values: TransactionFormValues;
    isVatManuallyEdited: boolean;
    setField: (patch: Partial<TransactionFormValues>) => void;
    resetTo: (values: TransactionFormValues) => void;
}
export function useTransactionForm(initialValues: TransactionFormValues): UseTransactionFormResult {
    const [values, setValues] = useState<TransactionFormValues>(initialValues);
    const [isVatManuallyEdited, setIsVatManuallyEdited] = useState(false);
    const setField = useCallback((patch: Partial<TransactionFormValues>) => {
        if ("vatRate" in patch && Number(patch.vatRate) === 0)
            setIsVatManuallyEdited(false);
        else if ("vatAmount" in patch)
            setIsVatManuallyEdited(true);
        setValues((prev) => {
            const next: TransactionFormValues = { ...prev, ...patch };
            if (Number(next.vatRate) === 0) {
                const amount = "amountBeforeVat" in patch ? next.amountBeforeVat : next.amountTotal || next.amountBeforeVat;
                next.amountTotal = amount;
                next.amountBeforeVat = amount;
                next.vatAmount = "0";
                next.vatDeductiblePercent = 0;
                return next;
            }
            // Keep incomplete or invalid draft inputs editable; submission validates them.
            try {
                if ("amountTotal" in patch) {
                    const total = toNumber(next.amountTotal);
                    if (isVatManuallyEdited) {
                        next.amountBeforeVat = String(fromCents(addCents(toCents(total), -toCents(toNumber(prev.vatAmount)))));
                    }
                    else {
                        const rate = toNumber(prev.vatRate);
                        const split = splitVat(total, rate);
                        next.amountBeforeVat = String(fromCents(split.amountBeforeVat));
                        next.vatAmount = String(fromCents(split.vatAmount));
                    }
                }
                else if ("amountBeforeVat" in patch) {
                    const before = toNumber(next.amountBeforeVat);
                    if (isVatManuallyEdited) {
                        next.amountTotal = String(fromCents(addCents(toCents(before), toCents(toNumber(prev.vatAmount)))));
                    }
                    else {
                        const rate = toNumber(prev.vatRate);
                        const split = addVat(before, rate);
                        next.vatAmount = String(fromCents(split.vatAmount));
                        next.amountTotal = String(fromCents(split.amountTotal));
                    }
                }
                else if ("vatAmount" in patch) {
                    const before = toNumber(prev.amountBeforeVat);
                    next.amountTotal = String(fromCents(addCents(toCents(before), toCents(toNumber(next.vatAmount)))));
                }
                else if ("vatRate" in patch && !isVatManuallyEdited) {
                    const before = toNumber(prev.amountBeforeVat);
                    const rate = toNumber(next.vatRate);
                    const split = addVat(before, rate);
                    next.vatAmount = String(fromCents(split.vatAmount));
                    next.amountTotal = String(fromCents(split.amountTotal));
                }
            }
            catch {
                return { ...prev, ...patch };
            }
            return next;
        });
    }, [isVatManuallyEdited]);
    const resetTo = useCallback((newValues: TransactionFormValues) => {
        setValues(newValues);
        setIsVatManuallyEdited(false);
    }, []);
    return { values, isVatManuallyEdited, setField, resetTo };
}
