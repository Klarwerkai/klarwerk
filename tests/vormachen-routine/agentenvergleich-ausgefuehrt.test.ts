// ================================================================================================
// produkt:20261011:peter-p06 · P06-AC08 — AUSGEFÜHRTER AGENTENVERGLEICH GEGEN BASELINE.
// ================================================================================================
//
// Bens Befund zu Nacharbeit 2: die Baseline war nur gerechnet, der Routineweg erzeugte kein
// Arbeitsergebnis. Hier erledigt EIN deterministischer Agent (dieses Skript, kein Modell) DIESELBEN
// fiktiven Aufgaben auf zwei Wegen TATSÄCHLICH über die echten Arbeitswege der Anwendung
// (`buildApp(buildServices())`, `app.inject`), je Weg in einer eigenen, frischen Anwendung:
//
//   BASELINE   je Aufgabe: Entwurf anlegen → Kategorie nachtragen und speichern → zur Prüfung
//              einreichen. Den Ablauf plant der Agent je Aufgabe selbst (Planungsangaben gezählt).
//   ROUTINE    Einrichtung: Lernsitzung starten, Aufgabe 1 über dieselben Wege VORMACHEN (der
//              Server schreibt mit), Vorschau lesen, EINEN Schritt korrigieren, Vorschau erneut
//              lesen, bestätigen. Aufgaben 2…n: die Routine lesen und Schritt für Schritt ausführen —
//              je Schritt die Freigabe holen (Außenschritt: Ausführung anfordern und bestätigen),
//              dann den Arbeitsweg selbst aufrufen.
//
// Danach PRÜFT der Agent jedes Ergebnis (`GET /api/kos/:id`) und der Test vergleicht die Ergebnisse
// beider Wege Feld für Feld. Erfasst werden getrennt: Einrichtung, Korrektur, Arbeit, Freigaben,
// Prüfung und Planung — als Aufrufe und als Zeichen der formulierten Angaben. Behauptet wird KEIN
// Sieger; die Tabelle steht im Testlauf. Keine Humanstudie, keine echten Anwenderdaten; der
// KI-Prüfjob ist ein stiller Zähler.
//
// GRENZE (Ben zu Nacharbeit 4): Planung und Korrektur sind hier vorgegebene Skriptschritte. Der
// Vergleich mit den vorgesehenen PoC-MODELLAGENTEN (Claude, ChatGPT) ist NICHT Teil dieser Datei;
// er braucht einen beauftragten Modelllauf über den Betreiberweg und bleibt bis dahin offen.
import { describe, expect, it } from "vitest";
import type { AiCheckWorker } from "../../services/app/src/ai-check-worker";
import { buildApp, buildServices } from "../../services/app/src/build-app";

type App = ReturnType<typeof buildApp>;
type Methode = "GET" | "POST" | "PUT";

interface Aufwand {
  aufrufe: number;
  zeichen: number;
}

type Posten = "einrichtung" | "korrektur" | "arbeit" | "freigaben" | "pruefung" | "planung";

type Bilanz = Record<Posten, Aufwand>;

interface VorschauDraht {
  vorschau: { stand: string; schritte: { beschreibung: string }[] };
}

interface RoutineDraht {
  id: string;
  schritte: { id: string; vorgang: string; beschreibung: string; aussenwirkung: boolean }[];
}

const leer = (): Bilanz => ({
  einrichtung: { aufrufe: 0, zeichen: 0 },
  korrektur: { aufrufe: 0, zeichen: 0 },
  arbeit: { aufrufe: 0, zeichen: 0 },
  freigaben: { aufrufe: 0, zeichen: 0 },
  pruefung: { aufrufe: 0, zeichen: 0 },
  planung: { aufrufe: 0, zeichen: 0 },
});

const WEB = "http://localhost/erfassen";

/** Die fiktiven Aufgaben — für beide Wege dieselben. */
const AUFGABEN = [
  { titel: "Angebot Musterfirma A", aussage: "Rabatt nur ab 10 Stück gewähren." },
  { titel: "Angebot Musterfirma B", aussage: "Lieferzeit stets mit dem Lager abstimmen." },
  { titel: "Angebot Musterfirma C", aussage: "Zahlungsziel 30 Tage netto angeben." },
] as const;
type Aufgabe = (typeof AUFGABEN)[number];

