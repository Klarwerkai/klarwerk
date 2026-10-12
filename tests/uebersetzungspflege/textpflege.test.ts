// ================================================================================================
// R-1034 / FR-I18N-02 · DIE GEPFLEGTEN TEXTE LIEGEN ÜBER DEM MITGELIEFERTEN BESTAND — UND NUR DORT.
// ================================================================================================
//
// Gemessen an einem ECHTEN i18next mit dem ECHTEN Nachlader (`lib/sprachNachlader.ts`) und dem
// Aufbau aus `i18n.ts` (Deutsch im Start, en über den Nachlader, `partialBundledLanguages`). Ersetzt
// ist allein der Serverabruf: ein Lader, dessen Antwort der Fall bestimmt.
//
// Die Zusagen aus dem Kopf von `lib/textpflege.ts`:
//   T1  die gepflegten Texte der aktiven Sprache erscheinen nach dem Start;
//   T2  beim Sprachwechsel kommen die der neuen Sprache — NACH ihrem Paket, nicht an seiner Stelle;
//   T3  ein Ausfall des Abrufs lässt den mitgelieferten Text stehen;
//   T4  „Zurücksetzen" stellt den mitgelieferten Text wieder her, auch wenn er überdeckt war;
//   T5  eine nicht geladene Sprache bekommt KEIN Bündel untergeschoben (sonst bliebe ihr Paket aus);
//   T6  die Platzhalterprüfung der Pflegekarte;
//   T7  ein extern zurückgesetzter Text verschwindet beim nächsten Abruf des ganzen Bestands;
//   T8  eine einzelne Speicherantwort ist eine Teiländerung und nimmt nichts zurück.
import { describe, expect, it } from "vitest";
import { createInstance } from "../../apps/web/node_modules/i18next";
import { sprachNachlader } from "../../apps/web/src/lib/sprachNachlader";
import {
  bindTextpflege,
  legeTexteUeber,
  mitgelieferterText,
  platzhalterAbweichung,
  setzeTextZurueck,
  uebernimmBestand,
} from "../../apps/web/src/lib/textpflege";

const DE = { gruss: "Hallo", titel: "Sicherung", zahl: "{{n}} Texte" };
const EN = { gruss: "Hello", titel: "Backup", zahl: "{{n}} texts" };

async function baueI18n(gefragt: string[] = []) {
  const i18n = createInstance();
  await i18n
    .use(
      sprachNachlader((sprache) => {
        gefragt.push(sprache);
        return sprache === "en" ? Promise.resolve({ ...EN }) : undefined;
      }),
    )
    .init({
      lng: "de",
      fallbackLng: "de",
      partialBundledLanguages: true,
      resources: { de: { translation: { ...DE } } },
      interpolation: { escapeValue: false },
    });
  return i18n;
}

/** Wartet, bis alle anstehenden Versprechen (Lader, Nachlader) durch sind. */
async function ruhe(): Promise<void> {
  for (let i = 0; i < 5; i += 1) {
    await new Promise((r) => setTimeout(r, 0));
  }
}

