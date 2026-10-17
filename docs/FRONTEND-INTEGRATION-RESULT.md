# Frontend-Integration: Abnahme aktualisiert am 17.10.2026

Backend-Vertrag aus Commit `03030cce4409eec9a347998feeea71062affd5fb`
ueber `git show` im Backend-Checkout gelesen. Die Vertragskopien im Frontend
bleiben unveraendert. Eine veraltete Passage des Vertrags empfiehlt noch eine
Namensaenderung nach Discord-Login; massgeblich sind das neue Modell und die
Route-Tabelle: `/update-user` bleibt gesperrt. Es gibt keinen Namenseditor.

## Fertiger lokaler Stand

Registrierung sendet ausschliesslich `name`, `email`, `password`, `callbackURL`.
Login bleibt E-Mail/Passwort oder Discord. Name unveraenderlich, doppelte Namen
erlaubt; die ID wird im Konto angezeigt. Verifikation ist kein automatischer Login.
Alle neun dokumentierten Kontaktfelder sind optional ueber GET/POST
`/games/api/v1/me/profile` integriert, mit derselben Cookie-Session. Keine
Admin-Profilendpunkte fuer das eigene Konto, keine erfundenen Routen.
Land, Telefon und Kontakt-E-Mail ergaenzen die bereits vorhandenen sechs Felder.
Die Kontakt-E-Mail aendert die Login-E-Mail nicht. Leere Werte senden null.

Netzwerk/5xx behalten Session und Entwurf, echte 401 bzw. 200 null entfernen die
Identitaet. Veraltete Accountlisten-Antworten einer vorherigen Benutzer-ID koennen
ein neues Konto nicht mehr abmelden. Registrierung/Profil und die vorhandenen
Windows-98-Meldungsdialoge sind unveraendert in die Desktop-Oberflaeche eingebettet.
Doppelten postbuild-Eintrag in package.json bereinigt; reproduzierbare lokale
Scripts typecheck, lint und test:ci ergaenzt. Keine neuen Abhaengigkeiten.

## Automatisierte Pruefung

- `npm run test:ci`: 6 Suiten, 141 Tests erfolgreich.
- `npm run typecheck`: erfolgreich.
- `npm run lint`: erfolgreich, keine Warnungen.
- `npm run build`: erfolgreich; inklusive aller fuenf statischen Auth-Seiten.
- `node scripts/browser-auth-smoke.cjs`: 13 Browserpruefungen erfolgreich.

Der Produktionsbuild wurde in isoliertem Headless Chrome 155 unter der realen
Frontend-Origin geladen, indem ausschliesslich die Frontend-Dateien lokal
abgefangen wurden. Keine Veroeffentlichung. Browsernachweise liegen unter
[Offline-Ergebnis](browser-artifacts/results-offline.json) und
[Live-Ergebnis](browser-artifacts/results-live.json) und
[Kontofenster](browser-artifacts/account-desktop.png).
Geprueft: Registrierung, Verifikationsrueckkehr mit anschliessendem Login,
unveraenderlicher Name/ID, privates Profil speichern/Reload, Session bei 503 und
Offline, 401-Bereinigung, Logout, Discord-Start und erlaubte Weiterleitung,
vollstaendig im Viewport liegendes Kontofenster bei 320px nach Korrektur der Fensterpositionierung. Alle schreibenden API-Aktionen und die
Discord-Providerseite waren lokal simuliert. Die Browsertests ersetzen keine
reale SMTP-Zustellung oder echte Provider-Anmeldung.

## Reale Produktionspruefung und Blocker

Mit `--live` sind ausschliesslich anonyme GET-Anfragen fuer get-session/me/profile
und OPTIONS fuer dokumentierte Auth-/Profilrouten gegen Produktion freigegeben.
Alle anderen Aufrufe werden abgefangen oder blockiert. Frisches Browserprofil,
keine produktiven Cookies, Konten, Testdaten oder Mails.

Die erneute Browserpruefung am 17.10.2026 war erfolgreich (Exitcode 0):
get-session liefert 200 null mit no-store, das eigene Profil anonym 401 mit
no-store. Alle sechs geprueften Auth-/Profil-OPTIONS liefern 204 und sind unter
der echten Frontend-Origin im Browser lesbar. Die beiden Live-Lesepruefungen,
die OPTIONS-Pruefung sowie alle 13 lokalen Browser-Assertions bestehen.
Das [aktuelle Liveprotokoll](browser-artifacts/results-live.json) enthaelt
Start-/Endzeit und den geprueften Build `main.7dd5da45.js`.

Der Browser-Test hatte selbst noch zwei Probleme: Die lokal abgefangene
Discord-Navigation setzte ihren Erfolgsmarker nicht, und die Live-Requests
hatten sehr kurze Zeitlimits. Der Marker wird nun beim Abfangen gesetzt;
jede Live-Anfrage hat ein eigenes begrenztes Zeitfenster von acht Sekunden.
Das gesamte Runtime-Kommando muss nicht mehr mehrere Live-Anfragen gemeinsam
innerhalb seines Zeitlimits abschliessen. Kein Produktivzugriff wird dadurch
ausgeweitet: nur die bisherigen anonymen GET-/OPTIONS-Routen sind erlaubt.

Die Fehler vom 16.10. (zwischenzeitlich 500/Timeouts) bleiben eine historische
Beobachtung, sind im aktuellen Lauf nicht reproduziert. Ein dauerhafter
Backend-/CORS-Defekt wurde nicht nachgewiesen. Einzelne abgebrochene bzw.
absichtlich blockierte Netzwerkereignisse im Diagnoseprotokoll sind keine
fehlgeschlagenen Ergebnispruefungen. Die separate damalige HTTP-Gegenpruefung
ist unter [Gegenpruefung](browser-artifacts/readonly-http-checks.json) erhalten.
Keine Backend-Aenderung vorgenommen.

Reale Registrierung, Mail-Verifikation, Passwortreset, authentifiziertes Profil,
Sessioncookie-Erneuerung und Discord-Callback bleiben ohne freigegebenes Testkonto
bzw. Mailversand nicht produktiv end-to-end abgenommen. Weitere Browserengines
wurden nicht getestet.

Build-Hinweis: CRA meldet veraltete Browserslist-Daten; Build und Lint bestehen.
Keine automatische Aktualisierung der Abhaengigkeiten. Keine Veroeffentlichung,
kein Push und keine produktive Backend-Aenderung.
