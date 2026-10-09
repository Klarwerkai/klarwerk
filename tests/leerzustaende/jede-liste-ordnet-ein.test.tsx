// @vitest-environment jsdom
// ================================================================================================
// R-0956 (Ben, Nacharbeit 7) — „JEDE LEERE LISTE ERKLÄRT, WARUM ES KLARWERK GIBT, WO MAN GERADE IM
// WISSENSKREIS STEHT UND WAS DER NÄCHSTE SINNVOLLE SCHRITT IST."
// ================================================================================================
//
// Der Bestandsabgleich (`docs/bestandsaufnahme-lade-leer-fehler.md`, Abschnitt 2) führt jede leere
// LISTE der Oberfläche mit Datei und Leersatz. Dieser Sammler hält genau diese Liste gegen den
// Quelltext:
//   S1  jede geführte Datei trägt ihren Leersatz UND die Einordnung (Zeile, Rahmen oder Baustein) —
//       fällt eine Einordnung weg, wird dieser Fall rot und nennt Datei und Satz;
//   S2  jede Story-Fläche liefert in DE, EN und NL Titel („warum Klarwerk"), Phase („wo im Kreis")
//       und den flächeneigenen Satz („nächster Schritt") — gemessen an der gezeichneten Zeile.
//
// Was hier NICHT steht, ist im Abgleich mit Grund geführt: eingegrenzte Bestände (Filter/Suche,
// R-0963 trennt sie ausdrücklich) und Stellen, die keine Liste sind (Feldwerte, Auswahl-Optionen,
// Ergebnis einzelner Werkzeugläufe).
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { leerzustandsZeile } from "../../apps/web/src/components/EmptyStateCtas";
import i18n from "../../apps/web/src/i18n";
import { type StorySurface, knowledgeStory } from "../../apps/web/src/lib/knowledgeStory";
import { repoPfad } from "../support/repoPfad";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// R-1349: das Produkt führt keine Flächenliste mehr. Der Record erzwingt, dass hier jede Fläche
// des Typs steht — eine neue Fläche ohne Eintrag ist ein Typfehler, keine stille Lücke.
const FLAECHEN = Object.keys({
  start: true,
  tasks: true,
  library: true,
  validation: true,
  risk: true,
  neighborhood: true,
  audit: true,
  gaps: true,
  lifecycle: true,
  duplicates: true,
  objekt: true,
  entwuerfe: true,
  verwaltung: true,
  auswertung: true,
  import: true,
  anleitung: true,
  spaces: true,
  ausgang: true,
  wissensnetz: true,
  meldungen: true,
  horizont: true,
  lernpfad: true,
  hilfe: true,
  conflicts: true,
  gliederung: true,
} satisfies Record<StorySurface, true>) as StorySurface[];

