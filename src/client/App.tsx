import { useCounter } from './hooks/useCounter';
import { FragmentsGame } from './components/FragmentsGame';

export const App = () => {
  const { username, loading } = useCounter();
  
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-xl text-gray-600">Loading...</div>
      </div>
    );
  }

  return <FragmentsGame username={username || 'Player'} />;
};
