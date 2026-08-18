// ================================================================================================
// JOB 1140 · D1 — DIE KURATIERTE KANTE IST NUR SICHTBAR, WENN BEIDE ENDPUNKTE ES SIND.
// ================================================================================================
//
// Die Regel stammt nicht aus diesem Auftrag, sondern aus dem geschlossenen Vertrag der Kette
// JOB 1045 (D2 §2.3, wörtlich): „Eine kuratierte Kante darf NICHT eigenständig sichtbar sein.
// Sonst entsteht genau das Existenzsignal, das der abgeleitete Graph heute strukturell vermeidet —
// die Kante würde den unsichtbaren Gegenknoten verraten."
//
// Diese Datei nagelt genau das am echten Produktpfad fest, und zwar in beide Richtungen:
//
//  1. TRIMM VOR AUSGABE. Ein unsichtbarer oder unauflösbarer Gegenendpunkt erzeugt WEDER Kante
//     NOCH Kennung, Titel, Zähler oder unterscheidbaren Fehler. Geprüft wird an der
//     SERIALISIERTEN Antwort (`JSON.stringify`), nicht an der Absicht — dasselbe Vorgehen, mit dem
//     mega68 seine Nachbarschaft absichert (tests/app/mega68-nachbarschaft-route.test.ts:207).
//  2. KALIBRIERUNG. Für die Rolle MIT erweiterter Sichtbarkeit ist dieselbe Kante da. Ohne diesen
//     Gegenfall wäre jeder Negativtest auch mit einem Dienst grün, der schlicht nie etwas liefert.
//
// `total` zählt NACH dem Trimm. Es gibt bewusst KEINEN Schnittzähler ausgefilterter Kanten: das
// wäre selbst die Existenzauskunft, die der Vertrag verbietet (JOB 1045 D3 §4.3 Nr. 3, O-3).
import { describe, expect, it } from "vitest";
import { sichtbarkeitsfilterFuer } from "../../services/app/src/sichtbarkeit";
import { InMemoryKoRepo, KoService } from "../../services/knowledge-object";
import type { Confidentiality } from "../../services/knowledge-object";
import {
  InMemoryKantenRepo,
  KantenLeseService,
  type KuratierteKante,
} from "../../services/knowledge-object/src/kanten-service";

// ================================================================================================
// DIE ROLLEN SIND ECHT — NICHT NACHGEBAUT.
// ================================================================================================
//
// `sichtbarkeitsfilterFuer` ist die EINE Stelle, an der im Produkt „darf dieser Mensch dieses
// Objekt sehen" entschieden wird (services/app/src/sichtbarkeit.ts:108). Der Test nimmt genau sie
// und nicht eine nachgebaute Kopie: ein eigenes Prädikat hier wäre die zweite Auslegung, gegen die
// jene Datei ausdrücklich gebaut ist — und der Test wäre dann gegen seine eigene Erfindung grün.
//
// `experte` trägt kein `ko.validate` und sieht Vertrauliches nur als eigener Autor;
// `controller` trägt es und sieht alles. Das ist die Trennlinie aus der Rechtematrix
// (services/rbac/src/policy.ts:16), nicht aus diesem Test.
const EXPERTIN = sichtbarkeitsfilterFuer({ id: "expertin-1", role: "experte" });
const CONTROLLERIN = sichtbarkeitsfilterFuer({ id: "controllerin-1", role: "controller" });

async function bestand(): Promise<{
  ko: KoService;
  kanten: KantenLeseService;
  repo: InMemoryKantenRepo;
  neuesKo: (title: string, confidentiality?: Confidentiality) => Promise<string>;
}> {
  const ko = new KoService({ repo: new InMemoryKoRepo() });
  const repo = new InMemoryKantenRepo();
  const kanten = new KantenLeseService({ repo, kos: ko });
  const neuesKo = async (title: string, confidentiality: Confidentiality = "intern") =>
    (
      await ko.create({
        title,
        statement: `Aussage zu ${title}`,
        type: "best_practice",
        category: "Betrieb",
        author: "u1",
        tags: [],
        confidentiality,
      })
    ).id;
  return { ko, kanten, repo, neuesKo };
}

function kante(
  p: Partial<KuratierteKante> & { quelleId: string; zielId: string },
): KuratierteKante {
  return {
    id: `k-${p.quelleId}-${p.zielId}`,
    art: "ergaenzt",
    richtung: "ungerichtet",
    urheber: "u-mensch",
    gesetztAm: "2026-08-18T08:00:00.000Z",
    geaendertAm: "2026-08-18T08:00:00.000Z",
    status: "aktiv",
    version: 1,
    ...p,
  };
}

