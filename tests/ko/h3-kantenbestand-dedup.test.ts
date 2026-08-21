// ================================================================================================
// JOB 1495 · D4 · H3 — DIE DREI ZUSAGEN, DIE MIT JOB 1139 VERLOREN GINGEN.
// ================================================================================================
//
// D3 hat das Endpunktpaar kanonisiert: „A ergänzt B" und „B ergänzt A" haben dieselbe Form. Damit
// ist die Doppelung auf Feldebene beseitigt — auf BESTANDSEBENE nicht: zwei Aufrufe mit derselben
// fachlichen Beziehung, aber verschiedenen Kennungen, ergeben im Prüfstand weiterhin zwei Einträge.
//
// Diese Datei nagelt fest, was ein Bestand können muss, aus dem das Wissensnetz gespeist wird:
//
//   1. DEDUPLIZIERUNG    — eine Beziehung, ein Eintrag, egal wie oft und herum gesetzt.
//   2. ÄLTESTE HERKUNFT  — wer sie zuerst setzte und wann, bleibt stehen.
//   3. EIGENE IDENTITÄT  — die Kennung der ersten Setzung wandert nicht.
//
// Es sind dieselben drei, die das BEN-Urteil zu JOB 1139 D1 als belegt bezeichnete und deren Stand
// verloren ist (D2-Rückgabe §5). Hier sind sie wieder ausführbar — diesmal an einer Stelle, die im
// Produkt liegt und nicht in einem Clone unter `/private/tmp`.
import { describe, expect, it } from "vitest";
import { DeduplizierenderKantenBestand } from "../../services/knowledge-object/src/kanten-repo";
import type { KuratierteKante } from "../../services/knowledge-object/src/kanten-types";

function kante(
  p: Partial<KuratierteKante> & { quelleId: string; zielId: string },
): KuratierteKante {
  return {
    id: `k-${p.quelleId}-${p.zielId}`,
    art: "ergaenzt",
    richtung: "ungerichtet",
    urheber: "u-erste",
    gesetztAm: "2026-08-21T05:00:00.000Z",
    geaendertAm: "2026-08-21T05:00:00.000Z",
    status: "aktiv",
    version: 1,
    ...p,
  };
}

describe("H3 · Bestand — eine Beziehung, ein Eintrag", () => {
  it("dieselbe Beziehung andersherum gesetzt bleibt EIN Eintrag", async () => {
    const bestand = new DeduplizierenderKantenBestand();
    await bestand.setze(kante({ quelleId: "ko-a", zielId: "ko-b", id: "k-1" }));
    await bestand.setze(kante({ quelleId: "ko-b", zielId: "ko-a", id: "k-2" }));

    expect(await bestand.anzahl()).toBe(1);
    expect(await bestand.fuerKo("ko-a")).toHaveLength(1);
  });

  it("KALIBRIERUNG: eine ANDERE Art ist eine andere Beziehung — zwei Eintraege", async () => {
    // Ohne diesen Gegenfall waere die Deduplizierung auch mit einem Bestand gruen, der schlicht
    // alles zusammenwirft.
    const bestand = new DeduplizierenderKantenBestand();
    await bestand.setze(kante({ quelleId: "ko-a", zielId: "ko-b", art: "ergaenzt" }));
    await bestand.setze(kante({ quelleId: "ko-a", zielId: "ko-b", art: "widerspricht" }));

    expect(await bestand.anzahl()).toBe(2);
  });

  it("gerichtet und richtungslos bleiben getrennt", async () => {
    const bestand = new DeduplizierenderKantenBestand();
    await bestand.setze(kante({ quelleId: "ko-a", zielId: "ko-b", richtung: "ungerichtet" }));
    await bestand.setze(kante({ quelleId: "ko-a", zielId: "ko-b", richtung: "gerichtet" }));

    expect(await bestand.anzahl()).toBe(2);
  });

  it("beide Endpunkte finden die Beziehung", async () => {
    const bestand = new DeduplizierenderKantenBestand();
    await bestand.setze(kante({ quelleId: "ko-b", zielId: "ko-a" }));

    expect(await bestand.fuerKo("ko-a")).toHaveLength(1);
    expect(await bestand.fuerKo("ko-b")).toHaveLength(1);
  });
});

