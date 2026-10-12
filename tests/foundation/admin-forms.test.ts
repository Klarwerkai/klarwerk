import { describe, expect, it } from "vitest";
import {
  MIN_PASSWORD,
  isPasswordResetValid,
  isUserAuditAction,
  newUserIssues,
  passwordRepeatMismatch,
} from "../../apps/web/src/lib/adminForms";

// R-1349: gemessen an `newUserIssues`, dem Weg, den die Nutzeranlage wirklich fragt — das frühere
// Ja/Nein `isNewUserValid` hatte keinen Produktleser und ist entfernt.
describe("SCRUM-147: Nutzer-anlegen-Validierung", () => {
  it("verlangt Name, plausible E-Mail und Passwort ≥ 8", () => {
    expect(newUserIssues({ name: "Pedi", email: "p@x.de", password: "secret123" })).toEqual([]);
    expect(newUserIssues({ name: "", email: "p@x.de", password: "secret123" })).toEqual(["name"]);
    expect(newUserIssues({ name: "Pedi", email: "keine-mail", password: "secret123" })).toEqual([
      "email",
    ]);
    expect(newUserIssues({ name: "Pedi", email: "p@x.de", password: "kurz" })).toEqual([
      "password",
    ]);
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
