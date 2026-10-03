// Seed data — based on Sharon's March 2026 sheets (Dublin 2026 + Tracker 2026).
// Capacities are ASSUMED for the demo; Sharon confirms real numbers in Settings.

const DEMO_TODAY = '2026-02-16';

const REGIONS = [
  { id: 'dublin',   name: 'Dublin region', centres: ['Bray', 'Swords', 'Skerries', 'Malahide', 'Navan', 'Dublin'] },
  { id: 'galway',   name: 'Galway',        centres: ['Tuam', 'Corofin'] },
  { id: 'cork',     name: 'Cork',          centres: ['Mallow'] },
  { id: 'monaghan', name: 'Monaghan',      centres: ['Monaghan'] },
];

const CENTRES = {
  Bray:     { code: 'BR', cap: 70,  color: '#6366F1' },
  Swords:   { code: 'SW', cap: 70,  color: '#059669' },
  Skerries: { code: 'SK', cap: 50,  color: '#EC4899' },
  Malahide: { code: 'ML', cap: 60,  color: '#3B82F6' },
  Navan:    { code: 'NV', cap: 60,  color: '#8B5CF6' },
  Dublin:   { code: 'DB', cap: 90,  color: '#F59E0B' },
  Tuam:     { code: 'TM', cap: 100,  color: '#14B8A6' },
  Corofin:  { code: 'CF', cap: 60,  color: '#84CC16' },
  Mallow:   { code: 'MW', cap: 70,  color: '#EF4444' },
  Monaghan: { code: 'MN', cap: 100, color: '#0EA5E9' },
};

const STATUSES = [
  { id: 'enquiry',   label: 'Enquiry' },
  { id: 'waiting',   label: 'Waiting' },
  { id: 'confirmed', label: 'Confirmed' },
  { id: 'cancelled', label: 'Cancelled' },
];

// g(...) helper keeps the seed compact
const g = (id, agent, contact, email, school, ref, centre, arrival, departure, status, enquiry, students, adults, breakdown, age, notes, invoice, coach, program) => ({
  id, agent, contact, email, school, ref, ceRef: null, centre, arrival, departure, status, enquiry,
  students, adults, breakdown, age, notes: notes || '', invoice: invoice || '', coach: coach || '',
  program: program || (status === 'confirmed' ? 'Done' : ''), history: [],
});

