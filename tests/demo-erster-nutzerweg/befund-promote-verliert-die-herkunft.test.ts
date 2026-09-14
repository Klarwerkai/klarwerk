// ================================================================================================
// JOB 3801 → JOB 3934 · DER ÜBERGANG 4→5 — DER PROMOTE NIMMT DEN INHALT MIT UND JETZT AUCH DIE
// HERKUNFT.
// ================================================================================================
//
// DIESE DATEI WAR EIN BEFUND UND IST JETZT EIN DAUERHAFTER TEST. Sie ist GEDREHT, nicht ersetzt:
// dieselbe Strecke, dieselben drei Schlusszeilen, umgekehrter Befund. Was sie bis JOB 3934 festhielt
// — „solange sie grün ist, besteht der Mangel" — ist behoben; sie sichert seit JOB 3934 die
// Eigenschaft zu, deren Fehlen sie vorher gepinnt hat.
//
// DER NAME DER DATEI IST HISTORISCH und bleibt es: er benennt den Befund, den sie gefunden hat.
// Umbenennen hiesse hier einen weiteren Pfad anzufassen; der Kopf sagt stattdessen ausdrücklich, was
// die Datei heute zusichert (JOB 3934, Runde 2, Steuerungsauftrag „wird zum dauerhaften Test
// gedreht").
//
// ------------------------------------------------------------------------------------------------
// WAS DER BEFUND WAR (12.09.2026, Basisstand 56d2995)
// ------------------------------------------------------------------------------------------------
// Ein Entwurf, der ein GESICHERTES Originaldokument trägt (`anchorDocuments` + `pendingSources` mit
// gültiger `objectId`), wurde über `POST /api/drafts/:id/promote` befördert. Ergebnis damals:
//
//     201 · Wissensobjekt entsteht
//     bodyHtml  = "<p>Ventil bei Überdruck schließen.</p>"   ← der Satz AUS sample.docx
//     sources   = []                                         ← DER MANGEL
//     evidence  = []   (GET /api/kos/:id/evidence → 200, leere Liste)
//
// Also genau der Zustand, den AUFTRAG-mega18 bis mega20 an jeder anderen Stelle geschlossen haben:
// DOKUMENTINHALT OHNE HERKUNFT. Niemand konnte hinterher sagen, woher der Satz stammt; das
// gesicherte Original blieb im Objektspeicher liegen, ohne dass etwas auf es zeigte.
//
// DIE URSACHE, gelesen und nicht geraten: `CaptureService.toKoInput`
// (services/capture/src/service.ts) zählt die Felder des Wissensobjekts EINZELN auf — `sources` war
// nicht darunter, `pendingSources` wurde nirgends gelesen. Die Ankerprüfung eine Zeile darüber
// (`:954-960`) greift nur, wenn das Original FEHLT; war es vorhanden, fiel der Anker still weg.
//
// ZWEI WEGE STANDEN ZUR WAHL — es ist (a) geworden:
//   (a) der Promote trägt die geprüften Belegstellen ans Wissensobjekt, wie es
//       `POST /api/kos/from-document` tut  ← GEBAUT in JOB 3934
//   (b) der Promote WEIST einen Entwurf mit Ankerdokumenten AB und verweist auf den Dokumentweg.
//       Nicht gebaut: sie bräuchte einen neuen Fehlernamen und nähme dem Promote einen Weg, den
//       ein Client heute legitim geht (Auftrag JOB 3934 §10).
//
// ------------------------------------------------------------------------------------------------
// WAS DIESE DATEI HEUTE ZUSICHERT (JOB 3934)
// ------------------------------------------------------------------------------------------------
// Dieselben drei Schlusszeilen, gedreht:
//   1. Das Wissensobjekt entsteht (201)                                  — unverändert.
//   2. Es trägt den Text AUS DER DATEI                                   — unverändert.
//   3. Es trägt die Belegstelle des Entwurfs, mit dem Namen der Datei    — GEDREHT (war `[]`).
//   4. Die append-only Belegkette bleibt LEER                            — GEMESSEN, nicht behauptet:
//      `ko.create` → `finishCreated` (services/knowledge-object/src/service.ts:1929-1947) schreibt
//      keinen `EvidenceRecord`; das tut nur `createWithDocumentsLocked` (`:2166-2195`). Die
//      Belegkette DIESES Weges ist damit noch NICHT geschlossen. Wird Zeile 4 rot, hat jemand einen
//      Schreibweg ergänzt — dann gehört die neue Zahl samt ihren `kind`-Werten hierher.
//
// Die FELDGENAUE Prüfung der Belegstelle (Anzahl, Auszug, Reihenfolge, Adressverzicht, kein
// Vorgabewert) steht nicht hier, sondern in `promote-traegt-die-herkunft.test.ts` (H1–H6). Diese
// Datei hält den ÜBERGANG als Ganzes: Inhalt UND Herkunft in einem Zug.
//
// „ES GIBT KEINEN AUFRUFER" WAR KEINE ENTLASTUNG, und das ist in diesem Haus entschieden: die
// heutige Oberfläche wählt bei vorhandenen Ankern wirklich `from-document` (`Capture.tsx:1729`), der
// Browser-Nutzer lief also nicht hinein. Genau dieses Argument hat BEN in AUFTRAG-mega22 Block C
// aber bereits verworfen (nachzulesen in `services/app/src/routes/ko-routes.ts:1172-1176`):
// *„Unbenutztheit ist kein Schutz für einen weiterhin authentifiziert erreichbaren API-Vertrag."*
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { QUELLSATZ } from "./strecke";

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

