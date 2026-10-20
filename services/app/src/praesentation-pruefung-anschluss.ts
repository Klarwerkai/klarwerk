// ================================================================================================
// KLARA POWERPOINT · PP-03 — ANSCHLUSS DER DATENKONTROLLE AN DIE PP-02-ROUTEN.
// ================================================================================================
//
// Auftrag `produkt:20261015:klara-powerpoint-validierung`, `PP-03-VALIDIERUNG.md` Abschnitt 4. Aus
// der PP-02-Umgebung EINER Anfrage (`DatenUmgebung`, Rechte des Handelnden) und der PP-02-Ablage
// entsteht die `KontrollUmgebung` der Kontrollen (`praesentation-pruefung.ts`); jede Sicht der
// AKTUELLEN Datenfassung erhält ihre `kontrolle`.
//
// KEIN ZWEITER WEG. Kein zweiter Datenpunkt, keine zweite Ablage, keine zweite Rechteprüfung:
//   · Artikel und Folien nur über `DatenUmgebung` (`ko.read` + `darfSehen`, wie PP-02).
//   · Verglichen wird nur mit Datenpunkten, die der Handelnde VOLLSTÄNDIG lesen darf (`vollLesbar`)
//     — aus demselben Kontext: Heimatartikel, die Präsentationen, an die der Datenpunkt gebunden
//     ist und die der Handelnde lesen darf (wie PP-02: ohne Leserecht keine Auskunft über eine
//     Bindung), und die Quellpräsentation.
//   · Der Zustand einer Eingabe ist ihre eigene Datenkontrolle in der VERWENDETEN Fassung
//     (`inFassung`), gebildet aus der PP-02-Sicht dieser Fassung (Prüfstand mit Namen und Arbeit,
//     rechtegeprüfte Bindungen) — strenger als der PP-02-Prüfstand allein: eine falsche Summe oder
//     eine abweichende Folie an der Eingabe lässt den berechneten Wert nicht als validiert gelten.
//     Nicht bis zum Ende prüfbar heißt „nicht lesbar“ (fail-closed).
//   · Auch eine frühere Datenfassung (`historisch`) trägt ihre Kontrolle — dieselbe, mit der ein
//     berechneter Wert sie als Eingabe beurteilt. So zeigt dieselbe Fassung nie zwei Zustände. Prüfen
//     und Korrigieren gelten weiterhin nur der aktuellen Fassung (PP-02).
// Nichts wird geschrieben; die Uhr wird je Anfrage einmal gelesen.

import {
  type DatenUmgebung,
  type Datenpunkt,
  type DatenpunktSicht,
  inFassung,
  sicht,
  vollLesbar,
} from "./praesentation-daten";
import type { DatenpunktAblage } from "./praesentation-daten-ablage";
import {
  type Datenkontrolle,
  type KontrollDatenpunkt,
  type KontrollUmgebung,
  datenkontrolle,
} from "./praesentation-pruefung";

/** Wie tief Eingabeketten verfolgt werden — dieselbe Grenze wie PP-02 (`KETTENTIEFE`). */
const KETTENTIEFE = 8;

export type KontrollierteSicht = DatenpunktSicht & { readonly kontrolle?: Datenkontrolle };

export interface KontrollAnschluss {
  /** Die Sicht mit `kontrolle` der gezeigten Datenfassung (`dp` ist genau diese Fassung). */
  kontrolliert(dp: Datenpunkt, s: DatenpunktSicht): Promise<KontrollierteSicht>;
}