const SEED_GROUPS = [
  g(1,  'VTO',      'Geraldine', 'geraldine.bernard@vtovoyages.com', 'Collège Gomez',              '120135 - GOMEZ',             'Bray',     '2026-03-01', '2026-03-04', 'confirmed', '2025-09-18', 30, 3, '9B, 21G, 1M, 2F', '16', 'Leap cards & 1 late evening. Requested Bray.', '', 'Leap cards for 2 days; coach hire booked by agent'),
  g(2,  'Verdie',   'Amelie',    'amelie.dangeard@verdieopenclass.com', 'Collège Jean Zay',      'DAEDIRL262806',              'Swords',   '2026-03-02', '2026-03-06', 'confirmed', '2025-10-08', 29, 3, '9B, 20G, 1M, 2F', '14-15', 'On allocation list. Students accompany to meeting point; bus in Swords, not Dart.', '', 'Public transport only'),
  g(3,  'Envol',    'Karine',    'km@envol-espace.fr', 'KIEC5587',                               'KIEC5587',                   'Skerries', '2026-03-02', '2026-03-05', 'confirmed', '2025-09-17', 35, 3, '19G, 16B, 1M, 2F', '14', 'Repeat group — wants Skerries again.', '', 'Agent booking McCaffreys'),
  g(4,  'CLC',      'Natacha',   'natacha.obert@clc.fr', 'S26IE97510',                           'S26IE97510',                 'Malahide', '2026-03-02', '2026-03-05', 'confirmed', '2025-09-10', 46, 4, '20G, 26B, 2M, 2F, 1D', '', 'Told agent Malahide; teachers OK with this.', '', 'French coach'),
  g(5,  'Esp Eur',  'Olivia',    'olivia@espace-europ.com', 'Collège Jean Rostand',              'COLLEGE JEAN ROSTAND',       'Swords',   '2026-03-09', '2026-03-12', 'confirmed', '2025-09-11', 51, 6, '30G, 21B, 3F, 3M, 1D', '12-14', 'Not Malahide — students must be accompanied to meeting point.', 'Packed lunch for last day', 'French coach. Driver in hotel, booked by agent'),
  g(6,  'ECI',      'Alexandre', 'eci@eci.asso.fr', 'Mme Auffrant',                              'Mme AUFFRANT',               'Bray',     '2026-03-09', '2026-03-14', 'confirmed', '2025-10-13', 30, 3, '10B, 20G, 2F, 1M', '16-17', 'Repeat group. Requested Bray as in 2024. 2 days coach, 4 days leap cards.', 'Coach hire €1,370. Leap cards €28', 'Have to book coach for 2 days'),
  g(7,  'Maripop',  'Maelle',    'maelle@maripop.fr', 'Ozanam',                                  'Ozanam',                     'Skerries', '2026-03-10', '2026-03-14', 'confirmed', '2025-07-02', 41, 4, '6G, 35B, 1F, 3M, 1D', '16-17', 'Waiting on contract to be signed. Not happy with Malahide so Skerries, with football in Malahide; driver in host family.', '', 'French coach'),
  g(8,  'MaClasse', 'Valerie',   'valerie.leroulley@maclassevoyage.com', 'Collège Saint Louis',  'COLLEGE SAINT LOUIS',        'Swords',   '2026-03-16', '2026-03-20', 'confirmed', '2025-07-03', 34, 3, '19G, 15B, 3F', '12', 'Wants dancing and football. Should confirm.', '', 'Agent booking McCaffreys'),
  g(9,  'Laligue',  'Oriane',    'vse@laligue.org', 'Lycée Robert Garnier',                      'Lycée Robert Garnier',       'Navan',    '2026-03-16', '2026-03-20', 'confirmed', '2025-07-04', 49, 4, '31G, 18B, 2F, 2M, 1D', '', 'Requested Navan. Asked for the space again on Sept 2nd.', '2 packed lunches on day of departure', 'French coach'),
  g(10, 'Eva Tours','Angelique', 'gb@evatours.fr', 'Collège Clément Marot',                        'IRL0029/26',                 'Bray',     '2026-03-17', '2026-03-20', 'confirmed', '2025-06-25', 48, 5, '28G, 20B, 4F, 1M, 1D', '13-14', 'Confirmed with Valerie; told agent Bray.', '', 'French coach'),
  g(11, 'ECI',      'Alexandre', 'eci@eci.asso.fr', 'Mme Campos',                                'Mme CAMPOS',                 'Skerries', '2026-03-21', '2026-03-25', 'confirmed', '2025-09-25', 30, 3, '12B, 18G, 2F, 1M', '16-17', 'Leap cards. Leaders in same host family, singles if possible.', 'Coach to agent €2,350', 'Have to book coach for 3 days'),
  g(12, 'Verdie',   'Helene',    'helene.potier@verdieopenclass.com', 'Lycée Saint François d\'Assise', 'DHPOIRL263497',    'Navan',    '2026-03-22', '2026-03-26', 'confirmed', '2025-09-22', 40, 3, '12B, 28G, 3F', '16-17', 'Confirmed but waiting on sea crossings.', 'Hotel for driver €675', 'French coach. Driver in hotel, booked by Corrib'),
  g(13, 'Twin',     'Roberta',   '', 'St Quentin',                                               'St Quentin',                 'Dublin',   '2026-03-22', '2026-03-28', 'waiting',   '2025-10-22', 31, 0, '', '', ''),
  g(14, 'CCE',      'Samuel',    'cce@ccevoyages.com', 'Lycée Saint Paul – Besançon',            'IE3062A',                    'Bray',     '2026-03-23', '2026-03-27', 'confirmed', '2025-06-05', 44, 3, '24G, 20B, 3F', '', 'Told agent Bray.', 'Coach hire to agent €3,970', 'Have to book coach — confirmed at €3,280 to Corrib'),
  g(15, 'VTO',      'Estelle',   'estelle.dumarest@vtovoyages.com', 'Collège Saint Pierre',     '10603626',                   'Swords',   '2026-03-23', '2026-03-27', 'confirmed', '2025-10-03', 52, 5, '33G, 19B, 2M, 3F', '13-15', 'Told agent Swords.', '', 'Agent booking Irish coach'),
  g(16, 'Richou',   'Tiphaine',  '', 'Collège St Jo',                                            'Clge ST Jo',                 'Dublin',   '2026-03-23', '2026-03-26', 'enquiry',   '2025-07-06', 73, 0, '', '', ''),
  g(17, 'Verdie',   'Lauryne',   '', 'Collège Léon Blum',                                        'DMILIRL261257',              'Malahide', '2026-03-24', '2026-03-26', 'confirmed', '2025-11-12', 49, 4, '', '', 'Took off waiting on November 28th.', '', ''),
  g(18, 'Envol',    'Karine',    'km@envol-espace.fr', 'KIEC5647',                               'KIEC5647',                   'Swords',   '2026-03-30', '2026-04-02', 'confirmed', '2025-07-25', 46, 4, '', '', 'Told agent Swords.', '', ''),
  g(19, 'Verdie',   'Charlene',  '', 'Lycée Jeanne d\'Arc',                                      'DCPRIRL263888',              'Bray',     '2026-03-30', '2026-04-02', 'confirmed', '2025-09-11', 42, 4, '', '', 'Regular client, working on the budget. Told agent Bray.', '', ''),
  g(20, 'Verdie',   'Laura',     '', 'Collège Coutelle',                                         'DLAUIRL261331',              'Navan',    '2026-03-30', '2026-04-02', 'confirmed', '2025-09-30', 49, 4, '', '', 'Cancelled on Nov 4th but wants the space now. Group changed their minds, but the space was given to VTO.', '', ''),
  // Other regions (from Tracker 2026)
  g(21, 'Esp Eur',  'Tamara',    'tamara@espace-europ.com', 'Collège St Louis – Lorient',        'College St Louis Lorient',   'Tuam',     '2026-03-03', '2026-03-07', 'confirmed', '2025-08-20', 87, 7, '23G + 20B (Corofin), 23G + 21B + 6F + 1M + 2D (Tuam)', '14', '', 'Coach hire for 1 day €1,500. Supermacs: 1 x veg burger meal @ €13.00 / 93 x 5oz burger meals @ €13.50 pp / 89 x cookie & ice cream @ €4.50pp', '2 French coaches. Corrib hired Murrays for 1 day — €1,400'),
  g(22, 'Verdie',   'Mathilde',  'mathilde.couderc@verdieopenclass.com', 'Collège St Pierre Chanel', 'DMACIRL263762',    'Monaghan', '2026-03-09', '2026-03-13', 'confirmed', '2025-09-05', 31, 3, '20B, 11G, 3M', '16-17', '', '', 'Agent booking Collins coaches'),
  g(23, 'VTO',      'Eva',       'eva.monac@vtovoyages.com', 'Collège Pierre et Marie Curie',   '10614426',                   'Corofin',  '2026-03-16', '2026-03-19', 'confirmed', '2025-08-11', 53, 4, '27G, 26B, 1M, 3F', '14-15', '', '', 'French coach'),
  g(24, 'Verdie',   'Heloise',   'heloise.conquet@verdieopenclass.com', 'Collège Immaculée – Lycée Jean Paul II', 'DCHEIRL260516', 'Monaghan', '2026-03-16', '2026-03-19', 'confirmed', '2025-08-30', 66, 5, '32B, 34G, 1M, 4F', '15-16', '', 'Hotel for driver €525', 'French coach. Driver in hotel'),
  g(25, 'Triangles','Celine',    'celine.cot@voyagestriangle.com', 'Lycée Cassin',               'Lycée Cassin',               'Tuam',     '2026-03-22', '2026-03-26', 'confirmed', '2025-09-14', 48, 5, '31G, 17B, 5F, 1D (2 boys with 2 teachers)', '', 'Cliffs of Moher x 49 pax. Guided walking tour x 2 guides. Check whether we charge for performance by Angela — talk to Sharon before sending invoice.', '2 packed lunches on day of departure', 'French coach'),
  g(26, 'MaClasse', 'Valerie',   'valerie.leroulley@maclassevoyage.com', 'Collège Sainte Marie', 'COLLEGE SAINTE MARIE',     'Monaghan', '2026-03-23', '2026-03-27', 'confirmed', '2025-09-02', 41, 4, '23G, 18B, 3F, 1M', '11-13', '', '', 'Agent booking McCaffreys'),
  g(27, 'MaClasse', 'Valerie',   'valerie.leroulley@maclassevoyage.com', 'Collège Louis Armand', '7229',                       'Monaghan', '2026-03-23', '2026-03-28', 'confirmed', '2025-09-02', 37, 4, '27G, 10B, 2F, 2M (1M & 1F are a married couple). 1 gluten free', '', '', 'Coach hire €5,400', 'Have to book coach — hire confirmed with agent'),
  g(28, 'Maripop',  'Maelle',    'maelle@maripop.fr', 'Collège Gabriel Deshayes',                'College Gabriel Deshayes',   'Mallow',   '2026-03-21', '2026-03-26', 'confirmed', '2025-08-18', 56, 5, '36G, 21B, 4F, 1M', '', 'Driver in hotel, booked by agent.', '', 'French coach. Driver in hotel'),
];

