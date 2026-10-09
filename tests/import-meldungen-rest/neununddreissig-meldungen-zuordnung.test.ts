// ================================================================================================
// AUFTRAG import-meldungen · K3 — DIE 39 ALS „NICHT_ERREICHBAR" INVENTARISIERTEN MELDUNGEN.
// ================================================================================================
//
// JOB 3379 hat 39 Meldungen aus `CAPTURE_FILE_TEXT` als NICHT_ERREICHBAR geführt — gemessen an
// EINER Bühne, die nur eine TXT einliest (`sprachwechsel-import-meldungen.test.tsx`). Seitdem haben
// jüngere Lieferungen Wege gebaut, die diese Bühne nicht kennt (PDF/PPTX in Chromium, DOCX mit
// Beschriftungen, KI-Punkte über eine Attrappe). Hier steht für jede der 39 ihr heutiger Stand:
//
//   erreichbar  — ein Test bedient den ECHTEN Arbeitsraum (gemountet oder Chromium) bis in diesen
//                 Zustand und liest den Satz auf der Fläche; der Beleg ist die genannte Datei.
//   ersetzt     — der Arbeitsraum zeigt an dieser Stelle einen anderen Schlüssel.
//   unbewiesen  — kein Flächenbeleg. Ein genannter Beleg ist dann höchstens ein Einheitentest der
//                 Auswahllogik; der Rest sagt, was fehlt.
//
// WAS DIESE DATEI PRÜFT, und was nicht: sie bindet die Tabelle an das Inventar (keine Meldung fehlt
// oder kommt hinzu) und hält jeden Beleg maschinell nach — die Datei gibt es, sie nennt den
// Schlüssel, und für „erreichbar" bedient sie die echte Fläche. Ob der zitierte Fall GRÜN ist, sagt
// erst sein eigener Lauf (im Prüfplan dieses Auftrags mitgeführt). Diese Datei ist
// Quelleninspektion, kein Wirkungsnachweis.
//
// REPARATURSCHNITT: unter den 39 ist kein reproduzierbarer Fehler belegt — „unbewiesen" heißt
// „ohne Flächenbeleg", nicht „kaputt". Einen Reparaturschnitt begründen nur die acht eingefrorenen
// Sprachmeldungen (`acht-meldungen-drei-sprachen.test.tsx`) und der gesperrte Abbruch während des
// Einlesens (C3 in `abbruch-dann-moduswechsel.test.tsx`).
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { CAPTURE_FILE_TEXT as T } from "../../apps/web/src/lib/captureFromFile";

type Schluessel = keyof typeof T;
type Stand = "erreichbar" | "ersetzt" | "unbewiesen";

interface Zuordnung {
  readonly stand: Stand;
  readonly beleg: readonly string[];
  readonly rest: string;
}

const WURZEL = resolve(process.cwd());
const INVENTAR = "tests/import-anleitung-modus/sprachwechsel-import-meldungen.test.tsx";

const B = {
  pdfKette: "tests/d3-dateien-durchgaengig/pdf-durchgaengig-chromium.test.ts",
  pptxKette: "tests/d3-dateien-durchgaengig/pptx-durchgaengig-chromium.test.ts",
  pptxDreiSprachen: "tests/pptx-importquittung/nutzerweg-drei-sprachen-chromium.test.ts",
  docxBilanz: "tests/m5c-ui-bildunterschriften/quittung-bilanz-mounted.test.tsx",
  abwahl: "tests/entwurf-verlassen/dateiweg-abwahl-mounted.test.tsx",
  teilfehler: "tests/entwurf-verlassen/dateiweg-teilfehler-mounted.test.tsx",
  gesamtfehler: "tests/erfassen-verwerfen-gesamtfehler/gesamtfehler-modusleiste-mounted.test.tsx",
  warteschlange: "tests/capture/navguard-unsavable-mounted.test.tsx",
  bildbudget: "tests/capture/wp-d9b-image-budget.test.ts",
  pptxEhrlich: "tests/app/pptx-notes-honesty.test.ts",
  ship4: "tests/capture/wp-d9c-ship4.test.ts",
  bildnotiz: "tests/app/import-image-notice.test.ts",
  docxStruktur: "tests/structure/docx-rich-import.test.ts",
  mehrpunkt: "tests/capture/file-multi-point.test.ts",
} as const;

