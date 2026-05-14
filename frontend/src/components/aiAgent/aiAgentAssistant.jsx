/* eslint-disable no-empty */
/* eslint-disable no-unused-vars */
import { useState, useEffect, useRef } from "react";
import {
    Box,
    Paper,
    TextField,
    Button,
    Typography,
    List,
    ListItem,
    Container,
    Avatar,
    Badge,
    Chip,
    CircularProgress,
    Divider,
    IconButton,
    Stack,
} from "@mui/material";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { useAIAgentContextState } from "../../contexts/AIAgentContext";
import { useAuthContextState } from "../../contexts/AuthContext";
import { useCandidateContextState } from "../../contexts/CandidateContext";
import { useCompanyContextState } from "../../contexts/CompanyContext";
import { useJobContextState } from "../../contexts/JobContext";
import { fetchData, performDeploySafeFetch } from "../../AppUtils/dataAPI";
import MUIButton from "../MUI/commonUI/MUIButton";

import { styled, keyframes, useTheme, alpha } from "@mui/material/styles";
import { AnimatePresence, motion } from "framer-motion";

import ChatBubbleOutlineRoundedIcon from "@mui/icons-material/ChatBubbleOutlineRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import SendRoundedIcon from "@mui/icons-material/SendRounded";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import MicRoundedIcon from "@mui/icons-material/MicRounded";
import StopRoundedIcon from "@mui/icons-material/StopRounded";
import FullscreenRoundedIcon from "@mui/icons-material/FullscreenRounded";
import FullscreenExitRoundedIcon from "@mui/icons-material/FullscreenExitRounded";
import { useNavigate } from "react-router-dom";

// Lottie + Layla assets
// import Lottie from "lottie-react";
// import laylaAvatar from "../../assets/layla-avatar.json";
import laylaAvatar from "../../assets/layla-avatar.gif";
import assistantbot from "../../assets/assistantbot.json";
import aiBotGif from "../../assets/AI bot.gif";
import laylaWaveAnimation from "../../assets/layla-wave.gif";

const float = keyframes`
  0% { transform: translateY(0px) }
  50% { transform: translateY(-8px) }
  100% { transform: translateY(0px) }
`;

const FabShell = styled(Box)(({ theme }) => ({
    position: "fixed",
    right: 24,
    bottom: 24,
    zIndex: theme.zIndex.drawer + 2,
}));

const FabButton = styled(IconButton)(({ theme }) => ({
    width: 68,
    height: 68,
    borderRadius: "50%",
    color: theme.palette.text.primary,
    background: `radial-gradient(circle at 28% 22%, ${alpha(
        theme.palette.common.white,
        theme.palette.mode === "dark" ? 0.18 : 0.92
    )} 0%, ${alpha(
        theme.palette.grey[300],
        theme.palette.mode === "dark" ? 0.34 : 0.82
    )} 62%, ${alpha(theme.palette.grey[500], theme.palette.mode === "dark" ? 0.26 : 0.52)} 100%)`,
    border: `1px solid ${alpha(
        theme.palette.grey[500],
        theme.palette.mode === "dark" ? 0.5 : 0.34
    )}`,
    boxShadow:
        theme.palette.mode === "dark"
            ? `0 18px 36px ${alpha(theme.palette.common.black, 0.55)}`
            : `0 14px 28px ${alpha(theme.palette.common.black, 0.16)}`,
    animation: `${float} 12s ease-in-out infinite`,
    "&:hover": {
        background: `radial-gradient(circle at 28% 22%, ${alpha(
            theme.palette.common.white,
            theme.palette.mode === "dark" ? 0.22 : 0.95
        )} 0%, ${alpha(
            theme.palette.grey[300],
            theme.palette.mode === "dark" ? 0.38 : 0.86
        )} 62%, ${alpha(theme.palette.grey[500], theme.palette.mode === "dark" ? 0.3 : 0.56)} 100%)`,
        borderColor: alpha(
            theme.palette.grey[600],
            theme.palette.mode === "dark" ? 0.62 : 0.42
        ),
    },
    padding: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
}));

const GlowOrb = styled("div")({
    position: "absolute",
    pointerEvents: "none",
    borderRadius: "50%",
    filter: "blur(18px)",
});

