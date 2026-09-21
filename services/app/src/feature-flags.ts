// ================================================================================================
// AUFTRAG-mega46 BLOCK F — DIE EINE WAHRHEIT ÜBER DIE BETRIEBSSCHALTER.
// ================================================================================================
//
// Bis hierher las jede Stelle ihren Schalter selbst: `provenanceEnabled()` in provenance-routes,
// `confluenceImportEnabled()` in library-routes, dieselbe Prüfung noch einmal inline in
// build-app.ts, `expertMatchingEnabled()` daneben. Vier Leser, viermal dieselbe Regel abgeschrieben.
// Solange nur der Server sie las, war das lästig; sobald die OBERFLÄCHE danach fragt (F1), wird es
// gefährlich: Weicht die Auskunft von der Registrierungsentscheidung ab, zeigt die Anwendung eine
// Fläche, deren Route es nicht gibt — oder verbirgt eine, die da ist. Die Auskunft würde lügen.
//
// Deshalb liest AB HIER genau diese Datei die Schalter, und alle anderen fragen sie. Der Sammler
// `tests/app/mega46-schalter-eine-wahrheit.test.ts` hält das fest: Greift künftig jemand am
// Registry vorbei direkt auf `process.env.KLARWERK_...` eines registrierten Schalters zu, wird er
// rot — ohne dass jemand daran denken muss.
//
// WAS HIER NICHT HINEINGEHÖRT: Schalter, die WERTE tragen (URLs, Schlüssel, Grenzen, Zeitspannen).
// Das Registry führt ausschließlich JA/NEIN-Schalter, denn nur solche dürfen die Oberfläche je
// erfahren (F1: keine Werte, keine Umgebungsvariablen, keine Pfade, keine Versionen).

/**
 * DAS REGISTRY: öffentlicher Schaltername → Umgebungsvariable.
 *
 * Der öffentliche Name ist bewusst ein FACHNAME und nicht der Variablenname: Über den Draht geht
 * `herkunft`, nicht `KLARWERK_PROVENANCE_ENABLED`. Wer die Antwort abfängt, erfährt damit nichts
 * über die Umgebung, sondern nur, welche fachliche Fläche dieser Betrieb freigeschaltet hat.
 */
