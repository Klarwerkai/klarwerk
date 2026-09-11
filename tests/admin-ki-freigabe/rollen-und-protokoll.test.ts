// ================================================================================================
// JOB 3549 · WER DARF DIE FREIGABE ÄNDERN, UND WAS BLEIBT DAVON STEHEN.
// ================================================================================================
//
// CODEX' AUFLAGE (Nachricht 93f857c5, wörtlich): „Eine Oberfläche kann nichts sicher erzwingen. Wer
// die Freigabe ändert, muss SERVERSEITIG geprüft werden, und die Änderung muss SERVERSEITIG
// protokolliert werden — mit Administrator, Zeit und Umfang."
//
// Deshalb misst diese Datei über den ECHTEN HTTP-Weg (`app.inject`), nicht am Dienst vorbei: Recht,
// Route, Protokoll und Wirkung hängen zusammen, und ein Test, der nur den Dienst ruft, würde genau
// die Naht überspringen, an der eine Rechteprüfung fehlen kann.
//
// DIE DREI PFLICHTFÄLLE von Codex, in dieser Datei namentlich:
//   - beide Freigaben gesetzt UND berechtigte Rolle ⇒ ein vertraulicher Cloudaufruf findet statt (R7);
//   - nicht berechtigte Rolle ⇒ KEIN Aufruf, keine Wirkung, kein Eintrag (R3, R4);
//   - jede Änderung der Freigabe wird mit Administrator, Zeit und Umfang auditiert (R2, R5, R6).
import { describe, expect, it } from "vitest";
import { type AppServices, buildApp, buildServices } from "../../services/app/src/build-app";
import {
  type AuditEntry,
  type AuditRepo,
  AuditService,
  InMemoryAuditRepo,
} from "../../services/audit";
import { ModelProvider, Reasoner } from "../../services/reasoner";
import type { ModelClient } from "../../services/reasoner/src/provider-model";

const FREIGABE_ZIEL = "reasoner.kiFreigabe";
// Bewusst als Zeichenkette und nicht als Import: der Code ist ein FLÄCHENVERTRAG. Wird er in
// `reasoner-routes.ts` umbenannt, muss dieser Test rot werden — ein mitgezogener Import täte das nicht.
const NICHT_PROTOKOLLIERBAR = "REASONER_FREIGABE_NICHT_PROTOKOLLIERBAR";

function zaehlenderClient() {
  let rufe = 0;
  const client: ModelClient = {
    name: "anthropic:test-modell",
    complete: async () => {
      rufe += 1;
      return "{}";
    },
  };
  return { client, rufe: () => rufe };
}

/** Ein vollständiges Haus: echte Routen, echtes Protokoll, ein eingerichteter Cloud-Anbieter. */
function haus(opts: { auditRepo?: AuditRepo } = {}) {
  const services: AppServices = buildServices();
  const cloud = zaehlenderClient();
  services.reasoner = new Reasoner(new ModelProvider(cloud.client));
  const auditRepo = opts.auditRepo ?? new InMemoryAuditRepo();
  services.audit = new AuditService({ repo: auditRepo });
  return { services, app: buildApp(services), cloud, auditRepo };
}

async function alsAdmin(app: ReturnType<typeof buildApp>, email = "admin@x.de") {
  // Der erste Registrierte ist der Bootstrap-Admin (users.manage).
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Pedi", email, password: "secret123" },
  });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password: "secret123" },
  });
  return {
    headers: { authorization: `Bearer ${(login.json() as { token: string }).token}` },
    id: (login.json() as { user?: { id: string } }).user?.id,
  };
}

/** Ein zweiter Nutzer mit `ko.read`, aber OHNE `users.manage` — vom Admin freigeschaltet. */
async function alsExperte(app: ReturnType<typeof buildApp>, adminHeaders: Record<string, string>) {
  const angelegt = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Erik", email: "erik@x.de", password: "secret123" },
  });
  await app.inject({
    method: "POST",
    url: `/api/auth/users/${(angelegt.json() as { id: string }).id}/approve`,
    headers: adminHeaders,
  });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "erik@x.de", password: "secret123" },
  });
  return { authorization: `Bearer ${(login.json() as { token: string }).token}` };
}

