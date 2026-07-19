import { describe, expect, it } from "vitest";
import { sanitizeLogText } from "./log-sanitize";

// WP-E2 (ben-Auflage 2): senkenseitige Log-Redaction — generisch, ohne Kenntnis von Modul-Interna.

describe("WP-E2: sanitizeLogText", () => {
  it("entfernt Bearer-/Basic-Header, userinfo-URLs und lange Token-Wörter", () => {
    const b64 = Buffer.from("svc@x.example:tok-123456789", "utf8").toString("base64");
    const input = `auth Basic ${b64} und Bearer abcdefgh12345678 via https://svc:hunter2@host/api mit Token sk-ABCDEFGHIJKLMNOPQRSTUVWXYZ123456`;
    const out = sanitizeLogText(input, {});
    expect(out).not.toContain(b64);
    expect(out).not.toContain("abcdefgh12345678");
    expect(out).not.toContain("hunter2");
    expect(out).not.toContain("sk-ABCDEFGHIJKLMNOPQRSTUVWXYZ123456");
  });

  it("ersetzt Werte secret-benannter Env-Variablen (TOKEN/SECRET/PASSWORD/API_KEY im Namen)", () => {
    const env = {
      KLARWERK_CONFLUENCE_TOKEN: "geheim-wert-1234",
      KLARWERK_ADDON_API_KEY: "addon-key-987654",
      PORT: "3001", // kein Secret-Name → bleibt unangetastet
    };
    const out = sanitizeLogText("kaputt: geheim-wert-1234 / addon-key-987654 auf Port 3001", env);
    expect(out).not.toContain("geheim-wert-1234");
    expect(out).not.toContain("addon-key-987654");
    expect(out).toContain("3001");
  });

  it("kurze Env-Werte (Flags) zerlöchern die Meldung nicht; harmlose Texte bleiben identisch", () => {
    const env = { KLARWERK_CONFLUENCE_TOKEN: "1" }; // unter Mindestlänge → kein Split auf "1"
    expect(sanitizeLogText("Confluence-API antwortete mit 404", env)).toBe(
      "Confluence-API antwortete mit 404",
    );
    expect(sanitizeLogText("Confluence-Import fehlgeschlagen.", {})).toBe(
      "Confluence-Import fehlgeschlagen.",
    );
  });

  it("ist idempotent auf bereits redigiertem Text", () => {
    const once = sanitizeLogText("Basic QWxhZGRpbjpvcGVuIHNlc2FtZQ== bei https://a:b@h/x", {});
    expect(sanitizeLogText(once, {})).toBe(once);
  });
});
