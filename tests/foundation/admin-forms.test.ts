import { describe, expect, it } from "vitest";
import {
  MIN_PASSWORD,
  isNewUserValid,
  isPasswordResetValid,
  isUserAuditAction,
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

describe("SCRUM-148: Passwort-Reset-Validierung", () => {
  it("verlangt mindestens MIN_PASSWORD Zeichen", () => {
    expect(MIN_PASSWORD).toBe(8);
    expect(isPasswordResetValid("neuespass1")).toBe(true);
    expect(isPasswordResetValid("kurz")).toBe(false);
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
