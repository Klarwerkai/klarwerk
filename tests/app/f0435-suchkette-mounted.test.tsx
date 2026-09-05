// @vitest-environment jsdom
// ==================================================================================================
// F-0435 · JOB 2961 · D2 — DIE SICHTBARE KETTE: GESPEICHERTE FUSSNOTE BIS FUNDSTELLENKENNZEICHNUNG
// ==================================================================================================
//
// Auftragstext ist BENs rotes Urteil `BEN-PRUEFUNG-JOB-2961-D1.md` (BEZUGSHASH `a8f1e283…`),
// Korrekturpflicht 2 woertlich:
//
//   „Die sichtbare Nutzenkette mit einem Test von gespeicherter formatierter Bildbeschreibung bis
//    Suchtreffer und UI-Kennzeichnung belegen."
//
// D1 hat den Serverfix mit reinen Funktionen belegt. BENs Einwand traf: „Serverextraktion und
// Suchfeld sind beschrieben, aber Wiretyp, Clientabruf, Renderer und konkreter UI-Test fehlen."
// Diese Datei faehrt die Kette in EINEM Lauf und misst an jeder Station:
//
//   PERSISTENZ  ein Wissensobjekt wird ueber die echte Route `POST /api/kos` angelegt; seine
//               Bildbeschreibung traegt Blockabsaetze: <p>Ventil V2</p><p>gerissen</p>
//   SERVICE     der KoService leitet daraus das Suchfeld `captionTexts` ab (captions.ts)
//   WIRETYP     `GET /api/library/search` liefert dieses Feld — nachgesehen im rohen Antwortkoerper
//   CLIENTABRUF die Bibliotheksseite laedt ueber denselben Endpunkt (fetch liegt auf app.inject)
//   RENDERER    `Library.tsx` bewertet mit `searchLibrary` und zeigt den Treffer
//   KENNZEICHNUNG die Fundstelle steht sichtbar als „Treffer in · Bildbeschreibung" auf der Karte
//
// WAS ECHT IST: die Fastify-Anwendung mit allen Routen, Rechten und der echten Persistenz; die
// echte Ableitung des Suchfelds; die echte Bibliotheksseite mit ihren echten Providern; die echte
// Sucheingabe, bedient ueber Nutzerereignisse. Der EINZIGE Ersatz ist der Transport: `globalThis.fetch`
// liegt auf `app.inject` — die Bauform stammt woertlich aus
// `tests/capture/job2656-d4-einreichen-knopf-mounted.test.tsx` (dort ausfuehrlich begruendet) und
// ist in der Bahn-Sandbox zwingend, weil kein Horchsocket erlaubt ist (`listen EPERM`).
//
// DER GEGENSTAND, an dem alles haengt: „V2 gerissen" ist genau die Anfrage ueber die Blockgrenze.
// Vor D1 stand im Suchfeld „Ventil V2gerissen" — verklebt, und die Anfrage traf nichts.
import { afterEach, beforeEach, describe, expect, it } from "vitest";

process.env.KLARWERK_SKIP_KEYCHAIN = "1";

interface AnyRes {
  statusCode: number;
  body: string;
}

interface App {
  inject: (o: Record<string, unknown>) => Promise<AnyRes>;
}

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter, Route, Routes } from "../../apps/web/node_modules/react-router-dom";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
// Die Entprellung der Bibliothekssuche ist PRODUKTVERHALTEN. Dieser Test liest ihre Dauer aus dem
// Produktmodul, statt eine Zahl abzuschreiben — wird sie dort geaendert, wartet dieser Test
// automatisch mit. Dieselbe Bindung benutzt `tests/app/job2689-prozentzeichen-bibliothek-mounted.test.tsx:132`.
import { LIBRARY_SEARCH_DEBOUNCE_MS } from "../../apps/web/src/lib/useDebouncedValue";
import { Library } from "../../apps/web/src/pages/Library";
import { buildApp, buildServices } from "../../services/app/src/build-app";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};
(globalThis as unknown as { scrollTo: () => void }).scrollTo = () => {};

