// ================================================================================================
// JOB 4086 — DIE ZWEI TÜREN DES SHAREPOINT-/ONEDRIVE-IMPORTS.
// ================================================================================================
//
// Beide sind `users.manage`-gebunden, wie JEDE Import-Route dieses Produkts
// (`import-access-routes.ts:41`: „der Import ist ohnehin admin-gebunden, eine weichere Tür für
// seinen Zustand wäre eine Rechte-Ausweitung durch die Hintertür"). Registriert werden sie NUR bei
// aktivem `KLARWERK_SHAREPOINT_IMPORT` — Schalter aus, Route existiert nicht.
//
// ================================================================================================
// EIN FEHLERCODE JE ZUSTAND — UND KEINE ZWEITE VOKABEL FÜR EINEN, DEN ES SCHON GIBT.
// ================================================================================================
//
// `IMPORT_UNAVAILABLE` (503) heisst in diesem Produkt seit mega67 genau eine Sache: „für dieses
// Quellsystem sind keine Zugangsdaten hinterlegt". Der Confluence-Weg sagt es so
// (`confluence-import-routes.ts`, 503), die Zugangs-Auskunft ist ausdrücklich dafür gebaut worden,
// diesen Zustand VOR dem Versuch zu melden. Ein eigener SharePoint-Code für denselben Sachverhalt
// wäre eine zweite Vokabel — die Fläche müsste beide kennen, und eine von beiden wäre irgendwann
// die vergessene.
//
// Die drei übrigen Codes sind NEU, weil ihr Sachverhalt neu ist, und sie sind deckungsgleich mit
// den vier Lagen aus `services/sharepoint` (Begründung dort):
//
//     403 SHAREPOINT_FORBIDDEN     — das Konto darf diese Datei/Bibliothek nicht sehen
//     404 SHAREPOINT_NOT_FOUND     — die Quelle gibt es dort nicht (mehr)
//     502 SHAREPOINT_UNREACHABLE   — Zugang abgelaufen oder Gegenstelle nicht brauchbar erreichbar
//
// DER STATUS IST DER DES AUFRUFS, nicht der durchgereichte von Graph. Ein 401 der Gegenstelle wird
// hier NICHT zu einem 401 dieser Anwendung: das hiesse „melde dich an", und der Aufrufer IST
// angemeldet — nicht er hat ein Problem, sondern der hinterlegte Zugang der Instanz.
//
// ================================================================================================
// WAS HIER NICHT ENTSTEHT.
// ================================================================================================
//
// KEIN ZWEITER IMPORT-KERN. Was diese Routen tun, endet bei `library.createImportCandidates` —
// demselben Weg, den der Confluence-Import und der JSON-Re-Import nehmen. Die REVIEW-INVARIANTE
// bleibt unangetastet: es entsteht ein KANDIDAT, nie ein Wissensobjekt. Erst ein Mensch nimmt an.
//
// KEIN SHAREPOINT-WORT IM IMPORT-KERN. Der Adapter liefert `ImportItem`s; `provider`, `externalId`,
// `sourceScope` und `sourceVersion` sind die quellneutralen Felder, die SCRUM-510 R2b dafür
// vorgesehen hat.
//
// ================================================================================================
// JOB 4232 — DER INHALT KOMMT MIT. KEINE NEUE TÜR, KEIN NEUER CODE, KEIN NEUER LAUF-ZÄHLER.
// ================================================================================================
//
// Beide vorhandenen Türen tragen ab hier zusätzlich eine Auskunft über den INHALT der Dateien, und
// beide bleiben, was sie sind:
//
//   TÜR 1 (`files`) → je Zeile `inhaltstyp`: was diese Datei bei einer Übernahme BRINGT
//                     (`text|leer|nur-merkmale|zu-gross`). Angekündigt aus Medientyp und Grösse
//                     DIESES Abrufs, nicht aus dem Dateinamen.
//                     JOB 4232 R2: dieselbe Tür beantwortet mit `ids` zusätzlich die GEMESSENE
//                     Frage — sie holt dann den Inhalt genau dieser Dateien wirklich und gibt den
//                     Befund zurück (`befunde`). Ohne `ids` bleibt sie, was sie war, und holt
//                     weiterhin keinen Inhalt: ein Blick in die Bibliothek darf nicht erst die
//                     halbe Bibliothek herunterladen. SCHREIBEN tut sie in KEINEM der zwei Fälle.
//   TÜR 2 (`apply`) → je übernommener Datei `inhalt`: was WIRKLICH ankam. Und `ohneInhalt`: die
//                     Dateien, deren Inhalt gemessen wurde und nicht trägt (leer, zu gross,
//                     unlesbar). Die werden NICHT eingereiht — s. `Uebernahmebilanz.ohneInhalt`.
//
// ES ENTSTEHT KEIN NEUER FEHLERCODE. Die vier Ausgänge oben bleiben die vier Ausgänge; ein leerer
// oder unlesbarer Inhalt ist keine Störung der Gegenstelle, sondern eine Tatsache über die Datei,
// und Tatsachen stehen in der Antwort, nicht im Statuscode.

import { randomUUID } from "node:crypto";
import type { FastifyBaseLogger, FastifyPluginAsync, FastifyReply } from "fastify";
import type {
  ImportRun,
  ImportRunRepo,
  ImportRunStatus,
  LibraryService,
} from "../../../library-analytics";
import {
  importProviderKey,
  isOpenReviewStatus,
  sanitizeImportFailureReason,
} from "../../../library-analytics";
import {
  type SharePointFehlerlage,
  type SharePointInhaltsbefund,
  type SharePointInventur,
  type SharePointSourceAdapter,
  createSharePointAdapterFromEnv,
  inventurFertig,
  neueInventur,
  sharepointFehlerlage,
} from "../../../sharepoint";
import type { Guards } from "../http";
import { sanitizeLogText } from "../log-sanitize";

export interface SharePointImportRouteDeps {
  library: LibraryService;
  guards: Guards;
  /** Injizierbar für Tests; Standard = die gecappte Adapter-Factory aus der Umgebung. */
  makeAdapter?: () => SharePointSourceAdapter | undefined;
  /**
   * Die Laufablage. OPTIONAL, damit ein Test diese Routen ohne sie bauen kann; die
   * Kompositionswurzel reicht sie IMMER durch. Ohne sie bekommt die Übernahme keine Kennung —
   * und die Zugangs-Auskunft kann dann keinen „zuletzt erfolgreich" belegen.
   */
  importRuns?: ImportRunRepo;
}

/**
 * Harter Deckel der Kennungen je Übernahme. Jede Kennung kostet EINEN Abruf an der Gegenstelle;
 * ein unbegrenzter Aufruf wäre ein Schreiblauf ohne Kante. Drüber: ehrlicher 400, kein stilles
 * Kappen.
 */
export const MAX_SHAREPOINT_IDS = 50;

/**
 * Die Grösse EINES Loses bei der Ordnerübernahme (Tür 3). Bewusst dieselbe Kante wie Tür 2: ein Los
 * ist eine Übernahme, und für eine Übernahme gilt dieselbe Grenze, gleich wer die Kennungen wählt.
 */
