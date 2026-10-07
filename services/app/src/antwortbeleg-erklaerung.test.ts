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
  return { repos, services, app, auth, kontoId: konto.id };
}

/**
 * Hängt Quellenanker an ein bestehendes Objekt — so, wie sie ein Import hinterlässt. Die
 * öffentlichen Schreibrouten verwerfen `sources`; nur die Importwege setzen sie (types.ts:407-414).
 * Der Test schreibt deshalb über die Ablage selbst, mit dem CAS-Stand des gelesenen Objekts.
 */
async function ankerSetzen(
  ctx: Awaited<ReturnType<typeof kontoMitDiensten>>,
  koId: string,
  anker: Array<{ id: string; sourceRecordId?: string; excerpt: string | null }>,
): Promise<void> {
  // Die Hintergrundprüfung kann das Objekt zwischen Lesen und Schreiben fortschreiben (CAS über
  // `rowVersion`). Dann wird frisch gelesen und erneut geschrieben — nie blind überschrieben.
  for (let versuch = 0; versuch < 5; versuch += 1) {
    try {
      await ankerSchreiben(ctx, koId, anker);
      return;
    } catch (fehler) {
      if ((fehler as { code?: string }).code !== "STALE_WRITE") {
        throw fehler;
      }
    }
  }
  throw new Error("Anker ließen sich nicht schreiben (dauernd STALE_WRITE).");
}

async function ankerSchreiben(
  ctx: Awaited<ReturnType<typeof kontoMitDiensten>>,
  koId: string,
  anker: Array<{ id: string; sourceRecordId?: string; excerpt: string | null }>,
): Promise<void> {
  const ko = await ctx.services.ko.get(koId);
  if (ko === undefined) {
    throw new Error("KO fehlt");
  }
  await ctx.repos.koRepo.update({
    ...ko,
    sources: anker.map((a) => ({
      id: a.id,
      label: "Betriebshandbuch Anlage 1",
      url: null,
      excerpt: a.excerpt,
      kind: "external" as const,
      peerValidated: false,
      provider: "Confluence",
      externalId: "seite-4711",
      sourceVersion: 7,
      ...(a.sourceRecordId !== undefined ? { sourceRecordId: a.sourceRecordId } : {}),
      author: "import",
      at: "2026-09-30T08:00:00.000Z",
    })),
  });
}

describe("R-0293 / R-0317 · Quellfassung und Fundstelle aus dem Quellenanker", () => {
  it("bindet die festgeschriebene Quellfassung und die wörtliche Belegstelle des einzigen Ankers", async () => {
    const ctx = await kontoMitDiensten("anker1@x.de");
    const koId = await koAnlegen(ctx.app, ctx.auth);
    await ankerSetzen(ctx, koId, [
      {
        id: "q-1",
        sourceRecordId: "quellrevision-4711-7",
        excerpt: "Bei Überdruck ist Ventil X von Hand zu schließen.",
      },
    ]);
    const answerId = await fragen(ctx.app, ctx.auth);

    const beleg = await ctx.services.answerSnapshots.latestSnapshot(answerId);
    const ref = beleg?.evidence.find((e) => e.knowledgeObjectId === koId);
    expect(ref?.sourceRecordId).toBe("quellrevision-4711-7");
    expect(ref?.sourceRecordIdReason).toBeNull();
    expect(ref?.locator).toBe("Bei Überdruck ist Ventil X von Hand zu schließen.");
    expect(ref?.locatorReason).toBeNull();
    // Gebunden heißt: Teil des Abdrucks, also nachträglich nicht unbemerkt änderbar.
    expect(beleg?.integrityHash).toBe(beleg ? hashAnswerSnapshot(beleg) : "");

    // Ein SPÄTERER Anker ändert den gespeicherten Beleg nicht — es wird nicht neu nachgeschlagen.
    await ankerSetzen(ctx, koId, [
      { id: "q-2", sourceRecordId: "quellrevision-4711-8", excerpt: "Neuer Wortlaut." },
    ]);
    const zeile = zeileZu((await erklaerung(ctx.app, ctx.auth, answerId)).json(), koId);
    expect(zeile.sourceRecordId).toBe("quellrevision-4711-7");
    expect(zeile.locator).toBe("Bei Überdruck ist Ventil X von Hand zu schließen.");
  });

  it("nennt den zutreffenden Grund, wenn der Anker eine Angabe nicht trägt", async () => {
    const ctx = await kontoMitDiensten("anker2@x.de");
    const koId = await koAnlegen(ctx.app, ctx.auth);
    await ankerSetzen(ctx, koId, [{ id: "q-1", excerpt: null }]);
    const answerId = await fragen(ctx.app, ctx.auth);

    const zeile = zeileZu((await erklaerung(ctx.app, ctx.auth, answerId)).json(), koId);
    expect(zeile.sourceRecordId).toBeNull();
    expect(zeile.sourceRecordIdReason).toBe("anchor_without_source_record");
    expect(zeile.locator).toBeNull();
    expect(zeile.locatorReason).toBe("anchor_without_excerpt");
  });

  it("rät bei mehreren Ankern keinen — beide Felder leer mit benanntem Grund", async () => {
    const ctx = await kontoMitDiensten("anker3@x.de");
    const koId = await koAnlegen(ctx.app, ctx.auth);
    await ankerSetzen(ctx, koId, [
      { id: "q-1", sourceRecordId: "quellrevision-a", excerpt: "Stelle A" },
      { id: "q-2", sourceRecordId: "quellrevision-b", excerpt: "Stelle B" },
    ]);
    const answerId = await fragen(ctx.app, ctx.auth);

    const zeile = zeileZu((await erklaerung(ctx.app, ctx.auth, answerId)).json(), koId);
    expect(zeile.sourceRecordId).toBeNull();
    expect(zeile.sourceRecordIdReason).toBe("multiple_source_anchors");
    expect(zeile.locator).toBeNull();
    expect(zeile.locatorReason).toBe("multiple_source_anchors");
  });
});

