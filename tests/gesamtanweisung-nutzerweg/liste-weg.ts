// ================================================================================================
// JOB 4357 · DIE STATIONEN DES LISTENWEGS — HIER STEHEN SIE GENAU EINMAL.
// ================================================================================================
//
// SIE LIEGEN NEBEN `./weg.ts` UND NICHT DARIN, und das ist eine Entscheidung mit Grund:
// `zeuge-kein-klick-kein-stiller-skip.test.ts` PINNT den Quelltext von `weg.ts` zeichengenau — die
// Zahl der `.innerText`-Stellen, die Zahl der `.textContent`-Stellen, den Wortlaut einzelner Zeilen.
// Jede Ergänzung dort wäre eine Änderung an einem bestehenden, fremden Nachweis. Diese Datei
// IMPORTIERT `weg.ts` und baut nichts davon nach: Prozessstart, Anmeldung, Menüweg, Anlegen,
// Bausteinbindung und die Sichtbarkeitsmessung sind WÖRTLICH die dortigen.
//
// WAS AN DIESER STRECKE ECHT IST — und damit das, was ein Nachweis aus ihr belegen darf:
//   · eine echte PostgreSQL (Wegwerf-Datenbank mit `test` im Namen);
//   · ein echter BETRIEBSSYSTEM-PROZESS (`node --import tsx services/app/src/server.ts`), beendet
//     mit SIGTERM und neu gestartet — kein zweiter Anwendungsaufbau im selben Node-Prozess;
//   · die GEBAUTE Fläche, ausgeliefert von diesem Prozess selbst;
//   · ein echtes Chromium, echte Tastendrücke. `.click(` kommt in dieser Datei und in ihren
//     Aufrufern NICHT vor — das hält `zeuge-liste.test.ts` im Tor fest.
//
// WAS SIE NICHT BELEGT und deshalb nirgends behauptet wird: andere Browser, den Word-Add-in-Host,
// die Ausgabe eines Bildschirmlesers, `docker compose`, TLS, und die Fläche in Englisch oder
// Niederländisch (die Sprachen messen `tests/wiki-gesamtanweisung-abnahme/a12-liste-flaeche.test.tsx`
// am DOM und `menueweg-tastatur-sprachen-prozess.integration.test.ts` am Menüweg).
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { expect } from "vitest";
import { bewerteFrische, frischeMeldung, sammleFrische } from "../../scripts/dist-frische";
import { DIST, type Seite, fn, tabBisZu, warte } from "../gast-nutzerweg/browserweg";
import { MARKE as WEG_MARKE, WURZEL, fokusMussSichtbarSein, mussSichtbarTragen } from "./weg";

export const MARKE = `${WEG_MARKE} LISTE`;

/** Die Marke der Bestandsliste — dieselbe Zeichenfolge wie `LISTE_MARKE` auf der Fläche. */
export const LISTE = "ga-liste";

/** Der Selektor der Zeile GENAU DIESER Anweisung. Nicht „die erste Zeile": das wäre eine Annahme. */
export function zeileVon(anweisungId: string): string {
  return `[data-testid="${LISTE}-eintrag"][data-anweisung="${anweisungId}"]`;
}

/** Der Selektor des fokussierbaren Elements GENAU DIESER Zeile. */
export function linkVon(anweisungId: string): string {
  return `[data-testid="${LISTE}-oeffnen"][data-anweisung="${anweisungId}"]`;
}

// ------------------------------------------------------------------------------------------------
// DIE GEBAUTE FLÄCHE — UND WARUM HIER MEHR VERLANGT WIRD ALS „SIE IST DA"
// ------------------------------------------------------------------------------------------------
//
// `stelleFlaecheBereit` (`./weg.ts`) baut NUR, wenn `apps/web/dist/index.html` FEHLT. Für die
// bestehenden Strecken trägt das: sie messen Wege, die es seit Monaten gibt. Für diese Strecke wäre
// es die teuerste Falle der ganzen Lieferung — ein vorhandenes, ÄLTERES Bündel kennt die
// Bestandsliste nicht, und der Nachweis wäre rot (oder, schlimmer, ein grüner Fall an einer Fläche,
// die es in `dist` gar nicht gibt).
//
// DIE FRISCHEFRAGE WIRD NICHT NACHGEBAUT: `bewerteFrische`/`sammleFrische`
// (`scripts/dist-frische.ts`) sind die EINE Stelle des Hauses, an der „ist dieses Bündel jünger als
// alles, woraus es entsteht" entschieden wird — dieselbe Funktion, die `npm run smoke:ui:gate`
// fährt. Eine eigene Zeitstempelrechnung hier wäre die zweite Auslegung derselben Frage.
//
// GEBAUT WIRD, STATT ABGEBROCHEN, und das ist der Unterschied zum Torwächter: dort ist der Abbruch
// richtig, weil ein Mensch davorsteht und den Befehl kennt. Hier läuft niemand mit, und ein Abbruch
// hiesse „dieser Pflichtfall ist nicht messbar" — obwohl der Bau zwei Minuten dauert. Der Grund
// steht im Rückgabetext dieser Funktion und wandert in das Protokoll des Laufs.

