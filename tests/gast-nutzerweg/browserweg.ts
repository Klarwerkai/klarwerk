// ================================================================================================
// JOB 4223 R2 · DER GANZE GASTWEG IM BROWSER — EINMAL BESCHRIEBEN, ZWEIMAL GEFAHREN.
// ================================================================================================
//
// WARUM DIESE DATEI IN RUNDE 2 ENTSTANDEN IST. BEN hat an Runde 1 zu Recht beanstandet, dass der
// „durchgehende Weg" in Wahrheit zwei getrennte Behauptungen waren: der Browserlauf fuhr gegen
// SPEICHERablagen, der PostgreSQL-Lauf sprach nur HTTP und bediente kein Formular. Zwischen beiden
// lag genau die Annahme, gegen die dieser Auftrag gebaut ist. Der Weg steht deshalb ab jetzt GENAU
// EINMAL hier und wird von zwei Dateien mit zwei Ablagen gefahren:
//
//   · `gastweg-im-echten-browser.test.ts`              → Speicherablagen, läuft im Tor (kein Docker,
//                                                        keine Datenbank nötig).
//   · `gastweg-pg-im-browser.integration.test.ts`      → `buildPgServices(pool)`, echte PostgreSQL.
//
// Läge der Ablauf zweimal ausgeschrieben da, wären es wieder zwei Aussagen, die nur heute
// übereinstimmen — dasselbe Argument, mit dem `tests/demo-zugang-gaeste/aufbau.ts:7` seinen einen
// Aufbau begründet.
//
// ================================================================================================
// DIE TASTATUR WIRD GEDRÜCKT, NICHT NACHGEBILDET — der zweite Befund der Runde 1.
// ================================================================================================
//
// Runde 1 behauptete einen Tastaturnachweis und öffnete die Befristung in Wahrheit mit einem
// JavaScript-`click()` aus `page.evaluate`. BEN hat das mit einer eigenen Mutation belegt: er hat
// den Knopf „Befristung setzen" im Produkt mit `tabIndex={-1}` aus der Tab-Reihenfolge genommen —
// und der Fall blieb GRÜN. Ein Nachweis, der eine zerstörte Bedienbarkeit nicht sieht, ist keiner.
//
// JEDES Bedienelement dieses Weges wird deshalb über `tastaturAusloesen` erreicht: Tab drücken, bis
// das AKTIVE Element die gesuchte Beschriftung trägt, den SICHTBAREN Fokus am berechneten Stil
// nachmessen, dann Enter. Ein Knopf, den kein Tab erreicht, lässt diesen Weg scheitern — und genau
// das ist die Zusage aus Lieferung 6.
//
// DIE EINE AUSNAHME, benannt statt versteckt: der TAG im Datumsfeld wird mit `fill` gesetzt. Eine
// native Datumseingabe nimmt die Ziffern in der Reihenfolge des GEBIETSSCHEMAS entgegen
// (TT.MM.JJJJ gegen MM/DD/YYYY); ein getippter Tag maesse die Einstellung des Prüfstands statt das
// Produkt. Das Feld selbst wird trotzdem per Tab angesteuert und sein Fokus nachgemessen — die
// Frage „ist es mit der Tastatur erreichbar" bleibt damit beantwortet, nur das Eintippen der
// Ziffern ist es nicht.
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { expect } from "vitest";
import { registerWebStatic } from "../../services/app/src/web-static";
import { MELDUNGEN } from "../../services/auth/src/meldungen";
import { PASSWORT, type Sitzung, type Strecke } from "./strecke";

export const DIST = resolve(process.cwd(), "apps/web/dist");
/** Das schmalste Gerät der Zielliste — Lieferung 6 misst an dieser Kante. */
export const SCHMAL = { width: 390, height: 844 };

// ------------------------------------------------------------------------------------------------
// Die schmale Typhülle um Playwright. `playwright` kommt über `createRequire` und nicht als
// statischer Import — so erkennt die Browser-Gruppe des Tors die Verbraucher dieser Datei am
// Importgraphen (`tests/tor-inventar/browser-gruppe.ts`).
// ------------------------------------------------------------------------------------------------
export type BrowserFn = (arg: unknown) => unknown;
export const fn = (quelle: string): BrowserFn =>
  new Function("arg", `return (${quelle})(arg);`) as BrowserFn;

