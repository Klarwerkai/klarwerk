// ================================================================================================
// JOB 4323 · DER MENÜWEG ZUR GESAMTANWEISUNG — OHNE MAUS, IN DREI SPRACHEN, ÜBER EINEN ECHTEN
// SERVERPROZESS. HIER STEHEN DIE STATIONEN GENAU EINMAL.
// ================================================================================================
//
// WAS AN DIESER STRECKE ECHT IST — und damit das, was ein Nachweis aus ihr belegen darf:
//   · eine echte PostgreSQL (Wegwerf-Datenbank mit `test` im Namen, am Ende `DROP … WITH (FORCE)`);
//   · ein echter BETRIEBSSYSTEM-PROZESS: `node --import tsx services/app/src/server.ts`, mit einer
//     NICHT geerbten Umgebung, `NODE_ENV=production`, eigenem Port, eigenem Socket. Kein `buildApp`,
//     kein `starteStrecke`, kein `app.inject`;
//   · die GEBAUTE Fläche (`apps/web/dist`), ausgeliefert von diesem Prozess selbst
//     (`server.ts:60-66`, `registerWebStatic`) — nicht von einer Testhülle;
//   · ein echtes Chromium über `starteChromium()` aus `tests/gast-nutzerweg/browserweg.ts`;
//   · echte Tastendrücke: Tab, Enter, Zeichen. In dieser Datei und in ihren beiden Aufrufern kommt
//     `.click(` NICHT vor — das hält `zeuge-kein-klick-kein-stiller-skip.test.ts` im Tor fest.
//
// WAS SIE NICHT BELEGT und deshalb nirgends behauptet wird: andere Browser, den Word-Add-in-Host,
// die Ausgabe eines Bildschirmlesers, `docker compose`, TLS, und den Weg über eine Übersichtsseite —
// eine solche Seite gibt es nicht (benannte Restarbeit aus JOB 4309 §10). Die angelegte Anweisung
// wird nach dem Prozesswechsel über IHRE ADRESSE geöffnet, und das steht so in der Rückgabe.
//
// WARUM DIE STATIONEN HIER UND NICHT IN DER TESTDATEI STEHEN: die Kalibrierungsdatei daneben fährt
// DIESELBEN Stationen mit einer gezielten Verstellung. Stünden sie zweimal ausgeschrieben da, wäre
// die Kalibrierung eine Aussage über ihre eigene Kopie und nicht über den Nachweis — dasselbe
// Argument, mit dem `tests/gast-nutzerweg/browserweg.ts:7-17` seinen einen Weg begründet.
import { type ChildProcessWithoutNullStreams, execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { createServer } from "node:net";
import { join, resolve } from "node:path";
import { expect } from "vitest";
import {
  type Browser,
  DIST,
  GEBIETSSCHEMA,
  type Kontext,
  type Seite,
  fn,
  tabBisText,
  tabBisZu,
  tippeMitTastatur,
  warte,
} from "../gast-nutzerweg/browserweg";

export const MARKE = "JOB 4323 MENUEWEG";

/** Die Werkswurzel — der `cwd` des Serverprozesses und der Ort von `apps/web`. */
export const WURZEL = resolve(import.meta.dirname, "../..");

/** Zusammengesetzt statt ausgeschrieben — `tests/app/job2354-drei-datenbanknamen.test.ts` liest
 *  jede ausgeschriebene Verbindungszeichenkette per Muster (dieselbe Regel wie in 4309 A8). */
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

/** Die Verbindungszeichenkette auf eine WEGWERF-Datenbank — der Name muss `test` tragen. */
export function pgUrl(v: Verbindung, datenbank: string): string {
  if (!datenbank.toLowerCase().includes("test")) {
    throw new Error(
      `${MARKE}: „${datenbank}" trägt kein „test" im Namen — diese Strecke fasst ausschliesslich Wegwerf-Datenbanken an.`,
    );
  }
  const anmeldung = `${encodeURIComponent(v.user)}:${encodeURIComponent(v.passwort)}`;
  return `${PG_SCHEMA}//${anmeldung}@${v.host}:${v.port}/${datenbank}`;
}

/** Ein Port, auf dem gerade nichts horcht — vom Betriebssystem vergeben, nicht geraten. */
export async function freierPort(): Promise<number> {
  return await new Promise<number>((fertig, scheitere) => {
    const horcher = createServer();
    horcher.once("error", scheitere);
    horcher.listen(0, "127.0.0.1", () => {
      const adresse = horcher.address();
      if (adresse === null || typeof adresse === "string") {
        horcher.close(() => scheitere(new Error(`${MARKE}: kein Port zu bekommen.`)));
        return;
      }
      const port = adresse.port;
      horcher.close(() => fertig(port));
    });
  });
}

/**
 * Die gebaute Fläche herstellen, wenn sie fehlt — einmal, mit dem echten Bündler.
 *
 * ABWEICHUNG, ausgeschrieben statt verschwiegen: dieselben Zeilen stehen in
 * `tests/gast-nutzerweg/gastweg-pg-im-browser.integration.test.ts:101-116` und in
 * `tests/wiki-gesamtanweisung-abnahme/a8-menue-und-migration.integration.test.ts:135-149`. Sie sind
 * dort nicht exportiert, und beide Dateien gehören anderen Zeilen und dürfen hier nicht geändert
 * werden. Es ist damit KEINE zweite Bauart — es ist dreimal derselbe Aufruf `npx vite build` in
 * `apps/web`, also genau das Bündel, das auch `./tools/build` erzeugt und das ausgeliefert wird.
 */
export function stelleFlaecheBereit(): string {
  if (existsSync(join(DIST, "index.html"))) {
    return "war schon da";
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
  return `gebaut in ${Date.now() - begonnen} ms`;
}

/**
 * Die Umgebung des Serverprozesses — vollständig NEU gebaut, nichts geerbt.
 *
 * Dieselbe Regel wie in `tests/neuinstallation/erstinstallation.integration.test.ts:673-692` (Fall
 * N3): eine geerbte `KLARWERK_SELF_REGISTRATION` aus `tests/setup-env.ts` brächte die Messung still
 * zum Schweigen, und ein geerbtes `DATABASE_URL` liesse den Prozess gegen eine fremde Datenbank
 * fahren. `NODE_ENV=production` samt beider Pflichtwerte des Startvertrags
 * (`services/app/src/start-vertrag.ts`) ist die Lage, in der eine Kundeninstanz wirklich läuft.
 */
export function serverUmgebung(url: string, port: number): NodeJS.ProcessEnv {
  return {
    PATH: process.env.PATH ?? "",
    HOME: process.env.HOME ?? "",
    TMPDIR: process.env.TMPDIR ?? "/tmp",
    KLARWERK_SKIP_KEYCHAIN: "1",
    KLARWERK_LOG_LEVEL: "warn",
    NODE_ENV: "production",
    DATABASE_URL: url,
    APP_BASE_URL: "https://wissen.kunde.test",
    PORT: String(port),
  };
}

/**
 * Wartet, bis `/health` antwortet — und meldet SICHTBAR, woran es lag, wenn nicht.
 *
 * Kein stilles Weiterlaufen: käme der Prozess nicht hoch und die Strecke führe trotzdem weiter,
 * liefe sie gegen den ALTEN Prozess oder gegen gar nichts, und beides sähe je nach Zeitpunkt wie
 * ein Ergebnis aus. Der mitgeschnittene Prozesstext steht deshalb in der Fehlermeldung.
 */
export async function warteAufGesund(
  basis: string,
  prozess: ChildProcessWithoutNullStreams,
  protokoll: string[],
  was: string,
): Promise<void> {
  const frist = Date.now() + 120_000;
  while (Date.now() < frist) {
    if (prozess.exitCode !== null || prozess.signalCode !== null) {
      throw new Error(
        `${MARKE} (${was}): der Serverprozess ist beendet (Code ${prozess.exitCode}, Signal ${prozess.signalCode}), bevor er antwortete.\n${protokoll.join("")}`,
      );
    }
    try {
      const antwort = await fetch(`${basis}/health`);
      if (antwort.ok) {
        return;
      }
    } catch {
      // noch nicht am Socket — weiter warten.
    }
    await new Promise((weiter) => setTimeout(weiter, 250));
  }
  throw new Error(
    `${MARKE} (${was}): der Serverprozess antwortete in 120 s nicht auf /health.\n${protokoll.join("")}`,
  );
}

/** Den mitgeschnittenen Prozesstext an eine Ablage hängen — für jede Fehlermeldung von Wert. */
export function schneideMit(prozess: ChildProcessWithoutNullStreams, protokoll: string[]): void {
  prozess.stdout.on("data", (d) => protokoll.push(String(d)));
  prozess.stderr.on("data", (d) => protokoll.push(String(d)));
}

// ------------------------------------------------------------------------------------------------
// TASTATUR UND SICHTBARKEIT
// ------------------------------------------------------------------------------------------------

/**
 * Sieht man, worauf der Fokus steht?
 *
 * Zeichengleich mit `FOKUS_SICHTBAR` in `browserweg.ts:153-160` — die dortige Funktion
 * `fokusMussSichtbarSein` ist MODULINTERN, und `browserweg.ts` gehört JOB 4322 und darf hier nicht
 * geändert werden. Gemessen wird der BERECHNETE Stil: Umriss oder Schatten. Beides trägt: der
 * globale Fokusstil des Produkts ist ein Ring, also ein `box-shadow`
 * (`apps/web/src/index.css:65-67`), und die Menüzeilen schalten genau deshalb nur `outline-none`.
 */
const FOKUS_SICHTBAR = `() => {
  const a = document.activeElement;
  if (!a) return false;
  const s = getComputedStyle(a);
  const umriss = s.outlineStyle !== "none" && Number.parseFloat(s.outlineWidth || "0") > 0;
  const schatten = s.boxShadow !== "none" && s.boxShadow !== "";
  return umriss || schatten;
}`;

/** Woran hing (oder fehlte) die Sichtbarkeit? Für Meldungen, die auf den Schuldigen zeigen. */
const FOKUS_DIAGNOSE = `() => {
  const a = document.activeElement;
  if (!a) return "aktiv: (nichts)";
  const s = getComputedStyle(a);
  return [
    "aktiv: <" + a.tagName.toLowerCase() + ">",
    "testid=" + (a.getAttribute("data-testid") ?? "(keine)"),
    "tabindex=" + (a.getAttribute("tabindex") ?? "(keiner)"),
    "outline=" + s.outlineStyle + " " + s.outlineWidth,
    "boxShadow=" + String(s.boxShadow).slice(0, 80),
  ].join(" · ");
}`;

/** Erfüllt das AKTIVE Element diesen Selektor? Der Beleg, dass ein Tab-Weg wirklich dort landete. */
const AKTIV_IST = "(sel) => { const a = document.activeElement; return !!a && a.matches(sel); }";

export async function fokusMussSichtbarSein(seite: Seite, was: string): Promise<void> {
  const stand = await seite.evaluate<string>(fn(FOKUS_DIAGNOSE));
  expect(
    await seite.evaluate<boolean>(fn(FOKUS_SICHTBAR)),
    `${MARKE}: „${was}" zeigt keinen sichtbaren Fokus, obwohl es gerade per Tastatur angesteuert wurde — ${stand}`,
  ).toBe(true);
}

/**
 * SICHTBAR heisst sichtbar — und zwar JE TEXTKNOTEN, nicht je Absatz (REGELN.md 9).
 *
 * RUNDE 4, BENs BEFUND ZU RUNDE 3. Hier stand eine FELDWEISE Messung: ein Feld war ein Element mit
 * unmittelbarem Text, sein Beleg war der `innerText` dieses Elements. BEN hat gemessen, was das
 * wert ist: er
 * hat den ERSTEN Textknoten jedes Herkunftsabsatzes in ein `<span style="opacity:0">` verschoben
 * und den Rest des Absatzes stehen gelassen (Cloud-Lauf `2ddd7c926c34fef101a9038c`). Beide Spans
 * waren nachweislich unsichtbar (`checkVisibility() === false`, `opacity === "0"`) — und die ganze
 * Strecke blieb GRÜN. Zwei Gründe, beide im damaligen Aufbau:
 *   · `innerText` eines Elements enthält den Text seiner NACHKOMMEN, auch den durchsichtiger. Der
 *     Absatz „sah" den Namen also weiterhin.
 *   · der Absatz stand im Gang VOR seinem Kind und wurde als erster Namensträger gewählt. Seine
 *     eigene Sichtbarkeit trug damit einen Text, den er gar nicht zeichnete.
 *
 * DESHALB IST DIE EINHEIT JETZT DER TEXTKNOTEN. Ein `TreeWalker` zerlegt den Behälter in seine
 * Textknoten; jeder trägt genau die Zeichen, die an EINER Stelle stehen, und wird EINZELN gemessen:
 *   · `Element.checkVisibility({ checkOpacity, checkVisibilityCSS })` am ELTERNELEMENT des Knotens —
 *     die Auskunft der Engine über genau die Stelle, an der diese Zeichen stehen. Sie sieht
 *     `display:none`, `visibility:hidden` und `opacity:0`, am Element wie an jedem Vorfahren.
 *   · die berechnete Deckkraft des Elternelements (`opacity !== "0"`) — ausdrücklich noch einmal,
 *     weil genau sie BENs Verstellung war.
 *   · `content-visibility` am Elternelement UND an jedem Vorfahren bis zum Behälter: ein
 *     übersprungener Inhalt ist nicht sichtbar, auch wenn sein Kasten Platz einnimmt (Runde 2, K9).
 *   · die FLÄCHE DES KNOTENS SELBST — ein `Range` um genau diese Zeichen, summiert über seine
 *     `getClientRects()`. Nicht der Kasten des Absatzes: der bleibt stehen, wenn sein Inhalt fort ist.
 *   · eine durchsichtige Schriftfarbe an der Stelle, an der die Zeichen stehen.
 *   · und zuletzt: `innerText` des Elternelements darf nicht LEER sein. Das ist eine reine
 *     Ausschlussbedingung (aus Runde 3 bewahrt) — sie kann nie eine Sichtbarkeit BELEGEN, nur eine
 *     widerlegen, und trägt deshalb nichts von einem Kind auf seinen Elternteil.
 *
 * KEIN TRÄGER-RÜCKSCHLUSS. Der sichtbare Text eines Behälters ist die Aneinanderreihung der Zeichen
 * SICHTBARER Knoten — sonst nichts. Kein Element belegt je die Sichtbarkeit seines Inhalts.
 * `textContent` steht nur noch dort, wo es die Zeichen EINES Textknotens meint (ein Textknoten hat
 * keinen anderen Text), und ist selbst kein Beleg: Beleg ist die Messung an genau dieser Stelle.
 */
const SICHT_HILFEN = `
  const normal = (t) => String(t || "").replace(/\\s+/g, " ").trim();
  const durchsichtigeFarbe = (s) => {
    const farbe = String(s.color || "").replace(/\\s/g, "");
    return farbe === "transparent" || farbe.endsWith(",0)");
  };
  const inhaltUnterdrueckt = (el, bis) => {
    let lauf = el;
    while (lauf) {
      if (getComputedStyle(lauf).contentVisibility === "hidden") return true;
      if (lauf === bis) return false;
      lauf = lauf.parentElement;
    }
    return false;
  };
  const knotenflaeche = (knoten) => {
    const bereich = document.createRange();
    bereich.selectNodeContents(knoten);
    const rechtecke = bereich.getClientRects();
    let summe = 0;
    for (let i = 0; i < rechtecke.length; i += 1) {
      const r = rechtecke[i];
      summe += Math.max(0, r.width) * Math.max(0, r.height);
    }
    return Math.round(summe);
  };
  const knotenbefund = (knoten, wurzel) => {
    const el = knoten.parentElement;
    const s = getComputedStyle(el);
    const kann = typeof el.checkVisibility === "function";
    return {
      marke: el.tagName.toLowerCase(),
      text: normal(knoten.textContent),
      geprueftMitCheckVisibility: kann,
      sichtbar: kann
        ? el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })
        : false,
      deckkraft: String(s.opacity || "1"),
      contentVisibility: s.contentVisibility || "visible",
      unterdrueckt: inhaltUnterdrueckt(el, wurzel),
      durchsichtig: durchsichtigeFarbe(s),
      flaeche: knotenflaeche(knoten),
      elternLeer: normal(el.innerText) === "",
    };
  };
  const knotenSichtbar = (k) =>
    k.geprueftMitCheckVisibility && k.sichtbar && !k.unterdrueckt && !k.durchsichtig
    && Number.parseFloat(k.deckkraft || "1") > 0 && k.flaeche > 0 && k.text !== ""
    && !k.elternLeer;
  const knotenVon = (wurzel) => {
    const gefunden = [];
    const gang = document.createTreeWalker(wurzel, NodeFilter.SHOW_TEXT);
    let k = gang.nextNode();
    while (k) {
      if (k.parentElement && normal(k.textContent) !== "") {
        gefunden.push(knotenbefund(k, wurzel));
      }
      k = gang.nextNode();
    }
    return gefunden;
  };
  const textVon = (wurzel) => {
    const knoten = knotenVon(wurzel);
    return {
      knoten,
      text: knoten.filter(knotenSichtbar).map((k) => k.text).join(" "),
      verborgen: knoten.filter((k) => !knotenSichtbar(k)).map((k) => k.text),
    };
  };
`;

const SICHTBARER_TEXT = `(sel) => {
  ${SICHT_HILFEN}
  const wurzel = document.querySelector(sel);
  if (!wurzel) return { da: false, text: "", verborgen: [], flaeche: 0 };
  const befund = textVon(wurzel);
  const s = getComputedStyle(wurzel);
  const r = wurzel.getBoundingClientRect();
  const kann = typeof wurzel.checkVisibility === "function";
  const sichtbar = kann
    ? wurzel.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })
    : s.display !== "none" && s.visibility !== "hidden";
  return {
    da: true,
    text: befund.text,
    verborgen: befund.verborgen,
    flaeche: sichtbar && r.width > 0 && r.height > 0 ? Math.round(r.width * r.height) : 0,
  };
}`;

/** EIN Textknoten — seine Zeichen und alles, was über SEINE Sichtbarkeit bekannt ist. */
export interface Textknotenbefund {
  /** Das Elternelement, an dem gemessen wurde — für Meldungen, die auf den Schuldigen zeigen. */
  marke: string;
  /** Die Zeichen dieses Knotens. Ein Textknoten hat keinen anderen Text als diesen. */
  text: string;
  geprueftMitCheckVisibility: boolean;
  /** `checkVisibility({checkOpacity, checkVisibilityCSS})` am ELTERNELEMENT dieses Knotens. */
  sichtbar: boolean;
  /** Die berechnete Deckkraft des Elternelements — BENs Verstellung aus Runde 3, eigens genannt. */
  deckkraft: string;
  contentVisibility: string;
  /** `content-visibility: hidden` am Elternelement oder an einem Vorfahren bis zum Behälter. */
  unterdrueckt: boolean;
  durchsichtig: boolean;
  /** Die Fläche EINES `Range` um genau diese Zeichen — nicht der Kasten, in dem sie stehen. */
  flaeche: number;
  /** `innerText` des Elternelements ist leer: dann zeichnet der Browser hier nichts. */
  elternLeer: boolean;
}

/**
 * Zeichnet der Browser DIESE Zeichen? Dieselbe Regel wie `knotenSichtbar` im Browser.
 *
 * Jede Bedingung ist notwendig, keine ist für sich hinreichend, und KEINE stammt von einem anderen
 * Knoten oder von einem Elternteil, der etwas anderes trägt (BEN, Runde 3).
 */
export function knotenIstSichtbar(k: Textknotenbefund): boolean {
  return (
    k.geprueftMitCheckVisibility &&
    k.sichtbar &&
    !k.unterdrueckt &&
    !k.durchsichtig &&
    Number.parseFloat(k.deckkraft || "1") > 0 &&
    k.flaeche > 0 &&
    k.text !== "" &&
    !k.elternLeer
  );
}

export interface Sichtbefund {
  da: boolean;
  text: string;
  verborgen: string[];
  flaeche: number;
}

/** Der WIRKLICH sichtbare Text eines Elements — oder ein Befund, der sagt, was fehlt. */
export async function sichtbefund(seite: Seite, selektor: string): Promise<Sichtbefund> {
  return seite.evaluate<Sichtbefund>(fn(SICHTBARER_TEXT), selektor);
}

/** Zusicherung: dieses Element ist da, hat Fläche und trägt diesen Text SICHTBAR. */
export async function mussSichtbarTragen(
  seite: Seite,
  selektor: string,
  erwartet: string,
  was: string,
): Promise<string> {
  const befund = await sichtbefund(seite, selektor);
  expect(befund.da, `${MARKE}: ${was} — ${selektor} steht nicht im Dokument`).toBe(true);
  expect(
    befund.flaeche,
    `${MARKE}: ${was} — ${selektor} hat keine Fläche auf dem Bildschirm (verborgen: ${befund.verborgen.join(" | ")})`,
  ).toBeGreaterThan(0);
  expect(
    befund.text,
    `${MARKE}: ${was} — sichtbar steht dort „${befund.text}", erwartet war „${erwartet}" (verborgen: ${befund.verborgen.join(" | ")})`,
  ).toContain(erwartet);
  return befund.text;
}

/**
 * Per Tab auf ein Element, sichtbarer Fokus nachgemessen, dann Enter.
 *
 * Der Selektorweg ist für Bedienelemente OHNE Beschriftung (das Zahnrad trägt nur ein
 * `aria-label`, die Sprachknöpfe tragen ein Kürzel, das in „Einstellungen" ebenfalls vorkäme).
 */
export async function tabUndEnter(
  seite: Seite,
  selektor: string,
  was: string,
  hoechstens: number,
  vonVorn: boolean,
): Promise<number> {
  const schritte = await tabBisZu(seite, selektor, hoechstens, vonVorn);
  await fokusMussSichtbarSein(seite, was);
  await seite.keyboard.press("Enter");
  return schritte;
}

/**
 * Per Tab auf ein Bedienelement mit DIESER Beschriftung, dann Enter.
 *
 * Für den Menüpunkt selbst der richtige Weg: ein Mensch sucht die BESCHRIFTUNG, nicht ein
 * `data-testid`. Und er ist der Weg, der eine zerstörte Tastaturbedienbarkeit auch benennt —
 * `tabBisText` sagt bei einem Element ausserhalb der Tab-Reihenfolge wörtlich „das ist die Halbheit
 * ‚nur mit der Maus'" (`browserweg.ts:257-259`). Dass der Tab-Weg dabei wirklich beim gemeinten
 * Element landet, wird danach am Selektor nachgemessen — sonst könnte ein anderer Knopf mit
 * derselben Zeichenfolge den Nachweis tragen.
 */
export async function tabBisBeschriftungUndEnter(
  seite: Seite,
  text: string,
  selektor: string,
  was: string,
  hoechstens: number,
): Promise<number> {
  const schritte = await tabBisText(seite, text, hoechstens, false);
  expect(
    await seite.evaluate<boolean>(fn(AKTIV_IST), selektor),
    `${MARKE}: der Tab-Weg zu „${text}" (${was}) endete nicht auf ${selektor} — ${await seite.evaluate<string>(fn(FOKUS_DIAGNOSE))}`,
  ).toBe(true);
  await fokusMussSichtbarSein(seite, was);
  await seite.keyboard.press("Enter");
  return schritte;
}

/**
 * Per Tab in ein Eingabefeld und tippen — wie `tippeMitTastatur` aus `browserweg.ts`, aber mit
 * wählbarer Obergrenze und wählbarem Startpunkt.
 *
 * WARUM NICHT DIE HAUSFUNKTION AN JEDER STELLE: sie setzt den Fokus IMMER auf den Dokumentanfang
 * zurück und zählt höchstens 150 Anschläge. Auf der Anmeldemaske ist das richtig und wird hier auch
 * so benutzt; auf der Anweisungsseite mit Hülle, Kopfband und Lesestand wäre jedes Feld ein neuer
 * Gang durch die ganze Seite — und der zweite Weg zum zweiten Feld ist der, den ein Mensch wirklich
 * geht: von Feld zu Feld weiter. Gemessen wird dasselbe: Tab, sichtbarer Fokus, echte Tastendrücke.
 */
export async function tippeAb(
  seite: Seite,
  selektor: string,
  text: string,
  was: string,
  hoechstens = 60,
  vonVorn = false,
): Promise<number> {
  const schritte = await tabBisZu(seite, selektor, hoechstens, vonVorn);
  await fokusMussSichtbarSein(seite, was);
  await seite.keyboard.type(text);
  return schritte;
}

// ------------------------------------------------------------------------------------------------
// DIE STATIONEN
// ------------------------------------------------------------------------------------------------

/**
 * Ein frisches Browserprofil OHNE vorgesetzte Sprachwahl.
 *
 * ABWEICHUNG vom Hausprofil `profil()` (`browserweg.ts:387-404`), und sie trägt den Nachweis:
 * `profil` legt `kw.sprache` über ein `addInitScript` an, und ein Init-Skript läuft bei JEDEM
 * Seitenaufbau erneut. Die Zusage von Station (d) — „die Wahl überlebt das Neuladen" — wäre damit
 * nicht messbar, weil der Prüfstand die Wahl bei jedem Laden selbst wieder überschriebe. Hier wird
 * NICHTS gesetzt: dass die Fläche auf Deutsch startet, ist die Vorgabe des Produkts
 * (`apps/web/src/lib/sprachwahl.ts:26`, `STANDARD_SPRACHE`), und was danach in `kw.sprache` steht,
 * hat der Sprachschalter geschrieben.
 *
 * Das GEBIETSSCHEMA bleibt `de-DE` (dieselbe Konstante wie im Hausprofil) und wandert NICHT mit der
 * Sprache mit: Playwrights `locale` setzt auch `Accept-Language`. Ginge es mit, könnte eine
 * englische Fläche auch dann erscheinen, wenn die Wahl der Nutzerin gar nicht wirkte.
 */
export async function frischesProfil(
  browser: Browser,
  vorbereiten?: (kontext: Kontext) => Promise<void>,
): Promise<{ kontext: Kontext; seite: Seite }> {
  const kontext = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    locale: GEBIETSSCHEMA,
  });
  if (vorbereiten) {
    await vorbereiten(kontext);
  }
  return { kontext, seite: await kontext.newPage() };
}

