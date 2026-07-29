// ================================================================================================
// AUFTRAG-mega45 BLOCK C — DER RECHTE-WAECHTER DER HERKUNFTSKETTE, ALS SAMMLER.
// ================================================================================================
//
// DIE GEFAHR (A3). Ein Anwender sieht die Kette eines Objekts, das er ohnehin sehen darf. Die Kette
// kann aber zu einem Objekt fuehren, das er NICHT sehen darf — der haeufigste Fall ist ein Konflikt
// mit einem vertraulicheren Wissensobjekt. Dann gilt: DER KNOTEN FEHLT VOLLSTAENDIG. Nicht als
// „1 weiterer", nicht als Schattenkante, nicht als Zahl, nicht als Cluster, nicht als Tooltip.
//
// DER HINTERHALT, den dieser Test aufdeckt: es genuegt NICHT, den Titel der Gegenseite wegzulassen.
// Ein Konflikt-Datensatz traegt seine `description` und — bei automatischer Erkennung — WOERTLICHE
// BELEGZITATE BEIDER SEITEN (`detector.quotes`). Wer nur die Gegenseite anonymisiert und den
// Konfliktknoten stehen laesst, veroeffentlicht den Inhalt des vertraulichen Objekts im Klartext.
// Genau das weist die Rot-Sonde unten nach.
//
// DIE ZWEITE REGEL (A3, zweiter Teil): zwei Arten von Kuerzung, streng getrennt.
//   · UMFANG   — wird AUSGEWIESEN. Eine abgeschnittene Darstellung, die vollstaendig aussieht, ist
//                schlimmer als keine.
//   · RECHTE   — wird NICHT ausgewiesen. Eine Anzeige, die ihre eigene Zensur beziffert, verraet
//                genau das, was sie schuetzen soll.
//
// SAMMLER, NICHT FALLLISTE: die Invariante wird ueber das KREUZPRODUKT der Konflikt-Bauformen
// gefahren (Herkunft × Erkenner × Status × Sichtbarkeit), und geprueft wird gegen ein GEHEIMNIS-
// WORTSCHATZ auf dem serialisierten Graphen — nicht gegen einzelne Felder. Ein kuenftiges Feld, das
// das Geheimnis durchreicht, faellt damit auf, ohne dass dieser Test es kennen muss.
import { describe, expect, it } from "vitest";
import { MAX_PROVENANCE_NODES, projectProvenance } from "../../services/provenance/src/project";
import type {
  ProvenanceGegenseite,
  ProvenanceInput,
  ProvenanceKonfliktIn,
} from "../../services/provenance/src/types";

// ------------------------------------------------------------------------------------------------
// Der Geheimnis-Wortschatz: alles, was NIE im Graphen auftauchen darf, wenn die Gegenseite
// unsichtbar ist. Die Zeichenketten sind bewusst unverwechselbar.
// ------------------------------------------------------------------------------------------------
const GEHEIM = {
  koId: "ko-streng-vertraulich-4711",
  titel: "Uebernahmeangebot Nordwerk AG",
  zitatA: "Der Kaufpreis liegt bei 240 Millionen Euro.",
  zitatB: "Die Zusage des Vorstands liegt seit Montag vor.",
} as const;

const GEHEIME_WORTE: readonly string[] = [
  GEHEIM.koId,
  GEHEIM.titel,
  GEHEIM.zitatA,
  GEHEIM.zitatB,
  "Nordwerk",
  "240 Millionen",
];

