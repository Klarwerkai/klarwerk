// ================================================================================================
// JOB 3061 · H2 — DAS FUNKTIONSINVENTAR: JEDE ZEILE WIRD IN DER GEBAUTEN FLÄCHE ANGEKLICKT.
// ================================================================================================
//
// Pedi 04.09. 07:58: „Stelle 100 % sicher, dass wir keine Funktion verlieren. Orientiere dich an
// Pages, arbeite mit Untermenüs. Behalte die klare Linie bei. Wir haben sehr, sehr viele
// Informationsfunktionen."
//
// Der Auftrag (§5a, §11) verlangt dafür genau diesen Wächter: die Tabelle „heute → neuer Ort"
// steht als DATENLISTE in dieser Datei, und für JEDE Zeile öffnet der Test in Chromium an der
// ECHTEN Anwendung den neuen Ort (Menü klicken, „Mehr" aufklappen) und findet dort das Element.
// Eine fehlende Zeile ist rot — mit ihrem Schlüssel, ihrem alten Ort und ihrem neuen.
//
// WARUM DAS UNVERZICHTBAR IST: Eine Umgestaltung, die aufräumt, verliert Funktionen leise. Nicht
// aus Absicht — sie fallen einfach nicht mehr auf. Ein Sammler, der nur die neue Fläche
// beschreibt, merkt davon nichts; er kennt ja nur, was da ist. Deshalb steht hier die ALTE Liste
// und wird gegen die NEUE Fläche gehalten.
//
// UND WAS ER NICHT IST: Er misst keine Optik (das tut `zielbild-h2-pruefen.test.ts`) und keine
// Wirkung auf dem Server (das tun die gemounteten Tests unter `tests/validation`, `tests/pruefseite`
// und `tests/app`). Er misst ERREICHBARKEIT: ist die Funktion nach höchstens einem Klick da?
import { existsSync, readFileSync, statSync } from "node:fs";
import { createRequire } from "node:module";
import { extname, join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

process.env.KLARWERK_SKIP_KEYCHAIN = "1";

import i18n from "../../apps/web/src/i18n";
import { buildApp, buildServices } from "../../services/app/src/build-app";

const WURZEL = resolve(process.cwd());
const DIST = resolve(WURZEL, "apps/web/dist");
const ORIGIN = "http://klarwerk.test";

/** Der deutsche Wortlaut eines Schlüssels — die Fläche läuft in dieser Probe auf Deutsch. */
const de = (key: string, vars?: Record<string, unknown>): string =>
  vars ? String(i18n.t(key, vars)) : String(i18n.getResource("de", "translation", key));

// ================================================================================================
// DIE TABELLE AUS §5a UND §11 — heute → neuer Ort.
// ================================================================================================
//
//   `ort` sagt, WIE der neue Ort erreicht wird:
//     flaeche  — steht ohne Klick da
//     filter   — im Filter-Menü neben dem Segment
//     hilfe    — im „?"-Menü neben dem Titel
//     menue    — im „···"-Menü der genannten Karte
//     mehr     — im aufklappbaren „Mehr" unter dem Text
//     anlage   — hinter der aufklappbaren Zeile „Anlage geändert …" (Reiter „Erneut", §5b)
//
//   `text` ist ein i18n-SCHLÜSSEL (kein abgeschriebener Satz): ändert jemand den Wortlaut,
//   wandert der Test mit; verschwindet die Funktion, wird er rot.
//
// ------------------------------------------------------------------------------------------------
// DIE SUCHE IST ORTSGEBUNDEN (bens Befund 2 aus Runde 4).
// ------------------------------------------------------------------------------------------------
//
// Bis Runde 4 durchsuchte die Probe `document.body.innerText` — den GANZEN sichtbaren Text der
// Seite. Damit war sie für ihren eigenen Zweck blind: eine Zeile, die behauptet „diese Funktion
// wohnt jetzt im ···-Menü der Duplikatkarte", galt schon dann als erfüllt, wenn ihr Wortlaut
// IRGENDWO auf der Seite stand — im „Mehr", in einer Pille, in einer Fussnote. Genau so blieb
// unbemerkt, dass „duplikat-status" gar nicht im Menü liegt.
//
// Jetzt gibt `OEFFNEN` den Bereich zurück, den es geöffnet hat, und `FINDEN` liest NUR dessen
// Text. Steht der Wortlaut woanders auf der Seite, hilft das der Zeile nicht mehr.
interface Zeile {
  schluessel: string;
  heute: string;
  pfad: string;
  ort: "flaeche" | "filter" | "hilfe" | "menue" | "mehr" | "anlage";
  /** Kennung des „···"-Menüs (nur bei `ort: "menue"`). */
  menue?: string;
  text?: string;
  /** Platzhalter des Schlüssels (z. B. `{{percent}}`) — sonst suchte der Test die Rohform. */
  vars?: Record<string, unknown>;
  /** Alternativ zum Text: ein Element, das existieren muss (Felder, Symbole, Punkte). */
  selektor?: string;
}

const INVENTAR: readonly Zeile[] = [
  // ---- Filter-Menü neben dem Segment ---------------------------------------------------------
  {
    schluessel: "volltext",
    heute: "Validation.tsx:759 Filterleiste",
    pfad: "/validierung",
    ort: "filter",
    selektor: "input[placeholder]",
  },
  {
    schluessel: "wissensart",
    heute: "Validation.tsx:762 Auswahlliste",
    pfad: "/validierung",
    ort: "filter",
    selektor: `select[aria-label="${de("val.filterAllTypes")}"]`,
  },
  {
    schluessel: "kategorie",
    heute: "Validation.tsx:775 Auswahlliste",
    pfad: "/validierung",
    ort: "filter",
    selektor: `select[aria-label="${de("val.filterAllCategories")}"]`,
  },
  {
    schluessel: "tag",
    heute: "Validation.tsx:788 Auswahlliste",
    pfad: "/validierung",
    ort: "filter",
    selektor: `select[aria-label="${de("val.filterAllTags")}"]`,
  },
  {
    schluessel: "review-fokus",
    heute: "Validation.tsx:697-751 Pillenzeile",
    pfad: "/validierung",
    ort: "filter",
    text: "val.reviewFocus.label",
  },
  {
    schluessel: "herkunft",
    heute: "Validation.tsx:666-696 Pillenzeile",
    pfad: "/validierung",
    ort: "filter",
    text: "lib.originLabel",
  },
  {
    schluessel: "mir-zugewiesen",
    heute: "Validation.tsx:810 Kästchen",
    pfad: "/validierung",
    ort: "filter",
    text: "val.filterMine",
  },
  {
    schluessel: "ki-pruefung-laeuft",
    heute: "Validation.tsx:821 Kästchen",
    pfad: "/validierung",
    ort: "filter",
    text: "val.filterAiPending",
  },
  {
    schluessel: "filter-zuruecksetzen",
    heute: "Validation.tsx:746 Zeile „aktive Fokusfilter“",
    pfad: "/validierung",
    ort: "filter",
    text: "val.focusReset",
  },
  {
    schluessel: "facettenschiene",
    heute: "Validation.tsx:586 Dauerspalte links",
    pfad: "/validierung",
    ort: "filter",
    selektor: "aside",
  },

  // ---- „?"-Menü neben dem Titel ---------------------------------------------------------------
  {
    schluessel: "leitkarte",
    heute: "Validation.tsx:1185 „Was prüfe ich jetzt?“",
    pfad: "/validierung",
    ort: "hilfe",
    text: "val.guide.title",
  },
  {
    schluessel: "entscheidungswirkung",
    heute: "Validation.tsx:1208 „Was bewirkt die Entscheidung?“",
    pfad: "/validierung",
    ort: "hilfe",
    text: "val.guide.impactTitle",
  },
  {
    schluessel: "trust-notiz",
    heute: "Validation.tsx:1227 Quorum-/Trust-Notiz",
    pfad: "/validierung",
    ort: "hilfe",
    text: "val.guide.trustNote",
  },
  {
    schluessel: "hilfe-herkunftsfilter",
    heute: "Validation.tsx:673 ?-Symbol",
    pfad: "/validierung",
    ort: "hilfe",
    text: "vhelp.originFilter.title",
  },
  {
    schluessel: "hilfe-reviewfokus",
    heute: "Validation.tsx:706 ?-Symbol",
    pfad: "/validierung",
    ort: "hilfe",
    text: "vhelp.reviewFocus.title",
  },
  {
    schluessel: "hilfe-filter",
    heute: "Validation.tsx:823 ?-Symbol",
    pfad: "/validierung",
    ort: "hilfe",
    text: "vhelp.filters.title",
  },
  {
    schluessel: "hilfe-mineonly",
    heute: "Validation.tsx:811 ?-Symbol",
    pfad: "/validierung",
    ort: "hilfe",
    text: "vhelp.mineOnly.title",
  },
  {
    schluessel: "hilfe-signale",
    heute: "Validation.tsx:1140 ?-Symbol",
    pfad: "/validierung",
    ort: "hilfe",
    text: "vhelp.signals.title",
  },
  {
    schluessel: "hilfe-freigeben",
    heute: "Validation.tsx:1315 ?-Symbol",
    pfad: "/validierung",
    ort: "hilfe",
    text: "vhelp.approve.title",
  },
  {
    schluessel: "hilfe-rueckfrage",
    heute: "Validation.tsx:1315 ?-Symbol",
    pfad: "/validierung",
    ort: "hilfe",
    text: "vhelp.query.title",
  },
  {
    schluessel: "hilfe-ablehnen",
    heute: "Validation.tsx:1315 ?-Symbol",
    pfad: "/validierung",
    ort: "hilfe",
    text: "vhelp.reject.title",
  },
  {
    schluessel: "hilfe-begruendungsformular",
    heute: "Validation.tsx:1471 ?-Symbol",
    pfad: "/validierung",
    ort: "hilfe",
    text: "vhelp.feedbackForm.title",
  },
  {
    schluessel: "hilfe-zuweisen",
    heute: "Validation.tsx:1403 ?-Symbol",
    pfad: "/validierung",
    ort: "hilfe",
    text: "vhelp.assign.title",
  },
  {
    schluessel: "hilfe-alswahr",
    heute: "Validation.tsx:1379 ?-Symbol",
    pfad: "/validierung",
    ort: "hilfe",
    text: "vhelp.markTrue.title",
  },
  {
    schluessel: "begruendungspflicht",
    heute: "Validation.tsx:1329 Dauerzeile im Fußband",
    pfad: "/validierung",
    ort: "hilfe",
    text: "val.feedbackRequiredHint",
  },
  {
    schluessel: "hilfe-stimmen",
    heute: "Validation.tsx:1048 ?-Symbol am Vertrauensabzeichen",
    pfad: "/validierung",
    ort: "hilfe",
    text: "val.votesTitle",
  },

  // ---- „···"-Menü an der Prüfkarte ------------------------------------------------------------
  {
    schluessel: "als-wahr-kennzeichnen",
    heute: "Validation.tsx:1345-1377 Fußband",
    pfad: "/validierung",
    ort: "menue",
    menue: "karte",
    text: "val.markTrue",
  },
  {
    schluessel: "zuweisen",
    heute: "Validation.tsx:1394 Auswahlliste im Fußband",
    pfad: "/validierung",
    ort: "menue",
    menue: "karte",
    selektor: `select[aria-label="${de("val.assign")}"]`,
  },
  {
    schluessel: "bearbeiten",
    heute: "Validation.tsx:1444 Fußband",
    pfad: "/validierung",
    ort: "menue",
    menue: "karte",
    text: "val.editKo",
  },
  {
    schluessel: "details-ansehen",
    heute: "Validation.tsx:1236 Link unter dem Aufklapper",
    pfad: "/validierung",
    ort: "menue",
    menue: "karte",
    text: "val.openDetails",
  },
  {
    schluessel: "ki-pruefung-wiederholen",
    heute: "Validation.tsx:993 Retry am Badge",
    pfad: "/validierung",
    ort: "menue",
    menue: "karte",
    text: "val.aiCheck.retry",
  },
  {
    schluessel: "loeschen",
    heute: "Validation.tsx:1451 Fußband",
    pfad: "/validierung",
    ort: "menue",
    menue: "karte",
    text: "ko.deleteButton",
  },

  // ---- „Mehr" unter dem Text der Prüfkarte ----------------------------------------------------
  {
    schluessel: "vertrauen",
    heute: "Validation.tsx:1035 Abzeichen",
    pfad: "/validierung",
    ort: "mehr",
    text: "val.trust",
  },
  {
    schluessel: "stimmen-fortschritt",
    heute: "Validation.tsx:1046 „n von 3 grün“",
    pfad: "/validierung",
    ort: "mehr",
    text: "val.votesTitle",
  },
  {
    schluessel: "pruefstand",
    heute: "Validation.tsx:985 Plakette",
    pfad: "/validierung",
    ort: "mehr",
    text: "pruefen.mehr.status",
  },
  {
    schluessel: "ki-pruefstatus",
    heute: "Validation.tsx:993 AiCheckBadge",
    pfad: "/validierung",
    ort: "mehr",
    text: "pruefen.mehr.aiCheck",
  },
  {
    schluessel: "vertraulichkeitsstufe",
    heute: "Validation.tsx:1012 Plakette (JOB 3027)",
    pfad: "/validierung",
    ort: "mehr",
    text: "lib.facet.confidentiality",
  },
  {
    schluessel: "erfassungsweg",
    heute: "Validation.tsx:1154 Zeile im Aufklapper (JOB 3027)",
    pfad: "/validierung",
    ort: "mehr",
    text: "val.herkunft.label",
  },
  {
    schluessel: "kategorie-art-tags",
    heute: "Validation.tsx:1072 Etikettenzeile",
    pfad: "/validierung",
    ort: "mehr",
    text: "lib.facet.category",
  },
  {
    schluessel: "entscheidungsband",
    heute: "Validation.tsx:1172 `val.decision.<band>`",
    pfad: "/validierung",
    ort: "mehr",
    text: "val.decisionLabel",
  },
  {
    schluessel: "review-kontext",
    heute: "Validation.tsx:1143 ValidationReviewContext",
    pfad: "/validierung",
    ort: "mehr",
    text: "pruefen.mehr.reviewContext",
  },
  {
    schluessel: "autorzeile",
    heute: "Validation.tsx:1145 KoAuthorLine",
    pfad: "/validierung",
    ort: "mehr",
    text: "ko.author",
  },
  {
    schluessel: "erstellt-am-von",
    heute: "Validation.tsx:1087 Meta-Zeile",
    pfad: "/validierung",
    ort: "mehr",
    text: "ko.createdAt",
  },

  // ---- Die Fläche selbst (Reiter „Offen") -----------------------------------------------------
  {
    schluessel: "freigeben",
    heute: "Validation.tsx:1266 Fußband",
    pfad: "/validierung",
    ort: "flaeche",
    text: "val.actionApprove",
  },
  {
    schluessel: "rueckfrage",
    heute: "Validation.tsx:1266 Fußband",
    pfad: "/validierung",
    ort: "flaeche",
    text: "val.actionQuery",
  },
  {
    schluessel: "ablehnen",
    heute: "Validation.tsx:1266 Fußband",
    pfad: "/validierung",
    ort: "flaeche",
    text: "val.actionReject",
  },
  {
    schluessel: "stimmenpunkte",
    heute: "Validation.tsx:1046 „n von 3 grün“ als Text",
    pfad: "/validierung",
    ort: "flaeche",
    selektor: '[data-testid="pruefen-stimmenpunkte"] > span',
  },
  {
    schluessel: "warteschlange",
    heute: "Validation.tsx:882 Kartenliste",
    pfad: "/validierung",
    ort: "flaeche",
    selektor: '[data-testid="pruefen-warteschlange-eintrag"]',
  },

  // ---- Reiter „Konflikte" ---------------------------------------------------------------------
  {
    schluessel: "konflikt-gegenueberstellung",
    heute: "Conflicts.tsx:645 Modal + :450 KoPanels",
    pfad: "/konflikte",
    ort: "flaeche",
    selektor: '[data-testid="pruefen-paar-karte-b"]',
  },
  {
    schluessel: "konflikt-links-gilt",
    heute: "Conflicts.tsx:559 „Auflösen“",
    pfad: "/konflikte",
    ort: "flaeche",
    text: "con.side.left",
  },
  {
    schluessel: "konflikt-rechts-gilt",
    heute: "Conflicts.tsx:559 „Auflösen“",
    pfad: "/konflikte",
    ort: "flaeche",
    text: "con.side.right",
  },
  {
    schluessel: "konflikt-beide-gelten",
    heute: "Conflicts.tsx:559 „Auflösen“ mit Kontextvermerk",
    pfad: "/konflikte",
    ort: "flaeche",
    text: "con.side.both",
  },
  {
    schluessel: "konflikt-fehlalarm",
    heute: "Conflicts.tsx:563 „Fehlalarm“",
    pfad: "/konflikte",
    ort: "flaeche",
    text: "con.side.none",
  },
  {
    schluessel: "konflikt-zweitmeinung",
    heute: "Conflicts.tsx:545 Knopf + :587 Feld",
    pfad: "/konflikte",
    ort: "flaeche",
    text: "con.secondOpinionAdd",
  },
  {
    schluessel: "konflikt-typ",
    heute: "Conflicts.tsx:367 Pille",
    pfad: "/konflikte",
    ort: "flaeche",
    selektor: '[data-testid="pruefen-pille-art"]',
  },
  {
    schluessel: "konflikt-eskalieren",
    heute: "Conflicts.tsx:531 Knopf",
    pfad: "/konflikte",
    ort: "menue",
    menue: "konflikt-a",
    text: "con.escalate",
  },
  {
    schluessel: "konflikt-eskalationspfad",
    heute: "Conflicts.tsx:481 `con.escPath`",
    pfad: "/konflikte",
    ort: "menue",
    menue: "konflikt-a",
    text: "con.escPath",
  },
  {
    schluessel: "konflikt-vergleichsseite",
    heute: "Conflicts.tsx:466 Link",
    pfad: "/konflikte",
    ort: "menue",
    menue: "konflikt-a",
    text: "con.readonlyCompare",
  },
  {
    schluessel: "konflikt-objekt-oeffnen",
    heute: "Conflicts.tsx:56 KoPanel-Link",
    pfad: "/konflikte",
    ort: "menue",
    menue: "konflikt-a",
    text: "con.openKo",
  },
  {
    schluessel: "konflikt-herkunft",
    heute: "Conflicts.tsx:196-228 Herkunfts-Badge",
    pfad: "/konflikte",
    ort: "mehr",
    text: "lib.originLabel",
  },
  {
    schluessel: "konflikt-begruendung",
    heute: "Conflicts.tsx:233 `con.autoWhy`",
    pfad: "/konflikte",
    ort: "mehr",
    text: "con.autoWhy",
  },
  {
    schluessel: "konflikt-zitat",
    heute: "Conflicts.tsx:238 wörtliche Belegstelle",
    pfad: "/konflikte",
    ort: "mehr",
    text: "con.autoQuoteA",
  },
  {
    schluessel: "konflikt-beleg-je-seite",
    heute: "Conflicts.tsx:416 ConflictKoSide",
    pfad: "/konflikte",
    ort: "mehr",
    text: "con.evidenceSideLabel",
  },
  {
    schluessel: "konflikt-beweislage",
    heute: "Conflicts.tsx:403 `conflict-evidence-balance`",
    pfad: "/konflikte",
    ort: "mehr",
    selektor: '[data-testid="conflict-evidence-balance"]',
  },
  {
    schluessel: "konflikt-naechster-schritt",
    heute: "Conflicts.tsx:518 `con.nextLabel`",
    pfad: "/konflikte",
    ort: "mehr",
    text: "con.nextLabel",
  },
  {
    schluessel: "konflikt-wirkungssatz",
    heute: "Conflicts.tsx:609 `con.resolveEffect`",
    pfad: "/konflikte",
    ort: "mehr",
    text: "pruefen.mehr.effect",
  },
  {
    schluessel: "konflikt-leerzustand-was",
    heute: "Conflicts.tsx:329 `con.emptyWhat`",
    pfad: "/konflikte",
    ort: "hilfe",
    text: "con.emptyWhat",
  },
  {
    schluessel: "konflikt-leerzustand-wie",
    heute: "Conflicts.tsx:330 `con.emptyHow`",
    pfad: "/konflikte",
    ort: "hilfe",
    text: "con.emptyHow",
  },
  {
    schluessel: "konflikt-beispielpakete",
    heute: "Conflicts.tsx:333-339 Beispielpaket-Link",
    pfad: "/konflikte",
    ort: "hilfe",
    text: "con.emptyExamplesCta",
  },
  {
    schluessel: "hilfe-eskalieren",
    heute: "Conflicts.tsx:533 ?-Symbol",
    pfad: "/konflikte",
    ort: "hilfe",
    text: "vhelp.conflictEscalate.title",
  },
  {
    schluessel: "hilfe-zweitmeinung",
    heute: "Conflicts.tsx:547 ?-Symbol",
    pfad: "/konflikte",
    ort: "hilfe",
    text: "vhelp.conflictSecondOpinion.title",
  },
  {
    schluessel: "hilfe-aufloesen",
    heute: "Conflicts.tsx:561 ?-Symbol",
    pfad: "/konflikte",
    ort: "hilfe",
    text: "vhelp.conflictResolve.title",
  },

  // ---- Reiter „Duplikate" ---------------------------------------------------------------------
  {
    schluessel: "duplikat-gegenueberstellung",
    heute: "Duplicates.tsx:453 Modal + :335 KoPanels",
    pfad: "/duplikate",
    ort: "flaeche",
    selektor: '[data-testid="pruefen-paar-karte-b"]',
  },
  {
    schluessel: "duplikat-prozentpille",
    heute: "Duplicates.tsx:210 führende Zahl",
    pfad: "/duplikate",
    ort: "flaeche",
    selektor: '[data-testid="pruefen-pille-gleich"]',
  },
  {
    schluessel: "duplikat-beziehung",
    heute: "Duplicates.tsx:321 Beziehungs-Pille",
    pfad: "/duplikate",
    ort: "flaeche",
    selektor: '[data-testid="pruefen-pille-beziehung"]',
  },
  {
    schluessel: "duplikat-links-behalten",
    heute: "Duplicates.tsx:427 „Getrennt lassen“",
    pfad: "/duplikate",
    ort: "flaeche",
    text: "dup.side.left",
  },
  {
    schluessel: "duplikat-rechts-behalten",
    heute: "Duplicates.tsx:427 „Getrennt lassen“",
    pfad: "/duplikate",
    ort: "flaeche",
    text: "dup.side.right",
  },
  {
    schluessel: "duplikat-verknuepfen",
    heute: "Duplicates.tsx:431 „Als verwandt verlinken“",
    pfad: "/duplikate",
    ort: "flaeche",
    text: "dup.side.both",
  },
  {
    schluessel: "duplikat-fehlalarm",
    heute: "Duplicates.tsx:437 „Fehlalarm“",
    pfad: "/duplikate",
    ort: "flaeche",
    text: "dup.side.none",
  },
  {
    schluessel: "duplikat-vergleichsseite",
    heute: "Duplicates.tsx:348 Link",
    pfad: "/duplikate",
    ort: "menue",
    menue: "duplikat-a",
    text: "dup.compareReadonly",
  },
  {
    schluessel: "duplikat-objekt-oeffnen",
    heute: "Duplicates.tsx:168 KoPanel-Link",
    pfad: "/duplikate",
    ort: "menue",
    menue: "duplikat-a",
    text: "dup.openKo",
  },
  {
    schluessel: "duplikat-erkennungsweg",
    heute: "Duplicates.tsx:211 Methoden-Pille",
    pfad: "/duplikate",
    ort: "mehr",
    text: "dup.method.model",
  },
  {
    schluessel: "duplikat-textdeckung",
    heute: "Duplicates.tsx:221 `dup.overlap`",
    pfad: "/duplikate",
    ort: "mehr",
    text: "dup.overlap",
    // Der Detektor der Kulisse trägt `lexicalScore: 0.88` — die Fläche zeigt „88 % Textdeckung".
    vars: { percent: 88 },
  },
  {
    schluessel: "duplikat-caption",
    heute: "Duplicates.tsx:217 `dup.leadCaptionModel`",
    pfad: "/duplikate",
    ort: "mehr",
    text: "dup.leadCaptionModel",
  },
  {
    schluessel: "duplikat-begruendung",
    heute: "Duplicates.tsx:226 `dup.why`",
    pfad: "/duplikate",
    ort: "mehr",
    text: "dup.why",
  },
  {
    schluessel: "duplikat-gemeinsame-aussagen",
    heute: "Duplicates.tsx:370 `dup.shared`",
    pfad: "/duplikate",
    ort: "mehr",
    text: "dup.shared",
  },
  {
    schluessel: "duplikat-nur-in-a",
    heute: "Duplicates.tsx:404 `dup.onlyA`",
    pfad: "/duplikate",
    ort: "mehr",
    text: "dup.onlyA",
  },
  {
    schluessel: "duplikat-empfehlung",
    heute: "Duplicates.tsx (FindingCard-Aktion)",
    pfad: "/duplikate",
    ort: "mehr",
    text: "pruefen.mehr.recommendation",
  },
  {
    // Die ANZEIGE des Zustands (offen / in Bearbeitung / geschlossen samt Abschlussgrund).
    schluessel: "duplikat-status-anzeige",
    heute: "Duplicates.tsx:317 `dup.status.*` / :445 Abschlussgrund",
    pfad: "/duplikate",
    ort: "mehr",
    text: "pruefen.mehr.zustand",
  },
  {
    // Der SCHREIBWEG — §5a sagt „Status setzen in „···"", und das ist etwas anderes als die
    // Anzeige darüber. bens Befund aus Runde 5: die Zeile zeigte auf „mehr" und galt damit als
    // erfüllt, obwohl im Menü gar nichts stand, womit sich ein Status hätte setzen lassen. Sie
    // zeigt jetzt auf den vorgeschriebenen Ort; dass dort BEIDE Übergänge wirklich schreiben
    // (Request, Antwort, Folgestatus), misst ST1–ST4 in `tests/pruefseite/entscheidungswege-mounted`.
    schluessel: "duplikat-status-setzen",
    heute: "Duplicates.tsx (neu, Runde 6) — „Status setzen“ im „···“-Menü",
    pfad: "/duplikate",
    ort: "menue",
    menue: "duplikat-a",
    text: "dup.setStatus",
  },
  {
    schluessel: "duplikat-erkennungshilfe",
    heute: "Duplicates.tsx:281 HelpTip",
    pfad: "/duplikate",
    ort: "hilfe",
    text: "dup.help.detection.title",
  },

  // ---- Reiter „Erneut" ------------------------------------------------------------------------
  {
    schluessel: "erneut-noch-gueltig",
    heute: "Lifecycle.tsx:168 „Noch gültig“",
    pfad: "/lebenszyklus",
    ort: "flaeche",
    text: "lcy.stillValid",
  },
  {
    schluessel: "erneut-anlagenaenderung",
    heute: "Lifecycle.tsx:180-195 eigener Abschnitt",
    pfad: "/lebenszyklus",
    ort: "flaeche",
    text: "lcy.assetToggle",
  },
  {
    // Feld und Auslöser liegen HINTER der Zeile „Anlage geändert …" — sie klappt auf (§5b).
    // Eigener Ort, nicht „mehr": das ist der Aufklapper der LISTE, nicht der der Karte. Bis
    // Runde 4 stand hier „mehr", weil die Suche ohnehin die ganze Seite las (bens Befund 2).
    schluessel: "erneut-anlagenfeld",
    heute: "Lifecycle.tsx:184 Eingabefeld",
    pfad: "/lebenszyklus",
    ort: "anlage",
    selektor: `input[placeholder="${de("lcy.assetPlaceholder")}"]`,
  },
  {
    schluessel: "erneut-ausloeser",
    heute: "Lifecycle.tsx:190 „Revalidierung auslösen“",
    pfad: "/lebenszyklus",
    ort: "anlage",
    text: "lcy.assetTrigger",
  },
  {
    schluessel: "erneut-naechster-schritt",
    heute: "Lifecycle.tsx:142 `lcy.revalNextLabel`",
    pfad: "/lebenszyklus",
    ort: "mehr",
    text: "lcy.revalNextLabel",
  },
  {
    schluessel: "erneut-anlagenbezug",
    heute: "Lifecycle.tsx:130 `lcy.revalAsset`",
    pfad: "/lebenszyklus",
    ort: "mehr",
    text: "lcy.revalAsset",
  },
  {
    schluessel: "erneut-banner",
    heute: "Lifecycle.tsx:76 `lcy.banner`",
    pfad: "/lebenszyklus",
    ort: "hilfe",
    text: "lcy.banner",
  },
  {
    schluessel: "erneut-lernpfad",
    heute: "Lifecycle.tsx:202-252 Lernpfad-Abschnitt",
    pfad: "/lebenszyklus",
    ort: "hilfe",
    text: "lcy.pathTitle",
    // Der erste angemeldete Mensch ist Administrator — der Lernpfad trägt seine Rolle im Titel.
    vars: { role: "Administrator" },
  },
  {
    schluessel: "erneut-anlagenhinweis",
    heute: "Lifecycle.tsx:182 `lcy.assetHint`",
    pfad: "/lebenszyklus",
    ort: "hilfe",
    text: "lcy.assetHint",
  },
];

// ---- Gerüst: dieselbe echte App in Chromium wie in `zielbild-h2-pruefen.test.ts` -----------------
type BrowserFn = (arg: unknown) => unknown;
const fn = (quelle: string): BrowserFn =>
  new Function("arg", `return (${quelle})(arg);`) as BrowserFn;

interface Route {
  request(): {
    url(): string;
    method(): string;
    postData(): string | null;
    headers(): Record<string, string>;
  };
  fulfill(r: {
    status: number;
    body: string | Buffer;
    contentType?: string;
    headers?: Record<string, string>;
  }): Promise<void>;
}
interface Seite {
  route(url: string, handler: (route: Route) => Promise<void>): Promise<void>;
  addInitScript(script: string): Promise<void>;
  goto(url: string, opts?: Record<string, unknown>): Promise<unknown>;
  waitForFunction(fn: BrowserFn, arg?: unknown, opts?: Record<string, unknown>): Promise<unknown>;
  evaluate<T>(fn: BrowserFn, arg?: unknown): Promise<T>;
}
interface Browser {
  version(): string;
  newPage(opts: Record<string, unknown>): Promise<Seite>;
  close(): Promise<void>;
}

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript",
  ".css": "text/css",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webmanifest": "application/manifest+json",
  ".json": "application/json",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

function distDatei(pfadname: string): { body: Buffer; typ: string } {
  const rel = pfadname === "/" ? "/index.html" : pfadname;
  const datei = join(DIST, rel);
  if (existsSync(datei) && statSync(datei).isFile()) {
    return { body: readFileSync(datei), typ: MIME[extname(datei)] ?? "application/octet-stream" };
  }
  return { body: readFileSync(join(DIST, "index.html")), typ: MIME[".html"] ?? "text/html" };
}

/**
 * Den neuen Ort öffnen — genau so, wie ein Mensch ihn öffnet — und den BEREICH zurückgeben, in dem
 * die Funktion danach zu finden sein muss. Der Bereich ist die eigentliche Aussage der Zeile aus
 * §5a: nicht „der Text steht irgendwo", sondern „er steht HIER".
 */
const OEFFNEN = `([ort, menue]) => {
  const klick = (sel) => { const el = document.querySelector(sel); if (el) { el.click(); return true; } return false; };
  if (ort === 'flaeche') return '[data-testid="pruefen-flaeche"]';
  if (ort === 'filter') return klick('[data-testid="pruefen-menue-filter"]') ? '[data-testid="pruefen-menue-panel-filter"]' : null;
  if (ort === 'hilfe') return klick('[data-testid="pruefen-menue-hilfe"]') ? '[data-testid="pruefen-menue-panel-hilfe"]' : null;
  if (ort === 'menue') return klick('[data-testid="pruefen-menue-' + menue + '"]') ? '[data-testid="pruefen-menue-panel-' + menue + '"]' : null;
  if (ort === 'mehr') {
    let n = 0;
    for (const d of document.querySelectorAll('[data-testid^="pruefen-mehr-"]')) { d.open = true; n += 1; }
    return n > 0 ? '[data-testid^="pruefen-mehr-"][open]' : null;
  }
  if (ort === 'anlage') {
    const d = document.querySelector('[data-testid="pruefen-anlage"]');
    if (!d) return null;
    d.open = true;
    return '[data-testid="pruefen-anlage"][open]';
  }
  return null;
}`;

/** Steht der Text im GEÖFFNETEN BEREICH, bzw. gibt es das Element DORT? */
const FINDEN = `([bereich, text, selektor]) => {
  const orte = Array.from(document.querySelectorAll(bereich));
  const sichtbar = orte.map((el) => el.innerText || '').join(' ').replace(/\\s+/g, ' ');
  const zaehle = (sel) => orte.reduce((n, el) => n + el.querySelectorAll(sel).length, 0);
  return {
    gefundeneOrte: orte.length,
    text: text ? sichtbar.includes(text.replace(/\\s+/g, ' ')) : null,
    selektor: selektor ? zaehle(selektor) > 0 : null,
  };
}`;

let browser: Browser | null = null;
let seite: Seite | null = null;
let app: ReturnType<typeof buildApp> | null = null;
let fehler: string | null = null;

const KO_A_TITEL = "Design Guide Rev. 0.91";
const KO_B_TITEL = "Hohlprofile in Nasszonen";
const STREIT_A = "vermeiden, weil ihre Dichtheit langfristig nicht garantiert werden kann.";
const STREIT_B = "zulaessig, wenn die Dichtheit jaehrlich geprueft wird.";
const GEMEINSAM = "Ventil vor der Wartung entlasten und den Druck pruefen.";
const ANLAGE = "Linie 3";

describe("JOB 3061 · H2 · das Funktionsinventar — jede Zeile aus §5a in der GEBAUTEN Fläche", () => {
  beforeAll(async () => {
    try {
      if (!existsSync(join(DIST, "index.html"))) {
        throw new Error("apps/web/dist fehlt — vorher ./tools/build (im Tor läuft es immer)");
      }
      const services = buildServices();
      app = buildApp(services);
      await app.ready();
      await app.inject({
        method: "POST",
        url: "/api/auth/register",
        payload: { name: "Pedi", email: "pedi@job3061-inv.test", password: "geheim12345" },
      });
      const login = await app.inject({
        method: "POST",
        url: "/api/auth/login",
        payload: { email: "pedi@job3061-inv.test", password: "geheim12345" },
      });
      const token = (login.json() as { token: string }).token;
      const me = await app.inject({
        method: "GET",
        url: "/api/auth/me",
        headers: { authorization: `Bearer ${token}` },
      });
      const autorId = (me.json() as { id: string }).id;

      const anlegen = async (
        title: string,
        statement: string,
        opt: { asset?: string; ohneQuelle?: boolean } = {},
      ): Promise<string> => {
        const ko = (await services.ko.create({
          title,
          statement,
          type: "best_practice",
          category: "Konstruktion",
          author: autorId,
          ...(opt.asset ? { asset: opt.asset } : {}),
          ...(opt.ohneQuelle
            ? {}
            : {
                sources: [
                  {
                    id: `q-${title.replace(/\W+/g, "-").toLowerCase()}`,
                    label: "Design Guide Rev. 0.91",
                    url: null,
                    excerpt: null,
                    kind: "external",
                    peerValidated: false,
                    author: autorId,
                    at: "2026-07-31T08:00:00.000Z",
                  },
                ],
              }),
        } as never)) as { id: string };
        return ko.id;
      };
      const koA = await anlegen(
        KO_A_TITEL,
        `Vollverschweisste Hohlprofile in Spritzzonen ${STREIT_A}`,
        { asset: ANLAGE },
      );
      // AUFTRAG-mega32 BLOCK K: die Beweislagenzeile SCHWEIGT, wenn beide Seiten belegt sind —
      // ein Dauerhinweis wäre Rauschen. Damit die Zeile in dieser Probe überhaupt etwas zu sagen
      // hat, trägt die rechte Seite bewusst KEINE Quelle: das ist der Fall „einseitig belegt".
      const koB = await anlegen(KO_B_TITEL, `Vollverschweisste Hohlprofile sind ${STREIT_B}`, {
        ohneQuelle: true,
      });
      const dupA = await anlegen("Wartung Ventilblock", `${GEMEINSAM} Schutzbrille tragen.`, {});
      const dupB = await anlegen(
        "Ventil entlasten vor Wartung",
        `${GEMEINSAM} Manometer muss auf null stehen.`,
        {},
      );

      await services.conflicts.createAuto(
        { koA, koB, type: "truth", description: "Widerspruch zur Zulaessigkeit." } as never,
        {
          trigger: "background",
          method: "model",
          confidence: 0.86,
          rationale: "Beide Aussagen schliessen einander aus.",
          quotes: { a: STREIT_A, b: STREIT_B },
          kollision: {
            streitpunkt: "Hohlprofile in Spritzzonen",
            seiteA: { kernaussage: "vermeiden", streitwert: STREIT_A, streitwertWoertlich: true },
            seiteB: { kernaussage: "zulaessig", streitwert: STREIT_B, streitwertWoertlich: true },
          },
        } as never,
      );
      await services.overlaps.createAuto(
        {
          koA: dupA,
          koB: dupB,
          relation: "identisch",
          aspects: [{ beschreibung: "Entlasten", zitatA: GEMEINSAM, zitatB: GEMEINSAM }],
          eigenanteilA: "Schutzbrille tragen.",
          eigenanteilB: "Manometer muss auf null stehen.",
          recommendation: "zusammenfuehren_pruefen",
        } as never,
        {
          trigger: "background",
          method: "model",
          lexicalScore: 0.88,
          confidence: 0.92,
          rationale: "Dieselbe Handlungsanweisung.",
        } as never,
      );
      // Der Reiter „Erneut" braucht ein wirklich faelliges Objekt — ueber den vorhandenen
      // Anlagen-Kopplungsweg, nicht ueber einen Testschalter.
      await services.lifecycle.couple(ANLAGE, koA);
      await services.lifecycle.assetChanged(ANLAGE);

      const require = createRequire(import.meta.url);
      const { chromium } = require("playwright") as {
        chromium: { launch(o: Record<string, unknown>): Promise<Browser> };
      };
      browser = await chromium.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-gpu", "--single-process", "--no-zygote"],
      });
      seite = await browser.newPage({ viewport: { width: 1280, height: 900 } });
      await seite.addInitScript(
        `try { localStorage.setItem("kw.designTheme", "modern"); } catch (e) {}`,
      );
      const a = app;
      await seite.route(`${ORIGIN}/**`, async (route) => {
        const req = route.request();
        const url = new URL(req.url());
        if (url.pathname.startsWith("/api/")) {
          const kopf: Record<string, string> = {};
          for (const [k, v] of Object.entries(req.headers())) {
            if (!["host", "origin", "referer", "cookie"].includes(k.toLowerCase())) kopf[k] = v;
          }
          kopf.authorization = `Bearer ${token}`;
          const body = req.postData();
          const res = await a.inject({
            method: req.method() as "GET",
            url: url.pathname + url.search,
            headers: kopf,
            ...(body !== null ? { payload: body } : {}),
          });
          await route.fulfill({
            status: res.statusCode,
            body: res.body,
            headers: {
              "content-type": (res.headers["content-type"] as string) ?? "application/json",
            },
          });
          return;
        }
        const d = distDatei(url.pathname);
        await route.fulfill({ status: 200, body: d.body, contentType: d.typ });
      });
    } catch (e) {
      fehler = String(e).split("\n").slice(0, 4).join(" | ");
    }
  }, 180_000);

  afterAll(async () => {
    await browser?.close();
    await app?.close();
  }, 60_000);

  // Je Kombination aus Reiter und Ort EINMAL öffnen, dann alle Zeilen dieser Gruppe prüfen —
  // sonst führe die Probe rund neunzig Seitenwechsel durch.
  const gruppen = new Map<string, Zeile[]>();
  for (const z of INVENTAR) {
    const schluessel = `${z.pfad}|${z.ort}|${z.menue ?? ""}`;
    gruppen.set(schluessel, [...(gruppen.get(schluessel) ?? []), z]);
  }

  it("K · Kalibrierung: die Fläche steht und die Tabelle ist nicht leer", async () => {
    expect(fehler, `Seite nicht gemountet: ${fehler}`).toBeNull();
    expect(INVENTAR.length).toBeGreaterThanOrEqual(80);
    // Jede Zeile trägt Schlüssel, alten Ort und eine Suchvorschrift — ein Eintrag ohne das eine
    // oder andere wäre eine Behauptung ohne Prüfung.
    for (const z of INVENTAR) {
      expect(z.schluessel.length, "Zeile ohne Schlüssel").toBeGreaterThan(2);
      expect(z.heute.length, `${z.schluessel}: Zeile ohne alten Ort`).toBeGreaterThan(5);
      expect(
        (z.text ?? z.selektor ?? "").length,
        `${z.schluessel}: Zeile ohne Suchvorschrift`,
      ).toBeGreaterThan(2);
      if (z.text) {
        expect(
          de(z.text),
          `${z.schluessel}: i18n-Schlüssel ${z.text} ohne deutschen Text`,
        ).not.toBe("undefined");
      }
    }
    // Und der Bestand ist wirklich da (sonst prüfte alles Folgende leere Flächen).
    const s = seite as Seite;
    await s.goto(`${ORIGIN}/validierung`, { waitUntil: "load", timeout: 60_000 });
    await s.waitForFunction(
      fn(`() => document.querySelector('[data-testid="pruefen-karte"]') !== null`),
      undefined,
      { timeout: 30_000 },
    );
  }, 90_000);

  for (const [gruppe, zeilen] of gruppen) {
    const [pfad, ort, menue] = gruppe.split("|") as [string, Zeile["ort"], string];
    const ortsname = `${ort}${menue ? ` (${menue})` : ""}`;
    describe(`${pfad} · ${ortsname}`, () => {
      let bereich: string | null = null;
      beforeAll(async () => {
        if (fehler !== null) {
          return;
        }
        const s = seite as Seite;
        await s.goto(`${ORIGIN}${pfad}`, { waitUntil: "load", timeout: 60_000 });
        await s.waitForFunction(
          fn(`() => document.querySelector('[data-testid="pruefen-flaeche"]') !== null`),
          undefined,
          { timeout: 30_000 },
        );
        // Zwei Runden Ruhe: die Fläche zieht ihre Daten nach dem ersten Anstrich.
        await s.evaluate(fn("() => new Promise((r) => setTimeout(r, 400))"));
        bereich = await s.evaluate<string | null>(fn(OEFFNEN), [ort, menue]);
        expect(bereich, `der Ort „${ortsname}" liess sich nicht öffnen`).not.toBeNull();
      }, 90_000);

      for (const z of zeilen) {
        it(`${z.schluessel} · ${z.heute} → ${ortsname}`, async () => {
          expect(fehler).toBeNull();
          expect(bereich).not.toBeNull();
          const gefunden = await (seite as Seite).evaluate<{
            gefundeneOrte: number;
            text: boolean | null;
            selektor: boolean | null;
          }>(fn(FINDEN), [bereich, z.text ? de(z.text, z.vars) : null, z.selektor ?? null]);
          // Ohne diesen Fall wäre ein leerer Bereich („nichts gefunden") kein Fehler, sondern
          // stillschweigend „alles nicht da" — und die Meldungen unten unlesbar.
          expect(
            gefunden.gefundeneOrte,
            `der Bereich ${bereich} steht nach dem Öffnen nicht im DOM`,
          ).toBeGreaterThan(0);
          if (z.text) {
            expect(
              gefunden.text,
              `„${de(z.text, z.vars)}" (${z.text}) steht NICHT in ${bereich} — die Funktion aus „${z.heute}" ist an ihrem zugesagten Ort „${ortsname}" nicht erreichbar`,
            ).toBe(true);
          }
          if (z.selektor) {
            expect(
              gefunden.selektor,
              `${z.selektor} steht NICHT in ${bereich} — die Funktion aus „${z.heute}" ist an ihrem zugesagten Ort „${ortsname}" nicht erreichbar`,
            ).toBe(true);
          }
        });
      }
    });
  }
});