/** Anmeldung über die ECHTE Maske, ausschliesslich mit der Tastatur. */
export async function meldeAnMitTastatur(
  seite: Seite,
  basis: string,
  email: string,
  passwort: string,
): Promise<{ email: number; passwort: number }> {
  await seite.goto(`${basis}/`, { waitUntil: "domcontentloaded" });
  await warte(seite, `() => !!document.querySelector("#auth-email")`, `Anmeldemaske für ${email}`);
  const feldEmail = await tippeMitTastatur(seite, "#auth-email", email, "E-Mail");
  const feldPasswort = await tippeMitTastatur(seite, "#auth-password", passwort, "Passwort");
  await seite.keyboard.press("Enter");
  await warte(
    seite,
    `() => !document.querySelector("#auth-email")`,
    "die Anmeldung trägt",
    undefined,
    45_000,
  );
  return { email: feldEmail, passwort: feldPasswort };
}

export interface Menuebefund {
  /** Tab-Anschläge bis zum Zahnrad, bis „Bereiche" und bis zum Menüpunkt. */
  zahnrad: number;
  bereiche: number;
  eintrag: number;
  /** Der SICHTBARE Text des offenen Menüs, gelesen unmittelbar vor dem Enter auf dem Menüpunkt. */
  menuetext: string;
  /** Die Beschriftung des Menüpunkts, sichtbar gelesen. */
  eintragstext: string;
}

