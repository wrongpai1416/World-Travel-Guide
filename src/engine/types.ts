import type { VariableManager } from './variableManager';
import type { WorldBookManager } from '../worldbook/index';
import type { GameSave, PlayerProfile, CustomNpc } from '../storage/db';
import type { PipelineStatus } from './pipelineTypes';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  thinking?: string;
  actionOptions?: string[];
  summary?: string;
  round: number;
  timestamp: number;
  streaming?: boolean;
  snapshot?: unknown;
  snapshotTime?: number;
  memoryCheckpointId?: string;
}

export interface GameEngine {
  sendMessage: (userText: string) => Promise<void>;
  cancel: () => void;
  isGenerating: boolean;
  messages: ChatMessage[];
  variableManager: VariableManager;
  worldBook: WorldBookManager | null;
  pipelineStatus: PipelineStatus | null;
  deleteSingleMessage: (id: string) => void;
  editMessage: (id: string, content: string) => void;
  resendFromMessage: (id: string) => Promise<void>;
  resendFromAssistantMessage: (id: string) => Promise<void>;
  loadSave: (save: GameSave) => void;
  reset: () => void;
  setPlayerProfile: (profile: PlayerProfile) => void;
  setInitialNPCs: (npcs: CustomNpc[]) => void;
  addMessage: (msg: ChatMessage) => void;
}
