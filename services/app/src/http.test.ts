import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import { KoError } from "../../knowledge-object";
import { isInternalOnlyError, sendError } from "./http";

// G27 R1 — KW-ARCH-G27-HTTP-MASKIERUNG-07: der rein interne Readiness-Fehler
// `SEARCH_PROJECTION_NOT_READY` darf nach außen weder als eigener Fehlercode noch mit seiner
// technischen Zustandsmeldung erscheinen. Diese Datei ist der erste Test für `sendError` überhaupt
// (geprüft: keine bestehende Testdatei importiert die Funktion) — sie prüft deshalb nicht nur die
// neue Maskierung, sondern zieht die heutige Fehlerabbildung als Ganzes fest, damit die Ergänzung
// nachweislich nichts anderes verschoben hat.
//
// Aufbau: eine echte `Fastify()`-Instanz mit Wegwerf-Route und `inject()`. Kein `reply`-Stub — die
// Zusicherung soll auf dem DRAHT stehen (§3 der Entscheidung), und der Maskierungszweig benutzt
// `reply.log`, das nur eine echte Instanz stellt.

// Die generische interne Antwort, wie sie seit jeher im Auffangzweig steht. Der maskierte Fall muss
// damit BYTEGLEICH sein — jede Abweichung wäre ein Orakel „dieser Fehler ist der Projektionsfehler"
// und damit eine leisere Form desselben Lecks.
const GENERISCHE_ANTWORT = { error: "INTERNAL", message: "Unerwarteter Fehler." };

// Die zwölf heutigen `STATUS_BY_CODE`-Einträge, hier bewusst als ZWEITE, unabhängige Niederschrift
// des Vertrags. Läuft die Tabelle im Produktcode auseinander, fällt es hier auf.
const STATUS_ERWARTUNG: Record<string, number> = {
  NOT_FOUND: 404,
  FORBIDDEN: 403,
  NOT_APPROVED: 403,
  DOWNGRADE_FORBIDDEN: 403,
  INVALID_CREDENTIALS: 401,
  EMAIL_TAKEN: 409,
  CLEANUP_DRIFT: 409,
  CONFLICT: 409,
  CREATE_ANCHOR_TAKEN: 409,
  CREATE_ROLLBACK_FAILED: 500,
  IDEMPOTENCY_PAYLOAD_MISMATCH: 409,
  CREATE_REPAIR_REQUIRED: 409,
};

// Die neun tatsächlichen Meldungen am Quelltext (2 aus `search-projection-repo.ts`
// § `freigegebeneProjektionsfassung`, 7 aus `service.ts` § Lebenszyklus). Alle tragen einen
// Control-State im Klartext; keine davon darf nach außen gelangen.
const ECHTE_MELDUNGEN = [
  "Suchprojektion nicht freigegeben (Zustand V2_BUILDING).",
  "Control-State inkonsistent (Zustand FAILED).",
  "Zustandswechsel abgelehnt: erwartet V2_READY, vorgefunden V2_BUILDING.",
  "V1_ACTIVE ist nicht erklärbar: der Bestand ist nicht vollständig in Fassung 1.",
  "V2_BUILDING ist aus UNINITIALIZED nicht zulässig.",
  "V2_READY ist aus V2_ACTIVE nicht zulässig.",
  "Freigabe ist aus V2_BUILDING nicht zulässig.",
  "Freigabe abgelehnt: Projektionsfassung 2 fehlt für 3 aktive Wissenseinheiten",
  "Rollback ist aus V1_ACTIVE nicht zulässig.",
];

// Was im rohen Payload NIE stehen darf: der technische Code, jeder Control-State-Name und die
// Begriffe, über die sich der interne Vorgang erschließen ließe (§4 No-Gos, einzeln abgedeckt).
const VERBOTENE_SPUREN = [
  "SEARCH_PROJECTION_NOT_READY",
  "UNINITIALIZED",
  "V2_BUILDING",
  "V2_READY",
  "V2_ACTIVE",
  "V1_ACTIVE",
  "FAILED",
  "Zustand",
  "Projektion",
  "Control-State",
  "projectionVersion",
  "Fassung",
];

