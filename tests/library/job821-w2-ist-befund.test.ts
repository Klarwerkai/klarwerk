// JOB 821 dokumentierte zunächst einen Laufvertrag ohne Schreiber. R-0142 hat den Importentscheid
// an den Lauf gebunden. Der Referenzwert ist die ID des entschiedenen ImportCandidate.
import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";
import { describe, expect, expectTypeOf, it } from "vitest";
import { buildServices } from "../../services/app/src/build-app";
import { pruefeSnapshotKette } from "../../services/ask/src/repo";
import { AskError } from "../../services/ask/src/types";
import type { ImportItem, ImportRunItemRef } from "../../services/library-analytics";
import { repoPfad } from "../support/repoPfad";

function produktdateien(wurzel: string): string[] {
  return readdirSync(wurzel, { withFileTypes: true }).flatMap((eintrag) => {
    if (eintrag.name === "node_modules" || eintrag.name === "dist") return [];
    const pfad = join(wurzel, eintrag.name);
    if (eintrag.isDirectory()) return produktdateien(pfad);
    return /(?<!\.test)\.tsx?$/.test(pfad) ? [pfad] : [];
  });
}

describe("JOB 821 · Referenzziel der Importlauf-Elemente", () => {
  it("die Entscheidung baut die Referenz, Repo und Ergebnisroute reichen die ID weiter", () => {
    const aufrufe: string[] = [];
    const zuweisungen: string[] = [];
    for (const pfad of [
      ...produktdateien(repoPfad("services")),
      ...produktdateien(repoPfad("apps")),
    ]) {
      const text = readFileSync(pfad, "utf8");
      if (!/appendItemRefs|candidateItemId/.test(text)) continue;
      const datei = relative(repoPfad("."), pfad);
      const baum = ts.createSourceFile(pfad, text, ts.ScriptTarget.Latest, true);
      const besuche = (knoten: ts.Node): void => {
        if (
          ts.isCallExpression(knoten) &&
          ts.isPropertyAccessExpression(knoten.expression) &&
          knoten.expression.name.text === "appendItemRefs"
        ) {
          aufrufe.push(datei);
        }
        if (
          (ts.isPropertyAssignment(knoten) || ts.isShorthandPropertyAssignment(knoten)) &&
          knoten.name.getText(baum) === "candidateItemId"
        ) {
          const wert = ts.isPropertyAssignment(knoten) ? knoten.initializer : knoten.name;
          zuweisungen.push(`${datei}: ${wert.getText(baum)}`);
        }
        ts.forEachChild(knoten, besuche);
      };
      besuche(baum);
    }
    expect(aufrufe).toEqual(["services/library-analytics/src/service.ts"]);
    expect(zuweisungen.sort()).toEqual([
      "services/app/src/routes/import-run-routes.ts: ref.candidateItemId",
      "services/library-analytics/src/repo.ts: ref.candidateItemId",
      "services/library-analytics/src/service.ts: candidateId",
    ]);
  });

  it("nur eine endgültige Entscheidung bindet Kandidat, Laufposition und gegebenenfalls Wissensobjekt", async () => {
    const { library, importRuns } = buildServices();
    const importId = "job821-quelllauf";
    await importRuns.insertIfAbsent({
      importId,
      sourceSystem: "datei",
      externalId: null,
      sourceScope: "Betriebsdaten",
      requestedSourceVersion: null,
      status: "COMPLETED",
      sourceRecordId: null,
      startedAt: "2026-01-01T10:00:00Z",
      completedAt: "2026-01-01T10:01:00Z",
      failureCode: null,
      failureReason: null,
      counters: { itemsTotal: 3, itemsCreated: 0, itemsBound: 0, itemsSkipped: 0, itemsFailed: 0 },
    });
    const items: ImportItem[] = [
      {
        title: "Wasserstand",
        externalId: "quelle-wasserstand",
        sourceScope: "Betriebsdaten",
        statement: "Der Pegel beträgt zwei Meter.",
        type: "technik",
        category: "Messung",
      },
      {
        title: "Spannung",
        statement: "Der Messwert beträgt zwölf Volt.",
        type: "technik",
        category: "Labor",
      },
      {
        title: "Messgerät",
        statement: "Der Sensor braucht ein Kalibrierblatt.",
        type: "technik",
        category: "Beschaffung",
      },
    ];
    const [ja, nein, rueckfrage] = await library.createImportCandidates(
      items,
      "import",
      undefined,
      {
        quellangabenEingereicht: true,
        lauf: { importId },
      },
    );
    if (!ja || !nein || !rueckfrage)
      throw new Error("Drei unterschiedliche Importkandidaten erwartet.");
    await library.reviewImportCandidate(rueckfrage.id, "info", "pruefer", "Welche Quelle?");
    expect(await importRuns.listItemRefs(importId)).toEqual([]);
    await library.reviewImportCandidate(nein.id, "reject", "pruefer");
    const angenommen = await library.reviewImportCandidate(ja.id, "accept", "pruefer");
    expect(angenommen.status, angenommen.note ?? undefined).toBe("angenommen");
    expect(angenommen.koId).toBeTruthy();
    expect(angenommen.koId).not.toBe(ja.id);
    expect(await library.zieheLaufReferenzenNach()).toBe(0);
    expect(await importRuns.listItemRefs(importId)).toEqual([
      {
        importId,
        ordinal: 0,
        sourceRecordId: null,
        candidateItemId: ja.id,
        knowledgeObjectId: angenommen.koId,
        itemOutcome: "CREATED",
        itemFailureCode: null,
      },
      {
        importId,
        ordinal: 1,
        sourceRecordId: null,
        candidateItemId: nein.id,
        knowledgeObjectId: null,
        itemOutcome: "SKIPPED",
        itemFailureCode: null,
      },
    ]);
  });

  it("die Ablage weist eine leere Kandidaten-ID ab", async () => {
    expectTypeOf<ImportRunItemRef["candidateItemId"]>().toEqualTypeOf<string>();
    const { importRuns } = buildServices();
    await expect(
      importRuns.appendItemRefs([
        {
          importId: "job821",
          ordinal: 0,
          sourceRecordId: null,
          candidateItemId: " ",
          knowledgeObjectId: null,
          itemOutcome: "SKIPPED",
          itemFailureCode: null,
        },
      ]),
    ).rejects.toThrow("Eine Elementreferenz ohne candidateItemId referenziert nichts.");
    expect(await importRuns.listItemRefs("job821")).toEqual([]);
  });
});

