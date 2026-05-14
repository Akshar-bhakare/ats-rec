import InfoIcon from "@mui/icons-material/Info";
import LightbulbIcon from "@mui/icons-material/Lightbulb";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";

import {
    Box,
    Card,
    CardContent,
    Chip,
    Divider,
    Stack,
    Typography,
    IconButton,
} from "@mui/material";

import { alpha, useTheme } from "@mui/material/styles";
import MUICenterLayout from "../MUI/commonUI/MUICenterLayout";
import MUIModal from "../MUI/commonUI/MUIModal.jsx";

import BooleanBuilder from "./BooleanBuilder.jsx";
import DemoLeadForm from "../LeadCapturing/DemoLeadForm.jsx";

import { useAuthContextState } from "../../contexts/AuthContext";
import StarRatingField from "../MUI/commonUI/MUIStarRatingField.jsx";

import { useEffect, useMemo, useState } from "react";
import MUIAlert from "../MUI/commonUI/MUIAlert.jsx";
import { fetchData, performDeploySafeFetch } from "../../AppUtils/dataAPI.js";
import { useUiContextState } from "../../contexts/UiContext";

const booleanOperators = ["AND", "OR", "NOT"];
const exampleCombos = [
    {
        label: "Focused search",
        query: '"Product Manager" AND fintech AND "Principal Product Manager"',
    },
    {
        label: "Exclude noise",
        query: '("Software Engineer" OR "Developer") NOT junior NOT intern',
    },
];

const howToSteps = [
    "Start with the core skill you need.",
    "Add non-negotiable skills.",
    "For searching specific tools or alternatives mention e.g. Monitoring tools, Cloud, Scheduling tools, etc.",
];

