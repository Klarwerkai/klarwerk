import type { FastifyPluginAsync } from "fastify";
import type { AuditService } from "../../../audit";
import { type LmsExportService, leseScormEingabe } from "../../../output";
import { type Guards, sendError } from "../http";
import { sichtbarkeitsfilterFuer } from "../sichtbarkeit";

// produkt:wettbewerb:20261003:lernplattform — Übergabe an eine Lernplattform (SCORM 1.2).
//
// ZWEI TÜREN, EIN RECHT: `ko.read`, wie die Output Factory, aus der der Inhalt stammt. Ein neues
// Freigaberecht gibt es bewusst nicht (bestehende Kontoregeln gelten): was hinaus darf, entscheiden
// die Validierung und die Vertraulichkeit des Inhalts (Inhaltsfreigabe) und die Betreiberliste der
// Lernplattformen (Empfängerfreigabe) — beides prüft der Dienst getrennt.
//
//   POST /api/output/scorm/pruefen — Prüfung vor dem Export; erzeugt nichts, schreibt nichts.
//   POST /api/output/scorm/paket   — das Paket (application/zip). Blockiert die Prüfung, antwortet
//                                     die Tür 422 mit derselben Prüfung statt mit einem Paket.
//
// NACHWEIS: jeder ausgelieferte Export ist ein eigener Auditeintrag (append-only) mit Exportfassung,
// Objektfassungen, Empfänger und Paket-Prüfsumme. Ein späterer Export ändert keinen früheren.
export function lmsExportRoutes(
  lmsExport: LmsExportService,
  audit: AuditService,
  guards: Guards,
): FastifyPluginAsync {
  return async (app) => {
    app.post("/api/output/scorm/pruefen", async (request, reply) => {
      const user = await guards.requirePermission("ko.read", request, reply);
      if (!user) {
        return;
      }
      try {
        // R-1175: die EINE Sichtbarkeitsentscheidung dieses Betrachters reist in den Dienst.
        const eingabe = leseScormEingabe(request.body);
        reply.code(200).send(await lmsExport.pruefe(eingabe, sichtbarkeitsfilterFuer(user)));
      } catch (error) {
        sendError(reply, error);
      }
    });

    app.post("/api/output/scorm/paket", async (request, reply) => {
      const user = await guards.requirePermission("ko.read", request, reply);
      if (!user) {
        return;
      }
      try {
        const eingabe = leseScormEingabe(request.body);
        const ergebnis = await lmsExport.exportiere(eingabe, sichtbarkeitsfilterFuer(user));
        if (!("daten" in ergebnis)) {
          reply.code(422).send({ error: "EXPORT_BLOCKED", pruefung: ergebnis.pruefung });
          return;
        }
        const { fassung, sha256, daten } = ergebnis;
        await audit.record({
          actor: user.id,
          action: "output.lms-export",
          target: `lms-export:${fassung.kennung}`,
          payload: {
            format: "SCORM 1.2",
            exportfassung: fassung.kennung,
            manifestId: fassung.manifestId,
            empfaenger: eingabe.empfaenger,
            sprache: fassung.sprache,
            objekte: fassung.objekte.map((o) => ({ koId: o.koId, version: o.version })),
            paketSha256: sha256,
          },
        });
        reply
          .code(200)
          .header("content-type", "application/zip")
          .header("content-disposition", `attachment; filename="${fassung.dateiname}"`)
          .header("x-klarwerk-exportfassung", fassung.kennung)
          .header("x-klarwerk-paket-sha256", sha256)
          .send(daten);
      } catch (error) {
        sendError(reply, error);
      }
    });
  };
}
