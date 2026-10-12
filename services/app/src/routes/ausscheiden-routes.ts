import type { FastifyPluginAsync } from "fastify";
import { AuthError, type AuthService, type PublicUser, meldung, sprache } from "../../../auth";
import { type Guards, sendError } from "../http";
import type { VorgangZuteilung, Wissensuebergabe } from "../wissensuebergabe";

// ================================================================================================
// AUTORENÜBERGABE-AUFTRAG (R-0961) — DER STATUS „AUSGESCHIEDEN“.
// ================================================================================================
//
// QUELLE: Peters Entscheidung 1 vom 12.10.2026 (QUELLEN-PETER-BLOCKADEN-ENTSCHEIDUNGEN-20261012):
// „Eigener Status ‚Ausgeschieden‘, ausdrücklich durch einen Berechtigten gesetzt. Inaktivität oder
// vorübergehende Sperrung reichen dafür nicht. Zugang und Sitzungen entziehen, Urheberschaft
// erhalten und eine zuständige Vertretung für offene Aufgaben zuordnen.“
//
// `POST /api/users/:id/ausscheiden` mit `{ vertretung }`, nur mit `users.manage`. Das ist dieselbe
// Berechtigung wie die übrige Kontoverwaltung und die Autorenübergabe. Ablauf über vorhandene
// Funktionen:
//   1. `AuthService.ausscheiden`: Vermerk `user.ausgeschieden`, Freigabe entzogen, Sitzungen
//      gelöscht, in einem Rahmen. Der letzte freigegebene Admin kann nicht ausscheiden.
//   2. Offene Aufgaben (Entwürfe, offene Lücken, offene Prüfaufgaben) an die Vertretung, über die
//      vorhandene Wissensübergabe (`Wissensuebergabe.vorgaengeUebergeben`, Vermerk
//      `lifecycle.handover`).
//   3. Die Urheberschaft bleibt. Kein Wissensobjekt wird angefasst; `author` zeigt weiter auf das
//      Konto. Genau daraus entsteht die wartende Autorenübergabe (`lib/autorenuebergabe.ts`, Grund
//      `ausgeschieden`), die über die vorhandene `transfer-author` erledigt wird.
// Ein zweiter Aufruf ist harmlos: Er vermerkt den Status erneut und überträgt nur, was noch offen
// ist.
export interface AusscheidenDienste {
  auth: Pick<AuthService, "ausscheiden" | "kontoLesen">;
  vorgaenge: Pick<Wissensuebergabe, "offeneVorgaenge" | "vorgaengeUebergeben">;
  now?: () => number;
}

/** Kann dieses Konto Aufgaben übernehmen? Freigegeben und nicht abgelaufen. */
function erreichbar(konto: PublicUser, jetzt: number): boolean {
  if (!konto.approved) {
    return false;
  }
  const ende = konto.accessExpiresAt ? Date.parse(konto.accessExpiresAt) : Number.NaN;
  return Number.isNaN(ende) || ende > jetzt;
}

export function ausscheidenRoutes(dienste: AusscheidenDienste, guards: Guards): FastifyPluginAsync {
  const jetzt = dienste.now ?? (() => Date.now());
  return async (app) => {
    app.post<{ Params: { id: string }; Body: { vertretung?: unknown } | undefined }>(
      "/api/users/:id/ausscheiden",
      async (request, reply) => {
        const user = await guards.requirePermission("users.manage", request, reply);
        if (!user) {
          return;
        }
        const id = request.params.id;
        const roh = request.body?.vertretung;
        const vertretung = typeof roh === "string" ? roh.trim() : "";
        if (vertretung === "" || vertretung === id) {
          reply.code(400).send({
            error: "VERTRETUNG_UNGUELTIG",
            message: "Eine Vertretung (ein anderes Konto) muss angegeben sein.",
          });
          return;
        }
        try {
          if (!(await dienste.auth.kontoLesen(id))) {
            reply.code(404).send({ error: "NOT_FOUND", message: "Das Konto gibt es nicht." });
            return;
          }
          const vertreter = await dienste.auth.kontoLesen(vertretung);
          if (!vertreter || !erreichbar(vertreter, jetzt())) {
            reply.code(400).send({
              error: "VERTRETUNG_UNGUELTIG",
              message: "Die Vertretung ist kein freigeschaltetes Konto.",
            });
            return;
          }
          const konto = await dienste.auth.ausscheiden(id, user.id, vertretung);
          const offen = (await dienste.vorgaenge.offeneVorgaenge([id])).get(id);
          const zuteilung: VorgangZuteilung[] = [
            ...(offen?.entwuerfe ?? []).map((e) => ({
              art: "entwurf" as const,
              id: e.id,
              an: vertretung,
            })),
            ...(offen?.luecken ?? []).map((l) => ({
              art: "luecke" as const,
              id: l.id,
              an: vertretung,
            })),
            ...(offen?.pruefaufgaben ?? []).map((p) => ({
              art: "pruefaufgabe" as const,
              id: p.koId,
              an: vertretung,
            })),
          ];
          const ergebnis = await dienste.vorgaenge.vorgaengeUebergeben(
            id,
            zuteilung,
            user.id,
            true,
          );
          reply.code(200).send({
            id: konto.id,
            approved: konto.approved,
            vertretung,
            vorgaenge: {
              uebertragen: ergebnis.uebertragen,
              abgelehnt: ergebnis.abgelehnt,
              fehlgeschlagen: ergebnis.fehlgeschlagen,
            },
          });
        } catch (e) {
          // Der Aussperrschutz wirft einen Katalogschlüssel (`LAST_ADMIN_DELETION`) — übersetzt wie
          // an den Kontorouten.
          if (e instanceof AuthError) {
            reply
              .code(e.code === "NOT_FOUND" ? 404 : 403)
              .send({ error: e.code, message: meldung(e.message, sprache(request)) });
            return;
          }
          sendError(reply, e);
        }
      },
    );
  };
}
