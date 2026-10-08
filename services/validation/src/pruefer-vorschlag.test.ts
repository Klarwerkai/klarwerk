import { describe, expect, it } from "vitest";
import { type CreateKoInput, InMemoryKoRepo, KoService } from "../../knowledge-object";
import {
  DECKEL_JE_SIGNAL,
  SCHNELL_STUFEN,
  VORSCHLAG_GEWICHTE,
  type VorschlagsEingabe,
  prueferVorschlag,
} from "./pruefer-vorschlag";
import { InMemoryAssignmentRepo, InMemoryRatingRepo } from "./repo";
import { ValidationService } from "./service";
import { InMemoryValidationSettingsRepo } from "./settings";

// R-0265: „Das System schlägt vor, wer ein neues Wissensobjekt prüfen sollte — abgeleitet aus
// Autorenschaft, früheren Prüfungen und der Nähe im Wissensnetz."

function eingabe(teil: Partial<VorschlagsEingabe>): VorschlagsEingabe {
  return {
    ziel: { category: "Hydraulik", tags: [] },
    ausgeschlossen: ["autor"],
    kandidaten: ["anna", "bert", "cora", "dirk", "autor"],
    bestand: [],
    bewertungen: [],
    nachbarn: new Set(),
    ...teil,
  };
}

describe("R-0265 · prueferVorschlag (rein, deterministisch)", () => {
  it("V1 · Autorenschaft: wer zur selben Kategorie schreibt, wird vorgeschlagen", () => {
    const v = prueferVorschlag(
      eingabe({
        bestand: [
          { id: "k1", author: "anna", category: "hydraulik " },
          { id: "k2", author: "bert", category: "Elektrik" },
        ],
      }),
    );
    expect(v).toEqual([
      { userId: "anna", punkte: VORSCHLAG_GEWICHTE.autorschaft, gruende: ["autorschaft"] },
    ]);
  });

  it("V2 · Frühere Prüfungen: wer ein Objekt mit gemeinsamem Schlagwort bewertet hat", () => {
    const v = prueferVorschlag(
      eingabe({
        ziel: { category: "", tags: ["Ventil"] },
        bestand: [{ id: "k1", author: "dirk", category: "X", tags: ["ventil", "druck"] }],
        bewertungen: [{ koId: "k1", userId: "bert" }],
      }),
    );
    expect(v.map((s) => [s.userId, s.gruende])).toEqual([
      ["bert", ["pruefungen"]],
      ["dirk", ["autorschaft"]],
    ]);
  });

  it("V3 · Netznähe: Autor und Prüfer eines direkt verbundenen Objekts, auch themenfremd", () => {
    const v = prueferVorschlag(
      eingabe({
        ziel: { id: "ziel", category: "Hydraulik", tags: [] },
        bestand: [
          { id: "ziel", author: "autor", category: "Hydraulik" },
          { id: "nachbar", author: "cora", category: "Elektrik" },
        ],
        bewertungen: [{ koId: "nachbar", userId: "anna" }],
        nachbarn: new Set(["nachbar"]),
      }),
    );
    expect(v).toEqual([
      { userId: "anna", punkte: VORSCHLAG_GEWICHTE.netznaehe, gruende: ["netznaehe"] },
      { userId: "cora", punkte: VORSCHLAG_GEWICHTE.netznaehe, gruende: ["netznaehe"] },
    ]);
  });

  it("V4 · Autor und Fragender werden nie vorgeschlagen; Nicht-Kandidaten auch nicht", () => {
    const v = prueferVorschlag(
      eingabe({
        ausgeschlossen: ["autor", "anna"],
        bestand: [
          { id: "k1", author: "autor", category: "Hydraulik" },
          { id: "k2", author: "anna", category: "Hydraulik" },
          { id: "k3", author: "geloescht", category: "Hydraulik" },
        ],
        bewertungen: [{ koId: "k1", userId: "autor" }],
      }),
    );
    expect(v).toEqual([]);
  });

  it("V5 · je Signal zählen höchstens DECKEL_JE_SIGNAL Objekte; Signale addieren sich", () => {
    const viele = Array.from({ length: 6 }, (_, i) => ({
      id: `a${i}`,
      author: "anna",
      category: "Hydraulik",
    }));
    const v = prueferVorschlag(
      eingabe({
        bestand: [...viele, { id: "b1", author: "bert", category: "Hydraulik" }],
        bewertungen: [{ koId: "b1", userId: "bert" }],
      }),
    );
    expect(v[0]).toEqual({
      userId: "anna",
      punkte: DECKEL_JE_SIGNAL * VORSCHLAG_GEWICHTE.autorschaft,
      gruende: ["autorschaft"],
    });
    expect(v[1]).toEqual({
      userId: "bert",
      punkte: VORSCHLAG_GEWICHTE.autorschaft + VORSCHLAG_GEWICHTE.pruefungen,
      gruende: ["autorschaft", "pruefungen"],
    });
  });

  it("V6 · ohne Thema und ohne Beziehung gibt es keinen Vorschlag", () => {
    const v = prueferVorschlag(
      eingabe({
        ziel: { category: "  ", tags: [] },
        bestand: [{ id: "k1", author: "anna", category: "" }],
      }),
    );
    expect(v).toEqual([]);
  });

  it("V7 · Gleichstand wird nach Kennung geordnet; `anzahl` begrenzt", () => {
    const bestand = ["dirk", "bert", "cora", "anna"].map((author, i) => ({
      id: `k${i}`,
      author,
      category: "Hydraulik",
    }));
    expect(prueferVorschlag(eingabe({ bestand })).map((s) => s.userId)).toEqual([
      "anna",
      "bert",
      "cora",
      "dirk",
    ]);
    expect(prueferVorschlag(eingabe({ bestand, anzahl: 2 })).map((s) => s.userId)).toEqual([
      "anna",
      "bert",
    ]);
  });
});