/**
 * DER MENÜWEG, OHNE MAUS: Zahnrad → Bereiche → Gesamtanweisungen.
 *
 * Die Sollwerte kommen als Parameter aus dem Sprachkatalog (`tests/support/i18nBestand.ts`) und
 * werden nicht abgeschrieben. Die Fläche muss bereits eine angemeldete Seite mit Kopfband zeigen;
 * es wird ABSICHTLICH nicht navigiert, damit der Sprachwechsel von Station (d) nicht durch einen
 * Seitenaufbau verdeckt wird.
 */
export async function menuewegOhneMaus(
  seite: Seite,
  sollBereiche: string,
  sollEintrag: string,
  sprache: string,
): Promise<Menuebefund> {
  await warte(
    seite,
    `() => !!document.querySelector('[data-testid="kopfband-zahnrad"]')`,
    `das Kopfband mit dem Zahnrad (${sprache})`,
    undefined,
    45_000,
  );

  // ── 1. Das Zahnrad: kein Text, nur ein `aria-label` — deshalb über den Selektor. ──────────────
  const zahnrad = await tabUndEnter(
    seite,
    '[data-testid="kopfband-zahnrad"]',
    `Zahnrad (${sprache})`,
    250,
    true,
  );
  await warte(
    seite,
    `() => !!document.querySelector('[data-testid="zahnrad-menue"]')`,
    `das geöffnete Zahnrad-Menü (${sprache})`,
  );
  // Der Fokus muss WIRKLICH im Menü stehen — sonst führte der Tab-Weg unten an ihm vorbei, und die
  // Zahlen darunter sagten etwas über die Seite statt über das Menü.
  await warte(
    seite,
    `() => { const f = document.querySelector('[data-testid="zahnrad-menue"]');
      return !!f && !!document.activeElement && f.contains(document.activeElement); }`,
    `der Fokus steht nach dem Öffnen IM Zahnrad-Menü (${sprache})`,
  );

  // ── 2. „Bereiche" aufklappen. Beschriftung zuerst prüfen, dann bedienen. ──────────────────────
  await mussSichtbarTragen(
    seite,
    '[data-testid="zahnrad-weitere-bereiche"]',
    sollBereiche,
    `das Untermenü heisst in „${sprache}" nicht „${sollBereiche}"`,
  );
  const bereiche = await tabUndEnter(
    seite,
    '[data-testid="zahnrad-weitere-bereiche"]',
    `Untermenü „${sollBereiche}" (${sprache})`,
    80,
    false,
  );
  await warte(
    seite,
    `() => document.querySelector('[data-testid="zahnrad-weitere-bereiche"]')?.getAttribute("aria-expanded") === "true"`,
    `das aufgeklappte Untermenü „${sollBereiche}" (${sprache})`,
  );

  // ── 3. Der Menüpunkt: erst DA und SICHTBAR und richtig beschriftet, dann bedient. ─────────────
  await warte(
    seite,
    `() => !!document.querySelector('[data-testid="bereich-gesamtanweisungen"]')`,
    `der Menüpunkt „${sollEintrag}" im aufgeklappten Untermenü (${sprache})`,
  );
  const eintragstext = await mussSichtbarTragen(
    seite,
    '[data-testid="bereich-gesamtanweisungen"]',
    sollEintrag,
    `der Menüpunkt trägt in „${sprache}" nicht die Beschriftung „${sollEintrag}"`,
  );
  const href = await seite.evaluate<string>(
    fn(
      `() => document.querySelector('[data-testid="bereich-gesamtanweisungen"]')?.getAttribute("href") ?? ""`,
    ),
  );
  expect(href, `${MARKE}: der Menüpunkt zeigt nicht auf /gesamtanweisungen (${sprache})`).toBe(
    "/gesamtanweisungen",
  );
  const menuetext = (await sichtbefund(seite, '[data-testid="zahnrad-menue"]')).text;
  const eintrag = await tabBisBeschriftungUndEnter(
    seite,
    sollEintrag,
    '[data-testid="bereich-gesamtanweisungen"]',
    `Menüpunkt „${sollEintrag}" (${sprache})`,
    120,
  );

  // ── 4. Und die Seite ist wirklich da. ─────────────────────────────────────────────────────────
  await warte(
    seite,
    `() => window.location.pathname === "/gesamtanweisungen" && !!document.querySelector('[data-testid="ga-bereich-anlegen"]')`,
    `der Einstieg der Gesamtanweisung nach dem Menüweg (${sprache})`,
    undefined,
    45_000,
  );
  return { zahnrad, bereiche, eintrag, menuetext, eintragstext };
}

