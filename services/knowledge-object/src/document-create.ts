// AUFTRAG-mega20 Block A — DER VORGANG MUSS DEN ANTWORTVERLUST ÜBERLEBEN.
//
// ============================================================================================
// DER BEFUND, DER DIESE DATEI ERZWUNGEN HAT
// ============================================================================================
//
// mega19 hat den KO-INSERT atomar gemacht: Inhalt, Anker und Belegstellen entstehen in EINEM
// `repo.insert`. Der REQUEST ist damit aber nicht atomar geworden. Nach dem gelungenen Insert
// laufen auf Route-Ebene noch Entwurfs-Rücknahme, Prüfer-Zuweisung, Benachrichtigung und der
// KI-Prüf-Vermerk — und ERST danach geht die 201 raus. Jeder dieser Schritte kann werfen, während
// das Wissensobjekt BEREITS EXISTIERT; die Route antwortete dann mit Fehler.
//
// `POST /api/kos/from-document` hatte bis mega19 KEINE Erzeugungs-Operationskennung. Der Kommentar
// an `DocumentBundleInput` nannte das eine ehrliche Grenze („eine Wiederholung ist ein NEUES
// Wissensobjekt"). Das war ehrlich, aber falsch abgewogen: die Wiederholung ist hier nicht der
// seltene Doppelklick, sondern der REGELFALL nach Antwortverlust — und der Preis ist teurer als
// beim Append. Dort entsteht eine doppelte Quelle, hier ein DOPPELTES WISSENSOBJEKT mit vollem
// Body, allen Ankern und allen Belegstellen.
//
// ============================================================================================
// WARUM DIE KENNUNG VOM AUFRUFER KOMMT
// ============================================================================================
//
// Dieselbe Begründung wie beim Append (document-append.ts, Abschnitt 1) und aus demselben Grund:
// nur der Aufrufer weiß, ob zwei eingehende Anfragen DERSELBE fachliche Vorgang sind. Zwei
// inhaltsgleiche Erstanlagen desselben Dokuments sind ein legitimer, wenn auch seltener Wunsch —
// eine serverseitig aus dem Inhalt gehashte Kennung würde ihn stillschweigend verschlucken.
//
// UND WARUM SIE TROTZDEM KEIN CLIENT-FELD MIT AUTORITÄT IST. Sie ist ein Deduplizierungsschlüssel,
// sonst nichts. Der Server entnimmt ihr KEINE Aussage über Herkunft, Berechtigung oder Echtheit;
// jede Prüfung (Recht, Formen, Kapazität, Stufe, Belegpflicht) läuft bei einer UNBEKANNTEN Kennung
// vollständig und in unveränderter Reihenfolge. Die schlimmste erreichbare Wirkung ist, dass ein
// Aufrufer seine EIGENE zweite Erstanlage als Wiederholung der ersten quittiert bekommt.
//
// Der Unterschied zum Append ist der SICHTBARKEITSRAUM: die Append-Kennung lebt IM Wissensobjekt
// (`appendOps`) und dedupliziert nur innerhalb dieses einen Objekts. Die Erzeugungskennung kann
// dort nicht liegen — das Objekt entsteht ja gerade erst. Sie liegt deshalb AM Objekt als
// `createOperationId` und ist DB-weit eindeutig (partieller Unique-Index, wie der Kandidaten-Anker
// des Import-Accepts). Daraus folgt eine Eigenschaft, die hier benannt gehört: eine bereits
// vergebene Kennung ist für JEDEN Aufrufer vergeben. Das ist beabsichtigt (nur so ist „höchstens
// EIN Objekt je Vorgang" DB-erzwungen) und ungefährlich, weil der Nachschlag NICHTS preisgibt, was
// der Aufrufer nicht ohnehin sehen dürfte: der Adoptionspfad im Service liefert ein fremdes Objekt
// NIE aus, sondern nur eines, dessen Kennung der Aufrufer selbst mitgebracht hat UND dessen
// Autor er ist (die Route prüft `ko.read` ohnehin nicht — der Service prüft die Autorschaft, s.
// KoService.lookupDocumentCreate). Eine erratene fremde Kennung liefert deshalb kein fremdes
// Objekt, sondern einen Konflikt.
//
// ============================================================================================
// WARUM KEIN PROZESSSPEICHER
// ============================================================================================
//
// Wie beim Append: die Kennung liegt PERSISTENT am Objekt, damit die Prüfung denselben Bestand
// sieht wie der Vollzug, einen Neustart übersteht und — anders als beim Append — sogar
// prozessübergreifend hart ist, weil der Unique-Index sie erzwingt. Die prozessübergreifende
// SERIALISIERUNG zweier gleichzeitiger Erstanlagen bleibt (wie in mega18/mega19 benannt)
// Nach-VIP-2; sie ist hier aber auch nicht mehr nötig, um Duplikate zu verhindern: der zweite
// Insert kollidiert am Index und wird ADOPTIERT statt dupliziert.

