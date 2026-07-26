// SCRUM-121: interner Objekt-/Attachment-Speicher. Hält Originale/Binärdaten getrennt
// vom KO-Modell; das KO trägt nur eine ObjectRef + kleine Vorschau. KEIN S3/Cloud.
// SCRUM-382: "video" umfasst Video- UND Audio-Dateien (beide transkribierbar).
export type ObjectKind = "image" | "document" | "video" | "binary";

// ============================================================================================
// AUFTRAG-mega20 Block C — DER LEBENSZYKLUS-VERTRAG AM OBJEKT.
// ============================================================================================
//
// DER BEFUND. Bis mega19 wusste ein gespeichertes Objekt NICHTS über sich selbst außer Name, Typ,
// Größe, Zeitpunkt und (optional) Vertraulichkeit. Es gab keine Antwort auf die beiden Fragen, die
// jede Aufräumentscheidung braucht:
//
//   · WOZU existiert dieses Objekt? (Anker eines Wissensobjekts · allgemeiner Anhang · rein
//     transientes Medium für eine Analyse · Beispielpaket)
//   · WER hat es hochgeladen, und hängt es (noch) an einem Entwurf?
//
// Ohne diese Angaben ist „unreferenziert" nicht von „gerade erst hochgeladen und noch nicht
// gebunden" zu unterscheiden — und genau dieser Unterschied entscheidet zwischen einer korrekten
// Aufräumung und einem Datenverlust. Deshalb kommt ZUERST der Datenvertrag und ERST DANACH,
// getrennt, ein Lauf. Der Waisen-Sweep wird hier bewusst NICHT gebaut; bis dahin sind
// Speicherreste der sichere Preis.
//
// WARUM DAS AM OBJEKT STEHT UND NICHT IN EINER NEBENTABELLE. Ein zweiter Ort könnte fehlen,
// veralten oder beim Löschen zurückbleiben. Die Zuordnung ist eine Eigenschaft des Objekts, also
// steht sie im Objekt — im selben Schreibvorgang, der es erzeugt.
//
// WAS ES AUSDRÜCKLICH NICHT IST. Keine Berechtigung. `owner` sagt, WER hochgeladen hat, nicht wer
// lesen darf; die Leserechte hängen unverändert an den Routen. `purpose` steuert keine Prüfung —
// er beschreibt eine Absicht, damit ein späterer Lauf sie berücksichtigen kann.

/**
 * WOZU ein Objekt hochgeladen wurde. Vom Aufrufer DEKLARIERT, nicht erraten: Absicht ist nichts,
 * was sich aus MIME-Typ und Größe ableiten ließe, und ein geratener Zweck wäre schlimmer als
 * keiner — er sähe aus wie Wissen.
 */
export type ObjectPurpose =
  // Das Original, aus dem Inhalt übernommen wurde. Es wird ANKER eines Wissensobjekts und ist
  // damit Teil der Belegkette — das am strengsten aufzubewahrende Objekt, das es hier gibt.
  | "anchor"
  // Ein ganz normaler Anhang (Bild, Datei) an einem Wissensobjekt oder Entwurf.
  | "attachment"
  // TRANSIENTES MEDIUM: nur hochgeladen, damit eine Analyse/Transkription darauf laufen kann.
  // Es ist NICHT dafür gedacht, dauerhaft referenziert zu werden — und genau deshalb muss es
  // unterscheidbar sein: ohne diesen Marker sähe es aus wie ein verwaister Anhang.
  | "media"
  // Aus einem Beispielpaket/Seed erzeugt. Gehört zum Demobestand, nicht zum Nutzerbestand.
  | "example"
  // ALTBESTAND oder nicht deklariert. Konservativ zu behandeln: über ein solches Objekt weiß
  // niemand etwas, also darf niemand etwas über es annehmen.
  | "unknown";

