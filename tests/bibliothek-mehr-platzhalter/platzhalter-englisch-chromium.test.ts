// ================================================================================================
// JOB 3815 · DIE PLATZHALTER UNTER „MEHR" — DER ZWEITE LESER, DER ATTRIBUTE LIEST.
// ================================================================================================
//
// WARUM ES DIESE DATEI GIBT. Der einzige Sprachwächter dieser Fläche liest `innerText`
// (`tests/design/h4-funktionsinventar.test.ts:168-174`, `MEHR_LESEN`) — und ein Platzhalter steht
// nicht im Text, sondern in einem ATTRIBUT. JOB 3793 hat das selbst festgehalten
// (`jobs/3793/runde-1/RUECKGABE.md:60`): „die Platzhalter der Eingabefelder stehen nicht im
// `innerText` und sind für diesen Leser unsichtbar. Ein Wächter über Platzhaltertexte wäre eine
// eigene Zeile und bräuchte einen anderen Leser." Das ist dieser Leser.
//
// Wer die Bibliothek auf Englisch benutzt, liest unter „Mehr" den grauen Vorschlagstext IM Feld —
// „Source label (required)", „Search term …", „Write a comment …". Rutscht einer davon auf Deutsch
// zurück, sah das bis hierher NIEMAND. Ab jetzt nennt ein roter Fall Abschnitt, Schlüssel und
// Wortlaut.
//
// ------------------------------------------------------------------------------------------------
// DIE DECKUNGSGRENZE — WAS DIESE DATEI ZUSICHERT UND WAS AUSDRÜCKLICH NICHT.
// ------------------------------------------------------------------------------------------------
// Nach dem Vorbild der Zusicherungsliste in `tests/waechter-ast/erwartungsstellen.ts:47-103`: ein
// Wächter, der mehr behauptet zu decken, als er misst, ist schlimmer als keiner.
//
// GEDECKT: das Attribut `placeholder`, an den Feldern INNERHALB von `[data-bib-abschnitt]`, in den
// FÜNF Abschnitten, die heute überhaupt eines tragen (`quellen`, `extern`, `beitrag`, `kopplung`,
// `kommentare` — acht Felder, Tabelle unten), und zwar ENGLISCH gegen DEUTSCH.
//
// GEDECKT SEIT JOB 3944 — UND GENAU SO WEIT, WAS BEWIESEN IST: P4 belegt, dass die Klickwiederholung
// in `mehrAufklappen` einen VERSCHLUCKTEN ersten Klick übersteht — ein Abfang in der Capture-Phase am
// `document` nimmt den ersten Klick weg, und der zweite Versuch öffnet die Fläche wieder vollständig
// (Abschnitte gezeichnet, alle acht Platzhalter da). WAS ANGENOMMEN BLEIBT: dass ein Neuzeichnen der
// React-Fläche den Knopf im Betrieb je zurückstellt — die Begründung der Schleife weiter unten
// (`MEHR_KLICK`, „ein Neuzeichnen der React-Fläche kann ihn zurückstellen") — ist damit NICHT
// gemessen; P4 stellt den Fehlschlag künstlich her und sagt nichts darüber, ob er von selbst eintritt.
//
// NICHT GEDECKT, und deshalb hier benannt statt stillschweigend weggelassen:
//   · Niederländisch (NL) — die dritte Sprache des Katalogs steht nicht in der Tabelle.
//   · Die Attribute `title` und `aria-label` — sie sind ebenso unsichtbar für `innerText`, brauchen
//     aber eine eigene Sollwertmenge und eine eigene Aussage.
//   · Jede Fläche AUSSERHALB von „Mehr" — die Suchzeile der Liste (`BibliothekListe.tsx:277`,
//     `lib.searchLabel`) trägt einen Platzhalter und wird hier bewusst NICHT gezählt.
//   · Die acht „Mehr"-Abschnitte OHNE Platzhalter (`konflikt`, `provenienz`, `herkunftskette`,
//     `historie`, `belege`, `schnappschuesse`, `anhaenge`, `nachbarschaft`).
//   · Die schmalen Lagen (320/390 px) — gemessen wird an der 1620-px-Bühne der Vorrichtung.
//   · Ein Platzhalter, der erst nach einer Serverantwort erscheint — die drei Fälle lesen EINEN
//     Stand, nicht den Verlauf dorthin.
//   · Das Zurückstellen des Knopfes durch ein React-Neuzeichnen (s. o., JOB 3944): der Fall, gegen
//     den die Schleife gebaut ist, wird von P4 künstlich hergestellt und nie im Betrieb beobachtet.
//
// ------------------------------------------------------------------------------------------------
// DIESER FALL ERSETZT NICHTS (Prüfpunkt 7).
// ------------------------------------------------------------------------------------------------
// F19/F20/F21 in `tests/design/h4-funktionsinventar.test.ts` messen `innerText` und behalten ihre
// Arbeit vollständig. Hier steht ein ZWEITER Leser für eine Stelle, die der erste nicht sehen kann
// — kein zweiter Weg zu derselben Messung. In `h4-funktionsinventar.test.ts` ist für diesen Auftrag
// keine Zeile geändert worden.
//
// WAS DOPPELT IST UND DESHALB BENANNT GEHÖRT: das Aufklappen. `mehrAufklappen` unten ist die zweite
// Fassung desselben Schritts — die erste steht als lokale, NICHT exportierte Hilfe in
// `h4-funktionsinventar.test.ts:140-158`. Sie wandert hier nicht in die Vorrichtung, weil
// `tests/design/h4-harness.ts` (JOB 3775) und `h4-funktionsinventar.test.ts` (JOB 3793) gerade
// laufenden Jobs gehören und ein Diff dort ein Zusammenstoss wäre. DER FOLGESCHRITT, sobald die
// Vorrichtung frei ist: `mehrAufklappen` gehört nach `h4-harness.ts`, und BEIDE Dateien rufen
// dieselbe Hilfe — so, wie `spracheSetzen` (JOB 3576) und die Tastatur (JOB 3564) dort gelandet
// sind.
//
// ------------------------------------------------------------------------------------------------
// WARUM RUNDE 1 IM TOR GESCHEITERT IST — UND WARUM DAS BEREITSCHAFTSWARTEN HIER PFLICHT IST.
// ------------------------------------------------------------------------------------------------
// Runde 1 war lokal grün (6126 ms) und im Tor ROT, alle drei Fälle mit derselben Zeile:
// `TimeoutError: page.waitForFunction: Timeout 20000ms exceeded.`
// (`jobs/3815/runde-1/tor.err:221`, Dateilaufzeit 21107 ms). Diese 20 s waren die Frist des
// Abschnittswartens im ERSTEN Aufklappen, dem deutschen — die 20 s sind also nahezu die ganze
// Laufzeit der Datei, und die 1,1 s davor reichten auf dem schnellen Cloud-Rechner für Bestand,
// App und Browser.
//
// DIE URSACHE IST KEINE LANGSAMKEIT, SONDERN EINE FEHLENDE ZUSICHERUNG. `spracheSetzen`
// (`h4-harness.ts:438`) lädt die Seite neu und kommt zurück, sobald `<html lang>` UND die Ortszeile
// stehen — ausdrücklich NICHT, sobald die Lesespalte da ist; die Liste und die Lesespalte holen
// ihre Daten in zwei WEITEREN Zügen. Der Knopf „Mehr" wohnt in der Lesespalte
// (`BibliothekLesen.tsx:1344`, innerhalb des Zweigs, der den geladenen Eintrag zeichnet). Runde 1
// rief danach sofort `mehrAufklappen`; dessen Klickschritt ist `if (b && …) b.click()` und tut bei
// FEHLENDEM Knopf schweigend nichts. Auf einem schnellen Rechner kehrt `spracheSetzen` beim ERSTEN
// Blick seiner 100-ms-Schleife zurück, der Knopf ist dann noch nicht gezeichnet, es wird nie
// geklickt — und danach wartet die Frist 20 s auf Abschnitte, die niemand angefordert hat. Je
// schneller die Maschine, desto sicherer der Fehlschlag; lokal war die Seite vor dem Klick fertig.
//
// `h4-funktionsinventar.test.ts` hat genau diesen Schritt, an genau dieser Stelle, mit genau dieser
// Begründung (`:219-230`: „DIE DREI WARTESCHRITTE DANACH sind nicht Vorsicht, sondern Pflicht …
// Ohne sie läse F17 in eine halb gezeichnete Fläche") — und F20 wiederholt ihn nach seinem
// Sprachwechsel (`:1127-1133`). Runde 1 hatte ihn für die ENGLISCHE Lesung abgeschrieben und für
// die DEUTSCHE vergessen. Er steht jetzt EINMAL in `flaecheBereit` und läuft vor JEDEM Aufklappen,
// in beiden Sprachen.
//
// ZWEITE ÄNDERUNG, aus derselben Wunde: kein einmaliger Klick mehr und keine nackte Frist. Der
// Klick wird wiederholt, solange der Knopf `aria-expanded="false"` meldet (ein Neuzeichnen der
// React-Fläche kann ihn zurückstellen), und läuft die Frist doch ab, sagt die Meldung die GEMESSENE
// Lage — Pfad, Sprache, Listenzeilen, Lesetitel, Zustand des Knopfes, Zahl der Abschnitte und der
// Platzhalter (§9: nie „alles englisch" behaupten, wenn nichts gesehen wurde, und nie einen roten
// Fall hinterlassen, aus dem niemand ablesen kann, WAS fehlte). Eine Zeile
// `Timeout 20000ms exceeded` ist kein Befund, sondern eine Fundsache.
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { type H4Stand, fn, h4Stand, spracheSetzen } from "../design/h4-harness";

