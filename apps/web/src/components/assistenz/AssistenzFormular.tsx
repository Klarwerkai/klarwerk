// produkt:20261010:assistenz-name-avatar — NAME, MOTIV UND BEWEGUNG: EIN FORMULAR, ZWEI EINSTIEGE.
//
// Ersteinrichtung (`modus="einrichtung"`) und „Meine Assistenz" (`modus="aendern"`) teilen dieses
// Formular. Was es zusichert:
//   · Fehlender oder ungültiger Name, fehlendes Motiv: NICHTS geht an den Server; der Grund steht
//     direkt am Feld (`aria-describedby`), der Fokus springt auf das erste betroffene Feld.
//   · Gespeichert wird über `PUT /api/me/assistenz` mit der zuletzt bestätigten Fassung. Erst die
//     Antwort des Servers wird zum bestätigten Stand — die offene Assistenz übernimmt ihn sofort.
//   · Scheitert das Speichern, bleibt die Eingabe stehen und der bestätigte Stand unverändert; es
//     gibt „Erneut speichern" und „Abbrechen". Die übrige Anwendung bleibt bedienbar.
//   · Ändern geht einzeln oder gemeinsam: geschickt wird nur, was sich geändert hat.
import { useEffect, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  type AssistenzBewegung,
  type AssistenzProfilAenderung,
  type AssistenzProfilAntwort,
  assistenzProfilApi,
} from "../../api/assistenzProfil";
import { ApiError } from "../../api/client";
import { useSession } from "../../app/AuthContext";
import { avatarMotiv } from "../../lib/assistenzAvatare";
import { ASSISTENZ_NAME_MAX, pruefeName } from "../../lib/assistenzName";
import {
  bestaetigeAssistenzProfil,
  ladeAssistenzProfil,
  useAssistenzStand,
} from "../../lib/assistenzProfil";
import { Button, TextInput } from "../ui";
import { AvatarAuswahl } from "./AvatarAuswahl";
import { AvatarBild } from "./AvatarBild";
import { meldeErgebnis } from "./ausdruck";

interface Eingabe {
  name: string;
  avatar: string | null;
  bewegung: AssistenzBewegung;
}

