// ================================================================================================
// JOB 3568 · Q9-FREMDE-FLÄCHEN — DIE GENERISCHE INTERNE ANTWORT SPRICHT DIE SPRACHE DES NUTZERS,
// OHNE IHRE MASKIERUNG ZU VERLIEREN.
// ================================================================================================
//
// `sendError` (`services/app/src/http.ts`) ist der Standardausgang von rund 60 Aufrufstellen in 15
// Routendateien. Zwei seiner Zweige senden dieselbe generische 500er-Antwort:
//   · der MASKIERUNGSZWEIG (`:129`) für rein interne Betriebsfehler (G27, `SEARCH_PROJECTION_NOT_READY`),
//   · der AUFFANGZWEIG (`:142`) für alles Formlose.
//
// Bis hierher war das EIN gemeinsames Literal, und genau darin lag die Zusicherung von G27: beide
// Zweige senden BYTEGLEICH dasselbe, sonst wäre der maskierte Fall von außen wieder unterscheidbar
// — „dieser Fehler ist der Projektionsfehler" ist als Orakel nur eine leisere Form desselben Lecks.
//
// Diese Runde löst den Text pro Antwort aus dem Katalog auf, statt eine Konstante zu senden. Die
// Gestalt-Gleichheit ist damit nicht mehr durch dieselbe Objektidentität garantiert, sondern nur
// noch durch gleiche Eingaben — und muss deshalb GEPRÜFT werden. R4 unten ist genau dieser Wächter,
// und er ist heute schon grün: er darf es bleiben.
import Fastify, { type FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";
import { sendError } from "../../services/app/src/http";

/** Control-State-Wörter und der technische Code, die in KEINER Sprache nach außen dürfen (G27 §4). */
const VERBOTENE_SPUREN = [
  "SEARCH_PROJECTION_NOT_READY",
  "UNINITIALIZED",
  "V2_BUILDING",
  "V2_READY",
  "FAILED",
];

let app: FastifyInstance | undefined;

async function probe(
  error: unknown,
  sprache?: string,
): Promise<{ status: number; roh: string; koerper: unknown }> {
  // Logger AUS: der Maskierungszweig schreibt über `reply.log.error`, und diese Datei prüft die
  // Antwort, nicht das Log (das deckt `services/app/src/http.test.ts` mit echtem Pino ab).
  const instanz = Fastify({ logger: false });
  app = instanz;
  instanz.get("/probe", async (_request, reply) => {
    sendError(reply, error);
  });
  const antwort = await instanz.inject({
    method: "GET",
    url: "/probe",
    ...(sprache ? { headers: { "accept-language": sprache } } : {}),
  });
  return { status: antwort.statusCode, roh: antwort.payload, koerper: antwort.json() };
}

/** Der Auffangzweig: ein Fehler ohne `code`. */
const OHNE_CODE = new Error("interne Diagnose, die niemand draußen sehen darf");
/** Der Maskierungszweig: der eine rein interne Betriebsfehlercode. */
const MASKIERT = {
  code: "SEARCH_PROJECTION_NOT_READY",
  message: "Suchprojektion nicht freigegeben (Zustand V2_BUILDING).",
};

afterEach(async () => {
  await app?.close();
  app = undefined;
});

describe("R3 · die generische interne Antwort kommt in der gewählten Sprache", () => {
  it.each([
    ["en", "An unexpected error occurred."],
    ["nl", "Er is een onverwachte fout opgetreden."],
  ] as const)("Auffangzweig %s", async (sprache, volltext) => {
    const res = await probe(OHNE_CODE, sprache);
    expect(res.status).toBe(500);
    expect(res.koerper).toEqual({ error: "INTERNAL", message: volltext });
    expect(res.roh).not.toMatch(/angemeldet|Fehler|Berechtigung/);
  });

  it.each([
    ["en", "An unexpected error occurred."],
    ["nl", "Er is een onverwachte fout opgetreden."],
  ] as const)("Maskierungszweig %s", async (sprache, volltext) => {
    const res = await probe(MASKIERT, sprache);
    expect(res.status).toBe(500);
    expect(res.koerper).toEqual({ error: "INTERNAL", message: volltext });
  });

  // LIEFERUNG 6 — BESTANDSSCHUTZ DEUTSCH: ohne Kopf und mit `de` steht wörtlich der heutige Satz da.
  it.each([undefined, "de", "fr"])("Rückfall DE bei %s in beiden Zweigen", async (sprache) => {
    for (const fehler of [OHNE_CODE, MASKIERT]) {
      const res = await probe(fehler, sprache);
      expect(res.status).toBe(500);
      expect(res.koerper).toEqual({ error: "INTERNAL", message: "Unerwarteter Fehler." });
    }
  });
});

describe("R4 · Bestandsschutz G27 — die Maskierung bleibt in jeder Sprache ununterscheidbar", () => {
  it.each([undefined, "de", "en", "nl"])(
    "%s: Maskierungs- und Auffangzweig senden bytegleich dieselbe Antwort",
    async (sprache) => {
      const maskiert = await probe(MASKIERT, sprache);
      const auffang = await probe(OHNE_CODE, sprache);
      expect(maskiert.status).toBe(auffang.status);
      // Bytegleich, nicht nur inhaltsgleich: ein zusätzliches Feld oder eine andere
      // Schlüsselreihenfolge wäre bereits ein Orakel.
      expect(maskiert.roh).toBe(auffang.roh);
    },
  );

  it.each(["de", "en", "nl"])(
    "%s: kein Control-State und kein technischer Code im Körper",
    async (sprache) => {
      const res = await probe(MASKIERT, sprache);
      expect(res.status).toBe(500);
      for (const spur of VERBOTENE_SPUREN) {
        expect(res.roh, spur).not.toContain(spur);
      }
      expect(res.roh).not.toContain(MASKIERT.message);
    },
  );

  it.each(["de", "en", "nl"])(
    "%s: die interne Diagnose des Auffangzweigs bleibt drinnen",
    async (sprache) => {
      const res = await probe(OHNE_CODE, sprache);
      expect(res.status).toBe(500);
      expect(res.roh).not.toContain("interne Diagnose");
    },
  );

  // Der Domänenzweig (`:136-139`) ist von dieser Runde ausdrücklich NICHT berührt: er reicht die
  // Meldung des Fachfehlers durch, die aus dem jeweiligen Dienstmodul kommt und keinen
  // Katalogschlüssel trägt. Hier festgehalten, damit eine spätere Hand sieht, dass das kein
  // Versehen ist — und damit eine Verschiebung dieses Zweigs auffiele.
  it("der Domänenzweig reicht seine Meldung unverändert durch, in jeder Sprache gleich", async () => {
    for (const sprache of [undefined, "en", "nl"]) {
      const res = await probe(
        { code: "NOT_FOUND", message: "Wissensobjekt nicht gefunden." },
        sprache,
      );
      expect(res.status, String(sprache)).toBe(404);
      expect(res.koerper).toEqual({ error: "NOT_FOUND", message: "Wissensobjekt nicht gefunden." });
    }
  });
});
