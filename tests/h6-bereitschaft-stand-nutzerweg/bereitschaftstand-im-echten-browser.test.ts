// ================================================================================================
// JOB 4363 · DER STAND DER BEREITSCHAFTSKARTE — GEMESSEN IM ECHTEN CHROMIUM, DE/EN/NL, 320/1280.
// ================================================================================================
//
// DIE FRAGE DIESES LAUFS ist die von Abnahmekriterium K5: sieht ein Mensch in der GEBAUTEN Fläche
// den vollständigen Hinweis, den bestätigten Abrufstand, den Wiederholen-Knopf und dessen
// SICHTBAREN Fokus — auf dem Schreibtisch und auf der schmalsten Kante, in allen drei Sprachen?
// Und bleiben die vorhandenen Bereitschaftswerte dabei korrekt stehen?
//
// KEIN ÜBERSPRUNG, NIRGENDS. In dieser Datei steht kein `ctx.skip()`. Fehlt `apps/web/dist`, baut
// `stelleFlaecheBereit()` es oder scheitert laut; im Tor läuft `./tools/build` ohnehin davor
// (`tools/check:9`). Ein stiller Übersprung sähe aus wie ein bestandener Lauf.
//
// DIE LAGEN, die hier nacheinander HERGESTELLT und gemessen werden — jede am Abrufzähler:
//   A  frisch geladen ....... KEIN Hinweis, sechs Zeilen (die Kalibrierung: ohne sie sagte das
//                             Erscheinen des Hinweises nichts)
//   B  Verbindung weg ....... Werte bleiben, „Stand von HH:MM · ohne Netzverbindung nicht
//                             aktualisiert", KEIN Wiederholen, KEIN weiterer Abruf
//   C  Verbindung zurück .... Zähler UNVERÄNDERT (die Wiederverbindung innerhalb der produktiven
//                             Frist ist kein neuer Abruf), Hinweis sagt jetzt „seit der
//                             Unterbrechung ist keine neue Antwort angekommen", Wiederholen ist
//                             da — per Tab erreichbar, Fokus am berechneten Stil SICHTBAR
//   D1 Enter auf dem Knopf .. sechs echte Abrufe, danach ist der Hinweis fort
//   D2 derselbe Knopf mit der MAUS — derselbe Nachweis, der zweite Bedienweg
//   D3 ein WIRKLICH gescheiterter Abruf (503 auf `/api/reasoner/config`) trägt seinen EIGENEN
//      Satz, nicht den der Netzlücke und nicht den des Offlinefalls; danach die Erholung.
//
// WAS NICHT GEMESSEN WIRD: andere Browser, Bildschirmleser, der Word-Add-in-Host, echte
// PostgreSQL. Das Zusammenspiel mit der Frist (kurze gegen lange Unterbrechung, automatische
// Nachholung) misst daneben `bereitschaftstand-nutzerweg.test.tsx` an der echten Karte mit der
// produktiven Frischefrist und virtueller Uhr.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  type Browser,
  type Kontext,
  type Seite,
  fn,
  mitFlaeche,
  starteChromium,
} from "../gast-nutzerweg/browserweg";
import { PASSWORT, type Strecke, ersteinrichtung, starteStrecke } from "../gast-nutzerweg/strecke";
import { meldeAnMitTastatur, stelleFlaecheBereit } from "../gesamtanweisung-nutzerweg/weg";
import { sprachbestand } from "../support/i18nBestand";
import {
  BREIT,
  HINWEIS,
  KARTE,
  MARKE,
  QUELLPFADE,
  SCHMAL,
  SPRACHEN,
  abrufe,
  abrufstand,
  antwortenFuer,
  hinweisDa,
  hinweisDarfNichtTragen,
  hinweisMussSichtbarTragen,
  karteOffen,
  keineVerzoegerungMehr,
  knopfBeschriftung,
  lassHaengen,
  lassScheitern,
  minuteVon,
  mussSichtbarTragen4363,
  sollwerte,
  stoere,
  warteAufAbrufe,
  wiederholenMitMaus,
  wiederholenMitTastatur,
} from "./weg";

/** Die eine Quelle, die zur ÄLTESTEN gemacht und danach allein beantwortet wird. */
const KI_QUELLE = "/api/reasoner/config";
/** Die Quelle, die in Runde 3 NACH dem Teilerfolg scheitert (BENs Kennzahlquelle). */
const KENNZAHL_QUELLE = "/api/analytics";

