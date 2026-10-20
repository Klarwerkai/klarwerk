// Tatsächliche App mit Konto-/Kalender-/Erinnerungs-APIs. Kontrollierte Uhr und angehaltene
// Modellantwort am bestehenden Dienst; kein echter externer Modell- oder Kalenderaufruf.
import { afterEach, expect, it } from "vitest";
import { buildServices } from "../../services/app/src/build-app";
import { KlaraErinnerungSteuerung } from "../../services/app/src/klara-erinnerung";
import { loeseMitRegel, lokalVon } from "../../services/app/src/klara-erinnerung-zeit";
import { KlaraNotizDienst } from "../../services/app/src/klara-notiz";
import {
  type Aufbau,
  adapterUmgebungSetzen,
  appAufbauen,
  neuesKonto,
} from "../klara-quellen-nutzerweg/kette";

adapterUmgebungSetzen();
let aufbau: Aufbau | undefined;
afterEach(async () => {
  await aufbau?.app.close();
});
it("AW16-K06/AW18-K09: Abbrechen stoppt genau einen tatsächlichen aktiven Lauf gegen die verspätete Modellantwort; Vorschau/Abbrechen/Fremdes/Serie und fertige Ergebnisse", async () => {
  const services = buildServices();
  aufbau = await appAufbauen(true, () => services);
  const { app, admin } = aufbau;
  const ich = await neuesKonto(app, "abbruch", admin);
  const fremd = await neuesKonto(app, "fremd", admin);
  const kontoId = (await app.inject({ url: "/api/auth/me", headers: ich.kopf })).json().id;
  const n = await app.inject({
    method: "POST",
    url: "/api/me/klara/notizen",
    headers: ich.kopf,
    payload: {
      vorgang: "einzelabbruch-notiz-1",
      weg: "geschrieben",
      titel: "Fiktiver Prüfplan",
      inhalt: "Messung an Pumpe P-7.",
      objektbezug: { pfad: "/aufgaben", seitenName: "Aufgaben", objekt: "P-7" },
    },
  });
  expect(n.statusCode, n.body).toBe(201);
  const ziel = lokalVon(Date.now() + 120_000, "Europe/Berlin");
  const angelegt = await app.inject({
    method: "POST",
    url: "/api/me/klara/erinnerungen",
    headers: ich.kopf,
    payload: {
      vorgang: "einzelabbruch-serie-1",
      titel: "Prüfplan täglich",
      zeitzone: "Europe/Berlin",
      zeitplan: {
        art: "serie",
        datum: ziel.datum,
        uhrzeit: ziel.uhrzeit,
        wiederholung: { takt: "taeglich", intervall: 1, anzahl: 3 },
      },
      aktion: "inhalt_zusammenfassen",
      bezug: { art: "notiz", notizId: n.json().notiz.id },
    },
  });
  expect(angelegt.statusCode, angelegt.body).toBe(201);
  const e = angelegt.json().erinnerung;
  let uhr = (loeseMitRegel(ziel, "Europe/Berlin", e.sommerzeit).ms as number) + 1000;
  let freigeben!: () => void;
  let begonnen!: () => void;
  const start = new Promise<void>((resolve) => {
    begonnen = resolve;
  });
  const warte = new Promise<void>((resolve) => {
    freigeben = resolve;
  });
  const steuerung = new KlaraErinnerungSteuerung({
    ablage: services.klaraErinnerungen,
    konto: async () => ({ approved: true }),
    notizen: services.klaraNotizen,
    jetzt: () => uhr,
    besitzer: "abbruch-probe",
    zusammenfassen: async () => {
      begonnen();
      await warte;
      return { text: "Verspätete Antwort zur Messung", ki: false };
    },
  });
  const laufenderTakt = steuerung.lauf();
  await start;
  const laufId = `${e.id}@${ziel.datum}T${ziel.uhrzeit}`;
  try {
    const termin = await app.inject({
      method: "POST",
      url: "/api/me/kalender/eintraege",
      headers: ich.kopf,
      payload: {
        titel: "Arbeit P-7",
        art: "termin",
        zeitzone: "Europe/Berlin",
        ganztaegig: false,
        beginn: new Date(uhr).toISOString(),
        ende: new Date(uhr + 3_600_000).toISOString(),
        auftrag: { taskId: e.id },
        lauf: { runId: laufId },
        serie: { seriesId: e.id },
      },
    });
    expect(termin.statusCode, termin.body).toBe(201);
    const id = termin.json().eintrag.id;
    const pfad = `/api/me/kalender/eintraege/${id}`;
    const vorschau = await app.inject({
      method: "POST",
      url: `${pfad}/folgen`,
      headers: ich.kopf,
      payload: { aktion: "arbeit_abbrechen" },
    });
    expect(vorschau.statusCode, vorschau.body).toBe(200);
    expect(vorschau.json().folgen).toMatchObject({
      moeglich: true,
      bleibt: ["eintrag", "serie", "ergebnisse", "andere_laeufe"],
    });
    expect((await services.klaraErinnerungen.laeufe.hole(laufId))?.status).toBe("laeuft");
    const abgebrochenDialog = await app.inject({
      method: "POST",
      url: `${pfad}/aktionen`,
      headers: ich.kopf,
      payload: { aktion: "arbeit_abbrechen", bestaetigt: false },
    });
    expect(abgebrochenDialog.statusCode).toBe(400);
    expect((await services.klaraErinnerungen.laeufe.hole(laufId))?.status).toBe("laeuft");
    const verboten = await app.inject({
      method: "POST",
      url: `${pfad}/aktionen`,
      headers: fremd.kopf,
      payload: { aktion: "arbeit_abbrechen", bestaetigt: true },
    });
    expect(verboten.statusCode).toBe(404);
    const abbruch = await app.inject({
      method: "POST",
      url: `${pfad}/aktionen`,
      headers: ich.kopf,
      payload: { aktion: "arbeit_abbrechen", bestaetigt: true },
    });
    expect(abbruch.statusCode, abbruch.body).toBe(200);
    expect(abbruch.json().eintrag).toMatchObject({
      id,
      lauf: { runId: laufId, status: "abgebrochen" },
      serie: { seriesId: e.id, pausiert: false },
    });
    const gespeichert = await services.klaraErinnerungen.erinnerungen.hole(kontoId, e.id);
    expect(gespeichert?.erinnerung).toMatchObject({
      status: "aktiv",
      fassung: 1,
      zeitplan: e.zeitplan,
    });
  } finally {
    freigeben();
  }
  await laufenderTakt;
  expect((await services.klaraErinnerungen.laeufe.hole(laufId))?.status).toBe("abgebrochen");
  expect(await services.klaraErinnerungen.meldungen.fuerKonto(kontoId, 100)).toHaveLength(0);
  // Derselbe abgebrochene Termin wird auch nach Ablauf der Lease nicht erneut übernommen.
  uhr += 86_400_000;
  await new KlaraErinnerungSteuerung({
    ablage: services.klaraErinnerungen,
    konto: async () => ({ approved: true }),
    notizen: services.klaraNotizen,
    jetzt: () => uhr,
    besitzer: "nach-neustart",
    zusammenfassen: async () => ({ text: "Neue Messung am Folgetag", ki: false }),
  }).lauf();
  const laeufe = await services.klaraErinnerungen.laeufe.fuerErinnerung(e.id, 100);
  expect(laeufe.find((l) => l.vorkommenId === laufId)).toMatchObject({
    status: "abgebrochen",
    versuch: 1,
  });
  expect(laeufe.filter((l) => l.status === "zugestellt")).toHaveLength(1);
  const meldungen = await services.klaraErinnerungen.meldungen.fuerKonto(kontoId, 100);
  expect(meldungen).toHaveLength(1);
  expect(meldungen[0]?.zusammenfassung).toMatchObject({
    status: "erstellt",
    text: "Neue Messung am Folgetag",
  });
});

