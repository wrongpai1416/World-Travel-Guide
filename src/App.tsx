import { GameProvider, useGame } from './context/GameContext';
import { UISettingsProvider } from './context/UISettingsContext';
import ErrorBoundary from './components/ErrorBoundary';

function AppContent() {
  const { state } = useGame();
  return (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      <h1>世界漫游指南</h1>
      <p>当前页面: {state.currentScreen}</p>
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <UISettingsProvider>
        <GameProvider>
          <AppContent />
        </GameProvider>
      </UISettingsProvider>
    </ErrorBoundary>
  );
}