export const SHAREPOINT_LOS_GROESSE = MAX_SHAREPOINT_IDS;

/** Das Quellsystem dieser Routen — derselbe Name, den die Zugangs-Auskunft nachschlägt. */
const SYSTEM = "sharepoint";

/** Die Abbildung Lage → Antwort. EINE Stelle, damit beide Türen dasselbe sagen. */
export function sharepointAntwort(lage: SharePointFehlerlage): {
  status: 403 | 404 | 502;
  error: string;
} {
  switch (lage) {
    case "keine-berechtigung":
      return { status: 403, error: "SHAREPOINT_FORBIDDEN" };
    case "nicht-gefunden":
      return { status: 404, error: "SHAREPOINT_NOT_FOUND" };
    default:
      // `abgelaufen` und `nicht-erreichbar` teilen sich den Ausgang: aus Sicht des Aufrufers ist
      // beides „die Gegenstelle steht gerade nicht zur Verfügung", und die Fläche sagt genau das
      // in EINEM Satz (Begründung in services/sharepoint/src/graph-client.ts).
      return { status: 502, error: "SHAREPOINT_UNREACHABLE" };
  }
}

/**
 * Die Meldung zu einem Ausgang. KURZ UND HOSTFREI: sie nennt weder Adresse noch Zugangsmerkmal —
 * und sie ist NICHT der Text, den ein Mensch liest. Den trägt die Oberfläche in seiner Sprache
 * (`imp.sharepoint.fehler.*`); dies hier ist die Auskunft für das Protokoll und für Aufrufer ohne
 * Oberfläche.
 */
const MELDUNG: Record<string, string> = {
  IMPORT_UNAVAILABLE: "SharePoint-Import nicht konfiguriert.",
  SHAREPOINT_FORBIDDEN: "Keine Leseberechtigung für diese SharePoint-Quelle.",
  SHAREPOINT_NOT_FOUND: "Diese SharePoint-Quelle ist nicht mehr vorhanden.",
  SHAREPOINT_UNREACHABLE: "Der SharePoint-Zugang ist abgelaufen oder nicht erreichbar.",
};

function warne(log: FastifyBaseLogger, stelle: string, err: unknown): void {
  log.warn(
    { stelle, fehler: sanitizeLogText(err instanceof Error ? err.message : String(err)) },
    `sharepoint-import: ${stelle} fehlgeschlagen`,
  );
}

/** Die Kennungen aus dem Rumpf — dedupliziert, ohne Fremdtypen, Reihenfolge erhalten. */
function leseIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) {
    return [];
  }
  return [...new Set(raw.filter((id): id is string => typeof id === "string" && id.length > 0))];
}

/** Der Ordner aus dem Rumpf — oder `undefined` für die Wurzel der Bibliothek. */
function leseOrdnerId(raw: unknown): string | undefined {
  return typeof raw === "string" && raw.trim().length > 0 ? raw.trim() : undefined;
}

/**
 * Eine WIRKLICH übernommene Datei im Ergebnisbild.
 *
 * Bewusst SCHMALER als die Zeile der Auswahlliste: Der gezielte Abruf liefert das normalisierte
 * `ImportItem`, und das führt keine Dateigrösse. Sie hier aus der Liste von vorhin zu übernehmen
 * hiesse, eine Angabe aus einem anderen Abruf als Ergebnis DIESES auszugeben — ein Feld ohne
 * Erzeuger. Was nicht gemessen ist, steht nicht im Bild.
 */
interface Uebernommen {
  readonly id: string;
  readonly name: string;
  readonly url: string | null;
  readonly geaendertAm: string | null;
  /**
   * JOB 4232 — WAS WIRKLICH ÜBERNOMMEN WURDE: der Text der Datei oder nur ihre Merkmale.
   *
   * GEMESSEN, NICHT VERSPROCHEN: Das ist der Befund des Abrufs, den DIESE Übernahme gefahren hat,
   * nicht die Vorschau aus der Liste von vorhin. Beide können auseinanderliegen — eine Datei kann
   * zwischen Blick und Annahme grösser, leer oder kaputt geworden sein —, und dann gilt, was hier
   * steht. Hier stehen nur `text` und `nur-merkmale`: die drei übrigen Befunde führen gar nicht erst
   * zu einer Übernahme (s. die Schleife unten).
   */
  readonly inhalt: Extract<SharePointInhaltsbefund, "text" | "nur-merkmale">;
}

interface Uebernahmebilanz {
  readonly beauftragt: number;
  readonly eingereiht: number;
  readonly bereitsInQueue: number;
  readonly gescheitert: number;
  readonly nichtGefunden: number;
  /**
   * JOB 4232 — die Dateien, deren INHALT versprochen war und nicht ankam: nachweislich leer, über
   * der Inhaltskante oder nicht als Text dekodierbar.
   *
   * SIE WERDEN NICHT ÜBERNOMMEN, und das ist der Kern von Lieferung 4: Wer eine Textdatei wählt,
   * will ihren Text. Ein Eintrag, der nur den Dateinamen trägt, wäre in genau diesem Moment die
   * Halbheit, die als Erfolg gemeldet würde. Er zählt deshalb bei `itemsFailed` mit und macht den
   * Lauf `PARTIAL` — der Mensch sieht, dass sein Auftrag nicht vollständig erfüllt wurde.
   */
  readonly ohneInhalt: number;
}

// ==================================================================================================
// JOB 4125 — DER ZWEITE WEG DURCH DIESELBE TÜR: WAS „SCHON DA" HEISST UND WAS „NEUER STAND".
// ==================================================================================================
//
// Der Wiederholfall hat zwei Ausgänge, und sie sind aus Sicht des Menschen NICHT dasselbe:
//
//   UNVERÄNDERTE QUELLE  → der Import-Kern reiht nichts ein (`insertIfAbsent` findet denselben
//                          offenen Platz, `library-analytics/src/repo.ts:270-278`). Das zählt
//                          `bereitsInQueue`, und der Lauf führt es als `itemsSkipped`.
//   GEÄNDERTE QUELLE     → der Quellstand ist gewachsen (`sharepoint/src/mapper.ts:64-74`), der
//                          offene Platz ist ein ANDERER, und der neue Stand wird WIRKLICH
//                          eingereiht. Er zählt als `imported` — und genau das ist die Stelle, an
//                          der die Antwort bisher schwieg: für den Prüfenden sieht dieser Ausgang
//                          aus wie eine Erstanlage, obwohl zu derselben Quelle bereits ein ÄLTERER
//                          Vorgang in der Warteschlange steht.
//
// DAS FELD `neuerStand` SAGT GENAU DAS UND NICHTS DARÜBER HINAUS: „zu dieser Quelle stand bereits
// ein offener Vorgang in der Prüfung, und dieser Aufruf hat einen NEUEREN Stand eingereiht." Es ist
// gemessen, nicht geraten — die Grundlage ist der Bestand der Warteschlange, VOR dem ersten
// Schreibeffekt dieses Aufrufs gelesen. Es ist eine TEILMENGE von `imported`; an den vier disjunkten
// Zählern des Laufs ändert es nichts.
//
// EHRLICHE KOSTENGRENZE: `listImportCandidates()` liest die Warteschlange ganz. Der Aufruf geschieht
// deshalb HÖCHSTENS EINMAL JE ÜBERNAHME — vor der Schleife, nie je Kennung (dieselbe Form wie
// `trashedSourceAnchors()` im Import-Kern).
//
// KEIN SCHLÜSSELSTRING: gesucht wird über eine Karte JE ANBIETERSCHLÜSSEL, darin je Quellkennung.
// Eine verklebte Zeichenkette aus beiden Feldern wäre nicht injektiv — derselbe Befund, den JOB 3087
// am Idempotenz-Schlüssel der Warteschlange behoben hat (`repo.ts:155-184`).

