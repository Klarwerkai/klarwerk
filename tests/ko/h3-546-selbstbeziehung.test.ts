// ================================================================================================
// JOB 1543 · D1 · H3 / SCRUM-546 — EINE BEZIEHUNG BRAUCHT ZWEI ENDEN.
// ================================================================================================
//
// DER BEFUND, DER DIESE DATEI AUSGELÖST HAT. Gemessen im Clone, vor jeder Änderung:
//
//   grep -rn "selbst|quelleId === kante.zielId" tests/ko/*.test.ts   → kein Treffer zu Kanten
//
// Keine der drei H3-Vertragsdateien prüft den Fall `quelleId === zielId`. Und nichts im Modul
// verhindert ihn: `kanonischesPaar` lässt ihn durch (`A <= A` ist wahr), `beziehungsSchluessel`
// bildet einen gültigen Schlüssel, und `alsAnsicht` leitet das Gegenstück über
// `quelleId === koId ? zielId : quelleId` ab — bei gleichen Enden ist das Ergebnis das
// ANGEFRAGTE OBJEKT SELBST. Die Detailseite zeigt dann eine Beziehung „Wartungsplan ergänzt
// Wartungsplan", und `total` zählt sie mit.
//
// Genau davor warnt der Kommentar des D5-Vertrags bereits — dort aber nur für den Fall, dass die
// KANONISIERUNG ein Paar dreht („sonst zeigt die Detailseite auf sich selbst",
// `h3-bestand-und-lesedienst.test.ts:19`). Der Selbstbezug am Eingang ist die ungedeckte Hälfte
// desselben Fehlerbildes.
//
// WARUM DAS EINE LÜCKE IST UND KEIN GESCHMACK: Eine kuratierte Kante ist die Aussage „ein Mensch
// hat entschieden, dass DIESE BEIDEN fachlich zusammengehören" (`kanten-service.ts:8-9`). Über ein
// Objekt und sich selbst gibt es diese Aussage nicht — sie hat kein Gegenüber, das sie tragen
// könnte. Sie ist keine strengere oder schwächere Beziehung, sondern keine.
//
// ZWEI SCHRANKEN, WEIL ES ZWEI WEGE HINEIN GIBT:
//   · AM EINGANG wird sie abgewiesen — damit sie gar nicht erst im Bestand liegt.
//   · BEIM LESEN wird sie zurückgehalten — für Bestände, die vor dieser Regel gefüllt wurden
//     (die Persistenzscheibe JOB 1139 ist noch nicht gebaut; ihre Altdaten kennt heute niemand).
//     Diese Schranke ist fail-closed und ununterscheidbar von den drei Gründen, die
//     `alsAnsicht` bereits kennt.
//
// KEINE ZUSICHERUNG WIRD WEGGENOMMEN: echte Beziehungen zwischen zwei verschiedenen Objekten
// verhalten sich Feld für Feld wie vorher. Die Gegenproben unten halten das fest.
import { describe, expect, it } from "vitest";
import { sichtbarkeitsfilterFuer } from "../../services/app/src/sichtbarkeit";
import { InMemoryKoRepo, KoService } from "../../services/knowledge-object";
import { DeduplizierenderKantenBestand } from "../../services/knowledge-object/src/kanten-repo";
import {
  KantenLeseService,
  type KantenRepo,
} from "../../services/knowledge-object/src/kanten-service";
import type { KuratierteKante } from "../../services/knowledge-object/src/kanten-types";

const CONTROLLERIN = sichtbarkeitsfilterFuer({ id: "controllerin-1", role: "controller" });

