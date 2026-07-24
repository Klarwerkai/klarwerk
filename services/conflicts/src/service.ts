import { randomUUID } from "node:crypto";
import type { AuditService } from "../../audit";
import {
  type ConflictVerdict,
  type DetectSubject,
  autoDescription,
  coreText,
  decideFromVerdict,
  selectCandidates,
} from "./detect";
import type { ConflictRepo } from "./repo";
import {
  type Conflict,
  type ConflictDetector,
  ConflictError,
  type ConflictInput,
  type ConflictType,
} from "./types";
import {
  type CurrentVersionLookup,
  cachedCurrentVersions,
  isBoundToCurrentVersions,
} from "./version-guard";

// SCRUM-491: Ergebnis-Form des side-effect-freien Dry-Runs (assessAgainstPool). Muster wie
// DryRunOverlap; Konflikterkennung ist rein modellgetrieben (ohne judge keine Kandidaten).
export interface DryRunConflict {
  koId: string;
  koTitle: string;
  type: ConflictType;
  method: "model";
  confidence?: number;
  rationale?: string;
  snippet?: string; // Reserve (Slice 5/6), symmetrisch zu DryRunOverlap.
}

export interface ConflictServiceDeps {
  repo: ConflictRepo;
  audit?: AuditService;
  now?: () => number;
  genId?: () => string;
  // D-AISTATE PAKET 4 (bens V5, aistate-fix5): Versions-Autorität für die fail-closed Lesepfade
  // (unresolved() UND get()/Detail-Route — gemeinsamer Helfer version-guard). Der App-Root bindet
  // sie an den KO-Store (conflicts kennt knowledge-object nicht). Ohne Verdrahtung bleibt das
  // Bestandsverhalten (kein Filter — reine Statusprüfung).
  currentVersion?: CurrentVersionLookup;
  // D-AISTATE PAKET 4 (bens fix5-Recheck §4, aistate-fix6): belastbarer Fehlerkanal für den Lese-GC.
  // Schlägt der superseded-Audit NACH einem gewinnenden CAS-Abschluss fehl, wird der Fehler hierüber
  // SICHTBAR gemeldet (nie kommentarlos verschluckt — sonst bliebe der Datensatz geschlossen ohne
  // Audit still). Default: console.error. Der Read bleibt entkoppelt (fire-and-forget/Makrotask).
  onError?: (context: string, error: unknown) => void;
}

export class ConflictService {
  private readonly repo: ConflictRepo;
  private readonly audit: AuditService | undefined;
  private readonly now: () => number;
  private readonly genId: () => string;
  private readonly currentVersion: CurrentVersionLookup | undefined;
  private readonly onError: (context: string, error: unknown) => void;

  constructor(deps: ConflictServiceDeps) {
    this.repo = deps.repo;
    this.audit = deps.audit;
    this.now = deps.now ?? (() => Date.now());
    this.genId = deps.genId ?? (() => randomUUID());
    this.currentVersion = deps.currentVersion;
    this.onError =
      deps.onError ??
      ((context, error) => {
        console.error(`[conflicts] Lese-GC ${context}:`, error);
      });
  }

  // FR-CON-01: Widerspruch erzeugt einen klassifizierten Konflikt, kein stilles Überschreiben.
  // Berater-Konzept 04.07. (Stufe 4): manuell angelegte Konflikte tragen origin="manual".
  async create(input: ConflictInput, actor = "system"): Promise<Conflict> {
    const conflict: Conflict = {
      id: this.genId(),
      koA: input.koA,
      koB: input.koB,
      type: input.type,
      description: input.description,
      status: "offen",
      secondOpinion: null,
      decidedBy: null,
      decision: null,
      origin: "manual",
      createdAt: new Date(this.now()).toISOString(),
    };
    await this.repo.insert(conflict);
    await this.audit?.record({ actor, action: "conflict.created", target: conflict.id });
    return conflict;
  }

  // Berater-Konzept 04.07. (Stufe 4): automatisch erkannter Konflikt — origin="auto" + detector-
  // Metadaten (Begründung, Zitate, Sicherheit). Eigenes Audit-Vokabular „conflict.auto-created".
  async createAuto(
    input: ConflictInput,
    detector: ConflictDetector,
    actor = "system",
  ): Promise<Conflict> {
    const conflict = this.buildAuto(input, detector);
    await this.repo.insert(conflict);
    await this.recordAutoCreated(conflict, detector, actor);
    return conflict;
  }

