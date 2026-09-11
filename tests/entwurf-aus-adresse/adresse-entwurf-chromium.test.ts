// ================================================================================================
// JOB 3633 — `/erfassen?draft=<id>`: WAS EIN MENSCH AUF DIESER ADRESSE WIRKLICH SIEHT.
// ================================================================================================
//
// DER BEFUND (Codex, 11.09. 13:05, lesende Bildschirmaufnahme an Live 1.307):
// „`https://app.klarwerk.ai/erfassen?draft=1ec48b98-0320-445e-a7de-25c8ecd21b98` (früherer echter
// ChatGPT-Handover-Entwurf) bleibt nach zwei getrennten Aufrufen und langem Warten VOLLSTÄNDIG
// WEISS. `/entwuerfe`, `/erfassen` ohne Parameter, `/bibliothek` laden im selben angemeldeten
// Chrome." Bildbeleg: `register/planung/storyboard-bilder/klarwerk-entwurf-offen.png`.
//
// EINE WEISSE SEITE IST DIE SCHLECHTESTE ALLER ANTWORTEN: sie sagt nichts. Deshalb misst diese
// Datei nicht „lädt der Entwurf", sondern die Frage darunter — STEHT AUF DIESER ADRESSE ÜBERHAUPT
// ETWAS? Jeder Fall liest deshalb zuerst `#root`: null Kindknoten IST die weisse Seite, und keine
// Zusicherung über Titel oder Meldungen wiegt sie auf.
//
// WARUM IM ECHTEN CHROMIUM UND NICHT GEMOUNTET. Genau diese Fehlerklasse — Absturz beim Rendern,
// nicht geladenes Bündel, weisse Fläche — sieht ein jsdom-Prüfstand baulich nicht: er montiert die
// Komponente, die im Browser gar nicht erst montiert wurde. Gefahren wird deshalb die ECHTE gebaute
// Anwendung aus `apps/web/dist` gegen die ECHTE Fastify-App — dieselbe Bühne, die schon die
// H3-Messungen tragen (`tests/design/h3-blatt-buehne.ts`). Sie wird BENUTZT und nicht abgeschrieben:
// ein zweiter Bühnenaufbau wäre eine zweite Wahrheit über „echte Seite, echter Server".
//
// DER ENTWURF IST EINE ECHTE ÜBERNAHME UND KEINE ATTRAPPE. Die Nutzlast unten hat die Gestalt, die
// `extensions/klara-browser/worker.js` (`payload()`, :460-482) wirklich schickt: Titel, Aussage,
// zweisprachige Abschnittsköpfe, ein NACKTES `<img data:image…>` (der Klara-Weg liefert Bilder ohne
// figure-Anker — s. `lib/captureFrontDoor.ts:97-107`) und `pendingSources` mit der Tab-Adresse.
// Angelegt wird sie über den echten `POST /api/drafts` AUS DER SEITE heraus, damit die Kennung
// dieselbe Herkunft hat wie im Befund.
//
// DIE VIER ADRESSFÄLLE DES AUFTRAGS (§4.3) und ihre Herkunft:
//   A1 gültige Kennung   — echter Entwurf, echter Server.
//   A2 gelöschte Kennung — echte 404 des echten Servers (eine Kennung, die es nie gab;
//                          `capture-routes.ts:85` antwortet „Entwurf nicht gefunden.").
//   A3 fremde Kennung    — die 403 des Servers (`capture-routes.ts:89`) wird am NETZRAND
//                          eingespeist, mit dem Wortlaut der Route. Grund, ausdrücklich benannt:
//                          die Bühne hat GENAU EINEN Anmelder, und ihr Durchgriff setzt für jeden
//                          `/api`-Aufruf dessen Token (h3-blatt-buehne.ts). Ein zweiter Eigentümer
//                          ist darin nicht herstellbar. Gemessen wird also die ANTWORT DES ECHTEN
//                          SERVERS auf eine fremde Kennung, nicht seine Entscheidung dazu — die
//                          hält `services/app/src/routes/capture-routes.ts` selbst fest.
//   A4 `?draft=` leer    — kein Ladeversuch, leeres Blatt (`Capture.tsx:561`, `Blatt.tsx:337`).
//
// DAZU ZWEI FÄLLE, DIE DIESER AUFTRAG GEFUNDEN HAT: A6 fährt den Kaltstart ins Expertenformular
// (`?draft=<id>&weg=formular`) — die Adresse allein, ohne einen Klick im Menü „Datei ▾". Und A7
// fährt den halben Ladevorgang: ein Entwurf, dessen gesichertes Original es nicht mehr gibt. Seine
// Begründung steht am Fall selbst.
//
// UND A5 NAGELT DIE WEISSE SEITE SELBST FEST (§4.4): ein Absturz IM LADEWEG wird erzwungen, und
// geprüft wird, dass die Oberfläche trotzdem etwas anzeigt. Die Einspeisung ist so eng wie möglich:
// GENAU EINE Kennung bekommt am Netzrand eine Antwort, deren `bodyHtml` eine ZAHL ist. Der Ladeweg
// ruft darauf `payload.bodyHtml?.trim()` (`lib/captureFrontDoor.ts:106`) und wirft dort einen
// TypeError — mitten im `.then` des Entwurfsabrufs, also im Ladeweg. Der echte Server liefert diese
// Gestalt nie (`validateDraftPayloadShape` weist sie am Rand ab, `capture-routes.ts:838`); genau
// deshalb ist sie der ehrliche Weg, den Absturz zu erzwingen, ohne das Produkt zu verbiegen.
//
// EIN ERSTER VERSUCH PATCHTE `String.prototype.trim` und ist gemessen GESCHEITERT (Lauf
// 19fe05381142467c8b0796f8fb9d7828): die Absturzmarke stand im Titel, und der erste `trim()`-Aufruf
// darauf fiel nicht im Blatt, sondern im Abruf der ENTWURFSLISTE — dort hat react-query ihn
// verschluckt, die Einspeisung war verbraucht, und das Blatt lud den Entwurf danach fehlerfrei. Der
// Fall meldete deshalb eine Lücke, die er selbst erzeugt hatte. Eine Einspeisung, die nicht sagen
// kann, WO sie wirkt, ist kein Prüfmittel.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type Buehne, ORIGIN, buehneAufbauen, fn } from "../design/h3-blatt-buehne";

