import { createStateContext } from './createStateContext';

const initialState = {
    aiCallDemoStatus: null,
    aiCallDemoMuted: false,
    aiCallDemoIsSpeaking: false,
    aiCallDemoJobId: null,
    aiCallDemoCandidateFirstName: null,
    aiCallDemoWsRef: null,
    aiCallDemoAudioCtxRef: null,
    aiCallDemoMediaStreamRef: null,
    aiCallDemoSourceRef: null,
    aiCallDemoProcessorRef: null,
    aiCallDemoSilenceTimerRef: null,
    aiCallDemoCallIdRef: null,
    aiCallDemoStartedRef: null,
    aiCallDemoConfigRef: null,
    aiCallDemoActiveAudioSources: null,
    aiCallDemoSeconds: 0,
    demoMailGiven: null,
};

const { Provider: CallSimulationProvider, useContextState: useCallSimulationContextState } = createStateContext(
    'CallSimulationContext',
    initialState
);

export { CallSimulationProvider, useCallSimulationContextState };
