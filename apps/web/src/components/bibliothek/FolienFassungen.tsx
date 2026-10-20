import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ApiError } from "../../api/client";
import { datenFehler } from "../../api/praesentationDaten";
import {
  type FassungsDatei,
  type FassungsStand,
  praesentationUebernahme,
} from "../../api/praesentationUebernahme";
import { objectRawHref } from "../../lib/bodyFileLink";

export function FolienFassungen({
  koId,
  anhangId,
  darfSpeichern,
  gespeichert,
}: {
  koId: string;
  anhangId: string;
  darfSpeichern: boolean;
  gespeichert: (text: string) => void;
}): JSX.Element {
  const { t } = useTranslation();
  const [offen, setOffen] = useState(false);
  const [d, setD] = useState<FassungsStand | null>(null);
  const [dateien, setDateien] = useState<FassungsDatei[]>([]);
  const [fehler, setFehler] = useState("");
  const [laedt, setLaedt] = useState(false);
  const lauf = useRef(0);
  const knopf = useRef<HTMLButtonElement>(null);
  useEffect(
    () => () => {
      lauf.current++;
    },
    [],
  );
  const text = (f: unknown) => {
    const e = datenFehler(f);
    return e.text ?? t(e.schluessel);
  };
  async function lade() {
    const nr = ++lauf.current;
    setOffen(true);
    setFehler("");
    setLaedt(true);
    try {
      const neu = await praesentationUebernahme.stand(koId, anhangId);
      if (nr === lauf.current) setD(neu);
    } catch (f) {
      if (nr === lauf.current) setFehler(text(f));
    } finally {
      if (nr === lauf.current) setLaedt(false);
    }
  }
  async function ausfuehren(undo: boolean) {
    if (!d) return;
    const nr = ++lauf.current;
    setFehler("");
    setLaedt(true);
    try {
      if (undo) {
        const r = await praesentationUebernahme.ruecknahme(koId, anhangId, d);
        if (nr !== lauf.current) return;
        gespeichert(t("folienuebernahme.rueckgenommen", { fassung: r.fassung }));
        setD(null);
      } else {
        const r = await praesentationUebernahme.fassungen(koId, anhangId, d);
        if (nr === lauf.current) setDateien(r.dateien);
      }
    } catch (f) {
      if (nr !== lauf.current) return;
      setFehler(text(f));
      if (
        f instanceof ApiError &&
        f.code === "PP07_FASSUNGEN_TEILWIRKUNG" &&
        Array.isArray(f.details.dateien)
      )
        setDateien(f.details.dateien as FassungsDatei[]);
      if (f instanceof ApiError && f.code === "PP07_TEILWIRKUNG")
        gespeichert(t("folienuebernahme.teilweise", { fassung: f.details.fassung ?? "?" }));
    } finally {
      if (nr === lauf.current) setLaedt(false);
    }
  }
  function schliesse() {
    lauf.current++;
    setOffen(false);
    setD(null);
    setLaedt(false);
    knopf.current?.focus();
  }
  const bereit =
    d?.fassungen.length &&
    d.fassungen.every(
      (f) =>
        f.verfuegbar &&
        f.konflikte.length === 0 &&
        f.gemeinsam.datenbasis.every((p) => p.fassung === p.aktuelleFassung),
    );
  return (
    <div className="mt-2 text-[12px] text-text">
      <button
        ref={knopf}
        type="button"
        aria-expanded={offen}
        onClick={() => (offen ? schliesse() : void lade())}
        className="rounded-btn border border-hairline px-2 py-1 font-semibold"
      >
        {t("folienuebernahme.fassungen")}
      </button>
      {offen ? (
        <section
          aria-label={t("folienuebernahme.fassungen")}
          className="mt-2 rounded-card border border-hairline p-2 space-y-2"
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.stopPropagation();
              schliesse();
            }
          }}
        >
          <output aria-live="polite" className="block">
            {laedt ? t("folienuebernahme.laedt") : ""}
          </output>
          {fehler ? (
            <p role="alert" className="text-trust-crit-text">
              {fehler}
            </p>
          ) : null}
          {d ? (
            <>
              <p>{t("folienuebernahme.momentaufnahme", { fassung: d.fassung })}</p>
              {d.uebernahme ? (
                <div>
                  <p>{t("folienuebernahme.ruecknahmeHinweis")}</p>
                  <ul>
                    {d.uebernahme.punkte
                      .filter((p) => p.vorherWert !== p.aktuellWert)
                      .map((p) => (
                        <li key={p.id}>
                          {p.aktuellWert} → {p.vorherWert}
                        </li>
                      ))}
                  </ul>
                  {d.uebernahme.konflikteOffen.map((k) => (
                    <p key={k.id} className="text-trust-crit-text">
                      {k.grund}
                    </p>
                  ))}
                  {darfSpeichern ? (
                    <button
                      type="button"
                      disabled={laedt || !d.uebernahme.ruecknahmeMoeglich}
                      onClick={() => void ausfuehren(true)}
                      className="rounded-btn border border-hairline px-2 py-1 font-semibold"
                    >
                      {t("folienuebernahme.ruecknahme")}
                    </button>
                  ) : null}
                  {!d.uebernahme.ruecknahmeMoeglich ? (
                    <p>{t("folienuebernahme.fremdeArbeit")}</p>
                  ) : null}
                </div>
              ) : null}
              <p>{t("folienuebernahme.tiefenHinweis")}</p>
              {darfSpeichern ? (
                <button
                  type="button"
                  disabled={laedt || !bereit}
                  onClick={() => void ausfuehren(false)}
                  className="rounded-btn border border-hairline px-2 py-1 font-semibold"
                >
                  {t("folienuebernahme.fassungenSpeichern")}
                </button>
              ) : null}
              {!bereit ? <p>{t("folienuebernahme.erstAktualisieren")}</p> : null}
            </>
          ) : null}
          {dateien.length ? (
            <ul aria-label={t("folienuebernahme.gespeicherteDateien")}>
              {dateien.map((f) => (
                <li key={f.objectId}>
                  {f.wiederoeffnet && objectRawHref(f.objectId) ? (
                    <a
                      className="underline"
                      href={objectRawHref(f.objectId) ?? undefined}
                      download={f.name}
                    >
                      {f.name}
                    </a>
                  ) : (
                    <span>
                      {f.name} · {t("folienuebernahme.unbestaetigt")}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
