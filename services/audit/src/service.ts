import type { TxContext } from "../../db-tx";
import { GENESIS, hashEntry, verifyChain } from "./chain";
import type { AuditRepo } from "./repo";
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
    const partial: Omit<AuditEntry, "hash"> = {
      seq,
      at: new Date(this.now()).toISOString(),
      actor: input.actor,
      action: input.action,
      target: input.target,
      payload: input.payload ?? {},
      prevHash,
    };
    const entry: AuditEntry = { ...partial, hash: hashEntry(partial) };
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
    };
    return this.repo.appendOnce({ ...partial, hash: hashEntry(partial) }, tx);
  }

  async list(filter: AuditFilter = {}): Promise<AuditEntry[]> {
    const all = await this.repo.all();
    return all.filter(
      (e) =>
        (!filter.actor || e.actor === filter.actor) &&
        (!filter.action || e.action === filter.action) &&
        (!filter.target || e.target === filter.target),
    );
  }

  // FR-AUD-02: Integrität der Kette prüfbar.
  async verify(): Promise<boolean> {
    return verifyChain(await this.repo.all());
  }

  // SCRUM-439: aktive Integritätsprüfung mit Zähler — Grundlage des Admin-Knopfs „Integrität geprüft".
  // Ehrliches Signal: ok = Kette lückenlos/unverändert; count = geprüfte Einträge (EIN Durchlauf).
  async verifyReport(): Promise<{ ok: boolean; count: number }> {
    const all = await this.repo.all();
    return { ok: verifyChain(all), count: all.length };
  }
}
