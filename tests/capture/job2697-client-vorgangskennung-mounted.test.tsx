// @vitest-environment jsdom
// ================================================================================================
// JOB 2697 · D7 · FALL 3 — DER LEBENSZYKLUS DER VORGANGSKENNUNG, AN DER ECHTEN VORDERTÜR.
// ================================================================================================
//
// DIE PRÜFLÜCKE, WÖRTLICH (`BEN-PRUEFUNG-JOB-2697-D5.md:17`):
//
//   „Clienttest am im Folgeauftrag konkret zu benennenden Speicher-Controller: Timeout,
//    Wiederholung derselben offenen Anlage, definitive 200/201-Antwort, 409 und neuer fachlicher
//    Speichervorgang. Erwartet: dieselbe `operationId` nur für den ungelösten Retry; nach
//    definitiver Antwort oder neuem Vorgang entsteht eine neue Kennung."
//
// ================================================================================================
// WAS HIER ECHT IST — UND WAS DER EINZIGE ERSATZ IST.
// ================================================================================================
//
// Die ECHTE Seite `CaptureFrontDoor` mit ihren echten Providern, der echte Speichern-Knopf über
// seine sichtbare Beschriftung, der echte Clientweg über `save.mutationFn`. Einziger Ersatz ist
// der Transport: `globalThis.fetch` liegt auf einer Attrappe, die die Antwort des Servers
// vorgibt UND jeden abgesendeten Rumpf mitschreibt. Bauform aus
// `tests/capture/job2695-vordertuer-loescht-nicht.test.tsx`.
//
// GEMESSEN WIRD, WELCHE KENNUNG WIRKLICH RAUSGEHT. Nicht, was ein Ref enthält — das wäre eine
// Aussage über den Speicher der Seite, nicht über das, was der Server sieht.
//
// ================================================================================================
// ZUR ABGRENZUNG DER GEGENMUTATIONEN (BENs Auflage an D6, hier eingehalten):
// ================================================================================================
//
// Die VERPFLICHTENDE Produkt-Gegenmutation ist eine andere und liegt woanders: sie entfernt
// ausschliesslich den atomaren Repo-Schutz und macht in
// `tests/capture/job2697-speichern-vorgangsschluessel.test.tsx` die Fälle E1/E5 rot (zwei
// persistierte, zwei gerenderte Einträge). Sie berührt diese Datei NICHT.
//
// Was hier unten als `C-MUT` steht, ist eine ZUSÄTZLICHE, GETRENNTE Client-Kalibrierungsmutation:
// die Kennung wird pro Klick neu erzeugt statt im Ref gehalten. Sie macht C1 und C2 rot und sonst
// nichts. Sie ersetzt die Produkt-Gegenmutation nicht und wird nicht mit ihr vermengt.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

process.env.KLARWERK_SKIP_KEYCHAIN = "1";

import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter, Route, Routes } from "../../apps/web/node_modules/react-router-dom";
// JOB 2697 D10: der ECHTE Clientabruf der Entwurfsliste — dasselbe `useDrafts`, das
// `apps/web/src/pages/Capture.tsx` benutzt, mit demselben Wiretyp und derselben Route.
import { useDrafts } from "../../apps/web/src/api/hooks";
import { AuthProvider } from "../../apps/web/src/app/AuthContext";
import { ImageDescribeProvider } from "../../apps/web/src/app/ImageDescribeContext";
import { NavGuardProvider } from "../../apps/web/src/app/NavGuardContext";
import { RoleProvider } from "../../apps/web/src/app/RoleContext";
import { ToastProvider } from "../../apps/web/src/app/ToastContext";
import i18n from "../../apps/web/src/i18n";
// JOB 2697 D8: die Frist, nach der der Client aufgibt — der Server arbeitet dann weiter. Genau
// dieses Fenster macht den zweiten Klick möglich (der Knopf ist bis dahin gesperrt).
import { FRONT_DOOR_SAVE_TIMEOUT_MS } from "../../apps/web/src/lib/captureFrontDoor";
import { Capture } from "../../apps/web/src/pages/Capture";
import { CaptureFrontDoor } from "../../apps/web/src/pages/CaptureFrontDoor";
// JOB 2697 D8: die ECHTE App und die ECHTE Ablage — ein Bestand für beide Klicks.
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { CaptureService } from "../../services/capture";
import { InMemoryDraftRepo } from "../../services/capture/src/repo";
import type { Draft } from "../../services/capture/src/types";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// ------------------------------------------------------------------------------------------------
// DIE ANTWORT-ATTRAPPE
// ------------------------------------------------------------------------------------------------
/** Was der nächste `POST /api/drafts` beantworten soll. */
type Antwort =
  | {
      art: "erfolg";
      status: 200 | 201;
      /**
       * Wenn gesetzt: der Mensch tippt WÄHREND der Server antwortet weiter. Das ist kein Kunstgriff,
       * sondern der Zustand aus JOB 2705 — und der einzige, in dem die Vordertür nach dem Erfolg
       * NICHT nach `/erfassen` navigiert. Nur so ist ein zweiter Speichervorgang auf derselben
       * Seite überhaupt beobachtbar.
       */
      tippenWaehrenddessen?: string;
    }
  | { art: "netzfehler" }
  | { art: "fehler"; status: number; code?: string; message?: string };

