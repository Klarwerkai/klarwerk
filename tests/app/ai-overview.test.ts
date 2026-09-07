import { describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import { aiAccessRows } from "../../apps/web/src/lib/aiOverview";

// SCRUM-413 (Pedi 03.07.): „Verfügbare KIs" im Admin — ehrliche Zeilen aus dem echten
// configStatus: Cloud-Modell (aktiv/nicht konfiguriert), Ersatzmodus (aktiv/bereit),
// lokaler LLM-Server ehrlich als „geplant" bis zum App-Anschluss (KLLM-61).
//
// JOB 3134 (KI-WAHL): die EINE Cloud-Zeile ist zwei Anbieterzeilen gewichen — ChatGPT (OpenAI) und
// Claude (Anthropic), je „aktiv" (gewählt und antwortend), „bereit" (eingerichtet, nicht gewählt)
// oder „nicht konfiguriert" mit dem Grund. Die Fälle unten decken beide Antwortformen: die neue mit
// `cloudProviders` und die alte ohne (älterer Server nennt nur den EINEN Cloud-Client).
describe("SCRUM-413: Verfügbare-KIs-Übersicht", () => {
  it("mit konfiguriertem Modell: Anbieter aktiv (Modell-Label), Ersatzmodus bereit, lokal geplant", () => {
    const rows = aiAccessRows({
      configured: true,
      cloudConfigured: true,
      provider: "anthropic:claude-sonnet-4-6",
      model: "anthropic:claude-sonnet-4-6",
      mode: "model",
    });
    expect(rows.map((r) => r.id)).toEqual(["openai", "anthropic", "fallback", "local"]);
    // JOB 3090: das Detail nennt seit dem zweiten Cloud-Anbieter (ChatGPT) den ANBIETER und das
    // Modell — vorher stand hier die rohe Client-Kennung „anthropic:claude-sonnet-4-6", aus der ein
    // Mensch den Empfänger seiner Texte erst deuten musste. Umgestellt, nicht abgeschwächt: die
    // Zusage ist strenger geworden (Anbieter erkennbar), die Zeile bleibt „aktiv".
    expect(rows[1]).toEqual({
      id: "anthropic",
      state: "active",
      detail: "Claude (Anthropic) · claude-sonnet-4-6",
    });
    // Der nicht genannte Anbieter ist ohne `cloudProviders` ehrlich „nicht konfiguriert".
    expect(rows[0]).toEqual({ id: "openai", state: "missing", detail: null });
    expect(rows[2]?.state).toBe("available");
    // Ohne verdrahteten lokalen LLM bleibt die Zeile ehrlich „geplant".
    expect(rows[3]?.state).toBe("planned");
  });

  // JOB 3134: beide eingerichtet — der GEWÄHLTE (provider/model der globalen Wahl) ist aktiv, der
  // andere bereit; ein fehlender Anbieter nennt seinen Grund.
  it("JOB 3134: beide Anbieter eingerichtet → der gewählte aktiv, der andere bereit; fehlender mit Grund", () => {
    const rows = aiAccessRows({
      configured: true,
      cloudConfigured: true,
      provider: "anthropic:claude-sonnet-4-6",
      model: "anthropic:claude-sonnet-4-6",
      mode: "model",
      cloudProviders: {
        openai: { configured: true, name: "cloud:openai:gpt-4o-mini", model: "gpt-4o-mini" },
        anthropic: {
          configured: true,
          name: "anthropic:claude-sonnet-4-6",
          model: "claude-sonnet-4-6",
        },
      },
    });
    expect(rows[0]).toEqual({
      id: "openai",
      state: "available",
      detail: "ChatGPT (OpenAI) · gpt-4o-mini",
    });
    expect(rows[1]).toEqual({
      id: "anthropic",
      state: "active",
      detail: "Claude (Anthropic) · claude-sonnet-4-6",
    });
    const nurOpenAi = aiAccessRows({
      configured: true,
      cloudConfigured: true,
      provider: "cloud:openai:gpt-4o-mini",
      model: "cloud:openai:gpt-4o-mini",
      mode: "model",
      cloudProviders: {
        openai: { configured: true, name: "cloud:openai:gpt-4o-mini", model: "gpt-4o-mini" },
        anthropic: {
          configured: false,
          grund: "ANTHROPIC_API_KEY fehlt (weder ENV noch Schlüsselbund).",
        },
      },
    });
    expect(nurOpenAi[0]?.state).toBe("active");
    expect(nurOpenAi[1]).toEqual({
      id: "anthropic",
      state: "missing",
      detail: "ANTHROPIC_API_KEY fehlt (weder ENV noch Schlüsselbund).",
    });
  });

  // JOB 3134: ist die globale Wahl deterministisch, antwortet KEIN Anbieter — beide „bereit", der
  // Ersatzmodus aktiv. Ein „aktiv" an einem Anbieter, der laut Wahl nicht arbeitet, wäre die Lüge,
  // gegen die der Auftrag steht.
  it("JOB 3134: Wahl deterministisch → kein Anbieter aktiv, Ersatzmodus aktiv", () => {
    const rows = aiAccessRows({
      configured: true,
      cloudConfigured: true,
      provider: "deterministic",
      mode: "demo",
      cloudProviders: {
        openai: { configured: true, name: "cloud:openai:gpt-4o-mini", model: "gpt-4o-mini" },
        anthropic: {
          configured: true,
          name: "anthropic:claude-sonnet-4-6",
          model: "claude-sonnet-4-6",
        },
      },
    });
    expect(rows.map((r) => r.state)).toEqual(["available", "available", "active", "planned"]);
  });

  // SCRUM-424: eigener lokaler LLM verdrahtet → „bereit" (verbunden & auswählbar) mit Label.
  it("mit verdrahtetem lokalem LLM: Zeile bereit + Provider-Label", () => {
    const rows = aiAccessRows({
      configured: true,
      cloudConfigured: true,
      provider: "anthropic:claude-sonnet-4-6",
      model: "anthropic:claude-sonnet-4-6",
      mode: "model",
      localConfigured: true,
      localProvider: "local:Qwen3-32B-AWQ",
    });
    expect(rows[3]).toEqual({ id: "local", state: "available", detail: "local:Qwen3-32B-AWQ" });
  });

  it("ohne Modell: beide Anbieter ehrlich nicht-konfiguriert, Ersatzmodus aktiv", () => {
    const rows = aiAccessRows({
      configured: false,
      cloudConfigured: false,
      provider: "deterministic",
      mode: "demo",
    });
    expect(rows[0]?.state).toBe("missing");
    expect(rows[0]?.detail).toBeNull();
    expect(rows[1]?.state).toBe("missing");
    expect(rows[2]?.state).toBe("active");
  });

  it("lokales Modell allein macht keinen Anbieter konfiguriert", () => {
    const rows = aiAccessRows({
      configured: true,
      cloudConfigured: false,
      provider: "local:Qwen3-32B-AWQ",
      model: "local:Qwen3-32B-AWQ",
      mode: "model",
      localConfigured: true,
      localProvider: "local:Qwen3-32B-AWQ",
    });
    expect(rows[0]).toEqual({ id: "openai", state: "missing", detail: null });
    expect(rows[1]).toEqual({ id: "anthropic", state: "missing", detail: null });
    expect(rows[3]?.state).toBe("available");
  });

  it("alle Anzeige-Schlüssel lösen in DE und EN auf", async () => {
    for (const lng of ["de", "en"] as const) {
      await i18n.changeLanguage(lng);
      for (const key of [
        "adm.ai.accessTitle",
        "adm.ai.accessHelp",
        "adm.ai.accessNote",
        "adm.ai.access.openai",
        "adm.ai.access.anthropic",
        "adm.ai.access.fallback",
        "adm.ai.access.local",
        "adm.ai.state.active",
        "adm.ai.state.available",
        "adm.ai.state.missing",
        "adm.ai.state.planned",
      ]) {
        expect(i18n.t(key), `${lng}:${key}`).not.toBe(key);
      }
    }
  });
});
