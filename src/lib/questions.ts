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

// ─── Procedural Pseudo-Random Number Generator (Mulberry32) ───────────────────
function createPrng(seedStr?: string): () => number {
  if (!seedStr) return Math.random

  let h = 2166136261 >>> 0
  for (let i = 0; i < seedStr.length; i++) {
    h = Math.imul(h ^ seedStr.charCodeAt(i), 16777619) >>> 0
  }

  return function mulberry32() {
    let t = (h += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ─── Procedural Math & Logic Generator ───────────────────────────────────────
function generateMathQuestion(rand: () => number): TriviaQuestion {
  const type = Math.floor(rand() * 6)
  
  if (type === 0) {
    // Arithmetic: Multiplication & Subtraction / Addition
    const a = Math.floor(rand() * 12) + 4
    const b = Math.floor(rand() * 12) + 3
    const c = Math.floor(rand() * 30) + 10
    const isAdd = rand() > 0.5
    const answer = isAdd ? a * b + c : a * b - c
    const distractors = [
      answer + (Math.floor(rand() * 6) + 2) * (rand() > 0.5 ? 1 : -1),
      answer + (Math.floor(rand() * 8) + 8) * (rand() > 0.5 ? 1 : -1),
      answer + 10,
    ]
    const options = [String(answer), ...distractors.map(String)]
    // Shuffle options
    for (let i = options.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1))
      ;[options[i], options[j]] = [options[j], options[i]]
    }
    return {
      question: `Solve: ${a} × ${b} ${isAdd ? '+' : '-'} ${c} = ?`,
      options,
      correctIndex: options.indexOf(String(answer)),
    }
  } else if (type === 1) {
    // Number Sequence: geometric / arithmetic / square
    const start = Math.floor(rand() * 6) + 2
    const step = Math.floor(rand() * 5) + 3
    const isGeometric = rand() > 0.5
    
    if (isGeometric) {
      const ratio = 2
      const seq = [start, start * ratio, start * ratio * 2, start * ratio * 3, start * ratio * 4]
      const answer = start * ratio * 5
      const options = [
        String(answer),
        String(answer - start * 2),
        String(answer + start * 4),
        String(answer * 2),
      ]
      for (let i = options.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1))
        ;[options[i], options[j]] = [options[j], options[i]]
      }
      return {
        question: `What comes next in sequence: ${seq.join(', ')}, __?`,
        options,
        correctIndex: options.indexOf(String(answer)),
      }
    } else {
      const seq = [start, start + step, start + step * 2, start + step * 3, start + step * 4]
      const answer = start + step * 5
      const options = [
        String(answer),
        String(answer - 2),
        String(answer + step),
        String(answer + 4),
      ]
      for (let i = options.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1))
        ;[options[i], options[j]] = [options[j], options[i]]
      }
      return {
        question: `Find the next number: ${seq.join(', ')}, __?`,
        options,
        correctIndex: options.indexOf(String(answer)),
      }
    }
  } else if (type === 2) {
    // Percentages
    const percents = [10, 15, 20, 25, 30, 40, 50, 75]
    const p = percents[Math.floor(rand() * percents.length)]
    const base = (Math.floor(rand() * 8) + 2) * 40
    const answer = (p / 100) * base
    const options = [
      String(answer),
      String(answer + 10),
      String(answer - (p >= 20 ? 10 : 5)),
      String(answer + 25),
    ]
    for (let i = options.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1))
      ;[options[i], options[j]] = [options[j], options[i]]
    }
    return {
      question: `What is ${p}% of ${base}?`,
      options,
      correctIndex: options.indexOf(String(answer)),
    }
  } else if (type === 3) {
    // Linear equation: aX + b = c
    const xVal = Math.floor(rand() * 12) + 2
    const a = Math.floor(rand() * 6) + 2
    const b = Math.floor(rand() * 20) + 5
    const c = a * xVal + b
    const options = [
      String(xVal),
      String(xVal + 2),
      String(Math.max(1, xVal - 3)),
      String(xVal + 5),
    ]
    for (let i = options.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1))
      ;[options[i], options[j]] = [options[j], options[i]]
    }
    return {
      question: `Solve for X: ${a}X + ${b} = ${c}`,
      options,
      correctIndex: options.indexOf(String(xVal)),
    }
  } else if (type === 4) {
    // Square roots & powers
    const n = Math.floor(rand() * 11) + 11 // 11 to 21
    const square = n * n
    const options = [
      String(n),
      String(n - 1),
      String(n + 1),
      String(n + 2),
    ]
    for (let i = options.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1))
      ;[options[i], options[j]] = [options[j], options[i]]
    }
    return {
      question: `What is the square root of ${square}?`,
      options,
      correctIndex: options.indexOf(String(n)),
    }
  } else {
    // Probability & logic puzzle
    const red = Math.floor(rand() * 4) + 3
    const blue = Math.floor(rand() * 4) + 2
    const total = red + blue
    const answer = `${red}/${total}`
    const options = [
      answer,
      `${blue}/${total}`,
      `${red}/${total + 2}`,
      `1/${total}`,
    ]
    for (let i = options.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1))
      ;[options[i], options[j]] = [options[j], options[i]]
    }
    return {
      question: `A bag contains ${red} red marbles and ${blue} blue marbles. Chance of picking red?`,
      options,
      correctIndex: options.indexOf(answer),
    }
  }
}