interface Logzeile {
  readonly level: number;
  readonly reqId?: string;
  readonly code?: string;
  readonly msg?: string;
  readonly err?: { readonly message?: string };
}

interface Probe {
  readonly status: number;
  readonly payload: string;
  readonly logzeilen: Logzeile[];
}

/**
 * Eine echte Fastify-Instanz mit genau einer Route, die abfängt und über `sendError` beantwortet —
 * der Weg, den heute 61 Aufrufstellen in 15 Routendateien nehmen.
 *
 * Der Logger ist echtes Pino auf einen aufzeichnenden Strom. Die Logzeilen sind damit nicht
 * simuliert, sondern dieselben, die im Betrieb entstünden — inklusive der von Fastify gesetzten
 * `reqId`, an der die Zuordenbarkeit zum Vorgang hängt.
 */
async function probe(error: unknown): Promise<Probe> {
  const logzeilen: Logzeile[] = [];
  const app = Fastify({
    logger: {
      level: "error",
      stream: {
        write(zeile: string) {
          logzeilen.push(JSON.parse(zeile) as Logzeile);
        },
      },
    },
  });
  app.get("/probe", async (_request, reply) => {
    sendError(reply, error);
  });
  try {
    const res = await app.inject({ method: "GET", url: "/probe" });
    return { status: res.statusCode, payload: res.payload, logzeilen };
  } finally {
    await app.close();
  }
}

describe("G27 R1 — sendError maskiert den rein internen Readiness-Fehler", () => {
  it("Pflicht 1: echter KoError und formgleiches Objekt werden identisch maskiert", async () => {
    const meldung = "Suchprojektion nicht freigegeben (Zustand V2_BUILDING).";

    // Der reale Fall: eine echte KoError-Instanz aus dem Knowledge-Object-Modul. `instanceof Error`
    // plus `code`-Feld ist die Kombination, die tatsächlich an der Route ankommt.
    const echt = await probe(new KoError("SEARCH_PROJECTION_NOT_READY", meldung));
    // Der formgleiche Fall: ein blankes Objekt. Beide müssen dasselbe ergeben — die Maskierung
    // hängt am CODE, nicht an der Klasse.
    const formgleich = await probe({ code: "SEARCH_PROJECTION_NOT_READY", message: meldung });

    expect(echt.status).toBe(500);
    expect(formgleich.status).toBe(500);
    // `toEqual` und nicht `toMatchObject`: kein Zusatzfeld darf unbemerkt mitreisen.
    expect(JSON.parse(echt.payload)).toEqual(GENERISCHE_ANTWORT);
    expect(JSON.parse(formgleich.payload)).toEqual(GENERISCHE_ANTWORT);
    // Bytegleich, nicht nur inhaltsgleich.
    expect(echt.payload).toBe(formgleich.payload);
  });

  it("Pflicht 1b: maskierte und bestehende generische Antwort sind bytegleich", async () => {
    const maskiert = await probe(new KoError("SEARCH_PROJECTION_NOT_READY", "Zustand FAILED."));
    // Der Auffangzweig — der Weg jedes formlosen Fehlers seit jeher.
    const auffang = await probe(new Error("irgendetwas ging schief"));

    expect(maskiert.status).toBe(auffang.status);
    expect(maskiert.payload).toBe(auffang.payload);
    expect(JSON.parse(maskiert.payload)).toEqual(GENERISCHE_ANTWORT);
  });

  it("Pflicht 2: roher Payload trägt weder technischen Code noch Control-State", async () => {
    for (const meldung of ECHTE_MELDUNGEN) {
      const res = await probe(new KoError("SEARCH_PROJECTION_NOT_READY", meldung));
      expect(res.status).toBe(500);
      // Über den rohen Text, nicht über das geparste Objekt: auch eine Einbettung in ein beliebiges
      // Feld wäre ein Leck.
      for (const spur of VERBOTENE_SPUREN) {
        expect(res.payload).not.toContain(spur);
      }
      expect(res.payload).not.toContain(meldung);
      expect(JSON.parse(res.payload)).toEqual(GENERISCHE_ANTWORT);
    }
  });

  it("Pflicht 6: technischer Code steht intern im Log, request-zuordenbar, nicht im Body", async () => {
    const meldung = "Suchprojektion nicht freigegeben (Zustand UNINITIALIZED).";
    const res = await probe(new KoError("SEARCH_PROJECTION_NOT_READY", meldung));

    const maskierung = res.logzeilen.filter((z) => z.code === "SEARCH_PROJECTION_NOT_READY");
    // Genau eine Zeile pro Vorfall — nicht keine (unauffindbar) und nicht mehrere (Rauschen).
    expect(maskierung).toHaveLength(1);
    const zeile = maskierung[0]!;
    // Als eigenes Feld, damit Monitoring darauf filtern kann.
    expect(zeile.code).toBe("SEARCH_PROJECTION_NOT_READY");
    // Der Originalfehler bleibt intern vollständig erhalten.
    expect(zeile.err?.message).toBe(meldung);
    // Fehlerstufe, damit die Zeile nicht unter einem Info-Filter verschwindet.
    expect(zeile.level).toBe(50);
    // Die Request-ID ist die Zuordnung zum Vorgang — ohne sie ist der Logeintrag im Betrieb nicht
    // an die konkrete 500er-Antwort zu binden.
    expect(typeof zeile.reqId).toBe("string");
    expect(zeile.reqId).toBeTruthy();

    // Dieselbe Antwort trägt ihn NICHT. „Intern unterscheidbar, außen unsichtbar" ist damit eine
    // Zusicherung und nicht zwei getrennte Behauptungen.
    expect(res.status).toBe(500);
    expect(res.payload).not.toContain("SEARCH_PROJECTION_NOT_READY");
    expect(JSON.parse(res.payload)).toEqual(GENERISCHE_ANTWORT);
  });
});

