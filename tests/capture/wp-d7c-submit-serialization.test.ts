// WP-D7c (bens D7b-ROT-Fix): der HARTE CAS-Vertragstest. Anders als der Latenz-/Nebenläufigkeits-Test
// (wp-d7b-submit-latency.test.ts, Fake-API) läuft dieser gegen das ECHTE InMemoryKoRepo + KoService —
// kein Fake, kein No-op. Er pinnt (a) den CAS-Vertrag: zwei PARALLELE KO-Mutationen am selben KO scheitern
// mit STALE_WRITE (deshalb MUSS Phase B seriell sein), und (b) dass der korrigierte, serialisierte
// Finalizer ALLE Mutationen ohne STALE_WRITE landet und das Original genau EINMAL hochlädt.
import { describe, expect, it } from "vitest";
import {
  type AttachmentUploadApi,
  type OriginalRefCache,
  capAttachmentSelection,
  finalizeCaptureSubmit,
} from "../../apps/web/src/lib/captureAttachments";
import type { PendingSource } from "../../apps/web/src/lib/captureSources";
import { attachPendingSources } from "../../apps/web/src/lib/captureSources";
import { InMemoryKoRepo, KoError, KoService } from "../../services/knowledge-object";

function makeService(): KoService {
  return new KoService({ repo: new InMemoryKoRepo() });
}

function createKo(svc: KoService) {
  return svc.create({
    title: "Aussage",
    statement: "Inhalt.",
    type: "best_practice",
    category: "Anlage 1",
    author: "anna",
    neededValidations: 2,
  });
}

describe("WP-D7c: CAS-Vertrag (echtes Repo/Service)", () => {
  it("Repro-Pin: zwei PARALLELE Mutationen am selben KO → mindestens ein STALE_WRITE", async () => {
    const svc = makeService();
    const ko = await createKo(svc);
    // Genau das, was die D7b-Parallelisierung tat: zwei gleichzeitige addAttachment am selben KO. Beide
    // lesen dieselbe rowVersion, beide schreiben per CAS → der zweite Write kollidiert.
    const results = await Promise.allSettled([
      svc.addAttachment(ko.id, "anna", { name: "a.png", mime: "image/png", objectId: "obj-a" }),
      svc.addAttachment(ko.id, "anna", { name: "b.png", mime: "image/png", objectId: "obj-b" }),
    ]);
    const rejected = results.filter((r): r is PromiseRejectedResult => r.status === "rejected");
    expect(rejected.length).toBeGreaterThanOrEqual(1);
    // Und zwar GENAU der CAS-Fehler — das ist die Begründung, warum Phase B seriell sein muss.
    for (const r of rejected) {
      expect(r.reason).toBeInstanceOf(KoError);
      expect((r.reason as KoError).code).toBe("STALE_WRITE");
    }
    // Dasselbe gilt für zwei parallele add-source-Aufrufe — exakt derselbe CAS-Fehler (WP-D7d, bens GELB).
    const ko2 = await createKo(svc);
    const sourceResults = await Promise.allSettled([
      svc.addSource(ko2.id, "anna", { label: "Quelle A" }),
      svc.addSource(ko2.id, "anna", { label: "Quelle B" }),
    ]);
    const sourceRejected = sourceResults.filter(
      (r): r is PromiseRejectedResult => r.status === "rejected",
    );
    expect(sourceRejected.length).toBeGreaterThanOrEqual(1);
    for (const r of sourceRejected) {
      expect(r.reason).toBeInstanceOf(KoError);
      expect((r.reason as KoError).code).toBe("STALE_WRITE");
    }
  });

  it("der serialisierte Finalizer landet ALLE Mutationen ohne STALE_WRITE, Original genau einmal", async () => {
    const svc = makeService();
    const ko = await createKo(svc);

    let uploads = 0;
    // Object-Store-Fake (zählt Uploads) + attach/add-source gegen den ECHTEN Service.
    const api: AttachmentUploadApi = {
      async upload(input) {
        uploads += 1;
        return { id: `obj-${uploads}`, size: input.data.length };
      },
      async attach(koId, attachment) {
        return svc.addAttachment(koId, "anna", {
          name: attachment.name,
          mime: attachment.mime,
          objectId: attachment.objectId,
          ...(attachment.thumbnail ? { thumbnail: attachment.thumbnail } : {}),
          ...(attachment.size != null ? { size: attachment.size } : {}),
        });
      },
    };
    const cache: OriginalRefCache = { ref: null };
    const pending: PendingSource[] = [{ label: "extern-1", url: "https://example.org/a" }];

    const result = await finalizeCaptureSubmit({
      koId: ko.id,
      attachments: [
        { name: "a.png", mime: "image/png", data: "data:image/png;base64,QQ==", kind: "image" },
        { name: "b.png", mime: "image/png", data: "data:image/png;base64,QQ==", kind: "image" },
        {
          name: "doc.pdf",
          mime: "application/pdf",
          data: "data:application/pdf;base64,QQ==",
          kind: "document",
        },
      ],
      api,
      original: {
        doc: {
          name: "orig.pdf",
          mime: "application/pdf",
          data: "data:application/pdf;base64,QQ==",
        },
        cache,
      },
      queueSource: {
        name: "orig.pdf",
        run: async () => {
          await svc.addSource(ko.id, "anna", { label: "Quelle: orig.pdf" });
        },
      },
      pendingSources: () =>
        attachPendingSources(ko.id, pending, (koId, source) =>
          svc.addSource(koId, "anna", { label: source.label, url: source.url ?? null }),
        ),
    });

    // Kein einziger Teilfehler — die Serialisierung verhindert die Selbst-Konkurrenz.
    expect(result.failed).toEqual([]);
    // attached = 3 Anhänge + Original.
    expect(result.attached).toBe(4);
    // Original genau EINMAL hochgeladen (3 Anhänge + 1 Original = 4 Uploads insgesamt).
    expect(uploads).toBe(4);

    // Alles ist wirklich am KO gelandet.
    const saved = await svc.get(ko.id);
    expect(saved?.attachments?.map((a) => a.name).sort()).toEqual([
      "a.png",
      "b.png",
      "doc.pdf",
      "orig.pdf",
    ]);
    expect(saved?.sources?.map((s) => s.label).sort()).toEqual(["Quelle: orig.pdf", "extern-1"]);
  });
});

