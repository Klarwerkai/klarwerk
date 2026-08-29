// @vitest-environment jsdom
// ================================================================================================
// JOB 2695 · D5 — WAS DIE VORDERTUER NICHT FUEHRT, DARF SIE NICHT LOESCHEN
// ================================================================================================
//
// PEDIS FRAGE:  „Verliert mein Entwurf etwas, wenn ich ihn in der anderen Flaeche oeffne?"
//
// DER BEFUND (Review R2-19), an DIESEM Klon nachgemessen (R27 — die Zeilen des Reviews stammen aus
// `71d3c2b`, dieser Klon steht auf `ae4dc8e`):
//
//   `buildFrontDoorPayload` (apps/web/src/lib/captureFrontDoor.ts:106) sendet fuer JEDEN geladenen
//   Entwurf `type`, `category`, `tags: []`, `conditions: []`, `measures: []` und
//   `origin: "frontdoor"`. Der Merge liest mitgeschickte Leerwerte als LOESCHUNG und sagt das
//   selbst (services/capture/src/service.ts:371-372, in diesem Klon nachgeschlagen):
//
//       Schluessel NICHT mitgeschickt (oder Wert `undefined`) ⇒ Altwert bleibt.
//       Schluessel mitgeschickt mit LEERWERT ([], "", …)      ⇒ Altwert geht.
//
//   Die Vordertuer laedt aber JEDE `?draft=` aus der URL, nicht nur ihre eigenen.
//
// WARUM F2 BIS INS STUDIO GEHT: D1 rief `resumeTargetForDraft` direkt auf — ein Vertragstest fuer
// die Zielwahl, kein Beleg, dass der Entwurf im Studio wirklich laedt und seine Massnahmen dort
// erscheinen. BEN zu D1: „die Abnahme endet vor dem tatsaechlichen Studio-Aufruf".
//
// WARUM F5 HIER STEHT — der Fund aus D3, und er ist der Grund, warum dieser Bau nicht nur ein
// Weglassen ist: Derselbe Payload-Bauer bedient ZWEI Wege. `submitFrontDoorDraft` schickt sein
// Ergebnis als `draftPayload` ins Promote, und dort wird daraus ein Wissensobjekt. Schrumpft der
// Payload auch dort, antwortet die Route `400 INCOMPLETE` — Pedis Einreichen-Knopf, gestern erst
// gruen geworden, waere kaputt. In D1 fiel das nicht auf, weil die pruefende Testdatei auf jenem
// Klonstand fehlte. Sie liegt hier (tests/capture/job2656-d4-einreichen-knopf-mounted.test.tsx),
// und F5 pinnt die Trennung zusaetzlich am Vertrag — in DERSELBEN Datei, damit der Schutz nicht an
// einer fremden haengt.
//
// WAS HIER ECHT IST: beide echten Seiten (`CaptureFrontDoor`, `Capture`) mit ihren echten
// Providern, die echten Knoepfe ueber ihre sichtbaren Beschriftungen, der echte Clientweg, die
// echte Fastify-Anwendung mit echter Persistenz. Einziger Ersatz ist der Transport:
// `globalThis.fetch` liegt auf `app.inject`. Bauform aus `mega20-capture-submit-mounted.test.tsx`.
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
// `Capture` HOLT sich den Weg zur Bildbeschreibung aus diesem Kontext (mega50 Block A). Ohne den
// Provider rendert die Seite GERAEUSCHLOS gar nichts — kein Fehler, keine Konsole. Genau das ist
// in D3 passiert: F2 meldete `expected '' to contain 'Maßnahmen'`, und der leere Seitentext sah
// aus wie ein Fehler der Zielwahl. Die Vordertuer braucht ihn nicht, deshalb faellt es erst hier auf.
import { ImageDescribeProvider } from "../../apps/web/src/app/ImageDescribeContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { buildFrontDoorPayload } from "../../apps/web/src/lib/captureFrontDoor";
import { Capture } from "../../apps/web/src/pages/Capture";
import { CaptureFrontDoor } from "../../apps/web/src/pages/CaptureFrontDoor";
import { buildApp, buildServices } from "../../services/app/src/build-app";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};
(globalThis as unknown as { scrollTo: () => void }).scrollTo = () => {};