let naechsteAntwort: Antwort = { art: "erfolg", status: 201 };
/** Jeder abgesendete Anlage-Rumpf, in Reihenfolge. */
let gesendet: Array<Record<string, unknown>> = [];
let vorherigerFetch: typeof globalThis.fetch;
let container: HTMLDivElement;
let root: ReturnType<typeof createRoot> | null = null;
let laufendeNummer = 0;

const flush = () => new Promise((r) => setTimeout(r, 0));

function huelle() {
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
                { initialEntries: ["/capture/frontdoor"] },
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

/** Der Mensch tippt einen Titel — sonst ist der Speichern-Knopf gesperrt. */
async function titelTippen(text: string): Promise<void> {
  const feld = container.querySelector("input[type='text'], input:not([type])") as
    | HTMLInputElement
    | undefined;
  if (!feld) {
    throw new Error(`Kein Titelfeld gefunden. Sichtbar: ${seitentext().slice(0, 400)}`);
  }
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
    setter?.call(feld, text);
    feld.dispatchEvent(new Event("input", { bubbles: true }));
    await flush();
  });
  await act(flush);
}

/** Der Mensch drückt „Entwurf speichern". */
async function speichern(): Promise<void> {
  const knopf = knopfMit(i18n.t("fd.saveDraft"));
  if (!knopf) {
    throw new Error(
      `Speichern-Knopf „${i18n.t("fd.saveDraft")}" nicht gefunden. Sichtbar: ${seitentext().slice(0, 400)}`,
    );
  }
  await klick(knopf);
}

/** Die Kennungen der bisher abgesendeten Anlagen. */
const kennungen = (): Array<string | undefined> =>
  gesendet.map((r) => r.operationId as string | undefined);

beforeEach(async () => {
  await i18n.changeLanguage("de");
  gesendet = [];
  laufendeNummer = 0;
  naechsteAntwort = { art: "erfolg", status: 201 };
  vorherigerFetch = globalThis.fetch;
  globalThis.fetch = (async (eingabe: unknown, init?: RequestInit) => {
    const url = String(eingabe);
    const methode = (init?.method ?? "GET").toUpperCase();
    if (methode === "POST" && url.includes("/drafts") && !url.includes("promote")) {
      gesendet.push(JSON.parse(String(init?.body ?? "{}")));
      if (naechsteAntwort.art === "netzfehler") {
        // Kein Statuscode — genau der Fall „Ausgang unbekannt" aus createOperation.ts:90-92,
        // in den auch die Zeitüberschreitung mündet.
        throw new TypeError("Failed to fetch");
      }
      if (naechsteAntwort.art === "fehler") {
        const rumpf = JSON.stringify({
          error: naechsteAntwort.code ?? "BAD_REQUEST",
          message: naechsteAntwort.message ?? "abgelehnt",
        });
        return {
          ok: false,
          status: naechsteAntwort.status,
          statusText: "x",
          text: async () => rumpf,
        };
      }
      if (naechsteAntwort.tippenWaehrenddessen) {
        // Der Mensch tippt weiter, während der Server noch antwortet. Danach weicht das Formular
        // vom abgesendeten Stand ab, und die Seite bleibt stehen (JOB 2705).
        const feld = container.querySelector("input[type='text'], input:not([type])") as
          | HTMLInputElement
          | undefined;
        const setter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          "value",
        )?.set;
        if (feld) {
          setter?.call(feld, naechsteAntwort.tippenWaehrenddessen);
          feld.dispatchEvent(new Event("input", { bubbles: true }));
        }
      }
      laufendeNummer += 1;
      const rumpf = JSON.stringify({
        id: `d-${laufendeNummer}`,
        payload: { title: "Ventil" },
        originalAuthor: "u1",
        lastEditor: "u1",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      });
      return {
        ok: true,
        status: naechsteAntwort.status,
        statusText: "ok",
        text: async () => rumpf,
      };
    }
    // Alles andere (Sitzung, Listen) antwortet leer — die Seite braucht es nicht für diesen Fall.
    return { ok: true, status: 200, statusText: "ok", text: async () => "[]" };
  }) as unknown as typeof globalThis.fetch;

  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root?.render(huelle());
    await flush();
  });
  await act(flush);
});

