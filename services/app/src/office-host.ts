// ================================================================================================
// JOB 4016 · DER EINE ORT: WELCHER MICROSOFT-HOST DARF DAS KLARA-TASKPANE EINBETTEN?
// ================================================================================================
//
// Bis JOB 4016 stand die Antwort als Zeichenkette mitten in der Ersatz-CSP des Taskpanes
// (`security-headers.ts`, Zeile 36 am Stand b0315de) — ohne Namen, ohne Gegenprobe, mit der
// Begründung in einem Kommentar darüber. Wer die Frage „darf dieser Host Klara einbetten?"
// beantworten wollte, musste eine CSP lesen. Seit JOB 4016 steht sie hier: als benannte Liste, mit
// ausgeschriebener Herkunft, mit den bewusst NICHT freigegebenen Familien als DATEN — und mit
// einer exakten Prüfung, an der die Regel gegengeprüft werden kann.
//
// ------------------------------------------------------------------------------------------------
// DIE HERKUNFT DER LISTE (aus `security-headers.ts:16-23` hierher gezogen, unverändert in der Sache)
// ------------------------------------------------------------------------------------------------
// K2: die Einbettungs-Erlaubnis ist ENG und belegt. Microsofts Add-in-Doku („Domains used by Office
// web add-ins" / CSP-Guidance für Add-ins, learn.microsoft.com) nennt als Web-Hosts der
// Office-Runtime office.com und officeapps.live.com — Word Online lädt Taskpanes aus diesen
// Herkünften. BEWUSST NICHT dabei: *.live.com und *.microsoft.com (ganze Plattformfamilien — jede
// beliebige Seite dieser Konzerne dürfte die App framen; genau bens ROT-Befund). Word für Mac lädt
// das Taskpane als NATIVER WKWebView top-level — die Direktive greift dort gar nicht (der
// Sideload-Smoke-Test belegt das separat); Word Online wird erst behauptet, wenn es real belegt
// ist — fehlt ein Host, wird er nach Beleg GEZIELT ergänzt, nicht vorsorglich breit freigegeben.
//
// ------------------------------------------------------------------------------------------------
// DIE HOST-QUELLE IST DIE EINE WAHRHEIT — bens ROT-Befund aus Runde 1
// ------------------------------------------------------------------------------------------------
// Runde 1 führte die Hosts als BASISNAMEN (`office.com`) und baute die Direktive daraus zusammen.
// Die Prüfung erlaubte dabei den Basisnamen SELBST — die ausgelieferte Direktive tut das nicht:
// eine Host-Quelle mit Platzhalter (`https://*.office.com`) deckt laut CSP-Vertrag (W3C CSP3,
// „Match Hosts") ausschliesslich Namen, die auf `.office.com` enden; `office.com` allein ist NICHT
// gedeckt. Der zentrale Ort beantwortete die Kernfrage also anders als der Header, den er erzeugt.
//
// Die Behebung ist nicht ein umgestellter Vergleich, sondern EINE Wahrheit: der Eintrag trägt jetzt
// die HOST-QUELLE, wörtlich so, wie sie in der Direktive steht. Aus ihr wird beides abgeleitet —
// die Direktive (unverändert zeichengleich) und die Prüfung. Wer eine Host-Quelle ändert, ändert
// beides zugleich; eine Abweichung wie die aus Runde 1 kann baulich nicht mehr entstehen, und
// `pruefeEintraege` unten misst sie beim Laden zusätzlich an Beispiel und Gegenbeispiel.
//
// Fachlich verliert das nichts: Word im Browser lädt das Taskpane aus Unterdomains
// (`word-edit.officeapps.live.com`). Träte je eine nackte Herkunft auf, wäre die Antwort NICHT,
// hier eine Ausnahme zu bauen, sondern die Host-Quelle nach Beleg zu ergänzen — dann folgt die
// Prüfung von selbst.
//
// ------------------------------------------------------------------------------------------------
// WARUM DIE PRÜFUNG NICHT IM ANFRAGEWEG HÄNGT — und trotzdem hier steht
// ------------------------------------------------------------------------------------------------
// Durchgesetzt wird die Einbettungsgrenze vom BROWSER, über die Direktive `frame-ancestors` der
// ausgelieferten CSP (`security-headers.ts`). Serverseitig lässt sich dieselbe Entscheidung an der
// Taskpane-Anfrage nicht zweitfällen: eine Navigation in einen Rahmen trägt keine verlässliche
// Herkunftsangabe, und Word für Mac lädt das Taskpane überhaupt nicht in einem Rahmen — eine
// Verzweigung danach würde den funktionierenden Mac-Weg brechen und im Web nichts gewinnen.
// `istErlaubterEinbettungsHost` ist deshalb die REGEL in ausführbarer Form: sie beantwortet die
// Frage für einen konkreten Host GENAU SO, wie der ausgelieferte Header sie beantwortet, sie hält
// die Ausschlüsse fail-closed (siehe `pruefeEintraege`), und sie ist die Stelle, an der die
// Gegenprobe ansetzt (`tests/office-web-anmeldung/einbettung-am-draht.test.ts`, Fall D3 misst die
// Gleichheit von Regel und ausgeliefertem Header, die Fälle E1–E4 die Prüfung selbst).