describe("G27 R1 — isInternalOnlyError ist der gemeinsame Prädikatbaustein", () => {
  it("Pflicht 7: wahr nur für den einen internen Code", () => {
    expect(isInternalOnlyError(new KoError("SEARCH_PROJECTION_NOT_READY", "egal"))).toBe(true);
    expect(isInternalOnlyError({ code: "SEARCH_PROJECTION_NOT_READY" })).toBe(true);
    // Ohne Meldung ebenfalls wahr — das Prädikat hängt am Code, nicht an der Meldung.
    expect(isInternalOnlyError({ code: "SEARCH_PROJECTION_NOT_READY", message: undefined })).toBe(
      true,
    );
  });

  it("Pflicht 7: falsch für alle heutigen Domänen-, Infrastruktur- und formlosen Fehler", () => {
    // Jeder heutige Domänencode.
    for (const code of Object.keys(STATUS_ERWARTUNG)) {
      expect(isInternalOnlyError({ code, message: "x" })).toBe(false);
    }
    // Unbekannter Großbuchstabencode — kein Muster-, Präfix- oder Großbuchstabenschluss.
    expect(isInternalOnlyError({ code: "SOMETHING_ELSE" })).toBe(false);
    // Namensnachbarn: weder Teilstring noch Erweiterung darf greifen.
    expect(isInternalOnlyError({ code: "SEARCH_PROJECTION" })).toBe(false);
    expect(isInternalOnlyError({ code: "SEARCH_PROJECTION_NOT_READY_YET" })).toBe(false);
    expect(isInternalOnlyError({ code: "search_projection_not_ready" })).toBe(false);
    // Infrastruktur (SQLSTATE).
    expect(isInternalOnlyError({ code: "42P01" })).toBe(false);
    expect(isInternalOnlyError({ code: "42601" })).toBe(false);
    // Formlos.
    expect(isInternalOnlyError(new Error("x"))).toBe(false);
    expect(isInternalOnlyError(undefined)).toBe(false);
    expect(isInternalOnlyError(null)).toBe(false);
    expect(isInternalOnlyError("SEARCH_PROJECTION_NOT_READY")).toBe(false);
    expect(isInternalOnlyError(42)).toBe(false);
    expect(isInternalOnlyError({})).toBe(false);
  });
});

