// ================================================================================================
// produkt:20261011:assistenz-lernen-hostfortsetzung · EQF-06-K03/K10 — KORREKTUR IN EIGENEN WORTEN.
// ================================================================================================
//
// Ein Schritt, ein Satz: „Das gilt nur heute“, „Gehört immer dazu“, „Hier entscheide ich selbst“.
// Der Server deutet den Satz regelbasiert (`assistenz-lernen-korrektur.ts`) und ordnet ihm seine
// Quelle zu. Ist die Bedeutung offen, fragt er nach (422 `klaerung`) — dann stehen die Bedeutungen
// als Wahl da; geraten wird nicht. Verwendet vor der Bestätigung (Vorschau der Ableitung) und an
// einer bestätigten Routine (nächste Fassung).
import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  type KorrekturBedeutung,
  type KorrekturKlaerung,
  type KorrekturSatz,
  korrekturKlaerung,
} from "../../api/vormachen";
import { Button, Field, TextInput } from "../ui";

/** Dieselbe Auswahlform wie im Zeitplan (`RoutineZeitplan.tsx`). */
const AUSWAHL =
  "h-10 w-full rounded-input border border-hairline bg-surface px-3 text-sm text-text outline-none";

export function KorrekturSatzFeld({
  schritte,
  sende,
  testid,
}: {
  /** Die korrigierbaren Schritte mit ihrer Nummer und einer kurzen Benennung. */
  schritte: readonly { nr: number; text: string }[];
  /** Schickt die Korrektur; liefert eine Erfolgsmeldung oder wirft (auch mit Rückfrage). */
  sende: (k: KorrekturSatz) => Promise<string | null>;
  testid: string;
}): JSX.Element | null {
  const { t } = useTranslation();
  const [nr, setNr] = useState<number>(schritte[0]?.nr ?? 1);
  const [satz, setSatz] = useState("");
  const [laeuft, setLaeuft] = useState(false);
  const [klaerung, setKlaerung] = useState<KorrekturKlaerung | null>(null);
  const [meldung, setMeldung] = useState<string | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);

  const schicke = async (bedeutung?: KorrekturBedeutung): Promise<void> => {
    setLaeuft(true);
    setFehler(null);
    setMeldung(null);
    try {
      const k: KorrekturSatz = { nr, satz, ...(bedeutung ? { bedeutung } : {}) };
      setMeldung(await sende(k));
      setKlaerung(null);
      setSatz("");
    } catch (e) {
      const offen = korrekturKlaerung(e);
      if (offen) {
        setKlaerung(offen);
        setFehler(e instanceof Error ? e.message : null);
      } else {
        setKlaerung(null);
        setFehler(t("vormachen.fehler", { grund: e instanceof Error ? e.message : String(e) }));
      }
    } finally {
      setLaeuft(false);
    }
  };

  if (schritte.length === 0) {
    return null;
  }
  return (
    <section className="space-y-2" data-testid={testid}>
      <p className="font-medium">{t("vormachen.korrektur.titel")}</p>
      <Field label={t("vormachen.korrektur.schritt")}>
        <select
          className={AUSWAHL}
          value={nr}
          onChange={(e) => setNr(Number(e.target.value))}
          data-testid={`${testid}-schritt`}
        >
          {schritte.map((s) => (
            <option key={s.nr} value={s.nr}>
              {t("vormachen.korrektur.schrittName", { nr: s.nr, text: s.text })}
            </option>
          ))}
        </select>
      </Field>
      <Field label={t("vormachen.korrektur.satz")}>
        <TextInput
          value={satz}
          maxLength={300}
          placeholder={t("vormachen.korrektur.beispiel")}
          onChange={(e) => setSatz(e.target.value)}
          data-testid={`${testid}-satz`}
        />
      </Field>
      <Button
        variant="outline"
        disabled={laeuft || satz.trim() === ""}
        data-testid={`${testid}-senden`}
        onClick={() => void schicke()}
      >
        {t("vormachen.korrektur.senden")}
      </Button>
      {klaerung ? (
        <div className="space-y-1" data-testid={`${testid}-klaerung`}>
          {klaerung.optionen.map((o) => (
            <Button
              key={o}
              variant="ghost"
              disabled={laeuft}
              data-testid={`${testid}-wahl-${o}`}
              onClick={() => void schicke(o)}
            >
              {t(`vormachen.korrektur.bedeutung.${o}`)}
            </Button>
          ))}
        </div>
      ) : null}
      {meldung ? (
        <output className="block" data-testid={`${testid}-meldung`}>
          {meldung}
        </output>
      ) : null}
      {fehler ? (
        <p role="alert" className="text-trust-warn-text" data-testid={`${testid}-fehler`}>
          {fehler}
        </p>
      ) : null}
    </section>
  );
}
