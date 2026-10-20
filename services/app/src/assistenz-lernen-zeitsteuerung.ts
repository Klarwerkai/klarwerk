// ================================================================================================
// produkt:20261011:assistenz-lernen-hostfortsetzung · BPA-06 AC05 — FÄLLIGE LÄUFE AUS DEM ZEITPLAN.
// ================================================================================================
//
// Ein Takt der VORHANDENEN Zeitsteuerung des Servers (`startTrashSweepScheduler` in `server.ts`,
// eigener Takt wie die Lückenerkennung) ruft `lauf()` auf. Kein zweiter Scheduler: hier gibt es
// keinen Timer, nur die Frage „was ist jetzt fällig?“ und den einen Laufweg.
//
// Je Routine mit Zeitplan:
//   1. pausiert → nichts (auch kein Nachholen; das Fortsetzen setzt `seit` neu, `vormachen.ts`);
//   2. fälliger Termin nach Zeitzone, Sommerzeit und Nachholregel (`assistenz-lernen-zeitplan.ts`);
//      erledigt ist ein Termin, wenn seine Laufkennung schon gebunden ist (dauerhaft, je Routine);
//   3. das Konto JETZT: besteht es, und darf es jetzt Entwürfe anlegen? (G04: aktuelle Rechte
//      gelten auch für Hintergrundläufe — nicht die Rolle beim Bestätigen);
//   4. derselbe Laufweg wie von Hand (`legeRoutinenLaufAn`): `planeLauf`, Brücke, gebundener Auftrag
//      im Zeitplan-Gespräch der Person — mit der Terminkennung als Laufkennung, also genau einmal.
// Abgelehnt (Rechte, Entscheidungspunkt, Außenwirkung, fehlende Eingabe) wird der Termin mit Grund
// vermerkt und nicht in jedem Takt erneut versucht. Ein vorübergehender Fehler wird erneut versucht.
//
//   5. NACHARBEIT 33 (Ben zu 4b1f3aee): der Auftrag wird sofort AUSGEFÜHRT — über den vorhandenen
//      Aktionskern (`KlaraAusfuehrung.fuehreAus`), mit dessen Prüfung vor der Wirkung (Pause,
//      Löschung, Fassung: `routineSperre`), Grenze, Rechten am Entwurfsweg und Nachlesen. Danach
//      die Ergebnisprüfung (`pruefeEntwurf`) am nachgelesenen Entwurf gegen den JETZT geprüften Plan.
//      Folgenreiche Schritte erreichen diese Stelle nie: ihr Plan hält vorher an (AC09).
// Die Ausführung selbst steckt `build-app.ts` ein (`fuehreAus`): die Türen der Anwendung mit einer
// kurzlebigen, nur prozessinternen Laufsitzung der Person — dieselbe Anmeldeprüfung wie jede
// Anfrage, sofort danach gelöscht. Ohne sie wird der Auftrag nur angelegt.
//
//   6. NACHARBEIT 41 (Ben zu 32e10b9d): Word-Routinen. Hinter einem Takt steht kein Word und keine
//      gebundene Markierung — ein fälliger Word-Termin wird deshalb NICHT im Hintergrund ausgeführt,
//      sondern bleibt anstehend (`anstehend`, dieselbe Fälligkeits- und Nachholregel). Die Person
//      startet ihn in Word; der Rand prüft die BPA-04-Bindung und ruft `fuehreHostlaufAus` — derselbe
//      `fuehreDurch` mit Konto- und Rechteprüfung JETZT, Wiederaufnahme und Ergebnisprüfung.
//   7. EQF-06-K05: „bei Ereignis“ (`naechstesEreignis`) — derselbe Takt fragt das vorhandene
//      Prüfprotokoll nach eigenen Ereignissen der gewählten Art seit dem Setzen; je Ereignis ein Lauf
//      über denselben Laufweg, Kennung = Sequenz des Eintrags.
import type { AuditService } from "../../audit";
import { can } from "../../rbac";
import { ROUTINEN_EREIGNISSE } from "./assistenz-lernen";
import { ROUTINEN_SCHRITT_BERICHT, pruefeEntwurf } from "./assistenz-lernen-auftrag";
import {
  LaufAbgelehnt,
  type RoutinenLaufAnfrage,
  type WordLaufHost,
  legeRoutinenLaufAn,
  planeRoutinenLauf,
} from "./assistenz-lernen-lauf";
import { faelligerTermin } from "./assistenz-lernen-zeitplan";
import { type KlaraGespraechDienst, KlaraGespraechFehler } from "./klara-gespraech";
import {
  type Routine,
  type RoutinenLauf,
  type VormachenDienst,
  VormachenFehler,
} from "./vormachen";

