export const links = {
  github: 'https://github.com/josephcake',
  githubWork: 'https://github.com/jgaosos',
  linkedin: 'https://www.linkedin.com/in/jocake/',
  terrin: 'https://terrin.io',
}

// New GitHub repositories per day, from github.com/josephcake.
export const repoDays = {
  '2018-11-07': 1, '2018-11-14': 1, '2018-11-28': 1, '2018-12-03': 2, '2018-12-04': 2,
  '2018-12-05': 1, '2018-12-06': 1, '2018-12-08': 14, '2018-12-09': 3, '2018-12-10': 6,
  '2018-12-11': 1, '2018-12-12': 6, '2018-12-14': 3, '2018-12-15': 3, '2018-12-17': 9,
  '2018-12-27': 2, '2018-12-28': 1, '2019-01-02': 1, '2019-01-14': 1, '2019-01-15': 1,
  '2019-02-08': 1, '2019-02-12': 1, '2019-02-13': 1, '2019-02-16': 3, '2019-02-17': 3,
  '2019-02-19': 3, '2019-02-20': 2, '2019-02-21': 3, '2019-02-22': 2, '2019-02-26': 1,
  '2019-02-28': 1, '2019-03-04': 1, '2019-03-05': 1, '2019-03-08': 1, '2019-03-12': 1,
  '2019-03-19': 1, '2019-03-21': 1, '2019-04-16': 1,
}

export const chapters = [
  {
    id: 'court',
    elevation: 140,
    year: 2016,
    place: 'Central Park, New York',
    title: 'On the court',
    role: 'Coach and sales specialist, Central Park Tennis Center',
    dates: 'April 2016 to November 2018',
    body: [
      'I taught tennis and ran sales at a busy New York tennis center.',
      'It taught me what I still lean on most: understand the person across the net before you try to help them.',
    ],
    tags: ['Coaching', 'Sales', 'Client relationships'],
    artifact: 'court',
  },
  {
    id: 'first-commits',
    elevation: 260,
    year: 2018,
    place: 'Brooklyn, New York',
    title: 'First commits',
    role: 'Complete beginner, for real this time',
    dates: 'March 2018 onward',
    body: [
      'My first code was a hacked MySpace profile. In 2018, between tennis lessons, I went back to it for real.',
      'Six months later I had close to ninety tiny repos and a habit of building something every day.',
    ],
    repos: ['simple-blackjack-cli', 'advanced-hashes-hashketball', 'speaking-grandma', 'deli-counter'],
    tags: ['HTML', 'CSS', 'Ruby', 'Fundamentals'],
    artifact: 'commits',
  },
  {
    id: 'shipping',
    elevation: 400,
    year: 2019,
    place: 'New York',
    title: 'Shipping small things',
    role: 'Frontend developer, Learning Economy',
    dates: 'August 2019 to April 2020',
    body: [
      'JavaScript and React took over. My favorite: Destroy the Duck, where search algorithms hunt a rubber duck through a maze.',
      'Then my first paid frontend work, at Learning Economy, connecting education through open data standards.',
    ],
    repos: ['Gitfolio', 'destroy-the-duck', 'mewgrounds', 'stocky'],
    tags: ['JavaScript', 'React', 'Algorithms', 'Open standards'],
    artifact: 'windows',
  },
  {
    id: 'rapidsos',
    elevation: 340,
    year: 2020,
    place: 'New York',
    title: 'Maps for 9-1-1',
    role: 'Software Engineer, RapidSOS',
    dates: 'April 2020 to present',
    body: [
      'I build the maps that show 9-1-1 telecommunicators where a caller is, down to the floor they are on.',
    ],
    points: [
      '3D map visualization that shows a caller’s floor, not just their address',
      'Indoor navigation that guides responders through buildings, now patented',
      'Reusable map components on Google Maps and ArcGIS',
      'Unified search across internal and worldwide sources',
      'A patented crawler that catalogs GIS services into Redis',
    ],
    demo: 'dispatch',
    tags: ['React', 'TypeScript', 'Google Maps', 'ArcGIS', '3D', 'Indoor maps', 'Redis', 'Patents'],
  },
  {
    id: 'founder',
    elevation: 780,
    year: 2026,
    place: 'Washington',
    title: 'Building my own',
    role: 'Side projects, alongside RapidSOS',
    dates: '2026',
    body: [
      'I still work at RapidSOS. In my own time I build things for the fun of it, Terrin.io first among them: a place to help people picture things that are hard to picture.',
    ],
    tags: ['Product', 'Visualization', 'Architecture', 'Design'],
    artifact: 'loop',
  },
  {
    id: 'now',
    elevation: 900,
    year: 'Now',
    place: 'Home',
    title: 'Making time for what matters',
    role: 'Husband, father, and Happy’s person',
    dates: 'Today',
    body: [
      'My wife and I are raising our newborn son, and Happy keeps us honest about walks.',
      'I still build like someone with something to prove. The difference now is who I am building for.',
    ],
    tags: ['Family', 'Coffee', 'Drawing', 'Woodworking', 'Tennis'],
  },
]

