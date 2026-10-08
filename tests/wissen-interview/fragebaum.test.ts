// ================================================================================================
// AUFNAHME 20260922 · WISSEN-INTERVIEW — DER FRAGEBAUM AM REASONER UND AN DER ECHTEN ROUTE.
// ================================================================================================
//
// Geprüft wird, was die Originalpunkte verlangen, Zeile für Zeile:
//   R-0043   eine Frage nach der anderen, Spiegel des Verstandenen, Nachbohren nach Bedingungen,
//            Schwellen und Ausnahmen; der Entwurf besteht nur aus den Antworten.
//   R-0113   Fragebaum, Restlückenwert, KEIN Selbstabschluss (der Mensch bestätigt).
//   FR-CAP-02 Abschluss bei ausreichendem Inhalt — angeboten nach vier Antworten.
//   Argus    Warum, verworfene Alternativen, Geltungsbereich, Risiken, Herkunft getrennt.
//   R-0091   Lücken-Interview: drei Fragen zu einem festen Thema, dann ein Entwurf.
//   R-0088   mit Modell: das Fachthema steht im Prompt, die Frage wird darauf ausgerichtet.
// Und als Gegenprobe: OHNE Fragebaum-Option bleibt das alte Interview Wort für Wort, wie es war.
import { describe, expect, it, vi } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import { Reasoner } from "../../services/reasoner";
import { nenntSchwelle, treeInterview } from "../../services/reasoner/src/interview-tree";
import { INTERVIEW_QUESTIONS, guidedInterview } from "../../services/reasoner/src/provider";
import { type ModelClient, ModelProvider } from "../../services/reasoner/src/provider-model";

const BAUM = { tree: true } as const;

// Antworten OHNE Schwellenwert: ein Grenzwert in der Bedingung schaltet die Schwellenfrage bewusst
// ab (eigener Fall unten) — hier soll der ganze Baum laufen.
const antworten = (n: number): string[] =>
  Array.from({ length: n }, (_, i) => `Antwort ${String.fromCharCode(97 + i)}`);

function aufzeichnenderClient(antwort = "Ab welchem Druck genau schließt du Ventil X?"): {
  client: ModelClient;
  aufrufe: { system: string; user: string }[];
} {
  const aufrufe: { system: string; user: string }[] = [];
  return {
    aufrufe,
    client: {
      name: "aufzeichnend",
      complete: async (system: string, user: string) => {
        aufrufe.push({ system, user });
        return antwort;
      },
    },
  };
}

describe("Gegenprobe: ohne Fragebaum bleibt das bisherige Interview unverändert", () => {
  it("feste Fragenfolge, Selbstabschluss nach Kernaussage + Bedingung + Maßnahme, keine neuen Felder", () => {
    const t0 = guidedInterview([], true, "de");
    expect(t0.question).toBe(INTERVIEW_QUESTIONS.de[0]);
    expect(t0).not.toHaveProperty("gaps");
    const fertig = guidedInterview(["Aussage", "Bedingung", "Maßnahme"], true, "de");
    expect(fertig.done).toBe(true);
    expect(fertig.question).toBeNull();
    expect(fertig).not.toHaveProperty("sufficient");
  });
});

