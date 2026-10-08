import { describe, expect, it } from "vitest";
import type { ReasonerConfigStatus } from "../../apps/web/src/api/types";
import i18n from "../../apps/web/src/i18n";
import {
  KI_HEADER_TEXT,
  kiHeaderStatus,
  kiHeaderStatusFromPublic,
  kiHerkunftAnzeige,
} from "../../apps/web/src/lib/kiHeaderStatus";

// Pedi 05.07.: Header-Anzeige „In welcher KI bin ich?". Getestet: Aggregation über alle Aufgaben,
// Anbieter und Herkunft aus der Serverauskunft, Key-Auflösung DE/EN/NL.
//
// R-0599 (Auftrag ki-modus-wahrheit): die frühere Regel „DSGVO immer nein, außer interne KI aus
// Europa" ist GESTRICHEN — sie ließ sich aus Herkunftsland und Modellname nicht ableiten. Dieser Test
// hielt sie bis dahin fest; er hält jetzt das Gegenteil fest: die Ableitung trägt KEINE DSGVO-Aussage
// mehr, und an ihrer Stelle stehen Betriebsort/Datenfluss, Herkunft mit Nachweisstufe und die
// offenen Prüfungen.
// R-0702: die Herkunft wird nicht mehr aus der Modellkennung geraten (kiOrigin.ts ist entfernt),
// sondern kommt aus `config.herkunft` — der zentralen Zugangsverwaltung des Servers.
function config(overrides: Partial<ReasonerConfigStatus> = {}): ReasonerConfigStatus {
  return {
    provider: "anthropic:claude-sonnet-4-6",
    model: "anthropic:claude-sonnet-4-6",
    configured: true,
    mode: "model",
    fallbackAvailable: true,
    taskConfig: { global: "auto", perTask: {} },
    effective: {
      structure: "model",
      assist: "model",
      interview: "model",
      answer: "model",
      select: "model",
      extract: "model",
    },
    persisted: false,
    cloudConfigured: true,
    localConfigured: false,
    effectiveProvider: {
      structure: "cloud",
      assist: "cloud",
      interview: "cloud",
      answer: "cloud",
      select: "cloud",
      extract: "cloud",
    },
    herkunft: {
      openai: { land: "us", nachweis: "behauptet" },
      anthropic: { land: "us", nachweis: "behauptet" },
      local: { land: null, nachweis: "unbekannt" },
    },
    supportsLocales: ["de", "en"],
    tasks: ["structure", "assist", "interview", "answer", "select", "extract"],
    ...overrides,
  };
}

const ALL_LOCAL = {
  structure: "local",
  assist: "local",
  interview: "local",
  answer: "local",
  select: "local",
  extract: "local",
} as const;

const ALL_RULE = {
  structure: "deterministic",
  assist: "deterministic",
  interview: "deterministic",
  answer: "deterministic",
  select: "deterministic",
  extract: "deterministic",
} as const;

describe("R-0702: Herkunft kommt vom Server, mit Nachweisstufe — nichts raten", () => {
  it("behauptete Angabe → Land + Satz „Angabe des Anbieters, nicht geprüft“", () => {
    expect(kiHerkunftAnzeige({ land: "us", nachweis: "behauptet" })).toEqual({
      key: KI_HEADER_TEXT.herkunftBehauptet,
      landKey: "country.us",
      landCode: "US",
    });
  });

  it("geprüfte Angabe → eigener Satz; unbekannter Ländercode bleibt Code statt falscher Name", () => {
    expect(kiHerkunftAnzeige({ land: "ie", nachweis: "geprueft" })).toEqual({
      key: KI_HEADER_TEXT.herkunftGeprueft,
      landKey: null,
      landCode: "IE",
    });
  });

  it("keine Angabe, „unbekannt“ oder Land null → ehrlich „Herkunft unbekannt“", () => {
    const unbekannt = { key: KI_HEADER_TEXT.herkunftUnbekannt, landKey: null, landCode: null };
    expect(kiHerkunftAnzeige(undefined)).toEqual(unbekannt);
    expect(kiHerkunftAnzeige({ land: null, nachweis: "unbekannt" })).toEqual(unbekannt);
    expect(kiHerkunftAnzeige({ land: null, nachweis: "behauptet" })).toEqual(unbekannt);
  });

  it("ohne Serverangabe wird die Herkunft NICHT aus dem Modellnamen geraten", () => {
    // Früher: „mistral" im Namen → Frankreich/EU. Heute zählt nur die Auskunft des Servers.
    const { herkunft: _weg, ...ohne } = config({
      effectiveProvider: { ...ALL_LOCAL },
      localConfigured: true,
      localProvider: "ollama:mistral-7b",
    });
    expect(kiHeaderStatus(ohne).herkunft?.key).toBe(KI_HEADER_TEXT.herkunftUnbekannt);
  });
});