// WP-D7e (bens ROT-Fix): Slot-Reservierung fürs Original. Die attach-API erzwingt hier dieselbe Anzahl-
// Grenze wie die echte Route (ko-routes.ts: attachments.length >= maxAttachments → Ablehnung) über dem
// ECHTEN KoService — so wird der D2-Bruch (Original als neunter Anhang abgelehnt) produktnah sichtbar.
describe("WP-D7e: Original-Slot im Auswahl-Cap (echtes Repo/Service, Route-Limit)", () => {
  const MAX = 8;

  function limitEnforcingApi(svc: KoService): AttachmentUploadApi {
    let uploads = 0;
    return {
      async upload(input) {
        uploads += 1;
        return { id: `obj-${uploads}`, size: input.data.length };
      },
      async attach(koId, attachment) {
        // Spiegel der echten Route-Prüfung (SCRUM-421): Anzahl-Grenze VOR dem Service-Write.
        const current = await svc.get(koId);
        if ((current?.attachments?.length ?? 0) >= MAX) {
          throw new Error(`Maximal ${MAX} Anhänge je Objekt.`);
        }
        return svc.addAttachment(koId, "anna", {
          name: attachment.name,
          mime: attachment.mime,
          objectId: attachment.objectId,
          ...(attachment.size != null ? { size: attachment.size } : {}),
        });
      },
    };
  }

  function pngItem(name: string) {
    return { name, mime: "image/png", data: "data:image/png;base64,QQ==", kind: "image" as const };
  }
  const ORIGINAL = {
    name: "orig.pdf",
    mime: "application/pdf",
    data: "data:application/pdf;base64,QQ==",
  };

  it("mit Original: 8 gewählte → 7 akzeptiert, das Original landet als achter Anhang", async () => {
    const svc = makeService();
    const ko = await createKo(svc);
    const selected = Array.from({ length: 8 }, (_v, i) => pngItem(`f${i}.png`));
    // Auswahl-Cap wie in Capture: 0 vorhandene Anhänge, Limit 8, EIN Platz fürs Original reserviert.
    const { accepted, dropped } = capAttachmentSelection(selected, 0, MAX, 1);
    expect(accepted.length).toBe(7);
    expect(dropped).toBe(1);

    const result = await finalizeCaptureSubmit({
      koId: ko.id,
      attachments: accepted,
      api: limitEnforcingApi(svc),
      original: { doc: ORIGINAL, cache: { ref: null } },
    });
    // Kein Teilfehler, kein verwaistes Object — das Original ist der achte Anhang am KO.
    expect(result.failed).toEqual([]);
    expect(result.attached).toBe(8);
    const saved = await svc.get(ko.id);
    expect(saved?.attachments?.length).toBe(8);
    expect(saved?.attachments?.some((a) => a.name === "orig.pdf")).toBe(true);
  });

  it("Rot-Beweis: OHNE Reservierung füllen 8 Dateien alle Plätze und das Original wird abgelehnt", async () => {
    const svc = makeService();
    const ko = await createKo(svc);
    const selected = Array.from({ length: 8 }, (_v, i) => pngItem(`f${i}.png`));
    // Alte Cap-Ableitung (reservedCount 0): alle 8 kommen durch …
    const { accepted } = capAttachmentSelection(selected, 0, MAX, 0);
    expect(accepted.length).toBe(8);
    const result = await finalizeCaptureSubmit({
      koId: ko.id,
      attachments: accepted,
      api: limitEnforcingApi(svc),
      original: { doc: ORIGINAL, cache: { ref: null } },
    });
    // … und genau dann fehlt das Original: als neunter Attach an der Route-Grenze abgelehnt (D2-Bruch).
    expect(result.attached).toBe(8);
    expect(result.failed).toEqual([{ name: "orig.pdf", reason: "attach" }]);
    const saved = await svc.get(ko.id);
    expect(saved?.attachments?.some((a) => a.name === "orig.pdf")).toBe(false);
  });

  it("Gegenprobe ohne Original: alle 8 akzeptiert und angehängt", async () => {
    const svc = makeService();
    const ko = await createKo(svc);
    const selected = Array.from({ length: 8 }, (_v, i) => pngItem(`f${i}.png`));
    // Ohne Datei-Warteschlange/Original reserviert Capture keinen Platz.
    const { accepted, dropped } = capAttachmentSelection(selected, 0, MAX, 0);
    expect(accepted.length).toBe(8);
    expect(dropped).toBe(0);
    const result = await finalizeCaptureSubmit({
      koId: ko.id,
      attachments: accepted,
      api: limitEnforcingApi(svc),
    });
    expect(result.failed).toEqual([]);
    expect(result.attached).toBe(8);
  });

  it("die Reservierung gilt AUCH bei Ref-Cache-Treffer (Attach je KO passiert trotzdem)", async () => {
    const svc = makeService();
    const ko = await createKo(svc);
    // Original bereits hochgeladen (Cache-Treffer, z. B. zweiter Queue-KO) — der Attach kommt trotzdem.
    const cache: OriginalRefCache = { ref: { id: "obj-cached", size: 5 } };
    const selected = Array.from({ length: 8 }, (_v, i) => pngItem(`f${i}.png`));
    const { accepted } = capAttachmentSelection(selected, 0, MAX, 1);
    expect(accepted.length).toBe(7);
    const result = await finalizeCaptureSubmit({
      koId: ko.id,
      attachments: accepted,
      api: limitEnforcingApi(svc),
      original: { doc: ORIGINAL, cache },
    });
    expect(result.failed).toEqual([]);
    expect(result.attached).toBe(8);
    const saved = await svc.get(ko.id);
    expect(saved?.attachments?.some((a) => a.name === "orig.pdf")).toBe(true);
  });
});