export const SCHALTER_REGISTRY = {
  /** AUFTRAG-mega45: die Herkunftskette eines Wissensobjekts (Route + Fläche). */
  herkunft: "KLARWERK_PROVENANCE_ENABLED",
  /** SCRUM-510: der Confluence-Space-Import (Admin-Trigger + Erkundungs-Fluss). */
  confluenceImport: "KLARWERK_CONFLUENCE_IMPORT",
  /**
   * JOB 4086: der SharePoint-/OneDrive-Import (Dateiauswahl + Übernahme).
   *
   * EIN EIGENER SCHALTER, NICHT DER VON CONFLUENCE — und das ist keine Formsache: Ein Betrieb, der
   * Confluence anbindet, hat damit über SharePoint nichts gesagt, und umgekehrt. Ein geteilter
   * Schalter hiesse, dass eine Quelle die andere mitschaltet; die Kachel der einen behauptete dann
   * etwas über einen Schalter, der der anderen gehört.
   *
   * Was er schaltet, ist die ANWESENHEIT der zwei Konnektor-Routen (`build-app.ts`) — nicht ihre
   * Benutzbarkeit. Ob in diesem Betrieb Zugangsdaten stehen, sagt die Zugangs-Auskunft
   * (`GET /api/import/sharepoint/zugang`), und sie steht bewusst VOR dem Schalter, damit sie den
   * Zustand „ausgeschaltet" überhaupt melden kann.
   */
  sharepointImport: "KLARWERK_SHAREPOINT_IMPORT",
  /** Consultant-System: Thema→Personen-Matching, vor BR/DSB-Freigabe unsichtbar. */
  expertMatching: "KLARWERK_EXPERT_MATCHING",
  /** AUFTRAG-mega61 Block A: die beiden Rechtsseiten /impressum und /datenschutz. */
  rechtsseiten: "KLARWERK_RECHTSSEITEN",
  /**
   * AUFTRAG-mega61 Block B: der Hinweis zu Endgerätespeicher und KI-Transparenz.
   *
   * AUFTRAG-mega62 Block A: Er hat ZWEI Flächen — den Banner in der Anwendungshülle (mit
   * Kenntnisnahme am Konto) und denselben Text ohne Knöpfe auf der Anmeldemaske. Dieser Schalter
   * deckt BEIDE. Bis mega61 deckte er nur die erste, womit die Auskunft „Notausschalter dieser
   * Pflichtfläche" nur für die Hälfte stimmte; der GEMOUNTETE Beleg über die Anmeldemaske steht in
   * apps/web/src/legal/mega62-hinweis-ein-schalter.test.tsx.
   */
  hinweisbanner: "KLARWERK_HINWEISBANNER",
  /**
   * AUFTRAG-mega64 Block A: das Laden der Demodaten (`POST /api/admin/demo-seed`).
   *
   * WARUM DIESES WERKZEUG EINEN SCHALTER BRAUCHT: Es legt Konten an — bis mega64 mit im Quelltext
   * festgeschriebenen Kennwörtern, ab mega64 mit Einmalkennwörtern. Die Route war in JEDER App
   * bedingungslos registriert (Befund ben, BERICHT-ben-sammel61-mega63.md, Finding 1) und hatte als
   * einzige Hürde `users.manage`. Ein Werkzeug, das Konten anlegt, gehört nicht zur normalen
   * Ausstattung eines Betriebs, sondern ist eine ausdrücklich eingeschaltete Vorführhilfe.
   *
   * WARUM VORGABE AUS, OHNE AUSNAHME — und das ist der Grund, aus dem er NICHT in
   * `SCHALTER_VORGABE_AN` steht, obwohl die zwei Schalter darüber es sind: Die Vorgabe AN ist die
   * richtige Richtung für eine PFLICHTANGABE, deren stilles Fehlen der Schaden wäre. Hier ist es
   * genau umgekehrt — der Schaden ist die stille ANWESENHEIT. Ein Werkzeug, das Konten anlegt, darf
   * nicht dadurch scharf sein, dass niemand widersprochen hat.
   *
   * Er steht ebenso NICHT in `SCHALTER_VOR_ANMELDUNG`: welche Werkzeuge ein Betrieb freigeschaltet
   * hat, geht einen Unangemeldeten nichts an, und diese Fläche liegt ohnehin hinter `users.manage`.
   */
  demodaten: "KLARWERK_DEMO_SEED",
} as const;

// ================================================================================================
// JOB 4365 — DIE VORFÜHR-INSTANZ ERKENNT SICH AM HOSTNAMEN, NICHT AN EINEM SCHALTER.
// ================================================================================================
//
// HIER STAND BIS JOB 4365 EIN ACHTER REGISTRY-EINTRAG: `demoInstanz: "KLARWERK_DEMO_INSTANZ"`
// (JOB 3761). Er ist ERSETZT und nicht daneben gestellt — der Umgebungsschalter wird NIRGENDS mehr
// gelesen. Wer ihn heute setzt, bewirkt nichts, und wer ihn auf `0` setzt, nimmt der Vorführung
// ihre Kennzeichnung nicht (beide Richtungen gemessen: `tests/demo-kennzeichnung/schalter.test.ts`,
// Fall H1).
//
// EIN REST BLEIBT, UND ZWAR EIN BENANNTER: Der KATALOG `start-vertrag.ts` führt den Namen weiter,
// ausdrücklich als abgelöst (Bereich „Schalter (abgelöst seit JOB 4365 …)"), und `env.demo.beispiel`
// nennt ihn unverändert. Der Grund steht dort ausgeschrieben: die Beispieldatei ist über
// `tests/demo-zugang-start/env-beispiel.test.ts` (C2/C5) hart an den Katalog gebunden und liegt
// nicht in den Zielpfaden dieses Auftrags. Das ist eine Frage der DOKUMENTATION, nicht der Wirkung —
// gelesen wird der Wert von keiner Zeile Produktcode mehr.
//
// PEDIS ANLASS BLEIBT DERSELBE (11.09. 17:20 über Codex, PRIORITAETEN.md/DEMO-ZUGANG-START): „und
// man muss ihr ansehen, dass sie die Demo ist und nicht das Echte". Geändert hat sich die QUELLE
// dieser Aussage. Ein Schalter ist eine BEHAUPTUNG über die Instanz, und sie war nur so richtig wie
// der Umgebungsblock, den jemand von Hand gepflegt hat: ein kopierter Block, ein halb übernommenes
// Startskript, ein vergessener Wert — und die Vorführinstanz trug kein Etikett oder die echte eines.
// Der Hostname ist dagegen keine Behauptung, sondern die TATSACHE, die den Unterschied überhaupt
// ausmacht: Unter `demo.klarwerk.io` steht die Vorführung, unter jeder anderen Adresse nicht. Wer
// die Demo aufruft, hat sie damit schon bewiesen; niemand muss mehr etwas richtig setzen
// (Entscheidung 1, ENTSCHEIDUNGEN-FACHFRAGEN-20260921.md).
//
// WARUM ER DAMIT AUS DEM REGISTRY MUSS und nicht als Sonderfall darin bleibt: Das Registry ist die
// Abbildung „öffentlicher Schaltername → Umgebungsvariable". Ein Eintrag, dessen Wert niemand mehr
// liest, wäre genau die zweite Wahrheit, die dieses Registry beseitigt hat — `schalterAn(...)`
// gäbe weiterhin eine Antwort, und die wäre falsch. Über den Draht geht `demoInstanz` unverändert
// weiter: dieselbe Auskunft, derselbe Fachname, derselbe Ja/Nein-Wert; die Oberfläche
// (`apps/web/src/auth/BrandPanel.tsx`) bleibt unangetastet.

