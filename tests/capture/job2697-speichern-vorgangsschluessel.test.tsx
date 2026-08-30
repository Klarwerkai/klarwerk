import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
// @vitest-environment jsdom
// ================================================================================================
// JOB 2697 · D7 · FALL 1 — ZWEI KLICKS, EIN ENTWURF. Gemessen bis zum gerenderten Eintrag.
// ================================================================================================
//
// PEDIS FRAGE: „Kann ich jetzt zweimal auf Speichern klicken, ohne dass zwei Entwuerfe entstehen?"
//
// DIE PRÜFLÜCKE, WÖRTLICH (`BEN-PRUEFUNG-JOB-2697-D5.md:15`):
//
//   „Den ersten Handler innerhalb von Route oder Service nach nachgewiesenem Eintritt und vor der
//    Persistenz an einer steuerbaren Barriere halten; erst danach den zweiten Klick senden.
//    Erwartet: Der Eintrittszähler steht vor dem zweiten Klick auf eins, beide Serverpromises sind
//    vor der Freigabe offen, danach existieren genau eine Zeile und ein gerenderter Listeneintrag.
//    Gegenmutation ohne atomaren Repo-Schutz: zwei Zeilen beziehungsweise zwei Listeneinträge."
//
// ================================================================================================
// WO DIE BARRIERE SITZT — UND WARUM NICHT MEHR VOR `app.inject`.
// ================================================================================================
//
// D5 setzte sie in die Fetch-Brücke VOR `app.inject`. BEN dazu: „dort hat die Serverbearbeitung
// noch nicht begonnen … Eine Barriere vor `app.inject` misst nur einen ausstehenden
// Client-/Brückenaufruf." Das trifft zu.
//
// SIE SITZT JETZT AN DER ABLAGE. `buildApp` nimmt den `CaptureService` als Abhängigkeit; der Test
// gibt ihm eine Ablage, die bei `insertIfOperationAbsent` einen Eintrittszähler erhöht und dann
// wartet. Steht der Zähler auf 1, hat der erste Aufruf `app.inject`, den Fastify-Handler,
// `guards.requirePermission`, `validateDraftPayloadShape` und `CaptureService.createDraftVorgang`
// bereits durchlaufen — er steht IM Handler und VOR der Persistenz. Genau die Kante aus dem Urteil.
//
// KEIN SCHALTER IM PRODUKTIONSCODE: Der Dekorator lebt in dieser Datei. Ein Testhaken in Route
// oder Dienst wäre eine Zeile, die nur für den Test existiert — und der nächste Befund.
// Die Web-Pakete liegen in `apps/web/node_modules`, nicht in der Wurzel — deshalb der explizite
// Pfad, genau wie in `tests/capture/job2695-vordertuer-loescht-nicht.test.tsx:46`. Ein blosser
// Paketname lässt die Datei gar nicht erst laden („0 test"), und ein kaputtes Testgerüst ist
// keine Messung.
import {
  QueryClient,
  QueryClientProvider,
} from "../../apps/web/node_modules/@tanstack/react-query";
import { act, createElement } from "../../apps/web/node_modules/react";
import { createRoot } from "../../apps/web/node_modules/react-dom/client";
import { MemoryRouter } from "../../apps/web/node_modules/react-router-dom";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { CaptureService } from "../../services/capture";
import { InMemoryDraftRepo } from "../../services/capture/src/repo";
import type { Draft } from "../../services/capture/src/types";

type App = ReturnType<typeof buildApp>;

// React erwartet diese Marke, sonst warnt `act()` bei jedem Mount. Kosmetik, aber eine Warnung,
// die man wegdrückt, ist eine Warnung, die man beim nächsten Mal übersieht.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** Der Titel, an dem der gerenderte Eintrag gezählt wird. */
const TITEL = "Ventil bei Überdruck";