/** Die Fläche frisch herstellen — oder laut sagen, warum sie es nicht ist. */
export function stelleFrischeFlaecheBereit(): string {
  const vorher = bewerteFrische(sammleFrische(WURZEL));
  if (vorher.frisch) {
    return "war frisch";
  }
  const begonnen = Date.now();
  execFileSync("npx", ["vite", "build"], {
    cwd: join(WURZEL, "apps/web"),
    stdio: "pipe",
    timeout: 600_000,
  });
  if (!existsSync(join(DIST, "index.html"))) {
    throw new Error(`${MARKE}: der Bau lief durch, aber ${DIST}/index.html fehlt weiterhin.`);
  }
  const nachher = bewerteFrische(sammleFrische(WURZEL));
  if (!nachher.frisch) {
    // KEIN STILLES WEITERLAUFEN: ein Bündel, das nach dem Bau noch älter ist als eine Quelle,
    // gehört zu einem anderen Quellstand. Ein Nachweis darauf sagte über diesen nichts.
    throw new Error(
      `${MARKE}: nach dem Bau ist das Bündel weiterhin nicht frisch.\n${frischeMeldung(nachher)}`,
    );
  }
  return `gebaut in ${Date.now() - begonnen} ms (Anlass: ${vorher.grund}, ${vorher.quelleDatei})`;
}

// ------------------------------------------------------------------------------------------------
// DAS AKTIVE ELEMENT — WER TRÄGT DEN FOKUS, UND WOHIN ZEIGT ER?
// ------------------------------------------------------------------------------------------------
//
// Abnahmekriterium 2 verlangt wörtlich: „der Prüffall misst `document.activeElement` VOR dem Öffnen
// und die Adresse DANACH." Beides steht hier, und zwar als BEFUND und nicht als Zusicherung: der
// Befund reist in die Meldung, damit ein Rot auf den Schuldigen zeigt statt auf „irgendwas ist
// anders".
//
// `href` gehört dazu, weil er die eigentliche Zusage trägt: ein fokussiertes Element ohne Adresse
// könnte Enter nur über einen selbst gebauten Tastenbehandler beantworten — genau die Bauform, die
// diese Lieferung nicht hat und nicht bekommen soll.
const AKTIV_BEFUND = `() => {
  const a = document.activeElement;
  if (!a) return { da: false, marke: "", testid: "", anweisung: "", href: "", tabindex: "", text: "" };
  return {
    da: true,
    marke: a.tagName.toLowerCase(),
    testid: a.getAttribute("data-testid") || "",
    anweisung: a.getAttribute("data-anweisung") || "",
    href: a.getAttribute("href") || "",
    tabindex: a.getAttribute("tabindex") || "",
    text: String(a.textContent || "").replace(/\\s+/g, " ").trim(),
  };
}`;

/** Wer trägt gerade den Fokus — und wohin zeigt er? */
export interface Aktivbefund {
  da: boolean;
  marke: string;
  testid: string;
  anweisung: string;
  href: string;
  tabindex: string;
  text: string;
}

export async function aktivbefund(seite: Seite): Promise<Aktivbefund> {
  return seite.evaluate<Aktivbefund>(fn(AKTIV_BEFUND));
}

/** Ein Befund in einem Satz — für Fehlermeldungen, die auf den Schuldigen zeigen. */
export function aktivsatz(b: Aktivbefund): string {
  return b.da
    ? `<${b.marke}> testid=${b.testid || "(keine)"} anweisung=${b.anweisung || "(keine)"} href=${b.href || "(keiner)"} tabindex=${b.tabindex || "(keiner)"} text="${b.text.slice(0, 80)}"`
    : "aktiv: (nichts)";
}

// ------------------------------------------------------------------------------------------------
// DER LISTENWEG
// ------------------------------------------------------------------------------------------------

export interface Listenwegbefund {
  /** Tab-Anschläge vom Dokumentanfang bis zum Eintrag dieser Anweisung. */
  schritte: number;
  /** `document.activeElement` UNMITTELBAR vor dem Enter. */
  aktivVorher: Aktivbefund;
  /** Die Adresse NACH dem Enter — gelesen am Browser, nicht aus einer Zusage. */
  adresseNachher: string;
  /** Der sichtbar gelesene Text der Zeile dieser Anweisung. */
  zeilentext: string;
}