// Assign Corrib Educate references to the confirmed seed groups (CLC already holds CE/ML26/33).
(function assignRefs() {
  let n = 7;
  SEED_GROUPS.filter(x => x.status === 'confirmed')
    .sort((a, b) => a.enquiry.localeCompare(b.enquiry))
    .forEach(x => {
      if (x.id === 4) { x.ceRef = 'CE/ML26/33'; return; }
      n++; if (n === 33) n++;
      x.ceRef = `CE/${CENTRES[x.centre].code}26/${n}`;
    });
})();

const SEED_EMAILS = [
  { id: 'e1', from: 'Alexandre', agent: 'CCE', email: 'cce@ccevoyages.com', received: '2026-02-16T08:42',
    subject: 'Demande de séjour — Dublin, mars 2026',
    body: 'Hello Sharon,\n\nWe would like to bring a group to Dublin next March. We will be 40 students and 4 adults, travelling 15-19 March 2026. We would like to stay in the Dublin region, with host families if possible.\n\nCould you let us know what is available?\n\nBest regards,\nAlexandre\nCCE Voyages', processed: false },
  { id: 'e2', from: 'Valerie', agent: 'MaClasse', email: 'valerie.leroulley@maclassevoyage.com', received: '2026-02-14T16:10',
    subject: 'Galway — avril 2026',
    body: 'Dear Sharon,\n\nA school of ours is interested in Galway. 36 students and 3 adults, 13-17 April 2026. Do you have space?\n\nThank you,\nValerie', processed: false },
  { id: 'e3', from: 'Karine', agent: 'Envol', email: 'km@envol-espace.fr', received: '2026-02-12T11:25',
    subject: 'Groupe Monaghan 2026',
    body: 'Hi Sharon,\n\nSame school as last year wants to return to Monaghan: 52 students, 4 adults, 20-24 April 2026.\n\nKarine', processed: false },
];

