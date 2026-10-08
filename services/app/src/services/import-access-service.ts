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
//
// ================================================================================================
// R-0134 / R-1005 — DER BETREIBERSCHALTER GEHÖRT IN DIESELBE AUSKUNFT.
// ================================================================================================
//
// Die Zugangsauskunft sagt seit mega67, ob der Import eingeschaltet ist. Seit dem Betreiberschalter
// (confluence-import-schalter.ts) hat „eingeschaltet" zwei Teile: die FREIGABE der Installation
// (Umgebung) und den BETREIBERSCHALTER (gespeichert, über die Oberfläche umlegbar). `enabled` ist
// beides zusammen — genau das, was die Importrouten durchsetzen. `betreiber` sagt, welcher Teil
// fehlt, damit die Fläche den richtigen Satz und den richtigen Knopf zeigt.
//
// GESETZT wird der Schalter ebenfalls HIER und nicht in der Route: die Route kennt weiterhin nur
// diesen Dienst (BEN7s Prüflücke 2), das Prüfprotokoll entsteht an derselben Stelle wie die Auskunft.
import type { AuditService } from "../../../audit";
import { confluenceCredentialState } from "../../../confluence";
import { jiraCredentialState } from "../../../jira";
import type { ImportRunRepo } from "../../../library-analytics";
import { sharepointCredentialState } from "../../../sharepoint";
import type { ConfluenceImportSchalterRepo } from "../confluence-import-schalter";
import { schalterAn } from "../feature-flags";

/** Das Quellsystem der Confluence-Auskunft. Eine Auskunft, ein System — `ImportRun.sourceSystem`. */
const SYSTEM = "confluence";
/** Dasselbe für SharePoint — wortgleich mit `ImportRun.sourceSystem` der Übernahme-Läufe. */
const SYSTEM_SHAREPOINT = "sharepoint";
/** R-0170: dasselbe für Jira — wortgleich mit `ImportRun.sourceSystem` der Jira-Übernahmen. */
const SYSTEM_JIRA = "jira";

export interface ImportAccessDeps {
  /** Die Laufablage. NICHT optional: ein zweiter, zeitloser Pfad waere die Luecke selbst. */
  readonly importRuns: ImportRunRepo;
  /**
   * Der Betreiberschalter des Confluence-Imports. Optional nur für direkte Testaufrufer, die ihn
   * nicht brauchen; ohne ihn gibt es keinen Betreiberschalter — `betreiber` fehlt dann in der
   * Antwort, und Setzen wird abgelehnt. Die Kompositionswurzel reicht ihn immer mit.
   */
  readonly betreiberSchalter?: ConfluenceImportSchalterRepo;
  readonly audit?: AuditService;
}

/** Warum das Umlegen nicht geht — die Route macht daraus einen ehrlichen Status. */
export type BetreiberSchalterAbweisung = "nicht-freigegeben" | "kein-schalter";

export interface ImportAccessStatus {
  readonly system: string;
  /** Freigegeben UND vom Betreiber eingeschaltet — genau das, was die Importrouten durchsetzen. */
  readonly enabled: boolean;
  /**
   * Nur Confluence: die zwei Teile von `enabled`. `freigegeben` = Umgebung der Installation,
   * `an` = Betreiberschalter. Fehlt, wenn kein Betreiberschalter verdrahtet ist.
   */
  readonly betreiber?: { readonly freigegeben: boolean; readonly an: boolean };
  readonly credentials: { name: string; present: boolean }[];
  readonly credentialsUsable: boolean;
  // R-0166: `invalid-auth-mode` bei Confluence (KLARWERK_CONFLUENCE_AUTH mit unbekanntem Wert) und
  // bei Jira (KLARWERK_JIRA_AUTH). R-0170: `invalid-project-key` nur bei Jira — der Projektschlüssel
  // steht in der Abfrage und muss die Jira-Schlüsselform haben.
  readonly blocker:
    | "missing"
    | "insecure-base-url"
    | "invalid-auth-mode"
    | "invalid-project-key"
    | null;
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
    // Freigabe aus ⇒ die Import-Routen existieren gar nicht. Diese Auskunft steht bewusst davor.
    const freigegeben = schalterAn("confluenceImport");
    const schalter = this.deps.betreiberSchalter
      ? await this.deps.betreiberSchalter.lies()
      : undefined;
    return {
      system: SYSTEM,
      enabled: freigegeben && (schalter?.an ?? true),
      ...(schalter ? { betreiber: { freigegeben, an: schalter.an } } : {}),
      credentials: credentials.vars,
      credentialsUsable: credentials.usable,
      blocker: credentials.blocker,
      lastConnectedAt: await this.letzteVerbindung(SYSTEM),
    };
  }

  /**
   * Legt den Betreiberschalter um und antwortet mit der neuen Auskunft.
   *
   * ABGELEHNT wird, wenn die Installation den Import gar nicht freigibt: ein „an", das nichts
   * bewirken kann, wäre eine Behauptung. Zugangsdaten nimmt dieser Weg NICHT entgegen — es gibt
   * nur `an: boolean`.
   */
  async setzeBetreiberSchalter(
    an: boolean,
    actor: string,
  ): Promise<ImportAccessStatus | BetreiberSchalterAbweisung> {
    const schalter = this.deps.betreiberSchalter;
    if (!schalter) {
      return "kein-schalter";
    }
    if (!schalterAn("confluenceImport")) {
      return "nicht-freigegeben";
    }
    const { vorher, nachher } = await schalter.setze(an);
    await this.deps.audit?.record({
      actor,
      action: "confluence-import.betreiberschalter",
      target: "settings",
      payload: { vorherAn: vorher.an, an: nachher.an, version: nachher.version },
    });
    return this.zugangsstatus();
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
   * R-0170: derselbe Satz Zustände für Jira. KEIN AUFRUF AN JIRA — Schalter und Variablenzustand
   * sind lokal ablesbar, `lastConnectedAt` kommt aus der eigenen Laufablage.
   */
  async jiraZugangsstatus(): Promise<ImportAccessStatus> {
    const credentials = jiraCredentialState();
    return {
      system: SYSTEM_JIRA,
      // Schalter aus ⇒ die Import-Routen existieren gar nicht. Diese Auskunft steht bewusst davor.
      enabled: schalterAn("jiraImport"),
      credentials: credentials.vars,
      credentialsUsable: credentials.usable,
      blocker: credentials.blocker,
      lastConnectedAt: await this.letzteVerbindung(SYSTEM_JIRA),
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
