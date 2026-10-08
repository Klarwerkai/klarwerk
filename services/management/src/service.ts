// SCRUM-120: Management-Service. Sammelt echte Live-Daten aus den bestehenden
// Services und ruft die reinen Metriken. Keine KO-Mutation. Einzige eigene Ablage seit Nacharbeit 3:
// die gepflegten Bereichsprofile und Ruhestandshorizonte (profiles.ts, über `deps.profiles`).
import type { KnowledgeObject, KoService } from "../../knowledge-object";
import { type RiskHorizonView, riskHorizon } from "./horizon";
import { bereichsSignale, computeSnapshot, gapSignal, signalSignatur } from "./metrics";
import {
  type CategoryProfile,
  type ManagementProfileRepo,
  type RetirementEntry,
  normalizeCategoryProfile,
  normalizeRetirementHorizon,
  retirementDueAt,
} from "./profiles";
import type {
  BusFactorLike,
  GapJudge,
  GapJudgeOutcome,
  GapVerdictEntry,
  ManagementSnapshot,
  MetricsInput,
} from "./types";

/** Höchstzahl der Betrachtersichten, die die regelmäßige Analyse führt. */
export const MAX_SICHTEN = 50;
/** Vorgabetakt der regelmäßigen Lückenerkennung (server.ts, überschreibbar per Umgebung). */
export const WISSENSSPRINT_TAKT_MS = 15 * 60_000;

