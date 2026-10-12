import type { TxContext } from "../../db-tx";
import {
  AUDIT_HASH_VERSION_V2,
  type ChainInspection,
  GENESIS,
  hashEntryV2,
  inspectChain,
  verifyChain,
} from "./chain";
import { type AuditRepo, auditFilterTrifft, auditSeiteTrifft, namensbelegeAus } from "./repo";
import type {
  AuditEntry,
  AuditFilter,
  AuditInput,
  AuditSeite,
  AuditSeitenAnfrage,
  AuditSeitenFilter,
} from "./types";

// produkt:20261009:admin-audit-verstaendlich: die Seitengröße des Seitenwegs. Ohne Angabe 25, nie
// mehr als 100 — auch ein Aufrufer, der `limit=100000` schickt, bekommt keine Gesamtliste.
export const AUDIT_SEITE_STANDARD = 25;
export const AUDIT_SEITE_MAX = 100;

export function auditSeitengroesse(wunsch: number | undefined): number {
  if (wunsch === undefined || !Number.isFinite(wunsch)) {
    return AUDIT_SEITE_STANDARD;
  }
  return Math.min(AUDIT_SEITE_MAX, Math.max(1, Math.floor(wunsch)));
}

// R-0613 (Rest „ein externer Anker und ein Export fehlen"): die ganze Kette als Datei. Der Kopf
// (`head`: letzte Sequenz + ihr Hash) ist der Wert, den ein Betreiber AUSSERHALB der Datenbank
// ablegen kann — ein später neu gebildeter Kettenverlauf ergibt dort einen anderen Kopf. Das
// Produkt verankert den Kopf nicht selbst; es liefert ihn nur so aus, dass man es kann.
export interface AuditChainExport {
  format: "klarwerk-audit-export";
  formatVersion: 1;
  exportedAt: string;
  count: number;
  head: { seq: number; hash: string } | null;
  inspection: ChainInspection;
  entries: AuditEntry[];
}

export interface AuditServiceDeps {
  repo: AuditRepo;
  now?: () => number;
  // Auftrag gesamt-dubletten-rueckzug (Runde 3, Bens BEN-R3-3): `record`/`recordOnce` sind zwei
  // Schritte (`last`, dann `append`). Ohne Datenbank, wo kein Primärschlüssel `seq` doppelte
  // Kettenglieder abweist, reicht die Kompositionswurzel hier eine Sperre, unter der beide Schritte
  // ungeteilt laufen — und die ein offener Rücknahme-Vorgang (services/app/src/speicher-vorgang.ts)
  // für seine ganze Dauer hält. Ein Aufruf MIT dem Kontext dieses Vorgangs läuft ohne Warten
  // hindurch (die Sperre entscheidet das am `tx`). Ohne Angabe unverändert.
  kettenSperre?: <T>(tx: TxContext | undefined, fn: () => Promise<T>) => Promise<T>;
}

export class AuditService {
  private readonly repo: AuditRepo;
  private readonly now: () => number;
  private readonly kettenSperre: <T>(tx: TxContext | undefined, fn: () => Promise<T>) => Promise<T>;

  constructor(deps: AuditServiceDeps) {
    this.repo = deps.repo;
    this.now = deps.now ?? (() => Date.now());
    this.kettenSperre = deps.kettenSperre ?? ((_tx, fn) => fn());
  }

  // FR-AUD-01: jede relevante Aktion erzeugt einen Eintrag (wer/was/wann).
  // SCRUM-523 P.3 (WP-A2): optionaler, opaker TxContext (services/db-tx) — additiv, abwärtskompatibel.
  // Reicht ihn an die Ablage (`appendNext`, sonst last()/append()) durch, damit sie auf demselben Pg-Client laufen wie ein vom
  // Aufrufer parallel geschriebener anderer Store (z. B. KoService.purgeKo: repo.delete + audit.record
  // in EINER echten Transaktion). Ohne tx unverändertes Verhalten.
  //
  // Zusammenführung (gesamt-auditprotokoll mit gesamt-dubletten-rueckzug): beide Absicherungen
  // gelten. Die `kettenSperre` der Kompositionswurzel (nur ohne Datenbank, gehalten von einem offenen
  // Rücknahme-Vorgang) umschließt den Schritt; darin hängt die Ablage über `appendNext` an.
  record(input: AuditInput, tx?: TxContext): Promise<AuditEntry> {
    return this.kettenSperre(tx, () => this.recordUngeteilt(input, tx));
  }

  private async recordUngeteilt(input: AuditInput, tx?: TxContext): Promise<AuditEntry> {
    // Aufnahme gesamt-auditprotokoll (Lauf 3): Vorgänger lesen und Anhängen als EIN Schritt der
    // Ablage (`appendNext`), damit zwei gleichzeitige Schreiber nie denselben Vorgänger sehen.
    if (this.repo.appendNext) {
      const { entry } = await this.repo.appendNext((last) => this.baue(last, input), tx);
      return entry;
    }
    const entry = this.baue(await this.repo.last(tx), input);
    await this.repo.append(entry, tx);
    return entry;
  }

