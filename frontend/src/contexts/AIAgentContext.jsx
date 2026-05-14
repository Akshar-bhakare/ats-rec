import { createStateContext } from './createStateContext';

const initialState = {
    isAIAgentAssistantChatOpen: false,
};

const { Provider: AIAgentProvider, useContextState: useAIAgentContextState } = createStateContext(
    'AIAgentContext',
    initialState
);

export { AIAgentProvider, useAIAgentContextState };