/** Eine Anweisung anlegen — Titel getippt, Knopf per Tab und Enter. Gibt die Kennung zurück. */
export async function anweisungAnlegen(seite: Seite, titel: string): Promise<string> {
  await tippeAb(seite, "#ga-bereich-titel", titel, "Titel der Gesamtanweisung", 250, true);
  await tabUndEnter(
    seite,
    '[data-testid="ga-bereich-anlegen"] button[type="submit"]',
    "Absendeknopf des Einstiegs (Gesamtanweisung anlegen)",
    20,
    false,
  );
  await warte(
    seite,
    `() => !!document.querySelector('[data-testid="ga-seite"]')`,
    "die geöffnete Anweisung nach dem Anlegen",
    undefined,
    45_000,
  );
  const kennung = seite.url().split("/gesamtanweisungen/")[1] ?? "";
  expect(kennung.length, `${MARKE}: der Server hat keine Kennung vergeben`).toBeGreaterThan(0);
  return kennung;
}

/** Eine vorhandene Fassung als Baustein aufnehmen — alle drei Felder getippt, Knopf per Enter. */
export async function bausteinAufnehmen(
  seite: Seite,
  koId: string,
  fassung: number,
  nachweis: string,
  erwarteteZahl: number,
): Promise<void> {
  await tippeAb(seite, "#ga-aufnahme-koid", koId, "Eintrag (Aufnahme)", 250, true);
  await tippeAb(seite, "#ga-aufnahme-fassung", String(fassung), "Fassung (Aufnahme)", 20, false);
  await tippeAb(seite, "#ga-aufnahme-nachweis", nachweis, "Nachweis (Aufnahme)", 20, false);
  await tabUndEnter(
    seite,
    '[data-testid="ga-aufnahme"] button[type="submit"]',
    "Absendeknopf der Bausteinaufnahme",
    20,
    false,
  );
  await warte(
    seite,
    `(n) => document.querySelectorAll('[data-testid="ga-lesestand-baustein"]').length === n`,
    `der aufgenommene Baustein ${koId}`,
    erwarteteZahl,
    45_000,
  );
}

