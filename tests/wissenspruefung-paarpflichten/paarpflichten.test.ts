// ================================================================================================
// AUFNAHME 20260922 · PAARPFLICHTEN-DAUERHAFT (G2) — DIE VIER ORIGINALKRITERIEN.
// ================================================================================================
//
// K1  Quellrevision, Aussageversion und relevanter Kontext sind für jede Pflicht gespeichert.
// K2  Fünf Aussagen ergeben genau zehn eindeutige ungeordnete Paarpflichten; ein Kandidatenlimit
//     reduziert diese Menge nicht still.
// K3  Absturz/Wiederaufnahme arbeitet gespeicherte Pflichten ohne Verlust oder Doppelurteil ab.
// K4  Fehler, unbestimmtes Fachurteil und offene Restmenge bleiben unterscheidbar; ein fehlender
//     Modellaufruf zählt nicht als abgeschlossenes Urteil.
//
// Gemessen am In-Memory-Register (dieselbe Vertragsfläche wie Postgres) und an der Brücke im
// App-Root gegen echte Wissensobjekte. Postgres selbst: paarpflichten-pg.integration.test.ts.
// NICHT gemessen: ein echtes Modell, eine Bedienfläche, ein echter Prozessabbruch.
import { describe, expect, it, vi } from "vitest";
import { buildServices } from "../../services/app/src/build-app";
import { schemas } from "../../services/app/src/db";
import { DETECTION_CANDIDATE_CAP } from "../../services/app/src/detection-cap";
import {
  paarpflichtAussageVon,
  paarpflichtAussagenLaden,
} from "../../services/app/src/paarpflicht-aussagen";
import {
  InMemoryPaarpflichtRepo,
  type Paarpflicht,
  type PaarpflichtAussage,
  type PaarpflichtErgebnis,
  type PaarpflichtKontext,
  type PaarpflichtPruefer,
  PaarpflichtService,
  ergebnisAusKonfliktUrteil,
  paarpflichtenPlanen,
} from "../../services/conflicts";
import { CONFLICTS_SCHEMA } from "../../services/conflicts/src/repo-pg";
import { BESTANDSRESET_LOESCHGRAPH } from "../../services/db-tx";
import { pruefbasisVon } from "../../services/knowledge-object";
import { pflichttabellenAusDrill, tabellenAusSchemas } from "../backup-drill/pflichtsatz";

const KONTEXT: PaarpflichtKontext = { bestand: "b".repeat(32), pruefFassung: "konflikt-v3" };
const ZEIT = "2026-10-08T10:00:00.000Z";

function aussage(refId: string, version = 1): PaarpflichtAussage {
  return {
    refId,
    version,
    quelle: `q-${refId}-${version}`,
    quellen: [`src-${refId}`],
    kontext: `k-${refId}`,
  };
}

const FUENF = ["e", "c", "a", "d", "b"].map((id) => aussage(id));

const URTEIL: PaarpflichtErgebnis = {
  art: "urteil",
  ergebnis: "kein_konflikt",
  modell: "lokal:test",
};
const KEIN_MODELL: PaarpflichtErgebnis = { art: "kein_modell", grund: "no-model" };
const MODELLFEHLER: PaarpflichtErgebnis = { art: "fehler", grund: "model-error" };

const pruefer = (ergebnis: PaarpflichtErgebnis = URTEIL) =>
  vi.fn<PaarpflichtPruefer>(async () => ergebnis);

function paarVon(a: PaarpflichtAussage, b: PaarpflichtAussage): string {
  return `${a.refId}${b.refId}`;
}

function gefragtePaare(fn: ReturnType<typeof pruefer>): string[] {
  return fn.mock.calls.map(([a, b]) => paarVon(a, b));
}

// Steuerbare Uhr: der Absturzfall braucht den Fristablauf.
function uhr() {
  let jetzt = Date.parse(ZEIT);
  return {
    jetzt: () => new Date(jetzt),
    weiter: (ms: number) => {
      jetzt += ms;
    },
  };
}

