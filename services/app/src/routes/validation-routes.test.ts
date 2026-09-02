// ================================================================================================
// JOB 3003 · STATION 4 — STUFE UND HERKUNFT AM PRUEF-BOARD, UND EIN FEHLEN HEISST FEHLEN.
// ================================================================================================
//
// WAS DIESE DATEI MISST. `GET /api/validation/board` trug bis JOB 3003 keinen einzigen Bezug auf
// Vertraulichkeit oder Herkunft (gemessen an 44e39c9: `git grep -n "confidentiality\|provenance"
// -- services/app/src/routes/validation-routes.ts` → keine Trefferzeile). Wer validiert, sah Titel,
// Kernaussage, Stimmen und Zuweisungen — aber nicht, wie vertraulich das Objekt ist und woher es
// kommt.
//
// DER KERN IST NICHT DAS NEUE FELD, SONDERN SEIN FEHLZUSTAND. Ein weggelassenes Feld ist fuer den,
// der davorsitzt, nicht unterscheidbar von „die Route liefert das nicht". Deshalb misst F1 den
// Fall OHNE Stufe zuerst — und verlangt `confidentiality: null` MIT
// `confidentialityProvenance: "unknown"`, nicht das stille Fehlen des Schluessels.
//
// F2 ist die Gegenprobe dazu: ohne sie waere F1 auch von einer Route gruen, die immer `null` sagt.
//
// BAUART UEBERNOMMEN, NICHT ERFUNDEN: Vorrichtung, Anmeldung und Rollenkonten sind die aus
// `tests/security/g1-pruefboard-vertraulich.test.ts` — dieselbe Route, dieselbe Bauart.
// Der Unterschied: die KOs mit `origin` und `sources` entstehen ueber den DIENST und nicht ueber
// `POST /api/kos`, weil die oeffentliche Schreibroute beide Felder ausdruecklich verwirft
// (`ko-routes.ts:652` verwirft `sources`; `origin` kommt dort gar nicht vor). Das ist kein
// Umgehen einer Regel, sondern der einzige Weg, einen Bestand herzustellen, wie ihn der Import und
// die Erfassung erzeugen.
import { describe, expect, it } from "vitest";
import type { KoSource } from "../../../knowledge-object";
import { buildApp, buildServices } from "../build-app";

type App = ReturnType<typeof buildApp>;
type Auth = { authorization: string };

interface Boardzeile {
  id: string;
  title?: string;
  confidentiality?: unknown;
  confidentialityProvenance?: unknown;
  origin?: unknown;
  originSources?: unknown;
}

async function login(app: App, email: string, password: string): Promise<Auth> {
  const res = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email, password },
  });
  if (res.statusCode !== 200) {
    throw new Error(`Anmeldung ${email} fehlgeschlagen: ${res.statusCode} ${res.body}`);
  }
  return { authorization: `Bearer ${res.json().token}` };
}

/**
 * Der erste registrierte Nutzer wird Admin (und traegt damit `ko.validate` — die Rolle, die auch
 * vertrauliche Objekte pruefen darf). Der zweite ist ein Experte OHNE `ko.validate`: er ist die
 * Gegenprobe zu Lieferung 4 und ausdruecklich NICHT Autor der Pruefobjekte.
 */
async function setup() {
  const services = buildServices();
  const app = buildApp(services);
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Pruefer", email: "pruefer@j3003.test", password: "geheim12345" },
  });
  const pruefer = await login(app, "pruefer@j3003.test", "geheim12345");
  const angelegt = await app.inject({
    method: "POST",
    url: "/api/users",
    headers: pruefer,
    payload: {
      name: "Fremd",
      email: "fremd@j3003.test",
      password: "geheim12345",
      role: "experte",
    },
  });
  if (angelegt.statusCode !== 201) {
    throw new Error(`Konto fremd nicht angelegt: ${angelegt.statusCode} ${angelegt.body}`);
  }
  return {
    app,
    services,
    pruefer,
    fremd: await login(app, "fremd@j3003.test", "geheim12345"),
  };
}

