import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { leseDeckVertraege } from "../../services/app/src/office-daten-aenderungen";
import { leseFolienDaten } from "../../services/app/src/praesentation-daten";
import { decodeDataUrl } from "../../services/object-store";
import { PPTX, welt } from "./pp05-welt";

function pflicht<T>(wert: T | null | undefined): T {
  if (wert === undefined || wert === null) throw new Error("Fiktiver PP07-Dateiteil fehlt.");
  return wert;
}

describe("PP07 P-1 · tatsächliche Dezimalzelle der nativen Diagrammarbeitsmappe", () => {
  it.each([
    { workbookWert: "1.2", manuellAbweichend: false },
    { workbookWert: "1E2", manuellAbweichend: true },
  ])(
    "Workbook-B2=$workbookWert: Konflikt=$manuellAbweichend und bewusste Übernahme",
    async ({ workbookWert, manuellAbweichend }) => {
      const w = await welt();
      try {
        const punkte = [];
        for (const [wert, bezugsgroesse] of [
          ["1,2 T€", "Dezimalwert"],
          ["2,4 T€", "Vergleichswert"],
        ])
          punkte.push(
            await w.capture({
              art: "zahl",
              wert,
              bezugsgroesse,
              einheit: "T€",
              waehrung: "EUR",
              zeitraum: "Q4 2025",
              erfassung: "manuell",
              beleg: "Kontrollierter fiktiver Dezimalbeleg für P-1.",
            }),
          );
        const dezimal = pflicht(punkte[0]);
        const auftrag = {
          ...w.auftrag,
          titel: "Dezimalvergleich (fiktiv)",
          datenpunkte: punkte.map((p) => ({ id: p.id, fassung: p.fassung })),
        };
        const plan = await w.app.inject({
          method: "POST",
          url: `${w.basis}/folienaufbau/vorschau`,
          payload: auftrag,
        });
        expect(plan.statusCode, plan.body).toBe(200);
        const aufgebaut = await w.app.inject({
          method: "POST",
          url: `${w.basis}/folienaufbau/uebernehmen`,
          payload: { ...auftrag, planId: plan.json().planId },
        });
        expect(aufgebaut.statusCode, aufgebaut.body).toBe(200);
        const datei = async () => {
          const ko = pflicht(await w.ko.get(w.article.id));
          const obj = pflicht(
            await w.objekte.read(
              pflicht(ko.attachments.find((a) => a.id === w.anhangId)?.objectId),
            ),
          );
          const bytes = pflicht(decodeDataUrl(obj.data)).bytes;
          return { ko, bytes, satz: await leseFolienDaten(bytes) };
        };
        const basis = await datei();
        const zip = await JSZip.loadAsync(basis.bytes);
        const deck = pflicht((await leseDeckVertraege(zip))[0]).deck;
        const chart = pflicht(deck.diagramme[0]);
        expect(chart.datenpunkte[0]).toBe(dezimal.id);
        expect(deck.plan.fakten.find((p) => p.id === dezimal.id)?.zahl).toBe(1.2);
        const chartVorher = await pflicht(zip.file(chart.teil)).async("string");
        expect(chartVorher).toContain("<c:v>1.2</c:v>");
        const wbPfade = Object.keys(zip.files).filter((p) => p.endsWith(".xlsx"));
        expect(wbPfade).toHaveLength(1);
        const wbPfad = pflicht(wbPfade[0]);
        const wbVorher = await pflicht(zip.file(wbPfad)).async("nodebuffer");
        const wb = await JSZip.loadAsync(wbVorher);
        const blattPfad = "xl/worksheets/sheet1.xml";
        const blattVorher = await pflicht(wb.file(blattPfad)).async("string");
        const alteZelle = '<c r="B2"><v>1.2</v></c>';
        const neueZelle = `<c r="B2"><v>${workbookWert}</v></c>`;
        expect(blattVorher.split(alteZelle)).toHaveLength(2);
        const blattManuell = blattVorher.replace(alteZelle, neueZelle);
        let manuelleMappe = wbVorher;
        if (manuellAbweichend) {
          expect(Number(workbookWert)).toBe(100);
          wb.file(blattPfad, blattManuell);
          manuelleMappe = await wb.generateAsync({ type: "nodebuffer" });
          // Genau eine zugeordnete B-Zelle ändern; jedes andere innere ZIP-Teil bleibt gleich.
          for (const name of Object.keys(wb.files).filter(
            (p) => !wb.files[p]?.dir && p !== blattPfad,
          ))
            expect(await pflicht(wb.file(name)).async("nodebuffer")).toEqual(
              await pflicht((await JSZip.loadAsync(wbVorher)).file(name)).async("nodebuffer"),
            );
          expect(blattManuell.replace(neueZelle, alteZelle)).toBe(blattVorher);
          zip.file(wbPfad, manuelleMappe);
          expect(await pflicht(zip.file(chart.teil)).async("string")).toBe(chartVorher);
          const bytes = await zip.generateAsync({ type: "nodebuffer" });
          const ref = await w.objekte.put({
            name: "P1-manuelle-Arbeitsmappe.pptx",
            mime: PPTX,
            data: `data:${PPTX};base64,${bytes.toString("base64")}`,
            purpose: "attachment",
            owner: w.nutzer.id,
            confidentiality: "intern",
          });
          await w.ko.uebernimmOfficeFassung(
            w.article.id,
            {
              anhangId: w.anhangId,
              objectId: ref.id,
              size: ref.size,
              expectedVersion: basis.ko.version,
            },
            w.nutzer.id,
          );
        }
        const vorher = await datei();
        const body = {
          expectedVersion: vorher.ko.version,
          dateiFassung: vorher.satz.fassung,
          aenderungen: [
            {
              datenpunktId: dezimal.id,
              fassung: dezimal.fassung,
              korrektur: {
                wert: "1,3 T€",
                grund: "Kontrollierte fiktive Dezimaländerung für P-1.",
              },
            },
          ],
        };
        const vorschau = await w.app.inject({
          method: "POST",
          url: `${w.basis}/datenaktualisierung/vorschau`,
          payload: body,
        });
        expect(vorschau.statusCode, vorschau.body).toBe(200);
        expect(vorschau.json().konflikte).toEqual([]);
        const konflikte = vorschau.json().dateikonflikte as {
          id: string;
          art: string;
          grund: string;
        }[];
        expect(konflikte).toHaveLength(manuellAbweichend ? 1 : 0);
        if (manuellAbweichend) {
          expect(konflikte[0]).toMatchObject({ art: "diagramm" });
          expect(pflicht(konflikte[0]).grund).toContain("Arbeitsmappe");
          const gesperrt = await w.app.inject({
            method: "POST",
            url: `${w.basis}/datenaktualisierung/uebernehmen`,
            payload: { ...body, vorschauId: vorschau.json().vorschauId, bestaetigteKonflikte: [] },
          });
          expect(gesperrt.statusCode, gesperrt.body).toBe(400);
          expect((await datei()).satz.fassung).toBe(vorher.satz.fassung);
        }
        const gespeichert = await w.app.inject({
          method: "POST",
          url: `${w.basis}/datenaktualisierung/uebernehmen`,
          payload: {
            ...body,
            vorschauId: vorschau.json().vorschauId,
            bestaetigteKonflikte: konflikte.map((k) => k.id),
          },
        });
        expect(gespeichert.statusCode, gespeichert.body).toBe(200);
        expect(gespeichert.json().zustand).toBe(
          manuellAbweichend ? "teilweise_uebernommen" : "uebernommen",
        );
        const neu = await datei();
        const neuerZip = await JSZip.loadAsync(neu.bytes);
        const neueMappe = await pflicht(neuerZip.file(wbPfad)).async("nodebuffer");
        expect((await w.datenpunkte.lesen(dezimal.id))?.wert).toBe("1,3 T€");
        if (manuellAbweichend) {
          expect(neueMappe.equals(manuelleMappe)).toBe(true);
          expect(await pflicht(neuerZip.file(chart.teil)).async("string")).toBe(chartVorher);
        } else {
          expect(
            await pflicht((await JSZip.loadAsync(neueMappe)).file(blattPfad)).async("string"),
          ).toContain('<c r="B2"><v>1.3</v></c>');
          expect(await pflicht(neuerZip.file(chart.teil)).async("string")).toContain(
            "<c:v>1.3</c:v>",
          );
        }
      } finally {
        await w.app.close();
      }
    },
  );
});
