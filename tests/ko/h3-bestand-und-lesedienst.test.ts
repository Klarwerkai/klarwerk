// ================================================================================================
// JOB 1495 · D5 · H3 — DIE BEIDEN HÄLFTEN SIND NIE ZUSAMMEN GELAUFEN.
// ================================================================================================
//
// DER BEFUND, DER DIESE DATEI AUSGELÖST HAT. Gemessen im Clone:
//
//   grep -rln "DeduplizierenderKantenBestand" tests/ services/
//     → services/knowledge-object/src/kanten-repo.ts        (die Klasse selbst)
//     → tests/ko/h3-kantenbestand-dedup.test.ts             (ihr eigener Vertrag)
//
// Der Bestand aus D4 ist **nirgends** mit `KantenLeseService` zusammen ausgeführt worden, und der
// 1140-Vertragstest nutzt den Prüfstand `InMemoryKantenRepo`. Beide Hälften sind für sich belegt —
// ihr Zusammenspiel ist es nicht.
//
// WAS DAZWISCHEN SCHIEFGEHEN KANN, und warum keine der beiden Seiten es allein bemerkt:
//
//   · Der Bestand KANONISIERT das Endpunktpaar (D3). Der Lesedienst leitet das Gegenstück aus
//     `quelleId === koId ? zielId : quelleId` ab. Dreht die Kanonisierung ein Paar, muss die
//     Ableitung für BEIDE Endpunkte weiterhin stimmen — sonst zeigt die Detailseite auf sich selbst.
//   · Der Bestand DEDUPLIZIERT (D4). Der Lesedienst zählt `total` NACH dem Trimm. Eine doppelt
//     gesetzte Beziehung darf weder zweimal erscheinen noch den Zähler verfälschen.
//   · Der Bestand gibt Widerrufenes UNGETRIMMT heraus (bewusst, D4). Der Lesedienst muss es
//     zurückhalten — täte er es nicht, würde D4s Ehrlichkeit zur Lücke.
//
// Die Rollen und der Sichtbarkeitsfilter sind dieselben wie im 1140-Vertrag: `sichtbarkeitsfilterFuer`
// ist die eine Stelle, an der „darf dieser Mensch das sehen" entschieden wird. Ein eigenes Prädikat
// wäre die zweite Auslegung.
import { describe, expect, it } from "vitest";
import { sichtbarkeitsfilterFuer } from "../../services/app/src/sichtbarkeit";
import { InMemoryKoRepo, KoService } from "../../services/knowledge-object";
import type { Confidentiality } from "../../services/knowledge-object";
import { DeduplizierenderKantenBestand } from "../../services/knowledge-object/src/kanten-repo";
import { KantenLeseService } from "../../services/knowledge-object/src/kanten-service";
import type { KuratierteKante } from "../../services/knowledge-object/src/kanten-types";

const EXPERTIN = sichtbarkeitsfilterFuer({ id: "expertin-1", role: "experte" });
const CONTROLLERIN = sichtbarkeitsfilterFuer({ id: "controllerin-1", role: "controller" });

async function bestand(): Promise<{
  ko: KoService;
  kanten: KantenLeseService;
  repo: DeduplizierenderKantenBestand;
  neuesKo: (title: string, confidentiality?: Confidentiality) => Promise<string>;
}> {
  const ko = new KoService({ repo: new InMemoryKoRepo() });
  const repo = new DeduplizierenderKantenBestand();
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
    gesetztAm: "2026-08-21T06:00:00.000Z",
    geaendertAm: "2026-08-21T06:00:00.000Z",
    status: "aktiv",
    version: 1,
    ...p,
  };
}

