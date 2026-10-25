import { describe, expect, it } from "vitest";
import { type DatumsAXKnoten, datumsabschnitte } from "./datumsabschnitte";

type Teil = "tag" | "monat" | "jahr";
const grenzen = { tag: [1, 31], monat: [1, 12], jahr: [1, 275760] };

// Kontrollierte öffentliche AX-Antworten, keine Behauptung einer Browsermessung.
function antwort(folge: readonly Teil[], fokus = 0): DatumsAXKnoten[] {
  const felder = folge.map((art, position): DatumsAXKnoten => {
    const [min, max] = grenzen[art];
    return {
      nodeId: art,
      parentId: "gruppe",
      ignored: false,
      role: { type: "role", value: "spinbutton" },
      properties: [
        { name: "valuemin", value: { type: "number", value: min } },
        { name: "valuemax", value: { type: "number", value: max } },
        { name: "focused", value: { type: "boolean", value: position === fokus } },
      ],
    };
  });
  return [
    ...felder.slice().reverse(),
    {
      nodeId: "fremd",
      ignored: false,
      backendDOMNodeId: 999,
      role: { type: "role", value: "Date" },
    },
    {
      nodeId: "datum",
      ignored: false,
      backendDOMNodeId: 77,
      role: { type: "role", value: "Date" },
      childIds: ["gruppe", "deko"],
    },
    {
      nodeId: "deko",
      parentId: "datum",
      ignored: false,
      role: { type: "role", value: "StaticText" },
    },
    { nodeId: "gruppe", parentId: "datum", ignored: true, childIds: [...folge] },
  ];
}

function knoten(nodes: DatumsAXKnoten[], id: string): DatumsAXKnoten {
  const node = nodes.find((wert) => wert.nodeId === id);
  if (!node) throw new Error(`Fixture-Knoten ${id} fehlt`);
  return node;
}

describe("native Datumsabschnitte: reine Auswertung öffentlicher AX-Antworten", () => {
  it("folgt DDMM, MMDD und YYYYMMDD entlang der childIds statt Antwortliste oder Locale", () => {
    const beispiele: [Teil[], string][] = [
      [["tag", "monat", "jahr"], "14032031"],
      [["monat", "tag", "jahr"], "03142031"],
      [["jahr", "monat", "tag"], "20310314"],
    ];
    for (const [folge, ziffern] of beispiele) {
      const plan = datumsabschnitte(antwort(folge), 77, "2031-03-14");
      expect(plan.abschnitte.map((teil) => teil.art)).toEqual(folge);
      expect(plan.ziffern).toBe(ziffern);
      expect(plan.fokus).toBe(0);
      const weiter = datumsabschnitte(antwort(folge, 1), 77, "2031-03-14", [0, 1]);
      expect(weiter.fokus).toBe(1);
      expect(weiter.ziffern).toBe(ziffern);
    }
  });

  it("akzeptiert weder fremde oder dekorative Ziele noch fehlenden oder falschen Fokus", () => {
    const folge: Teil[] = ["tag", "monat", "jahr"];
    expect(() => datumsabschnitte(antwort(folge), 123, "2031-03-14")).toThrow(/DOM-Ziel/);
    const deko = antwort(folge);
    knoten(deko, "datum").role = { type: "role", value: "generic" };
    expect(() => datumsabschnitte(deko, 77, "2031-03-14")).toThrow(/Date-Teilbaum/);
    const fremdeAbschnitte = antwort(folge);
    knoten(fremdeAbschnitte, "datum").childIds = ["deko"];
    expect(() => datumsabschnitte(fremdeAbschnitte, 77, "2031-03-14")).toThrow(/drei eindeutige/);
    expect(() => datumsabschnitte(antwort(folge, -1), 77, "2031-03-14")).toThrow(/fokussiert/);
    expect(() => datumsabschnitte(antwort(folge, 1), 77, "2031-03-14")).toThrow(/fokussiert/);
    const dekorativerFokus = antwort(folge, -1);
    knoten(dekorativerFokus, "deko").properties = [
      { name: "focused", value: { type: "boolean", value: true } },
    ];
    expect(() => datumsabschnitte(dekorativerFokus, 77, "2031-03-14")).toThrow(/fokussiert/);
  });

  it("weist unvollständige, doppelte und unbekannte Abschnitte vor einer Eingabe ab", () => {
    const folge: Teil[] = ["tag", "monat", "jahr"];
    const fehlend = antwort(folge).filter((node) => node.nodeId !== "tag");
    expect(() => datumsabschnitte(fehlend, 77, "2031-03-14")).toThrow(/unvollständige/);
    const doppelt = antwort(folge);
    knoten(doppelt, "gruppe").childIds = ["tag", "tag", "jahr"];
    expect(() => datumsabschnitte(doppelt, 77, "2031-03-14")).toThrow(/doppelte/);
    const unbekannt = antwort(folge);
    knoten(unbekannt, "jahr").properties = [
      { name: "valuemin", value: { type: "number", value: 0 } },
      { name: "valuemax", value: { type: "number", value: 59 } },
    ];
    expect(() => datumsabschnitte(unbekannt, 77, "2031-03-14")).toThrow(/unbekannte/);
    const fehlendeGrenze = antwort(folge);
    knoten(fehlendeGrenze, "monat").properties = [];
    expect(() => datumsabschnitte(fehlendeGrenze, 77, "2031-03-14")).toThrow(/valuemin/);
  });

  it("weist fehlerhafte Fokuswerte mit Station, Ziel und Knotendiagnose weiterhin ab", () => {
    const faelle = [
      [
        { type: "kontrolliert-falscher-typ", value: true },
        {
          focusedType: "kontrolliert-falscher-typ",
          valueVorhanden: true,
          valueType: "boolean",
          value: true,
        },
      ],
      [
        { type: "boolean" },
        { focusedType: "boolean", valueVorhanden: false, valueType: "undefined" },
      ],
      [
        { type: "boolean", value: "true" },
        { focusedType: "boolean", valueVorhanden: true, valueType: "string", value: "true" },
      ],
      [
        { type: "boolean", value: { privat: "darf nicht in der Diagnose erscheinen" } },
        { focusedType: "boolean", valueVorhanden: true, valueType: "object" },
      ],
    ] as const;
    for (const [focused, diagnose] of faelle) {
      const nodes = antwort(["tag", "monat", "jahr"]);
      const node = knoten(nodes, "tag");
      node.properties = [
        ...(node.properties ?? []).filter((wert) => wert.name !== "focused"),
        { name: "focused", value: focused },
      ];
      expect(() => datumsabschnitte(nodes, 77, "2031-03-14", [0], "vor erster Eingabe")).toThrow(
        new Error(
          `Native Datumsabschnitte unklar: Fokuswert ${JSON.stringify({
            station: "vor erster Eingabe",
            zielBackendId: 77,
            nodeId: "tag",
            role: "spinbutton",
            ignored: false,
            ...diagnose,
          })}`,
        ),
      );
    }
  });
});
