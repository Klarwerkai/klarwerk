import { describe, expect, it } from "vitest";
import type { KnowledgeObject } from "../../apps/web/src/api/types";
import {
  editorFilesFromAttachments,
  fileLinkHtml,
  objectRawHref,
} from "../../apps/web/src/lib/bodyFileLink";
import { editorMediaGuide } from "../../apps/web/src/lib/editorAttachmentContext";
import { koOverview } from "../../apps/web/src/lib/koOverview";
import { buildApp, buildServices } from "../../services/app/src/build-app";

// SCRUM-373 / AG-02-SESSION / FR-STR-02: Der Session-Datei→Object-Store→Body-Link-Anschluss belegt über
// die ECHTEN HTTP-Routen (Object-Store + attach) und die ECHTEN FE-Helfer (editorFilesFromAttachments,
// bodyFileLink). Kernaussage:
//  - Eine Nicht-Bild-Session-Datei bekommt beim Speichern über die vorhandenen Endpunkte eine sichere
//    Objekt-Referenz (objectId) und ist DANACH im KO-Editor als sicherer Body-Link (/api/objects/:id/raw)
//    nutzbar — KEIN Legacy-data:-URL, kein Fremdschema.
//  - Bilder erscheinen NICHT in der Datei-Verlink-Liste (sie werden als Bild eingebettet).
//  - Eine Session-Datei OHNE objectId (vor dem Speichern) ist NICHT verlinkbar — kein Fake-Link.
//  - Evidence/Attachment ist Beleg — es macht das KO NICHT nutzbar/validiert.
const PDF_DATA_URL = "data:application/pdf;base64,JVBERi0xLjQK"; // "%PDF-1.4"

describe("SCRUM-373: Session File → Object-Store → Body-Link E2E (HTTP + FE-Helfer)", () => {
  type App = ReturnType<typeof buildApp>;

  async function login(app: App, email: string, password: string) {
    const res = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email, password },
    });
    return { authorization: `Bearer ${res.json().token}` };
  }

  it("Nicht-Bild-Datei wird nach Object-Store-Upload + Attach body-verlinkbar; Bild nicht; ohne objectId kein Fake-Link", async () => {
    const app = buildApp(buildServices());
    await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { name: "Admin", email: "a@x.de", password: "secret123" },
    });
    const admin = await login(app, "a@x.de", "secret123");

    // 1) KO anlegen (offen), Text-Kontext ist bereits im Statement — die Datei ist der Beleg.
    const created = await app.inject({
      method: "POST",
      url: "/api/kos",
      headers: admin,
      payload: {
        title: "Wartungsplan Pumpe P7",
        statement: "Wartungsintervalle laut Herstellerhandbuch für Pumpe P7.",
        type: "best_practice",
        category: "Anlage 7",
        neededValidations: 1,
      },
    });
    expect(created.statusCode).toBe(201);
    const id = created.json().id as string;
    expect(created.json().status).toBe("offen");

    // 2) Wie Capture beim Speichern: Nicht-Bild-Session-Datei in den Object-Store legen (kind document).
    const objRes = await app.inject({
      method: "POST",
      url: "/api/objects",
      headers: admin,
      payload: {
        name: "handbuch-p7.pdf",
        mime: "application/pdf",
        data: PDF_DATA_URL,
        kind: "document",
      },
    });
    expect(objRes.statusCode).toBe(201);
    const objectId = objRes.json().id as string;
    expect(objectId.length).toBeGreaterThan(0);

    // 3) Als Anhang referenzieren (erzeugt Attachment mit objectId am KO).
    const attached = await app.inject({
      method: "PUT",
      url: `/api/kos/${id}`,
      headers: admin,
      payload: {
        action: "attach",
        attachment: { name: "handbuch-p7.pdf", mime: "application/pdf", objectId },
      },
    });
    expect(attached.statusCode).toBe(200);

    // 4) KO laden — das Attachment trägt jetzt die sichere Objekt-Referenz.
    const ko = (await app
      .inject({ method: "GET", url: `/api/kos/${id}`, headers: admin })
      .then((r) => r.json())) as KnowledgeObject;
    const attachments = ko.attachments ?? [];
    expect(attachments.some((a) => a.objectId === objectId)).toBe(true);

    // 5) FE-Helfer: die Nicht-Bild-Datei mit objectId ist jetzt body-verlinkbar.
    const linkable = editorFilesFromAttachments(attachments);
    expect(linkable.some((f) => f.objectId === objectId)).toBe(true);

    // 6) Der erzeugte Body-Link zeigt AUSSCHLIESSLICH auf den internen Raw-Pfad — kein data:/javascript:.
    const html = fileLinkHtml({ objectId, name: "handbuch-p7.pdf" });
    expect(html).toContain(`/api/objects/${objectId}/raw`);
    expect(html).not.toMatch(/data:|javascript:/i);
    expect(objectRawHref(objectId)).toBe(`/api/objects/${objectId}/raw`);

    // 7) Ein BILD-Anhang wäre NICHT in der Datei-Verlink-Liste (Bilder werden eingebettet, nicht verlinkt).
    expect(
      editorFilesFromAttachments([{ name: "foto.png", mime: "image/png", objectId: "img-1" }]),
    ).toHaveLength(0);

    // 8) Session-Datei OHNE objectId (vor dem Speichern) → NICHT verlinkbar, KEIN Fake-Link.
    expect(
      editorFilesFromAttachments([{ name: "lokal.pdf", mime: "application/pdf", objectId: null }]),
    ).toHaveLength(0);
    expect(fileLinkHtml({ name: "lokal.pdf" })).toBe("");
    expect(objectRawHref(undefined)).toBeNull();

    // 9) Media-Guide: die gespeicherte Datei zählt als verlinkbar; die noch-nicht-gespeicherte als Evidence.
    const guide = editorMediaGuide([
      { mime: "application/pdf", objectId }, // gespeichert → verlinkbar
      { mime: "text/plain" }, // Session ohne objectId → Evidence
    ]);
    expect(guide.linkableFiles).toBe(1);
    expect(guide.evidenceFiles).toBe(1);

    // 10) Evidence ≠ Validierung: trotz Anhang bleibt das KO nutzbarkeitsseitig NICHT "ready".
    const overview = koOverview(ko);
    expect(overview.usability).not.toBe("ready");
  });
});