/**
 * Ein echtes Fensterfokus-Ereignis — der EINZIGE störungsfreie Auffrischungsauslöser des Produkts.
 *
 * AM FENSTER, nicht am Dokument: `focusManager` hängt seinen Zuhörer ausdrücklich dorthin
 * (`@tanstack/query-core/build/modern/focusManager.js:12`, `window.addEventListener
 * ("visibilitychange", …)`). Ein erster Versuch dieser Runde schickte das Ereignis ans Dokument —
 * es kam nie an, und es ging KEIN Abruf hinaus (Arbeitsprüfung 8555a56b…). Zurück meldet die
 * Auskunft `document.visibilityState`, das in diesem Tab „visible" ist.
 *
 * Das ist das Ereignis, das ein Mensch durch Zurückwechseln zum Fenster auslöst — nichts, was
 * dieser Prüfstand erfindet.
 */
const FOKUS_EREIGNIS = `() => {
  window.dispatchEvent(new Event("visibilitychange"));
  return document.visibilityState;
}`;

const ADMIN = "bereitschaftstand-admin@job4363.test";

let strecke: Strecke | undefined;
let browser: Browser | undefined;

beforeAll(async () => {
  process.stderr.write(`${MARKE}: gebaute Fläche — ${stelleFlaecheBereit()}\n`);
  browser = await starteChromium();
  strecke = await starteStrecke(mitFlaeche());
  await ersteinrichtung(strecke, ADMIN);
}, 900_000);

afterAll(async () => {
  await browser?.close();
  await strecke?.schliessen();
}, 60_000);

function zeug(): { browser: Browser; strecke: Strecke } {
  if (!browser || !strecke) {
    throw new Error(`${MARKE}: Browser oder Strecke fehlen — der Aufbau ist nicht durchgelaufen.`);
  }
  return { browser, strecke };
}

const HINWEIS_ROH = `(sel) => {
  const el = document.querySelector(sel);
  return el ? (el.innerText || "").replace(/\\s+/g, " ").trim() : "(kein Hinweis)";
}`;

/**
 * Auf einen Zustand der SEITE warten, der sich nur über MEHRERE Abfragen feststellen lässt.
 *
 * `warte()` aus `browserweg.ts` reicht genau EINE Funktion in die Seite hinein; die hier gestellten
 * Fragen setzen sich aus mehreren `evaluate`-Aufrufen zusammen. Die Frist ist ausdrücklich endlich
 * und scheitert LAUT, mit dem zuletzt gelesenen Hinweistext in der Meldung.
 */
async function warteBis(
  seite: Seite,
  pruefen: () => Promise<boolean>,
  was: string,
  frist = 30_000,
): Promise<void> {
  const ende = Date.now() + frist;
  for (;;) {
    if (await pruefen()) {
      return;
    }
    if (Date.now() > ende) {
      const stand = await seite
        .evaluate<string>(fn(HINWEIS_ROH), HINWEIS)
        .catch(() => "(nicht lesbar)");
      throw new Error(`${MARKE}: ${was} — nicht eingetreten in ${frist} ms. Hinweis: „${stand}"`);
    }
    await new Promise((r) => setTimeout(r, 100));
  }
}

async function anmelden(seite: Seite, basis: string): Promise<void> {
  await meldeAnMitTastatur(seite, basis, ADMIN, PASSWORT);
}

/** Der SICHTBARE Text der Kartenzeilen — die Werte, die bei jeder Störung stehen bleiben müssen. */
async function kartentext(seite: Seite, was: string): Promise<string> {
  return mussSichtbarTragen4363(seite, KARTE, [], `die Bereitschaftskarte (${was})`);
}

/**
 * Die Netzlücke herstellen: kurz weg, gleich wieder da — und warten, bis die Fläche beides
 * wirklich verarbeitet hat. Ohne die Wartepunkte hinge der nächste Schritt an der Laufzeit der
 * Ereigniszustellung und nicht am Produkt.
 */
async function netzlueckeHerstellen(kontext: Kontext, seite: Seite): Promise<void> {
  await kontext.setOffline(true);
  await warteBis(seite, () => hinweisDa(seite), "der Standhinweis erscheint nach dem Abbruch");
  await kontext.setOffline(false);
  await warteBis(
    seite,
    async () => (await knopfBeschriftung(seite)) !== null,
    "der Wiederholen-Knopf erscheint nach der Wiederverbindung",
  );
}

const KANTEN = [
  { name: "320px", masse: SCHMAL },
  { name: "Desktop", masse: BREIT },
] as const;

