// @vitest-environment jsdom
// ================================================================================================
// Aufnahme `gesamt-hilfen` · R-0888 / R-1017 — WELCHE HILFE STEHT HEUTE AN WELCHER STELLE?
// ================================================================================================
//
// DER ORIGINALWORTLAUT: R-0888 „Neben Feldern und Abschnitten steht ein Fragezeichen, das erklärt,
// was das Element tut …"; R-1017 „Erklärungen erscheinen an der Stelle der Oberfläche, an der ein
// Anwender ins Stocken gerät". Die Quelle zu R-1017 (mega92 Block E) verlangt ZUERST eine
// Erhebung, welche Flächen heute eine Hilfe tragen und welche nicht.
//
// BENS BEFUND (Nacharbeit 10): „Er zählt Hilfetexte und Komponenten, ordnet sie aber nicht den
// heutigen Feldern und Abschnitten zu." Die Zuordnung steht in
// `docs/hilfe/aufnahme-20260922-gesamt-hilfen.md` (Abschnitt „Zuordnung der Hilfen zu Feldern und
// Abschnitten"). Dieser Fall hält sie am QUELLTEXT fest, damit sie keine Behauptung bleibt:
//   Z1 · Erfassen: jedes der 23 Erfassen-Themen steht im „?"-Werkzeug des Blattes und in dessen
//        Seitenhilfe;
//   Z2 · Prüfbereich und Konflikte: welche Prüf-Themen welches „?"-Menü zeigt — aus den Filtern
//        der Seiten gelesen; zusammen mit der Detailseite ergibt das genau den Katalog;
//   Z3 · Detailseite: die zwölf Themen der Wissensobjekt-Seite zeigt KEINE Fläche (tatsächlich
//        fehlend an der Stelle; erreichbar nur über Klaras Suche);
//   Z4 · die Elementanker, an denen Klara ein Feld beim Antippen erklärt, und dass jeder auflöst;
//   Z5 · die entschiedene Form: `HelpTip` zeichnet nichts ins Sichtfeld, er meldet an die
//        Seitenhilfe (Pedi 04.09., JOB 3060);
//   Z6 · von den 79 Überschriften des Hilfe-Registers (Stand 05.07.) sind die 14 der alten
//        Detailseite entfallen.
//
// Ändert sich eine Zuordnung (ein Thema wandert an eine Fläche, ein Anker kommt dazu), wird dieser
// Fall rot — und die Tabelle im Abgleichsdokument ist nachzuführen. Er ist ein Inventar, keine
// Abnahme: „fehlend" in Z3 ist ein Befund, kein Sollzustand.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { BLATT_HILFE_THEMEN } from "../../apps/web/src/components/erfassen/hilfe";
import { CAPTURE_HELP_IDS } from "../../apps/web/src/lib/captureHelp";
import { klaraEntryById } from "../../apps/web/src/lib/klaraRegistry";
import { REVIEW_HELP_IDS } from "../../apps/web/src/lib/reviewHelp";
import { REPO_WURZEL, repoPfad } from "../support/repoPfad";

const lies = (pfad: string): string => readFileSync(repoPfad(pfad), "utf8");

/** Die Prüf-Themen, die eine Seite für ihr „?"-Menü aus dem Katalog filtert — gelesen. */
function gefilterteThemen(datei: string): string[] {
  const treffer = /REVIEW_HELP_TOPICS\.filter\(\(topic\) =>\s*\[([^\]]*)\]/.exec(lies(datei));
  return [...(treffer?.[1] ?? "").matchAll(/"(\w+)"/g)].map((wert) => wert[1] ?? "");
}

/** Alle Quelldateien der Oberfläche: Seiten, Bauteile, Hülle. */
function oberflaechendateien(): string[] {
  const dateien: string[] = [];
  const gehe = (ordner: string): void => {
    for (const name of readdirSync(ordner)) {
      const pfad = join(ordner, name);
      if (statSync(pfad).isDirectory()) gehe(pfad);
      else if (/\.tsx?$/.test(name)) dateien.push(pfad);
    }
  };
  for (const ordner of ["pages", "components", "shell"]) gehe(repoPfad(`apps/web/src/${ordner}`));
  return dateien;
}

// Die Zuordnung, wie sie im Abgleichsdokument steht.
const PRUEFBEREICH = [
  "originFilter",
  "reviewFocus",
  "filters",
  "mineOnly",
  "signals",
  "approve",
  "query",
  "reject",
  "feedbackForm",
  "assign",
  "markTrue",
];
const KONFLIKTE = ["conflictEscalate", "conflictSecondOpinion", "conflictResolve"];
const DETAILSEITE = [
  "stillValid",
  "reportConflict",
  "conflictForm",
  "sourcesLevel2",
  "sourceFields",
  "sourceAdd",
  "sourceSearch",
  "contribution",
  "helpful",
  "validity",
  "transfer",
  "deleteKo",
];
const ANKER = [
  "cap:interview",
  "cap:knowledgeType",
  "cap:tagsField",
  "cap:tellRaw",
  "rev:filters",
  "rev:mineOnly",
  "rev:originFilter",
  "rev:reviewFocus",
];

