// ================================================================================================
// JOB 821 · D2 — DIE FUNDSTELLE BLEIBT EHRLICH LEER, BIS ES EINE GIBT.
// ================================================================================================
//
// Diese Datei ist der ENTSCHEIDUNGSFREIE Teil von JOB 821. Sie berührt die offene Ownerfrage nach
// Identität und Persistenz eines `ImportCandidateItem` NICHT (BEN-PRUEFUNG-JOB-821-D1.md, Mangel 2:
// „Neuentität nicht entscheidungsfrei"). Sie hält allein fest, was der Bestand über die FUNDSTELLE
// heute zusagt — und diese Zusage steht unabhängig davon, worauf `candidateItemId` einmal zeigen
// wird.
//
// DIE ZUSAGE: Solange der Import keine Fundstelle erzeugt, ist sie `null` — nie ein Leerstring,
// nie ein Platzhalter, nie „die ganze Seite". `null` ist eine Aussage („dazu kann das System nichts
// sagen"), ein Leerstring wäre eine Behauptung.
//
// WARUM DAS EIN WÄCHTER SEIN MUSS UND KEINE NOTIZ: Der Import-Anker entsteht in `buildSource`
// (service.ts) — einer PRIVATEN Methode ohne öffentlichen Einstieg. Ein Zusicherungstest kann sie
// nicht aufrufen; ein Quelltextwächter kann sie lesen. Er wird rot, sobald jemand `excerpt` mit
// etwas anderem als `null` belegt, und genau das ist der Zweck.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const SERVICE = join(__dirname, "service.ts");

/** Der Rumpf einer benannten Methode — ohne Kommentarzeilen, damit Erklärtext nicht mitzählt. */
function methodenrumpf(datei: string, name: string): string {
  const text = readFileSync(datei, "utf8");
  const start = text.indexOf(`private ${name}(`);
  expect(start, `${name} muss in ${datei} existieren`).toBeGreaterThan(-1);
  // Bis zur nächsten Methode auf derselben Einrückungstiefe.
  const rest = text.slice(start);
  const ende = rest.indexOf("\n  }\n");
  return rest
    .slice(0, ende === -1 ? rest.length : ende)
    .split("\n")
    .filter((zeile) => !/^\s*(\/\/|\*|\/\*)/.test(zeile))
    .join("\n");
}

describe("JOB 821 · Z2 — der Import-Herkunftsanker behauptet keine Fundstelle", () => {
  it("`buildSource` setzt `excerpt` auf genau `null`", () => {
    // service.ts:1142. Der Anker entsteht beim Import eines Items; eine Belegstelle hat er nicht,
    // weil der Import seitenbezogen ist und keine Aussage innerhalb der Seite adressiert.
    expect(methodenrumpf(SERVICE, "buildSource")).toContain("excerpt: null");
  });

  it("`buildSource` erzeugt KEINEN Platzhalter statt einer Fundstelle", () => {
    const rumpf = methodenrumpf(SERVICE, "buildSource");
    // Kein Leerstring, kein Bindestrich, kein „unbekannt" — die drei üblichen Ersatzhandlungen.
    expect(rumpf).not.toMatch(/excerpt:\s*""/);
    expect(rumpf).not.toMatch(/excerpt:\s*"-"/);
    expect(rumpf).not.toMatch(/excerpt:\s*"[^"]+"/);
  });

  it("`buildSource` nimmt auch nicht den ganzen Seitentext als Fundstelle", () => {
    // Die naheliegendste falsche Abkürzung: `excerpt: item.statement`. Sie wäre keine Fundstelle,
    // sondern eine Verdopplung des Inhalts — und sie sähe wie eine Belegstelle aus.
    const rumpf = methodenrumpf(SERVICE, "buildSource");
    expect(rumpf).not.toMatch(/excerpt:\s*item\./);
  });
});
