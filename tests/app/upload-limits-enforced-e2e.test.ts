import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";

// AUFTRAG-mega14 Block E (SCRUM-421) — DER EIGENTLICHE FUND: der Server erzwang die GRÖSSENGRENZE
// nicht auf dem Weg, den das Produkt tatsächlich benutzt.
//
// Es gibt zwei Anhang-Wege:
//   ALT   Inline-Daten-URL (nur Bilder) — hier wurde die Größe schon immer geprüft.
//   NEU   Object-Store: die echte Datei geht per POST /api/objects hoch, ans KO kommt nur die
//         Referenz. Hier wurde NUR die winzige Vorschau (`thumbnail`, wenige KB) gegen die Grenze
//         gehalten. Die echte Datei nie. Eine Admin-Grenze von 2 MB hatte damit keinerlei Wirkung,
//         es griff allein die fest verdrahtete 30-MB-Obergrenze des Speichers — während der Admin
//         „serverseitig durchgesetzt" behauptete.
//
// Zusätzlich wurde `attachment.size` ungeprüft vom Client übernommen. Maßgeblich ist jetzt die
// GESPEICHERTE Größe.
//
// Einheit, ehrlich benannt: gemessen wird die Länge der übertragenen Daten-URL (Base64, rund das
// 1,37-Fache der Datei) — dieselbe Einheit, die der Alt-Pfad seit jeher prüft.

