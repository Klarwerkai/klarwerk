// JOB 3229: echte DOCX-Bytes → Fastify → Sanitizer → frischer GET.
// Der Browser-Vergleich nutzt denselben Importkern; Canvas-Downscale wird unter Node
// durch Identität ersetzt. Keine Messung des echten Word-Panels oder von Chromium.
import { randomBytes } from "node:crypto";
import JSZip from "jszip";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { wholeDocumentDraftPayload } from "../../apps/web/src/lib/captureFromFile";
import { MAX_INLINE_BODY_HTML_BYTES, extractDocxRich } from "../../apps/web/src/lib/docx";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import {
  type Absatz,
  PNG_BLAU,
  PNG_ROT,
  alsPuffer,
  baueDocx,
} from "../m5-docx-bildunterschriften/docx-bauen";

const PROFILE = "Figure 1: Profiles";
const BILDER: Absatz[] = [
  { art: "bild", png: PNG_ROT },
  { art: "bild", png: PNG_BLAU },
];

function bildquellen(html: string): string[] {
  return [...html.matchAll(/<img\b[^>]*src="([^"]+)"/g)].map((m) => m[1] ?? "");
}

function fussnoten(html: string): string[] {
  return [...html.matchAll(/<figcaption\b[^>]*>([\s\S]*?)<\/figcaption>/g)].map((m) => m[1] ?? "");
}

function pruefeBild(html: string, quelle: string, beschriftung: string): void {
  const figure = [...html.matchAll(/<figure\b[^>]*>[\s\S]*?<\/figure>/g)].find((m) =>
    m[0].includes(`src="data:image/png;base64,${quelle}"`),
  )?.[0];
  expect(figure, "Das richtige Bild hat keine figure").toBeDefined();
  const id = /<img\b[^>]*data-image-id="([^"]+)"/.exec(figure ?? "")?.[1];
  expect(id).toMatch(/^kw-img-[a-z0-9]+-\d+$/);
  expect(figure).toContain(`<figcaption data-image-id="${id}">${beschriftung}</figcaption>`);
}

