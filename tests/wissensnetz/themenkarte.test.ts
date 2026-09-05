// ================================================================================================
// JOB 2600 · D1 — DIE THEMENKARTE, GEPRUEFT AN IHREN VIER AUFLAGEN.
// ================================================================================================
//
// Diese Datei prueft die REGELN, nicht das Bild. Sie ist DOM-frei und laeuft im Node-Tor.
// Der gemountete Weg (Seite, Klickziel) steht in `tests/app/themenkarte-mounted.test.tsx`.
//
// Die Reihenfolge der Bloecke ist Codex' Reihenfolge aus §5b des Auftrags:
//   A  Rechte zuerst        — was nicht sichtbar ist, existiert hier nicht
//   B  Groesse und Farbe    — nur aus sichtbarem Bestand
//   C  Ubiquitaet           — ueber 50 % Anteil: Knoten ja, Kanten nein
//   D  Erst dann Kanten     — nur aus freigegebenen Objekten, hoechstens 3 je Knoten
//   E  Keine globalen Mengen an den Client
import { describe, expect, it } from "vitest";
import type { ThemenkarteKo } from "../../services/wissensnetz/src/lesemodell-ports";
import {
  KANTEN_JE_KNOTEN,
  THEMEN_KNOTEN_DECKEL,
  UBIQUITY_MAX_SHARE,
  UBIQUITY_MIN_COUNT,
  themenkarte,
} from "../../services/wissensnetz/src/themenkarte";

function ko(
  id: string,
  tags: string[],
  opts: { status?: string; quellen?: number } = {},
): ThemenkarteKo {
  return {
    id,
    // JOB 3073: `category` ist aus dem Vertrag verschwunden — die Themenachse sind die
    // SCHLAGWORTE, und zwar für die Karte wie für die Zähler (`themenVon`).
    tags,
    status: opts.status ?? "validiert",
    sources: Array.from({ length: opts.quellen ?? 0 }, (_, i) => ({ n: i })),
  };
}

describe("JOB 2600 D1 · A — Rechte zuerst", () => {
  it("A1 · die Karte entsteht ausschliesslich aus der uebergebenen (getrimmten) Menge", () => {
    // Diese Funktion NIMMT kein Praedikat entgegen und kann keines entgegennehmen. Das ist die
    // Zusage: getrimmt wird eine Ebene hoeher, mit der zentralen Policy aus der Naht.
    const karte = themenkarte([ko("k1", ["pumpe"], { quellen: 1 })]);
    expect(karte.themen.map((k) => k.thema)).toEqual(["pumpe"]);
    // `themenkarte` hat GENAU EINEN Parameter — ein zweiter waere die Tuer fuer ein eigenes
    // Praedikat, und genau die soll es nicht geben.
    expect(themenkarte.length).toBe(1);
  });

  it("A2 · ein Thema, das nur unsichtbare Traeger haette, kommt gar nicht vor", () => {
    // Der Aufrufer hat `geheim` bereits entfernt. Die Karte darf den Namen nicht kennen.
    const sichtbare = [ko("k1", ["pumpe"])];
    const karte = themenkarte(sichtbare);
    expect(karte.themen.some((k) => k.thema === "geheim")).toBe(false);
    expect(karte.weitere).not.toContain("geheim");
  });
});