  // Baut die auto-Entität OHNE Persistenz — gemeinsame Grundlage für createAuto (ungebunden) und
  // createAutoVersionBound (versions-konditionaler Insert gegen den bereits committeten Stand, NICHT
  // gegen ein Revisions-Interleaving serialisiert — volle Schreib-Serialisierung ist Post-VIP).
  private buildAuto(input: ConflictInput, detector: ConflictDetector): Conflict {
    return {
      id: this.genId(),
      koA: input.koA,
      koB: input.koB,
      type: input.type,
      description: input.description,
      status: "offen",
      secondOpinion: null,
      decidedBy: null,
      decision: null,
      origin: "auto",
      detector,
      // D-AISTATE PAKET 4 (bens V5): geprüfte Versionen additiv mitschreiben (nur wenn vorhanden).
      ...(input.koAVersion !== undefined ? { koAVersion: input.koAVersion } : {}),
      ...(input.koBVersion !== undefined ? { koBVersion: input.koBVersion } : {}),
      createdAt: new Date(this.now()).toISOString(),
    };
  }

  private async recordAutoCreated(
    conflict: Conflict,
    detector: ConflictDetector,
    actor: string,
  ): Promise<void> {
    await this.audit?.record({
      actor,
      action: "conflict.auto-created",
      target: conflict.id,
      payload: { trigger: detector.trigger, method: detector.method },
    });
  }

  // Berater-Konzept 04.07. (Stufe 4): „Fehlalarm — kein Widerspruch". Ein Mensch schließt den
  // (meist automatisch erkannten) Konflikt bewusst als falsch-positiv. Kein Auto-Effekt an den KOs.
  async dismiss(id: string, by: string, note?: string): Promise<Conflict> {
    const conflict = await this.requireOpen(id);
    const saved = await this.save({
      ...conflict,
      status: "geloest",
      decidedBy: by,
      decision: note ?? null,
      resolutionReason: "dismissed",
    });
    await this.audit?.record({ actor: by, action: "conflict.dismissed", target: id });
    return saved;
  }

  // FR-CON-02: nur Wahrheitskonflikte eskalieren an einen Menschen.
  async escalate(id: string, actor = "system"): Promise<Conflict> {
    const conflict = await this.require(id);
    if (conflict.type !== "truth") {
      throw new ConflictError(
        "NOT_ESCALATABLE",
        "Nur Wahrheitskonflikte werden an einen Menschen eskaliert.",
      );
    }
    const saved = await this.save({ ...conflict, status: "eskaliert" });
    await this.audit?.record({ actor, action: "conflict.escalated", target: id });
    return saved;
  }

  // FR-CON-03: Zweitmeinung als Zwischenschritt.
  async secondOpinion(id: string, opinion: string, actor = "system"): Promise<Conflict> {
    const conflict = await this.requireOpen(id);
    const saved = await this.save({ ...conflict, status: "zweitmeinung", secondOpinion: opinion });
    await this.audit?.record({ actor, action: "conflict.second-opinion", target: id });
    return saved;
  }

  // FR-CON-03: Controller-Entscheidung schließt den Wahrheitskonflikt ab.
  async resolve(id: string, decidedBy: string, decision: string): Promise<Conflict> {
    const conflict = await this.requireOpen(id);
    const saved = await this.save({
      ...conflict,
      status: "geloest",
      decidedBy,
      decision,
      resolutionReason: "decided",
    });
    await this.audit?.record({ actor: decidedBy, action: "conflict.resolved", target: id });
    return saved;
  }

  // Konzept 04.07. (Stufe 1) — Geister-Bug: Wird ein beteiligtes Wissensobjekt gelöscht, darf sein
  // Konflikt nicht als „Objekt nicht gefunden" offen hängen bleiben. Alle OFFENEN Konflikte, die
  // dieses KO referenzieren, werden geordnet beendet (participant_deleted) und protokolliert —
  // OHNE Status/Trust des verbleibenden KO automatisch zu ändern (kein stilles Überschreiben).
  // Idempotent: bereits gelöste Konflikte bleiben unberührt. Gibt die Anzahl beendeter Konflikte.
  async onKoRemoved(koId: string, actor = "system"): Promise<number> {
    const affected = (await this.repo.all()).filter(
      (c) => c.status !== "geloest" && (c.koA === koId || c.koB === koId),
    );
    for (const c of affected) {
      await this.save({
        ...c,
        status: "geloest",
        decidedBy: null,
        resolutionReason: "participant_deleted",
      });
      await this.audit?.record({
        actor,
        action: "conflict.participant-removed",
        target: c.id,
        payload: { koId },
      });
      await this.audit?.record({
        actor,
        action: "conflict.auto-resolved",
        target: c.id,
        payload: { reason: "participant_deleted" },
      });
    }
    return affected.length;
  }

