export type Category =
  | 'General Knowledge'
  | 'Crypto'
  | 'Sports'
  | 'Pop Culture'
  | 'Science'
  | 'History'

export const ALL_CATEGORIES: Category[] = [
  'General Knowledge',
  'Crypto',
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

/** Returns `count` questions from the given category (shuffled). */
export function getQuestions(category: Category, count: number): TriviaQuestion[] {
  const pool = [...(QUESTION_BANK[category] ?? QUESTION_BANK['General Knowledge'])]
  // Fisher-Yates shuffle
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  return pool.slice(0, count)
}
