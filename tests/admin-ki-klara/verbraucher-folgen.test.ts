// ================================================================================================
// JOB 3502 · V — KLARA UND DER WORD-WEG FOLGEN DERSELBEN ENTSCHEIDUNG
// ================================================================================================
//
// Z (`zentrale-freigabe.test.ts`) misst den Resolver für sich. Diese Datei misst, dass die BEIDEN
// VERBRAUCHER wirklich an ihm hängen — und dass keiner von ihnen eine eigene, zweite Sperre führt.
//
// DIE BEIDEN WEGE, aus dem Bestand gelesen:
//
//   Klara (Aufgabenfenster)  · `KlaraSessionService.pruefeExterneAusfuehrung` — „das finale Tor vor
//                              einer externen Ausführung" (`klara-session-service.ts`).
//   Word (Ask)               · `ka4Freigabe` (`ask-routes.ts`) ruft GENAU dieses Tor und übernimmt
//                              seine Antwort; die Route entscheidet nichts selbst.
//
// Beide laufen also durch `resolveKlaraPolicy`. Folgt DER der zentralen Freigabe, folgen beide —
// und das ist keine Ableitung, sondern hier gemessen: V1 bis V5 fahren dieselbe Lage einmal über
// den Klara-Weg und einmal über den Word-Weg und erwarten dieselbe Antwort.
//
// ------------------------------------------------------------------------------------------------
// WAS DIESE DATEI NICHT BEWEIST — ausdrücklich, damit Grün nicht mehr behauptet als es trägt
// ------------------------------------------------------------------------------------------------
//
// Die zentrale Freigabe entstammt der Kompositionswurzel (`build-app.ts`, Policyquelle des
// `KlaraSessionService`). Sie lag ausserhalb der Zielpfade von JOB 3502; diese Datei reicht die
// Freigabe deshalb an derselben Stelle herein, an der die Wurzel sie hereinreicht — über die
// Policyquelle des Dienstes. Gemessen ist damit: Dienst und Route TRAGEN sie durch und richten
// sich nach ihr.
//
// NACHGEFÜHRT DURCH JOB 3666. Bis dahin stand hier „NICHT gemessen ist, dass die Produktionswurzel
// sie heute schon liefert; sie tut es nicht" — und das stimmte, drei Tage lang: kein einziger
// Aufrufer setzte das Feld. Seit JOB 3666 setzt es die Wurzel
// (`build-app.ts`: `zentralFreigegeben: config.taskConfig.kiFreigabe?.oeffentlicheKi === true`),
// und DASS sie es tut, misst `wurzel-verdrahtung.test.ts` an der echten Instanz — nicht diese
// Datei. Die Arbeitsteilung bleibt: hier der Durchgriff von Dienst und Route, dort die Wurzel.
//
// WO DAS RECHT DER ROLLE GEPRÜFT WIRD — und warum nicht hier. „Darf DIESE Rolle die Freigabe
// ändern" ist eine Frage der Route und wird seit JOB 3549 dort serverseitig geprüft und auditiert
// (`tests/admin-ki-freigabe/rollen-und-protokoll.test.ts`, R3/R4). Der Klara-Resolver kennt keine
// Rollen und soll keine kennen: eine zweite Rechteprüfung neben der echten wäre genau die zweite
// Wahrheit, die dieser Auftrag beseitigt. Er bekommt das ERGEBNIS der zentralen Entscheidung.
//
// ------------------------------------------------------------------------------------------------
// NACHGEFÜHRT DURCH JOB 3823 — WAS SEITHER HIER GEMESSEN IST, UND WAS WEITER DRAUSSEN BLEIBT
// ------------------------------------------------------------------------------------------------
//
// CODEX HAT ZWEI LÜCKEN IN SEIN GRÜN-URTEIL ZU JOB 3767 GESCHRIEBEN (Prüfpunkt 6). Beide sind
// jetzt geschlossen, und zwar hier, weil beide an den VERBRAUCHERN hängen:
//
//   1. DIE FORM DER LAGE. V5 reicht ein ausdrückliches `undefined` herein — der Schlüssel ist da,
//      er trägt nur nichts. Eine vergessene Kompositionswurzel liefert ein Objekt, in dem der
//      Schlüssel GAR NICHT VORKOMMT. Für `=== true` ist das dasselbe, aber gemessen war es an den
//      Verbrauchern nicht (am Resolver schon: Z6/Z9). V6 misst die echte Auslassung, und der
//      Aufbau `aufbauenVergesseneWurzel` sichert die Form selbst zu.
//   2. DIE ENTWERTUNG DER ZUSTIMMUNG. V4 misst die WIRKUNG eines Widerrufs (nichts geht mehr
//      hinaus) und gibt in seinem eigenen Kommentar zu, den MECHANISMUS nicht zu messen. V7 misst
//      ihn — am `consentState` und an der `policyVersion` der Sitzung, nicht am ausbleibenden
//      Erfolg. V8 misst dieselbe Frage in der Gegenrichtung: eine unter einer vergessenen Wurzel
//      erteilte Zustimmung ist keine Abkürzung in die freigegebene Welt.
//
// WAS AUCH V7 NICHT BEWEIST, gemessen und nicht vermutet: dass die POLICYVERSIONS-HÄLFTE der
// Deckungsprüfung die Entwertung trägt. Sie ist am Verbraucher nicht getrennt beobachtbar — die
// Prüfung vergleicht denselben Übergang zusätzlich am Empfänger. Die Begründung samt Messung steht
// im Fall selbst.
//
// ------------------------------------------------------------------------------------------------
// NACHGEFÜHRT DURCH JOB 3942 — DIE POLICYVERSION WIRD ZUM ERSTEN MAL ALLEIN GEMESSEN
// ------------------------------------------------------------------------------------------------
//
// BENs Urteil zu JOB 3823 liess einen Nachweis offen (Prüfpunkt 6): „ausschliesslich die
// Policyversion abweichen lassen und die übrigen Bindungen konstant halten". Er ist jetzt geführt —
// und er sieht anders aus, als der Auftrag erwartet hat, weil die Messung etwas anderes ergab:
//
//   · AM VERBRAUCHER bleibt die Bindung `policyVersion` (`klara-session-service.ts:323`)
//     UNERREICHBAR, und nicht bloss überdeckt: `laden` entwertet die Zustimmung schon beim
//     `versionsbruch` (`:1101-1116`), bevor die Bindungsliste läuft. V10 liest das am
//     Deckungsbefund des Tores ab (`nicht_erteilt`, LEERE Abweichungsliste) — gemessen, nicht
//     geschlossen. (NACHGELESEN und nicht eigens gemessen: `aufloesen` bindet die Sitzung bei
//     jedem Versionswechsel auf eine neue `resolutionId`, `:459-473`, womit ohnehin schon die
//     erste Bindung abwiche.)
//   · GETRENNT BEOBACHTBAR ist die Zeile deshalb nur an der Prüfung selbst. V9 befragt
//     `pruefeConsentDeckung` unmittelbar, mit ECHTEN Bestandswerten aus diesem Aufbau und genau
//     einer verstellten Bindung, und verlangt die Abweichungsliste `["policyVersion"]`.
//
// V10 misst denselben Wechsel dort, wo ein Mensch ihn merkt: nur die HERKUNFT der Policy wechselt
// (`db` → `env`, beide Kennungen enden auf `:frei`), die Zustimmung verfällt, beide Wege schliessen
// — und nach erneuter Zustimmung öffnen BEIDE wieder. Denselben Rückweg hat BEN auch für V7
// bestellt; dort fehlte bis jetzt der Word-Weg.
//
// DIE BEOBACHTUNGSKANTE der drei neuen Fälle ist `getSession(sessionId, bindung)` — die
// `KlaraSessionView` mit `policyVersion`, `configurationVersion` und `consentState`. Sie ist die
// öffentliche Auskunft des Dienstes über die Sitzung; „die Zustimmung trägt nicht mehr" wird dort
// ABGELESEN und nicht aus einem ausbleibenden Erfolg geschlossen.
//
// WAS AUCH JETZT NICHT HIER STEHT: die echte Kompositionswurzel (`build-app.ts`) — sie misst
// weiterhin `wurzel-verdrahtung.test.ts` an einer laufenden Instanz, und diese Arbeitsteilung ist
// der Grund, warum es zwei Dateien sind. Ebenso draussen bleiben die Resolverebene für sich
// (`zentrale-freigabe.test.ts`, Z6/Z7/Z9/Z10), die OBERFLÄCHE der Freigabe, der zweite Schalter der
// Adminfreigabe (vertrauliche Inhalte) und der echte HTTP-Weg der Ask-Route: hier läuft `ka4Freigabe`
// als Funktion, nicht als Route.
//
// DIE FÄLLE IM ÜBERBLICK. V1 ohne Freigabe · V2 mit Freigabe und Zustimmung · V3 mit Freigabe ohne
// Zustimmung · V4 Widerruf, Wirkung · V5 Feld auf `undefined` · V6 Feld FEHLT ganz, beide Wege zu
// und die Sitzung trägt `…:gesperrt`, ununterscheidbar vom ausdrücklichen NEIN · V7 Widerruf
// ENTWERTET die Zustimmung, gemessen am Sitzungszustand, mit Rückweg über BEIDE Verbraucher · V8
// die nachgetragene Zeile heilt die alte Zustimmung nicht · V9 die Bindung `policyVersion` allein,
// an der Deckungsprüfung selbst · V10 der Herkunftswechsel an beiden Verbrauchern, mit Rückweg.
// S1–S4 binden die Bauform.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { ka4Freigabe } from "../../services/app/src/routes/ask-routes";
import {
  type KlaraPolicyQuelle,
  KlaraSessionService,
  pruefeConsentDeckung,
} from "../../services/app/src/services/klara-session-service";
import {
  InMemoryKlaraSessionRepo,
  type ReasonerPolicySource,
  klaraPolicyVersion,
} from "../../services/reasoner";

