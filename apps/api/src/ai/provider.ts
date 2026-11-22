export interface AiProvider {
  rephrase(template: string, data: Record<string, unknown>): Promise<string>;
}

// Default: returns template with {{key}} replaced by data[key].
// No external service calls.
export const defaultProvider: AiProvider = {
  rephrase: async (t, d) => t.replace(/\{\{(\w+)\}\}/g, (_, k) => String(d[k] ?? k)),
};

export function getProvider(): AiProvider {
  return defaultProvider;
}
