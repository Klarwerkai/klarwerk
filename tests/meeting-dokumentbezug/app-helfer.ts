// ================================================================================================
// BPA-16 · HELFER FÜR DEN WEG ÜBER DIE ECHTE APP (kein Test).
// ================================================================================================
//
// Alles läuft über die registrierten Routen: Dateien über `POST /api/objects` (der vorhandene
// berechtigte Import), der Meetingbezug über `/api/meetings/**`. Gemeinsam genutzt von
// `bedienweg.test.ts` (Speicherablage) und `bedienweg-pg.integration.test.ts` (PostgreSQL).
import type { FastifyInstance } from "fastify";
import { expect } from "vitest";
import type { Konto } from "../klara-quellen-nutzerweg/kette";
import { NORD, SUED, VTT, pptx } from "./vorrichtung";

export const PPTX_MIME =
  "application/vnd.openxmlformats-officedocument.presentationml.presentation";
export const ZEITBASIS = "aufnahme-1";

export interface Antwort {
  status: number;
  // biome-ignore lint/suspicious/noExplicitAny: JSON-Antworten werden im Test feldweise geprüft.
  json: any;
  body: string;
}

export async function anfrage(
  app: FastifyInstance,
  konto: Konto,
  method: "GET" | "POST",
  url: string,
  payload?: Record<string, unknown>,
): Promise<Antwort> {
  const res = await app.inject({
    method,
    url,
    headers: konto.kopf,
    ...(payload !== undefined ? { payload } : {}),
  });
  return {
    status: res.statusCode,
    json: res.body.length > 0 ? res.json() : null,
    body: res.body,
  };
}

export async function kontoId(app: FastifyInstance, konto: Konto): Promise<string> {
  const res = await anfrage(app, konto, "GET", "/api/auth/me");
  expect(res.status, res.body).toBe(200);
  return res.json.id as string;
}

/** Lädt eine Datei über den vorhandenen Objektweg hoch und gibt die Objektkennung zurück. */
export async function hochladen(
  app: FastifyInstance,
  konto: Konto,
  name: string,
  mime: string,
  bytes: Uint8Array,
  stufe: "intern" | "vertraulich" | "streng_vertraulich",
): Promise<string> {
  const res = await anfrage(app, konto, "POST", "/api/objects", {
    name,
    mime,
    data: `data:${mime};base64,${Buffer.from(bytes).toString("base64")}`,
    kind: "document",
    purpose: "anchor",
    confidentiality: stufe,
  });
  expect(res.status, res.body).toBe(201);
  return res.json.id as string;
}

export interface Meetinglage {
  meetingId: string;
  /** Präsentierte Kopie (intern), mit eigener Objektkennung. */
  nordKopie: string;
  fassungKopie: string;
  /** Das Original der Kopie (intern). */
  nordOriginal: string;
  /** Eine zweite Präsentation, streng vertraulich — nur die Vortragende darf sie lesen. */
  suedGeheim: string;
  fassungSued: string;
  mitschrift: string;
  /** Die Antworten beim Verbinden der beiden Präsentationen. */
  verbunden: { kopie: Antwort; sued: Antwort };
}

/**
 * Baut die Lage aus BPA-S17 über die Routen: Dateien hochladen, Meeting anlegen (Teilnehmer
 * eingetragen), Präsentationen und Mitschrift verbinden, Folienwechsel Nord → Süd → Nord → Rücksprung.
 */
export async function meetingAufbauen(
  app: FastifyInstance,
  vortragende: Konto,
  teilnehmerIds: string[],
): Promise<Meetinglage> {
  const nordOriginal = await hochladen(
    app,
    vortragende,
    "nord.pptx",
    PPTX_MIME,
    await pptx(NORD),
    "intern",
  );
  const nordKopie = await hochladen(
    app,
    vortragende,
    "nord-vortrag.pptx",
    PPTX_MIME,
    await pptx(NORD, "vortragskopie"),
    "intern",
  );
  const suedGeheim = await hochladen(
    app,
    vortragende,
    "sued.pptx",
    PPTX_MIME,
    await pptx(SUED),
    "streng_vertraulich",
  );
  const mitschrift = await hochladen(
    app,
    vortragende,
    "meeting.vtt",
    "text/vtt",
    new TextEncoder().encode(VTT),
    "intern",
  );
  const angelegt = await anfrage(app, vortragende, "POST", "/api/meetings", {
    titel: "Quartalsrunde",
    zeitbasis: ZEITBASIS,
    teilnehmer: teilnehmerIds,
  });
  expect(angelegt.status, angelegt.body).toBe(201);
  const meetingId = angelegt.json.meetingId as string;
  const basis = `/api/meetings/${meetingId}`;

  const kopie = await anfrage(app, vortragende, "POST", `${basis}/praesentationen`, {
    objectId: nordKopie,
    originalObjectId: nordOriginal,
  });
  expect(kopie.status, kopie.body).toBe(200);
  const sued = await anfrage(app, vortragende, "POST", `${basis}/praesentationen`, {
    objectId: suedGeheim,
  });
  expect(sued.status, sued.body).toBe(200);
  const vtt = await anfrage(app, vortragende, "POST", `${basis}/mitschriften`, {
    objectId: mitschrift,
    zeitbasis: ZEITBASIS,
  });
  expect(vtt.status, vtt.body).toBe(200);

  const fassungKopie = kopie.json.fassung as string;
  const fassungSued = sued.json.fassung as string;
  const wechsel: [string, string, string, number][] = [
    [nordKopie, fassungKopie, "256", 0],
    [suedGeheim, fassungSued, "257", 60_000],
    [nordKopie, fassungKopie, "257", 120_000],
    [nordKopie, fassungKopie, "256", 130_000],
  ];
  for (const [dateiId, fassung, sldId, zeitMs] of wechsel) {
    const res = await anfrage(app, vortragende, "POST", `${basis}/folienwechsel`, {
      quelle: "host",
      zeitMs,
      zeitbasis: ZEITBASIS,
      dateiId,
      fassung,
      sldId,
    });
    expect(res.status, res.body).toBe(200);
  }
  return {
    meetingId,
    nordKopie,
    fassungKopie,
    nordOriginal,
    suedGeheim,
    fassungSued,
    mitschrift,
    verbunden: { kopie, sued },
  };
}
