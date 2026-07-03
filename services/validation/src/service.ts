import type { AuditService } from "../../audit";
import type { KnowledgeObject, KoFilter, KoService } from "../../knowledge-object";
import type { AssignmentRepo, RatingRepo } from "./repo";
import {
  FALLBACK_NEEDED_VALIDATIONS,
  type ValidationSettingsRepo,
  normalizeDefaultNeeded,
} from "./settings";
import { type ValidationOutcome, computeOutcome } from "./trust";
import { ValidationError, type Verdict } from "./types";

export type BoardFilter = Omit<KoFilter, "status">;

export interface AssignmentSummary {
  userId: string;
  open: number;
  done: number;
}

// SCRUM-363 / AG-15 / FR-VAL-05/06: eine offene, persönliche Review-Zuweisung als leichtgewichtiger
// Hinweis (für den In-App-Feed). Enthält das Quell-KO (Titel + Erstellzeit als Sortier-/Anzeigezeit) —
// kein neues Datenmodell, nur eine Sicht auf das vorhandene Assignment + KO.
export interface AssignmentNotice {
  koId: string;
  title: string;
  at: string;
}

export interface ValidationServiceDeps {
  koService: KoService;
  ratings: RatingRepo;
  assignments: AssignmentRepo;
  audit?: AuditService;
  now?: () => number;
  // SCRUM-395: persistierte Admin-Einstellung „Standard-Prüferanzahl" (optional —
  // ohne Repo gilt der feste Fallback aus settings.ts).
  settings?: ValidationSettingsRepo;
}

export class ValidationService {
  private readonly koService: KoService;
  private readonly ratings: RatingRepo;
  private readonly assignments: AssignmentRepo;
  private readonly audit: AuditService | undefined;
  private readonly now: () => number;
  private readonly settings: ValidationSettingsRepo | undefined;

  constructor(deps: ValidationServiceDeps) {
    this.koService = deps.koService;
    this.ratings = deps.ratings;
    this.assignments = deps.assignments;
    this.audit = deps.audit;
    this.now = deps.now ?? (() => Date.now());
    this.settings = deps.settings;
  }

  // SCRUM-395: Standard-Prüferanzahl für neue Einreichungen — Admin-Wert, sonst Fallback 3.
  async defaultNeededValidations(): Promise<number> {
    const stored = await this.settings?.getDefaultNeeded();
    return stored ?? FALLBACK_NEEDED_VALIDATIONS;
  }

  // SCRUM-395: Admin setzt den Standard (1–5, ganzzahlig). Landet im Audit — Einstellungen,
  // die den Prüfprozess verändern, sind nachvollziehbar.
  async setDefaultNeededValidations(value: unknown, actor: string): Promise<number> {
    if (!this.settings) {
      throw new ValidationError(
        "INVALID_DEFAULT",
        "Standard-Prüferanzahl wird in dieser Umgebung nicht persistiert.",
      );
    }
    const normalized = normalizeDefaultNeeded(value);
    await this.settings.setDefaultNeeded(normalized);
    await this.audit?.record({
      actor,
      action: "validation.defaultNeeded.set",
      target: "settings",
      payload: { value: normalized },
    });
    return normalized;
  }

  // FR-VAL-01/02: Bewertung verbuchen, Trust/Status neu berechnen, am KO setzen.
  async rate(koId: string, userId: string, verdict: Verdict): Promise<ValidationOutcome> {
    const ko = await this.koService.get(koId);
    if (!ko) {
      throw new ValidationError("NOT_FOUND", "Wissensobjekt nicht gefunden.");
    }
    await this.ratings.upsert({
      koId,
      userId,
      verdict,
      createdAt: new Date(this.now()).toISOString(),
    });
    const all = await this.ratings.listByKo(koId);
    const outcome = computeOutcome(
      all.map((r) => r.verdict),
      ko.neededValidations,
    );
    await this.koService.setValidationState(koId, {
      trust: outcome.trust,
      status: outcome.status,
    });
    await this.audit?.record({
      actor: userId,
      action: "ko.rated",
      target: koId,
      payload: { verdict },
    });
    // FR-VAL-05: Bewertung erledigt eine offene Zuweisung des Nutzers.
    const assignment = await this.assignments.find(koId, userId);
    if (assignment && assignment.status === "open") {
      await this.assignments.update({ ...assignment, status: "done" });
    }
    // SCRUM-124: Gelb/Rot (warn/down) gibt das Objekt zur Nacharbeit an den Autor zurück.
    // Schemafrei über das vorhandene Assignment-Modell + Audit; Grün (up) erzeugt nichts.
    if (verdict === "warn" || verdict === "down") {
      await this.returnToAuthor(koId, ko.author, userId, verdict);
    }
    return outcome;
  }

