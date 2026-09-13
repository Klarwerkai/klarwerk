// ================================================================================================
// JOB 3801 · DIE STRECKE DES ERSTEN NUTZERWEGS — EINMAL AM STÜCK, AN DER ECHTEN APP.
// ================================================================================================
//
// WOZU DIESE DATEI. Jedes EINZELNE Stück des ersten Demo-Wegs ist geprüft: der Startvertrag in
// `tests/demo-zugang-start/**`, der Import in `tests/capture/**`, die Suche in `tests/bibliothek*`.
// Was nirgends geprüft war, sind die ÜBERGÄNGE — ob das, was Schritt 3 hinterlässt, für Schritt 4
// reicht. Genau das und nur das fährt diese Strecke.
//
// WIE SIE GEBAUT IST:
//   · ECHTE APP, EIN PROZESS, KEIN BROWSER: `buildApp(buildServices())` und `app.inject` — derselbe
//     Weg, den `tests/ka5/markierung-fundstelle-bleibt.test.ts:23,38` geht. Es gibt hier KEINE neue
//     Chromium-Startstelle (die müsste in `tests/tor-inventar/tor-bestand-vollstaendig.test.ts`
//     nachgetragen werden, und das ist Zielpfad von JOB 3591).
//   · ECHTE ROUTEN IN DER REIHENFOLGE DER OBERFLÄCHE. Welche Adresse wann fällt, ist nicht erfunden,
//     sondern aus `apps/web/src/pages/Capture.tsx:1729-1760` gelesen: liegt ein ANKERDOKUMENT vor,
//     geht das Einreichen über `POST /api/kos/from-document` (ein Vorgang, Inhalt und Herkunft
//     gemeinsam) und NICHT über den Promote. Eine Strecke, die hier den Promote nähme, prüfte einen
//     Weg, den kein Nutzer geht.
//   · ECHTE QUELLDATEI: `tests/fixtures/sample.docx`, die Datei, mit der auch
//     `tests/capture/job2671-d2-jszip-vorpruefung.test.ts:46` arbeitet. Kein Attrappen-Objekt, keine
//     von Hand gebaute HTML-Zeichenkette.
//   · JEDER SCHRITT GIBT SEINE MESSUNG ZURÜCK, statt sie selbst zu beurteilen. Die Zusicherungen
//     stehen GESAMMELT in `pruefeStrecke` (durchstich.test.ts) — nur deshalb lässt sich §8 erfüllen:
//     dieselbe Prüffolge gegen eine Strecke fahren, der ein Schritt fehlt, und zeigen, dass sie
//     dann rot wird.
//
// WAS DIESE DATEI NICHT IST: kein Word (ein Testprozess ist keine Office-Ausführung), keine
// Demo-Instanz (es wird nichts bereitgestellt), keine Gastverwaltung (die Kontobefristung hat keine
// Adminfläche) und keine Vollständigkeit (EIN Weg, der häufigste — die nicht gefahrenen Abzweigungen
// stehen in der Rückgabe).
//
// RUNDE 2 — WAS BEN AN RUNDE 1 ZU RECHT ZERRISSEN HAT, und was sich dadurch hier geändert hat:
//   (1) Die Fortsetzung lief aus dem ALTEN Sitzungszustand (`eigeneFelder` wurde nach dem
//       Sitzungswechsel einfach wieder gesendet). Damit überbrückte die Strecke genau den
//       Datenverlust, den sie messen soll: ein Server, der beim Wiederöffnen die eigene Aussage
//       verliert, blieb grün. JETZT wird Schritt 5 AUSSCHLIESSLICH aus WIEDERGELADENEN Daten
//       gebaut — aus dem Eintrag der Entwurfsliste, weil die Oberfläche genau daraus fortsetzt —
//       und wo das nicht möglich war, sagt `fortsetzungAus`/`ankerQuelle` es als Messwert.
//   (2) Das Original wurde nur auf HTTP 200 geprüft, nicht auf seine BYTES. Ein Server, der andere
//       Bytes ausliefert, blieb grün. JETZT werden Länge und SHA-256 der heruntergeladenen Bytes
//       gegen die eingelesene Datei gehalten.
//   (3) Die Leermessung las Listen über `alsListe`, das ein Fehlerobjekt in `[]` verwandelt — eine
//       500er-Bestandsroute sah aus wie ein leerer Bestand. JETZT werden Status UND Antwortform
//       der beiden Bestandsrouten eigene Messwerte.
//
// JOB 3825 — WAS BEN AN RUNDE 2 NOCH FEHLTE: der Suchschritt bewies nichts über das DOKUMENT.
// `SUCHWORT` („Überdruck") steht auch im selbst getippten Titel und in der selbst getippten
// Aussage; der Treffer konnte also allein aus der eigenen Tipparbeit entstehen — der Dokumentinhalt
// hätte unterwegs verlorengehen können, und die Strecke wäre grün geblieben. Belegt hat das der
// Bestand selbst: der Lauf OHNE Dokument (D2) traf trotzdem. JETZT sucht die Strecke ZUSÄTZLICH mit
// `DOKUMENTWORT`, einem Wort, das ausschliesslich in der Quelldatei steht; ein Wächter misst diese
// Eigenschaft je Lauf am angelegten Objekt (`Isolation`), und die Flags aus dem gemeinsamen
// Suchvertrag belegen, dass der Treffer aus dem RUMPF kam (`Dokumenttreffer`). Der alte Suchschritt
// bleibt unverändert daneben — er misst den durchgehenden Faden, nicht die Dokumentsuche.
//
// JOB 3825 RUNDE 2 — WAS BEN AN RUNDE 1 ZU RECHT ZERRISSEN HAT: die neue NEGATIVMESSUNG war blind.
// „Nicht gefunden" wurde aus `alsListe` gelesen, und das macht aus jedem Fehlerobjekt eine leere
// Liste. Der Prüfer liess die Route mit HTTP 200 und `{error: …}` antworten — D2 und Ü1 blieben
// grün, obwohl gar keine Suche stattgefunden hatte. JETZT reisen Status, FORM und KÖRPER jeder
// Suchantwort als eigene Messwerte mit (`Suchantwort`, `liesSuchantwort`), für BEIDE Suchen; die
// Trefferbewertung darf erst gelesen werden, wenn Status und Form stimmen (`durchstich.test.ts`,
// `pruefeSuchantwort`).
//
// JOB 3849 — DIESELBE BLINDHEIT EINE SCHICHT TIEFER, und BEN hat sie selbst bestellt (Prüfpunkt 6
// zu 3825 R2): geprüft wurde, DASS eine Liste kam, nie, WAS darin steht. Gemessen am Stand vor
// dieser Runde, nicht vermutet:
//   · `[null]`                  → `liesSuchantwort` WARF `TypeError: Cannot read properties of null
//                                 (reading 'id')` (:831) — der Lauf starb an einer JS-Meldung, bevor
//                                 irgendeine Zusage greifen konnte. Genau das, was der Kommentar
//                                 unten ausgeschlossen zu haben glaubte.
//   · `["ko-1"]`, `[{}]`,       → `istListe: true`, `trifft: false`, alle Zusagen grün. Das gesuchte
//     `[{"id":""}]`,              Objekt stand bei `["ko-1"]` BUCHSTÄBLICH in der Antwort, und die
//     `[{"id":null}]`             Strecke las „nicht gefunden".
//   · `[{"id":"ko-1"},null]`    → `trifft: TRUE`. `.some` bricht beim ersten Treffer ab und sieht den
//                                 formlosen zweiten Eintrag nie: ein gültiger Eintrag HEILTE eine
//                                 kaputte Liste.
// JETZT ist die EINTRAGSFORM ein eigener Messwert neben Status und Listenform (`liesTrefferliste`,
// `Trefferliste`): ein Eintrag gilt nur als gültig, wenn er ein Objekt (nicht `null`, kein Array)
// mit nicht-leerer Zeichenketten-`id` ist. `trifft` wird ausschliesslich aus gültigen Einträgen
// berechnet und ist bei jeder formlosen Liste `false` — „konnte nicht bewertet werden" steht als
// eigener Messwert daneben (`eintraegeGueltig`/`eintragsFehlschlag`, mit Platz im Array und
// Istwert), damit es nicht dasselbe Feld belegt wie „nicht getroffen". Derselbe Prüfweg liest die
// `similar`-Liste des Live-Checks (`pruefungTrifft`), die an genau derselben Schwäche hing.
//
// JOB 3849 RUNDE 2 — UND DIE MELDUNG SELBST STARB NOCH. BEN prüfte die neue Fassung mit einem
// gültigen, tief verschachtelten Körper (`"[".repeat(10000)+"0"+"]".repeat(10000)`): `JSON.parse`
// nimmt ihn an, aber der Istwert in der Diagnose warf `RangeError: Maximum call stack size exceeded`
// (`istwertVon` → `liesTrefferliste` → `liesSuchantwort` → `fahreStrecke`). Die Zusage „wirft nie"
// war also für die BEWERTUNG eingelöst und für den BERICHT nicht — und ein Wächter, der beim Melden
// stirbt, sagt über die Suche genauso wenig wie einer, der still „nicht gefunden" behauptet. Eine
// Grenze, die erst NACH dem vollständigen Serialisieren kürzt, ist keine Grenze: `istwertVon`
// schreibt jetzt nur noch begrenzt tief, begrenzt breit und begrenzt lang, und die Fehlermeldung
// nennt höchstens `ISTWERT_MELDUNGEN` Plätze einzeln und zählt den Rest.
//
// JOB 3866 — DERSELBE SATZ FÜR OBJEKTE, und der Rest des nachträglichen Kürzens ist weg. Gemessen:
// 5000 Einträge mit zwölf Feldern über sechs Ebenen ergaben eine Meldung von 1761 Zeichen. Runde 2
// gab jedem genannten Platz nur noch `ISTWERT_JE_MELDUNG` Zeichen — aber unter dieser Aufteilung
// verbuchte `drucke` weiterhin keine Klammer, keinen Doppelpunkt und kein „…", und `istwertVon`
// schnitt das Ergebnis hinterher auf Mass. Seit Runde 3 (BEN Korrekturpflicht 1) bezahlt `drucke`
// JEDES ausgegebene Zeichen aus demselben Vorrat, und `istwertVon` schneidet nicht mehr nach.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { FastifyInstance } from "fastify";
import { type AppServices, buildApp, buildServices } from "../../services/app/src/build-app";
import type { KoSearchHit } from "../../services/knowledge-object";

