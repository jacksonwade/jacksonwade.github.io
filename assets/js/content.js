const SITE = {

  name:   'Kamai Jackson-Wade',
  role:   'Researcher',
  github: 'https://github.com/jacksonwade',
  email:  'kamaijacksonwade [at] gmail.com',   // plain text on Contact; [at] defeats scrapers. '' to hide

  // Home page: name plus one short line.
  // Words (or a phrase) wrapped in {curly braces} are underlined and link to Research.
  hero: 'I work on {mean-field games}.',

  // Landing page (About-as-home): a short blurb, then News, then Latest publications.
  blurb: [
    'I work on mean-field games and statistical mechanics.',
  ],
  news: [
    { date: 'August 2026', text: 'Incoming QR Intern at a US hedge fund, starting 2027.' },
    { date: 'July 2026',   text: 'Research Intern at Dubsof, Dublin.' },
    { date: 'April 2026',  text: 'Quantitative Strategist Spring Intern at Goldman Sachs, London.' },
  ],

  // About page paragraphs. First person, to match the rest of the site.
  about: [
    'My study is on mean-field game theory, especially what happens when the agents are physically constrained.',
    'This site collects my research and writing.',
  ],
  aboutImage:   '/assets/img/art-dai-inklandscape.jpg',   // full-bleed image on About (high-res ink landscape)
  contactImage: '/assets/img/pick-inness.jpg',        // Contact: Inness Moonrise, curtain-down reveal
  // Research page intro: the research-direction statement (shown above the list).
  // Field-level only, no unpublished specifics. Add/remove paragraphs freely.
  researchIntro: [
    'For any enquiries, you can get in contact via email.'
  ],

  // Blog posts and research entries are NOT edited here. Write them as markdown
  // files in posts/ and research/; scripts/build-content.mjs turns those into
  // SITE.posts and SITE.research. See scripts/WRITING.md.

};
