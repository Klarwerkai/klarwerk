// PP-07-Port zum tatsächlich gebundenen PP-05-Deckvertrag fbc1ef39.
// Nur Projektion einer serverseitigen PP-05-Ausgabe, keine zweite Deckablage oder Dateischreibung.
import type { GebundenerDeckVertrag } from "./office-datenfolien";
import type { AenderungsPlan } from "./praesentation-aenderungen";
import {
  DatenFehler,
  type DatenUmgebung,
  type Datenpunkt,
  type FoliensatzDaten,
  elementBefund,
  inFassung,
  sicht,
} from "./praesentation-daten";
import type { DatenpunktAblage } from "./praesentation-daten-ablage";

/**
 * Der Aufrufer muss den echten PP-05-Übernahmerücklauf samt gespeicherten Dateibytes liefern.
 * Kein HTTP-Rumpf/ungeprüftes importiertes JSON ist ein solcher Rücklauf. Alle Ausgaben leiten
 * sich aus diesem einen Vertrag ab; kurz/lang enthalten nur Folienverweise auf dieselbe Basis.
 */
export async function verknuepfeDeckFassungen(
  gebunden: GebundenerDeckVertrag,
  datei: FoliensatzDaten,
  u: DatenUmgebung,
  ablage: DatenpunktAblage,
  aenderung?: AenderungsPlan,
) {
  const { deck } = gebunden;
  if (gebunden.dateiFassung !== datei.fassung || deck.vertrag !== "klara-pp05-v1") {
    throw new DatenFehler(
      "ungueltig",
      "Der PP-05-Deckvertrag passt nicht zur gelesenen Dateifassung.",
    );
  }
  const folienIds = new Set(datei.folien.map((f) => f.sldId));
  if (
    new Set(deck.folien.map((f) => f.sldId)).size !== deck.folien.length ||
    deck.folien.some((f) => !folienIds.has(f.sldId))
  ) {
    throw new DatenFehler(
      "ungueltig",
      "Eine PP-05-Folie fehlt oder ist im Vertrag doppelt zugeordnet.",
    );
  }
  const fassungen = new Map<string, number>();
  const referenzen = [
    ...deck.plan.fakten.map((f) => ({ id: f.id, fassung: f.fassung })),
    ...deck.folien.flatMap((f) => f.datenpunkte),
    ...deck.bindungen.map((b) => ({ id: b.datenpunktId, fassung: b.datenFassung })),
    ...deck.belegfolien.map((b) => ({ id: b.datenpunktId, fassung: b.datenFassung })),
  ];
  for (const ref of referenzen) {
    const bisher = fassungen.get(ref.id);
    if (bisher !== undefined && bisher !== ref.fassung) {
      throw new DatenFehler(
        "ungueltig",
        "Haupt-, Detail- oder Belegfolien verwenden verschiedene Datenfassungen. Keine konsistente Fassung ableitbar.",
      );
    }
    fassungen.set(ref.id, ref.fassung);
  }
  const datenbasis = [];
  const punkte = new Map<string, Datenpunkt>();
  // Erst die ganze Herkunft prüfen; bei Rechteentzug keine Teilfassung mit alten Quellen ausgeben.
  for (const [id, fassung] of fassungen) {
    const heute = await ablage.lesen(id);
    const damals = heute ? inFassung(heute, fassung) : undefined;
    const herkunft = damals ? await sicht(damals, u) : undefined;
    if (!heute || !damals || !herkunft) {
      throw new DatenFehler("kein_zugriff", "Datenpunkt nicht gefunden.");
    }
    punkte.set(id, damals);
    datenbasis.push({
      id,
      fassung,
      aktuelleFassung: heute.fassung,
      quelle: herkunft.quelle,
      eingaben:
        damals.rechenweg?.eingaben.map((e) => ({ id: e.datenpunktId, fassung: e.fassung })) ?? [],
      pruefstand: herkunft.pruefstand,
    });
  }
  const konflikte = [];
  for (const b of deck.bindungen) {
    const dp = punkte.get(b.datenpunktId);
    const bindung = dp?.bindungen.find(
      (alt) =>
        alt.koId === deck.plan.basis.koId &&
        alt.anhangId === deck.plan.basis.anhangId &&
        alt.dateiFassung === datei.fassung &&
        alt.sldId === b.sldId &&
        alt.shapeId === b.shapeId &&
        alt.zeile === b.zeile &&
        alt.spalte === b.spalte,
    );
    if (!dp || !bindung || elementBefund(dp, bindung, datei).lage !== "passt") {
      konflikte.push({
        sldId: b.sldId,
        shapeId: b.shapeId,
        datenpunktId: b.datenpunktId,
        grund: !bindung
          ? "Die PP-02-Herkunftsbindung fehlt für diese Dateifassung. Teilbindung vor Verwendung klären."
          : "Der gebundene Wert wurde im Dokument verändert oder entfernt. Manuellen Inhalt erhalten und klären.",
      });
    }
  }
  const gemeinsam = { dateiFassung: datei.fassung, datenbasis };
  const variante = (tiefe: "kurz" | "ausfuehrlich") => ({
    tiefe,
    folien: deck.folien
      .filter((f) => tiefe === "ausfuehrlich" || f.rolle === "haupt")
      .map((f) => f.sldId),
  });
  const wirkungen = deck.folien.flatMap((f) => {
    const betroffen = f.datenpunkte.filter((p) => aenderung?.geaendert.includes(p.id));
    return betroffen.length
      ? [
          {
            sldId: f.sldId,
            rolle: f.rolle,
            art: deck.diagramme.some((d) => d.sldId === f.sldId)
              ? ("diagramm" as const)
              : f.rolle === "detail"
                ? ("beleg" as const)
                : ("folieninhalt" as const),
            datenpunkte: betroffen.map((p) => ({
              id: p.id,
              vorher: p.fassung,
              nachher: aenderung?.nachher.get(p.id)?.fassung ?? p.fassung,
            })),
            grund:
              "Nach der vorgeschlagenen Datenänderung gemeinsam aktualisieren und erneut prüfen.",
          },
        ]
      : [];
  });
  return {
    gemeinsam,
    kurz: variante("kurz"),
    ausfuehrlich: variante("ausfuehrlich"),
    belegfolien: deck.belegfolien,
    konflikte,
    wirkungen,
    uebernahme: false as const,
    grenzen: [
      "Folienauswahl aus genau einem PP-05-Vertrag; noch kein gespeicherter kurzer/langer Dateiexport.",
      "Diagrammwirkungen folgen dem echten PP-05-Vertrag; Diagrammbytes und eingebettete Arbeitsmappe werden hier nicht verändert oder unabhängig geprüft.",
      "Der erste PP-05-Port enthält keine Notizbindungen. Sprechernotizen und freie abgeleitete Aussagen bleiben zusätzlich zu prüfen.",
      "belegOffen und bindungenOffen des PP-05-Übernahmerücklaufs bleiben gesonderte offene Lieferbedingungen.",
    ],
  };
}