/** Der Ablauf, den der Agent in der Baseline je Aufgabe selbst planen muss. */
const PLAN = [
  "Entwurf mit Titel, Aussage, Art und Vertraulichkeit anlegen",
  "Kategorie Vertrieb nachtragen und speichern",
  "Entwurf zur Prüfung einreichen",
];

/** Was der Server aus dem Vormachen der ersten Aufgabe als Schritte ableitet. */
const BESCHRIEBEN = [
  "Entwurf anlegen: Art „best_practice“, Vertraulichkeit „intern“, Titel, Aussage, Inhalt",
  "Entwurf speichern (Entwurf aus Schritt 1): Kategorie „Vertrieb“",
  "Entwurf zur Prüfung einreichen (Entwurf aus Schritt 1)",
] as const;

function stillerPruefjob(): AiCheckWorker {
  return {
    enqueue: () => undefined,
    has: () => false,
    laeuft: () => false,
    queuedCount: () => 0,
    idle: async () => undefined,
  };
}

interface Buehne {
  app: App;
  token: string;
}

async function buehne(): Promise<Buehne> {
  const services = buildServices();
  services.aiCheckWorker = stillerPruefjob();
  const app = buildApp(services);
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Ada Agentin", email: "ada@agentenvergleich.test", password: "secret123" },
  });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "ada@agentenvergleich.test", password: "secret123" },
  });
  return { app, token: (login.json() as { token: string }).token };
}

/** Ein Aufruf des Agenten — gezählt auf genau einen Posten. */
async function rufe(
  b: Buehne,
  bilanz: Bilanz,
  posten: Posten,
  methode: Methode,
  url: string,
  payload?: Record<string, unknown>,
): Promise<{ status: number; json: unknown }> {
  bilanz[posten].aufrufe += 1;
  bilanz[posten].zeichen += payload === undefined ? 0 : JSON.stringify(payload).length;
  const r = await b.app.inject({
    method: methode,
    url,
    headers: { authorization: `Bearer ${b.token}`, referer: WEB },
    ...(payload === undefined ? {} : { payload }),
  });
  return { status: r.statusCode, json: r.body === "" ? null : r.json() };
}

let vorgang = 0;

/** Die drei Arbeitsschritte selbst — in beiden Wegen dieselben Aufrufe mit denselben Angaben. */
const ARBEIT = {
  async entwurf_anlegen(b: Buehne, bilanz: Bilanz, a: Aufgabe, stand: { id: string }) {
    const r = await rufe(b, bilanz, "arbeit", "POST", "/api/drafts", {
      title: a.titel,
      statement: a.aussage,
      type: "best_practice",
      confidentiality: "intern",
      bodyHtml: `<p>${a.aussage}</p>`,
    });
    expect(r.status).toBe(201);
    stand.id = (r.json as { id: string }).id;
  },
  async entwurf_speichern(b: Buehne, bilanz: Bilanz, _a: Aufgabe, stand: { id: string }) {
    const r = await rufe(b, bilanz, "arbeit", "PUT", `/api/drafts/${stand.id}`, {
      category: "Vertrieb",
    });
    expect(r.status).toBe(200);
  },
  async zur_pruefung_einreichen(b: Buehne, bilanz: Bilanz, _a: Aufgabe, stand: { id: string }) {
    vorgang += 1;
    const operationId = `agentenvergleich-${String(vorgang).padStart(4, "0")}`;
    const r = await rufe(b, bilanz, "arbeit", "POST", `/api/drafts/${stand.id}/promote`, {
      operationId,
    });
    expect(r.status).toBe(201);
    stand.id = (r.json as { id: string }).id;
  },
} as const;
type Schritt = keyof typeof ARBEIT;
const REIHENFOLGE: readonly Schritt[] = [
  "entwurf_anlegen",
  "entwurf_speichern",
  "zur_pruefung_einreichen",
];

