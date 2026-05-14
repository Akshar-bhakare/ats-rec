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
    Paper,
    InputAdornment,
    IconButton,
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
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import AddRoundedIcon from "@mui/icons-material/AddRounded";
import KeyboardArrowDownRoundedIcon from "@mui/icons-material/KeyboardArrowDownRounded";
import KeyboardArrowUpRoundedIcon from "@mui/icons-material/KeyboardArrowUpRounded";
import CandidateCard from "../InterviewSchedule/CandidateCard";
import CandidateProgress from "../InterviewSchedule/CandidateProgress";
import InterviewScheduleForm from "../InterviewSchedule/InterviewScheduleForm";
import InterviewOutputPanel from "../InterviewSchedule/InterviewOutputPanel";

import MUIButton from "../MUI/commonUI/MUIButton";
import MUIAlert from "../MUI/commonUI/MUIAlert";
import MUICenterLayout from "../MUI/commonUI/MUICenterLayout";
import MUIFileInput from "../MUI/commonUI/MUIFileInput";
import { Dialog, DialogTitle, DialogContent, DialogActions } from "@mui/material";

import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { DateCalendar } from "@mui/x-date-pickers/DateCalendar";

import { fetchData, performDeploySafeFetch } from "../../AppUtils/dataAPI";
import { useUiContextState } from "../../contexts/UiContext";
import { useInterviewContextState } from "../../contexts/InterviewContext";

/* -----------------------------
   Defaults
----------------------------- */

const pad2 = (value) => String(value).padStart(2, "0");

const getTodayYmd = () => {
    const now = new Date();
    return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
};

const getCurrentTimeHm = (offsetMinutes = 0) => {
    const now = new Date();
    now.setMinutes(now.getMinutes() + offsetMinutes);
    return `${pad2(now.getHours())}:${pad2(now.getMinutes())}`;
};

