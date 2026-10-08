import { describe, expect, it, vi } from "vitest";
import type {
  ReasonerBetreiberKarte,
  ReasonerKiLage as WebKiLage,
} from "../../apps/web/src/api/types";
import {
  BETREIBER_KARTE_TEXT,
  betreiberKartenAnzeige,
} from "../../apps/web/src/lib/betreiberKarte";
import { KI_HEADER_TEXT } from "../../apps/web/src/lib/kiHeaderStatus";
import { KI_LAGE_TEXT, kiLageAnzeige } from "../../apps/web/src/lib/kiLageAnzeige";
import { ModelProvider, Reasoner } from "../../services/reasoner";
import { modellWissensstand } from "../../services/reasoner/src/anbieter-herkunft";
// Die Umgebungsfabriken sind bewusst nicht aus dem Paket-Index exportiert (SCRUM-502 R8).
import {
  createCappedCloudClientFromEnv,
  createCappedLocalClientFromEnv,
} from "../../services/reasoner/src/model-client";

// ================================================================================================
// AUFTRAG ki-modus-wahrheit · Ben nacharbeit-2: R-0599 (KI-Lage dauerhaft in der Kopfzeile) und
// R-0299 (Karte „Betreiber und Wissensstand").
// ================================================================================================
//
// Gemessen am ECHTEN Reasoner, verdrahtet wie in `services/app/src/build-app.ts` (dieselbe
// Nachbildung wie `zugang-herkunft.test.ts`). Eine KI-Freigabe wird hier NICHT erteilt (der
// Freigabe-Wächter JOB 3550 F hält sie als namentliche Ausnahme): der „arbeitende Zugang" wird für
// die Abbildungsfälle über `vi.spyOn` auf die private Auswahl gesetzt — gemessen wird dann genau
// die Abbildung Zugang → Lage/Karte, nicht die Freigabelogik (die hat ihre eigenen Prüfungen).

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

const SCHLUESSEL_OPENAI = "sk-test-ki-lage-nur-hier-0001";

function mitArbeitendemZugang(reasoner: Reasoner, zugang: "openai" | "anthropic" | "local"): void {
  // biome-ignore lint/suspicious/noExplicitAny: private Auswahl gezielt gesetzt (siehe Kopf)
  vi.spyOn(reasoner as any, "arbeitenderZugang").mockReturnValue(zugang);
}

describe("R-0599 · die KI-Lage kommt vom Server — ohne Modellnamen, ohne Schlüssel", () => {
  it("L1 · ohne Modell (auch mit eingerichtetem Schlüssel, aber ohne Freigabe) ehrlich „keine“", () => {
    for (const env of [{}, { OPENAI_API_KEY: SCHLUESSEL_OPENAI }]) {
      expect(reasonerWieImProdukt(env).kiLage()).toEqual({
        modus: "keine",
        anbieter: null,
        anbieterName: null,
        herkunft: null,
      });
    }
  });

  it("L2 · arbeitet ein Cloud-Zugang: „extern“ mit Anbietername und belegter Nachweisstufe", () => {
    const reasoner = reasonerWieImProdukt({
      OPENAI_API_KEY: SCHLUESSEL_OPENAI,
      REASONER_MODEL: "gpt-test-modell",
    });
    mitArbeitendemZugang(reasoner, "openai");
    const lage = reasoner.kiLage();
    expect(lage.modus).toBe("extern");
    expect(lage.anbieter).toBe("openai");
    expect(lage.anbieterName).toBeTruthy();
    expect(lage.herkunft).toEqual({ land: "us", nachweis: "behauptet" });
    const draht = JSON.stringify(lage);
    // Die Lage ist für JEDEN angemeldeten Nutzer — Modellname bleibt Verwaltersicht.
    expect(draht).not.toContain("gpt-test-modell");
    expect(draht).not.toContain(SCHLUESSEL_OPENAI);
  });

  it("L3 · arbeitet der Server-Zugang: „intern“, ohne Anbieternamen und ohne geratene Herkunft", () => {
    const reasoner = reasonerWieImProdukt({});
    mitArbeitendemZugang(reasoner, "local");
    expect(reasoner.kiLage()).toEqual({
      modus: "intern",
      anbieter: "local",
      anbieterName: null,
      herkunft: { land: null, nachweis: "unbekannt" },
    });
  });

  it("L4 · die Kopfzeilen-Ableitung zeigt die Serverauskunft — keine DSGVO-Aussage", () => {
    const keine = kiLageAnzeige({
      modus: "keine",
      anbieter: null,
      anbieterName: null,
      herkunft: null,
    });
    expect(keine.textKey).toBe(KI_LAGE_TEXT.keine);
    expect(keine.hinweisKeys).toEqual([KI_HEADER_TEXT.hintNone]);
    expect(keine.ton).toBe("neutral");

    const lage: WebKiLage = {
      modus: "extern",
      anbieter: "openai",
      anbieterName: "OpenAI",
      herkunft: { land: "us", nachweis: "behauptet" },
    };
    const extern = kiLageAnzeige(JSON.parse(JSON.stringify(lage)) as WebKiLage);
    expect(extern.textKey).toBe(KI_LAGE_TEXT.extern);
    expect(extern.params).toEqual({ anbieter: "OpenAI" });
    expect(extern.hinweisKeys).toEqual([
      KI_HEADER_TEXT.hintExternal,
      KI_HEADER_TEXT.offenePruefungen,
    ]);
    expect(extern.herkunft?.key).toBe(KI_HEADER_TEXT.herkunftBehauptet);
    expect(JSON.stringify(extern)).not.toMatch(/dsgvo|gdpr|avg/i);

    expect(kiLageAnzeige(undefined).textKey).toBe(KI_LAGE_TEXT.unbekannt);
  });
});

