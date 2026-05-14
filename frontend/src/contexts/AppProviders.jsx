import { UiProvider } from './UiContext';
import { AuthProvider } from './AuthContext';
import { CandidateProvider } from './CandidateContext';
import { CandidateATSProvider } from './CandidateATSContext';
import { JobProvider } from './JobContext';
import { CompanyProvider } from './CompanyContext';
import { RecruiterProvider } from './RecruiterContext';
import { ClientAdminProvider } from './ClientAdminContext';
import { InterviewerProvider } from './InterviewerContext';
import { InterviewProvider } from './InterviewContext';
import { StageProvider } from './StageContext';
import { AICampaignProvider } from './AICampaignContext';
import { AIAgentProvider } from './AIAgentContext';
import { CallSimulationProvider } from './CallSimulationContext';
import { DashboardProvider } from './DashboardContext';
import { ArchiveProvider } from './ArchiveContext';
import { ResetProvider } from './ResetContext';
import { UnheadProvider } from '@unhead/react/client';

export const AppProviders = ({ children }) => (
    <UnheadProvider>
        <UiProvider>
            <AuthProvider>
                <CandidateProvider>
                    <CandidateATSProvider>
                        <JobProvider>
                            <CompanyProvider>
                                <RecruiterProvider>
                                    <ClientAdminProvider>
                                        <InterviewerProvider>
                                            <InterviewProvider>
                                                <StageProvider>
                                                    <AICampaignProvider>
                                                        <AIAgentProvider>
                                                            <CallSimulationProvider>
                                                                <DashboardProvider>
                                                                    <ArchiveProvider>
                                                                        <ResetProvider>{children}</ResetProvider>
                                                                    </ArchiveProvider>
                                                                </DashboardProvider>
                                                            </CallSimulationProvider>
                                                        </AIAgentProvider>
                                                    </AICampaignProvider>
                                                </StageProvider>
                                            </InterviewProvider>
                                        </InterviewerProvider>
                                    </ClientAdminProvider>
                                </RecruiterProvider>
                            </CompanyProvider>
                        </JobProvider>
                    </CandidateATSProvider>
                </CandidateProvider>
            </AuthProvider>
        </UiProvider>
    </UnheadProvider>
);
