// ================================================================================================
// W3-C / AUFTRAG 134 — DAS KNOWLEDGE OBJECT IST DER ALLEINIGE TRÄGER DER VALIDIERUNGSREFERENZ
// ================================================================================================
//
// Pedis Entscheidung: **ausschließlich** das Knowledge Object trägt die additive
// `validationDecisionRef`. Ein Rating als alleiniger Träger ist verworfen — es deckt
// `adminValidate()` nicht und erzwänge einen zweiten Träger, also zwei Orte für eine Aussage.
//
// WAS DIESE DATEI BEWEIST UND WAS NICHT. Sie beweist, dass der Träger **exakt den Rückgabewert von
// `AuditService.record()`** festhält — nicht einen später gesuchten, nicht einen rekonstruierten,
// nicht den „letzten passenden" Eintrag. Der Auditeintrag bleibt der alleinige Wahrheitsort; das
// KO-Feld ist ein **Verweis**, den ein Leser über `findBySeq` einlösen muss.
//
// WARUM DIE DATEI UNTER `tests/` LIEGT UND NICHT IM MODUL. Sie spannt drei Module zusammen
// (knowledge-object, validation, audit) und prüft zusätzlich den HTTP-Lesepfad. `dependency-cruiser`
// prüft ausschließlich `services` (package.json: `arch`), und `tests/**` greift seit jeher direkt
// auf die Modulinterna zu. So bleibt die Modulgrenze in `services` unangetastet und es muss keine
// fremde Fassade (`services/audit/index.ts`) für einen Test aufgebohrt werden.
//
// DIE MEHRQUELLEN-ABBILDUNG IM ANSWER SNAPSHOT IST NICHT TEIL DIESER DATEI. Sie wartet auf
// KW-W3-23; `services/ask` wird hier nicht berührt.
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { AuditService, InMemoryAuditRepo } from "../../services/audit";
import { pruefeValidationDecisionRef } from "../../services/audit/src/repo";
import type { AuditEntry, AuditInput } from "../../services/audit/src/types";
import { InMemoryKoRepo } from "../../services/knowledge-object/src/repo";
import { KO_SCHEMA } from "../../services/knowledge-object/src/repo-pg";
import { KoService } from "../../services/knowledge-object/src/service";
import type { CreateKoInput } from "../../services/knowledge-object/src/service";
import type { KnowledgeObject } from "../../services/knowledge-object/src/types";
import { InMemoryAssignmentRepo, InMemoryRatingRepo } from "../../services/validation/src/repo";
import { ValidationService } from "../../services/validation/src/service";
import { InMemoryValidationSettingsRepo } from "../../services/validation/src/settings";

function koInput(overrides: Partial<CreateKoInput> = {}): CreateKoInput {
  return {
    title: "Wartung der Spezialpresse",
    statement: "Alle 500 Stunden schmieren.",
    type: "best_practice",
    category: "Technik",
    author: "anna",
    neededValidations: 2,
    ...overrides,
  };
}

/**
 * DER VERDREHTE AUDIT — die Negativkontrolle zu Rotfall 5.
 *
 * Er schreibt den echten Eintrag (die Kette bleibt heil), gibt dem Aufrufer aber einen um 5000
 * verschobenen `seq` und einen erkennbar fremden `hash` zurück. Eine Umsetzung, die den Träger aus
 * dem RÜCKGABEWERT füllt, trägt genau diese verdrehten Werte. Eine Umsetzung, die stattdessen
 * sucht („letzter Eintrag", „passende action/target/koVersion"), trägt die echten Werte und fällt
 * hier auf. Ohne diesen Fall wäre „niemals suchen" eine Behauptung.
 */
class VerdrehterAudit extends AuditService {
  override async record(input: AuditInput): Promise<AuditEntry> {
    const echt = await super.record(input);
    return { ...echt, seq: echt.seq + 5000, hash: `verdreht-${echt.hash}` };
  }
}