describe("H3 · Bestand und Lesedienst zusammen — das Gegenstück stimmt in beide Richtungen", () => {
  it("DER KERNFALL: kanonisiertes Paar, von BEIDEN Endpunkten korrekt gelesen", async () => {
    const { kanten, repo, neuesKo } = await bestand();
    const erstes = await neuesKo("Wartungsplan Halle 2");
    const zweites = await neuesKo("Filterwechsel dokumentiert");
    // Bewusst „falsch herum" gesetzt: der Bestand dreht das Paar, der Lesedienst muss trotzdem
    // für jede Seite den jeweils ANDEREN nennen.
    await repo.setze(kante({ quelleId: zweites, zielId: erstes }));

    const vonErstem = await kanten.kantenFuer(erstes, { sichtbar: CONTROLLERIN });
    const vonZweitem = await kanten.kantenFuer(zweites, { sichtbar: CONTROLLERIN });

    expect(vonErstem.kanten.map((k) => k.gegenstueck.id)).toEqual([zweites]);
    expect(vonZweitem.kanten.map((k) => k.gegenstueck.id)).toEqual([erstes]);
    // Kein Objekt zeigt auf sich selbst — der Fehler, den eine gedrehte Ableitung erzeugen würde.
    expect(vonErstem.kanten[0]?.gegenstueck.id).not.toBe(erstes);
  });

  it("doppelt gesetzte Beziehung erscheint EINMAL und zählt EINMAL", async () => {
    const { kanten, repo, neuesKo } = await bestand();
    const mitte = await neuesKo("Wartungsplan Halle 2");
    const anderes = await neuesKo("Filterwechsel dokumentiert");
    await repo.setze(kante({ quelleId: mitte, zielId: anderes, id: "k-1" }));
    await repo.setze(kante({ quelleId: anderes, zielId: mitte, id: "k-2" }));

    const antwort = await kanten.kantenFuer(mitte, { sichtbar: CONTROLLERIN });

    expect(antwort.kanten).toHaveLength(1);
    expect(antwort.total).toBe(1);
  });

  it("KALIBRIERUNG: zwei WIRKLICH verschiedene Beziehungen erscheinen auch als zwei", async () => {
    // Ohne diesen Gegenfall wäre der Test oben auch mit einem Dienst grün, der grundsätzlich nur
    // eine Kante ausgibt.
    const { kanten, repo, neuesKo } = await bestand();
    const mitte = await neuesKo("Wartungsplan Halle 2");
    const anderes = await neuesKo("Filterwechsel dokumentiert");
    await repo.setze(kante({ quelleId: mitte, zielId: anderes, art: "ergaenzt" }));
    await repo.setze(kante({ quelleId: mitte, zielId: anderes, art: "widerspricht" }));

    const antwort = await kanten.kantenFuer(mitte, { sichtbar: CONTROLLERIN });

    expect(antwort.total).toBe(2);
  });
});

