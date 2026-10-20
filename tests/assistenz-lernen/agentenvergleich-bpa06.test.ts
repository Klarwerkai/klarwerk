// ================================================================================================
// produkt:20261011:assistenz-lernen-hostfortsetzung · BPA-06-AC10 — AGENTENVERGLEICH (AUSGEFÜHRT).
// ================================================================================================
//
// Ergänzt den ausgeführten P06-Vergleich
// (`tests/vormachen-routine/agentenvergleich-ausgefuehrt.test.ts`, Schritt-für-Schritt-Freigaben
// einer Routine) um den BPA-06-Weg: die bestätigte Routine LÄUFT mit den Eingaben dieses Laufs
// (`POST …/routinen/:id/lauf`) über den Aktionskern.
//
// EIN deterministischer Agent (dieses Skript, kein Modell) erledigt DIESELBEN drei fiktiven
// Berichte auf zwei Wegen TATSÄCHLICH über die echten Arbeitswege (`buildApp(buildServices())`,
// `app.inject`), je Weg in einer eigenen, frischen Anwendung:
//
//   BISHER   je Bericht: Ablauf planen, Entwurf mit allen Angaben anlegen.
//   BPA-06   Einrichten: Lernsitzung, einmal vormachen, Vorschau, bestätigen, Gespräch beginnen.
//            Je Bericht: Lauf mit Titel und Kernaussage, Auftrag ausführen.
//
// Getrennt erfasst (Aufrufe und Zeichen der vom Agenten formulierten Angaben):
//   einrichtung · arbeit · korrektur (ein falscher Wert wird nachträglich berichtigt) ·
//   wiederholung (dieselbe Anfrage nach einem Abbruch noch einmal) · fehlersuche (eine abgelehnte
//   Anfrage lesen, Ursache beheben, erneut) · pruefung (jedes Ergebnis nachlesen).
//
// Behauptet wird KEIN Sieger; die Tabelle steht im Testlauf. Ausgewiesen wird getrennt:
//   · SIMULATION: der Agent ist ein Skript; Planung und Korrektur sind vorgegebene Schritte.
//   · TATSÄCHLICHE WIRKUNG: echte Entwürfe an der echten Anwendung (In-Memory), nachgelesen.
//   · MENSCHLICHER NUTZEN: NICHT gemessen — keine Humanstudie, keine echten Anwenderdaten.
// Der Vergleich mit den PoC-Modellagenten (Claude, ChatGPT) braucht einen beauftragten Modelllauf
// über den Betreiberweg und ist nicht Teil dieser Datei.
import { describe, expect, it } from "vitest";
import type { AiCheckWorker } from "../../services/app/src/ai-check-worker";
import { buildApp, buildServices } from "../../services/app/src/build-app";

type App = ReturnType<typeof buildApp>;
type Methode = "GET" | "POST" | "PUT";
type Posten = "einrichtung" | "arbeit" | "korrektur" | "wiederholung" | "fehlersuche" | "pruefung";
type Bilanz = Record<Posten, { aufrufe: number; zeichen: number }>;

const leer = (): Bilanz => ({
  einrichtung: { aufrufe: 0, zeichen: 0 },
  arbeit: { aufrufe: 0, zeichen: 0 },
  korrektur: { aufrufe: 0, zeichen: 0 },
  wiederholung: { aufrufe: 0, zeichen: 0 },
  fehlersuche: { aufrufe: 0, zeichen: 0 },
  pruefung: { aufrufe: 0, zeichen: 0 },
});

