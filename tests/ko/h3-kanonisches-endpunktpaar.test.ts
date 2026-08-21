// ================================================================================================
// JOB 1495 · D3 · H3 — „A ERGÄNZT B" UND „B ERGÄNZT A" SIND EINE BEZIEHUNG, NICHT ZWEI.
// ================================================================================================
//
// Die Zusage steht seit dem ersten Entwurf im Produkt (`kanten-service.ts:57-60`): das Endpunktpaar
// einer richtungslosen Kante „wird von der Persistenzscheibe kanonisch abgelegt". Die
// Persistenzscheibe (JOB 1139) ist verloren — bis sie neu entsteht, hat die Zusage keinen Träger.
// Diese Datei gibt ihr einen und nagelt beide Hälften fest:
//
//   · richtungslos (`ungerichtet`, `symmetrisch`) → eine feste Form, egal wie eingegeben,
//   · `gerichtet`                                 → unangetastet, denn dort IST die Reihenfolge
//                                                   die Aussage.
//
// WAS OHNE SIE PASSIERT. Zwei Einträge für dieselbe fachliche Beziehung: im Wissensnetz doppelt
// sichtbar, in jedem Zähler zweimal, und wer eine Seite widerruft, lässt die andere stehen.
import { describe, expect, it } from "vitest";
import {
  beziehungsSchluessel,
  kanonischesPaar,
  traegtRichtungsaussage,
} from "../../services/knowledge-object/src/kanten-paar";
import {
  InMemoryKantenRepo,
  type KuratierteKante,
} from "../../services/knowledge-object/src/kanten-service";

function kante(
  p: Partial<KuratierteKante> & { quelleId: string; zielId: string },
): KuratierteKante {
  return {
    id: `k-${p.quelleId}-${p.zielId}`,
    art: "ergaenzt",
    richtung: "ungerichtet",
    urheber: "u-mensch",
    gesetztAm: "2026-08-21T04:00:00.000Z",
    geaendertAm: "2026-08-21T04:00:00.000Z",
    status: "aktiv",
    version: 1,
    ...p,
  };
}

describe("H3 · kanonisches Endpunktpaar — richtungslos heißt: eine Form", () => {
  it("ungerichtet: die kleinere Kennung steht vorn, egal wie eingegeben", async () => {
    const vorwaerts = kanonischesPaar(kante({ quelleId: "ko-a", zielId: "ko-b" }));
    const rueckwaerts = kanonischesPaar(kante({ quelleId: "ko-b", zielId: "ko-a" }));

    expect([vorwaerts.quelleId, vorwaerts.zielId]).toEqual(["ko-a", "ko-b"]);
    expect([rueckwaerts.quelleId, rueckwaerts.zielId]).toEqual(["ko-a", "ko-b"]);
  });

  it("symmetrisch verhält sich wie ungerichtet — beide tragen keine Richtungsaussage", async () => {
    const k = kanonischesPaar(kante({ quelleId: "ko-z", zielId: "ko-a", richtung: "symmetrisch" }));

    expect([k.quelleId, k.zielId]).toEqual(["ko-a", "ko-z"]);
    expect(traegtRichtungsaussage("symmetrisch")).toBe(false);
  });

  it("KALIBRIERUNG: gerichtet bleibt unangetastet — dort IST die Reihenfolge die Aussage", async () => {
    // Ohne diesen Gegenfall wäre die Kanonisierung auch mit einer Funktion grün, die stur sortiert
    // — und „A ersetzt B" würde stillschweigend zu „B ersetzt A".
    const k = kanonischesPaar(kante({ quelleId: "ko-z", zielId: "ko-a", richtung: "gerichtet" }));

    expect([k.quelleId, k.zielId]).toEqual(["ko-z", "ko-a"]);
    expect(traegtRichtungsaussage("gerichtet")).toBe(true);
  });

  it("die Identität der Kante bleibt unberührt — sie ist nicht aus den Endpunkten abgeleitet", async () => {
    const roh = kante({ quelleId: "ko-z", zielId: "ko-a" });

    const k = kanonischesPaar(roh);

    expect(k.id).toBe(roh.id);
    expect(k.urheber).toBe(roh.urheber);
    expect(k.gesetztAm).toBe(roh.gesetztAm);
    expect(k.status).toBe(roh.status);
  });

  it("die Funktion ist idempotent: zweimal angewandt ändert nichts mehr", async () => {
    const einmal = kanonischesPaar(kante({ quelleId: "ko-z", zielId: "ko-a" }));
    const zweimal = kanonischesPaar(einmal);

    expect(zweimal).toEqual(einmal);
  });
});

