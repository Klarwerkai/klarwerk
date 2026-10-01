// ================================================================================================
// GRAPH-BROWSER-RECHTE · WISSENSBEZIEHUNGEN IM ECHTEN CHROMIUM SETZEN, WIDERRUFEN, NEU LADEN — UND
// NACH EINEM RECHTEENTZUG NICHT MEHR SEHEN. EINE STRECKE, ZWEI ABLAGEN.
// ================================================================================================
//
// DER REST, GEGEN DEN DIESE DATEI STEHT, wörtlich aus dem letzten Urteil zu JOB 4153
// (`archiv/4153/runde-5/ben.md`, Prüflücke 6): „jsdom belegt keine tatsächliche Tastaturführung
// oder schmale Darstellung (`tastatur-und-schmal.test.tsx:8`). Im Nachfolger echte
// Browserbedienung sowie Speicherung, Neuladen und Rechteentzug gegen den Server prüfen."
//
// WAS DIE NACHFOLGER SCHON BELEGT HABEN und hier NICHT wiederholt wird:
//   · JOB 4305 — Feldliste der Eintragsansicht nach dem Restore, Rechteentzug VOR der Sicherung
//     (der Browser öffnet erst NACH dem Entzug), Wissensnetz-Zahlen.
//   · JOB 4328 — Link zur Gegenseite per Klick, Menüweg, Graph, Widerruf per Klick, SIGTERM.
//   · JOB 4356 — das Statuswort in drei Sprachen.
// Keiner davon hat eine Beziehung IM BROWSER ANGELEGT (alle Bestände entstehen über HTTP), keiner
// ist mit der Tastatur gefahren, keiner schmal, und keiner hat einer OFFENEN Sitzung das Recht
// entzogen. Genau das tut diese Strecke:
//
//   (1) ANLEGEN NUR MIT DER TASTATUR, 360 px breit: Tab zur Suche, tippen, Treffer per Enter,
//       Art und Richtung per Tastatur im `<select>`, Tab zum Knopf, Enter. Danach unabhängig am
//       Server (HTTP, und bei PostgreSQL an der Tabelle) nachgelesen.
//   (2) NEU LADEN: dieselbe Kachel (gleiche Kennung) mit Satz, Herkunft, Status — sichtbar, nicht
//       abgeschnitten, ohne waagrechten Überlauf. Und per Tastatur über „Beitrag öffnen" zur
//       Gegenseite: dort derselbe Satz aus der ANDEREN Richtung.
//   (3) ÄNDERN = WIDERRUFEN, nur mit der Tastatur (die einzige Änderung, die der Vertrag an einer
//       Beziehung kennt: `POST /api/beziehungen/:id/widerruf`). Antwortstatus sichtbar, Server und
//       Tabelle sagen `widerrufen`, nach dem Neuladen ist die Kachel weg.
//   (4) RECHTEENTZUG AN EINER OFFENEN SITZUNG: eine Controllerin sieht die Beziehung zu einem
//       vertraulichen Eintrag, der Admin stuft sie zur Expertin herab, und DIESELBE Browsersitzung
//       sieht nach dem Neuladen weder Beziehung noch Titel noch Inhalt — API und Fläche. Der Admin
//       (berechtigt) sieht Status, Herkunft und Richtung von BEIDEN Seiten weiter richtig.
//
// Der historische 500 (4328 R1) steht NICHT mehr in dieser Strecke. Runde 1 legte hier bei offenem
// Graphen 101 Einträge an und konnte damit nur eine Nicht-Reproduktion belegen (Befund B3, Ben R1).
// Er ist jetzt zugeordnet und minimal reproduziert: `tastatur-schmal-rechte-pg.integration.test.ts`,
// Fall ALT-500 (Prüfprotokoll-Folge `seq`, 23505 `audit_pkey`).
//
// SICHTBAR HEISST SICHTBAR (REGELN.md 9): jedes Feld einzeln, `innerText`, `checkVisibility` —
// und ohne `checkVisibility` der Rückfall mit Vorfahrenkette und Verdeckung
// (`tests/support/sichtRueckfall.ts`). Zusätzlich IMMER die Verdeckungsprobe: `checkVisibility`
// selbst sieht kein darüberliegendes Element.
//
// WARUM EINE STRECKE FÜR ZWEI ABLAGEN: der Lauf im Tor nimmt die Speicherablagen (das Tor fährt
// ohne Docker), der Integrationslauf reicht einen `Pool` herein — DIESELBEN Schritte, dasselbe
// Argument wie `tests/gast-nutzerweg/strecke.ts:36-40`.
import type { FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { expect } from "vitest";
import i18n from "../../apps/web/src/i18n";
import { registerWebStatic } from "../../services/app/src/web-static";
import {
  type Browser,
  DIST,
  type Kontext,
  type Seite,
  fn,
  profil,
  tabBisZu,
  warte,
} from "../gast-nutzerweg/browserweg";
import { PASSWORT, type Sitzung, type Strecke, starteStrecke } from "../gast-nutzerweg/strecke";
import { meldeAnMitTastatur } from "../gesamtanweisung-nutzerweg/weg";
import { SICHT_RUECKFALL } from "../support/sichtRueckfall";
import { sollWort } from "../wissensbeziehungen-status/sollwoerter";

export const MARKE = "[KLARWERK] GRAPH-BROWSER-RECHTE";

/** Die schmale Darstellung: ein kleines Telefon. Schmaler als `SCHMAL` (390) aus `browserweg.ts`. */
export const SCHMAL_360 = { width: 360, height: 780 };

const ADMIN = { name: "Rechte Admin", email: "wbr-admin@graph-browser-rechte.test" };
const CONTROLLER = {
  name: "Rechte Controllerin",
  email: "wbr-controller@graph-browser-rechte.test",
};

/**
 * Drei Einträge. `anker` ist der, an dem gesetzt wird; `ziel` wird über die Suche gefunden;
 * `geheim` ist vertraulich — ihn sehen nur Rollen mit `ko.validate` (Controller, Admin;
 * `services/app/src/sichtbarkeit.ts`, `services/rbac/src/policy.ts`), und Autor ist der Admin,
 * damit keine Autor-Ausnahme greift.
 */
export const EINTRAEGE = {
  anker: { titel: "Pumpenwartung Halle Sieben", stufe: "intern" },
  ziel: { titel: "Dichtungstausch Kreiselpumpe Quarz", stufe: "intern" },
  geheim: { titel: "Einkaufspreis Dichtsatz Zulieferer Ost", stufe: "vertraulich" },
} as const;
type Kurz = keyof typeof EINTRAEGE;

/** Das Suchwort — kommt NUR im Titel von `ziel` vor, damit genau ein Treffer steht. */
const SUCHWORT = "Quarz";

/** Die im Browser gesetzte Beziehung: gerichtet, damit beide Leserichtungen verschieden sind. */
export const GESETZT = { art: "ersetzt", richtung: "gerichtet" } as const;
/** Die vorab über HTTP gesetzte, die der Rechteentzug verbergen muss — ebenfalls gerichtet. */
export const VERBORGEN = { art: "gehoert_zu", richtung: "gerichtet" } as const;

const t = (schluessel: string, werte: Record<string, string> = {}): string =>
  String(i18n.t(schluessel, werte));

// ------------------------------------------------------------------------------------------------
// DIE LESEFUNKTION IM BROWSER
// ------------------------------------------------------------------------------------------------

/**
 * Definiert im Browser `befund(e)`: `checkVisibility` (wo vorhanden) UND der Rückfall mit
 * Vorfahrenkette, Farbe, Kasten und Verdeckung. Ohne `checkVisibility` bleibt nur der Rückfall —
 * und `verfahren` sagt dann genau das.
 */
const SICHT = `
  ${SICHT_RUECKFALL}
  const befund = (e) => {
    if (!e) return { da: false, sichtbar: false, messbar: true, grund: "kein Element", verfahren: "-", text: "", links: 0, rechts: 0 };
    const gruende = [];
    let verfahren = "checkVisibility + Vorfahrenkette/Verdeckung";
    if (typeof e.checkVisibility === "function") {
      if (!e.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true, contentVisibilityAuto: true })) {
        gruende.push("checkVisibility=false");
      }
    } else {
      verfahren = "Rueckfall ohne checkVisibility";
    }
    // Der Rückfall läuft IMMER mit: checkVisibility sieht kein darüberliegendes Element. Kann er
    // die Verdeckung nicht messen, steht das als messbar=false im Feld — nie als „sichtbar".
    const rf = sichtRueckfall(e);
    if (!rf.sichtbar) gruende.push(rf.grund);
    const r = e.getBoundingClientRect();
    return {
      da: true,
      sichtbar: gruende.length === 0,
      messbar: rf.messbar,
      grund: gruende.length === 0 ? "sichtbar" : gruende.join(" / "),
      verfahren,
      text: String(e.innerText || "").replace(/\\s+/g, " ").trim(),
      links: Math.round(r.left),
      rechts: Math.round(r.right),
    };
  };`;

export interface Feld {
  da: boolean;
  sichtbar: boolean;
  /** `false`: die Verdeckung war nicht messbar (`sichtRueckfall.ts`) — dann ist `sichtbar` false. */
  messbar: boolean;
  grund: string;
  verfahren: string;
  text: string;
  links: number;
  rechts: number;
}

export interface Kachel {
  id: string;
  kachel: Feld;
  satz: Feld;
  herkunft: Feld;
  status: Feld;
  statusWert: string | null;
  urheber: Feld;
  oeffnen: Feld;
  widerruf: Feld;
  /** `scrollWidth - clientWidth` der Kachel: > 0 heisst, etwas ist abgeschnitten. */
  ueberlauf: number;
}

export interface Bereich {
  ids: string[];
  kacheln: Kachel[];
  leer: boolean;
  fehler: string;
  /** `scrollWidth - clientWidth` des Dokuments: > 0 heisst, die Seite scrollt waagrecht. */
  seitenUeberlauf: number;
  breite: number;
  seitentext: string;
}

const BEREICH = `() => {
  ${SICHT}
  const bereich = document.querySelector('[data-testid="wissensbeziehungen"]');
  const kacheln = bereich ? Array.from(bereich.querySelectorAll('[data-testid="wb-kante"]')) : [];
  const fehler = document.querySelector('[data-testid="wb-fehler"]');
  const wurzel = document.documentElement;
  return {
    ids: kacheln.map((li) => li.getAttribute("data-kante-id") || ""),
    kacheln: kacheln.map((li) => {
      const status = li.querySelector('[data-testid="wb-status"]');
      return {
        id: li.getAttribute("data-kante-id") || "",
        kachel: befund(li),
        satz: befund(li.querySelector("p:first-of-type")),
        herkunft: befund(li.querySelector('[data-testid="wb-herkunft"]')),
        status: befund(status),
        statusWert: status ? status.getAttribute("data-status") : null,
        urheber: befund(li.querySelector('[data-testid="wb-status"] + span')),
        oeffnen: befund(li.querySelector("a[href]")),
        widerruf: befund(li.querySelector('[data-testid="wb-widerruf"]')),
        ueberlauf: li.scrollWidth - li.clientWidth,
      };
    }),
    leer: !!document.querySelector('[data-testid="wb-leer"]'),
    fehler: fehler ? String(fehler.innerText || "") : "",
    seitenUeberlauf: wurzel.scrollWidth - wurzel.clientWidth,
    breite: window.innerWidth,
    seitentext: String(document.body.innerText || "").replace(/\\s+/g, " "),
  };
}`;

/** Ein einzelnes Element nach Selektor — für Meldungen, Antwortstatus, Setzformular. */
const EINZELN = `(sel) => {
  ${SICHT}
  return befund(document.querySelector(sel));
}`;

/**
 * DER ENDZUSTAND DES BEZIEHUNGSBEREICHS — und welcher (Befund B2, Ben R1).
 *
 * Hier stand bis Runde 1 „Bereich da und kein `wb-laedt`". Das war auch beim LESEFEHLER wahr
 * (`wb-fehler`) und während einer Auffrischung aus altem Bestand — ein fehlender Eintrag konnte so
 * als „entfernt" zählen, obwohl die Antwort gescheitert oder noch unterwegs war. Jetzt liefert das
 * Prädikat `""`, solange nichts entschieden ist (lädt, oder `wb-stand` sagt „Auffrischung läuft"),
 * und sonst GENAU EINEN benannten Endzustand. Welcher davon ein Erfolg ist, entscheidet der
 * Aufrufer (`ladeBereich`) — ein Fehler wird dort nie zu „leer".
 */
const BEREICH_ZUSTAND = `(laeuft) => {
  const b = document.querySelector('[data-testid="wissensbeziehungen"]');
  if (!b || b.querySelector('[data-testid="wb-laedt"]')) return "";
  if (b.querySelector('[data-testid="wb-fehler"]')) return "fehler";
  if (b.querySelector('[data-testid="auffrischung-fehlgeschlagen"]')) return "auffrischung-gescheitert";
  const stand = b.querySelector('[data-testid="wb-stand"]');
  if (!stand || String(stand.innerText || "").includes(laeuft)) return "";
  if (b.querySelector('[data-testid="wb-liste"]')) return "liste";
  if (b.querySelector('[data-testid="wb-leer"]')) return "leer";
  return "";
}`;

type BereichZustand = "liste" | "leer" | "fehler" | "auffrischung-gescheitert";

/** Der Teil von `wb.standAuffrischung`, der NUR während einer laufenden Auffrischung dasteht. */
const laeuftSatz = (): string => {
  const teile = t("wb.standAuffrischung", { zeit: "\u0000" }).split("\u0000");
  const rest = (teile[1] ?? "").trim();
  expect(rest, "wb.standAuffrischung hat keinen eigenen Satzteil nach der Zeit").not.toBe("");
  return rest;
};

// ------------------------------------------------------------------------------------------------
// DAS NETZ — die Antwort des Servers wird ABGEWARTET, nicht erraten (Befund B2, Ben R1)
// ------------------------------------------------------------------------------------------------
//
// `Seite`/`Kontext` aus `browserweg.ts` sind die schmale Hülle um Playwright; die zwei Methoden,
// die nur diese Strecke braucht, stehen hier als Erweiterung statt in der geteilten Hülle.

interface Antwort {
  url(): string;
  status(): number;
  text(): Promise<string>;
  request(): { method(): string };
}
type SeiteMitNetz = Seite & {
  waitForResponse(passt: (a: Antwort) => boolean, opts?: Record<string, unknown>): Promise<Antwort>;
  waitForLoadState(zustand: "networkidle", opts?: Record<string, unknown>): Promise<void>;
};
interface Umleitung {
  fulfill(o: { status: number; contentType?: string; body?: string }): Promise<void>;
  continue(): Promise<void>;
}
export type KontextMitNetz = Kontext & {
  route(muster: string, handler: (u: Umleitung) => Promise<void>): Promise<void>;
};

/** Wartet auf die ERSTE Antwort auf `GET <pfad>`, die nach dem Aufruf eintrifft. */
function antwortAuf(seite: Seite, pfad: string, frist = 45_000): Promise<Antwort> {
  const warten = (seite as SeiteMitNetz).waitForResponse(
    (a) => a.request().method() === "GET" && new URL(a.url()).pathname === pfad,
    { timeout: frist },
  );
  // Scheitert die Aktion davor, wird dieses Versprechen nie abgeholt — kein unbehandelter Wurf.
  warten.catch(() => undefined);
  return warten;
}

/**
 * Führt `aktion` aus (Navigation/Neuladen), wartet die Antwort auf die Beziehungsliste von `id` ab
 * und danach den Endzustand der Fläche. Erfolg heisst: Antwort 200 UND Zustand `liste`/`leer`.
 * Alles andere wirft mit Zustand und Status — ein Lesefehler ist nie ein leerer Bestand.
 */
async function ladeBereich(
  seite: Seite,
  id: string,
  was: string,
  aktion: () => Promise<unknown>,
): Promise<{ zustand: BereichZustand; status: number }> {
  const antwort = antwortAuf(seite, `/api/kos/${id}/beziehungen`);
  await aktion();
  const a = await antwort;
  const laeuft = laeuftSatz();
  await warte(
    seite,
    BEREICH_ZUSTAND,
    `Endzustand des Beziehungsbereichs an ${was}`,
    laeuft,
    45_000,
  );
  const zustand = await seite.evaluate<BereichZustand>(fn(BEREICH_ZUSTAND), laeuft);
  if (a.status() !== 200 || (zustand !== "liste" && zustand !== "leer")) {
    throw new Error(
      `${MARKE}: der Beziehungsbereich an ${was} hat nicht erfolgreich geladen — Antwort ${a.status()}, Zustand „${zustand}". Ein Lesefehler zählt nicht als leerer Bestand.`,
    );
  }
  return { zustand, status: a.status() };
}

/**
 * Öffnet einen Eintrag, den diese Sitzung NICHT lesen darf, und wartet auf den eindeutigen
 * Endzustand (Befund B2, Ben R1): die Antwort auf `GET /api/kos/<id>` ist da, UND die Lesefläche
 * steht in ihrem Fehlerzweig („Der Eintrag ließ sich nicht laden.", `BibliothekLesen.tsx`). Vorher
 * wartete die Strecke nur auf „irgendein Seitentext und kein aria-busy" — das war schon während
 * des Ladens wahr, denn die ladende Lesefläche setzt kein `aria-busy`.
 *
 * Gibt den Status und Rumpf der ersten Antwort zurück; danach wartet sie den Ruhezustand des Netzes
 * ab (`networkidle`), damit auch die Wiederholung der Abfrage (`retry: 1`, `main.tsx`) und die
 * Liste daneben beantwortet sind, bevor der Aufrufer den Seitentext liest.
 */
export async function oeffneUnlesbar(
  seite: Seite,
  basis: string,
  id: string,
): Promise<{ status: number; rumpf: string; ms: number }> {
  const beginn = Date.now();
  const antwort = antwortAuf(seite, `/api/kos/${id}`);
  await seite.goto(`${basis}/wissen/${id}`, { waitUntil: "domcontentloaded" });
  const a = await antwort;
  await warte(
    seite,
    `(satz) => { const l = document.querySelector('[data-testid="bib-lesen"]'); return !!l && String(l.innerText || "").includes(satz); }`,
    "Endzustand der Lesefläche: ihr Fehlerzweig",
    t("lib.lesen.fehler"),
    45_000,
  );
  const ms = Date.now() - beginn;
  await (seite as SeiteMitNetz).waitForLoadState("networkidle", { timeout: 45_000 });
  return { status: a.status(), rumpf: await a.text(), ms };
}

/** Das Prädikat aus Runde 1 — steht nur noch für die Kalibrierung da (K11 zeigt, dass es zu früh ja sagt). */
export const DETAIL_ALT_R1 = `() => document.body.innerText.trim().length > 0 && !document.querySelector('[aria-busy="true"]')`;

/** Steht der Tastaturfokus sichtbar auf dem aktiven Element? Dieselbe Regel wie `browserweg.ts:168`. */
const FOKUS_SICHTBAR = `() => {
  const a = document.activeElement;
  if (!a) return "kein aktives Element";
  const s = getComputedStyle(a);
  const umriss = s.outlineStyle !== "none" && Number.parseFloat(s.outlineWidth || "0") > 0;
  const schatten = s.boxShadow !== "none" && s.boxShadow !== "";
  return umriss || schatten ? "" : "<" + a.tagName.toLowerCase() + (a.id ? "#" + a.id : "") + "> outline=" + s.outlineStyle + " " + s.outlineWidth + " boxShadow=" + s.boxShadow;
}`;

export async function liesBereich(seite: Seite): Promise<Bereich> {
  return await seite.evaluate<Bereich>(fn(BEREICH));
}

export async function liesEinzeln(seite: Seite, selektor: string): Promise<Feld> {
  return await seite.evaluate<Feld>(fn(EINZELN), selektor);
}

/** Alle Pflichtfelder einer Kachel, die nicht sichtbar oder ausserhalb der Breite stehen. */
export function kachelMaengel(k: Kachel, breite: number): string[] {
  const maengel: string[] = [];
  const felder: [string, Feld][] = [
    ["kachel", k.kachel],
    ["satz", k.satz],
    ["herkunft", k.herkunft],
    ["status", k.status],
    ["urheber", k.urheber],
    ["oeffnen", k.oeffnen],
    ["widerruf", k.widerruf],
  ];
  for (const [name, f] of felder) {
    if (!f.messbar) {
      maengel.push(`${name}: NICHT MESSBAR (${f.grund}; ${f.verfahren})`);
    } else if (!f.sichtbar) {
      maengel.push(`${name}: nicht sichtbar (${f.grund}; ${f.verfahren})`);
    } else if (f.links < 0 || f.rechts > breite) {
      maengel.push(`${name}: ragt aus der Breite ${breite} (${f.links}..${f.rechts})`);
    }
  }
  if (k.ueberlauf > 0) {
    maengel.push(`kachel: ${k.ueberlauf} px abgeschnitten`);
  }
  return maengel;
}

// ------------------------------------------------------------------------------------------------
// TASTATUR
// ------------------------------------------------------------------------------------------------

/** Per Tab zu genau diesem Element; der Fokus muss sichtbar sein. Gibt die Anschläge zurück. */
async function tabZu(seite: Seite, selektor: string, was: string): Promise<number> {
  const schritte = await tabBisZu(seite, selektor, 400, true);
  const mangel = await seite.evaluate<string>(fn(FOKUS_SICHTBAR));
  expect(
    mangel,
    `${MARKE}: „${was}" per Tastatur erreicht, aber der Fokus ist nicht sichtbar`,
  ).toBe("");
  return schritte;
}

/**
 * Eine Auswahl per Tastatur: Tab hin, dann die ersten Buchstaben der Option tippen (die
 * Typ-Voraus-Suche jedes `<select>`). Der Wert wird NACHGEMESSEN — landet er woanders, ist die
 * Bedienung gescheitert, und das steht dann mit beiden Werten da.
 *
 * STEHT DIE AUSWAHL SCHON AUF DEM SOLL (die Richtung beginnt auf „gerichtet",
 * `WissensbeziehungenBereich.tsx`), wäre das Tippen ein Leerlauf und bewiese nichts. Dann geht
 * die Tastatur erst über `umweg` auf eine andere Option — nachgemessen — und danach zurück.
 * Dazwischen liegt die Pause, nach der der Browser die Typ-Voraus-Suche neu beginnt.
 */
async function waehleMitTastatur(
  seite: Seite,
  selektor: string,
  auswahl: { buchstaben: string; soll: string; umweg: { buchstaben: string; soll: string } },
  was: string,
): Promise<number> {
  const wert = (): Promise<string> =>
    seite.evaluate<string>(
      fn("(sel) => { const e = document.querySelector(sel); return e ? e.value : '(fehlt)'; }"),
      selektor,
    );
  const schritte = await tabZu(seite, selektor, was);
  if ((await wert()) === auswahl.soll) {
    await seite.keyboard.type(auswahl.umweg.buchstaben);
    expect(await wert(), `${MARKE}: ${was} — Umweg per Tastatur`).toBe(auswahl.umweg.soll);
    await new Promise((weiter) => setTimeout(weiter, 1_500));
  }
  await seite.keyboard.type(auswahl.buchstaben);
  expect(await wert(), `${MARKE}: ${was} per Tastatur („${auswahl.buchstaben}") gewählt`).toBe(
    auswahl.soll,
  );
  return schritte;
}

/** Die Tastaturauswahl einer Option: die ersten drei Buchstaben ihres angezeigten Textes. */
const option = (schluessel: string, wert: string): { buchstaben: string; soll: string } => ({
  buchstaben: t(schluessel).slice(0, 3),
  soll: wert,
});

// ------------------------------------------------------------------------------------------------
// DER AUFBAU — über die echten Routen
// ------------------------------------------------------------------------------------------------

export interface Aufbau {
  strecke: Strecke;
  admin: Sitzung;
  controller: Sitzung;
  controllerId: string;
  ids: Record<Kurz, string>;
  /** Die vorab gesetzte Beziehung anker → geheim. */
  verborgenId: string;
  /** Jeder 5xx des Servers, mit Adresse und — wenn geworfen — Fehler. */
  serverfehler: string[];
}

/** Liest die Fassung eines Eintrags — `gesehen` verlangt sie (`kanten-service.ts`, STAND_VERALTET). */
async function fassung(s: Sitzung, id: string): Promise<number> {
  const a = await s.sende("GET", `/api/kos/${id}`);
  expect(a.status, `GET /api/kos/${id}: ${a.text.slice(0, 200)}`).toBe(200);
  return (a.json as { version: number }).version;
}

export async function baueAuf(pool?: Pool): Promise<Aufbau> {
  const serverfehler: string[] = [];
  const strecke = await starteStrecke({
    ...(pool ? { pool } : {}),
    vorListen: async (app: FastifyInstance) => {
      await registerWebStatic(app, DIST);
      // DIE 500ER WERDEN MITGESCHRIEBEN. `onError` sieht, was eine Route WIRFT; `onResponse` sieht
      // jeden 5xx, auch den, den `sendError` ohne Logzeile maskiert (`http.ts`, Auffangzweig).
      app.addHook("onError", async (anfrage, _antwort, fehler) => {
        serverfehler.push(
          `WURF ${anfrage.method} ${anfrage.url}: ${String(fehler?.stack ?? fehler).slice(0, 800)}`,
        );
      });
      app.addHook("onResponse", async (anfrage, antwort) => {
        if (antwort.statusCode >= 500) {
          serverfehler.push(`${antwort.statusCode} ${anfrage.method} ${anfrage.url}`);
        }
      });
    },
  });

  const admin = strecke.profil("admin");
  const setup = await admin.sende("POST", "/api/auth/setup", {
    name: ADMIN.name,
    email: ADMIN.email,
    password: PASSWORT,
  });
  expect(setup.status, setup.text).toBe(201);

  const angelegt = await admin.sende("POST", "/api/users", {
    name: CONTROLLER.name,
    email: CONTROLLER.email,
    password: PASSWORT,
    role: "controller",
  });
  expect(angelegt.status, angelegt.text).toBe(201);
  const controllerId = (angelegt.json as { id: string }).id;
  const controller = strecke.profil("controller");
  const login = await controller.sende("POST", "/api/auth/login", {
    email: CONTROLLER.email,
    password: PASSWORT,
  });
  expect(login.status, login.text).toBe(200);

  const ids = {} as Record<Kurz, string>;
  for (const [kurz, e] of Object.entries(EINTRAEGE) as [Kurz, (typeof EINTRAEGE)[Kurz]][]) {
    const a = await admin.sende("POST", "/api/kos", {
      title: e.titel,
      statement: `Belegsatz zu ${e.titel}.`,
      type: "best_practice",
      category: "Betrieb",
      confidentiality: e.stufe,
      tags: ["rechtestrecke"],
    });
    expect(a.status, `${kurz}: ${a.text.slice(0, 300)}`).toBe(201);
    ids[kurz] = (a.json as { id: string }).id;
  }

  const verborgen = await admin.sende("POST", `/api/kos/${ids.anker}/beziehungen`, {
    zielId: ids.geheim,
    art: VERBORGEN.art,
    richtung: VERBORGEN.richtung,
    beitragSchluessel: `wbr-verborgen-${Date.now()}`,
    gesehen: {
      quelleVersion: await fassung(admin, ids.anker),
      zielVersion: await fassung(admin, ids.geheim),
    },
  });
  expect(verborgen.status, verborgen.text.slice(0, 300)).toBe(201);
  const verborgenId = (verborgen.json as { id: string }).id;

  return { strecke, admin, controller, controllerId, ids, verborgenId, serverfehler };
}

// ------------------------------------------------------------------------------------------------
// DAS PROTOKOLL
// ------------------------------------------------------------------------------------------------

export interface Protokoll {
  ablage: string;
  tastatur: Record<string, number>;
  gesetztId: string;
  /** Kacheln an `anker`: nach dem Setzen, nach Reload, nach Widerruf+Reload (Admin). */
  kachelnAnker: number[];
  satzReload: string;
  satzGegenseite: string;
  seitenUeberlauf: number[];
  widerrufStatus: string;
  pgStatus: string[];
  /** Controllerin an `anker`: vor dem Entzug → nach dem Entzug (Fläche) und API. */
  controllerFlaeche: number[];
  controllerApi: number[];
  controllerGeheimDetail: number;
  adminNachEntzug: string[];
  verfahren: string;
}

export function protokollzeile(p: Protokoll): string {
  return [
    `${MARKE} PROTOKOLL:`,
    `Ablage=${p.ablage}`,
    `Tastatur=${JSON.stringify(p.tastatur)}`,
    `Kante=${p.gesetztId}`,
    `Kacheln-anker=${p.kachelnAnker.join("→")}`,
    `Satz-nach-Reload="${p.satzReload}"`,
    `Satz-Gegenseite="${p.satzGegenseite}"`,
    `Seitenueberlauf=${p.seitenUeberlauf.join("/")}`,
    `Widerruf-Antwort="${p.widerrufStatus}"`,
    `PG-Status=${p.pgStatus.join("→") || "(keine Tabelle: Speicherablage)"}`,
    `Controllerin-Flaeche=${p.controllerFlaeche.join("→")}`,
    `Controllerin-API=${p.controllerApi.join("→")}`,
    `Controllerin-GET-geheim=${p.controllerGeheimDetail}`,
    `Admin-nach-Entzug=${p.adminNachEntzug.join(" | ")}`,
    `Sichtverfahren=${p.verfahren}`,
  ].join(" ");
}

// ------------------------------------------------------------------------------------------------
// DIE STRECKE
// ------------------------------------------------------------------------------------------------

export interface Lauf {
  browser: Browser;
  aufbau: Aufbau;
  pool?: Pool;
}

async function pgStatus(pool: Pool | undefined, id: string): Promise<string | null> {
  if (!pool) {
    return null;
  }
  const r = await pool.query<{ status: string }>("SELECT status FROM ko_kanten WHERE id = $1", [
    id,
  ]);
  return r.rows[0]?.status ?? "(keine Zeile)";
}

export async function oeffneEintrag(
  seite: Seite,
  basis: string,
  id: string,
  was: string,
): Promise<BereichZustand> {
  const r = await ladeBereich(seite, id, was, () =>
    seite.goto(`${basis}/wissen/${id}`, { waitUntil: "domcontentloaded" }),
  );
  return r.zustand;
}

async function neuLaden(seite: Seite, id: string, was: string): Promise<BereichZustand> {
  const r = await ladeBereich(seite, id, `${was} (neu geladen)`, () =>
    seite.reload({ waitUntil: "domcontentloaded" }),
  );
  return r.zustand;
}

interface BeziehungsAntwort {
  kanten: {
    id: string;
    art: string;
    richtung: string;
    rolle?: string;
    status: string;
    herkunft: string;
    gegenstueck: { id: string; title: string };
  }[];
  total: number;
}

async function beziehungenAmServer(s: Sitzung, id: string): Promise<BeziehungsAntwort> {
  const a = await s.sende("GET", `/api/kos/${id}/beziehungen`);
  expect(a.status, `GET /api/kos/${id}/beziehungen (${s.name}): ${a.text.slice(0, 200)}`).toBe(200);
  return a.json as BeziehungsAntwort;
}

/** Hängt vor dem Aufbau der Seite ein Stilblatt an — nur für die Kalibrierung. */
export async function mitStil(kontext: Kontext, stil: string): Promise<void> {
  await kontext.addInitScript(
    `document.addEventListener("DOMContentLoaded", function () {
       var s = document.createElement("style");
       s.appendChild(document.createTextNode(${JSON.stringify(stil)}));
       document.head.appendChild(s);
     });`,
  );
}

/**
 * Fährt (1)–(4). Wirft bei jeder Abweichung mit einer Meldung, die den Befund benennt.
 */
export async function fahreStrecke(lauf: Lauf): Promise<Protokoll> {
  const { browser, aufbau, pool } = lauf;
  const basis = aufbau.strecke.basis;
  const { ids } = aufbau;
  await i18n.changeLanguage("de");
  const p: Protokoll = {
    ablage: pool ? "PostgreSQL" : "Speicher",
    tastatur: {},
    gesetztId: "",
    kachelnAnker: [],
    satzReload: "",
    satzGegenseite: "",
    seitenUeberlauf: [],
    widerrufStatus: "",
    pgStatus: [],
    controllerFlaeche: [],
    controllerApi: [],
    controllerGeheimDetail: 0,
    adminNachEntzug: [],
    verfahren: "",
  };
  const profile: Kontext[] = [];
  try {
    // ============================================================================================
    // (1) ANLEGEN NUR MIT DER TASTATUR — 360 px
    // ============================================================================================
    const a = await profil(browser, SCHMAL_360);
    profile.push(a.kontext);
    const seite = a.seite;
    const anmeldung = await meldeAnMitTastatur(seite, basis, ADMIN.email, PASSWORT);
    p.tastatur.anmeldung = anmeldung.email + anmeldung.passwort;
    await oeffneEintrag(seite, basis, ids.anker, "anker");
    const vorher = await liesBereich(seite);
    expect(vorher.ids, "vor dem Setzen hängt an anker genau die vorab gesetzte Beziehung").toEqual([
      aufbau.verborgenId,
    ]);

    p.tastatur.suche = await tabZu(seite, "#wb-suche", "Suchfeld „Ziel suchen“");
    await seite.keyboard.type(SUCHWORT);
    await warte(
      seite,
      `() => document.querySelectorAll('[data-testid="wb-treffer"]').length === 1`,
      `genau ein Treffer zu „${SUCHWORT}“`,
      undefined,
      45_000,
    );
    p.tastatur.treffer = await tabZu(seite, '[data-testid="wb-treffer"]', "Treffer");
    await seite.keyboard.press("Enter");
    await warte(
      seite,
      `(t) => { const z = document.querySelector('[data-testid="wb-ziel"]'); return !!z && z.innerText.includes(t); }`,
      "das gewählte Ziel steht",
      EINTRAEGE.ziel.titel,
    );
    p.tastatur.art = await waehleMitTastatur(
      seite,
      "#wb-art",
      {
        ...option(`wb.art.${GESETZT.art}`, GESETZT.art),
        umweg: option("wb.art.widerspricht", "widerspricht"),
      },
      "die Art",
    );
    p.tastatur.richtung = await waehleMitTastatur(
      seite,
      "#wb-richtung",
      {
        ...option(`wb.richtung.${GESETZT.richtung}`, GESETZT.richtung),
        umweg: option("wb.richtung.symmetrisch", "symmetrisch"),
      },
      "die Richtung",
    );
    p.tastatur.knopf = await tabZu(seite, '[data-testid="wb-setzen-knopf"]', "Setzen-Knopf");
    await seite.keyboard.press("Enter");
    await warte(
      seite,
      `() => !!document.querySelector('[data-testid="wb-setzen-erfolg"]') || !!document.querySelector('[data-testid="wb-schreibfehler"]')`,
      "der Server hat das Setzen beantwortet",
      undefined,
      45_000,
    );
    const erfolg = await liesEinzeln(seite, '[data-testid="wb-setzen-erfolg"]');
    expect(
      erfolg.sichtbar,
      `${MARKE}: keine sichtbare Erfolgsmeldung — ${erfolg.grund}; Schreibfehler: ${(await liesEinzeln(seite, '[data-testid="wb-schreibfehler"]')).text}`,
    ).toBe(true);
    expect(erfolg.text).toBe(t("wb.setzen.erfolg"));

    // UNABHÄNGIG AM SERVER: gibt es die Beziehung wirklich, so wie sie gewählt wurde?
    const amServer = await beziehungenAmServer(aufbau.admin, ids.anker);
    const neu = amServer.kanten.find((k) => k.gegenstueck.id === ids.ziel);
    expect(neu, `${MARKE}: der Server kennt keine Beziehung anker → ziel`).toBeDefined();
    const gesetzt = neu as BeziehungsAntwort["kanten"][number];
    expect(
      [gesetzt.art, gesetzt.richtung, gesetzt.rolle, gesetzt.status, gesetzt.herkunft],
      "die gespeicherte Beziehung ist nicht die per Tastatur gewählte",
    ).toEqual([GESETZT.art, GESETZT.richtung, "quelle", "aktiv", "kuratiert"]);
    p.gesetztId = gesetzt.id;
    const pg1 = await pgStatus(pool, gesetzt.id);
    if (pg1 !== null) {
      p.pgStatus.push(pg1);
      expect(pg1, "PostgreSQL nach dem Setzen").toBe("aktiv");
    }

    // ============================================================================================
    // (2) NEU LADEN — dieselbe Kachel, sichtbar, schmal, nichts abgeschnitten
    // ============================================================================================
    await warte(
      seite,
      `(id) => !!document.querySelector('[data-kante-id="' + id + '"]')`,
      "die neue Kachel steht ohne Neuladen",
      gesetzt.id,
    );
    p.kachelnAnker.push((await liesBereich(seite)).ids.length);
    expect(await neuLaden(seite, ids.anker, "anker")).toBe("liste");
    const nachReload = await liesBereich(seite);
    p.kachelnAnker.push(nachReload.ids.length);
    p.seitenUeberlauf.push(nachReload.seitenUeberlauf);
    expect(nachReload.ids.length, "Kacheln nach dem Neuladen = total am Server").toBe(
      amServer.total,
    );
    const kachel = nachReload.kacheln.find((k) => k.id === gesetzt.id);
    expect(kachel, `${MARKE}: nach dem Neuladen fehlt die Kachel ${gesetzt.id}`).toBeDefined();
    const k1 = kachel as Kachel;
    p.verfahren = k1.satz.verfahren;
    expect(kachelMaengel(k1, nachReload.breite), "Pflichtfelder der Kachel bei 360 px").toEqual([]);
    expect(
      nachReload.seitenUeberlauf,
      "die Seite scrollt bei 360 px waagrecht",
    ).toBeLessThanOrEqual(0);
    const sollSatz = t(`wb.satz.${GESETZT.art}.quelle`, { title: EINTRAEGE.ziel.titel });
    p.satzReload = k1.satz.text;
    expect(k1.satz.text, "Richtungssatz an der Quelle").toBe(sollSatz);
    expect(k1.herkunft.text, "Herkunft").toBe(t("wb.herkunft.gesetzt").toUpperCase());
    expect(k1.status.text, "Status").toBe(sollWort("de", "aktiv"));
    expect(k1.statusWert, "Status am Attribut").toBe("aktiv");

    // Per Tastatur über „Beitrag öffnen" zur Gegenseite.
    p.tastatur.oeffnen = await tabZu(
      seite,
      `[data-kante-id="${gesetzt.id}"] a[href]`,
      "Beitrag öffnen",
    );
    await ladeBereich(seite, ids.ziel, "der Gegenseite", () => seite.keyboard.press("Enter"));
    expect(new URL(seite.url()).pathname, "die Gegenseite ist geöffnet").toBe(
      `/wissen/${ids.ziel}`,
    );
    const gegenseite = await liesBereich(seite);
    const kg = gegenseite.kacheln.find((k) => k.id === gesetzt.id);
    expect(kg, `${MARKE}: an der Gegenseite fehlt die Kachel ${gesetzt.id}`).toBeDefined();
    p.satzGegenseite = (kg as Kachel).satz.text;
    p.seitenUeberlauf.push(gegenseite.seitenUeberlauf);
    expect(kachelMaengel(kg as Kachel, gegenseite.breite), "Kachel an der Gegenseite").toEqual([]);
    expect((kg as Kachel).satz.text, "Richtungssatz am Ziel").toBe(
      t(`wb.satz.${GESETZT.art}.ziel`, { title: EINTRAEGE.anker.titel }),
    );

    // ============================================================================================
    // (3) ÄNDERN = WIDERRUFEN — nur mit der Tastatur
    // ============================================================================================
    p.tastatur.widerruf = await tabZu(
      seite,
      `[data-kante-id="${gesetzt.id}"] [data-testid="wb-widerruf"]`,
      "Widerrufen",
    );
    await seite.keyboard.press("Enter");
    await warte(
      seite,
      `() => !!document.querySelector('[data-testid="wb-widerruf-frage"]')`,
      "Rückfrage",
    );
    p.tastatur.widerrufJa = await tabZu(seite, '[data-testid="wb-widerruf-ja"]', "Ja, widerrufen");
    await seite.keyboard.press("Enter");
    await warte(
      seite,
      `() => !!document.querySelector('[data-testid="wb-widerruf-antwort"]') || !!document.querySelector('[data-testid="wb-widerruf-fehler"]')`,
      "der Server hat den Widerruf beantwortet",
      undefined,
      45_000,
    );
    const antwortStatus = await liesEinzeln(seite, '[data-testid="wb-antwort-status"]');
    p.widerrufStatus = antwortStatus.text;
    expect(antwortStatus.sichtbar, `Antwortstatus sichtbar — ${antwortStatus.grund}`).toBe(true);
    expect(antwortStatus.text).toBe(sollWort("de", "widerrufen"));
    const widerrufErfolg = await liesEinzeln(seite, '[data-testid="wb-widerruf-erfolg"]');
    expect(widerrufErfolg.sichtbar, `Widerrufsmeldung sichtbar — ${widerrufErfolg.grund}`).toBe(
      true,
    );
    const nachWiderruf = await beziehungenAmServer(aufbau.admin, ids.anker);
    expect(
      nachWiderruf.kanten.map((k) => k.id),
      "der Server liefert die widerrufene Beziehung weiter aus",
    ).not.toContain(gesetzt.id);
    const pg2 = await pgStatus(pool, gesetzt.id);
    if (pg2 !== null) {
      p.pgStatus.push(pg2);
      expect(pg2, "PostgreSQL nach dem Widerruf").toBe("widerrufen");
    }
    await oeffneEintrag(seite, basis, ids.anker, "anker nach dem Widerruf");
    await neuLaden(seite, ids.anker, "anker nach dem Widerruf");
    const nachWiderrufFlaeche = await liesBereich(seite);
    p.kachelnAnker.push(nachWiderrufFlaeche.ids.length);
    expect(nachWiderrufFlaeche.ids, "nach Widerruf und Neuladen").toEqual(
      nachWiderruf.kanten.map((k) => k.id),
    );

    // ============================================================================================
    // (4) RECHTEENTZUG AN EINER OFFENEN SITZUNG
    // ============================================================================================
    const c = await profil(browser, SCHMAL_360);
    profile.push(c.kontext);
    const cs = c.seite;
    await meldeAnMitTastatur(cs, basis, CONTROLLER.email, PASSWORT);
    expect(await oeffneEintrag(cs, basis, ids.anker, "anker (Controllerin)")).toBe("liste");
    const cVorher = await liesBereich(cs);
    const apiVorher = await beziehungenAmServer(aufbau.controller, ids.anker);
    p.controllerFlaeche.push(cVorher.ids.length);
    p.controllerApi.push(apiVorher.total);
    expect(cVorher.ids, "die Controllerin sieht die Beziehung zum vertraulichen Eintrag").toContain(
      aufbau.verborgenId,
    );
    const cKachel = cVorher.kacheln.find((k) => k.id === aufbau.verborgenId) as Kachel;
    expect(
      kachelMaengel(cKachel, cVorher.breite),
      "Kachel der Controllerin vor dem Entzug",
    ).toEqual([]);
    expect(cVorher.seitentext).toContain(EINTRAEGE.geheim.titel);

    const entzug = await aufbau.admin.sende("PUT", `/api/users/${aufbau.controllerId}`, {
      role: "experte",
    });
    expect(entzug.status, entzug.text.slice(0, 200)).toBe(200);
    expect((entzug.json as { role: string }).role).toBe("experte");

    // API — mit DERSELBEN, weiter gültigen Sitzung.
    const apiNachher = await beziehungenAmServer(aufbau.controller, ids.anker);
    p.controllerApi.push(apiNachher.total);
    const apiText = JSON.stringify(apiNachher);
    expect(apiText, "die API gibt die Beziehung nach dem Entzug weiter aus").not.toContain(
      aufbau.verborgenId,
    );
    expect(apiText, "die API nennt den vertraulichen Titel nach dem Entzug").not.toContain(
      EINTRAEGE.geheim.titel,
    );
    const detail = await aufbau.controller.sende("GET", `/api/kos/${ids.geheim}`);
    p.controllerGeheimDetail = detail.status;
    expect(detail.status, "GET des vertraulichen Eintrags nach dem Entzug").toBe(404);
    expect(detail.text).not.toContain(EINTRAEGE.geheim.titel);
    const vonGeheim = await aufbau.controller.sende("GET", `/api/kos/${ids.geheim}/beziehungen`);
    expect(vonGeheim.text, "Beziehungen des vertraulichen Eintrags nach dem Entzug").not.toContain(
      EINTRAEGE.anker.titel,
    );
    // Vertrag, nicht Zufall: ein unerreichbarer Eintrag hat für diesen Menschen KEINE Beziehungen —
    // leer statt Fehler, weil ein Fehler selbst die Existenzauskunft wäre
    // (`kanten-service.ts`, `kantenFuer`, JOB 4151 BEN R2).
    expect(
      [vonGeheim.status, vonGeheim.json],
      "Beziehungen am vertraulichen Eintrag nach dem Entzug",
    ).toEqual([200, { koId: ids.geheim, kanten: [], total: 0 }]);

    // FLÄCHE — dieselbe offene Browsersitzung, nur neu geladen. `neuLaden` wartet die Antwort auf
    // die Beziehungsliste ab und verlangt einen ERFOLGREICHEN Endzustand; hier muss es der leere
    // sein (die einzige verbliebene Beziehung ist die verborgene). Ein Lesefehler (`wb-fehler`)
    // sähe ebenfalls „ohne Kachel" aus — er wirft in `ladeBereich` und zählt hier nie als Entzug.
    const cZustand = await neuLaden(cs, ids.anker, "anker (Controllerin nach dem Entzug)");
    const cNachher = await liesBereich(cs);
    p.controllerFlaeche.push(cNachher.ids.length);
    expect(
      {
        zustand: cZustand,
        leer: cNachher.leer,
        fehler: cNachher.fehler,
        apiTotal: apiNachher.total,
      },
      "nach dem Entzug: erfolgreich geladener LEERER Bestand, kein Lesefehler",
    ).toEqual({ zustand: "leer", leer: true, fehler: "", apiTotal: 0 });
    expect(cNachher.ids, "die Fläche zeigt die Beziehung nach dem Entzug").not.toContain(
      aufbau.verborgenId,
    );
    expect(cNachher.ids.length, "Kacheln der Controllerin = total ihrer API").toBe(
      apiNachher.total,
    );
    expect(
      cNachher.seitentext,
      "der vertrauliche Titel steht nach dem Entzug auf der Seite",
    ).not.toContain(EINTRAEGE.geheim.titel);
    // Die Detailseite: erst die ANTWORT des Servers, dann der Fehlerzweig der Lesefläche — erst
    // danach zählt ihr Text (`oeffneUnlesbar`, Befund B2).
    const unlesbar = await oeffneUnlesbar(cs, basis, ids.geheim);
    expect(unlesbar.status, "Browser-Anfrage GET /api/kos/<geheim> nach dem Entzug").toBe(404);
    expect(unlesbar.rumpf, "Antwortrumpf der Browser-Anfrage").not.toContain(
      EINTRAEGE.geheim.titel,
    );
    const geheimSeite = await cs.evaluate<string>(fn("() => document.body.innerText"));
    expect(geheimSeite, "Titel des vertraulichen Eintrags auf seiner Seite").not.toContain(
      EINTRAEGE.geheim.titel,
    );
    expect(geheimSeite, "Inhalt des vertraulichen Eintrags auf seiner Seite").not.toContain(
      `Belegsatz zu ${EINTRAEGE.geheim.titel}`,
    );

    // DER BERECHTIGTE: Status, Herkunft, Richtung von beiden Seiten weiter richtig.
    for (const [kurz, rolle, gegen] of [
      ["anker", "quelle", "geheim"],
      ["geheim", "ziel", "anker"],
    ] as const) {
      await oeffneEintrag(seite, basis, ids[kurz], `${kurz} (Admin nach dem Entzug)`);
      const b = await liesBereich(seite);
      const k = b.kacheln.find((x) => x.id === aufbau.verborgenId);
      expect(k, `${MARKE}: der Admin sieht die Beziehung an ${kurz} nicht mehr`).toBeDefined();
      const kk = k as Kachel;
      expect(kachelMaengel(kk, b.breite), `Kachel des Admins an ${kurz}`).toEqual([]);
      expect(kk.satz.text, `Richtungssatz an ${kurz}`).toBe(
        t(`wb.satz.${VERBORGEN.art}.${rolle}`, { title: EINTRAEGE[gegen].titel }),
      );
      expect(kk.herkunft.text, `Herkunft an ${kurz}`).toBe(t("wb.herkunft.gesetzt").toUpperCase());
      expect(kk.status.text, `Status an ${kurz}`).toBe(sollWort("de", "aktiv"));
      p.adminNachEntzug.push(`${kurz}: ${kk.satz.text} · ${kk.herkunft.text} · ${kk.status.text}`);
    }
    const pg3 = await pgStatus(pool, aufbau.verborgenId);
    if (pg3 !== null) {
      p.pgStatus.push(pg3);
      expect(pg3, "der Entzug hat an der gespeicherten Beziehung nichts geändert").toBe("aktiv");
    }

    return p;
  } finally {
    for (const k of profile) {
      await k.close().catch(() => undefined);
    }
  }
}