const WEB = "http://localhost/erfassen";
const BERICHTE = [
  { titel: "Wochenbericht KW41", inhalt: "Umsatz stabil" },
  { titel: "Wochenbericht KW42", inhalt: "Umsatz gestiegen" },
  { titel: "Wochenbericht KW43", inhalt: "Umsatz gehalten" },
] as const;
/** Bericht 2 wird zuerst mit diesem falschen Wert angelegt und danach berichtigt. */
const FALSCH = "Umsatz gesunken";
const ORDNUNG = { type: "best_practice", category: "Vertrieb", confidentiality: "intern" };
const PLAN = "Entwurf anlegen: Titel, Kernaussage, Art, Kategorie, Vertraulichkeit, Inhalt setzen";
const BELEGART =
  "Simulation (Skriptagent) mit tatsächlicher Wirkung an der Anwendung; menschlicher Nutzen nicht gemessen.";

interface Buehne {
  app: App;
  token: string;
}

function stillerPruefjob(): AiCheckWorker {
  return {
    enqueue: () => undefined,
    has: () => false,
    laeuft: () => false,
    queuedCount: () => 0,
    idle: async () => undefined,
  };
}

async function buehne(): Promise<Buehne> {
  const services = buildServices();
  services.aiCheckWorker = stillerPruefjob();
  const app = buildApp(services);
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Ada Agentin", email: "ada@bpa06-vergleich.test", password: "secret123" },
  });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "ada@bpa06-vergleich.test", password: "secret123" },
  });
  return { app, token: (login.json() as { token: string }).token };
}

/** Ein Aufruf des Agenten — gezählt auf genau einen Posten mit den Zeichen seiner Angaben. */
async function rufe(
  b: Buehne,
  bilanz: Bilanz,
  posten: Posten,
  methode: Methode,
  url: string,
  payload?: Record<string, unknown>,
) {
  bilanz[posten].aufrufe += 1;
  bilanz[posten].zeichen += payload ? JSON.stringify(payload).length : 0;
  const r = await b.app.inject({
    method: methode,
    url,
    headers: { authorization: `Bearer ${b.token}`, referer: WEB },
    ...(payload ? { payload } : {}),
  });
  return { status: r.statusCode, daten: r.body ? (r.json() as Record<string, unknown>) : {} };
}

/** Planung des Agenten — ohne Aufruf, nur die formulierten Zeichen. */
function plane(bilanz: Bilanz, posten: Posten, text: string): void {
  bilanz[posten].zeichen += text.length;
}

type Ergebnis = { titel: string; inhalt: string };

async function lies(b: Buehne, bilanz: Bilanz, id: string): Promise<Ergebnis> {
  const r = await rufe(b, bilanz, "pruefung", "GET", `/api/drafts/${encodeURIComponent(id)}`);
  expect(r.status).toBe(200);
  const p = (r.daten as { payload: { title?: string; statement?: string } }).payload;
  return { titel: p.title ?? "", inhalt: p.statement ?? "" };
}

/** BISHER: je Bericht planen und den Entwurf mit allen Angaben anlegen. */
async function bisher(): Promise<{ bilanz: Bilanz; ergebnisse: Ergebnis[] }> {
  const b = await buehne();
  const bilanz = leer();
  const ids: string[] = [];
  for (const [i, bericht] of BERICHTE.entries()) {
    plane(bilanz, "arbeit", PLAN);
    const inhalt = i === 1 ? FALSCH : bericht.inhalt;
    const payload = {
      title: bericht.titel,
      statement: inhalt,
      ...ORDNUNG,
      bodyHtml: `<p>${inhalt}</p>`,
      operationId: `bisher-${i + 1}-bericht`,
    };
    // Fehlersuche: der erste Versuch mit einer unbekannten Vertraulichkeitsstufe wird am Rand
    // abgewiesen; der Agent liest den Grund und berichtigt die Angabe.
    if (i === 0) {
      const falsch = { ...payload, confidentiality: "unbekannte-stufe" };
      const abgewiesen = await rufe(b, bilanz, "fehlersuche", "POST", "/api/drafts", falsch);
      expect(abgewiesen.status).toBe(400);
      plane(bilanz, "fehlersuche", String(abgewiesen.daten.message ?? ""));
    }
    const r = await rufe(b, bilanz, "arbeit", "POST", "/api/drafts", payload);
    expect(r.status, JSON.stringify(r.daten)).toBeLessThan(300);
    ids.push(String(r.daten.id));
    // Wiederholung: dieselbe Anfrage nach einem Abbruch noch einmal.
    if (i === 2) {
      const wieder = await rufe(b, bilanz, "wiederholung", "POST", "/api/drafts", payload);
      expect(wieder.status).toBeLessThan(500);
    }
  }
  const korrigiert = await rufe(b, bilanz, "korrektur", "PUT", `/api/drafts/${ids[1]}`, {
    statement: BERICHTE[1].inhalt,
  });
  expect(korrigiert.status).toBe(200);
  const ergebnisse: Ergebnis[] = [];
  for (const id of ids) {
    ergebnisse.push(await lies(b, bilanz, id));
  }
  return { bilanz, ergebnisse };
}