/** Die echte Quelldatei aus dem Testbestand. Ihr einziger Satz steht in `QUELLSATZ`. */
export const QUELLDATEI = join(__dirname, "..", "fixtures", "sample.docx");
/**
 * Der Satz, der WIRKLICH in `sample.docx` steht (gemessen:
 * `unzip -p tests/fixtures/sample.docx word/document.xml`). Er ist der Faden durch die ganze
 * Strecke: was aus der Datei kommt, muss nach Speichern, Sitzungsneuaufbau und Anlage immer noch
 * dieser Satz sein — und nichts, was der Test selbst hineingeschrieben hat.
 */
export const QUELLSATZ = "Ventil bei Überdruck schließen.";
/**
 * DAS WORT DES DURCHGEHENDEN FADENS. Es steht im Quellsatz — aber AUCH im selbst getippten Titel
 * (`EIGENER_TITEL`) und in der selbst getippten Aussage (`EIGENE_AUSSAGE`). Ein Treffer darauf
 * belegt deshalb NICHT, dass der Dokumentinhalt die Strecke überlebt hat: er entstünde ebenso aus
 * der eigenen Tipparbeit. Was er belegt, ist der Faden als Ganzes — dass das Angelegte nach
 * Sitzungswechsel und Anlage überhaupt auffindbar ist.
 *
 * Der isolierte Nachweis für die DOKUMENTSUCHE steht daneben und heisst `DOKUMENTWORT`.
 * (Bis JOB 3825 stand hier „Es kommt NUR aus der Datei, nicht aus dem Titel." Das war in Runde 1
 * wahr und wurde von Runde 2 mit `EIGENER_TITEL`/`EIGENE_AUSSAGE` widerlegt, ohne berichtigt zu
 * werden — genau die Sorte Zusicherung, die ein Kommentar nicht tragen kann. Deshalb steht die
 * Eigenschaft jetzt als MESSUNG da, s. `Isolation`.)
 */
export const SUCHWORT = "Überdruck";

/**
 * DIE EIGENE ARBEIT DES MENSCHEN — der zweite Faden neben dem Dokumentinhalt, und der, den Runde 1
 * nicht verfolgt hat. Titel und Aussage tippt er selbst; sie stehen in KEINER Quelldatei. Wenn sie
 * den Sitzungswechsel nicht überleben, ist die Demo verloren, auch wenn der Dokumentinhalt zurückkommt.
 */
export const EIGENER_TITEL = "Ventil bei Überdruck";
export const EIGENE_AUSSAGE = "Bei Überdruck wird das Ventil geschlossen.";

/**
 * DAS ISOLIERTE DOKUMENTWORT (JOB 3825) — und der Unterschied zu `SUCHWORT` IST der Punkt.
 *
 * `SUCHWORT` steht im Quellsatz UND in den beiden selbst getippten Feldern. Die Trefferregel setzt
 * ihren Suchtext aus Titel + Aussage + Bildunterschrift + Dokumenttext zusammen
 * (`services/knowledge-object/src/search-projection.ts:758`) und prüft ihn mit
 * `lower.includes(term)` (`effective-search-document.ts:120-122`). Ein Wort aus dem Titel trifft
 * also OHNE JEDEN BEITRAG DES DOKUMENTS: ginge der Dokumentinhalt irgendwo auf der Strecke
 * verloren, bliebe der alte Suchschritt grün. Genau das war der blinde Fleck (BEN zu JOB 3801 R2,
 * Prüfpunkt 6) — und `durchstich.test.ts` hielt ihn sogar fest: der Lauf OHNE Dokument traf.
 *
 * `DOKUMENTWORT` steht AUSSCHLIESSLICH im Text der Quelldatei. „schließen" ist Teil von
 * `QUELLSATZ`; `EIGENER_TITEL` enthält es nicht, und `EIGENE_AUSSAGE` enthält „geschlossen" — was
 * für `includes` etwas anderes ist. Ein Treffer darauf kann nur aus dem Dokument stammen.
 *
 * DAS IST HIER KEINE ZUSICHERUNG PER KOMMENTAR. Die Eigenschaft wird je Lauf am TATSÄCHLICH
 * angelegten Objekt gemessen (`Isolation`, `messeIsolation`) — ein Kommentar hat sie schon einmal
 * überlebt, nachdem sie nicht mehr stimmte.
 */
export const DOKUMENTWORT = "schließen";

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

/** Das Konto, das die Demo anlegt. Eine eigene Adresse, damit nichts aus anderen Läufen mitspricht. */
const KONTO = {
  name: "Demo Gast",
  email: "gast@job3801.test",
  password: "vorfuehrung12345",
} as const;

/**
 * DIE AUSLASSUNG FÜR §8 (Red-first). Kein Schalter für Produktverhalten, sondern für die MESSUNG:
 * so lässt sich ein Schritt aus der Strecke nehmen und zeigen, dass die Prüffolge das merkt.
 *   · `"import"`            — die Quelle wird NICHT hereingebracht; der Entwurf entsteht leer über
 *                             `POST /api/drafts`, mit eigenem Text statt Dokumentinhalt.
 *   · `"quellensicherung"`  — der Entwurf beruft sich auf ein Original, das NIE gesichert wurde
 *                             (erfundene Objektkennung). Prüft den Übergang 4→5 am Ankertor.
 */
export type Auslassung = "import" | "quellensicherung";

/**
 * DIE VERFÄLSCHUNG FÜR DIE VERKABELUNG (JOB 3866, BEN zu 3849 R2: „ein dauerhafter HTTP-Gegenfall
 * würde zusätzlich dessen Verkabelung bewachen").
 *
 * WAS SIE VON EINER AUSLASSUNG UNTERSCHEIDET: eine Auslassung nimmt einen SCHRITT aus der Strecke,
 * diese hier verfälscht die ANTWORT einer Adresse. Gebraucht wird sie, weil die dauerhafte Probe aus
 * JOB 3849 (`durchstich.test.ts`, (xii)/(xv)) den LESER misst und nicht seine Verkabelung: dass die
 * Ähnlichkeitsliste des Live-Checks wirklich durch `liesTrefferliste` läuft, hing an einer
 * Verstellung, die BEN nach seiner Messung wieder zurückgenommen hat. Ein Fall, der bleibt, hält
 * auch das fest — nähme jemand den Leser aus `fahreStrecke` wieder heraus, käme `similar: ["ko-1"]`
 * erneut als „die Prüfung findet nichts" durch, und W3 wird rot.
 *
 *   · `"similar-formlos"` — `POST /api/knowledge/check` antwortet mit HTTP 200 und einer
 *     Ähnlichkeitsliste, deren Eintrag eine blosse Zeichenkette ist (`similar: ["ko-1"]`): die Form
 *     fehlt, das Gesuchte steht buchstäblich in der Antwort. Alle anderen Adressen bleiben
 *     unberührt, damit die rote Stelle die Ähnlichkeitsliste ist und nicht „irgendetwas ging schief".
 */
export type Verfaelschung = "similar-formlos";

/**
 * Setzt die Verfälschung als `onSend`-Hook auf GENAU eine Adresse. Callback-Stil, nicht `async` —
 * das ist die WP-E-Regel des Werks (`services/app/src/noindex-hook.ts:10`, Wächter
 * `services/app/src/sync-onsend-hooks.test.ts`): ein asynchroner onSend-Hook öffnet das
 * wrap-thenable-Doppel-Send-Fenster. Der Hook hängt an der ZWEITEN App eines Laufs und stirbt mit
 * ihr (`schliesse`) — er kann nichts hinterlassen, und `fahreStrecke()` ohne Option baut ihn nie.
 */
function verfaelscheAehnlichkeitsliste(app: FastifyInstance): void {
  app.addHook("onSend", (anfrage, antwort, rumpf, weiter) => {
    if (anfrage.url !== "/api/knowledge/check" || typeof rumpf !== "string") {
      weiter(null, rumpf);
      return;
    }
    let gelesen: Record<string, unknown>;
    try {
      gelesen = JSON.parse(rumpf) as Record<string, unknown>;
    } catch {
      // Kein JSON (etwa ein Fehlerblatt): dann gibt es keine Ähnlichkeitsliste zu verfälschen.
      weiter(null, rumpf);
      return;
    }
    // NUR die erfolgreiche Antwort mit Liste: die Anfrage OHNE Anmeldung (401) trägt keine und muss
    // ihre eigene Aussage behalten — sonst misst W3 zwei Dinge auf einmal.
    if (!Array.isArray(gelesen.similar)) {
      weiter(null, rumpf);
      return;
    }
    const verfaelscht = JSON.stringify({ ...gelesen, similar: ["ko-1"] });
    // Die Länge ändert sich; ohne diese Zeile schnitte `inject` den Körper an der alten Zahl ab.
    antwort.header("content-length", String(Buffer.byteLength(verfaelscht)));
    weiter(null, verfaelscht);
  });
}

export interface Schrittmessung {
  /** Wie der Schritt im Auftrag heisst. */
  readonly schritt: string;
  /** Welche Adresse gefallen ist — damit eine rote Stelle ohne Rätselraten auffindbar ist. */
  readonly weg: string;
  readonly status: number;
}

/**
 * WAS VON EINEM WIEDERGEÖFFNETEN ENTWURF WIRKLICH ZURÜCKKAM. Gelesen wird ausschliesslich aus der
 * Antwort des Servers — nichts hiervon stammt aus dem Zustand der alten Sitzung. Genau deshalb
 * taugt es als Messung: fehlt ein Feld oder ist es verändert, steht es hier falsch drin.
 */
export interface Wiedersehen {
  readonly titel: string;
  readonly aussage: string;
  /** Steht der Satz aus der Quelldatei noch im übernommenen Body? */
  readonly quellsatzDa: boolean;
  /** Die Kennungen der gesicherten Originale, die der Entwurf noch trägt (`anchorDocuments`). */
  readonly ankerObjekte: readonly string[];
  readonly ankerName: string;
  /** Die Kennungen, auf die die wartenden Belegstellen zeigen (`pendingSources[].objectId`). */
  readonly belegObjekte: readonly string[];
  readonly belegZitat: string;
}

/**
 * OB `DOKUMENTWORT` SEINEN NAMEN VERDIENT — gemessen, nicht behauptet (JOB 3825, Lieferung 2).
 *
 * Gelesen werden die Kurzfelder des TATSÄCHLICH ANGELEGTEN Objekts, so wie die Suche sie sieht
 * (`KoService.effectiveSearchDocumentOf`) — nicht die Konstanten dieser Datei nacherzählt. Sonst
 * prüfte der Wächter nur, was der Test ohnehin schon glaubt, und ein Produkt, das Titel oder
 * Kategorie anders projiziert als hier getippt, käme unbemerkt durch.
 */
