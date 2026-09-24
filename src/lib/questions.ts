export type Category =
  | 'General Knowledge'
  | 'Crypto'
  | 'Word Blitz'
  | 'Emoji Decoder'
  | 'Logic & Math Arena'
  | 'Candle Rush'
  | 'Bomb Tag'
  | 'Sports'
  | 'Pop Culture'
  | 'Science'
  | 'History'

export interface SubCategoryInfo {
  id: Category
  name: string
  emoji: string
  tagline: string
  badge?: string
  roundDuration?: string
  playerCapacity: string
  maxPlayers: number
}

export interface CategoryGroup {
  id: string
  name: string
  emoji: string
  tagline: string
  badge?: string
  subcategories: SubCategoryInfo[]
}

export const CATEGORY_GROUPS: CategoryGroup[] = [
  {
    id: 'crypto_markets',
    name: 'Crypto & Markets',
    emoji: '🪙',
    tagline: 'Onchain trivia, market candles & web3 culture',
    badge: 'Popular',
    subcategories: [
      {
        id: 'Crypto',
        name: 'Crypto & Web3',
        emoji: '🪙',
        tagline: 'Bitcoin, Ethereum, DeFi & Smart Contracts',
        badge: 'High Stakes',
        roundDuration: '10s rounds',
        playerCapacity: 'Up to 50 players',
        maxPlayers: 50,
      },
      {
        id: 'Candle Rush',
        name: 'Candle Rush',
        emoji: '📈',
        tagline: 'Fast chart patterns, price spikes & halving cycles',
        badge: 'Fast-Paced',
        roundDuration: '10s rounds',
        playerCapacity: 'Up to 24 players',
        maxPlayers: 24,
      },
    ],
  },
  {
    id: 'puzzles_logic',
    name: 'Puzzles & Brain Arena',
    emoji: '🧩',
    tagline: 'Word scrambles, math speed grids & emoji decoders',
    badge: 'High IQ',
    subcategories: [
      {
        id: 'Word Blitz',
        name: 'Word Blitz',
        emoji: '🔤',
        tagline: 'Anagram royales, speed scrambles & vocabulary rushes',
        badge: 'Wordle Style',
        roundDuration: '12s rounds',
        playerCapacity: 'Up to 16 players',
        maxPlayers: 16,
      },
      {
        id: 'Emoji Decoder',
        name: 'Emoji Decoder',
        emoji: '🧩',
        tagline: 'Crack emoji clues for crypto slang, pop icons & movies',
        badge: 'Visual Rush',
        roundDuration: '10s rounds',
        playerCapacity: 'Up to 20 players',
        maxPlayers: 20,
      },
      {
        id: 'Logic & Math Arena',
        name: 'Logic & Math Arena',
        emoji: '⚡',
        tagline: 'Rapid mental arithmetic, sequences & probability',
        badge: 'Pure Skill',
        roundDuration: '15s rounds',
        playerCapacity: 'Up to 12 players',
        maxPlayers: 12,
      },
    ],
  },
  {
    id: 'social_elimination',
    name: 'Party & Sudden Death',
    emoji: '💣',
    tagline: 'High pressure elimination & social showdowns',
    badge: 'Social Party',
    subcategories: [
      {
        id: 'Bomb Tag',
        name: 'Bomb Tag',
        emoji: '💣',
        tagline: 'Sudden death rapid trivia — answer fast or get blasted',
        badge: 'Elimination',
        roundDuration: '8s rounds',
        playerCapacity: '2–8 players',
        maxPlayers: 8,
      },
    ],
  },
  {
    id: 'classic_knowledge',
    name: 'Classic Knowledge',
    emoji: '🧠',
    tagline: 'Science, history, sports & global pop culture',
    subcategories: [
      {
        id: 'General Knowledge',
        name: 'General Knowledge',
        emoji: '🧠',
        tagline: 'World geography, records, nature & civilization',
        badge: 'Classic',
        roundDuration: '10s rounds',
        playerCapacity: 'Up to 50 players',
        maxPlayers: 50,
      },
      {
        id: 'Science',
        name: 'Science & Cosmos',
        emoji: '🔬',
        tagline: 'Physics, biology, space exploration & chemistry',
        badge: 'Discovery',
        roundDuration: '10s rounds',
        playerCapacity: 'Up to 30 players',
        maxPlayers: 30,
      },
      {
        id: 'History',
        name: 'World History',
        emoji: '📜',
        tagline: 'Empires, revolutions, historical figures & milestones',
        badge: 'Lore',
        roundDuration: '10s rounds',
        playerCapacity: 'Up to 30 players',
        maxPlayers: 30,
      },
      {
        id: 'Pop Culture',
        name: 'Pop Culture',
        emoji: '🎬',
        tagline: 'Blockbuster movies, hit music, gaming & streaming',
        badge: 'Entertainment',
        roundDuration: '10s rounds',
        playerCapacity: 'Up to 40 players',
        maxPlayers: 40,
      },
      {
        id: 'Sports',
        name: 'Sports & Olympics',
        emoji: '🏆',
        tagline: 'Football, basketball, championships & athletes',
        badge: 'Champions',
        roundDuration: '10s rounds',
        playerCapacity: 'Up to 30 players',
        maxPlayers: 30,
      },
    ],
  },
]

