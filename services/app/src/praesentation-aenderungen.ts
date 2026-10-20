// PP-07: read-only Wirkungsvorschau. Daten und Rechenwege bleiben PP-02, Kontrollen PP-03.
// Der aktuelle Anhang bestimmt den Suchraum; dies ist kein globaler Abhängigkeitsindex.
import { createHash } from "node:crypto";
import {
  DatenFehler,
  type DatenUmgebung,
  type Datenpunkt,
  type Handelnder,
  type Korrekturauftrag,
  elementBefund,
  fingerabdruck,
  korrigiere,
  leseKorrektur,
  sicht,
  vollLesbar,
} from "./praesentation-daten";
import type { DatenpunktAblage } from "./praesentation-daten-ablage";
import { kontrollAnschluss } from "./praesentation-pruefung-anschluss";

export class VorschauKonflikt extends Error {}

export interface Aenderungsauftrag {
  readonly datenpunktId: string;
  readonly fassung: number;
  readonly korrektur: Korrekturauftrag;
}

/** Nur die bestehenden Korrekturmöglichkeiten; keine gelieferten Quellen/Prüfstände übernehmen. */
export function leseAenderungen(roh: unknown): Aenderungsauftrag[] {
  if (!Array.isArray(roh) || roh.length < 1 || roh.length > 20) {
    throw new DatenFehler("ungueltig", "Eine Vorschau braucht 1 bis 20 Änderungen.");
  }
  const ids = new Set<string>();
  return roh.map((x: unknown) => {
    if (
      !x ||
      typeof x !== "object" ||
      !("datenpunktId" in x) ||
      typeof x.datenpunktId !== "string" ||
      !x.datenpunktId ||
      x.datenpunktId.length > 200 ||
      !("fassung" in x) ||
      typeof x.fassung !== "number" ||
      !Number.isSafeInteger(x.fassung) ||
      x.fassung < 1 ||
      !("korrektur" in x) ||
      ids.has(x.datenpunktId)
    ) {
      throw new DatenFehler(
        "ungueltig",
        "Jede Änderung braucht eine eindeutige Kennung und Datenfassung.",
      );
    }
    ids.add(x.datenpunktId);
    const korrektur = leseKorrektur(x.korrektur);
    if (korrektur.neuBerechnen && korrektur.quelleAktualisieren) {
      throw new DatenFehler(
        "ungueltig",
        "Neu berechnen und Quelle neu lesen sind getrennte Änderungen.",
      );
    }
    return { datenpunktId: x.datenpunktId, fassung: x.fassung, korrektur };
  });
}

export interface AenderungsKonflikt {
  readonly datenpunktId: string;
  readonly grund: string;
}

export interface AenderungsPlan {
  readonly vorher: ReadonlyMap<string, Datenpunkt>;
  readonly nachher: ReadonlyMap<string, Datenpunkt>;
  readonly geaendert: readonly string[];
  readonly konflikte: readonly AenderungsKonflikt[];
  readonly umgebung: DatenUmgebung;
}

/**
 * Alle ausdrücklichen Änderungen und ihre berechneten Nachfolger zusammen projizieren.
 * Nie speichern. Auch bei unverändertem Zahlenergebnis entsteht über PP-02 eine neue Fassung,
 * sobald eine Eingabefassung wechselt. Manuelle unabhängige Punkte werden nicht angefasst.
 */
