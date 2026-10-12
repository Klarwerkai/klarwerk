// ================================================================================================
// R-0570 · DIE ANONYME VORFÜHRUNG: LESEN UND FRAGEN OHNE ANMELDUNG — NUR AN ERFUNDENEM INHALT.
// ================================================================================================
//
// Entscheidung zu Frage 14 (Peter, 11.10.2026): „Firmenwissen authentifiziert; anonyme Demo nur
// öffentlich/fiktiv." Der Originalpunkt R-0570 („Wissen ohne Anmeldung lesen oder Fragen stellen")
// war in der Registerquelle als VERWORFEN geführt (kein öffentlicher Zugang). Beides gilt jetzt
// zusammen und ohne Widerspruch:
//
//   · UNTERNEHMENSWISSEN bleibt hinter der Anmeldung. Diese Datei berührt es nicht: sie importiert
//     weder den Wissensspeicher noch die Suche noch den Frageweg (`/api/ask`). Was sie ausliefert,
//     steht vollständig und unveränderlich in `../vorfuehrung/inhalte.ts`.
//   · DIE VORFÜHRUNG ist ohne Anmeldung lesbar und befragbar — erfundene Beispielinhalte, jede
//     Antwort mit `fiktiv: true` und der Kennzeichnung in der Sprache der Anfrage.
//
// BEIDE WEGE SIND `GET`. Sie verändern nichts, legen nichts an und rufen kein Modell; eine Frage ist
// hier eine Suche im festen Bestand. Damit bleibt die Zusage des Routen-Audits unberührt, dass keine
// schreibende Route öffentlich ist (`tests/security/route-guard-audit.test.ts`).
//
// VORGABE AUS (`KLARWERK_VORFUEHRUNG_ANONYM`, `feature-flags.ts`). Ob eine Installation die
// Vorführung zeigt, ist eine Betriebsentscheidung; ohne sie antworten beide Wege 404 und liefern
// nichts. Die Wege sind trotzdem immer registriert, damit das Routen-Inventar nicht vom Schalter
// abhängt — der Schalter entscheidet über den Inhalt, nicht über die Tür.
import type { FastifyPluginAsync } from "fastify";
import { sprache } from "../../../auth";
import { schalterAn } from "../feature-flags";
import { INHALTE, KENNZEICHNUNG, beantworte } from "../vorfuehrung/inhalte";

/** Der Fehlercode, solange die Vorführung in dieser Installation nicht eingeschaltet ist. */
export const VORFUEHRUNG_AUS = "VORFUEHRUNG_AUS";

interface FrageAnfrage {
  Querystring: { q?: unknown };
}

export function vorfuehrungRoutes(): FastifyPluginAsync {
  return async (app) => {
    app.get("/api/vorfuehrung", async (request, reply) => {
      if (!schalterAn("vorfuehrung")) {
        reply.code(404).send({ error: VORFUEHRUNG_AUS });
        return;
      }
      const l = sprache(request);
      const antwort = { fiktiv: true, kennzeichnung: KENNZEICHNUNG[l], eintraege: INHALTE[l] };
      reply.code(200).send(antwort);
    });

    app.get<FrageAnfrage>("/api/vorfuehrung/frage", async (request, reply) => {
      if (!schalterAn("vorfuehrung")) {
        reply.code(404).send({ error: VORFUEHRUNG_AUS });
        return;
      }
      const l = sprache(request);
      // Eine fehlende oder fremdartige Frage ist keine Formkritik wert: sie hat schlicht keine
      // Treffer. Die Länge begrenzt `beantworte` selbst.
      const frage = typeof request.query.q === "string" ? request.query.q : "";
      const { treffer } = beantworte(frage, l);
      const antwort = { fiktiv: true, kennzeichnung: KENNZEICHNUNG[l], treffer };
      reply.code(200).send(antwort);
    });
  };
}