const Panel = styled(Paper)(({ theme }) => {
    const top = alpha(theme.palette.primary.main, 0.1);
    const mid = alpha(theme.palette.background.paper, 0.92);
    const bot = alpha(theme.palette.background.paper, 0.98);
    return {
        position: "fixed",
        right: 24,
        bottom: 120, // moved up so it doesn't sit on top of FAB
        width: "min(420px, calc(100vw - 32px))",
        maxWidth: "min(640px, calc(100vw - 32px))",
        height: 640,
        minWidth: 320,
        minHeight: 420,
        maxHeight: "calc(100vh - 120px)",
        borderRadius: 10,
        overflow: "hidden",
        resize: "both",
        display: "flex",
        flexDirection: "column",
        background: `linear-gradient(180deg, ${top} 0%, ${mid} 28%, ${bot} 100%)`,
        border: `1px solid ${alpha(theme.palette.divider, 0.6)}`,
        boxShadow:
            theme.palette.mode === "dark"
                ? `0 30px 70px ${alpha(theme.palette.common.black, 0.65)}`
                : `0 30px 70px ${alpha(theme.palette.common.black, 0.22)}`,
        backdropFilter: "blur(10px)",
        zIndex: theme.zIndex.drawer + 1,
        "@media (max-width: 600px)": {
            width: "calc(100vw - 32px)",
            minWidth: "calc(100vw - 32px)",
            resize: "none",
        },
    };
});