/**
 * Der höchste Quellstand je offen wartendem Vorgang.
 *
 * `sourceVersion ?? 1` ist KEINE geratene Zahl, sondern die Rechnung, mit der die Warteschlange
 * ihren eigenen Idempotenzraum aufspannt (`repo.ts:230`) — eine zweite Lesart hier würde beim
 * nächsten Umbau still auseinanderlaufen.
 *
 * Scheitert die Lesung, kommt eine LEERE Karte zurück, und die Folge ist die SCHWÄCHERE Aussage:
 * dieser Lauf behauptet dann über keine Kennung, sie bringe einen neueren Stand. Nie andersherum.
 */
// ==================================================================================================
// JOB 4232 RUNDE 2 — DER DRITTE STAND: WAS EIN MENSCH BEREITS ANGENOMMEN HAT (bens Pflicht 3).
// ==================================================================================================
//
// DER BEFUND: Die Idempotenz der Warteschlange gilt für OFFENE Vorgänge (`insertIfAbsent`,
// `library-analytics/src/repo.ts`). Ist der Vorgang ANGENOMMEN, steht kein offener mehr da — und
// derselbe unveränderte Quellstand wurde bis Runde 1 erneut eingereiht und als `imported` gemeldet.
// Ben hat es nach Annahme und Neustart gemessen: `{ imported: 1, alreadyQueued: 0 }`, wo
// „schon vorhanden" die Wahrheit gewesen wäre. Lieferung 7 verlangt ausdrücklich den zweiten Satz.
//
// WORAN DIESER LAUF DAS ERKENNT, OHNE DEN IMPORT-KERN ANZUFASSEN (JOB 4151 hält ihn): an derselben
// Warteschlange, die er ohnehin liest. Ein angenommener Kandidat trägt seinen Status, seinen
// Quellstand UND die Kennung des erzeugten Wissensobjekts (`koId`, `types.ts:253`). Beides zusammen
// ist der Beleg „dieser Stand ist bereits im Bestand angekommen" — kein zweiter Leseweg, keine
// zweite Wahrheit, KEIN zusätzlicher Aufruf: es ist dieselbe eine `listImportCandidates()`-Lesung.
//
// DIE GRENZE, EHRLICH BENANNT: Wurde das erzeugte Objekt später in den Papierkorb gelegt, sieht
// diese Lesung das nicht — der angenommene Kandidat bleibt stehen. Derselbe Stand wird dann als
// „schon vorhanden" gemeldet, statt einen neuen Vorgang anzulegen. Das ist keine falsche Aussage
// (ein Objekt im Papierkorb ist wiederherstellbar und damit vorhanden), aber es ist eine ANDERE
// Aussage als vor dieser Runde; sie steht in der Rückgabe.
interface KandidatStaende {
  /** Der höchste Quellstand je OFFEN wartendem Vorgang. */
  readonly offen: ReadonlyMap<string, ReadonlyMap<string, number>>;
  /** Der höchste Quellstand, der bereits ANGENOMMEN und zu einem Wissensobjekt geworden ist. */
  readonly angenommen: ReadonlyMap<string, ReadonlyMap<string, number>>;
}

/** Trägt den höheren Stand je (Anbieter, Quellkennung) in die Karte ein. */
function merkeStand(
  karte: Map<string, Map<string, number>>,
  anbieter: string,
  externalId: string,
  stand: number,
): void {
  const jeAnbieter = karte.get(anbieter) ?? new Map<string, number>();
  const bisher = jeAnbieter.get(externalId);
  if (bisher === undefined || stand > bisher) {
    jeAnbieter.set(externalId, stand);
  }
  karte.set(anbieter, jeAnbieter);
}

/**
 * Die zwei Stände je Quelle, aus EINER Lesung der Warteschlange.
 *
 * `sourceVersion ?? 1` ist KEINE geratene Zahl, sondern die Rechnung, mit der die Warteschlange
 * ihren eigenen Idempotenzraum aufspannt (`repo.ts:230`) — eine zweite Lesart hier würde beim
 * nächsten Umbau still auseinanderlaufen.
 *
 * Scheitert die Lesung, kommen LEERE Karten zurück, und die Folge ist die SCHWÄCHERE Aussage:
 * dieser Lauf behauptet dann über keine Kennung, sie bringe einen neueren Stand, und er überspringt
 * auch keine — im Zweifel wird eingereiht und ein Mensch entscheidet. Nie andersherum.
 */
async function leseStaende(
  library: LibraryService,
  log: FastifyBaseLogger,
): Promise<KandidatStaende> {
  const offen = new Map<string, Map<string, number>>();
  const angenommen = new Map<string, Map<string, number>>();
  try {
    for (const kandidat of await library.listImportCandidates()) {
      const externalId = kandidat.item.externalId;
      if (!externalId) {
        continue;
      }
      const anbieter = importProviderKey(kandidat.item.provider);
      const stand = kandidat.item.sourceVersion ?? 1;
      if (isOpenReviewStatus(kandidat.status)) {
        merkeStand(offen, anbieter, externalId, stand);
        continue;
      }
      // NUR die WIRKLICH angekommenen: „angenommen" allein genügt nicht — eine als Dublette
      // angenommene Kennung erzeugt kein Objekt (`kandidatErzeugtWissensobjekt`), und dann ist
      // dieser Stand auch nicht im Bestand. Die Kennung des Objekts IST der Beleg.
      if (kandidat.status === "angenommen" && kandidat.koId !== null) {
        merkeStand(angenommen, anbieter, externalId, stand);
      }
    }
  } catch (err) {
    warne(log, "Vorgaenge lesen", err);
    return { offen: new Map(), angenommen: new Map() };
  }
  return { offen, angenommen };
}

/**
 * `PARTIAL`, sobald eine Kennung scheiterte ODER nicht mehr auffindbar war — dieselbe Regel wie
 * beim Confluence-Übernahmelauf (`uebernahmeStatus` dort): beides heisst, dass der Auftrag dieses
 * Aufrufs NICHT vollständig erfüllt wurde.
 */
function uebernahmeStatus(bilanz: Uebernahmebilanz): ImportRunStatus {
  return bilanz.gescheitert > 0 || bilanz.nichtGefunden > 0 || bilanz.ohneInhalt > 0
    ? "PARTIAL"
    : "COMPLETED";
}

