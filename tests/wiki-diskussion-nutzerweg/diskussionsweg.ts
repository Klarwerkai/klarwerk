// ================================================================================================
// JOB 4330 · DER FADEN AM DOKUMENT IM ECHTEN BROWSER — DER WEG, EINMAL BESCHRIEBEN.
// ================================================================================================
//
// WAS HIER STEHT UND WARUM ES HIER STEHT. Die vierzehn Dateien in `tests/wiki-diskussion/` messen
// Beitrag, Antwortbezug, Klärungsstand und Fehlerweg vollständig — aber ausschliesslich über
// Speicherablagen (`huelle.ts:39-40`: `buildApp(buildServices())`) und in jsdom mit gefälschtem
// Netz (`diskussion-in-der-flaeche.test.tsx:1`, `44-95`). Ob derselbe Weg einen echten Socket, eine
// echte PostgreSQL-Zeile, einen echten Browser und einen Neustart überlebt, war an keiner Stelle
// belegt; genau das ist der Rest des Meilensteins D14 und der Satz des Prüfers aus
// `archiv/4146/runde-7/ben.md` („Echter PostgreSQL-Lauf, eigener Browser-End-to-End-Lauf").
//
// ES ENTSTEHT KEIN ZWEITER AUFBAU UND KEINE ZWEITE STRECKE. Server, Socket, Konten und Browserstart
// kommen aus `tests/gast-nutzerweg/` (`strecke.ts`, `browserweg.ts`); die Bauform aus PostgreSQL,
// Neustart und unabhängiger Lesung ist `tests/fassungsrueckholung-echter-browser/` abgesehen. Was
// diese Datei beiträgt, ist der WEG DURCH DIE DISKUSSION — und den gibt es sonst nirgends.
//
// ------------------------------------------------------------------------------------------------
// DREI MESSPRIMITIVE, DIE HIER NOCH EINMAL STEHEN — und der Grund dafür.
// ------------------------------------------------------------------------------------------------
//
//  1. DER SICHTBARE FOKUS. `browserweg.ts` misst ihn, exportiert die Sonde aber nicht; dieselbe Lage
//     und dieselbe Antwort wie in `tests/fassungsrueckholung-echter-browser/weg.ts:203`. Mit
//     derselben Schärfung: Tailwinds `outline-none` ist `outline: 2px solid transparent`
//     (`apps/web/src/index.css:65`) — ein DURCHSICHTIGER Umriss ist kein sichtbarer Fokus.
//  2. DER SICHTBARE TEXT. `textContent` und blosse DOM-Anwesenheit sind laut REGELN § 9 kein
//     Nachweis. Gemessen wird deshalb je TEXTTRAGENDEM Nachkommen: `display`, `visibility`,
//     `opacity`, Geometrie und durchsichtige Schriftfarbe. Jede Behauptung über Sichtbarkeit wird
//     ausserdem durch gezieltes Ausblenden GENAU dieses Elements kalibriert (`kalibriereSicht`).
//  3. DIE ANTWORTSPUR. Ein Klick, der nichts auslöst und nichts wirft, sähe aus wie ein
//     vollzogener Schritt (Lehre JOB 4322 R1, `LEHREN.md` 2026-09-17T19:31:07). Hinter jedem Klick
//     wird deshalb der TATSÄCHLICHE Abruf mitgeschrieben — Verfahren, Pfad, Status, ob die Antwort
//     wirklich abgeschlossen wurde, und ihr Rumpf. Beobachtet wird von aussen über Playwrights
//     `response`-Ereignis; im Seitenkontext wird nichts umgehängt und nichts ersetzt.
//
// WAS ES HIER AUSDRÜCKLICH NICHT GIBT: einen zweiten Weg zu einem Bedienelement. Jeder Knopf, jedes
// Feld wird per Tab erreicht, sein Fokus wird nachgemessen, dann Enter oder tippen. `page.click` und
// `click()` aus `page.evaluate` kommen in dieser Datei nicht vor.
import { expect } from "vitest";
import i18n from "../../apps/web/src/i18n";
import {
  type Browser,
  type Kontext,
  LIES_TEXT,
  type Seite,
  warte as browserWarte,
  fn,
  profil,
  tabBisZu,
  tippeMitTastatur,
} from "../gast-nutzerweg/browserweg";
import { PASSWORT } from "../gast-nutzerweg/strecke";

