// ================================================================================================
// JOB 3006 · KA5 SERVERHÄLFTE — DIE MARKIERUNG WIRD KONTEXT DER FRAGE
// ================================================================================================
//
// DAS NUTZERVERSPRECHEN, an dem hier gemessen wird: Wer im Word-Panel eine Stelle markiert und dann
// fragt, bekommt eine Antwort, die zu DIESER Stelle passt — nicht dieselbe wie ohne Markierung.
//
// WIE DER MESSAUFBAU DAS ZEIGT, OHNE ZU MOGELN. Der Bestand ist so gebaut, wie ein gewachsener
// Bestand wirklich aussieht: 50 gleich gute, validierte Treffer zum Thema und EIN Objekt, das
// genauer passt, aber im gedeckelten Vorfilter untergeht.
//
//   · Die 50 Füller tragen „Montage" und „Bremsleitung" im TITEL und „Kaltstart" als SCHLAGWORT.
//     Damit werden sie von JEDEM Frageterm gefunden (die Suche liest Schlagwörter mit), zählen aber
//     nur mit zwei Termen auf die Relevanz (das Relevanzmaß `refMatchText` liest Titel, Aussage,
//     Bild-Fußnoten und Fließtext — KEINE Schlagwörter). Sie füllen den Vorfilter.
//   · Objekt B trägt alle drei Frageterme im TEXT und ist deshalb das relevantere Objekt: vier
//     Fragetoken gegen zwei. Sein Trust ist niedriger (40 gegen 99), und über JEDEN der drei
//     Frageterme fällt es aus der je Term auf 50 Treffer gedeckelten Quellabfrage
//     (`ASK_PREFILTER_TERM_LIMIT`) auf Platz 51 — es erreicht die Antwortkette gar nicht erst. Das
//     ist der Befund aus JOB 531, nur diesmal von der anderen Seite: ein seltener, spezifischer
//     Begriff rettet den passenden Treffer.
//   · Genau diesen seltenen Begriff bringt die MARKIERUNG mit („Ölwannenschraube"). Er steht in
//     keiner Frage und in keinem Füller — nur in B und in der markierten Passage.
//
// WARUM „KALTSTART" BEI B IM FLIESSTEXT STEHT UND NICHT IM TITEL (JOB 3053, NACHGEFÜHRT). Bis dahin
// stand der Begriff in B's Titel, und das genügte, weil der Deckel seine 50 Plätze allein nach
// TRUST füllte. Seit `KoService.findCandidates` `deckelauswahl: "trefferguete"` anfordert,
// entscheidet im Deckel zuerst die FUNDSTELLE: ein Titeltreffer (Güte 4) schlägt ein Schlagwort
// (Güte 2). B überlebte den Deckel damit schon über den blossen Frageterm „Kaltstart" — die
// Markierung hätte nichts mehr zu entscheiden gehabt, und dieser Fall hätte eine Wirkung
// vorgeführt, die von der Markierung gar nicht kam. Der Fließtext ist die Fundstelle, die BEIDE
// Bedingungen erfüllt: Güte 0 (der Deckel wirft B weiter über jeden Frageterm hinaus), aber im
// Relevanztext enthalten (G27, `refMatchText`) — B bleibt also das relevantere Objekt, genau wie
// vorher. Am Fall selbst und an seinen Erwartungen ist nichts geändert.
//
// Ohne Markierung antwortet Klara also aus einem beliebigen der 50 gleich guten Füller; mit
// Markierung nennt sie B. Beide Antworten sind quellenbelegt — es entsteht keine Antwort aus dem
// Nichts, es wechselt nur die Fundstelle.
import Fastify from "fastify";
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../build-app";
import { askRoutes, klaraAusfuehrungRoutes } from "./ask-routes";

const FRAGE = "Wie ist die Montage der Bremsleitung beim Kaltstart?";
/** Die markierte Passage. „Ölwannenschraube" führt zu B, „Nachtfalter" steht NUR hier. */
const PASSAGE = "Beim Kaltstart der Baureihe Nachtfalter tropft es an der Ölwannenschraube.";
/** Eine Markierung ganz ohne Inhaltstoken — sie muss sich wie ein fehlendes Feld verhalten. */
const NUR_STOPPWOERTER = "und der die das ist es an";

type App = ReturnType<typeof buildApp>;

interface Aufbau {
  app: App;
  kopf: Record<string, string>;
  fueller: string[];
  b: string;
  /** R-0700: die echte Klara-Sitzung — die Markierung reist nur über Klaras eigenen Zugang. */
  sitzung: string;
  bindung: Record<string, string>;
}