describe("R-0043 / R-0113 / Argus: der Fragebaum", () => {
  it("fragt eine Frage nach der anderen und bohrt nach Schwelle, Ausnahmen, Warum, Alternativen, Geltung, Risiko, Herkunft", () => {
    const knoten: (string | null | undefined)[] = [];
    for (let n = 0; n < 20; n++) {
      const turn = treeInterview(antworten(n), true, "de", BAUM);
      knoten.push(turn.node);
      if (turn.done) {
        break;
      }
      // Genau EINE Frage je Turn.
      expect(typeof turn.question).toBe("string");
    }
    expect(knoten).toEqual([
      "kern",
      "bedingung",
      "massnahme",
      "schwelle",
      "ausnahme",
      "warum",
      "alternativen",
      "geltung",
      "risiko",
      "herkunft",
      "stichworte",
      null,
    ]);
  });

  it("die Fragen nennen, wonach sie bohren (Wortlaut der Knoten)", () => {
    const frage = (n: number): string =>
      treeInterview(antworten(n), true, "de", BAUM).question ?? "";
    expect(frage(3)).toContain("Schwellenwert");
    expect(frage(4)).toContain("Ausnahmen");
    expect(frage(5)).toContain("Warum");
    expect(frage(6)).toContain("verworfen");
    expect(frage(7)).toContain("Wofür gilt das");
    expect(frage(8)).toContain("Risiko");
    expect(frage(9)).toContain("eigene Erfahrung, seit wann, in welcher Rolle");
  });

  // Bens Befund nacharbeit-4: jede Ziffer zählte als Schwelle. „Anlage 2" ist eine Kennung, kein
  // Grenzwert — dann wird weiter nachgebohrt, und die Schwelle bleibt eine Lücke.
  it.each(["Bei Anlage 2 im Handbetrieb", "Bei Anlage 2A im Handbetrieb"])(
    "Kennungen mit Ziffer sind keine Schwelle: „%s“ → Schwellenfrage folgt, Lücke bleibt offen",
    (bedingung) => {
      const res = treeInterview(
        ["Ventil X schließen", bedingung, "Handventil zu"],
        true,
        "de",
        BAUM,
      );
      expect(res.node).toBe("schwelle");
      expect(res.question).toContain("Schwellenwert");
      expect(res.gaps?.open).toContain("schwelle");
    },
  );

  it.each([
    ["ab 6 bar", true],
    ["über 80 °C", true],
    ["wenn der Druck > 5 steigt", true],
    ["nach 30 min Stillstand", true],
    ["mindestens 3 Zyklen", true],
    ["above 10 percent", true],
    ["Bei Anlage 2 im Handbetrieb", false],
    ["an Linie 4 morgens", false],
    ["bei Pumpe P-12", false],
    ["im Werk 3 Schicht 2", false],
    // Bens Befund nacharbeit-6: Kennungen mit Buchstabenendung sind keine Messwerte.
    ["Bei Anlage 2A im Handbetrieb", false],
    ["an Halle 3 V im Nachtbetrieb", false],
    ["Kran KT-3 mm-genau ausrichten", false],
    ["Pumpe P2bar", false],
    ["Antrieb 4 S", false],
    // Einbuchstabige Einheit zählt nur mit Vergleich — dann ist sie eindeutig.
    ["ab 16 A Anlaufstrom", true],
    ["2 kW Heizleistung", true],
  ])("nenntSchwelle(%j) → %s", (bedingung, erwartet) => {
    expect(nenntSchwelle(bedingung)).toBe(erwartet);
  });

  it("Verzweigung: nennt die Bedingung schon einen Schwellenwert, wird die Schwelle nicht noch einmal erfragt", () => {
    const res = treeInterview(
      ["Ventil X schließen", "ab 6 bar", "Handventil zu"],
      true,
      "de",
      BAUM,
    );
    expect(res.node).toBe("ausnahme");
    expect(res.gaps?.open).not.toContain("schwelle");
  });

  it("Spiegel: wörtlich die letzte gegebene Antwort samt Knoten — nichts hinzugedichtet", () => {
    const res = treeInterview(["Ventil X schließen", "bei Überdruck"], true, "de", BAUM);
    expect(res.mirror).toEqual({ node: "bedingung", text: "bei Überdruck" });
  });

  it("Restlückenwert sinkt mit jeder Antwort; eine übersprungene Frage bleibt Lücke", () => {
    const werte = [0, 1, 2, 3].map(
      (n) => treeInterview(antworten(n), true, "de", BAUM).gaps?.value ?? -1,
    );
    expect(werte[0]).toBe(100);
    for (let i = 1; i < werte.length; i++) {
      expect(werte[i] as number).toBeLessThan(werte[i - 1] as number);
    }
    const uebersprungen = treeInterview(["Ventil X schließen", ""], true, "de", BAUM);
    expect(uebersprungen.gaps?.open).toContain("bedingung");
    expect(uebersprungen.node).toBe("massnahme");
    // Der Spiegel zeigt die letzte ECHTE Antwort, nicht die übersprungene.
    expect(uebersprungen.mirror).toEqual({ node: "kern", text: "Ventil X schließen" });
  });

  it("FR-CAP-02 / R-0113: Abschluss wird nach vier Antworten ANGEBOTEN, aber nie selbst vollzogen", () => {
    const drei = treeInterview(["Kern", "Bedingung", "Maßnahme"], true, "de", BAUM);
    expect(drei.sufficient).toBe(false);
    expect(drei.done).toBe(false);
    const vier = treeInterview(["Kern", "Bedingung", "Maßnahme", "ab 6 bar"], true, "de", BAUM);
    expect(vier.sufficient).toBe(true);
    // „Genug" heißt nur: der Mensch DARF abschließen. Die nächste Frage steht trotzdem da.
    expect(vier.done).toBe(false);
    expect(vier.question).not.toBeNull();
    // Und der Entwurf ist da — aus den Antworten verdichtet (ein KO nach ~4–5 Antworten).
    expect(vier.draft.title).toBe("Kern");
    expect(vier.draft.conditions).toEqual(["Bedingung"]);
    expect(vier.draft.measures).toEqual(["Maßnahme"]);
    expect(vier.depth).toEqual([{ node: "schwelle", text: "ab 6 bar" }]);
  });

  it("Entwurf: Pflichtfelder, Stichworte und die Vertiefung samt getrennter Herkunft stehen wörtlich da", () => {
    const res = treeInterview(
      [
        "Ventil X bei Überdruck schließen",
        "bei Überdruck",
        "Handventil zu",
        "ab 6 bar",
        "nicht im Spülbetrieb",
        "sonst reißt die Dichtung",
        "Abblasen wurde verworfen",
        "Linie 4",
        "Dichtungsschaden",
        "eigene Erfahrung seit 2019 als Schichtleiter",
        "ventil, druck",
      ],
      true,
      "de",
      BAUM,
    );
    expect(res.done).toBe(true);
    expect(res.question).toBeNull();
    expect(res.gaps).toEqual({ value: 0, open: [] });
    expect(res.draft.tags).toEqual(["ventil", "druck"]);
    expect(res.depth?.map((d) => d.node)).toEqual([
      "schwelle",
      "ausnahme",
      "warum",
      "alternativen",
      "geltung",
      "risiko",
      "herkunft",
    ]);
    expect(res.depth?.find((d) => d.node === "herkunft")?.text).toBe(
      "eigene Erfahrung seit 2019 als Schichtleiter",
    );
    // Die Herkunft ist NICHT in die allgemeine Aussage gemischt.
    expect(res.draft.statement).toBe("Ventil X bei Überdruck schließen");
  });

  it("dreisprachig: der Baum fragt in der UI-Sprache", () => {
    expect(treeInterview(["a", "b", "c"], true, "en", BAUM).question).toContain("threshold");
    expect(treeInterview(["a", "b", "c"], true, "nl", BAUM).question).toContain("drempelwaarde");
  });
});