interface Sichtanalyse {
  sichtbar: (ko: KnowledgeObject) => boolean;
  urteile: Map<string, GapVerdictEntry>;
  analysiertAm: string | null;
  provider: string | null;
  failure: string | null;
}

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
  // R-1657 (Nacharbeit 2): der Weg zum Reasoner-Urteil über die Kennzahlen je Bereich. Optional:
  // ohne ihn gilt für die Wissens-Sprints die benannte Regel (metrics.ts).
  judgeGaps?: GapJudge;
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
  // NAMEN, Knowledge-House-Zeilen mit `category`/`koCount`/`validatedRatio` und die
  // 30/60/90-Tage-Fenster. Ein einzelnes vertrauliches KO konnte eine neue Kategoriezeile
  // erzeugen, Zeitfenster verändern und mehrere globale Scores verschieben; bei einer
  // vertraulich-only Kategorie zeigte `house` unmittelbar Name und `koCount: 1`.
  //
  // `sichtbar` ist PFLICHT und greift an der GRUNDMENGE — vor `computeSnapshot`, nicht danach.
  async snapshot(opts: {
    sichtbar: (ko: KnowledgeObject) => boolean;
    // R-1657 (Nacharbeit 2): die Kennung der Betrachtersicht (die Route setzt die Nutzerkennung).
    // Mit ihr wird die Sicht für die regelmäßige Reasoner-Analyse vorgemerkt, und deren Urteile
    // fließen in die Sprint-Vorschläge. Ohne sie bleibt es bei der benannten Regel.
    sicht?: string;
  }): Promise<ManagementSnapshot> {
    const analyse = opts.sicht ? this.merkeSicht(opts.sicht, opts.sichtbar) : undefined;
    const input = await this.eingang(opts);
    const body = computeSnapshot({ ...input, gapVerdicts: analyse?.urteile ?? null });
    return {
      generatedAt: new Date(this.now()).toISOString(),
      ...body,
      sprintAnalysis: {
        regular: this.intervallMs !== null,
        intervalMs: this.intervallMs,
        analyzedAt: analyse?.analysiertAm ?? null,
        provider: analyse?.provider ?? null,
        failure: analyse?.failure ?? null,
      },
    };
  }

  /** Der Eingang der Metriken über der SICHTBAREN Grundmenge — für Snapshot und Analyse gleich. */
  private async eingang(opts: {
    sichtbar: (ko: KnowledgeObject) => boolean;
  }): Promise<MetricsInput> {
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
    return {
      kos,
      openGaps,
      openConflicts,
      pendingRevalidation: pending.filter((id) => sichtbareIds.has(id)),
      busFactor,
      now: this.now(),
      openConflictKoIds: konfliktIds,
      categoryProfiles: profile,
    };
  }

  // ==============================================================================================
  // R-1657 (Nacharbeit 2) — DIE REGELMÄSSIGE LÜCKENERKENNUNG ÜBER DEN REASONER.
  // ==============================================================================================
  //
  // Quelle: „KLARWERK analysiert regelmäßig …". Der Lauf (`wissenssprintLauf`, im Takt gestartet
  // von services/app/src/server.ts) geht über jede vorgemerkte Betrachtersicht, rechnet deren
  // Kennzahlen je Bereich über GENAU DEM, was diese Sicht sehen darf, und legt dem Reasoner die
  // Bereiche vor, deren Kennzahlen sich seit dem letzten Urteil geändert haben.
  //
  // WARUM JE SICHT UND NICHT EINMAL ÜBER DEN GANZEN BESTAND: ein Urteil über den Gesamtbestand,
  // das nur bei passenden Kennzahlen gezeigt wird, verriete durch sein Fehlen, dass ein Bereich
  // unsichtbare Objekte trägt. Je Sicht entsteht jedes Urteil ausschliesslich aus deren eigenem
  // sichtbaren Bestand; ob es vorliegt, hängt nur an ihrem eigenen Abruf.
  //
  // Begrenzung: höchstens MAX_SICHTEN Sichten, die zuletzt abgerufenen bleiben. Alles liegt im
  // Prozessspeicher; nach einem Neustart urteilt der nächste Lauf neu.
  private readonly sichten = new Map<string, Sichtanalyse>();
  private intervallMs: number | null = null;
  private sofortAnalysieren = false;
  private laufend: Promise<number> | null = null;

  /**
   * Schaltet die regelmäßige Analyse für diesen Prozess als aktiv (der Takt selbst steht in
   * server.ts). Ab dann wird eine NEU vorgemerkte Sicht sofort einmal analysiert, statt bis zum
   * nächsten Takt zu warten.
   */
  regelmaessigeAnalyseAktiv(intervallMs: number): void {
    this.intervallMs = intervallMs;
    this.sofortAnalysieren = true;
  }

  private merkeSicht(schluessel: string, sichtbar: Sichtanalyse["sichtbar"]): Sichtanalyse {
    const vorhanden = this.sichten.get(schluessel);
    const sicht: Sichtanalyse = vorhanden ?? {
      sichtbar,
      urteile: new Map(),
      analysiertAm: null,
      provider: null,
      failure: null,
    };
    sicht.sichtbar = sichtbar; // die jüngste Sichtbarkeitsentscheidung gilt
    // Zuletzt abgerufen = zuletzt eingefügt; die älteste fällt bei Überlauf heraus.
    this.sichten.delete(schluessel);
    this.sichten.set(schluessel, sicht);
    while (this.sichten.size > MAX_SICHTEN) {
      const aelteste = this.sichten.keys().next().value;
      if (aelteste === undefined) {
        break;
      }
      this.sichten.delete(aelteste);
    }
    if (!vorhanden && this.sofortAnalysieren && this.deps.judgeGaps) {
      // Erstes Urteil für diese Sicht ohne Wartezeit — der Abruf selbst wartet nicht darauf.
      void this.analysiereSicht(sicht).catch(() => undefined);
    }
    return sicht;
  }

  /**
   * EIN regelmäßiger Lauf über alle vorgemerkten Sichten. Gibt die Zahl der analysierten Sichten
   * zurück. Überlappt nie mit sich selbst: läuft schon einer, wird dessen Ergebnis abgewartet.
   */
  wissenssprintLauf(): Promise<number> {
    if (!this.deps.judgeGaps) {
      return Promise.resolve(0);
    }
    if (this.laufend) {
      return this.laufend;
    }
    this.laufend = (async () => {
      let n = 0;
      for (const sicht of [...this.sichten.values()]) {
        await this.analysiereSicht(sicht);
        n += 1;
      }
      return n;
    })().finally(() => {
      this.laufend = null;
    });
    return this.laufend;
  }

  private async analysiereSicht(sicht: Sichtanalyse): Promise<void> {
    const judge = this.deps.judgeGaps;
    if (!judge) {
      return;
    }
    const signale = bereichsSignale(await this.eingang({ sichtbar: sicht.sichtbar }));
    const aktuell = new Set(signale.map((s) => s.bereich));
    for (const bereich of [...sicht.urteile.keys()]) {
      if (!aktuell.has(bereich)) {
        sicht.urteile.delete(bereich);
      }
    }
    const offen = signale.filter(
      (s) => sicht.urteile.get(s.bereich)?.signatur !== signalSignatur(s),
    );
    sicht.analysiertAm = new Date(this.now()).toISOString();
    if (offen.length === 0) {
      return;
    }
    let ausgang: GapJudgeOutcome;
    try {
      ausgang = await judge(
        offen.map(gapSignal),
        offen.some((s) => s.confidential),
      );
    } catch {
      ausgang = { urteile: null, failure: "model-error" };
    }
    if (!ausgang.urteile) {
      sicht.failure = ausgang.failure ?? "model-error";
      return;
    }
    const nachBereich = new Map(ausgang.urteile.map((u) => [u.bereich, u]));
    for (const s of offen) {
      sicht.urteile.set(s.bereich, {
        signatur: signalSignatur(s),
        urteil: nachBereich.get(s.bereich) ?? null,
      });
    }
    sicht.provider = ausgang.provider ?? null;
    sicht.failure = null;
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
