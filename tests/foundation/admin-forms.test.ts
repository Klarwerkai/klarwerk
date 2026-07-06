import { describe, expect, it } from "vitest";
import {
  MIN_PASSWORD,
  isNewUserValid,
  isPasswordResetValid,
  isUserAuditAction,
  passwordRepeatMismatch,
} from "../../apps/web/src/lib/adminForms";

describe("SCRUM-147: Nutzer-anlegen-Validierung", () => {
  it("verlangt Name, plausible E-Mail und Passwort ≥ 8", () => {
    expect(isNewUserValid({ name: "Pedi", email: "p@x.de", password: "secret123" })).toBe(true);
    expect(isNewUserValid({ name: "", email: "p@x.de", password: "secret123" })).toBe(false);
    expect(isNewUserValid({ name: "Pedi", email: "keine-mail", password: "secret123" })).toBe(
      false,
    );
    expect(isNewUserValid({ name: "Pedi", email: "p@x.de", password: "kurz" })).toBe(false);
  });
});

describe("SCRUM-148 / SCRUM-455: Passwort-Reset-Validierung mit Wiederholung", () => {
  it("verlangt mindestens MIN_PASSWORD Zeichen UND identische Wiederholung", () => {
    expect(MIN_PASSWORD).toBe(8);
    expect(isPasswordResetValid("neuespass1", "neuespass1")).toBe(true);
    // zu kurz — auch wenn beide gleich sind
    expect(isPasswordResetValid("kurz", "kurz")).toBe(false);
    // lang genug, aber Wiederholung weicht ab (Vertipper)
    expect(isPasswordResetValid("neuespass1", "neuespass2")).toBe(false);
    expect(isPasswordResetValid("neuespass1", "")).toBe(false);
  });

  it("passwordRepeatMismatch meldet erst, wenn im Wiederholfeld etwas steht", () => {
    // leeres Wiederholfeld → noch kein Fehler (Nutzer tippt gerade)
    expect(passwordRepeatMismatch("neuespass1", "")).toBe(false);
    // etwas getippt, weicht ab → ehrlicher Hinweis
    expect(passwordRepeatMismatch("neuespass1", "neuespass2")).toBe(true);
    // identisch → kein Hinweis
    expect(passwordRepeatMismatch("neuespass1", "neuespass1")).toBe(false);
  });
});

describe("SCRUM-149: Audit-Aktion-Filter", () => {
  it("zeigt nur nutzer-/auth-relevante Aktionen", () => {
    expect(isUserAuditAction("user.role-change")).toBe(true);
    expect(isUserAuditAction("auth.login")).toBe(true);
    expect(isUserAuditAction("ko.created")).toBe(false);
    expect(isUserAuditAction("conflict.resolved")).toBe(false);
  });
});