describe("JOB 2600 D1 · B — Groesse und Farbe nur aus sichtbarem Bestand", () => {
  it("B1 · `objekte` zaehlt die sichtbaren Traeger je Thema", () => {
    const karte = themenkarte([
      ko("k1", ["pumpe", "wartung"]),
      ko("k2", ["pumpe"]),
      ko("k3", ["dichtung"]),
    ]);
    const nach = new Map(karte.themen.map((k) => [k.thema, k.objekte]));
    expect(nach.get("pumpe")).toBe(2);
    expect(nach.get("wartung")).toBe(1);
    expect(nach.get("dichtung")).toBe(1);
  });

  it("B2 · drei Farben, und jede sagt genau eine Sache", () => {
    const karte = themenkarte([
      ko("k1", ["belegt"], { status: "validiert", quellen: 2 }),
      ko("k2", ["frei"], { status: "validiert", quellen: 0 }),
      ko("k3", ["roh"], { status: "offen", quellen: 3 }),
    ]);
    const farbe = new Map(karte.themen.map((k) => [k.thema, k.farbe]));
    expect(farbe.get("belegt")).toBe("belegt");
    expect(farbe.get("frei")).toBe("freigegeben");
    // Quellen an einem NICHT freigegebenen Objekt faerben nicht: die Freigabe ist die Bedingung.
    expect(farbe.get("roh")).toBe("offen");
  });

  it("B2a · ALLEIN der Quellenstatus wechselt — und genau das aendert die Farbe", () => {
    // BENs Pruefluecke 2 aus dem Urteil vom 27.08., 01:05, woertlich: „Nur den Quellenstatus
    // eines Wissensobjekts aendern; erwartet werden eine entsprechend geaenderte Knotenfarbe."
    //
    // DIESER FALL AENDERT GENAU EINE GROESSE. Titel, Thema, Freigabestatus und Traegerzahl sind
    // in beiden Haelften identisch; verschieden ist ausschliesslich `sources`. Ohne diese
    // Einschraenkung waere ein Farbwechsel auch mit der alten, auf `status` verkuerzten Logik
    // erklaerbar gewesen — und der Beleg waere keiner.
    const ohneQuelle = [ko("k1", ["pumpe"], { status: "validiert", quellen: 0 })];
    const mitQuelle = [ko("k1", ["pumpe"], { status: "validiert", quellen: 1 })];

    const vorher = themenkarte(ohneQuelle).themen[0];
    const nachher = themenkarte(mitQuelle).themen[0];

    // Die Gegenprobe zuerst: alles ausser der Quellenlage ist wirklich gleich.
    expect(vorher?.thema).toBe(nachher?.thema);
    expect(vorher?.objekte).toBe(nachher?.objekte);
    // Und dann der Wechsel, den die Auflage verlangt.
    expect(vorher?.farbe, "ohne Quelle darf die Farbe nicht `belegt` sein").toBe("freigegeben");
    expect(nachher?.farbe, "mit Quelle muss die Farbe `belegt` sein").toBe("belegt");

    // DIE ANDERE RICHTUNG, damit der Fall nicht nur eine Einbahn belegt: Bleibt die Quelle und
    // faellt die FREIGABE weg, ist die Farbe `offen` — die Quelle allein faerbt nicht.
    const nurQuelle = themenkarte([ko("k1", ["pumpe"], { status: "offen", quellen: 1 })]);
    expect(nurQuelle.themen[0]?.farbe).toBe("offen");
  });

  it("B2b · zwei Themen, gleicher Freigabestatus, verschiedene Quellenlage ⇒ verschiedene Farben", () => {
    // BENs Pruefluecke 1: „Zwei Themen mit identischem Freigabestatus, aber unterschiedlichem
    // vorhandenen Quellenstatus einspeisen; erwartet werden … unterschiedliche Gesamtzustaende
    // statt identischer Farben." Beide Objekte sind `validiert`; nur die Quellen unterscheiden.
    const karte = themenkarte([
      ko("k1", ["mitbeleg"], { status: "validiert", quellen: 3 }),
      ko("k2", ["ohnebeleg"], { status: "validiert", quellen: 0 }),
    ]);
    const farbe = new Map(karte.themen.map((k) => [k.thema, k.farbe]));
    expect(farbe.get("mitbeleg")).not.toBe(farbe.get("ohnebeleg"));
    expect(farbe.get("mitbeleg")).toBe("belegt");
    expect(farbe.get("ohnebeleg")).toBe("freigegeben");
  });

  it("B3 · fehlende Felder erzeugen nie eine staerkere Aussage", () => {
    const karte = themenkarte([{ id: "k1", tags: ["pumpe"] }]);
    expect(karte.themen[0]?.farbe).toBe("offen");
    expect(karte.kanten).toEqual([]);
  });

  // ==============================================================================================
  // JOB 3073 · RUNDE 2 — EIN THEMA HEISST SO, WIE SEIN SCHLAGWORT GESPEICHERT IST.
  // ==============================================================================================
  //
  // Bis Runde 1 trimmte `themenVon` den Wert. Das war eine ZWEITE Normalisierung, die sonst
  // niemand anwendet — und sie machte den Sprung in die Bibliothek kaputt: der getrimmte Name war
  // dort ein unbekannter Facettenwert, die Wertpruefung warf den Filter weg, und der Klick zeigte
  // den GANZEN Bestand. Die Wirkung ist in `tests/wissensnetz-achse/bibliothekstreffer.test.tsx`
  // (L4–L6) und am geklickten Weg in `tests/design/zielbild-wissensnetz.test.ts` (T3) gemessen;
  // HIER steht die Regel selbst.
  it("B3a · der gespeicherte Wert IST der Themenname — Rand-Leerzeichen werden nicht weggerechnet", () => {
    const karte = themenkarte([ko("k1", [" pumpe "]), ko("k2", [" pumpe "]), ko("k3", ["pumpe"])]);

    // Zwei Themen, nicht eines: die Bibliothek fuehrt diese beiden Werte auch getrennt.
    expect(karte.themen.map((k) => k.thema).sort()).toEqual([" pumpe ", "pumpe"]);
    expect(karte.themen.find((k) => k.thema === " pumpe ")?.objekte).toBe(2);
    expect(karte.themen.find((k) => k.thema === "pumpe")?.objekte).toBe(1);
  });

  it("B3b · ein Schlagwort OHNE jedes sichtbare Zeichen ist kein Thema — das bleibt", () => {
    // Der Trimm faellt als IDENTITAET weg, nicht als PRUEFUNG: ein Name, den man weder zeigen noch
    // anklicken koennte, entsteht weiterhin nicht.
    const karte = themenkarte([ko("k1", ["", "   ", "\t", "pumpe"])]);
    expect(karte.themen.map((k) => k.thema)).toEqual(["pumpe"]);
  });

  it("B3c · dasselbe Schlagwort zweimal im SELBEN Objekt bleibt ein Knoten und stiftet keine Kante", () => {
    const karte = themenkarte([ko("k1", ["pumpe", "pumpe"], { quellen: 1 })]);
    expect(karte.themen.map((k) => k.thema)).toEqual(["pumpe"]);
    expect(karte.themen[0]?.objekte, "einmal gezaehlt, nicht zweimal").toBe(1);
    expect(karte.kanten, "ein Thema kann mit sich selbst nicht vorkommen").toEqual([]);
  });

  it("B4 · hoechstens 40 Knoten; der Rest steht als NAMENSLISTE hinter „Alle Themen“", () => {
    const viele = Array.from({ length: 45 }, (_, i) =>
      // Absteigende Groesse, damit die Reihenfolge pruefbar ist: t00 traegt am meisten.
      Array.from({ length: 45 - i }, (_, j) =>
        ko(`k${i}-${j}`, [`t${String(i).padStart(2, "0")}`]),
      ),
    ).flat();
    const karte = themenkarte(viele);
    expect(karte.themen.length).toBe(THEMEN_KNOTEN_DECKEL);
    expect(karte.themen[0]?.thema).toBe("t00");
    expect(karte.weitere.length).toBe(5);
    expect(karte.weitere[0]).toBe("t40");
  });
});

