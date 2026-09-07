import type { FastifyPluginAsync } from "fastify";
import {
  type ConflictService,
  type ConflictVerdict,
  type OverlapService,
  coreText,
} from "../../../conflicts";
import type {
  Confidentiality,
  KnowledgeObject,
  KoService,
  KoStatus,
} from "../../../knowledge-object";
import type { JudgeFailure, Reasoner } from "../../../reasoner";
import { authorizesCheckText } from "../addon-principal";
import { addonRateLimit } from "../addon-rate-limit";
import {
  type CheckTextConflict,
  type CheckTextResult,
  type CheckTextSourceHit,
  checkText,
} from "../check-text-detection";
import type { SemanticPrefilter } from "../duplicate-detection";
import type { Guards, SessionUser } from "../http";
import {
  type SqlSichtbarkeitstrim,
  sichtbarkeitsfilterFuer,
  sqlSichtbarkeitFuer,
} from "../sichtbarkeit";
import { classifyProvenanceConfidential } from "./reasoner-routes";

// SCRUM-491 Slice 5/6: POST /api/check-text gegen den VALIDIERTEN Bestand, KEINE Persistenz
// (kein KO/Gap/Board/Inhalts-Audit — Dry-Run-Kern-Garantie). Nur registriert bei Flag AN (build-app.ts)
// → Flag AUS = Endpunkt existiert nicht = bit-identisch.
//   Stufe 1 (want fehlend / != "deep"): rein deterministisch — KEIN Modell, KEIN embed, kein
//     Textabfluss (Slice-4-Garantie ohne Judge). Byte-identisch zu Slice 5.
//   Stufe 2 (SCRUM-491 D4, want:"deep"): der 92%/26%-Moment auf Knopfdruck — DERSELBE checkText-Kern,
//     aber MIT duplicateJudge (reasoner.judgeDuplicate) + Semantic-Prefilter. Das ist bewusster
//     Textabfluss (Modell + Embedder) — die DSGVO-Grenze aus D4: NUR bei want:"deep", nie automatisch.
const MIN_TEXT = 40;
const MAX_TEXT = 8_000;

// SCRUM-498 (WP-D): expliziter Route-bodyLimit (statt des globalen 1-MiB-Fastify-Default) — Konsistenz
// zu /api/ask (ASK_BODY_LIMIT, ask-routes.ts). 128 KiB deckt einen 8.000-Codepoint-Text (roh bis
// ~96 KiB bei Escape-Worst-Case) plus title + Envelope/Zusatzfelder komfortabel; Bodies darüber liegen
// außerhalb der gültigen Hülle → kontrolliertes 413 statt des globalen 1-MiB-Defaults.
const CHECK_TEXT_BODY_LIMIT = 128 * 1024; // 128 KiB

// ben-Review-Fix: Body-Schema als Quelle der INHALTLICHEN Eingabe-Validierung (Länge/Typ der Felder).
// Fehlender/null/malformer Body oder text außerhalb 40–8.000 → Fastify liefert einen kontrollierten 400
// in der validation-Phase (kein Handler-Zugriff auf undefined, KEINE interne TypeError/500 nach außen).
// SCRUM-498 (WP-D): die GRÖSSE des Bodies selbst prüft zusätzlich CHECK_TEXT_BODY_LIMIT (Transport-Cap,
// vor der Schema-Validierung) — zusammen bilden beide die vollständige Eingabe-Härtung. want bleibt
// bewusst ein freier String (kein enum), damit "deep" das Schema passiert und im Handler die klare
// „noch nicht"-Meldung erzeugt; locale bleibt permissiv (Handler normalisiert auf de/en).
const bodySchema = {
  type: "object",
  required: ["text"],
  properties: {
    text: { type: "string", minLength: MIN_TEXT, maxLength: MAX_TEXT },
    title: { type: "string" },
    locale: { type: "string" },
    want: { type: "string" },
    // SCRUM-502 Schicht 2 (Round 3): Herkunft des GEPRÜFTEN Textes (fail-safe). Optional im Schema,
    // damit Alt-Clients (z. B. das Add-in) NICHT 400 bekommen — fehlt/ungültig → im Handler
    // vertraulich → deterministisch-only (kein Embedder/Cloud-Judge), nie unbemerkter Cloud-Egress.
    source: { type: "string" },
    koId: { type: "string" },
    confidentiality: { type: "string" },
  },
} as const;

export interface CheckTextRouteDeps {
  ko: KoService;
  overlaps: OverlapService;
  // Stufe 2 (want:"deep"): Modell-Urteil + semantischer Vorfilter. Der Prefilter ist env-gegated
  // (KLARWERK_DUP_PREFILTER); fehlt er, fällt checkText auf die gedeckelte lexikalische Kandidatenwahl
  // zurück — der Judge (Modell) läuft trotzdem. Für Stufe 1 werden beide bewusst NICHT übergeben.
  reasoner: Reasoner;
  semanticPrefilter?: SemanticPrefilter | undefined;
  // ============================================================================================
  // JOB 1970 RIEGEL 1 — DER KONFLIKTDIENST KANN JETZT HEREIN, UND ER MUSS ES NICHT.
  // ============================================================================================
  //
  // KA7 (Widerspruchs-Hinweis) zeigt Serverbefunde; die Quelle dafuer ist diese Route. Der Kern
  // `checkText` fuehrt den Konfliktzweig laengst — er bleibt ohne Dienst schlicht leer
  // (`check-text-detection.ts:186-188`: `deps.conflicts ? await … : []`). Was fehlte, war der
  // Weg hierher.
  //
  // OPTIONAL UND ADDITIV, mit Absicht: die Kompositionswurzel reicht heute KEINEN Konfliktdienst
  // durch (`build-app.ts:1328-1337` — gemessen). Ohne ihn verhaelt sich diese Route byteweise wie
  // vorher, und die gesetzte Zusicherung `expect(body.conflicts).toEqual([])`
  // (`check-text-routes.test.ts:124`) bleibt unangetastet. Erst wenn jemand den Dienst hier
  // hereinreicht, traegt die Antwort Konflikte — und dann sind es ECHTE, keine erfundenen.
  conflicts?: ConflictService | undefined;
}

