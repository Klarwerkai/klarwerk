import { istZeitzone } from "./klara-erinnerung-zeit";

export interface KlaraEinfuehrungStand {
  schritt: number;
  begleitung: "kurz" | "ausfuehrlich";
  zeitzone: string;
  abgeschlossen: boolean;
}
export function pruefeEinfuehrung(wert: unknown): KlaraEinfuehrungStand {
  if (!wert || typeof wert !== "object" || Array.isArray(wert))
    throw new Error("Einführung muss ein Einrichtungsstand sein.");
  const w = wert as Record<string, unknown>;
  if (
    typeof w.schritt !== "number" ||
    !Number.isSafeInteger(w.schritt) ||
    w.schritt < 0 ||
    w.schritt > 3 ||
    (w.begleitung !== "kurz" && w.begleitung !== "ausfuehrlich") ||
    typeof w.zeitzone !== "string" ||
    !istZeitzone(w.zeitzone) ||
    typeof w.abgeschlossen !== "boolean" ||
    (w.abgeschlossen && w.schritt !== 3)
  )
    throw new Error("Ungültiger Einrichtungsstand oder unbekannte IANA-Zeitzone.");
  return {
    schritt: w.schritt,
    begleitung: w.begleitung,
    zeitzone: w.zeitzone,
    abgeschlossen: w.abgeschlossen,
  };
}
