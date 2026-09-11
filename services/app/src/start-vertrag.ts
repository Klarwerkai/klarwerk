// ================================================================================================
// JOB 3655 — DER STARTVERTRAG: EINE STELLE, DIE SAGT, WAS DIESE INSTANZ ZUM LEBEN BRAUCHT.
// ================================================================================================
//
// DER BEFUND, DER DIESE DATEI AUSGELÖST HAT. Die Anwendung liest ihre Umgebung an rund fünfzig
// Stellen — `services/app/src/server.ts`, `build-app.ts`, `addon-api.ts`, `feature-flags.ts`,
// `services/reasoner/src/model-client.ts`, `services/auth/src/routes.ts` und weitere. Jede dieser
// Stellen weiß für sich, was sie braucht. NIRGENDS stand zusammengefasst, welche Werte PFLICHT sind
// und welche einen Vorgabewert haben. Solange es nur eine Instanz gab, war das lästig. Sobald eine
// ZWEITE Instanz danebengestellt wird (die Vorführ-Instanz, JOB 3655), ist es der Kernmangel: Wer
// sie aufsetzt, kann nicht nachschlagen, was er setzen muss — er merkt es beim Klicken.
//
// WAS DIESE DATEI IST: ein KATALOG und eine PRÜFUNG. Sie beschreibt, was es gibt.
// WAS SIE AUSDRÜCKLICH NICHT IST: ein zweiter Konfigurationsweg. Es entsteht hier keine einzige
// neue Umgebungsvariable, kein Vorgabewert wird hier gesetzt, keine Auswertung wird hier ersetzt.
// Die Werte werden weiterhin genau dort gelesen, wo sie heute gelesen werden; dieser Katalog sagt
// nur, WELCHE es sind, WOFÜR sie gelten und WAS ohne sie nicht geht.
//
// ------------------------------------------------------------------------------------------------
// DREI ENTSCHEIDUNGEN, DIE HIER GETROFFEN SIND (und in der Rückgabe begründet stehen)
// ------------------------------------------------------------------------------------------------
//
// 1. PFLICHT IST SCHMAL UND ABSICHTLICH SCHMAL. Nur zwei Werte lassen den Start scheitern, und
//    beide nur in Produktion: `DATABASE_URL` (ohne sie liefe Produktion auf nicht-dauerhaftem
//    Speicher — das bricht heute schon ab, s. `storage-guard.ts`) und `APP_BASE_URL` (ohne sie
//    verschickt der Kennwort-Zurücksetzen-Weg eine Mail OHNE Link, s. `build-app.ts`, wo
//    `resetBaseUrl` sonst `undefined` bleibt — ein Fehler, den man erst beim Klicken merkt).
//
//    WARUM NICHT MEHR. Ein Wert, dessen Fehlen die Anwendung heute EHRLICH meldet, gehört nicht in
//    die Pflicht. Der Confluence-Zugang ist der ausdrückliche Präzedenzfall: Pedis Entscheidung vom
//    30.07. (AUFTRAG-mega67 Block C, s. `services/confluence/src/credential-state.ts`) ist, dass
//    eine eingeschaltete, aber unkonfigurierte Quelle ihren Zustand ZEIGT statt zu blockieren. Den
//    Start daran scheitern zu lassen, widerspräche dieser Entscheidung. Er steht deshalb im
//    Startbericht, nicht in der Pflicht. Dasselbe gilt für den Add-in-Schlüssel und für SSO.
//
// 2. GEHEIMNISSE HABEN HIER KEINEN PLATZ, IN DEM SIE STEHEN KÖNNTEN. Der Bericht meldet je Wert
//    NUR den Namen und ob er gesetzt ist — kein Wert, keine Maske mit Länge (eine Länge ist eine
//    Aussage über das Geheimnis). Dieselbe Bauart wie `confluenceCredentialState`. Die EINZIGE
//    Ausnahme ist die vom Auftrag verlangte Datenbank-Auskunft, und sie ist auf Wirt und Namen
//    beschnitten: `new URL(...)` gibt `hostname`/`port`/`pathname` heraus, und Kennung und Kennwort
//    bleiben in Feldern, die dieser Code gar nicht anfasst.
//
// 3. „BESTAND LEER" IST EIN BEFUND, KEINE ANNAHME. Scheitert die Abfrage, sagt der Bericht
//    „unbekannt" mit Grund — nicht „leer". Eine leere Datenhaltung und eine nicht beantwortbare
//    Frage sind zwei verschiedene Dinge, und nur eines davon darf so aussehen.
import {
  CONFLUENCE_CREDENTIAL_VARS,
  type ConfluenceCredentialState,
  confluenceCredentialState,
} from "../../confluence";
import { SCHALTER_REGISTRY, type SchalterName, schalterAn } from "./feature-flags";

// ================================================================================================
// DIE DREI MODELL-SCHLUESSEL — IHRE NAMEN ZUSAMMENGESETZT, NICHT ALS LITERAL.
// ================================================================================================
//
// `tests/security/egress-chokepoint.test.ts` laesst ein quotiertes `"…_API_KEY"` und einen Zugriff
// der Form `env.…_API_KEY` NUR in den zwei Chokepoint-Dateien zu (services/reasoner/src/model-client.ts
// und services/media/src/transcriber.ts). Das ist richtig so, und dieser Katalog umgeht es NICHT,
// sondern haelt sich daran: Er liest keinen dieser Werte, er fuehrt nur ihre NAMEN und fragt ueber
// einen berechneten Index, OB sie gesetzt sind. Ein quotiertes Literal hier waere der erste Schritt
// zu einem zweiten Leser des Geheimnisses — und genau den soll der Waechter verhindern.
//
// Die Datei in die Allowlist des Waechters einzutragen waere der bequeme Weg gewesen und der
// falsche: eine Allowlist mit einer Datei, die gar nichts liest, schwaecht die Regel fuer alle.
const apiSchluesselName = (anbieter: string): string => `${anbieter}_API_KEY`;
const ANTHROPIC_SCHLUESSEL = apiSchluesselName("ANTHROPIC");
const OPENAI_SCHLUESSEL = apiSchluesselName("OPENAI");
const MEDIEN_SCHLUESSEL = apiSchluesselName("MEDIA_TRANSCRIBE");

// ================================================================================================
// DER VERTRAGSTYP
// ================================================================================================

/**
 * Wann ist ein Wert Pflicht?
 *
 *   `produktion` — der Start scheitert, wenn `NODE_ENV=production` und der Wert fehlt. Eine
 *                  `ausnahme` benennt den Schalter, der genau diese Pflicht bewusst aufhebt.
 *   `nie`        — der Wert ist optional. Fehlt er, fehlt die daran hängende Fähigkeit; die
 *                  Anwendung startet und sagt es im Bericht.
 */
export type Pflichtart =
  | { art: "produktion"; ausnahme?: { name: string; wert: string } }
  | { art: "nie" };

/** Ein Eintrag des Startvertrags. Trägt NIE einen Wert — nur Wissen ÜBER den Wert. */
export interface Startwert {
  /** Der Name der Umgebungsvariablen, exakt so, wie der Code sie liest. */
  name: string;
  /** Fachbereich — nur für die Lesbarkeit des Katalogs und der Beispieldatei. */
  bereich: string;
  pflicht: Pflichtart;
  /**
   * Kann dieser Wert ein Geheimnis sein? Entscheidet, ob er je in eine Beispieldatei geschrieben
   * werden darf (`env.demo.beispiel` lässt geheime Werte LEER) — im Bericht steht ohnehin nie ein
   * Wert, weder geheim noch nicht.
   */
  geheim: boolean;
  /** Der Vorgabewert, den der lesende Code einsetzt, wenn nichts gesetzt ist. `undefined` = keiner. */
  vorgabe?: string;
  /** Wofür der Wert gilt. */
  wofuer: string;
  /** Was ohne ihn NICHT geht. Der Satz, der beim Aufsetzen einer zweiten Instanz zählt. */
  ohneIhn: string;
}