// Ergebnis-Form → Response-Vertrag. snippet OPTIONAL (der Kern erzeugt heute keinen Beleg-Snippet →
// Feld nur führen, wenn vorhanden; NICHT fabrizieren). confidence/rationale sind für den
// deterministischen Pfad regulär leer → als null geführt (stabile Form, kein erfundener Wert).
// SCRUM-502 Schicht 2 (Round 3): `note` trägt den ehrlichen Hinweis, wenn eine want:"deep"-Prüfung
// wegen vertraulichem Text auf den deterministischen Pfad zurückfällt (kein Embedder/Cloud-Judge).
// JOB 3020: `koStatus`/`koCategory` reichen den FUNDORT additiv nach außen — in duplicates UND
// conflicts, in derselben Form. Beide Werte stammen aus dem Kern (check-text-detection.ts) und damit
// aus dem bereits geladenen Pool; die Route lädt nichts nach und rät nichts. `null` heißt „der
// Bestand sagt dazu nichts" (fehlende Kategorie) — kein Platzhalter, kein Standardwert.
// ==================================================================================================
// JOB 3093 (M3 „Haben wir das schon?", Pedi 05.09.) — DER TREFFER SAGT, WIE WEIT ER IST UND WO ER LIEGT.
// ==================================================================================================
//
// `koStatus`/`koCategory` sind der ROHE Vertrag aus JOB 3020 (die Web-Anzeige liest ihn, JOB 3045)
// und bleiben unverändert. ZUSÄTZLICH — nicht stattdessen — trägt jeder Treffer drei Felder, die ein
// Mensch im Word-Panel ohne Vorwissen lesen kann:
//   · `pruefstand`  — „validiert" oder „eingereicht". Ein Wissensobjekt ist entweder validiert oder
//                     offen (`KoStatus`); „offen" heißt: eingereicht, noch nicht geprüft. ENTWÜRFE
//                     erreichen diese Route nie — sie sind keine Wissensobjekte (services/capture),
//                     und der Pool entsteht aus Wissensobjekten (Pedi 05.09. 12:03: N1c NEIN).
//   · `version`     — die Inhaltsversion des Objekts, gelesen am geladenen Pool-Eintrag.
//   · `fundort`     — Kategorie, der Bereich und der Pfad zum Volltext. Die Bibliothek führt die
//                     Kategorie unter dem Menü „Bereich" (BibliothekFlaeche.tsx, `BEREICH_KEY =
//                     "category"`): `bereich` ist deshalb derselbe Wert wie `kategorie`, hier
//                     ausdrücklich unter dem Namen, den die Bibliothek dem Menschen zeigt — KEINE
//                     zweite Ableitung. `bibliothekPfad` ist die Detailroute `/wissen/:id`, dieselbe
//                     Fläche, die die Bibliothek rechts zeigt (pages/Library.tsx).
// null-Regel wie bei JOB 3020: fehlt dem Bestand die Kategorie, steht `null` — kein Platzhalter.
//
// JOB 3094 (KA7, Pedi 05.09. „drei Tage gegen zwei") — DIE BEIDEN STELLEN REISEN MIT, UND DIE ANTWORT
// SAGT, OB DIE KONFLIKTPRÜFUNG ÜBERHAUPT GELAUFEN IST.
// ==================================================================================================
//
// ERSTE LÜCKE: das Modellurteil trägt seit SCRUM-492 zwei wörtliche Zitate (`ConflictVerdict.zitat_a`
// aus dem geprüften Text, `zitat_b` aus der Quelle; services/conflicts/src/detect.ts:41-42) — der
// Konfliktdienst prüft sie sogar auf Wörtlichkeit (`quotesVerbatim`), bevor er den Treffer führt.
// Bis hierher kam davon NUR `rationale` (ein Satz) in die Antwort; ein Panel hätte die Stellen aus
// dem Satz herausraten müssen. Jetzt trägt jeder Konflikttreffer `stellen: { eigen, quelle }`.
//
// WOHER DIE ZITATE KOMMEN, ohne die Modulgrenze zu verschieben: `DryRunConflict` (services/conflicts)
// führt die Zitate nicht, und dieses Modul ist nicht Zielpfad dieses Auftrags. Deshalb hört die Route
// am Urteil selbst mit: der `conflictJudge`, den sie ohnehin baut, merkt sich jedes Urteil unter dem
// Kerntext der Quelle (dem zweiten Argument `b`). Nach dem Lauf lädt sie zu jedem Treffer die Quelle
// nach, bildet denselben Kerntext und findet das Urteil wieder. Findet sie es nicht (Quelle nicht
// mehr ladbar, Kerntext abweichend), steht `stellen: null` — der Konflikt bleibt GENANNT, die Stellen
// werden nicht erfunden.
//
// ZWEITE LÜCKE: `conflicts: []` sah in vier Lagen gleich aus — Prüfung nicht angefordert (kein
// want:"deep"), vertraulich (deterministischer Rückfall), Modell nicht verfügbar, oder wirklich
// geprüft und nichts gefunden. „Keine Abweichung" darf ein Panel nur in der vierten Lage sagen
// (Zustandsmodell §9). `konfliktpruefung` macht die Lagen unterscheidbar: `gelaufen` ist nur wahr,
// wenn der tiefe, nicht vertrauliche Zweig lief UND (bei vorgelegten Quellen) mindestens ein Urteil
// zurückkam; `kandidaten` zählt die dem Modell vorgelegten Quellen, `ausgefallen` die ohne Urteil.
//
// `pruefstand` und `version` nennen die Quelle so, wie das Panel sie einem Menschen zeigt (Titel,
// Version, Prüfstand) — `koStatus`/`koCategory` bleiben der rohe Vertrag aus JOB 3020, unverändert.
type Pruefstand = "validiert" | "eingereicht";