describe("R-0091: das Lücken-Interview — drei Fragen, ein Entwurf", () => {
  it("das Thema steht in der ersten Frage; nach drei Antworten ist der Baum durch und genug", () => {
    const thema = { topic: "Kaltstart Linie 4 im Winter" };
    const t0 = treeInterview([], true, "de", thema);
    expect(t0.node).toBe("kern");
    expect(t0.question).toContain("„Kaltstart Linie 4 im Winter“");
    const t2 = treeInterview(["Vorwärmen", "unter 5 °C"], true, "de", thema);
    expect(t2.node).toBe("massnahme");
    expect(t2.done).toBe(false);
    const fertig = treeInterview(["Vorwärmen", "unter 5 °C", "Heizband"], true, "de", thema);
    expect(fertig.done).toBe(true);
    expect(fertig.sufficient).toBe(true);
    expect(fertig.gaps).toEqual({ value: 0, open: [] });
    expect(fertig.draft.title).toBe("Vorwärmen");
  });

  it("ein Thema schaltet den kurzen Baum auch ohne tree-Option zu; überlange Themen werden begrenzt", () => {
    const res = guidedInterview([], true, "de", undefined, { topic: `  ${"x".repeat(500)}  ` });
    expect(res.node).toBe("kern");
    const zitiert = /„(x+)“/.exec(res.question ?? "")?.[1] ?? "";
    expect(zitiert.length).toBe(200);
  });
});

