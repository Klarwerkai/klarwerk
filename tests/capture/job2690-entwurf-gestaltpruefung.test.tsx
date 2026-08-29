// @vitest-environment jsdom
// ================================================================================================
// JOB 2690 · D1 — EIN ENTWURF MIT EINER ZAHL STATT EINES TEXTES
// ================================================================================================
//
// PEDIS FRAGE:  „Sagt mir Klara, was an meiner Eingabe nicht stimmt?"
//
// DER BEFUND (Review R2-16), an diesem Klon nachgemessen:
//
//   `POST /api/drafts` (capture-routes.ts:242-258) und `PUT /api/drafts/:id` (:411-431) reichen
//   `request.body` OHNE Gestaltpruefung an `createDraft`/`continueDraft`. Beide Routen haben ein
//   `bodyLimit`, aber kein Schema. Die vorhandene Pruefung `validateDraftPayloadShape` laeuft NUR
//   beim Promote (:567).
//
// ZWEI FOLGEN, beide hier gemessen:
//   * `bodyHtml: 5` passiert `sanitizeDraftPayload` ungesehen — die Funktion steigt bei
//     `typeof payload.bodyHtml !== "string"` sofort aus (service.ts:139-141) — und landet im Pool.
//   * `PUT` mit `null` laeuft in `Object.entries(changes)` (service.ts:381) → TypeError →
//     maskierter 500 statt einer Auskunft.
//
// WAS HIER ECHT IST: die echte Fastify-Anwendung mit allen Routen, Rechten und der echten
// Persistenz; die echte Seite `pages/CaptureFrontDoor.tsx` samt ihren echten Providern; der echte
// Clientweg. Der EINZIGE Ersatz ist der Transport: `globalThis.fetch` liegt auf `app.inject`.
// Bauform woertlich aus `tests/capture/mega20-capture-submit-mounted.test.tsx`; sie ist hier
// zusaetzlich zwingend, weil die Bahn-Sandbox keinen Horchsocket zulaesst (`listen EPERM`).
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
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
import { CaptureFrontDoor } from "../../apps/web/src/pages/CaptureFrontDoor";
import { buildApp, buildServices } from "../../services/app/src/build-app";

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
Element.prototype.scrollIntoView = () => {};
(globalThis as unknown as { scrollTo: () => void }).scrollTo = () => {};

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
    payload: { name: "Pedi", email: "pedi@job2690.test", password: "geheim12345" },
  });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "pedi@job2690.test", password: "geheim12345" },
  });
  token = (JSON.parse(login.body) as { token: string }).token;
}

/** Der Bestand, beim Server erfragt — nicht aus Aufrufen abgeleitet. */
async function entwuerfe(): Promise<{ id: string; payload: Record<string, unknown> }[]> {
  const res = await app.inject({ method: "GET", url: "/api/drafts", headers: kopf() });
  return JSON.parse(res.body);
}

/**
 * Der Rumpf, den ein fremder Client schickt — als ROHER TEXT, nicht als Objekt.
 * Das ist der Punkt: `payload` mit einem Objektliteral wuerde von Fastify serialisiert; hier soll
 * exakt das ueber die Leitung gehen, was der Befund beschreibt, `null` eingeschlossen.
 */
const roh = (text: string) => ({ payload: text, headers: kopf() });

// ------------------------------------------------------------------------------------------------
// FLAECHE
// ------------------------------------------------------------------------------------------------
let container: HTMLDivElement;
let root: ReturnType<typeof createRoot> | null = null;

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

