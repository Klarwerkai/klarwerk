// ================================================================================================
// R-0143 / R-1734 / R-1735 / R-1736 / R-0180 / R-2108 — VOM KANDIDATEN BIS ZUM PRÜF-BOARD.
// ================================================================================================
//
// Die Schwester von `entscheidung-am-echten-dienst.test.ts` (dort: Liste und Statuswechsel der
// Warteschlange). DIESE Datei misst den Weg danach, am echten Dienst und ohne Attrappe:
//
//   · vor der Entscheidung entsteht KEIN Wissensobjekt (R-0143: „erst wenn ein Mensch übernimmt"),
//   · ablehnen und Nachinformation anfordern legen nichts an (R-1735),
//   · erst die Annahme legt EIN Objekt an — ungeprüft (status offen, trust 0), ALS IMPORTIERT
//     gekennzeichnet (`origin: "import"`) und mit dem Kandidaten-Anker (R-0180/R-2108),
//   · dieses Objekt steht auf dem Validierungs-Board und trägt dort die Herkunft (R-1736),
//   · bei externer Quelle (Confluence/SharePoint-Strang, `externalUpsert`) reist die Originalquelle
//     als Herkunftsanker mit,
//   · die öffentlichen Schreibrouten können die Kennzeichnung nicht fälschen.
//
// WAS DIESE DATEI NICHT DECKT (ehrlich): echtes HTTP, Postgres, Browser, ein echter Confluence-/
// SharePoint-Lauf und eine menschliche Bedienung. Die konkrete Zuweisung an benannte Prüfer bleibt
// eine menschliche Entscheidung (`ValidationService.assign`) und wird hier NICHT automatisch
// getroffen — gemessen wird, dass das Objekt auf dem Board zur Zuweisung bereitsteht.
import { describe, expect, it } from "vitest";
import { herkunftsAuskunft } from "../../apps/web/src/lib/boardAuskunft";
import { ohneImportHerkunft } from "../../services/app/src/routes/ko-routes";
import { InMemoryKoRepo, KoService } from "../../services/knowledge-object";
import { InMemoryCandidateRepo } from "../../services/library-analytics/src/repo";
import { LibraryService } from "../../services/library-analytics/src/service";
import type { DublettenPruefung, ImportItem } from "../../services/library-analytics/src/types";
import {
  InMemoryAssignmentRepo,
  InMemoryRatingRepo,
  ValidationService,
  mitHerkunft,
} from "../../services/validation";

// Dieselbe nie treffende Prüfung wie in der Schwesterdatei: die Textregel entscheidet hier nichts.
const OHNE_AEHNLICHKEIT: DublettenPruefung = () => ({ dublette: false });

async function dienst(externalUpsert = false) {
  const koService = new KoService({ repo: new InMemoryKoRepo() });
  await koService.activateSearchProjectionV2();
  let lauf = 0;
  const library = new LibraryService({
    koService,
    candidates: new InMemoryCandidateRepo(),
    genId: () => `id-${++lauf}`,
    now: () => Date.parse("2026-10-04T09:00:00.000Z") + ++lauf * 1000,
    externalUpsert,
  });
  const validation = new ValidationService({
    koService,
    ratings: new InMemoryRatingRepo(),
    assignments: new InMemoryAssignmentRepo(),
  });
  return { koService, library, validation };
}

function eintrag(titel: string, satz: string, extra: Partial<ImportItem> = {}): ImportItem {
  return {
    title: titel,
    statement: satz,
    type: "best_practice",
    category: "Wartung",
    author: "anna",
    ...extra,
  };
}

describe("Importkandidaten · vor der Entscheidung kein Wissensobjekt", () => {
  it("W1: Hochladen erzeugt einzelne Kandidaten in der Warteschlange — und noch KEIN Objekt", async () => {
    const { koService, library } = await dienst();
    const kandidaten = await library.createImportCandidates(
      [
        eintrag("Pumpe entlueften", "Pumpe alle 200h entlueften."),
        eintrag("Filter wechseln", "Filter alle 50h wechseln."),
      ],
      "anna",
      OHNE_AEHNLICHKEIT,
    );
    expect(kandidaten.map((k) => [k.status, k.koId])).toEqual([
      ["neu", null],
      ["neu", null],
    ]);
    expect(
      (await library.listImportCandidates()).map((k) => k.id),
      "die Kandidaten stehen nicht einzeln in der Warteschlange",
    ).toEqual(kandidaten.map((k) => k.id));
    expect(
      await koService.list(),
      "schon das Hochladen hat ein Wissensobjekt angelegt — das waere die Dateihalde",
    ).toEqual([]);
  });

  it("W2: ablehnen und Nachinformation anfordern legen KEIN Objekt an", async () => {
    const { koService, library } = await dienst();
    const [a, b] = await library.createImportCandidates(
      [
        eintrag("Pumpe entlueften", "Pumpe alle 200h entlueften."),
        eintrag("Filter wechseln", "Filter alle 50h wechseln."),
      ],
      "anna",
      OHNE_AEHNLICHKEIT,
    );
    const abgelehnt = await library.reviewImportCandidate(a?.id ?? "", "reject", "pedi");
    const angefragt = await library.reviewImportCandidate(
      b?.id ?? "",
      "info",
      "pedi",
      "Woher stammt das?",
    );
    expect([abgelehnt.status, abgelehnt.koId]).toEqual(["abgelehnt", null]);
    expect([angefragt.status, angefragt.koId, angefragt.note]).toEqual([
      "info-angefragt",
      null,
      "Woher stammt das?",
    ]);
    expect(await koService.list(), "eine Nicht-Annahme hat ein Objekt angelegt").toEqual([]);
  });
});

