import React, { useState, useEffect } from 'react';
import { GameState, LeaderboardEntry } from '../../shared/types/api';

interface FragmentsGameProps {
  username: string;
}

export const FragmentsGame: React.FC<FragmentsGameProps> = ({ username }) => {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [currentInput, setCurrentInput] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [dailyFragment, setDailyFragment] = useState<string>('');
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showWords, setShowWords] = useState(false);

  // Timer effect
  useEffect(() => {
    if (!gameState?.gameActive || timeLeft <= 0) return;

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          endGame();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [gameState?.gameActive, timeLeft]);

  // Update timer when game state changes
  useEffect(() => {
    if (gameState) {
      setTimeLeft(gameState.timeLeft);
    }
  }, [gameState]);

  const loadLeaderboard = async () => {
    try {
      const response = await fetch('/api/leaderboard');
      if (!response.ok) throw new Error('Failed to load leaderboard');
      
      const data = await response.json();
      setLeaderboard(data.leaderboard);
      setDailyFragment(data.dailyFragment);
      setShowWords(data.showWords);
    } catch (error) {
      console.error('Error loading leaderboard:', error);
    }
  };

  const startNewGame = async () => {
    setLoading(true);
    setMessage('');
    try {
      const response = await fetch('/api/new-game', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      
      if (!response.ok) throw new Error('Failed to start game');
      
      const data = await response.json();
      setGameState(data.gameState);
      setCurrentInput('');
      setMessage(`New game started! Create words starting with "${data.gameState.fragment}"`);
      setShowLeaderboard(false);
    } catch (error) {
      setMessage('Failed to start new game. Please try again.');
      console.error('Error starting game:', error);
    } finally {
      setLoading(false);
    }
  };

  const submitWord = async () => {
    if (!currentInput.trim() || !gameState?.gameActive || loading) return;

    setLoading(true);
    try {
      const response = await fetch('/api/submit-word', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word: currentInput.trim() }),
      });
      
      if (!response.ok) throw new Error('Failed to submit word');
      
      const data = await response.json();
      setGameState(data.gameState);
      setMessage(data.message);
      setCurrentInput('');
    } catch (error) {
      setMessage('Failed to submit word. Please try again.');
      console.error('Error submitting word:', error);
    } finally {
      setLoading(false);
    }
  };

  const endGame = async () => {
    try {
      const response = await fetch('/api/end-game', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      
      if (!response.ok) throw new Error('Failed to end game');
      
      const data = await response.json();
      setGameState(data.gameState);
      setMessage(`Game Over! Final score: ${data.gameState.score} points`);
      
      // Reload leaderboard after game ends
      await loadLeaderboard();
    } catch (error) {
      console.error('Error ending game:', error);
    }
  };

  // Load leaderboard on component mount
  useEffect(() => {
    loadLeaderboard();
  }, []);



  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Show simplified leaderboard view
  if (showLeaderboard) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 w-full max-w-sm sm:max-w-md">
          <div className="text-center mb-4">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-800 mb-2">Today's Leaderboard</h1>
            {dailyFragment && (
              <div className="bg-blue-50 rounded-lg p-2 mb-3">
                <div className="text-xs text-gray-500">Fragment</div>
                <div className="text-lg sm:text-xl font-bold text-blue-600">{dailyFragment}</div>
              </div>
            )}
          </div>

          <div className="space-y-4">
            {leaderboard.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500 mb-4">No scores yet today. Be the first!</p>
              </div>
            ) : (
              <div className="space-y-2">
                {leaderboard.map((entry, index) => (
                  <div key={entry.username} className={`flex justify-between items-center rounded-lg p-2 ${entry.username === username ? 'bg-blue-100 border-2 border-blue-300' : 'bg-gray-50'}`}>
                    <div className="flex items-center gap-2">
                      <span className={`font-bold text-sm ${index === 0 ? 'text-yellow-600' : index === 1 ? 'text-gray-500' : index === 2 ? 'text-orange-600' : 'text-gray-400'}`}>
                        #{index + 1}
                      </span>
                      <span className={`font-medium text-sm ${entry.username === username ? 'text-blue-700' : 'text-gray-800'}`}>
                        {entry.username} {entry.username === username ? '(You)' : ''}
                      </span>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-green-600 text-sm">{entry.score} pts</div>
                      {showWords && entry.bestWord !== '***' && (
                        <div className="text-xs text-gray-500">{entry.bestWord}</div>
                      )}
                      {!showWords && (
                        <div className="text-xs text-gray-400">Words revealed at day end</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2 justify-center pt-3">
              {!gameState ? (
                <button
                  onClick={startNewGame}
                  disabled={loading}
                  className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white font-medium py-2 px-4 text-sm rounded-lg transition-colors"
                >
                  {loading ? 'Starting...' : 'Start New Game'}
                </button>
              ) : (
                <button
                  onClick={() => setShowLeaderboard(false)}
                  className="bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 text-sm rounded-lg transition-colors"
                >
                  Back to Game
                </button>
              )}
              
              <button
                onClick={() => setShowLeaderboard(false)}
                className="bg-gray-500 hover:bg-gray-600 text-white font-medium py-2 px-4 text-sm rounded-lg transition-colors"
              >
                {gameState ? 'Back' : 'Close'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 w-full max-w-sm sm:max-w-md">
        <div className="text-center mb-4">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800 mb-2">Word Fragments</h1>
          <p className="text-sm text-gray-600">
            {username ? `Welcome ${username}!` : 'Welcome!'}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Create the longest words starting with the given fragment
          </p>
        </div>

        {!gameState ? (
          <div className="text-center space-y-4">
            {dailyFragment && (
              <div className="bg-blue-50 rounded-lg p-3">
                <h3 className="font-medium text-sm text-blue-800">Today's Fragment</h3>
                <div className="text-2xl sm:text-3xl font-bold text-blue-600 my-1">{dailyFragment}</div>
                <p className="text-xs text-blue-600">Everyone gets the same fragment today!</p>
              </div>
            )}
            
            <p className="text-sm text-gray-600 mb-3">Ready to test your vocabulary?</p>
            
            <div className="flex gap-2 justify-center">
              <button
                onClick={startNewGame}
                disabled={loading}
                className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white font-medium py-2 px-4 text-sm rounded-lg transition-colors"
              >
                {loading ? 'Starting...' : 'Start New Game'}
              </button>
              
              <button
                onClick={() => setShowLeaderboard(!showLeaderboard)}
                className="bg-yellow-500 hover:bg-yellow-600 text-white font-medium py-2 px-4 text-sm rounded-lg transition-colors"
              >
                {showLeaderboard ? 'Hide' : 'Show'} Leaderboard
              </button>
            </div>


          </div>
        ) : (
          <div className="space-y-4">
            {/* Game Stats */}
            <div className="flex justify-between items-center bg-gray-50 rounded-lg p-2">
              <div className="text-center">
                <div className="text-xs text-gray-500">Fragment</div>
                <div className="text-lg font-bold text-blue-600">{gameState.fragment}</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-gray-500">Score</div>
                <div className="text-lg font-bold text-green-600">{gameState.score}</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-gray-500">Time</div>
                <div className={`text-lg font-bold ${timeLeft <= 10 ? 'text-red-600' : 'text-orange-600'}`}>
                  {formatTime(timeLeft)}
                </div>
              </div>
            </div>

            {/* Best Word Display */}
            {gameState.bestWord && (
              <div className="text-center bg-yellow-50 rounded-lg p-2">
                <div className="text-xs text-gray-500">Best Word</div>
                <div className="text-base font-bold text-yellow-700">{gameState.bestWord}</div>
                <div className="text-xs text-gray-500">({gameState.bestWord.length} letters)</div>
              </div>
            )}

            {/* Input Section */}
            {gameState.gameActive ? (
              <div className="space-y-3">
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={currentInput}
                    onChange={(e) => setCurrentInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && !loading && submitWord()}
                    placeholder={`Enter word starting with "${gameState.fragment}"`}
                    className="flex-1 px-2 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={loading}
                  />
                  <button
                    onClick={submitWord}
                    disabled={loading || !currentInput.trim()}
                    className="bg-green-500 hover:bg-green-600 disabled:bg-gray-400 text-white font-medium py-2 px-3 text-sm rounded-lg transition-colors"
                  >
                    {loading ? '...' : 'Submit'}
                  </button>
                </div>
                
                <button
                  onClick={endGame}
                  className="w-full bg-red-500 hover:bg-red-600 text-white font-medium py-2 px-4 text-sm rounded-lg transition-colors"
                >
                  End Game
                </button>
              </div>
            ) : (
              <div className="text-center space-y-3">
                <div className="bg-gray-50 rounded-lg p-3">
                  <h3 className="font-bold text-base text-gray-800">Game Over!</h3>
                  <p className="text-sm text-gray-600">Final Score: {gameState.score} points</p>
                  {gameState.bestWord && (
                    <p className="text-sm text-gray-600">Best Word: {gameState.bestWord} ({gameState.bestWord.length} letters)</p>
                  )}
                </div>
                <div className="flex gap-2 justify-center">
                  <button
                    onClick={startNewGame}
                    disabled={loading}
                    className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white font-medium py-2 px-4 text-sm rounded-lg transition-colors"
                  >
                    {loading ? 'Starting...' : 'Play Again'}
                  </button>
                  
                  <button
                    onClick={() => setShowLeaderboard(!showLeaderboard)}
                    className="bg-yellow-500 hover:bg-yellow-600 text-white font-medium py-2 px-4 text-sm rounded-lg transition-colors"
                  >
                    {showLeaderboard ? 'Hide' : 'Show'} Leaderboard
                  </button>
                </div>


              </div>
            )}

            {/* Message Display */}
            {message && (
              <div className={`text-center p-2 rounded-lg text-sm ${
                message.includes('Great!') || message.includes('valid') 
                  ? 'bg-green-50 text-green-700' 
                  : message.includes('not valid') 
                  ? 'bg-red-50 text-red-700'
                  : 'bg-blue-50 text-blue-700'
              }`}>
                {message}
              </div>
            )}
          </div>
        )}

        {/* Instructions */}
        <div className="mt-4 text-center text-xs text-gray-500 space-y-1">
          <p>💡 Longer words earn more points!</p>
          <p>🎯 Try to find the longest possible word</p>
          <p>🌍 Everyone gets the same daily fragment</p>
          <p>🔄 New fragment every 24 hours</p>
        </div>
      </div>
    </div>
  );
};