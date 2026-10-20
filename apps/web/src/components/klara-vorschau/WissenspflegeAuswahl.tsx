import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Link } from "react-router-dom";
import { endpoints } from "../../api/endpoints";
import {
  type PflegeEingabe,
  type PflegeErgebnis,
  type PflegeVorlage,
  wissenspflegeApi,
} from "../../api/klaraWissenspflege";
import { useSession } from "../../app/AuthContext";
import { useAssistenzT } from "../../lib/assistenzProfil";
import { anfrageEpoche, aufRechtekontextwechsel } from "../../lib/rechtekontext";
import { Button, Field, TextInput } from "../ui";

export interface GeprueftePflegeAuswahl {
  auftrag: PflegeEingabe;
  epoche: number;
}
export function WissenspflegeAuswahl(props: {
  vorlage: PflegeVorlage;
  initial?: PflegeEingabe;
  onChange: (auswahl: GeprueftePflegeAuswahl | null) => void;
}): JSX.Element {
  const { user } = useSession();
  const epoche = useSyncExternalStore(aufRechtekontextwechsel, anfrageEpoche, anfrageEpoche);
  return (
    <Auswahl
      key={`${user?.id}:${epoche}:${props.vorlage}`}
      {...props}
      kontoId={user?.id ?? ""}
      epoche={epoche}
    />
  );
}

function Auswahl({
  vorlage,
  initial,
  onChange,
  kontoId,
  epoche,
}: {
  vorlage: PflegeVorlage;
  initial?: PflegeEingabe;
  onChange: (auswahl: GeprueftePflegeAuswahl | null) => void;
  kontoId: string;
  epoche: number;
}): JSX.Element {
  const { t } = useAssistenzT();
  const [suche, setSuche] = useState("");
  const [auswahl, setAuswahl] = useState<string[]>(initial?.quellen ?? []);
  const [laeuft, setLaeuft] = useState(false);
  const [bereit, setBereit] = useState(false);
  const [fehler, setFehler] = useState(false);
  const aktiv = useRef(true);
  const wechsel = useRef(onChange);
  wechsel.current = onChange;
  useEffect(() => {
    aktiv.current = true;
    wechsel.current(null);
    return () => {
      aktiv.current = false;
    };
  }, []);
  const quellen = useQuery({
    queryKey: ["wissenspflege-quellen", kontoId, epoche, suche],
    queryFn: () => endpoints.library.search({ q: suche }),
    enabled: suche.trim().length >= 2 && kontoId.length > 0,
  });
  const aendere = (ids: string[]) => {
    setAuswahl(ids);
    setBereit(false);
    setFehler(false);
    wechsel.current(null);
  };
  const pruefe = async () => {
    setLaeuft(true);
    setFehler(false);
    setBereit(false);
    wechsel.current(null);
    const auftrag = { vorlage, quellen: auswahl };
    try {
      await wissenspflegeApi.vorschau(auftrag);
      if (aktiv.current && epoche === anfrageEpoche()) {
        setBereit(true);
        wechsel.current({ auftrag, epoche });
      }
    } catch {
      if (aktiv.current && epoche === anfrageEpoche()) setFehler(true);
    } finally {
      if (aktiv.current && epoche === anfrageEpoche()) setLaeuft(false);
    }
  };
  return (
    <div data-testid="wissenspflege-auswahl" className="space-y-2 text-[12px]">
      <p>{t("wissenspflege.zweck")}</p>
      <p>{t("wissenspflege.rahmen")}</p>
      <p>{t(vorlage === "quellaenderung" ? "wissenspflege.polling" : "wissenspflege.zeitplan")}</p>
      <fieldset disabled={laeuft} className="space-y-2">
        <Field label={t("wissenspflege.suche")}>
          <TextInput value={suche} onChange={(e) => setSuche(e.target.value)} />
        </Field>
        {quellen.isError ? <p role="alert">{t("wissenspflege.quellfehler")}</p> : null}
        {quellen.data?.length === 0 ? <p>{t("wissenspflege.leer")}</p> : null}
        {quellen.data?.map((q) => (
          <label key={q.id} className="flex items-start gap-2">
            <input
              type="checkbox"
              checked={auswahl.includes(q.id)}
              onChange={(ev) =>
                aendere(
                  ev.target.checked ? [...auswahl, q.id] : auswahl.filter((id) => id !== q.id),
                )
              }
            />
            <span className="min-w-0 break-words">{q.title}</span>
          </label>
        ))}
        <p>{t("wissenspflege.auswahl", { anzahl: auswahl.length })}</p>
        <ul className="space-y-1">
          {auswahl.map((id, i) => (
            <li key={id} className="flex flex-wrap items-center gap-2">
              <Link to={`/wissen/${encodeURIComponent(id)}`} className="underline">
                {t("wissenspflege.quelle", { nummer: i + 1 })}
              </Link>
              <Button onClick={() => aendere(auswahl.filter((x) => x !== id))}>
                {t("wissenspflege.entfernen")}
              </Button>
            </li>
          ))}
        </ul>
        <Button
          disabled={auswahl.length === 0 || auswahl.length > 20}
          onClick={() => void pruefe()}
        >
          {t(laeuft ? "wissenspflege.prueft" : "wissenspflege.vorschau")}
        </Button>
      </fieldset>
      {fehler ? <p role="alert">{t("wissenspflege.fehler")}</p> : null}
      {bereit ? (
        <output data-testid="wissenspflege-vorschau-bereit">
          {t("wissenspflege.vorschauBereit")}
        </output>
      ) : null}
    </div>
  );
}

export function WissenspflegePruefstand({
  p,
  zone,
}: { p: PflegeErgebnis; zone: string }): JSX.Element {
  const { t, i18n } = useAssistenzT();
  const zeit = (iso: string) =>
    new Intl.DateTimeFormat(i18n.language, {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: zone,
    }).format(new Date(iso));
  return (
    <span
      data-testid="wissenspflege-pruefstand"
      data-stand={p.stand}
      className="mt-1 block space-y-1 text-[11.5px]"
    >
      <strong>{t(`wissenspflege.stand.${p.stand}`)}</strong>
      <span className="block">{t("wissenspflege.geprueftAm", { zeit: zeit(p.geprueftAm) })}</span>
      {p.quellen.map((q, i) => (
        <span key={q.id} className="block">
          <Link to={`/wissen/${encodeURIComponent(q.id)}`} className="underline">
            {t("wissenspflege.quelle", { nummer: i + 1 })}
          </Link>
          {" · "}
          {q.letzteErfolgreichePruefung
            ? t("wissenspflege.zuletzt", { zeit: zeit(q.letzteErfolgreichePruefung) })
            : t("wissenspflege.nie")}
        </span>
      ))}
    </span>
  );
}
