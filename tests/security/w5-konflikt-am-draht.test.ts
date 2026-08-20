// ================================================================================================
// JOB 1157 D1 · W5 — DER KONFLIKTZUSTAND AM DRAHT.
// ================================================================================================
//
// Die Deckung gab es einmal (JOB 547, `tests/security/w5-konflikt-am-draht.test.ts`); sie fehlt im
// Produkt. Dieser Durchgang baut sie neu — gegen das heutige Verhalten.
//
// GEMESSENER PRODUKTSTAND (Base 3a980881, alle Fundstellen in diesem Durchgang gelesen):
//   Regel       services/ask/src/answer-evidence.ts:192-193  (`sourcesConflicted`)
//               services/ask/src/answer-evidence.ts:128      (`conflictsUnproven`)
//   Beschaffung services/app/src/routes/ask-routes.ts:184-221 (`evidenceFor`)
//   Ausgang     services/app/src/routes/ask-routes.ts:281     (200, `result.evidence`)
//
// WAS HIER GEMESSEN WIRD: was WIRKLICH ueber den Draht geht, wenn eine tragende Quelle in einem
// offenen Konflikt steht. Gestalt der Antwort, Status, Felder — an der echten Route ueber
// `app.inject()`, nicht am Modul. Ein Modultest waere gruen, waehrend die Route das Feld gar
// nicht mitschickt; genau diese Luecke schliesst eine Deckung „am Draht".
//
// ------------------------------------------------------------------------------------------------
// WAS HIER AUSDRUECKLICH NICHT GEMESSEN UND NICHT FESTGELEGT WIRD.
// ------------------------------------------------------------------------------------------------
//
// JOB 547 D4 wurde ROT, weil die Rueckgabe SELBST einen additiven Konfliktvertrag und eine
// dreistufige `AnswerGrade`-Semantik festlegte — eine Owner-, keine Bahnentscheidung. Diese Datei
// deckt deshalb ausschliesslich ab, was IST:
//
//   · KEIN Konfliktvertrag, keine Additivitaets- oder Vorrangregel.
//   · KEINE `AnswerGrade`-Semantik. Der Grad wird nur dort gemessen, wo die heutige Regel ihn
//     nachweislich schon bestimmt — nicht als Sollwert gesetzt.
//   · KEINE Aussage zu OF1, zu Export-/Kopierpfaden oder zur A11y-Gesamtabnahme.
//
// Was mir dabei als ungeklaert aufgefallen ist, steht als offene Ownerfrage in der Rueckgabe.
import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";

type App = ReturnType<typeof buildApp>;

// Ein Wort, das nur im Testbestand vorkommt. Es bindet die Antwort beweisbar an GENAU dieses
// Objekt — ohne einen echten Treffer traege nichts die Antwort, und `sourcesConflicted` koennte
// gar nicht wahr werden.
const SELTENES_WORT = "Querstromventilhaube";

interface Aufbau {
  app: App;
  autor: { authorization: string };
  koTragend: string;
  koPartner: string;
}

async function aufbau(mail: string): Promise<Aufbau> {
  const app = buildApp(buildServices());
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Admin", email: mail, password: "geheim12345" },
  });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: mail, password: "geheim12345" },
  });
  expect(login.statusCode, login.body).toBe(200);
  const autor = { authorization: `Bearer ${login.json().token}` };

  const anlegen = async (titel: string, aussage: string): Promise<string> => {
    const res = await app.inject({
      method: "POST",
      url: "/api/kos",
      headers: autor,
      payload: { title: titel, statement: aussage, type: "best_practice", category: "Anlage 1" },
    });
    expect(res.statusCode, res.body).toBe(201);
    const id = res.json().id as string;
    // Validiert, weil erst dann `knowledgeClass` „gesichert" traegt — nur an einem gesicherten
    // Stand wird ueberhaupt sichtbar, dass ein Konflikt etwas begrenzt. An einem ohnehin
    // ungeprueften Stand liesse sich Wirkung von Ausgangslage nicht unterscheiden.
    const val = await app.inject({
      method: "PUT",
      url: `/api/kos/${id}`,
      headers: autor,
      payload: { action: "admin-validate" },
    });
    expect(val.statusCode, val.body).toBe(200);
    return id;
  };

  const koTragend = await anlegen(
    `Wartung ${SELTENES_WORT}`,
    `Die ${SELTENES_WORT} wird vor jeder Wartung entlastet.`,
  );
  const koPartner = await anlegen(
    `Gegenanweisung ${SELTENES_WORT}`,
    `Die ${SELTENES_WORT} bleibt waehrend der Wartung unter Druck.`,
  );
  return { app, autor, koTragend, koPartner };
}