// ================================================================================================
// DIE BARRIERE — sie hält den Handler an, sie täuscht ihn nicht vor.
// ================================================================================================
class BarrierenAblage extends InMemoryDraftRepo {
  /** Wie oft ein Handler die Persistenz ERREICHT hat. Das ist der Eintrittszähler. */
  eintritte = 0;
  private freigabe: (() => void) | null = null;
  private tor: Promise<void> | null = null;
  /** Wenn `true`, geht der Vorgangsweg am Schutz vorbei — die verpflichtende Gegenmutation. */
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
      // ==========================================================================================
      // DIE VERPFLICHTENDE PRODUKT-GEGENMUTATION: NUR der atomare Schutz fällt weg.
      // ==========================================================================================
      // Der Vorgang wird weiterhin am Entwurf gespeichert, die Kennung reist weiterhin mit, der
      // Client verhält sich unverändert. Einzig die Bedingung „gibt es diesen Vorgang schon?"
      // entfällt — also genau das, was der partielle Unique-Index in PostgreSQL erzwingt.
      await this.insert(draft);
      return { angelegt: true as const, draft };
    }
    return super.insertIfOperationAbsent(draft);
  }
}

let ablage: BarrierenAblage;
let app: App;
const gesendeteRumpfe: Array<Record<string, unknown>> = [];

// Die Brücke: der Client redet mit der ECHTEN App. Sie hält NICHTS auf — die Barriere liegt
// im Server, nicht hier. Das ist der Unterschied zu D5.
const bruecke = vi.hoisted(() => ({ app: null as unknown as App, rumpfe: [] as unknown[] }));

vi.stubGlobal("fetch", async (url: string | URL | Request, init?: RequestInit) => {
  const pfad = typeof url === "string" ? url : url.toString();
  const method = (init?.method ?? "GET").toUpperCase();
  const payload = init?.body ? JSON.parse(String(init.body)) : undefined;
  if (method === "POST" && pfad.includes("/api/drafts")) {
    bruecke.rumpfe.push(payload);
  }
  const res = await bruecke.app.inject({
    method: method as "GET",
    url: pfad.replace(/^https?:\/\/[^/]+/, ""),
    headers: init?.headers as Record<string, string>,
    payload,
  });
  return new Response(res.body, {
    status: res.statusCode,
    headers: { "content-type": "application/json" },
  });
});

async function baueApp(): Promise<{ headers: Record<string, string> }> {
  ablage = new BarrierenAblage();
  const services = buildServices();
  app = buildApp({ ...services, capture: new CaptureService({ repo: ablage }) });
  bruecke.app = app;
  bruecke.rumpfe.length = 0;
  gesendeteRumpfe.length = 0;
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
  return { authorization: `Bearer ${login.json().token}` } as unknown as {
    headers: Record<string, string>;
  };
}

beforeEach(async () => {
  await baueApp();
});

