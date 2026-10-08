import type { FastifyPluginAsync } from "fastify";
import type { AuditService } from "../../../audit";
import { isValidConfidentiality } from "../../../knowledge-object";
import type { ObjectStore } from "../../../object-store";
import { type LmsExportService, type ScormBetrachter, leseScormEingabe } from "../../../output";
import { type Guards, type SessionUser, sendError } from "../http";
import { type AnhangQuellen, beurteileAnhang, sichtbarkeitsfilterFuer } from "../sichtbarkeit";

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
//
// aufnahme:20260922:gesamt-leserechte: beide Türen tragen die Lesepolicy DIESES Betrachters —
// für Wissensobjekte `sichtbarkeitsfilterFuer`, für Bilder dieselbe Anhangsregel wie
// `GET /api/objects/:id` (`beurteileAnhang` über dieselben Herkünfte). Ohne beides ging ins Paket,
// was der Betrachter im Produkt selbst nicht öffnen darf.
export function lmsExportRoutes(
  lmsExport: LmsExportService,
  audit: AuditService,
  guards: Guards,
  objects: ObjectStore,
  quellen: AnhangQuellen,
): FastifyPluginAsync {
  // Wortgleich zur Torwache in object-routes.ts/media-routes.ts: derselbe Speicher, dieselbe Regel.
  async function mediumSichtbar(user: SessionUser, objectId: string): Promise<boolean> {
    // mega76 A: ein Aufrufer, den der Compiler nicht sieht, bekommt ein NEIN — nicht ein Ja.
    if (typeof quellen?.kos !== "function") {
      return false;
    }
    const ref = await objects.metadata(objectId);
    if (!ref) {
      return false;
    }
    const urteil = await beurteileAnhang(
      user,
      objectId,
      {
        confidentiality: isValidConfidentiality(ref.confidentiality) ? ref.confidentiality : null,
        author: ref.lifecycle?.owner ?? null,
      },
      quellen,
    );
    return urteil.sichtbar;
  }

  function betrachterFuer(user: SessionUser): ScormBetrachter {
    return {
      ko: sichtbarkeitsfilterFuer(user),
      medium: (objectId) => mediumSichtbar(user, objectId),
    };
  }

  return async (app) => {
    app.post("/api/output/scorm/pruefen", async (request, reply) => {
      const user = await guards.requirePermission("ko.read", request, reply);
      if (!user) {
        return;
      }
      try {
        const eingabe = leseScormEingabe(request.body);
        reply.code(200).send(await lmsExport.pruefe(eingabe, betrachterFuer(user)));
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
        const ergebnis = await lmsExport.exportiere(eingabe, betrachterFuer(user));
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