describe("Importkandidaten · die Annahme fuehrt in den Validierungsfluss", () => {
  it("W3: angenommen → EIN Objekt, ungeprüft, als importiert gekennzeichnet, auf dem Prüf-Board", async () => {
    const { koService, library, validation } = await dienst();
    const [k] = await library.createImportCandidates(
      [eintrag("Pumpe entlueften", "Pumpe alle 200h entlueften.")],
      "anna",
      OHNE_AEHNLICHKEIT,
    );
    const antwort = await library.reviewImportCandidate(k?.id ?? "", "accept", "pedi");
    expect(antwort.status).toBe("angenommen");

    const alle = await koService.list();
    expect(
      alle.map((o) => o.id),
      "die Annahme hat nicht genau EIN Objekt angelegt",
    ).toEqual([antwort.koId]);
    const objekt = await koService.get(antwort.koId ?? "");
    expect(
      {
        status: objekt?.status,
        trust: objekt?.trust,
        origin: objekt?.origin,
        importCandidateId: objekt?.importCandidateId,
        author: objekt?.author,
        originalAuthor: objekt?.originalAuthor,
      },
      "das angenommene Objekt startet nicht ungeprüft und als importiert gekennzeichnet",
    ).toEqual({
      status: "offen",
      trust: 0,
      origin: "import",
      importCandidateId: k?.id,
      author: "pedi",
      originalAuthor: "anna",
    });

    // Validierungsfluss: das Board liest status offen — das Objekt steht dort zur Prüfung bereit.
    const board = await validation.board();
    expect(
      board.map((o) => o.id),
      "das angenommene Objekt steht nicht auf dem Validierungs-Board",
    ).toContain(antwort.koId);
    const zeile = mitHerkunft(board.find((o) => o.id === antwort.koId) ?? {});
    expect(zeile.origin, "das Board meldet die Importherkunft nicht").toBe("import");
    // … und die Oberflaeche beschriftet sie, statt „unbekannt" zu sagen.
    expect(herkunftsAuskunft({ origin: zeile.origin })).toEqual({
      lage: "herkunft_bekannt",
      herkunft: "import",
      labelKey: "ko.origin.import",
    });
  });

  it("W4: externe Quelle (Anker-Strang aktiv) → die Originalquelle reist als Herkunftsanker mit", async () => {
    const { koService, library } = await dienst(true);
    const [k] = await library.createImportCandidates(
      [
        eintrag("Pumpe entlueften", "Pumpe alle 200h entlueften.", {
          provider: "confluence",
          externalId: "PAGE-4711",
          url: "https://wiki.example.test/pages/4711",
          sourceVersion: 3,
        }),
      ],
      "anna",
      OHNE_AEHNLICHKEIT,
    );
    const antwort = await library.reviewImportCandidate(k?.id ?? "", "accept", "pedi");
    const objekt = await koService.get(antwort.koId ?? "");
    expect(objekt?.origin).toBe("import");
    expect(
      objekt?.sources.map((s) => ({
        url: s.url,
        kind: s.kind,
        provider: s.provider,
        externalId: s.externalId,
        sourceVersion: s.sourceVersion,
        peerValidated: s.peerValidated,
      })),
      "die Originalquelle fehlt am angenommenen Objekt",
    ).toEqual([
      {
        url: "https://wiki.example.test/pages/4711",
        kind: "external",
        provider: "confluence",
        externalId: "PAGE-4711",
        sourceVersion: 3,
        peerValidated: false,
      },
    ]);
  });

  it("W5 (benannte Grenze): JSON-Kandidat OHNE externe Kennung → importiert gekennzeichnet, aber ohne Quellenanker", async () => {
    // Gemessener Ist-Zustand, keine Zusage: `acceptToKo` schreibt den Herkunftsanker nur mit
    // externalId bei aktivem Anker-Strang. Ein hochgeladenes JSON ohne Kennung hat keine verlinkbare
    // Originalquelle; die Kennzeichnung `import` und der Kandidaten-Anker bleiben die Spur zurück.
    const { koService, library } = await dienst(true);
    const [k] = await library.createImportCandidates(
      [eintrag("Pumpe entlueften", "Pumpe alle 200h entlueften.")],
      "anna",
      OHNE_AEHNLICHKEIT,
    );
    const antwort = await library.reviewImportCandidate(k?.id ?? "", "accept", "pedi");
    const objekt = await koService.get(antwort.koId ?? "");
    expect([objekt?.origin, objekt?.importCandidateId, objekt?.sources]).toEqual([
      "import",
      k?.id,
      [],
    ]);
  });
});

describe("Importkandidaten · die Kennzeichnung ist nicht faelschbar", () => {
  it("W6: die öffentlichen Schreibrouten verwerfen origin=import und lassen andere Herkunft stehen", () => {
    const gefaelscht = ohneImportHerkunft({ title: "x", origin: "import" as const });
    expect("origin" in gefaelscht, "origin=import kam über den öffentlichen Rumpf durch").toBe(
      false,
    );
    expect(gefaelscht.title).toBe("x");
    expect(ohneImportHerkunft({ title: "y", origin: "word_addin" as const }).origin).toBe(
      "word_addin",
    );
  });

  it("W7: eine normale Anlage ohne Import bleibt ohne Importkennzeichnung", async () => {
    const { koService } = await dienst();
    const objekt = await koService.create({
      title: "Lager fetten",
      statement: "Lager alle 500h fetten.",
      type: "best_practice",
      category: "Wartung",
      author: "anna",
      tags: [],
      confidentiality: "intern",
    });
    expect(objekt.origin, "eine Anlage ohne Import traegt die Importherkunft").toBeUndefined();
  });
});
