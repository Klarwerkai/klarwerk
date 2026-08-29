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
  // Reicht ihn an last()/append() durch, damit BEIDE auf demselben Pg-Client laufen wie ein vom
  // Aufrufer parallel geschriebener anderer Store (z. B. KoService.purgeKo: repo.delete + audit.record
  // in EINER echten Transaktion). Ohne tx unverändertes Verhalten.
  async record(input: AuditInput, tx?: TxContext): Promise<AuditEntry> {
    const last = await this.repo.last(tx);
    const seq = last ? last.seq + 1 : 1;
    const prevHash = last ? last.hash : GENESIS;
    // JOB 498 D8: NEUE EINTRÄGE SIND V2 — und `hashVersion` steht IM `partial`, also VOR der
    // Hashbildung und vor `Object.freeze`. Nachträglich ginge es gar nicht: `InMemoryAuditRepo.append`
    // friert den Eintrag ein, und `service.test.ts` nagelt das mit `Object.isFrozen` fest. Ein
    // später gesetztes Feld läge außerdem neben dem Hash statt in ihm — genau die Lücke, die V2
    // schließt.
    const partial: Omit<AuditEntry, "hash"> = {
      seq,
      at: new Date(this.now()).toISOString(),
      actor: input.actor,
      action: input.action,
      target: input.target,
      payload: input.payload ?? {},
      prevHash,
      hashVersion: AUDIT_HASH_VERSION_V2,
    };
    const entry: AuditEntry = { ...partial, hash: hashEntryV2(partial) };
    await this.repo.append(entry, tx);
    return entry;
  }

  // WP-SHIP8-CLOSE-6 (bens ROT-1): EXACTLY-ONCE-Beleg über eine stabile Event-Id (z. B.
  // "ko.created:<koId>"). Baut den Ketten-Eintrag wie record(), hängt aber über den
  // persistenzgestützten Idempotenzvertrag an (Pg: partieller Unique-Index + ON CONFLICT DO
  // NOTHING; InMemory: synchroner Set-Guard) — zwei parallele Nachzüge, die beide einen leeren
  // Read sahen, erzeugen exakt EINEN Eintrag. true = DIESER Aufruf hat geschrieben; false =
  // der Beleg existierte bereits (kein Fehler). Wird nicht geschrieben, bleibt die berechnete
  // seq unbenutzt — der nächste record() liest last() frisch, die Kette bleibt lückenlos.
  async recordOnce(eventId: string, input: AuditInput, tx?: TxContext): Promise<boolean> {
    const last = await this.repo.last(tx);
    const seq = last ? last.seq + 1 : 1;
    const prevHash = last ? last.hash : GENESIS;
    const partial: Omit<AuditEntry, "hash"> = {
      seq,
      at: new Date(this.now()).toISOString(),
      actor: input.actor,
      action: input.action,
      target: input.target,
      payload: input.payload ?? {},
      prevHash,
      eventId,
      // Wie in `record`: die Version steht vor der Hashbildung im Eintrag. Das
      // Exactly-once-Verhalten bleibt davon unberührt — es hängt an `eventId`, nicht am Hash.
      hashVersion: AUDIT_HASH_VERSION_V2,
    };
    return this.repo.appendOnce({ ...partial, hash: hashEntryV2(partial) }, tx);
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
}