describe("K2 · fünf Aussagen ergeben genau zehn ungeordnete Paarpflichten", () => {
  it("jedes ungeordnete Paar genau einmal, kein Selbstpaar, unabhängig von der Reihenfolge", () => {
    const pflichten = paarpflichtenPlanen("lauf-1", FUENF, KONTEXT, ZEIT);
    expect(pflichten).toHaveLength(10);
    expect(new Set(pflichten.map((p) => p.pairKey)).size).toBe(10);
    expect(new Set(pflichten.map((p) => p.id)).size).toBe(10);
    expect(pflichten.map((p) => paarVon(p.a, p.b)).sort()).toEqual([
      "ab",
      "ac",
      "ad",
      "ae",
      "bc",
      "bd",
      "be",
      "cd",
      "ce",
      "de",
    ]);
    expect(pflichten.every((p) => p.a.refId < p.b.refId && p.zustand === "offen")).toBe(true);

    const umgekehrt = paarpflichtenPlanen("lauf-1", [...FUENF].reverse(), KONTEXT, ZEIT);
    expect(umgekehrt.map((p) => p.id)).toEqual(pflichten.map((p) => p.id));
  });

  it("wiederholtes Planen legt nichts doppelt an", async () => {
    const service = new PaarpflichtService({ repo: new InMemoryPaarpflichtRepo() });
    expect(await service.planen("lauf-1", FUENF, KONTEXT)).toEqual({ gesamt: 10, neu: 10 });
    expect(await service.planen("lauf-1", FUENF, KONTEXT)).toEqual({ gesamt: 10, neu: 0 });
    expect(await service.liste("lauf-1")).toHaveLength(10);
  });

  it("eine doppelte Aussage wird nicht still zusammengelegt", () => {
    let fehler: unknown;
    try {
      paarpflichtenPlanen("lauf-1", [...FUENF, aussage("a", 2)], KONTEXT, ZEIT);
    } catch (e) {
      fehler = e;
    }
    expect(fehler).toMatchObject({ code: "AUSSAGE_DOPPELT" });
  });

  it("das Limit begrenzt nur den Schritt; der Rest bleibt gezählt und wird fortgesetzt", async () => {
    const service = new PaarpflichtService({ repo: new InMemoryPaarpflichtRepo() });
    await service.planen("lauf-1", FUENF, KONTEXT);
    const fn = pruefer();

    const erster = await service.abarbeiten("lauf-1", fn, { limit: 3 });
    expect(erster.geurteilt).toBe(3);
    expect(erster.bilanz).toMatchObject({ gesamt: 10, geurteilt: 3, rest: 7 });
    expect(erster.bilanz.abgeschlossen).toBe(false);

    let schritt = erster;
    while (schritt.bilanz.rest > 0) {
      schritt = await service.abarbeiten("lauf-1", fn, { limit: 3 });
    }
    expect(schritt.bilanz).toMatchObject({ gesamt: 10, geurteilt: 10, rest: 0 });
    expect(schritt.bilanz.abgeschlossen).toBe(true);
    expect(gefragtePaare(fn)).toHaveLength(10);
    expect(new Set(gefragtePaare(fn)).size).toBe(10);
  });

  it("mehr Aussagen als der Vergleichsdeckel: alle Paare sind Pflicht, der Deckel nur Schrittgröße", async () => {
    const deckel = DETECTION_CANDIDATE_CAP;
    const viele = Array.from({ length: deckel + 1 }, (_, i) => aussage(`ko-${i + 100}`));
    const paare = (viele.length * (viele.length - 1)) / 2;
    const service = new PaarpflichtService({ repo: new InMemoryPaarpflichtRepo() });
    expect(await service.planen("gross", viele, KONTEXT)).toEqual({ gesamt: paare, neu: paare });

    const schritt = await service.abarbeiten("gross", pruefer(), { limit: deckel });
    expect(schritt.bilanz).toMatchObject({
      gesamt: paare,
      geurteilt: deckel,
      rest: paare - deckel,
    });
    expect(schritt.bilanz.abgeschlossen).toBe(false);
  });
});

