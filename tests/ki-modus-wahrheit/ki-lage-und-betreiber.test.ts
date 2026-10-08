import { describe, expect, it } from "vitest";
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
import { erteileKiFreigabe } from "../../services/reasoner/src/testhelfer-ki-freigabe";

// ================================================================================================
// AUFTRAG ki-modus-wahrheit · R-0599 (KI-Lage dauerhaft in der Kopfzeile), R-0299 (Karte
// „Betreiber und Wissensstand") und — Ben nacharbeit-7 — R-0940/R-2142 (Erreichbarkeit).
// ================================================================================================
//
// Gemessen am ECHTEN Reasoner, verdrahtet wie in `services/app/src/build-app.ts` (dieselbe
// Nachbildung wie `zugang-herkunft.test.ts`). KEIN Mock der Auflösung: bis Nacharbeit 7 ersetzte
// diese Datei den „arbeitenden Zugang" für die Anbieterfälle durch einen festen Rückgabewert — und
// übersah damit genau den Mischfall, in dem Kopfzeile und Ausführung auseinanderliefen (Wahl
// „auto", Cloud UND lokales Modell eingerichtet, Cloud-Freigabe fehlt). Die Fälle unten bauen jede
// Lage aus echter Verdrahtung, echter Freigabe (über den registrierten Helfer, JOB 3550 F) und den
// echten Erreichbarkeitssignalen (`recordReachability`, dieselbe Schreibstelle wie Probe und Lauf).
// Kein Fall ruft ein Modell auf: gelesen werden nur Verdrahtung, Zuordnung und Kantenbefund.

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
const CLOUD = { OPENAI_API_KEY: SCHLUESSEL_OPENAI, REASONER_MODEL: "gpt-test-modell" };
// Ein lokaler Server auf der eigenen Maschine — er wird nie angesprochen (kein Modellaufruf).
const LOKAL = {
  KLARWERK_LOCAL_LLM_URL: "http://127.0.0.1:9/v1",
  KLARWERK_LOCAL_LLM_MODEL: "lokal-test-modell",
};