describe("JOB 4363 · der Stand der Bereitschaftskarte in der gebauten Fläche", () => {
  for (const sprache of SPRACHEN) {
    for (const kante of KANTEN) {
      it(`K1/K2/K3/K5 (${sprache}, ${kante.name}) — Werte bleiben, der Hinweis sagt die Wahrheit, Wiederholen geht per Tastatur und Maus`, async () => {
        const { browser: b, strecke: s } = zeug();
        const soll = sollwerte(sprache);
        const laedt = sprachbestand(sprache)["adm.ready.loading"] ?? "";
        expect(laedt, `${MARKE}: „adm.ready.loading" fehlt im Katalog „${sprache}"`).toBeTruthy();

        const { kontext, seite } = await karteOffen(
          b,
          s.basis,
          sprache,
          kante.masse,
          anmelden,
          laedt,
        );
        try {
          // ══ A · KALIBRIERUNG DES AUSGANGSZUSTANDS ═══════════════════════════════════════════
          expect(
            await hinweisDa(seite),
            `${MARKE}: die frisch geladene Karte trägt schon einen Standhinweis — dann sagt sein Erscheinen nichts`,
          ).toBe(false);
          expect(await kartentext(seite, "A frisch")).toContain(soll.uploadZeile);
          // Der Grundstand der Zähler: gemessen, nicht angenommen. Alles Weitere wird GEGEN ihn
          // gerechnet — so trägt der Nachweis auch dann, wenn die Fläche selbst eine der sechs
          // Quellen ein zweites Mal hält.
          const grund = await abrufe(seite);
          expect(
            grund,
            `${MARKE}: die Karte hat ihre sechs tragenden Quellen gar nicht geholt`,
          ).toBeGreaterThanOrEqual(6);

          // ══ B · DIE VERBINDUNG IST WEG — und es hat KEINEN Versuch gegeben ══════════════════
          const begonnen = Date.now();
          await kontext.setOffline(true);
          await warteBis(seite, () => hinweisDa(seite), "der Standhinweis erscheint offline");
          await hinweisMussSichtbarTragen(
            seite,
            [soll.standVon, soll.offline],
            `offline (${sprache}, ${kante.name})`,
          );
          await abrufstand(seite);
          await hinweisDarfNichtTragen(seite, soll.gescheitert, `offline (${sprache})`);
          expect(
            await abrufe(seite),
            `${MARKE}: ohne Netz wurde trotzdem abgerufen — dann wäre „nicht aktualisiert" die falsche Auskunft`,
          ).toBe(grund);
          expect(
            await knopfBeschriftung(seite),
            `${MARKE}: ohne Netz steht ein Wiederholen-Knopf da, der nichts bewirken kann`,
          ).toBeNull();
          expect(await kartentext(seite, "B offline")).toContain(soll.uploadZeile);

          // ══ C · DIE VERBINDUNG IST ZURÜCK — das allein ist kein neuer Abruf ═════════════════
          await kontext.setOffline(false);
          await warteBis(
            seite,
            async () => (await knopfBeschriftung(seite)) !== null,
            "der Wiederholen-Knopf erscheint nach der Wiederverbindung",
          );
          const gedauert = Date.now() - begonnen;
          expect(
            await abrufe(seite),
            `${MARKE}: die Wiederverbindung hat von selbst nachgeholt (Unterbrechung ${gedauert} ms; die produktive Frischefrist beträgt 30000 ms — dauerte sie länger, ist das eine überlastete Maschine und keine Produktaussage)`,
          ).toBe(grund);
          await hinweisMussSichtbarTragen(
            seite,
            [soll.standVon, soll.netzluecke],
            `Netzlücke (${sprache}, ${kante.name})`,
          );
          await hinweisDarfNichtTragen(seite, soll.gescheitert, `Netzlücke (${sprache})`);
          await hinweisDarfNichtTragen(seite, soll.offline, `Netzlücke (${sprache})`);
          expect(await knopfBeschriftung(seite)).toBe(soll.wiederholen);
          expect(await kartentext(seite, "C Netzlücke")).toContain(soll.uploadZeile);

          // ══ D1 · WIEDERHOLEN MIT DER TASTATUR, Fokus SICHTBAR ═══════════════════════════════
          await wiederholenMitTastatur(seite, soll.wiederholen);
          await warteAufAbrufe(seite, grund + 6);
          await warteBis(
            seite,
            async () => (await hinweisDa(seite)) === false,
            "der Hinweis verschwindet nach der erfolgreichen neuen Antwort",
          );
          expect(await kartentext(seite, "D1 nach Tastatur")).toContain(soll.uploadZeile);

          // ══ D2 · DERSELBE KNOPF MIT DER MAUS ════════════════════════════════════════════════
          const vorMaus = await abrufe(seite);
          await netzlueckeHerstellen(kontext, seite);
          await wiederholenMitMaus(seite);
          await warteAufAbrufe(seite, vorMaus + 6);
          await warteBis(
            seite,
            async () => (await hinweisDa(seite)) === false,
            "der Hinweis verschwindet nach dem Mausklick",
          );

          // ══ D3 · EIN WIRKLICH GESCHEITERTER ABRUF trägt seinen EIGENEN Satz ═════════════════
          const vorFehler = await abrufe(seite);
          await netzlueckeHerstellen(kontext, seite);
          await stoere(seite, "/api/reasoner/config");
          await wiederholenMitMaus(seite);
          await warteAufAbrufe(seite, vorFehler + 6);
          await warteBis(
            seite,
            async () => {
              const roh = await seite.evaluate<string>(fn(HINWEIS_ROH), HINWEIS);
              return roh.includes(soll.gescheitert);
            },
            "der Hinweis nennt den gescheiterten Abruf",
          );
          await hinweisMussSichtbarTragen(
            seite,
            [soll.standVon, soll.gescheitert],
            `gescheiterter Abruf (${sprache}, ${kante.name})`,
          );
          await hinweisDarfNichtTragen(seite, soll.offline, `gescheiterter Abruf (${sprache})`);
          await hinweisDarfNichtTragen(seite, soll.netzluecke, `gescheiterter Abruf (${sprache})`);
          expect(await kartentext(seite, "D3 gescheiterter Abruf")).toContain(soll.uploadZeile);

          // … und die Erholung: Störung weg, noch einmal wiederholen, Hinweis fort.
          const vorErholung = await abrufe(seite);
          await stoere(seite, null);
          await wiederholenMitMaus(seite);
          await warteAufAbrufe(seite, vorErholung + 6);
          await warteBis(
            seite,
            async () => (await hinweisDa(seite)) === false,
            "der Hinweis verschwindet nach der Erholung",
          );
          expect(await kartentext(seite, "D3 nach Erholung")).toContain(soll.uploadZeile);
        } finally {
          await kontext.close();
        }
      }, 300_000);
    }
  }

  // ══════════════════════════════════════════════════════════════════════════════════════════
  // RUNDE 2 · BENs KORREKTURPFLICHT 2 — DIE TEILANTWORT, IN DER GEBAUTEN FLÄCHE.
  // ══════════════════════════════════════════════════════════════════════════════════════════
  //
  // BEN hat an Runde 1 gemessen, dass EINE nachgeholte Antwort den angezeigten Stand erneuerte,
  // obwohl fünf Quellen noch unterwegs waren — Stand UND Netzlückensatz waren fort. Seine zweite
  // Korrekturpflicht verlangt diesen Fall ausdrücklich auch im gebauten Browser.
  //
  // DIE STAFFELUNG WIRD HERGESTELLT, BEVOR DIE STÖRUNG BEGINNT — und das ist der Punkt, an dem
  // ein erster Versuch dieser Runde noch danebenlag: Staffelt man erst INNERHALB der Episode
  // (fünf erneuern sich per Wiederholung, eine scheitert), dann haben jene fünf seit
  // Störungsbeginn sehr wohl geantwortet, und die letzte Antwort schliesst die Episode
  // vollkommen zu Recht. BENs Fall ist der andere: die Quellen sind SCHON verschieden alt, wenn
  // die Verbindung wegbricht, und danach meldet sich nur die älteste zurück.
  //
  // Hergestellt wird das mit einer KURZEN Verzögerung beim Seitenaufbau: `/api/reasoner/config`
  // antwortet sofort, die anderen fünf 1,5 s später. Kein Fehler, keine Offlinephase, also auch
  // keine Episode — nur sechs Quellen mit verschiedenem Alter.
  //
  // WARUM AUSDRÜCKLICH KURZ (BENs Befund an Runde 3): dieser Fall sichert unten zu, dass die
  // Wiederverbindung NICHTS von selbst nachholt. Das gilt nur, solange alle sechs Quellen
  // innerhalb der Frischefrist von 30 s liegen. Runde 3 staffelte hier versehentlich bis über die
  // nächste Minutengrenze — dann war die älteste Quelle je nach Startsekunde über 30 s alt, der
  // Reconnect holte sie zu Recht nach, und der Fall scheiterte an seiner eigenen Vorbedingung
  // (`expected 7 to be 6`).
  //
  // WAS DIESER FALL BELEGT UND WAS NICHT: entscheidend ist der SATZ. Die Uhrzeit wird zusätzlich
  // verglichen, trägt hier aber wenig: sie steht als HH:MM da, und der ganze Ablauf spielt in
  // derselben Minute. Die zeitgenaue Aussage misst der Fall „BEN R3" darunter (Staffelung über
  // die Minutengrenze) und `bereitschaftstand-nutzerweg.test.tsx` (Abschnitt K2/K3) an
  // virtueller Uhr.
  it("BEN R2 · gebaute Fläche: eine nachgeholte Antwort von sechs erneuert den Stand NICHT", async () => {
    const { browser: b, strecke: s } = zeug();
    const soll = sollwerte("de");
    const laedt = sprachbestand("de")["adm.ready.loading"] ?? "";
    // (1) Die Staffelung VOR jeder Störung: die KI-Quelle ist die älteste, die fünf anderen sind
    //     1,5 s jünger. Ohne Fehler, ohne Offline — also ohne offene Episode.
    const { kontext, seite } = await karteOffen(
      b,
      s.basis,
      "de",
      SCHMAL,
      anmelden,
      laedt,
      QUELLPFADE.filter((p) => p !== KI_QUELLE),
    );
    try {
      await keineVerzoegerungMehr(seite);
      expect(
        await hinweisDa(seite),
        `${MARKE}: die gestaffelte Karte trägt schon einen Hinweis — dann gab es doch eine Störung`,
      ).toBe(false);
      const grund = await abrufe(seite);

      // (2) Jetzt erst bricht die Verbindung weg und kommt zurück: die Episode merkt sich die
      //     SECHS unterschiedlichen Stände. Nachgeholt wird dabei nichts (alles noch frisch).
      await netzlueckeHerstellen(kontext, seite);
      expect(
        await abrufe(seite),
        `${MARKE}: die Wiederverbindung hat nachgeholt — dann ist die Staffelung schon aufgelöst`,
      ).toBe(grund);
      await hinweisMussSichtbarTragen(
        seite,
        [soll.standVon, soll.netzluecke],
        "Netzlücke bei gestaffelten Ständen (de, 320px)",
      );
      const standVorher = await abrufstand(seite);

      // (3) Jetzt antwortet GENAU DIE ÄLTESTE Quelle, und die fünf anderen bleiben unterwegs.
      await lassHaengen(
        seite,
        QUELLPFADE.filter((p) => p !== KI_QUELLE),
      );
      const empfangenVorher = await antwortenFuer(seite, KI_QUELLE);
      const vorTeilantwort = await abrufe(seite);
      await wiederholenMitMaus(seite);
      await warteAufAbrufe(seite, vorTeilantwort + 6);
      await warteBis(
        seite,
        async () => (await antwortenFuer(seite, KI_QUELLE)) > empfangenVorher,
        "die älteste Quelle hat wirklich eine Antwort EMPFANGEN (nicht nur eine Anfrage gesendet)",
      );

      // (4) DER KERN: der Stand ist derselbe wie vorher, und der Netzlückensatz steht noch da.
      //     Runde 1 zeigte hier nur noch „wird gerade aufgefrischt".
      await hinweisMussSichtbarTragen(
        seite,
        [soll.standVon, soll.netzluecke],
        "Teilantwort (de, 320px) — eine von sechs hat geantwortet",
      );
      expect(
        await abrufstand(seite),
        `${MARKE}: die Teilantwort hat den angezeigten Abrufstand verschoben`,
      ).toBe(standVorher);
      expect(await kartentext(seite, "BEN R2 Teilantwort")).toContain(soll.uploadZeile);
      expect(
        await knopfBeschriftung(seite),
        `${MARKE}: der manuelle Weg fehlt, obwohl fünf Antworten ausstehen`,
      ).toBe(soll.wiederholen);

      // (5) Und erst wenn alle sechs geantwortet haben, ist die Episode vorbei.
      await lassHaengen(seite, []);
      const vorErholung = await abrufe(seite);
      await wiederholenMitMaus(seite);
      await warteAufAbrufe(seite, vorErholung + 6);
      await warteBis(
        seite,
        async () => (await hinweisDa(seite)) === false,
        "der Hinweis verschwindet erst nach der vollständigen Erneuerung",
      );
      expect(await kartentext(seite, "BEN R2 nach Erholung")).toContain(soll.uploadZeile);
    } finally {
      await kontext.close();
    }
  }, 300_000);

  // ══════════════════════════════════════════════════════════════════════════════════════════
  // RUNDE 3 · BENs KORREKTURPFLICHT 2 — DIE REIHENFOLGE OHNE OFFLINEPHASE, IM GEBAUTEN BROWSER.
  // ══════════════════════════════════════════════════════════════════════════════════════════
  //
  // BENs Messung an Runde 2: Stände 10:00 (älteste) und 10:01 (fünf); eine Auffrischung OHNE
  // vorherige Offlinephase, die älteste antwortet zuerst ERFOLGREICH, erst danach scheitert eine
  // andere. Sichtbar war „Stand von 10:01 · …", richtig ist 10:00.
  //
  // WARUM DIESER FALL LÄNGER DAUERT ALS DIE ANDEREN, ausdrücklich benannt: er braucht zweierlei
  // echte Zeit, und beides ist durch nichts zu ersetzen, ohne die Zusage zu verwässern.
  //   · Die Staffelung muss über eine MINUTENGRENZE gehen. Die Karte schreibt HH:MM; lägen beide
  //     Stände in derselben Minute, wäre „der Stand hat sich nicht verschoben" trivial wahr und
  //     bewiese nichts. Die fünf jüngeren Quellen antworten deshalb erst 2 s nach der nächsten
  //     Minutengrenze (höchstens rund 62 s Wartezeit, im Mittel die Hälfte).
  //   · Die Auffrischung muss OHNE Störung anlaufen. Der einzige störungsfreie Auslöser im
  //     Produkt ist das Fensterfokus-Ereignis, und react-query holt dabei nur ABGELAUFENE
  //     Abfragen (`refetchOnWindowFocus` + `staleTime`). Bis auch die jüngeren Quellen abgelaufen
  //     sind, vergeht die produktive Frischefrist von 30 s — sie zu senken verbietet K4.
  it("BEN R3 · gebaute Fläche: Teilantwort VOR dem ersten Fehler zieht den Stand nicht vor", async () => {
    const { browser: b, strecke: s } = zeug();
    const soll = sollwerte("de");
    const laedt = sprachbestand("de")["adm.ready.loading"] ?? "";
    const juengere = QUELLPFADE.filter((p) => p !== KI_QUELLE);
    const { kontext, seite } = await karteOffen(
      b,
      s.basis,
      "de",
      SCHMAL,
      anmelden,
      laedt,
      juengere,
      // ÜBER die Minutengrenze: nur dieser Fall vergleicht die angezeigte Uhrzeit, und die steht
      // als HH:MM da. Die übrigen Fälle staffeln bewusst nur kurz — siehe `Verzoegerungsart`.
      "minutengrenze",
    );
    try {
      await keineVerzoegerungMehr(seite);

      // (1) KALIBRIERUNG DER STAFFELUNG: die beiden Abrufzeitpunkte liegen in VERSCHIEDENEN
      //     Minuten — sonst misst der Vergleich unten nichts.
      const minuteAlt = await minuteVon(seite, KI_QUELLE);
      const minuteNeu = await minuteVon(seite, juengere[0] ?? "");
      expect(minuteAlt, `${MARKE}: die älteste Quelle hat gar nicht geantwortet`).not.toBeNull();
      expect(
        minuteNeu,
        `${MARKE}: die Staffelung ist nicht entstanden — beide Stände zeigen „${minuteAlt}"; dann wäre „der Stand bleibt" eine Zusicherung ohne Gegenstand`,
      ).not.toBe(minuteAlt);
      expect(
        await hinweisDa(seite),
        `${MARKE}: die gestaffelte Karte trägt schon einen Hinweis — dann gab es doch eine Störung`,
      ).toBe(false);

      // (2) Warten, bis auch die jüngeren Quellen abgelaufen sind (produktive Frist, 30 s), und
      //     die fünf ab jetzt hängen lassen. Dann ein echtes Fokus-Ereignis: react-query holt
      //     alle sechs — ohne dass irgendetwas gestört wäre.
      await new Promise((weiter) => setTimeout(weiter, 31_000));
      await lassHaengen(seite, juengere);
      const vorAuffrischung = await abrufe(seite);
      const empfangenVorher = await antwortenFuer(seite, KI_QUELLE);
      expect(
        await seite.evaluate<string>(fn(FOKUS_EREIGNIS)),
        `${MARKE}: der Tab gilt als verborgen — dann holt react-query beim Fokus nichts nach`,
      ).not.toBe("hidden");
      await warteAufAbrufe(seite, vorAuffrischung + 6);
      await warteBis(
        seite,
        async () => (await antwortenFuer(seite, KI_QUELLE)) > empfangenVorher,
        "die älteste Quelle hat wirklich eine Antwort EMPFANGEN",
      );

      // (3) Es ist (noch) KEINE Störung: ruhige Zeile mit dem bestätigten Stand von damals.
      await hinweisMussSichtbarTragen(
        seite,
        [soll.standVon, soll.laeuft],
        "Auffrischung ohne Störung (de, 320px)",
      );
      await hinweisDarfNichtTragen(seite, soll.gescheitert, "Auffrischung ohne Störung");
      await hinweisDarfNichtTragen(seite, soll.netzluecke, "Auffrischung ohne Störung");
      expect(
        await knopfBeschriftung(seite),
        `${MARKE}: eine störungsfreie Auffrischung bietet einen Wiederholen-Knopf an`,
      ).toBeNull();
      expect(
        await abrufstand(seite),
        `${MARKE}: die Teilantwort hat den angezeigten Abrufstand auf die jüngere Minute gezogen`,
      ).toBe(minuteAlt);

      // (4) UND ERST JETZT scheitert eine andere Quelle. Genau hier stand in Runde 2 „10:01".
      //
      //     Die Kennzahlquelle muss dafür ZUERST aus der Hängeliste: react-query wiederholt einen
      //     gescheiterten Abruf einmal (`retry: 1`, `main.tsx:44`), und diese Wiederholung bliebe
      //     sonst wieder hängen — die Abfrage käme nie im Fehlerzustand an (gemessen,
      //     Arbeitsprüfung b0a176c7…: der Hinweis blieb bei „wird gerade aufgefrischt"). Der 503
      //     fängt die Wiederholung ab; die VIER übrigen Quellen hängen weiter.
      await lassHaengen(
        seite,
        juengere.filter((p) => p !== KENNZAHL_QUELLE),
      );
      await stoere(seite, KENNZAHL_QUELLE);
      expect(
        await lassScheitern(seite, KENNZAHL_QUELLE),
        `${MARKE}: es hing gar keine Anfrage der Kennzahlquelle — dann misst dieser Schritt nichts`,
      ).toBeGreaterThan(0);
      await warteBis(
        seite,
        async () => {
          const roh = await seite.evaluate<string>(fn(HINWEIS_ROH), HINWEIS);
          return roh.includes(soll.gescheitert);
        },
        "der Hinweis nennt den gescheiterten Abruf",
      );
      await hinweisMussSichtbarTragen(
        seite,
        [soll.standVon, soll.gescheitert],
        "Teilerfolg dann Fehler (de, 320px)",
      );
      expect(
        await abrufstand(seite),
        `${MARKE}: der Fehler nach dem Teilerfolg hat den bestätigten Stand auf die jüngere Minute gezogen (erwartet „${minuteAlt}", jünger wäre „${minuteNeu}")`,
      ).toBe(minuteAlt);
      expect(await kartentext(seite, "BEN R3 Teilerfolg dann Fehler")).toContain(soll.uploadZeile);

      // (5) Erholung: alles frei, wiederholen, Hinweis fort.
      await stoere(seite, null);
      await lassHaengen(seite, []);
      const vorErholung = await abrufe(seite);
      await wiederholenMitMaus(seite);
      await warteAufAbrufe(seite, vorErholung + 6);
      await warteBis(
        seite,
        async () => (await hinweisDa(seite)) === false,
        "der Hinweis verschwindet erst nach der vollständigen Erneuerung",
      );
    } finally {
      await kontext.close();
    }
  }, 300_000);
});

