"use client";

import { usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { Header } from "@/components/Header";
import { Button } from "@/components/Button";
import { useLive } from "@/hooks/useLive";
import { api } from "@/lib/api";
import { homeFor, startSession } from "@/lib/auth";
import { DEMO_CONTROLS, USE_MOCKS } from "@/lib/config";
import { useT, type TKey } from "@/lib/i18n";
import { demoBumpMe, demoCallNext, demoCompleteTrip, demoJoin, resetMock, tickAmbient } from "@/lib/mock";

const ToastContext = createContext<(message: string) => void>(() => undefined);

export function useToast() {
  return useContext(ToastContext);
}

function Shell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const ownFrame =
    path.startsWith("/passenger") ||
    path.startsWith("/driver") ||
    path.startsWith("/station") ||
    path.startsWith("/admin");
  useLive();
  if (ownFrame) return <>{children}</>;
  return (
    <>
      <Header />
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6">{children}</main>
    </>
  );
}

const roles: { label: TKey; phone: string }[] = [
  { label: "auth.demoPassenger", phone: "0911000100" },
  { label: "auth.demoDriver1", phone: "0911000001" },
  { label: "auth.demoDriver2", phone: "0911000002" },
  { label: "auth.demoDriver3", phone: "0911000003" },
  { label: "auth.demoStationA", phone: "0911000011" },
  { label: "auth.demoStationB", phone: "0911000012" },
  { label: "auth.demoAdmin", phone: "0911000099" },
];

function DemoPanel() {
  const t = useT();
  const toast = useToast();
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const phone = path.startsWith("/passenger") || path.startsWith("/driver");
  if (!DEMO_CONTROLS || !USE_MOCKS) return null;

  async function jump(phone: string) {
    const auth = await api.login({ phone, password: "demo1234" });
    await startSession(auth);
    window.location.assign(homeFor(auth.user.role));
  }

  return (
    <div className={`fixed z-40 flex max-w-[min(20rem,calc(100vw-1.5rem))] flex-col gap-2 ${phone ? "bottom-24 left-1/2 w-[min(20rem,calc(100vw-1.5rem))] -translate-x-1/2 items-center" : "bottom-4 right-3 items-end"}`}>
      {open && (
        <div className="rise flex w-72 flex-col gap-2 rounded-[20px] border border-line bg-card p-3 shadow-card">
          <p className="font-display text-lg font-bold">{t("demo.title")}</p>
          <Button onClick={() => { demoJoin(false); toast(t("demo.done")); }} fullWidth>{t("demo.join")}</Button>
          <Button onClick={() => { demoJoin(true); toast(t("demo.done")); }} fullWidth>{t("demo.priority")}</Button>
          <Button onClick={() => void demoCallNext().then(() => toast(t("demo.done")))} fullWidth>{t("demo.call")}</Button>
          <Button onClick={() => { demoBumpMe(); toast(t("demo.done")); }} fullWidth>{t("demo.bump")}</Button>
          <Button onClick={() => void demoCompleteTrip().then(() => toast(t("demo.done")))} fullWidth>{t("demo.complete")}</Button>
          <Button
            variant="secondary"
            onClick={() => {
              resetMock();
              toast(t("demo.resetDone"));
              window.location.reload();
            }}
            fullWidth
          >
            {t("demo.reset")}
          </Button>
          <div className="grid grid-cols-2 gap-2">
            {roles.map((role) => (
              <Button key={role.phone} variant="secondary" className="px-2 text-sm" onClick={() => void jump(role.phone)}>
                {t(role.label)}
              </Button>
            ))}
          </div>
        </div>
      )}
      <Button onClick={() => setOpen((value) => !value)} variant="accent">
        {t("demo.title")}
      </Button>
    </div>
  );
}

export function Providers({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!USE_MOCKS) return;
    let timer = 0;
    const tick = () => {
      tickAmbient();
      timer = window.setTimeout(tick, 8000 + Math.random() * 7000);
    };
    timer = window.setTimeout(tick, 8000);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(null), 2800);
    return () => window.clearTimeout(timer);
  }, [message]);

  return (
    <ToastContext.Provider value={setMessage}>
      <div className="flex min-h-full flex-col">
        <Shell>{children}</Shell>
        <DemoPanel />
        {message && (
          <p role="status" className="rise fixed bottom-4 left-4 z-50 max-w-xs rounded-[14px] bg-ink px-4 py-3 text-sm font-semibold text-white">
            {message}
          </p>
        )}
      </div>
    </ToastContext.Provider>
  );
}