// R-0088 (Bens Befund nacharbeit-4): ein Client, der die RECHERCHE (erkennbar am JSON-Vertrag im
// System-Prompt) anders beantwortet als die Frageformulierung — so lässt sich beides getrennt messen.
function recherchierenderClient(
  recherche: string,
  frage = "Gilt bei dir auch die übliche Grenze von 6 bar, oder schließt du früher?",
): { client: ModelClient; aufrufe: { system: string; user: string }[] } {
  const aufrufe: { system: string; user: string }[] = [];
  return {
    aufrufe,
    client: {
      name: "recherchierend",
      complete: async (system: string, user: string) => {
        aufrufe.push({ system, user });
        return system.includes('"punkte"') ? recherche : frage;
      },
    },
  };
}

// Bens Befund nacharbeit-6: die Recherche wertet ABGERUFENE QUELLEN aus. So, wie die Quellensuche
// (`services/external-search`) sie liefert — Titel, Adresse, Auszug.
const QUELLE_VENTIL = {
  title: "Sicherheitsventil",
  url: "https://de.wikipedia.org/wiki/Sicherheitsventil",
  snippet: "Ein Sicherheitsventil öffnet beim Erreichen des eingestellten Ansprechdrucks.",
  provider: "wikipedia",
};
const QUELLE_ANFAHREN = {
  title: "Anfahrvorgang",
  url: "https://de.wikipedia.org/wiki/Anfahrvorgang",
  snippet: "Beim Anfahren einer Anlage gelten besondere Betriebsgrenzen.",
  provider: "wikipedia",
};
const QUELLEN = [QUELLE_VENTIL, QUELLE_ANFAHREN];
const MIT_QUELLEN = { tree: true, sources: QUELLEN } as const;

const RECHERCHE = JSON.stringify({
  punkte: [
    {
      knoten: "schwelle",
      hinweis: "Sicherheitsventile an Dampfleitungen sprechen oft bei 6 bar an.",
      quelle: 1,
    },
    {
      knoten: "ausnahme",
      hinweis: "Im Anfahrbetrieb gelten häufig andere Druckgrenzen.",
      quelle: 2,
    },
    { knoten: "unbekannt", hinweis: "wird verworfen", quelle: 1 },
    // Ohne gültige Quelle — Modellwissen statt Recherche — fällt der Punkt weg.
    { knoten: "risiko", hinweis: "ohne Quelle — wird verworfen" },
    { knoten: "risiko", hinweis: "falsche Quellnummer — wird verworfen", quelle: 7 },
  ],
});

const ERWARTETE_RECHERCHE = [
  {
    node: "schwelle",
    hint: "Sicherheitsventile an Dampfleitungen sprechen oft bei 6 bar an.",
    source: {
      title: QUELLE_VENTIL.title,
      url: QUELLE_VENTIL.url,
      snippet: QUELLE_VENTIL.snippet,
    },
  },
  {
    node: "ausnahme",
    hint: "Im Anfahrbetrieb gelten häufig andere Druckgrenzen.",
    source: {
      title: QUELLE_ANFAHREN.title,
      url: QUELLE_ANFAHREN.url,
      snippet: QUELLE_ANFAHREN.snippet,
    },
  },
];

