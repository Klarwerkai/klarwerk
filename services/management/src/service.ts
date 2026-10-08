// SCRUM-120: Management-Service. Sammelt echte Live-Daten aus den bestehenden
// Services und ruft die reinen Metriken. Keine KO-Mutation. Einzige eigene Ablage seit Nacharbeit 3:
// die gepflegten Bereichsprofile und Ruhestandshorizonte (profiles.ts, über `deps.profiles`).
import type { KnowledgeObject, KoService } from "../../knowledge-object";
import { type RiskHorizonView, riskHorizon } from "./horizon";
import { computeSnapshot } from "./metrics";
import {
  type CategoryProfile,
  type ManagementProfileRepo,
  type RetirementEntry,
  normalizeCategoryProfile,
  normalizeRetirementHorizon,
  retirementDueAt,
} from "./profiles";
import type { BusFactorLike, ManagementSnapshot } from "./types";

export interface ManagementDeps {
  koService: KoService;
  // R-2183 (Nacharbeit 3): `assignee` reist mit — der Arbeitsvorrat zählt die einem Träger
  // zugewiesenen offenen Lücken. Der Snapshot liest weiterhin nur `status`.
  listGaps: () => Promise<{ status: "offen" | "geschlossen"; assignee?: string | null }[]>;
  // AUFTRAG-mega76 BLOCK D: ein Konflikt nennt ZWEI Wissensobjekte; sichtbar ist er nur, wenn
  // beide es sind (dieselbe Paar-Regel wie das Konflikt-Board). Die Auflösung braucht den
  // KO-Bestand und bleibt deshalb beim Aufrufer — hier reist nur die Entscheidung hinein.
  countOpenConflicts: (opts: { sichtbar: (ko: KnowledgeObject) => boolean }) => Promise<number>;
  // R-0751 (Nacharbeit 1): die beteiligten KO-Kennungen derselben sichtbaren offenen Konflikte —
  // Eingang des Faktors „Konfliktdichte". Optional: fehlt der Weg, bleibt der Faktor ohne Daten.
  openConflictKoIds?: (opts: { sichtbar: (ko: KnowledgeObject) => boolean }) => Promise<string[]>;
  pendingRevalidation: () => Promise<string[]>;
  // AUFTRAG-mega76 BLOCK D: der Bus-Faktor rechnet selbst über einer Grundmenge und braucht die
  // Sichtbarkeitsentscheidung deshalb DURCHGEREICHT — sonst hinge ein gefilterter Snapshot an
  // ungefilterten Kategoriezeilen.
  busFactor: (opts: { sichtbar: (ko: KnowledgeObject) => boolean }) => Promise<BusFactorLike[]>;
  // R-0751 / R-1639 / R-2183 (Nacharbeit 3): gepflegte Bereichsprofile und Ruhestandshorizonte.
  // Optional: ohne Ablage bleiben die vier eingeschätzten Faktoren ohne Daten und der
  // Bereichsblick leer — nichts wird ersatzweise angenommen.
  profiles?: ManagementProfileRepo;
  now?: () => number;
}

export class ManagementService {
  private readonly deps: ManagementDeps;
  private readonly now: () => number;

  constructor(deps: ManagementDeps) {
    this.deps = deps;
    this.now = deps.now ?? (() => Date.now());
  }

