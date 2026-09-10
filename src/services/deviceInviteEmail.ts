export function deviceInviteEmail(invitation: { link: string; code: string }) {
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(new URL(invitation.link).hostname);
  const subject = 'Tijdregistratie: tweede toestel koppelen';
  const body = [
    'Open deze koppellink op het tweede toestel:',
    invitation.link,
    '',
    `Koppelcode: ${invitation.code}`,
    '',
    'De koppeling is 10 minuten geldig vanaf het aanmaken en kan eenmaal worden opgehaald.',
    'Klik in de app op "Evenement ophalen en bekijken", kies de post voor dit toestel en bevestig de koppeling.',
    '',
    ...(local ? ['Dit is een lokale link. Start eerst Tijdregistratie op het tweede toestel. Je kunt de volledige link ook in de app plakken bij "Deze pc aansluiten".', ''] : []),
    'Werkt de link niet? Open Tijdregistratie op het tweede toestel en plak de volledige koppellink bij "Deze pc aansluiten".',
    'De losse koppelcode werkt alleen als daar hetzelfde Supabase-project is ingesteld.',
  ].join('\r\n');
  return { subject, body, mailto: `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}` };
}
