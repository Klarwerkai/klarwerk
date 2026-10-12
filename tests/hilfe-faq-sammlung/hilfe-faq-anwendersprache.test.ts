// ================================================================================================
// Aufnahme `gesamt-hilfen` · P-HILFE-ANWENDERSPRACHE / P-DOK1 — DIE FAQ DER HILFESEITE SPRICHT
// ANWENDERSPRACHE, UND DIE EINE ROLLENAUSNAHME STIMMT MIT DEM ECHTEN EXPORTVERTRAG ÜBEREIN.
// ================================================================================================
//
// BENS BEFUND (Nacharbeit 3): „Die neu eingeblendeten FAQ führen Rollen- und Prüfbegriffe wieder auf
// /hilfe ein … Die bestandenen Wortwahlprüfungen erfassen diesen neuen Inhalt nicht vollständig."
// Dieser Wächter erfasst ihn: JEDE Frage und JEDE Antwort der Lesefassung `lib/hilfeFaq.ts`, die
// `pages/Help.tsx` zeichnet, in allen drei Sprachen.
//
// DIE ROLLENAUSNAHME (Korrektur: „die sachlich erforderliche Export-Rollenausnahme aus P-DOK1
// erhalten und verständlich erklären"): Rollennamen sind nur in den Einträgen mit
// `rollenausnahme: true` erlaubt — und dort MÜSSEN sie stehen, und zwar genau die Rollen, denen
// der echte Export vertrauliche Einträge mitgibt. Die Erwartung kommt aus dem Vertrag, nicht aus
// einer Abschrift: `services/app/src/routes/library-routes.ts` bindet `includeConfidential` an
// `ko.validate`, und `services/rbac/src/policy.ts` sagt, wer `ko.validate` hat. Lesen ist dabei
// KEIN Exportrecht (DOK1-R, E31): `ko.read` haben alle Rollen.
//
// GEGENPROBEN:
//   · „Darf ein Controller den Beitrag eines Admins prüfen?" wieder aufnehmen      → A2 rot
//   · in der Exportantwort „Controller" streichen                                 → A4 rot
//   · `ko.validate` im Vertrag zusätzlich an „experte" geben                       → A4 rot
//   · „nur validierte" aus der Exportantwort streichen                             → A5 rot
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { FAQ_CONTENT } from "../../apps/web/src/lib/faqContent";
import { HILFE_FAQ } from "../../apps/web/src/lib/hilfeFaq";
import { ROLE_PERMISSIONS, can } from "../../services/rbac/src/policy";
import { repoPfad } from "../support/repoPfad";
import { type Rolle, SPRACHEN, enthaeltWort, funde, rollennamen } from "./wortwahl";

const ROLLEN = Object.keys(ROLE_PERMISSIONS) as Rolle[];

/** Die Wörter, die in jeder Sprache „validiert" und „vertraulich" sagen. */
const BEDINGUNG = {
  de: { validiert: "validiert", vertraulich: "vertraulich" },
  en: { validiert: "validated", vertraulich: "confidential" },
  nl: { validiert: "gevalideerd", vertraulich: "vertrouwelijk" },
} as const;

