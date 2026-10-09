import { describe, expect, it } from "vitest";
import { adapterFromConfig } from "../../../tests/support/confluence-adapter";
import { mapConfluenceAttachment, mapConfluencePageToImportItem } from "./mapper";
import { type ConfluenceAttachment, ConfluenceRestClient } from "./rest-client";

// R-0163: Zu einer importierten Seite gehören ihre Anhänge und Bilder. Deterministische Fixtures
// (injizierter fetch) — kein Netz, kein Live-Token. Jeder Fall misst eine Stelle, an der ein Anhang
// bisher zurückblieb oder an der der Token die gepinnte Origin verlassen könnte.

const TOKEN = "read-only-tok-123";
const BASIS = "https://acme.atlassian.net/wiki";

interface Ruf {
  url: string;
  init: RequestInit | undefined;
}

function antwort(
  status: number,
  body: unknown,
  kopf: Record<string, string> = {},
  bytes?: Buffer,
): Response {
  const headers = new Map(Object.entries(kopf).map(([k, v]) => [k.toLowerCase(), v]));
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name: string) => headers.get(name.toLowerCase()) ?? null },
    json: async () => body,
    arrayBuffer: async () => {
      const b = bytes ?? Buffer.alloc(0);
      return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
    },
  } as unknown as Response;
}

function clientMit(
  fetchFn: (url: string, init?: RequestInit) => Promise<Response>,
  over: Record<string, unknown> = {},
) {
  return new ConfluenceRestClient({
    baseUrl: BASIS,
    email: "svc@acme.example",
    apiToken: TOKEN,
    spaceKey: "K",
    fetchFn: fetchFn as unknown as typeof fetch,
    ...over,
  });
}

const BILD: ConfluenceAttachment = {
  id: "att1",
  title: "Schaltplan &amp; Ventil.png",
  extensions: { mediaType: "image/png", fileSize: 4 },
  version: { number: 2 },
  _links: { download: "/download/attachments/2001/Schaltplan.png?version=2&api=v2" },
};

const PDF: ConfluenceAttachment = {
  id: "att2",
  title: "Wartung.pdf",
  metadata: { mediaType: "application/pdf" },
  _links: { download: "/download/attachments/2001/Wartung.pdf?version=1&api=v2" },
};

describe("R-0163 · Anhangsliste einer Seite", () => {
  it("A1 · liest die Kindanhänge der Seite über alle Ergebnisseiten; next relativ zum Kontextpfad", async () => {
    const rufe: Ruf[] = [];
    const client = clientMit(async (url, init) => {
      rufe.push({ url, init });
      return url.includes("start=50")
        ? antwort(200, { results: [PDF] })
        : antwort(200, {
            results: [BILD],
            _links: { next: "/rest/api/content/2001/child/attachment?limit=50&start=50" },
          });
    });

    const { attachments, truncated } = await client.listAttachments("2001");

    expect(attachments.map((a) => a.id)).toEqual(["att1", "att2"]);
    expect(truncated).toBe(false);
    const pfad = "/wiki/rest/api/content/2001/child/attachment";
    expect(new URL(rufe[0]?.url ?? "").pathname).toBe(pfad);
    // Hop 2 bleibt im Confluence-Kontextpfad — nicht <origin>/rest/… (Jira-Namensraum).
    expect(new URL(rufe[1]?.url ?? "").pathname).toBe(pfad);
    for (const ruf of rufe) {
      expect(ruf.init?.redirect).toBe("error");
      expect(ruf.url).not.toContain(TOKEN);
    }
  });

  it("A2 · scheitert ein Folge-Request an der Frist, bleibt das Gelesene und die Liste heißt unvollständig", async () => {
    let n = 0;
    const client = clientMit(
      async () => {
        n += 1;
        if (n === 1) {
          return antwort(200, {
            results: [BILD],
            _links: { next: "/rest/api/content/2001/child/attachment?start=50" },
          });
        }
        return new Promise<Response>(() => undefined); // hängt
      },
      { timeoutMs: 20 },
    );

    const { attachments, truncated } = await client.listAttachments("2001");

    expect(attachments.map((a) => a.id)).toEqual(["att1"]);
    expect(truncated).toBe(true);
  });

  it("A3 · die Seiten-Id wird URL-kodiert", async () => {
    const rufe: string[] = [];
    const client = clientMit(async (url) => {
      rufe.push(url);
      return antwort(200, { results: [] });
    });
    await client.listAttachments("../admin?x=1");
    expect(new URL(rufe[0] ?? "").pathname).toBe(
      "/wiki/rest/api/content/..%2Fadmin%3Fx%3D1/child/attachment",
    );
  });
});