const put = (
  app: ReturnType<typeof buildApp>,
  headers: Record<string, string>,
  payload: Record<string, unknown>,
) => app.inject({ method: "PUT", url: "/api/reasoner/config", headers, payload });

const get = (app: ReturnType<typeof buildApp>, headers: Record<string, string>) =>
  app.inject({ method: "GET", url: "/api/reasoner/config", headers });

type Freigabe = { oeffentlicheKi?: boolean; vertraulicheInhalte?: boolean } | undefined;
const freigabeAus = (antwort: { json: () => unknown }): Freigabe =>
  (antwort.json() as { taskConfig: { kiFreigabe?: Freigabe } }).taskConfig.kiFreigabe;

const freigabeEintraege = async (repo: AuditRepo): Promise<AuditEntry[]> =>
  (await repo.all()).filter((e) => e.action.startsWith("reasoner.ki-freigabe"));

describe("JOB 3549 · R — Rollen und Protokoll am Adminweg /api/reasoner/config", () => {
  it("R1 · GET und PUT tragen die Freigabe über den VORHANDENEN Adminweg — kein zweiter Weg", async () => {
    const { app, auditRepo } = haus();
    const admin = await alsAdmin(app);

    const vorher = await get(app, admin.headers);
    expect(vorher.statusCode).toBe(200);
    // Fehlend heißt gesperrt — und es steht auch nichts anderes da (kein `{}`, kein `false`).
    expect(freigabeAus(vorher)).toBeUndefined();

    const gesetzt = await put(app, admin.headers, {
      global: "anthropic",
      perTask: {},
      kiFreigabe: { oeffentlicheKi: true },
    });
    expect(gesetzt.statusCode).toBe(200);
    expect(freigabeAus(gesetzt)).toEqual({ oeffentlicheKi: true });

    const nachher = await get(app, admin.headers);
    expect(freigabeAus(nachher)).toEqual({ oeffentlicheKi: true });
    expect((await freigabeEintraege(auditRepo)).length).toBe(1);
  });

  it("R2 · jede Erweiterung erzeugt einen Eintrag mit Administrator, Zeit und Umfang", async () => {
    const { app, auditRepo } = haus();
    const admin = await alsAdmin(app);

    await put(app, admin.headers, {
      global: "auto",
      perTask: {},
      kiFreigabe: { oeffentlicheKi: true },
    });
    await put(app, admin.headers, {
      global: "auto",
      perTask: {},
      kiFreigabe: { oeffentlicheKi: true, vertraulicheInhalte: true },
    });

    const eintraege = await freigabeEintraege(auditRepo);
    expect(eintraege.map((e) => e.action)).toEqual([
      "reasoner.ki-freigabe",
      "reasoner.ki-freigabe",
    ]);
    for (const eintrag of eintraege) {
      expect(eintrag.target).toBe(FREIGABE_ZIEL);
      // WER: der handelnde Administrator, nicht „system".
      expect(eintrag.actor).toBeTruthy();
      expect(eintrag.actor).not.toBe("system");
      // WANN: die Zeit steht in der Kette (ISO).
      expect(Date.parse(eintrag.at)).not.toBeNaN();
    }
    // UMFANG: von was auf was — beide Hälften, sonst ist der Eintrag nicht nachvollziehbar.
    expect(eintraege[0]?.payload).toEqual({
      vorher: { oeffentlicheKi: false, vertraulicheInhalte: false },
      nachher: { oeffentlicheKi: true, vertraulicheInhalte: false },
    });
    expect(eintraege[1]?.payload).toEqual({
      vorher: { oeffentlicheKi: true, vertraulicheInhalte: false },
      nachher: { oeffentlicheKi: true, vertraulicheInhalte: true },
    });
  });

  it("R3 · ohne Anmeldung: 401, keine Wirkung, kein Eintrag", async () => {
    const { app, auditRepo } = haus();
    const admin = await alsAdmin(app);
    const antwort = await app.inject({
      method: "PUT",
      url: "/api/reasoner/config",
      payload: { global: "auto", perTask: {}, kiFreigabe: { oeffentlicheKi: true } },
    });
    expect(antwort.statusCode).toBe(401);
    expect(freigabeAus(await get(app, admin.headers))).toBeUndefined();
    expect(await freigabeEintraege(auditRepo)).toEqual([]);
  });

  it("R4 · angemeldet, aber ohne `users.manage`: 403, keine Wirkung, kein Eintrag", async () => {
    const { app, auditRepo } = haus();
    const admin = await alsAdmin(app);
    const experte = await alsExperte(app, admin.headers);

    const antwort = await put(app, experte, {
      global: "auto",
      perTask: {},
      kiFreigabe: { oeffentlicheKi: true },
    });
    expect(antwort.statusCode).toBe(403);
    // Die Rechteprüfung steht VOR allem anderen: nichts gesetzt, nichts protokolliert.
    expect(freigabeAus(await get(app, admin.headers))).toBeUndefined();
    expect(await freigabeEintraege(auditRepo)).toEqual([]);
    // Und lesen darf er die Adminsicht auch nicht (WP-VIP2-GATE-2 bleibt unverändert).
    expect((await get(app, experte)).statusCode).toBe(403);
  });

  it("R5 · lässt sich eine ERWEITERUNG nicht protokollieren, wird sie NICHT erteilt (503)", async () => {
    // Ein Protokoll, das beim Anhängen scheitert. Eine Freigabe, die niemand belegen kann, ist keine.
    const echt = new InMemoryAuditRepo();
    const kaputt: AuditRepo = {
      append: async () => {
        throw new Error("Protokoll nicht schreibbar");
      },
      appendOnce: async () => {
        throw new Error("Protokoll nicht schreibbar");
      },
      all: () => echt.all(),
      last: (tx) => echt.last(tx),
    };
    const { app, cloud } = haus({ auditRepo: kaputt });
    const admin = await alsAdmin(app);

    const antwort = await put(app, admin.headers, {
      global: "auto",
      perTask: {},
      kiFreigabe: { oeffentlicheKi: true },
    });
    expect(antwort.statusCode).toBe(503);
    expect((antwort.json() as { error: string }).error).toBe(NICHT_PROTOKOLLIERBAR);

    // FAIL-CLOSED, und zwar messbar am Weg nach draußen — nicht nur am Statuscode.
    expect(freigabeAus(await get(app, admin.headers))).toBeUndefined();
    const lauf = await app.inject({
      method: "POST",
      url: "/api/reasoner",
      headers: admin.headers,
      payload: { task: "assist", text: "Ein roher Satz.", locale: "de", source: "ko" },
    });
    expect(lauf.statusCode).toBeGreaterThanOrEqual(200);
    expect(cloud.rufe()).toBe(0);
  });

  it("R6 · eine RÜCKNAHME wird protokolliert, aber nie blockiert — sie führt in die sichere Richtung", async () => {
    const { app, auditRepo } = haus();
    const admin = await alsAdmin(app);
    await put(app, admin.headers, {
      global: "auto",
      perTask: {},
      kiFreigabe: { oeffentlicheKi: true },
    });

    const zurueck = await put(app, admin.headers, {
      global: "auto",
      perTask: {},
      kiFreigabe: { oeffentlicheKi: false },
    });
    expect(zurueck.statusCode).toBe(200);
    expect(freigabeAus(zurueck)).toBeUndefined();

    const eintraege = await freigabeEintraege(auditRepo);
    expect(eintraege).toHaveLength(2);
    expect(eintraege[1]?.payload).toEqual({
      vorher: { oeffentlicheKi: true, vertraulicheInhalte: false },
      nachher: { oeffentlicheKi: false, vertraulicheInhalte: false },
    });
  });

  it("R7 · beide Freigaben UND berechtigte Rolle ⇒ ein VERTRAULICHER Cloudaufruf findet statt", async () => {
    const { app, cloud, services } = haus();
    const admin = await alsAdmin(app);

    // Vorher: derselbe vertrauliche Lauf geht NICHT hinaus.
    await services.reasoner.structure("Vertrauliche Rezeptur.", "de", true);
    expect(cloud.rufe()).toBe(0);

    const gesetzt = await put(app, admin.headers, {
      global: "auto",
      perTask: {},
      kiFreigabe: { oeffentlicheKi: true, vertraulicheInhalte: true },
    });
    expect(gesetzt.statusCode).toBe(200);

    await services.reasoner.structure("Vertrauliche Rezeptur.", "de", true);
    expect(cloud.rufe()).toBe(1);
  });

  it("R8 · WEGLASSEN lässt die Freigabe unverändert — und erzeugt keinen Eintrag", async () => {
    const { app, auditRepo } = haus();
    const admin = await alsAdmin(app);
    await put(app, admin.headers, {
      global: "auto",
      perTask: {},
      kiFreigabe: { oeffentlicheKi: true },
    });

    // Genau das schickt die Bestands-Oberfläche: nur die Zuordnung.
    const nurZuordnung = await put(app, admin.headers, { global: "anthropic", perTask: {} });
    expect(nurZuordnung.statusCode).toBe(200);
    expect(freigabeAus(nurZuordnung)).toEqual({ oeffentlicheKi: true });
    // Nichts geändert heißt nichts zu protokollieren — sonst verstopft ein unveränderter Speichern-
    // Klick die Kette mit Zeilen, die keine Änderung belegen.
    expect(await freigabeEintraege(auditRepo)).toHaveLength(1);
  });

  it("R9 · dasselbe zweimal setzen ist keine Erweiterung — ein Eintrag, nicht zwei", async () => {
    const { app, auditRepo } = haus();
    const admin = await alsAdmin(app);
    const rumpf = { global: "auto", perTask: {}, kiFreigabe: { oeffentlicheKi: true } };
    await put(app, admin.headers, rumpf);
    await put(app, admin.headers, rumpf);
    expect(await freigabeEintraege(auditRepo)).toHaveLength(1);
  });

  it("R10 · ENV-Sperre: der Beleg stand schon in der Kette ⇒ Korrektureintrag `…-nicht-wirksam`", async () => {
    const services: AppServices = buildServices();
    const cloud = zaehlenderClient();
    services.reasoner = new Reasoner(new ModelProvider(cloud.client));
    const auditRepo = new InMemoryAuditRepo();
    services.audit = new AuditService({ repo: auditRepo });
    // Genau der Boot-Schritt aus server.ts: die Zuordnung kommt aus der Deploy-ENV und ist gesperrt.
    await services.reasoner.loadPersistedPolicy({ envGlobal: "anthropic" });
    const app = buildApp(services);
    const admin = await alsAdmin(app);

    const antwort = await put(app, admin.headers, {
      global: "anthropic",
      perTask: {},
      kiFreigabe: { oeffentlicheKi: true },
    });
    expect(antwort.statusCode).toBe(409);

    // Das Protokoll ist append-only: der erste Eintrag bleibt stehen, die Korrektur ist ein ZWEITER.
    const eintraege = await freigabeEintraege(auditRepo);
    expect(eintraege.map((e) => e.action)).toEqual([
      "reasoner.ki-freigabe",
      "reasoner.ki-freigabe-nicht-wirksam",
    ]);
    // Und die Freigabe ist wirklich nicht wirksam geworden.
    expect(freigabeAus(await get(app, admin.headers))).toBeUndefined();
    // `assistText` wirft bei fehlendem Vorschlag bewusst (JOB 3276) — gemessen wird der Zähler.
    await services.reasoner.assistText("Roh.", "de").catch(() => undefined);
    expect(cloud.rufe()).toBe(0);
  });

  it("R11 · Unfug im Rumpf erteilt nichts — `false`, Zeichenketten und Fremdfelder sperren gleich", async () => {
    const { app, auditRepo } = haus();
    const admin = await alsAdmin(app);
    for (const unfug of [{ oeffentlicheKi: "true" }, { oeffentlicheKi: 1 }, { fremd: true }, {}]) {
      const antwort = await put(app, admin.headers, {
        global: "auto",
        perTask: {},
        kiFreigabe: unfug,
      });
      expect([unfug, antwort.statusCode]).toEqual([unfug, 200]);
      expect([unfug, freigabeAus(antwort)]).toEqual([unfug, undefined]);
    }
    // Nichts davon war eine Erweiterung, also steht auch nichts in der Kette.
    expect(await freigabeEintraege(auditRepo)).toEqual([]);
  });

  // ==============================================================================================
  // JOB 3549 R4 · DER RIEGEL AM ARBEITSWEG — NICHT NUR AM DIENST.
  // ==============================================================================================
  //
  // DIE LÜCKE, DIE DIESER FALL SCHLIESST. Alle bisherigen Fälle dieser Datei fahren den ADMINWEG
  // (`PUT /api/reasoner/config`) über HTTP und messen die Wirkung dann AM DIENST
  // (`services.reasoner.structure(…)`, R7 `:268`). Damit war die eine Naht ungeprüft, an der ein
  // echter Benutzer entlangkommt: `POST /api/reasoner`. Sie ist nicht dieselbe Strecke — die Route
  // baut aus Rumpf, Herkunft und Einstufung erst den Aufruf, den der Dienst dann sieht (Stufe aus
  // `source`, Erben aus `koId`, Ableitung der Vertraulichkeit). Ein Riegel, der am Dienst greift,
  // aber auf diesem Weg umgangen würde, wäre an genau der Stelle wirkungslos, an der es zählt.
  //
  // WARUM DIESER FALL HIER STEHT UND NICHT DORT, WO ER HINGEHÖRT. Er ist das Gegenstück zu
  // `services/app/src/routes/reasoner-egress.test.ts` („Positiv: bewusst intern deklarierter Upload
  // → Cloud-complete läuft"). Diese Datei kann die Freigabe im Aufbau NICHT setzen: der Testhelfer
  // (`services/reasoner/src/testhelfer-ki-freigabe.ts`) ist von `services/app` aus wegen der
  // Modulgrenze nicht importierbar, und die Felder von Hand zu schreiben verbietet der
  // Freigabe-Wächter F2 für die ganze Fläche. Beides ist gemessen und im Register
  // (`tests/ki-anbieterwahl/routing-zwei-attrappen.test.ts`, OHNE_FREIGABE_MIT_GRUND, Eintrag „(X)
  // BLOCKIERT") festgehalten. `tests/admin-ki-freigabe/**` ist der eine Ordner, der die Felder
  // nennen darf — deshalb liegt der Beleg hier, bis die Modulfläche entschieden ist.
  //
  // WAS ER BEWEIST, und was nicht: er beweist, dass der Riegel am Arbeitsweg GENAU an der Freigabe
  // hängt — derselbe Aufruf, einmal ohne und einmal mit, ein Schalter Unterschied. Er beweist NICHT,
  // dass die vier blockierten Dateien grün würden; das kann nur ihr eigener Lauf.
  it("R12 · der ARBEITSWEG `POST /api/reasoner`: ohne Freigabe kein Modellaufruf, mit Freigabe einer", async () => {
    const { app, cloud } = haus();
    const admin = await alsAdmin(app);
    // Ein bewusst als INTERN deklarierter Upload — also gerade NICHT vertraulich. Damit hängt der
    // Fall allein an der GRUNDfreigabe; die zweite Freigabe kommt hier nicht vor und wird auch nicht
    // gesetzt. Wortgleich zum blockierten Fall in `reasoner-egress.test.ts`.
    const arbeit = () =>
      app.inject({
        method: "POST",
        url: "/api/reasoner",
        headers: admin.headers,
        payload: {
          task: "extract",
          text:
            "Nach dem Anfahren zehn Sekunden warten, dann die Pumpe entlüften und den Druck prüfen. " +
            "Bei Überdruck sofort das Ventil schließen und den Vorgang dokumentieren.",
          source: "transient-document",
          confidentiality: "intern",
        },
      });

    // OHNE Freigabe: die Route antwortet weiter (der deterministische Ersatz trägt), aber nichts
    // verlässt das Haus. Die 200 gehört dazu — gesperrt heißt nicht kaputt.
    const ohne = await arbeit();
    expect(ohne.statusCode).toBe(200);
    expect(cloud.rufe()).toBe(0);

    // Der ECHTE Adminweg erteilt die Grundfreigabe — kein Griff an den Dienst vorbei.
    const gesetzt = await put(app, admin.headers, {
      global: "auto",
      perTask: {},
      kiFreigabe: { oeffentlicheKi: true },
    });
    expect(gesetzt.statusCode).toBe(200);

    // MIT Freigabe: derselbe Aufruf, jetzt läuft das Modell. Ein Schalter Unterschied.
    const mit = await arbeit();
    expect(mit.statusCode).toBe(200);
    expect(cloud.rufe()).toBe(1);
  });
});
