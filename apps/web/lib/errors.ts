import { ApiError } from "@/lib/api";
import { hasKey, type TKey, type TVars } from "@/lib/i18n";

/** Plain-words message for any thrown error. Never shows a raw error code. */
export function errorMessage(error: unknown, t: (key: TKey, vars?: TVars) => string): string {
  if (error instanceof ApiError) {
    const key = `errors.${error.code}`;
    if (hasKey(key)) return t(key);
    if (error.status === 429) return t("errors.too_many_requests");
    if (error.status === 0) return t("errors.network_error");
  }
  return t("errors.generic");
}