import { createHash } from "node:crypto";
import { OPERATION_ID_PATTERN } from "./document-append";
import { KoError } from "./types";

/**
 * Prüft die Erzeugungs-Operationskennung defensiv (der Wert kommt vom Client) — mit DEMSELBEN
 * Zeichensatz- und Längenvertrag wie die Append-Kennung (`OPERATION_ID_PATTERN`, eine einzige
 * Quelle der Wahrheit; zwei Kopien wären zwei Gelegenheiten, sie auseinanderlaufen zu lassen).
 *
 * Ungültig ⇒ ehrlicher Fehler, NIE ein stiller Ersatzwert. Eine erfundene Kennung würde die
 * Wiederholbarkeit lautlos aufheben und damit genau die Zusage brechen, für die sie existiert —
 * und im Fall der Erstanlage ein zweites vollständiges Wissensobjekt erzeugen.
 */
export function normalizeCreateOperationId(raw: unknown): string {
  const value = typeof raw === "string" ? raw.trim() : "";
  if (!OPERATION_ID_PATTERN.test(value)) {
    throw new KoError(
      "INVALID_OPERATION_ID",
      "Ungültige Operations-Kennung — die Erstanlage braucht einen wiederholbaren Vorgangsschlüssel.",
    );
  }
  return value;
}

// --------------------------------------------------------------------------------------------
// DER REPARATURVERMERK (`KoRepairNote`, definiert in types.ts bei den übrigen KO-Feldern)
// --------------------------------------------------------------------------------------------
//
// Er entsteht an genau einer Stelle: wenn die kompensierende Rücknahme einer gescheiterten
// Erstanlage SELBST gescheitert ist. Bis mega19 lief `repo.delete(...).catch(() => undefined)` —
// der Fehler der Rücknahme wurde verschluckt, und im Bestand blieb ein vollständiges Wissensobjekt
// (Body, Anker, Belegstellen) mit möglicherweise fehlendem Snapshot, fehlender Evidence und
// fehlendem Audit. Der Aufrufer erfuhr nur den URSPRÜNGLICHEN Fehler und hatte keinen Anhaltspunkt,
// dass etwas zurückblieb.
//
// Der Vermerk macht diesen Zustand SICHTBAR (er steht am Objekt UND im Audit) und BENENNBAR
// (`failedStep` sagt, welcher Beleg-Schritt zuerst brach). Er REPARIERT nichts — der Reparaturpfad
// für append-only Evidence-Reste ist ausdrücklich Nach-VIP-2. Was er leistet, ist die Voraussetzung
// jeder Reparatur: dass jemand das Objekt findet und weiß, warum es unvollständig ist.
//
// EHRLICHE GRENZE. Der Vermerk ist BEST EFFORT: er wird mit einem eigenen `repo.update`
// geschrieben, und dieser Write kann in derselben Störung ebenfalls scheitern. Deshalb ist er nie
// der EINZIGE Kanal — der geworfene `CREATE_ROLLBACK_FAILED` nennt die Kennung des Objekts
// unabhängig davon, und der Audit-Eintrag `ko.create-rollback-failed` wird getrennt versucht. Was
// von den dreien durchkommt, steht im Audit-Payload (`marked`), damit niemand aus einem fehlenden
// Vermerk auf ein gesundes Objekt schließt.