describe("R-0088: quellengebundene Fachrecherche — für tiefere Rückfragen, nie als Wissen", () => {
  it("wertet die abgerufenen Quellen aus und hakt an der Frage gezielt am passenden Prüfpunkt nach", async () => {
    const { client, aufrufe } = recherchierenderClient(RECHERCHE);
    // Voller Fragebaum (kein Lücken-Thema — das wäre der kurze Drei-Fragen-Baum ohne Schwellen-
    // knoten, nach drei Antworten durch): Fachthema der Recherche ist dann die Kernaussage.
    const res = await new ModelProvider(client).interview(
      ["Ventil X bei Überdruck schließen", "bei Überdruck", "Handventil zu"],
      "de",
      false,
      undefined,
      MIT_QUELLEN,
    );
    // Erst die Auswertung der Quellen (zum Fachthema), dann die gezielte Frage.
    expect(aufrufe).toHaveLength(2);
    expect(aufrufe[0]?.system).toContain('"punkte"');
    expect(aufrufe[0]?.system).toContain("AUSSCHLIESSLICH aus diesen Quellen");
    expect(aufrufe[0]?.user).toContain(
      "Fachthema des Interviews: Ventil X bei Überdruck schließen",
    );
    // Die Quellen stehen nummeriert und mit Auszug im Auftrag an das Modell.
    expect(aufrufe[0]?.user).toContain(
      "[1] Sicherheitsventil (https://de.wikipedia.org/wiki/Sicherheitsventil)",
    );
    expect(aufrufe[0]?.user).toContain(QUELLE_VENTIL.snippet);
    expect(aufrufe[0]?.user).toContain("[2] Anfahrvorgang");
    // Die Frage zum Knoten „schwelle" bekommt GENAU den Schwellen-Prüfpunkt als Ziel …
    expect(res.node).toBe("schwelle");
    expect(aufrufe[1]?.user).toContain("Recherchehinweise (ungeprüft, keine Fakten):");
    expect(aufrufe[1]?.user).toContain(
      "Prüfpunkt für diese Frage: Sicherheitsventile an Dampfleitungen sprechen oft bei 6 bar an.",
    );
    expect(aufrufe[1]?.system).toContain("NIE als Tatsache");
    expect(res.question).toBe(
      "Gilt bei dir auch die übliche Grenze von 6 bar, oder schließt du früher?",
    );
    // … die Recherche reist sichtbar MIT IHRER QUELLE mit (ungültige Knoten und Punkte ohne
    // gültige Quelle verworfen) …
    expect(res.research).toEqual(ERWARTETE_RECHERCHE);
    // … und steht NICHT im Entwurf: der besteht nur aus den Antworten des Menschen.
    expect(JSON.stringify(res.draft)).not.toContain("6 bar");
    expect(res.depth).toEqual([]);
    expect(res.gaps?.open).toContain("schwelle");
  });

  it("ohne abgerufene Quellen keine Recherche — das Modell wird nicht um eigenes Wissen gebeten", async () => {
    const { client, aufrufe } = recherchierenderClient(RECHERCHE);
    const res = await new ModelProvider(client).interview(
      ["Ventil X bei Überdruck schließen"],
      "de",
      false,
      undefined,
      BAUM,
    );
    expect(aufrufe).toHaveLength(1);
    expect(aufrufe[0]?.system).not.toContain('"punkte"');
    expect(res).not.toHaveProperty("research");
  });

  it("vor der Kernaussage gibt es nichts zu recherchieren — auch mit Quellen kein Auswertungsaufruf", async () => {
    const { client, aufrufe } = recherchierenderClient(RECHERCHE);
    await new ModelProvider(client).interview([], "de", false, undefined, MIT_QUELLEN);
    expect(aufrufe).toHaveLength(1);
    expect(aufrufe[0]?.system).not.toContain('"punkte"');
  });

  it("einmal je Interview: zurückgereichte Recherche wird geprüft wiederverwendet, kein zweiter Aufruf", async () => {
    const { client, aufrufe } = recherchierenderClient(RECHERCHE);
    const ausnahme = ERWARTETE_RECHERCHE[1];
    const res = await new ModelProvider(client).interview(
      ["Ventil X schließen", "bei Überdruck", "Handventil zu", "ab 6 bar"],
      "de",
      false,
      undefined,
      {
        tree: true,
        research: [
          ausnahme,
          { node: "kern", hint: "nicht recherchierbar — verworfen", source: QUELLE_VENTIL },
          { node: "risiko", hint: "ohne Quelle — verworfen" },
          {
            node: "risiko",
            hint: "unsichere Adresse — verworfen",
            source: { title: "X", url: "javascript:alert(1)" },
          },
          "kein Objekt",
        ],
      },
    );
    expect(aufrufe).toHaveLength(1);
    expect(res.node).toBe("ausnahme");
    expect(aufrufe[0]?.user).toContain(
      "Prüfpunkt für diese Frage: Im Anfahrbetrieb gelten häufig andere Druckgrenzen.",
    );
    expect(res.research).toEqual([ausnahme]);
  });

  it("unlesbare Auswertung: das Interview läuft ehrlich ohne Recherche weiter, nichts erfunden", async () => {
    const { client, aufrufe } = recherchierenderClient("Leider kein JSON.");
    const res = await new ModelProvider(client).interview(
      ["Ventil X schließen"],
      "de",
      false,
      undefined,
      { tree: true, topic: "Überdruck an Linie 4", sources: QUELLEN },
    );
    expect(aufrufe).toHaveLength(2);
    expect(aufrufe[1]?.user).not.toContain("Recherchehinweise");
    expect(res).not.toHaveProperty("research");
    expect(res.question).toBe(
      "Gilt bei dir auch die übliche Grenze von 6 bar, oder schließt du früher?",
    );
  });

  it("ohne Modell (kein gültiger KI-Schlüssel) gibt es keine Recherche — ehrlich leer", async () => {
    const res = await new Reasoner().interview(["Ventil X schließen"], "de", false, undefined, {
      tree: true,
      topic: "Überdruck an Linie 4",
      sources: QUELLEN,
    });
    expect(res.demo).toBe(true);
    expect(res).not.toHaveProperty("research");
  });

  it("das Thema steht im Prompt, die Modellfrage ersetzt nur den Fragetext; Baum und Wert bleiben", async () => {
    const { client, aufrufe } = aufzeichnenderClient();
    const res = await new ModelProvider(client).interview(
      ["Ventil X schließen"],
      "de",
      false,
      undefined,
      { tree: true, topic: "Überdruck an Linie 4" },
    );
    // Ohne abgerufene Quellen keine Recherche — der einzige Aufruf ist die Frage.
    expect(aufrufe).toHaveLength(1);
    expect(aufrufe[0]?.user).toContain("Fachthema des Interviews: Überdruck an Linie 4");
    expect(aufrufe[0]?.user).toContain("Leitfrage: Unter welchen Bedingungen");
    expect(res.question).toBe("Ab welchem Druck genau schließt du Ventil X?");
    expect(res.demo).toBe(false);
    expect(res.node).toBe("bedingung");
    expect(res.gaps?.open).toContain("bedingung");
  });

  it("ist der Baum durch, wird das Modell nicht befragt", async () => {
    const { client, aufrufe } = aufzeichnenderClient();
    const res = await new ModelProvider(client).interview(["a", "b", "c"], "de", false, undefined, {
      topic: "Thema",
    });
    expect(res.done).toBe(true);
    expect(aufrufe).toHaveLength(0);
  });

  it("ohne Thema bleibt der Prompt beim bisherigen Wortlaut (keine Themenzeile)", async () => {
    const { client, aufrufe } = aufzeichnenderClient();
    await new ModelProvider(client).interview(["a"], "de", false, undefined, BAUM);
    // Ohne Quellen keine Recherche: die Frage trägt weder Themenzeile noch Recherche.
    expect(aufrufe).toHaveLength(1);
    expect(aufrufe[0]?.user.startsWith("Bisherige Antworten:")).toBe(true);
  });
});