function pruefstandVon(status: KoStatus | null): Pruefstand | null {
  if (status === "validiert") {
    return "validiert";
  }
  return status === "offen" ? "eingereicht" : null;
}

function fundortVon(koId: string, koCategory: string | null) {
  const kategorie = koCategory ?? null;
  return {
    kategorie,
    bereich: kategorie,
    bibliothekPfad: `/wissen/${encodeURIComponent(koId)}`,
  };
}

interface Stellen {
  /** Die Stelle im GEPRÜFTEN Text (Pedis Memo: „an drei Tagen pro Woche"). */
  eigen: string | null;
  /** Die widersprechende Stelle in der Quelle („an zwei Tagen pro Woche"). */
  quelle: string | null;
}

type KonfliktpruefungGrund =
  | "nicht_angefordert"
  | "vertraulich"
  | "kein_konfliktdienst"
  | "kein_modell"
  | "modellfehler"
  | "urteil_verworfen";

// JOB 3094 R6 (Codex R5, Korrekturpflicht 1): `gelaufen` heißt BELASTBAR gelaufen — jede vorgelegte
// Quelle hat ein Urteil bekommen, das der Konfliktdienst auch gelten ließ. Drei Wege, auf denen das
// vorher still zu „erfolgreich leer" wurde:
//   · der Judge WIRFT (Netz, Provider): `assessAgainstPool` fängt und geht zum nächsten Kandidaten
//     (conflicts/src/service.ts `catch { continue; }`) — die Route sah gar keinen Kandidaten;
//   · das Urteil sagt Widerspruch, aber der Dienst VERWIRFT es (Zitate nicht wörtlich in den Texten,
//     `quotesVerbatim`, oder Sicherheit unter der Schwelle, `decideFromVerdict`) — die Route zählte es
//     als Urteil, der Konflikt fehlte, das Panel sagte „keine Abweichung";
//   · ein Teil der Quellen ohne Urteil galt als „gelaufen, m davon ohne Urteil" — eine Leere, die
//     niemand belegt hat.
// Jetzt: `ausgefallen` zählt auch geworfene Aufrufe; `verworfen` zählt Befund-Urteile (widerspruch/
// ueberholt), aus denen KEIN Konflikt wurde — die Zahl ergibt sich aus Mithören und Ergebnis, ohne die
// Zitatprüfung des Dienstes ein zweites Mal zu bauen (sie ist nicht exportiert, Modulgrenze). Sobald
// eine vorgelegte Quelle ohne belastbares Urteil bleibt, ist `gelaufen` false — mit Grund. Gefundene
// Konflikte reisen trotzdem mit (die Antwort nennt sie in jeder Lage).
interface Konfliktpruefung {
  gelaufen: boolean;
  grund: KonfliktpruefungGrund | null;
  /** Dem Modell vorgelegte Quellen. 0 heißt: nichts Vergleichbares im Pool — auch das ist ein Lauf. */
  kandidaten: number;
  /** Davon ohne Urteil (Modell fehlt, Antwort unverwertbar, Frist, Aufruf geworfen). */
  ausgefallen: number;
  /** Davon mit Befund-Urteil, das der Konfliktdienst nicht gelten ließ (Zitate, Schwelle). */
  verworfen: number;
}

/** Was die Route während EINES Laufs am Urteil mithört. */
interface Konfliktlauf {
  urteile: Map<string, ConflictVerdict>;
  kandidaten: number;
  ausgefallen: number;
  /** Urteile mit Befund (widerspruch/ueberholt) — nur aus ihnen kann der Dienst einen Konflikt machen. */
  befundUrteile: number;
  ausfall: JudgeFailure | null;
}

function neuerKonfliktlauf(): Konfliktlauf {
  return { urteile: new Map(), kandidaten: 0, ausgefallen: 0, befundUrteile: 0, ausfall: null };
}