const defaultForm = (tz) => ({
    interviewMode: "Virtual",
    locationAddress: "",
    meetingLink: "",
    interviewDate: getTodayYmd(),
    startTime: getCurrentTimeHm(10),
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

const PARAM_PRIORITY_KEY_SEPARATOR = "||";

const countEnabledSubparameters = (subEnabled = {}) =>
    Object.values(subEnabled || {}).filter(Boolean).length;

const buildParamPriorityKey = (groupName, paramName) =>
    `${String(groupName || "Group").trim()}${PARAM_PRIORITY_KEY_SEPARATOR}${String(
        paramName || "Parameter"
    ).trim()}`;

const isParameterSelected = (pSel = {}) => !!pSel?.enabled;

const getSelectedParameterEntries = (blueprint, selection) => {
    const groups = Array.isArray(blueprint?.groups) ? blueprint.groups : [];
    const entries = [];

    for (const group of groups) {
        const groupName = group?.name || "Group";
        const groupSelection = selection?.[groupName];
        const parameters = Array.isArray(group?.parameters) ? group.parameters : [];

        for (const param of parameters) {
            const paramName = param?.name || "Parameter";
            const paramSelection = groupSelection?.parameters?.[paramName];
            if (!isParameterSelected(paramSelection)) continue;

            const totalSubs = Array.isArray(param?.subparameters)
                ? param.subparameters.length
                : 0;

            entries.push({
                key: buildParamPriorityKey(groupName, paramName),
                groupName,
                paramName,
                selectedCount: countEnabledSubparameters(paramSelection?.subEnabled),
                totalSubs,
            });
        }
    }

    return entries;
};

const buildPriorityOrderFromSelectedBlueprint = (selectedBlueprint = []) => {
    const flattened = [];
    const groups = Array.isArray(selectedBlueprint) ? selectedBlueprint : [];
    let fallbackIndex = 0;

    for (const group of groups) {
        const groupName = group?.name || "Group";
        const parameters = Array.isArray(group?.parameters) ? group.parameters : [];

        for (const param of parameters) {
            const paramName = param?.name || "Parameter";
            const rawPriority = Number(param?.priority);
            flattened.push({
                key: buildParamPriorityKey(groupName, paramName),
                priority: Number.isFinite(rawPriority) && rawPriority > 0 ? rawPriority : null,
                fallbackIndex,
            });
            fallbackIndex += 1;
        }
    }

    flattened.sort((a, b) => {
        const aPriority = a.priority ?? Number.MAX_SAFE_INTEGER;
        const bPriority = b.priority ?? Number.MAX_SAFE_INTEGER;
        if (aPriority !== bPriority) return aPriority - bPriority;
        return a.fallbackIndex - b.fallbackIndex;
    });

    const ordered = [];
    for (const item of flattened) {
        if (!ordered.includes(item.key)) {
            ordered.push(item.key);
        }
    }

    return ordered;
};

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

const buildSelectedBlueprint = (blueprint, selection, priorityOrder = []) => {
    const groups = Array.isArray(blueprint?.groups) ? blueprint.groups : [];
    const selectedEntries = [];
    const priorityLookup = new Map(
        (Array.isArray(priorityOrder) ? priorityOrder : []).map((key, index) => [key, index])
    );
    let blueprintIndex = 0;

    for (const g of groups) {
        const gName = g?.name || "Group";
        const gSel = selection?.[gName];

        const params = Array.isArray(g?.parameters) ? g.parameters : [];

        for (const p of params) {
            const pName = p?.name || "Parameter";
            const pSel = gSel?.parameters?.[pName];
            if (!isParameterSelected(pSel)) {
                blueprintIndex += 1;
                continue;
            }

            const subs = Array.isArray(p?.subparameters) ? p.subparameters : [];
            const chosenSubs = subs.filter((s) => pSel?.subEnabled?.[s]);

            selectedEntries.push({
                key: buildParamPriorityKey(gName, pName),
                groupName: gName,
                paramName: pName,
                subparameters: chosenSubs.length ? chosenSubs : subs,
                blueprintIndex,
            });

            blueprintIndex += 1;
        }
    }

    selectedEntries.sort((a, b) => {
        const aPriority = priorityLookup.has(a.key)
            ? priorityLookup.get(a.key)
            : Number.MAX_SAFE_INTEGER;
        const bPriority = priorityLookup.has(b.key)
            ? priorityLookup.get(b.key)
            : Number.MAX_SAFE_INTEGER;
        if (aPriority !== bPriority) return aPriority - bPriority;
        return a.blueprintIndex - b.blueprintIndex;
    });

    const out = [];
    const groupsByName = new Map();

    selectedEntries.forEach((entry, index) => {
        let targetGroup = groupsByName.get(entry.groupName);
        if (!targetGroup) {
            targetGroup = { name: entry.groupName, parameters: [] };
            groupsByName.set(entry.groupName, targetGroup);
            out.push(targetGroup);
        }

        targetGroup.parameters.push({
            name: entry.paramName,
            subparameters: entry.subparameters,
            priority: index + 1,
        });
    });

    return out;
};

const buildSelectionFromSavedBlueprint = (blueprint, savedBlueprint) => {
    const base = buildDefaultSelectionFromBlueprint(blueprint);
    const groups = Array.isArray(blueprint?.groups) ? blueprint.groups : [];
    const savedGroups = Array.isArray(savedBlueprint) ? savedBlueprint : [];
    const savedGroupMap = savedGroups.reduce((acc, group) => {
        const groupName = group?.name || "Group";
        const existing = acc.get(groupName) || [];
        existing.push(group);
        acc.set(groupName, existing);
        return acc;
    }, new Map());

    for (const group of groups) {
        const groupName = group?.name || "Group";
        const savedGroupEntries = savedGroupMap.get(groupName) || [];
        if (!savedGroupEntries.length) continue;

        const params = Array.isArray(group?.parameters) ? group.parameters : [];
        const savedParamMap = savedGroupEntries.reduce((acc, savedGroup) => {
            const savedParams = Array.isArray(savedGroup?.parameters)
                ? savedGroup.parameters
                : [];
            for (const savedParam of savedParams) {
                const paramName = savedParam?.name || "Parameter";
                const existing = acc.get(paramName) || [];
                existing.push(savedParam);
                acc.set(paramName, existing);
            }
            return acc;
        }, new Map());

        let groupEnabled = false;
        const nextParams = { ...(base[groupName]?.parameters || {}) };

        for (const param of params) {
            const paramName = param?.name || "Parameter";
            const savedParamEntries = savedParamMap.get(paramName) || [];
            if (!savedParamEntries.length) continue;

            const subs = Array.isArray(param?.subparameters) ? param.subparameters : [];
            const subEnabled = subs.reduce((acc, sub) => {
                acc[sub] = savedParamEntries.some((savedParam) =>
                    Array.isArray(savedParam?.subparameters)
                        ? savedParam.subparameters.includes(sub)
                        : false
                );
                return acc;
            }, {});
            const paramEnabled = subs.length
                ? countEnabledSubparameters(subEnabled) > 0
                : savedParamEntries.length > 0;
            nextParams[paramName] = { enabled: paramEnabled, subEnabled };
            if (paramEnabled) groupEnabled = true;
        }

        base[groupName] = {
            ...base[groupName],
            enabled: groupEnabled,
            parameters: { ...base[groupName]?.parameters, ...nextParams },
        };
    }

    return base;
};

/* -----------------------------
   UI helpers
----------------------------- */

const countSelectedSubs = (pSel = {}) => {
    return countEnabledSubparameters(pSel?.subEnabled);
};

const isExcludedGroupName = (name) =>
    String(name || "")
        .trim()
        .toLowerCase() === "jjfn technical competency";

const PillChip = ({ selected, disabled, label, onClick }) => {
    const theme = useTheme();
    const isDark = theme.palette.mode === "dark";

    // Force visual differentiation regardless of theme overrides:
    const selectedBg = theme.palette.primary.main;
    const selectedBorder = theme.palette.primary.main;
    const selectedText = theme.palette.primary.contrastText;

    const unselectedBg = alpha(theme.palette.primary.main, isDark ? 0.12 : 0.04);
    const unselectedBorder = alpha(theme.palette.primary.main, isDark ? 0.35 : 0.25);
    const unselectedText = theme.palette.text.secondary;

    const hoverBg = selected
        ? theme.palette.primary.dark
        : alpha(theme.palette.primary.main, isDark ? 0.18 : 0.08);

    return (
        <Chip
            label={label}
            clickable={!disabled}
            onClick={disabled ? undefined : onClick}
            size="small"
            variant={selected ? "filled" : "outlined"}
            color={selected ? "primary" : "default"}
            icon={selected ? <CheckRoundedIcon /> : undefined}
            sx={{
                borderRadius: 999,
                fontWeight: 600,
                userSelect: "none",
                borderWidth: 1.5,
                height: 30,
                px: 0.5,
                boxShadow: selected
                    ? "0 6px 12px rgba(37, 99, 235, 0.25)"
                    : "0 2px 6px rgba(15, 23, 42, 0.08)",
                transition: "all 150ms ease",

                // Deterministic state styling:
                backgroundColor: selected ? selectedBg : unselectedBg,
                borderColor: selected ? selectedBorder : unselectedBorder,
                color: selected ? selectedText : unselectedText,

                "& .MuiChip-label": {
                    px: 1,
                    fontSize: 12,
                    letterSpacing: 0.3,
                    lineHeight: 1,
                },
                "& .MuiChip-icon": {
                    color: selected ? selectedText : unselectedText,
                    fontSize: 16,
                    ml: 0.6,
                },

                "&:hover": {
                    backgroundColor: disabled ? (selected ? selectedBg : unselectedBg) : hoverBg,
                    boxShadow: disabled
                        ? undefined
                        : selected
                            ? "0 8px 16px rgba(37, 99, 235, 0.3)"
                            : "0 4px 10px rgba(15, 23, 42, 0.12)",
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


const normalizeLanguageId = (value) => {
    if (value === undefined || value === null) return "";
    // Allow numbers (Judge0 IDs)
    if (typeof value === 'number') return value;
    const str = String(value).trim();
    // Check if it's a numeric string
    if (/^\d+$/.test(str)) return Number(str);
    // Check if it's an ObjectId
    if (/^[0-9a-fA-F]{24}$/.test(str)) return str;
    return "";
};

const normalizeAllowedLanguageIds = (values = [], validSet) => {
    const ids = new Set();
    for (const entry of values || []) {
        // Helper to extract ID from various object shapes
        const val = entry?.judge0Id ?? entry?._id ?? entry;
        const id = normalizeLanguageId(val);

        if (id === "" || id === undefined) continue;

        // If validSet is provided, validation check
        if (validSet) {
            if (!validSet.has(id)) continue;
        }

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
    const scriptGeneratedRef = useRef(false);
    const lastScriptDurationRef = useRef(null);
    const pendingDurationRef = useRef(null);
    const lastDurationRef = useRef(null);

    const [allSchedules, setAllSchedules] = useState([]);
    const [availableInterviewers, setAvailableInterviewers] = useState([]);
    const [openCalendar, setOpenCalendar] = useState(false);
    const [selectedInterviewerName] = useState(null);
    const [selectedDate, setSelectedDate] = useState(new Date());
    const isCodingRound = form.interviewType === "Coding";
    const isSpeakingRound = !isCodingRound;

    const [, setUiState] = useUiContextState();
    const [, setInterviewState] = useInterviewContextState();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const [alertCfg, setAlertCfg] = useState({
        open: false,
        message: "",
        severity: "error",
    });

    const closeAlert = (_event, reason) => {
        if (reason === "clickaway") return;
        setAlertCfg((prev) => ({ ...prev, open: false }));
    };

    const showAlert = (message, severity = "error") => {
        setAlertCfg({
            open: true,
            message: String(message || "").trim(),
            severity,
        });
    };

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
    const paramModalHeaderBg = isDark
        ? alpha(theme.palette.common.black, 0.45)
        : "linear-gradient(180deg, #f8fbff 0%, #eef3ff 100%)";
    const paramModalPaperBg = isDark
        ? "linear-gradient(180deg, rgba(10,16,26,0.9) 0%, rgba(10,16,26,0.96) 100%)"
        : "linear-gradient(180deg, #fbfcff 0%, #f2f5fb 100%)";
    const paramModalBorder = alpha(theme.palette.primary.main, isDark ? 0.28 : 0.18);

    // Fetch available languages
    useEffect(() => {
        (async () => {
            try {
                const langs = await performDeploySafeFetch("Fetch Languages", () => fetchData("/api/codejudge/languages"));
                if (Array.isArray(langs)) {
                    setAvailableLanguages(langs);
                    const normalizedAvailableIds = normalizeAllowedLanguageIds(langs);
                    const availableIdSet = new Set(normalizedAvailableIds);
                    const python = langs.find((l) =>
                        String(l?.name || "").toLowerCase().includes("python")
                    );
                    // Use judge0Id for new system, fallback to _id for safety
                    const pythonId = normalizeLanguageId(python?.judge0Id ?? python?._id);

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
    const [, setIsEditingCodingRound] = useState(false);
    const [activeTestCase, setActiveTestCase] = useState(0);

    const cid = searchParams.get("cid") || "";
    const jid = searchParams.get("jid") || "";
    const atsid = searchParams.get("atsid") || "";
    const atsidsParam = searchParams.get("atsids") || "";
    const scheduleAtParam = searchParams.get("scheduleAt") || "";
    const scheduleKeyParam = searchParams.get("scheduleKey") || "";
    const stageIdParam = searchParams.get("stageId") || "";
    const stageTitleParam = searchParams.get("stageTitle") || "";
    const atsIds = useMemo(
        () =>
            atsidsParam
                .split(",")
                .map((v) => v.trim())
                .filter((v) => /^[0-9a-fA-F]{24}$/.test(v)),
        [atsidsParam]
    );
    const [scheduleOverridesByAtsId, setScheduleOverridesByAtsId] = useState({});

    useEffect(() => {
        if (!scheduleKeyParam) return;
        try {
            const raw = sessionStorage.getItem(scheduleKeyParam);
            if (!raw) return;
            const parsed = JSON.parse(raw) || {};
            setScheduleOverridesByAtsId(parsed);
            const firstOverride = Object.values(parsed || {})[0];
            const firstScheduleAt =
                typeof firstOverride === "string"
                    ? firstOverride
                    : firstOverride?.scheduleAt;
            if (firstScheduleAt) {
                const dt = new Date(firstScheduleAt);
                if (!Number.isNaN(dt.getTime())) {
                    const dateStr = `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`;
                    const timeStr = `${pad2(dt.getHours())}:${pad2(dt.getMinutes())}`;
                    setForm((prev) => ({
                        ...prev,
                        interviewDate: dateStr,
                        startTime: timeStr,
                        durationMinutes:
                            Number(firstOverride?.durationMinutes) ||
                            prev.durationMinutes ||
                            45,
                    }));
                }
            }
        } catch (err) {
            console.warn("[InterviewScheduler] Failed to read schedule overrides:", err);
        } finally {
            try {
                sessionStorage.removeItem(scheduleKeyParam);
            } catch {
                // ignore
            }
        }
    }, [scheduleKeyParam]);

    useEffect(() => {
        if (!scheduleAtParam || scheduleKeyParam) return;
        const dt = new Date(scheduleAtParam);
        if (Number.isNaN(dt.getTime())) return;
        const dateStr = `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`;
        const timeStr = `${pad2(dt.getHours())}:${pad2(dt.getMinutes())}`;
        setForm((prev) => ({
            ...prev,
            interviewDate: dateStr,
            startTime: timeStr,
        }));
    }, [scheduleAtParam, scheduleKeyParam]);

    const [showFullDesc, setShowFullDesc] = useState(false);
    const [showFullProblemDesc, setShowFullProblemDesc] = useState(false);
    const [loading, setLoading] = useState(false);

    // Parameters state
    const [paramModalOpen, setParamModalOpen] = useState(false);
    const [paramLoading, setParamLoading] = useState(false);
    const [paramBlueprint, setParamBlueprint] = useState(null);
    const [paramSelection, setParamSelection] = useState({});
    const [paramPriorityOrder, setParamPriorityOrder] = useState([]);
    const [savedSelectedBlueprint, setSavedSelectedBlueprint] = useState(null);
    const [activeParamGroup, setActiveParamGroup] = useState("");
    const [priorityModalOpen, setPriorityModalOpen] = useState(false);

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
            setUiState({ loadingMsg: "Loading" });
            setLoadingInterviewers(true);
            try {
                if (atsIds.length) {
                    const results = await Promise.allSettled(
                        atsIds.map((id) =>
                            performDeploySafeFetch("Fetch Schedule View", () => fetchData(`/api/interviewschedules/view?candidateATS=${id}`), setUiState, "Loading schedule details")
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

                    const view = await performDeploySafeFetch("Fetch Schedule View", () => fetchData(`/api/interviewschedules/view?${params.toString()}`), setUiState, "Loading schedule details");
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

                const all = await performDeploySafeFetch("Fetch All Schedules", () => fetchData("/api/interviewschedules"));
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
                const sEnd = s.endedAt
                    ? new Date(s.endedAt)
                    : new Date(new Date(s.startAt).getTime() + s.durationMinutes * 60000);
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

    const selectedInterviewerScheduleGroups = useMemo(() => {
        if (!selectedScheduleGroups.length) return [];
        const nowMs = Date.now();
        return selectedScheduleGroups.map(({ interviewer, schedules }) => {
            const upcoming = (schedules || [])
                .filter((s) => {
                    const sStart = s?.startAt ? new Date(s.startAt) : null;
                    if (!sStart || Number.isNaN(sStart.getTime())) return false;
                    const sEnd = s.endedAt
                        ? new Date(s.endedAt)
                        : new Date(sStart.getTime() + Number(s.durationMinutes || 0) * 60000);
                    return sEnd.getTime() >= nowMs;
                })
                .sort((a, b) => getScheduleStartMs(a) - getScheduleStartMs(b))
                .map((s) => {
                    const sStart = s?.startAt ? new Date(s.startAt) : null;
                    const sEnd = sStart
                        ? s.endedAt
                            ? new Date(s.endedAt)
                            : new Date(sStart.getTime() + Number(s.durationMinutes || 0) * 60000)
                        : null;
                    const isConflict =
                        start &&
                        end &&
                        sStart &&
                        sEnd &&
                        overlaps(start, end, sStart, sEnd);
                    return {
                        id: String(s?._id || `${interviewer.id}-${s.startAt || ''}`),
                        when: formatScheduleWindow(s.startAt, s.durationMinutes),
                        candidateName: getCandidateLabel(s),
                        jobTitle: getJobLabel(s),
                        isConflict,
                    };
                });
            return {
                interviewerId: interviewer.id,
                interviewerName: interviewer.name,
                interviews: upcoming,
            };
        });
    }, [selectedScheduleGroups, start, end]);

    const resetForm = () => {
        setForm(defaultForm(form.timezone));
        setParamBlueprint(null);
        setParamSelection({});
        setParamPriorityOrder([]);
        setSavedSelectedBlueprint(null);
    };

    /* -----------------------------
       Parameters Modal logic
    ----------------------------- */

    const generateParameters = async () => {
        if (!job) return false;
        console.log("[PARAMS] Generating parameters...", {
            jobId: job?._id,
            interviewType: form.interviewType,
            difficultyLevel: form.difficultyLevel,
        });
        setParamLoading(true);
        setSavedSelectedBlueprint(null);

        try {
            const payload = {
                jobId: job?._id,
                interviewType: form.interviewType,
                difficultyLevel: form.difficultyLevel,
                job: {
                    title: job.title,
                    internalTitle: job.internalTitle,
                    primarySkills: job.primarySkills,
                    description: job.description,
                },
            };

            const res = await performDeploySafeFetch("Generate Parameters", () => fetchData("/api/ai/generateInterviewParameters", {
                method: "POST",
                body: payload,
            }), setUiState, "Generating parameters");

            if (!res?.ok || !res?.blueprint?.groups?.length) {
                alert("Failed to generate interview parameters. Please try again.");
                console.warn("[PARAMS] Generate response missing blueprint", res);
                return false;
            }

            setParamBlueprint(res.blueprint);
            const initialSelection = buildDefaultSelectionFromBlueprint(res.blueprint);
            setParamSelection(initialSelection);
            setParamPriorityOrder([]);
            console.log("[PARAMS] Generated blueprint loaded", {
                groups: res.blueprint?.groups?.map((g) => g?.name),
                stored: res?.stored,
            });
            return true;
        } catch (err) {
            console.error("[PARAMS] Error:", err);
            alert("Failed to generate interview parameters. Check console.");
            return false;
        } finally {
            setParamLoading(false);
            setUiState({ loadingMsg: null });
        }
    };

    const loadSavedParameters = async ({ silent = false } = {}) => {
        if (!job?._id) return false;
        console.log("[PARAMS] Loading saved parameters...", {
            jobId: job?._id,
            interviewType: form.interviewType,
            difficultyLevel: form.difficultyLevel,
        });
        const params = new URLSearchParams();
        params.set("jobId", job._id);
        params.set("interviewType", form.interviewType || "Technical");
        params.set("difficultyLevel", form.difficultyLevel || "Intermediate");

        try {
            const res = await performDeploySafeFetch(
                "Fetch Saved Parameters",
                () => fetchData(`/api/ai/interview-parameters?${params.toString()}`),
                silent ? null : setUiState,
                silent ? "" : "Loading parameters"
            );

            if (!res?.ok) return { ok: false };

            const storedBlueprint = res?.blueprint || null;
            const storedSelected = res?.selectedBlueprint || null;

            if (storedBlueprint?.groups?.length) {
                setParamBlueprint(storedBlueprint);
                if (Array.isArray(storedSelected) && storedSelected.length) {
                    setParamSelection(buildSelectionFromSavedBlueprint(storedBlueprint, storedSelected));
                    setParamPriorityOrder(buildPriorityOrderFromSelectedBlueprint(storedSelected));
                    setSavedSelectedBlueprint(storedSelected);
                } else {
                    setParamSelection(buildDefaultSelectionFromBlueprint(storedBlueprint));
                    setParamPriorityOrder([]);
                }
                console.log("[PARAMS] Loaded saved blueprint", {
                    groups: storedBlueprint.groups?.map((g) => g?.name),
                    selectedCount: Array.isArray(storedSelected) ? storedSelected.length : 0,
                    updatedAt: res?.updatedAt,
                    selectedUpdatedAt: res?.selectedUpdatedAt,
                });
                return { ok: true, blueprint: storedBlueprint, selectedBlueprint: storedSelected };
            }

            if (Array.isArray(storedSelected) && storedSelected.length) {
                const fallbackBlueprint = { groups: storedSelected };
                setParamBlueprint(fallbackBlueprint);
                setParamSelection(buildSelectionFromSavedBlueprint(fallbackBlueprint, storedSelected));
                setParamPriorityOrder(buildPriorityOrderFromSelectedBlueprint(storedSelected));
                setSavedSelectedBlueprint(storedSelected);
                console.log("[PARAMS] Loaded saved selection only (fallback blueprint)", {
                    selectedCount: storedSelected.length,
                    selectedUpdatedAt: res?.selectedUpdatedAt,
                });
                return { ok: true, blueprint: fallbackBlueprint, selectedBlueprint: storedSelected };
            }
        } catch (err) {
            console.warn("[PARAMS] Failed to fetch saved parameters:", err);
        }

        return { ok: false };
    };

    const openParamModal = async () => {
        if (!job) return;

        console.log("[PARAMS] Opening parameters modal", {
            jobId: job?._id,
            interviewType: form.interviewType,
            difficultyLevel: form.difficultyLevel,
        });
        setParamModalOpen(true);

        if (paramBlueprint && Object.keys(paramSelection || {}).length) return;

        setParamLoading(true);
        setSavedSelectedBlueprint(null);

        try {
            const loaded = await loadSavedParameters();
            if (!loaded?.ok) {
                await generateParameters();
            }
        } finally {
            setParamLoading(false);
            setUiState({ loadingMsg: null });
        }
    };

    useEffect(() => {
        if (form.interviewerType !== "AI") return;

        setForm((v) => ({ ...v, technicalScript: "", interviewers: [] }));
        setSavedSelectedBlueprint(null);
        setParamBlueprint(null);
        setParamSelection({});
        setParamPriorityOrder([]);
        // removed: if (job) openParamModal();
        // user will open the modal manually via Configure Parameters button
    }, [form.interviewType, form.difficultyLevel, form.interviewerType, job?._id]);

    useEffect(() => {
        const groups = Array.isArray(paramBlueprint?.groups)
            ? paramBlueprint.groups.filter((g) => !isExcludedGroupName(g?.name))
            : [];
        if (!groups.length) {
            setActiveParamGroup("");
            return;
        }
        const hasActive = groups.some((g) => g?.name === activeParamGroup);
        if (!hasActive) {
            setActiveParamGroup(groups[0]?.name || "");
        }
    }, [paramBlueprint, activeParamGroup]);

    useEffect(() => {
        const selectedEntries = getSelectedParameterEntries(paramBlueprint, paramSelection);
        const selectedKeys = selectedEntries.map((entry) => entry.key);

        if (!selectedKeys.length) {
            setParamPriorityOrder((prev) => (prev.length ? [] : prev));
            return;
        }

        setParamPriorityOrder((prev) => {
            const next = prev.filter((key) => selectedKeys.includes(key));
            for (const key of selectedKeys) {
                if (!next.includes(key)) {
                    next.push(key);
                }
            }

            if (
                next.length === prev.length &&
                next.every((key, index) => key === prev[index])
            ) {
                return prev;
            }

            return next;
        });
    }, [paramBlueprint, paramSelection]);

    useEffect(() => {
        if (form.interviewType !== "Coding") return;
        if (form.interviewerType === "AI" && (!form.interviewers || form.interviewers.length === 0)) {
            return;
        }

        setForm((v) => ({
            ...v,
            interviewerType: "AI",
            interviewers: [],
        }));
    }, [form.interviewType, form.interviewerType, form.interviewers]);

    const selectedParameterEntries = useMemo(() => {
        const entries = getSelectedParameterEntries(paramBlueprint, paramSelection);
        const orderLookup = new Map(
            (Array.isArray(paramPriorityOrder) ? paramPriorityOrder : []).map((key, index) => [
                key,
                index,
            ])
        );

        return entries
            .map((entry, sourceIndex) => ({ ...entry, sourceIndex }))
            .sort((a, b) => {
                const aPriority = orderLookup.has(a.key)
                    ? orderLookup.get(a.key)
                    : Number.MAX_SAFE_INTEGER;
                const bPriority = orderLookup.has(b.key)
                    ? orderLookup.get(b.key)
                    : Number.MAX_SAFE_INTEGER;
                if (aPriority !== bPriority) return aPriority - bPriority;
                return a.sourceIndex - b.sourceIndex;
            })
            .map(({ ...entry }, index) => ({
                ...entry,
                priority: index + 1,
            }));
    }, [paramBlueprint, paramSelection, paramPriorityOrder]);

    const selectedParameterPriorityMap = useMemo(
        () =>
            new Map(selectedParameterEntries.map((entry) => [entry.key, entry.priority])),
        [selectedParameterEntries]
    );

    const moveParameterPriority = (paramKey, direction) => {
        if (!paramKey || !selectedParameterEntries.length) return;

        setParamPriorityOrder((prev) => {
            const activeKeys = selectedParameterEntries.map((entry) => entry.key);
            const activeKeySet = new Set(activeKeys);
            const orderedKeys = prev.filter((key) => activeKeySet.has(key));

            for (const key of activeKeys) {
                if (!orderedKeys.includes(key)) {
                    orderedKeys.push(key);
                }
            }

            const currentIndex = orderedKeys.indexOf(paramKey);
            const nextIndex = currentIndex + direction;

            if (
                currentIndex < 0 ||
                nextIndex < 0 ||
                nextIndex >= orderedKeys.length
            ) {
                return prev;
            }

            const next = [...orderedKeys];
            [next[currentIndex], next[nextIndex]] = [next[nextIndex], next[currentIndex]];
            return next;
        });
    };




    const toggleSub = (groupName, paramName, subName, enabled) => {
        setParamSelection((prev) => {
            const groupPrev = prev[groupName] || { enabled: true, parameters: {} };
            const paramPrev = groupPrev.parameters?.[paramName] || {
                enabled: true,
                subEnabled: {},
            };
            const nextSubEnabled = {
                ...(paramPrev.subEnabled || {}),
                [subName]: enabled,
            };
            const paramEnabled = Object.values(nextSubEnabled).some(Boolean);
            const nextParameters = {
                ...(groupPrev.parameters || {}),
                [paramName]: {
                    ...paramPrev,
                    enabled: paramEnabled,
                    subEnabled: nextSubEnabled,
                },
            };
            const groupEnabled = Object.values(nextParameters).some((p) => p?.enabled);
            return {
                ...prev,
                [groupName]: {
                    ...groupPrev,
                    enabled: groupEnabled,
                    parameters: nextParameters,
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

        setParamSelection((prev) => {
            const groupPrev = prev[groupName] || { enabled: true, parameters: {} };
            const nextParameters = {
                ...(groupPrev.parameters || {}),
                [name]: { enabled: true, subEnabled: {} },
            };
            const groupEnabled = Object.values(nextParameters).some((p) => p?.enabled);
            return {
                ...prev,
                [groupName]: {
                    ...groupPrev,
                    enabled: groupEnabled,
                    parameters: nextParameters,
                },
            };
        });

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
        setParamSelection((prev) => {
            const groupPrev = prev[groupName] || { enabled: true, parameters: {} };
            const paramPrev = groupPrev.parameters?.[paramName] || {
                enabled: true,
                subEnabled: {},
            };
            const nextSubEnabled = {
                ...(paramPrev.subEnabled || {}),
                [sub]: true,
            };
            const paramEnabled = Object.values(nextSubEnabled).some(Boolean);
            const nextParameters = {
                ...(groupPrev.parameters || {}),
                [paramName]: {
                    ...paramPrev,
                    enabled: paramEnabled,
                    subEnabled: nextSubEnabled,
                },
            };
            const groupEnabled = Object.values(nextParameters).some((p) => p?.enabled);
            return {
                ...prev,
                [groupName]: {
                    ...groupPrev,
                    enabled: groupEnabled,
                    parameters: nextParameters,
                },
            };
        });

        setManualSubInput((prev) => ({ ...prev, [key]: "" }));
    };

    const handleSaveParameters = async () => {
        const selected = buildSelectedBlueprint(
            paramBlueprint,
            paramSelection,
            selectedParameterEntries.map((entry) => entry.key)
        );
        if (!selected.length) {
            alert("Please select at least one parameter.");
            return;
        }
        console.log("[PARAMS] Saving parameters...", {
            jobId: job?._id,
            interviewType: form.interviewType,
            difficultyLevel: form.difficultyLevel,
            selectedGroups: selected.map((g) => g?.name),
        });
        if (job?._id) {
            try {
                await performDeploySafeFetch(
                    "Save Parameters",
                    () => fetchData("/api/ai/interview-parameters/save", {
                        method: "POST",
                        body: {
                            jobId: job._id,
                            interviewType: form.interviewType || "Technical",
                            difficultyLevel: form.difficultyLevel || "Intermediate",
                            blueprint: paramBlueprint,
                            selectedBlueprint: selected,
                        },
                    }),
                    setUiState,
                    "Saving parameters"
                );
                console.log("[PARAMS] Parameters saved to DB");
            } catch (err) {
                console.warn("[PARAMS] Failed to persist parameters:", err);
                alert("Parameters saved locally, but failed to store in DB.");
            } finally {
                setUiState({ loadingMsg: null });
            }
        }
        setSavedSelectedBlueprint(selected);
        setParamModalOpen(false);
        // Auto-generate script on save
        handleGenerateScript(selected);
    };

    /* -----------------------------
       Script generation
    ----------------------------- */

    const handleGenerateScript = async (manualBlueprint = null) => {
        if (!candidate || !job) {
            alert("Candidate or job details are missing. Please reload.");
            return;
        }

        if (form.interviewerType === "AI") {
            // Use manually provided blueprint or the saved one
            const blueprintToUse = manualBlueprint || savedSelectedBlueprint;
            if (!blueprintToUse || !blueprintToUse.length) {
                alert("Please configure and save interview parameters first.");
                setParamModalOpen(true);
                return;
            }
        }

        const durationValue = Number(form.durationMinutes || 45);

        setIsGeneratingScript(true);
        setForm((prev) => ({ ...prev, technicalScript: "" }));

        try {
            const payload = {
                roundType: "First screening round",
                interviewType: form.interviewType || "Technical",
                difficultyLevel: form.difficultyLevel || "Intermediate",
                scriptStyle: form.scriptStyle || "Compact",
                durationMinutes: durationValue,
                selectedBlueprint: manualBlueprint || savedSelectedBlueprint || [],
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

            const res = await performDeploySafeFetch("Generate Script", () => fetchData("/api/ai/generateTechnicalScript", {
                method: "POST",
                body: payload,
            }), setUiState, "Generating script");

            if (!res?.ok || !res?.script) {
                alert("Script generation failed. Please try again.");
                return;
            }

            setForm((prev) => ({ ...prev, technicalScript: res.script }));
            scriptGeneratedRef.current = true;
            lastScriptDurationRef.current = durationValue;
        } catch (err) {
            console.error("[SCRIPT] Error:", err);
            alert("Failed to generate interview script. Check console.");
        } finally {
            setIsGeneratingScript(false);
            setUiState({ loadingMsg: null });

            if (pendingDurationRef.current !== null) {
                pendingDurationRef.current = null;
                const currentDuration = Number(form.durationMinutes || 0);
                const shouldRetry =
                    scriptGeneratedRef.current &&
                    form.interviewType !== "Coding" &&
                    (form.interviewerType || "AI") === "AI" &&
                    form.technicalScript?.trim() &&
                    Number.isFinite(currentDuration) &&
                    (lastScriptDurationRef.current == null || currentDuration !== lastScriptDurationRef.current);
                if (shouldRetry) {
                    handleGenerateScript();
                }
            }
        }
    };

    useEffect(() => {
        const currentDuration = Number(form.durationMinutes || 0);
        if (lastDurationRef.current === null) {
            lastDurationRef.current = currentDuration;
            return;
        }
        if (currentDuration === lastDurationRef.current) return;

        lastDurationRef.current = currentDuration;

        const isAiSpeakingRound =
            form.interviewType !== "Coding" &&
            (form.interviewerType || "AI") === "AI";

        if (!isAiSpeakingRound) return;
        if (!scriptGeneratedRef.current) return;
        if (!form.technicalScript?.trim()) return;

        if (isGeneratingScript) {
            pendingDurationRef.current = currentDuration;
            return;
        }

        if (lastScriptDurationRef.current != null && currentDuration === lastScriptDurationRef.current) {
            return;
        }

        handleGenerateScript();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        form.durationMinutes,
        form.interviewType,
        form.interviewerType,
        form.technicalScript,
        isGeneratingScript,
    ]);

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
                        extractRes = await performDeploySafeFetch("Extract PDF Text", () => fetchData("/api/ai/extractPdfText", {
                            method: "POST",
                            body: formData,
                        }), setUiState, "Parsing PDF");
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

            const res = await performDeploySafeFetch("Generate Coding Problem", () => fetchData("/api/ai/generateCodingProblem", {
                method: "POST",
                body: payload,
            }), setUiState, "Generating coding problem");

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
            setUiState({ loadingMsg: null });
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
            .map((item) => {
                const atsIdValue = item?.ats?._id || atsid;
                const override = scheduleOverridesByAtsId[String(atsIdValue || "")] || {};
                const resolvedTargetStageId =
                    /^[0-9a-fA-F]{24}$/.test(String(override?.targetStageId || ''))
                        ? String(override.targetStageId)
                        : (
                            baseSelection.length === 1 && /^[0-9a-fA-F]{24}$/.test(String(stageIdParam || ''))
                                ? String(stageIdParam)
                                : ''
                        );
                const resolvedTargetStageTitle = String(
                    override?.targetStageTitle ||
                    (baseSelection.length === 1 ? stageTitleParam : '') ||
                    ''
                ).trim();

                return {
                    atsId: atsIdValue,
                    candidateId: item?.candidate?._id,
                    jobId: item?.job?._id || job?._id,
                    targetStageId: resolvedTargetStageId,
                    targetStageTitle: resolvedTargetStageTitle,
                    label:
                        `${item?.candidate?.firstName || ""} ${item?.candidate?.lastName || ""}`.trim() ||
                        item?.candidate?.email ||
                        "Candidate",
                };
            })
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
        const normalizeInterviewDate = (value) => {
            if (value instanceof Date) {
                const year = value.getFullYear();
                const month = String(value.getMonth() + 1).padStart(2, "0");
                const day = String(value.getDate()).padStart(2, "0");
                return `${year}-${month}-${day}`;
            }
            const raw = String(value || "").trim();
            if (!raw) return "";
            if (raw.includes("/")) {
                const [d, m, y] = raw.split("/");
                return `${y}-${m}-${d}`;
            }
            if (raw.includes("-")) {
                const part1 = raw.split("-")[0];
                if (part1.length === 2) {
                    const [d, m, y] = raw.split("-");
                    return `${y}-${m}-${d}`;
                }
                return raw.split("T")[0];
            }
            return raw.split("T")[0];
        };

        const hasScheduleOverrides = Object.keys(scheduleOverridesByAtsId || {}).length > 0;
        const baseDateStr = normalizeInterviewDate(form.interviewDate);
        const baseTimeStr = form.startTime;
        const needsBaseSchedule = scheduleTargets.some((t) => {
            const override = scheduleOverridesByAtsId[String(t.atsId || "")];
            if (!override) return true;
            if (typeof override === "string") return false;
            return !override?.scheduleAt;
        });

        if (needsBaseSchedule && (!baseDateStr || !baseTimeStr)) {
            alert("Date and Start Time are required.");
            return;
        }

        if (
            (form.interviewerType === "Human" || form.interviewerType === "Human+AI") &&
            anyConflict &&
            !hasScheduleOverrides
        ) {
            alert("Selected time overlaps with an interviewer's schedule.");
            return;
        }
        if (
            (form.interviewerType === "Human" || form.interviewerType === "Human+AI") &&
            (!form.interviewers || form.interviewers.length === 0)
        ) {
            alert("Select at least one interviewer for Human or Human + AI.");
            return;
        }

        let effectiveSelectedBlueprint = savedSelectedBlueprint;
        if (
            isSpeakingRound &&
            form.interviewerType === "AI" &&
            form.interviewMode !== "Onsite" &&
            (!effectiveSelectedBlueprint || !effectiveSelectedBlueprint.length)
        ) {
            const loaded = await loadSavedParameters({ silent: true });
            if (loaded?.selectedBlueprint?.length) {
                effectiveSelectedBlueprint = loaded.selectedBlueprint;
            }
        }

        // Validate AI parameters only for Speaking rounds
        if (
            isSpeakingRound &&
            form.interviewerType === "AI" &&
            form.interviewMode !== "Onsite" &&
            (!effectiveSelectedBlueprint || !effectiveSelectedBlueprint.length)
        ) {
            alert("Save interview parameters before scheduling.");
            setParamModalOpen(true);
            return;
        }

        // Validate script only for Speaking rounds
        if (
            isSpeakingRound &&
            form.interviewerType === "AI" &&
            !form.technicalScript.trim()
        ) {
            showAlert("Interview script is required. Please generate or enter the script before scheduling.");
            return;
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
            setLoading(true);
            const failures = [];
            const durationMinutes = Number(form.durationMinutes || 45);
            const resolveScheduleForTarget = (t) => {
                const override = scheduleOverridesByAtsId[String(t.atsId || "")];
                const overrideIso =
                    typeof override === "string" ? override : override?.scheduleAt;
                if (overrideIso) {
                    const dt = new Date(overrideIso);
                    if (!Number.isNaN(dt.getTime())) {
                        const dateStr = `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`;
                        const timeStr = `${pad2(dt.getHours())}:${pad2(dt.getMinutes())}`;
                        return {
                            dateStr,
                            timeStr,
                            startAt: dt,
                            durationMinutes:
                                Number(override?.durationMinutes) || durationMinutes,
                        };
                    }
                }

                if (!baseDateStr || !baseTimeStr) {
                    return {
                        dateStr: "",
                        timeStr: "",
                        startAt: null,
                        durationMinutes,
                    };
                }
                const [sy, sm, sd] = baseDateStr.split("-");
                const [sh, smin] = baseTimeStr.split(":");
                const dt = new Date(+sy, +sm - 1, +sd, +sh, +smin);
                return {
                    dateStr: baseDateStr,
                    timeStr: baseTimeStr,
                    startAt: dt,
                    durationMinutes,
                };
            };

            const hasConflictAt = (startAt, minutes) => {
                if (!startAt || !selectedInterviewers.length) return false;
                const endAt = new Date(startAt.getTime() + minutes * 60000);
                for (const pick of selectedInterviewers) {
                    const list = schedulesByInterviewerId[pick.id] || [];
                    for (const s of list) {
                        if (!s.startAt || !s.durationMinutes) continue;
                        const sStart = new Date(s.startAt);
                        const sEnd = s.endedAt
                            ? new Date(s.endedAt)
                            : new Date(new Date(s.startAt).getTime() + s.durationMinutes * 60000);
                        if (overlaps(startAt, endAt, sStart, sEnd)) {
                            return true;
                        }
                    }
                }
                return false;
            };

            for (const target of scheduleTargets) {
                const resolved = resolveScheduleForTarget(target);
                if (!resolved.dateStr || !resolved.timeStr || !resolved.startAt) {
                    failures.push({
                        label: target.label,
                        message: "Missing interview date/time for this candidate.",
                    });
                    continue;
                }
                if (resolved.startAt < new Date()) {
                    failures.push({
                        label: target.label,
                        message: "Selected interview time has passed.",
                    });
                    continue;
                }
                if (
                    (form.interviewerType === "Human" || form.interviewerType === "Human+AI") &&
                    hasConflictAt(resolved.startAt, resolved.durationMinutes)
                ) {
                    failures.push({
                        label: target.label,
                        message: "Selected time overlaps with an interviewer's schedule.",
                    });
                    continue;
                }

                const payload = {
                    candidateATS: target.atsId,
                    candidate: target.candidateId,
                    job: target.jobId,
                    targetStageId: target.targetStageId || undefined,
                    targetStageTitle: target.targetStageTitle || undefined,
                    interviewMode: form.interviewMode,
                    locationAddress: form.interviewMode === "Onsite" ? form.locationAddress : null,
                    meetingLink: (form.interviewMode === "Virtual" || form.interviewMode === "Virtual + Onsite") ? null : form.meetingLink,
                    interviewDate: resolved.dateStr,
                    startTime: resolved.timeStr,
                    durationMinutes: resolved.durationMinutes,
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
                        selectedBlueprint: effectiveSelectedBlueprint || [],
                    }),

                    notes: form.notes,
                    interviewers: form.interviewers,
                    technicalScript: isSpeakingRound ? form.technicalScript : "",
                };

                try {
                    const createdInterview = await performDeploySafeFetch("createInterview", () => fetchData(`/api/interviewschedules`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(payload),
                    }), setUiState, "Scheduling interview");

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

                            const problemRes = await performDeploySafeFetch("createCodingProblem", () => fetchData(`/api/codejudge/interviews/${createdInterview._id}/problems`, {
                                method: "POST",
                                headers: { "Content-Type": "application/json" },
                                body: JSON.stringify(problemPayload)
                            }), setUiState, "Creating coding problem");

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

                                await performDeploySafeFetch("createTestCases", () => fetchData(`/api/codejudge/problems/${problemRes.problemId}/testcases`, {
                                    method: "POST",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify(testCasesPayload)
                                }), setUiState, "Saving test cases");
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
            console.error("Failed to schedule interviews", err);
            alert("Failed to schedule interviews. See console for details.");
        } finally {
            setLoading(false);
            setUiState({ loadingMsg: null });
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











    return (
        <Box
            sx={{
                backgroundColor: theme.palette.background.default, // Light neutral background
                minHeight: "100vh",
                p: { xs: 2, sm: 3 },
                pl: { xs: 2, sm: 3, md: 6 },
            }}
        >
            <MUIAlert
                open={alertCfg.open}
                message={alertCfg.message || ""}
                severity={alertCfg.severity || "error"}
                onClose={closeAlert}
            />

            <Box sx={{ pl: { xs: 0, sm: 0, md: 1 }, mb: 3 }}>
                <Typography
                    variant="h5"
                    sx={{ fontWeight: 600, color: theme.palette.text.primary }}
                >
                    Interview Schedule
                </Typography>
            </Box>

            {/* CANDIDATE CARD */}
            {hasMultipleCandidates ? (
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
                            <PersonIcon color="primary" /> Candidate Details ({selectedCandidates.length})
                        </Typography>
                        <Divider sx={{ mb: 3 }} />

                        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, px: 1.5 }}>
                            {(selectedCandidates || []).map((item, idx) => {
                                const cand = item?.candidate || {};
                                return (
                                    <Box
                                        key={cand?._id || idx}
                                        sx={{
                                            width: { xs: "100%", sm: "calc(50% - 8px)", md: "calc(33.33% - 11px)" },
                                        }}
                                    >
                                        <Box
                                            sx={{
                                                p: 2,
                                                borderRadius: 2,
                                                border: "1px solid",
                                                borderColor: "divider",
                                                height: "100%",
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
                                    </Box>
                                );
                            })}
                        </Box>
                    </CardContent>
                </Card>
            ) : (
                candidate && (
                    <>
                        {/* 1. Candidate Details Card */}
                        <Card
                            sx={{
                                bgcolor: theme.palette.background.paper,
                                borderRadius: '14px',
                                border: `1px solid ${theme.palette.divider}`,
                                boxShadow: `0 8px 24px ${alpha(theme.palette.common.black, 0.12)}`,
                                p: 3,
                                mb: 3,
                                overflow: 'visible' // Ensure shadows/etc don't get clipped
                            }}
                        >
                            <CandidateCard candidate={{
                                id: candidate._id,
                                name: `${candidate.firstName || ""} ${candidate.lastName || ""}`.trim(),
                                email: candidate.email || "N/A",
                                phone: candidate.phone || candidate.phoneNumber || "N/A",
                                createdAt: candidate.createdAt ? new Date(candidate.createdAt).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "N/A",
                                experience: candidate.experience || "N/A",
                                status: "Active",
                                hardSkills: candidate.skills ? candidate.skills.map((s) => typeof s === 'object' ? Object.keys(s)[0] : s) : [],
                                softSkills: [],
                                jobTitle: job?.title || "N/A",
                                company: job?.company?.name || job?.company || "N/A",
                                postedOn: job?.postedOn ? new Date(job.postedOn).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "N/A",
                                jobType: job?.jobType || "N/A",
                                location: job?.location || job?.locations?.[0] || "N/A",
                                avatarUrl: candidate.profileImage || ""
                            }} />
                        </Card>

                        {/* 2. Candidate Progress Card */}
                        <Card
                            sx={{
                                bgcolor: theme.palette.background.paper,
                                borderRadius: '14px',
                                border: `1px solid ${theme.palette.divider}`,
                                boxShadow: `0 8px 24px ${alpha(theme.palette.common.black, 0.12)}`,
                                p: 3,
                                mb: 3
                            }}
                        >
                            <CandidateProgress stageResults={ats?.stageResults || []} />
                        </Card>
                    </>
                )
            )}

            {/* JOB DETAILS (Only show if multiple candidates are selected, otherwise it's in CandidateCard) */}
            {job && hasMultipleCandidates && (
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

                        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2, px: 1.5 }}>
                            <Box sx={{ width: { xs: "100%", sm: "calc(33.33% - 11px)" } }}>
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
                            </Box>

                            <Box sx={{ width: { xs: "100%", sm: "calc(33.33% - 11px)" } }}>
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
                            </Box>

                            <Box sx={{ width: { xs: "100%", sm: "calc(33.33% - 11px)" } }}>
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
                            </Box>
                        </Box>
                    </CardContent>
                </Card>
            )}



            {/* NEW 2-PANEL LAYOUT */}
            {/* NEW 2-PANEL LAYOUT */}
            <Box sx={{
                display: { xs: 'flex', md: 'grid' },
                flexDirection: { xs: 'column' },
                gridTemplateColumns: { md: (form.interviewerType || 'AI') === 'AI' ? '1fr 1fr' : '1fr' },
                gap: 3,
                alignItems: 'stretch' // Ensure the row height is defined by the tallest item (Left Panel)
            }}>

                {/* LEFT PANEL: FORM */}
                <Box
                    sx={{
                        // Remove 'flex: 1' as it's now a grid item
                        bgcolor: theme.palette.background.paper,
                        borderRadius: '12px',
                        border: `1px solid ${theme.palette.divider}`,
                        boxShadow: `0 4px 12px ${alpha(theme.palette.common.black, 0.1)}`,
                        p: 3,
                        display: 'flex',
                        flexDirection: 'column',
                        minHeight: 0
                    }}
                >
                    <InterviewScheduleForm
                        form={form}
                        setForm={setForm}
                        candidate={candidate}
                        selectedCandidates={selectedCandidates}
                        job={job}
                        jobs={[]}
                        availableInterviewers={availableInterviewers}
                        interviewerLabelsById={interviewerLabelsById}
                        handleInterviewerChange={handleInterviewerChange}
                        interviewerScheduleGroups={selectedInterviewerScheduleGroups}
                        setCodingModalOpen={setCodingModalOpen}
                        openParamModal={openParamModal}
                        paramLoading={paramLoading}
                        availableLanguages={availableLanguages}
                        codingConfig={codingConfig}
                        setCodingConfig={setCodingConfig}
                        savedSelectedBlueprint={savedSelectedBlueprint}
                        onCheckDemo={() => {
                            if (form.interviewType === 'Coding') {
                                setCodingModalOpen(true);
                            } else {
                                handleGenerateScript();
                            }
                        }}
                        onSchedule={handleSubmit}
                        isScheduling={loading}
                    />
                </Box>

                {/* RIGHT PANEL: OUTPUT */}
                {(form.interviewerType || 'AI') === 'AI' && (
                    <Box sx={{
                        position: { xs: 'static', md: 'relative' },
                        minHeight: { xs: '60vh', md: 0 },
                        // On desktop, this wrapper acts as the grid cell that stretches to the row height.
                    }}>
                        <Box sx={{
                            // Visual styles moved to this absolute container
                            bgcolor: theme.palette.background.paper,
                            borderRadius: '12px',
                            border: `1px solid ${theme.palette.divider}`,
                            boxShadow: `0 4px 12px ${alpha(theme.palette.common.black, 0.1)}`,
                            p: 3,
                            display: 'flex',
                            flexDirection: 'column',

                            // Absolute fill on desktop
                            position: { xs: 'static', md: 'absolute' },
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,

                            overflow: 'hidden'
                        }}>
                            <InterviewOutputPanel
                                interviewType={form.interviewType}
                                technicalScript={form.technicalScript}
                                isCodingRound={isCodingRound}
                                codingRoundData={codingRoundData}
                                showFullProblemDesc={showFullProblemDesc}
                                setShowFullProblemDesc={setShowFullProblemDesc}
                                activeTestCase={activeTestCase}
                                setActiveTestCase={setActiveTestCase}
                                onGenerate={() => {
                                    if (form.interviewType === 'Coding') {
                                        setCodingModalOpen(true);
                                    } else {
                                        handleGenerateScript();
                                    }
                                }}
                                isGenerating={isGeneratingScript}
                                onScriptChange={(next) => {
                                    setForm((prev) => ({ ...prev, technicalScript: next }));
                                }}
                                onEdit={() => { }}
                                onDone={() => { }}
                            />
                        </Box>
                    </Box>
                )}

            </Box>




            {/* Coding Modal */}
            < Dialog
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
                }
                }
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
                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2 }}>
                        <Box sx={{ width: { xs: "100%", md: isPdfQuestionType ? "calc(66.66% - 11px)" : "100%" } }}>
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
                                    <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2 }}>
                                        <Box sx={{ width: { xs: "100%", md: "calc(33.33% - 11px)" } }}>
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
                                        </Box>
                                        <Box sx={{ width: { xs: "100%", md: "calc(33.33% - 11px)" } }}>
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
                                        </Box>
                                        <Box sx={{ width: { xs: "100%", md: "calc(33.33% - 11px)" } }}>
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
                                        </Box>
                                    </Box>
                                    <Divider sx={{ my: 2 }} />
                                    <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                                        Allowed Languages
                                    </Typography>
                                    {availableLanguages.length ? (
                                        <FormControl component="fieldset">
                                            <Box sx={{ display: "flex", flexWrap: "wrap", gap: 2 }}>
                                                {availableLanguages.map((lang) => {
                                                    const langId = normalizeLanguageId(
                                                        lang?.judge0Id ?? lang?._id ?? lang
                                                    );
                                                    if (langId === "" || langId === undefined) return null;
                                                    const selected = normalizeAllowedLanguageIds(
                                                        codingConfig.allowedLanguages
                                                    ).some((id) => String(id) === String(langId));
                                                    return (
                                                        <FormControlLabel
                                                            key={String(langId)}
                                                            control={
                                                                <Checkbox
                                                                    checked={selected}
                                                                    onChange={(e) => {
                                                                        const checked = e.target.checked;
                                                                        setCodingConfig((prev) => {
                                                                            const current = normalizeAllowedLanguageIds(
                                                                                prev.allowedLanguages
                                                                            );
                                                                            const next = checked
                                                                                ? normalizeAllowedLanguageIds([
                                                                                    ...current,
                                                                                    langId,
                                                                                ])
                                                                                : current.filter(
                                                                                    (id) => String(id) !== String(langId)
                                                                                );
                                                                            return {
                                                                                ...prev,
                                                                                allowedLanguages: next,
                                                                            };
                                                                        });
                                                                    }}
                                                                />
                                                            }
                                                            label={lang?.name || `Language ${langId}`}
                                                        />
                                                    );
                                                })}
                                            </Box>
                                        </FormControl>
                                    ) : (
                                        <Typography variant="body2" color="text.secondary">
                                            No languages available yet.
                                        </Typography>
                                    )}
                                </CardContent>
                            </Card>
                        </Box>

                        {isPdfQuestionType && (
                            <Box sx={{ width: { xs: "100%", md: "calc(33.33% - 11px)" } }}>
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
                            </Box>
                        )}
                    </Box>
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
            </Dialog >

            {/* Parameter Modal */}
            < Dialog
                open={paramModalOpen}
                onClose={() => setParamModalOpen(false)}
                fullWidth
                maxWidth="md"
                scroll="paper"
                PaperProps={{
                    sx: {
                        borderRadius: 3,
                        background: paramModalPaperBg,
                        boxShadow: "0 24px 60px rgba(15, 23, 42, 0.22)",
                        border: `1px solid ${paramModalBorder}`,
                        overflow: "hidden",
                    },
                }}
            >
                <DialogTitle
                    sx={{
                        px: 3,
                        py: 2,
                        position: "sticky",
                        top: 0,
                        zIndex: 2,
                        background: paramModalHeaderBg,
                        borderBottom: `1px solid ${paramModalBorder}`,
                        backdropFilter: "blur(6px)",
                    }}
                >
                    <Box
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: 2,
                        }}
                    >
                        <Typography
                            variant="h6"
                            sx={{
                                fontWeight: 600,
                                letterSpacing: 0.2,
                                color: theme.palette.text.primary,
                            }}
                        >
                            Configure Interview Parameters
                        </Typography>
                        <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
                            <Typography
                                variant="body2"
                                sx={{
                                    color: theme.palette.primary.main,
                                    fontWeight: 600,
                                }}
                            >
                                {form.interviewType} • {form.difficultyLevel}
                            </Typography>
                            <MUIButton
                                size="small"
                                variant="outlined"
                                onClick={() => generateParameters()}
                                disabled={paramLoading}
                                sx={{ borderRadius: 999 }}
                            >
                                Generate Parameters
                            </MUIButton>
                        </Box>
                    </Box>
                </DialogTitle>

                <DialogContent
                    dividers={false}
                    sx={{
                        px: 3,
                        py: 2,
                        background: "transparent",
                        overflowY: "auto",
                    }}
                >
                    {paramLoading ? (
                        <Typography>Loading parameters...</Typography>
                    ) : !paramBlueprint?.groups?.length ? (
                        <Typography color="text.secondary">
                            No parameters loaded. Close and retry.
                        </Typography>
                    ) : (
                        <>
                            <Box
                                sx={{
                                    mb: 2,
                                    px: 2,
                                    py: 1.5,
                                    borderRadius: 2,
                                    background: alpha(
                                        theme.palette.primary.main,
                                        0.08
                                    ),
                                    border: `1px solid ${alpha(
                                        theme.palette.primary.main,
                                        0.14
                                    )}`,
                                }}
                            >
                                <Typography variant="body2" color="text.secondary">
                                    Select the parameters and sub-parameters to
                                    evaluate, then adjust their priority. The AI
                                    interviewer will cover lower priority numbers
                                    first, and script generation will use ONLY what
                                    you save here.
                                </Typography>
                            </Box>

                            {/* Priority compact row */}
                            <Box
                                sx={{
                                    mb: 2.5,
                                    px: 2,
                                    py: 1.5,
                                    borderRadius: 2,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    gap: 1.5,
                                    flexWrap: "wrap",
                                    background: selectedParameterEntries.length
                                        ? alpha(theme.palette.primary.main, isDark ? 0.1 : 0.06)
                                        : alpha(theme.palette.text.disabled, 0.06),
                                    border: `1px solid ${alpha(
                                        theme.palette.primary.main,
                                        selectedParameterEntries.length ? (isDark ? 0.28 : 0.18) : 0.08
                                    )}`,
                                }}
                            >
                                <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, minWidth: 0 }}>
                                    <Box
                                        sx={{
                                            width: 32,
                                            height: 32,
                                            borderRadius: "50%",
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            background: selectedParameterEntries.length
                                                ? alpha(theme.palette.primary.main, 0.15)
                                                : alpha(theme.palette.text.disabled, 0.12),
                                            flexShrink: 0,
                                        }}
                                    >
                                        <Typography
                                            variant="caption"
                                            sx={{
                                                fontWeight: 800,
                                                fontSize: "0.7rem",
                                                color: selectedParameterEntries.length
                                                    ? theme.palette.primary.main
                                                    : theme.palette.text.disabled,
                                            }}
                                        >
                                            {selectedParameterEntries.length || "0"}
                                        </Typography>
                                    </Box>
                                    <Box sx={{ minWidth: 0 }}>
                                        <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                                            Priority Order
                                        </Typography>
                                        <Typography variant="caption" color="text.secondary" noWrap>
                                            {selectedParameterEntries.length
                                                ? selectedParameterEntries.slice(0, 3).map((e) => e.paramName).join(" → ") +
                                                (selectedParameterEntries.length > 3 ? ` +${selectedParameterEntries.length - 3} more` : "")
                                                : "Select parameters below to set priority"}
                                        </Typography>
                                    </Box>
                                </Box>
                                <MUIButton
                                    size="small"
                                    variant={selectedParameterEntries.length ? "contained" : "outlined"}
                                    onClick={() => setPriorityModalOpen(true)}
                                    disabled={!selectedParameterEntries.length}
                                    sx={{ borderRadius: 999, flexShrink: 0, fontWeight: 600, textTransform: "none" }}
                                >
                                    Set Priority Order
                                </MUIButton>
                            </Box>

                            {(() => {
                                const groups = Array.isArray(paramBlueprint?.groups)
                                    ? paramBlueprint.groups
                                    : [];
                                const activeName = activeParamGroup || groups[0]?.name || "";
                                const activeIndex = Math.max(
                                    0,
                                    groups.findIndex((g) => g?.name === activeName)
                                );
                                const visibleGroups = activeName
                                    ? groups.filter((g) => g?.name === activeName)
                                    : groups;

                                return (
                                    <>
                                        {groups.length > 1 && (
                                            <Box
                                                sx={{
                                                    mb: 2,
                                                    display: "inline-flex",
                                                    maxWidth: '100%',
                                                    px: 0.5,
                                                    py: 0.5,
                                                    borderRadius: 2,
                                                    background: alpha(
                                                        theme.palette.primary.main,
                                                        0.06
                                                    ),
                                                    border: `1px solid ${alpha(
                                                        theme.palette.primary.main,
                                                        0.18
                                                    )}`,
                                                }}
                                            >
                                                <Tabs
                                                    value={activeIndex}
                                                    onChange={(e, idx) =>
                                                        setActiveParamGroup(
                                                            groups[idx]?.name || ""
                                                        )
                                                    }
                                                    variant="scrollable"
                                                    scrollButtons="auto"
                                                    allowScrollButtonsMobile
                                                    TabIndicatorProps={{
                                                        sx: { display: "none" },
                                                    }}
                                                    sx={{
                                                        minHeight: 36,
                                                        borderRadius: 1.5,
                                                        "& .MuiTabs-flexContainer": {
                                                            gap: 0,
                                                        },
                                                        "& .MuiTabs-scrollButtons": {
                                                            borderRadius: 1,
                                                        },
                                                    }}
                                                >
                                                    {groups.map((g, idx) => {
                                                        const isActive = idx === activeIndex;
                                                        const isLast = idx === groups.length - 1;
                                                        return (
                                                            <Tab
                                                                key={g.name}
                                                                label={g.name}
                                                                sx={{
                                                                    textTransform: "none",
                                                                    minHeight: 34,
                                                                    minWidth: 110,
                                                                    px: 2,
                                                                    borderRadius: 1.5,
                                                                    fontWeight: isActive ? 700 : 600,
                                                                    color: isActive
                                                                        ? theme.palette.primary.main
                                                                        : theme.palette.text.secondary,
                                                                    bgcolor: isActive
                                                                        ? alpha(
                                                                            theme.palette.primary.main,
                                                                            0.14
                                                                        )
                                                                        : "transparent",
                                                                    borderRight: isLast
                                                                        ? "none"
                                                                        : `1px solid ${alpha(
                                                                            theme.palette.primary.main,
                                                                            0.16
                                                                        )}`,
                                                                }}
                                                            />
                                                        );
                                                    })}
                                                </Tabs>
                                            </Box>
                                        )}

                                        {visibleGroups
                                            .filter((g) => !isExcludedGroupName(g?.name))
                                            .map((g) => {
                                                const gSel = paramSelection?.[g.name];

                                                return (
                                                    <Box key={g.name} sx={{ mb: 4 }}>
                                                        {/* Group header removed as requested */}
                                                        {(g.parameters || []).map((p) => {
                                                            const pSel =
                                                                gSel?.parameters?.[p.name];
                                                            const paramKey = buildParamPriorityKey(
                                                                g.name,
                                                                p.name
                                                            );
                                                            const subList = Array.isArray(
                                                                p.subparameters
                                                            )
                                                                ? p.subparameters
                                                                : [];
                                                            const subKey = `${g.name}|${p.name}`;

                                                            const selectedCount =
                                                                countSelectedSubs(pSel);
                                                            const totalSubs = subList.length;
                                                            const isParamActive =
                                                                isParameterSelected(pSel);
                                                            const paramPriority =
                                                                selectedParameterPriorityMap.get(
                                                                    paramKey
                                                                );
                                                            const helperText = isParamActive
                                                                ? totalSubs
                                                                    ? `${selectedCount}/${totalSubs} sub-parameters selected`
                                                                    : "Standalone parameter selected"
                                                                : totalSubs
                                                                    ? "Select sub-parameters to include this topic"
                                                                    : "Add sub-parameters to expand this topic";

                                                            return (
                                                                <Box
                                                                    key={p.name}
                                                                    sx={{
                                                                        border: "1px solid",
                                                                        borderColor: alpha(
                                                                            theme.palette.primary.main,
                                                                            isDark ? 0.25 : 0.14
                                                                        ),
                                                                        borderRadius: 2,
                                                                        p: 2,
                                                                        mb: 2,
                                                                        ml: 0.5,
                                                                        background: isDark
                                                                            ? alpha(theme.palette.common.white, 0.03)
                                                                            : alpha(theme.palette.common.white, 0.92),
                                                                        boxShadow:
                                                                            "0 6px 14px rgba(15, 23, 42, 0.06)",
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
                                                                        <Box
                                                                            sx={{
                                                                                flex: 1,
                                                                                minWidth: 0,
                                                                            }}
                                                                        >
                                                                            <Typography
                                                                                sx={{
                                                                                    fontWeight: isParamActive ? 700 : 600,
                                                                                    color: isParamActive
                                                                                        ? theme.palette.primary.main
                                                                                        : theme.palette.text.primary,
                                                                                }}
                                                                            >
                                                                                {p.name}
                                                                            </Typography>
                                                                            <Typography
                                                                                variant="caption"
                                                                                color="text.secondary"
                                                                            >
                                                                                {helperText}
                                                                            </Typography>
                                                                        </Box>

                                                                        {isParamActive ? (
                                                                            <Stack
                                                                                direction="row"
                                                                                spacing={0.5}
                                                                                alignItems="center"
                                                                            >
                                                                                <Chip
                                                                                    size="small"
                                                                                    color="primary"
                                                                                    label={`#${paramPriority}`}
                                                                                    sx={{
                                                                                        fontWeight: 700,
                                                                                    }}
                                                                                />
                                                                                <IconButton
                                                                                    size="small"
                                                                                    onClick={() =>
                                                                                        moveParameterPriority(
                                                                                            paramKey,
                                                                                            -1
                                                                                        )
                                                                                    }
                                                                                    disabled={
                                                                                        paramPriority === 1
                                                                                    }
                                                                                    aria-label={`Move ${p.name} up`}
                                                                                >
                                                                                    <KeyboardArrowUpRoundedIcon fontSize="small" />
                                                                                </IconButton>
                                                                                <IconButton
                                                                                    size="small"
                                                                                    onClick={() =>
                                                                                        moveParameterPriority(
                                                                                            paramKey,
                                                                                            1
                                                                                        )
                                                                                    }
                                                                                    disabled={
                                                                                        paramPriority ===
                                                                                        selectedParameterEntries.length
                                                                                    }
                                                                                    aria-label={`Move ${p.name} down`}
                                                                                >
                                                                                    <KeyboardArrowDownRoundedIcon fontSize="small" />
                                                                                </IconButton>
                                                                            </Stack>
                                                                        ) : null}
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
                                                                                        disabled={false}
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
                                                                            placeholder="Add sub-parameter"
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
                                                                            InputProps={{
                                                                                endAdornment: (
                                                                                    <InputAdornment position="end">
                                                                                        <IconButton
                                                                                            edge="end"
                                                                                            onClick={() =>
                                                                                                addManualSubparameter(
                                                                                                    g.name,
                                                                                                    p.name
                                                                                                )
                                                                                            }
                                                                                            size="small"
                                                                                            aria-label="Add sub-parameter"
                                                                                        >
                                                                                            <AddRoundedIcon fontSize="small" />
                                                                                        </IconButton>
                                                                                    </InputAdornment>
                                                                                ),
                                                                            }}
                                                                            sx={{
                                                                                "& .MuiOutlinedInput-root": {
                                                                                    background: alpha(
                                                                                        theme.palette.common.white,
                                                                                        isDark ? 0.03 : 0.9
                                                                                    ),
                                                                                    borderRadius: 2,
                                                                                },
                                                                            }}
                                                                        />
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
                                                    </Box>
                                                );
                                            })}
                                    </>
                                );
                            })()}
                        </>
                    )}
                </DialogContent>

                <DialogActions
                    sx={{
                        px: 3,
                        py: 2,
                        position: "sticky",
                        bottom: 0,
                        zIndex: 2,
                        background: paramModalHeaderBg,
                        borderTop: `1px solid ${paramModalBorder}`,
                        backdropFilter: "blur(6px)",
                    }}
                >
                    <Button
                        onClick={() => setParamModalOpen(false)}
                        variant="text"
                        sx={{
                            textTransform: "none",
                            fontWeight: 600,
                            color: theme.palette.text.secondary,
                        }}
                    >
                        Cancel
                    </Button>
                    <Box sx={{ flex: 1 }} />
                    <MUIButton
                        variant="contained"
                        onClick={handleSaveParameters}
                        disabled={paramLoading || !paramBlueprint}
                        size="small"
                        sx={{
                            textTransform: "none",
                            fontWeight: 600,
                            px: 2.5,
                        }}
                    >
                        Save Parameters
                    </MUIButton>
                </DialogActions>
            </Dialog >

            {/* PRIORITY ORDER DIALOG */}
            <Dialog
                open={priorityModalOpen}
                onClose={() => setPriorityModalOpen(false)}
                fullWidth
                maxWidth="sm"
                PaperProps={{
                    sx: {
                        borderRadius: 3,
                        background: isDark
                            ? alpha(theme.palette.background.paper, 0.97)
                            : theme.palette.background.paper,
                        boxShadow: "0 24px 64px rgba(0,0,0,0.18)",
                    },
                }}
            >
                <DialogTitle
                    sx={{
                        px: 3,
                        py: 2.5,
                        background: paramModalHeaderBg,
                        borderBottom: `1px solid ${paramModalBorder}`,
                        backdropFilter: "blur(6px)",
                    }}
                >
                    <Box sx={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 1 }}>
                        <Box>
                            <Typography variant="h6" sx={{ fontWeight: 700, letterSpacing: 0.2 }}>
                                Parameter Priority Order
                            </Typography>
                            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                                Lower number = covered first by the AI interviewer
                            </Typography>
                        </Box>
                        <Chip
                            size="small"
                            label={`${selectedParameterEntries.length} parameters`}
                            color="primary"
                            sx={{ fontWeight: 700 }}
                        />
                    </Box>
                </DialogTitle>

                <DialogContent sx={{ px: 2.5, py: 2.5, background: "transparent" }}>
                    {selectedParameterEntries.length === 0 ? (
                        <Box
                            sx={{
                                py: 6,
                                display: "flex",
                                flexDirection: "column",
                                alignItems: "center",
                                gap: 1.5,
                                color: theme.palette.text.disabled,
                            }}
                        >
                            <Typography variant="body1" sx={{ fontWeight: 600 }}>
                                No parameters selected
                            </Typography>
                            <Typography variant="body2">
                                Go back and select parameters to set their priority.
                            </Typography>
                        </Box>
                    ) : (
                        <Stack spacing={1.5}>
                            {selectedParameterEntries.map((entry) => {
                                const isFirst = entry.priority === 1;
                                const isLast = entry.priority === selectedParameterEntries.length;
                                return (
                                    <Box
                                        key={entry.key}
                                        sx={{
                                            display: "flex",
                                            alignItems: "center",
                                            gap: 2,
                                            px: 2,
                                            py: 1.5,
                                            borderRadius: 2.5,
                                            border: `1.5px solid ${alpha(
                                                theme.palette.primary.main,
                                                isFirst ? 0.55 : isDark ? 0.18 : 0.12
                                            )}`,
                                            background: isFirst
                                                ? alpha(theme.palette.primary.main, isDark ? 0.14 : 0.07)
                                                : isDark
                                                    ? alpha(theme.palette.common.white, 0.03)
                                                    : alpha(theme.palette.common.white, 0.9),
                                            boxShadow: isFirst
                                                ? `0 2px 12px ${alpha(theme.palette.primary.main, 0.12)}`
                                                : "0 1px 4px rgba(0,0,0,0.05)",
                                            transition: "background 0.2s, border-color 0.2s",
                                        }}
                                    >
                                        {/* Rank circle */}
                                        <Box
                                            sx={{
                                                width: 40,
                                                height: 40,
                                                borderRadius: "50%",
                                                display: "flex",
                                                alignItems: "center",
                                                justifyContent: "center",
                                                flexShrink: 0,
                                                background: isFirst
                                                    ? theme.palette.primary.main
                                                    : alpha(theme.palette.primary.main, isDark ? 0.18 : 0.1),
                                                boxShadow: isFirst
                                                    ? `0 4px 12px ${alpha(theme.palette.primary.main, 0.35)}`
                                                    : "none",
                                            }}
                                        >
                                            <Typography
                                                sx={{
                                                    fontWeight: 800,
                                                    fontSize: "0.85rem",
                                                    color: isFirst
                                                        ? "#fff"
                                                        : theme.palette.primary.main,
                                                    lineHeight: 1,
                                                }}
                                            >
                                                {entry.priority}
                                            </Typography>
                                        </Box>

                                        {/* Info */}
                                        <Box sx={{ flex: 1, minWidth: 0 }}>
                                            <Typography
                                                variant="body1"
                                                sx={{
                                                    fontWeight: 700,
                                                    color: isFirst
                                                        ? theme.palette.primary.main
                                                        : theme.palette.text.primary,
                                                }}
                                                noWrap
                                            >
                                                {entry.paramName}
                                            </Typography>
                                            <Typography variant="caption" color="text.secondary" noWrap>
                                                {entry.groupName}
                                                {entry.totalSubs
                                                    ? ` • ${entry.selectedCount}/${entry.totalSubs} sub-params`
                                                    : " • Standalone"}
                                            </Typography>
                                        </Box>

                                        {/* Arrow controls */}
                                        <Stack direction="column" spacing={0}>
                                            <IconButton
                                                size="small"
                                                onClick={() => moveParameterPriority(entry.key, -1)}
                                                disabled={isFirst}
                                                sx={{
                                                    color: isFirst
                                                        ? theme.palette.text.disabled
                                                        : theme.palette.primary.main,
                                                    "&:hover": {
                                                        background: alpha(theme.palette.primary.main, 0.1),
                                                    },
                                                }}
                                                aria-label={`Move ${entry.paramName} up`}
                                            >
                                                <KeyboardArrowUpRoundedIcon fontSize="small" />
                                            </IconButton>
                                            <IconButton
                                                size="small"
                                                onClick={() => moveParameterPriority(entry.key, 1)}
                                                disabled={isLast}
                                                sx={{
                                                    color: isLast
                                                        ? theme.palette.text.disabled
                                                        : theme.palette.primary.main,
                                                    "&:hover": {
                                                        background: alpha(theme.palette.primary.main, 0.1),
                                                    },
                                                }}
                                                aria-label={`Move ${entry.paramName} down`}
                                            >
                                                <KeyboardArrowDownRoundedIcon fontSize="small" />
                                            </IconButton>
                                        </Stack>
                                    </Box>
                                );
                            })}
                        </Stack>
                    )}
                </DialogContent>

                <DialogActions
                    sx={{
                        px: 3,
                        py: 2,
                        background: paramModalHeaderBg,
                        borderTop: `1px solid ${paramModalBorder}`,
                        backdropFilter: "blur(6px)",
                    }}
                >
                    <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>
                        #1 is covered first by the AI interviewer
                    </Typography>
                    <MUIButton
                        variant="contained"
                        onClick={() => setPriorityModalOpen(false)}
                        sx={{ borderRadius: 999, fontWeight: 600, textTransform: "none", px: 3 }}
                    >
                        Done
                    </MUIButton>
                </DialogActions>
            </Dialog>

            {/* CALENDAR DIALOG */}
            < Dialog
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
            </Dialog >
        </Box >
    );
}
