// ================================================================================================
// JOB 3110 · M2b — DER MEMO-WEG IST AN DER PRODUKTIVEN KOMPOSITION REGISTRIERT.
// ================================================================================================
//
// WAS `memo-route.test.ts` MISST und was NICHT. Jene Datei baut eine eigene Fastify-Instanz und
// registriert `klaraZurufRoutes` von Hand — sie beweist, dass die ROUTE stimmt. Sie kann nicht
// beweisen, dass der laufende Server sie kennt: genau das war die Lücke aus JOB 3091 (RUECKGABE R4,
// ABWEICHUNGEN 1) — die Route war gebaut, gemessen und ausgeliefert, und der echte Server
// antwortete trotzdem 404.
//
// DIESE DATEI SCHLIESST GENAU DIESE LÜCKE, und sie misst dafür an der App, die das Produkt
// wirklich baut: `buildServices()` + `buildApp(services)`, In-Memory-Ablagen, Anmeldung über
// `POST /api/auth/register`/`/login`, Sitzung und Zustimmung über die ECHTEN Klara-Endpunkte
// (`klaraAiRoutes`). Kein von Hand registriertes Plugin, keine Guard-Attrappe.
//
// RED-FIRST (§6): Fall R1 ist am Basisstand `c859293` ROT — `build-app.ts` registriert
// `klaraZurufRoutes` nicht, `inject` liefert Fastifys 404. Gemessen vor dem Bau:
//   R1 → AssertionError: Die gebaute App kennt POST …/zuruf nicht: expected 404 not to be 404
//   R3 → {"message":"Route POST:/api/klara/sessions/…/zuruf not found",…}: expected 404 to be 503
//
// DIE EINE ERSETZUNG, ausdrücklich benannt: das MODELL. An der Stelle, an der in Produktion der
// gecappte Cloud-Client steht, schreibt hier einer mit (`modellSpion`) — ein echter Cloud-Aufruf
// wird nicht gefahren (dieselbe benannte Prüflücke wie in JOB 3091 §8.6). Alles andere ist echt.
//
// DIE ZWEITE ERSETZUNG und warum sie nötig ist: ohne Cloud-Schlüssel meldet der Reasoner
// `cloudConfigured: false`, und dann sperrt das Sitzungstor jede externe Ausführung mit
// `policy_incomplete` — eine Zustimmung könnte gar nicht tragen, und die Fälle „mit Zustimmung"
// wären nicht messbar. Deshalb meldet `alsCloudVerdrahtetMelden` die Konfigurationslage eines
// Betriebs MIT Cloud (dieselbe Lage wie `CLOUD_LAGE` in `memo-route.test.ts`), und zwar an der
// EINEN Fläche, aus der `build-app.ts` seine Policy liest (`reasoner.configStatus()`). Das
// Sitzungstor selbst, seine Ablage, der Resolver und die Fristen bleiben echt — sie entscheiden.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { FastifyInstance, LightMyRequestResponse } from "fastify";
import { describe, expect, it } from "vitest";
import { type AppServices, buildApp, buildServices } from "../../services/app/src/build-app";
import type { ZurufAntwort, ZurufModell } from "../../services/app/src/routes/klara-session-routes";
import { KLARA_EXTERNAL_EXECUTION_MIGRATED } from "../../services/reasoner";

const ANBIETER = "anbieter-eins";
const MODELL_LABEL = "modell-eins";
const INSTANZ = "inst-1";
const DOKUMENT = "doc-abc";
const KO_TITEL = "Regelung Homeoffice";
const KO_AUSSAGE =
  "Homeoffice ist an bis zu zwei Tagen je Woche nach Absprache mit der Fuehrungskraft moeglich.";
const MEMO = "Memo: Homeoffice ist an bis zu zwei Tagen je Woche moeglich, nach Absprache.";
const AUFTRAG = "Formuliere ein kurzes Memo zu: Haben wir eine Regelung fuer Homeoffice?";
const KOERPER = { art: "erstellen", text: AUFTRAG };

/** Das Modell, das mitschreibt und zaehlt — „nichts ging hinaus" ist hier eine Messung. */
function modellSpion(antwort = MEMO) {
  const aufrufe: { system: string; user: string; confidential: boolean }[] = [];
  const modell: ZurufModell = {
    async complete(system, user, confidential) {
      aufrufe.push({ system, user, confidential });
      return antwort;
    },
  };
  return { modell, aufrufe };
}