/** Die Kennung, deren Antwort am Netzrand einen Rumpf trägt, der kein Text ist (A5). */
const ABSTURZ_KENNUNG = "3f0b8d52-1c44-4a77-9e06-5b2d7c8f4a10";
/** Der Satz, mit dem das Blatt einen gescheiterten Ladevorgang meldet (`i18n.ts:5461`). */
const LADE_SATZ = "Der Entwurf konnte nicht geladen werden.";

/** Eine Kennung, die es auf diesem Server nie gab (A2). Form wie eine echte UUID. */
const GELOESCHTE_KENNUNG = "1ec48b98-0320-445e-a7de-25c8ecd21b98";
/** Die Kennung, für die der Netzrand die 403 des Servers liefert (A3). */
const FREMDE_KENNUNG = "7a3f0c21-9b4e-4d55-8f10-2c6b8e4a1d99";
/** Der Wortlaut der Route für eine fremde Kennung (`capture-routes.ts:89`). */
const FREMD_SATZ = "Entwurf nicht verfuegbar.";
/** Der Wortlaut der Route für eine unbekannte Kennung (`capture-routes.ts:85`). */
const UNBEKANNT_SATZ = "Entwurf nicht gefunden.";
/** Der Satz der Fehlergrenze (`i18n.ts:541`) — er darf stehen, eine leere Fläche nicht. */
const GRENZE_SATZ = "Diese Ansicht konnte nicht geladen werden.";
/** Die Objektkennung eines gesicherten Originals, das es im Objektspeicher nicht gibt (A7). */
const VERLORENES_ORIGINAL = "obj-job3633-nie-gespeichert";
/**
 * Der Satz, mit dem das Produkt einen zurückgehaltenen Rumpf erklärt (`i18n.ts:1527`). Er wird hier
 * ZITIERT und nicht neu gedichtet: das Expertenformular sagt ihn seit AUFTRAG-mega20 Block D
 * (`Capture.tsx:4544`), und ein zweiter Wortlaut für dieselbe Lage wäre eine zweite Wahrheit.
 */
