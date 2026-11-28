import { afterAll, it as vitestFall } from "vitest";

/** Der reguläre PG-Pflichtlauf muss den vorgesehenen Befund der Gegenprobe sehen.
 * Eine ausdrücklich als rot angeforderte Diagnose behält ihren ursprünglichen Exit. */
export async function belegeKalibrierung(
  titel: string,
  erwartet: RegExp,
  messen: () => Promise<unknown>,
): Promise<void> {
  try {
    await messen();
  } catch (fehler) {
    if (fehler instanceof Error && erwartet.test(fehler.message)) {
      process.stdout.write(
        `[KLARWERK] Kalibrierung bestätigt: ${titel} — ${fehler.message.split("\n")[0]}\n`,
      );
      return;
    }
    throw fehler;
  }
  throw new Error(`Kalibrierung ohne erwarteten Befund: ${titel}`);
}

export function pgKalibrierung(
  roterDiagnoselauf: boolean,
  befunde: Readonly<Record<string, RegExp>>,
) {
  const pflicht = process.env.KLARWERK_PG_PFLICHT === "1";
  const sammlung = new Set<string>();
  afterAll(() => {
    if (pflicht) {
      const fehlende = Object.keys(befunde).filter((name) => !sammlung.has(name));
      if (fehlende.length > 0) {
        throw new Error(`Kalibrierungsfälle fehlen in der Sammlung: ${fehlende.join(", ")}`);
      }
    }
  });
  return {
    aktiv: pflicht || roterDiagnoselauf,
    it(titel: string, messen: (ctx: { skip: () => void }) => void | Promise<void>, frist?: number) {
      const kennung = /^((?:KAL-[ivx]+|[KL]\d+))\s/u.exec(titel)?.[1];
      if (kennung) {
        if (sammlung.has(kennung)) throw new Error(`Doppelte Kalibrierung: ${kennung}`);
        sammlung.add(kennung);
      }
      if (!pflicht || roterDiagnoselauf || !kennung) {
        return vitestFall(titel, messen, frist);
      }
      const erwartet = befunde[kennung];
      if (!erwartet) {
        throw new Error(`Kein erwarteter Kalibrierungsbefund für ${titel}`);
      }
      return vitestFall(
        titel,
        async (ctx) => belegeKalibrierung(titel, erwartet, async () => messen(ctx)),
        frist,
      );
    },
  };
}