describe("G27 R1 — der heutige Fehlervertrag bleibt unberührt", () => {
  it("Pflicht 3: alle zwölf STATUS_BY_CODE-Einträge antworten unverändert", async () => {
    const eintraege = Object.entries(STATUS_ERWARTUNG);
    // Genau zwölf — kein Eintrag hinzugekommen, keiner verschwunden.
    expect(eintraege).toHaveLength(12);

    for (const [code, status] of eintraege) {
      const meldung = `Fachliche Meldung zu ${code}.`;
      const res = await probe({ code, message: meldung });
      expect(res.status).toBe(status);
      // Code UND Meldung gehen weiterhin nach außen — das ist der Fachvertrag, nicht das Leck.
      expect(JSON.parse(res.payload)).toEqual({ error: code, message: meldung });
    }
  });

  it("Pflicht 3b: CREATE_ROLLBACK_FAILED ist 500, wird aber nicht maskiert", async () => {
    const meldung = "Anlage und Rücknahme sind gescheitert (Objekt ko-42).";
    const res = await probe({ code: "CREATE_ROLLBACK_FAILED", message: meldung });

    // Der schärfste Fall der Abgrenzung: gleicher Statuscode wie die Maskierung, aber eigener Code
    // und eigene Meldung. Er belegt, dass die Maskierung am CODE hängt und nicht am Status.
    expect(res.status).toBe(500);
    expect(JSON.parse(res.payload)).toEqual({ error: "CREATE_ROLLBACK_FAILED", message: meldung });
    expect(res.payload).not.toBe(JSON.stringify(GENERISCHE_ANTWORT));
  });

  it("Pflicht 4: unbekannter Großbuchstabencode bleibt beim heutigen 400-Vertrag", async () => {
    const res = await probe({ code: "SOMETHING_ELSE", message: "Eingabe unbrauchbar." });
    expect(res.status).toBe(400);
    expect(JSON.parse(res.payload)).toEqual({
      error: "SOMETHING_ELSE",
      message: "Eingabe unbrauchbar.",
    });
  });

  it("Pflicht 4b: fehlende Meldung fällt weiterhin auf den Code zurück", async () => {
    const res = await probe({ code: "SOMETHING_ELSE" });
    expect(res.status).toBe(400);
    expect(JSON.parse(res.payload)).toEqual({ error: "SOMETHING_ELSE", message: "SOMETHING_ELSE" });
  });

  it("Pflicht 5: SQLSTATE 42P01/42601 bleiben generischer 500 ohne rohe DB-Meldung", async () => {
    // SCRUM-496 unverändert: Codes mit Ziffern erfüllen `/^[A-Z_]+$/` nicht und fallen in den
    // Auffangzweig. Die rohe Postgres-Meldung darf nie auf dem Board landen.
    const relation = await probe({ code: "42P01", message: 'relation "kos" does not exist' });
    expect(relation.status).toBe(500);
    expect(JSON.parse(relation.payload)).toEqual(GENERISCHE_ANTWORT);
    expect(relation.payload).not.toContain("42P01");
    expect(relation.payload).not.toContain("relation");

    const syntax = await probe({ code: "42601", message: "syntax error at or near SELECT" });
    expect(syntax.status).toBe(500);
    expect(JSON.parse(syntax.payload)).toEqual(GENERISCHE_ANTWORT);
    expect(syntax.payload).not.toContain("42601");
    expect(syntax.payload).not.toContain("syntax error");
  });

  it("Pflicht 5: formlose Fehler bleiben generischer 500", async () => {
    for (const fall of [new Error("Kaputt."), undefined, null, "Kaputt.", 42, {}]) {
      const res = await probe(fall);
      expect(res.status).toBe(500);
      expect(JSON.parse(res.payload)).toEqual(GENERISCHE_ANTWORT);
      expect(res.payload).not.toContain("Kaputt.");
    }
  });
});
