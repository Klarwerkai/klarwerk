// Fachlicher Beschaffungsvertrag im gemeinsamen Lernkern. Derselbe D-Takt und dieselbe
// D-Vorkommensrechnung; keine alten Produktwerte, Empfänger oder Ausführungsrechte übernehmen.
import type { ZeitplanLaufErgebnis } from "./assistenz-lernen-zeitsteuerung";
import { vorkommenVon } from "./klara-erinnerung";
import { SOMMERZEIT_VORGABE } from "./klara-erinnerung-zeit";
import {
  type FunktionenDienst,
  type LaufKontext,
  beschaffungsZeitplan,
} from "./persoenliche-funktionen";
import type { Routine } from "./vormachen";

export async function beschaffungsTermin(
  r: Routine,
  jetzt: number,
  dienst: FunktionenDienst,
  kontext: () => Promise<LaufKontext | null>,
): Promise<ZeitplanLaufErgebnis | null> {
  const f = r.beschaffung;
  const z = f?.zeitauftrag;
  if (!f || !z || f.stand !== "aktiv") return null;
  const faellig = vorkommenVon(
    {
      id: f.id,
      zeitplan: beschaffungsZeitplan(z),
      zeitzone: z.zeitzone,
      sommerzeit: SOMMERZEIT_VORGABE,
      ausnahmen: {},
    },
    { stoppNach: jetzt, kuenftig: 1 },
  )
    .filter(
      (v): v is typeof v & { ms: number } =>
        v.ms !== null && v.ms <= jetzt && (!z.fortgesetztAm || v.ms >= Date.parse(z.fortgesetztAm)),
    )
    .at(-1);
  if (!faellig || (z.nachholen === "nie" && jetzt - faellig.ms > 120_000)) return null;
  const termin = `${z.eingerichtetAm}:${faellig.schluessel}`;
  if (f.laeufe.some((l) => l.termin === termin)) return null;
  const aktuell = await kontext();
  if (!aktuell) return null;
  const ergebnis = await dienst.zeitLauf(f.kontoId, f.id, aktuell, termin);
  return {
    kontoId: f.kontoId,
    routineId: f.id,
    termin,
    stand: "offen",
    grund: ergebnis.lauf.stand,
    text:
      ergebnis.lauf.klaerung.map((k) => k.hinweis).join(" ") ||
      "Beschaffungsadapter fehlen; nach außen ist nichts geschehen.",
  };
}
