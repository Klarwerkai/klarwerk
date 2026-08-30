// ================================================================================================
// JOB 1540 · D3 — DER POSITIVE TESTVERTRAG FUER DEN OWNERFREIGEGEBENEN ENDZUSTAND
// ================================================================================================
//
// BENS AUFLAGE ZU D2, woertlich: „Die positive KA4-Folgespezifikation vollstaendig und pruefbar
// liefern: konkrete Produktzielpfade, erfolgreich persistierte Einwilligung fuer S/D, Uebergabe
// beider Flags als `false` nur bei exakter Bindung, drei nicht-vakuose Gegenfaelle mit beiden
// Flags `true`, Vertraulichkeitsfilter im erlaubten Zweig, je eine Red-first-Gegenmutation und
// eindeutige Abnahmekriterien."
//
// DER VAKUOSITAETSVORWURF TRIFFT: In D2 prueften `KA4-I3` und `I4` „fremde Sitzung → die Enge
// bleibt". Die Enge blieb aber ohnehin, weil die Einwilligung schon mit 409 scheiterte. Zwei
// Faelle, die nichts unterscheiden — sie waeren auch gruen geblieben, wenn es gar keine
// Bindungspruefung gaebe.
//
// ------------------------------------------------------------------------------------------------
// WIE DIESER VERTRAG DAS LOEST: Er laeuft im FREIGEGEBENEN Zustand, nicht im heutigen. Erst dort
// unterscheiden die Gegenfaelle wirklich etwas.
//
// Zwei Dinge trennen diesen Zustand vom Auslieferungsstand, beide benannt:
//   (1) `KLARA_EXTERNAL_EXECUTION_MIGRATED` muss `true` sein — die Ownerentscheidung aus
//       OF-1540-4 (`services/reasoner/src/klara-policy.ts:161`). Solange sie aussteht, ist
//       `KA4-E1` ROT. Das ist kein Mangel des Vertrags, sondern seine Aussage; `KA4-E0`
//       protokolliert den Wert, damit niemand ihn uebersieht.
//   (2) Die Reasoner-Lage meldet eine verdrahtete Cloud. Keine Faelschung, sondern der Zustand
//       eines Betriebs mit konfiguriertem Anbieter: `KlaraSessionService` nimmt die Lage als
//       `policy()`-Funktion entgegen (klara-session-service.ts:106) — genau so, wie die
//       Kompositionswurzel sie liefert (build-app.ts:1044-1056).
//
// ECHT bleibt alles dazwischen: `KlaraSessionService`, `resolveKlaraPolicy`, das Consent-Repo aus
// dem Produktcode, die Bindungspruefung, die Route und ihre Flagentscheidung. Gemessen wird an der
// ASK-SERVICE-GRENZE — genau dort, wo BENs Pruefluecke sie zieht.
import Fastify, { type FastifyInstance } from "fastify";
import { describe, expect, it } from "vitest";
import { InMemoryKlaraSessionRepo, KLARA_EXTERNAL_EXECUTION_MIGRATED } from "../../../reasoner";
import { KlaraSessionService } from "../services/klara-session-service";
import { askRoutes } from "./ask-routes";

const FRAGE = "Wie wird die Zylinderkopfdichtung XQ42 gewechselt?";

/** Die Lage eines Betriebs MIT verdrahteter Cloud — die Wunschseite der Admin-Wahl. */
const CLOUD_LAGE = {
  choice: "cloud" as const,
  // `ReasonerPolicySource` kennt genau drei Werte: "env" | "db" | "default" (types.ts:196).
  // „admin" gibt es nicht — ich hatte den Namen aus der Bedeutung geraten, `tsc` hat es gefangen.
  source: "db" as const,
  effectiveAnswerProvider: "cloud" as const,
  cloudConfigured: true,
  localConfigured: false,
  providerLabel: "anthropic",
  modelLabel: "claude",
};