describe("K1 · Quellrevision, Aussageversion und Kontext je Pflicht", () => {
  it("jede Pflicht trägt beide Stände und den Laufkontext — auch nach dem Urteil", async () => {
    const service = new PaarpflichtService({ repo: new InMemoryPaarpflichtRepo() });
    await service.planen("lauf-1", FUENF, KONTEXT);
    await service.abarbeiten("lauf-1", pruefer());
    const pflichten = await service.liste("lauf-1");
    expect(pflichten).toHaveLength(10);
    for (const p of pflichten) {
      expect(p.a).toEqual(aussage(p.a.refId));
      expect(p.b).toEqual(aussage(p.b.refId));
      expect(p.kontext).toEqual(KONTEXT);
      expect(p.urteil).toMatchObject({ ergebnis: "kein_konflikt", modell: "lokal:test" });
    }
  });

  it("ein Lauf bleibt an seine Stände gebunden: neue Fassung → Abweichung statt Umdeutung", async () => {
    const service = new PaarpflichtService({ repo: new InMemoryPaarpflichtRepo() });
    await service.planen("lauf-1", FUENF, KONTEXT);
    const neueFassung = FUENF.map((a) => (a.refId === "c" ? aussage("c", 2) : a));
    await expect(service.planen("lauf-1", neueFassung, KONTEXT)).rejects.toMatchObject({
      code: "LAUF_STAND_ABWEICHUNG",
    });
    const andererBestand = { ...KONTEXT, bestand: "anders" };
    await expect(service.planen("lauf-1", FUENF, andererBestand)).rejects.toMatchObject({
      code: "LAUF_STAND_ABWEICHUNG",
    });
    expect((await service.liste("lauf-1")).every((p) => p.a.version === 1)).toBe(true);
  });

  it("App-Root: die Stände kommen aus der vorhandenen Prüfbasis echter Wissensobjekte, ohne Text", async () => {
    const services = buildServices();
    const KO = { type: "best_practice" as const, category: "Fuhrpark", author: "u1" };
    const blau = await services.ko.create({ ...KO, title: "Dienstwagen", statement: "Blau." });
    const rot = await services.ko.create({ ...KO, title: "Dienstwagen", statement: "Rot." });

    const ids = [blau.id, rot.id];
    const { aussagen, kontext } = await paarpflichtAussagenLaden(services.ko, ids, "konflikt-v3");
    const stempel = await services.ko.pruefbestandStempel();
    expect(kontext).toEqual({ bestand: stempel, pruefFassung: "konflikt-v3" });
    expect(aussagen[0]).toEqual(paarpflichtAussageVon(blau, stempel));
    expect(aussagen[0]).toMatchObject({
      refId: blau.id,
      version: blau.version,
      quelle: pruefbasisVon(blau, stempel).quelle,
      kontext: pruefbasisVon(blau, stempel).kontext,
    });

    const service = new PaarpflichtService({ repo: new InMemoryPaarpflichtRepo() });
    await service.planen("ko-lauf", aussagen, kontext);
    const [pflicht] = await service.liste("ko-lauf");
    expect([pflicht?.a.refId, pflicht?.b.refId].sort()).toEqual([...ids].sort());
    expect(pflicht?.kontext.bestand).toBe(stempel);
    expect(JSON.stringify(pflicht)).not.toMatch(/Dienstwagen|Blau\.|Rot\./);

    await expect(paarpflichtAussagenLaden(services.ko, ["fehlt"], "v")).rejects.toThrow();
  });

  it("Ablage: die Tabelle wird migriert, im Drill geprüft und im Reset gelöscht", () => {
    expect(CONFLICTS_SCHEMA).toContain("CREATE TABLE IF NOT EXISTS conflict_pair_obligations");
    expect(CONFLICTS_SCHEMA).toContain("UNIQUE (lauf_id, pair_key)");
    expect(tabellenAusSchemas(schemas)).toContain("conflict_pair_obligations");
    expect(pflichttabellenAusDrill()).toContain("conflict_pair_obligations");
    expect(BESTANDSRESET_LOESCHGRAPH).toContain("conflict_pair_obligations");
  });
});