export interface Seite {
  goto(url: string, opts?: Record<string, unknown>): Promise<unknown>;
  reload(opts?: Record<string, unknown>): Promise<unknown>;
  waitForFunction(f: BrowserFn, arg?: unknown, opts?: Record<string, unknown>): Promise<unknown>;
  evaluate<T>(f: BrowserFn, arg?: unknown): Promise<T>;
  fill(selector: string, value: string): Promise<void>;
  click(selector: string, opts?: Record<string, unknown>): Promise<void>;
  keyboard: { press(key: string): Promise<void>; type(text: string): Promise<void> };
  url(): string;
}
export interface Kontext {
  newPage(): Promise<Seite>;
  addInitScript(script: string): Promise<void>;
  cookies(): Promise<{ name: string; value: string }[]>;
  close(): Promise<void>;
}
export interface Browser {
  newContext(opts?: Record<string, unknown>): Promise<Kontext>;
  close(): Promise<void>;
}

export const LIES_TEXT = "() => document.body.innerText";
const AKTIVER_PFAD = `() => {
  const a = document.activeElement;
  if (!a) return "(nichts)";
  const id = a.getAttribute("id");
  const typ = a.getAttribute("type");
  return [a.tagName.toLowerCase(), id ? "#" + id : "", typ ? "[" + typ + "]" : "", (a.textContent || "").trim().slice(0, 40)].join("|");
}`;

/**
 * Sieht man, worauf der Fokus steht?
 *
 * Gemessen wird der BERECHNETE Stil des aktiven Elements — Umriss oder Schatten. Ein Vertrag, der
 * nur im Quelltext steht (`focus-visible:ring-…`), ist keine Sichtbarkeit: er wirkt erst, wenn der
 * Browser seine Tastaturheuristik anwendet, und genau die kann jsdom nicht.
 */
const FOKUS_SICHTBAR = `() => {
  const a = document.activeElement;
  if (!a) return false;
  const s = getComputedStyle(a);
  const umriss = s.outlineStyle !== "none" && Number.parseFloat(s.outlineWidth || "0") > 0;
  const schatten = s.boxShadow !== "none" && s.boxShadow !== "";
  return umriss || schatten;
}`;

/** Woran hing (oder fehlte) die Sichtbarkeit? Für Fehlermeldungen, die auf den Schuldigen zeigen. */
const FOKUS_DIAGNOSE = `() => {
  const a = document.activeElement;
  if (!a) return "aktiv: (nichts)";
  const s = getComputedStyle(a);
  return [
    "aktiv: <" + a.tagName.toLowerCase() + ">",
    "klassen=" + (a.getAttribute("class") || "").slice(0, 120),
    "tabindex=" + (a.getAttribute("tabindex") ?? "(keiner)"),
    "outline=" + s.outlineStyle + " " + s.outlineWidth + " " + s.outlineColor,
    "boxShadow=" + String(s.boxShadow).slice(0, 80),
  ].join(" · ");
}`;

/** Der Fokus geht auf den Dokumentanfang zurück — ohne das DOM anzufassen. */
const FOKUS_ZURUECKSETZEN =
  "() => { const a = document.activeElement; if (a && a.blur) { a.blur(); } return true; }";

export async function warte(
  seite: Seite,
  quelle: string,
  was: string,
  arg?: unknown,
  frist = 30_000,
): Promise<void> {
  try {
    await seite.waitForFunction(fn(quelle), arg, { timeout: frist });
  } catch (fehler) {
    const text = await seite.evaluate<string>(fn(LIES_TEXT)).catch(() => "<nicht lesbar>");
    throw new Error(
      `JOB 4223: ${was} — nicht eingetreten in ${frist} ms auf ${seite.url()}.\nSeitentext:\n${text.slice(0, 1600)}\n\nUrsprung: ${String(fehler)}`,
    );
  }
}

/**
 * Tab drücken, bis das AKTIVE Element den Selektor erfüllt. Gibt die Zahl der Anschläge zurück.
 *
 * `vonVorn` setzt den Fokus vorher auf den Dokumentanfang zurück — nötig überall dort, wo ein
 * React-Neuaufbau das zuletzt fokussierte Element entfernt hat (dann liegt der Fokus auf `body`,
 * und ohne diesen Schritt hinge die Zählung von der Vorgeschichte ab).
 */
export async function tabBisZu(
  seite: Seite,
  selektor: string,
  hoechstens = 150,
  vonVorn = false,
): Promise<number> {
  if (vonVorn) {
    await seite.evaluate<boolean>(fn(FOKUS_ZURUECKSETZEN));
  }
  const treffer = "(sel) => { const a = document.activeElement; return !!a && a.matches(sel); }";
  for (let schritte = 1; schritte <= hoechstens; schritte += 1) {
    await seite.keyboard.press("Tab");
    if (await seite.evaluate<boolean>(fn(treffer), selektor)) {
      return schritte;
    }
  }
  throw new Error(
    `JOB 4223: „${selektor}" war in ${hoechstens} Tab-Anschlägen nicht erreichbar. Zuletzt aktiv: ${await seite.evaluate<string>(fn(AKTIVER_PFAD))}`,
  );
}

