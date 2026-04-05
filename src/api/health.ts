import { apiBase, apiFetchInit } from "./apiBase";

export type ApiHealth = {
  ok?: boolean;
  mediaUpload?: "cos" | "local" | null;
  storage?: string;
};

export async function fetchApiHealth(): Promise<ApiHealth | null> {
  const base = apiBase();
  try {
    const r = await fetch(`${base}/api/health`, apiFetchInit());
    if (!r.ok) return null;
    return (await r.json()) as ApiHealth;
  } catch {
    return null;
  }
}
