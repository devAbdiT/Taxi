"use client";

import useSWR from "swr";
import { ErrorState, LoadingState } from "@/components/States";
import { RelativeTime } from "@/components/RelativeTime";
import { fetcher } from "@/lib/api";
import { useT } from "@/lib/i18n";
import type { SmsMessage } from "@/lib/types";

export default function SmsPage() {
  const t = useT();
  const messages = useSWR<{ messages: SmsMessage[] }>("/dev/sms", fetcher);
  const list = messages.data?.messages ?? [];
  if (messages.error && !messages.data) return <ErrorState error={messages.error} onRetry={() => messages.mutate()} />;
  if (!messages.data) return <LoadingState />;

  return (
    <section className="flex flex-col gap-4">
      <h1 className="font-display text-3xl font-bold">{t("sms.title")}</h1>
      {list.length === 0 ? (
        <p className="text-muted">{t("queue.noNotes")}</p>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {list.map((message) => (
            <article key={message.id} className="rounded-[20px] border border-line bg-card p-4 shadow-card">
              <p className="text-sm font-semibold text-cobalt">{t("sms.from")}</p>
              <p className="mt-1 text-sm text-muted">{message.recipientName} · {message.to}</p>
              <p className="mt-2">{message.text}</p>
              <p className="mt-2 text-sm text-muted"><RelativeTime date={message.createdAt} /></p>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
