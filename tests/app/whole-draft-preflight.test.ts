// WP-D1e (bens ROT-Fix 2 + 3): kein verwaistes Object beim Größenabbruch und htmlOverflow als
// ehrlicher Vor-Upload-Abbruch. Der Ganzdokument-Save lädt das Original in den Object-Store und hängt
// es als Body-Link an. Der Upload legt die Datei UNWIDERRUFLICH ab — passiert er VOR der Größenprüfung,
// bleibt bei Überlauf ein verwaistes Object zurück (kein Entwurf referenziert es) und ein Retry lüde
// erneut hoch. Diese Tests belegen: (a) der Preflight bricht VOR dem Upload ab (0 Uploads); (b) ein
// Retry nutzt den Ref-Cache (kein Doppel-Upload); (c) htmlOverflow bricht ohne jeden Upload ab.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import type { DraftPayload } from "../../apps/web/src/api/types";
import { fileLinkHtml } from "../../apps/web/src/lib/bodyFileLink";
import type {
  OriginalDocument,
  OriginalRefCache,
  UploadedObjectRef,
} from "../../apps/web/src/lib/captureAttachments";
import {
  DRAFT_PAYLOAD_LIMIT_BYTES,
  DraftPayloadTooLargeError,
  draftPayloadWithinLimit,
  wholeDraftFitsWithObjectLink,
} from "../../apps/web/src/lib/captureFromFile";

// Spiegelt die Upload-Entscheidung der fileWholeDraft-mutationFn (Capture.tsx) 1:1 wider — dieselben
// öffentlichen Helfer, dieselbe Reihenfolge: htmlOverflow-Abbruch → Preflight VOR Upload → Ref-Cache-
// Reuse → finaler Guard. Der Upload wird gezählt, damit „0 Uploads" bzw. „kein Doppel-Upload" messbar ist.
async function runUploadGate(args: {
  payload: DraftPayload;
  original: OriginalDocument | null;
  cache: OriginalRefCache;
  htmlOverflow: boolean;
  upload: (o: OriginalDocument) => Promise<UploadedObjectRef>;
}): Promise<DraftPayload> {
  const { payload: base, original, cache, htmlOverflow, upload } = args;
  if (htmlOverflow) {
    throw new DraftPayloadTooLargeError();
  }
  if (original && !wholeDraftFitsWithObjectLink(base, original.name)) {
    throw new DraftPayloadTooLargeError();
  }
  let payload = base;
  if (original) {
    let ref = cache.ref;
    if (!ref) {
      ref = await upload(original);
      cache.ref = ref;
    }
    payload = {
      ...payload,
      bodyHtml: `${payload.bodyHtml ?? ""}${fileLinkHtml({ objectId: ref.id, name: original.name })}`,
    };
  }
  if (!draftPayloadWithinLimit(payload)) {
    throw new DraftPayloadTooLargeError();
  }
  return payload;
}

const ORIGINAL: OriginalDocument = {
  name: "grosses-dokument.docx",
  mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  data: "data:application/octet-stream;base64,AAAA",
};

// Payload knapp UNTER der Grenze, sodass schon ein reservierter Object-Link ihn darüber hebt.
function oversizedPayload(): DraftPayload {
  const filler = "x".repeat(DRAFT_PAYLOAD_LIMIT_BYTES - 200);
  return { title: "t", statement: "s", bodyHtml: filler, origin: "frontdoor" };
}

function smallPayload(): DraftPayload {
  return { title: "t", statement: "s", bodyHtml: "<p>kurzer Text</p>", origin: "frontdoor" };
}

