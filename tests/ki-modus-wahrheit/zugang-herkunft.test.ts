import { describe, expect, it } from "vitest";
import type { ReasonerConfigStatus as WebConfigStatus } from "../../apps/web/src/api/types";
import { KI_HEADER_TEXT, kiHeaderStatus } from "../../apps/web/src/lib/kiHeaderStatus";
import { ModelProvider, Reasoner } from "../../services/reasoner";
// Die Umgebungsfabriken sind bewusst nicht aus dem Paket-Index exportiert (SCRUM-502 R8).
import {
  createCappedCloudClientFromEnv,
  createCappedLocalClientFromEnv,
} from "../../services/reasoner/src/model-client";

// ================================================================================================
// AUFTRAG ki-modus-wahrheit · R-0702 (Herkunft aus der zentralen Zugangsverwaltung) und
// R-0680 (Konfiguration einsehbar, Schlüssel nie).
// ================================================================================================
//
// Gemessen wird am ECHTEN Reasoner, verdrahtet wie in `services/app/src/build-app.ts` (beide
// gecappten Cloud-Clients unter ihrem Namen, gecappter lokaler Client als secondary) — dieselbe
// Nachbildung wie `tests/openai-cloud-anbieter/cloud-wahl-verbindungstest.test.tsx`. Kein
// Netzaufruf: `configStatus()` liest nur Verdrahtung und Tabelle.

const KEIN_SCHLUESSELBUND = (): undefined => undefined;
const KEIN_SPEICHERN = (): boolean => false;

function reasonerWieImProdukt(env: Record<string, string | undefined>): Reasoner {
  const cappedCloud = createCappedCloudClientFromEnv(env, KEIN_SCHLUESSELBUND, KEIN_SPEICHERN);
  const cappedLocal = createCappedLocalClientFromEnv(env);
  return new Reasoner(
    undefined,
    undefined,
    undefined,
    undefined,
    cappedLocal ? new ModelProvider(cappedLocal) : undefined,
    undefined,
    {
      anbieter: {
        ...(cappedCloud.openai ? { openai: new ModelProvider(cappedCloud.openai) } : {}),
        ...(cappedCloud.anthropic ? { anthropic: new ModelProvider(cappedCloud.anthropic) } : {}),
      },
      gruende: cappedCloud.gruende,
    },
  );
}

const SCHLUESSEL_OPENAI = "sk-test-zugang-herkunft-nur-hier-0001";
const SCHLUESSEL_ANTHROPIC = "sk-ant-test-zugang-herkunft-nur-hier-0002";

describe("R-0702 · die Herkunft je Zugang kommt aus der zentralen Zugangsverwaltung des Servers", () => {
  it("H1 · jeder Zugang trägt eine Herkunft mit Nachweisstufe — auch ohne eingerichtetes Modell", () => {
    const cfg = reasonerWieImProdukt({}).configStatus();
    expect(cfg.herkunft).toEqual({
      openai: { land: "us", nachweis: "behauptet" },
      anthropic: { land: "us", nachweis: "behauptet" },
      local: { land: null, nachweis: "unbekannt" },
    });
  });

  it("H2 · `geprueft` wird für keinen Zugang behauptet (es gibt keinen hinterlegten Nachweis)", () => {
    const cfg = reasonerWieImProdukt({
      OPENAI_API_KEY: SCHLUESSEL_OPENAI,
      ANTHROPIC_API_KEY: SCHLUESSEL_ANTHROPIC,
    }).configStatus();
    for (const [zugang, herkunft] of Object.entries(cfg.herkunft ?? {})) {
      expect(herkunft.nachweis, zugang).not.toBe("geprueft");
    }
  });

  it("H3 · die Herkunft hängt am ZUGANG, nicht am Modellnamen", () => {
    // Ein Modellname, den die frühere Browser-Tabelle als „Frankreich/EU" gedeutet hätte, ändert
    // an der Auskunft für den OpenAI-Zugang nichts.
    const cfg = reasonerWieImProdukt({
      OPENAI_API_KEY: SCHLUESSEL_OPENAI,
      REASONER_MODEL: "mistral-large",
    }).configStatus();
    expect(cfg.herkunft?.openai).toEqual({ land: "us", nachweis: "behauptet" });
  });

  it("H4 · die Kopfzeilen-Ableitung zeigt genau die Serverauskunft (kein zweites Raten)", () => {
    const cfg = reasonerWieImProdukt({ OPENAI_API_KEY: SCHLUESSEL_OPENAI }).configStatus();
    // Der Server- und der Webvertrag sind wortgleich; über JSON wie am Draht.
    const amDraht = JSON.parse(JSON.stringify(cfg)) as WebConfigStatus;
    const status = kiHeaderStatus(amDraht);
    if (status.mode === "none") {
      // Ohne Adminfreigabe läuft keine Aufgabe an der Cloud — dann gibt es ehrlich keine Herkunft.
      expect(status.herkunft).toBeNull();
      return;
    }
    expect(status.herkunft).toEqual({
      key: KI_HEADER_TEXT.herkunftBehauptet,
      landKey: "country.us",
      landCode: "US",
    });
  });
});

describe("R-0680 · Anbieter und Modell einsehbar — Schlüssel und Geheimnisse nie", () => {
  it("S1 · die Konfigurationsauskunft nennt Anbieter/Modell, trägt aber keinen Schlüssel", () => {
    const cfg = reasonerWieImProdukt({
      OPENAI_API_KEY: SCHLUESSEL_OPENAI,
      ANTHROPIC_API_KEY: SCHLUESSEL_ANTHROPIC,
      REASONER_MODEL: "gpt-test-modell",
    }).configStatus();
    const draht = JSON.stringify(cfg);
    expect(cfg.cloudProviders.openai.configured).toBe(true);
    expect(cfg.cloudProviders.anthropic.configured).toBe(true);
    expect(draht).toContain("gpt-test-modell");
    expect(draht).not.toContain(SCHLUESSEL_OPENAI);
    expect(draht).not.toContain(SCHLUESSEL_ANTHROPIC);
    expect(draht).not.toMatch(/sk-(ant-)?test/);
  });
});
