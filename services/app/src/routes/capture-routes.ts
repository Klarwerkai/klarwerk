import type { FastifyError, FastifyPluginAsync, FastifyReply, FastifyRequest } from "fastify";
// JOB 2671 D2: die erprobte Zip-Bibliothek statt eines eigenen Formatlesers (Begruendung bei
// `pruefeDocxZip`). `jszip` lag bisher nur transitiv unter `mammoth` im Baum — dieser Durchgang
// macht die Abhaengigkeit ausdruecklich (`package.json`), denn eine Bibliothek, gegen die
// Sicherheitscode steht, darf nicht davon abhaengen, dass ein anderes Paket sie mitbringt.
import JSZip from "jszip";
// JOB 2613 D3: DER DOM-FREIE DOCX-KERN, serverseitig genutzt. Der Pfad zeigt bewusst in
// `apps/web/src/lib` und nicht auf eine Kopie: `docx.ts` ist ausdrücklich DOM-frei gebaut
// (`docx.ts:1-4`), und `mammoth` löst NUR von dort aus auf (`apps/web/package.json:23`; im
// Wurzelpaket fehlt es — gemessen in JOB 2613 D3). Eine Kopie hier wäre ein zweiter
// Extraktionsweg und damit genau der Ablösefall, den Weg B vermeidet.
import {
  MAX_INLINE_BODY_HTML_BYTES,
  extractDocxRich,
  isDocxDocumentLike,
} from "../../../../apps/web/src/lib/docx";
import {
  type CaptureService,
  type Draft,
  type DraftPayload,
  validateDraftPayloadShape,
} from "../../../capture";
import {
  type KoService,
  alsMenge,
  alsSchreibpatch,
  createOperationFingerprint,
} from "../../../knowledge-object";
// JOB 2703 D2: DIE EINE Kuerzungsregel fuer die Kernaussage — dieselbe Funktion wie im
// Confluence-Mapper (services/confluence/src/mapper.ts). Der Server kuerzt; der Client nicht mehr.
import { kernaussageAusHtml, kernaussageAusKlartext } from "../../../structure";
import type { ValidationService } from "../../../validation";
import type { AiCheckWorker } from "../ai-check-worker";
import { type SemanticPrefilter, indexKoForDuplicatePrefilter } from "../duplicate-detection";
import { type Guards, type SessionUser, sendError } from "../http";
import type { AssignmentNotifier } from "../notify";

// AUFTRAG-mega19 Block B: EXPORTIERT, damit die Composition-Root den Entwurfs-Zugang der
// Dokumentübernahme (ko-routes, `DraftPromotionSource`) aus DERSELBEN Regel bildet. Zwei
// Auffassungen davon, wer einen Entwurf sehen darf, wären eine zu viel.
export function canSeeDraft(user: SessionUser, draft: Draft): boolean {
  return user.role === "admin" || draft.originalAuthor === user.id;
}

// ================================================================================================
// JOB 2703 D2 — EINE KUERZUNGSREGEL FUER BEIDE WEGE (BEN zu 2703 D1: „Confluence-Mapper und
// Word-Serverroute muessen dieselbe kanonische Kuerzungsfunktion aufrufen; bestehende
// Client-Kuerzungen sind zu entfernen oder ausdruecklich stillzulegen").
// ================================================================================================
// Bis hierher schnitt der Client die Aussage (`captureFrontDoor.ts` slice 500, `captureFromFile.ts`
// compactText 500, mitten im Wort), der Word-Serverweg (`/api/drafts/from-docx`) schnitt gar nicht,
// und der Confluence-Mapper schnitt seit 2703 D1 an der Satzgrenze — drei Fassungen derselben
// Regel. Jetzt gilt an JEDEM Serverweg, der eine Aussage annimmt, dieselbe Funktion:
//   · eine mitgelieferte Aussage wird kanonisch gekuerzt (bis KERNAUSSAGE_MAX, Satzgrenze, nie im
//     Wort — fuer kurze Aussagen ein Durchlauf ohne Aenderung);
//   · fehlt sie, entsteht sie aus dem ersten Block des Bodys (wie im Mapper), sonst aus dem Titel.
// Die Client-Kuerzungen sind stillgelegt (sie liefern die Rohaussage); der Word-Docx-Weg ruft die
// Funktion direkt (unten). Ein Paritaetstest (tests/capture/job2703-paritaet-beide-wege.test.ts)
// haelt Mapper und Serverroute zeichengenau gleich.
function mitKanonischerAussage<T extends Partial<DraftPayload>>(payload: T): T {
  if (typeof payload.statement !== "string") {
    return payload;
  }
  const gekuerzt =
    kernaussageAusKlartext(payload.statement) ||
    (typeof payload.bodyHtml === "string" ? kernaussageAusHtml(payload.bodyHtml) : "") ||
    (typeof payload.title === "string" ? payload.title : "");
  return gekuerzt === payload.statement ? payload : { ...payload, statement: gekuerzt };
}

function visibleDraftsFor(user: SessionUser, drafts: Draft[]): Draft[] {
  return user.role === "admin"
    ? drafts
    : drafts.filter((draft) => draft.originalAuthor === user.id);
}

async function requireVisibleDraft(
  capture: CaptureService,
  id: string,
  user: SessionUser,
  reply: FastifyReply,
): Promise<Draft | undefined> {
  const draft = await capture.getDraft(id);
  if (!draft) {
    reply.code(404).send({ error: "NOT_FOUND", message: "Entwurf nicht gefunden." });
    return undefined;
  }
  if (!canSeeDraft(user, draft)) {
    reply.code(403).send({ error: "FORBIDDEN", message: "Entwurf nicht verfuegbar." });
    return undefined;
  }
  return draft;
}

// WP-D1d (Pedi-Entscheid): expliziter bodyLimit für die Draft-schreibenden Routen (POST/PUT
// /api/drafts). Ceiling = 5 MiB — bewusst KLEIN (kleine Pre-Auth-Parser-Fläche; später erhöhbar),
// aber deutlich über dem 1-MiB-Default, damit ein Dokument-Import mit VIELEN clientseitig komprimierten
// Bildern durchgeht. Über dem Cap: kontrolliertes 413. bens ROT-Fix 3: die vergrößerte Parser-Fläche
// ist zusätzlich durch einen AUTH-Guard VOR dem Body-Parsing abgesichert (onRequest, s.
// requireAuthedBeforeParse) — ein anonymer Request wird mit 401 abgewiesen, BEVOR bis zu 5 MiB Body
// gelesen/geparst werden. 5 MiB ist ohnehin eine kleine Fläche; die Abwägung ist bewusst konservativ.
export const DRAFTS_BODY_LIMIT = 5 * 1024 * 1024; // 5 MiB

// ================================================================================================
// JOB 2613 D3 — DIE GANZE DATEI STATT DES HTML (Station 1 des Pedi-Pfads).
// ================================================================================================
//
// DER BEFUND, der diese Route nötig macht (Pedi hat es selbst geprüft, Panel-Stand 2026-08-28
// 01:41Z): „Wissen erfassen" überträgt KEINE Bilder. Der heutige Panelweg liest `body.getHtml()`
// — HTML OHNE Bildbytes — und holt die Bilder danach EINZELN über `body.inlinePictures` nach
// (`taskpane.html:3601-3619`). Genau dieses Nachholen liefert bei Pedi nichts.
//
// DER WEG: Das Panel holt stattdessen die GANZE `.docx` (`getFileAsync`, ein Zip MIT den Bildern)
// und schickt sie hierher. Diese Route verwandelt sie mit DEMSELBEN Kern, den der Konsolenweg
// nutzt (`extractDocxRich`), in `bodyHtml` — mammoth bettet die Bilder als `data:image` ein.
//
// WARUM DERSELBE KERN, und nicht ein zweiter: `docx.ts` ist ausdrücklich DOM-frei gebaut
// (`apps/web/src/lib/docx.ts:1-4`: „damit dieses Modul auch im Node-/Root-Typecheck und in Tests
// ohne DOM-lib geprüft werden kann"). Ein zweiter Extraktionsweg wäre ein Ablösefall — hier gibt
// es keinen: Konsole und Panel laufen ab jetzt durch dieselbe Funktion.
//
// DIE MODULAUFLÖSUNG IST DER GRUND FÜR DEN IMPORTPFAD, und sie ist gemessen (JOB 2613 D3,
// `machbarkeit.mjs`): `mammoth` steht in `apps/web/package.json`, NICHT im Wurzelpaket.
//     resolve("mammoth") von `apps/web/src/lib/docx.ts` aus  → gefunden
//     resolve("mammoth") von `services/app/src/routes/…` aus → MODULE_NOT_FOUND
// Node löst `import` relativ zur importierenden Datei auf. Deshalb MUSS der Aufruf über `docx.ts`
// laufen; ein `import("mammoth")` hier im Serverpaket schlüge fehl. Wer diesen Import „aufräumt",
// bricht die Bildübernahme.
export const DOCX_DRAFT_BODY_LIMIT = 30 * 1024 * 1024; // 30 MiB

// Die Grenze ist an `/api/objects` angelehnt (`object-routes.ts:59`, ebenfalls 30 MiB) und NICHT
// an `/api/drafts` (5 MiB): Eine `.docx` mit vielen Bildern ist das Original samt Bildbytes und
// sprengt die kleinere Grenze. Der Auth-Guard läuft wie dort VOR dem Body-Parsing.
export const DOCX_DRAFT_TOO_LARGE = "DOCX_DRAFT_TOO_LARGE";

const DOCX_DRAFT_TOO_LARGE_MESSAGE =
  "Das Dokument ist zu gross fuer die Uebernahme. Es wurde kein Entwurf angelegt und keine Bilder wurden uebernommen. Bitte das Dokument verkleinern oder in Teilen uebernehmen.";

// Derselbe enge Zuschnitt wie bei `/api/drafts`: NUR der Cap-Bruch wird übersetzt, jeder andere
// Fehler geht unverändert an Fastify zurück.
function docxDraftTooLargeErrorHandler(
  error: FastifyError,
  _request: FastifyRequest,
  reply: FastifyReply,
): void {
  if (error.code !== "FST_ERR_CTP_BODY_TOO_LARGE") {
    reply.send(error);
    return;
  }
  reply.code(413).send({
    error: DOCX_DRAFT_TOO_LARGE,
    message: DOCX_DRAFT_TOO_LARGE_MESSAGE,
    draftCreated: false,
    imageTransfer: "not_completed",
  });
}

