// ================================================================================================
// G27 R1 — DER SICHTBARE GEMEINSAME WAHRHEITSWEG (Auftrag §E, KW-G27-R1-KOPF-AUSWERTUNG-07 §6)
// ================================================================================================
//
// WOZU DIESE DATEI DA IST. G27 R1 ist zum größten Teil interne Steuerung: Control-State,
// Generation, Gate, Recovery. Für einen Push-Kandidaten reicht das nicht — der Kopf hat deshalb
// GENAU EINEN sichtbaren Schnitt verlangt, und zwar an der bereits vorhandenen Produktstrecke:
//
//     Wissenseinheit ändern
//     → Bibliothek findet nur die aktuelle Wahrheit
//     → Klara/Ask verwendet dieselbe aktuelle Wahrheit
//     → alter Kategoriename liefert keinen veralteten Treffer
//
// WAS SIE AUSDRÜCKLICH NICHT TUT. Sie legt keine neue Oberfläche und keinen neuen Endpunkt an
// (Auftrag §E, letzter Absatz). Alles unten läuft über Wege, die es vorher schon gab:
// `POST /api/kos`, `PUT /api/kos/:id` (Aktion `category`), `GET /api/library/search` und
// `POST /api/ask`. Der Nutzen entsteht nicht durch neue Fläche, sondern dadurch, dass die
// vorhandene Fläche jetzt verlässlich den aktuellen Stand zeigt.
//
// WARUM DAS VOR DIESER WELLE NICHT GING, in zwei Sätzen. Erstens beantwortete eine frisch
// gestartete App überhaupt keine Suche, weil niemand die Projektion in Betrieb nahm (BENs ROT-1).
// Zweitens war „Bibliothek und Klara sehen dasselbe" bis G27 keine Zusage, sondern ein Zufall: die
// alte Kategorie blieb im `search_text` der Fassung 1 stehen und traf weiter, während die
// Metadatenprojektion längst den neuen Wert führte — genau der Mischbetrieb, den BEN reproduziert
// hat.
//
// GEMESSEN WIRD ÜBER `app.inject()`. Das löst `app.ready()` aus und damit die Startorchestrierung:
// es ist der echte äußere Weg, nicht ein nachgebauter.
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";

const ALT = "Altkategorie-Anlage7";
const NEU = "Neukategorie-Anlage9";

async function angemeldeteApp() {
  const services = buildServices();
  const app = buildApp(services);
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Admin", email: "a@x.de", password: "secret123" },
  });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "a@x.de", password: "secret123" },
  });
  return {
    app,
    services,
    headers: { authorization: `Bearer ${login.json().token}` },
  };
}

async function suche(
  app: Awaited<ReturnType<typeof angemeldeteApp>>["app"],
  headers: Record<string, string>,
  q: string,
) {
  const res = await app.inject({
    method: "GET",
    url: `/api/library/search?q=${encodeURIComponent(q)}`,
    headers,
  });
  expect(res.statusCode).toBe(200);
  return res.json() as { id: string; title: string; category?: string }[];
}

