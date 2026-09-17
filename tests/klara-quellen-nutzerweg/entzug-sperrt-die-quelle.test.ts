// ================================================================================================
// JOB 4224 · D5 · LIEFERUNG 4 — DER ENTZUG SPERRT WIRKLICH, UND ZWAR OHNE NEBENKANAL
// ================================================================================================
//
// DIE FRAGE, die dieser Auftrag an D5 stellt (§1): wird derselben Person nach der Antwort das
// Leserecht entzogen, ist die Quelle dann WIRKLICH zu — und zwar so, dass auch Vorschau, Zähler und
// Fehlermeldung nichts über den Inhalt verraten?
//
// DER ENTZUG IST DER ECHTE PRODUKTWEG, kein Testschalter: der Eintrag wird auf `vertraulich`
// hochgestuft (`PUT /api/kos/:id`, `action: "confidentiality"`). Ab da gilt die EINE Regel aus
// `services/app/src/sichtbarkeit.ts` (`darfSehen`): vertraulich sieht nur, wer `ko.validate` trägt
// oder der Autor ist. Die fragende Person ist beides nicht.
//
// GEMESSEN WIRD DER UNTERSCHIED ZWISCHEN „NICHT VORHANDEN" UND „NICHT ERLAUBT" — er darf keiner
// sein: Status, Rumpf und Cachevertrag müssen für eine erfundene Kennung und für die entzogene
// Kennung Zeichen für Zeichen gleich aussehen. Sonst wird die Antwort zum Existenzorakel.
//
// E0 ist die Kalibrierung: mit Recht ist derselbe Weg grün. Ohne sie wäre „gesperrt" auch dann
// grün, wenn der Weg nie getragen hätte.
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  type Aufbau,
  type Draht,
  type Konto,
  ORIGINALTEXT,
  adapterUmgebungSetzen,
  appAufbauen,
  drahtAufbauen,
  eintragMitOriginal,
  fragen,
  kosLesen,
  neuesKonto,
  objektLesen,
  originalLesen,
} from "./kette";

adapterUmgebungSetzen();

/** Eine Kennung, die es nie gegeben hat — der Maßstab für „nicht vorhanden". */
const ERFUNDEN = "gibt-es-nicht-4224";

let draht: Draht;
let aufbau: Aufbau | null = null;

beforeAll(() => {
  draht = drahtAufbauen();
});

afterAll(() => {
  draht.abbauen();
});

afterEach(async () => {
  if (aufbau) {
    await aufbau.app.close();
    aufbau = null;
  }
  draht.setzeApp(null);
  draht.lage.generierungen = 0;
  draht.lage.vorlagen.length = 0;
});

interface Lage {
  aufbau: Aufbau;
  leser: Konto;
  koId: string;
  objectId: string;
  kernaussage: string;
  entziehen: () => Promise<void>;
}

async function vorrichtung(): Promise<Lage> {
  const a = await appAufbauen();
  aufbau = a;
  draht.setzeApp(a.app);
  const eintrag = await eintragMitOriginal(a.app, a.admin);
  const leser = await neuesKonto(a.app, "leser", a.admin);
  return {
    aufbau: a,
    leser,
    koId: eintrag.koId,
    objectId: eintrag.objectId,
    kernaussage: eintrag.kernaussage,
    entziehen: async () => {
      const res = await a.app.inject({
        method: "PUT",
        url: `/api/kos/${eintrag.koId}`,
        headers: a.admin.kopf,
        payload: { action: "confidentiality", level: "vertraulich" },
      });
      expect(res.statusCode, `Hochstufung gescheitert: ${res.body}`).toBe(200);
    },
  };
}

