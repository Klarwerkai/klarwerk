// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import Fastify from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { pickVoice, sprecheLokal } from "../../apps/web/src/lib/vorlesen";
import { registerSecurityHeaders } from "../../services/app/src/security-headers";
import { baueFrischeBuehne, schliesseBuehnen } from "../beta-rollenabnahme/buehne";
import { harness } from "../klara-browser/harness";
const read = (p: string) => readFileSync(p, "utf8");
afterEach(async () => {
  await schliesseBuehnen();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
  (globalThis as unknown as Record<string, unknown>).KlaraBrowserAktion = undefined;
});
describe("W4.6 ausgelieferte Browser-/Officewege ohne echten Host", () => {
  it("Begleitseite erhält genau die bestehende Office-CSP-Ausnahme, ähnliche Pfade behalten die enge CSP", async () => {
    const app = Fastify();
    await registerSecurityHeaders(app, {});
    const paths = [
      "/word-addin/begleitung.html",
      "/word-addin/begleitung.html/anders",
      "/word-addin/anders.html",
    ];
    for (const p of paths) app.get(p, async () => "<p>x</p>");
    for (const [i, p] of paths.entries()) {
      const r = await app.inject({ method: "GET", url: `${p}?v=1` });
      const csp = String(r.headers["content-security-policy"]);
      expect(csp.includes("appsforoffice.microsoft.com")).toBe(i === 0);
    }
    await app.close();
  });
  it("tatsächlicher Memo-/Zurufabruf erhält 15 Sekunden; die kurze Anmeldefrist bleibt 5 Sekunden", async () => {
    const src = read("apps/web/public/word-addin/taskpane.js");
    const konst = /var WORD_ADDIN_LOGIN_FETCH_TIMEOUT_MS = \d+;/.exec(src)?.[0];
    const start = src.indexOf("function klaraS4Abruf(");
    const end = src.indexOf("// ====", start);
    let ms = 0;
    const factory = new Function(
      "fetch",
      "klaraS4Header",
      "setTimeout",
      "clearTimeout",
      `${String(konst)}\n${src.slice(start, end)}\nreturn klaraS4Abruf;`,
    );
    const fn = factory(
      async () => ({ ok: true, json: async () => ({ memo: "fertig" }) }),
      () => ({}),
      (_fn: () => void, n: number) => {
        ms = n;
        return 1;
      },
      () => {},
    );
    await fn("/api/klara/sessions/s1/zuruf", "POST", {});
    expect(ms).toBe(15000);
    await fn("/api/klara/sessions", "POST", {});
    expect(ms).toBe(5000);
  });
  it("Browserübergabe nutzt normale Auth und einmaligen sitzungsgebundenen Code; fremder Sender und Wiederholung scheitern", async () => {
    const w = await baueFrischeBuehne();
    const headers = { authorization: `Bearer ${w.sitzung.experte}` };
    const noAuth = await w.app.inject({ method: "POST", url: "/api/auth/office-handover" });
    expect(noAuth.statusCode).toBe(401);
    const code = await w.app.inject({ method: "POST", url: "/api/auth/office-handover", headers });
    expect(code.statusCode).toBe(201);
    let calls = 0;
    const fetcher: typeof fetch = async (input, options) => {
      expect(new URL(String(input)).origin).toBe("https://app.klarwerk.ai");
      expect(options?.redirect).toBe("error");
      expect(options?.credentials).toBe("omit");
      calls++;
      const r = await w.app.inject({
        method: "POST",
        url: new URL(String(input)).pathname,
        payload: JSON.parse(String(options?.body ?? "{}")),
      });
      return new Response(r.body, { status: r.statusCode });
    };
    const h = harness(fetcher);
    const denied = await h.sendRaw(
      { type: "browserLogin", code: code.json().code },
      { id: "fremde-erweiterung", url: "https://fremd.test" },
    );
    expect(denied.user).toBeUndefined();
    expect(calls).toBe(0);
    const result = await h.send({ type: "browserLogin", code: code.json().code });
    expect(result.user?.id).toBe(w.konto.experte.id);
    expect(calls).toBe(1);
    expect(
      (
        await w.app.inject({
          method: "POST",
          url: "/api/auth/office-handover/redeem",
          payload: { code: code.json().code },
        })
      ).statusCode,
    ).toBe(401);
    expect(read("extensions/klara-browser/panel.html")).toContain(
      "https://app.klarwerk.ai/profil?bereich=assistenz",
    );
  });
  it.each([false, undefined])(
    "Netz- oder unbestätigte Stimmen werden nicht gesprochen: %s",
    (localService) => {
      const speak = vi.fn();
      const alert = vi.spyOn(window, "alert").mockImplementation(() => {});
      vi.stubGlobal("speechSynthesis", {
        getVoices: () => [{ name: "Google Premium", lang: "de-DE", localService }],
        speak,
      });
      expect(pickVoice("de")).toBeNull();
      expect(sprecheLokal({ lang: "de-DE" } as SpeechSynthesisUtterance)).toBe(false);
      expect(speak).not.toHaveBeenCalled();
      expect(alert).toHaveBeenCalledWith(expect.stringContaining("Keine lokale Stimme"));
    },
  );
  it("ausdrücklich lokale Stimme wird ausgewählt und alle tatsächlichen Callerseiten benutzen die gemeinsame Schranke", () => {
    const local = { name: "Anna", lang: "de-DE", localService: true };
    const speak = vi.fn();
    vi.stubGlobal("speechSynthesis", {
      getVoices: () => [{ name: "Google Premium", lang: "de-DE", localService: false }, local],
      speak,
    });
    const u = { lang: "de-DE" } as SpeechSynthesisUtterance;
    expect(sprecheLokal(u)).toBe(true);
    expect(u.voice).toBe(local);
    expect(speak).toHaveBeenCalledOnce();
    for (const p of [
      "pages/Capture.tsx",
      "tutorial/TutorialBereich.tsx",
      "components/fragen/useVorlesen.ts",
      "components/klara-vorschau/vorlesen.ts",
      "components/KlaraAssistant.tsx",
    ]) {
      const code = read(`apps/web/src/${p}`);
      expect(code, p).toContain("sprecheLokal(u)");
      expect(code, p).not.toContain("speechSynthesis.speak(");
    }
  });
});
