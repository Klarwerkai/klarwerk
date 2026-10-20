// Reine Fristparameter; ohne Schedulerimport auch im bestehenden VVT-Aufbau verwendbar.
export const PROTOKOLL_FRIST_TAGE = 14;
export const PROTOKOLL_FRIST_ENV = "KLARWERK_DIAGNOSE_FRIST_TAGE";
/** Positive ganze Tage; die Obergrenze ist nur die sichere Millisekundenarithmetik. */
export function leseProtokollFristTage(roh: string | undefined): number {
  if (roh === undefined || roh.trim() === "") return PROTOKOLL_FRIST_TAGE;
  if (!/^[1-9][0-9]*$/.test(roh))
    throw new Error("Ungültige Diagnosefrist: positive ganze Tage erforderlich.");
  const n = Number(roh);
  if (!Number.isSafeInteger(n) || n > Math.floor(Number.MAX_SAFE_INTEGER / 86_400_000))
    throw new Error("Diagnosefrist außerhalb sicherer Zeitrechnung.");
  return n;
}
