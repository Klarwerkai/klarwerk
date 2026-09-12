// ================================================================================================
// JOB 3801 · BEFUND AUF DEM ÜBERGANG 4→5 — DER PROMOTE NIMMT DEN INHALT MIT UND DIE HERKUNFT NICHT.
// ================================================================================================
//
// DIESE DATEI SICHERT KEINE EIGENSCHAFT ZU. Sie hält einen MANGEL fest, den die Strecke dieses
// Auftrags gefunden hat. SOLANGE SIE GRÜN IST, BESTEHT DER MANGEL. Wird sie rot, ist er behoben —
// dann gehört diese Datei GELÖSCHT und nicht angepasst.
//
// Reparieren darf dieser Auftrag ihn nicht: seine Zielpfade sind `tests/demo-erster-nutzerweg/**`,
// und der Mangel sitzt im Produkt (Auftrag §5).
//
// ------------------------------------------------------------------------------------------------
// WAS GEMESSEN WURDE (12.09.2026, Basisstand 56d2995)
// ------------------------------------------------------------------------------------------------
// Ein Entwurf, der ein GESICHERTES Originaldokument trägt (`anchorDocuments` + `pendingSources` mit
// gültiger `objectId`), wird über `POST /api/drafts/:id/promote` befördert. Ergebnis:
//
//     201 · Wissensobjekt entsteht
//     bodyHtml  = "<p>Ventil bei Überdruck schließen.</p>"   ← der Satz AUS sample.docx
//     sources   = []
//     evidence  = []   (GET /api/kos/:id/evidence → 200, leere Liste)
//
// Also genau der Zustand, den AUFTRAG-mega18 bis mega20 an jeder anderen Stelle geschlossen haben:
// DOKUMENTINHALT OHNE HERKUNFT. Niemand kann hinterher sagen, woher der Satz stammt; das gesicherte
// Original bleibt im Objektspeicher liegen, ohne dass etwas auf es zeigt.
//
// DIE URSACHE, gelesen und nicht geraten: `CaptureService.toKoInput`
// (services/capture/src/service.ts:989-1018) zählt die Felder des Wissensobjekts EINZELN auf —
// `anchorDocuments` und `pendingSources` sind nicht darunter. Die Ankerprüfung eine Zeile darüber
// (`:954-960`) greift nur, wenn das Original FEHLT; ist es vorhanden, fällt der Anker still weg.
//
// WAS STATTDESSEN RICHTIG WÄRE — eines von beiden, nicht beides:
//   (a) der Promote trägt die geprüften Anker als Belegstellen ans Wissensobjekt, wie es
//       `POST /api/kos/from-document` tut, ODER
//   (b) der Promote WEIST einen Entwurf mit Ankerdokumenten AB und verweist auf den Dokumentweg —
//       dann gibt es für übernommenen Dokumentinhalt genau eine Tür.
//
// „ES GIBT KEINEN AUFRUFER" IST KEINE ENTLASTUNG, und das ist in diesem Haus entschieden: die
// heutige Oberfläche wählt bei vorhandenen Ankern wirklich `from-document` (`Capture.tsx:1729`), der
// Browser-Nutzer läuft also nicht hinein. Genau dieses Argument hat BEN in AUFTRAG-mega22 Block C
// aber bereits verworfen (nachzulesen in `services/app/src/routes/ko-routes.ts:1172-1176`):
// *„Unbenutztheit ist kein Schutz für einen weiterhin authentifiziert erreichbaren API-Vertrag."*
//
// ZUSTÄNDIGKEIT: Von den Jobs, die der Auftrag §4 als Halter demo-relevanter Produktdateien nennt
// (3761, 3762, 3776, 3780, 3782, 3784, 3797), hält KEINER `services/capture/src/service.ts` oder
// `services/app/src/routes/capture-routes.ts` — geprüft an den `zielpfade:`-Blöcken der
// Auftragsdateien; `lage.json` führt keine Zielpfade.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { QUELLSATZ } from "./strecke";

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

