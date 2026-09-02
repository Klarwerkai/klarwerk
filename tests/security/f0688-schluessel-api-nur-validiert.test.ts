// ================================================================================================
// JOB 2964 · D1 — F-0688: die Schluessel-API liefert AUSSCHLIESSLICH validiertes Wissen
// ================================================================================================
//
// Das Registerversprechen, woertlich:
//
//     „Andere Programme duerfen sich mit einem Schluessel anmelden, Fragen stellen und Texte
//      pruefen lassen. Sie bekommen dabei ausschliesslich Antworten aus geprueftem, validiertem
//      Wissen. Jeder Schluessel hat eigene Rechte und eine Zugriffsbremse gegen Ueberlastung."
//
// DIESE DATEI IST ZUERST EIN MESSINSTRUMENT. Der Auftrag stellt das Messen dem Bauen voran, und
// die bestehende Suite `services/app/src/addon-api.test.ts` laesst genau eine Frage offen: Sie
// belegt, dass ein gueltiger Key ein VALIDIERTES Objekt bekommt (`:248-258`) — nirgends, dass ein
// UNVALIDIERTES ausgeschlossen bleibt. Das ist der Unterschied zwischen „findet das Richtige" und
// „liefert nichts Falsches", und nur das zweite ist die Zusage von F-0688.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";

const ADDON_KEY_HEADER = "x-klarwerk-addon-key";
const KEY = "f0688-test-key";
const ORIGIN = "https://localhost:3000";

// Dieselbe Env-Sicherung wie die Bestandssuite: kein Test leakt das Flag an einen anderen.
const SAVED: Record<string, string | undefined> = {};
const KEYS = [
  "KLARWERK_ADDON_API",
  "KLARWERK_ADDON_API_KEY",
  "KLARWERK_ADDON_ORIGIN",
  "KLARWERK_ADDON_AUTH_MAX",
  "KLARWERK_ADDON_AUTH_WINDOW",
  "KLARWERK_ADDON_RATE_MAX",
  "KLARWERK_ADDON_RATE_WINDOW",
];
beforeEach(() => {
  for (const k of KEYS) {
    SAVED[k] = process.env[k];
    delete process.env[k];
  }
  process.env.KLARWERK_ADDON_API = "1";
  process.env.KLARWERK_ADDON_API_KEY = KEY;
  process.env.KLARWERK_ADDON_ORIGIN = ORIGIN;
});
afterEach(() => {
  for (const k of KEYS) {
    if (SAVED[k] === undefined) {
      delete process.env[k];
    } else {
      process.env[k] = SAVED[k];
    }
  }
});

/**
 * Ein Bestand mit ZWEI Objekten zur selben Frage: eines validiert, eines nicht.
 *
 * Das ist der Kern des Aufbaus. Ein Bestand mit nur einem validierten Objekt kann die Zusage
 * nicht pruefen — dort ist „nur Validiertes" trivial erfuellt, weil es nichts anderes gibt.
 */
async function appMitBeidenSorten() {
  const app = buildApp(buildServices());
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Admin", email: "a@f0688.de", password: "secret123" },
  });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "a@f0688.de", password: "secret123" },
  });
  const headers = { authorization: `Bearer ${login.json().token}` };

  async function anlegen(title: string, statement: string): Promise<string> {
    const res = await app.inject({
      method: "POST",
      url: "/api/kos",
      headers,
      payload: {
        title,
        statement,
        type: "best_practice",
        category: "F0688",
        neededValidations: 1,
      },
    });
    return res.json().id as string;
  }

  // Beide Objekte treffen dieselbe Frage — sie unterscheiden sich NUR im Pruefstand.
  const validiertId = await anlegen(
    "Kesselspeisepumpe KSP-7 anfahren",
    "Die Kesselspeisepumpe KSP-7 wird ueber das Handventil HV-9 langsam angefahren.",
  );
  const ungeprueftId = await anlegen(
    "Kesselspeisepumpe KSP-7 Schnellstart",
    "Die Kesselspeisepumpe KSP-7 wird ueber den Schnellstartknopf NOTSTART-4 angefahren.",
  );
  // Nur das erste wird validiert.
  await app.inject({
    method: "PUT",
    url: `/api/kos/${validiertId}`,
    headers,
    payload: { action: "rate", verdict: "up" },
  });

  return { app, headers, validiertId, ungeprueftId };
}