export interface Isolation {
  /** Konnte überhaupt gemessen werden? Ohne angelegtes Objekt gibt es keine Felder zu lesen. */
  readonly gemessen: boolean;
  /** Der benannte Grund, wenn nicht gemessen werden konnte — sonst leer. */
  readonly fehlschlag: string;
  /** Steht das Wort im Satz aus der Quelldatei? Ohne das ist es kein Dokumentwort. */
  readonly imQuellsatz: boolean;
  /**
   * Die Kurzfelder des angelegten Objekts, in denen das Wort EBENFALLS steht. Leer ist der gute
   * Fall; jeder Eintrag hier macht einen Treffer als Dokumentbeleg wertlos.
   */
  readonly verletzteFelder: readonly string[];
}

/**
 * DER TREFFER EINE STUFE TIEFER (JOB 3825, Lieferung 4). `GET /api/library/search` liefert
 * `KnowledgeObject[]` (`services/app/src/routes/library-routes.ts:575`) — die `matched`-Flags
 * reisen dort NICHT mit. Ohne sie sagt ein Treffer nur „irgendein Feld passte"; die Frage der
 * Strecke ist aber „der RUMPF passte". Gefragt wird deshalb derselbe gemeinsame Suchvertrag
 * (`KoService.findSearchHits`, service.ts:1669), nicht eine im Test nachgebaute Trefferregel.
 */
export interface Dokumenttreffer {
  /** Wurde der Dienst überhaupt gefragt? Ohne angelegtes Objekt gibt es nichts zu fragen. */
  readonly gefragt: boolean;
  /** Kam ein Treffer auf `koId` zurück? */
  readonly gefunden: boolean;
  /** Der benannte Grund, wenn nicht gefragt oder nicht getroffen — sonst leer. */
  readonly fehlschlag: string;
  /**
   * Die `matched`-Flags, WÖRTLICH wie der Dienst sie lieferte. `undefined`, wenn es keinen Treffer
   * gab: ein fehlender Treffer wird nie in fünf `false` umgedeutet (Auftrag §9).
   */
  readonly flaggen: KoSearchHit["matched"] | undefined;
}

export interface Streckenbefund {
  /** Schritt 1 — ist der Stand leer, und sagt das Produkt es? */
  readonly leer: {
    readonly statusVorAnmeldung: number;
    readonly needsSetup: boolean;
    readonly wissensobjekte: number;
    readonly entwuerfe: number;
    // BEN (Prüflücke 6): „0 Einträge" und „die Route antwortete mit einem Fehler" sahen gleich aus.
    // Status und Antwortform stehen deshalb neben der Zahl, und beide werden zugesichert.
    readonly bestandStatus: number;
    readonly entwuerfeStatus: number;
    readonly bestandIstListe: boolean;
    readonly entwuerfeIstListe: boolean;
  };
  /** Schritt 2 — das kontrolliert angelegte Konto. */
  readonly konto: {
    readonly status: number;
    readonly rolle: string;
    readonly freigegeben: boolean;
    readonly needsSetupDanach: boolean;
    readonly zweiteEinrichtung: number;
  };
  /** Schritt 3 — die echte Quelle kommt herein. */
  readonly quelle: {
    readonly entwurfStatus: number;
    readonly entwurfId: string;
    readonly quellsatzImEntwurf: boolean;
    readonly objektStatus: number;
    readonly objektId: string;
    readonly objektName: string;
    /** Länge und SHA-256 der EINGELESENEN Datei — die Vergleichsgrösse für den Download in Schritt 5. */
    readonly laenge: number;
    readonly abdruck: string;
  };
  /** Schritt 4 — speichern, Sitzung neu aufbauen, wiederöffnen. */
  readonly entwurf: {
    readonly speichernStatus: number;
    readonly abmeldenStatus: number;
    /** Die ALTE Sitzung nach dem Abmelden — ein Neuaufbau, der nichts aufbaut, wäre keiner. */
    readonly alteSitzung: number;
    readonly zweiteAnmeldung: number;
    /** Dieselbe Sitzungskennung zweimal wäre kein Neuaufbau. */
    readonly sitzungTauschte: boolean;
    readonly wiederoeffnenStatus: number;
    readonly listeStatus: number;
    /** Was `GET /api/drafts/:id` zurückgab. */
    readonly einzel: Wiedersehen;
    /** Was der EINTRAG DER LISTE zurückgab — der Weg, den die Oberfläche wirklich geht. */
    readonly liste: Wiedersehen;
    readonly ankerFehlend: readonly string[];
    /** Steht er auch in der LISTE, aus der die Oberfläche fortsetzt? */
    readonly inListe: boolean;
    /**
     * WORAUS SCHRITT 5 SEINEN INHALT NAHM. `"liste"` ist der einzige Wert, den die Strecke gelten
     * lässt: dann stammt jedes Feld der Anlage aus dem, was der Server nach dem Sitzungswechsel
     * herausgegeben hat. `"einzel"` heisst, der Listenweg trug den Entwurf nicht; `"alt"` heisst,
     * es kam überhaupt nichts zurück und nur der Zustand der alten Sitzung war noch da.
     */
    readonly fortsetzungAus: "liste" | "einzel" | "alt";
  };
  /** Schritt 5 — erlaubte Prüfung, Suche, Quellenwiederaufruf. */
  readonly fund: {
    readonly anlageStatus: number;
    /** Der Fehlercode, wenn die Anlage NICHT gelang — leer, wenn sie gelang. */
    readonly anlageFehler: string;
    readonly koId: string;
    /**
     * WAS IM BESTAND LANDETE. Nicht die Ladung, die hingeschickt wurde, sondern das, was der Server
     * zurückgibt — die eigene Arbeit des Menschen am Ende der ganzen Kette.
     */
    readonly koTitel: string;
    readonly koAussage: string;
    /**
     * Kam der Ankerbeleg der Anlage aus WIEDERGELADENEN Daten (`"wiedergeladen"`) oder musste die
     * Strecke auf den Zustand der alten Sitzung zurückfallen (`"alt"`), weil der Entwurf seine
     * Herkunft nicht mehr trug?
     */
    readonly ankerQuelle: "wiedergeladen" | "alt";
    readonly pruefungStatus: number;
    readonly pruefungOhneAnmeldung: number;
    /**
     * TRUG DIE ÄHNLICHKEITSLISTE DES LIVE-CHECKS ÜBERHAUPT BEWERTBARE EINTRÄGE? (JOB 3849)
     * `similar: [null]` riss den Lauf bis hierher mit einem `TypeError` ab, `similar: ["ko-1"]`
     * ergab ein stilles `false` — dieselbe Schwäche wie bei den Suchen, nur an der Prüfroute.
     */
    readonly pruefungEintraegeGueltig: boolean;
    /** Platz und Istwert jedes formlosen `similar`-Eintrags — leer, wenn bewertbar. */
    readonly pruefungEintragsFehlschlag: string;
    /**
     * Findet die Prüfung das eben Angelegte wieder? (`similar` des Live-Checks) Berechnet nur aus
     * Einträgen gültiger Form; ohne `pruefungEintraegeGueltig` ist ein `false` hier keine Aussage.
     */
    readonly pruefungTrifft: boolean;
    /** Was die Prüfung über sich selbst sagt — „done" oder ehrlich „pending". */
    readonly pruefungStand: string;
    readonly sucheStatus: number;
    /**
     * KAM DIE ANTWORT ÜBERHAUPT ALS TREFFERLISTE? Siehe `Suchantwort` — ohne diesen Messwert ist
     * `sucheTrifft: false` keine Aussage über die Abwesenheit eines Treffers.
     */
    readonly sucheIstListe: boolean;
    /** Der Antwortkörper (gekürzt) — Diagnosematerial für eine rote Stelle, kein Prüfwert. */
    readonly sucheKoerper: string;
    /** UND KAMEN BEWERTBARE EINTRÄGE? (JOB 3849) Ohne das ist `sucheTrifft` keine Aussage. */
    readonly sucheEintraegeGueltig: boolean;
    readonly sucheEintragsFehlschlag: string;
    readonly sucheTrifft: boolean;
    /**
     * DIE ZWEITE SUCHE, mit `DOKUMENTWORT` (JOB 3825). Sie tritt NEBEN die erste, nicht an ihre
     * Stelle: die erste misst den durchgehenden Faden, diese den Beitrag des Dokuments.
     */
    readonly sucheDokumentStatus: number;
    readonly sucheDokumentIstListe: boolean;
    readonly sucheDokumentKoerper: string;
    readonly sucheDokumentEintraegeGueltig: boolean;
    readonly sucheDokumentEintragsFehlschlag: string;
    readonly sucheDokumentTrifft: boolean;
    /** Woher der Dokumenttreffer kam — Rumpf oder Kurzfeld. Siehe `Dokumenttreffer`. */
    readonly dokumentTreffer: Dokumenttreffer;
    readonly belegObjektId: string;
    readonly quelleStatus: number;
    readonly quelleName: string;
    readonly rohbytesStatus: number;
    /**
     * DIE HERUNTERGELADENEN BYTES SELBST — Länge und SHA-256. BEN (Korrekturpflicht 2): ein
     * HTTP 200 sagt nur, dass irgendetwas kam. Erst der Vergleich mit `quelle.laenge`/`quelle.abdruck`
     * sagt, dass es DIE DATEI war, die der Mensch in Schritt 3 hereingebracht hat.
     */
    readonly rohLaenge: number;
    readonly rohAbdruck: string;
  };
  /**
   * DIE VORAUSSETZUNG JEDER AUSSAGE ÜBER DIE DOKUMENTSUCHE. Steht hier etwas drin, ist
   * `fund.sucheDokumentTrifft` kein Dokumentbeleg mehr — deshalb wird sie VOR den Suchzusagen
   * geprüft und nicht daneben.
   */
  readonly isolation: Isolation;
  readonly verlauf: readonly Schrittmessung[];
}

interface Lauf {
  readonly app: FastifyInstance;
  readonly zweiteApp: FastifyInstance;
  readonly befund: Streckenbefund;
}

/**
 * Fährt die fünf Schritte am Stück. Sie URTEILT NICHT — sie misst und gibt zurück. Wirft nur, wenn
 * ein Schritt gar keine verwertbare Auskunft liefert (dann ist die Strecke an dieser Stelle zu Ende,
 * und das ist selbst die Auskunft).
 *
 * Der Aufrufer schliesst beide Apps (`schliesse`).
 */