async function fragen(a: Aufbau): Promise<{ status: number; body: string; json: () => unknown }> {
  const res = await a.app.inject({
    method: "POST",
    url: "/api/ask",
    headers: a.autor,
    // Stichwortartig, wie die vorhandenen Draht-Tests dieses Repos fragen: die deterministische
    // Auswahl wiegt Treffer gegen Fragelaenge, Fuellwoerter verduennen sie.
    payload: { question: `${SELTENES_WORT} Wartung entlasten` },
  });
  return { status: res.statusCode, body: res.body, json: () => res.json() };
}

interface Evidenz {
  grade: string;
  knowledgeClass: string;
  rawKnowledgeClass: string;
  checkCaveat: { reason: string; unproven: number; total: number } | null;
  sourcesConflicted: boolean;
  conflictsUnproven: boolean;
}

function evidenz(antwort: { json: () => unknown }): Evidenz {
  const body = antwort.json() as { result?: { evidence?: Evidenz } };
  expect(
    body.result?.evidence,
    "Die Antwort traegt keinen Evidenzzustand — dann geht der Konfliktzustand gar nicht ueber den Draht",
  ).toBeDefined();
  return body.result?.evidence as Evidenz;
}

function tragendeQuellen(antwort: { json: () => unknown }): string[] {
  const body = antwort.json() as { result?: { citedSources?: string[] } };
  return body.result?.citedSources ?? [];
}

/** Legt einen OFFENEN Konflikt zwischen zwei Objekten an — ueber den echten KO-Dispatcher. */
async function konfliktAnlegen(a: Aufbau): Promise<void> {
  const res = await a.app.inject({
    method: "PUT",
    url: `/api/kos/${a.koTragend}`,
    headers: a.autor,
    payload: {
      action: "conflict",
      conflict: {
        koA: a.koTragend,
        koB: a.koPartner,
        type: "truth",
        description: `Widerspruch zur ${SELTENES_WORT}`,
      },
    },
  });
  expect(res.statusCode, res.body).toBe(201);
  expect(res.json().status, "Nur ein OFFENER Konflikt zaehlt fuer die Regel").toBe("offen");
}

// ------------------------------------------------------------------------------------------------
// D2 · DIE OFFENE OBJEKTGESTALT — und warum die geschlossene hier ein Vertragsbruch war.
// ------------------------------------------------------------------------------------------------
//
// D1 pruefte `Object.keys(e).sort()` gegen eine feste Sechserliste. BEN hat das als Verstoss
// gewertet, und zwar zu Recht: „Eine exakte Key-Menge ist ohne Ownervertrag verboten; ein
// zusaetzliches semantikneutrales Feld muss gruen bleiben." Eine geschlossene Menge macht jede
// additive Implementierungsaenderung zum Fehler — sie legt einen Vertrag fest, den niemand
// entschieden hat, und genau daran ist JOB 547 D4 gescheitert.
//
// Dieser Pruefer verlangt deshalb nur, was die Sache WIRKLICH braucht: dass die erforderlichen
// Felder da sind, den richtigen Typ tragen und — wo der Fall es weiss — den richtigen Wert.
// Was darueber hinaus im Objekt steht, geht ihn nichts an.
//
// Er ist bewusst eine reine Funktion und keine Zusicherungskette im Fall selbst: nur so laesst
// sich unten BEIDES zeigen — dass er zusaetzliche Felder durchlaesst (OFFENHEIT) und dass er
// ueberhaupt zubeissen kann (KALIBRIERUNG). Ohne die Kalibrierung waere die Offenheitsprobe auch
// dann gruen, wenn dieser Pruefer gar nichts pruefte.

/** Der Typ, den ein Feld tragen muss. `"objekt-oder-null"` deckt `checkCaveat`. */
type Feldtyp = "boolean" | "string" | "objekt-oder-null";

/**
 * Die fachlich ERFORDERLICHEN Felder des Evidenzzustands — Name und Typ.
 *
 * „Erforderlich" heisst: ohne sie kann der Client den Konfliktzustand nicht ehrlich darstellen.
 * Diese Liste ist eine UNTERgrenze, keine Obergrenze.
 */
const ERFORDERLICH: Record<string, Feldtyp> = {
  // Der Gegenstand dieser Deckung: traegt eine tragende Quelle einen offenen Konflikt?
  sourcesConflicted: "boolean",
  // Die Unterscheidung „keine Konflikte" gegen „Konfliktlage nicht feststellbar". Ohne sie wuerde
  // ein gescheiterter Abruf wie Konfliktfreiheit aussehen.
  conflictsUnproven: "boolean",
  // Der Grad und die Wissensklasse reisen mit; ohne sie hat der Hinweis keinen Bezugsrahmen.
  grade: "string",
  knowledgeClass: "string",
  rawKnowledgeClass: "string",
  // Der Pruefvorbehalt ist ein eigener Zustand und darf ausdruecklich `null` sein.
  checkCaveat: "objekt-oder-null",
};