const Header = styled(Box)(({ theme }) => ({
    padding: "14px 16px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    background: `linear-gradient(90deg, ${alpha(
        theme.palette.primary.main,
        0.14
    )} 0%, ${alpha(theme.palette.primary.light, 0.16)} 100%)`,
    borderBottom: `1px solid ${alpha(theme.palette.divider, 0.6)}`,
}));

const ScrollArea = styled(Box)({
    flex: 1,
    overflowY: "auto",
    padding: "14px 16px",
});

export function MessageBubble({ text }) {
    return (
        <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
                a: ({ node, ...props }) => (
                    <a {...props} target="_blank" rel="noopener noreferrer" />
                ),
                p: ({ node, ...props }) => (
                    <Typography
                        component="p"
                        sx={{ fontSize: "0.9rem", lineHeight: 1.6, mb: 0.4 }}
                        {...props}
                    />
                ),
            }}
        >
            {text}
        </ReactMarkdown>
    );
}

const Bubble = ({ role, children }) => {
    const theme = useTheme();
    const isDark = theme.palette.mode === "dark";
    const assistantStyles = {
        bgcolor: alpha(theme.palette.background.paper, 0.96),
        border: `1px solid ${alpha(theme.palette.divider, 0.6)}`,
        boxShadow: isDark
            ? `0 10px 24px ${alpha(theme.palette.common.black, 0.55)}`
            : `0 10px 24px ${alpha(theme.palette.common.black, 0.08)}`,
        color: theme.palette.text.primary,
        backgroundImage: `radial-gradient(circle at 0% 0%, ${alpha(
            theme.palette.primary.main,
            0.06
        )}, transparent 45%)`,
    };
    const userStyles = {
        bgcolor: "transparent",
        color: theme.palette.common.white,
        backgroundImage: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
        boxShadow: isDark
            ? `0 14px 28px ${alpha(theme.palette.common.black, 0.55)}`
            : `0 14px 28px ${alpha(theme.palette.common.black, 0.2)}`,
    };
    return (
        <Stack alignItems={role === "AI" ? "flex-start" : "flex-end"} sx={{ mb: 1.4 }}>
            <Box
                component={motion.div}
                initial={{ opacity: 0, y: 10, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.18 }}
                sx={{
                    px: 2,
                    py: 1.3,
                    borderRadius: 2.4,
                    maxWidth: "95%",
                    fontSize: "0.9rem",
                    lineHeight: 1.5,
                    ...(role === "AI" ? assistantStyles : userStyles),
                }}
            >
                <MessageBubble text={children} />
            </Box>
        </Stack>
    );
};

export default function AiAgentAssistant() {
    const [authState] = useAuthContextState();
    const [aiAgentState, setAIAgentState] = useAIAgentContextState();
    const [candidateState, setCandidateState] = useCandidateContextState();
    const [companyState, setCompanyState] = useCompanyContextState();
    const [, setJobState] = useJobContextState();
    const navigate = useNavigate();

    const gState = {
        user: authState?.user,
        isAIAgentAssistantChatOpen: aiAgentState?.isAIAgentAssistantChatOpen,
        companyInitialValuesDict: companyState?.companyInitialValuesDict,
        candidateInitialValuesDict: candidateState?.candidateInitialValuesDict,
    };

    const [ws, setWs] = useState(null);
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState("");
    const setIsAIAgentAssistantChatOpen = (val) => {
        setAIAgentState((prev) => ({
            isAIAgentAssistantChatOpen:
                typeof val === "function"
                    ? val(prev?.isAIAgentAssistantChatOpen)
                    : val,
        }));
    };
    const [loading, setLoading] = useState(false);
    const [isFullPageAssistant, setIsFullPageAssistant] = useState(
        window?.location?.pathname?.toLowerCase()?.includes("/ai/agent/assistant")
    );
    const [isWidgetMaximized, setIsWidgetMaximized] = useState(false);

    // greeting popup for FAB
    const [showFabGreeting, setShowFabGreeting] = useState(true);

    // unread counter
    const [unreadCount, setUnreadCount] = useState(0);
    const panelOpenRef = useRef(!!gState?.isAIAgentAssistantChatOpen);

    // voice state
    const [isListening, setIsListening] = useState(false);
    const recognitionRef = useRef(null);

    // stop-related flags: ignore AI messages after Stop until user sends again
    const [ignoreAssistantMessages, setIgnoreAssistantMessages] = useState(false);
    const ignoreAssistantMessagesRef = useRef(false);

    useEffect(() => {
        ignoreAssistantMessagesRef.current = ignoreAssistantMessages;
    }, [ignoreAssistantMessages]);

    useEffect(() => {
        panelOpenRef.current = !!gState?.isAIAgentAssistantChatOpen;
        if (panelOpenRef.current) {
            if (unreadCount !== 0) console.log("[Chat] Reset unread to 0 on open");
            setUnreadCount(0);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [gState?.isAIAgentAssistantChatOpen]);

    const theme = useTheme();
    const isDark = theme.palette.mode === "dark";
    const scrollRef = useRef(null);

    const fileInputRef = useRef(null);

    const ACCEPTED_FILE_TYPES = [
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ];

    const [attachments, setAttachments] = useState([]);

    const establishConnection = async () => {
        if (!ws) {
            try {
                await performDeploySafeFetch(
                    "Create Chat Session",
                    async () => await fetchData("/api/ai/agent/assistant/create/chat/", {
                        method: "POST",
                    }),
                    null,
                    "Connecting to Assistant"
                );

                const wsUrl =
                    (window.location.protocol === "https:" ? "wss://" : "ws://") +
                    (window.location.host?.includes("localhost")
                        ? "localhost:8080"
                        : window.location.host) +
                    "/api/ai/agent/assistant/" +
                    gState?.user?._id +
                    "/";

                const socket = new WebSocket(wsUrl);
                setWs(socket);

                socket.onopen = () => {
                    console.log("[Ai Assistant] WS Connected");
                };

                socket.onmessage = (event) => {
                    const res = JSON.parse(event.data);

                    switch (res?.event) {
                        case "message": {
                            if (ignoreAssistantMessagesRef.current) {
                                setLoading(false);
                                return;
                            }
                            setLoading(false);
                            const text = res.message;
                            setMessages((prev) => [...prev, { sender: "AI", text }]);
                            if (!panelOpenRef.current) {
                                setUnreadCount((c) => c + 1);
                            }
                            break;
                        }

                        case "frontendActionChangeGState":
                            ["localhost", "127.0.0.1"].includes(window.location.hostname) && console.log(
                                "\n frontendActionChangeGState:: res: ", res,
                                "\n Boolean(res?.setGState): ", Boolean(res?.setGState),
                                "\n typeof res.setGState === 'object': ", typeof res.setGState === "object",
                                "\n res?.setGState && typeof res.setGState === 'object': ", res?.setGState && typeof res.setGState === "object",
                            );

                            if (res?.setGState && typeof res.setGState === "object") {
                                const jobPatch = {};
                                if (Object.prototype.hasOwnProperty.call(res.setGState, "jobFormData")) {
                                    jobPatch.jobFormData = res.setGState.jobFormData;
                                }
                                if (Object.prototype.hasOwnProperty.call(res.setGState, "jobRowsList")) {
                                    jobPatch.jobRowsList = res.setGState.jobRowsList;
                                }
                                if (Object.prototype.hasOwnProperty.call(res.setGState, "jobsListViewMode")) {
                                    jobPatch.jobsListViewMode = res.setGState.jobsListViewMode;
                                }

                                setJobState((prev = {}) => ({
                                    ...prev,
                                    ...jobPatch,
                                    jobInitialValuesDict: {
                                        ...(prev?.jobInitialValuesDict || {}),
                                        ...(res?.setGState?.jobInitialValuesDict || {}),
                                        ...(res?.setGState?.newJobCreationData || {}),
                                    },
                                }));
                                navigate("/jobs/new/");
                            }
                            break;

                        case "frontendActionChangeJobUpdateGState":

                            ["localhost", "127.0.0.1"].includes(window.location.hostname) && console.log(
                                "\n frontendActionChangeJobUpdateGState:: res: ", res,
                                "\n Boolean(res?.setGState): ", Boolean(res?.setGState),
                                "\n typeof res.setGState === 'object': ", typeof res.setGState === "object",
                                "\n res?.setGState && typeof res.setGState === 'object': ", res?.setGState && typeof res.setGState === "object",
                            );

                            if (res?.setGState && typeof res.setGState === "object") {

                                navigate("/jobs/new/");

                                setJobState((prev = {}) => ({
                                    ...prev,
                                    jobFormData: null,
                                    jobInitialValuesDict: {
                                        ...(res?.setGState || {}),
                                    },
                                }));
                            }
                            break;

                        case "frontendActionChangeCompanyUpdateGState":
                            if (res?.setGState && typeof res.setGState === "object") {
                                const { companyId, changed = {} } = res.setGState;
                                const navOpts = { replace: false };
                                performDeploySafeFetch(
                                    "Fetch Company for Update",
                                    async () => await fetchData("/api/companies/" + companyId),
                                    null,
                                    "Loading Company"
                                )
                                    .then((companyRes) => {
                                        if (companyRes) {
                                            const merged = {
                                                ...(companyRes || {}),
                                                ...(changed || {}),
                                                id: companyId,
                                            };
                                            setCompanyState({ companyInitialValuesDict: merged });
                                            navigate("/companies/new/", navOpts);
                                        }
                                    })
                                    .catch((err) => {
                                        console.error(
                                            "Error hydrating company update form:",
                                            err
                                        );
                                    });
                            }
                            break;

                        case "frontendActionChangeCompanyGState":
                            if (res?.setGState && typeof res.setGState === "object") {
                                setCompanyState({
                                    companyInitialValuesDict: {
                                        ...(gState?.companyInitialValuesDict || {}),
                                        ...(res?.setGState?.companyInitialValuesDict || {}),
                                    },
                                });
                                navigate("/companies/new/", { replace: false });
                            }
                            break;

                        case "frontendActionChangeCandidateGState":
                            if (res?.setGState && typeof res.setGState === "object") {
                                setCandidateState({
                                    candidateInitialValuesDict: {
                                        ...(gState?.candidateInitialValuesDict || {}),
                                        ...(res?.setGState?.candidateInitialValuesDict || {}),
                                    },
                                });
                                navigate("/candidates/new/", { replace: false });
                            }
                            break;

                        case "frontendActionChangeCandidateUpdateGState":
                            if (res?.setGState && typeof res.setGState === "object") {
                                const { candidateId, changed = {} } = res.setGState;
                                const navOpts = { replace: false };
                                performDeploySafeFetch(
                                    "Fetch Candidate for Update",
                                    async () => await fetchData("/api/candidates/" + candidateId),
                                    null,
                                    "Loading Candidate"
                                )
                                    .then((candRes) => {
                                        const merged = {
                                            ...(candRes || {}),
                                            ...(changed || {}),
                                            _id: candidateId,
                                        };
                                        setCandidateState({ candidateEditInitialValues: merged });
                                        navOpts.state = { editCandidate: merged };
                                        navigate("/candidates/edit/" + candidateId, navOpts);
                                    })
                                    .catch((err) => {
                                        console.error(
                                            "Error hydrating candidate update form:",
                                            err
                                        );
                                        navigate("/candidates/edit/" + candidateId, navOpts);
                                    });
                            }
                            break;

                        case "frontendActionSubmitCandidateUpdateForm":
                            setCandidateState({ candidateUpdateWsSubmit: true });
                            break;

                        case "frontendActionNextStepJobForm":
                            document?.getElementById?.("id_job_form_submit")?.click?.();
                            break;

                        case "frontendActionSubmitJobCreationForm":
                            document?.getElementById?.("id_job_form_submit")?.click?.();
                            setTimeout(() => {
                                document?.getElementById?.("id_job_form_submit")?.click?.();
                                setTimeout(() => {
                                    document?.getElementById?.("id_job_form_submit")?.click?.();
                                    setTimeout(() => {
                                        document?.getElementById?.("id_job_form_submit")?.click?.();
                                    }, 300);
                                }, 300);
                            }, 300);

                            break;

                        case "frontendActionSubmitCompanyCreationForm":
                            setCompanyState({
                                companyWsSubmit: true,
                            });
                            navigate("/companies/", { replace: false });
                            break;

                        case "frontendActionSubmitCandidateCreationForm":
                            setCandidateState({ candidateWsSubmit: true });
                            break;

                        case "historyRetrival":
                            setMessages(
                                Array.isArray(res?.history)
                                    ? res.history
                                        .map((ele) => {
                                            if (!ele?.role || !ele?.content) return null;
                                            const txt =
                                                Array.isArray(ele.content) &&
                                                    ele.content[0]?.text
                                                    ? ele.content[0].text
                                                    : typeof ele.content === "string"
                                                        ? ele.content
                                                        : "";
                                            return {
                                                sender:
                                                    ele.role === "assistant" ? "AI" : "You",
                                                text: txt,
                                            };
                                        })
                                        .filter((m) => m && m.text)
                                    : []
                            );
                            setUnreadCount(0);
                            break;

                        default:
                            break;
                    }
                };

                socket.onerror = (err) => {
                    console.error("[Ai Assistant] WebSocket error:", err);
                };

                socket.onclose = () => {
                    console.warn("[Ai Assistant] WebSocket closed");
                    setWs(null);
                    setLoading(false);
                    setUnreadCount(0);
                };

                return socket;
            } catch (err) {
                console.error("Error in connecting to ws: ", err);
                throw new Error("Error in connecting to ws: " + err);
            }
        } else {
            return ws;
        }
    };

    useEffect(() => {
        establishConnection();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        const isFullPage = window?.location?.pathname
            ?.toLowerCase()
            ?.includes("/ai/agent/assistant");
        isFullPageAssistant !== isFullPage && setIsFullPageAssistant(isFullPage);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [window?.location?.pathname, isFullPageAssistant]);

    useEffect(() => {
        if (gState?.isAIAgentAssistantChatOpen && messages.length === 0) {
            setMessages([
                {
                    sender: "AI",
                    text: "Hi, I’m Layla, your AI assistant. I can help you with jobs, candidates and companies. What do you want to do today?",
                },
            ]);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [gState?.isAIAgentAssistantChatOpen]);

    useEffect(() => {
        if (typeof window === "undefined") return;
        const SpeechRecognition =
            window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            recognitionRef.current = null;
            return;
        }
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = "en-US";

        recognition.onresult = (event) => {
            try {
                const transcript = Array.from(event.results)
                    .map((r) => r[0]?.transcript || "")
                    .join(" ")
                    .trim();
                if (transcript) {
                    setInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
                }
            } catch (e) {
                console.error("Speech recognition result error:", e);
            }
        };

        recognition.onend = () => {
            setIsListening(false);
        };

        recognition.onerror = (e) => {
            console.error("Speech recognition error:", e);
            setIsListening(false);
        };

        recognitionRef.current = recognition;

        return () => {
            try {
                recognition.stop();
            } catch (_e) { }
        };
    }, []);

    const handleSend = async () => {
        const hasText = input.trim().length > 0;
        const hasFiles = attachments.length > 0;

        if (!hasText && !hasFiles) return;

        setIgnoreAssistantMessages(false);
        ignoreAssistantMessagesRef.current = false;

        try {
            setLoading(true);
            const soc = await establishConnection();

            if (hasText) {
                const req = {
                    event: "message",
                    message: input,
                };
                soc.send(JSON.stringify(req));
                setMessages((prev) => [...prev, { sender: "You", text: input }]);
                setInput("");
            }

            if (hasFiles) {
                const valid = attachments.filter((f) =>
                    ACCEPTED_FILE_TYPES.includes(f.type)
                );
                if (!valid.length) {
                    setMessages((prev) => [
                        ...prev,
                        {
                            sender: "AI",
                            text: "No supported files selected. Allowed: PDF, DOC, DOCX.",
                        },
                    ]);
                } else {
                    const packed = await Promise.all(valid.map(readFileAsBase64));
                    const payload = {
                        event: "dataFromFrontend",
                        data: { resumes: packed },
                    };
                    soc?.send?.(JSON.stringify(payload));
                    setMessages((prev) => [
                        ...prev,
                        {
                            sender: "You",
                            text: `📎 Uploaded ${packed.length
                                } file${packed.length > 1 ? "s" : ""}: ${packed
                                    .map((p) => "`" + p.filename + "`")
                                    .join(", ")}`,
                        },
                    ]);
                }
                setAttachments([]);
                if (fileInputRef?.current) fileInputRef.current.value = "";
            }

            if (!hasText) setLoading(false);
        } catch (err) {
            console.error("Send error:", err);
            setMessages((prev) => [
                ...prev,
                { sender: "AI", text: "Failed to send. Please try again." },
            ]);
            setLoading(false);
        }
    };

    const handleStop = () => {
        try {
            setIgnoreAssistantMessages(true);
            ignoreAssistantMessagesRef.current = true;

            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ event: "stop" }));
            }
        } catch (e) {
            console.error("Stop error:", e);
        }
        setLoading(false);
    };

    const handleMicClick = () => {
        const recognition = recognitionRef.current;
        if (!recognition) {
            setMessages((prev) => [
                ...prev,
                {
                    sender: "AI",
                    text: "Voice input is not supported in this browser.",
                },
            ]);
            return;
        }

        if (isListening) {
            try {
                recognition.stop();
            } catch (_e) { }
            setIsListening(false);
            return;
        }

        try {
            recognition.start();
            setIsListening(true);
        } catch (e) {
            console.error("Failed to start speech recognition:", e);
            setIsListening(false);
        }
    };

    const onKey = (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const handleAddFilesClick = () => {
        fileInputRef?.current?.click?.();
    };

    const readFileAsBase64 = (file) =>
        new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                const result = reader.result || "";
                const base64 = String(result).replace(/^data:.*;base64,/, "");
                resolve({
                    filename: file.name,
                    mimetype: file.type,
                    size: file.size,
                    base64,
                });
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });

    const onFilesSelected = async (e) => {
        const files = Array.from(e?.target?.files || []);
        if (!files.length) return;
        const valid = files.filter((f) => ACCEPTED_FILE_TYPES.includes(f.type));
        if (!valid.length) {
            setMessages((prev) => [
                ...prev,
                {
                    sender: "AI",
                    text: "No supported files selected. Allowed: PDF, DOC, DOCX.",
                },
            ]);
            e.target.value = "";
            return;
        }

        setAttachments((prev) => [...prev, ...valid]);
        e.target.value = "";
    };

    const orb1Bg = `radial-gradient(closest-side, ${alpha(
        theme.palette.primary.main,
        0.18
    )}, transparent)`;
    const orb2Bg = `radial-gradient(closest-side, ${alpha(
        theme.palette.primary.light,
        0.18
    )}, transparent)`;

    const removeAttachmentAt = (idx) => {
        setAttachments((prev) => prev.filter((_, i) => i !== idx));
    };

    const AttachmentChips = () =>
        attachments.length ? (
            <Stack direction="row" spacing={0.75} flexWrap="wrap" sx={{ mt: 0.75 }}>
                {attachments.map((f, idx) => (
                    <Chip
                        key={idx + f.name}
                        label={f.name}
                        onDelete={() => removeAttachmentAt(idx)}
                        variant="outlined"
                        size="small"
                        sx={{
                            borderRadius: 2,
                            borderColor: alpha(theme.palette.divider, 0.6),
                            maxWidth: "100%",
                        }}
                    />
                ))}
            </Stack>
        ) : null;

    return isFullPageAssistant ? (
        /* full-page harness unchanged */
        <Container>
            {/* ... */}
        </Container>
    ) : (
        <>
            <FabShell
                component={motion.div}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
            >
                <AnimatePresence>
                    {!gState?.isAIAgentAssistantChatOpen && unreadCount > 0 && (
                        <motion.div
                            key="badge-pop"
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            exit={{ scale: 0 }}
                            style={{
                                position: "absolute",
                                right: -2,
                                bottom: 58,
                                zIndex: 1,
                            }}
                        >
                            <Badge
                                badgeContent={unreadCount}
                                color="error"
                                sx={{
                                    "& .MuiBadge-badge": {
                                        transform: "scale(1.1)",
                                        fontWeight: 700,
                                        border: `2px solid ${theme.palette.background.paper}`,
                                    },
                                }}
                            />
                        </motion.div>
                    )}
                </AnimatePresence>

                <AnimatePresence>
                    {!gState?.isAIAgentAssistantChatOpen && showFabGreeting && (
                        <motion.div
                            key="layla-greeting"
                            initial={{ opacity: 0, y: 8, scale: 0.96 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 8, scale: 0.96 }}
                            transition={{ duration: 0.25 }}
                            style={{
                                position: "absolute",
                                right: 76,
                                bottom: 60,
                                maxWidth: 240,
                            }}
                        >
                            <Paper
                                sx={{
                                    px: 1.6,
                                    py: 1.1,
                                    borderRadius: 3,
                                    fontSize: "0.8rem",
                                    boxShadow: `0 10px 26px ${alpha(theme.palette.common.black, 0.38)}`,
                                    background: alpha(theme.palette.background.paper, 0.98),
                                    border: `1px solid ${alpha(
                                        theme.palette.primary.main,
                                        0.25
                                    )}`,
                                }}
                            >
                                <Stack direction="row" spacing={1}>
                                    <Box
                                        sx={{
                                            width: 40,
                                            height: 40,
                                            borderRadius: "50%",
                                            overflow: "hidden",
                                            border: `2px solid ${alpha(
                                                theme.palette.primary.main,
                                                0.4
                                            )}`,
                                        }}
                                    >
                                        <Box
                                            component="img"
                                            src={laylaAvatar} // <-- GIF here
                                            alt="Avatar"
                                            sx={{
                                                width: "100%",
                                                height: "100%",
                                                objectFit: "cover",
                                            }}
                                        />
                                    </Box>
                                    <Box>
                                        <Typography
                                            sx={{
                                                fontWeight: 600,
                                                mb: 0.3,
                                                whiteSpace: "nowrap",
                                            }}
                                        >
                                            Hi, I’m Layla 👋
                                        </Typography>
                                    </Box>
                                </Stack>
                            </Paper>
                        </motion.div>
                    )}
                </AnimatePresence>

                <FabButton
                    onClick={() => {
                        setIsAIAgentAssistantChatOpen((s) => {
                            const next = !s;
                            if (next) setUnreadCount(0);
                            return next;
                        });
                        setIsFullPageAssistant(false);
                        setShowFabGreeting(false);
                        setIsWidgetMaximized(false);
                        establishConnection();
                    }}
                    aria-label="Open assistant"
                >
                    {/* use GIF instead of Lottie bot */}
                    <Box
                        component="img"
                        src={aiBotGif}
                        alt="AI assistant"
                        sx={{
                            width: "100%",
                            height: "100%",
                            objectFit: "contain",
                            borderRadius: "50%",
                            transform: "scale(1.36)",
                            filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.12))",
                            p: 0
                        }}
                    />
                </FabButton>

            </FabShell>

            <AnimatePresence>
                {gState?.isAIAgentAssistantChatOpen && (
                    <Panel
                        component={motion.div}
                        initial={{ opacity: 0, y: 18, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 18, scale: 0.98 }}
                        transition={{ duration: 0.28 }}
                        elevation={0}
                        sx={
                            isWidgetMaximized
                                ? {
                                    // nearly full screen, with a thin margin
                                    height: { xs: "calc(100vh - 80px)", md: "calc(100vh - 80px)" },
                                    maxHeight: "80vh",

                                    // much wider when maximized
                                    width: { xs: "calc(100vw - 32px)", md: "min(980px, calc(100vw - 72px))" },
                                    maxWidth: { xs: "calc(100vw - 32px)", md: "min(980px, calc(100vw - 72px))" },
                                    right: { xs: 16, md: 32 },
                                    // bottom: { xs: 100, md: 100 },
                                    // borderRadius: { xs: 12, md: 16 },
                                    mx: 3,
                                    overflowY: "auto"
                                }
                                : {}
                        }
                    >
                        <GlowOrb
                            style={{
                                width: 240,
                                height: 240,
                                left: -40,
                                top: 110,
                                background: orb1Bg,
                                animation: `${float} 11s ease-in-out infinite`,
                            }}
                        />
                        <GlowOrb
                            style={{
                                width: 220,
                                height: 220,
                                right: -40,
                                bottom: 160,
                                background: orb2Bg,
                                animation: `${float} 10s ease-in-out infinite`,
                            }}
                        />

                        <Header>
                            <Stack direction="row" spacing={1.6} alignItems="center">
                                <Badge
                                    overlap="circular"
                                    variant="dot"
                                    anchorOrigin={{
                                        vertical: "bottom",
                                        horizontal: "right",
                                    }}
                                    sx={{
                                        "& .MuiBadge-badge": {
                                            backgroundColor: ws
                                                ? theme.palette.success.main
                                                : theme.palette.warning.main,
                                            boxShadow: `0 0 0 2px ${alpha(
                                                theme.palette.background.default,
                                                0.95
                                            )}`,
                                        },
                                    }}
                                >
                                    <Box
                                        sx={{
                                            width: 60,
                                            height: 60,
                                            borderRadius: "50%",
                                            overflow: "hidden",
                                            border: `2px solid ${alpha(
                                                theme.palette.primary.main,
                                                0.4
                                            )}`,
                                            backgroundColor: theme.palette.background.paper,
                                        }}
                                    >
                                        <Box
                                            component="img"
                                            src={laylaAvatar} // <-- GIF here
                                            alt="Avatar"
                                            sx={{
                                                width: "100%",
                                                height: "100%",
                                                objectFit: "cover",
                                            }}
                                        />
                                    </Box>
                                </Badge>
                                <Box>
                                    <Typography
                                        sx={{
                                            fontWeight: 800,
                                            letterSpacing: 0.25,
                                            lineHeight: 1.1,
                                            fontSize: "1rem",
                                        }}
                                    >
                                        Layla
                                    </Typography>
                                    <Typography
                                        variant="caption"
                                        sx={{ color: "text.secondary" }}
                                    >
                                        Your AI hiring copilot
                                    </Typography>
                                </Box>
                            </Stack>


                            <Box
                                sx={{
                                    width: 48,
                                    height: 48,
                                    ml: 0.25,
                                    // borderRadius: "50%",
                                    overflow: "hidden",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    // border: `2px solid ${alpha(theme.palette.primary.main, 0.35)}`,
                                    p: 0,
                                    m: 0,
                                }}
                            >
                                <Box
                                    component="img"
                                    src={laylaWaveAnimation}
                                    alt="Layla Avatar"
                                    sx={{
                                        width: "100%",
                                        height: "100%",
                                        objectFit: "cover",
                                    }}
                                />
                            </Box>

                            <Stack direction="row" spacing={0.75} alignItems="center">
                                <Chip
                                    size="small"
                                    label={ws ? "Online" : "Offline · tap to connect"}
                                    color={ws ? "success" : "warning"}
                                    onClick={() => establishConnection()}
                                    variant="outlined"
                                    sx={{ height: 24, fontSize: "0.7rem" }}
                                />

                                <IconButton
                                    size="small"
                                    onClick={() =>
                                        setIsWidgetMaximized((prev) => !prev)
                                    }
                                >
                                    {isWidgetMaximized ? (
                                        <FullscreenExitRoundedIcon fontSize="small" />
                                    ) : (
                                        <FullscreenRoundedIcon fontSize="small" />
                                    )}
                                </IconButton>

                                <IconButton
                                    size="small"
                                    onClick={() => {
                                        setIsWidgetMaximized(false);
                                        setIsAIAgentAssistantChatOpen(false);
                                    }}
                                >
                                    <CloseRoundedIcon />
                                </IconButton>
                            </Stack>
                        </Header>

                        <ScrollArea ref={scrollRef}>
                            {messages.map((m, i) => (
                                <Bubble key={i} role={m.sender}>
                                    {m.text}
                                </Bubble>
                            ))}
                            {loading && ws && (
                                <Stack
                                    direction="row"
                                    spacing={1}
                                    alignItems="center"
                                    sx={{ mt: 1.5 }}
                                >
                                    <CircularProgress size={18} />
                                    <Typography variant="caption" color="text.secondary">
                                        Analyzing...
                                    </Typography>
                                </Stack>
                            )}
                        </ScrollArea>

                        <Divider />

                        <Box sx={{ p: 1.1 }}>
                            <Stack
                                direction={{ xs: "column", sm: "row" }}
                                spacing={1}
                                alignItems={{ xs: "stretch", sm: "flex-end" }}
                                gap={3}
                            >
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    multiple
                                    accept={ACCEPTED_FILE_TYPES.join(",")}
                                    style={{ display: "none" }}
                                    onChange={onFilesSelected}
                                />

                                <TextField
                                    size="small"
                                    fullWidth
                                    multiline
                                    minRows={1}
                                    maxRows={6}
                                    placeholder="Ask Layla anything…"
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    onKeyDown={onKey}
                                    variant="standard"
                                    sx={{
                                        p: 1,
                                        "& .MuiOutlinedInput-root": {
                                            borderRadius: 1,
                                            background: theme.palette.background.paper,
                                            boxShadow: isDark
                                                ? `0 6px 16px ${alpha(theme.palette.common.black, 0.55)}`
                                                : `0 6px 16px ${alpha(theme.palette.common.black, 0.08)}`,
                                            alignItems: "flex-end",
                                        },
                                        "& .MuiOutlinedInput-notchedOutline": {
                                            borderColor: alpha(
                                                theme.palette.divider,
                                                0.6
                                            ),
                                        },
                                        flex: 1,
                                        width: "100%",
                                        border: "none",
                                    }}
                                />

                                <Stack
                                    direction="row"
                                    spacing={0.75}
                                    // gap={2}
                                    alignItems="center"
                                    justifyContent="flex-end"
                                    flexWrap="wrap"
                                    sx={{ width: { xs: "100%", sm: "auto" }, rowGap: 0.5 }}
                                >
                                    <IconButton
                                        aria-label="Attach files"
                                        onClick={handleAddFilesClick}
                                        disabled={loading}
                                        sx={{
                                            borderRadius: 1,
                                            // border: `1px solid ${alpha(
                                            //     theme.palette.divider,
                                            //     0.6
                                            // )}`,
                                        }}
                                        title="Attach files (+)"
                                    >
                                        <AddRoundedIcon />
                                    </IconButton>

                                    <IconButton
                                        aria-label="Voice input"
                                        onClick={handleMicClick}
                                        disabled={loading}
                                        sx={{
                                            borderRadius: 1,
                                            // border: `1px solid ${alpha(
                                            //     theme.palette.divider,
                                            //     0.6
                                            // )}`,
                                            bgcolor: isListening
                                                ? alpha(theme.palette.primary.main, 0.12)
                                                : "transparent",
                                        }}
                                        title={
                                            isListening
                                                ? "Stop listening"
                                                : "Start voice input"
                                        }
                                    >
                                        <MicRoundedIcon
                                            fontSize="small"
                                            color={isListening ? "primary" : "inherit"}
                                        />
                                    </IconButton>

                                    <IconButton
                                        aria-label="Stop"
                                        onClick={handleStop}
                                        disabled={!loading && (!ws || ws.readyState !== 1)}
                                        sx={{
                                            borderRadius: 1,
                                            // border: `1px solid ${alpha(
                                            //     theme.palette.error.main,
                                            //     0.5
                                            // )}`,
                                        }}
                                        title="Stop current response"
                                    >
                                        <StopRoundedIcon
                                            fontSize="small"
                                            sx={{ color: theme.palette.error.main }}
                                        />
                                    </IconButton>

                                    <MUIButton
                                        variant="contained"
                                        onClick={handleSend}
                                        disabled={
                                            loading ||
                                            (!input.trim() && attachments.length === 0)
                                        }
                                        endIcon={<SendRoundedIcon />}
                                        sx={{
                                            // borderRadius: 999,
                                            color: isDark ? "whitesmoke" : theme.palette.primary?.light,
                                            mx: 2.6,
                                            height: 40,
                                            minWidth: 86,
                                            fontWeight: 600,
                                            boxShadow: isDark
                                                ? `0 10px 24px ${alpha(theme.palette.common.black, 0.7)}`
                                                : `0 10px 24px ${alpha(theme.palette.common.black, 0.2)}`,
                                        }}
                                    >
                                        Send
                                    </MUIButton>
                                </Stack>
                            </Stack>

                            <AttachmentChips />
                        </Box>
                    </Panel>
                )}
            </AnimatePresence>
        </>
    );
}
