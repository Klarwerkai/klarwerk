// ================================================================================================
// AUFTRAG-mega64/65 BLOCK B — NICHT „DIESER TAB IST GESPERRT", SONDERN „EINE ABMELDUNG IST
// GESCHULDET".
// ================================================================================================
//
// Diese Datei ersetzt `app/signOutLock.ts` aus mega63. Der Umbau war keine Fehlerbehebung, sondern
// eine BEGRIFFSKORREKTUR — und die alte Datei trug ihren Fehler in der Begründung, nicht im Code.
//
// SIE SAGTE: „Der Merker gehört zu GENAU DIESEM Tab und GENAU DIESER gescheiterten Abmeldung."
// Das ist falsch, und ben hat es belegt (BERICHT-ben-sammel61-mega63.md, Finding 2):
//
//     Was hier festgehalten wird, ist keine Eigenschaft eines TABS. Es ist eine Eigenschaft der
//     SITZUNG — und die Sitzung hängt an einem Cookie, das alle Tabs teilen. Ein bereits offener
//     zweiter Tab bekam den `sessionStorage`-Merker nie und zeigte mit demselben Cookie weiter
//     geschützte Inhalte. Die Zusage war also genau dort unwahr, wo sie zählt.
//
// DER RICHTIGE BEGRIFF LÖST BEIDES AUF EINMAL. Der Zustand ist: „dem Server ist eine Abmeldung
// geschuldet, und er hat sie noch nicht bestätigt." Daraus folgt von selbst —
//
//   · Er gilt TABÜBERGREIFEND, weil die Schuld nicht am Tab hängt. Also `localStorage` plus das
//     `storage`-Ereignis, das die anderen Tabs im selben Moment erreicht.
//   · Er LÖST SICH AUF, sobald der Server erreichbar ist und die Abmeldung bestätigt, oder sobald
//     sicher feststeht, dass gar keine Sitzung mehr besteht. Es ist damit kein Zustand ohne Ausgang,
//     sondern ein Vorgang mit Ende — deshalb gehört ein Wiederholversuch bei nächster
//     Erreichbarkeit dazu (er lebt in `AuthContext`, wo die Sitzung wohnt).
//
// ================================================================================================
// AUFTRAG-mega65 BLOCK B — DIE 24-STUNDEN-ZUSAGE WIRD EINGELÖST, INDEM SIE VERSCHWINDET.
// ================================================================================================
//
// HIER STAND EINE FRIST, UND SIE WAR ZWEIMAL UNWAHR. ben hat es belegt (sammel62, ROT-2), der Kopf
// hat es am Code nachgeprüft:
//
//   1. `abmeldeschuldGesetzt()` gab bei `inDiesemLauf` sofort `true` zurück und LAS die gespeicherte
//      Frist nie. In genau dem Tab, in dem die Abmeldung scheiterte, lief sie deshalb nicht ab.
//   2. Ein beschädigter Eintrag (`JSON.parse` wirft, `bis` nicht endlich) führte auf `return true`
//      OHNE Ersatzfrist — sperrte also über Neustarts hinweg unbegrenzt.
//
// Dagegen stand in DE, EN und NL der Satz, der Merker verfalle „spätestens nach vierundzwanzig
// Stunden von selbst" (`i18n.ts`, `legal.privacy.s4.p7`). Eine falsche Tatsachenaussage in einer
// Rechtsfläche ist der eine Fehler, gegen den diese ganze Woche gebaut wurde.
//
// DIE ANTWORT IST EINE WEGNAHME, KEIN ZEITGEBER — und sie ist weniger Code als vorher hier stand.
// Der einfachste Weg, eine Zusage einzulösen, die nicht gehalten wird, ist zu prüfen, ob es sie
// braucht. Es braucht sie nicht:
//
//   · Die Schuld entsteht AUSSCHLIESSLICH IM ABLEHNUNGSABLAUF; derselbe strenge Weg
//     (`signOut({ strict: true })`) wird auf der daraus entstandenen Sperrfläche erneut verwendet.
//     Es sind also zwei Aufrufer — die erstmalige Ablehnung (`legal/NoticeBanner.tsx:209`) und der
//     Wiederholknopf (`legal/SignOutBlocked.tsx:46`) —, und der zweite eröffnet keinen fremden
//     Entstehungsweg: er ist nur erreichbar, wenn der Ablehnungsablauf die Schuld schon erzeugt
//     hat. Wer sie hat, hat „Nicht einverstanden" gedrückt. Für diese Person ist „gesperrt, bis die
//     Beendigung bestätigt ist" keine Härte, sondern der Zweck.
//     (Hier stand bis mega65 „hat genau einen Aufrufer". Das war wörtlich falsch, ben hat es
//     gefunden — GELB-2 in sammel63 —, und es war dieselbe Fehlerform, gegen die diese Woche
//     gebaut wurde: ein Kommentar, der mehr behauptet, als der Code trägt. Die tragende Aussage
//     bleibt, ihre Begründung ist jetzt die nachprüfbare.)
//   · Die Frist war nur ein Ventil gegen dauerhaftes Aussperren. Dieses Ventil gibt es bereits,
//     dreifach und von ben grün geprüft: der bestätigte manuelle Wiederholversuch, der bewiesene
//     401 auf `/auth/me`, und die echte Abmelderoute, die einen tokenlosen Aufruf mit 204 annimmt.
//     Seit mega65 kommt der Versuch beim Aufbau der Anwendung dazu (`AuthContext`, bens GELB-1) —
//     eine offene Schuld löst sich damit ohne jedes Zutun auf, sobald der Server antwortet. Ein
//     Server, der das vierundzwanzig Stunden lang nicht tut, ist ein Server, bei dem das ganze
//     Produkt steht.
//
// WAS DAMIT WEGFÄLLT, und das ist der eigentliche Gewinn: das Auslesen und Auswerten von `bis`, die
// Fallunterscheidung für beschädigte Einträge (ein beschädigter Eintrag IST ein vorhandener Merker,
// und mehr muss er nicht bedeuten), `ABMELDESCHULD_DAUER_MS` und jede Zeitrechnung. Die Ursache der
// beiden Befunde ist nicht geflickt, sondern weg. Der Text sagt jetzt genau das (`s4.p7`), und der
// Sammler `tests/legal/mega63-speicher-aufzaehlung.test.ts` hält beide Seiten zusammen: solange der
// Code keine Frist führt, darf die Aufzählung keine behaupten.
//
// ZUR RICHTUNG DES LESERS — FAIL-CLOSED, UND ZWAR GENAU SO WEIT WIE ES TRÄGT:
// `localStorage` wirft in abgeschotteten Browserzuständen (verschärfter Datenschutzmodus,
// iframe-Beschränkungen) schon beim LESEN. Zwei Fälle, zwei verschiedene richtige Antworten:
//
//   1. Der Speicher verweigert sich, während dieser Lauf die Schuld bereits gesetzt hat → GESETZT.
//      Dafür sorgt `inDiesemLauf`: ein werfender Speicher kann eine festgestellte Schuld nicht
//      wieder wegnehmen. Das ist die Richtung, in der fail-closed wirklich schützt.
//   2. Der Speicher verweigert sich bei einem KALTEN Start, ohne dass dieser Lauf etwas festgestellt
//      hätte → NICHT GESETZT, und das ist kein Versehen. Andernfalls wäre jede Nutzerin mit
//      abgeschottetem Speicher dauerhaft ausgesperrt, ohne Ausweg: der Ausweg braucht ein Löschen,
//      und Löschen wirft in genau diesem Zustand ebenfalls. Eine Sperre ohne Ausgang ist schlimmer
//      als der Fehler, gegen den sie steht — dieselbe Abwägung, die mega63 A3/A4 schon getroffen
//      haben. ben hat sie in sammel62 ausdrücklich als „vertretbar und für sich kein Ship-Blocker"
//      bestätigt.
//
// Der Hinweisbanner hat weiter seine gepinnte Zusage, nichts im `localStorage` abzulegen
// (tests/legal/mega61-hinweisbanner.test.tsx:52). Dieser Eintrag verletzt sie nicht: Der Test liest
// AUSSCHLIESSLICH `legal/NoticeBanner.tsx`, und die Schuld wohnt hier, in der Sitzungshaltung der
// ganzen Anwendung. Das ist keine Formalie — der Vermerk „Hinweis gelesen" gehört ans Konto (er ist
// eine Aussage über einen Menschen), die Abmeldeschuld gehört an das Gerät (sie ist eine Aussage
// über einen unerledigten technischen Vorgang). Der Test greift also nicht zu weit.