export async function fahreStrecke(
  opt: { ohne?: Auslassung; verfaelsche?: Verfaelschung } = {},
): Promise<Lauf> {
  const verlauf: Schrittmessung[] = [];
  const merke = (schritt: string, weg: string, status: number): void => {
    verlauf.push({ schritt, weg, status });
  };

  // Ein EIGENER Dienstsatz je Lauf: der Bestand ist damit wirklich isoliert, und „leer" ist keine
  // Annahme über die Reihenfolge der Testdateien.
  const services = buildServices();
  const app = buildApp(services);
  await app.ready();

  // ---- SCHRITT 1 · DIE LEERE ERSTEINRICHTUNG ---------------------------------------------------
  // Die erste Auskunft kommt OHNE Anmeldung — anders ginge es auf einer leeren Installation auch
  // nicht, es gibt noch kein Konto. Genau das ist die Auskunft, die das Produkt geben muss.
  const status1 = await app.inject({ method: "GET", url: "/api/auth/status" });
  merke("1 leer", "GET /api/auth/status", status1.statusCode);
  const statusKörper = status1.json() as { needsSetup?: boolean };
  // Und die Gegenrichtung: ohne Konto gibt der Bestand NICHTS heraus. Ein leerer Bestand, der
  // unangemeldet lesbar wäre, wäre die schlechtere Leere.
  const bestandAnonym = await app.inject({ method: "GET", url: "/api/kos" });
  merke("1 leer", "GET /api/kos (ohne Anmeldung)", bestandAnonym.statusCode);

  // ---- SCHRITT 2 · DAS KONTO -------------------------------------------------------------------
  // `POST /api/auth/setup` ist die Ersteinrichtung des Produkts (services/auth/src/routes.ts:579) —
  // nicht `register`. Sie legt das erste Konto an UND startet die Sitzung in einem Zug.
  const einrichten = await app.inject({ method: "POST", url: "/api/auth/setup", payload: KONTO });
  merke("2 konto", "POST /api/auth/setup", einrichten.statusCode);
  const kontoKörper = einrichten.json() as { user?: { role?: string; approved?: boolean } };
  const keks = ersterKeks(einrichten.headers["set-cookie"]);
  const status2 = await app.inject({ method: "GET", url: "/api/auth/status" });
  // Die zweite Ersteinrichtung darf es nicht geben — sonst wäre „Konto kontrolliert angelegt" eine
  // Behauptung ohne Kontrolle.
  const zweiteEinrichtung = await app.inject({
    method: "POST",
    url: "/api/auth/setup",
    payload: { ...KONTO, email: "zweiter@job3801.test" },
  });
  merke("2 konto", "POST /api/auth/setup (zweites Mal)", zweiteEinrichtung.statusCode);
  const angemeldet = { cookie: keks };
  const bestand = await app.inject({ method: "GET", url: "/api/kos", headers: angemeldet });
  const entwuerfe = await app.inject({ method: "GET", url: "/api/drafts", headers: angemeldet });
  merke("1 leer", "GET /api/kos (angemeldet)", bestand.statusCode);
  merke("1 leer", "GET /api/drafts (angemeldet)", entwuerfe.statusCode);

  // ---- SCHRITT 3 · DIE ECHTE QUELLE KOMMT HEREIN -----------------------------------------------
  const bytes = readFileSync(QUELLDATEI);
  let entwurfStatus: number;
  let entwurfId: string;
  let quellsatzImEntwurf: boolean;
  if (opt.ohne === "import") {
    // DIE AUSLASSUNG FÜR §8: kein Dokument, nur ein leerer Entwurf mit eigenem Text. Alles Weitere
    // läuft unverändert — die Strecke soll an der MESSUNG scheitern, nicht an einem Abbruch.
    const ersatz = await app.inject({
      method: "POST",
      url: "/api/drafts",
      headers: angemeldet,
      payload: { title: "Ohne Quelle", statement: "Von Hand getippt, ohne Dokument." },
    });
    entwurfStatus = ersatz.statusCode;
    entwurfId = String((ersatz.json() as { id?: string }).id ?? "");
    quellsatzImEntwurf = false;
    merke("3 quelle", "POST /api/drafts (Auslassung: kein Import)", ersatz.statusCode);
  } else {
    const aus = await app.inject({
      method: "POST",
      url: "/api/drafts/from-docx",
      headers: angemeldet,
      payload: { name: "sample.docx", data: bytes.toString("base64") },
    });
    entwurfStatus = aus.statusCode;
    const körper = aus.json() as { id?: string; payload?: { bodyHtml?: string | null } };
    entwurfId = String(körper.id ?? "");
    quellsatzImEntwurf = (körper.payload?.bodyHtml ?? "").includes(QUELLSATZ);
    merke("3 quelle", "POST /api/drafts/from-docx", aus.statusCode);
  }
  if (!entwurfId) {
    throw new Error(`Schritt 3 lieferte keine Entwurfskennung (Status ${entwurfStatus}).`);
  }

  // Das ORIGINAL wird gesichert — `purpose: "anchor"`, genau wie die Oberfläche es tut
  // (`apps/web/src/lib/captureAttachments.ts:284`). Ohne dieses Objekt gibt es später keine Quelle,
  // auf die man zurückgreifen kann.
  let objektStatus = 0;
  let objektId = "erfunden-nie-gesichert";
  let objektName = "";
  if (opt.ohne !== "quellensicherung") {
    const hoch = await app.inject({
      method: "POST",
      url: "/api/objects",
      headers: angemeldet,
      payload: {
        name: "sample.docx",
        mime: DOCX_MIME,
        data: `data:${DOCX_MIME};base64,${bytes.toString("base64")}`,
        kind: "document",
        purpose: "anchor",
        draftId: entwurfId,
      },
    });
    objektStatus = hoch.statusCode;
    const ref = hoch.json() as { id?: string; name?: string };
    objektId = String(ref.id ?? "");
    objektName = String(ref.name ?? "");
    merke("3 quelle", "POST /api/objects (purpose anchor)", hoch.statusCode);
    if (!objektId) {
      throw new Error(`Die Quelle wurde nicht gesichert (Status ${objektStatus}).`);
    }
  } else {
    merke("3 quelle", "POST /api/objects (Auslassung: nicht gesichert)", 0);
  }

  // ---- SCHRITT 4 · SPEICHERN, WEGGEHEN, WIEDERKOMMEN -------------------------------------------
  // Der Mensch schreibt seine eigenen Felder dazu und verknüpft die Belegstelle mit dem Original.
  // `anchorKey` ist die Brücke INNERHALB des Entwurfs, `objectId` die einzige prüfbare Angabe
  // (services/capture/src/types.ts:52-81).
  const eigeneFelder = {
    title: EIGENER_TITEL,
    statement: EIGENE_AUSSAGE,
    type: "best_practice",
    category: "Wartung",
    confidentiality: "intern",
    pendingSources: [
      { label: "sample.docx", excerpt: QUELLSATZ, anchorKey: "anker-1", objectId: objektId },
    ],
    anchorDocuments: [{ key: "anker-1", objectId: objektId, name: "sample.docx", mime: DOCX_MIME }],
  };
  const speichern = await app.inject({
    method: "PUT",
    url: `/api/drafts/${entwurfId}`,
    headers: angemeldet,
    payload: eigeneFelder,
  });
  merke("4 entwurf", `PUT /api/drafts/${entwurfId}`, speichern.statusCode);

  // DER NEUAUFBAU DER SITZUNG, und er ist beides: die Sitzung wird ABGEMELDET (das Merkmal verfällt
  // wirklich) und die HTTP-Anwendung wird NEU GEBAUT. Dieselben Dienste bleiben stehen — sonst
  // messe ich nicht „der Entwurf überlebt die Sitzung", sondern „ein leerer Speicher ist leer".
  const abmelden = await app.inject({
    method: "POST",
    url: "/api/auth/logout",
    headers: angemeldet,
  });
  merke("4 entwurf", "POST /api/auth/logout", abmelden.statusCode);
  const alteSitzung = await app.inject({
    method: "GET",
    url: `/api/drafts/${entwurfId}`,
    headers: angemeldet,
  });
  merke("4 entwurf", `GET /api/drafts/${entwurfId} (alte Sitzung)`, alteSitzung.statusCode);

  const zweiteApp = buildApp(services);
  // VOR `ready()`, sonst nimmt Fastify den Hook nicht mehr an. Ohne Option geschieht hier nichts.
  if (opt.verfaelsche === "similar-formlos") verfaelscheAehnlichkeitsliste(zweiteApp);
  await zweiteApp.ready();
  const wiederAn = await zweiteApp.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: KONTO.email, password: KONTO.password },
  });
  merke("4 entwurf", "POST /api/auth/login (neue Sitzung)", wiederAn.statusCode);
  const keks2 = ersterKeks(wiederAn.headers["set-cookie"]);
  const wieder = { cookie: keks2 };
  const auf = await zweiteApp.inject({
    method: "GET",
    url: `/api/drafts/${entwurfId}`,
    headers: wieder,
  });
  merke("4 entwurf", `GET /api/drafts/${entwurfId} (neue Sitzung)`, auf.statusCode);
  const wiederKörper = auf.json() as Entwurfsantwort;
  const liste = await zweiteApp.inject({ method: "GET", url: "/api/drafts", headers: wieder });
  merke("4 entwurf", "GET /api/drafts (neue Sitzung)", liste.statusCode);
  const listeKörper = alsListe<Entwurfsantwort>(liste.json());
  const listenEintrag = listeKörper.find((d) => d.id === entwurfId);

  // ---- SCHRITT 5 · ERLAUBTE PRÜFUNG, SUCHE, QUELLENWIEDERAUFRUF --------------------------------
  // DIE FORTSETZUNG KOMMT AUS WIEDERGELADENEN DATEN — das ist die Korrektur aus Runde 2 und der
  // Kern der Sache. Runde 1 sendete hier `eigeneFelder`, also den Zustand der ALTEN Sitzung. Damit
  // hätte der Server beim Wiederöffnen Titel, Aussage und Herkunft verlieren können, ohne dass die
  // Strecke es merkt: der Test hätte die Lücke selbst zugeschüttet (BEN, Korrekturpflicht 1).
  //
  // Genommen wird der EINTRAG DER LISTE, weil die Oberfläche genau daraus fortsetzt
  // (CaptureDraftList → `onResume` mit dem Objekt aus `GET /api/drafts`, s. capture/src/service.ts
  // `listDraftsForResume`) — nicht die Einzeladresse. Wo der Listenweg nichts hergab, steht das als
  // MESSWERT (`fortsetzungAus`), damit ein Rückfall nie unbemerkt durchgeht.
  // AUCH DIE HERKUNFTSANGABE DER ANLAGE KOMMT AUS DEM WIEDERGELADENEN ENTWURF. Sie muss es, denn
  // `anchorDocuments`/`pendingSources` sind genau die Felder, die mega20 D in den Entwurf gelegt hat
  // — überlebten sie den Sitzungswechsel nicht, dürfte der Mensch die Quelle nicht mehr behaupten.
  const wiedergeladen = listenEintrag?.payload ?? wiederKörper.payload;
  const ankerAusWieder = wiedergeladen?.anchorDocuments ?? [];
  const belegeAusWieder = wiedergeladen?.pendingSources ?? [];

  // DIE EINE REGEL, UND SIE IST ABSICHTLICH UNBEQUEM: fortgesetzt wird der wiedergeladene Stand —
  // aber nur, wenn er seine Herkunft überhaupt noch trägt. Ein Entwurf ohne `anchorDocuments` ist
  // kein fortsetzbarer Dokumententwurf mehr; dann bleibt einem Client nur noch sein FORMULARZUSTAND,
  // und genau das steht dann als Messwert da (`"alt"`) statt still zu verschwinden.
  //
  // WARUM DER `"alt"`-ZWEIG NICHT WEGGELASSEN WERDEN DARF: er ist der echte Fall des Clients, der
  // die Quelle noch zu kennen glaubt, während der Server das Original verloren hat — und der
  // einzige, in dem das Entwurfs-Ankertor `MISSING_DRAFT_ANCHOR` (capture/src/service.ts:957)
  // überhaupt gefragt wird. Ohne ihn fiele Ü1 schon an der äusseren Objektprüfung der Route
  // (400 `BAD_REQUEST`, gemessen in Runde 2), und das schärfere der beiden Tore bliebe unbesehen.
  const ankerQuelle: "wiedergeladen" | "alt" = ankerAusWieder.length > 0 ? "wiedergeladen" : "alt";
  const fortsetzungAus: "liste" | "einzel" | "alt" =
    ankerQuelle === "alt" ? "alt" : listenEintrag?.payload ? "liste" : "einzel";
  const fortsetzung: unknown = fortsetzungAus === "alt" ? eigeneFelder : wiedergeladen;
  const dokumente =
    ankerQuelle === "wiedergeladen"
      ? ankerAusWieder.map((doc) => ({
          anchor: { objectId: doc.objectId, name: doc.name, mime: doc.mime },
          points: belegeAusWieder
            .filter((src) => src.anchorKey === undefined || src.anchorKey === doc.key)
            .map((src) => ({ label: src.label, excerpt: src.excerpt })),
        }))
      : [
          {
            anchor: { objectId: objektId, name: "sample.docx", mime: DOCX_MIME },
            points: [{ label: "sample.docx", excerpt: QUELLSATZ }],
          },
        ];

  // Der Weg der Oberfläche bei vorhandenem Ankerdokument: EIN Vorgang, Inhalt und Herkunft
  // gemeinsam (Capture.tsx:1729-1749). `operationId` ist Pflicht, `expectedUpdatedAt` beim
  // Fortsetzen ebenso (ko-routes.ts:1281-1292) — und er kommt ebenfalls aus dem wiedergeladenen
  // Stand, nicht aus einer Erinnerung.
  const gesehenerStand = listenEintrag?.updatedAt ?? wiederKörper.updatedAt;
  const anlage = await zweiteApp.inject({
    method: "POST",
    url: "/api/kos/from-document",
    headers: wieder,
    payload: {
      operationId: "job3801-erster-nutzerweg",
      draftId: entwurfId,
      draftPayload: fortsetzung,
      ...(gesehenerStand ? { expectedUpdatedAt: gesehenerStand } : {}),
      documents: dokumente,
    },
  });
  merke("5 fund", "POST /api/kos/from-document", anlage.statusCode);
  const anlageKörper = anlage.json() as {
    id?: string;
    error?: string;
    title?: string;
    statement?: string;
  };
  const koId = String(anlageKörper.id ?? "");

  // (a) DIE ERLAUBTE PRÜFUNG. `POST /api/knowledge/check` ist der Live-Check des Produkts
  //     (SCRUM-527, build-app.ts:2238): ein Text wird gegen den Bestand gehalten, Berechtigung
  //     `ko.read` (knowledge-check-routes.ts:126). Kein Modell nötig — ohne Modell läuft die
  //     deterministische Ähnlichkeit, und genau die soll das eben Angelegte finden.
  //
  //     NICHT `POST /api/check-text`: GEMESSEN, nicht vermutet — diese Adresse antwortet in der
  //     Vorgabe-Verdrahtung mit 404, weil sie nur bei aktivem Add-on-Schalter überhaupt registriert
  //     wird (`if (addonApiEnabled())`, build-app.ts:2258). Sie ist der Klara-Weg, nicht der Weg des
  //     Menschen im Browser, und ein Testprozess ist ohnehin kein Word.
  //
  //     Daneben steht dieselbe Anfrage OHNE Anmeldung: „erlaubt" ist nur dann eine Aussage, wenn es
  //     auch ein „nicht erlaubt" gibt.
  const pruefText = `${QUELLSATZ} Diese Regel gilt an allen Portalanlagen der Werkstatt und wird bei jeder Wartung erneut kontrolliert.`;
  const pruefung = await zweiteApp.inject({
    method: "POST",
    url: "/api/knowledge/check",
    headers: wieder,
    payload: { text: pruefText, source: "draft" },
  });
  merke("5 fund", "POST /api/knowledge/check (angemeldet)", pruefung.statusCode);
  const ohneAnmeldung = await zweiteApp.inject({
    method: "POST",
    url: "/api/knowledge/check",
    payload: { text: pruefText, source: "draft" },
  });
  merke("5 fund", "POST /api/knowledge/check (ohne Anmeldung)", ohneAnmeldung.statusCode);
  // DIESELBE FORMPRÜFUNG WIE AN DEN SUCHEN, nicht eine zweite daneben (JOB 3849, Lieferung 6). Bis
  // hierher lief die Trefferberechnung über die ROHEN `similar`-Einträge — ausserhalb jedes `try`,
  // mitten in `fahreStrecke`: ein `similar: [null]` beendete den Lauf mit einem `TypeError`, statt
  // einen benannten Befund zu liefern.
  const aehnliche = liesTrefferliste((pruefung.json() as { similar?: unknown }).similar);

  // (b) DIE SUCHE MIT DEM WORT DES DURCHGEHENDEN FADENS. `SUCHWORT` steht im Quellsatz UND in den
  //     beiden selbst getippten Feldern — dieser Schritt belegt also, dass das Angelegte nach
  //     Sitzungswechsel und Anlage überhaupt auffindbar ist, und AUSDRÜCKLICH NICHT, dass der
  //     Dokumentinhalt die Strecke überlebt hat. Für den isolierten Nachweis siehe (b2)/(b3).
  const suche = await zweiteApp.inject({
    method: "GET",
    url: `/api/library/search?q=${encodeURIComponent(SUCHWORT)}`,
    headers: wieder,
  });
  merke("5 fund", `GET /api/library/search?q=${SUCHWORT}`, suche.statusCode);
  const suchantwort = liesSuchantwort(suche, koId);

  // (b2) DIE ZWEITE SUCHE — mit dem Wort, das AUSSCHLIESSLICH in der Quelldatei steht. Derselbe
  //      Weg, dieselbe Route, ein anderes Wort: nur dieser Treffer sagt „die Anwendung findet, was
  //      in meinem Dokument steht". Kein `catch` — ein anderer Status ist ein eigener Messwert und
  //      wird nie in „nicht gefunden" umgedeutet (Auftrag §9). Gelesen wird über `liesSuchantwort`,
  //      damit Status, FORM und Körper mitreisen: ohne die Form wäre die Negativaussage von D2/Ü1
  //      blind (BEN, Korrekturpflicht 1).
  const sucheDok = await zweiteApp.inject({
    method: "GET",
    url: `/api/library/search?q=${encodeURIComponent(DOKUMENTWORT)}`,
    headers: wieder,
  });
  merke("5 fund", `GET /api/library/search?q=${DOKUMENTWORT}`, sucheDok.statusCode);
  const dokAntwort = liesSuchantwort(sucheDok, koId);

  // (b3) EINE STUFE TIEFER, weil die Route sie nicht führt: die `matched`-Flags. Erst sie sagen,
  //      dass der Treffer aus dem RUMPF kam und nicht aus einem Kurzfeld. Und daneben die
  //      Voraussetzung dieser ganzen Aussage — die Isolation des Worts am angelegten Objekt.
  const dokumentTreffer = await messeDokumenttreffer(services.ko, koId);
  const isolation = await messeIsolation(services.ko, koId);

  // (c) DER QUELLENWIEDERAUFRUF. Vom Fund über den Beleg zurück auf das Original — die Kette, die
  //     einen Demo-Besucher überhaupt interessiert: „und woher steht das?"
  const belege = await zweiteApp.inject({
    method: "GET",
    url: `/api/kos/${koId}/evidence`,
    headers: wieder,
  });
  merke("5 fund", `GET /api/kos/${koId}/evidence`, belege.statusCode);
  const belegObjektId = String(
    alsListe<{ objectId?: string }>(belege.json()).find((b) => b.objectId)?.objectId ?? "",
  );
  const quelle = await zweiteApp.inject({
    method: "GET",
    url: `/api/objects/${belegObjektId}`,
    headers: wieder,
  });
  merke("5 fund", `GET /api/objects/${belegObjektId}`, quelle.statusCode);
  const roh = await zweiteApp.inject({
    method: "GET",
    url: `/api/objects/${belegObjektId}/raw`,
    headers: wieder,
  });
  merke("5 fund", `GET /api/objects/${belegObjektId}/raw`, roh.statusCode);

  return {
    app,
    zweiteApp,
    befund: {
      leer: {
        statusVorAnmeldung: status1.statusCode,
        needsSetup: statusKörper.needsSetup === true,
        wissensobjekte: alsListe<unknown>(bestand.json()).length,
        entwuerfe: alsListe<unknown>(entwuerfe.json()).length,
        bestandStatus: bestand.statusCode,
        entwuerfeStatus: entwuerfe.statusCode,
        bestandIstListe: Array.isArray(bestand.json()),
        entwuerfeIstListe: Array.isArray(entwuerfe.json()),
      },
      konto: {
        status: einrichten.statusCode,
        rolle: String(kontoKörper.user?.role ?? ""),
        freigegeben: kontoKörper.user?.approved === true,
        needsSetupDanach: (status2.json() as { needsSetup?: boolean }).needsSetup === true,
        zweiteEinrichtung: zweiteEinrichtung.statusCode,
      },
      quelle: {
        entwurfStatus,
        entwurfId,
        quellsatzImEntwurf,
        objektStatus,
        objektId,
        objektName,
        laenge: bytes.length,
        abdruck: abdruckVon(bytes),
      },
      entwurf: {
        speichernStatus: speichern.statusCode,
        abmeldenStatus: abmelden.statusCode,
        alteSitzung: alteSitzung.statusCode,
        zweiteAnmeldung: wiederAn.statusCode,
        sitzungTauschte: keks.length > 0 && keks2.length > 0 && keks !== keks2,
        wiederoeffnenStatus: auf.statusCode,
        listeStatus: liste.statusCode,
        einzel: liesWiedersehen(wiederKörper.payload),
        liste: liesWiedersehen(listenEintrag?.payload),
        ankerFehlend: wiederKörper.anchorsMissing ?? [],
        inListe: listenEintrag !== undefined,
        fortsetzungAus,
      },
      fund: {
        anlageStatus: anlage.statusCode,
        anlageFehler: String(anlageKörper.error ?? ""),
        koId,
        koTitel: String(anlageKörper.title ?? ""),
        koAussage: String(anlageKörper.statement ?? ""),
        ankerQuelle,
        pruefungStatus: pruefung.statusCode,
        pruefungOhneAnmeldung: ohneAnmeldung.statusCode,
        pruefungEintraegeGueltig: aehnliche.gueltig,
        pruefungEintragsFehlschlag: aehnliche.fehlschlag,
        pruefungTrifft: aehnliche.eintraege.some((aehnlich) => aehnlich.id === koId),
        pruefungStand: String((pruefung.json() as { status?: string }).status ?? ""),
        sucheStatus: suchantwort.status,
        sucheIstListe: suchantwort.istListe,
        sucheKoerper: suchantwort.koerper,
        sucheEintraegeGueltig: suchantwort.eintraegeGueltig,
        sucheEintragsFehlschlag: suchantwort.eintragsFehlschlag,
        sucheTrifft: suchantwort.trifft,
        sucheDokumentStatus: dokAntwort.status,
        sucheDokumentIstListe: dokAntwort.istListe,
        sucheDokumentKoerper: dokAntwort.koerper,
        sucheDokumentEintraegeGueltig: dokAntwort.eintraegeGueltig,
        sucheDokumentEintragsFehlschlag: dokAntwort.eintragsFehlschlag,
        sucheDokumentTrifft: dokAntwort.trifft,
        dokumentTreffer,
        belegObjektId,
        quelleStatus: quelle.statusCode,
        // `GET /api/objects/:id` liefert das ganze gespeicherte Objekt (`{ ref, data }`), nicht die
        // flache Referenz — der Name steht deshalb in `ref` (object-routes.ts:305).
        quelleName: String((quelle.json() as { ref?: { name?: string } }).ref?.name ?? ""),
        rohbytesStatus: roh.statusCode,
        // `rawPayload` ist der UNGEDEUTETE Rumpf der Antwort (Buffer) — `payload` wäre eine
        // Zeichenkette und machte aus Binärbytes stillschweigend etwas anderes.
        rohLaenge: roh.rawPayload.length,
        rohAbdruck: abdruckVon(roh.rawPayload),
      },
      isolation,
      verlauf,
    },
  };
}