/** Woran ein Beleg erkennbar die ECHTE Fläche bedient: gemounteter Arbeitsraum oder Chromium. */
const FLAECHE = ["pages/Capture", "h3-blatt-buehne", 'from "./huelle"', 'from "./seite"'];

const NUR_LOGIK = "Nur die Auswahllogik ist einheitengetestet; kein Flächenfall erreicht den Satz.";

const ZUORDNUNG: Readonly<Partial<Record<Schluessel, Zuordnung>>> = {
  loaded: {
    stand: "ersetzt",
    beleg: [],
    rest: "Im Datei-Arbeitsraum durch loadedStats/loadedStatsWhole ersetzt (JOB 3196); der Schlüssel lebt im BodyExtractPanel weiter, dieser Weg ist hier nicht geprüft.",
  },
  emptyPdf: {
    stand: "unbewiesen",
    beleg: [B.docxStruktur],
    rest: "Braucht eine PDF ohne Textebene im Arbeitsraum; d3-buehne kennt den Satz nur als Abbruchgrund.",
  },
  emptyPptx: {
    stand: "unbewiesen",
    beleg: [B.pptxEhrlich],
    rest: "Braucht eine textlose PPTX ohne Bilder im Arbeitsraum. Wortlaut einheitengetestet.",
  },
  pdfTruncated: {
    stand: "unbewiesen",
    beleg: [],
    rest: "Braucht eine PDF über dem Seitenlimit; kein Test nennt den Schlüssel.",
  },
  pptxTruncated: {
    stand: "unbewiesen",
    beleg: [],
    rest: "Braucht eine PPTX über dem Folienlimit; kein Test nennt den Schlüssel.",
  },
  pptxTooLarge: {
    stand: "unbewiesen",
    beleg: [B.pptxEhrlich],
    rest: "Braucht eine PPTX über dem Archivbudget im Arbeitsraum. Wortlaut einheitengetestet.",
  },
  pptxImagesFormat: { stand: "unbewiesen", beleg: [B.pptxEhrlich, B.bildbudget], rest: NUR_LOGIK },
  pptxImagesBudget: { stand: "unbewiesen", beleg: [B.pptxEhrlich, B.bildbudget], rest: NUR_LOGIK },
  // R-1349 (Aufnahme gesamt-aufruferwaechter): hier stand zusätzlich `B.folienbilder`
  // (`tests/capture/slide-images.test.ts`). Es nannte beide Schlüssel nur über die alte
  // Meldungswahl `imagesOnlyNoticeKey`, die keinen Produktaufrufer hatte und entfernt ist. Die
  // Auswahl des Arbeitsraums belegen die beiden übrigen Dateien unverändert.
  imagesOnlyNoText: {
    stand: "unbewiesen",
    beleg: [B.ship4, B.bildbudget],
    rest: NUR_LOGIK,
  },
  imagesAllDropped: {
    stand: "unbewiesen",
    beleg: [B.ship4, B.bildbudget],
    rest: NUR_LOGIK,
  },
  imagesAllDroppedNoOriginal: {
    stand: "unbewiesen",
    beleg: [B.bildbudget, B.pptxEhrlich],
    rest: NUR_LOGIK,
  },
  imagesDefect: { stand: "unbewiesen", beleg: [B.bildbudget], rest: NUR_LOGIK },
  imagesOutsidePath: { stand: "unbewiesen", beleg: [B.bildbudget], rest: NUR_LOGIK },
  imagesBudgetBodyHtml: { stand: "unbewiesen", beleg: [B.bildbudget], rest: NUR_LOGIK },
  imagesBudgetSingleImage: { stand: "unbewiesen", beleg: [B.bildbudget], rest: NUR_LOGIK },
  imagesBudgetTotalImages: { stand: "unbewiesen", beleg: [B.bildbudget], rest: NUR_LOGIK },
  imageCaptionPlaceholder: {
    stand: "erreichbar",
    beleg: [B.docxBilanz],
    rest: "Kein Flächensatz, sondern Inhalt: der Platzhalter reist im gemounteten DOCX-Weg in den Parser (A1).",
  },
  captionsBalance: {
    stand: "erreichbar",
    beleg: [B.docxBilanz],
    rest: "Echte DOCX im gemounteten Arbeitsraum, DE/EN und Sprachwechsel (A1–A3).",
  },
  captionsBalanceAssigned: {
    stand: "erreichbar",
    beleg: [B.docxBilanz],
    rest: "Zweiter Lauf mit nur eindeutigen Beschriftungen (A5).",
  },
  captionsBalanceAmbiguous: {
    stand: "unbewiesen",
    beleg: [B.docxBilanz],
    rest: "Dort nur als Gegenprobe (steht NICHT da); kein Dokument mit ausschließlich unklaren Beschriftungen.",
  },
  imagesKept: { stand: "unbewiesen", beleg: [B.bildbudget, B.bildnotiz], rest: NUR_LOGIK },
  imagesKeptDropped: { stand: "unbewiesen", beleg: [B.bildbudget, B.bildnotiz], rest: NUR_LOGIK },
  imagesNoOriginal: { stand: "unbewiesen", beleg: [B.bildbudget, B.bildnotiz], rest: NUR_LOGIK },
  imagesLost: { stand: "unbewiesen", beleg: [B.bildbudget, B.bildnotiz], rest: NUR_LOGIK },
  importNoteDocx: {
    stand: "erreichbar",
    beleg: [B.docxBilanz],
    rest: "Echte DOCX im gemounteten Arbeitsraum (A4); kein Chromium-Fall für DOCX in diesem Abgleich.",
  },
  importNotePdf: {
    stand: "erreichbar",
    beleg: [B.pdfKette],
    rest: "Referenz-PDF über den sichtbaren Auswahlknopf in Chromium (JOB 4203 T3).",
  },
  importNotePptx: {
    stand: "erreichbar",
    beleg: [B.pptxKette, B.pptxDreiSprachen],
    rest: "Referenz-PPTX in Chromium, dazu DE/EN/NL bis zum Wissenseintrag (JOB 4203 T4, JOB 4228/4269).",
  },
  ocrCta: {
    stand: "unbewiesen",
    beleg: [],
    rest: "Braucht eine Bilddatei als OCR-Kandidat im Arbeitsraum; kein Flächenfall.",
  },
  ocrBusy: {
    stand: "unbewiesen",
    beleg: [],
    rest: "Braucht einen bewusst gestarteten OCR-Lauf; kein Flächenfall.",
  },
  searching: {
    stand: "unbewiesen",
    beleg: [],
    rest: "Braucht eine laufende KI-Analyse im Punkte-Weg; kein Flächenfall nennt den Satz.",
  },
  pointCount: {
    stand: "erreichbar",
    beleg: [B.abwahl],
    rest: "KI-Punkte über eine Attrappe im gemounteten Arbeitsraum; echte KI nicht beteiligt.",
  },
  queueBadge: {
    stand: "erreichbar",
    beleg: [B.warteschlange],
    rest: "Übernommene Punkte in der Warteschlange, gemounteter Arbeitsraum mit Attrappe.",
  },
  queueDone: {
    stand: "unbewiesen",
    beleg: [],
    rest: "Braucht eine bis zum Ende abgearbeitete Warteschlange; kein Test nennt den Schlüssel.",
  },
  sourceNote: {
    stand: "unbewiesen",
    beleg: [],
    rest: "Braucht einen in den Assistenten geladenen Warteschlangenpunkt; kein Flächenfall.",
  },
  draftsSaved: {
    stand: "erreichbar",
    beleg: [B.abwahl, B.teilfehler],
    rest: "Mehrpunkt-Speicherung über die Navigationswache, gemounteter Arbeitsraum mit Attrappe.",
  },
  draftsPartial: {
    stand: "erreichbar",
    beleg: [B.teilfehler, B.gesamtfehler],
    rest: "Teil- und Vollausfall der Mehrpunkt-Speicherung, gemountet mit Attrappe.",
  },
  mergedNote: {
    stand: "unbewiesen",
    beleg: [B.mehrpunkt],
    rest: "Kein Produktaufrufer unter apps/web/src (nur Definition und Wörterbücher) — nicht erreichbar, Kandidat für Bereinigung, kein Reparaturfall.",
  },
  mergedInList: {
    stand: "unbewiesen",
    beleg: [],
    rest: "Braucht mindestens zwei verbundene KI-Punkte; kein Test nennt den Schlüssel.",
  },
  purgeUnselectedQ: {
    stand: "unbewiesen",
    beleg: [],
    rest: "Braucht eine Mehrpunkt-Speicherung mit abgewählten Punkten; kein Test nennt den Schlüssel.",
  },
};

