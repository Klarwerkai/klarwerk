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
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  GUARDED_ITEMS,
  NAV_GROUPS,
  anzeigeNameKey,
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

  // ================================================================================================
  // JOB 3503 — JEDER KOPFBAND-PUNKT IST BEWACHT UND HAT EINEN SEITENEINTRAG IM ROUTER.
  // ================================================================================================
  // Der Fall darüber prüft den ORT im Bild. Er sagt nichts darüber, ob der Punkt hinter dem Bild
  // auch trägt: ein Eintrag ohne Rollen-Gate oder ohne Seite wäre ein Punkt, der ins Leere führt
  // (`Guarded` fiele auf `PlaceholderPage`). Beides wird hier nachgerechnet — an `GUARDED_ITEMS`
  // (die Menge, über die `Guarded` in routes.tsx entscheidet) und an `PAGES`, aus der Datei GELESEN
  // statt abgeschrieben. Der Anlass ist der neue Punkt „Meine Entwürfe"; die Regel gilt für alle.
  it("jeder Kopfband-Punkt hat ein Rollen-Gate und einen Seiteneintrag in routes.tsx", () => {
    const routerQuelle = readFileSync(resolve(process.cwd(), "apps/web/src/routes.tsx"), "utf8");
    // Nicht-vakuös: es sind wirklich sechs, nicht null.
    expect(kopfbandItems()).toHaveLength(6);
    for (const item of kopfbandItems()) {
      expect(
        GUARDED_ITEMS.some((g) => g.id === item.id && g.path === item.path),
        `${item.id} steht nicht im Rollen-Gate`,
      ).toBe(true);
      expect(routerQuelle, `${item.id} hat keinen Seiteneintrag in PAGES`).toContain(
        `${item.id}: `,
      );
    }
    // Und der neue Punkt trägt DIESELBE Schranke wie sein Nachbar „Erfassen“ — wer nicht erfassen
    // darf, hat keine Entwürfe (Auftrag §3.3).
    const entwuerfe = kopfbandItems().find((i) => i.id === "entwuerfe");
    const erfassen = kopfbandItems().find((i) => i.id === "erfassen");
    expect(entwuerfe?.minRole).toBe(erfassen?.minRole);
    expect(entwuerfe?.minRole).toBe("experte");
  });

  // JOB 3503 (ENTWUERFE-MENUEPUNKT): es sind SECHS. Pedi, 10.09.2026 über Codex: „eigener sichtbarer
  // Menüpunkt oben in der Topbar." „Meine Entwürfe" steht zwischen „Erfassen" und „Prüfen" — das ist
  // die Reihenfolge der Arbeit (erfassen · weiterschreiben · prüfen). Die fünf des Mockups
  // (Main.dc.html Z.20-24) bleiben in ihrer Ordnung; ergänzt wurde einer, umgestellt keiner.
  it("das Kopfband trägt Start · Fragen · Bibliothek · Erfassen · Meine Entwürfe · Prüfen — in dieser Reihenfolge", () => {
    expect(kopfbandItems().map((i) => i.id)).toEqual([
      "start",
      "fragen",
      "bibliothek",
      "erfassen",
      "entwuerfe",
      "validierung",
    ]);
    expect(kopfbandItems().map((i) => i.path)).toEqual([
      "/start",
      "/fragen",
      "/bibliothek",
      "/erfassen",
      "/entwuerfe",
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

  it("die sechs Punkte und „Suchen“ sind DE/EN/NL beschriftet — kürzer als ihre Seitentitel", () => {
    const de = {
      start: "Start",
      fragen: "Fragen",
      bibliothek: "Bibliothek",
      erfassen: "Erfassen",
      // JOB 3503: KEIN neuer Textschlüssel — `mob.drafts` trägt diesen Namen seit langem in allen
      // drei Sprachen. Es ist zugleich der Seitentitel: hier gibt es keine zwei Namen, die kürzer
      // oder länger sein könnten (JOB 3105 UX-08 — ein Bereich, ein Name).
      entwuerfe: "Meine Entwürfe",
      validierung: "Prüfen",
    };
    for (const item of kopfbandItems()) {
      // JOB 3105 · UX-08: die Kopfband-Tabelle `KOPFBAND_LABEL_KEY` ist abgelöst — der angezeigte
      // Name kommt jetzt für JEDE Fläche aus `anzeigeNameKey` (navigation.ts). Die Erwartung
      // darunter ist unverändert: dieselben fünf deutschen Wörter, dieselbe DE/EN/NL-Pflicht.
      const key = anzeigeNameKey(item);
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
