// ================================================================================================
// BILDNACHWEIS IM BROWSER — WAS GESPEICHERT IST, IST WAS DASTEHT. UND DIE ABLESUNG MERKT ES.
// ================================================================================================
//
// Restprüfungen aus 4228/4269 (`archiv/4269/runde-1/ben.md:22`), am echten Weg in Chromium:
//
//   F1 · Der HISTORISCHE Beleg geht über die echte Entwurfs-API (aus der Seite heraus, durch
//        dieselbe Weiche wie jeder Aufruf der App), wird im Blatt geöffnet und NEU GELADEN — und
//        steht danach unverändert da, auf der Fläche wie im Server.
//   F2 · Das ZWILLINGSDECK (drei identische Bilder, eine ausgeblendete Form, eine ausgeblendete
//        Folie, ein verworfenes BMP) geht durch die sichtbare Dateiauswahl → speichern → öffnen →
//        neu laden → einreichen → Wissenseintrag → Eintrag NEU LADEN. An jeder Station wird Bild für
//        Bild am SICHTBAREN Inhaltscontainer gezählt (keine Quellen-Deduplizierung), jede Dekodierung
//        geprüft und jedes Bild mit den Pixeln seiner Originaldatei verglichen.
//   F2 endet mit der DOM-GEGENPROBE am Eintrag: Bild entfernen, ausblenden, zerstören, vertauschen —
//        jede Verstellung muss den Nachweis rot machen; ein eingefrorener Ableser muss die Gegenprobe
//        werfen lassen; die Zahl der Quittung wird mit `ablesungKalibrieren` gegen Ausblenden geprüft.
//
// Die Sollwerte kommen aus `bildnachweis.ts` (Deckbeschreibung, Originalbytes, Originalpixel), nicht
// aus dem Import, der geprüft wird. KEIN `waitForTimeout`: jedes Warten hängt an einem Zustand.
import { Buffer } from "node:buffer";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { DraftPayload } from "../../apps/web/src/api/types";
import { wholeDocumentDraftPayload } from "../../apps/web/src/lib/captureFromFile";
import { CAPTURE_FRONT_DOOR_ROUTE } from "../../apps/web/src/lib/captureFrontDoor";
import {
  type SeiteMitDialog,
  ablesungKalibrieren,
  aufEingelesenWarten,
  dateiUeberSichtbareAuswahl,
  einreichenUndKennung,
  quellenanzeige,
} from "../d3-dateien-durchgaengig/d3-buehne";
import { type Buehne, ORIGIN, buehneAufbauen, fn } from "../design/h3-blatt-buehne";
import {
  type Entwurfsweiche,
  FALL_RAHMEN_MS,
  OEFFNEN_LINK_SELEKTOR,
  aufErfolgskastenWarten,
  aufFlaechensatzWarten,
  dateiwegOeffnen,
  entwurfsWeicheLegen,
  ganzdokumentWaehlen,
  kennungAusOeffnenLink,
  neuLaden,
  speichernDruecken,
  speicherversuchBeginnen,
  spracheSetzen,
  wartebudget,
} from "../ux19-speichern-oeffnen-reload/ux19-buehne";
import {
  BILDER_ENTSCHIEDEN,
  BILDER_IM_INHALT,
  BILD_VERSTELLEN,
  BILD_ZURUECK,
  type Bildablesung,
  EINTRAG_INHALT,
  ENTWURF_INHALT,
  VERSTELLARTEN,
  type Verstellart,
  ZWILLINGSDECK,
  ZWILLING_DATEINAME,
  ZWILLING_MARKE,
  domBefunde,
  domGegenprobe,
  rumpfBefunde,
  sollbilanz,
  sollpixel,
  zwillingsdeck,
} from "./bildnachweis";
import { PPTX_MIME } from "./messung";
import { BILANZ_PRAEFIX, VORBEHALT, bilanzAussage, bilanzsatz } from "./quittungspruefer";