describe("K3 · Absturz und Wiederaufnahme ohne Verlust oder Doppelurteil", () => {
  // Der „Prozess" stirbt nach dem Modellaufruf, bevor das Urteil geschrieben ist.
  function absturzBeimSchreiben(ablage: InMemoryPaarpflichtRepo, nachAbschluessen: number) {
    let abschluesse = 0;
    const echt = ablage.abschliessen.bind(ablage);
    return Object.assign(Object.create(ablage) as InMemoryPaarpflichtRepo, {
      abschliessen: (id: string, token: string, neu: Paarpflicht) => {
        abschluesse += 1;
        if (abschluesse > nachAbschluessen) {
          return Promise.reject(new Error("Prozess beendet"));
        }
        return echt(id, token, neu);
      },
    });
  }

  it("nach dem Absturz: nichts verloren, jedes Paar genau ein gespeichertes Urteil", async () => {
    const zeit = uhr();
    const ablage = new InMemoryPaarpflichtRepo();
    const fn = pruefer();

    const vorher = new PaarpflichtService({
      repo: absturzBeimSchreiben(ablage, 3),
      jetzt: zeit.jetzt,
      fristMs: 60_000,
    });
    await vorher.planen("lauf-1", FUENF, KONTEXT);
    await expect(vorher.abarbeiten("lauf-1", fn)).rejects.toThrow("Prozess beendet");
    expect(fn).toHaveBeenCalledTimes(4);
    expect(await vorher.bilanz("lauf-1")).toMatchObject({
      geurteilt: 3,
      inArbeit: 1,
      offen: 6,
      rest: 7,
    });

    // Neuer Prozess, dieselbe Ablage. Vor Fristablauf bleibt die beanspruchte Pflicht unberührt.
    const nachher = new PaarpflichtService({ repo: ablage, jetzt: zeit.jetzt, fristMs: 60_000 });
    const ohneFrist = await nachher.abarbeiten("lauf-1", fn);
    expect(ohneFrist.geurteilt).toBe(6);
    expect(ohneFrist.bilanz).toMatchObject({ geurteilt: 9, inArbeit: 1, rest: 1 });

    zeit.weiter(60_001);
    const nachFrist = await nachher.abarbeiten("lauf-1", fn);
    expect(nachFrist.geurteilt).toBe(1);
    expect(nachFrist.bilanz).toMatchObject({ gesamt: 10, geurteilt: 10, rest: 0 });
    expect(nachFrist.bilanz.abgeschlossen).toBe(true);

    // Elf Modellaufrufe: der abgestürzte wird wiederholt, alle anderen genau einmal.
    expect(gefragtePaare(fn)).toHaveLength(11);
    expect(new Set(gefragtePaare(fn)).size).toBe(10);
    expect((await nachher.liste("lauf-1")).filter((p) => p.urteil)).toHaveLength(10);
  });

  it("ein verspäteter Abschluss mit altem Token schreibt kein zweites Urteil", async () => {
    const zeit = uhr();
    const ablage = new InMemoryPaarpflichtRepo();
    const service = new PaarpflichtService({ repo: ablage, jetzt: zeit.jetzt, fristMs: 1_000 });
    await service.planen("lauf-1", FUENF.slice(0, 2), KONTEXT);

    const alt = await ablage.beanspruchen("lauf-1", {
      token: "alt",
      jetzt: ZEIT,
      bis: new Date(Date.parse(ZEIT) + 1_000).toISOString(),
      maxFehlversuche: 3,
      ausser: [],
    });
    expect(alt?.zustand).toBe("in_arbeit");
    zeit.weiter(1_001);
    expect((await service.abarbeiten("lauf-1", pruefer())).geurteilt).toBe(1);

    const spaet = await ablage.abschliessen(alt?.id ?? "", "alt", {
      ...(alt as Paarpflicht),
      zustand: "geurteilt",
      urteil: { ergebnis: "widerspruch", modell: "alt", at: ZEIT },
    });
    expect(spaet).toBe(false);
    const [gespeichert] = await service.liste("lauf-1");
    expect(gespeichert?.urteil).toMatchObject({ ergebnis: "kein_konflikt", modell: "lokal:test" });
  });

  it("zwei gleichzeitige Läufe auf derselben Ablage urteilen kein Paar doppelt", async () => {
    const ablage = new InMemoryPaarpflichtRepo();
    const fn = pruefer();
    const a = new PaarpflichtService({ repo: ablage });
    const b = new PaarpflichtService({ repo: ablage });
    await a.planen("lauf-1", FUENF, KONTEXT);
    const [x, y] = await Promise.all([a.abarbeiten("lauf-1", fn), b.abarbeiten("lauf-1", fn)]);
    expect(x.geurteilt + y.geurteilt).toBe(10);
    expect(x.verworfen + y.verworfen).toBe(0);
    expect(fn).toHaveBeenCalledTimes(10);
    expect(new Set(gefragtePaare(fn)).size).toBe(10);
  });
});

