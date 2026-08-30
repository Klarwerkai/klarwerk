// @vitest-environment jsdom
// ================================================================================================
// JOB 2705 · D1 — DREI KLEINE WEGE, AUF DENEN TEXT VERSCHWINDET
// ================================================================================================
//
// PEDIS FRAGE:  „Verliere ich Text, den ich waehrend des Speicherns tippe?"
//
// DREI BEFUNDE (Review R2-23), alle an DIESEM Klon nachgemessen — die Zeilen des Reviews stammen
// aus `71d3c2b`, dieser Klon steht auf `ae4dc8e` (R27):
//
//   (a) DER LOESCHMARKER AUS DEM NICHTS.
//       `services/capture/src/service.ts:556` (withAnchorCheck) duennt die Antwort aus, wenn ein
//       Ankerdokument fehlt: `bodyHtml: null`. Der ECHTE Body bleibt dabei in der Ablage.
//       `frontDoorBodyFromDraft` (captureFrontDoor.ts) macht daraus `""`, und
//       `draftBodyPatch("", true)` schickt `bodyHtml: ""` — einen LOESCHMARKER — an den Merge.
//       Der loescht daraufhin den Body, den niemand geloescht hat.
//
//   (b) DIE FALSCHE MELDUNG.
//       `CaptureFrontDoor.tsx:357` — der `.catch` des LADENS meldet `fd.errSaveFailed`
//       („Speichern fehlgeschlagen."). Es wurde nichts gespeichert; es konnte nur nichts geladen
//       werden. Der Mensch sucht den Fehler an der falschen Stelle.
//
//   (c) DER TEXT WAEHREND DES SPEICHERNS.
//       `CaptureFrontDoor.tsx:472` — `savedStateRef` nimmt im `onSuccess` die Render-Werte ZUM
//       ERFOLGSZEITPUNKT, nicht die abgesendeten. Wer weitertippt, waehrend gespeichert wird, hat
//       danach einen „sauberen" Zustand, der Text enthaelt, den niemand persistiert hat — und
//       `CaptureFrontDoor.tsx:487` navigiert sofort weg. Der Text ist damit fort, ohne Warnung.
//
// WAS HIER ECHT IST: die echte Seite mit ihren echten Providern, der echte Knopf ueber seine
// sichtbare Beschriftung, der echte Clientweg, die echte Fastify-Anwendung mit echter Persistenz.
// Einziger Ersatz ist der Transport: `globalThis.fetch` liegt auf `app.inject`. In C1 haelt diese
// Bruecke den PUT zusaetzlich an einer Barriere fest — anders ist „waehrend des Speicherns" nicht
// herstellbar.
import { afterEach, beforeEach, describe, expect, it } from "vitest";

process.env.KLARWERK_SKIP_KEYCHAIN = "1";

import type { FastifyInstance } from "fastify";
import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter, Route, Routes } from "../../apps/web/node_modules/react-router-dom";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { ImageDescribeProvider } from "../../apps/web/src/app/ImageDescribeContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { Capture } from "../../apps/web/src/pages/Capture";
import { CaptureFrontDoor } from "../../apps/web/src/pages/CaptureFrontDoor";
import { buildApp, buildServices } from "../../services/app/src/build-app";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};
(globalThis as unknown as { scrollTo: () => void }).scrollTo = () => {};

const KOERPER = "<p>Die Entlueftung folgt der Betriebsanweisung.</p>";

/** Ein Entwurf, dessen Ankerdokument es nicht (mehr) gibt — der Fall aus (a). */
const ENTWURF_MIT_TOTEM_ANKER = {
  title: "Pumpe entlueften",
  statement: "Vor dem Entlueften wird die Anlage druckfrei gemacht.",
  bodyHtml: KOERPER,
  type: "sop",
  category: "Instandhaltung",
  origin: "studio",
  confidentiality: "intern",
  // Genau hier haengt (a): Dieses Objekt existiert nicht. `verifyDraftAnchors` findet es nicht,
  // `withAnchorCheck` duennt die AUSKUNFT aus — der gespeicherte Body bleibt unberuehrt.
  anchorDocuments: [
    {
      key: "anker-1",
      objectId: "objekt-das-es-nicht-gibt",
      name: "Betriebsanweisung.pdf",
      mime: "application/pdf",
    },
  ],
};

