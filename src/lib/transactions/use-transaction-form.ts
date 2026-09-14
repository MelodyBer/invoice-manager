"use client";

import { useCallback, useState } from "react";
import type { TransactionFormValues } from "@/types/transaction-form";

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

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

  const setField = useCallback(
    (patch: Partial<TransactionFormValues>) => {
      if ("vatRate" in patch && Number(patch.vatRate) === 0) setIsVatManuallyEdited(false);
      else if ("vatAmount" in patch) setIsVatManuallyEdited(true);
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

        if ("amountTotal" in patch) {
          const total = toNumber(next.amountTotal);
          if (isVatManuallyEdited) {
            next.amountBeforeVat = String(round2(total - toNumber(prev.vatAmount)));
          } else {
            const rate = toNumber(prev.vatRate);
            const before = round2(total / (1 + rate / 100));
            next.amountBeforeVat = String(before);
            next.vatAmount = String(round2(total - before));
          }
        } else if ("amountBeforeVat" in patch) {
          const before = toNumber(next.amountBeforeVat);
          if (isVatManuallyEdited) {
            next.amountTotal = String(round2(before + toNumber(prev.vatAmount)));
          } else {
            const rate = toNumber(prev.vatRate);
            const vat = round2(before * (rate / 100));
            next.vatAmount = String(vat);
            next.amountTotal = String(round2(before + vat));
          }
        } else if ("vatAmount" in patch) {
          const before = toNumber(prev.amountBeforeVat);
          next.amountTotal = String(round2(before + toNumber(next.vatAmount)));
        } else if ("vatRate" in patch && !isVatManuallyEdited) {
          const before = toNumber(prev.amountBeforeVat);
          const rate = toNumber(next.vatRate);
          const vat = round2(before * (rate / 100));
          next.vatAmount = String(vat);
          next.amountTotal = String(round2(before + vat));
        }

        return next;
      });
    },
    [isVatManuallyEdited]
  );

  const resetTo = useCallback((newValues: TransactionFormValues) => {
    setValues(newValues);
    setIsVatManuallyEdited(false);
  }, []);

  return { values, isVatManuallyEdited, setField, resetTo };
}