/**
 * Die Menge der Elemente, die ein Mensch WIRKLICH bedient.
 *
 * RUNDE 2, ERSTER MESSBEFUND: Ohne diese Einschränkung traf der Tab-Weg an der Kontokarte ein
 * anderes Element als den Knopf — Chromium macht einen scrollbaren Bereich von sich aus
 * tastaturfokussierbar, und dessen `textContent` enthält die gesuchte Beschriftung ebenfalls. Der
 * Fall scheiterte dann an einem Container, der richtigerweise keinen Fokusring trägt, und die
 * Meldung zeigte auf den falschen Schuldigen. Gesucht ist das BEDIENELEMENT, nicht irgendein
 * Vorfahre, der denselben Text umschliesst.
 */
const BEDIENBAR = 'button, a[href], input, select, textarea, [role="button"]';

/** Tab drücken, bis das aktive BEDIENELEMENT diese Beschriftung trägt. */
export async function tabBisText(
  seite: Seite,
  text: string,
  hoechstens = 150,
  vonVorn = true,
): Promise<number> {
  if (vonVorn) {
    await seite.evaluate<boolean>(fn(FOKUS_ZURUECKSETZEN));
  }
  const treffer = `([t, sel]) => {
    const a = document.activeElement;
    return !!a && a.matches(sel) && (a.textContent || "").trim().includes(t);
  }`;
  for (let schritte = 1; schritte <= hoechstens; schritte += 1) {
    await seite.keyboard.press("Tab");
    if (await seite.evaluate<boolean>(fn(treffer), [text, BEDIENBAR])) {
      return schritte;
    }
  }
  throw new Error(
    `JOB 4223: ein Bedienelement mit „${text}" war in ${hoechstens} Tab-Anschlägen nicht erreichbar — das ist die Halbheit „nur mit der Maus". Zuletzt aktiv: ${await seite.evaluate<string>(fn(AKTIVER_PFAD))}`,
  );
}

/**
 * DER EINE WEG ZU EINEM BEDIENELEMENT: per Tab hin, Fokus sichtbar, mit Enter ausgelöst.
 *
 * Es gibt in dieser Datei bewusst KEINEN zweiten (kein `click()` aus `page.evaluate`, kein
 * `page.click`) — sonst stünde neben dem gemessenen Weg ein ungemessener, und der nächste Fall
 * nähme den bequemeren.
 */
export async function tastaturAusloesen(seite: Seite, text: string): Promise<number> {
  const schritte = await tabBisText(seite, text);
  await fokusMussSichtbarSein(seite, text);
  await seite.keyboard.press("Enter");
  return schritte;
}

/**
 * Die Sichtbarkeitsprüfung des Fokus, an EINER Stelle.
 *
 * Die Diagnose wird VOR der Zusicherung geholt und in ihre Meldung gelegt: ein „expected false to
 * be true" allein sagt nicht, WELCHES Element gemeint war und WORAN die Sichtbarkeit hing.
 */
async function fokusMussSichtbarSein(seite: Seite, was: string): Promise<void> {
  const stand = await seite.evaluate<string>(fn(FOKUS_DIAGNOSE));
  expect(
    await seite.evaluate<boolean>(fn(FOKUS_SICHTBAR)),
    `„${was}" zeigt keinen sichtbaren Fokus, obwohl es gerade per Tastatur angesteuert wurde — ${stand}`,
  ).toBe(true);
}

/**
 * RUNDE 3 · DER EINE WEG ZU EINEM EINGABEFELD — und warum es ihn geben muss.
 *
 * BEN hat an Runde 2 gemessen, was die Rückgabe damals „klickfrei" nannte: das ERSTE Formularfeld
 * (der Name) wurde mit `page.click` angesteuert, und alles danach hing an dessen Fokus. Seine
 * Mutation `tabIndex={-1}` AM NAMENSFELD liess den Fall deshalb GRÜN — ein Feld, das kein Tab mehr
 * erreicht, wäre für eine Tastaturnutzerin der Anfang einer Sackgasse, und der Nachweis sah es
 * nicht. Dasselbe galt für `#auth-email` an der Anmeldemaske.
 *
 * Seit dieser Runde führt auch zu einem EINGABEFELD nur ein Weg: Fokus auf den Dokumentanfang
 * zurück, per Tab hin, sichtbarer Fokus nachgemessen, dann tippen. `page.click` und `evaluate`-
 * `click()` kommen in dieser Datei nicht mehr vor.
 *
 * WARUM ÜBER DIE IDENTITÄT UND NICHT ÜBER EINEN SELEKTOR: gesucht ist „das erste Eingabefeld DIESER
 * Karte", und das ist genau `document.querySelector(sel)`. Ein Selektorvergleich (`a.matches(sel)`)
 * träfe jedes Feld der Karte und bliebe grün, wenn der Tab-Weg beim ZWEITEN landete — dann stimmte
 * die Reihenfolge nicht mehr, und die Eingaben lägen danach in den falschen Feldern.
 */