describe("R-0265 · ValidationService.prueferVorschlagFuer", () => {
  function koInput(overrides: Partial<CreateKoInput>): CreateKoInput {
    return {
      title: "Aussage",
      statement: "Inhalt.",
      type: "best_practice",
      category: "Hydraulik",
      author: "anna",
      neededValidations: 2,
      ...overrides,
    };
  }

  it("S1 · stützt sich nur auf sichtbare Objekte und zählt echte Bewertungen", async () => {
    const koService = new KoService({ repo: new InMemoryKoRepo() });
    const service = new ValidationService({
      koService,
      ratings: new InMemoryRatingRepo(),
      assignments: new InMemoryAssignmentRepo(),
    });
    const offen = await koService.create(koInput({ author: "anna" }));
    const verborgen = await koService.create(koInput({ author: "cora", title: "Verborgen" }));
    await service.rate(offen.id, "bert", "up");
    await service.rate(verborgen.id, "dirk", "up");

    const v = await service.prueferVorschlagFuer({
      ziel: { category: "Hydraulik", tags: [] },
      ausgeschlossen: ["autor"],
      kandidaten: ["anna", "bert", "cora", "dirk"],
      nachbarn: new Set(),
      sichtbar: (ko) => ko.id !== verborgen.id,
    });
    // Bert hat gleich nach der Anlage bewertet: Prüfdauer ~0 h → zusätzlich `schnell`. Dirks
    // Bewertung liegt auf dem verborgenen Objekt und zählt weder als Prüfung noch als Dauer.
    expect(v.map((s) => [s.userId, s.gruende])).toEqual([
      ["bert", ["pruefungen", "schnell"]],
      ["anna", ["autorschaft"]],
    ]);
  });
});