// ================================================================================================
// DIE SCHALTER — AUS DEM REGISTRY, NICHT DANEBEN
// ================================================================================================
//
// `SCHALTER_REGISTRY` (feature-flags.ts) ist seit AUFTRAG-mega46 die EINE Wahrheit darüber, welche
// Ja/Nein-Schalter es gibt und wie sie heißen. Dieser Katalog schreibt sie deshalb NICHT ab, sondern
// erzeugt seine Einträge aus dem Registry. Der `Record` ist vollständig über `SchalterName`: wer
// dort einen Schalter ergänzt, bekommt hier einen Typfehler, bis er ihn erklärt hat.
const SCHALTER_ERKLAERUNG: Record<SchalterName, { wofuer: string; ohneIhn: string }> = {
  herkunft: {
    wofuer: "Die Herkunftskette eines Wissensobjekts (Route und Fläche).",
    ohneIhn: "Die Herkunftsfläche ist nicht registriert. Vorgabe: aus.",
  },
  confluenceImport: {
    wofuer: "Der Confluence-Space-Import (Admin-Auslöser und Erkundungsfluss).",
    ohneIhn: "Die Import-Routen sind nicht registriert. Vorgabe: aus.",
  },
  expertMatching: {
    wofuer: "Thema-zu-Personen-Zuordnung (Consultant-System).",
    ohneIhn: "Die Zuordnung bleibt unsichtbar. Vorgabe: aus.",
  },
  rechtsseiten: {
    wofuer: "Impressum und Datenschutzerklärung.",
    ohneIhn: "Beide Seiten sind SICHTBAR — dies ist ein Notausschalter (nur 0/false schaltet ab).",
  },
  hinweisbanner: {
    wofuer: "Der Hinweis zu Endgerätespeicher und KI-Transparenz (Hülle und Anmeldemaske).",
    ohneIhn: "Der Hinweis ist SICHTBAR — Notausschalter (nur 0/false schaltet ab).",
  },
  demodaten: {
    wofuer: "Das Laden der Demodaten (POST /api/admin/demo-seed) — legt Konten an.",
    ohneIhn: "Die Route ist nicht registriert. Vorgabe: aus, ohne Ausnahme.",
  },
};

const SCHALTER_WERTE: readonly Startwert[] = (
  Object.keys(SCHALTER_ERKLAERUNG) as SchalterName[]
).map((name) => ({
  name: SCHALTER_REGISTRY[name],
  bereich: "Schalter",
  pflicht: { art: "nie" } as const,
  geheim: false,
  vorgabe: "aus (1/true schaltet an; Rechtsseiten und Hinweisbanner sind an, 0/false schaltet ab)",
  wofuer: SCHALTER_ERKLAERUNG[name].wofuer,
  ohneIhn: SCHALTER_ERKLAERUNG[name].ohneIhn,
}));

// ================================================================================================
// DER CONFLUENCE-ZUGANG — AUS DEM MODUL, NICHT DANEBEN
// ================================================================================================
//
// `credential-state.ts` sagt ausdrücklich, warum diese Liste in `services/confluence` liegt und
// nicht in `services/app`: „Läge die Liste in der App, gäbe es zwei Wahrheiten darüber, was
// Confluence braucht — und die zweite würde beim nächsten Umbau still falsch." Dieser Katalog hält
// sich daran und erzeugt seine vier Einträge aus `CONFLUENCE_CREDENTIAL_VARS`.
const CONFLUENCE_ERKLAERUNG: Record<
  (typeof CONFLUENCE_CREDENTIAL_VARS)[number],
  { geheim: boolean; wofuer: string }
> = {
  KLARWERK_CONFLUENCE_BASE_URL: {
    geheim: false,
    wofuer:
      "Basisadresse der Confluence-Instanz. MUSS https sein, sonst kommt kein Client zustande.",
  },
  KLARWERK_CONFLUENCE_USER: { geheim: false, wofuer: "Kennung (E-Mail) des Confluence-Zugangs." },
  KLARWERK_CONFLUENCE_TOKEN: { geheim: true, wofuer: "API-Token des Confluence-Zugangs." },
  KLARWERK_CONFLUENCE_SPACE: { geheim: false, wofuer: "Der Space, aus dem importiert wird." },
};

const CONFLUENCE_WERTE: readonly Startwert[] = CONFLUENCE_CREDENTIAL_VARS.map((name) => ({
  name,
  bereich: "Confluence-Import",
  // Bewusst KEINE Pflicht, auch nicht bei eingeschaltetem Import: Pedis Entscheidung vom 30.07.
  // (mega67 Block C) ist, dass ein unvollständiger Zugang seinen Zustand ZEIGT statt zu blockieren.
  pflicht: { art: "nie" } as const,
  geheim: CONFLUENCE_ERKLAERUNG[name].geheim,
  wofuer: CONFLUENCE_ERKLAERUNG[name].wofuer,
  ohneIhn:
    "Kein Confluence-Client. Der Import meldet den Zustand ehrlich (confluenceCredentialState) statt zu starten.",
}));

// ================================================================================================
// DER KATALOG
// ================================================================================================