  // Berater-Konzept 04.07. (Stufe 2/3): automatische Erkennung für EINEN Beitrag gegen einen bereits
  // geladenen Kandidaten-Pool. Modul-rein — KEIN knowledge-object-Import: der Aufrufer (App-Root)
  // reicht Kerntext-Subjekte + einen judge-Callback (Reasoner „Konfliktprüfung"). Legt je erkanntem
  // Widerspruch EINEN Konflikt an (origin: automatisch, ehrliche Beschreibung mit Begründung) und ist
  // idempotent gegen bereits offene Konflikte desselben Paars — G-2-Zitatprüfung sitzt in
  // decideFromVerdict (kein Konflikt aus Modell-Halluzination). Gibt die neu angelegten Konflikte.
  async detectForSubject(
    subject: DetectSubject,
    pool: readonly DetectSubject[],
    // D-AISTATE PAKET 1 (bens V1): der judge bekommt die restriktivste PAAR-Vertraulichkeit — der
    // Reasoner nimmt bei `true` die Cloud aus der Kette (kein Egress vertraulichen Textes).
    judge: (coreA: string, coreB: string, confidential: boolean) => Promise<ConflictVerdict | null>,
    // D-AISTATE PAKET 4 (bens V5): `isCurrent` prüft vor dem Persistieren, ob beide gebundenen KO-
    // Versionen noch aktuell sind (Stale-Schreibschutz gegen den revise-Race). `cap` bleibt für den
    // Hintergrund-Scan; der Live-aiCheck-Pfad hebt ihn bewusst auf (bens V2 — kein stiller Cap 8).
    options: {
      cap?: number;
      minConfidence?: number;
      actor?: string;
      modelLabel?: string;
      isCurrent?: (koId: string, version: number) => boolean | Promise<boolean>;
    } = {},
  ): Promise<Conflict[]> {
    const candidates = selectCandidates(subject, pool, options.cap ?? 8);
    if (candidates.length === 0) {
      return [];
    }
    const open = (await this.repo.all()).filter((c) => c.status !== "geloest");
    // D-AISTATE PAKET 4 (bens V5): Paar-Dedupe nur für die AKTUELLE Versionskombination. Ein Befund zu
    // einer inzwischen revidierten Fassung (stale) blockt den neuen Lauf NICHT. Altbestand ohne
    // Versionsfelder (oder ein versionsloser Lauf) blockt konservativ wie bisher.
    const hasOpenPair = (aId: string, bId: string, aVer?: number, bVer?: number): boolean =>
      open.some((c) => {
        const sameIds = (c.koA === aId && c.koB === bId) || (c.koA === bId && c.koB === aId);
        if (!sameIds) {
          return false;
        }
        if (c.koAVersion === undefined && c.koBVersion === undefined) {
          return true; // Altbestand-Eintrag → wie bisher blocken
        }
        if (aVer === undefined || bVer === undefined) {
          return true; // versionsloser Lauf → konservativ blocken
        }
        const verFor = (koId: string): number | undefined =>
          c.koA === koId ? c.koAVersion : c.koBVersion;
        return verFor(aId) === aVer && verFor(bId) === bVer;
      });
    const subjectCore = coreText(subject);
    const created: Conflict[] = [];
    for (const cand of candidates) {
      if (hasOpenPair(subject.refId, cand.refId, subject.version, cand.version)) {
        continue;
      }
      let verdict: ConflictVerdict | null;
      try {
        verdict = await judge(
          subjectCore,
          coreText(cand),
          Boolean(subject.confidential) || Boolean(cand.confidential),
        );
      } catch {
        continue; // ein Modellfehler darf die Erkennung (und das Einreichen) nie kippen
      }
      if (!verdict) {
        continue;
      }
      const decision = decideFromVerdict(
        verdict,
        subjectCore,
        coreText(cand),
        options.minConfidence,
      );
      if (!decision.create || decision.type === null) {
        continue;
      }
      // Stufe 4: Herkunfts-/Erkennungs-Metadaten mitschreiben (Board zeigt „Automatisch erkannt ·
      // Sicherheit % · Begründung + Zitate"). modelLabel optional (vom Aufrufer, sonst weglassen).
      const detector: ConflictDetector = {
        trigger: "validation",
        method: "model",
        promptVersion: "kon-v1",
        confidence: verdict.confidence,
        rationale: verdict.begruendung,
        quotes: { a: verdict.zitat_a, b: verdict.zitat_b },
        ...(options.modelLabel ? { modelLabel: options.modelLabel } : {}),
        // SCRUM-492: strukturierte Kollisionsfelder mitschreiben (Board-Kacheln), wenn vorhanden.
        ...(verdict.kollision ? { kollision: verdict.kollision } : {}),
      };
      // D-AISTATE PAKET 4 (bens V5, aistate-fix5): versions-konditionale Aktivierung — Umfang und
      // ehrliche Grenze der Absicherung s. createAutoVersionBound.
      const conflict = await this.createAutoVersionBound(
        {
          koA: subject.refId,
          koB: cand.refId,
          type: decision.type,
          description: autoDescription(verdict),
          ...(subject.version !== undefined ? { koAVersion: subject.version } : {}),
          ...(cand.version !== undefined ? { koBVersion: cand.version } : {}),
        },
        detector,
        options.actor ?? "system",
        options.isCurrent,
      );
      if (!conflict) {
        continue; // stale — Befund zur alten Fassung wurde nicht aktiviert (bzw. sofort geschlossen)
      }
      created.push(conflict);
      open.push(conflict); // im selben Lauf kein zweiter Konflikt für dasselbe Paar
    }
    return created;
  }