describe("JOB 3801 · BEFUND (kein Versprechen): der Promote verliert die geprüfte Herkunft", () => {
  it("BEFUND · ein Entwurf mit gesichertem Original wird zum Wissensobjekt OHNE jede Belegstelle", async () => {
    const services = buildServices();
    const app = buildApp(services);
    await app.ready();
    try {
      const einrichten = await app.inject({
        method: "POST",
        url: "/api/auth/setup",
        payload: { name: "Demo", email: "befund@job3801.test", password: "vorfuehrung12345" },
      });
      expect(einrichten.statusCode, einrichten.body).toBe(201);
      const kopf = {
        cookie: String(einrichten.headers["set-cookie"] ?? "").split(";")[0] ?? "",
      };

      // Die echte Datei herein — derselbe Weg wie in der Strecke.
      const bytes = readFileSync(join(__dirname, "..", "fixtures", "sample.docx"));
      const entwurf = await app.inject({
        method: "POST",
        url: "/api/drafts/from-docx",
        headers: kopf,
        payload: { name: "sample.docx", data: bytes.toString("base64") },
      });
      expect(entwurf.statusCode, entwurf.body).toBe(201);
      const entwurfId = (entwurf.json() as { id: string }).id;

      // Das Original GESICHERT — es existiert also wirklich, die Ankerprüfung hat nichts zu
      // beanstanden. Genau darauf beruht der Befund.
      const objekt = await app.inject({
        method: "POST",
        url: "/api/objects",
        headers: kopf,
        payload: {
          name: "sample.docx",
          mime: DOCX_MIME,
          data: `data:${DOCX_MIME};base64,${bytes.toString("base64")}`,
          kind: "document",
          purpose: "anchor",
          draftId: entwurfId,
        },
      });
      expect(objekt.statusCode, objekt.body).toBe(201);
      const objectId = (objekt.json() as { id: string }).id;

      const stand = {
        title: "Ventil bei Überdruck",
        statement: "Bei Überdruck wird das Ventil geschlossen.",
        type: "best_practice",
        category: "Wartung",
        confidentiality: "intern",
        pendingSources: [
          { label: "sample.docx", excerpt: QUELLSATZ, anchorKey: "anker-1", objectId },
        ],
        anchorDocuments: [{ key: "anker-1", objectId, name: "sample.docx", mime: DOCX_MIME }],
      };
      const gespeichert = await app.inject({
        method: "PUT",
        url: `/api/drafts/${entwurfId}`,
        headers: kopf,
        payload: stand,
      });
      expect(gespeichert.statusCode, gespeichert.body).toBe(200);
      // KALIBRIERUNG: der gespeicherte Entwurf trägt den Anker WIRKLICH. Ohne diese Zeile könnte der
      // Befund auch daran liegen, dass die Persistenz ihn nie angenommen hat — das wäre ein anderer
      // Mangel an einer anderen Stelle.
      const nachgelesen = await app.inject({
        method: "GET",
        url: `/api/drafts/${entwurfId}`,
        headers: kopf,
      });
      const gelesen = nachgelesen.json() as {
        payload?: { anchorDocuments?: { objectId?: string }[] };
        anchorsMissing?: string[];
      };
      expect(gelesen.payload?.anchorDocuments?.[0]?.objectId).toBe(objectId);
      expect(gelesen.anchorsMissing ?? []).toEqual([]);

      // DER WEG, UM DEN ES GEHT. Ein gültiger Vorgangsschlüssel ist Pflicht (sonst 400
      // INVALID_OPERATION_ID — gemessen), deshalb steht hier eine richtige Kennung.
      const befoerdert = await app.inject({
        method: "POST",
        url: `/api/drafts/${entwurfId}/promote`,
        headers: kopf,
        payload: {
          operationId: "3801befd-0000-4000-8000-000000000001",
          draftPayload: stand,
        },
      });

      // ---- DER BEFUND, in drei Zeilen ---------------------------------------------------------
      // 1. Das Wissensobjekt ENTSTEHT.
      expect(befoerdert.statusCode, befoerdert.body).toBe(201);
      const ko = befoerdert.json() as {
        id: string;
        bodyHtml?: string | null;
        sources?: unknown[];
      };
      // 2. Es trägt den Text AUS DER DATEI.
      expect(ko.bodyHtml ?? "").toContain(QUELLSATZ);
      // 3. Und keine einzige Belegstelle — weder am Objekt noch in der append-only Belegkette.
      expect(
        ko.sources,
        "WENN DIESE ZEILE ROT IST, ist der Befund behoben: der Promote trägt die Herkunft jetzt mit.",
      ).toEqual([]);
      const belege = await app.inject({
        method: "GET",
        url: `/api/kos/${ko.id}/evidence`,
        headers: kopf,
      });
      expect(belege.statusCode).toBe(200);
      expect(
        belege.json(),
        "WENN DIESE ZEILE ROT IST, ist der Befund behoben: die Belegkette kennt das Original jetzt.",
      ).toEqual([]);
      // DASS ES ANDERS GEHT, steht nicht hier, sondern wird gefahren: dieselbe Datei, dieselbe
      // Quelle, die andere Tür (`POST /api/kos/from-document`) — dort entsteht die Belegstelle, und
      // `durchstich.test.ts` D1 prüft sie bis zurück auf die Bytes des Originals. Der Mangel ist
      // also kein Naturgesetz des Bestands, sondern ein Unterschied zwischen zwei Türen.
    } finally {
      await app.close();
    }
  }, 120_000);
});
