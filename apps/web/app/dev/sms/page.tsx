"use client";

import useSWR from "swr";
import { EmptyState, ErrorState, LoadingState } from "@/components/States";
import { RelativeTime } from "@/components/RelativeTime";
import { fetcher } from "@/lib/api";
import { REFRESH_MS } from "@/lib/config";
import { useT } from "@/lib/i18n";
import type { SmsMessage } from "@/lib/types";

export default function SmsPage() {
  const t = useT();
  const { data, error, mutate } = useSWR<SmsMessage[]>("/dev/sms", fetcher, { refreshInterval: REFRESH_MS });

  return (
    <section className="mx-auto flex w-full max-w-sm flex-col gap-4">
      <h1 className="text-2xl font-bold">{t("sms.title")}</h1>
      <div className="flex min-h-80 flex-col gap-3 rounded-[2rem] border-4 border-slate-900 bg-slate-100 p-4">
        {error && !data ? (
          <ErrorState error={error} onRetry={() => mutate()} />
        ) : !data ? (
          <LoadingState />
        ) : data.length === 0 ? (
          <EmptyState title={t("sms.empty")} />
        ) : (
          data.map((message) => (
            <article key={message.id} className="rounded-2xl rounded-tl-sm bg-white p-3 shadow-sm">
              <p className="text-sm font-semibold text-slate-600">{t("sms.to", { name: message.recipientName || message.to })}</p>
              <p className="mt-1 text-lg">{message.text}</p>
              <p className="mt-1 text-sm text-slate-500">
                <RelativeTime date={message.createdAt} />
              </p>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