export default function BooleanSearch() {
    const theme = useTheme();
    const [authState, setAuthState] = useAuthContextState();
    const [, setUiState] = useUiContextState();

    const [booleanSearchOnAlert, setBooleanSearchOnAlert] = useState({});
    const [onSkillChange, setOnSkillChange] = useState([]);
    const [aiResponseStr, setAiResponseStr] = useState();

    const [openWhatModal, setOpenWhatModal] = useState(false);
    const [openHowModal, setOpenHowModal] = useState(false);

    const isDark = theme.palette.mode === "dark";

    const backdropGradient = useMemo(
        () =>
            isDark
                ? "linear-gradient(135deg, #0a0f24, #141a33)"
                : "linear-gradient(135deg, #e8efff, #f2f6ff)",
        [isDark]
    );

    const chipBorderColor = alpha(theme.palette.primary.main, 0.35);
    const sampleBackground = alpha(
        isDark ? "#312e81" : "#e0e7ff",
        isDark ? 0.4 : 0.6
    );
    const builderBackground = alpha(
        isDark ? "#111827" : "#f8fafc",
        isDark ? 0.5 : 0.9
    );

    useEffect(() => {
        window.location.hostname === "localhost" && console.log(
            "\n gState?.booleanSubmitEmail: ", authState?.booleanSubmitEmail,
        );

        if (authState?.isAuthenticated && authState?.user?.email && !authState?.booleanSubmitEmail) {
            setAuthState({ booleanSubmitEmail: authState?.user?.email });

        } else if (!authState?.booleanSubmitEmail) {
            setAuthState({ booleanSubmitEmail: "Start of page" });
        }

        // eslint-disable-next-line
    }, [authState?.user?.email]);

    const handleAlertClose = (_, reason) => {
        if (reason === "clickaway") return;
        setBooleanSearchOnAlert((a) => ({ ...a, open: false }));
    };

    return (
        <>
            <MUICenterLayout
                sx={{
                    py: { xs: 4, md: 7 },
                    px: { xs: 2, sm: 4 },
                    background: backdropGradient,
                }}
            >
                <Box
                    sx={{
                        maxWidth: 820,
                        mx: "auto",
                        position: "relative",
                        width: "100%",
                    }}
                >
                    {/* Floating Buttons */}
                    <Box
                        sx={{
                            position: "absolute",
                            top: -5,
                            right: -25,
                            display: "flex",
                            gap: 1.5,
                            zIndex: 1200,
                        }}
                    >
                        <IconButton
                            onClick={() => setOpenWhatModal(true)}
                            sx={{
                                width: 48,
                                height: 48,
                                borderRadius: "50%",
                                background: alpha(
                                    theme.palette.primary.main,
                                    0.25
                                ),
                                backdropFilter: "blur(10px)",
                                boxShadow: `0 4px 14px ${alpha(
                                    theme.palette.common.black,
                                    0.14
                                )}`,
                                transition: "all 0.25s ease",
                                "&:hover": {
                                    transform: "scale(1.12)",
                                    background: alpha(
                                        theme.palette.primary.main,
                                        0.45
                                    ),
                                },
                            }}
                        >
                            <InfoIcon sx={{ fontSize: 26 }} />
                        </IconButton>

                        <IconButton
                            onClick={() => setOpenHowModal(true)}
                            sx={{
                                width: 48,
                                height: 48,
                                borderRadius: "50%",
                                background: alpha(
                                    theme.palette.secondary.main,
                                    0.28
                                ),
                                backdropFilter: "blur(10px)",
                                boxShadow: `0 4px 14px ${alpha(
                                    theme.palette.secondary.main,
                                    0.45
                                )}`,
                                transition: "all 0.25s ease",
                                "&:hover": {
                                    transform: "scale(1.12)",
                                    background: alpha(
                                        theme.palette.secondary.main,
                                        0.5
                                    ),
                                },
                            }}
                        >
                            <LightbulbIcon sx={{ fontSize: 26 }} />
                        </IconButton>
                    </Box>

                    {/* Main Card */}
                    <Card
                        elevation={6}
                        sx={{
                            borderRadius: 4,
                            overflow: "hidden",
                            background: isDark
                                ? "linear-gradient(160deg, rgba(26,31,58,0.96), rgba(15,23,42,0.92))"
                                : "linear-gradient(160deg, rgba(255,255,255,0.96), rgba(240,244,255,0.92))",
                            p: { xs: 3, sm: 4, md: 5 },
                        }}
                    >
                        <CardContent>
                            {/* If NO email → show DemoLeadForm */}
                            {!authState?.booleanSubmitEmail ? (
                                <DemoLeadForm
                                    demoOf={"AI Boolean Search String"}
                                    onSuccess={(usrEmail) =>
                                        setAuthState({
                                            booleanSubmitEmail: usrEmail,
                                        })
                                    }
                                />
                            ) : (
                                <>
                                    <Stack spacing={4}>
                                        <Box textAlign="center">
                                            <Typography
                                                variant="h4"
                                                fontWeight={700}
                                            >
                                                Boolean Search Builder
                                            </Typography>
                                        </Box>

                                        <Stack
                                            direction="row"
                                            spacing={1}
                                            justifyContent="center"
                                            flexWrap="wrap"
                                        >
                                            {booleanOperators.map((op) => (
                                                <Chip
                                                    key={op}
                                                    label={op}
                                                    sx={{
                                                        fontWeight: 600,
                                                        borderRadius: 2,
                                                        border: "none",
                                                        px: 1.5,
                                                        backgroundColor:
                                                            alpha(
                                                                chipBorderColor,
                                                                0.15
                                                            ),
                                                    }}
                                                />
                                            ))}
                                        </Stack>

                                        <Box
                                            sx={{
                                                backgroundColor:
                                                    builderBackground,
                                                borderRadius: 3,
                                                p: 3,
                                            }}
                                        >
                                            <Typography
                                                variant="subtitle2"
                                                gutterBottom
                                            >
                                                Build your perfect query
                                            </Typography>

                                            <BooleanBuilder
                                                onAlert={
                                                    setBooleanSearchOnAlert
                                                }
                                                skills={onSkillChange}
                                                onChange={setOnSkillChange}
                                                onBooleanString={
                                                    setAiResponseStr
                                                }
                                                responseQueryArr={
                                                    aiResponseStr
                                                }
                                                required={true}
                                            />

                                            {aiResponseStr && (
                                                <Card
                                                    sx={{
                                                        mt: 2,
                                                        p: 1,
                                                        borderRadius: 2,
                                                    }}
                                                >
                                                    <CardContent>
                                                        <Typography
                                                            variant="body2"
                                                        >
                                                            {aiResponseStr}
                                                        </Typography>
                                                    </CardContent>
                                                </Card>
                                            )}

                                            <StarRatingField
                                                label={
                                                    "Please rate, to make us better"
                                                }
                                                onChangeExtented={(newVal) => {
                                                    if (
                                                        authState?.booleanSubmitEmail &&
                                                        aiResponseStr &&
                                                        (onSkillChange || [])
                                                            .length > 0
                                                    ) {
                                                        performDeploySafeFetch(
                                                            "Submit Feedback",
                                                            () => fetchData(
                                                                "/api/jobs/boolean/search/feedback/",
                                                                {
                                                                    method:
                                                                        "POST",
                                                                    body: JSON.stringify(
                                                                        {
                                                                            userEmail:
                                                                                authState
                                                                                    ?.booleanSubmitEmail,
                                                                            demoOf: "AI Boolean Search String",
                                                                            skills: onSkillChange,
                                                                            aiResponse:
                                                                                aiResponseStr,
                                                                            feedbackNum:
                                                                                newVal,
                                                                        }
                                                                    ),
                                                                }
                                                            ),
                                                            setUiState,
                                                            "Saving Feedback"
                                                        )
                                                            .then((res) => {
                                                                setBooleanSearchOnAlert(
                                                                    {
                                                                        severity:
                                                                            res?.success
                                                                                ? "success"
                                                                                : "error",
                                                                        message:
                                                                            res?.success
                                                                                ? "Feedback saved successfully."
                                                                                : "Failed to save feedback.",
                                                                        open: true,
                                                                    }
                                                                );
                                                            })
                                                            .catch(() =>
                                                                setBooleanSearchOnAlert(
                                                                    {
                                                                        severity:
                                                                            "error",
                                                                        message:
                                                                            "Error saving feedback.",
                                                                        open: true,
                                                                    }
                                                                )
                                                            )
                                                            .finally(() => {
                                                                setUiState({ loadingMsg: null });
                                                            });
                                                    }
                                                }}
                                            />
                                        </Box>

                                        <Stack spacing={2}>
                                            {exampleCombos.map(
                                                ({ label, query }) => (
                                                    <Box
                                                        key={label}
                                                        sx={{
                                                            backgroundColor:
                                                                sampleBackground,
                                                            p: 2.5,
                                                            borderRadius: 4,
                                                            border: `1px solid ${alpha(
                                                                theme.palette
                                                                    .primary
                                                                    .main,
                                                                0.25
                                                            )}`,
                                                        }}
                                                    >
                                                        <Typography
                                                            variant="overline"
                                                            sx={{
                                                                fontWeight: 700,
                                                                letterSpacing: 1,
                                                                opacity: 0.85,
                                                            }}
                                                        >
                                                            {label}
                                                        </Typography>

                                                        <Typography
                                                            variant="body2"
                                                            sx={{
                                                                mt: 1,
                                                                p: 1.3,
                                                                borderRadius: 2,
                                                                backgroundColor:
                                                                    alpha(
                                                                        isDark
                                                                            ? "#1e1b4b"
                                                                            : "#ffffff",
                                                                        0.65
                                                                    ),
                                                                fontFamily:
                                                                    "ui-monospace, monospace",
                                                                border: `1px solid ${alpha(
                                                                    "#000",
                                                                    0.15
                                                                )}`,
                                                            }}
                                                        >
                                                            {query}
                                                        </Typography>
                                                    </Box>
                                                )
                                            )}
                                        </Stack>
                                    </Stack>
                                </>
                            )}
                        </CardContent>
                    </Card>
                </Box>

                <MUIAlert
                    open={booleanSearchOnAlert?.open}
                    message={booleanSearchOnAlert?.message}
                    severity={
                        booleanSearchOnAlert?.severity || "error"
                    }
                    onClose={handleAlertClose}
                />
            </MUICenterLayout>

            {/* WHAT MODAL */}
            <MUIModal
                open={openWhatModal}
                onClose={() => setOpenWhatModal(false)}
                contentSx={{ maxWidth: 500 }}
            >
                <Stack spacing={2}>
                    <Box
                        display="flex"
                        justifyContent="space-between"
                        alignItems="center"
                    >
                        <Typography variant="h6" fontWeight={600}>
                            What is Boolean Search?
                        </Typography>
                        <IconButton
                            onClick={() => setOpenWhatModal(false)}
                        >
                            <CloseRoundedIcon />
                        </IconButton>
                    </Box>

                    <Typography variant="body2">
                        Boolean search is a logic-based method of
                        combining keywords so you can surface profiles
                        that match exactly what you need.
                    </Typography>

                    <Divider />

                    <Typography variant="subtitle2">
                        Quick principles
                    </Typography>
                    <Typography variant="body2">
                        <b>AND</b> requires every connected word.
                    </Typography>
                    <Typography variant="body2">
                        <b>OR</b> broadens the search.
                    </Typography>
                    <Typography variant="body2">
                        <b>NOT</b> removes unwanted terms.
                    </Typography>
                </Stack>
            </MUIModal>

            {/* HOW MODAL */}
            <MUIModal
                open={openHowModal}
                onClose={() => setOpenHowModal(false)}
                contentSx={{ maxWidth: 550 }}
            >
                <Stack spacing={2}>
                    <Box
                        display="flex"
                        justifyContent="space-between"
                        alignItems="center"
                    >
                        <Typography variant="h6" fontWeight={600}>
                            How to Use
                        </Typography>
                        <IconButton
                            onClick={() => setOpenHowModal(false)}
                        >
                            <CloseRoundedIcon />
                        </IconButton>
                    </Box>

                    <Stack spacing={1.5}>
                        {howToSteps.map((step, i) => (
                            <Typography key={i} variant="body2">
                                {i + 1}. {step}
                            </Typography>
                        ))}
                    </Stack>

                    <Divider />

                    <Typography variant="caption">
                        <b>Quick Guide</b>
                        <ol style={{ marginTop: 8 }}>
                            <li>java OR .net AND react OR angular</li>
                            <li>python OR node AND cloud</li>
                            <li>sales OR business AND manager OR executive</li>
                        </ol>
                    </Typography>
                </Stack>
            </MUIModal>
        </>
    );
}
