// KO18/M13: echte AuthApp-/KO-Fassungs-/GA-Wege; Speicherablagen, kein PG-/Neustartnachweis.
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import type { KnowledgeObject } from "../../services/knowledge-object";
import type {
  Anweisung,
  AnweisungVergleich,
} from "../../services/knowledge-object/src/gesamtanweisung-types";
import { Sitzung, type Strecke, ersteinrichtung, mussGelingen } from "../gast-nutzerweg/strecke";

vi.mock("testcontainers", () => {
  throw new Error("NOPULL_INIT1STOP");
});
vi.mock("dockerode", () => {
  throw new Error("NOPULL_INIT1STOP");
});

let app: ReturnType<typeof buildApp> | undefined;
afterEach(async () => {
  await app?.close();
  app = undefined;
});

async function welt() {
  const services = buildServices();
  app = buildApp(services);
  const instanz = app;
  const basis = await instanz.listen({ host: "127.0.0.1", port: 0 });
  const strecke: Strecke = {
    app: instanz,
    basis,
    profil: (name, sprache) => new Sitzung(basis, name, sprache),
    schliessen: () => instanz.close(),
  };
  const { sitzung } = await ersteinrichtung(strecke, "admin@ko18.test");
  expect(sitzung.hatSitzungskeks()).toBe(true);
  async function ruf<T>(methode: string, url: string, payload?: unknown, status = 200): Promise<T> {
    return mussGelingen(url, await sitzung.sende(methode, url, payload), status).json as T;
  }
  async function koAnlegen(bodyHtml?: string) {
    return ruf<KnowledgeObject>(
      "POST",
      "/api/kos",
      {
        title: "KO18 Quelle",
        statement: "Fassung eins",
        type: "best_practice",
        category: "Werk 1",
        confidentiality: "intern",
        ...(bodyHtml === undefined ? {} : { bodyHtml }),
      },
      201,
    );
  }
  async function aufnehmen(ko: KnowledgeObject, nachweisHash: string | null) {
    const a = await ruf<Anweisung>(
      "POST",
      "/api/gesamtanweisungen",
      { titel: "KO18 Anweisung" },
      201,
    );
    const mit = await ruf<Anweisung>("POST", `/api/gesamtanweisungen/${a.id}/bausteine`, {
      version: a.version,
      koId: ko.id,
      koVersion: ko.version,
      nachweisHash,
    });
    const baustein = mit.bausteine[0];
    if (!baustein) throw new Error("Aufgenommener Baustein fehlt");
    return { anweisung: mit, baustein };
  }
  const vergleichen = (id: string, von: number, bis: number) =>
    ruf<AnweisungVergleich>("GET", `/api/gesamtanweisungen/${id}/vergleich?von=${von}&bis=${bis}`);
  return { services, ruf, koAnlegen, aufnehmen, vergleichen };
}

function inhaltsbefunde(vergleich: AnweisungVergleich, bausteinId: string) {
  const befunde = vergleich.befunde.filter(
    (b) =>
      b.bausteinId === bausteinId &&
      ["tabellenueberschriften", "abbildungen", "geltung"].includes(b.feld),
  );
  expect(befunde).toHaveLength(3);
  return Object.fromEntries(befunde.map((b) => [b.feld, b.auswirkung]));
}

const INHALT =
  '<table><tr><th>Druck</th></tr></table><img alt="Schema alt" src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO/a1f8AAAAASUVORK5CYII=">';