describe("JOB 3801/3934 · ZUSAGE: der Promote trägt die geprüfte Herkunft mit", () => {
  it("ÜBERGANG 4→5 · ein Entwurf mit gesichertem Original wird zum Wissensobjekt MIT seiner Belegstelle", async () => {
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

      // ---- DIE ZUSAGE, in vier Zeilen (vormals: der Befund in drei) ---------------------------
      // 1. Das Wissensobjekt ENTSTEHT.
      expect(befoerdert.statusCode, befoerdert.body).toBe(201);
      const ko = befoerdert.json() as {
        id: string;
        bodyHtml?: string | null;
        sources?: { label: string; excerpt: string | null }[];
      };
      // 2. Es trägt den Text AUS DER DATEI.
      expect(ko.bodyHtml ?? "").toContain(QUELLSATZ);
      // 3. UND SEINE HERKUNFT. Genau hier stand bis JOB 3934 `toEqual([])` — Dokumentinhalt ohne
      //    Beleg. Jetzt steht die Belegstelle des Entwurfs am Objekt, mit dem Namen der Datei und
      //    dem Satz, der aus ihr übernommen wurde.
      expect(
        (ko.sources ?? []).map((q) => q.label),
        "WENN DIESE ZEILE ROT IST, fällt die Herkunft beim Einreichen wieder weg (der Befund aus JOB 3801 ist zurück).",
      ).toEqual(["sample.docx"]);
      expect(ko.sources?.[0]?.excerpt).toBe(QUELLSATZ);
      // 4. DIE BELEGKETTE BLEIBT LEER — gemessen, nicht behauptet. Der Promote läuft über
      //    `ko.create`, und dieser Weg schreibt keinen `EvidenceRecord` (Begründung im Kopf dieser
      //    Datei). Die append-only Belegkette dieses Weges ist NOCH NICHT geschlossen; das steht
      //    hier als Tatsache und nicht als Versprechen.
      const belege = await app.inject({
        method: "GET",
        url: `/api/kos/${ko.id}/evidence`,
        headers: kopf,
      });
      expect(belege.statusCode).toBe(200);
      expect(
        belege.json(),
        "GEMESSEN: der Promote schreibt nichts in die Belegkette. Wird diese Zeile rot, hat jemand einen Schreibweg ergänzt — dann gehört die neue Zahl samt kind-Werten hierher.",
      ).toEqual([]);
      // DIE ANDERE TÜR bleibt, wie sie war: dieselbe Datei, dieselbe Quelle über
      // `POST /api/kos/from-document` — dort entsteht die Belegstelle MIT Belegkette, und
      // `durchstich.test.ts` D1 prüft sie bis zurück auf die Bytes des Originals. Der Unterschied
      // zwischen den beiden Türen ist damit nicht mehr „Herkunft oder keine", sondern nur noch
      // „mit Belegkette oder ohne".
    } finally {
      await app.close();
    }
  }, 120_000);
});
