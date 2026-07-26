import { describe, expect, it, vi } from "vitest";
import i18n from "../../apps/web/src/i18n";
import {
  ATTACHMENT_RECOVERY_KEYS,
  type AttachmentUploadApi,
  type AttachmentUploadItem,
  classifyUploadError,
  uploadAttachments,
} from "../../apps/web/src/lib/captureAttachments";

// SCRUM-374 / AG-02-SESSION: robuster Anhang-Upload — Teilfehler kippen den Save nicht, werden ehrlich
// gesammelt; kein Attach ohne erfolgreichen Upload (kein Fake-objectId). DOM-frei/testbar über eine
// injizierte API.
describe("SCRUM-374: uploadAttachments", () => {
  const img: AttachmentUploadItem = {
    name: "skizze.png",
    mime: "image/png",
    data: "data:image/png;base64,AAAA",
    kind: "image",
    thumbnail: "data:image/png;base64,thumb",
  };
  const doc: AttachmentUploadItem = {
    name: "handbuch.pdf",
    mime: "application/pdf",
    data: "data:application/pdf;base64,JVBER",
    kind: "document",
  };

  function okApi(): AttachmentUploadApi {
    return {
      upload: vi.fn(async (i) => ({ id: `obj-${i.name}`, size: 10 })),
      attach: vi.fn(async () => ({})),
    };
  }

  it("alle erfolgreich → attached=N, keine Fehler; Upload UND Attach je Datei aufgerufen", async () => {
    const api = okApi();
    const res = await uploadAttachments("ko-1", [img, doc], api);
    expect(res).toEqual({ attached: 2, failed: [], hasFailures: false });
    expect(api.upload).toHaveBeenCalledTimes(2);
    expect(api.attach).toHaveBeenCalledTimes(2);
  });

  it("leere Liste → nichts hochgeladen, keine Fehler", async () => {
    const api = okApi();
    const res = await uploadAttachments("ko-1", [], api);
    expect(res).toEqual({ attached: 0, failed: [], hasFailures: false });
    expect(api.upload).not.toHaveBeenCalled();
  });

  it("Upload-Fehler → Datei landet in failed(reason=upload) und wird NICHT attached (kein Fake-objectId)", async () => {
    const attach = vi.fn(async () => ({}));
    const api: AttachmentUploadApi = {
      upload: vi.fn(async (i) => {
        if (i.name === "handbuch.pdf") {
          throw new Error("upload-500");
        }
        return { id: `obj-${i.name}`, size: 5 };
      }),
      attach,
    };
    const res = await uploadAttachments("ko-1", [img, doc], api);
    expect(res.attached).toBe(1);
    expect(res.failed).toEqual([{ name: "handbuch.pdf", reason: "upload" }]);
    expect(res.hasFailures).toBe(true);
    // Attach nur für das erfolgreich hochgeladene Bild — NICHT für die fehlgeschlagene Datei.
    expect(attach).toHaveBeenCalledTimes(1);
    expect(attach).toHaveBeenCalledWith(
      "ko-1",
      expect.objectContaining({ objectId: "obj-skizze.png" }),
    );
  });

  it("Attach-Fehler → Datei landet in failed(reason=attach), andere bleiben erfolgreich", async () => {
    const api: AttachmentUploadApi = {
      upload: vi.fn(async (i) => ({ id: `obj-${i.name}`, size: 5 })),
      attach: vi.fn(async (_koId, a) => {
        if (a.name === "skizze.png") {
          throw new Error("attach-409");
        }
        return {};
      }),
    };
    const res = await uploadAttachments("ko-1", [img, doc], api);
    expect(res.attached).toBe(1);
    expect(res.failed).toEqual([{ name: "skizze.png", reason: "attach" }]);
  });

  it("ein Teilfehler kippt den Gesamt-Save NICHT (Promise resolved, kein throw)", async () => {
    const api: AttachmentUploadApi = {
      upload: vi.fn(async () => {
        throw new Error("boom");
      }),
      attach: vi.fn(async () => ({})),
    };
    await expect(uploadAttachments("ko-1", [img, doc], api)).resolves.toMatchObject({
      attached: 0,
      hasFailures: true,
    });
  });

  it("Recovery-Copy ist DE und EN vorhanden und ehrlich (KO offen gespeichert, später ergänzen, Validierung entscheidet)", () => {
    for (const key of Object.values(ATTACHMENT_RECOVERY_KEYS)) {
      for (const lng of ["de", "en"]) {
        expect(String(i18n.getResource(lng, "translation", key) ?? "").length).toBeGreaterThan(0);
      }
    }
    expect(
      String(i18n.getResource("de", "translation", ATTACHMENT_RECOVERY_KEYS.body) ?? ""),
    ).toMatch(/offen gespeichert|später|Validierung entscheidet/i);
    expect(
      String(i18n.getResource("en", "translation", ATTACHMENT_RECOVERY_KEYS.body) ?? ""),
    ).toMatch(/saved|later|review decides/i);
  });
});

// WP-D2 („Original ist heilig"): die Quelldatei des Datei-Imports wird als Anhang mitgeführt — genau
// EIN Upload je Datei (Cache über mehrere Ziel-KOs der Punkte-Queue), ehrliche Fehlergründe inkl.
// „zu groß" (Route-bodyLimit 413 bzw. Server-Größenmeldung).
// AUFTRAG-mega18 Block A-3: `attachOriginalDocument` ist ENTFALLEN — der Griff „Original hochladen
// UND ans KO hängen" existiert nicht mehr, weil das BINDEN jetzt die Verbund-Operation macht (ein
// Schreibvorgang, gemeinsam mit Belegen und Inhalt). Seine drei Ablauf-Tests sind mit ihm entfallen;
// die Fehler-KLASSIFIKATION bleibt und wird weiter geprüft (sie trägt jetzt den Upload in Capture
// und im KO-Detail).
describe("WP-D2: classifyUploadError + ehrliche Upload-Fehlergründe", () => {
  it("classifyUploadError: 413/Größenmeldungen → too-large, alles andere → upload", () => {
    expect(classifyUploadError({ status: 413 })).toBe("too-large");
    expect(classifyUploadError(new Error("Objekt zu groß."))).toBe("too-large");
    expect(classifyUploadError(new Error("Request body is larger than the limit"))).toBe(
      "too-large",
    );
    expect(classifyUploadError(new Error("network down"))).toBe("upload");
    expect(classifyUploadError(undefined)).toBe("upload");
  });

  it("„zu groß“-Copy ist DE/EN/NL vorhanden und nennt die erhaltene Text-Übernahme", () => {
    for (const key of ["capture.attachTooLarge", "capture.originalAttachFailed"]) {
      for (const lng of ["de", "en", "nl"]) {
        expect(
          String(i18n.getResource(lng, "translation", key) ?? "").length,
          `${lng}:${key}`,
        ).toBeGreaterThan(0);
      }
    }
    expect(String(i18n.getResource("de", "translation", "capture.attachTooLarge"))).toMatch(
      /zu groß.*Text-Import bleibt erhalten/,
    );
    expect(String(i18n.getResource("en", "translation", "capture.attachTooLarge"))).toMatch(
      /too large.*text import is kept/,
    );
    expect(String(i18n.getResource("nl", "translation", "capture.attachTooLarge"))).toMatch(
      /te groot.*tekstimport blijft behouden/,
    );
  });
});
