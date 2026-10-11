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
import type { ModelClient } from "../../services/reasoner/src/provider-model";
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

  // Ben nacharbeit-9: die Ausführung (`runTask`) versucht das erste Modellglied bei JEDEM Lauf
  // erneut, auch nach einem negativen Befund. Die Lage nennt deshalb weiter DIESES Glied — mit seinem
  // letzten Fehlschlag — und behauptet keinen lokalen oder regelbasierten Weg als feststehend.
  it("L4 · bekannte Unerreichbarkeit: das Glied bleibt genannt, mit seinem letzten Fehlschlag", () => {
    const reasoner = reasonerWieImProdukt(LOKAL);
    expect(reasoner.kiLage().modus).toBe("intern");
    reasoner.recordReachability(false, "local");
    expect(reasoner.kiLage()).toEqual({
      modus: "intern",
      anbieter: "local",
      anbieterName: null,
      herkunft: { land: null, nachweis: "unbekannt" },
      verfuegbarkeit: "unerreichbar",
    });
    const karte = reasoner.configStatus().betreiber;
    expect(karte?.zugang).toBe("local");
    expect(karte?.modell).toBe("lokal-test-modell");
    expect(karte?.verfuegbarkeit).toBe("unerreichbar");
    // Und zurück: antwortet es wieder, ist es wieder als erreichbar gemeldet.
    reasoner.recordReachability(true, "local");
    expect(reasoner.kiLage()).toMatchObject({ modus: "intern", verfuegbarkeit: "erreichbar" });
  });

  it("L5 · Cloud freigegeben, aber zuletzt gescheitert: die Lage nennt WEITER die Cloud — kein vorweggenommener Ersatz", async () => {
    const reasoner = reasonerWieImProdukt({ ...CLOUD, ...LOKAL });
    await erteileKiFreigabe(reasoner);
    expect(reasoner.kiLage().modus).toBe("extern");
    reasoner.recordReachability(false, "openai");
    expect(reasoner.kiLage()).toMatchObject({
      modus: "extern",
      anbieter: "openai",
      verfuegbarkeit: "unerreichbar",
    });
    // Die Karte nennt dasselbe Glied — nicht das lokale Modell, auf das ein Lauf erst NACH einem
    // weiteren Fehlschlag fiele.
    expect(reasoner.configStatus().betreiber?.zugang).toBe("openai");
    expect(reasoner.configStatus().betreiber?.modell).toBe("gpt-test-modell");
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

    // Zuletzt gescheitert: der Anbieter BLEIBT im Satz (der nächste Lauf sendet zuerst wieder an
    // ihn), dazu der Fehlschlag — und im Hinweis der ausgeschriebene Satz, ohne Ersatzzusage.
    const gescheitert = kiLageAnzeige({ ...lage, verfuegbarkeit: "unerreichbar" });
    expect(gescheitert.textKey).toBe(KI_LAGE_TEXT.extern);
    expect(gescheitert.params).toEqual({ anbieter: "OpenAI" });
    expect(gescheitert.verfuegbarkeitKey).toBe(KI_LAGE_TEXT.verfuegbarZuletztGescheitert);
    expect(gescheitert.hinweisKeys).toEqual([
      KI_LAGE_TEXT.verfuegbarUnerreichbar,
      KI_HEADER_TEXT.hintExternal,
      KI_HEADER_TEXT.offenePruefungen,
    ]);

    expect(kiLageAnzeige(undefined).textKey).toBe(KI_LAGE_TEXT.unbekannt);
  });
});

// ================================================================================================
// Ben nacharbeit-9 · STATUS UND ANSCHLIESSENDER ANTWORTLAUF HÄNGEN ZUSAMMEN — mit Attrappen gemessen.
// ================================================================================================
//
// Zwei zählende Provider-Attrappen (Cloud unter „cloud:openai:…", lokal unter „local:…") statt echter
// Clients: gelesen wird erst die Lage, dann läuft ein echter Antwortlauf (`Reasoner.answer`, Aufgabe
// `answer`) durch DIESELBE Kette, und gezählt wird, wohin er zuerst sendet. Die Lage stimmt, wenn
// das von ihr genannte Glied genau das ist, das der Lauf zuerst ruft.
function zaehlendeAttrappe(name: string, reihenfolge: string[], antwort: () => string) {
  const client: ModelClient = {
    name,
    complete: async () => {
      reihenfolge.push(name);
      return antwort();
    },
  };
  return { client, rufe: () => reihenfolge.filter((n) => n === name).length };
}