// ------------------------------------------------------------------------------------------------
// DER LESER (Lieferung 1) — ATTRIBUTE, KEIN `innerText`.
// ------------------------------------------------------------------------------------------------
//
// Er gibt je Fund DREI Dinge: die Abschnittskennung (das `schluessel`-Attribut aus
// `MehrAbschnitte.tsx:152`), den Platzhaltertext und die Reihenfolge INNERHALB des Abschnitts — die
// Zuordnungshilfe, mit der die Meldung den Schlüssel benennen kann (`quellen` trägt drei Felder,
// `beitrag` zwei).
//
// `[data-bib-abschnitt] [placeholder]` und nicht `[placeholder]`: der Abschnittsbezug ist Teil der
// Aussage, nicht Zierde. Ohne ihn zählte die Suchzeile der Liste mit (Gegenprobe zu P3).
const PLATZHALTER_LESEN = `() => {
  const zaehler = {};
  return [...document.querySelectorAll('[data-bib-abschnitt] [placeholder]')].map((el) => {
    const d = el.closest('[data-bib-abschnitt]');
    const abschnitt = d === null ? '(ohne Abschnitt)' : (d.getAttribute('data-bib-abschnitt') || '(ohne Kennung)');
    zaehler[abschnitt] = (zaehler[abschnitt] || 0) + 1;
    return { abschnitt, text: el.getAttribute('placeholder') || '', rang: zaehler[abschnitt] - 1 };
  });
}`;

interface Platzhalterfund {
  abschnitt: string;
  text: string;
  /** Die Reihenfolge innerhalb des Abschnitts, ab 0 — `quellen` hat 0/1/2, `beitrag` 0/1. */
  rang: number;
}

// ------------------------------------------------------------------------------------------------
// DIE SOLLWERTTABELLE (Lieferung 2) — ACHT ZEILEN, DIE EINE QUELLE DIESES FALLS.
// ------------------------------------------------------------------------------------------------
//
// Wörtlich aus `apps/web/src/i18n.ts` abgeschrieben, je Schlüssel die deutsche und die englische
// Zeile (nachgemessen am Basisstand `b4818d7`):
//   ko.sourceLabel        de :3020  en :8700     ko.sourceUrl      de :3021  en :8701
//   ko.sourceExcerpt      de :3022  en :8702     ext.placeholder   de :2992  en :8674
//   ko.sourceContribution de :2980  en :8663     ko.sourceRef      de :2981  en :8664
//   ko.couple.placeholder de :1509  en :7471     ko.commentPlaceholder de :3171 en :8803
//
// DIE REIHENFOLGE IST DIE DES DOKUMENTS. Daraus — und nur daraus — kommt der `rang`, mit dem ein
// Fund seiner Zeile zugeordnet wird; eine zweite Liste mit Rangzahlen gäbe es sonst zweimal zu
// pflegen. Die Fundstellen in `MehrAbschnitte.tsx`: `quellen` :804/:809/:814, `extern` :919,
// `beitrag` :979/:986, `kopplung` :1117, `kommentare` :1706.
interface Sollzeile {
  abschnitt: string;
  schluessel: string;
  deutsch: string;
  englisch: string;
}

