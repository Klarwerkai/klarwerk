import type { FastifyPluginAsync, FastifyReply } from "fastify";
import type { AuditService } from "../../../audit";
import { type Guards, sendError } from "../http";
import { type Produktbudget, ProduktbudgetFehler } from "../produktbudget";

// ================================================================================================
// produkt:20261013:produktbudget-anwender-admin — DIE PRODUKTBUDGETS IN DER VERWALTUNG.
// ================================================================================================
//
//   GET /api/admin/produktbudget                          Bereiche mit Betrag, Währung, Zeitraum,
//                                                         Verbrauch, Rest und Kontogrenzen
//   PUT /api/admin/produktbudget/:bereich                 Einstellung eines Bereichs ändern
//   PUT /api/admin/produktbudget/:bereich/konten/:konto   Zuweisung eines Kontos (PBE-12)
//   GET /api/me/produktbudget                             eigene Grenzen und eigene Belegung
//   PUT /api/me/produktbudget/:bereich                    eigenes Unterlimit (PBE-12)
//
// Gesamtbetrag und Zuweisungen NUR mit `users.manage` (PBE-05/12), am Server geprüft — die
// Oberfläche blendet nichts frei. Das eigene Unterlimit setzt jedes Konto mit `ko.read` für SICH:
// das Konto kommt aus der Sitzung, nie aus Pfad oder Rumpf, und der Dienst hält es innerhalb der
// erlaubten Zuweisung. Mandant und ändernde Person kommen aus Instanz und Sitzung; Angaben dazu im
// Rumpf werden abgewiesen. Keine Änderung erteilt eine Anbieterfreigabe, einen Zugang oder Tokens.
// Ins Prüfprotokoll gehen Änderungen mit Bereich und Kennung, ohne Geheimnisse.

export const PRODUKTBUDGET_GEAENDERT = "produktbudget.geaendert";
export const PRODUKTBUDGET_ZUWEISUNG = "produktbudget.zuweisung";
export const PRODUKTBUDGET_UNTERLIMIT = "produktbudget.unterlimit";

export interface ProduktbudgetRoutenDeps {
  readonly dienst: Produktbudget;
  readonly audit: AuditService;
  /** Gibt es dieses Konto? Eine Zuweisung an ein unbekanntes Konto wird nicht gespeichert. */
  readonly kontoBekannt: (konto: string) => Promise<boolean>;
}

const FREMDE_FELDER = ["mandant", "kontoId", "konto", "userId", "nutzer", "von"] as const;

function rumpf(body: unknown): Record<string, unknown> {
  return body && typeof body === "object" && !Array.isArray(body)
    ? (body as Record<string, unknown>)
    : {};
}

function fremdeAngabe(reply: FastifyReply, body: unknown): boolean {
  const r = rumpf(body);
  if (FREMDE_FELDER.some((f) => r[f] !== undefined)) {
    reply.code(403).send({
      error: "FORBIDDEN",
      message: "Mandant und ändernde Person kommen aus Instanz und Anmeldung.",
    });
    return true;
  }
  return false;
}

function fehlerAntwort(reply: FastifyReply, fehler: unknown): void {
  if (fehler instanceof ProduktbudgetFehler) {
    reply.code(fehler.status).send({
      error:
        fehler.status === 404 ? "NOT_FOUND" : fehler.status === 409 ? "CONFLICT" : "VALIDATION",
      grund: fehler.grund,
      message: fehler.message,
      ...(fehler.stand ? { stand: fehler.stand } : {}),
    });
    return;
  }
  sendError(reply, fehler);
}