describe("JOB 1140 · Sichtbarkeit — beide Endpunkte, oder gar nichts", () => {
  it("unsichtbarer Gegenendpunkt: keine Kante, kein Titel, keine Kennung, kein Zähler", async () => {
    const { kanten, repo, neuesKo } = await bestand();
    const mitte = await neuesKo("Wartungsplan Halle 2");
    const offen = await neuesKo("Filterwechsel dokumentiert");
    const geheim = await neuesKo("Lieferantenpreis Ventile", "vertraulich");
    await repo.setze(kante({ quelleId: mitte, zielId: offen }));
    await repo.setze(kante({ quelleId: mitte, zielId: geheim }));

    const antwort = await kanten.kantenFuer(mitte, { sichtbar: EXPERTIN });

    expect(antwort.kanten.map((k) => k.gegenstueck.id)).toEqual([offen]);
    expect(antwort.total).toBe(1);
    // An der serialisierten Antwort: nichts vom verborgenen Objekt reist mit.
    const roh = JSON.stringify(antwort);
    expect(roh).not.toContain(geheim);
    expect(roh).not.toContain("Lieferantenpreis");
  });

  it("KALIBRIERUNG: dieselbe Kante ist für die erweiterte Sichtbarkeit da", async () => {
    const { kanten, repo, neuesKo } = await bestand();
    const mitte = await neuesKo("Wartungsplan Halle 2");
    const geheim = await neuesKo("Lieferantenpreis Ventile", "vertraulich");
    await repo.setze(kante({ quelleId: mitte, zielId: geheim }));

    const antwort = await kanten.kantenFuer(mitte, { sichtbar: CONTROLLERIN });

    expect(antwort.kanten.map((k) => k.gegenstueck.id)).toEqual([geheim]);
    expect(antwort.total).toBe(1);
  });

  it("unauflösbarer Gegenendpunkt (endgültig gelöscht) verhält sich wie unsichtbar", async () => {
    const { kanten, repo, neuesKo } = await bestand();
    const mitte = await neuesKo("Wartungsplan Halle 2");
    await repo.setze(kante({ quelleId: mitte, zielId: "gibt-es-nicht" }));

    const antwort = await kanten.kantenFuer(mitte, { sichtbar: CONTROLLERIN });

    expect(antwort.kanten).toEqual([]);
    expect(antwort.total).toBe(0);
    expect(JSON.stringify(antwort)).not.toContain("gibt-es-nicht");
  });

  it("widerrufene Kante erscheint nicht — auch nicht als Platzhalter", async () => {
    const { kanten, repo, neuesKo } = await bestand();
    const mitte = await neuesKo("Wartungsplan Halle 2");
    const anderes = await neuesKo("Filterwechsel dokumentiert");
    await repo.setze(kante({ quelleId: mitte, zielId: anderes, status: "widerrufen" }));

    const antwort = await kanten.kantenFuer(mitte, { sichtbar: CONTROLLERIN });

    expect(antwort.kanten).toEqual([]);
    expect(antwort.total).toBe(0);
    expect(JSON.stringify(antwort)).not.toContain("widerrufen");
  });

  it("FAIL-CLOSED: ohne übergebene Entscheidung ist nichts sichtbar — nicht alles", async () => {
    const { kanten, repo, neuesKo } = await bestand();
    const mitte = await neuesKo("Wartungsplan Halle 2");
    const anderes = await neuesKo("Filterwechsel dokumentiert");
    await repo.setze(kante({ quelleId: mitte, zielId: anderes }));

    const antwort = await kanten.kantenFuer(mitte, {});

    expect(antwort.kanten).toEqual([]);
    expect(antwort.total).toBe(0);
  });
});

