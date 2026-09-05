"use client";

import { useEffect, useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button, Card, Input, Select, Spinner, useToast } from "@/components/ui";
import type { ProfileRow, ReportingFrequency } from "@/types/db";

interface SettingsFormState {
  business_name: string;
  business_number: string;
  vat_rate: string;
  reporting_frequency: ReportingFrequency;
  income_tax_advance_rate: string;
  tax_reserve_rate: string;
}

const REPORTING_FREQUENCY_OPTIONS = [
  { value: "bimonthly", label: "דו-חודשי" },
  { value: "monthly", label: "חודשי" },
];

function toFormState(profile: ProfileRow): SettingsFormState {
  return {
    business_name: profile.business_name ?? "",
    business_number: profile.business_number ?? "",
    vat_rate: String(profile.vat_rate),
    reporting_frequency: profile.reporting_frequency,
    income_tax_advance_rate: String(profile.income_tax_advance_rate),
    tax_reserve_rate: String(profile.tax_reserve_rate),
  };
}

export default function SettingsPage(): React.JSX.Element {
  const { showToast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [form, setForm] = useState<SettingsFormState | null>(null);

  useEffect(() => {
    async function loadProfile(): Promise<void> {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setIsLoading(false);
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (profile) {
        setForm(toFormState(profile));
      }
      setIsLoading(false);
    }

    void loadProfile();
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!form) {
      return;
    }
    setFormError(null);

    const vatRate = Number(form.vat_rate);
    const incomeTaxAdvanceRate = Number(form.income_tax_advance_rate);
    const taxReserveRate = Number(form.tax_reserve_rate);

    if (Number.isNaN(vatRate) || Number.isNaN(incomeTaxAdvanceRate) || Number.isNaN(taxReserveRate)) {
      setFormError("יש להזין ערכים מספריים תקינים באחוזים");
      return;
    }

    setIsSaving(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setIsSaving(false);
      return;
    }

    const { error } = await supabase
      .from("profiles")
      .update({
        business_name: form.business_name || null,
        business_number: form.business_number || null,
        vat_rate: vatRate,
        reporting_frequency: form.reporting_frequency,
        income_tax_advance_rate: incomeTaxAdvanceRate,
        tax_reserve_rate: taxReserveRate,
      })
      .eq("id", user.id);

    setIsSaving(false);

    if (error) {
      setFormError("שמירת הפרטים נכשלה. נסי שוב.");
      return;
    }

    showToast("הפרטים נשמרו בהצלחה");
  }

  if (isLoading || !form) {
    return (
      <div className="flex items-center justify-center py-16">
        <Spinner size={32} />
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold text-foreground">הגדרות</h1>
      <Card className="max-w-xl">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            id="business_name"
            label="שם העסק"
            value={form.business_name}
            onChange={(event) => setForm({ ...form, business_name: event.target.value })}
          />
          <Input
            id="business_number"
            label="מספר עוסק מורשה"
            value={form.business_number}
            onChange={(event) => setForm({ ...form, business_number: event.target.value })}
          />
          <Input
            id="vat_rate"
            label="שיעור מע״מ (%)"
            type="number"
            step="0.01"
            value={form.vat_rate}
            onChange={(event) => setForm({ ...form, vat_rate: event.target.value })}
          />
          <Select
            id="reporting_frequency"
            label="תדירות דיווח"
            options={REPORTING_FREQUENCY_OPTIONS}
            value={form.reporting_frequency}
            onChange={(event) =>
              setForm({
                ...form,
                reporting_frequency: event.target.value as ReportingFrequency,
              })
            }
          />
          <Input
            id="income_tax_advance_rate"
            label="אחוז מקדמות מס הכנסה (%)"
            type="number"
            step="0.01"
            value={form.income_tax_advance_rate}
            onChange={(event) => setForm({ ...form, income_tax_advance_rate: event.target.value })}
          />
          <Input
            id="tax_reserve_rate"
            label="אחוז כרית מס (%)"
            type="number"
            step="0.01"
            value={form.tax_reserve_rate}
            onChange={(event) => setForm({ ...form, tax_reserve_rate: event.target.value })}
          />

          {formError ? <p className="text-sm text-expense">{formError}</p> : null}

          <Button type="submit" isLoading={isSaving} className="self-start">
            שמירה
          </Button>
        </form>
      </Card>
    </div>
  );
}
