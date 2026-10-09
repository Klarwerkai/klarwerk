// ================================================================================================
// R-1034 / FR-I18N-02 · ÜBERSETZUNGEN IM LAUFENDEN BETRIEB PFLEGEN — AM DRAHT DER VOLLEN APP.
// ================================================================================================
//
// K1 „Texte sollen im laufenden Betrieb übersetzt und angepasst werden können, ohne den Code zu
// ändern": ein Admin setzt einen Text über HTTP, jeder — auch ohne Anmeldung — liest ihn über den
// öffentlichen Leseweg, „Zurücksetzen" nimmt ihn wieder weg. Nur `users.manage` darf schreiben.
//
// K2 „Neue Sprache ohne Code-Umbau ergänzbar": eine Sprache wird angelegt, erscheint in
// `/api/i18n/locales` und nimmt danach Texte an — ohne Bau, ohne Neustart.
//
// Jede Messung läuft an einer EIGENEN frischen Bühne (`baueFrischeBuehne`): dieselbe `buildApp`-
// Wurzel und dieselben vier Prüfkonten wie die Rollenabnahme, kein Bestand aus einem anderen Fall.
import { afterEach, describe, expect, it } from "vitest";
import {
  type FrischeBuehne,
  baueFrischeBuehne,
  kopfFuer,
  schliesseBuehnen,
} from "../beta-rollenabnahme/buehne";

afterEach(async () => {
  await schliesseBuehnen();
});

const SCHLUESSEL = "adm.backup.title";

async function setze(
  b: FrischeBuehne,
  akteur: "anonym" | "viewer" | "experte" | "controller" | "admin",
  sprache: string,
  text: unknown,
) {
  return b.app.inject({
    method: "PUT",
    url: `/api/admin/i18n/${sprache}/${SCHLUESSEL}`,
    headers: kopfFuer(b, akteur),
    payload: { text },
  });
}

describe("K1 · ein Text wird im Betrieb angepasst und wieder zurückgesetzt", () => {
  it("setzen → öffentlich lesbar → zurücksetzen; Prüfprotokoll ohne den Text", async () => {
    const b = await baueFrischeBuehne();

    // Vorher: nichts gepflegt.
    const vorher = await b.app.inject({ method: "GET", url: "/api/i18n/de" });
    expect(vorher.statusCode).toBe(200);
    expect(vorher.json()).toEqual({ sprache: "de", texte: {} });

    const gesetzt = await setze(b, "admin", "de", "Datensicherung");
    expect(gesetzt.statusCode, gesetzt.body).toBe(200);
    expect(gesetzt.json()).toEqual({
      sprache: "de",
      schluessel: SCHLUESSEL,
      text: "Datensicherung",
    });

    // Öffentlich — ohne Anmeldung, wie die Anmeldemaske ihn braucht.
    const gelesen = await b.app.inject({ method: "GET", url: "/api/i18n/de" });
    expect(gelesen.json()).toEqual({ sprache: "de", texte: { [SCHLUESSEL]: "Datensicherung" } });
    const einzeln = await b.app.inject({ method: "GET", url: `/api/i18n/de/${SCHLUESSEL}` });
    expect(einzeln.json()).toEqual({ value: "Datensicherung" });
    // Andere Sprachen bleiben unberührt.
    expect((await b.app.inject({ method: "GET", url: "/api/i18n/en" })).json().texte).toEqual({});

    // Überschreiben ersetzt, statt eine zweite Zeile anzulegen.
    expect((await setze(b, "admin", "de", "Sicherungen")).statusCode).toBe(200);
    expect((await b.app.inject({ method: "GET", url: "/api/i18n/de" })).json().texte).toEqual({
      [SCHLUESSEL]: "Sicherungen",
    });

    const zurueck = await b.app.inject({
      method: "DELETE",
      url: `/api/admin/i18n/de/${SCHLUESSEL}`,
      headers: kopfFuer(b, "admin"),
    });
    expect(zurueck.statusCode).toBe(200);
    expect(zurueck.json()).toEqual({ sprache: "de", schluessel: SCHLUESSEL, entfernt: true });
    expect((await b.app.inject({ method: "GET", url: "/api/i18n/de" })).json().texte).toEqual({});

    // Wer, was, woran — aber nicht der Text selbst.
    const gesetztEintraege = await b.services.audit.list({ action: "i18n.text-set" });
    expect(gesetztEintraege).toHaveLength(2);
    expect(gesetztEintraege[0]?.actor).toBe(b.konto.admin.id);
    expect(gesetztEintraege[0]?.target).toBe(`de:${SCHLUESSEL}`);
    expect(JSON.stringify(gesetztEintraege)).not.toContain("Datensicherung");
    expect(await b.services.audit.list({ action: "i18n.text-reset" })).toHaveLength(1);
    await b.schliesse();
  });

  it("nur users.manage schreibt: anonym 401, die drei übrigen Rollen 403 — und nichts wird gespeichert", async () => {
    const b = await baueFrischeBuehne();
    expect((await setze(b, "anonym", "de", "x")).statusCode).toBe(401);
    for (const rolle of ["viewer", "experte", "controller"] as const) {
      expect((await setze(b, rolle, "de", "x")).statusCode, rolle).toBe(403);
      const loeschen = await b.app.inject({
        method: "DELETE",
        url: `/api/admin/i18n/de/${SCHLUESSEL}`,
        headers: kopfFuer(b, rolle),
      });
      expect(loeschen.statusCode, rolle).toBe(403);
    }
    expect((await b.app.inject({ method: "GET", url: "/api/i18n/de" })).json().texte).toEqual({});
    await b.schliesse();
  });

  it("unzulässige Eingaben werden abgewiesen und nicht gespeichert", async () => {
    const b = await baueFrischeBuehne();
    expect((await setze(b, "admin", "de", "")).json().error).toBe("INVALID_TEXT");
    expect((await setze(b, "admin", "de", "   ")).json().error).toBe("INVALID_TEXT");
    expect((await setze(b, "admin", "de", 42)).json().error).toBe("INVALID_TEXT");
    expect((await setze(b, "admin", "de", "x".repeat(4001))).json().error).toBe("INVALID_TEXT");
    // Eine Sprache, die weder mitgeliefert noch angelegt ist, nimmt keine Texte an.
    expect((await setze(b, "admin", "fr", "Sauvegarde")).json().error).toBe("UNKNOWN_LOCALE");
    expect((await b.app.inject({ method: "GET", url: "/api/i18n/de" })).json().texte).toEqual({});
    expect((await b.app.inject({ method: "GET", url: "/api/i18n/fr" })).json().texte).toEqual({});
    await b.schliesse();
  });

  it("Zurücksetzen ohne Anpassung ist folgenlos und schreibt kein Protokoll", async () => {
    const b = await baueFrischeBuehne();
    const zurueck = await b.app.inject({
      method: "DELETE",
      url: `/api/admin/i18n/de/${SCHLUESSEL}`,
      headers: kopfFuer(b, "admin"),
    });
    expect(zurueck.json()).toEqual({ sprache: "de", schluessel: SCHLUESSEL, entfernt: false });
    expect(await b.services.audit.list({ action: "i18n.text-reset" })).toHaveLength(0);
    await b.schliesse();
  });
});