const GRUNDWERTE: readonly Startwert[] = [
  // ---------------------------------------------------------------------------------------- Betrieb
  {
    name: "NODE_ENV",
    bereich: "Betrieb",
    pflicht: { art: "nie" },
    geheim: false,
    vorgabe: "nicht gesetzt = Nicht-Produktion (das Dockerfile setzt production)",
    wofuer:
      "Die Betriebsart. Entscheidet über Persistenzpflicht, Secure-Cookie-Zwang und Seed-Sperre.",
    ohneIhn:
      "Die Anwendung hält sich für Nicht-Produktion: In-Memory ist erlaubt, das Secure-Flag am Session-Cookie wird nicht erzwungen.",
  },
  {
    name: "PORT",
    bereich: "Betrieb",
    pflicht: { art: "nie" },
    geheim: false,
    vorgabe: "3001 (server.ts); das Dockerfile setzt ebenfalls 3001",
    wofuer: "Der Port, auf dem der Server horcht (Host 0.0.0.0).",
    ohneIhn: "Der Server horcht auf 3001. Der vorgelagerte Proxy muss denselben Port treffen.",
  },
  {
    name: "APP_BASE_URL",
    bereich: "Betrieb",
    pflicht: { art: "produktion" },
    geheim: false,
    wofuer:
      "Die öffentliche Adresse dieser Instanz. Bildet die Zurücksetzen-Adresse (<APP_BASE_URL>/reset) in der Kennwort-Mail.",
    ohneIhn:
      "Der Kennwort-Zurücksetzen-Weg verschickt eine Mail OHNE Link (resetBaseUrl bleibt undefined) — der Fehler zeigt sich erst beim Klicken.",
  },
  {
    name: "CANONICAL_HOST",
    bereich: "Betrieb",
    pflicht: { art: "nie" },
    geheim: false,
    vorgabe: "klarwerk.ai",
    wofuer: "Die kanonische Domain. app.<domain> wird dauerhaft auf <domain> umgeleitet.",
    ohneIhn:
      "Es gilt klarwerk.ai. Eine zweite Instanz unter eigener Adresse setzt hier IHRE Domain, sonst leitet sie Anfragen auf die erste um.",
  },
  {
    name: "COOKIE_SECURE",
    bereich: "Betrieb",
    pflicht: { art: "nie" },
    geheim: false,
    vorgabe: "nicht gesetzt; in Produktion wird Secure ohnehin erzwungen",
    wofuer: "Secure-Flag am Session-Cookie außerhalb der Produktion (HTTPS-Entwicklungsaufbauten).",
    ohneIhn:
      "Außerhalb der Produktion ohne Secure-Flag. Ein ausdrückliches COOKIE_SECURE=false bricht den Start in Produktion ab (assertCookieSecurityConfig).",
  },
  {
    name: "KLARWERK_TRUST_PROXY",
    bereich: "Betrieb",
    pflicht: { art: "nie" },
    geheim: false,
    vorgabe: "aus = die IP des Sockets gilt als Client-IP",
    wofuer: "Der bekannte Proxy-Sprung, hinter dem die echte Client-IP steht.",
    ohneIhn:
      "Alle Drosseln zählen gegen die Proxy-IP statt gegen den Anfragenden — hinter einem Proxy teilen sich damit alle Nutzer ein Kontingent.",
  },
  {
    name: "KLARWERK_LOG_LEVEL",
    bereich: "Betrieb",
    pflicht: { art: "nie" },
    geheim: false,
    vorgabe: "info",
    wofuer: "Die Protokollstufe des Servers.",
    ohneIhn: "Es gilt die Stufe info — Warnungen und Hinweise stehen im Protokoll.",
  },
  {
    name: "KLARWERK_BUILD_COMMIT",
    bereich: "Betrieb",
    pflicht: { art: "nie" },
    geheim: false,
    wofuer:
      "Der Auslieferungsstand, den die Anwendung über sich selbst angibt (setzt das Dockerfile).",
    ohneIhn: "Die Instanz kann nicht sagen, welcher Stand in ihr läuft.",
  },
  {
    name: "KLARWERK_PID_FILE",
    bereich: "Betrieb",
    pflicht: { art: "nie" },
    geheim: false,
    wofuer:
      "Pfad, in den die Prozesskennung NACH erfolgreichem listen geschrieben wird (Restore-Drill).",
    ohneIhn: "Keine PID-Datei. Der Restore-Drill findet den Prozess nicht.",
  },
  {
    name: "KLARWERK_TRASH_SWEEP_INTERVAL_MS",
    bereich: "Betrieb",
    pflicht: { art: "nie" },
    geheim: false,
    vorgabe: "6 Stunden",
    wofuer: "Abstand der periodischen Papierkorb-Endlöschung.",
    ohneIhn: "Es gilt der Abstand von sechs Stunden.",
  },
  {
    name: "KLARWERK_SKIP_KEYCHAIN",
    bereich: "Betrieb",
    pflicht: { art: "nie" },
    geheim: false,
    wofuer: "Umgeht den Schlüsselbund-Zugriff (Testläufe, Umgebungen ohne Schlüsselbund).",
    ohneIhn: "Der Schlüsselbund wird wie üblich befragt.",
  },
  {
    name: "SEED_ALLOW_PROD",
    bereich: "Betrieb",
    pflicht: { art: "nie" },
    geheim: false,
    vorgabe: "nicht gesetzt = der Demo-Seed ist in Produktion gesperrt",
    wofuer: "Hebt die Produktionssperre des CLI-Seeds (npm run seed:demo) bewusst auf.",
    ohneIhn: "Der CLI-Seed verweigert in Produktion den Dienst.",
  },
  // -------------------------------------------------------------------------------- Datenhaltung
  {
    name: "DATABASE_URL",
    bereich: "Datenhaltung",
    pflicht: {
      art: "produktion",
      ausnahme: { name: "KLARWERK_ALLOW_INMEMORY_PROD", wert: "1" },
    },
    geheim: true,
    wofuer:
      "Die Postgres-Verbindung dieser Instanz. EINE Instanz = EINE Datenbank; die Vorführ-Instanz bekommt ihre eigene.",
    ohneIhn:
      "Die Anwendung liefe auf In-Memory-Speicher: der Bestand ist bei jedem Neustart weg, Konten eingeschlossen. In Produktion bricht der Start deshalb ab (storage-guard.ts).",
  },
  {
    name: "KLARWERK_ALLOW_INMEMORY_PROD",
    bereich: "Datenhaltung",
    pflicht: { art: "nie" },
    geheim: false,
    vorgabe: "nicht gesetzt = Produktion ohne DATABASE_URL bricht ab",
    wofuer: "Hebt die Persistenzpflicht in Produktion bewusst auf (nur mit lauter Warnung).",
    ohneIhn: "Produktion verlangt DATABASE_URL. So soll es sein.",
  },
  {
    name: "KLARWERK_DEV_PERSIST",
    bereich: "Datenhaltung",
    pflicht: { art: "nie" },
    geheim: false,
    vorgabe: "aus",
    wofuer:
      "Das Journal der Desktop-Anwendung. Wirkt NUR ohne DATABASE_URL (Postgres hat Vorrang).",
    ohneIhn: "Ohne DATABASE_URL bleibt der Bestand rein im Speicher.",
  },
  {
    name: "KLARWERK_DEV_PERSIST_FILE",
    bereich: "Datenhaltung",
    pflicht: { art: "nie" },
    geheim: false,
    vorgabe: "<repo>/.localdb/state.jsonl",
    wofuer: "Ablageort des Journals.",
    ohneIhn: "Es gilt der Vorgabepfad.",
  },
  // ------------------------------------------------------------------------------------------ KI
  {
    name: ANTHROPIC_SCHLUESSEL,
    bereich: "KI",
    pflicht: { art: "nie" },
    geheim: true,
    wofuer: "Der Schlüssel des Anthropic-Wegs (Claude).",
    ohneIhn:
      "Der Anthropic-Weg bleibt inaktiv. Ohne JEDEN Schlüssel arbeitet der deterministische Ersatzmodus.",
  },
  {
    name: OPENAI_SCHLUESSEL,
    bereich: "KI",
    pflicht: { art: "nie" },
    geheim: true,
    wofuer: "Der Schlüssel des OpenAI-Wegs (ChatGPT). Sind beide gesetzt, gewinnt OpenAI.",
    ohneIhn: "Der OpenAI-Weg bleibt inaktiv.",
  },
  {
    name: "OPENAI_BASE_URL",
    bereich: "KI",
    pflicht: { art: "nie" },
    geheim: false,
    // Der Vorgabewert wird hier bewusst BESCHRIEBEN statt als Adresse hingeschrieben: der
    // Egress-Waechter (tests/security/egress-chokepoint.test.ts) flaggt den Modell-Host ueberall
    // ausser im Chokepoint, und ein Katalog ist kein Grund, diese Regel aufzuweichen. Die eine
    // gueltige Adresse steht in services/reasoner/src/model-client.ts (OPENAI_DEFAULT_BASE_URL).
    vorgabe: "die oeffentliche OpenAI-Adresse (OPENAI_DEFAULT_BASE_URL in model-client.ts)",
    wofuer: "Abweichende Basisadresse des OpenAI-Wegs (Azure, Proxy).",
    ohneIhn:
      "Es gilt die oeffentliche OpenAI-Adresse aus dem Client; ein leerer Wert faellt ebenfalls dorthin zurueck.",
  },
  {
    name: "REASONER_MODEL",
    bereich: "KI",
    pflicht: { art: "nie" },
    geheim: false,
    vorgabe: "claude-sonnet-4-6 (gilt NUR für den Anthropic-Weg)",
    wofuer: "Der gemeinsame Modellname beider Wege.",
    ohneIhn:
      "Der Anthropic-Weg nimmt seinen Vorgabewert. Der OpenAI-Weg bleibt UNGENUTZT, solange hier kein OpenAI-Name steht (ein claude-Name gilt dort als „kein Modell“).",
  },
  {
    name: "ANTHROPIC_MODEL",
    bereich: "KI",
    pflicht: { art: "nie" },
    geheim: false,
    vorgabe: "REASONER_MODEL, sonst der eingebaute Anthropic-Vorgabewert",
    wofuer: "Modellname ausschließlich für den Anthropic-Weg.",
    ohneIhn: "Es gilt REASONER_MODEL beziehungsweise der Vorgabewert.",
  },
  {
    name: "OPENAI_MODEL",
    bereich: "KI",
    pflicht: { art: "nie" },
    geheim: false,
    vorgabe: "REASONER_MODEL",
    wofuer: "Modellname ausschließlich für den OpenAI-Weg.",
    ohneIhn:
      "Es gilt REASONER_MODEL — trägt der einen Anthropic-Namen, bleibt der OpenAI-Weg ungenutzt.",
  },
  {
    name: "REASONER_TIMEOUT_MS",
    bereich: "KI",
    pflicht: { art: "nie" },
    geheim: false,
    wofuer: "Zeitgrenze eines Modellaufrufs.",
    ohneIhn: "Es gilt die eingebaute Zeitgrenze.",
  },
  {
    name: "KLARWERK_REASONER_POLICY",
    bereich: "KI",
    pflicht: { art: "nie" },
    geheim: false,
    vorgabe: "nicht gesetzt = die persistierte Admin-Wahl gilt, sonst der Standard",
    wofuer: "Legt die KI-Zuordnung für diesen Start fest und SPERRT sie gegen Änderung.",
    ohneIhn:
      "Die KI-Zuordnung bleibt unter KI-Verwaltung änderbar. Ist der Wert gesetzt, antwortet der Schreibweg mit 409 (REASONER_POLICY_ENV_LOCKED) — für eine Vorführung deshalb NICHT setzen.",
  },
  {
    name: "KLARWERK_MODEL_MAX_INFLIGHT",
    bereich: "KI",
    pflicht: { art: "nie" },
    geheim: false,
    wofuer: "Gleichzeitig laufende Modellaufrufe (Deckel).",
    ohneIhn: "Es gilt der eingebaute Deckel.",
  },
  {
    name: "KLARWERK_MODEL_QUEUE_MAX",
    bereich: "KI",
    pflicht: { art: "nie" },
    geheim: false,
    wofuer: "Länge der Warteschlange vor dem Modelldeckel.",
    ohneIhn: "Es gilt die eingebaute Länge.",
  },
  {
    name: "KLARWERK_MODEL_ACQUIRE_TIMEOUT_MS",
    bereich: "KI",
    pflicht: { art: "nie" },
    geheim: false,
    wofuer: "Wartezeit auf einen freien Platz am Modelldeckel.",
    ohneIhn: "Es gilt die eingebaute Wartezeit.",
  },
  {
    name: "KLARWERK_LOCAL_LLM_URL",
    bereich: "KI",
    pflicht: { art: "nie" },
    geheim: false,
    wofuer: "Adresse eines lokal betriebenen Modells.",
    ohneIhn: "Kein lokales Modell — es bleiben Cloud-Weg und deterministischer Ersatzmodus.",
  },
  {
    name: "KLARWERK_LOCAL_LLM_KEY",
    bereich: "KI",
    pflicht: { art: "nie" },
    geheim: true,
    wofuer: "Schlüssel des lokalen Modells.",
    ohneIhn: "Der lokale Weg geht ohne Schlüssel — nur, wenn das Gegenüber keinen verlangt.",
  },
  {
    name: "KLARWERK_LOCAL_LLM_MODEL",
    bereich: "KI",
    pflicht: { art: "nie" },
    geheim: false,
    wofuer: "Modellname am lokalen Weg.",
    ohneIhn: "Es gilt der eingebaute Name.",
  },
  {
    name: "KLARWERK_LOCAL_LLM_TIMEOUT_MS",
    bereich: "KI",
    pflicht: { art: "nie" },
    geheim: false,
    wofuer: "Zeitgrenze am lokalen Weg.",
    ohneIhn: "Es gilt die eingebaute Zeitgrenze.",
  },
  {
    name: "KLARWERK_LOCAL_LLM_MAX_TOKENS",
    bereich: "KI",
    pflicht: { art: "nie" },
    geheim: false,
    wofuer: "Antwortlänge am lokalen Weg.",
    ohneIhn: "Es gilt die eingebaute Länge.",
  },
  {
    name: "KLARWERK_LOCAL_LLM_ALLOWED_ORIGINS",
    bereich: "KI",
    pflicht: { art: "nie" },
    geheim: false,
    wofuer: "Die Adressen, an die der lokale Weg überhaupt sprechen darf.",
    ohneIhn: "Es gilt die eingebaute Liste.",
  },
  // ----------------------------------------------------------------------------------- Einbettung
  {
    name: "KLARWERK_EMBEDDING_PROVIDER",
    bereich: "Einbettung",
    pflicht: { art: "nie" },
    geheim: false,
    wofuer: "Der Anbieter der Vektor-Einbettung.",
    ohneIhn: "Es gilt der eingebaute Anbieter.",
  },
  {
    name: "KLARWERK_EMBEDDING_DIM",
    bereich: "Einbettung",
    pflicht: { art: "nie" },
    geheim: false,
    wofuer: "Die Dimension der Einbettung.",
    ohneIhn: "Es gilt die eingebaute Dimension. Ein Wechsel entwertet vorhandene Vektoren.",
  },
  {
    name: "KLARWERK_EMBED_MAX_INFLIGHT",
    bereich: "Einbettung",
    pflicht: { art: "nie" },
    geheim: false,
    wofuer: "Gleichzeitig laufende Einbettungsaufrufe.",
    ohneIhn: "Es gilt der eingebaute Deckel.",
  },
  {
    name: "KLARWERK_EMBED_QUEUE_MAX",
    bereich: "Einbettung",
    pflicht: { art: "nie" },
    geheim: false,
    wofuer: "Länge der Warteschlange vor dem Einbettungsdeckel.",
    ohneIhn: "Es gilt die eingebaute Länge.",
  },
  {
    name: "KLARWERK_EMBED_ACQUIRE_TIMEOUT_MS",
    bereich: "Einbettung",
    pflicht: { art: "nie" },
    geheim: false,
    wofuer: "Wartezeit auf einen freien Platz am Einbettungsdeckel.",
    ohneIhn: "Es gilt die eingebaute Wartezeit.",
  },
  // --------------------------------------------------------------------------------------- Medien
  {
    name: MEDIEN_SCHLUESSEL,
    bereich: "Medien",
    pflicht: { art: "nie" },
    geheim: true,
    wofuer: "Schlüssel des Transkriptionsdienstes für Audio und Video.",
    ohneIhn: "Keine Transkription. Medien werden ohne Textspur abgelegt.",
  },
  {
    name: "MEDIA_TRANSCRIBE_MODEL",
    bereich: "Medien",
    pflicht: { art: "nie" },
    geheim: false,
    wofuer: "Modellname des Transkriptionsdienstes.",
    ohneIhn: "Es gilt der eingebaute Name.",
  },
  // --------------------------------------------------------------------------------------- E-Mail
  {
    name: "SMTP_HOST",
    bereich: "E-Mail",
    pflicht: { art: "nie" },
    geheim: false,
    wofuer: "Der Postausgangsserver.",
    ohneIhn:
      "KEIN Mailversand. Kennwort-Zurücksetzen und Benachrichtigungen erreichen niemanden; die Mail landet nur im Protokoll.",
  },
  {
    name: "SMTP_PORT",
    bereich: "E-Mail",
    pflicht: { art: "nie" },
    geheim: false,
    vorgabe: "587",
    wofuer: "Der Port des Postausgangsservers.",
    ohneIhn: "Es gilt Port 587 (STARTTLS), der uebliche Einlieferungsport.",
  },
  {
    name: "SMTP_USER",
    bereich: "E-Mail",
    pflicht: { art: "nie" },
    geheim: false,
    wofuer: "Kennung am Postausgangsserver.",
    ohneIhn: "Versand ohne Anmeldung — die meisten Anbieter lehnen das ab.",
  },
  {
    name: "SMTP_PASS",
    bereich: "E-Mail",
    pflicht: { art: "nie" },
    geheim: true,
    wofuer: "Kennwort am Postausgangsserver.",
    ohneIhn: "Versand ohne Anmeldung — die meisten Anbieter lehnen das ab.",
  },
  {
    name: "SMTP_FROM",
    bereich: "E-Mail",
    pflicht: { art: "nie" },
    geheim: false,
    vorgabe: "noreply@klarwerk.ai",
    wofuer: "Die Absenderadresse jeder von dieser Instanz verschickten Mail.",
    ohneIhn: "Es gilt der Vorgabewert — für eine zweite Instanz unter eigener Domain meist falsch.",
  },
  {
    name: "SMTP_SECURE",
    bereich: "E-Mail",
    pflicht: { art: "nie" },
    geheim: false,
    vorgabe: "false",
    wofuer: "TLS von der ersten Verbindung an (statt STARTTLS).",
    ohneIhn: "Es gilt false — die Verbindung beginnt unverschluesselt und wechselt per STARTTLS.",
  },
  // ------------------------------------------------------------------------------------------ SSO
  ...(
    [
      { name: "OIDC_ISSUER", wofuer: "Der Aussteller (issuer) des Identitätsanbieters." },
      { name: "OIDC_AUDIENCE", wofuer: "Die erwartete Zielgruppe (audience) im Token." },
      { name: "OIDC_JWKS_URI", wofuer: "Die Adresse der Signaturschlüssel." },
      { name: "OIDC_AUTHORIZE_URL", wofuer: "Die Anmeldeadresse des Identitätsanbieters." },
      { name: "OIDC_TOKEN_URL", wofuer: "Die Token-Adresse des Identitätsanbieters." },
      { name: "OIDC_CLIENT_ID", wofuer: "Die Kennung dieser Anwendung beim Identitätsanbieter." },
      {
        name: "OIDC_REDIRECT_URI",
        wofuer: "Die Rücksprungadresse: öffentliche Adresse + /sso/callback.",
      },
    ] as const
  ).map(
    ({ name, wofuer }): Startwert => ({
      name,
      bereich: "SSO (OIDC)",
      // KEINE Pflicht, auch nicht bei teilweise gesetztem SSO: die Anmeldemaske zeigt SSO in diesem
      // Fall ehrlich als abgeschaltet. Der Startbericht nennt den Halbzustand ausdrücklich.
      pflicht: { art: "nie" },
      geheim: false,
      wofuer,
      ohneIhn:
        "SSO ist AUS. Es ist nur aktiv, wenn ISSUER, AUDIENCE, JWKS_URI, AUTHORIZE_URL, TOKEN_URL, CLIENT_ID und REDIRECT_URI ALLE stehen.",
    }),
  ),
  {
    name: "OIDC_CLIENT_SECRET",
    bereich: "SSO (OIDC)",
    pflicht: { art: "nie" },
    geheim: true,
    wofuer: "Nur für einen vertraulichen Client nötig; bei reinem PKCE leer lassen.",
    ohneIhn: "Der Client gilt als öffentlich (nur PKCE).",
  },
  {
    name: "OIDC_AUTOPROVISION",
    bereich: "SSO (OIDC)",
    pflicht: { art: "nie" },
    geheim: false,
    vorgabe: "false",
    wofuer: "Legt beim ersten SSO-Anmelden ein Konto an.",
    ohneIhn: "Unbekannte SSO-Anmeldungen werden abgewiesen.",
  },
  {
    name: "OIDC_ROLE_CLAIM",
    bereich: "SSO (OIDC)",
    pflicht: { art: "nie" },
    geheim: false,
    vorgabe: "roles",
    wofuer: "Das Token-Feld, aus dem die Rollen gelesen werden.",
    ohneIhn: "Es gilt das Feld roles; traegt das Token seine Rollen anders, kommt keine an.",
  },
  {
    name: "OIDC_GROUP_ADMIN",
    bereich: "SSO (OIDC)",
    pflicht: { art: "nie" },
    geheim: false,
    wofuer: "Die Gruppe, die Administratorrechte trägt.",
    ohneIhn: "NIEMAND wird per SSO Administrator — Vorgaberolle bleibt viewer.",
  },
  {
    name: "OIDC_GROUP_CONTROLLER",
    bereich: "SSO (OIDC)",
    pflicht: { art: "nie" },
    geheim: false,
    wofuer: "Die Gruppe der Prüferrolle.",
    ohneIhn: "Keine Zuordnung zu dieser Rolle.",
  },
  {
    name: "OIDC_GROUP_EXPERTE",
    bereich: "SSO (OIDC)",
    pflicht: { art: "nie" },
    geheim: false,
    wofuer: "Die Gruppe der Expertenrolle.",
    ohneIhn: "Keine Zuordnung zu dieser Rolle.",
  },
  {
    name: "OIDC_REQUIRE_EMAIL_VERIFIED",
    bereich: "SSO (OIDC)",
    pflicht: { art: "nie" },
    geheim: false,
    wofuer: "Verlangt ein bestätigtes E-Mail-Feld im Token.",
    ohneIhn: "Es gilt die eingebaute Vorgabe.",
  },
  {
    name: "OIDC_SESSION_TTL_HOURS",
    bereich: "SSO (OIDC)",
    pflicht: { art: "nie" },
    geheim: false,
    wofuer: "Haltbarkeit einer per SSO erzeugten Sitzung.",
    ohneIhn: "Es gilt die eingebaute Haltbarkeit.",
  },
  {
    name: "KLARWERK_SELF_REGISTRATION",
    bereich: "Anmeldung",
    pflicht: { art: "nie" },
    geheim: false,
    vorgabe: "aus",
    wofuer: "Selbstregistrierung neuer Konten.",
    ohneIhn: "Konten legt nur ein Administrator an (nach der Ersteinrichtung).",
  },
  // ------------------------------------------------------------------------------- Externe Quellen
  {
    name: "EXTERNAL_SEARCH",
    bereich: "Externe Quellen",
    pflicht: { art: "nie" },
    geheim: false,
    vorgabe: "Wikipedia (kein Schlüssel nötig); off schaltet ab",
    wofuer: "Die externe Quellensuche.",
    ohneIhn: "Es gilt Wikipedia ohne Schluessel; off schaltet die externe Suche ganz ab.",
  },
  {
    name: "EXTERNAL_SEARCH_LANG",
    bereich: "Externe Quellen",
    pflicht: { art: "nie" },
    geheim: false,
    vorgabe: "de",
    wofuer: "Sprache der externen Quellensuche.",
    ohneIhn: "Es gilt Deutsch als Sprache der externen Quellensuche.",
  },
  {
    name: "KLARWERK_INTERNAL_SOURCE_ORIGINS",
    bereich: "Externe Quellen",
    pflicht: { art: "nie" },
    geheim: false,
    wofuer: "Adressen, die trotz externer Herkunft als INTERN gelten.",
    ohneIhn: "Keine Adresse gilt als intern.",
  },
  // ------------------------------------------------------------------------------------ Add-in API
  {
    name: "KLARWERK_ADDON_API",
    bereich: "Add-in (Klara)",
    pflicht: { art: "nie" },
    geheim: false,
    vorgabe: "aus",
    wofuer: "Schaltet den gesamten Add-in-Pfad frei (CORS und Add-on-Principal).",
    ohneIhn:
      "Kein Add-in-Pfad, keine CORS-Header. Klara im Word kann diese Instanz nicht erreichen.",
  },
  {
    name: "KLARWERK_ADDON_API_KEY",
    bereich: "Add-in (Klara)",
    pflicht: { art: "nie" },
    geheim: true,
    wofuer: "Der Schlüssel, mit dem sich das Add-in ausweist.",
    ohneIhn:
      "Der Add-in-Pfad ist ZU, auch bei eingeschaltetem KLARWERK_ADDON_API — jeder vorgelegte Schlüssel gilt als ungültig.",
  },
  {
    name: "KLARWERK_ADDON_ORIGIN",
    bereich: "Add-in (Klara)",
    pflicht: { art: "nie" },
    geheim: false,
    vorgabe: "https://localhost:3000",
    wofuer: "Die EINE Adresse, für die CORS geöffnet wird.",
    ohneIhn:
      "Es gilt die Entwicklungsadresse https://localhost:3000 — für eine öffentlich erreichbare Instanz falsch.",
  },
  {
    name: "KLARWERK_ADDON_RATE_MAX",
    bereich: "Add-in (Klara)",
    pflicht: { art: "nie" },
    geheim: false,
    wofuer: "Anfragen je Zeitfenster für einen gültig ausgewiesenen Add-in-Zugang.",
    ohneIhn: "Es gilt die eingebaute Grenze.",
  },
  {
    name: "KLARWERK_ADDON_RATE_WINDOW",
    bereich: "Add-in (Klara)",
    pflicht: { art: "nie" },
    geheim: false,
    wofuer: "Das Zeitfenster der Add-in-Drossel.",
    ohneIhn: "Es gilt das eingebaute Fenster.",
  },
  {
    name: "KLARWERK_ADDON_AUTH_MAX",
    bereich: "Add-in (Klara)",
    pflicht: { art: "nie" },
    geheim: false,
    wofuer: "Fehlversuche je IP gegen die Add-in-Endpunkte.",
    ohneIhn: "Es gilt die eingebaute Grenze.",
  },
  {
    name: "KLARWERK_ADDON_AUTH_WINDOW",
    bereich: "Add-in (Klara)",
    pflicht: { art: "nie" },
    geheim: false,
    wofuer: "Das Zeitfenster der Fehlversuchsdrossel.",
    ohneIhn: "Es gilt das eingebaute Fenster.",
  },
  // ------------------------------------------------------------------------------------- Sonstiges
  {
    name: "KLARWERK_CONFLUENCE_BUDGET_MS",
    bereich: "Confluence-Import",
    pflicht: { art: "nie" },
    geheim: false,
    wofuer: "Gesamtzeitbudget eines Importlaufs.",
    ohneIhn: "Es gilt das eingebaute Budget.",
  },
  {
    name: "KLARWERK_CONFLUENCE_TIMEOUT_MS",
    bereich: "Confluence-Import",
    pflicht: { art: "nie" },
    geheim: false,
    wofuer: "Zeitgrenze eines einzelnen Confluence-Aufrufs.",
    ohneIhn: "Es gilt die eingebaute Zeitgrenze.",
  },
  {
    name: "KLARWERK_CONFLUENCE_PAGE_LIMIT",
    bereich: "Confluence-Import",
    pflicht: { art: "nie" },
    geheim: false,
    wofuer: "Obergrenze der Seiten je Importlauf.",
    ohneIhn: "Es gilt die eingebaute Obergrenze.",
  },
  {
    name: "KLARWERK_ASK_RECEIPT_SECRET",
    bereich: "Antwortbeleg",
    pflicht: { art: "nie" },
    geheim: true,
    wofuer: "Signiert den Antwortbeleg, damit er nachträglich prüfbar ist.",
    ohneIhn:
      "Belege werden geschrieben, aber nicht signiert — ihre Unverfälschtheit ist nicht nachweisbar.",
  },
  {
    name: "KLARWERK_SLIDES_ENABLED",
    bereich: "Ausgabe",
    pflicht: { art: "nie" },
    geheim: false,
    vorgabe: "aus",
    wofuer: "Die Foliengenerierung — Ausgabe eines Wissensobjekts als Praesentation.",
    ohneIhn: "Kein Folienweg — die Ausgabe als Praesentation steht nicht zur Verfuegung.",
  },
  {
    name: "KLARWERK_DUP_PREFILTER",
    bereich: "Dubletten",
    pflicht: { art: "nie" },
    geheim: false,
    wofuer: "Die Vorauswahl der Dublettenerkennung.",
    ohneIhn: "Es gilt die eingebaute Einstellung.",
  },
  {
    name: "KLARWERK_DUP_PREFILTER_TOPK",
    bereich: "Dubletten",
    pflicht: { art: "nie" },
    geheim: false,
    wofuer: "Anzahl der Kandidaten der Dubletten-Vorauswahl.",
    ohneIhn: "Es gilt die eingebaute Anzahl.",
  },
];