async function board(app: App, wer: Auth): Promise<Boardzeile[]> {
  const res = await app.inject({ method: "GET", url: "/api/validation/board", headers: wer });
  expect(res.statusCode, res.body).toBe(200);
  return res.json() as Boardzeile[];
}

function zeile(zeilen: Boardzeile[], id: string): Boardzeile {
  const treffer = zeilen.find((z) => z.id === id);
  if (!treffer) {
    throw new Error(`Kennung ${id} steht nicht auf dem Board (${zeilen.length} Zeilen).`);
  }
  return treffer;
}

const QUELLE: KoSource = {
  id: "q-1",
  label: "Handbuch Anlagenbetrieb, Kapitel 4",
  url: "https://intern.example.org/handbuch",
  // DER AUSZUG, DEN DIE NEUE QUELLENLISTE NICHT TRAEGT. F3 misst das ueber die exakte Form von
  // `originSources` (drei Felder, mehr nicht) — NICHT ueber den ganzen Antwortkoerper: das Board
  // gibt seit jeher volle Wissensobjekte samt `sources` heraus, und dieser Auftrag aendert diesen
  // bestehenden Vertrag ausdruecklich nicht (s. board-herkunft.ts, „DIE BENANNTE GRENZE").
  excerpt: "WOERTLICHER AUSZUG AUS DER QUELLE, DER NICHT IN DIE UEBERSICHTSLISTE GEHOERT",
  kind: "external",
  peerValidated: false,
  author: "u-import",
  at: "2026-01-02T03:04:05.000Z",
};

