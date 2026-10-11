// ================================================================================================
// WISSENS-VERMÄCHTNIS-BUCH — der Bereich in der Kontokarte (`pages/AdminKontenDetails.tsx`).
// ================================================================================================
//
// Auftrag `aufnahme:20260922:gesamt-wissensvermaechtnis` (R-1642 / R-2175): „auf Knopfdruck ein
// gedrucktes oder digitales Wissens-Vermächtnis-Buch mit allen seinen Beiträgen — als Würdigung".
// Der Weg der Kontoverwaltung:
//   1. „Vermächtnis-Buch erzeugen" — der Server stellt das Buch zusammen; es ändert kein Wissen.
//   2. Die Vorschau zeigt Umfang, Zeitraum und Themen — und offen, was NICHT aufgenommen wurde.
//   3. Digital als `.md` herunterladen oder über den Druckdialog drucken (auch „Als PDF sichern").
//
// GESCHLOSSEN, BIS JEMAND KLICKT: wie der Übergabebereich lädt dieser Bereich nichts von sich aus.
import { useMutation } from "@tanstack/react-query";
import { BookOpen, Download, Printer } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ApiError } from "../api/client";
import { verantwortungApi } from "../api/verantwortung";
import { Button } from "./ui";

export function VermaechtnisBuch({ personId }: { personId: string }): JSX.Element {
  const { t } = useTranslation();
  const erzeugen = useMutation({ mutationFn: () => verantwortungApi.vermaechtnis(personId) });
  const buch = erzeugen.data?.person.id === personId ? erzeugen.data : undefined;

  const herunterladen = (): void => {
    if (!buch) {
      return;
    }
    const blob = new Blob([buch.markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = buch.dateiname;
    a.click();
    URL.revokeObjectURL(url);
  };
  // SCRUM-440-Muster: nur das Buch (.print-area) drucken; die Klasse nach dem Druck entfernen.
  const drucken = (): void => {
    document.body.classList.add("printing-extract");
    window.addEventListener(
      "afterprint",
      () => document.body.classList.remove("printing-extract"),
      { once: true },
    );
    window.print();
  };

  // Die Gründe in derselben Reihenfolge wie im Buch („Nicht aufgenommen").
  const GRUENDE = ["nichtValidiert", "vertraulich", "nichtEinsehbar", "papierkorb"] as const;
  const ausgelassen = buch
    ? GRUENDE.filter((grund) => buch.ausgelassen[grund] > 0).map((grund) =>
        t(`vermaechtnis.${grund}`, { anzahl: buch.ausgelassen[grund] }),
      )
    : [];

  return (
    <div data-testid="vermaechtnis-bereich" className="space-y-2 border-t border-hairline pt-4">
      <div className="text-[12.5px] font-medium text-muted">{t("vermaechtnis.titel")}</div>
      <p className="text-[12px] text-muted-2">{t("vermaechtnis.hinweis")}</p>
      <Button
        variant="ghost"
        data-testid="vermaechtnis-erzeugen"
        disabled={erzeugen.isPending}
        onClick={() => erzeugen.mutate()}
      >
        <BookOpen size={15} />
        {erzeugen.isPending ? t("vermaechtnis.laedt") : t("vermaechtnis.erzeugen")}
      </Button>

      {erzeugen.isError ? (
        <p className="text-[12.5px] text-trust-crit-text" data-testid="vermaechtnis-fehler">
          {t("vermaechtnis.fehler", {
            meldung: erzeugen.error instanceof ApiError ? erzeugen.error.message : t("state.error"),
          })}
        </p>
      ) : null}

      {buch ? (
        <div className="space-y-2" data-testid="vermaechtnis-ergebnis">
          <p className="text-[13px] text-text" data-testid="vermaechtnis-umfang">
            {buch.aufgenommen === 0
              ? t("vermaechtnis.leer")
              : buch.zeitraum
                ? t("vermaechtnis.umfang", {
                    anzahl: buch.aufgenommen,
                    themen: buch.themen.length,
                    von: buch.zeitraum.von,
                    bis: buch.zeitraum.bis,
                  })
                : null}
          </p>
          {ausgelassen.length > 0 ? (
            <div className="text-[12px] text-muted-2" data-testid="vermaechtnis-ausgelassen">
              <div>{t("vermaechtnis.ausgelassen")}</div>
              <ul className="list-disc pl-5">
                {ausgelassen.map((zeile) => (
                  <li key={zeile}>{zeile}</li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="outline" data-testid="vermaechtnis-download" onClick={herunterladen}>
              <Download size={15} />
              {t("vermaechtnis.download")}
            </Button>
            <Button variant="ghost" data-testid="vermaechtnis-drucken" onClick={drucken}>
              <Printer size={15} />
              {t("vermaechtnis.drucken")}
            </Button>
          </div>
          <pre
            data-testid="vermaechtnis-vorschau"
            className="print-area max-h-80 overflow-auto whitespace-pre-wrap rounded-input bg-page p-3 text-[12.5px] text-text print:max-h-none print:overflow-visible print:bg-transparent"
          >
            {buch.markdown}
          </pre>
        </div>
      ) : null}
    </div>
  );
}