afterEach(() => {
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

/**
 * Wartet, bis die Bedingung gilt — oder scheitert mit einer Aussage darüber, was fehlte.
 *
 * Eigenbau statt `waitFor` aus der Testing Library: die gibt es in diesem Projekt nicht
 * (`@testing-library/react` ist weder in der Wurzel noch unter `apps/web` installiert; das Haus
 * mountet mit `createRoot`/`act`). Zehn Millisekunden Takt reichen: gewartet wird auf einen
 * Microtask-Fortschritt im selben Prozess, nicht auf Netz.
 */
async function warteBis(bedingung: () => boolean, was: string, grenzeMs = 2000): Promise<void> {
  const ende = Date.now() + grenzeMs;
  while (Date.now() < ende) {
    if (bedingung()) {
      return;
    }
    await new Promise((r) => setTimeout(r, 10));
  }
  throw new Error(`Zeitüberschreitung beim Warten darauf, dass ${was}`);
}

describe("JOB 2697 D7 · Fall 1 · zwei Klicks auf Speichern", () => {
  it("E1 · DER EINTRITTSZÄHLER: der erste Handler steht in der Persistenz, bevor der zweite Klick abgeht", async () => {
    // Das ist die Zusicherung, die D5 gefehlt hat. Sie misst NICHT, dass zwei Aufrufe abgeschickt
    // wurden — sie misst, dass der erste im Server ANGEKOMMEN und noch nicht fertig war.
    ablage.sperren();

    const erst = app.inject({
      method: "POST",
      url: "/api/drafts",
      headers: { authorization: `Bearer ${(await tokenVon()).token}` },
      payload: { title: "Ventil", operationId: "op-1" },
    });

    await warteBis(() => ablage.eintritte === 1, "der erste Handler die Persistenz erreicht");
    expect(ablage.eintritte, "der erste Handler hat die Persistenz nicht erreicht").toBe(1);
    expect(await ablage.list(), "es wurde bereits geschrieben").toHaveLength(0);

    const zweit = app.inject({
      method: "POST",
      url: "/api/drafts",
      headers: { authorization: `Bearer ${(await tokenVon()).token}` },
      payload: { title: "Ventil", operationId: "op-1" },
    });
    await warteBis(() => ablage.eintritte === 2, "der zweite Handler die Persistenz erreicht");

    ablage.freigeben();
    const [a, b] = await Promise.all([erst, zweit]);

    expect([a.statusCode, b.statusCode].sort()).toEqual([200, 201]);
    expect(await ablage.list(), "aus zwei Klicks wurden zwei Entwürfe").toHaveLength(1);
    expect(a.json().id).toBe(b.json().id);
  });

  it("E2 · GEGENMUTATION: ohne den atomaren Schutz entstehen zwei Entwürfe", async () => {
    // Derselbe Ablauf, EINZIGE Änderung: `insertIfOperationAbsent` legt unbedingt an. Ohne diesen
    // Fall bewiese E1 nur, dass zwei Aufrufe denselben Entwurf ergeben können — nicht, dass der
    // Schutz die Ursache ist.
    ablage.ohneAtomarenSchutz = true;
    ablage.sperren();

    const token = (await tokenVon()).token;
    const erst = app.inject({
      method: "POST",
      url: "/api/drafts",
      headers: { authorization: `Bearer ${token}` },
      payload: { title: "Ventil", operationId: "op-1" },
    });
    await warteBis(() => ablage.eintritte === 1, "der erste Handler die Persistenz erreicht");
    const zweit = app.inject({
      method: "POST",
      url: "/api/drafts",
      headers: { authorization: `Bearer ${token}` },
      payload: { title: "Ventil", operationId: "op-1" },
    });
    await warteBis(() => ablage.eintritte === 2, "der zweite Handler die Persistenz erreicht");

    ablage.freigeben();
    const [a, b] = await Promise.all([erst, zweit]);

    expect(await ablage.list(), "die Gegenmutation erzeugte KEINE zwei Entwürfe").toHaveLength(2);
    expect(a.json().id).not.toBe(b.json().id);
  });

  it("E3 · dieselbe Kennung in beiden Rumpfen — sonst misst E1 nichts", async () => {
    const token = (await tokenVon()).token;
    await app.inject({
      method: "POST",
      url: "/api/drafts",
      headers: { authorization: `Bearer ${token}` },
      payload: { title: "Ventil", operationId: "op-1" },
    });
    await app.inject({
      method: "POST",
      url: "/api/drafts",
      headers: { authorization: `Bearer ${token}` },
      payload: { title: "Ventil", operationId: "op-1" },
    });

    const gespeichert = await ablage.list();
    expect(gespeichert).toHaveLength(1);
    expect(gespeichert[0]?.createOperation?.id).toBe("op-1");
  });

  it("E4 · KALIBRIERUNG: zwei Klicks OHNE Kennung ergeben weiterhin zwei Entwürfe", async () => {
    // Der Bestandsweg bleibt, wie er war. Ohne diesen Fall wäre auch eine Fassung grün, die jede
    // zweite Anlage verschluckt.
    const token = (await tokenVon()).token;
    await app.inject({
      method: "POST",
      url: "/api/drafts",
      headers: { authorization: `Bearer ${token}` },
      payload: { title: "Ventil" },
    });
    await app.inject({
      method: "POST",
      url: "/api/drafts",
      headers: { authorization: `Bearer ${token}` },
      payload: { title: "Ventil" },
    });

    expect(await ablage.list()).toHaveLength(2);
  });
});

/** Ein frisches Token — die Sitzung ist je Test neu aufgebaut. */
async function tokenVon(): Promise<{ token: string }> {
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "a@x.de", password: "secret123" },
  });
  return { token: login.json().token as string };
}

