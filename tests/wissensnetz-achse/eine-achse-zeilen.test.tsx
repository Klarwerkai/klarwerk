// ================================================================================================
// JOB 3073 · V6 · FALL B — JE SCHLAGWORT EINE ZEILE, MIT ZUSTAND UND MIT NACHBARN.
// ================================================================================================
//
// `eine-achse.test.ts` misst, dass die Mengen gleich sind (A1). Das allein wäre die Halbheit, die
// Codex an JOB 3070 D1 beanstandet hat: „Prüfe nicht nur gleiche Themennamen, sondern dieselben
// Objektmengen, Zustände, Nachbarn und Bibliothekstreffer" (`archiv/3070/runde-3/ben.md`).
//
// Hier steht die Zustands- und Nachbarschaftshälfte davon — an genau der Funktion, aus der die
// Oberfläche ihre Zeilen baut (`leseThemen`), gefüttert aus der Antwort, die die Route sendet
// (`sichtmetrik`). Kein Nachbau: dieselbe Kette, nur ohne HTTP.
//
// WARUM `.tsx` UND NICHT `.ts`: `leseThemen` liegt in `apps/web/src/pages/Wissensnetz.tsx`. Der
// Node-reine Typecheck des Baums nimmt kein JSX (`tsconfig.json:26`); die gemounteten und die
// seitennahen Tests laufen über `tsconfig.tests-tsx.json`.
//
//   B1  je Schlagwort eine Zeile MIT Zustand — und keine Zeile für die Kategorie
//   B2  die Nachbarn sind gegenseitig: jedes Schlagwort nennt das andere desselben Objekts
//   B3  GEGENPROBE: ohne Freigabe gibt es keine Kante — dann ist `zusammenMit` leer, nicht falsch
import { describe, expect, it } from "vitest";

import type { Sichtmetrik } from "../../apps/web/src/api/types";
import { leseThemen } from "../../apps/web/src/pages/Wissensnetz";
import { sichtbarkeitsfilterFuer } from "../../services/app/src/sichtbarkeit";
import { LesemodellService } from "../../services/wissensnetz/src/lesemodell";
import type { WissensnetzKoLeser } from "../../services/wissensnetz/src/lesemodell-ports";
import { sichtmetrik } from "../../services/wissensnetz/src/luecken";

interface AchsenKo {
  id: string;
  /** ABSICHTLICH weiter geführt: sie darf auf die Themen keine Wirkung mehr haben. */
  category?: string;
  tags?: readonly string[];
  status?: string;
  sources?: readonly unknown[];
  author?: string | null | undefined;
  confidentiality?: "intern" | "vertraulich";
}

const EXPERTIN = sichtbarkeitsfilterFuer({ id: "expertin-1", role: "experte" });
const KATEGORIE_OHNE_WIRKUNG = "Hygienic Design";

const bestand = (kos: readonly AchsenKo[]): WissensnetzKoLeser<AchsenKo> => ({
  alle: async () => kos,
});

/** Derselbe Streitbestand wie in `eine-achse.test.ts`: Kategorie ≠ jedem Schlagwort. */
const STREIT: readonly AchsenKo[] = [
  {
    id: "s1",
    category: KATEGORIE_OHNE_WIRKUNG,
    tags: ["Dichtungen", "Ventile"],
    status: "validiert",
    sources: [{ art: "beleg" }],
    author: "anna",
    confidentiality: "intern",
  },
  {
    id: "s2",
    category: "Reinigungstechnik",
    tags: ["Reinigung", "Ventile"],
    status: "validiert",
    sources: [{ art: "beleg" }],
    author: "bert",
    confidentiality: "intern",
  },
];

/** Die Kette der Oberfläche, ohne HTTP: Sicht → Sichtmetrik (die Antwort) → Lesezeilen. */
async function zeilenVon(kos: readonly AchsenKo[]) {
  const sicht = await new LesemodellService<AchsenKo>({ kos: bestand(kos) }).sicht({
    sichtbar: EXPERTIN,
    mitThemenkarte: true,
  });
  return leseThemen(sichtmetrik(sicht) as unknown as Sichtmetrik);
}

describe("JOB 3073 · B · die Zeilen der Leseansicht sprechen über die gezeichneten Themen", () => {
  it("B1 · jedes Schlagwort eines Objekts bekommt seine Zeile MIT Zustand — die Kategorie bekommt keine", async () => {
    const zeilen = await zeilenVon(STREIT);

    expect(zeilen.map((z) => z.thema).sort()).toEqual(["Dichtungen", "Reinigung", "Ventile"]);
    expect(zeilen.map((z) => z.thema)).not.toContain(KATEGORIE_OHNE_WIRKUNG);

    // Der Zustand kommt aus dem Kartenknoten. Vor der Zusammenführung hatte KEINE Zeile einen
    // Knoten, also war jeder dieser Werte `null` — das ist die Lücke, die dieser Fall schliesst.
    for (const z of zeilen) {
      expect(z.zustand, `${z.thema}: kein Zustand`).toBe("belegt");
      expect(z.ubiquitaer, `${z.thema}: keine Ubiquitätsaussage`).toBe(false);
    }

    // Die Trägerzahl der Zeile ist die des Knotens — nicht eine zweite Zählung.
    expect(zeilen.find((z) => z.thema === "Ventile")?.objekte).toBe(2);
    expect(zeilen.find((z) => z.thema === "Dichtungen")?.objekte).toBe(1);
  });

  it("B2 · die Nachbarn sind gegenseitig: die zwei Schlagworte EINES Objekts nennen einander", async () => {
    const zeilen = await zeilenVon(STREIT);

    expect(zeilen.find((z) => z.thema === "Dichtungen")?.zusammenMit).toEqual(["Ventile"]);
    expect(zeilen.find((z) => z.thema === "Reinigung")?.zusammenMit).toEqual(["Ventile"]);
    // „Ventile" steht in beiden Objekten — alphabetisch, jeder Nachbar genau einmal.
    expect(zeilen.find((z) => z.thema === "Ventile")?.zusammenMit).toEqual([
      "Dichtungen",
      "Reinigung",
    ]);
  });

  it("B3 · GEGENPROBE: ohne Freigabe entsteht keine Kante — dann steht die leere Liste, keine erfundene Nachbarschaft", async () => {
    // Ohne diesen Fall wäre B2 auch mit einer Nachbarbildung grün, die einfach alles verbindet.
    const zeilen = await zeilenVon(
      STREIT.map((k) => ({ ...k, status: "offen", sources: [] as readonly unknown[] })),
    );

    expect(zeilen.map((z) => z.thema).sort()).toEqual(["Dichtungen", "Reinigung", "Ventile"]);
    for (const z of zeilen) {
      // Der Knoten ist da (also ist nachgesehen worden) — er hat nur keine Kante.
      expect(z.zustand, `${z.thema}`).toBe("offen");
      expect(z.zusammenMit, `${z.thema}: nachgesehen und nichts gefunden`).toEqual([]);
      expect(z.zusammenMit, `${z.thema}: nicht „nichts erhoben"`).not.toBeNull();
    }
  });
});