export const ALL_CATEGORIES: Category[] = [
  'General Knowledge',
  'Crypto',
  'Word Blitz',
  'Emoji Decoder',
  'Logic & Math Arena',
  'Candle Rush',
  'Bomb Tag',
  'Sports',
  'Pop Culture',
  'Science',
  'History',
]

export interface TriviaQuestion {
  question: string
  options: string[]
  correctIndex: number
}

const QUESTION_BANK: Record<Category, TriviaQuestion[]> = {
  'General Knowledge': [
    { question: 'What is the capital of Japan?', options: ['Seoul', 'Beijing', 'Tokyo', 'Bangkok'], correctIndex: 2 },
    { question: 'How many continents are there on Earth?', options: ['5', '6', '7', '8'], correctIndex: 2 },
    { question: 'Which element has the chemical symbol "O"?', options: ['Gold', 'Oxygen', 'Osmium', 'Silver'], correctIndex: 1 },
    { question: 'Who painted the Mona Lisa?', options: ['Michelangelo', 'Van Gogh', 'Raphael', 'Leonardo da Vinci'], correctIndex: 3 },
    { question: 'What is the largest ocean on Earth?', options: ['Atlantic', 'Indian', 'Arctic', 'Pacific'], correctIndex: 3 },
    { question: 'How many sides does a hexagon have?', options: ['5', '6', '7', '8'], correctIndex: 1 },
    { question: 'What is the hardest natural substance on Earth?', options: ['Gold', 'Iron', 'Diamond', 'Titanium'], correctIndex: 2 },
    { question: 'Which planet is known as the Red Planet?', options: ['Venus', 'Jupiter', 'Mars', 'Saturn'], correctIndex: 2 },
    { question: 'How many bones are in the adult human body?', options: ['186', '196', '206', '216'], correctIndex: 2 },
    { question: 'What language has the most native speakers?', options: ['English', 'Spanish', 'Mandarin', 'Hindi'], correctIndex: 2 },
  ],
  Crypto: [
    { question: 'Who created Bitcoin?', options: ['Vitalik Buterin', 'Satoshi Nakamoto', 'Charlie Lee', 'Nick Szabo'], correctIndex: 1 },
    { question: 'What is the maximum supply of Bitcoin?', options: ['18 million', '21 million', '100 million', 'Unlimited'], correctIndex: 1 },
    { question: 'What does "USDC" stand for?', options: ['Universal Stable Digital Currency', 'US Dollar Coin', 'United Stablecoin Digital Currency', 'US Decentralized Currency'], correctIndex: 1 },
    { question: 'Which company created Ethereum?', options: ['Ethereum Foundation', 'Consensys', 'Polygon Labs', 'Circle'], correctIndex: 0 },
    { question: 'What is a "gas fee" in Ethereum?', options: ['A fee for storing data', 'A fee for executing transactions', 'A fee for minting tokens', 'A fee for bridging assets'], correctIndex: 1 },
    { question: 'What does NFT stand for?', options: ['New Financial Token', 'Non-Fungible Token', 'Network Fee Transaction', 'Node Finality Tool'], correctIndex: 1 },
    { question: 'What consensus mechanism does Bitcoin use?', options: ['Proof of Stake', 'Proof of Work', 'Delegated Proof of Stake', 'Proof of Authority'], correctIndex: 1 },
    { question: 'What is the native token of Arc?', options: ['ARC', 'ETH', 'USDC', 'MATIC'], correctIndex: 2 },
    { question: 'What does "DeFi" stand for?', options: ['Decentralized Filing', 'Digital Finance', 'Decentralized Finance', 'Distributed Fintech'], correctIndex: 2 },
    { question: 'Which blockchain introduced smart contracts?', options: ['Bitcoin', 'Litecoin', 'Ripple', 'Ethereum'], correctIndex: 3 },
  ],
  'Word Blitz': [
    { question: 'Unscramble the word: "C B L K C H N I A O"', options: ['BLOCKCHAIN', 'BITCOIN', 'CHAINLOCK', 'BLACKCHAIN'], correctIndex: 0 },
    { question: 'Find the antonym of "EXPEDITE":', options: ['Accelerate', 'Delay', 'Hasten', 'Quicken'], correctIndex: 1 },
    { question: 'Which word means "a state of noisy confusion"?', options: ['Tranquility', 'Bedlam', 'Silence', 'Serenity'], correctIndex: 1 },
    { question: 'Unscramble the word: "E T R H E U M U"', options: ['ETHEREUM', 'EUROTHEM', 'METHEUR', 'ETHERIUM'], correctIndex: 0 },
    { question: 'Complete the palindrome: "RAC_CAR"', options: ['E', 'O', 'A', 'I'], correctIndex: 0 },
    { question: 'Which word is an anagram of "SILENT"?', options: ['LISTEN', 'INSECT', 'TINSEL', 'NEATLY'], correctIndex: 0 },
    { question: 'Unscramble the word: "S O L A N A"', options: ['SOLANA', 'SALOON', 'ALONAS', 'SALONA'], correctIndex: 0 },
    { question: 'What is a group of crows called?', options: ['Flock', 'Pack', 'Murder', 'Swarm'], correctIndex: 2 },
    { question: 'Which word is spelled correctly?', options: ['Definately', 'Definitely', 'Defenetly', 'Definatly'], correctIndex: 1 },
    { question: 'Which word means "having unlimited power"?', options: ['Omnipotent', 'Omniscient', 'Omnipresent', 'Omnivorous'], correctIndex: 0 },
  ],
  'Emoji Decoder': [
    { question: 'Decode the movie: 🦁 👑', options: ['The Lion King', 'Madagascar', 'Jungle Book', 'Tarzan'], correctIndex: 0 },
    { question: 'Decode the crypto term: 🐋 🌊 💰', options: ['Crypto Whale', 'Dolphin Hodler', 'Tidal Pool', 'Sea Swap'], correctIndex: 0 },
    { question: 'Decode the movie: 🚢 🧊 💔', options: ['Titanic', 'Cast Away', 'Frozen', 'Poseidon'], correctIndex: 0 },
    { question: 'Decode the country: 🗼 🥐 🥖 🍷', options: ['Italy', 'France', 'Spain', 'Germany'], correctIndex: 1 },
    { question: 'Decode the song: 👁️ 🐅 🥊', options: ['Eye of the Tiger', 'Roar', 'Survivor', 'The Boxer'], correctIndex: 0 },
    { question: 'Decode the movie: ⚡ 🧙‍♂️ 👓 🦉', options: ['Lord of the Rings', 'Percy Jackson', 'Harry Potter', 'Doctor Strange'], correctIndex: 2 },
    { question: 'Decode the crypto slang: 💎 🙌', options: ['Diamond Hands', 'Paper Hands', 'Moon Bag', 'Rocket Hands'], correctIndex: 0 },
    { question: 'Decode the brand: 🍎 📱 💻', options: ['Apple', 'Microsoft', 'Samsung', 'Google'], correctIndex: 0 },
    { question: 'Decode the movie: 👻 🚫 🔫', options: ['Ghostbusters', 'Casper', 'Poltergeist', 'Beetlejuice'], correctIndex: 0 },
    { question: 'Decode the crypto phrase: 🚀 🌕', options: ['To the Moon', 'Starship Launch', 'Space Mission', 'Lunar Rocket'], correctIndex: 0 },
  ],
  'Logic & Math Arena': [
    { question: 'Solve: 12 × 12 - 44 = ?', options: ['100', '110', '120', '90'], correctIndex: 0 },
    { question: 'What comes next in the sequence: 2, 4, 8, 16, 32, __?', options: ['48', '60', '64', '128'], correctIndex: 2 },
    { question: 'If 5 cats catch 5 mice in 5 minutes, how many minutes do 100 cats take to catch 100 mice?', options: ['100', '50', '5', '1'], correctIndex: 2 },
    { question: 'Solve: (8 + 8 ÷ 2) × 3 = ?', options: ['36', '24', '48', '18'], correctIndex: 0 },
    { question: 'A bat and ball cost $1.10. The bat costs $1.00 more than the ball. How much is the ball?', options: ['$0.10', '$0.05', '$0.01', '$0.15'], correctIndex: 1 },
    { question: 'What is the square root of 144?', options: ['11', '12', '13', '14'], correctIndex: 1 },
    { question: 'Solve for X: 3X + 15 = 45', options: ['5', '10', '15', '20'], correctIndex: 1 },
    { question: 'What is 15% of 200?', options: ['20', '25', '30', '35'], correctIndex: 2 },
    { question: 'How many prime numbers are between 1 and 10?', options: ['3', '4', '5', '6'], correctIndex: 1 },
    { question: 'If you flip a fair coin 3 times, what is the probability of getting all heads?', options: ['1/2', '1/4', '1/8', '1/16'], correctIndex: 2 },
  ],
  'Candle Rush': [
    { question: 'What candlestick pattern typically indicates a strong bullish reversal after a downtrend?', options: ['Hammer', 'Shooting Star', 'Bearish Engulfing', 'Evening Star'], correctIndex: 0 },
    { question: 'What happens to Bitcoin block mining rewards roughly every 4 years?', options: ['They double', 'They are cut in half (Halving)', 'They remain static', 'They drop to 0'], correctIndex: 1 },
    { question: 'What indicator measures momentum on a 0-100 scale to detect overbought/oversold levels?', options: ['MACD', 'RSI (Relative Strength Index)', 'Bollinger Bands', 'Fibonacci Levels'], correctIndex: 1 },
    { question: 'What was Bitcoin\'s approximate all-time high during the 2021 bull run cycle?', options: ['$48,000', '$69,000', '$92,000', '$35,000'], correctIndex: 1 },
    { question: 'What term describes a sustained declining market filled with pessimistic sentiment?', options: ['Bull Market', 'Bear Market', 'Crab Market', 'Parabolic Run'], correctIndex: 1 },
    { question: 'What does a green candlestick signify on a standard price chart?', options: ['Close price is higher than open price', 'Close price is lower than open price', 'Zero volume traded', 'Trading halted'], correctIndex: 0 },
    { question: 'What rapid price surge occurs when heavily shorted assets force sellers to buy back?', options: ['Flash Crash', 'Short Squeeze', 'Rug Pull', 'Liquidity Drain'], correctIndex: 1 },
    { question: 'In order books, what is the spread between the highest bid and lowest ask price called?', options: ['Slippage', 'Bid-Ask Spread', 'Arbitrage', 'Delta'], correctIndex: 1 },
    { question: 'Which metric represents total USD value of all assets locked into a DeFi protocol?', options: ['FDV', 'TVL (Total Value Locked)', 'Market Cap', 'Circulating Supply'], correctIndex: 1 },
    { question: 'Which chart pattern features three peaks with the highest in the middle, signaling a bearish turn?', options: ['Cup and Handle', 'Double Bottom', 'Head and Shoulders', 'Ascending Triangle'], correctIndex: 2 },
  ],
  'Bomb Tag': [
    { question: '⚡ SUDDEN DEATH: How many seconds does a standard Trivio speed round give you?', options: ['5s', '10s', '30s', '60s'], correctIndex: 1 },
    { question: '💣 DEFUSE: Which of these is a Layer-1 blockchain?', options: ['Arbitrum', 'Optimism', 'Ethereum', 'Base'], correctIndex: 2 },
    { question: '🔥 HOT POTATO: What does EVM stand for in crypto?', options: ['Ethereum Virtual Machine', 'Ether Value Metric', 'Electronic Voting Module', 'Exchange Verification Method'], correctIndex: 0 },
    { question: '⚡ SNAP DECISION: What is 7 × 8?', options: ['54', '56', '58', '64'], correctIndex: 1 },
    { question: '💣 DEFUSE: What was the first cryptographic cryptocurrency ever created?', options: ['Litecoin', 'Namecoin', 'Bitcoin', 'Peercoin'], correctIndex: 2 },
    { question: '🔥 PASS THE BOMB: Which continent has zero native reptiles or snakes?', options: ['Europe', 'Antarctica', 'Australia', 'South America'], correctIndex: 1 },
    { question: '⚡ SNAP DECISION: Which gas makes up roughly 78% of Earth\'s atmosphere?', options: ['Oxygen', 'Carbon Dioxide', 'Nitrogen', 'Argon'], correctIndex: 2 },
    { question: '💣 DEFUSE: In poker, which hand beats a standard Flush?', options: ['Two Pair', 'Straight', 'Full House', 'Three of a Kind'], correctIndex: 2 },
    { question: '🔥 HOT POTATO: What year was the Bitcoin Genesis block mined?', options: ['2007', '2008', '2009', '2010'], correctIndex: 2 },
    { question: '⚡ SUDDEN DEATH: How many sides does an Octagon have?', options: ['6', '7', '8', '10'], correctIndex: 2 },
  ],
  Sports: [
    { question: 'How many players are on a soccer team?', options: ['9', '10', '11', '12'], correctIndex: 2 },
    { question: 'Which country won the 2022 FIFA World Cup?', options: ['Brazil', 'France', 'Argentina', 'Germany'], correctIndex: 2 },
    { question: 'How many rings are on the Olympic flag?', options: ['3', '4', '5', '6'], correctIndex: 2 },
    { question: 'In which sport would you perform a "slam dunk"?', options: ['Volleyball', 'Football', 'Tennis', 'Basketball'], correctIndex: 3 },
    { question: 'How often are the Summer Olympics held?', options: ['Every 2 years', 'Every 3 years', 'Every 4 years', 'Every 5 years'], correctIndex: 2 },
    { question: 'What sport is played at Wimbledon?', options: ['Golf', 'Cricket', 'Tennis', 'Badminton'], correctIndex: 2 },
    { question: 'How many players are in a basketball team on the court?', options: ['4', '5', '6', '7'], correctIndex: 1 },
    { question: 'In which country did the marathon originate?', options: ['Italy', 'Egypt', 'Greece', 'Turkey'], correctIndex: 2 },
    { question: 'What is the diameter of a basketball hoop in inches?', options: ['16 inches', '18 inches', '20 inches', '22 inches'], correctIndex: 1 },
    { question: 'How long is a standard marathon?', options: ['26.1 miles', '26.2 miles', '26.3 miles', '26.5 miles'], correctIndex: 1 },
  ],
  'Pop Culture': [
    { question: 'Which movie features the quote "May the Force be with you"?', options: ['Avengers', 'Star Trek', 'Star Wars', 'Guardians of the Galaxy'], correctIndex: 2 },
    { question: 'What streaming platform released "Stranger Things"?', options: ['HBO', 'Disney+', 'Netflix', 'Amazon Prime'], correctIndex: 2 },
    { question: 'Who sang "Shape of You"?', options: ['Justin Bieber', 'Bruno Mars', 'Ed Sheeran', 'Sam Smith'], correctIndex: 2 },
    { question: 'What is the highest-grossing movie of all time?', options: ['Titanic', 'Avatar', 'Avengers: Endgame', 'The Lion King'], correctIndex: 1 },
    { question: 'Which band sang "Bohemian Rhapsody"?', options: ['The Beatles', 'Led Zeppelin', 'Pink Floyd', 'Queen'], correctIndex: 3 },
    { question: 'In "The Lion King", what is Simba\'s father\'s name?', options: ['Mufasa', 'Scar', 'Timon', 'Rafiki'], correctIndex: 0 },
    { question: 'What social network is known for short-form video?', options: ['Instagram', 'Snapchat', 'Twitter', 'TikTok'], correctIndex: 3 },
    { question: 'Which video game features a character named "Mario"?', options: ['Sonic', 'Super Nintendo', 'Super Mario Bros', 'Pac-Man'], correctIndex: 2 },
    { question: 'What color pill does Neo take in The Matrix?', options: ['Blue', 'White', 'Red', 'Green'], correctIndex: 2 },
    { question: 'Who played Iron Man in the Marvel Cinematic Universe?', options: ['Chris Evans', 'Chris Hemsworth', 'Robert Downey Jr.', 'Mark Ruffalo'], correctIndex: 2 },
  ],
  History: [
    { question: 'In what year did World War II end?', options: ['1943', '1944', '1945', '1946'], correctIndex: 2 },
    { question: 'Who was the first President of the United States?', options: ['John Adams', 'Thomas Jefferson', 'George Washington', 'Benjamin Franklin'], correctIndex: 2 },
    { question: 'Which ancient wonder was located in Alexandria?', options: ['Colossus of Rhodes', 'Lighthouse of Alexandria', 'Hanging Gardens', 'Temple of Artemis'], correctIndex: 1 },
    { question: 'What year did the Berlin Wall fall?', options: ['1987', '1988', '1989', '1990'], correctIndex: 2 },
    { question: 'Who was the Egyptian queen who allied with Julius Caesar?', options: ['Nefertiti', 'Cleopatra', 'Hatshepsut', 'Isis'], correctIndex: 1 },
    { question: 'In which city was the Titanic built?', options: ['Liverpool', 'London', 'Southampton', 'Belfast'], correctIndex: 3 },
    { question: 'Which empire was ruled by Genghis Khan?', options: ['Ottoman Empire', 'Roman Empire', 'Mongol Empire', 'Persian Empire'], correctIndex: 2 },
    { question: 'What year did man first land on the Moon?', options: ['1965', '1967', '1969', '1971'], correctIndex: 2 },
    { question: 'Who wrote the Declaration of Independence?', options: ['George Washington', 'Benjamin Franklin', 'John Adams', 'Thomas Jefferson'], correctIndex: 3 },
    { question: 'Which country was the first to give women the right to vote?', options: ['USA', 'UK', 'New Zealand', 'France'], correctIndex: 2 },
  ],
  Science: [
    { question: 'What planet is closest to the Sun?', options: ['Venus', 'Mercury', 'Earth', 'Mars'], correctIndex: 1 },
    { question: 'What is the chemical formula for water?', options: ['H2O', 'CO2', 'NaCl', 'HO2'], correctIndex: 0 },
    { question: 'How many chromosomes do humans have?', options: ['23', '44', '46', '48'], correctIndex: 2 },
    { question: 'What is the speed of light (approx)?', options: ['100,000 km/s', '200,000 km/s', '300,000 km/s', '400,000 km/s'], correctIndex: 2 },
    { question: 'What is the powerhouse of the cell?', options: ['Nucleus', 'Ribosome', 'Endoplasmic Reticulum', 'Mitochondria'], correctIndex: 3 },
    { question: 'What gas do plants absorb from the atmosphere?', options: ['Oxygen', 'Nitrogen', 'Carbon Dioxide', 'Hydrogen'], correctIndex: 2 },
    { question: 'How many elements are in the periodic table?', options: ['100', '108', '118', '128'], correctIndex: 2 },
    { question: 'What force keeps planets in orbit around the Sun?', options: ['Magnetism', 'Electrostatics', 'Gravity', 'Nuclear force'], correctIndex: 2 },
    { question: 'What is the most abundant gas in Earth\'s atmosphere?', options: ['Oxygen', 'Carbon Dioxide', 'Argon', 'Nitrogen'], correctIndex: 3 },
    { question: 'DNA stands for?', options: ['Deoxyribonucleic Acid', 'Deoxyribose Nuclei Acid', 'Diribonucleic Acid', 'Dynamic Nucleic Acid'], correctIndex: 0 },
  ],
}

function createPrng(seedStr?: string): () => number {
  if (!seedStr) return Math.random

  // Hash the seed string into a 32-bit integer
  let h = 2166136261 >>> 0
  for (let i = 0; i < seedStr.length; i++) {
    h = Math.imul(h ^ seedStr.charCodeAt(i), 16777619) >>> 0
  }

  // Mulberry32 algorithm
  return function mulberry32() {
    let t = (h += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Returns `count` questions from the given category (shuffled, deterministically if seed provided). */
export function getQuestions(category: Category, count: number, seed?: string): TriviaQuestion[] {
  const pool = [...(QUESTION_BANK[category] ?? QUESTION_BANK['General Knowledge'])]
  const random = createPrng(seed ? `${category}_${seed}` : undefined)

  // Fisher-Yates shuffle with seeded or standard random
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  return pool.slice(0, count)
}