/**
 * Die Konfigurationslage eines Betriebs MIT verdrahteter Cloud — gemeldet an der EINEN Fläche, aus
 * der `build-app.ts:1597-1616` seine Klara-Policy liest. Der echte Rest der Auskunft bleibt stehen;
 * überschrieben werden nur die Felder, die diese Lage ausmachen.
 */
function alsCloudVerdrahtetMelden(services: AppServices): void {
  const echt = services.reasoner.configStatus.bind(services.reasoner);
  Object.assign(services.reasoner, {
    configStatus: () => {
      const c = echt();
      return {
        ...c,
        provider: ANBIETER,
        model: MODELL_LABEL,
        configured: true,
        cloudConfigured: true,
        taskConfig: { ...c.taskConfig, global: "cloud" },
        effectiveProvider: { ...c.effectiveProvider, answer: "cloud" },
      };
    },
  });
}

interface Aufbau {
  app: FastifyInstance;
  services: AppServices;
  koId: string;
  sitzung: string;
  /** Anmeldung + Bindung, wie das Word-Panel sie führt. */
  kopf: Record<string, string>;
  anmeldung: Record<string, string>;
  zustimmen: () => Promise<number>;
  widerrufen: () => Promise<number>;
  zuruf: (koerper?: unknown, headers?: Record<string, string>) => Promise<LightMyRequestResponse>;
}

/**
 * Die App, wie das Produkt sie baut. `modell` ist der einzige Ersatz — fehlt es, ist das die
 * Aufstellung eines Servers ohne Cloud-Schlüssel.
 */
async function aufbau(opts: { modell?: ZurufModell } = {}): Promise<Aufbau> {
  const services = buildServices();
  alsCloudVerdrahtetMelden(services);
  if (opts.modell) {
    // GENAU DAS FELD, das `assembleServices` in Produktion aus dem gecappten Cloud-Client füllt
    // (R7/R8 messen diese Füllung getrennt). Hier steht der Mitschreiber darin — kein Cloud-Aufruf.
    services.zurufModell = opts.modell;
  }
  const app = buildApp(services);

  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Pedi", email: "p@x.de", password: "secret123" },
  });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "p@x.de", password: "secret123" },
  });
  const anmeldung = { authorization: `Bearer ${(login.json() as { token: string }).token}` };

  const angelegt = await app.inject({
    method: "POST",
    url: "/api/kos",
    headers: anmeldung,
    payload: {
      confidentiality: "intern",
      title: KO_TITEL,
      statement: KO_AUSSAGE,
      type: "best_practice",
      category: "Personal",
    },
  });
  const koId = (angelegt.json() as { id: string }).id;
  await app.inject({
    method: "PUT",
    url: `/api/kos/${koId}`,
    headers: anmeldung,
    payload: { action: "admin-validate" },
  });
  // Die Hintergrund-Pruefung zu Ende laufen lassen, sonst laeuft sie in die naechste Messung.
  await services.aiCheckWorker?.idle();

  const sitzung = await app.inject({
    method: "POST",
    url: "/api/klara/sessions",
    headers: anmeldung,
    payload: {
      addinInstanceId: INSTANZ,
      documentDescriptor: { kind: "saved", hostDocumentId: DOKUMENT },
    },
  });
  expect(sitzung.statusCode, JSON.stringify(sitzung.json())).toBe(201);
  const sicht = sitzung.json() as { sessionId: string; documentContextId: string };
  const kopf = {
    ...anmeldung,
    "x-klara-session": sicht.sessionId,
    "x-klara-instance": INSTANZ,
    "x-klara-document": sicht.documentContextId,
  };

  return {
    app,
    services,
    koId,
    sitzung: sicht.sessionId,
    kopf,
    anmeldung,
    zustimmen: async () =>
      (
        await app.inject({
          method: "POST",
          url: `/api/klara/sessions/${sicht.sessionId}/consent`,
          headers: kopf,
        })
      ).statusCode,
    widerrufen: async () =>
      (
        await app.inject({
          method: "DELETE",
          url: `/api/klara/sessions/${sicht.sessionId}/consent`,
          headers: kopf,
        })
      ).statusCode,
    zuruf: (koerper: unknown = { ...KOERPER, koIds: [koId] }, headers = kopf) =>
      app.inject({
        method: "POST",
        url: `/api/klara/sessions/${sicht.sessionId}/zuruf`,
        headers: { ...headers, "content-type": "application/json" },
        payload: JSON.stringify(koerper),
      }),
  };
}