// ------------------------------------------------------------------------------------------------
// DIE BAUSTEINE — JEDER EINZELN, SICHTBAR, AN SEINEM EIGENEN TEXT ERKANNT.
// ------------------------------------------------------------------------------------------------
//
// HIER STAND BIS RUNDE 2 `BAUSTEINFOLGE`: eine Liste der `data-baustein`-Attribute in DOM-Reihenfolge.
// BEN hat in Runde 1 gemessen, was das wert ist — er hat den Bausteinen per Browser-Init-Skript
// `opacity: 0` gegeben, und die gesamte Strecke blieb GRÜN (`Tests 2 passed`, Exit 0). Ein Attribut
// belegt keine Sichtbarkeit, eine DOM-Zahl auch nicht, und die Datenbankzeile erst recht nicht
// (REGELN.md 9, BENs Korrekturpflicht 1 zu Runde 1).
//
// WAS JETZT GEMESSEN WIRD, je Baustein und nicht für die Liste als Ganzes:
//   · `Element.checkVisibility({ checkOpacity, checkVisibilityCSS })` — die Auskunft der Engine
//     selbst; sie sieht `opacity: 0`, `visibility: hidden`, `display: none` und `content-visibility`.
//     Ob die Engine sie überhaupt kennt, wird MITGEMELDET (`geprueftMitCheckVisibility`) und
//     zugesichert — ein stiller Rückfall auf die schwächere eigene Prüfung wäre genau die Halbheit,
//     gegen die diese Runde steht.
//   · die FLÄCHE IM FENSTER nach `scrollIntoView` — ein Rechteck weit ausserhalb des Sichtfensters
//     ist für einen Menschen nichts, das er sieht.
//   · der SICHTBARE TEXT je TEXTKNOTEN (`SICHT_HILFEN`): er trägt die IDENTITÄT des Bausteins
//     (Titel des gebundenen Wissenseintrags, `LesestandAnsicht.tsx:144-152`). Daran — und NICHT an
//     `data-baustein` — wird die Reihenfolge zugeordnet. Seit Runde 4 ist die Einheit der KNOTEN und
//     nicht mehr das Feld: ein Absatz, dessen Name in einem durchsichtigen Kind steht, zeichnet
//     diesen Namen nicht, auch wenn der Absatz selbst sichtbar ist (BEN, Runde 3).
//
// `data-baustein` wird weiterhin gelesen, aber nur noch als KENNUNG für den Abgleich mit der
// Datenbank. Es ist kein Sichtbarkeitsbeleg und wird auch nirgends mehr als einer benutzt.
const BAUSTEINBEFUNDE = `() => {
  ${SICHT_HILFEN}
  const fensterB = window.innerWidth;
  const fensterH = window.innerHeight;
  return [...document.querySelectorAll('[data-testid="ga-lesestand-baustein"]')].map((el, i) => {
    el.scrollIntoView({ block: "center", inline: "nearest" });
    const r = el.getBoundingClientRect();
    const breite = Math.max(0, Math.min(r.right, fensterB) - Math.max(r.left, 0));
    const hoehe = Math.max(0, Math.min(r.bottom, fensterH) - Math.max(r.top, 0));
    const befund = textVon(el);
    const kann = typeof el.checkVisibility === "function";
    return {
      platz: i + 1,
      kennung: el.getAttribute("data-baustein") || "",
      geprueftMitCheckVisibility: kann,
      sichtbar: kann
        ? el.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })
        : false,
      imFenster: Math.round(breite * hoehe),
      text: befund.text,
      verborgen: befund.verborgen,
      knoten: befund.knoten,
    };
  });
}`;