export const BPA06_ZEITPLAN_LAUF = "bpa06.zeitplan.lauf";
/** Nacharbeit 41: ein Lauf einer Word-Routine, von Hand in Word gestartet. */
export const BPA06_HOSTLAUF = "bpa06.hostlauf";
/** Nacharbeit 43: ein fälliger Word-Termin ist an den Host übergeben oder wartet auf den Start. */
export const BPA06_ZEITPLAN_WARTET = "bpa06.zeitplan.wartet";
/** Der eigene Takt der Zeitsteuerung für Routinen: eine Minute (`server.ts`). */
export const ROUTINEN_TAKT_MS = 60_000;
/** Fehlerschlüssel des Aktionskerns, die einen neuen Versuch rechtfertigen (Server, Anmeldung). */
const VORUEBERGEHEND: readonly string[] = ["server", "anmeldung"];
/** Höchstens so viele Ausführungsversuche je Lauf; danach endgültig nicht ausgeführt. */
export const ROUTINEN_MAX_VERSUCHE = 5;
/**
 * EQF-06-K05: so viele eigene Ereignisse liest eine Seite. Nacharbeit 52: ein Takt liest so viele
 * Seiten, bis er den dauerhaften Fortschritt erreicht — ein Rückstand geht nicht verloren.
 */
export const EREIGNISSE_JE_SEITE = 50;
/** Laufkennung eines Ereignislaufs: `zeitplan-e-<Sequenz des Prüfprotokolleintrags>`. */
const EREIGNIS_KENNUNG = "zeitplan-e-";

/** Was die Ausführung über den Aktionskern meldet — Schrittstand und nachgelesener Entwurf. */
export interface RoutinenAusfuehrung {
  readonly stand: string;
  readonly fehlerCode: string | null;
  readonly entwurf: Parameters<typeof pruefeEntwurf>[1] | null;
}

export type RoutinenAusfuehren = (a: {
  kontoId: string;
  gespraech: string;
  auftragId: string;
  /** Der Schritt des Aktionskerns — je Ausführungsversuch eigener Schlüssel. */
  schluessel: string;
}) => Promise<RoutinenAusfuehrung>;

export interface ZeitplanLaufErgebnis {
  readonly routineId: string;
  readonly kontoId: string;
  readonly termin: string;
  /**
   * `ausgefuehrt`: Bericht angelegt, nachgelesen und geprüft. `abweichung`: angelegt, aber die
   * Ergebnisprüfung fand Abweichungen. `nicht_ausgefuehrt`: Auftrag angelegt, Schritt nicht
   * gespeichert (Grund im Auftrag). `angelegt`/`wiederholt`: ohne Ausführungsweg nur angelegt.
   */
  readonly stand:
    | "ausgefuehrt"
    | "abweichung"
    | "nicht_ausgefuehrt"
    | "offen"
    | "angelegt"
    | "wiederholt"
    | "abgelehnt"
    | "fehler"
    // Nacharbeit 43: ein Word-Termin ist an den Host übergeben bzw. wartet auf den Start.
    | "wartet_auf_host";
  /** Ein unvollständiger früherer Lauf wurde unter seiner Kennung wieder aufgenommen. */
  readonly wiederaufnahme?: boolean;
  readonly auftragId?: string;
  /** Das Gespräch der Person, in dem der Auftrag liegt. */
  readonly gespraech?: string;
  /** Der angelegte Bericht (Entwurf). */
  readonly ergebnisId?: string;
  readonly abweichungen?: readonly string[];
  readonly grund?: string;
  /** Bei `abgelehnt`: der Status der Ablehnung (403 Recht, 409 Zustand) und ihr Text. */
  readonly status?: number;
  readonly text?: string;
}