async function aufbauen(): Promise<Aufbau> {
  const services = buildServices();
  const app = buildApp(services);
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Admin", email: "ka5@x.de", password: "secret123" },
  });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "ka5@x.de", password: "secret123" },
  });
  const kopf = { authorization: `Bearer ${login.json().token}` };

  const anlegen = async (
    title: string,
    statement: string,
    weiter: { tags?: string[]; bodyHtml?: string } = {},
  ): Promise<string> => {
    const res = await app.inject({
      method: "POST",
      url: "/api/kos",
      headers: kopf,
      payload: {
        confidentiality: "intern",
        title,
        statement,
        type: "best_practice",
        category: "KA5",
        tags: weiter.tags ?? [],
        ...(weiter.bodyHtml ? { bodyHtml: weiter.bodyHtml } : {}),
        neededValidations: 1,
      },
    });
    const id = res.json().id as string;
    await app.inject({
      method: "PUT",
      url: `/api/kos/${id}`,
      headers: kopf,
      payload: { action: "rate", verdict: "up" },
    });
    return id;
  };

  const fueller: string[] = [];
  for (let i = 0; i < 50; i += 1) {
    fueller.push(
      await anlegen(
        `Bremsleitung Montage Hinweis ${i}`,
        "Die Montage der Bremsleitung erfolgt nach Plan.",
        { tags: ["Kaltstart"] },
      ),
    );
  }
  const b = await anlegen(
    "Bremsleitung Montage",
    "Bei der Montage der Bremsleitung zuerst die Ölwannenschraube lösen.",
    { bodyHtml: "<p>Das gilt auch beim Kaltstart.</p>" },
  );
  // Der ECHTE Schreibweg der Bewertungslage (`KoService.setValidationState`) — kein Repo-Zugriff an
  // der Fachschicht vorbei. B bleibt validiert und sinkt nur im Trust unter die Füller.
  await services.ko.setValidationState(b, { trust: 40, status: "validiert" });
  // R-0700: die markierte Passage ist ein Klara-Feld und reist über Klaras eigenen Zugang. Die
  // Sitzung entsteht über die ECHTE Route; der Server vergibt Sitzungs- und Dokumentkennung.
  const sitzungsAntwort = await app.inject({
    method: "POST",
    url: "/api/klara/sessions",
    headers: { ...kopf, "x-klara-instance": "ka5-instanz" },
    payload: {
      addinInstanceId: "ka5-instanz",
      documentDescriptor: { kind: "saved", hostDocumentId: "ka5-dokument" },
    },
  });
  expect(sitzungsAntwort.statusCode, sitzungsAntwort.body).toBe(201);
  const sitzung = sitzungsAntwort.json().sessionId as string;
  const bindung = {
    "x-klara-session": sitzung,
    "x-klara-instance": "ka5-instanz",
    "x-klara-document": sitzungsAntwort.json().documentContextId as string,
  };
  return { app, kopf, fueller, b, sitzung, bindung };
}

const fragen = (a: Aufbau, extra: Record<string, unknown> = {}) =>
  a.app.inject({
    method: "POST",
    url: `/api/klara/sessions/${a.sitzung}/execute`,
    headers: { ...a.kopf, ...a.bindung, "content-type": "application/json" },
    payload: { question: FRAGE, locale: "de", questionSource: "manual", ...extra },
  });

/**
 * Der Antwortkörper OHNE die Felder, die von Natur aus je Lauf verschieden sind: `answerId` ist eine
 * frische Kennung, `receipt` eine Signatur über die Uhrzeit. Alles andere MUSS gleich bleiben.
 */
function stabil(koerper: Record<string, unknown>): Record<string, unknown> {
  const { answerId: _kennung, receipt: _beleg, ...rest } = koerper;
  return rest;
}