const JOB = "[KLARWERK] JOB 4330";

/** Die Sollwerte kommen aus dem Katalog, nie aus einer hier eingetippten Abschrift. */
export const T = i18n.getFixedT("de");

/** Breit genug für die Leseansicht samt aufgeklapptem „Mehr" — die Schmalkante ist anderer Auftrag. */
export const BREIT = { width: 1280, height: 900 };

/**
 * Wie weit ein Tab-Weg höchstens laufen darf.
 *
 * Die Diskussion ist der ELFTE von dreizehn Abschnitten hinter „Mehr" (`MehrAbschnitte.tsx:2416`).
 * Der Weg dorthin führt über die gesamte Leseansicht; 320 (der Wert des Fassungsabschnitts) reicht
 * nicht. Die tatsächlich gezählten Anschläge stehen je Schritt in `tastatur` und damit in der
 * Rückgabe — eine Zahl, die niemand nachliest, wäre keine.
 */
const TAB_GRENZE = 900;

// ------------------------------------------------------------------------------------------------
// DIE SONDEN — sie messen, sie handeln nicht.
// ------------------------------------------------------------------------------------------------

/**
 * Sieht man, worauf der Fokus steht?
 *
 * Eine Farbe zählt nur, wenn sie nicht vollständig durchsichtig ist; ein Schatten kann mehrere
 * Lagen tragen (Tailwind legt Ring, Ring-Abstand und Schatten übereinander) und ist sichtbar,
 * sobald EINE davon es ist.
 */
const FOKUS_SICHTBAR = `() => {
  const a = document.activeElement;
  if (!a) return false;
  const sichtbareFarbe = (farbe) => !/transparent/.test(farbe) && !/,\\s*0\\s*\\)/.test(farbe);
  const s = getComputedStyle(a);
  const umriss =
    s.outlineStyle !== "none" &&
    Number.parseFloat(s.outlineWidth || "0") > 0 &&
    sichtbareFarbe(String(s.outlineColor));
  const lagen = String(s.boxShadow).match(/rgba?\\([^)]*\\)/g) || [];
  const schatten = s.boxShadow !== "none" && s.boxShadow !== "" && lagen.some(sichtbareFarbe);
  return umriss || schatten;
}`;

/** Woran hing (oder fehlte) die Sichtbarkeit? Für Meldungen, die auf den Schuldigen zeigen. */
const FOKUS_DIAGNOSE = `() => {
  const a = document.activeElement;
  if (!a) return "aktiv: (nichts)";
  const s = getComputedStyle(a);
  return [
    "aktiv: <" + a.tagName.toLowerCase() + ">",
    "marken=" + JSON.stringify(a.dataset || {}).slice(0, 140),
    "tabindex=" + (a.getAttribute("tabindex") ?? "(keiner)"),
    "outline=" + s.outlineStyle + " " + s.outlineWidth + " " + s.outlineColor,
    "boxShadow=" + String(s.boxShadow).slice(0, 90),
  ].join(" · ");
}`;

/**
 * DER SICHTBARE TEXT EINES TEILBAUMS — REGELN § 9, nicht `textContent`.
 *
 * Geprüft wird in zwei Richtungen, und beide werden gebraucht: nach OBEN, weil ein ausgeblendeter
 * Vorfahre den ganzen Teilbaum unsichtbar macht, und nach UNTEN je texttragendem Nachkommen, weil
 * ein sichtbarer Container nicht belegt, dass sein gesamter `innerText` sichtbar ist (Befund
 * JOB 4295 R3). Ein Textknoten zählt nur, wenn die Schriftfarbe seines Elternelements nicht
 * vollständig durchsichtig ist.
 *
 * `null` heisst: das Element gibt es gar nicht. Die leere Zeichenkette heisst: es gibt es, aber
 * niemand sieht etwas davon. Die beiden Lagen auseinanderzuhalten ist der ganze Zweck.
 */