describe("R-0163 · Anhangsdownload", () => {
  it("D1 · der Downloadlink wird gegen den Kontextpfad aufgelöst und mit Anmeldung geholt", async () => {
    const rufe: Ruf[] = [];
    const client = clientMit(async (url, init) => {
      rufe.push({ url, init });
      return antwort(
        200,
        null,
        { "content-type": "image/png; charset=binary" },
        Buffer.from("PNG!"),
      );
    });

    const inhalt = await client.downloadAttachment(BILD._links?.download ?? "");

    expect(inhalt.bytes.toString()).toBe("PNG!");
    expect(inhalt.mime).toBe("image/png");
    expect(rufe).toHaveLength(1);
    expect(new URL(rufe[0]?.url ?? "").pathname).toBe(
      "/wiki/download/attachments/2001/Schaltplan.png",
    );
    const kopf = rufe[0]?.init?.headers as Record<string, string>;
    expect(kopf.authorization).toMatch(/^Basic /);
    expect(rufe[0]?.url).not.toContain(TOKEN);
  });

  it("D2 · Weiterleitung auf den fremden Mediendienst: genau ein Hop, OHNE Anmeldung, dort redirect:error", async () => {
    const rufe: Ruf[] = [];
    const client = clientMit(async (url, init) => {
      rufe.push({ url, init });
      if (url.startsWith(BASIS)) {
        return antwort(302, null, {
          location: "https://api.media.atlassian.com/file/abc/binary?token=signiert",
        });
      }
      return antwort(200, null, { "content-type": "application/pdf" }, Buffer.from("%PDF"));
    });

    const inhalt = await client.downloadAttachment(PDF._links?.download ?? "");

    expect(inhalt.bytes.toString()).toBe("%PDF");
    expect(rufe).toHaveLength(2);
    expect(rufe[0]?.init?.redirect).toBe("manual");
    expect(new URL(rufe[1]?.url ?? "").host).toBe("api.media.atlassian.com");
    expect(rufe[1]?.init?.redirect).toBe("error");
    const fremdKopf = (rufe[1]?.init?.headers ?? {}) as Record<string, string>;
    expect(fremdKopf.authorization).toBeUndefined(); // R2a: kein Token an einen fremden Host
  });

  it("D3 · Weiterleitung auf plain-http wird nicht verfolgt", async () => {
    let rufe = 0;
    const client = clientMit(async () => {
      rufe += 1;
      return antwort(302, null, { location: "http://media.example/datei" });
    });
    await expect(client.downloadAttachment("/download/attachments/1/x.bin")).rejects.toThrow(
      "HTTPS",
    );
    expect(rufe).toBe(1);
  });

  it("D4 · ein absoluter Link auf eine fremde Origin wird ohne Netzcall abgewiesen", async () => {
    let rufe = 0;
    const client = clientMit(async () => {
      rufe += 1;
      return antwort(200, null, {}, Buffer.from("x"));
    });
    await expect(client.downloadAttachment("https://evil.example/download/x")).rejects.toThrow();
    expect(rufe).toBe(0);
  });

  it("D5 · ein Anhang über der Größenkante wird verworfen — vorab über content-length und danach über die Bytes", async () => {
    const vorab = clientMit(async () => antwort(200, null, { "content-length": "999" }), {
      maxAttachmentBytes: 10,
    });
    await expect(vorab.downloadAttachment("/download/attachments/1/x.bin")).rejects.toMatchObject({
      code: "CONFLUENCE_RESPONSE_TOO_LARGE",
    });
    const gelesen = clientMit(async () => antwort(200, null, {}, Buffer.alloc(11)), {
      maxAttachmentBytes: 10,
    });
    await expect(gelesen.downloadAttachment("/download/attachments/1/x.bin")).rejects.toMatchObject(
      { code: "CONFLUENCE_RESPONSE_TOO_LARGE" },
    );
  });

  it("D6 · ein Fehlerstatus trägt nur die Zahl, nie URL oder Token", async () => {
    const client = clientMit(async () => antwort(403, null));
    await expect(client.downloadAttachment("/download/attachments/1/x.bin")).rejects.toThrow(
      "Confluence-API antwortete mit 403",
    );
  });
});

