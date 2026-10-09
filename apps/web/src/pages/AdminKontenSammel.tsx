// ================================================================================================
// ADMIN-04 · MEHRERE KONTEN BEARBEITEN — Auswahl, Auswirkung, Ausführung, Ergebnis je Konto.
// ================================================================================================
//
// produkt:20261009:admin-nutzer-uebersicht, Kriterium „Massenänderungen werden nur für bereits
// unterstützte und berechtigte Aktionen angeboten. Auswahl und Auswirkungen sind vor Ausführung
// prüfbar; Teilfehler verschwinden nicht in einer pauschalen Erfolgsmeldung."
//
//   · ANGEBOTEN wird nur, was es je Konto schon gibt: Freigeben und Befristen (`lib/nutzerliste.ts`,
//     `Sammelaktion`). Rechte prüft der Server bei JEDEM einzelnen Aufruf — derselbe Weg wie in der
//     Kontokarte, kein Sammelendpunkt mit eigener Regel.
//   · VOR DEM AUSFÜHREN steht je Konto, was geschieht oder warum es entfällt. Ändert sich Auswahl,
//     Aktion oder Tag, verfällt die Vorschau, und „Ausführen" ist wieder gesperrt.
//   · DANACH steht je Konto das Ergebnis des Servers. Die Zusammenfassung zählt Erfolge UND
//     Fehlschläge; ein gescheitertes Konto bleibt mit dem Satz des Servers stehen.
// Die Auswahl umfasst nur die gerade gefilterte Liste — Suche und Filter grenzen sie ein.
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ApiError } from "../api/client";
import { endpoints } from "../api/endpoints";
import type { PublicUser } from "../api/types";
import { useSession } from "../app/AuthContext";
import { Button, Field, TextInput } from "../components/ui";
import {
  type Sammelaktion,
  type Sammelergebnis,
  type Vorschauzeile,
  sammelbilanz,
  sammelvorschau,
} from "../lib/nutzerliste";
import { endeDesTages, serverHatAbgewiesen } from "./AdminKontenDetails";

