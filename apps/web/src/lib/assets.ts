/** Prefix public assets for a GitHub Pages project site (rather than site root). */
export function assetUrl(url: string): string {
  if (!url.startsWith("/assets/")) return url;
  return `${import.meta.env.BASE_URL.replace(/\/$/, "")}${url}`;
}
