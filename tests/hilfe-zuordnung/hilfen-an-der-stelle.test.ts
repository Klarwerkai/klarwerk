// @vitest-environment jsdom
// ================================================================================================
// Aufnahme `gesamt-hilfen` · R-0888 / R-1017 — WELCHE HILFE STEHT HEUTE AN WELCHER STELLE?
// ================================================================================================
//
// DER ORIGINALWORTLAUT: R-0888 „Neben Feldern und Abschnitten steht ein Fragezeichen, das erklärt,
// was das Element tut …"; R-1017 „Erklärungen erscheinen an der Stelle der Oberfläche, an der ein
// Anwender ins Stocken gerät". Die beschlossene Form ist seit Pedis Entscheidung vom 04.09. nicht
// das „?" im Sichtfeld, sondern die Seitenhilfe im Zahnrad bzw. das „?"-Menü der Fläche (Z5).
//
// BENS BEFUNDE:
//   Nacharbeit 10 — „ordnet sie aber nicht den heutigen Feldern und Abschnitten zu": die Zuordnung
//     steht in `docs/hilfe/aufnahme-20260922-gesamt-hilfen.md`; Z1, Z2, Z4–Z6 halten sie fest.
//   Nacharbeit 13 — „Die Erhebung ist damit geliefert, die festgestellten Funktionslücken bestehen
//     weiter": seither stehen die Erklärungen AN DER STELLE. Z3 (Wissensobjekt-Handlungen und
//     „Noch gültig"), Z7 (Abschnittserklärungen) und Z8 (berichtigte Löschhilfe, Registry-Ziele)
//     prüfen das am Quelltext; dass eine angemeldete Erklärung im Zahnrad wirklich erscheint,
//     belegen für den Baustein `HelpTip` die gemounteten Seitenhilfe-Wächter
//     (`tests/seitenhilfe-flaechen/`, `tests/seitenhilfe-luecken/`).
//
// GEGENPROBEN: eine Anmeldung aus `MehrAbschnitte.tsx` nehmen → Z3 rot; eine Abschnittserklärung
// entfernen → Z7 rot; `BODY_KEY_ABWEICHEND` in `lib/reviewHelp.ts` leeren → Z8 rot.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { BLATT_HILFE_THEMEN } from "../../apps/web/src/components/erfassen/hilfe";
import i18n from "../../apps/web/src/i18n";
import { CAPTURE_HELP_IDS } from "../../apps/web/src/lib/captureHelp";
import { klaraEntryById } from "../../apps/web/src/lib/klaraRegistry";
import { REVIEW_HELP_IDS, reviewHelp } from "../../apps/web/src/lib/reviewHelp";
import { REPO_WURZEL, repoPfad } from "../support/repoPfad";

const lies = (pfad: string): string => readFileSync(repoPfad(pfad), "utf8");

/** Die Prüf-Themen, die eine Seite für ihr „?"-Menü aus dem Katalog filtert — gelesen. */
function gefilterteThemen(datei: string): string[] {
  const treffer = /REVIEW_HELP_TOPICS\.filter\(\(topic\) =>\s*\[([^\]]*)\]/.exec(lies(datei));
  return [...(treffer?.[1] ?? "").matchAll(/"(\w+)"/g)].map((wert) => wert[1] ?? "");
}

