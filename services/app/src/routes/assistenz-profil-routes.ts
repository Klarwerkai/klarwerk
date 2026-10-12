import type { FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
import type { AuditService } from "../../../audit";
import {
  type EigeninitiativeDienst,
  EigeninitiativeFehler,
  type EigeninitiativeStand,
} from "../assistenz-eigeninitiative";
import {
  type AssistenzProfil,
  type AssistenzProfilDienst,
  type AssistenzProfilEingabe,
  AssistenzProfilFehler,
} from "../assistenz-profil";
import {
  KLARA_KUERZEL_AKTIONEN,
  type TastenkuerzelDienst,
  TastenkuerzelFehler,
  type TastenkuerzelStand,
  wirksameBelegung,
} from "../assistenz-tastenkuerzel";
import { type Guards, sendError } from "../http";

// ================================================================================================
// produkt:20261010:assistenz-name-avatar — DAS EIGENE ASSISTENZPROFIL, NUR FÜR DAS EIGENE KONTO.
// ================================================================================================
//
//   GET /api/me/assistenz   — das eigene Profil (oder `profil: null` mit `einrichtungOffen: true`)
//   PUT /api/me/assistenz   — Name, Avatar, Bewegung ändern; Ersteinrichtung abschliessen
//
// Derselbe persönliche Weg wie `/api/me/klara/...`: das Konto kommt AUSSCHLIESSLICH aus der Sitzung
// (`user.id`). Nennt eine Anfrage trotzdem eine Kontokennung (Rumpf oder Adresse) und ist es nicht
// die eigene, lehnt der Server mit 403 ab und ändert nichts — eine manipulierte Kennung wird nicht
// still übergangen, sondern sichtbar abgewiesen. Es gibt keine Profilfreigabe für andere Personen.
//
// Ins Prüfprotokoll geht nur das EREIGNIS (eingerichtet, geändert) — nie der Name.
//
// produkt:20261008:klara-eigeninitiative — derselbe eigene Weg für den Unterstützungsmodus:
//   GET  /api/me/assistenz/eigeninitiative           — Modus und ruhende Hinweise
//   PUT  /api/me/assistenz/eigeninitiative           — Modus wählen (`{ modus }`)
//   POST /api/me/assistenz/eigeninitiative/hinweise  — Hinweis schliessen oder zurückstellen
// Ins Prüfprotokoll geht nur der Moduswechsel als Ereignis; Hinweisschlüssel bleiben draussen.
//
// produkt:20261012:klara-setup-shortcuts-umsetzung — derselbe eigene Weg für die Klara-Kürzel:
//   GET /api/me/assistenz/tastenkuerzel  — wirksame Belegung je Aktion (Standard, eigen, entfernt)
//   PUT /api/me/assistenz/tastenkuerzel  — eine Aktion belegen/entfernen/zurücksetzen oder alle zurück
// Ins Prüfprotokoll geht nur das Ereignis, nie die Kombination.

export const ASSISTENZ_PROFIL_EINGERICHTET = "assistenz.profil.eingerichtet";
export const ASSISTENZ_PROFIL_GEAENDERT = "assistenz.profil.geaendert";
export const ASSISTENZ_EIGENINITIATIVE_GEAENDERT = "assistenz.eigeninitiative.geaendert";
export const ASSISTENZ_TASTENKUERZEL_GEAENDERT = "assistenz.tastenkuerzel.geaendert";

export interface AssistenzProfilRoutenDeps {
  dienst: AssistenzProfilDienst;
  eigeninitiative: EigeninitiativeDienst;
  tastenkuerzel: TastenkuerzelDienst;
  audit: AuditService;
}

/** Die Sicht nach aussen: jede unterstützte Aktion mit ihrer wirksamen Belegung und deren Herkunft. */
function kuerzelSicht(s: TastenkuerzelStand) {
  return {
    aktionen: KLARA_KUERZEL_AKTIONEN.map((aktion) => {
      const eigen = s.belegungen[aktion];
      return {
        aktion,
        belegung: wirksameBelegung(s, aktion),
        quelle: eigen === undefined ? "standard" : eigen === null ? "entfernt" : "eigen",
      };
    }),
    geaendertAm: s.geaendertAm,
  };
}

/** Die Sicht nach aussen: Modus, ob bewusst gewählt, und die noch ruhenden Hinweise. */
function eigenSicht(s: EigeninitiativeStand) {
  return {
    modus: s.modus,
    gewaehlt: s.geaendertAm !== null,
    geaendertAm: s.geaendertAm,
    hinweise: s.hinweise.map((h) => ({ schluessel: h.schluessel, stand: h.stand, bis: h.bis })),
  };
}

/** Feldnamen, mit denen eine Anfrage ein Konto benennen könnte. */
const KONTO_FELDER = ["kontoId", "konto", "userId", "user", "id"] as const;

function rumpf(body: unknown): Record<string, unknown> {
  return body && typeof body === "object" && !Array.isArray(body)
    ? (body as Record<string, unknown>)
    : {};
}

/** `true`, wenn Rumpf oder Adresse eine ANDERE Kontokennung als die der Sitzung nennen. */
function nenntFremdesKonto(request: FastifyRequest, eigeneId: string): boolean {
  const quellen = [rumpf(request.body), rumpf(request.query)];
  return quellen.some((quelle) =>
    KONTO_FELDER.some((feld) => quelle[feld] !== undefined && quelle[feld] !== eigeneId),
  );
}

function fremdAbweisen(reply: FastifyReply): void {
  reply.code(403).send({
    error: "FORBIDDEN",
    message: "Das Assistenzprofil gehört zum eigenen Konto; ein anderes Konto ist nicht änderbar.",
  });
}

/** Die Sicht nach außen — ohne Kontokennung, die der Fragende ohnehin selbst ist. */
function sicht(p: AssistenzProfil | null) {
  return {
    profil: p
      ? {
          name: p.name,
          avatar: p.avatar,
          bewegung: p.bewegung,
          eingerichtetAm: p.eingerichtetAm,
          fassung: p.fassung,
          geaendertAm: p.geaendertAm,
        }
      : null,
    einrichtungOffen: p?.eingerichtetAm == null,
  };
}

export function assistenzProfilRoutes(
  deps: AssistenzProfilRoutenDeps,
  guards: Guards,
): FastifyPluginAsync {
  const { dienst, eigeninitiative, tastenkuerzel, audit } = deps;

  const eigenFehler = (reply: FastifyReply, fehler: unknown): void => {
    if (fehler instanceof EigeninitiativeFehler) {
      reply.code(fehler.status).send({
        error: fehler.status === 400 ? "VALIDATION" : "CONFLICT",
        message: fehler.message,
      });
      return;
    }
    sendError(reply, fehler);
  };

  return async (app) => {
    app.get("/api/me/assistenz", async (request, reply) => {
      const user = await guards.requireUser(request, reply);
      if (!user) {
        return;
      }
      if (nenntFremdesKonto(request, user.id)) {
        fremdAbweisen(reply);
        return;
      }
      try {
        reply.header("cache-control", "no-store");
        reply.code(200).send(sicht(await dienst.hole(user.id)));
      } catch (fehler) {
        sendError(reply, fehler);
      }
    });

    app.put<{ Body: unknown }>("/api/me/assistenz", async (request, reply) => {
      const user = await guards.requireUser(request, reply);
      if (!user) {
        return;
      }
      if (nenntFremdesKonto(request, user.id)) {
        fremdAbweisen(reply);
        return;
      }
      try {
        const vorher = await dienst.hole(user.id);
        const p = await dienst.aendere(user.id, rumpf(request.body) as AssistenzProfilEingabe);
        const eingerichtet = vorher?.eingerichtetAm == null && p.eingerichtetAm !== null;
        await audit.record({
          actor: user.id,
          action: eingerichtet ? ASSISTENZ_PROFIL_EINGERICHTET : ASSISTENZ_PROFIL_GEAENDERT,
          target: `assistenz-profil:${user.id}`,
        });
        reply.header("cache-control", "no-store");
        reply.code(200).send(sicht(p));
      } catch (fehler) {
        if (fehler instanceof AssistenzProfilFehler) {
          reply.code(fehler.status).send({
            error: fehler.status === 400 ? "VALIDATION" : "CONFLICT",
            grund: fehler.grund,
            message: fehler.message,
          });
          return;
        }
        sendError(reply, fehler);
      }
    });

    // produkt:20261008:klara-eigeninitiative — Modus und ruhende Hinweise des eigenen Kontos.
    app.get("/api/me/assistenz/eigeninitiative", async (request, reply) => {
      const user = await guards.requireUser(request, reply);
      if (!user) {
        return;
      }
      if (nenntFremdesKonto(request, user.id)) {
        fremdAbweisen(reply);
        return;
      }
      try {
        reply.header("cache-control", "no-store");
        reply.code(200).send(eigenSicht(await eigeninitiative.lies(user.id)));
      } catch (fehler) {
        eigenFehler(reply, fehler);
      }
    });

    app.put<{ Body: unknown }>("/api/me/assistenz/eigeninitiative", async (request, reply) => {
      const user = await guards.requireUser(request, reply);
      if (!user) {
        return;
      }
      if (nenntFremdesKonto(request, user.id)) {
        fremdAbweisen(reply);
        return;
      }
      try {
        const s = await eigeninitiative.setzeModus(user.id, rumpf(request.body).modus);
        await audit.record({
          actor: user.id,
          action: ASSISTENZ_EIGENINITIATIVE_GEAENDERT,
          target: `assistenz-profil:${user.id}`,
        });
        reply.header("cache-control", "no-store");
        reply.code(200).send(eigenSicht(s));
      } catch (fehler) {
        eigenFehler(reply, fehler);
      }
    });

    app.post<{ Body: unknown }>(
      "/api/me/assistenz/eigeninitiative/hinweise",
      async (request, reply) => {
        const user = await guards.requireUser(request, reply);
        if (!user) {
          return;
        }
        if (nenntFremdesKonto(request, user.id)) {
          fremdAbweisen(reply);
          return;
        }
        try {
          const r = rumpf(request.body);
          const s = await eigeninitiative.legeHinweisAb(user.id, {
            schluessel: r.schluessel,
            stand: r.stand,
          });
          reply.header("cache-control", "no-store");
          reply.code(200).send(eigenSicht(s));
        } catch (fehler) {
          eigenFehler(reply, fehler);
        }
      },
    );

    // produkt:20261012:klara-setup-shortcuts-umsetzung — die Klara-Kürzel des eigenen Kontos.
    app.get("/api/me/assistenz/tastenkuerzel", async (request, reply) => {
      const user = await guards.requireUser(request, reply);
      if (!user) {
        return;
      }
      if (nenntFremdesKonto(request, user.id)) {
        fremdAbweisen(reply);
        return;
      }
      try {
        reply.header("cache-control", "no-store");
        reply.code(200).send(kuerzelSicht(await tastenkuerzel.lies(user.id)));
      } catch (fehler) {
        sendError(reply, fehler);
      }
    });

    app.put<{ Body: unknown }>("/api/me/assistenz/tastenkuerzel", async (request, reply) => {
      const user = await guards.requireUser(request, reply);
      if (!user) {
        return;
      }
      if (nenntFremdesKonto(request, user.id)) {
        fremdAbweisen(reply);
        return;
      }
      try {
        const s = await tastenkuerzel.aendere(user.id, rumpf(request.body));
        await audit.record({
          actor: user.id,
          action: ASSISTENZ_TASTENKUERZEL_GEAENDERT,
          target: `assistenz-profil:${user.id}`,
        });
        reply.header("cache-control", "no-store");
        reply.code(200).send(kuerzelSicht(s));
      } catch (fehler) {
        if (fehler instanceof TastenkuerzelFehler) {
          reply.code(fehler.status).send({
            error: fehler.status === 400 ? "VALIDATION" : "CONFLICT",
            grund: fehler.grund,
            ...(fehler.belegtVon ? { belegtVon: fehler.belegtVon } : {}),
            message: fehler.message,
          });
          return;
        }
        sendError(reply, fehler);
      }
    });
  };
}
