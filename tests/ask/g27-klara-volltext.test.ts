// ================================================================================================
// G27 — KLARA UND DER GESPEICHERTE DOKUMENTINHALT
// ================================================================================================
//
// Gemessen wird der produktive Weg: der Ask-Dienst über die echten App-Dienste und über
// POST /api/ask. Es wird KEIN Add-in-Code gebaut und kein neuer Endpunkt erfunden.
//
// WAS DIESE DATEI BELEGT, UND WO SIE EINE GRENZE FESTNAGELT:
//
//   (1) Der SUCHRAUM von Klara ist ab G27 der gemeinsame Feldvertrag der Suchprojektion — der
//       vollständige sichtbare Dokumenttext eingeschlossen. Ein Begriff, der nur weit hinter der
//       alten Kurzfeldgrenze im Body steht, macht das Objekt zum Ask-Kandidaten.
//   (2) Die AUTORISIERUNG bleibt vor allem anderen: ein vertrauliches Objekt wird über den neuen
//       Volltext-Suchraum weder Kandidat noch Quelle noch Zählwert.
//   (3) Die HISTORIE bleibt aussen vor: eine Fassung, die nicht die aktive ist, liefert keine
//       Kandidaten.
//   (4) GRENZE DIESER SCHEIBE, ausdrücklich festgenagelt statt verschwiegen: das RELEVANZMASS des
//       Reasoners (`selectCandidates` → `refMatchText`, services/reasoner) sieht weiterhin nur
//       Titel, Aussage und Bild-Fußnoten. Ein Treffer, der AUSSCHLIESSLICH im Dokumenttext steht,
//       überlebt deshalb den Kandidatenweg, aber nicht das Relevanztor — die Antwort bleibt eine
//       ehrliche Wissenslücke. Die Reparatur ist additiv und klein (ein Feld an `KnowledgeRef`,
//       eine Zeile in `refMatchText`), liegt aber in `services/reasoner` und damit AUSSERHALB des
//       exklusiven Dateibereichs dieses Auftrags; sie steht als benannter Rest im Bericht.
//
// DETERMINISTISCH GEHALTEN: `KLARWERK_SKIP_KEYCHAIN` schaltet die Aufloesung des Cloud-Schluessels
// aus dem macOS-Schluesselbund ab (services/reasoner/src/model-client.ts). Ohne diese Zeile
// entscheidet auf einer Entwicklungsmaschine mit hinterlegtem Schluessel ein ECHTER Modellaufruf
// ueber das Ergebnis — genau der Befund, der den roten `ask-retrieval-topk-e2e` erklaert
// (Diagnose: tests/app/g27-ask-rot-diagnose.test.ts).
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { queryTokens } from "../../services/reasoner";

const VORGEFUNDEN = process.env.KLARWERK_SKIP_KEYCHAIN;
beforeAll(() => {
  process.env.KLARWERK_SKIP_KEYCHAIN = "1";
});
afterAll(() => {
  if (VORGEFUNDEN === undefined) {
    delete process.env.KLARWERK_SKIP_KEYCHAIN;
  } else {
    process.env.KLARWERK_SKIP_KEYCHAIN = VORGEFUNDEN;
  }
});

const ZIELWORT = "Nachspannmoment";
const FRAGE = `Wie hoch ist das ${ZIELWORT} an der Presse?`;

function langerBody(zielwort: string): string {
  return `<p>${"Fuelltext ohne Aussagekraft zur Anlage. ".repeat(30)}</p><p>Das ${zielwort} betraegt 42 Nm.</p>`;
}

async function aufbauen() {
  const { buildApp, buildServices } = await import("../../services/app/src/build-app");
  const services = buildServices();
  const app = buildApp(services);
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Admin", email: "admin@g27ask.test", password: "geheim12345" },
  });
  const anmeldung = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "admin@g27ask.test", password: "geheim12345" },
  });
  return {
    app,
    services,
    admin: { authorization: `Bearer ${anmeldung.json().token}` },
  };
}

// GENAU der Kandidatenweg, den AskService.ask geht (services/ask/src/service.ts): dieselben
// Fragetoken, dieselbe Methode, dasselbe Limit. Kein Nachbau der Regel — der echte Weg.
async function askKandidaten(
  services: Awaited<ReturnType<typeof aufbauen>>["services"],
  frage: string,
): Promise<string[]> {
  const terms = queryTokens(frage);
  return (await services.ko.findCandidates({ terms, limit: 200 })).map((k) => k.id);
}