describe("R-0599 · die KI-Lage kommt aus der freigegebenen Ausführungskette — ohne Mock", () => {
  it("L1 · ohne Modell (auch mit eingerichtetem Schlüssel, aber ohne Freigabe) ehrlich „keine“", () => {
    for (const env of [{}, { OPENAI_API_KEY: SCHLUESSEL_OPENAI }]) {
      expect(reasonerWieImProdukt(env).kiLage()).toEqual({
        modus: "keine",
        anbieter: null,
        anbieterName: null,
        herkunft: null,
        verfuegbarkeit: null,
      });
    }
  });

  it("L2 · freigegebener Cloud-Zugang: „extern“ mit Anbietername — erst ungeprüft, dann erreichbar", async () => {
    const reasoner = reasonerWieImProdukt(CLOUD);
    await erteileKiFreigabe(reasoner);
    const lage = reasoner.kiLage();
    expect(lage.modus).toBe("extern");
    expect(lage.anbieter).toBe("openai");
    expect(lage.anbieterName).toBeTruthy();
    expect(lage.herkunft).toEqual({ land: "us", nachweis: "behauptet" });
    expect(lage.verfuegbarkeit).toBe("ungeprueft");
    const draht = JSON.stringify(lage);
    // Die Lage ist für JEDEN angemeldeten Nutzer — Modellname bleibt Verwaltersicht.
    expect(draht).not.toContain("gpt-test-modell");
    expect(draht).not.toContain(SCHLUESSEL_OPENAI);
    reasoner.recordReachability(true, "openai");
    expect(reasoner.kiLage().verfuegbarkeit).toBe("erreichbar");
  });

  it("L3 · BENS MISCHFALL: „auto“, Cloud UND lokal eingerichtet, keine Cloud-Freigabe → „intern“, nicht „extern“", () => {
    const reasoner = reasonerWieImProdukt({ ...CLOUD, ...LOKAL });
    const cfg = reasoner.configStatus();
    // Die Voraussetzung, gemessen statt angenommen: die ANZEIGE der Wahl nennt den Cloud-Anbieter
    // (sie übergeht die Freigabe absichtlich, JOB 3549) — genau das hat die Kopfzeile vorher
    // übernommen. Ausgeführt wird aber lokal.
    expect(reasoner.getTaskConfig().global).toBe("auto");
    expect(cfg.effectiveAnbieter?.answer).toBe("openai");
    expect(cfg.effective?.answer).toBe("model");
    expect(reasoner.kiLage()).toEqual({
      modus: "intern",
      anbieter: "local",
      anbieterName: null,
      herkunft: { land: null, nachweis: "unbekannt" },
      verfuegbarkeit: "ungeprueft",
    });
    // Die Karte nennt DASSELBE Glied — den lokalen Zugang mit seinem Modell, keinen Cloud-Betreiber.
    expect(cfg.betreiber?.zugang).toBe("local");
    expect(cfg.betreiber?.betreiber).toBeNull();
    expect(cfg.betreiber?.modell).toBe("lokal-test-modell");
    expect(JSON.stringify(cfg.betreiber)).not.toContain("gpt-test-modell");
  });

  it("L4 · bekannte Unerreichbarkeit: das einzige Modell scheitert zuletzt → „keine“, ausdrücklich unerreichbar", () => {
    const reasoner = reasonerWieImProdukt(LOKAL);
    expect(reasoner.kiLage().modus).toBe("intern");
    reasoner.recordReachability(false, "local");
    expect(reasoner.kiLage()).toEqual({
      modus: "keine",
      anbieter: null,
      anbieterName: null,
      herkunft: null,
      verfuegbarkeit: "unerreichbar",
    });
    const karte = reasoner.configStatus().betreiber;
    expect(karte?.zugang).toBeNull();
    expect(karte?.modell).toBeNull();
    expect(karte?.verfuegbarkeit).toBe("unerreichbar");
    // Und zurück: antwortet es wieder, arbeitet es wieder — gemeldet als erreichbar.
    reasoner.recordReachability(true, "local");
    expect(reasoner.kiLage()).toMatchObject({ modus: "intern", verfuegbarkeit: "erreichbar" });
  });

  it("L5 · Ersatzweg nur wie aufgelöst: Cloud freigegeben, aber unerreichbar → das lokale Glied arbeitet", async () => {
    const reasoner = reasonerWieImProdukt({ ...CLOUD, ...LOKAL });
    await erteileKiFreigabe(reasoner);
    expect(reasoner.kiLage().modus).toBe("extern");
    reasoner.recordReachability(false, "openai");
    expect(reasoner.kiLage()).toMatchObject({
      modus: "intern",
      anbieter: "local",
      verfuegbarkeit: "ungeprueft",
    });
    expect(reasoner.configStatus().betreiber?.modell).toBe("lokal-test-modell");
    // Ohne Ersatzglied (nur Cloud) bleibt nach demselben Befund NICHTS — der regelbasierte Ersatz.
    const nurCloud = reasonerWieImProdukt(CLOUD);
    await erteileKiFreigabe(nurCloud);
    nurCloud.recordReachability(false, "openai");
    expect(nurCloud.kiLage()).toMatchObject({ modus: "keine", verfuegbarkeit: "unerreichbar" });
  });

  it("L6 · die Kopfzeilen-Ableitung zeigt die Serverauskunft — keine DSGVO-Aussage", () => {
    const keine = kiLageAnzeige({
      modus: "keine",
      anbieter: null,
      anbieterName: null,
      herkunft: null,
      verfuegbarkeit: null,
    });
    expect(keine.textKey).toBe(KI_LAGE_TEXT.keine);
    expect(keine.verfuegbarkeitKey).toBeNull();
    expect(keine.hinweisKeys).toEqual([KI_HEADER_TEXT.hintNone]);
    expect(keine.ton).toBe("neutral");

    const lage: WebKiLage = {
      modus: "extern",
      anbieter: "openai",
      anbieterName: "OpenAI",
      herkunft: { land: "us", nachweis: "behauptet" },
      verfuegbarkeit: "ungeprueft",
    };
    const extern = kiLageAnzeige(JSON.parse(JSON.stringify(lage)) as WebKiLage);
    expect(extern.textKey).toBe(KI_LAGE_TEXT.extern);
    expect(extern.params).toEqual({ anbieter: "OpenAI" });
    expect(extern.verfuegbarkeitKey).toBe(KI_LAGE_TEXT.verfuegbarUngeprueft);
    expect(extern.hinweisKeys).toEqual([
      KI_HEADER_TEXT.hintExternal,
      KI_HEADER_TEXT.offenePruefungen,
    ]);
    expect(extern.herkunft?.key).toBe(KI_HEADER_TEXT.herkunftBehauptet);
    expect(JSON.stringify(extern)).not.toMatch(/dsgvo|gdpr|avg/i);
    expect(kiLageAnzeige({ ...lage, verfuegbarkeit: "erreichbar" }).verfuegbarkeitKey).toBe(
      KI_LAGE_TEXT.verfuegbarErreichbar,
    );

    // Eingerichtet, aber unerreichbar: ein EIGENER Satz — weder „keine KI" noch ein Anbieter.
    const weg = kiLageAnzeige({
      modus: "keine",
      anbieter: null,
      anbieterName: null,
      herkunft: null,
      verfuegbarkeit: "unerreichbar",
    });
    expect(weg.textKey).toBe(KI_LAGE_TEXT.unerreichbar);
    expect(weg.hinweisKeys).toEqual([KI_LAGE_TEXT.verfuegbarUnerreichbar]);
    expect(weg.herkunft).toBeNull();

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

  it("W2 · die Karte des Servers nennt Betreiber, Modell, Herkunft und den unbelegten Stichtag", async () => {
    const reasoner = reasonerWieImProdukt(CLOUD);
    await erteileKiFreigabe(reasoner);
    const cfg = reasoner.configStatus();
    expect(cfg.betreiber?.zugang).toBe("openai");
    expect(cfg.betreiber?.betreiber).toBeTruthy();
    expect(cfg.betreiber?.modell).toBe("gpt-test-modell");
    expect(cfg.betreiber?.herkunft).toEqual({ land: "us", nachweis: "behauptet" });
    expect(cfg.betreiber?.wissensstand?.nachweis).toBe("unbekannt");
    expect(cfg.betreiber?.verfuegbarkeit).toBe("ungeprueft");
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
      verfuegbarkeit: null,
    });
    const anzeige = betreiberKartenAnzeige(cfg.betreiber as ReasonerBetreiberKarte);
    expect(anzeige.modellArbeitet).toBe(false);
    expect(anzeige.wissensstand).toBeNull();
    expect(anzeige.verfuegbarkeit).toBeNull();
  });

  it("W4 · die Kartenableitung zeigt „unbekannt“ mit Quellenbedarf, nie eine erfundene Zahl", () => {
    const anzeige = betreiberKartenAnzeige({
      zugang: "openai",
      betreiber: "OpenAI",
      modell: "gpt-test-modell",
      herkunft: { land: "us", nachweis: "behauptet" },
      wissensstand: modellWissensstand("gpt-test-modell"),
      verfuegbarkeit: "erreichbar",
    });
    expect(anzeige.modellArbeitet).toBe(true);
    expect(anzeige.betreiber).toEqual({ wortlaut: "OpenAI" });
    expect(anzeige.modell).toEqual({ wortlaut: "gpt-test-modell" });
    expect(anzeige.verfuegbarkeit).toEqual({ key: BETREIBER_KARTE_TEXT.verfuegbarErreichbar });
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
      verfuegbarkeit: "ungeprueft",
    });
    expect(anzeige.wissensstand).toEqual({
      key: BETREIBER_KARTE_TEXT.wissensstandBelegt,
      params: { stand: "2000-01", quelle: "Beispielfundstelle" },
    });
    expect(anzeige.quellenbedarf).toBeNull();
  });

  it("W6 · eingerichtet, aber unerreichbar: die Karte sagt genau das statt „kein Modell“", () => {
    const anzeige = betreiberKartenAnzeige({
      zugang: null,
      betreiber: null,
      modell: null,
      herkunft: null,
      wissensstand: null,
      verfuegbarkeit: "unerreichbar",
    });
    expect(anzeige.modellArbeitet).toBe(false);
    expect(anzeige.verfuegbarkeit).toEqual({
      key: BETREIBER_KARTE_TEXT.verfuegbarUnerreichbar,
    });
  });
});
