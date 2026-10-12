// Berater-Konzept 04.07. (Stufe 3): Verdrahtung der automatischen Konflikterkennung im App-Root.
// Hier — und NUR hier — treffen sich knowledge-object (Kandidaten), reasoner („Konfliktprüfung")
// und conflicts (Anlegen). So bleiben die Modulgrenzen sauber: conflicts kennt weder KO noch Reasoner,
// es bekommt modul-reine Kerntext-Subjekte + einen judge-Callback. Best-effort: ein Fehler in der
// Erkennung darf das Einreichen NIE kippen — das KO ist zu diesem Zeitpunkt bereits gespeichert.
import {
  type ConflictService,
  type DetectSubject,
  type DetectionCoverage,
  coreText,
  emptyCoverage,
} from "../../conflicts";
import {
  type KnowledgeObject,
  type KoService,
  geltungsKollision,
  isConfidential,
} from "../../knowledge-object";
import type {
  ConflictJudgeOutcome,
  DuplicateJudgeOutcome,
  ModelFailureInfo,
  Reasoner,
} from "../../reasoner";
import { type PruefUmfang, vergleichsDeckel } from "./detection-cap";

// RT-001 (bens Sammel-Review 3): die STRUKTURIERTE, anbieterneutrale Reasoner-Fehlerklasse
// (ModelFailureInfo: {failureClass, status?}) → ehrliche, nutzerverständliche Ursache. Das ist der
// PRIMÄRE Weg im normalen Providerpfad (der Reasoner-Ausgang trägt providerFailure); die Regex in ai-check-worker
// ist nur noch ENG BEGRENZTER Fallback für geworfene, uneingeordnete Fehler. Es wird nie Rohtext/
// Anbietername/Status in die Anzeige geführt — nur die Klasse entscheidet den reason-Key.
export function reasonFromModelFailure(
  info: ModelFailureInfo,
): keyof NonNullable<DetectionCoverage["skippedReasons"]> {
  switch (info.failureClass) {
    case "timeout":
      return "model-timeout";
    case "parse":
      return "bad-response";
    case "network":
      return "unreachable";
    case "http": {
      const s = info.status;
      if (s === 401 || s === 403) {
        return "auth";
      }
      if (s === 429) {
        return "rate-limit";
      }
      if (typeof s === "number" && s >= 500 && s <= 599) {
        return "unreachable";
      }
      // Sonstiger HTTP-Status (z. B. 4xx ohne bekannte Bedeutung) → ehrlich generisch.
      return "model-error";
    }
    default:
      return "model-error";
  }
}

// Nur die anbieterneutrale Klasse verlässt den Reasoner-Adapter. Kein Rohtext und kein
// Raten aus der Paar-Stufe: no-model/confidential bestimmt weiterhin das Reasoner-Routing.
export function comparisonFailureReason(
  outcome: ConflictJudgeOutcome | DuplicateJudgeOutcome,
): keyof NonNullable<DetectionCoverage["skippedReasons"]> {
  return outcome.providerFailure
    ? reasonFromModelFailure(outcome.providerFailure)
    : (outcome.failure ?? "model-error");
}

// K0-2: Erkennungs-Gegenstand ist der Kerntext (title+statement+conditions+measures), nicht bodyHtml.
// D-AISTATE PAKET 1 (bens V1): die Vertraulichkeits-MARKE (Boolean, kein Text) + die Inhaltsversion
// (PAKET 4/V5) reisen mit. Vertraulicher Text geht so NIE an die Cloud (der Reasoner nimmt sie bei
// einem vertraulichen Paar aus der Kette), aber die Erkennung überspringt vertrauliche Beiträge
// NICHT mehr pauschal — die (lokale, egress-freie) deterministische Ebene läuft immer.
function toDetectSubject(ko: KnowledgeObject): DetectSubject {
  return {
    refId: ko.id,
    title: ko.title,
    statement: ko.statement,
    conditions: ko.conditions,
    measures: ko.measures,
    category: ko.category,
    tags: ko.tags,
    asset: ko.asset,
    confidential: isConfidential(ko.confidentiality),
    ...(ko.version !== undefined ? { version: ko.version } : {}),
    // R-1632 / R-1633: die Geltung reist mit; ausgelegt wird sie über `geltungsKollision` unten.
    ...(ko.geltung ? { geltung: ko.geltung } : {}),
  };
}

type Ueberspringgrund = keyof NonNullable<DetectionCoverage["skippedReasons"]>;