export function Sammelbearbeitung({ konten }: { konten: readonly PublicUser[] }): JSX.Element {
  const { t, i18n } = useTranslation();
  const qc = useQueryClient();
  const selbstId = useSession().user?.id ?? null;
  const [auswahl, setAuswahl] = useState<ReadonlySet<string>>(new Set());
  const [aktion, setAktion] = useState<Sammelaktion | "">("");
  const [tag, setTag] = useState("");
  const [vorschau, setVorschau] = useState<Vorschauzeile[] | null>(null);
  const [hinweis, setHinweis] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const [ergebnisse, setErgebnisse] = useState<Sammelergebnis[] | null>(null);

  // Was die Vorschau voraussetzt, ändert sich → sie gilt nicht mehr.
  const verwerfen = (): void => {
    setVorschau(null);
    setHinweis(null);
  };
  const umschalten = (id: string): void => {
    setAuswahl((alt) => {
      const neu = new Set(alt);
      if (neu.has(id)) {
        neu.delete(id);
      } else {
        neu.add(id);
      }
      return neu;
    });
    verwerfen();
  };
  // Nur, was in der gefilterten Liste noch steht, gehört zur Auswahl.
  const gewaehlt = konten.filter((k) => auswahl.has(k.id));
  const bis = aktion === "befristen" ? endeDesTages(tag) : null;
  const datum = bis === null ? "" : new Date(bis).toLocaleDateString(i18n.language);
  const wirkt = vorschau?.filter((z) => z.art === "wirkt") ?? [];

  const vorschauHolen = (): void => {
    setErgebnisse(null);
    if (gewaehlt.length === 0) {
      setHinweis(t("nutzerliste.sammel.keineAuswahl"));
      return;
    }
    if (aktion === "") {
      setHinweis(t("nutzerliste.sammel.keineAktion"));
      return;
    }
    if (aktion === "befristen" && bis === null) {
      setHinweis(t("adm.gastfrist.datumFehlt"));
      return;
    }
    setHinweis(null);
    setVorschau(sammelvorschau(aktion, gewaehlt, selbstId));
  };

  const ausfuehren = async (): Promise<void> => {
    if (vorschau === null || aktion === "") {
      return;
    }
    setLaeuft(true);
    const raus: Sammelergebnis[] = [];
    // NACHEINANDER, nicht gleichzeitig: jedes Konto bekommt seinen eigenen, vollständigen Aufruf,
    // und ein Fehler bricht die übrigen nicht ab.
    for (const z of wirkt) {
      try {
        if (aktion === "freigeben") {
          await endpoints.users.approve(z.id);
        } else {
          await endpoints.users.setAccessExpiry(z.id, bis);
        }
        raus.push({ id: z.id, name: z.name, ok: true });
      } catch (e) {
        raus.push({
          id: z.id,
          name: z.name,
          ok: false,
          meldung: e instanceof ApiError ? e.message : t("state.error"),
          abgewiesen: serverHatAbgewiesen(e),
        });
      }
    }
    setErgebnisse(raus);
    setVorschau(null);
    setLaeuft(false);
    // Der Stand kommt danach vom Server — für die Liste wie für die Verantwortungszahlen.
    void qc.invalidateQueries({ queryKey: ["users"] });
    void qc.invalidateQueries({ queryKey: ["verantwortung"] });
    void qc.invalidateQueries({ queryKey: ["audit"] });
  };

  const bilanz = ergebnisse === null ? null : sammelbilanz(ergebnisse);
  const grundText = (z: Vorschauzeile): string =>
    z.art === "wirkt"
      ? aktion === "freigeben"
        ? t("nutzerliste.sammel.wirkt.freigeben")
        : t("nutzerliste.sammel.wirkt.befristen", { datum })
      : t(`nutzerliste.sammel.entfaellt.${z.grund}`);

  return (
    <div
      data-testid="sammel-flaeche"
      className="space-y-3 rounded-[14px] border border-hairline bg-surface p-4"
    >
      <fieldset className="space-y-1.5">
        <legend className="text-[12.5px] font-medium text-muted">
          {t("nutzerliste.sammel.auswahl", { anzahl: gewaehlt.length, gesamt: konten.length })}
        </legend>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="ghost"
            data-testid="sammel-alle"
            onClick={() => {
              setAuswahl(new Set(konten.map((k) => k.id)));
              verwerfen();
            }}
          >
            {t("nutzerliste.sammel.alle")}
          </Button>
          <Button
            variant="ghost"
            data-testid="sammel-keine"
            onClick={() => {
              setAuswahl(new Set());
              verwerfen();
            }}
          >
            {t("nutzerliste.sammel.keine")}
          </Button>
        </div>
        <ul className="max-h-72 space-y-1 overflow-y-auto">
          {konten.map((k) => (
            <li key={k.id}>
              <label
                data-testid="sammel-konto"
                data-id={k.id}
                className="flex min-w-0 items-center gap-2 break-words text-[13px] text-text"
              >
                <input
                  type="checkbox"
                  checked={auswahl.has(k.id)}
                  onChange={() => umschalten(k.id)}
                  className="accent-brand"
                />
                <span className="min-w-0 break-words">
                  {k.name} <span className="text-muted-2">· {k.email}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      </fieldset>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={t("nutzerliste.sammel.aktionTitel")}>
          <select
            data-testid="sammel-aktion"
            value={aktion}
            onChange={(e) => {
              setAktion(e.target.value as Sammelaktion | "");
              verwerfen();
            }}
            className="h-9 w-full rounded-input border border-hairline bg-surface px-2 text-[13px]"
          >
            <option value="">{t("nutzerliste.sammel.aktionWaehlen")}</option>
            <option value="freigeben">{t("nutzerliste.sammel.aktion.freigeben")}</option>
            <option value="befristen">{t("nutzerliste.sammel.aktion.befristen")}</option>
          </select>
        </Field>
        {aktion === "befristen" ? (
          <Field label={t("adm.gastfrist.datum")}>
            <TextInput
              type="date"
              data-testid="sammel-tag"
              value={tag}
              onChange={(e) => {
                setTag(e.target.value);
                verwerfen();
              }}
              className="h-9"
            />
          </Field>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" data-testid="sammel-vorschau-holen" onClick={vorschauHolen}>
          {t("nutzerliste.sammel.pruefen")}
        </Button>
        <Button
          variant="primary"
          data-testid="sammel-ausfuehren"
          disabled={laeuft || vorschau === null || wirkt.length === 0}
          onClick={() => void ausfuehren()}
        >
          {laeuft
            ? t("nutzerliste.sammel.laeuft")
            : t("nutzerliste.sammel.ausfuehren", { anzahl: wirkt.length })}
        </Button>
      </div>
      {hinweis === null ? null : (
        <p role="alert" className="text-[12px] text-trust-crit-text">
          {hinweis}
        </p>
      )}

      {vorschau === null ? null : (
        <div data-testid="sammel-vorschau" className="space-y-1 rounded-input bg-page p-2">
          <div className="text-[12.5px] font-medium text-text">
            {t("nutzerliste.sammel.vorschauKopf", {
              wirkt: wirkt.length,
              entfaellt: vorschau.length - wirkt.length,
            })}
          </div>
          <ul className="space-y-0.5 text-[12.5px]">
            {vorschau.map((z) => (
              <li
                key={z.id}
                data-testid="sammel-vorschau-zeile"
                data-id={z.id}
                data-art={z.art}
                className={z.art === "wirkt" ? "text-text" : "text-muted-2"}
              >
                {z.name}: {grundText(z)}
              </li>
            ))}
          </ul>
          {aktion === "befristen" ? (
            <p className="text-[12px] text-muted-2">{t("nutzerliste.sammel.befristenHinweis")}</p>
          ) : null}
        </div>
      )}

      {ergebnisse === null || bilanz === null ? null : (
        <div
          data-testid="sammel-ergebnis"
          data-vollstaendig={bilanz.vollstaendig ? "ja" : "nein"}
          role={bilanz.vollstaendig ? "status" : "alert"}
          className="space-y-1 rounded-input bg-page p-2 text-[12.5px]"
        >
          <div className={bilanz.vollstaendig ? "text-text" : "font-medium text-trust-crit-text"}>
            {bilanz.vollstaendig
              ? t("nutzerliste.sammel.bilanzVoll", { ok: bilanz.ok })
              : t("nutzerliste.sammel.bilanzTeil", { ok: bilanz.ok, fehler: bilanz.fehler })}
          </div>
          <ul className="space-y-0.5">
            {ergebnisse.map((e) => (
              <li
                key={e.id}
                data-testid="sammel-ergebnis-zeile"
                data-id={e.id}
                data-ok={e.ok ? "ja" : "nein"}
                className={e.ok ? "text-text" : "text-trust-crit-text"}
              >
                {e.ok
                  ? t("nutzerliste.sammel.zeileOk", { name: e.name })
                  : `${t("nutzerliste.sammel.zeileFehler", { name: e.name })} ${e.meldung} ${
                      e.abgewiesen
                        ? t("nutzerliste.sammel.unveraendert")
                        : t("nutzerliste.sammel.ausgangOffen")
                    }`}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
