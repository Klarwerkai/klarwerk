import { createHash } from "node:crypto";
import type { SessionUser } from "../../auth";

// ================================================================================================
// produkt:20261011:peter-p14 (K6/K7) — DER RECHTEKONTEXT EINER ANTWORT, ALS STEMPEL.
// ================================================================================================
//
// Die Weboberfläche hält Listen und Suchtreffer im Zwischenspeicher (react-query). Ihr Schlüssel
// kennt Filter, aber nicht die RECHTE, unter denen eine Antwort entstand. Wird einer Person eine
// Rolle oder eine Mitgliedschaft entzogen, blieben alte Treffer stehen, bis die Liste zufällig neu
// geholt wird (Bens Befund, Nacharbeit 2). Deshalb trägt jede angemeldete Antwort diesen Stempel:
// Konto, Rolle und die lesbaren Spaces, so wie `makeGuards` sie für GENAU diese Anfrage erhoben hat.
// Ändert er sich, verwirft der Client alle Inhaltsabfragen (`apps/web/src/lib/rechtekontext.ts`).
//
// Er verrät nichts Neues: er ist ein Fingerabdruck über die eigenen Rechte der anfragenden Person —
// dieselben Spaces, die sie über `GET /api/spaces` ohnehin sieht.
//
// Zusammenführung mit main (aufnahme:20260922:gesamt-leserechte): auch das persönliche
// Freigabeniveau (`SessionUser.freigabe`) entscheidet seitdem mit, was sichtbar ist — ein Entzug
// oder eine Erhöhung ändert den Stempel deshalb ebenso.
export const RECHTEKONTEXT_KOPF = "x-klarwerk-rechtekontext";

export function rechtekontextStempel(user: SessionUser): string {
  const spaces = user.spaceLesbar ? [...user.spaceLesbar].sort() : null;
  const freigabe = user.freigabe ?? null;
  return createHash("sha256")
    .update(JSON.stringify(["p14-rechtekontext-2", user.id, user.role, spaces, freigabe]))
    .digest("hex")
    .slice(0, 32);
}