export async function planeAenderungen(
  kandidaten: readonly Datenpunkt[],
  auftraege: readonly Aenderungsauftrag[],
  u: DatenUmgebung,
  h: Handelnder,
): Promise<AenderungsPlan> {
  const vorher = new Map<string, Datenpunkt>();
  for (const dp of kandidaten) {
    if (await vollLesbar(dp, u)) {
      vorher.set(dp.id, dp);
      if (vorher.size > 200) {
        throw new DatenFehler(
          "ungueltig",
          "Die Vorschau ist auf 200 lesbare Datenpunkte je Präsentation begrenzt.",
        );
      }
    }
  }
  // Eingaben rekursiv ergänzen, ohne fremde Datenpunkte als lesbar vorauszusetzen.
  const geladen = new Set<string>();
  const lade = async (dp: Datenpunkt, pfad = new Set<string>()): Promise<void> => {
    if (pfad.has(dp.id) || pfad.size > 8) {
      throw new DatenFehler("ungueltig", "Die Herkunftskette ist zyklisch oder zu tief.");
    }
    if (geladen.has(dp.id)) {
      return;
    }
    const weiter = new Set([...pfad, dp.id]);
    for (const e of dp.rechenweg?.eingaben ?? []) {
      const ein = vorher.get(e.datenpunktId) ?? (await u.datenpunkt(e.datenpunktId));
      if (!ein || !(await vollLesbar(ein, u))) {
        throw new DatenFehler("kein_zugriff", "Datenpunkt nicht gefunden.");
      }
      if (vorher.size >= 200 && !vorher.has(ein.id)) {
        throw new DatenFehler("ungueltig", "Zu viele Eingaben für diese Vorschau.");
      }
      vorher.set(ein.id, ein);
      await lade(ein, weiter);
    }
    geladen.add(dp.id);
  };
  for (const dp of [...vorher.values()]) {
    await lade(dp);
  }
  const explizit = new Map(auftraege.map((a) => [a.datenpunktId, a]));
  for (const a of auftraege) {
    const dp = vorher.get(a.datenpunktId);
    if (!dp) {
      throw new DatenFehler("kein_zugriff", "Datenpunkt nicht gefunden.");
    }
    if (dp.fassung !== a.fassung) {
      throw new VorschauKonflikt(
        "Die Datenfassung wurde geändert. Bitte neu laden; nichts wurde geändert.",
      );
    }
  }
  const nachher = new Map(vorher);
  const projiziert: DatenUmgebung = {
    ...u,
    datenpunkt: async (id) => nachher.get(id) ?? u.datenpunkt(id),
  };
  const konflikte: AenderungsKonflikt[] = [];
  const blockiert = new Set<string>();
  const fertig = new Set<string>();
  const geaendert: string[] = [];
  const besuche = async (dp: Datenpunkt): Promise<void> => {
    if (fertig.has(dp.id)) {
      return;
    }
    for (const e of dp.rechenweg?.eingaben ?? []) {
      const ein = vorher.get(e.datenpunktId);
      if (ein) {
        await besuche(ein);
      }
    }
    const a = explizit.get(dp.id);
    const eingaben = dp.rechenweg?.eingaben ?? [];
    const betroffen = eingaben.some(
      (e) => geaendert.includes(e.datenpunktId) || blockiert.has(e.datenpunktId),
    );
    if (a || betroffen) {
      try {
        if (eingaben.some((e) => blockiert.has(e.datenpunktId))) {
          throw new DatenFehler(
            "ungueltig",
            "Eine Eingabe hat einen offenen Änderungskonflikt. Zuerst dort klären.",
          );
        }
        const k = a?.korrektur ?? {
          neuBerechnen: true,
          grund: "PP-07: geänderte Eingabefassung nachrechnen (Vorschau).",
        };
        // Ein expliziter Bezugsrahmenwechsel am abgeleiteten Wert darf das Nachrechnen nicht auslassen.
        const neu = await korrigiere(
          dp,
          betroffen ? { ...k, neuBerechnen: true } : k,
          projiziert,
          h,
        );
        if (fingerabdruck(neu) !== fingerabdruck(dp)) {
          nachher.set(dp.id, neu);
          geaendert.push(dp.id);
        }
      } catch (f) {
        if (!(f instanceof DatenFehler)) {
          throw f;
        }
        // Ein Rechteverlust liefert niemals eine Teilvorschau mit alten vertraulichen Werten.
        if (f.art === "kein_zugriff") {
          throw f;
        }
        blockiert.add(dp.id);
        konflikte.push({ datenpunktId: dp.id, grund: f.message });
      }
    }
    fertig.add(dp.id);
  };
  for (const dp of vorher.values()) {
    await besuche(dp);
  }
  return { vorher, nachher, geaendert, konflikte, umgebung: projiziert };
}

export interface BindungsWirkung {
  readonly datenpunktId: string;
  readonly bindungId: string;
  readonly koId: string;
  readonly anhangId: string;
  readonly sldId: string;
  readonly shapeId: string;
  readonly folienPosition: number;
  readonly elementName: string;
  readonly zeile?: number;
  readonly spalte?: number;
  readonly dateiFassung?: string;
  readonly vorher: string;
  readonly nachher: string;
  readonly lage: "vorschau" | "bereits_aktuell" | "konflikt";
  readonly grund: string;
}

/** Nur lesbare Bindungen. Ein manueller Unterschied wird nie zur Ersetzung freigegeben. */
export async function bindungsWirkungen(
  plan: AenderungsPlan,
  u: DatenUmgebung,
): Promise<BindungsWirkung[]> {
  const wirkungen: BindungsWirkung[] = [];
  for (const id of plan.geaendert) {
    const dp = plan.vorher.get(id);
    const neu = plan.nachher.get(id);
    if (!dp || !neu) {
      continue;
    }
    for (const b of dp.bindungen) {
      if (!(await u.artikel(b.koId))) {
        continue;
      }
      const ziel = await u.folien(b.koId, b.anhangId);
      const befund = ziel ? elementBefund(dp, b, ziel.satz) : undefined;
      const passt = befund?.lage === "passt";
      const schonAktuell = !passt && ziel && elementBefund(neu, b, ziel.satz).lage === "passt";
      wirkungen.push({
        datenpunktId: id,
        bindungId: b.id,
        koId: b.koId,
        anhangId: b.anhangId,
        sldId: b.sldId,
        shapeId: b.shapeId,
        folienPosition: b.folienPosition,
        elementName: b.elementName,
        ...(b.zeile === undefined ? {} : { zeile: b.zeile, spalte: b.spalte }),
        ...(ziel ? { dateiFassung: ziel.satz.fassung } : {}),
        vorher: dp.wert,
        nachher: neu.wert,
        lage: passt ? "vorschau" : schonAktuell ? "bereits_aktuell" : "konflikt",
        grund: passt
          ? "Der bisher gebundene Wert ist vorhanden. Die Vorschau hat die Datei noch nicht geändert."
          : schonAktuell
            ? "Der vorgeschlagene Wert ist bereits vorhanden. An dieser Stelle ist keine Ersetzung nötig."
            : befund?.lage === "abweichung"
              ? "Der Folieninhalt weicht vom gebundenen Wert ab. Manuelle Änderung erhalten und ausdrücklich klären."
              : "Das gebundene Element oder sein Anhang fehlt. Ziel vor einer Übernahme erneut zuordnen.",
      });
    }
  }
  return wirkungen;
}

