// ================================================================================================
// AUFNAHME gesamt-bildbudget · R-0013, R-0025, R-0412, M5c-b-R2 — DIE OBERGRENZE DES DOKUMENTS
// ================================================================================================
//
// JOB 3400 verkleinert die Bilder des Add-in-Imports EINZELN (route.test.ts, grenzfaelle.test.ts).
// Diese Datei misst, was danach noch fehlte: eine benannte Grenze für das GANZE Word-Dokument auf
// genau dem Weg, den Klara bei „Ganzes Dokument" benutzt (`POST /api/drafts/from-docx`), und dass
// ein Entwurf, den dieser Weg anlegt, sich danach auch speichern und einreichen lässt.
//
// WARUM MIT EINGESETZTER UMWANDLUNG: Die Grenze sitzt HINTER der Verkleinerung, am `bodyHtml`, das
// gespeichert würde. Um 61 Bilder oder 3,5 MB nach der Verkleinerung zu erzeugen, müsste ein Test
// sonst Dutzende Megabyte Rauschen durch sharp schicken. Eingesetzt wird deshalb das Ergebnis der
// Umwandlung (dieselbe Bauart wie tests/capture/job2671-d2-jszip-vorpruefung.test.ts, Block M);
// Route, Vorprüfung, Sanitizer, Speicher, Speichern und Einreichen sind echt.
//
// KEINE ECHTDATEN: alle Inhalte sind erfunden.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import Fastify, { type FastifyInstance } from "fastify";
import { afterEach, describe, expect, it } from "vitest";

process.env.KLARWERK_SKIP_KEYCHAIN = "1";

import { buildApp, buildServices } from "../../services/app/src/build-app";
import type { Guards, SessionUser } from "../../services/app/src/http";
import {
  DOCX_BILDER_MAX_ANZAHL,
  DOCX_BILDGRENZE,
  DOCX_EINREICH_RUMPF_MAX_BYTES,
  DOCX_ENTWURF_MAX_BYTES,
  DRAFTS_BODY_LIMIT,
  captureRoutes,
} from "../../services/app/src/routes/capture-routes";
import { PNG_ROT, baueDocx } from "../m5-docx-bildunterschriften/docx-bauen";
import { grossesPng } from "./bilder";

const NUTZER = { id: "pedi", role: "admin", name: "Pedi", email: "pedi@bildbudget.test" };

const OFFENE_TUER: Guards = {
  requireUser: async () => NUTZER as unknown as SessionUser,
  requirePermission: async () => NUTZER as unknown as SessionUser,
};

interface Umwandlungsergebnis {
  html: string;
  text: string;
  imageTransfer: { totalImages: number; droppedImageBudget: number };
}

let app: FastifyInstance | null = null;

afterEach(async () => {
  await app?.close();
  app = null;
});

async function routeMit(ergebnis: Umwandlungsergebnis): Promise<FastifyInstance> {
  const instanz = Fastify();
  await instanz.register(
    captureRoutes(
      { ...buildServices(), docxUmwandlung: (async () => ergebnis) as never },
      OFFENE_TUER,
    ),
  );
  await instanz.ready();
  app = instanz;
  return instanz;
}

/** Eine echte, gültige `.docx` — sie muss nur die Vorprüfung passieren; ihr Inhalt ist eingesetzt. */
async function docxBytes(): Promise<string> {
  const { bytes } = await baueDocx([{ art: "text", text: "Rahmen aus zwei Profilen." }]);
  return bytes.toString("base64");
}

function senden(instanz: FastifyInstance, data: string) {
  return instanz.inject({
    method: "POST",
    url: "/api/drafts/from-docx",
    payload: { name: "bildbudget.docx", data },
  });
}

async function entwurfsZahl(instanz: FastifyInstance): Promise<number> {
  const liste = await instanz.inject({ method: "GET", url: "/api/drafts" });
  expect(liste.statusCode).toBe(200);
  return (liste.json() as unknown[]).length;
}

/** `anzahl` eingebettete Bilder, wie mammoth sie nach der Verkleinerung liefert. */
function mitBildern(anzahl: number): Umwandlungsergebnis {
  const bild = `<p><img src="data:image/png;base64,${PNG_ROT}" alt="profil.png"></p>`;
  return {
    html: `<p>Rahmen aus zwei Profilen.</p>${bild.repeat(anzahl)}`,
    text: "Rahmen aus zwei Profilen.",
    imageTransfer: { totalImages: anzahl, droppedImageBudget: 0 },
  };
}

