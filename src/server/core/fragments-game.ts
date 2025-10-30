import { redis } from '@devvit/web/server';
import { GameState } from '../../shared/types/api';

// Common 2-3 letter fragments that can start many words
const FRAGMENTS = [
  'an', 'ar', 'at', 'be', 'co', 'de', 'ex', 'in', 'on', 'or', 're', 'st', 'th', 'to', 'un',
  'ab', 'ad', 'al', 'as', 'ba', 'ca', 'ch', 'cl', 'cr', 'di', 'dr', 'el', 'en', 'er', 'es',
  'fl', 'fr', 'gr', 'ha', 'he', 'ho', 'im', 'is', 'it', 'la', 'le', 'li', 'ma', 'me', 'mi',
  'mo', 'ne', 'no', 'of', 'pa', 'pl', 'pr', 'qu', 'ra', 'ro', 'sc', 'sh', 'sl', 'sp', 'sw',
  'ta', 'te', 'tr', 'up', 'wa', 'we', 'wi', 'wo', 'yo',
  'ant', 'app', 'art', 'ask', 'bad', 'bag', 'bar', 'bat', 'bed', 'big', 'bit', 'box', 'boy',
  'bus', 'but', 'buy', 'can', 'car', 'cat', 'cup', 'cut', 'day', 'did', 'dog', 'ear', 'eat',
  'end', 'eye', 'far', 'few', 'for', 'fun', 'get', 'got', 'had', 'has', 'her', 'him', 'his',
  'hot', 'how', 'job', 'key', 'kid', 'let', 'man', 'may', 'new', 'not', 'now', 'old', 'one',
  'our', 'out', 'own', 'put', 'red', 'run', 'say', 'see', 'she', 'sit', 'six', 'sun', 'ten',
  'the', 'top', 'try', 'two', 'use', 'way', 'who', 'why', 'win', 'yes', 'you'
];



function getRandomFragment(): string {
  const fragment = FRAGMENTS[Math.floor(Math.random() * FRAGMENTS.length)];
  return fragment || 'an'; // Fallback
}

function getCurrentDateKey(): string {
  // Get current date in YYYY-MM-DD format for consistent daily fragments
  const now = new Date();
  return now.toISOString().split('T')[0] || 'default';
}

async function getDailyFragment(): Promise<string> {
  const dateKey = getCurrentDateKey();
  const fragmentKey = `daily_fragment:${dateKey}`;
  
  // Try to get existing fragment for today
  let fragment = await redis.get(fragmentKey);
  
  if (!fragment) {
    // Generate new fragment for today
    fragment = getRandomFragment();
    
    // Store with 7-day expiration to keep historical data
    const sevenDaysInSeconds = 7 * 24 * 60 * 60;
    
    await redis.set(fragmentKey, fragment, { expiration: new Date(Date.now() + sevenDaysInSeconds * 1000) });
    
    console.log(`New daily fragment set: ${fragment} (expires in 7 days)`);
  }
  
  return fragment || getRandomFragment(); // Fallback in case of null
}

async function getDailyScoreLeaderboard(): Promise<Array<{username: string, score: number, bestWord: string}>> {
  const dateKey = getCurrentDateKey();
  const leaderboardKey = `daily_score_leaderboard:${dateKey}`;
  
  try {
    const leaderboardData = await redis.get(leaderboardKey);
    if (!leaderboardData) return [];
    
    return JSON.parse(leaderboardData);
  } catch (error) {
    console.error('Failed to get score leaderboard:', error);
    return [];
  }
}

async function getDailyWordLeaderboard(): Promise<Array<{username: string, score: number, bestWord: string}>> {
  const dateKey = getCurrentDateKey();
  const leaderboardKey = `daily_word_leaderboard:${dateKey}`;
  
  try {
    const leaderboardData = await redis.get(leaderboardKey);
    if (!leaderboardData) return [];
    
    return JSON.parse(leaderboardData);
  } catch (error) {
    console.error('Failed to get word leaderboard:', error);
    return [];
  }
}

function isDayComplete(): boolean {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  
  // Check if we're within the last hour of the day (23:00-24:00)
  // This gives some buffer time for the day to be considered "complete"
  const timeUntilMidnight = tomorrow.getTime() - now.getTime();
  const oneHour = 60 * 60 * 1000;
  
  return timeUntilMidnight <= oneHour;
}