const SOLLWERTE: readonly Sollzeile[] = [
  {
    abschnitt: "quellen",
    schluessel: "ko.sourceLabel",
    deutsch: "Bezeichnung der Quelle (Pflicht)",
    englisch: "Source label (required)",
  },
  {
    abschnitt: "quellen",
    schluessel: "ko.sourceUrl",
    deutsch: "URL / Referenz (optional)",
    englisch: "URL / reference (optional)",
  },
  {
    abschnitt: "quellen",
    schluessel: "ko.sourceExcerpt",
    deutsch: "Auszug / Notiz (optional)",
    englisch: "Excerpt / note (optional)",
  },
  {
    abschnitt: "extern",
    schluessel: "ext.placeholder",
    deutsch: "Suchbegriff …",
    englisch: "Search term …",
  },
  {
    abschnitt: "beitrag",
    schluessel: "ko.sourceContribution",
    deutsch: "Dein Beitrag / deine Begründung (Pflicht)",
    englisch: "Your contribution / rationale (required)",
  },
  {
    abschnitt: "beitrag",
    schluessel: "ko.sourceRef",
    deutsch: "Quelle / URL / Referenz (optional)",
    englisch: "Source / URL / reference (optional)",
  },
  {
    abschnitt: "kopplung",
    schluessel: "ko.couple.placeholder",
    deutsch: "Anlagen-Kennung, z. B. Linie L4",
    englisch: "Asset reference, e.g. line L4",
  },
  {
    abschnitt: "kommentare",
    schluessel: "ko.commentPlaceholder",
    deutsch: "Kommentar schreiben …",
    englisch: "Write a comment …",
  },
];

/** Der Rang einer Sollzeile: wie viele Zeilen desselben Abschnitts vor ihr stehen. */
const rangVon = (i: number): number =>
  SOLLWERTE.slice(0, i).filter((s) => s.abschnitt === SOLLWERTE[i]?.abschnitt).length;

/** Die erwartete Verteilung aus der Tabelle — keine zweite Liste (Lieferung 5). */
const SOLL_VERTEILUNG: ReadonlyMap<string, number> = SOLLWERTE.reduce((m, s) => {
  m.set(s.abschnitt, (m.get(s.abschnitt) ?? 0) + 1);
  return m;
}, new Map<string, number>());

/**
 * `kopplung` trägt den Platzhalter NUR, solange das Objekt keine Anlage hat
 * (`MehrAbschnitte.tsx:1117`, `ko.asset ? ko.asset : t("ko.couple.placeholder")`). Steht dort eine
 * Anlagenkennung, ist über die ÜBERSETZUNG nichts gesagt — dann ist der Fall nicht anwendbar, und
 * er sagt das (§9: nie still bestehen, wenn nicht gemessen wurde).
 */
const KOPPLUNG = "kopplung";

// ------------------------------------------------------------------------------------------------
// DIE GEMESSENE LAGE — die Grundlage jeder Meldung dieses Falls.
// ------------------------------------------------------------------------------------------------
//
// Sie wird an zwei Stellen gebraucht: in jeder Fehlermeldung der Schritte unten (damit ein rotes Tor
// sagt, WAS fehlte) und unmittelbar nach jedem `spracheSetzen` als Protokollzeile — dort ist sie der
// Beleg für die Ursache aus dem Kopf dieser Datei: „Mehr" ist in diesem Augenblick noch nicht da.
const FLAECHE_LESEN = `() => {
  const b = document.querySelector('[data-testid="bib-mehr"]');
  return {
    ort: location.pathname + location.search,
    lang: document.documentElement.lang,
    zeilen: document.querySelectorAll('[data-testid="bib-zeile"]').length,
    titel: !!document.querySelector('[data-testid="bib-titel"]'),
    mehr: b === null ? '(KEIN KNOPF)' : (b.getAttribute('aria-expanded') || '(ohne aria-expanded)'),
    abschnitte: document.querySelectorAll('[data-bib-abschnitt]').length,
    platzhalter: document.querySelectorAll('[data-bib-abschnitt] [placeholder]').length,
  };
}`;

interface Flaechenlage {
  ort: string;
  lang: string;
  zeilen: number;
  titel: boolean;
  mehr: string;
  abschnitte: number;
  platzhalter: number;
}

/** Die erste Zeile eines Fehlers — mehr trägt keine Meldung. */
const erste = (e: unknown): string => String(e).split("\n")[0] ?? String(e);

/**
 * Die Lage als lesbare Zeile. Sie wird auch im Fehlerfall gelesen und darf deshalb selbst nicht
 * werfen: scheitert sie, ist DAS die Lage, und sie sagt es — der eigentliche Befund darüber bleibt
 * erhalten (derselbe Griff wie `aufraeumen` in `h4-funktionsinventar.test.ts:193`).
 */
async function lage(seite: H4Stand["seite"]): Promise<string> {
  try {
    const l = await seite.evaluate<Flaechenlage>(fn(FLAECHE_LESEN));
    return `Lage: ${l.ort} · lang=${l.lang} · ${l.zeilen} Listenzeilen · Lesetitel ${l.titel ? "da" : "FEHLT"} · Knopf „Mehr" ${l.mehr} · ${l.abschnitte} Abschnitte · ${l.platzhalter} Platzhalter`;
  } catch (e) {
    return `Lage nicht lesbar — ${erste(e)}`;
  }
}

/** Wie lange auf die fertig gezeichnete Lesefläche gewartet wird. Dieselbe Frist wie in `h4Stand`. */
const BEREIT_FRIST_MS = 30_000;
/** Wie lange auf die Abschnitte unter „Mehr" gewartet wird, nachdem der Knopf gedrückt ist. */
const AUFKLAPP_FRIST_MS = 30_000;

