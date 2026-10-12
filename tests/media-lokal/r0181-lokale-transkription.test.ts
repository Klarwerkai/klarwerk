// ================================================================================================
// Aufnahme `gesamt-ocr` · R-0181 — VERSCHRIFTLICHUNG AUF DEM EIGENEN RECHNER, OHNE CLOUD
// ================================================================================================
//
// Bens Befund (Nacharbeit 9): Die Factory erzeugte nur den Whisper-Cloudclient, und die App hing
// nur an ihr. Jetzt liefert DIESELBE Factory (`createCappedTranscriberFromEnv`, eingebunden in
// `build-app.ts`) bei `KLARWERK_LOCAL_TRANSCRIBE_URL` einen lokalen Transkriber über den vorhandenen
// Transcriber-Vertrag.
//
// Gemessen wird der GANZE App-Weg: gebauter Server → `POST /api/objects` (künstliche WAV-Aufnahme)
// → `POST /api/media/analyze` → Factory-Transkriber → ein ECHTER HTTP-Dienst auf 127.0.0.1 in diesem
// Testprozess, der die Schnittstelle eines lokalen Sprach-zu-Text-Dienstes spricht. Jede Verbindung,
// die der Prozess dabei aufbaut, wird mitgeschnitten. Belegt wird damit: die Aufnahme geht an den
// eigenen Rechner und an NICHTS sonst.
//
// WAS DAS NICHT BELEGT (Bens Befund Nacharbeit 11): Der Dienst hier gibt einen festen Text auf eine
// stille Datei zurück — das ist ein SCHNITTSTELLENBELEG, kein Spracherkennungsnachweis. Die echte
// Spracherkennung prüft `r0181-realprobe-lokale-engine.test.ts` gegen eine tatsächlich laufende
// lokale Engine mit einer künstlichen Sprachaufnahme; ohne Engine wird sie übersprungen.
import { Buffer } from "node:buffer";
import { type Server, createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach, describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import {
  createCappedTranscriberFromEnv,
  istBestaetigtLokaleAdresse,
} from "../../services/media/src/transcriber";

const ERKANNT = "Probe eins zwei drei";

/** Eine rein künstliche Aufnahme: 0,1 s Stille, 16 kHz, mono, 16 bit — eine gültige WAV-Datei. */
function kuenstlicheAufnahme(): Buffer {
  const samples = 1600;
  const daten = samples * 2;
  const wav = Buffer.alloc(44 + daten);
  wav.write("RIFF", 0, "ascii");
  wav.writeUInt32LE(36 + daten, 4);
  wav.write("WAVE", 8, "ascii");
  wav.write("fmt ", 12, "ascii");
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(16_000, 24);
  wav.writeUInt32LE(32_000, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write("data", 36, "ascii");
  wav.writeUInt32LE(daten, 40);
  return wav;
}

interface LokalerDienst {
  url: string;
  anfragen: { pfad: string; koerper: Buffer }[];
  server: Server;
}

/** Ein echter HTTP-Dienst auf 127.0.0.1 mit der Schnittstelle eines lokalen Transkriptionsdienstes. */
async function starteLokalenDienst(): Promise<LokalerDienst> {
  const anfragen: LokalerDienst["anfragen"] = [];
  const server = createServer((req, res) => {
    const teile: Buffer[] = [];
    req.on("data", (teil: Buffer) => teile.push(teil));
    req.on("end", () => {
      anfragen.push({ pfad: req.url ?? "", koerper: Buffer.concat(teile) });
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ text: ERKANNT }));
    });
  });
  await new Promise<void>((fertig) => server.listen(0, "127.0.0.1", fertig));
  const { port } = server.address() as AddressInfo;
  return { url: `http://127.0.0.1:${port}/v1`, anfragen, server };
}

const UMGEBUNG = [
  "KLARWERK_LOCAL_TRANSCRIBE_URL",
  "KLARWERK_LOCAL_TRANSCRIBE_MODEL",
  "KLARWERK_LOCAL_TRANSCRIBE_ALLOWED_ORIGINS",
  "MEDIA_TRANSCRIBE_API_KEY",
  "OPENAI_API_KEY",
] as const;
const vorher = new Map<string, string | undefined>();
const echterFetch = globalThis.fetch;
let dienst: LokalerDienst | null = null;

afterEach(async () => {
  for (const name of UMGEBUNG) {
    const wert = vorher.get(name);
    if (wert === undefined) {
      delete process.env[name];
    } else {
      process.env[name] = wert;
    }
  }
  vorher.clear();
  globalThis.fetch = echterFetch;
  if (dienst) {
    const offen = dienst.server;
    await new Promise<void>((fertig) => offen.close(() => fertig()));
    dienst = null;
  }
});