/** Beide Anwendungen schliessen — der Lauf hält zwei offene Fastify-Instanzen über denselben Bestand. */
export async function schliesse(lauf: Lauf): Promise<void> {
  await lauf.zweiteApp.close();
  await lauf.app.close();
}

/** Das Sitzungsmerkmal aus der `set-cookie`-Kopfzeile — dieselbe Lesart wie im Bestand (job2671 D2). */
function ersterKeks(kopf: string | string[] | undefined): string {
  const rohe = Array.isArray(kopf) ? (kopf[0] ?? "") : (kopf ?? "");
  return String(rohe).split(";")[0] ?? "";
}

/**
 * Eine Liste aus einer Antwort, die auch ein Fehlerobjekt sein kann. Die Strecke MUSS bis zum Ende
 * durchlaufen, selbst wenn ein Schritt gescheitert ist — sonst steht am Ende ein Absturz statt eines
 * lesbaren Befunds, und der Absturz sagt weniger als die Messung. (Gelernt beim Lauf mit Auslassung
 * `quellensicherung`: dort antwortet die Belegstellen-Route mit `{error: …}`, nicht mit einem Feld.)
 */
function alsListe<T>(rohe: unknown): T[] {
  return Array.isArray(rohe) ? (rohe as T[]) : [];
}

