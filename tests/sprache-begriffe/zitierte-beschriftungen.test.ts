// ================================================================================================
// R-1176 · WAS EIN TEXT ALS BESCHRIFTUNG ZITIERT, STEHT SO AUF DER OBERFLÄCHE — IN DE, EN UND NL.
// ================================================================================================
//
// Auftrag gesamt-sprache-begriffe, K16. Bens Befund (Nacharbeit 4): der bisherige Beleg E-1 in
// `tests/sprache-begriffe/fachbegriffe-k1.test.ts` prüfte genau EINEN Hinweis. Dieser Wächter
// prüft den ganzen Katalog zur Laufzeit (Grundbestand + Textmodule, wie i18next ihn ausliefert):
//
//   1. Jedes deutsche Zitat „…" (höchstens 60 Zeichen) eines Textes, das WORTGLEICH der deutsche
//      Wert eines ANDEREN Schlüssels ist (höchstens 60 Zeichen, ohne Platzhalter), gilt als
//      zitierte Beschriftung.
//   2. Die englische und die niederländische Fassung desselben Textes müssen die englische bzw.
//      niederländische Fassung mindestens EINES solchen Schlüssels zeichengleich enthalten.
//
// Was der Katalogteil NICHT kann, ehrlich: Er erkennt ein Zitat nur, wenn der deutsche Wortlaut mit
// einer Beschriftung übereinstimmt. Ein Zitat, das schon im Deutschen vom Knopf abweicht, fällt dort
// durch — so war es bei `capture.file.connectHint` („Übernehmen" statt „Ausgewählte übernehmen",
// Nacharbeit 6 berichtigt, Z-7 hält den Zusammenhang je Sprache fest). Ein zufällig gleich
// lautendes Wort, das gar keinen Knopf meint, wird als Zitat gelesen — die Liste BEKANNT trennt
// beides und nennt den Grund je Eintrag.
//
// TEIL D liest deshalb zusätzlich die Anleitung und die Prüfkarten im Repository (Liste ANLEITUNGEN)
// von der anderen Seite her: JEDES Zitat dort ist entweder eine echte Beschriftung (deutscher
// Katalogwert, mit EN- und NL-Fassung) oder steht einzeln begründet in KEIN_KNOPF (Beispieldaten,
// Suchbegriff, Zustandsname, früherer Name, Satzteil aus einem Anzeigetext). Ein neues Zitat, das
// zu keinem Knopf passt, macht den Wächter rot. Die Dokumente sind deutsch; ihre Beschriftungen
// gibt es in EN und NL über denselben Schlüssel. Fett gesetzte Knopfnamen ohne Anführungszeichen
// liest Teil D nicht (abgeglichen von Hand, Nacharbeit 6). Die zugeordnete Aufgabenkarte aus
// DEMO-UX-V1 (`03_AUFTRAEGE/review/BERICHT-BEN-DEMO-UX-V1-A4-U3-READINESS-NACHPRUEFUNG-228.md`)
// liegt außerhalb des Repositorys und wird hier nicht gelesen.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import { CAPTURE_FILE_TEXT } from "../../apps/web/src/lib/captureFromFile";
import { reviewHelp } from "../../apps/web/src/lib/reviewHelp";

type Katalog = Record<string, unknown>;

