// Profilzoneneingaben verwenden denselben reinen Löser wie Erinnerungen und Scheduler.
import {
  istDatum,
  istUhrzeit,
  loeseLokal,
  lokalVon,
} from "../../../../services/app/src/klara-erinnerung-zeit";

export function profilzeitProblem(wert: string, zone: string): "luecke" | "doppelt" | null {
  const [datum, uhrzeit] = wert.split("T");
  if (!istDatum(datum) || !istUhrzeit(uhrzeit)) return null;
  const lage = loeseLokal({ datum, uhrzeit }, zone);
  return lage.art === "eindeutig" ? null : lage.art;
}
export function profilzeitZuIso(wert: string, zone: string): string | null {
  const [datum, uhrzeit] = wert.split("T");
  if (!istDatum(datum) || !istUhrzeit(uhrzeit)) return null;
  const lage = loeseLokal({ datum, uhrzeit }, zone);
  return lage.art === "eindeutig" ? new Date(lage.ms).toISOString() : null;
}
export function isoZuProfilzeit(iso: string, zone: string): string {
  const l = lokalVon(Date.parse(iso), zone);
  return `${l.datum}T${l.uhrzeit}`;
}
