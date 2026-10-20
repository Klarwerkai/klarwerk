import { expect, it } from "vitest";
import { erkenneAuftrag } from "../../apps/web/src/lib/klaraAuftragErkennung";
import { fehlendeBeschaffungsangaben } from "../../apps/web/src/lib/klaraBeschaffungsauftrag";
it.each([
  "Besorge neue Angebote für die Verpackung von Produkt „PX-17“ für 500 Stück bis 2035-11-30",
  'Prepare new offers for the packaging of product "PX-17" for 500 pieces by 2035-11-30',
  'Vraag nieuwe offertes voor de verpakking van product "PX-17" voor 500 stuks voor 2035-11-30',
])("BES-E1 · erkennt bekannte Produkt-, Bedarfs-, Mengen- und Termindaten getrennt: %s", (text) => {
  const e = erkenneAuftrag(text);
  expect(e?.beschaffung?.produkt).toBe("PX-17");
  expect(e?.beschaffung?.bedarf).toMatch(/^(Verpackung|packaging|verpakking)$/i);
  expect(e?.beschaffung?.bedarf).not.toMatch(/500|2035/);
  expect(e?.beschaffung && fehlendeBeschaffungsangaben(e.beschaffung)).toEqual([]);
  expect(e?.schritte.map((s) => s.aktion)).toEqual(["entwurf_erstellen", "entwurf_erstellen"]);
});
it("BES-E2 · fragt gezielt nur fehlende Menge/Einheit und Termin; kein Produkt/Bedarf wird ersetzt", () => {
  const b = erkenneAuftrag(
    "Besorge neue Angebote für die Verpackung von Produkt „PX-17“",
  )?.beschaffung;
  expect(b?.produkt).toBe("PX-17");
  expect(b?.bedarf).toBe("Verpackung");
  expect(b && fehlendeBeschaffungsangaben(b)).toEqual(["menge", "termin"]);
  expect(b && fehlendeBeschaffungsangaben({ ...b, menge: "500", termin: "2035-02-30" })).toEqual([
    "menge",
    "termin",
  ]);
});
it("BES-E3 · Quellen-/Empfängernamen bleiben Daten; Anfrage/Bestellung wird kein weiterer Schritt", () => {
  const e = erkenneAuftrag(
    "Besorge neue Angebote für die Verpackung von Produkt „PX-17“ für 500 Stück bis 2035-11-30; Quelle „Verpackungsstand“; Empfängervorschlag „Fiktiv X“; bestelle sofort",
  );
  expect(e?.beschaffungsQuelle).toBe("Verpackungsstand");
  expect(e?.beschaffung?.empfaengerVorschlaege).toEqual(["Fiktiv X"]);
  expect(e?.beschaffung?.erlaubteEmpfaenger).toEqual([]);
  expect(e?.schritte).toHaveLength(2);
  expect(erkenneAuftrag("Versende eine Anfrage an alle Lieferanten")).toBeNull();
});