const SICHTBARER_TEXT = `(sel) => {
  const wurzel = document.querySelector(sel);
  if (!wurzel) return null;
  const unsichtbar = (e) => {
    const s = getComputedStyle(e);
    if (s.display === "none") return true;
    if (s.visibility === "hidden" || s.visibility === "collapse") return true;
    if (Number.parseFloat(s.opacity || "1") === 0) return true;
    // GEMESSEN UND NICHT ANGENOMMEN (Arbeitsprüfung 2cf8ccdebc2645d7966399ad06398591): die Hülle
    // der Fläche trägt \`display: contents\` (\`<div class="contents">\`). Ein solches Element erzeugt
    // KEINE Box; sein Rechteck ist 0x0, während seine Kinder vollständig sichtbar sind. Die
    // Geometrie sagt hier also nichts — die Kinder werden einzeln gemessen.
    if (s.display === "contents") return false;
    const r = e.getBoundingClientRect();
    return r.width === 0 && r.height === 0;
  };
  for (let e = wurzel; e; e = e.parentElement) {
    if (unsichtbar(e)) return "";
  }
  const durchsichtig = (farbe) => /transparent/.test(farbe) || /,\\s*0\\s*\\)/.test(farbe);
  const teile = [];
  const gehe = (e) => {
    if (unsichtbar(e)) return;
    const blass = durchsichtig(String(getComputedStyle(e).color));
    for (const k of e.childNodes) {
      if (k.nodeType === 3) {
        if (!blass) teile.push(k.textContent || "");
      } else if (k.nodeType === 1) {
        gehe(k);
      }
    }
  };
  gehe(wurzel);
  return teile.join(" ").replace(/\\s+/g, " ").trim();
}`;

/**
 * WORAN hing die Unsichtbarkeit? Die Kette vom gesuchten Element aufwärts bis zum ersten, das
 * niemand sieht — mit Grund.
 *
 * Ein „expected '' to contain …" allein sagt nicht, WELCHES Element den Teilbaum blind gemacht hat.
 * Diese Sonde steht ausschliesslich in Fehlermeldungen; sie trifft keine Entscheidung.
 */
const SICHT_DIAGNOSE = `(sel) => {
  const wurzel = document.querySelector(sel);
  if (!wurzel) return "(kein Element unter " + sel + ")";
  const grund = (e) => {
    const s = getComputedStyle(e);
    const r = e.getBoundingClientRect();
    if (s.display === "none") return "display:none";
    if (s.visibility === "hidden" || s.visibility === "collapse") return "visibility:" + s.visibility;
    if (Number.parseFloat(s.opacity || "1") === 0) return "opacity:0";
    if (s.display === "contents") return "";
    if (r.width === 0 && r.height === 0) return "0x0 (" + s.display + ", contentVisibility=" + s.contentVisibility + ")";
    return "";
  };
  const spur = [];
  for (let e = wurzel; e; e = e.parentElement) {
    const g = grund(e);
    spur.push(
      "<" + e.tagName.toLowerCase() + " class=" +
      JSON.stringify((e.getAttribute("class") || "").slice(0, 70)) + ">" +
      (g ? " UNSICHTBAR:" + g : " ok"),
    );
    if (g) break;
  }
  return spur.join(" ← ") + " || textContent=" + JSON.stringify((wurzel.textContent || "").slice(0, 240));
}`;

/** Steht der eine Beitrag WIRKLICH IM anderen? Enthaltensein, nicht Reihenfolge (H1). */
const ENTHAELT = `(a) => {
  const marke = (id) => document.querySelector('[data-bib-diskussion-beitrag="' + id + '"]');
  const w = marke(a[0]);
  const k = marke(a[1]);
  if (!w || !k) return "(fehlt: " + (w ? "" : a[0]) + (k ? "" : " " + a[1]) + ")";
  if (w === k) return "(dasselbe Element)";
  return w.contains(k) ? "enthalten" : "daneben";
}`;

/** Der `value` eines Feldes — `null`, wenn es das Feld nicht gibt. */
const FELDWERT = `(sel) => {
  const e = document.querySelector(sel);
  return e === null ? null : String(e.value);
}`;

/** Gibt es dieses Element? Für Zusagen über An- UND Abwesenheit. */
const GIBT_ES = "(sel) => !!document.querySelector(sel)";