describe("KA5 · die Markierung schärft die Suche", () => {
  it("KA5-R1 · dieselbe Frage, andere Quelle — die Markierung entscheidet", async () => {
    const a = await aufbauen();

    const ohne = await fragen(a);
    expect(ohne.statusCode).toBe(200);
    const mit = await fragen(a, { selection: PASSAGE });
    expect(mit.statusCode).toBe(200);

    // Beide Antworten sind quellenbelegt — die Markierung erzeugt keine Antwort aus dem Nichts.
    expect(ohne.json().result.answered).toBe(true);
    expect(mit.json().result.answered).toBe(true);

    // OHNE Markierung ist B unerreichbar; einer der 50 gleich guten Füller trägt die Antwort.
    expect(ohne.json().result.sources).not.toContain(a.b);
    expect(a.fueller).toContain(ohne.json().result.sources[0]);

    // MIT Markierung trägt B — dasselbe Wort, das der Anwender markiert hat, hat ihn gefunden.
    expect(mit.json().result.sources).toContain(a.b);
    await a.app.close();
  });

  it("KA5-R2 · GEGENMUTATION: ohne das Feld bleibt der Antwortkörper derselbe", async () => {
    // Der Vergleichsstand entsteht IM TEST und nicht aus einer abgeschriebenen Notiz: dieselbe App,
    // derselbe Bestand, dieselbe Frage — einmal ganz ohne Feld, einmal mit einem Feld, das nach dem
    // Zerlegen leer bleibt (§5.6). Beide Körper müssen Zeichen für Zeichen zusammenfallen.
    const a = await aufbauen();
    const ohne = await fragen(a);
    const leer = await fragen(a, { selection: NUR_STOPPWOERTER });
    const wieder = await fragen(a);

    expect(ohne.statusCode).toBe(200);
    expect(leer.statusCode).toBe(200);
    expect(stabil(leer.json())).toEqual(stabil(ohne.json()));
    expect(stabil(wieder.json())).toEqual(stabil(ohne.json()));

    // Und der Körper hat KEIN neues Feld bekommen — die Markierung ist eine Eingabe, keine Ausgabe.
    expect(Object.keys(ohne.json()).sort()).toEqual(Object.keys(leer.json()).sort());
    expect(Object.keys(ohne.json())).not.toContain("selection");
    expect(JSON.stringify(leer.json()).toLowerCase()).not.toContain("stoppwort");
    await a.app.close();
  });

  it("KA5-R4 · die Hülle: eine zu lange Markierung fällt am SCHEMA, nicht im Handler", async () => {
    const a = await aufbauen();
    const gerade_noch = await fragen(a, { selection: "ö".repeat(8_000) });
    expect(gerade_noch.statusCode).toBe(200);
    const zu_lang = await fragen(a, { selection: "ö".repeat(8_001) });
    expect(zu_lang.statusCode).toBe(400);
    expect(zu_lang.json().message ?? "").toContain("selection");
    await a.app.close();
  });
});

// ================================================================================================
// KA5-R6 · DIE WEITERGABE IN ALLEN DREI ZWEIGEN — am Messpunkt Ask-Dienst.
// ================================================================================================
//
// Bauform wie `ka4-endzustand.test.ts`: der Ask-Dienst schreibt den Optionssatz mit und antwortet
// leer; die Route davor ist echt. Gemessen wird, was die Route WIRKLICH übergibt — nicht, was ein
// Kommentar über sie behauptet.
interface Messplatz {
  app: ReturnType<typeof Fastify>;
  gesehen: (Record<string, unknown> | null)[];
  /** Der ALLGEMEINE Frageweg `POST /api/ask` — er kennt die Markierung seit R-0700 nicht mehr. */
  fragen: (payload: Record<string, unknown>, addon?: boolean) => Promise<{ statusCode: number }>;
  /** R-0700: Klaras EIGENER Zugang, mit vollständiger Bindung (`KLARA_BINDUNG`). */
  klara: (payload: Record<string, unknown>, addon?: boolean) => Promise<{ statusCode: number }>;
  protokoll: string[];
}

/** Die drei Kopfzeilen, an denen der KA4-Riegel eine Klara-Bindung erkennt. */
const KLARA_BINDUNG = {
  "x-klara-session": "s-1",
  "x-klara-instance": "i-1",
  "x-klara-document": "d-1",
};

