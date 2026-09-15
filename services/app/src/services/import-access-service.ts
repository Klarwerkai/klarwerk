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
//
// ================================================================================================
// JOB 4086 — ZWEI SYSTEME, EINE ANTWORTFORM. UND WARUM DAS KEINE ZWEITE AUSKUNFT IST.
// ================================================================================================
//
// SharePoint/OneDrive ist Adapter #2 desselben Import-Vertrags und braucht dieselbe Auskunft:
// Schalter, Anwesenheit der Zugangsdaten, HTTPS-Riegel, letzter belegter Erfolg. Sie bekommt sie
// hier — als ZWEITE METHODE mit DEMSELBEN Rückgabetyp, nicht als zweiter Dienst und nicht als
// zweiter Vertrag. Der Grund ist der Kopf dieser Datei: was die Route nicht kennt, kann sie nicht
// zur zweiten Wahrheit machen. Ein eigener SharePoint-Dienst wäre ein zweiter Ort, an dem jemand
// künftig „ist der Zugang da?" anders beantwortet.
//
// WARUM KEINE EINE METHODE MIT PARAMETER `system`: Der Vertrag je System ist NICHT austauschbar —
// welche Variablen ein Zugang braucht und wann ein Client zustande kommt, weiss ausschliesslich
// das jeweilige Modul (`confluenceCredentialState` bzw. `sharepointCredentialState`, Begründung
// dort). Eine Methode mit Schalter müsste diese Zuordnung hier führen, also eine dritte Stelle,
// die weiss, was Confluence und was SharePoint braucht. Zwei benannte Methoden sagen dasselbe,
// ohne diese Stelle zu erzeugen.
import { confluenceCredentialState } from "../../../confluence";
import type { ImportRunRepo } from "../../../library-analytics";
import { sharepointCredentialState } from "../../../sharepoint";
import { schalterAn } from "../feature-flags";

/** Das Quellsystem der Confluence-Auskunft. Eine Auskunft, ein System — `ImportRun.sourceSystem`. */
const SYSTEM = "confluence";
/** Dasselbe für SharePoint — wortgleich mit `ImportRun.sourceSystem` der Übernahme-Läufe. */
const SYSTEM_SHAREPOINT = "sharepoint";

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
      lastConnectedAt: await this.letzteVerbindung(SYSTEM),
    };
  }

  /**
   * Derselbe Satz Zustände für SharePoint/OneDrive.
   *
   * KEIN AUFRUF AN MICROSOFT GRAPH — dieselbe Zusage wie oben: Schalter und Variablenzustand sind
   * lokal ablesbar, `lastConnectedAt` kommt aus der eigenen Laufablage. Ob die hinterlegten
   * Zugangsdaten GÜLTIG sind, wüsste nur ein echter Abruf, und den macht diese Datei nicht.
   */
  async sharepointZugangsstatus(): Promise<ImportAccessStatus> {
    const credentials = sharepointCredentialState();
    return {
      system: SYSTEM_SHAREPOINT,
      // Schalter aus ⇒ die Import-Routen existieren gar nicht. Diese Auskunft steht bewusst davor.
      enabled: schalterAn("sharepointImport"),
      credentials: credentials.vars,
      credentialsUsable: credentials.usable,
      blocker: credentials.blocker,
      lastConnectedAt: await this.letzteVerbindung(SYSTEM_SHAREPOINT),
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
  private async letzteVerbindung(system: string): Promise<string | null> {
    try {
      return await this.deps.importRuns.findLastSuccessAt(system);
    } catch {
      return null;
    }
  }
}