/** Der Wortlaut, mit dem die Quittung bis zum 16.09.2026 einen Bilderverlust behauptete. */
const ALTER_WORTLAUT =
  "Best-Effort-Import aus PowerPoint — Text und Struktur je Folie übernommen; Layout, Animationen, Übergänge, Bilder und Sprechernotizen gehen verloren.";
const ALTER_INHALT = "Inhalt von damals 4269";

function historischerEntwurf(): DraftPayload {
  return {
    ...wholeDocumentDraftPayload({
      fileName: "altes-deck.pptx",
      text: ALTER_INHALT,
      sourceKind: "pptx",
      locale: "de",
    }),
    bodyHtml: [
      "<blockquote><p>Quelle: altes-deck.pptx, gesamtes Dokument</p>",
      `<p>${ALTER_WORTLAUT}</p></blockquote><p>${ALTER_INHALT}</p>`,
    ].join(""),
  };
}

/** Legt einen Entwurf AUS DER SEITE HERAUS an — über `fetch`, also durch die Weiche der Bühne. */
const ENTWURF_ANLEGEN = `async (entwurf) => {
  const r = await fetch('/api/drafts', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(entwurf),
  });
  const j = await r.json();
  return r.ok && j && j.id ? String(j.id) : 'FEHLER ' + r.status + ' ' + JSON.stringify(j);
}`;

const SOLL_PIXEL = sollpixel(ZWILLINGSDECK);
const SOLL = sollbilanz(ZWILLINGSDECK);

let b: Buehne;
let seite: SeiteMitDialog;
let weiche: Entwurfsweiche;

beforeAll(async () => {
  b = await buehneAufbauen("/erfassen");
  seite = b.seite as SeiteMitDialog;
  if (b.fehler !== null) {
    return;
  }
  weiche = await entwurfsWeicheLegen(seite);
}, FALL_RAHMEN_MS);

afterAll(async () => {
  await b?.schliessen();
});

async function bilderLesen(sel: string): Promise<Bildablesung[] | null> {
  return seite.evaluate<Bildablesung[] | null>(fn(BILDER_IM_INHALT), sel);
}

async function aufBilderWarten(sel: string): Promise<void> {
  await seite.waitForFunction(fn(BILDER_ENTSCHIEDEN), sel, {
    timeout: wartebudget("aufFlaechensatzWarten"),
  });
}

/** Der Nachweis an einer Station: Bilder im Container gegen Originalpixel, Quittung gegen beides. */
async function stationBefunde(sel: string): Promise<string[]> {
  await aufBilderWarten(sel);
  const beleg = (await quellenanzeige(seite)) ?? "";
  const quittung = beleg.includes(BILANZ_PRAEFIX.de) ? bilanzAussage(beleg, "de") : null;
  return domBefunde(await bilderLesen(sel), SOLL_PIXEL, quittung, SOLL.fehlend);
}

