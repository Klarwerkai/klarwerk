// ================================================================================================
// JOB 1494 · D1 · KA8 STUFE 1b — DER ENDPUNKT LIEFERT DIE BELEGTE AUSKUNFT, ODER GAR NICHTS.
// ================================================================================================
//
// WAS DIESER TEST BEWEIST — und was er ausdruecklich NICHT beweist:
//
// ER BEWEIST: Der neue Endpunkt reicht die Ableitung aus JOB 1171 unveraendert und mit ihrer
// Herkunft nach aussen, trennt „Entwurf gibt es nicht" (404) von „kein Schritt ableitbar" (204),
// haelt die Sichtbarkeitsregel fremder Entwuerfe ein (403) und schreibt nichts.
//
// ER BEWEIST NICHT, dass eine Karte erscheint. Der Endpunkt ist in `build-app.ts` NICHT
// registriert — dieser Pfad liegt ausserhalb der Lease dieses Durchgangs (Auftrag §6: „Brauchst du
// eine bestehende Datei — etwa um deinen Endpunkt zu registrieren: halt an und melde"). Solange
// die eine Registrierungszeile fehlt, ist die Route im laufenden Server nicht erreichbar. Dieser
// Satz steht VOR dem ersten Testfall, damit niemand aus gruenen Faellen auf sichtbare Wirkung
// schliesst.
//
// DESHALB WIRD HIER DAS PLUGIN DIREKT REGISTRIERT: eine eigene Fastify-Instanz, der echte
// `CaptureService`, das echte `canSeeDraft` ueber die Route — nur die Anmeldung ist gestellt. Das
// ist die schaerfste Aussage, die ohne die Registrierungszeile ueberhaupt moeglich ist.
import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import type { Guards, SessionUser } from "../../services/app/src/http";
import {
  NAECHSTER_SCHRITT_PFAD,
  naechsterSchrittEntwurfRoutes,
} from "../../services/app/src/routes/naechster-schritt-entwurf";
import { CaptureService, InMemoryDraftRepo } from "../../services/capture";
import type { DraftPayload } from "../../services/capture";

const VOLLSTAENDIG: DraftPayload = {
  title: "Schweissnaht bei Aluminium unter 5 mm pruefen",
  statement: "Unter 5 mm Blechstaerke wird mit reduzierter Stromstaerke geschweisst.",
  type: "best_practice",
  category: "Fertigung",
};

// Ein Entwurf, der sich auf ein gesichertes Original beruft — der Traeger von `anchorsMissing`.
const MIT_ANKER: DraftPayload = {
  ...VOLLSTAENDIG,
  pendingSources: [{ label: "Werksnorm 12", objectId: "obj-original-1" }],
  anchorDocuments: [
    { key: "a1", objectId: "obj-original-1", name: "norm12.pdf", mime: "application/pdf" },
  ],
};

/**
 * Die Anmeldung ist gestellt, die Berechtigungspruefung nicht weggelassen: der Wachposten
 * antwortet mit 401, wenn kein Nutzer gesetzt ist. Damit bleibt der 401-Zweig eine echte Aussage
 * und nicht eine Annahme.
 */
function wachposten(user: SessionUser | undefined): Guards {
  return {
    requireUser: async (_request, reply) => {
      if (!user) {
        reply.code(401).send({ error: "UNAUTHORIZED" });
        return undefined;
      }
      return user;
    },
    requirePermission: async (_permission, _request, reply) => {
      if (!user) {
        reply.code(401).send({ error: "UNAUTHORIZED" });
        return undefined;
      }
      return user;
    },
  };
}

async function baueApp(capture: CaptureService, user: SessionUser | undefined) {
  const app = Fastify();
  await app.register(naechsterSchrittEntwurfRoutes({ capture }, wachposten(user)));
  await app.ready();
  return app;
}

function dienstMitSpeicher(vorhanden: readonly string[]): CaptureService {
  return new CaptureService({
    repo: new InMemoryDraftRepo(),
    objectExists: (objectId) => Promise.resolve(vorhanden.includes(objectId)),
  });
}