/** Ein Host, aus dem heraus das Taskpane eingebettet werden darf. */
export interface EinbettungsHost {
  /**
   * Die Host-Quelle, WÖRTLICH so, wie sie in der ausgelieferten Direktive steht. Sie ist die
   * Wahrheit dieses Eintrags: Direktive und Prüfung werden beide aus ihr abgeleitet.
   */
  readonly hostQuelle: string;
  /** Eine real vorkommende Herkunft dieses Hosts; sie belegt die Regel an einem Beispiel. */
  readonly beispiel: string;
  /**
   * Die nackte Basisdomain — vom Platzhalter der Host-Quelle NICHT gedeckt und deshalb FALSCH.
   * Sie steht hier, damit bens Befund aus Runde 1 beim Laden gemessen wird und nicht nur in einem
   * Kommentar behauptet.
   */
  readonly gegenbeispiel: string;
  /** Warum genau dieser Host — die Begründung gehört an den Eintrag, nicht in eine Fußnote. */
  readonly warum: string;
}

/** Eine Plattformfamilie, die BEWUSST nicht freigegeben ist. */
export interface AusgeschlosseneFamilie {
  readonly familie: string;
  /** Eine Herkunft dieser Familie; an ihr wird der Ausschluss gemessen, nicht behauptet. */
  readonly beispiel: string;
  readonly warum: string;
}

export const ERLAUBTE_EINBETTUNGS_HOSTS: readonly EinbettungsHost[] = [
  {
    hostQuelle: "https://*.office.com",
    beispiel: "https://word-edit.office.com",
    gegenbeispiel: "https://office.com",
    warum:
      "Web-Host der Office-Runtime laut Microsofts Add-in-Doku — Word im Browser lädt das " +
      "Taskpane aus dieser Familie.",
  },
  {
    hostQuelle: "https://*.officeapps.live.com",
    beispiel: "https://word-edit.officeapps.live.com",
    gegenbeispiel: "https://officeapps.live.com",
    warum:
      "Zweiter Web-Host der Office-Runtime laut derselben Doku (die Word-Web-Oberfläche läuft " +
      "regional unter dieser Familie). NICHT zu verwechseln mit *.live.com — siehe unten.",
  },
];

export const NICHT_FREIGEGEBENE_PLATTFORMFAMILIEN: readonly AusgeschlosseneFamilie[] = [
  {
    familie: "live.com",
    beispiel: "https://beliebig.live.com",
    warum:
      "Ganze Plattformfamilie: mit ihr dürfte JEDE Seite unter live.com Klara einbetten, nicht " +
      "nur die Office-Runtime. Freigegeben ist ausschließlich officeapps.live.com.",
  },
  {
    familie: "microsoft.com",
    beispiel: "https://beliebig.microsoft.com",
    warum:
      "Dieselbe Klasse von Fehlfreigabe eine Ebene höher — jede Konzernseite dürfte die App " +
      "framen. Die office.js-CDN appsforoffice.microsoft.com ist eine SKRIPTQUELLE und " +
      "berechtigt zu keiner Einbettung.",
  },
];

const HTTPS = "https://";

/** Der Platzhalter-Kopf jeder Host-Quelle: HTTPS, ein Stern, ein Punkt. */
const PLATZHALTER = `${HTTPS}*.`;

/**
 * Ein Hostname, wie er in einer Herkunft stehen darf: Bestandteile aus Buchstaben, Ziffern und
 * Bindestrichen, durch einzelne Punkte getrennt, kein leerer Bestandteil, kein Doppelpunkt (Port),
 * kein Schrägstrich (Pfad), kein `@` (Nutzerinfo). Alles, was hier nicht durchkommt, ist FALSCH.
 */
const HOSTNAME = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/;

/** Der Namensteil hinter dem Platzhalter: aus `https://*.office.com` wird `office.com`. */
function basisAus(hostQuelle: string): string {
  return hostQuelle.slice(PLATZHALTER.length);
}

/**
 * Darf aus DIESER Herkunft heraus eingebettet werden?
 *
 * Die Antwort ist dieselbe, die der ausgelieferte Header gibt — deshalb wird sie aus DESSEN
 * Host-Quellen abgeleitet. Eine Host-Quelle mit Platzhalter deckt laut CSP-Vertrag genau die Namen,
 * die an einer PUNKTGRENZE auf ihren Namensteil enden; die nackte Basisdomain deckt sie NICHT.
 * Fail-closed, ohne Präfix- oder Teilstringvergleich — dasselbe Muster, das `isWordAddinCspPath`
 * (`security-headers.ts`) für Pfade vormacht: erst die Form prüfen, dann exakt vergleichen.
 *
 *     https://word-edit.officeapps.live.com          WAHR   — Unterdomain, vom Platzhalter gedeckt
 *     https://officeapps.live.com                    FALSCH — nackte Basisdomain (bens Befund R1)
 *     https://klarwerk.ai.office.com.angreifer.tld   FALSCH — der belegte Name steht links
 *     https://office.com.angreifer.tld               FALSCH — dasselbe, kürzer
 *     https://xofficeapps.live.com                   FALSCH — kein Punkt vor dem Namensteil
 *
 * EINZIGE Normalisierung ist die Schreibung: Hostnamen sind laut DNS nicht schreibungsabhängig,
 * und Browser senden `Origin` ohnehin klein. Alles andere — führender oder folgender Leerraum,
 * Pfad, Query, Fragment, Port, Nutzerinfo, ein anderes Schema als HTTPS — macht die Antwort FALSCH,
 * statt vorher „repariert" zu werden.
 */