afterEach(() => {
  globalThis.fetch = vorherigerFetch;
  if (root) {
    act(() => root?.unmount());
    container.remove();
    root = null;
  }
});

describe("JOB 2697 D7 · Fall 3 · der Lebenszyklus der Vorgangskennung", () => {
  it("C0 · der erste Klick schickt überhaupt eine Kennung mit", async () => {
    await titelTippen("Ventil");
    await speichern();

    expect(gesendet, "es wurde nichts abgesendet").toHaveLength(1);
    expect(kennungen()[0], "der Client schickt keine operationId").toBeTruthy();
  });

  it("C1 · UNGEKLÄRTER AUSGANG: nach einem Abbruch ohne Antwort trägt der zweite Klick DIESELBE Kennung", async () => {
    // Der Fall, für den es die Kennung gibt. Der Server kann angelegt haben oder nicht; ein neuer
    // Schlüssel erzeugte beim nächsten Klick einen zweiten Entwurf. Die Zeitüberschreitung mündet
    // in denselben Zweig (`createOperationIsSettled(undefined)` ist `false`).
    await titelTippen("Ventil");
    naechsteAntwort = { art: "netzfehler" };
    await speichern();
    naechsteAntwort = { art: "netzfehler" };
    await speichern();

    expect(gesendet).toHaveLength(2);
    expect(kennungen()[0]).toBeTruthy();
    expect(kennungen()[1], "der zweite Klick war ein NEUER Vorgang").toBe(kennungen()[0]);
  });

  it("C2 · WIEDERHOLUNG derselben offenen Anlage: auch der dritte Klick trägt sie", async () => {
    // Ohne diesen Fall wäre auch eine Fassung grün, die den Schlüssel genau einmal wiederverwendet.
    await titelTippen("Ventil");
    for (let i = 0; i < 3; i += 1) {
      naechsteAntwort = { art: "netzfehler" };
      await speichern();
    }

    expect(gesendet).toHaveLength(3);
    expect(new Set(kennungen()).size, "die Kennung wechselte zwischendurch").toBe(1);
  });

  it("C3 · DEFINITIVE ANTWORT: nach dem Erfolg ist der nächste Klick gar keine Anlage mehr", async () => {
    // ==========================================================================================
    // EIN BEFUND AUS DEM BAU, ausdrücklich benannt statt weggetestet.
    // ==========================================================================================
    // „Nach Erfolg bekommt der nächste Speichervorgang eine neue Kennung" ist auf DIESER Seite
    // nicht direkt beobachtbar — und zwar aus einem guten Grund: Mit dem Erfolg steht
    // `activeDraftId`, und jeder weitere Klick geht als `PUT /api/drafts/:id` über den
    // Aktualisierungsweg. Der adressiert den Entwurf über seine Id, ist von Haus aus wiederholbar
    // und trägt deshalb bewusst KEINE Vorgangskennung.
    //
    // Der Fall pinnt genau das: nach dem Erfolg entsteht KEIN zweiter Anlage-Aufruf. Das Leeren
    // des Refs in `onSuccess` bleibt trotzdem nötig und wird in C4 gemessen — dort, wo der Mensch
    // wirklich wieder anlegt.
    await titelTippen("Ventil");
    naechsteAntwort = { art: "erfolg", status: 201, tippenWaehrenddessen: "Ventil und Pumpe" };
    await speichern();

    const nachErstemErfolg = gesendet.length;
    naechsteAntwort = { art: "erfolg", status: 201 };
    await speichern();

    expect(gesendet.length, "es entstand ein zweiter Anlage-Aufruf statt eines Updates").toBe(
      nachErstemErfolg,
    );
  });

  it("C4 · NEUER FACHLICHER VORGANG: nach dem Neustart-Angebot trägt der nächste Klick eine NEUE Kennung", async () => {
    // Der Weg, auf dem ein Mensch in derselben Sitzung wirklich ein zweites Mal ANLEGT: Nach einem
    // Abdruckkonflikt bietet die Oberfläche den neuen Vorgang an (`createConflictOffersRestart`),
    // und er löst ihn aus. Der Knopf setzt `activeDraftId` und den Speichern-Schlüssel zurück —
    // hier wird gemessen, dass er das wirklich tut. Bliebe der alte Schlüssel stehen, liefe der
    // Mensch in denselben 409 zurück, aus dem er gerade herauswollte.
    await titelTippen("Ventil");
    naechsteAntwort = {
      art: "fehler",
      status: 409,
      code: "IDEMPOTENCY_PAYLOAD_MISMATCH",
      message: "Unter diesem Vorgang wurde bereits ein anderer Entwurf gespeichert.",
    };
    await speichern();

    const neustart = knopfMit(i18n.t("capture.restartOfferAction"));
    expect(neustart, "das Neustart-Angebot fehlt nach dem Abdruckkonflikt").toBeTruthy();
    await klick(neustart as HTMLButtonElement);

    naechsteAntwort = { art: "netzfehler" };
    await speichern();

    expect(gesendet).toHaveLength(2);
    expect(kennungen()[1], "der neue Vorgang trägt die alte Kennung").not.toBe(kennungen()[0]);
    expect(kennungen()[1]).toBeTruthy();
  });

  it("C5 · 409: die Kennung bleibt stehen — sie wird nicht hinter dem Rücken ersetzt", async () => {
    // `createOperationIsSettled(409)` ist `false` (`createOperation.ts:93-95`). Ein stiller Ersatz
    // verwandelte einen erkannten Konflikt in eine zweite Anlage, ohne dass jemand zugestimmt
    // hätte. Die Oberfläche BIETET den neuen Vorgang an; der Mensch löst ihn aus.
    await titelTippen("Ventil");
    naechsteAntwort = {
      art: "fehler",
      status: 409,
      code: "IDEMPOTENCY_PAYLOAD_MISMATCH",
      message: "Unter diesem Vorgang wurde bereits ein anderer Entwurf gespeichert.",
    };
    await speichern();
    naechsteAntwort = { art: "netzfehler" };
    await speichern();

    expect(gesendet).toHaveLength(2);
    expect(kennungen()[1], "der 409 hat die Kennung still ersetzt").toBe(kennungen()[0]);
  });

  it("C6 · KALIBRIERUNG: ein anderes 4xx lässt die Kennung FALLEN", async () => {
    // Ohne diesen Fall wäre auch eine Fassung grün, die den Schlüssel NIE fallen lässt — dann
    // hinge jeder spätere Entwurf am ersten Vorgang. `createOperationIsSettled(400)` ist `true`.
    await titelTippen("Ventil");
    naechsteAntwort = { art: "fehler", status: 400, code: "BAD_REQUEST", message: "kaputt" };
    await speichern();
    naechsteAntwort = { art: "netzfehler" };
    await speichern();

    expect(gesendet).toHaveLength(2);
    expect(kennungen()[1], "nach einer eindeutigen Ablehnung blieb die alte Kennung").not.toBe(
      kennungen()[0],
    );
  });

  it("C7 · die Kennung reist NEBEN der Nutzlast, nicht in ihr", async () => {
    await titelTippen("Ventil");
    await speichern();

    const rumpf = gesendet[0] ?? {};
    expect(rumpf.operationId).toBeTruthy();
    expect(rumpf.title, "der Titel fehlt im Rumpf").toBeTruthy();
    // Sie steht auf oberster Ebene, nicht verschachtelt in einem payload-Objekt.
    expect(Object.hasOwn(rumpf, "payload")).toBe(false);
  });
});