// INTEGRATION mit main (R-1624 Foto-zu-Wissen): beide Erweiterungen teilen sich `interview(...)`.
// Der Bildbefund steht an 4., die Fragebaum-Optionen an 5. Stelle; ein Befund behält seine eigene
// Foto-Fragenfolge und seinen Prompt-Block — der Baum mischt sich dort nicht ein.
describe("Konfliktstelle: Foto-Interview und Fragebaum nebeneinander", () => {
  const BEFUND = "Riss an der Schweißnaht links unten";

  it("mit Bildbefund gilt die Foto-Fragenfolge, auch wenn tree/topic mitkommen", () => {
    const res = guidedInterview([], true, "de", BEFUND, { tree: true, topic: "Thema" });
    expect(res.question).toBe("Welcher Fehler ist hier zu sehen?");
    expect(res).not.toHaveProperty("gaps");
  });

  it("Modellprompt: Bildbefund ja, Fachthema nein; ohne Befund umgekehrt", async () => {
    const foto = aufzeichnenderClient();
    await new ModelProvider(foto.client).interview([], "de", false, BEFUND, {
      tree: true,
      topic: "Thema X",
    });
    expect(foto.aufrufe[0]?.user).toContain(BEFUND);
    expect(foto.aufrufe[0]?.user).not.toContain("Fachthema des Interviews");

    const baum = aufzeichnenderClient();
    const res = await new ModelProvider(baum.client).interview([], "de", false, undefined, {
      tree: true,
      topic: "Thema X",
    });
    expect(baum.aufrufe[0]?.user).toContain("Fachthema des Interviews: Thema X");
    expect(res.node).toBe("kern");
  });

  it("die Route reicht Bildbefund UND Fragebaum-Option an die richtigen Stellen", async () => {
    const services = buildServices();
    (services as unknown as { reasoner: Reasoner }).reasoner = new Reasoner();
    const app = buildApp(services);
    await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { name: "Admin", email: "admin@x.de", password: "secret123" },
    });
    const anmeldung = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "admin@x.de", password: "secret123" },
    });
    const headers = { authorization: `Bearer ${anmeldung.json().token}` };
    const foto = await app.inject({
      method: "POST",
      url: "/api/reasoner",
      headers,
      payload: { task: "interview", answers: [], imageContext: BEFUND, tree: true },
    });
    expect(foto.json().question).toBe("Welcher Fehler ist hier zu sehen?");
    const baum = await app.inject({
      method: "POST",
      url: "/api/reasoner",
      headers,
      payload: { task: "interview", answers: [], tree: true },
    });
    expect(baum.json().node).toBe("kern");
    await app.close();
  });
});