/**
 * Die FÜNF Ausgänge sind DISJUNKT und decken jede beauftragte Kennung genau einmal ab, deshalb
 * gilt `itemsCreated + itemsSkipped + itemsFailed === itemsTotal` exakt. `itemsBound` ist belegbar
 * 0: die REVIEW-INVARIANTE lässt den Import nur Kandidaten anlegen, nie ein Objekt binden.
 *
 * JOB 4232: Der fünfte Ausgang (`ohneInhalt`) fällt zu `itemsFailed` — wie `nichtGefunden` schon
 * vorher. Er ist kein eigener Zähler des Laufs, weil der Lauf vier Zähler führt und eine fünfte
 * Spalte einen Vertrag ändern würde, den auch Confluence und der JSON-Re-Import teilen. Die
 * FEINERE Auskunft steht in der Antwort dieses Aufrufs, wo sie hingehört.
 */
function uebernahmeZaehler(bilanz: Uebernahmebilanz): ImportRun["counters"] {
  return {
    itemsTotal: bilanz.beauftragt,
    itemsCreated: bilanz.eingereiht,
    itemsBound: 0,
    itemsSkipped: bilanz.bereitsInQueue,
    itemsFailed: bilanz.gescheitert + bilanz.nichtGefunden + bilanz.ohneInhalt,
  };
}

/**
 * JOB 4232 — DIE DREI BEFUNDE, DIE EINE ÜBERNAHME EHRLICH ABBRECHEN.
 *
 * `leer` · `zu-gross` · `unlesbar`: In allen dreien wurde der Inhalt WIRKLICH gemessen, und in allen
 * dreien gibt es keinen Text. Die Datei wird deshalb nicht eingereiht, und der Grund reist je
 * Kennung mit — PII-frei, denn er ist eines von drei festen Wörtern und enthält weder Dateinamen
 * noch Inhalt.
 */
const OHNE_INHALT = ["leer", "zu-gross", "unlesbar"] as const;

function istOhneInhalt(art: SharePointInhaltsbefund): art is (typeof OHNE_INHALT)[number] {
  return (OHNE_INHALT as readonly string[]).includes(art);
}

/**
 * R-0144 — DER LAUFCODE, WENN DAS DATENVOLUMEN NICHT REICHTE.
 *
 * Eine Datei über der Inhaltskante (`zu-gross`) macht den Lauf `PARTIAL`. Den Grund nannte bis
 * hierher nur die Antwort dieses Aufrufs (`ohneInhalt`); der gespeicherte Lauf, den man später über
 * `GET /api/admin/import/runs/:importId` liest, trug `failureCode: null`. Jetzt trägt er diesen Code
 * und einen Satz mit der Anzahl — ohne Dateinamen und ohne Kennung.
 *
 * KEIN WIDERSPRUCH ZU JOB 4232 („es entsteht kein neuer Fehlercode"): dort geht es um die
 * HTTP-Ausgänge der Türen, und die bleiben unverändert. Dies ist ein Code AM LAUF, in derselben Art
 * wie `CONFLUENCE_RESPONSE_TOO_LARGE` beim Confluence-Lauf. `leer` und `unlesbar` sind keine Grenze
 * von Zeit oder Volumen und bekommen deshalb keinen.
 */
const LAUF_INHALT_ZU_GROSS = "SHAREPOINT_CONTENT_TOO_LARGE";

function volumengrund(
  ohneInhalt: readonly { befund: (typeof OHNE_INHALT)[number] }[],
): { failureCode: string; failureReason: string } | null {
  const zuGross = ohneInhalt.filter((o) => o.befund === "zu-gross").length;
  if (zuGross === 0) {
    return null;
  }
  return {
    failureCode: LAUF_INHALT_ZU_GROSS,
    failureReason: sanitizeImportFailureReason(
      `${zuGross} Datei(en) über der Inhaltsgrenze nicht übernommen.`,
    ),
  };
}