// The line over the name on the landing, one moment of the timeline at a time; short is the
// wording for a phone, where each has to fit on one line
export const moments = [
  { when: '2016', what: 'Coaching tennis in Central Park', where: 'New York' },
  { when: '2018', what: 'Writing my first lines of code', where: 'Brooklyn' },
  { when: '2019', what: 'Shipping frontends at Learning Economy', short: 'Shipping my first frontends', where: 'New York' },
  { when: '2020', what: 'Building the maps 9-1-1 uses, at RapidSOS', short: 'Building maps for 9-1-1 at RapidSOS', where: 'New York' },
  { when: '2026', what: 'Still at RapidSOS, and building my own projects for fun', short: 'Still at RapidSOS, building for fun', where: 'Washington' },
  { when: 'Now', what: 'Husband, father, and Happy’s person', short: 'Husband, father, Happy’s person', where: 'Home' },
]

export const projects = [
  {
    name: 'Terrin.io',
    kind: 'Side project',
    summary: 'Making hard things easy to picture.',
    detail:
      'Where I try out the visualization ideas I care about most.',
    href: links.terrin,
  },
  {
    name: 'Sensor lab',
    kind: 'Hardware',
    summary: 'Radar, infrared, and whatever else I can wire to a Raspberry Pi.',
    detail:
      'mmWave radar on a Raspberry Pi 5, turning raw returns into tracked objects: how far, how fast, and what is moving versus standing still.',
    demo: 'radar',
  },
  {
    name: 'GIS service catalog',
    kind: 'Geospatial',
    summary: 'Crawling and cataloging map services so applications can find them.',
    detail:
      'Finds GIS services across sources, normalizes their metadata, and stores it in Redis. The crawler behind it is patented.',
    demo: 'gis',
  },
  {
    name: 'Indoor navigation',
    kind: 'Geospatial',
    summary: 'Finding the way out of a building, floor by floor.',
    detail:
      'Floor plans as walkable graphs of rooms, doors, stairs and elevators. Pick a room and it routes you to the front door, around the walls and the furniture, by the stairs or the elevator.',
    demo: 'indoor',
  },
]

// What I bring, each with something on the page that shows it
export const strengths = [
  {
    title: 'Maps that find people',
    body: 'Six years at RapidSOS building the maps 9-1-1 uses: a caller placed on the right floor, responders guided through the building, and two patents along the way.',
    go: { label: 'Place a 9-1-1 call', to: 'dispatch' },
  },
  {
    title: 'From sensor to screen',
    body: 'Radar and infrared wired to a Raspberry Pi, and the readings carried all the way to an interface a person can read at a glance.',
    go: { label: 'Get tracked by the sensor lab', to: 'radar' },
  },
  {
    title: 'Building for the fun of it',
    body: 'Alongside RapidSOS I build my own things, Terrin.io among them, to try an idea properly before I talk about it.',
    go: { label: 'Open the workbench', to: 'lab' },
  },
  {
    title: 'Listening first',
    body: 'Coaching tennis taught me to understand the person across the net before I try to help them. I still work that way.',
    go: { label: 'Back to the court', to: 'court' },
  },
]