  // Der nächste Ketteneintrag nach `last`.
  //
  // JOB 498 D8: NEUE EINTRÄGE SIND V2 — und `hashVersion` steht IM `partial`, also VOR der
  // Hashbildung und vor `Object.freeze`. Nachträglich ginge es gar nicht: `InMemoryAuditRepo.append`
  // friert den Eintrag ein, und `service.test.ts` nagelt das mit `Object.isFrozen` fest. Ein
  // später gesetztes Feld läge außerdem neben dem Hash statt in ihm — genau die Lücke, die V2
  // schließt. Die `eventId` geht NICHT in den Hash ein (s. `types.ts`); das Exactly-once-Verhalten
  // hängt an ihr, nicht am Hash.
  private baue(last: AuditEntry | undefined, input: AuditInput, eventId?: string): AuditEntry {
    const partial: Omit<AuditEntry, "hash"> = {
      seq: last ? last.seq + 1 : 1,
      at: new Date(this.now()).toISOString(),
      actor: input.actor,
      action: input.action,
      target: input.target,
      payload: input.payload ?? {},
      prevHash: last ? last.hash : GENESIS,
      ...(eventId ? { eventId } : {}),
      hashVersion: AUDIT_HASH_VERSION_V2,
    };
    return { ...partial, hash: hashEntryV2(partial) };
  }

  // WP-SHIP8-CLOSE-6 (bens ROT-1): EXACTLY-ONCE-Beleg über eine stabile Event-Id (z. B.
  // "ko.created:<koId>"). Baut den Ketten-Eintrag wie record(), hängt aber über den
  // persistenzgestützten Idempotenzvertrag an (Pg: partieller Unique-Index + ON CONFLICT DO
  // NOTHING; InMemory: synchroner Set-Guard) — zwei parallele Nachzüge, die beide einen leeren
  // Read sahen, erzeugen exakt EINEN Eintrag. true = DIESER Aufruf hat geschrieben; false =
  // der Beleg existierte bereits (kein Fehler). Wird nicht geschrieben, bleibt die berechnete
  // seq unbenutzt — der nächste record() liest last() frisch, die Kette bleibt lückenlos.
  recordOnce(eventId: string, input: AuditInput, tx?: TxContext): Promise<boolean> {
    return this.kettenSperre(tx, () => this.recordOnceUngeteilt(eventId, input, tx));
  }

  private async recordOnceUngeteilt(
    eventId: string,
    input: AuditInput,
    tx?: TxContext,
  ): Promise<boolean> {
    if (this.repo.appendNext) {
      const { written } = await this.repo.appendNext((last) => this.baue(last, input, eventId), tx);
      return written;
    }
    return this.repo.appendOnce(this.baue(await this.repo.last(tx), input, eventId), tx);
  }

  // JOB 2698 D1 (Review-Befund R2-32): NUR DIESE LESEFUNKTION ist angefasst — die Sequenzlogik
  // (`record`/`recordOnce`, PROs 2677er Kette) bleibt Zeile für Zeile, wie sie war.
  //
  // Bis 2698 lud `list()` bei JEDEM Aufruf das ganze Protokoll (`repo.all()`) und filterte danach in
  // Node. Aufrufer sind die Glocke, die Startseite (Wirkung), die Live-Wall, das Admin-Protokoll —
  // und je Wissensobjekt eine Abfrage. Das Protokoll wächst mit jeder Frage; es ist die einzige
  // Tabelle, die nie kleiner wird, und wurde bei jedem Seitenaufruf vollständig gelesen.
  //
  // Jetzt: die Ablage filtert selbst (`findBy`, auf PostgreSQL ein WHERE über den Index
  // `(action, target)`). Die Regel ist dieselbe — `auditFilterTrifft` in repo.ts ist ihre eine
  // Fassung; der Rückfall unten benutzt sie, damit ein Test-Double ohne `findBy` dieselbe Menge
  // sieht wie die produktiven Ablagen.
  async list(filter: AuditFilter = {}): Promise<AuditEntry[]> {
    if (this.repo.findBy) {
      return this.repo.findBy(filter);
    }
    const all = await this.repo.all();
    return all.filter((e) => auditFilterTrifft(e, filter));
  }

