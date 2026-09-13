/**
 * Research lanes. Each lane is one focused Claude call with web search and web fetch.
 * Narrow briefs beat one giant "find everything" prompt: coverage is better, and each
 * lane's context stays small enough that it actually reads the pages it fetches.
 */
export const LANES = [
  {
    id: "music",
    name: "Music and nightlife",
    brief: `Find shows, DJ nights, parties and dance nights that match the music profile.

Priorities, in order:
1. Melodic and progressive house and melodic techno bookings (deadmau5 and Kx5, Eric Prydz, Paul Kalkbrenner, Rebūke, Tinlicker, Marsh, Fred again.., John Summit, Disclosure, Anjunadeep-style artists) at Knockdown Center, Avant Gardner, Brooklyn Storehouse, Under the K Bridge, Brooklyn Steel, Public Records, Nowadays, Good Room, Basement, Elsewhere, plus warehouse promoters like Teksupport.
2. Afrobeats, amapiano, dancehall and reggae parties and shows (Burna Boy, Wizkid, Tems, Rema, Tyla, Omah Lay, Sean Paul, Popcaan, Shenseea, Asake). Brooklyn's Caribbean and West African scene, not the Manhattan bottle-service version.
3. Hip-hop shows, 2000s New York rap nights, Brooklyn drill moments.
4. German or Berlin artists touring New York (Kalkbrenner, Seeed, Deichkind, K.I.Z, Ski Aggu, any Berlin techno night).
5. Daytime parties and outdoor sets (The Lot Radio, Nowadays yard, Under the K Bridge, Elsewhere rooftop), themed dance nights he would dress up for (ABBA, emo night, 2000s night, disco), Latin and reggaeton nights.

Rules: small rooms with good sound beat big names in bad rooms. Big arena or warehouse shows for Tier 1 artists belong in the radar window even if they are weeks out. Skip generic bar DJs, bottle-service clubs, Meatpacking, and anything marketed as "vibes."`,
    hints: [
      "Knockdown Center upcoming events",
      "Resident Advisor Brooklyn this week",
      "Afrobeats party Brooklyn this weekend",
      "amapiano night Brooklyn",
      "dancehall party Crown Heights Flatbush",
      "Public Records Nowadays Good Room this week",
      "deadmau5 OR Kx5 OR Eric Prydz New York 2026",
      "Paul Kalkbrenner OR Seeed OR Deichkind New York",
      "Berlin techno night Brooklyn",
      "day party Brooklyn Saturday",
      "emo night OR ABBA night OR 2000s night Brooklyn",
      "Brooklyn Storehouse Under the K Bridge events",
    ],
    maxSearches: 14,
    maxFetches: 12,
  },
  {
    id: "fights",
    name: "Fights and sports",
    brief: `Find professional fight cards and the sports moments that matter to him.

Priorities, in order:
1. Pro fight cards in the New York area: UFC, boxing, Muay Thai, kickboxing at Madison Square Garden, the Hulu Theater, Barclays Center, the Prudential Center in Newark, Sony Hall, or any real card in the five boroughs. Muay Thai and kickboxing cards are doubly interesting. Include cards inside the radar window because they need tickets early.
2. Notable combat-sports community events: fighter meet-ups, gym showcases, open mats with a name attached, Kings Combat events. Routine amateur smokers do not count.
3. Knicks: playoff games, big rivalry games, and proper watch parties with a crowd. Regular-season tickets are not a priority.
4. Watch parties at good bars for a genuinely huge pay-per-view or a major football match (he has Three Lions in his library; a big England match counts).

Rules: verify the venue and date on the promotion's own page or the arena calendar, not a ticket reseller. Note the ticket on-sale date when it is in the future.`,
    hints: [
      "UFC New York 2026 Madison Square Garden",
      "boxing Madison Square Garden OR Barclays Center upcoming card",
      "Muay Thai fight card New York 2026",
      "kickboxing event New York Sony Hall OR Hulu Theater",
      "Prudential Center UFC OR boxing 2026",
      "Lion Fight OR ONE Championship New York",
      "Kings Combat Williamsburg event",
      "Knicks watch party Brooklyn bar",
      "UFC watch party Brooklyn",
    ],
    maxSearches: 12,
    maxFetches: 10,
  },
  {
    id: "food",
    name: "Food, drink and bars",
    brief: `Find the food and bar events, not the restaurants.

Priorities, in order:
1. Chef collaborations, pop-ups, guest takeovers, one-night-only menus, restaurant-in-restaurant nights, especially in Brooklyn.
2. Big shared-table meals built for a group of guys: BBQ, Korean BBQ, hot pot, banquet-style Chinese, whole-animal dinners, tasting menus that seat six, steakhouse nights.
3. Bars doing weird programming: drag wrestling, live pro wrestling at a bar, bingo, punk trivia, karaoke leagues, oddball variety shows, costume nights, roller-skate nights. He loves All Night Skate, Phoenix drag shows, Sunken Harbor Club, Overstory and Raines Law Room, so find what is happening at places like those, and new hidden bars or speakeasies that just opened.
4. Drink events: natural wine fairs, brewery releases and brewery-yard events (Strong Rope, Other Half, Threes, KCBC), cocktail bar takeovers, mezcal or whiskey nights, seasonal pop-up bars (Hanukkah bar, Oktoberfest that is actually German).

Rules: nothing with a two-hour line, nothing viral on TikTok, no brunch parties, no generic happy hours. Every item needs a date or a clear "anytime" flag. Price the meal per person when you can.`,
    hints: [
      "chef collaboration dinner Brooklyn this month",
      "pop-up dinner Brooklyn this weekend",
      "guest chef takeover New York",
      "Tock New York pop-up dinner",
      "drag wrestling Brooklyn",
      "live wrestling bar Brooklyn",
      "new speakeasy opened Brooklyn 2026",
      "natural wine fair New York 2026",
      "brewery release party Brooklyn this weekend",
      "Oktoberfest Brooklyn 2026 German",
      "Korean BBQ group dinner Brooklyn private room",
      "bar bingo OR punk trivia OR karaoke league Bushwick",
    ],
    maxSearches: 14,
    maxFetches: 10,
  },
  {
    id: "culture",
    name: "Culture, comedy and performance",
    brief: `Find performances worth leaving the house for.

Priorities, in order:
1. Company XIV in Bushwick: anything they are staging now or opening soon.
2. Small-room stand-up and secret shows: Don't Tell Comedy secret-location shows, Union Hall, Littlefield, the Bell House, Brooklyn Comedy Collective, the Tiny Cupboard, bar back rooms, apartment shows.
3. Weird variety and immersive: burlesque, magic, live wrestling shows, immersive theater, oddball cabaret, costume screenings (Rocky Horror with a shadow cast, themed movie nights at Nitehawk, Alamo, Kings Theatre), drag shows with a real crowd.
4. Big spectacle for date nights, a few times a year: New York City Ballet, ABT, Lincoln Center, Carnegie Hall, BAM's headline programming, Brooklyn Botanic Garden's light show. The Nutcracker at Lincoln Center is his favorite night in the city; flag its on-sale and run dates in season.
5. Museum nights that are actually parties (Brooklyn Museum First Saturday) and art openings with a crowd.

Rules: no big-arena comedians, no generic Broadway, nothing that reads as a tourist attraction. Under 200 seats is the sweet spot for comedy and variety.`,
    hints: [
      "Company XIV Bushwick current show",
      "Don't Tell Comedy New York upcoming",
      "Union Hall Littlefield Bell House comedy this week",
      "burlesque show Brooklyn this weekend",
      "immersive theater New York 2026",
      "Rocky Horror shadow cast New York",
      "Nitehawk Alamo Drafthouse themed screening this week",
      "New York City Ballet upcoming",
      "BAM Brooklyn upcoming performances",
      "Brooklyn Museum First Saturday",
      "drag show Brooklyn Saturday",
    ],
    maxSearches: 12,
    maxFetches: 10,
  },
  {
    id: "body",
    name: "Sauna, water, bikes and cars",
    brief: `Find the physical, do-something stuff.

Priorities, in order:
1. Sauna and cold-plunge events and socials: Bathhouse, Othership, World Spa, Russian and Turkish Baths, QC NY, Brooklyn banyas, contrast-therapy events, sauna nights with DJs, guided plunges. A full bathhouse day with a friend is one of his favorite things.
2. Pools and beaches: hotel pool day passes (the TWA Hotel pool is a favorite), rooftop pools, Governors Island, beach days at Jacob Riis and Rockaway in season, ferries with a destination.
3. Bike rides: organized group rides, long waterfront rides, car-free street events, night rides. He rode from Lower Manhattan to the George Washington Bridge with friends and loved it.
4. Races, bouldering events, open mats, pickup games with a real organizer. Not run clubs that are dating apps.
5. Car and motorcycle culture: car meets, JDM and Japanese car culture nights (Daikoku NYC is his reference), Classic Car Club Manhattan events, cars-and-coffee that is not corny, motorcycle shop events at Union Garage and Jane Motorcycles, vintage rallies.

Rules: everything must be in the five boroughs or a short ferry or PATH ride away. Give the actual booking page and price.`,
    hints: [
      "cold plunge sauna social Brooklyn this weekend",
      "Bathhouse Williamsburg events",
      "Othership New York events",
      "World Spa Brooklyn day pass events",
      "hotel pool day pass New York this weekend",
      "group bike ride Brooklyn Saturday",
      "Bike New York upcoming rides",
      "car meet New York this weekend",
      "Daikoku NYC car meet",
      "JDM meet Brooklyn Queens",
      "Classic Car Club Manhattan events",
      "Union Garage OR Jane Motorcycles event",
    ],
    maxSearches: 13,
    maxFetches: 10,
  },
  {
    id: "scenes",
    name: "Jewish and German culture, ideas, creative scene, family",
    brief: `Find the cultural, intellectual and family things that fit him.

Priorities, in order:
1. German culture and Berlin: Deutsches Haus, Goethe-Institut, the consulate's community events, German film, German music, Oktoberfest that is actually German, Christmas markets and St. Martin's lantern walks in season, German-language family events (he plays German children's songs for his kid).
2. Jewish culture: cultural events, klezmer in a small room (Barbès), Yiddish theater, holiday programming, museum evenings, Jewish food events, the Hanukkah pop-up bar in season.
3. Ideas: talks, debates and panels with genuinely high-caliber speakers on international relations, geopolitics, energy markets, oil and gas, LNG, metals, shipping and commodity trading. Council on Foreign Relations public events, Columbia's energy center, 92NY, Asia Society, Carnegie Council, Open to Debate, Economic Club style events. Only when the speaker is a real draw.
4. Creative-scene parties: open-studio parties, photo studio events, gallery openings that are actually parties, zine and design fairs.
5. The family pick: one weekend daytime thing for him, his wife and their 1-year-old. Stroller or carrier friendly, done by mid-afternoon, and interesting to the adults. A lantern walk, a German or Jewish family event, a ferry ride with a destination, a small kids' concert in a real venue (Jalopy, Rock and Roll Playhouse), a farmers market with a reason, the botanic garden, a beach morning, a car meet where a toddler can look at engines. Find at least three family candidates.

Rules: cite the organizer's page. Skip anything that is a generic "things to do with kids" listicle.`,
    hints: [
      "Deutsches Haus NYU upcoming events",
      "Goethe-Institut New York events",
      "German community event New York this month",
      "klezmer Barbès Brooklyn",
      "Jewish cultural event Brooklyn this weekend",
      "92NY talks upcoming geopolitics",
      "Council on Foreign Relations public event New York",
      "energy markets talk New York this month",
      "commodity trading event New York",
      "open studios Brooklyn this weekend",
      "kids concert Brooklyn this weekend toddler",
      "family event Brooklyn Saturday toddler",
    ],
    maxSearches: 14,
    maxFetches: 10,
  },
  {
    id: "instagram",
    name: "Instagram",
    brief: `Find what is being announced on Instagram, where most of the small, weird, word-of-mouth stuff in Brooklyn lives and nowhere else.

If you were given a block of recent posts below, that is your primary evidence: read every caption, extract every dated event (parties, pop-ups, fight nights, secret shows, sauna socials, car meets, community events), and turn each into a candidate. Captions say things like "THIS SAT 9/19", "next Thursday", "doors 9"; resolve those against the posting date and today's date. When the caption says "link in bio" or "tickets via Dice", search for the event name to find the actual ticket or RSVP page and use that as the url. If you cannot find a better page, the Instagram post URL itself is an acceptable url with confidence "likely."

If you were not given posts, search the index instead: run site:instagram.com queries for the handles listed and for phrases like "this saturday brooklyn", "pop-up", "day party", "secret show", "fight night" together with the current month. Fetch promising post URLs; Instagram often exposes the caption in the page's og:description even when the page itself will not render.

Priorities: things that would never make a listings site. Small rooms, one-night pop-ups, scene events (car meets, Muay Thai community nights, Afrobeats and dancehall parties, German and Jewish community events), and anything the trusted accounts are personally hyping.

Rules: only dated, real events with a URL. Do not report generic "we're open this weekend" posts. Do not report giveaways. Skip anything already obviously mainstream.`,
    hints: [
      "site:instagram.com brooklyn this saturday",
      "site:instagram.com bushwick pop-up",
      "site:instagram.com day party brooklyn",
      "site:instagram.com secret show brooklyn",
      "site:instagram.com muay thai new york fight night",
      "site:instagram.com daikoku nyc",
      "site:instagram.com afrobeats party brooklyn",
      "site:instagram.com sauna cold plunge brooklyn",
    ],
    maxSearches: 14,
    maxFetches: 12,
  },
];

