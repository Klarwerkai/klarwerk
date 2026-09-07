// @vitest-environment jsdom
// ================================================================================================
// JOB 3133 · UX-22 RUNDE 4 — DER DURCHGEHENDE FALL MIT NICHTLEERER INTERNER ALLOWLIST.
// ================================================================================================
//
// DER FEHLER, DEN DIESE DATEI FESTNAGELT (Codex R3, Korrekturpflicht 1): Runde 3 machte aus JEDEM
// Hinweis eine harte Knopfsperre. `sourceAttachHint` kennt die Origin-Allowlist des Betreibers
// aber nicht (externalAttachGate.ts:50-52) und stuft JEDE absolute http(s)-Adresse als
// „public-url" ein — auch `https://confluence.werk.local/…`, die der Betreiber ausdrücklich als
// intern eingetragen hat und die der Server mit 200 annimmt. Die Oberfläche sperrte damit einen
// Weg, den der Nutzer hat. Codex' Messung: Basisstand `{"reach":"internal","calls":1}` gegen
// Runde 3 `{"reach":"internal","ariaDisabled":"true","calls":0}`.
//
// WARUM HIER EIN ECHTER SERVER STEHT UND KEIN SPION: Die Prüflücke, die Codex benannt hat, ist
// genau die Stelle, an der Oberfläche und Server auseinanderlaufen können. Ein Prüfstand, der die
// Antwort selbst erfindet, könnte diese Lücke nicht sehen — er würde die Annahme messen, die zu
// prüfen ist. Deshalb läuft hier die ECHTE App (`buildApp(buildServices())`) mit einer ECHT
// gesetzten `KLARWERK_INTERNAL_SOURCE_ORIGINS`, und das Formular spricht über
// `globalThis.fetch` → `app.inject` mit ihr. Ersetzt ist allein der TRANSPORT (der Cookie-Beutel
// des Browsers; der Client schickt `credentials: "include"`, hier steht dafür der Bearer-Kopf) —
// keine Regel, keine Route, kein Urteil.
//
// DIE DREI FÄLLE DES KORRIGIERTEN §5.7, jeder vom Formular bis zum gespeicherten Bestand:
//   I1 sicher erlaubt   · interne Adresse aus der Allowlist  → Hinweis sichtbar, KEINE Sperre,
//                         Absenden geht durch, die Quelle steht danach im Bestand des Servers.
//   I2 sicher verboten  · öffentliche Adresse                → Absenden erlaubt, aber der SERVER
//                         weist ab (403), und es liegt hinterher KEINE Quelle im Bestand.
//                         Die „(403)" ist seit JOB 3178 gemessen: `anhaengeRufe()` im Fall I2 zeigt
//                         genau eine Anfrage, und deren `status` ist 403.
//   I3 sicher verboten  · ohne Adresse, ohne Anker           → hier weiss die Oberfläche es selbst
//                         (dieselbe Frage wie ko-routes.ts:1926-1930): harte Sperre, NULL Aufrufe.
//                         Die „NULL Aufrufe" sind seit JOB 3178 gemessen: I3 hält den Stand ALLER
//                         schreibenden Anfragen vor dem Klick fest und verlangt danach die
//                         Differenz 0 — jede Methode ausser GET/HEAD/OPTIONS, jeder Pfad.
//   I4 sicher erlaubt   · ohne Adresse, MIT Anker            → geht durch und wird gespeichert.
//
// ------------------------------------------------------------------------------------------------
// JOB 3178 · UX-22b — DIE ZWEI ZUSAGEN VON OBEN SIND JETZT GEMESSEN UND NICHT MEHR BEHAUPTET.
// ------------------------------------------------------------------------------------------------
//
// Bens Prüfpunkt 6 zu Runde 4 (`archiv/3133/runde-4/ben.md`): „I2 prüft bislang den leeren Bestand,
// aber nicht ausdrücklich Anfrage und Fehlercode; I3 zählt selbst keine Anfragen. Empfehlung: diese
// direkten Assertions dauerhaft aufnehmen." Codex' Nachfrage (CODEX-ANTWORT-80 §3) stellte fest:
// keine Regression im Produkt, sondern eine fehlende dauerhafte MESSUNG. Deshalb ändert JOB 3178
// nichts am Produkt, sondern schliesst die Lücke im Prüfstoff:
//   · I2 zeigt jetzt, dass die Fläche GENAU EINE `add-source`-Anfrage abgesetzt hat und dass DIESE
//     Anfrage mit 403 beantwortet wurde (der leere Bestand bleibt daneben stehen) — gemessen in
//     `anhaengeRufe()` und `rufe[0].status` im Fall I2.
//   · I3 zählt ALLE schreibenden Anfragen VOR und NACH dem Klick und verlangt die Differenz 0 —
//     gemessen in `schreibendeRufe()` im Fall I3, kalibriert in I0.
// Warum das nötig war: der leere Bestand kann auch aus dem falschen Grund entstehen. Eine Fläche,
// die im öffentlichen Fall gar nicht mehr fragt, hinterliesse ebenso einen leeren Bestand — und
// niemand prüfte je wieder die Serverregel. Umgekehrt bliebe eine gebrochene Sperre in I3
// unbemerkt, solange der Server die Anfrage ohnehin abweist.
//
// RUNDE 2 (Bens Korrekturpflicht 1 zu Runde 1): I3 zählte zunächst nur `PUT /api/kos/<id>` mit
// `action: "add-source"`. Bens Gegenprobe M4 schickte im gesperrten Klick dieselbe Quelle als POST
// — der Spion sah sie, der Filter nicht, I3 blieb grün. Der enge Filter dient jetzt nur noch I2
// (dort ist die Form die Frage); I3 zählt jede schreibende Methode auf jedem Pfad, und I0 belegt
// mit genau Bens M4-Anfrage, dass der Zähler sie findet.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import i18n from "../../apps/web/src/i18n";
import { SOURCE_ATTACH_HINT_KEYS } from "../../apps/web/src/lib/externalAttachGate";
import { buildApp, buildServices } from "../../services/app/src/build-app";
import {
  type Anfrage,
  type Prüfstand,
  anhangAuswahl,
  ausloesen,
  feldMitPlatzhalter,
  knopfMitText,
  montierenGegenServer,
  quellenAbschnitt,
  text,
  tippen,
  waehlen,
} from "./flaeche";

