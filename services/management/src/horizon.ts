// ================================================================================================
// R-1639 · R-2183 (Nacharbeit 3) — BEREICHSBLICK JE MANAGER, RUHESTANDSHORIZONTE, ARBEITSVORRAT.
// ================================================================================================
//
// Roadmap 5.1, wörtlich: „Für jeden Manager ein eigenes Dashboard: Welche kritischen Themen meines
// Bereichs haben Bus-Faktor 1? Welche Mitarbeiter gehen in den nächsten 24/36 Monaten in Rente —
// was wissen sie, was nicht im System ist?" Dazu B14: „persönlicher Arbeitsvorrat gegen
// Wissensverlust", an Ruhestandsfristen gebunden.
//
// Reine, DOM-freie Ableitung aus gepflegten Eingängen (profiles.ts) und dem SICHTBAREN Bestand:
//   · Bereich = Kategorie; „mein Bereich" = Kategorien, deren Profil mich als `managerId` nennt.
//     Wer `users.manage` trägt, sieht alle Bereiche (Pflegerolle) — sonst nur die eigenen.
//   · Träger = Urheber (`originalAuthor`) — dieselbe Regel wie der Bus-Faktor.
//   · Im Blick stehen NUR Träger mit gepflegtem Horizont, und nur in Bereichen, die der Betrachter
//     sehen darf. Ruhestandsangaben anderer Personen verlassen den Server nicht.
//   · Arbeitsvorrat je Träger und Bereich: Frist, noch nicht validierte eigene Objekte, ob er der
//     einzige Träger ist (dann hängt das Gebiet allein an ihm), ihm zugewiesene offene Lücken.
//     „Was nicht im System ist" kann niemand zählen — die Fläche sagt das, statt es zu schätzen.
import type { KnowledgeObject } from "../../knowledge-object";
import type {
  AssessmentLevel,
  CategoryProfile,
  RetirementEntry,
  RetirementHorizon,
} from "./profiles";
import type { BusFactorLike } from "./types";

export interface RiskHorizonBearer {
  userId: string;
  // Die bei der Pflege gewählte Klasse — bleibt als Herkunft erhalten, bestimmt den Filter NICHT.
  horizonMonths: RetirementHorizon;
  // Nacharbeit 5 (ben F4): die HEUTIGE Zugehörigkeit, aus gespeicherter Frist und Bezugszeit
  // abgeleitet: Frist innerhalb der nächsten 24 Monate ⇒ 24, innerhalb von 36 ⇒ 36, sonst null.
  // Ein am 04.10.2026 mit 36 Monaten gepflegter Eintrag (Frist 04.10.2029) gehört am 04.01.2028
  // in den 24-Monats-Blick. Eine verstrichene Frist bleibt im 24-Monats-Blick.
  currentHorizon: RetirementHorizon | null;
  dueAt: string;
  koCount: number;
  openKoIds: string[];
  soleBearer: boolean;
  openGaps: number;
}

export interface RiskHorizonArea {
  category: string;
  managerId: string | null;
  criticality: AssessmentLevel | null;
  singleSource: boolean;
  koCount: number;
  bearers: RiskHorizonBearer[];
}

export interface RiskHorizonView {
  generatedAt: string;
  seesAll: boolean;
  areas: RiskHorizonArea[];
}

export interface RiskHorizonInput {
  kos: readonly KnowledgeObject[];
  busFactor: readonly BusFactorLike[];
  profiles: readonly CategoryProfile[];
  retirement: readonly RetirementEntry[];
  gaps: readonly { status: string; assignee?: string | null }[];
  viewer: { userId: string; seesAll: boolean };
  now: number;
}

/** `now` plus `monate` Kalendermonate (UTC) — dieselbe Rechnung wie `retirementDueAt`. */
function plusMonate(now: number, monate: number): number {
  const d = new Date(now);
  d.setUTCMonth(d.getUTCMonth() + monate);
  return d.getTime();
}

/** Liegt die gespeicherte Frist heute innerhalb der nächsten 24 bzw. 36 Monate? */
export function currentHorizonOf(dueAt: string, now: number): RetirementHorizon | null {
  const frist = Date.parse(dueAt);
  if (Number.isNaN(frist)) {
    return null;
  }
  if (frist <= plusMonate(now, 24)) {
    return 24;
  }
  return frist <= plusMonate(now, 36) ? 36 : null;
}

export function riskHorizon(input: RiskHorizonInput): RiskHorizonView {
  const profileByCat = new Map(input.profiles.map((p) => [p.category, p]));
  const busByCat = new Map(input.busFactor.map((b) => [b.category, b]));
  const retirementBy = new Map(input.retirement.map((r) => [r.userId, r]));
  const openGapsBy = new Map<string, number>();
  for (const g of input.gaps) {
    if (g.status === "offen" && g.assignee) {
      openGapsBy.set(g.assignee, (openGapsBy.get(g.assignee) ?? 0) + 1);
    }
  }

  const kosByCat = new Map<string, KnowledgeObject[]>();
  for (const ko of input.kos) {
    kosByCat.set(ko.category, [...(kosByCat.get(ko.category) ?? []), ko]);
  }
  const categories = new Set([...kosByCat.keys(), ...profileByCat.keys()]);

  const areas: RiskHorizonArea[] = [];
  for (const category of categories) {
    const profile = profileByCat.get(category);
    const managerId = profile?.managerId ?? null;
    if (!input.viewer.seesAll && managerId !== input.viewer.userId) {
      continue;
    }
    const list = kosByCat.get(category) ?? [];
    const urheber = new Set(list.map((k) => k.originalAuthor));
    const bearers: RiskHorizonBearer[] = [];
    for (const userId of urheber) {
      const r = retirementBy.get(userId);
      if (!r) {
        continue;
      }
      const eigene = list.filter((k) => k.originalAuthor === userId);
      bearers.push({
        userId,
        horizonMonths: r.horizonMonths,
        currentHorizon: currentHorizonOf(r.dueAt, input.now),
        dueAt: r.dueAt,
        koCount: eigene.length,
        openKoIds: eigene.filter((k) => k.status !== "validiert").map((k) => k.id),
        soleBearer: urheber.size === 1,
        openGaps: openGapsBy.get(userId) ?? 0,
      });
    }
    bearers.sort((a, b) => a.dueAt.localeCompare(b.dueAt) || a.userId.localeCompare(b.userId));
    areas.push({
      category,
      managerId,
      criticality: profile?.criticality ?? null,
      singleSource: busByCat.get(category)?.singleSource ?? false,
      koCount: list.length,
      bearers,
    });
  }
  areas.sort((a, b) => a.category.localeCompare(b.category));
  return { generatedAt: new Date(input.now).toISOString(), seesAll: input.viewer.seesAll, areas };
}
