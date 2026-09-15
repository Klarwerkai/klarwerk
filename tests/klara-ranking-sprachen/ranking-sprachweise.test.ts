// ================================================================================================
// JOB 3898 · WAS KLARAS AUSWAHL IN DEN ANDEREN GEFÜHRTEN SPRACHEN WIRKLICH TUT.
// ================================================================================================
//
// WOGEGEN DIESE DATEI STEHT. `rankKlara` (`apps/web/src/lib/klaraRegistry.ts:289-311`) wählt die
// Einträge aus, die Klara der KI als EINZIGE Antwortgrundlage mitgibt. Bis heute hat kein einziger
// Ranking-Fall Deutsch verlassen: `tests/help/klara-registry.test.ts` ruft vor jedem Such- und
// Ranking-Fall `i18n.changeLanguage("de")` (`:67`, `:80`, `:94`, und ebenso in jedem JOB-3798-Fall
// ab `:144`). Die einzige mehrsprachige Prüfung dort ist die reine AUFLÖSUNG (`:36-47`, DE und EN,
// nur „keine rohen Keys"). Wählt die Auswahl in einer Sprache schlechter aus, bekommt der Nutzer
// dort schlechtere oder gar keine belegten Antworten — und niemand merkt es.
//
// BESTELLT HAT DAS BEN: `jobs/3874/runde-2/ben.md:31` — „Offen bleiben Browserabsprung und separate
// EN/NL-Rankingwirkung; geeignete Folgeprüfungen wären ein tatsächlicher Trefferklick beziehungsweise
// sprachweise `rankKlara`-Fälle." Die Vorgängerbahn hat es ausdrücklich draußen gelassen
// (`jobs/3874/runde-2/RUECKGABE.md:38`).
//
// WAS HIER GEMESSEN IST — und zwar für JEDE Sprache, die das Produkt selbst führt (L1 liest sie aus
// `i18n.options.resources`, nicht aus einer Liste in diesem Test):
//   L1 · die Sprachliste kommt aus dem Produkt, nicht aus diesem Test.
//   L2 · die Synonymkarte, sprachweise beziffert: wie viele aufgelöste Einträge tragen den Zielstamm.
//   L3 · dieselbe fachliche Frage (der Validierungsweg) in jeder Sprache am selben Maßstab —
//        L3a Trefferzahl/Deckel/Route, L3b der zugesicherte Sprachabstand, L3c die Parameter des
//        echten Aufrufers.
//   L4 · die Wortlängen-Asymmetrie zwischen `searchKlara` (ab 2, `:272`) und `rankKlara` (ab 3,
//        `:295`) — L4 die Kante des Rankings, L4b die untere Kante der Suche (ein Zeichen).
//   L5 · die Größe der FAQ-Lücke außerhalb von Deutsch (`allFaqEntries:204-207`).
//
// ZWEI VERSCHIEDENE PARAMETERSÄTZE — DAS IST KEIN DETAIL (BEN, Runde 1, Korrekturpflicht 3). Was
// `rankKlara` liefert, hängt an zwei Dingen, die der AUFRUFER setzt: am `limit` und am Korpus. Diese
// Datei fährt beide und hält sie auseinander:
//   · FUNKTIONSMESSUNG (L2, L3a, L3b, L4, L5b): `limit` 6 — das ist der EIGENE Vorgabewert der
//     Funktion (`klaraRegistry.ts:292`), nicht der Wert irgendeines Aufrufers — und als Korpus die
//     blanke aufgelöste Registry OHNE FAQ. Das misst die Funktion, nicht das Panel. Kein Satz über
//     diese Zahlen darf „so viel bekommt die KI wirklich" behaupten.
//   · AUFRUFERMESSUNG (L3c): die Parameter, mit denen das einzige Produktivstück `rankKlara`
//     tatsächlich ruft — `KlaraAssistant.tsx:298` nimmt `limit` 12 und einen Korpus, der die FAQ
//     EINSCHLIESST (`:266-272`). Nur diese Zahlen beschreiben, was die KI im Panel bekommt.
// In Runde 1 stand die Funktionsmessung ohne diese Unterscheidung da und behauptete sechs Einträge
// als Panel-Grundlage — falsch um den Faktor zwei und um die ganze FAQ. Deshalb steht der Aufrufer
// jetzt als eigener, eigener gepinnter Fall daneben.
//
// WAS HIER AUSDRÜCKLICH NICHT GEMESSEN IST. Diese Datei bleibt auf der reinen FUNKTIONSEBENE: kein
// DOM, kein Browser, kein Modellaufruf, keine Aussage über die QUALITÄT der KI-Antwort. Auch L3c
// RECHNET die Aufruferparameter nur nach; dass `KlaraAssistant` sie zur Laufzeit wirklich so setzt,
// ist hier aus dem Quelltext zitiert, nicht am laufenden Panel beobachtet. Eine kleinere Trefferzahl
// ist zudem kein Beweis für eine schlechtere ANTWORT — sie ist eine kleinere Grundlage, mehr sagt
// diese Datei nicht (BEN, Runde 1, Prüfpunkt 6). Der tatsächliche Trefferklick aus dem Klara-Panel
// ist BENs ZWEITE Folgeprüfung (`ben.md:31`) und gehört einem eigenen Auftrag; er ist hier draußen.
// Ebenso draußen: jede Änderung am Produkt — diese Datei misst und repariert nicht. Was sie an
// echten Lücken findet, steht in der Rückgabe.
//
// SIE DOPPELT DIE BESTANDSFÄLLE NICHT. Die DE-Fälle bleiben unverändert in
// `tests/help/klara-registry.test.ts`: der Ehrlichkeitswächter über die Karte (`:301-347`), der
// Synonymträger ohne Literal (`:208-241`), die Füllwort-Frage im Ranking (`:79-91`), die Satzzeichen
// (`:93-100`) und die FAQ-Grundmenge (`:107-128`). Hier steht nur, was dort fehlt: die SPRACHE.
import { describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import {
  KLARA_SYNONYMS,
  type ResolvedKlaraEntry,
  allFaqEntries,
  allKlaraEntries,
  rankKlara,
  resolveKlaraEntries,
  searchKlara,
} from "../../apps/web/src/lib/klaraRegistry";

// ------------------------------------------------------------------------------------------------
// L1 · DIE SPRACHLISTE KOMMT AUS DEM PRODUKT.
// ------------------------------------------------------------------------------------------------
//
// Keine Literalliste in diesem Test: fällt eine Sprache weg oder kommt eine dazu, wandern alle Fälle
// unten automatisch mit. Dieselbe Quelle, die JOB 3874 für seinen Vollständigkeitsabgleich benutzt
// hat. BEN schrieb „EN/NL" — das wird hier nicht abgeschrieben, sondern nachgezählt.
function gefuehrteSprachen(): string[] {
  const ressourcen = i18n.options.resources;
  return ressourcen === undefined ? [] : Object.keys(ressourcen).sort();
}

const SPRACHEN = gefuehrteSprachen();

// ------------------------------------------------------------------------------------------------
// Die Normalisierung, der `searchKlara` den TEXT unterwirft, bevor es den ROHEN Kartenwert darin
// sucht (`klaraRegistry.ts:248-254`, angewandt in `:277` und `:301`).
// ------------------------------------------------------------------------------------------------
//
// BEWUSST NACHGEBILDET statt importiert, und nicht aus Bequemlichkeit: `normalizeForSearch` ist im
// Produkt privat, und ein reiner Test-Export risse den Aufrufer-Wächter
// (`tests/capture/aufrufer-waechter.test.ts`). Die zweite Nachbildung im Haus steht in
// `tests/help/klara-registry.test.ts:294-299` (`wieImText`) — sie ist dort privat in einem `describe`
// und lässt sich nicht importieren; jene Datei ist zudem Zielpfad des laufenden JOB 3874 und nach §10
// dieses Auftrags gesperrt. Gegen Drift ist die Nachbildung hier an der ECHTEN Suche kalibriert
// (L2b): weicht sie je ab, wird der Fall rot.
//
// KORREKTURPFLICHT 2 aus JOB 3798 gilt hier genauso: gemessen wird der UNVERÄNDERTE Kartenwert gegen
// den normalisierten Titel+Text — keine Anfrage-Normalisierung, keine Synonymerweiterung. Sonst
// gälte ein großgeschriebener Zielstamm als tragfähig, den die Laufzeit nie fände.
function wieImText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Die aufgelösten Klara-Einträge EINER Sprache — mit der Schranke aus §9 des Auftrags.
 *
 * Kein Fall darf „in dieser Sprache gibt es keine Treffer" behaupten, wenn schon die AUFLÖSUNG
 * fehlgeschlagen ist. Deshalb prüft dieser Helfer zuerst, dass überhaupt Einträge da sind und dass
 * kein Titel bzw. Text als roher i18n-Key durchkommt — und scheitert sonst mit eigenem, benanntem
 * Fehlertext, statt eine negative Aussage ohne Grundlage zu stützen.
 */
async function aufgeloest(sprache: string): Promise<ResolvedKlaraEntry[]> {
  await i18n.changeLanguage(sprache);
  const eintraege = resolveKlaraEntries(allKlaraEntries(), (k) => i18n.t(k));
  expect(
    eintraege.length,
    `AUFLÖSUNG FEHLGESCHLAGEN in „${sprache}": \`resolveKlaraEntries\` hat keinen einzigen Eintrag geliefert — jede Aussage über diese Sprache wäre unbegründet`,
  ).toBeGreaterThan(0);
  const roh = eintraege
    .filter((e) => e.title === e.titleKey || e.body === e.bodyKey)
    .map((e) => e.id);
  expect(
    roh,
    `AUFLÖSUNG FEHLGESCHLAGEN in „${sprache}": diese Einträge kommen als roher i18n-Key durch, ihr Text ist also gar kein Text — eine Messung darauf sagt nichts über die Sprache aus:\n  ${roh.join("\n  ")}`,
  ).toEqual([]);
  return eintraege;
}

/** Titel+Text jedes Eintrags, genau so normalisiert, wie die Suche es zur Laufzeit tut. */
function korpusTexte(eintraege: readonly ResolvedKlaraEntry[]): string[] {
  return eintraege.map((e) => wieImText(`${e.title} ${e.body}`));
}

/** Jedes Paar (Schlüssel → Zielstamm) der Karte, in Kartenreihenfolge. */
function synonymPaare(): { schluessel: string; stamm: string }[] {
  const paare: { schluessel: string; stamm: string }[] = [];
  for (const [schluessel, staemme] of Object.entries(KLARA_SYNONYMS)) {
    for (const stamm of staemme) {
      paare.push({ schluessel, stamm });
    }
  }
  return paare;
}

// ================================================================================================
// L2 · DIE SYNONYMKARTE, SPRACHWEISE BEZIFFERT.
// ================================================================================================
//
// GEPINNT WIRD DER ZIELSTAMM JE SPRACHE, nicht das Schlüssel-Stamm-Paar: der STAMM ist das, was
// trägt (`klaraRegistry.ts:304`: `haystack.includes(v)`); zwei Schlüssel auf denselben Stamm haben
// notwendig dasselbe Ergebnis. Der Fehlertext nennt trotzdem IMMER den Schlüssel, weil ein Mensch
// die Karte über Schlüssel liest.
//
// SCHRANKE IN BEIDE RICHTUNGEN (Bauart wie `tests/chr-navigation-sprachen/sprachweg-waechter.test.ts:67`
// und `tests/help/klara-registry.test.ts:274`):
//   · Ein Paar, das gemessen wird und hier nicht steht, macht den Fall rot (neue oder geänderte Karte).
//   · Ein Pin, den keine Messung mehr trifft, macht ihn ebenfalls rot — sonst verwaltet das Register
//     Gespenster.
// Die Zahl selbst ist eine UNTERGRENZE, wo sie größer als 0 ist: die Toleranz darf wachsen, aber
// nicht schrumpfen. Wo sie 0 ist, ist sie EXAKT: ein toter Stamm, der wieder trägt, gehört
// nachgeführt statt stillschweigend geduldet.
type Tragkraft = { readonly zahl: number; readonly satz: string };

// GEMESSEN AM BASISSTAND ece535ba, Cloud-Lauf 6e761b1c, nicht gesetzt: der erste Lauf dieser Datei
// lief mit LEERER Karte rot und hat alle 48 Paare mit ihrer Zahl aufgezählt; erst danach sind diese
// Zeilen entstanden. Schlüssel: `<sprache> → <zielstamm>`.
//
// DER BEFUND IN EINEM SATZ: Klaras Toleranz ist nicht „in EN schwächer" — sie ist dort GAR NICHT DA.
// Alle acht Zielstämme tragen in EN und NL null Einträge, 16 von 16 Paaren tot. Das ist keine
// Übersetzungslücke des Katalogs: der sagt dasselbe mit eigenen Wörtern („Validation"/„Validatie",
// „knowledge object"/„kennisobject", „Duplicates"/„Duplicaten"). Tot ist der DEUTSCHE KARTENWERT,
// den `rankKlara:303` ohne jede Sprachbedingung anlegt. Behebung wäre eine sprachabhängige Karte
// oder ein Sprachgate wie `allFaqEntries` — eine Produktentscheidung in `klaraRegistry.ts`, nach §10
// dieses Auftrags gesperrt. Hier wird sie beziffert, nicht gefällt.
const TRAGKRAFT: ReadonlyMap<string, Tragkraft> = new Map<string, Tragkraft>([
  // ---- de: der Maßstab. Jeder Stamm trägt — bis auf einen, und der ist namentlich begründet. ----
  [
    "de → validier",
    {
      zahl: 21,
      satz:
        "„freigeben“, „freigabe“ und „genehmigen“ führen auf 21 Einträge des Validierungswegs — " +
        "wer das Alltagswort tippt, bekommt die Fläche, die es wirklich tut.",
    },
  ],
  [
    "de → wissensobjekt",
    {
      zahl: 38,
      satz: "„artikel“ und „beitrag“ führen über den vollen Fachbegriff auf 38 Einträge.",
    },
  ],
  [
    "de → objekt",
    {
      zahl: 61,
      satz:
        "derselbe Schlüssel trägt über die kürzere Teilkette sogar 61 Einträge — sie ist die " +
        "breitere der beiden und deckt die engere mit ab.",
    },
  ],
  [
    "de → papierkorb",
    {
      zahl: 0,
      satz:
        "TOT, und zwar als ECHTER FUND, nicht als Tippfehler: derselbe Befund steht seit JOB 3798 " +
        "namentlich im DE-Ehrlichkeitswächter (`tests/help/klara-registry.test.ts:274-287`). " +
        "Klaras einzige Löschhilfe (`vhelp.deleteKo.body`) sagt „endgültig“ und kennt den " +
        "Papierkorb nicht, während die Löschabfrage der Fläche 28 Tage Wiederherstellung " +
        "verspricht. Wer „löschen“ tippt, erfährt von Klara nichts von der Rückholbarkeit. Die " +
        "Behebung bräuchte `i18n.ts` und ist hier nach §10 gesperrt — sie steht als REST in der " +
        "Rückgabe. Der zweite Stamm desselben Schlüssels trägt (siehe „de → entfern“), das " +
        "Synonym läuft also nicht ganz ins Leere.",
    },
  ],
  [
    "de → entfern",
    {
      zahl: 5,
      satz: "der zweite Stamm von „löschen“ trägt mit 5 Einträgen und rettet den Schlüssel.",
    },
  ],
  ["de → antwort", { zahl: 14, satz: "„frage“ führt über 14 Einträge auf den Antwortweg." }],
  [
    "de → wissenslücke",
    {
      zahl: 3,
      satz:
        "der zweite Stamm von „frage“ ist mit 3 Einträgen der schmalste tragende der ganzen " +
        "Karte — fällt einer dieser drei Texte, ist er der nächste Wackelkandidat.",
    },
  ],
  [
    "de → duplikat",
    {
      zahl: 2,
      satz:
        "die fünf Wörter des abgeschafften Verschmelzen-Versprechens (JOB 3798) hängen alle an " +
        "genau 2 Einträgen — die schmalste tragende Stelle mit der größten Schlüsselzahl.",
    },
  ],
  // ---- en / nl: dieselbe Karte, dieselbe Anwendung, null Wirkung. ----
  ...(
    [
      ["en", "englischen"],
      ["nl", "niederländischen"],
    ] as const
  ).flatMap(([lng, wort]) =>
    (
      [
        ["validier", "„freigeben“, „freigabe“ und „genehmigen“"],
        ["wissensobjekt", "„artikel“ und „beitrag“ (voller Fachbegriff)"],
        ["objekt", "„artikel“ und „beitrag“ (kurze Teilkette)"],
        ["papierkorb", "„löschen“ (erster Stamm)"],
        ["entfern", "„löschen“ (zweiter Stamm)"],
        ["antwort", "„frage“ (erster Stamm)"],
        ["wissenslücke", "„frage“ (zweiter Stamm)"],
        ["duplikat", "die fünf Verschmelzen-Wörter"],
      ] as const
    ).map(([stamm, schluessel]): [string, Tragkraft] => [
      `${lng} → ${stamm}`,
      {
        zahl: 0,
        satz: `TOT im ${wort} Bestand: ${schluessel} lösen den deutschen Stamm „${stamm}“ auf, der in keinem einzigen aufgelösten Eintrag dieser Sprache vorkommt. Für den Nutzer heißt das: die tolerante Suche, die ihm in Deutsch hilft, tut hier nichts — er bekommt nur, was sein Wortlaut wörtlich trifft.`,
      },
    ]),
  ),
]);

// ================================================================================================
// L3 · DASSELBE FACHLICHE ANLIEGEN IN JEDER SPRACHE, AM SELBEN MASSSTAB.
// ================================================================================================
//
// Gegenstand ist der VALIDIERUNGSWEG: er hat in jeder geführten Sprache aufgelöste Einträge (Beleg:
// `tests/help/klara-registry.test.ts:36-47` löst jeden Titel und Text in DE und EN auf, L1 hier zählt
// die Sprachen nach). Die Frage wird nicht in drei Fassungen erfunden, sondern aus dem PRODUKT
// gebaut: eingesetzt wird das Navigationslabel `nav.validation` in der jeweiligen Sprache. So misst
// jede Sprache ihr eigenes Wort, und eine geänderte Übersetzung wandert mit.
//
// Die Füllwörter darum herum sind der eigentliche Prüfgegenstand von `rankKlara` (Kopfkommentar
// `klaraRegistry.ts:285-288`: ganze Fragen enthalten Füllwörter, die die strikte Suche leer laufen
// lassen). Für eine Sprache ohne eigenen Rahmen bleibt das blanke Label übrig — das ist die
// EHRLICHE Rückfallposition: dann misst der Fall weniger, behauptet aber auch weniger, und L3a sagt
// im Protokoll, welche Sprache ohne Rahmen gefahren ist.
const FRAGERAHMEN: ReadonlyMap<string, (label: string) => string> = new Map([
  ["de", (l: string) => `Warum brauche ich mehrere grüne Freigaben bis zur ${l}?`],
  ["en", (l: string) => `Why do I need several green approvals before ${l} is complete?`],
  ["nl", (l: string) => `Waarom heb ik meerdere goedkeuringen nodig voordat de ${l} klaar is?`],
]);

/** Die Route, auf der der Validierungsweg lebt (`klaraRegistry.ts:44-48`). */
const VALIDIERUNGSROUTE = "/validierung";

/**
 * Der EIGENE Vorgabewert von `rankKlara` (`klaraRegistry.ts:292`) — NICHT der Wert des Aufrufers.
 * Damit fährt die Funktionsmessung; was das Panel setzt, steht in `LIMIT_PANEL`.
 */
const LIMIT_FUNKTION = 6;

/**
 * Das `limit`, mit dem das einzige Produktivstück `rankKlara` wirklich ruft:
 * `apps/web/src/components/KlaraAssistant.tsx:298` (`rankKlara(resolved, question, 12)`).
 */
const LIMIT_PANEL = 12;

// ZWEI ZAHLEN, NICHT EINE — und das ist der Kern dieses Falls. Der erste Lauf (6e761b1c) hat mit
// dem `limit` von 6 gemessen und für ALLE DREI Sprachen „6 Treffer, /validierung dabei" geliefert:
// Unterschied 0. Diese Null ist ein MESSFEHLER, kein Befund — der Deckel schneidet alles ab, was
// darüber liegt, und macht drei verschieden große Bestände gleich groß. Deshalb steht daneben die
// UNGESCHNITTENE Zahl: wie viele Einträge überhaupt einen Punkt holen. Erst sie zeigt, wie breit
// die Grundlage in dieser Sprache wirklich ist, aus der die besten sechs gewählt werden.
//
// UND DAZU DIE DRITTE ZAHL, DIE RUNDE 1 GEFEHLT HAT (BEN, Korrekturpflicht 1). Eine reine
// UNTERGRENZE auf `ungeschnitten` bewacht nur eine Richtung: sie merkt, wenn die Auswahl
// SCHRUMPFT, aber nicht, wenn sie ins Uferlose WÄCHST. BEN hat genau das vorgeführt — mit
// `klaraRegistry.ts:308` (`s.score > 0` → `>= 0`) kommen statt 118/41/39 auf einmal 135/135/135
// Einträge zurück, jeder Sprachabstand wird null, und Runde 1 blieb grün. Der Punktfilter ist aber
// das, WAS DAS RANKING ÜBERHAUPT ZUM RANKING MACHT: er wirft weg, was die Frage nicht trifft.
// Deshalb wird ab jetzt die ABLEHNUNG gepinnt — wie viele Einträge des Korpus die Frage NICHT
// treffen. Fällt der Filter, fällt diese Zahl auf 0, und der Fall wird rot.
type Rangbefund = {
  /** Ergebnis der Funktionsmessung — gedeckelt auf `LIMIT_FUNKTION` (`klaraRegistry.ts:310`). */
  readonly treffer: number;
  /** Wie viele Einträge überhaupt punkten — ohne Deckel. Die Zahl, die der Deckel verbirgt. */
  readonly ungeschnitten: number;
  /**
   * Wie viele Einträge des Korpus der Punktfilter (`klaraRegistry.ts:308`) WEGWIRFT.
   * Das ist die Obergrenze auf `ungeschnitten`, ausgedrückt in der Richtung, in der sie etwas sagt.
   */
  readonly abgelehnt: number;
  readonly hatValidierung: boolean;
  readonly satz: string;
};

// GEMESSEN am Basisstand ece535ba (Cloud-Lauf 94792e7e), nicht gesetzt. Schlüssel: Sprache.
//
// DIE ZAHL, DIE DER DECKEL VERSTECKT HAT: 118 gegen 41 gegen 39. Gedeckelt sehen alle drei Sprachen
// gleich aus (je 6, Unterschied 0) — ungedeckelt ist Klaras Auswahlgrundlage in Englisch noch gut
// ein Drittel und in Niederländisch ein Drittel der deutschen. Die erwartete Route ist trotzdem
// überall dabei: wer WÖRTLICH nach seinem eigenen Navigationsnamen fragt, wird in jeder Sprache
// bedient. Schmal wird es erst daneben — und genau das misst L2 (die Synonyme tragen außerhalb von
// DE null) und L5 (77 FAQ-Einträge fehlen).
//
// NACHGEFÜHRT VON JOB 4071 (15.09.2026, ALTKAPITEL-ANWENDERSPRACHE), gemessen, nicht gesetzt.
// Die zehn Altkapitel der Hilfeseite sind in de/en/nl neu formuliert worden; sie sind Teil DIESES
// Korpus (`klaraRegistry.ts:168-174`: je Kapitel ein Eintrag `topic:<id>` aus Titel + Text). Der
// Korpus selbst ist unverändert 135 Einträge — was sich geändert hat, ist ihr WORTLAUT, und damit
// die Zahl derer, die die Frage überhaupt berühren.
//
// DIE BEWEGUNG GING IN JEDER SPRACHE IN DIESELBE RICHTUNG — die Auswahl ist GEWACHSEN, nicht
// geschrumpft: de 118 → 120, en 41 → 42, nl 39 → 40 punktende Einträge. `ungeschnitten` (die
// Untergrenze) steigt deshalb mit; `abgelehnt` ist die Kehrseite derselben Messung und fällt
// zwangsläufig um genau denselben Betrag: de 17 → 15, en 94 → 93, nl 96 → 95. Der Punktfilter
// selbst ist unangetastet (`klaraRegistry.ts:308`), und er wirft weiter zwei- bis dreistellig viel
// weg — die Gefahr, gegen die diese Zahl gebaut ist („bei 0 ist der Filter gefallen"), ist nicht
// eingetreten.
// GEMESSEN, NICHT GESETZT: Arbeitsprüfung 212444b5d55f43d6b89ec20ca48b5085, L3a-Protokoll
// „de: … 6 von 120 punktenden Einträgen (Korpus 135, abgelehnt 15)", „en: … 6 von 42 … abgelehnt
// 93", „nl: … 6 von 40 … abgelehnt 95"; erst danach wurden diese Zeilen angefasst.
// NICHT ANGEFASST, weil grün geblieben: `ABSTAND` (gemessen en -78 gegen Pin 77, nl -80 gegen 79 —
// der Sprachabstand ist um je einen Eintrag GEWACHSEN, die Untergrenze trägt weiter) und
// `hatValidierung` (in allen drei Sprachen unverändert DABEI).
const RANG: ReadonlyMap<string, Rangbefund> = new Map<string, Rangbefund>([
  [
    "de",
    {
      treffer: 6,
      ungeschnitten: 120,
      abgelehnt: 15,
      hatValidierung: true,
      satz:
        "Der Maßstab: 120 der 135 Registry-Einträge holen für die Validierungsfrage mindestens " +
        "einen Punkt, die besten 6 gehen in der Funktionsmessung weiter, `/validierung` ist " +
        "darunter. Der Punktfilter wirft hier nur 15 Einträge weg — die deutsche Frage ist voller " +
        "Füllwörter, die fast überall vorkommen; genau dafür ist `rankKlara` gebaut " +
        "(`klaraRegistry.ts:285-288`), und genau deshalb entscheidet in Deutsch die REIHENFOLGE " +
        "und nicht der Filter.",
    },
  ],
  [
    "en",
    {
      treffer: 6,
      ungeschnitten: 42,
      abgelehnt: 93,
      hatValidierung: true,
      satz:
        "Gedeckelt sieht Englisch aus wie Deutsch (6 Treffer, `/validierung` dabei) — ungedeckelt " +
        "punkten nur 42 statt 120 Einträge. Die Auswahl, aus der Klara die besten sechs zieht, ist " +
        "hier gut ein Drittel so breit. Für den Nutzer: bei einer wörtlich passenden Frage merkt " +
        "er nichts, bei einer schief formulierten fehlt ihm die Ausweichmasse.",
    },
  ],
  [
    "nl",
    {
      treffer: 6,
      ungeschnitten: 40,
      abgelehnt: 95,
      hatValidierung: true,
      satz:
        "Dasselbe Bild wie in Englisch, eine Spur enger: 40 punktende Einträge gegen 120 in " +
        "Deutsch, `/validierung` trotzdem in den besten sechs.",
    },
  ],
]);

// ------------------------------------------------------------------------------------------------
// L3b · DER SPRACHABSTAND, VERBINDLICH — nicht nur ausgegeben (BEN, Runde 1, Korrekturpflicht 1).
// ------------------------------------------------------------------------------------------------
//
// Runde 1 hat den Abstand BERECHNET und ins Protokoll GESCHRIEBEN, aber nie zugesichert. Damit war
// er wertlos: BENs Verstellung `s.score > 0` → `>= 0` (`klaraRegistry.ts:308`) drückte jeden Abstand
// auf null, und der Fall blieb grün. Hier steht die Zahl jetzt als Pin. Schlüssel: Sprache (ohne
// `de`, das ist der Maßstab selbst) → wie viele punktende Einträge diese Sprache MINDESTENS weniger
// hat als Deutsch.
//
// RICHTUNG DES PINS, ausdrücklich: gepinnt ist eine UNTERGRENZE des Abstands. Wird der Abstand
// kleiner — weil jemand die Toleranz in dieser Sprache repariert —, wird dieser Fall rot und
// verlangt eine Nachführung. Das ist gewollt: die Lücke ist der BEFUND dieses Auftrags; sie
// stillschweigend verschwinden zu lassen wäre genauso falsch wie sie stillschweigend zu vergrößern.
//
// GEMESSEN, NICHT GESETZT: mit leerer Karte lief dieser Fall im Cloud-Lauf 4d9d5f10 rot und zählte
// beide Abstände auf — „en — gemessener Abstand 77 punktende Einträge weniger als de (41 gegen
// 118)", „nl — gemessener Abstand 79 (39 gegen 118)". Erst danach sind diese Zeilen entstanden.
const ABSTAND: ReadonlyMap<string, { readonly mindestens: number; readonly satz: string }> =
  new Map([
    [
      "en",
      {
        mindestens: 77,
        satz:
          "77 punktende Einträge weniger als Deutsch (41 gegen 118). Klaras Auswahlmasse ist in " +
          "Englisch gut ein Drittel der deutschen — bei einer wörtlich passenden Frage merkt der " +
          "Nutzer davon nichts (die Route ist in beiden Sprachen dabei), bei einer schief " +
          "formulierten fehlt ihm die Ausweichmasse.",
      },
    ],
    [
      "nl",
      {
        mindestens: 79,
        satz:
          "79 punktende Einträge weniger als Deutsch (39 gegen 118) — der größte Abstand der drei " +
          "geführten Sprachen, eine Spur enger noch als Englisch.",
      },
    ],
  ]);

// ------------------------------------------------------------------------------------------------
// L3c · DIE PARAMETER DES ECHTEN AUFRUFERS (BEN, Runde 1, Korrekturpflicht 3).
// ------------------------------------------------------------------------------------------------
//
// `KlaraAssistant.tsx:298` ruft `rankKlara(resolved, question, 12)` — `limit` 12, nicht 6 — und
// `resolved` (`:266-272`) ist die aufgelöste Registry PLUS `allFaqEntries(i18n.language)`. Runde 1
// hat mit 6 und ohne FAQ gemessen und das Ergebnis dennoch als das bezeichnet, „was die KI
// bekommt". Das war um den Faktor zwei und um die ganze FAQ daneben. Dieser Fall misst mit den
// ECHTEN Parametern; `ausFaq` zeigt, wie viel davon in Deutsch allein aus der FAQ kommt — also
// genau der Teil, den das Sprach-Gate (L5) den anderen Sprachen vorenthält.
type Panelbefund = {
  readonly treffer: number;
  readonly ungeschnitten: number;
  readonly ausFaq: number;
  readonly satz: string;
};

//
// GEMESSEN, NICHT GESETZT: mit leerer Karte lief dieser Fall im Cloud-Lauf 4d9d5f10 rot und zählte
// alle drei Sprachen auf („de — gemessen 12 von 194 punktenden Einträgen, davon 5 aus der FAQ",
// „en — 12 von 41, davon 0", „nl — 12 von 39, davon 0"). Erst danach sind diese Zeilen entstanden.
//
// DIE ZAHL, DIE ERST HIER SICHTBAR WIRD — und die Runde 1 mit ihrem falschen `limit` verfehlt hat:
// gedeckelt bekommt die KI in JEDER Sprache zwölf Einträge, aber in Deutsch sind FÜNF davon aus der
// FAQ. Das heißt: knapp die Hälfte der Antwortgrundlage, die ein deutscher Nutzer für diese Frage
// bekommt, existiert außerhalb von Deutsch überhaupt nicht. Die FAQ-Lücke aus L5 ist damit nicht
// bloß eine Zahl im Katalog, sondern schlägt bis in die konkrete Auswahl durch.
//
// NACHGEFÜHRT VON JOB 4071 (15.09.2026), gemessen, nicht gesetzt — und hier steckt der EINZIGE
// Befund dieser Nachführung, der nicht bloß eine größere Auswahl ist:
//   · `ungeschnitten` wächst mit dem neuen Wortlaut der Hilfekapitel (de 194 → 196, en 41 → 42,
//     nl 39 → 40) — dieselbe Bewegung wie in RANG, die Untergrenze steigt.
//   · `ausFaq` in DEUTSCH FÄLLT von 5 auf 3. Der Korpus der FAQ ist unverändert (77 Einträge, L5
//     bleibt grün); was sich verschoben hat, ist die REIHENFOLGE: die neu formulierten Kapitel
//     `topic:validation` und `topic:tasks` sagen jetzt selbst, was auf der Validierung geschieht
//     („genug grüne Bewertungen … keine rote dagegen"), punkten für genau diese Frage höher als
//     zuvor und verdrängen zwei FAQ-Einträge aus den besten zwölf. Die Antwortgrundlage ist
//     dadurch nicht dünner (weiterhin zwölf Einträge) und inhaltlich näher an der Frage; was
//     schrumpft, ist der ANTEIL, den nur Deutsch bekommt — also genau der Sprachvorsprung, den
//     dieser Pin beziffert. Er wird hier auf den gemessenen Wert gesetzt, NICHT gelöscht: die
//     FAQ-Lücke der anderen Sprachen (L5) besteht unverändert fort.
// GEMESSEN, NICHT GESETZT: Arbeitsprüfung 212444b5d55f43d6b89ec20ca48b5085, L3c-Protokoll
// „de: Korpus 212 (davon 77 FAQ) → 12 von 196 punktenden Einträgen gehen an die KI, davon 3 aus
// der FAQ", „en: … 12 von 42 … davon 0", „nl: … 12 von 40 … davon 0".
const PANEL: ReadonlyMap<string, Panelbefund> = new Map<string, Panelbefund>([
  [
    "de",
    {
      treffer: 12,
      ungeschnitten: 196,
      ausFaq: 3,
      satz:
        "Aus 212 Einträgen (135 Registry + 77 FAQ) punkten 196; die besten 12 gehen an die KI, " +
        "3 davon aus der FAQ.",
    },
  ],
  [
    "en",
    {
      treffer: 12,
      ungeschnitten: 42,
      ausFaq: 0,
      satz:
        "Derselbe Deckel, dieselbe Trefferzahl (12) — aber aus 42 statt 196 punktenden Einträgen " +
        "gewählt, und keiner davon aus der FAQ: das Sprach-Gate hält sie draußen.",
    },
  ],
  [
    "nl",
    {
      treffer: 12,
      ungeschnitten: 40,
      ausFaq: 0,
      satz:
        "Wie in Englisch, aus 40 punktenden Einträgen gewählt, ohne jeden FAQ-Anteil an der " +
        "KI-Grundlage.",
    },
  ],
]);

// ================================================================================================
// L4 · DIE WORTLÄNGEN-ASYMMETRIE.
// ================================================================================================
//
// `searchKlara:272` zählt Wörter ab Länge 2, `rankKlara:295` erst ab Länge 3. Kurze Inhaltswörter
// fallen im RANKING also weg, in der SUCHE nicht — das steht nirgends geschrieben und war nirgends
// gemessen. Gepinnt wird je Sprache, wie viele zweibuchstabige Wörter der eigene Korpus überhaupt
// hergibt und wie viele davon die Suche findet — BEIDE Zahlen, weil eine allein nicht sagt, ob eine
// Schrumpfung vom Korpus oder von der Schwelle kommt.
type Kurzwortbefund = { readonly kandidaten: number; readonly gefunden: number };

// GEMESSEN am Basisstand ece535ba (Cloud-Lauf 6e761b1c), nicht gesetzt. Schlüssel: Sprache.
// In allen drei Sprachen findet `searchKlara` JEDES zweibuchstabige Wort des eigenen Korpus
// (Kandidaten = Gefundene) — was daran liegt, dass die Suche per Teilkette arbeitet. Und in allen
// drei Sprachen liefert `rankKlara` dafür ehrlich nichts. Das ist die Asymmetrie, schwarz auf weiß.
const KURZWORT: ReadonlyMap<string, Kurzwortbefund> = new Map<string, Kurzwortbefund>([
  ["de", { kandidaten: 26, gefunden: 26 }],
  ["en", { kandidaten: 31, gefunden: 31 }],
  ["nl", { kandidaten: 30, gefunden: 30 }],
]);

// ------------------------------------------------------------------------------------------------
// DIE UNTERE KANTE DER SUCHSCHWELLE — was Runde 1 gefehlt hat (BEN, Korrekturpflicht 2).
// ------------------------------------------------------------------------------------------------
//
// Runde 1 hat nur die Kante des RANKINGS bewacht (2 Zeichen stumm, 3 Zeichen laut) und die Kante der
// SUCHE offengelassen. BEN hat das vorgeführt: `klaraRegistry.ts:272` (`tok.length > 1` → `> 0`)
// blieb unbemerkt, weil kein Fall je EIN Zeichen angefragt hat. Beide Schwellen werden deshalb jetzt
// UNMITTELBAR UNTERHALB und UNMITTELBAR OBERHALB geprüft:
//   1 Zeichen → `searchKlara` stumm  (untere Kante der Suche, `:272`)   ← neu in Runde 2
//   2 Zeichen → `searchKlara` laut, `rankKlara` stumm  (obere Kante der Suche, untere des Rankings)
//   3 Zeichen → `rankKlara` laut     (obere Kante des Rankings, `:295`)
//
// KALIBRIERUNG STATT LEERLAUF: „ein Zeichen findet nichts" wäre auch dann grün, wenn der Buchstabe
// im Korpus überhaupt nicht vorkäme. Der Fall prüft deshalb zuerst, dass jeder angefragte Buchstabe
// als Teilkette wirklich in mindestens einem Eintrag steht — erst dann sagt sein Schweigen etwas
// über die SCHWELLE statt über den Text. Gepinnt wird, wie viele solcher belegten Buchstaben die
// Sprache hergibt. Schlüssel: Sprache.
//
// GEMESSEN, NICHT GESETZT: mit leerer Karte lief dieser Fall im Cloud-Lauf 4d9d5f10 rot und zählte
// „de — gemessen 30 belegte Einzelbuchstaben", „en — 26", „nl — 31". Erst danach diese Zeilen.
const EINBUCHSTABIG: ReadonlyMap<string, { readonly belegt: number; readonly satz: string }> =
  new Map([
    [
      "de",
      {
        belegt: 30,
        satz:
          "30 Buchstaben stehen im deutschen Korpus — auf jeden einzelnen antwortet `searchKlara` " +
          "ehrlich leer, obwohl er tausendfach vorkommt. Das ist die Schwelle, nicht der Text.",
      },
    ],
    ["en", { belegt: 26, satz: "26 Buchstaben im englischen Korpus, ebenfalls alle stumm." }],
    ["nl", { belegt: 31, satz: "31 Buchstaben im niederländischen Korpus, ebenfalls alle stumm." }],
  ]);

// ================================================================================================
// L5 · DIE GRÖSSE DER FAQ-LÜCKE.
// ================================================================================================
//
// `allFaqEntries:204-207` gibt für jede Sprache, die nicht mit `de` beginnt, `[]` zurück. Das ist
// das ehrliche Sprach-Gate und BLEIBT so — es wird hier gemessen, nicht angegriffen. Gemessen wird
// nur seine GRÖSSE: um so viele Einträge ist die KI-Grundlage außerhalb von Deutsch kleiner.
// Schlüssel: Sprache → Zahl der FAQ-Einträge. GEMESSEN am Basisstand ece535ba (Cloud-Lauf
// 6e761b1c), nicht gesetzt. DIE ZAHL, um die es geht: 77 gegen 0. Um 77 Einträge ist Klaras
// Antwortgrundlage außerhalb von Deutsch kleiner — das sind mehr Einträge, als die fünf
// Verschmelzen-Synonyme zusammen in DE tragen (2). Die 77 ist zugleich der Wert, den der
// Bestandsfall `tests/help/klara-registry.test.ts:109` als Untergrenze für `de` hält.
const FAQ: ReadonlyMap<string, number> = new Map<string, number>([
  ["de", 77],
  ["en", 0],
  ["nl", 0],
]);

// ================================================================================================
// DIE FÄLLE
// ================================================================================================

describe("JOB 3898 · L1 · die geführten Sprachen kommen aus dem Produkt", () => {
  it("L1 · `i18n.options.resources` nennt mindestens eine Sprache, und `de` ist darunter", () => {
    // Ohne diese zwei Zusicherungen wäre der ganze Auftrag leer erfüllbar: eine leere Sprachliste
    // ließe jede Schleife unten null Mal laufen und trotzdem grün enden.
    expect(
      SPRACHEN.length,
      "`i18n.options.resources` ist leer — dann misst keine einzige Sprachschleife dieser Datei etwas",
    ).toBeGreaterThan(0);
    expect(
      SPRACHEN,
      "`de` fehlt in den geführten Sprachen — DE ist der Maßstab, gegen den alle anderen gemessen werden",
    ).toContain("de");
    // Jede genannte Sprache trägt auch wirklich ein Wörterbuch; ein leerer Eintrag wäre eine
    // Sprache auf dem Papier.
    const leer = SPRACHEN.filter(
      (s) =>
        Object.keys(
          (i18n.options.resources as Record<string, Record<string, unknown>>)[s]?.translation ?? {},
        ).length === 0,
    );
    expect(
      leer,
      `diese Sprachen stehen in den Ressourcen, tragen aber kein Wörterbuch: ${leer}`,
    ).toEqual([]);
    console.log(
      `JOB 3898 · L1 · geführte Sprachen aus dem Produkt: ${SPRACHEN.join(", ")} (${SPRACHEN.length})`,
    );
  });
});

describe("JOB 3898 · L2 · die Synonymkarte, sprachweise vermessen", () => {
  it("L2a · jeder Zielstamm ist je Sprache beziffert — und die Zahl hält", async () => {
    const gemessen = new Map<string, number>();
    const bericht: string[] = [];
    for (const sprache of SPRACHEN) {
      const texte = korpusTexte(await aufgeloest(sprache));
      for (const { schluessel, stamm } of synonymPaare()) {
        const zeile = `${sprache} → ${stamm}`;
        // Kein Kettensynonym: die Mechanik löst genau EINE Stufe auf (`klaraRegistry.ts:303`).
        // Wäre ein Zielstamm selbst ein Schlüssel, misse dieser Fall sein Synonym statt des Stamms.
        expect(
          Object.hasOwn(KLARA_SYNONYMS, stamm),
          `${sprache}: „${schluessel}" → „${stamm}" — der Zielstamm ist selbst ein Schlüssel der Karte: Kettensynonym, das die Suche nie auflöst`,
        ).toBe(false);
        // Genau der Vergleich, den die Suche zur Laufzeit anstellt: ROHER Kartenwert im
        // normalisierten Titel+Text (JOB 3798, Korrekturpflicht 2).
        const zahl = texte.filter((h) => h.includes(stamm)).length;
        gemessen.set(zeile, zahl);
        bericht.push(`${zeile.padEnd(22)} ${String(zahl).padStart(3)}  (Schlüssel: ${schluessel})`);
      }
    }
    console.log(
      `JOB 3898 · L2a · Zielstamm × Sprache, gemessen an den echten aufgelösten Einträgen:\n${[
        ...new Set(bericht),
      ].join("\n")}`,
    );

    // Schranke 1: kein gemessenes Paar ohne Pin.
    const ungepinnt: string[] = [];
    const verletzt: string[] = [];
    for (const sprache of SPRACHEN) {
      for (const { schluessel, stamm } of synonymPaare()) {
        const zeile = `${sprache} → ${stamm}`;
        const zahl = gemessen.get(zeile) as number;
        const pin = TRAGKRAFT.get(zeile);
        if (pin === undefined) {
          ungepinnt.push(
            `${zeile} (Schlüssel „${schluessel}") — gemessen ${zahl}, aber in TRAGKRAFT steht keine Zeile: ungezählte Wirkung, die niemand geprüft hat`,
          );
          continue;
        }
        if (pin.zahl === 0 && zahl !== 0) {
          verletzt.push(
            `${zeile} (Schlüssel „${schluessel}") — gepinnt als TOT (0), trägt jetzt aber ${zahl} Einträge: die Zeile gehört nachgeführt, sonst verwaltet das Register Gespenster`,
          );
        }
        if (pin.zahl > 0 && zahl < pin.zahl) {
          verletzt.push(
            `${zeile} (Schlüssel „${schluessel}") — gepinnt waren ${pin.zahl} tragende Einträge, gemessen sind es ${zahl}: Klaras Toleranz für „${schluessel}" ist in „${sprache}" geschrumpft`,
          );
        }
      }
    }
    expect(ungepinnt, `ungepinnte Paare:\n  ${ungepinnt.join("\n  ")}`).toEqual([]);
    expect(
      verletzt,
      `die gemessene Tragkraft weicht vom Pin ab:\n  ${verletzt.join("\n  ")}`,
    ).toEqual([]);

    // Schranke 2: kein Pin ohne Messung (Gespenster in der anderen Richtung).
    const gespenster = [...TRAGKRAFT.keys()].filter((k) => !gemessen.has(k));
    expect(
      gespenster,
      `diese Zeilen stehen in TRAGKRAFT, werden aber von keiner Messung mehr getroffen — sie gehören gelöscht:\n  ${gespenster.join("\n  ")}`,
    ).toEqual([]);

    // Der Fall misst wirklich etwas: die Karte ist nicht leer, und jede Sprache kam dran.
    expect(Object.keys(KLARA_SYNONYMS).length, "`KLARA_SYNONYMS` ist leer").toBeGreaterThanOrEqual(
      12,
    );
    expect(
      new Set([...gemessen.keys()].map((k) => k.split(" → ")[0])).size,
      "nicht jede geführte Sprache wurde vermessen",
    ).toBe(SPRACHEN.length);
  });

  it("L2b · die Nachbildung der Normalisierung entspricht der echten Suche (Kalibrierung)", async () => {
    // Ohne diesen Fall könnte `wieImText` von `normalizeForSearch` abdriften und L2a leise falsch
    // zählen. Verglichen wird nur dort, wo der Vergleich zulässig ist: der Stamm darf durch die
    // ANFRAGE-Normalisierung nicht verändert werden, und er darf kein Kettensynonym sein.
    let geprueft = 0;
    for (const sprache of SPRACHEN) {
      const eintraege = await aufgeloest(sprache);
      const texte = korpusTexte(eintraege);
      for (const { schluessel, stamm } of synonymPaare()) {
        if (stamm !== wieImText(stamm) || Object.hasOwn(KLARA_SYNONYMS, stamm)) {
          continue;
        }
        expect(
          texte.some((h) => h.includes(stamm)),
          `${sprache}: „${schluessel}" → „${stamm}" — die hier nachgebildete Normalisierung weicht von \`searchKlara\` ab`,
        ).toBe(searchKlara(eintraege, stamm).length > 0);
        geprueft += 1;
      }
    }
    expect(geprueft, "die Kalibrierung hat kein einziges Paar verglichen").toBeGreaterThan(0);
    console.log(`JOB 3898 · L2b · ${geprueft} Stamm-Sprach-Paare gegen die echte Suche kalibriert`);
  });
});

describe("JOB 3898 · L3 · das Ranking selbst, in jeder Sprache am selben Maßstab", () => {
  it("L3a · dieselbe fachliche Frage je Sprache: Trefferzahl, `limit`, erwartete Route", async () => {
    const gemessen = new Map<string, Rangbefund>();
    const bericht: string[] = [];
    const ohneRahmen: string[] = [];
    for (const sprache of SPRACHEN) {
      const eintraege = await aufgeloest(sprache);
      const label = i18n.t("nav.validation");
      expect(
        label,
        `${sprache}: \`nav.validation\` löst nicht auf — ohne das eigene Wort dieser Sprache wäre die Frage unten sinnlos`,
      ).not.toBe("nav.validation");
      const rahmen = FRAGERAHMEN.get(sprache);
      if (rahmen === undefined) {
        ohneRahmen.push(sprache);
      }
      const frage = (rahmen ?? ((l: string) => l))(label);
      const rangliste = rankKlara(eintraege, frage, LIMIT_FUNKTION);
      // DIESELBE Frage, derselbe Bestand, nur ohne Deckel: so viele Einträge holen überhaupt einen
      // Punkt. Der Deckel darf die Aussage nicht machen (siehe Kommentar an `Rangbefund`).
      const ohneDeckel = rankKlara(eintraege, frage, eintraege.length);
      const befund = {
        treffer: rangliste.length,
        ungeschnitten: ohneDeckel.length,
        // Die dritte Zahl: was der Punktfilter (`klaraRegistry.ts:308`) wegwirft.
        abgelehnt: eintraege.length - ohneDeckel.length,
        hatValidierung: rangliste.some((e) => e.route === VALIDIERUNGSROUTE),
        satz: "",
      };
      gemessen.set(sprache, befund);
      bericht.push(
        `${sprache}: „${frage}" → ${befund.treffer} von ${befund.ungeschnitten} punktenden Einträgen (Korpus ${eintraege.length}, abgelehnt ${befund.abgelehnt}), ${VALIDIERUNGSROUTE} ${
          befund.hatValidierung ? "DABEI" : "NICHT dabei"
        } [${rangliste.map((e) => e.id).join(", ")}]`,
      );
      // DAS RANKING MUSS AUSWÄHLEN — sonst ist es kein Ranking. Fällt der Punktfilter in
      // `klaraRegistry.ts:308` (`s.score > 0` → `>= 0`), kommt der ganze Korpus zurück, jede
      // Sprache sieht gleich breit aus und der Befund dieses Auftrags verschwindet lautlos. Genau
      // das ist in Runde 1 passiert, ohne dass ein Fall rot wurde.
      expect(
        befund.ungeschnitten,
        `${sprache}: \`rankKlara\` gibt ALLE ${eintraege.length} Einträge des Korpus zurück — es wählt also gar nicht mehr aus. Der Punktfilter in \`klaraRegistry.ts:308\` ist gefallen; jeder Sprachvergleich dieser Datei wäre damit bedeutungslos`,
      ).toBeLessThan(eintraege.length);
      // Der Deckel schneidet wirklich, und er schneidet nicht mehr weg, als er darf.
      expect(
        befund.ungeschnitten,
        `${sprache}: ohne Deckel kommen weniger Einträge zurück als mit — \`limit\` in \`klaraRegistry.ts:310\` schneidet verkehrt herum`,
      ).toBeGreaterThanOrEqual(befund.treffer);
      // Das `limit` gilt in JEDER Sprache (`klaraRegistry.ts:310`) — sonst bekäme die KI in einer
      // Sprache mehr Grundlage mit, als der Aufrufer angefordert hat.
      expect(
        befund.treffer,
        `${sprache}: \`rankKlara\` liefert ${befund.treffer} Einträge, obwohl \`limit\` ${LIMIT_FUNKTION} ist`,
      ).toBeLessThanOrEqual(LIMIT_FUNKTION);
    }
    console.log(
      `JOB 3898 · L3a · FUNKTIONSMESSUNG, Ranking je Sprache (Gegenstand Validierungsweg, Registry OHNE FAQ, limit ${LIMIT_FUNKTION} = Vorgabewert der Funktion, NICHT der des Panels):\n${bericht.join("\n")}`,
    );
    if (ohneRahmen.length > 0) {
      console.log(
        `JOB 3898 · L3a · ohne eigenen Fragerahmen gefahren (blankes Label, misst weniger): ${ohneRahmen.join(", ")}`,
      );
    }

    const ungepinnt: string[] = [];
    const verletzt: string[] = [];
    for (const sprache of SPRACHEN) {
      const ist = gemessen.get(sprache) as Rangbefund;
      const pin = RANG.get(sprache);
      if (pin === undefined) {
        ungepinnt.push(
          `${sprache} — gemessen ${ist.treffer} von ${ist.ungeschnitten} punktenden Einträgen, abgelehnt ${ist.abgelehnt}, ${VALIDIERUNGSROUTE} ${
            ist.hatValidierung ? "dabei" : "nicht dabei"
          }, aber in RANG steht keine Zeile`,
        );
        continue;
      }
      expect(pin.satz.length, `${sprache}: der Pin in RANG trägt keinen Satz`).toBeGreaterThan(20);
      // Ein Pin von 0 abgelehnten Einträgen bewachte nichts: er wäre auch dann erfüllt, wenn der
      // Punktfilter gefallen ist. Er MUSS aus einer echten Messung stammen.
      expect(
        pin.abgelehnt,
        `${sprache}: der Pin in RANG sagt, der Punktfilter werfe 0 Einträge weg — dann bewacht er den Filter nicht. Die Zahl gehört gemessen (sie steht im L3a-Protokoll dieses Laufs) und eingetragen`,
      ).toBeGreaterThan(0);
      if (ist.abgelehnt < pin.abgelehnt) {
        verletzt.push(
          `${sprache} — gepinnt waren ${pin.abgelehnt} vom Punktfilter abgelehnte Einträge, gemessen sind es ${ist.abgelehnt}: \`rankKlara\` siebt weniger aus als zugesichert. Die Auswahl ist damit unschärfer geworden — bei ${ist.abgelehnt} === 0 ist der Filter in \`klaraRegistry.ts:308\` ganz gefallen`,
        );
      }
      if (ist.treffer < pin.treffer) {
        verletzt.push(
          `${sprache} — gepinnt waren ${pin.treffer} an die KI gereichte Einträge, gemessen sind es ${ist.treffer}: Klaras Antwortgrundlage ist in dieser Sprache geschrumpft`,
        );
      }
      if (ist.ungeschnitten < pin.ungeschnitten) {
        verletzt.push(
          `${sprache} — gepinnt waren ${pin.ungeschnitten} punktende Einträge, gemessen sind es ${ist.ungeschnitten}: die AUSWAHL, aus der die besten ${LIMIT_FUNKTION} kommen, ist geschrumpft — das sieht man am gedeckelten Wert nicht`,
        );
      }
      if (ist.hatValidierung !== pin.hatValidierung) {
        verletzt.push(
          `${sprache} — gepinnt war „${VALIDIERUNGSROUTE} ${
            pin.hatValidierung ? "dabei" : "nicht dabei"
          }", gemessen ist „${ist.hatValidierung ? "dabei" : "nicht dabei"}"`,
        );
      }
    }
    expect(ungepinnt, `ungepinnte Sprachen:\n  ${ungepinnt.join("\n  ")}`).toEqual([]);
    expect(
      verletzt,
      `das gemessene Ranking weicht vom Pin ab:\n  ${verletzt.join("\n  ")}`,
    ).toEqual([]);
    const gespenster = [...RANG.keys()].filter((s) => !gemessen.has(s));
    expect(
      gespenster,
      `diese Sprachen stehen in RANG, werden aber nicht mehr geführt:\n  ${gespenster.join("\n  ")}`,
    ).toEqual([]);
  });

  it("L3b · der Abstand zu Deutsch wird an der ungedeckelten Zahl beziffert", async () => {
    // WARUM NICHT AM GEDECKELTEN WERT: der erste Lauf (6e761b1c) meldete für alle drei Sprachen
    // „6 Treffer" und damit „Unterschied 0". Das ist keine Gleichheit, sondern der Deckel. Dieser
    // Fall rechnet deshalb an der Zahl der PUNKTENDEN Einträge und schreibt beide nebeneinander.
    const gedeckelt = new Map<string, number>();
    const offen = new Map<string, number>();
    for (const sprache of SPRACHEN) {
      const eintraege = await aufgeloest(sprache);
      const rahmen = FRAGERAHMEN.get(sprache) ?? ((l: string) => l);
      const frage = rahmen(i18n.t("nav.validation"));
      gedeckelt.set(sprache, rankKlara(eintraege, frage, LIMIT_FUNKTION).length);
      offen.set(sprache, rankKlara(eintraege, frage, eintraege.length).length);
    }
    const deOffen = offen.get("de") as number;
    const zeilen = SPRACHEN.filter((s) => s !== "de").map((s) => {
      const n = offen.get(s) as number;
      return `${s}: ${n} punktende Einträge gegen ${deOffen} in de → Unterschied ${n - deOffen} (gedeckelt auf ${LIMIT_FUNKTION}: ${gedeckelt.get(s)} gegen ${gedeckelt.get("de")}, Unterschied ${(gedeckelt.get(s) as number) - (gedeckelt.get("de") as number)})`;
    });
    console.log(`JOB 3898 · L3b · Abstand zum deutschen Maßstab:\n${zeilen.join("\n")}`);
    expect(
      deOffen,
      "in `de` punktet kein einziger Eintrag — dann gibt es keinen Maßstab",
    ).toBeGreaterThan(0);
    expect(offen.size, "nicht jede geführte Sprache wurde gemessen").toBe(SPRACHEN.length);

    // DER ABSTAND IST JETZT ZUGESICHERT, nicht nur ausgerechnet (BEN, Korrekturpflicht 1). Bis
    // Runde 1 stand er ausschließlich im Protokoll — und ein Protokoll hält nichts fest.
    const ungepinnt: string[] = [];
    const verletzt: string[] = [];
    for (const sprache of SPRACHEN.filter((s) => s !== "de")) {
      const ist = deOffen - (offen.get(sprache) as number);
      const pin = ABSTAND.get(sprache);
      if (pin === undefined) {
        ungepinnt.push(
          `${sprache} — gemessener Abstand ${ist} punktende Einträge weniger als de (${offen.get(sprache)} gegen ${deOffen}), aber in ABSTAND steht keine Zeile`,
        );
        continue;
      }
      expect(
        pin.mindestens,
        `${sprache}: der Pin in ABSTAND ist 0 — ein Abstand von null ist genau der Zustand, den BENs Verstellung \`s.score >= 0\` erzeugt hat; als Zusicherung taugt er nicht`,
      ).toBeGreaterThan(0);
      if (ist < pin.mindestens) {
        verletzt.push(
          `${sprache} — gepinnt war ein Abstand von mindestens ${pin.mindestens} punktenden Einträgen zu de, gemessen sind es ${ist} (${offen.get(sprache)} gegen ${deOffen}). Entweder ist die Lücke geschlossen worden — dann gehört der Pin nachgeführt und der Befund dieses Auftrags neu geschrieben — oder \`rankKlara\` siebt nicht mehr aus (\`klaraRegistry.ts:308\`) und alle Sprachen sehen nur noch gleich aus`,
        );
      }
    }
    expect(ungepinnt, `ungepinnte Sprachabstände:\n  ${ungepinnt.join("\n  ")}`).toEqual([]);
    expect(
      verletzt,
      `der gemessene Sprachabstand weicht vom Pin ab:\n  ${verletzt.join("\n  ")}`,
    ).toEqual([]);
    const abstandGespenster = [...ABSTAND.keys()].filter((s) => !SPRACHEN.includes(s));
    expect(
      abstandGespenster,
      `Sprachen in ABSTAND, die nicht mehr geführt werden: ${abstandGespenster}`,
    ).toEqual([]);
    // Und die zwei Zahlen sind wirklich zwei: wäre der Deckel nie wirksam, sagte L3b nichts, was
    // L3a nicht schon sagt. Gemessen am Basisstand greift er in jeder Sprache.
    const gedeckeltWirksam = SPRACHEN.filter(
      (s) => (offen.get(s) as number) > (gedeckelt.get(s) as number),
    );
    expect(
      gedeckeltWirksam,
      `in diesen Sprachen greift der Deckel gar nicht — dann verdeckt er auch nichts, und die Begründung dieses Falls ist überholt: ${SPRACHEN.filter((s) => !gedeckeltWirksam.includes(s)).join(", ")}`,
    ).toEqual([...SPRACHEN]);
  });

  it("L3c · mit den Parametern des echten Aufrufers: `limit` 12 und Korpus MIT FAQ", async () => {
    // DIE EINZIGEN ZAHLEN DIESER DATEI, die „so viel bekommt die KI im Panel" sagen dürfen.
    // Aufrufer: `apps/web/src/components/KlaraAssistant.tsx:298` — `rankKlara(resolved, question, 12)`
    // mit `resolved` = aufgelöste Registry + `allFaqEntries(i18n.language)` (`:266-272`).
    const gemessen = new Map<string, Panelbefund>();
    const bericht: string[] = [];
    for (const sprache of SPRACHEN) {
      const eintraege = await aufgeloest(sprache);
      // Genau der Korpus des Aufrufers — die FAQ gehört dazu, und dass sie außerhalb von `de` leer
      // ist (L5), ist Teil des Befundes und nicht etwas, das dieser Fall wegdefinieren darf.
      const korpus = [...eintraege, ...allFaqEntries(sprache)];
      const frage = (FRAGERAHMEN.get(sprache) ?? ((l: string) => l))(i18n.t("nav.validation"));
      const rangliste = rankKlara(korpus, frage, LIMIT_PANEL);
      const befund = {
        treffer: rangliste.length,
        ungeschnitten: rankKlara(korpus, frage, korpus.length).length,
        ausFaq: rangliste.filter((e) => e.id.startsWith("faq:")).length,
        satz: "",
      };
      gemessen.set(sprache, befund);
      bericht.push(
        `${sprache}: Korpus ${korpus.length} (davon ${allFaqEntries(sprache).length} FAQ) → ${befund.treffer} von ${befund.ungeschnitten} punktenden Einträgen gehen an die KI, davon ${befund.ausFaq} aus der FAQ`,
      );
      expect(
        befund.treffer,
        `${sprache}: \`rankKlara\` liefert ${befund.treffer} Einträge, obwohl der Aufrufer \`limit\` ${LIMIT_PANEL} setzt (\`KlaraAssistant.tsx:298\`)`,
      ).toBeLessThanOrEqual(LIMIT_PANEL);
      expect(
        befund.ungeschnitten,
        `${sprache}: \`rankKlara\` gibt den ganzen Aufruferkorpus (${korpus.length}) zurück — der Punktfilter \`klaraRegistry.ts:308\` wählt nicht mehr aus`,
      ).toBeLessThan(korpus.length);
    }
    console.log(
      `JOB 3898 · L3c · AUFRUFERMESSUNG (KlaraAssistant.tsx:298, limit ${LIMIT_PANEL}, Korpus MIT FAQ):\n${bericht.join("\n")}`,
    );

    const ungepinnt: string[] = [];
    const verletzt: string[] = [];
    for (const sprache of SPRACHEN) {
      const ist = gemessen.get(sprache) as Panelbefund;
      const pin = PANEL.get(sprache);
      if (pin === undefined) {
        ungepinnt.push(
          `${sprache} — gemessen ${ist.treffer} von ${ist.ungeschnitten} punktenden Einträgen, davon ${ist.ausFaq} aus der FAQ, aber in PANEL steht keine Zeile`,
        );
        continue;
      }
      expect(pin.satz.length, `${sprache}: der Pin in PANEL trägt keinen Satz`).toBeGreaterThan(20);
      if (ist.treffer < pin.treffer) {
        verletzt.push(
          `${sprache} — gepinnt waren ${pin.treffer} an die KI gereichte Einträge, gemessen sind es ${ist.treffer}: die Antwortgrundlage des Panels ist in dieser Sprache geschrumpft`,
        );
      }
      if (ist.ungeschnitten < pin.ungeschnitten) {
        verletzt.push(
          `${sprache} — gepinnt waren ${pin.ungeschnitten} punktende Einträge im Aufruferkorpus, gemessen sind es ${ist.ungeschnitten}`,
        );
      }
      // Die FAQ-Zahl ist EXAKT gepinnt, in beide Richtungen: außerhalb von `de` ist sie 0, weil das
      // Sprach-Gate greift; in `de` ist sie der sichtbare Anteil, den die anderen Sprachen nicht
      // bekommen. Wächst oder fällt sie, ist das ein Befund und keine Schwankung.
      if (ist.ausFaq !== pin.ausFaq) {
        verletzt.push(
          `${sprache} — gepinnt waren ${pin.ausFaq} FAQ-Einträge in der KI-Grundlage des Panels, gemessen sind es ${ist.ausFaq}: ${
            pin.ausFaq === 0
              ? "das Sprach-Gate (`klaraRegistry.ts:205`) hält die FAQ hier nicht mehr draußen"
              : "der Anteil, den nur Deutsch bekommt, hat sich verschoben"
          }`,
        );
      }
    }
    expect(ungepinnt, `ungepinnte Sprachen in PANEL:\n  ${ungepinnt.join("\n  ")}`).toEqual([]);
    expect(verletzt, `die Aufrufermessung weicht vom Pin ab:\n  ${verletzt.join("\n  ")}`).toEqual(
      [],
    );
    const gespenster = [...PANEL.keys()].filter((s) => !gemessen.has(s));
    expect(gespenster, `Sprachen in PANEL, die nicht mehr geführt werden: ${gespenster}`).toEqual(
      [],
    );

    // UND DER UNTERSCHIED ZUR FUNKTIONSMESSUNG, ausdrücklich: das Panel deckelt bei 12, die
    // Funktion bei 6. Wäre das gleich, hätte die ganze Unterscheidung oben keinen Gegenstand — und
    // Runde 1 hätte mit ihren sechs Einträgen zufällig recht gehabt.
    expect(
      LIMIT_PANEL,
      "`KlaraAssistant.tsx:298` und der Vorgabewert `klaraRegistry.ts:292` sind gleich geworden — dann ist die Unterscheidung im Kopfkommentar überholt und gehört umgeschrieben",
    ).not.toBe(LIMIT_FUNKTION);
  });
});

describe("JOB 3898 · L4 · die Wortlängen-Asymmetrie zwischen Suche und Ranking", () => {
  it("L4 · ein zweibuchstabiges Wort findet die Suche, das Ranking nie", async () => {
    const gemessen = new Map<string, Kurzwortbefund>();
    const bericht: string[] = [];
    for (const sprache of SPRACHEN) {
      const eintraege = await aufgeloest(sprache);
      // Die Kandidaten kommen aus dem KORPUS selbst, nicht aus einer erfundenen Liste: so bleibt
      // der Fall richtig, wenn sich die Texte ändern.
      const kandidaten = [
        ...new Set(
          korpusTexte(eintraege)
            .flatMap((h) => h.split(" "))
            .filter((w) => w.length === 2),
        ),
      ].sort();
      const gefunden = kandidaten.filter((w) => searchKlara(eintraege, w).length > 0);
      // KALIBRIERUNG: ohne einen einzigen Kandidaten wäre die Zusicherung darunter leer erfüllt.
      expect(
        gefunden.length,
        `${sprache}: kein einziges zweibuchstabiges Wort des Korpus wird von \`searchKlara\` gefunden — dann misst dieser Fall nichts`,
      ).toBeGreaterThan(0);
      // DIE ZUSICHERUNG: was die Suche ab Länge 2 findet (`klaraRegistry.ts:272`), wirft das
      // Ranking ab Länge 3 weg (`:295`) — und liefert deshalb EHRLICH leer, nicht irgendetwas.
      const durchgerutscht = gefunden.filter(
        (w) => rankKlara(eintraege, w, LIMIT_FUNKTION).length > 0,
      );
      expect(
        durchgerutscht,
        `${sprache}: \`rankKlara\` liefert für diese ZWEIBUCHSTABIGEN Wörter Treffer — die Wortlängen-Schwelle in \`klaraRegistry.ts:295\` (\`tok.length > 2\`) ist verstellt worden: ${durchgerutscht.join(", ")}`,
      ).toEqual([]);
      const befund = { kandidaten: kandidaten.length, gefunden: gefunden.length };
      gemessen.set(sprache, befund);
      // Ein Beispiel aus BUCHSTABEN für den Bericht: der erste Lauf nannte „30" — richtig gemessen,
      // aber als Beleg wertlos, weil eine Jahreszahl niemandem zeigt, dass ein INHALTSWORT verloren
      // geht. Fällt kein reines Buchstabenwort an, wird das gesagt statt gerundet.
      const wortbeispiel = gefunden.find((w) => /^\p{L}+$/u.test(w));
      bericht.push(
        `${sprache}: ${befund.kandidaten} zweibuchstabige Wörter im Korpus, davon ${befund.gefunden} von searchKlara gefunden, von rankKlara 0 — Beispielwort „${wortbeispiel ?? "(keins aus reinen Buchstaben)"}"`,
      );
    }
    console.log(`JOB 3898 · L4 · Wortlängen-Asymmetrie je Sprache:\n${bericht.join("\n")}`);

    // DIE ANDERE SEITE DER GRENZE, damit der Fall nicht bloß einen kaputten Korpus misst: ein
    // DREIbuchstabiges Wort desselben Korpus kommt bei BEIDEN durch. Ohne diese Gegenrichtung wäre
    // „rankKlara liefert nichts" auch dann grün, wenn `rankKlara` gar nichts mehr fände.
    for (const sprache of SPRACHEN) {
      const eintraege = await aufgeloest(sprache);
      const drei = [
        ...new Set(
          korpusTexte(eintraege)
            .flatMap((h) => h.split(" "))
            .filter((w) => w.length === 3),
        ),
      ]
        .sort()
        .filter((w) => searchKlara(eintraege, w).length > 0);
      expect(
        drei.length,
        `${sprache}: kein dreibuchstabiges Wort des Korpus wird gefunden — die Gegenrichtung misst nichts`,
      ).toBeGreaterThan(0);
      const stumm = drei.filter((w) => rankKlara(eintraege, w, LIMIT_FUNKTION).length === 0);
      expect(
        stumm,
        `${sprache}: diese DREIbuchstabigen Wörter findet die Suche, das Ranking aber nicht — die Schwelle in \`klaraRegistry.ts:295\` ist über 3 gewandert: ${stumm.join(", ")}`,
      ).toEqual([]);
    }

    const ungepinnt: string[] = [];
    const verletzt: string[] = [];
    for (const sprache of SPRACHEN) {
      const ist = gemessen.get(sprache) as Kurzwortbefund;
      const pin = KURZWORT.get(sprache);
      if (pin === undefined) {
        ungepinnt.push(
          `${sprache} — gemessen ${ist.kandidaten} Kandidaten, davon ${ist.gefunden} gefunden, kein Pin`,
        );
        continue;
      }
      if (ist.kandidaten < pin.kandidaten) {
        verletzt.push(
          `${sprache} — gepinnt waren ${pin.kandidaten} zweibuchstabige Wörter im Korpus, gemessen sind es ${ist.kandidaten}: die Schrumpfung kommt vom TEXT, nicht von der Schwelle`,
        );
      }
      if (ist.gefunden < pin.gefunden) {
        verletzt.push(
          `${sprache} — gepinnt waren ${pin.gefunden} von der Suche gefundene Kurzwörter, gemessen sind es ${ist.gefunden}: die Schwelle in \`klaraRegistry.ts:272\` (\`tok.length > 1\`) ist verstellt worden`,
        );
      }
    }
    expect(ungepinnt, `ungepinnte Sprachen:\n  ${ungepinnt.join("\n  ")}`).toEqual([]);
    expect(verletzt, `die Kurzwortmessung weicht vom Pin ab:\n  ${verletzt.join("\n  ")}`).toEqual(
      [],
    );
  });

  it("L4b · ein EINbuchstabiges Wort findet auch die Suche nicht — die untere Kante der Schwelle", async () => {
    // WARUM ES DIESEN FALL GIBT (BEN, Runde 1, Korrekturpflicht 2): L4 bewacht die Kante des
    // RANKINGS. Die Kante der SUCHE war offen — BEN hat `klaraRegistry.ts:272` von `tok.length > 1`
    // auf `> 0` gestellt, und kein Fall dieser Datei hat es gemerkt, weil keiner je EIN Zeichen
    // angefragt hat. Ab hier ist beides zu: `searchKlara` muss auf jede einbuchstabige Anfrage
    // EHRLICH LEER antworten (`:272-275`: keine Token übrig → `[]`), und `rankKlara` erst recht
    // (`:295-298`).
    const gemessen = new Map<string, number>();
    const bericht: string[] = [];
    for (const sprache of SPRACHEN) {
      const eintraege = await aufgeloest(sprache);
      const texte = korpusTexte(eintraege);
      // KALIBRIERUNG ZUERST — sonst prüfte dieser Fall den Text statt die Schwelle. Genommen wird
      // nur, was als Teilkette WIRKLICH im Korpus steht: dann und nur dann beweist das Schweigen
      // der Suche, dass die Schwelle greift, und nicht bloß, dass der Buchstabe fehlt. Genau diese
      // Buchstaben liefert die gesenkte Schwelle `> 0` als Treffer zurück.
      const belegt = [
        ...new Set(
          texte
            .flatMap((h) => [...h])
            .filter((z) => /\p{L}/u.test(z))
            .map((z) => z.toLowerCase()),
        ),
      ]
        .sort()
        .filter((z) => texte.some((h) => h.includes(z)));
      expect(
        belegt.length,
        `${sprache}: kein einziger Buchstabe kommt im Korpus vor — dann sagt das Schweigen der Suche nichts über die Schwelle aus`,
      ).toBeGreaterThan(0);

      // DIE ZUSICHERUNG: belegter Buchstabe, trotzdem null Treffer — das ist die Schwelle, nicht
      // der Text.
      const gefundenTrotzEinemZeichen = belegt.filter((z) => searchKlara(eintraege, z).length > 0);
      expect(
        gefundenTrotzEinemZeichen,
        `${sprache}: \`searchKlara\` liefert für diese EINbuchstabigen Anfragen Treffer — die Wortlängen-Schwelle in \`klaraRegistry.ts:272\` (\`tok.length > 1\`) ist verstellt worden. Für den Nutzer hieße das: ein einzelner Tippbuchstabe im Suchfeld schüttet ihm den halben Katalog aus: ${gefundenTrotzEinemZeichen.join(", ")}`,
      ).toEqual([]);
      const gerankt = belegt.filter((z) => rankKlara(eintraege, z, LIMIT_FUNKTION).length > 0);
      expect(
        gerankt,
        `${sprache}: \`rankKlara\` liefert für diese EINbuchstabigen Anfragen Treffer — die Schwelle in \`klaraRegistry.ts:295\` ist verstellt worden: ${gerankt.join(", ")}`,
      ).toEqual([]);

      gemessen.set(sprache, belegt.length);
      bericht.push(
        `${sprache}: ${belegt.length} im Korpus belegte Einzelbuchstaben, davon von searchKlara gefunden 0, von rankKlara 0 — Beispiel „${belegt[0]}"`,
      );
    }
    console.log(
      `JOB 3898 · L4b · untere Kante der Suchschwelle (1 Zeichen) je Sprache:\n${bericht.join("\n")}`,
    );

    const ungepinnt: string[] = [];
    const verletzt: string[] = [];
    for (const sprache of SPRACHEN) {
      const ist = gemessen.get(sprache) as number;
      const pin = EINBUCHSTABIG.get(sprache);
      if (pin === undefined) {
        ungepinnt.push(`${sprache} — gemessen ${ist} belegte Einzelbuchstaben, kein Pin`);
        continue;
      }
      if (ist < pin.belegt) {
        verletzt.push(
          `${sprache} — gepinnt waren ${pin.belegt} im Korpus belegte Einzelbuchstaben, gemessen sind es ${ist}: die Kalibrierung dieses Falls stützt sich auf weniger Buchstaben als zugesichert`,
        );
      }
    }
    expect(ungepinnt, `ungepinnte Sprachen in EINBUCHSTABIG:\n  ${ungepinnt.join("\n  ")}`).toEqual(
      [],
    );
    expect(
      verletzt,
      `die Einbuchstaben-Kalibrierung weicht vom Pin ab:\n  ${verletzt.join("\n  ")}`,
    ).toEqual([]);
    const gespenster = [...EINBUCHSTABIG.keys()].filter((s) => !gemessen.has(s));
    expect(
      gespenster,
      `Sprachen in EINBUCHSTABIG, die nicht mehr geführt werden: ${gespenster}`,
    ).toEqual([]);
  });
});

describe("JOB 3898 · L5 · die Größe der FAQ-Lücke außerhalb von Deutsch", () => {
  it("L5 · je Sprache beziffert, um wie viele Einträge die KI-Grundlage kleiner ist", async () => {
    const gemessen = new Map<string, number>();
    for (const sprache of SPRACHEN) {
      gemessen.set(sprache, allFaqEntries(sprache).length);
    }
    const de = gemessen.get("de") as number;
    const zeilen = SPRACHEN.map(
      (s) =>
        `${s}: ${gemessen.get(s)} FAQ-Einträge → Lücke gegenüber de: ${de - (gemessen.get(s) as number)}`,
    );
    console.log(
      `JOB 3898 · L5 · FAQ als Antwortgrundlage (Sprach-Gate \`klaraRegistry.ts:204-207\`):\n${zeilen.join("\n")}`,
    );

    const ungepinnt: string[] = [];
    const verletzt: string[] = [];
    for (const sprache of SPRACHEN) {
      const ist = gemessen.get(sprache) as number;
      const pin = FAQ.get(sprache);
      if (pin === undefined) {
        ungepinnt.push(`${sprache} — gemessen ${ist} FAQ-Einträge, kein Pin`);
        continue;
      }
      if (pin === 0 && ist !== 0) {
        verletzt.push(
          `${sprache} — gepinnt war die LEERE FAQ (das ehrliche Sprach-Gate, \`klaraRegistry.ts:205\`), geliefert werden ${ist} Einträge: entweder ist das Gate gefallen oder die Übersetzung ist da; beides gehört nachgeführt, nicht stillschweigend geduldet`,
        );
      }
      if (pin > 0 && ist < pin) {
        verletzt.push(
          `${sprache} — gepinnt waren ${pin} FAQ-Einträge, geliefert werden ${ist}: Klaras Antwortgrundlage ist geschrumpft`,
        );
      }
    }
    expect(ungepinnt, `ungepinnte Sprachen:\n  ${ungepinnt.join("\n  ")}`).toEqual([]);
    expect(verletzt, `die FAQ-Messung weicht vom Pin ab:\n  ${verletzt.join("\n  ")}`).toEqual([]);
    const gespenster = [...FAQ.keys()].filter((s) => !gemessen.has(s));
    expect(gespenster, `Sprachen in FAQ, die nicht mehr geführt werden: ${gespenster}`).toEqual([]);
  });

  it("L5b · was die Lücke dem Nutzer kostet: eine reine FAQ-Frage trägt nur in Deutsch", async () => {
    // „ChatGPT" steht NUR in der FAQ (Beleg: `tests/help/klara-registry.test.ts:119-126`). Die Frage
    // darum herum ist damit der schärfste Fall: in Deutsch trägt sie, außerhalb kann sie es nicht.
    //
    // PARAMETER DIESES FALLS, ausdrücklich benannt (BEN, Korrekturpflicht 3): Korpus WIE BEIM
    // AUFRUFER (Registry + FAQ, `KlaraAssistant.tsx:266-272`), `limit` aber der Vorgabewert der
    // Funktion. Gemessen wird hier nur das JA/NEIN — ob überhaupt eine FAQ-Quelle in die Grundlage
    // kommt —, nicht die Menge; die Mengenaussage mit den echten Aufruferparametern steht in L3c.
    const frage = "Was passiert mit meinem Wissen, wenn ich es bei ChatGPT eingebe?";
    const bericht: string[] = [];
    for (const sprache of SPRACHEN) {
      const eintraege = await aufgeloest(sprache);
      const korpus = [...eintraege, ...allFaqEntries(sprache)];
      const ausFaq = rankKlara(korpus, frage, LIMIT_FUNKTION).filter((e) =>
        e.id.startsWith("faq:"),
      );
      bericht.push(`${sprache}: ${ausFaq.length} FAQ-Einträge in der KI-Grundlage`);
      if (sprache.startsWith("de")) {
        expect(
          ausFaq.length,
          `${sprache}: die FAQ trägt nicht mehr zur KI-Grundlage bei — dann misst L5 eine Lücke gegen ein Nichts`,
        ).toBeGreaterThan(0);
      } else {
        expect(
          ausFaq,
          `${sprache}: die FAQ liefert hier Einträge, obwohl das Sprach-Gate (\`klaraRegistry.ts:205\`) sie draußen halten soll`,
        ).toEqual([]);
      }
    }
    console.log(`JOB 3898 · L5b · dieselbe FAQ-Frage je Sprache:\n${bericht.join("\n")}`);
  });
});