const KONTEXT = [
  {
    id: "ko-1",
    title: "Pumpe P2",
    statement: "Pumpe P2 wird alle 200 Betriebsstunden geschmiert.",
    status: "validiert" as const,
    trust: 92,
  },
];

// Der Name ist der, unter dem `Reasoner` einen Bestands-`primary` dem Anbieter OpenAI zuordnet.
const CLOUD_ATTRAPPE = "cloud:openai:attrappen-modell";
const LOKAL_ATTRAPPE = "local:attrappen-lokal";

function attrappenReasoner(cloudAntwort: () => string) {
  const reihenfolge: string[] = [];
  const cloud = zaehlendeAttrappe(CLOUD_ATTRAPPE, reihenfolge, cloudAntwort);
  const lokal = zaehlendeAttrappe(LOKAL_ATTRAPPE, reihenfolge, () => "Lokale Antwort.");
  const reasoner = new Reasoner(
    new ModelProvider(cloud.client),
    undefined,
    undefined,
    undefined,
    new ModelProvider(lokal.client),
  );
  return { reasoner, cloud, lokal, reihenfolge };
}

describe("Ben nacharbeit-9 · die Lage nennt das Glied, an das der nächste Lauf zuerst sendet", () => {
  it("L7 · Cloud zuletzt gescheitert: die Lage nennt die Cloud, und der nächste Lauf ruft sie zuerst", async () => {
    const { reasoner, cloud, reihenfolge } = attrappenReasoner(() => "Pumpe P2: alle 200 h.");
    await erteileKiFreigabe(reasoner);
    reasoner.recordReachability(false, "openai");
    expect(reasoner.kiLage()).toMatchObject({
      modus: "extern",
      anbieter: "openai",
      verfuegbarkeit: "unerreichbar",
    });
    await reasoner.answer("Wie oft wird Pumpe P2 geschmiert?", KONTEXT, "de");
    // Genau das gemeldete Glied hat die Inhalte ZUERST bekommen — nicht der lokale Weg, den die
    // Anzeige bis Nacharbeit 8 an dieser Stelle schon als feststehend behauptete.
    expect(reihenfolge[0]).toBe(CLOUD_ATTRAPPE);
    expect(cloud.rufe()).toBeGreaterThan(0);
  });

  it("L8 · scheitert die Cloud im Lauf wirklich, fällt ERST DANN der Lauf auf das lokale Glied", async () => {
    const { reasoner, lokal, reihenfolge } = attrappenReasoner(() => {
      throw new Error("Attrappe: 503");
    });
    await erteileKiFreigabe(reasoner);
    // Vor dem Lauf: kein Befund — die Lage nennt die Cloud, ungeprüft, und behauptet keinen Ersatz.
    expect(reasoner.kiLage()).toMatchObject({ modus: "extern", verfuegbarkeit: "ungeprueft" });
    await reasoner.answer("Wie oft wird Pumpe P2 geschmiert?", KONTEXT, "de");
    expect(reihenfolge[0]).toBe(CLOUD_ATTRAPPE);
    expect(lokal.rufe()).toBeGreaterThan(0);
    expect(reihenfolge.indexOf(LOKAL_ATTRAPPE)).toBeGreaterThan(
      reihenfolge.indexOf(CLOUD_ATTRAPPE),
    );
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

  it("W5 · nur ein BELEGTER Wissensstand wird als Wissensstand gezeigt — mit Quelle und Abrufdatum", () => {
    const anzeige = betreiberKartenAnzeige({
      zugang: "anthropic",
      betreiber: "Anthropic",
      modell: "beispiel-modell",
      herkunft: { land: "us", nachweis: "behauptet" },
      wissensstand: {
        stand: "2000-01",
        nachweis: "belegt",
        quelle: "Beispielfundstelle",
        abgerufen: "2000-02-01",
        quellenbedarf: null,
      },
      verfuegbarkeit: "ungeprueft",
    });
    expect(anzeige.wissensstand).toEqual({
      key: BETREIBER_KARTE_TEXT.wissensstandBelegt,
      params: { stand: "2000-01", quelle: "Beispielfundstelle", abgerufen: "2000-02-01" },
    });
    expect(anzeige.quellenbedarf).toBeNull();
  });

  // Ben nacharbeit-10: die TATSÄCHLICHEN Tabelleneinträge aus der Herstellerbeschaffung
  // (QUELLEN-R0299-HERSTELLER-20261008.json) — exakte Kennung, veröffentlichter „knowledge cutoff",
  // Herstellerquelle, Abrufdatum. Und die Gegenrichtung: jede andere Kennung bleibt unbekannt.
  it("W7 · die belegten Kennungen liefern den veröffentlichten Wissensstand mit Herstellerquelle", () => {
    expect(modellWissensstand("gpt-6-astra")).toEqual({
      stand: "2026-04-30",
      nachweis: "belegt",
      quelle: "https://developers.openai.com/api/docs/models/gpt-6-astra",
      abgerufen: "2026-10-08",
      quellenbedarf: null,
    });
    expect(modellWissensstand("gpt-4o-mini")).toEqual({
      stand: "2023-10-01",
      nachweis: "belegt",
      quelle: "https://developers.openai.com/api/docs/models/gpt-4o-mini",
      abgerufen: "2026-10-08",
      quellenbedarf: null,
    });
    // Sonnet 4.6: der VERLÄSSLICHE Wissensstand (Aug 2025), nicht das Trainingsdatenende (Jan 2026).
    const sonnet = modellWissensstand("claude-sonnet-4-6");
    expect(sonnet).toEqual({
      stand: "2025-08",
      nachweis: "belegt",
      quelle: "https://platform.claude.com/docs/en/models/sonnet-4-6/overview",
      abgerufen: "2026-10-08",
      quellenbedarf: null,
    });
    expect(sonnet.stand).not.toBe("2026-01");
  });

  it("W8 · kein Präfix- oder Versionsraten: Nachbarkennungen bleiben unbekannt", () => {
    for (const kennung of [
      "gpt-4o-mini-2024-07-18",
      "GPT-4O-MINI",
      "gpt-4o",
      "claude-sonnet-4-6-20260101",
      "claude-sonnet-4-5",
      "lokal-test-modell",
    ]) {
      const stand = modellWissensstand(kennung);
      expect([kennung, stand.nachweis, stand.stand]).toEqual([kennung, "unbekannt", null]);
      expect(stand.quellenbedarf).toContain(kennung);
    }
  });

  it("W9 · die Karte zeigt einen belegten Eintrag mit Quelle und Abrufdatum, ohne Quellenbedarf", () => {
    const anzeige = betreiberKartenAnzeige({
      zugang: "anthropic",
      betreiber: "Claude (Anthropic)",
      modell: "claude-sonnet-4-6",
      herkunft: { land: "us", nachweis: "behauptet" },
      wissensstand: modellWissensstand("claude-sonnet-4-6"),
      verfuegbarkeit: "ungeprueft",
    });
    expect(anzeige.wissensstand).toEqual({
      key: BETREIBER_KARTE_TEXT.wissensstandBelegt,
      params: {
        stand: "2025-08",
        quelle: "https://platform.claude.com/docs/en/models/sonnet-4-6/overview",
        abgerufen: "2026-10-08",
      },
    });
    expect(anzeige.quellenbedarf).toBeNull();
  });

  it("W6 · zuletzt gescheitert: die Karte nennt Betreiber und Modell weiter und den Fehlschlag dazu", () => {
    const anzeige = betreiberKartenAnzeige({
      zugang: "openai",
      betreiber: "OpenAI",
      modell: "gpt-test-modell",
      herkunft: { land: "us", nachweis: "behauptet" },
      wissensstand: modellWissensstand("gpt-test-modell"),
      verfuegbarkeit: "unerreichbar",
    });
    expect(anzeige.modellArbeitet).toBe(true);
    expect(anzeige.betreiber).toEqual({ wortlaut: "OpenAI" });
    expect(anzeige.verfuegbarkeit).toEqual({
      key: BETREIBER_KARTE_TEXT.verfuegbarUnerreichbar,
    });
  });
});