export async function tippeMitTastatur(
  seite: Seite,
  selektor: string,
  text: string,
  was: string,
): Promise<number> {
  await seite.evaluate<boolean>(fn(FOKUS_ZURUECKSETZEN));
  const treffer = `(sel) => {
    const ziel = document.querySelector(sel);
    return !!ziel && document.activeElement === ziel;
  }`;
  for (let schritte = 1; schritte <= 150; schritte += 1) {
    await seite.keyboard.press("Tab");
    if (await seite.evaluate<boolean>(fn(treffer), selektor)) {
      await fokusMussSichtbarSein(seite, was);
      await seite.keyboard.type(text);
      return schritte;
    }
  }
  throw new Error(
    `JOB 4223: das Eingabefeld „${was}" (${selektor}) war in 150 Tab-Anschlägen nicht erreichbar — das ist die Halbheit „nur mit der Maus". Zuletzt aktiv: ${await seite.evaluate<string>(fn(AKTIVER_PFAD))}`,
  );
}

/** Ein frisches Browserprofil: eigener Keksbeutel, eigener Speicher, Sprache fest auf Deutsch. */
export async function profil(
  browser: Browser,
  viewport = SCHMAL,
): Promise<{ kontext: Kontext; seite: Seite }> {
  const kontext = await browser.newContext({ viewport });
  // Die Sprache wird GESETZT und nicht geraten: die Sollwerte unten stammen aus dem deutschen
  // Katalog, und ein Prüfstand, dessen Sprache von der Umgebung abhängt, misst mal dies, mal das.
  await kontext.addInitScript(`try { localStorage.setItem("kw.sprache", "de"); } catch (e) {}`);
  return { kontext, seite: await kontext.newPage() };
}

/** Chromium starten — mit der Vorbedingung, die LAUT scheitert statt still zu überspringen. */
export function starteChromium(): Promise<Browser> {
  if (!existsSync(join(DIST, "index.html"))) {
    throw new Error(
      `JOB 4223: ${DIST}/index.html fehlt — die gebaute Fläche ist die Vorbedingung dieses Laufs (im Tor läuft ./tools/build davor, tools/check:9).`,
    );
  }
  const require = createRequire(import.meta.url);
  const { chromium } = require("playwright") as {
    chromium: { launch(o: Record<string, unknown>): Promise<Browser> };
  };
  return chromium.launch({ headless: true, args: ["--no-sandbox", "--disable-gpu"] });
}

/** Die gebaute Fläche vor dem Horchen an die echte Instanz hängen — wie `server.ts:66`. */
export function mitFlaeche(): {
  vorListen: (app: Parameters<typeof registerWebStatic>[0]) => Promise<void>;
} {
  return { vorListen: (app) => registerWebStatic(app, DIST) };
}

/**
 * Anmeldung über die ECHTE Maske, ausschliesslich mit der Tastatur.
 *
 * RUNDE 3: auch das E-Mail-Feld wird per Tab erreicht und nicht mehr angeklickt. Dass die Maske es
 * von sich aus fokussiert (`autoFocus` in `AuthScreens.tsx`), ist dabei KEIN Ersatz für die
 * Erreichbarkeit — ein Feld mit `tabIndex={-1}` wäre autofokussiert und trotzdem für jeden, der
 * einmal weggetabbt ist, unerreichbar. Der Fokus geht deshalb zuerst auf den Dokumentanfang zurück.
 */
async function anmelden(
  seite: Seite,
  basis: string,
  email: string,
  passwort: string,
  /** Unter welchem Namen die Tastaturschritte im Befund erscheinen. */
  marke: string,
  tastatur: Record<string, number>,
  /** Beim Wiederanmelden nach dem Ablauf steht die Maske schon da — dann nicht neu laden. */
  neuLaden = true,
): Promise<void> {
  if (neuLaden) {
    await seite.goto(`${basis}/`, { waitUntil: "domcontentloaded" });
  }
  await warte(seite, `() => !!document.querySelector("#auth-email")`, `Anmeldemaske für ${email}`);
  tastatur[`${marke}_email`] = await tippeMitTastatur(
    seite,
    "#auth-email",
    email,
    `E-Mail (${marke})`,
  );
  tastatur[`${marke}_passwort`] = await tippeMitTastatur(
    seite,
    "#auth-password",
    passwort,
    `Passwort (${marke})`,
  );
  await seite.keyboard.press("Enter");
}

