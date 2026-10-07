// ================================================================================================
// R-0278 · ANTWORTEN NUR AUS GEPRUEFTEM WISSEN — DER WEGEUEBERGREIFENDE AUSSCHLUSSTEST
// ================================================================================================
//
// Der Auftragspunkt, woertlich: „Klara zieht für eine Antwort ausschließlich Wissen heran, das ein
// Mensch geprüft und freigegeben hat. Gibt es dazu nichts Geprüftes, antwortet sie nicht, sondern
// legt eine Wissenslücke an. Das soll für alle Wege gleich gelten: Web-Ansicht, Word-Panel,
// Schlüssel-Schnittstelle und Export."
//
// Der Quellenbeleg dazu (Landkarte v3, Zeile A1) lautet: „der wegeübergreifende Ausschlusstest
// fehlt". Einzelbelege je Weg gibt es inzwischen (Schlüssel: tests/security/f0688-…; Word-Panel:
// ask-routes-ka4-einwilligung.test.ts, tests/app/w5-…; Export: output-routes.test.ts). Was fehlte,
// ist EIN Bestand, an dem alle vier Wege nebeneinander gemessen werden — sonst kann niemand sehen,
// ob sie sich gleich verhalten. Diese Datei ist genau das, nicht mehr.
//
// DER BESTAND: zwei Objekte zum selben Gegenstand, die sich NUR im Prüfstand unterscheiden. Die
// Frage FRAGE_NUR_UNGEPRUEFT trifft ausschließlich das ungeprüfte (dieselbe, an F-0688 kalibrierte
// Trennschärfe: „NOTSTART-4" steht nur dort).
//
// WAS DIESE DATEI AUSDRUECKLICH NICHT ENTSCHEIDET — die Web-Ansicht. Dort setzt die Route bewusst
// kein `validatedOnly` (Entscheidung mega52 C, Begründung in
// tests/app/mega52-validiert-zusicherung-sammler.test.ts; offene Eigentümerentscheidung EK-23). Ob
// die Web-Ansicht künftig wie die anderen Wege nur Geprüftes heranzieht, ist eine Produkt-
// entscheidung, keine Testfrage. Gemessen wird dort deshalb nur, was unabhängig davon gelten muss
// (R-0285): steht Ungeprüftes in der Herleitung, heißt die Antwort NIE „gesichert". Fällt die
// Entscheidung für „nur geprüft", bleibt dieser Fall grün und W-WEB-1 wird zur Aussage über den
// neuen Stand — er pinnt den heutigen Weg absichtlich nicht fest.
//
// KEIN MODELLAUFRUF: `KLARWERK_SKIP_KEYCHAIN` schaltet die Schlüsselbund-Auflösung ab, damit auf
// einer Maschine mit hinterlegtem Schlüssel kein echter Aufruf über das Ergebnis entscheidet.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";

const ADDON_KEY_HEADER = "x-klarwerk-addon-key";
const KEY = "r0278-test-key";
const ORIGIN = "https://localhost:3000";
const INSTANZ = "r0278-instanz";