/**
 * Der Hostname der Vorführ-Instanz — die EINE Adresse, die ein Demo-Etikett trägt.
 *
 * Bewusst ein Literal und keine Umgebungsvariable: Ein Schalter, der sagt, welcher Host die Demo
 * ist, wäre derselbe von Hand gepflegte Wert, den dieser Auftrag gerade abgeschafft hat. Derselbe
 * Präzedenzfall steht in `server.ts:20` (`CANONICAL_HOST ?? "klarwerk.ai"`).
 */
const DEMO_HOST = "demo.klarwerk.io";

/**
 * Ist die Anfrage an der Vorführ-Adresse angekommen?
 *
 * ERWARTET WIRD DER ROHE `Host`-KOPF der Anfrage, so wie der Browser ihn geschickt hat — also mit
 * Port, wenn einer im Spiel ist (`demo.klarwerk.io:443`, `demo.klarwerk.io:3000`). Caddy und
 * Coolify reichen ihn unverändert durch.
 *
 * AUSDRÜCKLICH NICHT AUSGEWERTET WIRD `X-Forwarded-Host` (und nichts dergleichen), und der Aufrufer
 * hält sich daran, indem er `request.headers.host` übergibt statt `request.hostname` — letzteres
 * zöge bei eingeschaltetem `trustProxy` den Weiterleitungskopf heran. Der Grund ist die
 * Wirkrichtung: `X-Forwarded-Host` kann jeder Aufrufer selbst setzen. Ein Demo-Etikett auf der
 * ECHTEN Anwendung wäre schlimmer als gar keines — es machte echte Arbeit unglaubwürdig.
 *
 * STRENG UND NUR AUF GLEICHHEIT, in genau dieser Richtung fail-safe: `x.demo.klarwerk.io`,
 * `demo.klarwerk.io.beispiel.de`, `notdemo.klarwerk.io` und ein abschließender Punkt sind NICHT die
 * Vorführ-Instanz. Zu streng heißt: die Demo bliebe unbeschriftet (ärgerlich). Zu locker heißt: die
 * echte Anwendung trüge ein Demo-Etikett (schädlich). Kleinschreibung, weil Hostnamen
 * schreibweisenunabhängig sind und ein Browser `Demo.Klarwerk.io` schicken darf.
 */
export function demoInstanzAusHost(host: string | undefined): boolean {
  if (typeof host !== "string") {
    return false;
  }
  return host.trim().toLowerCase().replace(/:\d+$/, "") === DEMO_HOST;
}

export type SchalterName = keyof typeof SCHALTER_REGISTRY;

/** Alle registrierten Schalternamen — Grundlage für Auskunft und Sammler. */
export const SCHALTER_NAMEN = Object.keys(SCHALTER_REGISTRY) as readonly SchalterName[];

