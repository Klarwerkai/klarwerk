// SCRUM-120: Management-Service. Sammelt echte Live-Daten aus den bestehenden
// Services und ruft die reinen Metriken. Stateless, keine Persistenz, keine KO-Mutation.
import type { KoService } from "../../knowledge-object";
import { computeSnapshot } from "./metrics";
import type { BusFactorLike, ManagementSnapshot } from "./types";

export interface ManagementDeps {
  koService: KoService;
  listGaps: () => Promise<{ status: "offen" | "geschlossen" }[]>;
  countOpenConflicts: () => Promise<number>;
  pendingRevalidation: () => Promise<string[]>;
  busFactor: () => Promise<BusFactorLike[]>;
  now?: () => number;
}

export class ManagementService {
  private readonly deps: ManagementDeps;
  private readonly now: () => number;

  constructor(deps: ManagementDeps) {
    this.deps = deps;
    this.now = deps.now ?? (() => Date.now());
  }

  async snapshot(): Promise<ManagementSnapshot> {
    const [kos, gaps, openConflicts, pending, busFactor] = await Promise.all([
      this.deps.koService.list({}),
      this.deps.listGaps(),
      this.deps.countOpenConflicts(),
      this.deps.pendingRevalidation(),
      this.deps.busFactor(),
    ]);
    const openGaps = gaps.filter((g) => g.status === "offen").length;
    const body = computeSnapshot({
      kos,
      openGaps,
      openConflicts,
      pendingRevalidation: pending,
      busFactor,
      now: this.now(),
    });
    return { generatedAt: new Date(this.now()).toISOString(), ...body };
  }
}
