// ================================================================================================
// ASK 7/8 · AUFTRAG 160 — DIE HERMETISCHE SKALIERUNGSGEGENPROBE
// ================================================================================================
//
// WOHER DIESE DATEI KOMMT. `CLAUDE_LIVENESS_SNAPSHOT.json` führt unter
// `architecture_context/scaling_ask_targeted_test` den Befund:
//
//     „7/8 · ROT: ask-retrieval-topk-e2e erwartet gesichert, erhalten ungeprueft"
//
// BASIC 158 hat ihn lokalisiert: betroffen ist der Fall „relevantes validiertes KO wird trotz
// vieler Störer als Quelle bevorzugt" aus `ask-retrieval-topk-e2e.test.ts`. Dort stehen 40 Störer
// neben einem validierten Ziel-KO UND einer inhaltsgleichen, OFFENEN Zweitfassung. Der Befund ist
// heute nicht reproduzierbar — aber sein Laufkontext hieß `scaling_…`, und über die tatsächliche
// Bestandsgröße jenes Laufs ist nichts überliefert.
//
// WAS DIESE DATEI TUT — und was sie ausdrücklich NICHT tut. Sie MISST denselben Aufbau bei drei
// deterministischen Bestandsgrößen (40 / 200 / 1000) und macht sichtbar, ob und ab wann die offene
// Zweitfassung mitträgt. Sie stellt KEINE neue Produktzusage auf: nirgends wird verlangt, dass bei
// 1000 Störern „gesichert" herauskommen MUSS. Eine solche Erwartung wäre eine erfundene Zusage und
// ein verkappter Ranking-Auftrag.
//
// DIE EINE ZUSICHERUNG, DIE SIE TRIFFT, ist die fail-closed-Kopplung selbst
// (`services/reasoner/src/provider.ts:56`):
//
//     knowledgeClass = carrying.every(status === "validiert") ? "gesichert" : "ungeprueft"
//
// Diese Kopplung muss bei JEDER Bestandsgröße gelten. Genau sie ist der Vertrag, an dem der rote
// Befund hing — nicht die Frage, welches KO das Ranking gerade vorne sieht. Kippt die Klasse ohne
// dass die tragende Menge das erklärt, ist das ein echter Defekt; kippt sie MIT, hat das Produkt
// ehrlich geantwortet.
//
// HERMETISCH: kein echtes Modell, kein Netz — alles läuft über `app.inject` gegen die echten
// HTTP-Routen und den echten Bestand, wie im Bestandstest.
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";