const JETZT = Date.parse("2026-09-10T09:00:00.000Z");

// NACHGEFÜHRT DURCH JOB 3767: hier stand ein eigener Typ `QuelleMitFreigabe`, weil
// `KlaraPolicyQuelle` das Feld nicht führte und der Dienst es nur über `...quelle` durchreichte.
// Seit JOB 3767 führt sie es selbst (`klara-session-service.ts`, Lieferung 2) — der Hilfstyp wäre
// jetzt eine Verdopplung, und dass das Feld im echten Vertrag steht, ist gerade der Punkt.

const AKTEUR = "nutzer-1";
const INSTANZ = "inst-1";

interface Aufbau {
  dienst: KlaraSessionService;
  sitzung: string;
  bindung: { actorId: string; addinInstanceId: string; documentContextId: string };
  kopf: Record<string, string>;
  /**
   * JOB 3823 · die Policyquelle selbst, offen für die Fälle.
   *
   * Nicht der WERT der Freigabe wird damit prüfbar — den setzt und liest jeder Fall ohnehin —
   * sondern die FORM der Lage: ob der Schlüssel `zentralFreigegeben` überhaupt vorkommt. Genau
   * darin unterscheidet sich eine vergessene Wurzel von einem ausdrücklichen `undefined`.
   */
  quelle: KlaraPolicyQuelle;
  /**
   * JOB 3942 · die Ablage dieses Aufbaus — für den EINEN Fall, der die Deckungsprüfung direkt
   * befragt (V9).
   *
   * `KlaraConsent` und `KlaraSession` sind Bestandszeilen; keine öffentliche Methode des Dienstes
   * gibt sie heraus (`KlaraSessionView` ist bewusst die Sicht OHNE sie). Wer die Deckungsprüfung
   * mit ECHTEN Werten befragen will statt mit nachgebauten, muss sie deshalb aus der Ablage lesen.
   * Genau das ist der Unterschied zwischen einer isolierten Messung und einer erfundenen Lage.
   */
  repo: InMemoryKlaraSessionRepo;
  /** Die zentrale Freigabe zur Laufzeit umlegen — wie ein Administrator es täte. */
  setzeFreigabe: (f: boolean | undefined) => void;
  /**
   * JOB 3942 · die HERKUNFT der aktiven Policy zur Laufzeit umlegen (`env` | `db` | `default`).
   *
   * Sie ist der einzige Hebel dieser Bühne, der GENAU EINE der zehn Bindungen der Deckungsprüfung
   * bewegt: `source` geht ausschliesslich in `klaraPolicyVersion` ein (`klara-policy.ts:566`, im
   * Kopf der Funktion benannt als „Ändert sich die Admin-Wahl oder die Herkunft der Policy, ändert
   * sich `policyVersion`", `:558`), wird in `resolveKlaraPolicy` an keiner anderen Stelle gelesen
   * (`:541`) und kommt im `Pick` von `klaraConfigurationVersion` nicht vor (`:597-606`). Dass die
   * übrigen Werte dabei wirklich stehen bleiben, wird in V10 gemessen und nicht daraus geschlossen.
   */
  setzeHerkunft: (h: ReasonerPolicySource) => void;
  /** Was `ka4Freigabe` protokolliert hat — Entscheidung und Grund, sonst nichts. */
  protokoll: Array<{ entscheidung: string; grund?: string }>;
}

