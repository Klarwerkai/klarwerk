import { describe, expect, it } from "vitest";
import { LadeDiagnose } from "./ladediagnose";

const asset = (name: string) => `https://app.example.test/assets/${name}.js`;

describe("UX26: begrenzte, redigierte Ladeursachen", () => {
  it("bewahrt späte Importkonsolenfehler nach Abbruchrauschen", () => {
    const d = new LadeDiagnose();
    for (let i = 0; i < 100; i++) d.abbruch(asset(`abbruch-${i}`), "net::ERR_ABORTED");
    d.konsole(
      "error",
      `${"net::ERR_ABORTED ".repeat(30)}Failed to fetch dynamically imported module: ${asset("Kapital-late")}`,
      asset("index"),
    );
    const b = d.befund();
    expect(b.fehler).toContainEqual({
      art: "console",
      typ: "error",
      ort: asset("index"),
      meldungen: ["Failed to fetch dynamically imported module", "net::ERR_ABORTED"],
      adressen: [asset("Kapital-late")],
    });
    expect(b.gruppen.rauschen).toMatchObject({ behalten: 4, ausgelassen: 96 });
    expect(b.gruppen.import.behalten).toBe(1);
    expect(b.fehler.length).toBeLessThanOrEqual(16);
  });

  it("bewahrt späte Seiten- und Asset404-Fehler bei vollen Gruppen", () => {
    const d = new LadeDiagnose();
    for (let i = 0; i < 40; i++) {
      d.abbruch(asset(`abbruch-${i}`), "net::ERR_ABORTED");
      d.seitenfehler("ReferenceError", `Privater Ausdruck bei ${asset(`seite-${i}`)}`);
      d.antwort(asset(`alt-fehlend-${i}`), 500);
    }
    d.seitenfehler("TypeError", `Error loading dynamically imported module: ${asset("Kapital")}`);
    d.antwort(asset("Kapital"), 404);
    for (let i = 0; i < 40; i++) d.antwort(asset(`erfolgreich-${i}`), 200);
    const b = d.befund();
    expect(b.fehler).toContainEqual({
      art: "pageerror",
      name: "TypeError",
      meldungen: ["Error loading dynamically imported module"],
      adressen: [asset("Kapital")],
    });
    expect(b.fehler).toContainEqual({
      art: "asset-response",
      adresse: asset("Kapital"),
      status: 404,
    });
    expect(b.fehler.length).toBeLessThanOrEqual(16);
    expect(b.assetAntworten).toHaveLength(24);
    expect(b.assetAntwortenAusgelassen).toBe(57);
    expect(b.gruppen.asset).toMatchObject({ behalten: 4, ausgelassen: 37 });
  });

  it("zählt Deduplikation und Kapazitätsverluste ehrlich", () => {
    const d = new LadeDiagnose();
    for (let i = 0; i < 4; i++) d.abbruch(`${asset("gleich")}?privat=${i}`, "net::ERR_ABORTED");
    for (let i = 0; i < 10; i++) d.abbruch(asset(`neu-${i}`), "net::ERR_ABORTED");
    const b = d.befund();
    expect(b.fehler).toHaveLength(4);
    expect(b.duplikate).toBe(3);
    expect(b.ausgelassen).toBe(7);
    expect(b.gruppen.rauschen).toEqual({
      kapazitaet: 4,
      behalten: 4,
      ausgelassen: 7,
      duplikate: 3,
    });
    expect(b.fehler.length + b.duplikate + b.ausgelassen).toBe(14);
  });

  it("redigiert sensible URLteile und verwirft private Konsolentexte", () => {
    const d = new LadeDiagnose();
    d.konsole("error", `Kundin ANNA_GEHEIM: ${asset("privater-hinweis")}`, asset("index"));
    d.konsole("warning", "PASSWORT_GEHEIM und privater Nachrichtentext", asset("index"));
    d.abbruch("https://app.example.test/api/kos/PRIVATE_ID?token=TOKEN_GEHEIM", "net::ERR_ABORTED");
    d.seitenfehler("PRIVATE_FUNCTION", "privateExpression(ANNA_GEHEIM) stack: PASSWORT_GEHEIM");
    d.konsole(
      "error",
      "Failed to fetch dynamically imported module: https://USER_GEHEIM:PASSWORT_GEHEIM@cdn.example.test/assets/Kapital.js?token=TOKEN_GEHEIM#FRAGMENT_GEHEIM privateExpression(ANNA_GEHEIM)",
      "https://USER_GEHEIM:PASSWORT_GEHEIM@cdn.example.test/index.js?token=TOKEN_GEHEIM#FRAGMENT_GEHEIM",
    );
    const b = d.befund();
    expect(b.verworfen).toBe(3);
    expect(b.fehler).toContainEqual({
      art: "console",
      typ: "error",
      ort: "https://cdn.example.test/index.js",
      meldungen: ["Failed to fetch dynamically imported module"],
      adressen: ["https://cdn.example.test/assets/Kapital.js"],
    });
    expect(b.fehler).toContainEqual({
      art: "pageerror",
      name: "anderer Fehlertyp",
      meldungen: [],
      adressen: [],
    });
    expect(JSON.stringify(b)).not.toMatch(
      /GEHEIM|PRIVATE_ID|PRIVATE_FUNCTION|privateExpression|Nachrichtentext|stack|\?|#/u,
    );
  });
});
