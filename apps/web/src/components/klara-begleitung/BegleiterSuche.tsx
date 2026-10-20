import { useEffect } from "react";
import { useSession } from "../../app/AuthContext";
import { anNative, hoereAufNative } from "../../lib/begleiterBruecke";
import { CommandPalette } from "../../shell/CommandPalette";
import { KlaraKuerzelAusfuehrung } from "../klara-setup/KlaraKuerzelAusfuehrung";

/** Dieselbe Palette und Suche, im selben Begleiterfenster. Kein Dokument-/Bildschirmzugriff. */
export function BegleiterSuche(): JSX.Element | null {
  const { user } = useSession();
  useEffect(
    () =>
      hoereAufNative((befehl) => {
        if (befehl === "suche-oeffnen") {
          window.dispatchEvent(new CustomEvent("open-command-palette"));
        }
      }),
    [],
  );
  if (!user) return null;
  return (
    <>
      <KlaraKuerzelAusfuehrung nurAktion="suchen" />
      <CommandPalette
        beiOeffnen={() =>
          window.dispatchEvent(
            new CustomEvent("klara-begleiter", {
              detail: { befehl: "gespraech-oeffnen" },
            }),
          )
        }
        beiZiel={(pfad) => {
          // Ausschließlich ein Ziel aus der vorhandenen rollengefilterten Palette. Der Host
          // öffnet es außerhalb der Webfläche; Gespräch, Entwurf und laufende Stopps bleiben.
          if (!anNative({ art: "suchziel", pfad })) window.location.assign(pfad);
        }}
      />
    </>
  );
}