  // SCRUM-124: dedupliziert eine offene Zuweisung an den Autor + Audit-Event.
  private async returnToAuthor(
    koId: string,
    author: string,
    by: string,
    verdict: Verdict,
  ): Promise<void> {
    const existing = await this.assignments.find(koId, author);
    if (existing) {
      if (existing.status !== "open") {
        await this.assignments.update({ ...existing, status: "open" });
      }
    } else {
      await this.assignments.create({ koId, userId: author, status: "open" });
    }
    await this.audit?.record({
      actor: by,
      action: "ko.returned-to-author",
      target: koId,
      payload: { verdict, author },
    });
  }

  // FR-VAL-03/04: Board zeigt nur offene KOs, Filter kombinierbar.
  // SCRUM-364 / AG-15 / FR-VAL-05/06: Die KO-`assignments` werden für das Board mit den OFFENEN
  // Review-Zuweisungen angereichert (aus dem AssignmentRepo) — erst dadurch arbeiten die persönliche
  // „Mir zugewiesen"-Linse und die Zugewiesen-Markierung mit echten Daten. Erledigte (done)
  // Zuweisungen erscheinen NICHT → ein KO fällt aus der persönlichen Linse, sobald die Person es
  // bewertet hat. Reine Lese-Anreicherung des vorhandenen Felds, kein neues Datenmodell, keine
  // Persistenz. KOs ohne offene Zuweisung bleiben unverändert (assignments wie vom KO-Service geliefert).
  async board(filter: BoardFilter = {}): Promise<KnowledgeObject[]> {
    const kos = await this.koService.list({ ...filter, status: "offen" });
    const all = await this.assignments.all();
    const openByKo = new Map<string, string[]>();
    for (const a of all) {
      if (a.status === "open") {
        const list = openByKo.get(a.koId) ?? [];
        list.push(a.userId);
        openByKo.set(a.koId, list);
      }
    }
    return kos.map((ko) => {
      const assigned = openByKo.get(ko.id);
      return assigned ? { ...ko, assignments: assigned } : ko;
    });
  }

  // FR-VAL-05: KO an ≥1 Person zuweisen.
  async assign(koId: string, userIds: string[], actor = "system"): Promise<void> {
    const ko = await this.koService.get(koId);
    if (!ko) {
      throw new ValidationError("NOT_FOUND", "Wissensobjekt nicht gefunden.");
    }
    for (const userId of userIds) {
      await this.assignments.create({ koId, userId, status: "open" });
    }
    await this.audit?.record({
      actor,
      action: "ko.assigned",
      target: koId,
      payload: { userIds },
    });
  }

  // SCRUM-363 / AG-15 / FR-VAL-05/06: die OFFENEN Review-Zuweisungen GENAU dieser Person (keine fremde
  // Ownership). Erledigte (done) Zuweisungen erscheinen nicht; Zuweisungen auf zwischenzeitlich
  // gelöschte KOs werden übersprungen. Reine Sicht auf vorhandene Daten — kein neues Notification-Backend.
  async openAssignmentsFor(userId: string): Promise<AssignmentNotice[]> {
    const all = await this.assignments.all();
    const mine = all.filter((a) => a.userId === userId && a.status === "open");
    const notices: AssignmentNotice[] = [];
    for (const a of mine) {
      const ko = await this.koService.get(a.koId);
      if (ko) {
        notices.push({ koId: ko.id, title: ko.title, at: ko.createdAt });
      }
    }
    return notices;
  }

  // FR-VAL-06: Übersicht offen/erledigt pro Person.
  async overview(): Promise<AssignmentSummary[]> {
    const all = await this.assignments.all();
    const byUser = new Map<string, AssignmentSummary>();
    for (const a of all) {
      const summary = byUser.get(a.userId) ?? { userId: a.userId, open: 0, done: 0 };
      if (a.status === "open") {
        summary.open += 1;
      } else {
        summary.done += 1;
      }
      byUser.set(a.userId, summary);
    }
    return [...byUser.values()];
  }
}
