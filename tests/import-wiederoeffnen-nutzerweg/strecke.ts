// ================================================================================================
// JOB 4324 · DER WERKZEUGKASTEN DER EINEN STRECKE — und was hier NEU ist statt abgeschrieben.
// ================================================================================================
//
// Diese Datei ist KEIN Test. Sie hält, was der Integrationsfall daneben braucht und was es im Haus
// noch nicht gibt. Alles, was es GIBT, wird IMPORTIERT und nicht nachgebaut:
//
//   · Die Bedienschritte des Dateiwegs  → `tests/ux19-speichern-oeffnen-reload/ux19-buehne.ts`
//     (`dateiwegOeffnen`, `ganzdokumentWaehlen`, `speichernDruecken`, `kennungAusOeffnenLink`,
//     `KLICK_KNOPF`, die Wartebudgets) und `tests/d3-dateien-durchgaengig/d3-buehne.ts`
//     (`dateiUeberSichtbareAuswahl`, `aufEingelesenWarten`, `quellenanzeige`, `satz`).
//   · Der echte Socket, die echten Ablagen → `tests/gast-nutzerweg/strecke.ts` (`starteStrecke`,
//     `ersteinrichtung`).
//   · Chromium, das Profil, der Tastaturweg → `tests/gast-nutzerweg/browserweg.ts`
//     (`starteChromium`, `profil`, `tippeMitTastatur`, `warte`, `mitFlaeche`, `DIST`).
//     DIESE DATEI WIRD NICHT ANGEFASST — JOB 4322 hält sie (Auftrag §4).
//   · Die Quelldatei und ihr gemessener Satz → `tests/demo-erster-nutzerweg/strecke.ts`
//     (`QUELLDATEI`, `QUELLSATZ`). Abgeschrieben wird hier kein Produkttext.
//
// ------------------------------------------------------------------------------------------------
// WAS NEU IST — und warum es nicht anders ging.
// ------------------------------------------------------------------------------------------------
//
// 1. DIE LOKALEN NACHDEKLARATIONEN (Auftrag §5 Lieferung 4). `browserweg.Seite` kennt weder `route`
//    noch `waitForEvent`, `browserweg.Browser` kein `version()`. Das Haus hat für genau diese Lage
//    ein Muster, und es wird hier befolgt statt die gemeinsame Datei zu erweitern:
//    `d3-buehne.ts:55-67` (`SeiteMitDialog` mit `waitForEvent`) und
//    `tests/sharepoint-inhalt-gesamtweg/strecke.ts:1373-1383` (`BrowserMitVersion`).
//
// 2. DIE LESEWEICHE. `ux19-buehne.entwurfsWeicheLegen` kann hier nicht dienen, und zwar aus ZWEI
//    Gründen, nicht aus einem: sie legt ihre Route auf `${ORIGIN}/api/drafts` (ORIGIN ist die feste
//    Herkunft der H3-Bühne, `http://localhost`) und sie fängt ausschliesslich `POST` ab. Diese
//    Strecke läuft über einen echten Socket auf `http://127.0.0.1:<port>` und braucht `GET
//    /api/drafts/<id>`. Die BAUFORM ist Zeichen für Zeichen dieselbe (`ux19-buehne.ts:633-660`):
//    Weichenstand, `fulfill` im Fehlerschema aus `services/app/src/http.ts`, `abort("failed")`,
//    `fallback()` für alles andere.
//
// 3. DIE SICHTBARKEITSPRÜFUNG. REGELN.md 9 verlangt Sichtbarkeit statt Anwesenheit, je
//    texttragendem Nachkommen, und eine Kalibrierung durch gezieltes Ausblenden. Die vorhandenen
//    Ableser des Hauses (`SEITENTEXT`, `BLATT_TEXT`, `QUELLE_BLOCKQUOTE`) lesen alle `textContent`
//    — genau das, was die Regel ausschliesst. Also steht der Ableser hier.
//
// KEINE PRODUKTDATEI WIRD BERÜHRT. Jeder Sollsatz kommt aus dem Katalog (`satz`) oder aus dem
// echten Rumpfbauer (`persistierteQuellenzeile`), keiner ist abgeschrieben.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import type { Pool } from "pg";
import { expect } from "vitest";
import i18n from "../../apps/web/src/i18n";
import { wholeDocumentBodyHtml } from "../../apps/web/src/lib/captureFromFile";
import type { SeiteMitDialog } from "../d3-dateien-durchgaengig/d3-buehne";
import { QUELLDATEI } from "../demo-erster-nutzerweg/strecke";
import { fn } from "../design/h3-blatt-buehne";
import type { Browser } from "../gast-nutzerweg/browserweg";
import { DIST } from "../gast-nutzerweg/browserweg";
import type { DateiAnlage, Weiche } from "../ux19-speichern-oeffnen-reload/ux19-buehne";
import {
  KLICK_KNOPF,
  WARTEBUDGET,
  wartebudget,
} from "../ux19-speichern-oeffnen-reload/ux19-buehne";

