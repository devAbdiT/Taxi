"use client";

import useSWR from "swr";
import { ErrorState, LoadingState } from "@/components/States";
import { RelativeTime } from "@/components/RelativeTime";
import { fetcher } from "@/lib/api";
import { useT } from "@/lib/i18n";
import type { SmsMessage } from "@/lib/types";

export default function SmsPage() {
  const t = useT();
  const messages = useSWR<SmsMessage[]>("/dev/sms", fetcher);
  if (messages.error && !messages.data) return <ErrorState error={messages.error} onRetry={() => messages.mutate()} />;
  if (!messages.data) return <LoadingState />;

  return (
    <section className="mx-auto flex max-w-sm flex-col gap-3 rounded-[28px] border-8 border-ink bg-cream p-4">
      <h1 className="text-center font-display text-xl font-bold">{t("sms.title")}</h1>
      {messages.data.map((message) => (
        <article key={message.id} className="rounded-[18px] bg-sky p-3">
          <p className="text-xs font-semibold text-cobalt">{t("sms.from")}</p>
          <p className="mt-1">{message.body}</p>
          <p className="mt-1 text-xs text-muted"><RelativeTime date={message.createdAt} /></p>
        </article>
      ))}
    </section>
  );
}