describe("G27 R1 · sichtbarer Wahrheitsweg · Bibliothek und Klara sehen DENSELBEN aktuellen Stand", () => {
  it("der ganze Weg in einem Zug: alte Kategorie auffindbar → Änderung → nur noch die neue Wahrheit", async () => {
    const { app, services, headers } = await angemeldeteApp();

    // ------------------------------------------------------------------------------------------
    // 1 — Eine Wissenseinheit ist mit ALTER Kategorie auffindbar.
    // ------------------------------------------------------------------------------------------
    const angelegt = await app.inject({
      method: "POST",
      url: "/api/kos",
      headers,
      payload: {
        title: "Überdruckventil prüfen",
        statement: "Bei Überdruck Ventil X schließen.",
        type: "best_practice",
        category: ALT,
      },
    });
    expect(angelegt.statusCode).toBe(201);
    const id = angelegt.json().id as string;

    // Die App ist beim Start fachlich in Betrieb gegangen — ohne das wäre schon diese Zeile ein
    // `SEARCH_PROJECTION_NOT_READY` und nicht eine Trefferliste.
    expect((await services.ko.searchProjectionControl()).projectionState).toBe("V2_ACTIVE");
    expect((await suche(app, headers, ALT)).map((t) => t.id)).toEqual([id]);

    // ------------------------------------------------------------------------------------------
    // 2 — Eine REGULÄRE Änderung erzeugt die aktuelle Wahrheit. Kein Rebuild, kein Admin-Eingriff,
    //     kein Neustart: die gewöhnliche Kategorieänderung aus der Oberfläche.
    // ------------------------------------------------------------------------------------------
    const geaendert = await app.inject({
      method: "PUT",
      url: `/api/kos/${id}`,
      headers,
      payload: { action: "category", category: NEU },
    });
    expect(geaendert.statusCode).toBe(200);
    expect(geaendert.json().category).toBe(NEU);

    // ------------------------------------------------------------------------------------------
    // 3 — Die Bibliothek findet NUR den neuen Stand.
    // ------------------------------------------------------------------------------------------
    const nachNeu = await suche(app, headers, NEU);
    expect(nachNeu.map((t) => t.id)).toEqual([id]);

    // ------------------------------------------------------------------------------------------
    // 5 — Der ALTE Kategoriename liefert keinen veralteten Treffer. (Punkt 5 steht hier, weil er
    //     die Kehrseite von Punkt 3 ist und dieselbe Messung teilt.)
    //
    //     DAS IST BENS BEFUND, WÖRTLICH UMGEDREHT: vor G27 traf `AltkategorieXYZ` weiter, weil der
    //     Wert im `search_text` der Fassung 1 klebte. Eine leere Liste ist hier die richtige
    //     Antwort — und sie ist eine FACHLICHE Leermenge, kein verdeckter Ausfall: dass die Suche
    //     verfügbar ist, hat Punkt 3 unmittelbar davor bewiesen.
    // ------------------------------------------------------------------------------------------
    expect(await suche(app, headers, ALT)).toEqual([]);

    // ------------------------------------------------------------------------------------------
    // 4 — Klara/Ask verwendet DIESELBE neue Wahrheit.
    //
    //     Nicht „eine ähnliche" — dieselbe: `AskService.ask` gelangt AUSSCHLIESSLICH über
    //     `findCandidates` an durchsuchbaren Text, und `findCandidates` ist derselbe
    //     `findSearchHits`-Vertrag, den `LibraryService.search` benutzt. Es gibt keinen zweiten Weg.
    //
    //     GEMESSEN WIRD DESHALB DIESER VERTRAG und nicht der zitierte Quellensatz der fertigen
    //     Antwort. Das ist Absicht und keine Abschwächung: ob der deterministische Reasoner ein
    //     unvalidiertes Objekt zitiert, entscheidet die Antwortpolitik von Ask — eine Regel, die
    //     diese Welle ausdrücklich NICHT anfasst (Ask-/Reasoner-Produktlogik ist ausserhalb des
    //     Auftrags). Würde hier auf `result.sources` geprüft, misse die Zusicherung die
    //     Wahrheitsquelle und hinge stattdessen an einer fremden, unbeteiligten Regel.
    // ------------------------------------------------------------------------------------------
    const klaraNeu = await services.ko.findCandidates({ terms: [NEU.toLowerCase()], limit: 50 });
    expect(klaraNeu.map((k) => k.id)).toEqual([id]);
    // Derselbe Stand wie in der Bibliothek — Punkt für Punkt und nicht nur „auch ein Treffer".
    expect(klaraNeu[0]?.category).toBe(NEU);

    // Und mit dem ALTEN Namen zieht Klara das Objekt nicht mehr heran.
    expect(await services.ko.findCandidates({ terms: [ALT.toLowerCase()], limit: 50 })).toEqual([]);

    // Der äußere Klara-Weg bleibt dabei bedienbar (200, kein Ausfall durch die Fassungsgrenze).
    const klara = await app.inject({
      method: "POST",
      url: "/api/ask",
      headers,
      payload: { question: `Was gilt in ${NEU}?` },
    });
    expect(klara.statusCode).toBe(200);

    // ------------------------------------------------------------------------------------------
    // 6 — Quelle/Referenz und äußerer Treffervertrag bleiben sichtbar und UNVERÄNDERT.
    //
    //     Die Zusicherung, die verhindert, dass „aktuelle Wahrheit" durch eine stillschweigende
    //     Vertragsänderung erkauft wurde: der Treffer trägt weiter Kennung, Titel und Kategorie,
    //     und das Detail ist über denselben Weg erreichbar wie vorher.
    // ------------------------------------------------------------------------------------------
    const treffer = nachNeu[0] as { id: string; title: string; category?: string };
    expect(treffer.id).toBe(id);
    expect(treffer.title).toBe("Überdruckventil prüfen");
    expect(treffer.category).toBe(NEU);
    const detail = await app.inject({ method: "GET", url: `/api/kos/${id}`, headers });
    expect(detail.statusCode).toBe(200);
    expect(detail.json().category).toBe(NEU);

    await app.close();
  });

  it("die Volltextsuche bleibt über die Änderung hinweg dieselbe — die Wahrheit wandert, der Weg nicht", async () => {
    // Gegenprobe zur Kategoriemessung: ein Begriff aus der Kernaussage muss VOR und NACH der
    // Änderung treffen. Ohne sie könnte „alte Kategorie trifft nicht mehr" auch bedeuten, dass das
    // Objekt insgesamt aus dem Index gefallen ist — das wäre kein Fortschritt, sondern ein Verlust.
    const { app, headers } = await angemeldeteApp();
    const angelegt = await app.inject({
      method: "POST",
      url: "/api/kos",
      headers,
      payload: {
        title: "Überdruckventil prüfen",
        statement: "Bei Überdruck Ventil X schließen.",
        type: "best_practice",
        category: ALT,
      },
    });
    const id = angelegt.json().id as string;
    expect((await suche(app, headers, "überdruck")).map((t) => t.id)).toEqual([id]);

    await app.inject({
      method: "PUT",
      url: `/api/kos/${id}`,
      headers,
      payload: { action: "category", category: NEU },
    });
    expect((await suche(app, headers, "überdruck")).map((t) => t.id)).toEqual([id]);
    await app.close();
  });

  it("ist die Suche NICHT verfügbar, sagt der äußere Weg das — und leakt dabei keinen Zustand", async () => {
    // Die dritte Seite desselben Versprechens (Entscheidung 07 §1 und §4): eine leere Liste heißt
    // „nichts gefunden" und NIE „nicht verfügbar". Wird die Instanz nach der Freigabe beschädigt,
    // antwortet der reale Suchweg mit einem Fehler — nicht mit `[]` — und der Fehlerkörper trägt
    // weder den technischen Code noch einen Control-State-Namen nach außen.
    const { app, services, headers } = await angemeldeteApp();
    const angelegt = await app.inject({
      method: "POST",
      url: "/api/kos",
      headers,
      payload: {
        title: "Überdruckventil prüfen",
        statement: "Bei Überdruck Ventil X schließen.",
        type: "best_practice",
        category: ALT,
      },
    });
    expect(angelegt.statusCode).toBe(201);
    expect((await suche(app, headers, "überdruck")).length).toBe(1);

    // Der Bestand wird ausser Betrieb genommen — der ausdrückliche Fehlerpfad, kein Handanlegen.
    await services.ko.rollbackSearchProjectionVersion("Gegenprobe äußerer Fehlerweg");

    // BEIDE realen äußeren Wege, nicht nur einer. Sie sind verschieden gebaut — die Bibliothek
    // ruft `LibraryService.search`, Klara `AskService.ask` über `findCandidates` —, laufen aber
    // beide OHNE `try` und damit über den globalen Fastify-Fehlerbehandler (`modelBusyErrorHandler`).
    // Genau dort sitzt die Maskierung; würde sie nur an einer Route sitzen, wäre die andere offen.
    const wege = [
      await app.inject({ method: "GET", url: "/api/library/search?q=überdruck", headers }),
      await app.inject({
        method: "POST",
        url: "/api/ask",
        headers,
        payload: { question: "Was tun bei Überdruck?" },
      }),
    ];
    for (const res of wege) {
      // KEINE 200 mit leerer Liste — das wäre die Lüge, die Entscheidung 04 §4 verbietet.
      expect(res.statusCode).toBe(500);
      expect(res.json()).toEqual({ error: "INTERNAL", message: "Unerwarteter Fehler." });
      // Der technische Code, die Zustandsmeldung und jeder Control-State-Name bleiben drinnen
      // (Entscheidung 07 §4). Geprüft wird der ROHE Körper, damit kein Zusatzfeld unbemerkt
      // mitreist.
      expect(res.payload).not.toContain("SEARCH_PROJECTION_NOT_READY");
      expect(res.payload).not.toContain("Projektion");
      for (const zustand of ["UNINITIALIZED", "V2_BUILDING", "V2_READY", "V2_ACTIVE", "FAILED"]) {
        expect(res.payload).not.toContain(zustand);
      }
    }
    await app.close();
  });
});