async function aufbau(auditKlasse: typeof AuditService = AuditService) {
  const auditRepo = new InMemoryAuditRepo();
  const audit = new auditKlasse({ repo: auditRepo });
  const koService = new KoService({ repo: new InMemoryKoRepo() });
  const ratings = new InMemoryRatingRepo();
  const dienst = new ValidationService({
    koService,
    ratings,
    assignments: new InMemoryAssignmentRepo(),
    settings: new InMemoryValidationSettingsRepo(),
    audit,
  });
  const ko = await koService.create(koInput());
  return { dienst, audit, auditRepo, koService, ratings, koId: ko.id, version: ko.version };
}

/** Der Träger, so wie ein Leser ihn vorfindet — ohne Umweg über den Rückgabewert von `rate()`. */
async function refAmKo(
  koService: KoService,
  koId: string,
): Promise<{ auditSeq: number; auditHash: string } | undefined> {
  const ko = await koService.get(koId);
  return ko?.validationDecisionRef;
}

describe("W3-C/134 · Rotfall 1 — das KO hält exakt den Rückgabewert von audit.record() fest", () => {
  it("rate: der Träger trägt dieselbe Referenz wie der Rückgabewert — und sie löst wirklich auf", async () => {
    const { dienst, auditRepo, koService, koId, version } = await aufbau();

    const ergebnis = await dienst.rate(koId, "bea", "up");
    const zurueck = ergebnis.validationDecisionRef;
    expect(zurueck, "rate muss weiterhin eine Referenz zurückgeben").not.toBeNull();
    if (!zurueck) {
      throw new Error("keine Referenz");
    }

    // (a) Der Träger existiert überhaupt — das ist der eigentliche Neubau.
    const getragen = await refAmKo(koService, koId);
    expect(getragen, "das KO muss die Referenz tragen").toBeDefined();

    // (b) ZWEI WEGE, EIN WERT. Wären es zwei Werte, hätten wir zwei Wahrheitsorte.
    expect(getragen).toEqual(zurueck);

    // (c) Der Verweis ist einlösbar: über findBySeq, gegen die HEUTIGE KO-Version.
    const eintrag = await auditRepo.findBySeq(getragen?.auditSeq ?? -1);
    const kette = await auditRepo.all();
    expect(
      pruefeValidationDecisionRef(
        eintrag,
        { auditSeq: getragen?.auditSeq ?? -1, auditHash: getragen?.auditHash ?? "" },
        { koId, koVersion: version },
        kette,
      ),
    ).toBe("OK");
    expect(eintrag?.action).toBe("ko.rated");
  });
});

describe("W3-C/134 · Rotfall 2 — die SPÄTERE Entscheidung ist die Entscheidung", () => {
  it("warn trägt die returnToAuthor-Referenz, NICHT die Bewertungsreferenz", async () => {
    const { dienst, auditRepo, koService, koId } = await aufbau();

    const ergebnis = await dienst.rate(koId, "bea", "warn");
    const getragen = await refAmKo(koService, koId);
    expect(getragen).toBeDefined();
    expect(getragen).toEqual(ergebnis.validationDecisionRef);

    const eintrag = await auditRepo.findBySeq(getragen?.auditSeq ?? -1);
    expect(eintrag?.action).toBe("ko.returned-to-author");

    // Die Bewertungsreferenz existiert, ist aber NICHT die getragene — sonst wäre „die spätere
    // Entscheidung ist die Entscheidung" nur eine Behauptung.
    const alle = await auditRepo.all();
    const bewertung = alle.find((e) => e.action === "ko.rated");
    expect(bewertung, "der ko.rated-Eintrag muss es geben").toBeDefined();
    expect(getragen?.auditSeq).not.toBe(bewertung?.seq);
  });

  it("down trägt ebenfalls die returnToAuthor-Referenz", async () => {
    const { dienst, auditRepo, koService, koId } = await aufbau();
    await dienst.rate(koId, "bea", "down");
    const getragen = await refAmKo(koService, koId);
    const eintrag = await auditRepo.findBySeq(getragen?.auditSeq ?? -1);
    expect(eintrag?.action).toBe("ko.returned-to-author");
  });

  it('GEGENFALL up: der Träger trägt die BEWERTUNGSreferenz — nicht einfach „immer die letzte"', async () => {
    const { dienst, auditRepo, koService, koId } = await aufbau();
    await dienst.rate(koId, "bea", "up");
    const getragen = await refAmKo(koService, koId);
    const eintrag = await auditRepo.findBySeq(getragen?.auditSeq ?? -1);
    expect(eintrag?.action).toBe("ko.rated");
    // Bei `up` entsteht gar keine Rückgabe an den Autor — der Gegenfall hält fest, dass die
    // Umsetzung die Fallunterscheidung wirklich trifft.
    const alle = await auditRepo.all();
    expect(alle.some((e) => e.action === "ko.returned-to-author")).toBe(false);
  });
});