const ANKER_SATZ = "Ein gesichertes Original fehlt";

/** Die Aussage des Entwurfs — sie muss im Expertenformular Zeichen für Zeichen ankommen (A6). */
const AUSSAGE = "Vollverschweisste Hohlprofile sind in Spritzzonen zu vermeiden.";

/** Ein 1×1-GIF als Datenadresse — der nackte `<img>`, den der Klara-Weg wirklich liefert. */
const BILD = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAAAAAAALAAAAAABAAEAAAIBRAA7";

/** Die Nutzlast einer echten Browser-Übernahme (Gestalt aus `worker.js::payload`). */
function uebernahme(titel: string): Record<string, unknown> {
  return {
    title: titel,
    statement: AUSSAGE,
    bodyHtml: [
      "<h3>Herkunft / Origin</h3><p>KI-Chat / AI chat (chatgpt.com)</p>",
      "<h3>Kontext / Context</h3><p>Auslegung einer Reinigungszone.</p>",
      `<h3>Übernommener Inhalt / Captured content</h3><p>${AUSSAGE}</p>`,
      `<p><img src="${BILD}" alt=""></p>`,
    ].join(""),
    pendingSources: [
      {
        label: "Browser / chatgpt.com",
        url: "https://chatgpt.com/c/job3633",
        excerpt: AUSSAGE,
        sourceProvider: "Browser",
      },
    ],
    confidentiality: "intern",
  };
}

/**
 * Was ein Mensch sieht. `wurzel` ist die Kernzahl dieser Datei: die Anwendung hängt in
 * `<div id="root">` (`apps/web/index.html`), und NULL Kindknoten darin IST die weisse Seite.
 */
interface Sicht {
  /** Kindknoten von `#root`; `-1` heisst „der Anker selbst fehlt". */
  wurzel: number;
  /** Der sichtbare Text der Seite, auf einfache Abstände gebracht. */
  text: string;
  /** Steht das Blatt (`data-testid="blatt"`)? */
  blatt: boolean;
  /** Steht der Arbeitsraum (Expertenformular u. a.)? */
  arbeitsraum: boolean;
  /** Der Wert des Titelfeldes, oder `null`, wenn es kein Titelfeld gibt. */
  titel: string | null;
  /** Die eine Lagezeile des Blattes (`BlattLage`), oder `null`. */
  lage: string | null;
  /** Trägt ein Feld des Arbeitsraums die Aussage des Entwurfs? */
  aussageImFeld: boolean;
}

const SICHT = `(aussage) => {
  const wurzel = document.getElementById("root");
  const titel = document.querySelector('[data-testid="blatt-titel"]');
  const lage = document.querySelector('[data-testid="blatt-lage"]');
  const raum = document.querySelector('[data-testid="blatt-arbeitsraum"]');
  const rein = (s) => (s || "").replace(/\\s+/g, " ").trim();
  const felder = raum === null ? [] : [...raum.querySelectorAll("input, textarea")];
  return {
    wurzel: wurzel === null ? -1 : wurzel.childElementCount,
    text: rein(document.body.innerText || document.body.textContent),
    blatt: document.querySelector('[data-testid="blatt"]') !== null,
    arbeitsraum: raum !== null,
    titel: titel === null ? null : titel.value,
    lage: lage === null ? null : rein(lage.textContent),
    aussageImFeld: felder.some((f) => String(f.value || "").includes(aussage)),
  };
}`;