describe("H3 · Bestand und Lesedienst zusammen — der Trimm greift über den Bestand hinweg", () => {
  it("der Bestand gibt Widerrufenes heraus, der Lesedienst hält es zurück", async () => {
    // D4 lässt Widerrufenes bewusst im Bestand (es ist eine Urheberaussage, keine Löschung).
    // Genau deshalb MUSS der Lesedienst es trimmen — sonst wäre jene Ehrlichkeit eine Lücke.
    const { kanten, repo, neuesKo } = await bestand();
    const mitte = await neuesKo("Wartungsplan Halle 2");
    const anderes = await neuesKo("Filterwechsel dokumentiert");
    await repo.setze(kante({ quelleId: mitte, zielId: anderes, status: "widerrufen" }));

    // Im Bestand vorhanden …
    expect(await repo.fuerKo(mitte)).toHaveLength(1);
    // … in der Auskunft nicht.
    const antwort = await kanten.kantenFuer(mitte, { sichtbar: CONTROLLERIN });
    expect(antwort.kanten).toEqual([]);
    expect(antwort.total).toBe(0);
    expect(JSON.stringify(antwort)).not.toContain("widerrufen");
  });

  it("unsichtbarer Gegenendpunkt bleibt unsichtbar — auch aus dem deduplizierenden Bestand", async () => {
    const { kanten, repo, neuesKo } = await bestand();
    const mitte = await neuesKo("Wartungsplan Halle 2");
    const offen = await neuesKo("Filterwechsel dokumentiert");
    const geheim = await neuesKo("Lieferantenpreis Ventile", "vertraulich");
    await repo.setze(kante({ quelleId: mitte, zielId: offen }));
    await repo.setze(kante({ quelleId: geheim, zielId: mitte }));

    const antwort = await kanten.kantenFuer(mitte, { sichtbar: EXPERTIN });

    expect(antwort.kanten.map((k) => k.gegenstueck.id)).toEqual([offen]);
    expect(antwort.total).toBe(1);
    const roh = JSON.stringify(antwort);
    expect(roh).not.toContain(geheim);
    expect(roh).not.toContain("Lieferantenpreis");
  });

  it("KALIBRIERUNG: dieselbe Kante ist für die erweiterte Sichtbarkeit da", async () => {
    const { kanten, repo, neuesKo } = await bestand();
    const mitte = await neuesKo("Wartungsplan Halle 2");
    const geheim = await neuesKo("Lieferantenpreis Ventile", "vertraulich");
    await repo.setze(kante({ quelleId: geheim, zielId: mitte }));

    const antwort = await kanten.kantenFuer(mitte, { sichtbar: CONTROLLERIN });

    expect(antwort.kanten.map((k) => k.gegenstueck.id)).toEqual([geheim]);
    expect(antwort.total).toBe(1);
  });

  it("FAIL-CLOSED gilt auch hier: ohne übergebene Entscheidung ist nichts sichtbar", async () => {
    const { kanten, repo, neuesKo } = await bestand();
    const mitte = await neuesKo("Wartungsplan Halle 2");
    const anderes = await neuesKo("Filterwechsel dokumentiert");
    await repo.setze(kante({ quelleId: mitte, zielId: anderes }));

    const antwort = await kanten.kantenFuer(mitte, {});

    expect(antwort.kanten).toEqual([]);
    expect(antwort.total).toBe(0);
  });

  it("Papierkorb: die Beziehung verschwindet aus der Auskunft, bleibt aber im Bestand", async () => {
    const { ko, kanten, repo, neuesKo } = await bestand();
    const mitte = await neuesKo("Wartungsplan Halle 2");
    const anderes = await neuesKo("Filterwechsel dokumentiert");
    await repo.setze(kante({ quelleId: mitte, zielId: anderes }));

    await ko.delete(anderes, "controllerin-1");

    expect((await kanten.kantenFuer(mitte, { sichtbar: CONTROLLERIN })).total).toBe(0);
    // Der Bestand hat die Beziehung NICHT angefasst — ihr Status ist unverändert `aktiv`.
    expect((await repo.fuerKo(mitte))[0]?.status).toBe("aktiv");

    await ko.restore(anderes, "controllerin-1");
    expect((await kanten.kantenFuer(mitte, { sichtbar: CONTROLLERIN })).total).toBe(1);
  });
});

describe("H3 · Bestand und Lesedienst zusammen — die Richtungsaussage überlebt", () => {
  it("gerichtete Kante behält ihre Rolle in beide Leserichtungen", async () => {
    const { kanten, repo, neuesKo } = await bestand();
    const ursache = await neuesKo("Dichtung spröde");
    const folge = await neuesKo("Leckage an Pumpe P2");
    await repo.setze(
      kante({ quelleId: ursache, zielId: folge, art: "ersetzt", richtung: "gerichtet" }),
    );

    const vonQuelle = await kanten.kantenFuer(ursache, { sichtbar: CONTROLLERIN });
    const vonZiel = await kanten.kantenFuer(folge, { sichtbar: CONTROLLERIN });

    // Der Bestand darf gerichtete Paare nicht drehen — sonst wäre hier „ziel" statt „quelle".
    expect(vonQuelle.kanten[0]?.rolle).toBe("quelle");
    expect(vonZiel.kanten[0]?.rolle).toBe("ziel");
  });

  it("ungerichtete Kante trägt keine Rollenaussage — auch nach der Kanonisierung nicht", async () => {
    const { kanten, repo, neuesKo } = await bestand();
    const a = await neuesKo("Kaltstart mit Vorwärmung");
    const b = await neuesKo("Kaltstart ohne Vorwärmung");
    await repo.setze(kante({ quelleId: b, zielId: a, richtung: "ungerichtet" }));

    const antwort = await kanten.kantenFuer(a, { sichtbar: CONTROLLERIN });

    expect(antwort.kanten[0]?.rolle).toBeUndefined();
    expect(antwort.kanten[0]?.gegenstueck.id).toBe(b);
  });
});
