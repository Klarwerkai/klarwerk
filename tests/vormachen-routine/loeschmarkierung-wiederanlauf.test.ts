// ================================================================================================
// produkt:20261011:peter-p06 · RF-17 — LÖSCHMARKIERUNG VOR DER WIEDERFREIGABE (Speicherbetrieb).
// ================================================================================================
//
// Originalfall RF-17: „Privatverlauf löschen, getrennt geteilte Firmennotiz behalten; später
// Testrestore → Privatbestand entfernt, geteiltes Wissen erhalten, Löschmarkierung vor
// Wiederfreigabe angewendet." Gemessen an der echten Anwendung (`buildApp`, `inject`) und dem
// bestehenden Wiederanlauf (`registriereWiederanlauf`, wie `server.ts` ihn mit
// `KLARWERK_WIEDERANLAUF` fährt). Die Markierungen liegen in einer echten Datei außerhalb des
// Bestands (`DateiLoeschmarkierungen`).
//
// SIMULIERTER RESTORE: Hier wird der Sicherungsstand der Routinen vor der Löschung festgehalten und
// danach in dieselbe Ablage zurückgelegt — das Gegenstück einer wiederhergestellten Datenbank im
// Speicherbetrieb (wie `tests/wiederanlauf/sperre-und-freigabe.test.ts`). Den echten Restore mit
// `backup.sh` und `restore-drill.sh` misst `routinen-loeschmarkierung-restore.integration.test.ts`.
//
//   L1  Sicherung → Privatlöschung → Restore → Wiederanlauf: die wieder aufgetauchte Routine ist
//       entfernt, BEVOR eine Anfrage angenommen wird; eine nach der Löschung bestätigte Routine und
//       die Routine eines anderen Kontos bleiben; der übergebene Firmenentwurf bleibt. Die Markierung
//       trägt keinen Inhalt; ein Neustart derselben Kennung entfernt nichts zweites Mal.
//   L2  Kann die Markierung nicht vermerkt werden, wird nicht gelöscht.
//   L3  Eine abgebrochene letzte Zeile zählt nicht; eine unlesbare Zeile lässt den Wiederanlauf nicht
//       bereit werden (fail-closed).
//   L4  Ohne eingerichtete Ablage sagt die Auskunft das ausdrücklich (`ort: null`).
import { appendFileSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { type AppServices, buildApp, buildServices } from "../../services/app/src/build-app";
import {
  DateiLoeschmarkierungen,
  type LoeschmarkierungsAblage,
  fuehreLoeschmarkierungenNach,
} from "../../services/app/src/loeschmarkierungen";
import type { Routine } from "../../services/app/src/vormachen";
import {
  AKTION_WIEDERANLAUF_LOESCHMARKIERUNGEN,
  FREIGABE_BESTAETIGUNGEN,
  registriereWiederanlauf,
} from "../../services/app/src/wiederanlauf";
import {
  type App,
  type Bestand,
  KONTEN,
  type Kopf,
  anmelden,
  legeFiktivenBestand,
} from "../wiederherstellung-export/bestand";

const URL = "/api/me/vormachen";
const ALLE_BESTAETIGT = Object.fromEntries(FREIGABE_BESTAETIGUNGEN.map((b) => [b, true]));
const SICHERUNG = "2026-10-11T03:15:00.000Z";
const ZWECK = {
  anna: "Fiktiv: Wochenbericht Linie Nord vorbereiten",
  annaNeu: "Fiktiv: nach der Löschung neu vorgemacht",
  bert: "Fiktiv: Entlüftung Süd nachschlagen",
} as const;

const ordner: string[] = [];
afterEach(() => {
  for (const o of ordner.splice(0)) {
    rmSync(o, { recursive: true, force: true });
  }
});

function dateiAblage(): DateiLoeschmarkierungen {
  const o = mkdtempSync(join(tmpdir(), "klarwerk-p06-loeschmarkierung-"));
  ordner.push(o);
  return new DateiLoeschmarkierungen(join(o, "markierungen", "loeschmarkierungen.jsonl"));
}

const warte = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Vormachen über die echten Routen (sichtbare Anzeige, zwei Seitenwechsel), dann bestätigen. */
async function routine(app: App, kopf: Kopf, zweck: string): Promise<string> {
  const start = await app.inject({
    method: "POST",
    url: URL,
    headers: kopf,
    payload: { host: "klarwerk_web", vorgaenge: ["seite_oeffnen"], zweck },
  });
  expect(start.statusCode, start.body).toBe(201);
  const sitzung = (start.json() as { sitzung: { id: string } }).sitzung.id;
  const anzeige = await app.inject({ url: `${URL}?anzeige=klarwerk_web`, headers: kopf });
  expect((anzeige.json() as { sichtbar: boolean }).sichtbar).toBe(true);
  for (const pfad of ["/bibliothek", "/fragen"]) {
    const beob = await app.inject({
      method: "POST",
      url: `${URL}/${sitzung}/beobachtungen`,
      headers: kopf,
      payload: { host: "klarwerk_web", vorgang: "seite_oeffnen", beschreibung: pfad },
    });
    expect(beob.statusCode, beob.body).toBe(201);
  }
  const vorschau = await app.inject({ url: `${URL}/${sitzung}/vorschau`, headers: kopf });
  const stand = (vorschau.json() as { vorschau: { stand: string } }).vorschau.stand;
  const best = await app.inject({
    method: "POST",
    url: `${URL}/${sitzung}/bestaetigung`,
    headers: kopf,
    payload: { stand },
  });
  expect(best.statusCode, best.body).toBe(201);
  return (best.json() as { routine: { id: string } }).routine.id;
}

async function routinenIds(app: App, kopf: Kopf): Promise<string[]> {
  const res = await app.inject({ url: URL, headers: kopf });
  expect(res.statusCode, res.body).toBe(200);
  return (res.json() as { routinen: { id: string }[] }).routinen.map((r) => r.id);
}

async function imWiederanlauf(
  services: AppServices,
  kennung: string,
  ablage: LoeschmarkierungsAblage | undefined,
): Promise<App> {
  const app = buildApp(services, { loeschmarkierungen: ablage });
  registriereWiederanlauf(app, {
    wiederanlauf: { kennung, sicherungsstand: SICHERUNG },
    audit: services.audit,
    auth: services.auth,
    quellen: {
      wissensobjekte: () => services.ko.list({}),
      revalidierungFaellig: () => services.lifecycle.pendingRevalidation(),
      offeneWidersprueche: () => services.conflicts.unresolved(),
      wissensobjekt: (id) => services.ko.get(id),
    },
    loeschmarkierungen: () => fuehreLoeschmarkierungenNach(ablage, services.vormachenRoutinen),
  });
  await app.ready();
  return app;
}

async function quelle(
  ablage: LoeschmarkierungsAblage | undefined,
): Promise<{ services: AppServices; app: App; b: Bestand }> {
  const services = buildServices();
  const app = buildApp(services, { loeschmarkierungen: ablage });
  return { services, app, b: await legeFiktivenBestand(app) };
}

describe("P06 · RF-17 · Löschmarkierung vor der Wiederfreigabe", () => {
  it("L1 · Sicherung → Privatlöschung → Restore → Wiederanlauf: entfernt vor der Freigabe, Firmenentwurf bleibt", async () => {
    const ablage = dateiAblage();
    const { services, app, b } = await quelle(ablage);
    const anna = b.kennung.anna;
    const bert = b.kennung.bert;
    const alt = await routine(app, b.kopf.anna, ZWECK.anna);
    const bertsRoutine = await routine(app, b.kopf.bert, ZWECK.bert);
    // Getrennt geteilt: die Firmenübergabe legt einen eigenen Entwurf an.
    const uebergabe = await app.inject({
      method: "POST",
      url: `${URL}/routinen/${alt}/firmenuebergabe`,
      headers: b.kopf.anna,
    });
    expect(uebergabe.statusCode, uebergabe.body).toBe(201);
    const uebergeben = (uebergabe.json() as { routine: Routine }).routine;
    const entwurfId = uebergeben.firmenuebergabe?.entwurfId ?? "";
    expect(entwurfId).not.toBe("");
    const idsVon = async (konto: string) =>
      (await services.vormachenRoutinen.routinen(konto)).map((r) => r.id);

    // SICHERUNG (simuliert): der Stand der Routinen vor der Löschung.
    const gesichert = [
      ...(await services.vormachenRoutinen.routinen(anna)),
      ...(await services.vormachenRoutinen.routinen(bert)),
    ];
    expect(gesichert.map((r) => r.id).sort()).toEqual([alt, bertsRoutine].sort());

    // PRIVATLÖSCHUNG nach der Sicherung — mit Markierung außerhalb des Bestands.
    await warte(5);
    const loeschen = await app.inject({ method: "DELETE", url: URL, headers: b.kopf.anna });
    expect(loeschen.statusCode, loeschen.body).toBe(200);
    expect(loeschen.json()).toEqual({ geloescht: { sitzungen: 0, routinen: 1 } });
    const roh = readFileSync(ablage.ort, "utf8");
    const markierungen = await ablage.alle();
    expect(markierungen).toEqual([
      { art: "persoenliche_routinen", kontoId: anna, am: expect.any(String) },
    ]);
    // Die Markierung trägt nur Art, Konto und Zeitpunkt — keinen Titel, Zweck oder Schritt.
    expect(roh).not.toContain(ZWECK.anna);
    expect(roh).not.toContain("/bibliothek");
    // Nach der Löschung macht Anna eine neue Routine vor; sie muss jede Nachführung überstehen.
    await warte(5);
    const neu = await routine(app, b.kopf.anna, ZWECK.annaNeu);
    await app.close();

    // RESTORE (simuliert): die gesicherten Routinen sind wieder da — samt der gelöschten.
    for (const r of gesichert) {
      await services.vormachenRoutinen.lege(r);
    }
    expect((await idsVon(anna)).sort(), "wieder aufgetaucht").toEqual([alt, neu].sort());

    // WIEDERANLAUF: bereit heißt, die Markierung ist schon angewendet — vor jeder Anfrage.
    const ziel = await imWiederanlauf(services, "p06-rf17", ablage);
    expect(await idsVon(anna)).toEqual([neu]);
    expect(await idsVon(bert)).toEqual([bertsRoutine]);
    const admin = await anmelden(ziel, KONTEN.admin.email);
    const zielAnna = await anmelden(ziel, KONTEN.anna.email);
    const lage = await ziel.inject({ url: "/api/admin/wiederanlauf", headers: admin });
    expect(lage.json()).toMatchObject({
      zustand: "gesperrt",
      persoenlicheLoeschmarkierungen: { ort: ablage.ort, markierungen: 1, entfernt: 1 },
    });
    // Vor der Freigabe ist auch Annas eigener Bereich gesperrt.
    expect((await ziel.inject({ url: URL, headers: zielAnna })).statusCode).toBe(503);
    const vermerkt = () => services.audit.list({ action: AKTION_WIEDERANLAUF_LOESCHMARKIERUNGEN });
    const eintraege = await vermerkt();
    expect(eintraege.map((e) => e.payload)).toEqual([
      { kennung: "p06-rf17", eingerichtet: true, markierungen: 1, entfernt: 1 },
    ]);
    expect(JSON.stringify(eintraege)).not.toContain(ZWECK.anna);

    const frei = await ziel.inject({
      method: "POST",
      url: "/api/admin/wiederanlauf/freigabe",
      headers: admin,
      payload: ALLE_BESTAETIGT,
    });
    expect(frei.statusCode, frei.body).toBe(200);
    // Nach der Freigabe: der Privatbestand bleibt entfernt, die neue Routine und Berts bleiben,
    // der getrennt übergebene Firmenentwurf ist unverändert erreichbar.
    expect(await routinenIds(ziel, zielAnna)).toEqual([neu]);
    const zielBert = await anmelden(ziel, KONTEN.bert.email);
    expect(await routinenIds(ziel, zielBert)).toEqual([bertsRoutine]);
    const entwurf = await ziel.inject({ url: `/api/drafts/${entwurfId}`, headers: zielAnna });
    expect(entwurf.statusCode, entwurf.body).toBe(200);
    expect(entwurf.body).toContain(ZWECK.anna);
    await ziel.close();

    // Ein Neustart derselben Kennung wendet erneut an — und entfernt nichts zweites Mal.
    const neustart = await imWiederanlauf(services, "p06-rf17", ablage);
    const zweite = await neustart.inject({
      url: "/api/admin/wiederanlauf",
      headers: await anmelden(neustart, KONTEN.admin.email),
    });
    expect(zweite.json()).toMatchObject({
      persoenlicheLoeschmarkierungen: { markierungen: 1, entfernt: 0 },
    });
    expect(await idsVon(anna)).toEqual([neu]);
    expect(await vermerkt()).toHaveLength(1);
    await neustart.close();
  });

  it("L2 · kann die Markierung nicht vermerkt werden, wird nicht gelöscht", async () => {
    const kaputt: LoeschmarkierungsAblage = {
      ort: "nicht-schreibbar",
      vermerke: () => Promise.reject(new Error("Datenträger nicht schreibbar (fiktiv)")),
      alle: () => Promise.resolve([]),
    };
    const { app, b } = await quelle(kaputt);
    const id = await routine(app, b.kopf.anna, ZWECK.anna);
    const loeschen = await app.inject({ method: "DELETE", url: URL, headers: b.kopf.anna });
    expect(loeschen.statusCode).toBe(500);
    expect(await routinenIds(app, b.kopf.anna)).toEqual([id]);
    await app.close();
  });

  it("L3 · abgebrochene letzte Zeile zählt nicht; eine unlesbare Zeile hält den Wiederanlauf an", async () => {
    const ablage = dateiAblage();
    await ablage.vermerke({ art: "persoenliche_routinen", kontoId: "konto-a", am: SICHERUNG });
    appendFileSync(ablage.ort, '{"art":"persoenliche_routinen","kontoId":"konto-b"');
    expect((await ablage.alle()).map((m) => m.kontoId)).toEqual(["konto-a"]);

    appendFileSync(ablage.ort, "\nkeine Markierung\n");
    await expect(ablage.alle()).rejects.toThrow(/Zeile 2 ist keine Markierung/);
    const anlauf = imWiederanlauf(buildServices(), "p06-rf17-kaputt", ablage);
    await expect(anlauf).rejects.toThrow(/keine Markierung/);
  });

  it("L4 · ohne eingerichtete Ablage sagt die Auskunft, dass nichts nachgeführt ist", async () => {
    const { services, app, b } = await quelle(undefined);
    await routine(app, b.kopf.anna, ZWECK.anna);
    const loeschen = await app.inject({ method: "DELETE", url: URL, headers: b.kopf.anna });
    expect(loeschen.json()).toEqual({ geloescht: { sitzungen: 0, routinen: 1 } });
    await app.close();
    const ziel = await imWiederanlauf(services, "p06-rf17-ohne", undefined);
    const lage = await ziel.inject({
      url: "/api/admin/wiederanlauf",
      headers: await anmelden(ziel, KONTEN.admin.email),
    });
    expect(lage.json()).toMatchObject({
      persoenlicheLoeschmarkierungen: { ort: null, markierungen: 0, entfernt: 0 },
    });
    await ziel.close();
  });
});