/** Nacharbeit 43: ein anstehender Word-Termin und wie er an den Host geht. */
export interface HostUebergabe {
  readonly kennung: string;
  readonly art: "automatisch" | "von_hand";
}

export interface RoutinenZeitsteuerungDeps {
  readonly beschaffung?: (r: Routine, jetzt: number) => Promise<ZeitplanLaufErgebnis | null>;
  readonly vormachen: VormachenDienst;
  readonly klara: KlaraGespraechDienst;
  /** Das Konto JETZT — `undefined`, wenn es nicht mehr besteht. */
  readonly konto: (kontoId: string) => Promise<{ role: Parameters<typeof can>[0] } | undefined>;
  readonly audit?: AuditService;
  /** So spät darf ein Termin bei `auslassen` noch erreicht werden (Vorgabe: zwei Takte). */
  readonly toleranzMs?: number;
  /** Ausführung über den vorhandenen Aktionskern; ohne sie wird nur angelegt. */
  readonly fuehreAus?: RoutinenAusfuehren;
}

export class RoutinenZeitsteuerung {
  private laeuft: Promise<ZeitplanLaufErgebnis[]> | null = null;

  constructor(private readonly deps: RoutinenZeitsteuerungDeps) {}

  /** Ein Takt. Läuft schon einer, wird auf ihn gewartet (nie zwei gleichzeitig). */
  lauf(jetzt: number = Date.now()): Promise<ZeitplanLaufErgebnis[]> {
    if (!this.laeuft) {
      this.laeuft = this.arbeite(jetzt).finally(() => {
        this.laeuft = null;
      });
    }
    return this.laeuft;
  }

  private async arbeite(jetzt: number): Promise<ZeitplanLaufErgebnis[]> {
    const out: ZeitplanLaufErgebnis[] = [];
    for (const r of await this.deps.vormachen.routinenMitZeitplan()) {
      const e = r.beschaffung
        ? await this.deps.beschaffung?.(r, jetzt)
        : await this.einer(r, jetzt);
      if (e) {
        out.push(e);
        const aktion = e.stand === "wartet_auf_host" ? BPA06_ZEITPLAN_WARTET : BPA06_ZEITPLAN_LAUF;
        await this.protokolliere(r, e, aktion);
      }
    }
    return out;
  }

  /**
   * Der jetzt anstehende Zeitplanlauf einer Routine: zuerst ein offener (angelegt, nicht
   * abgeschlossen), sonst ein fälliger Termin nach Zeitzone, Sommerzeit und Nachholregel. `null`:
   * nichts steht an (auch nicht bei Pause).
   */
  anstehend(r: Routine, jetzt: number): { kennung: string; vorhanden: RoutinenLauf | null } | null {
    const z = r.zeitplan;
    const zl = r.zeitplanLauf;
    if (!z || !zl || r.zustand === "pausiert") {
      return null;
    }
    const laeufe = r.laeufe ?? [];
    // G12 (Nacharbeit 35): ein angelegter, aber nicht bestätigt abgeschlossener Zeitplanlauf wird
    // ZUERST wieder aufgenommen — unter derselben Lauf- und Auftragskennung, auch wenn sein Termin
    // längst vorbei ist. Ein neuer Termin wartet, bis er abgeschlossen ist.
    const offen = laeufe.find((l) => l.kennung.startsWith("zeitplan-") && !l.abgeschlossenAm);
    if (offen) {
      return { kennung: offen.kennung, vorhanden: offen };
    }
    // Erledigt für die Fälligkeit: jeder Termin mit Laufeintrag (abgeschlossen, s. oben) und jeder
    // abgelehnte.
    const erledigt = new Set([...laeufe.map((l) => l.kennung), ...(zl.abgelehnt ?? [])]);
    const toleranz = this.deps.toleranzMs ?? 2 * ROUTINEN_TAKT_MS;
    const termin = faelligerTermin(z, Date.parse(zl.seit), jetzt, (k) => erledigt.has(k), toleranz);
    return termin ? { kennung: termin.kennung, vorhanden: null } : null;
  }