async function messplatz(freigebend = false): Promise<Messplatz> {
  const gesehen: (Record<string, unknown> | null)[] = [];
  const protokoll: string[] = [];
  const ask = {
    // D5 (KI aus): die Route prüft nach der Antwort erneut; bei eingeschalteter KI tut das nichts.
    kiStand: () => undefined,
    kiSperreVorFrage: () => undefined,
    kiSperreVorAuslieferung: () => undefined,
    ask: async (_q: string, _actor: string, _locale: string, opts?: Record<string, unknown>) => {
      gesehen.push(opts ?? null);
      return {
        result: {
          answered: false,
          knowledgeClass: "unbekannt",
          sources: [],
          citedSources: [],
          steps: [],
          answer: null,
          trust: 0,
        },
        gap: null,
      };
    },
  };
  const app = Fastify();
  // Der Add-on-Zweig hängt an `request.authContext` — dieselbe Form, die `build-app.ts:1466` setzt.
  app.decorateRequest("authContext", null);
  app.addHook("onRequest", async (request) => {
    if (request.headers["x-als-addon"] === "ja") {
      request.authContext = {
        authKind: "addon",
        principal: { kind: "addon", id: "addon-1", capabilities: ["ask.validated"] },
      };
    }
  });
  // JEDER Protokollruf wird mitgeschrieben — der Egress-Riegel gilt auch für das Logbuch.
  app.addHook("onRequest", async (request) => {
    const echt = request.log.info.bind(request.log);
    request.log.info = ((obj: unknown, msg?: string) => {
      protokoll.push(`${JSON.stringify(obj)} ${msg ?? ""}`);
      return echt(obj as never, msg as never);
    }) as typeof request.log.info;
  });
  const guards = {
    requireUser: async () => ({ id: "nutzer-1", role: "admin" }),
    requirePermission: async () => ({ id: "nutzer-1", role: "admin" }),
  } as never;
  const basis = {
    ask: ask as never,
    ko: { get: async () => undefined } as never,
    conflicts: { unresolved: async () => [] } as never,
  };
  app.register(askRoutes(basis, guards));
  app.register(
    klaraAusfuehrungRoutes(
      {
        ...basis,
        // Die Bindungsprüfung gelingt hier immer — sie ist Gegenstand von `ask-routes.test.ts`.
        // NUR für KA5-R6f: ein Prüfer, der freigibt. Ob eine Einwilligung WIRKLICH trägt, ist
        // Gegenstand von `ka4-endzustand.test.ts` und wird hier ausdrücklich nicht nachgespielt —
        // gemessen wird allein, ob die Route auch auf dem freigegebenen Weg die Markierung
        // weiterreicht. Ohne `freigebend` fehlt die Freigabeprüfung, und die Route ist fail-closed.
        klaraSessions: {
          pruefeBindung: async () => undefined,
          ...(freigebend ? { pruefeExterneAusfuehrung: async () => ({ erlaubt: true }) } : {}),
        } as never,
      },
      guards,
    ),
  );
  await app.ready();
  function anfrage(url: string, extraKopf: Record<string, string>) {
    return (payload: Record<string, unknown>, addon = false) =>
      app.inject({
        method: "POST",
        url,
        headers: {
          "content-type": "application/json",
          ...extraKopf,
          ...(addon ? { "x-als-addon": "ja" } : {}),
        },
        payload: { question: FRAGE, locale: "de", ...payload },
      });
  }
  const klaraZiel = `/api/klara/sessions/${KLARA_BINDUNG["x-klara-session"]}/execute`;
  return {
    app,
    gesehen,
    protokoll,
    fragen: anfrage("/api/ask", {}),
    klara: anfrage(klaraZiel, KLARA_BINDUNG),
  };
}

