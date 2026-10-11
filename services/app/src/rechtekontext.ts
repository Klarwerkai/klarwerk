import { createHash } from "node:crypto";
import type { SessionUser } from "./http";

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
export const RECHTEKONTEXT_KOPF = "x-klarwerk-rechtekontext";

export function rechtekontextStempel(user: SessionUser): string {
  const spaces = user.spaceLesbar ? [...user.spaceLesbar].sort() : null;
  return createHash("sha256")
    .update(JSON.stringify(["p14-rechtekontext-1", user.id, user.role, spaces]))
    .digest("hex")
    .slice(0, 32);
}