describe("W3-C/134 · Rotfall 3 — adminValidate hält seine Referenz OHNE jedes Rating fest", () => {
  it("kein Rating entsteht, und das KO trägt trotzdem die Admin-Referenz", async () => {
    const { dienst, auditRepo, koService, ratings, koId, version } = await aufbau();

    const ergebnis = await dienst.adminValidate(koId, "admin");

    // Genau das kann ein Rating-Träger strukturell nicht: hier gibt es keins.
    expect(await ratings.listByKo(koId)).toEqual([]);

    const getragen = await refAmKo(koService, koId);
    expect(getragen).toBeDefined();
    expect(getragen).toEqual(ergebnis.validationDecisionRef);

    const eintrag = await auditRepo.findBySeq(getragen?.auditSeq ?? -1);
    expect(eintrag?.action).toBe("ko.admin-validated");
    expect(
      pruefeValidationDecisionRef(
        eintrag,
        { auditSeq: getragen?.auditSeq ?? -1, auditHash: getragen?.auditHash ?? "" },
        { koId, koVersion: version },
        await auditRepo.all(),
      ),
    ).toBe("OK");
  });
});

describe("W3-C/134 · Rotfall 4 — nach revise() prüft die alte Referenz als WRONG_SUBJECT", () => {
  it("die Referenz BLEIBT am KO und wird gegen die HEUTIGE Version WRONG_SUBJECT", async () => {
    const { dienst, auditRepo, koService, koId, version } = await aufbau();
    await dienst.adminValidate(koId, "admin");
    const vorher = await refAmKo(koService, koId);
    expect(vorher).toBeDefined();

    await koService.revise(koId, { statement: "Alle 250 Stunden schmieren." }, "anna");
    const revidiert = await koService.get(koId);
    expect(revidiert?.version).toBe(version + 1);

    // (a) Sie verschwindet NICHT — sonst wäre der Befund `MISSING` statt `WRONG_SUBJECT`, und der
    //     Leser könnte „nie entschieden" nicht von „für diese Fassung nicht mehr gültig" trennen.
    const nachher = await refAmKo(koService, koId);
    expect(nachher).toEqual(vorher);

    // (b) NEBEN der Referenz wird KEINE Version gespeichert. Täte man das, meldete eine veraltete
    //     Entscheidung dauerhaft `OK` — genau der schlechte Kompromiss, den die Entscheidung
    //     ausschließt. Das Subject kommt deshalb aus der HEUTIGEN KO-Version.
    expect(Object.keys(nachher ?? {}).sort()).toEqual(["auditHash", "auditSeq"]);

    const eintrag = await auditRepo.findBySeq(nachher?.auditSeq ?? -1);
    const kette = await auditRepo.all();
    const ref = { auditSeq: nachher?.auditSeq ?? -1, auditHash: nachher?.auditHash ?? "" };
    expect(
      pruefeValidationDecisionRef(
        eintrag,
        ref,
        { koId, koVersion: revidiert?.version ?? -1 },
        kette,
      ),
    ).toBe("WRONG_SUBJECT");
    // GEGENKONTROLLE: gegen die BEWERTETE Fassung ist derselbe Verweis weiterhin sauber — der
    // Befund kommt also wirklich aus der Versionsbindung und nicht aus einem kaputten Verweis.
    expect(pruefeValidationDecisionRef(eintrag, ref, { koId, koVersion: version }, kette)).toBe(
      "OK",
    );
  });
});

