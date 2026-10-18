# Minecraft-Whitelist

## RCON-Vertrag und Frontend-Anpassung (18.10.2026)

Vor der Implementierung wurden im lokalen Backend `C:/Dev/Gameserver_Dashboard`
die Dateien `docs/MINECRAFT_RCON_SYNC_FIX.md`,
`src/minecraft/minecraft.service.ts` und `src/minecraft/rcon.service.ts` gelesen.
Für diese Integration bestehen keine offenen Vertragsfragen. Die Referenzkomponente
unter `docs/frontend` des Backends ist laut Backend-Dokumentation veraltet.

- GET liefert den gespeicherten Zustand, keinen unmittelbaren RCON-Listenaufruf.
  „Status erneut prüfen“ lädt diesen Zustand erneut; der Backend-Worker führt
  den tatsächlichen Abgleich aus. Es gibt keinen neuen Prüfendpunkt.
- `minecraft.whitelistState`: `WHITELISTED`, `NOT_WHITELISTED`, `UNKNOWN`.
  Fehlende oder unbekannte Werte und veraltete Daten werden vorsichtig als unbekannt
  angezeigt. `minecraft.status` wird nicht mehr als Whitelist-Beobachtung verwendet.
- POST `/whitelist` und `/unlink` liefern zusätzlich `operation` mit `action`
  (`ADD`, `REMOVE`), `outcome` (`SUCCEEDED`, `ALREADY_IN_STATE`, `NOT_REQUIRED`,
  `NOT_ATTEMPTED`), `whitelistState` und `syncErrorCode`. HTTP 201 allein ist kein
  Nachweis einer Freischaltung. Das Aufrufergebnis bleibt beim folgenden GET erhalten.
- `minecraft.lastCommand` ist null oder enthält `action`, `outcome`
  (`SUCCEEDED`, `ALREADY_IN_STATE`, `FAILED`, `UNKNOWN`) und `at`.
  Es wird als historischer letzter Schreibbefehl getrennt vom aktuellen Zustand gezeigt.
- `syncErrorCode` beschreibt den Listenabgleich, `lastErrorCode` den
  Verarbeitungsfehler. Codes stehen nur im aufklappbaren Diagnosebereich.
- HTTP 503 `RCON_COMMAND_FAILED` bedeutet Ablehnung; `RCON_UNAVAILABLE` und
  `RCON_COMMAND_UNCONFIRMED` bedeuten unbestätigte Ausführung. Nach Fehlern wird
  nur gelesen, niemals automatisch erneut geschrieben.
- Bestätigter Schreibbefehl plus unbekannte Beobachtung ergibt eine neutrale
  Bestätigung mit Hinweis auf die fehlende Statusprüfung, keinen Fehlerdialog.
  Dies gilt auch für REMOVE, solange `removing=true` und die Zuordnung reserviert bleibt.
  Bei `minecraft=null` wird die Entfernung anhand von `operation` eingeordnet.

Eine synchrone Anfragesperre verhindert doppelte Aktionen. Während der Verarbeitung
sind die Aktionen deaktiviert und ein Ladehinweis sichtbar. Das bestehende responsive
Layout bleibt erhalten. Tests prüfen die drei Zustände, alle vier Operation-Outcomes,
HTTP-Befehlsfehler, unbekannte Ausführung, POST-Bestätigung trotz GET-Ausfall,
persistierte Remove-Bestätigung und doppelte Klicks. Alle Backend-Antworten werden
lokal simuliert; keine produktiven RCON-Befehle werden für Tests ausgeführt.

Verifikation dieser Anpassung: vollständige Suite mit 179 Tests erfolgreich;
anschließend zusätzlicher Mismatch-Test ergänzt und alle 29 MinecraftAccess-Tests
erneut erfolgreich. Typecheck und Produktionsbuild erfolgreich. Der zusätzliche
Browserlauf `npm run test:browser -- --minecraft-only` scheiterte bei `Page.enable`
mit einem CDP-Timeout, bevor UI-Prüfungen stattfanden. Die vorhandenen früheren
Browserartefakte wurden nicht durch diesen fehlgeschlagenen Lauf ersetzt.

## Ursprüngliche Integration

Der Gameserver-Manager enthält einen zusätzlichen Reiter „Minecraft-Zugang“.
MinecraftAccessPanel nutzt die vorhandene Better-Auth-Sitzung und öffnet Anmeldung
oder Kontoeinstellungen über useAuthWindow. Keine zweite Anmeldung oder OAuth-Konfiguration.
Die privaten API-URLs übernehmen Origin und Prefix aus REACT_APP_AUTH_API_BASE_URL.

Neue Dateien unter src/apps/GameserverManager: MinecraftAccess.tsx,
MinecraftAccessPanel.tsx, minecraft-access.css, MinecraftAccess.test.tsx.
GameserverManager.tsx bindet den Reiter ein und berücksichtigt ihn bei der Tastaturnavigation.
scripts/browser-auth-smoke.cjs prüft zusätzlich den nativen Discord-Fehlerdialog auf Desktop und 320px.

Backend-Konfiguration: MINECRAFT_WHITELIST_ENABLED bleibt standardmäßig false.
DISCORD_GUILD_ID und DISCORD_BOT_TOKEN sind laut Betreiber noch nicht bestätigt.
RCON_HOST=172.18.0.1, RCON_PORT=25576, RCON_PASSWORD nur im Backend setzen.
Keine dieser geheimen Variablen mit REACT_APP_ ins Frontend übernehmen.
Ohne erfolgreiche frische Discord-Prüfung gibt es keine Freischaltung.

Das Backend liegt unter C:/Dev/Gameserver_Dashboard. Dessen
docs/MINECRAFT_WHITELIST_DEPLOYMENT.md dokumentiert Migration, API, Secrets und Abnahme.
Der Browser nutzt GET /me/minecraft sowie POST /link, /check-discord, /whitelist, /unlink
unter derselben Basis. Fehlerdialoge zeigen strukturierte Backend-Meldungen;
DISCORD_NOT_LINKED öffnet den geforderten Dialog mit „Discord verknüpfen“ und „Abbrechen“.
Öffentliche Namensauflösung bestätigt keinen Minecraft-Accountbesitz.

Prüfen: npm run typecheck, npm run lint, npm run test:ci, npm run build,
npm run test:browser (standardmäßig vollständig lokal abgefangene API-Aufrufe).
Kein Deployment und keine Produktivschreibzugriffe wurden autorisiert oder ausgeführt.

Abnahme am 18.10.2026: Typecheck, Lint, 154 Tests und Produktionsbuild bestanden.
Die gezielte Browserprüfung npm run test:browser -- --minecraft-only bestand
einschließlich nativem Dialog, Fokusfalle und 320px-Breite von Panel und Dialog.
Screenshots und Bericht: docs/browser-artifacts/minecraft-discord-desktop.png,
minecraft-discord-mobile.png und results-minecraft.json.
Der allgemeine Browserlauf ohne Flag scheitert an der bereits vorhandenen
320px-Taschenrechnerprüfung, bevor der neue Minecraft-Abschnitt erreicht wird.
Die bisherigen App-Prüfungen bleiben im Standardlauf aktiv. Das neue Flag lässt
nur diesen fremden App-Rundgang aus; Auth- und Minecraft-Prüfungen bleiben aktiv.
Alle Requests wurden lokal abgefangen, keine Live-API-Schreibzugriffe.