// Der Judge, den der Konfliktdienst je Kandidat ruft (`assessAgainstPool`, conflicts/src/service.ts):
// dasselbe Modellurteil wie bisher (`judgeConflictOutcome` ist der Ausgang, aus dem `judgeConflict`
// seinen Wert zieht — reasoner/src/service.ts), nur wird mitgeschrieben statt weggeworfen. Wirft der
// Aufruf, wird er GEZÄHLT und dann unverändert weitergeworfen — der Dienst behandelt ihn wie zuvor.
function konfliktJudge(reasoner: Reasoner, locale: "de" | "en", lauf: Konfliktlauf) {
  return async (a: string, b: string): Promise<ConflictVerdict | null> => {
    lauf.kandidaten += 1;
    let ausgang: Awaited<ReturnType<Reasoner["judgeConflictOutcome"]>>;
    try {
      ausgang = await reasoner.judgeConflictOutcome(a, b, locale);
    } catch (err) {
      lauf.ausgefallen += 1;
      lauf.ausfall = lauf.ausfall ?? "model-error";
      throw err;
    }
    if (ausgang.verdict) {
      lauf.urteile.set(b, ausgang.verdict);
      if (ausgang.verdict.relation === "widerspruch" || ausgang.verdict.relation === "ueberholt") {
        lauf.befundUrteile += 1;
      }
      return ausgang.verdict;
    }
    lauf.ausgefallen += 1;
    lauf.ausfall = lauf.ausfall ?? ausgang.failure ?? "model-error";
    return null;
  };
}

function konfliktpruefungVon(
  lage: { wantDeep: boolean; confidential: boolean; dienstDa: boolean },
  lauf: Konfliktlauf,
  /** Konflikte, die der Dienst aus den Urteilen wirklich gemacht hat (Ergebnis des Laufs). */
  angenommen: number,
): Konfliktpruefung {
  const verworfen = Math.max(0, lauf.befundUrteile - angenommen);
  const ohne = (grund: KonfliktpruefungGrund): Konfliktpruefung => ({
    gelaufen: false,
    grund,
    kandidaten: lauf.kandidaten,
    ausgefallen: lauf.ausgefallen,
    verworfen,
  });
  if (!lage.wantDeep) {
    return ohne("nicht_angefordert");
  }
  if (lage.confidential) {
    return ohne("vertraulich");
  }
  if (!lage.dienstDa) {
    return ohne("kein_konfliktdienst");
  }
  // Quellen vorgelegt, KEIN einziges Urteil: das Modell hat nicht geprüft — gleich, wie leer die
  // Konfliktliste ist.
  if (lauf.kandidaten > 0 && lauf.urteile.size === 0) {
    return ohne(lauf.ausfall === "no-model" ? "kein_modell" : "modellfehler");
  }
  // Ein Teil ohne Urteil (geworfen, unverwertbar): nicht belastbar — auch wenn andere Quellen
  // ein Urteil bekamen. Der Grund nennt den Ausfall, die Zahlen sagen, wie viel fehlt.
  if (lauf.ausgefallen > 0) {
    return ohne(lauf.ausfall === "no-model" ? "kein_modell" : "modellfehler");
  }
  // Befund-Urteile, aus denen kein Konflikt wurde: der Dienst hat sie verworfen (Zitate nicht
  // wörtlich, Schwelle). Was das Modell da sah, ist unbelegt — und die Leere ebenso.
  if (verworfen > 0) {
    return ohne("urteil_verworfen");
  }
  // Ohne vorgelegte Quellen gab es nichts zu urteilen; auch das ist ein gelaufener Lauf.
  return {
    gelaufen: true,
    grund: null,
    kandidaten: lauf.kandidaten,
    ausgefallen: lauf.ausgefallen,
    verworfen,
  };
}

// Der Kerntext einer Quelle, GENAU so gebildet wie beim Pool (check-text-detection.ts `toDetectSubject`
// → `coreText`: Titel, Aussage, Bedingungen, Maßnahmen). Nur so findet die Route das Urteil wieder,
// das der Konfliktdienst unter diesem Text erfragt hat. `toDetectSubject` ist dort nicht exportiert
// und die Datei kein Zielpfad — deshalb steht die Abbildung hier ein zweites Mal, knapp und benannt;
// weicht sie je ab, ist die Folge kein falscher Wert, sondern `stellen: null` (Wissenslücke).
function kerntextVon(ko: KnowledgeObject): string {
  return coreText({
    refId: ko.id,
    title: ko.title,
    statement: ko.statement,
    conditions: ko.conditions,
    measures: ko.measures,
    tags: ko.tags,
    asset: ko.asset,
  });
}

function zitatOderNull(zitat: unknown): string | null {
  return typeof zitat === "string" && zitat.trim().length > 0 ? zitat.trim() : null;
}

type KonfliktMitStellen = CheckTextConflict & { stellen: Stellen | null; version: number | null };

async function mitStellen(
  konflikte: readonly CheckTextConflict[],
  ko: KoService,
  lauf: Konfliktlauf,
): Promise<KonfliktMitStellen[]> {
  return Promise.all(
    konflikte.map(async (c): Promise<KonfliktMitStellen> => {
      let quelle: KnowledgeObject | undefined;
      try {
        quelle = await ko.get(c.koId);
      } catch {
        quelle = undefined; // nicht ladbar → Wissenslücke, kein erfundener Wert
      }
      const urteil = quelle === undefined ? undefined : lauf.urteile.get(kerntextVon(quelle));
      return {
        ...c,
        stellen: urteil
          ? { eigen: zitatOderNull(urteil.zitat_a), quelle: zitatOderNull(urteil.zitat_b) }
          : null,
        version: typeof quelle?.version === "number" ? quelle.version : null,
      };
    }),
  );
}