describe("R-1655 · Signal `schnell` aus der Prüfdauer zum Thema", () => {
  it("V8 · Median je Person, gestuft nach SCHNELL_STUFEN; nur Dauern zu Objekten des Themas", () => {
    const v = prueferVorschlag(
      eingabe({
        bestand: [
          { id: "h1", author: "dirk", category: "Hydraulik" },
          { id: "h2", author: "dirk", category: "Hydraulik" },
          { id: "h3", author: "dirk", category: "Hydraulik" },
          { id: "e1", author: "dirk", category: "Elektrik" },
        ],
        latenzen: [
          // Anna: 2 h, 3 h, 200 h → Median 3 h → oberste Stufe.
          { koId: "h1", userId: "anna", stunden: 2 },
          { koId: "h2", userId: "anna", stunden: 3 },
          { koId: "h3", userId: "anna", stunden: 200 },
          // Bert: 50 h zum Thema; seine 1 h zu Elektrik zählt hier nicht.
          { koId: "h1", userId: "bert", stunden: 50 },
          { koId: "e1", userId: "bert", stunden: 1 },
          // Cora: 400 h → keine Stufe, kein Grund.
          { koId: "h2", userId: "cora", stunden: 400 },
          // Nicht-Kandidat zählt nie.
          { koId: "h1", userId: "fremd", stunden: 1 },
        ],
      }),
    );
    const je = new Map(v.map((s) => [s.userId, s]));
    expect(je.get("anna")).toMatchObject({ gruende: ["schnell"], medianStunden: 3 });
    expect(je.get("anna")?.punkte).toBe(SCHNELL_STUFEN[0]?.punkte);
    expect(je.get("bert")).toMatchObject({ gruende: ["schnell"], medianStunden: 50 });
    expect(je.get("bert")?.punkte).toBe(SCHNELL_STUFEN[1]?.punkte);
    expect(je.has("cora")).toBe(false);
    expect(je.has("fremd")).toBe(false);
    // Die schnellste Person steht bei sonst gleicher Lage vorn.
    expect(v.map((s) => s.userId).indexOf("anna")).toBeLessThan(
      v.map((s) => s.userId).indexOf("bert"),
    );
  });
});