/** Alle Quelldateien der Oberfläche: Seiten, Bauteile, Hülle — ohne die dort liegenden Tests. */
function oberflaechendateien(): string[] {
  const dateien: string[] = [];
  const gehe = (ordner: string): void => {
    for (const name of readdirSync(ordner)) {
      const pfad = join(ordner, name);
      if (statSync(pfad).isDirectory()) gehe(pfad);
      else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) dateien.push(pfad);
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
// Die Handlungen am Wissensobjekt (Leseansicht und ihr „Mehr“-Blatt).
const DETAILSEITE = [
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
// „Noch gültig“ steht als Knopf im Reiter „Erneut“ (`pages/Lifecycle.tsx`).
const ERNEUT = ["stillValid"];
const DETAILSEITE_BAUTEILE = [
  "apps/web/src/components/bibliothek/MehrAbschnitte.tsx",
  "apps/web/src/components/bibliothek/BibliothekLesen.tsx",
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
const DETAILSEITE_DATEIEN = ["apps/web/src/pages/KnowledgeDetail.tsx", ...DETAILSEITE_BAUTEILE];

// Abschnitte des Hilfe-Registers, die heute gezeichnet werden und bis Nacharbeit 13 keine eigene
// Erklärung an der Stelle hatten: [Datei, Überschrift, Schlüssel der Erklärung].
const STUFE2 = "apps/web/src/pages/Stufe2.tsx";
const ABSCHNITTE: readonly (readonly [string, string, string])[] = [
  ["apps/web/src/pages/Analytics.tsx", "ana.byType", "shelp.ana.byType"],
  ["apps/web/src/pages/Analytics.tsx", "ana.weekly", "shelp.ana.weekly"],
  ["apps/web/src/pages/Ask.tsx", "ask.steps", "shelp.ask.steps"],
  [
    "apps/web/src/components/CaptureDraftList.tsx",
    "capture.resumeTitle",
    "abschnittshilfe.capture.resumeTitle",
  ],
  ["apps/web/src/pages/Capture.tsx", "ext.title", "shelp.ext.title"],
  [
    "apps/web/src/pages/ExternalKnowledge.tsx",
    "extpage.resultsTitle",
    "shelp.extpage.resultsTitle",
  ],
  ["apps/web/src/components/ImportJsonUpload.tsx", "imp.uploadTitle", "shelp.imp.uploadTitle"],
  ...[
    "out.kindTitle",
    "out.sourcesTitle",
    "out.composeTitle",
    "out.previewTitle",
    "out.provenanceTitle",
    "ext.pipeline.title",
    "imp.queueTitle",
    "mgmt.jumpTitle",
    "mgmt.overview",
    "mgmt.capital",
    "mgmt.valuation",
    "mgmt.statement",
    "mgmt.maturity",
    "mgmt.house",
    "mgmt.recommendations",
    "mgmt.priorities",
    "mgmt.pilot",
    "mrun.title",
    "rcfg.title",
    "evx.title",
    "prov.title",
    "readiness.title",
    "kos.hintsTitle",
    "evFresh.title",
  ].map((key) => [STUFE2, key, `shelp.${key}`] as const),
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

  it("Z2 · jedes Prüf-Thema hat genau eine Fläche: Prüfkopf, Konflikte, Wissensobjekt oder „Erneut“", () => {
    expect(gefilterteThemen("apps/web/src/pages/Validation.tsx")).toEqual(PRUEFBEREICH);
    expect(gefilterteThemen("apps/web/src/pages/Conflicts.tsx")).toEqual(KONFLIKTE);
    const zugeordnet = [...PRUEFBEREICH, ...KONFLIKTE, ...DETAILSEITE, ...ERNEUT];
    expect(new Set(zugeordnet).size, "ein Thema an zwei Flächen").toBe(zugeordnet.length);
    expect([...zugeordnet].sort()).toEqual([...REVIEW_HELP_IDS].sort());
  });

  it("Z3 · Nacharbeit 13: die Erklärungen der Wissensobjekt-Handlungen und von „Noch gültig“ stehen an der Stelle", () => {
    const bauteile = DETAILSEITE_BAUTEILE.map(lies).join("\n");
    const fehlt: string[] = [];
    for (const id of DETAILSEITE) {
      const thema = reviewHelp(id as (typeof REVIEW_HELP_IDS)[number]);
      // `deleteKo` holt Titel und Text über `reviewHelp` (berichtigter Text, Z8); die übrigen
      // nennen ihre Schlüssel unmittelbar.
      const direkt =
        bauteile.includes(`title={t("${thema.titleKey}")}`) &&
        bauteile.includes(`body={t("${thema.bodyKey}")}`);
      const ueberKatalog =
        bauteile.includes(`title={t(reviewHelp("${id}").titleKey)}`) &&
        bauteile.includes(`body={t(reviewHelp("${id}").bodyKey)}`);
      if (!direkt && !ueberKatalog) fehlt.push(id);
    }
    expect(fehlt, "diese Handlungen am Wissensobjekt melden ihre Erklärung nicht an").toEqual([]);
    // „Noch gültig“: der Knopf steht im Reiter „Erneut“, und die Erklärung im „?“-Menü daneben.
    const erneut = lies("apps/web/src/pages/Lifecycle.tsx");
    expect(erneut).toContain('{t("lcy.stillValid")}');
    expect(erneut).toContain('<PruefenHilfeBlock titel={t("vhelp.stillValid.title")}>');
    expect(erneut).toContain('{t("vhelp.stillValid.body")}');
    // Der Knopf heißt „Noch gültig → neue Version“; die Erklärung trägt seinen ersten Teil als Titel.
    const de = i18n.getFixedT("de");
    expect(de("lcy.stillValid").startsWith(de("vhelp.stillValid.title"))).toBe(true);
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

  it("Z6 · Hilfe-Register (Stand 05.07.): die Überschriften der alten Detailseite gibt es nicht mehr", () => {
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
    // Nacharbeit 13: „Aussage“, „Bedingungen“, „Maßnahme“ (`components/ko/KoRead.tsx`) stehen nur noch
    // in Bausteinen, die KEINE Fläche montiert — eingebunden wird `KoRead` allein von `KoReadView`,
    // und `KoReadView` von niemandem.
    const einbinder = oberflaechendateien()
      .filter((datei) => /from "\.{1,2}\/(ko\/|components\/ko\/)?KoReadView"/.test(lies(datei)))
      .map((datei) => relative(REPO_WURZEL, datei));
    expect(einbinder, "KoReadView wird wieder montiert — Zuordnung nachführen").toEqual([]);
  });

  it("Z7 · Nacharbeit 13: jeder gezeichnete Register-Abschnitt meldet seine Erklärung an der Stelle an", () => {
    const fehlt: string[] = [];
    for (const [datei, ueberschrift, erklaerung] of ABSCHNITTE) {
      const quelle = lies(datei);
      // Integration mit gesamt-sprache-begriffe (R-0908): sieben Stufe-2-Abschnitte zeigen ihre
      // Überschrift in Anwendersprache aus `texte/fachwort.ts`; Kennung und Erklärtext bleiben am
      // alten Schlüssel. Gesucht wird deshalb die Überschrift, die Klara für DENSELBEN Abschnitt
      // zeigt (`titel` in `lib/klaraRegistry.ts`) — für alle übrigen ist das der Schlüssel selbst.
      const titel = klaraEntryById(`sec:${ueberschrift}`)?.titleKey ?? ueberschrift;
      if (!quelle.includes(`<SectionLabel>{t("${titel}"`)) {
        fehlt.push(`${datei}: die Überschrift ${ueberschrift} steht nicht mehr da`);
      }
      if (!quelle.includes(`body={t("${erklaerung}")}`)) {
        fehlt.push(`${datei}: ${ueberschrift} meldet ${erklaerung} nicht an`);
      }
      for (const sprache of ["de", "en", "nl"] as const) {
        const text = i18n.getFixedT(sprache)(erklaerung);
        if (text === erklaerung || text.trim().length < 40) {
          fehlt.push(`${sprache}: ${erklaerung} fehlt`);
        }
      }
    }
    expect(fehlt).toEqual([]);
    expect(ABSCHNITTE.length).toBe(31);
  });

  it("Z8 · Nacharbeit 13: die Löschhilfe sagt, was Löschen tut, und Klara führt jedes Thema an seine Fläche", () => {
    const loeschen = reviewHelp("deleteKo");
    expect(loeschen.bodyKey).toBe("loeschhilfe.deleteKo.body");
    // Die Frist steht EINMAL im Server; der Text muss genau sie nennen.
    const dienst = lies("services/knowledge-object/src/service.ts");
    const tage = /export const TRASH_RETENTION_DAYS = (\d+);/.exec(dienst)?.[1];
    expect(tage, "die Papierkorbfrist ist im Server nicht lesbar").toBeDefined();
    const erwartet = {
      de: ["Papierkorb", `${tage} Tage`, "Admin"],
      en: ["recycle bin", `${tage} days`, "admin"],
      nl: ["prullenbak", `${tage} dagen`, "admin"],
    } as const;
    for (const sprache of ["de", "en", "nl"] as const) {
      const text = i18n.getFixedT(sprache)(loeschen.bodyKey);
      for (const wort of erwartet[sprache]) {
        expect(text, `${sprache}: „${wort}“ fehlt in der Löschhilfe`).toContain(wort);
      }
      expect(klaraEntryById("rev:deleteKo")?.bodyKey).toBe(loeschen.bodyKey);
    }
    expect(klaraEntryById("rev:stillValid")?.route).toBe("/lebenszyklus");
    expect(klaraEntryById("rev:deleteKo")?.route).toBe("/bibliothek");
    expect(klaraEntryById("rev:conflictResolve")?.route).toBe("/konflikte");
    expect(klaraEntryById("rev:approve")?.route).toBe("/validierung");
  });

  it("Z9 · Nacharbeit 15: Fläche und Klara erklären Entwürfe und Konfliktformular mit derselben, geltenden Fassung", () => {
    // Ben: „Seitenhilfe und Klara müssen denselben geltenden Sachverhalt erklären.“
    expect(klaraEntryById("sec:capture.resumeTitle")?.bodyKey).toBe(
      "abschnittshilfe.capture.resumeTitle",
    );
    const formular = reviewHelp("conflictForm");
    expect(formular.bodyKey).toBe("abschnittshilfe.conflictForm.body");
    expect(klaraEntryById("rev:conflictForm")?.bodyKey).toBe(formular.bodyKey);
    // Keine Fläche liest mehr die alten Fassungen.
    const flaechen = oberflaechendateien().map((datei) => readFileSync(datei, "utf8"));
    for (const alt of ["vhelp.conflictForm.body", "shelp.capture.resumeTitle"]) {
      expect(
        flaechen.some((quelle) => quelle.includes(`"${alt}"`)),
        alt,
      ).toBe(false);
    }
    // Das Formular verlangt die Art der Arbeit — und die Erklärung nennt sie, samt Knopf, mit der
    // angezeigten Beschriftung, in jeder Sprache.
    expect(lies(DETAILSEITE_BAUTEILE[0] ?? "")).toContain("!conflict.arbeitsart");
    for (const sprache of ["de", "en", "nl"] as const) {
      const t = i18n.getFixedT(sprache);
      const text = t(formular.bodyKey);
      for (const key of ["konfliktarbeit.feld", "ko.conflictTarget", "ko.conflictSubmit"]) {
        expect(text, `${sprache}: „${t(key)}“ fehlt in der Konflikthilfe`).toContain(t(key));
      }
    }
  });

  it("Z5 · die entschiedene Form: `HelpTip` zeichnet nichts ins Sichtfeld, er meldet an die Seitenhilfe", () => {
    const baustein = lies("apps/web/src/components/HelpTip.tsx");
    expect(baustein).toContain("useSeitenhilfeAnmeldung(title, body);");
    expect(baustein).toContain("return null;");
  });
});
