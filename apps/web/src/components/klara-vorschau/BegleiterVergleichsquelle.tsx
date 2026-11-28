import { skipToken, useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { endpoints } from "../../api/endpoints";
import { useSession } from "../../app/AuthContext";
import { zitatFragment } from "../../lib/belegstelle";
import { gespeicherteFassungHref } from "../../lib/objektbezug";
import { useAuthorName } from "../../lib/useAuthorName";
import { koDetailUrl } from "../../lib/wordAddin";
import { Belegtitel } from "../Belegtitel";
import { SanitizedHtml } from "../SanitizedHtml";
import { ZitierteQuellansicht } from "../ZitierteQuellansicht";

type Belegfassung = Awaited<ReturnType<typeof endpoints.ko.belegfassung>>;

export function Quellverweis({
  id,
  fassung,
  nummer,
  zitat,
  quelle,
}: {
  id: string;
  fassung: number | undefined;
  nummer: number;
  zitat: string;
  quelle: Belegfassung | undefined;
}): JSX.Element {
  const { t } = useTranslation();
  const name = useAuthorName();
  const [offen, setOffen] = useState(false);
  const ausloeser = useRef<HTMLAnchorElement>(null);
  return (
    <div className="begleiter-quellverweis mt-1.5 text-[12px] leading-snug">
      <a
        href={
          fassung
            ? gespeicherteFassungHref(id, fassung) + zitatFragment(zitat)
            : koDetailUrl(window.location.origin, id)
        }
        ref={ausloeser}
        aria-haspopup="dialog"
        onClick={(event) => {
          if (
            event.button !== 0 ||
            event.metaKey ||
            event.ctrlKey ||
            event.shiftKey ||
            event.altKey
          )
            return;
          event.preventDefault();
          setOffen(true);
        }}
        target="_blank"
        rel="noopener noreferrer"
        className="rounded-sm font-semibold text-brand-text underline underline-offset-2 focus-visible:outline focus-visible:outline-2"
      >
        {quelle?.titel ? (
          <Belegtitel titel={quelle.titel} demoSeed={quelle.demoSeed} />
        ) : (
          t("begleiter.vergleich.quelllink", { nummer })
        )}
      </a>
      {fassung !== undefined && (
        <span className="mt-0.5 block text-muted">
          {t("begleiter.vergleich.fassung", { fassung })}
          {quelle &&
            ` · ${
              quelle.freigegebenVon
                ? t("begleiter.vergleich.freigegebenVon", { person: name(quelle.freigegebenVon) })
                : t("begleiter.vergleich.freigabeUnbekannt")
            }`}
        </span>
      )}
      {offen && (
        <Quellfenster
          id={id}
          fassung={fassung}
          zitat={zitat}
          beiRueckkehr={() => {
            setOffen(false);
            ausloeser.current?.focus();
          }}
        />
      )}
    </div>
  );
}

function Quellfenster({
  id,
  fassung,
  zitat,
  beiRueckkehr,
}: {
  id: string;
  fassung: number | undefined;
  zitat: string;
  beiRueckkehr: () => void;
}): JSX.Element {
  const { t } = useTranslation();
  const [heute, setHeute] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const zurueck = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const fenster = dialog.current;
    fenster?.showModal();
    zurueck.current?.focus();
    return () => {
      fenster?.close();
    };
  }, []);
  const schliessen = () => {
    dialog.current?.close();
    beiRueckkehr();
  };
  // Ein normaler Quellenklick bleibt auch in der nativen Begleitapp im selben WebView.
  // Das Vergleichselement und der Entwurf im Fragefeld bleiben darunter montiert.
  return createPortal(
    <dialog
      ref={dialog}
      data-testid="begleiter-vergleich-quelle"
      aria-label={t("quellen.fokus.stelle")}
      className="fixed inset-0 m-auto max-h-[100dvh] w-full max-w-2xl overflow-hidden rounded-card border border-hairline bg-page p-0 text-text shadow-popover backdrop:bg-ink/40"
      onKeyDown={(event) => {
        if (event.key === "Escape") event.stopPropagation();
      }}
      onCancel={(event) => {
        event.preventDefault();
        schliessen();
      }}
    >
      <div className="flex max-h-[96dvh] flex-col">
        <header className="shrink-0 border-b border-hairline bg-surface px-3 py-2">
          <button
            ref={zurueck}
            type="button"
            data-testid="begleiter-quelle-zurueck"
            className="flex items-center gap-2 rounded-btn px-2 py-2 text-sm font-semibold text-brand-text focus-visible:outline focus-visible:outline-2"
            onClick={schliessen}
          >
            <ArrowLeft aria-hidden="true" size={16} />
            {t("quellen.fokus.zumVergleich")}
          </button>
        </header>
        <div className="min-h-0 overflow-y-auto px-3 pb-3">
          {fassung !== undefined && !heute ? (
            <ZitierteQuellansicht
              koId={id}
              fassung={fassung}
              ankerId={null}
              zitat={zitat}
              oeffneAktuellenEintrag={() => setHeute(true)}
            />
          ) : (
            <AktuellerEintrag id={id} ohneFassung={fassung === undefined} />
          )}
        </div>
      </div>
    </dialog>,
    document.body,
  );
}

function AktuellerEintrag({ id, ohneFassung }: { id: string; ohneFassung: boolean }): JSX.Element {
  const { t } = useTranslation();
  const { user } = useSession();
  const anfrage = useQuery({
    queryKey: ["begleiter-aktueller-beleg", user?.id, id],
    queryFn: user ? () => endpoints.ko.get(id) : skipToken,
    refetchOnMount: "always",
    gcTime: 0,
    retry: false,
  });
  if (user && (anfrage.isFetching || anfrage.isPending))
    return <output>{t("quellen.gespeichert.laedt")}</output>;
  if (!user || !anfrage.isSuccess || anfrage.data.id !== id)
    return <output>{t("quellen.gespeichert.fehler")}</output>;
  const ko = anfrage.data;
  return (
    <article className="py-3" data-testid="begleiter-quelle-heute">
      <p className="text-sm font-medium text-muted">
        {t("quellen.fokus.heutigerEintrag")} ·{" "}
        {t("begleiter.vergleich.fassung", { fassung: ko.version })}
      </p>
      {ohneFassung && (
        <p className="text-sm text-muted">{t("quellen.fokus.ohneVerknuepfteFassung")}</p>
      )}
      <h2 className="mt-2 text-lg font-semibold">
        <Belegtitel titel={ko.title} demoSeed={ko.demoSeed} />
      </h2>
      <p className="my-2 whitespace-pre-wrap">{ko.statement}</p>
      {ko.bodyHtml && <SanitizedHtml html={ko.bodyHtml} className="prose-kw text-sm" />}
      <a
        className="mt-3 inline-block text-sm font-medium text-brand-text underline"
        href={koDetailUrl(window.location.origin, id)}
        target="_blank"
        rel="noopener noreferrer"
      >
        {t("quellen.fokus.inKlarwerk")}
      </a>
    </article>
  );
}
