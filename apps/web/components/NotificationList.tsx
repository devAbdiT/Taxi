"use client";

import { useEffect } from "react";
import useSWR from "swr";
import { Button } from "@/components/Button";
import { EmptyState, ErrorState, LoadingState } from "@/components/States";
import { RelativeTime } from "@/components/RelativeTime";
import { api, fetcher } from "@/lib/api";
import { REFRESH_MS } from "@/lib/config";
import { useT } from "@/lib/i18n";
import type { Notification } from "@/lib/types";

export function NotificationList() {
  const t = useT();
  const { data, error, mutate } = useSWR<Notification[]>("/notifications", fetcher, { refreshInterval: REFRESH_MS });
  const unread = data?.filter((note) => !note.read).length ?? 0;

  useEffect(() => {
    if (unread === 0) return;
    void api.markNotificationsRead().then(() => mutate());
  }, [unread, mutate]);

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold">{t("notes.title")}</h2>
        {unread > 0 && (
          <Button variant="secondary" className="px-3 text-sm" onClick={() => void api.markNotificationsRead().then(() => mutate())}>
            {t("notes.markRead")}
          </Button>
        )}
      </div>
      {error && !data ? (
        <ErrorState error={error} onRetry={() => mutate()} />
      ) : !data ? (
        <LoadingState />
      ) : data.length === 0 ? (
        <EmptyState title={t("notes.empty")} />
      ) : (
        <ul className="flex flex-col gap-2">
          {data.map((note) => (
            <li
              key={note.id}
              className={`rounded-xl border-2 p-3 ${note.read ? "border-slate-200 bg-white" : "border-amber-400 bg-amber-50"}`}
            >
              <p className="font-semibold">{note.title}</p>
              <p>{note.body}</p>
              <p className="mt-1 text-sm text-slate-600">
                <RelativeTime date={note.createdAt} />
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