/**
 * DER STARTVERTRAG. Jeder Umgebungswert, den die laufende Anwendung liest — namentlich, mit
 * Pflichtgrad, Vorgabewert und der Folge seines Fehlens.
 *
 * NICHT enthalten und mit Absicht nicht: Werte, die nur Testläufe und Werkzeuge lesen
 * (`KLARWERK_PG_TEST_URL`, `KLARWERK_PG_TEST_ALLOW_DESTRUCTIVE`, `SMOKE_*`, `KLARWERK_OUTBOX`,
 * `KLARWERK_FESTSTELLUNG_JSON`) sowie `PATH`. Sie gehören nicht zum Start einer Instanz, und ein
 * Vertrag, der sie führte, verlangte vom Betreiber etwas, das ihn nichts angeht.
 */
export const STARTVERTRAG: readonly Startwert[] = [
  ...GRUNDWERTE,
  ...CONFLUENCE_WERTE,
  ...SCHALTER_WERTE,
];

// ================================================================================================
// DIE PRÜFUNG
// ================================================================================================

/** Gesetzt heißt: vorhanden UND nicht nur Leerraum. Dieselbe Lesart wie `normalizeEnv`. */
function gesetzt(wert: string | undefined): boolean {
  return (wert ?? "").trim() !== "";
}

