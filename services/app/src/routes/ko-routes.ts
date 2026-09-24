import type { FastifyPluginAsync, FastifyReply } from "fastify";
import type { AuditService } from "../../../audit";
import type {
  ConflictInput,
  ConflictService,
  OverlapService,
  OverlapSettingsRepo,
} from "../../../conflicts";
import {
  DEFAULT_EXTERNAL_KNOWLEDGE_STAGE,
  type ExternalKnowledgePolicyRepo,
  attributeExternalSource,
  classifySourceReach,
  decideExternalAttach,
  externalAttachAllowed,
} from "../../../external-search";
import {
  type AnzeigestatusEingaenge,
  type CreateKoInput,
  DEFAULT_UPLOAD_LIMITS,
  // JOB 3054: die Entweder-oder-Form eines Eingangs — ein WERT oder ein benannter Grund. Ein
  // fehlender Wert ohne Grund ist damit nicht ausdrueckbar (`display-status.ts`).
  type Erhoben,
  type KnowledgeObject,
  type KnowledgeType,
  type KoService,
  type KoStatus,
  type ReviseKoInput,
  type UploadLimitsRepo,
  alsMenge,
  alsSchreibpatch,
  // JOB 4077: die EINE Antwort auf „hängt dieser Anker an DIESEM Objekt?". Sie kennt weder Stufe
  // noch Reichweite und kann deshalb keine Erlaubnis erweitern (Begründung: `source-anchor.ts`).
  confirmedSourceAnchor,
  createOperationFingerprint,
  // JOB 3009: die Stufe als ausdrueckliche Auskunft am Detailabruf — dieselbe Funktion, die das
  // Pruef-Board ueber `mitHerkunft` ruft (die Begruendung steht an der Route).
  discloseConfidentiality,
  // JOB 3024: die EINE Ableitung der Anzeigestufe samt Herkunft. Bis zu diesem Auftrag hatte
  // `displayStatus` keinen einzigen Aufrufer im Produkt (`git log -S displayStatus -- services/app`:
  // kein Treffer); `discloseDisplayStatus` bildet beide Haelften der Auskunft an EINER Stelle.
  discloseDisplayStatus,
  normalizeUploadLimits,
} from "../../../knowledge-object";
// JOB 3054: `RevalidierungMerkerLeser` ist die SCHREIBFREIE Haelfte desselben Dienstes — sie kommt
// ueber DIESELBE Modulfassade, keine Kante in `services/lifecycle/src/**`.
import type { LifecycleService, RevalidierungMerkerLeser } from "../../../lifecycle";
import type { ObjectStore } from "../../../object-store";
import { can } from "../../../rbac";
import type { Reasoner } from "../../../reasoner";
// JOB 3043: `KoPruefstand` kommt ueber DIESELBE Modulfassade wie der Dienst — die Liste greift
// nirgends an `services/validation/src/**` vorbei.
// JOB 3667 R2: `TRUST_MAX` reist von HIER in den KO-Dienst (er kennt die Trust-Skala nicht und
// soll sie nicht kennen) — derselbe Deckel, den `ValidationService.adminValidate` setzt. Eine 99
// im KO-Dienst wäre die Abschrift, die beim nächsten Skalenwechsel auseinanderläuft.
import {
  type KoPruefstand,
  TRUST_MAX,
  type ValidationService,
  type Verdict,
} from "../../../validation";
// JOB 2009 D2 (H3): der Einstieg, der die PORTS nimmt — nicht das Lesemodell (C1 bleibt gruen).
import { wissensnetzMetrikFuer } from "../../../wissensnetz";
import type { AiCheckWorker } from "../ai-check-worker";
import { type SemanticPrefilter, indexKoForDuplicatePrefilter } from "../duplicate-detection";
import { type Guards, type SessionUser, sendError } from "../http";
import { type LesevariantenRepo, mitAenderungsauskunft } from "../lesevarianten";
import type { AssignmentNotifier } from "../notify";
import { darfSehen, sichtbareFuer, sqlSichtbarkeitFuer } from "../sichtbarkeit";

// Knowledge-Object-API (§2.3). Mutationen laufen über EINEN Endpunkt
// PUT /api/kos/:id, der per {action} an das passende Modul verzweigt — die
// Orchestrierung über Modulgrenzen ist Aufgabe der App (Composition-Root).
export interface KoRoutesDeps {
  ko: KoService;
  validation: ValidationService;
  conflicts: ConflictService;
  // Berater-Konzept Duplikate 04.07. (Stufe D3b): Überschneidungs-Erkennung beim Einreichen.
  overlaps: OverlapService;
  // Pedi 04.07.: einstellbare Anzeige-Schwelle der Duplikat-Erkennung.
  overlapSettings: OverlapSettingsRepo;
  lifecycle: LifecycleService;
  // Berater-Konzept 04.07. (Stufe 3): Reasoner für die automatische Widerspruchs-Erkennung beim Einreichen.
  reasoner: Reasoner;
  notifyAssignment?: AssignmentNotifier; // FR-VAL-07
  // SCRUM-421: einstellbare Upload-Grenzen (persistiert) + Audit für Änderungen.
  uploadLimits: UploadLimitsRepo;
  // AUFTRAG-mega14 Block E (SCRUM-421): der Object-Store, um beim Anhängen die ECHTE, GESPEICHERTE
  // Größe gegen die Admin-Grenze zu halten statt der Angabe des Clients.
  objects: ObjectStore;
  // AUFTRAG-mega14 Block D (SCRUM-414): die Admin-Stufe der externen Wissensabfrage. Sie wird beim
  // Anhängen eines EXTERNEN Suchtreffers SERVERSEITIG durchgesetzt — bis mega14 war
  // `externalAttachAllowed` definiert, exportiert und von NIEMANDEM aufgerufen, die Stufe
  // „suchen, aber nicht anhängen" damit faktisch wirkungslos.
  externalPolicy: ExternalKnowledgePolicyRepo;
  // AUFTRAG-mega16 Block A: die Allowlist interner Origins. Sie kommt aus der KONFIGURATION
  // (KLARWERK_INTERNAL_SOURCE_ORIGINS, gelesen in build-app.ts), nie aus dem Code. Fehlt sie, ist
  // sie leer — dann ist jede Adresse öffentlich und der Auslieferungszustand der geschlossene.
  internalSourceOrigins: readonly string[];
  audit?: AuditService;
  // JOB 3326: die Ablage der Lesevarianten. OPTIONAL — direkt konstruierte Routen-Tests ohne sie
  // liefern das Objekt schlicht ohne Übersetzungsfeld, was der ehrliche Zustand ist. Sie wird NUR
  // GELESEN und ausschliesslich als eigenes Feld NEBEN das Objekt gesetzt; kein KO-Feld wird
  // ersetzt, überschrieben oder umgeschrieben.
  lesevarianten?: LesevariantenRepo | undefined;
  // Weg 3 (Feature-Flag): semantischer Vorfilter der Duplikat-Erkennung. Nur gesetzt, wenn aktiviert.
  semanticPrefilter?: SemanticPrefilter | undefined;
  // WP-SUBMIT-ASYNC (Pedis R3): In-Process-Worker der Hintergrund-KI-Prüfung. Optional (direkt
  // konstruierte Routen-Tests ohne Worker vermerken dann ehrlich KEINEN Prüf-Job).
  aiCheckWorker?: AiCheckWorker | undefined;
  // AUFTRAG-mega19 Block B: der Entwurfs-Zugang der Dokumentübernahme. Bewusst eine SCHMALE
  // Funktionsschnittstelle statt eines Modul-Imports — ko-routes kennt das Capture-Modul nicht und
  // soll es nicht kennen; die Composition-Root (build-app.ts) verdrahtet beides. Fehlt die
  // Verdrahtung, ist der Entwurfsweg schlicht nicht verfügbar (ehrlicher 400), statt halb zu laufen.
  draftPromotion?: DraftPromotionSource | undefined;
  // ================================================================================================
  // JOB 4155 (WG-LUECKEN) — DIE KANTENAUSKUNFT DER NETZROUTE. DER PORT, DEN H3 NIE BEKAM.
  // ================================================================================================
  //
  // DER BEFUND: `luecken-einstieg.ts:37-47` fordert seit JOB 2600 `mitVerknuepfung: true` an — und
  // die einzige Route dorthin (unten, `/api/wissensnetz/luecken`) uebergab nur `kos`. Das Lesemodell
  // meldete deshalb bei JEDER Anfrage `verknuepfungAusgelassen: true` mit dem Grund
  // `"kein-kantenport"` (`lesemodell.ts:216-220`). Die Frage wurde gestellt und nie beantwortet.
  //
  // DER GRUND, WARUM ES BISHER NICHT ANDERS GING, IST MIT JOB 4151 WEGGEFALLEN: `KantenLeseService`
  // stand nicht in `services/knowledge-object/index.ts` (`lesemodell-ports.ts:15-20`, „gemessen:
  // 0 Treffer") und war deshalb ueber die Modulgrenze unerreichbar. Seit JOB 4151 steht er dort.
  //
  // DER TYP IST ABGELEITET, NICHT ABGESCHRIEBEN. `WissensnetzKantenLeser` steht bewusst NICHT im
  // Paket-Index des Wissensnetzes (dort stehen nur Ergebnistypen, `index.ts:29-35`), und ihn hier
  // nachzubauen waere die zweite Wahrheit ueber eine Vertragsflaeche. `Parameters<…>` liest die
  // Form aus der exportierten FUNKTION — weicht der Port drueben ab, ist DIESE Zeile der Typfehler.
  //
  // OPTIONAL BLEIBT OPTIONAL: ein direkt konstruierter Routentest ohne Port bekommt weiterhin die
  // ehrliche Auslassung mit ihrem Grund — keine 0, keine erfundene Verknuepfungszahl.
  kanten?: WissensnetzDeps["kanten"];
}

/**
 * Der Abhaengigkeitsvertrag des Wissensnetz-Einstiegs, AUS DER FUNKTION GELESEN.
 *
 * `LesemodellDeps` ist modulintern und bleibt es (JOB 2009 D2: der Export der Porttypen machte C2
 * rot, weil ueber die Typkette `WissensnetzSicht` wieder importierbar war). Diese Zeile braucht
 * keinen Export: sie liest die Signatur des einzigen oeffentlichen Weges.
 */
type WissensnetzDeps = Parameters<typeof wissensnetzMetrikFuer<KnowledgeObject>>[1];

/**
 * AUFTRAG-mega19 Block B — DER ENTWURF ALS EINGABE EINER DOKUMENTÜBERNAHME.
 *
 * `load` liefert die KO-Eingabe des Entwurfs ODER einen ehrlichen Grund. Die Sichtbarkeitsregel ist
 * DIESELBE wie auf allen Entwurfs-Routen (Admin sieht den Pool, sonst nur eigene) — sie wird in der
 * Composition-Root aus derselben Funktion gebildet, damit hier keine zweite Auffassung entsteht.
 *
 * `discard` entfernt den Entwurf, NACHDEM das Wissensobjekt vollständig steht — nie vorher.
 */
export interface DraftPromotionSource {
  load(
    draftId: string,
    user: { id: string; role: string },
  ): Promise<{ ok: true; input: CreateKoInput } | { ok: false; reason: "not-found" | "forbidden" }>;
  discard(draftId: string): Promise<void>;
  /**
   * AUFTRAG-mega21 Block B — DER GEWÄHLTE WEG: EIN ATOMARER, IDEMPOTENTER SERVERVERTRAG.
   *
   * bens SB-2: die Oberfläche schickte bei JEDEM Einreichversuch zuerst `PUT /api/drafts/:id` und
   * erst danach den POST. Nach einem serverseitig gelungenen ersten POST ist der Entwurf bereits
   * verworfen — geht nur die ANTWORT verloren, scheitert der zweite Klick am vorgeschalteten PUT
   * mit 404, und der Idempotenz-Nachschlag des POST wird NIE erreicht. Die ganze Adoptionsmechanik
   * lief im echten Klickpfad ins Leere.
   *
   * bens zwei Wege waren: (a) beim Wiederholversuch das Entwurfs-PUT überspringen, oder (b)
   * Entwurfsaktualisierung und Erstanlage in EINEN atomaren idempotenten Serververtrag ziehen.
   *
   * ES WIRD (b), und der Grund ist Block A: bei (a) erreicht der GEÄNDERTE INHALT den Server nie.
   * Der Wiederholversuch trüge denselben Body wie der erste (Kennung, Entwurfs-Id, Dokumente) — der
   * Server könnte den Abdruck also gar nicht abweichen sehen und lieferte weiter still das alte
   * Objekt. (a) schlösse SB-2 und liesse SB-3 auf genau dem Weg offen, den jeder Nutzer geht. Nur
   * wenn der Inhalt MIT der Anlage reist, kann der Server ehrlich sagen „das ist nicht mehr
   * derselbe Vorgang".
   *
   * Der Preis ist benannt: eine Methode mehr an dieser Schnittstelle und ein Feld mehr im Body. Der
   * Gewinn ist, dass die Oberfläche KEINE Zustandsmaschine mehr braucht („habe ich schon geputtet?")
   * — beim Wiederholversuch trifft der Nachschlag zuerst und der Entwurf wird gar nicht angefasst.
   *
   * `applyAndLoad` schreibt den mitgelieferten Stand in den Entwurf und liefert die KO-Eingabe —
   * beides unter derselben Sichtbarkeitsregel wie `load` (canSeeDraft, aus der Composition-Root).
   * `invalid` ist der Formfehler des Entwurfs-Inhalts (400), nicht ein Zugriffsproblem.
   */
  applyAndLoad(
    draftId: string,
    payload: unknown,
    user: { id: string; role: string },
    /**
     * JOB 2684 D3 (R2-17): der `updatedAt`-Stand, den der Client beim Laden gesehen hat. Gesetzt,
     * wird der Entwurf nur geschrieben und befördert, wenn er noch diesen Stand trägt — sonst
     * `stale` mit dem jetzt gespeicherten Stand (Antwort 409 `DRAFT_STALE`, wie am Promote).
     */
    expectedUpdatedAt?: string,
  ): Promise<
    | { ok: true; input: CreateKoInput }
    | { ok: false; reason: "not-found" | "forbidden" | "invalid"; message?: string }
    | { ok: false; reason: "stale"; message: string; currentUpdatedAt: string }
    /** JOB 2684 D4: sichtbarer Entwurf, aber kein Stand mitgeschickt — weggelassen, nicht neu. */
    | { ok: false; reason: "stand-fehlt" }
  >;
}

/**
 * Ein Ankerdokument mit seinen Belegstellen, wie der Client es schickt.
 *
 * AUFTRAG-mega22 Block B: `thumbnail` steht hier NICHT mehr. Die Begründung steht ausgeschrieben
 * am `THUMBNAIL`-Abschnitt in der Route — kurz: es wurde nie in den Abdruck genommen, aber sehr
 * wohl persistiert, und diese Kombination ist nicht haltbar. Ein Client, der das Feld weiterhin
 * schickt, bekommt keinen Fehler; es wird schlicht nicht gelesen.
 */
interface FromDocumentEntry {
  anchor?: { objectId?: string; name?: string; mime?: string };
  points?: { label?: string; url?: string; excerpt?: string }[];
}

interface FromDocumentBody {
  /**
   * Fortsetzung eines gespeicherten Entwurfs. Ist das Feld gesetzt, kommen Titel, Aussage, Body und
   * Metadaten AUS DEM ENTWURF (FR-CAP-07: Originalautor bleibt) — nicht aus `create`.
   */
  draftId?: string;
  /** Die Felder der Erstanlage, wenn KEIN Entwurf fortgesetzt wird. Gleiche Form wie POST /api/kos. */
  create?: Omit<CreateKoInput, "author">;
  /**
   * AUFTRAG-mega21 Block B: der AKTUELLE Stand des fortgesetzten Entwurfs, mitgeliefert statt
   * vorab geputtet. Nur zusammen mit `draftId` sinnvoll; fehlt das Feld, bleibt der alte Weg
   * unverändert (der Entwurf wird gelesen, wie er im Bestand steht). Die Begründung, warum der
   * Inhalt MIT der Anlage reisen muss, steht an `DraftPromotionSource.applyAndLoad`.
   */
  draftPayload?: unknown;
  /**
   * JOB 2684 D3 (R2-17): der Stand des fortgesetzten Entwurfs, den der Client beim Laden gesehen
   * hat. Nur zusammen mit `draftId`. Nur ein nicht-leerer String zählt (wie an den Entwurfsrouten).
   * JOB 2684 D4: zusammen mit `draftId` PFLICHT — fehlt er oder ist er leer, antwortet die Route
   * 400 `DRAFT_STAND_FEHLT`, ohne Wirkung (kein Altweg mehr). Er geht NICHT in den Abdruck:
   * eine Wiederholung desselben Vorgangs trifft weiter den Nachschlag, bevor der Stand geprüft wird.
   */
  expectedUpdatedAt?: unknown;
  documents?: FromDocumentEntry[];
  reviewerIds?: string[];
  /**
   * AUFTRAG-mega20 Block A: der WIEDERHOLSCHLÜSSEL der Erstanlage. PFLICHT — anders als beim
   * Append, wo ein fehlender Schlüssel „nur" eine doppelte Quelle riskiert, entsteht hier bei
   * jedem Antwortverlust ein zweites vollständiges Wissensobjekt. Ein optionales Feld hätte den
   * Schutz genau denjenigen Aufrufern vorenthalten, die ihn am nötigsten brauchen (die alten).
   *
   * Er trägt KEINE Autorität; die Abgrenzung zum `provider`-Fehler aus mega15 und die Begründung,
   * warum er vom Aufrufer kommt und DB-weit eindeutig ist, stehen in
   * services/knowledge-object/src/document-create.ts.
   */
  operationId?: string;
}

/**
 * AUFTRAG-mega21 Block A — WAS IN DEN INHALTSABDRUCK GEHT.
 * AUFTRAG-mega22 Blöcke A, B und C — und nach welcher EINEN Regel entschieden wird, was hineingeht.
 *
 * Die Kanonisierungsregel (K1–K8) steht in document-create.ts; hier steht die AUSWAHL, weil nur
 * diese Route weiß, welche Felder ihres Bodys Inhalt sind und welche Adressierung.
 *
 * ============================================================================================
 * DIE REGEL, aus der die Auswahl folgt
 * ============================================================================================
 *
 *     EIN FELD GEHÖRT IN DEN ABDRUCK, WENN DIESER REQUEST ES SCHREIBEN WIRD.
 *
 * bens SB-A, SB-B und SB-D waren dieselbe Verletzung dieser Regel aus drei Richtungen, und sie
 * werden deshalb hier gemeinsam beantwortet statt an drei Stellen einzeln:
 *
 *   SB-A — der Abdruck ebnete `fehlt` gegen `leer` ein, obwohl der Entwurfs-Merge daraus „Altwert
 *          behalten" gegen „Altwert löschen" macht. Antwort: die Schreibladung geht über K8 ein
 *          (`alsSchreibpatch`) und nicht mehr roh durch K2.
 *   SB-B — `anchor.thumbnail` blieb draussen, wurde aber PERSISTIERT. Antwort unten: es wird gar
 *          nicht mehr geschrieben, also gibt es nichts mehr abzudecken.
 *   SB-D — `draftId` blieb draussen, obwohl der Request den Entwurf VERWIRFT. Antwort: es geht
 *          hinein.
 *
 * DRIN, weil eine Änderung daran eine Änderung des Vorgangs ist:
 *   · `inhalt` — `create` bzw. `draftPayload`, beide als SCHREIBLADUNG nach K8. Genau EINES von
 *     beiden ist gesetzt (frischer Weg / Entwurfsweg); beide gehen unter demselben Schlüssel ein,
 *     damit ein Wechsel des Weges bei gleichem Inhalt nicht als Inhaltsänderung zählt. Der WEG
 *     selbst steht daneben in `weg`, denn er entscheidet, ob geschrieben oder gemerged wird — und
 *     dieselbe Feldmenge bedeutet auf beiden Wegen nicht dasselbe.
 *   · `draftId` — AUFTRAG-mega22 Block C. Es sieht nach Adressierung aus und ist doch Inhalt: der
 *     Request LÖSCHT diesen Entwurf, und er schreibt vorher in ihn hinein. Zwei Anfragen, die
 *     verschiedene Entwürfe verbrauchen, sind nicht derselbe Vorgang — auch dann nicht, wenn das
 *     entstehende Wissensobjekt gleich aussähe. Meine Begründung aus mega21 („kein bekannter
 *     Aufrufer") trägt nicht: Unbenutztheit ist kein Schutz für einen authentifiziert erreichbaren
 *     Vertrag.
 *   · `documents` — Anker (objectId/name/mime) und Belegstellen (label/url/excerpt). Ein anderes
 *     Original oder eine andere Belegstelle ist ein anderer Vorgang; das ist der Kern des
 *     Belegvertrags und darf sich nicht still unter einem alten Schlüssel ändern.
 *   · `reviewerIds` — als MENGE (K5-Ausnahme, `alsMenge`): die Route dedupliziert sie ohnehin,
 *     bevor sie zuweist. Eine andere Klickreihenfolge ist kein anderer Vorgang.
 *
 * DRAUSSEN, mit Grund:
 *   · `anchor.thumbnail` — s. `THUMBNAIL`-Abschnitt an der Route. Es steht nicht mehr im Abdruck,
 *     WEIL es nicht mehr geschrieben wird. Das ist der Unterschied zu mega21, wo es draussen stand,
 *     obwohl es geschrieben wurde — dieselbe Zeile im Abdruck, ein völlig anderer Zustand dahinter.
 *   · `operationId` — der Schlüssel selbst; ihn in seinen eigenen Abdruck zu nehmen wäre zirkulär.
 */
function fromDocumentFingerprintInput(body: FromDocumentBody): unknown {
  const entwurfsweg = body.draftId !== undefined && body.draftId !== null && body.draftId !== "";
  return {
    // K8: die Schreibladung als vorserialisierter, semantiktreuer Text — nicht als Objekt, das der
    // äussere K2-Lauf wieder ausdünnen würde (document-create.ts, Abschnitt K8).
    inhalt: alsSchreibpatch(entwurfsweg ? body.draftPayload : (body.create ?? null)),
    weg: entwurfsweg ? "entwurf" : "frisch",
    // AUFTRAG-mega22 Block C: der verbrauchte Entwurf gehört zum Vorgang.
    draftId: entwurfsweg ? body.draftId : null,
    documents: (body.documents ?? []).map((entry) => ({
      anchor: {
        objectId: entry.anchor?.objectId ?? null,
        name: entry.anchor?.name ?? null,
        mime: entry.anchor?.mime ?? null,
      },
      points: (entry.points ?? []).map((point) => ({
        label: point.label ?? null,
        url: point.url ?? null,
        excerpt: point.excerpt ?? null,
      })),
    })),
    reviewerIds: alsMenge(body.reviewerIds),
  };
}

// ================================================================================================
// JOB 3569 (Q3 c) — DIE STUFENPFLICHT IN EINEM SATZ, FÜR BEIDE ÖFFENTLICHEN ANLAGEWEGE.
// ================================================================================================
//
// JOB 3429 hat diese Antwort für `POST /api/kos` eingeführt; JOB 3569 gibt sie zusätzlich dem
// Dokumentweg. Sie steht hier EINMAL und nicht zweimal kopiert: zwei Wächter mit auseinander
// laufenden Sätzen wären zwei Auffassungen derselben Pflicht, und der Mensch an der Oberfläche
// bekäme je nach Tür eine andere Begründung für dasselbe Versäumnis.
//
// Die Begründungen (kein Vorgabewert, nur das FEHLEN, warum an der Route und nicht im Dienst)
// stehen ausgeschrieben an den beiden Aufrufstellen — sie sind dort verschieden genug, um nicht
// hierher zu passen.
function sendMissingConfidentiality(reply: FastifyReply): void {
  reply.code(400).send({
    error: "MISSING_CONFIDENTIALITY",
    message:
      "Vertraulichkeitsstufe fehlt — ein Wissensobjekt entsteht nur mit ausdrücklicher Einstufung.",
  });
}

interface KoQuery {
  type?: KnowledgeType;
  status?: KoStatus;
  category?: string;
  tag?: string;
}