/** Der lokalisierte Kalendertag, wie ihn das Produkt schreibt (`toLocaleDateString(i18n.language)`). */
const TAG_ANZEIGE = `(tag) => {
  const teile = tag.split("-").map(Number);
  return new Date(teile[0], teile[1] - 1, teile[2], 23, 59, 59, 999).toLocaleDateString("de");
}`;

/** Die Zeile der Kontenliste, die diesen Text trägt — Wert, Überlauf und Geometrie. */
const ZEILE = `(n) => {
  const z = [...document.querySelectorAll('[data-einst="zeile"]')].find((e) => (e.textContent || "").includes(n));
  if (!z) return null;
  const wert = z.querySelector('[data-einst="wert"]');
  const label = z.querySelector('[data-einst="label"]');
  const zr = z.getBoundingClientRect();
  const lr = label ? label.getBoundingClientRect() : zr;
  return {
    wert: (wert ? wert.textContent : "") || "",
    zeileUeberlauf: z.scrollWidth - z.clientWidth,
    seiteUeberlauf: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    labelRechts: Math.round(lr.right),
    zeileRechts: Math.round(zr.right),
  };
}`;

/** Ein geschützter Abruf AUS DER SEITE HERAUS — mit den Keksen genau dieses Profils. */
const GESCHUETZTER_ABRUF = `() => fetch("/api/kos", { credentials: "include" })
  .then((r) => r.text().then((t) => ({ status: r.status, rumpf: t.slice(0, 4000) })))
  .catch((e) => ({ status: -1, rumpf: String(e) }))`;

export interface Zeilenbefund {
  wert: string;
  zeileUeberlauf: number;
  seiteUeberlauf: number;
  labelRechts: number;
  zeileRechts: number;
}

export interface WegAufbau {
  browser: Browser;
  strecke: Strecke;
  /** Die API-Sitzung des Admins — NUR zum Nachsehen, nie als Abkürzung für einen Schritt des Weges. */
  adminApi: Sitzung;
  adminEmail: string;
  gastName: string;
  gastEmail: string;
  titel: string;
  /** Der Tag, auf den befristet wird, und der Tag, auf den verlängert wird (`YYYY-MM-DD`). */
  fristTag: string;
  verlaengerungsTag: string;
  vergangenerTag: string;
}

export interface WegBefund {
  gastId: string;
  zeileNachAnlage: Zeilenbefund;
  nachbarWert: string;
  erwarteteAnzeige: string;
  gesperrterAbruf: { status: number; rumpf: string };
  tastatur: Record<string, number>;
}

/**
 * DER GANZE WEG, in der Reihenfolge, in der ihn ein Mensch geht.
 *
 * Anlegen (Formular, Tastatur, 390 px) → Anmelden im ZWEITEN Profil → Arbeiten → Ablauf über die
 * Fläche des Admins → der nächste Schritt des Gastes ist gesperrt → Verlängern über dieselbe
 * Fläche → erneut anmelden → weiterarbeiten.
 *
 * Alles an EINER Instanz, mit zwei getrennten Browserprofilen. Welche Ablagen darunter liegen,
 * entscheidet der Aufrufer — das ist der einzige Unterschied zwischen dem Tor-Lauf und dem
 * PostgreSQL-Lauf.
 */
