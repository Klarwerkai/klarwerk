// ================================================================================================
// W3-C (JOB 541 D3) — DIE ERKLAERROUTE AM ECHTEN DRAHT.
// ================================================================================================
//
// Gemessen wird ueber `app.inject()`: kein Port, kein Netz, aber der VOLLE Weg — Anmeldung,
// Wache, Route, Dienst, Belegspeicher. Ein Dienst-Test allein koennte nicht zeigen, dass die
// Route verdrahtet ist und ihre Wache traegt; genau das war der offene Punkt aus D2.
//
// DIE FUENF ZUSTAENDE des Vertrags stehen hier einzeln:
//   OK · NOT_FOUND (unbekannt) · NOT_FOUND (fremd) · NO_SNAPSHOT · REDACTED
import { describe, expect, it } from "vitest";
import {
  ANSWER_SNAPSHOT_SCHEMA_VERSION,
  type AnswerEvidenceRef,
  type AnswerEvidenceSnapshot,
  hashAnswerSnapshot,
} from "../../ask";
import {
  type AppServices,
  assembleServices,
  buildApp,
  buildServices,
  inMemoryRepos,
} from "./build-app";

const PASS = "secret123";

async function admin(app: ReturnType<typeof buildApp>, email = "anna541@x.de") {
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Anna", email, password: PASS },
  });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password: PASS },
  });
  if (login.statusCode !== 200) {
    throw new Error(`Anmeldung fehlgeschlagen: ${login.statusCode} ${login.body}`);
  }
  return { authorization: `Bearer ${login.json().token}` };
}

async function zweiterNutzer(
  app: ReturnType<typeof buildApp>,
  auth: Record<string, string>,
  email: string,
) {
  const res = await app.inject({
    method: "POST",
    url: "/api/users",
    headers: auth,
    payload: { name: email, email, password: PASS, role: "experte" },
  });
  if (res.statusCode !== 201) {
    throw new Error(`Konto ${email} nicht angelegt: ${res.statusCode} ${res.body}`);
  }
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password: PASS },
  });
  return { authorization: `Bearer ${login.json().token}` };
}

/** Legt ein belegfaehiges Wissensobjekt an und stellt die Frage, die es trifft. */
async function frageMitBeleg(
  app: ReturnType<typeof buildApp>,
  auth: Record<string, string>,
  opts: { vertraulich?: boolean } = {},
) {
  const ko = await app.inject({
    method: "POST",
    url: "/api/kos",
    headers: auth,
    payload: {
      title: "Ventil bei Ueberdruck schliessen",
      statement: "Bei Ueberdruck Ventil X manuell schliessen.",
      type: "best_practice",
      category: "Anlage 1",
      ...(opts.vertraulich ? { confidentiality: "vertraulich" } : {}),
    },
  });
  if (ko.statusCode !== 201) {
    throw new Error(`KO nicht angelegt: ${ko.statusCode} ${ko.body}`);
  }
  const ask = await app.inject({
    method: "POST",
    url: "/api/ask",
    headers: auth,
    payload: { question: "Was tun bei Ueberdruck am Ventil?" },
  });
  if (ask.statusCode !== 200) {
    throw new Error(`Frage fehlgeschlagen: ${ask.statusCode} ${ask.body}`);
  }
  return { koId: ko.json().id as string, answerId: ask.json().answerId as string | null };
}

function erklaerung(
  app: ReturnType<typeof buildApp>,
  auth: Record<string, string>,
  answerId: string,
) {
  return app.inject({
    method: "GET",
    url: `/api/klara/answers/${answerId}/explanation`,
    headers: auth,
  });
}