/**
 * DER SCHRITT, DEN RUNDE 1 FÜR DIE DEUTSCHE LESUNG VERGESSEN HAT (ausführlich im Kopf der Datei).
 *
 * Gewartet wird auf einen ZUSTAND und nicht auf eine Frist (Lehre JOB 3152 T1b): auf die Listenzeile,
 * den Lesetitel UND den Knopf „Mehr". Der Knopf steht ausdrücklich dabei, obwohl er im selben Zweig
 * wie der Titel gezeichnet wird — er ist das Element, das der nächste Schritt anfasst, und eine
 * Zusicherung über einen Nachbarn ist keine über ihn.
 *
 * Läuft die Frist ab, ist NICHTS über die Sprache gesagt (§9, `lastabhaengig` wie in
 * `spracheSetzen`): dann ist die Fläche nicht fertig geworden, und der Fall sagt das mit der
 * gemessenen Lage, statt eine leere Messung als Grün auszugeben.
 */
async function flaecheBereit(seite: H4Stand["seite"], wo: string): Promise<void> {
  try {
    await seite.waitForFunction(
      fn(
        `() => !!document.querySelector('[data-testid="bib-zeile"]') && !!document.querySelector('[data-testid="bib-titel"]') && !!document.querySelector('[data-testid="bib-mehr"]')`,
      ),
      undefined,
      { timeout: BEREIT_FRIST_MS },
    );
  } catch (e) {
    throw new Error(
      `${wo}: die Lesefläche ist in ${BEREIT_FRIST_MS} ms nicht fertig geworden (Listenzeile, Lesetitel, Knopf „Mehr") — ${await lage(seite)} — lastabhaengig: NICHT GEMESSEN, über die Platzhalter ist damit nichts gesagt (${erste(e)})`,
    );
  }
}

// ------------------------------------------------------------------------------------------------
// DAS AUFKLAPPEN — die zweite Fassung von `h4-funktionsinventar.test.ts:140-158` (s. Kopf).
// ------------------------------------------------------------------------------------------------
//
// Jeder Abschnitt zeichnet seinen Inhalt ERST beim Aufklappen (`MehrAbschnitte.tsx:163`,
// `{offen ? children : null}`) — zugeklappt steht nirgends ein Eingabefeld, und der Leser fände
// null Platzhalter. Deshalb erst die Fläche fertig werden lassen, dann „Mehr" drücken, auf die
// Abschnitte warten, jeden öffnen, dann warten. Die Frist am Ende steht hier aus demselben Grund wie
// dort: die Abschnitte sind React-GESTEUERT, ein von aussen gesetztes `open` überlebt nur, wenn die
// Fläche danach nicht noch einmal zeichnet — ein Zustandswarten könnte nur feststellen, dass es im
// Augenblick des Blicks stimmte.
//
// DER KLICK STEHT IN DER SCHLEIFE, nicht davor (Runde 2). Er ist bedingt (`aria-expanded !== 'true'`)
// und deshalb wiederholbar, ohne umzuschalten: ist die Fläche offen, tut er nichts; hat ein
// Neuzeichnen sie zugeklappt, drückt er erneut. Ein EINMALIGER Klick vor einer stummen Frist war der
// Fehlschlag von Runde 1 — er kann nichts getroffen haben, und man erfährt es 20 s später nicht.
const MEHR_KLICK = `() => {
  const b = document.querySelector('[data-testid="bib-mehr"]');
  if (b === null) return false;
  if (b.getAttribute('aria-expanded') !== 'true') b.click();
  return true;
}`;

const ABSCHNITTE_ZAEHLEN = `() => document.querySelectorAll('[data-bib-abschnitt]').length`;

/**
 * JOB 3944: die Versuchszahl wird ZURÜCKGEGEBEN statt nur protokolliert. Am Verhalten ändert das
 * nichts (gleiche Fristen, gleiche Meldungen, dieselbe Protokollzeile unten); die zwei bestehenden
 * Aufrufe im `beforeAll` lassen den Wert liegen. Gebraucht wird er von der Folgeprobe P4, die den
 * ersten Klick verschluckt und den erfolgreichen ZWEITEN Versuch belegen muss — als Behauptung im
 * Protokoll war die Zahl bis hierher für keinen Fall greifbar.
 */
async function mehrAufklappen(seite: H4Stand["seite"], wo: string): Promise<number> {
  await flaecheBereit(seite, wo);
  const beginn = Date.now();
  let versuche = 0;
  for (;;) {
    const knopf = await seite.evaluate<boolean>(fn(MEHR_KLICK));
    versuche += 1;
    const abschnitte = await seite.evaluate<number>(fn(ABSCHNITTE_ZAEHLEN));
    if (abschnitte > 0) {
      break;
    }
    if (Date.now() - beginn >= AUFKLAPP_FRIST_MS) {
      throw new Error(
        `${wo}: „Mehr" hat in ${Date.now() - beginn} ms und ${versuche} Klickversuchen keinen einzigen Abschnitt gezeichnet (Knopf ${knopf ? "gedrückt" : "beim letzten Versuch NICHT MEHR DA"}) — ${await lage(seite)} — NICHT GEMESSEN`,
      );
    }
    await seite.waitForTimeout(100);
  }
  // WIEVIELE VERSUCHE ES WIRKLICH GEBRAUCHT HAT — die Zusage der Schleife, jedes Mal nachgerechnet
  // statt einmal behauptet. Steht hier eine Zahl über 1, hätte der EINMALIGE Klick von Runde 1 an
  // dieser Stelle ins Leere gegriffen und die Frist stumm ablaufen lassen.
  console.info(
    `JOB 3815 · ${wo}: aufgeklappt nach ${versuche} Klickversuch(en) in ${Date.now() - beginn} ms`,
  );
  await seite.evaluate(
    fn(
      `() => { for (const d of document.querySelectorAll('[data-bib-abschnitt]')) d.open = true; }`,
    ),
  );
  await seite.waitForTimeout(2500);
  return versuche;
}