/** Produktantwort mit den unveränderten PP-02/03-Sichten beider Datenfassungen. */
export async function aenderungsVorschau(
  kandidaten: readonly Datenpunkt[],
  auftraege: readonly Aenderungsauftrag[],
  u: DatenUmgebung,
  ablage: DatenpunktAblage,
  h: Handelnder,
  jetzt: number,
) {
  const plan = await planeAenderungen(kandidaten, auftraege, u, h);
  const overlay: DatenpunktAblage = {
    ...ablage,
    lesen: plan.umgebung.datenpunkt,
    vonArtikel: async (id) => (await ablage.vonArtikel(id)).map((d) => plan.nachher.get(d.id) ?? d),
    gebundenAn: async (id, anhang) =>
      (await ablage.gebundenAn(id, anhang)).map((d) => plan.nachher.get(d.id) ?? d),
    anlegen: async () => {
      throw new Error("Vorschau schreibt nicht.");
    },
    ersetzen: async () => {
      throw new Error("Vorschau schreibt nicht.");
    },
  };
  const altKontrolle = kontrollAnschluss(u, ablage, () => jetzt);
  const neuKontrolle = kontrollAnschluss(plan.umgebung, overlay, () => jetzt);
  const aenderungen = [];
  for (const id of plan.geaendert) {
    const alt = plan.vorher.get(id);
    const neu = plan.nachher.get(id);
    if (!alt || !neu) {
      continue;
    }
    const vorher = await sicht(alt, u);
    const nachher = await sicht(neu, plan.umgebung);
    if (!vorher || !nachher) {
      throw new DatenFehler("kein_zugriff", "Datenpunkt nicht gefunden.");
    }
    aenderungen.push({
      vorher: await altKontrolle.kontrolliert(alt, vorher),
      nachher: await neuKontrolle.kontrolliert(neu, nachher),
      ausloeser: auftraege.some((a) => a.datenpunktId === id)
        ? ("ausdruecklich" as const)
        : ("eingabe" as const),
    });
  }
  const wirkungen = await bindungsWirkungen(plan, u);
  const basis = [...plan.vorher.values()].map((d) => ({
    id: d.id,
    fassung: d.fassung,
    stand: d.stand,
    fingerabdruck: fingerabdruck(d),
  }));
  return {
    art: "vorschau" as const,
    gespeichert: false as const,
    basis,
    aenderungen,
    wirkungen,
    konflikte: plan.konflikte,
    abdruck: createHash("sha256")
      .update(
        JSON.stringify({
          basis,
          auftraege,
          wirkungen,
          konflikte: plan.konflikte,
          projektion: aenderungen.map((a) => ({
            id: a.nachher.id,
            fassung: a.nachher.fassung,
            fingerabdruck: fingerabdruck(plan.nachher.get(a.nachher.id) as Datenpunkt),
          })),
        }),
      )
      .digest("hex"),
    // Keine Attrappe eines Übernehmen-Knopfs: PP-05 muss tatsächlich schreibbar angebunden sein.
    uebernahme: {
      verfuegbar: false as const,
      grund:
        "Diese reine Datenvorschau verändert noch keine Datei. Die bewusste Dateiübernahme hat einen weiteren eigenen Prüfschritt.",
    },
    grenzen: [
      "Suchraum: Datenpunkte dieses Artikels, an diesen Anhang gebundene Datenpunkte und ihre Eingaben. Kein globaler Nachfolgerindex.",
      "Diagramme, freie abgeleitete Aussagen und Sprechernotizen sind im vorhandenen Dateivertrag noch nicht bindbar. Diese Vorkommen müssen zusätzlich geprüft werden.",
      "Kurze und ausführliche Deckfassungen brauchen den festen PP-05-Deckvertrag. Diese Vorschau erzeugt oder aktualisiert keine Deckfassung.",
    ],
  };
}