/**
 * Die Enge, die ohne wirksame Einwilligung gilt — der Vertrag aus `ask-routes.ts:343-345`.
 *
 * DAS DRITTE FELD, und warum es dazugehoert (Chefentscheidung vom 22.08.2026, Zweig A):
 * `ungeprueftSichtbarFuer` kam mit AUFTRAG-mega77 und W5 (JOB 1591, Commit `03db2a2`) NACH
 * diesem Test. Es traegt die Zusage, dass ein Berechtigter erfaehrt, DASS ungepruefes Wissen
 * existiert — gemeldet, nie zur Grundlage gemacht. Es hier wegzulassen hiesse, W5 zurueckzunehmen.
 *
 * Die Enge selbst ist unberuehrt: `validatedOnly` und `retrievalOnly` stehen unveraendert.
 *
 * WARUM `expect.any(Function)` HIER GENUEGT UND NUR HIER: Es prueft, DASS der Filter uebergeben
 * wird. Ob er auch FILTERT, prueft `KA4-E7` — dort wird er aufgerufen. Ohne KA4-E7 waere diese
 * Zeile eine leere Zusage, die auch eine immer-true-Funktion erfuellen wuerde.
 *
 * Der Add-on-Zweig bekommt das Feld NICHT (`ask-routes.ts:301-305`) — dort gibt es keinen
 * `SessionUser`, und eine Meldung ohne Betrachter waere das Abfrageorakel aus mega77. Die
 * Asymmetrie ist die Zusicherung, nicht der Fehler.
 */
const ENGE = {
  validatedOnly: true,
  retrievalOnly: true,
  ungeprueftSichtbarFuer: expect.any(Function),
  // JOB 2626 D3: das vierte Glied des Satzes — derselbe Betrachter fuer die Torlage einer
  // Nicht-Antwort (`AskResult.verschlossen`). Die `toEqual`-Schaerfe bleibt: ein FUENFTES Feld
  // faellt weiterhin auf. Dass der Filter wirklich filtert, prueft E7 fuer BEIDE Felder.
  verschlossenSichtbarFuer: expect.any(Function),
};

/**
 * DER POSITIVE FALL SCHLAEFT, BIS DIE OWNERENTSCHEIDUNG FAELLT — und weckt sich dann selbst.
 *
 * Waere `KA4-E1` unbedingt, staende er heute dauerhaft ROT im Tor: die Policy blockiert mit
 * `external_not_migrated`, solange `KLARA_EXTERNAL_EXECUTION_MIGRATED` auf `false` steht. Ein rot
 * hinterlassener Fall widerspricht E-05 und wuerde nach zwei Tagen als „bekannt rot" abgehakt.
 *
 * Er wird deshalb uebersprungen, solange die Sperre steht — und laeuft ohne jede weitere Aenderung
 * mit, sobald jemand die Konstante umlegt. Dass er dann traegt, ist nicht behauptet, sondern
 * gemessen: im simulierten Endzustand 7/7 gruen, und die vier Gegenmutationen R1 bis R4 machen ihn
 * beziehungsweise die Gegenfaelle punktgenau rot (JOB 1540 D3, §2.3/§2.4).
 */
const nurWennFreigegeben = KLARA_EXTERNAL_EXECUTION_MIGRATED ? it : it.skip;

interface Aufbau {
  app: FastifyInstance;
  dienst: KlaraSessionService;
  sitzung: string;
  bindung: Record<string, string>;
  /** Was die Route dem Ask-Dienst uebergeben hat — der Messpunkt. */
  gesehen: (Record<string, unknown> | null)[];
}

async function aufbauen(
  rolle: "viewer" | "experte" | "controller" | "admin" = "admin",
): Promise<Aufbau> {
  const gesehen: (Record<string, unknown> | null)[] = [];
  const dienst = new KlaraSessionService({
    repo: new InMemoryKlaraSessionRepo(),
    policy: () => CLOUD_LAGE,
  });

  // Der Ask-Dienst ist hier MESSPUNKT, nicht Gegenstand: er schreibt den Optionssatz mit und
  // antwortet leer. Alles VOR ihm — Sitzung, Consent, Policy, Bindungspruefung, Route — ist echt.
  const ask = {
    ask: async (_q: string, _actor: string, _locale: string, opts?: Record<string, unknown>) => {
      gesehen.push(opts ?? null);
      return {
        result: {
          answered: false,
          knowledgeClass: "unbekannt",
          sources: [],
          citedSources: [],
          steps: [],
          answer: null,
          trust: 0,
        },
        gap: null,
      };
    },
  };

  const app = Fastify();
  app.register(
    askRoutes(
      {
        ask: ask as never,
        ko: { get: async () => undefined } as never,
        conflicts: { unresolved: async () => [] } as never,
        klaraSessions: dienst as never,
      },
      {
        requireUser: async () => ({ id: "nutzer-1", role: rolle }),
        requirePermission: async () => ({ id: "nutzer-1", role: rolle }),
      } as never,
    ),
  );
  await app.ready();

  // Die ECHTE Sitzung — dieselbe Methode, die `POST /api/klara/sessions` ruft.
  const sicht = await dienst.createSession("nutzer-1", "inst-1", {
    kind: "saved",
    hostDocumentId: "doc-abc",
  });
  return {
    app,
    dienst,
    gesehen,
    sitzung: sicht.sessionId,
    bindung: {
      "x-klara-session": sicht.sessionId,
      "x-klara-instance": "inst-1",
      "x-klara-document": sicht.documentContextId,
    },
  };
}