const TITEL = "Dosierpumpe DP-4 nach Schichtwechsel";
const ANFRAGE = "V2 gerissen";

/** Die Bildbeschreibung, um die es geht — mit BLOCKABSAETZEN, nicht nur Auszeichnung. */
const FUSSNOTE = "<p>Ventil V2</p><p>gerissen</p>";
const ERWARTETER_SUCHTEXT = "Ventil V2 gerissen";

function koBody(): string {
  return [
    "<p>Nach dem Schichtwechsel schwankt der Dosierwert.</p>",
    '<figure><img src="/api/objects/x/raw" data-image-id="kw-img-1">',
    `<figcaption data-image-id="kw-img-1">${FUSSNOTE}</figcaption></figure>`,
  ].join("");
}

let app: App;
let token = "";
let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

/**
 * Ein Abruf, wie die Bruecke ihn gesehen hat. `status === null` heisst: die Antwort steht noch aus.
 * Genau dieser Zustand ist der Grund fuer diese Aufzeichnung — er ist die einzige Lage, in der
 * KEINE Zusicherung greifen darf (REGELN §7: laden ist kein Urteil).
 */
interface Abruf {
  methode: string;
  url: string;
  status: number | null;
  /** Der Kopf ist nicht das Ergebnis: `text()` laeuft NACH dem Statuscode und kann eigen dauern. */
  koerper: "offen" | "wird gelesen" | "gelesen";
}

let abrufe: Abruf[] = [];

const SUCHPFAD = "/api/library/search";

/**
 * @param verzoegerungMs Kuenstliche Verzoegerung, bis der KOPF der Antwort steht (Statuscode).
 * @param koerperVerzoegerungMs Kuenstliche Verzoegerung, bis der KOERPER gelesen ist (`text()`).
 *
 * Beide sitzen IM Test, nicht im Produkt — und sie sind bewusst getrennt: ein Statuscode ist noch
 * kein Ergebnis. `fetch` loest die Antwort auf, ehe der Koerper gelesen ist; wer nur den Kopf
 * beobachtet, haelt eine Seite fuer fertig, die noch nichts hat (JOB 3078 R1, Befund BEN-1).
 */
function bruecke(verzoegerungMs = 0, koerperVerzoegerungMs = 0): void {
  (globalThis as unknown as { fetch: unknown }).fetch = async (
    input: unknown,
    init: { method?: string; body?: string; headers?: HeadersInit } = {},
  ) => {
    const url = String(input);
    const abruf: Abruf = { methode: init.method ?? "GET", url, status: null, koerper: "offen" };
    abrufe.push(abruf);
    if (verzoegerungMs > 0) {
      await new Promise((r) => setTimeout(r, verzoegerungMs));
    }
    const headers: Record<string, string> = {};
    new Headers(init.headers).forEach((value, key) => {
      headers[key] = value;
    });
    if (token) {
      headers.authorization = `Bearer ${token}`;
    }
    const res = await app.inject({
      method: init.method ?? "GET",
      url,
      headers,
      ...(init.body !== undefined ? { payload: init.body } : {}),
    });
    abruf.status = res.statusCode;
    return {
      ok: res.statusCode < 400,
      status: res.statusCode,
      statusText: "",
      text: async () => {
        abruf.koerper = "wird gelesen";
        if (koerperVerzoegerungMs > 0) {
          await new Promise((r) => setTimeout(r, koerperVerzoegerungMs));
        }
        abruf.koerper = "gelesen";
        return res.body;
      },
    };
  };
}

async function serverStarten(): Promise<void> {
  app = buildApp(buildServices()) as unknown as App;
  token = "";
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Pedi", email: "pedi@job2961.test", password: "geheim12345" },
  });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "pedi@job2961.test", password: "geheim12345" },
  });
  token = (JSON.parse(login.body) as { token: string }).token;
}