function typPasst(wert: unknown, typ: Feldtyp): boolean {
  if (typ === "objekt-oder-null") {
    return wert === null || (typeof wert === "object" && !Array.isArray(wert));
  }
  // Bewusst gegen LITERALE verglichen statt `typeof wert === typ`: ein `typeof`-Vergleich gegen
  // eine Variable ist nicht pruefbar (Biome `useValidTypeof`) — ein Tippfehler im Typnamen bliebe
  // dort still, und der Pruefer waere fuer dieses Feld faktisch abgeschaltet.
  if (typ === "boolean") {
    return typeof wert === "boolean";
  }
  return typeof wert === "string";
}

/**
 * Prueft die erforderlichen Felder mit Typ und — falls angegeben — Wert.
 *
 * KEIN Vergleich der Schluesselmenge. Zusaetzliche Felder sind erlaubt und werden nicht einmal
 * angesehen. Wirft mit benennender Meldung, wenn etwas Erforderliches fehlt, den falschen Typ
 * traegt oder einen ausdruecklich erwarteten Wert verfehlt.
 */
function pruefeOffeneGestalt(
  roh: unknown,
  erwarteteWerte: Partial<Record<keyof typeof ERFORDERLICH, unknown>> = {},
): void {
  if (roh === null || typeof roh !== "object") {
    throw new Error(`Der Evidenzzustand ist kein Objekt: ${JSON.stringify(roh)}`);
  }
  const e = roh as Record<string, unknown>;
  for (const [name, typ] of Object.entries(ERFORDERLICH)) {
    if (!(name in e)) {
      throw new Error(`Erforderliches Evidenzfeld fehlt am Draht: "${name}"`);
    }
    if (!typPasst(e[name], typ)) {
      throw new Error(
        `Evidenzfeld "${name}" traegt den falschen Typ: erwartet ${typ}, gemessen ${
          e[name] === null ? "null" : typeof e[name]
        }`,
      );
    }
  }
  for (const [name, soll] of Object.entries(erwarteteWerte)) {
    if (e[name] !== soll) {
      throw new Error(
        `Evidenzfeld "${name}" traegt ${JSON.stringify(e[name])}, erwartet ${JSON.stringify(soll)}`,
      );
    }
  }
}