export function sharepointImportRoutes(deps: SharePointImportRouteDeps): FastifyPluginAsync {
  const makeAdapter = deps.makeAdapter ?? (() => createSharePointAdapterFromEnv());
  // R-0145/R-0190: die laufenden Losfolgen von Tür 3 — je Routen-Instanz, im Speicher (s. Tür 3).
  const losfolgen = new Map<string, Losfolge>();

  return async (app) => {
    // ------------------------------------------------------------------------------------------
    // TÜR 1: die berechtigte Dateiliste einer Bibliothek oder eines Ordners. READ-ONLY.
    // ------------------------------------------------------------------------------------------
    // Sie schreibt NICHTS: keinen Kandidaten, kein Objekt, keinen Lauf. Ein Blick in die Quelle ist
    // kein Import — und ein Lauf, der nur „jemand hat geschaut" festhielte, machte die Auskunft
    // „zuletzt erfolgreich importiert" unbrauchbar.
    // ------------------------------------------------------------------------------------------
    // JOB 4232 RUNDE 2 — DIESELBE TÜR BEANTWORTET JETZT ZWEI LESENDE FRAGEN.
    // ------------------------------------------------------------------------------------------
    //
    //   OHNE `ids` → „was liegt in dieser Bibliothek?" (unverändert seit JOB 4086)
    //   MIT  `ids` → „was steckt WIRKLICH in genau diesen Dateien?" — der gemessene Inhaltsbefund.
    //
    // WARUM KEINE DRITTE ADRESSE: Der Auftrag lässt keine neue Route zu (`build-app.ts` ist
    // Zielpfad eines anderen Jobs), und der Sachverhalt ist derselbe: ein LESENDER Blick in die
    // Quelle, `users.manage`-gebunden, ohne jeden Schreibeffekt. Eine zweite Adresse für dieselbe
    // Frage wäre eine zweite Vokabel.
    //
    // WARUM DIE ANTWORT BEIDE FELDER IMMER FÜHRT: Ein Feld, das mal da ist und mal nicht, zwingt
    // jeden Leser zu einer Fallunterscheidung, die er nicht treffen kann. `nurBefunde` sagt
    // ausdrücklich, WELCHE Frage beantwortet wurde — damit ist `dateien: []` in der Probe kein
    // „die Bibliothek ist leer", sondern „danach war nicht gefragt".
    app.post<{ Body: { folderId?: unknown; ids?: unknown } }>(
      "/api/admin/import/sharepoint/files",
      async (request, reply) => {
        const user = await deps.guards.requirePermission("users.manage", request, reply);
        if (!user) {
          return reply;
        }
        const adapter = makeAdapter();
        if (!adapter) {
          reply
            .code(503)
            .send({ error: "IMPORT_UNAVAILABLE", message: MELDUNG.IMPORT_UNAVAILABLE });
          return reply;
        }
        const ids = leseIds(request.body?.ids);
        if (ids.length > MAX_SHAREPOINT_IDS) {
          // Dieselbe harte Kante wie bei der Übernahme, und aus demselben Grund: jede Kennung
          // kostet einen Abruf an der Gegenstelle. Ehrlicher 400, kein stilles Kappen.
          reply.code(400).send({
            error: "APPLY_TOO_MANY",
            message: `Zu viele Dateien für eine Prüfung (${ids.length} von max. ${MAX_SHAREPOINT_IDS}).`,
          });
          return reply;
        }
        try {
          if (ids.length > 0) {
            const befunde = await adapter.pruefeInhalte(ids);
            reply.code(200).send({ dateien: [], truncated: false, nurBefunde: true, befunde });
            return reply;
          }
          const { dateien, truncated } = await adapter.listeDateien(
            leseOrdnerId(request.body?.folderId),
          );
          reply.code(200).send({ dateien, truncated, nurBefunde: false, befunde: [] });
          return reply;
        } catch (err) {
          warne(request.log, "Dateiliste", err);
          return sendeLage(reply, err);
        }
      },
    );

    // ------------------------------------------------------------------------------------------
    // TÜR 2: die gewählten Dateien abrufen und in die Prüf-Warteschlange stellen.
    // ------------------------------------------------------------------------------------------
    // NEVER BLOCK, aber auch NIE STILL: Scheitert EINE Datei, läuft der Aufruf weiter und führt sie
    // getrennt aus (`failed` mit PII-freiem Grund, `notFound` für die verschwundene Quelle). Was
    // WIRKLICH eingereiht wurde, zählt `imported` — ein idempotenter No-op (derselbe offene
    // Kandidat derselben Version) steht separat unter `alreadyQueued` und wird nie als Import
    // ausgegeben. Seit JOB 4125 ist diese Zusage an DIESER Tür gemessen
    // (`tests/sharepoint-onedrive-import/wiederholimport-am-draht.test.ts`, W1) und um den zweiten
    // Ausgang des Wiederholfalls ergänzt: `neuerStand` (s. dort).
    app.post<{ Body: { ids?: unknown } }>(
      "/api/admin/import/sharepoint/apply",
      async (request, reply) => {
        const user = await deps.guards.requirePermission("users.manage", request, reply);
        if (!user) {
          return reply;
        }
        const adapter = makeAdapter();
        if (!adapter) {
          reply
            .code(503)
            .send({ error: "IMPORT_UNAVAILABLE", message: MELDUNG.IMPORT_UNAVAILABLE });
          return reply;
        }
        const ids = leseIds(request.body?.ids);
        if (ids.length === 0) {
          reply.code(400).send({
            error: "APPLY_EMPTY_SELECTION",
            message: "Keine Datei ausgewählt.",
          });
          return reply;
        }
        if (ids.length > MAX_SHAREPOINT_IDS) {
          reply.code(400).send({
            error: "APPLY_TOO_MANY",
            message: `Zu viele Dateien für eine Übernahme (${ids.length} von max. ${MAX_SHAREPOINT_IDS}).`,
          });
          return reply;
        }
        const ausgang = await fuehreUebernahmeAus(
          deps,
          adapter,
          ids,
          user.id,
          `drive:${adapter.driveId}`,
          request.log,
        );
        reply.code(ausgang.code).send(ausgang.body);
        return reply;
      },
    );

    // ------------------------------------------------------------------------------------------
    // TÜR 3 (R-0145/R-0190): einen GANZEN Ordner übernehmen — in Losen, mit Halt nach jedem Los.
    // ------------------------------------------------------------------------------------------
    //
    // Tür 2 nimmt höchstens 50 einzeln gewählte Kennungen. Ein Kundenordner mit Hunderten Dateien
    // war damit nur von Hand in Häppchen zu übernehmen, und welche Häppchen vollständig waren,
    // wusste niemand ausser dem Menschen, der sie gewählt hatte. Diese Tür schneidet den Ordner
    // selbst in Lose:
    //
    //   LOSFOLGE   = der erste Aufruf (ohne `fortsetzung`) legt eine Losfolge an. Ihre Kennung ist
    //                die angebotene `los.fortsetzung`; jeder Folgeaufruf nennt sie.
    //   INVENTUR   = die Losfolge trägt eine FORTSETZBARE Inventur des Ordners (`SharePointInventur`):
    //                Graph-Cursor, noch zu lesende (Unter-)Ordner auf allen Ebenen, gefundene, noch
    //                nicht zugeteilte Dateien. Ein Aufruf liest nur so viele Seiten, wie das nächste
    //                Los braucht (höchstens `SHAREPOINT_INVENTUR_SEITEN_JE_AUFRUF`) — der Rest bleibt
    //                im Stand. Es gibt KEINE Gesamtkante, hinter der Dateien unerreichbar würden.
    //                Ordner werden nie Kandidaten.
    //   LOS        = die nächsten höchstens `SHAREPOINT_LOS_GROESSE` gefundenen Dateien, in der
    //                Folge, in der Graph sie geliefert hat. Ein Aufruf, der in seinem Seitenbudget
    //                noch keine Datei fand (z. B. viele leere Unterordner), übernimmt nichts und
    //                bietet die Fortsetzung trotzdem an.
    //   HALT       = EIN Aufruf übernimmt HÖCHSTENS EIN Los und endet. Weiter geht es nur, wenn
    //                jemand ausdrücklich mit der angebotenen `los.fortsetzung` fragt.
    //   NACHWEIS   = jedes Los ist ein eigener Lauf (`importId`, Scope `…/losfolge:<id>/los:<n>`). Ob
    //                es vollständig ist, steht am Lauf (`COMPLETED` gegen `PARTIAL`/`FAILED`) und in
    //                der Antwort (`los.vollstaendig`).
    //   KEIN MODELL = diese Routen kennen keinen Reasoner. Der Weg endet wie Tür 2 bei
    //                `library.createImportCandidates`; geprüft wird ohne Modell, angenommen erst
    //                von einem Menschen.
    //
    // ÄNDERUNGEN DER QUELLE (bens Befund F2): ein Los ist die Folge der GELESENEN Dateien, kein
    // Versatz in einer neu gelesenen Liste. Verschwindet zwischendurch eine Datei, rückt nichts nach;
    // ist sie schon zugeteilt, erscheint sie im Los als `notFound` und das Los als `PARTIAL`.
    // Scheitert ein ganzes Los (Zugang, Gegenstelle), gehen seine Dateien zurück in den Puffer und
    // kommen mit dem nächsten Aufruf derselben Losfolge noch einmal — nichts fällt still heraus.
    //
    // WAS „ABGESCHLOSSEN" HEISST: `los.ordnerAbgeschlossen` ist erst wahr, wenn jede Seite jedes
    // Ordners gelesen UND jede gefundene Datei einem Los zugeteilt ist. Dann gibt es keine
    // Fortsetzung mehr. Ob jedes einzelne Los vollständig war, sagen die Läufe.
    //
    // DIE GRENZE, AUSDRÜCKLICH: die Losfolge lebt im Speicher DIESES App-Prozesses (`losfolgen`,
    // mit Ablauf und Höchstzahl). Nach einem Neustart, nach Ablauf oder auf einer anderen Instanz ist
    // die Fortsetzung unbekannt (409); eine neue Losfolge ab Anfang reiht Bereits-Übernommenes nicht
    // doppelt ein (Idempotenz von Tür 2), kostet aber die Abrufe erneut.
    app.post<{ Body: { folderId?: unknown; fortsetzung?: unknown } }>(
      "/api/admin/import/sharepoint/folder-apply",
      async (request, reply) => {
        const user = await deps.guards.requirePermission("users.manage", request, reply);
        if (!user) {
          return reply;
        }
        const adapter = makeAdapter();
        if (!adapter) {
          reply
            .code(503)
            .send({ error: "IMPORT_UNAVAILABLE", message: MELDUNG.IMPORT_UNAVAILABLE });
          return reply;
        }
        const fortsetzung = leseFortsetzung(request.body?.fortsetzung);
        if (fortsetzung === null) {
          reply.code(400).send({
            error: "FORTSETZUNG_INVALID",
            message: "Die Fortsetzung muss die angebotene Kennung der Losfolge sein.",
          });
          return reply;
        }
        const ordnerId = leseOrdnerId(request.body?.folderId);
        const jetzt = Date.now();
        raeumeLosfolgenAuf(losfolgen, jetzt);
        let folge: Losfolge;
        if (fortsetzung === undefined) {
          machePlatzFuerLosfolge(losfolgen);
          folge = {
            id: randomUUID(),
            driveId: adapter.driveId,
            ordnerId,
            zuletztBenutzt: jetzt,
            inventur: neueInventur(ordnerId),
            lose: 0,
            inArbeit: false,
          };
          losfolgen.set(folge.id, folge);
        } else {
          const bekannt = losfolgen.get(fortsetzung);
          if (!bekannt || bekannt.driveId !== adapter.driveId) {
            reply.code(409).send({
              error: "FORTSETZUNG_UNBEKANNT",
              message:
                "Diese Losfolge ist nicht (mehr) bekannt. Bitte neu beginnen — bereits Übernommenes wird nicht doppelt eingereiht.",
            });
            return reply;
          }
          if (ordnerId !== undefined && ordnerId !== bekannt.ordnerId) {
            reply.code(400).send({
              error: "FORTSETZUNG_ORDNER",
              message: "Diese Losfolge gehört zu einem anderen Ordner.",
            });
            return reply;
          }
          if (bekannt.inArbeit) {
            reply.code(409).send({
              error: "FORTSETZUNG_BELEGT",
              message: "Das vorige Los dieser Losfolge läuft noch.",
            });
            return reply;
          }
          folge = bekannt;
        }
        folge.inArbeit = true;
        folge.zuletztBenutzt = jetzt;
        try {
          const { inventur } = folge;
          try {
            // LESEN VOR JEDEM SCHREIBEFFEKT: scheitert schon die Inventur, entsteht kein Lauf. Der
            // Stand ist nur bis zur letzten erfolgreich gelesenen Seite fortgeschrieben; dieselbe
            // Fortsetzung liest beim nächsten Aufruf genau dort weiter.
            await adapter.setzeInventurFort(
              inventur,
              SHAREPOINT_LOS_GROESSE,
              SHAREPOINT_INVENTUR_SEITEN_JE_AUFRUF,
            );
          } catch (err) {
            warne(request.log, "Ordnerinventur", err);
            if (folge.lose === 0 && inventur.dateien === 0) {
              // Eine Losfolge, die noch nichts gelesen hat, wird nicht als Fortsetzung angeboten.
              losfolgen.delete(folge.id);
            }
            return sendeLage(reply, err);
          }
          const kennungen = inventur.puffer.splice(0, SHAREPOINT_LOS_GROESSE);
          let laufStatus: ImportRunStatus | null = null;
          let bilanz: Record<string, unknown> = {
            imported: 0,
            alreadyQueued: 0,
            neuerStand: [],
            failed: [],
            notFound: [],
            ohneInhalt: [],
            dateien: [],
          };
          if (kennungen.length > 0) {
            folge.lose += 1;
            const ordnerTeil = folge.ordnerId ?? "root";
            const ausgang = await fuehreUebernahmeAus(
              deps,
              adapter,
              kennungen,
              user.id,
              `drive:${folge.driveId}/folder:${ordnerTeil}/losfolge:${folge.id}/los:${folge.lose}`,
              request.log,
            );
            if (ausgang.code !== 200) {
              // Das ganze Los ist gescheitert: seine Dateien gehen zurück an den Anfang des
              // Puffers und kommen mit der nächsten Fortsetzung noch einmal — nie still verloren.
              // Was davon schon eingereiht war, wird dabei nicht doppelt eingereiht (Tür 2).
              inventur.puffer.unshift(...kennungen);
              reply.code(ausgang.code).send({ ...ausgang.body, fortsetzung: folge.id });
              return reply;
            }
            laufStatus = ausgang.laufStatus;
            bilanz = ausgang.body;
          }
          const abgeschlossen = inventurFertig(inventur) && inventur.puffer.length === 0;
          if (abgeschlossen) {
            losfolgen.delete(folge.id);
          }
          reply.code(200).send({
            ...bilanz,
            los: {
              losfolge: folge.id,
              nummer: kennungen.length > 0 ? folge.lose : null,
              kennungen,
              vollstaendig: laufStatus === null || laufStatus === "COMPLETED",
              fortsetzung: abgeschlossen ? null : folge.id,
              wartend: inventur.puffer.length,
              inventar: {
                dateien: inventur.dateien,
                unterordner: inventur.unterordner,
                vollstaendig: inventurFertig(inventur),
              },
              ordnerAbgeschlossen: abgeschlossen,
            },
          });
          return reply;
        } finally {
          folge.inArbeit = false;
        }
      },
    );
  };
}

