// WP-BILD-1c/1f: describe hat eine EIGENE Route (/api/reasoner/describe) — bens P2: NUR der
// Bild-Task trägt die große Parsergrenze (der Text-Dispatcher behält den 1-MiB-Default), mit Auth
// VOR dem großen Parse; bens P3: strikte, frühe Validierung (kein SVG, MIME gegen Magic Bytes,
// strikte Base64, DEKODIERTE Bytegrenze) — bei JEDER Ablehnung null Provider-/HTTP-Aufrufe.
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { MAX_DESCRIBE_IMAGE_BYTES } from "../../services/reasoner";

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG_MAGIC = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]);

const pngUrl = (extraBytes = 8): string =>
  `data:image/png;base64,${Buffer.concat([PNG_MAGIC, Buffer.alloc(extraBytes)]).toString("base64")}`;

type TestServices = ReturnType<typeof buildServices>;

// Spy DIREKT am Provider-Eintritt: jede Ablehnung an der Route darf diesen Aufruf nie erreichen.
function withDescribeSpy(services: TestServices): ReturnType<typeof vi.fn> {
  const spy = vi.fn(async () => ({
    text: null,
    demo: true as const,
    fallbackReason: "no-model" as const,
  }));
  services.reasoner.describeImage = spy as unknown as typeof services.reasoner.describeImage;
  return spy;
}

async function loginHeaders(app: ReturnType<typeof buildApp>): Promise<{ authorization: string }> {
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Nutzer", email: "n@x.de", password: "secret123" },
  });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "n@x.de", password: "secret123" },
  });
  return { authorization: `Bearer ${(login.json() as { token: string }).token}` };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("WP-BILD-1f (bens P2): task-spezifische Parsergrenzen", () => {
  it("TEXT-Task mit >1-MiB-Body wird an der KLEINEN Grenze abgewiesen (413, Fastify-Default)", async () => {
    const app = buildApp(buildServices());
    const headers = await loginHeaders(app);
    const res = await app.inject({
      method: "POST",
      url: "/api/reasoner",
      headers,
      payload: { task: "structure", text: "x".repeat(1_100_000) },
    });
    expect(res.statusCode).toBe(413);
  });

  it("describe mit GROSSEM gültigem Bild (~2 MB) passiert die große Grenze → 200", async () => {
    const app = buildApp(buildServices());
    const headers = await loginHeaders(app);
    const res = await app.inject({
      method: "POST",
      url: "/api/reasoner/describe",
      headers,
      payload: { dataUrl: pngUrl(2_000_000), source: "draft", confidentiality: "intern" },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { text: string | null; demo: boolean; fallbackReason?: string };
    expect(body.text).toBeNull();
    expect(body.fallbackReason).toBe("no-model"); // Testumgebung ohne Modell: ehrlich, kein Pseudo-Text
  });

  it("AUTH läuft VOR dem großen Parse: anonymer 2-MB-Request → 401 (nicht 413/400)", async () => {
    const app = buildApp(buildServices());
    const res = await app.inject({
      method: "POST",
      url: "/api/reasoner/describe",
      payload: { dataUrl: pngUrl(2_000_000) },
    });
    expect(res.statusCode).toBe(401);
  });
});

describe("WP-BILD-1f (bens P3): strikte, frühe Bild-Validierung — null Provider-Aufrufe bei Ablehnung", () => {
  async function reject(
    payloadDataUrl: string,
  ): Promise<{ status: number; providerCalls: number }> {
    const services = buildServices();
    const spy = withDescribeSpy(services);
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const app = buildApp(services);
    const headers = await loginHeaders(app);
    const res = await app.inject({
      method: "POST",
      url: "/api/reasoner/describe",
      headers,
      payload: { dataUrl: payloadDataUrl },
    });
    // Bei Ablehnung: weder der Reasoner-Provider noch irgendein HTTP-Egress wurde berührt.
    expect(fetchSpy).not.toHaveBeenCalled();
    return { status: res.statusCode, providerCalls: spy.mock.calls.length };
  }

  it("SVG wird abgelehnt (400) — kein Provider-Aufruf", async () => {
    const svg = `data:image/svg+xml;base64,${Buffer.from("<svg/>").toString("base64")}`;
    expect(await reject(svg)).toEqual({ status: 400, providerCalls: 0 });
  });

  it("MIME/Magic-Mismatch (deklariert png, Inhalt jpeg) wird abgelehnt (400) — kein Provider-Aufruf", async () => {
    const lying = `data:image/png;base64,${JPEG_MAGIC.toString("base64")}`;
    expect(await reject(lying)).toEqual({ status: 400, providerCalls: 0 });
  });

  it("defekte Base64 wird abgelehnt (400) — kein Provider-Aufruf", async () => {
    expect(await reject("data:image/png;base64,AB")).toEqual({ status: 400, providerCalls: 0 });
    expect(await reject("data:image/png;base64,A=BC")).toEqual({ status: 400, providerCalls: 0 });
  });

  it("DEKODIERTE Bytegrenze: gültige Base64 über 5 MB dekodiert → 413 — kein Provider-Aufruf", async () => {
    // 6.996.000 Zeichen dekodieren zu 5.247.000 Bytes > MAX_DESCRIBE_IMAGE_BYTES (String-Deckel
    // 7 Mio. greift NICHT — es ist wirklich die Byte-Prüfung).
    const chars = 6_996_000;
    expect((chars / 4) * 3 > MAX_DESCRIBE_IMAGE_BYTES).toBe(true);
    const huge = `data:image/png;base64,${"A".repeat(chars)}`;
    expect(await reject(huge)).toEqual({ status: 413, providerCalls: 0 });
  });

  it("gültiges kleines PNG passiert die Validierung und erreicht den Provider genau einmal", async () => {
    const services = buildServices();
    const spy = withDescribeSpy(services);
    const app = buildApp(services);
    const headers = await loginHeaders(app);
    const res = await app.inject({
      method: "POST",
      url: "/api/reasoner/describe",
      headers,
      payload: { dataUrl: pngUrl(), source: "draft", confidentiality: "intern" },
    });
    expect(res.statusCode).toBe(200);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0]?.[0]).toBe(pngUrl());
  });
});