describe("JOB 3110 · M2b · der gebaute Server kennt den Memo-Weg", () => {
  it("R0 · die Vorbedingung, protokolliert: der externe Ausfuehrungsweg ist freigeschaltet", () => {
    // Ohne diese Zeile waere unklar, welchen Zustand R2/R3/R4 messen — bei gesperrtem Schalter
    // koennte keine Zustimmung tragen, und „403" waere dort aus dem falschen Grund gruen.
    expect(KLARA_EXTERNAL_EXECUTION_MIGRATED).toBe(true);
  });

  it("R1 · der Weg ist bekannt: die gebaute App antwortet NICHT mehr 404 (RED am Basisstand)", async () => {
    const k = await aufbau();
    const res = await k.zuruf();
    // Der Kern dieses Auftrags. 404 hiesse: der Server kennt den Memo-Weg nicht — genau der Satz,
    // den das Word-Panel bis heute anzeigen musste.
    expect(res.statusCode, "Die gebaute App kennt POST …/zuruf nicht").not.toBe(404);
    // Und die Antwort ist die des Erzeugers, nicht irgendeine: ohne Zustimmung 403.
    expect(res.statusCode).toBe(403);
    await k.app.close();
  });

  it("R2 · ohne Zustimmung: 403 CONSENT_MISSING, und kein Entwurfsfeld in der Antwort", async () => {
    const spion = modellSpion();
    const k = await aufbau({ modell: spion.modell });
    const res = await k.zuruf();
    expect(res.statusCode).toBe(403);
    const body = res.json() as Record<string, unknown>;
    expect(body.error).toBe("CONSENT_MISSING");
    expect(String(body.message)).toContain("Einwilligung");
    expect(body).not.toHaveProperty("entwurf");
    expect(body).not.toHaveProperty("herkunft");
    expect(spion.aufrufe, "Das Modell wurde ohne Zustimmung gerufen").toHaveLength(0);
    await k.app.close();
  });

  it("R3 · mit Zustimmung, aber OHNE verdrahtetes Modell: 503 NO_FORMULIERER — ehrlich statt erfunden", async () => {
    // Genau die Aufstellung eines Servers ohne Cloud-Schluessel: `services.zurufModell` bleibt
    // `undefined`, weil `createCappedCloudClientFromEnv` ohne Schluessel nichts liefert.
    const k = await aufbau();
    expect(
      k.services.zurufModell,
      "ohne Cloud-Schluessel darf kein Modell verdrahtet sein",
    ).toBeUndefined();
    expect(await k.zustimmen()).toBe(200);
    const res = await k.zuruf();
    expect(res.statusCode, JSON.stringify(res.json())).toBe(503);
    expect(res.json().error).toBe("NO_FORMULIERER");
    expect(res.json()).not.toHaveProperty("entwurf");
    await k.app.close();
  });

  it("R4 · mit Zustimmung UND verdrahtetem Modell: 200 mit Entwurf, Herkunft und Anbieter", async () => {
    const spion = modellSpion();
    const k = await aufbau({ modell: spion.modell });
    expect(await k.zustimmen()).toBe(200);
    const res = await k.zuruf();
    expect(res.statusCode, JSON.stringify(res.json())).toBe(200);
    const body = res.json() as ZurufAntwort;
    expect(body.entwurf).toBe(MEMO);
    expect(body.herkunft).toEqual([
      { koId: k.koId, titel: KO_TITEL, stufe: "validiert", version: 1 },
    ]);
    // Anbieter und Modell kommen aus der Aufloesung, gegen die das ECHTE Tor geprueft hat.
    expect(body.anbieter).toBe(ANBIETER);
    expect(body.modell).toBe(MODELL_LABEL);
    expect(body.aiGenerated).toBe(true);
    // GENAU EIN Modellaufruf, mit Beleg und Auftrag, als nicht-vertraulich deklariert.
    expect(spion.aufrufe).toHaveLength(1);
    expect(spion.aufrufe[0]?.user).toContain(KO_AUSSAGE);
    expect(spion.aufrufe[0]?.user).toContain(AUFTRAG);
    expect(spion.aufrufe[0]?.confidential).toBe(false);
    await k.app.close();
  });

  it("R5 · EINE Sitzungswahrheit: die Zustimmung des Klara-Endpunkts oeffnet den Memo-Weg, ihr Widerruf schliesst ihn", async () => {
    // Die Probe auf Liefergrenze 2. Gaebe es in `build-app.ts` eine ZWEITE `KlaraSessionService`-
    // Instanz fuer den Zuruf, saehe sie die ueber `POST …/consent` erteilte Zustimmung nie — der
    // Zuruf bliebe dauerhaft bei 403, obwohl der Mensch zugestimmt hat.
    const spion = modellSpion();
    const k = await aufbau({ modell: spion.modell });
    expect((await k.zuruf()).statusCode).toBe(403);
    expect(await k.zustimmen()).toBe(200);
    expect((await k.zuruf()).statusCode).toBe(200);
    expect(await k.widerrufen()).toBe(200);
    const nachWiderruf = await k.zuruf();
    expect(nachWiderruf.statusCode, "der Widerruf wirkt auf dem Memo-Weg nicht").toBe(403);
    expect(nachWiderruf.json().error).toBe("CONSENT_MISSING");
    // Gerufen wurde das Modell genau einmal: im Fenster zwischen Zustimmung und Widerruf.
    expect(spion.aufrufe).toHaveLength(1);
    await k.app.close();
  });

  it("R6 · keine neue Sichtbarkeit: unangemeldet dieselbe Absage wie am bestehenden Klara-Endpunkt", async () => {
    const k = await aufbau({ modell: modellSpion().modell });
    const ohneAnmeldung = { ...k.kopf };
    delete ohneAnmeldung.authorization;

    const zuruf = await k.zuruf(undefined, ohneAnmeldung);
    const bestand = await k.app.inject({
      method: "POST",
      url: `/api/klara/sessions/${k.sitzung}/consent`,
      headers: ohneAnmeldung,
    });
    expect(zuruf.statusCode, "unangemeldet darf der Memo-Weg nichts hergeben").toBe(
      bestand.statusCode,
    );
    expect(zuruf.statusCode).toBe(401);
    expect(zuruf.json()).not.toHaveProperty("entwurf");
    await k.app.close();
  });
});

