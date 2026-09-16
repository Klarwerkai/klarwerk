// ================================================================================================
// JOB 4151 · TEST 4 — DAS RECHT AM ECHTEN DRAHT, MIT BESTANDSVERGLEICH.
// ================================================================================================
//
// DIE LEHRE, DIE DIESEN TEST FORMT (JOB 4141 R1, 15.09. 17:17): ein 403 belegt für sich genommen
// NICHT, dass nichts geschehen ist. Er belegt, dass der Aufrufer eine Absage gelesen hat — über
// den Bestand sagt er nichts. Jede Sperre hier wird deshalb DOPPELT gemessen: der Statuscode UND
// der Bestand vorher gegen nachher. Ohne den zweiten Teil wäre der Nachweis eine Behauptung.
//
// DIE ZWEITE ZUSAGE DIESER DATEI ist die Ununterscheidbarkeit: ein Endpunkt, den der Aufrufer nicht
// erreichen darf, muss DIESELBE Antwort erzeugen wie einer, den es gar nicht gibt — sonst ist die
// Fehlerform selbst die Existenzauskunft, die `kanten-service.ts:17-30` verbietet. Geprüft wird das
// an der SERIALISIERTEN Antwort (Status, `error`, `message`), nicht an der Absicht. Dass es `403`
// ist und nicht `404`, schreibt der API-Vertrag der Steuerung vor.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { type Buehne, baueBuehne, kopfFuer, neuesKo } from "./buehne";

let buehne: Buehne;

beforeEach(async () => {
  buehne = await baueBuehne();
});

afterEach(async () => {
  await buehne?.schliesse();
});

let laufendeMarke = 0;
const frischeMarke = (): string => {
  laufendeMarke += 1;
  return `recht-beitrag-${laufendeMarke}`;
};

function nutzlast(zielId: string, beitragSchluessel = frischeMarke()) {
  return {
    zielId,
    art: "ergaenzt",
    richtung: "ungerichtet",
    beitragSchluessel,
    gesehen: { quelleVersion: 1, zielVersion: 1 },
  };
}

/** Der ganze Bestand als vergleichbarer Abdruck — die Grundlage jedes Vorher/Nachher-Urteils. */
async function bestandsabdruck(koIds: readonly string[]): Promise<string> {
  const alle = await buehne.kanten.fuerKos(koIds);
  const sortiert = [...alle].sort((a, b) => a.id.localeCompare(b.id));
  return JSON.stringify(sortiert);
}