// ============================================================================================
// AUFTRAG-mega21 Block A — DER VORGANGS-DATENSATZ
// ============================================================================================
//
// bens SB-1, SB-3 und SB-4 sind DERSELBE Mangel aus drei Richtungen: der gespeicherte Vorgang
// wusste nicht, WEM er gehört, nicht WAS er war, und nicht WIE er ausging. `createOperationId` ist
// ein Schlüssel — ein Schlüssel ohne Schloss dahinter. Der Datensatz (`KoCreateOperation`,
// types.ts) ist das Schloss.
//
// --------------------------------------------------------------------------------------------
// (1) DER EIGENTÜMER — warum NICHT `author`
// --------------------------------------------------------------------------------------------
//
// mega20 verglich `known.author === author`. Zwei unabhängige Gründe, warum das falsch war:
//
//   · BEIM ENTWURFSWEG ist `author` der URSPRÜNGLICHE Verfasser des Entwurfs (FR-CAP-07,
//     `draft.originalAuthor`, build-app.ts) — nicht der Einreichende. Ein Admin darf einen fremden
//     Entwurf absenden (canSeeDraft). Der erste Lauf legte dann ein Objekt mit dem FREMDEN Autor
//     an; der rechtmäßige Wiederholversuch desselben Admins suchte mit SEINER Kennung und bekam
//     409 — für einen Vorgang, den er selbst und rechtmäßig gestartet hatte.
//
//   · `author` ist VERÄNDERLICH (`KoService.setAuthor`, FR-LIF-02 Autor-Übergabe). Eine
//     Eigentümerbindung, die sich nachträglich verschieben lässt, ist keine. Nach einer Übergabe
//     verlöre der ursprüngliche Anleger seinen eigenen Wiederholversuch, und der neue Autor erbte
//     einen Vorgang, den er nie gestartet hat.
//
// DIE TRENNUNG, in bens Worten: „KO-Autor und Operation-Eigentümer müssen getrennte Konzepte
// sein." `createOperation.actor` ist der AUTHENTIFIZIERTE Anfragende, wird EINMAL beim Insert
// geschrieben und danach von keiner Route mehr angefasst. Geprüft wird ausschliesslich gegen den
// Anfragenden der aktuellen Anfrage — nie gegen `author`.
//
// ALTBESTAND. Objekte aus mega20 tragen `createOperationId` OHNE Datensatz. Für sie bleibt der
// alte Vergleich gegen `author` in Kraft (adoptCreatedKo) — nicht weil er richtig wäre, sondern
// weil es keine bessere Information gibt und ein blindes „gehört niemandem" jeden Altvorgang zum
// Konflikt machte. Neue Objekte tragen den Datensatz ab dem ersten Insert.
//
// --------------------------------------------------------------------------------------------
// (2) DER INHALTSABDRUCK — die Kanonisierungsregel, an dem Ort, wo sie gilt
// --------------------------------------------------------------------------------------------
//
// mega20 band den Vorgang NUR an den Schlüssel. Ändert der Nutzer nach unklarem Ausgang seinen
// Text und klickt erneut, lieferte der Server das ALTE Objekt, die Oberfläche leerte danach die
// Eingaben und zeigte die generische Erfolgskarte: STILLER VERLUST DER ÄNDERUNG.
//
// Der Abdruck macht daraus eine ehrliche Auskunft. Gleicher Schlüssel + gleicher Abdruck ⇒ 200 mit
// demselben Objekt (die WIEDERHOLUNG, für die der Schlüssel existiert). Gleicher Schlüssel +
// ABWEICHENDER Abdruck ⇒ `IDEMPOTENCY_PAYLOAD_MISMATCH`, und die Oberfläche bietet an, den Vorgang
// neu zu beginnen. Nie mehr ein Alt-Erfolg für neuen Text.
//
// DIE EIGENTLICHE ARBEIT IST DIE KANONISIERUNG, und sie steht deshalb hier ausgeschrieben und ist
// mit einem Test gepinnt. Unser eigener Audit-Befund war die Lehre: eine Reihenfolge, auf die sich
// niemand festgelegt hat, wird irgendwann zur Falschmeldung. Die Regel, in Kraft ab mega21:
//
//   K1 · PRÄFIX. Der gehashte Text beginnt mit `createop-v1\n`. Ändert sich die Regel je, ändert
//        sich das Präfix — dann kollidiert ein neuer Abdruck nie stillschweigend mit einem alten.
//   K2 · ABWESENHEIT IST EIN WERT, und zwar IMMER DERSELBE. `undefined`, `null`, der leere String
//        und der nur aus Leerraum bestehende String sind ununterscheidbar ABWESEND und fallen weg.
//        `asset: null` und ein fehlendes `asset` sind derselbe Inhalt — sonst erzeugte allein die
//        Frage, ob die Oberfläche ein leeres Feld mitschickt, einen Konflikt.
//        GELTUNGSBEREICH ab mega22: K2 gilt für den STRUKTURTEIL des Abdrucks — also für das, was
//        die Route selbst deterministisch aufbaut (Dokumente, Belegstellen, Prüfermenge). Für eine
//        SCHREIBLADUNG gilt K2 NICHT; dort ist Anwesenheit selbst ein Wert (K8).
//   K3 · ZEICHENKETTEN werden per NFC normalisiert und aussen getrimmt. Innen NICHT: doppelter
//        Leerraum in einem Absatz ist Inhalt, kein Formatierungsrauschen, und der Server trimmt
//        die Labels später an genau derselben Stelle.
//   K4 · OBJEKTE: Schlüssel LEXIKOGRAPHISCH sortiert (Code-Unit-Ordnung, `Array.prototype.sort`
//        ohne Kollator — locale-abhängige Sortierung wäre eine Regel, die auf zwei Maschinen
//        verschieden lautet). Abwesende Werte fallen vorher weg; ein danach LEERES Objekt ist
//        selbst abwesend (K2).
//   K5 · LISTEN behalten ihre REIHENFOLGE. Sie ist Inhalt: die Reihenfolge der Ankerdokumente
//        bestimmt die Reihenfolge der Anhänge, die der Belegstellen die der Quellen. Abwesende
//        Elemente fallen weg; eine danach LEERE Liste ist selbst abwesend (K2).
//        EINE AUSNAHME, benannt: `reviewerIds` wird als MENGE behandelt (dedupliziert, sortiert) —
//        die Route tut mit `[...new Set(...)]` genau dasselbe, bevor sie zuweist. Eine andere
//        Klickreihenfolge in der Prüferauswahl ist kein anderer Vorgang.
//   K6 · ZAHLEN nur endlich (NaN/Infinity sind abwesend), BOOLEANS unverändert. Alles andere
//        (Funktionen, Symbole, undefined) ist abwesend.
//   K7 · SERIALISIERUNG mit `JSON.stringify` über die kanonisierte Struktur, dann SHA-256, hex.
//   K8 · EINE SCHREIBLADUNG WIRD NACH IHRER SCHREIBSEMANTIK KANONISIERT, nicht nach ihrer Gestalt.
//        Neu in mega22, s. den eigenen Abschnitt unten. Sie geht als EIN vorserialisierter Text in
//        den Abdruck ein (`alsSchreibpatch`) und ist damit gegen K2 des äusseren Laufs immun.
//
// WAS IN DEN ABDRUCK GEHT, entscheidet der Aufrufer (ko-routes.ts) — die Regel hier sagt nur, WIE
// gehasht wird. Die dortige Auswahl ist ebenfalls ausgeschrieben; kurz: der Inhalt der Erstanlage
// und die Ankerdokumente mit ihren Belegstellen, NICHT die Vorschaubilder (abgeleitete Anzeigedaten
// in Kilobytegröße, die sich bei gleichem Inhalt unterscheiden dürfen) und NICHT `draftId` oder
// `operationId` (Adressierung, nicht Inhalt).
//
// --------------------------------------------------------------------------------------------
// (3) DER ZUSTAND — ein Reparaturrest ist kein Erfolg
// --------------------------------------------------------------------------------------------
//
// Scheitert nach dem Insert die Evidence-Folge UND danach `repo.delete`, markiert
// `rollbackCreatedKo` den Rest mit `needsRepair`. `adoptCreatedKo` prüfte das in mega20 NICHT und
// hätte denselben Rest beim nächsten Versuch als Erfolg zurückgegeben — der Client behält den
// Schlüssel bei 5xx, der nächste Klick liefert also ein unvollständig belegtes Objekt als 200.
//
// Der Zustand `repair_required` schliesst das: er wird im SELBEN `repo.update` gesetzt, das den
// Vermerk schreibt, und `adoptCreatedKo` wirft darauf `CREATE_REPAIR_REQUIRED` statt zu liefern.
// Er ist zugleich der TRÄGER der Wiederaufnahme-Warteschlange, die ben zusätzlich vorschlägt und
// die ausdrücklich Nach-VIP-2 ist: sie braucht genau dieses Feld, um ihre Arbeit zu finden.
//
// EHRLICHE GRENZE, unverändert aus mega20: das `repo.update` ist best effort. Kommt es in derselben
// Störung nicht durch, bleibt der Rest OHNE `repair_required` stehen — dann greift die zweite
// Verteidigungslinie: `adoptCreatedKo` prüft AUCH `needsRepair` (denselben Zustand aus der anderen
// Richtung) und der geworfene `CREATE_ROLLBACK_FAILED` nennt die Kennung unabhängig von beidem.
//
// --------------------------------------------------------------------------------------------
// (4) DER VERFÜGBARKEITSVERTRAG DER KENNUNG — AUFTRAG-mega22 Block G
// --------------------------------------------------------------------------------------------
//
// MEINE EINSCHÄTZUNG AUS mega21 WAR FALSCH, und ben hat sie widerlegt. Ich hatte den Restfall so
// beschrieben: „wer eine kurze Kennung rät und besetzt, nimmt sie dem rechtmäßigen Aufrufer weg;
// der bekommt einen ehrlichen 409 und einen neuen Schlüssel — unbequem, aber nichts geht verloren."
// Das stimmt für den EINZELFALL und verfehlt die Klasse. Die Belegung ist keine Unbequemlichkeit,
// sondern eine gezielte DENIAL-KANTE: die Eindeutigkeit galt über ALLE Actor hinweg, und ein Nutzer
// mit `ko.create` und einem gültigen Dokument konnte vorhersehbare kurze Kennungen reservieren und
// einen anderen Client dauerhaft aus seinem Vorgang drängen. Ein flächiges Ausschöpfen des
// achtstelligen Raums ist unrealistisch; gezieltes Belegen VORHERSEHBARER Kennungen ist es nicht.
//
// bens Ruling, das ich übernehme: acht Zeichen sind als reine SYNTAXGRENZE vertretbar, aber nicht
// als VERFÜGBARKEITSVERTRAG.
//
// ZWEI ZULÄSSIGE WEGE, und warum es DIESER wird:
//
//   (a) ACTOR-GEBUNDENE EINDEUTIGKEIT `(actor, operationId)` statt der DB-weiten.
//   (b) Eine eigene ENTROPIEREGEL nur für die Erstanlage, ohne den Append-Vertrag anzufassen —
//       `OPERATION_ID_PATTERN` bliebe, was es ist, und die Erstanlage bekäme ihre eigene, engere
//       Prüfung.
//
// ES WIRD (a). (b) ist billiger und ich habe es ernsthaft erwogen: es kostet keine Migration, lässt
// den Postgres-Beweis unberührt und macht das gezielte Belegen praktisch unmöglich. Aber es
// beseitigt die Kante nicht, es verlegt sie hinter eine Wahrscheinlichkeit. Der Kennungsraum bliebe
// GETEILT — die Schreiboperation eines Nutzers schränkte weiterhin ein, was ein anderer schreiben
// kann. Das ist die Definition einer Verfügbarkeitskopplung, und sie träfe genau die Aufrufer, die
// gute Gründe für DETERMINISTISCHE Kennungen haben (ein Stapelimport mit
// `import-2026-07-26-zeile-17` ist ein legitimer, wiederholbarer Vorgang und wäre unter (b) schlicht
// verboten). (a) nimmt der Belegung die GRUNDLAGE: der Kennungsraum ist pro Anfragendem privat,
// eine fremde Kennung ist keine Kollision mehr, sondern eine andere Adresse.
//
// DER PREIS IST BENANNT UND BEZAHLT. (a) berührt den partiellen Unique-Index und damit den Kern,
// den mega21 Block D gegen echtes Postgres belegt hat. Der Beweis ist deshalb mit derselben
// Sorgfalt nachgezogen worden, nicht nur der Index (create-operation-pg.integration.test.ts) —
// inklusive der von ben verlangten Auflage, mit ZWEI Pools statt einem geteilten zu arbeiten.
//
// DIE 8 ZEICHEN BLEIBEN, und jetzt ehrlich als das, was sie sind: eine Syntaxgrenze. Sie ist ein
// Vertrag, den `OPERATION_ID_PATTERN` mit dem Append-Weg TEILT (eine Quelle der Wahrheit), und der
// Append-Weg ist dreimal von ben abgenommen und steht unter NICHT ANFASSEN. Sie trägt nach diesem
// Block auch keine Sicherheitslast mehr: der Schutz hängt an der Eigentümerbindung, nicht an der
// Ratbarkeit. Der offizielle Client vergibt ohnehin `create-${crypto.randomUUID()}`.
//
// WAS BLOCK E ERGÄNZT, NICHT ERSETZT: der kontrollierte Kollisionsausstieg in der Oberfläche
// („Neuen Vorgang beginnen") lindert die FOLGE einer Kollision. Er ist nötig — für den
// Abdruckkonflikt und für die verbleibende Altzeilen-Kollision — aber er wäre als alleinige Antwort
// auf diesen Befund die Behandlung eines Symptoms gewesen.

