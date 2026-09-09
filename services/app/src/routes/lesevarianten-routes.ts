// ================================================================================================
// JOB 3326 · LESEVARIANTE — DIE DREI ROUTEN.
// ================================================================================================
//
//   GET  /api/kos/:id/lesevariante/:lang   die VOLLE Variante EINES Objekts (Detailansicht)
//   GET  /api/lesevarianten?lang=de        die KURZE Übersicht (Titel/Kernaussage) für Listen
//   POST /api/admin/lesevarianten/laden    die Admin-Aktion „Übersetzungen für Paket laden"
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
import type { Guards } from "../http";
import {
  type LesevariantenRepo,
  ladeLesevarianten,
  lokalisierungsPaket,
  mitAenderungsauskunft,
} from "../lesevarianten";
import { darfSehen, sichtbareFuer, sqlSichtbarkeitFuer } from "../sichtbarkeit";

export interface LesevariantenRoutesDeps {
  ko: KoService;
  lesevarianten: LesevariantenRepo;
  audit?: AuditService;
}

interface LadeBody {
  package?: unknown;
}

export function lesevariantenRoutes(
  deps: LesevariantenRoutesDeps,
  guards: Guards,
): FastifyPluginAsync {
  const { ko, lesevarianten } = deps;
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