const ANLEGEN = `async (nutzlast) => {
  const res = await fetch("/api/drafts", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(nutzlast),
  });
  return { status: res.status, rumpf: await res.text() };
}`;

let buehne: Buehne;
/** Die Kennung des echten Entwurfs (A1, A6). */
let kennung = "";
/** Die Kennung des Entwurfs, dessen gesichertes Original es nicht mehr gibt (A7). */
let ankerKennung = "";
/** Was beim Anlegen herauskam — steht in der Meldung, wenn A1 gar nicht messen kann. */
let anlegeBefund = "";

/** Wartet auf eine Bedingung in der Seite und ANTWORTET statt zu werfen (Diagnose vor Abbruch). */
async function warte(quelle: string, arg?: unknown, ms = 20_000): Promise<boolean> {
  try {
    await buehne.seite.waitForFunction(fn(quelle), arg, { timeout: ms });
    return true;
  } catch {
    return false;
  }
}

async function sicht(): Promise<Sicht> {
  return buehne.seite.evaluate<Sicht>(fn(SICHT), AUSSAGE);
}

/** Eine Adresse anfahren wie ein Mensch aus der Chrome-Leiste: voller Seitenaufbau, kalt. */
async function anfahren(pfad: string): Promise<void> {
  await buehne.seite.goto(`${ORIGIN}${pfad}`, { waitUntil: "load", timeout: 60_000 });
}

beforeAll(async () => {
  buehne = await buehneAufbauen("/erfassen");
  if (buehne.fehler !== null) {
    return;
  }
  // Die 403 des Servers für die fremde Kennung — am Netzrand, mit dem Wortlaut der Route.
  await buehne.seite.route(`${ORIGIN}/api/drafts/${FREMDE_KENNUNG}`, async (route) => {
    await route.fulfill({
      status: 403,
      body: JSON.stringify({ error: "FORBIDDEN", message: FREMD_SATZ }),
      headers: { "content-type": "application/json" },
    });
  });
  // Die Absturz-Antwort von A5: GENAU diese Kennung, ein `bodyHtml`, das kein Text ist.
  await buehne.seite.route(`${ORIGIN}/api/drafts/${ABSTURZ_KENNUNG}`, async (route) => {
    await route.fulfill({
      status: 200,
      body: `{"id":"${ABSTURZ_KENNUNG}","updatedAt":"2026-09-11T12:00:00.000Z","payload":{"title":"Absturzprobe","bodyHtml":5}}`,
      headers: { "content-type": "application/json" },
    });
  });
  const eins = await buehne.seite.evaluate<{ status: number; rumpf: string }>(
    fn(ANLEGEN),
    uebernahme("Spritzzonen: Hohlprofile vermeiden"),
  );
  // A7: DERSELBE ENTWURF, aber mit einer Belegstelle, die sich auf ein gesichertes Original beruft,
  // das es im Objektspeicher nicht gibt. Nichts daran ist gestellt: `verifyDraftAnchors` schlägt die
  // Kennung wirklich nach (`build-app.ts:667`), findet sie nicht, und `withAnchorCheck`
  // (`services/capture/src/service.ts:688-709`) liefert den Entwurf deshalb mit `bodyHtml: null`
  // plus `anchorsMissing` aus. Das ist der Zustand, den das Blatt bis JOB 3633 verschwieg.
  const drei = await buehne.seite.evaluate<{ status: number; rumpf: string }>(fn(ANLEGEN), {
    ...uebernahme("Aus einem Original, das es nicht mehr gibt"),
    pendingSources: [
      {
        label: "Original-DOCX",
        excerpt: AUSSAGE,
        sourceProvider: "Datei",
        objectId: VERLORENES_ORIGINAL,
      },
    ],
  });
  anlegeBefund = `${eins.status} ${eins.rumpf.slice(0, 200)} / ${drei.status} ${drei.rumpf.slice(0, 160)}`;
  if (eins.status === 201) {
    kennung = (JSON.parse(eins.rumpf) as { id: string }).id;
  }
  if (drei.status === 201) {
    ankerKennung = (JSON.parse(drei.rumpf) as { id: string }).id;
  }
}, 180_000);