const ZITAT = /[„“"‚‘«»]([^„“"”‚‘’«»]+)[“”"‘’«»]/g;
const HOECHSTLAENGE = 60;

/** Deutscher Wortlaut → alle Schlüssel, die genau so beschriftet sind. */
function beschriftungsIndex(de: Katalog): Map<string, string[]> {
  const index = new Map<string, string[]>();
  for (const [key, wert] of Object.entries(de)) {
    if (typeof wert !== "string" || wert.length === 0 || wert.length > HOECHSTLAENGE) {
      continue;
    }
    if (wert.includes("{{")) {
      continue;
    }
    index.set(wert, [...(index.get(wert) ?? []), key]);
  }
  return index;
}

function enthaelt(text: string, beschriftung: unknown): boolean {
  return typeof beschriftung === "string" && beschriftung !== "" && text.includes(beschriftung);
}

/** Jede Abweichung als „Schlüssel · Sprache · deutsches Zitat", sortiert und ohne Doppel. */
function zitatAbweichungen(
  de: Katalog,
  fremd: Record<string, Katalog>,
  ausgenommen: ReadonlySet<string> = new Set(),
): string[] {
  const index = beschriftungsIndex(de);
  const funde = new Set<string>();
  for (const [key, wert] of Object.entries(de)) {
    if (typeof wert !== "string" || ausgenommen.has(key)) {
      continue;
    }
    for (const treffer of wert.matchAll(ZITAT)) {
      const zitat = treffer[1] ?? "";
      const knoepfe = (index.get(zitat) ?? []).filter((k) => k !== key);
      if (zitat.length > HOECHSTLAENGE || knoepfe.length === 0) {
        continue;
      }
      for (const [lng, katalog] of Object.entries(fremd)) {
        const text = katalog[key];
        if (typeof text !== "string") {
          continue;
        }
        if (!knoepfe.some((k) => enthaelt(text, katalog[k]))) {
          funde.add(`${key} · ${lng} · ${zitat}`);
        }
      }
    }
  }
  return [...funde].sort();
}

const katalog = (lng: string): Katalog => i18n.getResourceBundle(lng, "translation") as Katalog;

// Abgelöst in dieser Runde: der Grundbestand steht unter Prüfsumme
// (`tests/i18n-textmodule/bestand-unveraendert.test.ts`), die berichtigte Fassung liegt in
// `apps/web/src/texte/knopfzitat.ts`; der alte Schlüssel wird nicht mehr gelesen.
const ABGELOEST: ReadonlyArray<{ alt: string; neu: string; datei: string; knopf: string }> = [
  {
    alt: "pilot.check.maintain",
    neu: "knopfzitat.pilot.pflegen",
    datei: "lib/pilotChecklist.ts",
    knopf: "cycle.maintain.label",
  },
  {
    alt: "pilot.obs.outdated.map",
    neu: "knopfzitat.pilot.veraltet",
    datei: "lib/pilotObservationGuide.ts",
    knopf: "cycle.maintain.label",
  },
  {
    alt: "stage2.gate.body",
    neu: "knopfzitat.stufe2.hinweis",
    datei: "components/Stage2Notice.tsx",
    knopf: "start.menu.stufe2",
  },
  {
    alt: "seitenhilfe.admin.audit.text",
    neu: "knopfzitat.admin.audit",
    datei: "pages/AdminDatenDetails.tsx",
    knopf: "adm.sec.sicherheit",
  },
  {
    alt: "seitenhilfe.admin.bereitschaft.text",
    neu: "knopfzitat.admin.bereitschaft",
    datei: "pages/AdminSicherheitDetails.tsx",
    knopf: "einst.wert.nichtAbrufbar",
  },
  {
    alt: "wb.grenze.widerspricht",
    neu: "knopfzitat.wb.widerspricht",
    datei: "components/WissensbeziehungenBereich.tsx",
    knopf: "wb.art.widerspricht",
  },
  {
    alt: "wb.grenze.ersetzt",
    neu: "knopfzitat.wb.ersetzt",
    datei: "components/WissensbeziehungenBereich.tsx",
    knopf: "wb.art.ersetzt",
  },
  {
    alt: "vhelp.reject.body",
    neu: "knopfzitat.vhelp.reject",
    datei: "lib/reviewHelp.ts",
    knopf: "ko.reportConflict",
  },
  {
    alt: "vhelp.assign.body",
    neu: "knopfzitat.vhelp.assign",
    datei: "lib/reviewHelp.ts",
    knopf: "val.filterMine",
  },
  {
    alt: "vhelp.contribution.body",
    neu: "knopfzitat.vhelp.contribution",
    datei: "lib/reviewHelp.ts",
    knopf: "vhelp.sourceAdd.title",
  },
  {
    alt: "capture.file.connectHint",
    neu: "knopfzitat.datei.wege",
    datei: "lib/captureFromFile.ts",
    knopf: "capture.file.applyCta",
  },
];

// Was nach dieser Runde bleibt — je Eintrag an Schlüssel, Sprache und deutsches Zitat gebunden.
// Ein neuer Fund, der hier nicht steht, macht den Wächter rot.
const BEKANNT: Record<string, string> = {
  // ---- ECHTE ABWEICHUNGEN, hier nicht berichtigt -------------------------------------------
  "help.lifecycle.body · en · Anlage geändert …":
    "OFFEN, Produktentscheidung: der Knopf heißt englisch „Asset changed …“ (lcy.assetToggle); die englische Hilfe vermeidet „asset“ bewusst als Fachwort (Altkapitel-Wächter). Welches Wort gilt, ist nicht entschieden.",
  "help.capture.body · en · Prüfen & einreichen":
    "OFFEN, gesperrt: englisch „the final check“ statt „Review & submit“. Der Grundwert steht unter Prüfsumme, und der Kapitelschlüssel ist auf help.<id>.body festgelegt (seitenhilfe-navkapitel, Altkapitel-Wächter) — umhängen bräche beide.",
  // ---- ZUFALLSTREFFER: das zitierte Wort ist kein Knopf dieses Namens ----------------------
  "topbar.plain.reasoner · en · Ungeprüft":
    "Zufallstreffer: gemeint ist der Zustand „KI-Modell ungeprüft“ (topbar.reasonerUnverified), nicht die Wissensklasse ask.knowledgeClass.ungeprueft. Deutsch zitiert verkürzt.",
  "topbar.plain.reasoner · nl · Ungeprüft":
    "Zufallstreffer: wie EN — gemeint ist topbar.reasonerUnverified, nicht die Wissensklasse.",
  "vhelp.sourcesLevel2.body · en · Stufe 2":
    "Zufallstreffer: gemeint ist das Quellen-Badge der Stufe-2-Quelle, nicht der Menüpunkt start.menu.stufe2 („Stage 2“).",
  "vhelp.sourcesLevel2.body · nl · Stufe 2":
    "Zufallstreffer: wie EN — Quellen-Badge, nicht der Menüpunkt („Stap 2“).",
  "vhelp.sourceSearch.body · en · Anhängen":
    "Zufallstreffer: gemeint ist der Knopf der Quellensuche, nicht capture.ai.append („Append“) der KI-Werkbank.",
  "vhelp.sourceSearch.body · nl · Anhängen":
    "Zufallstreffer: wie EN — nicht capture.ai.append („Toevoegen“).",
  "chelp.submitReview.body · en · in Prüfung":
    "Zufallstreffer: gemeint ist der Status nach dem Einreichen, nicht die Legende des Wissensnetzes (wissensnetz.farbe.offen „under review“).",
  "einstieg.knopf.einreichen · en · in Prüfung":
    "Zufallstreffer: wie chelp.submitReview — Status nach dem Einreichen, nicht die Wissensnetz-Legende.",
  "einstieg.knopf.einreichen · nl · in Prüfung":
    "Zufallstreffer: wie EN — nicht die Wissensnetz-Legende („in beoordeling“).",
};

function istText(wert: unknown): boolean {
  return typeof wert === "string" && wert.trim() !== "";
}

function alsMuster(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ---- TEIL D · Anleitung und Prüfkarten im Repository --------------------------------------------
const WURZEL = process.cwd();
const ANLEITUNGEN = [
  "docs/onboarding/user-quickstart.md",
  "docs/demo/stage-1-demo-path.md",
  "docs/Berater/FE-001_PRUEFPAKET_ARBEITSANLEITUNGEN_2026-09-26.md",
] as const;
const DOKU_ZITAT = /[„"“]([^„"“”\n]{2,60})[“”"]/g;
const PLATZHALTER_IM_DOKUMENT = "(?:\\d+|\\p{Lu}|…)";

/** Alle deutschen Schlüssel, deren Wert genau dieses Zitat ist (Satzpunkt am Ende und
 *  Platzhalter wie „Stand {{nummer}}" ↔ „Stand N" eingeschlossen). */
function beschriftungenFuer(zitat: string, de: Katalog): string[] {
  return Object.entries(de).flatMap(([key, wert]) => {
    if (typeof wert !== "string" || wert === "") {
      return [];
    }
    if (wert === zitat || wert.replace(/\.$/, "") === zitat) {
      return [key];
    }
    if (!wert.includes("{{")) {
      return [];
    }
    const teile = wert.split(/\{\{[^}]*\}\}/);
    if ((teile.join("").match(/\p{L}/gu) ?? []).length < 3) {
      return [];
    }
    // Ein Platzhalter steht im Dokument für eine Zahl („Fassung 1"), einen Großbuchstaben („Stand
    // N") oder „…" — nie für ein Wort: sonst wäre „{{n}} ausgewählt" auch „Übernehmen ausgewählt".
    const muster = `^${teile.map(alsMuster).join(PLATZHALTER_IM_DOKUMENT)}$`;
    return new RegExp(muster, "u").test(zitat) ? [key] : [];
  });
}

function dokuZitate(text: string): Array<{ zeile: number; zitat: string }> {
  const funde: Array<{ zeile: number; zitat: string }> = [];
  for (const [i, inhalt] of text.split("\n").entries()) {
    for (const treffer of inhalt.matchAll(DOKU_ZITAT)) {
      funde.push({ zeile: i + 1, zitat: treffer[1] ?? "" });
    }
  }
  return funde;
}

/** Zitate, die weder eine Beschriftung sind noch einzeln begründet in `kein` stehen. */
function unbekannteZitate(
  datei: string,
  text: string,
  de: Katalog,
  kein: Record<string, string>,
): string[] {
  return dokuZitate(text)
    .filter(({ zitat }) => beschriftungenFuer(zitat, de).length === 0)
    .filter(({ zitat }) => !(`${datei} · ${zitat}` in kein))
    .map(({ zeile, zitat }) => `${datei}:${zeile} · ${zitat}`);
}

// Zitate in Anleitung und Prüfkarten, die bewusst KEINE Beschriftung sind — einzeln begründet.
const QS = "docs/onboarding/user-quickstart.md";
const DP = "docs/demo/stage-1-demo-path.md";
const FE = "docs/Berater/FE-001_PRUEFPAKET_ARBEITSANLEITUNGEN_2026-09-26.md";
const KEIN_KNOPF: Record<string, string> = {
  [`${QS} · nicht eingerichtet`]:
    "Zustandsname der Supportkarte; die Karte zeigt dazu einen ganzen Satz (help.support.notConfigured), keinen Knopf.",
  [`${QS} · IT-Servicedesk`]:
    "Beispielwert für KLARWERK_SUPPORT_LABEL, vom Betreiber frei gesetzt.",
  [`${DP} · Ventil X bei Überdruck manuell schließen.`]:
    "Titel eines Demo-Wissensobjekts (Beispieldaten aus seed-demo.ts), keine Beschriftung.",
  [`${DP} · Filter F3 monatlich auf Verschmutzung prüfen.`]:
    "Titel eines Demo-Wissensobjekts (Beispieldaten aus seed-demo.ts), keine Beschriftung.",
  [`${DP} · Ventil X`]: "Kurzname des Demo-Wissensobjekts (Beispieldaten), keine Beschriftung.",
  [`${DP} · Anlagenhandbuch Abschnitt 4.2`]: "Quellenangabe der Demo-Daten, keine Beschriftung.",
  [`${DP} · skizze.png`]: "Dateiname des Demo-Anhangs, keine Beschriftung.",
  [`${DP} · dünner`]: "Umgangssprachliche Wertung im Sprecherhinweis, kein Bedienelement.",
  [`${DP} · KI-stärkere`]: "Umgangssprachliche Wertung im Sprecherhinweis, kein Bedienelement.",
  [`${FE} · Arbeitsplatz im Homeoffice einrichten`]:
    "Titel eines Beispieleintrags, den das Belegskript anlegt (Testdaten).",
  [`${FE} · Sicher anmelden mit Zwei-Faktor`]:
    "Titel eines Beispieleintrags, den das Belegskript anlegt (Testdaten).",
  [`${FE} · Hilfe bei IT-Problemen holen`]:
    "Titel eines Beispieleintrags, den das Belegskript anlegt (Testdaten).",
  [`${FE} · Start im Homeoffice`]: "Titel der Arbeitsanleitung, den der Tester selbst eingibt.",
  [`${FE} · Homeoffice`]: "Suchbegriff, den der Tester eintippt, keine Beschriftung.",
  [`${FE} · anmelden`]: "Suchbegriff, den der Tester eintippt, keine Beschriftung.",
  [`${FE} · IT-Problemen`]: "Suchbegriff, den der Tester eintippt, keine Beschriftung.",
  [`${FE} · erneutes Öffnen mit erhaltenem Cache`]:
    "Beschreibung eines Prüffalls, kein Bedienelement.",
  [`${FE} · Entschieden`]:
    "Früherer Name des Standes, im Text ausdrücklich als „bisher“ genannt; heute „Freigegeben“ (ga.stand.entschieden).",
  [`${FE} · noch nicht freigegeben`]:
    "Satzteil aus dem angezeigten Bedeutungstext des Standes „Vorgelegt“ (Textmodul fe001).",
  [`${FE} · Inhaltsnachweis`]:
    "Wort aus der Feldbeschriftung „Für Fachleute: Inhaltsnachweis angeben (optional)“ (fe001.auswahl.fachleute).",
};
/** Satzteile, die wörtlich in einem angezeigten Text stehen müssen. */
const SATZTEIL = [`${FE} · noch nicht freigegeben`, `${FE} · Inhaltsnachweis`];

const SRC = join(process.cwd(), "apps/web/src");

function quelldateien(ordner: string): string[] {
  return readdirSync(ordner).flatMap((name) => {
    const pfad = join(ordner, name);
    if (statSync(pfad).isDirectory()) {
      return name === "woerterbuch" ? [] : quelldateien(pfad);
    }
    return /\.(ts|tsx)$/.test(name) ? [pfad] : [];
  });
}

describe("R-1176 · zitierte Beschriftungen stimmen in allen drei Sprachen", () => {
  const ausgenommen = new Set(ABGELOEST.map((a) => a.alt));
  const funde = zitatAbweichungen(
    katalog("de"),
    { en: katalog("en"), nl: katalog("nl") },
    ausgenommen,
  );

  it("Z-1 kein Text zitiert eine Beschriftung anders, als sie dasteht — außer den benannten Resten", () => {
    expect(funde.filter((f) => !(f in BEKANNT))).toEqual([]);
  });

  it("Z-2 jeder benannte Rest ist an ein echtes deutsches Zitat gebunden und begründet", () => {
    const index = beschriftungsIndex(katalog("de"));
    for (const [eintrag, grund] of Object.entries(BEKANNT)) {
      const [key = "", lng = "", zitat = ""] = eintrag.split(" · ");
      expect(["en", "nl"], eintrag).toContain(lng);
      expect(String(katalog("de")[key] ?? ""), eintrag).toContain(zitat);
      expect(index.has(zitat), eintrag).toBe(true);
      expect(grund.length, eintrag).toBeGreaterThan(40);
    }
  });

  it("Z-3 die berichtigten Texte zitieren den Knopf in DE, EN und NL zeichengleich", () => {
    for (const { neu, knopf } of ABGELOEST) {
      for (const lng of ["de", "en", "nl"]) {
        const t = i18n.getFixedT(lng);
        expect(t(neu), `${neu} (${lng})`).not.toBe(neu);
        expect(t(neu), `${neu} (${lng}) zitiert ${knopf}`).toContain(t(knopf));
      }
      expect(funde.filter((f) => f.startsWith(`${neu} · `))).toEqual([]);
    }
  });

  it("Z-4 der alte Schlüssel wird nicht mehr gelesen, der neue an genau der Verbraucherstelle", () => {
    const dateien = quelldateien(SRC).map((pfad) => ({ pfad, inhalt: readFileSync(pfad, "utf8") }));
    for (const { alt, neu, datei } of ABGELOEST) {
      for (const { pfad, inhalt } of dateien) {
        expect(inhalt.includes(`"${alt}"`), `${pfad} liest noch ${alt}`).toBe(false);
      }
      expect(readFileSync(join(SRC, datei), "utf8")).toContain(`"${neu}"`);
    }
    expect(reviewHelp("reject").bodyKey).toBe("knopfzitat.vhelp.reject");
    expect(reviewHelp("assign").bodyKey).toBe("knopfzitat.vhelp.assign");
    expect(reviewHelp("contribution").bodyKey).toBe("knopfzitat.vhelp.contribution");
    expect(reviewHelp("approve").bodyKey).toBe("vhelp.approve.body");
  });

  it("Z-5 deutsch bleibt zeichengleich — außer „im Haus“ (R-0975) und dem schon deutsch falschen Dateihinweis", () => {
    const de = i18n.getFixedT("de");
    for (const { alt, neu } of ABGELOEST) {
      if (alt === "stage2.gate.body") {
        expect(de(alt)).toContain("im Haus „Stufe 2“ genannt");
        expect(de(neu)).toBe(de(alt).replace("im Haus „Stufe 2“", "intern „Stufe 2“"));
        continue;
      }
      if (alt === "capture.file.connectHint") {
        // Nacharbeit 6 (Ben): der alte deutsche Hinweis zitierte Knöpfe, die es so nicht gibt.
        expect(de(alt)).toContain("„Übernehmen“");
        expect(de(alt)).toContain("„Verbinden“");
        expect(de(neu)).not.toContain("„Übernehmen“");
        expect(de(neu)).not.toContain("„Verbinden“");
        continue;
      }
      expect(de(neu), neu).toBe(de(alt));
    }
  });

  it("Z-7 der Dateihinweis nennt die drei Knöpfe darunter zeichengleich — in DE, EN und NL", () => {
    // Knopf und Hinweis gehören über CAPTURE_FILE_TEXT zusammen (`pages/Capture.tsx`: Hinweis,
    // darunter mergeCta, saveDraftsCta, applyCta).
    expect(CAPTURE_FILE_TEXT.connectHint).toBe("knopfzitat.datei.wege");
    for (const lng of ["de", "en", "nl"]) {
      const t = i18n.getFixedT(lng);
      const hinweis = t(CAPTURE_FILE_TEXT.connectHint);
      for (const knopf of [
        CAPTURE_FILE_TEXT.mergeCta,
        CAPTURE_FILE_TEXT.saveDraftsCta,
        CAPTURE_FILE_TEXT.applyCta,
      ]) {
        expect(t(knopf), `${knopf} (${lng})`).not.toBe(knopf);
        expect(hinweis, `${lng}: Hinweis zitiert ${knopf}`).toMatch(
          new RegExp(`[„“"]${alsMuster(t(knopf))}[“”"]`),
        );
      }
    }
    // Die alten, falschen Kurzzitate kommen in keiner Sprache zurück.
    expect(i18n.getFixedT("en")(CAPTURE_FILE_TEXT.connectHint)).not.toContain("“Take over”");
    expect(i18n.getFixedT("nl")(CAPTURE_FILE_TEXT.connectHint)).not.toContain("„Overnemen“");
  });

  it("Z-6 Rotprobe: ein klein geschriebenes englisches Zitat wird gefunden, das richtige nicht", () => {
    const de = {
      "probe.knopf": "Konflikt melden",
      "probe.hilfe": "Dann ist „Konflikt melden“ der bessere Weg.",
      "probe.frei": "Ein „Beispiel“ ohne Knopf und ein „{{name}}“ mit Platzhalter.",
      "probe.platzhalter": "{{name}}",
    };
    const nl = {
      "probe.knopf": "Conflict melden",
      "probe.hilfe": "Dan is „Conflict melden“ beter.",
    };
    const falsch = {
      "probe.knopf": "Report conflict",
      "probe.hilfe": "Then „report conflict“ is better.",
    };
    const richtig = {
      "probe.knopf": "Report conflict",
      "probe.hilfe": "Then “Report conflict” is better.",
    };
    const erwartet = ["probe.hilfe · en · Konflikt melden"];
    expect(zitatAbweichungen(de, { en: falsch, nl })).toEqual(erwartet);
    expect(zitatAbweichungen(de, { en: richtig, nl })).toEqual([]);
    // Ein ausgenommener (abgelöster) Text wird nicht mehr gelesen.
    expect(zitatAbweichungen(de, { en: falsch, nl }, new Set(["probe.hilfe"]))).toEqual([]);
  });
});

describe("R-1176 · Teil D — Anleitung und Prüfkarten zitieren nur echte Beschriftungen", () => {
  const de = katalog("de");
  const texte = ANLEITUNGEN.map((datei) => ({
    datei,
    text: readFileSync(join(WURZEL, datei), "utf8"),
  }));

  it("D-1 jedes Zitat ist eine Beschriftung des Produkts oder einzeln als Nicht-Knopf begründet", () => {
    for (const { datei, text } of texte) {
      expect(dokuZitate(text).length, `${datei}: kein Zitat gelesen`).toBeGreaterThan(0);
    }
    const unbekannt = texte.flatMap(({ datei, text }) =>
      unbekannteZitate(datei, text, de, KEIN_KNOPF),
    );
    expect(unbekannt).toEqual([]);
  });

  it("D-2 jede zitierte Beschriftung gibt es auch auf Englisch und Niederländisch", () => {
    const en = katalog("en");
    const nl = katalog("nl");
    for (const { datei, text } of texte) {
      for (const { zeile, zitat } of dokuZitate(text)) {
        const schluessel = beschriftungenFuer(zitat, de);
        if (schluessel.length === 0) {
          continue;
        }
        const dreisprachig = schluessel.some((k) => istText(en[k]) && istText(nl[k]));
        expect(dreisprachig, `${datei}:${zeile} „${zitat}“ (${schluessel.join(", ")})`).toBe(true);
      }
    }
  });

  it("D-3 jeder Nicht-Knopf steht noch im Dokument, ist wirklich keine Beschriftung und begründet", () => {
    const anzeigetexte = Object.values(de).filter((v): v is string => typeof v === "string");
    for (const [eintrag, grund] of Object.entries(KEIN_KNOPF)) {
      const [datei = "", zitat = ""] = eintrag.split(" · ");
      const text = texte.find((t) => t.datei === datei)?.text ?? "";
      expect(
        dokuZitate(text).map((z) => z.zitat),
        eintrag,
      ).toContain(zitat);
      expect(beschriftungenFuer(zitat, de), eintrag).toEqual([]);
      expect(grund.length, eintrag).toBeGreaterThan(20);
    }
    for (const eintrag of SATZTEIL) {
      const zitat = eintrag.split(" · ")[1] ?? "";
      expect(
        anzeigetexte.some((v) => v.includes(zitat)),
        eintrag,
      ).toBe(true);
    }
  });

  it("D-4 die in Nacharbeit 6 berichtigten Zitate kommen nicht zurück", () => {
    const qs = texte.find((t) => t.datei === QS)?.text ?? "";
    const dp = texte.find((t) => t.datei === DP)?.text ?? "";
    // Der Beispielchip heißt „findet passendes Wissen" (ask.expect.answer), nicht „validiertes".
    expect(i18n.getFixedT("de")("ask.expect.answer")).toBe("findet passendes Wissen");
    for (const text of [qs, dp]) {
      expect(text).not.toContain("findet validiertes Wissen");
      expect(text).toContain('„findet passendes Wissen"');
    }
    // „Bester nächster Einstieg" gibt es auf der Startseite nicht als Beschriftung.
    expect(beschriftungenFuer("Bester nächster Einstieg", de)).toEqual([]);
    expect(dp).not.toContain("„Bester nächster Einstieg");
    expect(qs).not.toContain("„besten nächsten Einstieg");
    // Der Demo-Datensatz folgt der Sprache des ladenden Admins (K11/K22) — die alte Aussage
    // „ist deutsch" steht nicht mehr in der Anleitung.
    expect(qs).not.toContain("Demo-Datensatz ist **deutsch**");
  });

  it("D-5 Rotprobe: ein Zitat, das keinem Knopf entspricht, wird gemeldet", () => {
    const probe = "Dann „Ausgewählte übernehmen“ klicken, nicht „Übernehmen ausgewählt“.";
    expect(beschriftungenFuer("Ausgewählte übernehmen", de)).toContain("capture.file.applyCta");
    expect(unbekannteZitate("probe.md", probe, de, {})).toEqual([
      "probe.md:1 · Übernehmen ausgewählt",
    ]);
    // Platzhalter und Satzpunkt: „Stand 3" ist eine Beschriftung, „Bewertung erfasst" auch.
    expect(beschriftungenFuer("Stand 3", de).length).toBeGreaterThan(0);
    expect(beschriftungenFuer("Stand N", de).length).toBeGreaterThan(0);
    // Gemessener Fehlfall (Nacharbeit 6): „{{n}} ausgewählt" (pruefboard.stapel.anzahl) darf kein
    // Wort schlucken — eine Zahl davor ist die Beschriftung, ein Wort nicht.
    expect(beschriftungenFuer("3 ausgewählt", de)).toContain("pruefboard.stapel.anzahl");
    expect(beschriftungenFuer("Übernehmen ausgewählt", de)).toEqual([]);
    expect(beschriftungenFuer("Bewertung erfasst", de)).toContain("val.decisionSaved");
  });
});