describe("W3-C/134 · Rotfall 4b — der Schreibvorgang ist CAS-gesichert", () => {
  it("passt die Version nicht mehr, unterbleibt das Festhalten — statt es einer fremden Fassung anzuhängen", async () => {
    const { koService, koId, version } = await aufbau();
    // Genau die Wettlaufsituation, die `setValidationState` schon kennt: die Entscheidung galt der
    // Vorversion, ein `revise` war schneller. Dann darf der Verweis NICHT landen.
    const unveraendert = await koService.setValidationDecisionRef(
      koId,
      { auditSeq: 42, auditHash: "fremd" },
      { expectedVersion: version + 1 },
    );
    expect(unveraendert.validationDecisionRef).toBeUndefined();
    expect(await refAmKo(koService, koId)).toBeUndefined();

    // Gegenprobe mit der PASSENDEN Version: derselbe Aufruf schreibt sehr wohl.
    await koService.setValidationDecisionRef(
      koId,
      { auditSeq: 42, auditHash: "fremd" },
      { expectedVersion: version },
    );
    expect(await refAmKo(koService, koId)).toEqual({ auditSeq: 42, auditHash: "fremd" });
  });
});

describe("W3-C/134 · Rotfall 5 — niemals suchen, niemals rekonstruieren", () => {
  it("ein verdrehter Rückgabewert landet unverändert am KO", async () => {
    const { dienst, auditRepo, koService, koId } = await aufbau(VerdrehterAudit);
    const ergebnis = await dienst.rate(koId, "bea", "up");
    const getragen = await refAmKo(koService, koId);

    expect(getragen).toEqual(ergebnis.validationDecisionRef);
    // Der echte Eintrag trägt seq 1 — getragen wird 5001. Wer sucht, trägt 1.
    const echte = await auditRepo.all();
    const echterEintrag = echte.find((e) => e.action === "ko.rated");
    expect(echterEintrag?.seq).toBe(1);
    expect(getragen?.auditSeq).toBe(5001);
    expect(getragen?.auditHash).toBe(`verdreht-${echterEintrag?.hash}`);
    // Und der Verweis löst folgerichtig NICHT auf — der Träger beschönigt nichts.
    expect(
      pruefeValidationDecisionRef(
        await auditRepo.findBySeq(getragen?.auditSeq ?? -1),
        { auditSeq: getragen?.auditSeq ?? -1, auditHash: getragen?.auditHash ?? "" },
        { koId, koVersion: 1 },
        echte,
      ),
    ).toBe("MISSING");
  });

  it("ohne verdrahteten Audit entsteht KEIN Träger — statt eines erfundenen Werts", async () => {
    const koService = new KoService({ repo: new InMemoryKoRepo() });
    const dienst = new ValidationService({
      koService,
      ratings: new InMemoryRatingRepo(),
      assignments: new InMemoryAssignmentRepo(),
      settings: new InMemoryValidationSettingsRepo(),
    });
    const ko = await koService.create(koInput());
    const ergebnis = await dienst.rate(ko.id, "bea", "up");
    expect(ergebnis.validationDecisionRef).toBeNull();
    expect(await refAmKo(koService, ko.id)).toBeUndefined();
  });
});