describe("KO18/M13 · freie Hashangabe am authentifizierten HTTP-Weg", () => {
  it("gleiche freie Hashes verdecken keine tatsächlichen Inhaltsänderungen", async () => {
    const w = await welt();
    const ko = await w.koAnlegen(INHALT);
    const { anweisung: a, baustein } = await w.aufnehmen(ko, "FREI-ERFUNDEN");
    const vorher = await w.services.anweisungen.standLesen(a.id, a.version);
    expect(vorher?.bausteine[0]?.inhalt).toEqual({
      tabellenUeberschriften: ["Druck"],
      abbildungen: ["Schema alt"],
      geltung: "Werk 1",
    });
    const neu = await w.ruf<KnowledgeObject>("PUT", `/api/kos/${ko.id}`, {
      action: "revise",
      expectedVersion: ko.version,
      changes: {
        category: "Werk 2",
        bodyHtml:
          '<table><tr><th>Dauer</th></tr></table><img alt="Schema neu" src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO/a1f8AAAAASUVORK5CYII=">',
      },
    });
    expect(neu.version).toBeGreaterThan(ko.version);
    const uebernommen = await w.ruf<Anweisung>(
      "POST",
      `/api/gesamtanweisungen/${a.id}/bausteine/${baustein.id}/uebernehmen`,
      {
        version: a.version,
        aufVersion: neu.version,
        nachweisHash: "FREI-ERFUNDEN",
      },
    );
    const vergleich = await w.vergleichen(a.id, a.version, uebernommen.version);
    expect(inhaltsbefunde(vergleich, baustein.id)).toEqual({
      tabellenueberschriften: "geaendert",
      abbildungen: "geaendert",
      geltung: "geaendert",
    });
    expect(vergleich.unbekannte).toBe(0);
    const nachher = await w.services.anweisungen.standLesen(a.id, uebernommen.version);
    expect(nachher?.bausteine[0]?.inhalt).toEqual({
      tabellenUeberschriften: ["Dauer"],
      abbildungen: ["Schema neu"],
      geltung: "Werk 2",
    });
    expect(vorher?.bausteine[0]?.nachweisHash).toBe("FREI-ERFUNDEN");
    expect(nachher?.bausteine[0]?.nachweisHash).toBe("FREI-ERFUNDEN");
    expect(await w.services.anweisungen.standLesen(a.id, a.version)).toEqual(vorher);
  });

  it("gleiche freie Hashes machen unbekannte Rumpffakten nicht zu unverändert", async () => {
    const w = await welt();
    const ko = await w.koAnlegen();
    expect(typeof ko.bodyHtml).not.toBe("string");
    const { anweisung: a, baustein } = await w.aufnehmen(ko, "FREI-UNBEKANNT");
    const vorher = await w.services.anweisungen.standLesen(a.id, a.version);
    expect(vorher?.bausteine[0]?.inhalt).toEqual({
      tabellenUeberschriften: null,
      abbildungen: null,
      geltung: "Werk 1",
    });
    const nochmal = await w.ruf<Anweisung>("PUT", `/api/gesamtanweisungen/${a.id}/reihenfolge`, {
      version: a.version,
      reihenfolge: [baustein.id],
    });
    const vergleich = await w.vergleichen(a.id, a.version, nochmal.version);
    expect(inhaltsbefunde(vergleich, baustein.id)).toEqual({
      tabellenueberschriften: "unbekannt",
      abbildungen: "unbekannt",
      geltung: "unveraendert",
    });
    expect(vergleich.gesamt).toBe("unbekannt");
    expect(vergleich.unbekannte).toBe(2);
    expect(await w.services.anweisungen.standLesen(a.id, a.version)).toEqual(vorher);
  });

  it("bekannte gleiche Fassungsfakten bleiben bei fehlender oder anderer Hashangabe unverändert", async () => {
    const w = await welt();
    const ko = await w.koAnlegen(INHALT);
    const { anweisung: a, baustein } = await w.aufnehmen(ko, null);
    const vorher = await w.services.anweisungen.standLesen(a.id, a.version);
    const neu = await w.ruf<KnowledgeObject>("PUT", `/api/kos/${ko.id}`, {
      action: "revise",
      expectedVersion: ko.version,
      changes: { statement: "Andere Kurzfassung; dieselben Inhaltsfakten" },
    });
    const uebernommen = await w.ruf<Anweisung>(
      "POST",
      `/api/gesamtanweisungen/${a.id}/bausteine/${baustein.id}/uebernehmen`,
      { version: a.version, aufVersion: neu.version, nachweisHash: "ANDERE-FREIE-ANGABE" },
    );
    const vergleich = await w.vergleichen(a.id, a.version, uebernommen.version);
    expect(inhaltsbefunde(vergleich, baustein.id)).toEqual({
      tabellenueberschriften: "unveraendert",
      abbildungen: "unveraendert",
      geltung: "unveraendert",
    });
    expect(vergleich.unbekannte).toBe(0);
    // Die Fassung ist trotzdem geändert; ihr Gesamtwert kann die Inhaltsbefunde nicht ersetzen.
    expect(vergleich.befunde.find((b) => b.feld === "fassung")?.auswirkung).toBe("geaendert");
    expect(vergleich.gesamt).toBe("geaendert");
    expect(vorher?.bausteine[0]?.nachweisHash).toBeNull();
    expect(
      (await w.services.anweisungen.standLesen(a.id, uebernommen.version))?.bausteine[0]
        ?.nachweisHash,
    ).toBe("ANDERE-FREIE-ANGABE");
    expect(await w.services.anweisungen.standLesen(a.id, a.version)).toEqual(vorher);
  });
});