// ================================================================================================
// JOB 3944 · DIE FOLGEPROBE — DER ZWEITE KLICK, DEN NOCH NIE JEMAND GEBRAUCHT HAT.
// ================================================================================================
//
// BENs Prüfpunkt 6 zu Runde 2 (`archiv/3815/runde-2/ben.md:25`): „Die Klickwiederholung ab Zeile 325
// wurde nicht als notwendig ausgelöst. Folgeprobe: ersten Klick gezielt verschlucken und
// erfolgreichen zweiten Versuch nachweisen." Gemessen, nicht vermutet: in 114 Protokollzeilen aus
// `archiv/` und `jobs/` steht ausnahmslos „aufgeklappt nach 1 Klickversuch(en)"; die Suche nach einer
// Zahl über 1 liefert null Treffer. Der zweite Durchlauf der Schleife oben war damit ungemessener
// Code — eine Vorkehrung, die nie ausgelöst wurde, ist eine Behauptung und kein Nachweis.
//
// P4 stellt den Fehlschlag her, gegen den die Schleife gebaut ist: Fläche zuklappen, einen Abfang
// einbauen, der GENAU EINEN Klick auf „Mehr" verschluckt, aufklappen. Grün ist der Fall nur, wenn
// alle vier Aussagen zugleich gelten — zu vorher, genau ein verschluckter Klick, mindestens zwei
// Versuche, danach vollständig offen. Was er NICHT belegt, steht in der Deckungsgrenze im Kopf.

/** Wie lange auf die zugeklappte Fläche gewartet wird — dieselbe Größenordnung wie beim Aufklappen. */
const ZUKLAPP_FRIST_MS = 30_000;

/**
 * Der Gegenklick. Bedingt wie `MEHR_KLICK` und aus demselben Grund wiederholbar: steht der Knopf
 * schon auf `false`, tut er nichts, und ein zweiter Durchlauf schaltet nicht versehentlich zurück.
 */
const MEHR_ZUKLAPP_KLICK = `() => {
  const b = document.querySelector('[data-testid="bib-mehr"]');
  if (b === null) return false;
  if (b.getAttribute('aria-expanded') !== 'false') b.click();
  return true;
}`;

/** Knopfzustand und Abschnittszahl in EINEM Blick — die zwei Werte, die „zu" ausmachen. */
const KNOPF_STAND = `() => {
  const b = document.querySelector('[data-testid="bib-mehr"]');
  return {
    knopf: b === null ? '(KEIN KNOPF)' : (b.getAttribute('aria-expanded') || '(ohne aria-expanded)'),
    abschnitte: document.querySelectorAll('[data-bib-abschnitt]').length,
  };
}`;

interface Knopfstand {
  knopf: string;
  abschnitte: number;
}

/**
 * Die Fläche zuklappen, bis sie NACHWEISLICH zu ist: `aria-expanded="false"` UND null Abschnitte.
 * Beides, weil beides gebraucht wird — der Knopf trägt den Zustand (`BibliothekLesen.tsx:1347`), und
 * die Abschnitte verschwinden erst mit dem Neuzeichnen restlos aus dem DOM (`:1356-1360`); nur wenn
 * sie weg sind, läuft die Schleife im Aufklappen wirklich, statt sofort abzubrechen.
 *
 * Läuft die Frist ab, wirft dieser Schritt mit der gemessenen Lage und dem Wort `NICHT GEMESSEN`. Er
 * kehrt NIE still zurück (§9 der Datei): eine Vorbedingung, die nicht hergestellt wurde, darf keine
 * grüne Messung tragen — P4 misst sie zusätzlich selbst, damit auch ein übersprungener Aufruf auffällt.
 */
async function mehrZuklappen(seite: H4Stand["seite"], wo: string): Promise<number> {
  const beginn = Date.now();
  let versuche = 0;
  for (;;) {
    const knopfDa = await seite.evaluate<boolean>(fn(MEHR_ZUKLAPP_KLICK));
    versuche += 1;
    const s = await seite.evaluate<Knopfstand>(fn(KNOPF_STAND));
    if (s.knopf === "false" && s.abschnitte === 0) {
      break;
    }
    if (Date.now() - beginn >= ZUKLAPP_FRIST_MS) {
      throw new Error(
        `${wo}: „Mehr" ist in ${Date.now() - beginn} ms und ${versuche} Klickversuchen nicht zugegangen (Knopf ${knopfDa ? s.knopf : "beim letzten Versuch NICHT MEHR DA"}, noch ${s.abschnitte} Abschnitte) — ${await lage(seite)} — NICHT GEMESSEN`,
      );
    }
    await seite.waitForTimeout(100);
  }
  console.info(
    `JOB 3944 · ${wo}: zugeklappt nach ${versuche} Klickversuch(en) in ${Date.now() - beginn} ms`,
  );
  return versuche;
}

/**
 * DER EINMALIGE KLICKABFANG.
 *
 * CAPTURE-PHASE AM `document` und nicht am Knopf: React führt seine `onClick`-Handler am
 * Wurzelknoten der Anwendung: nur OBERHALB davon ist sicher, dass `stopImmediatePropagation()` den
 * Klick vom Produkt-Handler fernhält. Der Weg eines Klicks läuft von `window` abwärts, also sieht
 * dieser Listener ihn vor jedem Handler weiter unten.
 *
 * EINMALIG UND BEOBACHTBAR: nach dem ersten passenden Klick entschärft er sich selbst (der zweite
 * Versuch muss durchkommen, sonst wäre nichts bewiesen) und hinterlässt einen ZÄHLER. Ohne den
 * Zähler wäre nicht messbar, ob überhaupt etwas abgefangen wurde — ein Fall, der nur „zwei Versuche"
 * sieht, könnte auf einem zufälligen zweiten Klick beruhen.
 */
const ABFANG_EINBAUEN = `() => {
  const w = window;
  w.__job3944Verschluckt = 0;
  w.__job3944Eingebaut = true;
  w.__job3944Scharf = true;
  const abfang = (e) => {
    const ziel = e.target;
    if (!ziel || typeof ziel.closest !== 'function') return;
    if (ziel.closest('[data-testid="bib-mehr"]') === null) return;
    w.__job3944Verschluckt += 1;
    w.__job3944Scharf = false;
    document.removeEventListener('click', abfang, true);
    e.stopImmediatePropagation();
    e.preventDefault();
  };
  document.addEventListener('click', abfang, true);
  w.__job3944Abbau = () => { document.removeEventListener('click', abfang, true); w.__job3944Scharf = false; };
  return true;
}`;