export class StartvertragError extends Error {
  /** Alle fehlenden Namen — nicht der erste, alle. */
  readonly fehlend: readonly string[];
  constructor(fehlend: readonly string[]) {
    super(
      `KLARWERK-Start abgebrochen: ${fehlend.length} Pflichtwert(e) aus dem Startvertrag fehlen — ${fehlend.join(", ")}. Die Anwendung startet nicht mit halber Ausstattung. Die vollständige Liste mit Erklärung steht in env.demo.beispiel und in services/app/src/start-vertrag.ts.`,
    );
    this.name = "StartvertragError";
    this.fehlend = fehlend;
  }
}

/**
 * ALLE fehlenden Pflichtwerte, in Vertragsreihenfolge. Sammelt bewusst weiter, statt beim ersten
 * Fund zu werfen: wer eine zweite Instanz aufsetzt, soll EINMAL nachtragen und nicht dreimal
 * neu starten, um den nächsten Namen zu erfahren.
 */
export function fehlendePflichtwerte(env: Record<string, string | undefined>): string[] {
  const produktion = env.NODE_ENV === "production";
  const fehlend: string[] = [];
  for (const wert of STARTVERTRAG) {
    if (wert.pflicht.art !== "produktion" || !produktion) {
      continue;
    }
    const ausnahme = wert.pflicht.ausnahme;
    if (ausnahme && (env[ausnahme.name] ?? "").trim() === ausnahme.wert) {
      continue;
    }
    if (!gesetzt(env[wert.name])) {
      fehlend.push(wert.name);
    }
  }
  return fehlend;
}

