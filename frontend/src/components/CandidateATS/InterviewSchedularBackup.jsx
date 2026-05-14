
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
    Box,
    Card,
    CardContent,
    Typography,
    Divider,
    TextField,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    ListItemText,
    Stepper,
    Step, StepLabel,
    Button,
    Grid,
    useTheme,
    FormControlLabel,
    Checkbox,
    Chip,
    Accordion,
    AccordionSummary,
    AccordionDetails,
    Stack,
    Tooltip,
    Tabs,
    Tab,
} from "@mui/material";
import { alpha } from "@mui/material/styles";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import EventAvailableIcon from "@mui/icons-material/EventAvailable";
import SaveIcon from "@mui/icons-material/Save";
import SendIcon from "@mui/icons-material/Send";
import WorkIcon from "@mui/icons-material/Work";
import PersonIcon from "@mui/icons-material/Person";
import TimelineIcon from "@mui/icons-material/Timeline";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import HourglassEmptyIcon from "@mui/icons-material/HourglassEmpty";
import CancelOutlinedIcon from "@mui/icons-material/CancelOutlined";
import PauseCircleOutlineIcon from "@mui/icons-material/PauseCircleOutline";
import BlockOutlinedIcon from "@mui/icons-material/BlockOutlined";
import RadioButtonUncheckedIcon from "@mui/icons-material/RadioButtonUnchecked";
import CodeIcon from "@mui/icons-material/Code";

import MUIButton from "../MUI/commonUI/MUIButton";
import MUICenterLayout from "../MUI/commonUI/MUICenterLayout";
import MUIFileInput from "../MUI/commonUI/MUIFileInput";
import { Dialog, DialogTitle, DialogContent, DialogActions } from "@mui/material";

import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { DateCalendar } from "@mui/x-date-pickers/DateCalendar";

import { fetchData } from "../../AppUtils/dataAPI";
import { useUiContextState } from "../../contexts/UiContext";
import { useInterviewContextState } from "../../contexts/InterviewContext";
import { useAuthContextState } from "../../contexts/AuthContext";

/* -----------------------------
   Defaults
----------------------------- */

const defaultForm = (tz) => ({
    interviewMode: "Virtual",
    locationAddress: "",
    meetingLink: "",
    interviewDate: "",
    startTime: "",
    durationMinutes: 45,
    timezone: tz || Intl.DateTimeFormat().resolvedOptions().timeZone,
    interviewerType: "AI",
    interviewType: "Technical",
    difficultyLevel: "Intermediate",
    notes: "",
    interviewers: [],
    technicalScript: "",
    scriptStyle: "Compact", // NEW: Compact | Detailed (backend can honor this)
});

const buildDefaultSelectionFromBlueprint = (blueprint) => {
    const groups = Array.isArray(blueprint?.groups) ? blueprint.groups : [];
    const selection = {};
    for (const g of groups) {
        const gName = g?.name || "Group";
        selection[gName] = { enabled: false, parameters: {} };
        const params = Array.isArray(g?.parameters) ? g.parameters : [];
        for (const p of params) {
            const pName = p?.name || "Parameter";
            const subs = Array.isArray(p?.subparameters) ? p.subparameters : [];
            selection[gName].parameters[pName] = {
                enabled: false,
                subEnabled: subs.reduce((acc, s) => {
                    // Groups/parameters/sub-parameters are NOT selected by default.
                    acc[s] = false;
                    return acc;
                }, {}),
            };
        }
    }
    return selection;
};

const buildSelectedBlueprint = (blueprint, selection) => {
    const groups = Array.isArray(blueprint?.groups) ? blueprint.groups : [];
    const out = [];

    for (const g of groups) {
        const gName = g?.name || "Group";
        const gSel = selection?.[gName];
        if (!gSel?.enabled) continue;

        const params = Array.isArray(g?.parameters) ? g.parameters : [];
        const outParams = [];

        for (const p of params) {
            const pName = p?.name || "Parameter";
            const pSel = gSel?.parameters?.[pName];
            if (!pSel?.enabled) continue;

            const subs = Array.isArray(p?.subparameters) ? p.subparameters : [];
            const chosenSubs = subs.filter((s) => pSel?.subEnabled?.[s]);

            outParams.push({
                name: pName,
                subparameters: chosenSubs.length ? chosenSubs : subs,
            });
        }

        if (outParams.length) out.push({ name: gName, parameters: outParams });
    }

    return out;
};

/* -----------------------------
   UI helpers
----------------------------- */

const countSelectedSubs = (pSel = {}) => {
    const subEnabled = pSel?.subEnabled || {};
    return Object.values(subEnabled).filter(Boolean).length;
};

const PillChip = ({ selected, disabled, label, onClick }) => {
    const theme = useTheme();
    const isDark = theme.palette.mode === "dark";

    // Force visual differentiation regardless of theme overrides:
    const selectedBg = theme.palette.primary.main;
    const selectedBorder = theme.palette.primary.main;
    const selectedText = theme.palette.primary.contrastText;

    const unselectedBg = "transparent";
    const unselectedBorder = isDark ? theme.palette.grey[600] : theme.palette.grey[400];
    const unselectedText = theme.palette.text.secondary;

    const hoverBg = selected
        ? theme.palette.primary.dark
        : isDark
            ? "rgba(255,255,255,0.06)"
            : "rgba(0,0,0,0.06)";

    return (
        <Chip
            label={label}
            clickable={!disabled}
            onClick={disabled ? undefined : onClick}
            size="small"
            variant={selected ? "filled" : "outlined"}
            color={selected ? "primary" : "default"}
            sx={{
                borderRadius: 999,
                fontWeight: 700,
                userSelect: "none",
                borderWidth: 1.5,
                height: 28,

                // Deterministic state styling:
                backgroundColor: selected ? selectedBg : unselectedBg,
                borderColor: selected ? selectedBorder : unselectedBorder,
                color: selected ? selectedText : unselectedText,

                "& .MuiChip-label": {
                    px: 1.1,
                    fontSize: 12,
                    letterSpacing: 0.4,
                    lineHeight: 1,
                },

                "&:hover": {
                    backgroundColor: disabled ? (selected ? selectedBg : unselectedBg) : hoverBg,
                },

                // Disabled should still show state (just muted)
                opacity: disabled ? 0.55 : 1,
            }}
        />
    );
};

const getInterviewerLabel = (interviewer = {}) => {
    const first = interviewer?.firstName || "";
    const last = interviewer?.lastName || "";
    const name = `${first} ${last}`.trim();
    return name || interviewer?.email || "Interviewer";
};

const dedupeById = (items = []) => {
    const map = new Map();
    for (const item of items) {
        const id = item?._id ? String(item._id) : "";
        if (!id || map.has(id)) continue;
        map.set(id, item);
    }
    return Array.from(map.values());
};

const formatScheduleWindow = (startAt, durationMinutes) => {
    const start = startAt ? new Date(startAt) : null;
    if (!start || Number.isNaN(start.getTime())) return "";
    const dateStr = start.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    });
    const timeStr = start.toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
    });
    const minutes = Number(durationMinutes || 0);
    return `${dateStr} ${timeStr} - ${minutes} min`;
};

const getCandidateLabel = (schedule = {}) => {
    const candidate = schedule?.candidate || {};
    const name = `${candidate.firstName || ""} ${candidate.lastName || ""}`.trim();
    return name || schedule?.candidateName || candidate?.email || "Candidate";
};

const getJobLabel = (schedule = {}) => {
    const job = schedule?.job || {};
    return job?.title || job?.internalTitle || schedule?.jobTitle || "Job";
};

const getScheduleStartMs = (schedule = {}) => {
    const start = schedule?.startAt ? new Date(schedule.startAt) : null;
    if (!start || Number.isNaN(start.getTime())) return Number.POSITIVE_INFINITY;
    return start.getTime();
};

const normalizeObjectId = (value) => {
    if (!value) return "";
    const str = String(value).trim();
    return /^[0-9a-fA-F]{24}$/.test(str) ? str : "";
};

const normalizeAllowedLanguageIds = (values = [], validSet) => {
    const ids = new Set();
    for (const entry of values || []) {
        const id = normalizeObjectId(entry?._id ?? entry);
        if (!id) continue;
        if (validSet && !validSet.has(id)) continue;
        ids.add(id);
    }
    return Array.from(ids);
};

/* -----------------------------
   Component
----------------------------- */

