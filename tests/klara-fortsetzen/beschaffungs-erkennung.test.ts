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

it.each([
  "Besorge neue Angebote für die Verpackung von Produkt PX-17 für 500 Stück bis 2035-11-30",
  "Prepare new offers for the packaging of product PX-17 for 500 pieces by 2035-11-30",
  "Vraag nieuwe offertes voor de verpakking van product PX-17 voor 500 stuks voor 2035-11-30",
])("BES-E4 · bekanntes unzitiertes Produkt braucht keine erneute Rückfrage: %s", (text) => {
  const b = erkenneAuftrag(text)?.beschaffung;
  expect(b?.produkt).toBe("PX-17");
  expect(b?.bedarf).toMatch(/^(Verpackung|packaging|verpakking)$/i);
  expect(b && fehlendeBeschaffungsangaben(b)).toEqual([]);
});

it.each([
  ["für 500 Stück oder 750 Stück bis 2035-11-30", ["menge"]],
  ["für 500 Stück; Menge: 750 Stück bis 2035-11-30", ["menge"]],
  ["für 500 Stück bis 2035-11-30 oder 2035-12-02", ["termin"]],
  ["für 500 Stück bis 2035-11-30; Termin: 2035-12-02", ["termin"]],
  ["für 500 Stück oder 750 Stück bis 2035-11-30 oder 2035-12-02", ["menge", "termin"]],
])("BES-E5 · widersprüchliche Angaben werden gezielt rückgefragt: %s", (angaben, fehlt) => {
  const b = erkenneAuftrag(
    `Besorge neue Angebote für die Verpackung von Produkt PX-17 ${angaben}`,
  )?.beschaffung;
  expect(b?.produkt).toBe("PX-17");
  expect(b?.bedarf).toBe("Verpackung");
  expect(b && fehlendeBeschaffungsangaben(b)).toEqual(fehlt);
  if (!fehlt.includes("menge")) expect(b?.menge).toBe("500 Stück");
  if (!fehlt.includes("termin")) expect(b?.termin).toBe("2035-11-30");
});

it("BES-E6 · gleiche Angaben sind eindeutig, Zahlen in zitierten Namen bleiben Daten", () => {
  const e = erkenneAuftrag(
    "Besorge neue Angebote für die Verpackung von Produkt PX-17 für 500 Stück; Menge: 500,0 stück bis 2035-11-30; Termin: 2035-11-30; Quelle „750 Stück bis 2035-12-02“; Empfängervorschlag „900 Stück bis 2035-12-03“",
  );
  expect(e?.beschaffung && fehlendeBeschaffungsangaben(e.beschaffung)).toEqual([]);
  expect(e?.beschaffungsQuelle).toBe("750 Stück bis 2035-12-02");
  expect(e?.beschaffung?.empfaengerVorschlaege).toEqual(["900 Stück bis 2035-12-03"]);
  expect(e?.beschaffung?.erlaubteEmpfaenger).toEqual([]);
  expect(e?.schritte).toHaveLength(2);
});

it.each([
  ["für 500 Stück,750 Stück bis 2035-11-30", ["menge"]],
  ["für 500 Stück bis 2035-11-30,2035-12-02", ["termin"]],
])("BES-E7 · Aufzählung ohne Leerzeichen wählt keine erste Alternative: %s", (angaben, fehlt) => {
  const b = erkenneAuftrag(
    `Besorge neue Angebote für die Verpackung von Produkt PX-17 ${angaben}`,
  )?.beschaffung;
  expect(b && fehlendeBeschaffungsangaben(b)).toEqual(fehlt);
});

it("BES-E8 · konkreter BES-1-Satz mit zwei expliziten Produkten lässt ausschließlich die Produktwahl offen", () => {
  const b = erkenneAuftrag(
    "Besorge neue Angebote für die Verpackung von Produkt „PX-17“ oder Produkt „PX-18“ für 500 Stück bis 2035-11-30",
  )?.beschaffung;
  expect(b).toMatchObject({
    produkt: "",
    bedarf: "Verpackung",
    menge: "500 Stück",
    termin: "2035-11-30",
  });
  expect(b && fehlendeBeschaffungsangaben(b)).toEqual(["produkt"]);
});

it.each(["Produkt PX-17 oder Produkt PX-18", "Produkt „PX-17“ oder Produkt PX-18"])(
  "BES-E9 · unzitierte und gemischte explizite Produktalternativen werden ebenfalls geklärt: %s",
  (produkte) => {
    const b = erkenneAuftrag(
      `Besorge neue Angebote für die Verpackung von ${produkte} für 500 Stück bis 2035-11-30`,
    )?.beschaffung;
    expect(b?.produkt).toBe("");
    expect(b && fehlendeBeschaffungsangaben(b)).toEqual(["produkt"]);
  },
);

it.each([
  "Besorge neue Angebote für die Verpackung von Produkt „PX-17“ oder Produkt PX-17 für 500 Stück bis 2035-11-30",
  'Prepare new offers for the packaging of product "PX-17" or product PX-17 for 500 pieces by 2035-11-30',
  'Vraag nieuwe offertes voor de verpakking van product "PX-17" of product PX-17 voor 500 stuks voor 2035-11-30',
  "Besorge neue Angebote für die Verpackung von Produkt PX-17 für 500 Stück bis 2035-11-30",
  'Prepare new offers for the packaging of product "PX-17" for 500 pieces by 2035-11-30',
  "Vraag nieuwe offertes voor de verpakking van product PX-17 voor 500 stuks voor 2035-11-30",
])(
  "BES-E10 · gleiche Wiederholung oder eindeutiges Produkt DE/EN/NL bleibt bekannt: %s",
  (text) => {
    const b = erkenneAuftrag(text)?.beschaffung;
    expect(b?.produkt).toBe("PX-17");
    expect(b && fehlendeBeschaffungsangaben(b)).toEqual([]);
  },
);

it("BES-E11 · Produkttext innerhalb eines zitierten Quellnamens ist keine zweite Produktwahl", () => {
  const e = erkenneAuftrag(
    "Besorge neue Angebote für die Verpackung von Produkt PX-17 für 500 Stück bis 2035-11-30; Quelle „Produkt PX-18“",
  );
  expect(e?.beschaffung?.produkt).toBe("PX-17");
  expect(e?.beschaffung && fehlendeBeschaffungsangaben(e.beschaffung)).toEqual([]);
  expect(e?.beschaffungsQuelle).toBe("Produkt PX-18");
});