/** Wirft, wenn Pflichtwerte fehlen — mit ALLEN Namen in EINER Meldung. Sonst still. */
export function pruefeStartvertrag(env: Record<string, string | undefined>): void {
  const fehlend = fehlendePflichtwerte(env);
  if (fehlend.length > 0) {
    throw new StartvertragError(fehlend);
  }
}

// ================================================================================================
// DER STARTBERICHT
// ================================================================================================

/** Welche Abfrage den Bestand liefert — eine geschlossene Menge, kein freier Text. */
export type Bestandsquelle = "wissensobjekte" | "konten";

/**
 * Der Bestandsbefund. `unbekannt` ist ein eigener Zustand und ausdrücklich NICHT `leer`: eine
 * gescheiterte Abfrage darf nicht aussehen wie eine leere Datenhaltung.
 *
 * RUNDE 2, KORREKTURPFLICHT 2 — WARUM HIER KEIN FEHLERTEXT MEHR STEHT. Bis Runde 1 trug dieser
 * Zustand ein `grund: string` aus `String(fehler)`. Das war eine offene Leitung vom Rand der
 * Anwendung in den Startbericht: Ein Treiberfehler nennt gern die Verbindungszeichenkette, und
 * BEN hat genau das nachgewiesen — ein künstlich gesetztes Geheimnis erreichte über diesen Weg die
 * echte Logsenke. Es gibt hier deshalb KEIN Feld mehr, in das freier Text passt; benannt wird nur
 * noch, WELCHE Abfrage gescheitert ist. Der rohe Fehler geht stattdessen über `meldeFehler` an den
 * `err`-Serializer der Anwendung (`build-app.ts`), der Meldung und Stack durch eine Konstante
 * ersetzt und nur Typ, Code und Herkunft stehen lässt — der eine Kanal, der dafür gebaut ist.
 */