describe("JOB 3229 · Add-in-Bildunterschriften bis zum frischen GET", () => {
  let app: ReturnType<typeof buildApp>;
  let headers: { authorization: string; "content-type": string };

  beforeEach(async () => {
    app = buildApp(buildServices());
    const zugang = { name: "Admin", email: "m5cb@x.de", password: "secret123" };
    const registriert = await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: zugang,
    });
    expect(registriert.statusCode).toBe(201);
    const login = await app.inject({ method: "POST", url: "/api/auth/login", payload: zugang });
    expect(login.statusCode).toBe(200);
    headers = { authorization: `Bearer ${login.json().token}`, "content-type": "application/json" };
  });

  afterEach(async () => {
    await app.close();
  });

  async function lesen(id: string) {
    const get = await app.inject({ method: "GET", url: `/api/drafts/${id}`, headers });
    expect(get.statusCode).toBe(200);
    const payload = get.json().payload as {
      bodyHtml: string;
      sourceImageCount: number;
      origin: string;
    };
    expect(payload).not.toHaveProperty("captionsAssigned");
    expect(payload).not.toHaveProperty("captionsAmbiguous");
    return payload;
  }

  async function importieren(bytes: Buffer) {
    const post = await app.inject({
      method: "POST",
      url: "/api/drafts/from-docx",
      headers,
      payload: JSON.stringify({ name: "profile.docx", data: bytes.toString("base64") }),
    });
    expect(post.statusCode, post.body.slice(0, 200)).toBe(201);
    const antwort = post.json() as {
      id: string;
      imagesEmbedded: number;
      imagesTotal: number;
      imagesDropped: number;
    };
    return { antwort, payload: await lesen(antwort.id) };
  }

  it("A1 · die Beschriftung über dem Bild steht in der gespeicherten figcaption", async () => {
    const { bytes } = await baueDocx([
      { art: "beschriftung", text: PROFILE },
      { art: "bild", png: PNG_ROT },
    ]);
    const { payload } = await importieren(bytes);
    expect(payload.bodyHtml.includes("<figcaption"), "Im frischen GET fehlt jede figcaption").toBe(
      true,
    );
    pruefeBild(payload.bodyHtml, PNG_ROT, PROFILE);
    expect(payload.bodyHtml.split(PROFILE)).toHaveLength(2);
  });

  it("A2 · Vorlage, Figure-Absatz, oben, unten und Leerabsatz bleiben am richtigen Bild", async () => {
    const { bytes } = await baueDocx([
      { art: "beschriftung", text: "Profilansicht" },
      { art: "leer" },
      { art: "bild", png: PNG_ROT },
      { art: "text", text: "Die Verbindung wird separat gezeigt." },
      { art: "bild", png: PNG_BLAU },
      { art: "leer" },
      { art: "text", text: "Figure 7: Bolted connection" },
    ]);
    const { payload } = await importieren(bytes);
    pruefeBild(payload.bodyHtml, PNG_ROT, "Profilansicht");
    pruefeBild(payload.bodyHtml, PNG_BLAU, "Figure 7: Bolted connection");
    for (const text of ["Profilansicht", "Figure 7: Bolted connection"]) {
      expect(payload.bodyHtml.split(text)).toHaveLength(2);
      expect(payload.bodyHtml).not.toContain(`<p>${text}</p>`);
    }
  });

  it("A3 · dieselben Bytes liefern über Browser-POST und Add-in-POST dieselben Beschriftungen", async () => {
    const { bytes } = await baueDocx([
      { art: "bild", png: PNG_ROT },
      { art: "beschriftung", text: PROFILE },
    ]);
    const addin = await importieren(bytes);
    const reich = await extractDocxRich(alsPuffer(bytes), {
      mapImage: async (src) => src,
      imageCaptionPlaceholder: "Bildbeschreibung hinzufügen",
      imageBudgetBytes: MAX_INLINE_BODY_HTML_BYTES,
    });
    const post = await app.inject({
      method: "POST",
      url: "/api/drafts",
      headers,
      payload: JSON.stringify(
        wholeDocumentDraftPayload({
          fileName: "profile.docx",
          text: reich.text,
          html: reich.html,
          sourceKind: "docx",
          locale: "de",
          sourceImageCount: reich.imageTransfer.totalImages,
        }),
      ),
    });
    expect(post.statusCode).toBe(201);
    const browser = await lesen(post.json().id);
    expect(fussnoten(addin.payload.bodyHtml)).toEqual([PROFILE]);
    expect(fussnoten(addin.payload.bodyHtml)).toEqual(fussnoten(browser.bodyHtml));
    expect(bildquellen(addin.payload.bodyHtml)).toEqual(bildquellen(browser.bodyHtml));
  });

  it("M1 · Bild–Legende–Bild bleibt mehrdeutig, auch wenn die Legendennummer passt", async () => {
    const { bytes } = await baueDocx([
      { art: "bild", png: PNG_ROT },
      { art: "beschriftung", text: PROFILE },
      { art: "bild", png: PNG_BLAU },
    ]);
    const { payload, antwort } = await importieren(bytes);
    expect(fussnoten(payload.bodyHtml), "Eine Nummer hat die Mehrdeutigkeit überstimmt").toEqual([
      "",
      "",
    ]);
    expect(payload.bodyHtml).toContain(`<p>${PROFILE}</p>`);
    pruefeBild(payload.bodyHtml, PNG_ROT, "");
    pruefeBild(payload.bodyHtml, PNG_BLAU, "");
    expect(antwort).toMatchObject({ imagesEmbedded: 2, imagesTotal: 2, imagesDropped: 0 });
  });

  it("B1 · Bildbilanz und Bildbytes bleiben vollständig; zusätzliche HTML-Bytes sind gemessen", async () => {
    const { bytes } = await baueDocx(BILDER);
    const vorher = await extractDocxRich(alsPuffer(bytes), {
      imageBudgetBytes: MAX_INLINE_BODY_HTML_BYTES,
    });
    const { payload, antwort } = await importieren(bytes);
    expect(bildquellen(vorher.html)).toEqual([
      `data:image/png;base64,${PNG_ROT}`,
      `data:image/png;base64,${PNG_BLAU}`,
    ]);
    expect(bildquellen(payload.bodyHtml)).toEqual(bildquellen(vorher.html));
    expect(antwort).toMatchObject({ imagesEmbedded: 2, imagesTotal: 2, imagesDropped: 0 });
    expect(payload.sourceImageCount).toBe(2);
    expect(payload.origin).toBe("word_addin");
    const vorherBytes = Buffer.byteLength(vorher.html);
    const nachherBytes = Buffer.byteLength(payload.bodyHtml);
    const payloadBytes = Buffer.byteLength(JSON.stringify(payload));
    // Die Differenz wird gemessen, nicht als Bildverlust gewertet: der Sanitizer
    // verkürzt auch img-Tags. Der Bilanzvertrag gilt mit und ohne Figure-Schalter.
    expect(payloadBytes).toBeLessThan(MAX_INLINE_BODY_HTML_BYTES);
    console.log(
      `B1: HTML vorher=${vorherBytes}, nachher=${nachherBytes}, Zusatz=${nachherBytes - vorherBytes}, GET-Payload=${payloadBytes} Bytes; Bilanz=2/2/0`,
    );
  });

  it("B2 · Wahl b: auch über dem bisherigen Scheinbudget bleibt das Bild erhalten", async () => {
    // Gültiges großes PNG aus der PNG-Signatur plus einem unbekannten ancillary-Chunk
    // ist unnötig: mammoth und Sanitizer reichen Bildbytes durch und decodieren sie nicht.
    // Hier messen wir genau diesen Bytevertrag; keine Aussage über die Darstellbarkeit.
    const bild = Buffer.concat([
      Buffer.from(PNG_ROT, "base64"),
      randomBytes(MAX_INLINE_BODY_HTML_BYTES),
    ]).toString("base64");
    const { bytes } = await baueDocx([{ art: "bild", png: bild }]);
    const vorher = await extractDocxRich(alsPuffer(bytes), {
      imageBudgetBytes: MAX_INLINE_BODY_HTML_BYTES,
    });
    expect(Buffer.byteLength(vorher.html)).toBeGreaterThan(MAX_INLINE_BODY_HTML_BYTES);
    const { payload, antwort } = await importieren(bytes);
    expect(Buffer.byteLength(payload.bodyHtml)).toBeGreaterThan(MAX_INLINE_BODY_HTML_BYTES);
    expect(bildquellen(payload.bodyHtml)).toEqual(bildquellen(vorher.html));
    expect(antwort).toMatchObject({ imagesEmbedded: 1, imagesTotal: 1, imagesDropped: 0 });
    console.log(
      `B2: Grenze=${MAX_INLINE_BODY_HTML_BYTES}, HTML=${Buffer.byteLength(payload.bodyHtml)} Bytes; Bilanz=1/1/0`,
    );
  });

  it("W1 · der Sanitizer entfernt EMF; eine leere verwaiste figcaption bleibt ehrlich gezählt", async () => {
    const { bytes } = await baueDocx([{ art: "bild", png: PNG_ROT }]);
    const zip = await JSZip.loadAsync(bytes);
    const typen = await zip.file("[Content_Types].xml")?.async("string");
    expect(typen).toContain('ContentType="image/png"');
    zip.file(
      "[Content_Types].xml",
      (typen ?? "").replace('ContentType="image/png"', 'ContentType="image/x-emf"'),
    );
    // Synthetischer EMF-Header; entscheidend ist der echte OOXML-Content-Type.
    zip.file("word/media/bild1.png", Buffer.from("0100000058000000", "hex"));
    const emf = await zip.generateAsync({ type: "nodebuffer", compression: "STORE" });
    const roh = await extractDocxRich(alsPuffer(emf));
    expect(roh.html).toContain("data:image/x-emf;base64,");
    const { payload, antwort } = await importieren(emf);
    expect(payload.bodyHtml).toMatch(
      /^<p><figure data-image-id="(kw-img-[a-z0-9]+-1)"><figcaption data-image-id="\1"><\/figcaption><\/figure><\/p>$/,
    );
    expect(bildquellen(payload.bodyHtml)).toEqual([]);
    expect(antwort).toMatchObject({ imagesEmbedded: 0, imagesTotal: 1, imagesDropped: 0 });
    expect(payload.sourceImageCount).toBe(1);
  });

  it("Z1 · ohne Bilder sind alle Bilanzwerte null und es entsteht keine figure", async () => {
    const { bytes } = await baueDocx([{ art: "text", text: "Nur Text." }]);
    const { payload, antwort } = await importieren(bytes);
    expect(antwort).toMatchObject({ imagesEmbedded: 0, imagesTotal: 0, imagesDropped: 0 });
    expect(payload.bodyHtml).toBe("<p>Nur Text.</p>");
  });

  it("Z2 · unlesbare Datei bleibt 415 ohne Entwurf und ohne Bilanz", async () => {
    const post = await app.inject({
      method: "POST",
      url: "/api/drafts/from-docx",
      headers,
      payload: JSON.stringify({
        name: "kaputt.docx",
        data: Buffer.from("kein Zip").toString("base64"),
      }),
    });
    expect(post.statusCode).toBe(415);
    for (const feld of ["id", "imagesEmbedded", "imagesTotal", "imagesDropped"]) {
      expect(post.json()).not.toHaveProperty(feld);
    }
    const liste = await app.inject({ method: "GET", url: "/api/drafts", headers });
    expect(liste.statusCode).toBe(200);
    expect(liste.json()).toEqual([]);
  });
});
