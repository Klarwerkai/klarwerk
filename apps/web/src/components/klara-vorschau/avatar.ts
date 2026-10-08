/// <reference types="vite/client" />
// KLARA-VORSCHAU · DER AVATAR — die freigegebene Figur `klara-avatar-v1.png` (orange), als Datei im
// Bau (`apps/web/public/klara/`) und deshalb über eine RELATIVE Produktadresse geladen, nie über
// einen lokalen Dateipfad. `tests/klara-vorschau/avatar.test.ts` prüft Datei und Prüfsumme.
export const KLARA_AVATAR_DATEI = "klara/klara-avatar-v1.png";

export const KLARA_AVATAR_SHA256 =
  "c2327f5bf84dc67706d1f4f11dc471671c78f3183f729a0c2b1b52303ab2f87b";

export function klaraAvatarUrl(): string {
  const basis = import.meta.env.BASE_URL ?? "/";
  return `${basis.endsWith("/") ? basis : `${basis}/`}${KLARA_AVATAR_DATEI}`;
}
