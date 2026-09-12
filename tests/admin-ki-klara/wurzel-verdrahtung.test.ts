// ================================================================================================
// JOB 3666 · W — DIE KOMPOSITIONSWURZEL REICHT DIE ZENTRALE FREIGABE WIRKLICH HEREIN
// ================================================================================================
//
// WAS HIER FEHLTE UND WARUM ES GEFÄHRLICH WAR. JOB 3502 hat den Resolver auf die zentrale
// Adminfreigabe eingerichtet (`zentralFreigegeben`) und beide Verbraucher daran gemessen
// (`verbraucher-folgen.test.ts`). Die VERDRAHTUNG lag ausserhalb seiner Zielpfade und blieb liegen:
// im ganzen Produkt setzte keine einzige Stelle das Feld. Der Resolver las die Freigabe damals mit
// `input.zentralFreigegeben !== false` — bei einem nie gesetzten Feld ist das `undefined !== false`
// und damit WAHR. Klara und der Word-Weg verhielten sich also so, als wäre die öffentliche KI
// zentral freigegeben, während der Kern (`service.ts`, `oeffentlicheKiErlaubt`) seit JOB 3549
// umgekehrt entscheidet: „nur `true` zählt". Zwei Wege, eine Regel, zwei Antworten.
//
// SEIT JOB 3767 LIEST AUCH DER RESOLVER `=== true` (`klara-policy.ts`), ein fehlendes Feld heisst
// dort gesperrt. Diese Datei behält trotzdem ihren eigenen Gegenstand: sie misst nicht die LESART,
// sondern dass die echte Wurzel das Feld tatsächlich und richtig belegt. Beides braucht es —
// fail-closed schützt vor der vergessenen Wurzel, diese Datei vor der falsch belegten.
//
// WAS DIESE DATEI MISST, UND ZWAR AN DER ECHTEN WURZEL. `verbraucher-folgen.test.ts` reicht die
// Freigabe selbst herein — es misst den Dienst, nicht die Wurzel, und sagt das im Kopf ausdrücklich.
// Hier läuft `buildServices()` + `buildApp()` ungemockt, mit echter Anmeldung, echter Klara-Sitzung
// und echter Zustimmung über HTTP. Eingesetzt ist NUR der Modelltransport — als Spion, damit „kein
// Egress" gezählt und nicht abgeleitet wird.
//
// DER DIREKTE NACHWEIS, DASS DAS FELD RICHTIG GESETZT IST, hängt nicht an einer Ableitung:
// `policyVersion` trägt seit JOB 3502 ein Segment `:frei`/`:gesperrt` (`klaraPolicyVersion`).
//
// NACHGEFÜHRT DURCH JOB 3767: hier stand, ein FEHLENDES Feld trüge gar kein Segment, und die blosse
// ANWESENHEIT des Segments sei damit der Nachweis der Verdrahtung. Das gilt nicht mehr — ein
// fehlendes Feld ergibt jetzt ebenfalls `:gesperrt`. Es bleibt der stärkere Nachweis, und der ist
// es, der die Fälle unten trägt: W2 verlangt `:frei`, und `:frei` kann NUR aus einem hereinge-
// reichten `true` entstehen. W3 misst dazu den Wechsel an EINER laufenden Instanz — beides zusammen
// unterscheidet „verdrahtet" von „zufällig gleich", ohne sich auf das leere Segment zu stützen.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { draftProvenance } from "../../apps/web/src/lib/reasonerProvenance";
import { buildApp, buildServices } from "../../services/app/src/build-app";
// JOB 3353 B: die Kennung der typisierten Sperrantwort — aus der EINEN Quelle, nicht getippt.
import { CONFIDENTIAL_CLOUD_BLOCKED } from "../../services/app/src/routes/reasoner-routes";
import type { KlaraResolution } from "../../services/reasoner";
import { ModelProvider, Reasoner } from "../../services/reasoner";
import { erteileKiFreigabe } from "../../services/reasoner/src/testhelfer-ki-freigabe";

const TEXT = "Nach dem Anfahren zehn Sekunden warten, dann die Pumpe entlüften.";
const UEBERARBEITET = "Nach dem Anfahren zehn Sekunden warten und die Pumpe danach entlüften.";

const apps: ReturnType<typeof buildApp>[] = [];
beforeEach(() => vi.stubEnv("KLARWERK_ADDON_API", "1"));
afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
  vi.unstubAllEnvs();
});

let zaehler = 0;

/**
 * Die echte Kompositionswurzel, einmal mit und einmal ohne Adminfreigabe.
 *
 * NUR der Modelltransport ist ersetzt, und zwar aus zwei Gründen: er macht den Anbieter
 * eingerichtet (ohne Cloud-Anbindung hiesse der Sperrgrund `external_not_configured` statt
 * `policy_incomplete`, und die Fälle unten prüften die falsche Sperre), und er zählt mit, was das
 * Haus wirklich verlassen hat. Policy, Sitzungsdienst, Freigabeprüfer und Routen sind echt.
 */
