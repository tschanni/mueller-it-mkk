# Minecraft-Zugang

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