  /**
   * Nacharbeit 43: wie ein anstehender Word-Termin an den Host geht. `automatisch`: die Person hat
   * beim Binden ausdrücklich freigegeben, dass fällige Termine in diesem Word ohne Klick laufen —
   * das geöffnete, gebundene Word-Fenster holt ihn mit seinem nächsten Abruf ab und führt ihn aus.
   * `von_hand`: ohne diese Freigabe wartet er auf den Start der Person.
   */
  uebergabe(r: Routine, jetzt: number): HostUebergabe | null {
    const a = r.host === "word" ? this.anstehend(r, jetzt) : null;
    if (!a) {
      return null;
    }
    return { kennung: a.kennung, art: r.hostbindung?.zeitplanImHost ? "automatisch" : "von_hand" };
  }

  private async einer(r: Routine, jetzt: number): Promise<ZeitplanLaufErgebnis | null> {
    // Nacharbeit 41/43: ein Word-Termin braucht den Inhalt des geöffneten, gebundenen Word
    // (Markierung bzw. Dokument) — hinter einem Takt steht er nicht. Der Takt übergibt ihn
    // deshalb an den Host (`uebergabe`): Mit Freigabe führt das gebundene Word-Fenster ihn beim
    // nächsten Abruf ohne Klick aus, sonst wartet er auf den Start. Solange kein Host ihn abholt,
    // bleibt er anstehend (Nachholregel wie sonst) und das Warten steht EINMAL je Termin und Art im
    // Prüfprotokoll. Ausgeführt wird er über `fuehreHostlaufAus` — denselben Laufweg.
    if (r.host === "word") {
      const u = this.uebergabe(r, jetzt);
      const schluessel = u ? `${r.id}|${u.kennung}|${u.art}` : "";
      if (!u || this.gemeldet.has(schluessel)) {
        return null;
      }
      this.gemeldet.add(schluessel);
      const grund = u.art === "automatisch" ? "an_host_uebergeben" : "wartet_auf_start";
      return {
        routineId: r.id,
        kontoId: r.kontoId,
        termin: u.kennung,
        stand: "wartet_auf_host",
        grund,
      };
    }
    const a = this.anstehend(r, jetzt) ?? (await this.naechstesEreignis(r));
    const zl = r.zeitplanLauf;
    return a && zl ? this.fuehreDurch(r, a.kennung, a.vorhanden, zl) : null;
  }