describe("K4 · Fehler, unbestimmt und Restmenge getrennt; ohne Modell kein Urteil", () => {
  it("jeder Ausgang landet in seinem eigenen Zustand", async () => {
    const service = new PaarpflichtService({ repo: new InMemoryPaarpflichtRepo() });
    await service.planen("lauf-1", FUENF, KONTEXT);
    const ausgang: Record<string, () => Promise<PaarpflichtErgebnis>> = {
      ab: async () => URTEIL,
      ac: async () => ({ art: "unbestimmt", modell: "lokal:test", sicherheit: 0.4 }),
      ad: async () => ({ art: "fehler", grund: "model-timeout" }),
      ae: async () => {
        throw new Error("Verbindung weg — mit Inhalt, der nicht gespeichert werden darf");
      },
      bc: async () => KEIN_MODELL,
      bd: async () => ({ art: "urteil", ergebnis: "widerspruch", modell: " " }),
    };
    const fn = vi.fn<PaarpflichtPruefer>(async (a, b) => {
      const fall = ausgang[paarVon(a, b)];
      return fall ? fall() : { art: "kein_modell", grund: "confidential" };
    });

    const schritt = await service.abarbeiten("lauf-1", fn);
    expect(fn).toHaveBeenCalledTimes(10);
    expect(schritt).toMatchObject({ geurteilt: 1, unbestimmt: 1, fehler: 3, ohneModell: 5 });
    expect(schritt.bilanz).toEqual({
      gesamt: 10,
      offen: 5,
      inArbeit: 0,
      geurteilt: 1,
      unbestimmt: 1,
      fehler: 3,
      ohneModell: 5,
      rest: 5,
      abgeschlossen: false,
    });

    const nachPaar = new Map((await service.liste("lauf-1")).map((p) => [paarVon(p.a, p.b), p]));
    expect(nachPaar.get("ac")?.urteil).toMatchObject({ ergebnis: "unbestimmt", sicherheit: 0.4 });
    expect(nachPaar.get("ad")?.hinweis).toMatchObject({ art: "fehler", grund: "model-timeout" });
    expect(nachPaar.get("ae")?.hinweis?.grund).toBe("pruefer_ausnahme");
    expect(JSON.stringify(nachPaar.get("ae"))).not.toContain("Verbindung");
    // Ein „Urteil" ohne Modellbeleg ist keins.
    expect(nachPaar.get("bd")?.zustand).toBe("fehler");
    expect(nachPaar.get("bd")?.hinweis?.grund).toBe("urteil_ohne_modell");
    expect(nachPaar.get("bd")?.urteil).toBeUndefined();
    // Ohne Modellaufruf bleibt die Pflicht offen und ohne Urteil.
    expect(nachPaar.get("bc")?.zustand).toBe("offen");
    expect(nachPaar.get("bc")?.hinweis?.art).toBe("kein_modell");
    expect(nachPaar.get("bc")?.urteil).toBeUndefined();
  });

  it("nur „kein Modell“: nichts ist abgeschlossen, alles bleibt Rest, ein Aufruf endet", async () => {
    const service = new PaarpflichtService({ repo: new InMemoryPaarpflichtRepo() });
    await service.planen("lauf-1", FUENF, KONTEXT);
    const fn = pruefer(KEIN_MODELL);
    const schritt = await service.abarbeiten("lauf-1", fn);
    expect(fn).toHaveBeenCalledTimes(10);
    expect(schritt.bilanz).toMatchObject({
      geurteilt: 0,
      unbestimmt: 0,
      ohneModell: 10,
      rest: 10,
    });
    expect(schritt.bilanz.abgeschlossen).toBe(false);

    // Kommt später ein Modell, wird abgearbeitet — der Hinweis weicht dem Urteil.
    const danach = await service.abarbeiten("lauf-1", pruefer());
    expect(danach.bilanz).toMatchObject({ geurteilt: 10, ohneModell: 0, rest: 0 });
    expect(danach.bilanz.abgeschlossen).toBe(true);
    expect((await service.liste("lauf-1")).every((p) => p.hinweis === undefined)).toBe(true);
  });

  it("Fehler werden bis zur Grenze wiederholt und bleiben danach als Fehler stehen", async () => {
    const repo = new InMemoryPaarpflichtRepo();
    const service = new PaarpflichtService({ repo, maxFehlversuche: 2 });
    await service.planen("lauf-1", FUENF.slice(0, 2), KONTEXT);
    const fn = pruefer(MODELLFEHLER);
    await service.abarbeiten("lauf-1", fn);
    const zweiter = await service.abarbeiten("lauf-1", fn);
    expect(zweiter.bilanz).toMatchObject({ fehler: 1, rest: 0, abgeschlossen: false });

    const dritter = await service.abarbeiten("lauf-1", fn);
    expect(fn).toHaveBeenCalledTimes(2);
    expect(dritter.bilanz).toMatchObject({ fehler: 1, rest: 0, geurteilt: 0 });
    expect(dritter.bilanz.abgeschlossen).toBe(false);
    expect((await service.liste("lauf-1"))[0]?.fehlversuche).toBe(2);
  });

  it("Konfliktprüfung → Pflichtergebnis: ohne Modell kein Urteil, unsicher ist unbestimmt", () => {
    const m = "reasoner:konfliktpruefung";
    const ohne = (failure?: string) =>
      ergebnisAusKonfliktUrteil(failure ? { verdict: null, failure } : { verdict: null }, m);
    const mit = (relation: "widerspruch" | "unsicher" | "kein_konflikt", confidence: number) =>
      ergebnisAusKonfliktUrteil({ verdict: { relation, confidence } }, m);

    expect(ohne("no-model")).toEqual({ art: "kein_modell", grund: "no-model" });
    expect(ohne("confidential")).toEqual({ art: "kein_modell", grund: "confidential" });
    expect(ohne("model-timeout")).toEqual({ art: "fehler", grund: "model-timeout" });
    expect(ohne()).toEqual({ art: "fehler", grund: "model-error" });
    expect(mit("unsicher", 0.9)).toMatchObject({ art: "unbestimmt", modell: m });
    expect(mit("widerspruch", 0.5)).toMatchObject({ art: "unbestimmt", modell: m });
    expect(mit("widerspruch", 0.9)).toEqual({
      art: "urteil",
      ergebnis: "widerspruch",
      modell: m,
      sicherheit: 0.9,
    });
    expect(mit("kein_konflikt", 0.3)).toMatchObject({ art: "urteil", ergebnis: "kein_konflikt" });
  });
});