describe("JOB 2600 D1 · C — Ubiquitaet: Knoten ja, Kanten nein", () => {
  it("C1 · die Schwellen sind die von mega68", () => {
    expect(UBIQUITY_MAX_SHARE).toBe(0.5);
    expect(UBIQUITY_MIN_COUNT).toBe(5);
  });

  it("C2 · ein Schlagwort ueber der Mehrheitsgrenze bleibt Knoten, verbindet aber nichts", () => {
    // `pilot-demo` auf allen sechs, dazu je zwei Traeger fuer zwei echte Themen.
    const bestand = [
      ko("k1", ["pilot-demo", "pumpe"]),
      ko("k2", ["pilot-demo", "pumpe"]),
      ko("k3", ["pilot-demo", "dichtung"]),
      ko("k4", ["pilot-demo", "dichtung"]),
      ko("k5", ["pilot-demo"]),
      ko("k6", ["pilot-demo"]),
    ];
    const karte = themenkarte(bestand);
    const demo = karte.themen.find((k) => k.thema === "pilot-demo");
    expect(demo, "das ubiquitaere Thema fehlt als Knoten").toBeDefined();
    expect(demo?.ohneKanten).toBe(true);
    // Keine einzige Kante laeuft ueber das ubiquitaere Thema.
    expect(karte.kanten.some((e) => e.a === "pilot-demo" || e.b === "pilot-demo")).toBe(false);
    // Und die echten Themen sind nicht miteinander verbunden — sie teilen nur `pilot-demo`.
    expect(karte.kanten).toEqual([]);
  });

  it("C3 · unter dem absoluten Boden feuert die Anteilsstatistik nicht", () => {
    // Vier Objekte, alle mit `alles`: Anteil 100 %, aber count 4 < UBIQUITY_MIN_COUNT (5).
    const karte = themenkarte([
      ko("k1", ["alles", "a"]),
      ko("k2", ["alles", "a"]),
      ko("k3", ["alles", "b"]),
      ko("k4", ["alles", "b"]),
    ]);
    expect(karte.themen.find((k) => k.thema === "alles")?.ohneKanten).toBe(false);
    expect(karte.kanten.length).toBeGreaterThan(0);
  });
});

