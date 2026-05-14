import { createContext, useCallback, useContext } from 'react';
import { RESET_CONTEXT } from './createStateContext';
import { useUiContextState } from './UiContext';
import { useAuthContextState } from './AuthContext';
import { useCandidateContextState } from './CandidateContext';
import { useCandidateATSContextState } from './CandidateATSContext';
import { useJobContextState } from './JobContext';
import { useCompanyContextState } from './CompanyContext';
import { useRecruiterContextState } from './RecruiterContext';
import { useClientAdminContextState } from './ClientAdminContext';
import { useInterviewerContextState } from './InterviewerContext';
import { useInterviewContextState } from './InterviewContext';
import { useStageContextState } from './StageContext';
import { useAICampaignContextState } from './AICampaignContext';
import { useAIAgentContextState } from './AIAgentContext';
import { useCallSimulationContextState } from './CallSimulationContext';
import { useDashboardContextState } from './DashboardContext';
import { useArchiveContextState } from './ArchiveContext';

const ResetContext = createContext(() => { });

export const ResetProvider = ({ children }) => {
    const [, setUiState] = useUiContextState();
    const [, setAuthState] = useAuthContextState();
    const [, setCandidateState] = useCandidateContextState();
    const [, setCandidateATSState] = useCandidateATSContextState();
    const [, setJobState] = useJobContextState();
    const [, setCompanyState] = useCompanyContextState();
    const [, setRecruiterState] = useRecruiterContextState();
    const [, setClientAdminState] = useClientAdminContextState();
    const [, setInterviewerState] = useInterviewerContextState();
    const [, setInterviewState] = useInterviewContextState();
    const [, setStageState] = useStageContextState();
    const [, setAICampaignState] = useAICampaignContextState();
    const [, setAIAgentState] = useAIAgentContextState();
    const [, setCallSimulationState] = useCallSimulationContextState();
    const [, setDashboardState] = useDashboardContextState();
    const [, setArchiveState] = useArchiveContextState();

    const resetAll = useCallback(() => {
        setUiState(RESET_CONTEXT);
        setAuthState(RESET_CONTEXT);
        setCandidateState(RESET_CONTEXT);
        setCandidateATSState(RESET_CONTEXT);
        setJobState(RESET_CONTEXT);
        setCompanyState(RESET_CONTEXT);
        setRecruiterState(RESET_CONTEXT);
        setClientAdminState(RESET_CONTEXT);
        setInterviewerState(RESET_CONTEXT);
        setInterviewState(RESET_CONTEXT);
        setStageState(RESET_CONTEXT);
        setAICampaignState(RESET_CONTEXT);
        setAIAgentState(RESET_CONTEXT);
        setCallSimulationState(RESET_CONTEXT);
        setDashboardState(RESET_CONTEXT);
        setArchiveState(RESET_CONTEXT);
    }, [
        setUiState,
        setAuthState,
        setCandidateState,
        setCandidateATSState,
        setJobState,
        setCompanyState,
        setRecruiterState,
        setClientAdminState,
        setInterviewerState,
        setInterviewState,
        setStageState,
        setAICampaignState,
        setAIAgentState,
        setCallSimulationState,
        setDashboardState,
        setArchiveState,
    ]);

    return <ResetContext.Provider value={resetAll}>{children}</ResetContext.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components
export const useResetAllContexts = () => useContext(ResetContext);
