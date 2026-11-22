"use client";

import { useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useSyncExternalStore, type ReactNode } from "react";
import useSWR from "swr";
import { ErrorState, LoadingState } from "@/components/States";
import { fetcher, getToken } from "@/lib/api";
import { homeFor, ME_KEY } from "@/lib/auth";
import type { MeResponse, PublicUser, Role } from "@/lib/types";

const UserContext = createContext<PublicUser | null>(null);

/** The signed-in user. Only usable inside <RequireRole>. */
export function useUser(): PublicUser {
  const user = useContext(UserContext);
  if (!user) throw new Error("useUser must be used inside <RequireRole>");
  return user;
}

const noopSubscribe = () => () => {};

/** Renders children only for a signed-in user with this role; sends everyone else to the right page. */
export function RequireRole({ role, children }: { role: Role; children: ReactNode }) {
  const router = useRouter();
  const hasToken = useSyncExternalStore(noopSubscribe, () => !!getToken(), () => null);
  const { data, error, mutate } = useSWR<MeResponse>(hasToken ? ME_KEY : null, fetcher);
  const user = data?.user;

  useEffect(() => {
    if (hasToken === false) router.replace("/login");
    else if (user && user.role !== role) router.replace(homeFor(user.role));
  }, [hasToken, user, role, router]);

  if (error) return <ErrorState error={error} onRetry={() => mutate()} />;
  if (!user || user.role !== role) return <LoadingState />;
  return <UserContext.Provider value={user}>{children}</UserContext.Provider>;
}