export function kontrollAnschluss(
  u: DatenUmgebung,
  ablage: DatenpunktAblage,
  uhr: () => number,
): KontrollAnschluss {
  let stempel: number | undefined;
  const jetzt = () => {
    stempel ??= uhr();
    return stempel;
  };
  // Je Anfrage nur einmal: Listen der Ablage, Lesbarkeit und Zustände von Eingaben.
  const listen = new Map<string, Promise<Datenpunkt[]>>();
  const lesbar = new Map<string, Promise<boolean>>();
  const zustaende = new Map<string, Promise<Datenkontrolle | undefined>>();
  const roh = new Map<string, Datenpunkt>();

  const liste = (schluessel: string, holen: () => Promise<Datenpunkt[]>) => {
    let l = listen.get(schluessel);
    if (!l) {
      l = holen();
      listen.set(schluessel, l);
    }
    return l;
  };
  const vollLesbarMerk = (dp: Datenpunkt) => {
    let l = lesbar.get(dp.id);
    if (!l) {
      l = vollLesbar(dp, u);
      lesbar.set(dp.id, l);
    }
    return l;
  };

  async function vergleichbare(dp: KontrollDatenpunkt): Promise<readonly KontrollDatenpunkt[]> {
    // Die Bindungen DIESER Fassung (eine frühere Fassung trägt nur ihre damaligen Bindungen).
    const eigen = roh.get(`${dp.id}@${dp.fassung}`) ?? (await u.datenpunkt(dp.id));
    const quellen: Promise<Datenpunkt[]>[] = [
      liste(`artikel:${dp.heimatKoId}`, () => ablage.vonArtikel(dp.heimatKoId)),
    ];
    const praesentationen = new Set<string>();
    for (const b of eigen?.bindungen ?? []) {
      // Nur Präsentationen, die der Handelnde lesen darf — sonst verriete der Vergleich eine Bindung.
      if (await u.artikel(b.koId)) {
        praesentationen.add(`${b.koId}\u0000${b.anhangId}`);
      }
    }
    if (dp.quelle?.anhangId) {
      praesentationen.add(`${dp.quelle.koId}\u0000${dp.quelle.anhangId}`);
    }
    for (const p of praesentationen) {
      const [koId = "", anhangId = ""] = p.split("\u0000");
      quellen.push(liste(`anhang:${p}`, () => ablage.gebundenAn(koId, anhangId)));
    }
    const kandidaten = new Map<string, Datenpunkt>();
    for (const l of await Promise.all(quellen)) {
      for (const x of l) {
        if (x.id !== dp.id) {
          kandidaten.set(x.id, x);
        }
      }
    }
    const ergebnis: Datenpunkt[] = [];
    for (const x of kandidaten.values()) {
      if (await vollLesbarMerk(x)) {
        ergebnis.push(x);
      }
    }
    return ergebnis;
  }

  function umgebung(tiefe: number): KontrollUmgebung {
    return {
      artikel: (koId) => u.artikel(koId),
      folien: (koId, anhangId) => u.folien(koId, anhangId),
      vergleichbare,
      async eingabeZustand(datenpunktId, fassung) {
        const k = await eingabeKontrolle(datenpunktId, fassung, tiefe);
        const ein = k ? await u.datenpunkt(datenpunktId) : undefined;
        const damals = ein ? inFassung(ein, fassung) : undefined;
        return k && damals ? { zustand: k.zustand, wert: damals.wert } : undefined;
      },
      get jetzt() {
        return jetzt();
      },
    };
  }

  function eingabeKontrolle(
    id: string,
    fassung: number,
    tiefe: number,
  ): Promise<Datenkontrolle | undefined> {
    // Die Tiefe gehört zum Schlüssel: ein bei geringer Resttiefe fail-closed gebildeter Zustand darf
    // nicht für einen Aufruf mit mehr Tiefe wiederverwendet werden.
    const schluessel = `${id}@${fassung}#${tiefe}`;
    let z = zustaende.get(schluessel);
    if (!z) {
      z = (async () => {
        if (tiefe <= 0) {
          return undefined; // Nicht bis zum Ende prüfbar: fail-closed.
        }
        const ein = await u.datenpunkt(id);
        if (!ein || !(await vollLesbarMerk(ein))) {
          return undefined;
        }
        const damals = inFassung(ein, fassung);
        // Die PP-02-Sicht dieser Fassung: Prüfstand mit Namen und Arbeit, rechtegeprüfte Bindungen.
        // Tiefe 0: die Eingaben DIESER Eingabe werden hier nicht als Sicht gebraucht.
        const s = damals ? await sicht(damals, u, 0, ein.fassung) : undefined;
        if (!damals || !s) {
          return undefined;
        }
        roh.set(`${damals.id}@${damals.fassung}`, damals);
        return datenkontrolle(damals, s.pruefstand, umgebung(tiefe - 1), s.bindungen);
      })();
      zustaende.set(schluessel, z);
    }
    return z;
  }

  return {
    async kontrolliert(dp, s) {
      if (s.fassung !== dp.fassung || s.id !== dp.id) {
        return s; // Sicht und Datenpunkt passen nicht zusammen: keine Aussage.
      }
      roh.set(`${dp.id}@${dp.fassung}`, dp);
      const kontrolle = await datenkontrolle(dp, s.pruefstand, umgebung(KETTENTIEFE), s.bindungen);
      return { ...s, kontrolle };
    },
  };
}