/** STATION 1 — PERSISTENZ: ueber die echte Route angelegt, nicht im Speicher zusammengesetzt. */
async function objektAnlegen(): Promise<string> {
  const res = await app.inject({
    method: "POST",
    url: "/api/kos",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    payload: {
      title: TITEL,
      statement: "Vor dem ersten Auftrag den Nullpunkt pruefen.",
      category: "Qualitaet",
      type: "best_practice",
      bodyHtml: koBody(),
    },
  });
  expect(res.statusCode, `Objekt nicht angelegt: ${res.body.slice(0, 300)}`).toBe(201);
  return (JSON.parse(res.body) as { id: string }).id;
}

/** STATION 3 — WIRETYP: was die Suchroute wirklich ausliefert. */
async function suchAntwort(q: string): Promise<{ title: string; captionTexts?: string[] }[]> {
  const res = await app.inject({
    method: "GET",
    url: `/api/library/search?q=${encodeURIComponent(q)}`,
    headers: { authorization: `Bearer ${token}` },
  });
  expect(res.statusCode, `Suche fehlgeschlagen: ${res.body.slice(0, 300)}`).toBe(200);
  return JSON.parse(res.body) as { title: string; captionTexts?: string[] }[];
}

// ==================================================================================================
// DAS WARTEN — AN EREIGNISSEN, NICHT AN GERATENEN TAKTEN (JOB 3078 · W1)
// ==================================================================================================
//
// DER BEFUND: Bis zu diesem Auftrag wartete diese Datei ausschliesslich ueber eine feste Zahl von
// Takten (`for (let i = 0; i < 40; i++) await new Promise(r => setTimeout(r, 0))`). Die Bibliothek
// entprellt die Sucheingabe aber um `LIBRARY_SEARCH_DEBOUNCE_MS` = 300 ms
// (`apps/web/src/components/bibliothek/BibliothekFlaeche.tsx:257`). Vierzig Nulltakte sind weder
// 0 ms noch 300 ms — wie viel echte Zeit dabei vergeht, haengt allein an der Auslastung des
// Rechners. Im Tor laufen alle Dateien nebenher; mal reichte es, mal nicht. Gezaehlt in
// `protokoll.jsonl`: VIER Tor-Wiederholungen am 04./05.09.2026 (JOB 3052 R7, JOB 3056 R3 und R9,
// JOB 3057 R1) mit dieser Datei als einziger Ursache — bei Jobs, die sie nicht angefasst haben.
// Das empfangene Bild war jedes Mal dasselbe: die Seite stand noch im LADEZUSTAND.
//
// DIE ABLOESUNG: Gewartet wird auf den BEOBACHTETEN Zustand (der Abruf ist durch die Bruecke
// gelaufen und beantwortet; die Liste ist gezeichnet und ruht) — mit hartem Deckel. Dieselbe
// Bauform hat Codex am 05.09. abgenommen; das Vorbild steht in
// `tests/app/job2689-prozentzeichen-bibliothek-mounted.test.tsx:208-226`.
//
// DIE ZAEHNE BLEIBEN: Kommt gar nichts, laeuft die Schleife aus und der Fall faellt — aber mit
// einer Meldung, die die Station, die beobachteten Abrufe samt Statuscode und den zuletzt
// sichtbaren Seitentext nennt. Antwortet der Server erfolgreich mit null Treffern, faellt der Fall
// SOFORT nach der Antwort an seiner Zusicherung, nicht erst am Deckel: „leer" wird nie zu „noch
// nicht fertig" umgedeutet.
const WARTEDECKEL_MS = 5_000;

/** Ein React-Takt: `act` laesst Effekte, Timer und Neuanstriche wirklich durchlaufen. */
async function tick(ms: number): Promise<void> {
  await act(async () => {
    await new Promise((r) => setTimeout(r, ms));
  });
}