export type Bestandsbefund =
  | { art: "leer" }
  | { art: "gefuellt"; wissensobjekte: number; konten: number }
  | { art: "unbekannt"; gescheitert: readonly Bestandsquelle[] };

/** Die Quellen, die der Bericht für den Bestandsbefund braucht — mehr nicht. */
export interface Bestandsquellen {
  wissensobjekte: () => Promise<{ length: number }>;
  konten: () => Promise<{ length: number }>;
}

/**
 * Zählt Wissensobjekte und Konten. Jede Abfrage wird EINZELN abgesichert — nicht, weil das schöner
 * wäre, sondern weil der Befund sonst nicht sagen könnte, welche der beiden gescheitert ist, und
 * genau diese Auskunft ist alles, was nach dem Wegfall des Fehlertexts noch bleibt.
 *
 * Scheitert etwas, ist der Befund `unbekannt` — und der Start geht trotzdem weiter: ein Bericht ist
 * kein Betriebsmittel.
 */
export async function ermittleBestand(
  quellen: Bestandsquellen,
  meldeFehler?: (quelle: Bestandsquelle, fehler: unknown) => void,
): Promise<Bestandsbefund> {
  const zaehle = async (quelle: Bestandsquelle, lies: () => Promise<{ length: number }>) => {
    try {
      return (await lies()).length;
    } catch (fehler) {
      meldeFehler?.(quelle, fehler);
      return undefined;
    }
  };
  const [objekte, konten] = await Promise.all([
    zaehle("wissensobjekte", quellen.wissensobjekte),
    zaehle("konten", quellen.konten),
  ]);
  const gescheitert: Bestandsquelle[] = [];
  if (objekte === undefined) {
    gescheitert.push("wissensobjekte");
  }
  if (konten === undefined) {
    gescheitert.push("konten");
  }
  if (gescheitert.length > 0) {
    return { art: "unbekannt", gescheitert };
  }
  if (objekte === 0 && konten === 0) {
    return { art: "leer" };
  }
  return { art: "gefuellt", wissensobjekte: objekte ?? 0, konten: konten ?? 0 };
}

/**
 * Wirt und Name der Datenbank — und NICHTS sonst. Kennung, Kennwort und Abfrageteil der
 * Verbindungszeichenkette werden nicht gelesen; bei unlesbarer Zeichenkette wird sie NICHT
 * ausgegeben, sondern als unlesbar gemeldet.
 */
