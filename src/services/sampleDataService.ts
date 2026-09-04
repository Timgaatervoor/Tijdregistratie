import { db } from '../db/dexieDb';
import type { RaceEvent, RaceProfile, Category, Wave, Participant } from '../types';

const BELGIAN_FIRST_NAMES_M = [
  'Jan', 'Lucas', 'Thomas', 'Pieter', 'Kobe', 'Lars', 'Arthur', 'Liam', 'Noah', 'Jules',
  'Louis', 'Victor', 'Finn', 'Stan', 'Milan', 'Daan', 'Wout', 'Mats', 'Felix', 'Sander',
  'Ruben', 'Bram', 'Simon', 'Matthias', 'Jonas', 'Alexander', 'Maxim', 'Thibo', 'Emiel', 'Robbe'
];

const BELGIAN_FIRST_NAMES_F = [
  'Emma', 'Louise', 'Mila', 'Elise', 'Olivia', 'Lotte', 'Ella', 'Marie', 'Camille', 'Noor',
  'Elena', 'Lore', 'Julie', 'Fien', 'Hanne', 'Amber', 'Laura', 'Nina', 'Anna', 'Yinthe',
  'Femke', 'Lina', 'Amelie', 'Juliette', 'Sara', 'Zoë', 'Tess', 'Lena', 'Mia', 'Pauline'
];

const BELGIAN_LAST_NAMES = [
  'Peeters', 'Janssens', 'Maes', 'Jacobs', 'Mertens', 'Willems', 'Claes', 'Goossens',
  'Wouters', 'De Smet', 'Vermeulen', 'Pauwels', 'Aerts', 'Hermans', 'Michiels', 'De Vos',
  'Van Damme', 'Claeys', 'Vandamme', 'Hendrickx', 'De Backer', 'Desmet', 'Baert', 'Devos',
  'Coppens', 'Verhoeven', 'Van Dyck', 'Smet', 'Segers', 'Van de Velde', 'Van Acker', 'Vermeire'
];

const CLUBS = [
  'Kustatletiek De Haan', 'AV Oostende', 'Houtland Atletiekclub', 'MACW Diksmuide',
  'Olympic Brugge', 'FLAC Roeselare', 'Duinlopers Wenduine', 'Biathlon Team Vlaanderen',
  'Triatlon Club Kust', 'Zandlopers Blankenberge'
];