export function istErlaubterEinbettungsHost(origin: string | undefined): boolean {
  const roh = origin ?? "";
  if (!roh.startsWith(HTTPS)) {
    return false;
  }
  const host = roh.slice(HTTPS.length).toLowerCase();
  if (!HOSTNAME.test(host)) {
    return false;
  }
  return ERLAUBTE_EINBETTUNGS_HOSTS.some((eintrag) =>
    host.endsWith(`.${basisAus(eintrag.hostQuelle)}`),
  );
}

/**
 * Die Direktive, die `security-headers.ts` in die Ersatz-CSP des Taskpanes einsetzt — zusammengesetzt
 * aus GENAU DEN Host-Quellen, die `istErlaubterEinbettungsHost` befragt. Zwei Wahrheiten kann es
 * damit nicht geben: die Zeichenkette im Header und die Regel im Code sind dieselbe Angabe.
 *
 * `'self'` bleibt drin: das Taskpane liegt auf der App-Domain und wird von der App selbst
 * eingebettet (Vorschau im Browser), ohne dass ein fremder Host das dürfte.
 */
export const WORD_ADDIN_FRAME_ANCESTORS = [
  "frame-ancestors",
  "'self'",
  ...ERLAUBTE_EINBETTUNGS_HOSTS.map((eintrag) => eintrag.hostQuelle),
].join(" ");

/**
 * Der Riegel gegen die zwei Fehler, die dieser Datei ihren Sinn geben — gemessen beim Laden des
 * Moduls, fail-closed, statt still etwas Falsches auszuliefern.
 *
 * (1) DIE FEHLFREIGABE. Trüge jemand `live.com` oder `microsoft.com` ein — als Tippfehler, aus
 *     Bequemlichkeit oder weil ein Host „irgendwie fehlte" —, dürfte jede beliebige Seite dieser
 *     Konzerne Klara einbetten. In der ausgelieferten Kopfzeile wäre das nicht zu sehen.
 * (2) DAS AUSEINANDERLAUFEN VON REGEL UND HEADER (bens ROT-Befund aus Runde 1). Jeder Eintrag muss
 *     die Form einer Host-Quelle mit Platzhalter haben, sein Beispiel muss WAHR und seine nackte
 *     Basisdomain FALSCH sein — genau das, was die Direktive im Browser bewirkt.
 */
function pruefeEintraege(): void {
  for (const eintrag of ERLAUBTE_EINBETTUNGS_HOSTS) {
    if (!eintrag.hostQuelle.startsWith(PLATZHALTER)) {
      throw new Error(
        `office-host: ${eintrag.hostQuelle} ist keine Host-Quelle der Form ` +
          `${PLATZHALTER}<name>; nur daraus lassen sich Direktive und Prüfung gemeinsam ableiten.`,
      );
    }
    if (!istErlaubterEinbettungsHost(eintrag.beispiel)) {
      throw new Error(
        `office-host: ${eintrag.beispiel} ist von ${eintrag.hostQuelle} nicht gedeckt.`,
      );
    }
    if (istErlaubterEinbettungsHost(eintrag.gegenbeispiel)) {
      throw new Error(
        `office-host: ${eintrag.gegenbeispiel} ist die nackte Basisdomain und von ` +
          `${eintrag.hostQuelle} NICHT gedeckt — die Prüfung darf sie nicht erlauben.`,
      );
    }
  }
  for (const familie of NICHT_FREIGEGEBENE_PLATTFORMFAMILIEN) {
    if (istErlaubterEinbettungsHost(familie.beispiel)) {
      throw new Error(
        `office-host: die Plattformfamilie ${familie.familie} ist bewusst NICHT freigegeben, ` +
          `aber ${familie.beispiel} gilt als erlaubte Einbettungs-Herkunft.`,
      );
    }
    if (WORD_ADDIN_FRAME_ANCESTORS.includes(`*.${familie.familie}`)) {
      throw new Error(
        `office-host: die Plattformfamilie ${familie.familie} ist bewusst NICHT freigegeben, ` +
          `steht aber in der ausgelieferten Direktive: ${WORD_ADDIN_FRAME_ANCESTORS}`,
      );
    }
  }
}

pruefeEintraege();
