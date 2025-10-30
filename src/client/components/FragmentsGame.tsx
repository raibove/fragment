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
  const [scoreLeaderboard, setScoreLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [wordLeaderboard, setWordLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [dailyFragment, setDailyFragment] = useState<string>('');
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [showWords, setShowWords] = useState(false);
  const [activeTab, setActiveTab] = useState<'score' | 'word'>('score');
  const [fragmentTimeLeft, setFragmentTimeLeft] = useState(0);
  const [showAbout, setShowAbout] = useState(false);

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
      setScoreLeaderboard(data.scoreLeaderboard || []);
      setWordLeaderboard(data.wordLeaderboard || []);
      setDailyFragment(data.dailyFragment || '');
      setShowWords(data.showWords || false);
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
      setShowAbout(false);
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
      setMessage(''); // Clear any previous messages
      
      // Reload leaderboard after game ends
      await loadLeaderboard();
    } catch (error) {
      console.error('Error ending game:', error);
    }
  };

  // Calculate time until next fragment (midnight)
  const calculateFragmentTimeLeft = () => {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0); // Set to midnight
    
    return Math.floor((tomorrow.getTime() - now.getTime()) / 1000);
  };

  // Fragment countdown timer effect
  useEffect(() => {
    // Set initial time
    setFragmentTimeLeft(calculateFragmentTimeLeft());

    const fragmentTimer = setInterval(() => {
      const timeLeft = calculateFragmentTimeLeft();
      setFragmentTimeLeft(timeLeft);
      
      // If fragment expired, reload to get new fragment
      if (timeLeft <= 0) {
        loadLeaderboard();
      }
    }, 1000);

    return () => clearInterval(fragmentTimer);
  }, []);

  // Load leaderboard on component mount
  useEffect(() => {
    loadLeaderboard();
  }, []);



  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatFragmentTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${mins}m ${secs}s`;
    } else if (mins > 0) {
      return `${mins}m ${secs}s`;
    } else {
      return `${secs}s`;
    }
  };

  // Show About Game modal
  if (showAbout) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="bg-white rounded-xl shadow-lg p-6 w-full max-w-md">
          <div className="text-center mb-6">
            <h1 className="text-xl font-bold text-gray-800 mb-2">How to Play</h1>
            <div className="w-12 h-1 bg-blue-500 rounded mx-auto"></div>
          </div>

          <div className="space-y-4 text-sm text-gray-700">
            <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
              <h3 className="font-semibold text-blue-800 mb-2">🎯 Objective</h3>
              <p>Create the longest valid words starting with the daily fragment to earn points and climb the leaderboards!</p>
            </div>

            <div className="space-y-3">
              <div>
                <h4 className="font-semibold text-gray-800 mb-1">⏱️ Game Rules</h4>
                <ul className="space-y-1 text-xs text-gray-600 ml-4">
                  <li>• You have 60 seconds per game</li>
                  <li>• Words must start with the given fragment</li>
                  <li>• Minimum 3 letters per word</li>
                  <li>• Longer words earn more points</li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold text-gray-800 mb-1">🏆 Scoring</h4>
                <ul className="space-y-1 text-xs text-gray-600 ml-4">
                  <li>• Base score = word length</li>
                  <li>• Bonus points for words 6+ letters</li>
                  <li>• Example: "alternate" (9 letters) = 17 points</li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold text-gray-800 mb-1">📊 Leaderboards</h4>
                <ul className="space-y-1 text-xs text-gray-600 ml-4">
                  <li>• High Scores: Total points earned</li>
                  <li>• Longest Words: Best single word</li>
                  <li>• Daily reset at midnight</li>
                </ul>
              </div>

              <div>
                <h4 className="font-semibold text-gray-800 mb-1">🌍 Daily Challenge</h4>
                <ul className="space-y-1 text-xs text-gray-600 ml-4">
                  <li>• Everyone gets the same fragment</li>
                  <li>• New fragment every 24 hours</li>
                  <li>• Compete globally with all players</li>
                </ul>
              </div>
            </div>

            <div className="bg-yellow-50 rounded-lg p-3 border border-yellow-200">
              <p className="text-xs text-yellow-800">
                <strong>💡 Pro Tip:</strong> Think of compound words, plurals, and different word forms to maximize your score!
              </p>
            </div>
          </div>

          <div className="pt-6 space-y-2">
            <button
              onClick={startNewGame}
              disabled={loading}
              className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white font-medium py-3 px-6 rounded-lg transition-colors shadow-sm"
            >
              {loading ? 'Starting...' : 'Start Playing'}
            </button>
            
            <button
              onClick={() => setShowAbout(false)}
              className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2 px-6 rounded-lg transition-colors"
            >
              Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Show simplified leaderboard view
  if (showLeaderboard) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 w-full max-w-sm sm:max-w-md">
          <div className="text-center mb-6">
            <h1 className="text-xl font-bold text-gray-800 mb-2">Leaderboard</h1>
            {dailyFragment && (
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 bg-blue-50 rounded-lg px-3 py-1 border border-blue-200">
                  <span className="text-lg font-bold text-blue-600">{dailyFragment}</span>
                  <span className="text-xs text-blue-700">Today's Fragment</span>
                </div>
                <div className="text-center">
                  <div className="text-xs text-gray-500">New fragment in:</div>
                  <div className={`text-sm font-mono font-medium ${fragmentTimeLeft <= 3600 ? 'text-red-600' : 'text-gray-700'}`}>
                    {formatFragmentTime(fragmentTimeLeft)}
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="space-y-4">
            {/* Tabs */}
            <div className="flex bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => setActiveTab('score')}
                className={`flex-1 py-2 px-3 text-xs font-medium rounded-md transition-colors ${
                  activeTab === 'score'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                🏆 High Scores
              </button>
              <button
                onClick={() => setActiveTab('word')}
                className={`flex-1 py-2 px-3 text-xs font-medium rounded-md transition-colors ${
                  activeTab === 'word'
                    ? 'bg-white text-blue-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                📏 Longest Words
              </button>
            </div>

            {/* Leaderboard Content */}
            {(() => {
              const currentLeaderboard = activeTab === 'score' ? scoreLeaderboard : wordLeaderboard;
              
              if (!currentLeaderboard || currentLeaderboard.length === 0) {
                return (
                  <div className="text-center py-8">
                    <p className="text-gray-500 mb-4">No entries yet today. Be the first!</p>
                  </div>
                );
              }

              return (
                <div className="space-y-2">
                  {currentLeaderboard.map((entry, index) => (
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
                        {activeTab === 'score' ? (
                          <>
                            <div className="font-bold text-green-600 text-sm">{entry.score} pts</div>
                            {showWords && entry.bestWord && entry.bestWord !== '***' && entry.bestWord.length > 0 && (
                              <div className="text-xs text-gray-500">{entry.bestWord}</div>
                            )}
                            {!showWords && (
                              <div className="text-xs text-gray-400">Words revealed at day end</div>
                            )}
                          </>
                        ) : (
                          <>
                            {entry.bestWord && entry.bestWord !== '***' ? (
                              <>
                                <div className="font-bold text-purple-600 text-sm">{entry.bestWord}</div>
                                <div className="text-xs text-gray-500">{entry.bestWord.length} letters • {entry.score} pts</div>
                              </>
                            ) : (
                              <>
                                <div className="font-bold text-purple-600 text-sm">{entry.bestWord?.length || 0} letters</div>
                                <div className="text-xs text-gray-400">
                                  {index === 0 && !showWords ? 'Longest word revealed at day end' : 'Word hidden'}
                                </div>
                              </>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}

            <div className="pt-4 space-y-2">
              {!gameState ? (
                <button
                  onClick={startNewGame}
                  disabled={loading}
                  className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white font-medium py-3 px-6 rounded-lg transition-colors shadow-sm"
                >
                  {loading ? 'Starting...' : 'Start New Game'}
                </button>
              ) : (
                <button
                  onClick={() => setShowLeaderboard(false)}
                  className="w-full bg-blue-500 hover:bg-blue-600 text-white font-medium py-3 px-6 rounded-lg transition-colors shadow-sm"
                >
                  Back to Game
                </button>
              )}
              
              <button
                onClick={() => setShowLeaderboard(false)}
                className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2 px-6 rounded-lg transition-colors"
              >
                Close
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
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-800 mb-1">Word Fragments</h1>
          {username && (
            <p className="text-sm text-gray-600">Welcome {username}!</p>
          )}
        </div>

        {!gameState ? (
          <div className="text-center space-y-6">
            {dailyFragment && (
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 border border-blue-100">
                <div className="text-4xl font-bold text-blue-600 mb-2">{dailyFragment}</div>
                <p className="text-sm text-blue-700 mb-2">Today's Fragment</p>
                <div className="bg-white/50 rounded-lg px-3 py-2 inline-block">
                  <div className="text-xs text-blue-600 mb-1">New fragment in:</div>
                  <div className={`text-sm font-mono font-bold ${fragmentTimeLeft <= 3600 ? 'text-red-600' : 'text-blue-700'}`}>
                    {formatFragmentTime(fragmentTimeLeft)}
                  </div>
                </div>
              </div>
            )}
            
            <div className="space-y-3">
              <button
                onClick={startNewGame}
                disabled={loading}
                className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white font-medium py-3 px-6 rounded-lg transition-colors shadow-sm"
              >
                {loading ? 'Starting...' : 'Start New Game'}
              </button>
              
              <div className="flex gap-2">
                <button
                  onClick={() => setShowLeaderboard(!showLeaderboard)}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2 px-4 rounded-lg transition-colors"
                >
                  Leaderboard
                </button>
                
                <button
                  onClick={() => setShowAbout(true)}
                  className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2 px-4 rounded-lg transition-colors"
                >
                  How to Play
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Game Header - only show when game is active */}
            {gameState.gameActive && (
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-3 border border-blue-100">
                <div className="flex justify-between items-center">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">{gameState.fragment}</div>
                    <div className="text-xs text-blue-700">Fragment</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xl font-bold text-green-600">{gameState.score}</div>
                    <div className="text-xs text-green-700">Score</div>
                  </div>
                  <div className="text-center">
                    <div className={`text-xl font-bold ${timeLeft <= 10 ? 'text-red-600' : 'text-orange-600'}`}>
                      {formatTime(timeLeft)}
                    </div>
                    <div className="text-xs text-gray-600">Time</div>
                  </div>
                </div>
              </div>
            )}

            {/* Best Word Display - only show when game is active */}
            {gameState.bestWord && gameState.gameActive && (
              <div className="text-center bg-yellow-50 rounded-lg p-3 border border-yellow-200">
                <div className="text-lg font-bold text-yellow-700">{gameState.bestWord}</div>
                <div className="text-xs text-yellow-600">Best Word • {gameState.bestWord.length} letters</div>
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
              <div className="text-center space-y-4">
                <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-lg p-4 border border-green-200">
                  <h3 className="font-bold text-lg text-gray-800 mb-2">Game Complete!</h3>
                  <div className="text-2xl font-bold text-green-600 mb-1">{gameState.score}</div>
                  <p className="text-sm text-gray-600">Final Score</p>
                  {gameState.bestWord && (
                    <div className="mt-2 pt-2 border-t border-green-200">
                      <p className="text-sm text-gray-700">Best Word: <span className="font-medium">{gameState.bestWord}</span> ({gameState.bestWord.length} letters)</p>
                    </div>
                  )}
                </div>
                
                <div className="space-y-2">
                  <button
                    onClick={startNewGame}
                    disabled={loading}
                    className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white font-medium py-3 px-6 rounded-lg transition-colors shadow-sm"
                  >
                    {loading ? 'Starting...' : 'Play Again'}
                  </button>
                  
                  <button
                    onClick={() => setShowLeaderboard(!showLeaderboard)}
                    className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2 px-6 rounded-lg transition-colors"
                  >
                    View Leaderboard
                  </button>
                </div>
              </div>
            )}

            {/* Message Display - only show when game is active */}
            {message && gameState.gameActive && (
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

        {/* Simple tip - only show when not in game */}
        {!gameState && (
          <div className="mt-6 text-center">
            <p className="text-xs text-gray-500">💡 Longer words earn more points</p>
          </div>
        )}
      </div>
    </div>
  );
};