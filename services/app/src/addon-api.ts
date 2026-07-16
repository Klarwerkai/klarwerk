// SCRUM-Klara (Add-on-API): EIN Flag schaltet den GESAMTEN Add-in-Pfad (CORS + Add-on-Principal für
// /api/ask). Default AUS = exakt heutiges Verhalten (kein CORS-Header, kein Add-on-Pfad). Erst
// KLARWERK_ADDON_API=1|true aktiviert ihn — bewusst konservativ, damit Bestand/12.08.-Pfad unberührt bleibt.
// Der eigentliche Principal (Capabilities ask.validated + checktext.validated) + die EINE
// Key-Validierung leben in addon-principal.ts.
export function addonApiEnabled(): boolean {
  const flag = process.env.KLARWERK_ADDON_API;
  return flag === "1" || flag === "true";
}

// Die Pfade, für die der Add-on-Pfad CORS öffnet — nichts sonst.
export const ADDON_ASK_PATH = "/api/ask";
// SCRUM-491 Slice 5: zweiter Add-on-Endpunkt (deterministische Dry-Run-Prüfung freien Textes).
export const ADDON_CHECK_TEXT_PATH = "/api/check-text";

// Validiert die konfigurierte Add-in-Origin als ECHTE URL-Origin (ben-Review SCRUM-490, P2). Fail-closed:
// "*", leer, mit Pfad/Query/Fragment oder syntaktisch ungültig → null. null bedeutet: KEIN CORS registrieren,
// nichts durchreichen. Nicht gesetzt (undefined) → konservativer, valider HTTPS-Dev-Default.
export function resolveAddonOrigin(): string | null {
  const raw = process.env.KLARWERK_ADDON_ORIGIN;
  const value = raw === undefined ? "https://localhost:3000" : raw.trim();
  // Explizit leer oder Wildcard (auch teil-Wildcard wie https://*.x) → fail-closed.
  if (value === "" || value.includes("*")) {
    return null;
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  // Nur http/https, und der Wert MUSS exakt die Origin sein (kein Pfad, kein Trailing-Slash, keine Query).
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return null;
  }
  if (url.origin !== value) {
    return null;
  }
  return url.origin;
}

// Eigener Header — bewusst NICHT Authorization/Cookie, damit der Key nie als Session-Token (tokenFromRequest)
// auf anderen Routen interpretiert werden kann. Der Key wird ausschließlich im Add-on-Principal geprüft.
export const ADDON_KEY_HEADER = "x-klarwerk-addon-key";