/* ---------- Finance, prep & host-family layer (from Fernanda's voice note + Sharon's real documents) ---------- */
// Rates are PLACEHOLDERS for the demo — Fernanda sets the real ones in Finance.
const SETTINGS_DEFAULT = { deposit: 500, rate: 45, familyRate: 28, invoiceLeadDays: 14, holdDays: 21 };
// Mirrors the Tracker columns Sharon ticks off (Program, Final email, Family list, Matching list …)
const TASKS = [
  ['program', 'Programme done'], ['visits', 'Visits & activities booked'], ['transport', 'Ferries / coach arranged'], ['vouchers', 'Vouchers sent to agent'],
  ['families', 'Host families confirmed'], ['finalEmail', 'Final email sent to agent'], ['familyList', 'Family list sent to local organiser'], ['matching', 'Allergies sent to families (matching list)'],
];
const AFTER_TASKS = [['feedback', 'Feedback received']];
const CENTRE_ADDR = { Swords: 'Swords Manor Inn, Brackenstown, Swords, K67 N4X9' };
const SEED_VENUES = [
  { id: 1, name: 'Cliffs of Moher', address: 'Cliffs of Moher, Lislorkan North, Co. Clare', contact: '00 353 65 7086141', coords: '52.971665, -9.430968' },
  { id: 2, name: 'Trinity College & Book of Kells', address: 'Trinity College Dublin, College Green, Dublin 2', contact: '', coords: '' },
  { id: 3, name: 'EPIC The Irish Emigration Museum', address: 'The CHQ Building, Custom House Quay, Dublin 1', contact: '', coords: '' },
  { id: 4, name: 'Museum of Literature Ireland', address: "86 St Stephen's Green, Dublin 2", contact: '', coords: '' },
  { id: 5, name: 'Glendalough', address: 'Glendalough Visitor Centre, Co. Wicklow', contact: '', coords: '' },
];

