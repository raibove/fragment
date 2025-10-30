export type InitResponse = {
  type: 'init';
  postId: string;
  count: number;
  username: string;
};

export type IncrementResponse = {
  type: 'increment';
  postId: string;
  count: number;
};

export type DecrementResponse = {
  type: 'decrement';
  postId: string;
  count: number;
};

export type GameState = {
  fragment: string;
  currentWord: string;
  score: number;
  bestWord: string;
  timeLeft: number;
  gameActive: boolean;
};

export type NewGameResponse = {
  type: 'new-game';
  postId: string;
  gameState: GameState;
};

export type SubmitWordRequest = {
  word: string;
};

export type SubmitWordResponse = {
  type: 'submit-word';
  postId: string;
  valid: boolean;
  score: number;
  gameState: GameState;
  message: string;
};

export type GetGameStateResponse = {
  type: 'game-state';
  postId: string;
  gameState: GameState;
};

export type LeaderboardEntry = {
  username: string;
  score: number;
  bestWord: string;
};

export type GetLeaderboardResponse = {
  type: 'leaderboard';
  postId: string;
  leaderboard: LeaderboardEntry[];
  dailyFragment: string;
  showWords: boolean;
};
