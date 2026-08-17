// ================================================================================================
// JOB 924 · D6 — DER ZUGANGS-ZUSTAND ALS DIENST. EINE ANTWORT, EINE QUELLE JE TATSACHE.
// ================================================================================================
//
// WARUM ES DIESEN DIENST GIBT — und warum `build-app.ts` bis heute das Gegenteil behauptete
// („einen Dienst darum gibt es (noch) nicht, und einen zu erfinden, nur damit die Form stimmt,
// waere eine Schicht ohne Aufgabe"). Das stimmte, solange die Route drei lokale Tatsachen
// zusammensetzte: Schalter, Variablenzustand, HTTPS-Riegel. Mit der VIERTEN — dem letzten
// erfolgreichen Import aus der Laufablage — stimmt es nicht mehr. Die Route muesste sonst ein
// Repository kennen, und BEN7s Pruefluecke 2 verlangt genau das Gegenteil: „Die Route darf
// ausschliesslich den ImportAccessService kennen; direkter Repositoryzugriff oder ein zweiter
// optionaler Zeitwertpfad muss typseitig unmoeglich sein."
//
// Diese Datei macht das STRUKTURELL wahr, nicht per Absprache: Sie liefert die VOLLSTAENDIGE
// Antwort. Die Route hat danach keinen Grund mehr, irgendetwas anderes zu importieren — kein
// Repository, keinen Schalterleser, keinen Umgebungsleser. Was sie nicht kennt, kann sie nicht
// versehentlich zur zweiten Wahrheit machen.
//
// ================================================================================================
// WAS DIESER DIENST NICHT TUT.
// ================================================================================================
//
// KEIN AUFRUF AN CONFLUENCE. Die Antwort ist vollstaendig lokal ablesbar: Schalter, Anwesenheit der
// Variablen, HTTPS-Riegel, Laufablage. Kein neuer Egress, keine Verbindungspruefung auf Verdacht —
// dieselbe Zusage, die die Route seit mega67 traegt.
//
// KEIN GEHEIMNIS. Der Rueckgabetyp traegt keinen Platz fuer einen Wert (`{ name, present }`), und
// `confluenceCredentialState` gibt gar keinen her. Ein Wert kann hier nicht durchrutschen, weil es
// kein Feld gibt, in das er passte.
//
// KEINE BEHAUPTUNG UEBER JETZT. `lastConnectedAt` ist rueckblickend: „damals hat es funktioniert",
// nicht „es funktioniert". Ob die Verbindung in diesem Augenblick steht, wuesste nur ein Aufruf —
// und den macht diese Datei ausdruecklich nicht. Die Flaeche formuliert entsprechend (i18n).
import { confluenceCredentialState } from "../../../confluence";
import type { ImportRunRepo } from "../../../library-analytics";
import { schalterAn } from "../feature-flags";

/** Das Quellsystem dieser Auskunft. Eine Auskunft, ein System — `ImportRun.sourceSystem`. */
const SYSTEM = "confluence";

export interface ImportAccessDeps {
  /** Die Laufablage. NICHT optional: ein zweiter, zeitloser Pfad waere die Luecke selbst. */
  readonly importRuns: ImportRunRepo;
}

export interface ImportAccessStatus {
  readonly system: string;
  readonly enabled: boolean;
  readonly credentials: { name: string; present: boolean }[];
  readonly credentialsUsable: boolean;
  readonly blocker: "missing" | "insecure-base-url" | null;
  /**
   * Der letzte belegte erfolgreiche Import — ISO-Zeichenkette, wie sie in der Ablage steht, oder
   * `null`. `null` ist eine AUSSAGE („dazu ist nichts belegt") und kein Platzhalter.
   */
  readonly lastConnectedAt: string | null;
}

export class ImportAccessService {
  constructor(private readonly deps: ImportAccessDeps) {}

  async zugangsstatus(): Promise<ImportAccessStatus> {
    const credentials = confluenceCredentialState();
    return {
      system: SYSTEM,
      // Schalter aus ⇒ die Import-Routen existieren gar nicht. Diese Auskunft steht bewusst davor.
      enabled: schalterAn("confluenceImport"),
      credentials: credentials.vars,
      credentialsUsable: credentials.usable,
      blocker: credentials.blocker,
      lastConnectedAt: await this.letzteVerbindung(),
    };
  }

  /**
   * FAELLT DIE ABLAGE AUS, IST DIE ANTWORT `null` — und die Auskunft antwortet trotzdem.
   *
   * Die Begruendung ist nicht Bequemlichkeit: Drei der vier Tatsachen dieser Antwort (Schalter,
   * Variablen, HTTPS-Riegel) sind lokal und weiterhin wahr. Ein 500 wegen der vierten naehme dem
   * Admin genau die Auskunft weg, fuer die diese Flaeche gebaut wurde — „warum geht diese Kachel
   * nicht?" — und zwar in dem Moment, in dem etwas kaputt ist. `null` heisst hier dasselbe wie
   * ueberall in diesem Vertrag: dazu ist nichts belegt.
   *
   * DER FEHLER WIRD NICHT WEITERGEREICHT, auch nicht als Text. Eine Repository-Meldung kann eine
   * Verbindungszeichenkette enthalten, und die traegt Zugangsdaten. Deshalb faengt diese Zeile den
   * Fehler und gibt nichts von ihm heraus — BEN7s Pruefluecke 5.
   */
  private async letzteVerbindung(): Promise<string | null> {
    try {
      return await this.deps.importRuns.findLastSuccessAt(SYSTEM);
    } catch {
      return null;
    }
  }
}