/** BPA-06: einmal einrichten, dann je Bericht ein Lauf über den Aktionskern. */
async function bpa06(): Promise<{ bilanz: Bilanz; ergebnisse: Ergebnis[]; doppelt: boolean }> {
  const b = await buehne();
  const bilanz = leer();
  const start = await rufe(b, bilanz, "einrichtung", "POST", "/api/me/vormachen", {
    host: "klarwerk_web",
    vorgaenge: ["entwurf_anlegen"],
    zweck: "Wochenbericht vorbereiten",
  });
  expect(start.status).toBe(201);
  const sitzung = (start.daten as { sitzung: { id: string } }).sitzung.id;
  await rufe(b, bilanz, "einrichtung", "GET", "/api/me/vormachen?anzeige=klarwerk_web");
  const demo = await rufe(b, bilanz, "einrichtung", "POST", "/api/drafts", {
    title: "Wochenbericht KW40",
    statement: "Umsatz unverändert",
    ...ORDNUNG,
    bodyHtml: "<p>Vorführung</p>",
  });
  expect(demo.status).toBe(201);
  const sitzungPfad = `/api/me/vormachen/${sitzung}`;
  const vorschau = await rufe(b, bilanz, "einrichtung", "GET", `${sitzungPfad}/vorschau`);
  const stand = (vorschau.daten as { vorschau: { stand: string } }).vorschau.stand;
  const bestaetigung = `${sitzungPfad}/bestaetigung`;
  const bestaetigt = await rufe(b, bilanz, "einrichtung", "POST", bestaetigung, { stand });
  expect(bestaetigt.status).toBe(201);
  const routine = (bestaetigt.daten as { routine: { id: string; fassung: number } }).routine;
  const g = await rufe(b, bilanz, "einrichtung", "POST", "/api/me/klara/gespraeche", {
    objektbezug: { pfad: "/profil", seitenName: "Profil", objekt: "Wochenbericht" },
  });
  const gespraech = (g.daten as { gespraech: { id: string } }).gespraech.id;
  const laufPfad = `/api/me/vormachen/routinen/${routine.id}/lauf`;

  const ids: string[] = [];
  let doppelt = false;
  for (const [i, bericht] of BERICHTE.entries()) {
    const inhalt = i === 1 ? FALSCH : bericht.inhalt;
    const rumpf = {
      gespraech,
      lauf: `bpa06-${i + 1}`,
      fassung: routine.fassung,
      eingaben: { titel: bericht.titel, inhalt },
    };
    // Fehlersuche: die Routine ist pausiert; der Agent liest den Grund, setzt fort, erneut.
    if (i === 0) {
      const zustand = `/api/me/vormachen/routinen/${routine.id}/zustand`;
      await rufe(b, bilanz, "fehlersuche", "PUT", zustand, { zustand: "pausiert" });
      const gesperrt = await rufe(b, bilanz, "fehlersuche", "POST", laufPfad, rumpf);
      expect(gesperrt.status).toBe(409);
      plane(bilanz, "fehlersuche", String(gesperrt.daten.message ?? ""));
      await rufe(b, bilanz, "fehlersuche", "PUT", zustand, { zustand: "aktiv" });
    }
    const lauf = await rufe(b, bilanz, "arbeit", "POST", laufPfad, rumpf);
    expect(lauf.status, JSON.stringify(lauf.daten)).toBe(201);
    const auftrag = (lauf.daten as { auftrag: { id: string; fassung: number } }).auftrag;
    // Wiederholung: dieselbe Laufanfrage nach einem Abbruch — derselbe Auftrag, nichts doppelt.
    if (i === 2) {
      const wieder = await rufe(b, bilanz, "wiederholung", "POST", laufPfad, rumpf);
      const zweiter = (wieder.daten as { auftrag: { id: string } }).auftrag.id;
      doppelt = wieder.status !== 200 || zweiter !== auftrag.id;
    }
    const auftraege = `/api/me/klara/gespraeche/${gespraech}/auftraege`;
    const schritt = `${auftraege}/${auftrag.id}/schritte/bericht-1`;
    const aus = await rufe(b, bilanz, "arbeit", "POST", `${schritt}/ausfuehrung`, {
      nr: 1,
      auftragFassung: auftrag.fassung,
    });
    expect(aus.status).toBe(200);
    const ausgefuehrt = aus.daten as { schritt: { ergebnis: { id: string } | null } };
    ids.push(ausgefuehrt.schritt.ergebnis?.id ?? "");
  }
  const korrigiert = await rufe(b, bilanz, "korrektur", "PUT", `/api/drafts/${ids[1]}`, {
    statement: BERICHTE[1].inhalt,
  });
  expect(korrigiert.status).toBe(200);
  const ergebnisse: Ergebnis[] = [];
  for (const id of ids) {
    ergebnisse.push(await lies(b, bilanz, id));
  }
  return { bilanz, ergebnisse, doppelt };
}