function lies(rel: string): string {
  return readFileSync(join(WURZEL, rel), "utf8");
}

function maskiert(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Nennt die Quelle den Schlüssel — als `CAPTURE_FILE_TEXT.x` oder als Übersetzungsschlüssel? */
function nenntSchluessel(quelle: string, key: Schluessel): boolean {
  const muster = `(CAPTURE_FILE_TEXT\\.${key}|["'\`]${maskiert(T[key])}["'\`])(?!\\w)`;
  return new RegExp(muster).test(quelle);
}

function dateienUnter(ordner: string): string[] {
  return readdirSync(ordner).flatMap((name) => {
    const pfad = join(ordner, name);
    return statSync(pfad).isDirectory() ? dateienUnter(pfad) : [pfad];
  });
}

const eintraege = Object.entries(ZUORDNUNG) as [Schluessel, Zuordnung][];

describe("K3 · die 39 Meldungen: erreichbar, ersetzt oder weiterhin unbewiesen", () => {
  it("die Tabelle ist genau das NICHT_ERREICHBAR-Inventar von JOB 3379", () => {
    const muster = /\[\s*"(\w+)",\s*"NICHT_ERREICHBAR"/g;
    const inventar = [...lies(INVENTAR).matchAll(muster)].map((m) => m[1]);
    expect(inventar).toHaveLength(39);
    expect(eintraege.map(([key]) => key).sort()).toEqual([...inventar].sort());
    for (const [key] of eintraege) {
      expect(Object.keys(T), `${key} ist kein Produktschlüssel`).toContain(key);
    }
  });

  it("der Stand ist ausgezählt: 10 erreichbar, 1 ersetzt, 28 unbewiesen", () => {
    const zahl = (stand: Stand): number => eintraege.filter(([, z]) => z.stand === stand).length;
    expect([zahl("erreichbar"), zahl("ersetzt"), zahl("unbewiesen")]).toEqual([10, 1, 28]);
    for (const [key, z] of eintraege) {
      expect(z.rest.trim().length, `${key}: Rest fehlt`).toBeGreaterThan(20);
    }
  });

  it("jeder genannte Beleg existiert und nennt den Schlüssel", () => {
    for (const [key, z] of eintraege) {
      for (const datei of z.beleg) {
        expect(existsSync(join(WURZEL, datei)), `${key}: ${datei} fehlt`).toBe(true);
        expect(nenntSchluessel(lies(datei), key), `${key}: ${datei} nennt ihn nicht`).toBe(true);
      }
    }
  });

  it("„erreichbar“ heißt: mindestens ein Beleg bedient die echte Fläche", () => {
    for (const [key, z] of eintraege.filter(([, e]) => e.stand === "erreichbar")) {
      expect(z.beleg.length, `${key}: ohne Beleg`).toBeGreaterThan(0);
      const flaechig = z.beleg.some((datei) => FLAECHE.some((m) => lies(datei).includes(m)));
      expect(flaechig, `${key}: kein Beleg bedient den Arbeitsraum`).toBe(true);
    }
  });

  it("„ersetzt“ · loaded: der Arbeitsraum zeigt loadedStats, nicht loaded", () => {
    const arbeitsraum = lies("apps/web/src/pages/Capture.tsx");
    expect(nenntSchluessel(arbeitsraum, "loaded")).toBe(false);
    expect(nenntSchluessel(arbeitsraum, "loadedStats")).toBe(true);
    expect(nenntSchluessel(arbeitsraum, "loadedStatsWhole")).toBe(true);
    const panel = lies("apps/web/src/components/BodyExtractPanel.tsx");
    expect(nenntSchluessel(panel, "loaded")).toBe(true);
  });

  it("mergedNote hat keinen Produktaufrufer — außer Definition und Wörterbüchern", () => {
    const woerterbuch = join("src", "woerterbuch");
    const definition = join("lib", "captureFromFile.ts");
    const alle = dateienUnter(join(WURZEL, "apps/web/src")).filter((p) => /\.tsx?$/.test(p));
    expect(alle.length).toBeGreaterThan(100);
    const aufrufer: string[] = [];
    for (const pfad of alle) {
      if (pfad.includes(woerterbuch) || pfad.endsWith(definition)) {
        continue;
      }
      if (readFileSync(pfad, "utf8").includes("mergedNote")) {
        aufrufer.push(pfad);
      }
    }
    expect(aufrufer).toEqual([]);
  });
});