// ================================================================================================
// AUFTRAG-mega61 — DIE ZWEITE AUSWERTUNGSART: NOTAUSSCHALTER STATT SPERRE.
// ================================================================================================
//
// Bis mega60 hatte jeder Schalter dieselbe Richtung: Vorgabe AUS, ein ausdrückliches `1`/`true`
// schaltet scharf. Das ist die richtige Vorgabe für eine FÄHIGKEIT, die noch niemand freigegeben
// hat — ein Vertipper verbirgt sie, statt sie versehentlich zu öffnen.
//
// Die beiden Flächen aus mega61 sind keine Fähigkeit, sondern eine PFLICHTANGABE (Impressum,
// Datenschutzerklärung, Transparenzhinweis). Für sie ist dieselbe Vorgabe falsch herum: eine
// Rechtsseite, die nach einem Konfigurationsfehler still fehlt, ist genau der Zustand, den man
// nicht haben will. Pedis Entscheidung vom 30.07.2026: sie sind SICHTBAR, und der Schalter ist ein
// Notausschalter für den Fall, dass eine Fläche im Betrieb stört — keine Freigabesperre.
//
// Die Regel bleibt trotzdem STRENG in ihrer Richtung: nur ein ausdrückliches `0` oder `false`
// schaltet ab. „nein", „off", „no" oder ein leerer Wert gelten NICHT — wer abschalten will, muss
// es genauso eindeutig sagen wie sonst jemand, der einschalten will.
const SCHALTER_VORGABE_AN = new Set<SchalterName>(["rechtsseiten", "hinweisbanner"]);

/** Steht dieser Schalter ohne gesetzte Umgebungsvariable auf AN? (Nachweis für Tests und Bericht.) */
export function vorgabeAn(name: SchalterName): boolean {
  return SCHALTER_VORGABE_AN.has(name);
}

// ================================================================================================
// AUFTRAG-mega61 Block A — WELCHE SCHALTER SCHON VOR DER ANMELDUNG BEANTWORTET WERDEN.
// ================================================================================================
//
// Die Begründung in features-routes.ts für `requireUser` lautete: „die Oberfläche braucht sie erst
// NACH dem Anmelden (vorher gibt es nur die Anmeldemaske)". Diese Prämisse gilt seit mega61 nicht
// mehr — /impressum und /datenschutz sind ohne Anmeldung erreichbar (sie MÜSSEN es sein, weil die
// Datenschutzerklärung vor der ersten Datenerhebung verfügbar sein muss), und der Fußbereich mit
// ihren Links steht auf der Anmeldemaske.
//
// Statt eine zweite Route zu bauen (das wäre die zweite Wahrheit, die mega46 gerade beseitigt hat),
// antwortet DIESELBE Auskunft ohne Sitzung mit dieser TEILMENGE. Alles andere bleibt hinter der
// Anmeldung — welche Fähigkeiten ein Betrieb freigeschaltet hat, geht einen Unangemeldeten nichts an.
//
// JOB 3761/4365 — DIE DEMO-KENNZEICHNUNG STEHT EBENFALLS VOR DER ANMELDUNG, aus demselben Grund und
// obwohl `demodaten` es ausdrücklich nicht tut. Die Begründung dort lautet: „welche WERKZEUGE ein
// Betrieb freigeschaltet hat, geht einen Unangemeldeten nichts an". Die Selbstauskunft „ich bin die
// Vorführinstanz" ist kein Werkzeug und kein Fähigkeitszukauf, sondern eine Kennzeichnung, die genau
// für den Gast gedacht ist — und die Anmeldemaske ist die erste Fläche, die er sieht, und die, auf
// der er sein Kennwort eintippt. Käme der Hinweis erst nach der Anmeldung, käme er nach der Eingabe.
// Verraten wird damit nichts, was nicht ohnehin jeder sehen soll: die Antwort bleibt reines Ja/Nein,
// ohne Variablennamen und ohne Adresse (features-routes.ts, Sammler mega46-schalter-auskunft).
//
// Sie steht seit JOB 4365 NICHT mehr in dieser Menge, weil sie kein Registry-Schalter mehr ist —
// beide Auskunftsfunktionen unten setzen sie AUSDRÜCKLICH aus dem Host der Anfrage. Über den Draht
// ändert sich dadurch nichts.
const SCHALTER_VOR_ANMELDUNG = new Set<SchalterName>(["rechtsseiten", "hinweisbanner"]);