// ─── Procedural Word Blitz Generator ─────────────────────────────────────────
const ANAGRAM_DICTIONARY = [
  { word: 'BLOCKCHAIN', distractors: ['CHAINBLOCK', 'BLACKCHAIN', 'BITCHAIN'] },
  { word: 'ETHEREUM', distractors: ['EUROTHEM', 'METHEUR', 'ETHERIUM'] },
  { word: 'ALGORITHM', distractors: ['LOGARITHM', 'MATHGLORY', 'MORALIGHT'] },
  { word: 'PROTOCOL', distractors: ['PORTALCO', 'POOLLOCK', 'PLOTCORE'] },
  { word: 'CONSENSUS', distractors: ['CENSUSCON', 'COINCOUNT', 'SCENICUS'] },
  { word: 'SIGNATURE', distractors: ['NATURESIG', 'GRANITUS', 'SAINTURG'] },
  { word: 'VALIDATOR', distractors: ['DATAVALOR', 'VITALLORD', 'DIVATORL'] },
  { word: 'SECURITY', distractors: ['CITYUSER', 'SURITYEC', 'CRUSTIEY'] },
  { word: 'DECENTRAL', distractors: ['CENTRALED', 'CREDENTL', 'DECLARTE'] },
  { word: 'SMARTPHONE', distractors: ['PHONEMART', 'STAMPHORN', 'HARPSTONE'] },
  { word: 'METAVERSE', distractors: ['MEGAVERSE', 'STEAMREVE', 'MATERSEV'] },
  { word: 'CYBERPUNK', distractors: ['CYBERTRUK', 'PUNKYBEAR', 'BURKPYNE'] },
]

function generateWordBlitzQuestion(rand: () => number): TriviaQuestion {
  const item = ANAGRAM_DICTIONARY[Math.floor(rand() * ANAGRAM_DICTIONARY.length)]
  const letters = item.word.split('')
  // Scramble letters
  for (let i = letters.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[letters[i], letters[j]] = [letters[j], letters[i]]
  }
  const scrambled = letters.join(' ')
  const options = [item.word, ...item.distractors]
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[options[i], options[j]] = [options[j], options[i]]
  }
  return {
    question: `Unscramble the word: "${scrambled}"`,
    options,
    correctIndex: options.indexOf(item.word),
  }
}

// ─── Comprehensive Curated Question Bank (30+ questions per category) ─────────
// --- Encrypted Question Vault (Anti-Harvesting Protection) ---
const ENCODED_VAULT = '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'

function decodeVault(encoded: string, key = 0x5a): Record<Category, TriviaQuestion[]> {
  try {
    const binary = atob(encoded)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i) ^ key
    }
    const decodedJson = new TextDecoder().decode(bytes)
    const raw = JSON.parse(decodedJson)
    const bank: Partial<Record<Category, TriviaQuestion[]>> = {}

    for (const [cat, list] of Object.entries(raw)) {
      bank[cat as Category] = (list as [string, string[], number][]).map(([question, options, correctIndex]) => ({
        question,
        options,
        correctIndex,
      }))
    }
    return bank as Record<Category, TriviaQuestion[]>
  } catch (err) {
    console.error('Failed to decode trivia vault:', err)
    return {} as Record<Category, TriviaQuestion[]>
  }
}

const QUESTION_BANK: Record<Category, TriviaQuestion[]> = decodeVault(ENCODED_VAULT)

// ─── Open Trivia Database (OpenTDB) Live Integration ──────────────────────────
const OPENTDB_CATEGORY_MAP: Partial<Record<Category, number>> = {
  'General Knowledge': 9,
  'Science': 17, // Science & Nature
  'History': 23,
  'Pop Culture': 11, // Film / Entertainment
  'Sports': 21,
}

// Memory cache of live fetched questions to make gameplay instant (0ms latency)
const LIVE_QUESTION_CACHE = new Map<Category, TriviaQuestion[]>()

/** Decodes HTML special entities returned by external trivia APIs */
function decodeHtml(html: string): string {
  if (typeof document !== 'undefined') {
    const txt = document.createElement('textarea')
    txt.innerHTML = html
    return txt.value
  }
  return html
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&eacute;/g, 'é')
    .replace(/&ntilde;/g, 'ñ')
    .replace(/&uuml;/g, 'ü')
}

