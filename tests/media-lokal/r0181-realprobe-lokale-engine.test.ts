// ================================================================================================
// Aufnahme `gesamt-ocr` · R-0181 — REALPROBE: ECHTE LOKALE SPRACHERKENNUNG ÜBER DEN APP-WEG
// ================================================================================================
//
// Bens Befund (Nacharbeit 11): `r0181-lokale-transkription.test.ts` belegt den ANSCHLUSS (App-Weg,
// Schnittstelle, keine externe Übertragung), aber keine Spracherkennung — sein Testdienst gibt einen
// festen Text auf eine stille Datei zurück. Diese Datei ist die Realprobe dazu: dieselbe App,
// dieselbe Factory, aber gegen eine TATSÄCHLICH laufende lokale Engine und mit einer künstlichen
// SPRACHaufnahme mit bekanntem Inhalt (`tests/fixtures/medien/kuenstliche-sprachprobe.wav`, rein
// synthetisch, ohne Personen- oder Kundendaten).
//
// SIE LÄUFT NUR, WENN EINE ENGINE DA IST. Die Adresse kommt über
//   KLARWERK_REALPROBE_TRANSCRIBE_URL    z. B. http://127.0.0.1:8000/v1 (whisper.cpp-Server mit
//                                        OpenAI-Pfad oder faster-whisper/Speaches)
//   KLARWERK_REALPROBE_TRANSCRIBE_MODEL  optional
// Ohne diese Angabe wird die Probe ÜBERSPRUNGEN — ein übersprungener Lauf ist ausdrücklich KEIN
// Nachweis. Die Adresse MUSS auf diesem Rechner liegen (Loopback); eine andere wird abgelehnt, damit
// diese Probe nie mit einem Clouddienst „bestanden" werden kann.
import { Buffer } from "node:buffer";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { istBestaetigtLokaleAdresse } from "../../services/media/src/transcriber";

const ENGINE = process.env.KLARWERK_REALPROBE_TRANSCRIBE_URL?.trim() ?? "";
const MODELL = process.env.KLARWERK_REALPROBE_TRANSCRIBE_MODEL?.trim() ?? "";
const AUFNAHME = readFileSync(
  join(__dirname, "..", "fixtures", "medien", "kuenstliche-sprachprobe.wav"),
);

// Der gesprochene Inhalt der künstlichen Aufnahme (Bens Medienbeleg, HILFE c6c879549fd0b2f379790aa6):
// „Dies ist eine künstliche Sprachprobe für Klarwerk. Im blauen Schrank liegen sieben gelbe Karten,
// die Kennung lautet Testaufnahme Nord, es werden keine echten Personen- oder Kundendaten genannt."
// Geprüft werden markante Wörter, nicht der Wortlaut — Satzzeichen und Groß-/Kleinschreibung
// unterscheiden sich zwischen Engines.
const ERWARTETE_WOERTER = ["sprachprobe", "schrank", "gelbe", "karten", "nord"];

const UMGEBUNG = [
  "KLARWERK_LOCAL_TRANSCRIBE_URL",
  "KLARWERK_LOCAL_TRANSCRIBE_MODEL",
  "KLARWERK_LOCAL_TRANSCRIBE_ALLOWED_ORIGINS",
  "MEDIA_TRANSCRIBE_API_KEY",
  "OPENAI_API_KEY",
] as const;
const vorher = new Map<string, string | undefined>();
const echterFetch = globalThis.fetch;
const dateiUebertragungen: string[] = [];

beforeAll(() => {
  for (const name of UMGEBUNG) {
    vorher.set(name, process.env[name]);
    delete process.env[name];
  }
  if (ENGINE) {
    process.env.KLARWERK_LOCAL_TRANSCRIBE_URL = ENGINE;
    if (MODELL) {
      process.env.KLARWERK_LOCAL_TRANSCRIBE_MODEL = MODELL;
    }
  }
  // Jede Dateiübertragung (multipart — so verlässt eine Aufnahme den Prozess) wird mitgeschnitten.
  globalThis.fetch = ((eingabe: Parameters<typeof fetch>[0], init?: RequestInit) => {
    if (init?.body instanceof FormData) {
      dateiUebertragungen.push(eingabe instanceof Request ? eingabe.url : String(eingabe));
    }
    return echterFetch(eingabe, init);
  }) as typeof fetch;
});

afterAll(() => {
  globalThis.fetch = echterFetch;
  for (const name of UMGEBUNG) {
    const wert = vorher.get(name);
    if (wert === undefined) {
      delete process.env[name];
    } else {
      process.env[name] = wert;
    }
  }
});

describe.skipIf(!ENGINE)("gesamt-ocr · R-0181 · Realprobe lokale Engine", () => {
  it("R1 · die Engine-Adresse liegt auf diesem Rechner", () => {
    expect(istBestaetigtLokaleAdresse(ENGINE), ENGINE).toBe(true);
  });

  it("R2 · eine künstliche Sprachaufnahme wird über den App-Weg lokal erkannt — keine externe Übertragung", async () => {
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

    const status = await app.inject({ method: "GET", url: "/api/media/status", headers });
    expect(status.json().active).toBe(true);
    expect(String(status.json().engine)).toMatch(/^local:/);

    const put = await app.inject({
      method: "POST",
      url: "/api/objects",
      headers,
      payload: {
        name: "kuenstliche-sprachprobe.wav",
        mime: "audio/wav",
        data: `data:audio/wav;base64,${Buffer.from(AUFNAHME).toString("base64")}`,
        confidentiality: "vertraulich",
      },
    });
    expect(put.statusCode).toBe(201);
    const analyse = await app.inject({
      method: "POST",
      url: "/api/media/analyze",
      headers,
      payload: { objectId: put.json().id, locale: "de" },
    });
    expect(analyse.statusCode).toBe(200);
    expect(analyse.json().engineActive).toBe(true);
    const erkannt = String(analyse.json().transcript ?? "").toLowerCase();
    // Für das Prüfprotokoll: was die lokale Engine tatsächlich erkannt hat.
    console.info(`R-0181 Realprobe · Engine ${analyse.json().engine} · erkannt: ${erkannt}`);
    for (const wort of ERWARTETE_WOERTER) {
      expect(erkannt, wort).toContain(wort);
    }
    // Reale Engines schreiben gesprochene Zahlen auch als Ziffern. Der Inhalt bleibt sieben;
    // andere Zahlen wie 17 oder 70 dürfen diese Prüfung weiterhin nicht erfüllen.
    expect(erkannt, "sieben oder 7").toMatch(/\b(?:sieben|7)\b/u);

    // Die Aufnahme hat den Prozess nur in Richtung des eigenen Rechners verlassen.
    expect(dateiUebertragungen.length).toBeGreaterThan(0);
    for (const ziel of dateiUebertragungen) {
      expect(istBestaetigtLokaleAdresse(ziel), ziel).toBe(true);
    }
  });
});
