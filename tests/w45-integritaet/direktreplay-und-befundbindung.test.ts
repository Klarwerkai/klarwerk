import { afterEach, describe, expect, it, vi } from "vitest";
import type { SemanticPrefilter } from "../../services/app/src/duplicate-detection";
import * as koRouten from "../../services/app/src/routes/ko-routes";
import { baueFrischeBuehne, schliesseBuehnen } from "../beta-rollenabnahme/buehne";

afterEach(async () => {
  await schliesseBuehnen();
  vi.restoreAllMocks();
});

const daten = {
  type: "best_practice" as const,
  category: "Wartung",
  confidentiality: "intern" as const,
  title: "Wiederholbare Direktanlage",
  statement: "Pumpe nach dem Anfahren entlüften.",
  conditions: [],
  measures: [],
};

describe("W4.5 Korrektur: direkte Wiederholung und gebundener Merge-Befund", () => {
  it.each(["zuweisen", "routen"] as const)(
    "direkte Wiederholung erhält abgeschlossenen Status und führt Nacharbeiten nur einmal aus: %s",
    async (weg) => {
      // Die produktive Route und der gewöhnliche InMemory-KO-Dienst bleiben echt. Gezählt
      // werden ihre Nacharbeitsports; Embedder und Jobannahme haben hier kein Fremdsystem.
      const notify = vi.fn(async () => {});
      const routing = vi.fn(async () => {});
      const enqueue = vi.fn();
      const embed = vi.fn(async () => ({
        vectors: [[1, 0]],
        embeddingVersion: "kontrolliert-v1",
      }));
      const upsert = vi.fn(async () => {});
      const prefilter = {
        embedder: { embed },
        store: { upsert },
        topK: 1,
      } as unknown as SemanticPrefilter;
      const original = koRouten.koRoutes;
      const vermerke = vi.fn();
      const pruefe = vi.fn();
      vi.spyOn(koRouten, "koRoutes").mockImplementation((deps, guards) => {
        const vorlagen = deps.vorlagen;
        const worker = deps.aiCheckWorker;
        if (!vorlagen || !worker) throw new Error("Produktiver Vorlagen-/Prüfport fehlt");
        vermerke.mockImplementation(vorlagen.vermerke);
        pruefe.mockImplementation(vorlagen.pruefe);
        return original(
          {
            ...deps,
            notifyAssignment: notify,
            routeNeuesObjekt: routing,
            aiCheckWorker: { ...worker, enqueue },
            semanticPrefilter: prefilter,
            vorlagen: { ...vorlagen, pruefe, vermerke },
          },
          guards,
        );
      });
      const w = await baueFrischeBuehne();
      const assign = vi.spyOn(w.services.validation, "assign");
      const pending = vi.spyOn(w.services.ko, "markAiCheckPending");
      const payload = {
        ...daten,
        operationId: `direkt-replay-w45-nacharbeit-${weg}`,
        bodyHtml:
          "<h2>FAQ</h2><h3>Frage</h3><p>Wann entlüften?</p><h3>Antwort</h3><p>Nach dem Anfahren.</p>",
        vorlage: { id: "std-faq", version: 1, spaceId: null },
        ...(weg === "zuweisen" ? { reviewerIds: [w.konto.controller.id] } : {}),
      };
      const post = (body = payload) =>
        w.app.inject({
          method: "POST",
          url: "/api/kos",
          headers: { authorization: `Bearer ${w.sitzung.experte}` },
          payload: body,
        });
      const erster = await post();
      expect(erster.statusCode, erster.body).toBe(201);
      await vi.waitFor(() => expect(upsert).toHaveBeenCalledTimes(1));
      expect(vermerke).toHaveBeenCalledTimes(1);
      expect(pending).toHaveBeenCalledTimes(1);
      expect(enqueue).toHaveBeenCalledTimes(1);
      expect(embed).toHaveBeenCalledTimes(1);
      expect(assign).toHaveBeenCalledTimes(weg === "zuweisen" ? 1 : 0);
      expect(notify).toHaveBeenCalledTimes(weg === "zuweisen" ? 1 : 0);
      expect(routing).toHaveBeenCalledTimes(weg === "routen" ? 1 : 0);

      const id = erster.json().id as string;
      expect(await w.services.ko.resolveAiCheck(id, { ok: true }, erster.json().version)).toBe(
        true,
      );
      await w.services.ko.setValidationState(id, { status: "validiert", trust: 77 });
      const vorher = await w.repos.koRepo.findById(id);
      expect(vorher).toMatchObject({ status: "validiert", trust: 77, aiCheck: { status: "done" } });
      const wiederholung = await post();
      expect(wiederholung.statusCode, wiederholung.body).toBe(201);
      expect(wiederholung.json()).toMatchObject({
        id,
        status: "validiert",
        trust: 77,
        aiCheck: { status: "done" },
      });
      expect(await w.repos.koRepo.findById(id)).toEqual(vorher);
      expect(await w.services.ko.list()).toHaveLength(1);
      expect(pruefe).toHaveBeenCalledTimes(2); // Das aktuelle Eingangstor wird nicht übersprungen.
      expect(vermerke).toHaveBeenCalledTimes(1);
      expect(pending).toHaveBeenCalledTimes(1);
      expect(enqueue).toHaveBeenCalledTimes(1);
      expect(embed).toHaveBeenCalledTimes(1);
      expect(upsert).toHaveBeenCalledTimes(1);
      expect(assign).toHaveBeenCalledTimes(weg === "zuweisen" ? 1 : 0);
      expect(notify).toHaveBeenCalledTimes(weg === "zuweisen" ? 1 : 0);
      expect(routing).toHaveBeenCalledTimes(weg === "routen" ? 1 : 0);
      const anders = await post({
        ...payload,
        statement: "Anderer Inhalt unter demselben Schlüssel",
      });
      expect(anders.statusCode, anders.body).toBe(409);
      expect(await w.repos.koRepo.findById(id)).toEqual(vorher);
    },
  );

  it.each(["A", "B", "aktuell"] as const)(
    "Merge prüft die Befundbindung an beide frischen Seiten: %s",
    async (geändert) => {
      const w = await baueFrischeBuehne();
      const a = await w.services.ko.create({ ...daten, author: w.konto.experte.id });
      const b = await w.services.ko.create({
        ...daten,
        title: "Gegenseite",
        statement: "Zusatz der Gegenseite",
        author: w.konto.experte.id,
      });
      // Reale Revision vor dem nachlaufenden Befundinsert: ein alter Erkennungslauf kann
      // A1/B1 materialisieren, während die Vorschau schon die aktuelle Fassung trägt.
      if (geändert !== "aktuell") {
        const id = geändert === "A" ? a.id : b.id;
        const r = await w.app.inject({
          method: "PUT",
          url: `/api/kos/${id}`,
          headers: { authorization: `Bearer ${w.sitzung.experte}` },
          payload: {
            action: "revise",
            changes: { statement: `Frisch revidierte Seite ${geändert}` },
            expectedVersion: 1,
          },
        });
        expect(r.statusCode, r.body).toBe(200);
        await w.services.aiCheckWorker?.idle();
      }
      const befund = await w.services.overlaps.createAuto(
        {
          koA: a.id,
          koB: b.id,
          koAVersion: a.version,
          koBVersion: b.version,
          relation: "teilweise",
          aspects: [],
          eigenanteilA: "",
          eigenanteilB: "",
          recommendation: "zusammenfuehren_pruefen",
        },
        { trigger: "manual", method: "deterministic", lexicalScore: 0.8 },
      );
      const vorherA = await w.repos.koRepo.findById(a.id);
      const vorherB = await w.repos.koRepo.findById(b.id);
      const vorherBefund = await w.repos.overlapRepo.findById(befund.id);
      const auditVorher = await w.services.audit.list({});
      const aktuellerLeser = vi.spyOn(w.services.ko, "get");
      const r = await w.app.inject({
        method: "POST",
        url: `/api/duplicates/${befund.id}/merge`,
        headers: { authorization: `Bearer ${w.sitzung.controller}` },
        payload: {
          fuehrend: { id: a.id, version: vorherA!.version },
          aufgehend: { id: b.id, version: vorherB!.version },
          titel: "fuehrend",
          kernaussage: "aufgehend",
          bedingungen: [],
          massnahmen: [],
          quellen: [],
          bestaetigt: true,
        },
      });
      expect(r.statusCode, r.body).toBe(geändert === "aktuell" ? 200 : 404);
      if (geändert === "aktuell") {
        expect((await w.repos.koRepo.findById(a.id))?.version).toBe(a.version + 1);
        expect((await w.repos.koRepo.findById(b.id))?.mergedInto?.koId).toBe(a.id);
        expect((await w.repos.overlapRepo.findById(befund.id))?.resolution?.reason).toBe("merged");
      } else {
        // Auch kein Lese-GC auf einem fremden Client: die Absage schreibt gar nichts.
        expect(aktuellerLeser).not.toHaveBeenCalled();
        expect(await w.repos.koRepo.findById(a.id)).toEqual(vorherA);
        expect(await w.repos.koRepo.findById(b.id)).toEqual(vorherB);
        expect(await w.repos.overlapRepo.findById(befund.id)).toEqual(vorherBefund);
        expect(await w.services.audit.list({})).toEqual(auditVorher);
        expect(await w.services.ko.searchProjectionOf(a.id, vorherA!.version + 1)).toBeUndefined();
      }
    },
  );
});