/** Ein Element gezielt ausblenden (Kalibrierung) — und die Rücknahme. */
const AUSBLENDEN = `(sel) => {
  const e = document.querySelector(sel);
  if (!e) return false;
  e.setAttribute("data-kw4330-vorher", e.getAttribute("style") || "");
  e.style.display = "none";
  return true;
}`;
const EINBLENDEN = `(sel) => {
  const e = document.querySelector(sel);
  if (!e) return false;
  const vorher = e.getAttribute("data-kw4330-vorher");
  if (vorher) { e.setAttribute("style", vorher); } else { e.removeAttribute("style"); }
  e.removeAttribute("data-kw4330-vorher");
  return true;
}`;

// ------------------------------------------------------------------------------------------------
// DIE ANTWORTSPUR — was hinter einem Klick WIRKLICH über die Leitung ging.
// ------------------------------------------------------------------------------------------------

/** Ein tatsächlich beobachteter Schreibabruf der Fläche. */
export interface Abruf {
  verfahren: string;
  pfad: string;
  status: number;
  /** „abgeschlossen" oder der Grund, aus dem die Antwort NICHT zu Ende kam. */
  abschluss: string;
  rumpf: string;
}

export interface Spur {
  /** Wie viele Schreibabrufe bisher gesehen wurden — die Marke vor einem Klick. */
  stand(): number;
  /** Alles ab einer Marke, vollständig gelesen. */
  seit(marke: number): Promise<Abruf[]>;
}

interface RohAntwort {
  status(): number;
  url(): string;
  finished(): Promise<unknown>;
  text(): Promise<string>;
  request(): { method(): string };
}

/**
 * Hängt einen Beobachter an die Seite — von AUSSEN, über Playwrights `response`-Ereignis.
 *
 * Bewusst NICHT durch Umhängen von `window.fetch` im Seitenkontext: was gemessen werden soll, ist
 * der Weg des Produkts, und ein ersetztes `fetch` wäre eine Änderung an genau diesem Weg. Von aussen
 * beobachtet bleibt die Fläche unangetastet.
 *
 * Gesammelt werden nur die SCHREIBabrufe auf `/api/kos/**` — die Leseabrufe der Seite (Nachbarn,
 * Verzeichnis, Prüfstand) sagen über den Vollzug eines Klicks nichts.
 */
export function horche(seite: Seite): Spur {
  const offen: Promise<Abruf>[] = [];
  const roh = seite as unknown as { on(ereignis: string, f: (r: RohAntwort) => void): void };
  roh.on("response", (antwort) => {
    const url = antwort.url();
    const verfahren = antwort.request().method();
    if (verfahren !== "PUT" || !url.includes("/api/kos/")) {
      return;
    }
    const status = antwort.status();
    offen.push(
      (async (): Promise<Abruf> => {
        // `finished()` löst auf, wenn der Rumpf vollständig übertragen ist; `null` heisst: ohne
        // Zwischenfall. Alles andere ist der Grund, aus dem die Antwort NICHT zu Ende kam — und
        // genau der darf nicht als vollzogener Schritt durchgehen.
        const ende = await antwort.finished().catch((fehler: unknown) => String(fehler));
        const rumpf = await antwort
          .text()
          .then((t) => t.slice(0, 800))
          .catch((fehler: unknown) => `(Rumpf nicht lesbar: ${String(fehler)})`);
        return {
          verfahren,
          pfad: new URL(url).pathname,
          status,
          abschluss: ende === null || ende === undefined ? "abgeschlossen" : String(ende),
          rumpf,
        };
      })(),
    );
  });
  return {
    stand: () => offen.length,
    seit: (marke) => Promise.all(offen.slice(marke)),
  };
}

/**
 * Wartet, bis hinter einem Klick wirklich ein Schreibabruf angekommen ist, und liest ihn.
 *
 * DAS IST LIEFERUNG 6 AN IHRER ENGSTEN STELLE: ein Knopf, der nichts auslöst, wirft nichts — und
 * ohne diese Stelle bliebe der Schritt grün. Hier scheitert er mit Namen.
 */
export async function abrufHinter(
  spur: Spur,
  marke: number,
  was: string,
  frist = 60_000,
): Promise<Abruf[]> {
  const bis = Date.now() + frist;
  while (spur.stand() <= marke) {
    if (Date.now() > bis) {
      throw new Error(
        `${JOB}: hinter „${was}" ist in ${frist} ms kein PUT auf /api/kos/ angekommen — der Klick hat nichts ausgelöst.`,
      );
    }
    await new Promise((r) => setTimeout(r, 50));
  }
  return spur.seit(marke);
}