describe("JOB 1140 · Lebenszyklus — der Papierkorb sagt nichts über die Beziehung", () => {
  // Der Vertrag aus D3 §3.2/§3.3, ausführbar: Papierkorb macht die Kante UNSICHTBAR, verändert aber
  // ihren `status` nicht. Würde er ihn auf „widerrufen" setzen, wäre nach der Wiederherstellung
  // nicht mehr unterscheidbar, ob ein Mensch die Beziehung zurückgenommen hat oder ob sie nur ein
  // Papierkorbereignis überlebt hat. Es gibt deshalb KEINEN zweiten Zustand für dieselbe Tatsache —
  // und im Dienst auch keinen zweiten Papierkorbtest: `KoService.get` liefert für getrashte Objekte
  // bereits `undefined` (service.ts:2639), die Kante fällt über denselben Weg wie ein gelöschter
  // Endpunkt.
  it("Endpunkt in den Papierkorb: Kante unsichtbar, Status unberührt — Wiederherstellung bringt sie zurück", async () => {
    const { ko, kanten, repo, neuesKo } = await bestand();
    const mitte = await neuesKo("Wartungsplan Halle 2");
    const anderes = await neuesKo("Filterwechsel dokumentiert");
    await repo.setze(kante({ quelleId: mitte, zielId: anderes }));

    const vorher = await kanten.kantenFuer(mitte, { sichtbar: CONTROLLERIN });
    expect(vorher.total).toBe(1);

    await ko.delete(anderes, "controllerin-1");
    const getrasht = await kanten.kantenFuer(mitte, { sichtbar: CONTROLLERIN });
    expect(getrasht.kanten).toEqual([]);
    expect(getrasht.total).toBe(0);
    expect(JSON.stringify(getrasht)).not.toContain("Filterwechsel");
    // Der Papierkorb hat die Kante NICHT angefasst — sie liegt unverändert im Bestand.
    expect((await repo.fuerKo(mitte))[0]?.status).toBe("aktiv");

    await ko.restore(anderes, "controllerin-1");
    const wiederhergestellt = await kanten.kantenFuer(mitte, { sichtbar: CONTROLLERIN });
    expect(wiederhergestellt.kanten.map((k) => k.gegenstueck.id)).toEqual([anderes]);
  });

  it("widerrufen überlebt Papierkorb und Wiederherstellung — es ist eine Urheberaussage", async () => {
    const { ko, kanten, repo, neuesKo } = await bestand();
    const mitte = await neuesKo("Wartungsplan Halle 2");
    const anderes = await neuesKo("Filterwechsel dokumentiert");
    await repo.setze(kante({ quelleId: mitte, zielId: anderes, status: "widerrufen" }));

    await ko.delete(anderes, "controllerin-1");
    await ko.restore(anderes, "controllerin-1");

    // Der Endpunkt ist wieder da, die Beziehung bleibt zurückgenommen.
    expect((await repo.fuerKo(mitte))[0]?.status).toBe("widerrufen");
    expect((await kanten.kantenFuer(mitte, { sichtbar: CONTROLLERIN })).kanten).toEqual([]);
  });
});

describe("JOB 1140 · Richtung — was die Detailseite anzeigen können muss", () => {
  it("gerichtete Kante: das angefragte Objekt kennt seine Rolle in beide Leserichtungen", async () => {
    const { kanten, repo, neuesKo } = await bestand();
    const ursache = await neuesKo("Dichtung spröde");
    const folge = await neuesKo("Leckage an Pumpe P2");
    await repo.setze(
      kante({ quelleId: ursache, zielId: folge, art: "ersetzt", richtung: "gerichtet" }),
    );

    const vonQuelle = await kanten.kantenFuer(ursache, { sichtbar: CONTROLLERIN });
    const vonZiel = await kanten.kantenFuer(folge, { sichtbar: CONTROLLERIN });

    expect(vonQuelle.kanten[0]?.rolle).toBe("quelle");
    expect(vonQuelle.kanten[0]?.gegenstueck.id).toBe(folge);
    expect(vonQuelle.kanten[0]?.richtung).toBe("gerichtet");
    // Dieselbe Kante, von der anderen Seite gelesen: gespiegelte Rolle, gespiegeltes Gegenstück.
    expect(vonZiel.kanten[0]?.rolle).toBe("ziel");
    expect(vonZiel.kanten[0]?.gegenstueck.id).toBe(ursache);
  });

  it("ungerichtete Kante trägt keine Rollenaussage", async () => {
    const { kanten, repo, neuesKo } = await bestand();
    const a = await neuesKo("Kaltstart mit Vorwärmung");
    const b = await neuesKo("Kaltstart ohne Vorwärmung");
    await repo.setze(kante({ quelleId: a, zielId: b, richtung: "ungerichtet" }));

    const antwort = await kanten.kantenFuer(a, { sichtbar: CONTROLLERIN });

    expect(antwort.kanten[0]?.richtung).toBe("ungerichtet");
    expect(antwort.kanten[0]?.rolle).toBeUndefined();
    expect(antwort.kanten[0]?.gegenstueck.id).toBe(b);
  });

  it("die Auskunft trägt Art und menschlichen Urheber — sonst ist sie nicht kuratiert lesbar", async () => {
    const { kanten, repo, neuesKo } = await bestand();
    const a = await neuesKo("Kaltstart mit Vorwärmung");
    const b = await neuesKo("Kaltstart ohne Vorwärmung");
    await repo.setze(
      kante({ quelleId: a, zielId: b, art: "widerspricht", urheber: "controllerin-1" }),
    );

    const k = (await kanten.kantenFuer(a, { sichtbar: CONTROLLERIN })).kanten[0];

    expect(k?.art).toBe("widerspricht");
    expect(k?.urheber).toBe("controllerin-1");
    expect(k?.gesetztAm).toBe("2026-08-18T08:00:00.000Z");
    expect(k?.gegenstueck.title).toBe("Kaltstart ohne Vorwärmung");
  });
});

describe("JOB 1140 · S1 ist ein Leseweg — mehr nicht", () => {
  it("der Lesedienst bietet keine öffentliche Mutation an", () => {
    const flaeche = Object.getOwnPropertyNames(KantenLeseService.prototype).filter(
      (n) => n !== "constructor",
    );
    expect(flaeche).toEqual(["kantenFuer"]);
  });
});
