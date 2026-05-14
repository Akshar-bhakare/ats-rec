import React, { lazy, Suspense, useEffect, useMemo, useRef } from 'react';
import { CssBaseline, ThemeProvider } from '@mui/material';
import { useAuthContextState } from './contexts/AuthContext';
import { useUiContextState } from './contexts/UiContext';
import { getTheme } from './components/MUI/Config/muiTheme';
import {
    BrowserRouter as Router,
    Routes,
    Route,
    Outlet,
    Navigate,
    matchPath,
    useLocation
} from 'react-router-dom';
import { fetchData } from './AppUtils/dataAPI';
import { useHead } from '@unhead/react';
import { APP_NAME, composeDocumentTitle } from './AppUtils/documentTitle';
import { marketingPages, blogPosts } from './components/LandingPage(NewUI)/pages/marketingContent';

import MUISpinner from './components/MUI/commonUI/MUISpinner';
import CookieConsentBanner from './components/MUI/commonUI/CookieConsentBanner';
import { getJourneyRouteForRole, resolveJourneyRoleFromUserRole } from './components/journey/journeyMapConfig';
import JourneyMapPage from './components/journey/JourneyMapPage';

const WebRTC = lazy(() => import('./components/WebRTC'));
const InterviewVerification = lazy(() => import('./components/Interview/InterviewVerification'));

// Auth
const LoginForm = lazy(() => import('./components/auth/LoginForm'));
const RegisterForm = lazy(() => import('./components/auth/RegisterForm'));
const Profile = lazy(() => import('./components/auth/Profile'));
const ForgetOrChangePasswordForm = lazy(() => import('./components/auth/ForgetOrChangePasswordForm'));

const TermsConditions = lazy(() => import('./components/landingPage/TermsConditions'));
const PrivacyPolicy = lazy(() => import('./components/landingPage/PrivacyPolicy'));
const EmailUnsubscribe = lazy(() => import('./components/landingPage/EmailUnsubscribe'));

// credit detail
const UsedCreditDetail = lazy(() => import('./components/credits/UsedCreditDetail'));
const VideoInterviewLogs = lazy(() => import('./components/credits/VideoInterviewLogs'));

// Layout
const Layout = lazy(() => import('./components/MUI/MUILayout'));

// Landing Page
const HeroSection = lazy(() => import('./components/landingPage/HeroSection'));
const LegacyLandingPage = lazy(() => import('./components/landingPage/LandingPage'));
const LandingPageV2 = lazy(() => import('./components/landingPage/LandingPageV2'));
const RootLayout = lazy(() => import('./components/LandingPage(NewUI)/components/layout/RootLayout'));
const LandingPage = lazy(() => import('./components/LandingPage(NewUI)/LandingPage'));
const MarketingPage = lazy(() => import('./components/LandingPage(NewUI)/pages/MarketingPage'));
const PricingPage = lazy(() => import('./components/LandingPage(NewUI)/pages/PricingPage'));
const BookDemoPage = lazy(() => import('./components/LandingPage(NewUI)/pages/BookDemoPage'));
const BlogArticlePage = lazy(() => import('./components/LandingPage(NewUI)/pages/BlogArticlePage'));
const BlogIndexPage = lazy(() => import('./components/LandingPage(NewUI)/pages/BlogIndexPage'));
const FakePlivoCall = lazy(() => import('./components/CallSimulation/FakePlivoCall'));

// Settigns 
const NewService = lazy(() => import('./components/userSettings/NewService'));
const ServicesList = lazy(() => import('./components/userSettings/ServicesList'));
const ClientAdminSettings = lazy(() => import('./components/userSettings/ClientAdminSettings'));

// Client-Admin
const NewClientAdmin = lazy(() => import('./components/clientAdmin/NewClientAdmin'));
const ClientAdminsList = lazy(() => import('./components/clientAdmin/ClientAdminsList'));
const ClientAdminDetail = lazy(() => import('./components/clientAdmin/ClientAdminDetail'));

// Recruiters
const RecruitersList = lazy(() => import('./components/recruiter/RecruitersList'));
const NewRecruiter = lazy(() => import('./components/recruiter/NewRecruiter'));
const RecruiterDetail = lazy(() => import('./components/recruiter/RecruiterDetail'));
const ManagersList = lazy(() => import('./components/manager/ManagersList'));
const NewManager = lazy(() => import('./components/manager/NewManager'));
const ManagerDetail = lazy(() => import('./components/manager/ManagerDetail'));