/**
 * JOB 3823 · L1 — DIE LAGE OHNE DAS EINE FELD.
 *
 * Alles, was ein Betrieb sonst braucht, damit der externe Weg an NICHTS ausser der Freigabe und
 * der Zustimmung scheitert. Der Rückgabetyp lässt `zentralFreigegeben` nicht bloss weg, er hält es
 * heraus: ein hier versehentlich wieder eingesetztes `zentralFreigegeben: undefined` wäre in
 * diesem Objektliteral eine überschüssige Eigenschaft und damit ein Typfehler — kein stiller
 * Bedeutungswechsel, der V6 unbemerkt entwertet.
 */
function grundlage(): Omit<KlaraPolicyQuelle, "zentralFreigegeben"> {
  return {
    choice: "cloud",
    source: "db",
    effectiveAnswerProvider: "cloud",
    cloudConfigured: true,
    localConfigured: false,
    providerLabel: "anthropic",
    modelLabel: "claude",
  };
}

async function ausQuelle(quelle: KlaraPolicyQuelle): Promise<Aufbau> {
  const repo = new InMemoryKlaraSessionRepo();
  const dienst = new KlaraSessionService({
    repo,
    policy: () => quelle,
    now: () => JETZT,
  });
  const sicht = await dienst.createSession(AKTEUR, INSTANZ, {
    kind: "saved",
    hostDocumentId: "doc-abc",
  });
  const protokoll: Array<{ entscheidung: string; grund?: string }> = [];
  return {
    dienst,
    quelle,
    repo,
    sitzung: sicht.sessionId,
    bindung: {
      actorId: AKTEUR,
      addinInstanceId: INSTANZ,
      documentContextId: sicht.documentContextId,
    },
    kopf: {
      "x-klara-session": sicht.sessionId,
      "x-klara-instance": INSTANZ,
      "x-klara-document": sicht.documentContextId,
    },
    setzeFreigabe: (f) => {
      quelle.zentralFreigegeben = f;
    },
    setzeHerkunft: (h) => {
      quelle.source = h;
    },
    protokoll,
  };
}

/** Der Aufbau von V1 bis V5: das Feld IST da und trägt den übergebenen Wert — auch `undefined`. */
async function aufbauen(start: boolean | undefined): Promise<Aufbau> {
  return ausQuelle({ ...grundlage(), zentralFreigegeben: start });
}

/**
 * JOB 3823 · L1 — DER AUFBAU EINER VERGESSENEN WURZEL: das Feld kommt gar nicht vor.
 *
 * WORAN MAN DEN UNTERSCHIED ERKENNT, und warum er hier zugesichert und nicht bloss beabsichtigt
 * wird: `{ …, zentralFreigegeben: undefined }` und `{ … }` sind zur Laufzeit verschiedene Objekte
 * (`"zentralFreigegeben" in quelle` ist einmal `true`, einmal `false`), für einen Vergleich mit
 * `=== true` aber dasselbe. Genau deshalb hat Codex die Messung an der echten Auslassung bestellt:
 * ein späterer Umbau könnte hier still wieder ein `undefined` einsetzen, und V6 bliebe grün, ohne
 * noch zu messen, was sein Name sagt. Die Zusicherung fällt in diesem Fall auf.
 */
async function aufbauenVergesseneWurzel(): Promise<Aufbau> {
  const quelle: KlaraPolicyQuelle = { ...grundlage() };
  expect(
    "zentralFreigegeben" in quelle,
    "die Lage der vergessenen Wurzel trägt den Schlüssel doch",
  ).toBe(false);
  return ausQuelle(quelle);
}

/**
 * Der Klara-Weg: das finale Tor, flach gelesen.
 *
 * `KlaraAusfuehrungsfreigabe` ist eine unterschiedene Vereinigung — im Freigabefall gibt es GAR
 * KEIN Feld `grund`, und das ist die richtige Bauform (es gäbe dort auch nichts zu begründen). Für
 * die Erwartung hier wird sie einmal aufgelöst, statt in jedem Fall einzeln zu verzweigen.
 */
async function klaraWeg(a: Aufbau): Promise<{ erlaubt: boolean; grund: string | null }> {
  const f = await a.dienst.pruefeExterneAusfuehrung(a.sitzung, a.bindung);
  return f.erlaubt ? { erlaubt: true, grund: null } : { erlaubt: false, grund: f.grund };
}

/** Der Word-Weg: dieselbe Entscheidung, wie die Ask-Route sie trifft (`ask-routes.ts`). */
async function wordWeg(a: Aufbau): Promise<boolean> {
  return ka4Freigabe(a.dienst, a.kopf, AKTEUR, {
    info: (obj: unknown) => {
      a.protokoll.push((obj as { ka4: { entscheidung: string; grund?: string } }).ka4);
    },
  });
}