  // D-AISTATE PAKET 4 (bens V5, aistate-fix5): VERSIONS-KONDITIONALE Aktivierung eines
  // automatischen Befunds. repo.insertIfVersionsCurrent legt den Datensatz nur an, wenn beide
  // gebundenen KO-Versionen zum Prüfzeitpunkt noch aktuell sind — das schließt den Fall eines
  // bereits VOR der Prüfung committeten neuen Standes (dann entsteht kein Datensatz; das Audit
  // läuft erst NACH der Anlage, ein hängendes/fehlschlagendes Audit erzeugt also keinen Befund,
  // der sonst nicht entstanden wäre — kein Insert-dann-Kompensieren mehr).
  // EHRLICHE GRENZE (bens ROT 1, Pedi D-V5=b): gegen ein GLEICHZEITIGES Revisions-Interleaving
  // (Revision committet zwischen Versionsprüfung und Insert-Commit) ist dieser Schritt NICHT
  // serialisiert — es gibt keine gemeinsame Sperr-/Transaktionsdomäne mit ko.revise. Die volle
  // Schreib-Serialisierung ist bewusst in die Post-VIP-Scheibe (Job-Queue) verschoben. Die
  // Sichtbarkeits-Garantie tragen deshalb:
  //  1. der Revisions-Sweep onKoRevised (aktives Schließen nach einer Revision),
  //  2. der GEMEINSAME fail-closed Read-Filter (version-guard) in unresolved() UND get() samt
  //     Lese-GC — kein aktiver Lesepfad liefert einen stale gebundenen offenen Befund aus.
  // Ohne Versionsbindung (Altbestand/versionsloser Lauf) bleibt das Bestandsverhalten (createAuto).
  private async createAutoVersionBound(
    input: ConflictInput,
    detector: ConflictDetector,
    actor: string,
    isCurrent?: (koId: string, version: number) => boolean | Promise<boolean>,
  ): Promise<Conflict | null> {
    const guarded =
      input.koAVersion !== undefined && input.koBVersion !== undefined && isCurrent !== undefined;
    if (!guarded) {
      return this.createAuto(input, detector, actor);
    }
    const conflict = this.buildAuto(input, detector);
    const inserted = await this.repo.insertIfVersionsCurrent(conflict, isCurrent);
    if (!inserted) {
      return null; // stale — es wurde GAR KEIN Datensatz committed (kein Audit, nichts sichtbar)
    }
    await this.recordAutoCreated(conflict, detector, actor);
    return conflict;
  }

