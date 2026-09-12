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
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { ka4Freigabe } from "../../services/app/src/routes/ask-routes";
import {
  type KlaraPolicyQuelle,
  KlaraSessionService,
} from "../../services/app/src/services/klara-session-service";
import { InMemoryKlaraSessionRepo } from "../../services/reasoner";

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
  /** Die zentrale Freigabe zur Laufzeit umlegen — wie ein Administrator es täte. */
  setzeFreigabe: (f: boolean | undefined) => void;
  /** Was `ka4Freigabe` protokolliert hat — Entscheidung und Grund, sonst nichts. */
  protokoll: Array<{ entscheidung: string; grund?: string }>;
}

async function aufbauen(start: boolean | undefined): Promise<Aufbau> {
  const quelle: KlaraPolicyQuelle = {
    choice: "cloud",
    source: "db",
    effectiveAnswerProvider: "cloud",
    cloudConfigured: true,
    localConfigured: false,
    providerLabel: "anthropic",
    modelLabel: "claude",
    zentralFreigegeben: start,
  };
  const dienst = new KlaraSessionService({
    repo: new InMemoryKlaraSessionRepo(),
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
    protokoll,
  };
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