describe("JOB 2600 D1 · D — erst dann Kanten", () => {
  it("D1 · eine Kante entsteht nur aus einem FREIGEGEBENEN Objekt", () => {
    const nurOffen = themenkarte([ko("k1", ["pumpe", "dichtung"], { status: "offen" })]);
    expect(nurOffen.kanten).toEqual([]);
    const freigegeben = themenkarte([ko("k1", ["pumpe", "dichtung"], { status: "validiert" })]);
    expect(freigegeben.kanten).toEqual([{ a: "dichtung", b: "pumpe", gewicht: 1 }]);
  });

  it("D2 · `find` → `filter`: jedes gemeinsame Vorkommen zaehlt, nicht nur das erste", () => {
    // Drei Themen in EINEM Objekt ergeben DREI Paare. Der alte Graph nahm je Paar nur das erste
    // geteilte Schlagwort (`service.ts:1608`) und verlor den Rest.
    const karte = themenkarte([ko("k1", ["a", "b", "c"])]);
    expect(karte.kanten.map((e) => `${e.a}-${e.b}`).sort()).toEqual(["a-b", "a-c", "b-c"]);
  });

  it("D3 · das Gewicht zaehlt, in wie vielen Objekten die beiden gemeinsam vorkommen", () => {
    const karte = themenkarte([ko("k1", ["a", "b"]), ko("k2", ["a", "b"]), ko("k3", ["a", "c"])]);
    const ab = karte.kanten.find((e) => e.a === "a" && e.b === "b");
    expect(ab?.gewicht).toBe(2);
  });

  it("D4 · hoechstens 3 Kanten je Knoten — und statt mehr Kanten steigt die Mindesthaeufigkeit", () => {
    // Ein Stern: `mitte` kommt mit sechs Randthemen zusammen vor. Ohne Deckel haette `mitte`
    // sechs Kanten. Zwei der Paare kommen DOPPELT vor und sind damit staerker.
    //
    // DIE NEUN FUELLER SIND NICHT BEIWERK. Ohne sie traegt `mitte` 8 von 8 Objekten — das ist
    // ubiquitaer (C2), und der Fall pruefte dann den Gradfilter gar nicht mehr, weil es
    // ueberhaupt keine Kante gaebe. Mit ihnen sind es 8 von 17 (47 %), also knapp unter der
    // Mehrheitsgrenze. Jeder Fueller traegt genau EIN eigenes Thema und stiftet deshalb selbst
    // keine Kante.
    const bestand = [
      ko("k1", ["mitte", "r1"]),
      ko("k2", ["mitte", "r1"]),
      ko("k3", ["mitte", "r2"]),
      ko("k4", ["mitte", "r2"]),
      ko("k5", ["mitte", "r3"]),
      ko("k6", ["mitte", "r4"]),
      ko("k7", ["mitte", "r5"]),
      ko("k8", ["mitte", "r6"]),
      ...Array.from({ length: 9 }, (_, i) => ko(`f${i}`, [`fuell${i}`])),
    ];
    const karte = themenkarte(bestand);
    const grad = new Map<string, number>();
    for (const e of karte.kanten) {
      grad.set(e.a, (grad.get(e.a) ?? 0) + 1);
      grad.set(e.b, (grad.get(e.b) ?? 0) + 1);
    }
    for (const [thema, n] of grad) {
      expect(n, `${thema} hat ${n} Kanten`).toBeLessThanOrEqual(KANTEN_JE_KNOTEN);
    }
    // Verduennt statt gekappt: die Mindesthaeufigkeit ist gestiegen, und uebrig bleiben die
    // starken Paare — nicht drei beliebige.
    expect(karte.mindesthaeufigkeit).toBe(2);
    expect(karte.kanten.map((e) => `${e.a}-${e.b}`).sort()).toEqual(["mitte-r1", "mitte-r2"]);
  });

  it("D5 · fehlen Beziehungen, bleiben Kanten weg — es werden keine erfunden", () => {
    const karte = themenkarte([ko("k1", ["a"]), ko("k2", ["b"]), ko("k3", ["c"])]);
    expect(karte.themen.length).toBe(3);
    expect(karte.kanten).toEqual([]);
  });

  it("D6 · gleiche Eingabe, gleiches Ergebnis — die Karte ist deterministisch", () => {
    const bestand = [ko("k1", ["b", "a"]), ko("k2", ["a", "c"]), ko("k3", ["c", "b"])];
    expect(themenkarte(bestand)).toEqual(themenkarte([...bestand].reverse()));
  });
});