let app: FastifyInstance;
// Der Dienst selbst — und das ist kein Zugriff an der Sache vorbei, sondern der EINZIGE Weg zum
// ROHEN Bestand: Sowohl `GET /api/drafts/:id` als auch `GET /api/drafts` laufen ueber
// `withAnchorCheck` (services/capture/src/service.ts:545) und duennen bei fehlendem Anker aus.
// Ueber die API ist deshalb nicht unterscheidbar, ob der Body geloescht WURDE oder nur nicht
// GELIEFERT wird — genau diese Verwechslung ist der Befund (a). `getDraft` (service.ts:452) liest
// ohne Ankerpruefung.
let services: ReturnType<typeof buildServices>;
let token = "";
let vorherigerFetch: typeof globalThis.fetch;

/** Haelt C1 den PUT fest, bis der Test ihn freigibt. */
let putBarriere: { warten: Promise<void>; oeffnen: () => void } | null = null;
/** B1: laesst den LADE-Aufruf am Netz scheitern, nicht am Server. */
let getScheitertAmNetz = false;
/** Was ueber die Bruecke wirklich hinausging — C1 misst daran den abgesendeten Stand. */
let gesendeteRumpfe: { url: string; methode: string; rumpf: string }[] = [];

const kopf = (): Record<string, string> => ({
  authorization: `Bearer ${token}`,
  "content-type": "application/json",
});

const flush = async (): Promise<void> => {
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 0));
  }
};

async function serverStarten(): Promise<void> {
  services = buildServices();
  app = buildApp(services);
  await app.ready();
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Pedi", email: "pedi@job2705.test", password: "geheim12345" },
  });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "pedi@job2705.test", password: "geheim12345" },
  });
  token = (JSON.parse(login.body) as { token: string }).token;
}

interface DraftAusBestand {
  id: string;
  payload: { title?: string; bodyHtml?: string | null };
}

async function bestand(): Promise<DraftAusBestand[]> {
  const res = await app.inject({ method: "GET", url: "/api/drafts", headers: kopf() });
  return JSON.parse(res.body);
}

/** Der ROHE Entwurf aus der Ablage, ohne Ankerpruefung und ohne Ausduennung. */
async function roherEntwurf(
  id: string,
): Promise<{ payload: { title?: string; bodyHtml?: string | null } }> {
  const draft = await services.capture.getDraft(id);
  if (!draft) {
    throw new Error(`Entwurf ${id} liegt nicht in der Ablage`);
  }
  return draft;
}

async function entwurfAnlegen(): Promise<string> {
  const res = await app.inject({
    method: "POST",
    url: "/api/drafts",
    headers: kopf(),
    payload: JSON.stringify(ENTWURF_MIT_TOTEM_ANKER),
  });
  expect(res.statusCode, `Entwurf nicht angelegt: ${res.body.slice(0, 300)}`).toBe(201);
  return (JSON.parse(res.body) as { id: string }).id;
}

// ------------------------------------------------------------------------------------------------
// FLAECHE
// ------------------------------------------------------------------------------------------------
let container: HTMLDivElement;
let root: ReturnType<typeof createRoot> | null = null;

function huelle(pfad: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return createElement(
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
              ImageDescribeProvider,
              null,
              createElement(
                MemoryRouter,
                { initialEntries: [pfad] },
                // Beide Routen in EINER Huelle: Die Vordertuer navigiert nach erfolgreichem
                // Speichern selbst nach `/erfassen`. Mit nur einer Route liefe das ins Leere —
                // und C1 misst gerade, ob sie das ueberhaupt darf.
                createElement(
                  Routes,
                  null,
                  createElement(Route, {
                    path: "/capture/frontdoor",
                    element: createElement(CaptureFrontDoor),
                  }),
                  createElement(Route, { path: "/erfassen", element: createElement(Capture) }),
                ),
              ),
            ),
          ),
        ),
      ),
    ),
  );
}

async function seiteOeffnen(pfad: string): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root?.render(huelle(pfad));
    await flush();
  });
  await act(flush);
}

function seitentext(): string {
  return (container.textContent ?? "").replace(/\s+/g, " ");
}