// ================================================================================================
// DIE FRAGE IST DER GANZE TEST — und der erste Entwurf dieser Datei hatte hier die falsche.
// ================================================================================================
//
// Zuerst stand hier die breite Frage „Wie wird die Kesselspeisepumpe KSP-7 angefahren?". Sie ist
// wertlos: Gemessen in einem Messklon MIT abgeschaltetem `validatedOnly` lieferte sie trotzdem nur
// das validierte Objekt —
//
//     DIAG breit · ADDON sources=[validiertId] text-hat-NOTSTART=false
//
// weil die Kandidatenauswahl bei gleich gutem Treffer das validierte bevorzugt. Ein Test mit
// dieser Frage waere gruen geblieben, auch wenn die Sperre GANZ fehlt. Er haette nichts geprueft.
//
// FRAGE_NUR_UNGEPRUEFT trifft dagegen AUSSCHLIESSLICH das unvalidierte Objekt: „NOTSTART-4" kommt
// im validierten Text nicht vor. Dieselbe Messung mit abgeschaltetem `validatedOnly`:
//
//     DIAG nur-ungeprueft · ADDON sources=[ungeprueftId] text-hat-NOTSTART=true
//
// Erst damit hat der Test etwas, wovor er schuetzen kann.
const FRAGE_NUR_UNGEPRUEFT = "Wozu dient der Schnellstartknopf NOTSTART-4?";
const FRAGE_BREIT = "Wie wird die Kesselspeisepumpe KSP-7 angefahren?";

