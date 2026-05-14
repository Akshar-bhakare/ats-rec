import { useEffect, useMemo, useState } from "react";
import {
    Box,
    Card,
    CardContent,
    CardHeader,
    Chip,
    CircularProgress,
    Stack,
    TextField,
    Tooltip,
    Typography,
    IconButton,
    Divider,
} from "@mui/material";
import ArrowBackIosNewRoundedIcon from "@mui/icons-material/ArrowBackIosNewRounded";
import DownloadRoundedIcon from "@mui/icons-material/DownloadRounded";
import RefreshRoundedIcon from "@mui/icons-material/RefreshRounded";
import CreditCardOutlinedIcon from "@mui/icons-material/CreditCardOutlined";
import { useAuthContextState } from "../../contexts/AuthContext";
import { fetchData } from "../../AppUtils/dataAPI";
import MUIRetrieveDataGrid from "../MUI/CommonCRUD/MUIRetrieveDataGrid";
import { useSearchParams } from "react-router-dom";

function toCsv(rows) {
    if (!rows?.length) return "";
    const cols = Object.keys(rows[0]);
    const esc = (v) => {
        if (v == null) return "";
        const s = String(v);
        return /[,"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const header = cols.map(esc).join(",");
    const body = rows.map((r) => cols.map((c) => esc(r[c])).join(",")).join("\n");
    return header + "\n" + body;
}

function formatDuration(sec) {
    if (!Number.isFinite(sec) || sec < 0) return "";
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = Math.floor(sec % 60);
    const pad = (n) => String(n).padStart(2, "0");
    return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

function getConversationEntryType(conv) {
    const callUUID = String(conv?.callUUID || "");
    if (callUUID.startsWith("wa_conv_____")) return "WhatsApp";
    if (conv?.direction === "inbound") return "Inbound AI Call";
    return "Outbound AI Call";
}

function getEntryTypeColor(type) {
    if (type === "Inbound Lead Collection") return "secondary";
    if (type === "Inbound AI Call") return "info";
    if (type === "WhatsApp") return "success";
    return "default";
}

export default function UsedCreditDetail() {
    const [authState, setAuthState] = useAuthContextState();
    const [searchParams] = useSearchParams();
    const candidateIdFromUrl = searchParams.get("candidateId") || "";
    const jobIdFromUrl = searchParams.get("jobId") || "";

    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState(null);
    const [rows, setRows] = useState([]);

    // simple client-side filters
    const [search, setSearch] = useState("");
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");

    const totalCredit = authState?.user?.totalCredit ?? 0;
    const usedCredits = useMemo(() => {
        const calls = authState?.user?.totalCallCount || 0;
        const rate = authState?.user?.creditRatePerCall || 0;
        return calls * rate;
    }, [authState?.user?.totalCallCount, authState?.user?.creditRatePerCall]);
    const remainingCredits = Math.max(totalCredit - usedCredits, 0);

    // Fetch conversations with populated candidate & job; build grid rows from that only
    const load = async () => {
        setLoading(true);
        setErr(null);
        try {
            const params = new URLSearchParams();
            if (candidateIdFromUrl) params.set("candidateId", candidateIdFromUrl);
            // if (jobIdFromUrl) params.set("jobId", jobIdFromUrl);
            const query = params.toString();
            const shouldLoadInboundLeadCredits = !candidateIdFromUrl && !jobIdFromUrl;
            const [profileResult, conversationsResult, inboundLeadResult] = await Promise.allSettled([
                fetchData("/api/auth/profile"),
                fetchData(`/api/conversations/${query ? `?${query}` : ""}`),
                shouldLoadInboundLeadCredits
                    ? fetchData("/api/inbound-leads/?all=true&countedTowardsCredits=true&pageSize=1000")
                    : Promise.resolve({ items: [] }),
            ]);

            if (profileResult.status === "fulfilled" && profileResult.value && "_id" in profileResult.value) {
                setAuthState((prev) => ({
                    ...prev,
                    user: profileResult.value,
                    isAuthenticated: true,
                    booleanSubmitEmail: profileResult.value?.email,
                }));
            }

            if (conversationsResult.status !== "fulfilled") {
                throw conversationsResult.reason || new Error("Failed to load AI call history");
            }

            const conversations = Array.isArray(conversationsResult.value) ? conversationsResult.value : [];
            const inboundLeadItems =
                inboundLeadResult.status === "fulfilled" && Array.isArray(inboundLeadResult.value?.items)
                    ? inboundLeadResult.value.items
                    : [];

            if (inboundLeadResult.status === "rejected" && shouldLoadInboundLeadCredits) {
                console.error("[UsedCreditDetail] Failed to load billed inbound leads:", inboundLeadResult.reason);
            }

            const conversationRows = conversations.map((c, i) => {
                const id = c._id || c.id || String(i + 1);
                const createdAt = c.createdAt ? new Date(c.createdAt) : null;
                const dateStr = createdAt ? createdAt.toLocaleDateString() : "";
                const timeStr = createdAt ? createdAt.toLocaleTimeString() : "";
                const durationSeconds = Number(c.durationSeconds ?? 0);

                // populated docs or ObjectIds
                const candObj = (c.candidateId && typeof c.candidateId === 'object') ? c.candidateId : null;
                const jobObj = (c.jobId && typeof c.jobId === 'object') ? c.jobId : null;

                const candidateName = candObj
                    ? ([candObj.firstName, candObj.lastName].filter(Boolean).join(" ") || candObj.email || "")
                    : "";

                const jobLabel = jobObj
                    ? (jobObj.internalTitle ? `${jobObj.title} (${jobObj.internalTitle})` : (jobObj.title || ""))
                    : "";

                const entryType = getConversationEntryType(c);
                const contactLabel = candidateName || candObj?.email || c.mobile_num || "";

                return {
                    id: `conv_${id}`,
                    type: entryType,
                    contact: contactLabel,
                    job: jobLabel,
                    ourNumber: c.calledNumber || "",
                    duration: formatDuration(durationSeconds),
                    date: dateStr,
                    time: timeStr,
                    _raw: c,
                    _candidateEmail: candObj?.email || "",
                    _dateValue: createdAt,
                    _sortAt: createdAt?.getTime?.() || 0,
                    _searchText: [
                        entryType,
                        contactLabel,
                        jobLabel,
                        c.calledNumber,
                        c.mobile_num,
                        candObj?.email,
                        dateStr,
                        timeStr,
                    ]
                        .filter(Boolean)
                        .join(" ")
                        .toLowerCase(),
                };
            });

            const inboundLeadRows = inboundLeadItems.map((lead, i) => {
                const id = lead._id || lead.id || String(i + 1);
                const callAt = lead.callDate ? new Date(lead.callDate) : (lead.createdAt ? new Date(lead.createdAt) : null);
                const dateStr = callAt ? callAt.toLocaleDateString() : "";
                const timeStr = callAt ? callAt.toLocaleTimeString() : "";
                const contactLabel = lead.phone || "Unknown caller";
                const jobLabel = lead.jobInterest || "";
                const entryType = "Inbound Lead Collection";

                return {
                    id: `lead_${id}`,
                    type: entryType,
                    contact: contactLabel,
                    job: jobLabel,
                    ourNumber: lead.calledNumber || "",
                    duration: "Lead collection",
                    date: dateStr,
                    time: timeStr,
                    _raw: lead,
                    _candidateEmail: "",
                    _dateValue: callAt,
                    _sortAt: callAt?.getTime?.() || 0,
                    _searchText: [
                        entryType,
                        contactLabel,
                        jobLabel,
                        lead.calledNumber,
                        lead.currentCompany,
                        dateStr,
                        timeStr,
                    ]
                        .filter(Boolean)
                        .join(" ")
                        .toLowerCase(),
                };
            });

            setRows(
                [...conversationRows, ...inboundLeadRows].sort(
                    (a, b) => (b._sortAt || 0) - (a._sortAt || 0)
                )
            );
        } catch (e) {
            console.error("[UsedCreditDetail] Failed to load conversations:", e);
            setErr(e?.message || "Failed to load AI call history");
            setRows([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [candidateIdFromUrl, jobIdFromUrl]);

    const filtered = useMemo(() => {
        let out = rows;
        if (dateFrom) {
            const from = new Date(dateFrom + "T00:00:00");
            out = out.filter((r) => {
                return !r._dateValue || r._dateValue >= from;
            });
        }
        if (dateTo) {
            const to = new Date(dateTo + "T23:59:59");
            out = out.filter((r) => {
                return !r._dateValue || r._dateValue <= to;
            });
        }
        if (search.trim()) {
            const s = search.toLowerCase();
            out = out.filter((r) => (r._searchText || "").includes(s));
        }
        return out;
    }, [rows, dateFrom, dateTo, search]);

    const exportCsv = () => {
        const csv = toCsv(
            // eslint-disable-next-line no-unused-vars
            filtered.map(({ _raw, _candidateEmail, ...r }) => r)
        );
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "ai_credit_history.csv";
        a.click();
        URL.revokeObjectURL(url);
    };

    const columns = useMemo(() => ([
        {
            field: "type",
            headerName: "Type",
            minWidth: 180,
            flex: 1,
            headerAlign: "center",
            align: "center",
            renderCell: ({ row }) => (
                <Chip
                    label={row.type || "AI Call"}
                    size="small"
                    color={getEntryTypeColor(row.type)}
                    variant="outlined"
                    sx={{ fontWeight: 700 }}
                />
            ),
        },
        { field: "contact", headerName: "Candidate / Caller", minWidth: 180, flex: 1.2, headerAlign: "center", align: "center" },
        { field: "job", headerName: "Job / Interest", minWidth: 160, flex: 1.2, headerAlign: "center", align: "center" },
        { field: "ourNumber", headerName: "Our Number", minWidth: 140, flex: 1, headerAlign: "center", align: "center" },
        { field: "duration", headerName: "Duration", minWidth: 120, headerAlign: "center", align: "center" },
        { field: "date", headerName: "Date", minWidth: 120, headerAlign: "center", align: "center" },
        { field: "time", headerName: "Time", minWidth: 120, headerAlign: "center", align: "center" },
    ]), []);

    return (
        <Box sx={{ p: 3, maxWidth: 1300, mx: "auto" }}>
            <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 2 }}>
                <IconButton onClick={() => window.history.back()} size="small" aria-label="Go back">
                    <ArrowBackIosNewRoundedIcon />
                </IconButton>
                <Stack direction="row" alignItems="center" spacing={1}>
                    <CreditCardOutlinedIcon fontSize="small" />
                    <Typography variant="h5" sx={{ fontWeight: 800 }}>
                        AI Call Credit Detail
                    </Typography>
                </Stack>
            </Stack>

            <Card
                variant="outlined"
                sx={{
                    borderRadius: 3,
                    mb: 2,
                }}
            >
                <CardHeader
                    titleTypographyProps={{ variant: "subtitle1", fontWeight: 700 }}
                    title="Summary"
                />
                <CardContent>
                    <Stack
                        direction="row"
                        spacing={1.5}
                        alignItems="center"
                        flexWrap="wrap"
                    >
                        <Chip
                            label={`AI Call Credit: ${totalCredit}`}
                            variant="outlined"
                            size="small"
                            sx={{ fontWeight: 700 }}
                        />
                        <Chip
                            label={`AI Call Used: ${usedCredits}`}
                            variant="outlined"
                            size="small"
                            sx={{ fontWeight: 700 }}
                        />
                        <Chip
                            label={`Remaining: ${remainingCredits}`}
                            variant="outlined"
                            size="small"
                            sx={{ fontWeight: 700 }}
                        />
                        <Chip
                            label={`Entries: ${filtered.length}`}
                            variant="outlined"
                            size="small"
                            sx={{ fontWeight: 700 }}
                        />
                    </Stack>
                </CardContent>
            </Card>

            <Card
                variant="outlined"
                sx={{
                    borderRadius: 3,
                }}
            >
                <CardHeader
                    disableTypography
                    title={
                        <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2} sx={{ width: "100%" }}>
                            <Typography variant="subtitle1" fontWeight={700}>
                                AI Credit History
                            </Typography>
                            <Stack direction="row" spacing={1}>
                                <Tooltip title="Refresh">
                                    <IconButton onClick={load} size="small" aria-label="Refresh">
                                        <RefreshRoundedIcon />
                                    </IconButton>
                                </Tooltip>
                                <Tooltip title="Export CSV">
                                    <IconButton onClick={exportCsv} size="small" aria-label="Export CSV">
                                        <DownloadRoundedIcon />
                                    </IconButton>
                                </Tooltip>
                            </Stack>
                        </Stack>
                    }
                />
                <CardContent>
                    <Stack
                        direction={{ xs: "column", sm: "row" }}
                        spacing={1}
                        sx={{ mb: 1.5 }}
                        useFlexGap
                        flexWrap="wrap"
                    >
                        <TextField
                            size="small"
                            label="Search"
                            placeholder="type, caller, candidate, number, job..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                        <TextField
                            size="small"
                            label="From"
                            type="date"
                            InputLabelProps={{ shrink: true }}
                            value={dateFrom}
                            onChange={(e) => setDateFrom(e.target.value)}
                        />
                        <TextField
                            size="small"
                            label="To"
                            type="date"
                            InputLabelProps={{ shrink: true }}
                            value={dateTo}
                            onChange={(e) => setDateTo(e.target.value)}
                        />
                    </Stack>

                    <Divider sx={{ mb: 1.5 }} />

                    {loading ? (
                        <Stack alignItems="center" sx={{ py: 6 }}>
                            <CircularProgress />
                        </Stack>
                    ) : err ? (
                        <Typography color="error" sx={{ py: 2 }}>
                            {String(err)}
                        </Typography>
                    ) : (
                        <MUIRetrieveDataGrid
                            title=""
                            rows={filtered}
                            columns={columns}
                            pageSize={10}
                            rowsPerPageOptions={[10, 25, 50]}
                            hideHeader
                            actionColumnsProps={{ minWidth: 0 }}
                        />
                    )}
                </CardContent>
            </Card>
        </Box>
    );
}
