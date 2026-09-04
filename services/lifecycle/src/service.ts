import { randomUUID } from "node:crypto";
import type { KnowledgeObject, KoService } from "../../knowledge-object";
import type { LifecycleRepo } from "./repo";
import type { LearningPath, LearningStep } from "./types";

export interface LifecycleServiceDeps {
  koService: KoService;
  repo: LifecycleRepo;
  genId?: () => string;
}

/**
 * JOB 3054: die Merkergrenze, wie ein LESEPFAD sie sehen darf — genau eine schreibfreie Frage.
 *
 * Der Anzeigestatus-Lesepfad braucht vom Lebenszyklusmodul nichts weiter. Nimmt er die Grenze in
 * dieser Form entgegen, kann er `pendingRevalidation()`, `confirmStillValid()` oder `assetChanged()`
 * dort gar nicht erst erreichen — die Zusage „ein Lesepfad schreibt nicht" hält damit der Compiler
 * und nicht eine Sichtprüfung.
 */
export interface RevalidierungMerkerLeser {
  revalidierungAnstehtFuer(koIds: readonly string[]): Promise<ReadonlySet<string>>;
}

export class LifecycleService implements RevalidierungMerkerLeser {
  private readonly koService: KoService;
  private readonly repo: LifecycleRepo;
  private readonly genId: () => string;

  constructor(deps: LifecycleServiceDeps) {
    this.koService = deps.koService;
    this.repo = deps.repo;
    this.genId = deps.genId ?? (() => randomUUID());
  }

  // FR-LIF-01: Anlagen-/Prozesskopplung.
  async couple(assetRef: string, koId: string): Promise<void> {
    await this.repo.addCoupling(assetRef, koId);
  }

  // FR-LIF-01 / Audit B1: gekoppelte Anlagen eines KOs (fürs KO-Detail sichtbar machen).
  couplingsForKo(koId: string): Promise<string[]> {
    return this.repo.couplingsForKo(koId);
  }

  // FR-LIF-01: Anlagenänderung markiert gekoppelte KOs „Stimmt das noch?".
  async assetChanged(assetRef: string): Promise<string[]> {
    const koIds = await this.repo.couplingsFor(assetRef);
    for (const koId of koIds) {
      await this.repo.markPending(koId);
    }
    return koIds;
  }

  // SCRUM-420 (Pedi 03.07.): Selbstheilung — Marker, deren KO nicht mehr existiert (z. B.
  // nach Löschen/Demodaten-Purge), werden beim Lesen ehrlich ENTFERNT statt als Geister-
  // Karten (nackte UUID, „nicht im Bestand") im Arbeitsbereich zu erscheinen. Wirkt für
  // alle Leser derselben Quelle (Arbeitsbereich, Benachrichtigungen, Management-Kennzahlen).
  async pendingRevalidation(): Promise<string[]> {
    const pending = await this.repo.pending();
    const alive: string[] = [];
    for (const koId of pending) {
      if (await this.koService.get(koId)) {
        alive.push(koId);
      } else {
        await this.repo.clearPending(koId);
      }
    }
    return alive;
  }

  // ============================================================================================
  // JOB 3054 · DIE MERKERLAGE FÜR EINEN LESEPFAD — SCHREIBFREI, MENGENWEISE, OHNE OBJEKTPRÜFUNG.
  // ============================================================================================
  //
  // WOFÜR ES DIESEN WEG BRAUCHT. Die zwei Leserouten (`GET /api/kos/:id`, `GET /api/kos`) leiten
  // den Anzeigestatus ab und brauchen dafür genau eine Auskunft: steht für DIESES Objekt ein
  // „Stimmt das noch?" an? Das vorhandene `pendingRevalidation()` beantwortet eine andere Frage —
  // es lädt den GANZEN Merkerbestand, prüft je Merker ein Objekt (N+1) und ENTFERNT tote Merker.
  // Auf einem Lesepfad ist jedes der drei falsch, und der Schreibvorgang ist der Grund, aus dem
  // `revalidierung` bis hierher ausdrücklich als „nicht erhoben" ausgewiesen wurde.
  //
  // WARUM DIESE ABFRAGE KEINE GEISTERKARTEN ERZEUGEN KANN — der Grund, aus dem die Selbstheilung
  // hier fehlen DARF und nicht bloß fehlt: Sie beantwortet ausschließlich Kennungen, die der
  // Aufrufer übergibt, und der Aufrufer übergibt nur Objekte, die er ohnehin schon geladen hat.
  // Ein Merker ohne Objekt kann in ihrer Antwort gar nicht vorkommen; es gibt hier also nichts,
  // was als nackte UUID im Arbeitsbereich erscheinen könnte (SCRUM-420 wirkt auf die Frage „welche
  // Objekte stehen an?", nicht auf „steht dieses an?").
  //
  // ES ENTSTEHT KEIN ZWEITER WEG ZUR MERKERLAGE: `pendingRevalidation()` bleibt unverändert der
  // einzige selbstheilende Arbeitsbereichsweg, `revalidierungAnstehtFuer` der einzige Leseweg.
  // EINE LEERE EINGABE MACHT NULL ABFRAGEN — hier und nicht erst in der Ablage. Eine leere Liste
  // ist ein Ergebnis, keine Frage; ohne diese Zeile zöge eine leere Antwort der Liste einen
  // Ablagenzugriff nach sich. Dieselbe Aufteilung wie bei `ValidationService.pruefstaendeFuer`:
  // der Dienst hält den Aufruf zurück, der Adapter hält zusätzlich das SQL zurück (R-8).
  async revalidierungAnstehtFuer(koIds: readonly string[]): Promise<ReadonlySet<string>> {
    if (koIds.length === 0) {
      return new Set<string>();
    }
    return new Set(await this.repo.pendingFor(koIds));
  }

  // FR-LIF-01: Bestätigung erzeugt eine neue Version.
  async confirmStillValid(koId: string, author: string): Promise<KnowledgeObject> {
    const ko = await this.koService.revise(koId, {}, author);
    await this.repo.clearPending(koId);
    return ko;
  }

  // FR-LIF-02: Admin-Autor-Übergabe; Originalautor bleibt sichtbar.
  async transferAuthor(koId: string, newAuthor: string, actor = "admin"): Promise<KnowledgeObject> {
    return this.koService.setAuthor(koId, newAuthor, actor);
  }

  // FR-LIF-03: Lernpfade — rollenspezifische Einarbeitung.
  async createPath(role: string, steps: readonly { title: string }[]): Promise<LearningPath> {
    const path: LearningPath = {
      id: this.genId(),
      role,
      steps: steps.map<LearningStep>((s) => ({ id: this.genId(), title: s.title })),
    };
    await this.repo.savePath(path);
    return path;
  }

  getPath(role: string): Promise<LearningPath | undefined> {
    return this.repo.getPathByRole(role);
  }

  // FR-LIF-03: Abhaken mit Fortschrittsspeicherung.
  async completeStep(pathId: string, userId: string, stepId: string): Promise<string[]> {
    const done = await this.repo.getProgress(pathId, userId);
    if (!done.includes(stepId)) {
      done.push(stepId);
      await this.repo.setProgress(pathId, userId, done);
    }
    return done;
  }

  progress(pathId: string, userId: string): Promise<string[]> {
    return this.repo.getProgress(pathId, userId);
  }
}