/** Datei · Leersatz — die Listen aus dem Bestandsabgleich (Abschnitt 2). */
const LISTEN: readonly (readonly [string, string])[] = [
  ["apps/web/src/pages/MyTasks.tsx", "task.none"],
  ["apps/web/src/pages/Validation.tsx", "val.empty"],
  ["apps/web/src/pages/Risk.tsx", "risk.cockpitEmpty"],
  ["apps/web/src/pages/Risk.tsx", "risk.busEmpty"],
  ["apps/web/src/pages/Risk.tsx", "risk.gapsEmpty"],
  ["apps/web/src/pages/Lifecycle.tsx", "lcy.empty"],
  ["apps/web/src/pages/Lifecycle.tsx", "lcy.pathEmpty"],
  ["apps/web/src/pages/Duplicates.tsx", "dup.empty"],
  ["apps/web/src/pages/Conflicts.tsx", "con.empty"],
  ["apps/web/src/pages/Analytics.tsx", "ana.auditEmpty"],
  ["apps/web/src/components/KnowledgeNeighborhood.tsx", "nb.empty"],
  ["apps/web/src/components/bibliothek/BibliothekListe.tsx", "lib.liste.leer"],
  ["apps/web/src/components/bibliothek/MehrAbschnitte.tsx", "ko.sourcesEmpty"],
  ["apps/web/src/components/bibliothek/MehrAbschnitte.tsx", "ko.attachmentsEmpty"],
  ["apps/web/src/components/bibliothek/MehrAbschnitte.tsx", "ko.couple.empty"],
  ["apps/web/src/components/bibliothek/MehrAbschnitte.tsx", "ko.lineageEventsEmpty"],
  ["apps/web/src/components/bibliothek/MehrAbschnitte.tsx", "ko.evidenceEmpty"],
  ["apps/web/src/components/bibliothek/MehrAbschnitte.tsx", "ko.snapshotsEmpty"],
  ["apps/web/src/components/bibliothek/MehrAbschnitte.tsx", "ko.commentsEmpty"],
  [
    "apps/web/src/components/kenntnisnahme/KenntnisnahmeBereich.tsx",
    "kenntnisnahme.uebersicht.leer",
  ],
  ["apps/web/src/components/WissensbeziehungenBereich.tsx", "wb.leer"],
  ["apps/web/src/components/ConflictTargetPicker.tsx", "ko.conflictTargetEmpty"],
  ["apps/web/src/components/AppendToArticleModal.tsx", "xtr.append.none"],
  ["apps/web/src/components/start/StartKarten.tsx", "task.none"],
  ["apps/web/src/components/start/StartKarten.tsx", "start.zuletzt.leer"],
  ["apps/web/src/components/start/StartPanel.tsx", "start.livewall.savedEmpty"],
  ["apps/web/src/components/start/StartPanel.tsx", "start.livewall.helpedEmpty"],
  ["apps/web/src/components/start/LiveWallValidiert.tsx", "start.livewall.validatedEmpty"],
  ["apps/web/src/pages/LiveWallBeamer.tsx", "start.livewall.savedEmpty"],
  ["apps/web/src/pages/LiveWallBeamer.tsx", "start.livewall.helpedEmpty"],
  ["apps/web/src/pages/Mobile.tsx", "mob.draftsEmpty"],
  ["apps/web/src/pages/Mobile.tsx", "mob.konto.eigeneLeer"],
  ["apps/web/src/pages/MeineEntwuerfe.tsx", "erfassen.entwuerfe.keine"],
  ["apps/web/src/pages/MeineEntwuerfe.tsx", "adm.trash.empty"],
  ["apps/web/src/pages/AdminDatenDetails.tsx", "adm.trash.empty"],
  ["apps/web/src/pages/AdminDatenDetails.tsx", "adm.auditEmpty"],
  ["apps/web/src/pages/AdminSicherheitDetails.tsx", "adm.auditEmpty"],
  ["apps/web/src/pages/AdminKiDetails.tsx", "adm.presets.empty"],
  ["apps/web/src/pages/AdminBetriebDetails.tsx", "adm.backup.none"],
  ["apps/web/src/pages/Capture.tsx", "capture.reviewers.none"],
  ["apps/web/src/pages/Stufe2.tsx", "out.noValidated"],
  ["apps/web/src/pages/Stufe2.tsx", "imp.queueEmpty"],
  ["apps/web/src/pages/Stufe2.tsx", "mgmt.empty"],
  ["apps/web/src/pages/Stufe2.tsx", "mgmt.noRecs"],
  // Hauptstand (Nacharbeit 9): die drei QM-Leersätze heißen jetzt `fachwort.*` (texte/fachwort.ts).
  ["apps/web/src/pages/Stufe2.tsx", "fachwort.kiLaeufe.leer"],
  ["apps/web/src/pages/Stufe2.tsx", "mrun.report.empty"],
  ["apps/web/src/pages/Stufe2.tsx", "fachwort.belegIndex.leer"],
  ["apps/web/src/pages/Stufe2.tsx", "prov.empty"],
  ["apps/web/src/pages/Stufe2.tsx", "kos.hints.none"],
  ["apps/web/src/pages/Stufe2.tsx", "fachwort.belegFrische.leer"],
  ["apps/web/src/pages/Stufe2.tsx", "wissensgraph.sicht.leer"],
  ["apps/web/src/pages/Stufe2.tsx", "s2.graphEmpty"],
  ["apps/web/src/components/ImportExplore.tsx", "imp.explore.empty"],
  ["apps/web/src/components/sharepoint-import/SharePointImportBereich.tsx", "imp.sharepoint.leer"],
  ["apps/web/src/components/gesamtanweisung/GesamtanweisungBereich.tsx", "ga.liste.leer"],
  ["apps/web/src/components/gesamtanweisung/LesestandAnsicht.tsx", "ga.leer"],
  ["apps/web/src/pages/Spaces.tsx", "spaces.seite.leer"],
  ["apps/web/src/pages/Ausgangspruefung.tsx", "ausgangspruefung.seite.leer"],
  ["apps/web/src/pages/Wissensnetz.tsx", "wissensnetz.leer"],
  ["apps/web/src/pages/Wissensnetz.tsx", "wissensnetz.leiste.leer"],
  ["apps/web/src/shell/Meldungen.tsx", "topbar.notificationsEmpty"],
  ["apps/web/src/components/RisikoHorizont.tsx", "risk.horizon.noneInHorizon"],
  ["apps/web/src/shell/ZahnradMenue.tsx", "menue.seitenhilfe.leer"],
  ["apps/web/src/pages/DuplicateMerge.tsx", "dublettenvergleich.quellen.keine"],
  ["apps/web/src/pages/DuplicateMerge.tsx", "dublettenvergleich.keinePositionen"],
  ["apps/web/src/components/RichTextEditor.tsx", "editor.noImages"],
  ["apps/web/src/components/RichTextEditor.tsx", "editor.noFiles"],
  ["apps/web/src/components/erfassen/Blatt.tsx", "erfassen.anhaenge.keine"],
];