export const CATEGORIES = [
  "music", "party", "fight", "sports", "food", "bar", "drink", "comedy", "performance",
  "culture", "wellness", "outdoors", "cars", "talk", "community", "family", "holiday", "other",
];

export const CANDIDATES_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    candidates: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: { type: "string", description: "Event name as the organizer writes it" },
          category: { type: "string", enum: CATEGORIES },
          start_date: { anyOf: [{ type: "string" }, { type: "null" }], description: "YYYY-MM-DD in New York, or null for undated/anytime items" },
          end_date: { anyOf: [{ type: "string" }, { type: "null" }], description: "YYYY-MM-DD for runs and multi-day events, else null" },
          time_text: { type: "string", description: "Human time, e.g. 'Thu 9pm doors, headliner around 11'. Empty string if unknown." },
          recurring: { type: "boolean", description: "True for weekly or monthly series" },
          anytime: { type: "boolean", description: "True when it is a place or offer, not a dated event" },
          venue: { type: "string" },
          neighborhood: { type: "string" },
          borough: { type: "string", description: "Brooklyn, Manhattan, Queens, Bronx, Staten Island, Newark, or Other" },
          price_text: { type: "string", description: "e.g. '$45 advance, $60 door', 'free', 'about $90 per person'. Empty string if unknown." },
          url: { type: "string", description: "The organizer's or ticketing page for this exact event" },
          source_url: { type: "string", description: "Where you confirmed the details, if different from url" },
          summary: { type: "string", description: "Two or three factual sentences: who, what, where, what it costs" },
          fit: { type: "string", description: "One or two sentences on why this fits him specifically, referencing the profile" },
          confidence: {
            type: "string",
            enum: ["verified", "likely", "unverified"],
            description: "verified = you read the organizer page and the date/venue match; likely = strong secondary source; unverified = a single search snippet",
          },
          who: { type: "string", enum: ["guys", "wife", "either", "family"] },
          tags: { type: "array", items: { type: "string" } },
        },
        required: [
          "title", "category", "start_date", "end_date", "time_text", "recurring", "anytime", "venue", "neighborhood",
          "borough", "price_text", "url", "source_url", "summary", "fit", "confidence", "who", "tags",
        ],
      },
    },
    notes: { type: "string", description: "What was thin, what you could not verify, sources that failed to load" },
  },
  required: ["candidates", "notes"],
};