/**
 * Der Abruf hinter einem Schritt, geprüft auf Status UND abgeschlossene Antwort.
 *
 * Ein 500 darf nie als bestandener Schritt durchgehen (Korrekturpflicht 2 aus JOB 4304 R2), und
 * eine abgebrochene Antwort ebenso wenig.
 */
export function mussDurchkommen(abrufe: Abruf[], was: string, erwartet = 200): Abruf {
  expect(abrufe.length, `${JOB}: „${was}" hat keinen einzigen Schreibabruf ausgelöst`).toBe(1);
  const eins = abrufe[0] as Abruf;
  expect(
    `${eins.status} · ${eins.abschluss}`,
    `${JOB}: der Abruf hinter „${was}" ging nicht als ${erwartet} vollständig durch — Rumpf: ${eins.rumpf}`,
  ).toBe(`${erwartet} · abgeschlossen`);
  return eins;
}

// ------------------------------------------------------------------------------------------------
// DER EINE WEG ZU EINEM BEDIENELEMENT.
// ------------------------------------------------------------------------------------------------

async function warte(
  seite: Seite,
  quelle: string,
  was: string,
  arg?: unknown,
  frist = 45_000,
): Promise<void> {
  try {
    await browserWarte(seite, quelle, was, arg, frist);
  } catch (fehler) {
    throw new Error(`${JOB}: ${was} — nicht eingetreten.\n${String(fehler)}`);
  }
}

async function fokusMussSichtbarSein(seite: Seite, was: string): Promise<void> {
  const stand = await seite.evaluate<string>(fn(FOKUS_DIAGNOSE));
  expect(
    await seite.evaluate<boolean>(fn(FOKUS_SICHTBAR)),
    `${JOB}: „${was}" zeigt keinen sichtbaren Fokus, obwohl es gerade per Tastatur angesteuert wurde — ${stand}`,
  ).toBe(true);
}

/** Tab hin, sichtbaren Fokus nachgemessen, ENTER. Es gibt hier keinen zweiten Weg dorthin. */
export async function mitTaste(
  seite: Seite,
  selektor: string,
  was: string,
  tastatur: Record<string, number>,
): Promise<void> {
  let schritte: number;
  try {
    schritte = await tabBisZu(seite, selektor, TAB_GRENZE, true);
  } catch (fehler) {
    throw new Error(
      `${JOB}: „${was}" (${selektor}) war in ${TAB_GRENZE} Tab-Anschlägen nicht erreichbar — das ist die Halbheit „nur mit der Maus".\n${String(fehler)}`,
    );
  }
  await fokusMussSichtbarSein(seite, was);
  tastatur[was] = schritte;
  await seite.keyboard.press("Enter");
}

/** Tab hin, sichtbaren Fokus nachgemessen, TIPPEN — über den einen Weg aus `browserweg.ts`. */
export async function tippeIn(
  seite: Seite,
  selektor: string,
  text: string,
  was: string,
  tastatur: Record<string, number>,
): Promise<void> {
  tastatur[was] = await tippeMitTastatur(seite, selektor, text, was);
  const wert = await seite.evaluate<string | null>(fn(FELDWERT), selektor);
  expect(wert, `${JOB}: der getippte Text ist im Feld „${was}" nicht angekommen`).toBe(text);
}

// ------------------------------------------------------------------------------------------------
// SICHTBARKEIT — gemessen und kalibriert, nicht behauptet.
// ------------------------------------------------------------------------------------------------

/** Der sichtbare Text unter diesem Selektor. `null`: es gibt das Element nicht. */
export function sichtText(seite: Seite, selektor: string): Promise<string | null> {
  return seite.evaluate<string | null>(fn(SICHTBARER_TEXT), selektor);
}