/** Was das Panel schickt: die `.docx` als Base64 plus die Angaben, die es ohnehin kennt. */
export interface DocxDraftRequest {
  /** Dateiname, für Titel und Formatprüfung. */
  name?: string;
  /** Die `.docx`-Bytes, Base64-kodiert. */
  data: string;
  /** Titelvorschlag des Panels; ohne ihn wird der Dateiname genommen. */
  title?: string;
}

// Der Bildzähler zählt EINZELNE eingebettete Bilder — `data:image/…;base64,` je `<img>`. Er zählt
// nicht `<img>`-Tags: ein `<img src="https://…">` wäre kein übernommenes Bild.
const EINGEBETTETES_BILD = /<img[^>]+src="data:image\/[a-zA-Z0-9.+-]+;base64,/g;

export function zaehleEingebetteteBilder(html: string): number {
  return html.match(EINGEBETTETES_BILD)?.length ?? 0;
}

// ================================================================================================
// JOB 2671 D2 — DIE VORPRUEFUNG DER .docx, MIT EINER ERPROBTEN BIBLIOTHEK STATT EIGENEM PARSER.
// ================================================================================================
//
// D1 hat diese Pruefung gebaut, aber mit einem selbstgeschriebenen Leser des Zip-Zentral-
// verzeichnisses: rueckwaerts nach der EOCD-Signatur suchen, Offsets von Hand addieren, Felder aus
// Rohbytes ziehen. BENs Einwand dagegen ist der Grund fuer diesen Durchgang, und er ist richtig:
// Ein handgeschriebener Formatleser am Rand des Systems ist die schlechteste Stelle fuer eigenen
// Code. Er trifft ungeprueft jede fremde Datei, seine Randfaelle (Zip64, ein Kommentar am Ende,
// mehrteilige Archive, ein Data-Descriptor statt Header-Groessen) sind genau die, die ein
// Angreifer sucht — und keiner davon steht in einem Test, weil man an einen Randfall, den man
// nicht kennt, auch keinen Test schreibt. `jszip` liest dasselbe Format seit Jahren gegen die
// Dateien der Welt.
//
// WAS GEMESSEN WURDE, BEVOR DIESER CODE ENTSTAND (D1 hielt das fuer unmoeglich):
// `JSZip.loadAsync` liest das Zentralverzeichnis und legt je Eintrag ein `CompressedObject` an,
// das `uncompressedSize` und `compressedSize` bereits traegt — OHNE dass ein Eintrag entpackt
// waere. Entpackt wird erst bei `file.async(...)`, und das ruft diese Vorpruefung nie. Sonde:
// ein Archiv mit 200.000 Byte Inhalt kam auf 430 Byte gepackt und meldete danach
// `_data.uncompressedSize = 200000`, `_data.compressedSize = 212` — die Bombe faellt also an
// ihren eigenen Angaben, so wie D1 es wollte, nur ohne D1s Parser.
//
// DIE EINE EINSCHRAENKUNG, EHRLICH BENANNT: `uncompressedSize` steht in `_data` und damit an
// einem Feld ohne oeffentliche Zusage — jszip veroeffentlicht keinen Groessen-Zugang. Das ist der
// wahre Kern von D1s Einwand, und er verschwindet nicht dadurch, dass man ihn nicht erwaehnt.
// Der Unterschied zu D1 ist trotzdem entscheidend: Das FORMAT liest die erprobte Bibliothek, mein
// Code liest nur noch eine Zahl, die sie schon ermittelt hat. Faellt das Feld bei einem Upgrade
// weg, greift `groesseVon` fail-closed (siehe dort) — die Pruefung wird dann streng, nicht blind.
export const DOCX_ENTPACKT_MAX_BYTES = 200 * 1024 * 1024;
export const DOCX_MAX_ENTPACKVERHAELTNIS = 100;
export const DOCX_UMWANDLUNG_TIMEOUT_MS = 30_000;
export const DOCX_UNLESBAR_MESSAGE = "Die Datei ist kein lesbares Word-Dokument (.docx).";
export const DOCX_BUSY_MESSAGE = "Die Umwandlung dauert zu lange — bitte spaeter erneut.";

/**
 * JOB 2671 — DIE ABLEHNUNG NENNT DIE ZAHL, an der sie sich entschieden hat.
 *
 * „Zu gross" ohne Mass laesst den Menschen raten, ob er ein Bild entfernen muss oder das halbe
 * Dokument. Die genannte Groesse ist KEINE Innensicht des Servers: sie steht in der Datei, die der
 * Nutzer selbst geschickt hat. Die Grenze mitzunennen ist derselbe Gedanke wie bei
 * `DRAFT_BODY_TOO_LARGE_MESSAGE` — sagen, was gilt, statt nur abzulehnen.
 */
function alsMib(bytes: number): string {
  return `${Math.round((bytes / (1024 * 1024)) * 10) / 10} MiB`;
}

// JOB 2671 D3: Die Meldung nennt die Grenze, die WIRKLICH galt. Fest verdrahtet stuende in einem
// Lauf mit injizierter Testgrenze „erlaubt sind 200 MiB", waehrend bei 256 KiB abgebrochen wurde —
// eine Meldung, die den Leser in die Irre fuehrt, und sei es nur im Testprotokoll.
function docxZuGrossMessage(entpackt: number, grenze: number): string {
  return `Die Datei ist entpackt zu gross fuer die Uebernahme (${alsMib(entpackt)}, erlaubt sind ${alsMib(grenze)}). Es wurde kein Entwurf angelegt und keine Bilder wurden uebernommen.`;
}

// Der Verhaeltnisfall bleibt unter der Summengrenze und braucht deshalb seinen EIGENEN Satz: die
// Summenmeldung („erlaubt sind 200 MiB") waere hier schlicht falsch — sie nennt eine Grenze, die
// gar nicht gerissen wurde, und der Mensch verkleinert dann vergeblich.
function docxVerhaeltnisMessage(entpackt: number, gepackt: number, faktor: number): string {
  return `Die Datei ist entpackt zu gross fuer die Uebernahme: ${alsMib(entpackt)} aus ${alsMib(gepackt)} gepackt — mehr als das ${faktor}-fache. Es wurde kein Entwurf angelegt und keine Bilder wurden uebernommen.`;
}

export type DocxZipBefund =
  | { ok: true; entpackt: number; gepackt: number; eintraege: number }
  | {
      ok: false;
      status: 413 | 415;
      error: "PAYLOAD_TOO_LARGE" | "UNSUPPORTED_MEDIA_TYPE";
      message: string;
      /**
       * JOB 2671 D3 — WIE VIELE BYTES TATSAECHLICH DURCH DEN DEKOMPRIMIERER GELAUFEN SIND, bevor
       * abgebrochen wurde. Das ist keine Statistik, sondern die pruefbare Haelfte der Zusage
       * „ohne den Datenstrom unbeschraenkt zu materialisieren": Ohne diese Zahl kann ein Test nur
       * belegen, DASS abgewiesen wurde, nicht dass es rechtzeitig geschah. `0` heisst, dass gar
       * nichts entpackt wurde — der Fall, in dem schon die deklarierten Angaben ausreichten.
       */
      gemessen: number;
    };

/**
 * JOB 2671 D3 — DIE GRENZEN ALS PARAMETER, damit der adversariale Fall pruefbar wird.
 *
 * BEN verlangt ausdruecklich eine „niedrige injizierte Testgrenze". Der Grund ist praktisch: Um
 * eine echte Expansion ueber 200 MiB zu belegen, muesste ein Test 200 MiB durch den
 * Dekomprimierer schicken — das dauert und belastet den Rechner, gegen den dieses Projekt schon
 * zweimal verloren hat. Mit einer Grenze von 256 KiB ist derselbe Beweis in Millisekunden zu
 * fuehren.
 *
 * KEINE ZWEITE CODEBAHN: Es ist ein vorbelegter Parameter, kein Schalter. Der Betrieb laeuft
 * durch dieselbe Funktion mit denselben Zeilen, nur mit der Vorgabe.
 */
export interface DocxGrenzen {
  entpacktMax: number;
  verhaeltnisMax: number;
}

export const DOCX_GRENZEN_VORGABE: DocxGrenzen = {
  entpacktMax: DOCX_ENTPACKT_MAX_BYTES,
  verhaeltnisMax: DOCX_MAX_ENTPACKVERHAELTNIS,
};

/**
 * JOB 2671 D2 — die entpackte Groesse EINES Eintrags, fail-closed.
 *
 * `_data` ist jszip-intern (siehe Block oben). Deshalb wird hier nicht darauf vertraut, dass es da
 * ist: Fehlt die Zahl bei einem Eintrag, der kein Verzeichnis ist, liefert diese Funktion
 * `undefined` — und der Aufrufer LEHNT AB, statt die Datei ungeprueft durchzulassen. Eine
 * Vorpruefung, die bei fehlender Messung stillschweigend „passt schon" sagt, waere schlimmer als
 * keine: sie stuende im Code, im Test und im Bericht, und wuerde im Ernstfall nichts halten.
 */
function groesseVon(eintrag: unknown): number | undefined {
  const daten = (eintrag as { _data?: { uncompressedSize?: unknown } })._data;
  const roh = daten?.uncompressedSize;
  return typeof roh === "number" && Number.isFinite(roh) && roh >= 0 ? roh : undefined;
}