/** Ein `bodyHtml` von genau `bytes` UTF-8-Bytes. */
function mitUmfang(bytes: number): Umwandlungsergebnis {
  const huelle = "<p></p>";
  return {
    html: `<p>${"a".repeat(bytes - huelle.length)}</p>`,
    text: "Rahmen aus zwei Profilen.",
    imageTransfer: { totalImages: 0, droppedImageBudget: 0 },
  };
}

describe("gesamt-bildbudget · die Anzahl der Bilder je Word-Dokument ist begrenzt und benannt", () => {
  it("A1 · 61 Bilder → 413 DOCX_BILDGRENZE: kein Entwurf, kein Bild weggelassen, die Grenze steht da", async () => {
    const instanz = await routeMit(mitBildern(DOCX_BILDER_MAX_ANZAHL + 1));
    const res = await senden(instanz, await docxBytes());
    expect(res.statusCode, res.body).toBe(413);
    const antwort = res.json() as Record<string, unknown>;
    expect(antwort).toMatchObject({
      error: DOCX_BILDGRENZE,
      grenze: "anzahl",
      draftCreated: false,
      imageTransfer: "not_completed",
      imagesTotal: 61,
      maxImages: 60,
    });
    // Der Satz nennt beide Zahlen und sagt, was jetzt zu tun ist — kein bloßes „zu groß".
    expect(antwort.message).toContain("61 Bilder");
    expect(antwort.message).toContain("hoechstens 60 Bilder");
    expect(antwort.message).toContain("kein Bild weggelassen");
    expect(antwort.message).toContain("erneut senden");
    // Kein halber Entwurf: die Ablage hat nichts angelegt.
    expect(await entwurfsZahl(instanz)).toBe(0);
  });

  it("A2 · GEGENPROBE: genau 60 Bilder gehen durch — alle 60 stehen im gespeicherten Entwurf", async () => {
    const instanz = await routeMit(mitBildern(DOCX_BILDER_MAX_ANZAHL));
    const res = await senden(instanz, await docxBytes());
    expect(res.statusCode, res.body.slice(0, 300)).toBe(201);
    expect(res.json()).toMatchObject({ imagesTotal: 60, imagesEmbedded: 60 });
    expect(await entwurfsZahl(instanz)).toBe(1);
  });
});

describe("gesamt-bildbudget · der Umfang nach der Verkleinerung ist begrenzt und benannt", () => {
  it("B1 · bodyHtml über der Grenze → 413 DOCX_BILDGRENZE mit Ist- und Grenzwert, kein Entwurf", async () => {
    const instanz = await routeMit(mitUmfang(DOCX_ENTWURF_MAX_BYTES + 1));
    const res = await senden(instanz, await docxBytes());
    expect(res.statusCode, res.body.slice(0, 300)).toBe(413);
    const antwort = res.json() as Record<string, unknown>;
    expect(antwort).toMatchObject({
      error: DOCX_BILDGRENZE,
      grenze: "umfang",
      draftCreated: false,
      imageTransfer: "not_completed",
      bodyBytes: DOCX_ENTWURF_MAX_BYTES + 1,
      maxBodyBytes: DOCX_ENTWURF_MAX_BYTES,
    });
    expect(antwort.message).toContain("nach dem Verkleinern der Bilder");
    expect(antwort.message).toContain("erlaubt sind 3.3 MiB");
    expect(antwort.message).toContain("erneut senden");
    expect(await entwurfsZahl(instanz)).toBe(0);
  });

  it("B2 · R-0025: ein Entwurf AN der Grenze lässt sich speichern UND einreichen, ohne an 413 zu scheitern", async () => {
    const instanz = await routeMit(mitUmfang(DOCX_ENTWURF_MAX_BYTES));
    const angelegt = await senden(instanz, await docxBytes());
    expect(angelegt.statusCode, angelegt.body.slice(0, 300)).toBe(201);
    const id = (angelegt.json() as { id: string }).id;
    const geladen = await instanz.inject({ method: "GET", url: `/api/drafts/${id}` });
    expect(geladen.statusCode).toBe(200);
    const payload = (geladen.json() as { payload: Record<string, unknown> }).payload;
    // Der gespeicherte Stand liegt wirklich AN der Grenze (der Sanitizer darf Hüllen normalisieren).
    const gespeichertBytes = Buffer.byteLength(String(payload.bodyHtml));
    expect(gespeichertBytes).toBeLessThanOrEqual(DOCX_ENTWURF_MAX_BYTES);
    expect(gespeichertBytes).toBeGreaterThan(DOCX_ENTWURF_MAX_BYTES - 100);

    // Die Vordertür schickt beim Einreichen den GANZEN Stand mit (`draftPayload`). Dieser Rumpf muss
    // unter den Deckel der Einreichen-Route passen — sonst wäre die Grenze oben nur verschoben.
    const einreichRumpf = JSON.stringify({ draftPayload: payload });
    expect(Buffer.byteLength(einreichRumpf)).toBeLessThan(DRAFTS_BODY_LIMIT);

    const gespeichert = await instanz.inject({
      method: "PUT",
      url: `/api/drafts/${id}`,
      headers: { "content-type": "application/json" },
      payload: JSON.stringify(payload),
    });
    expect(gespeichert.statusCode, gespeichert.body.slice(0, 300)).toBe(200);

    const eingereicht = await instanz.inject({
      method: "POST",
      url: `/api/drafts/${id}/promote`,
      headers: { "content-type": "application/json" },
      payload: einreichRumpf,
    });
    expect(eingereicht.statusCode, eingereicht.body.slice(0, 300)).not.toBe(413);
    expect(eingereicht.body).not.toContain("FST_ERR_CTP_BODY_TOO_LARGE");
  });
});

