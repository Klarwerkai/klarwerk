// WP-D7b (bens D7-Auflagen): der ECHTE Submit-Kostentreiber. (Rot-Fix 1) Original/Anhänge/Quellen laufen
// jetzt PARALLEL statt seriell; der Object-Upload des Originals läuft höchstens EINMAL (Ref-Cache);
// mehrstufiger, ehrlicher Fortschritts-Text (DE/EN/NL) mit Upload-Größe; Busy-Wortlaut „Einreichung" statt
// „Freigabe". (Klein-Fix 3) codepoint-bewusste Prompt-Kappung inkl. Suffix im Budget.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import {
  type AttachmentUploadApi,
  type OriginalRefCache,
  attachOriginalDocument,
  estimateDataUrlBytes,
  finalizeCaptureSubmit,
  uploadAttachments,
} from "../../apps/web/src/lib/captureAttachments";
import {
  FRONT_DOOR_STRUCTURE_INPUT_MAX_CHARS,
  buildFrontDoorStructureInput,
} from "../../apps/web/src/lib/captureFrontDoor";

function readSource(rel: string): string {
  return readFileSync(resolve(process.cwd(), rel), "utf8");
}

// Fake-Object-API mit Nebenläufigkeits-Zähler: misst, wie viele Uploads GLEICHZEITIG laufen.
function trackingApi(): AttachmentUploadApi & { uploads: number; maxConcurrent: number } {
  const state = { uploads: 0, maxConcurrent: 0, inFlight: 0 };
  return {
    uploads: 0,
    maxConcurrent: 0,
    async upload(input) {
      state.uploads += 1;
      state.inFlight += 1;
      state.maxConcurrent = Math.max(state.maxConcurrent, state.inFlight);
      // eine Mikro-/Makro-Pause, damit echte Parallelität sichtbar wird
      await new Promise((r) => setTimeout(r, 5));
      state.inFlight -= 1;
      this.uploads = state.uploads;
      this.maxConcurrent = state.maxConcurrent;
      return { id: `obj-${state.uploads}`, size: input.data.length };
    },
    async attach() {
      return {};
    },
  };
}

describe("WP-D7b Rot-Fix 1: finalizeCaptureSubmit läuft parallel", () => {
  it("führt Anhänge, Original und Quellen NEBENLÄUFIG aus (nicht seriell)", async () => {
    const api = trackingApi();
    const cache: OriginalRefCache = { ref: null };
    const result = await finalizeCaptureSubmit({
      attachments: () =>
        uploadAttachments(
          "ko1",
          [
            { name: "a.png", mime: "image/png", data: "data:image/png;base64,QQ==", kind: "image" },
            { name: "b.png", mime: "image/png", data: "data:image/png;base64,QQ==", kind: "image" },
          ],
          api,
        ),
      original: () =>
        attachOriginalDocument(
          "ko1",
          { name: "orig.pdf", mime: "application/pdf", data: "data:application/pdf;base64,QQ==" },
          api,
          cache,
        ),
      queueSource: async () => null,
      sources: async () => ({ attached: 0, failed: [] }),
    });
    // 3 Objekte (2 Anhänge + 1 Original). Liefen sie seriell, wäre maxConcurrent === 1.
    expect(api.uploads).toBe(3);
    expect(api.maxConcurrent).toBeGreaterThan(1);
    // attached zählt Anhänge (2) + Original (1); keine Fehler.
    expect(result.attached).toBe(3);
    expect(result.failed).toEqual([]);
  });

  it("merged Teilfehler ehrlich (Anhang-Upload-Fehler + Quellen-Fehler)", async () => {
    const api: AttachmentUploadApi = {
      upload: async () => {
        throw new Error("upload kaputt");
      },
      attach: async () => ({}),
    };
    const result = await finalizeCaptureSubmit({
      attachments: () =>
        uploadAttachments(
          "ko1",
          [{ name: "a.png", mime: "image/png", data: "data:image/png;base64,QQ==", kind: "image" }],
          api,
        ),
      queueSource: async () => ({ name: "quelle.pdf", reason: "attach" }),
      sources: async () => ({ attached: 0, failed: ["extern-1"] }),
    });
    expect(result.attached).toBe(0);
    const names = result.failed.map((f) => f.name).sort();
    expect(names).toEqual(["a.png", "extern-1", "quelle.pdf"]);
  });

  it("das Original wird über den Ref-Cache HÖCHSTENS EINMAL hochgeladen (mehrere Queue-KOs)", async () => {
    const api = trackingApi();
    const cache: OriginalRefCache = { ref: null };
    const original = {
      name: "orig.pdf",
      mime: "application/pdf",
      data: "data:application/pdf;base64,QQ==",
    };
    // Zwei aufeinanderfolgende Submits derselben Datei-Queue teilen den Cache.
    await attachOriginalDocument("ko1", original, api, cache);
    await attachOriginalDocument("ko2", original, api, cache);
    expect(api.uploads).toBe(1); // nur EIN Upload, zweiter KO referenziert dieselbe objectId
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

  it("der Submit nutzt den parallelen finalizeCaptureSubmit und instrumentiert die Phasen", () => {
    const src = capture();
    expect(src).toContain("finalizeCaptureSubmit({");
    expect(src).toContain("logSubmitPhase(");
    expect(src).toContain("performance.now()");
    // Der Object-Upload des Originals läuft über den Ref-Cache (höchstens einmal) — Pin wie D1e.
    expect(src).toContain("fileOriginalRef.current");
    // Nur EIN attachOriginalDocument-Aufruf im Submit-Pfad (kein Doppel-Upload).
    expect((src.match(/attachOriginalDocument\(/g) ?? []).length).toBe(1);
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