function basisEingabe(konflikte: readonly ProvenanceKonfliktIn[]): ProvenanceInput {
  return {
    ko: {
      id: "ko-sichtbar-1",
      titel: "Lieferzeiten Standardteile",
      status: "validiert",
      version: 2,
      maschinellGeprueft: true,
    },
    quellen: [
      {
        id: "q1",
        bezeichnung: "Handbuch Logistik",
        urheber: "u-anna",
        zeitpunkt: "2026-07-01T10:00:00.000Z",
      },
    ],
    originale: [],
    belege: [
      {
        id: "ev1",
        art: "source",
        quelleId: "q1",
        bezeichnung: "Handbuch Logistik",
        grund: "Abschnitt 4.2 nennt die Regellieferzeit.",
        urheber: "u-anna",
        zeitpunkt: "2026-07-01T10:00:00.000Z",
      },
    ],
    versionen: [
      { version: 1, urheber: "u-anna", zeitpunkt: "2026-06-01T09:00:00.000Z", vermerk: "Anlage" },
      {
        version: 2,
        urheber: "u-bernd",
        zeitpunkt: "2026-07-01T09:00:00.000Z",
        vermerk: "Lieferzeit korrigiert",
      },
    ],
    konflikte: [...konflikte],
    laeufe: [],
  };
}

/**
 * Ein Konflikt gegen das GEHEIME Objekt. Die Beschreibung und die Erkennungs-Zitate tragen den
 * Inhalt der Gegenseite woertlich — genau so, wie ein echter automatisch erkannter Befund es tut.
 */
function geheimerKonflikt(
  gegenseite: ProvenanceGegenseite,
  form: { herkunft?: "manual" | "auto"; mitErkenner: boolean; status: string },
): ProvenanceKonfliktIn {
  return {
    id: "c-geheim",
    art: "truth",
    beschreibung: `Widerspruch zu „${GEHEIM.titel}": ${GEHEIM.zitatA}`,
    status: form.status,
    gegenseite,
    ...(form.herkunft ? { herkunft: form.herkunft } : {}),
    ...(form.mitErkenner
      ? {
          erkenner: {
            bezeichnung: "konflikt-erkennung",
            begruendung: `Die Aussagen kollidieren: ${GEHEIM.zitatB}`,
            zitat: GEHEIM.zitatA,
          },
        }
      : {}),
    urheber: "u-carla",
    zeitpunkt: "2026-07-20T08:00:00.000Z",
  };
}

/** Das Kreuzprodukt der Bauformen, ueber die die Invariante gefahren wird. */
const BAUFORMEN: {
  name: string;
  herkunft?: "manual" | "auto";
  mitErkenner: boolean;
  status: string;
}[] = [];
for (const herkunft of [undefined, "manual", "auto"] as const) {
  for (const mitErkenner of [false, true]) {
    for (const status of ["offen", "eskaliert", "zweitmeinung", "geloest"]) {
      BAUFORMEN.push({
        name: `herkunft=${herkunft ?? "(fehlt)"} erkenner=${mitErkenner} status=${status}`,
        ...(herkunft ? { herkunft } : {}),
        mitErkenner,
        status,
      });
    }
  }
}

function verraeterischeWorte(graph: unknown): string[] {
  const text = JSON.stringify(graph);
  return GEHEIME_WORTE.filter((w) => text.includes(w));
}

