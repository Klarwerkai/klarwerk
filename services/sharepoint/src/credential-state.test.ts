// JOB 4086: der Zustand des Zugangs — je Variable ja/nein, NIE ein Wert und nie eine Länge.
import { describe, expect, it } from "vitest";
import {
  SHAREPOINT_CREDENTIAL_VARS,
  istHttpsAdresse,
  sharepointCredentialState,
} from "./credential-state";

const VOLL = {
  KLARWERK_SHAREPOINT_BASE_URL: "https://graph.microsoft.test/v1.0",
  KLARWERK_SHAREPOINT_TOKEN: "ein-geheimnis-das-hier-nie-erscheinen-darf",
  KLARWERK_SHAREPOINT_DRIVE: "b!bibliothek",
};

describe("JOB 4086: sharepointCredentialState", () => {
  it("vollständig und https ⇒ usable, kein Blocker", () => {
    const zustand = sharepointCredentialState(VOLL);
    expect(zustand.usable).toBe(true);
    expect(zustand.blocker).toBeNull();
    expect(zustand.vars.map((v) => v.name)).toEqual([...SHAREPOINT_CREDENTIAL_VARS]);
    expect(zustand.vars.every((v) => v.present)).toBe(true);
  });

  it("KEIN WERT UND KEINE LÄNGE verlässt diese Funktion", () => {
    const ausgabe = JSON.stringify(sharepointCredentialState(VOLL));
    expect(ausgabe).not.toContain("ein-geheimnis-das-hier-nie-erscheinen-darf");
    // Auch keine Maske: ein „••••••••" neben dem Namen verriete die Länge.
    expect(ausgabe).not.toContain("•");
    expect(ausgabe).not.toContain("*");
    // Und der Typ trägt gar kein Feld, in das ein Wert passte.
    for (const v of sharepointCredentialState(VOLL).vars) {
      expect(Object.keys(v).sort()).toEqual(["name", "present"]);
    }
  });

  it("eine gesetzte, aber LEERE Variable gilt als nicht gesetzt", () => {
    const zustand = sharepointCredentialState({ ...VOLL, KLARWERK_SHAREPOINT_TOKEN: "" });
    expect(zustand.usable).toBe(false);
    expect(zustand.blocker).toBe("missing");
    expect(zustand.vars.find((v) => v.name === "KLARWERK_SHAREPOINT_TOKEN")?.present).toBe(false);
  });

  it("alles gesetzt, aber nicht https ⇒ eigener Blocker (sonst sähe es aus wie ein Fehler)", () => {
    for (const adresse of ["http://graph.microsoft.test/v1.0", "keine-adresse"]) {
      const zustand = sharepointCredentialState({
        ...VOLL,
        KLARWERK_SHAREPOINT_BASE_URL: adresse,
      });
      expect(zustand.usable, adresse).toBe(false);
      expect(zustand.blocker, adresse).toBe("insecure-base-url");
      // Die drei Variablen STEHEN trotzdem — die Fläche soll beides unterscheiden können.
      expect(
        zustand.vars.every((v) => v.present),
        adresse,
      ).toBe(true);
    }
  });

  it("der HTTPS-Riegel ist EINE Funktion — Resolver und Auskunft benutzen dieselbe", () => {
    expect(istHttpsAdresse("https://graph.microsoft.test")).toBe(true);
    expect(istHttpsAdresse("http://graph.microsoft.test")).toBe(false);
    expect(istHttpsAdresse(undefined)).toBe(false);
    expect(istHttpsAdresse("")).toBe(false);
  });
});