// ============================================================================================
// AUFTRAG-mega22 Block A — K8: DER ABDRUCK BILDET AB, WAS DER REQUEST SCHREIBEN WIRD
// ============================================================================================
//
// bens SB-A, SB-B und SB-D sind DERSELBE Mangel aus drei Richtungen, und die Antwort ist deshalb
// EINE Regel und nicht drei Reparaturen:
//
//     DER ABDRUCK MUSS GENAU DAS ABDECKEN, WAS DIESER REQUEST SCHREIBEN WIRD —
//     nicht mehr (sonst entstehen Konflikte ohne Anlass) und vor allem nicht weniger
//     (sonst wird ein anderer Schreibvorgang als Wiederholung adoptiert).
//
// WORAN K2 GESCHEITERT IST. `draftPayload` ist kein Inhaltsdokument, sondern ein MERGE-PATCH: der
// Entwurfs-Merge (services/capture/src/service.ts, mergeDraftPayload) macht genau den Unterschied,
// den K2 einebnet.
//
//     Schlüssel FEHLT (oder `undefined`)     ⇒ Altwert BLEIBT.
//     Schlüssel DA mit Leerwert ("", [], {}) ⇒ Altwert GEHT.
//
// Zwei Anfragen, von denen die eine den Body bewahrt und die andere ihn löscht, trugen nach K2
// denselben Abdruck. Unter demselben Vorgangsschlüssel entschied damit der GEWINNER eines Rennens,
// ob Inhalt erhalten bleibt oder verschwindet — und der Verlierer bekam 200 statt eines ehrlichen
// `IDEMPOTENCY_PAYLOAD_MISMATCH`. Das ist die teure Richtung: ein stiller Alt-Erfolg für einen
// Schreibvorgang, den der Nutzer so nie ausgelöst hat.
//
// DER GEWÄHLTE WEG: SEMANTIKTREUER ABDRUCK, nicht Ersetzungsvertrag. Die Alternative — aus
// `draftPayload` einen vollständigen Ersetzungsvertrag zu machen, sodass „fehlt" bedeutungslos wird
// — ist der EINFACHERE Vertrag, aber der falsche Bau, aus drei Gründen:
//
//   · Sie bräche den Merge, an dem fünf von sieben Frontend-Aufrufern HÄNGEN (Mobile ×2, Vordertür
//     ×2, Offline-Queue senden bewusst nur einen Ausschnitt). Entweder änderten wir `PUT
//     /api/drafts/:id` mit — dann löscht jedes Mobil-Speichern Body und Metadaten — oder derselbe
//     `DraftPayload` bedeutete auf zwei Routen zwei verschiedene Dinge. Zwei Auffassungen desselben
//     Vertrags sind genau das, was dieses Projekt an jeder anderen Stelle zusammenführt.
//   · Sie verschöbe eine LÖSCHENTSCHEIDUNG in die Oberfläche. Ein Feld, das ein künftiger Client
//     nicht kennt und deshalb nicht mitschickt, würde beim Einreichen still entfernt. Wir tauschten
//     eine Abdruck-Ungenauigkeit gegen eine Datenverlust-Klasse.
//   · Und sie behebt das eigentliche Problem nicht, sondern verbirgt es: die Frage „deckt der
//     Abdruck den Schreibvorgang?" bliebe für jede künftige Ladung offen. K8 beantwortet sie.
//
// WIE K8 ARBEITET. Eine Schreibladung wird STRENG kanonisiert und als EIN vorserialisierter Text in
// den Abdruck gehängt. Der Text ist ein String und überlebt damit den äusseren, absichtlich
// abwesenheits-blinden Lauf (K2) unverändert — die beiden Regeln können sich nicht in die Quere
// kommen, weil sie nie auf denselben Wert angewandt werden.
//
//   K8.1 · ANWESENHEIT IST INHALT. Ein Schlüssel, den die Ladung TRÄGT, steht im kanonischen Text —
//          auch mit `null`, `""`, `[]` oder `{}`. Nur ein Schlüssel mit `undefined` fällt weg, und
//          zwar weil er über JSON gar nicht erst ankommt: `JSON.stringify` lässt ihn fallen, und
//          `mergeDraftPayload` behandelt ihn ausdrücklich wie „nicht mitgeschickt". K8.1 bildet
//          damit exakt die Grenze ab, die der Merge zieht — keine strengere und keine mildere.
//   K8.2 · K3 BLEIBT (NFC, aussen getrimmt). Ein Tastaturwechsel ist keine Inhaltsänderung, und der
//          Server trimmt an derselben Stelle. Ein String, der zu nichts trimmt, wird `""` — er ist
//          dann eine ausdrückliche Leerung und nicht abwesend.
//   K8.3 · K4/K5 BLEIBEN (Objektschlüssel sortiert, Listenreihenfolge ist Inhalt); Listeneinträge
//          fallen NICHT weg, denn eine Liste mit einem leeren Eintrag schreibt anders als eine ohne.
//   K8.4 · NaN/Infinity/Funktionen/Symbole werden `null` — genau das, was `JSON.stringify` aus
//          ihnen macht, bevor der Server sie überhaupt sieht.
//
// EHRLICHE GRENZE, benannt statt verschwiegen: `mergeDraftPayload` merged NUR auf der obersten
// Ebene — ein mitgeschickter Schlüssel ERSETZT seinen Altwert vollständig. Die Anwesenheits-Regel
// K8.1 ist deshalb an der obersten Ebene semantisch exakt. Tiefer liegende Unterschiede sind keine
// Merge-Entscheidungen mehr, sondern Werte innerhalb eines ersetzten Werts; K8 bildet sie trotzdem
// ab (es kanonisiert durchgängig streng), was höchstens strenger ist als nötig, nie milder.