/**
 * Listenseiten, die EIN Aufruf von Tür 3 höchstens liest. Das begrenzt die Arbeit eines Aufrufs,
 * nicht die Inventur: was danach noch zu lesen ist, bleibt im Stand der Losfolge.
 */
export const SHAREPOINT_INVENTUR_SEITEN_JE_AUFRUF = 100;

/** So lange bleibt eine unberührte Losfolge fortsetzbar. */
const LOSFOLGE_LEBENSDAUER_MS = 24 * 60 * 60 * 1000;
/** Höchstzahl gleichzeitig gehaltener Losfolgen; darüber weicht die älteste ruhende. */
const MAX_LOSFOLGEN = 20;

/**
 * Eine Losfolge: die fortsetzbare Übernahme EINES Ordners. Ihre Kennung ist eine frisch erzeugte
 * Zufallskennung dieses Prozesses — sie bezeichnet die Losfolge und nichts sonst.
 */
interface Losfolge {
  readonly id: string;
  readonly driveId: string;
  readonly ordnerId: string | undefined;
  zuletztBenutzt: number;
  readonly inventur: SharePointInventur;
  lose: number;
  inArbeit: boolean;
}

/** Abgelaufene Losfolgen entfernen. Laufende bleiben. */
function raeumeLosfolgenAuf(losfolgen: Map<string, Losfolge>, jetzt: number): void {
  for (const [id, folge] of losfolgen) {
    if (!folge.inArbeit && jetzt - folge.zuletztBenutzt > LOSFOLGE_LEBENSDAUER_MS) {
      losfolgen.delete(id);
    }
  }
}

