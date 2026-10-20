import { useState } from "react";
import { useTranslation } from "react-i18next";
import { type AuftragsUmgebung, type GeplanterSchritt, waehleErinnerungszeit } from "./auftrag";

/** Nur die noch benötigte Zeit klären; der bereits genannte Aufgabentitel bleibt unverändert. */
export function KlaraErinnerungszeitRueckfrage({
  lokalId,
  schritt,
  umgebung,
}: { lokalId: string; schritt: GeplanterSchritt; umgebung: () => AuftragsUmgebung }): JSX.Element {
  const { t } = useTranslation();
  const [zeit, setZeit] = useState(
    schritt.erkannt.erinnerung ?? { datum: "", uhrzeit: "", zeitzone: "" },
  );
  const [speichert, setSpeichert] = useState(false);
  return (
    <form
      data-testid="klara-auftrag-erinnerungszeit"
      className="mt-1.5 space-y-1 rounded-btn border border-hairline px-2 py-1.5"
      onSubmit={async (e) => {
        e.preventDefault();
        if (speichert) return;
        setSpeichert(true);
        try {
          await waehleErinnerungszeit(lokalId, schritt.nr, zeit, umgebung());
        } finally {
          setSpeichert(false);
        }
      }}
    >
      <p className="text-[11.5px] text-text">
        {t("klaraauftrag.erinnerungszeit.frage", { titel: schritt.erkannt.name })}
      </p>
      {(["datum", "uhrzeit", "zeitzone"] as const).map((f) => (
        <label key={f} className="block text-[11.5px] text-text">
          {t(`klaraauftrag.erinnerungszeit.${f}`)}
          <input
            required
            data-testid={`klara-auftrag-zeit-${f}`}
            type={f === "datum" ? "date" : f === "uhrzeit" ? "time" : "text"}
            value={zeit[f]}
            onChange={(e) => setZeit((z) => ({ ...z, [f]: e.target.value }))}
            className="block w-full rounded-btn border border-hairline bg-surface px-2 py-1"
          />
        </label>
      ))}
      <button
        type="submit"
        disabled={speichert}
        data-testid="klara-auftrag-zeit-uebernehmen"
        className="rounded-btn border border-hairline px-2 py-1 text-[11.5px]"
      >
        {t("klaraauftrag.erinnerungszeit.uebernehmen")}
      </button>
    </form>
  );
}
