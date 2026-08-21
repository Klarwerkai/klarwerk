import { describe, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";

// ==================================================================================================
// JOB 1591 · D1 · W5 — „WIR HABEN ES, ABER ES IST NOCH NICHT GEPRUEFT."
// ==================================================================================================
//
// PEDIS BEFUND (OFFEN.md Z.181, `BEFUND | SOFORT`, gefunden um 21:28 am laufenden System):
// Er speichert einen Absatz als Entwurf — Zustand „Offen / ZU PRUEFEN" —, markiert ihn und fragt
// „haben wir diese Information schon?". Klara antwortet: „Keine belastbare Grundlage. Es gibt kein
// VALIDIERTES Wissen zu dieser Frage."
//
// DAS IST EINE AUSKUNFT UEBER UNSEREN PRUEFSTAND, GEFRAGT WAR NACH UNSEREM BESTAND. Der Anwender
// fragt nach dem einen und bekommt das andere — und merkt es nicht. Genau das misst diese Suite.
//
// DIE KETTE, die dazu fuehrt (in OFFEN.md belegt, hier ausfuehrbar nachgestellt):
//   taskpane.html         Klara sendet `mode: "retrieval-only"`
//   ask-routes.ts         Server erzwingt `validatedOnly: true` + `retrievalOnly: true`
//   ask/service.ts        alle Kandidaten mit `status !== "validiert"` fallen VOR der Auswahl weg
//                         — Pedis Entwurf war nie Kandidat.
//
// WAS HIER NICHT PASSIERT: `validatedOnly` wird NICHT aufgehoben. Ein ungeprueftes Objekt darf
// GEMELDET werden; es darf nicht GRUNDLAGE einer Antwort werden. Der Unterschied ist der ganze
// Auftrag — und W2 unten ist der Fall, der ihn bewacht.
//
// VORGESCHICHTE, die diese Suite mittraegt: `ungeprueftUnterdrueckt` (mega74 Teil 2b) hat dasselbe
// Ziel schon einmal verfehlt und wurde in AUFTRAG-mega77 BLOCK A ersatzlos entfernt — weil es (1)
// ohne Betrachterfilter zaehlte (Leck ab n=1, Abfrageorakel) und (2) die gedeckelte Vorauswahl statt
// des Bestands zaehlte. W4 bewacht Grund 1, W3 bewacht Grund 2.

const ZUGANG = { name: "Admin", email: "a@x.de", password: "secret123" };

async function bestueckteApp() {
  const app = buildApp(buildServices());
  await app.inject({ method: "POST", url: "/api/auth/register", payload: ZUGANG });
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: ZUGANG.email, password: ZUGANG.password },
  });
  const headers = { authorization: `Bearer ${login.json().token}` };

  // (1) Ein VALIDIERTES Objekt — die Antwort darf weiterhin daraus entstehen.
  const validiert = await app.inject({
    method: "POST",
    url: "/api/kos",
    headers,
    payload: {
      title: "Zylinderkopfdichtung XQ42 wechseln",
      statement: "Die Zylinderkopfdichtung XQ42 vor dem Wechsel entlasten.",
      type: "best_practice",
      category: "Ask",
      neededValidations: 1,
    },
  });
  const validiertId = validiert.json().id as string;
  await app.inject({
    method: "PUT",
    url: `/api/kos/${validiertId}`,
    headers,
    payload: { action: "rate", verdict: "up" },
  });

  // (2) PEDIS FALL: gespeichert, nicht bewertet → Zustand bleibt „offen".
  const ENTWURF_INHALT = "Beim Turboverdichter TVX99 die Drehzahl im Sonderfall begrenzen.";
  const entwurf = await app.inject({
    method: "POST",
    url: "/api/kos",
    headers,
    payload: {
      title: "Turboverdichter TVX99 Sonderfall",
      statement: ENTWURF_INHALT,
      type: "best_practice",
      category: "Ask",
    },
  });
  const entwurfId = entwurf.json().id as string;

  return { app, headers, validiertId, entwurfId, ENTWURF_INHALT };
}

// Der Weg, den das Word-Panel heute wirklich faehrt: Sitzungscookie, same-origin,
// `mode: "retrieval-only"` (ask-routes.ts sagt es an der Stelle selbst).
function panelFrage(
  app: Awaited<ReturnType<typeof bestueckteApp>>["app"],
  headers: Record<string, string>,
  question: string,
) {
  return app.inject({
    method: "POST",
    url: "/api/ask",
    headers,
    payload: { question, mode: "retrieval-only" },
  });
}