// Companies
const NewCompany = lazy(() => import('./components/company/NewCompany'));
const CompaniesList = lazy(() => import('./components/company/CompaniesList'));
const CompanyDetail = lazy(() => import('./components/company/CompanyDetail'));

// Candidate - ATS
const NewStage = lazy(() => import('./components/CandidateATS/Stages/NewStage'));
const StagesList = lazy(() => import('./components/CandidateATS/Stages/StagesList'));
const StageDetail = lazy(() => import('./components/CandidateATS/Stages/StageDetail'));
const CandidateATSList = lazy(() => import('./components/CandidateATS/CandidateATSList'));

// Job
const NewJob = lazy(() => import('./components/job/NewJob'));
const JobsList = lazy(() => import('./components/job/JobsList'));
const JobDetail = lazy(() => import('./components/job/JobDetail'));

const HiringPipeline = lazy(() => import('./components/job/HiringPipeline'));

// Candidates
const NewCandidates = lazy(() => import('./components/candidate/NewCandidates'));
const CandidatesList = lazy(() => import('./components/candidate/CandidatesList'));
const CandidateDetail = lazy(() => import('./components/candidate/CandidateDetail'));
const EditCandidate = lazy(() => import('./components/candidate/EditCandidate'));

// AI Call Logs
const InboundCallLogs = lazy(() => import('./components/aiCalls/InboundCallLogs'));

//Interview and interviewer
const InterviewDetail = lazy(() => import('./components/Interview/InterviewDetail'));
const InterviewsList = lazy(() => import('./components/Interview/InterviewsList'));
const MyInterviewsList = lazy(() => import('./components/Interview/MyInterviewsList'));
const InterviewerDetail = lazy(() => import('./components/interviewer/InterviewerDetail'));
const NewInterviewer = lazy(() => import('./components/interviewer/NewInterviewer'));
const InterviewersList = lazy(() => import('./components/interviewer/InterviewersList'));
const InterviewScheduler = lazy(() => import('./components/CandidateATS/InterviewScheduler'));

// Dashboards
const Dashboard = lazy(() => import('./components/Dashboard/dashboard'));

// Other Page
const AITools = lazy(() => import('./components/aiTools/AITools'));
const BooleanSearch = lazy(() => import('./components/job/BooleanSearch'));
const ArchivedBin = lazy(() => import('./components/job/ArchivedBin'));
const NotificationsPage = lazy(() => import('./components/MUI/commonUI/NotificationsPage'));
const NotificationDetailPage = lazy(() => import('./components/MUI/commonUI/NotificationDetailPage'));
const MuiNotification = lazy(() => import('./components/MUI/commonUI/MuiNotification'));
const ShareCvUpload = lazy(() => import('./components/jobShare/CandidateUploadFlow'));
const HiringSetupLayout = lazy(() => import('./components/hiringSetup/HiringSetupLayout'));
const HumeAI_VoicePreview = lazy(() => import('./components/humeAI/HumeAI_VoicePreview'));

