// @vitest-environment jsdom
// ================================================================================================
// JOB 2656 · D4 — DER EINREICHEN-KNOPF WIRD GEDRUECKT
// ================================================================================================
//
// PEDIS FRAGE, die diese Datei beantwortet:
//
//   „Kann ich mein Dokument mit Bildern jetzt einreichen, wenn ich den Knopf druecke?"
//
// WARUM DREI DURCHGAENGE NICHT GEREICHT HABEN, und es lag nicht am Bau. BEN zu D3, woertlich:
//
//   „W4 prueft die Vordertuer nur ueber Quelltextverdrahtung beziehungsweise einen Caller-Pin
//    und nicht durch den gemounteten Einreichen-Knopf; W2 belegt ein Kurzfeld, nicht die
//    behauptete Darstellung auf der Karte."
//
//   „Fuer die sichtbaren Aussagen fehlen der ausgefuehrte UI-Trigger sowie Clientabruf,
//    Karten-Renderer und konkreter UI-Test; fuer die gemeldete Bilderzahl fehlt ebenfalls ein
//    nachweislich laufender Rendererfall. Handler → Route → Persistenz allein schliesst diese
//    Kette nicht."
//
// EIN CALLER-PIN IST KEIN GEDRUECKTER KNOPF. Er belegt, dass der Code den Aufruf enthaelt — nicht,
// dass ein Mensch ihn ausloesen kann und etwas ankommt. Diese Datei drueckt den Knopf.
//
// WAS HIER ECHT IST:
//   * die echte Seite `pages/CaptureFrontDoor.tsx`, gemountet, mit ihren echten Providern,
//   * der echte Einreichen-Knopf (`type="submit"`, `fd.submitReview`) und das echte Formular,
//   * der echte Clientweg `submitFrontDoorDraft` → `endpoints.drafts.promote`,
//   * die echte Fastify-Anwendung mit allen Routen, Rechten und der echten Persistenz,
//   * die echten Renderer `DraftBodyGallery` (Bilderzahl) und `KoView` (die Karte).
// Der EINZIGE Ersatz ist der Transport: `globalThis.fetch` liegt auf `app.inject`. Die Bauform
// stammt woertlich aus `tests/capture/mega20-capture-submit-mounted.test.tsx` (dort ausfuehrlich
// begruendet). Sie ist hier zusaetzlich zwingend, weil die Bahn-Sandbox keinen Horchsocket
// zulaesst (`listen EPERM`).
//
// DER ENDZUSTAND WIRD BEIM SERVER ERFRAGT, nicht aus Aufrufen abgelesen — `GET /api/kos`.
//
// WARUM DER ENTWURF UEBER DEN DEEP-LINK KOMMT UND NICHT UEBER EINEN DATEI-UPLOAD: Das ist Pedis
// echte Kette. Das Word-Add-in legt den Entwurf an (`POST /api/drafts`, `origin: "word_addin"`),
// der Mensch oeffnet ihn ueber `/capture/frontdoor?draft=<id>` und drueckt Einreichen. Genau diese
// Mechanik prueft bereits `tests/capture/frontdoor-draft-deeplink-mounted.test.tsx`; hier wird sie
// mit einem Body ueber 1 MiB gefahren — dem Fall, an dem der Weg seit vier Durchgaengen scheitert.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

process.env.KLARWERK_SKIP_KEYCHAIN = "1";

const bruecke = vi.hoisted(() => ({
  app: null as unknown as { inject: (o: Record<string, unknown>) => Promise<AnyRes> },
  token: "",
  /** Jeder Request, den die OBERFLAECHE erzeugt hat — Grundlage der Knopf-Gegenprobe. */
  requests: [] as { method: string; url: string; bytes: number }[],
  /** Jede Antwort auf ein Promote — hier steht ein 413, wenn der Weg wieder bricht. */
  promoteAntworten: [] as { status: number; body: string }[],
}));

interface AnyRes {
  statusCode: number;
  body: string;
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
import { KoView } from "../../apps/web/src/components/KoView";
import i18n from "../../apps/web/src/i18n";
import { CaptureFrontDoor } from "../../apps/web/src/pages/CaptureFrontDoor";
import { buildApp, buildServices } from "../../services/app/src/build-app";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};
(globalThis as unknown as { scrollTo: () => void }).scrollTo = () => {};