export async function initializeSampleData(force = false): Promise<void> {
  const existingEvents = await db.events.count();
  if (existingEvents > 0 && !force) {
    return;
  }

  // Clear previous if force
  if (force) {
    await Promise.all([
      db.events.clear(),
      db.raceProfiles.clear(),
      db.categories.clear(),
      db.waves.clear(),
      db.participants.clear(),
      db.timingRecords.clear(),
      db.shootingResults.clear(),
      db.operations.clear(),
      db.conflicts.clear(),
      db.auditLogs.clear(),
    ]);
  }

  const eventId = 'event-de-haan-2026';
  const now = new Date().toISOString();

  // 1. Event
  const defaultEvent: RaceEvent = {
    id: eventId,
    name: 'Run Biathlon De Haan 2026',
    date: '2026-09-19',
    location: 'Sport- en Recreatiecentrum De Haan aan Zee',
    organizer: 'VZW Biathlon Vlaanderen & Gemeente De Haan',
    status: 'READY',
    timezone: 'Europe/Brussels',
    penaltySecondsPerMiss: 20,
    requireStartConfirmation: false, // Quick finish enabled by default for speed
    requireFinishConfirmation: false,
    isTestMode: true,
    isPublicResultsLive: true,
    officialResultsLocked: false,
    officialResultsVersion: 'Draft',
    createdAt: now,
    updatedAt: now,
  };

  // 2. Race Profiles
  const profiles: RaceProfile[] = [
    {
      id: 'profile-kids',
      name: 'Kids Biathlon',
      description: '500m Run + Schieten (5) + 500m Run + Schieten (5) + 500m Finish',
      penaltySecondsPerMiss: 15,
      penaltyLapsPerMiss: 1,
      isDefault: false,
      legs: [
        { id: 'l1', type: 'RUN', name: 'Ronde 1 (Duinenloop)', distanceMeters: 500, laps: 1 },
        { id: 'l2', type: 'SHOOT', name: 'Schietproef 1', shotCount: 5, stance: 'prone', maxHits: 5, penaltyType: 'time', penaltyValueSeconds: 15 },
        { id: 'l3', type: 'RUN', name: 'Ronde 2 (Strand)', distanceMeters: 500, laps: 1 },
        { id: 'l4', type: 'SHOOT', name: 'Schietproef 2', shotCount: 5, stance: 'prone', maxHits: 5, penaltyType: 'time', penaltyValueSeconds: 15 },
        { id: 'l5', type: 'RUN', name: 'Ronde 3 (Finishsprint)', distanceMeters: 500, laps: 1 },
        { id: 'l6', type: 'FINISH', name: 'Finish' },
      ],
    },
    {
      id: 'profile-junior',
      name: 'Junior Biathlon',
      description: '1 km Run + Schieten (5) + 1 km Run + Schieten (5) + 1 km Finish',
      penaltySecondsPerMiss: 20,
      penaltyLapsPerMiss: 1,
      isDefault: false,
      legs: [
        { id: 'j1', type: 'RUN', name: 'Ronde 1 (Duinen & Bos)', distanceMeters: 1000, laps: 1 },
        { id: 'j2', type: 'SHOOT', name: 'Schietproef 1', shotCount: 5, stance: 'standing', maxHits: 5, penaltyType: 'time', penaltyValueSeconds: 20 },
        { id: 'j3', type: 'RUN', name: 'Ronde 2 (Strand)', distanceMeters: 1000, laps: 1 },
        { id: 'j4', type: 'SHOOT', name: 'Schietproef 2', shotCount: 5, stance: 'standing', maxHits: 5, penaltyType: 'time', penaltyValueSeconds: 20 },
        { id: 'j5', type: 'RUN', name: 'Ronde 3 (Finishpad)', distanceMeters: 1000, laps: 1 },
        { id: 'j6', type: 'FINISH', name: 'Finish' },
      ],
    },
    {
      id: 'profile-adult',
      name: 'Adult Biathlon (Competitie & Recreatief)',
      description: '1,5 km Run + Schieten (5) + 1,5 km Run + Schieten (5) + 1,5 km Finish',
      penaltySecondsPerMiss: 20,
      penaltyLapsPerMiss: 1,
      isDefault: true,
      legs: [
        { id: 'a1', type: 'RUN', name: 'Ronde 1 (Grote Duinenlus)', distanceMeters: 1500, laps: 1 },
        { id: 'a2', type: 'SHOOT', name: 'Schietproef 1 (Liggend)', shotCount: 5, stance: 'prone', maxHits: 5, penaltyType: 'time', penaltyValueSeconds: 20 },
        { id: 'a3', type: 'RUN', name: 'Ronde 2 (Strand & Dijk)', distanceMeters: 1500, laps: 1 },
        { id: 'a4', type: 'SHOOT', name: 'Schietproef 2 (Staand)', shotCount: 5, stance: 'standing', maxHits: 5, penaltyType: 'time', penaltyValueSeconds: 20 },
        { id: 'a5', type: 'RUN', name: 'Ronde 3 (Slotronde)', distanceMeters: 1500, laps: 1 },
        { id: 'a6', type: 'FINISH', name: 'Finish' },
      ],
    },
  ];

  // 3. 10 Categories
  const categories: Category[] = [
    { id: 'cat-u8-m', name: 'U8 Jongens', code: 'U8-J', gender: 'M', minAge: 6, maxAge: 7, raceProfileId: 'profile-kids', bibRangeStart: 1, bibRangeEnd: 29 },
    { id: 'cat-u8-f', name: 'U8 Meisjes', code: 'U8-M', gender: 'F', minAge: 6, maxAge: 7, raceProfileId: 'profile-kids', bibRangeStart: 30, bibRangeEnd: 59 },
    { id: 'cat-u10-m', name: 'U10 Jongens', code: 'U10-J', gender: 'M', minAge: 8, maxAge: 9, raceProfileId: 'profile-kids', bibRangeStart: 60, bibRangeEnd: 89 },
    { id: 'cat-u10-f', name: 'U10 Meisjes', code: 'U10-M', gender: 'F', minAge: 8, maxAge: 9, raceProfileId: 'profile-kids', bibRangeStart: 90, bibRangeEnd: 119 },
    { id: 'cat-u12', name: 'U12 Jeugd', code: 'U12', gender: 'ALL', minAge: 10, maxAge: 11, raceProfileId: 'profile-junior', bibRangeStart: 120, bibRangeEnd: 159 },
    { id: 'cat-u14', name: 'U14 Cadetten', code: 'U14', gender: 'ALL', minAge: 12, maxAge: 13, raceProfileId: 'profile-junior', bibRangeStart: 160, bibRangeEnd: 199 },
    { id: 'cat-adult-m', name: 'Volwassenen Heren Comp.', code: 'HEREN-COMP', gender: 'M', minAge: 18, raceProfileId: 'profile-adult', bibRangeStart: 200, bibRangeEnd: 259 },
    { id: 'cat-adult-f', name: 'Volwassenen Dames Comp.', code: 'DAMES-COMP', gender: 'F', minAge: 18, raceProfileId: 'profile-adult', bibRangeStart: 260, bibRangeEnd: 319 },
    { id: 'cat-rec-m', name: 'Recreatief Heren', code: 'REC-H', gender: 'M', minAge: 16, raceProfileId: 'profile-adult', bibRangeStart: 320, bibRangeEnd: 359 },
    { id: 'cat-rec-f', name: 'Recreatief Dames', code: 'REC-D', gender: 'F', minAge: 16, raceProfileId: 'profile-adult', bibRangeStart: 360, bibRangeEnd: 399 },
  ];

  // 4. 10 Waves
  const waveTimes = [
    '09:00:00', '09:15:00', '09:30:00', '09:45:00', '10:00:00',
    '10:20:00', '10:40:00', '11:00:00', '11:25:00', '11:50:00',
  ];
  const waves: Wave[] = Array.from({ length: 10 }).map((_, i) => ({
    id: `wave-${i + 1}`,
    eventId,
    name: `Wave ${i + 1}`,
    waveNumber: i + 1,
    scheduledStartTime: waveTimes[i],
    categoryIds: [categories[i % categories.length].id],
    maxParticipants: 25,
    status: 'SCHEDULED',
  }));

  // 5. Generate 200 realistic Belgian participants
  const participants: Participant[] = [];
  let bibCounter = 1;

  for (let i = 0; i < 200; i++) {
    const isMale = i % 2 === 0;
    const firstNames = isMale ? BELGIAN_FIRST_NAMES_M : BELGIAN_FIRST_NAMES_F;
    const firstName = firstNames[i % firstNames.length];
    const lastName = BELGIAN_LAST_NAMES[(i * 3 + 7) % BELGIAN_LAST_NAMES.length];
    const category = categories[i % categories.length];
    const wave = waves[i % waves.length];
    const club = CLUBS[i % CLUBS.length];
    const birthYear = 2026 - (category.minAge || 12) - (i % 2);

    participants.push({
      id: `p-${i + 1}`,
      externalId: `SH-2026-${1000 + i}`,
      firstName,
      lastName,
      birthDate: `${birthYear}-${String((i % 12) + 1).padStart(2, '0')}-${String((i % 28) + 1).padStart(2, '0')}`,
      gender: isMale ? 'M' : 'F',
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase().replace(/\s+/g, '')}${i}@gmail.com`,
      phone: `+32 47${(i % 9) + 1} ${String(100 + i).slice(0, 2)} ${String(200 + i).slice(0, 2)} ${String(300 + i).slice(0, 2)}`,
      club,
      team: club,
      categoryId: category.id,
      raceProfileId: category.raceProfileId,
      bibNumber: bibCounter++,
      waveId: wave.id,
      notes: i === 0 ? 'Titelverdediger 2025' : undefined,
      status: 'READY',
      createdAt: now,
      updatedAt: now,
    });
  }

  // Bulk add to Dexie
  await db.events.put(defaultEvent);
  await db.raceProfiles.bulkPut(profiles);
  await db.categories.bulkPut(categories);
  await db.waves.bulkPut(waves);
  await db.participants.bulkPut(participants);

  // Setup default local device
  await db.devices.put({
    id: 'FINISH-01',
    name: 'Finish Tablet 1 (Hoofdpost)',
    role: 'FINISH_OPERATOR',
    stationName: 'Finish Straat',
    isLocked: false,
    clockOffsetMs: 0,
  });

  await db.auditLogs.add({
    id: `audit-init-${Date.now()}`,
    timestamp: now,
    deviceId: 'RACE-CONTROL',
    operator: 'System',
    action: 'INIT_SAMPLE_DATA',
    details: 'Initialisatie testgegevens Run Biathlon De Haan (200 deelnemers, 10 waves, 3 profielen)',
  });
}
