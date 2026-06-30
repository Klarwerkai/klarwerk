import { describe, expect, it } from "vitest";
import type { AnswerResult, KnowledgeObject } from "../../apps/web/src/api/types";
import { answerStatus, sourceRefs } from "../../apps/web/src/lib/askView";
import { applyBodyTemplate } from "../../apps/web/src/lib/bodyTemplates";
import { attachmentContext } from "../../apps/web/src/lib/editorAttachmentContext";
import { koOverview } from "../../apps/web/src/lib/koOverview";
import { useReadiness } from "../../apps/web/src/lib/useReadiness";
import { buildApp, buildServices } from "../../services/app/src/build-app";

// SCRUM-350: Evidence-/Attachment-Härtung als zusammenhängender Beta-Fluss, runtime-nah über die ECHTEN
// HTTP-Routen (Object-Store + attach + add-source + evidence) und die ECHTEN Anzeige-Helfer
// (koOverview, attachmentContext, askView). Kernhärtung: Bilder/Dateien/Quellen sind KONTEXT/BELEG und
// werden sichtbar geführt, ERSETZEN aber NICHT Status/Trust/Validierung. Ein KO mit reichlich Evidence
// bleibt offen/ungeprüft, bis es echt validiert ist; erst danach ist es gesichert/quellengebunden nutzbar.
// Keine Fake-Quelle, keine Auto-Validierung, kein neues Upload-/Object-Store-System.
const PNG_DATA_URL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
const PDF_DATA_URL = "data:application/pdf;base64,JVBERi0xLjQK"; // "%PDF-1.4" — Metadaten-Speicherung