/** Ein Mensch SIEHT diesen Text an dieser Stelle. */
export async function mussSichtbar(
  seite: Seite,
  selektor: string,
  text: string,
  was: string,
): Promise<string> {
  const gelesen = await sichtText(seite, selektor);
  expect(
    gelesen,
    `${JOB}: „${was}" — unter ${selektor} steht gar kein Element auf der Seite`,
  ).not.toBeNull();
  if (!(gelesen ?? "").includes(text)) {
    // Die Diagnose wird NUR im Fehlerfall geholt — sie kostet einen Seitenaufruf und entscheidet
    // nichts; sie sagt, WELCHES Element den Teilbaum blind gemacht hat.
    const spur = await seite.evaluate<string>(fn(SICHT_DIAGNOSE), selektor);
    expect(
      gelesen as string,
      `${JOB}: „${was}" — „${text}" ist unter ${selektor} nicht SICHTBAR. Gelesen: „${(gelesen ?? "").slice(0, 400)}"\nSichtkette: ${spur}`,
    ).toContain(text);
  }
  return gelesen as string;
}

/**
 * DIE KALIBRIERUNG ZU JEDER SICHTBARKEITSBEHAUPTUNG (REGELN § 9).
 *
 * Genau das Element, das den Text trägt, wird bei sonst unveränderter Fläche ausgeblendet. Die
 * unveränderte Messung MUSS daran scheitern; nach der Rücknahme steht sie wieder. Ohne diesen
 * Schritt wäre nicht belegt, dass die Messung überhaupt etwas sieht.
 *
 * `blende` trennt die beiden Fälle, und beide werden gebraucht (REGELN § 9):
 *   · WEGGELASSEN — gemessen und ausgeblendet wird dasselbe Element (die einfache Behauptung).
 *   · GESETZT — ausgeblendet wird das TEXTTRAGENDE KIND, während der gemessene Container stehen
 *     bleibt. Nur so ist belegt, dass ein sichtbarer Container nicht für den Text seiner Kinder
 *     bürgt (Befund JOB 4295 R3).
 */
export async function kalibriereSicht(
  seite: Seite,
  selektor: string,
  text: string,
  was: string,
  blende = selektor,
): Promise<void> {
  await mussSichtbar(seite, selektor, text, `${was} (vor der Kalibrierung)`);
  expect(
    await seite.evaluate<boolean>(fn(AUSBLENDEN), blende),
    `${JOB}: „${was}" — zum Ausblenden war ${blende} nicht da`,
  ).toBe(true);
  const blind = await sichtText(seite, selektor);
  expect(
    blind ?? "",
    `${JOB}: KALIBRIERUNG „${was}" — nach dem Ausblenden von ${blende} liest die Messung „${text}" IMMER NOCH unter ${selektor}. Sie sieht nicht, was ein Mensch sieht.`,
  ).not.toContain(text);
  expect(
    await seite.evaluate<boolean>(fn(EINBLENDEN), blende),
    `${JOB}: „${was}" — die Rücknahme des Ausblendens fand ${blende} nicht`,
  ).toBe(true);
  await mussSichtbar(seite, selektor, text, `${was} (nach der Rücknahme)`);
}

/** Der Faden: die Antwort steht IM Bezugsbeitrag. Enthaltensein, nicht Reihenfolge. */
export async function mussImFadenHaengen(
  seite: Seite,
  wurzelId: string,
  antwortId: string,
): Promise<void> {
  expect(
    await seite.evaluate<string>(fn(ENTHAELT), [wurzelId, antwortId]),
    `${JOB}: die Antwort ${antwortId} steht nicht IM Beitrag ${wurzelId} — eine flache Liste in der richtigen Sortierung sähe gleich aus und wäre doch kein Faden`,
  ).toBe("enthalten");
}

// ------------------------------------------------------------------------------------------------
// DIE FLÄCHE ÖFFNEN.
// ------------------------------------------------------------------------------------------------

export interface Platz {
  kontext: Kontext;
  seite: Seite;
  spur: Spur;
}

/** Ein frisches Browserprofil: eigener Keksbeutel, eigener Speicher, nichts geerbt. */
export async function frischesProfil(browser: Browser): Promise<Platz> {
  const { kontext, seite } = await profil(browser, BREIT);
  return { kontext, seite, spur: horche(seite) };
}

/**
 * Anmeldung über die ECHTE Maske, ausschliesslich mit der Tastatur.
 *
 * Sie steht hier und nicht in `browserweg.ts`, weil sie dort nicht exportiert ist (`:435`) und
 * jene Datei JOB 4322 gehört (`jobs/4322/AUFTRAG.md:11`). DIESELBEN SELEKTOREN, damit es nicht
 * zwei Auffassungen davon gibt, wo die Anmeldemaske ihre Felder hat.
 */
