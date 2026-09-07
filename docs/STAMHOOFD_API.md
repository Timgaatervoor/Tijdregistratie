# Stamhoofd API-integratie

De app kan Stamhoofd rechtstreeks via een **lokale koppeling op jouw computer** synchroniseren. Hiervoor is geen Cloudflare-account, Worker URL of aparte toegangscode nodig. De Cloudflare Worker blijft een optionele oplossing voor gebruik vanuit GitHub Pages. Deelnemers, optionele ticketgegevens, veldkeuzes en syncverslagen worden lokaal opgeslagen in dezelfde Dexie-database. Start, finish en schieten gebruiken geen van beide koppelingen. CSV/Excel-import blijft beschikbaar.

## Lokaal gebruiken (aanbevolen)

1. Start de bijgewerkte app via `start-windows.bat` of `start-mac-linux.sh`. Als de app al draait, sluit het startvenster en start opnieuw. De lokale koppeling start automatisch mee; je hoeft geen extra server of Cloudflare in te stellen.
2. Open `http://localhost:3000` en ga naar **Deelnemers → Stamhoofd API**. Kies **Op deze computer — geen Cloudflare nodig**.
3. Vul het webshopdomein in, klik **Zoek webshops**, selecteer de webshop en klik **Gebruik deze webshop**. Zoeken vereist geen API-key.
4. Vul je aparte read-only Stamhoofd API-key in bij **Stamhoofd API-key voor deze aanvraag** en klik **Beschikbare gegevens ophalen**. De key wordt alleen gebruikt voor deze ophaalaanvraag, inclusief alle pagina’s met orders en tickets. Het veld wordt na afloop leeggemaakt, ook bij een fout. Voor een nieuwe ophaalaanvraag voer je de key opnieuw in.
5. Kies velden en categorieën, bekijk de preview en pas de synchronisatie toe. Deze lokale verwerking heeft geen key nodig. Dit is dezelfde veilige import als bij de optionele Worker.

De key wordt niet opgeslagen: niet in een bestand, Git, IndexedDB, localStorage, backups of de productiebuild. Hij bestaat tijdelijk in het invoerveld en tijdens de ophaalaanvraag. Een volgende aanvraag kan de vorige key niet hergebruiken. Als je met een oudere versie al `.env.stamhoofd.local` had aangemaakt, kun je dat bestand verwijderen; deze versie leest of schrijft het niet meer.

De key gaat in de POST-body alleen naar de lokale server op jouw computer. Die server voegt hem voor deze aanvraag toe aan HTTPS-aanvragen naar Stamhoofd en retourneert hem nooit. Je hebt geen Worker URL of Worker-toegangscode nodig. De koppeling weigert netwerkclients, vreemde Host/Origin-headers en aanvragen zonder de lokale appheader. De key wordt nooit in een URL geplaatst of gelogd.

Gebruik de app op dezelfde computer via `localhost`, niet via een LAN-adres of GitHub Pages. Voor tablets/andere computers kun je de bestaande deelnemerbackup overzetten of de optionele Worker gebruiken. Bestaande browsergegevens op GitHub Pages en localhost zijn gescheiden: zet indien nodig eerst je wedstrijdbackup over via de bestaande herstelfunctie.

Technisch draait `server/stamhoofdLocal.ts` mee met `npm run dev` en `npm run preview`. De lokale route `/api/stamhoofd` hergebruikt de geteste Worker-code voor endpoints, organisatiebeperking en paginering. Alleen `POST /api/stamhoofd/sync` accepteert een key; `GET /api/stamhoofd/webshop/search` gebruikt de publieke webshopzoekfunctie zonder key. Geen enkele start-, finish- of schietactie gebruikt deze route.

## Optioneel: Worker installeren voor GitHub Pages