// ================================================================================================
// DIE SICHTBARE HÄLFTE — der gerenderte Listeneintrag.
// ================================================================================================
//
// DER MESSORT STEHT IN DER D6-RÜCKGABE und ist dort belegt: Die Vordertür rendert KEINE
// Entwurfsliste (`grep -c "useDrafts"` auf `CaptureFrontDoor.tsx` ergibt 0). Der Eintrag, den der
// Mensch sieht, lebt in `apps/web/src/components/CaptureDraftList.tsx`, eingesetzt in
// `apps/web/src/pages/Capture.tsx` über `useDrafts` (`apps/web/src/api/hooks.ts:87`).
//
// Deshalb wird hier die LISTE gerendert, gespeist aus dem echten Serverbestand nach den beiden
// Klicks — nicht die Vordertür. Das ist der Renderer-Nachweis, den BEN unter „NUTZENKETTE" verlangt.
describe("JOB 2697 D7 · Fall 1 · die sichtbare Hälfte", () => {
  /** Mountet die echte Listenkomponente mit dem echten Serverbestand — Hausmuster `createRoot`. */
  async function listeRendern(): Promise<{ drafts: Draft[]; treffer: number }> {
    const { CaptureDraftList } = await import("../../apps/web/src/components/CaptureDraftList");
    const drafts = await ablage.list();
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const behaelter = document.createElement("div");
    document.body.appendChild(behaelter);
    const wurzel = createRoot(behaelter);
    await act(async () => {
      wurzel.render(
        createElement(
          QueryClientProvider,
          { client: qc },
          createElement(
            MemoryRouter,
            null,
            createElement(CaptureDraftList, {
              drafts,
              isAdmin: false,
              directory: [],
              open: true,
              onToggleOpen: () => undefined,
              scopeLabel: "",
              highlightId: null,
              // JOB 2703 D2 (Mitfuehrung 2697 D10): Pflicht-Props von `CaptureDraftListProps`
              // (Zeiger b4b0c12) nachgetragen — der .tsx-Typenlauf des Tors war sonst rot, auch in
              // PRO2s eigenem Klon. Neutrale Werte, kein Verhalten geaendert.
              editingId: null,
              confirmDiscardId: null,
              onConfirmDiscard: () => undefined,
              discardPending: false,
              onDiscard: () => undefined,
              onResume: () => undefined,
            }),
          ),
        ),
      );
    });
    const treffer = [...behaelter.querySelectorAll("*")].filter(
      (el) => el.children.length === 0 && (el.textContent ?? "").includes(TITEL),
    ).length;
    await act(async () => {
      wurzel.unmount();
    });
    behaelter.remove();
    return { drafts, treffer };
  }

  const zweimalKlicken = async (): Promise<void> => {
    const token = (await tokenVon()).token;
    for (let i = 0; i < 2; i += 1) {
      await app.inject({
        method: "POST",
        url: "/api/drafts",
        headers: { authorization: `Bearer ${token}` },
        payload: { title: TITEL, operationId: "op-1" },
      });
    }
  };

  it("E5 · nach zwei Klicks steht der Entwurf GENAU EINMAL in der Liste", async () => {
    await zweimalKlicken();

    const { drafts, treffer } = await listeRendern();
    expect(drafts, "es wurden zwei Entwürfe persistiert").toHaveLength(1);
    expect(treffer, "der Titel steht mehrfach in der gerenderten Liste").toBe(1);
  });

  it("E6 · GEGENMUTATION, sichtbar: ohne den Schutz stehen ZWEI Einträge da", async () => {
    ablage.ohneAtomarenSchutz = true;

    await zweimalKlicken();

    const { drafts, treffer } = await listeRendern();
    expect(drafts, "die Gegenmutation persistierte nicht zweimal").toHaveLength(2);
    expect(treffer, "die Liste zeigte den doppelten Entwurf nicht doppelt").toBe(2);
  });
});