/** Der Name im `localStorage`. Steht als Tatsachenaussage in der Datenschutzerklärung (§ 4). */
export const ABMELDESCHULD_SCHLUESSEL = "kw_signout_pending";

/**
 * Der Inhalt des Eintrags. Er trägt bewusst KEINE Angabe — keine Frist, keinen Zeitpunkt, keine
 * Kennung: „vorhanden heißt Schuld" ist die ganze Bedeutung. Der Datenschutztext sagt zu, der Merker
 * enthalte keine Angaben über die Nutzerin (`legal.privacy.s4.p7`); ein Zeitstempel wäre eine.
 *
 * Gelesen wird er nirgends. Er steht hier, damit im Speicherbrowser nicht eine nackte `1` liegt,
 * deren Bedeutung niemand erraten kann.
 */
export const ABMELDESCHULD_WERT = "offen";

/**
 * Hat DIESER Lauf eine Schuld festgestellt? Der Rückfall, wenn der Speicher sich verweigert (Fall 1
 * oben). Bewusst modulweit und nicht im React-State: `abmeldeschuldGesetzt()` wird als ANFANGSWERT
 * gelesen, also bevor es einen State gibt.
 */
let inDiesemLauf = false;

function speicher(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

/**
 * Steht eine unbestätigte Abmeldung offen? Wird als ANFANGSWERT der Sperre gelesen.
 *
 * Vorhanden heißt Schuld — auch ein beschädigter oder fremd geschriebener Eintrag. Deshalb gibt es
 * hier nichts zu parsen und nichts zu vergleichen: Der Aufruf kann gar nicht mehr an einem Format
 * scheitern, und damit ist die Fehlerklasse aus bens ROT-2 verschwunden statt behandelt.
 */
export function abmeldeschuldGesetzt(): boolean {
  if (inDiesemLauf) {
    return true;
  }
  const s = speicher();
  if (!s) {
    return false; // Fall 2
  }
  try {
    return s.getItem(ABMELDESCHULD_SCHLUESSEL) !== null;
  } catch {
    return false; // Fall 2
  }
}

/**
 * Ein strenges Abmelden ist gescheitert — ab hier gilt die Schuld, über ein Neuladen UND über alle
 * Tabs hinweg.
 */
export function abmeldeschuldSetzen(): void {
  // ZUERST der Rückfall im Arbeitsspeicher, DANN der Speicher. Wirft `setItem`, ist die Schuld
  // trotzdem festgehalten — die umgekehrte Reihenfolge verlöre sie genau im abgeschotteten Browser.
  inDiesemLauf = true;
  try {
    speicher()?.setItem(ABMELDESCHULD_SCHLUESSEL, ABMELDESCHULD_WERT);
  } catch {
    // still: `inDiesemLauf` trägt sie in diesem Lauf, und die anderen Tabs erfahren sie dann nicht.
    // Das ist die ehrliche Grenze eines Browsers, der uns nichts speichern lässt.
  }
}

/**
 * Die Schuld ist eingelöst: Der Server hat die Beendigung BESTÄTIGT oder es steht sicher fest, dass
 * gar keine Sitzung mehr besteht. Erst jetzt darf sie fallen — und dann in ALLEN Tabs, weshalb das
 * Entfernen aus dem `localStorage` bei den anderen ein `storage`-Ereignis auslöst.
 */
export function abmeldeschuldLoeschen(): void {
  inDiesemLauf = false;
  try {
    speicher()?.removeItem(ABMELDESCHULD_SCHLUESSEL);
  } catch {
    // still: siehe oben.
  }
}

/**
 * Die ANDEREN Tabs benachrichtigen lassen. `storage` feuert ausdrücklich NUR in fremden Tabs, nicht
 * in dem, der geschrieben hat — genau der Zuschnitt, den es hier braucht: der schreibende Tab kennt
 * seinen eigenen Zustand schon.
 *
 * Kein `BroadcastChannel`: Er kann dasselbe, aber `storage` fällt beim Speicher-Eintrag sowieso an,
 * den es hier ohnehin gibt. Zwei Wege für eine Nachricht wären zwei Wahrheiten.
 *
 * `event.key === null` heißt „der ganze Speicher wurde geleert" (`localStorage.clear()`) — das
 * betrifft uns mit, und wir lesen dann neu statt es zu übergehen.
 */
export function abmeldeschuldBeobachten(melden: (gesetzt: boolean) => void): () => void {
  const zuhoerer = (ereignis: StorageEvent): void => {
    if (ereignis.key !== null && ereignis.key !== ABMELDESCHULD_SCHLUESSEL) {
      return;
    }
    melden(abmeldeschuldGesetzt());
  };
  try {
    window.addEventListener("storage", zuhoerer);
  } catch {
    return () => undefined;
  }
  return () => {
    try {
      window.removeEventListener("storage", zuhoerer);
    } catch {
      // still.
    }
  };
}
