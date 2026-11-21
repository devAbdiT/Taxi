import { ApiError } from "@/lib/api";
import { hasKey, type TKey, type TVars } from "@/lib/i18n";

/** Plain-words message for any thrown error. Never shows a raw error code. */
export function errorMessage(error: unknown, t: (key: TKey, vars?: TVars) => string): string {
  if (error instanceof ApiError) {
    const key = `errors.${error.code}`;
    if (hasKey(key)) return t(key);
  }
  return t("errors.generic");
}