describe("JOB 3003 · Station 4 — Stufe und Herkunft am Pruef-Board", () => {
  it("F1 · ROT-FALL: ein offenes KO OHNE Stufe sagt das ausdruecklich (null + unknown)", async () => {
    const { app, services, pruefer } = await setup();
    const ohne = await services.ko.create({
      title: "Objekt ohne Einstufung",
      statement: "Niemand hat dieses Objekt je eingestuft.",
      type: "best_practice",
      category: "Anlage 1",
      author: "u-autor",
    });
    expect(ohne.confidentiality, "Vorbedingung: der Bestand traegt die Stufe wirklich nicht").toBe(
      undefined,
    );

    const z = zeile(await board(app, pruefer), ohne.id);

    // Der Kern des Auftrags: NICHT das Fehlen des Schluessels, sondern die ausdrueckliche Auskunft.
    expect(z).toHaveProperty("confidentiality", null);
    expect(z).toHaveProperty("confidentialityProvenance", "unknown");
  });

  it("F2 · GEGENPROBE: eine gesetzte Stufe kommt mit ihrem Wert und Beleg `ko` an", async () => {
    const { app, services, pruefer } = await setup();
    const mit = await services.ko.create({
      title: "Objekt mit Einstufung",
      statement: "Dieses Objekt ist eingestuft.",
      type: "best_practice",
      category: "Anlage 1",
      author: "u-autor",
      confidentiality: "vertraulich",
    });
    const ohne = await services.ko.create({
      title: "Objekt ohne Einstufung",
      statement: "Niemand hat dieses Objekt je eingestuft.",
      type: "best_practice",
      category: "Anlage 1",
      author: "u-autor",
    });

    const zeilen = await board(app, pruefer);
    expect(zeile(zeilen, mit.id).confidentiality).toBe("vertraulich");
    expect(zeile(zeilen, mit.id).confidentialityProvenance).toBe("ko");
    // Beide Faelle in EINEM Board: die Route sagt nicht pauschal `null` und nicht pauschal einen Wert.
    expect(zeile(zeilen, ohne.id).confidentiality).toBeNull();
    expect(zeile(zeilen, ohne.id).confidentialityProvenance).toBe("unknown");
  });

  it("F3 · HERKUNFT: `origin` und eine schlanke Quellenliste OHNE Auszuege", async () => {
    const { app, services, pruefer } = await setup();
    const mitHerkunft = await services.ko.create({
      title: "Objekt aus dem Add-in",
      statement: "Erfasst ueber das Word-Add-in, mit einer Quelle.",
      type: "best_practice",
      category: "Anlage 1",
      author: "u-autor",
      origin: "word_addin",
      sources: [QUELLE],
    });
    const ohneHerkunft = await services.ko.create({
      title: "Objekt ohne Herkunft",
      statement: "Kein Erfassungsweg vermerkt.",
      type: "best_practice",
      category: "Anlage 1",
      author: "u-autor",
    });

    const zeilen = await board(app, pruefer);
    expect(zeile(zeilen, mitHerkunft.id).origin).toBe("word_addin");
    // Auch hier: FEHLT die Herkunft, steht das ausdruecklich da — `null`, kein fehlender Schluessel.
    expect(zeile(zeilen, ohneHerkunft.id)).toHaveProperty("origin", null);
    expect(zeile(zeilen, ohneHerkunft.id).originSources).toEqual([]);

    // Die Quellenliste traegt GENAU drei Felder je Quelle — Kennung, Bezeichnung, Art.
    expect(zeile(zeilen, mitHerkunft.id).originSources).toEqual([
      { id: "q-1", label: "Handbuch Anlagenbetrieb, Kapitel 4", kind: "external" },
    ]);
  });

  it("F4 · SICHTBARKEIT: ein unsichtbares Objekt FEHLT — es wird keine Zeile mit null-Feldern", async () => {
    const { app, services, pruefer, fremd } = await setup();
    const geheim = await services.ko.create({
      title: "Vertraulicher Pruefling",
      statement: "Sensibler Kerntext, der einen fremden Pruefer nichts angeht.",
      type: "best_practice",
      category: "Anlage 1",
      author: "u-jemand-anders",
      confidentiality: "vertraulich",
    });
    const offen = await services.ko.create({
      title: "Internes Alltagswissen",
      statement: "Nichts Geheimes — dieses Objekt muss jeder Pruefer sehen.",
      type: "best_practice",
      category: "Anlage 1",
      author: "u-autor",
    });

    const res = await app.inject({
      method: "GET",
      url: "/api/validation/board",
      headers: fremd,
    });
    expect(res.statusCode, res.body).toBe(200);
    const ids = (res.json() as Boardzeile[]).map((z) => z.id);
    // KALIBRIERUNG ZUERST — ohne sie bewiese die Zeile darunter nichts.
    expect(ids, "das interne Objekt gehoert auf das Board").toContain(offen.id);
    expect(ids, "das vertrauliche Objekt fehlt vollstaendig").not.toContain(geheim.id);
    // Fail-closed heisst FEHLEN. Eine Zeile mit `confidentiality: null` waere hier ein
    // Existenzorakel — die Anreicherung darf die Menge nicht erweitern.
    expect(res.body).not.toContain("Vertraulicher Pruefling");
    expect(res.body).not.toContain("Sensibler Kerntext");
    // Und die Gegenprobe: der Kurator sieht es sehr wohl, samt Stufe und Beleg.
    const alsPruefer = zeile(await board(app, pruefer), geheim.id);
    expect(alsPruefer.confidentiality).toBe("vertraulich");
    expect(alsPruefer.confidentialityProvenance).toBe("ko");
  });

  it("F5 · UNVERAENDERT: `/api/validation/overview` und `/api/validation/settings` bleiben, wie sie waren", async () => {
    const { app, services, pruefer } = await setup();
    const ko = await services.ko.create({
      title: "Objekt mit Zuweisung",
      statement: "Damit die Uebersicht eine Personenzeile hat.",
      type: "best_practice",
      category: "Anlage 1",
      author: "u-autor",
      confidentiality: "vertraulich",
      origin: "word_addin",
      sources: [QUELLE],
    });
    await services.validation.assign(ko.id, ["u-pruefer"], "u-autor");

    const uebersicht = await app.inject({
      method: "GET",
      url: "/api/validation/overview",
      headers: pruefer,
    });
    expect(uebersicht.statusCode, uebersicht.body).toBe(200);
    // Bytegleich zur bisherigen Antwort: GENAU die drei Felder der Personenzeile, kein Feld dieses
    // Auftrags. Die Anreicherung wirkt ausschliesslich am Board.
    expect(uebersicht.json()).toEqual([{ userId: "u-pruefer", open: 1, done: 0 }]);

    const lesen = await app.inject({
      method: "GET",
      url: "/api/validation/settings",
      headers: pruefer,
    });
    expect(lesen.statusCode, lesen.body).toBe(200);
    // Bytegleich: der Standardwert (FALLBACK_NEEDED_VALIDATIONS = 3) in genau diesem einen Feld.
    expect(lesen.body).toBe(JSON.stringify({ defaultNeededValidations: 3 }));

    const schreiben = await app.inject({
      method: "PUT",
      url: "/api/validation/settings",
      headers: pruefer,
      payload: { defaultNeededValidations: 4 },
    });
    expect(schreiben.statusCode, schreiben.body).toBe(200);
    expect(schreiben.body).toBe(JSON.stringify({ defaultNeededValidations: 4 }));
  });

  it("F6 · EINE REGEL: Board und Detailabruf geben dieselbe Auskunft", async () => {
    // HERKUNFT DIESES FALLS: JOB 3003 verlangte hier eine MESSUNG (§2, „Was NICHT belegt ist") —
    // kaeme die Pruefende ueber den Detailabruf an Stufe und Herkunft? Die Antwort war damals
    // „`origin` ja, Stufe nein": `GET /api/kos/:id` gab das Objekt roh heraus, und ein nicht
    // gesetztes optionales Feld fehlt im JSON vollstaendig. Der Fall hielt das als
    // `Object.hasOwn(voll, "confidentiality") === false` fest.
    //
    // JOB 3009 hat genau diese Luecke geschlossen: der Detailabruf ruft dieselbe Regel wie das
    // Board (`discloseConfidentiality`, knowledge-object/src/confidentiality.ts). Der Fall wird
    // deshalb NICHT gestrichen, sondern nachgezogen — er misst ab jetzt, dass beide Lesewege
    // dasselbe sagen. Die eigenen Faelle des Detailabrufs stehen in
    // `ko-routes-stufenauskunft.test.ts`.
    const { app, services, pruefer } = await setup();
    const ko = await services.ko.create({
      title: "Objekt fuer den Detailabruf",
      statement: "Gemessen, nicht angenommen.",
      type: "best_practice",
      category: "Anlage 1",
      author: "u-autor",
      origin: "word_addin",
      sources: [QUELLE],
    });

    const detail = await app.inject({ method: "GET", url: `/api/kos/${ko.id}`, headers: pruefer });
    expect(detail.statusCode, detail.body).toBe(200);
    const voll = detail.json() as Record<string, unknown>;
    // Der Detailabruf gibt das VOLLE Objekt heraus: `origin` steht darin ...
    expect(voll.origin).toBe("word_addin");
    // ... und die fehlende Stufe ist jetzt eine AUSSAGE statt eines fehlenden Schluessels.
    expect(voll).toHaveProperty("confidentiality", null);
    expect(voll.confidentialityProvenance).toBe("unknown");

    // Und das ist der Punkt: dieselbe Auskunft wie auf dem Board, weil es dieselbe Regel ist.
    const z = zeile(await board(app, pruefer), ko.id);
    expect(voll.confidentiality).toBe(z.confidentiality);
    expect(voll.confidentialityProvenance).toBe(z.confidentialityProvenance);

    // DIE GRENZE BLEIBT BENANNT: die schlanke Quellenliste ist die UEBERSICHTSform des Boards. Der
    // Detailabruf traegt `sources` bereits vollstaendig; eine zweite Liste daneben waere eine
    // zweite Wahrheit auf demselben Lesepfad (JOB 3009, Lieferung 4).
    expect(Object.hasOwn(voll, "originSources")).toBe(false);
    expect(z.originSources).toEqual([
      { id: "q-1", label: "Handbuch Anlagenbetrieb, Kapitel 4", kind: "external" },
    ]);
  });
});