describe("R-0599: kiHeaderStatus — Ort, Anbieter, Herkunft, offene Prüfungen; keine DSGVO-Aussage", () => {
  it("alles Cloud (Anthropic) → extern, Anbieter lesbar, Herkunft vom Server, offene Prüfungen", () => {
    const s = kiHeaderStatus(config());
    expect(s.mode).toBe("external");
    expect(s.labelKey).toBe(KI_HEADER_TEXT.external);
    expect(s.hintKey).toBe(KI_HEADER_TEXT.hintExternal);
    expect(s.detail).toBe("Claude (Anthropic) · claude-sonnet-4-6");
    expect(s.herkunft).toEqual({
      key: KI_HEADER_TEXT.herkunftBehauptet,
      landKey: "country.us",
      landCode: "US",
    });
    expect(s.offenePruefungenKey).toBe(KI_HEADER_TEXT.offenePruefungen);
  });

  it("vom Betreiber eingerichteter Server → intern, Herkunft unbekannt, offene Prüfungen", () => {
    const s = kiHeaderStatus(
      config({
        effectiveProvider: { ...ALL_LOCAL },
        localConfigured: true,
        localProvider: "ollama:mistral-7b",
      }),
    );
    expect(s.mode).toBe("internal");
    expect(s.labelKey).toBe(KI_HEADER_TEXT.internal);
    expect(s.hintKey).toBe(KI_HEADER_TEXT.hintInternal);
    expect(s.detail).toBe("ollama:mistral-7b");
    expect(s.herkunft?.key).toBe(KI_HEADER_TEXT.herkunftUnbekannt);
    expect(s.offenePruefungenKey).toBe(KI_HEADER_TEXT.offenePruefungen);
  });

  it("rein deterministisch → Z4 Keine KI mit sichtbarem Ersatzmodus, ohne Herkunft/Prüfungen", () => {
    const s = kiHeaderStatus(config({ effectiveProvider: { ...ALL_RULE } }));
    expect(s.mode).toBe("none");
    expect(s.labelKey).toBe(KI_HEADER_TEXT.none);
    expect(s.subtitleKey).toBe(KI_HEADER_TEXT.noneSubtitle);
    expect(s.detail).toBeNull();
    expect(s.herkunft).toBeNull();
    expect(s.offenePruefungenKey).toBeNull();
  });

  it("Cloud und lokales Modell → Z3 Beide", () => {
    const s = kiHeaderStatus(
      config({ effectiveProvider: { ...ALL_RULE, answer: "cloud", assist: "local" } }),
    );
    expect(s.mode).toBe("mixed");
    expect(s.labelKey).toBe(KI_HEADER_TEXT.mixed);
    expect(s.hintKey).toBe(KI_HEADER_TEXT.hintMixed);
  });

  it("Cloud plus deterministic bleibt Z1 Externe KI und wird nicht zu Beide", () => {
    const s = kiHeaderStatus(config({ effectiveProvider: { ...ALL_RULE, answer: "cloud" } }));
    expect(s.mode).toBe("external");
    expect(s.labelKey).toBe(KI_HEADER_TEXT.external);
  });

  it("ohne Konfiguration oder Aufgaben ehrlich Z4 statt Fake-KI", () => {
    expect(kiHeaderStatus(undefined).mode).toBe("none");
    expect(kiHeaderStatus(config({ tasks: [], effectiveProvider: {} })).mode).toBe("none");
  });

  it("die Ableitung trägt in keinem Zustand mehr ein DSGVO-Feld", () => {
    const zustaende = [
      kiHeaderStatus(config()),
      kiHeaderStatus(config({ effectiveProvider: { ...ALL_LOCAL }, localConfigured: true })),
      kiHeaderStatus(config({ effectiveProvider: { ...ALL_RULE } })),
      kiHeaderStatusFromPublic({ active: true, mode: "cloud" }),
      kiHeaderStatusFromPublic({ active: true, mode: "local" }),
    ];
    for (const s of zustaende) {
      expect(
        Object.keys(s).some((k) => /dsgvo/i.test(k)),
        JSON.stringify(s),
      ).toBe(false);
    }
  });

  it("alle Anzeige-Keys lösen in DE, EN und NL auf — und keiner nennt DSGVO/GDPR/AVG", async () => {
    for (const lng of ["de", "en", "nl"] as const) {
      await i18n.changeLanguage(lng);
      for (const key of Object.values(KI_HEADER_TEXT)) {
        const text = i18n.t(key, { land: "USA" });
        expect(text, `${lng}:${key}`).not.toBe(key);
        expect(text.length, `${lng}:${key}`).toBeGreaterThan(1);
        expect(text, `${lng}:${key}`).not.toMatch(/DSGVO|GDPR|AVG/);
      }
    }
    await i18n.changeLanguage("de");
  });

  it("die offenen Prüfungen nennen Auftragsverarbeitung, Unterauftragnehmer, Trainingsausschluss", async () => {
    await i18n.changeLanguage("de");
    const satz = i18n.t(KI_HEADER_TEXT.offenePruefungen);
    expect(satz).toContain("Auftragsverarbeitung");
    expect(satz).toContain("Unterauftragnehmer");
    expect(satz).toContain("Trainingsausschluss");
  });

  it("Pedi-Copy: KI-Modus-Labels (Cloud/Cloud+Lokal) + sichtbarer deterministischer Ersatzmodus", async () => {
    await i18n.changeLanguage("de");
    // AUFTRAG-mega51 BLOCK G1: „KI-Modus" ist eine Einstellung; gemeint ist der ORT.
    expect(i18n.t(KI_HEADER_TEXT.external)).toBe("KI rechnet in der Cloud");
    expect(i18n.t(KI_HEADER_TEXT.mixed)).toBe("KI rechnet in der Cloud und im eigenen Haus");
    expect(i18n.t(KI_HEADER_TEXT.none)).toBe("Keine KI");
    expect(i18n.t(KI_HEADER_TEXT.noneSubtitle)).toBe("deterministischer Ersatzmodus");
  });
});

