// ================================================================================================
// JOB 2697 · D7 · FALL 2 — DIE KETTE: Route → Service → Ablage, und kein Weg daneben.
// ================================================================================================
//
// DIE PRÜFLÜCKE, WÖRTLICH (`BEN-PRUEFUNG-JOB-2697-D5.md:16`):
//
//   „Route-/Service-Vertragstest am im Folgeauftrag konkret zu benennenden Capture-Routenpfad:
//    Route mit `operationId` aufrufen und Service sowie Repo instrumentieren. Erwartet: Route
//    delegiert genau einmal an den Service, der Service genau einmal an `insertIfOperationAbsent`;
//    die Route besitzt weder Repo-Abhängigkeit noch eigenes Register."
//
// WARUM DAS EIN EIGENER FALL IST: Die Idempotenz kann an drei Stellen sitzen — in der Route, im
// Dienst oder in der Ablage. Nur die Ablage trägt sie über zwei Serverinstanzen und über einen
// Neustart. D4 hatte ein prozesslokales Register in der Route; BEN hat es als „schwächere
// Zusicherung" verworfen. Dieser Fall pinnt, dass es nicht zurückkommt.
//
// GEMESSEN WIRD AN DER ECHTEN APP (`buildApp`) über die echte Route — die Zählung läuft an einer
// Ablage, die jeden Aufruf mitschreibt und sonst die echte `InMemoryDraftRepo` ist.
import { describe, expect, it, vi } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { CaptureService } from "../../services/capture";
import { InMemoryDraftRepo } from "../../services/capture/src/repo";
import type { Draft } from "../../services/capture/src/types";

type App = ReturnType<typeof buildApp>;

/** Die echte Ablage, mit einem Zähler an jedem Schreibweg. */
class ZaehlendeAblage extends InMemoryDraftRepo {
  insertAufrufe = 0;
  vorgangsAufrufe = 0;

  override insert(draft: Draft): Promise<void> {
    this.insertAufrufe += 1;
    return super.insert(draft);
  }

  override insertIfOperationAbsent(draft: Draft) {
    this.vorgangsAufrufe += 1;
    return super.insertIfOperationAbsent(draft);
  }
}

async function login(app: App, email: string, password: string) {
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password },
  });
  const headers = { authorization: `Bearer ${res.json().token}` };
  return { headers };
}

async function setup() {
  const ablage = new ZaehlendeAblage();
  const services = buildServices();
  // Die echte App mit der zählenden Ablage — der Dienst ist der echte `CaptureService`.
  const capture = new CaptureService({ repo: ablage });
  const app = buildApp({ ...services, capture });
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Anna", email: "a@x.de", password: "secret123" },
  });
  const anna = await login(app, "a@x.de", "secret123");
  return { app, anna, ablage, capture };
}

const anlegen = (app: App, headers: Record<string, string>, body: Record<string, unknown>) =>
  app.inject({ method: "POST", url: "/api/drafts", headers, payload: body });