/** Wieviel EIN Diagnosetext für sich allein wert ist. */
const ISTWERT_ZEICHEN = 300;

/** Die eine Lesart für Diagnosetexte: die Grenze, dann die Kürzung ausdrücklich benannt. */
function gekuerzt(text: string, grenze: number = ISTWERT_ZEICHEN): string {
  return text.length > grenze ? `${text.slice(0, grenze)}… (gekürzt)` : text;
}

/**
 * DIE ERWARTETE FORM EINES TREFFERLISTENEINTRAGS — VOLLSTÄNDIG, nicht als Stichwort.
 *
 * Gültig ist NUR: ein Objekt, das nicht `null` ist, das kein Array ist, und dessen `id` eine
 * NICHT-LEERE Zeichenkette ist. Ausdrücklich nicht genügt „hat irgendwie ein Feld `id`": `{"id":""}`
 * und `{"id":null}` kamen bis JOB 3849 als gültige Einträge durch, und `["ko-1"]` ebenso.
 */
function istGueltigerEintrag(eintrag: unknown): eintrag is { readonly id: string } {
  if (typeof eintrag !== "object" || eintrag === null || Array.isArray(eintrag)) return false;
  const kennung = (eintrag as { id?: unknown }).id;
  return typeof kennung === "string" && kennung !== "";
}

/** Wie weit ein Istwert überhaupt geschrieben wird, bevor „…" steht. Begründung: `istwertVon`. */
const ISTWERT_TIEFE = 4;
const ISTWERT_GLIEDER = 12;
/** Wie viele formlose Einträge eine Meldung einzeln nennt, bevor sie nur noch zählt. */
const ISTWERT_MELDUNGEN = 5;
/**
 * WIEVIEL EIN EINZELN GENANNTER PLATZ IN EINER MELDUNG WERT IST — und warum das nicht dasselbe ist
 * wie `ISTWERT_ZEICHEN` (JOB 3866, gemessen).
 *
 * Bis hierher bekam JEDER der fünf genannten Plätze die vollen 300 Zeichen. Bei ARRAYS fiel das nie
 * auf: `[null]`, `[{}]`, `["ko-1"]` und auch der 10 000 Ebenen tiefe Array-Körper aus JOB 3849
 * drucken sich in unter 30 Zeichen aus, fünf davon bleiben weit unter der Grenze. Bei OBJEKTEN
 * nicht: ein Eintrag mit zwölf Feldern je Ebene füllt seine 300 Zeichen wirklich aus. GEMESSEN am
 * Stand davor, mit 5000 solchen Einträgen: `fehlschlag` war 1761 Zeichen lang (5 × 311 plus Rahmen)
 * — und damit war „die Meldung wächst nicht mit dem Eintrag" für den Objektzweig falsch, obwohl
 * jeder EINZELNE Istwert seine Grenze hielt (436 Zeichen bei einem Eintrag, tief wie voll
 * verzweigt).
 *
 * DIE GRENZE GILT BEIM SCHREIBEN, eine Ebene höher: die ganze Meldung gibt für Istwerte zusammen
 * nicht mehr aus als ein einzelner Istwert allein wert war. Kein nachträgliches Kürzen der fertigen
 * Meldung — das wäre wieder der Fehler aus JOB 3849 Runde 2, nur an anderer Stelle — und keine
 * Absenkung von `ISTWERT_MELDUNGEN`: die Zahl der genannten Plätze ist eine Aussage über die
 * Lesbarkeit, nicht über die Länge, und beide Grenzen bleiben deshalb nebeneinander stehen.
 *
 * UND DIESE GRENZE IST KEIN ERSATZ FÜR DIE BUCHFÜHRUNG IN `drucke` (Runde 3, BEN Korrekturpflicht 1).
 * Sie teilt einen Vorrat auf fünf Plätze auf; dass ein EINZELNER Platz seinen Anteil einhält, leistet
 * allein `drucke`. Runde 2 hatte nur diese Aufteilung gebaut und die unvollständige Buchführung
 * darunter stehen lassen — F13 misst deshalb den Weg OHNE diese Aufteilung (`ISTWERT_ZEICHEN` voll,
 * ein Istwert, keine Plätze), damit die Buchführung für sich geprüft ist.
 */
const ISTWERT_JE_MELDUNG = Math.floor(ISTWERT_ZEICHEN / ISTWERT_MELDUNGEN);

/**
 * DER ISTWERT EINES EINTRAGS — gedruckt, ohne ihn je GANZ zu drucken (JOB 3849 Runde 2).
 *
 * BEN Korrekturpflicht 1, von ihm gemessen und in `durchstich.test.ts` (xiii) als Fall festgehalten:
 * `JSON.stringify` und der Notweg `String(…)` laufen BEIDE rekursiv durch die Schachtelung. Der
 * gültige Körper `"[".repeat(10000) + "0" + "]".repeat(10000)` kommt durch `JSON.parse` (das
 * arbeitet iterativ) — und dann starb die DIAGNOSE daran: `RangeError: Maximum call stack size
 * exceeded`, geworfen hier, hoch durch `liesTrefferliste`, `liesSuchantwort`, `fahreStrecke`. Damit
 * war die Zusage „wirft nie" widerlegt, ausgerechnet an der Stelle, die den Fehler MELDEN soll.
 *
 * ERST KÜRZEN HALF NICHT, und das ist der ganze Punkt: gekürzt wurde nach dem vollständigen
 * Serialisieren, also ein Text, der nie zustande kam. Deshalb entsteht hier gar kein vollständiger
 * Text — TIEFE, GLIEDERZAHL und ZEICHENZAHL begrenzen schon das Schreiben, und jeder Zweig hört auf,
 * sobald der Vorrat leer ist. Was wegfällt, steht als „…" da: der Platz im Array und die Art des
 * Werts bleiben lesbar, denn genau die braucht der Mensch vor der Vorführung.
 *
 * UND ES GIBT KEIN NACHTRÄGLICHES KÜRZEN MEHR (JOB 3866 Runde 3, BEN Korrekturpflicht 1). Bis hierher
 * stand hier `gekuerzt(drucke(…), zeichen)`: ein `drucke`, das sich verrechnete, blieb dadurch
 * unsichtbar — die Einhaltung der Grenze stellte der Schnitt DANACH her, nicht die Buchführung. Jetzt
 * ist `drucke` die einzige Grenze, und sie gilt beim Schreiben. Fällt sie, wird die Meldung lang, und
 * genau das messen F10–F13 in `durchstich.test.ts`.
 *
 * KEIN `catch` — der Weg wirft nicht, statt einen Wurf umzudeuten. Ein `catch` würde den Istwert
 * verlieren und wäre wieder die „erwartet 200, war 503"-Meldung, die hier schon zu wenig war.
 */