export async function anmelden(
  seite: Seite,
  basis: string,
  email: string,
  marke: string,
  tastatur: Record<string, number>,
): Promise<void> {
  await seite.goto(`${basis}/`, { waitUntil: "domcontentloaded" });
  await warte(seite, `() => !!document.querySelector("#auth-email")`, `Anmeldemaske für ${email}`);
  await tippeIn(seite, "#auth-email", email, `${marke}_email`, tastatur);
  await tippeIn(seite, "#auth-password", PASSWORT, `${marke}_passwort`, tastatur);
  await seite.keyboard.press("Enter");
  await warte(
    seite,
    `() => !document.querySelector("#auth-email")`,
    `die Anmeldung von ${email} trägt`,
    undefined,
    60_000,
  );
}

export const ABSCHNITT = '[data-bib-abschnitt="kommentare"]';

/**
 * Den Eintrag öffnen und die Diskussion AUFKLAPPEN — beides mit der Tastatur.
 *
 * Zwei Schritte, weil die Fläche zwei hat: `/wissen/:id` legt die dreizehn Abschnitte hinter die
 * EINE Zeile „Mehr" (`BibliothekLesen.tsx:3426`, zugeklappt als Vorgabe), und die Diskussion ist
 * darin ein `<details>` mit eigenem `<summary>` (`MehrAbschnitte.tsx:2417`). Ein Nachweis, der nur
 * die Unterkomponente mountete, belegte nicht, dass ein Mensch die Angabe je zu sehen bekommt
 * (Promptverbesserung JOB 4075 R3, `LEHREN.md` 15.09. 07:02).
 */
export async function oeffneDiskussion(
  seite: Seite,
  basis: string,
  koId: string,
  titel: string,
  marke: string,
  tastatur: Record<string, number>,
): Promise<void> {
  await seite.goto(`${basis}/wissen/${koId}`, { waitUntil: "domcontentloaded" });
  await warte(
    seite,
    "(t) => document.body.innerText.includes(t)",
    `die Leseansicht zeigt „${titel}" (${marke})`,
    titel,
    60_000,
  );
  await warte(seite, GIBT_ES, `die Zeile „Mehr" (${marke})`, '[data-testid="bib-mehr"]');
  await mitTaste(seite, '[data-testid="bib-mehr"]', `${marke}_mehr`, tastatur);
  await warte(seite, GIBT_ES, `der Abschnitt „Diskussion" (${marke})`, `${ABSCHNITT} > summary`);
  await mitTaste(seite, `${ABSCHNITT} > summary`, `${marke}_abschnitt`, tastatur);
  // Erst wenn das Feld für einen neuen Beitrag da ist, ist der Abschnitt wirklich aufgeklappt —
  // ein `<details open>` ohne gezeichneten Inhalt wäre genau der halbe Nachweis.
  await warte(
    seite,
    GIBT_ES,
    `das Beitragsfeld der Diskussion (${marke})`,
    `${ABSCHNITT} textarea`,
  );
}

// ------------------------------------------------------------------------------------------------
// DIE HANDGRIFFE AM FADEN — jeder genau so, wie ihn ein Mensch macht.
// ------------------------------------------------------------------------------------------------

/** Die Marken der Fläche, an EINER Stelle (`MehrAbschnitte.tsx:2436-2578`). */
export const M = {
  beitrag: (id: string) => `[data-bib-diskussion-beitrag="${id}"]`,
  klaerung: (id: string) => `[data-bib-diskussion-klaerung="${id}"]`,
  antworten: (id: string) => `[data-bib-diskussion-antworten="${id}"]`,
  antwortfeld: (id: string) => `[data-bib-diskussion-antwortfeld="${id}"]`,
  antwortsenden: (id: string) => `[data-bib-diskussion-antwortsenden="${id}"]`,
  erledigen: (id: string) => `[data-bib-diskussion-erledigen="${id}"]`,
  oeffnen: (id: string) => `[data-bib-diskussion-oeffnen="${id}"]`,
  beitragsfeld: `${ABSCHNITT} textarea`,
  senden: "[data-bib-diskussion-senden]",
  fehler: '[data-testid="bib-diskussion-fehler"]',
  erneut: "[data-bib-diskussion-erneut]",
} as const;