/**
 * Verschiebt eine Wissenseinheit in einen Space, den das Konto nicht lesen darf — über den echten
 * Dienstweg (`KoService.setLeadingSpace`). Die Hintergrundprüfung kann das Objekt zeitgleich
 * fortschreiben; dann wird erneut versucht, nie an der Fachschicht vorbei geschrieben.
 */
async function spaceWechseln(
  ctx: Awaited<ReturnType<typeof kontoMitDiensten>>,
  koId: string,
): Promise<void> {
  for (let versuch = 0; versuch < 5; versuch += 1) {
    try {
      await ctx.services.ko.setLeadingSpace(koId, "space-ohne-zugang", ctx.kontoId, null);
      return;
    } catch (fehler) {
      if ((fehler as { code?: string }).code !== "STALE_WRITE") {
        throw fehler;
      }
    }
  }
  throw new Error("Space-Wechsel ließ sich nicht schreiben (dauernd STALE_WRITE).");
}

describe("R-0293 / R-0317 / R-0618 · Space-Rechte von heute gelten auch im Erklärweg", () => {
  it("verliert der Eigentümer den Space-Zugang, wird genau diese Zeile geschwärzt — samt Fundstelle", async () => {
    const ctx = await kontoMitDiensten("space1@x.de");
    const koId = await koAnlegen(ctx.app, ctx.auth);
    await ankerSetzen(ctx, koId, [
      {
        id: "q-1",
        sourceRecordId: "quellrevision-space-1",
        excerpt: "Geheimer Wortlaut aus Space A.",
      },
    ]);
    const answerId = await fragen(ctx.app, ctx.auth);
    // Vorher: die Zeile ist offen, die Fundstelle steht im Rumpf.
    const vorher = await erklaerung(ctx.app, ctx.auth, answerId);
    expect(vorher.body.includes("Geheimer Wortlaut aus Space A.")).toBe(true);

    // Danach liegt die Wissenseinheit in einem Space, den dieses Konto nicht lesen darf. Auch der
    // Admin hat keinen Rollen-Durchgriff auf fremde Spaces (sichtbarkeit.ts, `spaceErlaubt`).
    await spaceWechseln(ctx, koId);

    const res = await erklaerung(ctx.app, ctx.auth, answerId);
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.integrity).toBe("REDACTED");
    expect(body.primaryResolutionFailure).toBe("ACCESS_DENIED");
    expect(body.evidenceCount).toBeGreaterThan(0);
    for (const zeile of body.evidence as Zeile[]) {
      expect(zeile.redacted).toBe(true);
      expect(zeile.locator).toBeNull();
      expect(zeile.sourceRecordId).toBeNull();
      expect(zeile.responsibleAtExecution).toBeNull();
    }
    expect(res.body.includes(koId)).toBe(false);
    expect(res.body.includes("Geheimer Wortlaut aus Space A.")).toBe(false);
    expect(res.body.includes("quellrevision-space-1")).toBe(false);
  });

  it("erlaubte Zeilen bleiben offen — geschwärzt wird nur die Wissenseinheit im fremden Space", async () => {
    const ctx = await kontoMitDiensten("space2@x.de");
    const imSpace = await koAnlegen(ctx.app, ctx.auth, "Ventil im fremden Space");
    const offen = await koAnlegen(ctx.app, ctx.auth, "Ventil ohne Space");
    const fassung = async (id: string) => (await ctx.services.ko.get(id))?.version ?? 1;
    const zeileVon = async (
      id: string,
      rolle: "carrying" | "consulted",
      stelle: string,
    ): Promise<AnswerEvidenceRef> => ({
      knowledgeObjectId: id,
      knowledgeObjectVersion: await fassung(id),
      evidenceRole: rolle,
      sourceRecordId: `quellrevision-${id}`,
      sourceRecordIdReason: null,
      locator: stelle,
      locatorReason: null,
      validationReferenceAbsenceReason:
        rolle === "carrying" ? "NOT_AVAILABLE_AT_EXECUTION" : "NOT_REQUIRED",
    });
    await ctx.services.answerSnapshots.createRecord({
      answerId: "space-gemischt",
      askExecutionId: "lauf-space-gemischt",
      createdAt: "2026-10-08T08:00:00.000Z",
      schemaVersion: ANSWER_SNAPSHOT_SCHEMA_VERSION,
      owner: { kind: "user", userId: ctx.kontoId },
    });
    const ohneHash: AnswerEvidenceSnapshot = {
      answerId: "space-gemischt",
      snapshotRevision: 1,
      supersedesSnapshotRevision: null,
      schemaVersion: ANSWER_SNAPSHOT_SCHEMA_VERSION,
      capturedAt: "2026-10-08T08:00:00.000Z",
      citedSources: [imSpace],
      evidence: [
        await zeileVon(imSpace, "carrying", "Stelle im fremden Space"),
        await zeileVon(offen, "consulted", "Stelle ohne Space"),
      ],
      resolutionId: null,
      resolutionIdReason: "w1_not_on_answer_path",
      validationDecisionRef: null,
      validationDecisionRefReason: "w3_23_ref_liegt_je_evidence",
      status: "INCOMPLETE",
      integrityHash: "",
    };
    await ctx.services.answerSnapshots.appendSnapshot({
      ...ohneHash,
      integrityHash: hashAnswerSnapshot(ohneHash),
    });
    await spaceWechseln(ctx, imSpace);

    const res = await erklaerung(ctx.app, ctx.auth, "space-gemischt");
    const body = res.json();
    expect(body.primaryResolutionFailure).toBe("ACCESS_DENIED");
    expect(body.evidence).toHaveLength(2);
    const [gesperrt, sichtbar] = body.evidence as Zeile[];
    expect(gesperrt?.redacted).toBe(true);
    expect(gesperrt?.locator).toBeNull();
    expect(sichtbar?.redacted).toBe(false);
    expect(sichtbar?.knowledgeObjectId).toBe(offen);
    expect(sichtbar?.locator).toBe("Stelle ohne Space");
    expect(res.body.includes("Stelle im fremden Space")).toBe(false);
    expect(res.body.includes(imSpace)).toBe(false);
  });
});

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
    // Quelle und Fundstelle: ein über die Erfassung angelegtes Objekt trägt keinen Quellenanker —
    // dann steht genau DIESER Grund daneben, nie ein leeres Feld ohne Grund und kein Altgrund.
    expect(zeile.sourceRecordId).toBeNull();
    expect(zeile.sourceRecordIdReason).toBe("no_source_anchor");
    expect(zeile.locator).toBeNull();
    expect(zeile.locatorReason).toBe("no_source_anchor");
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

  it("R-0317: bindet die Modellfassung als Referenz auf genau den Laufprotokoll-Eintrag dieser Antwort", async () => {
    const app = buildApp(buildServices());
    const auth = await anmelden(app, "lauf1@x.de");
    await koAnlegen(app, auth);
    const ask = await app.inject({
      method: "POST",
      url: "/api/ask",
      headers: auth,
      payload: { question: "Was tun bei Ueberdruck am Ventil?" },
    });
    expect(ask.statusCode).toBe(200);
    // Die interne Referenz geht in den Beleg, NICHT an die Antwortfläche.
    expect(ask.body.includes("modelRunId")).toBe(false);
    const answerId = ask.json().answerId as string;

    const res = await erklaerung(app, auth, answerId);
    const body = res.json();
    expect(typeof body.modelRunId).toBe("string");
    expect(body.modelRunIdReason).toBeNull();

    // Die Referenz löst über das Laufprotokoll auf — mit dessen eigener Lesestufe — und trifft genau
    // einen Antwortlauf, der Anbieter und Erzeugungsart trägt.
    const laeufe = await app.inject({
      method: "GET",
      url: "/api/model-runs?limit=200",
      headers: auth,
    });
    expect(laeufe.statusCode).toBe(200);
    type Lauf = { id: string; task: string; provider: string; demo: boolean };
    const treffer = (laeufe.json() as Lauf[]).filter((lauf) => lauf.id === body.modelRunId);
    expect(treffer).toHaveLength(1);
    expect(treffer[0]?.task).toBe("answer");
    expect(treffer[0]?.provider.length).toBeGreaterThan(0);
    expect(treffer[0]?.demo).toBe(body.generationMode === "deterministic");
    // Der Beleg selbst trägt weder Anbieter- noch Modellfeld (keine Anbieter-Spuren).
    expect(res.body.includes('"provider"')).toBe(false);
    expect(res.body.includes('"model"')).toBe(false);
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
    // R-0317: auch die Modelllauf-Referenz ist gebunden — weder austausch- noch entfernbar.
    expect(typeof beleg.modelRunId).toBe("string");
    expect(hashAnswerSnapshot({ ...beleg, modelRunId: "anderer-lauf" })).not.toBe(
      beleg.integrityHash,
    );
    const { modelRunId: _lauf, ...ohneLauf } = beleg;
    expect(hashAnswerSnapshot(ohneLauf)).not.toBe(beleg.integrityHash);
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

describe("R-0293 / R-0618 · Konfliktlage bei teilweise geschwärztem Beleg", () => {
  function zweiTragende(): AnswerEvidenceSnapshot {
    const ref = (koId: string): AnswerEvidenceRef => ({
      knowledgeObjectId: koId,
      knowledgeObjectVersion: 1,
      evidenceRole: "carrying",
      sourceRecordId: null,
      sourceRecordIdReason: "no_source_anchor",
      locator: null,
      locatorReason: "no_source_anchor",
      validationReferenceAbsenceReason: "NOT_AVAILABLE_AT_EXECUTION",
    });
    const ohneHash: AnswerEvidenceSnapshot = {
      answerId: "konflikt-1",
      snapshotRevision: 1,
      supersedesSnapshotRevision: null,
      schemaVersion: ANSWER_SNAPSHOT_SCHEMA_VERSION,
      capturedAt: "2026-10-01T00:00:00.000Z",
      citedSources: ["ko-sichtbar", "ko-gesperrt"],
      evidence: [ref("ko-sichtbar"), ref("ko-gesperrt")],
      resolutionId: null,
      resolutionIdReason: "w1_not_on_answer_path",
      validationDecisionRef: null,
      validationDecisionRefReason: "w3_23_ref_liegt_je_evidence",
      status: "INCOMPLETE",
      integrityHash: "",
    };
    return { ...ohneHash, integrityHash: hashAnswerSnapshot(ohneHash) };
  }
  const record: AnswerRecord = {
    answerId: "konflikt-1",
    askExecutionId: "lauf-konflikt-1",
    createdAt: "2026-10-01T00:00:00.000Z",
    schemaVersion: ANSWER_SNAPSHOT_SCHEMA_VERSION,
    owner: { kind: "user", userId: "u1" },
  };
  function gesamt(offen: ReadonlySet<string>): boolean | null {
    const ergebnis = baueAnswerExplanation(record, zweiTragende(), {
      primaryResolvable: true,
      gesperrt: false,
      gesperrteObjekte: new Set(["ko-gesperrt"]),
      offeneKonflikte: offen,
    });
    if (ergebnis.kind !== "OK") {
      throw new Error("erwartet: OK");
    }
    return ergebnis.view.openConflictToday;
  }

  it("ohne sichtbaren Befund und mit geschwärzter tragender Zeile: unbekannt, nicht „kein Widerspruch“", () => {
    expect(gesamt(new Set())).toBeNull();
    // Und ein Konflikt NUR an der geschwärzten Zeile wird nicht verraten — ebenfalls `null`.
    expect(gesamt(new Set(["ko-gesperrt"]))).toBeNull();
  });

  it("ein sichtbarer Widerspruch bleibt eine wahre Aussage über die Antwort", () => {
    expect(gesamt(new Set(["ko-sichtbar"]))).toBe(true);
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
    // Über eine geschwärzte tragende Zeile verrät die Gesamtaussage nichts — und behauptet auch
    // keine Konfliktfreiheit für sie (Ben, nacharbeit-2: vorher `false`).
    expect(body.carryingSourcesValidated).toBeNull();
    expect(body.openConflictToday).toBeNull();
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