it("AW16-K06/EQF-07-K06: bereits gespeicherter Bericht bleibt bei Abbruch vor seiner Bestätigung erhalten und als tatsächliches Ergebnis sichtbar", async () => {
  const services = buildServices();
  aufbau = await appAufbauen(true, () => services);
  const { app, admin } = aufbau;
  const ich = await neuesKonto(app, "teilbericht-abbruch", admin);
  const kontoId = (await app.inject({ url: "/api/auth/me", headers: ich.kopf })).json().id;
  const ziel = lokalVon(Date.now() + 120_000, "Europe/Berlin");
  const angelegt = await app.inject({
    method: "POST",
    url: "/api/me/klara/erinnerungen",
    headers: ich.kopf,
    payload: {
      vorgang: "einzelabbruch-routine-1",
      titel: "Offene Prüfaufgaben",
      zeitzone: "Europe/Berlin",
      zeitplan: { art: "einmalig", datum: ziel.datum, uhrzeit: ziel.uhrzeit },
      aktion: "routine_bericht",
      routine: { abschnitte: ["offene_aufgaben"] },
    },
  });
  expect(angelegt.statusCode, angelegt.body).toBe(201);
  const e = angelegt.json().erinnerung;
  const uhr = (loeseMitRegel(ziel, "Europe/Berlin", e.sommerzeit).ms as number) + 1000;
  let weiter!: () => void;
  let gespeichert!: () => void;
  const halte = new Promise<void>((r) => {
    weiter = r;
  });
  const hatGespeichert = new Promise<void>((r) => {
    gespeichert = r;
  });
  const notizDienst = new KlaraNotizDienst({ repo: services.klaraNotizen, jetzt: () => uhr });
  const steuerung = new KlaraErinnerungSteuerung({
    ablage: services.klaraErinnerungen,
    konto: async () => ({ approved: true }),
    aufgaben: services.klaraAufgaben,
    notizen: services.klaraNotizen,
    jetzt: () => uhr,
    besitzer: "bericht-vor-bestaetigung",
    ergebnisablage: {
      zuVorgang: (k, v) => services.klaraNotizen.zuVorgang(k, v),
      lege: async (k, d, b) => {
        const r = await notizDienst.lege(k, d, b);
        gespeichert();
        await halte;
        return r;
      },
    },
  });
  const takt = steuerung.lauf();
  await hatGespeichert;
  const laufId = `${e.id}@${ziel.datum}T${ziel.uhrzeit}`;
  try {
    const termin = await app.inject({
      method: "POST",
      url: "/api/me/kalender/eintraege",
      headers: ich.kopf,
      payload: {
        titel: "Berichtslauf",
        art: "termin",
        zeitzone: "Europe/Berlin",
        ganztaegig: false,
        beginn: new Date(uhr).toISOString(),
        ende: new Date(uhr + 3600000).toISOString(),
        auftrag: { taskId: e.id },
        lauf: { runId: laufId },
      },
    });
    expect(termin.statusCode, termin.body).toBe(201);
    const abbruch = await app.inject({
      method: "POST",
      url: `/api/me/kalender/eintraege/${termin.json().eintrag.id}/aktionen`,
      headers: ich.kopf,
      payload: { aktion: "arbeit_abbrechen", bestaetigt: true },
    });
    expect(abbruch.statusCode, abbruch.body).toBe(200);
    expect(abbruch.json().eintrag).toMatchObject({
      lauf: { runId: laufId, status: "abgebrochen" },
      ergebnis: { art: "bericht_gespeichert" },
    });
  } finally {
    weiter();
  }
  await takt;
  const l = await services.klaraErinnerungen.laeufe.hole(laufId);
  expect(l).toMatchObject({
    status: "abgebrochen",
    ergebnis: { grund: "abbruch", routine: { fortsetzbar: false } },
  });
  const original = await services.klaraNotizen.hole(kontoId, l?.ergebnis.routine?.notizId ?? "");
  expect(original?.titel).toContain("Offene Prüfaufgaben");
  expect(await services.klaraErinnerungen.meldungen.fuerKonto(kontoId, 100)).toHaveLength(0);
});