  // D-AISTATE PAKET 4 (bens V5, aistate-fix3): Revisions-Sweep — eine inhaltliche Überarbeitung
  // eines KOs macht ALLE offenen Befunde, die eine ÄLTERE Version dieses KOs gebunden haben,
  // systemisch gegenstandslos (superseded). Board/Badges/Benachrichtigungen (alles über
  // unresolved()) zeigen danach keinen veralteten offenen Fund mehr; der frische Prüf-Job der
  // neuen Version legt bei Bedarf einen neuen, korrekt gebundenen Befund an. Versionslose
  // Alt-Befunde bleiben bewusst unberührt (keine Bindung — konservatives Bestandsverhalten).
  // Idempotent; gibt die Anzahl geschlossener Befunde zurück.
  async onKoRevised(koId: string, currentVersion: number, actor = "system"): Promise<number> {
    const stale = (await this.repo.all()).filter((c) => {
      if (c.status === "geloest") {
        return false;
      }
      const boundStale =
        (c.koA === koId && c.koAVersion !== undefined && c.koAVersion !== currentVersion) ||
        (c.koB === koId && c.koBVersion !== undefined && c.koBVersion !== currentVersion);
      return boundStale;
    });
    for (const c of stale) {
      await this.save({ ...c, status: "geloest", decidedBy: null, resolutionReason: "superseded" });
      await this.audit?.record({
        actor,
        action: "conflict.superseded",
        target: c.id,
        payload: { koId, currentVersion },
      });
    }
    return stale.length;
  }

  // SCRUM-491: Side-effect-freier Dry-Run (symmetrisch zu OverlapService.assessAgainstPool). Konflikt-
  // erkennung ist rein modellgetrieben — ohne judge gibt es keine Kandidaten (kein deterministischer
  // Pfad). Dieselbe Urteilslogik (selectCandidates → judge → decideFromVerdict) wie detectForSubject,
  // aber OHNE Persistenz: kein repo.all(), kein createAuto/Insert, kein Audit.
  async assessAgainstPool(
    subject: DetectSubject,
    pool: readonly DetectSubject[],
    judge?: (coreA: string, coreB: string) => Promise<ConflictVerdict | null>,
    options: { cap?: number; minConfidence?: number } = {},
  ): Promise<DryRunConflict[]> {
    if (!judge) {
      return [];
    }
    const candidates = selectCandidates(subject, pool, options.cap ?? 8);
    const subjectCore = coreText(subject);
    const results: DryRunConflict[] = [];
    for (const cand of candidates) {
      let verdict: ConflictVerdict | null;
      try {
        verdict = await judge(subjectCore, coreText(cand));
      } catch {
        continue;
      }
      if (!verdict) {
        continue;
      }
      const decision = decideFromVerdict(
        verdict,
        subjectCore,
        coreText(cand),
        options.minConfidence,
      );
      if (!decision.create || decision.type === null) {
        continue;
      }
      results.push({
        koId: cand.refId,
        koTitle: cand.title,
        type: decision.type,
        method: "model",
        confidence: verdict.confidence,
        rationale: verdict.begruendung,
      });
    }
    return results;
  }

  // FR-CON-04: alle ungelösten Konflikte (jeder Status außer gelöst).
  // D-AISTATE PAKET 4 (bens V5, aistate-fix5): FAIL-CLOSED versionsgebunden über den GEMEINSAMEN
  // Helfer isBoundToCurrentVersions (derselbe Vertrag wie get() und damit die Detail-Route) — ein
  // Befund, dessen gebundene KO-Version nicht mehr der aktuellen entspricht (oder deren aktuelle
  // Version nicht ermittelbar ist), wird HART herausgefiltert. Ein SICHER stale offener Befund
  // wird zusätzlich best-effort per Lese-GC geschlossen (s. gcStaleOpen); der Revisions-Sweep
  // (onKoRevised) bleibt das aktive Schließen, dieser Filter die Rückfall-Sicherung. Altbestand
  // ohne Versionsfelder bleibt konservativ sichtbar (keine Regression).
  async unresolved(): Promise<Conflict[]> {
    const open = (await this.repo.all()).filter((c) => c.status !== "geloest");
    const lookup = this.currentVersion;
    if (!lookup) {
      return open; // keine Versions-Autorität verdrahtet → Bestandsverhalten
    }
    const current = cachedCurrentVersions(lookup);
    const result: Conflict[] = [];
    for (const c of open) {
      const verdict = await isBoundToCurrentVersions(c, current);
      if (verdict.visible) {
        result.push(c);
      } else if (verdict.stale) {
        this.gcStaleOpen(c.id, verdict.stale);
      }
    }
    return result;
  }

  // FR-CON-04: Zähler für das Sidebar-Badge.
  async badgeCount(): Promise<number> {
    return (await this.unresolved()).length;
  }