describe("JOB 4151 · R — wer nicht verknüpfen darf, bewegt den Bestand nicht", () => {
  for (const rolle of ["viewer", "experte"] as const) {
    it(`${rolle} bekommt 403 UND der Bestand ist danach Byte für Byte derselbe`, async () => {
      const links = await neuesKo(buehne, "Wartungsplan Halle 2");
      const rechts = await neuesKo(buehne, "Filterwechsel dokumentiert");
      const vorher = await bestandsabdruck([links, rechts]);

      const antwort = await buehne.app.inject({
        method: "POST",
        url: `/api/kos/${links}/beziehungen`,
        headers: kopfFuer(buehne, rolle),
        payload: nutzlast(rechts),
      });

      expect(antwort.statusCode, antwort.body).toBe(403);
      expect(antwort.json()).toMatchObject({ error: "FORBIDDEN" });
      expect(await bestandsabdruck([links, rechts]), "der Bestand hat sich bewegt").toBe(vorher);
    });
  }

  it("anonym bekommt 401 UND der Bestand ist danach derselbe", async () => {
    const links = await neuesKo(buehne, "Wartungsplan Halle 2");
    const rechts = await neuesKo(buehne, "Filterwechsel dokumentiert");
    const vorher = await bestandsabdruck([links, rechts]);

    const antwort = await buehne.app.inject({
      method: "POST",
      url: `/api/kos/${links}/beziehungen`,
      payload: nutzlast(rechts),
    });

    expect(antwort.statusCode, antwort.body).toBe(401);
    expect(await bestandsabdruck([links, rechts])).toBe(vorher);
  });

  it("KALIBRIERUNG: controller kommt durch — sonst wäre jede Sperre oben auch mit einer toten Tür grün", async () => {
    const links = await neuesKo(buehne, "Wartungsplan Halle 2");
    const rechts = await neuesKo(buehne, "Filterwechsel dokumentiert");
    const vorher = await bestandsabdruck([links, rechts]);

    const antwort = await buehne.app.inject({
      method: "POST",
      url: `/api/kos/${links}/beziehungen`,
      headers: kopfFuer(buehne, "controller"),
      payload: nutzlast(rechts),
    });

    expect(antwort.statusCode, antwort.body).toBe(201);
    const angelegt = antwort.json() as { id: string; urheber: string; version: number };
    expect(angelegt.urheber).toBe(buehne.konto.controller.id);
    expect(angelegt.version).toBe(1);
    // Und der Bestand HAT sich bewegt — die Gegenrichtung zum Vergleich oben.
    expect(await bestandsabdruck([links, rechts])).not.toBe(vorher);
  });

  it("der Urheber ist der angemeldete Mensch — ein mitgeschickter Urheber wird nicht geglaubt", async () => {
    const links = await neuesKo(buehne, "Wartungsplan Halle 2");
    const rechts = await neuesKo(buehne, "Filterwechsel dokumentiert");

    const antwort = await buehne.app.inject({
      method: "POST",
      url: `/api/kos/${links}/beziehungen`,
      headers: kopfFuer(buehne, "controller"),
      payload: { ...nutzlast(rechts), urheber: buehne.konto.admin.id },
    });

    expect(antwort.statusCode, antwort.body).toBe(201);
    expect((antwort.json() as { urheber: string }).urheber).toBe(buehne.konto.controller.id);
  });

  it("dieselbe Beziehung andersherum gesetzt bleibt EINE — am Draht, nicht nur im Bestand", async () => {
    const links = await neuesKo(buehne, "Wartungsplan Halle 2");
    const rechts = await neuesKo(buehne, "Filterwechsel dokumentiert");
    const setzen = (quelle: string, ziel: string) =>
      buehne.app.inject({
        method: "POST",
        url: `/api/kos/${quelle}/beziehungen`,
        headers: kopfFuer(buehne, "controller"),
        payload: nutzlast(ziel),
      });

    const erste = await setzen(links, rechts);
    // Andersherum gesetzt ist dieselbe fachliche Beziehung (richtungslos, kanonisiert).
    const zweite = await setzen(rechts, links);

    expect(erste.statusCode, erste.body).toBe(201);
    expect(zweite.statusCode, zweite.body).toBe(200);
    expect((zweite.json() as { id: string }).id).toBe((erste.json() as { id: string }).id);
    expect(await buehne.kanten.fuerKo(links)).toHaveLength(1);
  });
});