describe("H3 · Bestand — die aelteste Herkunft bleibt stehen", () => {
  it("DER KERNFALL: ein zweiter Mensch uebernimmt nicht die Urheberschaft des ersten", async () => {
    const bestand = new DeduplizierenderKantenBestand();
    await bestand.setze(
      kante({
        quelleId: "ko-a",
        zielId: "ko-b",
        urheber: "u-erste",
        gesetztAm: "2026-01-01T00:00:00.000Z",
      }),
    );

    await bestand.setze(
      kante({
        quelleId: "ko-b",
        zielId: "ko-a",
        urheber: "u-zweite",
        gesetztAm: "2026-08-21T05:00:00.000Z",
      }),
    );

    const [k] = await bestand.fuerKo("ko-a");
    // Wer sie erfunden hat, ist eine Tatsache ueber die Vergangenheit — sie aendert sich nicht,
    // weil jemand dasselbe noch einmal sagt.
    expect(k?.urheber).toBe("u-erste");
    expect(k?.gesetztAm).toBe("2026-01-01T00:00:00.000Z");
  });

  it("die Kennung der ersten Setzung wandert nicht", async () => {
    const bestand = new DeduplizierenderKantenBestand();
    await bestand.setze(kante({ quelleId: "ko-a", zielId: "ko-b", id: "k-zuerst" }));
    await bestand.setze(kante({ quelleId: "ko-b", zielId: "ko-a", id: "k-spaeter" }));

    const [k] = await bestand.fuerKo("ko-a");
    expect(k?.id).toBe("k-zuerst");
  });

  it("`geaendertAm` folgt dagegen der NEUEN Setzung", async () => {
    // Der Gegenfall zum Herkunftserhalt: nicht alles bleibt stehen. Was sich wirklich geaendert
    // hat, muss sichtbar werden — sonst waere die Fortschreibung unsichtbar.
    const bestand = new DeduplizierenderKantenBestand();
    await bestand.setze(
      kante({ quelleId: "ko-a", zielId: "ko-b", geaendertAm: "2026-01-01T00:00:00.000Z" }),
    );
    await bestand.setze(
      kante({ quelleId: "ko-b", zielId: "ko-a", geaendertAm: "2026-08-21T05:00:00.000Z" }),
    );

    const [k] = await bestand.fuerKo("ko-a");
    expect(k?.geaendertAm).toBe("2026-08-21T05:00:00.000Z");
  });

  it("die Version zaehlt hoch, statt zurueckgesetzt zu werden", async () => {
    const bestand = new DeduplizierenderKantenBestand();
    await bestand.setze(kante({ quelleId: "ko-a", zielId: "ko-b", version: 1 }));
    await bestand.setze(kante({ quelleId: "ko-b", zielId: "ko-a", version: 1 }));
    await bestand.setze(kante({ quelleId: "ko-a", zielId: "ko-b", version: 1 }));

    const [k] = await bestand.fuerKo("ko-a");
    // Dreimal gesetzt: die mitgelieferte `1` gewinnt nicht, der Bestand zaehlt selbst.
    expect(k?.version).toBe(3);
  });
});

describe("H3 · Bestand — Widerruf ist ein Zustand, keine Loeschung", () => {
  it("eine widerrufene Beziehung bleibt im Bestand auffindbar", async () => {
    const bestand = new DeduplizierenderKantenBestand();
    await bestand.setze(kante({ quelleId: "ko-a", zielId: "ko-b" }));

    await bestand.setze(kante({ quelleId: "ko-a", zielId: "ko-b", status: "widerrufen" }));

    const [k] = await bestand.fuerKo("ko-a");
    expect(k?.status).toBe("widerrufen");
    // Sie bleibt EIN Eintrag — der Widerruf legt keine zweite Beziehung an.
    expect(await bestand.anzahl()).toBe(1);
  });

  it("und sie kann wieder aktiviert werden, ohne die Herkunft zu verlieren", async () => {
    const bestand = new DeduplizierenderKantenBestand();
    await bestand.setze(kante({ quelleId: "ko-a", zielId: "ko-b", urheber: "u-erste" }));
    await bestand.setze(kante({ quelleId: "ko-a", zielId: "ko-b", status: "widerrufen" }));

    await bestand.setze(kante({ quelleId: "ko-a", zielId: "ko-b", status: "aktiv" }));

    const [k] = await bestand.fuerKo("ko-a");
    expect(k?.status).toBe("aktiv");
    expect(k?.urheber).toBe("u-erste");
    expect(k?.version).toBe(3);
  });

  it("der Bestand faellt kein Sichtbarkeitsurteil — das bleibt beim Lesedienst", async () => {
    // Ein Bestand, der selbst filtert, waere die zweite Rechteauslegung. `fuerKo` gibt ungetrimmt
    // heraus; das Trimmen macht `KantenLeseService` an genau einer Stelle.
    const bestand = new DeduplizierenderKantenBestand();
    await bestand.setze(kante({ quelleId: "ko-a", zielId: "ko-b", status: "widerrufen" }));

    expect(await bestand.fuerKo("ko-a")).toHaveLength(1);
  });
});