/** Das geprüfte Ergebnis einer Aufgabe — die Felder, die beide Wege gleich liefern müssen. */
async function pruefe(b: Buehne, bilanz: Bilanz, koId: string) {
  const r = await rufe(b, bilanz, "pruefung", "GET", `/api/kos/${koId}`);
  expect(r.status).toBe(200);
  const ko = r.json as Record<string, unknown>;
  return {
    title: ko.title,
    statement: ko.statement,
    category: ko.category,
    type: ko.type,
    confidentiality: ko.confidentiality,
    status: ko.status,
  };
}

const summe = (bilanz: Bilanz): Aufwand =>
  Object.values(bilanz).reduce(
    (s, x) => ({ aufrufe: s.aufrufe + x.aufrufe, zeichen: s.zeichen + x.zeichen }),
    { aufrufe: 0, zeichen: 0 },
  );

describe("P06-AC08 · ausgeführter Agentenvergleich derselben Aufgabe gegen Baseline", () => {
  it("beide Wege erledigen dieselben Aufgaben; Ergebnisse gleich; Aufwand samt Korrektur erfasst", async () => {
    // ---- BASELINE ------------------------------------------------------------------------------
    const base = await buehne();
    const baseBilanz = leer();
    const baseErgebnisse = [];
    for (const a of AUFGABEN) {
      baseBilanz.planung.aufrufe += 1;
      baseBilanz.planung.zeichen += JSON.stringify(PLAN).length;
      const stand = { id: "" };
      for (const schritt of REIHENFOLGE) {
        await ARBEIT[schritt](base, baseBilanz, a, stand);
      }
      baseErgebnisse.push(await pruefe(base, baseBilanz, stand.id));
    }

    // ---- ROUTINE: Einrichtung durch Vormachen der ersten Aufgabe -------------------------------
    const rout = await buehne();
    const routBilanz = leer();
    const routErgebnisse = [];
    const start = await rufe(rout, routBilanz, "einrichtung", "POST", "/api/me/vormachen", {
      host: "klarwerk_web",
      vorgaenge: [...REIHENFOLGE],
      zweck: "Angebotsnotiz anlegen, Kategorie nachtragen, einreichen",
    });
    expect(start.status).toBe(201);
    const sitzung = (start.json as { sitzung: { id: string } }).sitzung.id;
    // Die sichtbare Lernanzeige dieses Clients meldet sich — wie `VormachenAnzeige`. Sie ist die
    // Bedingung des Mitschreibens, keine Angabe des Agenten, und wird deshalb nicht gezählt.
    const anzeige = await rout.app.inject({
      method: "GET",
      url: "/api/me/vormachen?anzeige=klarwerk_web",
      headers: { authorization: `Bearer ${rout.token}` },
    });
    expect((anzeige.json() as { sichtbar: boolean }).sichtbar).toBe(true);
    // Vormachen ist echte Arbeit an Aufgabe 1 — derselbe Plan, dieselben Aufrufe.
    routBilanz.planung.aufrufe += 1;
    routBilanz.planung.zeichen += JSON.stringify(PLAN).length;
    const erste = { id: "" };
    for (const schritt of REIHENFOLGE) {
      await ARBEIT[schritt](rout, routBilanz, AUFGABEN[0], erste);
    }
    routErgebnisse.push(await pruefe(rout, routBilanz, erste.id));
    const vorschauUrl = `/api/me/vormachen/${sitzung}/vorschau`;
    const v1 = await rufe(rout, routBilanz, "einrichtung", "GET", vorschauUrl);
    const schritte1 = (v1.json as VorschauDraht).vorschau.schritte;
    // Die Beschreibungen leitet der SERVER aus dem Vorgemachten ab — auch, WAS gespeichert wurde
    // (Kategorie „Vertrieb") und WORAN (Entwurf aus Schritt 1). Niemand setzt sie von Hand ein.
    expect(schritte1.map((x) => x.beschreibung)).toEqual([...BESCHRIEBEN]);
    // Die Korrektur: der Agent benennt in Schritt 1 den Zweck des Entwurfs.
    const korr = await rufe(
      rout,
      routBilanz,
      "korrektur",
      "PUT",
      `/api/me/vormachen/${sitzung}/korrektur`,
      { nr: 1, beschreibung: `Angebotsnotiz als ${BESCHRIEBEN[0]}` },
    );
    expect(korr.status).toBe(200);
    const v2 = await rufe(rout, routBilanz, "korrektur", "GET", vorschauUrl);
    const stand = (v2.json as VorschauDraht).vorschau.stand;
    const best = await rufe(
      rout,
      routBilanz,
      "einrichtung",
      "POST",
      `/api/me/vormachen/${sitzung}/bestaetigung`,
      { stand },
    );
    expect(best.status).toBe(201);
    const routineId = (best.json as { routine: { id: string } }).routine.id;

    // ---- ROUTINE: Aufgaben 2…n, geführt von der bestätigten Routine -----------------------------
    for (const a of AUFGABEN.slice(1)) {
      const liste = await rufe(rout, routBilanz, "planung", "GET", "/api/me/vormachen");
      const routine = (liste.json as { routinen: RoutineDraht[] }).routinen.find(
        (r) => r.id === routineId,
      );
      expect(routine?.schritte[1]?.beschreibung).toBe(BESCHRIEBEN[1]);
      const aufgabeStand = { id: "" };
      for (const schritt of routine?.schritte ?? []) {
        const url = `/api/me/vormachen/routinen/${routineId}/schritte/${schritt.id}/freigabe`;
        const anfrage = await rufe(rout, routBilanz, "freigaben", "POST", url, {});
        if (schritt.aussenwirkung) {
          // Außenschritt: genau diese Ausführung anfordern und bestätigen.
          expect(anfrage.status).toBe(409);
          const kennung = (anfrage.json as { ausfuehrung: { id: string } }).ausfuehrung.id;
          const ok = await rufe(rout, routBilanz, "freigaben", "POST", url, {
            bestaetigung: { ausfuehrung: kennung },
          });
          expect(ok.status).toBe(200);
        } else {
          expect(anfrage.status).toBe(200);
        }
        await ARBEIT[schritt.vorgang as Schritt](rout, routBilanz, a, aufgabeStand);
      }
      routErgebnisse.push(await pruefe(rout, routBilanz, aufgabeStand.id));
    }

    // ---- Vergleich -----------------------------------------------------------------------------
    // Vergleichbare Ergebnisse: dieselbe Aufgabe ergibt auf beiden Wegen dasselbe Wissensobjekt.
    expect(routErgebnisse).toEqual(baseErgebnisse);
    for (const e of baseErgebnisse) {
      expect(e).toMatchObject({ category: "Vertrieb", status: "offen" });
    }

    console.log(
      JSON.stringify(
        {
          kriterium: "P06-AC08",
          art: "AUSGEFÜHRT: deterministischer Agent über echte Arbeitswege, fiktive Daten, keine Humanstudie",
          aufgaben: AUFGABEN.length,
          baseline: { ...baseBilanz, gesamt: summe(baseBilanz) },
          routine: { ...routBilanz, gesamt: summe(routBilanz) },
        },
        null,
        2,
      ),
    );

    // Erfasst ist jeder Posten, den der Befund verlangt — Einrichtung, Prüfung und Korrektur.
    expect(routBilanz.einrichtung.aufrufe).toBe(3);
    expect(routBilanz.korrektur.aufrufe).toBe(2);
    expect(routBilanz.pruefung.aufrufe).toBe(AUFGABEN.length);
    expect(baseBilanz.pruefung.aufrufe).toBe(AUFGABEN.length);
    // Dieselbe Arbeit auf beiden Wegen: gleich viele Arbeitsaufrufe mit gleichen Angaben.
    expect(routBilanz.arbeit).toEqual(baseBilanz.arbeit);
    // Je geführter Aufgabe: drei Freigaben plus die Bestätigung des einen Außenschritts.
    expect(routBilanz.freigaben.aufrufe).toBe((AUFGABEN.length - 1) * 4);
    expect(baseBilanz.freigaben.aufrufe).toBe(0);
  });
});