/** Setzt die Umgebung für EINEN Aufbau; alle Transkriptions-Variablen sonst leer. */
function umgebung(werte: Partial<Record<(typeof UMGEBUNG)[number], string>>): void {
  for (const name of UMGEBUNG) {
    vorher.set(name, process.env[name]);
    const wert = werte[name];
    if (wert === undefined) {
      delete process.env[name];
    } else {
      process.env[name] = wert;
    }
  }
}

/**
 * Schneidet jede ausgehende Verbindung des Prozesses mit, die eine Datei überträgt (multipart —
 * so verlässt eine Aufnahme den Prozess), und reicht sie unverändert weiter. Andere Verbindungen
 * des Servers (falls es welche gibt) tragen keine Aufnahme und sind nicht Gegenstand von R-0181.
 */
function verbindungsmitschnitt(): string[] {
  const ziele: string[] = [];
  globalThis.fetch = ((eingabe: Parameters<typeof fetch>[0], init?: RequestInit) => {
    if (init?.body instanceof FormData) {
      ziele.push(eingabe instanceof Request ? eingabe.url : String(eingabe));
    }
    return echterFetch(eingabe, init);
  }) as typeof fetch;
  return ziele;
}

async function app() {
  const server = buildApp(buildServices());
  await server.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Admin", email: "a@x.de", password: "secret123" },
  });
  const login = await server.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "a@x.de", password: "secret123" },
  });
  return { server, headers: { authorization: `Bearer ${login.json().token}` } };
}

async function analysiere(
  aufbau: Awaited<ReturnType<typeof app>>,
  confidentiality: "intern" | "vertraulich",
) {
  const put = await aufbau.server.inject({
    method: "POST",
    url: "/api/objects",
    headers: aufbau.headers,
    payload: {
      name: "sprachprobe.wav",
      mime: "audio/wav",
      data: `data:audio/wav;base64,${kuenstlicheAufnahme().toString("base64")}`,
      confidentiality,
    },
  });
  expect(put.statusCode).toBe(201);
  expect(put.json().kind).toBe("video");
  return aufbau.server.inject({
    method: "POST",
    url: "/api/media/analyze",
    headers: aufbau.headers,
    payload: { objectId: put.json().id, locale: "de" },
  });
}