describe("R-1034 · gepflegte Texte über dem mitgelieferten Bestand", () => {
  it("T1 · nach dem Start steht der gepflegte Text der aktiven Sprache", async () => {
    const i18n = await baueI18n();
    const ab = bindTextpflege(i18n, async (s) => (s === "de" ? { titel: "Datensicherung" } : {}));
    await ruhe();
    expect(i18n.t("titel")).toBe("Datensicherung");
    expect(i18n.t("gruss"), "nicht gepflegte Texte bleiben mitgeliefert").toBe("Hallo");
    ab();
  });

  it("T2 · beim Wechsel kommen die Texte der neuen Sprache — und ihr Paket wird trotzdem geladen", async () => {
    const gefragt: string[] = [];
    const i18n = await baueI18n(gefragt);
    const ab = bindTextpflege(i18n, async (s) => (s === "en" ? { titel: "Data backup" } : {}));
    await ruhe();
    await i18n.changeLanguage("en");
    await ruhe();
    expect(gefragt, "das Paket en wurde beim Nachlader angefordert").toContain("en");
    expect(i18n.t("gruss"), "der mitgelieferte englische Text ist da").toBe("Hello");
    expect(i18n.t("titel"), "der gepflegte englische Text liegt darüber").toBe("Data backup");
    ab();
  });

  it("T3 · fällt der Abruf aus, bleibt der mitgelieferte Text stehen", async () => {
    const i18n = await baueI18n();
    const ab = bindTextpflege(i18n, () => Promise.reject(new Error("Netz weg")));
    await ruhe();
    expect(i18n.t("titel")).toBe("Sicherung");
    ab();
  });

  it("T4 · Zurücksetzen stellt den mitgelieferten Text wieder her", async () => {
    const i18n = await baueI18n();
    legeTexteUeber(i18n, "de", { titel: "Datensicherung" });
    expect(i18n.t("titel")).toBe("Datensicherung");
    expect(mitgelieferterText(i18n, "de", "titel"), "das Original bleibt abrufbar").toBe(
      "Sicherung",
    );
    setzeTextZurueck(i18n, "de", "titel");
    expect(i18n.t("titel")).toBe("Sicherung");

    // Eine Sprache, deren Bündel den Schlüssel NICHT mitbringt, zeigte vorher den deutschen Text —
    // nach dem Zurücksetzen wieder genau den.
    await i18n.changeLanguage("en");
    legeTexteUeber(i18n, "en", { nurDeutsch: "Only English adjusted" });
    i18n.addResource("de", "translation", "nurDeutsch", "Nur deutsch");
    expect(mitgelieferterText(i18n, "en", "nurDeutsch")).toBeNull();
    setzeTextZurueck(i18n, "en", "nurDeutsch");
    expect(i18n.t("nurDeutsch")).toBe("Nur deutsch");
  });

  it("T5 · einer noch nicht geladenen Sprache wird kein Bündel untergeschoben", async () => {
    const gefragt: string[] = [];
    const i18n = await baueI18n(gefragt);
    legeTexteUeber(i18n, "en", { titel: "Data backup" });
    expect(i18n.hasResourceBundle("en", "translation")).toBe(false);
    // Und der spätere Wechsel lädt das Paket wie immer.
    await i18n.changeLanguage("en");
    expect(gefragt).toContain("en");
    expect(i18n.t("gruss")).toBe("Hello");
  });

  it("T6 · Platzhalter: fehlende und fremde werden benannt, gleiche passieren", () => {
    expect(platzhalterAbweichung("{{n}} Texte", "{{n}} Einträge")).toEqual({
      fehlend: [],
      fremd: [],
    });
    expect(platzhalterAbweichung("{{n}} Texte", "viele Texte")).toEqual({
      fehlend: ["n"],
      fremd: [],
    });
    expect(platzhalterAbweichung("{{n}} Texte", "{{anzahl}} Texte")).toEqual({
      fehlend: ["n"],
      fremd: ["anzahl"],
    });
    expect(platzhalterAbweichung("{{ name }} ist da", "{{name}} kam")).toEqual({
      fehlend: [],
      fremd: [],
    });
  });

  // BEN, Nacharbeit 2: der Abruf liefert den GANZEN Serverbestand. Eine Anpassung, die eine andere
  // Sitzung inzwischen zurückgesetzt hat, darf hier nicht stehen bleiben.
  it("T7 · Anpassung geladen → extern zurückgesetzt → Sprache wechseln und zurück: der mitgelieferte Text gilt wieder", async () => {
    const i18n = await baueI18n();
    const server: Record<string, Record<string, string>> = {
      de: { titel: "Datensicherung", gruss: "Servus" },
      en: {},
    };
    const ab = bindTextpflege(i18n, async (s) => ({ ...(server[s] ?? {}) }));
    await ruhe();
    expect(i18n.t("titel")).toBe("Datensicherung");
    expect(i18n.t("gruss")).toBe("Servus");

    // Eine andere Administratorin setzt „titel“ zurück; „gruss“ bleibt angepasst.
    server.de = { gruss: "Servus" };
    await i18n.changeLanguage("en");
    await ruhe();
    await i18n.changeLanguage("de");
    await ruhe();

    expect(i18n.t("titel"), "der entfernte Text bleibt nicht stehen").toBe("Sicherung");
    expect(i18n.t("gruss"), "die weiter bestehende Anpassung bleibt").toBe("Servus");

    // Und ein leerer Bestand nimmt auch die letzte Anpassung zurück.
    server.de = {};
    await i18n.changeLanguage("en");
    await ruhe();
    await i18n.changeLanguage("de");
    await ruhe();
    expect(i18n.t("gruss")).toBe("Hallo");
    ab();
  });

  it("T8 · eine einzelne Speicherantwort bleibt eine Teiländerung — andere Anpassungen bleiben", async () => {
    const i18n = await baueI18n();
    uebernimmBestand(i18n, "de", { titel: "Datensicherung", gruss: "Servus" });
    legeTexteUeber(i18n, "de", { titel: "Sicherungen" });
    expect(i18n.t("titel")).toBe("Sicherungen");
    expect(i18n.t("gruss"), "nicht in der Speicherantwort, aber weiter angepasst").toBe("Servus");
  });

  it("die Abmeldung hört auf — ein späterer Wechsel holt nichts mehr", async () => {
    const i18n = await baueI18n();
    const angefragt: string[] = [];
    const ab = bindTextpflege(i18n, async (s) => {
      angefragt.push(s);
      return {};
    });
    ab();
    ab();
    await i18n.changeLanguage("en");
    await ruhe();
    expect(angefragt).toEqual(["de"]);
  });
});