function istwertVon(eintrag: unknown, zeichen: number = ISTWERT_ZEICHEN): string {
  return drucke(eintrag, ISTWERT_TIEFE, { zeichen });
}

/**
 * JEDES AUSGEGEBENE ZEICHEN WIRD BEZAHLT — und zwar aus demselben Vorrat (JOB 3866 Runde 3, BEN
 * Korrekturpflicht 1). Vorher verbuchte nur `nimm` seine Textstücke, dazu ein pauschales `-= 1` je
 * Glied; die Klammern jeder Ebene, der Doppelpunkt zwischen Schlüssel und Wert und jedes ausgegebene
 * „…" entstanden umsonst. Bei Arrays fiel das nie auf (`[null]` druckt sich in vier Zeichen aus), bei
 * zwölf Feldern über sechs Ebenen sehr wohl: dort sind die Strukturzeichen der Grossteil des Textes.
 *
 * DESHALB IST `zahle` DIE EINZIGE STELLE, AN DER AUSGABE ENTSTEHT. Die Rückgabe dieser Funktion ist
 * genau so lang, wie hier abgebucht wurde — die Klammern werden VOR der Schleife bezahlt, weil sie
 * danach sicher geschrieben werden. Der Vorrat darf dabei kurz ins Minus laufen (ein abgeschnittenes
 * Stück kostet ein Zeichen mehr als übrig war); jede Schleife und jeder Einstieg prüfen ihn danach,
 * also ist der Überhang durch die TIEFE begrenzt und nicht durch den Eintrag.
 */
function drucke(wert: unknown, tiefe: number, vorrat: { zeichen: number }): string {
  const zahle = (text: string): string => {
    vorrat.zeichen -= text.length;
    return text;
  };
  if (vorrat.zeichen <= 0) return zahle("…");
  const nimm = (text: string): string =>
    zahle(text.length > vorrat.zeichen ? `${text.slice(0, vorrat.zeichen)}…` : text);
  if (wert === null) return nimm("null");
  if (Array.isArray(wert)) {
    if (tiefe <= 0) return nimm(`[… zu tief, Länge ${wert.length}]`);
    zahle("[]"); // die beiden Klammern, bevor sie geschrieben werden
    const glieder: string[] = [];
    for (const glied of wert) {
      if (glieder.length >= ISTWERT_GLIEDER || vorrat.zeichen <= 0) break;
      if (glieder.length > 0) zahle(","); // genau ein Trennzeichen je Zwischenraum
      glieder.push(drucke(glied, tiefe - 1, vorrat));
    }
    return `[${glieder.join(",")}${glieder.length < wert.length ? zahle("…") : ""}]`;
  }
  switch (typeof wert) {
    case "string":
      // ZUERST schneiden, DANN drucken: eine Zeichenkette von 10 MB darf nicht erst ganz entstehen.
      return nimm(JSON.stringify(wert.slice(0, Math.max(vorrat.zeichen, 0))));
    case "object": {
      const felder = Object.keys(wert as object);
      if (tiefe <= 0) return nimm(`{… zu tief, Felder: ${felder.length}}`);
      zahle("{}");
      const gedruckt: string[] = [];
      for (const feld of felder) {
        if (gedruckt.length >= ISTWERT_GLIEDER || vorrat.zeichen <= 0) break;
        if (gedruckt.length > 0) zahle(",");
        const schluessel = nimm(JSON.stringify(feld));
        zahle(":");
        gedruckt.push(
          `${schluessel}:${drucke((wert as Record<string, unknown>)[feld], tiefe - 1, vorrat)}`,
        );
      }
      return `{${gedruckt.join(",")}${gedruckt.length < felder.length ? zahle("…") : ""}}`;
    }
    case "bigint":
      return nimm(`${wert}n`);
    case "function":
      return nimm("[Funktion]");
    case "symbol":
      return nimm("[Symbol]");
    default:
      return nimm(String(wert));
  }
}

/**
 * EINE TREFFERLISTE ALS MESSWERT — und zwar samt ihrer EINTRÄGE (JOB 3849).
 *
 * WOZU: Bis hierher hiess „Form geprüft" genau `Array.isArray`. Was in der Liste stand, sah niemand
 * an — die Trefferberechnung lief über die ROHEN Einträge. Die drei gemessenen Folgen stehen
 * im Kopf dieser Datei. Ein formloser Eintrag ist weder ein Treffer noch eine Nicht-Übereinstimmung:
 * er ist ein benannter Antwortfehler, und das ist ein eigener Zustand mit einem eigenen Feld.
 *
 * DIE BEIDEN AUSSAGEN BLEIBEN GETRENNT: `gueltig` sagt, ob überhaupt bewertet werden KONNTE,
 * `treffer` (bzw. `Suchantwort.trifft`) sagt, ob gefunden wurde. Nur so lässt sich „konnte nicht
 * bewertet werden" von „nicht gefunden" unterscheiden — genau die Unterscheidung, die der ganzen
 * Reihe dieser Runden zugrunde liegt.
 *
 * EIN GÜLTIGER EINTRAG HEILT KEINEN FORMLOSEN: GEZÄHLT werden alle formlosen Einträge, einzeln mit
 * Platz und Istwert GENANNT die ersten `ISTWERT_MELDUNGEN`, der Rest gezählt — und `eintraege` bleibt
 * in diesem Fall leer. Bis JOB 3849 lieferte `[{"id":"ko-1"},null]`
 * ein `trifft: true`, weil `.some` beim ersten Treffer abbricht und den zweiten Eintrag nie sah.
 *
 * WIRFT NIE — und das schliesst die MELDUNG ein (Runde 2, BEN Korrekturpflicht 1). Eine Antwort, die
 * keine Liste ist, wird zum benannten Fehlschlag, nicht zu `[]`; und ein Eintrag, den man nicht ganz
 * ausdrucken kann (tief verschachtelt, sehr lang, sehr viele), wird trotzdem gemeldet, weil der
 * Istwert begrenzt GESCHRIEBEN und nicht erst vollständig gebaut und dann gekürzt wird (`istwertVon`).
 * Die Meldung selbst ist ZWEIFACH begrenzt (JOB 3866): `ISTWERT_MELDUNGEN` Plätze einzeln, der Rest
 * gezählt — UND je genanntem Platz nur `ISTWERT_JE_MELDUNG` Zeichen Istwert. Die zweite Grenze fehlte
 * bis JOB 3866 und fiel erst am Objektzweig auf: 5000 Einträge mit je zwölf Feldern über sechs Ebenen
 * ergaben eine Meldung von 1761 Zeichen, weil fünf Plätze à 311 Zeichen genannt wurden. Beide Grenzen
 * stehen AUF der Buchführung von `drucke` und ersetzen sie nicht — dort wird seit Runde 3 auch jede
 * Klammer, jeder Doppelpunkt und jedes „…" bezahlt, und ein nachträglicher Schnitt gibt es nicht mehr.
 */
export interface Trefferliste {
  /** Kam eine Liste, und trägt JEDER ihrer Einträge die erwartete Form? */
  readonly gueltig: boolean;
  /** Der benannte Grund mit Platz und Istwert, wenn nicht — sonst leer. */
  readonly fehlschlag: string;
  /** Die Einträge gültiger Form. Leer, solange `gueltig` falsch ist. */
  readonly eintraege: readonly { readonly id: string }[];
}

export function liesTrefferliste(rohe: unknown): Trefferliste {
  if (!Array.isArray(rohe)) {
    return {
      gueltig: false,
      fehlschlag: `es kam gar keine Liste, sondern ${istwertVon(rohe)} — es gibt keine Einträge, deren Form zu bewerten wäre`,
      eintraege: [],
    };
  }
  // EIN DURCHGANG, UND ER IST ZWEIFACH BEGRENZT. Gezählt werden alle formlosen Einträge, einzeln
  // GENANNT nur die ersten `ISTWERT_MELDUNGEN` — sonst wüchse die Meldung mit der Liste (5000 formlose
  // Einträge ergaben 5000 Istwerte). Und JEDER genannte Platz bekommt nur `ISTWERT_JE_MELDUNG`
  // Zeichen: die Zahl der Plätze allein hielt die Meldung nicht klein, sobald die Einträge ihre 300
  // Zeichen wirklich ausfüllten (JOB 3866, gemessen: 1761 Zeichen am Objektzweig).
  // Der erste Platz ist der, den ein Mensch zuerst nachschlägt; die Gesamtzahl steht davor.
  let formlose = 0;
  const genannt: string[] = [];
  for (const [platz, eintrag] of rohe.entries()) {
    if (istGueltigerEintrag(eintrag)) continue;
    formlose += 1;
    if (genannt.length < ISTWERT_MELDUNGEN)
      genannt.push(`Platz ${platz} war ${istwertVon(eintrag, ISTWERT_JE_MELDUNG)}`);
  }
  if (formlose > 0) {
    const weitere = formlose - genannt.length;
    return {
      gueltig: false,
      fehlschlag: `${formlose} von ${rohe.length} Listeneinträgen haben nicht die erwartete Form (ein Objekt mit nicht-leerer Zeichenketten-Kennung „id"): ${genannt.join("; ")}${weitere > 0 ? ` … und ${weitere} weitere` : ""}`,
      eintraege: [],
    };
  }
  return { gueltig: true, fehlschlag: "", eintraege: rohe.filter(istGueltigerEintrag) };
}

