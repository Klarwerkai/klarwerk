// ================================================================================================
// JOB 3326 · LESEVARIANTE — DIE DREI ROUTEN (JOB 3363: die vierte).
// ================================================================================================
//
//   GET  /api/kos/:id/lesevariante/:lang   die VOLLE Variante EINES Objekts (Detailansicht)
//   GET  /api/lesevarianten?lang=de        die KURZE Übersicht (Titel/Kernaussage) für Listen
//   POST /api/admin/lesevarianten/laden    die Admin-Aktion „Übersetzungen für Paket laden"
//   GET  /api/library/import/candidates/:id/lesevariante/:lang   (JOB 3363) die LIVE aufgelöste
//        Variante eines noch NICHT angenommenen Kandidaten der Prüfkarte
//
// WARUM DIE ÜBERSICHT SCHMAL IST: Die Bibliotheksliste und die Prüfkarten brauchen Titel und
// Kernaussage, nicht den Fließtext. Läge der Text mit in der Übersicht, wüchse eine Listenantwort
// mit jedem übersetzten Objekt um einen ganzen Artikel — für eine Anzeige, die ihn gar nicht zeigt.
//
// WARUM DIE SICHTBARKEIT HIER GENAUSO GILT WIE AM WISSENSOBJEKT: Eine Lesevariante trägt Titel und
// Inhalt des Objekts, nur in einer anderen Sprache. Wäre sie leichter zu bekommen als das Original,
// wäre sie der Umweg um die Sichtbarkeitsregel. Beide Leserouten laufen deshalb über DIESELBE
// Entscheidung (`sichtbareFuer`/`darfSehen`, services/app/src/sichtbarkeit.ts) wie `GET /api/kos`
// und `GET /api/kos/:id` — es entsteht keine zweite Auslegung.
//
// WAS DIESE ROUTEN NICHT TUN: Sie ändern kein Wissensobjekt, legen keines an, und die Variante ist
// niemals Freigabegegenstand. Der Ladeweg ruft KEIN Modell (die Übersetzungen liegen als Datei im
// Auslieferungsstand) und erzeugt damit auch keine laufenden Kosten.
import type { FastifyPluginAsync } from "fastify";
import type { AuditService } from "../../../audit";
import type { KnowledgeObject, KoService } from "../../../knowledge-object";
import type { ImportCandidate } from "../../../library-analytics";
import type { Guards } from "../http";
import {
  type LesevariantenRepo,
  kandidatenLesevariante,
  ladeLesevarianten,
  lokalisierungsPaket,
  mitAenderungsauskunft,
} from "../lesevarianten";
import { darfSehen, sichtbareFuer, sqlSichtbarkeitFuer } from "../sichtbarkeit";

/**
 * JOB 3363: der Zugang zum Kandidatenbestand, so schmal wie die Frage — EIN Kandidat zu EINER
 * Kennung. Es ist derselbe Bestand, den die Warteschlange liest (die Kompositionswurzel reicht
 * dieselbe Ablage-Instanz durch, s. `build-app.ts`); ein zweiter wäre ein zweiter Wahrheitsort
 * über denselben Kandidaten. Bewusst NICHT der ganze `CandidateRepo`: diese Routen dürfen an
 * Kandidaten nichts schreiben, und was sie nicht bekommen, können sie nicht aufrufen.
 */
export interface KandidatenZugriff {
  findById(id: string): Promise<ImportCandidate | undefined>;
}

export interface LesevariantenRoutesDeps {
  ko: KoService;
  lesevarianten: LesevariantenRepo;
  /** JOB 3363: der Kandidatenbestand der Prüfkarte — nur lesend, nur `findById`. */
  kandidaten: KandidatenZugriff;
  audit?: AuditService;
}

interface LadeBody {
  package?: unknown;
}