// ================================================================================================
// JOB 2671 D3 — DEN ANGABEN DER DATEI NICHT GLAUBEN.
// ================================================================================================
//
// DER BEFUND, der diesen Durchgang ausgeloest hat (BEN zu D2, PRODUKT ROT): Die Vorpruefung las
// die unkomprimierten Groessen aus dem Zentralverzeichnis — also aus DER DATEI, die sie pruefen
// soll. Wer eine Bombe baut, schreibt dort hin, was er will. Der Schutz fragte den Angreifer, ob
// der Angriff gefaehrlich sei.
//
// GEMESSEN, nicht argumentiert (D3-Sonden, in der Rueckgabe mit Ausgabe belegt):
//
//   Ein gueltiges Archiv mit 4 MiB Inhalt, dessen Groessenfelder auf 1.000 gefaelscht sind:
//     `loadAsync` nimmt es an; `_data.uncompressedSize` meldet 1000;
//     die D2-Pruefung haette 2.000 Byte summiert und die Datei durchgelassen.
//     Tatsaechlich entpackt: 4.194.304 Byte.
//
// WARUM JSZips EIGENE PRUEFUNG NICHT GENUEGT: jszip erkennt die Faelschung und wirft
// `uncompressed data size mismatch` — aber ERST NACH 4.194.304 Byte in 256 Chunks. Bis dahin ist
// alles durch den Dekomprimierer gelaufen. Fuer den Angreifer ist das kein Hindernis, sondern der
// Erfolg: Er wollte Rechenzeit binden, nicht ein gueltiges Ergebnis. Die Datei wird am Ende
// abgelehnt, der Aufwand ist trotzdem bezahlt.
//
// ============================ DIE STELLE, AN DER ABGEBROCHEN WIRD ==============================
//
// `strom.destroy()` in `zaehleEchteExpansion` — nicht am Ende einer Schleife, sondern im
// `data`-Ereignis, sobald die laufende Summe die Grenze reisst.
//
// WARUM `nodeStream(...)` UND NICHT `internalStream(...)`, und warum `destroy()` und nicht
// `pause()`: Das ist KEINE Stilfrage, sondern der Unterschied zwischen Schutz und Schein.
// GEMESSEN, beide im selben Lauf:
//
//     internalStream + pause()   ->  507 weitere Chunks NACH dem Abbruch  (8 MiB liefen durch)
//     nodeStream    + destroy()  ->    0 weitere Chunks NACH dem Abbruch
//
// `pause()` stoppt nur die ZUSTELLUNG, nicht das Entpacken. Ein Test auf die gezaehlte Summe waere
// damit gruen gewesen — die Zaehlung stoppt ja —, und der Schutz waere trotzdem keiner. Wer diese
// Zeilen „vereinfacht", muss zuerst diese Messung widerlegen.
//
// GEZAEHLT, NICHT GESAMMELT: Jeder Chunk wird nach dem Addieren verworfen. Der Speicherbedarf
// bleibt bei der Chunkgroesse (gemessen 16.384 Byte), unabhaengig davon, wie gross das Archiv
// entpackt waere.
type ExpansionsErgebnis =
  | { art: "gemessen"; summe: number }
  | { art: "ueber_grenze"; summe: number }
  | { art: "strom_kaputt"; summe: number };

async function zaehleEchteExpansion(archiv: JSZip, grenze: number): Promise<ExpansionsErgebnis> {
  const pfade: string[] = [];
  archiv.forEach((pfad, eintrag) => {
    if (!eintrag.dir) {
      pfade.push(pfad);
    }
  });

  // Die Summe laeuft ueber ALLE Eintraege: Eine Bombe, die sich auf zwanzig Dateien verteilt, ist
  // dieselbe Bombe. Je Eintrag zu pruefen liesse zwanzigmal die Grenze zu.
  let summe = 0;
  let kaputt = false;
  for (const pfad of pfade) {
    const eintrag = archiv.file(pfad);
    if (!eintrag) {
      continue;
    }
    const ausgang = await new Promise<"ende" | "grenze" | "fehler">((fertig) => {
      // jszip deklariert `NodeJS.ReadableStream`, das `destroy` nicht kennt; zur Laufzeit ist es
      // ein echter `Readable` (gemessen: 0 weitere Chunks nach `destroy()`). Statt das per Cast zu
      // BEHAUPTEN, wird es unten geprueft — ein Cast waere genau die Sorte Annahme, die diesen
      // Durchgang ausgeloest hat.
      const strom = eintrag.nodeStream("nodebuffer") as NodeJS.ReadableStream & {
        destroy?: () => void;
      };
      let beendet = false;
      const schliesse = (wie: "ende" | "grenze" | "fehler"): void => {
        if (beendet) {
          return;
        }
        beendet = true;
        fertig(wie);
      };
      if (typeof strom.destroy !== "function") {
        // FAIL-CLOSED: Ohne echten Abbruch laesst sich die Grenze nicht durchsetzen — die Datei
        // liefe sonst vollstaendig durch, waehrend die Zaehlung Schutz vortaeuschte. Dann lieber
        // ablehnen. Erreichbar nur, wenn ein jszip-Upgrade die Stromform aendert.
        schliesse("fehler");
        return;
      }
      strom.on("data", (chunk: Buffer) => {
        if (beendet) {
          return;
        }
        summe += chunk.length;
        if (summe > grenze) {
          // HIER wird abgebrochen — waehrend des Entpackens, nicht danach.
          strom.destroy?.();
          schliesse("grenze");
        }
      });
      // Der `error`-Handler ist Pflicht, nicht Hoeflichkeit: Ein Stromfehler ohne Handler beendet
      // den Node-Prozess. `destroy()` selbst kann einen nachziehen — er faellt dann auf `beendet`.
      strom.on("error", () => schliesse("fehler"));
      strom.on("end", () => schliesse("ende"));
    });
    if (ausgang === "grenze") {
      return { art: "ueber_grenze", summe };
    }
    if (ausgang === "fehler") {
      // Hierher faellt unter anderem jszips `uncompressed data size mismatch` — ein Archiv, das
      // ueber sich selbst luegt. Das ist eine kaputte Datei (415), keine Serverstoerung.
      //
      // ABER NICHT SOFORT ABBRECHEN, und das ist gemessen, nicht vorsichtshalber: Eine luegende
      // Datei laesst schon ihren ERSTEN, winzigen Eintrag scheitern (`[Content_Types].xml`, acht
      // Byte echt, tausend deklariert). Wer hier zurueckkehrt, beantwortet die Bombe im zweiten
      // Eintrag mit 415 statt mit 413 — im ersten Lauf dieses Durchgangs sind daran fuenf Faelle
      // gefallen, darunter zwei von BEN anerkannte.
      //
      // DIE GROESSENFRAGE HAT VORRANG vor der Konsistenzfrage: „zu gross" ist die schaerfere und
      // fuer den Menschen brauchbarere Auskunft. Deshalb wird weitergezaehlt und erst am Ende
      // entschieden.
      kaputt = true;
    }
  }
  return kaputt ? { art: "strom_kaputt", summe } : { art: "gemessen", summe };
}

/**
 * JOB 2671 D2 — VOR mammoth, ohne zu entpacken.
 *
 * Drei Fragen, in dieser Reihenfolge: Ist es ueberhaupt ein Zip? Sprengt es beim Entpacken die
 * Summengrenze oder das Verhaeltnis? Enthaelt es das eine Teil, ohne das keine .docx eine .docx
 * ist (`word/document.xml`)? Erst danach darf mammoth die Datei sehen.
 *
 * WARUM DIE SUMME UND DAS VERHAELTNIS: Die Summe allein hielte ein Archiv nicht auf, das knapp
 * unter 200 MiB bleibt, aber aus 2 KiB entsteht; das Verhaeltnis allein liesse ein sehr grosses,
 * schlecht gepacktes Archiv durch. Eine echte .docx reisst keine der beiden Grenzen: Text packt
 * gut, aber nicht 100:1, und Bilder (jpg/png) sind bereits komprimiert und druecken das
 * Verhaeltnis. Der Fall „gueltige, stark gepackte .docx geht durch" ist deshalb ein eigener Test.
 *
 * ASYNCHRON, und das ist keine Kosmetik: `loadAsync` ist der einzige Weg, auf dem jszip das
 * Zentralverzeichnis liest. Der synchrone Vorgaenger aus D1 war genau der Parser, der hier
 * verschwindet.
 */
export async function pruefeDocxZip(
  bytes: Buffer,
  grenzen: DocxGrenzen = DOCX_GRENZEN_VORGABE,
): Promise<DocxZipBefund> {
  const gepackt = bytes.byteLength;
  let archiv: JSZip;
  try {
    archiv = await JSZip.loadAsync(bytes);
  } catch {
    // Kein Zip, abgeschnitten, verschluesselt: das ist eine unlesbare Datei (415), keine
    // Serverstoerung (500). Der Grund wandert bewusst NICHT nach aussen — er saehe fuer den
    // Nutzer wie eine Innensicht aus und naehme einem Angreifer das Raten ab.
    return {
      ok: false,
      status: 415,
      error: "UNSUPPORTED_MEDIA_TYPE",
      message: DOCX_UNLESBAR_MESSAGE,
      gemessen: 0,
    };
  }

  // ---- SCHRITT 1 · DIE DEKLARIERTEN ANGABEN, als BILLIGE Vorabweisung ---------------------------
  //
  // Sie entscheiden nichts mehr allein — aber sie bleiben, und zwar aus einem sachlichen Grund:
  // Eine plumpe Bombe, die ihre 300 MiB ehrlich deklariert, faellt hier ohne ein einziges
  // entpacktes Byte. `gemessen: 0` sagt in der Antwort genau das. Wer diesen Schritt streicht,
  // schickt jede solche Datei erst durch den Dekomprimierer.
  //
  // WAS SIE NICHT MEHR IST: der Beweis. Der steht in Schritt 3.
  let deklariert = 0;
  let eintraege = 0;
  let ungemessen = false;
  archiv.forEach((_pfad, eintrag) => {
    if (eintrag.dir) {
      return; // Verzeichniseintraege tragen keinen Inhalt; sie zaehlen nicht mit.
    }
    eintraege += 1;
    const groesse = groesseVon(eintrag);
    if (groesse === undefined) {
      ungemessen = true;
      return;
    }
    deklariert += groesse;
  });

  // JOB 2671 D3 — HIER WURDE EINE ABLEHNUNG ZURUECKGENOMMEN, und das ist Absicht: In D2 fuehrte
  // eine fehlende Groessenangabe zu 415 („ohne Mass keine Freigabe"). Das war richtig, solange es
  // kein anderes Mass gab. Jetzt gibt es eines — Schritt 3 misst selbst. Eine Datei abzulehnen,
  // weil ein internes jszip-Feld fehlt, waere ab jetzt eine Strenge ohne Zweck.
  if (!ungemessen && deklariert > grenzen.entpacktMax) {
    return {
      ok: false,
      status: 413,
      error: "PAYLOAD_TOO_LARGE",
      message: docxZuGrossMessage(deklariert, grenzen.entpacktMax),
      gemessen: 0,
    };
  }

  // AUCH DAS VERHAELTNIS BLEIBT ALS VORFILTER, und das ist kein Rueckfall in D2: Wer ein Archiv
  // schickt, das SELBST 150 MiB aus 1 KiB behauptet, ist schon mit seiner Behauptung abzuweisen —
  // ob er dabei luegt oder nicht, aendert daran nichts, und geprueft wird es ohne ein einziges
  // entpacktes Byte. Die Wahrheitsprobe unten prueft dieselbe Grenze noch einmal an der
  // gemessenen Summe; erst sie macht den Schutz vollstaendig.
  if (!ungemessen && gepackt > 0 && deklariert / gepackt > grenzen.verhaeltnisMax) {
    return {
      ok: false,
      status: 413,
      error: "PAYLOAD_TOO_LARGE",
      message: docxVerhaeltnisMessage(deklariert, gepackt, grenzen.verhaeltnisMax),
      gemessen: 0,
    };
  }

  // ---- SCHRITT 2 · IST ES UEBERHAUPT EINE .docx -----------------------------------------------
  // Steht VOR der Messung, weil er nichts kostet: Ein Archiv ohne `word/document.xml` muss gar
  // nicht erst entpackt werden.
  if (archiv.file("word/document.xml") === null) {
    return {
      ok: false,
      status: 415,
      error: "UNSUPPORTED_MEDIA_TYPE",
      message: DOCX_UNLESBAR_MESSAGE,
      gemessen: 0,
    };
  }

  // ---- SCHRITT 3 · DIE TATSAECHLICHE EXPANSION, gezaehlt und abgebrochen -----------------------
  const expansion = await zaehleEchteExpansion(archiv, grenzen.entpacktMax);

  if (expansion.art === "ueber_grenze") {
    return {
      ok: false,
      status: 413,
      error: "PAYLOAD_TOO_LARGE",
      message: docxZuGrossMessage(expansion.summe, grenzen.entpacktMax),
      gemessen: expansion.summe,
    };
  }

  if (expansion.art === "strom_kaputt") {
    return {
      ok: false,
      status: 415,
      error: "UNSUPPORTED_MEDIA_TYPE",
      message: DOCX_UNLESBAR_MESSAGE,
      gemessen: expansion.summe,
    };
  }

  const entpackt = expansion.summe;

  // DAS VERHAELTNIS AN DER GEMESSENEN SUMME, nicht mehr an der deklarierten — sonst bliebe die
  // Haelfte des Befunds offen: Ein Archiv, das seine Groessen kleinredet, haette weiterhin ein
  // unauffaelliges Verhaeltnis vorgetaeuscht.
  //
  // Nur bei nicht-leerem Archiv, sonst waere es eine Division durch null.
  if (gepackt > 0 && entpackt / gepackt > grenzen.verhaeltnisMax) {
    return {
      ok: false,
      status: 413,
      error: "PAYLOAD_TOO_LARGE",
      message: docxVerhaeltnisMessage(entpackt, gepackt, grenzen.verhaeltnisMax),
      gemessen: entpackt,
    };
  }

  return { ok: true, entpackt, gepackt, eintraege };
}