function knopfMit(text: string): HTMLButtonElement | undefined {
  return [...container.querySelectorAll("button")].find((b) =>
    (b.textContent ?? "").replace(/\s+/g, " ").includes(text),
  );
}

async function klick(knopf: HTMLButtonElement): Promise<void> {
  await act(async () => {
    knopf.click();
    await flush();
  });
  await act(flush);
}

/** Schreibt in ein Eingabefeld so, wie React es sieht. */
async function tippen(feld: HTMLInputElement, wert: string): Promise<void> {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
  await act(async () => {
    setter?.call(feld, wert);
    feld.dispatchEvent(new Event("input", { bubbles: true }));
    await flush();
  });
}

function titelfeld(): HTMLInputElement {
  const feld = [...container.querySelectorAll("input")].find(
    (i) => i.value === ENTWURF_MIT_TOTEM_ANKER.title,
  );
  if (!feld) {
    throw new Error(
      `kein Titelfeld mit dem geladenen Titel. Sichtbar: ${seitentext().slice(0, 400)}`,
    );
  }
  return feld;
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  putBarriere = null;
  getScheitertAmNetz = false;
  gesendeteRumpfe = [];
  vorherigerFetch = globalThis.fetch;
  globalThis.fetch = (async (eingabe: unknown, init?: RequestInit) => {
    const url = String(eingabe);
    const methode = (init?.method ?? "GET").toUpperCase();
    const headers: Record<string, string> = {};
    new Headers(init?.headers).forEach((wert, name) => {
      headers[name] = wert;
    });
    if (token) {
      headers.authorization = `Bearer ${token}`;
    }
    if (init?.body !== undefined && init.body !== null) {
      gesendeteRumpfe.push({ url, methode, rumpf: String(init.body) });
    }
    // C1: der PUT wartet an der Barriere — der Server hat ihn noch NICHT gesehen. Genau in diesem
    // Fenster tippt der Mensch weiter.
    if (putBarriere && methode === "PUT") {
      await putBarriere.warten;
    }
    // B1: das LADEN scheitert am Netz. Das ist der Fall, den der Auftrag nennt („ohne Netz") — und
    // er ist nicht derselbe wie ein sauberer 404: Ein Serverfehler TRAEGT eine Meldung, und
    // `errorMessage` zeigt dann diese statt des Rueckfalls. Der Rueckfall greift genau dann, wenn
    // der Fehler keine eigene Meldung hat — beim Netzfehler.
    if (getScheitertAmNetz && methode === "GET" && url.includes("/drafts/")) {
      throw new TypeError("Failed to fetch");
    }
    const antwort = await app.inject({
      method: methode as "GET",
      url,
      headers,
      ...(init?.body !== undefined && init.body !== null ? { payload: String(init.body) } : {}),
    });
    return {
      ok: antwort.statusCode >= 200 && antwort.statusCode < 300,
      status: antwort.statusCode,
      statusText: String(antwort.statusCode),
      text: async () => antwort.body,
    };
  }) as unknown as typeof globalThis.fetch;
  await serverStarten();
});

afterEach(() => {
  globalThis.fetch = vorherigerFetch;
  if (root) {
    act(() => root?.unmount());
    container.remove();
    root = null;
  }
});