// Die Überschriften der alten Detailseite aus dem Hilfe-Register, die heute keine Fläche zeichnet.
const ENTFALLEN = [
  "ko.conflictTitle",
  "ko.helpfulTitle",
  "ko.sourceTitle",
  "ko.provenance",
  "ko.couple.title",
  "ext.validity.title",
  "ko.lineageTitle",
  "ko.relatedTitle",
  "ko.history",
  "ko.evidenceTitle",
  "ko.snapshotsTitle",
  "ko.comments",
  "ko.attachments",
];
const DETAILSEITE_DATEIEN = [
  "apps/web/src/pages/KnowledgeDetail.tsx",
  "apps/web/src/components/bibliothek/BibliothekLesen.tsx",
  "apps/web/src/components/bibliothek/MehrAbschnitte.tsx",
];

describe("R-0888 / R-1017 · Zuordnung der vorhandenen Hilfen zu Feldern und Abschnitten", () => {
  it("Z1 · Erfassen: jedes Erfassen-Thema steht im „?“-Werkzeug des Blattes und in seiner Seitenhilfe", () => {
    const imBlatt = new Set(BLATT_HILFE_THEMEN.map((thema) => thema.id));
    expect(CAPTURE_HELP_IDS.filter((id) => !imBlatt.has(id))).toEqual([]);
    const blatt = lies("apps/web/src/components/erfassen/Blatt.tsx");
    // Einmal als Anmeldung bei der Seitenhilfe (`HelpTip`), einmal als „?"-Werkzeug (`details`).
    expect(blatt.match(/BLATT_HILFE_THEMEN\.map\(/g) ?? []).toHaveLength(2);
    expect(blatt).toContain("data-testid={`blatt-hilfe-${thema.id}`}");
  });

  it("Z2 · Prüfbereich und Konflikte: jedes „?“-Menü zeigt genau seine Themen, der Rest gehört zur Detailseite", () => {
    expect(gefilterteThemen("apps/web/src/pages/Validation.tsx")).toEqual(PRUEFBEREICH);
    expect(gefilterteThemen("apps/web/src/pages/Conflicts.tsx")).toEqual(KONFLIKTE);
    const zugeordnet = [...PRUEFBEREICH, ...KONFLIKTE, ...DETAILSEITE];
    expect(new Set(zugeordnet).size, "ein Thema an zwei Flächen").toBe(zugeordnet.length);
    expect([...zugeordnet].sort()).toEqual([...REVIEW_HELP_IDS].sort());
  });

  it("Z3 · Detailseite: keine Fläche zeigt die zwölf Erklärungen — sie fehlen an der Stelle", () => {
    const funde: string[] = [];
    for (const datei of oberflaechendateien()) {
      const quelle = readFileSync(datei, "utf8");
      for (const id of DETAILSEITE) {
        if (quelle.includes(`"${id}"`) || quelle.includes(`vhelp.${id}`)) {
          funde.push(`${relative(REPO_WURZEL, datei)}: ${id}`);
        }
      }
    }
    expect(funde, "eine Fläche zeigt jetzt ein Thema — Zuordnung nachführen").toEqual([]);
    // Die Detailseite trägt nur ihre Seitenhilfe (Abschnittsebene), kein Element-Thema.
    const detail = lies("apps/web/src/pages/KnowledgeDetail.tsx");
    expect(detail).toContain('<HelpTip title={t("seitenhilfe.wissen.title")}');
    // „Noch gültig" hat heute kein Bedienelement mehr: die Leseansicht bietet „Re-Validierung".
    const flaechen = oberflaechendateien().map((datei) => readFileSync(datei, "utf8"));
    expect(flaechen.some((quelle) => quelle.includes('"ko.stillValid"'))).toBe(false);
  });

  it("Z4 · die Elementanker, an denen Klara ein Feld beim Antippen erklärt — und jeder löst auf", () => {
    const anker = new Set<string>();
    for (const datei of oberflaechendateien()) {
      for (const treffer of readFileSync(datei, "utf8").matchAll(/data-help="([^"]+)"/g)) {
        anker.add(treffer[1] ?? "");
      }
    }
    expect([...anker].sort()).toEqual(ANKER);
    for (const id of ANKER) {
      expect(klaraEntryById(id), `${id} löst in Klaras Registry nicht auf`).not.toBeNull();
    }
  });

  it("Z6 · Hilfe-Register (Stand 05.07.): die 14 Überschriften der alten Detailseite gibt es nicht mehr", () => {
    // `docs/hilfe/HILFE-REGISTER.md` Teil 1 führt 18 Überschriften der Detailseite. Seit dem Umbau auf
    // die Leseansicht (`BibliothekLesen`, „Mehr“-Blatt `MehrAbschnitte`) zeichnet keine Fläche diese
    // 13 Schlüssel mehr; „Externe Quelle suchen“ (`ext.title`) steht nur noch beim Erfassen.
    const flaechen = oberflaechendateien().map((datei) => readFileSync(datei, "utf8"));
    const gezeichnet = (key: string): boolean =>
      flaechen.some((quelle) => quelle.includes(`"${key}"`));
    expect(ENTFALLEN.filter(gezeichnet)).toEqual([]);
    for (const datei of DETAILSEITE_DATEIEN) {
      expect(lies(datei), `${datei}: „ext.title“`).not.toContain('"ext.title"');
    }
  });

  it("Z5 · die entschiedene Form: `HelpTip` zeichnet nichts ins Sichtfeld, er meldet an die Seitenhilfe", () => {
    const baustein = lies("apps/web/src/components/HelpTip.tsx");
    expect(baustein).toContain("useSeitenhilfeAnmeldung(title, body);");
    expect(baustein).toContain("return null;");
  });
});