describe("H3 · Beziehungsschlüssel — wann beschreiben zwei Kanten dasselbe", () => {
  it("dieselbe richtungslose Beziehung, andersherum eingegeben: gleicher Schlüssel", async () => {
    const a = beziehungsSchluessel(kante({ quelleId: "ko-a", zielId: "ko-b" }));
    const b = beziehungsSchluessel(kante({ quelleId: "ko-b", zielId: "ko-a" }));

    expect(a).toBe(b);
  });

  it("andere Art heißt andere Aussage — verschiedener Schlüssel", async () => {
    const ergaenzt = beziehungsSchluessel(kante({ quelleId: "ko-a", zielId: "ko-b" }));
    const widerspricht = beziehungsSchluessel(
      kante({ quelleId: "ko-a", zielId: "ko-b", art: "widerspricht" }),
    );

    expect(ergaenzt).not.toBe(widerspricht);
  });

  it("gerichtet und richtungslos sind nie derselbe Schlüssel", async () => {
    const richtungslos = beziehungsSchluessel(kante({ quelleId: "ko-a", zielId: "ko-b" }));
    const gerichtet = beziehungsSchluessel(
      kante({ quelleId: "ko-a", zielId: "ko-b", richtung: "gerichtet" }),
    );

    expect(richtungslos).not.toBe(gerichtet);
  });

  it("der Schlüssel ignoriert Status, Urheber und Zeit — dieselbe Beziehung bleibt dieselbe", async () => {
    const frisch = beziehungsSchluessel(kante({ quelleId: "ko-a", zielId: "ko-b" }));
    const widerrufen = beziehungsSchluessel(
      kante({
        quelleId: "ko-a",
        zielId: "ko-b",
        status: "widerrufen",
        urheber: "jemand-anderes",
        gesetztAm: "2020-01-01T00:00:00.000Z",
      }),
    );

    expect(frisch).toBe(widerrufen);
  });
});

describe("H3 · der Bestand legt kanonisch ab", () => {
  it("umgekehrt eingegebene richtungslose Kante liegt kanonisch im Repo", async () => {
    const repo = new InMemoryKantenRepo();
    await repo.setze(kante({ quelleId: "ko-b", zielId: "ko-a" }));

    const abgelegt = (await repo.fuerKo("ko-a"))[0];

    expect(abgelegt?.quelleId).toBe("ko-a");
    expect(abgelegt?.zielId).toBe("ko-b");
  });

  it("beide Endpunkte finden die Kante — die Kanonisierung verliert keine Seite", async () => {
    // Der Gegenfall zum vorigen: Kanonisieren darf die Auffindbarkeit nicht verschieben.
    const repo = new InMemoryKantenRepo();
    await repo.setze(kante({ quelleId: "ko-b", zielId: "ko-a" }));

    expect(await repo.fuerKo("ko-a")).toHaveLength(1);
    expect(await repo.fuerKo("ko-b")).toHaveLength(1);
  });

  it("gerichtete Kanten liegen unverändert — auch im Bestand", async () => {
    const repo = new InMemoryKantenRepo();
    await repo.setze(kante({ quelleId: "ko-z", zielId: "ko-a", richtung: "gerichtet" }));

    const abgelegt = (await repo.fuerKo("ko-z"))[0];

    expect(abgelegt?.quelleId).toBe("ko-z");
    expect(abgelegt?.zielId).toBe("ko-a");
  });
});