export const JOB = "[KLARWERK] JOB 4324";

// ------------------------------------------------------------------------------------------------
// 1 · Die lokalen Nachdeklarationen (Lieferung 4)
// ------------------------------------------------------------------------------------------------

/**
 * Die Seite dieser Strecke: die Fähigkeiten der D3-Bühne (Dateiwähler, Tastatur, Zeigerklick) PLUS
 * die vier, die erst der Fehlerfall und die neue Sitzung brauchen. Vorbild und Begründung:
 * `d3-buehne.ts:55-67` — nachdeklariert wird der ZUGANG zu dem, was Playwright ohnehin kann, nicht
 * ein neues Verhalten.
 *
 * `close()` ist dabei kein Zierrat: der Dateiweg lässt eine geänderte Fläche zurück, und die hängt
 * an `useUnloadGuard` (`Capture.tsx:2730`). Ein `goto` auf die nächste Station liefe damit in einen
 * `beforeunload`-Dialog, den der Prüfstand — nicht das Produkt — entscheiden müsste. Jede Station
 * bekommt deshalb eine frische Seite DESSELBEN Profils (gleiche Kekse, gleiche Sitzung).
 */
export type SeiteMitDialogUndRoute = SeiteMitDialog & {
  reload(opts?: Record<string, unknown>): Promise<unknown>;
  unroute(url: string): Promise<void>;
  url(): string;
  fill(selektor: string, wert: string): Promise<void>;
  close(opts?: Record<string, unknown>): Promise<void>;
};

/**
 * Der Browser mit seiner Version. Vorbild: `tests/sharepoint-inhalt-gesamtweg/strecke.ts:1373-1383`.
 * Sie gehört in die Protokollzeile (Auftrag §5 Lieferung 5) — ein Browsernachweis ohne die Angabe,
 * WELCHER Browser, ist eine halbe Auskunft.
 */
export type BrowserMitVersion = Browser & { version(): string };

// ------------------------------------------------------------------------------------------------
// 1b · Der Schalter der Gegenproben — und warum er ZWEI Formen hat
// ------------------------------------------------------------------------------------------------

/** Der Umgebungsschalter aus dem Auftrag (§5 Lieferung 3). */
export const KALIBRIERUNG_SCHALTER = "KLARWERK_KALIBRIERUNG";

/**
 * Die Ersatzform desselben Schalters: eine leere Marke neben dieser Datei.
 *
 * WARUM ES SIE GIBT, und das ist gemessen, nicht vermutet: die Arbeitsprüfungen dieses Jobs laufen
 * über `register/cloud/remote-test.sh`, und der Wrapper nimmt AUSSCHLIESSLICH die Befehlsformen
 * `npx vitest run …`, `npx tsc --noEmit …`, `npx playwright test …`, `npm run build/typecheck`,
 * `./tools/build`, `./tools/check` an. Ein vorangestelltes `env KLARWERK_KALIBRIERUNG=1 …` wird
 * abgewiesen („Cloud-Auftrag: Nur vitest run, playwright test, tsc --noEmit, …"), und eine
 * Verkettung (`A=1 npx …`) ebenso. Der Umgebungsschalter allein wäre in der Cloud also gar nicht
 * stellbar — und damit wäre die Gegenprobe nicht fahrbar, nicht etwa bestanden.
 *
 * Die Marke wird für den Gegenprobenlauf angelegt und danach entfernt; sie liegt in keinem Commit.
 * Fehlt sie und fehlt der Umgebungsschalter, sind die Gegenproben AUS — im Tor bleibt also kein
 * dauerhaft roter Fall stehen.
 */