/**
 * Platz für EINE neue Losfolge: die am längsten angelegten ruhenden weichen zuerst (Einfügefolge der
 * Karte). Nur beim Anlegen gerufen — ein Fortsetzungsaufruf verdrängt nie eine Losfolge.
 */
function machePlatzFuerLosfolge(losfolgen: Map<string, Losfolge>): void {
  for (const [id, folge] of losfolgen) {
    if (losfolgen.size < MAX_LOSFOLGEN) {
      break;
    }
    if (!folge.inArbeit) {
      losfolgen.delete(id);
    }
  }
}

/** Höchstlänge einer Fortsetzung — die angebotene Kennung ist eine UUID. */
const MAX_FORTSETZUNG = 64;

/**
 * Die Fortsetzung aus dem Rumpf: fehlt sie, beginnt eine neue Losfolge (`undefined`); eine nicht
 * leere Zeichenkette ist die angebotene Kennung der Losfolge; alles andere ist ungültig (`null`).
 */
function leseFortsetzung(raw: unknown): string | undefined | null {
  if (raw === undefined || raw === null) {
    return undefined;
  }
  return typeof raw === "string" && raw.length > 0 && raw.length <= MAX_FORTSETZUNG ? raw : null;
}

/** Was eine Übernahme ergibt: die Antwort für die Leitung UND der Ausgang ihres Laufs. */
type UebernahmeAusgang =
  | {
      readonly code: 200;
      readonly body: Record<string, unknown>;
      readonly laufStatus: ImportRunStatus;
    }
  | {
      readonly code: 403 | 404 | 502;
      readonly body: { error: string; message: string };
      readonly laufStatus: "FAILED";
    };

/**
 * Die gewählten Kennungen abrufen und in die Prüf-Warteschlange stellen — der EINE Übernahmeweg,
 * den Tür 2 (Auswahl) und Tür 3 (Ordner-Los) teilen. `sourceScope` ist das Einzige, worin sie sich
 * unterscheiden: er sagt am Lauf, WAS übernommen werden sollte.
 */
async function fuehreUebernahmeAus(
  deps: SharePointImportRouteDeps,
  adapter: SharePointSourceAdapter,
  ids: readonly string[],
  userId: string,
  sourceScope: string,
  log: FastifyBaseLogger,
): Promise<UebernahmeAusgang> {
  // Die Kennung des Laufs steht ausserhalb des `try`, damit auch der Fehlerausgang sie kennt
  // und den Lauf nicht in QUEUED stehen lässt.
  let lauf: string | null = null;
  try {
    let eingereiht = 0;
    let bereitsInQueue = 0;
    const failed: { id: string; reason: string }[] = [];
    const notFound: string[] = [];
    const neuerStand: string[] = [];
    const dateien: Uebernommen[] = [];
    // JOB 4232: die Dateien, deren Inhalt gemessen wurde und nicht trägt — je Kennung mit dem
    // Befund, damit die Fläche den RICHTIGEN Satz zeigt und nicht einen Sammelsatz.
    const ohneInhalt: { id: string; befund: (typeof OHNE_INHALT)[number] }[] = [];
    // JOB 4125: der Stand der Warteschlange, wie er VOR diesem Aufruf war. Er muss vor dem
    // ersten eigenen Schreibeffekt gelesen werden — sonst sähe dieser Lauf die Vorgänge, die
    // er selbst gerade anlegt, und hielte jede Erstanlage für einen „neueren Stand".
    const staende = await leseStaende(deps.library, log);
    // DIE KENNUNG VOR DEM ERSTEN SCHREIBEFFEKT (KW-S4-26 §133, wie JOB 3288 es für den
    // Confluence-Weg hält): ab hier kann dieser Aufruf Kandidaten anlegen.
    lauf = await legeLaufAn(deps.importRuns, sourceScope, ids.length, log);
    for (const id of ids) {
      try {
        const eintrag = await adapter.holeItem(id);
        if (!eintrag) {
          notFound.push(id);
          continue;
        }
        const { item, inhalt } = eintrag;
        // JOB 4232 — DER EHRLICHE ABBRUCH, VOR DEM SCHREIBEFFEKT. Wer eine Textdatei wählt,
        // will ihren Text; ist er nachweislich nicht da (leer), passt er nicht (zu gross) oder
        // liess er sich nicht dekodieren (unlesbar), entsteht KEIN Eintrag. Ein Kandidat, der
        // nur den Dateinamen trägt, sähe in der Prüfung aus wie ein gelungener Inhaltsimport.
        if (istOhneInhalt(inhalt.art)) {
          ohneInhalt.push({ id, befund: inhalt.art });
          continue;
        }
        // JOB 4232 R2 — DERSELBE STAND IST SCHON IM BESTAND (bens Korrekturpflicht 3).
        // Wurde zu dieser Quelle bereits ein Vorgang ANGENOMMEN und daraus ein Wissensobjekt,
        // dann bringt dieselbe (oder eine ältere) Version nichts Neues. Sie wird deshalb nicht
        // noch einmal eingereiht, sondern als „schon vorhanden" gemeldet — genau der Satz, den
        // Lieferung 7 verlangt. Ein WIRKLICH neuerer Stand läuft unverändert weiter (W3b).
        const angenommenerStand =
          item.externalId === undefined
            ? undefined
            : staende.angenommen.get(importProviderKey(item.provider))?.get(item.externalId);
        if (angenommenerStand !== undefined && (item.sourceVersion ?? 1) <= angenommenerStand) {
          bereitsInQueue += 1;
          continue;
        }
        // R-0144 / R-0701: an die Kennung dieser Übernahme gebunden, Ordnung = Position der Kennung
        // im Auftrag — derselbe Weg wie Confluence `/apply` (`laufbindung.ts`). Damit hält der Lauf
        // je Datei die Quellrevision fest, und die Entscheidung schreibt ihre Elementreferenz, die
        // `GET /api/admin/import/runs/:importId/result` liest. Tragfähig erst, seit der Quellstand in
        // die Revisionsidentität passt (`services/sharepoint/src/mapper.ts`, Kopf).
        const angelegt = await deps.library.createImportCandidates(
          [item],
          userId,
          undefined,
          lauf !== null ? { lauf: { importId: lauf, ordinal: ids.indexOf(id) } } : {},
        );
        if (angelegt.length > 0) {
          eingereiht += 1;
          // JOB 4125: Stand dieser Übernahme gegen den Stand des Vorgangs, der zu DERSELBEN
          // Quelle schon offen wartete. Nur ein WIRKLICH höherer Stand ist ein neuer Stand;
          // ohne wartenden Vorgang ist es eine Erstanlage und hier ist nichts zu sagen.
          const vorher =
            item.externalId === undefined
              ? undefined
              : staende.offen.get(importProviderKey(item.provider))?.get(item.externalId);
          if (vorher !== undefined && (item.sourceVersion ?? 1) > vorher) {
            neuerStand.push(id);
          }
          dateien.push({
            id,
            name: item.title,
            url: item.url ?? null,
            geaendertAm: item.updatedAt ?? null,
            // Der Befund DIESES Abrufs. `bodyHtml` und er hängen zusammen (mapper.ts), also
            // ist das keine zweite Wahrheit über denselben Sachverhalt.
            inhalt: inhalt.art,
          });
        } else {
          bereitsInQueue += 1;
        }
      } catch (err) {
        const lage = sharepointFehlerlage(err);
        if (lage === "nicht-gefunden") {
          // Die Datei ist zwischen Auswahl und Übernahme verschwunden. Das ist kein Fehler
          // dieses Laufs, sondern eine Auskunft über die Quelle — und sie bekommt ihren
          // eigenen Ausgang, damit der Mensch den richtigen Satz liest.
          notFound.push(id);
          continue;
        }
        if (lage !== null) {
          // Eine Lage, die den GANZEN Lauf betrifft (kein Zugang, keine Berechtigung, nicht
          // erreichbar): weiterzumachen hiesse, dieselbe Antwort noch 49-mal zu holen.
          throw err;
        }
        // PII-frei: nur Kennung und Fehlerklasse, nie Inhalte.
        failed.push({ id, reason: err instanceof Error ? err.name : "unknown" });
      }
    }
    const bilanz: Uebernahmebilanz = {
      beauftragt: ids.length,
      eingereiht,
      bereitsInQueue,
      gescheitert: failed.length,
      nichtGefunden: notFound.length,
      ohneInhalt: ohneInhalt.length,
    };
    const laufStatus = uebernahmeStatus(bilanz);
    await schliesseLauf(
      deps.importRuns,
      lauf,
      {
        status: laufStatus,
        completedAt: new Date().toISOString(),
        ...(volumengrund(ohneInhalt) ?? {}),
        counters: uebernahmeZaehler(bilanz),
      },
      log,
    );
    return {
      code: 200,
      laufStatus,
      body: {
        imported: eingereiht,
        alreadyQueued: bereitsInQueue,
        // JOB 4125: die Teilmenge von `imported`, die einen NEUEREN Stand einer bereits
        // wartenden Quelle gebracht hat. Immer geführt — eine leere Liste ist die Auskunft
        // „kein solcher Fall", nicht ein fehlendes Feld.
        neuerStand,
        failed,
        notFound,
        // JOB 4232: Immer geführt — eine leere Liste ist die Auskunft „kein solcher Fall", nicht
        // ein fehlendes Feld (dieselbe Regel wie bei `neuerStand`).
        ohneInhalt,
        // Name, Originaladresse und Stand der WIRKLICH übernommenen Dateien — das Ergebnisbild
        // der Oberfläche liest genau das und erfindet nichts dazu.
        dateien,
        ...(lauf !== null ? { importId: lauf } : {}),
      },
    };
  } catch (err) {
    warne(log, "Uebernahme", err);
    const lage = sharepointFehlerlage(err);
    const ausgang = lage ? sharepointAntwort(lage) : sharepointAntwort("nicht-erreichbar");
    await schliesseLauf(
      deps.importRuns,
      lauf,
      {
        status: "FAILED",
        completedAt: new Date().toISOString(),
        failureCode: ausgang.error,
        failureReason: sanitizeImportFailureReason(
          MELDUNG[ausgang.error] ?? "SharePoint-Übernahme fehlgeschlagen.",
        ),
      },
      log,
    );
    return {
      code: ausgang.status,
      laufStatus: "FAILED",
      body: {
        error: ausgang.error,
        message: MELDUNG[ausgang.error] ?? "SharePoint-Übernahme fehlgeschlagen.",
      },
    };
  }
}