// ================================================================================================
// DAS MODELL REIST ÜBER DIE KOMPOSITION — und über den EINEN Egress-Wächter.
// ================================================================================================
describe("JOB 3110 · M2b · der Formulierer kommt aus dem vorhandenen gecappten Cloud-Client", () => {
  const gemerkt = { key: process.env.OPENAI_API_KEY, model: process.env.REASONER_MODEL };

  function mitCloudSchluessel<T>(fn: () => T): T {
    process.env.OPENAI_API_KEY = "test-schluessel-kein-echter";
    process.env.REASONER_MODEL = "test-modell";
    try {
      return fn();
    } finally {
      if (gemerkt.key === undefined) {
        delete process.env.OPENAI_API_KEY;
      } else {
        process.env.OPENAI_API_KEY = gemerkt.key;
      }
      if (gemerkt.model === undefined) {
        delete process.env.REASONER_MODEL;
      } else {
        process.env.REASONER_MODEL = gemerkt.model;
      }
    }
  }

  it("R7 · ohne Cloud-Schluessel bleibt das Feld leer, mit Schluessel traegt es einen Formulierer", () => {
    expect(
      buildServices().zurufModell,
      "ohne Schluessel darf kein Modell entstehen",
    ).toBeUndefined();
    const mit = mitCloudSchluessel(() => buildServices().zurufModell);
    expect(mit, "mit Schluessel muss der Zuruf einen Formulierer bekommen").toBeDefined();
    expect(typeof mit?.complete).toBe("function");
  });

  it("R8 · dieser Formulierer IST der gecappte Cloud-Client: vertraulicher Text wird VOR jedem Aufruf abgewiesen", async () => {
    const modell = mitCloudSchluessel(() => buildServices().zurufModell);
    expect(modell).toBeDefined();
    // Der Egress-Waechter `rejectsConfidential` des einen gecappten Clients — er wirft, BEVOR
    // irgendein Netzaufruf laeuft. Ein roh gebauter Client haette ihn nicht.
    await expect(modell?.complete("system", "user", true)).rejects.toThrow(/Vertrauliche Inhalte/);
  });

  it("R9 · es gibt weiterhin GENAU EINEN Cloud-Fabrikaufruf in der Kompositionswurzel", () => {
    // Zwei Aufrufe waeren zwei Egress-Regeln, und die zweite ist die, die vergessen wird
    // (build-app.ts:412-421). Der Zuruf nimmt deshalb den VORHANDENEN Client, keinen eigenen.
    const quelle = readFileSync(resolve(process.cwd(), "services/app/src/build-app.ts"), "utf8");
    const treffer = quelle.match(/createCappedCloudClientFromEnv\(/g) ?? [];
    expect(treffer).toHaveLength(1);
  });
});