/**
 * Was der Abfang gemessen hat. `eingebaut` steht neben `verschluckt`, weil die zwei Lagen „gar nicht
 * eingebaut" und „eingebaut, aber nie ausgelöst" verschiedene Befunde sind und die Meldung sie
 * auseinanderhalten muss. `verschluckt: -1` heisst: es gab keinen Zähler zu lesen.
 */
const ABFANG_LESEN = `() => ({
  eingebaut: window.__job3944Eingebaut === true,
  scharf: window.__job3944Scharf === true,
  verschluckt: typeof window.__job3944Verschluckt === 'number' ? window.__job3944Verschluckt : -1,
})`;

/** Den Abfang abräumen, falls er nie ausgelöst hat — sonst ist er durch die Einmaligkeit erschöpft. */
const ABFANG_ABBAUEN = `() => {
  if (typeof window.__job3944Abbau === 'function') { window.__job3944Abbau(); return true; }
  return false;
}`;

interface Abfangstand {
  eingebaut: boolean;
  scharf: boolean;
  verschluckt: number;
}

let stand: H4Stand | null = null;
let fehler: string | null = null;
/** Die Lesung auf Deutsch (der Ausgangszustand der Bühne) und die auf Englisch. */
let de: Platzhalterfund[] | null = null;
let en: Platzhalterfund[] | null = null;

/**
 * Was die Folgeprobe (P4, JOB 3944) gemessen hat — alle fünf Zahlen aus EINEM Durchgang, damit die
 * Meldung des Falls die ganze Lage nennen kann und nicht nur den einen verglichenen Wert.
 */
interface Folgeprobe {
  /** Abschnitte VOR dem Versuch. Soll 0 — sonst war die Fläche nicht zu und die Schleife bricht sofort ab. */
  abschnitteVorher: number;
  knopfVorher: string;
  /** Klickversuche, die `mehrAufklappen` gebraucht hat. Soll ≥ 2 — der erste ist verschluckt. */
  versuche: number;
  eingebaut: boolean;
  verschluckt: number;
  abschnitteNachher: number;
  platzhalterNachher: number;
}
let probe: Folgeprobe | null = null;
/**
 * EIGENE Fehlervariable, EIGENER `try`-Block im Aufbau: ein Scheitern der Folgeprobe darf P1/P2/P3
 * nicht röten (deren Werte stehen vorher fest), und umgekehrt sagt P4 ausdrücklich, dass NICHTS
 * gemessen wurde, statt still zu bestehen.
 */
let probefehler: string | null = null;

/**
 * Die Meldung, mit der die drei Fälle einen gescheiterten Aufbau anzeigen.
 *
 * Sie steht als Meldungstext AN der Zusicherung und nicht nur im verglichenen Wert: Vitest kürzt den
 * Wert in der Kopfzeile des Fehlers (Runde 1 im Tor: `expected 'TimeoutError: page.waitForFunction:
 * T…' to be null`, `jobs/3815/runde-1/code.md:24`). Wer diese Zeile liest, soll nicht erst im
 * Protokoll nachschlagen müssen, was gefehlt hat.
 */
const aufbaumeldung = (): string =>
  fehler === null
    ? "der Aufbau der Bühne ist gelungen"
    : `die Bühne ist nicht messbereit geworden — kein Fall dieser Datei hat gemessen: ${fehler}`;

/** Dasselbe für die Folgeprobe, getrennt von `aufbaumeldung` — sie hat ihren eigenen Ausgang. */
const probemeldung = (): string =>
  probefehler === null
    ? "die Folgeprobe ist durchgelaufen"
    : `die Folgeprobe hat NICHT GEMESSEN — über die Klickwiederholung ist damit nichts gesagt: ${probefehler}`;

/** Die gemessene Lage der Folgeprobe als eine Zeile; sie steht an JEDER Zusicherung von P4. */
const probezeile = (): string =>
  probe === null
    ? "NICHT GEMESSEN — die Folgeprobe ist nicht bis zur Messung gekommen"
    : `vorher ${probe.abschnitteVorher} Abschnitte (Knopf ${probe.knopfVorher}) · Abfang ${probe.eingebaut ? "eingebaut" : "NICHT EINGEBAUT"}, ${probe.verschluckt} Klick(s) verschluckt · ${probe.versuche} Klickversuch(e) · danach ${probe.abschnitteNachher} Abschnitte und ${probe.platzhalterNachher} Platzhalter`;

/** Der Fund einer Sollzeile, über Abschnitt und Rang — `null`, wenn dort kein Feld steht. */
const fundZu = (funde: Platzhalterfund[], i: number): Platzhalterfund | null => {
  const soll = SOLLWERTE[i] as Sollzeile;
  return funde.find((f) => f.abschnitt === soll.abschnitt && f.rang === rangVon(i)) ?? null;
};

/**
 * Eine Sprache gegen die Tabelle halten. Die Funde wandern in EIN Feld und werden EINMAL
 * verglichen — ein Lauf zeigt damit ALLE Rückfälle und nicht nur den ersten (Lieferung 3).
 *
 * `erwartet` wählt die Spalte, `gegenprobe` ist die jeweils andere: steht dort der Wortlaut der
 * anderen Sprache, ist es ein RÜCKFALL und die Meldung sagt es. Steht etwas Drittes an `kopplung`,
 * ist es die Anlagenkennung aus `ko.asset` — dann ist nicht gemessen worden, und auch das steht in
 * der Meldung.
 */
function pruefen(
  fall: string,
  funde: Platzhalterfund[],
  erwartet: "deutsch" | "englisch",
): string[] {
  const andere = erwartet === "englisch" ? "deutsch" : "englisch";
  return SOLLWERTE.flatMap((soll, i): string[] => {
    const kopf = `${fall} · Mehr · ${soll.abschnitt} · ${soll.schluessel}`;
    const f = fundZu(funde, i);
    if (f === null) {
      const imAbschnitt = funde.filter((x) => x.abschnitt === soll.abschnitt).length;
      return [
        `${kopf}: NICHT GEMESSEN — an Rang ${rangVon(i)} des Abschnitts steht kein Feld mit Platzhalter (gefunden: ${imAbschnitt} Feld(er) in „${soll.abschnitt}“)`,
      ];
    }
    if (f.text === soll[erwartet]) {
      return [];
    }
    if (f.text === soll[andere]) {
      return [
        `${kopf}: erwartet „${soll[erwartet]}“, gefunden „${f.text}“ (der ${andere === "deutsch" ? "deutsche" : "englische"} Platzhalter steht unübersetzt da)`,
      ];
    }
    if (soll.abschnitt === KOPPLUNG) {
      return [
        `${kopf}: NICHT ANWENDBAR — erwartet „${soll[erwartet]}“, gefunden „${f.text}“; das ist weder die deutsche noch die englische Fassung, also steht dort die Anlagenkennung aus ko.asset (MehrAbschnitte.tsx:1117) und über die Übersetzung ist nichts gesagt`,
      ];
    }
    return [`${kopf}: erwartet „${soll[erwartet]}“, gefunden „${f.text}“`];
  });
}