/**
 * AUFTRAG-mega21 Block A — die Kanonisierung, als Funktion. Die Regeln K1–K7 stehen oben; diese
 * Funktion IST ihre einzige Umsetzung, damit Regel und Code nicht auseinanderlaufen können.
 *
 * Liefert `undefined` für alles, was nach K2 ABWESEND ist — der Aufrufer lässt es dann weg.
 */
function kanonisieren(wert: unknown): unknown {
  if (typeof wert === "string") {
    const getrimmt = wert.normalize("NFC").trim(); // K3
    return getrimmt.length > 0 ? getrimmt : undefined; // K2
  }
  if (typeof wert === "number") {
    return Number.isFinite(wert) ? wert : undefined; // K6
  }
  if (typeof wert === "boolean") {
    return wert; // K6
  }
  if (Array.isArray(wert)) {
    const eintraege = wert.map(kanonisieren).filter((e) => e !== undefined); // K5
    return eintraege.length > 0 ? eintraege : undefined; // K2
  }
  if (wert !== null && typeof wert === "object") {
    const aus: Record<string, unknown> = {};
    // K4: lexikographisch, ohne Kollator — dieselbe Ordnung auf jeder Maschine.
    for (const schluessel of Object.keys(wert as Record<string, unknown>).sort()) {
      const kanonisch = kanonisieren((wert as Record<string, unknown>)[schluessel]);
      if (kanonisch !== undefined) {
        aus[schluessel] = kanonisch;
      }
    }
    return Object.keys(aus).length > 0 ? aus : undefined; // K2
  }
  return undefined; // null, undefined, Funktionen, Symbole — K2/K6
}