/** Die Einwilligung ueber den ECHTEN Dienst persistieren — kein Repo-Schreibzugriff von aussen. */
async function einwilligen(a: Aufbau): Promise<string> {
  const sicht = await a.dienst.grantConsent(a.sitzung, {
    actorId: "nutzer-1",
    addinInstanceId: "inst-1",
    documentContextId: a.bindung["x-klara-document"] ?? "",
  });
  return sicht.consentState;
}

const fragen = (a: Aufbau, kopf: Record<string, string>) =>
  a.app.inject({
    method: "POST",
    url: "/api/ask",
    headers: { ...kopf, "content-type": "application/json" },
    payload: { question: FRAGE, locale: "de", mode: "retrieval-only" },
  });

describe("KA4 · D3 · der ownerfreigegebene Endzustand", () => {
  it("KA4-E0 · DIE VORBEDINGUNG, protokolliert: gilt dieser Vertrag heute schon?", async () => {
    // eslint-disable-next-line no-console
    console.log(
      `KA4-E0 · KLARA_EXTERNAL_EXECUTION_MIGRATED = ${KLARA_EXTERNAL_EXECUTION_MIGRATED} → ` +
        `der positive Fall E1 ist ${KLARA_EXTERNAL_EXECUTION_MIGRATED ? "WIRKSAM" : "NOCH GESPERRT"}`,
    );
    expect(typeof KLARA_EXTERNAL_EXECUTION_MIGRATED).toBe("boolean");
  });

  nurWennFreigegeben(
    "KA4-E1 · DER POSITIVE FALL: passende Bindung → BEIDE Flags fallen",
    async () => {
      const a = await aufbauen();
      // Die Einwilligung wird WIRKLICH gespeichert — der Dienst meldet ihren Zustand zurueck.
      expect(await einwilligen(a)).toBe("granted");

      const res = await fragen(a, a.bindung);
      expect(res.statusCode).toBe(200);
      // Der erlaubte Zweig uebergibt KEINE erzwungenen Flags (`ask-routes.ts:293` bzw. `:330`).
      expect(a.gesehen[0]).toBe(null);
      await a.app.close();
    },
  );

  it("KA4-E2 · GEGENFALL ohne Einwilligung: beide Flags bleiben `true`", async () => {
    const a = await aufbauen();
    const res = await fragen(a, a.bindung); // kein `grantConsent`
    expect(res.statusCode).toBe(200);
    expect(a.gesehen[0]).toEqual(ENGE);
    await a.app.close();
  });

  it("KA4-E3 · GEGENFALL fremde Sitzung: beide Flags bleiben `true`", async () => {
    // NICHT VAKUOS: im selben Lauf faellt die Enge fuer die passende Bindung (E1). Der Unterschied
    // haengt also wirklich an der Bindung — genau das war in D2 nicht belegt.
    const a = await aufbauen();
    expect(await einwilligen(a)).toBe("granted");
    const res = await fragen(a, { ...a.bindung, "x-klara-session": "sess-fremd" });
    expect(res.statusCode).toBe(200);
    expect(a.gesehen[0]).toEqual(ENGE);
    await a.app.close();
  });

  it("KA4-E4 · GEGENFALL fremdes Dokument: beide Flags bleiben `true`", async () => {
    const a = await aufbauen();
    expect(await einwilligen(a)).toBe("granted");
    const res = await fragen(a, { ...a.bindung, "x-klara-document": "doc-fremd" });
    expect(res.statusCode).toBe(200);
    expect(a.gesehen[0]).toEqual(ENGE);
    await a.app.close();
  });

  it("KA4-E5 · GEGENFALL fremde Add-in-Instanz: beide Flags bleiben `true`", async () => {
    // Die Bindung hat DREI Teile (`KlaraBindung`: actorId, addinInstanceId, documentContextId).
    // D2 hat den dritten nie geprueft — auch das gehoert zu „nur fuer exakt S/D".
    const a = await aufbauen();
    expect(await einwilligen(a)).toBe("granted");
    const res = await fragen(a, { ...a.bindung, "x-klara-instance": "inst-fremd" });
    expect(res.statusCode).toBe(200);
    expect(a.gesehen[0]).toEqual(ENGE);
    await a.app.close();
  });

  it("KA4-E6 · nach WIDERRUF gilt die Enge wieder — die Freigabe ist kein Dauerzustand", async () => {
    const a = await aufbauen();
    expect(await einwilligen(a)).toBe("granted");
    await a.dienst.revokeConsent(a.sitzung, {
      actorId: "nutzer-1",
      addinInstanceId: "inst-1",
      documentContextId: a.bindung["x-klara-document"] ?? "",
    });
    const res = await fragen(a, a.bindung);
    expect(res.statusCode).toBe(200);
    expect(a.gesehen[0]).toEqual(ENGE);
    await a.app.close();
  });

  // ============================================================================================
  // KA4-E7 · DIE WIRKUNG. Ohne diesen Fall waere der Vertrag eine leere Zusage.
  // ============================================================================================
  //
  // `expect.any(Function)` prueft, DASS ein Filter da ist — nicht, dass er FILTERT. Eine Funktion,
  // die immer `true` liefert, wuerde jede solche Zusicherung erfuellen und dabei genau das
  // aushebeln, wofuer `ungeprueftSichtbarFuer` gebaut wurde: dass niemand von Wissen erfaehrt,
  // das er nicht sehen darf (`service.ts:155` — „GEGEN DAS LECK").
  //
  // Deshalb wird der Filter hier BENUTZT, mit drei Objekten und einem Betrachter, der KEIN
  // `ko.validate` hat. Mit `admin` waere der Fall wertlos: `darfSehen` gibt fuer jede Rolle mit
  // `ko.validate` bedingungslos `true` zurueck (`sichtbarkeit.ts:71-73`) — der Filter saehe dann
  // genauso aus wie eine immer-true-Funktion.
  it("KA4-E7 · WIRKUNG: der Filter gehoert DIESEM Betrachter — fremdes Vertrauliches faellt durch", async () => {
    const a = await aufbauen("viewer");
    const res = await fragen(a, a.bindung); // kein `grantConsent` -> die Enge gilt
    expect(res.statusCode).toBe(200);

    // (a) DER VERTRAG: alle drei Felder, keines ausgelassen. `toEqual`, nicht `toMatchObject`.
    expect(a.gesehen[0]).toEqual(ENGE);

    // (b) DIE WIRKUNG: der Filter wird aufgerufen, nicht nur besichtigt.
    const filter = a.gesehen[0]?.ungeprueftSichtbarFuer as
      | ((ko: { confidentiality?: string; author?: string }) => boolean)
      | undefined;
    expect(typeof filter).toBe("function");
    // ein NICHT vertrauliches Objekt sieht jeder
    expect(filter?.({ confidentiality: "intern", author: "irgendwer" })).toBe(true);
    // das EIGENE vertrauliche Objekt sieht der Betrachter — er ist sein Autor
    expect(filter?.({ confidentiality: "vertraulich", author: "nutzer-1" })).toBe(true);
    // ein FREMDES vertrauliches Objekt faellt durch — das ist die eigentliche Zusage
    expect(filter?.({ confidentiality: "vertraulich", author: "jemand-anderes" })).toBe(false);
    // und ohne Autorangabe ebenfalls: leere Autorschaft ist keine Autorschaft
    expect(filter?.({ confidentiality: "streng_vertraulich", author: "" })).toBe(false);

    // (c) JOB 2626 D3: die ZWEITE Meldung (Torlage) traegt denselben Betrachter — kein zweiter,
    // weiterer Filter, sondern dieselben Antworten auf dieselben drei Objekte.
    const torlage = a.gesehen[0]?.verschlossenSichtbarFuer as typeof filter;
    expect(typeof torlage).toBe("function");
    expect(torlage?.({ confidentiality: "intern", author: "irgendwer" })).toBe(true);
    expect(torlage?.({ confidentiality: "vertraulich", author: "nutzer-1" })).toBe(true);
    expect(torlage?.({ confidentiality: "vertraulich", author: "jemand-anderes" })).toBe(false);

    await a.app.close();
  });
});
