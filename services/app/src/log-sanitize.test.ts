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

  // WP-E3 (ben): KEY zählt als eigenes Namens-Segment — auch ohne API_-Präfix.
  it("WP-E3: KLARWERK_LOCAL_LLM_KEY wird als Secret-Name erkannt und redigiert", () => {
    const env = { KLARWERK_LOCAL_LLM_KEY: "llm-key-abcd1234" };
    const out = sanitizeLogText("LLM-Aufruf scheiterte mit llm-key-abcd1234", env);
    expect(out).not.toContain("llm-key-abcd1234");
  });

  // WP-E3 (ben): auch ein KURZ konfigurierter echter Key wird redigiert.
  it("WP-E3: kurzer konfigurierter Key (7 Zeichen) wird redigiert", () => {
    const env = { KLARWERK_ADDON_API_KEY: "kurz123" };
    const out = sanitizeLogText("Add-on-Key kurz123 abgelehnt", env);
    expect(out).not.toContain("kurz123");
  });

  // WP-E4 (ben, Abschlussoption 1): KEINE Mindestlänge für namens-erkannte Secrets — auch ein
  // 3-Zeichen-Key wird redigiert ("ein schwaches Secret bleibt ein Secret").
  it("WP-E4: 3-Zeichen-Key wird redigiert (keine Mindestlänge für Secret-Namen)", () => {
    const env = { KLARWERK_ADDON_API_KEY: "abc" };
    const out = sanitizeLogText("Add-on-Key abc abgelehnt", env);
    expect(out).not.toContain("abc");
  });

  // WP-E3 (ben): segment-genauer Namensfilter — KEYCHAIN ist KEIN Secret-Name (KEY nur als Segment).
  it("WP-E3: KEYCHAIN-benannte Variable gilt nicht als Secret", () => {
    const env = { KLARWERK_SKIP_KEYCHAIN: "macos-fallback" };
    expect(sanitizeLogText("Start mit macos-fallback ohne Schlüsselbund", env)).toBe(
      "Start mit macos-fallback ohne Schlüsselbund",
    );
  });

  it("Flag-Werte nicht-secret-benannter Variablen zerlöchern die Meldung nicht", () => {
    // WP-E3/WP-E4 (ben): der NAMENSfilter (nicht eine Längengrenze) schützt Flags — dieser Test pinnt
    // das mit einem NICHT-secret-benannten Namen, ohne eine Secret-Ausnahme als gewollt festzuschreiben.
    const env = { KLARWERK_DEV_PERSIST: "1" }; // kein Secret-Name → Wert wird nie ersetzt
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
