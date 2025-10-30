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

export async function createNewGame(postId: string): Promise<GameState> {
  const fragment = getRandomFragment();
  const gameState: GameState = {
    fragment,
    currentWord: '',
    score: 0,
    bestWord: '',
    timeLeft: 60, // 60 seconds per game
    gameActive: true
  };
  
  // Store game state in Redis
  await redis.set(`game:${postId}`, JSON.stringify(gameState), { ex: 300 }); // 5 minute expiry
  
  return gameState;
}

export async function getGameState(postId: string): Promise<GameState | null> {
  const gameData = await redis.get(`game:${postId}`);
  if (!gameData) return null;
  
  try {
    return JSON.parse(gameData) as GameState;
  } catch (error) {
    console.error('Failed to parse game state:', error);
    return null;
  }
}

export async function submitWord(postId: string, word: string): Promise<{
  valid: boolean;
  score: number;
  gameState: GameState;
  message: string;
}> {
  const gameState = await getGameState(postId);
  
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
  await redis.set(`game:${postId}`, JSON.stringify(gameState), { ex: 300 });
  
  return {
    valid,
    score: gameState.score,
    gameState,
    message
  };
}

export async function endGame(postId: string): Promise<GameState | null> {
  const gameState = await getGameState(postId);
  if (!gameState) return null;
  
  gameState.gameActive = false;
  gameState.timeLeft = 0;
  
  // Save final game state
  await redis.set(`game:${postId}`, JSON.stringify(gameState), { ex: 300 });
  
  return gameState;
}