describe("K2 · eine weitere Sprache wird ohne Code ergänzt", () => {
  it("anlegen → in /api/i18n/locales → Texte übersetzbar", async () => {
    const b = await baueFrischeBuehne();
    const vorher = (await b.app.inject({ method: "GET", url: "/api/i18n/locales" })).json();
    expect(vorher.locales).toEqual(["de", "en", "nl"]);

    const angelegt = await b.app.inject({
      method: "PUT",
      url: "/api/admin/i18n-sprachen/fr",
      headers: kopfFuer(b, "admin"),
      payload: { name: "Français" },
    });
    expect(angelegt.statusCode, angelegt.body).toBe(200);
    expect(angelegt.json()).toEqual({ kennung: "fr", name: "Français" });

    const nachher = (await b.app.inject({ method: "GET", url: "/api/i18n/locales" })).json();
    expect(nachher.locales).toEqual(["de", "en", "nl", "fr"]);
    expect(nachher.sprachen).toContainEqual({
      kennung: "fr",
      name: "Français",
      grundsprache: false,
    });
    expect(nachher.sprachen).toContainEqual({ kennung: "de", name: null, grundsprache: true });

    expect((await setze(b, "admin", "fr", "Sauvegarde")).statusCode).toBe(200);
    expect((await b.app.inject({ method: "GET", url: "/api/i18n/fr" })).json()).toEqual({
      sprache: "fr",
      texte: { [SCHLUESSEL]: "Sauvegarde" },
    });
    expect(await b.services.audit.list({ action: "i18n.language-set" })).toHaveLength(1);
    await b.schliesse();
  });

  it("die mitgelieferten Sprachen und ungültige Kennungen sind keine anlegbaren Sprachen", async () => {
    const b = await baueFrischeBuehne();
    for (const kennung of ["de", "en", "nl", "FR", "x", "fr_FR", "abcd"]) {
      const antwort = await b.app.inject({
        method: "PUT",
        url: `/api/admin/i18n-sprachen/${kennung}`,
        headers: kopfFuer(b, "admin"),
        payload: { name: "Name" },
      });
      expect(antwort.statusCode, kennung).toBe(400);
    }
    const ohneName = await b.app.inject({
      method: "PUT",
      url: "/api/admin/i18n-sprachen/fr",
      headers: kopfFuer(b, "admin"),
      payload: { name: " " },
    });
    expect(ohneName.json().error).toBe("INVALID_NAME");
    const alsGast = await b.app.inject({
      method: "PUT",
      url: "/api/admin/i18n-sprachen/fr",
      headers: kopfFuer(b, "viewer"),
      payload: { name: "Français" },
    });
    expect(alsGast.statusCode).toBe(403);
    const sprachen = await b.app.inject({ method: "GET", url: "/api/i18n/locales" });
    expect(sprachen.json().locales).toEqual(["de", "en", "nl"]);
    await b.schliesse();
  });
});
