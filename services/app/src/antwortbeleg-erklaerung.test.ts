// ================================================================================================
// AUFNAHME 20260922 · ANTWORTBELEG — DER GESPEICHERTE BELEG ERKLÄRT SEINE AUFLÖSUNG.
// ================================================================================================
//
// Gemessen am echten Draht (`app.inject()`): Anmeldung, Wache, Ask-Route, Belegschreiben,
// Erklärroute. Je Fall steht die Originalanforderung im Namen.
//
//   R-0276  genau einer von fünf Gründen, wenn der Hauptbeleg nicht auflöst — und ohne Grund
//           „entwertet", nie ein geratener Grund
//   R-0293  Quelle/Fundstelle (oder ihr Grund), Freigabe, Konfliktlage, „ob geprüft", „ob Widerspruch"
//   R-0317  Rechtelage und Erzeugungsart stehen im unveränderlichen Beleg
//   R-0340  die Zuständigkeit zum Antwortzeitpunkt bleibt, auch wenn sie später wechselt
//   R-0618  geschwärzte Zeilen tragen keines der neuen Felder
import { describe, expect, it } from "vitest";
import {
  ANSWER_SNAPSHOT_SCHEMA_VERSION,
  type AnswerEvidenceRef,
  type AnswerEvidenceSnapshot,
  type AnswerRecord,
  answerSnapshotHashMaterial,
  baueAnswerExplanation,
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

async function anmelden(app: ReturnType<typeof buildApp>, email: string) {
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

async function experteAnlegen(
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

async function koAnlegen(
  app: ReturnType<typeof buildApp>,
  auth: Record<string, string>,
  titel = "Ventil bei Ueberdruck schliessen",
): Promise<string> {
  const ko = await app.inject({
    method: "POST",
    url: "/api/kos",
    headers: auth,
    payload: {
      title: titel,
      statement: "Bei Ueberdruck Ventil X manuell schliessen.",
      type: "best_practice",
      category: "Anlage 1",
      confidentiality: "intern",
    },
  });
  if (ko.statusCode !== 201) {
    throw new Error(`KO nicht angelegt: ${ko.statusCode} ${ko.body}`);
  }
  return ko.json().id as string;
}

async function fragen(app: ReturnType<typeof buildApp>, auth: Record<string, string>) {
  const ask = await app.inject({
    method: "POST",
    url: "/api/ask",
    headers: auth,
    payload: { question: "Was tun bei Ueberdruck am Ventil?" },
  });
  if (ask.statusCode !== 200) {
    throw new Error(`Frage fehlgeschlagen: ${ask.statusCode} ${ask.body}`);
  }
  const answerId = ask.json().answerId as string | null;
  if (answerId === null) {
    throw new Error("Der Antwortlauf hat keinen Beleg geschrieben.");
  }
  return answerId;
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

interface Zeile {
  knowledgeObjectId: string;
  knowledgeObjectVersion: number | null;
  evidenceRole: string;
  sourceRecordId: string | null;
  sourceRecordIdReason: string | null;
  locator: string | null;
  locatorReason: string | null;
  confidentialityAtExecution: string | null;
  responsibleAtExecution: string | null;
  responsibleKindAtExecution: string | null;
  openConflictToday: boolean | null;
  redacted: boolean;
}

function zeileZu(body: { evidence: Zeile[] }, koId: string): Zeile {
  const zeile = body.evidence.find((z) => z.knowledgeObjectId === koId);
  if (zeile === undefined) {
    throw new Error(`Die Erklärung führt ${koId} nicht.`);
  }
  return zeile;
}

/** Ein selbst gebauter Beleg mit genau einer tragenden Evidence — für die Gründe ohne Produktweg. */
async function belegAnlegen(
  services: AppServices,
  opts: {
    answerId: string;
    ownerId: string;
    koId: string;
    koVersion: number | null;
    hashVerfaelschen?: boolean;
  },
): Promise<void> {
  await services.answerSnapshots.createRecord({
    answerId: opts.answerId,
    askExecutionId: `lauf-${opts.answerId}`,
    createdAt: new Date(1_790_000_000_000).toISOString(),
    schemaVersion: ANSWER_SNAPSHOT_SCHEMA_VERSION,
    owner: { kind: "user", userId: opts.ownerId },
  });
  const evidence: AnswerEvidenceRef = {
    knowledgeObjectId: opts.koId,
    knowledgeObjectVersion: opts.koVersion,
    evidenceRole: "carrying",
    sourceRecordId: null,
    sourceRecordIdReason: "w2a_not_wired",
    locator: null,
    locatorReason: "no_locator_from_import",
    validationReferenceAbsenceReason: "NOT_AVAILABLE_AT_EXECUTION",
    confidentialityAtExecution: "intern",
    responsibleAtExecution: "verantwortlich-damals",
    responsibleKindAtExecution: "owner",
  };
  const ohneHash: AnswerEvidenceSnapshot = {
    answerId: opts.answerId,
    snapshotRevision: 1,
    supersedesSnapshotRevision: null,
    schemaVersion: ANSWER_SNAPSHOT_SCHEMA_VERSION,
    capturedAt: new Date(1_790_000_000_000).toISOString(),
    citedSources: [opts.koId],
    evidence: [evidence],
    resolutionId: null,
    resolutionIdReason: "w1_not_on_answer_path",
    validationDecisionRef: null,
    validationDecisionRefReason: "w3_23_ref_liegt_je_evidence",
    status: "INCOMPLETE",
    integrityHash: "",
    generationMode: "deterministic",
  };
  await services.answerSnapshots.appendSnapshot({
    ...ohneHash,
    // Ein SHA-256 aus lauter Nullen kommt als echter Abdruck praktisch nicht vor.
    integrityHash: opts.hashVerfaelschen ? "0".repeat(64) : hashAnswerSnapshot(ohneHash),
  });
}

async function kontoMitDiensten(email: string) {
  const repos = inMemoryRepos();
  const services = assembleServices(repos);
  const app = buildApp(services);
  const auth = await anmelden(app, email);
  const konto = await repos.users.findByEmail(email);
  if (konto === undefined) {
    throw new Error("Konto fehlt");
  }
  return { services, app, auth, kontoId: konto.id };
}

describe("R-0293 / R-0317 · der Weg zur Antwort aus dem gespeicherten Beleg", () => {
  it("nennt Fassung, Rolle, Quelle und Fundstelle samt Grund, Freigabelage, Rechte und Erzeugungsart", async () => {
    const app = buildApp(buildServices());
    const auth = await anmelden(app, "weg1@x.de");
    const koId = await koAnlegen(app, auth);
    const answerId = await fragen(app, auth);

    const res = await erklaerung(app, auth, answerId);
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.state).toBe("OK");
    const zeile = zeileZu(body, koId);
    expect(zeile.knowledgeObjectVersion).toBeGreaterThan(0);
    expect(zeile.evidenceRole).toBe("carrying");
    // Quelle und Fundstelle: heute vom Produktweg nicht erfasst — dann steht der GRUND daneben,
    // nie ein leeres Feld ohne Grund.
    expect(zeile.sourceRecordId).toBeNull();
    expect(zeile.sourceRecordIdReason).toBe("w2a_not_wired");
    expect(zeile.locator).toBeNull();
    expect(zeile.locatorReason).toBe("no_locator_from_import");
    // R-0317: die Rechtelage zum Antwortzeitpunkt steht im Beleg.
    expect(zeile.confidentialityAtExecution).toBe("intern");
    expect(["model", "deterministic"]).toContain(body.generationMode);
    // R-0293 „ob die Quellen vollständig geprüft sind": ein nie freigegebenes Objekt ist es nicht.
    expect(body.carryingSourcesValidated).toBe(false);
    // Die Konfliktlage ist bekannt (der Dienst ist verdrahtet) — und es gibt keinen Widerspruch.
    expect(zeile.openConflictToday).toBe(false);
    expect(body.openConflictToday).toBe(false);
    // Der Hauptbeleg löst auf: kein Grund.
    expect(body.primaryResolutionFailure).toBeNull();
  });

  it("zeigt einen HEUTE offenen Widerspruch an der Zeile und in der Gesamtaussage", async () => {
    const services = buildServices();
    const app = buildApp(services);
    const auth = await anmelden(app, "weg2@x.de");
    const koId = await koAnlegen(app, auth);
    const answerId = await fragen(app, auth);
    const anderes = await koAnlegen(app, auth, "Ventil bei Ueberdruck offen lassen");
    const a = await services.ko.get(koId);
    const b = await services.ko.get(anderes);
    await services.conflicts.create({
      koA: koId,
      koB: anderes,
      type: "truth",
      description: "Schliessen oder offen lassen?",
      ...(a ? { koAVersion: a.version } : {}),
      ...(b ? { koBVersion: b.version } : {}),
    });

    const body = (await erklaerung(app, auth, answerId)).json();
    expect(zeileZu(body, koId).openConflictToday).toBe(true);
    expect(body.openConflictToday).toBe(true);
  });

  it("der gespeicherte Beleg aendert sich beim Oeffnen nicht — es wird nicht neu gesucht", async () => {
    const services = buildServices();
    const app = buildApp(services);
    const auth = await anmelden(app, "weg3@x.de");
    const koId = await koAnlegen(app, auth);
    const answerId = await fragen(app, auth);
    const vorher = await services.answerSnapshots.latestSnapshot(answerId);

    // Ein neues, passenderes Objekt NACH der Antwort darf im Beleg nicht auftauchen.
    const spaeter = await koAnlegen(app, auth, "Ventil bei Ueberdruck sofort schliessen");
    const body = (await erklaerung(app, auth, answerId)).json();
    expect(body.evidence.some((z: Zeile) => z.knowledgeObjectId === spaeter)).toBe(false);
    expect(zeileZu(body, koId)).toBeDefined();
    expect(await services.answerSnapshots.latestSnapshot(answerId)).toEqual(vorher);
  });
});

describe("R-0340 · die Zuständigkeit zum Antwortzeitpunkt", () => {
  it("bleibt am Beleg stehen, wenn die Zuständigkeit danach wechselt", async () => {
    const { services, app, auth, kontoId } = await kontoMitDiensten("zust1@x.de");
    const koId = await koAnlegen(app, auth);
    const ersteAntwort = await fragen(app, auth);

    // Ohne benannten Eigentümer ist der Autor zuständig — als ausgewiesener Rückfall.
    const vorher = zeileZu((await erklaerung(app, auth, ersteAntwort)).json(), koId);
    expect(vorher.responsibleAtExecution).toBe(kontoId);
    expect(vorher.responsibleKindAtExecution).toBe("author-fallback");

    await services.ko.setOwnership(koId, { owner: "neue-zustaendige" }, kontoId);

    // Die ALTE Antwort nennt weiter den damaligen Stand …
    const alt = zeileZu((await erklaerung(app, auth, ersteAntwort)).json(), koId);
    expect(alt.responsibleAtExecution).toBe(kontoId);
    expect(alt.responsibleKindAtExecution).toBe("author-fallback");
    // … eine NEUE Antwort den neuen.
    const zweiteAntwort = await fragen(app, auth);
    const neu = zeileZu((await erklaerung(app, auth, zweiteAntwort)).json(), koId);
    expect(neu.responsibleAtExecution).toBe("neue-zustaendige");
    expect(neu.responsibleKindAtExecution).toBe("owner");
  });

  it("Zuständigkeit, Rechte und Erzeugungsart sind Inhalt des Hashes — nachträglich nicht änderbar", async () => {
    const { services, app, auth } = await kontoMitDiensten("zust2@x.de");
    await koAnlegen(app, auth);
    const answerId = await fragen(app, auth);
    const beleg = await services.answerSnapshots.latestSnapshot(answerId);
    if (beleg === undefined) {
      throw new Error("Beleg fehlt");
    }
    expect(beleg.integrityHash).toBe(hashAnswerSnapshot(beleg));
    const [erste, ...rest] = beleg.evidence;
    if (erste === undefined) {
      throw new Error("Evidence fehlt");
    }
    const umgeschrieben: AnswerEvidenceSnapshot = {
      ...beleg,
      evidence: [{ ...erste, responsibleAtExecution: "jemand-anderes" }, ...rest],
    };
    expect(hashAnswerSnapshot(umgeschrieben)).not.toBe(beleg.integrityHash);
    expect(beleg.generationMode).toBeDefined();
    const { generationMode: _entfernt, ...ohneErzeugung } = beleg;
    expect(hashAnswerSnapshot(ohneErzeugung)).not.toBe(beleg.integrityHash);
  });

  it("ein Beleg von vor R-0317 behält sein Hashmaterial Zeichen für Zeichen", () => {
    const alt: AnswerEvidenceSnapshot = {
      answerId: "alt-1",
      snapshotRevision: 1,
      supersedesSnapshotRevision: null,
      schemaVersion: ANSWER_SNAPSHOT_SCHEMA_VERSION,
      capturedAt: "2026-08-01T00:00:00.000Z",
      citedSources: ["ko-1"],
      evidence: [
        {
          knowledgeObjectId: "ko-1",
          knowledgeObjectVersion: 1,
          evidenceRole: "carrying",
          sourceRecordId: null,
          sourceRecordIdReason: "w2a_not_wired",
          locator: null,
          locatorReason: "no_locator_from_import",
          validationReferenceAbsenceReason: "NOT_AVAILABLE_AT_EXECUTION",
        },
      ],
      resolutionId: null,
      resolutionIdReason: "w1_not_on_answer_path",
      validationDecisionRef: null,
      validationDecisionRefReason: "w3_23_ref_liegt_je_evidence",
      status: "INCOMPLETE",
      integrityHash: "",
    };
    const material = answerSnapshotHashMaterial(alt);
    expect(material.some((teil) => teil.startsWith("generationMode="))).toBe(false);
    expect(material.join("|")).not.toContain("responsible=");
    expect(material.join("|")).not.toContain("confidentiality=");
    expect(material.at(-1)).toBe(
      [
        "evidence[0].koId=ko-1",
        "koVersion=1",
        "role=carrying",
        "sourceRecordId=\u0000null",
        "sourceRecordIdReason=w2a_not_wired",
        "locator=\u0000null",
        "locatorReason=no_locator_from_import",
        "evidenceValidationRef=\u0000null",
        "evidenceAbsenceReason=NOT_AVAILABLE_AT_EXECUTION",
      ].join("\u001e"),
    );
  });
});

describe("R-0276 · genau einer von fünf Gründen — oder entwertet", () => {
  it("UNKNOWN_REFERENCE · die tragende Wissenseinheit gibt es nicht mehr", async () => {
    const services = buildServices();
    const app = buildApp(services);
    const auth = await anmelden(app, "grund1@x.de");
    const koId = await koAnlegen(app, auth);
    const answerId = await fragen(app, auth);
    await services.ko.delete(koId, "anna", { hard: true });

    const res = await erklaerung(app, auth, answerId);
    const body = res.json();
    expect(body.integrity).toBe("INVALIDATED");
    expect(body.primaryResolutionFailure).toBe("UNKNOWN_REFERENCE");
    expect(body.evidence).toEqual([]);
    expect(body.carryingSourcesValidated).toBeNull();
    expect(body.openConflictToday).toBeNull();
    expect(res.body.includes(koId), "die Kennung der gelöschten Quelle steht im Rumpf").toBe(false);
  });

  it("UNRESOLVABLE_REFERENCE · die gebundene Fassung lässt sich nicht auflösen", async () => {
    const { services, app, auth, kontoId } = await kontoMitDiensten("grund2@x.de");
    const koId = await koAnlegen(app, auth);
    const ko = await services.ko.get(koId);
    await belegAnlegen(services, {
      answerId: "fassung-unaufloesbar",
      ownerId: kontoId,
      koId,
      koVersion: (ko?.version ?? 1) + 5,
    });

    const body = (await erklaerung(app, auth, "fassung-unaufloesbar")).json();
    expect(body.integrity).toBe("INVALIDATED");
    expect(body.primaryResolutionFailure).toBe("UNRESOLVABLE_REFERENCE");
  });

  it("DAMAGED_REFERENCE · der gespeicherte Beleg passt nicht mehr zu seiner Prüfsumme", async () => {
    const { services, app, auth, kontoId } = await kontoMitDiensten("grund3@x.de");
    const koId = await koAnlegen(app, auth);
    const ko = await services.ko.get(koId);
    await belegAnlegen(services, {
      answerId: "beschaedigt",
      ownerId: kontoId,
      koId,
      koVersion: ko?.version ?? 1,
      hashVerfaelschen: true,
    });

    const res = await erklaerung(app, auth, "beschaedigt");
    const body = res.json();
    expect(body.integrity).toBe("INVALIDATED");
    expect(body.primaryResolutionFailure).toBe("DAMAGED_REFERENCE");
    expect(res.body.includes("verantwortlich-damals")).toBe(false);
  });

  it("ACCESS_DENIED · die tragende Quelle ist dem Leser heute gesperrt — Zeile geschwärzt (R-0618)", async () => {
    const services = buildServices();
    const app = buildApp(services);
    const admin = await anmelden(app, "grund4@x.de");
    const experte = await experteAnlegen(app, admin, "experte-grund4@x.de");
    const koId = await koAnlegen(app, experte);
    const answerId = await fragen(app, experte);
    await services.ko.setConfidentiality(koId, "vertraulich", "anna");

    const res = await erklaerung(app, experte, answerId);
    const body = res.json();
    expect(body.integrity).toBe("REDACTED");
    expect(body.primaryResolutionFailure).toBe("ACCESS_DENIED");
    expect(body.evidence.length).toBe(body.evidenceCount);
    for (const zeile of body.evidence as Zeile[]) {
      expect(zeile.redacted).toBe(true);
      expect(zeile.sourceRecordIdReason).toBeNull();
      expect(zeile.locatorReason).toBeNull();
      expect(zeile.confidentialityAtExecution).toBeNull();
      expect(zeile.responsibleAtExecution).toBeNull();
      expect(zeile.responsibleKindAtExecution).toBeNull();
      expect(zeile.openConflictToday).toBeNull();
    }
    // Über eine geschwärzte tragende Zeile verrät die Gesamtaussage nichts.
    expect(body.carryingSourcesValidated).toBeNull();
    expect(res.body.includes(koId)).toBe(false);
  });

  it("ohne Grund, mit fremdem oder mit widersprüchlichem Grund: entwertet — kein geratener Grund", () => {
    const record: AnswerRecord = {
      answerId: "kern-1",
      askExecutionId: "lauf-kern-1",
      createdAt: "2026-09-01T00:00:00.000Z",
      schemaVersion: ANSWER_SNAPSHOT_SCHEMA_VERSION,
      owner: { kind: "user", userId: "u1" },
    };
    const ohneHash: AnswerEvidenceSnapshot = {
      answerId: "kern-1",
      snapshotRevision: 1,
      supersedesSnapshotRevision: null,
      schemaVersion: ANSWER_SNAPSHOT_SCHEMA_VERSION,
      capturedAt: "2026-09-01T00:00:00.000Z",
      citedSources: ["ko-1"],
      evidence: [
        {
          knowledgeObjectId: "ko-1",
          knowledgeObjectVersion: 1,
          evidenceRole: "carrying",
          sourceRecordId: null,
          sourceRecordIdReason: "w2a_not_wired",
          locator: null,
          locatorReason: "no_locator_from_import",
          validationReferenceAbsenceReason: "NOT_AVAILABLE_AT_EXECUTION",
        },
      ],
      resolutionId: null,
      resolutionIdReason: "w1_not_on_answer_path",
      validationDecisionRef: null,
      validationDecisionRefReason: "w3_23_ref_liegt_je_evidence",
      status: "INCOMPLETE",
      integrityHash: "",
    };
    const snapshot = { ...ohneHash, integrityHash: hashAnswerSnapshot(ohneHash) };
    const lesen = (sicht: Parameters<typeof baueAnswerExplanation>[2]) => {
      const ergebnis = baueAnswerExplanation(record, snapshot, sicht);
      if (ergebnis.kind !== "OK") {
        throw new Error("erwartet: OK");
      }
      return ergebnis.view;
    };

    const ohneGrund = lesen({ primaryResolvable: false, gesperrt: false });
    expect(ohneGrund.integrity).toBe("INVALIDATED");
    expect(ohneGrund.primaryResolutionFailure).toBeNull();

    const fremd = lesen({
      primaryResolvable: false,
      primaryResolutionFailure: "GIBT_ES_NICHT" as never,
      gesperrt: false,
    });
    expect(fremd.integrity).toBe("INVALIDATED");
    expect(fremd.primaryResolutionFailure).toBeNull();

    const widerspruechlich = lesen({
      primaryResolvable: true,
      primaryResolutionFailure: "UNKNOWN_REFERENCE",
      gesperrt: false,
    });
    expect(widerspruechlich.integrity).toBe("INVALIDATED");
    expect(widerspruechlich.primaryResolutionFailure).toBeNull();

    // Und jede der fünf bekannten Ursachen kommt genau so heraus, wie sie hineinging.
    for (const grund of [
      "UNKNOWN_REFERENCE",
      "UNRESOLVABLE_REFERENCE",
      "DAMAGED_REFERENCE",
      "ACCESS_DENIED",
      "REDACTION_REQUIRED",
    ] as const) {
      const view = lesen({
        primaryResolvable: false,
        primaryResolutionFailure: grund,
        gesperrt: false,
      });
      expect(view.primaryResolutionFailure).toBe(grund);
    }
  });
});