describe("JOB 2705 · D1 — drei kleine Wege, auf denen Text verschwindet", () => {
  it("K0 — KALIBRIERUNG: der Server duennt die Auskunft wirklich aus, der Bestand bleibt heil", async () => {
    // Ohne diesen Fall misst A1 einen Mechanismus, den es vielleicht gar nicht gibt.
    const id = await entwurfAnlegen();

    const auskunft = await app.inject({
      method: "GET",
      url: `/api/drafts/${id}`,
      headers: kopf(),
    });
    const geliefert = JSON.parse(auskunft.body) as DraftAusBestand;
    expect(
      geliefert.payload.bodyHtml,
      "der Server duennt bei fehlendem Anker NICHT aus — dann traegt (a) nicht",
    ).toBeNull();

    // Und der echte Body liegt weiterhin in der Ablage: Es ist die AUSKUNFT, die duenn ist,
    // nicht der Bestand. Genau deshalb ist der Verlust in A1 vermeidbar.
    const roh = await roherEntwurf(id);
    expect(roh.payload.bodyHtml, "der gespeicherte Body ist schon vor dem Speichern weg").toBe(
      KOERPER,
    );

    // UND DIE LISTE DUENNT EBENSO AUS. Das ist mehr als eine Randnotiz: Es ist der Grund, warum
    // dieser Fall den Dienst direkt fragt. Ueber die API laesst sich „geloescht" nicht von „nicht
    // geliefert" unterscheiden — und genau diese Verwechslung ist der ganze Befund (a).
    const ausListe = (await bestand()).find((d) => d.id === id);
    expect(
      ausListe?.payload.bodyHtml,
      "die Liste duennt NICHT aus — dann waere die API ein gueltiger Messweg",
    ).toBeNull();
  });

  it("A1 — (a) EIN FEHLENDES ANKERDOKUMENT LOESCHT KEINEN TEXT", async () => {
    // Der Mensch oeffnet einen Entwurf, dessen Anhang geloescht wurde, und speichert ihn — etwa
    // weil er den Titel korrigiert. Er hat den Text nie angefasst; er hat ihn nicht einmal
    // GESEHEN, denn die Vordertuer bekam ihn ausgeduennt. Trotzdem war er danach fort.
    const id = await entwurfAnlegen();
    await seiteOeffnen(`/capture/frontdoor?draft=${id}`);

    const knopf = knopfMit(i18n.t("fd.saveDraft"));
    expect(knopf, `kein Speichern-Knopf. Sichtbar: ${seitentext().slice(0, 400)}`).toBeDefined();
    await klick(knopf as HTMLButtonElement);

    const nachher = await roherEntwurf(id);
    expect(
      nachher.payload.bodyHtml,
      "der Body ist weg — die Vordertuer hat einen Loeschmarker fuer Text geschickt, den sie nie bekommen hat",
    ).toBe(KOERPER);
  });

  it("B1 — (b) EIN LADEFEHLER SAGT, DASS NICHT GELADEN WERDEN KONNTE", async () => {
    // DER FALL IST DER NETZFEHLER, nicht der 404 — und diese Unterscheidung ist beim Bauen
    // aufgefallen, nicht vorher bekannt gewesen:
    //
    //   Ein sauberer 404 traegt eine Servermeldung. `errorMessage(e, rueckfall)` zeigt dann DIESE,
    //   und der Mensch liest etwas Zutreffendes — der Rueckfall kommt gar nicht zum Zug.
    //   Ein NETZFEHLER (`Failed to fetch`) traegt keine fachliche Meldung. Erst dann greift der
    //   Rueckfall, und der lautet heute `fd.errSaveFailed`: „Speichern fehlgeschlagen."
    //
    // Der Auftrag nennt genau diesen Fall („?draft= ohne Netz"). Gemessen wird er hier, indem die
    // Bruecke den Ladeaufruf am Netz scheitern laesst — der Server sieht nichts, wie im Betrieb.
    getScheitertAmNetz = true;
    const id = await entwurfAnlegen();
    await seiteOeffnen(`/capture/frontdoor?draft=${id}`);

    const sichtbar = seitentext();

    // (1) KEINE SPEICHER-MELDUNG. Sie stand als Rueckfall im Ladepfad und ist der genannte Befund.
    expect(
      sichtbar,
      `der Ladefehler meldet weiterhin die Speicher-Meldung — der Mensch sucht an der falschen Stelle. Sichtbar: ${sichtbar.slice(0, 500)}`,
    ).not.toContain(i18n.t("fd.errSaveFailed"));

    // (2) UND KEINE TECHNISCHE ROHMELDUNG — das ist die Zusicherung, die hier wirklich etwas
    //     belegt, und sie steht hier, weil (1) es NICHT tut:
    //
    //     Gemessen am Stand vor dem Fix war (1) bereits gruen. Der Rueckfall `fd.errSaveFailed`
    //     war naemlich unerreichbar: `errorMessage` nimmt bei JEDEM `Error` dessen eigene Meldung
    //     und faellt nur bei einem geworfenen Nicht-Error zurueck. Was der Mensch bei einem
    //     Netzfehler wirklich las, war „Failed to fetch" — englisch, technisch, ohne Aussage
    //     darueber, ob etwas gespeichert wurde.
    //
    //     Eine Negativprobe, die schon vor dem Fix gruen ist, belegt nichts. Diese hier faellt
    //     ohne den Fix.
    expect(
      sichtbar,
      "die technische Rohmeldung des Netzfehlers steht noch auf der Seite",
    ).not.toContain("Failed to fetch");

    // (2) UND EINE EHRLICHE STEHT DA. Ohne diese Zusicherung waere (1) auch dann gruen, wenn die
    //     Seite gar nichts mehr meldet — dann waere der Mensch schlechter dran als vorher.
    expect(
      sichtbar,
      `keine Fehlermeldung nach einem gescheiterten Laden. Sichtbar: ${sichtbar.slice(0, 500)}`,
    ).toContain(i18n.t("fd.errLoadFailed"));
  });

  it("C1 — (c) WER WAEHREND DES SPEICHERNS WEITERTIPPT, BEHAELT SEINEN TEXT", async () => {
    // ============================================================================================
    // DER ZEITABLAUF, den dieser Fall herstellt — und ohne die Barriere gaebe es ihn nicht:
    //   1. Der Mensch drueckt „Entwurf speichern". Der PUT geht raus und HAENGT.
    //   2. Waehrend er haengt, tippt der Mensch weiter.
    //   3. Der PUT kommt durch. `onSuccess` laeuft.
    //   4. Was jetzt passiert, ist der Gegenstand: Der bisherige Stand schrieb die AKTUELLEN
    //      Werte in `savedStateRef` — der neu getippte Text galt damit als gesichert, obwohl ihn
    //      niemand gespeichert hatte — und navigierte sofort weg.
    const id = await entwurfAnlegen();
    await seiteOeffnen(`/capture/frontdoor?draft=${id}`);

    let oeffnen: () => void = () => {};
    putBarriere = {
      warten: new Promise<void>((r) => {
        oeffnen = r;
      }),
      oeffnen: () => oeffnen(),
    };

    const knopf = knopfMit(i18n.t("fd.saveDraft"));
    expect(knopf, "kein Speichern-Knopf").toBeDefined();

    // Klicken, aber NICHT auf den Abschluss warten — der PUT haengt an der Barriere.
    await act(async () => {
      (knopf as HTMLButtonElement).click();
      await flush();
    });

    // Der Server hat den PUT noch nicht beantwortet, der Rumpf ist aber unterwegs. Ohne diese
    // Zusicherung koennte der Fall auch dann gruen sein, wenn gar nichts abgesendet wurde.
    const puts = gesendeteRumpfe.filter((r) => r.methode === "PUT");
    expect(puts.length, "es ist kein PUT abgesendet worden — der Fall misst nichts").toBe(1);

    // JETZT tippt der Mensch weiter.
    await tippen(titelfeld(), "Waehrend des Speicherns getippt");

    // Und erst danach kommt der PUT durch.
    await act(async () => {
      putBarriere?.oeffnen();
      await flush();
    });
    await act(flush);

    // (1) DER TEXT IST NOCH DA — sichtbar, auf der Flaeche, wo der Mensch ihn getippt hat.
    //     Das ist die Abnahme: nicht der Bestand, sondern was er vor sich sieht.
    const felder = [...container.querySelectorAll("input, textarea")].map(
      (f) => (f as HTMLInputElement).value,
    );
    expect(
      felder,
      `der waehrend des Speicherns getippte Text ist verschwunden. Felder: ${felder.join(" | ").slice(0, 300)}`,
    ).toContain("Waehrend des Speicherns getippt");

    // (2) UND ER GILT NICHT ALS GESICHERT. Der abgesendete Rumpf trug den ALTEN Titel; was
    //     danach getippt wurde, ist ungespeichert und muss es auch bleiben — sonst laesst die
    //     Seite den Menschen ohne Warnung weiterziehen.
    expect(
      puts[0]?.rumpf.includes("Waehrend des Speicherns getippt"),
      "der abgesendete Rumpf enthaelt bereits den spaeter getippten Text — dann misst der Fall den Zeitablauf nicht",
    ).toBe(false);
    const bestandNachher = (await bestand()).find((d) => d.id === id);
    expect(
      bestandNachher?.payload.title,
      "der spaeter getippte Titel ist im Bestand gelandet, obwohl er nie abgesendet wurde",
    ).toBe(ENTWURF_MIT_TOTEM_ANKER.title);
  });
});
