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
//                                 `REDACTED` entsteht in `gelesenerZustand` weiter unten — bis
//                                 JOB 541 D6 nannte dieser Vertrag den Wert, ohne dass ihn je
//                                 eine Antwort trug.
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
import type { AnswerExplanationView, AnswerIntegrityState } from "../../../ask";
import type { Guards } from "../http";
import type {
  AnswerExplanationLeser,
  AnswerExplanationService,
} from "../services/answer-explanation";

export interface KlaraAnswerExplanationDeps {
  readonly explanations: AnswerExplanationService;
}

/**
 * ================================================================================================
 * JOB 541 D6 — DIE REDAKTION BEKOMMT IHREN NAMEN. SELEKTIV, UND NUR HIER.
 * ================================================================================================
 *
 * DER BEFUND, der diese Funktion noetig macht (JOB 541 D5, gemessen): Die Schwaerzung WIRKT
 * bereits — `AnswerExplanationService` sammelt die gesperrten Objekte und `baueAnswerExplanation`
 * leert deren Zeilen. Nur der Zustand blieb unbenannt: die Sperre geht als `gesperrteObjekte` in
 * die SICHT ein, nicht als `gesperrt` in die INTEGRITAETSLEITER. Der Rumpf meldete deshalb
 * `DEGRADED`, obwohl er geschwaerzte Zeilen trug — der Vertrag oben nennt `REDACTED`, das
 * Verhalten kannte ihn nicht.
 *
 * WARUM DIE ABLEITUNG AN DEN GESCHWAERZTEN ZEILEN HAENGT UND NICHT AN EINEM ZWEITEN FLAG: Die
 * Entscheidung, WER was nicht sehen darf, faellt weiterhin an genau einer Stelle — im Dienst,
 * beim Bilden von `gesperrteObjekte`. Diese Funktion trifft keine Rechteentscheidung; sie liest
 * das bereits gefaellte Ergebnis ab. Ein eigenes Flag waere ein zweiter Wahrheitsort, und genau
 * den vermeidet diese ganze Welle.
 *
 * WARUM `INVALIDATED` UNANGETASTET BLEIBT: „Manipulation schlaegt Redaktion" — ein unbelastbarer
 * Beleg darf nie als „da war etwas, Sie duerfen es nur nicht sehen" erscheinen.
 *
 * DIE ERSTE ZEILE IST HEUTE REDUNDANT, UND DAS IST GEMESSEN, NICHT VERMUTET: Entfernt man sie,
 * bleiben alle fuenf Zustandsfaelle gruen (JOB 541 D6, Gegenprobe GM2). Tragend ist der bauliche
 * Grund — `baueAnswerExplanation` gibt bei `INVALIDATED` gar keine Zeilen mehr heraus, es gibt
 * dort also keine geschwaerzte Zeile, an der diese Ableitung greifen koennte.
 *
 * Sie bleibt trotzdem stehen, und zwar als ausgesprochene Absicht: Wer diese Funktion spaeter
 * liest, soll die Rangfolge hier sehen und sie nicht aus dem Verhalten einer anderen Datei
 * erschliessen muessen. Gibt `baueAnswerExplanation` eines Tages auch bei `INVALIDATED` Zeilen
 * heraus, ist sie sofort tragend — ohne dass jemand daran denken muss.
 *
 * WAS SIE AUSDRUECKLICH NICHT TUT: `VALID`, `DEGRADED`, `INVALIDATED` und `NO_SNAPSHOT` umwerten.
 * Ohne geschwaerzte Zeile gibt sie den Zustand unveraendert zurueck; `NO_SNAPSHOT` erreicht sie
 * nie, weil dieser Zweig frueher antwortet.
 */
function gelesenerZustand(view: AnswerExplanationView): AnswerIntegrityState {
  if (view.integrity === "INVALIDATED") {
    return view.integrity;
  }
  return view.evidence.some((zeile) => zeile.redacted) ? "REDACTED" : view.integrity;
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
        // JOB 541 D6: Der Zustand wird hier BENANNT, nicht neu entschieden — `gelesenerZustand`
        // liest ab, was der Dienst bereits geschwaerzt hat. Alle uebrigen Felder der Sicht gehen
        // unveraendert hinaus.
        reply
          .code(200)
          .send({ state: "OK", ...ergebnis.view, integrity: gelesenerZustand(ergebnis.view) });
      },
    );
  };
}