  // produkt:20261009:admin-audit-verstaendlich (ADMIN-03): EINE Seite der Kette, jüngste zuerst.
  //
  // Gelesen werden `limit + 1` Einträge: der überzählige sagt nur, OB es eine ältere Seite gibt, und
  // wird nicht ausgeliefert. `nextBefore` ist die Sequenz des ältesten ausgelieferten Eintrags — die
  // nächste Seite beginnt unmittelbar davor. Ein Zeiger über die Sequenz statt eines Versatzes: neue
  // Einträge, die während des Blätterns angehängt werden, verschieben keine bereits gezeigte Seite.
  async page(anfrage: AuditSeitenAnfrage = {}): Promise<AuditSeite> {
    const limit = auditSeitengroesse(anfrage.limit);
    const before = anfrage.before;
    const filter: AuditSeitenFilter = {
      ...(anfrage.actor ? { actor: anfrage.actor } : {}),
      ...(anfrage.action ? { action: anfrage.action } : {}),
      ...(anfrage.target ? { target: anfrage.target } : {}),
      ...(anfrage.actions && anfrage.actions.length > 0 ? { actions: anfrage.actions } : {}),
      ...(anfrage.from ? { from: anfrage.from } : {}),
      ...(anfrage.to ? { to: anfrage.to } : {}),
    };
    const gelesen = this.repo.findPage
      ? await this.repo.findPage(filter, before, limit + 1)
      : (await this.repo.all())
          .filter((e) => (before === undefined || e.seq < before) && auditSeiteTrifft(e, filter))
          .reverse()
          .slice(0, limit + 1);
    const entries = gelesen.slice(0, limit);
    const weitere = gelesen.length > limit;
    return { entries, nextBefore: weitere ? (entries.at(-1)?.seq ?? null) : null, limit };
  }

  // produkt:20261009:admin-audit-verstaendlich: die Namens- und Kontobelege zu diesen Kennungen —
  // je Kennung höchstens drei, jeweils der jüngste (`namensbelegeAus`, Bens Befund Nacharbeit 3).
  // Die Zuordnung „welcher Name gehört zu welcher Kennung" trifft weiter `protokollNamen` an der
  // Oberfläche; ob eine Kennung ein Konto war, `kontoBelege`.
  async namensbelege(ids: readonly string[]): Promise<AuditEntry[]> {
    const gesucht = [...new Set(ids.filter((id) => id !== ""))];
    if (gesucht.length === 0) {
      return [];
    }
    if (this.repo.findNamensbelege) {
      return this.repo.findNamensbelege(gesucht);
    }
    return namensbelegeAus(await this.repo.all(), gesucht);
  }

  // JOB 2698 D1: „gibt es mindestens einen Eintrag?" — für Aufrufer, die nur das wissen wollen
  // (KoService, ko.created-Nachzug). Kein Laden, auf PostgreSQL ein EXISTS.
  async exists(filter: AuditFilter): Promise<boolean> {
    if (this.repo.existsBy) {
      return this.repo.existsBy(filter);
    }
    return (await this.list(filter)).length > 0;
  }

  // Aufnahme gesamt-auditprotokoll (Runde 3): die Sequenz des jüngsten Eintrags (0 = leer) — damit
  // ein Aufrufer nach einem Ausfall benennen kann, welche Einträge sein Schritt schon angehängt hatte.
  async kopfSeq(): Promise<number> {
    return (await this.repo.last())?.seq ?? 0;
  }

  // FR-AUD-02: Integrität der Kette prüfbar.
  async verify(): Promise<boolean> {
    return verifyChain(await this.repo.all());
  }

  // SCRUM-439: aktive Integritätsprüfung mit Zähler — Grundlage des Admin-Knopfs „Integrität geprüft".
  // Ehrliches Signal: ok = Kette lückenlos/unverändert; count = geprüfte Einträge (EIN Durchlauf).
  //
  // AUFTRAG-mega14 Block A (bens SB-1): der Bericht nennt jetzt zusätzlich die URSACHE. Vorher konnte
  // die Oberfläche einen echten `prevHash`-Bruch nicht von einer durch jsonb-Schlüsselreihenfolge
  // erklärbaren Hashabweichung unterscheiden — und behauptete trotzdem „Manipulation erkannt".
  // `verify()` (und damit jeder Altaufrufer) bleibt unverändert.
  async verifyReport(): Promise<ChainInspection> {
    return inspectChain(await this.repo.all());
  }

  // R-0613: Export der Kette samt Prüfbericht und Kopf. EIN Lesedurchlauf — Bericht, Kopf und
  // Einträge beschreiben dieselbe Menge. Der Export selbst wird danach als `audit.exported`
  // angehängt (wer hat die Kette wann mit welchem Kopf mitgenommen); dieser Eintrag liegt HINTER
  // dem exportierten Kopf und ist deshalb nicht Teil der Datei.
  async exportChain(actor: string): Promise<AuditChainExport> {
    const entries = await this.repo.all();
    const last = entries.at(-1);
    const head = last ? { seq: last.seq, hash: last.hash } : null;
    const result: AuditChainExport = {
      format: "klarwerk-audit-export",
      formatVersion: 1,
      exportedAt: new Date(this.now()).toISOString(),
      count: entries.length,
      head,
      inspection: inspectChain(entries),
      entries,
    };
    await this.record({
      actor,
      action: "audit.exported",
      target: "audit",
      payload: { count: entries.length, headSeq: head?.seq ?? 0, headHash: head?.hash ?? GENESIS },
    });
    return result;
  }
}