const PAGE_TITLE_RULES = [
    { path: '/', title: 'Home' },
    { path: '/v1', title: 'Home' },
    { path: '/v2', title: 'Home' },
    { path: '/industries', title: 'Industries' },
    { path: '/pricing', title: 'Pricing' },
    { path: '/book-demo', title: 'Book Demo' },
    { path: '/about', title: 'About' },
    { path: '/why-us', title: 'Why Us' },
    { path: '/blog', title: 'Blog' },
    { path: '/blog/future-of-tech-hiring', title: 'Future of Tech Hiring' },
    { path: '/blog/cfo-case-for-ai-recruitment', title: 'The CFO\'s Case for AI Recruitment' },
    { path: '/blog/why-traditional-recruitment-is-failing', title: 'Why Traditional Recruitment Is Failing You' },
    { path: '/share/upload', title: 'Candidate Upload' },
    { path: '/journey-map', title: 'Journey Map' },
    { path: '/journey-map/client-admin', title: 'Client-admin Journey' },
    { path: '/journey-map/recruiter', title: 'Recruiter Journey' },
    { path: '/journey-map/interviewer', title: 'Interviewer Journey' },
    { path: '/journey-map/candidate', title: 'Candidate Journey' },
    { path: '/privacypolicy', title: 'Privacy Policy' },
    { path: '/termscondition', title: 'Terms and Conditions' },
    { path: '/unsubscribe', title: 'Unsubscribe' },
    { path: '/loader', title: 'Loading' },
    { path: '/webrtcai', title: 'WebRTC AI' },
    { path: '/profile', title: 'My Profile' },
    { path: '/settings', title: 'Settings' },
    { path: '/settings/new', title: 'New Setting' },
    { path: '/recruiters', title: 'Recruiters' },
    { path: '/recruiters/new', title: 'New Recruiter' },
    { path: '/recruiters/:id', title: 'Recruiter Detail' },
    { path: '/managers', title: 'Managers' },
    { path: '/managers/new', title: 'New Manager' },
    { path: '/managers/:id', title: 'Manager Detail' },
    { path: '/admins', title: 'Client Admins' },
    { path: '/admins/new', title: 'New Client Admin' },
    { path: '/admins/:id', title: 'Client Admin Detail' },
    { path: '/archive-bin', title: 'Archive Bin' },
    { path: '/dashboard', title: 'Dashboard' },
    { path: '/dashboard/recruiter/:id', title: 'Recruiter Dashboard' },
    { path: '/hiring-setup', title: 'Hiring Setup' },
    { path: '/companies', title: 'Companies' },
    { path: '/companies/new', title: 'New Company' },
    { path: '/companies/:id', title: 'Company Detail' },
    { path: '/jobs', title: 'Jobs' },
    { path: '/jobs/new', title: 'New Job' },
    { path: '/jobs/edit/:id', title: 'Edit Job' },
    { path: '/jobs/:id', title: 'Job Detail' },
    { path: '/hiring-pipeline', title: 'Hiring Pipeline' },
    { path: '/hiring-pipeline/:id', title: 'Hiring Pipeline' },
    { path: '/candidates', title: 'Candidates' },
    { path: '/candidates/new', title: 'New Candidate' },
    { path: '/candidates/edit/:id', title: 'Edit Candidate' },
    { path: '/candidates/:id', title: 'Candidate Detail' },
    { path: '/ats', title: 'ATS' },
    { path: '/ai/tools', title: 'AI Tools' },
    { path: '/booleansearch', title: 'Boolean Search' },
    { path: '/boolean/search', title: 'Boolean Search' },
    { path: '/stages/new', title: 'New Stage' },
    { path: '/stages', title: 'Stages' },
    { path: '/stages/:id', title: 'Stage Detail' },
    { path: '/hero', title: 'Hero Section' },
    { path: '/muinotification', title: 'MUI Notification' },
    { path: '/notifications', title: 'Notifications' },
    { path: '/notifications/:id', title: 'Notification Detail' },
    { path: '/interviewers', title: 'Interviewers' },
    { path: '/interviewers/new', title: 'New Interviewer' },
    { path: '/interviewers/:id', title: 'Interviewer Detail' },
    { path: '/interviews', title: 'Interviews' },
    { path: '/interviews/:id', title: 'Interview Detail' },
    { path: '/ai-call-logs', title: 'AI Call Logs' },
    { path: '/hume-voice-preview', title: 'Hume AI Voice Preview' },
    { path: '/credits/used', title: 'AI Call Credit Detail' },
    { path: '/video-interview-logs', title: 'AI Interview Logs' },
    { path: '/simulation/ai/call', title: 'AI Call Simulation' },
    { path: '/interviews/schedule', title: 'Interview Scheduler' },
    { path: '/password/forget', title: 'Change Password' },
    { path: '/auth', title: 'Sign In' },
    { path: '/auth/login', title: 'Sign In' },
    { path: '/auth/password/forget', title: 'Forgot Password' },
    { path: '/auth/register', title: 'Register' },
];

const normalizePathname = (pathname = '') => {
    const cleaned = String(pathname).replace(/\/+$/, '');
    return cleaned || '/';
};