// ================================================================================================
// BEN R2, KORREKTURPFLICHT 2 — DER WIEDERHOLSCHLÜSSEL GEHÖRT SEINER BEZIEHUNG.
// ================================================================================================
//
// DER GEMESSENE FEHLER (BEN, Runde 2): A–B setzen, A in den Papierkorb legen, dann C–D mit
// DEMSELBEN Schlüssel anfragen → `200` mit A–B, einschliesslich des unerreichbaren Endpunkts A.
// Geprüft wurden die ANGEFRAGTEN Endpunkte, herausgegeben wurden die GEFUNDENEN — zwei
// verschiedene Mengen, sobald der Schlüssel zu etwas anderem gehört.
//
// DIE EINE PRODUKTZEILE, DEREN RÜCKNAHME DIESE FÄLLE WIEDER ROT MACHT: der Schlüsselvergleich in
// `KantenSchreibService.setze` (`beziehungsSchluessel(schonGesetzt) !== beziehungsSchluessel(eingabe)`).
describe("JOB 4151 · S — ein fremder Wiederholschlüssel öffnet keine fremde Beziehung", () => {
  const vierKos = async () => ({
    a: await neuesKo(buehne, "Wartungsplan Halle 2"),
    b: await neuesKo(buehne, "Filterwechsel dokumentiert"),
    c: await neuesKo(buehne, "Anfahrkurve Trockner"),
    d: await neuesKo(buehne, "Schichtübergabe Protokoll"),
  });

  const setze = (quelle: string, ziel: string, schluessel: string) =>
    buehne.app.inject({
      method: "POST",
      url: `/api/kos/${quelle}/beziehungen`,
      headers: kopfFuer(buehne, "controller"),
      payload: nutzlast(ziel, schluessel),
    });

  it("DER GEMESSENE FALL: ein unerreichbar gewordener Endpunkt kommt nicht über einen fremden Schlüssel zurück", async () => {
    const { a, b, c, d } = await vierKos();
    const erste = await setze(a, b, "s-geteilt");
    expect(erste.statusCode, erste.body).toBe(201);
    const angelegt = erste.json() as { id: string };

    // A wandert in den Papierkorb — für jede weitere Anfrage ist es damit unauflösbar.
    await buehne.services.ko.delete(a, buehne.konto.controller.id);

    const fremd = await setze(c, d, "s-geteilt");

    expect(fremd.statusCode, fremd.body).toBe(409);
    expect(fremd.json()).toMatchObject({ error: "CONFLICT" });
    // Nichts aus der fremden Beziehung reist mit: weder Endpunkt, noch Kennung, noch Titel.
    for (const verboten of [a, b, angelegt.id, "Wartungsplan", "Filterwechsel"]) {
      expect(fremd.body, `verräterisch: ${verboten}`).not.toContain(verboten);
    }
    // Und der Bestand hat sich nicht bewegt: C–D gibt es nicht, A–B steht unverändert.
    expect(await buehne.kanten.fuerKos([c, d])).toEqual([]);
    expect((await buehne.kanten.hole(angelegt.id))?.version).toBe(1);
  });

  it("derselbe Schlüssel auf einer ANDEREN Beziehung wird abgewiesen — auch wenn alles erreichbar ist", async () => {
    // Der Kern ohne Papierkorb: die Abweisung hängt am Schlüssel, nicht an der Erreichbarkeit.
    const { a, b, c, d } = await vierKos();
    expect((await setze(a, b, "s-eins")).statusCode).toBe(201);

    const fremd = await setze(c, d, "s-eins");

    expect(fremd.statusCode, fremd.body).toBe(409);
    expect(await buehne.kanten.fuerKos([c, d])).toEqual([]);
  });

  it("KALIBRIERUNG: die ECHTE Wiederholung kommt unverändert durch — die Idempotenzzusage bleibt", async () => {
    // Ohne diesen Gegenfall wäre die Abweisung oben auch mit einem Server grün, der jeden zweiten
    // Gebrauch eines Schlüssels ablehnt — und dann wäre die Zusage „ein verlorener Antwortweg
    // erzeugt keinen zweiten Beitrag" gerade dann wertlos, wenn sie gebraucht wird.
    const { a, b } = await vierKos();
    const erste = await setze(a, b, "s-wiederholt");
    const nochmal = await setze(a, b, "s-wiederholt");

    expect(erste.statusCode, erste.body).toBe(201);
    expect(nochmal.statusCode, nochmal.body).toBe(200);
    expect(nochmal.body).toBe(erste.body);
  });

  it("dieselbe Beziehung ANDERSHERUM wiederholt bleibt eine Wiederholung — kanonisch, nicht wörtlich", async () => {
    // Der Vergleich läuft über den Beziehungsschlüssel und damit über das KANONISCHE Paar. Ein
    // wörtlicher Vergleich der Endpunktreihenfolge würde diese legitime Wiederholung abweisen.
    const { a, b } = await vierKos();
    const erste = await setze(a, b, "s-gedreht");
    const andersherum = await setze(b, a, "s-gedreht");

    expect(erste.statusCode, erste.body).toBe(201);
    expect(andersherum.statusCode, andersherum.body).toBe(200);
    expect((andersherum.json() as { id: string }).id).toBe((erste.json() as { id: string }).id);
  });
});