type App = ReturnType<typeof buildApp>;

// Genau die Konfiguration, mit der `tests/app/external-attach-gate-e2e.test.ts:43` arbeitet — die
// Allowlist ist Betreibersache und kommt aus der Umgebung, nie aus dem Code.
const INTERNE_ORIGINS = "intranet.werk.local, https://confluence.werk.local/";
const INTERNE_ADRESSE = "https://confluence.werk.local/pages/WN4711";
const OEFFENTLICHE_ADRESSE = "https://de.wikipedia.org/wiki/Dichtung_(Technik)";
const PDF_DATA_URL = `data:application/pdf;base64,${Buffer.from("%PDF-1.4 Pruefbericht").toString("base64")}`;

let vorherigeOrigins: string | undefined;
let stand: Prüfstand;

interface Aufbau {
  app: App;
  headers: Record<string, string>;
  koId: string;
}

/** Eine echte App mit Admin, Stufe `search_on_click` und einem echt hinterlegten Anhang. */
async function serverAufbauen(): Promise<Aufbau> {
  const app = buildApp(buildServices());
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "Admin", email: "a@x.de", password: "secret123" },
  });
  const anmeldung = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "a@x.de", password: "secret123" },
  });
  const headers = { authorization: `Bearer ${anmeldung.json().token}` };

  const stufe = await app.inject({
    method: "PUT",
    url: "/api/external/policy",
    headers,
    payload: { stage: "search_on_click" },
  });
  expect(stufe.statusCode, "die Stufe liess sich nicht setzen").toBe(200);

  const ko = await app.inject({
    method: "POST",
    url: "/api/kos",
    headers,
    payload: {
      title: "Dichtungswechsel L4",
      statement: "Dichtung vor jedem Anlauf prüfen.",
      type: "best_practice",
      category: "Instandhaltung",
    },
  });
  const koId = ko.json().id as string;

  // Der Anker entsteht über die ECHTEN Routen — ein direkt geschriebener Anhang umginge die
  // Prüfung, die hier belegt werden soll.
  const objekt = await app.inject({
    method: "POST",
    url: "/api/objects",
    headers,
    payload: { name: "Pruefbericht.pdf", mime: "application/pdf", data: PDF_DATA_URL },
  });
  expect(objekt.statusCode).toBeLessThan(300);
  const angehaengt = await app.inject({
    method: "PUT",
    url: `/api/kos/${koId}`,
    headers,
    payload: {
      action: "attach",
      attachment: {
        name: "Pruefbericht.pdf",
        mime: "application/pdf",
        objectId: objekt.json().id as string,
      },
    },
  });
  expect(angehaengt.statusCode).toBe(200);

  return { app, headers, koId };
}