// Fictional host families (demo data only — no real people)
const FAM_SURNAMES = ['Murphy','Kelly','Byrne','Walsh','Doyle',"O'Brien",'Ryan','Brennan','Quinn','Nolan','Gallagher','Hughes','Lynch','Daly','Moran','Fitzgerald','Kavanagh','McCarthy','Duffy','Farrell','Regan','Boyle','Healy','Sheridan','Cullen','Dunne','Keane','Flynn','Barry','Carey','Hayes','Moloney','Tierney','Egan','Burke','Fahey','Joyce','Coyne','Rooney','Mulligan','Devlin','Hanley','Fagan','McGrath','Lally','Madden','Conway','Reilly','Casey','Lawlor','Cronin','Gleeson','Mahon','Rafferty','Teague','Whelan','Kiely','Dolan','Foley','Heffernan','Lenehan','Maguire','Nugent','Prendergast','Scully','Treacy','Vaughan','Wade','Yeates','Ahern','Bolger','Clancy','Dempsey','Enright','Feeney','Geary','Hession','Irwin','Judge','Kearns','Loughlin','Mulcahy','Naughton','Oakes','Phelan','Quigley','Rowan','Staunton','Timmons','Ulick','Vance','Redmond','Sweeney','Tobin','Walshe'];
const FAM_FIRST = ['Danielle','Christine','Therese','Liam','Sabrina','Julie','Karen','Antonette','Anne','Ashling','Caroline','Sharon','Dee','Ger','Yvonne','Mary','Paula','Declan','Orla','Brian'];
const FAM_STREETS = ['Oakwood Park', 'Mill Lane', 'Castle Road', 'Church Avenue', 'Willow Grove', 'Seaview Terrace', 'Beechfield Drive', 'Station Road'];
const FAM_COUNTS = { Bray: 14, Swords: 14, Skerries: 8, Malahide: 8, Navan: 8, Dublin: 12, Monaghan: 10, Tuam: 8, Corofin: 6, Mallow: 6 };
const SEED_FAMILIES = (() => {
  const out = []; let id = 0;
  Object.entries(FAM_COUNTS).forEach(([centre, n]) => {
    for (let i = 0; i < n; i++, id++) {
      out.push({ id: id + 1, name: `${FAM_FIRST[id % FAM_FIRST.length]} ${FAM_SURNAMES[id % FAM_SURNAMES.length]}`, centre, cap: 3 + (id % 3), pets: id % 3 === 0,
        address: `${5 + ((id * 13) % 80)} ${FAM_STREETS[id % FAM_STREETS.length]}, ${centre}`,
        phone: `00 353 8${[3, 5, 6, 7][id % 4]} ${100 + ((id * 37) % 900)} ${1000 + ((id * 137) % 9000)}`,
        pay: `IE•• •••• •••• ${String(1000 + ((id * 911) % 9000)).slice(-4)}` });
    }
  });
  return out;
})();

// Fictional participant names + allergy notes, in the same format as Sharon's real family list
const NAMEPOOL = {
  girls: ['Lena', 'Zoé', 'Inès', 'Manon', 'Léa', 'Jade', 'Chloé', 'Camille', 'Alice', 'Eva', 'Nina', 'Lola', 'Clara', 'Julie', 'Sarah', 'Emma', 'Louise', 'Rose', 'Anaïs', 'Maëlle', 'Océane', 'Romane', 'Louna', 'Mia', 'Ambre'],
  boys: ['Lucas', 'Hugo', 'Mathis', 'Noé', 'Ethan', 'Jules', 'Léo', 'Tom', 'Adrien', 'Nathan', 'Gabin', 'Baptiste', 'Enzo', 'Maxime', 'Timéo', 'Louis', 'Arthur', 'Rafael', 'Victor', 'Paul', 'Axel'],
  leaders: ['Mme Laurent', 'M. Petit', 'Mme Garnier', 'M. Roux'],
};
const TAGS = { 2: 'no pork', 7: 'vegetarian', 12: 'allergic to apple', 16: 'no cheese', 20: 'scared of dogs', 24: 'no beans' };
function seedFill(centre, kind, total, startFam, nameOffset = 0) {
  const fams = SEED_FAMILIES.filter(f => f.centre === centre), out = []; let k = 0, fi = startFam;
  while (k < total && fi < fams.length) {
    const f = fams[fi++], n = Math.min(f.cap, total - k);
    const names = Array.from({ length: n }, (_, j) => {
      const nm = NAMEPOOL[kind][(k + j + nameOffset) % NAMEPOOL[kind].length], t = TAGS[(k + j + nameOffset) % 25];
      return kind !== 'leaders' && t ? `${nm} - ${t}` : nm;
    });
    out.push({ fid: f.id, kind, n, notes: names.join(', ') }); k += n;
  }
  return out;
}