/**
 * Was die Bruecke gesehen hat — Statuscode UND Zustand des Antwortkoerpers.
 *
 * Der Koerper gehoert hier hin, nicht nur der Kopf (JOB 3078 R2): eine Zeile „→ 200" allein liest
 * sich wie „der Server hat geantwortet", waehrend der Koerper noch haengt und die Seite nichts hat.
 * Gemessen an Gegenprobe E: ohne diese Angabe nannte die Meldung nur `→ 200`, und der Mensch haette
 * am falschen Ende gesucht.
 */
function abrufBild(): string {
  if (abrufe.length === 0) {
    return "keine";
  }
  return abrufe
    .map((a) => {
      const kopf = a.status === null ? "OFFEN (Antwort steht aus)" : String(a.status);
      const koerper =
        a.koerper === "gelesen"
          ? ""
          : a.koerper === "wird gelesen"
            ? " · Koerper: WIRD NOCH GELESEN"
            : " · Koerper: nie gelesen";
      return `${a.methode} ${a.url} → ${kopf}${koerper}`;
    })
    .join("\n  ");
}

async function warteAuf(
  station: string,
  erwartet: string,
  bedingung: () => boolean,
): Promise<void> {
  const start = Date.now();
  while (!bedingung()) {
    if (Date.now() - start >= WARTEDECKEL_MS) {
      throw new Error(
        [
          `${station}: ${erwartet} — nicht eingetreten innerhalb von ${WARTEDECKEL_MS} ms.`,
          `Abrufe durch die Bruecke:\n  ${abrufBild()}`,
          `Zuletzt sichtbar: ${seitenText().slice(0, 700)}`,
        ].join("\n"),
      );
    }
    await tick(10);
  }
}

/** Der Abruf der Suchroute zu genau dieser Anfrage — `undefined`, solange er nicht lief. */
function suchabruf(q: string): Abruf | undefined {
  const teil = `q=${encodeURIComponent(q)}`;
  return abrufe.find((a) => a.url.includes(SUCHPFAD) && a.url.includes(teil));
}

/**
 * Der Anstrich der Liste: eine Zeile ODER der Leersatz. Beides heisst „etwas steht fest";
 * solange geladen wird, zeichnet `BibliothekListe.tsx:191` bewusst gar nichts.
 */
function listeGezeichnet(): boolean {
  return container.querySelector('[data-testid="bib-zeile"], [data-testid="bib-leer"]') !== null;
}

/**
 * Der Zaehler im Fuss steht auf einer ZAHL statt auf „–".
 *
 * Das ist die Frischeaussage der Flaeche selbst, nicht eine Nachbildung im Test: `gesamt` ist
 * `frisch ? sorted.length : null` (`BibliothekFlaeche.tsx:698`), und `frisch` verlangt
 * `query.data !== undefined` (`:446-448`) — also einen ERFOLGREICH ABGESCHLOSSENEN Abruf. Bei einem
 * neuen Suchschluessel ist `data` zunaechst `undefined`, der Fuss zeigt dann
 * `lib.liste.eintraegeUnbekannt` = „–" (`i18n.ts:3205`, `BibliothekListe.tsx:284-286`). Genau dieses
 * „–" stand am Ende jedes geflackerten Tor-Ausfalls.
 */
function zaehlerSteht(): boolean {
  const fuss = container.querySelector('[data-testid="bib-fuss"]');
  return fuss !== null && (fuss.textContent ?? "") !== i18n.t("lib.liste.eintraegeUnbekannt");
}

/** Kein Abruf haengt: weder fehlt ein Statuscode noch wird gerade ein Antwortkoerper gelesen. */
function nichtsOffen(): boolean {
  return abrufe.every((a) => a.status !== null && a.koerper !== "wird gelesen");
}

