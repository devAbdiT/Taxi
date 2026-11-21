"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/Button";
import { ChoiceCard } from "@/components/ChoiceCard";
import { Field } from "@/components/Field";
import { FormError } from "@/components/States";
import { AppShell } from "@/components/Frames";
import { RequireRole } from "@/components/RequireRole";
import { api } from "@/lib/api";
import { useT } from "@/lib/i18n";
import type { ContractType } from "@/lib/types";

const TYPES: ContractType[] = ["FAMILY", "SCHOOL", "EMPLOYEE", "SPECIAL"];

function ContractForm() {
  const t = useT();
  const [type, setType] = useState<ContractType>("FAMILY");
  const [pickup, setPickup] = useState("");
  const [destination, setDestination] = useState("");
  const [schedule, setSchedule] = useState("");
  const [count, setCount] = useState("1");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<unknown>(null);
  const [saving, setSaving] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.requestContract({
        type,
        pickup,
        destination,
        schedule,
        passengerCount: Number(count) || 1,
        notes: notes.trim() || undefined,
      });
      setSent(true);
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  }

  if (sent) {
    return (
      <p role="status" className="rounded-2xl border-2 border-emerald-600 bg-emerald-50 p-4 text-lg font-semibold text-emerald-950">
        {t("contract.thanks")}
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-1 font-semibold">{t("contract.type")}</legend>
        {TYPES.map((item) => (
          <ChoiceCard key={item} name="contract-type" value={item} checked={type === item} onSelect={() => setType(item)}>
            <span className="font-semibold">{t(`contractType.${item}`)}</span>
          </ChoiceCard>
        ))}
      </fieldset>
      <Field label={t("contract.pickup")} value={pickup} onChange={(event) => setPickup(event.target.value)} required />
      <Field label={t("contract.destination")} value={destination} onChange={(event) => setDestination(event.target.value)} required />
      <Field label={t("contract.schedule")} value={schedule} onChange={(event) => setSchedule(event.target.value)} required />
      <Field
        label={t("contract.count")}
        type="number"
        min={1}
        max={100}
        value={count}
        onChange={(event) => setCount(event.target.value)}
        required
      />
      <Field label={t("contract.notes")} value={notes} onChange={(event) => setNotes(event.target.value)} />
      <FormError error={error} />
      <Button type="submit" loading={saving} fullWidth>
        {t("contract.submit")}
      </Button>
    </form>
  );
}

export default function ContractsPage() {
  const t = useT();
  return (
    <RequireRole role="PASSENGER">
      <AppShell role="passenger">
      <section className="mx-auto flex w-full max-w-3xl flex-col gap-5">
        <h1 className="text-2xl font-bold">{t("contract.title")}</h1>
        <ContractForm />
      </section>
      </AppShell>
    </RequireRole>
  );
}
