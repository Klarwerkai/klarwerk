// ================================================================================================
// W3-C (KW-W3-18) — DIE KANONISCHE ERKLAERROUTE. GENAU EINE.
// ================================================================================================
//
// `GET /api/klara/answers/{answerId}/explanation` ist der EINZIGE Weg zur Antwort-Erklaerung.
// KW-W3-18 nennt sie namentlich; eine zweite, konkurrierende Route waere ein zweiter Wahrheitsort
// ueber denselben Beleg — und der ist in dieser ganzen Welle das, was vermieden wird.
//
// DER HTTP-VERTRAG, ausgeschrieben, weil er sonst an drei Stellen anders ausgelegt wird:
//
//   200 + `state: "OK"`           berechtigt und lesbar. Der Rumpf traegt den historischen
//                                 Abschlussstatus UND den heutigen Integritaetszustand
//                                 (`VALID` / `DEGRADED` / `INVALIDATED` / `REDACTED`).
//   200 + `state: "NO_SNAPSHOT"`  die Antwort gibt es, ihren Beleg nicht. Ein 404 waere hier
//                                 falsch — es gibt sie ja.
//   404                           unbekannt ODER fremd. UNUNTERSCHEIDBAR, mit Absicht: waeren die
//                                 beiden Faelle trennbar, waere die blosse Kennung eine Auskunft
//                                 ueber fremden Bestand.
//
// WARUM RECHTEENTZUG HIER `REDACTED` IST UND NICHT 403 (KW-W3-18 laesst beides zu, der Auftrag
// verlangt eine FESTGELEGTE Wahl): Der Fragende darf SEINE Antwort sehen — nur einzelne Belege
// darin sind ihm heute gesperrt. Ein 403 auf die ganze Erklaerung wuerde ihm auch das vorenthalten,
// was er sehen darf, und er erfuehre nicht einmal, DASS es Belege gibt. `REDACTED` sagt beides
// ehrlich: die Zahl der Belege steht, ihre Inhalte sind geschwaerzt.
import type { FastifyPluginAsync } from "fastify";
import type { Guards } from "../http";
import type {
  AnswerExplanationLeser,
  AnswerExplanationService,
} from "../services/answer-explanation";

export interface KlaraAnswerExplanationDeps {
  readonly explanations: AnswerExplanationService;
}

export function klaraAnswerExplanationRoutes(
  deps: KlaraAnswerExplanationDeps,
  guards: Guards,
): FastifyPluginAsync {
  return async (app) => {
    app.get<{ Params: { answerId: string } }>(
      "/api/klara/answers/:answerId/explanation",
      async (request, reply) => {
        // `ko.read` ist die Schutzstufe: die Erklaerung zeigt Kennungen und Fassungen von
        // Wissensobjekten. Wer den Bestand nicht lesen darf, darf auch seine Belege nicht lesen.
        const user = await guards.requirePermission("ko.read", request, reply);
        if (!user) {
          return;
        }
        // Die Vertraulichkeitsstufe wird an EINER Stelle ausgelegt — hier, aus der Rolle. Der
        // Dienst wendet sie an, statt sie ein zweites Mal zu bilden.
        const leser: AnswerExplanationLeser = {
          userId: user.id,
          darfVertraulich: user.role === "admin" || user.role === "controller",
        };
        const ergebnis = await deps.explanations.erklaere(request.params.answerId, leser);
        if (ergebnis.kind === "NOT_FOUND") {
          // KEINE Unterscheidung zwischen „gibt es nicht" und „gehoert jemand anderem".
          reply.code(404).send({ error: "NOT_FOUND", message: "Antwort nicht gefunden." });
          return;
        }
        if (ergebnis.kind === "NO_SNAPSHOT") {
          reply.code(200).send({
            state: "NO_SNAPSHOT",
            answerId: ergebnis.answerId,
            createdAt: ergebnis.createdAt,
          });
          return;
        }
        reply.code(200).send({ state: "OK", ...ergebnis.view });
      },
    );
  };
}