describe("KA5 · der Serververtrag der Markierung", () => {
  // R-0700: die Markierung ist ein KLARA-Feld. Sie reist über Klaras eigenen Zugang; der
  // allgemeine Frageweg nimmt sie nicht mehr an (KA5-R6a, unten).
  it("KA5-R6a · der allgemeine Frageweg weist die Markierung ab — der Dienst sieht sie nie", async () => {
    const m = await messplatz();
    const res = await m.fragen({ selection: PASSAGE });
    expect(res.statusCode).toBe(400);
    expect(m.gesehen).toEqual([]);
    await m.app.close();
  });

  it("KA5-R6b · Klaras Zugang ohne Freigabe: die Enge bleibt, die Markierung kommt dazu", async () => {
    const m = await messplatz();
    await m.klara({ selection: PASSAGE, questionSource: "manual" });
    expect(m.gesehen[0]).toEqual({
      validatedOnly: true,
      retrievalOnly: true,
      ungeprueftSichtbarFuer: expect.any(Function),
      verschlossenSichtbarFuer: expect.any(Function),
      selection: PASSAGE,
    });
    await m.app.close();
  });

  it("KA5-R6c · ein Add-on-Schlüssel erreicht Klaras Zugang nicht (403) — keine Weitergabe", async () => {
    const m = await messplatz();
    const res = await m.klara({ selection: PASSAGE }, true);
    expect(res.statusCode).toBe(403);
    expect(m.gesehen).toEqual([]);
    await m.app.close();
  });

  it("KA5-R6d · OHNE das Feld übergibt jeder Zweig byteweise den Optionssatz von vorher", async () => {
    const m = await messplatz();
    await m.fragen({});
    await m.fragen({ mode: "retrieval-only" });
    await m.fragen({}, true);
    // Eine leere/rein weiße Markierung ist keine Markierung (§5.6) — vierter Fall, gleiche Erwartung,
    // jetzt an Klaras Zugang (R-0700), wo die Markierung allein noch reisen darf.
    await m.klara({ selection: "   \n\t  " });
    // R-0278 (Nacharbeit 3, ben) und R-0584 (Auftrag gesamt-datenschutz-voreinstellung): auch die
    // Konsole antwortet nur aus geprüftem Wissen und meldet, was die Enge verschluckt.
    expect(m.gesehen[0]).toEqual({
      validatedOnly: true,
      ungeprueftSichtbarFuer: expect.any(Function),
      verschlossenSichtbarFuer: expect.any(Function),
    });
    expect(m.gesehen[1]).toEqual({
      validatedOnly: true,
      retrievalOnly: true,
      ungeprueftSichtbarFuer: expect.any(Function),
      verschlossenSichtbarFuer: expect.any(Function),
    });
    expect(m.gesehen[2]).toEqual({
      validatedOnly: true,
      gapPolicy: "count_only",
      retrievalOnly: true,
    });
    // Die zwei Sichtbarkeitsfilter sind je Anfrage eigene Verschlüsse — verglichen wird deshalb der
    // Vertrag, nicht die Funktionsidentität.
    expect(m.gesehen[3]).toEqual({
      validatedOnly: true,
      retrievalOnly: true,
      ungeprueftSichtbarFuer: expect.any(Function),
      verschlossenSichtbarFuer: expect.any(Function),
    });
    for (const satz of m.gesehen) {
      expect(satz !== null && "selection" in satz).toBe(false);
    }
    await m.app.close();
  });

  // ============================================================================================
  // KA5-R6f · DIE ZWEI ZWEIGE, DENEN MAN DIE WEITERGABE NICHT ANSIEHT.
  // ============================================================================================
  //
  // Seit die Markierung am EINEN Ausgang (`answer`) hängt und nicht an den Zweigen, steht an den
  // KA4-freigegebenen Aufrufen `answer(user.id)` bzw. `answer(id, { gapPolicy })` — die Markierung
  // ist dort nicht zu sehen. Genau deshalb wird sie hier gemessen: ein Zweig, dessen Weitergabe man
  // nicht lesen kann, muss man prüfen können. Ohne diesen Fall wäre der freigegebene Weg der
  // einzige, für den nur ein Kommentar spräche.
  it("KA5-R6f · auch der KA4-freigegebene Zweig reicht die Markierung weiter", async () => {
    const session = await messplatz(true);
    // R-0639 Runde 3 (Bens Befund B1): mit Klara-Bindung ist nur ausdrücklich `manual` getippt.
    await session.klara({ selection: PASSAGE, questionSource: "manual" });
    // Die Freigabe hebt `retrievalOnly` auf (KA4-Vertrag), `validatedOnly` bleibt (R-0278,
    // Nacharbeit 3) — und die Markierung bleibt trotzdem dabei.
    expect(session.gesehen[0]).toEqual({ validatedOnly: true, selection: PASSAGE });
    await session.app.close();

    // R-0700: der frühere Add-on-Zweig mit KA4-Freigabe ist fort — ein Add-on-Schlüssel ist kein
    // Sitzungsnutzer und erreicht Klaras Zugang nicht, auch nicht mit freigebendem Tor.
    const addon = await messplatz(true);
    const abgewiesen = await addon.klara({ selection: PASSAGE, questionSource: "manual" }, true);
    expect(abgewiesen.statusCode).toBe(403);
    expect(addon.gesehen).toEqual([]);
    await addon.app.close();

    // GEGENPROBE: ohne Markierung übergibt der freigegebene Zweig genau `validatedOnly` — keine
    // Markierung, keine weiteren Felder. Daran hängt `KA4-E1` (R-0278, Nacharbeit 3).
    const ohne = await messplatz(true);
    await ohne.klara({ questionSource: "manual" });
    expect(ohne.gesehen[0]).toEqual({ validatedOnly: true });
    await ohne.app.close();
  });

  it("KA5-R6e · DER PROTOKOLLRIEGEL: kein Protokolleintrag trägt die Passage", async () => {
    const m = await messplatz();
    // Klaras Zugang protokolliert die KA4-Entscheidung (`ask.ka4.dokument-consent`).
    await m.klara({ selection: PASSAGE });
    expect(m.protokoll.join(" | ").toLowerCase()).not.toContain("nachtfalter");
    expect(m.protokoll.join(" | ")).not.toContain(PASSAGE);
    await m.app.close();
  });
});