export const KALIBRIERUNG_MARKE = resolve(
  process.cwd(),
  "tests/import-wiederoeffnen-nutzerweg/KALIBRIERUNG",
);

/** Sind die Gegenproben scharf? */
export function kalibrierungScharf(umgebung: NodeJS.ProcessEnv = process.env): boolean {
  return umgebung[KALIBRIERUNG_SCHALTER] === "1" || existsSync(KALIBRIERUNG_MARKE);
}

/** Wie der Schalter gestellt wurde — für die Protokollzeile, damit niemand raten muss. */
export function kalibrierungHerkunft(umgebung: NodeJS.ProcessEnv = process.env): string {
  if (umgebung[KALIBRIERUNG_SCHALTER] === "1") {
    return `SCHARF (${KALIBRIERUNG_SCHALTER}=1)`;
  }
  if (existsSync(KALIBRIERUNG_MARKE)) {
    return `SCHARF (Marke ${KALIBRIERUNG_MARKE})`;
  }
  return `übersprungen (weder ${KALIBRIERUNG_SCHALTER}=1 noch die Marke — die Gegenproben sind ein eigener, absichtlich roter Lauf)`;
}

// ------------------------------------------------------------------------------------------------
// 2 · Die Datei, die ein Mensch wählt — echte Bytes, kein Nachbau
// ------------------------------------------------------------------------------------------------

/** Die MIME-Kennung, die ein Browser einer .docx aus dem Dateidialog mitgibt. */
export const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/** Der Dateiname, wie ihn die Fläche zeigt — abgeleitet aus dem Pfad, nicht getippt. */
export const DATEI_NAME = basename(QUELLDATEI);

/** Die reale DOCX als Playwright-Anlage: gelesen von der Platte, Byte für Byte. */
export function quellAnlage(): DateiAnlage {
  return {
    name: DATEI_NAME,
    mimeType: DOCX_MIME,
    buffer: readFileSync(QUELLDATEI),
  };
}

/**
 * Die PERSISTIERTE Quellenzeile eines Ganzdokument-Entwurfs — der erste Absatz des
 * Quelle-Blockquote, den `wholeDocumentBodyHtml` erzeugt.
 *
 * Dieselbe Technik wie `d3-buehne.persistierterFormathinweis` (das den ZWEITEN Absatz zieht) und
 * aus demselben Grund: der Satz kommt aus dem echten Rumpfbauer, damit im Prüfstand keine zweite
 * Abschrift steht, die eines Tages von der ersten abweicht. Er ist der EINE Satz, an dem die
 * Herkunft am Entwurf hängt — und weil er nur dort steht, trägt er auch die Kalibrierung.
 */