export interface Bausteinbefund {
  /** 1-basierte Stelle in der gezeichneten Liste. */
  platz: number;
  /** `data-baustein` — NUR zur Zuordnung zur Datenbank, nie als Sichtbarkeitsbeleg. */
  kennung: string;
  /** Wurde wirklich mit `Element.checkVisibility` gemessen? */
  geprueftMitCheckVisibility: boolean;
  sichtbar: boolean;
  /** Fläche im Sichtfenster (px²), nachdem der Baustein in den Blick gescrollt wurde. */
  imFenster: number;
  /** Der WIRKLICH GEZEICHNETE Text dieses Bausteins — nur die Zeichen SICHTBARER Textknoten. */
  text: string;
  /** Was an ihm steht, aber niemand liest — die Zeichen der unsichtbaren Knoten. */
  verborgen: string[];
  /** Jeder Textknoten einzeln — daran hängt die namentliche Meldung. */
  knoten: Textknotenbefund[];
}

/** Die Befunde aller gezeichneten Bausteine, in gezeichneter Reihenfolge. */
export async function bausteinbefunde(seite: Seite): Promise<Bausteinbefund[]> {
  return seite.evaluate<Bausteinbefund[]>(fn(BAUSTEINBEFUNDE));
}

/**
 * DIE FACHPRÜFUNG: genau diese Bausteine stehen SICHTBAR da, in dieser Reihenfolge.
 *
 * `erwartet` sind die identifizierenden SICHTBAREN Texte (der Titel des gebundenen Eintrags), nicht
 * Kennungen. Jede Zusicherung nennt beim Scheitern den PLATZ und den erwarteten Baustein — das ist
 * die „namentliche" Rotfärbung, die BENs Korrekturpflicht 1 verlangt.
 */