describe("JOB 2600 D1 · E — keine globalen Mengen an den Client", () => {
  it("E1 · die Antwort traegt keine Gesamtzahl und keine Traegerzahl ausserhalb der Knoten", () => {
    const karte = themenkarte([ko("k1", ["a"]), ko("k2", ["b"])]);
    const schluessel = Object.keys(karte).sort();
    expect(schluessel).toEqual([
      "kanten",
      "mindesthaeufigkeit",
      "themen",
      // JOB 2600 D7 · NEU, und bewusst durch diese Positivliste gefuehrt. Der Waechter hat
      // korrekt angeschlagen; hier steht, warum der Schluessel trotzdem zulaessig ist:
      //
      // `unterdruecktDurchUbiquitaet` zaehlt Paare GEZEICHNETER Themen — also ausschliesslich
      // Knoten, die ohnehin im Bild stehen. Er ist nach oben durch die 40 gezeichneten Knoten
      // begrenzt, nicht durch den Bestand. Er nennt keine Objektzahl, keine Traegerzahl und kein
      // Thema ausserhalb der Karte, und er kann nicht wachsen, wenn unsichtbarer Bestand waechst
      // (die Grundmenge ist bereits getrimmt, `themenkarte.ts` Reihenfolge Schritt 1).
      //
      // Er ist die Bedingung fuer den Legendensatz aus `wissensnetz.legende.kantenUnterdrueckt`.
      // Ohne ihn muesste die Oberflaeche die Ursache raten — und genau das war der Rotgrund in D5.
      "unterdruecktDurchUbiquitaet",
      "weitere",
      "weitereAbgeschnitten",
    ]);
  });

  it("E1a · der neue Zaehler bleibt an die GEZEICHNETEN Knoten gebunden", () => {
    // Die Gegenprobe zu E1: Der Zaehler darf nichts ueber Themen jenseits des Knotendeckels
    // verraten. 40 grosse Themen an unfreigegebenen Objekten fuellen die Karte; ein freigegebenes
    // Objekt traegt zwei kleine Themen, die dadurch auf Platz 41 und 42 landen.
    const viele = Array.from({ length: THEMEN_KNOTEN_DECKEL }, (_, i) => [
      ko(`gross${i}-1`, [`t${String(i).padStart(2, "0")}`], { status: "offen" }),
      ko(`gross${i}-2`, [`t${String(i).padStart(2, "0")}`], { status: "offen" }),
    ]).flat();
    // Das eine FREIGEGEBENE Objekt traegt beide kleinen Themen.
    const karte = themenkarte([...viele, ko("klein", ["randX", "randY"], { quellen: 1 })]);

    expect(karte.themen).toHaveLength(THEMEN_KNOTEN_DECKEL);
    expect(karte.kanten).toHaveLength(0);
    // Das Paar existiert — aber KEINES seiner Themen ist gezeichnet, also ist es keines
    // „dieser Themen" und darf den Zaehler nicht heben.
    expect(karte.unterdruecktDurchUbiquitaet).toBe(0);
  });

  it("E2 · `weitere` traegt NAMEN, keine Zaehler", () => {
    const viele = Array.from({ length: 41 }, (_, i) =>
      Array.from({ length: 41 - i }, (_, j) =>
        ko(`k${i}-${j}`, [`t${String(i).padStart(2, "0")}`]),
      ),
    ).flat();
    const karte = themenkarte(viele);
    expect(karte.weitere.every((w) => typeof w === "string")).toBe(true);
  });
});