async function aufbauen(freigabe: boolean, zuordnungSchreiben = false) {
  const gesehen: string[] = [];
  const services = buildServices();
  services.reasoner = new Reasoner(
    new ModelProvider({
      name: "anthropic-3666",
      complete: async (system, prompt) => {
        gesehen.push(`${system}\n${prompt}`);
        return UEBERARBEITET;
      },
    }),
  );
  // W3 BRAUCHT EINE GESCHRIEBENE ZUORDNUNG, und das ist gemessen, nicht Geschmack: die
  // Policyversion trägt die HERKUNFT der Zuordnung (`policy:<source>:<choice>`). Eine frische
  // Instanz meldet `default`; der erste Schreibvorgang macht daraus `db`. Ohne diesen Vorlauf
  // unterschieden sich die beiden Lagen in W3 an ZWEI Stellen, und der Fall könnte nicht mehr
  // behaupten, der Unterschied sei die Freigabe. Die Freigabe selbst bleibt dabei unberührt: ein
  // weggelassenes Freigabefeld lässt sie, wie sie war (`normalizeTaskConfig`).
  if (zuordnungSchreiben) {
    await services.reasoner.setTaskConfig({ global: "auto", perTask: {} });
  }
  // Die GRUNDFREIGABE, wie ein Administrator sie setzt — über den echten Schreibweg des Kerns.
  // KEIN `vertraulicheInhalte`: dieser Auftrag misst die Grundfrage „darf öffentliche KI überhaupt",
  // und der zweite Schalter würde die Vertraulichkeitsgrenze aufweichen, die hier nichts zu suchen hat.
  if (freigabe) {
    await erteileKiFreigabe(services.reasoner);
  }
  const app = buildApp(services);
  apps.push(app);
  zaehler += 1;
  const email = `job3666-${zaehler}@example.test`;
  const registrierung = await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Job3666", email, password: "test-password-3666" },
  });
  expect(registrierung.statusCode).toBe(201);
  const anmeldung = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password: "test-password-3666" },
  });
  expect(anmeldung.statusCode).toBe(200);
  const headers = { authorization: `Bearer ${anmeldung.json().token}` };
  const ko = await app.inject({
    method: "POST",
    url: "/api/kos",
    headers,
    payload: {
      title: "Pumpe entlüften",
      statement: TEXT,
      type: "best_practice",
      category: "Wartung",
      confidentiality: "intern",
    },
  });
  expect(ko.statusCode).toBe(201);
  const sitzung = await app.inject({
    method: "POST",
    url: "/api/klara/sessions",
    headers: { ...headers, "x-klara-instance": "job3666-instance" },
    payload: {
      addinInstanceId: "job3666-instance",
      documentDescriptor: { kind: "saved", hostDocumentId: "job3666-document" },
    },
  });
  expect(sitzung.statusCode).toBe(201);
  const bindung = {
    "x-klara-session": sitzung.json().sessionId as string,
    "x-klara-instance": "job3666-instance",
    "x-klara-document": sitzung.json().documentContextId as string,
  };
  const zustimmung = await app.inject({
    method: "POST",
    url: `/api/klara/sessions/${bindung["x-klara-session"]}/consent`,
    headers: { ...headers, ...bindung },
  });
  expect(zustimmung.statusCode, zustimmung.body).toBe(200);
  expect(zustimmung.json().consentState).toBe("granted");
  gesehen.length = 0;
  return { services, app, headers, bindung, gesehen, koId: ko.json().id as string };
}
type Aufbau = Awaited<ReturnType<typeof aufbauen>>;

/** Der KLARA-Weg: die Auflösung, die das Aufgabenfenster anzeigt und an der es sich ausrichtet. */
async function klaraStatus(a: Aufbau): Promise<KlaraResolution> {
  const antwort = await a.app.inject({
    method: "GET",
    url: "/api/klara/ai-status",
    headers: { ...a.headers, ...a.bindung },
  });
  expect(antwort.statusCode, antwort.body).toBe(200);
  return antwort.json() as KlaraResolution;
}

/**
 * Der WORD-Weg: derselbe Aufruf, den das Add-in für die Überarbeitung macht.
 *
 * Er geht durch `ka4Freigabe` → `pruefeExterneAusfuehrung`, also durch genau dasselbe Tor wie der
 * Klara-Weg. Gemessen wird nicht der Statuscode allein, sondern ob der TEXT das Haus verlassen hat:
 * „gesperrt" darf nie aus einem Ausfall abgeleitet werden.
 */
async function wordWeg(
  a: Aufbau,
): Promise<{ status: number; demo: boolean | undefined; grund: unknown }> {
  const antwort = await a.app.inject({
    method: "POST",
    url: "/api/reasoner",
    headers: { ...a.headers, ...a.bindung, "content-type": "application/json" },
    payload: { task: "assist", text: TEXT, ...draftProvenance(undefined, a.koId) },
  });
  const koerper = antwort.json() as { demo?: boolean; code?: unknown; reason?: unknown };
  if (antwort.statusCode !== 200) {
    // Die Sperre hat GENAU EINE zulässige Form (JOB 3353 B). Ein 500, ein Zeitlimit oder ein Absturz
    // sähe von aussen auch nach „kein Egress" aus und wäre keiner — und der geschützte Text darf in
    // keiner Fehlerantwort stehen.
    expect(koerper.code, antwort.body).toBe(CONFIDENTIAL_CLOUD_BLOCKED);
    expect(antwort.body).not.toContain(TEXT);
  }
  return { status: antwort.statusCode, demo: koerper.demo, grund: koerper.reason };
}