describe("mega45 C · die Herkunftskette verraet nie ein unsichtbares Objekt", () => {
  it("die Sonden greifen: bei SICHTBARER Gegenseite steht das Geheimnis wirklich im Graphen", () => {
    // KALIBRIERUNG. Ohne sie koennte die Regel unten gruen sein, weil die Sonde gar kein Geheimnis
    // in die Projektion traegt — ein Waechter, der nichts zu bewachen hat, meldet immer Erfolg.
    const sichtbar = projectProvenance(
      basisEingabe([
        geheimerKonflikt(
          { sichtbar: true, id: GEHEIM.koId, titel: GEHEIM.titel },
          { herkunft: "auto", mitErkenner: true, status: "offen" },
        ),
      ]),
    );
    expect(verraeterischeWorte(sichtbar.graph).length).toBeGreaterThan(0);
    expect(sichtbar.graph.nodes.some((n) => n.label.includes(GEHEIM.titel))).toBe(true);
  });

  it("ROT-ZUERST: bei UNSICHTBARER Gegenseite bleibt kein Wort des Geheimnisses stehen", () => {
    const projektion = projectProvenance(
      basisEingabe([
        geheimerKonflikt(
          { sichtbar: false },
          { herkunft: "auto", mitErkenner: true, status: "offen" },
        ),
      ]),
    );
    expect(
      verraeterischeWorte(projektion.graph),
      "Der Graph traegt Inhalt des unsichtbaren Objekts — die Rechtepruefung fehlt oder greift zu kurz.",
    ).toEqual([]);
  });

  it("SAMMLER: ueber ALLE Konflikt-Bauformen bleibt das unsichtbare Objekt unsichtbar", () => {
    const befunde: string[] = [];
    for (const form of BAUFORMEN) {
      const projektion = projectProvenance(
        basisEingabe([geheimerKonflikt({ sichtbar: false }, form)]),
      );
      const verraten = verraeterischeWorte(projektion.graph);
      if (verraten.length > 0) {
        befunde.push(`${form.name}: verraet ${verraten.join(" | ")}`);
      }
      // Auch die BLOSSE EXISTENZ darf nicht ableitbar sein: kein Konfliktknoten, keine Kante.
      if (projektion.graph.nodes.some((n) => n.kind === "konflikt")) {
        befunde.push(`${form.name}: Konfliktknoten steht noch im Graphen`);
      }
      if (projektion.graph.edges.some((e) => e.kind === "widerspricht")) {
        befunde.push(`${form.name}: widerspricht-Kante steht noch im Graphen`);
      }
    }
    expect(befunde, `\n${befunde.join("\n")}\n`).toEqual([]);
  });

  it("SAMMLER: die Rechte-Kuerzung wird NICHT beziffert, die Umfangs-Kuerzung schon", () => {
    // (a) Rechte-Kuerzung — der Graph schweigt. Die Zahl lebt ausschliesslich im Pruefprotokoll,
    //     das den Server nicht verlaesst.
    const rechte = projectProvenance(
      basisEingabe([
        geheimerKonflikt(
          { sichtbar: false },
          { herkunft: "auto", mitErkenner: true, status: "offen" },
        ),
      ]),
    );
    expect(rechte.graph.truncated.byScope).toBe(false);
    expect(rechte.graph.truncated.omittedNodes).toBe(0);
    // Das Protokoll HAT gezaehlt — sonst waere „nicht ausgewiesen" bloss „nicht bemerkt".
    expect(rechte.audit.redactedByRights).toBeGreaterThan(0);
    // Und keine Zahl der Zensur ist aus dem Graphen ableitbar.
    expect(JSON.stringify(rechte.graph)).not.toContain("redacted");

    // (b) Umfangs-Kuerzung — sie wird AUSGEWIESEN.
    const viele = basisEingabe([]);
    const gross: ProvenanceInput = {
      ...viele,
      quellen: Array.from({ length: MAX_PROVENANCE_NODES + 10 }, (_, i) => ({
        id: `q${i}`,
        bezeichnung: `Quelle ${i}`,
        urheber: "u-anna",
        zeitpunkt: "2026-07-01T10:00:00.000Z",
      })),
    };
    const umfang = projectProvenance(gross);
    expect(umfang.graph.truncated.byScope).toBe(true);
    expect(umfang.graph.truncated.omittedNodes).toBeGreaterThan(0);
    expect(umfang.graph.nodes.length).toBe(MAX_PROVENANCE_NODES);
  });

  it("die Rechte-Kuerzung geschieht VOR der Umfangs-Kuerzung", () => {
    // Sonst waere die Zensur aus der ausgewiesenen Umfangszahl rueckrechenbar: ein unsichtbarer
    // Knoten, der einen Umfangsplatz belegt, veraendert `omittedNodes` — und damit verriete
    // ausgerechnet die EHRLICHE Zahl die UNEHRLICHE.
    const ohneGeheim = projectProvenance(basisEingabe([]));
    const mitGeheim = projectProvenance(
      basisEingabe([
        geheimerKonflikt(
          { sichtbar: false },
          { herkunft: "auto", mitErkenner: true, status: "offen" },
        ),
      ]),
    );
    expect(mitGeheim.graph.nodes.length).toBe(ohneGeheim.graph.nodes.length);
    expect(mitGeheim.graph.truncated).toEqual(ohneGeheim.graph.truncated);
  });
});