/**
 * AUFTRAG-mega22 Block A — K8.1 bis K8.4, als Funktion. Der STRENGE Zweig der Kanonisierung: er
 * unterscheidet, was `kanonisieren` bewusst einebnet.
 *
 * Der Unterschied zu `kanonisieren` steht in genau zwei Zeilen: `null`, `""`, `[]` und `{}` kommen
 * hier als WERTE zurück statt als `undefined`, und Objektschlüssel überleben ihren leeren Wert.
 * Alles andere (NFC, Trim, Sortierung, Listenreihenfolge) ist bewusst DIESELBE Regel — zwei
 * Auffassungen davon, was ein Umlaut ist, hätten wir uns nicht leisten können.
 */
function kanonisierenStreng(wert: unknown): unknown {
  if (typeof wert === "string") {
    return wert.normalize("NFC").trim(); // K8.2 — "" bleibt "", statt zu verschwinden
  }
  if (typeof wert === "number") {
    return Number.isFinite(wert) ? wert : null; // K8.4 — wie JSON.stringify
  }
  if (typeof wert === "boolean") {
    return wert;
  }
  if (wert === null) {
    return null; // K8.1 — ein ausdrückliches null ist eine Löschanweisung, kein Nichts
  }
  if (Array.isArray(wert)) {
    // K8.3: Reihenfolge ist Inhalt, und KEIN Eintrag fällt weg.
    return wert.map(kanonisierenStreng);
  }
  if (typeof wert === "object") {
    const aus: Record<string, unknown> = {};
    for (const schluessel of Object.keys(wert as Record<string, unknown>).sort()) {
      const roh = (wert as Record<string, unknown>)[schluessel];
      if (roh === undefined) {
        continue; // K8.1 — über JSON nicht unterscheidbar von „gar nicht mitgeschickt"
      }
      aus[schluessel] = kanonisierenStreng(roh);
    }
    return aus;
  }
  return null; // K8.4 — Funktionen, Symbole
}