describe("JOB 3502 · V — beide Verbraucher folgen der einen zentralen Freigabe", () => {
  it("V1 · OHNE zentrale Freigabe: Klara gesperrt UND Word gesperrt — trotz erteilter Zustimmung", async () => {
    const a = await aufbauen(false);
    await a.dienst.grantConsent(a.sitzung, a.bindung);

    // Der ADMIN-Grund, nicht der Zustimmungsgrund: der Mensch hat bereits zugestimmt.
    expect(await klaraWeg(a)).toEqual({ erlaubt: false, grund: "policy_incomplete" });

    expect(await wordWeg(a)).toBe(false);
    expect(a.protokoll[0]).toEqual({ entscheidung: "blockiert", grund: "policy_incomplete" });
  });

  it("V2 · MIT Freigabe und Zustimmung: Klara erlaubt UND Word erlaubt", async () => {
    const a = await aufbauen(true);
    await a.dienst.grantConsent(a.sitzung, a.bindung);

    expect(await klaraWeg(a)).toEqual({ erlaubt: true, grund: null });

    expect(await wordWeg(a)).toBe(true);
    expect(a.protokoll[0]).toEqual({ entscheidung: "freigegeben", grund: undefined });
  });

  it("V3 · MIT Freigabe, aber OHNE Zustimmung: beide bleiben zu — die Bestätigung bleibt erhalten", async () => {
    const a = await aufbauen(true);
    // Keine Zustimmung erteilt. Die zentrale Freigabe ERLAUBT, sie überträgt nicht.
    expect((await klaraWeg(a)).erlaubt).toBe(false);
    expect(await wordWeg(a)).toBe(false);
  });

  it("V4 · der Widerruf der Freigabe wirkt SOFORT — auf eine bereits erteilte Zustimmung", async () => {
    // Der eigentliche Wert einer zentralen Entscheidung: sie greift ohne Neustart und ohne dass
    // jemand die Sitzungen einzeln aufräumen müsste.
    //
    // GENAU GESAGT, was dieser Fall misst und was nicht: er misst die WIRKUNG — nach dem Widerruf
    // geht nichts mehr hinaus, über beide Wege. Er misst NICHT den Mechanismus: gemessen (Gegenprobe
    // B) bleibt er auch dann grün, wenn die Freigabe gar nicht in der Policyversion steht, weil dann
    // schon der Resolver sperrt. Dass der Widerruf zusätzlich die erteilte ZUSTIMMUNG entwertet,
    // hängt an der Policyversion — und das pinnt Z7, nicht dieser Fall.
    const a = await aufbauen(true);
    await a.dienst.grantConsent(a.sitzung, a.bindung);
    expect((await a.dienst.pruefeExterneAusfuehrung(a.sitzung, a.bindung)).erlaubt).toBe(true);

    a.setzeFreigabe(false);
    const nachher = await a.dienst.pruefeExterneAusfuehrung(a.sitzung, a.bindung);
    expect(nachher.erlaubt).toBe(false);
    expect(await wordWeg(a)).toBe(false);
  });

  it("V5 · FEHLT das Feld, bleiben beide Wege zu — wie bei einem ausdrücklichen NEIN", async () => {
    // ============================================================================================
    // UMGEKEHRT DURCH JOB 3767. Der alte Vertrag dieses Falls ist abgelöst.
    // ============================================================================================
    //
    // ER LAUTETE: „FEHLT das Feld, verhalten sich beide Wege wie heute", also durchlässig — die
    // Einspiel-Schonung von JOB 3502, damit ein Auftrag ohne gelegte Verdrahtung den Betrieb nicht
    // still abschaltete. Seit JOB 3666 liegt die Verdrahtung, und JOB 3767 hat die Lesart auf
    // `=== true` verschärft: ein Aufrufer, der das Feld nicht reicht, ist eine VERGESSENE WURZEL
    // und die sperrt.
    //
    // Gemessen an BEIDEN Verbrauchern, nicht am Resolver allein — das ist die Aufgabe dieser Datei.
    // Und mit erteilter Zustimmung, damit sichtbar ist, dass hier der ADMIN-Grund sperrt und nicht
    // die fehlende Bestätigung des Menschen.
    const a = await aufbauen(undefined);
    await a.dienst.grantConsent(a.sitzung, a.bindung);
    expect(await klaraWeg(a)).toEqual({ erlaubt: false, grund: "policy_incomplete" });
    expect(await wordWeg(a)).toBe(false);
    expect(a.protokoll[0]).toEqual({ entscheidung: "blockiert", grund: "policy_incomplete" });

    // DIE KALIBRIERUNG: derselbe Aufbau, nur das Feld auf `true` gelegt, läuft — sonst wäre dieser
    // Fall auch dann grün, wenn die Umstellung den externen Weg vollständig zugemauert hätte.
    // Die Zustimmung von oben trägt dabei NICHT: sie wurde unter der Policyversion `…:gesperrt`
    // erteilt, und der Wechsel entwertet sie (Z7) — der Klara-Weg meldet das als
    // `CONSENT_RECONFIRMATION_REQUIRED`, also die Deckungsprüfung, nicht mehr die Adminsperre.
    // Deshalb wird erneut zugestimmt, genau den Weg, den auch ein Mensch ginge.
    a.setzeFreigabe(true);
    expect(await klaraWeg(a)).toEqual({
      erlaubt: false,
      grund: "CONSENT_RECONFIRMATION_REQUIRED",
    });
    await a.dienst.grantConsent(a.sitzung, a.bindung);
    expect(await klaraWeg(a)).toEqual({ erlaubt: true, grund: null });
  });

  it("V6 · FEHLT der Schlüssel ganz, sperren beide Verbraucher — und die Sitzung trägt `…:gesperrt`", async () => {
    // ============================================================================================
    // JOB 3823 · DIE ECHTE AUSLASSUNG, an den Verbrauchern gemessen.
    // ============================================================================================
    //
    // WORIN SICH DIESER FALL VON V5 UNTERSCHEIDET: V5 reicht `zentralFreigegeben: undefined`
    // herein — der Schlüssel steht im Objekt. Eine Kompositionswurzel, die die Zeile aus
    // `build-app.ts` vergisst, baut ein Objekt OHNE den Schlüssel. Heute ist beides für
    // `input.zentralFreigegeben === true` (`klara-policy.ts`) derselbe Fall; gemessen war es an den
    // Verbrauchern nicht, und Codex hat genau diese Messung bestellt (JOB 3767, Prüfpunkt 6).
    //
    // WORIN ER SICH VON Z9 UNTERSCHEIDET: Z9 misst den Resolver für sich
    // (`resolveKlaraPolicy(lage(…))`). Hier laufen der Klara-Weg, der Word-Weg und die Auskunft
    // des Sitzungsdienstes — die Stationen, an denen ein Mensch die Wirkung hätte.
    const a = await aufbauenVergesseneWurzel();
    // Mit erteilter Zustimmung, damit sichtbar ist, dass der ADMIN-Grund sperrt und nicht die
    // fehlende Bestätigung des Menschen.
    await a.dienst.grantConsent(a.sitzung, a.bindung);

    expect(await klaraWeg(a)).toEqual({ erlaubt: false, grund: "policy_incomplete" });
    expect(await wordWeg(a)).toBe(false);
    expect(a.protokoll[0]).toEqual({ entscheidung: "blockiert", grund: "policy_incomplete" });

    // DIE VERSIONSKENNUNG AN DER SITZUNG, nicht am Resolver: was der Dienst über diese Sitzung
    // nach aussen sagt, verschweigt die Sperre nicht.
    const vergessen = await a.dienst.getSession(a.sitzung, a.bindung);
    expect(vergessen.policyVersion.endsWith(":gesperrt")).toBe(true);

    // UND SIE IST UNUNTERSCHEIDBAR VOM AUSDRÜCKLICHEN NEIN — Zeichen für Zeichen. Das ist die
    // Aussage von Z6/Z9 auf der Resolverebene, hier an der Sitzung: es gibt keine zweite
    // Sperrstufe für die vergessene Wurzel, keine eigene Kennung, keine eigene Meldung.
    const nein = await aufbauen(false);
    await nein.dienst.grantConsent(nein.sitzung, nein.bindung);
    const ausdruecklich = await nein.dienst.getSession(nein.sitzung, nein.bindung);
    expect(vergessen.policyVersion).toBe(ausdruecklich.policyVersion);
    expect(await klaraWeg(nein)).toEqual({ erlaubt: false, grund: "policy_incomplete" });
  });

  it("V7 · der Widerruf ENTWERTET die Zustimmung — der Mechanismus, an den Verbrauchern", async () => {
    // ============================================================================================
    // JOB 3823 · DER FALL, DESSEN FEHLEN V4 OBEN SELBST ZUGIBT.
    // ============================================================================================
    //
    // V4 misst die WIRKUNG: nach dem Widerruf geht nichts mehr hinaus. Das bliebe auch dann grün,
    // wenn die Freigabe gar nicht in der Policyversion stünde — dann sperrte schon der Resolver.
    // Hier wird der MECHANISMUS gemessen: dass der Widerruf die bereits erteilte Zustimmung
    // ENTWERTET. Abgelesen wird er am `consentState` und an der `policyVersion` der
    // `KlaraSessionView`, nicht aus einem ausbleibenden Erfolg geschlossen.
    //
    // GEGENPROBE, die diesen Fall von V4 trennt (JOB 3823 §6 b): nimmt man das Freigabesegment aus
    // `klaraPolicyVersion` (`return basis;`), bleibt V4 grün und dieser Fall wird rot.
    const a = await aufbauen(true);
    await a.dienst.grantConsent(a.sitzung, a.bindung);
    expect(await klaraWeg(a)).toEqual({ erlaubt: true, grund: null });
    expect(await wordWeg(a)).toBe(true);
    expect(a.protokoll[0]).toEqual({ entscheidung: "freigegeben", grund: undefined });

    const vorher = await a.dienst.getSession(a.sitzung, a.bindung);
    expect(vorher.consentState).toBe("granted");

    a.setzeFreigabe(false);

    // DIE ENTWERTUNG, abgelesen und nicht geschlossen: `consentState` ist der Wert, den die
    // Deckungsprüfung wirklich schreibt (`klara-session-service.ts`, `invalidateSession` mit
    // `consentState: "invalidated"`) — nachgelesen im Produkt, nicht geraten.
    const nachher = await a.dienst.getSession(a.sitzung, a.bindung);
    expect(nachher.consentState).toBe("invalidated");

    // GENAU GESAGT, WAS DIESE EINE ZEILE TRÄGT UND WAS NICHT — selbst gemessen, nicht abgeleitet.
    //
    // Sie ist ÜBERBESTIMMT. Nimmt man BEIDE Policyversions-Vergleiche aus der Entwertung heraus
    // (`klara-session-service.ts`: die Hälfte in `laden` UND die Bindung `policyVersion` in
    // `pruefeConsentDeckung`), bleibt diese Zeile grün — gemessen, alle 25 Fälle der Gruppe grün.
    // Der Grund steht in derselben Prüfung: sie vergleicht auch den EMPFÄNGER (Bindung `provider`),
    // und der wechselt bei gesperrter Auflösung ohnehin auf den deterministischen Ersatzwert.
    //
    // BERICHTIGT DURCH JOB 3942 — hier stand bis dahin: „Am Verbraucher ist die
    // Policyversions-Hälfte der Deckungsprüfung damit nicht getrennt beobachtbar; wer sie einzeln
    // pinnen will, muss das an der Prüfung selbst tun, nicht hier." Der erste Halbsatz gilt
    // weiterhin und ist in V10 nachgemessen (dort steht, WAS am Verbraucher die Entwertung
    // wirklich trägt: der Versionsbruch in `laden`, nicht die Bindungsliste). Der zweite Halbsatz
    // ist eingelöst, und zwar in DIESER Datei: V9 befragt `pruefeConsentDeckung` unmittelbar, mit
    // echten Bestandswerten und genau einer verstellten Bindung. Seither ist die Zeile
    // `klara-session-service.ts:323` einzeln gepinnt — sie zu entfernen rötet V9 und sonst nichts.
    //
    // WAS DIESER FALL DAGEGEN WIRKLICH BINDET, sind die drei Zeilen darunter: dass die SITZUNG
    // ihre Grundlage als gewechselt ausweist und die Kennung das Freigabesegment führt. Sie werden
    // rot, wenn das Segment aus `klaraPolicyVersion` verschwindet (Gegenprobe b) — und genau dann
    // bleibt V4 grün. Das ist die Blindheit, die V4 im eigenen Kommentar zugibt.
    expect(nachher.policyVersion).not.toBe(vorher.policyVersion);
    expect(vorher.policyVersion.endsWith(":frei")).toBe(true);
    expect(nachher.policyVersion.endsWith(":gesperrt")).toBe(true);

    // Und der Klara-Weg nennt danach den DECKUNGSGRUND, nicht bloss „gesperrt": die Zustimmung ist
    // weg, nicht übergangen.
    expect(await klaraWeg(a)).toEqual({
      erlaubt: false,
      grund: "CONSENT_RECONFIRMATION_REQUIRED",
    });
    expect(await wordWeg(a)).toBe(false);
    expect(a.protokoll[1]).toEqual({
      entscheidung: "blockiert",
      grund: "CONSENT_RECONFIRMATION_REQUIRED",
    });

    // DIE GEGENRICHTUNG, ohne die dieser Fall auch an einem vollständig zugemauerten Produkt grün
    // wäre: nach Wiederfreigabe und ERNEUTER Zustimmung läuft derselbe Weg wieder.
    a.setzeFreigabe(true);
    await a.dienst.grantConsent(a.sitzung, a.bindung);
    expect(await klaraWeg(a)).toEqual({ erlaubt: true, grund: null });
    // ERGÄNZT DURCH JOB 3942 (BEN zu 3823, Prüfpunkt 6, wörtlich: „Zusätzlich den erfolgreichen
    // Word-Rückweg nach erneuter Zustimmung ergänzen"). Bis hierher endete die Gegenrichtung am
    // Klara-Weg — für den ZWEITEN Verbraucher blieb offen, ob er nach der erneuten Zustimmung
    // wirklich wieder hinausgeht. Er wird jetzt GEZÄHLT, in derselben Bauform wie `:356` und
    // `:394`: eine Erfolgsmeldung im Protokoll, nicht ein ausbleibender Misserfolg.
    expect(await wordWeg(a)).toBe(true);
    expect(a.protokoll[2]).toEqual({ entscheidung: "freigegeben", grund: undefined });
    expect((await a.dienst.getSession(a.sitzung, a.bindung)).consentState).toBe("granted");
  });

  it("V8 · die nachgetragene Zeile heilt die alte Zustimmung nicht — die vergessene Wurzel ist keine Abkürzung", async () => {
    // ============================================================================================
    // JOB 3823 · „DIE VERGESSENE ZEILE WIRD NACHGETRAGEN".
    // ============================================================================================
    //
    // Die Zustimmung entsteht unter einer Sitzung, deren Policyversion `…:gesperrt` trägt. Trüge
    // sie anschliessend in die freigegebene Welt hinüber, wäre die vergessene Wurzel eine
    // Abkürzung: der Mensch hätte einem Weg zugestimmt, den es damals gar nicht gab.
    //
    // NICHT DASSELBE WIE DIE V5-KALIBRIERUNG: die geht denselben Weg mit einem ausdrücklichen
    // `undefined` und misst den GRUND am Klara-Weg. Hier fehlt der Schlüssel wirklich, und
    // gemessen wird zusätzlich der Sitzungszustand — dass die alte Zustimmung nicht bloss
    // übergangen, sondern ENTWERTET ist.
    const a = await aufbauenVergesseneWurzel();
    await a.dienst.grantConsent(a.sitzung, a.bindung);
    const unterVergessen = await a.dienst.getSession(a.sitzung, a.bindung);
    expect(unterVergessen.consentState).toBe("granted");

    // Jemand trägt die Zeile nach — ab hier steht der Schlüssel im Objekt.
    a.setzeFreigabe(true);
    expect("zentralFreigegeben" in a.quelle).toBe(true);

    // Erst die Entwertung, dann die Kennungen — und dieselbe Einschränkung wie in V7 gilt auch
    // hier: die `consentState`-Zeile allein ist überbestimmt, die beiden Kennungszeilen sind es,
    // die das Freigabesegment binden.
    const nachgetragen = await a.dienst.getSession(a.sitzung, a.bindung);
    expect(nachgetragen.consentState).toBe("invalidated");
    expect(unterVergessen.policyVersion.endsWith(":gesperrt")).toBe(true);
    expect(nachgetragen.policyVersion.endsWith(":frei")).toBe(true);
    expect(await klaraWeg(a)).toEqual({
      erlaubt: false,
      grund: "CONSENT_RECONFIRMATION_REQUIRED",
    });
    expect(await wordWeg(a)).toBe(false);
    expect(a.protokoll[0]).toEqual({
      entscheidung: "blockiert",
      grund: "CONSENT_RECONFIRMATION_REQUIRED",
    });

    // Es braucht eine NEUE Zustimmung — und mit ihr läuft der Weg. Ohne diesen Teil wäre der Fall
    // auch dann grün, wenn die Reparatur überhaupt nichts mehr freischaltete.
    await a.dienst.grantConsent(a.sitzung, a.bindung);
    expect(await klaraWeg(a)).toEqual({ erlaubt: true, grund: null });
  });

  it("V9 · die Bindung `policyVersion` ALLEIN — eine einzige abweichende Bindung, und die Deckung fällt", async () => {
    // ============================================================================================
    // JOB 3942 · DER ISOLIERTE NACHWEIS, den BEN zu JOB 3823 bestellt hat (Prüfpunkt 6, wörtlich:
    // „ausschliesslich die Policyversion abweichen lassen und die übrigen Bindungen konstant
    // halten"; Promptverbesserung: „Unterscheide Zustandsentwertung, Versionswechsel und isolierte
    // Kausalität eines Vergleichs").
    // ============================================================================================
    //
    // WARUM DIESER EINE FALL DIE PRÜFUNG DIREKT BEFRAGT und nicht über die beiden Verbraucher
    // läuft: über einen Verbraucher ist die Zeile `klara-session-service.ts:323` GAR NICHT
    // erreichbar, wenn sich die Policyversion ändert. Vor der Bindungsliste liegen zwei Stellen,
    // die denselben Wechsel schon abfangen:
    //   1. `laden` (`:1101-1116`) entwertet die Zustimmung bei `versionsbruch`, BEVOR
    //      `pruefeConsentDeckung` sie je zu sehen bekommt — danach lautet der Deckungsgrund
    //      `nicht_erteilt` mit LEERER Abweichungsliste. DAS IST GEMESSEN: V10 liest genau diesen
    //      Befund am Tor ab.
    //   2. `aufloesen` (`:459-473`) bindet die Sitzung bei jedem Versionswechsel kontrolliert auf
    //      eine NEUE `resolutionId` — damit wiche ohnehin auch die erste Bindung ab (`:322`). Das
    //      ist im Produkt NACHGELESEN und hier nicht eigens gemessen; für die Begründung dieses
    //      Falls trägt schon Punkt 1.
    // Beides ist richtig so und wird hier nicht angetastet. Es heisst nur: der Vergleich `:323`
    // ist am Verbraucher überdeckt, und wer ihn einzeln pinnen will, muss die Prüfung selbst
    // fragen. `pruefeConsentDeckung` ist dafür gebaut — eine exportierte, reine Funktion.
    //
    // ES WIRD NICHTS NACHGEBAUT. Zustimmung und Sitzung kommen aus der Ablage dieses Aufbaus, die
    // Auflösung aus der Sicht des Dienstes; verstellt wird GENAU EIN Feld. Eine handgeschriebene
    // `KlaraConsent` wäre eine erfundene Lage und könnte an neun Bindungen still vorbeilaufen.
    const a = await aufbauen(true);
    await a.dienst.grantConsent(a.sitzung, a.bindung);
    const sicht = await a.dienst.getSession(a.sitzung, a.bindung);
    expect(sicht.consentState).toBe("granted");

    const sitzung = await a.repo.findSession(a.sitzung);
    const zustimmung = await a.repo.findConsent(a.sitzung);
    if (!sitzung || !zustimmung) {
      throw new Error("Bestand unvollständig: Sitzung oder Zustimmung fehlt");
    }

    // DIE KALIBRIERUNG: unverstellt DECKT die Zustimmung. Ohne sie wäre die Zeile darunter auch
    // dann grün, wenn die Prüfung aus einem ganz anderen Grund nie deckte.
    expect(pruefeConsentDeckung(zustimmung, sitzung, sicht.resolution, JETZT)).toEqual({
      gedeckt: true,
      consentId: zustimmung.consentId,
    });

    // DIE EINE VERSTELLUNG. Der Sollwert ist nicht erfunden, sondern von derselben Funktion
    // gebildet, die ihn im Betrieb bildet — nur mit der anderen HERKUNFT (`env` statt `db`). Beide
    // Kennungen enden auf `:frei`: damit ist ausgeschlossen, dass in Wahrheit wieder das
    // Freigabesegment wirkt (das ist der Wechsel, den V7 und V8 schon messen).
    const andereHerkunft = klaraPolicyVersion({
      ...grundlage(),
      source: "env",
      zentralFreigegeben: true,
    });
    expect(sicht.policyVersion).toBe("policy:db:cloud:frei");
    expect(andereHerkunft).toBe("policy:env:cloud:frei");

    // GENAU EINE BINDUNG WEICHT AB — und die Prüfung nennt sie beim Namen. Die Abweichungsliste ist
    // hier die eigentliche Zusicherung: stünde ein zweiter Name darin, wäre der Nachweis nicht
    // isoliert. Entfernt man `klara-session-service.ts:323`, meldet diese Zeile `gedeckt: true`.
    expect(
      pruefeConsentDeckung(
        zustimmung,
        sitzung,
        { ...sicht.resolution, policyVersion: andereHerkunft },
        JETZT,
      ),
    ).toEqual({
      gedeckt: false,
      grund: "bindung_abweichend",
      abweichungen: ["policyVersion"],
    });
  });

  it("V10 · nur die HERKUNFT der Policy wechselt: beide Wege zu — und nach erneuter Zustimmung beide wieder offen", async () => {
    // ============================================================================================
    // JOB 3942 · DERSELBE WECHSEL AN DEN BEIDEN VERBRAUCHERN — und die Messung, WAS ihn dort trägt.
    // ============================================================================================
    //
    // Jeder bisherige Fall verstellt die Policyversion über die zentrale Freigabe. Die sperrt
    // zugleich die Auflösung, wodurch auch der EMPFÄNGER auf den deterministischen Ersatzwert
    // fällt — es weichen also immer mehrere Grundlagen zugleich ab. Hier wechselt ausschliesslich
    // die HERKUNFT der aktiven Policy (`db` → `env`), also genau die Achse, die nur in die
    // Policyversion eingeht. Für den Menschen ist das der Administrator, der die Grundlage seiner
    // Zustimmung austauscht: sein „Ja" darf das nicht überleben.
    const a = await aufbauen(true);
    await a.dienst.grantConsent(a.sitzung, a.bindung);
    expect(await klaraWeg(a)).toEqual({ erlaubt: true, grund: null });
    expect(await wordWeg(a)).toBe(true);
    expect(a.protokoll[0]).toEqual({ entscheidung: "freigegeben", grund: undefined });

    const vorher = await a.dienst.getSession(a.sitzung, a.bindung);
    expect(vorher.consentState).toBe("granted");
    expect(vorher.policyVersion).toBe("policy:db:cloud:frei");

    // DIE ISOLATION WIRD GEMESSEN, NICHT BEHAUPTET — und zwar an zwei Sitzungen OHNE Zustimmung.
    // An der Sitzung von oben ginge es nicht: sobald die Zustimmung fällt, meldet die Sicht die
    // Auflösung OHNE Zustimmung, und deren `provider`/`model` sind per Bauform die
    // deterministischen Ersatzwerte („angezeigt wird, was rechnet"). Ein Vorher/Nachher an DIESEN
    // Feldern würde die Wirkung der Entwertung messen und nicht die Ursache. Zustimmungsfrei sind
    // beide Sitzungen dagegen in genau demselben Zustand und unterscheiden sich nur in `source`.
    const db = await aufbauen(true);
    const env = await ausQuelle({ ...grundlage(), source: "env", zentralFreigegeben: true });
    const sDb = await db.dienst.getSession(db.sitzung, db.bindung);
    const sEnv = await env.dienst.getSession(env.sitzung, env.bindung);
    expect(sDb.policyVersion).toBe("policy:db:cloud:frei");
    expect(sEnv.policyVersion).toBe("policy:env:cloud:frei");
    // Alles andere, was die Sicht über die Grundlage führt, bleibt Zeichen für Zeichen gleich.
    // (`resolutionId`, `sessionId` und die Zeitfelder gehören NICHT dazu: sie sind je Sitzung
    // eigen und würden sich auch bei völlig gleicher Lage unterscheiden.)
    expect(sEnv.configurationVersion).toBe(sDb.configurationVersion);
    expect(sEnv.consentState).toBe(sDb.consentState);
    expect(sEnv.resolution.provider).toBe(sDb.resolution.provider);
    expect(sEnv.resolution.model).toBe(sDb.resolution.model);
    expect(sEnv.resolution.effectiveMode).toBe(sDb.resolution.effectiveMode);
    expect(sEnv.resolution.adminConfiguredMode).toBe(sDb.resolution.adminConfiguredMode);
    expect(sEnv.resolution.blockedReason).toBe(sDb.resolution.blockedReason);
    expect(sEnv.resolution.executionAllowed).toBe(sDb.resolution.executionAllowed);
    expect(sEnv.resolution.externalConsentProvider).toBe(sDb.resolution.externalConsentProvider);
    expect(sEnv.resolution.effectivePayloadClasses).toEqual(sDb.resolution.effectivePayloadClasses);

    // DER WECHSEL — sonst nichts. Keine Freigabe wird angefasst, keine Wahl, kein Label.
    a.setzeHerkunft("env");

    const nachher = await a.dienst.getSession(a.sitzung, a.bindung);
    expect(nachher.policyVersion).toBe("policy:env:cloud:frei");
    expect(nachher.configurationVersion).toBe(vorher.configurationVersion);
    // Die Entwertung, abgelesen und nicht aus einem ausbleibenden Erfolg geschlossen.
    expect(nachher.consentState).toBe("invalidated");

    expect(await klaraWeg(a)).toEqual({
      erlaubt: false,
      grund: "CONSENT_RECONFIRMATION_REQUIRED",
    });
    expect(await wordWeg(a)).toBe(false);
    expect(a.protokoll[1]).toEqual({
      entscheidung: "blockiert",
      grund: "CONSENT_RECONFIRMATION_REQUIRED",
    });

    // WELCHE STELLE DIE ENTWERTUNG WIRKLICH TRÄGT — gemessen am Deckungsbefund, den das Tor selbst
    // herausgibt (`KlaraAusfuehrungsfreigabe.deckung`). Er lautet `nicht_erteilt` mit LEERER
    // Abweichungsliste: die Zustimmung war schon entwertet, als die Bindungsliste lief — durch den
    // `versionsbruch` in `laden` (`klara-session-service.ts:1101-1116`). Die Bindung
    // `policyVersion` (`:323`) kommt auf diesem Weg also gar nicht zum Zug; ihren isolierten
    // Nachweis führt V9. Stünde hier `bindung_abweichend`, hätte jemand die vordere Entwertung
    // entfernt — dann ist die Zusicherung dieses Falls zu prüfen, nicht diese Zeile anzupassen.
    const freigabe = await a.dienst.pruefeExterneAusfuehrung(a.sitzung, a.bindung);
    if (freigabe.erlaubt) {
      throw new Error("das Tor hat nach dem Herkunftswechsel freigegeben");
    }
    expect(freigabe.deckung).toEqual({
      gedeckt: false,
      grund: "nicht_erteilt",
      abweichungen: [],
    });

    // DIE GEGENRICHTUNG MIT BEIDEN VERBRAUCHERN: ohne sie wäre dieser Fall auch an einem
    // vollständig zugemauerten Produkt grün. Zurück auf die alte Herkunft, erneut zugestimmt —
    // und die Sitzung trägt wieder Zeichen für Zeichen dieselbe Kennung wie am Anfang.
    a.setzeHerkunft("db");
    await a.dienst.grantConsent(a.sitzung, a.bindung);
    expect(await klaraWeg(a)).toEqual({ erlaubt: true, grund: null });
    expect(await wordWeg(a)).toBe(true);
    expect(a.protokoll[2]).toEqual({ entscheidung: "freigegeben", grund: undefined });
    const zurueck = await a.dienst.getSession(a.sitzung, a.bindung);
    expect(zurueck.consentState).toBe("granted");
    expect(zurueck.policyVersion).toBe("policy:db:cloud:frei");
  });
});