const fallbackTitleFromPath = (pathname) => {
    const segments = normalizePathname(pathname)
        .split('/')
        .filter(Boolean)
        .filter((segment) => !/^[a-fA-F0-9]{24}$/.test(segment))
        .filter((segment) => !/^\d+$/.test(segment));

    const lastSegment = segments[segments.length - 1];
    if (!lastSegment) return APP_NAME;
    return lastSegment
        .replace(/[-_]/g, ' ')
        .replace(/\b\w/g, (char) => char.toUpperCase());
};

const resolvePageTitle = (pathname) => {
    const normalizedPath = normalizePathname(pathname);
    const matched = PAGE_TITLE_RULES.find((rule) =>
        matchPath({ path: rule.path, end: true }, normalizedPath)
    );
    return matched?.title || fallbackTitleFromPath(normalizedPath);
};

const HEAD_MANAGED_ROUTE_RULES = [
    '/',
    '/industries',
    '/pricing',
    '/book-demo',
    '/about',
    '/why-us',
    '/blog',
    '/blog/future-of-tech-hiring',
    '/blog/cfo-case-for-ai-recruitment',
    '/blog/why-traditional-recruitment-is-failing',
];

const NOINDEX_ROUTE_RULES = [
    '/v1',
    '/v2',
    '/share/upload',
    '/unsubscribe',
    '/auth',
    '/auth/login',
    '/auth/password/forget',
    '/auth/register',
];

const ROUTE_DESCRIPTION_RULES = [
    {
        path: '/privacypolicy',
        description: 'Review the Hirex REC privacy policy and how the platform handles data, cookies, and user information.',
    },
    {
        path: '/termscondition',
        description: 'Review the terms and conditions that govern access to and use of Hirex REC.',
    },
    {
        path: '/unsubscribe',
        description: 'Manage your Hirex REC communication preferences.',
    },
    {
        path: '/auth',
        description: 'Sign in to access the Hirex REC hiring platform.',
    },
    {
        path: '/auth/login',
        description: 'Sign in to access the Hirex REC hiring platform.',
    },
    {
        path: '/auth/password/forget',
        description: 'Reset your Hirex REC password to regain access to your account.',
    },
    {
        path: '/auth/register',
        description: 'Create your Hirex REC account to access AI-powered hiring workflows.',
    },
    {
        path: '/share/upload',
        description: 'Upload candidate information to Hirex REC.',
    },
    {
        path: '/v1',
        description: 'Explore the original Hirex REC experience.',
    },
    {
        path: '/v2',
        description: 'Explore the Hirex REC product overview.',
    },
];

function RouteDocumentTitleManager() {
    const location = useLocation();

    useEffect(() => {
        const isHeadManagedRoute = HEAD_MANAGED_ROUTE_RULES.some((routePath) =>
            matchPath({ path: routePath, end: true }, normalizePathname(location.pathname))
        );
        if (isHeadManagedRoute) return;

        const pageTitle = resolvePageTitle(location.pathname);
        document.title = composeDocumentTitle(pageTitle);
    }, [location.pathname]);

    return null;
}

function RouteHeadManager() {
    const location = useLocation();
    const normalizedPath = normalizePathname(location.pathname);
    const isHeadManagedRoute = HEAD_MANAGED_ROUTE_RULES.some((routePath) =>
        matchPath({ path: routePath, end: true }, normalizedPath)
    );

    if (isHeadManagedRoute) return null;

    const title = composeDocumentTitle(resolvePageTitle(normalizedPath));
    const matchedDescriptionRule = ROUTE_DESCRIPTION_RULES.find((rule) =>
        matchPath({ path: rule.path, end: true }, normalizedPath)
    );
    const description = matchedDescriptionRule?.description
        || 'Hirex REC is an AI-powered hiring platform for recruitment automation, candidate screening, and faster hiring workflows.';
    const shouldNoIndex = NOINDEX_ROUTE_RULES.some((routePath) =>
        matchPath({ path: routePath, end: true }, normalizedPath)
    );
    const siteOrigin = typeof window !== 'undefined' && window.location?.origin
        ? window.location.origin
        : 'https://hirexit.ai';
    const canonicalUrl = new URL(normalizedPath === '/' ? '/' : normalizedPath, `${siteOrigin}/`).toString();

    // eslint-disable-next-line react-hooks/rules-of-hooks
    useHead({
        title,
        meta: [
            { key: 'description', name: 'description', content: description },
            { key: 'robots', name: 'robots', content: shouldNoIndex ? 'noindex,nofollow' : 'index,follow' },
            { key: 'og:type', property: 'og:type', content: 'website' },
            { key: 'og:title', property: 'og:title', content: title },
            { key: 'og:description', property: 'og:description', content: description },
            { key: 'og:url', property: 'og:url', content: canonicalUrl },
            { key: 'og:image', property: 'og:image', content: new URL('/static/logo.svg', `${siteOrigin}/`).toString() },
            { key: 'twitter:card', name: 'twitter:card', content: 'summary_large_image' },
            { key: 'twitter:title', name: 'twitter:title', content: title },
            { key: 'twitter:description', name: 'twitter:description', content: description },
            { key: 'twitter:image', name: 'twitter:image', content: new URL('/static/logo.svg', `${siteOrigin}/`).toString() },
        ],
        link: [
            { key: 'canonical', rel: 'canonical', href: canonicalUrl },
        ],
    });

    return null;
}