const ANNA: SessionUser = { id: "anna", role: "experte" };

function pfad(id: string): string {
  return NAECHSTER_SCHRITT_PFAD.replace(":id", id);
}

describe("JOB 1494 · KA8 1b — der Endpunkt liefert die Auskunft samt Herkunft", () => {
  it("fehlender Anker ⇒ 200 mit `anker_fehlt` UND der Herkunft, die es ausgeloest hat", async () => {
    const capture = dienstMitSpeicher([]); // das Original ist weg
    const entwurf = await capture.createDraft(MIT_ANKER, ANNA.id);
    const app = await baueApp(capture, ANNA);

    const res = await app.inject({ method: "GET", url: pfad(entwurf.id) });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ art: "anker_fehlt", herkunft: ["anchorsMissing"] });
  });

  it("einreichbarer Entwurf ⇒ 200 mit `einreichen` und den vier Pflichtfeldern als Herkunft", async () => {
    const capture = dienstMitSpeicher(["obj-original-1"]);
    const entwurf = await capture.createDraft(MIT_ANKER, ANNA.id);
    const app = await baueApp(capture, ANNA);

    const res = await app.inject({ method: "GET", url: pfad(entwurf.id) });

    expect(res.statusCode).toBe(200);
    expect(res.json().art).toBe("einreichen");
    expect([...res.json().herkunft].sort()).toEqual([
      "payload.category",
      "payload.statement",
      "payload.title",
      "payload.type",
    ]);
  });

  it("unvollstaendiger Entwurf ⇒ 200 mit `vervollstaendigen` und genau den fehlenden Feldern", async () => {
    const capture = dienstMitSpeicher([]);
    const entwurf = await capture.createDraft({ title: "Nur ein Titel" }, ANNA.id);
    const app = await baueApp(capture, ANNA);

    const res = await app.inject({ method: "GET", url: pfad(entwurf.id) });

    expect(res.statusCode).toBe(200);
    expect(res.json().art).toBe("vervollstaendigen");
    expect([...res.json().herkunft].sort()).toEqual([
      "payload.category",
      "payload.statement",
      "payload.type",
    ]);
  });

  it("DER UNTERSCHIED: dieselbe Ladung, zwei Speicherlagen, zwei verschiedene Antworten", async () => {
    // Ohne diesen Fall koennten alle Antworten zufaellig gleich sein und der Endpunkt trotzdem
    // gruen — er pruefte dann nur, dass ueberhaupt etwas kommt.
    const mitLuecke = dienstMitSpeicher([]);
    const ohneLuecke = dienstMitSpeicher(["obj-original-1"]);
    const a = await mitLuecke.createDraft(MIT_ANKER, ANNA.id);
    const b = await ohneLuecke.createDraft(MIT_ANKER, ANNA.id);

    const resA = await (await baueApp(mitLuecke, ANNA)).inject({ method: "GET", url: pfad(a.id) });
    const resB = await (await baueApp(ohneLuecke, ANNA)).inject({ method: "GET", url: pfad(b.id) });

    expect(`${resA.json().art} ≠ ${resB.json().art}`).toBe("anker_fehlt ≠ einreichen");
  });

  it("die Antwort ist zeichengleich das, was der Dienst sagt — keine zweite Ableitung", async () => {
    // DER WAECHTER GEGEN EINE ZWEITE WAHRHEIT: Wuerde die Route je selbst entscheiden, was der
    // naechste Schritt ist, liefe sie hier gegen den Dienst auseinander.
    const capture = dienstMitSpeicher([]);
    const entwurf = await capture.createDraft(MIT_ANKER, ANNA.id);
    const app = await baueApp(capture, ANNA);

    const ausDemDienst = await capture.naechsterSchrittFuerEntwurf(entwurf.id);
    const ausDerRoute = (await app.inject({ method: "GET", url: pfad(entwurf.id) })).json();

    expect(ausDerRoute).toEqual({
      art: ausDemDienst?.art,
      herkunft: [...(ausDemDienst?.herkunft ?? [])],
    });
  });
});