/**
 * ==================================================================================================
 * DER ABGESCHLOSSENE ANSTRICH — UND WARUM „DER TEXT AENDERT SICH NICHT MEHR" DAFUER NICHT REICHT.
 * ==================================================================================================
 *
 * Runde 1 hat hier auf TEXTRUHE gewartet: zweimal hintereinander derselbe Seitentext. BENs
 * Gegenprobe hat das zu Recht gekippt (JOB 3078 R1, Korrekturpflicht 1) — ein LADEZUSTAND ist
 * genauso ruhig wie ein fertiger. Verzoegert man nur das Lesen des Antwortkoerpers, steht der
 * Statuscode langst, der Text ruht, und der Test urteilt ueber eine Seite, die noch nichts hat.
 *
 * Gewartet wird deshalb auf drei Aussagen, die alle die Flaeche selbst trifft, keine davon zeitlich:
 *   1. der Abruf dieser Anfrage ist mit 200 beantwortet UND sein Koerper ist GELESEN — ein
 *      Statuscode ist kein Ergebnis;
 *   2. es haengt ueberhaupt kein Abruf mehr (Kopf oder Koerper);
 *   3. die Liste zeigt eine Zeile oder den Leersatz, und der Zaehler steht auf einer Zahl statt
 *      auf „–" — die Flaeche behauptet also selbst, einen frischen erfolgreichen Abruf zu haben.
 *
 * Dass zwischen 1./2. und 3. kein Anstrich verlorengehen kann, liegt an `act()`: jeder Durchgang
 * der Warteschleife laeuft in `act`, und `act` spuelt vor der Rueckkehr alle faelligen
 * React-Arbeiten aus. Ist der Koerper gelesen, ist die daraus folgende Neuzeichnung beim naechsten
 * Auswerten also bereits geschehen — hier wird nicht gehofft, sondern gespuelt.
 *
 * Die Zaehne bleiben in beide Richtungen: eine erfolgreich LEERE Antwort erfuellt 1.-3. sofort
 * (Leersatz plus Zahl 0), der Fall faellt dann augenblicklich an seiner Zusicherung und nicht erst
 * am Deckel. Kommt gar nichts, laeuft der Deckel ab und die Meldung nennt Station, Abrufe und Bild.
 */
async function warteAufAnstrich(station: string, q: string): Promise<void> {
  await warteAuf(
    station,
    "die Liste ist nach der GELESENEN Antwort neu gezeichnet (Zeile oder Leersatz) und der Zaehler steht auf einer Zahl statt auf „–“",
    () => {
      const a = suchabruf(q);
      return (
        a?.status === 200 &&
        a.koerper === "gelesen" &&
        nichtsOffen() &&
        listeGezeichnet() &&
        zaehlerSteht()
      );
    },
  );
}