describe("JOB1157 W5 · der Konfliktzustand geht ueber den Draht", () => {
  it("AUSGANGSLAGE: ohne Konflikt traegt die Antwort den Zustand mit dem Wert false", async () => {
    const a = await aufbau("w5a@job1157.test");
    const antwort = await fragen(a);
    expect(antwort.status, antwort.body).toBe(200);

    // Ohne diesen Nachweis misst alles Weitere ins Leere: die Antwort muss wirklich auf dem
    // Objekt stehen, das gleich in den Konflikt geraet.
    expect(
      tragendeQuellen(antwort),
      "Die Frage traegt nicht auf dem Testobjekt — dann kann kein Konflikt sie je begrenzen",
    ).toContain(a.koTragend);

    const e = evidenz(antwort);
    expect(e.sourcesConflicted).toBe(false);
    // Der Abruf der Konfliktlage ist gelungen. `false` heisst hier belegt „keine offenen
    // Konflikte", nicht „nichts gefunden" — die Unterscheidung ist der Kern des zweiten Feldes.
    expect(e.conflictsUnproven).toBe(false);
  });

  it("DER FALL: eine tragende Quelle im offenen Konflikt setzt sourcesConflicted am Draht", async () => {
    const a = await aufbau("w5b@job1157.test");
    await konfliktAnlegen(a);

    const antwort = await fragen(a);
    expect(antwort.status, antwort.body).toBe(200);
    expect(tragendeQuellen(antwort)).toContain(a.koTragend);

    const e = evidenz(antwort);
    expect(
      e.sourcesConflicted,
      "Eine tragende Quelle steht in einem offenen Konflikt — das muss beim Client ankommen",
    ).toBe(true);
    expect(e.conflictsUnproven).toBe(false);
  });

  it("GESTALT: HTTP-Status und die erforderlichen Felder tragen mit Wert und Typ", async () => {
    const a = await aufbau("w5c@job1157.test");
    await konfliktAnlegen(a);
    const antwort = await fragen(a);

    // Der Status gehoert zur Gestalt am Draht: eine 500 mit passendem Koerper waere keine Antwort.
    expect(antwort.status, antwort.body).toBe(200);

    const e = evidenz(antwort);
    // Erforderliche Felder, Typen — und die beiden Werte, die dieser Fall wirklich kennt.
    // KEIN Vergleich der Schluesselmenge: was sonst noch im Objekt steht, ist nicht mein Vertrag.
    expect(() =>
      pruefeOffeneGestalt(e, { sourcesConflicted: true, conflictsUnproven: false }),
    ).not.toThrow();
  });

  it("OFFENHEIT: ein zusaetzliches, semantikneutrales Feld macht die Deckung NICHT rot", async () => {
    const a = await aufbau("w5e@job1157.test");
    await konfliktAnlegen(a);
    const antwort = await fragen(a);
    const e = evidenz(antwort) as unknown as Record<string, unknown>;

    // Genau BENs Prueflueckenfall 2: „dieselbe Konfliktantwort mit einem harmlosen zusaetzlichen
    // Evidence-Feld … der Test bleibt gruen". Hier an der ECHTEN Antwort simuliert, damit die
    // Zusicherung auch dann traegt, wenn niemand das Produkt anfasst — die Gegenprobe am Produkt
    // selbst steht zusaetzlich in der Rueckgabe.
    const erweitert = { ...e, experimentellerZusatz: "semantikneutral", weitereZahl: 42 };
    expect(() =>
      pruefeOffeneGestalt(erweitert, { sourcesConflicted: true, conflictsUnproven: false }),
    ).not.toThrow();
  });

  it("KALIBRIERUNG: der Gestaltpruefer kann ueberhaupt zubeissen", async () => {
    const a = await aufbau("w5f@job1157.test");
    await konfliktAnlegen(a);
    const antwort = await fragen(a);
    const e = evidenz(antwort) as unknown as Record<string, unknown>;

    // Ohne diesen Fall waere die Offenheitsprobe oben auch dann gruen, wenn `pruefeOffeneGestalt`
    // gar nichts pruefte — die gefaehrlichste Form eines gruenen Tests. Drei Arten von Schaden,
    // die er erkennen MUSS:
    const { sourcesConflicted: _weg, ...ohnePflichtfeld } = e;
    expect(() => pruefeOffeneGestalt(ohnePflichtfeld)).toThrow(/sourcesConflicted/);
    expect(() => pruefeOffeneGestalt({ ...e, conflictsUnproven: "nein" })).toThrow(
      /conflictsUnproven/,
    );
    expect(() => pruefeOffeneGestalt(e, { sourcesConflicted: false })).toThrow(/sourcesConflicted/);
  });

  it("ABGRENZUNG: ein Konflikt OHNE Bezug zur tragenden Quelle setzt den Zustand NICHT", async () => {
    const a = await aufbau("w5d@job1157.test");
    // Ein drittes, voellig unbeteiligtes Paar. Ohne diesen Fall koennte die Regel schlicht jeden
    // offenen Konflikt melden — und der Fall darueber saehe genauso gruen aus.
    const fremdA = await a.app.inject({
      method: "POST",
      url: "/api/kos",
      headers: a.autor,
      payload: {
        title: "Foerderband",
        statement: "Das Foerderband laeuft mit halber Last an.",
        type: "best_practice",
        category: "Anlage 2",
      },
    });
    const fremdB = await a.app.inject({
      method: "POST",
      url: "/api/kos",
      headers: a.autor,
      payload: {
        title: "Foerderband Gegenrede",
        statement: "Das Foerderband laeuft mit voller Last an.",
        type: "best_practice",
        category: "Anlage 2",
      },
    });
    expect(fremdA.statusCode, fremdA.body).toBe(201);
    expect(fremdB.statusCode, fremdB.body).toBe(201);
    const konflikt = await a.app.inject({
      method: "PUT",
      url: `/api/kos/${fremdA.json().id}`,
      headers: a.autor,
      payload: {
        action: "conflict",
        conflict: {
          koA: fremdA.json().id,
          koB: fremdB.json().id,
          type: "truth",
          description: "Widerspruch am Foerderband",
        },
      },
    });
    expect(konflikt.statusCode, konflikt.body).toBe(201);

    const antwort = await fragen(a);
    expect(antwort.status, antwort.body).toBe(200);
    expect(tragendeQuellen(antwort)).toContain(a.koTragend);

    const e = evidenz(antwort);
    expect(
      e.sourcesConflicted,
      "Der offene Konflikt betrifft die tragende Quelle nicht — er darf sie nicht begrenzen",
    ).toBe(false);
    // Und die Konfliktlage war trotzdem abrufbar: das zweite Feld bleibt davon unberuehrt.
    expect(e.conflictsUnproven).toBe(false);
  });
});
