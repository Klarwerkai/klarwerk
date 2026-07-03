import { describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import { aiAccessRows } from "../../apps/web/src/lib/aiOverview";

// SCRUM-413 (Pedi 03.07.): „Verfügbare KIs" im Admin — ehrliche Zeilen aus dem echten
// configStatus: Cloud-Modell (aktiv/nicht konfiguriert), Ersatzmodus (aktiv/bereit),
// lokaler LLM-Server ehrlich als „geplant" bis zum App-Anschluss (KLLM-61).
describe("SCRUM-413: Verfügbare-KIs-Übersicht", () => {
  it("mit konfiguriertem Modell: Cloud aktiv (Modell-Label), Ersatzmodus bereit, lokal geplant", () => {
    const rows = aiAccessRows({
      configured: true,
      provider: "anthropic:claude-sonnet-4-6",
      model: "anthropic:claude-sonnet-4-6",
      mode: "model",
    });
    expect(rows.map((r) => r.id)).toEqual(["cloud", "fallback", "local"]);
    expect(rows[0]).toEqual({
      id: "cloud",
      state: "active",
      detail: "anthropic:claude-sonnet-4-6",
    });
    expect(rows[1]?.state).toBe("available");
    expect(rows[2]?.state).toBe("planned");
  });

  it("ohne Modell: Cloud ehrlich nicht-konfiguriert, Ersatzmodus aktiv", () => {
    const rows = aiAccessRows({ configured: false, provider: "deterministic", mode: "demo" });
    expect(rows[0]?.state).toBe("missing");
    expect(rows[0]?.detail).toBeNull();
    expect(rows[1]?.state).toBe("active");
  });

  it("alle Anzeige-Schlüssel lösen in DE und EN auf", async () => {
    for (const lng of ["de", "en"] as const) {
      await i18n.changeLanguage(lng);
      for (const key of [
        "adm.ai.accessTitle",
        "adm.ai.accessHelp",
        "adm.ai.accessNote",
        "adm.ai.access.cloud",
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
