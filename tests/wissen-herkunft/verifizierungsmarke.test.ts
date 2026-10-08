// ================================================================================================
// Aufnahme gesamt-wissen-herkunft · R-0228 — DIE VERIFIZIERUNGSMARKE, SERVERSEITIG.
// ================================================================================================
//
// „An jedem Wissensobjekt steht, wer es wann geprüft hat und ob der maschinelle Prüflauf
// vollständig war." Geprüft wird der menschliche Teil der Marke an `GET /api/kos/:id`
// (services/app/src/verifizierungsmarke.ts) — den maschinellen Teil leitet die Oberfläche ab
// (verifizierungsmarke-anzeige.test.tsx):
//   V1 · ohne Entscheidung: ehrlich „keine", keine erfundene Prüfung;
//   V2 · nach einer Verwalterfreigabe: Prüfer, Zeitpunkt, Fassung, aktuell — aus GENAU dem
//        verwiesenen Protokolleintrag;
//   V3 · nach einer Revision: die Prüfung gilt der früheren Fassung (`aktuell: false`);
//   V4 · ein Verweis, dessen Eintrag nicht passt (Folgenummer, Hash), heißt „nicht auffindbar";
//        ein nicht lesbares Protokoll „nicht abrufbar" — nie „belegt";
//   V5 · Leserecht: ein unsichtbares Objekt bleibt 404, die Marke verrät nichts.
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { verifizierungFuer } from "../../services/app/src/verifizierungsmarke";
import type { KnowledgeObject } from "../../services/knowledge-object/src/types";

const KENNWORT = "secret123";

async function aufbau() {
  const services = buildServices();
  const app = buildApp(services);
  // Das erste Konto einer leeren Instanz ist Verwalter und sieht damit jedes Objekt.
  const admin = await services.auth.register({
    name: "Pia Admin",
    email: "pia-r0228@x.de",
    password: KENNWORT,
  });
  const adminId = admin.id;
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "pia-r0228@x.de", password: KENNWORT },
  });
  const headers = { authorization: `Bearer ${(login.json() as { token: string }).token}` };
  const ko = await services.ko.create({
    title: "Presse entlüften",
    statement: "Vor dem Anfahren entlüften.",
    type: "best_practice",
    category: "Technik",
    author: adminId,
    neededValidations: 2,
  });
  const lesen = async (): Promise<KnowledgeObject & { verifizierung?: unknown }> => {
    const antwort = await app.inject({ method: "GET", url: `/api/kos/${ko.id}`, headers });
    expect(antwort.statusCode).toBe(200);
    return antwort.json();
  };
  return { services, app, adminId, ko, lesen };
}

describe("R-0228 · die Verifizierungsmarke am Detailabruf", () => {
  it("V1 · ohne Entscheidung steht ehrlich „keine“ da — kein erfundener Prüfer", async () => {
    const { lesen } = await aufbau();
    const marke = (await lesen()).verifizierung;
    expect(marke).toEqual({ mensch: { stand: "keine" }, validiertVon: [] });
  });

  it("V2 · nach der Verwalterfreigabe: Prüfer, Zeitpunkt und Fassung aus dem verwiesenen Eintrag", async () => {
    const { services, adminId, ko, lesen } = await aufbau();
    await services.validation.adminValidate(ko.id, adminId);

    const gelesen = await lesen();
    const marke = gelesen.verifizierung as {
      mensch: { stand: string; art: string; pruefer: string; zeitpunkt: string };
    };
    expect(marke.mensch).toMatchObject({
      stand: "belegt",
      art: "verwalter",
      pruefer: adminId,
      fassung: gelesen.version,
      aktuell: true,
    });
    expect(Number.isNaN(Date.parse(marke.mensch.zeitpunkt))).toBe(false);
    // Der Zeitpunkt ist der des verwiesenen Eintrags — nicht „jetzt", nicht die Anlage.
    const eintraege = await services.audit.list({ target: ko.id });
    const verwiesen = eintraege.find((e) => e.seq === gelesen.validationDecisionRef?.auditSeq);
    expect(marke.mensch.zeitpunkt).toBe(verwiesen?.at);
  });

  it("V3 · nach einer Revision gilt die Prüfung einer früheren Fassung", async () => {
    const { services, adminId, ko, lesen } = await aufbau();
    await services.validation.adminValidate(ko.id, adminId);
    await services.ko.revise(ko.id, { statement: "Vor dem Anfahren zweimal entlüften." }, adminId);

    const gelesen = await lesen();
    expect(gelesen.version).toBe(2);
    expect((gelesen.verifizierung as { mensch: unknown }).mensch).toMatchObject({
      stand: "belegt",
      fassung: 1,
      aktuell: false,
    });
  });

  it("V5 · ohne Anmeldung gibt es weder Objekt noch Marke", async () => {
    const { app, ko } = await aufbau();
    const antwort = await app.inject({ method: "GET", url: `/api/kos/${ko.id}` });
    expect(antwort.statusCode).toBe(401);
    expect(antwort.body).not.toContain("verifizierung");
  });
});

describe("R-0228 · V4 — ein nicht passender Verweis wird nie zu „belegt“", () => {
  const eintrag = {
    seq: 7,
    at: "2026-09-01T10:00:00.000Z",
    actor: "u-pruefer",
    action: "ko.rated",
    target: "ko-1",
    payload: { koVersion: 3 },
    prevHash: "x",
    hash: "h-7",
  };
  const ko = (ref: { auditSeq: number; auditHash: string }) =>
    ({
      id: "ko-1",
      version: 3,
      validationDecisionRef: ref,
      ownership: { reviewers: [], validators: ["u-pruefer"] },
    }) as unknown as KnowledgeObject;
  const audit = { list: async () => [eintrag] };

  it("passend: belegt, mit den Validierenden aus dem Eigentümer-Aggregat", async () => {
    expect(await verifizierungFuer(ko({ auditSeq: 7, auditHash: "h-7" }), audit)).toEqual({
      mensch: {
        stand: "belegt",
        art: "bewertung",
        pruefer: "u-pruefer",
        zeitpunkt: "2026-09-01T10:00:00.000Z",
        fassung: 3,
        aktuell: true,
      },
      validiertVon: ["u-pruefer"],
    });
  });

  it("falsche Folgenummer oder falscher Hash: nicht auffindbar", async () => {
    for (const ref of [
      { auditSeq: 8, auditHash: "h-7" },
      { auditSeq: 7, auditHash: "anders" },
    ]) {
      const marke = await verifizierungFuer(ko(ref), audit);
      expect(marke.mensch, JSON.stringify(ref)).toEqual({ stand: "nicht_auffindbar" });
    }
  });

  it("ein Eintrag, der keine Entscheidung ist, deckt nichts", async () => {
    const zuweisung = { list: async () => [{ ...eintrag, action: "ko.assigned" }] };
    const marke = await verifizierungFuer(ko({ auditSeq: 7, auditHash: "h-7" }), zuweisung);
    expect(marke.mensch).toEqual({ stand: "nicht_auffindbar" });
  });

  it("nicht lesbares Protokoll oder keins verdrahtet: nicht abrufbar", async () => {
    const kaputt = {
      list: async () => {
        throw new Error("Protokoll weg");
      },
    };
    const ref = { auditSeq: 7, auditHash: "h-7" };
    for (const protokoll of [kaputt, undefined]) {
      const marke = await verifizierungFuer(ko(ref), protokoll);
      expect(marke.mensch).toEqual({ stand: "nicht_abrufbar" });
    }
  });
});