/**
 * Fetches fresh questions live from Open Trivia Database (OpenTDB).
 * Returns undefined if category is non-general or if network request fails.
 */
export async function fetchLiveQuestionsFromAPI(
  category: Category,
  count = 10,
  seed?: string
): Promise<TriviaQuestion[] | null> {
  const opentdbId = OPENTDB_CATEGORY_MAP[category]
  if (!opentdbId) return null

  try {
    const url = `https://opentdb.com/api.php?amount=${Math.max(10, count)}&category=${opentdbId}&type=multiple`
    const res = await fetch(url)
    if (!res.ok) return null
    const data = await res.json()

    if (data.response_code !== 0 || !Array.isArray(data.results) || data.results.length === 0) {
      return null
    }

    const random = createPrng(seed ? `${category}_${seed}` : undefined)

    const parsed: TriviaQuestion[] = data.results.map((item: any) => {
      const question = decodeHtml(item.question)
      const correct = decodeHtml(item.correct_answer)
      const incorrects = (item.incorrect_answers || []).map((ans: string) => decodeHtml(ans))
      const options = [correct, ...incorrects]

      // Shuffle options deterministically
      for (let i = options.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1))
        ;[options[i], options[j]] = [options[j], options[i]]
      }

      return {
        question,
        options,
        correctIndex: options.indexOf(correct),
      }
    })

    // Store in cache
    LIVE_QUESTION_CACHE.set(category, parsed)
    return parsed.slice(0, count)
  } catch (err) {
    console.warn('OpenTDB fetch fallback to local pool:', err)
    return null
  }
}

/**
 * Asynchronously pre-fetches live questions in the background when user enters lobby
 */
export function prefetchCategoryQuestions(category: Category) {
  if (OPENTDB_CATEGORY_MAP[category] && !LIVE_QUESTION_CACHE.has(category)) {
    void fetchLiveQuestionsFromAPI(category, 15)
  }
}

/**
 * Returns `count` dynamic, non-repetitive questions for the given category.
 * - For Logic & Math and Word Blitz, procedural generators create infinite unique variations.
 * - For other categories, uses cached OpenTDB live questions if available, or
 *   seeded deterministic shuffle on the expanded curated bank.
 */
export function getQuestions(category: Category, count: number, seed?: string): TriviaQuestion[] {
  const random = createPrng(seed ? `${category}_${seed}` : undefined)

  // 1. Procedural generation for Math & Logic (Infinite questions)
  if (category === 'Logic & Math Arena') {
    const questions: TriviaQuestion[] = []
    for (let i = 0; i < count; i++) {
      questions.push(generateMathQuestion(random))
    }
    return questions
  }

  // 2. Hybrid procedural + bank for Word Blitz
  if (category === 'Word Blitz') {
    const questions: TriviaQuestion[] = []
    const staticPool = [...(QUESTION_BANK['Word Blitz'] ?? [])]
    for (let i = staticPool.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1))
      ;[staticPool[i], staticPool[j]] = [staticPool[j], staticPool[i]]
    }
    
    const proceduralCount = Math.floor(count / 2)
    for (let i = 0; i < proceduralCount; i++) {
      questions.push(generateWordBlitzQuestion(random))
    }
    questions.push(...staticPool.slice(0, count - proceduralCount))
    
    for (let i = questions.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1))
      ;[questions[i], questions[j]] = [questions[j], questions[i]]
    }
    return questions.slice(0, count)
  }

  // 3. Check if cached live questions from OpenTDB exist
  const cachedLive = LIVE_QUESTION_CACHE.get(category)
  if (cachedLive && cachedLive.length >= count) {
    const pool = [...cachedLive]
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1))
      ;[pool[i], pool[j]] = [pool[j], pool[i]]
    }
    return pool.slice(0, count)
  }

  // 4. Expanded Curated Bank with Deterministic Seeded Fisher-Yates Shuffle
  const pool = [...(QUESTION_BANK[category] ?? QUESTION_BANK['General Knowledge'])]

  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }

  return pool.slice(0, count)
}

/**
 * Main entry point: asynchronously fetches live questions from OpenTDB if available,
 * with immediate fallback to procedural generation & curated local pool.
 */
export async function getQuestionsAsync(category: Category, count: number, seed?: string): Promise<TriviaQuestion[]> {
  // If it's a live API supported category, attempt fresh fetch
  if (OPENTDB_CATEGORY_MAP[category]) {
    const live = await fetchLiveQuestionsFromAPI(category, count, seed)
    if (live && live.length >= count) {
      return live
    }
  }

  // Otherwise synchronous generation / local bank
  return getQuestions(category, count, seed)
}