// ================================================================================================
// D — NACHARBEIT 2 (BEN): DIE GRENZE MISST, WAS WIRKLICH REIST — AM ECHTEN WEG, MIT BILD.
// ================================================================================================
//
// BENS GEGENFALL: drei Millionen Backslashes im Text und ein kleines Bild. Roh unter 3,5 MB, als
// JSON über 6 MB — jeder Backslash wird beim Serialisieren zu zweien, und der Sanitizer erhält sie.
// Hier läuft alles echt: Anmeldung, `.docx`, mammoth, Bildverkleinerung (sharp), Sanitizer,
// Speicher, Speichern und Einreichen über `buildApp` — keine eingesetzte Umwandlung.
const ZUGANG = { name: "Admin", email: "dokumentgrenze@bildbudget.test", password: "secret123" };

async function angemeldet() {
  const instanz = buildApp(buildServices());
  app = instanz;
  const registriert = await instanz.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: ZUGANG,
  });
  expect(registriert.statusCode).toBe(201);
  const login = await instanz.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: ZUGANG.email, password: ZUGANG.password },
  });
  expect(login.statusCode).toBe(200);
  const headers = {
    authorization: `Bearer ${login.json().token as string}`,
    "content-type": "application/json",
  };
  return { instanz, headers };
}

/** Ein echtes Word-Dokument: `backslashes` Backslashes als Fließtext und ein echtes Rasterbild. */
async function escapeDocx(backslashes: number): Promise<string> {
  const { bytes } = await baueDocx([
    { art: "text", text: "Rahmen aus zwei Profilen." },
    { art: "text", text: "\\".repeat(backslashes) },
    { art: "bild", png: grossesPng(400, 300).toString("base64"), alt: "profil.png" },
  ]);
  return bytes.toString("base64");
}