describe("SCRUM-421: der Server erzwingt Anzahl UND Größe der Anhänge", () => {
  type App = ReturnType<typeof buildApp>;

  async function setup(limits?: { maxAttachments: number; maxAttachmentBytes: number }) {
    const app = buildApp(buildServices());
    await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { name: "Admin", email: "a@x.de", password: "secret123" },
    });
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "a@x.de", password: "secret123" },
    });
    const headers = { authorization: `Bearer ${login.json().token}` };
    if (limits) {
      const put = await app.inject({
        method: "PUT",
        url: "/api/upload-limits",
        headers,
        payload: limits,
      });
      expect(put.statusCode).toBe(200);
    }
    const ko = await app.inject({
      method: "POST",
      url: "/api/kos",
      headers,
      payload: {
        title: "Dichtungswechsel L4",
        statement: "Dichtung vor jedem Anlauf prüfen.",
        type: "best_practice",
        category: "Instandhaltung",
      },
    });
    return { app, headers, koId: ko.json().id as string };
  }

  // Eine Daten-URL der gewünschten Länge — der Upload misst genau diese Länge.
  function dataUrl(totalLength: number): string {
    const prefix = "data:application/pdf;base64,";
    return prefix + "A".repeat(Math.max(0, totalLength - prefix.length));
  }

  async function upload(app: App, headers: Record<string, string>, bytes: number): Promise<string> {
    const res = await app.inject({
      method: "POST",
      url: "/api/objects",
      headers,
      payload: { name: "Handbuch.pdf", mime: "application/pdf", data: dataUrl(bytes) },
    });
    expect(res.statusCode).toBe(201);
    return res.json().id as string;
  }

  function attachObject(
    app: App,
    headers: Record<string, string>,
    koId: string,
    objectId: string,
    claimedSize?: number,
  ) {
    return app.inject({
      method: "PUT",
      url: `/api/kos/${koId}`,
      headers,
      payload: {
        action: "attach",
        attachment: {
          name: "Handbuch.pdf",
          mime: "application/pdf",
          objectId,
          ...(claimedSize !== undefined ? { size: claimedSize } : {}),
        },
      },
    });
  }

  it("GET /api/upload-limits liefert die Werkseinstellung — die EINE Quelle der Oberfläche", async () => {
    const { app, headers } = await setup();
    const res = await app.inject({ method: "GET", url: "/api/upload-limits", headers });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ maxAttachments: 8, maxAttachmentBytes: 20_000_000 });
  });

  it("GRÖSSE (Object-Store-Weg): zu große Datei wird serverseitig abgelehnt", async () => {
    const { app, headers, koId } = await setup({
      maxAttachments: 8,
      maxAttachmentBytes: 1_000_000,
    });
    const objectId = await upload(app, headers, 1_500_000);

    const res = await attachObject(app, headers, koId, objectId);
    // Vor der Behebung: 200. Die Admin-Grenze war auf diesem Weg wirkungslos.
    expect(res.statusCode).toBe(400);
    expect(res.json().message).toContain("zu groß");

    const ko = await app.inject({ method: "GET", url: `/api/kos/${koId}`, headers });
    expect(ko.json().attachments ?? []).toHaveLength(0);
  });

  it("GRÖSSE: eine Datei UNTER der Grenze geht unverändert durch", async () => {
    const { app, headers, koId } = await setup({
      maxAttachments: 8,
      maxAttachmentBytes: 1_000_000,
    });
    const objectId = await upload(app, headers, 500_000);
    const res = await attachObject(app, headers, koId, objectId);
    expect(res.statusCode).toBe(200);
  });

  it("die Client-Angabe `size` entscheidet NICHT — maßgeblich ist die gespeicherte Größe", async () => {
    const { app, headers, koId } = await setup({
      maxAttachments: 8,
      maxAttachmentBytes: 1_000_000,
    });
    const objectId = await upload(app, headers, 1_500_000);

    // Der Client behauptet, die Datei sei winzig. Das darf nichts ändern.
    const gelogen = await attachObject(app, headers, koId, objectId, 10);
    expect(gelogen.statusCode).toBe(400);

    // Und umgekehrt: eine erlaubte Datei wird mit der ECHTEN Größe vermerkt, nicht mit der Lüge.
    const kleines = await upload(app, headers, 400_000);
    const ok = await attachObject(app, headers, koId, kleines, 999_999_999);
    expect(ok.statusCode).toBe(200);
    const ko = await app.inject({ method: "GET", url: `/api/kos/${koId}`, headers });
    const atts = ko.json().attachments as { size?: number }[];
    expect(atts).toHaveLength(1);
    expect(atts[0]?.size).toBe(400_000);
  });

  it("ANZAHL: über der Grenze wird serverseitig abgelehnt", async () => {
    const { app, headers, koId } = await setup({
      maxAttachments: 2,
      maxAttachmentBytes: 1_000_000,
    });
    for (let i = 0; i < 2; i++) {
      const objectId = await upload(app, headers, 1000);
      expect((await attachObject(app, headers, koId, objectId)).statusCode).toBe(200);
    }
    const dritte = await upload(app, headers, 1000);
    const res = await attachObject(app, headers, koId, dritte);
    expect(res.statusCode).toBe(400);
    expect(res.json().message).toContain("Maximal 2");
  });

  it("eine Änderung im Admin wirkt sofort auf die Durchsetzung", async () => {
    const { app, headers, koId } = await setup({
      maxAttachments: 8,
      maxAttachmentBytes: 2_000_000,
    });
    const objectId = await upload(app, headers, 1_500_000);
    // Bei 2 MB erlaubt …
    expect((await attachObject(app, headers, koId, objectId)).statusCode).toBe(200);

    // … Admin senkt auf 1 MB …
    await app.inject({
      method: "PUT",
      url: "/api/upload-limits",
      headers,
      payload: { maxAttachments: 8, maxAttachmentBytes: 1_000_000 },
    });
    const zweites = await upload(app, headers, 1_500_000);
    // … dieselbe Größe ist jetzt abgelehnt. Ohne Neustart, ohne Zwischenspeicher.
    expect((await attachObject(app, headers, koId, zweites)).statusCode).toBe(400);

    // Und die Oberfläche liest denselben neuen Wert.
    const shown = await app.inject({ method: "GET", url: "/api/upload-limits", headers });
    expect(shown.json().maxAttachmentBytes).toBe(1_000_000);
  });

  it("unbekannte objectId wird abgewiesen statt als Anhang vermerkt", async () => {
    const { app, headers, koId } = await setup();
    const res = await attachObject(app, headers, koId, "gibt-es-nicht");
    expect(res.statusCode).toBe(400);
  });

  it("ALT-Pfad (Inline-Bild) bleibt unverändert geprüft", async () => {
    // 100_000 ist die kleinste zulässige Grenze (UPLOAD_LIMITS_BOUNDS).
    const { app, headers, koId } = await setup({
      maxAttachments: 8,
      maxAttachmentBytes: 100_000,
    });
    const res = await app.inject({
      method: "PUT",
      url: `/api/kos/${koId}`,
      headers,
      payload: {
        action: "attach",
        attachment: {
          name: "bild.png",
          mime: "image/png",
          dataUrl: `data:image/png;base64,${"A".repeat(200_000)}`,
        },
      },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().message).toContain("zu groß");
  });
});