// ==================================================================================================
// JOB 3216 · M3c — DER QUELLENFUND AM DRAHT: EIN EIGENER TREFFERTYP, KEIN ZWEITES DUBLETTENURTEIL.
// ==================================================================================================
//
// Was hier hinausgeht, ist die Antwort auf eine ANDERE Frage als `duplicates`. Ein Duplikat sagt
// „dieselbe Wissensaussage liegt schon vor" — geurteilt am Kerntext (K0-2). Ein Quellenfund sagt
// nur „diese Passage steht schon im Volltext von ‚<Titel>'", mit der Fundstelle daneben. Die
// Wortwahl trennt beide bewusst: der Panel-Auftrag (M3b Teil 2) hat damit gar nicht erst die
// Möglichkeit, aus einem Quellenfund eine Dublettenmeldung zu machen.
//
// `pruefstand` und `fundort` haben DIESELBE Form wie bei `duplicates` (JOB 3093) und entstehen aus
// DENSELBEN zwei Funktionen — ein Panel liest den Prüfstand eines Treffers überall gleich.
//
// ABWÄRTSKOMPATIBEL: die Felder sind additiv. Ein Client, der sie nicht kennt (das ausgelieferte
// Word-Fenster von heute), liest weiter `duplicates`/`conflicts` und merkt nichts.
function toSourceHitResponse(hit: CheckTextSourceHit) {
  return {
    refId: hit.refId,
    koTitle: hit.koTitle,
    koStatus: hit.koStatus,
    koCategory: hit.koCategory,
    pruefstand: pruefstandVon(hit.koStatus),
    version: hit.koVersion,
    fundort: fundortVon(hit.refId, hit.koCategory),
    // `full` = die ganze gewählte Passage steht zusammenhängend im Suchtext; `partial` = nur der
    // Ausschnitt, mit dem gesucht wurde. Die zwei Zahlen daneben machen das nachrechenbar.
    coverage: hit.coverage,
    gedeckteZeichen: hit.gedeckteZeichen,
    passageZeichen: hit.passageZeichen,
    fundstelle: hit.fundstelle,
    quelle: hit.quelle,
    anhang: hit.anhang,
  };
}

function toResponse(
  result: CheckTextResult,
  konflikte: readonly KonfliktMitStellen[],
  konfliktpruefung: Konfliktpruefung,
  note: string | null = null,
) {
  return {
    duplicates: result.duplicates.map((d) => ({
      koId: d.koId,
      koTitle: d.koTitle,
      relation: d.relation,
      confidence: d.confidence ?? null,
      method: d.method,
      rationale: d.rationale ?? null,
      koStatus: d.koStatus,
      koCategory: d.koCategory,
      pruefstand: pruefstandVon(d.koStatus),
      version: d.koVersion ?? null,
      fundort: fundortVon(d.koId, d.koCategory),
      ...(d.snippet !== undefined ? { snippet: d.snippet } : {}),
    })),
    // JOB 1970 RIEGEL 2: bis hierher stand `conflicts: []` FEST — die Antwort behauptete „keine
    // Konflikte", auch wenn der Kern welche gefunden hatte. Jetzt traegt sie, was DER KERN sagt,
    // in derselben Form wie `duplicates`. Ohne Konfliktdienst liefert der Kern eine leere Liste
    // (`check-text-detection.ts:186-188`), also bleibt die Antwort heute byteweise dieselbe —
    // aber sie ist ab jetzt ABGELEITET statt behauptet.
    conflicts: konflikte.map((c) => ({
      koId: c.koId,
      koTitle: c.koTitle,
      type: c.type,
      confidence: c.confidence ?? null,
      method: c.method,
      rationale: c.rationale ?? null,
      koStatus: c.koStatus,
      koCategory: c.koCategory,
      // JOB 3093: dieselbe Form wie bei `duplicates` — ein Konflikt hat denselben Fundort-Vertrag.
      // JOB 3094 (KA7): zusätzlich die beiden Stellen aus dem Modellurteil — additiv, `version` kommt
      // von der frisch nachgeladenen Quelle (mitStellen), genauer als der Origin-Snapshot `koVersion`.
      pruefstand: pruefstandVon(c.koStatus),
      version: c.version,
      fundort: fundortVon(c.koId, c.koCategory),
      stellen: c.stellen,
      ...(c.snippet !== undefined ? { snippet: c.snippet } : {}),
    })),
    // JOB 3094 (KA7): ob und wie weit die Konfliktprüfung gelaufen ist — s. Kopfkommentar oben.
    konfliktpruefung,
    answer: null,
    note,
    persisted: false,
    // ============================================================================================
    // JOB 3216 (M3c) — DIE ZUGABE STEHT HINTEN, UND SIE IST GEGEN EIN FEHLENDES FELD GEWAPPNET.
    // ============================================================================================
    //
    // WARUM AM ENDE: die sechs Felder des bestehenden Vertrags (`duplicates`, `conflicts`,
    // `konfliktpruefung`, `answer`, `note`, `persisted`) behalten damit ihre Reihenfolge im
    // serialisierten Rumpf Zeichen für Zeichen. Ein Alt-Client, der die Antwort der Reihe nach
    // liest, sieht bis `persisted` exakt dasselbe wie vorher.
    //
    // WARUM MIT `??`: `CheckTextResult` führt die drei Felder OPTIONAL (§5.4 „fehlt = leer", und
    // die Begründung samt gemessener Fundstelle steht am Typ). Fehlt die Auskunft, wird sie NICHT
    // erfunden: die Liste ist leer, `sourceHitsTruncated` false, und `quellenfund` sagt ehrlich
    // „nicht gelaufen" mit Grund — nicht etwa „gelaufen, nichts gefunden".
    sourceHits: (result.sourceHits ?? []).map(toSourceHitResponse),
    sourceHitsTruncated: result.sourceHitsTruncated ?? false,
    quellenfund: result.quellenfund ?? {
      gelaufen: false,
      grund: "suche_nicht_verfuegbar",
      geprueft: 0,
    },
  };
}