// WP-VIP2-GATE-2 (bens Fix 3): die Zeile normaler Nutzer speist sich aus dem OEFFENTLICHEN
// abstrahierten Status (config ist Admin-Sicht) — ehrlich ohne Herkunft/Modellname.
describe("WP-VIP2-GATE-2 Fix 3: kiHeaderStatusFromPublic (Zeile fuer Nicht-Admins)", () => {
  it("cloud → extern, local → intern — beide OHNE Herkunft und Modellname", () => {
    const cloud = kiHeaderStatusFromPublic({ active: true, mode: "cloud" });
    expect(cloud.mode).toBe("external");
    expect(cloud.labelKey).toBe(KI_HEADER_TEXT.external);
    expect(cloud.herkunft).toBeNull();
    expect(cloud.detail).toBeNull();
    const local = kiHeaderStatusFromPublic({ active: true, mode: "local" });
    expect(local.mode).toBe("internal");
    expect(local.herkunft).toBeNull();
  });

  it("deterministisch/inaktiv/ungeladen → neutraler Keine-KI-Zustand", () => {
    expect(kiHeaderStatusFromPublic({ active: false, mode: "deterministic" }).mode).toBe("none");
    expect(kiHeaderStatusFromPublic({ active: true, mode: "deterministic" }).mode).toBe("none");
    expect(kiHeaderStatusFromPublic(undefined).mode).toBe("none");
  });
});