describe("JOB 4151 · R — unerreichbar und nicht vorhanden sind am Draht dasselbe", () => {
  it("unauflösbarer Endpunkt: dieselbe Antwort wie eine erfundene Kennung, ohne Titel, Kennung oder Zahl", async () => {
    // WELCHE FÄLLE AM SCHREIBWEG ÜBERHAUPT MESSBAR SIND, ehrlich benannt: `ko.relate` haben nur
    // controller und admin, und beide tragen `ko.validate` — für sie ist ein vertrauliches Objekt
    // SICHTBAR (`sichtbarkeit.ts:67-77`). Der Fall „vorhanden, aber für DIESEN Aufrufer unsichtbar"
    // ist an dieser Tür deshalb baulich nicht herstellbar. Messbar und gemeint ist die
    // Ununterscheidbarkeit der übrigen Gründe: ein Ziel, das es nie gab, gegen eines, das im
    // Papierkorb liegt und damit unauflösbar ist (`KoService.get` liefert dafür `undefined`).
    // Der Trimm-Fall „unsichtbar" wird am LESEweg gemessen, im Fall darunter.
    const links = await neuesKo(buehne, "Wartungsplan Halle 2");
    const geheim = await neuesKo(buehne, "Lieferantenpreis Ventile", {
      confidentiality: "vertraulich",
    });
    const erfunden = await buehne.app.inject({
      method: "POST",
      url: `/api/kos/${links}/beziehungen`,
      headers: kopfFuer(buehne, "controller"),
      payload: nutzlast("gibt-es-nicht"),
    });
    const getrasht = await (async () => {
      await buehne.services.ko.delete(geheim, buehne.konto.controller.id);
      return buehne.app.inject({
        method: "POST",
        url: `/api/kos/${links}/beziehungen`,
        headers: kopfFuer(buehne, "controller"),
        payload: nutzlast(geheim),
      });
    })();

    expect(erfunden.statusCode).toBe(403);
    expect(getrasht.statusCode).toBe(403);
    // Zeichengleich: weder Titel noch Kennung noch eine Zahl unterscheidet die beiden Antworten.
    expect(getrasht.body).toBe(erfunden.body);
    expect(getrasht.body).not.toContain(geheim);
    expect(getrasht.body).not.toContain("Lieferantenpreis");
  });

  it("der Leseweg trimmt am Draht: die unsichtbare Beziehung erscheint nicht, und `total` zählt danach", async () => {
    const links = await neuesKo(buehne, "Wartungsplan Halle 2");
    const offen = await neuesKo(buehne, "Filterwechsel dokumentiert");
    const geheim = await neuesKo(buehne, "Lieferantenpreis Ventile", {
      confidentiality: "vertraulich",
    });
    for (const ziel of [offen, geheim]) {
      const gesetzt = await buehne.app.inject({
        method: "POST",
        url: `/api/kos/${links}/beziehungen`,
        headers: kopfFuer(buehne, "controller"),
        payload: nutzlast(ziel),
      });
      expect(gesetzt.statusCode, gesetzt.body).toBe(201);
    }

    const alsExperte = await buehne.app.inject({
      method: "GET",
      url: `/api/kos/${links}/beziehungen`,
      headers: kopfFuer(buehne, "experte"),
    });
    const alsController = await buehne.app.inject({
      method: "GET",
      url: `/api/kos/${links}/beziehungen`,
      headers: kopfFuer(buehne, "controller"),
    });

    expect(alsExperte.statusCode, alsExperte.body).toBe(200);
    const getrimmt = alsExperte.json() as {
      total: number;
      kanten: { gegenstueck: { id: string } }[];
    };
    expect(getrimmt.total).toBe(1);
    expect(getrimmt.kanten.map((k) => k.gegenstueck.id)).toEqual([offen]);
    expect(alsExperte.body).not.toContain(geheim);
    expect(alsExperte.body).not.toContain("Lieferantenpreis");
    // KALIBRIERUNG: für die erweiterte Sicht ist dieselbe Beziehung da.
    expect((alsController.json() as { total: number }).total).toBe(2);
  });

  // ==============================================================================================
  // BEN R2, KORREKTURPFLICHT 1 — DER AUSGANGSPUNKT IST EIN ENDPUNKT WIE DER ANDERE.
  // ==============================================================================================
  //
  // WAS DIESER TESTBLOCK VORHER NICHT MASS, und deshalb steht er hier. Der Trimm-Fall darüber prüft
  // ein verborgenes GEGENSTÜCK — also die Leserichtung „vom sichtbaren Eintrag aus". Die
  // UMGEKEHRTE Richtung blieb ungeprüft: der Abruf AM verborgenen Eintrag selbst. BEN hat sie
  // gefahren und bekam als fremder Experte eine Beziehung, `total: 1` samt Fassungsnummern und
  // Zeitpunkten des vertraulichen Eintrags zurück.
  //
  // DIE EINE PRODUKTZEILE, DEREN RÜCKNAHME DIESE FÄLLE WIEDER ROT MACHT: das Tor am Anfang von
  // `KantenLeseService.kantenFuer` (`if (!eigenes || !sichtbar(eigenes))`, kanten-service.ts).
  it("ein VERTRAULICHER Ausgangspunkt gibt einem fremden Experten nichts heraus — keine Kante, keine Zahl", async () => {
    const geheim = await neuesKo(buehne, "Lieferantenpreis Ventile", {
      confidentiality: "vertraulich",
    });
    const offen = await neuesKo(buehne, "Filterwechsel dokumentiert");
    const gesetzt = await buehne.app.inject({
      method: "POST",
      url: `/api/kos/${geheim}/beziehungen`,
      headers: kopfFuer(buehne, "controller"),
      payload: nutzlast(offen),
    });
    expect(gesetzt.statusCode, gesetzt.body).toBe(201);

    const alsExperte = await buehne.app.inject({
      method: "GET",
      url: `/api/kos/${geheim}/beziehungen`,
      headers: kopfFuer(buehne, "experte"),
    });
    // Die Gegenprobe zu einem Eintrag, den es NIE gab: zeichengleich bis auf die angefragte
    // Kennung. Aus der Antwortform lässt sich damit nicht ablesen, dass es `geheim` gibt.
    const erfunden = await buehne.app.inject({
      method: "GET",
      url: "/api/kos/gibt-es-nicht/beziehungen",
      headers: kopfFuer(buehne, "experte"),
    });

    expect(alsExperte.statusCode, alsExperte.body).toBe(200);
    expect(alsExperte.body).toBe(erfunden.body.replace("gibt-es-nicht", geheim));
    expect(alsExperte.json()).toMatchObject({ koId: geheim, kanten: [], total: 0 });
    // Weder das Gegenstück noch eine Fassungsnummer oder ein Zeitpunkt reist mit.
    expect(alsExperte.body).not.toContain(offen);
    expect(alsExperte.body).not.toContain("Filterwechsel");
    expect(alsExperte.body).not.toContain("beurteilt");

    // KALIBRIERUNG: für die Rolle, die den Eintrag sehen DARF, ist dieselbe Beziehung da — sonst
    // wäre der Fall oben auch mit einer Lesetür grün, die grundsätzlich nichts liefert.
    const alsController = await buehne.app.inject({
      method: "GET",
      url: `/api/kos/${geheim}/beziehungen`,
      headers: kopfFuer(buehne, "controller"),
    });
    expect((alsController.json() as { total: number }).total).toBe(1);
  });

  it("der eigene Autor sieht seine vertrauliche Beziehung weiterhin — das Tor ist kein Rollenschnitt", async () => {
    // Die Gegenrichtung zum Fall darüber, und sie ist wichtig: das Tor fragt `sichtbar`, also
    // dieselbe Entscheidung wie überall (`darfSehen`, sichtbarkeit.ts:67-77). Ein selbst
    // geschriebener vertraulicher Eintrag bleibt für seinen Autor erreichbar.
    const eigen = await neuesKo(buehne, "Eigene vertrauliche Notiz", {
      confidentiality: "vertraulich",
      author: buehne.konto.experte.id,
    });
    const offen = await neuesKo(buehne, "Filterwechsel dokumentiert");
    const gesetzt = await buehne.app.inject({
      method: "POST",
      url: `/api/kos/${eigen}/beziehungen`,
      headers: kopfFuer(buehne, "controller"),
      payload: nutzlast(offen),
    });
    expect(gesetzt.statusCode, gesetzt.body).toBe(201);

    const alsAutor = await buehne.app.inject({
      method: "GET",
      url: `/api/kos/${eigen}/beziehungen`,
      headers: kopfFuer(buehne, "experte"),
    });

    expect(alsAutor.statusCode, alsAutor.body).toBe(200);
    expect((alsAutor.json() as { total: number }).total).toBe(1);
  });

  it("`viewer` darf LESEN — die Lesetür hängt an `ko.read`, nicht an `ko.relate`", async () => {
    const links = await neuesKo(buehne, "Wartungsplan Halle 2");
    const antwort = await buehne.app.inject({
      method: "GET",
      url: `/api/kos/${links}/beziehungen`,
      headers: kopfFuer(buehne, "viewer"),
    });
    expect(antwort.statusCode, antwort.body).toBe(200);
    expect(antwort.json()).toMatchObject({ koId: links, kanten: [], total: 0 });
  });
});
