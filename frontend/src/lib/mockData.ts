import type { Recommendation } from "@/types/simulation";

// ── Location & Viewport ──────────────────────────────────────────────

export const MOCK_LOCATION = { lat: 40.758, lng: -73.9855 };

export const MOCK_VIEWPORT = {
  low: { latitude: 40.75, longitude: -73.995 },
  high: { latitude: 40.765, longitude: -73.975 },
};

// ── Recommendations ──────────────────────────────────────────────────

export const MOCK_RECOMMENDATIONS: Recommendation[] = [
  {
    name: "Osteria La Baia",
    rating: 4.9,
    description:
      "Traditional and creative Italian cuisine plus cocktails in a spacious venue with chic, polished decor.",
    lat: 40.7618881,
    lng: -73.9809702,
    photoUrls: [
      "/mock/osteria-la-baia-1.jpg",
      "/mock/osteria-la-baia-2.jpg",
      "/mock/osteria-la-baia-3.jpg",
    ],
    reviews: [
      {
        authorName: "Kathy D",
        rating: 5,
        text: "Dined at this restaurant solo so only tried a couple of items but what I had was absolutely delicious and I will be back to try more options. Lovely decor and very comfortable bar seating.",
        timeAgo: "2 weeks ago",
      },
      {
        authorName: "Andria Nares",
        rating: 5,
        text: "Mauricio A was our server tonight and he made our dining experience here so amazing. Warm, welcoming, knowledgeable about drinks and dishes. We can\u2019t wait to come back.",
        timeAgo: "a month ago",
      },
      {
        authorName:
          "\u0410\u043b\u0438\u043d\u0430 \u0421\u0440\u0438\u0431\u043d\u0430",
        rating: 5,
        text: "Osteria La Baia is a fantastic Italian restaurant in NY city. The atmosphere is warm and comfortable without feeling over the top, making it perfect for both date nights and dinners with friends.",
        timeAgo: "a week ago",
      },
    ],
    address: "129 W 52nd St, New York, NY 10019, USA",
    phone: "+1 917-671-9898",
    website: "https://www.labaianyc.com/",
    hours: [
      "Monday: 11:30\u202fAM\u2009\u2013\u200911:00\u202fPM",
      "Tuesday: 11:30\u202fAM\u2009\u2013\u200911:00\u202fPM",
      "Wednesday: 11:30\u202fAM\u2009\u2013\u200911:00\u202fPM",
      "Thursday: 11:30\u202fAM\u2009\u2013\u200911:00\u202fPM",
      "Friday: 11:30\u202fAM\u2009\u2013\u200912:00\u202fAM",
      "Saturday: 11:30\u202fAM\u2009\u2013\u200912:00\u202fAM",
      "Sunday: 11:30\u202fAM\u2009\u2013\u200910:00\u202fPM",
    ],
    priceLevel: "$$$$",
    ratingCount: 5013,
    routingPath: [
      [40.75796, -73.98554],
      [40.75849, -73.98502],
      [40.75911, -73.98459],
      [40.75974, -73.98414],
      [40.76049, -73.98354],
      [40.76111, -73.98309],
      [40.76163, -73.98276],
      [40.76225, -73.98229],
      [40.76197, -73.98127],
      [40.76185, -73.981],
    ],
  },
  {
    name: "STK Steakhouse",
    rating: 4.8,
    description:
      "Sceney spot that\u2019s both a chic lounge with DJs & a modern steakhouse serving prime cuts & seafood.",
    lat: 40.754721,
    lng: -73.982759,
    photoUrls: [
      "/mock/stk-steakhouse-1.jpg",
      "/mock/stk-steakhouse-2.jpg",
      "/mock/stk-steakhouse-3.jpg",
    ],
    reviews: [
      {
        authorName: "Jacqueline Escobar",
        rating: 4,
        text: "We were invited back to STK for a Chef\u2019s Tasting by management to make up for the poor first experience we had. The menu wasn\u2019t that thrilling but it was definitely a better experience than our last.",
        timeAgo: "a week ago",
      },
      {
        authorName: "Evgeny Skachkov",
        rating: 5,
        text: "After I posted my complaint, the restaurant invited us to a complimentary Chef\u2019s tasting as an apology. This time everything went very well, and we were not charged for anything.",
        timeAgo: "a week ago",
      },
      {
        authorName: "Chrissy Monroe",
        rating: 5,
        text: "Went out with my friends the other night for a fun girls night out, I love STK. They have always been very consistent and the atmosphere is fun with an upbeat vibe great music, excellent cocktails.",
        timeAgo: "a month ago",
      },
    ],
    address: "1114 6th Ave, New York, NY 10036, USA",
    phone: "+1 646-624-2455",
    website: "https://stksteakhouse.com/venues/nyc-midtown/",
    hours: [
      "Monday: 11:00\u202fAM\u2009\u2013\u200911:00\u202fPM",
      "Tuesday: 11:00\u202fAM\u2009\u2013\u200911:00\u202fPM",
      "Wednesday: 11:00\u202fAM\u2009\u2013\u200911:00\u202fPM",
      "Thursday: 11:00\u202fAM\u2009\u2013\u200912:00\u202fAM",
      "Friday: 11:00\u202fAM\u2009\u2013\u200912:00\u202fAM",
      "Saturday: 11:00\u202fAM\u2009\u2013\u200912:00\u202fAM",
      "Sunday: 10:00\u202fAM\u2009\u2013\u200912:00\u202fAM",
    ],
    priceLevel: "$$$",
    ratingCount: 36180,
    routingPath: [
      [40.75796, -73.98554],
      [40.75735, -73.98581],
      [40.75663, -73.98611],
      [40.75661, -73.98641],
      [40.75551, -73.9838],
      [40.755, -73.98256],
    ],
  },
  {
    name: "La Pecora Bianca Bryant Park",
    rating: 4.8,
    description:
      "Stylish, bright eatery featuring market-driven Italian cuisine, regional wines & aperitifs.",
    lat: 40.7525176,
    lng: -73.9831529,
    photoUrls: [
      "/mock/la-pecora-bianca-1.jpg",
      "/mock/la-pecora-bianca-2.jpg",
      "/mock/la-pecora-bianca-3.jpg",
    ],
    reviews: [
      {
        authorName: "Jenny Ramos",
        rating: 5,
        text: "My husband chose this location for our Valentine Dinner. I was pleasantly surprised. It had a great price for NYC. But the food made it better. It was all delicious and properly prepared.",
        timeAgo: "2 weeks ago",
      },
      {
        authorName: "Albert Husmillo",
        rating: 4,
        text: "Had a wonderful birthday dinner here. It was packed on a Thursday night. Our server was the nicest, warm and accommodating and made sure we got everything we needed.",
        timeAgo: "a week ago",
      },
      {
        authorName: "M B",
        rating: 5,
        text: "We had reservations and were seated immediately on a busy Saturday night. The restaurant is gorgeous and the service is fantastic. The rigatoni with vodka sauce and the chicken Parm was fantastic.",
        timeAgo: "a month ago",
      },
    ],
    address: "20 W 40th St, New York, NY 10018, USA",
    phone: "+1 212-924-4040",
    website: "https://www.lapecorabianca.com/",
    hours: [
      "Monday: 7:00\u202fAM\u2009\u2013\u200910:00\u202fPM",
      "Tuesday: 7:00\u202fAM\u2009\u2013\u200910:00\u202fPM",
      "Wednesday: 7:00\u202fAM\u2009\u2013\u200910:00\u202fPM",
      "Thursday: 7:00\u202fAM\u2009\u2013\u200911:00\u202fPM",
      "Friday: 7:00\u202fAM\u2009\u2013\u200911:00\u202fPM",
      "Saturday: 8:00\u202fAM\u2009\u2013\u200911:00\u202fPM",
      "Sunday: 8:00\u202fAM\u2009\u2013\u200910:00\u202fPM",
    ],
    priceLevel: "$$$",
    ratingCount: 6610,
    routingPath: [
      [40.75796, -73.98554],
      [40.75735, -73.98581],
      [40.75663, -73.98611],
      [40.75551, -73.9838],
      [40.75499, -73.98417],
      [40.75471, -73.98407],
      [40.75399, -73.98287],
      [40.7528, -73.98341],
      [40.75265, -73.98306],
    ],
  },
  {
    name: "Ocean Prime",
    rating: 4.6,
    description:
      "Upscale chain known for its sophisticated decor, long wine list & classic steak & seafood menu.",
    lat: 40.7617296,
    lng: -73.9806295,
    photoUrls: [
      "/mock/ocean-prime-1.jpg",
      "/mock/ocean-prime-2.jpg",
      "/mock/ocean-prime-3.jpg",
    ],
    reviews: [
      {
        authorName: "Tom Zahn",
        rating: 1,
        text: "I\u2019m disappointed to share that my experience at this restaurant fell far short of expectations, primarily due to how I was treated upon arrival.",
        timeAgo: "a month ago",
      },
      {
        authorName: "Caroline Montana",
        rating: 5,
        text: "Our experience at Ocean Prime was wonderful. We reserved a table and were seated outside a window that looks into the kitchen, which my boyfriend enjoyed. The drinks were delicious and the food was excellent.",
        timeAgo: "2 months ago",
      },
      {
        authorName: "Calvin Tarlton",
        rating: 5,
        text: "Very nice steak at Ocean Prime. Service was excellent. My water glass was never more than half empty! Steak was cooked perfectly and the bacon creamed spinach was outstanding.",
        timeAgo: "3 weeks ago",
      },
    ],
    address: "123 W 52nd St, New York, NY 10019, USA",
    phone: "+1 212-956-1404",
    website: "https://www.ocean-prime.com/locations/new-york-city",
    hours: [
      "Monday: 11:30\u202fAM\u2009\u2013\u200910:00\u202fPM",
      "Tuesday: 11:30\u202fAM\u2009\u2013\u200910:00\u202fPM",
      "Wednesday: 11:30\u202fAM\u2009\u2013\u200910:00\u202fPM",
      "Thursday: 11:30\u202fAM\u2009\u2013\u200910:00\u202fPM",
      "Friday: 11:30\u202fAM\u2009\u2013\u200910:00\u202fPM",
      "Saturday: 4:00\u2009\u2013\u200910:00\u202fPM",
      "Sunday: 4:00\u2009\u2013\u20099:00\u202fPM",
    ],
    priceLevel: "$$$",
    ratingCount: 2587,
    routingPath: [
      [40.75796, -73.98554],
      [40.75849, -73.98502],
      [40.75911, -73.98459],
      [40.75974, -73.98414],
      [40.76049, -73.98354],
      [40.76111, -73.98309],
      [40.76163, -73.98276],
      [40.76225, -73.98229],
      [40.76197, -73.98127],
      [40.76169, -73.98066],
    ],
  },
  {
    name: "The Terrace at Times Square EDITION",
    rating: 4.4,
    description:
      "All-day eatery serving French brasserie & American chophouse fare at the Times Square EDITION hotel.",
    lat: 40.759149,
    lng: -73.984164,
    photoUrls: [
      "/mock/terrace-edition-1.jpg",
      "/mock/terrace-edition-2.jpg",
      "/mock/terrace-edition-3.jpg",
    ],
    reviews: [
      {
        authorName: "Nuria El",
        rating: 5,
        text: "One of the best restaurants I\u2019ve tried in NYC! The food was absolutely delicious \u2014 every dish was full of flavor and cooked perfectly. Yes, it\u2019s a bit on the pricey side, but honestly worth every dollar.",
        timeAgo: "3 months ago",
      },
      {
        authorName: "Anand",
        rating: 5,
        text: "Nice restaurant located right in the middle of Times Square. The food over here is well prepared. The service is very good but their vegetarian options are limited. The focaccia is amazing.",
        timeAgo: "2 months ago",
      },
      {
        authorName: "Foodie Elite",
        rating: 5,
        text: "An unforgettable night with the legendary John Cameron Mitchell live performance \u2014 Broadway magic up close and personal. Paired with a Michelin-level dining experience by Chef John Fraser.",
        timeAgo: "a month ago",
      },
    ],
    address: "701 7th Ave 9th floor, New York, NY 10036, USA",
    phone: "+1 212-261-5400",
    website: "https://www.terraceatedition.com/",
    hours: [
      "Monday: 7:00\u202fAM\u2009\u2013\u200910:00\u202fPM",
      "Tuesday: 7:00\u202fAM\u2009\u2013\u200910:00\u202fPM",
      "Wednesday: 7:00\u202fAM\u2009\u2013\u200910:00\u202fPM",
      "Thursday: 7:00\u202fAM\u2009\u2013\u200910:00\u202fPM",
      "Friday: 7:00\u202fAM\u2009\u2013\u200910:00\u202fPM",
      "Saturday: 7:00\u202fAM\u2009\u2013\u200910:00\u202fPM",
      "Sunday: 7:00\u202fAM\u2009\u2013\u200910:00\u202fPM",
    ],
    priceLevel: "$$$$",
    ratingCount: 946,
    routingPath: [
      [40.75796, -73.98554],
      [40.75849, -73.98502],
      [40.75861, -73.98493],
      [40.75911, -73.98459],
      [40.75922, -73.98448],
      [40.7591, -73.9842],
    ],
  },
];

