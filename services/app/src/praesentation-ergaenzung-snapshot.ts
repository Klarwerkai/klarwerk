// PP06: Beleg für Ns bestehendes Downloadtor. Er entsteht nur aus erneut gelesenen Daten.
import { type Datenpunkt, fingerabdruck } from "./praesentation-daten";
import type {
  ErgaenzungsKandidat,
  ErgaenzungsSuche,
  ErgaenzungsVorschau,
} from "./praesentation-ergaenzung";

export function ergaenzungsDatenbeleg(
  koId: string,
  suche: ErgaenzungsSuche,
  v: ErgaenzungsVorschau,
  k: ErgaenzungsKandidat,
  dp: Datenpunkt,
): { pfad: string; text: string } {
  return {
    pfad: `ppt/klara/pp06-${k.token}.json`,
    text: JSON.stringify({
      vertrag: "klara-pp06-v1",
      plan: {
        vertrag: "klara-pp06-v1",
        basis: { koId, anhangId: suche.ort.anhangId, dateiFassung: v.dateiFassung },
        fakten: [
          { id: dp.id, fassung: dp.fassung, wert: dp.wert, fingerabdruck: fingerabdruck(dp) },
        ],
      },
      bindungen: [
        {
          datenpunktId: dp.id,
          datenFassung: dp.fassung,
          sldId: suche.ort.sldId,
          shapeId: suche.ort.shapeId,
          bindungId: `pp06:${k.token}`,
        },
      ],
    }),
  };
}