/**
 * Die Version der SCHREIBLADUNGS-Kanonisierung, getrennt vom äusseren Präfix. Sie steht IM
 * serialisierten Text, damit eine spätere Änderung an K8 den Abdruck ändert, auch wenn K1–K7
 * unberührt bleiben.
 */
export const CREATE_OPERATION_WRITE_PATCH_VERSION = "patch-v1";

/**
 * AUFTRAG-mega22 Block A — EINE SCHREIBLADUNG ALS ABDRUCK-BAUSTEIN.
 *
 * Der Rückgabewert ist ein TEXT und kein Objekt. Das ist der ganze Trick und er ist Absicht: als
 * Text läuft die Ladung durch den äusseren, abwesenheits-blinden Lauf (K2) hindurch, ohne dass
 * dieser ihre Leerwerte wegräumt. Ein Objekt zurückzugeben hiesse, K2 und K8 auf denselben Wert
 * anzuwenden — und die mildere Regel gewönne.
 *
 * `undefined` (gar keine Ladung) ist von einer LEEREN Ladung `{}` unterscheidbar: die erste schreibt
 * nichts, die zweite schreibt „nichts ändern, aber ich habe eine Ladung geschickt". Nach Block C
 * kann der erste Fall auf dem Entwurfsweg nicht mehr auftreten; unterschieden wird er trotzdem,
 * denn ein Abdruck, der zwei Zustände gleichsetzt, ist genau der Mangel, den dieser Block schliesst.
 */
