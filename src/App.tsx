import { GameProvider, useGame } from './context/GameContext';
import { UISettingsProvider } from './context/UISettingsContext';
import ErrorBoundary from './components/ErrorBoundary';
import SettingsScreen from './components/SettingsScreen';
import StartScreen from './components/start/StartScreen';

function AppContent() {
  const { state } = useGame();

  switch (state.currentScreen) {
    case 'settings':
      return <SettingsScreen />;
    default:
      return <StartScreen />;
  }
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