describe("W3-C/134 · Rotfall 6 — InMemory und PostgreSQL sagen dasselbe, ohne DDL", () => {
  it("das Feld überlebt genau die Serialisierung, die der Pg-Adapter benutzt", async () => {
    const { dienst, koService, koId } = await aufbau();
    await dienst.rate(koId, "bea", "up");
    const ko = await koService.get(koId);
    expect(ko?.validationDecisionRef).toBeDefined();

    // PgKoRepo schreibt `JSON.stringify(ko)` in `data jsonb` und liest `row.data` zurück. Genau
    // dieser Weg wird hier nachgestellt — hermetisch. Der Lauf gegen echtes Postgres liegt in
    // `w3c-ko-validierungsreferenz-traeger-134.integration.test.ts`.
    const durchJsonb = JSON.parse(JSON.stringify(ko)) as KnowledgeObject;
    expect(durchJsonb.validationDecisionRef).toEqual(ko?.validationDecisionRef);
  });

  it("KO_SCHEMA bekommt KEINE neue Spalte und KEIN ALTER — das Feld lebt im JSONB", () => {
    expect(KO_SCHEMA).not.toContain("validation_decision_ref");
    expect(KO_SCHEMA).not.toContain("validationDecisionRef");
    expect(KO_SCHEMA).not.toContain("ALTER TABLE");
  });

  it("ein ALTES KO ohne Feld bleibt lesbar und liefert schlicht kein Feld", async () => {
    const repo = new InMemoryKoRepo();
    const koService = new KoService({ repo });
    const ko = await koService.create(koInput());
    // Der Altbestand, wie er in `data jsonb` liegt: ohne den Schlüssel.
    const alt = JSON.parse(JSON.stringify(ko)) as Record<string, unknown>;
    expect("validationDecisionRef" in alt).toBe(false);
    expect((await koService.get(ko.id))?.validationDecisionRef).toBeUndefined();
  });
});

describe("W3-C/134 · Rotfall 7 — ein KO ohne Feld ergibt MISSING", () => {
  it('kein Feld heißt nicht „gültig" und heißt nicht Absturz', async () => {
    const { auditRepo, koService, koId } = await aufbau(); // bewusst NICHT bewertet
    const ko = await koService.get(koId);
    expect(ko?.validationDecisionRef).toBeUndefined();

    // Der Leser bekommt keinen Verweis — und muss daraus `MISSING` machen, nicht `OK`. Nachgestellt
    // mit dem Verweis, den es NICHT gibt (auditSeq 1 existiert in dieser Kette gar nicht).
    expect(
      pruefeValidationDecisionRef(
        await auditRepo.findBySeq(1),
        { auditSeq: 1, auditHash: "" },
        { koId, koVersion: ko?.version ?? 1 },
        await auditRepo.all(),
      ),
    ).toBe("MISSING");
  });
});

describe("W3-C/134 · Rotfall 8 — der BESTEHENDE KO-Lesepfad liefert das Feld mit", () => {
  it("GET /api/kos/:id trägt validationDecisionRef, ohne neue Rechteentscheidung", async () => {
    const services = buildServices();
    const app = buildApp(services);
    await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { name: "Pedi", email: "pedi134@x.de", password: "secret123" },
    });
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "pedi134@x.de", password: "secret123" },
    });
    const headers = {
      authorization: `Bearer ${(login.json() as { token: string }).token}`,
    };

    const ko = await services.ko.create(koInput({ author: "pedi" }));
    const entscheidung = await services.validation.adminValidate(ko.id, "pedi");
    expect(entscheidung.validationDecisionRef).not.toBeNull();

    const antwort = await app.inject({ method: "GET", url: `/api/kos/${ko.id}`, headers });
    expect(antwort.statusCode).toBe(200);
    const gelesen = antwort.json() as KnowledgeObject;
    // Der Lesepfad reicht das Feld strukturell durch — dieselbe Route, dasselbe `ko.read`.
    expect(gelesen.validationDecisionRef).toEqual(entscheidung.validationDecisionRef);
  });
});
