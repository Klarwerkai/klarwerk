import { afterEach, beforeEach, expect, it } from "vitest";
import { buildApp, buildServices } from "../../services/app/src/build-app";
let app: ReturnType<typeof buildApp>;
let token = "";
let fremd = "";
let services: ReturnType<typeof buildServices>;
function call(path: string, body: unknown = {}, t = token) {
  return app.inject({
    method: "POST",
    url: `/api/me/klara/besprechungen${path}`,
    headers: { authorization: `Bearer ${t}` },
    payload: body as Record<string, unknown>,
  });
}
const text =
  "Beschluss: Testlauf am Montag.\nVorschlag: Lieferung vorziehen.\nAbgelehnt: Lieferung vorziehen.\nWiderspruch: Termin bleibt strittig.\nOffen: Wer prüft den Vertrag?\nAufgabe: Lizenz prüfen.";
beforeEach(async () => {
  services = buildServices();
  app = buildApp(services);
  await app.inject({
    method: "POST",
    url: "/api/auth/register",
    payload: { name: "F Meeting", email: "f@meeting.test", password: "secret123" },
  });
  token = (
    await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "f@meeting.test", password: "secret123" },
    })
  ).json().token;
  await app.inject({
    method: "POST",
    url: "/api/users",
    headers: { authorization: `Bearer ${token}` },
    payload: { name: "Fremd", email: "fremd@meeting.test", role: "experte", password: "secret123" },
  });
  fremd = (
    await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "fremd@meeting.test", password: "secret123" },
    })
  ).json().token;
});
afterEach(() => app.close());
it("Text bleibt privat; trennt belegte Kennzeichnungen, offene Zuständigkeit und bewusste Übernahme", async () => {
  const r = await call("/import", {
    titel: "Synthetisches Meeting",
    meetingId: "f-meeting-1",
    berechtigt: true,
    text,
  });
  expect(r.statusCode, r.body).toBe(200);
  const n = r.json().notiz;
  expect(r.json().ergebnisse.map((a: { art: string }) => a.art)).toEqual([
    "entscheidung",
    "vorschlag",
    "abgelehnt",
    "widerspruch",
    "offen",
    "aufgabe",
  ]);
  expect((await call(`/${n.id}/lesen`, {}, fremd)).statusCode).toBe(404);
  expect(
    (
      await call(`/${n.id}/uebernehmen`, {
        fassung: n.fassung,
        bewusst: true,
        auswahl: ["zeile-1", "zeile-5", "zeile-6"],
      })
    ).statusCode,
  ).toBe(409);
  const x = {
    fassung: n.fassung,
    bewusst: true,
    eigeneAufgaben: true,
    auswahl: ["zeile-1", "zeile-5", "zeile-6"],
  };
  const a = await call(`/${n.id}/uebernehmen`, x);
  expect(a.statusCode, a.body).toBe(200);
  const b = await call(`/${n.id}/uebernehmen`, x);
  expect(b.statusCode, b.body).toBe(200);
  expect(a.json().notizId).toBe(b.json().notizId);
  expect(a.json().aufgaben[0].id).toBe(b.json().aufgaben[0].id);
  expect(await services.ko.list()).toHaveLength(0);
  const auf = await app.inject({
    method: "GET",
    url: "/api/me/klara/aufgaben",
    headers: { authorization: `Bearer ${token}` },
  });
  expect(auf.body).toContain("Transkriptfassung 1");
  expect(a.json().fristenNormen).toBe("separate_bewusste_quellenauswahl");
});
it("VTT-Fassung erhält Zeiten, Importsprecher, Überlappung und Rauschen; Korrektur versioniert ohne Aufgabendublette", async () => {
  const vtt =
    "WEBVTT\n\na\n00:00:00.000 --> 00:00:02.000\n<v Sprecher A>Beschluss: [Rauschen] unbekannt.\n\nb\n00:00:01.000 --> 00:00:03.000\n<v Unbekannt>Vorschlag: Morgen.\n\nc\n00:00:04.000 --> 00:00:06.000\nAufgabe: Lizenz prüfen.";
  const r = await call("/import", {
    titel: "VTT",
    meetingId: "f-vtt-1",
    berechtigt: true,
    vtt,
    meetingDatum: "2026-10-01T10:00:00+02:00",
    zeitzone: "Europe/Berlin",
  });
  expect(r.statusCode, r.body).toBe(200);
  const n = r.json().notiz;
  expect(r.json().ergebnisse[0]).toMatchObject({
    art: "klaerung",
    unsicher: true,
    ueberlappend: true,
    quelle: { startMs: 0, endMs: 2000, transkriptFassung: 1 },
  });
  const x = { fassung: n.fassung, bewusst: true, eigeneAufgaben: true, auswahl: ["c"] };
  const a = await call(`/${n.id}/uebernehmen`, x);
  expect(a.statusCode, a.body).toBe(200);
  const k = await call(`/${n.id}/korrektur`, {
    fassung: n.fassung,
    segmentId: "c",
    text: "Aufgabe: Lizenzstand prüfen.",
  });
  expect(k.statusCode, k.body).toBe(200);
  const n2 = k.json().notiz;
  expect(n2.id).not.toBe(n.id);
  expect(n2.wissensHerkunft.besprechung.transkriptFassung).toBe(2);
  const a2 = await call(`/${n2.id}/uebernehmen`, { ...x, fassung: n2.fassung });
  expect(a2.statusCode, a2.body).toBe(200);
  expect(a2.json().aufgaben[0]).toMatchObject({
    id: a.json().aufgaben[0].id,
    wiederholt: true,
    abweichung: true,
  });
  expect(k.json().verarbeitung.modellaufrufe).toBe(0);
  expect(
    (
      await app.inject({
        method: "GET",
        url: `/api/me/klara/notizen/${a2.json().notizId}`,
        headers: { authorization: `Bearer ${token}` },
      })
    ).body,
  ).toContain("Vorhandene Aufgaben weichen");
  expect((await call(`/${n.id}/lesen`)).json().notiz.inhalt).toContain("Aufgabe: Lizenz prüfen.");
});
it("berechtigter Audio/VTT-Import ohne Recorder; Rohquelle privat, Löschung entfernt private Ableitungen", async () => {
  const uploaded = await app.inject({
    method: "POST",
    url: "/api/objects",
    headers: { authorization: `Bearer ${token}` },
    payload: {
      name: "synthetisch.wav",
      mime: "audio/wav",
      kind: "video",
      purpose: "klara_audio",
      confidentiality: "intern",
      data: "data:audio/wav;base64,UklGRg==",
    },
  });
  expect(uploaded.statusCode, uploaded.body).toBe(201);
  const audioId = uploaded.json().id;
  const anlegen = { titel: "Audio", meetingId: "f-audio-1", berechtigt: true, audioId };
  expect((await call("/import", anlegen)).statusCode).toBe(409);
  const r = await call("/import", {
    ...anlegen,
    vtt: "WEBVTT\n\na\n00:00:00.000 --> 00:00:01.000\nAufgabe: Lizenz prüfen.",
  });
  expect(r.statusCode, r.body).toBe(200);
  const n = r.json().notiz;
  const audio = await app.inject({
    method: "GET",
    url: `/api/me/klara/besprechungen/${n.id}/audio`,
    headers: { authorization: `Bearer ${token}` },
  });
  expect(audio.statusCode, audio.body).toBe(200);
  const fremde = await app.inject({
    method: "GET",
    url: `/api/objects/${audioId}/raw`,
    headers: { authorization: `Bearer ${fremd}` },
  });
  expect(fremde.statusCode, fremde.body).toBe(404);
  const a = await call(`/${n.id}/uebernehmen`, {
    fassung: n.fassung,
    bewusst: true,
    eigeneAufgaben: true,
    auswahl: ["a"],
  });
  expect(a.statusCode, a.body).toBe(200);
  const del = await app.inject({
    method: "DELETE",
    url: `/api/me/klara/notizen/${n.id}`,
    headers: { authorization: `Bearer ${token}` },
  });
  expect(del.statusCode, del.body).toBe(200);
  expect((await call(`/${n.id}/lesen`)).statusCode).toBe(404);
  expect(await services.objects.read(audioId)).toBeUndefined();
  const auf = await app.inject({
    method: "GET",
    url: `/api/me/klara/aufgaben/${a.json().aufgaben[0].id}`,
    headers: { authorization: `Bearer ${token}` },
  });
  expect(auf.statusCode).toBe(404);
});
it("Keine KI: manuelle Notiz nutzt keinen Modellweg; Importrecht, gleiche Kopie und Segmentfehler sind ehrlich", async () => {
  expect((await call("/import", { titel: "Ohne Recht", text })).statusCode).toBe(400);
  const x = { titel: "Kopie", text, berechtigt: true };
  const a = await call("/import", x);
  const b = await call("/import", x);
  expect(a.statusCode, a.body).toBe(200);
  expect(b.json().notiz.id).toBe(a.json().notiz.id);
  expect(a.json().verarbeitung).toMatchObject({ modellaufrufe: 0, asr: "nicht_ausgefuehrt" });
  const schlecht = await call("/import", {
    titel: "Defekt",
    berechtigt: true,
    vtt: "WEBVTT\n\na\n00:00:02.000 --> 00:00:01.000\nRauschen",
  });
  expect(schlecht.statusCode).toBe(400);
  expect(await services.ko.list()).toHaveLength(0);
});
it("Keine KI sperrt auch zeitgebundene lokale Transkription; Quellentzug während Verarbeitung verwirft Ergebnis", async () => {
  const u = await app.inject({
    method: "POST",
    url: "/api/objects",
    headers: { authorization: `Bearer ${token}` },
    payload: {
      name: "f.wav",
      mime: "audio/wav",
      kind: "video",
      purpose: "klara_audio",
      data: "data:audio/wav;base64,UklGRg==",
    },
  });
  expect(u.statusCode).toBe(201);
  const audioId = u.json().id;
  let calls = 0;
  const alt = services.reasoner.kiAbschaltung.bind(services.reasoner);
  services.reasoner.kiAbschaltung = () => ({ ...alt(), abgeschaltet: true });
  services.media.analyze = async () => {
    calls++;
    throw new Error("darf nicht laufen");
  };
  expect(
    (await call("/import", { titel: "Keine KI", berechtigt: true, transkription: true, audioId }))
      .statusCode,
  ).toBe(403);
  expect(calls).toBe(0);
  services.reasoner.kiAbschaltung = alt;
  let weiter: () => void = () => {};
  let begonnen: () => void = () => {};
  const start = new Promise<void>((r) => {
    begonnen = r;
  });
  const gate = new Promise<void>((r) => {
    weiter = r;
  });
  services.media.analyze = async () => {
    calls++;
    begonnen();
    await gate;
    return {
      objectId: audioId,
      engineActive: true,
      engine: "synthetischer Adapter, kein realer ASR-Lauf",
      transcript: "Aufgabe: Prüfen.",
      note: "synthetisch",
      zeittranskript: {
        text: "Aufgabe: Prüfen.",
        segmente: [{ id: "eins", startMs: 0, endMs: 1000, text: "Aufgabe: Prüfen." }],
      },
    };
  };
  const lauf = call("/import", { titel: "Entzug", berechtigt: true, transkription: true, audioId });
  await start;
  await services.objects.delete(audioId);
  weiter();
  expect((await lauf).statusCode).toBe(404);
  expect(calls).toBe(1);
  const n = await app.inject({
    method: "GET",
    url: "/api/me/klara/notizen",
    headers: { authorization: `Bearer ${token}` },
  });
  expect(n.body).not.toContain("Entzug");
});
it("D .995 · gewählte Originalstellen bleiben private Quelle; gleiche Lizenz einmal im Kalender, relative/unbelegte Datumsangaben offen", async () => {
  const original =
    "Lizenz L-91: Ablaufdatum 2027-04-30.\nLizenz L-92: Ablaufdatum morgen.\nEin beliebiger Termin am 2027-05-02.";
  const r = await call("/import", {
    titel: "Lizenzrunde",
    berechtigt: true,
    text: original,
    meetingDatum: "2026-10-01T10:00:00+02:00",
    zeitzone: "Europe/Berlin",
  });
  expect(r.statusCode, r.body).toBe(200);
  const n = r.json().notiz;
  const auswahl = { fassung: n.fassung, bewusst: true, auswahl: ["zeile-1", "zeile-2"] };
  expect((await call(`/${n.id}/fristquelle`, auswahl, fremd)).statusCode).toBe(404);
  expect(
    (await call(`/${n.id}/fristquelle`, { ...auswahl, fassung: n.fassung + 1 })).statusCode,
  ).toBe(409);
  const q = await call(`/${n.id}/fristquelle`, auswahl);
  expect(q.statusCode, q.body).toBe(200);
  expect((await call(`/${n.id}/fristquelle`, auswahl)).json().notizId).toBe(q.json().notizId);
  const headers = { authorization: `Bearer ${token}` };
  const quelle = (
    await app.inject({ method: "GET", url: `/api/me/klara/notizen/${q.json().notizId}`, headers })
  ).json().notiz;
  expect(quelle.inhalt).toBe(original.split("\n").slice(0, 2).join("\n"));
  expect(quelle.wissensHerkunft.besprechung).toMatchObject({
    quelleNotizId: n.id,
    transkriptFassung: 1,
    meetingDatum: "2026-10-01T10:00:00+02:00",
  });
  expect(quelle.wissensHerkunft.besprechung.segmente.map((s: { id: string }) => s.id)).toEqual([
    "zeile-1",
    "zeile-2",
  ]);
  const regel = {
    aktiv: true,
    quellen: [{ art: "notiz", id: q.json().notizId }],
    arten: ["ablauf"],
    bereich: "persoenlich",
    zeitzone: "Europe/Berlin",
    aenderung: "klaeren",
    widerruf: "unzuverlaessig_ohne_vorlauf",
    wiederpruefung: "relevante_aenderung_klaeren",
    pruefstand: "aw19-sollbestand-1",
  };
  const s = await app.inject({
    method: "PUT",
    url: "/api/me/klara/fristen/regel",
    headers,
    payload: { regel, fassung: 0 },
  });
  expect(s.statusCode, s.body).toBe(200);
  expect(s.json().fristen).toHaveLength(2);
  expect(
    s.json().fristen.find((f: { objekt: { kennung: string } }) => f.objekt.kennung === "L-92"),
  ).toMatchObject({ stand: "klaerung", datum: null });
  const f = s
    .json()
    .fristen.find((f: { objekt: { kennung: string } }) => f.objekt.kennung === "L-91");
  expect(f).toMatchObject({
    stand: "erkannt",
    datum: { art: "datum", datum: "2027-04-30" },
    verantwortlich: null,
  });
  expect(f.herkunft[0].beleg).toMatchObject({
    quelle: { art: "notiz", id: q.json().notizId, fassung: String(quelle.fassung) },
    abschnitt: { wortlaut: original.split("\n")[0] },
  });
  const kalender = () => app.inject({ method: "GET", url: "/api/me/kalender", headers });
  const k = await kalender();
  expect(k.statusCode, k.body).toBe(200);
  expect(k.json().eintraege).toHaveLength(1);
  const eventId = k.json().eintraege[0].id;
  for (let i = 0; i < 2; i++)
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/api/me/klara/fristen/aktualisieren",
          headers,
          payload: {},
        })
      ).statusCode,
    ).toBe(200);
  expect((await kalender()).json().eintraege.map((e: { id: string }) => e.id)).toEqual([eventId]);
  const fremdKalender = await app.inject({
    method: "GET",
    url: "/api/me/kalender",
    headers: { authorization: `Bearer ${fremd}` },
  });
  expect(fremdKalender.body).not.toContain("L-91");
  expect(await services.ko.list()).toHaveLength(0);
  expect(
    (await app.inject({ method: "DELETE", url: `/api/me/klara/notizen/${n.id}`, headers }))
      .statusCode,
  ).toBe(200);
  expect((await kalender()).json().eintraege).toHaveLength(0);
});