export async function fahreDenGanzenWeg(a: WegAufbau): Promise<WegBefund> {
  const basis = a.strecke.basis;
  const tastatur: Record<string, number> = {};
  const adminProfil = await profil(a.browser);
  const gastProfil = await profil(a.browser);
  const spaeterProfil = await profil(a.browser);
  try {
    // ══ 1. Der Admin meldet sich an seiner Fläche an. ══════════════════════════════════════════
    const adminSeite = adminProfil.seite;
    await anmelden(adminSeite, basis, a.adminEmail, PASSWORT, "anmeldungAdmin", tastatur);
    await warte(
      adminSeite,
      `() => !document.querySelector("#auth-email")`,
      "die Anmeldung des Admins trägt",
    );

    // ══ 2. Anlegen — EIN Formular, Rolle UND Frist, bei 390 px, mit der Tastatur. ══════════════
    await adminSeite.goto(`${basis}/admin?bereich=konten&detail=nutzerNeu`, {
      waitUntil: "domcontentloaded",
    });
    const karte = `[data-testid="detail-nutzer-neu"]`;
    await warte(adminSeite, "(s) => !!document.querySelector(s)", "Anlegekarte", karte);
    expect(
      await adminSeite.evaluate<number>(
        fn("() => document.documentElement.scrollWidth - document.documentElement.clientWidth"),
      ),
      "die Anlegekarte läuft bei 390 px seitlich über",
    ).toBeLessThanOrEqual(0);

    // DAS ERSTE FELD WIRD PER TAB ERREICHT, NICHT ANGEKLICKT (BENs Korrekturpflicht 1 der Runde 2).
    // Bis hierher stand hier `page.click` — und damit hing der ganze Tastaturweg an einem Mausklick.
    // BENs Mutation `tabIndex={-1}` am Namensfeld liess den Fall deshalb grün.
    tastatur.namensfeld = await tippeMitTastatur(
      adminSeite,
      `${karte} input`,
      a.gastName,
      "Name (Anlegekarte)",
    );
    // Die drei folgenden Felder in der Reihenfolge des Formulars — jedes mit sichtbarem Fokus.
    for (const [feld, wert] of [
      ["E-Mail (Anlegekarte)", a.gastEmail],
      ["Passwort (Anlegekarte)", PASSWORT],
      ["Passwortwiederholung (Anlegekarte)", PASSWORT],
    ] as const) {
      await adminSeite.keyboard.press("Tab");
      await fokusMussSichtbarSein(adminSeite, feld);
      await adminSeite.keyboard.type(wert);
    }
    // Die Rolle: von der Vorgabe „Experte" (ROLES[1]) eine Stufe hinauf zu „Betrachter" (ROLES[0]),
    // mit der Pfeiltaste an der nativen Auswahl.
    tastatur.rollenauswahl = await tabBisZu(adminSeite, `${karte} select`, 20);
    await fokusMussSichtbarSein(adminSeite, "Rollenauswahl");
    await adminSeite.keyboard.press("ArrowUp");
    expect(
      await adminSeite.evaluate<string>(
        fn(`(s) => (document.querySelector(s + " select") || {}).value || ""`),
        karte,
      ),
      "die per Tastatur gewählte Rolle",
    ).toBe("viewer");

    // Die Befristung öffnen — per Tab und Enter, nicht per `click()`.
    tastatur.befristungOeffnen = await tastaturAusloesen(adminSeite, "Befristung setzen");
    await warte(
      adminSeite,
      `(s) => !!document.querySelector(s + " input[type=date]")`,
      "die Datumseingabe der Anlage",
      karte,
    );
    tastatur.datumsfeldAnlage = await tabBisZu(adminSeite, `${karte} input[type=date]`, 150, true);
    expect(
      await adminSeite.evaluate<boolean>(fn(FOKUS_SICHTBAR)),
      "das Datumsfeld der Anlage zeigt keinen sichtbaren Fokus",
    ).toBe(true);
    await adminSeite.fill(`${karte} input[type=date]`, a.fristTag);

    tastatur.anlegen = await tastaturAusloesen(adminSeite, "Anlegen");

    // ══ 3. Die Frist steht an SEINER Zeile — mit Tag, Monat und Jahr. ══════════════════════════
    await warte(
      adminSeite,
      `(n) => [...document.querySelectorAll('[data-einst="zeile"]')].some((z) => (z.textContent || "").includes(n))`,
      "die Kontenliste führt den neuen Gast",
      a.gastName,
      45_000,
    );
    const erwarteteAnzeige = await adminSeite.evaluate<string>(fn(TAG_ANZEIGE), a.fristTag);
    const zeileNachAnlage = await adminSeite.evaluate<Zeilenbefund | null>(fn(ZEILE), a.gastName);
    expect(zeileNachAnlage, "die Zeile des Gastes fehlt").not.toBeNull();
    const zeile = zeileNachAnlage as Zeilenbefund;
    expect(zeile.wert, "die Zeile nennt die Rolle nicht").toContain("Betrachter");
    expect(zeile.wert, "die Zeile nennt die Befristung nicht").toContain("befristet bis");
    // VOLLSTÄNDIGES Datum, nicht nur das Jahr (BEN, Prüflücke 6 der Runde 1): ein Test, der nur
    // „2031" liest, bliebe grün, wenn Tag und Monat vertauscht oder verschoben wären.
    expect(zeile.wert, `die Zeile zeigt nicht den gewählten Tag ${erwarteteAnzeige}`).toContain(
      erwarteteAnzeige,
    );
    // Der Nachbar bleibt unbefristet — sonst wäre oben auch ein Produkt erfüllt, das jeder Zeile
    // dieselbe Frist anschriebe.
    const nachbar = await adminSeite.evaluate<Zeilenbefund | null>(fn(ZEILE), "Admin");
    expect(nachbar, "die Zeile des Admins fehlt").not.toBeNull();
    expect((nachbar as Zeilenbefund).wert, "der Nachbar trägt eine Befristung").not.toContain(
      "befristet bis",
    );

    const gastId = await gastKennung(a);

    // ══ 4. Der Gast meldet sich in SEINEM eigenen, frischen Profil an und arbeitet. ════════════
    const gastSeite = gastProfil.seite;
    await gastSeite.goto(`${basis}/`, { waitUntil: "domcontentloaded" });
    await warte(
      gastSeite,
      `() => !!document.querySelector("#auth-email")`,
      "Anmeldemaske des Gastes",
    );
    expect(
      (await gastProfil.kontext.cookies()).some((k) => k.name === "kw_session"),
      "ein frisches Profil trägt bereits einen Sitzungskeks",
    ).toBe(false);
    await anmelden(gastSeite, basis, a.gastEmail, PASSWORT, "anmeldungGast", tastatur);
    await warte(
      gastSeite,
      `() => !document.querySelector("#auth-email")`,
      "die Anmeldung des Gastes trägt",
    );
    expect(
      (await gastProfil.kontext.cookies()).some((k) => k.name === "kw_session"),
      "das Gastprofil hat keinen eigenen Sitzungskeks bekommen",
    ).toBe(true);
    await gastSeite.goto(`${basis}/bibliothek`, { waitUntil: "domcontentloaded" });
    await warte(
      gastSeite,
      "(t) => document.body.innerText.includes(t)",
      "der Gast sieht den Bestand in der Bibliothek",
      a.titel,
      45_000,
    );

    // ══ 5. Der Admin beendet die Frist über SEINE Fläche — wieder mit der Tastatur. ════════════
    await adminSeite.goto(`${basis}/admin?bereich=konten`, { waitUntil: "domcontentloaded" });
    await warte(
      adminSeite,
      `(n) => [...document.querySelectorAll('[data-einst="zeile"]')].some((z) => (z.textContent || "").includes(n))`,
      "die Kontenliste führt den Gast",
      a.gastName,
      45_000,
    );
    tastatur.zeileOeffnen = await tastaturAusloesen(adminSeite, a.gastName);
    await warte(
      adminSeite,
      `() => !!document.querySelector('[data-einst="gastfrist-stand"]')`,
      "die Kontokarte mit dem Fristenstand",
    );
    tastatur.fristBeenden = await fristSetzen(adminSeite, a.vergangenerTag, tastatur, "beenden");
    await warte(
      adminSeite,
      `() => (document.querySelector('[data-einst="gastfrist-stand"]')?.textContent || "").includes("Abgelaufen am")`,
      "die Karte sagt: abgelaufen",
      undefined,
      45_000,
    );

    // ══ 6. Der nächste Schritt des Gastes ist gesperrt — Fläche UND geschützter Abruf. ════════
    await gastSeite.reload({ waitUntil: "domcontentloaded" });
    await warte(
      gastSeite,
      `() => !!document.querySelector("#auth-email")`,
      "der Gast steht wieder vor der Anmeldemaske",
      undefined,
      45_000,
    );
    expect(
      await gastSeite.evaluate<string>(fn(LIES_TEXT)),
      "geschützter Inhalt steht noch auf der Seite — auch aus dem Zwischenspeicher darf er nicht",
    ).not.toContain(a.titel);
    // BEN, Prüflücke 6: die Maske allein belegt nur die ANSICHT. Hier fragt das Gastprofil den
    // geschützten Weg SELBST, mit genau seinen Keksen — Status und Rumpf werden gelesen.
    const gesperrterAbruf = await gastSeite.evaluate<{ status: number; rumpf: string }>(
      fn(GESCHUETZTER_ABRUF),
    );
    expect(
      [401, 403],
      `der geschützte Abruf aus dem Gastprofil antwortete ${gesperrterAbruf.status}: ${gesperrterAbruf.rumpf.slice(0, 400)}`,
    ).toContain(gesperrterAbruf.status);
    expect(gesperrterAbruf.rumpf, "der Rumpf trägt geschützten Inhalt").not.toContain(a.titel);

    // ══ 6b. UND ER LIEST, WAS MIT SEINEM ZUGANG IST — im echten Browser. ══════════════════════
    //
    // RUNDE 3, BENs KORREKTURPFLICHT 2: Dieser Nachweis stand in Runde 1 als Ende von C4 da und ist
    // beim Zusammenführen zu EINEM Weg in Runde 2 verlorengegangen — die Rückgabe behauptete ihn
    // trotzdem weiter. Er steht jetzt wieder hier, an der Stelle, an der ein Mensch ihn erlebt:
    // der Gast versucht sich neu anzumelden und bekommt den ABLAUFsatz, nicht irgendeinen Fehler.
    //
    // DER SOLLWERT KOMMT AUS DEM KATALOG (`MELDUNGEN`), nicht aus einer hier eingetippten Abschrift
    // — dieselbe Regel wie in `tests/gast-ablauf-anmeldemaske/…:27-30`. Und er wird gegen den
    // NACHBARSATZ abgegrenzt: „noch nicht freigegeben" wäre hier eine Unwahrheit, denn dieses Konto
    // IST freigegeben (JOB 3756, und der BEN-Neufund aus JOB 4011).
    await anmelden(
      gastSeite,
      basis,
      a.gastEmail,
      PASSWORT,
      "anmeldungGastNachAblauf",
      tastatur,
      false,
    );
    await warte(
      gastSeite,
      "(t) => document.body.innerText.includes(t)",
      `der abgewiesene Gast liest „${MELDUNGEN.ACCESS_EXPIRED.de}"`,
      MELDUNGEN.ACCESS_EXPIRED.de,
      45_000,
    );
    const maskentext = await gastSeite.evaluate<string>(fn(LIES_TEXT));
    expect(
      maskentext,
      "die Maske behauptet, das Konto sei nie freigegeben worden — es ist aber abgelaufen",
    ).not.toContain(MELDUNGEN.NOT_APPROVED.de);
    expect(maskentext, "und geschützter Inhalt steht auch hier nicht").not.toContain(a.titel);

    // ══ 7. Verlängern — über dieselbe Fläche, mit der Tastatur. ════════════════════════════════
    tastatur.fristVerlaengern = await fristSetzen(
      adminSeite,
      a.verlaengerungsTag,
      tastatur,
      "verlaengern",
    );
    await warte(
      adminSeite,
      `() => (document.querySelector('[data-einst="gastfrist-stand"]')?.textContent || "").includes("Gültig bis")`,
      "die Karte sagt wieder: gültig bis",
      undefined,
      45_000,
    );

    // ══ 8. Und der Gast kommt wirklich zurück herein und arbeitet weiter. ═════════════════════
    const spaet = spaeterProfil.seite;
    await anmelden(spaet, basis, a.gastEmail, PASSWORT, "anmeldungGastVerlaengert", tastatur);
    await warte(
      spaet,
      `() => !document.querySelector("#auth-email")`,
      "die erneute Anmeldung des Gastes trägt",
      undefined,
      45_000,
    );
    await spaet.goto(`${basis}/bibliothek`, { waitUntil: "domcontentloaded" });
    await warte(
      spaet,
      "(t) => document.body.innerText.includes(t)",
      "der verlängerte Gast arbeitet weiter",
      a.titel,
      45_000,
    );

    return {
      gastId,
      zeileNachAnlage: zeile,
      nachbarWert: (nachbar as Zeilenbefund).wert,
      erwarteteAnzeige,
      gesperrterAbruf,
      tastatur,
    };
  } finally {
    await adminProfil.kontext.close();
    await gastProfil.kontext.close();
    await spaeterProfil.kontext.close();
  }
}