// ------------------------------------------------------------------------------------------------
// DER PRUEFFALL: ein Entwurf mit zwei Bildern, deutlich ueber 1 MiB.
// ------------------------------------------------------------------------------------------------
//
// DIE GROESSE IST DER GEGENSTAND, nicht Beiwerk: Fastifys Vorgabe fuer den Rumpf liegt bei 1 MiB.
// Genau daran ist Pedis Weg gescheitert — der Entwurf reiste, der Server wies ihn mit 413 ab,
// bevor irgendeine Fachlogik ihn sah. Zwei Bilder zu je rund 700 KiB liegen sicher darueber und
// bleiben unter dem erhoehten Deckel, damit dieser Fall den ERFOLG misst und nicht die naechste
// Grenze.
const BILD_BYTES = 700 * 1024;
function grossesBild(fuellzeichen: string): string {
  // Ein gueltiger data:-URI mit echtem Gewicht. Der Inhalt muss kein decodierbares PNG sein — die
  // Kette, die hier geprueft wird, wiegt und transportiert ihn, sie decodiert ihn nicht. Was
  // decodiert werden muss, prueft `tests/app/job2613-docx-bilder-uebergabe.test.ts`.
  return `data:image/png;base64,${fuellzeichen.repeat(BILD_BYTES)}`;
}

const BILD_EINS = grossesBild("A");
const BILD_ZWEI = grossesBild("B");
const QUELL_BILDZAHL = 2;

// Der lange Fliesstext, aus dem die Kernaussage entsteht. Er ist absichtlich weit laenger als ein
// Satz: Ohne Kuerzung stuende dieser ganze Absatz auf der Karte — genau der Befund, den D3
// beschrieben und nur in den Daten belegt hat.
const LANGER_TEXT = [
  "Die Splitterschutzverriegelung wird vor jedem Schichtbeginn auf freien Lauf geprueft.",
  "Dazu wird der Hebel vollstaendig geoeffnet, die Feder auf Rissbildung gesichtet und der",
  "Verriegelungsbolzen von Hand bis zum Anschlag gefuehrt. Bleibt der Bolzen haengen, wird die",
  "Anlage nicht freigegeben, sondern der Instandhaltung gemeldet; die Freigabe erfolgt erst nach",
  "dem schriftlichen Pruefvermerk. Wird die Pruefung ausgelassen, ist die Anlage im Sinne der",
  "Betriebsanweisung nicht betriebsbereit, auch wenn sie technisch anlaeuft.",
].join(" ");

const TITEL = "Splitterschutzverriegelung vor Schichtbeginn";

function entwurfsBody(): string {
  return [
    `<h2>${TITEL}</h2>`,
    `<p>${LANGER_TEXT}</p>`,
    `<figure><img src="${BILD_EINS}" alt="Hebel geoeffnet" data-image-id="kw-img-1"></figure>`,
    `<figure><img src="${BILD_ZWEI}" alt="Bolzen am Anschlag" data-image-id="kw-img-2"></figure>`,
  ].join("");
}

// ------------------------------------------------------------------------------------------------
// DIE BRUECKE — der echte Client spricht mit dem echten Server.
// ------------------------------------------------------------------------------------------------
function brueckeAufbauen(): void {
  (globalThis as unknown as { fetch: unknown }).fetch = async (
    input: unknown,
    init: { method?: string; body?: string; headers?: HeadersInit } = {},
  ) => {
    const url = String(input);
    const headers: Record<string, string> = {};
    new Headers(init.headers).forEach((value, key) => {
      headers[key] = value;
    });
    if (bruecke.token) {
      headers.authorization = `Bearer ${bruecke.token}`;
    }
    const res = await bruecke.app.inject({
      method: init.method ?? "GET",
      url,
      headers,
      ...(init.body !== undefined ? { payload: init.body } : {}),
    });
    bruecke.requests.push({
      method: init.method ?? "GET",
      url,
      bytes: init.body === undefined ? 0 : Buffer.byteLength(init.body, "utf8"),
    });
    if (url.includes("/promote")) {
      bruecke.promoteAntworten.push({ status: res.statusCode, body: res.body.slice(0, 400) });
    }
    return {
      ok: res.statusCode < 400,
      status: res.statusCode,
      statusText: "",
      text: async () => res.body,
    };
  };
}