export async function bausteineMuessenSichtbarSein(
  seite: Seite,
  erwartet: readonly string[],
  wann: string,
): Promise<Bausteinbefund[]> {
  const befunde = await bausteinbefunde(seite);
  expect(
    befunde.length,
    `${MARKE}: ${wann} zeichnet die Fläche ${befunde.length} Bausteine statt ${erwartet.length} (sichtbar gelesen: ${befunde.map((b) => `„${b.text}"`).join(" | ")})`,
  ).toBe(erwartet.length);
  for (let i = 0; i < erwartet.length; i += 1) {
    const soll = erwartet[i] ?? "";
    const b = befunde[i];
    if (!b) {
      throw new Error(`${MARKE}: ${wann} — an Platz ${i + 1} steht überhaupt kein Baustein.`);
    }
    const lage = `verborgen: ${b.verborgen.join(" | ") || "(nichts)"}`;
    expect(
      b.geprueftMitCheckVisibility,
      `${MARKE}: ${wann} — der ${b.platz}. Baustein („${soll}") wurde NICHT mit Element.checkVisibility gemessen; ein schwächerer Ersatz zählt hier nicht als Sichtbarkeitsnachweis`,
    ).toBe(true);
    expect(
      b.sichtbar,
      `${MARKE}: ${wann} — der ${b.platz}. Baustein („${soll}") ist NICHT sichtbar (checkVisibility=false; ${lage})`,
    ).toBe(true);
    expect(
      b.imFenster,
      `${MARKE}: ${wann} — der ${b.platz}. Baustein („${soll}") hat auch nach dem Scrollen keine Fläche im Sichtfenster (${lage})`,
    ).toBeGreaterThan(0);

    // ── DER TEXTKNOTEN, DER DEN NAMEN TRÄGT — an SEINER Stelle gemessen. ───────────────────────
    //
    // Kein Träger-Rückschluss (BEN, Runde 3): gesucht wird der Knoten, dessen EIGENE Zeichen den
    // Namen enthalten, und geprüft wird GENAU DIESE Stelle. Ein sichtbarer Absatz daneben, ein
    // sichtbares Elternfeld darüber oder ein sichtbarer Nachbarknoten belegen hier nichts. Damit
    // scheitert auch BENs Verstellung aus Runde 3: steht der Name allein in einem
    // `<span style="opacity:0">` und bleibt der übrige Absatz sichtbar, ist der NAMENSKNOTEN
    // unsichtbar — und diese Zeile wird namentlich rot.
    const traeger = b.knoten.find((k) => k.text.includes(soll));
    const warum = traeger
      ? `Knoten in <${traeger.marke}>: „${traeger.text}" · checkVisibility=${traeger.sichtbar}` +
        ` · opacity=${traeger.deckkraft}` +
        ` · content-visibility=${traeger.contentVisibility}${traeger.unterdrueckt ? " (Inhalt übersprungen)" : ""}` +
        ` · Fläche dieser Zeichen=${traeger.flaeche} px² · durchsichtige Schrift=${traeger.durchsichtig}` +
        ` · innerText des Elternteils leer=${traeger.elternLeer}` +
        ` · mit checkVisibility gemessen=${traeger.geprueftMitCheckVisibility}`
      : "kein Textknoten dieses Bausteins trägt diesen Namen überhaupt";
    expect(
      traeger !== undefined && knotenIstSichtbar(traeger),
      `${MARKE}: ${wann} — Baustein „${soll}": Herkunftstext nicht sichtbar (${warum})`,
    ).toBe(true);

    // Und die Gesamtaussage: der gezeichnete Text dieses Bausteins — zusammengesetzt AUSSCHLIESSLICH
    // aus Textknoten, die die Prüfung oben bestehen — nennt ihn wirklich.
    expect(
      b.text,
      `${MARKE}: ${wann} — an Platz ${b.platz} steht GEZEICHNET „${b.text}", erwartet war der Baustein „${soll}" (${lage})`,
    ).toContain(soll);
  }
  return befunde;
}

