import type { FastifyPluginAsync, FastifyReply } from "fastify";
import type { KoService } from "../../../knowledge-object";
import {
  type Formulierer,
  type Ka6Einwilligungspruefer,
  ZURUF_ARTEN,
  type ZurufArt,
  type ZurufAuftrag,
  ZurufError,
  type ZurufFehlerCode,
  ZurufService,
  type ZurufVorschlag,
} from "../../../output";
import type { Guards } from "../http";
import { sendError } from "../http";

// ================================================================================================
// JOB 3091 · M2 — DER ZURUF AUS DEM WORD-PANEL: `POST /api/klara/sessions/{sessionId}/zuruf`
// ================================================================================================
//
// WAS DIESE DATEI IST: eine Serialisierungsschicht, wie `klara-ai-routes.ts`. Sie prüft die
// Berechtigung, liest die Bindung aus den Headern, reicht Auftragstext und Quellen an den Erzeuger
// (`ZurufService`, `services/output/src/zuruf.ts`) und bildet dessen Vorschlag auf den Draht ab.
// Sie entscheidet NICHTS über Einwilligung, Anbieter oder Modell — das tut der Erzeuger, indem er
// das Sitzungstor (`KlaraSessionService.pruefeExterneAusfuehrung`) FRAGT (JOB 3026).
//
// WARUM ES DIESE ROUTE BIS HEUTE NICHT GAB: `KLARA_EXTERNAL_EXECUTION_MIGRATED` stand auf `false`,
// und das Tor konnte gar kein `erlaubt: true` liefern — eine Route wäre eine Scheinfunktion gewesen
// (archiv/3026 §2). JOB 3079 (V2) hat den Schalter umgelegt; dieser Auftrag baut darauf auf.
//
// DIE DREI ZUSAGEN, die hier auf dem Draht sichtbar werden:
//   1. OHNE ZUSTIMMUNG KEIN ENTWURF. `CONSENT_MISSING` wird 403 mit dem festen Satz des Erzeugers;
//      die Antwort trägt kein `entwurf`-Feld, nicht einmal ein leeres.
//   2. DER SERVER SCHREIBT NICHTS. Die Antwort ist Text plus Herkunft; ob und wo er ins Dokument
//      kommt, entscheidet der Mensch am Panel mit einem zweiten Klick (taskpane.html, KW-KA6-MEMO).
//   3. HERKUNFT REIST MIT: je Quelle `koId`, `titel`, `stufe` (Prüfstand) und `version`, dazu
//      `anbieter`/`modell` aus der Auflösung, gegen die das Tor die Einwilligung geprüft hat.
//
// BERECHTIGUNG: `ko.read`, wie alle Klara-Endpunkte (`klara-ai-routes.ts:25-29`). Die feinere
// Bindung an Actor, Instanz und Dokument leistet das Sitzungstor.

/**
 * Die zwei Bindungs-Header — WÖRTLICH dieselben wie in `klara-ai-routes.ts:41-42`. Sie sind dort
 * nicht exportiert (die Datei liegt ausserhalb dieses Auftrags); dass beide Dateien dieselben Namen
 * führen, pinnt `tests/ka6-memo-panel/memo-route.test.ts` am Quelltext, damit keine zweite
 * Wahrheit entsteht. Die Sitzung selbst kommt aus dem Pfad (`:sessionId`), wie bei `/consent`;
 * der Header `x-klara-session` wird hier deshalb nicht gelesen.
 */
const INSTANCE_HEADER = "x-klara-instance";
const DOCUMENT_HEADER = "x-klara-document";

/** Obergrenze der Quellen je Zuruf — ein Memo stützt sich auf wenige, benannte Quellen. */
export const ZURUF_MAX_QUELLEN = 10;

/** Antwortlänge des Formulierers. Ein Memo ist kurz; eine Obergrenze verhindert Ausufern. */
const ZURUF_MAX_TOKENS = 800;

/**
 * Das Modell, das formuliert — strukturgleich zu `ModelClient.complete` (`services/reasoner`),
 * ABSICHTLICH nicht von dort importiert: diese Datei braucht nur den einen Aufruf, und der
 * Cloud-Client kommt gecappt aus der Kompositionswurzel (`createCappedCloudClientFromEnv`,
 * `build-app.ts`), mit Egress-Wächter `rejectsConfidential`. Vertrauliches ist an dieser Stelle
 * bereits abgestreift (`dropConfidential` im Erzeuger); der Aufruf deklariert `confidential: false`.
 */