  // D-AISTATE PAKET 4 (bens V5, aistate-fix5, ROT 2): der Detail-Lesepfad ist FAIL-CLOSED — ein
  // OFFENER Befund mit stale (oder nicht ermittelbarer) Versionsbindung wird NICHT mehr roh
  // durchgereicht, sondern wie „nicht vorhanden" behandelt (die Route macht daraus ein ehrliches
  // 404); ein SICHER stale offener Befund wird zusätzlich per Lese-GC geschlossen. GESCHLOSSENE
  // Befunde bleiben abrufbar (ehrlicher Grabstein: status geloest + superseded — nie ein offener
  // stale Befund).
  async get(id: string): Promise<Conflict | undefined> {
    const conflict = await this.repo.findById(id);
    const lookup = this.currentVersion;
    if (!conflict || conflict.status === "geloest" || !lookup) {
      return conflict;
    }
    const verdict = await isBoundToCurrentVersions(conflict, cachedCurrentVersions(lookup));
    if (verdict.visible) {
      return conflict;
    }
    if (verdict.stale) {
      this.gcStaleOpen(id, verdict.stale);
    }
    return undefined;
  }

  // D-AISTATE PAKET 4 (bens V5, aistate-fix5; ROT-Härtung aistate-fix6): Lese-GC — ein beim Lesen
  // entdeckter, SICHER stale gebundener OFFENER Befund (Karteileiche aus dem bewusst nicht
  // serialisierten Schreib-Race, Pedi D-V5=b) wird best-effort systemisch geschlossen (superseded,
  // by=null — analog onKoRevised, das der aktive Haupt-Weg bleibt). Feuern-und-vergessen (Makrotask):
  // der Read wird nicht blockiert. NEBENLÄUFIGKEITSSICHER (bens fix5-Recheck §2.2/§4):
  //  - repo.supersedeIfOpen ist ein STATUS-CAS (schließt nur den noch offenen Befund, atomar). Kein
  //    Check-then-Act-Fenster mehr: eine zwischenzeitliche MENSCHLICHE Entscheidung (Status ≠ "offen")
  //    gewinnt das CAS, der GC überschreibt sie NIE (kein Lost Update).
  //  - NUR der CAS-Gewinner (won=true) auditiert ⇒ genau EIN superseded-Audit, auch bei mehreren
  //    parallelen GC-Läufen; Verlierer tun NICHTS (kein Update, kein Audit).
  //  - AUDIT-AUSFALL EHRLICH: schlägt der Audit NACH gewinnendem CAS fehl, wird der Fehler über
  //    onError SICHTBAR gemeldet (nicht kommentarlos verschluckt) — der Abschluss bleibt konsistent,
  //    das fehlende Audit ist im Log/Metrik sichtbar statt dauerhaft still.
  // Bei NICHT ermittelbarer aktueller Version wird gar nicht erst hierher verzweigt (nur ausgeblendet
  // — ein transienter Lookup-Fehler darf keinen Befund beenden; s. version-guard).
  private gcStaleOpen(id: string, stale: { koId: string; currentVersion: number }): void {
    setTimeout(() => {
      void (async () => {
        const won = await this.repo.supersedeIfOpen(id, {
          status: "geloest",
          decidedBy: null,
          resolutionReason: "superseded",
        });
        if (!won) {
          return; // Verlierer: schon geschlossen/menschlich entschieden — kein Update, kein Audit.
        }
        await this.audit?.record({
          actor: "system",
          action: "conflict.superseded",
          target: id,
          payload: { koId: stale.koId, currentVersion: stale.currentVersion, via: "read-gc" },
        });
      })().catch((error) => {
        // best-effort: den Lesepfad nie blockieren, aber den Fehler NICHT still schlucken (ein
        // fehlender Audit nach gewinnendem CAS bliebe sonst dauerhaft unsichtbar).
        this.onError(`superseded audit (${id})`, error);
      });
    }, 0);
  }

  private async save(conflict: Conflict): Promise<Conflict> {
    await this.repo.update(conflict);
    return conflict;
  }

  private async require(id: string): Promise<Conflict> {
    const conflict = await this.repo.findById(id);
    if (!conflict) {
      throw new ConflictError("NOT_FOUND", "Konflikt nicht gefunden.");
    }
    return conflict;
  }

  private async requireOpen(id: string): Promise<Conflict> {
    const conflict = await this.require(id);
    if (conflict.status === "geloest") {
      throw new ConflictError("ALREADY_RESOLVED", "Konflikt ist bereits gelöst.");
    }
    return conflict;
  }
}