describe("SCRUM-350: Evidence & Attachments → Review → Use E2E (HTTP + Object-Store + FE-Helfer)", () => {
  type App = ReturnType<typeof buildApp>;

  async function login(app: App, email: string, password: string) {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email, password },
    });
    return { authorization: `Bearer ${res.json().token}` };
  }

  const getKo = (app: App, headers: Record<string, string>, id: string) =>
    app.inject({ method: "GET", url: `/api/kos/${id}`, headers });

  const putObject = (
    app: App,
    headers: Record<string, string>,
    name: string,
    mime: string,
    data: string,
  ) => app.inject({ method: "POST", url: "/api/objects", headers, payload: { name, mime, data } });

  const ask = (app: App, headers: Record<string, string>, question: string) =>
    app.inject({ method: "POST", url: "/api/ask", headers, payload: { question } });

  it("Wissen mit Bild/Datei/Quelle bleibt trotz Evidence offen/ungeprüft bis zur echten Validierung", async () => {
    const app = buildApp(buildServices());
    await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { name: "Admin", email: "a@x.de", password: "secret123" },
    });
    const admin = await login(app, "a@x.de", "secret123");

    // 1) KO mit strukturiertem Studio-Body, eindeutiges Stichwort „Förderband FB12".
    const created = await app.inject({
      method: "POST",
      url: "/api/kos",
      headers: admin,
      payload: {
        title: "Förderband FB12 Riemen spannen",
        statement: "Den Riemen des Förderbands FB12 nach Herstellervorgabe spannen.",
        bodyHtml: applyBodyTemplate("", "procedure", "de"),
        type: "best_practice",
        category: "Anlage 3",
        neededValidations: 1,
      },
    });
    expect(created.statusCode).toBe(201);
    const id = created.json().id as string;
    expect(created.json().status).toBe("offen");

    // 2) Bild- und Datei-Original in den Object-Store legen (nur Metadaten-Refs).
    const imgRef = await putObject(app, admin, "riemen-skizze.png", "image/png", PNG_DATA_URL);
    const pdfRef = await putObject(
      app,
      admin,
      "herstellervorgabe.pdf",
      "application/pdf",
      PDF_DATA_URL,
    );
    expect(imgRef.statusCode).toBe(201);
    expect(pdfRef.statusCode).toBe(201);
    const imageObjectId = imgRef.json().id as string;
    const fileObjectId = pdfRef.json().id as string;

    // 3) Beide als Anhang referenzieren (objectId → erzeugt Attachment-Evidence).
    await app.inject({
      method: "PUT",
      url: `/api/kos/${id}`,
      headers: admin,
      payload: {
        action: "attach",
        attachment: { name: "riemen-skizze.png", mime: "image/png", objectId: imageObjectId },
      },
    });
    await app.inject({
      method: "PUT",
      url: `/api/kos/${id}`,
      headers: admin,
      payload: {
        action: "attach",
        attachment: {
          name: "herstellervorgabe.pdf",
          mime: "application/pdf",
          objectId: fileObjectId,
        },
      },
    });

    // 4) Externe Quelle anfügen — Quelle ist KONTEXT/Beleg, nie peer-validiert.
    await app.inject({
      method: "PUT",
      url: `/api/kos/${id}`,
      headers: admin,
      payload: {
        action: "add-source",
        source: {
          label: "Herstellerhandbuch FB12 S. 8",
          url: "https://example.org/fb12",
          excerpt: "Riemenspannung 0,5 % Vordehnung",
        },
      },
    });

    // 5) Evidence-Records sind real sichtbar: zwei Anhänge + eine Quelle.
    const evidence = (
      await app.inject({ method: "GET", url: `/api/kos/${id}/evidence`, headers: admin })
    ).json() as { kind: string; objectId?: string; label?: string }[];
    expect(evidence.filter((e) => e.kind === "attachment")).toHaveLength(2);
    expect(evidence.filter((e) => e.kind === "source")).toHaveLength(1);
    expect(evidence.some((e) => e.objectId === imageObjectId)).toBe(true);

    // 6) KO mit Evidence laden. Externe Quelle bleibt NICHT peer-validiert.
    const withEvidence = (await getKo(app, admin, id)).json() as KnowledgeObject;
    expect(withEvidence.attachments).toHaveLength(2);
    expect(withEvidence.sources?.[0]?.peerValidated).toBe(false);
    expect(withEvidence.sources?.[0]?.kind).toBe("external");

    // 7) KERN: Evidence ist sichtbar (hasEvidence/Counts), HEBT aber Status/Trust/Nutzbarkeit NICHT an.
    const ovBefore = koOverview(withEvidence);
    expect(ovBefore.attachmentCount).toBe(2);
    expect(ovBefore.sourceCount).toBe(1);
    expect(ovBefore.hasEvidence).toBe(true);
    expect(ovBefore.status).toBe("offen");
    expect(ovBefore.trust).toBe(0);
    expect(ovBefore.usability).toBe("needs-work"); // Evidence ≠ Validierung
    expect(useReadiness(ovBefore.usability).usability).not.toBe("ready");

    // 8) Attachment-Kontext-Helfer trennt Bild (inline einfügbar) von Datei (bleibt Anhang/Evidence).
    const ctx = attachmentContext(withEvidence.attachments ?? []);
    expect(ctx).toMatchObject({ imageCount: 1, fileCount: 1, total: 2, hasAny: true });

    // 9) USE VOR Validierung: trotz Evidence ehrlich ungeprüft.
    const askBefore = await ask(app, admin, "Wie wird der Riemen am Förderband FB12 gespannt?");
    const beforeResult = askBefore.json().result as AnswerResult;
    expect(beforeResult.answered).toBe(true);
    expect(beforeResult.sources).toContain(id);
    expect(beforeResult.knowledgeClass).not.toBe("gesichert");
    expect(answerStatus(beforeResult.knowledgeClass).key).toBe("unverified");

    // 10) Echte Validierung (needed=1 → ein Up) → validiert/Trust 100. Evidence bleibt erhalten.
    await app.inject({
      method: "PUT",
      url: `/api/kos/${id}`,
      headers: admin,
      payload: { action: "rate", verdict: "up" },
    });
    const validated = (await getKo(app, admin, id)).json() as KnowledgeObject;
    expect(validated.status).toBe("validiert");
    expect(validated.trust).toBe(100);
    expect(validated.attachments).toHaveLength(2); // Anhänge über Validierung erhalten
    const ovAfter = koOverview(validated);
    expect(ovAfter.usability).toBe("ready");
    expect(ovAfter.hasEvidence).toBe(true);

    // 11) USE NACH Validierung: gesichert + quellengebunden auf genau dieses (belegte) KO.
    const askAfter = await ask(app, admin, "Wie wird der Riemen am Förderband FB12 gespannt?");
    const afterBody = askAfter.json();
    const afterResult = afterBody.result as AnswerResult;
    expect(afterResult.knowledgeClass).toBe("gesichert");
    expect(afterResult.sources).toEqual([id]);
    expect(answerStatus(afterResult.knowledgeClass).key).toBe("verified");
    expect(afterBody.gap).toBeNull();
    const refAfter = sourceRefs(afterResult.sources, [validated])[0];
    expect(refAfter?.validated).toBe(true);
    expect(refAfter?.usability).toBe("ready");
  });
});
