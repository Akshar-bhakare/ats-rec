import { Box } from "@mui/material";

import ContactUs from "./ContactUs";
import Hero from "./HeroSection";
import FeaturesSection from "./FeaturesSection";
import WorkflowSection from "./WorkflowSection";
import FAQSection from "./FAQSection";
import VideoSection from "./VideoSection";


const LandingPage = () => (
    <Box>
        <Hero />
        <FeaturesSection />
        <WorkflowSection />
        {/* <HowItWorks /> */}
        <ContactUs />
        {/* <AboutUs /> */}
        <VideoSection />
        <FAQSection />

        {/* <AssistantWidget /> */}

    </Box>
);

export default LandingPage;