/** Die gemessene Verteilung als lesbare Zeile — sie steht in jeder Meldung von P3. */
const verteilung = (funde: Platzhalterfund[]): string =>
  JSON.stringify(
    funde.reduce<Record<string, number>>((o, f) => {
      o[f.abschnitt] = (o[f.abschnitt] ?? 0) + 1;
      return o;
    }, {}),
  );

describe("JOB 3815 · die Platzhalter unter „Mehr“ — der zweite Leser (Attribute statt innerText)", () => {
  beforeAll(async () => {
    try {
      stand = await h4Stand("/bibliothek", "pedi@job3815.test");
      // DIE DEUTSCHE LESUNG ZUERST: die Bühne startet ohne gesetzte Sprache, und die Vorgabe des
      // Produkts ist „de" (`apps/web/src/lib/sprachwahl.ts:26`). Sie ist der Massstab von P2.
      //
      // NACH JEDEM `spracheSetzen` WIRD DIE LAGE PROTOKOLLIERT, BEVOR GEWARTET WIRD. Das ist keine
      // Zierde: diese zwei Zeilen sind der Beleg für die Ursache des Tor-Rots von Runde 1 (Kopf der
      // Datei). Steht dort „Knopf „Mehr" (KEIN KNOPF)", dann kehrt `spracheSetzen` zurück, bevor die
      // Lesespalte gezeichnet ist — und ein Aufklappen ohne das Bereitschaftswarten darunter könnte
      // gar nichts treffen.
      await spracheSetzen(stand, "de");
      console.info(`JOB 3815 · unmittelbar nach spracheSetzen(de) — ${await lage(stand.seite)}`);
      await mehrAufklappen(stand.seite, "P2 (Deutsch)");
      de = await stand.seite.evaluate<Platzhalterfund[]>(fn(PLATZHALTER_LESEN));
      // DER SPRACHWECHSEL LÄDT NEU, und die Fläche kommt zugeklappt zurück (gemessen und
      // festgehalten in `h4-funktionsinventar.test.ts:1104-1111`) — deshalb ein zweites Mal
      // aufklappen. Ohne diesen Schritt läse P1 eine leere Fläche und wäre grün, weil er nichts
      // gefunden hat; genau das schliesst P3 aus.
      await spracheSetzen(stand, "en");
      console.info(`JOB 3815 · unmittelbar nach spracheSetzen(en) — ${await lage(stand.seite)}`);
      await mehrAufklappen(stand.seite, "P1 (Englisch)");
      en = await stand.seite.evaluate<Platzhalterfund[]>(fn(PLATZHALTER_LESEN));
      console.info(`JOB 3815 · gelesen — DE ${JSON.stringify(de)} · EN ${JSON.stringify(en)}`);
    } catch (e) {
      fehler = String(e).split("\n").slice(0, 4).join(" | ");
    }

    // ------------------------------------------------------------------------------------------
    // DIE FOLGEPROBE (JOB 3944) — ZULETZT, damit sie die zwei Lesungen weder verzögert noch stört.
    // ------------------------------------------------------------------------------------------
    // `de` und `en` sind zu diesem Zeitpunkt gelesen und liegen in ihren Variablen; was hier noch an
    // der Fläche geschieht, kann P1/P2/P3 nicht mehr erreichen. Umgekehrt gilt: ist die Bühne schon
    // vorher gescheitert, misst auch diese Probe nichts — und sagt es, statt zu behaupten.
    try {
      if (fehler !== null || stand === null) {
        throw new Error(`die Bühne war nicht messbereit: ${fehler ?? "kein Stand"}`);
      }
      const seite = stand.seite;
      await mehrZuklappen(seite, "P4 (Folgeprobe)");
      const vorher = await seite.evaluate<Knopfstand>(fn(KNOPF_STAND));
      await seite.evaluate<boolean>(fn(ABFANG_EINBAUEN));
      const versuche = await mehrAufklappen(seite, "P4 (Folgeprobe)");
      const abfang = await seite.evaluate<Abfangstand>(fn(ABFANG_LESEN));
      const nachher = await seite.evaluate<Flaechenlage>(fn(FLAECHE_LESEN));
      probe = {
        abschnitteVorher: vorher.abschnitte,
        knopfVorher: vorher.knopf,
        versuche,
        eingebaut: abfang.eingebaut,
        verschluckt: abfang.verschluckt,
        abschnitteNachher: nachher.abschnitte,
        platzhalterNachher: nachher.platzhalter,
      };
      console.info(
        `JOB 3944 · Folgeprobe — ${probezeile()} · Abfang danach ${abfang.scharf ? "NOCH SCHARF" : "erschöpft"}`,
      );
    } catch (e) {
      probefehler = String(e).split("\n").slice(0, 4).join(" | ");
    }
    // Der Abfang ist nach dem ersten Treffer erschöpft; hat er nie ausgelöst (gescheiterte Probe),
    // wird er hier abgeräumt. Das Abräumen darf den Befund oben nicht überschreiben.
    try {
      await stand?.seite.evaluate<boolean>(fn(ABFANG_ABBAUEN));
    } catch (e) {
      console.info(`JOB 3944 · der Abfang liess sich nicht abräumen — ${erste(e)}`);
    }
  }, 300_000);

  afterAll(async () => {
    await stand?.browser.close();
    await stand?.app.close();
  }, 60_000);

  it("P1 · auf Englisch ist jeder der acht Platzhalter unter „Mehr“ englisch", () => {
    expect(fehler, aufbaumeldung()).toBeNull();
    const funde = en as Platzhalterfund[];
    // ERFOLGREICH LEER IST NICHT ERFOLGREICH (§9): ohne Funde wäre jede Aussage über die Sprache
    // eine über nichts. Dann ist NICHT GEMESSEN worden, und der Fall ist rot.
    expect(
      funde?.length ?? 0,
      "die englische Lesung fand KEINEN Platzhalter — nicht gemessen",
    ).toBeGreaterThan(0);
    expect(
      pruefen("P1", funde, "englisch"),
      "unter „Mehr“ ist auf Englisch ein Platzhalter deutsch geblieben",
    ).toEqual([]);
    expect(stand?.seitenfehler ?? ["nicht gemessen"]).toEqual([]);
  }, 60_000);

  it("P2 · auf Deutsch ist jeder der acht Platzhalter deutsch — die Gegenrichtung, damit P1 nicht ins Leere greift", () => {
    expect(fehler, aufbaumeldung()).toBeNull();
    const funde = de as Platzhalterfund[];
    expect(
      funde?.length ?? 0,
      "die deutsche Lesung fand KEINEN Platzhalter — nicht gemessen",
    ).toBeGreaterThan(0);
    expect(
      pruefen("P2", funde, "deutsch"),
      "unter „Mehr“ steht auf Deutsch nicht der erwartete Platzhalter — der Leser greift daneben",
    ).toEqual([]);
    expect(stand?.seitenfehler ?? ["nicht gemessen"]).toEqual([]);
  }, 60_000);

  it("P3 · in BEIDEN Sprachen sind es genau acht Platzhalter, in genau dieser Verteilung", () => {
    expect(fehler, aufbaumeldung()).toBeNull();
    const soll = JSON.stringify(Object.fromEntries([...SOLL_VERTEILUNG]));
    for (const [sprache, funde] of [
      ["de", de as Platzhalterfund[]],
      ["en", en as Platzhalterfund[]],
    ] as const) {
      // KOMMT EIN NEUNTES FELD DAZU, wird dieser Fall rot und verlangt eine Zeile in SOLLWERTE —
      // das ist sein Zweck. Fällt eines weg, ebenso.
      expect(
        `${sprache}: ${funde?.length ?? 0} Platzhalter ${verteilung(funde ?? [])}`,
        `die Zahl oder die Verteilung der Platzhalter unter „Mehr“ hat sich geändert — SOLLWERTE (${SOLLWERTE.length} Zeilen) nachführen`,
      ).toBe(`${sprache}: ${SOLLWERTE.length} Platzhalter ${soll}`);
    }
    // `kopplung` misst nur am Eintrag OHNE `ko.asset`. Steht dort die Anlagenkennung, sagt der Fall
    // das ausdrücklich, statt still zu bestehen (§9, Lieferung 5).
    const kopplungSoll = SOLLWERTE.find((s) => s.abschnitt === KOPPLUNG) as Sollzeile;
    for (const [sprache, funde, spalte] of [
      ["de", de as Platzhalterfund[], "deutsch"],
      ["en", en as Platzhalterfund[], "englisch"],
    ] as const) {
      const f = (funde ?? []).find((x) => x.abschnitt === KOPPLUNG) ?? null;
      expect(
        f === null ? "(kein Feld)" : f.text,
        `„kopplung“ trägt in ${sprache} weder die deutsche noch die englische Fassung — dort steht die Anlagenkennung aus ko.asset (MehrAbschnitte.tsx:1117), dieser Fall ist an dieser Stelle NICHT ANWENDBAR und misst die Übersetzung nicht`,
      ).toBe(kopplungSoll[spalte]);
    }
    expect(stand?.seitenfehler ?? ["nicht gemessen"]).toEqual([]);
  }, 60_000);

  it("P4 · ein verschluckter erster Klick — und der ZWEITE öffnet die Fläche trotzdem vollständig (JOB 3944)", () => {
    expect(probefehler, probemeldung()).toBeNull();
    const p = probe as Folgeprobe;
    // (i) DIE VORBEDINGUNG. Ohne zugeklappte Fläche zählt `ABSCHNITTE_ZAEHLEN` schon beim ersten
    // Blick über 0, die Schleife bricht sofort ab und hat NICHTS wiederholt.
    expect(
      p?.abschnitteVorher ?? -1,
      `die Vorbedingung „Fläche zu“ war nicht hergestellt — über die Klickwiederholung ist damit nichts gesagt: ${probezeile()}`,
    ).toBe(0);
    // (ii) DER ABFANG HAT GEGRIFFEN. Genau einer, nicht keiner (dann beruhte ein zweiter Versuch auf
    // Zufall) und nicht mehrere (dann hätte er sich nicht entschärft).
    expect(
      p?.verschluckt ?? -1,
      `der Abfang hat keinen Klick verschluckt (erwartet genau einen) — ein zweiter Versuch belegt dann nichts: ${probezeile()}`,
    ).toBe(1);
    // (iii) DIE WIEDERHOLUNG WAR NÖTIG — die Zahl, die in 114 Protokollzeilen nie über 1 stand.
    expect(
      p?.versuche ?? 0,
      `die Klickwiederholung wurde nicht gebraucht — mit einem einzigen Versuch ist die Zeile in der Schleife ungemessen geblieben: ${probezeile()}`,
    ).toBeGreaterThanOrEqual(2);
    // (iv) DANACH IST DIE FLÄCHE WIRKLICH OFFEN. Ein zweiter Klick, der nur den Rahmen zeichnet,
    // genügt nicht: es müssen alle acht Platzhalter der Sollwerttabelle wieder dastehen.
    expect(
      p?.abschnitteNachher ?? 0,
      `nach dem zweiten Klick stand kein einziger Abschnitt da — die Schleife hat die Fläche nicht geöffnet: ${probezeile()}`,
    ).toBeGreaterThan(0);
    expect(
      p?.platzhalterNachher ?? -1,
      `nach dem zweiten Klick ist die Fläche nicht vollständig offen — erwartet ${SOLLWERTE.length} Platzhalter wie in P3: ${probezeile()}`,
    ).toBe(SOLLWERTE.length);
    // Ein `preventDefault()` an einem Knopf darf keinen Seitenfehler erzeugen — hier gemessen.
    expect(stand?.seitenfehler ?? ["nicht gemessen"]).toEqual([]);
  }, 60_000);
});