export default function InterviewScheduler() {
    const theme = useTheme();
    const isDark = theme.palette.mode === "dark";

    const [candidate, setCandidate] = useState(null);
    const [job, setJob] = useState(null);
    const [ats, setAts] = useState(null);
    const [selectedCandidates, setSelectedCandidates] = useState([]);
    const [form, setForm] = useState(defaultForm());
    const [, setLoadingInterviewers] = useState(false);

    const [isGeneratingScript, setIsGeneratingScript] = useState(false);
    const [isGeneratingCodingProblem, setIsGeneratingCodingProblem] = useState(false);

    const [allSchedules, setAllSchedules] = useState([]);
    const [availableInterviewers, setAvailableInterviewers] = useState([]);
    const [openCalendar, setOpenCalendar] = useState(false);
    const [selectedInterviewerName] = useState(null);
    const [selectedDate, setSelectedDate] = useState(new Date());
    const isCodingRound = form.interviewType === "Coding";
    const isSpeakingRound = !isCodingRound;

    const [, setUiState] = useUiContextState();
    const [, setInterviewState] = useInterviewContextState();
    const [, setAuthState] = useAuthContextState();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();

    // Coding Config State (merged or separate?)
    // Using form.codingConfig fields we planned:
    const [codingConfig, setCodingConfig] = useState({
        level: "Medium",
        testCases: 4,
        type: "DSA",
        allowedLanguages: [] // Array of language ObjectIds
    });
    const [availableLanguages, setAvailableLanguages] = useState([]);
    const [codingModalOpen, setCodingModalOpen] = useState(false);
    const [codingPdfFile, setCodingPdfFile] = useState(null);
    const [codingPdfText, setCodingPdfText] = useState("");
    const [codingPdfFingerprint, setCodingPdfFingerprint] = useState("");
    const [codingRoundMeta, setCodingRoundMeta] = useState({
        questionType: "",
        pdfFingerprint: "",
        testCaseCount: 0,
    });
    const codingModalSnapshotRef = useRef(null);
    const codingModalWasOpenRef = useRef(false);
    const isPdfQuestionType = String(codingConfig.type || "").toLowerCase().includes("pdf");
    const codingModalHeaderBg = isDark
        ? `linear-gradient(135deg, ${alpha(theme.palette.grey[900], 0.85)}, ${alpha(
            theme.palette.grey[800],
            0.7
        )})`
        : `linear-gradient(135deg, ${alpha(theme.palette.grey[100], 0.95)}, ${alpha(
            theme.palette.grey[200],
            0.9
        )})`;
    const codingModalSurface = isDark
        ? alpha(theme.palette.common.white, 0.04)
        : alpha(theme.palette.common.black, 0.02);
    const codingModalBorder = alpha(theme.palette.primary.main, isDark ? 0.25 : 0.18);
    const codingModalPattern = `radial-gradient(circle at 12% 0%, ${alpha(
        theme.palette.grey[400],
        isDark ? 0.25 : 0.18
    )}, transparent 55%), radial-gradient(circle at 100% 0%, ${alpha(
        theme.palette.grey[300],
        isDark ? 0.2 : 0.16
    )}, transparent 45%)`;

    // Fetch available languages
    useEffect(() => {
        (async () => {
            try {
                const langs = await fetchData("/api/codejudge/languages");
                if (Array.isArray(langs)) {
                    setAvailableLanguages(langs);
                    const normalizedAvailableIds = normalizeAllowedLanguageIds(langs);
                    const availableIdSet = new Set(normalizedAvailableIds);
                    const python = langs.find((l) =>
                        String(l?.name || "").toLowerCase().includes("python")
                    );
                    const pythonId = normalizeObjectId(python?._id);

                    setCodingConfig((prev) => {
                        const current = normalizeAllowedLanguageIds(prev.allowedLanguages, availableIdSet);
                        const nextAllowed = current.length ? current : (pythonId ? [pythonId] : []);
                        return { ...prev, allowedLanguages: nextAllowed };
                    });
                }
            } catch (err) {
                console.error("Failed to load languages", err);
            }
        })();
    }, []);

    const [codingRoundData, setCodingRoundData] = useState({
        title: "",
        description: "",
        constraints: [],
        examples: [],
        testCases: []
    });
    const [isEditingCodingRound, setIsEditingCodingRound] = useState(false);
    const [activeTestCase, setActiveTestCase] = useState(0);

    const cid = searchParams.get("cid") || "";
    const jid = searchParams.get("jid") || "";
    const atsid = searchParams.get("atsid") || "";
    const atsidsParam = searchParams.get("atsids") || "";
    const atsIds = useMemo(
        () =>
            atsidsParam
                .split(",")
                .map((v) => v.trim())
                .filter((v) => /^[0-9a-fA-F]{24}$/.test(v)),
        [atsidsParam]
    );

    const [showFullDesc, setShowFullDesc] = useState(false);
    const [showFullProblemDesc, setShowFullProblemDesc] = useState(false);

    // Parameters state
    const [paramModalOpen, setParamModalOpen] = useState(false);
    const [paramLoading, setParamLoading] = useState(false);
    const [paramBlueprint, setParamBlueprint] = useState(null);
    const [paramSelection, setParamSelection] = useState({});
    const [savedSelectedBlueprint, setSavedSelectedBlueprint] = useState(null);

    // Manual add inputs
    const [manualParamInput, setManualParamInput] = useState({});
    const [manualSubInput, setManualSubInput] = useState({});

    const handleCloseCalendar = () => setOpenCalendar(false);

    const handleInterviewerChange = (event) => {
        const value = event.target.value;
        const selectedIds = Array.isArray(value)
            ? value
            : String(value || "").split(",");
        const uniqueIds = Array.from(new Set(selectedIds.filter(Boolean).map(String)));
        setForm((v) => ({
            ...v,
            interviewers: uniqueIds,
        }));
    };

    const buildPdfFingerprint = (file) => {
        if (!file) return "";
        const name = file.name || "document.pdf";
        const size = Number(file.size || 0);
        const lastModified = Number(file.lastModified || 0);
        return `${name}_${size}_${lastModified}`;
    };

    const handlePdfUpload = (files) => {
        const list = Array.isArray(files)
            ? files
            : files?.target?.files
                ? Array.from(files.target.files)
                : [];
        const file = list[0] || null;
        setCodingPdfFile(file || null);
        setCodingPdfText("");
        setCodingPdfFingerprint(file ? buildPdfFingerprint(file) : "");
    };

    useEffect(() => {
        if (codingModalOpen && !codingModalWasOpenRef.current) {
            codingModalWasOpenRef.current = true;
            codingModalSnapshotRef.current = {
                codingConfig: {
                    ...codingConfig,
                    allowedLanguages: Array.isArray(codingConfig.allowedLanguages)
                        ? [...codingConfig.allowedLanguages]
                        : [],
                },
                codingPdfFile,
                codingPdfText,
                codingPdfFingerprint,
            };
            return;
        }
        if (!codingModalOpen && codingModalWasOpenRef.current) {
            codingModalWasOpenRef.current = false;
        }
    }, [codingModalOpen, codingConfig, codingPdfFile, codingPdfText, codingPdfFingerprint]);

    useEffect(() => {
        (async () => {
            if (!atsIds.length && !atsid && !cid && !jid) return;
            setUiState({ loadingMsg: "Loading…" });
            setLoadingInterviewers(true);
            try {
                if (atsIds.length) {
                    const results = await Promise.allSettled(
                        atsIds.map((id) =>
                            fetchData(`/api/interviewschedules/view?candidateATS=${id}`)
                        )
                    );
                    const views = results
                        .filter((r) => r.status === "fulfilled" && !r.value?.error)
                        .map((r) => r.value);

                    if (!views.length) {
                        setCandidate(null);
                        setJob(null);
                        setAts(null);
                        setSelectedCandidates([]);
                        setAvailableInterviewers([]);
                    } else {
                        const primary = views[0];
                        setCandidate(primary?.candidate || null);
                        setJob(primary?.job || null);
                        setAts(primary?.ats || null);
                        setSelectedCandidates(
                            views.map((v) => ({
                                candidate: v?.candidate || null,
                                job: v?.job || null,
                                ats: v?.ats || null,
                            }))
                        );
                        const interviewerPool = views.flatMap((v) =>
                            Array.isArray(v?.interviewers) ? v.interviewers : []
                        );
                        setAvailableInterviewers(dedupeById(interviewerPool));
                    }
                } else {
                    const params = new URLSearchParams();
                    if (atsid) params.append("candidateATS", atsid);
                    if (cid) params.append("candidateId", cid);
                    if (jid) params.append("jobId", jid);

                    const view = await fetchData(`/api/interviewschedules/view?${params.toString()}`);
                    setCandidate(view?.candidate || null);
                    setJob(view?.job || null);
                    setAts(view?.ats || null);
                    setSelectedCandidates(
                        view?.candidate
                            ? [{ candidate: view.candidate, job: view.job || null, ats: view.ats || null }]
                            : []
                    );
                    setAvailableInterviewers(
                        Array.isArray(view?.interviewers) ? view.interviewers : []
                    );
                }

                const all = await fetchData("/api/interviewschedules");
                setAllSchedules(all || []);
            } catch (e) {
                console.error("Failed to load scheduler view:", e);
            } finally {
                setLoadingInterviewers(false);
                setUiState({ loadingMsg: null });
            }
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [atsid, cid, jid, atsIds]);

    const { start, end } = useMemo(() => {
        if (!form.interviewDate || !form.startTime) return {};
        const s = new Date(`${form.interviewDate}T${form.startTime}:00`);
        const e = new Date(s.getTime() + Number(form.durationMinutes || 0) * 60000);
        return { start: s, end: e };
    }, [form.interviewDate, form.startTime, form.durationMinutes]);

    const schedulesByInterviewerId = useMemo(() => {
        const map = {};
        const normalizeId = (x) => (typeof x === "string" ? x : x?.toString?.() || "");
        for (const s of allSchedules || []) {
            for (const u of s.interviewers || []) {
                const uid = normalizeId(u._id ?? u);
                if (!uid) continue;
                if (!map[uid]) map[uid] = [];
                map[uid].push(s);
            }
        }
        return map;
    }, [allSchedules]);

    const interviewerLabelsById = useMemo(() => {
        const map = {};
        for (const interviewer of availableInterviewers || []) {
            const id = interviewer?._id ? String(interviewer._id) : "";
            if (!id) continue;
            map[id] = getInterviewerLabel(interviewer);
        }
        return map;
    }, [availableInterviewers]);

    const selectedInterviewers = useMemo(() => {
        const selectedIds = new Set((form.interviewers || []).map(String));
        return (availableInterviewers || [])
            .filter((interviewer) => selectedIds.has(String(interviewer._id)))
            .map((interviewer) => ({
                id: String(interviewer._id),
                name: getInterviewerLabel(interviewer),
                email: interviewer?.email || "",
            }));
    }, [availableInterviewers, form.interviewers]);

    const selectedScheduleGroups = useMemo(() => {
        if (!selectedInterviewers.length) return [];
        return selectedInterviewers.map((interviewer) => {
            const schedules = [...(schedulesByInterviewerId[interviewer.id] || [])];
            schedules.sort(
                (a, b) => getScheduleStartMs(a) - getScheduleStartMs(b)
            );
            return { interviewer, schedules };
        });
    }, [selectedInterviewers, schedulesByInterviewerId]);

    const overlaps = (aStart, aEnd, bStart, bEnd) => aStart < bEnd && bStart < aEnd;

    const conflictInfoByInterviewer = useMemo(() => {
        if (!start || !end) return {};
        const result = {};
        for (const pick of selectedInterviewers) {
            const list = schedulesByInterviewerId[pick.id] || [];
            for (const s of list) {
                if (!s.startAt || !s.durationMinutes) continue;
                const sStart = new Date(s.startAt);
                const sEnd = new Date(new Date(s.startAt).getTime() + s.durationMinutes * 60000);
                if (overlaps(start, end, sStart, sEnd)) {
                    result[pick.id] = {
                        startAt: s.startAt,
                        durationMinutes: s.durationMinutes,
                    };
                    break;
                }
            }
        }
        return result;
    }, [selectedInterviewers, schedulesByInterviewerId, start, end]);

    const anyConflict = useMemo(
        () => Object.keys(conflictInfoByInterviewer).length > 0,
        [conflictInfoByInterviewer]
    );

    const resetForm = () => {
        setForm(defaultForm(form.timezone));
        setParamBlueprint(null);
        setParamSelection({});
        setSavedSelectedBlueprint(null);
    };

    /* -----------------------------
       Parameters Modal logic
    ----------------------------- */

    const openParamModal = async () => {
        if (!job) return;

        setParamModalOpen(true);

        if (paramBlueprint && Object.keys(paramSelection || {}).length) return;

        setParamLoading(true);
        setSavedSelectedBlueprint(null);

        try {
            const payload = {
                interviewType: form.interviewType,
                difficultyLevel: form.difficultyLevel,
                job: {
                    title: job.title,
                    internalTitle: job.internalTitle,
                    primarySkills: job.primarySkills,
                    description: job.description,
                },
            };

            const res = await fetchData("/api/ai/generateInterviewParameters", {
                method: "POST",
                body: payload,
            });

            if (!res?.ok || !res?.blueprint?.groups?.length) {
                alert("Failed to generate interview parameters. Please try again.");
                return;
            }

            setParamBlueprint(res.blueprint);
            const initialSelection = buildDefaultSelectionFromBlueprint(res.blueprint);
            setParamSelection(initialSelection);
        } catch (err) {
            console.error("[PARAMS] Error:", err);
            alert("Failed to generate interview parameters. Check console.");
        } finally {
            setParamLoading(false);
        }
    };

    useEffect(() => {
        if (form.interviewerType !== "AI") return;

        setForm((v) => ({ ...v, technicalScript: "" }));
        setSavedSelectedBlueprint(null);
        setParamBlueprint(null);
        setParamSelection({});
        // removed: if (job) openParamModal();
        // user will open the modal manually via Configure Parameters button
    }, [form.interviewType, form.difficultyLevel, form.interviewerType, job?._id]);

    useEffect(() => {
        if (form.interviewerType !== "Human") return;
        if (form.interviewType === "Coding") {
            setForm((v) => ({ ...v, interviewType: "Technical" }));
            setCodingModalOpen(false);
        }
    }, [form.interviewerType, form.interviewType]);

    const toggleGroup = (groupName, enabled) => {
        setParamSelection((prev) => ({
            ...prev,
            [groupName]: {
                ...(prev[groupName] || { parameters: {} }),
                enabled,
            },
        }));
    };

    const toggleParam = (groupName, paramName, enabled) => {
        setParamSelection((prev) => ({
            ...prev,
            [groupName]: {
                ...(prev[groupName] || { enabled: true, parameters: {} }),
                parameters: {
                    ...(prev[groupName]?.parameters || {}),
                    [paramName]: {
                        ...(prev[groupName]?.parameters?.[paramName] || { subEnabled: {} }),
                        enabled,
                    },
                },
            },
        }));
    };

    const toggleSub = (groupName, paramName, subName, enabled) => {
        setParamSelection((prev) => ({
            ...prev,
            [groupName]: {
                ...(prev[groupName] || { enabled: true, parameters: {} }),
                parameters: {
                    ...(prev[groupName]?.parameters || {}),
                    [paramName]: {
                        ...(prev[groupName]?.parameters?.[paramName] || { enabled: true, subEnabled: {} }),
                        subEnabled: {
                            ...(prev[groupName]?.parameters?.[paramName]?.subEnabled || {}),
                            [subName]: enabled,
                        },
                    },
                },
            },
        }));
    };

    const setAllSubs = (groupName, paramName, enabled) => {
        const group = paramBlueprint?.groups?.find((g) => g.name === groupName);
        const param = group?.parameters?.find((p) => p.name === paramName);
        const subList = Array.isArray(param?.subparameters) ? param.subparameters : [];

        setParamSelection((prev) => {
            const cur =
                prev?.[groupName]?.parameters?.[paramName] || { enabled: true, subEnabled: {} };
            const nextSubEnabled = { ...(cur.subEnabled || {}) };
            for (const s of subList) nextSubEnabled[s] = enabled;

            return {
                ...prev,
                [groupName]: {
                    ...(prev[groupName] || { enabled: true, parameters: {} }),
                    parameters: {
                        ...(prev[groupName]?.parameters || {}),
                        [paramName]: {
                            ...cur,
                            subEnabled: nextSubEnabled,
                        },
                    },
                },
            };
        });
    };

    const addManualParameter = (groupName) => {
        const raw = manualParamInput[groupName] || "";
        const name = raw.trim();
        if (!name) return;

        setParamBlueprint((prev) => {
            const groups = Array.isArray(prev?.groups) ? [...prev.groups] : [];
            const gi = groups.findIndex((g) => g.name === groupName);
            if (gi < 0) return prev;

            const g = { ...groups[gi] };
            const parameters = Array.isArray(g.parameters) ? [...g.parameters] : [];
            parameters.push({ name, subparameters: [] });
            g.parameters = parameters;
            groups[gi] = g;
            return { groups };
        });

        setParamSelection((prev) => ({
            ...prev,
            [groupName]: {
                ...(prev[groupName] || { enabled: true, parameters: {} }),
                parameters: {
                    ...(prev[groupName]?.parameters || {}),
                    [name]: { enabled: true, subEnabled: {} },
                },
            },
        }));

        setManualParamInput((prev) => ({ ...prev, [groupName]: "" }));
    };

    const addManualSubparameter = (groupName, paramName) => {
        const key = `${groupName}|${paramName}`;
        const raw = manualSubInput[key] || "";
        const sub = raw.trim();
        if (!sub) return;

        setParamBlueprint((prev) => {
            const groups = Array.isArray(prev?.groups) ? [...prev.groups] : [];
            const gi = groups.findIndex((g) => g.name === groupName);
            if (gi < 0) return prev;

            const g = { ...groups[gi] };
            const parameters = Array.isArray(g.parameters) ? [...g.parameters] : [];
            const pi = parameters.findIndex((p) => p.name === paramName);
            if (pi < 0) return prev;

            const p = { ...parameters[pi] };
            const subs = Array.isArray(p.subparameters) ? [...p.subparameters] : [];
            subs.push(sub);
            p.subparameters = subs;
            parameters[pi] = p;
            g.parameters = parameters;
            groups[gi] = g;
            return { groups };
        });

        // new sub defaults to NOT selected
        setParamSelection((prev) => ({
            ...prev,
            [groupName]: {
                ...(prev[groupName] || { enabled: true, parameters: {} }),
                parameters: {
                    ...(prev[groupName]?.parameters || {}),
                    [paramName]: {
                        ...(prev[groupName]?.parameters?.[paramName] || {
                            enabled: true,
                            subEnabled: {},
                        }),
                        subEnabled: {
                            ...(prev[groupName]?.parameters?.[paramName]?.subEnabled || {}),
                            [sub]: false,
                        },
                    },
                },
            },
        }));

        setManualSubInput((prev) => ({ ...prev, [key]: "" }));
    };

    const handleSaveParameters = () => {
        const selected = buildSelectedBlueprint(paramBlueprint, paramSelection);
        if (!selected.length) {
            alert("Please select at least one parameter.");
            return;
        }
        setSavedSelectedBlueprint(selected);
        setParamModalOpen(false);
    };

    /* -----------------------------
       Script generation
    ----------------------------- */

    const handleGenerateScript = async () => {
        if (!candidate || !job) {
            alert("Candidate or job details are missing. Please reload.");
            return;
        }

        if (form.interviewerType === "AI") {
            if (!savedSelectedBlueprint || !savedSelectedBlueprint.length) {
                alert("Please configure and save interview parameters first.");
                setParamModalOpen(true);
                return;
            }
        }

        setIsGeneratingScript(true);
        setForm((prev) => ({ ...prev, technicalScript: "" }));

        try {
            const payload = {
                roundType: "First screening round",
                interviewType: form.interviewType || "Technical",
                difficultyLevel: form.difficultyLevel || "Intermediate",
                scriptStyle: form.scriptStyle || "Compact",
                durationMinutes: Number(form.durationMinutes || 45),
                selectedBlueprint: savedSelectedBlueprint || [],
                candidate: {
                    firstName: candidate.firstName,
                    lastName: candidate.lastName,
                    email: candidate.email,
                    experience: candidate.experience,
                    skills: candidate.skills,
                },
                job: {
                    title: job.title,
                    internalTitle: job.internalTitle,
                    jobType: job.jobType,
                    location:
                        job.location || (Array.isArray(job.locations) ? job.locations[0] : null),
                    companyName: job.company?.name || job.company,
                    primarySkills: job.primarySkills,
                    description: job.description,
                },
            };

            const res = await fetchData("/api/ai/generateTechnicalScript", {
                method: "POST",
                body: payload,
            });

            if (!res?.ok || !res?.script) {
                alert("Script generation failed. Please try again.");
                return;
            }

            setForm((prev) => ({ ...prev, technicalScript: res.script }));
        } catch (err) {
            console.error("[SCRIPT] Error:", err);
            alert("Failed to generate interview script. Check console.");
        } finally {
            setIsGeneratingScript(false);
        }
    };

    const handleGenerateCodingProblem = async () => {
        setIsGeneratingCodingProblem(true);
        try {
            const rawCount = Number(codingConfig.testCases);
            const normalizedCount = Number.isFinite(rawCount) && rawCount > 0 ? Math.floor(rawCount) : 4;
            if (normalizedCount !== rawCount) {
                setCodingConfig((prev) => ({ ...prev, testCases: normalizedCount }));
            }

            const questionType = codingConfig.type || "DSA";
            const isPdfType = String(questionType).toLowerCase().includes("pdf");
            const pdfFingerprint = buildPdfFingerprint(codingPdfFile);
            let pdfText = "";

            if (isPdfType) {
                if (!codingPdfFile) {
                    alert("Upload a PDF before generating the coding problem.");
                    return false;
                }

                if (!codingPdfText || codingPdfFingerprint !== pdfFingerprint) {
                    const formData = new FormData();
                    formData.append("pdf", codingPdfFile, codingPdfFile.name || "document.pdf");

                    let extractRes;
                    try {
                        extractRes = await fetchData("/api/ai/extractPdfText", {
                            method: "POST",
                            body: formData,
                        });
                    } catch (err) {
                        console.error("[CODING] Failed to extract PDF text:", err);
                        alert("Failed to parse the PDF. Please try a different file.");
                        return false;
                    }

                    if (!extractRes?.ok || !extractRes?.text) {
                        alert("Failed to parse the PDF. Please try a different file.");
                        return false;
                    }

                    pdfText = extractRes.text;
                    setCodingPdfText(pdfText);
                    setCodingPdfFingerprint(pdfFingerprint);
                } else {
                    pdfText = codingPdfText;
                }

                if (!String(pdfText || "").trim()) {
                    alert("PDF text is empty. Please upload a different file.");
                    return false;
                }
            }

            const payload = {
                questionType,
                difficultyLevel: codingConfig.level || "Medium",
                testCaseCount: normalizedCount,
                job: job
                    ? {
                        title: job.title,
                        internalTitle: job.internalTitle,
                        primarySkills: job.primarySkills,
                        description: job.description,
                    }
                    : null,
                ...(pdfText ? { pdfText } : {}),
            };

            const res = await fetchData("/api/ai/generateCodingProblem", {
                method: "POST",
                body: payload,
            });

            if (!res?.ok || !res?.problem) {
                alert("Failed to generate coding problem. Please try again.");
                return false;
            }

            const prob = res.problem || {};
            setCodingRoundData({
                title: prob.title || "",
                description: prob.description || "",
                constraints: Array.isArray(prob.constraints) ? prob.constraints : [],
                signature: prob.signature, // JSON Harness signature
                examples: Array.isArray(prob.examples) ? prob.examples : [],
                testCases: Array.isArray(prob.testCases) ? prob.testCases : [],
            });
            setCodingRoundMeta({
                questionType,
                pdfFingerprint: isPdfType ? pdfFingerprint : "",
                testCaseCount: normalizedCount,
            });
            setActiveTestCase(0);
            setIsEditingCodingRound(false);
            setShowFullProblemDesc(false);
            return true;
        } catch (err) {
            console.error("[CODING] Error generating problem:", err);
            alert("Failed to generate coding problem. Check console.");
            return false;
        } finally {
            setIsGeneratingCodingProblem(false);
        }
    };

    const handleCancelCodingModal = () => {
        const snapshot = codingModalSnapshotRef.current;
        if (snapshot) {
            setCodingConfig(snapshot.codingConfig);
            setCodingPdfFile(snapshot.codingPdfFile);
            setCodingPdfText(snapshot.codingPdfText || "");
            setCodingPdfFingerprint(snapshot.codingPdfFingerprint || "");
        }
        setCodingModalOpen(false);
    };

    const handleGenerateCodingProblemFromModal = async () => {
        const ok = await handleGenerateCodingProblem();
        if (ok) {
            setCodingModalOpen(false);
        }
    };

    /* -----------------------------
       Submit
    ----------------------------- */

    const handleSubmit = async () => {
        const availableLanguageIdSet = new Set(normalizeAllowedLanguageIds(availableLanguages));
        const normalizedAllowedLanguages = normalizeAllowedLanguageIds(
            codingConfig.allowedLanguages,
            availableLanguageIdSet
        );

        const baseSelection = (selectedCandidates || []).length
            ? selectedCandidates
            : [{ candidate, job, ats: ats || { _id: atsid } }];
        const scheduleTargets = baseSelection
            .map((item) => ({
                atsId: item?.ats?._id || atsid,
                candidateId: item?.candidate?._id,
                jobId: item?.job?._id || job?._id,
                label:
                    `${item?.candidate?.firstName || ""} ${item?.candidate?.lastName || ""}`.trim() ||
                    item?.candidate?.email ||
                    "Candidate",
            }))
            .filter((t) => /^[0-9a-fA-F]{24}$/.test(String(t.atsId)));

        if (!scheduleTargets.length) {
            alert("Missing ATS id (atsid). Cannot schedule.");
            return;
        }

        if (form.interviewMode === "Onsite" && !form.locationAddress.trim()) {
            alert("Address is required for Onsite.");
            return;
        }
        if (form.interviewMode === "Phone" && !form.meetingLink.trim()) {
            alert("Dial/meeting link is required for Phone interviews.");
            return;
        }
        if (!form.interviewDate || !form.startTime) {
            alert("Date and Start Time are required.");
            return;
        }
        if (anyConflict) {
            alert("Selected time overlaps with an interviewer’s schedule.");
            return;
        }
        if (
            (form.interviewerType === "Human" || form.interviewerType === "Human+AI") &&
            (!form.interviewers || form.interviewers.length === 0)
        ) {
            alert("Select at least one interviewer for Human or Human + AI.");
            return;
        }

        // Validate AI parameters only for Speaking rounds
        if (
            isSpeakingRound &&
            form.interviewerType === "AI" &&
            (!savedSelectedBlueprint || !savedSelectedBlueprint.length)
        ) {
            alert("Save interview parameters before scheduling.");
            setParamModalOpen(true);
            return;
        }

        // Validate script only for Speaking rounds
        if (
            isSpeakingRound &&
            form.interviewerType !== "Human" &&
            !form.technicalScript.trim()
        ) {
            const ok = window.confirm("Interview script is empty. Continue anyway?");
            if (!ok) return;
        }

        if (isCodingRound) {
            const rawDesired = Number(codingConfig.testCases || 0);
            const desiredCount = Number.isFinite(rawDesired) && rawDesired > 0 ? Math.floor(rawDesired) : 0;
            const actualCount = Array.isArray(codingRoundData.testCases)
                ? codingRoundData.testCases.length
                : 0;
            if (!codingRoundData.title || !codingRoundData.description || actualCount === 0) {
                alert("Generate the coding problem and test cases before scheduling.");
                return;
            }
            if (desiredCount && actualCount !== desiredCount) {
                alert("Test case count changed. Generate the problem again to match the selected count.");
                return;
            }

            const isPdfType = String(codingConfig.type || "").toLowerCase().includes("pdf");
            if (isPdfType) {
                if (!codingPdfFile) {
                    alert("Upload a PDF before scheduling this coding interview.");
                    return;
                }
                const currentPdfFingerprint = buildPdfFingerprint(codingPdfFile);
                if (
                    codingRoundMeta.questionType !== codingConfig.type ||
                    codingRoundMeta.pdfFingerprint !== currentPdfFingerprint
                ) {
                    alert("Generate the coding problem from the uploaded PDF before scheduling.");
                    return;
                }
            }
        }

        try {
            const failures = [];
            for (const target of scheduleTargets) {
                const payload = {
                    candidateATS: target.atsId,
                    candidate: target.candidateId,
                    job: target.jobId,
                    interviewMode: form.interviewMode,
                    locationAddress: form.interviewMode === "Onsite" ? form.locationAddress : null,
                    meetingLink: form.interviewMode === "Virtual" ? null : form.meetingLink,
                    interviewDate: form.interviewDate,
                    startTime: form.startTime,
                    durationMinutes: Number(form.durationMinutes || 45),
                    timezone: form.timezone,
                    interviewerType: form.interviewerType || "AI",
                    interviewType: form.interviewType || "Technical",

                    // Round type configuration
                    roundType: isCodingRound ? "Coding" : "Speaking",

                    // Coding round configuration (only when coding is selected)
                    ...(isCodingRound && {
                        codingConfig: {
                            questionLevel: codingConfig.level,
                            averageTestCases: codingConfig.testCases,
                            questionType: codingConfig.type,
                            allowedLanguages: normalizedAllowedLanguages
                        }
                    }),

                    // Speaking round fields (only when speaking is selected)
                    ...(isSpeakingRound && {
                        difficultyLevel: form.difficultyLevel || "Intermediate",
                        scriptStyle: form.scriptStyle || "Compact",
                        selectedBlueprint: savedSelectedBlueprint || [],
                    }),

                    notes: form.notes,
                    interviewers: form.interviewers,
                    technicalScript: isSpeakingRound ? form.technicalScript : "",
                };

                try {
                    const createdInterview = await fetchData(`/api/interviewschedules`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(payload),
                    });

                    if (payload.interviewMode === "Virtual") {
                        setAuthState((prev) => {
                            const user = prev?.user || {};
                            return {
                                ...prev,
                                user: {
                                    ...user,
                                    videoInterviewCount: (user.videoInterviewCount || 0) + 1
                                }
                            };
                        });
                    }

                    // If Coding Round, create Problem and Test Cases using CodeJudge APIs
                    if (isCodingRound && createdInterview?._id) {
                        try {
                            // 1. Create Problem
                            const problemPayload = {
                                title: codingRoundData.title || "Coding Problem",
                                description: codingRoundData.description || "No description provided",
                                difficulty: (codingConfig.level || 'medium').toLowerCase(),
                                constraints: Array.isArray(codingRoundData.constraints)
                                    ? codingRoundData.constraints.join('\n')
                                    : (codingRoundData.constraints || ""),
                                signature: codingRoundData.signature, // JSON Harness signature
                                timeLimit: 2000, // Default
                                memoryLimit: 256000, // Default
                                allowedLanguages: normalizedAllowedLanguages
                            };

                            const problemRes = await fetchData(`/api/codejudge/interviews/${createdInterview._id}/problems`, {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify(problemPayload)
                            });

                            // 2. Create Test Cases
                            if (problemRes?.problemId && codingRoundData.testCases?.length > 0) {
                                const testCasesPayload = {
                                    testCases: codingRoundData.testCases.map((tc, idx) => ({
                                        input: tc.input || "",
                                        expectedOutput: tc.expected || tc.expectedOutput || "",
                                        args: tc.args,
                                        expected: tc.expected,
                                        isSample: true,
                                        order: idx + 1,
                                        weight: 1
                                    }))
                                };

                                await fetchData(`/api/codejudge/problems/${problemRes.problemId}/testcases`, {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify(testCasesPayload)
                                });
                            }
                        } catch (cjErr) {
                            console.error("Failed to create coding round data:", cjErr);
                            // We don't fail the whole schedule if just coding data fails, but maybe we should warn?
                            failures.push({
                                label: target.label,
                                message: `Interview scheduled but coding data failed: ${cjErr.message}`
                            });
                        }
                    }

                } catch (err) {
                    const errorMsg =
                        err?.error ||
                        err?.message ||
                        "Unknown error";
                    failures.push({
                        label: target.label,
                        message: errorMsg,
                    });
                }
            }

            if (failures.length) {
                const failureMsg = failures
                    .map((f) => `${f.label}: ${f.message}`)
                    .join("; ");
                alert(
                    `Scheduled ${scheduleTargets.length - failures.length} of ${scheduleTargets.length} interviews. ` +
                    `Failures: ${failureMsg}`
                );
                setInterviewState((prev) => ({
                    ...prev,
                    interviewListRefreshToken: Date.now(),
                }));
                return;
            }

            resetForm();
            setInterviewState((prev) => ({
                ...prev,
                interviewListRefreshToken: Date.now(),
            }));
            navigate("/interviews");
        } catch (err) {
            console.error("Failed to schedule interview:", err);
            const errorMsg = err?.error || err?.message || "Unknown error";
            alert(`Failed to schedule interview: ${errorMsg}`);
        }
    };

    const hasLoadedCandidates = (selectedCandidates || []).length > 0 || candidate;
    const hasMultipleCandidates = (selectedCandidates || []).length > 1;

    if (!hasLoadedCandidates) {
        return (
            <MUICenterLayout>
                <Typography>Loading candidate data...</Typography>
            </MUICenterLayout>
        );
    }

    const buildStageRows = (atsDoc) => {
        const raw = Array.isArray(atsDoc?.stageResults) ? [...atsDoc.stageResults] : [];
        raw.sort((a, b) => {
            const aTime = a?.stage?.createdAt ? new Date(a.stage.createdAt).getTime() : 0;
            const bTime = b?.stage?.createdAt ? new Date(b.stage.createdAt).getTime() : 0;
            return aTime - bTime;
        });

        return raw.map((sr) => ({
            title: sr?.stage?.title || "Stage",
            status: sr?.stageStatus || "Not Initiated",
        }));
    };

    const stageRows = buildStageRows(ats);

    const colorFor = (status) => {
        switch (status) {
            case "Completed":
                return theme.palette.success.main;
            case "Not Initiated":
                return theme.palette.warning.main;
            case "Rejected":
                return theme.palette.error.main;
            case "On Hold":
                return theme.palette.info.main;
            case "Not Applicable":
                return theme.palette.grey[600];
            case "Selected":
                return theme.palette.success.main;
            default:
                return theme.palette.text.secondary;
        }
    };

    const iconFor = (status) => {
        switch (status) {
            case "Completed":
                return <CheckCircleOutlineIcon />;
            case "Not Initiated":
                return <HourglassEmptyIcon />;
            case "Rejected":
                return <CancelOutlinedIcon />;
            case "On Hold":
                return <PauseCircleOutlineIcon />;
            case "Not Applicable":
                return <BlockOutlinedIcon />;
            case "Selected":
                return <CheckCircleOutlineIcon />;
            default:
                return <RadioButtonUncheckedIcon />;
        }
    };

    const makeStepIcon = (status) => () => (
        <Box sx={{ color: colorFor(status), display: "flex", alignItems: "center" }}>
            {iconFor(status)}
        </Box>
    );

    const getEffectiveActive = (rows) => {
        const activeStep = Math.max(
            0,
            (rows || []).findIndex((s) => s.status !== "Completed")
        );
        return activeStep === -1 ? Math.max(0, (rows || []).length - 1) : activeStep;
    };

    const effectiveActive = getEffectiveActive(stageRows);

    const progressItems = (selectedCandidates || []).map((item) => {
        const rows = buildStageRows(item?.ats);
        return {
            ...item,
            stageRows: rows,
            effectiveActive: getEffectiveActive(rows),
        };
    });



    return (
        <Box
            sx={{
                backgroundColor: theme.palette.background.default,
                minHeight: "100vh",
                p: 3,
            }}
        >
            {/* HEADER */}
            <Box
                sx={{
                    background: isDark
                        ? "linear-gradient(90deg, #0d47a1 0%, #0a3170 100%)"
                        : "linear-gradient(90deg, #1976d2 0%, #1565c0 100%)",
                    color: theme.palette.primary.contrastText,
                    borderRadius: 2,
                    p: { xs: 2.5, sm: 3 },
                    mb: 3,
                    textAlign: "center",
                    boxShadow: 3,
                }}
            >
                <Typography
                    variant="h5"
                    sx={{ fontWeight: 600, letterSpacing: 0.5 }}
                >
                    Interview Schedule
                </Typography>
                <Typography variant="body2" sx={{ opacity: 0.9 }}>
                    Manage and plan candidate interviews efficiently
                </Typography>
            </Box>

            {/* CANDIDATE CARD */}
            <Card
                sx={{
                    mb: 3,
                    borderRadius: 2,
                    boxShadow: 5,
                    background: theme.palette.background.paper,
                }}
            >
                <CardContent>
                    <Typography
                        variant="h6"
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 1,
                            mb: 2,
                        }}
                    >
                        <PersonIcon color="primary" /> Candidate Details
                        {hasMultipleCandidates ? ` (${selectedCandidates.length})` : ""}
                    </Typography>
                    <Divider sx={{ mb: 3 }} />

                    {hasMultipleCandidates ? (
                        <Grid container spacing={2} sx={{ px: 1.5 }}>
                            {(selectedCandidates || []).map((item, idx) => {
                                const cand = item?.candidate || {};
                                return (
                                    <Grid item xs={12} sm={6} md={4} key={cand?._id || idx}>
                                        <Box
                                            sx={{
                                                p: 2,
                                                borderRadius: 2,
                                                border: "1px solid",
                                                borderColor: "divider",
                                            }}
                                        >
                                            <Typography>
                                                <strong>Name:</strong>{" "}
                                                {`${cand.firstName || ""} ${cand.lastName || ""}`.trim() ||
                                                    cand.email ||
                                                    "Candidate"}
                                            </Typography>
                                            <Typography>
                                                <strong>Email:</strong> {cand.email || "N/A"}
                                            </Typography>
                                            <Typography>
                                                <strong>Phone:</strong>{" "}
                                                {cand.phone || cand.phoneNumber || "N/A"}
                                            </Typography>
                                        </Box>
                                    </Grid>
                                );
                            })}
                        </Grid>
                    ) : (
                        <Grid container spacing={2} sx={{ px: 1.5 }}>
                            <Grid item xs={12} sm={4}>
                                <Typography>
                                    <strong>Name:</strong> {candidate.firstName}{" "}
                                    {candidate.lastName}
                                </Typography>
                                <Typography>
                                    <strong>Email:</strong> {candidate.email}
                                </Typography>
                                <Typography>
                                    <strong>Phone:</strong>{" "}
                                    {candidate.phone ||
                                        candidate.phoneNumber ||
                                        "N/A"}
                                </Typography>
                            </Grid>
                            <Grid item xs={12} sm={4}>
                                <Typography>
                                    <strong>Created At:</strong>{" "}
                                    {candidate.createdAt
                                        ? new Date(
                                            candidate.createdAt
                                        ).toLocaleString("en-IN", {
                                            day: "2-digit",
                                            month: "short",
                                            year: "numeric",
                                            hour: "2-digit",
                                            minute: "2-digit",
                                        })
                                        : "N/A"}
                                </Typography>
                                <Typography>
                                    <strong>Experience:</strong>{" "}
                                    {candidate.experience || "N/A"}
                                </Typography>
                                <Typography>
                                    <strong>Status:</strong> Active
                                </Typography>
                            </Grid>
                            <Grid item xs={12} sm={4}>
                                <Typography>
                                    <strong>Resume:</strong>{" "}
                                    {candidate.resumeUrl ? (
                                        <a
                                            href={candidate.resumeUrl}
                                            target="_blank"
                                            rel="noreferrer"
                                            style={{
                                                color: theme.palette.primary.main,
                                                textDecoration: "underline",
                                            }}
                                        >
                                            View PDF
                                        </a>
                                    ) : (
                                        "N/A"
                                    )}
                                </Typography>
                                <Typography>
                                    <strong>Skills:</strong>{" "}
                                    {candidate.skills
                                        ? candidate.skills
                                            .map((s) => Object.keys(s)[0])
                                            .join(", ")
                                        : "N/A"}
                                </Typography>
                            </Grid>
                        </Grid>
                    )}
                </CardContent>
            </Card>

            {/* JOB DETAILS */}
            {job && (
                <Card
                    sx={{
                        mb: 3,
                        borderRadius: 2,
                        boxShadow: 5,
                        background: theme.palette.background.paper,
                    }}
                >
                    <CardContent>
                        <Typography
                            variant="h6"
                            sx={{
                                display: "flex",
                                alignItems: "center",
                                gap: 1,
                                mb: 2,
                            }}
                        >
                            <WorkIcon color="primary" /> Job Details
                        </Typography>
                        <Divider sx={{ mb: 3 }} />

                        <Grid container spacing={2} sx={{ px: 1.5 }}>
                            <Grid item xs={12} sm={4}>
                                <Typography>
                                    <strong>Title:</strong>{" "}
                                    {job.title || "N/A"}
                                </Typography>
                                <Typography>
                                    <strong>Company:</strong>{" "}
                                    {job.company?.name ||
                                        job.company ||
                                        "N/A"}
                                </Typography>
                                <Typography>
                                    <strong>Posted On:</strong>{" "}
                                    {job.postedOn
                                        ? new Date(
                                            job.postedOn
                                        ).toLocaleDateString("en-IN", {
                                            day: "2-digit",
                                            month: "short",
                                            year: "numeric",
                                        })
                                        : "N/A"}
                                </Typography>
                            </Grid>

                            <Grid item xs={12} sm={4}>
                                <Typography>
                                    <strong>Job Type:</strong>{" "}
                                    {job.jobType || "N/A"}
                                </Typography>
                                <Typography>
                                    <strong>Location:</strong>{" "}
                                    {job.location ||
                                        job.locations?.[0] ||
                                        "N/A"}
                                </Typography>
                                <Typography>
                                    <strong>Status:</strong>{" "}
                                    {job.status || "N/A"}
                                </Typography>
                            </Grid>

                            <Grid item xs={12} sm={4}>
                                <Typography>
                                    <strong>Description:</strong>{" "}
                                    {job.description ? (
                                        <>
                                            <span
                                                style={{
                                                    color: theme.palette
                                                        .text.primary,
                                                }}
                                            >
                                                {showFullDesc
                                                    ? job.description
                                                    : job.description.slice(
                                                        0,
                                                        150
                                                    ) +
                                                    (job.description.length >
                                                        150
                                                        ? "..."
                                                        : "")}
                                            </span>
                                            {job.description.length > 100 && (
                                                <Typography
                                                    component="span"
                                                    onClick={() =>
                                                        setShowFullDesc(
                                                            !showFullDesc
                                                        )
                                                    }
                                                    sx={{
                                                        color: theme.palette
                                                            .primary.main,
                                                        cursor: "pointer",
                                                        ml: 1,
                                                        fontWeight: 500,
                                                    }}
                                                >
                                                    {showFullDesc
                                                        ? "Show Less"
                                                        : "Show More"}
                                                </Typography>
                                            )}
                                        </>
                                    ) : (
                                        "N/A"
                                    )}
                                </Typography>
                            </Grid>
                        </Grid>
                    </CardContent>
                </Card>
            )}

            {/* PROGRESS */}
            <Card
                sx={{
                    mb: 3,
                    borderRadius: 2,
                    boxShadow: 5,
                    background: theme.palette.background.paper,
                }}
            >
                <CardContent sx={{ py: 4 }}>
                    <Typography
                        variant="h6"
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 1,
                            mb: 3,
                            color: theme.palette.primary.main,
                            fontWeight: 600,
                        }}
                    >
                        <TimelineIcon color="primary" /> Candidate Progress
                    </Typography>

                    {hasMultipleCandidates ? (
                        <Stack spacing={2}>
                            {progressItems.length === 0 ? (
                                <Typography variant="body2" color="text.secondary">
                                    No stages found.
                                </Typography>
                            ) : (
                                progressItems.map((item, idx) => {
                                    const cand = item?.candidate || {};
                                    const rows = item?.stageRows || [];
                                    const active = item?.effectiveActive ?? 0;
                                    const current = rows[active];
                                    const label =
                                        `${cand.firstName || ""} ${cand.lastName || ""}`.trim() ||
                                        cand.email ||
                                        `Candidate ${idx + 1}`;

                                    return (
                                        <Accordion key={cand?._id || idx} defaultExpanded>
                                            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                                                <Box
                                                    sx={{
                                                        display: "flex",
                                                        alignItems: "center",
                                                        gap: 1,
                                                        flexWrap: "wrap",
                                                    }}
                                                >
                                                    <Typography sx={{ fontWeight: 600 }}>
                                                        {label}
                                                    </Typography>
                                                    {current && (
                                                        <Chip
                                                            size="small"
                                                            label={`${current.title} (${current.status})`}
                                                            sx={{
                                                                borderRadius: 999,
                                                                fontWeight: 600,
                                                                backgroundColor: "rgba(25, 118, 210, 0.08)",
                                                            }}
                                                        />
                                                    )}
                                                </Box>
                                            </AccordionSummary>
                                            <AccordionDetails>
                                                {rows.length === 0 ? (
                                                    <Typography variant="body2" color="text.secondary">
                                                        No stages found.
                                                    </Typography>
                                                ) : (
                                                    <Stepper
                                                        activeStep={active}
                                                        alternativeLabel
                                                        sx={{
                                                            "& .MuiStepConnector-line": {
                                                                borderColor: theme.palette.primary.light,
                                                                borderTopWidth: 3,
                                                            },
                                                        }}
                                                    >
                                                        {rows.map((row, sIdx) => (
                                                            <Step key={sIdx}>
                                                                <StepLabel
                                                                    StepIconComponent={makeStepIcon(
                                                                        row.status
                                                                    )}
                                                                    sx={{
                                                                        "& .MuiStepLabel-label": {
                                                                            color: colorFor(row.status),
                                                                            fontWeight: 600,
                                                                        },
                                                                    }}
                                                                >
                                                                    {row.title}
                                                                </StepLabel>
                                                            </Step>
                                                        ))}
                                                    </Stepper>
                                                )}

                                                {rows.length > 0 && (
                                                    <Box sx={{ mt: 3, textAlign: "center" }}>
                                                        <Typography variant="body2" color="text.secondary">
                                                            Current stage:{" "}
                                                            <strong
                                                                style={{
                                                                    color: colorFor(current?.status),
                                                                }}
                                                            >
                                                                {current?.title} ({current?.status})
                                                            </strong>
                                                        </Typography>
                                                    </Box>
                                                )}
                                            </AccordionDetails>
                                        </Accordion>
                                    );
                                })
                            )}
                        </Stack>
                    ) : (
                        <>
                            {stageRows.length === 0 ? (
                                <Typography variant="body2" color="text.secondary">
                                    No stages found.
                                </Typography>
                            ) : (
                                <Stepper
                                    activeStep={effectiveActive}
                                    alternativeLabel
                                    sx={{
                                        "& .MuiStepConnector-line": {
                                            borderColor: theme.palette.primary.light,
                                            borderTopWidth: 3,
                                        },
                                    }}
                                >
                                    {stageRows.map((row, idx) => (
                                        <Step key={idx}>
                                            <StepLabel
                                                StepIconComponent={makeStepIcon(
                                                    row.status
                                                )}
                                                sx={{
                                                    "& .MuiStepLabel-label": {
                                                        color: colorFor(row.status),
                                                        fontWeight: 600,
                                                    },
                                                }}
                                            >
                                                {row.title}
                                            </StepLabel>
                                        </Step>
                                    ))}
                                </Stepper>
                            )}

                            {stageRows.length > 0 && (
                                <Box sx={{ mt: 3, textAlign: "center" }}>
                                    <Typography
                                        variant="body2"
                                        color="text.secondary"
                                    >
                                        Current stage:{" "}
                                        <strong
                                            style={{
                                                color: colorFor(
                                                    stageRows[effectiveActive]?.status
                                                ),
                                            }}
                                        >
                                            {stageRows[effectiveActive]?.title} (
                                            {stageRows[effectiveActive]?.status})
                                        </strong>
                                    </Typography>
                                </Box>
                            )}
                        </>
                    )}
                </CardContent>
            </Card>

            {/* SCHEDULER FORM */}
            <Card
                sx={{
                    mb: 3,
                    borderRadius: 2,
                    boxShadow: 6,
                    background: theme.palette.background.paper,
                }}
            >
                <CardContent sx={{ p: { xs: 2, sm: 4 } }}>
                    <Typography
                        variant="h6"
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 1,
                            color: theme.palette.primary.main,
                            fontWeight: 600,
                            mb: 2,
                        }}
                    >
                        <EventAvailableIcon /> Interview Scheduler
                    </Typography>
                    <Divider sx={{ mb: 3 }} />

                    <Grid container spacing={2} alignItems="center">
                        <Grid item xs={12} md={2}>
                            <FormControl fullWidth>
                                <InputLabel>Interview Type</InputLabel>
                                <Select
                                    value={form.interviewMode}
                                    label="Interview Type"
                                    onChange={(e) =>
                                        setForm((v) => ({
                                            ...v,
                                            interviewMode: e.target.value,
                                        }))
                                    }
                                >
                                    <MenuItem value="Virtual">Virtual</MenuItem>
                                    <MenuItem value="Onsite">Onsite</MenuItem>
                                    <MenuItem value="Phone">Phone</MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>

                        <Grid item xs={12} md={3}>
                            {form.interviewMode === "Onsite" ? (
                                <TextField
                                    fullWidth
                                    label="Location (Address)"
                                    value={form.locationAddress}
                                    onChange={(e) =>
                                        setForm((v) => ({
                                            ...v,
                                            locationAddress: e.target.value,
                                        }))
                                    }
                                />
                            ) : form.interviewMode === "Phone" ? (
                                <TextField
                                    fullWidth
                                    label="Dial / Meeting Link"
                                    value={form.meetingLink}
                                    onChange={(e) =>
                                        setForm((v) => ({
                                            ...v,
                                            meetingLink: e.target.value,
                                        }))
                                    }
                                />
                            ) : (
                                <TextField
                                    fullWidth
                                    label="Virtual interview link"
                                    value="Will be generated automatically (WebRTCAI)"
                                    InputProps={{ readOnly: true }}
                                />
                            )}
                        </Grid>

                        <Grid item xs={12} md={2}>
                            <TextField
                                fullWidth
                                type="date"
                                label="Date"
                                InputLabelProps={{ shrink: true }}
                                value={form.interviewDate}
                                onChange={(e) =>
                                    setForm((v) => ({
                                        ...v,
                                        interviewDate: e.target.value,
                                    }))
                                }
                            />
                        </Grid>

                        <Grid item xs={12} md={2}>
                            <TextField
                                fullWidth
                                type="time"
                                label="Start Time"
                                InputLabelProps={{ shrink: true }}
                                value={form.startTime}
                                onChange={(e) =>
                                    setForm((v) => ({
                                        ...v,
                                        startTime: e.target.value,
                                    }))
                                }
                            />
                        </Grid>

                        <Grid item xs={12} md={2}>
                            <TextField
                                fullWidth
                                type="number"
                                label="Duration (min)"
                                value={form.durationMinutes}
                                onChange={(e) =>
                                    setForm((v) => ({
                                        ...v,
                                        durationMinutes: e.target.value,
                                    }))
                                }
                            />
                        </Grid>

                        <Grid item xs={12} md={3}>
                            <FormControl fullWidth>
                                <InputLabel>Interviewer Type</InputLabel>
                                <Select
                                    value={form.interviewerType}
                                    label="Interviewer Type"
                                    onChange={(e) => {
                                        const value = e.target.value;
                                        setForm((v) => ({
                                            ...v,
                                            interviewerType: value,
                                            interviewers:
                                                value === "AI"
                                                    ? []
                                                    : v.interviewers,
                                        }));
                                    }}
                                >
                                    <MenuItem value="AI">AI interviewer</MenuItem>
                                    <MenuItem value="Human">
                                        Human interviewer(s)
                                    </MenuItem>
                                    <MenuItem value="Human+AI">
                                        Human + AI
                                    </MenuItem>
                                </Select>
                            </FormControl>
                        </Grid>

                        {form.interviewerType !== "AI" && (
                            <Grid item xs={12} md={9}>
                                <FormControl fullWidth>
                                    <InputLabel id="interviewer-select-label">
                                        Interviewers
                                    </InputLabel>
                                    <Select
                                        labelId="interviewer-select-label"
                                        multiple
                                        value={form.interviewers}
                                        onChange={handleInterviewerChange}
                                        label="Interviewers"
                                        displayEmpty
                                        renderValue={(selected) => {
                                            if (
                                                !Array.isArray(selected) ||
                                                selected.length === 0
                                            ) {
                                                return "Select interviewer(s)";
                                            }
                                            return selected
                                                .map(
                                                    (id) =>
                                                        interviewerLabelsById[id] || id
                                                )
                                                .join(", ");
                                        }}
                                    >
                                        {availableInterviewers.length ? (
                                            availableInterviewers.map(
                                                (interviewer) => {
                                                    const id = String(
                                                        interviewer._id
                                                    );
                                                    const label =
                                                        getInterviewerLabel(
                                                            interviewer
                                                        );
                                                    return (
                                                        <MenuItem
                                                            key={id}
                                                            value={id}
                                                        >
                                                            <Checkbox
                                                                checked={form.interviewers.includes(
                                                                    id
                                                                )}
                                                            />
                                                            <ListItemText
                                                                primary={label}
                                                                secondary={
                                                                    interviewer.email ||
                                                                    ""
                                                                }
                                                            />
                                                        </MenuItem>
                                                    );
                                                }
                                            )
                                        ) : (
                                            <MenuItem disabled>
                                                No interviewers available
                                            </MenuItem>
                                        )}
                                    </Select>
                                </FormControl>

                                {form.interviewers.length > 0 &&
                                    (!start || !end) && (
                                        <Typography
                                            variant="caption"
                                            color="text.secondary"
                                            sx={{
                                                mt: 0.5,
                                                display: "block",
                                            }}
                                        >
                                            Select date and start time to check
                                            interviewer availability.
                                        </Typography>
                                    )}

                                {form.interviewers.length > 0 &&
                                    start &&
                                    end &&
                                    anyConflict && (
                                        <Box sx={{ mt: 0.5 }}>
                                            {selectedInterviewers.map(
                                                (interviewer) => {
                                                    const conflict =
                                                        conflictInfoByInterviewer[interviewer.id];
                                                    if (!conflict) return null;
                                                    const windowText =
                                                        formatScheduleWindow(
                                                            conflict.startAt,
                                                            conflict.durationMinutes
                                                        );
                                                    return (
                                                        <Typography
                                                            key={interviewer.id}
                                                            variant="caption"
                                                            sx={{
                                                                display: "block",
                                                                color: theme
                                                                    .palette
                                                                    .error
                                                                    .main,
                                                            }}
                                                        >
                                                            {interviewer.name}
                                                            : Interviewer is
                                                            busy with another
                                                            interview
                                                            {windowText
                                                                ? ` (${windowText})`
                                                                : ""}
                                                            .
                                                        </Typography>
                                                    );
                                                }
                                            )}
                                        </Box>
                                    )}
                            </Grid>
                        )}

                        {form.interviewerType !== "AI" &&
                            form.interviewers.length > 0 && (
                                <Grid item xs={12}>
                                    <Box sx={{ mt: 2, width: "100%" }}>
                                        <Typography
                                            variant="subtitle1"
                                            sx={{
                                                fontWeight: 600,
                                                mb: 1,
                                                color: theme.palette.primary.main,
                                                textAlign: "left",
                                            }}
                                        >
                                            Selected Interviewer Schedules
                                        </Typography>

                                        {selectedScheduleGroups.map(
                                            ({ interviewer, schedules }) => (
                                                <Box
                                                    key={interviewer.id}
                                                    sx={{ mb: 2 }}
                                                >
                                                    <Typography
                                                        variant="subtitle2"
                                                        sx={{
                                                            fontWeight: 600,
                                                            mb: 1,
                                                        }}
                                                    >
                                                        {interviewer.name} (
                                                        {schedules.length})
                                                    </Typography>

                                                    {schedules.length ? (
                                                        <Grid
                                                            container
                                                            spacing={2}
                                                            justifyContent="flex-start"
                                                            alignItems="stretch"
                                                        >
                                                            {schedules.map(
                                                                (schedule) => {
                                                                    const windowText =
                                                                        formatScheduleWindow(
                                                                            schedule.startAt,
                                                                            schedule.durationMinutes
                                                                        );
                                                                    const candidateLabel =
                                                                        getCandidateLabel(
                                                                            schedule
                                                                        );
                                                                    const jobLabel =
                                                                        getJobLabel(
                                                                            schedule
                                                                        );
                                                                    const cardKey =
                                                                        schedule?._id ||
                                                                        schedule?.id ||
                                                                        `${interviewer.id}-${schedule?.startAt}`;

                                                                    return (
                                                                        <Grid
                                                                            item
                                                                            xs={
                                                                                12
                                                                            }
                                                                            md={
                                                                                6
                                                                            }
                                                                            lg={
                                                                                4
                                                                            }
                                                                            key={
                                                                                cardKey
                                                                            }
                                                                        >
                                                                            <Card
                                                                                variant="outlined"
                                                                                sx={{
                                                                                    height: "100%",
                                                                                }}
                                                                            >
                                                                                <CardContent>
                                                                                    <Typography
                                                                                        variant="subtitle2"
                                                                                        sx={{
                                                                                            fontWeight: 700,
                                                                                        }}
                                                                                    >
                                                                                        {candidateLabel}
                                                                                    </Typography>
                                                                                    <Typography
                                                                                        variant="body2"
                                                                                        color="text.secondary"
                                                                                    >
                                                                                        {jobLabel}
                                                                                    </Typography>
                                                                                    <Typography
                                                                                        variant="caption"
                                                                                        color="text.secondary"
                                                                                        sx={{
                                                                                            display: "block",
                                                                                            mt: 0.5,
                                                                                        }}
                                                                                    >
                                                                                        {windowText ||
                                                                                            "Time not set"}
                                                                                    </Typography>

                                                                                    <Stack
                                                                                        direction="row"
                                                                                        spacing={
                                                                                            1
                                                                                        }
                                                                                        useFlexGap
                                                                                        flexWrap="wrap"
                                                                                        sx={{
                                                                                            mt: 1,
                                                                                        }}
                                                                                    >
                                                                                        {schedule.interviewMode ? (
                                                                                            <Chip
                                                                                                size="small"
                                                                                                label={
                                                                                                    schedule.interviewMode
                                                                                                }
                                                                                                sx={{
                                                                                                    borderRadius:
                                                                                                        999,
                                                                                                }}
                                                                                            />
                                                                                        ) : null}
                                                                                        {schedule.roundType ? (
                                                                                            <Chip
                                                                                                size="small"
                                                                                                label={
                                                                                                    schedule.roundType
                                                                                                }
                                                                                                sx={{
                                                                                                    borderRadius:
                                                                                                        999,
                                                                                                }}
                                                                                            />
                                                                                        ) : null}
                                                                                        {schedule.interviewType ? (
                                                                                            <Chip
                                                                                                size="small"
                                                                                                label={
                                                                                                    schedule.interviewType
                                                                                                }
                                                                                                sx={{
                                                                                                    borderRadius:
                                                                                                        999,
                                                                                                }}
                                                                                            />
                                                                                        ) : null}
                                                                                    </Stack>
                                                                                </CardContent>
                                                                            </Card>
                                                                        </Grid>
                                                                    );
                                                                }
                                                            )}
                                                        </Grid>
                                                    ) : (
                                                        <Typography
                                                            variant="body2"
                                                            color="text.secondary"
                                                        >
                                                            No scheduled interviews.
                                                        </Typography>
                                                    )}
                                                </Box>
                                            )
                                        )}
                                    </Box>
                                </Grid>
                            )}

                        {/* Interview category */}
                        {form.interviewerType === "AI" && (
                            <>
                                <Grid item xs={12} md={3}>
                                    <FormControl fullWidth>
                                        <InputLabel>
                                            Interview Category
                                        </InputLabel>
                                        <Select
                                            value={form.interviewType}
                                            label="Interview Category"
                                            onChange={(e) => {
                                                const nextType = e.target.value;
                                                setForm((v) => ({
                                                    ...v,
                                                    interviewType: nextType,
                                                }));
                                                if (nextType === "Coding") {
                                                    setCodingModalOpen(true);
                                                } else {
                                                    setCodingModalOpen(false);
                                                }
                                            }}
                                        >
                                            <MenuItem value="Technical">
                                                Technical
                                            </MenuItem>
                                            <MenuItem value="HR">HR</MenuItem>
                                            <MenuItem value="Psychometric">
                                                Psychometric
                                            </MenuItem>
                                            <MenuItem value="Non-Technical">
                                                Non-Technical
                                            </MenuItem>
                                            <MenuItem value="Coding">
                                                Coding
                                            </MenuItem>
                                        </Select>
                                    </FormControl>
                                </Grid>

                                {isCodingRound && (
                                    <Grid item xs={12} md={3}>
                                        <MUIButton
                                            variant="outlined"
                                            onClick={() => setCodingModalOpen(true)}
                                            fullWidth
                                            sx={{ textTransform: "none", height: 56 }}
                                        >
                                            Configure Coding Problem
                                        </MUIButton>
                                    </Grid>
                                )}

                                {isSpeakingRound && (
                                    <>
                                        <Grid item xs={12} md={3}>
                                            <FormControl fullWidth>
                                                <InputLabel>
                                                    Difficulty Level
                                                </InputLabel>
                                                <Select
                                                    value={form.difficultyLevel}
                                                    label="Difficulty Level"
                                                    onChange={(e) =>
                                                        setForm((v) => ({
                                                            ...v,
                                                            difficultyLevel:
                                                                e.target.value,
                                                        }))
                                                    }
                                                >
                                                    <MenuItem value="Easy">
                                                        Easy
                                                    </MenuItem>
                                                    <MenuItem value="Intermediate">
                                                        Intermediate
                                                    </MenuItem>
                                                    <MenuItem value="Advanced">
                                                        Advanced
                                                    </MenuItem>
                                                </Select>
                                            </FormControl>
                                        </Grid>

                                        <Grid item xs={12} md={2}>
                                            <FormControl fullWidth>
                                                <InputLabel>Script Style</InputLabel>
                                                <Select
                                                    value={form.scriptStyle}
                                                    label="Script Style"
                                                    onChange={(e) =>
                                                        setForm((v) => ({
                                                            ...v,
                                                            scriptStyle:
                                                                e.target.value,
                                                        }))
                                                    }
                                                >
                                                    <MenuItem value="Compact">
                                                        Compact
                                                    </MenuItem>
                                                    <MenuItem value="Detailed">
                                                        Detailed
                                                    </MenuItem>
                                                </Select>
                                            </FormControl>
                                        </Grid>

                                        <Grid item xs={12} md={3}>
                                            <MUIButton
                                                variant={
                                                    savedSelectedBlueprint?.length
                                                        ? "contained"
                                                        : "outlined"
                                                }
                                                onClick={openParamModal}
                                                disabled={paramLoading}
                                                fullWidth
                                                size="small"
                                            >
                                                {paramLoading
                                                    ? "Loading Parameters..."
                                                    : savedSelectedBlueprint?.length
                                                        ? "Edit Parameters"
                                                        : "Configure Parameters"}
                                            </MUIButton>
                                        </Grid>
                                    </>
                                )}
                            </>
                        )}
                    </Grid>

                    {/* ROUND DETAILS */}
                    {form.interviewerType !== "Human" && (
                        <Box sx={{ mt: 4 }}>
                            <Divider sx={{ mb: 3 }} />

                            {isCodingRound && (
                                <Box sx={{ p: 2, border: "1px solid", borderColor: "divider", borderRadius: 2, mb: 3, bgcolor: isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.02)" }}>
                                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 2, mb: 2, flexWrap: "wrap" }}>
                                        <Typography variant="subtitle1" sx={{ display: "flex", alignItems: "center", gap: 1, fontWeight: 600 }}>
                                            <CodeIcon /> Coding Problem
                                        </Typography>
                                        <Box sx={{ display: "flex", gap: 1 }}>
                                            <MUIButton
                                                variant={isEditingCodingRound ? "contained" : "outlined"}
                                                color={isEditingCodingRound ? "success" : "primary"}
                                                onClick={() => setIsEditingCodingRound(!isEditingCodingRound)}
                                                size="small"
                                            >
                                                {isEditingCodingRound ? "Save Changes" : "Edit Problem"}
                                            </MUIButton>
                                        </Box>
                                    </Box>

                                    <Box sx={{ mb: 3 }}>
                                        <Typography variant="subtitle2" gutterBottom>Allowed Languages</Typography>
                                        <FormControl component="fieldset">
                                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                                                {availableLanguages.map((lang) => {
                                                    const langId = normalizeObjectId(lang?._id);
                                                    if (!langId) return null;
                                                    return (
                                                        <FormControlLabel
                                                            key={langId}
                                                            control={
                                                                <Checkbox
                                                                    checked={codingConfig.allowedLanguages.includes(langId)}
                                                                    onChange={(e) => {
                                                                        const checked = e.target.checked;
                                                                        setCodingConfig((prev) => {
                                                                            const current = normalizeAllowedLanguageIds(prev.allowedLanguages);
                                                                            const next = checked
                                                                                ? normalizeAllowedLanguageIds([...current, langId])
                                                                                : current.filter((id) => id !== langId);
                                                                            return { ...prev, allowedLanguages: next };
                                                                        });
                                                                    }}
                                                                />
                                                            }
                                                            label={lang.name}
                                                        />
                                                    );
                                                })}
                                            </Box>
                                        </FormControl>
                                    </Box>

                                    <Divider sx={{ mb: 3 }} />

                                    {isEditingCodingRound ? (
                                        <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                                            <TextField
                                                label="Problem Title"
                                                fullWidth
                                                value={codingRoundData.title}
                                                onChange={(e) => setCodingRoundData(prev => ({ ...prev, title: e.target.value }))}
                                            />
                                            <TextField
                                                label="Description"
                                                fullWidth
                                                multiline
                                                minRows={3}
                                                value={codingRoundData.description}
                                                onChange={(e) => setCodingRoundData(prev => ({ ...prev, description: e.target.value }))}
                                            />
                                            <TextField
                                                label="Constraints (one per line)"
                                                fullWidth
                                                multiline
                                                minRows={3}
                                                value={(codingRoundData.constraints || []).join("\n")}
                                                onChange={(e) => setCodingRoundData(prev => ({ ...prev, constraints: e.target.value.split("\n") }))}
                                            />

                                            <Typography variant="subtitle2" sx={{ fontWeight: 700, mt: 1 }}>Test Cases</Typography>
                                            {(codingRoundData.testCases || []).map((tc, idx) => (
                                                <Box key={idx} sx={{ p: 2, border: "1px solid", borderColor: "divider", borderRadius: 2 }}>
                                                    <Typography variant="caption" sx={{ mb: 1, display: "block" }}>Case {idx + 1}</Typography>
                                                    <Grid container spacing={2}>
                                                        <Grid item xs={12} md={6}>
                                                            <TextField
                                                                label="Input"
                                                                fullWidth
                                                                size="small"
                                                                value={tc.input}
                                                                onChange={(e) => {
                                                                    const newCases = [...codingRoundData.testCases];
                                                                    newCases[idx] = { ...newCases[idx], input: e.target.value };
                                                                    setCodingRoundData(prev => ({ ...prev, testCases: newCases }));
                                                                }}
                                                            />
                                                        </Grid>
                                                        <Grid item xs={12} md={6}>
                                                            <TextField
                                                                label="Expected Output"
                                                                fullWidth
                                                                size="small"
                                                                value={tc.expected}
                                                                onChange={(e) => {
                                                                    const newCases = [...codingRoundData.testCases];
                                                                    newCases[idx] = { ...newCases[idx], expected: e.target.value };
                                                                    setCodingRoundData(prev => ({ ...prev, testCases: newCases }));
                                                                }}
                                                            />
                                                        </Grid>
                                                    </Grid>
                                                </Box>
                                            ))}
                                        </Box>
                                    ) : (
                                        <Box sx={{ p: 2, bgcolor: isDark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.01)", borderRadius: 2, border: "1px solid", borderColor: "divider" }}>
                                            {!codingRoundData.title && !codingRoundData.description ? (
                                                <Typography variant="body2" color="text.secondary">
                                                    Generate a coding problem to preview details here.
                                                </Typography>
                                            ) : (
                                                <>
                                                    <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>{codingRoundData.title}</Typography>
                                                    <Box sx={{ mb: 2 }}>
                                                        <Typography
                                                            variant="body1"
                                                            sx={{
                                                                color: "text.secondary",
                                                                lineHeight: 1.6,
                                                                whiteSpace: "pre-wrap",
                                                                wordBreak: "break-word",
                                                                display: showFullProblemDesc ? "block" : "-webkit-box",
                                                                WebkitLineClamp: showFullProblemDesc ? "unset" : 6,
                                                                WebkitBoxOrient: "vertical",
                                                                overflow: "hidden",
                                                            }}
                                                        >
                                                            {codingRoundData.description}
                                                        </Typography>
                                                        {codingRoundData.description?.length > 450 && (
                                                            <Button
                                                                size="small"
                                                                onClick={() =>
                                                                    setShowFullProblemDesc((prev) => !prev)
                                                                }
                                                                sx={{ mt: 0.5, px: 0, textTransform: "none" }}
                                                            >
                                                                {showFullProblemDesc ? "Show Less" : "Show More"}
                                                            </Button>
                                                        )}
                                                    </Box>

                                                    <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 0.5 }}>Constraints:</Typography>
                                                    <Box component="ul" sx={{ pl: 2.5, mt: 0, mb: 2 }}>
                                                        {(codingRoundData.constraints || []).map((c, i) => (
                                                            <li key={i}><Typography variant="body2" sx={{ fontFamily: "monospace", color: "text.secondary" }}>{c}</Typography></li>
                                                        ))}
                                                    </Box>

                                                    {codingRoundData.examples?.length ? (
                                                        <>
                                                            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>Example:</Typography>
                                                            <Box sx={{ p: 2, bgcolor: isDark ? "#1e1e1e" : "#f8f9fa", borderLeft: `4px solid ${theme.palette.warning.main}`, borderRadius: "0 4px 4px 0", mb: 3 }}>
                                                                <Typography variant="body2" component="pre" sx={{ m: 0, fontFamily: "monospace", whiteSpace: "pre-wrap" }}>
                                                                    <strong>Input:</strong> {codingRoundData.examples?.[0]?.input}<br />
                                                                    <strong>Output:</strong> {codingRoundData.examples?.[0]?.output}<br />
                                                                    <strong>Explanation:</strong> {codingRoundData.examples?.[0]?.explanation}
                                                                </Typography>
                                                            </Box>
                                                        </>
                                                    ) : null}

                                                    {(codingRoundData.testCases || []).length ? (
                                                        <Box sx={{ mt: 4 }}>
                                                            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>Test Cases:</Typography>
                                                            <Box sx={{ border: "1px solid", borderColor: "divider", borderRadius: 2, overflow: "hidden" }}>
                                                                <Tabs
                                                                    value={activeTestCase}
                                                                    onChange={(e, v) => setActiveTestCase(v)}
                                                                    variant="scrollable"
                                                                    scrollButtons="auto"
                                                                    sx={{ bgcolor: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.03)", "& .MuiTab-root": { minWidth: 100, fontWeight: 600, fontSize: "0.75rem" } }}
                                                                >
                                                                    {(codingRoundData.testCases || []).map((_, i) => (
                                                                        <Tab key={i} label={`Case ${i + 1}`} />
                                                                    ))}
                                                                </Tabs>
                                                                <Box sx={{ p: 2, bgcolor: isDark ? "#2d2d2d" : "#ffffff" }}>
                                                                    <Box sx={{ mb: 2 }}>
                                                                        <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mb: 0.5 }}>Input =</Typography>
                                                                        <Box sx={{ p: 1, bgcolor: isDark ? "#3e3e3e" : "#f1f1f1", borderRadius: 1, fontFamily: "monospace" }}>{codingRoundData.testCases?.[activeTestCase]?.input}</Box>
                                                                    </Box>
                                                                    <Box>
                                                                        <Typography variant="caption" sx={{ color: "text.secondary", display: "block", mb: 0.5 }}>Expected Output =</Typography>
                                                                        <Box sx={{ p: 1, bgcolor: isDark ? "#3e3e3e" : "#f1f1f1", borderRadius: 1, fontFamily: "monospace", color: theme.palette.success.main, fontWeight: 700 }}>{codingRoundData.testCases?.[activeTestCase]?.expected}</Box>
                                                                    </Box>
                                                                </Box>
                                                            </Box>
                                                        </Box>
                                                    ) : null}
                                                </>
                                            )}
                                        </Box>
                                    )}
                                </Box>
                            )}

                            {/* SPEAKING ROUND: SCRIPT */}
                            {isSpeakingRound && (
                                <Box sx={{ p: 2, border: "1px solid", borderColor: "divider", borderRadius: 2, mb: 3, bgcolor: isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.02)" }}>
                                    <Box sx={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 2, mb: 2 }}>
                                        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                                            Video Call Interview Script
                                        </Typography>
                                        {form.interviewerType === "AI" && savedSelectedBlueprint?.length ? (
                                            <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", justifyContent: "flex-end" }}>
                                                {savedSelectedBlueprint.map((g) => (
                                                    <Chip key={g.name} label={g.name} size="small" sx={{ borderRadius: 999 }} />
                                                ))}
                                            </Box>
                                        ) : null}
                                    </Box>

                                    <TextField
                                        fullWidth
                                        multiline
                                        minRows={7}
                                        value={form.technicalScript}
                                        onChange={(e) => setForm((v) => ({ ...v, technicalScript: e.target.value }))}
                                        placeholder="This script will be used by the virtual interviewer."
                                        sx={{ mt: 1 }}
                                    />

                                    <Box sx={{ mt: 1, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                        <Typography variant="caption" color="text.secondary">
                                            {form.technicalScript?.length || 0} chars
                                        </Typography>
                                        <Button
                                            variant="outlined"
                                            size="small"
                                            onClick={handleGenerateScript}
                                            disabled={isGeneratingScript}
                                        >
                                            {isGeneratingScript ? "Generating..." : "Generate Script"}
                                        </Button>
                                    </Box>
                                </Box>
                            )}

                        </Box>
                    )}

                    {/* SUBMIT ACTIONS */}
                    <Box sx={{ mt: 4, display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 2 }}>
                        <MUIButton
                            variant="outlined"
                            startIcon={<SaveIcon />}
                            onClick={() => alert("Draft saved (client-side only).")}
                            sx={{ textTransform: "none", borderRadius: 2 }}
                        >
                            Save Draft
                        </MUIButton>

                        <MUIButton
                            variant="contained"
                            startIcon={<SendIcon />}
                            onClick={handleSubmit}
                            disabled={anyConflict}
                            sx={{
                                textTransform: "none",
                                borderRadius: 2,
                                backgroundColor: anyConflict ? theme.palette.grey[600] : theme.palette.primary.main,
                            }}
                        >
                            Schedule Interview
                        </MUIButton>
                    </Box>
                </CardContent>
            </Card>


            {/* Coding Modal */}
            <Dialog
                open={codingModalOpen}
                onClose={handleCancelCodingModal}
                fullWidth
                maxWidth="lg"
                PaperProps={{
                    sx: {
                        borderRadius: 3,
                        overflow: "hidden",
                        border: `1px solid ${codingModalBorder}`,
                        boxShadow: isDark
                            ? "0 30px 80px rgba(0,0,0,0.55)"
                            : "0 30px 80px rgba(15,23,42,0.18)",
                    },
                }}
            >
                <DialogTitle sx={{ p: 0 }}>
                    <Box sx={{ px: 3, py: 2.5, background: codingModalHeaderBg }}>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                            <Box
                                sx={{
                                    width: 44,
                                    height: 44,
                                    borderRadius: 2,
                                    display: "grid",
                                    placeItems: "center",
                                    bgcolor: isDark
                                        ? alpha(theme.palette.common.black, 0.35)
                                        : alpha(theme.palette.common.white, 0.75),
                                    color: isDark
                                        ? theme.palette.primary.light
                                        : theme.palette.primary.dark,
                                    boxShadow: isDark
                                        ? "0 12px 24px rgba(0,0,0,0.35)"
                                        : "0 12px 24px rgba(15,23,42,0.14)",
                                }}
                            >
                                <CodeIcon />
                            </Box>
                            <Box sx={{ flex: 1 }}>
                                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                                    Coding Problem Configuration
                                </Typography>
                                <Typography
                                    variant="body2"
                                    sx={{
                                        color: isDark
                                            ? "rgba(255,255,255,0.75)"
                                            : "rgba(15,23,42,0.75)",
                                    }}
                                >
                                    Fine-tune difficulty, test cases, and the problem source.
                                </Typography>
                            </Box>
                        </Box>
                        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1, mt: 2 }}>
                            <Chip
                                size="small"
                                label={`Level: ${codingConfig.level || "Medium"}`}
                                sx={{
                                    fontWeight: 700,
                                    bgcolor: alpha(
                                        theme.palette.primary.main,
                                        isDark ? 0.25 : 0.15
                                    ),
                                    color: isDark
                                        ? theme.palette.primary.light
                                        : theme.palette.primary.dark,
                                }}
                            />
                            <Chip
                                size="small"
                                label={`Test cases: ${codingConfig.testCases || 0}`}
                                sx={{
                                    fontWeight: 700,
                                    bgcolor: alpha(
                                        theme.palette.secondary.main,
                                        isDark ? 0.25 : 0.14
                                    ),
                                    color: isDark
                                        ? theme.palette.secondary.light
                                        : theme.palette.secondary.dark,
                                }}
                            />
                            <Chip
                                size="small"
                                label={`Type: ${codingConfig.type || "DSA"}`}
                                sx={{
                                    fontWeight: 700,
                                    bgcolor: alpha(
                                        theme.palette.success.main,
                                        isDark ? 0.22 : 0.12
                                    ),
                                    color: isDark
                                        ? theme.palette.success.light
                                        : theme.palette.success.dark,
                                }}
                            />
                        </Box>
                    </Box>
                </DialogTitle>
                <DialogContent
                    dividers
                    sx={{
                        backgroundColor: theme.palette.background.paper,
                        backgroundImage: codingModalPattern,
                        p: 3,
                    }}
                >
                    <Grid container spacing={2}>
                        <Grid item xs={12} md={isPdfQuestionType ? 8 : 12}>
                            <Card
                                variant="outlined"
                                sx={{
                                    borderRadius: 2.5,
                                    borderColor: codingModalBorder,
                                    bgcolor: codingModalSurface,
                                    boxShadow: isDark
                                        ? "0 18px 40px rgba(0,0,0,0.35)"
                                        : "0 18px 40px rgba(15,23,42,0.1)",
                                }}
                            >
                                <CardContent sx={{ p: 2.5 }}>
                                    <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
                                        <Typography
                                            variant="subtitle2"
                                            sx={{
                                                fontWeight: 700,
                                                textTransform: "uppercase",
                                                letterSpacing: 0.6,
                                            }}
                                        >
                                            Question Basics
                                        </Typography>
                                        <Divider sx={{ flex: 1 }} />
                                    </Box>
                                    <Grid container spacing={2}>
                                        <Grid item xs={12} md={4}>
                                            <FormControl fullWidth size="small">
                                                <InputLabel>Question Type</InputLabel>
                                                <Select
                                                    value={codingConfig.type}
                                                    label="Question Type"
                                                    onChange={(e) =>
                                                        setCodingConfig((prev) => ({
                                                            ...prev,
                                                            type: e.target.value,
                                                        }))
                                                    }
                                                >
                                                    <MenuItem value="DSA">DSA</MenuItem>
                                                    <MenuItem value="Scenario Based">
                                                        Scenario Based
                                                    </MenuItem>
                                                    <MenuItem value="Upload PDF">Upload PDF</MenuItem>
                                                </Select>
                                            </FormControl>
                                        </Grid>
                                        <Grid item xs={12} md={4}>
                                            <TextField
                                                label="Test Case Count"
                                                type="number"
                                                size="small"
                                                fullWidth
                                                value={codingConfig.testCases}
                                                inputProps={{ min: 1 }}
                                                onChange={(e) =>
                                                    setCodingConfig((prev) => ({
                                                        ...prev,
                                                        testCases: Number(e.target.value),
                                                    }))
                                                }
                                            />
                                        </Grid>
                                        <Grid item xs={12} md={4}>
                                            <FormControl fullWidth size="small">
                                                <InputLabel>Question Level</InputLabel>
                                                <Select
                                                    value={codingConfig.level}
                                                    label="Question Level"
                                                    onChange={(e) =>
                                                        setCodingConfig((prev) => ({
                                                            ...prev,
                                                            level: e.target.value,
                                                        }))
                                                    }
                                                >
                                                    <MenuItem value="Easy">Easy</MenuItem>
                                                    <MenuItem value="Medium">Medium</MenuItem>
                                                    <MenuItem value="Hard">Hard</MenuItem>
                                                </Select>
                                            </FormControl>
                                        </Grid>
                                    </Grid>
                                </CardContent>
                            </Card>
                        </Grid>

                        {isPdfQuestionType && (
                            <Grid item xs={12} md={4}>
                                <Card
                                    variant="outlined"
                                    sx={{
                                        borderRadius: 2.5,
                                        borderColor: codingModalBorder,
                                        bgcolor: codingModalSurface,
                                        boxShadow: isDark
                                            ? "0 18px 40px rgba(0,0,0,0.35)"
                                            : "0 18px 40px rgba(15,23,42,0.1)",
                                    }}
                                >
                                    <CardContent sx={{ p: 2.5 }}>
                                        <Box
                                            sx={{
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "space-between",
                                                gap: 1,
                                                mb: 2,
                                            }}
                                        >
                                            <Typography
                                                variant="subtitle2"
                                                sx={{
                                                    fontWeight: 700,
                                                    textTransform: "uppercase",
                                                    letterSpacing: 0.6,
                                                }}
                                            >
                                                Reference PDF
                                            </Typography>
                                            <Chip
                                                label="Optional"
                                                size="small"
                                                sx={{
                                                    fontWeight: 700,
                                                    bgcolor: alpha(
                                                        theme.palette.warning.main,
                                                        isDark ? 0.18 : 0.12
                                                    ),
                                                    color: isDark
                                                        ? theme.palette.warning.light
                                                        : theme.palette.warning.dark,
                                                }}
                                            />
                                        </Box>
                                        <Typography variant="body2" color="text.secondary">
                                            Upload a PDF to generate a similar problem from it.
                                        </Typography>
                                        <Box
                                            sx={{
                                                mt: 2,
                                                p: 2,
                                                borderRadius: 2,
                                                border: `1px dashed ${codingModalBorder}`,
                                                bgcolor: isDark
                                                    ? alpha(theme.palette.common.black, 0.2)
                                                    : alpha(theme.palette.common.white, 0.7),
                                            }}
                                        >
                                            <MUIFileInput
                                                label="Upload a PDF"
                                                maxFiles={1}
                                                acceptedTypes={["application/pdf"]}
                                                onChange={handlePdfUpload}
                                                sx={{ mb: 0 }}
                                            />
                                            {codingPdfFile ? (
                                                <Typography variant="caption" color="text.secondary">
                                                    Selected PDF: {codingPdfFile.name}
                                                    {codingPdfText ? " (parsed)" : ""}
                                                </Typography>
                                            ) : null}
                                        </Box>
                                    </CardContent>
                                </Card>
                            </Grid>
                        )}
                    </Grid>
                </DialogContent>
                <DialogActions
                    sx={{
                        px: 3,
                        py: 2,
                        bgcolor: isDark
                            ? alpha(theme.palette.common.black, 0.2)
                            : alpha(theme.palette.common.black, 0.03),
                    }}
                >
                    <Box sx={{ flex: 1 }}>
                        <Typography variant="caption" color="text.secondary">
                            Generate a problem using these settings.
                        </Typography>
                    </Box>
                    <MUIButton
                        variant="text"
                        onClick={handleCancelCodingModal}
                        sx={{ textTransform: "none" }}
                    >
                        Cancel
                    </MUIButton>
                    <MUIButton
                        variant="contained"
                        onClick={handleGenerateCodingProblemFromModal}
                        disabled={isGeneratingCodingProblem || (isPdfQuestionType && !codingPdfFile)}
                        sx={{ textTransform: "none" }}
                    >
                        {isGeneratingCodingProblem ? "Generating..." : "Generate Problem"}
                    </MUIButton>
                </DialogActions>
            </Dialog>

            {/* Parameter Modal */}
            <Dialog
                open={paramModalOpen}
                onClose={() => setParamModalOpen(false)}
                fullWidth
                maxWidth="md"
            >
                <DialogTitle>
                    Configure Interview Parameters ({form.interviewType} •{" "}
                    {form.difficultyLevel})
                </DialogTitle>

                <DialogContent
                    dividers
                    sx={{ background: theme.palette.background.paper }}
                >
                    {paramLoading ? (
                        <Typography>Loading parameters...</Typography>
                    ) : !paramBlueprint?.groups?.length ? (
                        <Typography color="text.secondary">
                            No parameters loaded. Close and retry.
                        </Typography>
                    ) : (
                        <>
                            <Typography
                                variant="body2"
                                sx={{ mb: 2 }}
                            >
                                Select the parameters and sub-parameters to
                                evaluate. Script generation will use ONLY what
                                you save here.
                            </Typography>

                            {paramBlueprint.groups.map((g) => {
                                const gSel = paramSelection?.[g.name];

                                const enabledParams = (g.parameters || []).filter(
                                    (p) => gSel?.parameters?.[p.name]?.enabled
                                );
                                const totalParams = (g.parameters || []).length;

                                return (
                                    <Accordion
                                        key={g.name}
                                        defaultExpanded
                                        sx={{
                                            borderRadius: 2,
                                            mb: 1,
                                            overflow: "hidden",
                                        }}
                                    >
                                        <AccordionSummary
                                            expandIcon={<ExpandMoreIcon />}
                                        >
                                            <Box
                                                sx={{
                                                    display: "flex",
                                                    alignItems: "center",
                                                    gap: 2,
                                                    width: "100%",
                                                }}
                                            >
                                                <FormControlLabel
                                                    onClick={(e) =>
                                                        e.stopPropagation()
                                                    }
                                                    onFocus={(e) =>
                                                        e.stopPropagation()
                                                    }
                                                    control={
                                                        <Checkbox
                                                            checked={
                                                                !!gSel?.enabled
                                                            }
                                                            onChange={(e) =>
                                                                toggleGroup(
                                                                    g.name,
                                                                    e.target
                                                                        .checked
                                                                )
                                                            }
                                                        />
                                                    }
                                                    label={
                                                        <Typography
                                                            sx={{
                                                                fontWeight: 800,
                                                            }}
                                                        >
                                                            {g.name}
                                                        </Typography>
                                                    }
                                                />
                                                <Box sx={{ flex: 1 }} />
                                                <Chip
                                                    size="small"
                                                    label={`${enabledParams.length}/${totalParams} params`}
                                                    sx={{ borderRadius: 999 }}
                                                />
                                            </Box>
                                        </AccordionSummary>

                                        <AccordionDetails>
                                            {(g.parameters || []).map((p) => {
                                                const pSel =
                                                    gSel?.parameters?.[p.name];
                                                const subList = Array.isArray(
                                                    p.subparameters
                                                )
                                                    ? p.subparameters
                                                    : [];
                                                const subKey = `${g.name}|${p.name}`;

                                                const disabled =
                                                    !gSel?.enabled ||
                                                    !pSel?.enabled;
                                                const selectedCount =
                                                    countSelectedSubs(pSel);
                                                const totalSubs = subList.length;

                                                return (
                                                    <Box
                                                        key={p.name}
                                                        sx={{
                                                            border: "1px solid",
                                                            borderColor:
                                                                theme.palette
                                                                    .divider,
                                                            borderRadius: 2,
                                                            p: 2,
                                                            mb: 2,
                                                            background: isDark
                                                                ? "rgba(255,255,255,0.02)"
                                                                : "rgba(0,0,0,0.02)",
                                                        }}
                                                    >
                                                        <Box
                                                            sx={{
                                                                display: "flex",
                                                                alignItems:
                                                                    "center",
                                                                justifyContent:
                                                                    "space-between",
                                                                gap: 2,
                                                                flexWrap:
                                                                    "wrap",
                                                            }}
                                                        >
                                                            <FormControlLabel
                                                                control={
                                                                    <Checkbox
                                                                        checked={
                                                                            !!pSel?.enabled
                                                                        }
                                                                        onChange={(
                                                                            e
                                                                        ) =>
                                                                            toggleParam(
                                                                                g.name,
                                                                                p.name,
                                                                                e
                                                                                    .target
                                                                                    .checked
                                                                            )
                                                                        }
                                                                    />
                                                                }
                                                                label={
                                                                    <Typography
                                                                        sx={{
                                                                            fontWeight: 700,
                                                                        }}
                                                                    >
                                                                        {
                                                                            p.name
                                                                        }
                                                                    </Typography>
                                                                }
                                                            />

                                                            <Stack
                                                                direction="row"
                                                                spacing={1}
                                                                alignItems="center"
                                                                useFlexGap
                                                                flexWrap="wrap"
                                                            >
                                                                <Chip
                                                                    size="small"
                                                                    label={`${selectedCount}/${totalSubs} selected`}
                                                                    sx={{
                                                                        borderRadius:
                                                                            999,
                                                                    }}
                                                                />

                                                                <Tooltip title="Select all sub-parameters">
                                                                    <span>
                                                                        <Button
                                                                            size="small"
                                                                            variant="outlined"
                                                                            disabled={
                                                                                disabled
                                                                            }
                                                                            onClick={() =>
                                                                                setAllSubs(
                                                                                    g.name,
                                                                                    p.name,
                                                                                    true
                                                                                )
                                                                            }
                                                                            sx={{
                                                                                borderRadius: 999,
                                                                                minWidth: 0,
                                                                                height: 26,
                                                                                px: 1,
                                                                                py: 0,
                                                                                fontSize: 11,
                                                                                lineHeight: 1,
                                                                                textTransform:
                                                                                    "none",
                                                                                "& .MuiButton-startIcon, & .MuiButton-endIcon":
                                                                                {
                                                                                    m: 0,
                                                                                },
                                                                            }}
                                                                        >
                                                                            Select
                                                                            all
                                                                        </Button>
                                                                    </span>
                                                                </Tooltip>

                                                                <Tooltip title="Clear sub-parameter selection">
                                                                    <span>
                                                                        <Button
                                                                            size="small"
                                                                            variant="outlined"
                                                                            disabled={
                                                                                disabled
                                                                            }
                                                                            onClick={() =>
                                                                                setAllSubs(
                                                                                    g.name,
                                                                                    p.name,
                                                                                    false
                                                                                )
                                                                            }
                                                                            sx={{
                                                                                borderRadius: 999,
                                                                                minWidth: 0,
                                                                                height: 26,
                                                                                px: 1,
                                                                                py: 0,
                                                                                fontSize: 11,
                                                                                lineHeight: 1,
                                                                                textTransform:
                                                                                    "none",
                                                                                "& .MuiButton-startIcon, & .MuiButton-endIcon":
                                                                                {
                                                                                    m: 0,
                                                                                },
                                                                            }}
                                                                        >
                                                                            Clear
                                                                        </Button>
                                                                    </span>
                                                                </Tooltip>
                                                            </Stack>
                                                        </Box>

                                                        {/* Pills */}
                                                        <Stack
                                                            direction="row"
                                                            spacing={1}
                                                            useFlexGap
                                                            flexWrap="wrap"
                                                            sx={{ mt: 1.5 }}
                                                        >
                                                            {subList.map(
                                                                (s) => {
                                                                    const selected =
                                                                        !!pSel
                                                                            ?.subEnabled?.[
                                                                        s
                                                                        ];
                                                                    return (
                                                                        <PillChip
                                                                            key={
                                                                                s
                                                                            }
                                                                            label={
                                                                                s
                                                                            }
                                                                            selected={
                                                                                selected
                                                                            }
                                                                            disabled={
                                                                                disabled
                                                                            }
                                                                            onClick={() =>
                                                                                toggleSub(
                                                                                    g.name,
                                                                                    p.name,
                                                                                    s,
                                                                                    !selected
                                                                                )
                                                                            }
                                                                        />
                                                                    );
                                                                }
                                                            )}
                                                        </Stack>

                                                        {/* Manual add sub-parameter */}
                                                        <Box
                                                            sx={{
                                                                display: "flex",
                                                                gap: 1,
                                                                mt: 2,
                                                            }}
                                                        >
                                                            <TextField
                                                                size="small"
                                                                label="Add sub-parameter"
                                                                value={
                                                                    manualSubInput[
                                                                    subKey
                                                                    ] || ""
                                                                }
                                                                onChange={(e) =>
                                                                    setManualSubInput(
                                                                        (
                                                                            prev
                                                                        ) => ({
                                                                            ...prev,
                                                                            [subKey]:
                                                                                e
                                                                                    .target
                                                                                    .value,
                                                                        })
                                                                    )
                                                                }
                                                                fullWidth
                                                            />
                                                            <MUIButton
                                                                size="small"
                                                                variant="outlined"
                                                                onClick={() =>
                                                                    addManualSubparameter(
                                                                        g.name,
                                                                        p.name
                                                                    )
                                                                }
                                                                sx={{
                                                                    borderRadius: 999,
                                                                }}
                                                            >
                                                                Add
                                                            </MUIButton>
                                                        </Box>
                                                    </Box>
                                                );
                                            })}

                                            {/* Manual add parameter */}
                                            <Box
                                                sx={{
                                                    display: "flex",
                                                    gap: 1,
                                                    mt: 2,
                                                }}
                                            >
                                                <TextField
                                                    size="small"
                                                    label={`Add parameter to ${g.name}`}
                                                    value={
                                                        manualParamInput[
                                                        g.name
                                                        ] || ""
                                                    }
                                                    onChange={(e) =>
                                                        setManualParamInput(
                                                            (prev) => ({
                                                                ...prev,
                                                                [g.name]:
                                                                    e.target
                                                                        .value,
                                                            })
                                                        )
                                                    }
                                                    fullWidth
                                                />
                                                <MUIButton
                                                    size="small"
                                                    variant="outlined"
                                                    onClick={() =>
                                                        addManualParameter(
                                                            g.name
                                                        )
                                                    }
                                                    sx={{
                                                        borderRadius: 999,
                                                    }}
                                                >
                                                    Add
                                                </MUIButton>
                                            </Box>
                                        </AccordionDetails>
                                    </Accordion>
                                );
                            })}
                        </>
                    )}
                </DialogContent>

                <DialogActions>
                    <Button onClick={() => setParamModalOpen(false)}>
                        Cancel
                    </Button>
                    <MUIButton
                        variant="contained"
                        onClick={handleSaveParameters}
                        disabled={paramLoading || !paramBlueprint}
                        size="small"
                    >
                        Save Parameters
                    </MUIButton>
                </DialogActions>
            </Dialog>

            {/* CALENDAR DIALOG */}
            <Dialog
                open={openCalendar}
                onClose={handleCloseCalendar}
                fullWidth
                maxWidth="sm"
            >
                <DialogTitle>
                    Availability Calendar{" "}
                    {selectedInterviewerName &&
                        `- ${selectedInterviewerName}`}
                </DialogTitle>
                <DialogContent
                    dividers
                    sx={{ background: theme.palette.background.paper }}
                >
                    <LocalizationProvider dateAdapter={AdapterDateFns}>
                        <DateCalendar
                            value={selectedDate}
                            onChange={(newDate) => setSelectedDate(newDate)}
                        />
                    </LocalizationProvider>
                </DialogContent>
                <DialogActions>
                    <Button onClick={handleCloseCalendar}>Close</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}
