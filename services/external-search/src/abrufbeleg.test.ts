// REF-01 (Ben nacharbeit-7 K2): der serverseitige Abrufbeleg. Fiktive Inhalte, kein Netz.
import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { abrufFingerabdruck, pruefeAbrufbeleg, stelleAbrufbelegAus } from "./abrufbeleg";

const ABRUF = {
  url: "https://de.wikipedia.org/wiki/Fiktivmetall",
  inhalt: "Fiktivmetall schmilzt bei 1234 °C. Es ist erfunden.",
  abgerufenAm: "2026-10-08T07:00:00.000Z",
};

describe("REF-01 · Abrufbeleg der externen Suche", () => {
  it("gültiger Beleg: Abrufzeit und Inhaltsfingerabdruck des tatsächlich abgerufenen Inhalts", () => {
    const beleg = stelleAbrufbelegAus(ABRUF);
    expect(pruefeAbrufbeleg(beleg, { url: ABRUF.url, excerpt: ABRUF.inhalt })).toEqual({
      abgerufenAm: ABRUF.abgerufenAm,
      inhaltFingerabdruck: abrufFingerabdruck(ABRUF.inhalt),
    });
    // Die Fläche kürzt lange Treffertexte — ein ANFANG des abgerufenen Inhalts ist derselbe Abruf.
    const gekuerzt = pruefeAbrufbeleg(beleg, {
      url: ABRUF.url,
      excerpt: "Fiktivmetall schmilzt bei 1234 °C.",
    });
    expect(gekuerzt?.abgerufenAm).toBe(ABRUF.abgerufenAm);
  });

  it("keine Abrufzeit ohne Nachweis: andere Adresse, anderer Inhalt, Fälschung, fremder Schlüssel", () => {
    const beleg = stelleAbrufbelegAus(ABRUF);
    expect(
      pruefeAbrufbeleg(beleg, { url: "https://example.invalid/kopie", excerpt: ABRUF.inhalt }),
    ).toBeNull();
    expect(
      pruefeAbrufbeleg(beleg, { url: ABRUF.url, excerpt: "Fiktivmetall schmilzt bei 999 °C." }),
    ).toBeNull();
    expect(pruefeAbrufbeleg(beleg, { url: ABRUF.url, excerpt: "" })).toBeNull();
    const [rumpf] = beleg.split(".");
    expect(
      pruefeAbrufbeleg(`${rumpf}.gefaelscht`, { url: ABRUF.url, excerpt: ABRUF.inhalt }),
    ).toBeNull();
    const fremd = stelleAbrufbelegAus(ABRUF, randomBytes(32));
    expect(pruefeAbrufbeleg(fremd, { url: ABRUF.url, excerpt: ABRUF.inhalt })).toBeNull();
    expect(pruefeAbrufbeleg(undefined, { url: ABRUF.url, excerpt: ABRUF.inhalt })).toBeNull();
    expect(pruefeAbrufbeleg("kein-beleg", { url: ABRUF.url, excerpt: ABRUF.inhalt })).toBeNull();
  });
});