/** Die drei Bauformen derselben Einordnung (ein Baustein, ein Rahmen, eine Zeile). */
const EINORDNUNG = /leerzustandsZeile\(|leerzustandsRahmen\(|<EmptyStateCtas\b/;

describe("R-0956 · S1 — jede geführte leere Liste trägt ihre Einordnung", () => {
  for (const [datei, schluessel] of LISTEN) {
    it(`${datei} · ${schluessel}`, () => {
      const quelle = readFileSync(repoPfad(datei), "utf8");
      const satzFehlt = `${datei}: der Leersatz „${schluessel}“ steht nicht (mehr) in der Datei`;
      expect(quelle, satzFehlt).toContain(`"${schluessel}"`);
      const ohneEinordnung = `${datei}: „${schluessel}“ steht ohne Einordnung in den Wissenskreis`;
      expect(EINORDNUNG.test(quelle), ohneEinordnung).toBe(true);
    });
  }
});

describe("R-0956 · S2 — die Einordnung trägt alle drei Zusagen, in DE, EN und NL", () => {
  for (const sprache of ["de", "en", "nl"] as const) {
    it(`${sprache}: Titel, Phase und flächeneigener Satz je Fläche`, async () => {
      await i18n.changeLanguage(sprache);
      for (const flaeche of FLAECHEN) {
        const story = knowledgeStory(flaeche);
        const container = document.createElement("div");
        const root = createRoot(container);
        act(() => {
          root.render(createElement("div", null, leerzustandsZeile(i18n.t, flaeche)));
        });
        const text = container.textContent ?? "";
        for (const key of [story.titleKey, story.phaseLabelKey, story.leadKey]) {
          const wert = i18n.t(key);
          expect(wert, `${sprache}/${flaeche}: ${key} fehlt im Wörterbuch`).not.toBe(key);
          expect(text, `${sprache}/${flaeche}: ${key} steht nicht in der Zeile`).toContain(wert);
        }
        act(() => root.unmount());
      }
      await i18n.changeLanguage("de");
    });
  }
});