export interface ZurufModell {
  complete(
    system: string,
    user: string,
    confidential: boolean,
    maxTokens?: number,
  ): Promise<string>;
}

export interface KlaraZurufRouteDeps {
  /**
   * Das Sitzungstor als PORT (`Ka6Einwilligungspruefer`): in Produktion der `KlaraSessionService`
   * aus `build-app.ts`. Die Route reicht ihn nur an den Erzeuger weiter — sie fragt ihn nie selbst.
   */
  readonly sessions: Ka6Einwilligungspruefer;
  readonly ko: KoService;
  /** Fehlt es, antwortet die Route ehrlich 503 `NO_FORMULIERER` — nie mit erfundenem Text. */
  readonly modell?: ZurufModell | undefined;
}

/** Eine Herkunftszeile des Entwurfs — genau die vier Felder, die das Panel zeigt und einfügt. */
export interface ZurufHerkunft {
  readonly koId: string;
  readonly titel: string;
  /** Der Prüfstand der Quelle — im Erzeuger immer `validiert`, hier trotzdem gelesen, nie gesetzt. */
  readonly stufe: string;
  readonly version: number;
}

/** Der Drahtvertrag von `POST /api/klara/sessions/{id}/zuruf` bei 200. */
export interface ZurufAntwort {
  readonly art: ZurufArt;
  readonly entwurf: string;
  readonly herkunft: readonly ZurufHerkunft[];
  readonly anbieter: string | null;
  readonly modell: string | null;
  /** Immer `true`: ein Zuruf IST eine Formulierung (dieselbe Marke wie im Erzeuger). */
  readonly aiGenerated: true;
  readonly generatedAt: string;
}

/**
 * Der Formulierer über einem Modell. Er baut aus dem `ZurufAuftrag` GENAU EINEN Aufruf.
 *
 * DIE AUFLAGE STEHT IM SYSTEMTEXT, nicht in der Hoffnung: nur aus den Belegen formulieren, nichts
 * ergänzen, und wenn die Belege nicht reichen, LEER antworten — der Erzeuger macht daraus
 * `NO_BASIS` („Erfunden wird nichts"). Ohne Belege gibt es nichts, worauf ein Memo stehen könnte;
 * dann wird das Modell gar nicht gerufen. Ob ein Modell die Auflage einhält, kann kein Test
 * beweisen — das ist die benannte Prüflücke dieses Wegs; der Herkunftsblock am Panel macht sie für
 * den Menschen prüfbar, weil jede Quelle daneben steht.
 */
export function formuliererAusModell(modell: ZurufModell): Formulierer {
  return {
    async formuliere(auftrag: ZurufAuftrag): Promise<string> {
      if (auftrag.belege.length === 0) {
        return "";
      }
      const system = [
        "Du formulierst für KLARWERK einen kurzen Text ausschließlich aus den mitgegebenen Belegen.",
        "Jede Sachaussage muss sich auf einen Beleg stützen. Erfinde nichts, ergänze kein Weltwissen,",
        "keine Zahlen, Namen oder Fristen, die nicht in den Belegen stehen.",
        "Reichen die Belege für den Auftrag nicht aus, antworte mit einer leeren Zeile und sonst nichts.",
        "Schreibe in der Sprache des Auftrags. Gib nur den Text zurück — ohne Anrede, Betreff,",
        "Überschrift oder Quellenangaben; die Herkunft fügt das System selbst an.",
      ].join(" ");
      const belege = auftrag.belege.map((b, i) => `[${i + 1}] ${b.title}\n${b.text}`).join("\n\n");
      const user = `Auftrag (${auftrag.art}): ${auftrag.text}\n\nBelege:\n${belege}`;
      return modell.complete(system, user, false, ZURUF_MAX_TOKENS);
    },
  };
}

function kopf(request: { headers: Record<string, unknown> }, name: string): string {
  const wert = request.headers[name];
  return typeof wert === "string" ? wert.trim() : "";
}

/**
 * Die HTTP-Form je Fehlercode des Erzeugers. `sendError` kennt diese Codes nicht (sie sind keine
 * `KlaraError`-Codes) und würde alle auf 400 legen — damit wäre „keine Einwilligung" von „kein
 * Text" nicht zu unterscheiden, und das Panel könnte den Zustimmungsweg nicht zeigen.
 */