/**
 * DIE ZEILE DIESER ANWEISUNG STEHT SICHTBAR DA — mit Titel UND Stand.
 *
 * Gemessen wird mit `mussSichtbarTragen` (`./weg.ts`) und damit JE TEXTKNOTEN: `checkVisibility` am
 * Elternelement, Deckkraft, `content-visibility`, die Fläche eines `Range` um GENAU diese Zeichen und
 * die Schriftfarbe. Der Grund dafür ist dort ausgeschrieben und in vier Runden bezahlt (JOB 4323
 * R1–R4): DOM-Anwesenheit und `textContent` sind kein Sichtbarkeitsnachweis, und ein sichtbarer
 * Behälter belegt nicht die Sichtbarkeit seines Inhalts.
 *
 * ZWEI GETRENNTE MESSUNGEN und nicht eine über die Zeile: der Stand steht in einem eigenen Absatz,
 * und ein Titel ohne Stand wäre eine halbe Zeile, die man an der Gesamtzeile nicht sieht.
 */
export async function zeileMussSichtbarSein(
  seite: Seite,
  anweisungId: string,
  titel: string,
  standwort: string,
  wann: string,
): Promise<string> {
  const zeile = zeileVon(anweisungId);
  await warte(
    seite,
    "(sel) => !!document.querySelector(sel)",
    `${wann}: die Zeile der Anweisung ${anweisungId} in der Bestandsliste`,
    zeile,
    45_000,
  );
  const text = await mussSichtbarTragen(
    seite,
    zeile,
    titel,
    `${wann}: der Titel der gespeicherten Anweisung steht nicht sichtbar in der Liste`,
  );
  await mussSichtbarTragen(
    seite,
    `${zeile} [data-testid="${LISTE}-stand"]`,
    standwort,
    `${wann}: der Stand der gespeicherten Anweisung steht nicht sichtbar in ihrer Zeile`,
  );
  return text;
}

/**
 * VOM EINTRAG ZUR ANWEISUNG — per Tab und Enter, ohne getippte Adresse.
 *
 * DREI DINGE WERDEN GEMESSEN, und jedes einzeln kann schiefgehen:
 *   1. der Eintrag ist per Tab ERREICHBAR (`tabBisZu` über `fokusMussSichtbarSein` hinaus: ein
 *      Element ausserhalb der Tab-Reihenfolge lässt diesen Aufruf scheitern);
 *   2. der Fokus ist SICHTBAR (sonst weiss ein Mensch nicht, wo er ist);
 *   3. das aktive Element ist WIRKLICH der Eintrag DIESER Anweisung, und seine Adresse ist die
 *      dieser Anweisung — vor dem Enter. Ohne diesen Schritt könnte ein anderer Link den Nachweis
 *      tragen und die Adresse danach zufällig stimmen.
 * Erst dann Enter, und erst dann die Adresse.
 */
export async function eintragOeffnenMitTastatur(
  seite: Seite,
  anweisungId: string,
  titel: string,
  standwort: string,
  wann: string,
): Promise<Listenwegbefund> {
  const zeilentext = await zeileMussSichtbarSein(seite, anweisungId, titel, standwort, wann);
  const schritte = await tabBisZu(seite, linkVon(anweisungId), 250, true);
  await fokusMussSichtbarSein(seite, `${wann}: Eintrag „${titel}" in der Bestandsliste`);

  const aktivVorher = await aktivbefund(seite);
  expect(
    aktivVorher.anweisung,
    `${MARKE}: ${wann} — der Fokus steht nicht auf dem Eintrag von ${anweisungId}: ${aktivsatz(aktivVorher)}`,
  ).toBe(anweisungId);
  expect(
    aktivVorher.marke,
    `${MARKE}: ${wann} — das fokussierte Element ist kein Link: ${aktivsatz(aktivVorher)}`,
  ).toBe("a");
  expect(
    aktivVorher.href,
    `${MARKE}: ${wann} — der fokussierte Eintrag zeigt nicht auf seine Anweisung: ${aktivsatz(aktivVorher)}`,
  ).toBe(`/gesamtanweisungen/${anweisungId}`);

  await seite.keyboard.press("Enter");
  await warte(
    seite,
    `(id) => window.location.pathname === "/gesamtanweisungen/" + id
      && !!document.querySelector('[data-testid="ga-seite"]')`,
    `${wann}: die geöffnete Anweisung ${anweisungId} nach Enter auf ihrem Eintrag`,
    anweisungId,
    45_000,
  );
  return { schritte, aktivVorher, adresseNachher: seite.url(), zeilentext };
}
