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

function bruecke(): void {
  (globalThis as unknown as { fetch: unknown }).fetch = async (
    input: unknown,
    init: { method?: string; body?: string; headers?: HeadersInit } = {},
  ) => {
    const url = String(input);
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
    return {
      ok: res.statusCode < 400,
      status: res.statusCode,
      statusText: "",
      text: async () => res.body,
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

const flush = async (): Promise<void> => {
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

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
    await flush();
  });
  await act(flush);
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
    await flush();
  });
  await act(flush);
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  localStorage.clear();
  sessionStorage.clear();
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