describe("WP-D1e (Fix 2): Preflight VOR dem Upload — kein verwaistes Object", () => {
  it("wholeDraftFitsWithObjectLink erkennt einen Payload, der samt Link nicht mehr passt", () => {
    expect(wholeDraftFitsWithObjectLink(oversizedPayload(), ORIGINAL.name)).toBe(false);
    expect(wholeDraftFitsWithObjectLink(smallPayload(), ORIGINAL.name)).toBe(true);
  });

  it("Payload zu groß ⇒ objects.upload wird NULL-mal aufgerufen (kein verwaistes Object)", async () => {
    let uploadCalls = 0;
    const cache: OriginalRefCache = { ref: null };
    await expect(
      runUploadGate({
        payload: oversizedPayload(),
        original: ORIGINAL,
        cache,
        htmlOverflow: false,
        upload: async () => {
          uploadCalls += 1;
          return { id: "obj-1" };
        },
      }),
    ).rejects.toBeInstanceOf(DraftPayloadTooLargeError);
    expect(uploadCalls).toBe(0);
    // Kein Object abgelegt ⇒ der Cache bleibt leer (nichts zu kompensieren).
    expect(cache.ref).toBeNull();
  });

  it("Retry nach passendem Preflight lädt das Original NICHT doppelt hoch (Ref-Cache-Reuse)", async () => {
    let uploadCalls = 0;
    const cache: OriginalRefCache = { ref: null };
    const upload = async (): Promise<UploadedObjectRef> => {
      uploadCalls += 1;
      return { id: `obj-${uploadCalls}` };
    };
    // Erster Lauf: lädt einmal hoch und füllt den Cache.
    const first = await runUploadGate({
      payload: smallPayload(),
      original: ORIGINAL,
      cache,
      htmlOverflow: false,
      upload,
    });
    expect(uploadCalls).toBe(1);
    expect(cache.ref?.id).toBe("obj-1");
    expect(first.bodyHtml).toContain("/api/objects/obj-1/raw");
    // Retry (z. B. nach transientem drafts.create-Fehler): derselbe Cache ⇒ KEIN zweiter Upload.
    const second = await runUploadGate({
      payload: smallPayload(),
      original: ORIGINAL,
      cache,
      htmlOverflow: false,
      upload,
    });
    expect(uploadCalls).toBe(1);
    expect(second.bodyHtml).toContain("/api/objects/obj-1/raw");
  });
});

describe("WP-D1e (Fix 3): htmlOverflow bricht VOR dem Upload ab", () => {
  it("htmlOverflow ⇒ DraftPayloadTooLargeError ohne jeden Upload", async () => {
    let uploadCalls = 0;
    const cache: OriginalRefCache = { ref: null };
    await expect(
      runUploadGate({
        payload: smallPayload(),
        original: ORIGINAL,
        cache,
        htmlOverflow: true,
        upload: async () => {
          uploadCalls += 1;
          return { id: "obj-1" };
        },
      }),
    ).rejects.toBeInstanceOf(DraftPayloadTooLargeError);
    expect(uploadCalls).toBe(0);
    expect(cache.ref).toBeNull();
  });
});

describe("WP-D1e: Capture.tsx verdrahtet Preflight/htmlOverflow VOR dem Upload", () => {
  const captureSource = readFileSync(
    resolve(process.cwd(), "apps/web/src/pages/Capture.tsx"),
    "utf8",
  );

  it("der htmlOverflow-Abbruch steht VOR endpoints.objects.upload", () => {
    const overflowGuard = captureSource.indexOf("if (fileImageInfo?.htmlOverflow)");
    const preflight = captureSource.indexOf(
      "wholeDraftFitsWithObjectLink(payload, fileOriginal.name)",
    );
    const upload = captureSource.indexOf("endpoints.objects.upload({");
    expect(overflowGuard).toBeGreaterThan(-1);
    expect(preflight).toBeGreaterThan(-1);
    expect(upload).toBeGreaterThan(-1);
    // Reihenfolge im Ganzdokument-Save: htmlOverflow-Abbruch → Preflight → Upload.
    expect(overflowGuard).toBeLessThan(preflight);
    expect(preflight).toBeLessThan(upload);
  });

  it("der Upload ist durch den Ref-Cache abgesichert (kein Doppel-Upload beim Retry)", () => {
    // Der Upload läuft nur, wenn der Cache leer ist (if (!ref) … fileOriginalRef.current = { ref }).
    const gateStart = captureSource.indexOf("let ref = fileOriginalRef.current.ref;");
    expect(gateStart).toBeGreaterThan(-1);
    const guard = captureSource.indexOf("if (!ref) {", gateStart);
    const upload = captureSource.indexOf("endpoints.objects.upload({", gateStart);
    expect(guard).toBeGreaterThan(-1);
    expect(guard).toBeLessThan(upload);
  });
});