describe("Durchreichung: Dienst und echte Route POST /api/reasoner", () => {
  it("der Reasoner-Dienst reicht die Option an den Provider durch", async () => {
    const res = await new Reasoner().interview([], "de", false, undefined, BAUM);
    expect(res.node).toBe("kern");
    expect(res.gaps?.value).toBe(100);
  });

  it("die Route nimmt tree und topic an und liefert Knoten, Lückenwert und Spiegel", async () => {
    const services = buildServices();
    (services as unknown as { reasoner: Reasoner }).reasoner = new Reasoner();
    const app = buildApp(services);
    await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { name: "Admin", email: "admin@x.de", password: "secret123" },
    });
    const anmeldung = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "admin@x.de", password: "secret123" },
    });
    const headers = { authorization: `Bearer ${anmeldung.json().token}` };

    const baum = await app.inject({
      method: "POST",
      url: "/api/reasoner",
      headers,
      payload: { task: "interview", answers: ["Ventil X schließen"], tree: true },
    });
    expect(baum.statusCode).toBe(200);
    expect(baum.json()).toMatchObject({
      node: "bedingung",
      sufficient: false,
      mirror: { node: "kern", text: "Ventil X schließen" },
    });
    expect(baum.json().gaps.value).toBeLessThan(100);

    const luecke = await app.inject({
      method: "POST",
      url: "/api/reasoner",
      headers,
      payload: { task: "interview", answers: [], topic: "Kaltstart Linie 4" },
    });
    expect(luecke.json().question).toContain("Kaltstart Linie 4");

    // Fremde Typen werden nicht durchgereicht: ein Objekt als Thema schaltet nichts zu.
    const fremd = await app.inject({
      method: "POST",
      url: "/api/reasoner",
      headers,
      payload: { task: "interview", answers: [], tree: "ja", topic: { x: 1 } },
    });
    expect(fremd.json()).not.toHaveProperty("gaps");
    await app.close();
  });
});