describe("R-0163 · Mapper und Adapter", () => {
  const OPTS = { baseUrl: BASIS, spaceKey: "K" };
  const seite = {
    id: "2001",
    title: "Pumpe",
    body: { storage: { value: "<p>Text</p>" } },
    version: { number: 1 },
  };

  it("M1 · Anhänge werden quellneutral gemappt (Name dekodiert, Typ, Größe, Version, Abrufweg)", () => {
    expect(mapConfluenceAttachment(BILD)).toEqual({
      externalId: "att1",
      name: "Schaltplan & Ventil.png",
      mime: "image/png",
      size: 4,
      sourceVersion: 2,
      abruf: "/download/attachments/2001/Schaltplan.png?version=2&api=v2",
    });
    expect(mapConfluenceAttachment(PDF)?.mime).toBe("application/pdf");
    // Ohne Abrufweg kein Anhang — kein erfundener Link.
    expect(mapConfluenceAttachment({ id: "x", title: "x.txt" })).toBeUndefined();
  });

  it("M2 · das Item trägt die Anhänge; ohne gelesene Liste fehlt das Feld ganz", () => {
    const mit = mapConfluencePageToImportItem(seite, OPTS, {
      attachments: [BILD, PDF],
      unvollstaendig: false,
    });
    expect(mit.attachments?.map((a) => a.name)).toEqual(["Schaltplan & Ventil.png", "Wartung.pdf"]);
    expect(Object.hasOwn(mit, "attachmentsIncomplete")).toBe(false);

    const ohne = mapConfluencePageToImportItem(seite, OPTS);
    expect(Object.hasOwn(ohne, "attachments")).toBe(false);
    expect(Object.hasOwn(ohne, "attachmentsIncomplete")).toBe(false);
  });

  it("M3 · ein unbrauchbarer Eintrag oder eine abgeschnittene Liste macht das Item sichtbar unvollständig", () => {
    const kaputt = mapConfluencePageToImportItem(seite, OPTS, {
      attachments: [BILD, { id: "x", title: "ohne-link.txt" }],
      unvollstaendig: false,
    });
    expect(kaputt.attachments).toHaveLength(1);
    expect(kaputt.attachmentsIncomplete).toBe(true);

    const abgeschnitten = mapConfluencePageToImportItem(seite, OPTS, {
      attachments: [],
      unvollstaendig: true,
    });
    expect(Object.hasOwn(abgeschnitten, "attachments")).toBe(false);
    expect(abgeschnitten.attachmentsIncomplete).toBe(true);
  });

  it("F1 · fetchItem (der Anwendeweg) bringt die Anhänge der Seite mit", async () => {
    const adapter = adapterFromConfig({
      baseUrl: BASIS,
      email: "svc@acme.example",
      apiToken: TOKEN,
      spaceKey: "K",
      fetchFn: (async (url: string) =>
        url.includes("/child/attachment")
          ? antwort(200, { results: [BILD, PDF] })
          : antwort(200, seite)) as unknown as typeof fetch,
    });
    const item = (await adapter.fetchItem("2001")) as { attachments?: { name: string }[] };
    expect(item.attachments?.map((a) => a.name)).toEqual([
      "Schaltplan & Ventil.png",
      "Wartung.pdf",
    ]);
  });

  it("F2 · scheitert die Anhangsliste, kommt die Seite trotzdem — aber als unvollständig markiert", async () => {
    const adapter = adapterFromConfig({
      baseUrl: BASIS,
      email: "svc@acme.example",
      apiToken: TOKEN,
      spaceKey: "K",
      fetchFn: (async (url: string) =>
        url.includes("/child/attachment")
          ? antwort(500, null)
          : antwort(200, seite)) as unknown as typeof fetch,
    });
    const item = (await adapter.fetchItem("2001")) as {
      title: string;
      attachmentsIncomplete?: boolean;
    };
    expect(item.title).toBe("Pumpe");
    expect(item.attachmentsIncomplete).toBe(true);
  });
});