// SCRUM-502 Round 4: der GEPRÜFTE Text ist immer transient (Paste/Upload). Die Stufe kommt aus der
// aktuellen draft/transient-document-Deklaration; eine koId ist NUR ein hebender Backstop, nie ein
// Freigabe-Anker für frei gelieferten Text. Fehlt/ungültig → fail-safe vertraulich. Gleiche reine
// Regel wie der Reasoner.
async function resolveCheckedTextConfidential(
  body: { source?: string; koId?: string; confidentiality?: string },
  ko: KoService,
): Promise<boolean> {
  let backstop = { found: false } as { found: boolean; level?: Confidentiality | null };
  if (
    (body.source === "draft" || body.source === "transient-document") &&
    typeof body.koId === "string" &&
    body.koId.length > 0
  ) {
    const stored = await ko.get(body.koId);
    backstop = { found: stored !== undefined, level: stored?.confidentiality ?? null };
  }
  return classifyProvenanceConfidential(body.source, body.confidentiality, backstop);
}

// JOB 3216: der angemeldete Mensch, den `preValidation` bereits festgestellt hat, muss den Handler
// erreichen — die Sichtbarkeitsentscheidung für die Quellenfunde hängt an Rolle und Kennung.
//
// WARUM EINE WeakMap UND KEIN ZWEITER GUARD-AUFRUF: `requirePermission` ein zweites Mal zu rufen
// hieße, dieselbe Sitzung zweimal aufzulösen — und zwischen beiden Aufrufen könnte sie ablaufen,
// so dass der Handler mit einem anderen Ergebnis arbeitete als das Tor davor. Es ist derselbe
// Request, also dieselbe Antwort. WARUM KEIN `decorateRequest`: das ist Sache der Kompositions-
// wurzel (`build-app.ts:1454`), und die ist in diesem Auftrag nicht Zielpfad.
// Die Einträge hängen am Request-Objekt und verschwinden mit ihm — kein Wachstum über die Zeit.
const SITZUNGSNUTZER = new WeakMap<object, SessionUser>();

/** Was der Kern für die Quellenfunde an Sichtbarkeit bekommt — beide Linien oder ein hartes Nein. */
interface Quellensicht {
  quellenSichtbar?: (ko: KnowledgeObject) => boolean;
  quellenTrim?: SqlSichtbarkeitstrim;
}

// ==================================================================================================
// JOB 3216 RUNDE 2 — DIE ABLEITUNG DER SICHTBARKEIT DARF DIE ANTWORT NICHT KIPPEN, UND SIE DARF
// AUCH NICHT STILL AUFMACHEN.
// ==================================================================================================
//
// DER BEFUND AUS RUNDE 1 (Tor, 23 rote Fälle in vier Bestandsdateien): `sqlSichtbarkeitFuer` liest
// die Rolle SOFORT (`can(user.role, "ko.validate")`), und `can` schlägt bei einer Rolle, die die
// Rechtematrix nicht kennt, mit einem TypeError fehl (`ROLE_PERMISSIONS[role].includes`,
// services/rbac/src/policy.ts:22). Aus dem Handler wurde damit ein 500 — für JEDEN Aufruf, auch
// wenn er mit Quellenfunden nichts zu tun hatte. Die neue Zugabe hat die alte Zusage gekippt.
//
// ZWEI RICHTUNGEN, und die zweite ist die wichtigere:
//  · Sie darf NICHT WERFEN. Deshalb der Fangarm.
//  · Sie darf im Fehlerfall NICHT WEITER ÖFFNEN. Ein fehlendes Prädikat wäre kein Schutz, sondern
//    sein Wegfall — also steht dort ein Prädikat, das NICHTS durchlässt (`() => false`), und der
//    Quellenfund bleibt leer. Das ist fail-closed: über einen Betrachter, über den die
//    Rechtematrix nichts sagen kann, wird kein fremder Volltext ausgegeben.
//
// Der Add-in-Weg (kein angemeldeter Mensch) ist davon UNBERÜHRT: er bekommt wie bisher keine der
// beiden Linien, und für ihn ist der Pool ohnehin enger (nur Validiertes, kein Demo-Seed, nichts
// Vertrauliches — `istPoolKandidat` im Kern).
function quellensichtVon(nutzer: SessionUser | undefined): Quellensicht {
  if (!nutzer) {
    return {};
  }
  try {
    return {
      quellenSichtbar: sichtbarkeitsfilterFuer(nutzer),
      quellenTrim: sqlSichtbarkeitFuer(nutzer),
    };
  } catch {
    return { quellenSichtbar: () => false };
  }
}

