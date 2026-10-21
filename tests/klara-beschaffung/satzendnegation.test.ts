import { expect, it } from "vitest";
import { erkenneAuftrag } from "../../apps/web/src/lib/klaraAuftragErkennung";
import { erkenneBeschaffung } from "../../apps/web/src/lib/klaraBeschaffungsauftrag";

const AUFTRAG =
  "Besorge neue Angebote für die Verpackung von Produkt PX-17 für 500 Stück bis 2035-11-30";
const ERWARTET = {
  beschaffung: {
    produkt: "PX-17",
    bedarf: "Verpackung",
    menge: "500 Stück",
    termin: "2035-11-30",
    empfaengerVorschlaege: [],
    erlaubteEmpfaenger: [],
    quellen: [],
    aussenwirkung: "keine",
  },
  schritte: [
    { aktion: "entwurf_erstellen", suche: "neu", name: "Anforderung" },
    { aktion: "entwurf_erstellen", suche: "neu", name: "Anfrage" },
  ],
};

it("BES02-N1: abschließendes nicht, noch nicht und nicht mehr ergeben keinen Auftrag", () => {
  for (const ende of ["nicht", "noch nicht", "nicht mehr", "NICHT", "NOCH NICHT", "NICHT MEHR"]) {
    for (const zeichen of ["", ".", "!", " …  "]) {
      for (const daten of ["", " Quelle „nicht“ Empfängervorschlag „nicht mehr“"]) {
        const text = `${AUFTRAG}${daten} ${ende}${zeichen}`;
        expect(erkenneBeschaffung(text), text).toBeNull();
        expect(erkenneAuftrag(text), text).toBeNull();
      }
    }
  }
});

it("BES02-N2: positive Aufträge und zitierte Nicht-Daten behalten ihren ganzen Plan", () => {
  expect(erkenneBeschaffung(AUFTRAG)).toEqual(ERWARTET);
  expect(erkenneAuftrag(AUFTRAG)).toEqual(ERWARTET);
  const sachlich = AUFTRAG.replace("Verpackung", "nicht brennbare Verpackung");
  const sachlichErwartet = {
    ...ERWARTET,
    beschaffung: { ...ERWARTET.beschaffung, bedarf: "nicht brennbare Verpackung" },
  };
  expect(erkenneBeschaffung(sachlich)).toEqual(sachlichErwartet);
  expect(erkenneAuftrag(sachlich)).toEqual(sachlichErwartet);
  for (const paar of ["„“", '""', "«»"]) {
    const [auf, zu] = paar;
    for (const daten of ["nicht", "noch nicht", "nicht mehr"]) {
      const zitat = `${auf}${daten}${zu}`;
      const text = [
        `Besorge neue Angebote für die Verpackung von Produkt ${zitat}`,
        "für 500 Stück bis 2035-11-30",
        `Quelle ${zitat} Empfängervorschlag ${zitat}`,
      ].join(" ");
      const erwartet = {
        ...ERWARTET,
        beschaffung: {
          ...ERWARTET.beschaffung,
          produkt: daten,
          empfaengerVorschlaege: [daten],
        },
        beschaffungsQuelle: daten,
      };
      expect(erkenneBeschaffung(text), text).toEqual(erwartet);
      expect(erkenneAuftrag(text), text).toEqual(erwartet);
    }
  }
});