/** Einen neuen Beitrag tippen und absenden. Zurück kommt der tatsächliche Abruf dahinter. */
export async function schreibeBeitrag(
  platz: Platz,
  text: string,
  marke: string,
  tastatur: Record<string, number>,
): Promise<Abruf[]> {
  await tippeIn(platz.seite, M.beitragsfeld, text, `${marke}_beitragsfeld`, tastatur);
  const vorher = platz.spur.stand();
  await mitTaste(platz.seite, M.senden, `${marke}_senden`, tastatur);
  return abrufHinter(platz.spur, vorher, `${marke} · ${T("ko.commentAdd")}`);
}

/** Auf einen Faden antworten: Feld öffnen, tippen, senden. */
export async function schreibeAntwort(
  platz: Platz,
  wurzelId: string,
  text: string,
  marke: string,
  tastatur: Record<string, number>,
): Promise<Abruf[]> {
  await mitTaste(platz.seite, M.antworten(wurzelId), `${marke}_antworten`, tastatur);
  await warte(
    platz.seite,
    GIBT_ES,
    `das Antwortfeld am Faden ${wurzelId} (${marke})`,
    M.antwortfeld(wurzelId),
  );
  await tippeIn(platz.seite, M.antwortfeld(wurzelId), text, `${marke}_antwortfeld`, tastatur);
  const vorher = platz.spur.stand();
  await mitTaste(platz.seite, M.antwortsenden(wurzelId), `${marke}_antwortsenden`, tastatur);
  return abrufHinter(platz.spur, vorher, `${marke} · ${T("ko.diskussion.antwortSenden")}`);
}

/** Den Faden über die echte Aktion auf erledigt setzen — oder wieder öffnen. */
export async function stelleKlaerung(
  platz: Platz,
  wurzelId: string,
  ziel: "erledigt" | "offen",
  marke: string,
  tastatur: Record<string, number>,
): Promise<Abruf[]> {
  const selektor = ziel === "erledigt" ? M.erledigen(wurzelId) : M.oeffnen(wurzelId);
  const was =
    ziel === "erledigt"
      ? T("ko.diskussion.alsGeklaertMarkieren")
      : T("ko.diskussion.wiederOeffnen");
  await warte(platz.seite, GIBT_ES, `der Knopf „${was}" am Faden ${wurzelId} (${marke})`, selektor);
  const vorher = platz.spur.stand();
  await mitTaste(platz.seite, selektor, `${marke}_${ziel}`, tastatur);
  return abrufHinter(platz.spur, vorher, `${marke} · ${was}`);
}

/** Den angebotenen Wiederholungsweg ausführen — der sichtbare nächste Schritt, befolgt. */
export async function sendeErneut(
  platz: Platz,
  marke: string,
  tastatur: Record<string, number>,
): Promise<Abruf[]> {
  await warte(platz.seite, GIBT_ES, `der Wiederholungsknopf (${marke})`, M.erneut);
  const vorher = platz.spur.stand();
  await mitTaste(platz.seite, M.erneut, `${marke}_erneut`, tastatur);
  return abrufHinter(platz.spur, vorher, `${marke} · ${T("ko.diskussion.erneutSenden")}`);
}

/** Warten, bis ein Element da ist (oder verschwunden). Für die Lage NACH einem Vollzug. */
export function warteAuf(seite: Seite, selektor: string, was: string): Promise<void> {
  return warte(seite, GIBT_ES, was, selektor, 60_000);
}
export function warteAufWeg(seite: Seite, selektor: string, was: string): Promise<void> {
  return warte(seite, "(s) => !document.querySelector(s)", was, selektor, 60_000);
}

/** Der `value` eines Feldes, gelesen statt vermutet. */
export function feldwert(seite: Seite, selektor: string): Promise<string | null> {
  return seite.evaluate<string | null>(fn(FELDWERT), selektor);
}

/** Der ganze sichtbare Seitentext — für Zusagen über ABWESENHEIT geschützten Inhalts. */
export function seitentext(seite: Seite): Promise<string> {
  return seite.evaluate<string>(fn(LIES_TEXT));
}