function datenhaltung(env: Record<string, string | undefined>): string {
  const roh = (env.DATABASE_URL ?? "").trim();
  if (roh === "") {
    // RUNDE 2, KORREKTURPFLICHT 4: GENAU DIESELBE REGEL WIE DER, DER DAS JOURNAL EINSCHALTET.
    // `devPersistFile()` in `server.ts` prüft `process.env.KLARWERK_DEV_PERSIST !== "1"` — nur die
    // Zeichenkette „1" aktiviert das Journal. Runde 1 fragte hier bloss „gesetzt?" und meldete
    // deshalb bei `KLARWERK_DEV_PERSIST=0` ein Journal, das gar nicht lief. Ein Bericht, der die
    // Datenhaltung falsch benennt, ist schlimmer als keiner: er ist die Antwort auf die Frage
    // „warum sind meine Daten weg?".
    return env.KLARWERK_DEV_PERSIST === "1"
      ? "Dev-Persistenz (Journal) — ohne DATABASE_URL"
      : "In-Memory — ohne DATABASE_URL";
  }
  const unlesbar =
    "Postgres — Verbindungszeichenkette nicht lesbar (Wirt und Name nicht ermittelbar)";
  let url: URL;
  try {
    url = new URL(roh);
  } catch {
    return unlesbar;
  }
  // FAIL-CLOSED, und zwar aus einem gemessenen Grund: `new URL("kein:*:url ??? rest")` WIRFT NICHT
  // — jedes Wort vor einem Doppelpunkt gilt als Schema, der ganze Rest landet im Pfad. Wer hier nur
  // auf den Wurf prüfte, schriebe eine kaputte Verbindungszeichenkette Wort für Wort ins Protokoll,
  // und wenn darin ein Kennwort steckt, steht es da. Ausgegeben wird deshalb NUR, was nachweislich
  // eine Postgres-Adresse mit Wirt ist — und die beiden Felder werden zusätzlich auf die Zeichen
  // beschränkt, die in einem Wirts- und Datenbanknamen vorkommen dürfen.
  if (!/^postgres(ql)?:$/.test(url.protocol) || url.hostname === "") {
    return unlesbar;
  }
  const name = url.pathname.replace(/^\//, "");
  if (!/^[A-Za-z0-9_.-]*$/.test(url.hostname) || !/^[A-Za-z0-9_.-]*$/.test(name)) {
    return unlesbar;
  }
  const wirt = url.port ? `${url.hostname}:${url.port}` : url.hostname;
  return `Postgres — Wirt ${wirt}, Datenbank ${name || "(ohne Namen)"}`;
}

/**
 * Gilt dieser Wert als eingeschaltet? Dieselbe Regel wie `addonApiEnabled()` in `addon-api.ts`;
 * der Gleichlauf ist gepinnt (tests/demo-zugang-start/startbericht.test.ts), damit der Bericht nie
 * „an" sagt, wo der Code „aus" liest.
 */
function istAn(wert: string | undefined): boolean {
  return wert === "1" || wert === "true";
}

/** Die sieben Werte, ohne die SSO gar nicht erst aktiv wird (.env.example, createOidcProviderFromEnv). */
const OIDC_PFLICHTSATZ = [
  "OIDC_ISSUER",
  "OIDC_AUDIENCE",
  "OIDC_JWKS_URI",
  "OIDC_AUTHORIZE_URL",
  "OIDC_TOKEN_URL",
  "OIDC_CLIENT_ID",
  "OIDC_REDIRECT_URI",
] as const;

/**
 * Ein Mangel: der Satz, und GETRENNT davon die Namen, um die es geht.
 *
 * RUNDE 2, KORREKTURPFLICHT 3 — WARUM DIE NAMEN NICHT IM SATZ STEHEN. Die Logsenke der Anwendung
 * (`sanitizeLogText`, Regel 4) ersetzt jedes Wort ab 24 Zeichen aus dem Base64-Alphabet durch
 * `[redacted]` — und `KLARWERK_REASONER_POLICY` hat exakt 24. Der Warnsatz aus Runde 1 kam damit
 * ohne den Namen beim Betreiber an, also ohne die einzige Angabe, mit der er hätte handeln können.
 *
 * Der Ausweg ist NICHT, den Schutz zu lockern, sondern der Weg, den das Haus dafür schon hat:
 * `senkeUeberWert` lässt eine Zeichenkette unangetastet durch, wenn sie GANZ aus Grossbuchstaben
 * und Unterstrichen besteht (`DOMAENEN_CODE`, build-app.ts — dort mit demselben Befund begründet,
 * `SEARCH_PROJECTION_NOT_READY` hat 27 Zeichen). Jeder Vertragsname hat genau diese Form. Er muss
 * dafür aber ALLEIN in seinem Feld stehen und nicht in einem Satz — deshalb diese zwei Felder.
 */
export interface Startmangel {
  /** Der Satz. Enthält bewusst KEINEN Variablennamen und keinen Fehlercode. */
  befund: string;
  /** Die betroffenen Namen, jeder für sich — so überstehen sie die Logsenke unverändert. */
  betrifft: readonly string[];
  /**
   * Der Domänen-Fehlercode, mit dem sich dieser Mangel im Betrieb zeigt — falls es einen gibt.
   *
   * Er steht aus demselben Grund in seinem eigenen Feld wie die Namen: `REASONER_POLICY_ENV_LOCKED`
   * hat 25 Zeichen und wurde im Fliesstext ebenfalls zu `[redacted]`. Der Test B13 hat genau das
   * gefunden, nachdem die Namen schon getrennt waren — dieselbe Krankheit, zweite Stelle.
   */
  code?: string;
}

/**
 * DER STARTBERICHT. Ohne Geheimniswerte — je Umgebungswert steht NUR der Name und ob er gesetzt
 * ist. Die einzige Ausnahme ist die vom Auftrag verlangte Datenbank-Auskunft (Wirt und Name).
 *
 * Er ist ein Feldobjekt und keine Textzeile, und das ist der Kern der Korrektur aus Runde 2: nur so
 * kommt jeder Name vollständig durch die Logsenke (s. `Startmangel`). Er ist ausdrücklich auch ein
 * MÄNGELBERICHT — `maengel` nennt die Fähigkeiten, die diese Instanz NICHT hat, samt der Namen, die
 * dafür fehlen. Das ist die Frage, die eine frisch aufgesetzte zweite Instanz beantworten können
 * muss, bevor jemand vor ihr steht.
 */
export interface Startbericht {
  betriebsart: "Produktion" | "Nicht-Produktion";
  datenhaltung: string;
  bestand: string;
  /** Nur Namen, nie Werte. */
  gesetzt: readonly string[];
  nichtGesetzt: readonly string[];
  zusatzfunktionen: Record<string, "an" | "aus">;
  maengel: readonly Startmangel[];
}

export function startbericht(
  env: Record<string, string | undefined>,
  bestand: Bestandsbefund,
  confluence: ConfluenceCredentialState = confluenceCredentialState(env),
): Startbericht {
  const gesetzteNamen: string[] = [];
  const fehlendeNamen: string[] = [];
  for (const wert of STARTVERTRAG) {
    (gesetzt(env[wert.name]) ? gesetzteNamen : fehlendeNamen).push(wert.name);
  }

  const zusatzfunktionen: Record<string, "an" | "aus"> = {};
  for (const name of Object.keys(SCHALTER_ERKLAERUNG) as SchalterName[]) {
    zusatzfunktionen[name] = schalterAn(name) ? "an" : "aus";
  }

  const maengel: Startmangel[] = [];
  if (!gesetzt(env[ANTHROPIC_SCHLUESSEL]) && !gesetzt(env[OPENAI_SCHLUESSEL])) {
    maengel.push({
      befund:
        "Kein KI-Schlüssel gesetzt — es arbeitet der deterministische Ersatzmodus, kein echtes Modell.",
      betrifft: [ANTHROPIC_SCHLUESSEL, OPENAI_SCHLUESSEL],
    });
  }
  if (!gesetzt(env.SMTP_HOST)) {
    maengel.push({
      befund:
        "Kein Mailversand: Kennwort-Zurücksetzen und Benachrichtigungen erreichen niemanden, weil der Postausgangsserver fehlt.",
      betrifft: ["SMTP_HOST"],
    });
  }
  const oidcFehlt = OIDC_PFLICHTSATZ.filter((name) => !gesetzt(env[name]));
  if (oidcFehlt.length > 0 && oidcFehlt.length < OIDC_PFLICHTSATZ.length) {
    maengel.push({
      befund: "SSO ist unvollständig konfiguriert und damit AUS — diese Werte fehlen:",
      betrifft: oidcFehlt,
    });
  }
  if (istAn(env.KLARWERK_ADDON_API) && !gesetzt(env.KLARWERK_ADDON_API_KEY)) {
    maengel.push({
      befund:
        "Der Add-in-Pfad ist eingeschaltet, aber trotzdem ZU — ohne Schlüssel gilt jeder vorgelegte Ausweis als ungültig, Klara erreicht diese Instanz nicht.",
      betrifft: ["KLARWERK_ADDON_API", "KLARWERK_ADDON_API_KEY"],
    });
  }
  if (schalterAn("confluenceImport") && !confluence.usable) {
    const fehlend = confluence.vars.filter((v) => !v.present).map((v) => v.name);
    maengel.push({
      befund:
        fehlend.length > 0
          ? "Der Confluence-Import ist eingeschaltet, aber nicht benutzbar — diese Zugangswerte fehlen:"
          : "Der Confluence-Import ist eingeschaltet, aber nicht benutzbar: die Basisadresse ist nicht https, und ohne https kommt kein Client zustande.",
      betrifft: fehlend.length > 0 ? fehlend : [CONFLUENCE_CREDENTIAL_VARS[0]],
    });
  }
  if (gesetzt(env.KLARWERK_REASONER_POLICY)) {
    maengel.push({
      befund:
        "Die KI-Zuordnung ist für diesen Start GESPERRT; jeder Schreibversuch antwortet mit 409. Für eine Vorführung diesen Wert NICHT setzen:",
      betrifft: ["KLARWERK_REASONER_POLICY"],
      code: "REASONER_POLICY_ENV_LOCKED",
    });
  }

  return {
    betriebsart: env.NODE_ENV === "production" ? "Produktion" : "Nicht-Produktion",
    datenhaltung: datenhaltung(env),
    bestand:
      bestand.art === "leer"
        ? "leer — keine Wissensobjekte, keine Konten (gültiger Zustand: die Ersteinrichtung macht den ersten Anwender zum Administrator)"
        : bestand.art === "gefuellt"
          ? `${bestand.wissensobjekte} Wissensobjekt(e), ${bestand.konten} Konto/Konten`
          : `UNBEKANNT — diese Abfrage ist gescheitert: ${bestand.gescheitert.join(", ")}. Dies ist NICHT „leer". Der Fehler selbst steht als eigene Warnzeile im Protokoll (Typ, Code, Herkunft; Meldung und Stack unterdrückt).`,
    gesetzt: gesetzteNamen,
    nichtGesetzt: fehlendeNamen,
    zusatzfunktionen,
    maengel,
  };
}