/** Ein Fehler aus dem Modul wird zur Antwort. Kein fremder Text, kein Statusdurchgriff. */
function sendeLage(reply: FastifyReply, err: unknown): FastifyReply {
  // `null` — der Fehler stammt gar nicht aus dem Modul — fällt ehrlich auf „nicht erreichbar":
  // was diese Anwendung nicht deuten kann, darf sie dem Menschen nicht als Diagnose verkaufen.
  const ausgang = sharepointAntwort(sharepointFehlerlage(err) ?? "nicht-erreichbar");
  reply.code(ausgang.status).send({
    error: ausgang.error,
    message: MELDUNG[ausgang.error] ?? "SharePoint-Abruf fehlgeschlagen.",
  });
  return reply;
}

/**
 * Legt den Übernahmelauf an — VOR dem ersten Schreibeffekt — und gibt seine Kennung.
 *
 * `null` heisst „ohne Spur weitermachen": entweder gibt es keine Laufablage (Tests, die diese
 * Routen ohne sie bauen), oder die Ablage hat den Lauf abgelehnt. Der zweite Fall wird GELOGGT,
 * nicht verschwiegen — und er bricht den Import nicht ab: ein Lauf ohne Spur ist schlecht,
 * verlorene Dateien wären schlimmer.
 */
async function legeLaufAn(
  importRuns: ImportRunRepo | undefined,
  sourceScope: string,
  beauftragt: number,
  log: FastifyBaseLogger,
): Promise<string | null> {
  if (!importRuns) {
    return null;
  }
  const importId = randomUUID();
  const lauf: ImportRun = {
    importId,
    sourceSystem: SYSTEM,
    externalId: null,
    // `pruefeImportRun` verlangt ein Quellobjekt ODER einen expliziten Scope. Eine Übernahme über
    // mehrere Dateien hat kein einzelnes Objekt, also trägt sie den Container — die Bibliothek,
    // beim Ordner-Los zusätzlich Ordner und Los (Tür 3). Das Laufwerk kommt vom ADAPTER und nicht
    // aus der Umgebung: der Adapter IST die Stelle, die weiss, gegen welches Laufwerk dieser Lauf
    // tatsächlich lief. Ein zweiter Umgebungsleser wäre eine zweite Wahrheit, die beim nächsten
    // Umbau still auseinanderliefe.
    sourceScope,
    requestedSourceVersion: null,
    status: "QUEUED",
    sourceRecordId: null,
    startedAt: new Date().toISOString(),
    completedAt: null,
    failureCode: null,
    failureReason: null,
    counters: {
      itemsTotal: beauftragt,
      itemsCreated: 0,
      itemsBound: 0,
      itemsSkipped: 0,
      itemsFailed: 0,
    },
  };
  try {
    await importRuns.insertIfAbsent(lauf);
    return importId;
  } catch (err) {
    warne(log, "Uebernahmelauf anlegen", err);
    return null;
  }
}

/** Schreibt den Ausgang fort. Ein Ablagefehler bricht die Übernahme NICHT ab. */
async function schliesseLauf(
  importRuns: ImportRunRepo | undefined,
  importId: string | null,
  fortschritt: Parameters<ImportRunRepo["advance"]>[1],
  log: FastifyBaseLogger,
): Promise<void> {
  if (!importRuns || importId === null) {
    return;
  }
  try {
    await importRuns.advance(importId, fortschritt);
  } catch (err) {
    // Der Lauf bleibt dann sichtbar in QUEUED stehen — hängend statt spurlos, wie beim
    // Confluence-Weg.
    warne(log, `Uebernahmelauf schreiben (${importId})`, err);
  }
}
