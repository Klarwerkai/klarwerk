// ================================================================================================
// AW-16 · SIMULIERTE ZUGÄNGE — AUSDRÜCKLICH KEIN PRODUKTDIENST.
// ================================================================================================
//
// Der Kalender liest Auftrag, Lauf, Ergebnis und Serie aus dem maßgeblichen Ausführungsnachweis und
// Termine aus dem vorhandenen Kalender (`AusfuehrungsNachweis`, `VorhandenerKalender` in
// `services/app/src/eigener-kalender.ts`). Beide Dienste gehören zu eigenen Aufträgen
// (Aufgaben-/Erinnerungssteuerung, `klara-kalender`) und sind im Produkt noch NICHT gebaut.
//
// Diese Datei stellt für die Prüfstände je eine steuerbare SIMULATION bereit. Sie belegt, dass der
// Kalender den Zugang richtig benutzt (Rechte der lesenden Person, nur Bestätigtes gilt, gefälschte
// Kennungen fallen durch) — NICHT, dass eine echte Erinnerung zugestellt, ein echter Lauf abgesagt
// oder ein echter Outlook-Kalender gelesen wurde. Alle Daten sind erfunden.
import type {
  AusfuehrungsNachweis,
  ExternerTermin,
  KalenderErgebnis,
  LaufStatus,
  VorhandenerKalender,
} from "../../services/app/src/eigener-kalender";
import type { SessionUser } from "../../services/app/src/http";

interface SimAuftrag {
  titel: string;
  /** `null`: für jede Person sichtbar. */
  sichtbarFuer: Set<string> | null;
}

interface SimLauf {
  status: LaufStatus;
  ergebnis: KalenderErgebnis | null;
}

export class SimulierterAusfuehrungsdienst implements AusfuehrungsNachweis {
  /** Jede WIRKUNG, die der Kalender angestossen hat — Lesungen stehen nicht darin. */
  readonly wirkungen: string[] = [];
  /** `false`: der Dienst lehnt jede Wirkung ab (nicht bestätigt). */
  bestaetigt = true;
  private readonly auftraege = new Map<string, SimAuftrag>();
  private readonly laeufe = new Map<string, SimLauf>();
  private readonly serien = new Map<string, { pausiert: boolean }>();

  auftragAnlegen(taskId: string, titel: string, sichtbarFuer?: string[]): void {
    const sichtbar = sichtbarFuer ? new Set(sichtbarFuer) : null;
    this.auftraege.set(taskId, { titel, sichtbarFuer: sichtbar });
  }

  laufSetzen(
    taskId: string,
    runId: string,
    status: LaufStatus,
    ergebnis: KalenderErgebnis | null = null,
  ): void {
    this.laeufe.set(`${taskId}|${runId}`, { status, ergebnis });
  }

  laufEntfernen(taskId: string, runId: string): void {
    this.laeufe.delete(`${taskId}|${runId}`);
  }

  serieAnlegen(seriesId: string, pausiert = false): void {
    this.serien.set(seriesId, { pausiert });
  }

  private sieht(user: SessionUser, taskId: string): SimAuftrag | null {
    const a = this.auftraege.get(taskId);
    return a && (a.sichtbarFuer === null || a.sichtbarFuer.has(user.id)) ? a : null;
  }

  async auftrag(user: SessionUser, taskId: string): Promise<{ titel: string } | null> {
    const a = this.sieht(user, taskId);
    return a ? { titel: a.titel } : null;
  }

  async lauf(
    user: SessionUser,
    taskId: string,
    runId: string,
  ): Promise<{ status: LaufStatus; ergebnis: KalenderErgebnis | null } | null> {
    if (!this.sieht(user, taskId)) {
      return null;
    }
    const l = this.laeufe.get(`${taskId}|${runId}`);
    return l ? { ...l } : null;
  }

  async serie(_user: SessionUser, seriesId: string): Promise<{ pausiert: boolean } | null> {
    const s = this.serien.get(seriesId);
    return s ? { ...s } : null;
  }

  private wechsel(taskId: string, runId: string, von: LaufStatus, nach: LaufStatus): boolean {
    const l = this.laeufe.get(`${taskId}|${runId}`);
    if (!this.bestaetigt || !l || l.status !== von) {
      return false;
    }
    l.status = nach;
    return true;
  }

  async laufAbsagen(user: SessionUser, taskId: string, runId: string): Promise<boolean> {
    this.wirkungen.push(`laufAbsagen:${user.id}:${taskId}:${runId}`);
    return this.wechsel(taskId, runId, "geplant", "abgesagt");
  }

  async arbeitAbbrechen(user: SessionUser, taskId: string, runId: string): Promise<boolean> {
    this.wirkungen.push(`arbeitAbbrechen:${user.id}:${taskId}:${runId}`);
    return this.wechsel(taskId, runId, "laeuft", "abgebrochen");
  }

  async serieSchalten(user: SessionUser, seriesId: string, pausiert: boolean): Promise<boolean> {
    this.wirkungen.push(`serieSchalten:${user.id}:${seriesId}:${pausiert}`);
    const s = this.serien.get(seriesId);
    if (!this.bestaetigt || !s) {
      return false;
    }
    s.pausiert = pausiert;
    return true;
  }
}

export class SimulierterVorhandenerKalender implements VorhandenerKalender {
  /** Wie oft der Kalender gelesen wurde. */
  lesungen = 0;
  verbunden = true;

  constructor(private readonly termine: ExternerTermin[]) {}

  async lies(
    _user: SessionUser,
    _von: string,
    _bis: string,
  ): Promise<{ verbunden: true; termine: ExternerTermin[] } | { verbunden: false }> {
    this.lesungen += 1;
    return this.verbunden ? { verbunden: true, termine: [...this.termine] } : { verbunden: false };
  }
}