describe("gesamt-ocr · R-0181 · lokale Transkription über den echten App-Anschluss", () => {
  it("L1 · eine künstliche Aufnahme wird auf 127.0.0.1 verschriftlicht — keine andere Verbindung", async () => {
    dienst = await starteLokalenDienst();
    const ziele = verbindungsmitschnitt();
    // KEIN Cloudschlüssel, KEINE Freigabe für öffentliche KI — beides braucht der lokale Weg nicht.
    umgebung({
      KLARWERK_LOCAL_TRANSCRIBE_URL: dienst.url,
      KLARWERK_LOCAL_TRANSCRIBE_MODEL: "probe",
    });
    const aufbau = await app();

    const status = await aufbau.server.inject({
      method: "GET",
      url: "/api/media/status",
      headers: aufbau.headers,
    });
    expect(status.json()).toEqual({ active: true, engine: "local:probe" });

    const analyse = await analysiere(aufbau, "intern");
    expect(analyse.statusCode).toBe(200);
    expect(analyse.json().engineActive).toBe(true);
    expect(analyse.json().engine).toBe("local:probe");
    expect(analyse.json().transcript).toBe(ERKANNT);

    // Der lokale Dienst hat GENAU diese Aufnahme bekommen, an seiner Schnittstelle.
    expect(dienst.anfragen).toHaveLength(1);
    expect(dienst.anfragen[0]?.pfad).toBe("/v1/audio/transcriptions");
    const koerper = dienst.anfragen[0]?.koerper ?? Buffer.alloc(0);
    expect(koerper.includes(kuenstlicheAufnahme())).toBe(true);
    expect(koerper.toString("latin1")).toContain('filename="media.wav"');

    // Und die Aufnahme hat den Prozess NUR in Richtung des eigenen Rechners verlassen.
    expect(ziele).toHaveLength(1);
    for (const ziel of ziele) {
      expect(new URL(ziel).hostname, ziel).toBe("127.0.0.1");
    }
  });

  it("L2 · auch eine VERTRAULICHE Aufnahme bleibt im Haus und wird lokal verschriftlicht", async () => {
    dienst = await starteLokalenDienst();
    const ziele = verbindungsmitschnitt();
    umgebung({ KLARWERK_LOCAL_TRANSCRIBE_URL: dienst.url });
    const analyse = await analysiere(await app(), "vertraulich");
    expect(analyse.json().engineActive).toBe(true);
    expect(analyse.json().transcript).toBe(ERKANNT);
    expect(ziele).toHaveLength(1);
    for (const ziel of ziele) {
      expect(new URL(ziel).hostname, ziel).toBe("127.0.0.1");
    }
  });

  it("L3 · ein lokaler Dienst gewinnt vor einem zusätzlich hinterlegten Cloudschlüssel", async () => {
    dienst = await starteLokalenDienst();
    const ziele = verbindungsmitschnitt();
    umgebung({ KLARWERK_LOCAL_TRANSCRIBE_URL: dienst.url, OPENAI_API_KEY: "nur-im-test" });
    const analyse = await analysiere(await app(), "intern");
    expect(analyse.json().engine).toBe("local:whisper-1");
    expect(analyse.json().transcript).toBe(ERKANNT);
    expect(ziele.some((z) => new URL(z).hostname === "api.openai.com")).toBe(false);
  });

  it("L4 · Gegenprobe: eine NICHT lokale Adresse wird wie ein externer Dienst behandelt", async () => {
    const ziele: string[] = [];
    globalThis.fetch = ((eingabe: Parameters<typeof fetch>[0], init?: RequestInit) => {
      if (init?.body instanceof FormData) {
        ziele.push(String(eingabe));
      }
      return Promise.reject(new Error("kein Netz im Test"));
    }) as typeof fetch;
    umgebung({ KLARWERK_LOCAL_TRANSCRIBE_URL: "https://transkription.example.com/v1" });
    const aufbau = await app();
    // Vertraulich: gesperrt wie bisher (keine zweite Freigabe) — es geht nichts hinaus.
    const vertraulich = await analysiere(aufbau, "vertraulich");
    expect(vertraulich.json().engineActive).toBe(false);
    expect(vertraulich.json().note).toContain("Vertrauliche");
    // Intern: ohne Freigabe für öffentliche KI geht ebenfalls nichts hinaus.
    const intern = await analysiere(aufbau, "intern");
    expect(intern.json().engineActive).toBe(false);
    expect(intern.json().note).toContain("nicht freigegeben");
    expect(ziele).toEqual([]);
  });
});

describe("gesamt-ocr · R-0181 · was als lokal gilt", () => {
  it("A1 · nur Loopback oder eine ausdrücklich freigegebene Origin", () => {
    for (const lokal of [
      "http://127.0.0.1:8000/v1",
      "http://localhost:9000/v1",
      "http://[::1]:8000/v1",
      "http://127.10.0.3/v1",
    ]) {
      expect(istBestaetigtLokaleAdresse(lokal), lokal).toBe(true);
    }
    for (const fremd of [
      "https://api.openai.com/v1",
      "http://10.0.0.5:8000/v1",
      "http://127.0.0.1.example.com/v1",
      "kein-url",
    ]) {
      expect(istBestaetigtLokaleAdresse(fremd), fremd).toBe(false);
    }
    expect(istBestaetigtLokaleAdresse("http://10.0.0.5:8000/v1", "http://10.0.0.5:8000")).toBe(
      true,
    );
  });

  it("A2 · die Factory: lokal bestätigt trägt `lokal`, eine fremde Adresse nicht", () => {
    const lokal = createCappedTranscriberFromEnv({
      KLARWERK_LOCAL_TRANSCRIBE_URL: "http://127.0.0.1:8000/v1",
    });
    expect(lokal?.name).toBe("local:whisper-1");
    expect(lokal?.lokal).toBe(true);
    const fremd = createCappedTranscriberFromEnv({
      KLARWERK_LOCAL_TRANSCRIBE_URL: "https://transkription.example.com/v1",
    });
    expect(fremd?.lokal).toBeUndefined();
    // Ohne jede Einrichtung bleibt es beim ehrlichen Inaktiv-Zustand.
    expect(createCappedTranscriberFromEnv({})).toBeUndefined();
  });

  it("A3 · eine fremde Adresse sperrt Vertrauliches am Wächter, bevor gesendet wird", async () => {
    const fremd = createCappedTranscriberFromEnv({
      KLARWERK_LOCAL_TRANSCRIBE_URL: "https://transkription.example.com/v1",
    });
    await expect(
      fremd?.transcribe(kuenstlicheAufnahme(), "audio/wav", "de", true),
    ).rejects.toThrow();
  });
});