export function alsSchreibpatch(ladung: unknown): string {
  const kanonisch = ladung === undefined ? null : kanonisierenStreng(ladung);
  return `${CREATE_OPERATION_WRITE_PATCH_VERSION}\n${JSON.stringify(kanonisch)}`;
}

/**
 * Das Präfix aus K1. Ändert sich die Kanonisierungsregel, ändert sich dieser Wert MIT.
 *
 * AUFTRAG-mega22 Block A: `createop-v1` → `createop-v2`. K8 ist eine Änderung der Regel, und K1
 * existiert genau für diesen Fall — ein nach der neuen Regel gebildeter Abdruck darf NIE
 * stillschweigend mit einem nach der alten Regel gebildeten kollidieren. Ein Vorgang aus der Zeit
 * vor mega22 trägt `createop-v1`; sein Wiederholversuch trägt `createop-v2`, sieht damit einen
 * abweichenden Abdruck und bekommt `IDEMPOTENCY_PAYLOAD_MISMATCH` statt still das alte Objekt.
 * Das ist die richtige Auskunft: unter der alten Regel WAR nicht entscheidbar, ob es derselbe
 * Schreibvorgang war.
 */
export const CREATE_OPERATION_FINGERPRINT_VERSION = "createop-v2";

/**
 * AUFTRAG-mega21 Block A — DER KANONISCHE INHALTSABDRUCK EINER ERSTANLAGE-ANFRAGE.
 *
 * Regeln, Begründung und die Liste dessen, was hineingehört, stehen oben. Der Rückgabewert ist ein
 * SHA-256 in Hex — kein Geheimnis und keine Signatur, sondern ein Vergleichswert: er beantwortet
 * genau eine Frage, nämlich ob zwei Anfragen DERSELBE Inhalt sind.
 */
export function createOperationFingerprint(payload: unknown): string {
  const kanonisch = kanonisieren(payload) ?? {};
  return createHash("sha256")
    .update(`${CREATE_OPERATION_FINGERPRINT_VERSION}\n${JSON.stringify(kanonisch)}`)
    .digest("hex");
}

/**
 * AUFTRAG-mega21 Block A — die Mengen-Ausnahme aus K5, als benannte Funktion statt als verstreutes
 * `[...new Set(x)].sort()`. Die Route dedupliziert Prüfer mit derselben Semantik, bevor sie
 * zuweist; hier steht sie, damit der Abdruck nicht an einer Klickreihenfolge hängt.
 */
export function alsMenge(werte: readonly string[] | undefined): string[] {
  return [...new Set((werte ?? []).map((w) => w.trim()).filter((w) => w.length > 0))].sort();
}
