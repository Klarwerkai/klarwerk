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
  async record(input: AuditInput): Promise<AuditEntry> {
    const last = await this.repo.last();
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
    await this.repo.append(entry);
    return entry;
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