const flush = async (): Promise<void> => {
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot> | null = null;

async function serverStarten(): Promise<void> {
  const services = buildServices();
  bruecke.app = buildApp(services) as unknown as typeof bruecke.app;
  bruecke.token = "";
  bruecke.requests = [];
  bruecke.promoteAntworten = [];
  await bruecke.app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Pedi", email: "pedi@job2656.test", password: "geheim12345" },
  });
  const login = await bruecke.app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "pedi@job2656.test", password: "geheim12345" },
  });
  bruecke.token = (JSON.parse(login.body) as { token: string }).token;
}

/**
 * Der Entwurf, wie ihn das Word-Add-in anlegt: reicher Body mit Bildern, `origin: "word_addin"`,
 * und die Zahl der Bilder in der QUELLDATEI. Angelegt ueber die echte Route, nicht im Speicher
 * zusammengesetzt — sonst pruefte der Fall einen Entwurf, den es so nie gibt.
 */
async function entwurfAnlegen(): Promise<string> {
  const res = await bruecke.app.inject({
    method: "POST",
    url: "/api/drafts",
    headers: { authorization: `Bearer ${bruecke.token}`, "content-type": "application/json" },
    payload: {
      title: TITEL,
      bodyHtml: entwurfsBody(),
      origin: "word_addin",
      sourceImageCount: QUELL_BILDZAHL,
    },
  });
  expect(res.statusCode, `Entwurf nicht angelegt: ${res.body.slice(0, 300)}`).toBe(201);
  return (JSON.parse(res.body) as { id: string }).id;
}

/** Der PERSISTIERTE Endzustand — beim Server erfragt, nicht aus Aufrufen abgeleitet. */
async function bestand(): Promise<
  { id: string; title: string; statement: string; bodyHtml?: string }[]
> {
  const res = await bruecke.app.inject({
    method: "GET",
    url: "/api/kos",
    headers: { authorization: `Bearer ${bruecke.token}` },
  });
  return JSON.parse(res.body);
}