1. Maak in Stamhoofd via **Instellingen → Experimenten → API-keys** een aparte API-key voor deze toepassing. Geef uitsluitend leesrechten op de benodigde webshop, orders, betalingsgegevens en private tickets. Bewaar de key in een wachtwoordmanager. Zie [Stamhoofd API-documentatie](https://www.stamhoofd.be/docs/api/).
2. Maak een Cloudflare-account aan en installeer/gebruik Wrangler. Voer vanuit de repository uit: `npx wrangler login`. De Worker staat in `worker/index.ts`; `worker/wrangler.toml` is de voorbeeldconfiguratie en kan direct worden gebruikt.
3. Controleer `worker/wrangler.toml`: organisatie `af201d93-dcd6-4cfe-bfc7-ed3d2a209236`, versie `v417`, productie-origin `https://timgaatervoor.github.io` (een origin bevat geen `/Tijdregistratie/`-pad). Een andere organisatie vereist aanpassen van deze serverconfiguratie en een bijbehorende read-only key. Webshops binnen de organisatie zijn vrij selecteerbaar.
4. Voeg encrypted secrets toe via de interactieve invoer van Wrangler:

   ```sh
   npx wrangler secret put STAMHOOFD_API_KEY --config worker/wrangler.toml
   npx wrangler secret put SYNC_ACCESS_TOKEN --config worker/wrangler.toml
   ```

   Maak voor `SYNC_ACCESS_TOKEN` een **andere**, willekeurige toegangscode van minstens 32 tekens, bij voorkeur 32 willekeurige bytes via een wachtwoordmanager. Deel deze alleen met bevoegde wedstrijdbeheerders. Deze code beschermt toegang tot de privé-inschrijvingen; CORS op zichzelf is geen authenticatie. De frontend stuurt uitsluitend deze aparte code naar de Worker. De Stamhoofd API-key verlaat de Worker nooit. Zet geen van beide secrets in commandoargumenten, Git, `.env`, Pages-instellingen of frontendbroncode.
5. Deploy de Worker:

   ```sh
   npx wrangler deploy --config worker/wrangler.toml
   ```

   Neem de `https://...workers.dev`-URL over. Er wordt vanuit deze repository geen Worker automatisch gedeployed. Voor grote webshops: kies een Cloudflare-plan met voldoende subrequests per Worker-aanvraag; een volledige sync kan ruim 100 upstream-aanvragen gebruiken. Controleer de actuele limieten in [Cloudflare Workers limits](https://developers.cloudflare.com/workers/platform/limits/). Stamhoofd-aanvragen worden opeenvolgend uitgevoerd met ongeveer één aanvraag per seconde; voer geen gelijktijdige syncs vanaf meerdere toestellen uit.

## Gebruik met de optionele Worker

6. Open **Deelnemers → Stamhoofd API** en kies **Cloudflare Worker (optioneel)**. Vul de Worker URL, het webshopdomein (bijvoorbeeld `shop.kidsatletiekdehaan.be`) en de aparte Worker-toegangscode in. Deze toegangscode blijft alleen in het geheugen tot het venster sluit; hij wordt niet opgeslagen. Vul in het Worker-toegangscodeveld nooit de Stamhoofd API-key in.
7. Kies **Zoek webshops**, selecteer de naam/domein/ID en druk **Gebruik deze webshop**. Het domein kan meerdere open webshops opleveren. De huidige webshop kan worden herkend aan `603e808b-9ac6-47cb-933c-bf7b4c66f357`; dit ID is niet hardcoded in de integratie. Als een webshop niet gevonden wordt, controleer domein, publicatie en de serverorganisatie.
8. Kies **Beschikbare gegevens ophalen**. De Worker haalt webshopconfiguratie, alle orders en alle private tickets op. Stel de gewenste velden in. Namen worden automatisch herkend met dezelfde veldnaamsynoniemen als de bestaande CSV-parser; afwijkende velden kun je expliciet kiezen op ID. Koppel ieder product aan een bestaande categorie met een wedstrijdprofiel voor nieuwe deelnemers. Nieuwe deelnemers hebben nog geen borstnummer of wave.
9. Kies **Configuratie bewaren en preview tonen**. Controleer aantallen, namen, geboortedata, afstand, bestelling, betaling, ticket en lokale status. Niet-betaalde/onbekende betalingen zijn standaard niet geselecteerd; selecteer deze alleen na controle. De status Betaald vereist dat alle gevonden betalingen Succeeded zijn; dit is geen financiële reconciliatie. Bij twijfel controleer de bestelling in Stamhoofd. Items met meerdere personen/tickets of ontbrekende namen worden geblokkeerd om onjuiste koppelingen te voorkomen.
10. Kies **Synchronisatie toepassen**. Alleen geselecteerde rijen worden verwerkt. De database-transactie schrijft deelnemers, configuratie en het `STAMHOOFD_SYNC`-auditverslag samen. Sluit het venster en zoek een deelnemer op naam, borstnummer of ticket secret. Een volledige ticket-URL kan ook als zoektekst worden gebruikt. In het deelnemersdetail staat **Open ticket**.
11. Controleer offline werking: laad de app eenmaal online tot de service worker gereed is, verbreek internet en heropen de app. Deelnemers, zoeken, start, finish en schieten moeten beschikbaar blijven. Gebruik voor een echte wedstrijd de bestaande backupfunctie. Backups bevatten geselecteerde persoonsgegevens en ticketcodes: bewaar ze zorgvuldig. De Stamhoofd-configuratie wordt meegenomen in nieuwe backups; oude backups blijven leesbaar.

## Gegevensveiligheid en synchronisatiegedrag

- `ticket.secret ≠ borstnummer`. De ticketlink wordt `https://<geselecteerd-domein>/tickets/<secret>`. Een scan in het zoekveld zoekt alleen; er wordt geen start of finish geregistreerd.
- De technische sleutel is lokaal evenement + organisatie + webshop + `itemId`; tickets koppelen via `itemId` en bijbehorend `orderId`. Order- en item-ID zijn verplicht, ook bij minimale veldselectie. Namen/geboortedata worden niet als syncsleutel gebruikt. Bestaande CSV-deelnemers worden niet automatisch aan API-deelnemers gekoppeld; controleer dit bij de eerste API-import om dubbele personen te voorkomen.
- Alleen orders met `Created` gelden als actief; alleen tickets met expliciet `deletedAt: null` worden als actief gebruikt. Annuleringen krijgen een aparte inactiefmarkering. Ook deelnemers zonder wedstrijdgegevens worden nooit hard verwijderd door sync. De lokale wedstrijdstatus blijft behouden. Een ontbrekende order alleen is onvoldoende bewijs van annulering en levert een waarschuwing op.
- Borstnummer, wave, categorie/profiel van bestaande deelnemers, status, opmerkingen, timing, schietresultaten, audit en correcties worden niet overschreven. Voor naam/contact/geboortedatum wordt de laatst geïmporteerde waarde bijgehouden: handmatig gewijzigde lokale waarden blijven staan. De actuele bronwaarden blijven zichtbaar in de preview.
- Alleen geselecteerde optionele velden worden opgeslagen. Uitvinken verwijdert de opgeslagen optionele bronwaarde bij de volgende toegepaste sync. Een niet handmatig aangepaste lokale optionele naam/contactwaarde wordt eveneens verwijderd; verplichte lokale namen blijven bestaan. Reeds gemaakte backups en auditverslagen worden niet herschreven.
- Sync is een volledige snapshot met `next.pageFilter`-paginering; maximaal 5000 orders en 5000 tickets. Een fout of limiet geeft geen gedeeltelijk toepasbare snapshot. Ophalen wijzigt geen deelnemers. Er zijn geen automatische achtergrondverzoeken naar Stamhoofd.
- De Worker staat alleen GET/OPTIONS toe, controleert origin en toegangscode, fixeert upstreamhost/organisatie en volgt geen externe redirects/cursor-URL’s. Responses zijn `no-store`; er worden geen ruwe upstreamfouten of credentials gelogd. Er wordt geen ruwe snapshot in IndexedDB bewaard.

## Fouten en onderhoud

Worker niet bereikbaar kan wijzen op netwerk, timeout of CORS: de browser kan deze oorzaken niet betrouwbaar onderscheiden. Controleer de productie-origin, HTTPS-URL en deployment. Voor lokale frontendtests kun je een aparte test-Worker gebruiken met `ALLOWED_ORIGIN = "http://localhost:3000"`; wijzig daarvoor niet de productie-Worker. Ongeldige API-key of ontoereikende rechten moeten server-side worden hersteld. Verander de API-versie centraal in `wrangler.toml` wanneer Stamhoofd die vereist.

De endpoints en paginationstructuur zijn gecontroleerd aan de [publieke Stamhoofd-broncode](https://github.com/stamhoofd/stamhoofd): `GetWebshopFromDomainEndpoint`, `GetWebshopOrdersEndpoint`, `GetWebshopTicketsEndpoint` en `PaginatedResponse`. Een live eindtest vereist je eigen gedeployde Worker en secrets. De historische aantallen van 7 september zijn geen testasserties.

## Ontwikkelcontrole

```sh
npm install
npm run lint
npm run typecheck
npm test
npm run build
npm run check:secrets
```

Op Windows PowerShell met geblokkeerde scripts kun je `npm.cmd` gebruiken. Tests gebruiken `fake-indexeddb` in Node-geheugen met een aparte testdatabasenaam. Ze controleren normalisatie, item/ticketkoppeling, annuleringen, betaling, veilige upsert, pagination, Worker-beveiliging, v2→v3-migratie, CSV-import en de bestaande failsafe-suite. De migratie voegt alleen optionele velden/indexen en een configuratietabel toe.

Er is tijdens ontwikkeling geen echte Stamhoofd API-key verstrekt. Daarom is geen vergelijking met die onbekende key mogelijk. Gebruik voor de lokale koppeling alleen het hiervoor bedoelde invoerveld; bij Worker-deployment uitsluitend `wrangler secret put`. Frontend/build/history worden op secretpatronen gecontroleerd; een patrooncontrole is geen bewijs over een onbekende geheime waarde. De lokale tests gebruiken fictieve keys en controleren keyloos zoeken, upstream-authenticatie per aanvraag, het ontbreken van hergebruik na succes/fouten en blokkering van LAN/cross-origin-aanvragen.