// R-0088 (Bens Befund nacharbeit-6): die ECHTE Quellenrecherche an der Route. Gestellt ist nur der
// Anbieter der Quellensuche (kein Netz); Stufe, Vertraulichkeit und Durchreichung sind die echten.
describe("R-0088: Quellenrecherche an der echten Route POST /api/reasoner", () => {
  async function aufbau() {
    const services = buildServices();
    const reasoner = new Reasoner();
    const interviewSpion = vi.spyOn(reasoner, "interview");
    const suchanfragen: string[] = [];
    const veraenderbar = services as unknown as {
      reasoner: Reasoner;
      externalSearch: unknown;
    };
    veraenderbar.reasoner = reasoner;
    veraenderbar.externalSearch = {
      providerName: "wikipedia",
      search: async (q: string) => {
        suchanfragen.push(q);
        return QUELLEN;
      },
    };
    const app = buildApp(services);
    await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { name: "Admin", email: "admin@x.de", password: "secret123" },
    });
    const anmeldung = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "admin@x.de", password: "secret123" },
    });
    const headers = { authorization: `Bearer ${anmeldung.json().token}` };
    const turn = (payload: Record<string, unknown>) =>
      app.inject({
        method: "POST",
        url: "/api/reasoner",
        headers,
        payload: {
          task: "interview",
          answers: ["Ventil X bei Überdruck schließen"],
          tree: true,
          source: "draft",
          confidentiality: "intern",
          ...payload,
        },
      });
    return { services, app, interviewSpion, suchanfragen, turn };
  }

  function letzteOptionen(spion: { mock: { calls: unknown[][] } }): Record<string, unknown> {
    const aufrufe = spion.mock.calls;
    return (aufrufe[aufrufe.length - 1]?.[4] ?? {}) as Record<string, unknown>;
  }

  it("auf Wunsch: ruft zum Thema Quellen ab und reicht sie an den Reasoner", async () => {
    const { app, interviewSpion, suchanfragen, turn } = await aufbau();
    const res = await turn({ recherchieren: true });
    expect(res.statusCode).toBe(200);
    expect(suchanfragen).toEqual(["Ventil X bei Überdruck schließen"]);
    expect(letzteOptionen(interviewSpion).sources).toEqual(QUELLEN);
    await app.close();
  });

  it("ohne Wunsch, bei vertraulichem Inhalt, mit vorhandener Recherche oder gesperrter Stufe: keine Suche", async () => {
    const { services, app, interviewSpion, suchanfragen, turn } = await aufbau();
    await turn({});
    await turn({ recherchieren: true, confidentiality: "vertraulich" });
    await turn({ recherchieren: true, research: ERWARTETE_RECHERCHE });
    await turn({ recherchieren: true, imageContext: "Riss an der Naht" });
    await (
      services as unknown as { externalKnowledge: { setStage: (s: string) => Promise<void> } }
    ).externalKnowledge.setStage("blocked");
    await turn({ recherchieren: true });
    expect(suchanfragen).toEqual([]);
    expect(letzteOptionen(interviewSpion)).not.toHaveProperty("sources");
    await app.close();
  });
});
