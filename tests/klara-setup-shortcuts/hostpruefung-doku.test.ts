// ================================================================================================
// produkt:20261012:klara-setup-shortcuts-hostpruefung · DIE LIEFERDOKU AA-05 HÄLT IHRE BELEGE.
// ================================================================================================
//
//   H1  Jede in `HOSTPRUEFUNG.md` genannte Datei existiert (K2).
//   H2  Nicht geprüfte Hostfälle sind konkret als offen benannt; der Prüfrechner wird nicht als
//       Abnahme aller Hosts ausgegeben; systemweit bleibt offen (K3, K4, K5).
//   H3  Das Mac-Hostprotokoll ist vorhanden und nicht vorausgefüllt (K1, K3).
//   H4  Der Smoke verweist auf die offenen Hostfälle und nennt seine Attrappen (K3, K5).
//   H5  Die Nutzerhilfe im Bereich Tastenkürzel ist an der Karte Klara angebunden (K2).
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { repoPfad } from "../support/repoPfad";

const doku = readFileSync(repoPfad("docs/klara-setup-shortcuts/HOSTPRUEFUNG.md"), "utf8");
const quelle = (relativ: string): string => readFileSync(repoPfad(relativ), "utf8");
const abschnitt = (von: string, bis: string): string =>
  doku.slice(doku.indexOf(von), bis ? doku.indexOf(bis) : undefined);

describe("H1 · genannte Dateien existieren", () => {
  const pfade = [
    ...new Set(
      [...doku.matchAll(/`((?:apps|services|tests|tests-smoke)\/[^`\s]+\.[a-z]+)`/g)].map(
        (m) => m[1] as string,
      ),
    ),
  ];

  it("es werden Komponenten und Tests genannt", () => {
    expect(pfade).toContain("tests-smoke/klara-tastenkuerzel-browser.spec.ts");
    expect(pfade).toContain("tests/klara-setup-shortcuts/tastenkuerzel-pg.integration.test.ts");
    expect(pfade.length).toBeGreaterThan(10);
  });

  for (const pfad of pfade) {
    it(pfad, () => {
      expect(existsSync(repoPfad(pfad)), pfad).toBe(true);
    });
  }
});

describe("H2 · offene Hostfälle konkret, keine Gesamtabnahme", () => {
  const matrix = abschnitt("## 4.", "## 5.");

  it("Mac, VoiceOver, physische Layouts und Mikrofon stehen als nicht geprüft da", () => {
    for (const fall of ["echten Mac", "VoiceOver", "Mac-Tastatur", "Mikrofon"]) {
      const zeile = matrix.split("\n").find((z) => z.startsWith("| ") && z.includes(fall));
      expect(zeile, fall).toBeDefined();
      expect(zeile, fall).toContain("**nicht geprüft**");
    }
    expect(matrix).toContain(
      "Ein grüner Lauf auf dem Prüfrechner ist keine Abnahme sämtlicher Hosts.",
    );
  });

  it("systemweiter Aufruf bleibt offen und wird nirgends als erledigt gemeldet", () => {
    const zeile = matrix.split("\n").find((z) => z.includes("Systemweiter Aufruf"));
    expect(zeile).toContain("**offen**");
    expect(zeile).toContain("nicht implementiert");
    expect(doku).not.toMatch(/systemweit[^\n|]*(erledigt|umgesetzt|verfügbar|freigeschaltet)/i);
  });

  it("die Einschränkungen nennen den fehlenden Hostnachweis", () => {
    expect(abschnitt("## 7.", "")).toMatch(/Hostnachweis[^\n]*\n?[^\n]*\*\*nicht erfüllt\*\*/);
  });
});

describe("H3 · Mac-Hostprotokoll vorhanden, nicht vorausgefüllt", () => {
  const zeilen = abschnitt("## 5.", "## 6.")
    .split("\n")
    .filter((z) => /^\| P\d+ \|/.test(z));

  it("deckt Festlegen bis Zurücksetzen, Diktat, Layouts, VoiceOver, Rollen und Fehler ab", () => {
    expect(zeilen.length).toBeGreaterThanOrEqual(15);
    const text = zeilen.join("\n");
    for (const stichwort of [
      "festlegen",
      "Ändern",
      "Escape",
      "neu laden",
      "Entfernen",
      "alle zurücksetzen",
      "Diktieren",
      "Auftrag sprechen",
      "Vorlesen stoppen",
      "Deutsches Layout",
      "VoiceOver",
      "Leserolle",
      "Speicherfehler",
      "Word, Mail oder Finder",
    ]) {
      expect(text, stichwort).toContain(stichwort);
    }
  });

  it("jede Zeile ist offen", () => {
    for (const z of zeilen) {
      expect(z.trim().endsWith("| offen |"), z).toBe(true);
    }
  });
});

describe("H4 · der Smoke benennt Attrappen und Grenzen", () => {
  const smoke = quelle("tests-smoke/klara-tastenkuerzel-browser.spec.ts");

  it("verweist auf die offenen Hostfälle", () => {
    expect(smoke).toContain("docs/klara-setup-shortcuts/HOSTPRUEFUNG.md");
    expect(smoke).toContain("kein Mac-Host");
  });

  it("nennt die ersetzten Browser-Schnittstellen", () => {
    expect(smoke).toContain("ATTRAPPEN, ausdrücklich");
    expect(smoke).toContain('setze("SpeechRecognition", Rekorder);');
  });
});

describe("H5 · Nutzerhilfe im Bereich Tastenkürzel", () => {
  it("Texte in Deutsch und Englisch, angebunden an die Karte Klara", () => {
    const texte = quelle("apps/web/src/texte/klarasetup.ts");
    expect(texte.match(/"klarasetup\.hilfe\.text":/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
    expect(quelle("apps/web/src/pages/Profile.tsx")).toContain(
      'hilfe={[{ titel: t("klarasetup.hilfe.titel"), text: t("klarasetup.hilfe.text") }]}',
    );
  });
});