afterAll(async () => {
  await buehne?.schliessen();
});

describe("JOB 3633 · der Entwurf aus der Adresse", () => {
  it("A0 — die Bühne steht und beide Entwürfe sind echt angelegt", () => {
    expect(buehne.fehler, "Bühne nicht aufgebaut").toBeNull();
    expect(kennung, `POST /api/drafts hat keine Kennung geliefert: ${anlegeBefund}`).not.toBe("");
    expect(ankerKennung, `zweiter POST /api/drafts: ${anlegeBefund}`).not.toBe("");
  });

  it("A1 — /erfassen?draft=<gültig>: der Entwurf steht da, die Seite ist nicht weiß", async () => {
    const vorher = buehne.seitenfehler.length;
    await anfahren(`/erfassen?draft=${kennung}`);
    const geladen = await warte(
      `() => { const t = document.querySelector('[data-testid="blatt-titel"]'); return t !== null && t.value.length > 0; }`,
    );
    const s = await sicht();
    expect(
      s.wurzel,
      `WEISSE SEITE: #root hat ${s.wurzel} Kindknoten. Seitenfehler: ${buehne.seitenfehler.join(" | ")}`,
    ).toBeGreaterThan(0);
    expect(s.text.length, `die Fläche sagt nichts (Lage: ${s.lage})`).toBeGreaterThan(0);
    expect(s.blatt, `kein Blatt; Text: ${s.text.slice(0, 300)}`).toBe(true);
    expect(
      geladen,
      `der Titel des Entwurfs kam nicht an (Titelfeld: ${JSON.stringify(s.titel)}, Lage: ${s.lage})`,
    ).toBe(true);
    expect(s.titel).toBe("Spritzzonen: Hohlprofile vermeiden");
    expect(s.text, "die Aussage des Entwurfs fehlt auf der Fläche").toContain(AUSSAGE);
    expect(buehne.seitenfehler.slice(vorher), "die Seite hat geworfen").toEqual([]);
  });

  it("A2 — /erfassen?draft=<gelöscht>: ein Satz sagt es, die Seite ist nicht weiß", async () => {
    const vorher = buehne.seitenfehler.length;
    await anfahren(`/erfassen?draft=${GELOESCHTE_KENNUNG}`);
    const gemeldet = await warte(
      `() => document.querySelector('[data-testid="blatt-lage"]') !== null`,
    );
    const s = await sicht();
    expect(s.wurzel, `WEISSE SEITE: #root hat ${s.wurzel} Kindknoten`).toBeGreaterThan(0);
    expect(s.blatt, `kein Blatt; Text: ${s.text.slice(0, 300)}`).toBe(true);
    expect(gemeldet, `keine Lagezeile; Text: ${s.text.slice(0, 300)}`).toBe(true);
    // Der Satz des Servers gewinnt (`ladeFehlerMeldung`, Blatt.tsx:204) — er nennt den Grund.
    expect(s.lage, "die Meldung nennt den Grund nicht").toContain(UNBEKANNT_SATZ);
    // Und der Wiederholweg steht dabei (§9 des Blattes).
    expect(
      await buehne.seite.evaluate<boolean>(
        fn(`() => document.querySelector('[data-testid="blatt-erneut"]') !== null`),
      ),
      "kein Wiederholweg an der Meldung",
    ).toBe(true);
    expect(buehne.seitenfehler.slice(vorher), "die Seite hat geworfen").toEqual([]);
  });

  it("A3 — /erfassen?draft=<fremd>: die Fläche sagt „nicht verfügbar“, nicht nichts", async () => {
    const vorher = buehne.seitenfehler.length;
    await anfahren(`/erfassen?draft=${FREMDE_KENNUNG}`);
    const gemeldet = await warte(
      `() => document.querySelector('[data-testid="blatt-lage"]') !== null`,
    );
    const s = await sicht();
    expect(s.wurzel, `WEISSE SEITE: #root hat ${s.wurzel} Kindknoten`).toBeGreaterThan(0);
    expect(s.blatt, `kein Blatt; Text: ${s.text.slice(0, 300)}`).toBe(true);
    expect(gemeldet, `keine Lagezeile; Text: ${s.text.slice(0, 300)}`).toBe(true);
    expect(s.lage).toContain(FREMD_SATZ);
    expect(buehne.seitenfehler.slice(vorher), "die Seite hat geworfen").toEqual([]);
  });

  it("A4 — /erfassen?draft= (leer): ein leeres Blatt, keine erfundene Meldung", async () => {
    const vorher = buehne.seitenfehler.length;
    await anfahren("/erfassen?draft=");
    // GEWARTET WIRD AUF DIE FLÄCHE, NICHT AUF `load`. Die Seite wird nachgeladen
    // (`routes.tsx`: `lazy(() => import("./pages/Capture"))`); zwischen `load` und dem ersten
    // Bildaufbau der Erfassung steht die Ladefläche „Lädt …" (`Suspense fallback={<Splash/>}`).
    // Die erste Fassung dieses Falles las genau in diesem Fenster und meldete „kein Blatt" —
    // gemessen im Lauf 7b833ece39d86d84d3c21118, und der Befund war der Prüfstand, nicht das
    // Produkt. Ein Test, der das Nachladen für einen Fehler hält, fände morgen jeden zweiten Lauf rot.
    const blattDa = await warte(`() => document.querySelector('[data-testid="blatt"]') !== null`);
    const s = await sicht();
    expect(blattDa, `das Blatt kam nicht; Text: ${s.text.slice(0, 300)}`).toBe(true);
    expect(s.wurzel, `WEISSE SEITE: #root hat ${s.wurzel} Kindknoten`).toBeGreaterThan(0);
    expect(s.blatt, `kein Blatt; Text: ${s.text.slice(0, 300)}`).toBe(true);
    expect(s.titel, "das Titelfeld trägt Text, obwohl nichts zu laden war").toBe("");
    expect(s.lage, "eine Lagezeile ohne Lage").toBeNull();
    expect(buehne.seitenfehler.slice(vorher), "die Seite hat geworfen").toEqual([]);
  });

  // ==============================================================================================
  // A7 — DER HALBE LADEVORGANG, DEN DAS BLATT VERSCHWIEG (gefunden in JOB 3633).
  // ==============================================================================================
  //
  // Er steht hier und nicht am Ende: A5 installiert danach die Absturzeinspeisung in DIESE Seite,
  // und A6 baut die Bühne neu auf. Reihenfolge ist Absicht, nicht Zufall.
  //
  // DER BEFUND. Beruft sich ein Entwurf auf ein gesichertes Original, das es nicht mehr gibt, hält
  // der Server den übernommenen Text ZURÜCK (`bodyHtml: null`) und sagt ausdrücklich, warum
  // (`anchorsMissing`). Das Expertenformular erklärt das seit AUFTRAG-mega20 Block D mit Satz und
  // zwei Wegen (`Capture.tsx:4541-4577`). Das Blatt — also die Fläche, die `/erfassen?draft=<id>`
  // WIRKLICH zeigt — las das Feld nirgends: es öffnete den Entwurf mit leerem Text und schwieg.
  //
  // DAS IST DIESELBE KLASSE WIE DIE WEISSE SEITE, nur eine Stufe kleiner: eine Fläche, die auf eine
  // Frage („wo ist mein Text?") nichts antwortet. Dass der Rumpf dabei nicht verloren geht, ist
  // bereits gesichert (JOB 2705, `Blatt.tsx:1039` lässt den Schlüssel weg) — gefehlt hat die
  // AUSKUNFT, nicht der Schutz.
  it("A7 — /erfassen?draft=<Original verloren>: das Blatt sagt, warum der Text fehlt", async () => {
    const vorher = buehne.seitenfehler.length;
    await anfahren(`/erfassen?draft=${ankerKennung}`);
    const gemeldet = await warte(
      `(satz) => { const l = document.querySelector('[data-testid="blatt-lage"]');
         return l !== null && (l.textContent || "").includes(satz); }`,
      ANKER_SATZ,
    );
    const s = await sicht();
    expect(s.wurzel, `WEISSE SEITE: #root hat ${s.wurzel} Kindknoten`).toBeGreaterThan(0);
    expect(s.blatt, `kein Blatt; Text: ${s.text.slice(0, 300)}`).toBe(true);
    // Der Entwurf IST geöffnet — der Titel ist da, nur der übernommene Text fehlt. Genau deshalb
    // ist Schweigen hier so teuer: nichts sieht kaputt aus.
    expect(s.titel, "der Entwurf wurde gar nicht geöffnet").toBe(
      "Aus einem Original, das es nicht mehr gibt",
    );
    // DIE VORAUSSETZUNG DIESES FALLES, gemessen und nicht angenommen: der Server hat den Rumpf
    // wirklich zurückgehalten. Stünde die Aussage hier auf der Fläche, wäre die Ankerprüfung nicht
    // angesprungen (etwa weil die Belegstelle ihre Objektkennung nicht behalten hat) — dann prüfte
    // der Fall unten eine Lage, die es gar nicht gibt, und sein Grün wäre ein Scheinbeleg.
    expect(
      s.text,
      "der Rumpf kam mit — die Ankerprüfung des Servers hat nicht gegriffen, der Fall misst nichts",
    ).not.toContain(AUSSAGE);
    expect(
      gemeldet,
      `das Blatt schweigt über den zurückgehaltenen Text (Lage: ${JSON.stringify(s.lage)})`,
    ).toBe(true);
    expect(buehne.seitenfehler.slice(vorher), "die Seite hat geworfen").toEqual([]);
  });

  it("A5 — Absturz im Ladeweg: die Oberfläche zeigt trotzdem etwas", async () => {
    await anfahren(`/erfassen?draft=${ABSTURZ_KENNUNG}`);
    // Gewartet wird auf einen ENDZUSTAND der Erfassungsfläche — nicht darauf, dass irgendetwas im
    // Dokument steht: die Hülle (Kopfband, Navigation) steht schon, während die Seite noch
    // nachgeladen wird, und die Ladefläche „Lädt …" ist kein Ergebnis (gemessen im Lauf
    // 7b833ece39d86d84d3c21118, wo genau dieses Fenster den Fall rot gemacht hat). Ein Endzustand
    // ist die Lagezeile des Blattes ODER die Karte der Fehlergrenze der Route. Bleibt beides aus,
    // ist DAS der Befund, und er steht unten in der Meldung.
    const gesetzt = await warte(
      `(grenze) => document.querySelector('[data-testid="blatt-lage"]') !== null ||
         (document.body.innerText || document.body.textContent || "").includes(grenze)`,
      GRENZE_SATZ,
    );
    const s = await sicht();
    expect(gesetzt, `kein Endzustand nach dem Absturz; Text: ${s.text.slice(0, 400)}`).toBe(true);
    expect(
      s.wurzel,
      `WEISSE SEITE nach erzwungenem Absturz: #root hat ${s.wurzel} Kindknoten. Seitenfehler: ${buehne.seitenfehler.join(" | ")}`,
    ).toBeGreaterThan(0);
    expect(s.text.length, "die Fläche sagt nichts").toBeGreaterThan(0);
    // Entweder die Fehlergrenze der Route oder die Lagezeile des Blattes — eine der beiden MUSS
    // sprechen. Welche es ist, sagt die Fehlermeldung; leer sein darf keine.
    expect(
      s.text.includes(GRENZE_SATZ) || (s.lage !== null && s.lage.length > 0),
      `weder Fehlergrenze noch Lagezeile; Text: ${s.text.slice(0, 400)}`,
    ).toBe(true);
    // UND ES IST DER SATZ DES LADEWEGS, nicht irgendeiner: der Absturz ist im Ladeweg passiert, also
    // gehört er dorthin gemeldet (`ladeFehlerMeldung`, Blatt.tsx:204 — ein TypeError ist kein
    // ApiError, deshalb steht der ehrliche Rückfallsatz da und keine Servermeldung).
    if (!s.text.includes(GRENZE_SATZ)) {
      expect(s.lage, "die Meldung gehört dem Ladeweg").toContain(LADE_SATZ);
    }
    // DIE FLÄCHE BLEIBT BEDIENBAR. Ein Absturz im Ladeweg darf das Blatt nicht dauerhaft sperren —
    // sonst wäre die Meldung eine Auskunft ohne Ausweg.
    expect(
      await buehne.seite.evaluate<boolean>(
        fn(`() => { const t = document.querySelector('[data-testid="blatt-titel"]');
             return t === null ? false : t.disabled === false; }`),
      ),
      "das Titelfeld bleibt nach dem Absturz gesperrt",
    ).toBe(true);
  });

  it("A6 — Kaltstart ins Expertenformular: /erfassen?draft=<gültig>&weg=formular", async () => {
    // Eigene Bühne: dieser Fall misst einen KALTSTART, und ein Kaltstart ist mehr als ein neues
    // `goto` — die vorangehenden Fälle haben in dieser Seite einen Verlauf und einen gefüllten
    // Abfragecache hinterlassen. Gemessen werden soll der Mensch, der die Adresse aus der
    // Chrome-Leiste in ein frisches Fenster gibt.
    await buehne.schliessen();
    buehne = await buehneAufbauen("/erfassen");
    expect(buehne.fehler).toBeNull();
    const neu = await buehne.seite.evaluate<{ status: number; rumpf: string }>(
      fn(ANLEGEN),
      uebernahme("Spritzzonen: Hohlprofile vermeiden"),
    );
    expect(neu.status, neu.rumpf.slice(0, 200)).toBe(201);
    const id = (JSON.parse(neu.rumpf) as { id: string }).id;
    await anfahren(`/erfassen?draft=${id}&weg=formular`);
    const imFeld = await warte(
      `(aussage) => { const raum = document.querySelector('[data-testid="blatt-arbeitsraum"]');
         if (raum === null) return false;
         return [...raum.querySelectorAll("input, textarea")].some((f) => String(f.value || "").includes(aussage)); }`,
      AUSSAGE,
    );
    const s = await sicht();
    expect(s.wurzel, `WEISSE SEITE: #root hat ${s.wurzel} Kindknoten`).toBeGreaterThan(0);
    expect(s.arbeitsraum, `der Arbeitsraum ging nicht auf; Text: ${s.text.slice(0, 300)}`).toBe(
      true,
    );
    expect(
      imFeld,
      `kein Feld des Expertenformulars trägt die Aussage des Entwurfs; Text: ${s.text.slice(0, 400)}`,
    ).toBe(true);
    // Dieselbe Aussage aus der abschliessenden Sicht — nicht aus der Wartebedingung, damit hier ein
    // ENDZUSTAND und nicht ein einmal getroffener Zwischenstand belegt ist.
    expect(s.aussageImFeld, "die Aussage stand nur vorübergehend im Feld").toBe(true);
  }, 180_000);
});