export function produktbudgetRoutes(
  deps: ProduktbudgetRoutenDeps,
  guards: Guards,
): FastifyPluginAsync {
  return async (app) => {
    app.get("/api/admin/produktbudget", async (request, reply) => {
      const user = await guards.requirePermission("users.manage", request, reply);
      if (!user) {
        return;
      }
      try {
        reply.header("cache-control", "no-store");
        reply.code(200).send(await deps.dienst.lies());
      } catch (fehler) {
        sendError(reply, fehler);
      }
    });

    app.put<{ Params: { bereich: string }; Body: unknown }>(
      "/api/admin/produktbudget/:bereich",
      async (request, reply) => {
        const user = await guards.requirePermission("users.manage", request, reply);
        if (!user) {
          return;
        }
        if (fremdeAngabe(reply, request.body)) {
          return;
        }
        const r = rumpf(request.body);
        try {
          const ergebnis = await deps.dienst.aendere(user.id, request.params.bereich, {
            betrag: r.betrag,
            waehrung: r.waehrung,
            zeitraum: r.zeitraum,
            fassung: r.fassung,
            aenderungId: r.aenderungId,
            grund: r.grund,
          });
          if (ergebnis.geaendert) {
            await deps.audit.record({
              actor: user.id,
              action: PRODUKTBUDGET_GEAENDERT,
              target: `produktbudget:${request.params.bereich}:${String(r.aenderungId)}`,
            });
          }
          reply.header("cache-control", "no-store");
          reply.code(200).send({
            ...ergebnis.sicht,
            wiederholt: ergebnis.wiederholt,
            geaendert: ergebnis.geaendert,
            bestaetigteFassung: ergebnis.bestaetigteFassung,
          });
        } catch (fehler) {
          fehlerAntwort(reply, fehler);
        }
      },
    );

    // PBE-12: die erlaubte Zuweisung eines Kontos — allein die Verwaltung.
    app.put<{ Params: { bereich: string; konto: string }; Body: unknown }>(
      "/api/admin/produktbudget/:bereich/konten/:konto",
      async (request, reply) => {
        const user = await guards.requirePermission("users.manage", request, reply);
        if (!user) {
          return;
        }
        if (fremdeAngabe(reply, request.body)) {
          return;
        }
        const r = rumpf(request.body);
        try {
          if (!(await deps.kontoBekannt(request.params.konto))) {
            reply.code(404).send({
              error: "NOT_FOUND",
              grund: "konto",
              message: "Dieses Konto gibt es nicht.",
            });
            return;
          }
          const ergebnis = await deps.dienst.setzeKontogrenze(user.id, {
            art: "zuweisung",
            bereich: request.params.bereich,
            konto: request.params.konto,
            betrag: r.zuweisung,
            fassung: r.fassung,
          });
          if (!ergebnis.unveraendert) {
            await deps.audit.record({
              actor: user.id,
              action: PRODUKTBUDGET_ZUWEISUNG,
              target: `produktbudget:${request.params.bereich}:konto:${request.params.konto}`,
            });
          }
          reply.header("cache-control", "no-store");
          reply.code(200).send({ ...(await deps.dienst.lies()), grenze: ergebnis.grenze });
        } catch (fehler) {
          fehlerAntwort(reply, fehler);
        }
      },
    );

    // PBE-12: das eigene Budget — nur das Konto der Sitzung.
    app.get("/api/me/produktbudget", async (request, reply) => {
      const user = await guards.requirePermission("ko.read", request, reply);
      if (!user) {
        return;
      }
      try {
        reply.header("cache-control", "no-store");
        reply.code(200).send(await deps.dienst.eigene(user.id));
      } catch (fehler) {
        sendError(reply, fehler);
      }
    });

    app.put<{ Params: { bereich: string }; Body: unknown }>(
      "/api/me/produktbudget/:bereich",
      async (request, reply) => {
        const user = await guards.requirePermission("ko.read", request, reply);
        if (!user) {
          return;
        }
        if (fremdeAngabe(reply, request.body)) {
          return;
        }
        const r = rumpf(request.body);
        // Ein Anwender ändert weder Gesamtbetrag noch Zuweisung — nur sein eigenes Unterlimit.
        if (r.betrag !== undefined || r.zuweisung !== undefined || r.zeitraum !== undefined) {
          reply.code(403).send({
            error: "FORBIDDEN",
            message: "Gesamtbudget und Zuweisung ändert nur die Verwaltung.",
          });
          return;
        }
        try {
          const ergebnis = await deps.dienst.setzeKontogrenze(user.id, {
            art: "unterlimit",
            bereich: request.params.bereich,
            konto: user.id,
            betrag: r.unterlimit,
            fassung: r.fassung,
          });
          if (!ergebnis.unveraendert) {
            await deps.audit.record({
              actor: user.id,
              action: PRODUKTBUDGET_UNTERLIMIT,
              target: `produktbudget:${request.params.bereich}:unterlimit`,
            });
          }
          reply.header("cache-control", "no-store");
          reply.code(200).send(await deps.dienst.eigene(user.id));
        } catch (fehler) {
          fehlerAntwort(reply, fehler);
        }
      },
    );
  };
}
