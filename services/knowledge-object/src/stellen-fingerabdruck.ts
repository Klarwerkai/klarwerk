// ================================================================================================
// P-WIKI-STELLENBEZUG — DER FINGERABDRUCK EINER STELLE, wie ihn die Fläche rechnet.
// ================================================================================================
//
// Die Fläche (`apps/web/src/lib/stellenabdruck.ts`) rechnet SHA-256 synchron selbst, weil
// `crypto.subtle` asynchron ist. Der Dienst nimmt das Original aus `node:crypto`; dass beide
// denselben Abdruck liefern, misst `tests/wiki-stellenbezug/zuordnung.test.tsx`.
import { createHash } from "node:crypto";

/**
 * Der Abdruck einer Stelle: Art, VOLLSTÄNDIGER Abschnitt und VOLLSTÄNDIGER normalisierter Inhalt
 * (beim Bild seine Kennung). Das Trennzeichen U+0000 kommt in normalisiertem Text nicht vor.
 */
export function stellenFingerabdruck(
  art: string,
  abschnittVoll: string,
  inhaltVoll: string,
): string {
  const hex = createHash("sha256")
    .update(`${art}\u0000${abschnittVoll}\u0000${inhaltVoll}`, "utf8")
    .digest("hex");
  return `sha256:${hex}`;
}