describe("BPA-06-AC10 · ausgeführter Agentenvergleich: bisheriger Weg gegen Routinenlauf", () => {
  it("beide Wege liefern dieselben Berichte; Aufwand je Posten getrennt erfasst", async () => {
    const a = await bisher();
    const r = await bpa06();
    // Tatsächliche Wirkung: dieselben Titel und Kernaussagen auf beiden Wegen, nachgelesen.
    expect(r.ergebnisse.map((e) => e.titel)).toEqual(a.ergebnisse.map((e) => e.titel));
    for (const [i, e] of r.ergebnisse.entries()) {
      expect(e.inhalt).toContain(BERICHTE[i]?.inhalt ?? "");
      expect(a.ergebnisse[i]?.inhalt).toContain(BERICHTE[i]?.inhalt ?? "");
    }
    // Wiederholung: der Routinenlauf legt nichts doppelt an.
    expect(r.doppelt).toBe(false);
    // Jeder Posten ist tatsächlich gemessen, nicht angenommen. Der bisherige Weg HAT keine
    // Einrichtung — dort ist genau 0 der Messwert; die Einrichtung fällt nur beim Routinenlauf an.
    expect(a.bilanz.einrichtung).toEqual({ aufrufe: 0, zeichen: 0 });
    for (const posten of Object.keys(a.bilanz) as Posten[]) {
      if (posten !== "einrichtung") {
        expect(a.bilanz[posten].aufrufe, `bisher ${posten}`).toBeGreaterThan(0);
      }
      expect(r.bilanz[posten].aufrufe, `bpa06 ${posten}`).toBeGreaterThan(0);
    }
    const tabelle = (Object.keys(a.bilanz) as Posten[]).map((posten) => ({
      posten,
      bisherAufrufe: a.bilanz[posten].aufrufe,
      bisherZeichen: a.bilanz[posten].zeichen,
      bpa06Aufrufe: r.bilanz[posten].aufrufe,
      bpa06Zeichen: r.bilanz[posten].zeichen,
    }));
    console.table(tabelle);
    console.info(BELEGART);
  });
});
