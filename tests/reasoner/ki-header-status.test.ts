import { describe, expect, it } from "vitest";
import type { ReasonerConfigStatus } from "../../apps/web/src/api/types";
import i18n from "../../apps/web/src/i18n";
import { KI_HEADER_TEXT, kiHeaderStatus } from "../../apps/web/src/lib/kiHeaderStatus";
import { KI_ORIGIN_TEXT, kiOrigin } from "../../apps/web/src/lib/kiOrigin";

// Pedi 05.07.: Header-Pille „In welcher KI bin ich?" + Herkunftsland + DSGVO-Bestätigung.
// Regel: DSGVO IMMER „nein" — außer es ist eine interne KI aus Europa. Getestet: Aggregation
// über alle Aufgaben, Herkunfts-Ableitung, die Nein-außer-Europa-Regel, Key-Auflösung DE+EN.
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

describe("Pedi 05.07.: kiOrigin — Herkunftsland nur bei eindeutiger Kennung (nichts raten)", () => {
  it("kennt die eindeutigen Anbieter-Kennungen", () => {
    expect(kiOrigin("anthropic:claude-sonnet-4-6")).toEqual({
      countryKey: KI_ORIGIN_TEXT.us,
      eu: false,
    });
    expect(kiOrigin("ollama:qwen3-32b")).toEqual({ countryKey: KI_ORIGIN_TEXT.cn, eu: false });
    // Die Laufzeit „ollama" darf NICHT als „llama"/Meta gelten — das Modell dahinter zählt.
    expect(kiOrigin("ollama:llama3-8b")).toEqual({ countryKey: KI_ORIGIN_TEXT.us, eu: false });
    expect(kiOrigin("ollama:mistral-7b")).toEqual({ countryKey: KI_ORIGIN_TEXT.fr, eu: true });
    expect(kiOrigin("aleph-alpha:luminous")).toEqual({ countryKey: KI_ORIGIN_TEXT.de, eu: true });
  });

  it("unbekannte Kennung → ehrlich unbekannt (eu: null, zählt wie „nein“)", () => {
    expect(kiOrigin("ollama:geheimmodell-9000")).toEqual({
      countryKey: KI_ORIGIN_TEXT.unknown,
      eu: null,
    });
    expect(kiOrigin(null)).toEqual({ countryKey: KI_ORIGIN_TEXT.unknown, eu: null });
  });
});

describe("Pedi 05.07.: kiHeaderStatus — DSGVO immer „nein“, außer interne KI aus Europa", () => {
  it("alles Cloud (Anthropic) → Externe KI, Herkunft USA, DSGVO: nein", () => {
    const s = kiHeaderStatus(config());
    expect(s?.mode).toBe("external");
    expect(s?.labelKey).toBe(KI_HEADER_TEXT.external);
    expect(s?.dsgvoConfirm).toBe(false);
    expect(s?.dsgvoKey).toBe(KI_HEADER_TEXT.dsgvoNo);
    expect(s?.countryKey).toBe(KI_ORIGIN_TEXT.us);
    expect(s?.detail).toBe("anthropic:claude-sonnet-4-6");
  });

  it("intern, aber Modell aus China (Qwen) → trotzdem DSGVO: nein (Herkunft schlägt Standort)", () => {
    const s = kiHeaderStatus(
      config({
        effectiveProvider: { ...ALL_LOCAL },
        localConfigured: true,
        localProvider: "ollama:qwen3-32b",
      }),
    );
    expect(s?.mode).toBe("internal");
    expect(s?.labelKey).toBe(KI_HEADER_TEXT.internal);
    expect(s?.dsgvoConfirm).toBe(false);
    expect(s?.countryKey).toBe(KI_ORIGIN_TEXT.cn);
  });

  it("interne KI aus Europa (Mistral lokal) → der EINZIGE Fall mit DSGVO: ja", () => {
    const s = kiHeaderStatus(
      config({
        effectiveProvider: { ...ALL_LOCAL },
        localConfigured: true,
        localProvider: "ollama:mistral-7b",
      }),
    );
    expect(s?.mode).toBe("internal");
    expect(s?.dsgvoConfirm).toBe(true);
    expect(s?.dsgvoKey).toBe(KI_HEADER_TEXT.dsgvoYes);
    expect(s?.countryKey).toBe(KI_ORIGIN_TEXT.fr);
  });

  it("intern mit unbekannter Herkunft → DSGVO: nein (kein Fake-Ja)", () => {
    const s = kiHeaderStatus(
      config({
        effectiveProvider: { ...ALL_LOCAL },
        localConfigured: true,
        localProvider: "ollama:geheimmodell-9000",
      }),
    );
    expect(s?.dsgvoConfirm).toBe(false);
    expect(s?.countryKey).toBe(KI_ORIGIN_TEXT.unknown);
  });

  it("rein deterministisch → Z4 Keine KI mit sichtbarem Ersatzmodus", () => {
    const s = kiHeaderStatus(config({ effectiveProvider: { ...ALL_RULE } }));
    expect(s.mode).toBe("none");
    expect(s.dsgvoConfirm).toBe(false);
    expect(s.countryKey).toBeNull();
    expect(s.dsgvoKey).toBeNull();
    expect(s.labelKey).toBe(KI_HEADER_TEXT.none);
    expect(s.subtitleKey).toBe(KI_HEADER_TEXT.noneSubtitle);
    expect(s.detail).toBeNull();
  });

  it("Cloud und lokales Modell → Z3 Beide, DSGVO: nein (strengste Stufe)", () => {
    const s = kiHeaderStatus(
      config({ effectiveProvider: { ...ALL_RULE, answer: "cloud", assist: "local" } }),
    );
    expect(s?.mode).toBe("mixed");
    expect(s?.dsgvoConfirm).toBe(false);
    expect(s?.labelKey).toBe(KI_HEADER_TEXT.mixed);
    expect(s?.hintKey).toBe(KI_HEADER_TEXT.hintMixed);
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

  it("alle Anzeige-Keys lösen in DE und EN auf (keine rohen Keys im Header)", async () => {
    const keys = [...Object.values(KI_HEADER_TEXT), ...Object.values(KI_ORIGIN_TEXT)];
    for (const lng of ["de", "en"] as const) {
      await i18n.changeLanguage(lng);
      for (const key of keys) {
        expect(i18n.t(key), `${lng}:${key}`).not.toBe(key);
        expect(i18n.t(key).length, `${lng}:${key}`).toBeGreaterThan(1);
      }
    }
  });

  it("Pedi-Copy: Externe KI, Beide und sichtbarer deterministischer Ersatzmodus", async () => {
    await i18n.changeLanguage("de");
    expect(i18n.t(KI_HEADER_TEXT.external)).toBe("Externe KI");
    expect(i18n.t(KI_HEADER_TEXT.mixed)).toBe("Beide");
    expect(i18n.t(KI_HEADER_TEXT.none)).toBe("Keine KI");
    expect(i18n.t(KI_HEADER_TEXT.noneSubtitle)).toBe("deterministischer Ersatzmodus");
  });
});
