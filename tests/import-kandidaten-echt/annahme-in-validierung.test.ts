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
//     als Herkunftsanker mit — und (bens F2) eine sichere Original-URL bleibt auch OHNE externalId
//     bzw. bei ausgeschaltetem Anker-Strang am Objekt, eine unsichere wird verworfen (W5a-W5c),
//   · die öffentlichen Schreibrouten können die Kennzeichnung nicht fälschen,
//   · vom angenommenen Objekt führt der reguläre Zuweisungsweg (`ValidationService.assign`) zu
//     genau einer offenen Prüfaufgabe der benannten Person (W8, K6).
//
// WAS DIESE DATEI NICHT DECKT (ehrlich): echtes HTTP (Ausnahme seit R-1349: W6 am `POST /api/kos`),
// Postgres, Browser, ein echter Confluence-/
// SharePoint-Lauf und eine menschliche Bedienung. Die Auswahl der Prüferin trifft weiterhin ein
// Mensch; W8 führt den regulären Zuweisungsschritt aus, wie ihn die Prüfseite auslöst, und
// erfindet keine automatische Auswahl.
import { describe, expect, it } from "vitest";
import { herkunftsAuskunft } from "../../apps/web/src/lib/boardAuskunft";
import { buildApp, buildServices } from "../../services/app/src/build-app";
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

  // bens F2 (K5/K6): die Originalquelle hängt nicht am Anker-Strang. Zwei Ausgangslagen, dieselbe
  // Erwartung — die URL steht als Quelle am Objekt, ungeprüft und als importiert gekennzeichnet.
  // Sie ist dabei KEIN Re-Sync-Anker (keine externalId an der Quelle).
  const ORIGINAL_URL = "https://wiki.example.test/pages/4711";
  for (const [fall, externalUpsert, extra] of [
    ["W5a · Anker-Strang AN, aber ohne externalId", true, { url: ORIGINAL_URL }],
    [
      "W5b · Anker-Strang AUS, mit externalId",
      false,
      { url: ORIGINAL_URL, externalId: "PAGE-4711", provider: "confluence" },
    ],
  ] as const) {
    it(`${fall} → die Original-URL bleibt als Quelle am angenommenen Objekt`, async () => {
      const { koService, library } = await dienst(externalUpsert);
      const [k] = await library.createImportCandidates(
        [eintrag("Pumpe entlueften", "Pumpe alle 200h entlueften.", extra)],
        "anna",
        OHNE_AEHNLICHKEIT,
      );
      const antwort = await library.reviewImportCandidate(k?.id ?? "", "accept", "pedi");
      expect(antwort.status).toBe("angenommen");
      const objekt = await koService.get(antwort.koId ?? "");
      expect(
        {
          status: objekt?.status,
          trust: objekt?.trust,
          origin: objekt?.origin,
          importCandidateId: objekt?.importCandidateId,
        },
        "das Objekt startet nicht ungeprüft und als importiert gekennzeichnet",
      ).toEqual({ status: "offen", trust: 0, origin: "import", importCandidateId: k?.id });
      expect(
        objekt?.sources.map((s) => s.url),
        "die mitgelieferte Original-URL ist am angenommenen Objekt verloren gegangen",
      ).toEqual([ORIGINAL_URL]);
      expect(
        objekt?.sources.map((s) => [s.kind, s.peerValidated, s.externalId]),
        "die Originalquelle ohne wirksamen Anker darf kein Re-Sync-Anker sein",
      ).toEqual([["external", false, undefined]]);
    });
  }

  it("W5c · Sicherheitsgegenprobe: eine javascript:-URL wird auf demselben Weg verworfen", async () => {
    const { koService, library } = await dienst(true);
    const [k] = await library.createImportCandidates(
      [
        eintrag("Pumpe entlueften", "Pumpe alle 200h entlueften.", {
          url: "javascript:alert(1)",
        }),
      ],
      "anna",
      OHNE_AEHNLICHKEIT,
    );
    const antwort = await library.reviewImportCandidate(k?.id ?? "", "accept", "pedi");
    const objekt = await koService.get(antwort.koId ?? "");
    expect(objekt?.origin).toBe("import");
    expect(
      JSON.stringify(objekt?.sources ?? []),
      "eine unsichere URL ist als Quelle am Objekt gelandet",
    ).not.toContain("javascript:");
    expect(objekt?.sources, "eine verworfene URL erzeugt keine leere Quellenzeile").toEqual([]);
  });
});