describe("W3-C · GET /api/klara/answers/:answerId/explanation", () => {
  it("die Route ist verdrahtet und liefert dem Eigentuemer seine Erklaerung", async () => {
    const app = buildApp(buildServices());
    const auth = await admin(app);
    const { koId, answerId } = await frageMitBeleg(app, auth);
    expect(answerId, "der Antwortlauf muss eine Kennung ausweisen").not.toBeNull();

    const res = await erklaerung(app, auth, String(answerId));
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.state).toBe("OK");
    expect(body.answerId).toBe(answerId);
    expect(body.evidenceCount).toBeGreaterThan(0);

    const beleg = body.evidence.find(
      (e: { knowledgeObjectId: string }) => e.knowledgeObjectId === koId,
    );
    expect(beleg, "das belegende Objekt fehlt in der Erklaerung").toBeDefined();
    // Die Fassung ist gebunden — der eigentliche Fortschritt dieses Durchgangs.
    expect(beleg.knowledgeObjectVersion).toBeGreaterThan(0);
    // Und die Referenzlage steht je Beleg, nicht oben.
    const hatRef = beleg.validationDecisionRef !== null;
    const hatGrund = beleg.validationReferenceAbsenceReason !== null;
    expect(hatRef !== hatGrund).toBe(true);
  });

  it("eine unbekannte Kennung ergibt 404", async () => {
    const app = buildApp(buildServices());
    const auth = await admin(app);
    const res = await erklaerung(app, auth, "gibt-es-nicht");
    expect(res.statusCode).toBe(404);
  });

  it("GEGENFALL · eine FREMDE Antwort ergibt DASSELBE 404 — kein Unterschied nach aussen", async () => {
    const app = buildApp(buildServices());
    const auth = await admin(app);
    const { answerId } = await frageMitBeleg(app, auth);
    const bernd = await zweiterNutzer(app, auth, "bernd541@x.de");

    const fremd = await erklaerung(app, bernd, String(answerId));
    const unbekannt = await erklaerung(app, bernd, "gibt-es-nicht");
    expect(fremd.statusCode).toBe(404);
    // Ununterscheidbar: gleicher Code UND gleicher Rumpf. Sonst waere die Kennung selbst eine
    // Auskunft darueber, dass es diese fremde Antwort gibt.
    expect(fremd.body).toBe(unbekannt.body);
  });

  it("ohne Anmeldung gibt es keine Erklaerung", async () => {
    const app = buildApp(buildServices());
    const auth = await admin(app);
    const { answerId } = await frageMitBeleg(app, auth);
    const res = await app.inject({
      method: "GET",
      url: `/api/klara/answers/${answerId}/explanation`,
    });
    expect(res.statusCode).toBeGreaterThanOrEqual(401);
    expect(res.statusCode).toBeLessThan(404);
  });

  // ==============================================================================================
  // JOB 541 D4 (BEN-Prüflücke 2) — DIE ANDERE SEITE DERSELBEN TRENNUNG.
  // ==============================================================================================
  //
  // Der Fall darunter beweist: eine Systemantwort gehört keinem Konto. BEN verlangt den GEGENFALL
  // dazu — sonst ist die Trennung nur einseitig belegt und „alles ist System" erfüllte sie ebenso:
  // ein Konto mit der tatsächlichen Kennung `system` muss seine EIGENE Antwort lesen dürfen und
  // trotzdem an einer echten Systemantwort scheitern.
  //
  // WARUM DIE VORRICHTUNG SO AUSSIEHT: Über HTTP ist die Kontokennung nicht wählbar — sie entsteht
  // beim Anlegen. Für diesen einen Fall wird deshalb ein regulär angelegtes Konto als Vorlage
  // genommen und mit der gewünschten Kennung ein zweites Mal eingesetzt. Das ist Prüfvorrichtung,
  // kein Produkteingriff: Anmeldung, Wache, Route und Dienst laufen danach unverändert.
  it("GEGENFALL · ein Konto mit der ID `system` liest seine EIGENE Antwort (200), eine echte Systemantwort nicht (404)", async () => {
    const repos = inMemoryRepos();
    const services = assembleServices(repos);
    const app = buildApp(services);
    const auth = await admin(app, "anna541b@x.de");

    // Eine Vorlage mit gültigem Passwortnachweis — daraus entsteht das Konto mit der Kennung
    // `system`. Nur `id` und `email` weichen ab; alles andere bleibt das reguläre Konto.
    await zweiterNutzer(app, auth, "vorlage541@x.de");
    const vorlage = await repos.users.findByEmail("vorlage541@x.de");
    expect(vorlage, "die Vorlage wurde nicht angelegt").toBeDefined();
    if (vorlage === undefined) {
      throw new Error("Vorlage fehlt");
    }
    await repos.users.insert({ ...vorlage, id: "system", email: "system541@x.de" });

    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "system541@x.de", password: PASS },
    });
    expect(login.statusCode, `Anmeldung als \`system\` fehlgeschlagen: ${login.body}`).toBe(200);
    const systemKonto = { authorization: `Bearer ${login.json().token}` };

    // (1) SEINE EIGENE Antwort — der Fall, den D3 verlor.
    const eigene = await frageMitBeleg(app, systemKonto);
    expect(eigene.answerId, "der Antwortlauf muss eine Kennung ausweisen").not.toBeNull();
    const eigeneErklaerung = await erklaerung(app, systemKonto, String(eigene.answerId));
    expect(
      eigeneErklaerung.statusCode,
      "Das Konto `system` bekommt seine EIGENE Antwort nicht zu sehen — genau der Datenfehler aus dem Urteil.",
    ).toBe(200);
    expect(eigeneErklaerung.json().answerId).toBe(eigene.answerId);

    // (2) Eine UNABHÄNGIGE echte Systemantwort — sie bleibt ihm fremd.
    const systemLauf = await services.ask.ask("Was tun bei Ueberdruck am Ventil?");
    expect(systemLauf.answerId).not.toBeNull();
    const systemRecord = await services.answerSnapshots.findRecord(String(systemLauf.answerId));
    expect(systemRecord?.owner, "die Systemantwort ist keine Systemantwort mehr").toEqual({
      kind: "system",
    });

    const fremd = await erklaerung(app, systemKonto, String(systemLauf.answerId));
    const unbekannt = await erklaerung(app, systemKonto, "gibt-es-nicht");
    expect(
      fremd.statusCode,
      "Das Konto `system` erreicht eine echte Systemantwort — die Verwechslung ist zurück.",
    ).toBe(404);
    // Und ununterscheidbar von „gibt es nicht": derselbe Rumpf wie für einen Fremden.
    expect(fremd.body).toBe(unbekannt.body);
  });

  // ==============================================================================================
  // JOB 541 D5 (BEN-Korrekturpflicht) — DIE ZUSTANDSTABELLE ALS ECHTER HTTP-VERTRAG.
  // ==============================================================================================
  //
  // BEN woertlich: "Einheitentests UNTERHALB der Route ersetzen diese fuenf HTTP-Faelle nicht."
  // Deshalb steht hier je Zustand ein ausfuehrbarer Fall, der ueber `GET /api/klara/answers/
  // :answerId/explanation` geht und Status UND Rumpf zusichert. D4 hatte fuer VALID und REDACTED
  // nur auf Einheitentests verwiesen — genau das war der Rotgrund.
  //
  // | Zustand     | Aufbau                                            | HTTP | Rumpf                                        |
  // |-------------|---------------------------------------------------|------|----------------------------------------------|
  // | VALID       | vollstaendiger Beleg (Quellrevision, Fundstelle,  | 200  | state OK, integrity VALID, evidenceCount 1,  |
  // |             | Referenz je Evidence, Aufloesung) in der Ablage    |      | Evidence traegt Kennung, Fassung, Referenz   |
  // | DEGRADED    | jede gewoehnliche Antwort des Produktwegs          | 200  | state OK, integrity DEGRADED, Belege sichtbar|
  // | INVALIDATED | tragende Quelle nach der Antwort hart geloescht    | 200  | state OK, integrity INVALIDATED, evidence [] |
  // |             |                                                   |      | bei evidenceCount > 0                        |
  // | REDACTED    | Quelle nach der Antwort vertraulich, Leser ohne   | 200  | state OK, Zeilen redacted, KEINE Kennung,    |
  // |             | Recht (Rolle experte)                             |      | evidenceCount bleibt stehen                  |
  // | NO_SNAPSHOT | Record ohne Beleg (Abbruch zwischen zwei Writes)  | 200  | state NO_SNAPSHOT, answerId, KEIN integrity  |
  //
  // JOB 541 D6 — DIE FUENFTE ZEILE TRAEGT IHREN ZUSTAND JETZT WIRKLICH. In D5 meldete die Route
  // hier `DEGRADED`, obwohl die Schwaerzung wirkte; BEN hat das zu Recht verworfen: ein Testname
  // `REDACTED` bei erwartetem `DEGRADED` ist kein fuenfter Zustandsfall. Die kleinste Verdrahtung
  // sitzt jetzt in `klara-answer-explanation-routes.ts` und benennt den Zustand, den die Zeilen
  // ohnehin schon zeigen. Die vier uebrigen Zeilen sind dabei UNVERAENDERT geblieben.
  //
  // WARUM VALID SEINEN BELEG AUS DER ABLAGE BEKOMMT UND NICHT AUS `ask()`: Der Produktschreibweg
  // setzt `resolutionId`, `sourceRecordId` und `locator` fest auf `null` — mit ehrlichem Grund
  // (`services/ask/src/service.ts:500-526`: `w1_not_on_answer_path`, `w2a_not_wired`,
  // `no_locator_from_import`). Die Vollstaendigkeitspruefung am Ende der Integritaetsleiter
  // (`ergaenzungOffen`, `services/ask/src/types.ts:844-848`) kann damit NIE erfuellt sein. `VALID`
  // ist also nicht durch eine andere Frage erreichbar, sondern erst, wenn diese drei Felder
  // verdrahtet sind. Der Fall stellt den Beleg deshalb so her, wie er nach dieser Verdrahtung
  // aussehen wird — die Messung selbst laeuft unveraendert ueber die Route.
  describe("JOB 541 D5 · die Zustandstabelle als HTTP-Vertrag", () => {
    /**
     * Legt Record und Beleg direkt in der Ablage an — Pruefvorrichtung, kein Produkteingriff.
     * Anmeldung, Wache, Route und Erklaerdienst laufen danach unveraendert.
     */
    async function legeVollstaendigenBelegAn(
      services: AppServices,
      opts: { answerId: string; ownerId: string; koId: string; koVersion: number },
    ): Promise<void> {
      await services.answerSnapshots.createRecord({
        answerId: opts.answerId,
        askExecutionId: `lauf-${opts.answerId}`,
        createdAt: new Date(1_754_121_600_000).toISOString(),
        schemaVersion: ANSWER_SNAPSHOT_SCHEMA_VERSION,
        owner: { kind: "user", userId: opts.ownerId },
      });
      const evidence: AnswerEvidenceRef = {
        knowledgeObjectId: opts.koId,
        knowledgeObjectVersion: opts.koVersion,
        evidenceRole: "carrying",
        // Genau die drei Felder, die der Produktweg heute leer laesst.
        sourceRecordId: "quellrevision-541-d5",
        sourceRecordIdReason: null,
        locator: "Abschnitt 1",
        locatorReason: null,
        validationDecisionRef: { auditSeq: 1, auditHash: "audit-hash-541-d5" },
      };
      const ohneHash: AnswerEvidenceSnapshot = {
        answerId: opts.answerId,
        snapshotRevision: 1,
        supersedesSnapshotRevision: null,
        schemaVersion: ANSWER_SNAPSHOT_SCHEMA_VERSION,
        capturedAt: new Date(1_754_121_600_000).toISOString(),
        citedSources: [opts.koId],
        evidence: [evidence],
        resolutionId: "aufloesung-541-d5",
        resolutionIdReason: null,
        // Oben bewusst leer: seit KW-W3-23 traegt die Evidence ihre Referenz selbst.
        validationDecisionRef: null,
        validationDecisionRefReason: "w3_23_ref_liegt_je_evidence",
        status: "COMPLETE",
        integrityHash: "",
      };
      await services.answerSnapshots.appendSnapshot({
        ...ohneHash,
        integrityHash: hashAnswerSnapshot(ohneHash),
      });
    }

    it("VALID · 200, state OK, integrity VALID — der vollstaendige Beleg ueber die Route", async () => {
      const repos = inMemoryRepos();
      const services = assembleServices(repos);
      const app = buildApp(services);
      const auth = await admin(app, "tab0@x.de");
      const konto = await repos.users.findByEmail("tab0@x.de");
      expect(konto, "das Konto wurde nicht angelegt").toBeDefined();
      if (konto === undefined) {
        throw new Error("Konto fehlt");
      }
      const ko = await services.ko.create({
        title: "Ventil bei Ueberdruck schliessen",
        statement: "Bei Ueberdruck Ventil X manuell schliessen.",
        type: "best_practice",
        category: "Anlage 1",
        author: "anna",
      });
      await legeVollstaendigenBelegAn(services, {
        answerId: "vollstaendig-541-d5",
        ownerId: konto.id,
        koId: ko.id,
        koVersion: ko.version,
      });

      const res = await erklaerung(app, auth, "vollstaendig-541-d5");

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.state).toBe("OK");
      expect(body.integrity, "ein lueckenlos gebundener Beleg muss VALID lesen").toBe("VALID");
      expect(body.answerId).toBe("vollstaendig-541-d5");
      expect(body.evidenceCount).toBe(1);
      // Der Rumpf traegt den Beleg vollstaendig — keine Schwaerzung, keine Leerstelle.
      expect(body.evidence).toHaveLength(1);
      expect(body.evidence[0].knowledgeObjectId).toBe(ko.id);
      expect(body.evidence[0].knowledgeObjectVersion).toBe(ko.version);
      expect(body.evidence[0].evidenceRole).toBe("carrying");
      expect(body.evidence[0].redacted).toBe(false);
      expect(body.evidence[0].validationDecisionRef).toEqual({
        auditSeq: 1,
        auditHash: "audit-hash-541-d5",
      });
      expect(body.evidence[0].validationReferenceAbsenceReason).toBeNull();
    });

    it("DEGRADED · 200, state OK, integrity DEGRADED — jede gewoehnliche eigene Antwort", async () => {
      const app = buildApp(buildServices());
      const auth = await admin(app, "tab1@x.de");
      const { koId, answerId } = await frageMitBeleg(app, auth);

      const res = await erklaerung(app, auth, String(answerId));

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.state).toBe("OK");
      expect(body.integrity).toBe("DEGRADED");
      expect(body.answerId).toBe(answerId);
      expect(body.evidenceCount).toBeGreaterThan(0);
      // Bei DEGRADED bleiben die Belege sichtbar — der Unterschied zu INVALIDATED und REDACTED.
      expect(body.evidence.length).toBe(body.evidenceCount);
      const beleg = body.evidence.find(
        (e: { knowledgeObjectId: string }) => e.knowledgeObjectId === koId,
      );
      expect(beleg, "das belegende Objekt fehlt im Rumpf").toBeDefined();
      expect(beleg.redacted).toBe(false);
    });

    it("INVALIDATED · 200, state OK, integrity INVALIDATED — Zahl bleibt, Details verschwinden", async () => {
      const services = buildServices();
      const app = buildApp(services);
      const auth = await admin(app, "tab3@x.de");
      const { koId, answerId } = await frageMitBeleg(app, auth);

      await services.ko.delete(koId, "anna", { hard: true });
      const res = await erklaerung(app, auth, String(answerId));

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.state).toBe("OK");
      expect(body.integrity).toBe("INVALIDATED");
      // DER RUMPF IST DIE AUSSAGE: ein unbelastbarer Beleg gibt keine Details mehr heraus,
      // die Zahl bleibt aber ehrlich stehen.
      expect(body.evidence).toEqual([]);
      expect(body.evidenceCount).toBeGreaterThan(0);
      expect(res.body.includes(koId), "die Kennung der geloeschten Quelle steht im Rumpf").toBe(
        false,
      );
    });

    it("REDACTED · 200, state OK, Zeilen geschwaerzt — und KEINE geschuetzte Kennung im Rumpf", async () => {
      // Der Eigentuemer ist bewusst ein `experte`: `darfVertraulich` gilt laut Route nur fuer
      // `admin` und `controller`. Und die Quelle wird ERST NACH der Antwort gesperrt — vorher
      // haette `dropConfidential` sie gar nicht in den Beleg gelassen.
      const services = buildServices();
      const app = buildApp(services);
      const auth = await admin(app, "tab2@x.de");
      const experte = await zweiterNutzer(app, auth, "experte541@x.de");
      const { koId, answerId } = await frageMitBeleg(app, experte);

      await services.ko.setConfidentiality(koId, "vertraulich", "anna");
      const res = await erklaerung(app, experte, String(answerId));

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.state).toBe("OK");
      // ==========================================================================================
      // JOB 541 D6 — DIE ZUSAGE, DIE DIESEN FALL ERST ZU EINEM ZUSTANDSFALL MACHT.
      // ==========================================================================================
      //
      // BEN zu D5, woertlich: „ein Testname REDACTED bei erwartetem DEGRADED ist ausdruecklich
      // kein fuenfter Zustandsfall." Der Rumpf muss den Zustand TRAGEN. Genau das steht hier —
      // und genau daran war der Fall vor der Verdrahtung rot
      // (`expected 'DEGRADED' to be 'REDACTED'`).
      expect(
        body.integrity,
        "die Redaktion muss sich im Integritaetszustand zeigen, nicht nur in den geschwaerzten Zeilen",
      ).toBe("REDACTED");
      // Die Zahl bleibt ehrlich stehen — sonst wuesste der Eigentuemer nicht einmal, DASS es
      // Belege gibt.
      expect(body.evidenceCount).toBeGreaterThan(0);
      expect(body.evidence).toHaveLength(body.evidenceCount);
      // GESCHWAERZT HEISST GESCHWAERZT: keine Kennung, keine Fassung, keine Referenz.
      for (const zeile of body.evidence) {
        expect(zeile.redacted).toBe(true);
        expect(zeile.knowledgeObjectId).toBe("");
        expect(zeile.knowledgeObjectVersion).toBeNull();
        expect(zeile.validationDecisionRef).toBeNull();
        expect(zeile.validationReferenceAbsenceReason).toBeNull();
        // Die Rolle bleibt: sie sagt nur, DASS etwas beigetragen hat, nicht was.
        expect(["carrying", "consulted"]).toContain(zeile.evidenceRole);
      }
      // DER NEGATIVBELEG, den BEN ausdruecklich verlangt: keine `koId` und keine andere
      // geschuetzte Kennung tritt aus. Geprueft am ROHEN Rumpf, nicht am geparsten Objekt —
      // ein Leck in einem unerwarteten Feld faellt sonst nicht auf.
      expect(res.body.includes(koId), "die Kennung des gesperrten Objekts steht im Rumpf").toBe(
        false,
      );
      expect(
        res.body.includes("Ventil bei Ueberdruck schliessen"),
        "der Titel des gesperrten Objekts steht im Rumpf",
      ).toBe(false);
      expect(
        res.body.includes("Bei Ueberdruck Ventil X manuell schliessen."),
        "der Inhalt des gesperrten Objekts steht im Rumpf",
      ).toBe(false);
    });

    it("NO_SNAPSHOT · 200, state NO_SNAPSHOT — die Antwort gibt es, ihren Beleg nicht", async () => {
      const repos = inMemoryRepos();
      const services = assembleServices(repos);
      const app = buildApp(services);
      const auth = await admin(app, "tab4@x.de");
      const konto = await repos.users.findByEmail("tab4@x.de");
      expect(konto).toBeDefined();
      if (konto === undefined) {
        throw new Error("Konto fehlt");
      }

      // Ein Record OHNE Beleg — genau der Zustand, den der zweistufige Schreibweg hinterlaesst,
      // wenn er zwischen Record und Snapshot abbricht.
      await services.answerSnapshots.createRecord({
        answerId: "ohne-beleg-541",
        askExecutionId: "lauf-541",
        createdAt: new Date(1_754_121_600_000).toISOString(),
        schemaVersion: ANSWER_SNAPSHOT_SCHEMA_VERSION,
        owner: { kind: "user", userId: konto.id },
      });

      const res = await erklaerung(app, auth, "ohne-beleg-541");

      expect(res.statusCode).toBe(200);
      const body = res.json();
      expect(body.state).toBe("NO_SNAPSHOT");
      expect(body.answerId).toBe("ohne-beleg-541");
      expect(typeof body.createdAt).toBe("string");
      // 404 waere hier eine Luege — und ein Integritaetszustand waere eine Behauptung ueber
      // einen Beleg, den es nicht gibt.
      expect(body.integrity).toBeUndefined();
      expect(body.evidence).toBeUndefined();
      expect(body.evidenceCount).toBeUndefined();
    });
  });

  it("GEGENFALL · eine Systemantwort gehoert KEINEM Konto — auch keinem namens `system`", async () => {
    // DIESELBE Dienstlandschaft wie die App — sonst waere der Belegspeicher ein anderer und der
    // Test pruefte zwei Bestaende gegeneinander statt einen.
    const services = buildServices();
    const app = buildApp(services);
    const auth = await admin(app);
    // Eine Antwort OHNE angemeldeten Fragenden: der Dienstweg setzt den Platzhalter-Actor.
    await services.ko.create({
      title: "Ventil bei Ueberdruck schliessen",
      statement: "Bei Ueberdruck Ventil X manuell schliessen.",
      type: "best_practice",
      category: "Anlage 1",
      author: "anna",
    });
    const lauf = await services.ask.ask("Was tun bei Ueberdruck am Ventil?");
    expect(lauf.answerId).not.toBeNull();
    const record = await services.answerSnapshots.findRecord(String(lauf.answerId));
    expect(record?.owner).toEqual({ kind: "system" });

    // Und ueber den Draht: ein angemeldetes Konto bekommt sie nicht zu sehen.
    const res = await erklaerung(app, auth, String(lauf.answerId));
    expect(res.statusCode).toBe(404);
  });
});