// JOB 511 (schliesst den SERVERANTEIL von R5 aus JOB 506) — DIE ABLEHNUNG SAGT, WAS VERLOREN GING.
//
// Fastifys Standardantwort oberhalb des Caps lautet "Payload Too Large". Sie ist wahr und zugleich
// unbrauchbar: der Aufrufer erfaehrt NICHT, ob am Server bereits ein Entwurf entstanden ist und ob
// Bilder uebernommen wurden. Genau daran scheiterte das sichtbare Versprechen "nichts geht still
// verloren" (JOB 506, BEN-bestaetigt): aus einer generischen 413 laesst sich kein ehrlicher
// Verlustzustand bauen, die Oberflaeche muesste raten.
//
// DIE ANTWORT IST DESHALB MASCHINENLESBAR UND STABIL: eigener Fehlercode statt Fastify-Interna,
// draftCreated=false (der Body wurde nie geparst, der Handler lief nie, das Repository sah nie einen
// Create) und imageTransfer="not_completed" als ausdrueckliche Aussage ueber die Bilduebernahme. Die
// Feldmenge ist in drafts-body-limit.test.ts gepinnt: kein Rohstack, keine Groessenangabe, keine
// stille Drift.
export const DRAFT_BODY_TOO_LARGE = "DRAFT_BODY_TOO_LARGE";

const DRAFT_BODY_TOO_LARGE_MESSAGE =
  "Das Dokument ist zu gross fuer die Uebernahme. Es wurde kein Entwurf angelegt und keine Bilder wurden uebernommen. Bitte das Dokument verkleinern oder in Teilen uebernehmen.";

// ================================================================================================
// JOB 2697 — DER RUMPFTYP VON POST /api/drafts.
// ================================================================================================
//
// Er steht HIER und nicht in `DraftPayload`. Der Unterschied ist der ganze Punkt: `DraftPayload`
// ist der DOKUMENTINHALT — was darin steht, trägt `capture.toKoInput` beim Einreichen ins
// Wissensobjekt. Die Vorgangskennung ist dagegen TRANSPORT: sie sagt, WELCHER Klick das hier ist,
// und hat im Dokument nichts zu suchen. D1 ist genau daran gescheitert.
//
// `operationId` ist OPTIONAL. Ein Aufruf ohne sie verhält sich exakt wie bisher — die anderen
// Aufrufer der Route (Mobil, Offline-Queue, das Panel) hängen daran.
export type DraftCreateRequest = DraftPayload & { operationId?: string };

// Der routen-eigene Fehlerweg von POST /api/drafts — und er ist mit Absicht ENG: er greift
// AUSSCHLIESSLICH den Cap-Bruch ab (`FST_ERR_CTP_BODY_TOO_LARGE`, den Fastify wirft, wenn der Body
// DRAFTS_BODY_LIMIT reisst) und uebersetzt ihn in den oben beschriebenen Vertrag. Jeder ANDERE
// Fehler wird unveraendert an Fastifys Standardbehandlung zurueckgereicht (`reply.send(error)`):
// ein Formfehler bleibt der gewohnte 400, ein Fehler aus dem Routen-Handler bleibt das, was
// `sendError` daraus macht. Diese Enge ist der eigentliche Punkt — die Route bekommt EINE ehrliche
// 413-Antwort, keinen zweiten, abweichenden Fehlerkanal fuer alles Uebrige.
function draftBodyTooLargeErrorHandler(
  error: FastifyError,
  _request: FastifyRequest,
  reply: FastifyReply,
): void {
  if (error.code !== "FST_ERR_CTP_BODY_TOO_LARGE") {
    reply.send(error);
    return;
  }
  reply.code(413).send({
    error: DRAFT_BODY_TOO_LARGE,
    message: DRAFT_BODY_TOO_LARGE_MESSAGE,
    // Beides ist hier TATSACHE, nicht Vermutung: oberhalb des Caps bricht Fastify das Lesen des
    // Bodys ab, bevor der Routen-Handler laeuft. `capture.createDraft` wurde also nie gerufen, das
    // Repository sah keinen Create, und die Bilduebernahme hat nie begonnen.
    draftCreated: false,
    imageTransfer: "not_completed",
  });
}

// Entwürfe (§2.4 / FR-CAP). Admin sieht den gemeinsamen Pool; normale Nutzer nur eigene Entwürfe.
// Autor bleibt erhalten; Promote → KO.
export interface CaptureRoutesDeps {
  capture: CaptureService;
  ko: KoService;
  // SCRUM-395: Prüfer-Vorschlag beim Promote (Zuweisung + Benachrichtigung wie im Board).
  validation: ValidationService;
  notifyAssignment?: AssignmentNotifier;
  // Weg 3 (Feature-Flag): semantischer Vorfilter der Duplikat-Erkennung. Nur gesetzt, wenn aktiviert.
  semanticPrefilter?: SemanticPrefilter | undefined;
  // WP-SUBMIT-ASYNC (Pedis R3): die frühere synchrone Erkennung (conflicts/overlaps/reasoner-Deps)
  // ist aus dem Promote-Pfad heraus in den Hintergrund-Worker gewandert — der Worker kapselt
  // diese Abhängigkeiten jetzt selbst.
  aiCheckWorker?: AiCheckWorker | undefined;
  /**
   * JOB 2671 D2 — die Umwandlung als EINSETZBARE Abhaengigkeit, damit der Timeout pruefbar wird.
   *
   * Ohne sie gibt es keinen ehrlichen Test der 30-Sekunden-Grenze: `extractDocxRich` fest
   * verdrahtet hiesse, entweder 30 Sekunden echt zu warten (kein Test, eine Wartezeit) oder das
   * Modul global zu ersetzen (dann prueft der Test die Attrappe, nicht die Route). Eingesetzt wird
   * eine Umwandlung, die der Test steuert; im Betrieb bleibt es `extractDocxRich` — die Vorgabe
   * unten ist genau der Betriebsfall, sie kann nicht auseinanderlaufen.
   *
   * Die Form folgt `semanticPrefilter` und `aiCheckWorker` weiter oben: optional, mit Vorgabe im
   * Aufbau, kein zweiter Weg durch das Programm.
   */
  docxUmwandlung?: typeof extractDocxRich | undefined;
  /**
   * JOB 2671 D3 — die Grenzen der Vorpruefung, einsetzbar aus demselben Grund wie
   * `docxUmwandlung`: Der adversariale Nachweis braucht eine niedrige Schranke, sonst muesste er
   * 200 MiB durch den Dekomprimierer schicken, um zu zeigen, dass bei 200 MiB abgebrochen wird.
   * Im Betrieb bleibt es `DOCX_GRENZEN_VORGABE`.
   */
  docxGrenzen?: DocxGrenzen | undefined;
}

// ================================================================================================
// JOB 2684 D1 (Review R2-17) — ZWEI TABS, UND EIN ENTWURF IST WEG: der Stand reist mit.
// ================================================================================================
//
// `expectedUpdatedAt` ist der `updatedAt`-Wert, den der Client beim Laden gesehen hat. Nur ein
// nicht-leerer String zählt; alles andere heißt „kein Stand mitgeschickt" — dann gilt für diesen
// Aufrufer der alte Weg (Mobil, Offline-Warteschlange senden keinen). Ein Konflikt wird NICHT über
// `sendError` abgebildet: `DRAFT_STALE` steht nicht in `STATUS_BY_CODE` (http.ts, außerhalb dieser
// Lease) und fiele dort auf 400 — ein Eingabefehler ist es aber nicht. Die Antwort trägt
// `currentUpdatedAt`, damit der Client nach dem Neuladen weiß, wogegen er jetzt schreibt.
function erwarteterStand(wert: unknown): string | undefined {
  return typeof wert === "string" && wert.trim().length > 0 ? wert.trim() : undefined;
}