describe("P-HILFE-ANWENDERSPRACHE · die FAQ der Hilfeseite", () => {
  it("A0 · der Bestand trägt etwas: jede Frage und Antwort in allen drei Sprachen", () => {
    expect(HILFE_FAQ.length).toBeGreaterThan(20);
    expect(new Set(HILFE_FAQ.map((faq) => faq.id)).size).toBe(HILFE_FAQ.length);
    for (const faq of HILFE_FAQ) {
      for (const sprache of SPRACHEN) {
        const frage = faq.frage[sprache].trim();
        const antwort = faq.antwort[sprache].trim();
        expect(frage.length, `${faq.id} ${sprache}: Frage leer`).toBeGreaterThan(5);
        expect(antwort.length, `${faq.id} ${sprache}: Antwort leer`).toBeGreaterThan(20);
      }
    }
  });

  it("A1 · jede Frage stammt aus dem Fragenkatalog und behält dessen Absprungziel", () => {
    // R-0924: der systematische Katalog je Seite und Funktion — die Lesefassung erfindet keine
    // neue Frage und verlegt keine an eine andere Route.
    for (const faq of HILFE_FAQ) {
      const original = FAQ_CONTENT.find((eintrag) => eintrag.id === faq.id);
      expect(original, `${faq.id} steht nicht im Fragenkatalog`).toBeDefined();
      expect(faq.route, faq.id).toBe(original?.route);
    }
  });

  it("A2 · kein interner Rollen-, Prüf- oder Pilotbegriff außerhalb der Rollenausnahme", () => {
    const gefunden: string[] = [];
    for (const faq of HILFE_FAQ) {
      const rollenErlaubt = faq.rollenausnahme === true;
      for (const sprache of SPRACHEN) {
        for (const fund of funde(faq.frage[sprache], sprache, rollenErlaubt)) {
          gefunden.push(`${faq.id} · ${sprache} · Frage: ${fund}`);
        }
        for (const fund of funde(faq.antwort[sprache], sprache, rollenErlaubt)) {
          gefunden.push(`${faq.id} · ${sprache} · Antwort: ${fund}`);
        }
      }
    }
    expect(gefunden, "interne Begriffe stehen im angezeigten FAQ-Text").toEqual([]);
  });

  it("A3 · KALIBRIERUNG: der beanstandete Originalwortlaut würde rot", () => {
    // Ohne diesen Fall wäre A2 auch dann grün, wenn `funde` gar nichts erkennt.
    const original = FAQ_CONTENT.find((faq) => faq.id === "faq.pruefen.8");
    if (!original) throw new Error("faq.pruefen.8 fehlt im Fragenkatalog");
    expect(funde(original.question, "de", false).length).toBeGreaterThan(0);
    const board = FAQ_CONTENT.find((faq) => faq.id === "faq.erfassen.7");
    if (!board) throw new Error("faq.erfassen.7 fehlt im Fragenkatalog");
    expect(funde(board.answer, "de", false).join(" ")).toContain("Prüf-Board");
  });
});

describe("P-DOK1 · die Export-Rollenausnahme stimmt mit dem echten Exportvertrag", () => {
  const exportberechtigt = ROLLEN.filter((rolle) => can(rolle, "ko.validate")).sort();

  it("A4 · die Ausnahme nennt GENAU die Rollen, denen der Export Vertrauliches mitgibt", () => {
    // Der Export bindet die Vertraulichkeit an `ko.validate` — am echten Quelltext nachgelesen.
    const route = readFileSync(repoPfad("services/app/src/routes/library-routes.ts"), "utf8");
    expect(route).toContain('const includeConfidential = can(user.role, "ko.validate");');
    expect(exportberechtigt.length, "niemand darf Vertrauliches exportieren?").toBeGreaterThan(0);
    // Lesen ist kein Exportrecht: alle Rollen lesen, nicht alle exportieren Vertrauliches.
    expect(ROLLEN.every((rolle) => can(rolle, "ko.read"))).toBe(true);
    expect(exportberechtigt.length).toBeLessThan(ROLLEN.length);

    const ausnahmen = HILFE_FAQ.filter((faq) => faq.rollenausnahme === true);
    expect(ausnahmen.map((faq) => faq.id).sort()).toEqual(["faq.bibliothek.6", "faq.vertrauen.5"]);
    for (const faq of ausnahmen) {
      for (const sprache of SPRACHEN) {
        const namen = rollennamen(sprache);
        const text = faq.antwort[sprache];
        for (const rolle of ROLLEN) {
          expect(
            enthaeltWort(text, namen[rolle]),
            `${faq.id} ${sprache}: Rolle „${namen[rolle]}“`,
          ).toBe(exportberechtigt.includes(rolle));
        }
      }
    }
  });

  it("A5 · die Ausnahme nennt beide Grenzen: nur vertrauliche, und nur validierte", () => {
    for (const faq of HILFE_FAQ.filter((eintrag) => eintrag.rollenausnahme === true)) {
      for (const sprache of SPRACHEN) {
        const text = faq.antwort[sprache].toLowerCase();
        expect(text, `${faq.id} ${sprache}`).toContain(BEDINGUNG[sprache].vertraulich);
        expect(text, `${faq.id} ${sprache}`).toContain(BEDINGUNG[sprache].validiert);
      }
    }
  });
});