export function AssistenzFormular({
  modus,
  onGespeichert,
  onAbbrechen,
  zusatzKnoepfe,
  autoFokus = false,
}: {
  modus: "einrichtung" | "aendern";
  /** Nach dem Aufklappen steht der Fokus im Namensfeld — die Tastatur muss nicht suchen. */
  autoFokus?: boolean;
  onGespeichert?: (antwort: AssistenzProfilAntwort) => void;
  /** Abbrechen nach einem Speicherfehler — bzw. „Später" in der Ersteinrichtung. */
  onAbbrechen?: () => void;
  zusatzKnoepfe?: JSX.Element | null;
}): JSX.Element {
  const { t } = useTranslation();
  const { user } = useSession();
  const stand = useAssistenzStand();
  const bestaetigt = stand.antwort?.profil ?? null;
  const idBasis = useId();
  const auswahlRef = useRef<HTMLDivElement | null>(null);

  // Vorbelegung aus dem BESTÄTIGTEN Stand. Ein noch leerer Name bleibt leer — kein historischer
  // oder vorgeschlagener Produktname wird eingesetzt. Ein schon gewähltes Motiv bleibt gewählt.
  const ausBestaetigt = (): Eingabe => ({
    name: bestaetigt?.name ?? "",
    avatar: avatarMotiv(bestaetigt?.avatar) ? (bestaetigt?.avatar ?? null) : null,
    bewegung: bestaetigt?.bewegung ?? "standard",
  });
  const [eingabe, setEingabe] = useState<Eingabe>(ausBestaetigt);
  const [beruehrt, setBeruehrt] = useState(false);
  // Kommt der bestätigte Stand erst nach dem Aufbau (Laden), wird er übernommen — solange niemand
  // schon getippt hat.
  const fassung = bestaetigt?.fassung ?? 0;
  // biome-ignore lint/correctness/useExhaustiveDependencies: nur bei neuer bestätigter Fassung.
  useEffect(() => {
    if (!beruehrt) {
      setEingabe(ausBestaetigt());
    }
  }, [fassung]);

  useEffect(() => {
    if (autoFokus) {
      document.getElementById(`${idBasis}-name`)?.focus();
    }
  }, [autoFokus, idBasis]);

  const [geprueft, setGeprueft] = useState(false);
  const [laeuft, setLaeuft] = useState(false);
  const [speicherFehler, setSpeicherFehler] = useState<string | null>(null);
  const [meldung, setMeldung] = useState<string | null>(null);

  const namensFehler = pruefeName(eingabe.name);
  const avatarFehlt = eingabe.avatar === null;
  const zeigeNamensFehler = geprueft && namensFehler !== null;
  const zeigeAvatarFehler = geprueft && avatarFehlt && (modus === "einrichtung" || !bestaetigt);
  const nameFehlerId = `${idBasis}-name-fehler`;
  const nameHilfeId = `${idBasis}-name-hilfe`;

  const aendern = (teil: Partial<Eingabe>): void => {
    setBeruehrt(true);
    setMeldung(null);
    setEingabe((alt) => ({ ...alt, ...teil }));
  };

  const aenderung = (): AssistenzProfilAenderung | null => {
    const name = eingabe.name.normalize("NFC").trim();
    if (modus === "einrichtung" || !bestaetigt) {
      return {
        name,
        // `exactOptionalPropertyTypes`: ohne Wahl fehlt das Feld ganz (nie `undefined`).
        ...(eingabe.avatar !== null ? { avatar: eingabe.avatar } : {}),
        bewegung: eingabe.bewegung,
        einrichtungAbschliessen: true,
        fassung,
      };
    }
    const teil: AssistenzProfilAenderung = { fassung };
    if (name !== (bestaetigt.name ?? "")) {
      teil.name = name;
    }
    if (eingabe.avatar !== null && eingabe.avatar !== bestaetigt.avatar) {
      teil.avatar = eingabe.avatar;
    }
    if (eingabe.bewegung !== bestaetigt.bewegung) {
      teil.bewegung = eingabe.bewegung;
    }
    return Object.keys(teil).length > 1 ? teil : null;
  };

  const speichern = async (): Promise<void> => {
    setGeprueft(true);
    setMeldung(null);
    const avatarPflicht = modus === "einrichtung" || !bestaetigt;
    if (namensFehler !== null) {
      document.getElementById(`${idBasis}-name`)?.focus();
      return;
    }
    if (avatarPflicht && avatarFehlt) {
      auswahlRef.current?.querySelector<HTMLInputElement>('input[type="radio"]')?.focus();
      return;
    }
    const teil = aenderung();
    if (teil === null) {
      setMeldung(t("assistenz.einstellungen.unveraendert"));
      return;
    }
    if (!user) {
      return;
    }
    setLaeuft(true);
    setSpeicherFehler(null);
    // Neue Aktion: ein früherer Fehler- oder Freudezustand der Figur endet hier.
    meldeErgebnis(null);
    try {
      const antwort = await assistenzProfilApi.speichern(teil);
      // Erst der Aufrufer (er zeigt das Ergebnis), dann der bestätigte Stand für alle Flächen.
      onGespeichert?.(antwort);
      bestaetigeAssistenzProfil(user.id, antwort);
      // Bestätigter Erfolg einer bewusst angestossenen Aktion: kurze Freude der Figur.
      meldeErgebnis("freude");
      setBeruehrt(false);
      setGeprueft(false);
      const p = antwort.profil;
      if (modus === "aendern" && p) {
        setMeldung(
          t("assistenz.einstellungen.gespeichert", {
            name: p.name ?? t("assistenz.neutral.name"),
            motiv: t(`assistenz.avatar.name.${p.avatar ?? "original"}`),
          }),
        );
      }
    } catch (fehler) {
      const grund =
        fehler instanceof ApiError && fehler.status > 0 && fehler.message
          ? fehler.message
          : t("assistenz.speichern.netz");
      setSpeicherFehler(t("assistenz.speichern.fehler", { grund }));
      // Tatsächlich fehlgeschlagen: die Figur zeigt den Fehlerzustand bis Wiederholen/Abbrechen.
      meldeErgebnis("fehler");
      // Ein Konflikt heisst: der bestätigte Stand ist veraltet — neu lesen, Eingabe behalten.
      if (fehler instanceof ApiError && fehler.status === 409) {
        void ladeAssistenzProfil(user.id);
      }
    } finally {
      setLaeuft(false);
    }
  };

  const abbrechen = (): void => {
    if (speicherFehler) {
      meldeErgebnis(null);
    }
    setSpeicherFehler(null);
    setGeprueft(false);
    setBeruehrt(false);
    setEingabe(ausBestaetigt());
    if (modus === "aendern") {
      setMeldung(t("assistenz.einstellungen.abgebrochen"));
    }
    onAbbrechen?.();
  };

  const vorschauMotiv = avatarMotiv(eingabe.avatar ?? bestaetigt?.avatar ?? null);
  const vorschauName = eingabe.name.trim() || t("assistenz.neutral.titel");
  const gespeichertesMotivFehlt =
    typeof bestaetigt?.avatar === "string" &&
    avatarMotiv(bestaetigt.avatar) === null &&
    eingabe.avatar === null;

  return (
    <form
      noValidate
      data-testid={`assistenz-formular-${modus}`}
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        void speichern();
      }}
    >
      <div className="space-y-1.5">
        <label htmlFor={`${idBasis}-name`} className="block text-[12.5px] font-medium text-muted">
          {t("assistenz.feld.name")}
        </label>
        <TextInput
          id={`${idBasis}-name`}
          data-testid="assistenz-name"
          value={eingabe.name}
          autoComplete="off"
          spellCheck={false}
          maxLength={ASSISTENZ_NAME_MAX * 2}
          aria-invalid={zeigeNamensFehler ? true : undefined}
          aria-describedby={zeigeNamensFehler ? `${nameFehlerId} ${nameHilfeId}` : nameHilfeId}
          onChange={(e) => aendern({ name: e.target.value })}
          className={`max-w-[360px] focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-1 focus-visible:outline-ink ${
            zeigeNamensFehler ? "border-trust-crit-text" : ""
          }`}
        />
        <p id={nameHilfeId} className="text-[12px] text-muted">
          {t("assistenz.feld.nameHilfe")}
        </p>
        {zeigeNamensFehler && namensFehler ? (
          <p
            id={nameFehlerId}
            data-testid="assistenz-name-fehler"
            className="text-[12.5px] font-semibold text-trust-crit-text"
          >
            {t(`assistenz.fehler.${namensFehler}`)}
          </p>
        ) : null}
      </div>

      {gespeichertesMotivFehlt ? (
        <p data-testid="assistenz-avatar-fehlt" className="text-[12.5px] text-text">
          {t("assistenz.avatar.fehlt")}
        </p>
      ) : null}

      <div ref={auswahlRef}>
        <AvatarAuswahl
          idBasis={idBasis}
          wert={eingabe.avatar}
          onWahl={(id) => aendern({ avatar: id })}
          fehler={zeigeAvatarFehler ? t("assistenz.fehler.avatarLeer") : null}
        />
      </div>

      <div
        data-testid="assistenz-vorschau"
        className="flex items-center gap-3 rounded-card border border-hairline bg-surface p-2.5"
      >
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full bg-page">
          <AvatarBild
            motiv={vorschauMotiv}
            alt=""
            ersatzBeschriftung={t("assistenz.avatar.ersatz")}
            className="h-14 w-14 rounded-full"
          />
        </span>
        <p className="min-w-0 text-[13px] text-text">
          {/* Der Name ist Text — React setzt ihn als Textknoten, nie als Markup. */}
          <span data-testid="assistenz-vorschau-name" className="font-semibold">
            {vorschauName}
          </span>
          {vorschauMotiv ? (
            <span className="block text-[12px] text-muted">
              {t(`assistenz.avatar.name.${vorschauMotiv.id}`)}
            </span>
          ) : null}
        </p>
      </div>

      <label className="flex items-start gap-2 text-[13px] text-text">
        <input
          type="checkbox"
          data-testid="assistenz-bewegung"
          checked={eingabe.bewegung === "reduziert"}
          onChange={(e) => aendern({ bewegung: e.target.checked ? "reduziert" : "standard" })}
          className="mt-0.5 h-4 w-4 focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-ink"
        />
        <span>
          <span className="block font-semibold">{t("assistenz.bewegung.label")}</span>
          <span className="block text-[12px] text-muted">{t("assistenz.bewegung.hilfe")}</span>
        </span>
      </label>

      {geprueft && (namensFehler !== null || zeigeAvatarFehler) ? (
        <p role="alert" className="text-[12.5px] font-semibold text-trust-crit-text">
          {t("assistenz.fehler.zusammen")}
        </p>
      ) : null}

      {speicherFehler ? (
        <div
          role="alert"
          data-testid="assistenz-speicherfehler"
          className="space-y-2 rounded-btn bg-trust-crit-bg px-3 py-2 text-[12.5px] text-trust-crit-text"
        >
          <p>{speicherFehler}</p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="submit"
              variant="primary"
              data-testid="assistenz-wiederholen"
              disabled={laeuft}
            >
              {t("assistenz.speichern.wiederholen")}
            </Button>
            <Button
              type="button"
              variant="outline"
              data-testid="assistenz-abbrechen"
              onClick={abbrechen}
            >
              {t("assistenz.speichern.abbrechen")}
            </Button>
          </div>
        </div>
      ) : null}

      {meldung ? (
        <output
          data-testid="assistenz-meldung"
          className="block rounded-card border border-trust-pos-fill/30 bg-trust-pos-bg p-3 text-[13px] text-trust-pos-text"
        >
          {meldung}
        </output>
      ) : null}

      {speicherFehler ? null : (
        <div className="flex flex-wrap gap-2">
          <Button
            type="submit"
            variant="primary"
            data-testid="assistenz-speichern"
            disabled={laeuft}
          >
            {laeuft
              ? t("assistenz.speichern.laeuft")
              : modus === "einrichtung"
                ? t("assistenz.einrichtung.speichern")
                : t("assistenz.einstellungen.speichern")}
          </Button>
          {modus === "aendern" ? (
            <Button
              type="button"
              variant="outline"
              data-testid="assistenz-abbrechen"
              onClick={abbrechen}
              disabled={laeuft}
            >
              {t("assistenz.speichern.abbrechen")}
            </Button>
          ) : null}
          {zusatzKnoepfe}
        </div>
      )}
    </form>
  );
}
