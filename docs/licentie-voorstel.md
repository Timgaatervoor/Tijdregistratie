# Voorstel: eenvoudige offline licentie en proefmodus

Status: voorstel, nog niet ingebouwd. Branch: `feature/licentie-proefmodus`.

## Uitgangspunt

Iedereen mag het installatiebestand downloaden. Zonder geldige toegangsleutel werkt de app in proefmodus: maximaal 1 uur gebruik, 10 deelnemers en 5 startgroepen. Licentiecontrole werkt lokaal en gebruikt nooit de Supabase van een gebruiker. Er is geen account of eigen licentieserver nodig.

## Voorgesteld gedrag

- De proefperiode begint na klikken op ‘Proefversie starten’.
- Het uur is 60 minuten totale looptijd van de geopende app per installatie, verdeeld over sessies. Sluiten pauzeert de teller; herstarten, vernieuwen of een nieuw evenement starten reset hem niet. Meerdere vensters tellen niet dubbel. Een open venster op de achtergrond telt mee.
- Maximaal 10 deelnemers en 5 startgroepen in het huidige evenement. Handmatig invoeren, Excel/Stamhoofd-import, automatisch indelen, herstel en toestelkoppeling volgen dezelfde grenzen. Geen stille verwijdering of gedeeltelijke import om onder de limiet te blijven.
- Na het uur stoppen nieuwe wedstrijdregistraties en wijzigingen. Bestaande gegevens bekijken, exporteren/back-uppen, een licentie aanvragen en activeren blijven mogelijk. Toon vooraf waarschuwingen bij 15 en 5 resterende minuten.
- Een geldige licentie heft alle drie de proefbeperkingen op, binnen de normale technische capaciteit van de app.
- Bewaar proefstatus en licentie afzonderlijk van wedstrijdback-ups. Een back-up of koppeling draagt geen licentie over. Als bestaande gegevens boven de proeflimieten liggen, blijven ze behouden en wordt de app alleen-lezen tot activatie.

## Aanvragen en handmatig uitgeven

1. De gebruiker kiest ‘Toegangssleutel aanvragen’ en vult naam, club/organisatie en e-mailadres in.
2. De app opent een vooraf ingevuld bericht aan info@kidsatletiekdehaan.be. De gebruiker verstuurt het zelf. Bied ook ‘Aanvraag kopiëren’ voor webmail aan.
3. De beheerder gebruikt een afzonderlijk lokaal hulpprogramma om voor die organisatie een licentiebestand en plakbare sleutel te maken.
4. De beheerder mailt de sleutel of het bestand terug. De gebruiker kiest ‘Toegangssleutel invoeren’ of ‘Licentiebestand openen’.
5. De app controleert de digitale handtekening en toont de naam van de licentiehouder.

Voor de eerste versie: een blijvende organisatielicentie, bruikbaar op de wedstrijdtoestellen van die club. Geen hardwarebinding, toesteladministratie of verplichte online activatie. Ieder toestel activeert dezelfde organisatiesleutel zelf. Daardoor is doorgeven technisch mogelijk; een zichtbare licentiehouder maakt duidelijk aan wie de sleutel is uitgegeven.

## Ondertekening

Gebruik asymmetrische digitale handtekeningen. De licentie bevat formaatversie, product-ID, licentie-ID, organisatie, contactadres, uitgiftedatum en toegestane functies. De app bevat alleen de publieke controlesleutel. De geheime ondertekeningssleutel blijft uitsluitend bij de beheerder, buiten Git, downloads en wedstrijdback-ups, met een afzonderlijke beveiligde reservekopie.

Het uitgiftehulpmiddel behoort niet tot de openbare distributie. Houd een eenvoudig lokaal uitgifteregister bij. Zonder centrale controle is directe intrekking van een reeds uitgegeven offline licentie niet mogelijk.

## Private broncode, openbare downloads

Gebruik twee repositories:

- Private ontwikkelrepository: broncode en buildconfiguratie.
- Openbare downloadrepository: korte handleiding, wijzigingslog en GitHub Releases met installatiebestanden. Geen volledige ontwikkel-ZIP of geheime sleutels.

Een Windows-installatiebestand is voor eindgebruikers eenvoudiger dan broncode met Node.js en een startscript. De bestaande branch `electron-exe` kan hiervoor eerst worden beoordeeld. Start met handmatig bouwen en uploaden; automatische publicatie kan later.

GitHub Releases kunnen gecompileerde programma's als bestanden aanbieden:
https://docs.github.com/en/repositories/releasing-projects-on-github/managing-releases-in-a-repository

Releases uit een private repository zijn niet algemeen toegankelijk. Gebruik daarom de aparte openbare repository voor distributie:
https://docs.github.com/en/rest/releases/releases

## Grenzen van deze eenvoudige aanpak

Volledig lokale software kan worden aangepast en lokale proefstatus kan door wissen of herinstallatie worden omzeild. Ondertekende licenties voorkomen het zelf maken van geldige sleutels, maar maken de app niet onkraakbaar. Een desktopinstallatie biedt een stabielere opslagplaats dan uitsluitend browseropslag, zonder dit volledig te verhelpen. Het achteraf private maken van Git verwijdert geen eerder gedownloade broncode.

## Uitvoeringsvolgorde

1. Gemeenschappelijke licentiecontrole, lokale proefstatus en grenzen op alle invoer- en registratiepaden.
2. Scherm voor proefstatus, aanvragen en activeren.
3. Afzonderlijk uitgiftehulpmiddel en controle op vervalste/verkeerde licenties.
4. Tests voor herstarten, meerdere vensters, import, herstel, koppeling en het verstrijken van de proeftijd tijdens een wedstrijdregistratie.
5. Desktopdistributie voorbereiden en openbare downloadrepository inrichten.