/** Die Quellen, die WIRKLICH im Bestand des Servers liegen — gelesen, nicht angenommen. */
async function gespeicherteQuellen(
  aufbau: Aufbau,
): Promise<{ label: string; url: string | null }[]> {
  const ko = await aufbau.app.inject({
    method: "GET",
    url: `/api/kos/${aufbau.koId}`,
    headers: aufbau.headers,
  });
  return (ko.json().sources ?? []) as { label: string; url: string | null }[];
}

let aufbau: Aufbau;

const sperrhinweis = (): HTMLElement | null =>
  quellenAbschnitt(stand.container).querySelector("output");

const hinzufuegen = (): HTMLButtonElement => knopfMitText(stand.container, i18n.t("ko.sourceAdd"));

/**
 * Nur die Anfragen, die WIRKLICH eine Quelle anhängen wollten — der eine schreibende Weg des
 * Formulars (`MehrAbschnitte.tsx:234` → `endpoints.ko.act` → `api.put("/kos/<id>")`).
 * Gemessen, nicht abgeschrieben: der Rumpf trägt `action: "add-source"`.
 *
 * Dieser enge Filter gehört zu I2 und NUR dorthin: dort ist die Frage „hat die Fläche genau DIESE
 * eine Anfrage abgesetzt, und was kam zurück?". Für I3 wäre er zu eng — siehe `schreibendeRufe`.
 */
const anhaengeRufe = (): Anfrage[] =>
  stand.anfragen.filter(
    (a) =>
      a.method === "PUT" &&
      a.pfad === `/api/kos/${aufbau.koId}` &&
      (a.rumpf as { action?: string } | undefined)?.action === "add-source",
  );

/** Die Methoden, die nichts verändern — alles andere ist ein Schreibversuch. */
const LESENDE_METHODEN = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * JOB 3178 · RUNDE 2 (Ben, Korrekturpflicht 1) — ALLE schreibenden Anfragen, unabhängig von
 * Methode, Pfad und Rumpf.
 *
 * I3 fragt nicht „wurde eine add-source-Anfrage abgesetzt?", sondern „wurde ÜBERHAUPT etwas
 * abgesetzt?". Mit dem engen Filter von `anhaengeRufe` blieb das unbeantwortet: Bens Gegenprobe M4
 * schickte im gesperrten Klick eine echte Quellenanfrage als `POST /api/kos/<id>` — der Spion zeichnete
 * sie auf, der Filter sah sie nicht, I3 blieb grün. Die Sperre ist aber gebrochen, sobald irgendein
 * Schreibversuch rausgeht; welchen Weg er nimmt, ist dafür gleichgültig.
 */
const schreibendeRufe = (): Anfrage[] =>
  stand.anfragen.filter((a) => !LESENDE_METHODEN.has(a.method.toUpperCase()));

/** Für einen roten Lauf lesbar: was wirklich rausging und was zurückkam. */
const abgesetzt = (anfragen: Anfrage[] = stand.anfragen): string =>
  anfragen.length === 0
    ? "(nichts)"
    : anfragen.map((a) => `${a.method} ${a.pfad} → ${a.status ?? "ohne Antwort"}`).join(" · ");

beforeEach(async () => {
  vorherigeOrigins = process.env.KLARWERK_INTERNAL_SOURCE_ORIGINS;
  process.env.KLARWERK_INTERNAL_SOURCE_ORIGINS = INTERNE_ORIGINS;
  await i18n.changeLanguage("de");
  aufbau = await serverAufbauen();
  stand = await montierenGegenServer(aufbau.app, aufbau.headers, aufbau.koId);
});

afterEach(() => {
  stand.abbauen();
  if (vorherigeOrigins === undefined) {
    // `Reflect.deleteProperty` statt `delete`: die Ausnahme für `noDelete` in `biome.json:20-26`
    // gilt nur für `*.test.ts`, und ein `= undefined` schriebe in Node den STRING „undefined" in
    // die Umgebung — der Schlüssel muss wirklich weg, sonst hinge der nächste Test daran.
    Reflect.deleteProperty(process.env, "KLARWERK_INTERNAL_SOURCE_ORIGINS");
  } else {
    process.env.KLARWERK_INTERNAL_SOURCE_ORIGINS = vorherigeOrigins;
  }
});