// ================================================================================================
// AUFTRAG-mega80 BLOCK A — EINE KENNUNG IST KEIN LESERECHT.
// ================================================================================================
//
// DER BEFUND. `PUT /api/kos/:id` verzweigt per `{action}` in siebzehn Aktionen. Bis mega80 hat
// KEINE davon das Sichtbarkeitstor (`sichtbaresKoOder404`) passiert: jede lädt ihr Zielobjekt über
// den Dienst DIREKT aus dem Bestand.
//
// WAS DABEI GEMESSEN WURDE — und nur das steht hier (AUFTRAG-mega82 Block C, bens Befund an genau
// diesem Kommentar): von den fünfzehn torpflichtigen Aktionen gaben ACHT das VOLLSTÄNDIGE Objekt
// mit 200 zurück — Inhalt, Anhänge, Quellen, Metadaten: `revise`, `comment`, `attach`, `detach`,
// `remove-source`, `category`, `tags`, `revalidate`. Wer die Kennung eines fremden vertraulichen
// Objekts kannte, hatte es über sie gelesen und im selben Zug verändert. Die übrigen sieben
// scheiterten vorher an einer Rechte- oder Nutzlastprüfung (403/400) — harmlos ist das nicht: ein
// 403 unterscheidet „gibt es, du darfst nicht" von „gibt es nicht" und ist damit eine
// Existenzauskunft über ein vertrauliches Objekt. Die Einzelurteile stehen in der Tabelle des
// Berichts zu mega80; der ausführbare Beleg liegt in
// tests/security/mega80-kennung-ist-kein-leserecht.test.ts.
//
// Das ist derselbe Satz, an dem mega74 bis mega79 gearbeitet haben, nur auf dem Schreib-Endpunkt:
// EINE UNERRATBARKEIT ERSETZT KEINE AUTORISIERUNG. `ko.create` hat in diesem System jeder Experte;
// `comment` verlangte sogar nur eine Anmeldung.
//
// DIE BAUFORM, und sie ist Teil des Auftrags: EIN Tor vor dem Switch, nicht siebzehn lokale
// Sonderlöcher. Genau daran ist mega76 gescheitert, als der Schutz angeboten statt erzwungen war.
// Die Reihenfolge ist ERST das Tor, DANN die fachliche Schreibberechtigung — sonst verrät ein 403
// („du darfst nicht") wieder die Existenz, die der 404 gerade verbergen soll.
//
// DIE GRUNDMENGE STEHT HIER ALS TABELLE, nicht als Bedingung im Rumpf. Ein `Record` über die
// vollständige Aktions-Union zwingt den Compiler, jede Aktion zu beurteilen: wer eine neue Aktion
// zu `KoAktion` hinzufügt und hier nichts einträgt, kompiliert nicht. Was der Compiler NICHT sieht
// — eine neue `case`-Marke im Switch, die niemand in die Union geschrieben hat —, fängt der
// Wächter in tests/security/mega80-kennung-ist-kein-leserecht.test.ts ab: er erhebt seine
// Grundmenge aus dem Switch SELBST und wird rot, sobald ihm eine Aktion abhandenkommt.
type KoAktion =
  | "rate"
  | "assign"
  | "admin-validate"
  | "revise"
  | "comment"
  | "attach"
  | "detach"
  | "add-source"
  | "append-document"
  | "remove-source"
  | "category"
  | "tags"
  | "confidentiality"
  // JOB 557: die Verantwortung am Objekt benennen (Recht `ko.validate`, s. den Zweig unten).
  | "ownership"
  | "conflict"
  | "resolve-conflict"
  | "transfer-author"
  // JOB 3667 R2 (Accountregel): überarbeiten UND freigeben in einem Vorgang (Rolle `admin`),
  // einen gebundenen Änderungsvorschlag einreichen (`ko.create`) und über einen entscheiden
  // (`users.manage`). Alle drei arbeiten AM Objekt unter `:id` — sie passieren das Tor.
  | "revise-release"
  | "propose"
  | "decide-proposal"
  // JOB 4146 (WIKI-DISKUSSION): den Faden als geklärt markieren und wieder öffnen. Beide arbeiten
  // AM Objekt unter `:id` — sie passieren das Tor, mit demselben Gate wie `comment`.
  | "comment-resolve"
  | "comment-reopen"
  | "revalidate";

/**
 * `tor` — die Aktion arbeitet AM Objekt unter `:id`. Sie passiert das Sichtbarkeitstor.
 *
 * `kein-zielobjekt` — die Aktion liest `:id` strukturell NICHT; ihr Gegenstand steht im Rumpf.
 * Das ist eine BENANNTE Ausnahme mit Beleg, keine stillschweigende. Sie gilt genau für die zwei
 * Konflikt-Aktionen, und zwar aus zwei unabhängigen Gründen zugleich:
 *
 *   1. Gegenstand. `conflict` legt einen Konflikt aus `body.conflict` an (koA/koB), und
 *      `resolve-conflict` entscheidet über `body.conflictId`. Beide fassen das Objekt unter `:id`
 *      nirgends an — die Kennung im Pfad ist bei ihnen reine Adressierungskosmetik des einen
 *      Mutations-Endpunkts. Ein Tor darauf prüfte eine Kennung, die die Aktion nie liest, und
 *      bräche den Betrieb an einem Aufrufer, der dort etwas anderes als ein Wissensobjekt sendet.
 *   2. Rechte. `conflict` verlangt `ko.validate`; `conflict.resolve` haben laut Rechtematrix nur
 *      `controller` und `admin` (rbac/src/policy.ts:16-17) — und beide halten `ko.validate`.
 *      Für genau diese Rollen liefert `darfSehen` unbedingt `true` (sichtbarkeit.ts). Das Tor wäre
 *      auf diesen zwei Aktionen also ein No-op auf der Sichtbarkeit und ALLEIN eine zusätzliche
 *      Existenzforderung an eine ungelesene Kennung.
 *
 * Der Inhalt, den diese beiden ausgeben (Konflikt mit `description`/`detector.quotes`), ist damit
 * durch `ko.validate` gedeckt — dieselbe Schwelle, die auch das Tor zöge. Der KO-ÜBERGREIFENDE
 * Leseweg auf dieselben Zitate ist getrennt geschlossen (mega74 Block D, conflicts-routes.ts).
 */
type Torurteil = "tor" | "kein-zielobjekt";

const ZIELOBJEKT_TOR: Record<KoAktion, Torurteil> = {
  rate: "tor",
  assign: "tor",
  "admin-validate": "tor",
  revise: "tor",
  comment: "tor",
  attach: "tor",
  detach: "tor",
  "add-source": "tor",
  "append-document": "tor",
  "remove-source": "tor",
  category: "tor",
  tags: "tor",
  confidentiality: "tor",
  // JOB 557: die Aktion arbeitet AM Objekt unter `:id` — sie passiert das Sichtbarkeitstor.
  ownership: "tor",
  conflict: "kein-zielobjekt",
  "resolve-conflict": "kein-zielobjekt",
  "transfer-author": "tor",
  // JOB 3667 R2: die drei Aktionen des Rückwegs arbeiten alle AM Objekt unter `:id`.
  "revise-release": "tor",
  propose: "tor",
  "decide-proposal": "tor",
  // JOB 4146: Vertrag Fall 4 — „die Route prüft den Zugriff auf das Dokument, BEVOR sie Fadeninhalt
  // liefert oder annimmt". Genau das leistet dieser Eintrag; ein eigenes Sonderloch gibt es nicht.
  "comment-resolve": "tor",
  "comment-reopen": "tor",
  revalidate: "tor",
};

/** Die Grundmenge als Datum — der Wächter liest sie, statt sie noch einmal abzuschreiben. */
export const KO_AKTIONEN_MIT_TORURTEIL: Readonly<Record<string, Torurteil>> = ZIELOBJEKT_TOR;

interface PutBody {
  action: string;
  verdict?: Verdict;
  userIds?: string[];
  changes?: ReviseKoInput;
  /**
   * JOB 3667 (WORD-RÜCKWEG) — DER BEDINGTE SCHREIBZUGRIFF DER ÜBERARBEITUNG.
   *
   * Die Inhaltsversion, die der Aufrufer beim Laden des Objekts gesehen hat. Sie wirkt AUSSCHLIESS-
   * LICH an `action: "revise"` und ausschliesslich als BEDINGUNG: trägt das Objekt inzwischen eine
   * andere Version, wird nicht geschrieben (409 `KO_STALE`, mit der jetzt gespeicherten Version).
   *
   * WARUM DIE VERSION UND NICHT `updatedAt` wie am Entwurfsweg (capture-routes.ts:661): `revise`
   * zählt die Version selbst hoch (`service.ts:3570`, `ko.version + 1`) und schreibt sie in die
   * Historie — sie ist der Stand, den `GET /api/kos/:id` und `GET /api/kos/:id/versions` ohnehin
   * ausgeben und den eine Oberfläche deshalb belegbar in der Hand hat. `updatedAt` trägt das
   * Wissensobjekt nicht als eigenes Feld.
   *
   * OHNE DAS FELD bleibt alles wie bisher (letzter Schreiber gewinnt) — der Web-Editor und jeder
   * Altaufrufer sind unberührt. `unknown`, weil der Wert aus dem Netz kommt: gelesen wird er von
   * `erwarteteKoVersion` (eine Ganzzahl ≥ 1 oder ein 400), damit ein Unsinnswert den Schutz nicht
   * stillschweigend abschaltet.
   */
  expectedVersion?: unknown;
  /**
   * JOB 4251 (WIKI-ZUSAMMENARBEIT) — DER BEDINGTE SCHREIBZUGRIFF DER EINORDNUNG.
   *
   * Der Stand der Einordnung (Kategorie + Schlagwörter), den der Aufrufer beim Laden GESEHEN hat.
   * Er wirkt AUSSCHLIESSLICH an `action: "tags"` und `action: "category"` und ausschliesslich als
   * BEDINGUNG: trägt die Einordnung inzwischen einen anderen Stand, wird nicht geschrieben
   * (409 `KO_STALE`).
   *
   * WARUM NICHT `expectedVersion` DAFÜR TAUGT: eine Metadatenänderung erhöht die Inhaltsversion
   * ausdrücklich NICHT (`knowledge-object/src/service.ts`, `mutateKoMetadata`, KW-ARCH-G27). Wer nur
   * die Schlagwörter eines anderen überschreibt, tut das bei UNVERÄNDERTER Version — ein Vergleich
   * gegen sie ginge am Nutzerfall vorbei. Der autoritative Stempel ist die `metadata_revision` der
   * Mutable Metadata Projection; sie steht additiv an `GET /api/kos/:id` und an der Antwort dieser
   * beiden Aktionen.
   *
   * OHNE DAS FELD bleibt alles wie bisher (letzter Schreiber gewinnt) — Word-Add-in, Importwege und
   * jede ältere Oberfläche sind unberührt. `unknown`, weil der Wert aus dem Netz kommt: gelesen wird
   * er von derselben `erwarteteKoVersion`, die auch die Inhaltsfassung liest (eine Ganzzahl ≥ 1 oder
   * ein 400) — `0` ist ausdrücklich KEIN gültiger Stand, sondern `METADATA_REVISION_NONE`, also „für
   * dieses Objekt steht noch gar keine Zeile da".
   */
  expectedMetadataRevision?: unknown;
  /**
   * JOB 3667 R2 — DER EINGEREICHTE ÄNDERUNGSVORSCHLAG (`action: "propose"`).
   *
   * `baseVersion` ist PFLICHT und die Fassung, auf die sich der Vorschlag bezieht; `origin` sagt,
   * woher er kam (`word_addin`). Alles `unknown`, weil es aus dem Netz kommt — gelesen wird es an
   * der `case`, nicht hier geglaubt.
   *
   * JOB 3667 R5: `clearBody` ist die AUSDRÜCKLICHE Löschung des Fließtextes. Ohne sie heisst ein
   * fehlender `bodyHtml` „nicht eingereicht", und die Übernahme lässt den bestehenden stehen.
   */
  proposal?: {
    statement?: unknown;
    bodyHtml?: unknown;
    clearBody?: unknown;
    baseVersion?: unknown;
    origin?: unknown;
  };
  /** JOB 3667 R2: welcher Vorschlag entschieden wird (`action: "decide-proposal"`). */
  proposalId?: string;
  /** JOB 3667 R2: die Begründung einer Entscheidung — ohne sie wäre „abgelehnt" auskunftslos. */
  note?: string;
  category?: string;
  tags?: string[];
  conflict?: ConflictInput;
  conflictId?: string;
  decision?: string;
  newAuthor?: string;
  text?: string;
  /**
   * JOB 4146 (WIKI-DISKUSSION) — die drei Felder des Fadens. Alle `unknown`, weil sie aus dem Netz
   * kommen: gelesen werden sie an der `case`, nicht hier geglaubt.
   *
   * `replyTo` — die Kennung des Beitrags, auf den geantwortet wird. Die EXISTENZ prüft der Dienst
   *   (`COMMENT_NOT_FOUND` → 400), nicht diese Stelle; hier fällt nur eine unbrauchbare FORM durch.
   * `clientKey` — der Beitragsschlüssel des Aufrufers (Vertrag Fall 5): reine Deduplizierung einer
   *   Wiederholung nach unklarer Übertragung, ohne Autorität über irgendetwas.
   * `commentId` — welcher Faden geklärt oder wieder geöffnet wird.
   */
  replyTo?: unknown;
  clientKey?: unknown;
  commentId?: unknown;
  attachment?: {
    name?: string;
    mime?: string;
    dataUrl?: string;
    objectId?: string;
    thumbnail?: string;
    size?: number;
  };
  attachmentId?: string;
  // AUFTRAG-mega15 Block B (bens SB-4): `provider` ist hier BEWUSST nicht mehr aufgeführt. Die
  // Herkunft leitet der Server aus der Adresse ab (attributeExternalSource); ein vom Client
  // geliefertes Herkunftsfeld wird nicht gelesen. Damit deckt sich dieser Laufzeit-Vertrag wieder
  // mit dem deklarierten Frontend-Vertrag (apps/web/src/api/endpoints.ts, KoAction "add-source").
  // AUFTRAG-mega16 Block A: `objectId` ist der ANKER einer adresslosen Belegstelle — die Referenz
  // auf ein Dokument, das dieses Wissensobjekt bereits als Anhang trägt. Der Server GLAUBT ihn
  // nicht, er PRÜFT ihn gegen die eigene Anhangsliste; ein erfundener Wert belegt nichts.
  source?: { label?: string; url?: string; excerpt?: string; objectId?: string };
  sourceId?: string;
  // SCRUM-415: Vertraulichkeitsstufe setzen/ändern.
  level?: string;
  // JOB 557: das Eigentümer-Aggregat. BEWUSST `unknown` — die Form entscheidet ausschliesslich
  // `normalizeOwnership` in der Datenschicht, nicht ein Cast an dieser Route.
  ownership?: unknown;
  // AUFTRAG-mega18 Block A-1: die Nutzlast der VERBUND-OPERATION „Dokumentinhalt übernehmen".
  // Sie fasst zusammen, was bis mega17 drei getrennte Aufrufe waren (attach → n× add-source →
  // revise) — und zwar nicht, um Netzverkehr zu sparen, sondern weil die GRENZEN ZWISCHEN diesen
  // Aufrufen die Fehlerzustände waren, die wir dreimal im Client zu sortieren versucht haben.
  //
  // `operationId` ist der Wiederholschlüssel (Idempotenz). Er trägt KEINE Autorität — die
  // ausführliche Abgrenzung zum `provider`-Fehler aus mega15 steht in
  // services/knowledge-object/src/document-append.ts.
  appendDocument?: {
    operationId?: string;
    anchor?: { objectId?: string; name?: string; mime?: string; thumbnail?: string };
    points?: { label?: string; excerpt?: string; url?: string }[];
    // Fehlt `changes`, bindet die Operation nur Anker + Belege (Erfassen — `create` hat den Inhalt
    // im selben Vorgang schon committet). Mit `changes` revidiert sie den Inhalt gleich mit.
    changes?: { bodyHtml?: string; statement?: string; title?: string };
  };
}

/**
 * JOB 3667 — DIE LESART VON `expectedVersion`: ENTWEDER EINE ECHTE VERSION ODER EIN FEHLER.
 *
 * Drei Ausgänge, alle drei gewollt:
 *   · Feld fehlt (`undefined`)  → `undefined`: kein bedingter Schreibzugriff, Altverhalten.
 *   · Ganzzahl ≥ 1             → genau diese Zahl ist die Bedingung.
 *   · alles Übrige             → `"unlesbar"`, die Route antwortet 400.
 *
 * WARUM DER DRITTE AUSGANG KEIN `undefined` IST: „nicht lesbar" still wie „nicht mitgeschickt" zu
 * behandeln, hiesse einen Schutz abzuschalten, den der Aufrufer gerade angefordert hat — dieselbe
 * Falle, die `null` am Entwurfsweg schon einmal gestellt hat („ein Schutz, den ein Aufrufer
 * weglassen kann, ist keiner", ko-routes.ts JOB 2684 D4). `null` zählt deshalb ausdrücklich als
 * unlesbar, nicht als Abwesenheit.
 *
 * BEWUSST NICHT EXPORTIERT: die Lesart gehört zu dieser einen Route, und ein Export ohne Aufrufer
 * ausserhalb der Tests wäre genau das, was `tests/capture/aufrufer-waechter.test.ts` verhindert.
 * Gemessen wird sie an der Route selbst (tests/word-rueckweg/route-bedingter-schreibzugriff.test.ts).
 */
function erwarteteKoVersion(roh: unknown): number | undefined | "unlesbar" {
  if (roh === undefined) {
    return undefined;
  }
  if (typeof roh !== "number" || !Number.isInteger(roh) || roh < 1) {
    return "unlesbar";
  }
  return roh;
}

// ================================================================================================
// JOB 3024 · DER ANZEIGESTATUS — UND DIE LISTE DESSEN, WAS FUER IHN NICHT NACHGESEHEN WURDE.
// ================================================================================================
//
// DER BEFUND. `GET /api/kos/:id` reichte den Kern-Enum `offen|validiert` durch. Ein Objekt, das ein
// Peer ROT bewertet hat, bleibt nach `trust.ts:46` auf „offen" — an dieser Route war es damit von
// einem Objekt, das noch niemand angesehen hat, NICHT zu unterscheiden. Beide hiessen „offen".
//
// WEDER DIE REGEL NOCH DIE AUSKUNFTSFORM STEHEN HIER. `displayStatus` haelt die Reihenfolge der
// Zweige seit Abstimmpunkt 1, `discloseDisplayStatus` macht daraus die Auskunft samt Herkunft;
// beide in `knowledge-object/src/display-status.ts`. Diese Datei BESCHAFFT nur: sie holt die
// Eingaenge, die sie holen kann, und nennt fuer jeden anderen den Grund. Den Befund „geprueft" kann
// sie nicht setzen — der entsteht drueben allein daraus, ob ein WERT geliefert wurde.
//
// DIE ANTWORT BEHAUPTET NIE EINE ABWESENHEIT. Es gibt kein `konflikte: 0` und kein „nicht faellig" —
// es gibt fuer jeden ungeprueften Eingang einen benannten Grund. Der Kern-Enum `status` bleibt
// daneben unveraendert stehen; die Anzeigestufe tritt NEBEN ihn und wird nirgends gespeichert.

/**
 * Die Gruende, aus denen dieser Lesepfad einen Eingang nicht erhebt — gemessen am Bestand, nicht
 * vermutet. Sie reisen als Text in der Antwort mit; wer sie liest, soll wissen, WARUM hier nichts
 * steht, statt aus dem Schweigen etwas zu schliessen.
 */
const ANZEIGESTATUS_UNGEPRUEFT_GRUND = {
  /**
   * JOB 3002 baut den Konfliktweg gerade um (`services/conflicts/**`, `conflicts-routes.ts`), und
   * `ConflictService` bietet ohnehin keine Abfrage je Objekt, sondern nur `unresolved()` ueber den
   * ganzen Bestand.
   */
  konflikt:
    "Der Konfliktweg wird derzeit umgebaut (JOB 3002); dieser Lesepfad fragt ihn nicht ab. Ob dieses Objekt in einem Konflikt steht, ist hier nicht erhoben.",
  /**
   * JOB 3054: DIESER GRUND IST SEITHER EIN FEHLERGRUND, KEIN NORMALFALL.
   *
   * Bis JOB 3054 stand hier die Enthaltung: der einzige Weg zur Merkerlage war
   * `LifecycleService.pendingRevalidation()`, und der laedt die gesamte Merkerliste, prueft je
   * Merker ein Objekt und ENTFERNT tote Merker (`lifecycle/src/service.ts`) — ein Schreibvorgang
   * auf einem Lesepfad. Nicht das Nachsehen war falsch, sondern dieser eine Weg dorthin.
   *
   * BEIDE LESEROUTEN ERHEBEN JETZT, ueber die schreibfreie Mengengrenze
   * `LifecycleService.revalidierungAnstehtFuer` (`RevalidierungMerkerLeser`). Diese Zeile steht
   * deshalb nur noch da, wenn GENAU DIESE Abfrage fehlgeschlagen ist — und dann sagt sie das.
   */
  revalidierung:
    "Ob fuer dieses Objekt eine Re-Validierung ansteht, ist hier nicht erhoben: die Abfrage der Re-Validierungsmerker ist fehlgeschlagen.",
  /**
   * Zuweisungen und Bewertungen kommen aus DEMSELBEN Aufruf (`validation.pruefstandFuer`). Faellt
   * er aus, fallen beide aus — und beide sagen es, statt still auf „offen" zu fallen (§9).
   */
  zuweisungen:
    "Ob dieses Objekt jemandem zur Pruefung zugewiesen ist, ist hier nicht erhoben: die Abfrage der Pruefstandslage ist fehlgeschlagen.",
  bewertungen:
    "Wie dieses Objekt bewertet wurde, ist hier nicht erhoben: die Abfrage der Pruefstandslage ist fehlgeschlagen.",
} as const;

/**
 * Die Eingangslage, in der NICHTS erhoben ist — jeder Eingang mit seinem benannten Grund.
 *
 * JOB 3043: BEIDE Lesepfade (Detail und Liste) starten hier und ueberschreiben, was sie wirklich
 * beschafft haben. Eine zweite, neu formulierte Gruendetabelle fuer dieselben zwei Gruende waere
 * eine zweite Wahrheit — und die Liste soll dem Detail ja gerade nicht mehr widersprechen.
 */
const ANZEIGESTATUS_NICHT_ERHOBEN: AnzeigestatusEingaenge = {
  zuweisungen: { ungeprueft: ANZEIGESTATUS_UNGEPRUEFT_GRUND.zuweisungen },
  bewertungen: { ungeprueft: ANZEIGESTATUS_UNGEPRUEFT_GRUND.bewertungen },
  konflikt: { ungeprueft: ANZEIGESTATUS_UNGEPRUEFT_GRUND.konflikt },
  revalidierung: { ungeprueft: ANZEIGESTATUS_UNGEPRUEFT_GRUND.revalidierung },
};

// ================================================================================================
// JOB 3043 · DER DECKEL DER LISTENANREICHERUNG — AUSDRUECKLICH, BENANNT UND GANZ ODER GAR NICHT.
// ================================================================================================
//
// WARUM ES IHN GEBEN MUSS. `KoQuery` (oben, vier Felder) kennt kein `limit` und keinen `cursor`:
// `GET /api/kos` liefert die VOLLE sichtbare Menge. Die Anreicherung zieht dafuer die Bewertungen
// aller dieser Objekte in den Speicher — bei einem gewachsenen Bestand also die halbe
// Bewertungsablage, ohne dass der Aufrufer das Risiko sieht. Die Paginierung der Liste selbst ist
// ein eigenes Thema (Zaehler, Cursor-Stabilitaet, SQL-Praedikat); gedeckelt wird hier NUR die
// Anreicherung.
//
// DER WERT. 200, derselbe wie `THEMEN_DECKEL` (wissensnetz/src/lesemodell.ts:69) und aus demselben
// Grund: es ist die Groessenordnung, in der eine Antwort noch eine Sicht ist. Gemessen ist die
// Ausgangslage, nicht die Zukunft — der teure Weg waere `pruefstandFuer` je Zeile (2·N Abfragen,
// davon N Vollscans, Fall K hat den Einzelfall bei 1 gepinnt); `pruefstaendeFuer` macht daraus
// zwei Abfragen, und was dann noch waechst, ist allein die MENGE der geladenen Bewertungszeilen.
// Genau die begrenzt diese Zahl.
//
// GANZ ODER GAR NICHT. Ueber dem Deckel wird NICHT gefragt — auch nicht fuer die ersten 200. Ein
// Teilstand („die ersten 200 geprueft, der Rest nicht") waere eine Antwort, in der zwei Eintraege
// dasselbe Wort mit verschiedener Deckung tragen; wer sie liest, kann den Unterschied nicht sehen,
// ohne jede Herkunft einzeln zu pruefen. Stattdessen sagt die GANZE Antwort dasselbe ueber sich.
export const ANZEIGESTATUS_LISTE_DECKEL = 200;