/**
 * produkt:20261010:rechteentzug-gespraeche-belege (Nacharbeit 35, Befund Ben an b248276; PV-05-04,
 * AW04-K02) — DIE VERARBEITUNGSFREIGABE GILT JE ANBIETERAUFRUF, NICHT JE LAUF.
 *
 * Subjekt und Vergleichspool werden zu Beginn des Laufs gelesen; danach folgen nacheinander die
 * Anbieteraufrufe. Wurde eine Seite inzwischen auf vertraulich hochgestuft oder entfernt, ging bis
 * hierher trotzdem ihr ALTER Text mit der ALTEN Freigabe (Marke `confidential: false`) hinaus — der
 * Versionsschutz (`isCurrent`) und der Abschlussstatus griffen erst danach.
 *
 * Jetzt fragt der Lauf vor JEDEM Aufruf und noch einmal vor der Übernahme seines Ergebnisses den
 * HEUTIGEN Stand beider Seiten über den autoritativen Lesezugang (`KoService.get`) und dieselbe
 * Vertraulichkeitsregel (`isConfidential`) ab, die die Marke setzt. Der Prüfweg reicht nur die
 * Kerntexte durch (services/conflicts, `judge(coreA, coreB, …)`); welche Objekte hinter einem
 * Kerntext stehen, steht deshalb in einer Zuordnung aus genau dem gelesenen Stand. Steht hinter
 * einem Text mehr als ein Objekt, zählt jedes. Ein unbekannter Text geht nie ungeprüft hinaus.
 *
 * Ergebnis `null` = beide Seiten dürfen heute weiter; sonst der Grund, mit dem der Vergleich als
 * übersprungen zählt: `confidential` bei Hochstufung, `model-error` bei entfernter oder nicht mehr
 * lesbarer Seite (der Lauf ist dann ohnehin überholt und wird neu angestoßen).
 */
export function verarbeitungsfreigabe(
  ko: Pick<KoService, "get">,
  stand: readonly KnowledgeObject[],
): (kerne: readonly string[]) => Promise<Ueberspringgrund | null> {
  const jeKern = new Map<string, KnowledgeObject[]>();
  for (const objekt of stand) {
    const kern = coreText(toDetectSubject(objekt));
    jeKern.set(kern, [...(jeKern.get(kern) ?? []), objekt]);
  }
  return async (kerne) => {
    for (const kern of kerne) {
      const seiten = jeKern.get(kern);
      if (!seiten) {
        return "model-error";
      }
      for (const gelesen of seiten) {
        const heute = await ko.get(gelesen.id);
        if (!heute || heute.deletedAt) {
          return "model-error";
        }
        if (isConfidential(heute.confidentiality) && !isConfidential(gelesen.confidentiality)) {
          return "confidential";
        }
      }
    }
    return null;
  };
}

/**
 * Ein Vergleich unter der Verarbeitungsfreigabe: vor dem Anbieteraufruf geprüft (kein Aufruf ohne
 * heutige Freigabe) und vor der Übernahme seines Urteils erneut (ein während des Aufrufs entzogenes
 * Paar legt keinen Befund an und hinterlässt kein Urteil im Paargedächtnis).
 */
export async function unterFreigabe<T>(
  freigabe: (kerne: readonly string[]) => Promise<Ueberspringgrund | null>,
  kerne: readonly [string, string],
  vergleiche: () => Promise<{ verdict: T | null; failureReason: Ueberspringgrund }>,
): Promise<{ verdict: T | null; failureReason: Ueberspringgrund }> {
  const vorher = await freigabe(kerne);
  if (vorher) {
    return { verdict: null, failureReason: vorher };
  }
  const urteil = await vergleiche();
  const nachher = await freigabe(kerne);
  return nachher ? { verdict: null, failureReason: nachher } : urteil;
}

export interface ConflictDetectionDeps {
  ko: KoService;
  conflicts: ConflictService;
  reasoner: Reasoner;
}

