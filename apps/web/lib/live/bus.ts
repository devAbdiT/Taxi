type Handler = (payload: unknown) => void;

const listeners = new Map<string, Set<Handler>>();

export function subscribe(event: string, handler: Handler): () => void {
  const set = listeners.get(event) ?? new Set();
  set.add(handler);
  listeners.set(event, set);
  return () => set.delete(handler);
}

export function emitLive(event: string, payload: unknown): void {
  listeners.get(event)?.forEach((handler) => handler(payload));
  listeners.get("*")?.forEach((handler) => handler({ event, payload }));
}
