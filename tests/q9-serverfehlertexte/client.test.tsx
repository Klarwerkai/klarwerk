import { afterEach, expect, it, vi } from "vitest";
import i18n from "../../apps/web/node_modules/i18next";
import { ApiError, api } from "../../apps/web/src/api/client";

afterEach(() => {
  vi.unstubAllGlobals();
});

it("R7 aktive Sprache EN/DE/NL geht bei allen Methoden mit; Anfrage und ApiError bleiben erhalten", async () => {
  await i18n.init({ lng: "de", resources: {} });
  // Persistenz kann fehlen oder älter als die aktive Wahl sein (z. B. Sprache im Eintrittslink).
  vi.stubGlobal("localStorage", {
    getItem: () => "de",
    setItem: () => {
      throw new Error("blocked");
    },
  });
  const fetchSpy = vi
    .fn()
    .mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
  vi.stubGlobal("fetch", fetchSpy);
  for (const sprache of ["en", "de", "nl"]) {
    await i18n.changeLanguage(sprache);
    for (const [method, call, body] of [
      ["GET", () => api.get("/auth/me"), undefined],
      [
        "POST",
        () => api.post("/auth/login", { email: "a@b.test", password: "wrong" }),
        JSON.stringify({ email: "a@b.test", password: "wrong" }),
      ],
      ["PUT", () => api.put("/users/id", { approve: true }), JSON.stringify({ approve: true })],
      ["DELETE", () => api.del("/users/id"), undefined],
      [
        "POST",
        () => api.postWithTimeout("/auth/reset", { token: "invalid" }, 1000),
        JSON.stringify({ token: "invalid" }),
      ],
    ] as const) {
      fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
      expect(await call()).toEqual({ ok: true });
      const [url, init] = fetchSpy.mock.lastCall as unknown as [string, RequestInit];
      expect(url).toMatch(/^\/api\//);
      expect(init.credentials).toBe("include");
      expect(init.method ?? "GET").toBe(method);
      expect(init.body).toBe(body);
      const headers = new Headers(init.headers);
      expect.soft(headers.get("Accept-Language")).toBe(sprache);
      expect(headers.get("Content-Type")).toBe(body ? "application/json" : null);
      expect([...headers.keys()].sort()).toEqual(
        body ? ["accept-language", "content-type"] : ["accept-language"],
      );
    }
  }
  fetchSpy.mockResolvedValueOnce(
    new Response(
      JSON.stringify({ error: "INVALID_CREDENTIALS", message: "Email or password is incorrect." }),
      { status: 401 },
    ),
  );
  const error = await api.post("/auth/login", {}).catch((e: unknown) => e);
  expect(error).toBeInstanceOf(ApiError);
  expect(error).toMatchObject({
    status: 401,
    code: "INVALID_CREDENTIALS",
    message: "Email or password is incorrect.",
  });
});