function antwortBeiVeraltetemStand(reply: FastifyReply, error: unknown): boolean {
  if (!error || typeof error !== "object" || !("code" in error)) {
    return false;
  }
  if ((error as { code: unknown }).code !== "DRAFT_STALE") {
    return false;
  }
  const current = (error as { currentUpdatedAt?: unknown }).currentUpdatedAt;
  reply.code(409).send({
    error: "DRAFT_STALE",
    message:
      error instanceof Error && error.message
        ? error.message
        : "Der Entwurf wurde inzwischen an anderer Stelle geändert. Bitte neu laden.",
    ...(typeof current === "string" ? { currentUpdatedAt: current } : {}),
  });
  return true;
}

export function captureRoutes(deps: CaptureRoutesDeps, guards: Guards): FastifyPluginAsync {
  const { capture, ko, validation, notifyAssignment, semanticPrefilter, aiCheckWorker } = deps;
  // JOB 2671 D2: EINE Entscheidung, beim Aufbau getroffen — nicht bei jeder Anfrage neu.
  const docxUmwandeln = deps.docxUmwandlung ?? extractDocxRich;
  const docxGrenzen = deps.docxGrenzen ?? DOCX_GRENZEN_VORGABE;

  // WP-D1d (bens ROT-Fix 3): AUTH VOR BODY-PARSING. Fastify parst den Body (bis DRAFTS_BODY_LIMIT) in
  // der preValidation/-Handler-Phase — VOR guards.requirePermission im Handler. Dieser onRequest-Hook
  // läuft VOR dem Parsing: ein anonymer/ungültiger Request wird sofort mit 401 abgewiesen, sodass die
  // vergrößerte Parser-Fläche nicht für eine anonyme Flut offensteht. Der Handler prüft danach zusätzlich
  // die konkrete Berechtigung (ko.create) — Defense-in-Depth.
  const requireAuthedBeforeParse = async (
    request: Parameters<Guards["requireUser"]>[0],
    reply: Parameters<Guards["requireUser"]>[1],
  ): Promise<void> => {
    // requireUser sendet bei fehlender/ungültiger Session 401. Fastify stoppt den Lifecycle dann anhand
    // reply.sent VOR dem Body-Parsing — die 5-MiB-Parser-Fläche steht anonym nicht offen.
    await guards.requireUser(request, reply);
  };

  // ==============================================================================================
  // JOB 2671 D1 (uebernommen aus PRO4s Klon, siehe UEBERNOMMENER FREMDSTAND in der Rueckgabe)
  // NEBENLAEUFIGKEIT 1 FUER DIE .docx-UMWANDLUNG.
  // ==============================================================================================
  //
  // Dasselbe Slot-MUSTER wie in `slides-routes.ts`: Claim ATOMAR im onRequest, VOR dem
  // Body-Parsing; Freigabe auf allen Pfaden ueber onResponse/onError/onRequestAbort, nur durch den
  // Halter; Settle-Pflicht — der Slot wird nie freigegeben, solange die Umwandlung noch laeuft.
  // Ein Timeout gibt dem Nutzer 503 BUSY, haelt den Slot aber bis mammoth fertig ist: mammoth
  // kennt kein Abort-Signal, ein zweiter Lauf daneben waere genau die Doppelbelastung, die der
  // Slot verhindert.
  let docxLaeuft = false;
  const docxHalter = new WeakSet<FastifyRequest>();
  let docxJob: Promise<unknown> | null = null;

  const docxFreigeben = async (request: FastifyRequest): Promise<void> => {
    if (!docxHalter.has(request)) {
      return;
    }
    const job = docxJob;
    if (job !== null) {
      try {
        await job;
      } catch {
        // Der Fehler der Umwandlung ist im Handler beantwortet; hier zaehlt nur das Settlement.
      }
    }
    if (!docxHalter.has(request)) {
      return; // ein konkurrierender Freigabepfad war schneller — kein Doppel-Release
    }
    docxHalter.delete(request);
    if (docxJob === job) {
      docxJob = null;
    }
    docxLaeuft = false;
  };

  const docxOnRequest = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const user = await guards.requireUser(request, reply);
    if (!user) {
      return;
    }
    if (request.raw.aborted || request.raw.destroyed) {
      reply.code(408).send({ error: "CLIENT_ABORTED", message: "Verbindung abgebrochen." });
      return;
    }
    // ATOMAR: Pruefung und Claim ohne await dazwischen — zwei Requests nehmen den Slot nie beide.
    if (docxLaeuft) {
      reply.code(503).header("retry-after", "30").send({
        error: "BUSY",
        message: DOCX_BUSY_MESSAGE,
      });
      return;
    }
    docxLaeuft = true;
    docxHalter.add(request);
  };

  return async (app) => {
    // JOB 2671 D1: Client-Abbruch ohne Antwort — der Slot faellt an den Halter zurueck
    // (Plugin-Scope; fuer alle anderen Requests dieses Plugins ist der Hook ein No-op, sie sind
    // nie Halter).
    app.addHook("onRequestAbort", async (request) => {
      await docxFreigeben(request);
    });
    app.get("/api/drafts", async (request, reply) => {
      const user = await guards.requirePermission("ko.create", request, reply);
      if (!user) {
        return;
      }
      // AUFTRAG-mega20 Block D: die LISTE ist der echte Fortsetzen-Weg (CaptureDraftList →
      // onResume arbeitet mit dem Objekt aus dieser Antwort, nicht mit einem zweiten GET). Sie
      // läuft deshalb durch DIESELBE Ankerprüfung wie die Einzelroute — sonst stünde „kein
      // Body-Resume ohne Anker" im Code und griffe in der Anwendung nie.
      // JOB 2696 (R2-33): Die Eingrenzung geschieht jetzt IN DER ABLAGE, nicht erst hier. Ein
      // Nicht-Admin bekommt nur noch seine eigenen Entwuerfe geladen; ein Admin unveraendert alle.
      //
      // `visibleDraftsFor` BLEIBT STEHEN, und das ist Absicht: Es ist und bleibt die Stelle, die
      // entscheidet, wer welchen Entwurf sieht. Die Vorfilterung ist eine Ersparnis, keine zweite
      // Regel — liefe sie je auseinander, faengt der Aufruf unten es ab. Eine Sichtbarkeitsregel
      // zu ersetzen, um Bytes zu sparen, waere der falsche Handel.
      const geprueft = await capture.listDraftsForResume(
        user.role === "admin" ? undefined : user.id,
      );
      reply.code(200).send(
        visibleDraftsFor(
          user,
          geprueft.map((eintrag) => eintrag.draft),
        ).map((draft) => {
          const fehlend = geprueft.find((e) => e.draft.id === draft.id)?.anchorsMissing ?? [];
          return fehlend.length > 0 ? { ...draft, anchorsMissing: fehlend } : draft;
        }),
      );
    });

    app.post<{ Body: DraftCreateRequest }>(
      "/api/drafts",
      {
        bodyLimit: DRAFTS_BODY_LIMIT,
        onRequest: requireAuthedBeforeParse,
        errorHandler: draftBodyTooLargeErrorHandler,
      },
      async (request, reply) => {
        const user = await guards.requirePermission("ko.create", request, reply);
        if (!user) {
          return;
        }
        // JOB 2690 D1 — DIE GESTALTPRUEFUNG STEHT AM RAND, NICHT IN DER TIEFE.
        //
        // Diese Route hatte ein `bodyLimit`, aber kein Schema: `request.body` ging ungesehen an
        // `createDraft`. Ein Rumpf mit `bodyHtml: 5` kam damit bis in den Pool — `sanitizeDraftPayload`
        // steigt bei `typeof payload.bodyHtml !== "string"` sofort aus (capture/src/service.ts:139-141),
        // saeubert also nicht und meldet auch nichts. Gemessen vor dieser Zeile: `201` mit
        // `"payload":{"title":"Kaputt","bodyHtml":5}` im Bestand.
        //
        // Es ist DIESELBE Pruefung, die der Promote-Zweig weiter unten schon fuehrt (:567) — keine
        // zweite Auslegung, die auseinanderlaufen koennte. Sie wirft nicht, sondern liefert eine
        // Meldung, die nach aussen darf.
        // ==========================================================================================
        // JOB 2697 — DER SCHLÜSSEL WIRD VOM RUMPF GETRENNT, BEVOR IRGENDETWAS ANGELEGT WIRD.
        // ==========================================================================================
        //
        // `operationId` ist TRANSPORT, kein Dokumentinhalt. Ginge sie mit in den Payload, trüge
        // `capture.toKoInput` sie beim Einreichen ins Wissensobjekt — der Fehler, an dem D1
        // gescheitert ist. Die Trennung steht deshalb VOR `validateDraftPayloadShape`: was danach
        // geprüft und gespeichert wird, hat den Schlüssel nie gesehen.
        const { operationId: rohSchluessel, ...nutzlast } = request.body ?? {};
        const gestalt = validateDraftPayloadShape(nutzlast);
        if (!gestalt.ok) {
          reply.code(400).send({ error: "BAD_REQUEST", message: gestalt.message });
          return;
        }
        // Ein Schlüssel, der kein nichtleerer Text ist, ist kein Schlüssel — dann läuft der
        // unveränderte Bestandspfad. Fail-closed in die harmlose Richtung: lieber keine
        // Wiederholungssicherheit als eine, die an einem Fantasiewert hängt.
        const vorgangsId =
          typeof rohSchluessel === "string" && rohSchluessel.trim().length > 0
            ? rohSchluessel
            : undefined;
        try {
          // JOB 2697: DIE ROUTE ÜBERSETZT NUR. Sie trifft keine eigene Entscheidung über
          // Wiederholung oder Konflikt und führt kein eigenes Register — der Dienst hat
          // entschieden, die Ablage hat serialisiert. `201` für den neu angelegten Entwurf, `200`
          // für denselben Vorgang noch einmal; der Abdruckkonflikt kommt als
          // `IDEMPOTENCY_PAYLOAD_MISMATCH` aus dem Dienst und wird von `sendError` auf 409
          // abgebildet (`http.ts:65`). Ohne Kennung ist `angelegt` immer `true` — der
          // Bestandspfad antwortet unverändert mit 201.
          const { draft, angelegt } = await capture.createDraftVorgang(
            // JOB 2703 D2: die Aussage geht kanonisch gekuerzt in die Ablage — eine Regel, ein Ort.
            mitKanonischerAussage(gestalt.payload),
            user.id,
            vorgangsId,
          );
          reply.code(angelegt ? 201 : 200).send(draft);
        } catch (error) {
          sendError(reply, error);
        }
      },
    );

    // ==========================================================================================
    // JOB 2613 D3 · POST /api/drafts/from-docx — die ganze Datei statt des HTML.
    // ==========================================================================================
    //
    // Nimmt die `.docx`-Bytes, verwandelt sie mit `extractDocxRich` (DERSELBE Kern wie der
    // Konsolenweg) in `bodyHtml` mit eingebetteten Bildern und legt darüber den Entwurf an.
    //
    // Die Antwort nennt die Bildzahl AUSDRÜCKLICH (`imagesEmbedded`), damit das Panel eine
    // ehrliche Meldung zeigen kann und nicht raten muss — „(n Bilder)" statt „fertig".
    app.post<{ Body: DocxDraftRequest }>(
      "/api/drafts/from-docx",
      {
        bodyLimit: DOCX_DRAFT_BODY_LIMIT,
        // JOB 2671 D1: der Slot-Claim ERSETZT `requireAuthedBeforeParse` nicht, er enthaelt ihn —
        // `docxOnRequest` ruft dieselbe `guards.requireUser` und weist anonym mit 401 ab, bevor
        // der Slot ueberhaupt beansprucht wird. Sonst koennte eine anonyme Flut den einen Platz
        // belegen, ohne je berechtigt zu sein.
        onRequest: docxOnRequest,
        onResponse: async (request: FastifyRequest): Promise<void> => {
          await docxFreigeben(request);
        },
        onError: async (request: FastifyRequest): Promise<void> => {
          await docxFreigeben(request);
        },
        errorHandler: docxDraftTooLargeErrorHandler,
      },
      async (request, reply) => {
        const user = await guards.requirePermission("ko.create", request, reply);
        if (!user) {
          return;
        }
        const { name, data, title } = request.body ?? ({} as DocxDraftRequest);
        if (typeof data !== "string" || data.length === 0) {
          reply
            .code(400)
            .send({ error: "BAD_REQUEST", message: "Es wurden keine Dokumentbytes uebergeben." });
          return;
        }
        // Nur `.docx`. Das alte Binärformat `.doc` liest mammoth nicht — eine ehrliche Absage ist
        // besser als ein leerer Entwurf.
        if (typeof name === "string" && name.length > 0 && !isDocxDocumentLike({ name })) {
          reply.code(415).send({
            error: "UNSUPPORTED_MEDIA_TYPE",
            message: "Nur .docx wird uebernommen. Es wurde kein Entwurf angelegt.",
          });
          return;
        }
        const bytes = Buffer.from(data, "base64");
        // JOB 2671 — DIE VORPRUEFUNG STEHT VOR mammoth, NICHT DANEBEN.
        //
        // Eine Zip-Bombe (300 MiB aus 1 KiB) faellt hier an ihren eigenen Groessenangaben, bevor
        // irgendetwas entpackt wird; ein Archiv ohne `word/document.xml` ist keine Serverstoerung,
        // sondern eine unlesbare Datei (415). Waere die Pruefung erst nach mammoth, haette der
        // Schaden bereits stattgefunden — dann pruefte sie nur noch das Ergebnis der Ueberlastung.
        const zip = await pruefeDocxZip(bytes, docxGrenzen);
        if (!zip.ok) {
          reply.code(zip.status).send({ error: zip.error, message: zip.message });
          return;
        }
        const puffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
        // JOB 2671 D1: die Umwandlung laeuft im Slot mit Timeout; ein mammoth-Fehler ist eine
        // kaputte Datei (415), kein 500. Nur der Entwurfs-Anlage-Fehler darunter bleibt bei
        // `sendError` — der ist wirklich ein Serverfehler.
        let reich: Awaited<ReturnType<typeof extractDocxRich>>;
        // Das Budget ist dasselbe wie im Konsolenweg (`docx.ts:379`): Bilder, die nicht mehr
        // hineinpassen, werden EHRLICH gezählt statt still verschluckt.
        const job = docxUmwandeln(puffer as ArrayBuffer, {
          imageBudgetBytes: MAX_INLINE_BODY_HTML_BYTES,
        });
        docxJob = job;
        let timer: NodeJS.Timeout | null = null;
        const timeout = new Promise<"timeout">((resolve) => {
          timer = setTimeout(() => resolve("timeout"), DOCX_UMWANDLUNG_TIMEOUT_MS);
          timer.unref?.();
        });
        try {
          const ausgang = await Promise.race([job.then((r) => ({ reich: r })), timeout]);
          if (ausgang === "timeout") {
            // Der Slot bleibt belegt, bis mammoth fertig ist (Settle-Pflicht in `docxFreigeben`);
            // der Nutzer wartet nicht darauf.
            reply.code(503).header("retry-after", "30").send({
              error: "BUSY",
              message: DOCX_BUSY_MESSAGE,
            });
            return;
          }
          reich = ausgang.reich;
        } catch (error) {
          request.log.warn(
            { reason: error instanceof Error ? error.name : "unknown" },
            "docx-convert-failed",
          );
          reply.code(415).send({ error: "UNSUPPORTED_MEDIA_TYPE", message: DOCX_UNLESBAR_MESSAGE });
          return;
        } finally {
          if (timer !== null) {
            clearTimeout(timer);
          }
        }
        try {
          const bodyHtml = reich.html;
          // WELCHE ZAHL DIE QUELLBILDER NENNT — und warum NICHT `reich.totalImages`:
          // Jenes Feld ist „aus Rueckwaertskompatibilitaet an den Budgetlauf gebunden"
          // (`docx.ts:657-658`) und bleibt 0, wenn ohne `mapImage` extrahiert wird. Der Vertrag
          // `imageTransfer` dagegen „zaehlt IMMER ehrlich" (ebenda).
          //
          // GEMESSEN, nicht gelesen (JOB 2613 D3, erster Testlauf): Bei einer .docx mit ZWEI
          // Bildern meldete `reich.totalImages` **0**, `reich.imageTransfer.totalImages` **2**.
          // Wer hier das falsche Feld nimmt, meldet dem Nutzer einen Bildverlust, den es nicht
          // gibt — oder verschweigt einen echten. Der Test W1 pinnt genau diese Wahl.
          const quellbilder = reich.imageTransfer.totalImages;
          // `exactOptionalPropertyTypes`: ein Feld fehlt entweder ganz oder trägt einen Wert —
          // ein ausdrückliches `undefined` ist hier ein Typfehler.
          const titelVorschlag = title ?? name?.replace(/\.docx$/i, "");
          const payload: DraftPayload = {
            ...(titelVorschlag ? { title: titelVorschlag } : {}),
            // JOB 2703 D2: der Word-Serverweg kuerzt mit DERSELBEN Funktion wie der Confluence-
            // Mapper — bis hierher ging `reich.text` ungekuerzt (30 KB) als Aussage in den Entwurf.
            statement: kernaussageAusKlartext(reich.text) || titelVorschlag || "",
            bodyHtml,
            origin: "word_addin",
            // JOB 512 (R5): die Zahl der Bilder in der QUELLDATEI, vor jedem Budgetabzug. Der
            // Client entscheidet damit fail-closed, ob etwas verloren ging.
            sourceImageCount: quellbilder,
          };
          const draft = await capture.createDraft(payload, user.id);
          // JOB 2912 D1 — DIE BILANZ WIRD AUF DEM STAND GEZOGEN, DER WIRKLICH GESPEICHERT WURDE.
          //
          // GEMESSEN, nicht gelesen: `createDraft` säubert `bodyHtml` mit dem Allowlist-Sanitizer
          // (`capture/src/service.ts:143` → `structure/src/sanitize.ts:106`). Der lässt als
          // `data:image` NUR png/jpeg/gif/webp durch. Ein Word-Bild im EMF/WMF-Format — der
          // Normalfall bei aus PDF/Excel/PowerPoint eingefügten Grafiken — wird dort STILL
          // verworfen; steht es in einer `figure`, bleibt allein die `figcaption` zurück.
          //
          // Wer wie bisher auf `reich.html` VOR dem Sanitizer zählt, meldet dem Panel „alles da",
          // während im Entwurf nichts mehr steht: `imagesEmbedded == imagesTotal`, also KEINE
          // Verlustmeldung. Genau daran ging Pedis Befund „nur Fußnoten kommen an" unbemerkt
          // vorbei. Gezählt wird deshalb auf `draft.payload.bodyHtml`.
          //
          // DAS BEHEBT DEN VERLUST NICHT — es macht ihn sichtbar. Die Rettung der EMF/WMF-Bilder
          // ist ein eigener Durchgang (JOB 2912 D2).
          const eingebettet = zaehleEingebetteteBilder(draft.payload.bodyHtml ?? "");
          reply.code(201).send({
            ...draft,
            // Die Bildbilanz reist mit der Antwort, nicht nur im Entwurf: das Panel meldet damit
            // „(n Bilder)", und ein Verlust ist an Ort und Stelle sichtbar.
            imagesEmbedded: eingebettet,
            imagesTotal: quellbilder,
            imagesDropped: reich.imageTransfer.droppedImageBudget,
          });
        } catch (error) {
          sendError(reply, error);
        }
      },
    );

    app.get<{ Params: { id: string } }>("/api/drafts/:id", async (request, reply) => {
      const user = await guards.requirePermission("ko.create", request, reply);
      if (!user) {
        return;
      }
      const draft = await requireVisibleDraft(capture, request.params.id, user, reply);
      if (!draft) {
        return;
      }
      // AUFTRAG-mega20 Block D: DAS FORTSETZEN LÄUFT ÜBER DIE ANKERPRÜFUNG.
      //
      // `requireVisibleDraft` bleibt die SICHTBARKEITS-Entscheidung (404/403) und wird davon nicht
      // berührt. Was hier dazukommt, ist die INHALTS-Entscheidung: beruft sich der Entwurf auf ein
      // gesichertes Original, das es nicht mehr gibt, kommt sein Body NICHT zurück — sonst stünde
      // übernommener Dokumenttext ohne Herkunft im Editor und ließe sich von dort einreichen.
      // Der Aufrufer erfährt in `anchorsMissing` ausdrücklich, welche Originale fehlen; die
      // ausgeschriebene Abwägung steht in capture/src/service.ts bei `resumeDraft`.
      const fortsetzung = await capture.resumeDraft(request.params.id);
      if (!fortsetzung) {
        reply.code(404).send({ error: "NOT_FOUND", message: "Entwurf nicht gefunden." });
        return;
      }
      reply
        .code(200)
        .send(
          fortsetzung.anchorsMissing.length > 0
            ? { ...fortsetzung.draft, anchorsMissing: fortsetzung.anchorsMissing }
            : fortsetzung.draft,
        );
    });

    // ============================================================================================
    // JOB 1171 D1 (KA8 Stufe 1a) — DIE AUSKUNFT UEBER DEN NAECHSTEN SINNVOLLEN SCHRITT.
    // ============================================================================================
    //
    // KEIN SICHTBARER NUTZEN. Diese Route ist der Datenlieferant, nicht die Karte. Es gibt heute
    // keinen Aufrufer: die Clientverdrahtung ist Stufe 1a-b und wartet auf die Integration von
    // JOB 1164 D1 (`apps/web/src/api/types.ts` traegt dort einen zweiten, nicht integrierten
    // Stand), die Web-Karte ist Stufe 1b, die Panel-Karte Stufe 2.
    //
    // REINE LESUNG, und das ist die Zusage: kein Schreibpfad, keine Nebenwirkung, kein neuer
    // gespeicherter Zustand. `anchorsMissing` wird ueber `verifyDraftAnchors` GELESEN, nicht
    // geaendert. Dieselbe Berechtigung und dieselbe Sichtbarkeitsentscheidung wie die uebrigen
    // Entwurfsrouten — eine zweite Auffassung davon, wer einen Entwurf sehen darf, waere eine zu
    // viel (s. `canSeeDraft` oben).
    //
    // DER LEERFALL LIEFERT EIN LEERES OBJEKT, nicht `null` und nicht einen leeren String: ist kein
    // Schritt ableitbar, FEHLT der Schluessel. Ein gesetztes Feld ohne Wert waere eine Auskunft,
    // die so aussieht, als haette jemand nachgedacht. Geprueft wird das entsprechend mit dem
    // `in`-Operator und nicht gegen `undefined`.
    app.get<{ Params: { id: string } }>(
      "/api/drafts/:id/naechster-schritt",
      async (request, reply) => {
        const user = await guards.requirePermission("ko.create", request, reply);
        if (!user) {
          return;
        }
        if (!(await requireVisibleDraft(capture, request.params.id, user, reply))) {
          return;
        }
        const schritt = await capture.naechsterSchrittFuerEntwurf(request.params.id);
        reply.code(200).send(schritt ? { naechsterSchritt: schritt } : {});
      },
    );

    app.put<{ Params: { id: string }; Body: DraftPayload & { expectedUpdatedAt?: unknown } }>(
      "/api/drafts/:id",
      // WP-D1c/WP-D1d: derselbe dokument-taugliche Cap + Auth-vor-Parsing wie POST — ein bildreicher
      // Entwurf wird auch beim Weiterbearbeiten/Speichern gesendet.
      { bodyLimit: DRAFTS_BODY_LIMIT, onRequest: requireAuthedBeforeParse },
      async (request, reply) => {
        const user = await guards.requirePermission("ko.create", request, reply);
        if (!user) {
          return;
        }
        // JOB 2690 D1 — dieselbe Pruefung wie bei POST, und hier wiegt sie schwerer.
        //
        // `continueDraft` merged den Rumpf ueber `Object.entries(changes)`
        // (capture/src/service.ts:381). Bei `null` wirft das einen TypeError, und der ging als
        // `{"error":"INTERNAL","message":"Unerwarteter Fehler."}` nach aussen — ein SERVERFEHLER
        // fuer eine Nutzereingabe. Genau diese Maskierung war der Befund; gemessen vor dieser Zeile.
        //
        // Die Pruefung laeuft VOR `requireVisibleDraft`: Ein formfehlerhafter Rumpf ist unabhaengig
        // davon falsch, ob der Entwurf existiert, und die Antwort soll die Eingabe benennen statt
        // nebenbei preiszugeben, welche Kennungen es gibt.
        const gestalt = validateDraftPayloadShape(request.body);
        if (!gestalt.ok) {
          reply.code(400).send({ error: "BAD_REQUEST", message: gestalt.message });
          return;
        }
        try {
          if (!(await requireVisibleDraft(capture, request.params.id, user, reply))) {
            return;
          }
          // JOB 2684 D1 (Review R2-17): `expectedUpdatedAt` ist KEIN Entwurfsfeld — es wird vor dem
          // Merge abgetrennt, sonst landete es als Nutzlast im Entwurf. Fehlt es, gilt der alte Weg.
          // (2684 D6: HINTER der Gestaltprüfung aus 2690, die Zusatzschlüssel unverändert durchreicht —
          // die Prüfung bleibt so, wie das Produkt sie hat; der Stand wird erst danach abgetrennt.)
          const { expectedUpdatedAt, ...payload } = gestalt.payload as DraftPayload & {
            expectedUpdatedAt?: unknown;
          };
          reply.code(200).send(
            await capture.continueDraft(
              request.params.id,
              // JOB 2703 D2: auch beim Speichern — sonst holte der Speicherweg die ungekuerzte
              // Rohaussage des Clients an der Anlage vorbei in die Ablage.
              mitKanonischerAussage(payload as DraftPayload),
              user.id,
              {
                expectedUpdatedAt: erwarteterStand(expectedUpdatedAt),
              },
            ),
          );
        } catch (error) {
          if (antwortBeiVeraltetemStand(reply, error)) {
            return;
          }
          sendError(reply, error);
        }
      },
    );

    app.delete<{ Params: { id: string } }>("/api/drafts/:id", async (request, reply) => {
      const user = await guards.requirePermission("ko.create", request, reply);
      if (!user) {
        return;
      }
      try {
        if (!(await requireVisibleDraft(capture, request.params.id, user, reply))) {
          return;
        }
        await capture.deleteDraft(request.params.id);
        reply.code(204).send();
      } catch (error) {
        sendError(reply, error);
      }
    });

    // FR-CAP-07: Entwurf → Wissensobjekt; Autor = Originalautor (in toKoInput gesetzt).
    // SCRUM-395: optionaler Prüfer-Vorschlag beim Einreichen — wie bei POST /api/kos
    // (dedupliziert, ohne den Einreicher selbst; Benachrichtigung über FR-VAL-07).
    // ==============================================================================================
    // AUFTRAG-mega22 Block H — DER PROMOTE-WEG ÜBERLEBT DEN ANTWORTVERLUST.
    // ==============================================================================================
    //
    // DER BEFUND. Ein Antwortverlust erzeugt hier kein Duplikat und keinen Inhaltsverlust — der
    // Entwurf ist weg, das Wissensobjekt steht. Der Nutzer sieht aber 404 für einen GELUNGENEN
    // Vorgang. Das ist derselbe Mangel, den mega21 Block B für den Dokumentweg geschlossen hat, eine
    // Tür weiter. ben stuft den Weg als Nach-VIP-2 ein, SOFERN er nicht Teil des VIP-2-Drehbuchs
    // ist. Er ist es: der manuelle Entwurfs-Promote gehört zum Rundgang.
    //
    // ES IST DERSELBE VERTRAG, NICHT EIN ZWEITER: derselbe Vorgangsschlüssel (`operationId`,
    // `OPERATION_ID_PATTERN`), derselbe Nachschlag VOR allem Veränderlichen, derselbe Eigentümer-
    // und Abdruckvergleich (`adoptCreatedKo`, drei Tore), dieselben Fehlercodes
    // (`CREATE_ANCHOR_TAKEN`, `CREATE_REPAIR_REQUIRED`, `IDEMPOTENCY_PAYLOAD_MISMATCH`).
    //
    // WAS NICHT ÜBERTRAGBAR WAR, einzeln benannt statt stillschweigend weggelassen:
    //
    //   1. `draftPayload` IST HIER OPTIONAL, auf dem Dokumentweg ist es Pflicht (mega22 Block C).
    //      Der Grund ist kein Nachlassen, sondern ein Unterschied im Vertrag: der Dokumentweg hat
    //      einen ZWEITEN Inhaltskanal (`create`) und musste deshalb erzwingen, dass der Abdruck
    //      überhaupt Inhalt sieht. Der Promote-Weg hat gar keinen Client-Inhaltskanal — sein Inhalt
    //      IST der adressierte Entwurf. Deshalb geht `draftId` in den Abdruck (dieselbe Antwort auf
    //      SB-D wie dort), und mitgeliefertes `draftPayload` geht zusätzlich hinein.
    //   2. ES GIBT KEINE KOMPENSIERENDE RÜCKNAHME und damit keinen `repair_required`, den DIESER
    //      Weg erzeugen könnte. `create` bleibt nach dem Insert bewusst untransaktional
    //      (WP-SHIP8-CLOSE-5); ein Zustand `repair_required` kann hier also nur von einem Objekt
    //      stammen, das der Dokumentweg hinterlassen hat. Das Tor wird trotzdem durchlaufen — es
    //      auszulassen hiesse, denselben Vorgang an zwei Türen verschieden zu beurteilen.
    //   3. `operationId` IST OPTIONAL, auf dem Dokumentweg ist es Pflicht. Ohne Schlüssel verhält
    //      sich die Route EXAKT wie vorher (kein Vorgang, kein Nachschlag, keine Adoption). Das ist
    //      eine bewusste Abwägung: `POST /api/drafts/:id/promote` ist ein länger bestehender
    //      öffentlicher Vertrag mit Aufrufern ausserhalb dieser Oberfläche, und ein hartes 400 für
    //      einen fehlenden Schlüssel bräche sie ohne Not. Der Preis ist benannt: wer ohne Schlüssel
    //      promotet, bekommt die alte Zusage — 404 nach Antwortverlust.
    //
    // ==============================================================================================
    // AUFTRAG-mega23 Block A — DIE KORREKTUR EINER BEHAUPTUNG, DIE HIER STAND.
    // ==============================================================================================
    //
    // AN DIESER STELLE STAND: „Die Oberfläche schickt ihn ausnahmslos (Capture.tsx,
    // CaptureFrontDoor.tsx)." FÜR DIE VORDERTÜR WAR DAS OBJEKTIV FALSCH. `CaptureFrontDoor.tsx`
    // verdrahtete `promoteDraft: (id) => endpoints.drafts.promote(id)`, und der Clientvertrag in
    // `lib/captureFrontDoor.ts` kannte nur `promoteDraft(id)` — weder Schlüssel noch Stand reisten
    // mit. Der Satz hat einen ungeprüften Zustand als geprüft aussehen lassen; das ist selbst ein
    // Befund und nicht nur der Rahmen eines Befundes.
    //
    // SEIT mega23 Block A schickt die Vordertür beides. Der Satz ist damit wahr — aber er bleibt
    // eine Behauptung ÜBER FREMDE DATEIEN, und genau daran ist er das erste Mal gescheitert. Er
    // steht deshalb nicht mehr allein hier, sondern ist GEPINNT: `tests/capture/promote-operation-
    // callers.test.ts` liest beide Aufrufstellen und schlägt fehl, sobald eine den Schlüssel
    // wieder weglässt.
    //
    // OB DER SCHLÜSSEL PFLICHT WERDEN SOLL: NEIN, nicht in dieser Runde — und der Grund ist ein
    // anderer als „es gibt noch einen Aufrufer". Auf DIESEM Weg kann ein fehlender Schlüssel
    // KEINE Dublette erzeugen: der Promote verbraucht einen ADRESSIERTEN Entwurf, und nach einem
    // gelungenen Lauf ist der weg — der Wiederholversuch scheitert an 404 statt ein zweites Objekt
    // anzulegen. Der Preis der Optionalität ist also eine unschöne Fehlermeldung, kein
    // Integritätsschaden. Auf dem Dokumentweg ist er Pflicht, weil `create` dort OHNE Entwurf
    // laufen kann und ein zweiter Lauf tatsächlich ein zweites Objekt erzeugte. Ein 400 hier
    // bräche demgegenüber jeden nicht-Oberflächen-Aufrufer dieser Route (der Bestand solcher
    // Aufrufer ist nicht inventarisiert) — acht Tage vor VIP-2, ohne Integritätsgewinn.
    app.post<{
      Params: { id: string };
      Body: {
        reviewerIds?: string[];
        operationId?: string;
        draftPayload?: DraftPayload;
        // JOB 2684 D1: der Stand, den der Client beim Laden gesehen hat — der Promote ist die
        // teuerste Stelle für einen stillen Überschreiber (das Wissensobjekt entstünde aus dem
        // alten Text). Optional, damit Aufrufer ohne Stand weiter funktionieren.
        expectedUpdatedAt?: unknown;
      } | null;
    }>(
      "/api/drafts/:id/promote",
      // JOB 2656 D4 — HIER ENDETE PEDIS WEG, und zwar bevor eine einzige Fachzeile lief.
      //
      // `POST /api/drafts` (Z. 245) und `PUT /api/drafts/:id` (Z. 415) tragen den
      // dokument-tauglichen Deckel seit WP-D1c/WP-D1d. Das Einreichen trug ihn NICHT — es blieb
      // auf Fastifys Vorgabe von 1 MiB. Ein bildreicher Entwurf liess sich damit anlegen und
      // speichern, aber nicht einreichen: Der Rumpf reist beim Promote MIT (der Stand geht hinter
      // dem serverseitigen Nachschlag, siehe `promoteDraft` in CaptureFrontDoor), und genau dort
      // wies ihn Fastify ab.
      //
      // GEMESSEN, nicht hergeleitet — am gedrueckten Knopf, vor diesem Fix:
      //   {"statusCode":413,"code":"FST_ERR_CTP_BODY_TOO_LARGE","error":"Payload Too Large"}
      // (tests/capture/job2656-d4-einreichen-knopf-mounted.test.tsx, Fall F1)
      //
      // `onRequest` steht aus demselben Grund hier wie an den beiden anderen Routen: AUTH VOR
      // BODY-PARSING. Ohne ihn laedt ein Unangemeldeter erst megabyteweise Rumpf hoch, bevor er
      // die Abweisung bekommt.
      { bodyLimit: DRAFTS_BODY_LIMIT, onRequest: requireAuthedBeforeParse },
      async (request, reply) => {
        const user = await guards.requirePermission("ko.create", request, reply);
        if (!user) {
          return;
        }
        try {
          const body = request.body ?? {};
          const operationId = typeof body.operationId === "string" ? body.operationId.trim() : "";
          // ------------------------------------------------------------------------------
          // DER NACHSCHLAG STEHT VOR ALLEM VERÄNDERLICHEN — und das ist hier keine Feinheit,
          // sondern der ganze Block: `requireVisibleDraft` unten antwortet nach einem gelungenen
          // ersten Lauf mit 404, weil der Entwurf dann GELÖSCHT ist. Stünde der Nachschlag darunter,
          // liefe die Adoptionsmechanik im echten Klickpfad ins Leere — genau der Fehler, den
          // mega21 Block B auf dem Dokumentweg beseitigt hat.
          // ------------------------------------------------------------------------------
          let fingerprint = "";
          if (operationId) {
            fingerprint = createOperationFingerprint({
              // AUFTRAG-mega22 Block C, hier ebenso: der Request VERBRAUCHT diesen Entwurf. Zwei
              // Anfragen, die verschiedene Entwürfe verbrauchen, sind nicht derselbe Vorgang.
              draftId: request.params.id,
              // K8 (document-create.ts): die Schreibladung semantiktreu, `fehlt` ≠ `leer`.
              inhalt: alsSchreibpatch(body.draftPayload ?? null),
              reviewerIds: alsMenge(body.reviewerIds),
              weg: "promote",
            });
            const replay = await ko.lookupDocumentCreate(operationId, {
              actor: user.id,
              fingerprint,
            });
            if (replay) {
              // 200 statt 201: derselbe Vorgang, aber das Objekt entsteht NICHT jetzt. Keine
              // Folgeschritte — sie liefen beim ersten Mal.
              reply.code(200).send(replay);
              return;
            }
          }
          if (!(await requireVisibleDraft(capture, request.params.id, user, reply))) {
            return;
          }
          // AUFTRAG-mega22 Block H: liegt ein Stand bei, wird er HIER geschrieben — im selben
          // Vorgang, hinter dem Nachschlag. Damit braucht die Oberfläche kein vorgeschaltetes
          // `PUT /api/drafts/:id` mehr, das nach einem gelungenen ersten Lauf mit 404 abfinge.
          // Die Gestaltprüfung läuft am RAND (mega22 Block D) — ein Formfehler wird hier 400 und
          // entsteht nicht in der Tiefe von `continueDraft`.
          // JOB 2684 D1: derselbe Standvergleich wie beim Speichern — VOR jedem Schreiben und vor
          // dem Wissensobjekt. Ein veralteter Tab bekommt 409 und legt nichts an.
          const expectedUpdatedAt = erwarteterStand(body.expectedUpdatedAt);
          if (body.draftPayload !== undefined) {
            const gestalt = validateDraftPayloadShape(body.draftPayload);
            if (!gestalt.ok) {
              reply.code(400).send({ error: "BAD_REQUEST", message: gestalt.message });
              return;
            }
            // JOB 2703 D2: der Einreichen-Weg schreibt den Stand mit — auch hier kanonisch gekuerzt,
            // sonst kaeme die Rohaussage der Vordertuer beim Einreichen ins Wissensobjekt.
            await capture.continueDraft(
              request.params.id,
              mitKanonischerAussage(gestalt.payload),
              user.id,
              {
                expectedUpdatedAt,
              },
            );
          } else if (expectedUpdatedAt !== undefined) {
            await capture.requireFresh(request.params.id, expectedUpdatedAt);
          }
          const input = await capture.toKoInput(request.params.id);
          // WP-RETEST7 R6: author IMMER aus einem echten Nutzer — normal der Originalautor des
          // Entwurfs (FR-CAP-07); trägt ein Altbestands-Entwurf KEINEN originalAuthor (leer),
          // wird ehrlich der EINREICHENDE Session-Nutzer gesetzt statt eines leeren author-Felds
          // (Pedis Befund: Validierungskarte ohne „von …").
          //
          // AUFTRAG-mega22 Block H: der VORGANG reist mit, wenn einer mitgeschickt wurde — und der
          // Eigentümer ist der EINREICHENDE Nutzer, nicht `input.author`. Das ist genau die Trennung
          // aus mega21 Block A: ein Admin darf einen fremden Entwurf einreichen; das Wissensobjekt
          // trägt dann den Originalautor, der VORGANG aber gehört dem Admin, der ihn gestartet hat.
          const created = await ko.create(
            { ...input, author: input.author.trim() ? input.author : user.id },
            ...(operationId
              ? ([{ id: operationId, actor: user.id, fingerprint }] as const)
              : ([] as const)),
          );
          await capture.deleteDraft(request.params.id);
          const reviewers = [...new Set(body.reviewerIds ?? [])].filter((id) => id !== user.id);
          if (reviewers.length > 0) {
            await validation.assign(created.id, reviewers, user.id);
            await notifyAssignment?.(created.id, reviewers);
          }
          // WP-SUBMIT-ASYNC (Pedis R3, 21.07.): wie beim direkten Einreichen — kein synchroner
          // detect*-Lauf mehr vor der Antwort; nur der Prüf-Job wird vermerkt und der Worker
          // arbeitet ihn danach ab (dieselben Erkennungs-Pfade, Status im Board sichtbar).
          // Wie in ko-routes: die 201-Antwort trägt den Vermerk ehrlich mit (aiCheck pending);
          // Nachlesen VOR dem enqueue → deterministischer Job-Start in der Antwort.
          let submitted = created;
          if (aiCheckWorker) {
            await ko.markAiCheckPending(created.id);
            submitted = (await ko.get(created.id)) ?? created;
            // WP-SHIP8-CLOSE-2 (bens F3): Zielversion des frischen Vermerks synchron mitgeben —
            // die Overflow-Eviction schließt hart versionsgebunden ab (kein unversionierter Write).
            aiCheckWorker.enqueue(created.id, submitted.aiCheck?.koVersion);
          }
          reply.code(201).send(submitted);
          // Weg 3 (B6): Einbettung + Ablage NACH der Antwort — der Nutzer wartet nie darauf. Flag aus
          // = No-op; Fehler brechen den (bereits gesendeten) Submit nie. await nur zur deterministischen
          // Fertigstellung der Ablage, nicht zur Client-Latenz (201 ist schon raus).
          await indexKoForDuplicatePrefilter(created, semanticPrefilter);
        } catch (error) {
          // JOB 2684 D1: ein veralteter Stand ist ein Konflikt, kein Eingabefehler — 409, und es ist
          // NICHTS entstanden (der Vergleich steht vor `continueDraft` und vor `ko.create`).
          if (antwortBeiVeraltetemStand(reply, error)) {
            return;
          }
          sendError(reply, error);
        }
      },
    );
  };
}
