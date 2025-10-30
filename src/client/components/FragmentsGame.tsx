import React, { useState, useEffect, useCallback } from 'react';
import { GameState } from '../../shared/types/api';

interface FragmentsGameProps {
  username: string;
}

export const FragmentsGame: React.FC<FragmentsGameProps> = ({ username }) => {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [currentInput, setCurrentInput] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);

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
    } catch (error) {
      console.error('Error ending game:', error);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !loading) {
      submitWord();
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="bg-white rounded-xl shadow-lg p-8 w-full max-w-md">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Word Fragments</h1>
          <p className="text-gray-600">
            {username ? `Welcome ${username}!` : 'Welcome!'}
          </p>
          <p className="text-sm text-gray-500 mt-2">
            Create the longest words starting with the given fragment
          </p>
        </div>

        {!gameState ? (
          <div className="text-center">
            <p className="text-gray-600 mb-4">Ready to test your vocabulary?</p>
            <button
              onClick={startNewGame}
              disabled={loading}
              className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white font-bold py-3 px-6 rounded-lg transition-colors"
            >
              {loading ? 'Starting...' : 'Start New Game'}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Game Stats */}
            <div className="flex justify-between items-center bg-gray-50 rounded-lg p-3">
              <div className="text-center">
                <div className="text-sm text-gray-500">Fragment</div>
                <div className="text-xl font-bold text-blue-600">{gameState.fragment}</div>
              </div>
              <div className="text-center">
                <div className="text-sm text-gray-500">Score</div>
                <div className="text-xl font-bold text-green-600">{gameState.score}</div>
              </div>
              <div className="text-center">
                <div className="text-sm text-gray-500">Time</div>
                <div className={`text-xl font-bold ${timeLeft <= 10 ? 'text-red-600' : 'text-orange-600'}`}>
                  {formatTime(timeLeft)}
                </div>
              </div>
            </div>

            {/* Best Word Display */}
            {gameState.bestWord && (
              <div className="text-center bg-yellow-50 rounded-lg p-3">
                <div className="text-sm text-gray-500">Best Word</div>
                <div className="text-lg font-bold text-yellow-700">{gameState.bestWord}</div>
                <div className="text-sm text-gray-500">({gameState.bestWord.length} letters)</div>
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
                    onKeyPress={handleKeyPress}
                    placeholder={`Enter word starting with "${gameState.fragment}"`}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    disabled={loading}
                  />
                  <button
                    onClick={submitWord}
                    disabled={loading || !currentInput.trim()}
                    className="bg-green-500 hover:bg-green-600 disabled:bg-gray-400 text-white font-bold py-2 px-4 rounded-lg transition-colors"
                  >
                    {loading ? '...' : 'Submit'}
                  </button>
                </div>
                
                <button
                  onClick={endGame}
                  className="w-full bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-lg transition-colors"
                >
                  End Game
                </button>
              </div>
            ) : (
              <div className="text-center space-y-3">
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-bold text-lg text-gray-800">Game Over!</h3>
                  <p className="text-gray-600">Final Score: {gameState.score} points</p>
                  {gameState.bestWord && (
                    <p className="text-gray-600">Best Word: {gameState.bestWord} ({gameState.bestWord.length} letters)</p>
                  )}
                </div>
                <button
                  onClick={startNewGame}
                  disabled={loading}
                  className="bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white font-bold py-3 px-6 rounded-lg transition-colors"
                >
                  {loading ? 'Starting...' : 'Play Again'}
                </button>
              </div>
            )}

            {/* Message Display */}
            {message && (
              <div className={`text-center p-3 rounded-lg ${
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
        <div className="mt-6 text-center text-sm text-gray-500">
          <p>💡 Longer words earn more points!</p>
          <p>🎯 Try to find the longest possible word</p>
        </div>
      </div>
    </div>
  );
};