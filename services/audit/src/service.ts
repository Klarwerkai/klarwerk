import type { TxContext } from "../../db-tx";
import {
  AUDIT_HASH_VERSION_V2,
  type ChainInspection,
  GENESIS,
  hashEntryV2,
  inspectChain,
  verifyChain,
} from "./chain";
import { type AuditRepo, auditFilterTrifft } from "./repo";
import type { AuditEntry, AuditFilter, AuditInput } from "./types";

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
}

export class AuditService {
  private readonly repo: AuditRepo;
  private readonly now: () => number;

  constructor(deps: AuditServiceDeps) {
    this.repo = deps.repo;
    this.now = deps.now ?? (() => Date.now());
  }

  // FR-AUD-01: jede relevante Aktion erzeugt einen Eintrag (wer/was/wann).
  // SCRUM-523 P.3 (WP-A2): optionaler, opaker TxContext (services/db-tx) — additiv, abwärtskompatibel.
  // Reicht ihn an die Ablage (`appendNext`, sonst last()/append()) durch, damit sie auf demselben Pg-Client laufen wie ein vom
  // Aufrufer parallel geschriebener anderer Store (z. B. KoService.purgeKo: repo.delete + audit.record
  // in EINER echten Transaktion). Ohne tx unverändertes Verhalten.
  async record(input: AuditInput, tx?: TxContext): Promise<AuditEntry> {
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
  async recordOnce(eventId: string, input: AuditInput, tx?: TxContext): Promise<boolean> {
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