export function persistierteQuellenzeile(name: string): string {
  const html = wholeDocumentBodyHtml({
    fileName: name,
    text: "x",
    sourceKind: "docx",
    locale: i18n.language,
  });
  const block = /<blockquote>([\s\S]*?)<\/blockquote>/.exec(html)?.[1] ?? "";
  const absaetze = [...block.matchAll(/<p>([\s\S]*?)<\/p>/g)].map((m) => m[1] ?? "");
  return (absaetze[0] ?? "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

// ------------------------------------------------------------------------------------------------
// 3 · Sichtbarkeit — der Ableser, den REGELN.md 9 verlangt
// ------------------------------------------------------------------------------------------------
//
// GESUCHT WIRD DER TEXTTRAGENDE NACHKOMME, nicht der Container: ein sichtbarer Kasten belegt nicht,
// dass sein `innerText` sichtbar ist (REGELN.md 9, JOB 4295 R3). Geprüft wird deshalb je Element,
// das den Satz in einem EIGENEN Textknoten trägt — und an ihm die ganze Kette nach oben (`display`,
// `visibility`, `opacity`), seine Fläche und seine Schriftfarbe.
//
// `textContent` kommt hier nicht vor: es liest auch, was in einem `display:none`-Teilbaum steht.

const SICHTBAR_HILFEN = `
  const durchsichtig = (farbe) =>
    farbe === 'transparent' || /rgba\\(\\s*\\d+\\s*,\\s*\\d+\\s*,\\s*\\d+\\s*,\\s*0(\\.0+)?\\s*\\)/.test(farbe);
  const sichtbar = (el) => {
    let e = el;
    while (e && e.nodeType === 1) {
      const s = getComputedStyle(e);
      if (s.display === 'none' || s.visibility === 'hidden' || s.visibility === 'collapse') { return false; }
      if (Number.parseFloat(s.opacity || '1') === 0) { return false; }
      e = e.parentElement;
    }
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const traegerVon = (suche) => {
    const treffer = [];
    const alle = document.querySelectorAll('*');
    for (let i = 0; i < alle.length; i += 1) {
      const el = alle[i];
      let text = '';
      for (let k = 0; k < el.childNodes.length; k += 1) {
        const kind = el.childNodes[k];
        if (kind.nodeType === 3) { text += kind.nodeValue || ''; }
      }
      if (text.replace(/\\s+/g, ' ').indexOf(suche) === -1) { continue; }
      if (!sichtbar(el)) { continue; }
      if (durchsichtig(getComputedStyle(el).color)) { continue; }
      treffer.push(el);
    }
    return treffer;
  };
`;

/** Steht dieser Satz auf einem SICHTBAREN Textträger? */
export const SATZ_IST_SICHTBAR = `(suche) => {${SICHTBAR_HILFEN}
  return traegerVon(suche).length > 0;
}`;

/**
 * Blendet JEDEN sichtbaren Textträger dieses Satzes aus und merkt den alten Stilwert.
 *
 * ALLE und nicht nur den ersten: bliebe ein zweiter Träger stehen, meldete der Ableser weiter
 * „sichtbar" — die Kalibrierung wäre dann nicht scharf, sondern nur nicht scharf GENUG, und das
 * sähe von aussen gleich aus. Die Fläche bleibt im Übrigen unangetastet; `TRAEGER_EINBLENDEN`
 * stellt sie Zeichen für Zeichen wieder her.
 */
export const TRAEGER_AUSBLENDEN = `([suche, art]) => {${SICHTBAR_HILFEN}
  const ziele = traegerVon(suche);
  if (ziele.length === 0) { return 0; }
  const wert = art === 'display' ? 'none' : 'hidden';
  window.__kw4324 = [];
  for (let i = 0; i < ziele.length; i += 1) {
    const el = ziele[i];
    window.__kw4324.push({
      el: el,
      art: art,
      alt: el.style.getPropertyValue(art),
      prio: el.style.getPropertyPriority(art),
    });
    el.style.setProperty(art, wert, 'important');
  }
  return ziele.length;
}`;

/** Stellt die zuletzt ausgeblendeten Träger wieder her. */
export const TRAEGER_EINBLENDEN = `() => {
  const p = window.__kw4324;
  if (!p) { return false; }
  for (let i = 0; i < p.length; i += 1) {
    const e = p[i];
    if (e.alt) { e.el.style.setProperty(e.art, e.alt, e.prio); } else { e.el.style.removeProperty(e.art); }
  }
  delete window.__kw4324;
  return true;
}`;

/** Die sichtbaren Quittungen (`<output>`, der Toast-Träger `shell/ToastViewport.tsx:22`). */
export const SICHTBARE_QUITTUNGEN = `() => {${SICHTBAR_HILFEN}
  const aus = [];
  const outs = document.querySelectorAll('output');
  for (let i = 0; i < outs.length; i += 1) {
    const el = outs[i];
    if (!sichtbar(el)) { continue; }
    aus.push((el.innerText || '').replace(/\\s+/g, ' ').trim());
  }
  return aus;
}`;

export type Ausblendart = "display" | "visibility";

/** Nur ausblenden — für die Gegenproben, die den Zustand STEHEN lassen sollen. */
export async function ausblenden(
  seite: SeiteMitDialogUndRoute,
  satzText: string,
  art: Ausblendart,
): Promise<number> {
  return seite.evaluate<number>(fn(TRAEGER_AUSBLENDEN), [satzText, art]);
}

/** Die Rücknahme. */
export async function einblenden(seite: SeiteMitDialogUndRoute): Promise<boolean> {
  return seite.evaluate<boolean>(fn(TRAEGER_EINBLENDEN));
}

/**
 * DIE EINE SICHTBARKEITSZUSICHERUNG DIESER STRECKE — mit ihrer Kalibrierung eingebaut.
 *
 * REGELN.md 9: „Kalibriere jede Sichtbarkeitsbehauptung durch gezieltes Ausblenden genau dieses
 * Elements … der unveränderte Test MUSS daran mit konkretem Feldnamen scheitern; nach Rücknahme
 * wieder grün." Genau diese drei Schritte stehen hier, und sie laufen bei JEDEM Aufruf — nicht nur
 * unter einem Schalter. Ein Nachweis, dessen Messmittel nur im Sonderlauf geprüft wird, ist im
 * Regellauf unbelegt.
 *
 * Die Wiederherstellung läuft VOR dem Urteil und auch dann, wenn der Ableser wirft (dieselbe Lehre
 * wie `d3-buehne.ablesungKalibrieren`, Runde 5) — sonst bliebe die Fläche für alle folgenden
 * Stationen verstellt.
 */
export async function sichtbarZugesichert(
  seite: SeiteMitDialogUndRoute,
  satzText: string,
  feldname: string,
  art: Ausblendart = "display",
): Promise<void> {
  expect(
    await seite.evaluate<boolean>(fn(SATZ_IST_SICHTBAR), satzText),
    `„${feldname}" ist für einen Menschen NICHT SICHTBAR — der Satz «${satzText}» steht auf keinem sichtbaren Textträger dieser Seite (${seite.url()})`,
  ).toBe(true);

  const ausgeblendet = await ausblenden(seite, satzText, art);
  expect(
    ausgeblendet,
    `Kalibrierung „${feldname}": kein sichtbarer Textträger für «${satzText}» zum Ausblenden gefunden`,
  ).toBeGreaterThan(0);

  let waehrend = true;
  let lesefehler: unknown;
  let hatGeworfen = false;
  try {
    waehrend = await seite.evaluate<boolean>(fn(SATZ_IST_SICHTBAR), satzText);
  } catch (fehler) {
    hatGeworfen = true;
    lesefehler = fehler;
  }
  const zurueck = await einblenden(seite);
  if (hatGeworfen) {
    throw new Error(
      `Kalibrierung „${feldname}": der Ableser hat geworfen (Rücknahme ${zurueck ? "gelungen" : "GESCHEITERT — die Fläche bleibt verstellt"}).`,
      { cause: lesefehler },
    );
  }
  expect(
    zurueck,
    `Kalibrierung „${feldname}": der ausgeblendete Träger liess sich nicht wiederherstellen — die Fläche bleibt verstellt`,
  ).toBe(true);
  expect(
    waehrend,
    `Kalibrierung „${feldname}" GESCHEITERT: «${satzText}» galt weiter als sichtbar, obwohl ${ausgeblendet} Träger mit ${art} ausgeblendet waren — diese Zusicherung misst nicht die Sichtbarkeit`,
  ).toBe(false);
  expect(
    await seite.evaluate<boolean>(fn(SATZ_IST_SICHTBAR), satzText),
    `Kalibrierung „${feldname}": «${satzText}» kam nach der Rücknahme nicht zurück`,
  ).toBe(true);
}

/** Der Gegenbeweis: dieser Satz darf NICHT sichtbar sein. */
export async function nichtSichtbarZugesichert(
  seite: SeiteMitDialogUndRoute,
  satzText: string,
  feldname: string,
): Promise<void> {
  expect(
    await seite.evaluate<boolean>(fn(SATZ_IST_SICHTBAR), satzText),
    `„${feldname}": «${satzText}» ist sichtbar, obwohl an dieser Stelle nichts geladen sein darf`,
  ).toBe(false);
}

// ------------------------------------------------------------------------------------------------
// 4 · Warten auf einen Zustand — nie auf eine Frist
// ------------------------------------------------------------------------------------------------

/** Wartet, bis der Ableser `true` liefert; nennt bei Ablauf Schritt, Erwartung und Adresse. */
export async function aufZustandWarten(
  seite: SeiteMitDialogUndRoute,
  quelle: string,
  erwartet: string,
  arg?: unknown,
  budget = wartebudget("aufFlaechensatzWarten"),
): Promise<void> {
  const start = Date.now();
  let letzterFehler = "keiner";
  for (;;) {
    try {
      if (await seite.evaluate<boolean>(fn(quelle), arg)) {
        return;
      }
    } catch (e) {
      letzterFehler = String(e).split("\n")[0] ?? "";
    }
    if (Date.now() - start >= budget) {
      throw new Error(
        `${JOB}: ${erwartet} — nicht eingetreten in ${Date.now() - start} ms von ${budget} ms auf ${seite.url()} · letzter Ableserfehler: ${letzterFehler}`,
      );
    }
    await new Promise((auf) => setTimeout(auf, WARTEBUDGET.taktMs));
  }
}

/** Wartet, bis dieser Satz SICHTBAR ist (nicht: vorhanden). */
export async function aufSichtbarkeitWarten(
  seite: SeiteMitDialogUndRoute,
  satzText: string,
  feldname: string,
): Promise<void> {
  await aufZustandWarten(
    seite,
    SATZ_IST_SICHTBAR,
    `der Satz «${satzText}» („${feldname}") wird sichtbar`,
    satzText,
  );
}

/** Der Selektor steht auf der Seite. */
export const SELEKTOR_DA = "(sel) => document.querySelector(sel) !== null";
/** Der Selektor steht NICHT auf der Seite. */
export const SELEKTOR_WEG = "(sel) => document.querySelector(sel) === null";

/** Klickt den ersten BETÄTIGBAREN Knopf mit diesem Text (`ux19-buehne.KLICK_KNOPF`). */
export async function klickKnopf(seite: SeiteMitDialogUndRoute, text: string): Promise<boolean> {
  return seite.evaluate<boolean>(fn(KLICK_KNOPF), text);
}

// ------------------------------------------------------------------------------------------------
// 5 · Die Leseweiche vor `GET /api/drafts/<id>`
// ------------------------------------------------------------------------------------------------

/**
 * `durch`   — `fallback()` an die echte Fastify-App über den echten Socket.
 * `fehler`  — 500 im Fehlerschema aus `services/app/src/http.ts:130` (`{error,message}`).
 * `abbruch` — der Aufruf kommt gar nicht an (Netz weg).
 *
 * Dieselben drei Stände wie `ux19-buehne.Weichenstand` (dort für `POST`), ohne `langsam`: ein
 * Wartezustand ist an DIESEM Weg nicht der Gegenstand.
 */
export type Lesestand = "durch" | "fehler" | "abbruch";

/** Der Code und der Satz, die die gestellte 500-Antwort mitschickt. */
export const LESEWEICHE_FEHLERCODE = "JOB4324_TESTFEHLER";
export const LESEWEICHE_FEHLERSATZ =
  "Der Entwurf konnte nicht gelesen werden (gestellter Serverfehler JOB 4324).";

export interface Leseweiche {
  setze(stand: Lesestand): void;
  readonly zaehler: { readonly angekommen: number; readonly beendet: number };
  /** Die Route wieder wegnehmen — danach spricht die Seite unvermittelt mit dem echten Server. */
  abraeumen(): Promise<void>;
}

/**
 * Legt die Weiche vor GENAU EINEN Leseweg: `GET <basis>/api/drafts/<id>`.
 *
 * Alles andere — auch jede andere Methode auf derselben Adresse — geht über `fallback()` an die
 * echte App. Ohne diese Einschränkung fiele der Speicherweg mit in den Fehlerfall, und der
 * Nachweis „die Zeile ist danach dieselbe" sagte nichts mehr über das Laden aus.
 */
export async function leseweicheLegen(
  seite: SeiteMitDialogUndRoute,
  basis: string,
  entwurfId: string,
): Promise<Leseweiche> {
  const adresse = `${basis}/api/drafts/${entwurfId}`;
  let stand: Lesestand = "durch";
  let angekommen = 0;
  let beendet = 0;

  await seite.route(adresse, async (route) => {
    const r = route as unknown as Weiche;
    if (r.request().method() !== "GET") {
      await r.fallback();
      return;
    }
    angekommen += 1;
    try {
      if (stand === "abbruch") {
        await r.abort("failed");
        return;
      }
      if (stand === "fehler") {
        await r.fulfill({
          status: 500,
          body: JSON.stringify({
            error: LESEWEICHE_FEHLERCODE,
            message: LESEWEICHE_FEHLERSATZ,
          }),
          headers: { "content-type": "application/json" },
        });
        return;
      }
      await r.fallback();
    } finally {
      beendet += 1;
    }
  });

  return {
    setze(neu: Lesestand): void {
      stand = neu;
    },
    get zaehler(): { readonly angekommen: number; readonly beendet: number } {
      return { angekommen, beendet };
    },
    abraeumen(): Promise<void> {
      return seite.unroute(adresse);
    },
  };
}

// ------------------------------------------------------------------------------------------------
// 6 · Die Datenbank — unabhängig vom Browser gefragt
// ------------------------------------------------------------------------------------------------

/**
 * Die Zeile `drafts.<id>` als kanonischer Text — `null`, wenn es sie nicht gibt.
 *
 * `SELECT data FROM drafts WHERE id = $1` ist die unabhängige Probe aus dem Auftrag. Verglichen
 * wird die SERIALISIERUNG derselben gelesenen Struktur: zwei Lesungen einer unveränderten Zeile
 * ergeben zeichengleich dasselbe, jede Änderung an irgendeinem Feld ändert sie.
 */
export async function entwurfszeile(pool: Pool, id: string): Promise<string | null> {
  const antwort = await pool.query<{ data: unknown }>("SELECT data FROM drafts WHERE id = $1", [
    id,
  ]);
  const zeile = antwort.rows[0];
  return zeile === undefined ? null : JSON.stringify(zeile.data);
}

/** Wie viele Entwürfe liegen insgesamt in der Tabelle? */
export async function entwurfszahl(pool: Pool): Promise<number> {
  const antwort = await pool.query<{ anzahl: string }>(
    "SELECT count(*)::text AS anzahl FROM drafts",
  );
  return Number.parseInt(antwort.rows[0]?.anzahl ?? "0", 10);
}

/** Die Version der echten PostgreSQL — für die Protokollzeile. */
export async function pgVersion(pool: Pool): Promise<string> {
  const antwort = await pool.query<{ version: string }>("SELECT version()");
  return (antwort.rows[0]?.version ?? "(unbekannt)").split(" on ")[0] ?? "(unbekannt)";
}

// ------------------------------------------------------------------------------------------------
// 7 · Umgebung: Wegwerf-Datenbank und gebaute Fläche
// ------------------------------------------------------------------------------------------------

/** Zusammengesetzt statt ausgeschrieben — s. `tests/neuinstallation/…` (Fall N3 dort). */
const PG_SCHEMA = "postgresql:";

export interface Verbindung {
  host: string;
  port: string;
  user: string;
  passwort: string;
}

export function zerlege(url: string): Verbindung | undefined {
  try {
    const u = new URL(url.replace(/^postgres(ql)?:/, "http:"));
    if (!u.hostname) {
      return undefined;
    }
    return {
      host: u.hostname,
      port: u.port || "5432",
      user: decodeURIComponent(u.username) || "postgres",
      passwort: decodeURIComponent(u.password),
    };
  } catch {
    return undefined;
  }
}

/** Die Adresse der WEGWERF-Datenbank — sie muss `test` im Namen tragen, sonst wird nichts angefasst. */
export function pgUrl(v: Verbindung, datenbank: string): string {
  if (!datenbank.toLowerCase().includes("test")) {
    throw new Error(
      `${JOB}: „${datenbank}" trägt kein „test" im Namen — diese Suite fasst ausschliesslich Wegwerf-Datenbanken an.`,
    );
  }
  const anmeldung = `${encodeURIComponent(v.user)}:${encodeURIComponent(v.passwort)}`;
  return `${PG_SCHEMA}//${anmeldung}@${v.host}:${v.port}/${datenbank}`;
}

/**
 * Die gebaute Fläche herstellen, wenn sie fehlt — einmal, mit dem echten Bündler.
 *
 * Dieselbe Lage und dieselbe Antwort wie in `gastweg-pg-im-browser.integration.test.ts:101-116`:
 * das Tor baut `dist`, hat aber keine Datenbank; der Integrationslauf hat die Datenbank, aber kein
 * `dist`. Gemessen wird danach genau das Bündel, das auch ausgeliefert wird.
 */
export function stelleFlaecheBereit(): string {
  if (existsSync(join(DIST, "index.html"))) {
    return "war schon da";
  }
  const begonnen = Date.now();
  execFileSync("npx", ["vite", "build"], {
    cwd: join(resolve(process.cwd()), "apps/web"),
    stdio: "pipe",
    timeout: 600_000,
  });
  if (!existsSync(join(DIST, "index.html"))) {
    throw new Error(`${JOB}: der Bau lief durch, aber ${DIST}/index.html fehlt weiterhin.`);
  }
  return `gebaut in ${Date.now() - begonnen} ms`;
}