  /**
   * EQF-06-K05/K09: „bei Ereignis“ — das älteste noch nicht erledigte eigene Ereignis aus dem
   * Prüfprotokoll, je Takt eines. Seine Laufkennung ist die Sequenz des Eintrags: dasselbe Ereignis
   * läuft nie zweimal. Ein offener Lauf geht vor (`anstehend`).
   *
   * Nacharbeit 52 (Ben zu c52b0e61): VOLLSTÄNDIG, auch bei Rückstand. Gelesen wird seitenweise
   * (`audit.page`, je Seite `EREIGNISSE_JE_SEITE`) von jung nach alt, bis zum dauerhaften
   * Fortschritt `ereignisseBis` — alles darüber hinaus, nicht nur die jüngste Seite. Danach rückt
   * der Fortschritt über jede erledigte Folge vom ältesten Ende her vor (gelaufen, abgelehnt oder
   * in einer Pause geschehen) und wird an der Routine gespeichert: nach einem Neustart fehlt nichts
   * und läuft nichts doppelt, und die gelesene Menge wächst nur mit dem tatsächlichen Rückstand.
   */
  private async naechstesEreignis(
    r: Routine,
  ): Promise<{ kennung: string; vorhanden: RoutinenLauf | null } | null> {
    const z = r.zeitplan;
    const zl = r.zeitplanLauf;
    const audit = this.deps.audit;
    if (z?.art !== "bei_ereignis" || !zl || r.zustand === "pausiert" || !audit) {
      return null;
    }
    const laeufe = r.laeufe ?? [];
    if (laeufe.some((l) => l.kennung.startsWith("zeitplan-") && !l.abgeschlossenAm)) {
      return null;
    }
    const erledigt = new Set([...laeufe.map((l) => l.kennung), ...(zl.abgelehnt ?? [])]);
    const bis = zl.ereignisseBis ?? 0;
    const offen: { seq: number; at: string }[] = [];
    let before: number | undefined;
    for (;;) {
      const seite = await audit.page({
        actor: r.kontoId,
        action: ROUTINEN_EREIGNISSE[z.ereignis].aktion,
        from: zl.ereignisseAb ?? zl.seit,
        limit: EREIGNISSE_JE_SEITE,
        ...(before !== undefined ? { before } : {}),
      });
      const neuere = seite.entries.filter((e) => e.seq > bis);
      offen.push(...neuere.map((e) => ({ seq: e.seq, at: e.at })));
      if (neuere.length < seite.entries.length || seite.nextBefore === null) {
        break;
      }
      before = seite.nextBefore;
    }
    // Gelaufen wird in der Reihenfolge, in der es geschah.
    offen.sort((a, b) => a.seq - b.seq);
    const inPause = (at: string) => (zl.pausen ?? []).some((p) => at >= p.von && at < p.bis);
    let stand: { seq: number; at: string } | null = null;
    let naechstes: { seq: number; at: string } | null = null;
    for (const e of offen) {
      if (erledigt.has(`${EREIGNIS_KENNUNG}${e.seq}`) || inPause(e.at)) {
        stand = e;
        continue;
      }
      naechstes = e;
      break;
    }
    if (stand) {
      await this.deps.vormachen.vermerkeEreignisStand(r.kontoId, r.id, stand.seq, stand.at);
    }
    return naechstes ? { kennung: `${EREIGNIS_KENNUNG}${naechstes.seq}`, vorhanden: null } : null;
  }

  /** Je Prozess gemeldete Wartestände (Routine, Termin, Art) — einmal im Protokoll. */
  private readonly gemeldet = new Set<string>();

  /**
   * Nacharbeit 41: ein Lauf einer Word-Routine — von Hand oder ein anstehender Zeitplantermin —
   * über DENSELBEN Laufweg wie die Zeitsteuerung. Den Host (Programm, Hostfassung, Markierung) hat
   * der Rand vorher gegen die BPA-04-Bindung geprüft. Ein Zeitplantermin nimmt Gespräch und
   * Eingaben aus dem Zeitplan; nur die Markierung kommt vom Host.
   */
  async fuehreHostlaufAus(
    r: Routine,
    kennung: string,
    lauf: { gespraech: string; eingaben: Record<string, string>; host: WordLaufHost },
  ): Promise<ZeitplanLaufErgebnis> {
    const vorhanden = (r.laeufe ?? []).find((l) => l.kennung === kennung) ?? null;
    const ergebnis = await this.fuehreDurch(r, kennung, vorhanden, lauf);
    const aktion = kennung.startsWith("zeitplan-") ? BPA06_ZEITPLAN_LAUF : BPA06_HOSTLAUF;
    await this.protokolliere(r, ergebnis, aktion);
    return ergebnis;
  }

