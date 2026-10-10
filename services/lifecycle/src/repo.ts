import type { TxContext } from "../../db-tx";
import {
  type LearningPath,
  type MerkerErgebnis,
  type OffenerFall,
  type RevalidierungsAnlass,
  istDauerhaft,
} from "./types";

// Modul-interner Speicher für Anlagenkopplungen, Re-Validierungs-Marker, Lernpfade & Fortschritt.
export interface LifecycleRepo {
  addCoupling(assetRef: string, koId: string): Promise<void>;
  couplingsFor(assetRef: string): Promise<string[]>;
  // FR-LIF-01 / Audit B1 (02.07.2026): Rück-Richtung fürs KO-Detail — welche Anlagen sind gekoppelt?
  couplingsForKo(koId: string): Promise<string[]>;
  /**
   * Setzt den Merker bzw. hängt einen Anlass an den offenen Fall (produkt:20261010:
   * aenderungsfolgen-sichtbar). EIN Schritt in der Ablage, damit zwei gleichzeitige Meldungen
   * weder einen Anlass verlieren noch denselben Stand zweimal vergeben:
   *  - der Stand ist je Eintrag über Abschlüsse hinweg eindeutig (Nacharbeit 4): ein neuer Fall
   *    nach einem Abschluss beginnt beim nächsten unbenutzten Stand, nie wieder bei 1;
   *  - ein Anlass mit derselben `signatur` steht am offenen Fall → nichts ändert sich, `neu: false`;
   *  - eine Änderung MIT Änderungsbeleg, die schon einmal verarbeitet wurde (auch vor einem
   *    Abschluss) → nichts ändert sich, `neu: false`;
   *  - sonst → der Anlass wird angehängt bzw. der Fall eröffnet, der Stand steigt.
   * Ohne Anlass (Altaufrufer) wird nur ein fehlender Merker gesetzt, ein vorhandener bleibt.
   */
  markPending(koId: string, anlass?: RevalidierungsAnlass): Promise<MerkerErgebnis>;
  /**
   * Entfernt den Merker und sagt, ob einer da war. Aufnahme gesamt-auditprotokoll (Lauf 2): mit `tx`
   * läuft das Löschen auf dem Transaktionsclient der Revision (`LifecycleService.confirmStillValid`)
   * — Merker, Fassung und `ko.revalidated` committen oder verschwinden gemeinsam.
   *
   * produkt:20261010:aenderungsfolgen-sichtbar: mit `stand` wird NUR genau dieser Stand entfernt.
   * Ist inzwischen ein neuer Anlass eingegangen, bleibt der Fall stehen und die Antwort ist `false`.
   */
  clearPending(koId: string, tx?: TxContext, stand?: number): Promise<boolean>;
  /**
   * produkt:20261010:aenderungsfolgen-sichtbar: die offenen Fälle mit Stand und Anlässen —
   * SCHREIBFREI. Ohne Kennungen der ganze Bestand, mit Kennungen nur deren Teilmenge (eine leere
   * Liste macht keine Abfrage). Mit `tx` auf dem Transaktionsclient der Bestätigung.
   */
  offeneFaelle(koIds?: readonly string[], tx?: TxContext): Promise<OffenerFall[]>;
  /**
   * Setzt einen zuvor gelesenen Fall unverändert wieder ein, falls er fehlt — nur für die Rücknahme
   * einer gescheiterten Bestätigung ohne Transaktion (Speicherbetrieb). Ein inzwischen neu
   * entstandener Fall bleibt, wie er ist.
   */
  restorePending(fall: OffenerFall): Promise<void>;
  pending(): Promise<string[]>;
  /**
   * JOB 3054: die Merkerlage EINER BEKANNTEN MENGE von Objekten — schreibfrei und in EINER Abfrage.
   *
   * WARUM NEBEN `pending()` UND NICHT AN SEINER STELLE. Beide Formen haben einen echten Aufrufer,
   * und keiner ist der billigere Fall des anderen: der Arbeitsbereich fragt „welche Objekte stehen
   * ueberhaupt an?" und braucht dafuer den ganzen Bestand (`LifecycleService.pendingRevalidation`,
   * samt Selbstheilung nach SCRUM-420); die zwei Leserouten fragen „steht DIESES Objekt an?" fuer
   * Kennungen, die sie schon in der Hand haben. Ueber `pending()` gefuehrt hiesse das, fuer eine
   * Teilmenge den ganzen Bestand zu laden — im Betrieb genau die Last, die der Deckel der Liste
   * begrenzen soll.
   *
   * EINE LEERE KENNUNGSLISTE MACHT KEINE ABFRAGE und gibt `[]` zurueck: `= ANY('{}')` ist eine
   * Anweisung, die nie eine Zeile treffen kann (dieselbe Zusage wie `RatingRepo.listByKos`).
   *
   * Die Antwort ist die TEILMENGE der uebergebenen Kennungen mit gesetztem Merker — nie mehr.
   */
  pendingFor(koIds: readonly string[]): Promise<string[]>;
  savePath(path: LearningPath): Promise<void>;
  getPathByRole(role: string): Promise<LearningPath | undefined>;
  setProgress(pathId: string, userId: string, completed: string[]): Promise<void>;
  getProgress(pathId: string, userId: string): Promise<string[]>;
}