describe("JOB 3133 · UX-22 R4 — die interne Adresse geht durch das Formular bis in den Bestand", () => {
  it("I0 · KALIBRIERUNG: die echte Fläche steht am echten Server, Stufe und Anhang sind da", async () => {
    expect(feldMitPlatzhalter(stand.container, i18n.t("ko.sourceUrl"))).toBeTruthy();
    // Die Stufe kam über die echte Route — sonst stünde hier gar kein Grund.
    expect(
      sperrhinweis(),
      "ohne geladene Stufe misst alles Weitere ein leeres Blatt",
    ).not.toBeNull();
    // Der Anker ist wirklich am Objekt: das Auswahlfeld hat ihn.
    expect(anhangAuswahl(stand.container)).not.toBeNull();

    // JOB 3178 · RUNDE 2 — DER ZÄHLER VON I3 IST SELBST KALIBRIERT (Ben, Prüflücken/M4).
    // Hier geht genau die Anfrage über dieselbe `fetch`-Grenze, mit der Bens Gegenprobe den alten,
    // zu engen Filter unterlief: eine echte Quellenanfrage, aber als POST statt PUT. Sie MUSS im
    // Schreibzähler auftauchen — sonst wäre die Null in I3 eine Aussage über den Zähler statt über
    // die Sperre. Der enge Filter von I2 darf sie umgekehrt gerade NICHT sehen; genau deshalb gibt
    // es zwei Auswahlen und nicht eine.
    const vorher = schreibendeRufe().length;
    await globalThis.fetch(`/api/kos/${aufbau.koId}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "add-source",
        source: { label: "Kalibrierung", url: OEFFENTLICHE_ADRESSE },
      }),
    });
    expect(
      schreibendeRufe()
        .slice(vorher)
        .map((a) => `${a.method} ${a.pfad}`),
      "der Schreibzähler übersieht eine Anfrage mit abweichender Methode",
    ).toEqual([`POST /api/kos/${aufbau.koId}`]);
    expect(anhaengeRufe(), "der enge Filter von I2 misst hier gerade nicht mit").toEqual([]);
  });

  it("I1 · interne Adresse: Grund sichtbar, KEINE Sperre — und die Quelle liegt danach im Bestand", async () => {
    await tippen(
      feldMitPlatzhalter(stand.container, i18n.t("ko.sourceLabel")),
      "Werksnorm WN-4711",
    );
    await tippen(feldMitPlatzhalter(stand.container, i18n.t("ko.sourceUrl")), INTERNE_ADRESSE);

    // Der Hinweis BLEIBT — die Oberfläche kennt die Allowlist nicht und behauptet nichts anderes.
    const grund = sperrhinweis();
    expect(grund, "der vorsichtige Grund gehört weiterhin an die Fläche").not.toBeNull();
    expect(text(grund as HTMLElement)).toContain(
      i18n.t(SOURCE_ATTACH_HINT_KEYS["public-url"].body),
    );

    // Aber er ist eben nur ein Hinweis: der Knopf bleibt bedienbar.
    const knopf = hinzufuegen();
    expect(
      knopf.getAttribute("aria-disabled"),
      "aus Nichtwissen wurde wieder eine Ablehnung gemacht",
    ).toBe("false");
    expect(knopf.disabled).toBe(false);

    await ausloesen(knopf);

    const quellen = await gespeicherteQuellen(aufbau);
    expect(
      quellen.map((q) => q.label),
      "die vom Betreiber erlaubte interne Quelle kam nicht im Bestand an",
    ).toEqual(["Werksnorm WN-4711"]);
    expect(quellen[0]?.url).toBe(INTERNE_ADRESSE);
  });

  it("I2 · öffentliche Adresse: absendbar, aber der SERVER weist ab — nichts wird gespeichert", async () => {
    await tippen(
      feldMitPlatzhalter(stand.container, i18n.t("ko.sourceLabel")),
      "Dichtung (Technik)",
    );
    await tippen(feldMitPlatzhalter(stand.container, i18n.t("ko.sourceUrl")), OEFFENTLICHE_ADRESSE);

    expect(sperrhinweis(), "auch hier steht der Grund").not.toBeNull();
    await ausloesen(hinzufuegen());

    // JOB 3178 · UX-22b (ben.md §6): DIE TRAGENDE AUSSAGE — es wurde wirklich GEFRAGT, und die
    // Antwort war wirklich 403. Ohne diesen Block bliebe der Fall auch dann grün, wenn die
    // Fläche den Knopf still ins Leere laufen liesse; dann prüfte niemand mehr die Serverregel.
    const rufe = anhaengeRufe();
    expect(
      rufe.length,
      `genau eine add-source-Anfrage erwartet, abgesetzt wurde: ${abgesetzt()}`,
    ).toBe(1);
    const rumpf = rufe[0]?.rumpf as { source?: { url?: string } } | undefined;
    expect(rumpf?.source?.url, "die abgesetzte Anfrage trug gar nicht diese Adresse").toBe(
      OEFFENTLICHE_ADRESSE,
    );
    // Das Literal steht hier bewusst und nicht als Verweis ins Produkt: ein anderer Ablehnungscode
    // muss diesen Fall kippen (ko-routes.ts, `EXTERNAL_ATTACH_BLOCKED`).
    expect(rufe[0]?.status, "der Server hat die öffentliche Quelle nicht mit 403 abgewiesen").toBe(
      403,
    );

    // Die Grenze zieht die Stelle, die sie ziehen kann. Fail-closed bleibt fail-closed.
    expect(
      await gespeicherteQuellen(aufbau),
      "eine öffentliche Quelle ist auf dieser Stufe verboten und darf nicht im Bestand liegen",
    ).toEqual([]);
  });

  it("I3 · ohne Adresse und ohne Anker: hier WEISS die Oberfläche es — harte Sperre, kein Aufruf", async () => {
    await tippen(feldMitPlatzhalter(stand.container, i18n.t("ko.sourceLabel")), "Handnotiz");

    const knopf = hinzufuegen();
    expect(knopf.getAttribute("aria-disabled")).toBe("true");
    // In der Tab-Folge bleibt er trotzdem (JOB-3126-Lehre).
    expect(knopf.disabled).toBe(false);
    expect(knopf.tabIndex).toBe(0);

    // JOB 3178 · UX-22b — KALIBRIERUNG VOR DEM KLICK.
    // Der Spion hat schon aufgezeichnet: die Montage fährt echte Abfragen (`/api/auth/me`,
    // `/api/external/policy`, `/api/kos/<id>` …). Die sind alle LESEND, der Schreibzähler steht
    // beim heutigen Stand also bei 0 — gemessen wird trotzdem die DIFFERENZ und nicht die
    // Gesamtzahl, damit eine Montage, die später einmal selbst schreibt, den Klick nicht
    // verdecken kann.
    // Dass der Zähler überhaupt etwas finden KANN, belegt I0 mit einer echten Schreibanfrage über
    // dieselbe `fetch`-Grenze — sonst wäre die Null hier eine Aussage über den Zähler statt über
    // die Sperre (ui-smoke.spec.ts:196).
    expect(stand.anfragen.length, "der Spion hat gar nichts aufgezeichnet").toBeGreaterThan(0);
    const vorher = schreibendeRufe().length;

    await ausloesen(knopf);

    // Die eigentliche Zusage des Kopfkommentars („NULL Aufrufe"): der Klick hat NICHTS abgesetzt —
    // und zwar auf KEINEM Weg. Gezählt wird jede Methode ausser GET/HEAD/OPTIONS, damit die Sperre
    // auch dann als gebrochen gilt, wenn die Fläche ihre Quelle über einen anderen Pfad oder mit
    // einer anderen Methode losschickte (Ben, JOB 3178 R1, Gegenprobe M4).
    const nachher = schreibendeRufe();
    expect(
      nachher.length - vorher,
      `die gesperrte Aktion setzte Schreibanfragen ab: ${abgesetzt(nachher.slice(vorher))} · alles: ${abgesetzt()}`,
    ).toBe(0);
    expect(
      await gespeicherteQuellen(aufbau),
      "die sicher verbotene Aktion wurde trotzdem abgesetzt",
    ).toEqual([]);
  });

  it("I4 · ohne Adresse, MIT Anker: geht durch und wird gespeichert", async () => {
    await tippen(
      feldMitPlatzhalter(stand.container, i18n.t("ko.sourceLabel")),
      "Seite 4, Absatz 2",
    );
    const auswahl = anhangAuswahl(stand.container) as HTMLSelectElement;
    const ankerWert = [...auswahl.options].map((o) => o.value).find((v) => v.length > 0);
    expect(ankerWert, "das Objekt trägt keinen ankerfähigen Anhang").toBeTruthy();
    await waehlen(auswahl, ankerWert as string);

    expect(sperrhinweis(), "mit gültigem Anker gilt die Sperre nicht mehr").toBeNull();
    await ausloesen(hinzufuegen());

    const quellen = await gespeicherteQuellen(aufbau);
    expect(quellen.map((q) => q.label)).toEqual(["Seite 4, Absatz 2"]);
    // Der Anker ist Zulassungsnachweis, kein gespeichertes Feld — die Adresse bleibt leer.
    expect(quellen[0]?.url).toBeNull();
  });
});