describe("R-1655 · ValidationService: Routing, Opt-out, Messgrundlage", () => {
  function aufbau(start = Date.parse("2026-10-01T08:00:00.000Z")) {
    let jetzt = start;
    const koService = new KoService({ repo: new InMemoryKoRepo() });
    const assignments = new InMemoryAssignmentRepo();
    const settings = new InMemoryValidationSettingsRepo();
    const service = new ValidationService({
      koService,
      ratings: new InMemoryRatingRepo(),
      assignments,
      settings,
      now: () => jetzt,
    });
    const spaeter = (stunden: number): void => {
      jetzt += stunden * 3_600_000;
    };
    return { koService, assignments, settings, service, spaeter };
  }

  function koInput(overrides: Partial<CreateKoInput>): CreateKoInput {
    return {
      title: "Aussage",
      statement: "Inhalt.",
      type: "best_practice",
      category: "Hydraulik",
      author: "autor",
      neededValidations: 2,
      ...overrides,
    };
  }

  const alle = () => true;

  /** Ein früheres Themenobjekt, das `wer` nach `stunden` Stunden bewertet hat. */
  async function gelernt(
    a: ReturnType<typeof aufbau>,
    wer: string,
    stunden: number,
  ): Promise<void> {
    const ko = await a.koService.create(koInput({ title: `früher ${wer}` }));
    await a.service.assign(ko.id, [wer], "admin");
    a.spaeter(stunden);
    await a.service.rate(ko.id, wer, "up");
  }

  it("R1 · ein neues Objekt geht an die schnellsten Prüfer des Themas — höchstens so viele wie nötig", async () => {
    const a = aufbau();
    await gelernt(a, "anna", 1);
    await gelernt(a, "bert", 30);
    await gelernt(a, "cora", 100);
    const neu = await a.koService.create(koInput({ title: "neu", neededValidations: 2 }));

    const geroutet = await a.service.automatischZuweisen({
      koId: neu.id,
      actor: "autor",
      kandidaten: ["anna", "bert", "cora", "autor"],
      sichtbar: alle,
    });
    expect(geroutet).toEqual(["anna", "bert"]);
    expect(await a.assignments.find(neu.id, "anna")).toMatchObject({
      status: "open",
      quelle: "automatisch",
    });
    expect(await a.assignments.find(neu.id, "cora")).toBeUndefined();
  });

  it("R2 · Opt-out: wer sich abgemeldet hat, wird nicht geroutet — Wiederanmelden hebt es auf", async () => {
    const a = aufbau();
    await gelernt(a, "anna", 1);
    await gelernt(a, "bert", 2);
    await a.service.setzeRoutingOptOut("anna", true);
    expect(await a.service.routingOptOutVon("anna")).toBe(true);

    const eins = await a.koService.create(koInput({ title: "eins", neededValidations: 1 }));
    expect(
      await a.service.automatischZuweisen({
        koId: eins.id,
        actor: "autor",
        kandidaten: ["anna", "bert"],
        sichtbar: alle,
      }),
    ).toEqual(["bert"]);

    await a.service.setzeRoutingOptOut("anna", false);
    const zwei = await a.koService.create(koInput({ title: "zwei", neededValidations: 1 }));
    expect(
      await a.service.automatischZuweisen({
        koId: zwei.id,
        actor: "autor",
        kandidaten: ["anna", "bert"],
        sichtbar: alle,
      }),
    ).toEqual(["anna"]);
  });

  it("R3 · nicht geroutet wird: ohne gelernte Dauer, bei vorhandener Zuweisung, im Space, an den Autor", async () => {
    const a = aufbau();
    const ohneDaten = await a.koService.create(koInput({ title: "frisch" }));
    expect(
      await a.service.automatischZuweisen({
        koId: ohneDaten.id,
        actor: "autor",
        kandidaten: ["anna"],
        sichtbar: alle,
      }),
    ).toEqual([]);

    await gelernt(a, "anna", 1);
    await gelernt(a, "autor", 1);
    const benannt = await a.koService.create(koInput({ title: "benannt" }));
    await a.service.assign(benannt.id, ["bert"], "autor");
    expect(
      await a.service.automatischZuweisen({
        koId: benannt.id,
        actor: "autor",
        kandidaten: ["anna", "autor"],
        sichtbar: alle,
      }),
    ).toEqual([]);

    const neu = await a.koService.create(koInput({ title: "neu" }));
    expect(
      await a.service.automatischZuweisen({
        koId: neu.id,
        actor: "autor",
        kandidaten: ["anna", "autor"],
        sichtbar: alle,
      }),
    ).toEqual(["anna"]);
  });

  it("M1 · Messgrundlage: Median der Prüfdauer je Weg, offene getrennt, ohne Messung `null`", async () => {
    const a = aufbau();
    await gelernt(a, "anna", 4); // manuell, 4 h
    await gelernt(a, "bert", 10); // manuell, 10 h
    const neu = await a.koService.create(koInput({ title: "neu", neededValidations: 2 }));
    await a.service.automatischZuweisen({
      koId: neu.id,
      actor: "autor",
      kandidaten: ["anna", "bert"],
      sichtbar: alle,
    });
    a.spaeter(2);
    await a.service.rate(neu.id, "anna", "up"); // automatisch, 2 h; bert bleibt offen

    const m = await a.service.pruefdauerAuswertung({ sichtbar: alle });
    expect(m.manuell).toEqual({ erledigt: 2, offen: 0, medianStunden: 7 });
    expect(m.automatisch).toEqual({ erledigt: 1, offen: 1, medianStunden: 2 });
    expect(m.einreichen).toEqual({ erledigt: 0, offen: 0, medianStunden: null });
    expect(await a.assignments.find(neu.id, "anna")).toMatchObject({
      status: "done",
      erledigtAm: "2026-10-01T16:00:00.000Z",
    });
  });
});