describe("JOB 2690 · D1 — die Gestaltpruefung am Rand, nicht in der Tiefe", () => {
  it("K0 — KALIBRIERUNG: ein GUELTIGER Entwurf wird unveraendert angenommen", async () => {
    // Ohne diesen Fall koennte die Pruefung alles abweisen und die Faelle unten waeren aus dem
    // falschen Grund gruen. Er ist zugleich der Bestandsschutz: der normale Weg bleibt offen.
    const res = await app.inject({
      method: "POST",
      url: "/api/drafts",
      ...roh(JSON.stringify({ title: "Pumpe entlueften", bodyHtml: "<p>Erst absperren.</p>" })),
    });
    expect(res.statusCode, res.body).toBe(201);
    expect(await entwuerfe()).toHaveLength(1);
  });

  it("F1 — POST mit `bodyHtml: 5`: 400 mit lesbarer Meldung, und NICHTS landet im Bestand", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/api/drafts",
      ...roh(JSON.stringify({ title: "Kaputt", bodyHtml: 5 })),
    });

    // (1) Der Statuscode ist die Auskunft „deine Eingabe", nicht „unser Fehler".
    expect(res.statusCode, `Antwort: ${res.body}`).toBe(400);

    // (2) UND ES STEHT ETWAS DRIN, das ein Mensch lesen kann. Ein blosser 400 ohne Meldung
    //     erfuellt die Abnahme nicht — sie verlangt ausdruecklich „nicht nur einen Statuscode".
    const koerper = JSON.parse(res.body) as { error?: string; message?: string };
    expect(koerper.error).toBe("BAD_REQUEST");
    expect(koerper.message, "die Ablehnung nennt keinen Grund").toBeTruthy();
    // Sie benennt das FELD, um das es geht — sonst muesste der Mensch raten.
    expect(koerper.message, `Meldung: „${koerper.message}"`).toContain("bodyHtml");

    // (3) DER BESTAND BLEIBT SAUBER. Das ist der eigentliche Schaden des Befunds: Bis hierher
    //     landete der kaputte Entwurf im Pool und wurde erst an der Vordertuer zum Problem.
    expect(
      await entwuerfe(),
      "der fehlerhafte Entwurf ist trotz Ablehnung im Bestand gelandet",
    ).toHaveLength(0);
  });

  it("F2 — PUT mit `null`: 400 statt maskiertem 500", async () => {
    const angelegt = await app.inject({
      method: "POST",
      url: "/api/drafts",
      ...roh(JSON.stringify({ title: "Bestehend", bodyHtml: "<p>Text</p>" })),
    });
    const id = (JSON.parse(angelegt.body) as { id: string }).id;

    const res = await app.inject({ method: "PUT", url: `/api/drafts/${id}`, ...roh("null") });

    // DER KERN DIESES FALLS: `Object.entries(null)` wirft einen TypeError, und der ging bis hierher
    // als 500 nach aussen — ein Serverfehler fuer eine Nutzereingabe. Das ist die Maskierung.
    expect(res.statusCode, `Antwort: ${res.body}`).not.toBe(500);
    expect(res.statusCode, `Antwort: ${res.body}`).toBe(400);
    const koerper = JSON.parse(res.body) as { error?: string; message?: string };
    expect(koerper.message, "die Ablehnung nennt keinen Grund").toBeTruthy();

    // Und der bestehende Entwurf ist unversehrt — eine abgewiesene Aenderung aendert nichts.
    const nachher = await entwuerfe();
    expect(nachher).toHaveLength(1);
    expect(nachher[0]?.payload?.title).toBe("Bestehend");
  });

  it("F3 — PUT mit `bodyHtml: 5` auf einen bestehenden Entwurf: 400, und der Altstand bleibt heil", async () => {
    const angelegt = await app.inject({
      method: "POST",
      url: "/api/drafts",
      ...roh(JSON.stringify({ title: "Heil", bodyHtml: "<p>Guter Text</p>" })),
    });
    const id = (JSON.parse(angelegt.body) as { id: string }).id;

    const res = await app.inject({
      method: "PUT",
      url: `/api/drafts/${id}`,
      ...roh(JSON.stringify({ bodyHtml: 5 })),
    });
    expect(res.statusCode, `Antwort: ${res.body}`).toBe(400);

    // DIE STILLE FOLGE, die ohne diesen Fall unbemerkt bliebe: Vor der Pruefung wurde die Zahl
    // gemerged und persistiert — der Entwurf trug danach eine Zahl als Body. Hier bleibt er heil.
    const nachher = await entwuerfe();
    expect(nachher[0]?.payload?.bodyHtml, "die Zahl wurde in den Bestand geschrieben").toBe(
      "<p>Guter Text</p>",
    );
  });

  it("F4 — DER ERFOLGSFALL an der Flaeche: ein gueltiger Entwurf oeffnet sich ohne Fehlerkasten (KEIN Beleg fuer die Fehlermeldung — das ist F5)", async () => {
    // DER NAME IST IN D2 KORRIGIERT, und der Grund gehoert hierher. BEN zu D1, woertlich:
    //
    //   „F4 oeffnet einen gueltigen Entwurf erfolgreich und prueft nur, dass `fd.errSaveFailed`
    //    dann nicht im DOM steht. Dieser Erfolgsfall loest weder einen 400-Fehler noch
    //    `ApiError`/`errorMessage` noch die Darstellung der Server-`message` aus und kann deshalb
    //    die behauptete sichtbare Fehlermeldung nicht belegen."
    //
    // Das ist richtig. Der Fall taugt als BESTANDSSCHUTZ — der gute Weg bleibt offen und still —
    // und fuer nichts sonst. Der Fehlerfall steht in F5 darunter.
    //
    // WAS DIESER FALL BELEGT, und was nicht: Der Schaden des Befunds entstand AN DER VORDERTUER —
    // ein Entwurf mit `bodyHtml: 5` liess `payload.bodyHtml?.trim()` (captureFrontDoor.ts:100)
    // werfen, und der Mensch sah nur einen roten Kasten „Speichern fehlgeschlagen." ohne Grund.
    //
    // Nach der Pruefung am Rand kann dieser Entwurf NICHT MEHR ENTSTEHEN (F1). Die Flaechenwirkung
    // ist deshalb eine Abwesenheit, und die wird hier gemessen: Der gute Entwurf oeffnet sich,
    // sein Text steht im Editor, und es gibt keinen Fehlerkasten.
    const angelegt = await app.inject({
      method: "POST",
      url: "/api/drafts",
      ...roh(
        JSON.stringify({ title: "Pumpe entlueften", bodyHtml: "<p>Erst absperren, dann pruefen.</p>" }),
      ),
    });
    const id = (JSON.parse(angelegt.body) as { id: string }).id;

    await vordertuerOeffnen(id);
    const sichtbar = (container.textContent ?? "").replace(/\s+/g, " ");

    // (1) Der Entwurf ist wirklich geladen — sonst maesse die Abwesenheit des Fehlers nichts.
    expect(sichtbar, `der Entwurf wurde nicht geoeffnet. Sichtbar: ${sichtbar.slice(0, 400)}`)
      .toContain("Erst absperren");

    // (2) Und kein Fehlerkasten. `fd.errSaveFailed` ist der Text, den der Befund als das benennt,
    //     was der Mensch statt einer Begruendung zu sehen bekam.
    expect(sichtbar, "die Vordertuer meldet einen Fehler, den es nicht gibt").not.toContain(
      i18n.t("fd.errSaveFailed"),
    );
  });

  it("F5 — DER FEHLERFALL, gemountet: Speichern schlaegt fehl, und im roten Kasten steht die SERVERMELDUNG statt „Speichern fehlgeschlagen\"", async () => {
    // ============================================================================================
    // DIE VIER STATIONEN DES AUFTRAGS, in dieser Reihenfolge und ohne Ersatz:
    //   1. Ein Mensch drueckt in der Vordertuer auf Speichern.
    //   2. Der Clientabruf bekommt eine Fehlerantwort MIT `message` vom echten Server.
    //   3. Daraus entsteht `ApiError` → `errorMessage` (CaptureFrontDoor.tsx:70-74).
    //   4. Der rote Kasten (`:1218`) zeigt DIESEN Satz — nicht den Rueckfall `fd.errSaveFailed`.
    //
    // WARUM DER FEHLER HIER EIN 404 IST UND KEIN 400 — gemessen, nicht gewaehlt:
    // Der Auftrag nennt „den Fall aus F1, aber ueber die Oberflaeche". Diesen Fall kann die
    // Vordertuer NICHT ausloesen, und das ist keine Nachlaessigkeit, sondern eine Eigenschaft des
    // Produkts: `buildFrontDoorPayload` (apps/web/src/lib/captureFrontDoor.ts:106-135) baut JEDES
    // Feld selbst — `title` und `statement` aus `deriveFrontDoorTitle`/`frontDoorStatement`,
    // `type`/`category`/`origin` als feste Zeichenketten, `tags`/`conditions`/`measures` als leere
    // Listen. Ein gestaltfehlerhafter Rumpf entsteht dort nicht; der Nutzer hat keinen Hebel dafuer.
    // Einen zu erzwingen hiesse, den Payload-Bauer zu ersetzen — dann pruefte der Fall die
    // Faelschung statt die Kette. Genau davor warnt die Abnahme („kein Scheinbeleg").
    //
    // Gemessen wird deshalb DIESELBE KETTE an einem Fehler, den der Nutzer wirklich ausloesen kann:
    // Er hat einen Entwurf offen, der inzwischen nicht mehr existiert (geloescht, oder von einem
    // anderen Geraet weggeraeumt), und drueckt Speichern. Der Server antwortet mit Kennung UND
    // Meldung; Station 2 bis 4 sind Zeichen fuer Zeichen dieselben wie beim 400 aus F1, weil
    // `errorMessage` nach `ApiError` fragt und nicht nach dem Statuscode.
    // Dass der Gestaltfehler-400 ebenfalls eine `message` traegt, belegen F1, F2 und F3 am Draht.
    const angelegt = await app.inject({
      method: "POST",
      url: "/api/drafts",
      ...roh(JSON.stringify({ title: "Gleich weg", bodyHtml: "<p>Ein Satz.</p>" })),
    });
    const id = (JSON.parse(angelegt.body) as { id: string }).id;

    await vordertuerOeffnen(id);
    expect(container.textContent ?? "", "der Entwurf wurde nicht geoeffnet").toContain("Ein Satz.");

    // Der Entwurf verschwindet, waehrend der Mensch ihn offen hat.
    // OHNE `content-type` — ein DELETE hat keinen Rumpf, und Fastify weist einen als JSON
    // angekuendigten leeren Rumpf mit 400 ab (in diesem Durchgang gemessen).
    const geloescht = await app.inject({
      method: "DELETE",
      url: `/api/drafts/${id}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect([200, 204], `Loeschen: ${geloescht.statusCode}`).toContain(geloescht.statusCode);

    // STATION 1 — der Mensch drueckt Speichern. Gesucht wird der Knopf ueber seine SICHTBARE
    // Beschriftung, nicht ueber eine Testmarke.
    const knopf = [...container.querySelectorAll("button")].find((b) =>
      (b.textContent ?? "").replace(/\s+/g, " ").includes(i18n.t("fd.saveDraft")),
    );
    expect(knopf, `Speichern-Knopf „${i18n.t("fd.saveDraft")}" nicht gefunden`).toBeDefined();
    expect(
      (knopf as HTMLButtonElement).disabled,
      "der Speichern-Knopf ist gesperrt — es gaebe nichts auszuloesen",
    ).toBe(false);
    await act(async () => {
      (knopf as HTMLButtonElement).click();
      await flush();
    });
    await act(flush);

    const sichtbar = (container.textContent ?? "").replace(/\s+/g, " ");

    // STATION 4 — DIE SERVERMELDUNG STEHT AM SCHIRM. Das ist der Zweck des ganzen Durchgangs:
    // In D1 hat der Server gelernt, einen lesbaren Satz zu schicken; hier steht, dass er ankommt.
    const servermeldung = "Entwurf nicht gefunden.";
    expect(
      sichtbar,
      `die Servermeldung steht nicht im roten Kasten. Sichtbar: ${sichtbar.slice(0, 600)}`,
    ).toContain(servermeldung);

    // UND NICHT DER RUECKFALL. „Speichern fehlgeschlagen." ist genau der nichtssagende Satz, den
    // der Befund als Schaden benennt — er darf hier nicht stehen, sonst waere nichts gewonnen.
    expect(
      sichtbar,
      "der rote Kasten zeigt den nichtssagenden Rueckfall statt der Servermeldung",
    ).not.toContain(i18n.t("fd.errSaveFailed"));

    // KALIBRIERUNG DES AUSSCHLUSSES: Die beiden Saetze sind wirklich verschieden — sonst waere die
    // Zeile darueber auch dann gruen, wenn der Rueckfall zufaellig denselben Wortlaut haette.
    expect(i18n.t("fd.errSaveFailed")).not.toBe(servermeldung);
  });
});