/**
 * Der Grund, der ueber dem Deckel mitreist — mit dem Deckel UND der tatsaechlichen Zahl darin.
 * Ohne beide Zahlen waere es wieder ein Schweigen mit Etikett: der Leser koennte nicht einschaetzen,
 * ob er knapp darueber liegt oder um das Zehnfache.
 */
function anzeigestatusDeckelGrund(sichtbare: number): string {
  return `Diese Liste fuehrt ${sichtbare} sichtbare Eintraege und liegt damit ueber dem Deckel von ${ANZEIGESTATUS_LISTE_DECKEL}: fuer KEINEN Eintrag wurde die Pruefstandslage abgefragt. Der Anzeigestatus steht hier allein auf dem gespeicherten Status.`;
}

// ================================================================================================
// JOB 4115 — DIE TÜR, AN DIE WORD SCHREIBT, WAR ZU SCHMAL.
// ================================================================================================
//
// DER BEFUND, gemessen und nicht vermutet (Prüfer zu JOB 4085 Runde 1): `PUT /api/kos/:id` trug
// KEIN eigenes `bodyLimit`, es galt Fastifys Vorgabe von 1 MiB. Der Word-Rückweg schreibt aber
// genau hierher — eine Bildlast von 1.520.700 Bytes kam als `413 FST_ERR_CTP_BODY_TOO_LARGE`
// zurück, und der Mensch las „Einreichen fehlgeschlagen". Das Aufgabenfenster schnitt die Bilder
// deshalb vorher weg und sagte es ehrlich; ehrlich, aber für einen Absatz mit Fotos unbrauchbar:
// abzüglich der Reserve blieben rund 1.032.192 Bytes für die ganze Nutzlast, base64 kostet ein
// Drittel — rund 750 KiB Bilddaten.
//
// WARUM 5 MiB UND NICHT 30 (dieselbe Abwägung wie `capture-routes.ts:180-186`, DRAFTS_BODY_LIMIT):
// Es ist DIESELBE Zahl wie am Entwurfsweg, an dem eine Dokumentübernahme mit vielen Bildern längst
// durchgeht — zwei Türen desselben Hauses für denselben Stoff sollen nicht verschieden weit offen
// stehen. Sie ist bewusst KLEIN (kleine Pre-Auth-Parser-Fläche) und später erhöbar, wenn eine
// gemessene Last sie sprengt. Über dem Cap bleibt es beim kontrollierten 413.
//
// UND SIE IST KEIN LOCH: die vergrösserte Parser-Fläche steht hinter einem AUTH-RIEGEL VOR dem
// Body-Parsing (`requireAuthedBeforeParse` in `koRoutes`, Muster `POST /api/drafts` und
// `POST /api/objects`). Die Begründung, warum das hier ohne fachlichen Rechteverlust geht, steht
// dort — sie musste erhoben werden, nicht angenommen.
export const KOS_BODY_LIMIT = 5 * 1024 * 1024; // 5 MiB