/**
 * EINE SUCHANTWORT ALS MESSWERT — Status, FORM, EINTRAGSFORM und Körper zusammen.
 *
 * BEN zu 3825 Runde 1 (Korrekturpflicht 1), mit eigener Gegenprobe belegt: die Negativaussagen von
 * D2 und Ü1 („das Dokumentwort wurde NICHT gefunden") lasen ihre Trefferliste über `alsListe` — und
 * das verwandelt JEDEN Nicht-Listen-Körper in `[]`. Eine Route, die mit HTTP 200 und `{error: …}`
 * antwortet, sah damit aus wie eine erfolgreiche leere Suche: der Prüfer verstellte sie genau so,
 * und die ganze Datei blieb grün. Ein Fehlerobjekt ist aber kein leeres Ergebnis — dieselbe Lehre,
 * die für die Bestandsrouten in Runde 2 schon gezogen wurde (Kopf dieser Datei, Punkt 3), nur an der
 * Suche nicht angewandt.
 *
 * BEN zu 3825 Runde 2 (Prüfpunkt 6), ebenfalls bestellt und hier geliefert: dieselbe Blindheit galt
 * eine Schicht tiefer für die EINTRÄGE. Deshalb reisen VIER Dinge mit: der STATUS (antwortete sie
 * überhaupt?), die LISTENFORM (war es eine Liste?), die EINTRAGSFORM (taugt jeder Eintrag zur
 * Bewertung?) und der KÖRPER (was kam sonst?). Erst mit allen vieren darf `trifft === false` als
 * „nicht gefunden" gelesen werden; die ersten drei sind in `durchstich.test.ts` eigene Zusagen VOR
 * jeder Trefferbewertung, der vierte steht in ihren Meldungen, damit eine rote Stelle sagt, WAS
 * statt der Liste kam, statt nur „erwartet 200, war 503".
 *
 * KEIN `catch`, das etwas umdeutet, und KEIN WURF: ein nicht lesbarer Körper wird `istListe: false`,
 * ein formloser Eintrag `eintraegeGueltig: false` — beides benannte Fehlschläge, nie eine leere
 * Trefferliste und nie ein Abbruch der Strecke. „Kein Wurf" gilt seit Runde 2 auch für das SCHREIBEN
 * der Meldung: BEN widerlegte den Satz mit einem tief verschachtelten Eintrag, an dem `JSON.stringify`
 * in der Diagnose starb. Siehe `istwertVon`; gehalten wird die Aussage von `durchstich.test.ts` (xiii).
 */
export interface Suchantwort {
  readonly status: number;
  readonly istListe: boolean;
  /** Der Rumpf, auf 300 Zeichen gekürzt. Diagnosematerial für Meldungen, kein Prüfwert. */
  readonly koerper: string;
  /** Trägt JEDER Listeneintrag die erwartete Form? Siehe `Trefferliste`. */
  readonly eintraegeGueltig: boolean;
  /** Platz und Istwert jedes formlosen Eintrags — leer, wenn `eintraegeGueltig`. */
  readonly eintragsFehlschlag: string;
  /**
   * Steht `koId` in der Liste? Berechnet AUSSCHLIESSLICH aus Einträgen gültiger Form und deshalb
   * `false`, sobald einer formlos ist. Aussagekräftig NUR, wenn `status === 200 && istListe &&
   * eintraegeGueltig` — sonst sagt `eintragsFehlschlag`, warum gar nicht bewertet werden konnte.
   */
  readonly trifft: boolean;
}

export function liesSuchantwort(
  antwort: { readonly statusCode: number; readonly payload: string },
  koId: string,
): Suchantwort {
  let rohe: unknown;
  try {
    rohe = JSON.parse(antwort.payload);
  } catch {
    // Kein JSON — dann ist es erst recht keine Trefferliste. `undefined` fällt unten durch
    // `Array.isArray` und `liesTrefferliste` in genau die schwächere Aussage.
    rohe = undefined;
  }
  const liste = liesTrefferliste(rohe);
  return {
    status: antwort.statusCode,
    istListe: Array.isArray(rohe),
    koerper: gekuerzt(antwort.payload),
    eintraegeGueltig: liste.gueltig,
    eintragsFehlschlag: liste.fehlschlag,
    trifft: liste.eintraege.some((treffer) => treffer.id === koId),
  };
}

/**
 * Die Form, in der ein Entwurf vom Server zurückkommt — Einzeladresse und Listeneintrag tragen
 * dieselbe (capture-routes: `{ ...draft, anchorsMissing }`). Alles optional, weil ein Server, der
 * Felder verliert, genau das tun würde und der Test das MESSEN soll statt daran abzustürzen.
 */
interface Entwurfsantwort {
  readonly id?: string;
  readonly updatedAt?: string;
  readonly payload?: {
    readonly title?: string;
    readonly statement?: string;
    readonly bodyHtml?: string | null;
    readonly pendingSources?: readonly {
      readonly label?: string;
      readonly excerpt?: string;
      readonly anchorKey?: string;
      readonly objectId?: string;
    }[];
    readonly anchorDocuments?: readonly {
      readonly key?: string;
      readonly objectId?: string;
      readonly name?: string;
      readonly mime?: string;
    }[];
  };
  readonly anchorsMissing?: string[];
}

/** Was von einem wiedergeöffneten Entwurf zurückkam — ohne Urteil, nur gelesen. */
function liesWiedersehen(p: Entwurfsantwort["payload"]): Wiedersehen {
  const anker = p?.anchorDocuments ?? [];
  const belege = p?.pendingSources ?? [];
  return {
    titel: String(p?.title ?? ""),
    aussage: String(p?.statement ?? ""),
    quellsatzDa: (p?.bodyHtml ?? "").includes(QUELLSATZ),
    ankerObjekte: anker.map((doc) => String(doc.objectId ?? "")),
    ankerName: String(anker[0]?.name ?? ""),
    belegObjekte: belege.filter((src) => src.objectId).map((src) => String(src.objectId)),
    belegZitat: String(belege[0]?.excerpt ?? ""),
  };
}

/**
 * DER TREFFER ÜBER DEN GEMEINSAMEN SUCHVERTRAG — mit den `matched`-Flags, die die HTTP-Antwort
 * nicht führt.
 *
 * BEWUSST OHNE `limit`: die Bibliothek deckelt auf 200 (`LIBRARY_SEARCH_HIT_LIMIT`), weil sie eine
 * Seite füllt. Hier wird EIN bestimmtes Objekt gesucht, und ein Deckel könnte es verschweigen —
 * dann stünde „nicht aus dem Rumpf getroffen" da, wo „abgeschnitten" richtig wäre. Ohne Deckel
 * bleibt die Treffermenge ungedeckelt (s. `KoSearchQuery`).
 *
 * KEIN ZWEITER SUCHVERTRAG: gefragt wird `findSearchHits`, dieselbe Methode, durch die auch
 * `LibraryService.search` läuft — nur eine Ebene vor dem Verlust der Flags.
 */
async function messeDokumenttreffer(ko: AppServices["ko"], koId: string): Promise<Dokumenttreffer> {
  if (!koId) {
    return {
      gefragt: false,
      gefunden: false,
      fehlschlag:
        "es wurde kein Wissensobjekt angelegt — es gibt keinen Treffer, nach dem zu fragen wäre",
      flaggen: undefined,
    };
  }
  let hits: KoSearchHit[];
  try {
    // Kleingeschrieben wie in der Route (`LibraryService.search`: `query.trim().toLowerCase()`) —
    // die Trefferregel vergleicht kleingeschrieben, ein Grossbuchstabe hier träfe nie.
    hits = await ko.findSearchHits({ terms: [DOKUMENTWORT.toLowerCase()] });
  } catch (fehler) {
    // `findSearchHits` WIRFT, wenn keine Projektionsfassung freigegeben ist (service.ts:1669). Das
    // ist ein benannter Fehlschlag, keine Abwesenheit eines Treffers.
    return {
      gefragt: true,
      gefunden: false,
      fehlschlag: `findSearchHits warf: ${fehler instanceof Error ? fehler.message : String(fehler)}`,
      flaggen: undefined,
    };
  }
  const treffer = hits.find((h) => h.koId === koId);
  if (!treffer) {
    return {
      gefragt: true,
      gefunden: false,
      fehlschlag: `„${DOKUMENTWORT}" traf ${hits.length} Objekt(e), aber nicht das angelegte (${koId})`,
      flaggen: undefined,
    };
  }
  return { gefragt: true, gefunden: true, fehlschlag: "", flaggen: treffer.matched };
}

/**
 * OB DAS DOKUMENTWORT WIRKLICH ISOLIERT IST — am angelegten Objekt gemessen, je Lauf neu.
 *
 * Gelesen wird das zusammengesetzte Suchdokument (`effectiveSearchDocumentOf`), also GENAU die
 * Feldtexte, gegen die die Trefferregel läuft — nicht die Konstanten dieser Datei und nicht die
 * Ladung, die hingeschickt wurde. Ein Produkt, das Titel oder Kategorie anders projiziert als hier
 * getippt, käme sonst unbemerkt durch.
 *
 * `bodyText` steht ABSICHTLICH NICHT in der Liste: dort SOLL das Wort stehen. Geprüft wird nur,
 * dass es in keinem KURZFELD steht — denn nur dann kann ein Treffer aus dem Rumpf stammen.
 */
async function messeIsolation(ko: AppServices["ko"], koId: string): Promise<Isolation> {
  const wort = DOKUMENTWORT.toLowerCase();
  const imQuellsatz = QUELLSATZ.toLowerCase().includes(wort);
  if (!koId) {
    return {
      gemessen: false,
      fehlschlag: "es wurde kein Wissensobjekt angelegt — es gibt keine Felder zu lesen",
      imQuellsatz,
      verletzteFelder: [],
    };
  }
  const dokument = await ko.effectiveSearchDocumentOf(koId);
  if (!dokument) {
    return {
      gemessen: false,
      fehlschlag: `für ${koId} steht kein zusammengesetztes Suchdokument bereit`,
      imQuellsatz,
      verletzteFelder: [],
    };
  }
  const kurzfelder: readonly (readonly [string, string])[] = [
    ["titel", dokument.titleText],
    ["aussage", dokument.statementText],
    ["kategorie", dokument.categoryText],
    ["schlagwort", dokument.tagText],
    ["bildunterschrift", dokument.captionText],
  ];
  return {
    gemessen: true,
    fehlschlag: "",
    imQuellsatz,
    verletzteFelder: kurzfelder
      .filter(([, text]) => text.toLowerCase().includes(wort))
      .map(([name]) => name),
  };
}

/** SHA-256, hex. Der Vergleichswert für „es sind DIESELBEN Bytes", nicht „es kamen Bytes". */
function abdruckVon(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}