export function checkTextRoutes(deps: CheckTextRouteDeps, guards: Guards): FastifyPluginAsync {
  return async (app) => {
    app.post<{
      Body: {
        text: string;
        title?: string;
        locale?: string;
        want?: string;
        // SCRUM-502 Schicht 2 (Round 3): Herkunft des geprüften Textes (fail-safe, siehe bodySchema).
        source?: string;
        koId?: string;
        confidentiality?: string;
      };
    }>(
      "/api/check-text",
      {
        // Dieselbe Drossel-Config wie /api/ask (Slice 1): greift nur, wenn @fastify/rate-limit
        // registriert ist (Flag AN), und dort nur auf Add-on-Principal-Requests — Session exempt.
        config: { rateLimit: addonRateLimit() },
        bodyLimit: CHECK_TEXT_BODY_LIMIT,
        schema: { body: bodySchema },
        // Fix 2 (ben-Review): Auth VOR der Body-Validierung. Fastify-Lifecycle:
        // onRequest → preParsing → preValidation → validation → preHandler. Der Add-on-Pfad ist bereits
        // im onRequest-Hook autorisiert (401/403 laufen VOR der validation-Phase); den Session-Pfad
        // prüfen wir hier in preValidation, damit ein anonymer Request 401 bekommt, BEVOR die
        // Schema-Validierung 400 liefert (Reihenfolge-Oracle entschärft).
        preValidation: async (request, reply) => {
          const auth = request.authContext;
          if (auth?.authKind === "addon") {
            // Defense-in-Depth: der onRequest-Hook hat checktext.validated bereits erzwungen.
            if (!authorizesCheckText(auth.principal)) {
              reply
                .code(403)
                .send({ error: "FORBIDDEN", message: "Add-in-Capability unzureichend." });
              return reply;
            }
            return;
          }
          // Session-Pfad: ko.read wie die übrigen Lese-Routen — jetzt vor der Body-Validierung.
          const user = await guards.requirePermission("ko.read", request, reply);
          if (!user) {
            return reply;
          }
          // JOB 3216: derselbe Mensch, denselben Request weiter unten — s. `SITZUNGSNUTZER`.
          SITZUNGSNUTZER.set(request, user);
        },
      },
      async (request, reply) => {
        // Body ist schema-validiert: text ist ein String mit 40–8.000 Zeichen; Auth ist in
        // preValidation bereits erledigt.
        const locale: "de" | "en" = request.body.locale === "en" ? "en" : "de";
        const input = {
          text: request.body.text,
          locale,
          ...(request.body.title !== undefined ? { title: request.body.title } : {}),
        };
        // ==========================================================================================
        // JOB 3020 — WER FRAGT, ENTSCHEIDET DIE REICHWEITE. NICHT DER RUMPF DER ANFRAGE.
        // ==========================================================================================
        //
        // Der ANGEMELDETE MENSCH (Session-Pfad, `ko.read` in preValidation erzwungen) prüft gegen
        // den ganzen Bestand — auch gegen noch nicht validierte Objekte. Genau das war Pedis
        // Diktat vom 30.07.: eine Dublette entsteht sonst gegen einen Eintrag, den es längst gibt.
        //
        // Der ADD-IN-PFAD bleibt unverändert auf Validiertes beschränkt. Seine Capability heißt
        // `checktext.validated` (addon-principal.ts) und dieselbe Linie zieht der Fragepfad
        // (ask/src/service.ts): ein Add-on-Principal darf nie aus unvalidierten Inhalten antworten.
        //
        // ES GIBT BEWUSST KEIN RUMPF-FELD DAFÜR: käme die Reichweite aus dem Body, könnte sich der
        // Add-in-Client sie selbst geben — der Riegel wäre eine Bitte. Sie hängt deshalb am
        // authentifizierten Weg, den der Client nicht wählen kann.
        const istAddon = request.authContext?.authKind === "addon";
        const includeUnvalidated = !istAddon;
        // ==========================================================================================
        // JOB 3216 — DIE QUELLENFUNDE ERBEN DIE SICHTBARKEITSREGEL DER BIBLIOTHEK, WÖRTLICH.
        // ==========================================================================================
        //
        // Ein Quellenfund liefert einen AUSSCHNITT AUS DEM GESPEICHERTEN VOLLTEXT eines fremden
        // Objekts. Damit ist er derselbe Egress wie `GET /api/library/search` und bekommt dieselben
        // zwei Linien: `sqlSichtbarkeitFuer` wirkt an der Datenquelle auf der Grundmenge (Papierkorb
        // UND Sichtbarkeit, vor jedem Deckel), `sichtbarkeitsfilterFuer` ist die zweite Linie
        // darüber (G-SHADOW: `oldAllowed ∧ newAllowed`). Beide entstehen aus derselben einen Stelle,
        // an der „darf dieser Mensch dieses Objekt sehen" beantwortet wird (`sichtbarkeit.ts`).
        //
        // AM ADD-IN-WEG GIBT ES KEINEN ANGEMELDETEN MENSCHEN, also auch keine der beiden Linien.
        // Das lockert nichts: für den Add-in-Pfad ist der Pool ohnehin enger (nur Validiertes,
        // kein Demo-Seed, nichts Vertrauliches — `istPoolKandidat` im Kern), und diese Regel greift
        // auf BEIDEN Wegen. Ein Sitzungsnutzer, den preValidation nicht festgestellt hat, kann hier
        // nicht ankommen; fehlt er trotzdem, gilt dasselbe engere Pool-Tor.
        //
        // RUNDE 2: die Ableitung selbst wohnt in `quellensichtVon` — dort steht, warum sie weder
        // werfen noch im Fehlerfall öffnen darf.
        const quellenSicht = quellensichtVon(SITZUNGSNUTZER.get(request));
        // Stufe-1-Deps: OHNE Judge/Prefilter → rein deterministisch (kein Modell, kein embed). Für
        // want fehlend / != "deep" bleibt das byte-identisch zu Slice 5.
        const stage1Deps = {
          ko: deps.ko,
          overlaps: deps.overlaps,
          includeUnvalidated,
          ...quellenSicht,
        };
        // SCRUM-502 R4/R5: Herkunft/Stufe des GEPRÜFTEN Textes bestimmen (fail-safe). Der Text ist
        // immer transient (Paste/Upload) → seine Stufe kommt aus der draft/transient-document-
        // Deklaration; eine koId ist nur hebender Backstop, nie Freigabe-Anker. Fehlt das Signal
        // (z. B. Alt-Add-in) → vertraulich. Vertraulich sperrt Embedder UND Cloud-Judge: die Deep-
        // Prüfung fällt auf den DETERMINISTISCHEN Pfad zurück (findet weiter Textduplikate — NICHT
        // „fest false"), plus ehrlicher Hinweis. Der Text verlässt den Prozess nie extern.
        const wantDeep = request.body.want === "deep";
        const confidential = await resolveCheckedTextConfidential(request.body, deps.ko);
        const deepAllowed = wantDeep && !confidential;
        // JOB 3094 (KA7): der Mitschnitt dieses Laufs — Urteile je Quellen-Kerntext, Zähler, Ausfall.
        const konfliktlauf = neuerKonfliktlauf();
        // Stufe 2 (want:"deep", nicht vertraulich): derselbe Kern MIT Modell-Judge + Prefilter → findet
        // umformulierte Duplikate, liefert Modell-confidence + wörtliche rationale. Bewusster
        // Textabfluss (D4). Vertraulich → bewusst NICHT: kein judge, kein prefilter (deterministisch).
        const checkDeps = deepAllowed
          ? {
              ...stage1Deps,
              // JOB 1970 D4 (bens Auflage 1): der Konfliktdienst wird AUSSCHLIESSLICH hier
              // gereicht — im freigegebenen tiefen, nicht vertraulichen Zweig. Stand er wie in D3
              // in `stage1Deps`, erreichte ihn auch der vertrauliche Fall (`checkDeps` waehlt dort
              // genau dieses Objekt) und rief `assessAgainstPool` einmal ergebnislos. Dass der
              // Dienst ohne Judge sofort `[]` liefert (conflicts/src/service.ts:481-483), ersetzt
              // die Zusicherung „null Dienstaufrufe" nicht.
              ...(deps.conflicts ? { conflicts: deps.conflicts } : {}),
              duplicateJudge: (a: string, b: string) => deps.reasoner.judgeDuplicate(a, b, locale),
              // JOB 3094 (KA7): dasselbe Urteil wie zuvor (`judgeConflict` liest seinen Wert aus
              // genau diesem Ausgang), jetzt mit der Sprache des Fensters und mitgeschrieben.
              conflictJudge: konfliktJudge(deps.reasoner, locale, konfliktlauf),
              semanticPrefilter: deps.semanticPrefilter,
            }
          : stage1Deps;
        // Dry-Run in BEIDEN Stufen: kein Insert, keine Gap, kein Board, kein Inhalts-Audit.
        const result = await checkText(input, checkDeps);
        // Die Antwort sagt, WOGEGEN geprüft wurde. Beide Aussagen sind unabhängig voneinander wahr
        // und schließen sich nicht aus — treffen beide zu, stehen auch beide da (JOB 3020: der
        // Vertraulichkeits-Hinweis aus SCRUM-502 darf durch den neuen Satz nicht verloren gehen).
        const hinweise: string[] = [];
        if (wantDeep && confidential) {
          hinweise.push(
            locale === "en"
              ? "Confidential content is checked deterministically only — no cloud AI or embedder was used."
              : "Vertrauliche Inhalte werden nur deterministisch geprüft — keine Cloud-KI, kein Embedder.",
          );
        }
        if (includeUnvalidated) {
          // KEIN „gegen den GESAMTEN Bestand": die Kandidatenwahl ist gedeckelt
          // (DETECTION_CANDIDATE_CAP) — dieser Satz sagt deshalb nur, WELCHE ZUSTÄNDE mitzählen,
          // und behauptet keine Vollständigkeit, die der Lauf nicht hergibt.
          hinweise.push(
            locale === "en"
              ? "Entries that are not yet validated were included in this check."
              : "Auch noch nicht validierte Einträge wurden mitgeprüft.",
          );
        }
        const note = hinweise.length > 0 ? hinweise.join(" ") : null;
        // JOB 3094 (KA7): die Stellen zu jedem Konflikt (Nachladen nur bei Treffern — höchstens die
        // Kandidaten-Kappe des Konfliktdienstes) und die Lage der Konfliktprüfung. Kein Insert, kein
        // Audit: Lesen ist Lesen, der Dry-Run bleibt einer.
        const konflikte = await mitStellen(result.conflicts, deps.ko, konfliktlauf);
        const konfliktpruefung = konfliktpruefungVon(
          { wantDeep, confidential, dienstDa: deps.conflicts !== undefined },
          konfliktlauf,
          result.conflicts.length,
        );
        reply.code(200).send(toResponse(result, konflikte, konfliktpruefung, note));
      },
    );
  };
}