describe("gesamt-bildbudget · der serialisierte Speicher- und Einreich-Rumpf ist begrenzt (R-0025)", () => {
  it("D1 · drei Millionen Backslashes + Bild: roh unter 3,5 MB, serialisiert zu groß → 413 „rumpf“, kein Entwurf", async () => {
    const { instanz, headers } = await angemeldet();
    const res = await instanz.inject({
      method: "POST",
      url: "/api/drafts/from-docx",
      headers,
      payload: JSON.stringify({ name: "bildbudget.docx", data: await escapeDocx(3_000_000) }),
    });
    expect(res.statusCode, res.body.slice(0, 300)).toBe(413);
    const antwort = res.json() as Record<string, number | string | boolean>;
    expect(antwort).toMatchObject({
      error: DOCX_BILDGRENZE,
      grenze: "rumpf",
      draftCreated: false,
      imagesTotal: 1,
      maxRequestBytes: DOCX_EINREICH_RUMPF_MAX_BYTES,
    });
    // GEGENPROBE gegen die alte Messung: roh lag der Rumpf UNTER der Umfangsgrenze — die frühere
    // Prüfung allein hätte diesen Entwurf angelegt.
    expect(Number(antwort.bodyBytes)).toBeLessThan(DOCX_ENTWURF_MAX_BYTES);
    expect(Number(antwort.requestBytes)).toBeGreaterThan(DRAFTS_BODY_LIMIT);
    expect(antwort.message).toContain("beim Speichern und Einreichen zu gross");
    const liste = await instanz.inject({ method: "GET", url: "/api/drafts", headers });
    expect(liste.json() as unknown[]).toHaveLength(0);
  });

  it("D2 · zwei Millionen Backslashes + Bild: angelegt, gespeichert UND eingereicht (201) — kein 413", async () => {
    const { instanz, headers } = await angemeldet();
    const angelegt = await instanz.inject({
      method: "POST",
      url: "/api/drafts/from-docx",
      headers,
      payload: JSON.stringify({ name: "bildbudget.docx", data: await escapeDocx(2_000_000) }),
    });
    expect(angelegt.statusCode, angelegt.body.slice(0, 300)).toBe(201);
    expect(angelegt.json()).toMatchObject({ imagesTotal: 1, imagesEmbedded: 1 });
    const id = (angelegt.json() as { id: string }).id;

    const geladen = await instanz.inject({ method: "GET", url: `/api/drafts/${id}`, headers });
    expect(geladen.statusCode).toBe(200);
    const payload = (geladen.json() as { payload: Record<string, unknown> }).payload;
    expect(String(payload.bodyHtml)).toContain("\\".repeat(1000));
    expect(String(payload.bodyHtml)).toMatch(/<img\b[^>]*src="data:image\//);

    const gespeichert = await instanz.inject({
      method: "PUT",
      url: `/api/drafts/${id}`,
      headers,
      payload: JSON.stringify(payload),
    });
    expect(gespeichert.statusCode, gespeichert.body.slice(0, 300)).toBe(200);

    // Der Rumpf, den die Vordertür beim Einreichen schickt: der ganze Stand, ergänzt um die
    // Pflichtfelder, die erst im Editor gesetzt werden. Er passt unter den 5-MiB-Deckel.
    const einreichRumpf = JSON.stringify({
      draftPayload: { ...payload, type: "best_practice", category: "Instandhaltung" },
    });
    // Serialisiert liegt er ÜBER der Rohgrenze von 3,5 MB — genau die Lage, die Ben gemeldet hat.
    expect(Buffer.byteLength(einreichRumpf)).toBeGreaterThan(DOCX_ENTWURF_MAX_BYTES);
    expect(Buffer.byteLength(einreichRumpf)).toBeLessThan(DRAFTS_BODY_LIMIT);
    const eingereicht = await instanz.inject({
      method: "POST",
      url: `/api/drafts/${id}/promote`,
      headers,
      payload: einreichRumpf,
    });
    expect(eingereicht.statusCode, eingereicht.body.slice(0, 300)).toBe(201);
  });
});

describe("gesamt-bildbudget · keine dritte Zahl: dieselben Grenzen wie im Word-Panel", () => {
  it("C1 · die Bildzahl ist die des Panels, der Umfang das Budget des Panels, beide unter dem 5-MiB-Deckel", () => {
    const panel = readFileSync(
      join(__dirname, "..", "..", "apps", "web", "public", "word-addin", "taskpane.js"),
      "utf8",
    );
    const maxBilder = /var WORD_ADDIN_MAX_BILDER = (\d+);/.exec(panel)?.[1];
    const budget = /var WORD_ADDIN_BODY_BUDGET_BYTES = (\d+);/.exec(panel)?.[1];
    expect(Number(maxBilder)).toBe(DOCX_BILDER_MAX_ANZAHL);
    expect(Number(budget)).toBe(DOCX_ENTWURF_MAX_BYTES);
    expect(DOCX_ENTWURF_MAX_BYTES).toBeLessThan(DRAFTS_BODY_LIMIT);
  });

  it("C2 · R-0021: der 413-Satz des Panels ist je Sprache EIN Satz, nennt die Grenze und wann erneut zu senden ist", () => {
    // Dieselbe Satzzählung wie tests/design/zielbild-k2-kein-erklaertext.test.ts (`saetze`). Jener
    // Chromium-Fall erreicht seine Sprachschleife im Kandidaten 4e98aeda nicht, weil er vorher an
    // den fremden Stufen-Knöpfen (`#capture-stufe-*`, R-0632) scheitert — deshalb steht die
    // Satzprobe für genau diesen geänderten Schlüssel hier.
    const panel = readFileSync(
      join(__dirname, "..", "..", "apps", "web", "public", "word-addin", "taskpane.js"),
      "utf8",
    );
    const saetze = [...panel.matchAll(/^\s*sendTooLarge: "(.*)",\s*$/gm)].map((m) => m[1] ?? "");
    expect(saetze, "de, en und nl").toHaveLength(3);
    const [de, en, nl] = saetze;
    expect(de).toContain("KEIN Entwurf angelegt");
    expect(de).toContain("erneut senden");
    expect(en).toContain("send again");
    expect(nl).toContain("opnieuw verzenden");
    for (const satz of saetze) {
      expect((satz.match(/[.!?…](?=\s|$)/g) ?? []).length, satz).toBe(1);
      expect(satz).toContain(String(DOCX_BILDER_MAX_ANZAHL));
    }
  });
});