describe("JOB 3666 · W — Klara und Word folgen der zentralen Freigabe an der echten Wurzel", () => {
  it("W1 · OHNE Adminfreigabe: die Wurzel meldet `gesperrt`, und keine Zustimmung hebt das auf", async () => {
    const a = await aufbauen(false);
    const status = await klaraStatus(a);

    // Die Wurzel meldet die Sperre auch in der Kennung. Seit JOB 3767 belegt DIESE Zeile allein
    // die Verdrahtung nicht mehr (ein fehlendes Feld ergäbe dasselbe) — das tut W2 mit `:frei`.
    expect(status.policyVersion.endsWith(":gesperrt")).toBe(true);
    // Und sie liefert es als ADMIN-Grund: die Zustimmung ist im Aufbau bereits erteilt.
    expect(status.executionAllowed).toBe(false);
    expect(status.blockedReason).toBe("policy_incomplete");
    expect(status.externalConsentGranted).toBe(true);

    // Der Word-Weg gibt nichts hinaus — gezählt, nicht abgeleitet. Und er sagt es dem Menschen
    // ehrlich: `declared` ist der Grund, den `reasoner-routes.ts:164` für den KA4-Riegel führt
    // („ebenso der KA4-Riegel ohne Dokumentzustimmung").
    //
    // WAS OHNE DIE VERDRAHTUNG HIER STAND, gemessen und nicht vermutet (Gegenprobe C: die Zeile in
    // `build-app.ts` entfernt, die Statuszeilen oben stillgelegt, damit dieser Teil überhaupt
    // erreicht wird): HTTP 500, `{"error":"Internal Server Error","message":"Die KI hat keine
    // Antwort geliefert. Grund: Kein KI-Modell hat geantwortet …"}`. Das ist die ganze Bescherung
    // in einem Satz: der Riegel fiel (das Tor hielt die öffentliche KI für freigegeben), die
    // Anfrage lief los, und erst der KERN sperrte den Egress — der Mensch bekam einen Serverfehler
    // statt der Auskunft, dass sein Administrator die öffentliche KI nicht freigegeben hat.
    const word = await wordWeg(a);
    expect(a.gesehen).toEqual([]);
    expect([word.status, word.grund]).toEqual([409, "declared"]);
  });

  it("W2 · MIT Adminfreigabe: dieselbe Wurzel lässt beide Wege laufen", async () => {
    // Ohne diesen Fall wäre W1 auch dann grün, wenn die Verdrahtung schlicht immer sperrte — eine
    // stille Abschaltung, die niemand bestellt hat.
    const a = await aufbauen(true);
    const status = await klaraStatus(a);

    expect(status.policyVersion.endsWith(":frei")).toBe(true);
    expect(status.executionAllowed).toBe(true);
    expect(status.blockedReason).toBe(null);

    const word = await wordWeg(a);
    expect([word.status, word.demo]).toEqual([200, false]);
    expect(a.gesehen.join("\n")).toContain(TEXT);
  });

  it("W3 · die Adminentscheidung wirkt SOFORT auf eine laufende Sitzung — und entwertet die Zustimmung", async () => {
    // Der eigentliche Wert einer zentralen Entscheidung: sie greift ohne Neustart, an EINER
    // laufenden Instanz, und sie steckt in der Version, an der eine Zustimmung hängt. Wäre das Feld
    // weiterhin ungesetzt, wären beide Versionen unten GLEICH — und die Umstellung bliebe für jede
    // offene Sitzung folgenlos (`klaraPolicyVersion`, JOB 3502).
    const a = await aufbauen(false, true);
    const vorher = await klaraStatus(a);
    expect(vorher.policyVersion.endsWith(":gesperrt")).toBe(true);
    expect(vorher.blockedReason).toBe("policy_incomplete");
    expect(vorher.externalConsentGranted).toBe(true);

    await erteileKiFreigabe(a.services.reasoner);
    const nachher = await klaraStatus(a);

    // Der Unterschied ist GENAU das Freigabesegment — keine zweite Abweichung nebenher.
    const basis = (v: string): string => v.slice(0, v.lastIndexOf(":"));
    expect(basis(nachher.policyVersion)).toBe(basis(vorher.policyVersion));
    expect(nachher.policyVersion.endsWith(":frei")).toBe(true);

    // Und die Zustimmung von vorhin trägt die neue Lage NICHT: der Mensch hat auf einer anderen
    // Grundlage zugestimmt, also wird erneut gefragt. Fail-closed in beide Richtungen.
    expect(nachher.externalConsentGranted).toBe(false);
    expect(nachher.blockedReason).toBe("external_consent_missing");
    expect(nachher.executionAllowed).toBe(false);
  });
});