// ================================================================================================
// JOB 2697 · D8 — DIE GEKOPPELTE KETTE: Klick, Server, Ablage, Abruf, gerenderte Liste.
// ================================================================================================
//
// DIE AUFLAGE, WÖRTLICH (`BEN-PRUEFUNG-JOB-2697-D7.md:16`):
//
//   „Das echte `CaptureFrontDoor` mounten, den ersten Speichern-Klick nach Handler-Eintritt an der
//    Repo-Barriere halten, den zweiten Klick auslösen, beide Requests über `app.inject` bis in
//    denselben Repo-Bestand führen, anschließend die echte `CaptureDraftList` aus genau diesem
//    Bestand rendern. Erwartet im Produktstand: eine persistierte Zeile, ein gerenderter
//    Blattknoten und dieselbe Entwurfs-ID in beiden Antworten."
//
// ================================================================================================
// WARUM DIESE GRUPPE ÜBERHAUPT NÖTIG IST — BEN hat einen echten Mangel gefunden.
// ================================================================================================
//
// D7 hatte ZWEI grüne Tests und hielt ihre gegenseitige Unabhängigkeit für einen Beleg. BEN dreht
// das um, und er hat recht: „Dass die Repo-Mutation den Clienttest nicht trifft, zeigt, dass
// dieser nicht bis zur Ablage reicht. Dass die Clientmutation den Überlappungstest nicht trifft,
// zeigt, dass dieser nicht vom wirklichen `saveOperationRef` abhängt."
//
// Die Gruppe oben misst den Client gegen eine ANTWORT-ATTRAPPE — kein Server, keine Ablage.
// `job2697-speichern-vorgangsschluessel.test.tsx` misst Server und Ablage über `app.inject` — ohne
// Client. Dazwischen lag die Lücke. Hier ist sie geschlossen: EIN Bestand, EIN Weg, von der
// Maustaste bis zum gerenderten Text.
//
// ================================================================================================
// WIE DER ZWEITE KLICK ÜBERHAUPT MÖGLICH WIRD — der reale Ablauf, nicht ein Kunstgriff.
// ================================================================================================
//
// Der Speichern-Knopf ist während des Sendens gesperrt (`canSave = hasSavableContent && !busy`,
// `CaptureFrontDoor.tsx:821`). Ein zweiter Klick ist also nur möglich, wenn der erste Aufruf für
// den Client BEENDET ist — und genau das ist der beauftragte Fall: Der Client läuft in seine
// Zeitüberschreitung (`withFrontDoorSaveTimeout`, 30 s), meldet den Fehler, gibt den Knopf frei —
// und der Server arbeitet trotzdem weiter. Die Kennung bleibt dabei stehen, weil der Ausgang
// unbekannt ist (`createOperationIsSettled(undefined)` ist `false`).
//
// Die 30 Sekunden werden mit Fake-Timern übersprungen. Das ist keine Fälschung des Ablaufs,
// sondern seine Beschleunigung: die Reihenfolge der Ereignisse bleibt exakt die beauftragte.
/** Die echte Ablage mit einer steuerbaren Barriere VOR der Persistenz — Bauform aus D7. */
class BarrierenAblage extends InMemoryDraftRepo {
  /** Wie oft ein Handler die Persistenz ERREICHT hat. */
  eintritte = 0;
  private freigabe: (() => void) | null = null;
  private tor: Promise<void> | null = null;
  /** (a) Die Produktmutation: der Vorgangsweg legt unbedingt an. */
  ohneAtomarenSchutz = false;