describe("JOB 821 · Z2 — die Fundstellen-Kette ist über zwei Dienste hinweg ehrlich", () => {
  // Der Import erzeugt keine Belegstelle (`excerpt: null`, s. import-fundstelle.test.ts). Der
  // Antwortweg trägt dieselbe Wahrheit weiter — und zwar MIT maschinenlesbarem Grund. Dieser Teil
  // ist funktional geprüft, nicht gelesen: `pruefeSnapshotKette` ist exportiert.
  const basis = {
    answerId: "a-1",
    snapshotRevision: 1,
    supersedesSnapshotRevision: null,
    resolutionId: null,
    resolutionIdReason: "w2a_not_wired",
    validationDecisionRef: null,
    validationDecisionRefReason: "w2a_not_wired",
  };
  const beleg = {
    knowledgeObjectId: "ko-1",
    knowledgeObjectVersion: null,
    evidenceRole: "consulted" as const,
    sourceRecordId: null,
    sourceRecordIdReason: "w2a_not_wired",
  };

  it("ein fehlender `locator` MIT Grund ist zulässig — das ist der Importfall", () => {
    // `no_locator_from_import` ist der kanonische Grund für genau diese Lage (ask/src/types.ts).
    expect(() =>
      pruefeSnapshotKette(
        {
          ...basis,
          evidence: [{ ...beleg, locator: null, locatorReason: "no_locator_from_import" }],
        } as never,
        [],
      ),
    ).not.toThrow();
  });

  it("ein fehlender `locator` OHNE Grund wird abgelehnt — Schweigen ist kein Grund", () => {
    // Die Gegenrichtung. Ohne sie belegte der Fall oben nur, dass irgendetwas durchgeht.
    expect(() =>
      pruefeSnapshotKette(
        { ...basis, evidence: [{ ...beleg, locator: null, locatorReason: null }] } as never,
        [],
      ),
    ).toThrow(AskError);
  });

  it("derselbe Vertrag gilt für die Quellsatz-Referenz", () => {
    expect(() =>
      pruefeSnapshotKette(
        {
          ...basis,
          evidence: [
            {
              ...beleg,
              sourceRecordIdReason: null,
              locator: null,
              locatorReason: "no_locator_from_import",
            },
          ],
        } as never,
        [],
      ),
    ).toThrow(AskError);
  });
});