// ================================================================================================
// DIE KALIBRIERUNG — derselbe Nachweis, gezielt verstellt, und er MUSS daran scheitern.
// ================================================================================================
//
// Ohne sie wäre oben nur behauptet, dass die Prüfungen etwas sehen. Verstellt wird in der LEBENDEN
// Seite, an genau der Stelle, um die es geht, bei sonst unveränderter Fläche — und geprüft wird
// nicht ein Nachbau, sondern GENAU DIESELBEN Stationsfunktionen aus `weg.ts`, die der Nachweis
// oben ruft. Beide vom Auftrag (K5) verlangten Fehlerklassen kommen vor:
//
//   G1  FALSCHER FEHLERWORTLAUT — der Offlinehinweis trägt plötzlich „Aktualisierung
//       fehlgeschlagen". Genau das war der Befund, gegen den dieser Auftrag gebaut ist. Die
//       Abgrenzung `hinweisDarfNichtTragen` muss daran scheitern.
//   G2  VOREILIGE FRISCHMELDUNG — nach der Wiederverbindung wird der Hinweis ausgeblendet, als
//       wäre der Stand wieder frisch. `hinweisMussSichtbarTragen` muss daran scheitern, und zwar
//       an der FLÄCHE (`display:none`), nicht am fehlenden Knoten.
//   G3  DER STAND OHNE ZEIT — die Uhrzeit wird aus dem Hinweis entfernt. `abrufstand` muss daran
//       scheitern; sonst bliebe „bestätigter Abrufstand" eine Zusage ohne Messung.
//
// Nach jeder Verstellung wird ihre Rücknahme gemessen: dieselbe Station ist danach wieder grün.
const TEXT_ERSETZEN = `([sel, text]) => {
  const el = document.querySelector(sel);
  const span = el ? el.querySelector("span") : null;
  if (!span) return "(kein Textträger)";
  const vorher = span.textContent;
  span.textContent = text;
  return vorher;
}`;

