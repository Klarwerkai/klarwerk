// WP-D7b/c (bens D7b-ROT-Fix): der ECHTE Submit-Kostentreiber. Uploads PARALLEL (Phase A), KO-Mutationen
// STRIKT SERIELL (Phase B) — sonst CAS-STALE_WRITE durch Selbst-Konkurrenz am selben KO. Getestet: Uploads
// laufen nebenläufig, attach/add-source NIE überlappend; Original-Upload höchstens EINMAL (Ref-Cache);
// echte Stufen-Transition uploading→linking; ehrlicher Byte-Text; Busy-Wortlaut „Einreichung". Der
// harte CAS-Vertragstest (echtes Repo/Service) liegt in wp-d7c-submit-serialization.test.ts.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import {
  type AttachmentUploadApi,
  type OriginalRefCache,
  estimateDataUrlBytes,
  finalizeCaptureSubmit,
} from "../../apps/web/src/lib/captureAttachments";
import {
  FRONT_DOOR_STRUCTURE_INPUT_MAX_CHARS,
  buildFrontDoorStructureInput,
} from "../../apps/web/src/lib/captureFrontDoor";

function readSource(rel: string): string {
  return readFileSync(resolve(process.cwd(), rel), "utf8");
}

// Instrumentierte API: getrennte Nebenläufigkeits-Spitzen für UPLOADS (dürfen parallel sein) und für
// KO-WRITES (attach/add-source — dürfen NIE überlappen). `doWrite` teilt DENSELBEN Write-Zähler, damit
// auch Queue-/Pending-Quellen in die Serialitäts-Prüfung eingehen. `writeOrder` hält die Reihenfolge fest.
function tracker() {
  const s = {
    uploads: 0,
    uploadInFlight: 0,
    maxUploadConcurrent: 0,
    writeInFlight: 0,
    maxWriteConcurrent: 0,
    writeOrder: [] as string[],
  };
  async function doWrite(label: string): Promise<void> {
    s.writeInFlight += 1;
    s.maxWriteConcurrent = Math.max(s.maxWriteConcurrent, s.writeInFlight);
    s.writeOrder.push(label);
    await new Promise((r) => setTimeout(r, 5));
    s.writeInFlight -= 1;
  }
  const api: AttachmentUploadApi = {
    async upload(input) {
      s.uploads += 1;
      s.uploadInFlight += 1;
      s.maxUploadConcurrent = Math.max(s.maxUploadConcurrent, s.uploadInFlight);
      await new Promise((r) => setTimeout(r, 5));
      s.uploadInFlight -= 1;
      return { id: `obj-${s.uploads}`, size: input.data.length };
    },
    async attach(_koId, attachment) {
      await doWrite(`attach:${attachment.name}`);
      return {};
    },
  };
  return { s, api, doWrite };
}

describe("WP-D7c Rot-Fix 1: Phase A parallel, Phase B strikt seriell", () => {
  it("lädt Objekte NEBENLÄUFIG hoch, schreibt KO-Mutationen aber NIE überlappend", async () => {
    const t = tracker();
    const cache: OriginalRefCache = { ref: null };
    const result = await finalizeCaptureSubmit({
      koId: "ko1",
      attachments: [
        { name: "a.png", mime: "image/png", data: "data:image/png;base64,QQ==", kind: "image" },
        { name: "b.png", mime: "image/png", data: "data:image/png;base64,QQ==", kind: "image" },
      ],
      api: t.api,
      original: {
        doc: {
          name: "orig.pdf",
          mime: "application/pdf",
          data: "data:application/pdf;base64,QQ==",
        },
        cache,
      },
      queueSource: { name: "quelle.pdf", run: () => t.doWrite("queueSource") },
      pendingSources: async () => {
        await t.doWrite("pendingSources");
        return { attached: 1, failed: [] };
      },
    });
    // Phase A: 3 Objekte (2 Anhänge + 1 Original) — parallel hochgeladen.
    expect(t.s.uploads).toBe(3);
    expect(t.s.maxUploadConcurrent).toBeGreaterThan(1);
    // Phase B: attach/add-source liefen NIE gleichzeitig (max. 1 Write in flight) — inkl. Quellen.
    expect(t.s.maxWriteConcurrent).toBe(1);
    // Kein zweiter Write startet vor Ende des ersten: 5 Writes in fester Reihenfolge, ohne Verschachtelung.
    expect(t.s.writeOrder).toEqual([
      "attach:a.png",
      "attach:b.png",
      "attach:orig.pdf",
      "queueSource",
      "pendingSources",
    ]);
    // attached zählt 2 Anhänge + Original.
    expect(result.attached).toBe(3);
    expect(result.failed).toEqual([]);
  });

  it("merged Teilfehler ehrlich (Anhang-Upload-Fehler + Original-Attach-Fehler + Quellen-Fehler)", async () => {
    const api: AttachmentUploadApi = {
      upload: async (input) => {
        if (input.name === "a.png") {
          throw new Error("upload kaputt");
        }
        return { id: `obj-${input.name}`, size: 1 };
      },
      attach: async (_koId, attachment) => {
        if (attachment.name === "orig.pdf") {
          throw new Error("attach kaputt");
        }
        return {};
      },
    };
    const cache: OriginalRefCache = { ref: null };
    const result = await finalizeCaptureSubmit({
      koId: "ko1",
      attachments: [
        { name: "a.png", mime: "image/png", data: "data:image/png;base64,QQ==", kind: "image" },
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
        name: "quelle.pdf",
        run: async () => {
          throw new Error("add-source kaputt");
        },
      },
      pendingSources: async () => ({ attached: 0, failed: ["extern-1"] }),
    });
    expect(result.attached).toBe(0);
    const names = result.failed.map((f) => f.name).sort();
    expect(names).toEqual(["a.png", "extern-1", "orig.pdf", "quelle.pdf"]);
  });

  it("echte Stufen-Transition: onPhase feuert uploading VOR linking", async () => {
    const t = tracker();
    const phases: string[] = [];
    await finalizeCaptureSubmit({
      koId: "ko1",
      attachments: [
        { name: "a.png", mime: "image/png", data: "data:image/png;base64,QQ==", kind: "image" },
      ],
      api: t.api,
      onPhase: (phase) => phases.push(phase),
    });
    expect(phases).toEqual(["uploading", "linking"]);
  });

  it("greift der Ref-Cache, wird das Original NICHT erneut hochgeladen (uploaded=false)", async () => {
    const t = tracker();
    const cache: OriginalRefCache = { ref: { id: "orig-cached", size: 10 } };
    const result = await finalizeCaptureSubmit({
      koId: "ko2",
      attachments: [],
      api: t.api,
      original: {
        doc: {
          name: "orig.pdf",
          mime: "application/pdf",
          data: "data:application/pdf;base64,QQ==",
        },
        cache,
      },
    });
    // Kein Upload (Cache-Treffer), aber der Attach am zweiten KO passiert trotzdem.
    expect(t.s.uploads).toBe(0);
    expect(result.attached).toBe(1);
    expect(result.failed).toEqual([]);
  });
});