async function bestand(): Promise<{
  ko: KoService;
  repo: DeduplizierenderKantenBestand;
  kanten: KantenLeseService;
  neuesKo: (title: string) => Promise<string>;
}> {
  const ko = new KoService({ repo: new InMemoryKoRepo() });
  const repo = new DeduplizierenderKantenBestand();
  const kanten = new KantenLeseService({ repo, kos: ko });
  const neuesKo = async (title: string) =>
    (
      await ko.create({
        title,
        statement: `Aussage zu ${title}`,
        type: "best_practice",
        category: "Betrieb",
        author: "u1",
        tags: [],
        confidentiality: "intern",
      })
    ).id;
  return { ko, repo, kanten, neuesKo };
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

describe("H3/546 · eine Beziehung braucht zwei Enden — der Selbstbezug entsteht nicht", () => {
  it("DER BEFUND: der Bestand nimmt eine Kante auf sich selbst nicht an", async () => {
    const { repo, neuesKo } = await bestand();
    const eines = await neuesKo("Wartungsplan Halle 2");

    await expect(repo.setze(kante({ quelleId: eines, zielId: eines }))).rejects.toThrow(
      /sich selbst/i,
    );
    // Und der Bestand bleibt wirklich leer — nicht nur der Wurf zählt, sondern die Wirkung.
    expect(await repo.anzahl()).toBe(0);
  });

  it("DER BEFUND, zweite Schranke: ein Altbestand mit Selbstbezug wird beim Lesen zurückgehalten", async () => {
    const ko = new KoService({ repo: new InMemoryKoRepo() });
    const eines = (
      await ko.create({
        title: "Filterwechsel dokumentiert",
        statement: "Aussage",
        type: "best_practice",
        category: "Betrieb",
        author: "u1",
        tags: [],
        confidentiality: "intern",
      })
    ).id;
    // Ein Bestand, der am Eingang vorbei gefüllt wurde — genau das, was Altdaten sind. Bewusst als
    // schmaler Doppelgänger des Ports statt über eine neue Schreibmethode: der Lesedienst muss auch
    // gegen Bestände halten, die diese Regel nie gesehen haben.
    const altbestand: KantenRepo = {
      fuerKo: async () => [kante({ quelleId: eines, zielId: eines })],
    };
    const kanten = new KantenLeseService({ repo: altbestand, kos: ko });

    const sicht = await kanten.kantenFuer(eines, { sichtbar: CONTROLLERIN });

    expect(sicht.kanten).toEqual([]);
    // `total` zählt NACH dem Trimm (1140-Vertrag) — der Selbstbezug darf ihn nicht aufblähen.
    expect(sicht.total).toBe(0);
  });

  it("GERICHTET macht keinen Unterschied — auch A-ersetzt-A ist keine Aussage", async () => {
    const { repo, neuesKo } = await bestand();
    const eines = await neuesKo("Prüfanweisung 4711");

    await expect(
      repo.setze(kante({ quelleId: eines, zielId: eines, art: "ersetzt", richtung: "gerichtet" })),
    ).rejects.toThrow(/sich selbst/i);
  });

  it("GEGENPROBE: die echte Beziehung zwischen ZWEI Objekten bleibt unberührt", async () => {
    const { repo, kanten, neuesKo } = await bestand();
    const erstes = await neuesKo("Wartungsplan Halle 2");
    const zweites = await neuesKo("Filterwechsel dokumentiert");

    await repo.setze(kante({ quelleId: erstes, zielId: zweites }));

    const vonErstem = await kanten.kantenFuer(erstes, { sichtbar: CONTROLLERIN });
    const vonZweitem = await kanten.kantenFuer(zweites, { sichtbar: CONTROLLERIN });

    expect(vonErstem.kanten.map((k) => k.gegenstueck.id)).toEqual([zweites]);
    expect(vonZweitem.kanten.map((k) => k.gegenstueck.id)).toEqual([erstes]);
    expect(vonErstem.total).toBe(1);
    expect(await repo.anzahl()).toBe(1);
  });

  it("GEGENPROBE: ein abgewiesener Selbstbezug beschädigt den vorhandenen Bestand nicht", async () => {
    const { repo, kanten, neuesKo } = await bestand();
    const erstes = await neuesKo("Wartungsplan Halle 2");
    const zweites = await neuesKo("Filterwechsel dokumentiert");
    await repo.setze(kante({ quelleId: erstes, zielId: zweites }));

    await expect(repo.setze(kante({ quelleId: erstes, zielId: erstes }))).rejects.toThrow();

    const vonErstem = await kanten.kantenFuer(erstes, { sichtbar: CONTROLLERIN });
    expect(vonErstem.kanten.map((k) => k.gegenstueck.id)).toEqual([zweites]);
    expect(await repo.anzahl()).toBe(1);
  });
});