// ── Profile / Insight Data ───────────────────────────────────────────

export const MOCK_PROFILE_DATA: Record<string, unknown> = {
  neighborhood_name: "Midtown Manhattan",
  tagline: "The Crossroads of the World",
  vibe_description:
    "An electrifying mix of Broadway theaters, world-class dining, and iconic landmarks — Midtown hums with energy 24/7. From neon-lit Times Square to the serene paths of Bryant Park, every block tells a different story.",
  best_for: [
    "First-time NYC visitors",
    "Theater lovers",
    "Foodies exploring diverse cuisines",
    "People-watching enthusiasts",
  ],
  not_ideal_for: [
    "Those seeking quiet, residential vibes",
    "Budget-conscious travelers (dining is pricey)",
  ],
  scores: {
    "Dining & Nightlife": { value: 92, note: "World-class restaurant density" },
    Walkability: { value: 95, note: "Flat grid, excellent sidewalks" },
    Safety: { value: 78, note: "Well-patrolled tourist area" },
    "Culture & Entertainment": {
      value: 97,
      note: "Broadway, museums, landmarks",
    },
    "Green Space": {
      value: 65,
      note: "Bryant Park nearby, Central Park a walk north",
    },
  },
  highlights: [
    {
      title: "Broadway Theater District",
      description: "Over 40 professional theaters within walking distance.",
      icon_identifier: "theater",
    },
    {
      title: "Bryant Park",
      description:
        "A lush urban oasis with free events, Wi-Fi, and seasonal markets.",
      icon_identifier: "park",
    },
    {
      title: "Diverse Food Scene",
      description: "From $1 pizza slices to Michelin-starred tasting menus.",
      icon_identifier: "restaurant",
    },
  ],
  insider_tip:
    "Skip the chain restaurants on Broadway — duck one block east or west for far better food at half the price. The side streets between 8th and 9th Ave hide some of the best Thai and Japanese spots in the city.",
  weather: {
    temperature: 72,
    condition: "Partly Cloudy",
    is_day: true,
    render_state: "clear",
    ai_summary:
      "Pleasant spring afternoon with partly cloudy skies. Temperatures in the low 70s with a light breeze — perfect for walking around Midtown.",
  },
};

