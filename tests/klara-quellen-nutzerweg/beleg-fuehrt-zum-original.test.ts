// ================================================================================================
// JOB 4224 · D5 · LIEFERUNG 2 — DER BELEG FÜHRT BIS ZUM ORIGINAL, NICHT NUR BIS ZUM AUSZUG
// ================================================================================================
//
// DIE GEMESSENE LÜCKE (am main 598fc2c aufgeschlagen, Auftrag §2): `AnswerSourceDetails.tsx` zeigt
// je Antwortquelle Status, Trust, eine Kurzvorschau und einen aufklappbaren Auszug — und dieser
// Auszug kommt AUSSCHLIESSLICH aus `ko.bodyHtml` (`:30`). Einen Weg zur hinterlegten Originaldatei
// oder zur externen Originaladresse trug die Komponente an keiner Stelle. Der Anker dorthin liegt
// seit JOB 4077 am Draht (`KoSource.objectId`), und `quellennachweis` (`lib/koSource.ts`) löst ihn
// seit JOB 4013/4077 zu einem DATEINAMEN auf — aber zu keiner Adresse, unter der man ihn öffnet.
//
// WAS DIESE DATEI MISST — die Kette, nicht ein Stück davon:
//   Bestand (Original hochgeladen, Eintrag angelegt, Original angehängt, Quelle daran verankert,
//   freigegeben) → `POST /api/ask` → Antwort mit belegter Quelle → `GET /api/kos` (der Bestand, den
//   die Fragenfläche über `useKos()` liest) → die EINE Ableitung, die die Fläche benutzt
//   (`originalweg`, `lib/askCitedSources.ts`) → `GET /api/objects/:id/raw` → der Originalinhalt.
//
// DIE DOM-HÄLFTE steht in `flaeche-fuehrt-zum-original.test.tsx` (gemountete `pages/Ask.tsx`).
// Diese Datei ist DOM-frei, damit sie im Node-reinen Wurzel-Typcheck (`tsconfig.json`, `lib: ES2022`)
// mitläuft; die gemounteten Fälle brauchen die DOM-Bibliothek und wohnen deshalb in `.tsx`.
//
// DER KONTROLLIERTE MODELLADAPTER ist als solcher benannt (`kette.ts`). Damit darf weder eine reale
// semantische Antwortqualität noch eine Microsoft-365-Host-Abnahme behauptet werden.
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  type Aufbau,
  BELEGSTELLE,
  type Draht,
  ORIGINALNAME,
  ORIGINALTEXT,
  QUELLENBEZEICHNUNG,
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

import type { KnowledgeObject } from "../../apps/web/src/api/types";
import { originalweg } from "../../apps/web/src/lib/askCitedSources";

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
  draht.lage.zuletzt = null;
});

async function vorrichtung(): Promise<Aufbau> {
  const a = await appAufbauen();
  aufbau = a;
  draht.setzeApp(a.app);
  return a;
}

/** Das Wissensobjekt, das die Fragenfläche zu einer Antwortquelle findet (`useKos()`-Bestand). */
function koAus(bestand: Record<string, unknown>[], id: string): KnowledgeObject {
  const treffer = bestand.find((k) => k.id === id);
  expect(treffer, `die Quelle ${id} fehlt im Bestand, den die Fläche liest`).toBeDefined();
  return treffer as unknown as KnowledgeObject;
}