/**
 * DIE EINE AUSWERTUNGSREGEL. Zwei Richtungen, je nach Art des Schalters, und beide fail-safe in die
 * Richtung, die für ihre Art richtig ist:
 *
 *   · Fähigkeit (Vorgabe AUS): nur `1` oder `true` schaltet scharf. Ein vertippter Schalter lässt
 *     die Fläche verborgen, statt sie versehentlich zu öffnen.
 *   · Pflichtangabe (Vorgabe AN, s. SCHALTER_VORGABE_AN): nur `0` oder `false` schaltet ab. Ein
 *     vertippter Schalter lässt die Angabe stehen, statt sie versehentlich verschwinden zu lassen.
 *
 * Pro Aufruf gelesen (nicht beim Modulladen zwischengespeichert), damit Tests beide Zustände im
 * selben Lauf festhalten können — dieselbe Zusage, die `provenanceEnabled()` schon gab.
 */
export function schalterAn(name: SchalterName): boolean {
  const wert = process.env[SCHALTER_REGISTRY[name]];
  if (SCHALTER_VORGABE_AN.has(name)) {
    return !(wert === "0" || wert === "false");
  }
  return wert === "1" || wert === "true";
}

// ================================================================================================
// JOB 4365 — WARUM BEIDE AUSKUNFTSFUNKTIONEN JETZT DEN HOST VERLANGEN.
// ================================================================================================
//
// `host` ist ein PFLICHTPARAMETER und ausdrücklich kein optionaler mit Vorgabewert. Der Unterschied
// ist der zwischen einem Compilerfehler und einem stillen Fehler: Eine zweite Stelle, die diese
// Auskunft eines Tages ohne Host aufruft, bekäme mit einem Vorgabewert dauerhaft `demoInstanz:
// false` — die Vorführinstanz verlöre ihr Etikett, und niemand bemerkte es. So bekommt sie einen
// Typfehler und muss sagen, welchen Host sie meint.
//
// ÜBERGEBEN WIRD DER ROHE `Host`-KOPF (`request.headers.host`), nicht `request.hostname`: Fastify
// zieht dort bei eingeschaltetem `trustProxy` den `X-Forwarded-Host` heran, und der ist von aussen
// setzbar. Die Begründung steht ausgeschrieben bei `demoInstanzAusHost` oben.

/**
 * Der Zustand ALLER registrierten Schalter als reine Ja/Nein-Abbildung — die Nutzlast der Auskunft
 * aus F1. Ein nicht gesetzter Schalter erscheint als `false`, nicht als fehlender Schlüssel: Der
 * Vertrag bleibt damit stabil, und „aus" ist von „kenne ich nicht" unterscheidbar, ohne dass
 * irgendetwas über die Umgebung verraten wird.
 *
 * JOB 4365: `demoInstanz` kommt daneben aus dem Host der Anfrage — derselbe Fachname und derselbe
 * Ja/Nein-Wert wie zuvor, nur eine andere Quelle. Die Adresse selbst geht dabei NICHT über den
 * Draht: der Aufrufer erfährt die Tatsache, nicht die Umgebung.
 */
export function schalterZustand(
  host: string | undefined,
): Record<SchalterName, boolean> & { demoInstanz: boolean } {
  const zustand = {} as Record<SchalterName, boolean>;
  for (const name of SCHALTER_NAMEN) {
    zustand[name] = schalterAn(name);
  }
  return { ...zustand, demoInstanz: demoInstanzAusHost(host) };
}

/**
 * AUFTRAG-mega61 Block A: derselbe Zustand für einen UNANGEMELDETEN Aufrufer — beschränkt auf die
 * Schalter, deren Fläche vor der Anmeldung überhaupt erreichbar ist (SCHALTER_VOR_ANMELDUNG), plus
 * die Demo-Kennzeichnung aus dem Host (JOB 3761/4365: die Anmeldemaske ist die Fläche, auf der sie
 * zählt).
 *
 * Bewusst eine TEILMENGE derselben Abbildung und kein eigener Vertrag: Der Leser in der Oberfläche
 * (`FeatureGate`) wertet einen fehlenden Schlüssel wie „aus" aus (`?? false`) — ein Unangemeldeter
 * sieht damit für jede andere Fläche genau das, was er sehen soll, ohne dass hier eine zweite
 * Auswertungsregel entsteht.
 */
export function schalterZustandVorAnmeldung(
  host: string | undefined,
): Partial<Record<SchalterName, boolean>> & { demoInstanz: boolean } {
  const zustand: Partial<Record<SchalterName, boolean>> = {};
  for (const name of SCHALTER_NAMEN) {
    if (SCHALTER_VOR_ANMELDUNG.has(name)) {
      zustand[name] = schalterAn(name);
    }
  }
  return { ...zustand, demoInstanz: demoInstanzAusHost(host) };
}