export function koRoutes(deps: KoRoutesDeps, guards: Guards): FastifyPluginAsync {
  const {
    ko,
    validation,
    conflicts,
    overlaps,
    lifecycle,
    notifyAssignment,
    uploadLimits,
    objects,
    externalPolicy,
    internalSourceOrigins,
    audit,
    lesevarianten,
    semanticPrefilter,
    aiCheckWorker,
    draftPromotion,
  } = deps;
  // JOB 4155: NICHT mitdestrukturiert, sondern unten als `deps.kanten` gelesen — so steht an der
  // Uebergabestelle, aus welchem Bündel der Port kommt, und ein fehlender Port ist dort sichtbar.

  // AUFTRAG-mega74 BLOCK B: die EINE Torwache dieses Moduls. Sie holt das Objekt, stellt die
  // Sichtbarkeitsfrage an der EINEN Stelle (../sichtbarkeit) und antwortet fail-closed.
  //
  // WARUM 404 UND NICHT 403: ein 403 sagt „das gibt es, du darfst nur nicht". Bei einem
  // vertraulichen Objekt ist schon die Existenz eine Auskunft — die Kennung eines Objekts erfährt
  // man aus einem Konflikt, einer Benachrichtigung oder schlicht durch Raten. „Nicht sichtbar"
  // muss deshalb genauso aussehen wie „gibt es nicht", bis hin zur Meldung.
  // ============================================================================================
  // JOB 4115 · DER RIEGEL VOR DEM PARSEN — UND DIE ERHEBUNG, DIE IHN ERST ERLAUBT.
  // ============================================================================================
  //
  // ERHOBEN, NICHT ANGENOMMEN: `PUT /api/kos/:id` verzweigt per `{action}`. Das Tor oben im Handler
  // ruft `guards.requireUser` nur für Aktionen mit Torurteil `"tor"`. Zwei Aktionen tragen
  // `"kein-zielobjekt"` (ZIELOBJEKT_TOR, s. dort): `conflict` und `resolve-conflict`. Sie laufen am
  // Tor vorbei — aber NICHT an der Anmeldung: ihr eigener `case` verlangt
  // `requirePermission("ko.validate")` bzw. `requirePermission("conflict.resolve")`, und jede
  // andere der 20 Aktionen verlangt ebenfalls ein Recht (gemessen an allen `case`-Zweigen).
  // Es gibt also KEINE Aktion dieser Route, die ohne angemeldeten Absender durchkommt. Damit nimmt
  // dieser Hook niemandem ein fachliches Recht — er verschiebt nur den Zeitpunkt der Absage.
  //
  // WAS SICH SICHTBAR ÄNDERT, und es steht hier statt in einer Fussnote: ein ANONYMER Aufruf mit
  // unbekannter Aktion oder kaputtem JSON bekommt jetzt 401 statt 400. Das ist die richtige
  // Reihenfolge — wer nicht angemeldet ist, hat kein Recht auf eine Formkritik seines Körpers.
  // Für jeden ANGEMELDETEN Aufruf bleibt alles Zeichen für Zeichen: 400 bei unbekannter Aktion,
  // 404 bei unsichtbarem Objekt, 413 über KOS_BODY_LIMIT.
  //
  // WARUM ÜBERHAUPT (Muster WP-D1d, `capture-routes.ts:782`, und JOB 2657 D1, `object-routes.ts:219`):
  // Fastify parst den Körper NACH den `onRequest`-Hooks. Ohne diesen Hook stünde die mit JOB 4115
  // auf 5 MiB vergrösserte Parser-Fläche jedem Anonymen offen; `requireUser` sendet 401, und
  // Fastify bricht den Lifecycle daraufhin anhand `reply.sent` VOR dem Parsing ab. Die fachliche
  // Prüfung im Handler (Torurteil, `sichtbaresKoOder404`, `requirePermission` je `case`) bleibt
  // unverändert bestehen — Defense-in-Depth, kein Ersatz.
  const requireAuthedBeforeParse = async (
    request: Parameters<Guards["requireUser"]>[0],
    reply: Parameters<Guards["requireUser"]>[1],
  ): Promise<void> => {
    await guards.requireUser(request, reply);
  };

  async function sichtbaresKoOder404(user: SessionUser, id: string, reply: FastifyReply) {
    const item = await ko.get(id);
    if (!item || !darfSehen(user, item)) {
      reply.code(404).send({ error: "NOT_FOUND", message: "Wissensobjekt nicht gefunden." });
      return undefined;
    }
    return item;
  }

  // ============================================================================================
  // JOB 3024 · DIE ZWEI ERHEBBAREN EINGAENGE — GEZIELT JE OBJEKT, OHNE STATUSVORBEHALT.
  // ============================================================================================
  //
  // WORAN DIE NAHELIEGENDE FASSUNG SCHEITERT. `KnowledgeObject.assignments` sieht aus wie die
  // Zuweisungsliste, ist es aber nicht: `service.ts:1644` setzt sie einmalig auf `[]`, und KEIN
  // Schreibweg des Produkts aendert sie je. Die echten Zuweisungen liegen im `AssignmentRepo` des
  // Validierungsmoduls, die Bewertungen im `RatingRepo`. Beides kommt hier nur ueber die
  // MODULFASSADE `services/validation/index.ts` in Reichweite — keine Kante in die Innereien, keine
  // neue Abhaengigkeit in `KoRoutesDeps`.
  //
  // ZWEI FASSUNGEN WURDEN VERWORFEN, und beide Gruende sind gemessen:
  //   · `board()` fuehrt per Vertrag nur OFFENE Objekte. Die Bewertungslage eines validierten
  //     Objekts blieb damit ungefragt, und eine aktuelle rote Stimme verschwand nach einem
  //     Admin-Override hinter „validiert" — obwohl `displayStatus` `rejected` VOR `validiert`
  //     prueft und `adminValidate` keine Bewertung loescht (Fall H).
  //   · `board()` laedt ausserdem die Vollmenge des Filters samt einer Bewertungsabfrage je Zeile:
  //     neun gleichartige Fremdobjekte kosteten neun zusaetzliche Abfragen (Fall K, gemessen).
  //
  // `validation.pruefstandFuer(id, version)` fragt stattdessen schreibfrei, je Objekt und fuer JEDEN
  // Status. Dass nur Stimmen der AKTUELLEN Fassung zaehlen (SCRUM-507 R2), entscheidet weiterhin das
  // Validierungsmodul: eine rote Stimme auf eine laengst revidierte Fassung darf das Objekt nicht
  // weiter „abgelehnt" nennen (Fall I).
  //
  // FAIL-CLOSED, ABER NICHT STILL: scheitert die Abfrage, wird daraus KEIN „offen", sondern ein
  // ausgewiesen ungeprueftes Feldpaar mit benanntem Grund (§9: kein Feld traegt eine Aussage ohne
  // frische, erfolgreiche Datengrundlage). Gepinnt in Fall J.
  // ============================================================================================
  // JOB 3054 · DER DRITTE EINGANG WIRD ERHOBEN — UND ZWAR GETRENNT VON DEN ERSTEN ZWEIEN.
  // ============================================================================================
  //
  // DER LESEPFAD BRAUCHT VOM LEBENSZYKLUS GENAU EINE FRAGE, und er nimmt sie in der Form entgegen,
  // in der er sie stellen darf. `RevalidierungMerkerLeser` traegt nur `revalidierungAnstehtFuer`;
  // `pendingRevalidation()` — der selbstheilende, SCHREIBENDE Arbeitsbereichsweg (SCRUM-420) — ist
  // von hier aus nicht erreichbar. Die Zusage „ein Lesepfad schreibt nicht" haelt damit der
  // Compiler und nicht eine Sichtpruefung; gemessen wird sie zusaetzlich in R-4.
  const merkerLeser: RevalidierungMerkerLeser = lifecycle;

  /**
   * Die Merkerlage fuer eine bekannte Menge — EINE Abfrage, egal wie viele Kennungen kommen.
   *
   * DIE RUECKGABE IST EINE FUNKTION, keine Karte: damit gibt es fuer JEDE Kennung eine Antwort,
   * auch im Fehlerfall, und kein Aufrufer muss aus einem fehlenden Karteneintrag etwas schliessen.
   *
   * FAIL-CLOSED, ABER NICHT STILL: scheitert die Abfrage, wird daraus KEIN `false`. `false` hiesse
   * „nachgesehen und nicht faellig"; hier steht stattdessen der benannte Grund (§9).
   */
  async function revalidierungJeEintrag(
    koIds: readonly string[],
  ): Promise<(koId: string) => Erhoben<boolean>> {
    try {
      const anstehend = await merkerLeser.revalidierungAnstehtFuer(koIds);
      return (koId) => ({ wert: anstehend.has(koId) });
    } catch {
      return () => ({ ungeprueft: ANZEIGESTATUS_UNGEPRUEFT_GRUND.revalidierung });
    }
  }

  /**
   * JOB 3054: DIE ZWEI ERHEBUNGEN LAUFEN NEBENEINANDER UND FALLEN EINZELN.
   *
   * Pruefstandslage und Merkerlage kommen aus verschiedenen Modulen und koennen unabhaengig
   * ausfallen. Ein gemeinsames `try` haette sie aneinandergekettet: ein Ausfall der Merkerablage
   * haette `zuweisungen` und `bewertungen` mit in die Enthaltung gerissen, obwohl sie erhoben
   * waren — eine Antwort, die weniger weiss, als der Server nachgesehen hat. Gepinnt in R-6a/R-6b.
   */
  async function anzeigestatusEingaengeFuer(
    item: KnowledgeObject,
  ): Promise<AnzeigestatusEingaenge> {
    const [ausPruefstand, revalidierungFuer] = await Promise.all([
      pruefstandEingaengeFuer(item),
      revalidierungJeEintrag([item.id]),
    ]);
    return { ...ausPruefstand, revalidierung: revalidierungFuer(item.id) };
  }

  /** Die zwei Eingaenge aus der Pruefstandslage — fail-closed mit ihrem eigenen Grund (Fall J). */
  async function pruefstandEingaengeFuer(item: KnowledgeObject): Promise<AnzeigestatusEingaenge> {
    try {
      return anzeigestatusEingaengeAus(await validation.pruefstandFuer(item.id, item.version));
    } catch {
      return ANZEIGESTATUS_NICHT_ERHOBEN;
    }
  }

  /** Aus der Pruefstandslage werden die zwei Eingaenge, die dieser Lesepfad ueberhaupt erhebt. */
  function anzeigestatusEingaengeAus(stand: KoPruefstand): AnzeigestatusEingaenge {
    return {
      ...ANZEIGESTATUS_NICHT_ERHOBEN,
      zuweisungen: { wert: stand.assignments },
      bewertungen: { wert: { rejected: stand.votes.down > 0 } },
    };
  }

  // ============================================================================================
  // JOB 3043 · DIESELBE AUSKUNFT FUER DIE GANZE LISTE — EIN AUFRUF, ZWEI ABFRAGEN.
  // ============================================================================================
  //
  // WAS HIER NICHT PASSIERT: `anzeigestatusEingaengeFuer` in einer Schleife. Das waere richtig und
  // unbezahlbar zugleich — je Eintrag eine Bewertungsabfrage UND ein Vollscan der
  // Zuweisungstabelle, ohne Deckel. Genau dieser Aufwand hat die Liste aus JOB 3024
  // herausgehalten (`PRIORITAETEN.md` N4: „N+1 ohne Deckel"). `validation.pruefstaendeFuer` macht
  // stattdessen zwei Abfragen fuer die ganze Menge; gezaehlt in
  // `tests/anzeigestatus-liste/kos-liste-anzeigestatus.test.ts` (L3).
  //
  // DIE RUECKGABE IST EINE FUNKTION, keine Karte: damit gibt es fuer JEDEN Eintrag eine Antwort,
  // auch im Deckel- und im Fehlerfall, und kein Aufrufer muss aus einem fehlenden Karteneintrag
  // etwas schliessen. Was nicht erhoben wurde, sagt es mit Grund.
  async function anzeigestatusEingaengeJeEintrag(
    sichtbare: readonly KnowledgeObject[],
  ): Promise<(item: KnowledgeObject) => AnzeigestatusEingaenge> {
    if (sichtbare.length > ANZEIGESTATUS_LISTE_DECKEL) {
      const deckel = anzeigestatusDeckelGrund(sichtbare.length);
      // Alle vier Eingaenge tragen den Deckel. Bei `konflikt` steht er NEBEN dem bestehenden Grund,
      // nicht an seiner Stelle: dieser Eingang wird auch unterhalb des Deckels nicht erhoben, und
      // ein alleiniger Deckelgrund liesse das Gegenteil vermuten.
      //
      // JOB 3054: `revalidierung` traegt seither den Deckelgrund ALLEIN — wie `zuweisungen` und
      // `bewertungen`. Unterhalb des Deckels wird er erhoben; der Deckel ist der einzige Grund,
      // aus dem er hier fehlt, und ein danebenstehender Fehlergrund waere schlicht unwahr.
      const ueberDeckel: AnzeigestatusEingaenge = {
        zuweisungen: { ungeprueft: deckel },
        bewertungen: { ungeprueft: deckel },
        konflikt: { ungeprueft: `${ANZEIGESTATUS_UNGEPRUEFT_GRUND.konflikt} ${deckel}` },
        revalidierung: { ungeprueft: deckel },
      };
      return () => ueberDeckel;
    }
    // JOB 3054: zwei Erhebungen, nebenlaeufig und einzeln fallend — dieselbe Trennung wie am
    // Detailpfad. Die Merkerabfrage kommt fuer die GANZE sichtbare Menge, nicht je Eintrag (R-5).
    const [ausPruefstand, revalidierungFuer] = await Promise.all([
      pruefstaendeJeEintrag(sichtbare),
      revalidierungJeEintrag(sichtbare.map((item) => item.id)),
    ]);
    return (item) => ({ ...ausPruefstand(item), revalidierung: revalidierungFuer(item.id) });
  }

  /** Die zwei Eingaenge aus der Pruefstandslage, fuer die ganze Menge in zwei Abfragen (L3). */
  async function pruefstaendeJeEintrag(
    sichtbare: readonly KnowledgeObject[],
  ): Promise<(item: KnowledgeObject) => AnzeigestatusEingaenge> {
    try {
      const staende = await validation.pruefstaendeFuer(
        sichtbare.map((item) => ({ id: item.id, version: item.version })),
      );
      return (item) => {
        const stand = staende.get(item.id);
        // FAIL-CLOSED AUCH IM EINZELFALL: eine fehlende Lage wird nicht zu einer leeren
        // Zuweisungsliste umgedeutet. `pruefstaendeFuer` sagt zu, jede Kennung zu beantworten;
        // wenn diese Zusage je bricht, sagt die Antwort es, statt „offen" zu behaupten.
        return stand ? anzeigestatusEingaengeAus(stand) : ANZEIGESTATUS_NICHT_ERHOBEN;
      };
    } catch {
      return () => ANZEIGESTATUS_NICHT_ERHOBEN;
    }
  }

  return async (app) => {
    // ============================================================================================
    // JOB 2009 · D2 — H3 BEKOMMT SEINEN LESER. Datei und Zeile dieses Aufrufs sind der Beleg.
    // ============================================================================================
    //
    // DER BEFUND, der hierher gefuehrt hat (JOB 2009 D1): `wissensnetzLuecken` — der einzige
    // oeffentliche Weg des Wissensnetz-Moduls — wurde im Produkt von NIEMANDEM gerufen. Alle
    // Treffer lagen in Tests. Das ist der KA2-Praezedenzfall: zwei sauber gebaute Haelften, die
    // sich nicht beruehren.
    //
    // WAS SIE ZEIGT: die Zahlen ueber den Bestand, so wie DIESER Betrachter ihn sieht — wie viele
    // Objekte, wie viele ohne Thema, wie viele Beitragende je Thema. „Erheben ist nicht Anzeigen"
    // (Auftrag §3): die Erhebung bleibt unveraendert, sie bekommt hier nur einen Leser.
    // `/api/graph` zeigt WAS zusammenhaengt; diese Route zeigt, WIE VIEL davon da ist.
    //
    // WARUM HIER UND NICHT IN `library-routes`: Dort liegt der `KoService` nur im OPTIONALEN
    // `detection`-Objekt. Ein Aufrufer, der an einer optionalen Abhaengigkeit haengt, waere ein
    // bedingter Aufrufer — und ein bedingter Aufrufer ist genau die halbe Sache, die H3
    // vierzehn Durchgaenge gekostet hat. Hier ist `ko` Pflichtabhaengigkeit (`KoRoutesDeps`).
    //
    // DIE SICHTBARKEIT KOMMT NICHT VON HIER. Diese Route uebergibt KEIN Praedikat — sie kann es
    // gar nicht, der Einstieg nimmt keines entgegen (`h3-consumer-typvertrag.test.ts` C3). Sie
    // uebergibt den BETRACHTER; gefiltert wird mit der zentralen Policy, die die
    // Kompositionswurzel in die Naht gereicht hat (`build-app.ts`, `policyNahtSchliessen`). Ist
    // die Naht offen, wirft das Modul, BEVOR es das erste Objekt liest — dann steht hier ein
    // Fehler und keine leere Liste, die wie ein Ergebnis aussieht.
    //
    // DER DECKEL kommt aus der Anfrage und wird vom Modul selbst begrenzt (`THEMEN_DECKEL`; ein
    // unbrauchbarer Wert gilt als nicht angegeben, `lesemodell.ts:153-162`). Hier wird deshalb
    // nichts nachgerechnet — eine zweite Deckelrechnung waere eine zweite Wahrheit.
    app.get<{ Querystring: { deckel?: string } }>(
      "/api/wissensnetz/luecken",
      async (request, reply) => {
        const user = await guards.requirePermission("ko.read", request, reply);
        if (!user) {
          return;
        }
        const roh = request.query.deckel;
        try {
          const metrik = await wissensnetzMetrikFuer(
            { id: user.id, role: user.role },
            {
              kos: { alle: () => ko.list({}) },
              // JOB 4155 (Lieferung 1): die Kantenauskunft. Der Schluessel wird WEGGELASSEN, wenn
              // kein Port verdrahtet ist — unter `exactOptionalPropertyTypes` ist ein
              // `kanten: undefined` etwas anderes als „nicht da", und das Lesemodell
              // unterscheidet genau daran (`lesemodell.ts:216-220`). Die Antwort traegt dann
              // `verknuepfungAusgelassen: true` mit dem Grund `"kein-kantenport"`, nicht eine 0.
              //
              // DIE SICHTBARKEIT REIST NICHT VON HIER MIT: das Lesemodell reicht dem Port sein
              // eigenes, aus der Naht geholtes Praedikat herein (`lesemodell.ts:254`). Diese
              // Route uebergibt weiterhin KEIN Praedikat — C3 bleibt gruen.
              ...(deps.kanten !== undefined ? { kanten: deps.kanten } : {}),
            },
            roh !== undefined ? { deckel: Number(roh) } : {},
          );
          reply.code(200).send(metrik);
        } catch (error) {
          sendError(reply, error);
        }
      },
    );

    app.get<{ Querystring: KoQuery }>("/api/kos", async (request, reply) => {
      const user = await guards.requirePermission("ko.read", request, reply);
      if (!user) {
        return;
      }
      // mega74 B: ein unsichtbares Objekt fehlt in der Liste — es erscheint nicht als gesperrter
      // Platzhalter. Ein Platzhalter wäre wieder eine Existenzauskunft.
      //
      // ==========================================================================================
      // AUFTRAG-BASIC-391 — DIESELBE ENTSCHEIDUNG REIST JETZT BIS IN DAS SQL.
      // ==========================================================================================
      //
      // `sichtbareFuer` allein war eine Nachfilterung, und `KoService.list` warf den Papierkorb im
      // Anwendungsspeicher weg. Solange beides oberhalb von SQL steht, wäre jede spätere Zählung
      // oder Paginierung falsch gebaut: ein `LIMIT` lieferte Zeilen, von denen danach noch welche
      // abgezogen werden — kurze Seiten, überspringende Cursor, und jeder Zähler wäre eine
      // Existenzauskunft (BASIC 380 `R-3`, vermessen in BASIC 385).
      //
      // Ab hier wird DIESELBE Entscheidung zusätzlich als SQL-Prädikat injiziert und wirkt auf der
      // GRUNDMENGE. Es ist genau die Naht, die die Bibliothekssuche seit BASIC 380 benutzt.
      //
      // DIES IST DIE EINZIGE STELLE, DIE DEN TRIM ÜBERGIBT. Papierkorb (`/api/kos/trash`),
      // Import-Anker, Sweep und Quellanker laufen weiter ungetrimmt über `repo.list` — sie MÜSSEN
      // getrashte Zeilen sehen. Ein Default am Repository oder am Service bräche alle vier.
      //
      // WARUM `sichtbareFuer` TROTZDEM STEHEN BLEIBT: G-SHADOW, wörtlich (`oldAllowed ∧
      // newAllowed`). Eine neue Regel darf Sichtbarkeit nie erweitern; ein Aufbau ohne Trim findet
      // hier weiterhin das Tor vor, das seit mega74 steht. Die Zusage dieser Route ändert sich
      // damit nicht — sie wird nur zählbar und paginierbar.
      const sichtbare = sichtbareFuer(
        user,
        await ko.list(request.query, sqlSichtbarkeitFuer(user)),
      );
      // ==========================================================================================
      // JOB 3043 · DER ZWEITE LESEPFAD SAGT JETZT DASSELBE WIE DER ERSTE.
      // ==========================================================================================
      //
      // Bis hierher sendete diese Zeile das ROHE Objekt: ein Eintrag, den `GET /api/kos/:id` seit
      // JOB 3024 `abgelehnt` nennt, hiess in der Liste weiter `validiert`. Zwei Lesepfade, zwei
      // Antworten ueber dasselbe Objekt — und die Liste war die, die man zuerst sieht.
      //
      // ES ENTSTEHT KEINE ZWEITE ABLEITUNG. `discloseDisplayStatus` ist dieselbe Funktion, die der
      // Detailabruf ruft; die Gruende fuer nicht Erhobenes kommen aus derselben Tabelle. Diese
      // Route beschafft nur — und wo sie nichts beschafft hat, sagt sie warum.
      //
      // DIE REIHENFOLGE IST DER SCHUTZ: `sichtbareFuer` steht in der Zeile DARUEBER. Angereichert
      // wird ausschliesslich die sichtbare Menge, und nur ihre Kennungen gehen an die
      // Pruefstandsabfrage. Ein Prueflauf ueber ein unsichtbares Objekt waere eine Existenzauskunft
      // ueber den Umweg der Kosten (gepinnt in L6).
      const eingaengeFuer = await anzeigestatusEingaengeJeEintrag(sichtbare);
      reply.code(200).send(
        sichtbare.map((item) => ({
          ...item,
          ...discloseDisplayStatus(item, eingaengeFuer(item)),
        })),
      );
    });

    app.get<{ Params: { id: string } }>("/api/kos/:id", async (request, reply) => {
      const user = await guards.requirePermission("ko.read", request, reply);
      if (!user) {
        return;
      }
      const item = await sichtbaresKoOder404(user, request.params.id, reply);
      if (!item) {
        return;
      }
      // ==========================================================================================
      // JOB 3009 · STATION 4, ZWEITE SERVERHAELFTE — AUCH HIER HEISST FEHLEN FEHLEN.
      // ==========================================================================================
      //
      // Das Pruef-Board sagt seit JOB 3003 ausdruecklich `confidentiality: null` mit
      // `confidentialityProvenance: "unknown"`, wenn der Bestand keine Stufe traegt. Diese Route
      // sagte an derselben Stelle GAR NICHTS: die Stufe wird am Modell nur gespeichert, wenn sie
      // tatsaechlich vertraulich ist (service.ts:1650-1654), und ein nicht gesetztes optionales
      // Feld fehlt im JSON vollstaendig. Wer vom Board aus das Objekt oeffnete, konnte „dieses
      // Objekt ist nicht eingestuft" und „diese Route liefert die Einstufung nicht" wieder nicht
      // unterscheiden — die Verwechslung kippte eine Klickebene tiefer zurueck.
      //
      // DIESELBE REGEL, NICHT DIESELBE SCHREIBWEISE: `discloseConfidentiality` ist die EINE Stelle
      // (knowledge-object/src/confidentiality.ts); das Board ruft ueber `mitHerkunft` dieselbe
      // Funktion. Eine hier hingeschriebene Kopie waere die vierte Auslegung derselben Entscheidung.
      // Ein vorhandener gueltiger Wert bleibt unveraendert; ein ungueltiger Altwert wird `null` +
      // `"unknown"` und ausdruecklich NICHT „intern".
      //
      // DIE REIHENFOLGE IST DER SCHUTZ: `sichtbaresKoOder404` steht OBEN, VOR dieser Zeile —
      // dieselbe Reihenfolge wie am Board (validation-routes.ts, Filter vor Anreicherung). Ein
      // unsichtbares Objekt bleibt ein 404; schon eine 200er-Antwort mit `null`-Feldern waere eine
      // Existenzauskunft.
      //
      // DIE GRENZE, UND SIE IST BEWUSST: `origin` wird NICHT angefasst und es entsteht KEINE
      // zweite, schlanke Quellenliste neben `sources`. Der Detailabruf gibt das volle Objekt samt
      // `sources` heraus (mit `excerpt`); ein zweiter, schlankerer Quellenschnitt auf DEMSELBEN
      // Lesepfad waere eine zweite Wahrheit ueber dieselben Daten. `originSources` ist die
      // UEBERSICHTSform des Boards und gehoert dorthin (board-herkunft.ts, „WARUM DIE QUELLENLISTE
      // NUR DREI FELDER TRAEGT").
      //
      // Es ist eine reine Lese-Sicht: kein Backfill, keine Migration, kein Schreiben einer Stufe,
      // wo keine steht. Der Schreibweg (`PUT /api/kos/:id {action:"confidentiality"}`) bleibt
      // unberuehrt.
      //
      // JOB 3024 reiht sich in DIESELBE Reihenfolge ein: das Tor oben, die Anreicherung hier. Die
      // Anzeigestufe wird aus dem bereits geladenen Objekt und dem Pruefstand abgeleitet — sie
      // fragt nichts, was der Betrachter nicht ohnehin sehen darf, und sie tritt NEBEN `status`,
      // nicht an seine Stelle. Was fuer sie nicht erhoben wurde, steht in `anzeigestatusHerkunft`.
      // JOB 3326: die LESEVARIANTEN treten als eigenes Feld daneben — `title`, `statement` und
      // `bodyHtml` des Objekts bleiben WÖRTLICH das Original. Genau das ist die Zusage dieses Jobs:
      // die Übersetzung ist eine zweite Lesart, nie eine zweite Wahrheit. Wer dieses Feld nicht
      // kennt (Word-Add-in, Export, ältere Oberfläche), liest weiter genau das, was er bisher las.
      // Fehlt die Verdrahtung oder gibt es keine Variante, fehlt das Feld ganz — kein leeres
      // Objekt, das sich als „geprüft, nichts da" lesen liesse.
      //
      // JOB 4251 (WIKI-ZUSAMMENARBEIT): der STEMPEL DER EINORDNUNG tritt in derselben Bauform
      // daneben. Er ist kein neues Feld am Wissensobjekt, sondern die `metadata_revision` der
      // Mutable Metadata Projection — genau der Stand, gegen den `PUT {action:"tags"|"category"}`
      // bedingt schreibt. Die Fläche kann nur senden, was sie GESEHEN hat; ohne diese Zeile müsste
      // sie den Stand im Browser ableiten, und das wäre die zweite Wahrheit, die es nicht geben darf.
      //
      // GIBT ES KEINE ZEILE (Altbestand, `METADATA_REVISION_NONE`), FEHLT DAS FELD GANZ — kein `0`,
      // das sich als gültiger Stand lesen liesse. Wer es nicht kennt (Word-Add-in, Export, ältere
      // Oberfläche), liest weiter genau das, was er bisher las.
      //
      // RUNDE 2 · UND ER KOMMT MIT SEINEN WERTEN AUS EINER KLAMMER (BEN, Korrekturpflicht 1).
      // Runde 1 holte hier nur die Zahl und liess Kategorie und Schlagwörter bei `item` — zwei
      // Lesevorgänge ohne Klammer. Wer im Fenster dazwischen schrieb, bekam ALTE Werte mit dem
      // NEUEN Stempel, und der Stempel beglaubigte damit das Überschreiben einer Einordnung, die
      // niemand gesehen hatte. `einordnungsstandVon` liest beides in DEMSELBEN per-KO
      // serialisierten Abschnitt, in dem auch geschrieben wird.
      //
      // ES WANDERN AUSSCHLIESSLICH KATEGORIE UND SCHLAGWÖRTER NACH — nichts sonst. Das
      // Sichtbarkeitsurteil oben ist an `item` gefallen; ein rundum frischeres Objekt hier würde
      // ein zwischenzeitliches Vertraulichkeits-Upgrade an diesem Urteil vorbeitragen. Die beiden
      // Einordnungsfelder sind nach KW-ARCH-G27 ausdrücklich keine Sicherheitsmerkmale.
      const einordnung = await ko.einordnungsstandVon(item.id);
      const varianten = (await lesevarianten?.forKo(item.id)) ?? [];
      reply.code(200).send({
        ...item,
        ...discloseConfidentiality(item.confidentiality),
        ...discloseDisplayStatus(item, await anzeigestatusEingaengeFuer(item)),
        ...(einordnung
          ? {
              category: einordnung.category,
              tags: einordnung.tags,
              ...(einordnung.metadataRevision === undefined
                ? {}
                : { metadataRevision: einordnung.metadataRevision }),
            }
          : {}),
        ...(varianten.length > 0
          ? {
              lesevarianten: Object.fromEntries(
                varianten.map((v) => [v.lang, mitAenderungsauskunft(v, item)]),
              ),
            }
          : {}),
      });
    });

    app.get<{ Params: { id: string } }>("/api/kos/:id/versions", async (request, reply) => {
      const user = await guards.requirePermission("ko.read", request, reply);
      if (!user) {
        return;
      }
      try {
        // mega74 B: die Versionen tragen VOLL-Snapshots des Inhalts (SCRUM-159/161) — sie sind
        // derselbe Inhalt in älteren Fassungen und brauchen deshalb dasselbe Tor.
        if (!(await sichtbaresKoOder404(user, request.params.id, reply))) {
          return;
        }
        reply.code(200).send(await ko.versionsOf(request.params.id));
      } catch (error) {
        sendError(reply, error);
      }
    });

    app.get<{ Params: { id: string } }>("/api/kos/:id/evidence", async (request, reply) => {
      const user = await guards.requirePermission("ko.read", request, reply);
      if (!user) {
        return;
      }
      try {
        // mega74 B: Belegzitate (`label`, `grund`/excerpt, Quell-URLs) sind Inhalt des Objekts.
        if (!(await sichtbaresKoOder404(user, request.params.id, reply))) {
          return;
        }
        reply.code(200).send(await ko.evidenceOf(request.params.id));
      } catch (error) {
        sendError(reply, error);
      }
    });

    // SCRUM-169: KO-übergreifender read-only Evidence-Index (QM/Stufe 2). Nur Metadaten,
    // defensiv limitiert; keine Object-Rohdaten, keine externen Inhalte.
    app.get<{ Querystring: { limit?: string } }>("/api/evidence", async (request, reply) => {
      const user = await guards.requirePermission("ko.read", request, reply);
      if (!user) {
        return;
      }
      const raw = request.query.limit;
      const limit = raw !== undefined ? Number(raw) : undefined;
      try {
        // AUFTRAG-mega74 BLOCK B: der KO-ÜBERGREIFENDE Index gab Belegstellen aller Objekte aus —
        // `label`, Quell-URL und Verknüpfungsgrund, ohne je nach der Stufe des tragenden Objekts zu
        // fragen. Das ist derselbe Inhalt wie `/api/kos/:id/evidence`, nur ohne das Tor davor.
        //
        // Die Auflösung ist je DISTINKTER Kennung, nicht je Datensatz: das Limit ist hart gedeckelt
        // (MAX_EVIDENCE_LIMIT = 500), und ein Objekt trägt in aller Regel mehrere Belege.
        const records = await ko.recentEvidence(limit);
        const sichtbarkeit = new Map<string, boolean>();
        for (const koId of new Set(records.map((r) => r.koId))) {
          const traeger = await ko.get(koId);
          // Fail-closed: ein Beleg, dessen tragendes Objekt nicht (mehr) auflösbar ist, wird nicht
          // ausgegeben — sonst überlebte die Belegstelle ihr Objekt.
          sichtbarkeit.set(koId, traeger ? darfSehen(user, traeger) : false);
        }
        reply.code(200).send(records.filter((r) => sichtbarkeit.get(r.koId) === true));
      } catch (error) {
        sendError(reply, error);
      }
    });

    app.post<{ Body: Omit<CreateKoInput, "author"> & { reviewerIds?: string[] } }>(
      "/api/kos",
      async (request, reply) => {
        const user = await guards.requirePermission("ko.create", request, reply);
        if (!user) {
          return;
        }
        try {
          // FR-CAP-07: Autor = angemeldeter Nutzer, serverseitig gesetzt (nicht aus dem Body).
          // SCRUM-470 (ben-Review #1): Herkunfts-/Vertrauensanker (`sources`: peerValidated, externalId/
          // pageId, spaceKey, sourceVersion) dürfen NUR über den Import-Pfad gesetzt werden. Auf dem
          // öffentlichen Schreibpfad Client-`sources` verwerfen — sonst könnte jeder mit ko.create
          // gefälschte/peer-validierte Anker setzen und spätere pageId-Upserts kapern.
          // WP-SHIP8-CLOSE-3/4 (bens ROT-1): importCandidateId ebenfalls verwerfen — der
          // Kandidaten-Anker gehört AUSSCHLIESSLICH dem Import-Accept (sonst könnte ein Client
          // die Crash-Recovery eines fremden Review-Claims auf sein eigenes KO umlenken bzw.
          // den DB-Unique-Anker eines Kandidaten vorab besetzen).
          // JOB 557: `ownership` ebenfalls verwerfen. `ko.create` hat jeder Experte; über den
          // Spread wäre das Feld allein durch seine Existenz an `CreateKoInput` öffentlich setzbar
          // gewesen — und wer ein Objekt anlegt, könnte damit die Nacharbeit eines fremden
          // Menschen erklären. Serverwerte werden hier nicht aus ungeprüftem Clientspread geerbt;
          // der autorisierte Weg ist die Aktion `ownership` (Recht `ko.validate`) weiter unten.
          const {
            reviewerIds,
            sources: _ignoredSources,
            importCandidateId: _ignoredAnchor,
            ownership: _ignoredOwnership,
            ...input
          } = request.body;
          // ==========================================================================================
          // JOB 3429 (Q3 c) — OHNE EINSTUFUNG ENTSTEHT HIER KEIN WISSENSOBJEKT.
          // ==========================================================================================
          //
          // DER BEFUND (JOB 3082 Runde 3, Codex-Antwort 25 Punkt 2). Die Stufenpflicht stand an ZWEI
          // von DREI Anlagewegen: in der Oberfläche (`apps/web/src/pages/Capture.tsx`, `requestSubmit`
          // kehrt ohne Wahl um) und am Entwurfs-Promote (`services/capture/src/service.ts`,
          // `toKoInput` → INCOMPLETE). Hier fehlte sie, weil `confidentiality` am Eingabetyp optional
          // ist (`services/knowledge-object/src/types.ts:230`) — ein Rumpf ohne das Feld legte an. So
          // entstand ein Objekt, das NIEMAND eingestuft hat, und jede spätere Regel, die auf der Stufe
          // aufbaut, stünde für dieses Objekt auf Sand.
          //
          // EINE PFLICHT, DIE NUR DER CLIENT KENNT, IST KEINE — derselbe Satz, mit dem JOB 3082 den
          // Promote-Weg begründet hat (`services/capture/src/service.ts`, `KO_PFLICHTFELDER`).
          //
          // WARUM HIER UND NICHT IM DIENST. `ko.create` ist auch der Weg von Import und Seed, und für
          // die gelten eigene Regeln (s. Kommentar oben: Herkunftsanker nur über den Import). Ein
          // bewusst uneingestuftes Objekt — Altbestand, Fixtures — entsteht weiterhin über den Dienst.
          // Verschärft wird genau der ÖFFENTLICHE Schreibweg, dort, wo er schon heute seine eigenen
          // Grenzen zieht.
          //
          // WARUM KEIN VORGABEWERT. Ein stilles „intern" wäre genau die erfundene Einstufung, die
          // JOB 3076/3082 abgeschafft haben: „nie eingestuft" muss ausdrückbar bleiben, sonst kann
          // `discloseConfidentiality` (`confidentiality.ts:99-102`) den Altbestand nicht mehr ehrlich
          // als `{ null, "unknown" }` melden. Fehlende Stufe ist ein Eingabefehler, keine Annahme.
          //
          // NUR DAS FEHLEN steht hier. Ein VORHANDENER, aber ungültiger Wert wird schon vom Dienst
          // abgewiesen (`service.ts`, INVALID_CONFIDENTIALITY → 400) — auch `null`, das darum nicht in
          // diese Prüfung gehört. Zwei Prüfungen für denselben Wert wären zwei Auslegungen.
          //
          // BESTAND BLEIBT UNANGETASTET: das wirkt nur auf neue Anlagen, rückwirkend ändert sich nichts.
          //
          // JOB 3569: der Satz selbst steht jetzt in `sendMissingConfidentiality` (oben im Modul) —
          // der Dokumentweg `POST /api/kos/from-document` gibt dieselbe Antwort und darf dafür
          // keinen zweiten Wortlaut erfinden. An der PRÜFUNG ändert das nichts.
          if (input.confidentiality === undefined) {
            sendMissingConfidentiality(reply);
            return;
          }
          const created = await ko.create({ ...input, author: user.id });
          // SCRUM-395: Prüfer-Vorschlag beim Einreichen — der Autor darf für sein EIGENES,
          // frisch eingereichtes KO Prüfer benennen (dedupliziert, ohne sich selbst).
          // Läuft über validation.assign + Benachrichtigung (FR-VAL-07) wie die Board-Zuweisung.
          const reviewers = [...new Set(reviewerIds ?? [])].filter((id) => id !== user.id);
          if (reviewers.length > 0) {
            await validation.assign(created.id, reviewers, user.id);
            await notifyAssignment?.(created.id, reviewers);
          }
          // WP-SUBMIT-ASYNC (Pedis Architektur-Entscheid R3, 21.07.): die KI-Prüfung blockiert
          // das Einreichen NICHT mehr (Messung: 1:28 min). Statt der früheren synchronen
          // detect*-Aufrufe wird nur der Prüf-Job vermerkt (aiCheck pending, ein schmaler
          // Feld-Patch) und im In-Process-Worker NACH der Antwort abgearbeitet — dieselben
          // Erkennungs-Pfade, dieselben Ergebnis-Signale, nur später (Status im Board sichtbar).
          // Die 201-Antwort trägt den Vermerk ehrlich mit (aiCheck pending) — das Nachlesen
          // passiert VOR dem enqueue, damit die Antwort deterministisch den Job-Start zeigt.
          let submitted = created;
          if (aiCheckWorker) {
            await ko.markAiCheckPending(created.id);
            submitted = (await ko.get(created.id)) ?? created;
            // WP-SHIP8-CLOSE-2 (bens F3): die Zielversion des frisch gesetzten pending-Vermerks
            // reist SYNCHRON mit dem Job — die Overflow-Eviction schließt hart versionsgebunden ab.
            aiCheckWorker.enqueue(created.id, submitted.aiCheck?.koVersion);
          }
          reply.code(201).send(submitted);
          // Weg 3 (B6): Einbettung + Ablage NACH der Antwort — der Nutzer wartet nie darauf. Flag aus
          // = No-op; Fehler brechen den (bereits gesendeten) Submit nie. await nur zur deterministischen
          // Fertigstellung der Ablage, nicht zur Client-Latenz (201 ist schon raus).
          await indexKoForDuplicatePrefilter(created, semanticPrefilter);
        } catch (error) {
          sendError(reply, error);
        }
      },
    );

    // ==============================================================================================
    // AUFTRAG-mega19 Block B — DIE ERSTANLAGE AUS DOKUMENTEN. EINE FACHOPERATION, NEBEN DER ROUTE.
    // ==============================================================================================
    //
    // WAS HIER GELÖST WIRD. Das frische Erfassen committete den Body zuerst (POST /api/kos bzw.
    // Promote) und band die Herkunft danach mit je einem `append-document` pro Ankerdokument.
    // Zwischen beiden Schritten lag ein Fenster, in dem Dokumentinhalt OHNE Herkunft im Bestand
    // stand — bei zwei Ankerdokumenten sogar dauerhaft, wenn der zweite Aufruf scheiterte.
    //
    // WAS NICHT PASSIERT. `POST /api/kos` wird NICHT wieder für Client-`sources` geöffnet. Die
    // SCRUM-470-Grenze steht unberührt (die Gegenprobe dazu ist gepinnt); diese Route ist eine
    // ZWEITE, engere Tür, keine Aufweichung der ersten. Was hier hereinkommt, ist keine beliebige
    // Quellenliste: jede Belegstelle gehört zu einem Dokument, das dieser Server im SELBEN Vorgang
    // als Anhang des neuen Objekts bindet und dessen Existenz er vorher im eigenen Objektspeicher
    // nachgeschlagen hat. `peerValidated` ist hart `false`, `provider` leitet der Server ab,
    // `importCandidateId`/`externalId` gibt es hier gar nicht.
    //
    // DIESELBEN ZWEI REGELN WIE IN DER VERBUND-OPERATION, an denselben zwei Orten:
    //   (I)  EXTERNE STUFENREGEL — hier unten, `decideExternalAttach` je Belegstelle.
    //   (II) INTERNE BELEGPFLICHT — im Service (`requireDocumentEvidence`), stufenblind.
    // An services/external-search/src/attach-policy.ts ändert sich KEIN Zeichen.
    app.post<{ Body: FromDocumentBody }>("/api/kos/from-document", async (request, reply) => {
      const user = await guards.requirePermission("ko.create", request, reply);
      if (!user) {
        return;
      }
      const badRequest = (message: string): void => {
        reply.code(400).send({ error: "BAD_REQUEST", message });
      };
      try {
        const body = request.body ?? {};
        const entries = body.documents ?? [];
        // ---- UNVERÄNDERLICHE FORMPRÜFUNGEN ----------------------------------------------------
        if (entries.length === 0) {
          return badRequest("documents fehlt — kein Inhalt ohne Herkunft.");
        }
        for (const entry of entries) {
          if (!entry?.anchor?.objectId || !entry.anchor.name || !entry.anchor.mime) {
            return badRequest(
              "documents[].anchor {objectId, name, mime} fehlt — übernommener Dokumentinhalt braucht sein Original.",
            );
          }
          if (!entry.points || entry.points.length === 0) {
            return badRequest("documents[].points fehlt — kein Inhalt ohne Herkunft.");
          }
          if (entry.points.some((p) => !p?.label?.trim())) {
            return badRequest("documents[].points[].label fehlt.");
          }
        }
        // ==============================================================================
        // AUFTRAG-mega22 Block C — `draftId` OHNE `draftPayload` GIBT ES NICHT MEHR.
        // ==============================================================================
        //
        // DER BEFUND (bens SB-D). Der Altweg akzeptierte `draftId` allein; dann trug der Abdruck
        // weder Entwurfs-Kennung noch Entwurfsinhalt, sondern nur Dokumente und Prüfer. Verschiedene
        // Entwürfe und verschiedene gespeicherte Entwurfsstände waren damit UNUNTERSCHEIDBAR: nach
        // einem ersten Erfolg konnte ein Wiederholversuch mit ANDERER Entwurfs-Kennung als identisch
        // adoptiert werden — der zweite Entwurf blieb unangetastet, und der Aufrufer bekam das
        // Objekt des ERSTEN Vorgangs zurück, ohne dass ihm das jemand sagte.
        //
        // MEINE BEGRÜNDUNG AUS mega21 WAR „KEIN BEKANNTER AUFRUFER". Sie trägt nicht, und ben hat
        // recht damit: Unbenutztheit ist kein Schutz für einen weiterhin authentifiziert
        // erreichbaren API-Vertrag. Ein Weg, den niemand geht, wird nicht bewacht — das macht ihn
        // nicht sicher, sondern nur unbeobachtet.
        //
        // ZWEI ZULÄSSIGE WEGE, und warum es DIESER wird:
        //
        //   (i)  `draftPayload` VERPFLICHTEND machen — der Vertrag wird abgeschnitten.
        //   (ii) Einen stabilen Entwurfs-Versions- oder Inhaltsdigest im Request führen, der auch
        //        nach dem Löschen des Entwurfs im Wiederholversuch mitreist.
        //
        // ES WIRD (i). (ii) wäre die reichere Lösung, aber sie erfindet ein ZWEITES Inhaltsmass
        // neben dem Abdruck und muss es über den Tod des Entwurfs hinweg stabil halten — ein
        // Digest, den der Client führt, über einen Bestand, den der Server löscht. Das ist genau
        // die Konstruktion, aus der SB-D entstanden ist, nur eine Ebene höher. (i) beseitigt die
        // Frage: nach der mega21-Umstellung schickt der einzige Aufrufer den Stand ohnehin mit
        // (Capture.tsx), und die Ladung IST der stabile Inhaltsvertrag — sie reist mit dem Request
        // und überlebt das Löschen des Entwurfs, weil sie gar nicht aus ihm stammt.
        //
        // WARUM DIE PRÜFUNG HIER OBEN STEHT, über dem Idempotenz-Nachschlag: sie ist eine
        // UNVERÄNDERLICHE Formprüfung. Eine Wiederholung trägt denselben Body, fällt hier also
        // entweder beide Male oder keinmal — genau das Kriterium aus mega20 Block A.
        if (body.draftId && body.draftPayload === undefined) {
          return badRequest(
            "draftPayload fehlt — beim Fortsetzen eines Entwurfs muss der aktuelle Stand mitreisen. Ohne ihn kann der Server nicht unterscheiden, ob eine Wiederholung denselben Inhalt meint.",
          );
        }
        // ==============================================================================
        // AUFTRAG-mega20 Block A — DER NACHSCHLAG STEHT VOR ALLEM VERÄNDERLICHEN.
        // ==============================================================================
        //
        // WAS OBERHALB DIESER ZEILE STEHEN DARF, und warum — dieselbe Prüfung wie in mega19 Block A
        // beim Append: Authentisierung (das Recht `ko.create` ändert sich nicht dadurch, dass der
        // erste Aufruf durchlief) und die UNVERÄNDERLICHEN Formprüfungen (fehlende Dokumente,
        // fehlende Anker, fehlende Punkte, fehlende Labels — eine Wiederholung trägt denselben
        // Body, fällt dort also entweder beide Male oder keinmal).
        //
        // WAS UNTERHALB STEHEN MUSS — und hier ist die Liste LÄNGER als beim Append, weil die
        // Erstanlage mehr Veränderliches anfasst:
        //
        //   · DER ENTWURF. Der erste Aufruf LÖSCHT ihn nach dem Commit. Eine Wiederholung mit
        //     `draftId` fände ihn nicht mehr und bekäme 404 — für einen Vorgang, der GELUNGEN ist.
        //     Das ist die schärfste Kante dieses Blocks und der Grund, warum der Nachschlag nicht
        //     erst hinter der Entwurfs-Ladung stehen kann.
        //   · die Anhangzahl und die gespeicherte Objektgröße (Kapazität),
        //   · die Upload-Grenzen und die externe Stufe.
        //
        // WARUM DAS KEIN SCHLUPFLOCH IST: `lookupDocumentCreate` SCHREIBT NICHT. Für eine
        // UNBEKANNTE Kennung liefert es `null`, und der Ablauf läuft ungekürzt durch ALLE Tore —
        // es gibt keinen Weg, auf dem etwas NEUES entsteht, ohne Kapazität, Stufe und Belegpflicht
        // passiert zu haben. Und es liefert kein FREMDES Objekt: der Service prüft die Autorschaft
        // und antwortet auf eine erratene fremde Kennung mit Konflikt statt mit Inhalt.
        //
        // AUFTRAG-mega21 Block A: der Nachschlag fragt jetzt mit DEM VORGANG statt mit einer
        // Nutzerkennung — Eigentümer UND Inhaltsabdruck. Beide sind an DIESER Stelle bereits
        // bekannt, weil beide aus dem REQUEST kommen: der Eigentümer aus der Sitzung, der Abdruck
        // aus dem Body. Genau deshalb darf der Nachschlag weiterhin ganz vorne stehen — er braucht
        // weder den Entwurf noch die Kapazität noch die Stufe, um zu wissen, WER hier WAS wiederholt.
        const fingerprint = createOperationFingerprint(fromDocumentFingerprintInput(body));
        const replay = await ko.lookupDocumentCreate(body.operationId ?? "", {
          actor: user.id,
          fingerprint,
        });
        if (replay) {
          // 200 statt 201: derselbe Vorgang, aber das Objekt entsteht NICHT jetzt. Die Antwortform
          // ist unverändert das Wissensobjekt — ein Client, der 2xx als Erfolg liest, braucht
          // nichts zu lernen; wer genauer hinsieht, unterscheidet „neu angelegt" von „war schon da".
          // Keine Folgeschritte: sie liefen beim ersten Mal (unten). Sie hier zu wiederholen wäre
          // kein Fehler, aber auch keine Wahrheit.
          reply.code(200).send(replay);
          return;
        }
        // ---- DIE INHALTSEINGABE: ENTWURF ODER FRISCH ------------------------------------------
        let input: CreateKoInput;
        if (body.draftId) {
          if (!draftPromotion) {
            // Ehrlich statt halb: ohne verdrahteten Entwurfs-Zugang gibt es diesen Weg nicht.
            return badRequest("Entwurfs-Übernahme ist in dieser Konfiguration nicht verfügbar.");
          }
          // AUFTRAG-mega21 Block B: liegt der aktuelle Stand bei, wird er HIER geschrieben — im
          // selben Vorgang, hinter dem Idempotenz-Nachschlag. Der frühere separate PUT der
          // Oberfläche entfällt damit; er war es, der den Wiederholversuch mit 404 abfing, bevor
          // der Nachschlag überhaupt lief.
          // AUFTRAG-mega22 Block C: nur noch DIESER Zweig. Die Verzweigung auf `load` (Entwurf so
          // lesen, wie er im Bestand steht) ist entfallen — sie war der Weg, auf dem der Abdruck
          // den Entwurfsinhalt nicht sah. `draftPromotion.load` bleibt am Vertrag, weil der
          // Promote-Weg es benutzt (Block H); erreichbar ist es von HIER nicht mehr.
          // JOB 2684 D3 (R2-17): der gesehene Stand reist mit — dieselbe Lesart wie an den
          // Entwurfsrouten (nur ein nicht-leerer String zählt).
          const expectedUpdatedAt =
            typeof body.expectedUpdatedAt === "string" && body.expectedUpdatedAt.trim().length > 0
              ? body.expectedUpdatedAt.trim()
              : undefined;
          // JOB 2684 D4 (R2-17, BEN: „der Fall ohne Stand bleibt absichtlich gruen"): DER WEG OHNE
          // STAND IST ZU. Wer einen Entwurf aus dem Dokumentweg befoerdert, hat ihn geladen und
          // kennt seinen Stand — Capture.tsx setzt ihn beim „Fortsetzen" und sendet ihn seit D3.
          // Einen legitimen Aufrufer ohne Stand gibt es hier nicht: die drei Stellen, an denen das
          // Studio selbst Entwuerfe anlegt (Dateipunkte, Ganzdatei), halten den Entwurf nicht,
          // sondern leeren das Formular — ein `draftId` im Dokumentweg entsteht nur ueber das
          // Laden. Ein fehlender oder leerer Stand ist deshalb „weggelassen", nicht „neu": 400,
          // ohne Entwurfs- oder Wissensobjektwirkung. Ein Schutz, den ein Aufrufer weglassen
          // kann, ist keiner (Befund 3 des ersten Reviews, dieselbe Bauart).
          // Die Pruefung selbst sitzt im Adapter (build-app.ts, `applyAndLoad`) HINTER der
          // Sichtbarkeitsregel: ein fremder oder fehlender Entwurf bleibt 403/404, wie bisher —
          // erst ein sichtbarer Entwurf ohne Stand ist „weggelassen".
          const loaded = await draftPromotion.applyAndLoad(
            body.draftId,
            body.draftPayload,
            user,
            expectedUpdatedAt,
          );
          if (!loaded.ok) {
            if (loaded.reason === "stand-fehlt") {
              reply.code(400).send({
                error: "DRAFT_STAND_FEHLT",
                message:
                  "expectedUpdatedAt fehlt — beim Befoerdern eines gespeicherten Entwurfs muss der beim Laden gesehene Stand mitreisen. Ohne ihn kann der Server einen veralteten Stand nicht abweisen.",
              });
              return;
            }
            if (loaded.reason === "stale") {
              // Kein Wissensobjekt, kein Schreiben: der Entwurf wurde inzwischen an anderer Stelle
              // geändert. Antwortform wie `PUT /api/drafts/:id` und der Promote (capture-routes).
              reply.code(409).send({
                error: "DRAFT_STALE",
                message: loaded.message,
                currentUpdatedAt: loaded.currentUpdatedAt,
              });
              return;
            }
            if (loaded.reason === "invalid") {
              return badRequest(loaded.message ?? "Entwurfsinhalt ungueltig.");
            }
            reply.code(loaded.reason === "not-found" ? 404 : 403).send({
              error: loaded.reason === "not-found" ? "NOT_FOUND" : "FORBIDDEN",
              message:
                loaded.reason === "not-found"
                  ? "Entwurf nicht gefunden."
                  : "Entwurf nicht verfuegbar.",
            });
            return;
          }
          input = loaded.input;
        } else {
          // Dieselbe Verwerfung wie POST /api/kos: Herkunfts-/Vertrauensanker und der Kandidaten-
          // Anker kommen NIE vom Client. Was an Quellen entsteht, entsteht unten aus den geprüften
          // Dokumenten — nicht aus diesem Feld.
          const {
            sources: _ignoredSources,
            importCandidateId: _ignoredAnchor,
            ...rest
          } = body.create ?? ({} as Omit<CreateKoInput, "author">);
          input = { ...rest, author: user.id } as CreateKoInput;
        }
        // ==========================================================================================
        // JOB 3569 (Q3 c) — AUCH DURCH DIE ZWEITE TÜR ENTSTEHT KEIN UNEINGESTUFTES WISSENSOBJEKT.
        // ==========================================================================================
        //
        // DER BEFUND. JOB 3429 hat die Stufenpflicht an `POST /api/kos` gesetzt (oben, derselbe
        // Fehlercode, derselbe Satz) und in seiner Testdatei drei Anlagewege gezählt
        // (`tests/q3c-stufenpflicht/stufenpflicht-am-schreibweg.test.ts:7-10`). Die Zählung war
        // unvollständig: DIESE Route trägt dieselbe Berechtigung (`ko.create`, oben) und hat
        // denselben Effekt (ein neues Wissensobjekt, unten `ko.createWithDocuments`) — zwischen
        // beiden Zeilen stand keine Prüfung der Stufe. Der FRISCHE Zweig baut seine Eingabe direkt
        // aus dem Client-Rumpf (`body.create`, nur `sources`/`importCandidateId` werden verworfen);
        // ein Rumpf ohne `confidentiality` legte an. Eine Pflicht, die nur der Client kennt, ist
        // keine.
        //
        // WARUM HIER UND NICHT WEITER OBEN. Erst an dieser Zeile ist `input` für BEIDE Zweige
        // zusammengestellt — der Entwurfs-Zweig kennt seine Eingabe erst nach `applyAndLoad`
        // (oben). Eine Prüfung am ROHEN Rumpf gäbe es nur für den frischen Weg und läge ausserdem
        // über dem Wiederholungs-Nachschlag: die Wiederholung eines GELUNGENEN Entwurfsvorgangs
        // trägt die Stufe nicht im Rumpf (sie stand im Entwurf, der inzwischen verbraucht ist) und
        // bekäme dann 400 für etwas, das längst geglückt ist.
        //
        // WARUM NICHT IM DIENST. Unverändert der Grund von oben (`ko.create` ist auch der Weg von
        // Import, Seed und Altbestand): ein bewusst UNEINGESTUFTES Objekt muss herstellbar bleiben,
        // sonst gäbe es keine Fixtures mehr für „nie eingestuft"
        // (`confidentialityProvenance: "unknown"`). Verschärft wird der ÖFFENTLICHE Schreibweg.
        //
        // WIE DER ENTWURFS-ZWEIG HEUTE DASTEHT (gemessen, nicht angenommen, JOB 3569 Lieferung 1):
        // er ist bereits zu, aber an anderer Stelle und unter anderem Namen. `applyAndLoad` ruft
        // `capture.toKoInput` (build-app.ts), und das wirft seit JOB 3082 `CaptureError`
        // `INCOMPLETE`, sobald `confidentiality` fehlt oder ungültig ist
        // (`services/capture/src/service.ts`, `KO_PFLICHTFELDER`) — über `sendError` wird daraus
        // 400 `INCOMPLETE`. Der Wächter hier feuert für diesen Zweig also nie; das ist kein
        // Grund, ihn auf den frischen Zweig zu verengen. Die Grenze steht an EINER Stelle für
        // beide, und wenn der Entwurfs-Zugang eines Tages eine Eingabe ohne Stufe durchreicht,
        // fängt sie diese auf, statt sie durchzulassen.
        //
        // NUR DAS FEHLEN steht hier. Ein VORHANDENER, aber ungültiger Wert (auch `null`) wird vom
        // Dienst abgewiesen (`INVALID_CONFIDENTIALITY`) — zwei Prüfungen für denselben Wert wären
        // zwei Auslegungen. Kein Vorgabewert, kein stilles „intern".
        if (input.confidentiality === undefined) {
          sendMissingConfidentiality(reply);
          return;
        }
        // ---- KAPAZITÄT: derselbe Anhangs-Vertrag wie `attach` und `append-document` -------------
        const limits = (await uploadLimits.get()) ?? DEFAULT_UPLOAD_LIMITS;
        if (entries.length > limits.maxAttachments) {
          return badRequest(`Maximal ${limits.maxAttachments} Anhänge je Objekt.`);
        }
        const storedSizes: number[] = [];
        for (const entry of entries) {
          const anchor = entry.anchor as { objectId: string };
          // AUFTRAG-mega22 Block B: die frühere Größenprüfung der Client-Vorschau ist ersatzlos
          // entfallen — es gibt keine Client-Vorschau mehr, die groß sein könnte.
          // `objects.metadata` ist der Beleg, dass es das Objekt WIRKLICH gibt — nicht bloß eine
          // Client-Behauptung. Maßgeblich ist die GESPEICHERTE Größe.
          const stored = await objects.metadata(anchor.objectId);
          if (!stored) {
            return badRequest("Unbekannte objectId.");
          }
          if (stored.size > limits.maxAttachmentBytes) {
            return badRequest("Anhang zu groß (Upload-Grenze überschritten).");
          }
          storedSizes.push(stored.size);
        }
        // ---- (I) DIE STUFENREGEL, je Belegstelle ------------------------------------------------
        // Der Anker gilt als BELEGT, weil DIESELBE Operation das nachgeschlagene Dokument als
        // Anhang DIESES Objekts bindet — der Server behauptet nichts, was er nicht unmittelbar
        // danach selbst herstellt. Identisch zur Verbund-Operation.
        const stage = (await externalPolicy.getStage()) ?? DEFAULT_EXTERNAL_KNOWLEDGE_STAGE;
        for (const entry of entries) {
          for (const point of entry.points ?? []) {
            const reach = classifySourceReach(point.url, internalSourceOrigins);
            const decision = decideExternalAttach({
              stage,
              reach,
              anchoredToOwnAttachment: true,
            });
            if (!decision.allowed) {
              reply.code(403).send({
                error: "EXTERNAL_ATTACH_BLOCKED",
                message:
                  "Auf der eingestellten Stufe darf keine Quelle mit öffentlicher Web-Adresse an ein Wissensobjekt angehängt werden — Suchen bleibt erlaubt, Anhängen nicht. Ein Administrator kann die Stufe unter Verwaltung → Externes Wissen ändern.",
                stage,
                reason: decision.denial,
              });
              return;
            }
          }
        }
        // ---- DIE KOMPOSITION: ALLES GEMEINSAM, ODER NICHTS -------------------------------------
        const created = await ko.createWithDocuments(
          input,
          // ==========================================================================================
          // THUMBNAIL — AUFTRAG-mega22 Block B: ES WIRD NICHT MEHR GESCHRIEBEN.
          // ==========================================================================================
          //
          // DER BEFUND. `anchor.thumbnail` blieb in mega21 bewusst aus dem Abdruck („abgeleitete
          // Anzeigedaten, den Nutzer dafür büßen zu lassen wäre falsch") — wurde aber unmittelbar
          // danach als Bestandteil des KO-Anhangs PERSISTIERT. Damit trugen zwei parallele Anfragen
          // mit demselben Schlüssel, demselben Original und VERSCHIEDENEM Thumbnail denselben
          // Abdruck und erzeugten je nach Gewinner verschiedenen gespeicherten Anzeigeinhalt. Meine
          // mega21-Begründung galt nur unter der Annahme, das Thumbnail sei flüchtig. Es war es nicht.
          //
          // ZWEI ZULÄSSIGE WEGE, und warum es DIESER wird:
          //
          //   (i)  Serverseitig ABLEITEN ODER IGNORIEREN — die Klasse „vom Client gelieferte
          //        Anzeigedaten am Objekt" verschwindet ganz.
          //   (ii) Den DIGEST des Thumbnails in den Abdruck aufnehmen — billiger, aber es bleibt
          //        Client-Anzeigedatum am Objekt, und es KAUFT sich einen neuen Fehler ein: ein
          //        Client, der die Vorschau beim Wiederholversuch neu erzeugt (andere Skalierung,
          //        anderer Encoder-Lauf), bekäme einen Konflikt für etwas, das er nicht geändert
          //        hat. Genau diese Falsch-Positiv-Richtung war der ursprüngliche Grund, das Feld
          //        aus dem Abdruck zu lassen; (ii) macht sie zur Regel statt sie aufzulösen.
          //
          // ES WIRD (i), IN DER FORM „IGNORIEREN". Und der Preis dafür ist NULL, was hier
          // nachgeprüft und nicht angenommen ist: der offizielle Aufrufer schickt auf DIESEM Weg
          // gar kein Thumbnail (apps/web/src/pages/Capture.tsx — `anchor: { objectId, name, mime }`).
          // Das Feld war eine offene Tür, durch die nie jemand ging, hinter der aber ein
          // gewinnerabhängiger Schreibvorgang lag.
          //
          // WAS DAS FÜR DIE ANZEIGE HEISST, ehrlich: der Anhang trägt seine `objectId`, und das
          // Original steht unverändert im Objektspeicher. Eine Vorschau ist daraus jederzeit
          // ABLEITBAR; sie ist nur nicht mehr etwas, das der Client dem Server über den
          // Erstanlage-Weg mitgibt. Der `attach`-Weg (KnowledgeDetail) ist davon NICHT berührt —
          // dort ist das Thumbnail Teil einer eigenen, nicht idempotenzgebundenen Operation.
          entries.map((entry, index) => {
            const anchor = entry.anchor as {
              objectId: string;
              name: string;
              mime: string;
            };
            return {
              anchor: {
                objectId: anchor.objectId,
                name: anchor.name,
                mime: anchor.mime,
                size: storedSizes[index] as number,
              },
              sources: (entry.points ?? []).map((p) => ({
                label: p.label as string,
                url: p.url ?? null,
                excerpt: p.excerpt ?? null,
                // Serverseitig abgeleitet — nie übernommen (mega15 Block B).
                provider: attributeExternalSource(p.url),
              })),
            };
          }),
          // AUFTRAG-mega21 Block A: DERSELBE Vorgang wie im Nachschlag oben — dieselbe Kennung,
          // derselbe Eigentümer, DERSELBE Abdruck. Er wird bewusst nicht neu berechnet: zwei
          // Berechnungen wären zwei Gelegenheiten, sie auseinanderlaufen zu lassen.
          { id: body.operationId ?? "", actor: user.id, fingerprint },
        );
        // ==================================================================================
        // AB HIER STEHT DAS WISSENSOBJEKT — MIT ALLEN ANKERN UND ALLEN BELEGSTELLEN.
        // DER VORGANG IST GELUNGEN. NICHTS UNTERHALB DIESER ZEILE KANN IHN NOCH SCHEITERN LASSEN.
        // ==================================================================================
        //
        // AUFTRAG-mega20 Block A — DIE ERFOLGSDEFINITION, ausgeschrieben.
        //
        // Bis mega19 lagen Entwurfs-Rücknahme, Prüfer-Zuweisung, Benachrichtigung und der
        // KI-Prüf-Vermerk zwischen dem Commit und der 201 — jeder von ihnen konnte werfen, und die
        // Route antwortete dann mit FEHLER für ein Wissensobjekt, das vollständig und vollständig
        // belegt im Bestand stand. Der Client las den Fehler als „nicht gespeichert". Das ist
        // dieselbe Fehlerklasse, die mega18 beim Append zu Datenverlust geführt hat: eine gelungene
        // Schreiboperation, die sich als gescheiterte meldet.
        //
        // DIE ENTSCHEIDUNG: diese vier Schritte sind KEIN Teil der Erfolgsdefinition. Ein
        // Wissensobjekt, das existiert und dessen Herkunft vollständig belegt ist, dem aber die
        // Benachrichtigung fehlt, ist ein gelungener Vorgang mit einer offenen Nacharbeit — kein
        // gescheiterter. Was sie gemeinsam haben und was die Entscheidung trägt:
        //
        //   · keiner von ihnen berührt den BELEGVERTRAG. Anker, Belegstellen, Evidence, Snapshot
        //     und der ko.created-Beleg sind vor dieser Zeile fertig und atomar (createWithDocuments);
        //   · jeder von ihnen ist NACHHOLBAR: der Entwurf ist sichtbar und löschbar, Prüfer sind
        //     nachträglich zuweisbar, der KI-Prüf-Job hat einen eigenen Retry-Endpunkt
        //     (POST /api/kos/:id/ai-check);
        //   · und keiner von ihnen ist RÜCKNEHMBAR, wenn man den Vorgang scheitern ließe — das
        //     Wissensobjekt bliebe ja trotzdem stehen. „Fehler melden" hätte also nie bedeutet
        //     „nichts ist passiert", sondern nur „du erfährst nicht, was passiert ist".
        //
        // WAS STATTDESSEN PASSIERT: jeder Fehlschlag wird EINZELN aufgefangen, als Audit-Beleg
        // festgehalten (`ko.create-followup-failed`) und dem Aufrufer in `followUpsFailed`
        // ehrlich mitgeteilt. Verschluckt wird nichts — nur nicht mehr fälschlich als Scheitern
        // des Ganzen ausgegeben.
        const followUpsFailed: string[] = [];
        const followUp = async (step: string, run: () => Promise<void>): Promise<void> => {
          try {
            await run();
          } catch (err) {
            followUpsFailed.push(step);
            await audit
              ?.record({
                actor: user.id,
                action: "ko.create-followup-failed",
                target: created.id,
                // PII-frei: Fehlerklasse statt Meldung (SCRUM-496, log-sanitize).
                payload: { step, reason: err instanceof Error ? err.name : "unknown" },
              })
              .catch(() => undefined);
          }
        };
        // Der Entwurf wird ERST JETZT entfernt. Schlägt das fehl, bleibt ein Entwurf stehen, den
        // sein Autor sieht und löschen kann — unschön, aber kein Verlust und vor allem kein
        // Wissensobjekt ohne Herkunft. Die umgekehrte Reihenfolge hätte den Entwurf vernichten
        // können, während die Anlage scheitert.
        const draftId = body.draftId;
        if (draftId && draftPromotion) {
          await followUp("draft-discard", () => draftPromotion.discard(draftId));
        }
        const reviewers = [...new Set(body.reviewerIds ?? [])].filter((id) => id !== user.id);
        if (reviewers.length > 0) {
          // Zuweisung und Benachrichtigung sind GETRENNTE Nacharbeiten: gelingt die Zuweisung und
          // nur die Nachricht bleibt aus, wäre „validation-assign offen" eine Unwahrheit.
          await followUp("validation-assign", () =>
            validation.assign(created.id, reviewers, user.id),
          );
          await followUp("notify-assignment", async () => {
            await notifyAssignment?.(created.id, reviewers);
          });
        }
        // WP-SUBMIT-ASYNC: derselbe Prüf-Job-Vermerk wie auf den beiden anderen Einreich-Wegen.
        let submitted = created;
        if (aiCheckWorker) {
          await followUp("ai-check", async () => {
            await ko.markAiCheckPending(created.id);
            submitted = (await ko.get(created.id)) ?? created;
            aiCheckWorker.enqueue(created.id, submitted.aiCheck?.koVersion);
          });
        }
        // ==============================================================================
        // AUFTRAG-mega21 Block C-1 — DIE WARNUNG DARF KEINE SACKGASSE SEIN.
        // ==============================================================================
        //
        // Ab hier ist bekannt, WAS nicht gelaufen ist. Bis mega20 endete das Wissen hier: es reiste
        // in der Antwort mit, die Oberfläche wertete es nicht aus, und im Bestand blieb keine Spur.
        // Zwei Dinge fehlten, und beide werden jetzt hergestellt, BEVOR die 201 rausgeht:
        //
        //   (1) EIN DAUERHAFT AUFFINDBARER ZUSTAND je Objekt (`createFollowUpsFailed`). Ohne ihn
        //       ist eine fehlgeschlagene Prüferzuweisung nach dem Schließen des Tabs nirgends mehr
        //       nachlesbar — das Wissensobjekt existiert, gilt als erfolgreich und wartet auf
        //       niemanden.
        //
        //   (2) EIN WIEDERHOLBARER PRÜF-JOB. Scheitert `markAiCheckPending`, gibt es GAR KEINEN
        //       Vermerk — und der vorhandene Wiederhol-Endpunkt lehnt genau dann ab, weil er
        //       `failed` oder `pending` verlangt. Der `failed`-Vermerk mit ehrlichem Grund ist der
        //       Zustand, den dieser Mechanismus ohnehin kennt; damit wirkt der Knopf, den die
        //       Warnung anbietet.
        //
        // BEIDE SIND BEST EFFORT und stehen NACH der Erfolgsdefinition: sie sind Vermerke über
        // Nacharbeiten, kein Wissensinhalt. Ein Fehlschlag hier darf die 201 nicht kippen — sonst
        // wäre die Buchführung über gescheiterte Nacharbeiten selbst die nächste Fehlerquelle.
        //
        // ==============================================================================
        // AUFTRAG-mega23 Block B — WAS TATSÄCHLICH GESCHRIEBEN WURDE, REIST MIT.
        // ==============================================================================
        //
        // bens SB-G, unverändert offen seit sammel21: beide Schreibvorgänge verschluckten JEDEN
        // Fehler, und die 201 meldete nur den ursprünglich gescheiterten SCHRITT — nicht, ob die
        // BUCHFÜHRUNG darüber gelang. Die Oberfläche behauptete daraufhin in allen drei Sprachen,
        // die Prüfung SEI als fehlgeschlagen vermerkt und lasse sich neu anstoßen. Fiel der
        // Best-Effort-Write aus, war der Wiederhol-Endpunkt nicht nutzbar (er verlangt `failed`
        // oder `pending`) — und der Nutzer hatte eine Zusage bekommen, die niemand gedeckt hat.
        //
        // BEIDES BLEIBT BEST EFFORT UND BEIDES BLEIBT NACH DER ERFOLGSDEFINITION: die 201 kippt
        // NICHT, weil die Buchführung über Nacharbeiten scheiterte. Geändert wird nur, dass der
        // Client die Tatsache ERFÄHRT, statt sie raten zu müssen. Das kostet ein Feld.
        let aiCheckFailedVermerkt = false;
        let nacharbeitenVermerkt = false;
        if (followUpsFailed.length > 0) {
          if (followUpsFailed.includes("ai-check")) {
            aiCheckFailedVermerkt = await ko
              .markAiCheckFailed(created.id, "submit-followup-failed")
              .then(async (geschrieben) => {
                if (geschrieben) {
                  submitted = (await ko.get(created.id)) ?? submitted;
                }
                return geschrieben;
              })
              .catch(() => false);
          }
          nacharbeitenVermerkt = await ko
            .recordCreateFollowUpFailures(created.id, followUpsFailed)
            .catch(() => false);
        }
        reply.code(201).send(
          followUpsFailed.length > 0
            ? {
                ...submitted,
                followUpsFailed,
                // Zwei getrennte Tatsachen, keine Zusammenfassung: der `failed`-Vermerk ist die
                // Voraussetzung des Wiederholwegs, der Nacharbeits-Vermerk die Voraussetzung
                // dafür, dass der Fehlschlag nach dem Schließen des Tabs überhaupt noch
                // auffindbar ist. Ein gemeinsames „ok" verwischte, welche der beiden fehlt.
                followUpsRecorded: {
                  aiCheckFailed: aiCheckFailedVermerkt,
                  failures: nacharbeitenVermerkt,
                },
              }
            : submitted,
        );
        await indexKoForDuplicatePrefilter(created, semanticPrefilter);
      } catch (error) {
        sendError(reply, error);
      }
    });

    // WP-SUBMIT-ASYNC (Teil 3, Retry): reiht einen FEHLGESCHLAGENEN (oder festhängenden pending-)
    // Prüf-Job neu ein. Recht ko.validate — der Knopf lebt auf den Validierungs-Karten der Prüfer.
    // done/ohne Feld ist nicht wiederholbar (ehrlicher 409 statt stillem Doppel-Lauf).
    app.post<{ Params: { id: string } }>("/api/kos/:id/ai-check", async (request, reply) => {
      const user = await guards.requirePermission("ko.validate", request, reply);
      if (!user) {
        return;
      }
      try {
        const subject = await ko.get(request.params.id);
        if (!subject) {
          reply.code(404).send({ error: "NOT_FOUND", message: "Wissensobjekt nicht gefunden." });
          return;
        }
        if (!aiCheckWorker) {
          reply.code(503).send({
            error: "AI_CHECK_UNAVAILABLE",
            message: "Die Hintergrund-Pruefung ist auf diesem Server nicht verdrahtet.",
          });
          return;
        }
        const status = subject.aiCheck?.status;
        if (status !== "failed" && status !== "pending") {
          reply.code(409).send({
            error: "AI_CHECK_NOT_RETRYABLE",
            message: "Fuer dieses Wissensobjekt steht kein wiederholbarer Pruef-Job an.",
          });
          return;
        }
        await ko.markAiCheckPending(request.params.id);
        // WP-SHIP8-CLOSE-2 (bens F3): Vermerk NACH dem Setzen frisch lesen — der Job trägt die
        // Zielversion synchron (subject von oben wäre der VERALTETE Vermerk vor dem Retry).
        const marked = await ko.get(request.params.id);
        aiCheckWorker.enqueue(request.params.id, marked?.aiCheck?.koVersion);
        reply.code(200).send({ status: "pending" });
      } catch (error) {
        sendError(reply, error);
      }
    });

    // SCRUM-421: Upload-Grenzen — lesen dürfen alle Leseberechtigten (Anzeige beim Erfassen),
    // ändern nur die Nutzerverwaltung (Admin). Änderung landet im Audit-Log.
    app.get("/api/upload-limits", async (request, reply) => {
      const user = await guards.requirePermission("ko.read", request, reply);
      if (!user) {
        return;
      }
      try {
        reply.code(200).send((await uploadLimits.get()) ?? DEFAULT_UPLOAD_LIMITS);
      } catch (error) {
        sendError(reply, error);
      }
    });

    app.put<{ Body: { maxAttachments?: number; maxAttachmentBytes?: number } }>(
      "/api/upload-limits",
      async (request, reply) => {
        const user = await guards.requirePermission("users.manage", request, reply);
        if (!user) {
          return;
        }
        try {
          const limits = normalizeUploadLimits(request.body);
          await uploadLimits.set(limits);
          await audit?.record({
            actor: user.id,
            action: "upload.limits.set",
            target: "settings",
            // Inline-Literal (Record<string, unknown>) — ein benannter Typ ohne Index-Signatur
            // ist nicht direkt zuweisbar (TS2322).
            payload: {
              maxAttachments: limits.maxAttachments,
              maxAttachmentBytes: limits.maxAttachmentBytes,
            },
          });
          reply.code(200).send(limits);
        } catch (error) {
          sendError(reply, error);
        }
      },
    );

    // SCRUM-422: Papierkorb — nur Admin (users.manage). Liste ist rein metadatenbasiert;
    // Wiederherstellen und sofortige Endlöschung sind bewusste Admin-Entscheidungen.
    app.get("/api/kos/trash", async (request, reply) => {
      const user = await guards.requirePermission("users.manage", request, reply);
      if (!user) {
        return;
      }
      try {
        reply.code(200).send(await ko.trashed());
      } catch (error) {
        sendError(reply, error);
      }
    });

    app.post<{ Params: { id: string } }>("/api/kos/:id/restore", async (request, reply) => {
      const user = await guards.requirePermission("users.manage", request, reply);
      if (!user) {
        return;
      }
      try {
        reply.code(200).send(await ko.restore(request.params.id, user.id));
      } catch (error) {
        sendError(reply, error);
      }
    });

    app.delete<{ Params: { id: string } }>("/api/kos/trash/:id", async (request, reply) => {
      const user = await guards.requirePermission("users.manage", request, reply);
      if (!user) {
        return;
      }
      try {
        // SCRUM-523 P.3 (WP2): die HARTE Endlöschung läuft über den zentralen purgeKo-Vertrag im
        // KoService — er schließt offene Konflikte/Überschneidungen geordnet (kein Geist) und entfernt
        // den Embedding-Vektor (GDPR Art. 17, Kaskadenlöschung) über den verdrahteten Aufräum-Hook.
        // Kein separater Cleanup-Aufruf mehr hier: exakt EINE Löschmechanik, kein Bypass.
        await ko.purgeTrashed(request.params.id, user.id);
        reply.code(204).send();
      } catch (error) {
        sendError(reply, error);
      }
    });

    // FR-RBAC-02 + Pedi 02.07.: Löschen dürfen Controller/Admin (ko.validate) ODER der
    // AUTOR seines eigenen Wissensobjekts. Ehrlich: Löschung landet im Audit (ko.deleted).
    // SCRUM-422: Löschen heißt jetzt Papierkorb (Demo-Daten weiterhin endgültig).
    app.delete<{ Params: { id: string } }>("/api/kos/:id", async (request, reply) => {
      const user = await guards.requirePermission("ko.read", request, reply);
      if (!user) {
        return;
      }
      // mega80 A: auch das Löschen ist eine kennungsbasierte Aktion an einem Zielobjekt und geht
      // durch DASSELBE Tor. Es gab hier zwar nie Inhalt heraus, unterschied aber 404 („gibt es
      // nicht") von 403 („gibt es, du darfst nicht") — und damit war schon die Existenz eines
      // fremden vertraulichen Objekts über diesen Weg erfragbar.
      const target = await sichtbaresKoOder404(user, request.params.id, reply);
      if (!target) {
        return;
      }
      const mayDelete = can(user.role, "ko.validate") || target.author === user.id;
      if (!mayDelete) {
        reply.code(403).send({
          error: "FORBIDDEN",
          message: "Löschen dürfen nur Autor, Controller oder Admin.",
        });
        return;
      }
      // ==========================================================================================
      // JOB 3066 (bens Korrekturpflicht 1 zu R3) — DER NACHLAUF LÄUFT NUR NACH EINEM WEICHEN LÖSCHEN.
      // ==========================================================================================
      //
      // `ko.delete` hat ZWEI Ausgänge (knowledge-object/src/service.ts:3919-3927): für ein
      // Demo-Seed-Objekt kippt es intern in die harte Endlöschung `purgeKo`, sonst wandert das
      // Objekt in den Papierkorb. Die Endlöschung räumt selbst auf, und zwar im
      // transaktionsgebundenen Haken der Kompositionswurzel (build-app.ts, setPurgeTxCleanup).
      // Lief der Nachlauf hier trotzdem, rief JEDER Aufräumdienst zweimal — der zweite Ruf fand
      // zwar nichts Offenes mehr, aber „wirkungslos" ist keine Ablösung: es gab zwei Wege, auf
      // denen eine Löschung Befunde schliesst, und nur einer von ihnen war an die Transaktion
      // gebunden. Jetzt gibt es genau einen je Ausgang.
      //
      // WORAN DER AUSGANG ERKANNT WIRD: an `demoSeed` des bereits geladenen Zielobjekts — es ist
      // der einzige Hart-Auslöser, den dieser Aufruf treffen kann (die Route übergibt weder
      // `hard` noch `forceTrash`), und es ist unveränderlich („nur der Seed setzt das; nie über
      // die öffentliche Route", service.ts:276). Kein zusätzlicher Lesegang, kein Ratespiel.
      //
      // DASS DIESE BEDINGUNG DIESELBE IST wie die im KoService, ist kein Vertrauen, sondern eine
      // Wache: `tests/aufraeumen-atomar/nachlauf-nur-nach-weichem-loeschen.test.ts` liest den
      // Chokepoint und wird rot, sobald sich dort der Hart-Auslöser ändert.
      const endgeloescht = target.demoSeed === true;
      try {
        await ko.delete(request.params.id, user.id);
        if (!endgeloescht) {
          // Konzept 04.07. (Stufe 1): offene Konflikte dieses KO geordnet beenden (kein Geist).
          await conflicts.onKoRemoved(request.params.id, user.id);
          // Pedi 04.07.: dasselbe für offene Überschneidungen (kein Duplikat-Geist nach Löschen).
          await overlaps.onKoRemoved(request.params.id, user.id);
        }
        reply.code(204).send();
      } catch (error) {
        sendError(reply, error);
      }
    });

    // PUT /api/kos/:id — ein Mutations-Endpunkt, per {action} verzweigt (§2.3).
    //
    // JOB 4115: eigene Annahmegrenze (KOS_BODY_LIMIT, Begründung am Kopf dieser Datei) UND der
    // Auth-Riegel VOR dem Parsen. Beides gehört zusammen: die Grenze allein wäre eine 5-MiB-
    // Parserfläche, die jeder Anonyme füllen darf.
    //
    // WARUM DIESE ZEILE NICHT UMGEBROCHEN WIRD, obwohl sie über 100 Zeichen lang ist: ein fremder
    // Wächter verankert an ihrem Wortlaut. `tests/security/mega80-kennung-ist-kein-leserecht.test.ts:229`
    // sucht die Registrierung dieses Endpunkts als EINE Zeichenkette — Methodenaufruf, Typparameter
    // und Pfadliteral in einem Stück — und erhebt daraus die Aktionen des Switch. Biomes Umbruch
    // (Pfad und Optionen je in eine eigene Zeile) zerreisst sie; der Wächter fällt dann mit „Der
    // Mutations-Endpunkt wurde im Quelltext nicht gefunden" aus. Gemessen, nicht vermutet.
    //
    // UND DESHALB STEHT SIE HIER AUCH NICHT NOCH EINMAL ABGESCHRIEBEN: zwei Quelltext-Erhebungen
    // dieses Hauses lesen Routen aus dem Dateitext (der Wächter oben und
    // `tests/security/routeGuardAudit.ts`). Eine Kopie der Registrierungszeile in einem Kommentar
    // ist für sie eine ZWEITE Route — eine ohne Rechteprüfung. Auch das ist gemessen: der
    // RBAC-Audit meldete prompt „PUT /api/kos/:id" als öffentlich.
    // biome-ignore format: der Wächter mega80 verankert am Wortlaut dieser Registrierungszeile (s. o.)
    app.put<{ Params: { id: string }; Body: PutBody }>("/api/kos/:id", { bodyLimit: KOS_BODY_LIMIT, onRequest: requireAuthedBeforeParse }, async (request, reply) => {
      const { id } = request.params;
      const body = request.body;
      const badRequest = (message: string): void => {
        reply.code(400).send({ error: "BAD_REQUEST", message });
      };
      // ==========================================================================================
      // JOB 3667 R2 — DIE VIER FEHLER DES RÜCKWEGS BEKOMMEN IHREN EIGENEN STATUS.
      // ==========================================================================================
      // `sendError` mappt unbekannte Domänencodes auf 400 (http.ts, STATUS_BY_CODE — nicht
      // Zielpfad dieses Auftrags). Ein „409 Konflikt" als 400 zu senden hiesse dem Aufrufer sagen,
      // er habe etwas falsch gemacht; er hat aber nur einen Stand in der Hand, der sich bewegt hat.
      // Deshalb entscheidet DIESE Stelle, und zwar für alle drei Schreibwege gleich.
      const rueckwegFehler = async (error: unknown): Promise<boolean> => {
        const code =
          error && typeof error === "object" && "code" in error
            ? String((error as { code: unknown }).code)
            : "";
        const message = error instanceof Error ? error.message : code;
        if (code === "KO_STALE") {
          // Die JETZT gespeicherte Version reist mit — ohne sie kann die Oberfläche den Menschen
          // nicht entscheiden lassen, sondern nur „hat nicht geklappt" sagen.
          const stand = await ko.get(id);
          reply.code(409).send({
            error: "KO_STALE",
            message,
            ...(stand ? { currentVersion: stand.version } : {}),
          });
          return true;
        }
        if (code === "PROPOSAL_OWN") {
          reply.code(403).send({ error: code, message });
          return true;
        }
        if (code === "PROPOSAL_DECIDED") {
          reply.code(409).send({ error: code, message });
          return true;
        }
        if (code === "PROPOSAL_NOT_FOUND") {
          reply.code(404).send({ error: code, message });
          return true;
        }
        return false;
      };
      // ==========================================================================================
      // JOB 4251 — DIE BEDINGUNG DER EINORDNUNG: EINMAL GELESEN, AN BEIDEN AKTIONEN DIESELBE.
      // ==========================================================================================
      //
      // `tags` und `category` sind zwei Türen in denselben Schreibpfad (`mutateKoMetadata`). Zwei
      // Abschriften dieser Lesart wären zwei Auslegungen desselben Vertrags — und die zweite wäre
      // irgendwann die andere. Gelesen wird mit `erwarteteKoVersion`, derselben Funktion wie am
      // Inhaltsweg: dieselben drei Ausgänge (fehlt → unbedingt, Ganzzahl ≥ 1 → Bedingung, alles
      // Übrige → 400), damit ein Unsinnswert auch hier keinen Schutz stillschweigend abschaltet.
      //
      // `stand` IST DIE QUITTUNG DES SCHREIBVORGANGS, nicht ein zweiter Nachschlag: der Dienst
      // meldet aus DEMSELBEN Lock, in dem er geschrieben hat, welcher Stempel danach gilt. Ein
      // Nachlesen hinter dem Lock könnte einen FREMDEN Schreibvorgang mit einsammeln — und der
      // Aufrufer hielte ihn dann für seinen eigenen.
      const einordnungsBedingung = ():
        | {
            stand: { wert: number | null };
            opts: {
              expectedMetadataRevision?: number;
              expectedVersion?: number;
              meldeMetadatenstand: (revision: number) => void;
            };
          }
        | "unlesbar" => {
        const stempel = erwarteteKoVersion(body.expectedMetadataRevision);
        if (stempel === "unlesbar") {
          badRequest(
            "expectedMetadataRevision muss eine Ganzzahl ab 1 sein (der Stand der Einordnung, der beim Laden zu sehen war).",
          );
          return "unlesbar";
        }
        const fassung = erwarteteKoVersion(body.expectedVersion);
        if (fassung === "unlesbar") {
          badRequest(
            "expectedVersion muss eine Ganzzahl ab 1 sein (die Version, die beim Laden zu sehen war).",
          );
          return "unlesbar";
        }
        const stand: { wert: number | null } = { wert: null };
        return {
          stand,
          opts: {
            ...(stempel === undefined ? {} : { expectedMetadataRevision: stempel }),
            ...(fassung === undefined ? {} : { expectedVersion: fassung }),
            meldeMetadatenstand: (revision: number): void => {
              stand.wert = revision;
            },
          },
        };
      };
      /**
       * Der Stempel, der NACH diesem Schreibvorgang gilt — additiv an der Antwort, damit der
       * nächste Schritt derselben Kette (erst `tags`, dann `category`) gegen den Stand schreibt, den
       * der EIGENE Aufruf soeben erzeugt hat. Ohne ihn liefe der zweite Schritt zuverlässig in einen
       * Konflikt mit dem ersten — gegen sich selbst.
       *
       * FEHLT ER, FEHLT ER: hat der Dienst nichts gemeldet, steht kein Feld da. Eine geratene Zahl
       * wäre die schlechteste Auskunft von allen (Wissenslücke statt Erfindung).
       */
      const mitEinordnungsstand = <T extends object>(
        ergebnis: T,
        bedingung: { stand: { wert: number | null } },
      ): T | (T & { metadataRevision: number }) =>
        bedingung.stand.wert === null
          ? ergebnis
          : { ...ergebnis, metadataRevision: bedingung.stand.wert };
      /**
       * JOB 4146 — die gemeinsame Hälfte von „geklärt" und „wieder offen": die Beitragskennung
       * prüfen und den Dienst rufen. Das Rechtegate steht bewusst NICHT hier, sondern sichtbar in
       * jedem der beiden `case`-Zweige (s. dort).
       */
      const klaerungsstand = async (
        actor: string,
        state: "erledigt" | "offen",
      ): Promise<void> => {
        if (typeof body.commentId !== "string" || body.commentId.trim().length === 0) {
          return badRequest("commentId fehlt.");
        }
        reply
          .code(200)
          .send(await ko.setCommentResolution(id, body.commentId.trim(), actor, state));
      };
      // ==========================================================================================
      // JOB 4146 — DIE ABGELEHNTE PARALLELSCHREIBUNG IST EIN KONFLIKT, KEIN EINGABEFEHLER.
      // ==========================================================================================
      //
      // `STALE_WRITE` heisst: ein anderer Mensch hat im selben Augenblick geschrieben, und der
      // bedingte UPDATE hat den überholten Stand abgelehnt (`repo-pg.ts:412-437`). Der Dienst fängt
      // das für einen Beitrag selbst auf (er liest frisch und hängt einmal erneut an); kommt die
      // Ablehnung trotzdem hier an, hat der Aufrufer NICHTS falsch gemacht — ein 400 („du hast
      // etwas falsch gemacht") wäre die unwahre Auskunft, ein 409 ist die wahre.
      //
      // ENG AUF DIE DREI DISKUSSIONSAKTIONEN BEGRENZT, und das ist Absicht: dieselbe Ablehnung an
      // den übrigen Aktionen dieses Endpunkts über denselben Kamm zu scheren wäre eine
      // Verhaltensänderung an Wegen, die dieser Auftrag nicht misst. `http.ts` (STATUS_BY_CODE)
      // bleibt unberührt (Auftrag §10).
      const diskussionsFehler = (error: unknown): boolean => {
        if (
          body.action !== "comment" &&
          body.action !== "comment-resolve" &&
          body.action !== "comment-reopen"
        ) {
          return false;
        }
        const code =
          error && typeof error === "object" && "code" in error
            ? String((error as { code: unknown }).code)
            : "";
        if (code !== "STALE_WRITE") {
          return false;
        }
        // R7 (BEN, Runde 6): HIER STAND DIE LETZTE NEULADE-AUFFORDERUNG. Die Fläche hängt diesen
        // Text an ihren eigenen Satz (`MehrAbschnitte.tsx`, `diskussionsFehlerSatz`), also war die
        // sichtbare Meldung trotz bereinigtem Sprachkatalog weiterhin „bitte den Stand neu laden" —
        // und wer dem folgte, verlor den Entwurf, den derselbe Satz als erhalten bezeichnete.
        //
        // WAS DIESE ZEILE JETZT SAGT UND WAS NICHT: den Grund, den nur der Server kennt. Was als
        // Nächstes zu tun ist, sagt die Fläche — dort steht der Knopf, und nur dort ist bekannt, dass
        // der Text noch im Feld liegt. Geprüft wird die ganze Verkettung in
        // `tests/wiki-diskussion/fehlermeldung-neuladen.test.ts` an der ECHTEN Antwort dieser Route.
        reply.code(409).send({
          error: code,
          message:
            "Der Beitrag wurde nicht angefügt: der gelesene Stand war beim Schreiben bereits überholt.",
        });
        return true;
      };
      // JOB 3667 R2: was NACH jeder neuen Inhaltsfassung zu tun ist — für alle drei Schreibwege
      // (revise, revise-release, Übernahme eines Vorschlags) EINE Stelle. Die Kette ist heikel
      // (D-AISTATE), und drei Abschriften davon wären drei Gelegenheiten, sie auseinanderlaufen zu
      // lassen. Der Inhalt ist Zeichen für Zeichen der bisherige Nachlauf des `revise`-Zweigs.
      const nachNeuerFassung = async (revidiert: KnowledgeObject): Promise<KnowledgeObject> => {
        // D-AISTATE PAKET 4 (bens V5, aistate-fix3): eine Revision macht alle offenen
        // automatischen Befunde, die eine ÄLTERE Version DIESES KOs gebunden haben, systemisch
        // gegenstandslos (superseded) — Board/Badges/Benachrichtigungen zeigen keinen
        // veralteten offenen Fund mehr; der frisch eingereihte Prüf-Job der neuen Version
        // urteilt eigenständig. Zusammen mit dem CAS-Insert der Services (Nachvalidierung nach
        // dem Insert) ist auch das Interleaving „alter Judge kehrt zwischen Revision und
        // Freigabe zurück" abgedeckt.
        await conflicts.onKoRevised(id, revidiert.version);
        await overlaps.onKoRevised(id, revidiert.version);
        // D-AISTATE PAKET 3.1 (Pedi Punkt 6, 23.07.): Eine inhaltliche Überarbeitung ENTWERTET jede
        // frühere Prüfung — der aiCheck wird auf pending zurückgesetzt und für die NEUE Inhaltsversion
        // neu eingereiht (statt Bearbeiten während laufender Prüfung zu sperren). Die Versions-Bindung
        // (aiCheck.koVersion) sorgt dafür, dass ein noch laufender ALTER Lauf das frisch geänderte KO
        // nicht fälschlich als geprüft markiert. Nur wenn je ein Prüf-Job vermerkt war (revised.aiCheck)
        // und der Worker verdrahtet ist — sonst kein neuer Job (Altbestand ohne Prüf-Pfad unangetastet).
        // D-AISTATE PAKET 4.3 (bens V5): die Antwort muss die FRISCH markierte Fassung zeigen (aiCheck
        // pending), nicht das vor markAiCheckPending gelesene `revised` (das noch den alten aiCheck trägt).
        if (aiCheckWorker && revidiert.aiCheck) {
          await ko.markAiCheckPending(id);
          // Vermerk NACH dem Setzen frisch lesen: er trägt die NEUE Zielversion (revised bumpt version;
          // markAiCheckPending liest sie). Mit ihr ist der Job hart an die überarbeitete Fassung gebunden.
          const marked = await ko.get(id);
          aiCheckWorker.enqueue(id, marked?.aiCheck?.koVersion);
          return marked ?? revidiert;
        }
        return revidiert;
      };
      try {
        // mega80 A: DAS TOR. Es steht VOR dem Switch und vor jeder fachlichen Berechtigung.
        //
        // Eine unbekannte Aktion wird hier abgewiesen, bevor das Tor greift: sie fasst kein Objekt
        // an und verrät deshalb auch keine Existenz — ein 400 ist die ehrlichere Antwort als ein
        // 404, das ein „gibt es nicht" über ein Objekt behauptet, nach dem gar nicht gefragt wurde.
        const torurteil = ZIELOBJEKT_TOR[body.action as KoAktion] as Torurteil | undefined;
        if (!torurteil) {
          return badRequest(`Unbekannte Aktion: ${body.action}`);
        }
        if (torurteil === "tor") {
          // Erst WER (Anmeldung), dann OB SICHTBAR, dann — in der jeweiligen `case` — WAS ER DARF.
          const anfragender = await guards.requireUser(request, reply);
          if (!anfragender) {
            return;
          }
          if (!(await sichtbaresKoOder404(anfragender, id, reply))) {
            return;
          }
        }
        // JOB 3667: `expectedVersion` wirkt AUSSCHLIESSLICH an den Schreibwegen, die es auch
        // vergleichen (dort steht die Begründung). An jeder anderen Aktion wäre es ein
        // angeforderter Schutz, der stillschweigend nicht greift — das ist schlimmer als keiner.
        // Deshalb 400.
        //
        // JOB 4251 · DER VERTRAG IST GEWACHSEN, NICHT AUFGEWEICHT. Seit diesem Auftrag vergleicht
        // auch der Einordnungsweg (`tags`/`category`) die Inhaltsfassung, WENN der Aufrufer sie
        // mitgibt (`knowledge-object/src/service.ts`, `mutateKoMetadata`). Damit greift der Schutz
        // dort — und genau das, und nur das, ist der Grund für die zwei neuen Namen in dieser
        // Liste. An allen übrigen Aktionen bleibt es beim 400
        // (`tests/word-rueckweg/route-bedingter-schreibzugriff.test.ts`, F5).
        if (
          body.expectedVersion !== undefined &&
          body.action !== "revise" &&
          body.action !== "revise-release" &&
          body.action !== "decide-proposal" &&
          body.action !== "tags" &&
          body.action !== "category"
        ) {
          return badRequest(
            'expectedVersion gilt nur für die Aktionen "revise", "revise-release", "decide-proposal", "tags" und "category".',
          );
        }
        // JOB 4251: der Stempel der EINORDNUNG greift nur dort, wo eine Einordnung geschrieben wird.
        // An `revise` wäre er ein Schutz auf dem falschen Gegenstand — der Inhaltsweg fasst die
        // Metadatenprojektion gar nicht an —, und stillschweigend geschluckt wäre er schlimmer als
        // gar keiner. Deshalb auch dort 400.
        if (
          body.expectedMetadataRevision !== undefined &&
          body.action !== "tags" &&
          body.action !== "category"
        ) {
          return badRequest(
            'expectedMetadataRevision gilt nur für die Aktionen "tags" und "category".',
          );
        }
        switch (body.action) {
          case "rate": {
            const user = await guards.requirePermission("ko.validate", request, reply);
            if (!user) {
              return;
            }
            if (!body.verdict) {
              return badRequest("verdict fehlt.");
            }
            reply.code(200).send(await validation.rate(id, user.id, body.verdict));
            return;
          }
          case "assign": {
            const user = await guards.requirePermission("ko.assign", request, reply);
            if (!user) {
              return;
            }
            await validation.assign(id, body.userIds ?? [], user.id);
            await notifyAssignment?.(id, body.userIds ?? []); // FR-VAL-07
            reply.code(204).send();
            return;
          }
          // Pedi 05.07.: Admin-Override „als wahr kennzeichnen" — schließt die Validierung komplett
          // ab. Bewusst nur Admin (users.manage), nicht schon ko.validate (Controller/Experte).
          case "admin-validate": {
            const user = await guards.requirePermission("users.manage", request, reply);
            if (!user) {
              return;
            }
            reply.code(200).send(await validation.adminValidate(id, user.id));
            return;
          }
          case "revise": {
            const user = await guards.requirePermission("ko.create", request, reply);
            if (!user) {
              return;
            }
            // ======================================================================================
            // JOB 3667 R2 — DER FREIGEGEBENE STAND GEHÖRT DEM, DER FREIGEBEN DARF.
            // ======================================================================================
            //
            // PEDIS REGEL (SICHTBARES-GESPRAECH.jsonl:693, Auftrag §4.5): wer nicht freigabe-
            // berechtigt ist, gibt seine eigene Änderung NIE selbst frei — sie „muss nochmal von
            // jemand anders überprüft werden". Runde 1 hat das nur im Word-Fenster durchgesetzt;
            // der Prüfer hat gezeigt, dass derselbe `experte` mit `ko.create` hier vorbeiläuft und
            // den freigegebenen Text ersetzt. Eine Regel, die ein direkter Routenaufruf aushebelt,
            // ist keine Regel.
            //
            // DIE REGEL IST SO ENG WIE MÖGLICH GEFASST: geschützt ist der FREIGEGEBENE Stand
            // (`status === "validiert"`), nicht jedes Objekt. Ein Objekt, das nie freigegeben wurde
            // oder nach einer Revision wieder offen steht, bearbeitet der Experte weiter wie bisher
            // — sonst nähme diese Zeile dem Erfassungs- und Nacharbeitsweg die Grundlage, ohne dass
            // Pedis Satz das verlangt.
            //
            // WER NICHT DARF, BEKOMMT DEN WEG GENANNT: 403 mit `PROPOSAL_REQUIRED` und dem Verweis
            // auf `propose`. Eine Ablehnung ohne Weg wäre eine Sackgasse.
            const bestand = await ko.get(id);
            if (bestand?.status === "validiert" && !can(user.role, "users.manage")) {
              reply.code(403).send({
                error: "PROPOSAL_REQUIRED",
                message:
                  'Dieses Wissensobjekt ist freigegeben. Ohne Freigaberecht wird eine Änderung als Vorschlag eingereicht (action "propose") und gilt erst nach der Freigabe durch jemand anderen.',
              });
              return;
            }
            // JOB 3667: `expectedVersion` ist der bedingte Schreibzugriff. Gelesen wird er hier,
            // GEPRÜFT wird er im Dienst — in derselben Transaktion, in der geschrieben wird (R2:
            // das war in Runde 1 ein Zeitfenster an der Route und ist jetzt ein CAS).
            const erwartet = erwarteteKoVersion(body.expectedVersion);
            if (erwartet === "unlesbar") {
              return badRequest(
                "expectedVersion muss eine Ganzzahl ab 1 sein (die Version, die beim Laden zu sehen war).",
              );
            }
            // SCRUM-470 (ben-Review #1): Client-`sources` auch beim Revise verwerfen — Anker bleiben
            // dem Import-Pfad vorbehalten. Ohne `sources` in den Changes bleiben die bestehenden erhalten.
            const { sources: _ignoredSources, ...changes } = body.changes ?? {};
            const revised = await ko.revise(
              id,
              changes,
              user.id,
              erwartet === undefined ? {} : { expectedVersion: erwartet },
            );
            reply.code(200).send(await nachNeuerFassung(revised));
            return;
          }
          // ======================================================================================
          // JOB 3667 R2 — FALL 1 DER ACCOUNTREGEL: ÜBERARBEITEN UND FREIGEBEN IN EINEM AUFRUF.
          // ======================================================================================
          //
          // WARUM EINE EIGENE AKTION UND NICHT ZWEI AUFRUFE: zwischen `revise` und `admin-validate`
          // lag in Runde 1 eine Spanne, in der ein fremder Schreiber die Fassung wechseln konnte —
          // freigegeben worden wäre dann SEIN Text. Der Dienst macht beides jetzt in einer
          // Transaktion; die Freigabe kann gar keine andere Fassung treffen als die, die dieser
          // Aufruf selbst geschrieben hat.
          //
          // DAS RECHT IST DASSELBE WIE AM ADMIN-OVERRIDE (`users.manage`): „gleich als geprüft
          // ablegen" kann im Bestand nur, wer auch `admin-validate` darf. Eine Bewertung
          // (`ko.validate`) ist EINE Stimme von `neededValidations` und macht nichts sofort gültig.
          //
          // ENTSCHEIDUNG 3 (Pedi 11.09.): DIE DIREKTE FREIGABE ERTEILT NUR DIE ROLLE `admin`. Geprüft
          // wird die ROLLE an genau dieser Stelle — nicht über ein neues Recht und nicht über die
          // Rechtematrix, die unverändert bleibt. `controller` und `experte` bekommen denselben
          // verständlichen 403 wie am `revise`-Zweig (`PROPOSAL_REQUIRED`) und damit den Weg genannt:
          // die Änderung als Vorschlag einreichen (`propose`), über den dann jemand anders entscheidet.
          case "revise-release": {
            const user = await guards.requireUser(request, reply);
            if (!user) {
              return;
            }
            if (user.role !== "admin") {
              reply.code(403).send({
                error: "PROPOSAL_REQUIRED",
                message:
                  'Direkt freigeben darf nur ein Administrator. Die Änderung wird stattdessen als Vorschlag eingereicht (action "propose") und gilt erst nach der Freigabe durch jemand anderen.',
              });
              return;
            }
            const erwartet = erwarteteKoVersion(body.expectedVersion);
            if (erwartet === "unlesbar") {
              return badRequest(
                "expectedVersion muss eine Ganzzahl ab 1 sein (die Version, die beim Laden zu sehen war).",
              );
            }
            const { sources: _verworfen, ...changes } = body.changes ?? {};
            const freigegeben = await ko.reviseUndFreigeben(id, changes, user.id, {
              trust: TRUST_MAX,
              ...(erwartet === undefined ? {} : { expectedVersion: erwartet }),
            });
            reply.code(200).send(await nachNeuerFassung(freigegeben));
            return;
          }
          // ======================================================================================
          // JOB 3667 R2 — FALL 2/3: DEN ÄNDERUNGSVORSCHLAG EINREICHEN.
          // ======================================================================================
          //
          // Er ändert am Objekt NICHTS ausser seiner Vorschlagsliste — kein Inhalt, keine Version,
          // kein Prüfstand. Das Recht ist `ko.create`, also dasselbe, mit dem jemand auch einen
          // Entwurf einreicht (`POST /api/drafts`): wer Wissen beitragen darf, darf vorschlagen.
          // `baseVersion` ist PFLICHT — ein Vorschlag ohne die Fassung, auf die er sich bezieht,
          // wäre später nicht mehr einzuordnen, und die Zusage „stammt aus Version n" wäre geraten.
          case "propose": {
            const user = await guards.requirePermission("ko.create", request, reply);
            if (!user) {
              return;
            }
            const vorschlag = body.proposal;
            if (!vorschlag || typeof vorschlag.statement !== "string") {
              return badRequest("proposal {statement} fehlt.");
            }
            const basis = erwarteteKoVersion(vorschlag.baseVersion);
            if (basis === "unlesbar" || basis === undefined) {
              return badRequest(
                "proposal.baseVersion muss die Ganzzahl der Version sein, auf der der Vorschlag beruht.",
              );
            }
            const angelegt = await ko.addProposal(id, user.id, {
              statement: vorschlag.statement,
              ...(typeof vorschlag.bodyHtml === "string" ? { bodyHtml: vorschlag.bodyHtml } : {}),
              // JOB 3667 R5: nur das ausdrückliche `true` ist die Löschabsicht. Ein fehlendes Feld
              // (so reicht Word ein) bleibt ein „nicht eingereicht" und löscht nichts.
              ...(vorschlag.clearBody === true ? { clearBody: true } : {}),
              baseVersion: basis,
              ...(typeof vorschlag.origin === "string" ? { origin: vorschlag.origin } : {}),
            });
            reply.code(200).send(angelegt.ko);
            return;
          }
          // ======================================================================================
          // JOB 3667 R2 — DIE FREMDE FREIGABE: ÜBER EINEN VORSCHLAG ENTSCHEIDEN.
          // ======================================================================================
          //
          // Übernehmen heisst: der Text wird zur neuen Fassung UND ist freigegeben — derselbe
          // atomare Weg wie `revise-release`. Ablehnen heisst: der Vorschlag ist entschieden, der
          // Inhalt des Objekts bleibt unberührt.
          //
          // DASS DER ENTSCHEIDER NICHT DER EINREICHER SEIN DARF, prüft der DIENST (`PROPOSAL_OWN`)
          // — hier steht sie bewusst NICHT ein zweites Mal: zwei Stellen für dieselbe Regel sind
          // eine Stelle zu viel, und die Route ist die, die man umgehen kann.
          case "decide-proposal": {
            const user = await guards.requirePermission("users.manage", request, reply);
            if (!user) {
              return;
            }
            const entscheidung = body.decision;
            if (entscheidung !== "uebernehmen" && entscheidung !== "ablehnen") {
              return badRequest('decision muss "uebernehmen" oder "ablehnen" sein.');
            }
            if (typeof body.proposalId !== "string" || body.proposalId.trim().length === 0) {
              return badRequest("proposalId fehlt.");
            }
            const erwartet = erwarteteKoVersion(body.expectedVersion);
            if (erwartet === "unlesbar") {
              return badRequest(
                "expectedVersion muss eine Ganzzahl ab 1 sein (die Version, die beim Laden zu sehen war).",
              );
            }
            const entschieden = await ko.decideProposal(
              id,
              body.proposalId.trim(),
              user.id,
              entscheidung,
              {
                trust: TRUST_MAX,
                ...(erwartet === undefined ? {} : { expectedVersion: erwartet }),
                ...(typeof body.note === "string" && body.note.trim().length > 0
                  ? { note: body.note.trim() }
                  : {}),
              },
            );
            // Nur eine ÜBERNAHME hat eine neue Inhaltsfassung erzeugt; eine Ablehnung nicht — der
            // Nachlauf (Konflikte, Überschneidungen, KI-Prüfung) hätte dort kein Subjekt.
            reply
              .code(200)
              .send(
                entscheidung === "uebernehmen"
                  ? await nachNeuerFassung(entschieden.ko)
                  : entschieden.ko,
              );
            return;
          }
          case "comment": {
            // FR-KO-06: jeder angemeldete Nutzer darf kommentieren.
            //
            // JOB 4146: DAS RECHTEGATE BLEIBT, WIE ES IST. Antworten und Klären sind Diskussion,
            // keine Freigabe — wer kommentieren darf, darf beides. Keine neue Berechtigung, keine
            // Rollenprüfung, keine Vier-Augen-Regel (Auftrag §5.4, HINWEIS Punkt 5).
            //
            // GEPRÜFT WIRD HIER DIE FORM, NICHT DIE EXISTENZ: ob es den Bezugsbeitrag gibt, weiss
            // nur der Dienst — und zwar in derselben per-KO serialisierten Klammer, in der er
            // schreibt. An dieser Stelle wäre die Existenzprüfung ein Zeitfenster und eine zweite
            // Stelle für dieselbe Regel (dieselbe Begründung wie an `decide-proposal`).
            const user = await guards.requireUser(request, reply);
            if (!user) {
              return;
            }
            if (!body.text?.trim()) {
              return badRequest("text fehlt.");
            }
            // Ein LEERER Bezug ist ein Formfehler und kein stilles Weglassen: der Aufrufer wollte
            // antworten, und ein weggeworfenes `replyTo` machte daraus lautlos einen neuen Faden.
            if (body.replyTo !== undefined) {
              if (typeof body.replyTo !== "string" || body.replyTo.trim().length === 0) {
                return badRequest(
                  "replyTo muss die Kennung des Beitrags sein, auf den geantwortet wird.",
                );
              }
            }
            // Dasselbe für den Beitragsschlüssel: ein leerer Schlüssel schützt vor nichts, und
            // stillschweigend ohne Schutz zu schreiben wäre die Umkehrung dessen, wofür er da ist.
            if (body.clientKey !== undefined) {
              if (typeof body.clientKey !== "string" || body.clientKey.trim().length === 0) {
                return badRequest(
                  "clientKey muss der nicht leere Beitragsschlüssel des Aufrufers sein.",
                );
              }
            }
            reply.code(200).send(
              await ko.addComment(id, user.id, body.text.trim(), {
                ...(typeof body.replyTo === "string" ? { replyTo: body.replyTo.trim() } : {}),
                ...(typeof body.clientKey === "string"
                  ? { clientKey: body.clientKey.trim() }
                  : {}),
              }),
            );
            return;
          }
          // ======================================================================================
          // JOB 4146 — DEN FADEN KLÄREN UND WIEDER ÖFFNEN.
          // ======================================================================================
          //
          // ZWEI ZWEIGE, EINE REGEL: „erledigt" und „wieder offen" sind derselbe Vorgang mit
          // verschiedenem Ziel. Was sie gemeinsam haben — die Prüfung der Beitragskennung und der
          // Aufruf des Dienstes — steht EINMAL in `klaerungsstand` (oben bei `nachNeuerFassung`);
          // zwei Abschriften wären zwei Gelegenheiten, sie auseinanderlaufen zu lassen. Die Wache
          // steht sichtbar in JEDEM Zweig: sie ist das, was ein Leser (und der Wächter in
          // `tests/security/kos-auth-vor-parsing.test.ts`) dort erwarten darf, und kein Zweig soll
          // sein Rechtegate von einem anderen borgen.
          //
          // DASSELBE GATE WIE `comment` (`requireUser`): wer mitdiskutieren darf, darf auch sagen,
          // dass eine Sache geklärt ist. Am Freigabestand des Wissensobjekts ändert das nichts —
          // das setzt der Dienst durch, nicht diese Stelle.
          case "comment-resolve": {
            const user = await guards.requireUser(request, reply);
            if (!user) {
              return;
            }
            return klaerungsstand(user.id, "erledigt");
          }
          case "comment-reopen": {
            const user = await guards.requireUser(request, reply);
            if (!user) {
              return;
            }
            return klaerungsstand(user.id, "offen");
          }
          case "attach": {
            // FR-CAP-05 / SCRUM-121: Anhang anfügen. Neu: Objekt-Referenz + kleine Vorschau;
            // alt (rückwärtskompatibel): Inline-Daten-URL.
            const user = await guards.requirePermission("ko.create", request, reply);
            if (!user) {
              return;
            }
            const att = body.attachment;
            if (!att?.name || !att.mime) {
              return badRequest("attachment {name, mime} fehlt.");
            }
            const current = await ko.get(id);
            // SCRUM-421: geltende Upload-Grenzen aus der Admin-Einstellung (sonst Werksvorgabe).
            const limits = (await uploadLimits.get()) ?? DEFAULT_UPLOAD_LIMITS;
            if ((current?.attachments?.length ?? 0) >= limits.maxAttachments) {
              return badRequest(`Maximal ${limits.maxAttachments} Anhänge je Objekt.`);
            }
            if (att.objectId) {
              // SCRUM-121: Original liegt im Object-Store; am KO nur Referenz + kleine Vorschau.
              if (att.thumbnail && att.thumbnail.length > limits.maxAttachmentBytes) {
                return badRequest("Vorschau zu groß (Upload-Grenze überschritten).");
              }
              // AUFTRAG-mega14 Block E (SCRUM-421) — DER EIGENTLICHE FUND.
              //
              // Hier wurde bis mega14 NUR die winzige Vorschau (`thumbnail`, wenige KB) gegen die
              // Größengrenze gehalten. Die ECHTE Datei liegt im Object-Store und wurde nie gegen die
              // Admin-Einstellung geprüft — es griff allein die fest verdrahtete Obergrenze des
              // Speichers (MAX_OBJECT_BYTES, 30 MB). Eine Admin-Grenze von z. B. 2 MB hatte damit
              // KEINE Wirkung auf reale Uploads, während der Admin „serverseitig durchgesetzt"
              // behauptete. Zugleich wurde `att.size` ungeprüft vom Client übernommen.
              //
              // Jetzt entscheidet die GESPEICHERTE Größe des Objekts, nicht die Angabe des Clients.
              const stored = await objects.metadata(att.objectId);
              if (!stored) {
                return badRequest("Unbekannte objectId.");
              }
              if (stored.size > limits.maxAttachmentBytes) {
                return badRequest("Anhang zu groß (Upload-Grenze überschritten).");
              }
              reply.code(200).send(
                await ko.addAttachment(id, user.id, {
                  name: att.name,
                  mime: att.mime,
                  objectId: att.objectId,
                  ...(att.thumbnail ? { thumbnail: att.thumbnail } : {}),
                  // Maßgeblich ist die Größe im Speicher — nicht, was der Client behauptet.
                  size: stored.size,
                }),
              );
              return;
            }
            // Alt-Pfad: Inline-Daten-URL (Bild-Thumbnail).
            if (!att.dataUrl) {
              return badRequest("attachment braucht objectId oder dataUrl.");
            }
            if (!att.mime.startsWith("image/") || !att.dataUrl.startsWith("data:")) {
              return badRequest("Nur Bild-Daten-URLs erlaubt.");
            }
            if (att.dataUrl.length > limits.maxAttachmentBytes) {
              return badRequest("Anhang zu groß (Upload-Grenze überschritten).");
            }
            reply.code(200).send(
              await ko.addAttachment(id, user.id, {
                name: att.name,
                mime: att.mime,
                dataUrl: att.dataUrl,
              }),
            );
            return;
          }
          case "detach": {
            const user = await guards.requirePermission("ko.create", request, reply);
            if (!user) {
              return;
            }
            if (!body.attachmentId) {
              return badRequest("attachmentId fehlt.");
            }
            reply.code(200).send(await ko.removeAttachment(id, body.attachmentId, user.id));
            return;
          }
          case "add-source": {
            // SCRUM-129 / FR-KO-07: externe Quelle anhängen (Bearbeiterpfad).
            const user = await guards.requirePermission("ko.create", request, reply);
            if (!user) {
              return;
            }
            if (!body.source?.label?.trim()) {
              return badRequest("source.label fehlt.");
            }
            // AUFTRAG-mega14 Block D (SCRUM-414): die Admin-Stufe wird HIER durchgesetzt, nicht in
            // der Oberfläche. Ein ausgegrauter Knopf ist keine Sperre, sondern eine Bitte.
            //
            // AUFTRAG-mega15 Block B (bens SB-4) — DIE ENTSCHEIDUNG HÄNGT NICHT MEHR AM CLIENT.
            // Bis mega15 unterschied diese Stelle am Feld `body.source.provider`. Das ist ein vom
            // Client frei gesetztes Feld: derselbe Treffer, ohne dieses Feld gesendet, kam auf JEDER
            // Stufe mit 200 durch. Das war keine Grenze, sondern eine Bitte mit Serverstempel.
            //
            // Jetzt leitet der Server die Herkunft aus der ADRESSE ab (attributeExternalSource,
            // services/external-search/src/provenance.ts). Ein geliefertes Herkunftsfeld wird nicht
            // gelesen — weder für die Entscheidung noch für das, was am Objekt vermerkt wird.
            //
            // AUFTRAG-mega16 Block A (bens SB-4, DRITTER Durchgang) — DIE FRAGE DREHT SICH UM.
            // mega15 prüfte die Stufe nur bei ERKANNTEM Provider. Lieferte die Ableitung `null`,
            // ging die Quelle ungeachtet der Stufe durch: über einen Spiegel, einen Kurzlink, einen
            // beliebigen anderen öffentlichen Host — oder ganz ohne Adresse. bens Urteil: „keine
            // Parsertricks, sondern der entscheidende semantische Bypass."
            //
            // Pedis Entscheidung (25.07.2026): fail-closed. Gefragt wird nicht mehr „ist das ein
            // erkannter Provider?", sondern „ist diese Quelle nachweislich INTERN?". Wer das nicht
            // belegen kann, kommt auf `blocked`/`search_on_click` nicht durch. Die Entscheidung
            // selbst steht als reine Funktion in external-search/src/attach-policy.ts; hier werden
            // nur die TATSACHEN beschafft — und zwar jede aus einer Quelle, die der Client nicht
            // beeinflussen kann:
            //   - die Stufe aus dem Admin-Bestand,
            //   - die Reichweite aus der Adresse gegen die KONFIGURIERTE Origin-Allowlist,
            //   - der Anker aus der ANHANGSLISTE DIESES Wissensobjekts, nicht aus dem Feld selbst.
            const stage = (await externalPolicy.getStage()) ?? DEFAULT_EXTERNAL_KNOWLEDGE_STAGE;
            const reach = classifySourceReach(body.source.url, internalSourceOrigins);
            // Der Anker wird nur dort beschafft, wo er zählen kann (adresslose Quelle auf
            // restriktiver Stufe) — sonst spart der häufige Fall den zusätzlichen Lesevorgang.
            //
            // JOB 4077: der Vergleich selbst steht seither in `confirmedSourceAnchor`
            // (knowledge-object) — dieselbe Frage, die der SPEICHERWEG in `ko.addSource` stellt.
            // Zwei Ausdrücke dafür wären zwei Regeln, die auseinanderlaufen können. Die BEDINGUNG
            // davor bleibt um kein Zeichen verändert: nach wie vor wird nur dort nachgeschlagen, wo
            // der Anker die Entscheidung tragen kann, und `decideExternalAttach` bekommt damit
            // exakt dasselbe `anchoredToOwnAttachment` wie vor diesem Auftrag.
            let anchoredToOwnAttachment = false;
            if (reach === "unaddressed" && !externalAttachAllowed(stage) && body.source.objectId) {
              const target = await ko.get(id);
              anchoredToOwnAttachment =
                confirmedSourceAnchor(target?.attachments, body.source.objectId) !== null;
            }
            const decision = decideExternalAttach({ stage, reach, anchoredToOwnAttachment });
            if (!decision.allowed) {
              reply.code(403).send({
                error: "EXTERNAL_ATTACH_BLOCKED",
                message:
                  decision.denial === "public-source"
                    ? "Auf der eingestellten Stufe darf keine Quelle mit öffentlicher Web-Adresse an ein Wissensobjekt angehängt werden — Suchen bleibt erlaubt, Anhängen nicht. Ein Administrator kann die Stufe unter Verwaltung → Externes Wissen ändern."
                    : "Auf der eingestellten Stufe darf nur eine Quelle angehängt werden, die nachweislich aus dem eigenen Haus stammt: eine Belegstelle aus einem an diesem Wissensobjekt hinterlegten Dokument oder eine Adresse aus dem konfigurierten internen Netz. Eine Quelle ohne Adresse lässt sich nicht von einem externen Treffer unterscheiden, dem die Adresse fehlt. Ein Administrator kann die Stufe unter Verwaltung → Externes Wissen ändern.",
                stage,
                reason: decision.denial,
              });
              return;
            }
            reply.code(200).send(
              await ko.addSource(id, user.id, {
                label: body.source.label,
                url: body.source.url ?? null,
                excerpt: body.source.excerpt ?? null,
                // Serverseitig abgeleitet — nie übernommen.
                provider: attributeExternalSource(body.source.url),
                // JOB 4077: der ANKER-KANDIDAT. Hier wird er WEITERGEREICHT, nicht geglaubt: der
                // Dienst schlägt ihn in der Anhangsliste dieses Objekts nach und speichert ihn nur,
                // wenn er dort liegt (`service.ts`, `addSource`). Bis hierher endete die Kette an
                // dieser Zeile — der Server hatte die Zugehörigkeit vierzehn Zeilen weiter oben
                // geprüft und vergaß sie beim Speichern.
                objectId: body.source.objectId ?? null,
              }),
            );
            return;
          }
          // ==================================================================================
          // AUFTRAG-mega18 Block A — DIE VERBUND-OPERATION. ALLE WEGE GEHEN HINDURCH.
          // ==================================================================================
          //
          // WAS HIER PASSIERT UND WAS NICHT. Diese Route trifft die Policy-Entscheidung
          // weiterhin SERVERSEITIG und ruft danach eine transaktionale, idempotente
          // Service-Komposition mit BEREITS GEPRÜFTEN FAKTEN auf. Die Sicherheitsgrenze wird
          // dafür nicht gelockert: es ist derselbe `decideExternalAttach`-Vertrag, dieselbe
          // Stufe aus dem Admin-Bestand, dieselbe Reichweiten-Einordnung aus der Adresse.
          // An services/external-search/src/attach-policy.ts ändert sich KEIN Zeichen.
          //
          // DIE ZWEI REGELN, hier im Vollzug nebeneinander sichtbar:
          //   (I)  EXTERNE STUFENREGEL — unten, `decideExternalAttach` je Belegstelle. Frage:
          //        darf eine externe Quelle an ein Wissensobjekt? Stellhebel: die Admin-Stufe.
          //   (II) INTERNE BELEGPFLICHT — im Service, `requireDocumentEvidence`. Frage: hängt
          //        übernommener Dokumentinhalt an seinem Original? Stellhebel: KEINER, auf
          //        JEDER der vier Stufen gleich.
          // Bis mega17 gab es nur (I), und (II) ist stillschweigend an sie delegiert worden —
          // deshalb war auf `search_attach` und `open` gar kein Anker gefordert. Zwei
          // verschiedene Regeln; dass die eine die andere zufällig miterledigt hat, war nie
          // Absicht. Die ausgeschriebene Trennung steht in knowledge-object/src/document-append.ts.
          case "append-document": {
            const user = await guards.requirePermission("ko.create", request, reply);
            if (!user) {
              return;
            }
            const payload = body.appendDocument;
            if (!payload) {
              return badRequest("appendDocument fehlt.");
            }
            const points = payload.points ?? [];
            if (points.length === 0) {
              return badRequest("appendDocument.points fehlt — kein Inhalt ohne Herkunft.");
            }
            if (points.some((p) => !p?.label?.trim())) {
              return badRequest("appendDocument.points[].label fehlt.");
            }
            const changesBody = payload.changes?.bodyHtml;
            if (payload.changes !== undefined && typeof changesBody !== "string") {
              return badRequest("appendDocument.changes.bodyHtml fehlt.");
            }
            const anchorInput = payload.anchor;
            if (!anchorInput?.objectId || !anchorInput.name || !anchorInput.mime) {
              // Die INTERNE BELEGPFLICHT wirft ohnehin im Service; hier gibt es zusätzlich den
              // ehrlichen Formfehler, damit ein unvollständiger Aufruf nicht als Regelbruch
              // erscheint. Beides endet mit 400 — nie mit einer stillen Übernahme.
              return badRequest(
                "appendDocument.anchor {objectId, name, mime} fehlt — übernommener Dokumentinhalt braucht sein Original.",
              );
            }
            const target = await ko.get(id);
            if (!target) {
              reply
                .code(404)
                .send({ error: "NOT_FOUND", message: "Wissensobjekt nicht gefunden." });
              return;
            }
            // ==========================================================================
            // AUFTRAG-mega19 Block A — DER REPLAY-NACHSCHLAG STEHT VOR DEN VERÄNDERLICHEN TOREN.
            // ==========================================================================
            //
            // WAS OBERHALB DIESER ZEILE STEHEN DARF und warum: Authentisierung (das Recht
            // `ko.create` ändert sich nicht dadurch, dass der erste Aufruf durchlief), die
            // UNVERÄNDERLICHEN Formprüfungen (fehlende Punkte, fehlende Labels, fehlender Anker —
            // eine wiederholte Anfrage mit derselben Kennung trägt denselben Body, also fällt sie
            // dort entweder beide Male oder keinmal) und die Existenz des Wissensobjekts.
            //
            // WAS UNTERHALB STEHEN MUSS: alles, dessen Antwort sich zwischen erstem Aufruf und
            // Wiederholung ÄNDERN kann — die Anhangzahl (der erste Aufruf erhöht sie selbst!), die
            // gespeicherte Objektgröße, die Upload-Grenzen und die externe Stufe. Diese Tore auf
            // eine Wiederholung anzuwenden heißt, den Aufrufer für den Erfolg seines eigenen
            // ersten Aufrufs zu bestrafen.
            //
            // DER DETERMINISTISCHE FALL, der das erzwungen hat: ein Objekt mit
            // `maxAttachments - 1` Anhängen · Aufruf 1 besteht die Vorprüfung und committet Anker,
            // Belegstellen und Body · die Antwort erreicht den Browser nicht · der identische
            // Retry sah `maxAttachments` und bekam BAD_REQUEST. Der Client führt einen 400 als
            // EINDEUTIGE Ablehnung (apps/web/src/lib/appendToArticle.ts) und setzt daraufhin
            // `appendUnclear` auf `false` (apps/web/src/pages/KnowledgeDetail.tsx) — der lokale,
            // ALTE Editorstand wird wieder speicherbar und überschreibt die gerade committete
            // Fassung. Aus einem gelungenen Commit wurde so Datenverlust.
            //
            // WARUM VORZIEHEN UND NICHT EIN EIGENER STATUS-ENDPUNKT (die zweite zulässige Form):
            // Ein getrennter Endpunkt verlangt vom Client eine zweite Runde („erst fragen, dann
            // wiederholen") und damit einen zweiten Zustand, in dem ein Netzfehler auftreten kann —
            // er verschiebt das Fenster, statt es zu schließen. Er wäre außerdem eine NEUE
            // öffentliche Oberfläche mit eigener Rechteprüfung, also mehr Sicherheitsfläche für
            // weniger Wirkung. Der vorgezogene Nachschlag braucht kein neues Recht, keinen neuen
            // Pfad und keine Client-Änderung: derselbe Aufruf, derselbe Body, dieselbe Kennung
            // liefert dasselbe Ergebnis — genau die Zusage, die das Retry-Verhalten voraussetzt.
            //
            // WARUM DAS KEIN SCHLUPFLOCH IST: `lookupDocumentAppend` SCHREIBT NICHT. Findet es die
            // Kennung nicht, liefert es `null` und der Ablauf geht ungekürzt durch ALLE Tore
            // unten. Es gibt keinen Weg, auf dem etwas NEUES entsteht, ohne Kapazität und Stufe
            // passiert zu haben — auch nicht, wenn die Vorgangs-Erinnerung zwischenzeitlich
            // ausgelaufen ist (dann ist es eben keine Wiederholung mehr, sondern eine neue
            // Übernahme, und die wird vollständig geprüft).
            const replay = await ko.lookupDocumentAppend(id, payload.operationId ?? "");
            if (replay) {
              // Dieselbe Antwortform wie der Vollzug. Keine Folgeschritte: sie liefen beim ersten
              // Mal (siehe `commit.replayed` unten) — sie hier zu wiederholen wäre kein Fehler,
              // aber auch keine Wahrheit.
              reply.code(200).send({
                committed: true,
                operationId: replay.operationId,
                replayed: true,
                koVersion: replay.koVersion,
                attachmentId: replay.attachmentId,
                sourceIds: replay.sourceIds,
                ko: replay.ko,
              });
              return;
            }
            // SCRUM-421 / mega14 Block E: derselbe Anhangs-Vertrag wie `attach` — Anzahl UND die
            // GESPEICHERTE Größe gegen die Admin-Grenze. Der Anker ist ein ganz normaler
            // Dokumentanhang und bekommt keine Sonderbehandlung; `objects.metadata` ist zugleich
            // der Beleg, dass es das Objekt WIRKLICH gibt (nicht bloß eine Client-Behauptung).
            const limits = (await uploadLimits.get()) ?? DEFAULT_UPLOAD_LIMITS;
            if ((target.attachments?.length ?? 0) >= limits.maxAttachments) {
              return badRequest(`Maximal ${limits.maxAttachments} Anhänge je Objekt.`);
            }
            if (anchorInput.thumbnail && anchorInput.thumbnail.length > limits.maxAttachmentBytes) {
              return badRequest("Vorschau zu groß (Upload-Grenze überschritten).");
            }
            const stored = await objects.metadata(anchorInput.objectId);
            if (!stored) {
              return badRequest("Unbekannte objectId.");
            }
            if (stored.size > limits.maxAttachmentBytes) {
              return badRequest("Anhang zu groß (Upload-Grenze überschritten).");
            }
            // (I) DIE STUFENREGEL, je Belegstelle. Der Anker gilt hier als BELEGT, und zwar aus
            // einem stärkeren Grund als beim einzelnen `add-source`: dort wird die Anhangsliste
            // des Objekts befragt (der Anhang muss schon liegen), hier bindet DIESELBE Operation
            // das gerade im Objektspeicher nachgeschlagene Dokument als Anhang DIESES Objekts —
            // im selben Schreibvorgang wie die Belegstellen. Der Server behauptet also nichts,
            // was er nicht unmittelbar danach selbst herstellt.
            const stage = (await externalPolicy.getStage()) ?? DEFAULT_EXTERNAL_KNOWLEDGE_STAGE;
            for (const point of points) {
              const reach = classifySourceReach(point.url, internalSourceOrigins);
              const decision = decideExternalAttach({
                stage,
                reach,
                anchoredToOwnAttachment: true,
              });
              if (!decision.allowed) {
                reply.code(403).send({
                  error: "EXTERNAL_ATTACH_BLOCKED",
                  message:
                    "Auf der eingestellten Stufe darf keine Quelle mit öffentlicher Web-Adresse an ein Wissensobjekt angehängt werden — Suchen bleibt erlaubt, Anhängen nicht. Ein Administrator kann die Stufe unter Verwaltung → Externes Wissen ändern.",
                  stage,
                  reason: decision.denial,
                });
                return;
              }
            }
            // Ab hier: geprüfte Fakten in die Komposition. Sie entscheidet nichts nach — außer
            // (II), ihrer eigenen Regel.
            const commit = await ko.appendDocumentExtract(id, user.id, {
              operationId: payload.operationId ?? "",
              anchor: {
                objectId: anchorInput.objectId,
                name: anchorInput.name,
                mime: anchorInput.mime,
                ...(anchorInput.thumbnail ? { thumbnail: anchorInput.thumbnail } : {}),
                // Maßgeblich ist die Größe im Speicher — nicht, was der Client behauptet.
                size: stored.size,
              },
              sources: points.map((p) => ({
                label: p.label as string,
                url: p.url ?? null,
                excerpt: p.excerpt ?? null,
                // Serverseitig abgeleitet — nie übernommen (mega15 Block B).
                provider: attributeExternalSource(p.url),
              })),
              ...(payload.changes !== undefined
                ? {
                    changes: {
                      bodyHtml: changesBody as string,
                      ...(payload.changes.statement !== undefined
                        ? { statement: payload.changes.statement }
                        : {}),
                      ...(payload.changes.title !== undefined
                        ? { title: payload.changes.title }
                        : {}),
                    },
                  }
                : {}),
            });
            // ============================================================================
            // AB HIER IST COMMITTET. NICHTS DARF DAS MEHR IN „NICHT COMMITTET" VERWANDELN.
            // ============================================================================
            //
            // Das war der Kern von bens erstem Befund: die `revise`-Aktion (oben, :450-483)
            // führt nach der Persistenz weitere asynchrone Schritte aus und antwortet danach.
            // Wirft dort etwas, lehnt der Fetch ab — obwohl der Body gespeichert ist. Der
            // Client hielt das für „nichts passiert" und kompensierte.
            //
            // Dieselben Folgeschritte sind hier fachlich weiterhin nötig (eine Revision
            // entwertet offene automatische Befunde und die frühere KI-Prüfung). Aber sie sind
            // FOLGEN eines vollzogenen Commits, nicht Teil davon. Deshalb werden sie EINZELN
            // abgeschirmt und ihr Fehlschlag wird BENANNT statt geworfen: `followUpsFailed` ist
            // ein ehrlicher Teilbefund („die Revision gilt, dieser Folgeschritt lief nicht"),
            // aus dem der Aufrufer NIE schließen darf, dass der Inhalt nicht steht.
            const followUpsFailed: string[] = [];
            if (commit.replayed) {
              // Eine Wiederholung hat nichts Neues geschrieben — die Folgeschritte liefen beim
              // ersten Mal. Sie erneut auszuführen wäre kein Fehler, aber auch keine Wahrheit.
            } else {
              try {
                await conflicts.onKoRevised(id, commit.koVersion);
              } catch {
                followUpsFailed.push("conflicts");
              }
              try {
                await overlaps.onKoRevised(id, commit.koVersion);
              } catch {
                followUpsFailed.push("overlaps");
              }
              if (aiCheckWorker && commit.ko.aiCheck) {
                try {
                  await ko.markAiCheckPending(id);
                  const marked = await ko.get(id);
                  aiCheckWorker.enqueue(id, marked?.aiCheck?.koVersion);
                } catch {
                  followUpsFailed.push("ai-check");
                }
              }
            }
            // DAS EINDEUTIGE COMMIT-ERGEBNIS. Der Aufrufer erfährt ohne Rückfrage, was gilt:
            // welche Version, welcher Anker, welche Belegstellen — und ob das eine Wiederholung
            // war. Kommt diese Antwort NICHT an, wiederholt er denselben Aufruf mit derselben
            // Kennung und bekommt dasselbe Ergebnis. Blindes Kompensieren ist damit nicht nur
            // verboten, sondern unnötig.
            reply.code(200).send({
              committed: true,
              operationId: commit.operationId,
              replayed: commit.replayed,
              koVersion: commit.koVersion,
              attachmentId: commit.attachmentId,
              sourceIds: commit.sourceIds,
              ...(followUpsFailed.length > 0 ? { followUpsFailed } : {}),
              // Die frisch gelesene Fassung, damit die Oberfläche nicht nachfragen muss.
              ko: (await ko.get(id)) ?? commit.ko,
            });
            return;
          }
          case "remove-source": {
            const user = await guards.requirePermission("ko.create", request, reply);
            if (!user) {
              return;
            }
            if (!body.sourceId) {
              return badRequest("sourceId fehlt.");
            }
            reply.code(200).send(await ko.removeSource(id, body.sourceId, user.id));
            return;
          }
          case "category": {
            const user = await guards.requirePermission("ko.create", request, reply);
            if (!user) {
              return;
            }
            if (!body.category) {
              return badRequest("category fehlt.");
            }
            const bedingung = einordnungsBedingung();
            if (bedingung === "unlesbar") {
              return;
            }
            reply
              .code(200)
              .send(
                mitEinordnungsstand(
                  await ko.updateCategory(id, body.category, user.id, bedingung.opts),
                  bedingung,
                ),
              );
            return;
          }
          case "tags": {
            const user = await guards.requirePermission("ko.create", request, reply);
            if (!user) {
              return;
            }
            const bedingung = einordnungsBedingung();
            if (bedingung === "unlesbar") {
              return;
            }
            // G27 Welle 1 / S2: der Schlagwortweg ist jetzt auditiert — und ein Beleg mit dem
            // Actor „system" wäre schlechter als keiner. Er bekommt denselben angemeldeten
            // Benutzer wie der Kategorieweg direkt darüber.
            reply
              .code(200)
              .send(
                mitEinordnungsstand(
                  await ko.updateTags(id, body.tags ?? [], user.id, bedingung.opts),
                  bedingung,
                ),
              );
            return;
          }
          // SCRUM-415/509: Vertraulichkeitsstufe setzen/ändern. Basisrecht ko.create (wie Bearbeiten).
          case "confidentiality": {
            const user = await guards.requirePermission("ko.create", request, reply);
            if (!user) {
              return;
            }
            // SCRUM-509 R2: die Prüfung (ungültige Stufe → 400) UND die Downgrade-Autorisierung laufen
            // ATOMAR in der Datenschicht (setConfidentiality, per-KO serialisiert) — kein TOCTOU
            // zwischen Rollenprüfung und Änderung. Die Route reicht nur die Downgrade-Berechtigung
            // (ko.validate = Prüfer/Admin) durch; Fehler werden zu 400/403/404 gemappt (sendError).
            try {
              const updated = await ko.setConfidentiality(id, body.level, user.id, {
                mayDowngrade: can(user.role, "ko.validate"),
              });
              reply.code(200).send(updated);
            } catch (error) {
              sendError(reply, error);
            }
            return;
          }
          // ==========================================================================================
          // JOB 557 (Pedi 13.08.2026) — WER DIE VERANTWORTUNG BENENNEN DARF.
          // ==========================================================================================
          //
          // `ko.validate` UND NICHT `ko.create`, und das ist die tragende Entscheidung dieses Zweigs.
          // `ko.create` hält in diesem System jeder Experte (rbac/src/policy.ts). Wer damit das
          // Eigentum setzen dürfte, könnte die Nacharbeit eines FREMDEN Menschen erklären — die
          // `warn`/`down`-Rückgabe landet seit diesem Job beim benannten Eigentümer. Eine
          // Schreibbefugnis am eigenen Objekt ist keine Befugnis, fremde Verantwortung zu bestimmen.
          //
          // `ko.validate` halten laut Rechtematrix nur `controller` und `admin` — dieselbe Schwelle,
          // die auch das Herabstufen der Vertraulichkeit trägt.
          //
          // DIE NUTZLAST WIRD HIER NICHT GEPRÜFT: das tut `setOwnership` in der Datenschicht,
          // defensiv und per-KO serialisiert. Eine zweite Prüfung an der Route wäre eine zweite
          // Wahrheit über dieselbe Form; ungültige Angaben kommen als 400 zurück (sendError).
          case "ownership": {
            const user = await guards.requirePermission("ko.validate", request, reply);
            if (!user) {
              return;
            }
            reply.code(200).send(await ko.setOwnership(id, body.ownership, user.id));
            return;
          }
          case "conflict": {
            const user = await guards.requirePermission("ko.validate", request, reply);
            if (!user) {
              return;
            }
            if (!body.conflict) {
              return badRequest("conflict fehlt.");
            }
            const created = await conflicts.create(body.conflict, user.id);
            // SCRUM-358 / AG-14-SERVER-TRUST: ein offener WAHRHEITSKONFLIKT holt betroffene VALIDIERTE
            // Bezugs-KOs serverseitig zurück in Review (Status validiert→offen, Trust konservativ
            // gesenkt). markTruthConflictReview ist idempotent/No-op für offene/fehlende KOs.
            if (created.type === "truth") {
              await ko.markTruthConflictReview(created.koA, user.id);
              await ko.markTruthConflictReview(created.koB, user.id);
            }
            reply.code(201).send(created);
            return;
          }
          case "resolve-conflict": {
            const user = await guards.requirePermission("conflict.resolve", request, reply);
            if (!user) {
              return;
            }
            if (!body.conflictId || !body.decision) {
              return badRequest("conflictId/decision fehlt.");
            }
            reply.code(200).send(await conflicts.resolve(body.conflictId, user.id, body.decision));
            return;
          }
          case "transfer-author": {
            const user = await guards.requirePermission("users.manage", request, reply);
            if (!user) {
              return;
            }
            if (!body.newAuthor) {
              return badRequest("newAuthor fehlt.");
            }
            reply.code(200).send(await lifecycle.transferAuthor(id, body.newAuthor, user.id));
            return;
          }
          case "revalidate": {
            const user = await guards.requirePermission("ko.create", request, reply);
            if (!user) {
              return;
            }
            reply.code(200).send(await lifecycle.confirmStillValid(id, user.id));
            return;
          }
          default:
            badRequest(`Unbekannte Aktion: ${body.action}`);
        }
      } catch (error) {
        // JOB 3667 R2: die vier Fehler des Rückwegs zuerst — sie tragen einen eigenen Status und
        // im Fall `KO_STALE` die jetzt gespeicherte Version. Alles andere geht unverändert an
        // `sendError`; ein nicht erkannter Code verlässt diese Stelle also genau wie bisher.
        if (await rueckwegFehler(error)) {
          return;
        }
        // JOB 4146: die abgelehnte Parallelschreibung der Diskussion — 409 statt 400 (s. o.).
        if (diskussionsFehler(error)) {
          return;
        }
        sendError(reply, error);
      }
    });
  };
}
