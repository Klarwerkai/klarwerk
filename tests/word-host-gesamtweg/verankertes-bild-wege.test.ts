// ================================================================================================
// WORD-HOST-GESAMTWEG · R-0408 — DAS FREI PLATZIERTE (VERANKERTE) RASTERBILD AUF DEN PRÜFBAREN WEGEN.
// ================================================================================================
//
// `tests/app/job1135-word-umflossenes-bild.test.ts` belegt die Nicht-Erfassung nur für einen
// BEDINGTEN Fall: ein HTML aus `body.getHtml()`, in dem das umflossene Bild keine Spur hinterlässt —
// und nennt diese Word-Ausgabe selbst eine unbewiesene Hypothese. Der heutige Ganzdokumentweg des
// Panels holt aber zuerst die ganze DOCX (`getFileAsync`) und schickt sie an
// `POST /api/drafts/from-docx`; erst wenn das scheitert, greift der HTML-Rückfall.
//
// Diese Datei führt eine echte DOCX mit einem Inline-Bild UND einem verankerten Bild (`wp:anchor`,
// umflossen) durch die beiden Wege, die ohne Word prüfbar sind:
//   A  den Word-Ganzdokumentweg bis zum frischen GET (echte Route, echter Importkern),
//   B  den Browser-Dateiimport (derselbe Importkern `extractDocxRich`).
// Erwartet ist, was das Original verlangt: beide Bilder kommen an. Auswahl- und HTML-Rückfallweg
// hängen an der Word-Ausgabe von `getHtml()` und bleiben bis zum Hostnachweis offen.
import JSZip from "jszip";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MAX_INLINE_BODY_HTML_BYTES, extractDocxRich } from "../../apps/web/src/lib/docx";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import {
  type Absatz,
  PNG_BLAU,
  PNG_ROT,
  alsPuffer,
  baueDocx,
} from "../m5-docx-bildunterschriften/docx-bauen";

/** Ein Inline-Bild (rot) und ein frei platziertes, umflossenes Bild (blau). */
const DOKUMENT: Absatz[] = [
  { art: "text", text: "Prüfablauf" },
  { art: "bild", png: PNG_ROT },
  { art: "text", text: "Der Umlaufplan steht daneben." },
  { art: "bild", png: PNG_BLAU, verankert: true },
];

function bildquellen(html: string): string[] {
  return [...html.matchAll(/<img\b[^>]*src="([^"]+)"/g)].map((m) => m[1] ?? "");
}

const ROT = `data:image/png;base64,${PNG_ROT}`;
const BLAU = `data:image/png;base64,${PNG_BLAU}`;

describe("R-0408 · Kalibrierung: die Prüfdatei trägt wirklich ein verankertes Bild", () => {
  it("K1 · genau ein wp:inline und genau ein wp:anchor, beide mit Bildbezug", async () => {
    const { bytes } = await baueDocx(DOKUMENT);
    const zip = await JSZip.loadAsync(bytes);
    const xml = (await zip.file("word/document.xml")?.async("string")) ?? "";
    expect(xml.match(/<wp:inline\b/g) ?? []).toHaveLength(1);
    expect(xml.match(/<wp:anchor\b/g) ?? []).toHaveLength(1);
    expect(xml.match(/<wp:wrapSquare\b/g) ?? []).toHaveLength(1);
    expect(xml.match(/r:embed="/g) ?? []).toHaveLength(2);
  });
});

describe("R-0408 · A · Word-Ganzdokumentweg (POST /api/drafts/from-docx) bis zum frischen GET", () => {
  let app: ReturnType<typeof buildApp>;
  let headers: { authorization: string; "content-type": string };

  beforeEach(async () => {
    app = buildApp(buildServices());
    const zugang = { name: "Admin", email: "r0408@x.de", password: "secret123" };
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

  it("A1 · beide Bilder stehen im gespeicherten Entwurf — das verankerte eingeschlossen", async () => {
    const { bytes } = await baueDocx(DOKUMENT);
    const post = await app.inject({
      method: "POST",
      url: "/api/drafts/from-docx",
      headers,
      payload: JSON.stringify({ name: "umlaufplan.docx", data: bytes.toString("base64") }),
    });
    expect(post.statusCode, post.body.slice(0, 200)).toBe(201);
    const antwort = post.json() as { id: string; imagesTotal: number; imagesDropped: number };
    expect(antwort.imagesTotal).toBe(2);
    expect(antwort.imagesDropped).toBe(0);
    const get = await app.inject({ method: "GET", url: `/api/drafts/${antwort.id}`, headers });
    expect(get.statusCode).toBe(200);
    const payload = get.json().payload as { bodyHtml: string; origin: string };
    expect(bildquellen(payload.bodyHtml)).toEqual([ROT, BLAU]);
    expect(payload.origin).toBe("word_addin");
  });
});

describe("R-0408 · B · Browser-Dateiimport über denselben Importkern", () => {
  it("B1 · beide Bilder im Rumpf, die Bilanz zählt zwei", async () => {
    const { bytes } = await baueDocx(DOKUMENT);
    const reich = await extractDocxRich(alsPuffer(bytes), {
      mapImage: async (src) => src,
      imageBudgetBytes: MAX_INLINE_BODY_HTML_BYTES,
    });
    expect(bildquellen(reich.html)).toEqual([ROT, BLAU]);
    expect(reich.imageTransfer.totalImages).toBe(2);
    expect(reich.droppedImages).toBe(0);
  });
});