const SAVED: Record<string, string | undefined> = {};
const KEYS = [
  "KLARWERK_ADDON_API",
  "KLARWERK_ADDON_API_KEY",
  "KLARWERK_ADDON_ORIGIN",
  "KLARWERK_ADDON_AUTH_MAX",
  "KLARWERK_ADDON_AUTH_WINDOW",
  "KLARWERK_ADDON_RATE_MAX",
  "KLARWERK_ADDON_RATE_WINDOW",
  "KLARWERK_SKIP_KEYCHAIN",
];
beforeEach(() => {
  for (const k of KEYS) {
    SAVED[k] = process.env[k];
    delete process.env[k];
  }
  process.env.KLARWERK_ADDON_API = "1";
  process.env.KLARWERK_ADDON_API_KEY = KEY;
  process.env.KLARWERK_ADDON_ORIGIN = ORIGIN;
  process.env.KLARWERK_SKIP_KEYCHAIN = "1";
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

/** Trifft AUSSCHLIESSLICH das ungeprüfte Objekt — „NOTSTART-4" steht nur dort. */
const FRAGE_NUR_UNGEPRUEFT = "Wozu dient der Schnellstartknopf NOTSTART-4?";
/** Trifft beide; dient als Kalibrierung, dass ein Weg überhaupt etwas liefert. */
const FRAGE_BREIT = "Wie wird die Kesselspeisepumpe KSP-7 angefahren?";
const UNGEPRUEFTER_INHALT = "NOTSTART-4";

async function aufbauen() {
  const app = buildApp(buildServices());
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Admin", email: "a@r0278.de", password: "secret123" },
  });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "a@r0278.de", password: "secret123" },
  });
  const kopf = { authorization: `Bearer ${login.json().token}` };

  async function anlegen(title: string, statement: string): Promise<string> {
    const res = await app.inject({
      method: "POST",
      url: "/api/kos",
      headers: kopf,
      payload: {
        confidentiality: "intern",
        title,
        statement,
        type: "best_practice",
        category: "R0278",
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
    headers: kopf,
    payload: { action: "rate", verdict: "up" },
  });

  // Die echte Word-Sitzung — der Server vergibt Sitzungs- und Dokumentkennung. KEINE Einwilligung:
  // gemessen wird der Weg, den das Panel ohne Zustimmung zur externen KI fährt.
  const sitzung = await app.inject({
    method: "POST",
    url: "/api/klara/sessions",
    headers: { ...kopf, "x-klara-instance": INSTANZ },
    payload: {
      addinInstanceId: INSTANZ,
      documentDescriptor: { kind: "saved", hostDocumentId: "r0278-doc" },
    },
  });
  expect(sitzung.statusCode, `Sitzung: ${sitzung.body}`).toBe(201);
  const word = {
    ...kopf,
    "x-klara-instance": INSTANZ,
    "x-klara-session": String(sitzung.json().sessionId),
    "x-klara-document": String(sitzung.json().documentContextId),
  };

  const fragen = {
    web: (question: string) =>
      app.inject({ method: "POST", url: "/api/ask", headers: kopf, payload: { question } }),
    word: (question: string) =>
      app.inject({
        method: "POST",
        url: "/api/ask",
        headers: word,
        payload: { question, mode: "retrieval-only" },
      }),
    schluessel: (question: string) =>
      app.inject({
        method: "POST",
        url: "/api/ask",
        headers: { [ADDON_KEY_HEADER]: KEY, origin: ORIGIN },
        payload: { question },
      }),
    export: (koIds: string[]) =>
      app.inject({
        method: "POST",
        url: "/api/output/generate",
        headers: kopf,
        payload: { kind: "instruction", koIds },
      }),
  };
  return { app, kopf, validiertId, ungeprueftId, fragen };
}

describe("R-0278 · alle Wege nebeneinander: Ungeprüftes wird nie Grundlage", () => {
  it("W0 · KALIBRIERUNG: der Bestand trennt, und die Frage findet das ungeprüfte Objekt wirklich", async () => {
    // Ohne diesen Fall wären W-WORD/W-SCHLUESSEL auch dann grün, wenn die Frage gar nichts träfe.
    const { app, kopf, validiertId, ungeprueftId, fragen } = await aufbauen();
    const a = await app.inject({ method: "GET", url: `/api/kos/${validiertId}`, headers: kopf });
    const b = await app.inject({ method: "GET", url: `/api/kos/${ungeprueftId}`, headers: kopf });
    expect(a.json().status).toBe("validiert");
    expect(b.json().status).not.toBe("validiert");

    // Die Web-Ansicht hat keine Enge — dort MUSS die Frage das ungeprüfte Objekt erreichen.
    const web = await fragen.web(FRAGE_NUR_UNGEPRUEFT);
    expect(web.statusCode).toBe(200);
    expect(web.json().result.sources ?? []).toContain(ungeprueftId);
    await app.close();
  });

  it("W-WORD · Word-Panel ohne Einwilligung: keine Antwort aus Ungeprüftem, Lücke angelegt, Ungeprüftes gemeldet", async () => {
    const { app, ungeprueftId, fragen } = await aufbauen();
    const res = await fragen.word(FRAGE_NUR_UNGEPRUEFT);
    expect(res.statusCode).toBe(200);
    const koerper = res.json();
    expect(koerper.result.sources ?? []).not.toContain(ungeprueftId);
    expect(koerper.result.citedSources ?? []).not.toContain(ungeprueftId);
    expect(JSON.stringify(koerper.result)).not.toContain(UNGEPRUEFTER_INHALT);
    // „antwortet sie nicht, sondern legt eine Wissenslücke an"
    expect(koerper.result.answered).toBe(false);
    expect(
      koerper.gap,
      "das Word-Panel legt ohne geprüfte Grundlage keine Wissenslücke an",
    ).not.toBeNull();
    // S6: „und sagt auch, wenn es etwas gibt, das noch nicht geprüft ist" — gemeldet, nie behauptet.
    expect((koerper.ungeprueft ?? []).map((h: { id: string }) => h.id)).toContain(ungeprueftId);
    await app.close();
  });

  it("W-SCHLUESSEL · Schlüssel-Schnittstelle: keine Antwort aus Ungeprüftem, keine Lücke (count_only)", async () => {
    const { app, ungeprueftId, fragen } = await aufbauen();
    const res = await fragen.schluessel(FRAGE_NUR_UNGEPRUEFT);
    expect(res.statusCode).toBe(200);
    const koerper = res.json();
    expect(koerper.result.sources ?? []).not.toContain(ungeprueftId);
    expect(koerper.result.citedSources ?? []).not.toContain(ungeprueftId);
    expect(JSON.stringify(koerper)).not.toContain(UNGEPRUEFTER_INHALT);
    expect(koerper.result.answered).toBe(false);
    // Bewusst KEIN Lückeneintrag mit Fragetext für einen Fremdaufrufer (SCRUM-490 D1, gapPolicy
    // `count_only`); gezählt wird über das metadata-only Audit. Die Quelle zu R-0278 nennt genau
    // diese Form als Zielskizze für den Add-on-Zweig.
    expect(koerper.gap ?? null).toBeNull();
    await app.close();
  });

  it("W-EXPORT · Export: ein ungeprüftes Objekt ist weder wählbar noch exportierbar", async () => {
    const { app, kopf, validiertId, ungeprueftId, fragen } = await aufbauen();
    const quellen = await app.inject({ method: "GET", url: "/api/output/sources", headers: kopf });
    expect(quellen.statusCode).toBe(200);
    const ids = (quellen.json() as Array<{ id: string }>).map((q) => q.id);
    expect(ids).toContain(validiertId);
    expect(ids).not.toContain(ungeprueftId);

    const abgelehnt = await fragen.export([ungeprueftId]);
    expect(abgelehnt.statusCode).toBe(400);
    expect(abgelehnt.json().error).toBe("NOT_VALIDATED");
    expect(abgelehnt.body).not.toContain(UNGEPRUEFTER_INHALT);
    await app.close();
  });

  it("W-KALIBRIERUNG · die engen Wege sind nicht blind: Geprüftes kommt überall an", async () => {
    // Ohne diesen Fall könnten W-WORD/W-SCHLUESSEL/W-EXPORT grün sein, weil die Wege nichts liefern.
    const { app, validiertId, fragen } = await aufbauen();
    const word = await fragen.word(FRAGE_BREIT);
    expect(word.statusCode).toBe(200);
    expect(word.json().result.sources ?? []).toContain(validiertId);
    const schluessel = await fragen.schluessel(FRAGE_BREIT);
    expect(schluessel.statusCode).toBe(200);
    expect(schluessel.json().result.sources ?? []).toContain(validiertId);
    const exportiert = await fragen.export([validiertId]);
    expect(exportiert.statusCode).toBe(200);
    await app.close();
  });

  it("W-WEB-1 · Web-Ansicht: trägt Ungeprüftes mit, heißt die Antwort nie „gesichert“ (R-0285)", async () => {
    // Die einzige passende Quelle ist ungeprüft. Ob die Web-Ansicht daraus gekennzeichnet antwortet
    // (heute) oder eine Lücke anlegt (falls EK-23 für „nur geprüft" entschieden wird): „gesichert"
    // ist in keinem der beiden Fälle wahr.
    const { app, fragen } = await aufbauen();
    const res = await fragen.web(FRAGE_NUR_UNGEPRUEFT);
    expect(res.statusCode).toBe(200);
    const ergebnis = res.json().result;
    expect(ergebnis.knowledgeClass).not.toBe("gesichert");
    if (ergebnis.answered) {
      // Antwortet sie, ist die Einstufung ausdrücklich „ungeprüft" — nicht bloß „nicht gesichert".
      expect(ergebnis.knowledgeClass).toBe("ungeprueft");
    } else {
      expect(res.json().gap, "ohne Antwort muss eine Wissenslücke entstehen").not.toBeNull();
    }
    await app.close();
  });
});