/**
 * Die Lebenszyklus-Zuordnung eines Objekts.
 *
 * `retainUntil` ist die KONSERVATIVE AUFBEWAHRUNG und zugleich die Antwort auf „laufender Upload
 * gilt nicht als Waise": zwischen dem Upload und dem Moment, in dem eine Referenz entsteht, liegt
 * ein Fenster (der Nutzer füllt noch das Formular, der Entwurf ist noch nicht gespeichert, der
 * Einreich-Vorgang läuft noch). In diesem Fenster IST das Objekt unreferenziert und trotzdem
 * lebendig. Die Frist deckt es ab — großzügig bemessen, weil ein zu früh gelöschtes Original nicht
 * wiederherstellbar ist und ein zu spät gelöschtes nur Platz kostet.
 */
export interface ObjectLifecycle {
  purpose: ObjectPurpose;
  /** Wer hochgeladen hat (Nutzer-Id). Keine Berechtigung — eine Herkunftsangabe. */
  owner?: string;
  /** Bindung an einen Entwurf, solange noch kein Wissensobjekt existiert. */
  draftId?: string;
  /** Bis zu diesem Zeitpunkt (ISO) gilt das Objekt NIE als Waise, auch ohne jede Referenz. */
  retainUntil: string;
}

// Konservative Schutzfrist ab Upload. Bewusst großzügig: sie ist kein Aufbewahrungs-, sondern ein
// SICHERHEITSfenster gegen die Fehleinschätzung „unreferenziert = überflüssig". Ein gebundenes
// Objekt schützt ohnehin die Referenzprüfung — dauerhaft und unabhängig von dieser Frist.
export const OBJECT_RETENTION_DAYS = 30;

// Metadaten-Referenz (ohne Bytes) — genau das, was im KO/Draft gespeichert wird.
export interface ObjectRef {
  id: string;
  name: string;
  mime: string;
  size: number;
  kind: ObjectKind;
  createdAt: string;
  // AUFTRAG-mega20 Block C: die Lebenszyklus-Zuordnung. OPTIONAL im Typ, weil Altbestand sie nicht
  // hat — wer sie liest, muss das Fehlen als „unknown, unbekannter Eigentümer, keine Frist"
  // behandeln und damit maximal konservativ. Neue Uploads setzen sie IMMER (ObjectStore.put).
  lifecycle?: ObjectLifecycle;
  // SCRUM-521 (WP1): serverseitig PERSISTIERTE Vertraulichkeit des Objekts (Level-String, z. B.
  // "intern"/"vertraulich"/"streng_vertraulich"). Beim Upload gesetzt; die Egress-Entscheidung (Medien-
  // Transkription) liest AUSSCHLIESSLICH diesen Wert — nie den Analyse-Request. Fehlt er, gilt fail-safe
  // vertraulich (kein externer Egress). object-store bleibt von knowledge-object entkoppelt → plain string.
  confidentiality?: string;
}

// Gespeichertes Objekt = Referenz + Inhalt (Daten-URL/Base64-String).
export interface StoredObject {
  ref: ObjectRef;
  data: string;
}

export type ObjectErrorCode = "NOT_FOUND" | "INVALID";

export class ObjectError extends Error {
  readonly code: ObjectErrorCode;

  constructor(code: ObjectErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = "ObjectError";
  }
}

// Obergrenze fürs Original (großzügiger als das KO-Thumbnail-Limit, aber begrenzt).
// WP-D2 („Original ist heilig"): dokumententauglich angehoben — echte Nutzer-PDF/DOCX liegen oft bei
// mehreren MB; gemessen wird die Data-URL-Länge (Base64 ≈ Dateigröße × 1,37). 30 MB Data-URL ≈ ~22 MB
// Datei; der HTTP-Transport wird vom expliziten Route-bodyLimit (object-routes) gedeckelt.
export const MAX_OBJECT_BYTES = 30_000_000; // ~30 MB Data-URL (~22 MB Datei)