export class InMemoryLifecycleRepo implements LifecycleRepo {
  private readonly couplings = new Map<string, Set<string>>();
  private readonly faelle = new Map<string, OffenerFall>();
  private readonly verlauf = new Map<string, { letzter: number; signaturen: Set<string> }>();
  private readonly paths = new Map<string, LearningPath>();
  private readonly progress = new Map<string, string[]>();

  addCoupling(assetRef: string, koId: string): Promise<void> {
    const set = this.couplings.get(assetRef) ?? new Set<string>();
    set.add(koId);
    this.couplings.set(assetRef, set);
    return Promise.resolve();
  }

  couplingsFor(assetRef: string): Promise<string[]> {
    return Promise.resolve([...(this.couplings.get(assetRef) ?? [])]);
  }

  couplingsForKo(koId: string): Promise<string[]> {
    const assets: string[] = [];
    for (const [assetRef, koIds] of this.couplings) {
      if (koIds.has(koId)) {
        assets.push(assetRef);
      }
    }
    return Promise.resolve(assets);
  }

  // Nacharbeit 4 (Ben): dieselbe Regel wie `PgLifecycleRepo.markPending` — Stand über Abschlüsse
  // hinweg eindeutig, Änderungen mit Beleg dauerhaft verarbeitet.
  markPending(koId: string, anlass?: RevalidierungsAnlass): Promise<MerkerErgebnis> {
    const verlauf = this.verlauf.get(koId) ?? { letzter: 0, signaturen: new Set<string>() };
    this.verlauf.set(koId, verlauf);
    const fall = this.faelle.get(koId);
    if (anlass && istDauerhaft(anlass) && verlauf.signaturen.has(anlass.signatur)) {
      return Promise.resolve({ stand: fall?.stand ?? verlauf.letzter, neu: false });
    }
    if (fall && (!anlass || fall.anlaesse.some((a) => a.signatur === anlass.signatur))) {
      return Promise.resolve({ stand: fall.stand, neu: false });
    }
    const stand = Math.max(verlauf.letzter, fall?.stand ?? 0) + 1;
    verlauf.letzter = stand;
    if (anlass && istDauerhaft(anlass)) {
      verlauf.signaturen.add(anlass.signatur);
    }
    if (fall) {
      if (anlass) {
        fall.anlaesse.push({ ...anlass });
      }
      fall.stand = stand;
    } else {
      this.faelle.set(koId, {
        koId,
        stand,
        seit: anlass?.am ?? null,
        anlaesse: anlass ? [{ ...anlass }] : [],
      });
    }
    return Promise.resolve({ stand, neu: true });
  }

  clearPending(koId: string, _tx?: TxContext, stand?: number): Promise<boolean> {
    const fall = this.faelle.get(koId);
    if (!fall || (stand !== undefined && fall.stand !== stand)) {
      return Promise.resolve(false);
    }
    return Promise.resolve(this.faelle.delete(koId));
  }

  offeneFaelle(koIds?: readonly string[]): Promise<OffenerFall[]> {
    const auswahl =
      koIds === undefined
        ? [...this.faelle.keys()]
        : [...new Set(koIds)].filter((id) => this.faelle.has(id));
    return Promise.resolve(
      auswahl.flatMap((id) => {
        const fall = this.faelle.get(id);
        return fall ? [{ ...fall, anlaesse: fall.anlaesse.map((a) => ({ ...a })) }] : [];
      }),
    );
  }

  restorePending(fall: OffenerFall): Promise<void> {
    if (!this.faelle.has(fall.koId)) {
      this.faelle.set(fall.koId, { ...fall, anlaesse: fall.anlaesse.map((a) => ({ ...a })) });
    }
    return Promise.resolve();
  }

  pending(): Promise<string[]> {
    return Promise.resolve([...this.faelle.keys()]);
  }

  pendingFor(koIds: readonly string[]): Promise<string[]> {
    if (koIds.length === 0) {
      return Promise.resolve([]);
    }
    return Promise.resolve([...new Set(koIds)].filter((koId) => this.faelle.has(koId)));
  }

  savePath(path: LearningPath): Promise<void> {
    this.paths.set(path.id, path);
    return Promise.resolve();
  }

  getPathByRole(role: string): Promise<LearningPath | undefined> {
    for (const path of this.paths.values()) {
      if (path.role === role) {
        return Promise.resolve(path);
      }
    }
    return Promise.resolve(undefined);
  }

  setProgress(pathId: string, userId: string, completed: string[]): Promise<void> {
    this.progress.set(`${pathId}:${userId}`, completed);
    return Promise.resolve();
  }

  getProgress(pathId: string, userId: string): Promise<string[]> {
    return Promise.resolve(this.progress.get(`${pathId}:${userId}`) ?? []);
  }
}