const TEXT_ZURUECK = `([sel, text]) => {
  const el = document.querySelector(sel);
  const span = el ? el.querySelector("span") : null;
  if (span) span.textContent = text;
  return !!span;
}`;

const FLAECHE_NEHMEN = `([sel, wert]) => {
  const el = document.querySelector(sel);
  if (!el) return false;
  el.style.display = wert;
  return true;
}`;

describe("JOB 4363 · Kalibrierung: der Nachweis scheitert an den beiden Fehlerklassen", () => {
  it("G1/G2/G3 — falscher Fehlerwortlaut, voreilige Frischmeldung und ein Stand ohne Zeit machen die zugehörige Station rot", async () => {
    const { browser: b, strecke: s } = zeug();
    const soll = sollwerte("de");
    const laedt = sprachbestand("de")["adm.ready.loading"] ?? "";
    const { kontext, seite } = await karteOffen(b, s.basis, "de", SCHMAL, anmelden, laedt);
    try {
      // ── G1 · falscher Fehlerwortlaut im Offlinefall ───────────────────────────────────────
      await kontext.setOffline(true);
      await warteBis(seite, () => hinweisDa(seite), "der Standhinweis erscheint offline");
      // Unverstellt ist die Station grün — sonst prüfte die Verstellung darunter nichts.
      await hinweisDarfNichtTragen(seite, soll.gescheitert, "offline (Kalibrierung, unverstellt)");

      const echterText = await seite.evaluate<string>(fn(TEXT_ERSETZEN), [
        HINWEIS,
        `${soll.standVon} 07:24 · ${soll.gescheitert}`,
      ]);
      expect(echterText, "es gab gar keinen Text zu verstellen").not.toBe("(kein Textträger)");
      await expect(
        hinweisDarfNichtTragen(seite, soll.gescheitert, "offline (Kalibrierung, verstellt)"),
      ).rejects.toThrow(/steht im Standhinweis/);

      await seite.evaluate<boolean>(fn(TEXT_ZURUECK), [HINWEIS, echterText]);
      await hinweisDarfNichtTragen(
        seite,
        soll.gescheitert,
        "offline (Kalibrierung, zurückgenommen)",
      );

      // ── G3 · der Stand ohne seine Uhrzeit ─────────────────────────────────────────────────
      await abrufstand(seite);
      await seite.evaluate<string>(fn(TEXT_ERSETZEN), [HINWEIS, soll.offline]);
      await expect(abrufstand(seite)).rejects.toThrow(/keine Uhrzeit/);
      await seite.evaluate<boolean>(fn(TEXT_ZURUECK), [HINWEIS, echterText]);
      await abrufstand(seite);

      // ── G2 · voreilige Frischmeldung nach der Wiederverbindung ────────────────────────────
      await kontext.setOffline(false);
      await warteBis(
        seite,
        async () => (await knopfBeschriftung(seite)) !== null,
        "der Wiederholen-Knopf erscheint nach der Wiederverbindung",
      );
      await hinweisMussSichtbarTragen(
        seite,
        [soll.standVon, soll.netzluecke],
        "Netzlücke (Kalibrierung, unverstellt)",
      );

      expect(await seite.evaluate<boolean>(fn(FLAECHE_NEHMEN), [HINWEIS, "none"])).toBe(true);
      await expect(
        hinweisMussSichtbarTragen(
          seite,
          [soll.standVon, soll.netzluecke],
          "Netzlücke (Kalibrierung, verstellt)",
        ),
      ).rejects.toThrow(/keine Fläche/);

      await seite.evaluate<boolean>(fn(FLAECHE_NEHMEN), [HINWEIS, ""]);
      await hinweisMussSichtbarTragen(
        seite,
        [soll.standVon, soll.netzluecke],
        "Netzlücke (Kalibrierung, zurückgenommen)",
      );
    } finally {
      await kontext.close();
    }
  }, 300_000);
});