describe("Bildnachweis im Browser — gespeichert, neu geladen, angenommen, erneut geöffnet", () => {
  it(
    "F1 · Altbeleg: über die API gespeichert, geöffnet, neu geladen — Fläche und Server unverändert",
    async () => {
      expect(b.fehler, "Bühne nicht aufgebaut").toBeNull();
      await spracheSetzen(seite, "de");
      await neuLaden(seite);

      const entwurf = historischerEntwurf();
      const id = await seite.evaluate<string>(fn(ENTWURF_ANLEGEN), entwurf);
      expect(id, "Entwurf nicht angelegt").not.toMatch(/^FEHLER/u);
      const adresse = `${CAPTURE_FRONT_DOOR_ROUTE}?draft=${encodeURIComponent(id)}`;

      for (const station of ["geöffnet", "neu geladen"] as const) {
        await neuLaden(seite, adresse);
        await aufFlaechensatzWarten(seite, ALTER_INHALT);
        // EINE Ablesung, und die positive Zusicherung trägt die negativen: steht der alte Wortlaut
        // in DIESEM Text, ist die Ablesung nicht blind. Kalibriert wird hier NICHT durch Ausblenden
        // — das Blatt ist ein Editor, der einen geleerten Textknoten als Eingabe übernähme.
        const beleg = (await quellenanzeige(seite)) ?? "";
        expect(beleg, `Altbeleg ${station}: alter Wortlaut`).toContain(ALTER_WORTLAUT);
        expect(beleg, `Altbeleg ${station}: Herkunft`).toContain("altes-deck.pptx");
        expect(beleg, `Altbeleg ${station}: nachgetragene Bilanz`).not.toContain(BILANZ_PRAEFIX.de);
        expect(beleg, `Altbeleg ${station}: neuer Vorbehalt`).not.toContain(VORBEHALT.de);
      }

      // Die Serverwahrheit NACH Öffnen und Neuladen: derselbe Rumpf, Zeichen für Zeichen.
      const gespeichert = await b.frage<{ payload: { bodyHtml?: string } }>(
        "GET",
        `/api/drafts/${id}`,
      );
      expect(
        gespeichert.payload.bodyHtml,
        "Öffnen oder Neuladen hat den Altbeleg umgeschrieben",
      ).toBe(entwurf.bodyHtml);
      expect(b.seitenfehler, `Seitenfehler: ${JSON.stringify(b.seitenfehler)}`).toEqual([]);
    },
    FALL_RAHMEN_MS,
  );

  it(
    "F2 · Zwillinge und ausgeblendete Bilder: Bild für Bild sichtbar, dekodiert und originalgetreu — mit DOM-Gegenprobe",
    async () => {
      expect(b.fehler, "Bühne nicht aufgebaut").toBeNull();
      await spracheSetzen(seite, "de");
      await neuLaden(seite);

      await dateiwegOeffnen(seite);
      await ganzdokumentWaehlen(seite);
      await dateiUeberSichtbareAuswahl(seite, {
        name: ZWILLING_DATEINAME,
        mimeType: PPTX_MIME,
        buffer: Buffer.from(zwillingsdeck()) as Buffer,
      });
      await aufEingelesenWarten(seite, ZWILLING_DATEINAME);

      const versuch = speicherversuchBeginnen(weiche);
      expect(await speichernDruecken(seite), "Speichern-Knopf nicht betätigbar").toBe(true);
      await aufErfolgskastenWarten(seite, versuch);
      await weiche.warteAufAbschluss(versuch.marke);
      const kennung = await kennungAusOeffnenLink(seite);
      expect(kennung, "kein Öffnen-Link mit Entwurfskennung").not.toBe(null);

      // ---- Entwurf geöffnet, dann neu geladen ------------------------------------------------
      await seite.click(OEFFNEN_LINK_SELEKTOR, { timeout: wartebudget("zeigerklick") });
      await aufFlaechensatzWarten(seite, ZWILLING_MARKE.punkt);
      expect(await stationBefunde(ENTWURF_INHALT), "Entwurf geöffnet").toEqual([]);

      await neuLaden(
        seite,
        `${CAPTURE_FRONT_DOOR_ROUTE}?draft=${encodeURIComponent(kennung ?? "")}`,
      );
      await aufFlaechensatzWarten(seite, ZWILLING_MARKE.punkt);
      expect(await stationBefunde(ENTWURF_INHALT), "Entwurf neu geladen").toEqual([]);

      const gespeichert = await b.frage<{ payload: { bodyHtml?: string } }>(
        "GET",
        `/api/drafts/${kennung ?? ""}`,
      );
      expect(
        rumpfBefunde(gespeichert.payload.bodyHtml ?? "", "de", ZWILLINGSDECK),
        "gespeicherter Entwurf gegen Originalbytes",
      ).toEqual([]);

      // ---- Eingereicht, angenommen, am Eintrag — und der Eintrag erneut geöffnet ---------------
      const koId = await einreichenUndKennung(seite);
      expect(koId.length, "kein Wissenseintrag entstanden").toBeGreaterThan(0);
      // Zweimal über die Adresse geladen: `/wissen/:id` hat kein Blatt, auf das `neuLaden` warten
      // könnte; der zweite `goto` ist ein vollständiger Neuaufbau der Seite aus dem Server.
      for (const station of ["Wissenseintrag", "Wissenseintrag erneut geöffnet"]) {
        await seite.goto(`${ORIGIN}/wissen/${koId}`, {
          waitUntil: "load",
          timeout: wartebudget("neuLadenAdresse"),
        });
        await aufFlaechensatzWarten(seite, ZWILLING_MARKE.punkt);
        expect(await stationBefunde(EINTRAG_INHALT), station).toEqual([]);
      }

      const eintrag = await b.frage<{ bodyHtml?: string }>("GET", `/api/kos/${koId}`);
      expect(
        rumpfBefunde(eintrag.bodyHtml ?? "", "de", ZWILLINGSDECK),
        "angenommener Eintrag gegen Originalbytes",
      ).toEqual([]);

      // ---- DIE DOM-GEGENPROBE AM EINTRAG ---------------------------------------------------------
      const beleg = (await quellenanzeige(seite)) ?? "";
      const quittung = bilanzAussage(beleg, "de");
      const pruefen = (a: readonly Bildablesung[] | null) =>
        domBefunde(a, SOLL_PIXEL, quittung, SOLL.fehlend);
      // Verstellt wird das LETZTE Bild (grün, ausgeblendete Folie); vertauscht wird es mit dem
      // ersten (rot) — Zahl und Dekodierung stimmen dann weiter, nur der Inhalt nicht.
      const verstellen = (art: Verstellart) =>
        seite.evaluate<boolean>(fn(BILD_VERSTELLEN), {
          sel: EINTRAG_INHALT,
          art,
          index: SOLL_PIXEL.length - 1,
          von: 0,
        });
      const zurueck = () => seite.evaluate<boolean>(fn(BILD_ZURUECK));

      const protokoll = await domGegenprobe({
        lesen: () => bilderLesen(EINTRAG_INHALT),
        pruefen,
        verstellen,
        zurueck,
      });
      expect(Object.keys(protokoll), "nicht jede Verstellung gefahren").toEqual([...VERSTELLARTEN]);

      // Ein EINGEFRORENER Ableser — er liefert die Ablesung von vorhin — muss die Gegenprobe
      // werfen lassen. Das ist der Nachweis, dass sie einen eingefrorenen Wert nicht durchlässt.
      const eingefroren = await bilderLesen(EINTRAG_INHALT);
      await expect(
        domGegenprobe({ lesen: async () => eingefroren, pruefen, verstellen, zurueck }),
        "die Gegenprobe hat einen eingefrorenen Ableser durchgelassen",
      ).rejects.toThrow(/eingefroren/u);
      expect(await stationBefunde(EINTRAG_INHALT), "Seite nach der Gegenprobe").toEqual([]);

      // Die ZAHL der Quittung: der Bilanzsatz wird auf der Seite ausgeblendet, und die Ablesung
      // muss es merken — sonst prüfte der Vergleich oben eine alte Zeichenkette.
      const satz = bilanzsatz(beleg, "de");
      expect(satz, `kein Bilanzsatz im Beleg «${beleg}»`).not.toBe(null);
      await ablesungKalibrieren(seite, satz ?? "", async () => (await quellenanzeige(seite)) ?? "");

      expect(b.seitenfehler, `Seitenfehler: ${JSON.stringify(b.seitenfehler)}`).toEqual([]);
    },
    FALL_RAHMEN_MS,
  );
});
