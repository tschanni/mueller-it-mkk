/** Resolve public assets for both a custom domain and a GitHub Pages subdirectory. */
export function publicAsset(path: string): string {
  const base = (process.env.PUBLIC_URL || '.').replace(/\/$/, '');
  return `${base}/${path.replace(/^\/+/, '')}`;
}