describe("G27 · Klara: der Suchraum umfasst den vollen Dokumenttext", () => {
  it("ein Begriff NUR im Dokumenttext (hinter Zeichen 500) macht das Objekt zum Ask-Kandidaten", async () => {
    const { services } = await aufbauen();
    const ko = await services.ko.create({
      title: "Flanschmontage an der Presse",
      statement: "Kurzfassung ohne das Zielwort.",
      type: "best_practice",
      category: "Wartung",
      author: "anna",
      bodyHtml: langerBody(ZIELWORT),
    });
    // Kalibrierung: das Zielwort steht wirklich erst weit hinter der alten Kurzfeldgrenze …
    expect(langerBody(ZIELWORT).indexOf(ZIELWORT)).toBeGreaterThan(500);
    // … und in KEINEM der Kurzfelder.
    expect(`${ko.title} ${ko.statement}`).not.toContain(ZIELWORT);

    expect(await askKandidaten(services, FRAGE)).toEqual([ko.id]);
  });

  it("Gegenprobe: ohne den Begriff im Dokument gibt es keinen Kandidaten (kein Raten)", async () => {
    const { services } = await aufbauen();
    await services.ko.create({
      title: "Ganz anderes Thema",
      statement: "Betrifft die Foerderbandspannung.",
      type: "best_practice",
      category: "Wartung",
      author: "anna",
    });
    expect(await askKandidaten(services, FRAGE)).toEqual([]);
  });

  it("eine historische Fassung liefert Klara keinen Kandidaten mehr", async () => {
    const { services } = await aufbauen();
    // Der Titel trägt bewusst KEIN Wort der beiden Fragen: sonst käme der Kandidat über den
    // Titel und der Test sagte nichts über die Fassungsbindung des Dokumenttexts aus.
    const ko = await services.ko.create({
      title: "Montageblatt",
      statement: "Kurzangabe.",
      type: "best_practice",
      category: "Wartung",
      author: "anna",
      bodyHtml: langerBody("Altfassungsbegriff"),
    });
    const alteFrage = "Was bedeutet Altfassungsbegriff?";
    const neueFrage = "Was bedeutet Neufassungsbegriff?";
    expect(await askKandidaten(services, alteFrage)).toEqual([ko.id]);
    expect(await askKandidaten(services, neueFrage)).toEqual([]);

    await services.ko.revise(ko.id, { bodyHtml: langerBody("Neufassungsbegriff") }, "anna");

    expect(await askKandidaten(services, alteFrage)).toEqual([]);
    expect(await askKandidaten(services, neueFrage)).toEqual([ko.id]);
  });
});

describe("G27 · Klara: der neue Suchraum leakt nichts", () => {
  it("ein vertrauliches Objekt erreicht über den Dokumenttext weder Reasoner noch Quelle noch Antwort", async () => {
    const { app, services, admin } = await aufbauen();
    const ko = await services.ko.create({
      title: "Vertrauliche Kennlinie der Presse",
      statement: "Kurzfassung.",
      type: "best_practice",
      category: "Wartung",
      author: "anna",
      confidentiality: "vertraulich",
      bodyHtml: langerBody(ZIELWORT),
    });
    // Der serverseitige Kandidatenweg findet es (die Suche ist rechteblind) …
    expect(await askKandidaten(services, FRAGE)).toEqual([ko.id]);

    // … der Ask-Dienst wirft es VOR Reasoner, Quellen, Antworttext und Beleg heraus (SCRUM-502).
    const res = await app.inject({
      method: "POST",
      url: "/api/ask",
      headers: admin,
      payload: { question: FRAGE },
    });
    expect(res.statusCode, res.body).toBe(200);
    const body = res.json();
    expect(body.result.sources).toEqual([]);
    expect(body.result.citedSources).toEqual([]);
    expect(body.result.answered).toBe(false);
    // Kein Titel, kein Textschnipsel, keine Kennung des gesperrten Objekts über den Draht.
    expect(res.body).not.toContain("Vertrauliche Kennlinie der Presse");
    expect(res.body).not.toContain(ko.id);
  });
});

describe("G27 · die benannte Grenze dieser Scheibe", () => {
  it("das Relevanzmass des Reasoners sieht den Dokumenttext — die Antwort belegt den Nur-Fliesstext-Treffer", async () => {
    // PLANMÄSSIGE WEITERFÜHRUNG (JOB 2614 D3): Dieser Fall war als Reissleine gebaut — er nagelte
    // fest, dass `refMatchText` den Dokumenttext NOCH NICHT sah, und sollte nach der additiven
    // Reasoner-Ergänzung ROT werden und zur Anpassung zwingen. Genau das ist eingetreten: der
    // Ask-Dienst gibt `bodyText` aus der Suchprojektion in die Refs (ask/service.ts, refs-Bau;
    // 1565 Weg A — voller Projektionstext, keine neue Grenze), `refMatchText` zählt ihn mit.
    // Ab hier pinnt der Fall die NEUE Zusage: ein Treffer, der AUSSCHLIESSLICH im Fliesstext
    // steht, wird beantwortet und mit der Quelle belegt — nicht mehr als Wissenslücke abgetan.
    const { app, services, admin } = await aufbauen();
    const ko = await services.ko.create({
      title: "Flanschmontage an der Presse",
      statement: "Kurzfassung ohne das Zielwort.",
      type: "best_practice",
      category: "Wartung",
      author: "anna",
      bodyHtml: langerBody(ZIELWORT),
    });
    expect(await askKandidaten(services, FRAGE)).toEqual([ko.id]);

    const res = await app.inject({
      method: "POST",
      url: "/api/ask",
      headers: admin,
      payload: { question: FRAGE },
    });
    expect(res.statusCode, res.body).toBe(200);
    const body = res.json();
    expect(body.result.answered).toBe(true);
    expect(body.result.sources).toContain(ko.id);
    expect(body.gap).toBeNull();
  });
});
