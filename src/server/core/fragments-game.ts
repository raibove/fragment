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

let wordList: Set<string> | null = null;

async function loadWordList(): Promise<Set<string>> {
  if (wordList) return wordList;
  
  try {
    // In a real implementation, you'd load from the words.txt file
    // For now, we'll use a basic word validation approach
    wordList = new Set();
    return wordList;
  } catch (error) {
    console.error('Failed to load word list:', error);
    return new Set();
  }
}

function getRandomFragment(): string {
  return FRAGMENTS[Math.floor(Math.random() * FRAGMENTS.length)];
}

function getCurrentDateKey(): string {
  // Get current date in YYYY-MM-DD format for consistent daily fragments
  const now = new Date();
  return now.toISOString().split('T')[0];
}

async function getDailyFragment(): Promise<string> {
  const dateKey = getCurrentDateKey();
  const fragmentKey = `daily_fragment:${dateKey}`;
  
  // Try to get existing fragment for today
  let fragment = await redis.get(fragmentKey);
  
  if (!fragment) {
    // Generate new fragment for today
    fragment = getRandomFragment();
    
    // Store with expiration at end of day (24 hours from now)
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0); // Set to midnight
    
    const secondsUntilMidnight = Math.floor((tomorrow.getTime() - now.getTime()) / 1000);
    
    await redis.set(fragmentKey, fragment, { ex: secondsUntilMidnight });
    
    console.log(`New daily fragment set: ${fragment} (expires in ${secondsUntilMidnight} seconds)`);
  }
  
  return fragment;
}

async function getDailyLeaderboard(): Promise<Array<{username: string, score: number, bestWord: string}>> {
  const dateKey = getCurrentDateKey();
  const leaderboardKey = `daily_leaderboard:${dateKey}`;
  
  try {
    const leaderboardData = await redis.get(leaderboardKey);
    if (!leaderboardData) return [];
    
    return JSON.parse(leaderboardData);
  } catch (error) {
    console.error('Failed to get leaderboard:', error);
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

async function getDailyLeaderboardWithWordVisibility(): Promise<{
  leaderboard: Array<{username: string, score: number, bestWord: string}>,
  showWords: boolean
}> {
  const leaderboard = await getDailyLeaderboard();
  const showWords = isDayComplete();
  
  return {
    leaderboard: showWords ? leaderboard : leaderboard.map(entry => ({
      ...entry,
      bestWord: '***' // Hide words until day is complete
    })),
    showWords
  };
}

async function updateDailyLeaderboard(username: string, score: number, bestWord: string): Promise<void> {
  const dateKey = getCurrentDateKey();
  const leaderboardKey = `daily_leaderboard:${dateKey}`;
  
  try {
    const leaderboard = await getDailyLeaderboard();
    
    // Find existing entry or create new one
    const existingIndex = leaderboard.findIndex(entry => entry.username === username);
    
    if (existingIndex >= 0) {
      // Update if new score is higher
      if (score > leaderboard[existingIndex].score) {
        leaderboard[existingIndex] = { username, score, bestWord };
      }
    } else {
      // Add new entry
      leaderboard.push({ username, score, bestWord });
    }
    
    // Sort by score (highest first) and keep top 10
    leaderboard.sort((a, b) => b.score - a.score);
    const topLeaderboard = leaderboard.slice(0, 10);
    
    // Store with same expiration as daily fragment
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    
    const secondsUntilMidnight = Math.floor((tomorrow.getTime() - now.getTime()) / 1000);
    
    await redis.set(leaderboardKey, JSON.stringify(topLeaderboard), { ex: secondsUntilMidnight });
  } catch (error) {
    console.error('Failed to update leaderboard:', error);
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
  await redis.set(gameKey, JSON.stringify(gameState), { ex: 300 }); // 5 minute expiry
  
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
  await redis.set(gameKey, JSON.stringify(gameState), { ex: 300 });
  
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
  
  // Update leaderboard if player has a score
  if (gameState.score > 0) {
    await updateDailyLeaderboard(username, gameState.score, gameState.bestWord);
  }
  
  // Save final game state
  const gameKey = `game:${postId}:${username}`;
  await redis.set(gameKey, JSON.stringify(gameState), { ex: 300 });
  
  return gameState;
}

export { getDailyFragment, getDailyLeaderboard };