export interface Sprachbefund {
  konto: number;
  schalter: number;
  htmlLang: string;
  gespeichert: string;
}

/**
 * DER SPRACHWECHSEL ÜBER DEN ECHTEN SCHALTER DER APP — Konto-Kreis, dann Sprachknopf, per Tastatur.
 *
 * Kein vorgesetztes `localStorage`, kein Neuladen: der Schalter ruft `i18n.changeLanguage`
 * (`apps/web/src/components/SprachSchalter.tsx:115-117`), und GESCHRIEBEN wird die Wahl an der
 * Anwendungswurzel (`bindSpracheSpeichern`). Beides wird danach nachgesehen — `<html lang>` UND
 * `kw.sprache`; die eine Aussage ohne die andere liesse offen, ob die Wahl den Neuaufbau überlebt.
 */
export async function spracheWechseln(seite: Seite, sprache: string): Promise<Sprachbefund> {
  const konto = await tabUndEnter(
    seite,
    '[data-testid="kopfband-konto"]',
    "Konto-Kreis im Kopfband",
    250,
    true,
  );
  await warte(
    seite,
    `() => !!document.querySelector('[data-testid="konto-menue"]')`,
    "das geöffnete Konto-Menü",
  );
  const schalter = await tabUndEnter(
    seite,
    `[data-testid="sprach-schalter-${sprache}"]`,
    `Sprachknopf „${sprache}"`,
    80,
    false,
  );
  await warte(
    seite,
    "(s) => document.documentElement.lang === s",
    `die Fläche steht nach dem Sprachwechsel auf „${sprache}"`,
    sprache,
    45_000,
  );
  const htmlLang = await seite.evaluate<string>(fn("() => document.documentElement.lang"));
  const gespeichert = await seite.evaluate<string>(
    fn(
      `() => { try { return localStorage.getItem("kw.sprache") ?? "(nichts)"; } catch (e) { return "(Speicher gesperrt)"; } }`,
    ),
  );
  // Das Menü wieder schliessen — mit Escape, nicht mit einem Klick daneben. Der Fokus geht dabei
  // auf den Konto-Kreis zurück (`Menue.tsx:62-67`), und der Menüweg unten beginnt ohnehin von vorn.
  await seite.keyboard.press("Escape");
  await warte(
    seite,
    `() => !document.querySelector('[data-testid="konto-menue"]')`,
    "das Konto-Menü schliesst mit Escape",
  );
  return { konto, schalter, htmlLang, gespeichert };
}