describe("JOB 4224 · D5 · E — der Entzug sperrt die Quelle", () => {
  it("E0 · KALIBRIERUNG: MIT Recht ist derselbe Weg grün — Antwort, Quelle, Original", async () => {
    const l = await vorrichtung();
    const antwort = await fragen(l.aufbau.app, l.leser);
    expect(antwort.answered, antwort.roh).toBe(true);
    expect(antwort.citedSources).toContain(l.koId);
    expect((await objektLesen(l.aufbau.app, l.leser, l.objectId)).statusCode).toBe(200);
    const roh = await originalLesen(l.aufbau.app, l.leser, l.objectId);
    expect(roh.statusCode).toBe(200);
    expect(roh.body).toBe(ORIGINALTEXT);
  });

  it('E1 · nach dem Entzug: weder Quelle noch Original — und beides sieht aus wie „gibt es nicht"', async () => {
    const l = await vorrichtung();
    // Erst die Antwort, dann der Entzug — genau die Reihenfolge aus dem Nutzerversprechen.
    expect((await fragen(l.aufbau.app, l.leser)).citedSources).toContain(l.koId);
    await l.entziehen();

    const meta = await objektLesen(l.aufbau.app, l.leser, l.objectId);
    const metaErfunden = await objektLesen(l.aufbau.app, l.leser, ERFUNDEN);
    expect(meta.statusCode, `das Original ist noch abrufbar: ${meta.body}`).toBe(404);
    expect(meta.statusCode).toBe(metaErfunden.statusCode);
    expect(meta.body).toBe(metaErfunden.body);
    expect(meta.headers["cache-control"]).toBe(metaErfunden.headers["cache-control"]);

    const roh = await originalLesen(l.aufbau.app, l.leser, l.objectId);
    const rohErfunden = await originalLesen(l.aufbau.app, l.leser, ERFUNDEN);
    expect(roh.statusCode, `die Rohbytes sind noch abrufbar: ${roh.body.slice(0, 200)}`).toBe(404);
    expect(roh.body).toBe(rohErfunden.body);
    expect(roh.headers["cache-control"]).toBe(rohErfunden.headers["cache-control"]);
    // Und nirgends steckt der Inhalt in der Absage.
    expect(roh.body).not.toContain(ORIGINALTEXT);
  });

  it("E2 · nach dem Entzug verrät auch die ANTWORT nichts — kein Titel, kein Wortlaut, kein Zähler", async () => {
    const l = await vorrichtung();
    expect((await fragen(l.aufbau.app, l.leser)).citedSources).toContain(l.koId);
    await l.entziehen();

    const danach = await fragen(l.aufbau.app, l.leser);
    expect(danach.status).toBe(200);
    expect(danach.sources, "die gesperrte Quelle steht weiter in der Quellenliste").not.toContain(
      l.koId,
    );
    expect(danach.citedSources).not.toContain(l.koId);
    // Der ganze Antwortkörper — Wortlaut, Titel, Kennung. Ein Zähler, eine Vorschau oder eine
    // Trefferzahl, die den Eintrag nennt, fällt hier ebenso auf wie der Fließtext.
    expect(danach.roh).not.toContain(l.koId);
    expect(danach.roh).not.toContain(l.kernaussage);
    // Auch die Torlage (`verschlossen`, JOB 2626) darf die Existenz nicht bestätigen.
    expect(danach.verschlossen.map((v) => v.id)).not.toContain(l.koId);
    // Und der Bestand, den die Fläche liest, führt ihn nicht mehr.
    const bestand = await kosLesen(l.aufbau.app, l.leser);
    expect(bestand.map((k) => k.id)).not.toContain(l.koId);
  });

  it("E3 · der Entzug gilt der PERSON: der Autor kommt weiter durch", async () => {
    // Ohne diese Hälfte wäre „gesperrt" auch dann grün, wenn die Hochstufung den Eintrag für alle
    // unbrauchbar machte — dann wäre nicht das Recht gemessen, sondern ein Totalausfall.
    const l = await vorrichtung();
    await l.entziehen();
    const admin = l.aufbau.admin;
    expect((await objektLesen(l.aufbau.app, admin, l.objectId)).statusCode).toBe(200);
    const roh = await originalLesen(l.aufbau.app, admin, l.objectId);
    expect(roh.statusCode).toBe(200);
    expect(roh.body).toBe(ORIGINALTEXT);
  });

  it("E4 · ohne Anmeldung gibt es beide Türen gar nicht — und die Absage ist für beide Kennungen dieselbe", async () => {
    const l = await vorrichtung();
    const ohne = await l.aufbau.app.inject({
      method: "GET",
      url: `/api/objects/${l.objectId}/raw`,
    });
    const ohneErfunden = await l.aufbau.app.inject({
      method: "GET",
      url: `/api/objects/${ERFUNDEN}/raw`,
    });
    expect(ohne.statusCode).toBe(401);
    expect(ohne.statusCode).toBe(ohneErfunden.statusCode);
    expect(ohne.body).toBe(ohneErfunden.body);
    expect(ohne.body).not.toContain(ORIGINALTEXT);
  });

  // ================================================================================================
  // BEN R2, PRÜFLÜCKE 6 — DIE KI-FREIGABE GETRENNT VOM LESERECHT.
  // ================================================================================================
  //
  // E0–E4 messen den Entzug des LESERECHTS. Ben hat zu Recht angemerkt, dass der Auftrag zwei Dinge
  // nennt: „das Leserecht ODER die KI-Freigabe". Die beiden Fälle hier schliessen das — und der
  // erste sagt etwas, das man leicht falsch aufschreiben würde.
  // ------------------------------------------------------------------------------------------------
  // RUNDE 4 — WAS RUNDE 3 HIER FALSCH GEMACHT HAT, UND WARUM DIE KORREKTUR MEHR IST ALS EIN UMBAU.
  // ------------------------------------------------------------------------------------------------
  //
  // Runde 3 hat an dieser Stelle die zentrale Adminfreigabe für öffentliche KI von Hand auf `false`
  // geschrieben (`PUT /api/reasoner/config` mit dem Freigabefeld im Rumpf). Das hat den
  // Freigabe-Wächter aus JOB 3550 rot gemacht — zu Recht: „F2 · niemand schreibt die Freigabefelder
  // von Hand — auch diese Datei nicht" (`tests/ki-anbieterwahl/routing-zwei-attrappen.test.ts`).
  // Die Freigabe wird ausschliesslich über `erteileKiFreigabe` gesetzt, und dieser Helfer kann
  // bewusst NUR erteilen: „wer eine Freigabe NICHT will, lässt den Schalter weg"
  // (`services/reasoner/src/testhelfer-ki-freigabe.ts`).
  //
  // DAMIT WAR DER UMWEG AUCH SACHLICH UNNÖTIG, und das ist der eigentliche Punkt: diese Kette hat
  // NIE eine Freigabe für öffentliche KI erteilt. Der Zustand, den Runde 3 mühsam herstellen
  // wollte, ist ihr Ausgangszustand. Der Fall misst ihn jetzt so, wie das Haus ihn meint — am
  // Weglassen, nicht an einem hingeschriebenen `false`.
  it("E5 · ohne jede erteilte KI-Freigabe antwortet der hausinterne Adapter — und das ist richtig", async () => {
    // WAS DARAUS FOLGT (und warum das kein Loch ist): der Riegel der zentralen Freigabe hängt an
    // `oeffentlicheKiErlaubt` (`services/reasoner/src/service.ts:658-664`) und riegelt die CLOUD ab.
    // Der bestätigt hausinterne Anbieter darf ausdrücklich einspringen — `chainForChoice`: „der
    // lokale LLM (on-prem, kein externer Egress) darf einspringen". Der Adapter dieser Kette IST
    // dieser lokale Anbieter (`KLARWERK_LOCAL_LLM_URL`, Loopback). Eine erteilte oder entzogene
    // Freigabe für öffentliche KI ändert an dieser Kette deshalb nichts — nicht weil der Riegel
    // schwach wäre, sondern weil hier nichts nach draussen geht.
    //
    // WOHER „OHNE JEDE ERTEILTE FREIGABE" WEISS, DASS ES STIMMT — und warum hier trotzdem keine
    // eigene Zählung steht: der Freigabe-Wächter aus JOB 3550 beantwortet das bereits für den
    // GANZEN Baum. Sein Fall F1 („genau die Dateien im Register benutzen den Helfer — keine mehr,
    // keine weniger") macht jeden nicht eingetragenen Benutzer rot; dieses Verzeichnis steht in
    // keinem Register. Solange F1 grün ist, ist die Voraussetzung dieses Falls fremdbelegt, und
    // zwar strenger, als eine eigene Zeile es könnte.
    //
    // EINE EIGENE ZÄHLUNG STAND HIER SCHON — und war ein Eigentor, das genannt gehört: sie suchte
    // den Helfer-Import über dasselbe Muster, das F1 benutzt, und trug ihr eigenes Suchmuster als
    // Beispielzeichenkette im Quelltext. Damit sah die Datei für F1 wie ein 65. Benutzer aus
    // („expected [ …(65) ] to deeply equal [ …(64) ]", Arbeitsprüfung 6610a349…) und für die eigene
    // Zählung wie ihr eigener Treffer. Wer neben einem funktionierenden Wächter einen zweiten
    // aufstellt, baut keine zweite Sicherheit, sondern eine zweite Fehlerquelle.

    // DAS VERHALTEN: der Adapter rechnet, die Antwort trägt ihre Quelle.
    const l = await vorrichtung();
    const vorher = draht.lage.generierungen;
    const antwort = await fragen(l.aufbau.app, l.leser);
    expect(
      draht.lage.generierungen,
      "der hausinterne Anbieter wurde nicht befragt — dann misst dieser Fall etwas anderes als beschrieben",
    ).toBeGreaterThan(vorher);
    expect(antwort.citedSources).toContain(l.koId);
  });

  it("E6 · wird das MODELL entzogen, geht nichts mehr hinaus — und das Leserecht bleibt unangetastet", async () => {
    // Der wirksame Entzug für DIESE Kette: der Administrator stellt die Aufgabe auf den
    // deterministischen Weg (derselbe Adminweg, dieselbe Route). Ab da darf den Adapter nichts mehr
    // erreichen. Und — das ist die zweite Hälfte und der eigentliche Punkt — der Entzug der KI
    // nimmt NIEMANDEM sein Leserecht: Quelle und Original bleiben für die berechtigte Person offen.
    // Ein KI-Schalter, der nebenbei Lesezugriffe schliesst, wäre eine stille zweite Wirkung.
    const l = await vorrichtung();
    expect((await fragen(l.aufbau.app, l.leser)).citedSources).toContain(l.koId);
    const vorher = draht.lage.generierungen;
    expect(vorher).toBeGreaterThan(0);

    const aus = await l.aufbau.app.inject({
      method: "PUT",
      url: "/api/reasoner/config",
      headers: l.aufbau.admin.kopf,
      payload: { global: "deterministic" },
    });
    expect(aus.statusCode, `Umstellung auf deterministisch gescheitert: ${aus.body}`).toBe(200);

    await fragen(l.aufbau.app, l.leser);
    expect(
      draht.lage.generierungen,
      "nach dem Entzug der KI ging trotzdem etwas an das Modell",
    ).toBe(vorher);

    // Das Leserecht ist unberührt: Quelle und Original bleiben erreichbar.
    expect((await objektLesen(l.aufbau.app, l.leser, l.objectId)).statusCode).toBe(200);
    const roh = await originalLesen(l.aufbau.app, l.leser, l.objectId);
    expect(roh.statusCode).toBe(200);
    expect(roh.body).toBe(ORIGINALTEXT);
  });
});
