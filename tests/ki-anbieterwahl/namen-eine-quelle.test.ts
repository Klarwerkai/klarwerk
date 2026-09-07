// ================================================================================================
// JOB 3134 · KI-WAHL — EIN NAME JE ANBIETER, AUF BEIDEN SEITEN DES DRAHTS.
// ================================================================================================
//
// Der Server nennt die Anbieter in Prüfergebnissen und Fehlerzeilen (`REASONER_CLOUD_ANBIETER_NAME`),
// die Fläche in Auswahlliste, Statuszeile und Zugangsliste (`anbieterName`). Die Web-Seite darf
// nicht aus `services/` importieren (Dockerfile-Grenze, s. `apps/web/src/api/types.ts`) — deshalb
// halten beide Seiten die Werte selbst, und dieser Test vergleicht sie Wert für Wert, wie es
// `job615-public-status-task-contract` für die Aufgabenliste tut.
import { describe, expect, it } from "vitest";
import { REASONER_CLOUD_ANBIETER as WEB_ANBIETER } from "../../apps/web/src/api/types";
import { anbieterAusClientName, anbieterName } from "../../apps/web/src/lib/aiOverview";
import {
  REASONER_CLOUD_ANBIETER,
  REASONER_CLOUD_ANBIETER_NAME,
} from "../../services/reasoner/src/types";

describe("JOB 3134 N: Anbieterliste und Anbietername stimmen zwischen Server und Fläche überein", () => {
  it("N1 · dieselbe Liste in derselben Reihenfolge (die Reihenfolge ist die Vorgabe hinter „auto“)", () => {
    expect([...WEB_ANBIETER]).toEqual([...REASONER_CLOUD_ANBIETER]);
    expect([...REASONER_CLOUD_ANBIETER]).toEqual(["openai", "anthropic"]);
  });

  it("N2 · derselbe lesbare Name je Anbieter", () => {
    for (const anbieter of REASONER_CLOUD_ANBIETER) {
      expect(`${anbieter}=${anbieterName(anbieter)}`).toBe(
        `${anbieter}=${REASONER_CLOUD_ANBIETER_NAME[anbieter]}`,
      );
    }
    expect(anbieterName("openai")).toBe("ChatGPT (OpenAI)");
    expect(anbieterName("anthropic")).toBe("Claude (Anthropic)");
  });

  it("N3 · der Clientname der Fabrik führt auf denselben Anbieter zurück — beide Präfixe, kein drittes", () => {
    expect(anbieterAusClientName("cloud:openai:gpt-4o-mini")).toBe("openai");
    expect(anbieterAusClientName("anthropic:claude-sonnet-4-6")).toBe("anthropic");
    expect(anbieterAusClientName("local:Qwen3-32B-AWQ")).toBeUndefined();
    expect(anbieterAusClientName("deterministic")).toBeUndefined();
  });
});
