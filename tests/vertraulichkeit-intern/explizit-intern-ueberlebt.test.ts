// ==================================================================================================
// JOB 3076 · Q1 — EINE AUSDRÜCKLICH GESETZTE STUFE „ÖFFENTLICH-INTERN" ÜBERLEBT DAS SPEICHERN.
// ==================================================================================================
//
// DER GEMESSENE SCHADEN. Codex-Abnahme R-1613 vom 05.09.2026 gegen https://app.klarwerk.ai
// (1.0.0-beta.1.89, Rolle Administrator, Testobjekt c22c690f-9574-4998-a030-700cb2166476), Prüfschritt 4
// wörtlich: „HTTP 201, danach confidentiality null und provenance unknown. Beide Flächen zeigen Nicht
// eingestuft." Wer beim Erfassen bewusst „Öffentlich-intern" wählte, bekam sein Objekt als „Nicht
// eingestuft" zurück — als hätte nie jemand hingeschaut. Die drei Bestandsfälle daneben (vertraulich,
// streng_vertraulich, fehlend) waren im SELBEN Lauf `bestanden`: der Fehler saß nicht in der Anzeige,
// sondern im Speicherweg (`service.ts` `buildCreatedKo`).
//
// WARUM DIE AUSKUNFT GEPRÜFT WIRD UND NICHT NUR DER GESPEICHERTE WERT. Die Fläche liest
// `discloseConfidentiality` (confidentiality.ts:99-102), nicht das Rohfeld. Erst `provenance: "ko"`
// ist die Aussage „jemand hat eingestuft, und zwar so"; `"unknown"` ist die Aussage „niemand hat hier
// je eingestuft" (ebd. :78-80). Genau diese zwei Aussagen hat der Speicherweg zusammengeworfen.
//
// DIE FÜNF FÄLLE HALTEN SICH GEGENSEITIG IN SCHACH:
//   V1 der gemessene Fall.            V2 die Gegenrichtung — kein stiller Default „intern".
//   V3 die zwei scharfen Stufen.      V4 der Egress-Ausschluss bewegt sich nicht.
//   V5 der Änderungsweg (Downgrade-Schutz, Audit) bleibt heil.
// Keiner ist durch einen anderen ersetzbar: V1 allein wäre auch mit einem Default „intern" grün, und
// genau der zerstörte die Unterscheidung für jedes künftige Objekt.
import { describe, expect, it } from "vitest";
import { AuditService, InMemoryAuditRepo } from "../../services/audit";
import {
  type CreateKoInput,
  InMemoryKoRepo,
  type KnowledgeObject,
  KoService,
  discloseConfidentiality,
  dropConfidential,
  isConfidential,
} from "../../services/knowledge-object";

function eingabe(overrides: Partial<CreateKoInput> = {}): CreateKoInput {
  return {
    title: "Kesselwartung",
    statement: "Der Kessel wird jährlich gewartet.",
    type: "best_practice",
    category: "Anlage 1",
    author: "anna",
    neededValidations: 2,
    ...overrides,
  };
}

/** Der Dienst über einem frischen Bestand — plus der Bestand selbst, für die Rohsicht in V2. */
function dienst(): { ko: KoService; repo: InMemoryKoRepo } {
  const repo = new InMemoryKoRepo();
  return { ko: new KoService({ repo }), repo };
}