function RouteScrollManager() {
    const location = useLocation();

    useEffect(() => {
        if (location.hash) return;
        window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
    }, [location.pathname, location.search, location.hash]);

    return null;
}




const App = () => {
    const [uiState, setUiState] = useUiContextState();
    const [authState, setAuthState] = useAuthContextState();
    const isFetchingRef = useRef(false);

    useHead({
        meta: [
            { key: 'description', name: 'description', content: 'Hirex REC is an AI-powered hiring platform for recruitment automation, candidate screening, and faster hiring workflows.' },
            { key: 'og:title', property: 'og:title', content: 'Hirex REC | AI Hiring Platform' },
            { key: 'og:description', property: 'og:description', content: 'Automate recruitment, screen candidates intelligently, and improve hiring speed with Hirex REC.' },
            { key: 'viewport', name: 'viewport', content: 'width=device-width, initial-scale=1' },
        ]
    });

    const getDeviceThemeMode = React.useCallback(() => {
        // if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
        //     return 'light';
        // }
        // return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        return 'light';
    }, []);

    useEffect(() => {
        if (typeof window === 'undefined') return;

        const storedMode = localStorage.getItem('muiThemeMode');
        const hasStoredMode = storedMode === 'light' || storedMode === 'dark';
        const resolvedMode = hasStoredMode ? storedMode : getDeviceThemeMode();

        if (uiState?.muiThemeMode !== resolvedMode) {
            setUiState({ muiThemeMode: resolvedMode });
        }

        const media = typeof window.matchMedia === 'function'
            ? window.matchMedia('(prefers-color-scheme: dark)')
            : null;
        if (!media) return;

        const onDeviceThemeChange = () => {
            const savedMode = localStorage.getItem('muiThemeMode');
            if (savedMode === 'light' || savedMode === 'dark') return;
            // setUiState({ muiThemeMode: event.matches ? 'dark' : 'light' });
            setUiState({ muiThemeMode: 'light' });
        };

        // if (typeof media.addEventListener === 'function') {
        //     media.addEventListener('change', onDeviceThemeChange);
        //     return () => media.removeEventListener('change', onDeviceThemeChange);
        // }

        // media.addListener(onDeviceThemeChange);
        return () => media.removeListener(onDeviceThemeChange);
    }, [getDeviceThemeMode, setUiState, uiState?.muiThemeMode]);

    const muiTheme = useMemo(() => {
        // const mode = uiState?.muiThemeMode || getDeviceThemeMode();
        const mode = "light";
        return getTheme(mode);
    }, []);


    const storedToken = localStorage.getItem('token');
    const defaultJourneyRoute = getJourneyRouteForRole(
        resolveJourneyRoleFromUserRole(authState?.user?.role) || 'candidate',
    );

    useEffect(() => {
        const loadUser = async () => {

            try {

                setUiState({
                    loadingMsg: "Loading Authetication Data, Please wait..."
                });

                isFetchingRef.current = true;

                const data = await fetchData(`/api/auth/profile`);

                isFetchingRef.current = false;

                !data && localStorage.removeItem('token');

                data && setAuthState(prev => ({
                    ...prev,
                    user: data,
                    isAuthenticated: data && '_id' in data,
                    booleanSubmitEmail: data?.email,
                }));

            } catch (err) {
                console.log(
                    "Error in getting loading user: ", err
                );

                if (err.code === 401) {
                    localStorage.removeItem('token');
                }
            } finally {

                setUiState({
                    loadingMsg: null,
                });

            }
        };

        !authState?.user && !isFetchingRef.current && storedToken && loadUser();

    }, [authState?.user, setAuthState, setUiState, storedToken]);



    return (
        <ThemeProvider theme={muiTheme}>
            <CssBaseline />
            <Suspense fallback={<MUISpinner text='Loading page, Please wait...' />}>
                <Router>
                    <RouteDocumentTitleManager />
                    <RouteHeadManager />
                    <RouteScrollManager />
                    <Layout>
                        {uiState?.loadingMsg && <MUISpinner text={uiState?.loadingMsg} />}
                        <Routes>
                            <Route path='' element={
                                <RootLayout>
                                    <LandingPage />
                                </RootLayout>
                            } />
                            <Route path='/v1' element={<LegacyLandingPage />} />
                            <Route path='/v2' element={<LandingPageV2 />} />
                            <Route path='/industries' element={<RootLayout><MarketingPage page={marketingPages.industries} /></RootLayout>} />
                            <Route path='/pricing' element={<RootLayout><PricingPage /></RootLayout>} />
                            <Route path='/book-demo' element={<RootLayout><BookDemoPage /></RootLayout>} />
                            <Route path='/about' element={<RootLayout><MarketingPage page={marketingPages.about} /></RootLayout>} />
                            <Route path='/why-us' element={<RootLayout><MarketingPage page={marketingPages.whyUs} /></RootLayout>} />
                            <Route path='/blog' element={<RootLayout><BlogIndexPage /></RootLayout>} />
                            <Route path='/blog/future-of-tech-hiring' element={<RootLayout><BlogArticlePage article={blogPosts.futureOfTechHiring} /></RootLayout>} />
                            <Route path='/blog/cfo-case-for-ai-recruitment' element={<RootLayout><BlogArticlePage article={blogPosts.cfoCaseForAiRecruitment} /></RootLayout>} />
                            <Route path='/blog/why-traditional-recruitment-is-failing' element={<RootLayout><BlogArticlePage article={blogPosts.whyTraditionalRecruitmentIsFailing} /></RootLayout>} />
                            <Route path='/share/upload/' element={<ShareCvUpload />} />

                            <Route path='/journey-map/' element={<Navigate replace to={defaultJourneyRoute} />} />
                            <Route path='/journey-map/client-admin/' element={<JourneyMapPage roleKey='client_admin' />} />
                            <Route path='/journey-map/recruiter/' element={<JourneyMapPage roleKey='recruiter' />} />
                            <Route path='/journey-map/interviewer/' element={<JourneyMapPage roleKey='interviewer' />} />
                            <Route path='/journey-map/candidate/' element={<JourneyMapPage roleKey='candidate' />} />

                            <Route path='/privacypolicy' element={<PrivacyPolicy />} />
                            <Route path='/termscondition' element={<TermsConditions />} />
                            <Route path='/unsubscribe' element={<EmailUnsubscribe />} />
                            <Route path='' element={authState?.isAuthenticated ? <> <Outlet /> </> : <LoginForm />}>
                                {/* <Route index element={<LandingPage />} /> */}
                                <Route path='/loader/' element={<MUISpinner />} />
                                <Route path='/webrtcai/' element={<WebRTC />} />
                                <Route path='/interview-verification/' element={<InterviewVerification />} />
                                <Route path='/profile/' element={<Profile />} />
                                <Route
                                    path='/settings/'
                                    element={
                                        authState?.user?.role === 'ultra_admin'
                                            ? <ServicesList />
                                            : ['client_admin', 'manager'].includes(authState?.user?.role)
                                                ? <ClientAdminSettings />
                                                : <Navigate to="/dashboard/" replace />
                                    }
                                />
                                <Route
                                    path='/settings/new/'
                                    element={
                                        authState?.user?.role === 'ultra_admin'
                                            ? <NewService />
                                            : <Navigate to="/dashboard/" replace />
                                    }
                                />
                                <Route
                                    path='/recruiters/'
                                    element={
                                        ['client_admin', 'manager'].includes(authState?.user?.role)
                                            ? <RecruitersList />
                                            : <Navigate to="/dashboard/" replace />
                                    }
                                />
                                <Route
                                    path='/recruiters/new/'
                                    element={
                                        ['client_admin', 'manager'].includes(authState?.user?.role)
                                            ? <NewRecruiter />
                                            : <Navigate to="/dashboard/" replace />
                                    }
                                />
                                <Route
                                    path='/recruiters/:id/'
                                    element={
                                        ['client_admin', 'manager'].includes(authState?.user?.role)
                                            ? <RecruiterDetail />
                                            : <Navigate to="/dashboard/" replace />
                                    }
                                />
                                <Route
                                    path='/managers/'
                                    element={
                                        ['client_admin', 'manager'].includes(authState?.user?.role)
                                            ? <ManagersList />
                                            : <Navigate to="/dashboard/" replace />
                                    }
                                />
                                <Route
                                    path='/managers/new/'
                                    element={
                                        authState?.user?.role === 'client_admin'
                                            ? <NewManager />
                                            : <Navigate to="/dashboard/" replace />
                                    }
                                />
                                <Route
                                    path='/managers/:id/'
                                    element={
                                        ['client_admin', 'manager'].includes(authState?.user?.role)
                                            ? <ManagerDetail />
                                            : <Navigate to="/dashboard/" replace />
                                    }
                                />
                                <Route
                                    path='/admins/'
                                    element={
                                        authState?.user?.role === 'ultra_admin'
                                            ? <ClientAdminsList />
                                            : <Navigate to="/dashboard/" replace />
                                    }
                                />
                                <Route
                                    path='/admins/new/'
                                    element={
                                        authState?.user?.role === 'ultra_admin'
                                            ? <NewClientAdmin />
                                            : <Navigate to="/dashboard/" replace />
                                    }
                                />
                                <Route
                                    path='/admins/:id'
                                    element={
                                        authState?.user?.role === 'ultra_admin'
                                            ? <ClientAdminDetail />
                                            : <Navigate to="/dashboard/" replace />
                                    }
                                />


                                <Route path='/archive-bin/' element={<ArchivedBin />} />
                                <Route
                                    path='/templates/'
                                    element={
                                        ['client_admin', 'manager'].includes(authState?.user?.role)
                                            ? (
                                                <ClientAdminSettings
                                                    forcedTab='emailTemplates'
                                                    hideTabs
                                                    pageTitle='Templates'
                                                    pageSubtitle='(Email Automation)'
                                                    pageDescription='Manage your email templates from a dedicated page.'
                                                />
                                            )
                                            : <Navigate to="/dashboard/" replace />
                                    }
                                />

                                {['ultra_admin', 'client_admin', 'manager', 'recruiter'].includes(authState?.user?.role) && <>
                                    <Route path='/dashboard/' element={<Dashboard />} />
                                    <Route path='/dashboard/recruiter/:id/' element={<Dashboard key={"Recruiter Dashboard"} />} />
                                    <Route
                                        path='/hiring-setup/'
                                        element={
                                            <Navigate
                                                to={
                                                    authState?.user?.role === 'client_admin'
                                                        ? "/managers/"
                                                        : "/companies/"
                                                }
                                                replace
                                            />
                                        }
                                    />
                                    <Route
                                        path='/companies/'
                                        element={
                                            <CompaniesList />
                                        }
                                    />
                                    <Route
                                        path='/companies/new/'
                                        element={
                                            <NewCompany />
                                        }
                                    />
                                    <Route
                                        path='/companies/:id'
                                        element={
                                            <CompanyDetail />
                                        }
                                    />

                                    <Route
                                        path='/jobs/'
                                        element={
                                            <JobsList />
                                        }
                                    />
                                    <Route
                                        path='/jobs/new/'
                                        element={
                                            <NewJob />
                                        }
                                    />
                                    <Route
                                        path='/jobs/edit/:id/'
                                        element={
                                            <NewJob />
                                        }
                                    />
                                    <Route
                                        path='/jobs/:id/'
                                        element={
                                            <JobDetail />
                                        }
                                    />

                                    <Route path='/hiring-pipeline/' element={<HiringPipeline />} />
                                    <Route path='/hiring-pipeline/:id/' element={<HiringPipeline />} />

                                    <Route path='/candidates/' element={<CandidatesList />} />
                                    <Route path='/candidates/new/' element={<NewCandidates />} />
                                    <Route path='/candidates/edit/:id' element={<EditCandidate />} />
                                    <Route path='/candidates/:id/' element={<CandidateDetail />} />
                                    <Route path='/ats/' element={<CandidateATSList />} />
                                </>}

                                <Route path='/ai/tools/' element={<AITools />} />

                                <Route path='/booleansearch/' element={<BooleanSearch />} />

                                {['ultra_admin', 'client_admin', 'manager'].includes(authState?.user?.role) && <>
                                    <Route
                                        path='/stages/new/'
                                        element={
                                            <NewStage />
                                        }
                                    />
                                    <Route
                                        path='/stages/'
                                        element={
                                            <StagesList />
                                        }
                                    />
                                    <Route
                                        path='/stages/:id/'
                                        element={
                                            <StageDetail />
                                        }
                                    />
                                </>}

                                <Route path='/hero/' element={<HeroSection />} />
                                <Route path='/muinotification/' element={<MuiNotification />} />
                                <Route path='/notifications/' element={<NotificationsPage />} />
                                <Route path='/notifications/:id/' element={<NotificationDetailPage />} />


                                {['ultra_admin', 'client_admin', 'manager', 'recruiter'].includes(authState?.user?.role) && <>
                                    <Route
                                        path="/interviewers"
                                        element={
                                            <InterviewersList />
                                        }
                                    />
                                    <Route
                                        path="/interviewers/new"
                                        element={
                                            <NewInterviewer />
                                        }
                                    />
                                    <Route
                                        path="/interviewers/:id"
                                        element={
                                            <InterviewerDetail />
                                        }
                                    />

                                    <Route path="/interviews" element={<InterviewsList />} />
                                    <Route path="/interviews/:id" element={<InterviewDetail />} />
                                    <Route path="/ai-call-logs" element={<InboundCallLogs />} />
                                    <Route path="/hume-voice-preview" element={<HumeAI_VoicePreview />} />
                                    <Route path="/credits/used/" element={<UsedCreditDetail />} />
                                    <Route path="/video-interview-logs" element={<VideoInterviewLogs />} />
                                </>}

                                <Route path='/simulation/ai/call/' element={(['ultra_admin', 'client_admin', 'manager'].includes(authState?.user?.role) || !authState?.isAuthenticated) && ["applycup", "aiselektv2", "aiselecktdev", "aiselekt", "ai_selekt", "nikhilbatraaiselekt", "applycupdevelopment"].includes((authState?.user?.dbName || "").toLowerCase()) ? <FakePlivoCall /> : <LoginForm />} />

                                {/* Routes accessible to interviewers */}
                                {authState?.user?.role === 'interviewer' && <>
                                    <Route path="/my-interviews" element={<MyInterviewsList />} />
                                    <Route path="/interviews/:id" element={<InterviewDetail />} />
                                </>}

                                <Route path='/interviews/schedule/' element={<InterviewScheduler />} />
                                {/* <Route path='/ai/agent/assistant/' element={<AiAgentAssistant />} /> */}
                                <Route path='password/forget/' element={<ForgetOrChangePasswordForm funcFor="Change" />} />

                            </Route>
                            <Route path='/boolean/search/' element={<BooleanSearch />} />

                            <Route path='auth/'>
                                <Route index element={<LoginForm />} />
                                <Route path='login/' element={<LoginForm />} />
                                <Route path='password/forget/' element={<ForgetOrChangePasswordForm funcFor="Forgot" />} />
                                {(!(window?.location?.origin?.includes('aiselekt.com') || window?.location?.origin?.includes('hirexit.ai'))) && <Route path='register/' element={<RegisterForm onSubmitSuccess={(navigate = () => { }) => navigate('/auth/login/')} />} />}
                            </Route>
                            <Route path='*' element={<LoginForm />} />
                        </Routes>
                    </Layout>
                    <CookieConsentBanner />
                </Router>
            </Suspense>
        </ThemeProvider>
    );
};

export default App;