  private async protokolliere(
    r: Routine,
    e: ZeitplanLaufErgebnis,
    aktion = BPA06_ZEITPLAN_LAUF,
  ): Promise<void> {
    await this.deps.audit?.record({
      actor: r.kontoId,
      action: aktion,
      target: `routine:${r.id}`,
      payload: {
        termin: e.termin,
        stand: e.stand,
        ...(e.auftragId ? { auftrag: e.auftragId } : {}),
        ...(e.ergebnisId ? { ergebnis: e.ergebnisId } : {}),
        ...(e.grund ? { grund: e.grund } : {}),
      },
    });
  }

  /**
   * Ein Lauf — neu oder wieder aufgenommen. Jedes Mal JETZT geprüft: Konto und Rolle, Pause und
   * Fassung (`planeLauf` mit der Fassung des Laufs; vor der Wirkung `routineSperre`), Eingaben.
   * Abgeschlossen wird er erst mit geprüftem Ergebnis oder endgültigem Scheitern.
   */
  private async fuehreDurch(
    r: Routine,
    kennung: string,
    vorhanden: RoutinenLauf | null,
    lauf: {
      readonly gespraech: string;
      readonly eingaben: Readonly<Record<string, string>>;
      readonly host?: WordLaufHost;
    },
  ): Promise<ZeitplanLaufErgebnis> {
    const basis = {
      routineId: r.id,
      kontoId: r.kontoId,
      termin: kennung,
      ...(vorhanden ? { wiederaufnahme: true } : {}),
    };
    const { vormachen } = this.deps;
    const schliesseAb = () => vormachen.vermerkeLauf(r.kontoId, r.id, kennung, "abgeschlossen");
    try {
      const konto = await this.deps.konto(r.kontoId);
      if (!konto) {
        throw new LaufAbgelehnt(403, "konto_fehlt", "Das Konto besteht nicht mehr.");
      }
      const anfrage: RoutinenLaufAnfrage = {
        kontoId: r.kontoId,
        darfSchreiben: can(konto.role, "ko.create"),
        routine: r,
        // Eine Wiederaufnahme bleibt in IHREM Gespräch und auf IHRER Fassung.
        gespraech: vorhanden?.gespraech ?? lauf.gespraech,
        lauf: kennung,
        fassung: vorhanden?.fassung ?? r.fassung,
        eingaben: { ...lauf.eingaben },
        ...(lauf.host ? { host: lauf.host } : {}),
        // EQF-06-K06: ein Termin ist kein Klick der Person („schrittweise“ läuft so nicht).
        ausloeser: kennung.startsWith("zeitplan-") ? "zeitplan" : "person",
      };
      const dienste = { vormachen, klara: this.deps.klara };
      // Gleiche Kennung, gleicher Abdruck → derselbe Auftrag (nichts doppelt angelegt).
      const e = await legeRoutinenLaufAn(dienste, anfrage);
      const auftrag = { auftragId: e.auftragId, gespraech: e.gespraech };
      if (!this.deps.fuehreAus) {
        return { ...basis, ...auftrag, stand: e.wiederholt ? "wiederholt" : "angelegt" };
      }
      // Den Plan JETZT neu prüfen (Rechte, Pause, Fassung) — auch die Ergebnisprüfung braucht ihn.
      const plan = e.plan ?? planeRoutinenLauf(anfrage);
      // Nacharbeit 36: immer DERSELBE Schritt des Aktionskerns (je Planschritt ist genau einer
      // erlaubt). Ist er vorübergehend gescheitert (`server`/`anmeldung`), beginnt er unter seinem
      // Schlüssel neu (`wiederholeVoruebergehend`); die Entwurfsanlage ist je Auftrag und
      // Planschritt idempotent (Vorgangsschlüssel) — es entsteht kein zweiter Bericht.
      const versuche = vorhanden?.versuche ?? 0;
      // EQF-06-K06: bei „Ergebnis zur Prüfung“ bleibt der zweite Planschritt (Ergebnis öffnen) für
      // die Person offen — die Zeitsteuerung führt nur den Anlageschritt aus.
      const schluessel = ROUTINEN_SCHRITT_BERICHT;
      const aus = await this.deps.fuehreAus({ kontoId: r.kontoId, ...auftrag, schluessel });
      if (aus.stand === "begonnen") {
        // Ungeklärt (Wirkung bekannt, Nachlesen offen): bleibt offen, der nächste Takt liest nach.
        return { ...basis, ...auftrag, stand: "offen", grund: "ungeklaert" };
      }
      const id = aus.entwurf?.id;
      if (aus.stand !== "gespeichert" || !aus.entwurf || id === undefined) {
        const grund = aus.fehlerCode ?? aus.stand;
        if (VORUEBERGEHEND.includes(grund) && versuche + 1 < ROUTINEN_MAX_VERSUCHE) {
          await vormachen.vermerkeLauf(r.kontoId, r.id, kennung, "versuch");
          return { ...basis, ...auftrag, stand: "offen", grund };
        }
        await schliesseAb();
        return { ...basis, ...auftrag, stand: "nicht_ausgefuehrt", grund };
      }
      // Nacharbeit 45: bei Word wird der Inhalt im Körper des Entwurfs vollständig geprüft.
      const pruefung = pruefeEntwurf(plan, aus.entwurf, r.host === "word");
      await schliesseAb();
      if (!pruefung.ok) {
        const abweichungen = pruefung.abweichungen;
        return { ...basis, ...auftrag, stand: "abweichung", ergebnisId: id, abweichungen };
      }
      return { ...basis, ...auftrag, stand: "ausgefuehrt", ergebnisId: id };
    } catch (fehler) {
      // Ein paralleler Owner bzw. eine CAS-Kollision ist kein fachlicher Endfehler. Der laufende
      // Owner darf seinen Beleg abschließen; kein anderer Takt verwirft dessen Reservierung.
      if (fehler instanceof VormachenFehler && fehler.grund === "stand_veraltet") {
        return { ...basis, stand: "offen", grund: "lauf_belegt" };
      }
      const endgueltig =
        fehler instanceof LaufAbgelehnt ||
        ((fehler instanceof VormachenFehler || fehler instanceof KlaraGespraechFehler) &&
          fehler.status < 500);
      if (!endgueltig) {
        // Vorübergehend: der Lauf bleibt offen und wird im nächsten Takt wieder aufgenommen.
        return { ...basis, stand: "fehler", grund: "voruebergehend" };
      }
      const f = fehler as { grund: string; status: number; message: string };
      const abgewiesen = {
        ...basis,
        stand: "abgelehnt" as const,
        grund: f.grund,
        status: f.status,
        text: f.message,
      };
      // Nacharbeit 41: ein Handlauf in Word bleibt bei einer widersprüchlichen Anfrage (dieselbe
      // Kennung, andere Markierung) offen und läuft nur mit SEINER Markierung weiter. Für jeden
      // Zeitplantermin gilt unverändert Nacharbeit 35: der Widerspruch schließt ihn ohne Wirkung
      // ab — sonst hielte er alle späteren Termine auf.
      if (f.grund === "lauf_widerspricht" && lauf.host && !kennung.startsWith("zeitplan-")) {
        return abgewiesen;
      }
      // Gibt es schon einen Laufeintrag, ist der Lauf endgültig abgeschlossen; sonst der Termin
      // (nur ein Zeitplantermin — ein Lauf von Hand hat keinen).
      if (!(await schliesseAb()) && kennung.startsWith("zeitplan-")) {
        await vormachen.vermerkeTerminAbgelehnt(r.kontoId, r.id, kennung);
      }
      return abgewiesen;
    }
  }
}