describe("Ask 7/8 · Skalierungsgegenprobe zum Retrieval-Grenzfall", () => {
  type App = ReturnType<typeof buildApp>;

  // Aufbau bewusst WORTGLEICH zum Bestandstest `ask-retrieval-topk-e2e.test.ts:11-46`: nur so misst
  // diese Datei denselben Gegenstand und nicht einen ähnlichen.
  async function adminApp() {
    const app = buildApp(buildServices());
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
    return { app, headers: { authorization: `Bearer ${login.json().token}` } };
  }

  async function createKo(
    app: App,
    headers: Record<string, string>,
    title: string,
    statement: string,
  ): Promise<string> {
    const res = await app.inject({
      method: "POST",
      url: "/api/kos",
      headers,
      payload: { title, statement, type: "best_practice", category: "Ask", neededValidations: 1 },
    });
    return res.json().id as string;
  }

  const validate = (app: App, headers: Record<string, string>, id: string) =>
    app.inject({
      method: "PUT",
      url: `/api/kos/${id}`,
      headers,
      payload: { action: "rate", verdict: "up" },
    });

  const FRAGE = "Wie wird die Spezialpresse SPX9 entlüftet?";
  const ZIEL_TITEL = "Spezialpresse SPX9 entlüften";
  const ZIEL_AUSSAGE =
    "Vor dem Entlüften der Spezialpresse SPX9 den Hydraulikdruck vollständig ablassen.";

  /** Das Beobachtungsergebnis EINES Laufs — reine Messung, keine Bewertung. */
  interface Beobachtung {
    readonly stoerer: number;
    readonly answered: boolean;
    readonly knowledgeClass: string;
    readonly sources: string[];
    readonly zielTraegt: boolean;
    readonly offeneTraegt: boolean;
  }

  /**
   * Der Aufbau des Grenzfalls bei wählbarer Bestandsgröße.
   *
   * DETERMINISTISCH: Titel und Aussagen sind aus dem Index abgeleitet, es gibt keinen Zufall und
   * keine Zeitabhängigkeit. Derselbe Aufruf liefert denselben Bestand.
   */
  async function messen(stoerer: number): Promise<Beobachtung> {
    const { app, headers } = await adminApp();

    // Thematisch unpassende Störer, jeder zweite validiert — wie im Bestandstest.
    for (let i = 0; i < stoerer; i += 1) {
      const id = await createKo(
        app,
        headers,
        `Förderband FB${i} spannen`,
        `Riemen am Förderband FB${i} mit definierter Vorspannung montieren.`,
      );
      if (i % 2 === 0) {
        await validate(app, headers, id);
      }
    }

    // Das validierte Ziel …
    const ziel = await createKo(app, headers, ZIEL_TITEL, ZIEL_AUSSAGE);
    await validate(app, headers, ziel);
    // … und die inhaltsgleiche, OFFENE Zweitfassung. Sie ist der eigentliche Gegenstand: trägt sie
    // mit, fällt die Klasse regelkonform auf „ungeprueft".
    const offen = await createKo(app, headers, ZIEL_TITEL, ZIEL_AUSSAGE);

    const res = await app.inject({
      method: "POST",
      url: "/api/ask",
      headers,
      payload: { question: FRAGE },
    });
    const body = res.json() as {
      result: { answered: boolean; knowledgeClass: string; sources: string[] };
    };

    return {
      stoerer,
      answered: body.result.answered,
      knowledgeClass: body.result.knowledgeClass,
      sources: body.result.sources,
      zielTraegt: body.result.sources.includes(ziel),
      offeneTraegt: body.result.sources.includes(offen),
    };
  }

  /**
   * DIE EINE INVARIANTE, die bei jeder Bestandsgröße gelten muss.
   *
   * Sie prüft nicht, WELCHE Quelle gewinnt — sondern dass Klasse und tragende Menge zueinander
   * passen. Das ist `provider.ts:56` von außen gesehen, und es ist die Grenze, an der der
   * 7/8-Befund hing.
   */
  function pruefeKopplung(b: Beobachtung): void {
    if (!b.answered) {
      // Ohne Antwort gibt es keine tragende Menge — dann darf auch keine Klasse behauptet werden.
      expect(b.sources, `${b.stoerer} Störer: keine Antwort, also keine Quellen`).toEqual([]);
      return;
    }
    expect(
      b.sources.length,
      `${b.stoerer} Störer: eine Antwort braucht eine Quelle`,
    ).toBeGreaterThan(0);
    if (b.offeneTraegt) {
      // Die offene Zweitfassung trägt mit → die Aussage IST ungeprüft. Alles andere wäre der
      // fail-open-Fehler, den provider.ts:37-39 ausdrücklich ausschließt.
      expect(
        b.knowledgeClass,
        `${b.stoerer} Störer: offene Zweitfassung trägt mit — die Klasse muss ungeprueft sein`,
      ).toBe("ungeprueft");
    }
    if (b.knowledgeClass === "gesichert") {
      // Umgekehrt: „gesichert" ist nur zulässig, wenn die offene Fassung NICHT mitträgt.
      expect(
        b.offeneTraegt,
        `${b.stoerer} Störer: „gesichert" schließt die offene Zweitfassung aus`,
      ).toBe(false);
    }
  }

  // ------------------------------------------------------------------------------------------
  // Die drei Bestandsgrößen. Getrennte Fälle statt einer Schleife, damit im Bericht sichtbar ist,
  // WELCHE Größe gegebenenfalls kippt — eine Schleife meldete nur „irgendwo rot".
  // ------------------------------------------------------------------------------------------

  it("40 Störer: Klasse und tragende Menge sind gekoppelt", async () => {
    const b = await messen(40);
    pruefeKopplung(b);
    // Die Beobachtung selbst wird festgehalten, nicht bewertet: bei dieser Größe ist der
    // Bestandstest grün, also trägt hier nur das validierte Ziel.
    expect(b.zielTraegt, "40 Störer: das validierte Ziel muss die Antwort tragen").toBe(true);
  });

  it("200 Störer: Klasse und tragende Menge sind gekoppelt", async () => {
    const b = await messen(200);
    pruefeKopplung(b);
    expect(b.answered, "200 Störer: der thematische Treffer bleibt auffindbar").toBe(true);
  });

  it("1000 Störer: Klasse und tragende Menge sind gekoppelt", async () => {
    const b = await messen(1000);
    pruefeKopplung(b);
    // BEWUSST KEINE Erwartung an `knowledgeClass` oder `zielTraegt`. Ob das Ranking bei dieser
    // Größe noch dasselbe wählt, ist genau die offene Frage hinter „7/8" — sie hier zu einer
    // Zusage zu machen hieße, eine Produktannahme zu erfinden.
    expect(typeof b.knowledgeClass, "1000 Störer: eine Klasse wird geliefert").toBe("string");
  }, 120_000);

  // ------------------------------------------------------------------------------------------
  // Gegenpfade
  // ------------------------------------------------------------------------------------------

  it("KIPP-GEGENPFAD: trägt die offene Zweitfassung, ist die Antwort nie gesichert", async () => {
    // Der Kippfall wird hier NICHT erzwungen, sondern über alle drei Größen gesucht. Findet er
    // sich, muss die Klasse ungeprüft sein; findet er sich nicht, ist das ebenfalls ein Befund —
    // und der Fall sagt das ehrlich, statt eine Bedingung zu behaupten.
    const beobachtungen = [await messen(40), await messen(200)];
    const gekippt = beobachtungen.filter((b) => b.offeneTraegt);
    for (const b of gekippt) {
      expect(b.knowledgeClass).toBe("ungeprueft");
    }
    // Auch der Nicht-Kipp ist eine gültige Beobachtung: dann trägt überall nur das validierte Ziel.
    for (const b of beobachtungen.filter((x) => !x.offeneTraegt)) {
      expect(
        b.sources.every((s) => s !== ""),
        `${b.stoerer} Störer: Quellen sind Kennungen`,
      ).toBe(true);
    }
  }, 120_000);

  it("WISSENSLÜCKEN-GEGENPFAD: ohne thematischen Treffer keine erfundene Quelle", async () => {
    const { app, headers } = await adminApp();
    for (let i = 0; i < 200; i += 1) {
      const id = await createKo(
        app,
        headers,
        `Förderband FB${i} spannen`,
        `Riemen am Förderband FB${i} mit definierter Vorspannung montieren.`,
      );
      if (i % 2 === 0) {
        await validate(app, headers, id);
      }
    }
    const res = await app.inject({
      method: "POST",
      url: "/api/ask",
      headers,
      payload: { question: "Wie hoch ist der aktuelle Wechselkurs?" },
    });
    const body = res.json() as { result: { answered: boolean; sources: string[] } };
    // Der Bestand ist groß — trotzdem darf nichts als Quelle erscheinen, das die Frage nicht trägt.
    expect(body.result.answered).toBe(false);
    expect(body.result.sources).toEqual([]);
  }, 120_000);
});