(function enrich() {
  const conf = SEED_GROUPS.filter(x => x.status === 'confirmed').sort((a, b) => a.arrival.localeCompare(b.arrival));
  const order = Object.fromEntries(conf.map((x, i) => [x.id, i]));
  SEED_GROUPS.forEach(x => {
    x.holdUntil = x.id === 16 ? '2026-02-20' : ''; x.leaders = '';
    const i = order[x.id] ?? 99, done = i < 4 ? 8 : i < 9 ? 6 : i < 14 ? 4 : i < 19 ? 2 : 0;
    x.tasks = Object.fromEntries([...TASKS, ...AFTER_TASKS].map(([k], j) => [k, j < done && k !== 'feedback']));
    x.programme = {}; x.alloc = [];
    x.fin = { deposit: x.enquiry <= '2025-09-15' ? 'paid' : x.enquiry <= '2025-10-31' ? 'sent' : 'to-send',
      invoice: x.id === 1 ? 'draft' : 'none', extras: undefined, costs: [], familyListSent: '', familiesPaid: false };
    if (x.status !== 'confirmed') x.fin.deposit = 'none';
    delete x.program;
  });
  const G = id => SEED_GROUPS.find(x => x.id === id);
  G(14).fin.costs = [{ desc: 'Coach supplier', amount: 3280 }];
  G(21).fin.costs = [{ desc: 'Murrays coach (1 day)', amount: 1400 }];

  // Example 1 — partly placed family list (Collège Gomez, Bray)
  G(1).alloc = seedFill('Bray', 'girls', 14, 0); G(1).tasks.families = false; G(1).tasks.familyList = false; G(1).tasks.matching = false;

  // Example 2 — the KIEC5647 group (Swords, 30 Mar – 2 Apr): programme + family list in the format of Sharon's documents
  const k = G(18); k.breakdown = '25G, 21B, 2F, 2M';
  k.alloc = [...seedFill('Swords', 'girls', 25, 0), ...seedFill('Swords', 'boys', 21, 7, 3), ...seedFill('Swords', 'leaders', 4, 12)];
  const A = (time, text, by = '', venue = 0) => ({ time, text, by, venue });
  k.programme = {
    '2026-03-30': [A('14:05', 'Group arrives at Dublin Airport (flight no. EI521)'), A('', 'Meet coach', 'agent'), A('', 'Guided visit of Dublin City', 'agent'), A('19:15', 'Group arrives at Centre in Swords')],
    '2026-03-31': [A('08:00', 'Group departs Centre with packed lunch for Dublin City'), A('', 'Visit Trinity College & Book of Kells', 'agent', 2), A('', 'Visit Epic Museum', 'agent', 3), A('', 'Free time in Templebar'), A('18:30', 'Group arrives at Centre in Swords')],
    '2026-04-01': [A('08:00', 'Group departs Centre with packed lunch for Dublin City'), A('', 'Visit Museum of Literature', 'agent', 4), A('', 'Visit Glendalough', 'agent', 5), A('18:30', 'Group arrives at Centre in Swords')],
    '2026-04-02': [A('08:00', 'Group departs Centre with packed lunch for Dublin City'), A('', 'Free time'), A('', 'Shopping in Grafton Street'), A('', 'Transfer to Dublin Airport'), A('16:00', 'Check in'), A('18:20', 'Flight departs (flight no. EI528)')],
  };
  // Example 3 — a visit Corrib books itself (the voucher is generated from this)
  G(25).programme = { '2026-03-24': [A('11:30', 'Cliffs of Moher', 'corrib', 1), A('', 'Guided walking tour × 2 guides', 'corrib')] };
})();