describe("WP-D7b Rot-Fix 1: estimateDataUrlBytes", () => {
  it("schätzt die reale Objektgröße aus der base64-Daten-URL (ohne Padding-Überzählung)", () => {
    // 4 base64-Zeichen = 3 Bytes; "QQ==" = 1 Byte.
    expect(estimateDataUrlBytes("data:image/png;base64,QQ==")).toBe(1);
    expect(estimateDataUrlBytes("data:text/plain;base64,QUJDRA==")).toBe(4); // "ABCD"
    // Nicht-base64 → 0 (kein Rätselraten).
    expect(estimateDataUrlBytes("/api/objects/x/raw")).toBe(0);
  });
});

describe("WP-D7b Rot-Fix 1: Source-Pins Submit-Pfad", () => {
  const capture = () => readSource("apps/web/src/pages/Capture.tsx");

  it("der Submit nutzt finalizeCaptureSubmit (zwei Phasen) und instrumentiert die Phasen", () => {
    const src = capture();
    expect(src).toContain("finalizeCaptureSubmit({");
    expect(src).toContain("logSubmitPhase(");
    expect(src).toContain("performance.now()");
    // WP-D7c: das Original geht als Daten+Ref-Cache in den Finalizer (Upload höchstens einmal, Phase A).
    expect(src).toContain("fileOriginalRef.current");
    expect(src).toContain("cache: fileOriginalRef.current");
    // Die KO-Mutationen wickelt der Finalizer seriell ab (Phase B) — der Submit selbst ruft kein
    // attach/add-source mehr parallel (kein direkter attachOriginalDocument-Aufruf im Submit-Pfad).
    expect(src).not.toContain("attachOriginalDocument(");
  });

  it("mehrstufiger Fortschritts-Text existiert DE/EN/NL und trägt die Upload-Größe", () => {
    for (const lng of ["de", "en", "nl"]) {
      for (const key of [
        "capture.submitStageCreating",
        "capture.submitStageUploading",
        "capture.submitStageLinking",
      ]) {
        expect(
          String(i18n.getResource(lng, "translation", key)).length,
          `${lng}:${key}`,
        ).toBeGreaterThan(0);
      }
    }
    // Die Upload-Stufe interpoliert die Größe.
    expect(String(i18n.getResource("de", "translation", "capture.submitStageUploading"))).toContain(
      "{{mb}}",
    );
  });

  it("Busy-Wortlaut ehrlich: Einreichung/submission/indiening statt Freigabe/release/vrijgave", () => {
    const de = String(i18n.getResource("de", "translation", "capture.submitBusy"));
    const en = String(i18n.getResource("en", "translation", "capture.submitBusy"));
    const nl = String(i18n.getResource("nl", "translation", "capture.submitBusy"));
    expect(de).toContain("Einreichung");
    expect(de).not.toContain("Freigabe");
    expect(en).toContain("submission");
    expect(en).not.toContain("release");
    expect(nl).toContain("indiening");
    expect(nl).not.toContain("vrijgave");
  });
});

describe("WP-D7b Klein-Fix 3: codepoint-bewusste Prompt-Kappung", () => {
  it("trennt kein Surrogatpaar und überschreitet die Konstante inkl. Suffix nie", () => {
    // 'x' + viele Emojis: die Budget-Grenze fällt MITTEN in ein Surrogatpaar (ungerader Offset).
    const input = `x${"😀".repeat(7000)}`;
    const out = buildFrontDoorStructureInput({ title: "", bodyHtml: `<p>${input}</p>` });
    // Gesamtlänge (inkl. „[…]") niemals über der Konstante.
    expect(out.length).toBeLessThanOrEqual(FRONT_DOOR_STRUCTURE_INPUT_MAX_CHARS);
    expect(out.endsWith("[…]")).toBe(true);
    // Kein einzelnes (getrenntes) Surrogat: weder ein hohes ohne folgendes tiefes …
    expect(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/.test(out)).toBe(false);
    // … noch ein tiefes ohne vorangehendes hohes.
    expect(/(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(out)).toBe(false);
  });
});
