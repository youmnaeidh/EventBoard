// Anonymous visitor id used only to link a visitor's own views/searches for recommendations.
// Random, stored in this browser, contains no personal data.
const KEY = "eb_sid";
let memory: string | null = null;

export function getSessionId(): string {
  try {
    const existing = localStorage.getItem(KEY);
    if (existing) return existing;
    const id = `s-${crypto.randomUUID()}`;
    localStorage.setItem(KEY, id);
    return id;
  } catch {
    memory ??= `s-${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
    return memory;
  }
}