  sperren(): void {
    this.tor = new Promise<void>((aufloesen) => {
      this.freigabe = aufloesen;
    });
  }

  freigeben(): void {
    this.freigabe?.();
    this.tor = null;
    this.freigabe = null;
  }

  override async insertIfOperationAbsent(draft: Draft) {
    this.eintritte += 1;
    if (this.tor) {
      await this.tor;
    }
    if (this.ohneAtomarenSchutz) {
      await this.insert(draft);
      return { angelegt: true as const, draft };
    }
    return super.insertIfOperationAbsent(draft);
  }
}

describe("JOB 2697 D8 · die gekoppelte Kette", () => {
  let ablage: BarrierenAblage;
  let app: ReturnType<typeof buildApp>;
  let token = "";
  const rumpfe: Array<Record<string, unknown>> = [];
  /** Die echte Listenkomponente, erst zur Laufzeit geladen (sie zieht viele Web-Module nach). */
  // JOB 2703 D2 (Mitfuehrung 2697 D10): der ECHTE Komponententyp statt des losen
  // `Parameters‹typeof createElement›[0]` — mit dem losen Typ nahm createElement die Attributes-
  // Ueberladung und wies `drafts` zurueck (tsx-Typenlauf des Tors rot).
  let CaptureDraftListGeladen:
    | typeof import("../../apps/web/src/components/CaptureDraftList")["CaptureDraftList"]
    | null = null;

  /** Der eine Bestand, durch den BEIDE Klicks laufen. */
  async function echteAppAufsetzen(): Promise<void> {
    ablage = new BarrierenAblage();
    app = buildApp({ ...buildServices(), capture: new CaptureService({ repo: ablage }) });
    await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { name: "Anna", email: "a@x.de", password: "secret123" },
    });
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "a@x.de", password: "secret123" },
    });
    token = String(login.json().token);
  }

  beforeEach(async () => {
    // Der äussere Aufbau hat eine Antwort-Attrappe gesetzt und die Seite gemountet. Hier wird
    // beides ersetzt: echte App statt Attrappe, frischer Mount auf derselben Brücke.
    if (root) {
      act(() => root?.unmount());
      container.remove();
      root = null;
    }
    rumpfe.length = 0;
    await echteAppAufsetzen();

    // DIE BRÜCKE: jeder Client-Aufruf geht über `app.inject` in denselben Bestand. Kein
    // vorgetäuschter Server, keine zweite Ablage.
    globalThis.fetch = (async (eingabe: unknown, init?: RequestInit) => {
      const url = String(eingabe);
      const methode = (init?.method ?? "GET").toUpperCase();
      const kopf: Record<string, string> = { authorization: `Bearer ${token}` };
      new Headers(init?.headers as HeadersInit | undefined).forEach((wert, name) => {
        kopf[name] = wert;
      });
      if (methode === "POST" && url.includes("/drafts") && !url.includes("promote")) {
        rumpfe.push(JSON.parse(String(init?.body ?? "{}")));
      }
      const antwort = await app.inject({
        method: methode as "GET",
        url: url.replace(/^https?:\/\/[^/]+/, ""),
        headers: kopf,
        ...(init?.body !== undefined && init?.body !== null ? { payload: String(init.body) } : {}),
      });
      return {
        ok: antwort.statusCode >= 200 && antwort.statusCode < 300,
        status: antwort.statusCode,
        statusText: String(antwort.statusCode),
        text: async () => antwort.body,
      };
    }) as unknown as typeof globalThis.fetch;

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    await act(async () => {
      root?.render(huelle());
      await flush();
    });
    await act(flush);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  /**
   * Der beauftragte Ablauf: erster Klick hängt an der Barriere, Zeitüberschreitung gibt den Knopf
   * frei, zweiter Klick geht mit DERSELBEN Kennung los, danach Freigabe.
   */
  async function zweiKlicksMitBarriere(): Promise<void> {
    await titelTippen("Ventil bei Überdruck");
    ablage.sperren();

    vi.useFakeTimers({ shouldAdvanceTime: true });
    await speichern();
    // Der erste Aufruf steht IM Handler und VOR der Persistenz.
    await vi.waitFor(() => expect(ablage.eintritte).toBe(1), { timeout: 3000 });
    expect(await ablage.list(), "es wurde bereits geschrieben").toHaveLength(0);

    // Die Zeitüberschreitung des Clients — der Server arbeitet weiter.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(FRONT_DOOR_SAVE_TIMEOUT_MS + 100);
      await flush();
    });
    vi.useRealTimers();
    await act(flush);

    // Jetzt ist der Knopf wieder frei: der zweite Klick des Menschen.
    await speichern();
    await vi.waitFor(() => expect(ablage.eintritte).toBe(2), { timeout: 3000 });

    ablage.freigeben();
    await act(flush);
    await act(flush);
  }

  // ==============================================================================================
  // JOB 2697 D10 — DIE RUECKKETTE, ECHT: Repo -> Listenroute -> Wiretyp -> useDrafts -> Renderer.
  // ==============================================================================================
  //
  // WAS HIER VORHER STAND, UND WARUM ES ZU WENIG WAR: `listeAusDemselbenBestand()` holte die
  // Entwuerfe mit `ablage.list()` und gab sie `CaptureDraftList` als Eigenschaft. Damit waren drei
  // Glieder uebersprungen. BEN zu D8: „ein Defekt der Listenroute, ihres Wiretyps, der
  // Query-Funktion oder `useDrafts` könnte bestehen, während der D8-Test weiterhin grün bliebe."
  //
  // JETZT laeuft der Abruf ueber DIESELBE App wie die Klicks:
  //
  //     GET /api/drafts            services/app/src/routes/capture-routes.ts   (echte Route)
  //     -> api.get(…"/drafts")     apps/web/src/api/endpoints.ts               (echter Wiretyp)
  //     -> useDrafts()             apps/web/src/api/hooks.ts                   (echter Clientabruf)
  //     -> CaptureDraftList        apps/web/src/components/CaptureDraftList.tsx (echter Renderer)
  //
  // DER ABRUF LAEUFT MIT DERSELBEN SITZUNG wie die Klicks. Die Route filtert mit
  // `visibleDraftsFor(user, …)` — mit einer anderen Sitzung kaeme eine leere Liste zurueck, und
  // der Fall waere aus dem falschen Grund rot.
  //
  // EIGENER QueryClient MIT `staleTime: 0` und `gcTime: 0`: Der Abruf muss wirklich stattfinden
  // und darf nicht aus einem Cache beantwortet werden, den ein frueherer Mount gefuellt hat.
  //
  // DIE VERDRAHTUNG HOOK-ZU-KOMPONENTE ist die eine Zeile aus `Capture.tsx` (`drafts.data ?? []`).
  // Sie steht hier in `EchteListe`, weil das gemountete `Capture` fuer diesen Fall eine sehr grosse
  // Seite mit vielen fremden Abhaengigkeiten waere; alle vier Glieder der Kette sind echt.
  function EchteListe(): JSX.Element | null {
    const drafts = useDrafts();
    if (!CaptureDraftListGeladen) {
      return null;
    }
    return createElement(CaptureDraftListGeladen, {
      drafts: drafts.data ?? [],
      isAdmin: false,
      directory: [],
      open: true,
      onToggleOpen: () => undefined,
      scopeLabel: "",
      highlightId: null,
      // JOB 2703 D2 (Mitfuehrung 2697 D10): die sechs Pflicht-Props von `CaptureDraftListProps`
      // (Zeiger b4b0c12, CaptureDraftList.tsx:47-52) fehlten — der .tsx-Typenlauf des Tors
      // (tsconfig.tests-tsx.json) war damit rot, auch in PRO2s eigenem Klon. Neutrale Werte, kein
      // Verhalten geaendert; vitest lief ohne Typenpruefung schon vorher gruen.
      editingId: null,
      confirmDiscardId: null,
      onConfirmDiscard: () => undefined,
      discardPending: false,
      onDiscard: () => undefined,
      onResume: () => undefined,
    });
  }

  /** Ruft die Liste ueber die ECHTE Kette ab und rendert die echte Komponente. */
  async function listeUeberDieEchteKette(): Promise<{ persistiert: number; gerendert: number }> {
    const modul = await import("../../apps/web/src/components/CaptureDraftList");
    CaptureDraftListGeladen = modul.CaptureDraftList;
    const qc = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: 0, gcTime: 0 } },
    });
    const behaelter = document.createElement("div");
    document.body.appendChild(behaelter);
    const wurzel = createRoot(behaelter);
    await act(async () => {
      wurzel.render(
        createElement(
          QueryClientProvider,
          { client: qc },
          createElement(MemoryRouter, null, createElement(EchteListe)),
        ),
      );
      await flush();
    });
    await act(flush);
    const gerendert = [...behaelter.querySelectorAll("*")].filter(
      (el) => el.children.length === 0 && (el.textContent ?? "").includes("Ventil bei Überdruck"),
    ).length;
    await act(async () => {
      wurzel.unmount();
    });
    behaelter.remove();
    // Die Persistenz wird weiterhin direkt an der Ablage gemessen — sie ist die zweite,
    // unabhaengige Zahl der Matrix und darf nicht am selben Abruf haengen wie die erste.
    const persistiert = (await ablage.list()).length;
    return { persistiert, gerendert };
  }

  it("K1 · NORMALSTAND: zwei Klicks, EIN persistierter und EIN gerenderter Entwurf", async () => {
    // ==========================================================================================
    // DIE EINZIGE ZEILE DER MATRIX, DIE IM NORMALSTAND GRUEN IST — und sie traegt genau EINE
    // Rolle.
    // ==========================================================================================
    // D9 hat hier einen zusaetzlichen Fall K4 vorgesehen, der den unterbrochenen Listenabruf als
    // EIGENEN gruenen Fall fuehrte UND zugleich Mutation C sein sollte. Beides zusammen geht
    // nicht, und genau daran ist D9 rot geworden (derselbe Fehlertyp wie in D6).
    //
    // ES GIBT DESHALB KEIN K4. Mutation C ist ein LAUF, kein Fall: Sie unterbricht
    // `GET /api/drafts` und laesst dabei GENAU DIESE Zusicherung fallen — `gerendert` geht auf 0,
    // waehrend `persistiert` 1 bleibt. Das ist der Beweis, dass hier die Anzeige gemessen wird
    // und nicht die Datenbank.
    await zweiKlicksMitBarriere();

    // Beide Requests sind wirklich gelaufen.
    expect(rumpfe, "es gingen nicht zwei Anlage-Aufrufe raus").toHaveLength(2);
    expect(rumpfe[0]?.operationId, "der Client schickte keine Kennung").toBeTruthy();

    // DIE ABNAHME: beide Zahlen in EINER Zusicherung, damit jeder rote Lauf sie zusammen zeigt.
    // Stuende eine andere Zusicherung davor, braeche der rote Lauf dort ab und die geforderten
    // Zahlen stuenden nirgends — gemessen in D7, wo Mutation (b) zuerst an der Kennungspruefung
    // abbrach.
    const stand = await listeUeberDieEchteKette();
    expect(stand).toEqual({ persistiert: 1, gerendert: 1 });

    // Und danach der Grund: beide Klicks trugen DIESELBE Kennung.
    expect(rumpfe[1]?.operationId, "der zweite Klick war ein NEUER Vorgang").toBe(
      rumpfe[0]?.operationId,
    );
  });

  it("K2 · beide Serverantworten nennen DIESELBE Entwurfs-Id", async () => {
    // Ohne diese Zusicherung wäre K1 auch dann grün, wenn der zweite Aufruf gescheitert wäre statt
    // den bestehenden Entwurf zu bekommen.
    await zweiKlicksMitBarriere();

    const gespeichert = await ablage.list();
    expect(gespeichert).toHaveLength(1);
    const id = gespeichert[0]?.id;
    expect(id).toBeTruthy();
    const abruf = await app.inject({
      method: "GET",
      url: "/api/drafts",
      headers: { authorization: `Bearer ${token}` },
    });
    const liste = abruf.json() as Array<{ id: string }>;
    expect(
      liste.filter((d) => d.id === id),
      "der Abruf liefert den Entwurf mehrfach",
    ).toHaveLength(1);
  });

  it("K3 · der Eintrittszähler belegt die Überlappung — nicht nur zwei Klicks", async () => {
    // Ohne ihn bewiese K1 nur, dass zwei Aufrufe abgeschickt wurden; nicht, dass der erste im
    // Server noch stand, als der zweite losging.
    await titelTippen("Ventil bei Überdruck");
    ablage.sperren();

    vi.useFakeTimers({ shouldAdvanceTime: true });
    await speichern();
    await vi.waitFor(() => expect(ablage.eintritte).toBe(1), { timeout: 3000 });

    const eintritteVorZweitemKlick = ablage.eintritte;
    const zeilenVorZweitemKlick = (await ablage.list()).length;

    await act(async () => {
      await vi.advanceTimersByTimeAsync(FRONT_DOOR_SAVE_TIMEOUT_MS + 100);
      await flush();
    });
    vi.useRealTimers();
    await act(flush);
    await speichern();
    await vi.waitFor(() => expect(ablage.eintritte).toBe(2), { timeout: 3000 });

    expect(eintritteVorZweitemKlick, "der erste Handler war noch nicht in der Ablage").toBe(1);
    expect(zeilenVorZweitemKlick, "es war schon geschrieben, als der zweite Klick kam").toBe(0);

    ablage.freigeben();
    await act(flush);
    expect(await ablage.list()).toHaveLength(1);
  });
});