// ------------------------------------------------------------------------------------------------
// S · KEINE ZWEITE SPERRE — als Struktur, nicht als Vorsatz
// ------------------------------------------------------------------------------------------------
//
// Die Fälle oben messen das Verhalten von heute. Sie könnten morgen weiter grün sein, während
// jemand daneben eine zweite Entscheidungsstelle einzieht — genau der Fehler, den dieser Auftrag
// beseitigt. Die Fälle hier binden deshalb die BAUFORM.
const WURZEL = process.cwd();
const lies = (p: string): string => readFileSync(resolve(WURZEL, p), "utf8");

const POLICY = lies("services/reasoner/src/klara-policy.ts");
const STORE = lies("services/reasoner/src/klara-policy-store.ts");
const DIENST = lies("services/app/src/services/klara-session-service.ts");
const ASK = lies("services/app/src/routes/ask-routes.ts");

/** Nur der Code — Zeilenkommentare und Blockkommentarzeilen zählen nicht als Bauform. */
function ohneKommentar(quelle: string): string {
  return quelle
    .split("\n")
    .filter((z) => !z.trimStart().startsWith("//") && !z.trimStart().startsWith("*"))
    .join("\n");
}

describe("JOB 3502 · S — die Entscheidung fällt an genau einer Stelle", () => {
  it("S1 · der Sperrentscheid steht nur im Resolver — der Sitzungsspeicher kennt ihn gar nicht", () => {
    // `klara-policy.ts`: GENAU EINE Stelle, die `blockedReason` belegt (die Deklaration plus die
    // Kaskade). Wer eine zweite Kaskade danebenstellt, wird hier rot.
    const belegt = ohneKommentar(POLICY).match(/blockedReason\s*=[^=]/g) ?? [];
    expect(belegt.length, "eine zweite Sperrkaskade im Resolver").toBe(3);
    // `klara-policy-store.ts` ist Sitzung und Zustimmung — Persistenz, kein Urteil. Er darf über
    // die KI-Freigabe NICHTS wissen und nichts sperren.
    for (const wort of ["blockedReason", "executionAllowed", "zentralFreigegeben"]) {
      expect(STORE, `der Sitzungsspeicher entscheidet mit: ${wort}`).not.toContain(wort);
    }
  });

  it("S2 · der Klara-Weg liest die Erlaubnis, er rechnet sie nicht", () => {
    const code = ohneKommentar(DIENST);
    // Nirgends wird `executionAllowed` im Dienst BELEGT — er liest sie aus der Auflösung.
    expect(code.match(/executionAllowed\s*=[^=]/g) ?? []).toEqual([]);
    expect(code).toContain("resolution.executionAllowed");
    expect(code).toContain("resolveKlaraPolicy(");
  });

  it("S3 · der Word-Weg übernimmt die Antwort des Tores, statt selbst aufzulösen", () => {
    const code = ohneKommentar(ASK);
    // Die Route löst KEINE Policy auf — sonst gäbe es zwei Auflösungen für dieselbe Frage.
    expect(code).not.toContain("resolveKlaraPolicy");
    // Sie fragt das eine Tor und übernimmt dessen Antwort unverändert.
    expect(code).toContain("pruefeExterneAusfuehrung(");
    expect(code).toContain("freigabe?.erlaubt === true");
  });

  it("S4 · der Resolver liest EIN Urteil, er baut die Adminfreigabe nicht nach", () => {
    // Die Adminfreigabe hat zwei Schalter (`ReasonerKiFreigabe`, `services/reasoner/src/types.ts`).
    // Der Klara-Resolver darf sie NICHT nachbauen: den zweiten Schalter (vertrauliche Inhalte)
    // kann er nicht beantworten, weil er die Einstufung eines Inhalts nirgends erfährt. Er bekommt
    // das Ergebnis, nicht die Struktur — gemessen daran, dass genau ein Feld hereinkommt und es ein
    // `boolean` ist.
    const code = ohneKommentar(POLICY);
    expect((code.match(/zentralFreigegeben\??:\s*boolean/g) ?? []).length).toBe(1);
    // Und es wird an genau einer Stelle ausgewertet — plus einmal in der Policyversion (Z7).
    //
    // NACHGEFÜHRT DURCH JOB 3767: hier stand 3. Die dritte Lesung war der Sonderzweig
    // `if (input.zentralFreigegeben === undefined) return basis;` in `klaraPolicyVersion` — die
    // Einspiel-Schonung von JOB 3502, die ein fehlendes Feld auf die alte Version abbildete. Sie
    // ist ersatzlos entfallen (`=== true ? "frei" : "gesperrt"`), nicht verschoben: zwei Lesungen
    // sind ab jetzt die vollständige Auswertung. Steigt die Zahl wieder, steht irgendwo eine
    // dritte Meinung über dasselbe Feld.
    expect((code.match(/input\.zentralFreigegeben/g) ?? []).length).toBe(2);
    // Die Schalternamen der Adminfreigabe kommen im Resolver nicht vor. Sie werden hier bewusst
    // NICHT als Literal genannt (das wäre derselbe Fehler eine Ebene höher, s. JOB 3550 F2),
    // sondern aus dem echten Vertrag gelesen: was `types.ts` führt, darf `klara-policy.ts` nicht
    // wiederholen.
    const vertrag = lies("services/reasoner/src/types.ts");
    const schalter = [...vertrag.matchAll(/interface ReasonerKiFreigabe \{([^}]*)\}/g)]
      .flatMap((t) => [...(t[1] ?? "").matchAll(/^\s*(\w+)\?:/gm)])
      .map((t) => t[1] as string);
    // KALIBRIERUNG: der Vertrag hat wirklich zwei Schalter — sonst prüfte die Zeile darunter nichts.
    expect(schalter.length).toBe(2);
    for (const name of schalter) {
      expect(code, `der Resolver baut die Adminfreigabe nach: ${name}`).not.toContain(name);
    }
  });
});
