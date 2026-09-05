// ================================================================================================
// JOB 3060 · H1 — JEDER GRUPPENPUNKT DER NAVIGATION HAT GENAU EINEN ORT IN DER HÜLLE.
// ================================================================================================
//
// Die Seitenleiste zeigte ALLE Gruppenpunkte. Das Kopfband zeigt fünf, das Zahnrad-Menü die
// übrigen unter „Weitere Bereiche“, und „Admin“ heißt dort „Einstellungen“. Drei Mengen — und
// dieser Test rechnet nach, dass sie die Gruppen restlos und überschneidungsfrei aufteilen. Ein
// künftiger Punkt, der in keiner der drei Mengen steht, fiele sonst still aus dem Bild.
//
// Dazu die Beschriftungen des Kopfbands in allen drei Sprachen (Lieferung 9) und der Platzhalter
// „Suchen“ (Mockup Z.29).
import { describe, expect, it } from "vitest";
import {
  KOPFBAND_LABEL_KEY,
  NAV_GROUPS,
  einstellungenItem,
  kopfbandItems,
  weitereBereicheItems,
} from "../../apps/web/src/app/navigation";
import i18n from "../../apps/web/src/i18n";

function sprache(lng: string, key: string): string {
  return String(i18n.getResource(lng, "translation", key) ?? "");
}

describe("JOB 3060 · H1 · die drei Orte der Navigation", () => {
  it("Kopfband, Weitere Bereiche und Einstellungen teilen die Gruppenpunkte restlos und ohne Überschneidung auf", () => {
    const alle = NAV_GROUPS.flatMap((g) => g.items).map((i) => i.id);
    const kopfband = kopfbandItems().map((i) => i.id);
    const weitere = weitereBereicheItems().map((i) => i.id);
    const einstellungen = [einstellungenItem().id];
    const vereinigt = [...kopfband, ...weitere, ...einstellungen];
    // Keiner doppelt, keiner vergessen, keiner erfunden.
    expect(new Set(vereinigt).size).toBe(vereinigt.length);
    expect([...vereinigt].sort()).toEqual([...alle].sort());
  });

  it("das Kopfband trägt Start · Fragen · Bibliothek · Erfassen · Prüfen — in dieser Reihenfolge (Mockup Z.20-24)", () => {
    expect(kopfbandItems().map((i) => i.id)).toEqual([
      "start",
      "fragen",
      "bibliothek",
      "erfassen",
      "validierung",
    ]);
    expect(kopfbandItems().map((i) => i.path)).toEqual([
      "/start",
      "/fragen",
      "/bibliothek",
      "/erfassen",
      "/validierung",
    ]);
  });

  it("„Weitere Bereiche“ führt die zwölf übrigen Punkte in der Reihenfolge des Auftrags", () => {
    expect(weitereBereicheItems().map((i) => i.id)).toEqual([
      "aufgaben",
      "konflikte",
      "duplikate",
      "wissensnetz",
      "extern",
      "risiko",
      "lebenszyklus",
      "analytics",
      "output",
      "import",
      "graph",
      "kapital",
    ]);
    expect(einstellungenItem().path).toBe("/admin");
  });

  it("die fünf Punkte und „Suchen“ sind DE/EN/NL beschriftet — kürzer als ihre Seitentitel", () => {
    const de = {
      start: "Start",
      fragen: "Fragen",
      bibliothek: "Bibliothek",
      erfassen: "Erfassen",
      validierung: "Prüfen",
    };
    for (const item of kopfbandItems()) {
      const key = KOPFBAND_LABEL_KEY[item.id as keyof typeof KOPFBAND_LABEL_KEY];
      expect(key, `${item.id} ohne Kopfband-Beschriftung`).toBeTruthy();
      expect(sprache("de", key)).toBe(de[item.id as keyof typeof de]);
      for (const lng of ["en", "nl"]) {
        expect(sprache(lng, key).length, `${key} fehlt in ${lng}`).toBeGreaterThan(0);
      }
    }
    expect(sprache("de", "kopfband.suchen")).toBe("Suchen");
    expect(sprache("en", "kopfband.suchen")).toBe("Search");
    expect(sprache("nl", "kopfband.suchen")).toBe("Zoeken");
    // Die Seitentitel selbst bleiben unangetastet — „Wissen erfassen“ und „Validierung“.
    expect(sprache("de", "nav.capture")).toBe("Wissen erfassen");
    expect(sprache("de", "nav.validation")).toBe("Validierung");
  });

  it("die Menü-Beschriftungen der Hülle sind in allen drei Sprachen vorhanden", () => {
    for (const key of [
      "kopfband.menue",
      "kopfband.konto",
      "kopfband.navigation",
      "kopfband.ungelesen",
      "menue.einstellungen",
      "menue.status",
      "menue.seitenhilfe",
      "menue.seitenhilfe.leer",
      "menue.weitereBereiche",
      "menue.schnellnavigation",
      "menue.darstellung",
      "topbar.notifications",
      "topbar.design.classic",
      "topbar.design.modern",
    ]) {
      for (const lng of ["de", "en", "nl"]) {
        expect(sprache(lng, key).length, `${key} fehlt in ${lng}`).toBeGreaterThan(0);
      }
    }
  });
});
