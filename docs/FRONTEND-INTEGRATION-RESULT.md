# Frontend-Integration: Abnahme vom 16.10.2026

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

Produktive Lesepruefungen ergaben im Browser sowohl 200 null fuer get-session
als auch zwischenzeitlich HTTP 500 und abgebrochene/zeitueberschrittene Requests.
Das aktuelle [Liveprotokoll](browser-artifacts/results-live.json) besteht deshalb
nicht vollstaendig: Session-Lesepruefung und einzelne Browser-OPTIONS sind dort
nicht erfolgreich. Der anonyme Profilzugriff wird korrekt mit 401 abgewiesen.
Die 13 lokalen Browser-Assertions bestehen auch in diesem Lauf.

Eine separate, begrenzte HTTP-Gegenpruefung lieferte anschliessend dreimal
200 null fuer get-session, jeweils mit exakter CORS-Origin und Credentials.
Die echten POST-Preflights (OPTIONS mit Access-Control-Request-Method: POST)
fuer Profil und Registrierung lieferten 204, erlauben Content-Type und
GET/POST/OPTIONS. [Gegenpruefung](browser-artifacts/readonly-http-checks.json).
Ein dauerhafter Backend-/CORS-Defekt ist damit nicht nachgewiesen. Die Ursache
der zwischenzeitlichen Browserfehler ist ohne weitere Betriebsdaten nicht
abgesichert; eine durchgehend erfolgreiche Live-Abnahme liegt noch nicht vor.
Das Frontend behandelt diese Fehler ohne Abmeldung einer gueltigen Session.
Keine Backend-Aenderung vorgenommen.

Reale Registrierung, Mail-Verifikation, Passwortreset, authentifiziertes Profil,
Sessioncookie-Erneuerung und Discord-Callback bleiben ohne freigegebenes Testkonto
bzw. Mailversand nicht produktiv end-to-end abgenommen. Weitere Browserengines
wurden nicht getestet.

Build-Hinweis: CRA meldet veraltete Browserslist-Daten; Build und Lint bestehen.
Keine automatische Aktualisierung der Abhaengigkeiten. Keine Veroeffentlichung,
kein Push und keine produktive Backend-Aenderung.