describe("JOB 4224 · D5 · B — von der Antwort bis zum Original", () => {
  it("B0 · KALIBRIERUNG: der kontrollierte Adapter hat geantwortet und die Antwort belegt den Eintrag", async () => {
    const { app, admin } = await vorrichtung();
    const eintrag = await eintragMitOriginal(app, admin);
    const leser = await neuesKonto(app, "leser", admin);

    const antwort = await fragen(app, leser);
    expect(antwort.status, antwort.roh).toBe(200);
    expect(
      draht.lage.generierungen,
      "der Adapter wurde nicht befragt — dann misst dieser Lauf den deterministischen Ersatz",
    ).toBeGreaterThan(0);
    expect(antwort.answered, `keine Antwort: ${antwort.roh}`).toBe(true);
    expect(antwort.citedSources, "die Antwort belegt den Eintrag nicht").toContain(eintrag.koId);
    // Ohne diese Zeile wäre „belegt" eine Behauptung über eine Antwort ohne Text.
    expect((antwort.answer ?? "").length).toBeGreaterThan(0);
  });

  it("B1 · DIE KETTE: von der belegten Quelle bis zum lesbaren Originalinhalt", async () => {
    const { app, admin } = await vorrichtung();
    const eintrag = await eintragMitOriginal(app, admin);
    const leser = await neuesKonto(app, "leser", admin);

    const antwort = await fragen(app, leser);
    expect(antwort.citedSources).toContain(eintrag.koId);

    // Der Bestand, den die Fragenfläche liest — dieselbe Route, die `useKos()` ruft.
    const ko = koAus(await kosLesen(app, leser), eintrag.koId);
    // Erst hier entsteht der Weg zum Original: EINE Ableitung, von der Fläche gelesen.
    const weg = originalweg(ko, "de");
    expect(weg.erreichbar, "von dieser Quelle führt kein Weg zu einem Original").toBe(true);
    const quelle = weg.quellen[0];
    expect(quelle, "die Quelle des Eintrags fehlt im Weg").toBeDefined();
    expect(quelle?.quelle.label).toBe(QUELLENBEZEICHNUNG);
    // Die Belegstelle im Wortlaut der Quelle bleibt sichtbar — sie ersetzt das Original nicht.
    expect(quelle?.quelle.excerpt).toBe(BELEGSTELLE);
    const datei = quelle?.datei;
    expect(datei, "die Quelle nennt kein hinterlegtes Original").not.toBeNull();
    expect(datei?.name).toBe(ORIGINALNAME);
    expect(datei?.objectId).toBe(eintrag.objectId);
    expect(datei?.href).toBe(`/api/objects/${eintrag.objectId}/raw`);

    // UND DER WEG TRÄGT WIRKLICH: die Adresse liefert den Originalinhalt an genau diesen Menschen.
    const roh = await originalLesen(app, leser, eintrag.objectId);
    expect(roh.statusCode, `das Original ist nicht abrufbar: ${roh.body}`).toBe(200);
    expect(roh.body).toBe(ORIGINALTEXT);
    // Und die Metadaten daneben — der Name, unter dem die Fläche es anbietet.
    const meta = await objektLesen(app, leser, eintrag.objectId);
    expect(meta.statusCode).toBe(200);
    expect((meta.json() as { ref: { name: string } }).ref.name).toBe(ORIGINALNAME);
  });

  it("B2 · GEGENPROBE: ein Eintrag ohne jedes Original erfindet keinen Beleg", async () => {
    // Derselbe Weg, eine Änderung: der Eintrag trägt weder Quelle noch Anhang. Ohne diesen Fall
    // misst B1 nur „irgendetwas wird angezeigt".
    const { app, admin } = await vorrichtung();
    const ohne = await app.inject({
      method: "POST",
      url: "/api/kos",
      headers: admin.kopf,
      payload: {
        title: "Zylinderkopfdichtung XQ42 wechseln",
        statement: BELEGSTELLE,
        type: "best_practice",
        category: "Betrieb",
        confidentiality: "intern",
        neededValidations: 1,
      },
    });
    expect(ohne.statusCode, ohne.body).toBe(201);
    const koId = (ohne.json() as { id: string }).id;
    expect(
      (
        await app.inject({
          method: "PUT",
          url: `/api/kos/${koId}`,
          headers: admin.kopf,
          payload: { action: "admin-validate" },
        })
      ).statusCode,
    ).toBe(200);

    const leser = await neuesKonto(app, "leser", admin);
    const antwort = await fragen(app, leser);
    expect(antwort.citedSources).toContain(koId);

    const weg = originalweg(koAus(await kosLesen(app, leser), koId), "de");
    expect(weg.erreichbar, "für einen Eintrag ohne Original wird ein Beleg behauptet").toBe(false);
    expect(weg.freieDateien).toEqual([]);
    expect(weg.quellen).toEqual([]);
  });

  it("B3 · ein hinterlegtes Original OHNE Quelle bleibt erreichbar — und wird nicht verschwiegen", async () => {
    // Der Zustand jedes Eintrags von vor JOB 4077: das Original hängt am Objekt, aber keine
    // Belegstelle zeigt darauf. Es zu verschweigen wäre ein neuer blinder Fleck, es einer Quelle
    // zuzuschlagen eine Erfindung — es steht deshalb als EIGENE Zeile da.
    const { app, admin } = await vorrichtung();
    const eintrag = await eintragMitOriginal(app, admin, { ohneQuelle: true });
    const leser = await neuesKonto(app, "leser", admin);
    const ko = koAus(await kosLesen(app, leser), eintrag.koId);
    const weg = originalweg(ko, "de");
    expect(weg.quellen).toEqual([]);
    expect(weg.freieDateien.map((d) => d.objectId)).toEqual([eintrag.objectId]);
    expect(weg.freieDateien[0]?.href).toBe(`/api/objects/${eintrag.objectId}/raw`);
    expect(weg.freieDateien[0]?.name).toBe(ORIGINALNAME);
    expect(weg.erreichbar).toBe(true);
    // Und die Adresse trägt wirklich.
    const roh = await originalLesen(app, leser, eintrag.objectId);
    expect(roh.statusCode, roh.body).toBe(200);
    expect(roh.body).toBe(ORIGINALTEXT);
  });

  it("B4 · die Ableitung selbst: Adresse, Papierfundstelle und `javascript:` — drei Ausgänge", () => {
    // EINE reine Messung an der Ableitung, ohne Kette — bewusst so benannt und begründet: der
    // Anlageweg lässt diese drei Quellenformen im AUSLIEFERUNGSZUSTAND gar nicht zu. Gemessen im
    // Cloud-Lauf c4fd6b01…: `decideExternalAttach` antwortet auf der Stufe `search_on_click` mit
    // 403 — `public-source` für eine öffentliche Web-Adresse, `unanchored-source` für eine Quelle
    // ohne Anker. Im Altbestand und auf der Stufe „open" stehen sie sehr wohl, und dann fällt die
    // Entscheidung HIER. Der Maßstab ist derselbe wie serverseitig (`isSavableSourceUrl`).
    const quelle = (id: string, label: string, url: string) => ({
      id,
      label,
      url,
      excerpt: null,
      kind: "external",
      peerValidated: false,
      author: "a",
      at: "2026-09-16T10:00:00.000Z",
    });
    const ko = {
      id: "ko-1",
      sources: [
        quelle("q-1", "Herstellerhandbuch", "https://hersteller.example/xq42"),
        quelle("q-2", "Papier", "Handbuch XQ42, Ausgabe 2024, Seite 12"),
        quelle("q-3", "Altbestand", "javascript:alert(1)"),
      ],
    } as unknown as KnowledgeObject;
    const weg = originalweg(ko, "de");
    expect(weg.quellen[0]?.adresse?.verlinkbar).toBe(true);
    expect(weg.quellen[0]?.adresse?.voll).toBe("https://hersteller.example/xq42");
    // SICHTBAR, aber nie ein Link — ein toter Link wäre ein Versprechen ohne Deckung, und eine
    // aktive Fläche, die niemand geprüft hat, entsteht hier erst recht nicht.
    expect(weg.quellen[1]?.adresse?.verlinkbar, "eine Papierfundstelle wurde zum Link").toBe(false);
    expect(weg.quellen[2]?.adresse?.verlinkbar, "`javascript:` wurde zum Link").toBe(false);
    // Kein Anker, kein Anhang — also auch keine Datei an irgendeiner der drei.
    expect(weg.quellen.every((q) => q.datei === null)).toBe(true);
    expect(weg.freieDateien).toEqual([]);
    // Erreichbar ist der Weg allein wegen der EINEN echten Adresse.
    expect(weg.erreichbar).toBe(true);
  });

  it("B5 · GEGENPROBE zur Ableitung: nur Papier und `javascript:` — dann ist NICHTS erreichbar", () => {
    // Ohne diesen Fall wäre `erreichbar` in B4 auch dann wahr, wenn die Ableitung jede Adresse
    // durchwinkte. Hier fehlt die eine echte, und das Ergebnis muss kippen.
    const ko = {
      id: "ko-2",
      sources: [
        {
          id: "q-1",
          label: "Papier",
          url: "Handbuch XQ42, Seite 12",
          excerpt: null,
          kind: "external",
          peerValidated: false,
          author: "a",
          at: "2026-09-16T10:00:00.000Z",
        },
      ],
      attachments: [{ id: "a-1", name: "", mime: "text/plain", objectId: "obj-ohne-namen" }],
    } as unknown as KnowledgeObject;
    const weg = originalweg(ko, "de");
    expect(weg.erreichbar).toBe(false);
    // Ein Anhang ohne brauchbaren Namen wäre eine Tür ohne Schild — er entsteht gar nicht erst.
    expect(weg.freieDateien).toEqual([]);
  });
});