describe("JOB 2964 · F-0688 · die Schluessel-API liefert nur validiertes Wissen", () => {
  it("M0 · VORAUSSETZUNG: beide Objekte sind angelegt und unterscheiden sich im Pruefstand", async () => {
    // Ohne diesen Fall koennte M1 gruen sein, weil das unvalidierte Objekt gar nicht existiert
    // oder versehentlich mitvalidiert wurde — dann prueft M1 nichts.
    const { app, headers, validiertId, ungeprueftId } = await appMitBeidenSorten();
    const a = await app.inject({ method: "GET", url: `/api/kos/${validiertId}`, headers });
    const b = await app.inject({ method: "GET", url: `/api/kos/${ungeprueftId}`, headers });
    expect(a.statusCode).toBe(200);
    expect(b.statusCode).toBe(200);
    expect(a.json().status, "das erste Objekt ist nicht validiert").toBe("validiert");
    expect(b.json().status, "das zweite Objekt ist unerwartet validiert").not.toBe("validiert");
  });

  it("M1 · DER KERN: der Schluessel bekommt das unvalidierte Objekt NIE — auch nicht auf direkte Frage", async () => {
    const { app, ungeprueftId } = await appMitBeidenSorten();
    const res = await app.inject({
      method: "POST",
      url: "/api/ask",
      headers: { [ADDON_KEY_HEADER]: KEY, origin: ORIGIN },
      payload: { question: FRAGE_NUR_UNGEPRUEFT },
    });
    expect(res.statusCode).toBe(200);

    const quellen = (res.json().result?.sources ?? []) as string[];
    expect(quellen, "das UNVALIDIERTE Objekt ist beim Schluessel-Zugang gelandet").not.toContain(
      ungeprueftId,
    );
  });

  it("M2 · der unvalidierte INHALT steht auch nicht im Antworttext", async () => {
    // Eine Quellenliste ohne die Kennung belegt noch nicht, dass der INHALT draussen blieb — der
    // Antworttext ist der Weg, auf dem ein Mensch ihn tatsaechlich liest.
    const { app } = await appMitBeidenSorten();
    const res = await app.inject({
      method: "POST",
      url: "/api/ask",
      headers: { [ADDON_KEY_HEADER]: KEY, origin: ORIGIN },
      payload: { question: FRAGE_NUR_UNGEPRUEFT },
    });
    expect(res.statusCode).toBe(200);
    const text = JSON.stringify(res.json());
    expect(text, "der unvalidierte Schnellstart-Weg steht in der Antwort").not.toContain(
      "NOTSTART-4",
    );
  });

  it("M3 · KALIBRIERUNG: der Schluessel ist nicht einfach blind — Validiertes kommt an", async () => {
    // Ohne diesen Fall koennten M1 und M2 auch dadurch gruen sein, dass der Schluessel-Zugang
    // ueberhaupt nichts liefert. Dieselbe Kette, dieselbe Auth, eine Frage auf das VALIDIERTE
    // Objekt — es muss ankommen.
    const { app, validiertId } = await appMitBeidenSorten();
    const res = await app.inject({
      method: "POST",
      url: "/api/ask",
      headers: { [ADDON_KEY_HEADER]: KEY, origin: ORIGIN },
      payload: { question: FRAGE_BREIT },
    });
    expect(res.statusCode).toBe(200);
    const quellen = (res.json().result?.sources ?? []) as string[];
    expect(quellen, "der Schluessel bekommt nicht einmal das validierte Objekt").toContain(
      validiertId,
    );
  });

  it("M3b · KALIBRIERUNG: dieselbe Frage im Sitzungsweg erreicht das unvalidierte Objekt sehr wohl", async () => {
    // Der Beleg, dass FRAGE_NUR_UNGEPRUEFT das Objekt ueberhaupt findet. Waere sie eine Frage, die
    // im Retrieval danebengreift, waeren M1/M2 Scheinbelege — gruen, weil nichts gesucht wird.
    // Der Sitzungsweg unterliegt der Add-on-Enge nicht und dient hier als Referenz.
    const { app, headers, ungeprueftId } = await appMitBeidenSorten();
    const res = await app.inject({
      method: "POST",
      url: "/api/ask",
      headers,
      payload: { question: FRAGE_NUR_UNGEPRUEFT },
    });
    expect(res.statusCode).toBe(200);
    const quellen = (res.json().result?.sources ?? []) as string[];
    expect(
      quellen,
      "die Frage findet das unvalidierte Objekt gar nicht — dann pruefen M1/M2 nichts",
    ).toContain(ungeprueftId);
  });

  // ==============================================================================================
  // M4 · DER ZWEITE WEG, NICHT-VAKUOS — mit injiziertem deterministischem Judge
  // ==============================================================================================
  //
  // BEN zu D2, und er hat recht: *„M4/M4b durch einen nicht-vakuosen fachlichen Wire-Beleg
  // ersetzen. … Zielstand gruen mit wirksamer positiver Kontrolle, Entfernung ausschliesslich des
  // Validierungsfilters macht den Test rot."*
  //
  // WARUM DIE D2-FASSUNG NICHT TRUG — die Diagnose steht, sie wird hier nicht wiederholt, nur
  // verwendet: Im deterministischen Pfad (`want` fehlend oder `"stage1"`) liefert
  // `assessAgainstPool` strukturell nie Kandidaten. Die Antwort ist immer leer, mit und ohne
  // Filter. Ein Test darauf kann nicht beissen.
  //
  // DER AUSWEG, den das Haus schon kennt: `check-text-routes.test.ts:322-410` (SCRUM-491 Slice 6)
  // baut Stufe 2 mit INJIZIERTEN Fakes. Dieselbe Idee hier, aber am Add-on-Weg statt am
  // Sitzungsweg — beides zusammen ist der Punkt:
  //
  //     `services.reasoner.judgeDuplicate` wird VOR `buildApp` durch einen deterministischen
  //     Doppel ersetzt; `buildApp` verdrahtet ihn ueber `check-text-routes.ts:213`
  //     (`duplicateJudge: (a, b) => deps.reasoner.judgeDuplicate(a, b, locale)`). Der Add-on-Hook
  //     bleibt dabei vollstaendig aktiv — der Schluessel authentifiziert wie in Produktion.
  //
  // KEIN Modell, KEIN Netz, KEIN Embedder: Der Doppel antwortet auf JEDES Paar mit demselben
  // Urteil. Genau das macht den Fall trennscharf — was im Ergebnis landet, entscheidet dann
  // ausschliesslich der POOL, also `selectValidatedPool` (`check-text-detection.ts:117-121`).
  // Waere der Filter weg, kaeme das unvalidierte Objekt mit; er ist die einzige veraenderliche
  // Groesse zwischen Zielstand und Gegenmutation.
  //
  // `want:"deep"` allein genuegt nicht: `check-text-routes.ts:198` faellt bei fehlendem
  // Herkunftssignal fail-safe auf „vertraulich" zurueck und damit auf den deterministischen Pfad.
  // Deshalb tragen die Anfragen `source:"draft"` und `confidentiality:"intern"` — eine ehrliche
  // Deklaration, kein Umgehen der Regel.

  /** Ein deterministischer Duplikat-Doppel: sagt zu JEDEM Paar dasselbe. Kein Modell, kein Netz. */
  function immerDuplikat() {
    return {
      beziehung: "teilweise",
      aspects: [
        {
          beschreibung: "Kern deckt sich",
          zitatA: "Kesselspeisepumpe KSP-7",
          zitatB: "Kesselspeisepumpe KSP-7",
        },
      ],
      nurInA: "nur A",
      nurInB: "nur B",
      empfehlung: "zusammenfuehren_pruefen",
      confidence: 0.9,
      begruendung: "Deterministischer Testdoppel — urteilt fuer jedes Paar gleich.",
    };
  }

  /**
   * Derselbe Bestand wie oben, aber mit ersetztem Judge — der Add-on-Weg laeuft dadurch in Stufe 2.
   *
   * Ersetzt ist AUSSCHLIESSLICH `reasoner.judgeDuplicate`. Auth, Routing, Pool-Auswahl und
   * Antwortbau sind unveraenderter Produktcode.
   */
  async function appMitJudge() {
    const services = buildServices();
    (services.reasoner as unknown as Record<string, unknown>).judgeDuplicate = async () =>
      immerDuplikat();
    const app = buildApp(services);

    await app.inject({
      method: "POST",
      url: "/api/auth/register",
      payload: { name: "Admin", email: "a@f0688d3.de", password: "secret123" },
    });
    const login = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "a@f0688d3.de", password: "secret123" },
    });
    const headers = { authorization: `Bearer ${login.json().token}` };

    async function anlegen(title: string, statement: string): Promise<string> {
      const res = await app.inject({
        method: "POST",
        url: "/api/kos",
        headers,
        payload: {
          title,
          statement,
          type: "best_practice",
          category: "F0688",
          neededValidations: 1,
        },
      });
      return res.json().id as string;
    }

    const validiertId = await anlegen(
      "Kesselspeisepumpe KSP-7 anfahren",
      "Die Kesselspeisepumpe KSP-7 wird ueber das Handventil HV-9 langsam angefahren.",
    );
    const ungeprueftId = await anlegen(
      "Kesselspeisepumpe KSP-7 Schnellstart",
      "Die Kesselspeisepumpe KSP-7 wird ueber den Schnellstartknopf NOTSTART-4 angefahren.",
    );
    await app.inject({
      method: "PUT",
      url: `/api/kos/${validiertId}`,
      headers,
      payload: { action: "rate", verdict: "up" },
    });
    return { app, headers, validiertId, ungeprueftId };
  }

  /** Eine Stufe-2-Pruefung ueber den Add-on-Schluessel — ehrlich deklarierte Herkunft. */
  async function pruefeMitSchluessel(app: Awaited<ReturnType<typeof appMitJudge>>["app"]) {
    return app.inject({
      method: "POST",
      url: "/api/check-text",
      headers: { [ADDON_KEY_HEADER]: KEY, origin: ORIGIN },
      payload: {
        text:
          "Die Kesselspeisepumpe KSP-7 wird ueber das Handventil HV-9 langsam angefahren. " +
          "Vor dem Anfahren ist der Druck abzulassen und das Ventil zu sichern.",
        locale: "de",
        want: "deep",
        source: "draft",
        confidentiality: "intern",
      },
    });
  }

  function funde(body: unknown): Array<{ koId: string }> {
    const b = body as {
      duplicates?: Array<{ koId: string }>;
      conflicts?: Array<{ koId: string }>;
    };
    return [...(b.duplicates ?? []), ...(b.conflicts ?? [])];
  }

  it("M4 · POSITIVKONTROLLE: der Schluessel bekommt einen ECHTEN Fund — das validierte Objekt", async () => {
    // Ohne diesen Fall waere M4b wertlos: „kein unvalidierter Fund" ist trivial wahr, solange die
    // Route ueberhaupt nichts findet. Genau daran ist die D2-Fassung gescheitert.
    const { app, validiertId } = await appMitJudge();
    const res = await pruefeMitSchluessel(app);
    expect(res.statusCode, "der Schluessel erreicht /api/check-text nicht").toBe(200);

    const gefunden = funde(res.json());
    expect(
      gefunden.length,
      "die Stufe-2-Pruefung liefert KEINEN Fund — der Fall ist wieder vakuos",
    ).toBeGreaterThan(0);
    expect(
      gefunden.map((f) => f.koId),
      "der Fund betrifft nicht das validierte Objekt",
    ).toContain(validiertId);
  });

  it("M4b · DER KERN: im selben Fund-Ergebnis taucht das UNVALIDIERTE Objekt nie auf", async () => {
    const { app, ungeprueftId } = await appMitJudge();
    const res = await pruefeMitSchluessel(app);
    expect(res.statusCode).toBe(200);

    const body = res.json();
    expect(
      funde(body).map((f) => f.koId),
      "das UNVALIDIERTE Objekt wurde der Fremdanwendung als Fund gemeldet",
    ).not.toContain(ungeprueftId);

    // Und sein Inhalt darf auch nicht ueber Titel oder Ausschnitt herausgehen.
    const roh = JSON.stringify(body);
    expect(roh, "der unvalidierte Schnellstart-Weg steht in der Antwort").not.toContain(
      "NOTSTART-4",
    );
    expect(roh, "der Titel des unvalidierten Objekts steht in der Antwort").not.toContain(
      "Schnellstart",
    );
  });
});