/**
 * Befristung ändern oder verlängern — öffnen, Tag setzen, speichern. Alles per Tab und Enter.
 *
 * Der Knopf heisst an einem bereits befristeten Konto „Befristung ändern oder verlängern"; die
 * Datumseingabe und „Befristung speichern" folgen. Nach jedem React-Neuaufbau beginnt der Tab-Weg
 * wieder am Dokumentanfang (`vonVorn`), sonst hinge die Zählung an der Vorgeschichte.
 */
async function fristSetzen(
  seite: Seite,
  tag: string,
  tastatur: Record<string, number>,
  marke: string,
): Promise<number> {
  const schritte = await tastaturAusloesen(seite, "Befristung ändern oder verlängern");
  await warte(seite, `() => !!document.querySelector('input[type=date]')`, `Datumsfeld (${marke})`);
  tastatur[`datumsfeld_${marke}`] = await tabBisZu(seite, "input[type=date]", 150, true);
  expect(
    await seite.evaluate<boolean>(fn(FOKUS_SICHTBAR)),
    `das Datumsfeld (${marke}) zeigt keinen sichtbaren Fokus`,
  ).toBe(true);
  await seite.fill("input[type=date]", tag);
  tastatur[`speichern_${marke}`] = await tastaturAusloesen(seite, "Befristung speichern");
  return schritte;
}

/** Die Kennung des Gastes — nachgesehen, nicht geraten. Kein Schritt des Weges, nur ein Blick. */
async function gastKennung(a: WegAufbau): Promise<string> {
  const antwort = await a.adminApi.sende("GET", "/api/users");
  const liste = antwort.json as { id: string; email: string }[];
  const gast = liste.find((u) => u.email === a.gastEmail);
  if (!gast) {
    throw new Error(
      `JOB 4223: der über die Fläche angelegte Gast ${a.gastEmail} fehlt im Bestand.`,
    );
  }
  return gast.id;
}