async function getDailyLeaderboardsWithWordVisibility(dateKey?: string | undefined): Promise<{
  scoreLeaderboard: Array<{username: string, score: number, bestWord: string}>,
  wordLeaderboard: Array<{username: string, score: number, bestWord: string}>,
  showWords: boolean,
  fragment: string,
  date: string
}> {
  const targetDate: string = dateKey || getCurrentDateKey();
  const [scoreLeaderboard, wordLeaderboard, fragment] = await Promise.all([
    getDailyScoreLeaderboardByDate(targetDate),
    getDailyWordLeaderboardByDate(targetDate),
    getDailyFragmentByDate(targetDate)
  ]);
  
  // Only show words if it's a past date or if current day is complete
  const isCurrentDay = targetDate === getCurrentDateKey();
  const showWords = !isCurrentDay || isDayComplete();
  
  const hideWords = (leaderboard: Array<{username: string, score: number, bestWord: string}>, isWordLeaderboard: boolean = false) => {
    if (showWords) {
      return leaderboard;
    }
    
    return leaderboard.map((entry, index) => ({
      ...entry,
      bestWord: entry.bestWord ? (
        // For word leaderboard, only reveal the longest word (#1 position)
        isWordLeaderboard && index === 0 ? entry.bestWord : '***'
      ) : ''
    }));
  };
  
  return {
    scoreLeaderboard: hideWords(scoreLeaderboard, false),
    wordLeaderboard: hideWords(wordLeaderboard, true),
    showWords,
    fragment,
    date: targetDate
  };
}

async function getDailyScoreLeaderboardByDate(dateKey: string): Promise<Array<{username: string, score: number, bestWord: string}>> {
  const leaderboardKey = `daily_score_leaderboard:${dateKey}`;
  
  try {
    const leaderboardData = await redis.get(leaderboardKey);
    if (!leaderboardData) return [];
    
    return JSON.parse(leaderboardData);
  } catch (error) {
    console.error('Failed to get score leaderboard for date:', dateKey, error);
    return [];
  }
}

async function getDailyWordLeaderboardByDate(dateKey: string): Promise<Array<{username: string, score: number, bestWord: string}>> {
  const leaderboardKey = `daily_word_leaderboard:${dateKey}`;
  
  try {
    const leaderboardData = await redis.get(leaderboardKey);
    if (!leaderboardData) return [];
    
    return JSON.parse(leaderboardData);
  } catch (error) {
    console.error('Failed to get word leaderboard for date:', dateKey, error);
    return [];
  }
}

async function getDailyFragmentByDate(dateKey: string): Promise<string> {
  const fragmentKey = `daily_fragment:${dateKey}`;
  
  try {
    const fragment = await redis.get(fragmentKey);
    return fragment || '';
  } catch (error) {
    console.error('Failed to get fragment for date:', dateKey, error);
    return '';
  }
}

async function getAvailableDates(): Promise<string[]> {
  const dates: string[] = [];
  const today = new Date();
  
  // Get past 7 days including today
  for (let i = 0; i < 7; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateKey = date.toISOString().split('T')[0] || '';
    
    // Check if we have data for this date
    const fragmentKey = `daily_fragment:${dateKey}`;
    const hasData = await redis.get(fragmentKey);
    
    if (hasData && dateKey) {
      dates.push(dateKey);
    }
  }
  
  return dates;
}

async function updateDailyLeaderboards(username: string, score: number, bestWord: string): Promise<void> {
  const dateKey = getCurrentDateKey();
  const scoreLeaderboardKey = `daily_score_leaderboard:${dateKey}`;
  const wordLeaderboardKey = `daily_word_leaderboard:${dateKey}`;
  
  try {
    const [scoreLeaderboard, wordLeaderboard] = await Promise.all([
      getDailyScoreLeaderboard(),
      getDailyWordLeaderboard()
    ]);
    
    // Update score leaderboard
    const scoreExistingIndex = scoreLeaderboard.findIndex(entry => entry.username === username);
    if (scoreExistingIndex >= 0) {
      // Update if new score is higher
      const existingEntry = scoreLeaderboard[scoreExistingIndex];
      if (existingEntry && score > existingEntry.score) {
        scoreLeaderboard[scoreExistingIndex] = { username, score, bestWord };
      }
    } else {
      // Add new entry
      scoreLeaderboard.push({ username, score, bestWord });
    }
    
    // Update word leaderboard - always update with the longest word for this user
    const wordExistingIndex = wordLeaderboard.findIndex(entry => entry.username === username);
    if (wordExistingIndex >= 0) {
      // Update if new word is longer
      const existingEntry = wordLeaderboard[wordExistingIndex];
      const existingWordLength = existingEntry?.bestWord?.length || 0;
      if (bestWord.length > existingWordLength) {
        // Keep the higher score between the two entries
        const betterScore = Math.max(score, existingEntry?.score || 0);
        wordLeaderboard[wordExistingIndex] = { username, score: betterScore, bestWord };
      }
    } else {
      // Add new entry
      wordLeaderboard.push({ username, score, bestWord });
    }
    
    // Sort and keep top 10 for each leaderboard
    scoreLeaderboard.sort((a, b) => b.score - a.score);
    const topScoreLeaderboard = scoreLeaderboard.slice(0, 10);
    
    wordLeaderboard.sort((a, b) => (b.bestWord?.length || 0) - (a.bestWord?.length || 0));
    const topWordLeaderboard = wordLeaderboard.slice(0, 10);
    
    // Store with 7-day expiration to keep historical data
    const sevenDaysInSeconds = 7 * 24 * 60 * 60;
    const expirationDate = new Date(Date.now() + sevenDaysInSeconds * 1000);
    
    await Promise.all([
      redis.set(scoreLeaderboardKey, JSON.stringify(topScoreLeaderboard), { expiration: expirationDate }),
      redis.set(wordLeaderboardKey, JSON.stringify(topWordLeaderboard), { expiration: expirationDate })
    ]);
  } catch (error) {
    console.error('Failed to update leaderboards:', error);
  }
}

