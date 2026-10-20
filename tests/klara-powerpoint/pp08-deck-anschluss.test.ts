import JSZip from "jszip";
import { expect, it } from "vitest";
import type { DeckVertrag } from "../../services/app/src/office-datenfolien";
import type { AufbauPlan } from "../../services/app/src/praesentation-aufbau";
import { leseVortragsDeck } from "../../services/app/src/praesentation-vortrag-deck";
import { decodeDataUrl } from "../../services/object-store";
import { welt } from "./pp05-welt";

it("PP08 mit festem PP05: echter Aufbau/Übernahme, Hauptfrage führt zur zugehörigen Belegfolie", async () => {
  const w = await welt();
  try {
    const p = await w.app.inject({
      method: "POST",
      url: `${w.basis}/folienaufbau/vorschau`,
      payload: w.auftrag,
    });
    expect(p.statusCode, p.body).toBe(200);
    const plan = p.json<AufbauPlan>();
    const r = await w.app.inject({
      method: "POST",
      url: `${w.basis}/folienaufbau/uebernehmen`,
      payload: { ...w.auftrag, planId: plan.planId },
    });
    expect(r.statusCode, r.body).toBe(200);
    const eltern = r.json<{
      deck: DeckVertrag;
      dateiFassung: string;
      bindungenOffen: string[];
      belegOffen: string[];
    }>();
    expect(eltern.bindungenOffen).toEqual([]);
    const lage = (await w.app.inject({ method: "GET", url: `${w.basis}/folien-daten` })).json();
    const haupt = eltern.deck.bindungen.find((b) => b.datenpunktId === w.a.id && !b.zeile);
    if (!haupt) throw new Error("Echte PP05-Hauptbindung fehlt");
    const nachbereitung = [
      {
        sldId: haupt.sldId,
        aussage: { id: w.a.id, fassung: 1 },
        text: "Ursache ergänzen",
        quelle: "Eigene Testnotiz 20.10.2026",
        art: "erklaerung",
      },
    ];
    const a = {
      basis: eltern.dateiFassung,
      modus: "frage",
      zielSekunden: 720,
      notizen: [],
      nachbereitung,
      frage: {
        text: "Wo belegen wir 400?",
        aussage: { id: w.a.id, fassung: 1 },
        sldId: haupt.sldId,
      },
    };
    const frage = await w.app.inject({ method: "POST", url: `${w.basis}/vortrag`, payload: a });
    expect(frage.statusCode, frage.body).toBe(200);
    const belege = eltern.deck.belegfolien.find((b) => b.datenpunktId === w.a.id);
    if (!belege) throw new Error("Echte PP05-Belegbindung fehlt");
    expect(frage.json().antwort.sldIds).toEqual(expect.arrayContaining(belege.sldIds));
    expect(frage.json().belegfolien).toContainEqual({
      aussage: { id: w.a.id, fassung: 1 },
      sldIds: belege.sldIds,
    });
    const mitNotiz = await w.app.inject({
      method: "POST",
      url: `${w.basis}/vortrag`,
      payload: {
        ...a,
        modus: "vorbereiten",
        notizen: [
          {
            sldId: haupt.sldId,
            text: "Bedeutung erläutern",
            uebergang: "Quelle öffnen",
            sekunden: 60,
            aussagen: [{ id: w.a.id, fassung: 1 }],
            detailSldIds: belege.sldIds,
          },
        ],
      },
    });
    expect(mitNotiz.statusCode, mitNotiz.body).toBe(200);
    const ko = await w.ko.get(w.article.id);
    const objectId = ko?.attachments[0]?.objectId;
    const objekt = objectId ? await w.objekte.read(objectId) : undefined;
    const bytes = objekt ? decodeDataUrl(objekt.data)?.bytes : undefined;
    if (!bytes) throw new Error("Übernommene Elternbytes fehlen");
    const k = {
      koId: w.article.id,
      anhangId: String(w.anhangId),
      dateiFassung: eltern.dateiFassung,
      folien: lage.folien,
      datenpunkte: lage.datenpunkte,
    };
    // Nicht lesbare Datenpunkt-Herkunft wird nicht aus dem eingebetteten Manifest nachkopiert.
    const ohneRecht = await leseVortragsDeck(bytes, { ...k, datenpunkte: [] });
    expect(ohneRecht?.belegfolien).toEqual([]);
    expect(JSON.stringify(ohneRecht)).not.toContain(w.a.id);
    // Tatsächlich veränderte Detailfolie: Manifest allein bestätigt ihren Text nicht.
    const kaputt = structuredClone(k);
    const detail = kaputt.folien.find((f: { sldId: string }) => f.sldId === belege.sldIds[0]);
    if (!detail) throw new Error("Detailfolie fehlt");
    detail.elemente.find((e: { shapeId: string }) => e.shapeId === "3").text =
      "Manuell anderer Beleg";
    expect(
      (await leseVortragsDeck(bytes, kaputt))?.belegfolien.some((b) => b.datenpunktId === w.a.id),
    ).toBe(false);
    const gross = await JSZip.loadAsync(bytes);
    const pfad = Object.keys(gross.files).find((p) => /^ppt\/klara\/pp05-\d+\.json$/.test(p));
    if (!pfad) throw new Error("Elternmanifest fehlt");
    gross.file(pfad, " ".repeat(1024 * 1024 + 1));
    expect(
      await leseVortragsDeck(
        await gross.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }),
        k,
      ),
    ).toBeUndefined();
    // Mehrere Manifeste werden ohne PP07-Fassungsentscheidung nicht als ein Deck gedeutet.
    const z = await JSZip.loadAsync(bytes);
    z.file("ppt/klara/pp05-99999.json", "{}");
    expect(
      await leseVortragsDeck(await z.generateAsync({ type: "nodebuffer" }), k),
    ).toBeUndefined();
  } finally {
    await w.app.close();
  }
});