async function vordertuerOeffnen(draftId: string): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  await act(async () => {
    root?.render(
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
                  { initialEntries: [`/capture/frontdoor?draft=${draftId}`] },
                  createElement(
                    Routes,
                    null,
                    createElement(Route, {
                      path: "/capture/frontdoor",
                      element: createElement(CaptureFrontDoor),
                    }),
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

function seitentext(): string {
  return (container.textContent ?? "").replace(/\s+/g, " ");
}

/** DER KNOPF. Gesucht wird er ueber seine sichtbare Beschriftung, nicht ueber eine Testmarke. */
function einreichenKnopf(): HTMLButtonElement {
  const beschriftung = i18n.t("fd.submitReview");
  const knopf = [...container.querySelectorAll("button")].find((b) =>
    (b.textContent ?? "").replace(/\s+/g, " ").includes(beschriftung),
  );
  if (!(knopf instanceof HTMLButtonElement)) {
    throw new Error(
      `Einreichen-Knopf „${beschriftung}" nicht gefunden. Sichtbar: ${seitentext().slice(0, 700)}`,
    );
  }
  return knopf;
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  brueckeAufbauen();
  await serverStarten();
});

afterEach(() => {
  if (root) {
    act(() => root?.unmount());
    container.remove();
    root = null;
  }
});

describe("JOB 2656 · D4 — der Einreichen-Knopf wird gedrueckt", () => {
  it("K0 — KALIBRIERUNG: der Prueffall liegt wirklich ueber 1 MiB und traegt zwei Bilder", () => {
    // Ohne diese Zusicherung koennte der Fall unbemerkt unter der Grenze bleiben und den
    // Missbrauchsfall gar nicht erreichen — dann waere jedes Gruen unten wertlos.
    const bytes = Buffer.byteLength(entwurfsBody(), "utf8");
    expect(bytes, "der Prueffall liegt nicht ueber 1 MiB").toBeGreaterThan(1024 * 1024);
    expect(entwurfsBody().match(/<img /g)?.length).toBe(QUELL_BILDZAHL);
  });

  it("F1 — DER GEDRUECKTE KNOPF: ein Entwurf ueber 1 MiB kommt an", async () => {
    const draftId = await entwurfAnlegen();
    await vordertuerOeffnen(draftId);

    // Vorbedingung: Es gibt noch kein Wissensobjekt — sonst maesse der Fall einen Altbestand.
    expect(await bestand(), "vor dem Klick liegt schon ein Objekt im Bestand").toHaveLength(0);

    const knopf = einreichenKnopf();
    // Der Knopf ist bedienbar. Waere er gesperrt, liefe unten ein Klick ins Leere und der Fall
    // waere aus dem falschen Grund gruen.
    expect(knopf.disabled, "der Einreichen-Knopf ist gesperrt — es gaebe nichts auszuloesen").toBe(
      false,
    );

    await act(async () => {
      knopf.click();
      await flush();
    });
    await act(flush);

    // DER NACHWEIS: nicht der Aufruf, sondern der PERSISTIERTE Endzustand.
    const kos = await bestand();
    expect(
      kos,
      `kein Wissensobjekt entstanden. Promote-Antworten: ${JSON.stringify(bruecke.promoteAntworten)}`,
    ).toHaveLength(1);
    expect(kos[0]?.title).toBe(TITEL);

    // Und ausdruecklich: KEIN 413. Das ist der Befund, an dem der Weg seit vier Durchgaengen haengt.
    for (const antwort of bruecke.promoteAntworten) {
      expect(antwort.status, `Promote mit ${antwort.status} abgewiesen: ${antwort.body}`).not.toBe(
        413,
      );
    }

    // KALIBRIERUNG DES TRANSPORTS: Der Rumpf, den die OBERFLAECHE gebaut hat, war wirklich gross.
    // Ohne diese Messung koennte der Fall gruen sein, weil die Bilder unterwegs verloren gingen.
    const promote = bruecke.requests.filter((r) => r.url.includes("/promote"));
    expect(promote.length, "die Oberflaeche hat gar kein Promote gesendet").toBeGreaterThan(0);
    expect(
      Math.max(...promote.map((r) => r.bytes)),
      "der gesendete Rumpf lag unter 1 MiB — die Bilder sind vor dem Absenden verschwunden",
    ).toBeGreaterThan(1024 * 1024);
  });

  it("F2 — DIE KARTE: auf der Karte des eingereichten Objekts steht ein KURZER Satz", async () => {
    const draftId = await entwurfAnlegen();
    await vordertuerOeffnen(draftId);
    await act(async () => {
      einreichenKnopf().click();
      await flush();
    });
    await act(flush);

    const kos = await bestand();
    expect(kos, "ohne eingereichtes Objekt gibt es keine Karte").toHaveLength(1);
    const ko = kos[0] as unknown as Parameters<typeof KoView>[0]["ko"];

    // DER RENDERER LAEUFT — `KoView` ist die gemeinsame Kartendarstellung des Hauses
    // (Konflikt-Board, Gegenueberstellung, Objekt-Auswahl). Gemessen wird, was dort STEHT,
    // nicht was in den Daten liegt: genau das war BENs Einwand gegen W2.
    const kartenWurzel = document.createElement("div");
    document.body.appendChild(kartenWurzel);
    const kartenRoot = createRoot(kartenWurzel);
    await act(async () => {
      kartenRoot.render(createElement(KoView, { ko }));
      await flush();
    });
    const kartentext = (kartenWurzel.textContent ?? "").replace(/\s+/g, " ");

    // (1) Die Karte traegt den Titel — sonst zeigt sie ein anderes Objekt.
    expect(kartentext).toContain(TITEL);

    // (2) DER KURZE SATZ. Die Aussage auf der Karte ist nicht das ganze Dokument. Gemessen am
    //     Fliesstext des Entwurfs: er ist laenger als das, was eine Karte tragen soll.
    const aussage = ko.statement;
    expect(
      aussage.length,
      `die Kernaussage ist leer — die Karte saehe leer aus. Aussage: „${aussage}"`,
    ).toBeGreaterThan(0);
    // KALIBRIERUNG DER KUERZUNG — ohne sie waere (2) auch dann gruen, wenn die Aussage gar nicht
    // aus dem Dokument stammt (etwa nur der Titel) oder wenn der Fliesstext ohnehin kurz waere.
    // Beides gemessen, statt angenommen:
    expect(
      LANGER_TEXT.length,
      "der Fliesstext des Prueffalls ist selbst schon kurz — dann misst die Grenze nichts",
    ).toBeGreaterThan(500);
    expect(
      aussage,
      `die Aussage stammt nicht aus dem Fliesstext des Dokuments: „${aussage.slice(0, 120)}"`,
    ).toContain("Splitterschutzverriegelung");
    expect(
      aussage.length,
      `die Aussage auf der Karte ist ${aussage.length} Zeichen lang — das ist kein kurzer Satz`,
    ).toBeLessThanOrEqual(500);

    // (3) Und sie steht wirklich GERENDERT da, nicht nur in den Daten.
    expect(kartentext, "die Kernaussage steht nicht auf der gerenderten Karte").toContain(
      aussage.slice(0, 40),
    );

    // (4) KEIN BILD-URI AUF DER KARTE. Ohne Kuerzung reiste der halbe Base64-Rumpf in die
    //     Kartenaussage — die haesslichste Form des Befunds.
    expect(kartentext, "ein Bild-URI steht auf der Karte").not.toContain("data:image");

    await act(async () => {
      kartenRoot.unmount();
    });
    kartenWurzel.remove();
  });

  it("F3 — DIE BILDERZAHL, an einem laufenden Rendererfall: die Galerie zeigt beide Bilder und meldet keinen Verlust, der nicht stattfand", async () => {
    const draftId = await entwurfAnlegen();
    await vordertuerOeffnen(draftId);

    // DER DEBOUNCE MUSS WIRKLICH ABLAUFEN — und das ist keine Formalie, sondern der Unterschied
    // zwischen einem laufenden Rendererfall und einem Scheinbeleg. `DraftBodyGallery` rechnet auf
    // einem um 300 ms verzoegerten Stand und schweigt ausdruecklich, solange er dem Body
    // hinterherhinkt (`standAktuell`, DraftBodyGallery.tsx). Die erste Fassung dieses Falls hat
    // genau das uebersehen: Sie lief mit 40 Mikrotask-Runden, in denen KEINE 300 ms vergehen —
    // die Galerie stand auf „unbekannt", der Verlusthinweis konnte gar nicht erscheinen, und der
    // Fall blieb selbst dann gruen, als die Verlustrechnung absichtlich verfaelscht wurde
    // (gemessen in diesem Durchgang: `quelle - koerper + 1` liess ihn unveraendert durchgehen).
    // Die gezaehlten Bilder kamen damals vom EDITOR, nicht von der Galerie.
    await act(async () => {
      await new Promise((r) => setTimeout(r, 400));
      await flush();
    });
    await act(flush);

    // KALIBRIERUNG ZUERST: Die GALERIE hat wirklich gerendert. Gezaehlt werden ihre Kacheln —
    // Knoepfe mit der Beschriftung aus `ko.galleryOpen` —, nicht irgendwelche Bilder auf der
    // Seite. Der Editor daneben zeigt dieselben Bilder; ohne diese Verengung maesse der Fall ihn.
    // Die Beschriftung traegt die laufende Nummer („Bild {{n}} vergroessern"). Verglichen wird
    // deshalb je Kachel gegen IHRE Nummer — ein fester Ausschnitt des ersten Labels traefe nur die
    // erste Kachel und meldete „1 statt 2" (in diesem Durchgang genau so passiert).
    const kachelBeschriftungen = new Set(
      Array.from({ length: QUELL_BILDZAHL }, (_, i) => i18n.t("ko.galleryOpen", { n: i + 1 })),
    );
    const kacheln = [...container.querySelectorAll("button")].filter((b) =>
      kachelBeschriftungen.has(b.getAttribute("aria-label") ?? ""),
    );
    expect(
      kacheln.length,
      `die Galerie zeigt ${kacheln.length} statt ${QUELL_BILDZAHL} Kacheln. Sichtbar: ${seitentext().slice(0, 500)}`,
    ).toBe(QUELL_BILDZAHL);

    // DIE AUSSAGE: Der Entwurf traegt `sourceImageCount: 2`, der Body zwei verankerte Bilder.
    // `DraftBodyGallery` vergleicht beides und meldet nur bei echter Differenz. Ein Verlusthinweis
    // hier waere eine falsche Aussage ueber Pedis Dokument — die gemeldete Bilderzahl stimmt mit
    // dem gespeicherten Stand ueberein.
    expect(
      container.querySelector("[data-testid=draft-gallery-loss]"),
      `die Galerie meldet einen Bildverlust, den es nicht gab. Sichtbar: ${seitentext().slice(0, 500)}`,
    ).toBeNull();
  });
});