// Prüft den frisch eingereichten Beitrag gegen den vorhandenen Bestand und legt erkannte
// Widersprüche automatisch als Konflikte an. Läuft in v1 synchron im Einreiche-Pfad; ohne
// verbundenes KI-Modell ist es ein stiller No-op (judge liefert null — keine Fake-Konflikte,
// K0-3: Demo-Beiträge bleiben außen vor). Wirft nie — Fehler bleiben ohne Wirkung auf das Einreichen.
// AUFTRAG-mega28 A2/A3: der Lauf gibt seine ABDECKUNG zurück (statt void) — geprüfte Menge,
// verfügbare Menge, gedeckelt/übersprungen/abgebrochen. Der Aufrufer (aiCheck-Runner bzw. der
// Import-Accept-Pfad) trägt sie bis dorthin, wo ein Mensch das Urteil liest. Auch der Fehlerpfad
// liefert ein ehrliches Protokoll: es wird VOR dem Lauf angelegt und vom Lauf fortgeschrieben,
// ein geworfener Kapazitätsfehler kann es also nicht mehr verschlucken.
export async function detectConflictsForKo(
  koId: string,
  deps: ConflictDetectionDeps,
  // ben-Review #6: optionaler Log-Haken. Der Fehler bleibt geschluckt (best-effort), wird aber sichtbar,
  // wenn ein Aufrufer (z. B. der Import-Accept-Pfad) einen Logger reicht. Ohne → altes stilles Verhalten.
  log?: (msg: string, err: unknown) => void,
  // AUFNAHME 20260922 · R-1124: `vollstaendig` nur auf ausdrückliche Wahl (s. detection-cap.ts).
  umfang: PruefUmfang = "gedeckelt",
): Promise<DetectionCoverage> {
  const coverage = emptyCoverage();
  try {
    const subject = await deps.ko.get(koId);
    // Demo-Beiträge bleiben außen vor (K0-3). Ein VERTRAULICHES Subjekt überspringt die Erkennung
    // NICHT mehr (bens V1): die deterministische Ebene läuft, die Cloud bleibt gate-geschützt draußen.
    if (!subject || subject.demoSeed) {
      return coverage; // gar kein Lauf — ehrlich „nichts stand zur Wahl", nicht „gedeckelt"
    }
    // D-AISTATE PAKET 1 (bens V1): vertrauliche Kandidaten bleiben im Pool (gemischte Paare werden
    // verglichen) — die Vertraulichkeits-MARKE (toDetectSubject) sorgt dafür, dass die Cloud sie nie
    // sieht. Konflikte haben keine deterministische Ebene: ein vertrauliches Paar ohne lokales Modell
    // liefert kein Urteil (ehrlicher Status "confidential", kein Konflikt erfunden).
    const poolObjekte = (await deps.ko.list()).filter((k) => k.id !== koId && !k.demoSeed);
    const pool = poolObjekte.map(toDetectSubject);
    if (pool.length === 0) {
      return coverage;
    }
    // Nacharbeit 35: die heutige Freigabe beider Seiten vor jedem Aufruf (s. verarbeitungsfreigabe).
    const freigabe = verarbeitungsfreigabe(deps.ko, [subject, ...poolObjekte]);
    await deps.conflicts.detectForSubject(
      toDetectSubject(subject),
      pool,
      (a, b, confidential) =>
        unterFreigabe(freigabe, [a, b], async () => {
          const outcome = await deps.reasoner.judgeConflictOutcome(a, b, "de", confidential);
          return { verdict: outcome.verdict, failureReason: comparisonFailureReason(outcome) };
        }),
      {
        // AUFTRAG-mega28 A1 (Pedi 26.07.): Hier stand bis mega27 `Number.POSITIVE_INFINITY` mit dem
        // Kommentar „bens V2: KEIN stiller Cap 8 im Live-Pfad — jeder Kandidat wird dem Judge
        // vorgelegt". Diese Entscheidung ist ZURÜCKGENOMMEN. Der Deckel ist derselbe wie im
        // Duplikatweg (EIN Wert, s. detection-cap.ts) — und er ist NICHT still: coverage trägt
        // geprüfte/verfügbare Menge bis in die Anzeige.
        // R-1124: im gewählten Vollabgleich weder Deckel noch fachlicher Vorfilter.
        cap: vergleichsDeckel(umfang),
        vollabgleich: umfang === "vollstaendig",
        // bens V5: Stale-Schreibschutz — vor dem Persistieren beide gebundenen Versionen prüfen.
        isCurrent: async (id, version) => (await deps.ko.get(id))?.version === version,
        coverage,
        // R-1632 / R-1633: Widerspruch bei verschiedener Geltung → Kontext-/Rollenkonflikt.
        geltungsKollision,
      },
    );
  } catch (err) {
    // Erkennung ist best-effort — Fehler werden bewusst geschluckt, das Einreichen bleibt erfolgreich.
    // AUFTRAG-mega28 A3: geschluckt heißt NICHT unsichtbar — ein Lauf, der hier landet, ist nie
    // vollständig gelaufen. Das Protokoll sagt das ehrlich, auch wenn der Fehler nicht weiterfliegt.
    coverage.aborted = true;
    log?.(`Konflikterkennung für KO ${koId} fehlgeschlagen`, err);
  }
  return coverage;
}