// ------------------------------------------------------------------------------------------------
// DER PRUEFFALL: ein Studio-Entwurf, wie ihn das gefuehrte Studio anlegt.
// ------------------------------------------------------------------------------------------------
const MASSNAHMEN = ["Absperrhahn schliessen", "Druck auf null ablassen"];
const BEDINGUNGEN = ["Anlage steht still", "Zwei Personen anwesend"];
const STUDIO_ENTWURF = {
  title: "Pumpe entlueften",
  statement: "Vor dem Entlueften wird die Anlage druckfrei gemacht.",
  bodyHtml: "<p>Die Entlueftung folgt der Betriebsanweisung.</p>",
  type: "sop",
  category: "Instandhaltung",
  tags: ["pumpe", "wartung"],
  conditions: BEDINGUNGEN,
  measures: MASSNAHMEN,
  origin: "studio",
  // Eine gespeicherte Stufe: Ohne sie zeigt die Vordertuer einen Pflicht-Platzhalter
  // („Vertraulichkeit bestaetigen", CaptureFrontDoor.tsx). Der Wert aendert NICHTS an der
  // Vertraulichkeitssemantik — er ist der Normalfall eines Studio-Entwurfs.
  confidentiality: "intern",
};

let app: FastifyInstance;
let token = "";
let vorherigerFetch: typeof globalThis.fetch;

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
  const services = buildServices();
  app = buildApp(services);
  await app.ready();
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Pedi", email: "pedi@job2695.test", password: "geheim12345" },
  });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "pedi@job2695.test", password: "geheim12345" },
  });
  token = (JSON.parse(login.body) as { token: string }).token;
}

interface DraftAusBestand {
  id: string;
  payload: {
    title?: string;
    conditions?: string[];
    measures?: string[];
    tags?: string[];
    type?: string;
    category?: string;
    origin?: string;
  };
}

async function bestand(): Promise<DraftAusBestand[]> {
  const res = await app.inject({ method: "GET", url: "/api/drafts", headers: kopf() });
  return JSON.parse(res.body);
}

async function studioEntwurfAnlegen(): Promise<string> {
  const res = await app.inject({
    method: "POST",
    url: "/api/drafts",
    headers: kopf(),
    payload: JSON.stringify(STUDIO_ENTWURF),
  });
  expect(res.statusCode, `Entwurf nicht angelegt: ${res.body.slice(0, 300)}`).toBe(201);
  return (JSON.parse(res.body) as { id: string }).id;
}

// ------------------------------------------------------------------------------------------------
// FLAECHE
// ------------------------------------------------------------------------------------------------
let container: HTMLDivElement;
let root: ReturnType<typeof createRoot> | null = null;

/**
 * Die Providerhuelle beider Seiten. `pfad` bestimmt nur den Einstieg — die Routen stehen fest,
 * damit die Navigation der Vordertuer nach `/erfassen` nicht ins Leere laeuft.
 */
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
                // BEIDE Routen in EINER Huelle — und das ist keine Bequemlichkeit, sondern der
                // echte Weg: Die Vordertuer navigiert nach erfolgreichem Speichern SELBST nach
                // `/erfassen` (`CaptureFrontDoor.tsx`, onSuccess des Speicherns, mit
                // `state.frontDoorDraftSaved`). Mit nur einer Route liefe dieser Wechsel ins Leere.
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

/** Was React beim Rendern an die Konsole gab — die einzige Spur, wenn eine Seite leer bleibt. */
const renderKlagen: string[] = [];