export function lesevariantenRoutes(
  deps: LesevariantenRoutesDeps,
  guards: Guards,
): FastifyPluginAsync {
  const { ko, lesevarianten, kandidaten } = deps;
  return async (app) => {
    app.get<{ Params: { id: string; lang: string } }>(
      "/api/kos/:id/lesevariante/:lang",
      async (request, reply) => {
        const user = await guards.requirePermission("ko.read", request, reply);
        if (!user) {
          return;
        }
        const item = await ko.get(request.params.id);
        // Ein unsichtbares Objekt ist ein 404 — auch hier. Eine Antwort „Variante nicht vorhanden"
        // wäre bereits eine Existenzauskunft über das Objekt.
        if (!item || !darfSehen(user, item)) {
          reply.code(404).send({ error: "NOT_FOUND", message: "Wissensobjekt nicht gefunden." });
          return;
        }
        const variante = await lesevarianten.get(item.id, request.params.lang);
        if (!variante) {
          reply.code(404).send({
            error: "NO_LESEVARIANTE",
            message: "Für dieses Objekt gibt es keine Lesevariante in dieser Sprache.",
          });
          return;
        }
        reply.code(200).send(mitAenderungsauskunft(variante, item));
      },
    );

    app.get<{ Querystring: { lang?: string } }>("/api/lesevarianten", async (request, reply) => {
      const user = await guards.requirePermission("ko.read", request, reply);
      if (!user) {
        return;
      }
      const lang = String(request.query.lang ?? "").trim();
      if (!lang) {
        reply.code(400).send({ error: "MISSING_LANG", message: "Sprache fehlt." });
        return;
      }
      const sichtbare = sichtbareFuer(user, await ko.list({}, sqlSichtbarkeitFuer(user)));
      const jeId = new Map<string, KnowledgeObject>(sichtbare.map((k) => [k.id, k]));
      const eintraege = (await lesevarianten.inSprache(lang))
        .map((variante) => {
          const objekt = jeId.get(variante.koId);
          if (!objekt) {
            return undefined;
          }
          const sicht = mitAenderungsauskunft(variante, objekt);
          // Bewusst OHNE `bodyHtml`: die Übersicht trägt genau das, was Listen und Prüfkarten
          // zeigen. Wer den Text braucht, holt ihn über die Route darüber.
          return {
            koId: sicht.koId,
            lang: sicht.lang,
            originalLanguage: sicht.originalLanguage,
            title: sicht.title,
            statement: sicht.statement,
            herkunft: sicht.herkunft,
            status: sicht.status,
            originalGeaendert: sicht.originalGeaendert,
            // Der fehlende Beleg reist MIT in die Liste: eine Kennzeichnung, die nur in der
            // Detailansicht steht, fehlt genau dort, wo man sie zuerst braucht.
            quellabgleich: sicht.quellabgleich,
            updatedAt: sicht.updatedAt,
          };
        })
        .filter((e): e is NonNullable<typeof e> => e !== undefined);
      reply.code(200).send({ lang, eintraege });
    });

    // ============================================================================================
    // JOB 3363 — DIE PRÜFKARTE FRAGT ÜBER DEN ECHTEN KANDIDATEN, NICHT ÜBER DIE LIEFERUNG.
    // ============================================================================================
    //
    // EINGABE IST EINE KANDIDATEN-KENNUNG. Erst der Server holt daraus Provider und Quellkennung
    // und hält sie gegen die Lieferung. Eine Route, die `provider` und `externalId` vom Client
    // ENTGEGENNÄHME, wäre ein freier Lesezugang zum Übersetzungskatalog: wer die Seiten-Id einer
    // Confluence-Seite rät, bekäme ihren Text, ohne dass irgendetwas davon im Bestand steht.
    //
    // DIESELBE RECHTESCHWELLE WIE DIE WARTESCHLANGE. `GET /api/library/import/candidates`
    // (library-routes.ts) verlangt `ko.read` und filtert danach nicht weiter — die Queue ist eine
    // Prüffläche, kein KO-Bestand. Diese Route verlangt DASSELBE Recht und zeigt nichts, was die
    // Queue nicht zeigt: der Kandidatentext steht dort bereits, hier steht er übersetzt.
    // `tests/lesevariante-pruefkarte/kandidatenvariante-route.test.ts` (K6) hält beide Routen im
    // selben Fall gegeneinander.
    //
    // SIE SCHREIBT NICHTS. Kein Annehmen, kein Statuswechsel, kein Claim, keine Lease-Reparatur
    // (die Queue fährt sie beim Laden — hier wäre sie eine Nebenwirkung eines Lesevorgangs). K2
    // misst den Kandidaten nach dem Abruf: Status „neu", `koId` null.
    app.get<{ Params: { id: string; lang: string } }>(
      "/api/library/import/candidates/:id/lesevariante/:lang",
      async (request, reply) => {
        const user = await guards.requirePermission("ko.read", request, reply);
        if (!user) {
          return;
        }
        const kandidat = await kandidaten.findById(request.params.id);
        if (!kandidat) {
          // Kein Kandidat, keine Auskunft — auch keine über die Lieferung. Eine Antwort
          // „keine Variante" wäre hier bereits eine Existenzauskunft über die Kennung.
          reply.code(404).send({ error: "NOT_FOUND", message: "Kandidat nicht gefunden." });
          return;
        }
        const variante = kandidatenLesevariante(request.params.lang, kandidat.item, kandidat.item);
        if (!variante) {
          reply.code(404).send({
            error: "NO_LESEVARIANTE",
            message: "Für diesen Kandidaten gibt es keine Lesevariante in dieser Sprache.",
          });
          return;
        }
        // Feldweise wie die Übersicht darüber: was die Fläche zeigt, geht auf den Draht — und der
        // Datensatzschlüssel der Lieferung bleibt Werkstattwissen im Server.
        reply.code(200).send({
          lang: variante.lang,
          originalLanguage: variante.originalLanguage,
          title: variante.title,
          statement: variante.statement,
          bodyHtml: variante.bodyHtml,
          herkunft: variante.herkunft,
          status: variante.status,
          quellabgleich: variante.quellabgleich,
        });
      },
    );

    app.post<{ Body: LadeBody }>("/api/admin/lesevarianten/laden", async (request, reply) => {
      const user = await guards.requirePermission("users.manage", request, reply);
      if (!user) {
        return;
      }
      const paket = lokalisierungsPaket(String(request.body?.package ?? ""));
      if (!paket) {
        reply.code(400).send({
          error: "UNKNOWN_PACKAGE",
          message: "Für dieses Paket liegt keine Übersetzungslieferung bei.",
        });
        return;
      }
      const bilanz = await ladeLesevarianten(
        {
          repo: lesevarianten,
          // UNGETRIMMT: das Zuordnen ist ein Admin-Vorgang über den ganzen Bestand. Was hier
          // zugeordnet wird, ist deshalb noch keine Anzeige — die Leserouten oben trimmen.
          kos: () => ko.list({}),
          ...(deps.audit ? { audit: deps.audit } : {}),
        },
        paket,
        user.id,
      );
      reply.code(200).send(bilanz);
    });
  };
}