// ── Weather (standalone for render_state) ────────────────────────────

export const MOCK_WEATHER = {
  temperature: 72,
  condition: "Partly Cloudy",
  is_day: true,
  render_state: "clear",
  ai_summary:
    "Pleasant spring afternoon with partly cloudy skies. Temperatures in the low 70s with a light breeze — perfect for walking around Midtown.",
};

// ── Drone Waypoints ──────────────────────────────────────────────────

export const MOCK_DRONE_WAYPOINTS = [
  {
    label: "Osteria La Baia",
    latitude: 40.7618881,
    longitude: -73.9809702,
    altitude: 250,
    heading: 45,
    pitch: -30,
    roll: 0,
    duration: 4,
    pause_after: 2,
  },
  {
    label: "STK Steakhouse",
    latitude: 40.754721,
    longitude: -73.982759,
    altitude: 200,
    heading: 120,
    pitch: -35,
    roll: 0,
    duration: 4,
    pause_after: 2,
  },
  {
    label: "La Pecora Bianca",
    latitude: 40.7525176,
    longitude: -73.9831529,
    altitude: 180,
    heading: 210,
    pitch: -40,
    roll: 0,
    duration: 3,
    pause_after: 2,
  },
  {
    label: "Ocean Prime",
    latitude: 40.7617296,
    longitude: -73.9806295,
    altitude: 220,
    heading: 300,
    pitch: -25,
    roll: 0,
    duration: 4,
    pause_after: 2,
  },
  {
    label: "The Terrace at Times Square EDITION",
    latitude: 40.759149,
    longitude: -73.984164,
    altitude: 160,
    heading: 170,
    pitch: -45,
    roll: 0,
    duration: 3,
    pause_after: 2,
  },
];