describe("JOB 2697 D7 · Fall 2 · Route, Dienst, Ablage", () => {
  it("V1 · die Route delegiert GENAU EINMAL an den Dienst", async () => {
    const { app, anna, capture } = await setup();
    const spion = vi.spyOn(capture, "createDraftVorgang");

    const res = await anlegen(app, anna.headers, { title: "Ventil", operationId: "op-1" });

    expect(res.statusCode).toBe(201);
    expect(spion).toHaveBeenCalledTimes(1);
    // Der Eigentümer kommt aus der Session, nicht aus dem Rumpf — dritter Parameter ist die Kennung.
    expect(spion.mock.calls[0]?.[2]).toBe("op-1");
  });

  it("V2 · der Dienst geht GENAU EINMAL über insertIfOperationAbsent", async () => {
    const { app, anna, ablage } = await setup();

    await anlegen(app, anna.headers, { title: "Ventil", operationId: "op-1" });

    expect(ablage.vorgangsAufrufe).toBe(1);
    expect(ablage.insertAufrufe, "der Dienst ging am Vorgangsweg vorbei").toBe(0);
  });

  it("V3 · die Route ruft die Ablage NIE direkt", async () => {
    // Gemessen an der Delegation: jeder Schreibaufruf an der Ablage hat den Dienst durchlaufen.
    const { app, anna, ablage, capture } = await setup();
    const spion = vi.spyOn(capture, "createDraftVorgang");

    await anlegen(app, anna.headers, { title: "Ventil", operationId: "op-1" });

    expect(ablage.vorgangsAufrufe + ablage.insertAufrufe).toBe(spion.mock.calls.length);
  });

  it("V4 · KEIN EIGENES REGISTER: der zweite Aufruf geht wieder an die Ablage, sie entscheidet", async () => {
    // Ein Register in Route oder Dienst würde den zweiten Aufruf abfangen, BEVOR die Ablage ihn
    // sieht — genau der D4-Bau. Dann stünde hier eine 1 statt einer 2, und die Zusage hinge an
    // einem Prozess statt an einem Index.
    const { app, anna, ablage } = await setup();

    const erst = await anlegen(app, anna.headers, { title: "Ventil", operationId: "op-1" });
    const zweit = await anlegen(app, anna.headers, { title: "Ventil", operationId: "op-1" });

    expect(ablage.vorgangsAufrufe, "der zweite Aufruf erreichte die Ablage nicht").toBe(2);
    expect(erst.statusCode).toBe(201);
    expect(zweit.statusCode, "die Wiederholung meldete eine Neuanlage").toBe(200);
    expect(zweit.json().id).toBe(erst.json().id);
    expect(await ablage.list()).toHaveLength(1);
  });

  it("V5 · KALIBRIERUNG: ohne Kennung läuft der Bestandsweg über insert", async () => {
    // Ohne diesen Fall wären V1 bis V4 auch dann grün, wenn JEDER Aufruf durch den Vorgangsweg
    // liefe und der unveränderte Pfad still verschwunden wäre.
    const { app, anna, ablage } = await setup();

    const res = await anlegen(app, anna.headers, { title: "Ventil" });

    expect(res.statusCode).toBe(201);
    expect(ablage.insertAufrufe).toBe(1);
    expect(ablage.vorgangsAufrufe).toBe(0);
  });

  it("V6 · DER SCHLÜSSEL BLEIBT DRAUSSEN: der gespeicherte Entwurf trägt kein operationId im payload", async () => {
    // Der Fehler aus D1: `capture.toKoInput` liest den PAYLOAD und trägt ihn beim Einreichen ins
    // Wissensobjekt. Eine Kennung dort wäre für immer im Dokument.
    const { app, anna, ablage } = await setup();

    await anlegen(app, anna.headers, { title: "Ventil", operationId: "op-1" });

    const gespeichert = (await ablage.list())[0];
    expect(Object.hasOwn(gespeichert?.payload ?? {}, "operationId")).toBe(false);
    expect(gespeichert?.createOperation?.id, "der Vorgang steht nicht am Entwurf").toBe("op-1");
  });

  it("V7 · der Eigentümer kommt SERVERSEITIG aus der Sitzung, nicht aus dem Rumpf", async () => {
    // Ein `actor` aus dem Rumpf liesse jeden den Vorgang eines anderen adressieren.
    const { app, anna, ablage } = await setup();

    await anlegen(app, anna.headers, {
      title: "Ventil",
      operationId: "op-1",
      createOperation: { id: "op-1", actor: "jemand-anders", fingerprint: "gefaelscht" },
    });

    const gespeichert = (await ablage.list())[0];
    expect(gespeichert?.createOperation?.actor).not.toBe("jemand-anders");
    expect(gespeichert?.createOperation?.actor).toBe(gespeichert?.originalAuthor);
  });

  it("V8 · abweichender Inhalt unter derselben Kennung: 409, und der erste Entwurf bleibt", async () => {
    const { app, anna, ablage } = await setup();

    await anlegen(app, anna.headers, { title: "Ventil", operationId: "op-1" });
    const konflikt = await anlegen(app, anna.headers, {
      title: "Ganz anders",
      operationId: "op-1",
    });

    expect(konflikt.statusCode).toBe(409);
    expect(konflikt.json().error).toBe("IDEMPOTENCY_PAYLOAD_MISMATCH");
    expect(await ablage.list(), "der Konflikt hat trotzdem angelegt").toHaveLength(1);
    expect((await ablage.list())[0]?.payload.title).toBe("Ventil");
  });

  it("V9 · zwei Menschen, dieselbe Kennung: zwei Entwürfe, keiner sieht den anderen", async () => {
    // AM DIENST GEMESSEN, nicht über HTTP — und zwar aus einem Umgebungsgrund, nicht aus Bequem-
    // lichkeit: ein zweiter frisch registrierter Nutzer hat kein `ko.create` und bekäme an der
    // Route ein 401, bevor die Eigentümerbindung überhaupt geprüft würde (gemessen: 401 statt
    // 201). Die HTTP-Kette ist in V1 bis V8 belegt; hier geht es um die Frage, ob der Schlüssel
    // eigentümergebunden ist — und die entscheidet sich im Dienst und in der Ablage.
    //
    // Die Denial-Kante: Wäre der Schlüssel nur die Kennung, könnte eine Person mit einer geratenen
    // Kennung die Anlage einer anderen blockieren oder deren Entwurf bekommen.
    const { ablage, capture } = await setup();

    const a = await capture.createDraftVorgang({ title: "Ventil" }, "u1", "op-1");
    const b = await capture.createDraftVorgang({ title: "Pumpe" }, "u2", "op-1");

    expect(a.angelegt).toBe(true);
    expect(b.angelegt, "u2 wurde von der Kennung von u1 blockiert").toBe(true);
    expect(a.draft.id).not.toBe(b.draft.id);
    expect(await ablage.list()).toHaveLength(2);
    expect(b.draft.payload.title, "u2 bekam den Entwurf von u1").toBe("Pumpe");
  });

  it("V10 · ein leerer Schlüssel ist kein Schlüssel — dann gilt der Bestandsweg", async () => {
    const { app, anna, ablage } = await setup();

    await anlegen(app, anna.headers, { title: "Ventil", operationId: "   " });

    expect(ablage.insertAufrufe).toBe(1);
    expect(ablage.vorgangsAufrufe).toBe(0);
  });
});