describe("JOB 1591 D1 · W5 — vorhanden, aber ungeprueft: gemeldet statt verschwiegen", () => {
  it("W1 · Pedis Fall: die Antwort traegt den ungepruefen Bestand — mit Kennung, Titel und Zustand", async () => {
    const { app, headers, entwurfId } = await bestueckteApp();
    const res = await panelFrage(
      app,
      headers,
      "Was gilt beim Turboverdichter TVX99 im Sonderfall?",
    );
    expect(res.statusCode).toBe(200);
    const koerper = res.json();

    // Die Enge ist unveraendert: das ungepruefte Objekt ist NICHT Grundlage geworden.
    expect(koerper.result.answered).toBe(false);
    expect(koerper.result.sources).not.toContain(entwurfId);

    // UND GENAU DAS IST NEU: es wird trotzdem gemeldet, dass es da ist.
    expect(Array.isArray(koerper.ungeprueft)).toBe(true);
    const treffer = koerper.ungeprueft.find((h: { id: string }) => h.id === entwurfId);
    expect(
      treffer,
      "Pedis Entwurf existiert im Bestand und muss als ungeprueft gemeldet werden — sonst " +
        "antwortet Klara weiter ueber den Pruefstand statt ueber den Bestand.",
    ).toBeDefined();
    expect(treffer.title).toBe("Turboverdichter TVX99 Sonderfall");
    expect(treffer.status).toBe("offen");
  });

  it("W2 · DIE GRENZE: der ungepruefte INHALT wird nirgends behauptet — nur seine Existenz", async () => {
    const { app, headers, ENTWURF_INHALT } = await bestueckteApp();
    const res = await panelFrage(
      app,
      headers,
      "Was gilt beim Turboverdichter TVX99 im Sonderfall?",
    );
    const roh = res.payload;

    // Der Satz aus dem ungepruefen Objekt darf im GANZEN Antwortkoerper nicht vorkommen —
    // nicht im Antworttext, nicht in den Quellen, nicht in der Meldung.
    expect(
      roh.includes(ENTWURF_INHALT),
      "Ein ungeprueftes Objekt darf GEMELDET werden, nie BEHAUPTET. Steht sein Satz im " +
        "Antwortkoerper, ist aus der Meldung eine Grundlage geworden — bens Fix 1 (P0).",
    ).toBe(false);

    // Und die Meldung traegt ausschliesslich die drei vereinbarten Felder (KA2s Vertrag).
    for (const h of res.json().ungeprueft as Array<Record<string, unknown>>) {
      expect(Object.keys(h).sort()).toEqual(["id", "status", "title"]);
    }
  });

  it("W3 · gegen mega77s Grund 2: eine leere Liste ist kein Versprechen ueber den Bestand", async () => {
    const { app, headers } = await bestueckteApp();
    const res = await panelFrage(
      app,
      headers,
      "Wie wird die Zylinderkopfdichtung XQ42 gewechselt?",
    );
    expect(res.statusCode).toBe(200);
    // Zu dieser Frage gibt es nur ein VALIDIERTES Objekt — also nichts zu melden.
    expect(res.json().ungeprueft).toEqual([]);
    // Die Antwort selbst bleibt unveraendert moeglich.
    expect(res.json().result.answered).toBe(true);
  });

  it("W4 · gegen mega77s Grund 1: ohne Betrachter wird NICHTS gemeldet — `null`, nicht `[]`", async () => {
    const { app, headers } = await bestueckteApp();
    // Der Konsolenweg (ohne `mode`) kennt die Enge gar nicht: dort ist ein ungeprueftes Objekt
    // ohnehin zulaessige Grundlage, es gibt nichts zu melden.
    const res = await app.inject({
      method: "POST",
      url: "/api/ask",
      headers,
      payload: { question: "Was gilt beim Turboverdichter TVX99 im Sonderfall?" },
    });
    expect(res.statusCode).toBe(200);
    // JOB 1591 D2: ABWESEND statt `null` — der Name des Feldes erscheint dort gar nicht mehr,
    // wo kein Betrachter uebergeben wurde. Das ist die Verschaerfung aus Auflage 1: `mega77`
    // verbietet das Wort im Koerper, und ein Feld mit dem Wert `null` traegt es trotzdem.
    expect(
      Object.keys(res.json()),
      "Ohne Betrachter darf das Feld nicht einmal als Name im Koerper stehen.",
    ).not.toContain("ungeprueft");
    expect(
      res.json().ungeprueft,
      "abwesend heisst „nicht gefragt“, `[]` hiesse „nachgesehen und nichts gefunden“. Die zwei " +
        "duerfen nie verwechselt werden — daran ist mega74 gescheitert.",
    ).toBeUndefined();
  });

  it("W5 · SICHTBARKEIT: ein vertrauliches ungepruefes Objekt wird NICHT gemeldet", async () => {
    const { app, headers } = await bestueckteApp();
    const vertraulich = await app.inject({
      method: "POST",
      url: "/api/kos",
      headers,
      payload: {
        title: "Sonderfall Verdichter TVX99 vertraulich",
        statement: "Vertraulicher Sonderfall zum Turboverdichter TVX99.",
        type: "best_practice",
        category: "Ask",
        confidentiality: "vertraulich",
      },
    });
    const vertraulichId = vertraulich.json().id as string;

    const res = await panelFrage(
      app,
      headers,
      "Was gilt beim Turboverdichter TVX99 im Sonderfall?",
    );
    const gemeldet = (res.json().ungeprueft as Array<{ id: string }>).map((h) => h.id);
    expect(
      gemeldet,
      "Vertrauliches verlaesst diesen Weg nicht, auch nicht als blosser Titel — dieselbe harte " +
        "Linie, die `dropConfidential` eine Zeile weiter oben zieht.",
    ).not.toContain(vertraulichId);
  });

  it("W7 · AUFLAGE 3: NUR der Session-Panel-Weg fuehrt das Feld — der Add-on-Zweig nicht", async () => {
    // JOB 1591 D2, Auflage 3: „Der Add-on-Zweig bleibt unveraendert … Die Bahn schreibt selbst,
    // dass sie nur dort hineinreicht — DAS IST IM TEST ZU BELEGEN, NICHT ZU BEHAUPTEN."
    //
    // Beide Zweige fahren dieselbe Route, denselben Modus, dieselbe Frage, denselben Bestand.
    // Der EINZIGE Unterschied ist der Zugang. Genau daran haengt die Entscheidung.
    process.env.KLARWERK_ADDON_API = "1";
    process.env.KLARWERK_ADDON_API_KEY = "s3cr3t-addon-key-w7";
    const { app, headers, entwurfId } = await bestueckteApp();

    // (1) DER ADD-ON-ZWEIG: kein SessionUser, kein Sichtbarkeitsvertrag → `null`, nicht `[]`.
    const addon = await app.inject({
      method: "POST",
      url: "/api/ask",
      headers: { "x-klarwerk-addon-key": "s3cr3t-addon-key-w7" },
      payload: { question: "Was gilt beim Turboverdichter TVX99 im Sonderfall?" },
    });
    expect(addon.statusCode).toBe(200);
    expect(
      addon.json().ungeprueft,
      "Der Add-on-Principal hat kein allgemeines Leserecht auf unvalidierte Objekte — eine " +
        "Meldung an ihn waere das Abfrageorakel, das AUFTRAG-mega77 entfernt hat.",
    ).toBeUndefined();
    expect(
      addon.body,
      "Auf dem Add-on-Weg darf nicht einmal der NAME des Feldes im Koerper stehen (mega77).",
    ).not.toContain("ungeprueft");
    expect(addon.body.includes("Turboverdichter TVX99 Sonderfall")).toBe(false);

    // (2) DER SESSION-PANEL-WEG, gleicher Bestand, gleiche Frage: das Feld ist da.
    const session = await panelFrage(
      app,
      headers,
      "Was gilt beim Turboverdichter TVX99 im Sonderfall?",
    );
    const gemeldet = (session.json().ungeprueft as Array<{ id: string }>).map((h) => h.id);
    expect(gemeldet).toContain(entwurfId);
  });

  it("W6 · die bestehende Zusage bleibt: aus einem ungepruefen Objekt wird weiterhin nicht geantwortet", async () => {
    const { app, headers, entwurfId, validiertId } = await bestueckteApp();
    const res = await panelFrage(
      app,
      headers,
      "Was gilt beim Turboverdichter TVX99 im Sonderfall?",
    );
    expect(res.json().result.sources).not.toContain(entwurfId);
    const zweite = await panelFrage(
      app,
      headers,
      "Wie wird die Zylinderkopfdichtung XQ42 gewechselt?",
    );
    expect(zweite.json().result.sources).toContain(validiertId);
  });
});