function isValidWord(word: string, fragment: string): boolean {
  // Basic validation - word must start with fragment and be at least 3 characters
  if (!word.toLowerCase().startsWith(fragment.toLowerCase())) {
    return false;
  }
  
  if (word.length < 3) {
    return false;
  }
  
  // Basic English word pattern check (letters only, reasonable length)
  if (!/^[a-zA-Z]+$/.test(word) || word.length > 20) {
    return false;
  }
  
  // For demo purposes, accept most reasonable words
  // In production, you'd check against the loaded word list
  return true;
}

function calculateScore(word: string): number {
  // Score based on word length with bonus for longer words
  const baseScore = word.length;
  const lengthBonus = Math.max(0, word.length - 5) * 2;
  return baseScore + lengthBonus;
}

export async function createNewGame(postId: string, username: string): Promise<GameState> {
  const fragment = await getDailyFragment();
  const gameState: GameState = {
    fragment,
    currentWord: '',
    score: 0,
    bestWord: '',
    timeLeft: 60, // 60 seconds per game
    gameActive: true
  };
  
  // Store game state in Redis with user-specific key
  const gameKey = `game:${postId}:${username}`;
  await redis.set(gameKey, JSON.stringify(gameState), { expiration: new Date(Date.now() + 300 * 1000) }); // 5 minute expiry
  
  return gameState;
}

export async function getGameState(postId: string, username: string): Promise<GameState | null> {
  const gameKey = `game:${postId}:${username}`;
  const gameData = await redis.get(gameKey);
  if (!gameData) return null;
  
  try {
    return JSON.parse(gameData) as GameState;
  } catch (error) {
    console.error('Failed to parse game state:', error);
    return null;
  }
}

export async function submitWord(postId: string, username: string, word: string): Promise<{
  valid: boolean;
  score: number;
  gameState: GameState;
  message: string;
}> {
  const gameState = await getGameState(postId, username);
  
  if (!gameState) {
    throw new Error('Game not found');
  }
  
  if (!gameState.gameActive) {
    return {
      valid: false,
      score: gameState.score,
      gameState,
      message: 'Game is not active'
    };
  }
  
  const valid = isValidWord(word, gameState.fragment);
  let message = '';
  
  if (valid) {
    const wordScore = calculateScore(word);
    gameState.score += wordScore;
    gameState.currentWord = word;
    
    // Update best word if this is longer
    if (word.length > gameState.bestWord.length) {
      gameState.bestWord = word;
    }
    
    message = `Great! "${word}" is valid and earned ${wordScore} points!`;
  } else {
    message = `"${word}" is not valid. Make sure it starts with "${gameState.fragment}" and is a real word.`;
  }
  
  // Save updated game state
  const gameKey = `game:${postId}:${username}`;
  await redis.set(gameKey, JSON.stringify(gameState), { expiration: new Date(Date.now() + 300 * 1000) });
  
  return {
    valid,
    score: gameState.score,
    gameState,
    message
  };
}

export async function endGame(postId: string, username: string): Promise<GameState | null> {
  const gameState = await getGameState(postId, username);
  if (!gameState) return null;
  
  gameState.gameActive = false;
  gameState.timeLeft = 0;
  
  // Update leaderboards if player has a score and a best word
  if (gameState.score > 0 && gameState.bestWord && gameState.bestWord.length > 0) {
    await updateDailyLeaderboards(username, gameState.score, gameState.bestWord);
  }
  
  // Save final game state
  const gameKey = `game:${postId}:${username}`;
  await redis.set(gameKey, JSON.stringify(gameState), { expiration: new Date(Date.now() + 300 * 1000) });
  
  return gameState;
}

export { getDailyFragment, getDailyScoreLeaderboard, getDailyWordLeaderboard, getDailyLeaderboardsWithWordVisibility, getAvailableDates };