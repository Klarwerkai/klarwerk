# Widersprüche & Auffälligkeiten

Widersprüchliche oder auffällige Aussagen zwischen Agenten/Quellen. Zu klären / gegen Repo+Jira prüfen.

## C-01 — Mehrere getrennte Repos & Jira-Projekte (Multi-Repo-Struktur)
Zentrale Struktur-Erkenntnis (kein echter Widerspruch): KLARWERK ist auf **mehrere Repos + Jira-Projekte** verteilt.
Jedes Team pflegt ein eigenes `docs/TEAM6_UPDATE.md`. Beim Zwischenbericht sauber trennen.

| Team | Repo | Remote | Jira | Domäne |
|------|------|--------|------|--------|
| Team 1 | `dev_Klarwerk` | `Klarwerkai/klarwerk` | `SCRUM` | Produktkern / Knowledge OS |
| Team 3 | `klarwerk-business-backend` | `Klarwerkai/klarwerk-business-backend` | `KBB` | Business/Pilot-Blueprint (nur Doku) |
| Team 4 | `klarwerk-public-website` | `Klarwerkai/klarwerk-public-website` | `KWEB` | Öffentliche Marketing-Website |
| Team 5 | `klarwerk-release-ops` | `Klarwerkai/klarwerk-release-ops` | `KREL` | Release Ops / Beta QA / Deployment Readiness |
| Team 6 | `klarwerk-knowledge-guru` | (Klarwerkai) | `KGURU` | Gap-Kontrolle / Pflichtenheft (read-only Zweitprüfung) |
| Team 7 | `KLARWERK_Reporting_PMO` (lokal, **kein Git/Jira**) | — | — | Reporting-PMO / Dashboard (nur lokal, read-only Aggregation) |

Team 7 aggregiert read-only aus 8 Quellen (die `TEAM6_UPDATE.md` von Team 1/3/4/5 + 4 Team-6-Docs + Master-Scope-JSON)
und exportiert eine Review-Queue an Team 6. Team 6 bleibt „Quelle der Wahrheit".

**Korrektur einer früheren Annahme:** Team 6 hat sehr wohl ein **eigenes Repo** (`klarwerk-knowledge-guru`) mit
eigenen lebenden Registern. Die `docs/TEAM6_UPDATE.md`-Dateien in den anderen Repos sind nur Eingangskanal —
Team 6 wertet sie ausdrücklich **nur als Eigenangabe, nicht als Beleg**; verbindlich sind Team-6-eigene Register
und geprüfte fixe Commits (`git show`).

## C-02 — Fehlende Decision-Log-Einträge (Team 3)
- D-010 (Legal/DPA) und D-011 (Commercial/Billing) werden in Beta-Docs durchgängig referenziert, fehlen aber
  als Einträge in `docs/DECISIONS.md`. Auch D-005/006/007 fehlen (Nummerierungslücke).
- Status: **von Team 3 selbst als Widerspruch gemeldet.** Zu verifizieren + ggf. Nachtrag (nur Pedi/Codex).

## Muster über Teams hinweg
- **Snapshot-Drift** in `TEAM6_UPDATE.md`: sowohl Team 1 als auch Team 3 berichten, dass Snapshot-/Commit-Zeilen
  dem echten HEAD hinterherlaufen oder „pending" bleiben. → `TEAM6_UPDATE.md`-Angaben immer gegen `git log` prüfen.
- **Rollentrennung identisch:** In beiden Repos gilt: Claude = Executor (Text/Code), **Codex** = Git/Jira/Verify,
  **Pedi** = alle materiellen Freigaben.