describe("JOB 3076 · ausdrücklich „Öffentlich-intern“ überlebt den Speicherweg", () => {
  it("V1 · der gemessene Fall: create mit „intern“ → gelesen „intern“, Herkunft „ko“", async () => {
    const { ko } = dienst();
    const angelegt = await ko.create(eingabe({ confidentiality: "intern" }));
    // Über den Dienst zurücklesen — nicht die Rückgabe von `create` glauben, sondern den Bestand.
    const gelesen = await ko.get(angelegt.id);
    expect(gelesen?.confidentiality).toBe("intern");
    // Und die AUSKUNFT, die die Fläche tatsächlich liest. Vor JOB 3076 stand hier
    // `{ confidentiality: null, confidentialityProvenance: "unknown" }` — die Ausgabe, die Codex am
    // lebenden System gemessen hat.
    expect(discloseConfidentiality(gelesen?.confidentiality)).toEqual({
      confidentiality: "intern",
      confidentialityProvenance: "ko",
    });
  });

  it("V2 · die Gegenrichtung: ohne Angabe bleibt das Feld weg und die Auskunft „unbekannt“", async () => {
    const { ko, repo } = dienst();
    const angelegt = await ko.create(eingabe());
    // Die Rohsicht des Bestands: der Schlüssel FEHLT, er steht nicht als `undefined` da. Ein Default
    // „intern" wäre eine Einstufung, die nie jemand gesetzt hat (i18n.ts:1991) — und danach gäbe es
    // keinen Weg mehr, „nie eingestuft" überhaupt auszudrücken.
    const gespeichert = await repo.findById(angelegt.id);
    expect(gespeichert, "das Objekt liegt im Bestand").toBeDefined();
    expect(Object.hasOwn(gespeichert as object, "confidentiality")).toBe(false);
    expect(discloseConfidentiality(gespeichert?.confidentiality)).toEqual({
      confidentiality: null,
      confidentialityProvenance: "unknown",
    });
  });

  it("V3 · Rückfallschutz: „vertraulich“ und „streng_vertraulich“ bleiben unverändert", async () => {
    const { ko } = dienst();
    for (const stufe of ["vertraulich", "streng_vertraulich"] as const) {
      const angelegt = await ko.create(eingabe({ confidentiality: stufe }));
      const gelesen = await ko.get(angelegt.id);
      expect(gelesen?.confidentiality).toBe(stufe);
      expect(isConfidential(gelesen?.confidentiality)).toBe(true);
      expect(discloseConfidentiality(gelesen?.confidentiality)).toEqual({
        confidentiality: stufe,
        confidentialityProvenance: "ko",
      });
    }
  });

  it("V4 · der Ausschlussweg verschiebt sich NICHT: „intern“ passiert dropConfidential", async () => {
    const { ko } = dienst();
    const intern = await ko.create(eingabe({ confidentiality: "intern" }));
    const ohne = await ko.create(eingabe());
    const vertraulich = await ko.create(eingabe({ confidentiality: "vertraulich" }));
    const alle = [intern, ohne, vertraulich].map((k) => (k as KnowledgeObject) ?? k);
    // confidentiality.ts:107: „„intern"/fehlendes Feld bleibt drin". Das neu vorhandene Feld darf ein
    // Objekt weder aus externen Kontexten werfen noch ein vertrauliches hineinlassen.
    const durchgelassen = dropConfidential(alle).map((k) => k.id);
    expect(durchgelassen).toEqual([intern.id, ohne.id]);
    expect(isConfidential(intern.confidentiality)).toBe(false);
  });

  it("V5 · der Änderungsweg bleibt heil: Upgrade frei, Downgrade geschützt, Audit wie bisher", async () => {
    const audit = new AuditService({ repo: new InMemoryAuditRepo() });
    const ko = new KoService({ repo: new InMemoryKoRepo(), audit });
    const angelegt = await ko.create(eingabe({ confidentiality: "intern" }));

    // Heben: für den Autor frei (SCRUM-509), `previous` ist die ausdrücklich gesetzte Stufe.
    const gehoben = await ko.setConfidentiality(angelegt.id, "vertraulich", "anna");
    expect(gehoben.confidentiality).toBe("vertraulich");

    // Senken OHNE Recht: abgelehnt, die Stufe bleibt stehen (fail-safe, unverändert).
    await expect(ko.setConfidentiality(angelegt.id, "intern", "anna")).rejects.toThrow();
    expect((await ko.get(angelegt.id))?.confidentiality).toBe("vertraulich");

    // Senken MIT Recht: greift und landet als Herabstufung im Audit.
    const gesenkt = await ko.setConfidentiality(angelegt.id, "intern", "chef", {
      mayDowngrade: true,
    });
    expect(gesenkt.confidentiality).toBe("intern");

    const eintraege = (await audit.list({ action: "ko.confidentiality" })) as {
      payload?: { level?: string; previous?: string; downgrade?: boolean };
    }[];
    // Genau die zwei GELUNGENEN Änderungen — der abgelehnte Versuch schreibt nichts.
    expect(eintraege.map((e) => e.payload)).toEqual([
      { level: "vertraulich", previous: "intern", downgrade: false },
      { level: "intern", previous: "vertraulich", downgrade: true },
    ]);
  });
});