async function seiteOeffnen(pfad: string): Promise<void> {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  const vorher = console.error;
  console.error = (...args: unknown[]) => {
    renderKlagen.push(
      args
        .map((a) => String(a))
        .join(" ")
        .slice(0, 300),
    );
  };
  try {
    await act(async () => {
      root?.render(huelle(pfad));
      await flush();
    });
    await act(flush);
  } finally {
    console.error = vorher;
  }
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

/** Der Mensch drueckt in der Vordertuer „Entwurf speichern". */
async function inVordertuerSpeichern(): Promise<void> {
  const knopf = knopfMit(i18n.t("fd.saveDraft"));
  if (!knopf) {
    throw new Error(
      `Speichern-Knopf „${i18n.t("fd.saveDraft")}" nicht gefunden. Sichtbar: ${seitentext().slice(0, 500)}`,
    );
  }
  expect(knopf.disabled, "der Speichern-Knopf ist gesperrt").toBe(false);
  await klick(knopf);
}

beforeEach(async () => {
  await i18n.changeLanguage("de");
  vorherigerFetch = globalThis.fetch;
  globalThis.fetch = (async (eingabe: unknown, init?: RequestInit) => {
    const url = String(eingabe);
    const headers: Record<string, string> = {};
    new Headers(init?.headers).forEach((wert, name) => {
      headers[name] = wert;
    });
    if (token) {
      headers.authorization = `Bearer ${token}`;
    }
    const antwort = await app.inject({
      method: (init?.method ?? "GET") as "GET",
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

describe("JOB 2695 · D5 — was eine Flaeche nicht fuehrt, darf sie nicht loeschen", () => {
  it("K0 — KALIBRIERUNG: der Studio-Entwurf liegt vollstaendig im Bestand", async () => {
    // Ohne diesen Fall maessen F1 und F2 einen Verlust, den es nie gab.
    await studioEntwurfAnlegen();
    const vorher = (await bestand())[0];
    expect(vorher?.payload.measures).toEqual(MASSNAHMEN);
    expect(vorher?.payload.conditions).toEqual(BEDINGUNGEN);
    expect(vorher?.payload.origin).toBe("studio");
  });

  it("F1 — DER BESTAND: nach dem Speichern in der Vordertuer stehen Massnahmen, Bedingungen und Herkunft unveraendert", async () => {
    const id = await studioEntwurfAnlegen();
    await seiteOeffnen(`/capture/frontdoor?draft=${id}`);
    expect(seitentext(), "der Entwurf wurde nicht geoeffnet").toContain("Betriebsanweisung");

    await inVordertuerSpeichern();

    const nachher = (await bestand())[0];
    expect(
      nachher?.payload.measures,
      "die Massnahmen sind beim Speichern in der Vordertuer verschwunden",
    ).toEqual(MASSNAHMEN);
    expect(nachher?.payload.conditions, "die Bedingungen sind verschwunden").toEqual(BEDINGUNGEN);
    expect(nachher?.payload.tags, "die Schlagworte sind verschwunden").toEqual(["pumpe", "wartung"]);
    expect(nachher?.payload.type, "der Typ wurde ueberschrieben").toBe("sop");
    expect(nachher?.payload.category, "die Kategorie wurde ueberschrieben").toBe("Instandhaltung");
    expect(nachher?.payload.origin, "der Entwurf hat die Herkunft gewechselt").toBe("studio");
  });

  it("F2 — DER DURCHSTICH BIS INS STUDIO: nach dem Speichern oeffnet der Entwurf im Studio, und die Massnahmen stehen SICHTBAR da", async () => {
    // ============================================================================================
    // DAS IST DIE ABNAHME, und sie geht ueber F1 hinaus: Nicht der Bestand wird gemessen, sondern
    // was ein Mensch SIEHT, wenn er den Entwurf wieder aufmacht. BEN zu D1: der direkte Aufruf von
    // `resumeTargetForDraft` ist „kein Beleg dafuer, dass der persistierte Entwurf ueber den
    // realen Fortsetzen-Weg im Studio geladen und seine Massnahmen dort gerendert werden".
    //
    // DIE KETTE, die hier wirklich laeuft (Zeilen an DIESEM Klon nachgeschlagen):
    //   Capture.tsx  CaptureDraftList mit onResume={loadDraft}
    //   CaptureDraftList.tsx  der Knopf „Fortsetzen"
    //   Capture.tsx  resumeTargetForDraft → bei `frontdoor` VERLAESST die Seite das Studio
    //   Capture.tsx  measures: p.measures ?? []
    //   Capture.tsx  ListEditor mit label={t("capture.fMeasures")} und items={draft.measures}
    //
    // BEIDE HALBSCHAEDEN LAUFEN IN DER ZIELWAHL ZUSAMMEN: Haette der Entwurf beim Speichern seine
    // Herkunft verloren, schickte ihn die Seite zurueck in die Vordertuer — der Mensch kaeme nie
    // im Studio an, und die Frage nach den Massnahmen stellte sich gar nicht.
    const id = await studioEntwurfAnlegen();

    // DER SPEICHERSCHRITT LAEUFT HIER UEBER DEN CLIENTWEG, NICHT UEBER DEN KNOPF — und das ist
    // eine bewusste Trennung, keine Abkuerzung:
    //
    //   F1 oben belegt GEMOUNTET, dass der echte Speichern-Knopf genau diesen Weg nimmt und was
    //   danach im Bestand steht. Dieser Fall misst die andere Haelfte: was ein Mensch SIEHT, wenn
    //   er den Entwurf im Studio wieder aufmacht. Dafuer braucht es einen zweiten Mount, und zwei
    //   Mounts in einem Fall haben in D3 geraeuschlos 0 Zeichen ergeben (gemessen; `Capture`
    //   allein mountet einwandfrei, mit einem eigenen Diagnosefall belegt).
    //
    // Der Rumpf ist deshalb NICHT nachgebaut, sondern kommt aus `buildFrontDoorPayload` — genau
    // der Funktion, die der Knopf aufruft. Waere er hier von Hand geschrieben, pruefte der Fall
    // eine Nachbildung statt des Produkts.
    const rumpf = buildFrontDoorPayload({
      title: STUDIO_ENTWURF.title,
      bodyHtml: STUDIO_ENTWURF.bodyHtml,
      confidentiality: "intern",
      activeDraftId: id,
    });
    const put = await app.inject({
      method: "PUT",
      url: `/api/drafts/${id}`,
      headers: kopf(),
      payload: JSON.stringify(rumpf),
    });
    expect(put.statusCode, `Speichern fehlgeschlagen: ${put.body.slice(0, 200)}`).toBe(200);

    await seiteOeffnen("/erfassen");

    // Die Entwurfsliste startet EINGEKLAPPT (`Capture.tsx`, `useState(false)`) — ohne diesen
    // Klick gibt es keinen „Fortsetzen"-Knopf, und der Fall scheiterte an der Suche statt an der
    // Sache. Bauform aus `tests/capture/draft-save-fullstate-mounted.test.tsx`.
    const aufklappen = knopfMit("Entwürfe anzeigen") ?? knopfMit("Entwuerfe anzeigen");
    if (aufklappen) {
      await klick(aufklappen);
    }

    const fortsetzen = knopfMit(i18n.t("capture.resume"));
    expect(
      fortsetzen,
      `kein „${i18n.t("capture.resume")}"-Knopf in der Entwurfsliste. Sichtbar: ${seitentext().slice(0, 600)}`,
    ).toBeDefined();
    await klick(fortsetzen as HTMLButtonElement);

    // Den Abschnitt aufklappen, in dem Bedingungen und Massnahmen stehen. Er ist im Studio
    // standardmaessig zugeklappt und traegt die Zahl seiner Eintraege im Titel — nach dem
    // Fortsetzen stand dort bereits „Kernaussage, Bedingungen & Maßnahmen 4", also zwei
    // Bedingungen und zwei Massnahmen. Sichtbar sind sie aber erst nach diesem Klick, und die
    // Abnahme fragt nach dem, was der Mensch SIEHT.
    if (!seitentext().includes(MASSNAHMEN[0] as string)) {
      const abschnitt =
        knopfMit(i18n.t("capture.fMeasures")) ?? knopfMit(i18n.t("capture.advanced.title"));
      if (abschnitt) {
        await klick(abschnitt);
      }
    }

    const sichtbar = seitentext();

    // (1) DER MENSCH IST IM STUDIO ANGEKOMMEN — nicht in der Vordertuer. Das ist der
    //     Herkunfts-Nachweis am VERHALTEN statt am Vertrag; er ersetzt den direkten
    //     `resumeTargetForDraft`-Aufruf aus D1.
    expect(
      sichtbar,
      `die Massnahmen-Flaeche des Studios fehlt — der Fortsetzen-Weg ist nicht im Studio gelandet.\nSichtbar (${sichtbar.length} Zeichen): ${sichtbar.slice(0, 400)}\nRenderklagen: ${renderKlagen.slice(-3).join(" || ")}`,
    ).toContain(i18n.t("capture.fMeasures"));

    // (2) DIE MASSNAHMEN STEHEN IM WORTLAUT DA. Beide, nicht nur ihre Anzahl.
    //
    // GELESEN WIRD AUS DEN EINGABEFELDERN, nicht aus dem Text: Der `ListEditor` des Studios
    // rendert jeden Eintrag als `input`, und `textContent` erfasst dessen `value` nicht. In D3
    // sah das aus wie ein Datenverlust — sichtbar war „Bedingungen Eintrag hinzufügen", waehrend
    // der Abschnittszaehler bereits „4" zeigte. Die Werte waren da, nur nicht im `textContent`.
    const feldwerte = [...container.querySelectorAll("input, textarea")]
      .map((f) => (f as HTMLInputElement).value)
      .filter((v) => v.length > 0);
    const feldtext = feldwerte.join(" | ");

    for (const m of MASSNAHMEN) {
      expect(
        feldwerte,
        `die Massnahme „${m}" steht nicht im Studio. Felder: ${feldtext.slice(0, 300)}`,
      ).toContain(m);
    }

    // (3) UND DIE BEDINGUNGEN EBENSO.
    for (const b of BEDINGUNGEN) {
      expect(
        feldwerte,
        `die Bedingung „${b}" steht nicht im Studio. Felder: ${feldtext.slice(0, 300)}`,
      ).toContain(b);
    }

    // (4) KEINE VORDERTUER. Ohne diese Zusicherung koennte (2) gruen sein, weil der Editor der
    //     Vordertuer dieselben Felder zeigt — der Mensch waere dann gerade NICHT im Studio.
    //
    //     GEPRUEFT WIRD `fd.draftOpen` („Vordertür-Entwurf geöffnet …"), ein Satz, den NUR die
    //     Vordertuer fuehrt. Ein Ausschluss auf `fd.submitReview` waere falsch: „Prüfen &
    //     einreichen" steht auch im Studio, und der Fall faellt dann, obwohl alles stimmt —
    //     in D3 genau so gemessen.
    expect(
      sichtbar,
      "die Vordertuer ist offen — der Entwurf hat die Herkunft gewechselt",
    ).not.toContain(i18n.t("fd.draftOpen"));
  });

  it("F3 — WAS DIE VORDERTUER FUEHRT, SCHREIBT SIE SEHR WOHL: der geaenderte Titel kommt an", async () => {
    // Die Gegenrichtung: Der Fix darf nicht dazu fuehren, dass die Vordertuer gar nichts mehr
    // speichert. Sonst waeren F1 und F2 gruen und das Speichern kaputt.
    const id = await studioEntwurfAnlegen();
    await seiteOeffnen(`/capture/frontdoor?draft=${id}`);

    const feld = [...container.querySelectorAll("input")].find(
      (i) => i.value === STUDIO_ENTWURF.title,
    );
    expect(feld, "kein Titelfeld mit dem geladenen Titel gefunden").toBeDefined();
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
    await act(async () => {
      setter?.call(feld as HTMLInputElement, "In der Vordertuer umbenannt");
      (feld as HTMLInputElement).dispatchEvent(new Event("input", { bubbles: true }));
      await flush();
    });

    await inVordertuerSpeichern();

    const nachher = (await bestand())[0];
    expect(nachher?.payload.title, "der geaenderte Titel kam nicht an").toBe(
      "In der Vordertuer umbenannt",
    );
    expect(nachher?.payload.measures, "und die Massnahmen stehen trotzdem noch").toEqual(MASSNAHMEN);
  });

  it("F4 — DER NEUANLAGE-WEG BLEIBT VOLLSTAENDIG, am Vertrag gemessen", () => {
    // Bestandsschutz: Beim Neuanlegen gibt es keinen Altwert, den ein Leerwert loeschen koennte —
    // und ein neuer Entwurf braucht Typ, Kategorie und Herkunft, sonst entstuende er ohne
    // Einordnung.
    const neu = buildFrontDoorPayload({ title: "Frisch", bodyHtml: "<p>Text</p>" }) as Record<
      string,
      unknown
    >;
    expect(neu.type, "der Neuanlage-Weg verliert den Typ").toBe("best_practice");
    expect(neu.category, "der Neuanlage-Weg verliert die Kategorie").toBe("Allgemein");
    expect(neu.origin, "der Neuanlage-Weg verliert die Herkunft").toBe("frontdoor");

    // Und der Aenderungsweg fuehrt genau die Felder NICHT mehr, die den Verlust verursacht haben.
    const geaendert = buildFrontDoorPayload({
      title: "Bestehend",
      bodyHtml: "<p>Text</p>",
      activeDraftId: "d-1",
    }) as Record<string, unknown>;
    for (const feld of ["type", "category", "tags", "conditions", "measures", "origin"]) {
      expect(
        Object.hasOwn(geaendert, feld),
        `der Aenderungsweg sendet weiterhin „${feld}" und loescht damit den Altwert`,
      ).toBe(false);
    }
    expect(geaendert.title).toBe("Bestehend");
    expect(
      geaendert.statement,
      "die Aussage fehlt — die fuehrt die Vordertuer sehr wohl",
    ).toBeDefined();
  });

  it("F5 — DER EINREICHEN-WEG BLEIBT VOLLSTAENDIG, auch ueber einen bestehenden Entwurf", () => {
    // ============================================================================================
    // DER FUND AUS D3, und er ist der Grund, warum dieser Bau nicht bloss ein Weglassen ist.
    //
    // `submitFrontDoorDraft` baut seinen Rumpf mit DERSELBEN Funktion und schickt ihn als
    // `draftPayload` ins Promote — dort entsteht daraus ein Wissensobjekt. Schrumpfte der Payload
    // auch auf diesem Weg, antwortete die Route:
    //
    //     400 {"error":"INCOMPLETE","message":"Entwurf hat noch keine vollständigen
    //                                          KO-Pflichtfelder."}
    //
    // Gemessen in D3 an `tests/capture/job2656-d4-einreichen-knopf-mounted.test.tsx`. In D1 war
    // der Bruch unsichtbar, weil jene Datei auf dem damaligen Klonstand fehlte — und ich hatte
    // den Effekt dort sogar als Verbesserung beschrieben. Das war falsch.
    //
    // DIE TRENNUNG, die der Fix zieht — zwei Fragen, die vorher dieselbe waren:
    //     ueberBestand  · reist der Payload ueber einen vorhandenen Entwurf?  (Loeschmarker fuer
    //                     einen bewusst geleerten Body, mega7 Block A)
    //     nurEigene     · soll er auf die Felder dieser Flaeche schrumpfen?   (NUR beim SPEICHERN)
    //
    // Dieser Fall pinnt die zweite Frage am Vertrag: Mit `vollstaendig: true` — dem Schalter, den
    // `submitFrontDoorDraft` setzt — bleibt der Payload vollstaendig, OBWOHL eine `activeDraftId`
    // vorliegt.
    const einreichen = buildFrontDoorPayload({
      title: "Bestehend",
      bodyHtml: "<p>Text</p>",
      activeDraftId: "d-1",
      vollstaendig: true,
    }) as Record<string, unknown>;

    expect(einreichen.type, "das Promote bekaeme keinen Typ und antwortete 400 INCOMPLETE").toBe(
      "best_practice",
    );
    expect(einreichen.category, "das Promote bekaeme keine Kategorie").toBe("Allgemein");
    expect(einreichen.origin, "die Herkunft fehlt beim Einreichen").toBe("frontdoor");

    // Und der Loeschmarker richtet sich weiterhin nach dem BESTAND, nicht nach diesem Schalter:
    // beide Fragen sind getrennt, und genau das ist der Fix.
    const ueberBestandGeleert = buildFrontDoorPayload({
      title: "Bestehend",
      bodyHtml: "",
      activeDraftId: "d-1",
      vollstaendig: true,
    }) as Record<string, unknown>;
    expect(
      Object.hasOwn(ueberBestandGeleert, "bodyHtml"),
      "der ausdrueckliche Leerwert fuer einen geleerten Body reist nicht mehr mit (mega7 Block A)",
    ).toBe(true);
  });
});
