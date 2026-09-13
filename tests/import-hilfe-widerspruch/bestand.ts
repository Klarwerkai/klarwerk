// ================================================================================================
// JOB 3834 · DER STAND DER PRÜFLISTE — DIE EINZIGE ATTRAPPE DIESES ORDNERS.
// ================================================================================================
//
// WAS HIER STEHT: der serverseitige Stand der Import-Prüfliste und die Attrappe der
// ENDPUNKTGRENZE. Sonst ist an der Bühne nichts gefälscht — Seite, i18n, React-Query, Router und
// die Seitenhilfe-Sammelstelle sind echt (Bauform übernommen aus
// `tests/seitenhilfe-navkapitel/die-texte-stimmen-mit-der-seite.test.tsx`, Fall K3a).
//
// WARUM EINE EIGENE DATEI UND NICHT IN `buehne.tsx`: die `vi.mock`-Fabrik der Testdatei muss diesen
// Stand holen, BEVOR das Produkt geladen ist. Läge er in `buehne.tsx` (die `pages/Stufe2` und damit
// `api/endpoints` zieht), holte die Fabrik ein Modul, das gerade selbst lädt — ein Ringschluss, der
// je nach Auswertungsreihenfolge einmal trägt und einmal nicht. Diese Datei kennt kein Produkt und
// kein DOM; sie ist deshalb aus jeder Richtung gefahrlos ladbar.
//
// DREI ZUSTÄNDE, ABSICHTLICH GETRENNT (Lehre 3825 R1: ein Fehlerobjekt ist keine leere
// Trefferliste): Bestand mit Kandidaten · erfolgreich LEER · gescheiterter Abruf. Der letzte wirft
// wirklich, statt `[]` zu liefern — nur so kann ein Fall am Fehlerzustand rot werden.
import { vi } from "vitest";

/** Ein Kandidat, wie ihn `GET /import-candidates` ausliefert (`api/types.ts: ImportCandidate`). */
export interface ProbeKandidat {
  id: string;
  item: { title: string; statement: string; category: string; source: string };
  status: string;
  duplicate: boolean;
  note: string | null;
  koId: string | null;
  createdAt: string;
}

function kopie(k: ProbeKandidat): ProbeKandidat {
  return { ...k, item: { ...k.item } };
}

const bestand: ProbeKandidat[] = [];
let abrufFehler: string | null = null;

/**
 * `GET /import-candidates` — gibt AUS, was gerade im Bestand liegt, ohne Statusfilter (so wie
 * `listImportCandidates` in `services/library-analytics/src/service.ts`: `this.candidates.all()`).
 * Ist ein Abruffehler gesetzt, WIRFT der Aufruf; die Seite geht dann in ihren Fehlerzustand.
 */
export const listeAufruf = vi.fn(async (): Promise<ProbeKandidat[]> => {
  if (abrufFehler !== null) {
    throw new Error(abrufFehler);
  }
  return bestand.map(kopie);
});

/** Setzt den Stand der Prüfliste und nimmt einen gesetzten Abruffehler zurück. */
export function setzeBestand(neu: readonly ProbeKandidat[]): void {
  bestand.length = 0;
  bestand.push(...neu.map(kopie));
  abrufFehler = null;
}

/** Der nächste Abruf scheitert mit dieser Meldung — der Fehlerzustand aus §9 des Auftrags. */
export function setzeAbrufFehler(meldung: string): void {
  abrufFehler = meldung;
}

/** Der Stand, wie der Server ihn gerade hält — für die Diagnose einer roten Messung. */
export function lesBestand(): ProbeKandidat[] {
  return bestand.map(kopie);
}

export const TITEL_A = "JOB 3834 Probe-Vorschlag A";
export const TITEL_B = "JOB 3834 Probe-Vorschlag B";

/** Zwei OFFENE Kandidaten — offen im Sinne von `isOpenImportCandidate` (Status `neu`). */
export function zweiOffeneKandidaten(): ProbeKandidat[] {
  return [
    {
      id: "job3834-a",
      item: { title: TITEL_A, statement: "Aussage A", category: "probe", source: "probe" },
      status: "neu",
      duplicate: false,
      note: null,
      koId: null,
      createdAt: "2026-09-13T08:00:00.000Z",
    },
    {
      id: "job3834-b",
      item: { title: TITEL_B, statement: "Aussage B", category: "probe", source: "probe" },
      status: "neu",
      duplicate: false,
      note: null,
      koId: null,
      createdAt: "2026-09-13T08:01:00.000Z",
    },
  ];
}

/**
 * Die Attrappe für `apps/web/src/api/endpoints`. Alles, was diese Fälle NICHT messen, antwortet
 * leer — aber es ANTWORTET: ohne den Rückfall stürzte die Import-Seite an der ersten unbekannten
 * Ecke ab, und die Fälle messen nichts mehr.
 */
export function endpointsAttrappe(): unknown {
  const leer = (): unknown =>
    new Proxy(
      vi.fn(async () => []),
      {
        get(ziel, name, empfaenger) {
          if (name in ziel || typeof name === "symbol") {
            return Reflect.get(ziel, name, empfaenger);
          }
          return leer();
        },
      },
    );
  const mitRueckfall = (echt: Record<string, unknown>): unknown =>
    new Proxy(echt, {
      get(ziel, name, empfaenger) {
        if (name in ziel || typeof name === "symbol") {
          return Reflect.get(ziel, name, empfaenger);
        }
        return leer();
      },
    });
  return mitRueckfall({
    // `null` und nicht `[]`: der Zugangskasten des Imports zeigt ohne Auskunft GAR NICHTS
    // (`components/ImportAccessPanel.tsx`) — der ehrliche Zustand für einen Lauf, der ihn nicht misst.
    importAccess: mitRueckfall({ confluence: vi.fn(async () => null) }),
    library: mitRueckfall({
      importCandidates: mitRueckfall({ list: listeAufruf }),
    }),
  });
}