  // AUFTRAG-mega76 BLOCK D — DER BREITESTE DER SECHS LECKPFADE (ben, sammel72).
  //
  // Der Snapshot leitet aus dem KO-Bestand Gesamt-, Validierungs- und Offen-Zähler ab, dazu
  // durchschnittliches Vertrauen, Reife-, Kapital- und Risikoscores, Kategorieprioritäten MIT
  // NAMEN, Knowledge-House-Zeilen (je Fachgebiet) mit Name/`koCount`/`validatedRatio` und die
  // 30/60/90-Tage-Fenster. Ein einzelnes vertrauliches KO konnte eine neue Kategoriezeile
  // erzeugen, Zeitfenster verändern und mehrere globale Scores verschieben; bei einer
  // vertraulich-only Kategorie zeigte `house` unmittelbar Name und `koCount: 1`.
  //
  // `sichtbar` ist PFLICHT und greift an der GRUNDMENGE — vor `computeSnapshot`, nicht danach.
  async snapshot(opts: {
    sichtbar: (ko: KnowledgeObject) => boolean;
  }): Promise<ManagementSnapshot> {
    const [alle, gaps, openConflicts, pending, busFactor, konfliktKos, profile] = await Promise.all(
      [
        this.deps.koService.list({}),
        this.deps.listGaps(),
        this.deps.countOpenConflicts(opts),
        this.deps.pendingRevalidation(),
        this.deps.busFactor(opts),
        this.deps.openConflictKoIds ? this.deps.openConflictKoIds(opts) : Promise.resolve(null),
        this.listCategoryProfiles(),
      ],
    );
    const kos = alle.filter(opts.sichtbar);
    // Die Revalidierungsliste sind KO-Kennungen. Sie wird gegen den SICHTBAREN Bestand geschnitten
    // — ein unsichtbares Objekt darf auch nicht als Zahl in der Risikorechnung auftauchen.
    const sichtbareIds = new Set(kos.map((ko) => ko.id));
    const openGaps = gaps.filter((g) => g.status === "offen").length;
    const konfliktIds =
      konfliktKos === null ? null : konfliktKos.filter((id) => sichtbareIds.has(id));
    const body = computeSnapshot({
      kos,
      openGaps,
      openConflicts,
      pendingRevalidation: pending.filter((id) => sichtbareIds.has(id)),
      busFactor,
      now: this.now(),
      openConflictKoIds: konfliktIds,
      categoryProfiles: profile,
    });
    return { generatedAt: new Date(this.now()).toISOString(), ...body };
  }

  // ==============================================================================================
  // R-1639 · R-2183 (Nacharbeit 3) — DER BEREICHSBLICK MIT RUHESTANDSHORIZONTEN UND ARBEITSVORRAT.
  // ==============================================================================================
  // Dieselbe Sichtbarkeitsregel wie der Snapshot: gefiltert wird die GRUNDMENGE. `seesAll` setzt
  // die Route aus `users.manage`; sonst nur die Bereiche, die den Betrachter als Verantwortlichen
  // nennen (horizon.ts).
  async riskHorizon(opts: {
    sichtbar: (ko: KnowledgeObject) => boolean;
    viewer: { userId: string; seesAll: boolean };
  }): Promise<RiskHorizonView> {
    const [alle, gaps, busFactor, profile, retirement] = await Promise.all([
      this.deps.koService.list({}),
      this.deps.listGaps(),
      this.deps.busFactor(opts),
      this.listCategoryProfiles(),
      this.listRetirement(),
    ]);
    return riskHorizon({
      kos: alle.filter(opts.sichtbar),
      busFactor,
      profiles: profile,
      retirement,
      gaps,
      viewer: opts.viewer,
      now: this.now(),
    });
  }

  listCategoryProfiles(): Promise<CategoryProfile[]> {
    return this.deps.profiles ? this.deps.profiles.listCategoryProfiles() : Promise.resolve([]);
  }

  listRetirement(): Promise<RetirementEntry[]> {
    return this.deps.profiles ? this.deps.profiles.listRetirement() : Promise.resolve([]);
  }

  /** Pflege eines Bereichsprofils; ungültige Stufen werfen `INVALID_MANAGEMENT_PROFILE` (400). */
  async setCategoryProfile(input: unknown, actor: string): Promise<CategoryProfile> {
    const profil = normalizeCategoryProfile(input, actor, this.now());
    await this.ablage().setCategoryProfile(profil);
    return profil;
  }

  /** Horizont setzen (24/36) oder mit `null` entfernen. Frist = jetzt + Horizont. */
  async setRetirement(
    userId: string,
    rawHorizon: unknown,
    actor: string,
  ): Promise<RetirementEntry | null> {
    const horizon = normalizeRetirementHorizon(rawHorizon);
    if (horizon === null) {
      await this.ablage().removeRetirement(userId);
      return null;
    }
    const jetzt = this.now();
    const eintrag: RetirementEntry = {
      userId,
      horizonMonths: horizon,
      dueAt: retirementDueAt(jetzt, horizon),
      updatedAt: new Date(jetzt).toISOString(),
      updatedBy: actor,
    };
    await this.ablage().setRetirement(eintrag);
    return eintrag;
  }

  private ablage(): ManagementProfileRepo {
    if (!this.deps.profiles) {
      throw new Error("Keine Ablage für Bereichsprofile verdrahtet.");
    }
    return this.deps.profiles;
  }
}
