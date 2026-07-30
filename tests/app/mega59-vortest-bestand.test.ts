// AUFTRAG-mega59 BLOCK A — DER BESTAND, DEN DER VORTEST BRAUCHT.
//
// Am Freitag prüft eine Fachfrau ohne Vorwissen das Produkt an sieben Aufgaben. Drei davon waren
// am Bestand NICHT LÖSBAR, und das ist am Beispielbestand nachgesehen, nicht vermutet:
//
//   1. Aufgabe 4 sucht nach „Lieferanten". Das Wort kam im ganzen Beispielbestand kein einzelnes
//      Mal vor — die einzige Fundstelle repoweit war ein Codekommentar ohne Datenbezug. Die
//      Testerin wäre an einer unlösbaren Aufgabe gescheitert, und gemessen hätten wir unsere
//      Datenlücke statt ihrer Bedienbarkeit.
//   2. Alle 22 Altobjekte liefen ohne `confidentiality` und wurden dadurch auf „intern"
//      normalisiert (knowledge-object/src/confidentiality.ts) — es gab KEIN Objekt mit
//      „vertraulich" oder „streng_vertraulich". Die Vertraulichkeits-Facette hatte nichts zu
//      zeigen, Zugriffsschutz war nicht vorführbar.
//   3. Es gab genau EINEN Anhang, an genau einem „intern“-Objekt. Die Kopplung Vertraulichkeit ×
//      Anhang — eines der Dinge, die KLARWERK von einem Notiz-Werkzeug unterscheiden — ließ sich
//      damit nicht vorführen.
//
// WARUM DIESER WÄCHTER EXISTIERT: für alle drei Anforderungen gab es bis mega59 KEINE Zusicherung.
// Ohne sie fällt genau das beim nächsten Umbau des Beispielbestands still wieder heraus, und
// niemand merkt es, weil der Bestand weiterhin „grün“ aussieht. Geprüft wird am ERZEUGTEN Bestand
// über die echten Services — nicht an den Textbausteinen, sonst prüfte der Wächter die Absicht
// statt das Ergebnis.
import { describe, expect, it } from "vitest";
import { buildServices } from "../../services/app/src/build-app";
import { seedDemo } from "../../services/app/src/seed-demo";
import {
  CONFIDENTIALITY_LEVELS,
  isConfidential,
  normalizeConfidentiality,
} from "../../services/knowledge-object";

async function bestand() {
  const services = buildServices();
  const r = await seedDemo(services);
  expect(r.skipped, "der Seed ist übersprungen — der Wächter würde ins Leere prüfen").toBe(false);
  return services.ko.list();
}

describe("AUFTRAG-mega59 A — der Vortest-Bestand trägt seine drei Aufgaben", () => {
  it("„Lieferant“ steht in Titel ODER Schlagwörtern — nicht nur im Fließtext", async () => {
    const kos = await bestand();
    const treffer = kos.filter((k) =>
      `${k.title} ${(k.tags ?? []).join(" ")}`.toLowerCase().includes("lieferant"),
    );
    expect(
      treffer.map((k) => k.title),
      "kein Wissensobjekt trägt „Lieferant“ in Titel oder Schlagwörtern — Aufgabe 4 des Vortests " +
        "ist damit unlösbar",
    ).not.toEqual([]);
  });

  it("die Suche nach Lieferanten zeigt BEIDE Zustände — validiert und offen", async () => {
    // Ein einzelner Zustand zeigt der Testerin nicht, was der Unterschied bedeutet. Zwei zeigen es
    // ohne ein Wort Erklärung — das ist der Grund, warum es zwei Objekte sind und nicht eines.
    const kos = await bestand();
    const lieferanten = kos.filter((k) =>
      `${k.title} ${(k.tags ?? []).join(" ")}`.toLowerCase().includes("lieferant"),
    );
    const zustaende = new Set(lieferanten.map((k) => k.status));
    expect(zustaende.has("validiert"), "kein validiertes Lieferanten-Objekt").toBe(true);
    expect(zustaende.has("offen"), "kein offenes Lieferanten-Objekt").toBe(true);
  });

  it("jede der drei Vertraulichkeitsstufen kommt mindestens einmal vor", async () => {
    // Gemessen wird auf der NORMALISIERTEN Stufe, weil das Produkt sie so liest: fehlt das Feld,
    // gilt der dokumentierte Standard „intern“ (confidentiality.ts). Ein Objekt ohne Feld ist also
    // ein echtes intern-Beispiel und wird hier auch als solches gezählt — der Wächter prüft die
    // sichtbare Stufe, nicht die Schreibweise im Datensatz.
    const kos = await bestand();
    const fehlend = CONFIDENTIALITY_LEVELS.filter(
      (stufe) => !kos.some((k) => normalizeConfidentiality(k.confidentiality) === stufe),
    );
    expect(
      fehlend,
      "eine Vertraulichkeitsstufe hat im Bestand kein Beispiel — die Facette zeigt sie dann nicht",
    ).toEqual([]);
  });

  it("mindestens ein NICHT-internes Objekt trägt einen Anhang", async () => {
    // Die Kopplung Vertraulichkeit × Anhang (G2: der Anhang wird behandelt wie sein Objekt) lässt
    // sich nur an einem nicht-internen Objekt zeigen. Ein Anhang an einem „intern“-Objekt zeigt sie
    // nicht — das war der Zustand vor mega59.
    const kos = await bestand();
    const mitAnhang = kos.filter(
      (k) => isConfidential(k.confidentiality) && (k.attachments?.length ?? 0) > 0,
    );
    expect(
      mitAnhang.map((k) => ({ titel: k.title, stufe: k.confidentiality })),
      "kein nicht-internes Objekt hat einen Anhang — die Anlagenkopplung ist nicht vorführbar",
    ).not.toEqual([]);
  });

  it("„Wartung“ steht in einem Titel und einer Aussage, nicht nur als Schlagwort", async () => {
    // BLOCK B macht „Wartung“ wieder substanztragend. Das nützt nur, wenn der Bestand das Wort
    // überhaupt in einem Titel oder einer Aussage führt — vorher stand es allein in zwei Tags.
    const kos = await bestand();
    expect(kos.some((k) => /wartung/i.test(k.title))).toBe(true);
    expect(kos.some((k) => /wartung/i.test(k.statement))).toBe(true);
  });
});