/** STATION 4/5 — CLIENTABRUF und RENDERER: die echte Seite, mit ihren echten Providern. */
async function bibliothekOeffnen(): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    root.render(
      createElement(
        QueryClientProvider,
        { client: qc },
        createElement(
          AuthProvider,
          null,
          createElement(
            RoleProvider,
            null,
            createElement(
              ToastProvider,
              null,
              createElement(
                NavGuardProvider,
                null,
                createElement(
                  MemoryRouter,
                  { initialEntries: ["/bibliothek"] },
                  createElement(
                    Routes,
                    null,
                    createElement(Route, { path: "/bibliothek", element: createElement(Library) }),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  });
  // (a) Nach dem Mounten: warten, bis die Liste ihren ERSTEN VOLLSTAENDIGEN Anstrich hatte —
  // gezeichnet UND mit einer Zahl im Fuss, also aus einem abgeschlossenen Abruf, nicht im Laden.
  await warteAuf(
    "Station 4/5 (Bibliothek oeffnen)",
    "die Liste hatte ihren ersten Anstrich (eine Zeile oder der Leersatz) und der Zaehler steht auf einer Zahl",
    () => nichtsOffen() && listeGezeichnet() && zaehlerSteht(),
  );
}

function seitenText(): string {
  return (container.textContent ?? "").replace(/\s+/g, " ");
}

function setNativeValue(el: HTMLElement, value: string): void {
  const proto = Object.getPrototypeOf(el) as object;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  setter?.call(el, value);
}

/** Eine echte Nutzereingabe in das echte Suchfeld. */
async function suchen(q: string): Promise<void> {
  // JOB 3063 (H4): das Suchfeld der Bibliothek trägt seit dem Umbau den Platzhalter
  // `lib.searchLabel` („Bibliothek durchsuchen") und die Id `bib-suche`
  // (`components/bibliothek/BibliothekListe.tsx:122`). Der Schlüssel `lib.search` mit der
  // Feldaufzählung ist entfallen.
  const feld = [...container.querySelectorAll("input")].find(
    (i) => i.id === "bib-suche" && i.placeholder === i18n.t("lib.searchLabel"),
  );
  if (!feld) {
    throw new Error(`Suchfeld nicht gefunden. Sichtbar: ${seitenText().slice(0, 700)}`);
  }
  setNativeValue(feld, q);
  await act(async () => {
    feld.dispatchEvent(new Event("input", { bubbles: true }));
    feld.dispatchEvent(new Event("change", { bubbles: true }));
  });

  // (b) Erst die Entprellung der Flaeche — die Dauer kommt aus dem Produktmodul, nicht von hier.
  await tick(LIBRARY_SEARCH_DEBOUNCE_MS);

  await warteAuf(
    "Station 4 (Clientabruf)",
    `GET ${SUCHPFAD}?…q=${encodeURIComponent(q)}… ist durch die Bruecke gelaufen (Entprellung ausgeloest?)`,
    () => suchabruf(q) !== undefined,
  );
  await warteAuf(
    "Station 4 (Antwortkopf)",
    `GET ${SUCHPFAD}?…q=${encodeURIComponent(q)}… hat einen Statuscode (antwortet der Server?)`,
    () => suchabruf(q)?.status != null,
  );
  const antwort = suchabruf(q);
  if (antwort?.status !== 200) {
    throw new Error(
      `Station 4 (Antwortkopf): Die Suchroute antwortete mit Status ${antwort?.status}, nicht 200.\nAbrufe durch die Bruecke:\n  ${abrufBild()}`,
    );
  }

  await warteAuf(
    "Station 4 (Antwortkoerper)",
    `der Koerper von GET ${SUCHPFAD}?…q=${encodeURIComponent(q)}… ist GELESEN (ein Statuscode ist kein Ergebnis)`,
    () => suchabruf(q)?.koerper === "gelesen",
  );

  // (c) Und danach der Anstrich: die Flaeche hat die gelesene Antwort wirklich gezeichnet.
  await warteAufAnstrich("Station 5 (Renderer)", q);
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  localStorage.clear();
  sessionStorage.clear();
  abrufe = [];
  await serverStarten();
  bruecke();
});

afterEach(() => {
  if (root) {
    act(() => root.unmount());
  }
  container?.remove();
});

describe("F-0435 · die Kette von der gespeicherten Fussnote bis zur sichtbaren Fundstelle", () => {
  it("Persistenz → Service → Wiretyp → Clientabruf → Renderer → Kennzeichnung", async () => {
    // ── STATION 1+2: PERSISTENZ und SERVICE ─────────────────────────────────────────────────
    await objektAnlegen();

    // ── STATION 3: WIRETYP ───────────────────────────────────────────────────────────────────
    // Das abgeleitete Suchfeld reist mit, und es traegt die Wortgrenze. Waere hier noch
    // „Ventil V2gerissen" zu lesen, waere alles Weitere sinnlos.
    const treffer = await suchAntwort(ANFRAGE);
    const meins = treffer.find((k) => k.title === TITEL);
    expect(
      meins,
      `Kein Treffer fuer „${ANFRAGE}". Antwort: ${JSON.stringify(treffer).slice(0, 400)}`,
    ).toBeDefined();
    expect(meins?.captionTexts).toEqual([ERWARTETER_SUCHTEXT]);

    // ── STATION 4+5: CLIENTABRUF und RENDERER ────────────────────────────────────────────────
    await bibliothekOeffnen();
    await suchen(ANFRAGE);

    // Der Treffer steht sichtbar auf der Seite.
    expect(seitenText()).toContain(TITEL);

    // ── STATION 6: DIE FUNDSTELLENKENNZEICHNUNG ──────────────────────────────────────────────
    // „Treffer in · Bildbeschreibung" — der Nutzer sieht nicht nur DASS, sondern WO getroffen
    // wurde. Genau diese Kennzeichnung war es, die ohne die Blockgrenzen-Regel ausblieb.
    expect(seitenText()).toContain(i18n.t("lib.matchIn"));
    expect(seitenText()).toContain(i18n.t("lib.match.caption"));
  });

  // ── DER BEWEIS, DASS DIE ZEITABHAENGIGKEIT WEG IST (JOB 3078 · W1) ────────────────────────────
  // Derselbe Weg, nur antwortet die Bruecke um 400 ms verzoegert — die Groessenordnung, die eine
  // ausgelastete Maschine im Tor erzeugt. Gegen den frueheren Wartecode (40 Nulltakte) endete
  // dieser Fall deterministisch an `expect(seitenText()).toContain(TITEL)`, mit genau dem Bild des
  // echten Tor-Ausfalls: die Seite noch im Ladezustand („…AlleValidiertOffenBereichFilter–").
  // Fuenfzehnmal Glueck haben und diesen Fall bestehen sind zwei verschiedene Aussagen.
  it("dieselbe Kette, wenn der Server 400 ms braucht — die Antwort kommt spaeter, nicht nie", async () => {
    await objektAnlegen();
    bruecke(400);

    await bibliothekOeffnen();
    await suchen(ANFRAGE);

    expect(seitenText()).toContain(TITEL);
    expect(seitenText()).toContain(i18n.t("lib.matchIn"));
    expect(seitenText()).toContain(i18n.t("lib.match.caption"));
  });

  // ── DER KOPF IST NICHT DAS ERGEBNIS (JOB 3078 R2, Korrekturpflicht 1 aus BENs Befund) ─────────
  // Runde 1 hat den Wettlauf nur halb geschlossen. Der Statuscode steht, sobald `app.inject`
  // zurueckkommt; der KOERPER wird erst danach gelesen, und react-query kann die Liste erst dann
  // zeichnen. BENs Gegenprobe verzoegert genau diese zweite Haelfte — und Runde 1 fiel prompt
  // wieder in den Ladezustand, mit demselben Bild wie der echte Tor-Ausfall. Genau deshalb steht
  // dieser Fall hier dauerhaft: er ist die Regression fuer „200 gelesen heisst noch nicht gezeigt".
  it("dieselbe Kette, wenn nur der ANTWORTKOERPER 400 ms braucht — ein Statuscode ist kein Ergebnis", async () => {
    await objektAnlegen();
    bruecke(0, 400);

    await bibliothekOeffnen();
    await suchen(ANFRAGE);

    expect(seitenText()).toContain(TITEL);
    expect(seitenText()).toContain(i18n.t("lib.matchIn"));
    expect(seitenText()).toContain(i18n.t("lib.match.caption"));
  });

  it("Gegenprobe: die verklebte Anfrage trifft NICHT — der Unterschied ist echt", async () => {
    await objektAnlegen();

    // Genau das, was vor D1 im Suchfeld stand. Faende die Suche es weiterhin, waere die
    // Wortgrenze nicht gesetzt und der ganze Durchgang wirkungslos.
    const verklebt = await suchAntwort("V2gerissen");
    expect(verklebt.find((k) => k.title === TITEL)).toBeUndefined();

    // Und die Gegenrichtung: ohne die Fussnote gaebe es diesen Treffer gar nicht — die Anfrage
    // steht nirgends in Titel, Aussage, Kategorie oder Schlagwort.
    const nurUeberFussnote = await suchAntwort(ANFRAGE);
    expect(nurUeberFussnote.find((k) => k.title === TITEL)).toBeDefined();
  });
});