describe("JOB 1494 · KA8 1b — der ehrliche Leerfall kommt ohne Rumpf", () => {
  it("Ankerbezug vorhanden, aber nicht pruefbar ⇒ 204 und KEIN Rumpf", async () => {
    // Kein `objectExists` verdrahtet: ob das Einreichen gelaenge, ist UNBEKANNT. Der Dienst sagt
    // dann nichts (service.ts:101-109) — und der Endpunkt erfindet nichts dazu.
    const capture = new CaptureService({ repo: new InMemoryDraftRepo() });
    const entwurf = await capture.createDraft(MIT_ANKER, ANNA.id);
    const app = await baueApp(capture, ANNA);

    const res = await app.inject({ method: "GET", url: pfad(entwurf.id) });

    expect(res.statusCode).toBe(204);
    expect(res.body).toBe("");
  });

  it("der Leerfall ist NICHT dasselbe wie ein unbekannter Entwurf — 204 gegen 404", async () => {
    // Beide Lagen liefern im Dienst `undefined`. Wer sie nicht trennt, zeigt bei einem geloeschten
    // Entwurf dieselbe stille Antwort wie bei einer ehrlich unbekannten Lage.
    const capture = new CaptureService({ repo: new InMemoryDraftRepo() });
    const entwurf = await capture.createDraft(MIT_ANKER, ANNA.id);
    const app = await baueApp(capture, ANNA);

    const leer = await app.inject({ method: "GET", url: pfad(entwurf.id) });
    const unbekannt = await app.inject({ method: "GET", url: pfad("gibt-es-nicht") });

    expect(`${leer.statusCode}/${unbekannt.statusCode}`).toBe("204/404");
    expect(unbekannt.json().error).toBe("NOT_FOUND");
  });
});

describe("JOB 1494 · KA8 1b — Zugang", () => {
  it("ohne Anmeldung ⇒ 401, und der Dienst wird gar nicht erst gefragt", async () => {
    const capture = dienstMitSpeicher([]);
    const entwurf = await capture.createDraft(MIT_ANKER, ANNA.id);
    const app = await baueApp(capture, undefined);

    const res = await app.inject({ method: "GET", url: pfad(entwurf.id) });

    expect(res.statusCode).toBe(401);
  });

  it("fremder Entwurf ⇒ 403 fuer eine Expertin, 200 fuer die Verwaltung", async () => {
    // `canSeeDraft` stammt aus `capture-routes.ts` und ist hier NICHT nachgebaut. Beide Seiten der
    // Regel werden belegt, sonst pruefte der Fall nur die eine.
    const capture = dienstMitSpeicher([]);
    const fremder = await capture.createDraft(MIT_ANKER, "boris");

    const alsAnna = await (await baueApp(capture, ANNA)).inject({
      method: "GET",
      url: pfad(fremder.id),
    });
    const alsAdmin = await (await baueApp(capture, { id: "chefin", role: "admin" })).inject({
      method: "GET",
      url: pfad(fremder.id),
    });

    expect(`${alsAnna.statusCode}/${alsAdmin.statusCode}`).toBe("403/200");
    expect(alsAnna.json().error).toBe("FORBIDDEN");
  });
});

describe("JOB 1494 · KA8 1b — reine Lesung", () => {
  it("der Abruf aendert den Entwurf nicht, auch mehrfach nicht", async () => {
    const capture = dienstMitSpeicher(["obj-original-1"]);
    const entwurf = await capture.createDraft(MIT_ANKER, ANNA.id);
    const app = await baueApp(capture, ANNA);
    const vorher = JSON.stringify(await capture.getDraft(entwurf.id));

    await app.inject({ method: "GET", url: pfad(entwurf.id) });
    await app.inject({ method: "GET", url: pfad(entwurf.id) });

    expect(JSON.stringify(await capture.getDraft(entwurf.id))).toBe(vorher);
  });
});
