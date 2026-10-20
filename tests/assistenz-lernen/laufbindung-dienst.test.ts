// ================================================================================================
// produkt:20261011:assistenz-lernen-hostfortsetzung · BPA-06 (G12) — LAUFBINDUNG AM P06-DIENST.
// ================================================================================================
//
// `VormachenDienst.einmalJeLauf` direkt, mit der echten In-Memory-Ablage der Routinen:
//   B1  Auch nach mehr als 200 Läufen bleibt jede Laufkennung gebunden — eine alte Kennung legt
//       nichts neu an (Bens Befund zu d51be62b: die gekürzte Liste machte sie wieder „neu“).
//   B2  Wiederaufnahme einer Reservierung: nur dann wird gesucht, und das Gefundene wird gebunden.
//   B3  Widersprüchliche Angaben unter derselben Kennung werden abgewiesen.
import { describe, expect, it } from "vitest";
import {
  InMemoryRoutinenRepo,
  type Routine,
  type RoutinenLauf,
  VormachenDienst,
} from "../../services/app/src/vormachen";

const KONTO = "konto-fiktiv";

function routine(laeufe: RoutinenLauf[] = []): Routine {
  return {
    id: "routine-1",
    kontoId: KONTO,
    titel: "Wochenbericht",
    zweck: "Fiktiven Wochenbericht vorbereiten",
    host: "klarwerk_web",
    modus: "ergebnis_zur_pruefung",
    fassung: 1,
    schritte: [
      {
        id: "s1",
        nr: 1,
        vorgang: "entwurf_anlegen",
        beschreibung: "Entwurf anlegen",
        aussenwirkung: false,
      },
    ],
    herkunft: { sitzungId: "sitzung-1", stand: "stand-1", beobachtet: 1, korrigiert: 0 },
    bestaetigtAm: "2026-10-12T09:00:00.000Z",
    firmenuebergabe: null,
    laeufe,
  };
}

async function dienstMit(r: Routine) {
  const repo = new InMemoryRoutinenRepo();
  await repo.lege(r);
  return { repo, dienst: new VormachenDienst({ routinen: repo }) };
}

const lauf = (kennung: string, abdruck = `abdruck-${kennung}`) => ({
  kennung,
  fassung: 1,
  abdruck,
  gespraech: "gespraech-1",
});

describe("BPA-06 · Laufbindung bleibt dauerhaft", () => {
  it("B1 · nach 205 Läufen liefert die erste Kennung denselben Auftrag, nichts wird neu angelegt", async () => {
    const { dienst, repo } = await dienstMit(routine());
    let angelegt = 0;
    const wege = (id: string) => ({
      finde: async () => null,
      erzeuge: async () => {
        angelegt += 1;
        return id;
      },
    });
    for (let i = 1; i <= 205; i += 1) {
      const neu = wege(`auftrag-${i}`);
      const r = await dienst.einmalJeLauf(KONTO, "routine-1", lauf(`lauf-${i}`), neu);
      expect(r.wiederholt).toBe(false);
    }
    expect(angelegt).toBe(205);
    const zweiterVersuch = wege("auftrag-neu");
    const wieder = await dienst.einmalJeLauf(KONTO, "routine-1", lauf("lauf-1"), zweiterVersuch);
    expect(wieder).toMatchObject({ auftragId: "auftrag-1", wiederholt: true });
    expect(angelegt).toBe(205);
    expect((await repo.routine(KONTO, "routine-1"))?.laeufe).toHaveLength(205);
  });

  it("B2 · eine verwaiste Reservierung wird über die Suche gebunden, ohne neu anzulegen", async () => {
    const reserviert = { ...lauf("lauf-r"), auftragId: null, am: "2026-10-12T09:00:00.000Z" };
    const { dienst } = await dienstMit(routine([reserviert]));
    let gesucht = 0;
    let angelegt = 0;
    const r = await dienst.einmalJeLauf(KONTO, "routine-1", lauf("lauf-r"), {
      finde: async () => {
        gesucht += 1;
        return "auftrag-gefunden";
      },
      erzeuge: async () => {
        angelegt += 1;
        return "auftrag-doppelt";
      },
    });
    expect(r).toMatchObject({ auftragId: "auftrag-gefunden", wiederholt: true });
    expect(gesucht).toBe(1);
    expect(angelegt).toBe(0);
  });

  it("B3 · dieselbe Kennung mit anderem Abdruck wird abgewiesen", async () => {
    const { dienst } = await dienstMit(routine());
    const wege = { finde: async () => null, erzeuge: async () => "auftrag-a" };
    await dienst.einmalJeLauf(KONTO, "routine-1", lauf("lauf-a"), wege);
    await expect(
      dienst.einmalJeLauf(KONTO, "routine-1", lauf("lauf-a", "anderer-abdruck"), wege),
    ).rejects.toMatchObject({ status: 409, grund: "lauf_widerspricht" });
  });
});
