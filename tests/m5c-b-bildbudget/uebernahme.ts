// ================================================================================================
// JOB 3400 · M5c-b-R2 — DER ECHTE ADD-IN-WEG, EINMAL BESCHRIEBEN
// ================================================================================================
//
// Warum diese Datei neben den Testdateien steht und nicht in jeder von ihnen: Der gemessene Pfad
// ist in allen Fällen derselbe — `POST /api/drafts/from-docx` mit echter Anmeldung, danach ein
// FRISCHER `GET /api/drafts/:id`. Zwei Fassungen dieser Kette wären zwei Aussagen darüber, was
// „der Add-in-Weg" ist, und eine davon würde eines Tages veralten.
import { expect } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { type Absatz, baueDocx } from "../m5-docx-bildunterschriften/docx-bauen";

const ZUGANG = { name: "Admin", email: "m5c-b-bildbudget@x.de", password: "secret123" };

export interface Uebernommen {
  /** Der Rumpf, wie ihn ein frischer GET unter `payload.bodyHtml` liefert. */
  readonly bodyHtml: string;
  readonly sourceImageCount: number;
  readonly bilanz: { imagesTotal: number; imagesEmbedded: number; imagesDropped: number };
  /**
   * Was die ANTWORT der Route über die Bildableitung sagt — nicht das Serverprotokoll. Genau hier
   * entscheidet sich, ob ein übersprungenes Bild für einen Aufrufer sichtbar ist oder nur für
   * jemanden, der die Logdatei liest.
   */
  readonly ableitung: {
    imagesShrunk: number;
    imagesKeptOriginal: number;
    imageSkipReasons: string[];
  };
}

async function angemeldeteApp() {
  const app = buildApp(buildServices());
  const registriert = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: ZUGANG,
  });
  expect(registriert.statusCode).toBe(201);
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: ZUGANG.email, password: ZUGANG.password },
  });
  expect(login.statusCode).toBe(200);
  return {
    app,
    headers: {
      authorization: `Bearer ${login.json().token as string}`,
      "content-type": "application/json",
    },
  };
}

/** Fertige `.docx`-Bytes den echten Add-in-Weg entlang bis zum frischen Zurücklesen. */
export async function uebernehmenBytes(bytes: Buffer): Promise<Uebernommen> {
  const { app, headers } = await angemeldeteApp();
  try {
    const post = await app.inject({
      method: "POST",
      url: "/api/drafts/from-docx",
      headers,
      payload: JSON.stringify({ name: "bildbudget.docx", data: bytes.toString("base64") }),
    });
    expect(post.statusCode, post.body.slice(0, 300)).toBe(201);
    const antwort = post.json() as {
      id: string;
      imagesTotal: number;
      imagesEmbedded: number;
      imagesDropped: number;
      imagesShrunk: number;
      imagesKeptOriginal: number;
      imageSkipReasons: string[];
    };
    const get = await app.inject({ method: "GET", url: `/api/drafts/${antwort.id}`, headers });
    expect(get.statusCode).toBe(200);
    const payload = get.json().payload as { bodyHtml: string; sourceImageCount: number };
    return {
      bodyHtml: payload.bodyHtml,
      sourceImageCount: payload.sourceImageCount,
      bilanz: {
        imagesTotal: antwort.imagesTotal,
        imagesEmbedded: antwort.imagesEmbedded,
        imagesDropped: antwort.imagesDropped,
      },
      ableitung: {
        imagesShrunk: antwort.imagesShrunk,
        imagesKeptOriginal: antwort.imagesKeptOriginal,
        imageSkipReasons: antwort.imageSkipReasons,
      },
    };
  } finally {
    await app.close();
  }
}

/** Eine Absatzfolge über den gemeinsamen Bauer denselben Weg entlang. */
export async function uebernehmen(absaetze: readonly Absatz[]): Promise<Uebernommen> {
  const { bytes } = await baueDocx(absaetze);
  return uebernehmenBytes(bytes);
}

/** Die `src`-Werte aller `<img>` in Dokumentreihenfolge. */
export function bildquellen(html: string): string[] {
  return [...html.matchAll(/<img\b[^>]*\bsrc="([^"]*)"/g)].map((m) => m[1] ?? "");
}

/**
 * Die `<figure>`-Elemente in Dokumentreihenfolge. Die Bildeinheit des Imports ist das GANZE
 * `figure` (docx.ts:279 „die droppbare/messbare BILD-EINHEIT") — wer prüfen will, ob eine Aussage
 * ZU EINEM BILD gehört, prüft sie an dessen figure und nicht am ganzen Rumpf.
 */
export function figuren(html: string): string[] {
  return [...html.matchAll(/<figure\b[^>]*>[\s\S]*?<\/figure>/g)].map((m) => m[0]);
}

/** Die Bildkennung `kw-img-<token>-N` am `<img>` einer figure. */
export function kennung(figur: string): string {
  return /<img\b[^>]*data-image-id="([^"]+)"/.exec(figur)?.[1] ?? "";
}

/** Der Base64-Rumpf einer `data:`-Quelle — leer, wenn es keine ist. */
export function rumpf(quelle: string): string {
  return /^data:image\/[a-z0-9.+-]+;base64,([\s\S]*)$/i.exec(quelle)?.[1] ?? "";
}