describe("Importkandidaten · vom angenommenen Objekt zur offenen Prüfaufgabe (K6)", () => {
  it("W8: Annahme → reguläre Prüferzuweisung → genau eine offene Aufgabe der benannten Person", async () => {
    const { koService, library, validation } = await dienst(true);
    const [k] = await library.createImportCandidates(
      [
        eintrag("Pumpe entlueften", "Pumpe alle 200h entlueften.", {
          provider: "confluence",
          externalId: "PAGE-4711",
          url: "https://wiki.example.test/pages/4711",
          sourceVersion: 1,
        }),
      ],
      "anna",
      OHNE_AEHNLICHKEIT,
    );
    const antwort = await library.reviewImportCandidate(k?.id ?? "", "accept", "pedi");
    const koId = antwort.koId ?? "";
    expect(koId, "die Annahme hat kein Objekt angelegt").not.toBe("");

    // OHNE Zuweisungsschritt: keine Aufgabe — die Annahme selbst weist niemanden zu.
    expect(
      await validation.openAssignmentsFor("anna"),
      "schon die Annahme hat eine Prüfaufgabe erzeugt",
    ).toEqual([]);
    expect((await koService.get(koId))?.assignments).toEqual([]);

    // Der reguläre Zuweisungsweg (derselbe Dienstaufruf wie hinter der Zuweisungsaktion der Route).
    await validation.assign(koId, ["anna"], "pedi");

    expect(
      (await validation.openAssignmentsFor("anna")).map((a) => a.koId),
      "anna hat nicht genau die eine offene Aufgabe zum angenommenen Objekt",
    ).toEqual([koId]);
    expect(
      await validation.openAssignmentsFor("bert"),
      "eine nicht zugewiesene Person hat eine Aufgabe bekommen",
    ).toEqual([]);
    expect(
      (await validation.board()).map((o) => o.id),
      "das zugewiesene Objekt steht nicht mehr auf dem Prüf-Board",
    ).toContain(koId);

    const objekt = await koService.get(koId);
    expect({
      status: objekt?.status,
      trust: objekt?.trust,
      origin: objekt?.origin,
      importCandidateId: objekt?.importCandidateId,
      quellen: objekt?.sources.map((s) => [s.url, s.externalId]),
    }).toEqual({
      status: "offen",
      trust: 0,
      origin: "import",
      importCandidateId: k?.id,
      quellen: [["https://wiki.example.test/pages/4711", "PAGE-4711"]],
    });
  });
});

describe("Importkandidaten · die Kennzeichnung ist nicht faelschbar", () => {
  // R-1349 (Aufnahme gesamt-aufruferwaechter): W6 prüfte bis hierher den Helfer `ohneImportHerkunft`
  // (`ko-routes.ts`) — den keine Route rief. Die Routen verwerfen `origin` per Destrukturierung
  // VOLLSTÄNDIG (R-0139), also auch `import`; der Helfer ist deshalb entfernt, und W6 misst die Zusage
  // jetzt dort, wo sie gilt: am echten `POST /api/kos`. (Der frühere Zusatz „andere Herkunft bleibt
  // stehen" galt nur für den Helfer, nie für die Route — dort fällt jede Herkunft, R-0139.)
  it("W6: die öffentliche Schreibroute verwirft origin=import — am echten POST /api/kos", async () => {
    const app = buildApp(buildServices());
    await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { name: "Pedi", email: "w6@x.de", password: "secret123" },
    });
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "w6@x.de", password: "secret123" },
    });
    const headers = { authorization: `Bearer ${(login.json() as { token: string }).token}` };
    const res = await app.inject({
      method: "POST",
      url: "/api/kos",
      headers,
      payload: {
        confidentiality: "intern",
        title: "Gefälschter Import",
        statement: "Behauptet, aus der Import-Prüfwarteschlange zu stammen.",
        type: "best_practice",
        category: "Wartung",
        origin: "import",
      },
    });
    expect(res.statusCode, res.body).toBe(201);
    const angelegt = res.json() as { id: string; origin?: unknown };
    expect(angelegt.origin, "origin=import kam über den öffentlichen Rumpf durch").not.toBe(
      "import",
    );
    const gelesen = await app.inject({ method: "GET", url: `/api/kos/${angelegt.id}`, headers });
    expect(gelesen.statusCode, gelesen.body).toBe(200);
    expect((gelesen.json() as { origin?: unknown }).origin).not.toBe("import");
    await app.close();
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
