// aufnahme:20260922:gesamt-native-apps — K1/K2/K3: DIE KLÄRUNG SAGT, WAS DER BESTAND IST.
//
// `docs/aufnahme/20260922-gesamt-native-apps.md` dokumentiert die offene Umfangsfrage zu eigenen
// Store-Apps (R-1052, Teil von R-2193) und stützt sich auf Tatsachen am Produkt: Das Pflichtenheft
// schließt Store-Apps für v1 aus, es gibt kein natives Projekt, ausgeliefert wird die installierbare
// Web-App. Dieser Test hält diese Tatsachen fest. Ändert sich eine, etwa weil eine App-Hülle
// dazukommt, wird er rot, und das Dokument muss nachgezogen werden.
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { repoPfad } from "../support/repoPfad";

const DOKUMENT = "docs/aufnahme/20260922-gesamt-native-apps.md";
const TEXT = readFileSync(repoPfad(DOKUMENT), "utf8");
const NACHZIEHEN = `${DOKUMENT} §3 nachziehen`;

function lies(relativ: string): string {
  return readFileSync(repoPfad(relativ), "utf8");
}

function eintraege(relativ: string): string[] {
  return readdirSync(repoPfad(relativ)).filter((name) => !name.startsWith("."));
}

function abschnitt(kopf: string): string {
  const start = TEXT.indexOf(`## ${kopf}`);
  expect(start, kopf).toBeGreaterThanOrEqual(0);
  const rest = TEXT.slice(start + 3);
  const ende = rest.search(/\n## /);
  return ende < 0 ? rest : rest.slice(0, ende);
}

describe("Native Store-Apps: Klärung am Bestand", () => {
  it("K1 · Pflichtenheft und Mobil-Story schließen Store-Apps für v1 aus", () => {
    const pflichtenheft = lies("specs/reference/Pflichtenheft.md");
    const ausschluss = "**Out of Scope** (Stand v1, siehe §6): native App-Store-Apps";
    expect(pflichtenheft).toContain(ausschluss);
    expect(pflichtenheft).toContain("## 6. Out of Scope (v1)\n\nNative Store-Apps;");
    const story = lies("specs/stories/mobile.md");
    expect(story).toContain("## Nicht-Ziele (v1)\nNative Store-Apps (Out of Scope §6).");
    // Der Ausschluss gilt nur, solange die Produktlinie v1 ist.
    const paket = JSON.parse(lies("package.json")) as { version: string };
    expect(paket.version.startsWith("1.")).toBe(true);
  });

  it("K1 · drei Alternativen, Entscheidung offen, keine Umsetzung bestellt", () => {
    const frage = abschnitt("2. Offene Geltungs-/Umfangsfrage");
    for (const kennung of ["| A |", "| B |", "| C |"]) {
      expect(frage).toContain(kennung);
    }
    expect(frage).toContain("**Noch erforderliche Entscheidung (Pedi):**");
    expect(frage).toContain("**Eindeutig bestellter Anteil:** nur diese Dokumentation.");
  });

  it("K2 · kein natives Projekt, keine App-Hülle: ausgeliefert wird die Web-App", () => {
    expect(eintraege("apps"), NACHZIEHEN).toEqual(["web"]);
    const web = eintraege("apps/web");
    expect(web, NACHZIEHEN).not.toContain("android");
    expect(web, NACHZIEHEN).not.toContain("ios");
    expect(
      web.some((name) => name.startsWith("capacitor.config")),
      NACHZIEHEN,
    ).toBe(false);
    const abhaengigkeiten = lies("apps/web/package.json");
    expect(abhaengigkeiten, NACHZIEHEN).not.toMatch(/@capacitor\/|cordova|react-native|"expo"/i);

    const manifest = lies("apps/web/public/manifest.webmanifest");
    expect(JSON.parse(manifest).display).toBe("standalone");
    expect(existsSync(repoPfad("apps/web/public/sw.js"))).toBe(true);
  });

  it("K3 · jeder genannte Repopfad existiert", () => {
    const treffer = TEXT.matchAll(/`((?:apps|specs|tests|docs)\/[^`\s*<…]+)`/g);
    const pfade = [...treffer].map((m) => m[1] ?? "");
    expect(pfade.length).toBeGreaterThan(8);
    for (const pfad of pfade) {
      expect(existsSync(repoPfad(pfad)), `${DOKUMENT} nennt ${pfad}`).toBe(true);
    }
  });

  it("K3 · gesonderte Aufträge aus R-2193 werden abgegrenzt, nicht neu bestellt", () => {
    const abgrenzung = abschnitt("1. Abgrenzung");
    for (const teil of [
      "gesamt-adoption",
      "-anlagendaten-abgleich",
      "-bi-anbindung",
      "-chat-import",
      "-email-eingang",
      "-instanztrennung",
    ]) {
      expect(abgrenzung).toContain(teil);
    }
    expect(abgrenzung).toContain("Bestellt wird damit nichts neu.");
  });
});