const STATUS_JE_ZURUF_FEHLER: Record<ZurufFehlerCode, number> = {
  CONSENT_MISSING: 403,
  NO_INPUT: 400,
  UNKNOWN_ART: 400,
  NO_FORMULIERER: 503,
  NO_BASIS: 422,
};

function fehler(reply: FastifyReply, error: unknown): void {
  if (error instanceof ZurufError) {
    // Der Grund ist der feste Satz des Erzeugers — kein Tor-Grund, keine Kennung (JOB 3026 §5).
    reply
      .code(STATUS_JE_ZURUF_FEHLER[error.code] ?? 400)
      .send({ error: error.code, message: error.message });
    return;
  }
  sendError(reply, error);
}

function herkunftAus(vorschlag: ZurufVorschlag): ZurufHerkunft[] {
  return vorschlag.provenance.map((p) => ({
    koId: p.koId,
    titel: p.title,
    stufe: p.status,
    version: p.version,
  }));
}

function quellenAus(roh: unknown): string[] | null {
  if (!Array.isArray(roh)) {
    return null;
  }
  const ids = roh
    .filter((v): v is string => typeof v === "string")
    .map((v) => v.trim())
    .filter((v) => v.length > 0);
  if (ids.length === 0 || ids.length !== roh.length || ids.length > ZURUF_MAX_QUELLEN) {
    return null;
  }
  return [...new Set(ids)];
}

function artAus(roh: unknown): ZurufArt | null {
  if (roh === undefined) {
    return "erstellen";
  }
  return typeof roh === "string" && (ZURUF_ARTEN as readonly string[]).includes(roh)
    ? (roh as ZurufArt)
    : null;
}

export function klaraZurufRoutes(deps: KlaraZurufRouteDeps, guards: Guards): FastifyPluginAsync {
  // EIN Erzeuger je Registrierung. Das Tor ist der injizierte Sitzungsdienst; ein Formulierer nur,
  // wenn ein Modell verdrahtet ist — sonst antwortet der Erzeuger `NO_FORMULIERER`, ehrlich.
  const zuruf = new ZurufService({
    koService: deps.ko,
    einwilligungspruefer: deps.sessions,
    ...(deps.modell ? { formulierer: formuliererAusModell(deps.modell) } : {}),
  });

  return async (app) => {
    app.post<{
      Params: { sessionId: string };
      Body: { text?: unknown; koIds?: unknown; art?: unknown } | null;
    }>("/api/klara/sessions/:sessionId/zuruf", async (request, reply) => {
      const user = await guards.requirePermission("ko.read", request, reply);
      if (!user) {
        return;
      }
      try {
        const body = request.body ?? {};
        const art = artAus(body.art);
        if (art === null) {
          throw new ZurufError("UNKNOWN_ART", `Unbekannter Zuruf: ${String(body.art)}.`);
        }
        const text = typeof body.text === "string" ? body.text.trim() : "";
        if (text.length === 0) {
          throw new ZurufError("NO_INPUT", "Kein Auftragstext — es gibt nichts zu formulieren.");
        }
        const koIds = quellenAus(body.koIds);
        if (koIds === null) {
          // Ein Memo AUS EINER QUELLE braucht mindestens eine benannte Quelle. Ohne sie gäbe es
          // nur freie Formulierung — und die ist nicht, was dieser Weg verspricht.
          throw new ZurufError(
            "NO_INPUT",
            `koIds: mindestens eine und höchstens ${ZURUF_MAX_QUELLEN} Quellenkennungen sind erforderlich.`,
          );
        }
        const vorschlag = await zuruf.schlageVor({
          art,
          text,
          koIds,
          bindung: {
            // Die Sitzung aus dem Pfad; der Header derselben Kennung ist Korrelation, nicht Quelle.
            sessionId: request.params.sessionId,
            actorId: user.id,
            addinInstanceId: kopf(request, INSTANCE_HEADER),
            documentContextId: kopf(request, DOCUMENT_HEADER),
          },
        });
        const antwort: ZurufAntwort = {
          art: vorschlag.art,
          entwurf: vorschlag.vorschlag,
          herkunft: herkunftAus(vorschlag),
          anbieter: vorschlag.anbieter,
          modell: vorschlag.modell,
          aiGenerated: true,
          generatedAt: vorschlag.generatedAt,
        };
        reply.code(200).send(antwort);
      } catch (error) {
        fehler(reply, error);
      }
    });
  };
}