describe("R-0299 · Betreiber und Wissensstand — nur aus belegten Angaben", () => {
  it("W1 · ohne belegte Herstellerangabe ist der Stichtag unbekannt UND die fehlende Quelle benannt", () => {
    const stand = modellWissensstand("gpt-test-modell");
    expect(stand.nachweis).toBe("unbekannt");
    expect(stand.stand).toBeNull();
    expect(stand.quelle).toBeNull();
    expect(stand.quellenbedarf).toContain("gpt-test-modell");
    expect(modellWissensstand(null).quellenbedarf).toBeTruthy();
  });

  it("W2 · die Karte des Servers nennt Betreiber, Modell, Herkunft und den unbelegten Stichtag", () => {
    const reasoner = reasonerWieImProdukt({
      OPENAI_API_KEY: SCHLUESSEL_OPENAI,
      REASONER_MODEL: "gpt-test-modell",
    });
    mitArbeitendemZugang(reasoner, "openai");
    const cfg = reasoner.configStatus();
    expect(cfg.betreiber?.zugang).toBe("openai");
    expect(cfg.betreiber?.betreiber).toBeTruthy();
    expect(cfg.betreiber?.herkunft).toEqual({ land: "us", nachweis: "behauptet" });
    expect(cfg.betreiber?.wissensstand?.nachweis).toBe("unbekannt");
    expect(JSON.stringify(cfg)).not.toContain(SCHLUESSEL_OPENAI);
  });

  it("W3 · ohne arbeitendes Modell sagt die Karte nur das — kein Betreiber, kein Stichtag", () => {
    const cfg = reasonerWieImProdukt({}).configStatus();
    expect(cfg.betreiber).toEqual({
      zugang: null,
      betreiber: null,
      modell: null,
      herkunft: null,
      wissensstand: null,
    });
    const anzeige = betreiberKartenAnzeige(cfg.betreiber as ReasonerBetreiberKarte);
    expect(anzeige.modellArbeitet).toBe(false);
    expect(anzeige.wissensstand).toBeNull();
  });

  it("W4 · die Kartenableitung zeigt „unbekannt“ mit Quellenbedarf, nie eine erfundene Zahl", () => {
    const anzeige = betreiberKartenAnzeige({
      zugang: "openai",
      betreiber: "OpenAI",
      modell: "gpt-test-modell",
      herkunft: { land: "us", nachweis: "behauptet" },
      wissensstand: modellWissensstand("gpt-test-modell"),
    });
    expect(anzeige.modellArbeitet).toBe(true);
    expect(anzeige.betreiber).toEqual({ wortlaut: "OpenAI" });
    expect(anzeige.modell).toEqual({ wortlaut: "gpt-test-modell" });
    expect(anzeige.wissensstand).toEqual({ key: BETREIBER_KARTE_TEXT.wissensstandUnbekannt });
    expect(anzeige.quellenbedarf).toEqual({
      key: BETREIBER_KARTE_TEXT.quellenbedarf,
      params: { modell: "gpt-test-modell" },
    });
  });

  it("W5 · nur ein BELEGTER Stichtag wird als Stichtag gezeigt — mit seiner Quelle", () => {
    const anzeige = betreiberKartenAnzeige({
      zugang: "anthropic",
      betreiber: "Anthropic",
      modell: "beispiel-modell",
      herkunft: { land: "us", nachweis: "behauptet" },
      wissensstand: {
        stand: "2000-01",
        nachweis: "belegt",
        quelle: "Beispielfundstelle",
        quellenbedarf: null,
      },
    });
    expect(anzeige.wissensstand).toEqual({
      key: BETREIBER_KARTE_TEXT.wissensstandBelegt,
      params: { stand: "2000-01", quelle: "Beispielfundstelle" },
    });
    expect(anzeige.quellenbedarf).toBeNull();
  });
});
