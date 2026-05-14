/* eslint-disable no-unused-vars */


import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Box, Button, Typography, Paper, CircularProgress, Tabs, Tab, Chip, Select, MenuItem, Dialog, DialogTitle, DialogContent, DialogActions, DialogContentText, IconButton } from '@mui/material';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import CodeIcon from '@mui/icons-material/Code';
import TerminalIcon from '@mui/icons-material/Terminal';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import CloseIcon from '@mui/icons-material/Close';
import { fetchData } from '../../AppUtils/dataAPI';
import { ExpandMore, ExpandLess } from '@mui/icons-material';
import { alpha } from '@mui/material/styles';

// Monaco Editor imports
import * as monaco from 'monaco-editor';
import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker';
import cssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker';
import htmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker';
import tsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker';

const LOG_PREFIX = '[CodingRound]';
const NON_TERMINAL_STATUSES = new Set(['queued', 'running']);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const isTerminalStatus = (status) => {
    const normalized = String(status || '').toLowerCase();
    return Boolean(normalized) && !NON_TERMINAL_STATUSES.has(normalized);
};

// Configure Monaco Environment
self.MonacoEnvironment = {
    getWorker(_, label) {
        if (label === 'json') return new jsonWorker();
        if (label === 'css' || label === 'scss' || label === 'less') return new cssWorker();
        if (label === 'html' || label === 'handlebars' || label === 'razor') return new htmlWorker();
        if (label === 'typescript' || label === 'javascript') return new tsWorker();
        return new editorWorker();
    }
};

function TabPanel(props) {
    const { children, value, index, ...other } = props;

    return (
        <div
            role="tabpanel"
            hidden={value !== index}
            id={`simple-tabpanel-${index}`}
            aria-labelledby={`simple-tab-${index}`}
            {...other}
            style={{ height: '100%', display: value === index ? 'block' : 'none' }}
        >
            <Box sx={{ p: 2, height: '100%', overflow: 'auto' }}>
                {children}
            </Box>
        </div>
    );
}

const formatDisplayValue = (value) => {
    if (value === null || value === undefined) return "";
    if (typeof value === "string") return value;
    if (typeof value === "number" || typeof value === "boolean") return String(value);
    try {
        return JSON.stringify(value, null, 2);
    } catch {
        return String(value);
    }
};

const buildTestCaseLog = (cases = []) => cases.map((tc, index) => ({
    index,
    id: tc?._id ?? tc?.id ?? null,
    input: tc?.input ?? tc?.stdin ?? "",
    expected: tc?.expectedOutput ?? tc?.output ?? tc?.expected ?? "",
    isSample: tc?.isSample ?? tc?.sample ?? false
}));

const buildDetailedResultsLog = (results = [], testCases = []) => results.map((result, index) => {
    const match = testCases.find((tc) => String(tc?._id ?? tc?.id) === String(result?.testCaseId))
        || testCases[index]
        || {};
    return {
        index,
        testCaseId: result?.testCaseId ?? match?._id ?? match?.id ?? null,
        status: result?.status ?? result?.verdict ?? result?.result ?? "",
        expected: match?.expectedOutput ?? match?.output ?? match?.expected ?? "",
        output: result?.output ?? result?.stdout ?? "",
        stderr: result?.stderr ?? "",
        compilerOutput: result?.compilerOutput ?? ""
    };
});

const renderCodeBlock = (label, value, { emptyLabel = "No data provided" } = {}) => {
    const content = formatDisplayValue(value);
    const hasContent = String(content).trim().length > 0;

    return (
        <Box>
            <Typography
                variant="caption"
                sx={{ color: "text.secondary", letterSpacing: 0.6, textTransform: "uppercase" }}
                gutterBottom
            >
                {label}
            </Typography>
            <Box
                component="pre"
                sx={{
                    m: 0,
                    p: 1.5,
                    minHeight: 120,
                    maxHeight: 220,
                    overflow: "auto",
                    bgcolor: (theme) => theme.palette.background.paper,
                    border: 1,
                    borderColor: "divider",
                    borderRadius: 1.5,
                    fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
                    fontSize: "0.85rem",
                    lineHeight: 1.6,
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    color: hasContent ? "text.primary" : "text.disabled",
                }}
            >
                {hasContent ? content : emptyLabel}
            </Box>
        </Box>
    );
};

const normalizeLanguageName = (value) => String(value || "").trim();

const normalizeExtension = (extension) => {
    if (!extension) return "";
    const trimmed = String(extension).trim();
    if (!trimmed) return "";
    return trimmed.startsWith(".") ? trimmed : `.${trimmed}`;
};

const mapLanguageToExtension = (languageName = "") => {
    const name = normalizeLanguageName(languageName).toLowerCase();
    if (name.includes("python")) return ".py";
    if (name.includes("javascript") || name.includes("node")) return ".js";
    if (name.includes("typescript")) return ".ts";
    if (name.includes("c++") || name.includes("cpp")) return ".cpp";
    if (name.includes("c#")) return ".cs";
    if (name.includes("java")) return ".java";
    if (name === "c" || name.includes("c ")) return ".c";
    if (name.includes("go")) return ".go";
    if (name.includes("ruby")) return ".rb";
    if (name.includes("php")) return ".php";
    if (name.includes("sql")) return ".sql";
    if (name.includes("rust")) return ".rs";
    if (name.includes("swift")) return ".swift";
    return "";
};

const getLanguageExtension = (language) => {
    const extension = normalizeExtension(language?.extension);
    if (extension) return extension;
    if (language?.name) return mapLanguageToExtension(language.name);
    return "";
};

const getLanguageCommentPrefix = (languageName = "") => {
    const name = normalizeLanguageName(languageName).toLowerCase();
    if (name.includes("python") || name.includes("ruby") || name.includes("bash") || name.includes("shell")) {
        return "#";
    }
    if (name.includes("sql") || name.includes("lua")) {
        return "--";
    }
    return "//";
};

const buildWriteHereComment = (languageName, indent = "") => {
    const prefix = getLanguageCommentPrefix(languageName);
    return `${indent}${prefix} Write your code here`;
};

const ensureWriteHereComment = (code, languageName) => {
    if (!code) {
        return buildWriteHereComment(languageName);
    }
    if (/write your code here/i.test(code)) return code;
    const name = normalizeLanguageName(languageName).toLowerCase();
    const lines = String(code).split("\n");

    if (name.includes("python")) {
        const idx = lines.findIndex((line) => line.trim().startsWith("def "));
        if (idx >= 0) {
            const indent = (lines[idx].match(/^\s*/) || [""])[0] + "    ";
            lines.splice(idx + 1, 0, `${indent}${buildWriteHereComment(languageName).trim()}`);
            return lines.join("\n");
        }
    } else {
        const idx = lines.findIndex(
            (line) => line.includes("{") && (line.includes("main") || line.includes("solve"))
        );
        if (idx >= 0) {
            const indent = (lines[idx].match(/^\s*/) || [""])[0] + "    ";
            lines.splice(idx + 1, 0, `${indent}${buildWriteHereComment(languageName).trim()}`);
            return lines.join("\n");
        }
    }

    return `${code.trimEnd()}\n\n${buildWriteHereComment(languageName)}\n`;
};

const buildFallbackBoilerplate = (languageName) => {
    const name = normalizeLanguageName(languageName).toLowerCase();
    if (name.includes("python")) {
        return [
            "def solve():",
            `    ${buildWriteHereComment(languageName).trim()}`,
            "    pass",
            "",
            "if __name__ == \"__main__\":",
            "    solve()",
        ].join("\n");
    }
    if (name.includes("javascript") || name.includes("node") || name.includes("typescript")) {
        return [
            "function solve(input) {",
            `  ${buildWriteHereComment(languageName).trim()}`,
            "  return \"\";",
            "}",
            "",
            "const fs = require(\"fs\");",
            "const input = fs.readFileSync(0, \"utf8\").trimEnd();",
            "const output = solve(input);",
            "process.stdout.write(String(output));",
        ].join("\n");
    }
    if (name.includes("c++") || name.includes("cpp")) {
        return [
            "#include <bits/stdc++.h>",
            "using namespace std;",
            "",
            "int main() {",
            "    ios::sync_with_stdio(false);",
            "    cin.tie(nullptr);",
            `    ${buildWriteHereComment(languageName).trim()}`,
            "    return 0;",
            "}",
        ].join("\n");
    }
    if (name.includes("c#")) {
        return [
            "using System;",
            "",
            "public class Program {",
            "    public static void Main() {",
            `        ${buildWriteHereComment(languageName).trim()}`,
            "    }",
            "}",
        ].join("\n");
    }
    if (name.includes("java")) {
        return [
            "import java.io.*;",
            "import java.util.*;",
            "",
            "public class Main {",
            "    public static void main(String[] args) throws Exception {",
            `        ${buildWriteHereComment(languageName).trim()}`,
            "    }",
            "}",
        ].join("\n");
    }
    if (name.includes("c ")) {
        return [
            "#include <stdio.h>",
            "",
            "int main() {",
            `    ${buildWriteHereComment(languageName).trim()}`,
            "    return 0;",
            "}",
        ].join("\n");
    }
    if (name.includes("go")) {
        return [
            "package main",
            "",
            "import (",
            "    \"bufio\"",
            "    \"fmt\"",
            "    \"os\"",
            ")",
            "",
            "func main() {",
            "    in := bufio.NewReader(os.Stdin)",
            "    _ = in",
            "    out := bufio.NewWriter(os.Stdout)",
            "    defer out.Flush()",
            `    ${buildWriteHereComment(languageName).trim()}`,
            "    fmt.Fprintln(out, \"\")",
            "}",
        ].join("\n");
    }
    if (name.includes("php")) {
        return [
            "<?php",
            buildWriteHereComment(languageName).trim(),
            "",
            "?>",
        ].join("\n");
    }
    return buildWriteHereComment(languageName);
};

const mapLanguageToMonaco = (languageName = "") => {
    const name = normalizeLanguageName(languageName).toLowerCase();
    if (name.includes("python")) return "python";
    if (name.includes("javascript") || name.includes("node")) return "javascript";
    if (name.includes("typescript")) return "typescript";
    if (name.includes("c++") || name.includes("cpp")) return "cpp";
    if (name.includes("c#")) return "csharp";
    if (name.includes("java")) return "java";
    if (name.includes("c ")) return "c";
    if (name.includes("go")) return "go";
    if (name.includes("ruby")) return "ruby";
    if (name.includes("php")) return "php";
    if (name.includes("sql")) return "sql";
    return "plaintext";
};



// import {  Typography, Tabs, Tab, Button, Chip, Divider, Paper, CircularProgress, IconButton } from '@mui/material';
// import PlayArrowIcon from '@mui/icons-material/PlayArrow';
// import TerminalIcon from '@mui/icons-material/Terminal';
// import CheckCircleIcon from '@mui/icons-material/CheckCircle';
// import ErrorIcon from '@mui/icons-material/Error';
// import CloudUploadIcon from '@mui/icons-material/CloudUpload';




export default function CodeEditor(props) {
    const { interviewId, problem, testCases = [], onLanguageChange } = props;

    // Test Case Toggle State
    const [showTestCases, setShowTestCases] = useState(true);

    const [code, setCode] = useState('');
    const [output, setOutput] = useState(null);

    const [status, setStatus] = useState(null); // 'accepted', 'wrong_answer', etc.
    const [selectedTestCase, setSelectedTestCase] = useState(0);
    const [currentTab, setCurrentTab] = useState(0);

    // Multi-language support
    const [languageId, setLanguageId] = useState(null);

    const editorContainerRef = useRef(null);
    const editorInstanceRef = useRef(null);
    const isSettingCodeRef = useRef(false);
    const hasUserEditedRef = useRef(false);
    const lastBoilerplateRef = useRef('');
    const lastBoilerplateKeyRef = useRef('');

    // All Submission State
    const [openConfirmDialog, setOpenConfirmDialog] = useState(false);
    const [bestSubmission, setBestSubmission] = useState(null);
    const [isFetchingBest, setIsFetchingBest] = useState(false);
    const [isFinalizing, setIsFinalizing] = useState(false);
    const [isRunningCode, setIsRunningCode] = useState(false);
    //Submit interview button will be disabled when code is running and when no submission available

    const selectedLanguage = useMemo(() => {
        const langs = Array.isArray(problem?.allowedLanguages) ? problem.allowedLanguages : [];
        const resolved =
            langs.find((lang) => String(lang?._id) === String(languageId)) ||
            langs.find((lang) => String(lang?.judge0Id) === String(languageId)) ||
            null;
        if (resolved) return resolved;
        if (languageId != null && String(languageId) === "71") {
            return { name: "Python 3", judge0Id: 71 };
        }
        if (languageId != null) {
            return { name: String(languageId) };
        }
        return null;
    }, [problem, languageId]);

    const editorFileLabel = useMemo(() => {
        if (!selectedLanguage?.name) return 'solution';
        const langName = normalizeLanguageName(selectedLanguage.name).toLowerCase();
        if (langName.includes('python')) return 'solution.py';
        if (langName.includes('javascript') || langName.includes('node')) return 'solution.js';
        if (langName.includes('typescript')) return 'solution.ts';
        if (langName.includes('c++') || langName.includes('cpp')) return 'solution.cpp';
        if (langName.includes('c#')) return 'solution.cs';
        if (langName.includes('java')) return 'Solution.java';
        if (langName.includes('c ')) return 'solution.c';
        if (langName.includes('go')) return 'solution.go';
        if (langName.includes('ruby')) return 'solution.rb';
        if (langName.includes('php')) return 'solution.php';
        return 'solution';
    }, [selectedLanguage]);

    useEffect(() => {
        const testCaseLog = buildTestCaseLog(testCases);
        console.log(LOG_PREFIX, 'coding round started', {
            interviewId,
            problemId: problem?._id ?? problem?.id ?? null,
            testCaseCount: testCaseLog.length
        });
        console.log(LOG_PREFIX, 'problem snapshot', {
            id: problem?._id ?? problem?.id ?? null,
            title: problem?.title ?? problem?.name ?? "",
            difficulty: problem?.difficulty ?? problem?.level ?? "",
            type: problem?.questionType ?? problem?.type ?? "",
            allowedLanguages: problem?.allowedLanguages ?? []
        });
        console.log(LOG_PREFIX, 'test cases', testCaseLog);
        if (testCaseLog.length && console.table) {
            console.table(testCaseLog);
        }
    }, [interviewId, problem, testCases]);

    useEffect(() => {
        if (!selectedLanguage) return;
        console.log(LOG_PREFIX, 'language selected', {
            languageId,
            selectedLanguage
        });
    }, [languageId, selectedLanguage]);

    useEffect(() => {
        if (typeof onLanguageChange !== 'function') return;
        onLanguageChange(selectedLanguage);
    }, [selectedLanguage, onLanguageChange]);

    // Initialize language from problem allowedLanguages when problem loads
    useEffect(() => {
        if (problem?.allowedLanguages?.length > 0) {
            // Default to Python (71) if available, else first one
            const python = problem.allowedLanguages.find(l => l.judge0Id === 71 || l.name?.toLowerCase().includes('python'));
            if (python) {
                setLanguageId(python._id);
            } else {
                setLanguageId(problem.allowedLanguages[0]._id);
            }
        } else {
            // Fallback for old problems without allowedLanguages populated
            setLanguageId(71); // Default to Python Judge0 ID if we have to guess (though backend expects ObjectId now)
        }
    }, [problem]);

    // Initialize Monaco
    useEffect(() => {
        if (editorContainerRef.current) {
            // Clean up old instance if exists
            if (editorInstanceRef.current) {
                editorInstanceRef.current.dispose();
            }

            editorInstanceRef.current = monaco.editor.create(editorContainerRef.current, {
                value: code,
                language: 'python',
                theme: 'vs-dark', // aesthetic choice
                automaticLayout: true,
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                fontSize: 14,
                padding: { top: 16 },
                fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
                fontLigatures: true,
            });

            editorInstanceRef.current.onDidChangeModelContent(() => {
                const nextValue = editorInstanceRef.current.getValue();
                if (!isSettingCodeRef.current && nextValue !== lastBoilerplateRef.current) {
                    hasUserEditedRef.current = true;
                }
                setCode(nextValue);
            });
        }

        return () => {
            editorInstanceRef.current?.dispose();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [editorContainerRef.current]); // Re-init if ref changes (unlikely) but safer

    useEffect(() => {
        if (!editorInstanceRef.current || !selectedLanguage?.name) return;
        const monacoLanguage = mapLanguageToMonaco(selectedLanguage.name);
        const model = editorInstanceRef.current.getModel();
        if (model && monacoLanguage) {
            monaco.editor.setModelLanguage(model, monacoLanguage);
        }
    }, [selectedLanguage]);

    const applyEditorCode = (nextCode, { markAsBoilerplate = false } = {}) => {
        const normalizedCode = typeof nextCode === "string" ? nextCode : "";
        if (editorInstanceRef.current) {
            const current = editorInstanceRef.current.getValue();
            if (current === normalizedCode) return;
            isSettingCodeRef.current = true;
            editorInstanceRef.current.setValue(normalizedCode);
            isSettingCodeRef.current = false;
        }
        setCode(normalizedCode);
        if (markAsBoilerplate) {
            lastBoilerplateRef.current = normalizedCode;
            hasUserEditedRef.current = false;
        }
    };

    useEffect(() => {
        if (!problem || !selectedLanguage?.name) return;

        const problemKey = String(problem?._id || problem?.id || problem?.title || "");
        const languageKey = String(selectedLanguage?._id || selectedLanguage?.judge0Id || selectedLanguage?.name || "");
        const requestKey = `${problemKey}:${languageKey}`;

        if (lastBoilerplateKeyRef.current === requestKey && lastBoilerplateRef.current) {
            return;
        }

        if (hasUserEditedRef.current && lastBoilerplateKeyRef.current === requestKey) {
            return;
        }

        let cancelled = false;
        lastBoilerplateKeyRef.current = requestKey;
        const sampleCase = Array.isArray(testCases) && testCases.length > 0 ? testCases[0] : null;
        const payload = {
            problem: {
                title: problem?.title,
                description: problem?.description,
                constraints: problem?.constraints,
                signature: problem?.signature, // JSON Harness: function signature
                sampleInput: sampleCase?.input,
                sampleOutput: sampleCase?.expectedOutput ?? sampleCase?.output ?? sampleCase?.expected,
            },
            language: {
                id: selectedLanguage?._id || null,
                name: selectedLanguage?.name,
                judge0Id: selectedLanguage?.judge0Id,
                extension: selectedLanguage?.extension,
            },
        };

        fetchData("/api/ai/generateCodingBoilerplate", {
            method: "POST",
            body: payload,
        })
            .then((res) => {
                if (cancelled) return;
                const rawCode = typeof res?.code === "string" ? res.code : "";
                const finalCode = ensureWriteHereComment(rawCode, selectedLanguage?.name);
                if (finalCode.trim()) {
                    applyEditorCode(finalCode, { markAsBoilerplate: true });
                } else {
                    applyEditorCode(buildFallbackBoilerplate(selectedLanguage?.name), { markAsBoilerplate: true });
                }
            })
            .catch((err) => {
                if (cancelled) return;
                console.error("[CodingWebRTC] Failed to generate boilerplate:", err);
                applyEditorCode(buildFallbackBoilerplate(selectedLanguage?.name), { markAsBoilerplate: true });
            });

        return () => {
            cancelled = true;
        };
    }, [problem, selectedLanguage, testCases]);

    const handleSubmit = async ({ switchToResultTab = true, throwOnError = false } = {}) => {
        setIsRunningCode(true);
        setOutput(null);
        setStatus(null);

        // Get latest code
        const currentCode = editorInstanceRef.current ? editorInstanceRef.current.getValue() : code;
        const testCaseLog = buildTestCaseLog(testCases);

        console.log(LOG_PREFIX, 'compile/run start', {
            interviewId,
            problemId: problem?._id ?? problem?.id ?? null,
            languageId,
            selectedLanguage
        });
        console.log(LOG_PREFIX, 'compile/run code', { code: currentCode });
        console.log(LOG_PREFIX, 'compile/run expected outputs', testCaseLog);
        if (testCaseLog.length && console.table) {
            console.table(testCaseLog);
        }

        if (!languageId) {
            console.warn("No language selected.");
            console.log(LOG_PREFIX, 'compile/run aborted: missing language', {
                interviewId,
                problemId: problem?._id ?? problem?.id ?? null
            });
            alert("Please select a programming language.");
            setIsRunningCode(false);
            if (throwOnError) {
                throw new Error('Please select a programming language.');
            }
            return null;
        }

        try {
            const payload = {
                sourceCode: currentCode,
                languageId: languageId,
                problemId: problem?._id,
                testCases: testCases
            };

            console.log(LOG_PREFIX, 'compile/run payload', {
                interviewId,
                problemId: payload.problemId ?? null,
                languageId: payload.languageId,
                testCaseCount: Array.isArray(testCases) ? testCases.length : 0
            });

            const response = await fetchData(`/api/codejudge/interviews/${interviewId || 'dummy_interview'}/submissions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            console.log(LOG_PREFIX, 'compile/run submission response', response);

            if (response.error || response.message) {
                if (response.message && !response.submissionId) throw new Error(response.message);
            }

            // If submission queued, start polling
            if (response.submissionId) {
                const submissionId = response.submissionId;
                let finalResult = null;
                let attempts = 0;

                // Poll for up to 30 seconds (15 attempts * 2s)
                while (attempts < 15) {
                    attempts++;
                    // Wait 2 seconds
                    await new Promise(resolve => setTimeout(resolve, 2000));

                    const statusRes = await fetchData(`/api/codejudge/submissions/${submissionId}/status`, {
                        method: 'GET'
                    });

                    console.log(LOG_PREFIX, 'compile/run status poll', {
                        attempt: attempts,
                        status: statusRes?.status,
                        result: statusRes
                    });

                    if (statusRes && statusRes.status && statusRes.status !== 'queued' && statusRes.status !== 'running') {
                        finalResult = statusRes;
                        break;
                    }
                }

                if (finalResult) {
                    setStatus(finalResult.status);
                    setOutput(finalResult);
                    console.log(LOG_PREFIX, 'compile/run final result', finalResult);
                    console.log(LOG_PREFIX, 'compile/run stdout', finalResult?.stdout ?? "");
                    console.log(LOG_PREFIX, 'compile/run stderr', finalResult?.stderr ?? "");
                    console.log(LOG_PREFIX, 'compile/run compiler output', finalResult?.compilerOutput ?? "");
                    const detailedLog = buildDetailedResultsLog(finalResult?.detailedResults || [], testCases);
                    if (detailedLog.length) {
                        console.log(LOG_PREFIX, 'compile/run detailed results', detailedLog);
                        if (console.table) {
                            console.table(detailedLog);
                        }
                    }

                    if (switchToResultTab) {
                        setCurrentTab(1);
                    }
                    return finalResult;
                } else {
                    throw new Error("Execution timed out or stuck in queue.");
                }

            } else {
                // Fallback for immediate response (if any)
                setStatus(response.status);
                setOutput(response);
                console.log(LOG_PREFIX, 'compile/run immediate result', response);
                console.log(LOG_PREFIX, 'compile/run stdout', response?.stdout ?? "");
                console.log(LOG_PREFIX, 'compile/run stderr', response?.stderr ?? "");
                console.log(LOG_PREFIX, 'compile/run compiler output', response?.compilerOutput ?? "");
                const detailedLog = buildDetailedResultsLog(response?.detailedResults || [], testCases);
                if (detailedLog.length) {
                    console.log(LOG_PREFIX, 'compile/run detailed results', detailedLog);
                    if (console.table) {
                        console.table(detailedLog);
                    }
                }

                if (switchToResultTab) {
                    setCurrentTab(1);
                }
                return response;
            }

        } catch (error) {
            console.error("Submission failed:", error);
            console.error(LOG_PREFIX, 'compile/run failed', {
                interviewId,
                problemId: problem?._id ?? problem?.id ?? null,
                languageId,
                error
            });
            setStatus('error');
            setOutput({ error: error.message || "Execution failed" });
            if (switchToResultTab) {
                setCurrentTab(1); // Switch to results tab
            }
            if (throwOnError) {
                throw error;
            }
            return null;
        } finally {
            setIsRunningCode(false);
        }
    };

    const fetchBestSubmissionWithRetry = async ({ maxAttempts = 1, delayMs = 1500 } = {}) => {
        let lastError = null;

        for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
            try {
                const res = await fetchData(`/api/codejudge/interviews/${interviewId}/best-submission`);
                if (res?._id && isTerminalStatus(res?.status)) {
                    return res;
                }
                if (res?._id && attempt === maxAttempts) {
                    return res;
                }
            } catch (error) {
                lastError = error;
                const msg = String(error?.message || '').toLowerCase();
                const isNotFound = error?.status === 404 || msg.includes('no submission');
                if (!isNotFound && attempt === maxAttempts) {
                    throw error;
                }
            }

            if (attempt < maxAttempts) {
                await sleep(delayMs);
            }
        }

        if (lastError && lastError?.status !== 404) {
            throw lastError;
        }
        return null;
    };

    const handleOpenFinalDialog = async () => {
        console.log("TRIGGER: handleOpenFinalDialog");
        setIsFetchingBest(true);
        setBestSubmission(null); // Reset previous state

        try {
            // Fetch best submission
            const res = await fetchBestSubmissionWithRetry({ maxAttempts: 1 });

            if (!res?._id || res.error || res.message === 'No submissions found') {
                console.warn("No submissions found, opening dialog to inform user.");
                // Allow dialog to open with bestSubmission = null
            } else {
                console.log("-----------BEST SUBMISSION--------------")
                console.log(res)
                setBestSubmission(res);
            }
            setOpenConfirmDialog(true);

        } catch (error) {
            console.error("Failed to fetch best submission:", error);
            // Also open dialog on error to show message
            setOpenConfirmDialog(true);
        } finally {
            // ALWAYS reset checking state so button doesn't get stuck
            setIsFetchingBest(false);
        }
    };

    const handleConfirmFinalSubmit = async () => {
        // Set loading state immediately for the Dialog button
        setIsFinalizing(true);

        try {
            // Always execute the latest editor code once before finalizing interview.
            await handleSubmit({ switchToResultTab: false, throwOnError: true });

            // Resolve best completed submission after execution settles.
            const resolvedBest = await fetchBestSubmissionWithRetry({
                maxAttempts: 10,
                delayMs: 1500
            });

            if (!resolvedBest?._id) {
                throw new Error('No completed submission available. Please run the code again.');
            }

            setBestSubmission(resolvedBest);
            console.log("---------------FINALIZING SUBMISSION ---------------");
            console.log("Best submission:", resolvedBest);

            await fetchData(`/api/codejudge/submissions/${resolvedBest._id}/finalize`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    isFinalSubmission: true,
                    endInterview: true
                })
            });




            setOpenConfirmDialog(false);

            // Trigger end call flow
            if (props.endCall) {
                props.endCall(true);
            }
        } catch (error) {
            console.error("Finalize failed:", error);
            alert("Failed to submit interview. Error: " + error.message);
        } finally {
            setIsFinalizing(false);
        }
    };


    const handleCancelSubmission = () => {
        setOpenConfirmDialog(false);
        setIsFinalizing(false);

    }
    const handleTabChange = (event, newValue) => {
        setCurrentTab(newValue);
    };

    return (
        <Paper elevation={0} sx={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            bgcolor: 'background.paper',
            borderRadius: 0,
            overflow: 'hidden',
            minHeight: 0,
            border: 'none'
        }}>


            {/* Editor Header */}
            <Box sx={{
                px: 2,
                py: 1,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                bgcolor: 'background.default',
                color: 'text.primary',
                borderBottom: 1,
                borderColor: 'divider'
            }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <CodeIcon fontSize="small" sx={{ color: 'success.main' }} />
                    <Typography variant="subtitle2" sx={{ fontFamily: 'monospace' }}>
                        {editorFileLabel}
                    </Typography>
                </Box>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 500 }}>
                        Test Cases
                    </Typography>
                    <IconButton
                        size="small"
                        onClick={() => setShowTestCases(!showTestCases)}
                        sx={{ color: 'text.secondary' }}
                        title={showTestCases ? "Hide Test Cases" : "Show Test Cases"}
                    >
                        {showTestCases ? <ExpandMore /> : <ExpandLess />}
                    </IconButton>
                    <Select
                        size="small"
                        value={languageId || ''}
                        onChange={(e) => setLanguageId(e.target.value)}
                        variant="outlined"
                        sx={{
                            color: 'text.primary',
                            bgcolor: 'background.paper',
                            '.MuiOutlinedInput-notchedOutline': { borderColor: 'divider' },
                            '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'text.secondary' },
                            '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: 'primary.main' },
                            '.MuiSvgIcon-root': { color: 'text.secondary' },
                            height: 30,
                            minWidth: 120
                        }}
                    >
                        {(problem?.allowedLanguages && problem.allowedLanguages.length > 0) ? (
                            problem.allowedLanguages.map(lang => (
                                <MenuItem key={lang._id} value={lang._id}>{lang.name}</MenuItem>
                            ))
                        ) : (
                            <MenuItem value={71}>Python 3</MenuItem>
                        )}
                    </Select>
                </Box>
            </Box>

            {/* Monaco Editor Container */}
            <Box sx={{ flexGrow: 1, minHeight: 0, position: 'relative' }}>
                <div ref={editorContainerRef} style={{ width: '100%', height: '100%' }} />
            </Box>

            {/* Test Cases & Controls */}
            <Box sx={{
                flex: '0 0 auto',
                height: showTestCases ? '35%' : 'auto',
                minHeight: showTestCases ? 180 : 'auto',
                maxHeight: showTestCases ? 300 : 'auto',
                display: 'flex',
                flexDirection: 'column',
                borderTop: 1,
                borderColor: 'divider',
                bgcolor: 'background.default'
            }}>
                {showTestCases && (
                    <>
                        {/* Test Case Header */}
                        <Box sx={{
                            bgcolor: 'background.paper',
                            color: 'text.primary',
                            borderBottom: 1,
                            borderColor: 'divider',
                            display: 'flex',
                            alignItems: 'center',
                            px: 2,
                            minHeight: 40
                        }}>
                            <Tabs
                                value={currentTab}
                                onChange={handleTabChange}
                                variant="scrollable"
                                scrollButtons="auto"
                                sx={{
                                    minHeight: 40,
                                    '& .MuiTab-root': {
                                        minHeight: 40,
                                        textTransform: 'none',
                                        fontSize: '0.85rem',
                                        color: 'text.secondary'
                                    },
                                    '& .Mui-selected': { color: 'primary.main' }
                                }}
                                TabIndicatorProps={{ sx: { bgcolor: 'primary.main' } }}
                            >
                                <Tab label={
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                        <TerminalIcon fontSize="small" /> Test Cases
                                    </Box>
                                } />
                                <Tab label="Run Result" disabled={!output} />
                            </Tabs>
                        </Box>

                        {/* Content Area */}
                        <Box sx={{ flexGrow: 1, minHeight: 0, overflow: 'auto', p: 0 }}>
                            <TabPanel value={currentTab} index={0}>
                                <Box sx={{ p: 2 }}>
                                    {/* Case Selector Strip */}
                                    <Box sx={{ display: 'flex', gap: 1, mb: 2, overflowX: 'auto', pb: 0.5 }}>
                                        {testCases.map((tc, i) => {
                                            // Determine status color if results exist
                                            let color = 'default';
                                            let icon = null;

                                            if (output?.detailedResults) {
                                                // Match result by testCaseId or index if IDs missing in testCases (fallback)
                                                const result = output.detailedResults.find(r => r.testCaseId === tc._id) || output.detailedResults[i];
                                                if (result) {
                                                    if (result.status === 'passed') {
                                                        color = 'success';
                                                        icon = <CheckCircleIcon fontSize="inherit" />;
                                                    } else {
                                                        color = 'error';
                                                        icon = <ErrorIcon fontSize="inherit" />;
                                                    }
                                                }
                                            }

                                            return (
                                                <Chip
                                                    key={i}
                                                    label={`Case ${i + 1}`}
                                                    onClick={() => setSelectedTestCase(i)}
                                                    color={selectedTestCase === i ? (color === 'default' ? 'primary' : color) : 'default'}
                                                    variant={selectedTestCase === i ? 'filled' : 'outlined'}
                                                    icon={icon}
                                                    sx={{
                                                        cursor: 'pointer',
                                                        borderColor: color === 'error' ? 'error.main' : (color === 'success' ? 'success.main' : undefined),
                                                        color: selectedTestCase !== i && color === 'error' ? 'error.main' : (selectedTestCase !== i && color === 'success' ? 'success.main' : undefined),
                                                        bgcolor: selectedTestCase !== i ? 'action.hover' : undefined
                                                    }}
                                                />
                                            );
                                        })}
                                    </Box>

                                    {/* Case Detail View */}
                                    {testCases[selectedTestCase] && (
                                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                                            {/* Result Status Message */}
                                            {output?.detailedResults && (
                                                <Box>
                                                    {(() => {
                                                        const result = output.detailedResults.find(r => r.testCaseId === testCases[selectedTestCase]._id) || output.detailedResults[selectedTestCase];
                                                        if (!result) return <Typography variant="caption" color="text.secondary">Not executed</Typography>;
                                                        return (
                                                            <Typography variant="subtitle2" sx={{
                                                                color: result.status === 'passed' ? 'success.main' : 'error.main',
                                                                fontWeight: 'bold',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                gap: 0.5
                                                            }}>
                                                                {result.status === 'passed' ? 'Accepted' : (result.status === 'runtime_error' ? 'Runtime Error' : 'Wrong Answer')}
                                                                {result.executionTime > 0 && <span style={{ fontWeight: 'normal', color: 'gray', fontSize: '0.8em', marginLeft: '8px' }}>({Math.round(result.executionTime)}ms)</span>}
                                                            </Typography>
                                                        );
                                                    })()}
                                                </Box>
                                            )}

                                            <Box
                                                sx={{
                                                    display: "grid",
                                                    gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
                                                    gap: 2,
                                                }}
                                            >
                                                {/* Input Display - supports both legacy and JSON harness */}
                                                {renderCodeBlock(
                                                    "Input",
                                                    testCases[selectedTestCase].args
                                                        ? testCases[selectedTestCase].args.map((arg, idx) =>
                                                            `arg${idx + 1} = ${JSON.stringify(arg)}`
                                                        ).join('\n')
                                                        : testCases[selectedTestCase].input,
                                                    { emptyLabel: "No input provided" }
                                                )}
                                                {/* Expected Output Display - supports both formats */}
                                                {renderCodeBlock(
                                                    "Expected Output",
                                                    testCases[selectedTestCase].expected !== undefined
                                                        ? JSON.stringify(testCases[selectedTestCase].expected, null, 2)
                                                        : (testCases[selectedTestCase].expectedOutput ??
                                                            testCases[selectedTestCase].output),
                                                    { emptyLabel: "No expected output provided" }
                                                )}
                                            </Box>

                                            {/* Actual Output if available */}
                                            {output?.detailedResults && (() => {
                                                const result = output.detailedResults.find(r => r.testCaseId === testCases[selectedTestCase]._id) || output.detailedResults[selectedTestCase];
                                                if (result) {
                                                    // Extract clean output value
                                                    let cleanOutput = result.output;

                                                    // If output looks like "results: [value]", extract just the value
                                                    if (typeof cleanOutput === 'string') {
                                                        // Try to parse if it looks like JSON
                                                        try {
                                                            const parsed = JSON.parse(cleanOutput);
                                                            if (parsed && parsed.results && Array.isArray(parsed.results)) {
                                                                cleanOutput = parsed.results[0];
                                                            }
                                                        } catch (e) {
                                                            // Not JSON, keep as is
                                                        }
                                                    }

                                                    return renderCodeBlock(
                                                        "Actual Output",
                                                        cleanOutput !== undefined && cleanOutput !== null
                                                            ? (typeof cleanOutput === 'object' ? JSON.stringify(cleanOutput, null, 2) : String(cleanOutput))
                                                            : (result.status === 'passed'
                                                                ? (testCases[selectedTestCase].expected !== undefined
                                                                    ? JSON.stringify(testCases[selectedTestCase].expected, null, 2)
                                                                    : (testCases[selectedTestCase].expectedOutput ??
                                                                        testCases[selectedTestCase].output))
                                                                : "<no output>"),
                                                        {
                                                            emptyLabel: "No output",
                                                        }
                                                    );
                                                }
                                                return null;
                                            })()}
                                        </Box>
                                    )}
                                </Box>
                            </TabPanel>

                            <TabPanel value={currentTab} index={1}>
                                {output ? (
                                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, p: 2 }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                                            {status === 'accepted' ? <CheckCircleIcon color="success" fontSize="large" /> : <ErrorIcon color="error" fontSize="large" />}
                                            <Box>
                                                <Typography variant="h6" fontWeight="bold" sx={{ color: status === 'accepted' ? 'success.main' : 'error.main', textTransform: 'uppercase' }}>
                                                    {status?.replace(/_/g, ' ') || 'Error'}
                                                </Typography>
                                                {output.passedTestCases !== undefined && (
                                                    <Typography variant="body2" color="text.secondary">
                                                        {output.passedTestCases} / {output.totalTestCases} Test Cases Passed
                                                    </Typography>
                                                )}
                                            </Box>
                                        </Box>

                                        {/* Show stdout if available */}
                                        {output.stdout && (
                                            <Box>
                                                <Typography variant="caption" color="text.secondary">Stdout</Typography>
                                                <Paper variant="outlined" sx={{ p: 1.5, bgcolor: 'background.paper', color: 'text.primary', fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
                                                    {output.stdout}
                                                </Paper>
                                            </Box>
                                        )}

                                        {/* Show Stderr */}
                                        {output.stderr && (
                                            <Box>
                                                <Typography variant="caption" color="error">Stderr</Typography>
                                                <Paper variant="outlined" sx={{ p: 1.5, bgcolor: (theme) => alpha(theme.palette.error.main, theme.palette.mode === 'dark' ? 0.2 : 0.1), color: 'error.main', fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
                                                    {output.stderr}
                                                </Paper>
                                            </Box>
                                        )}

                                        {/* Raw JSON fallback removed to avoid exposing internal response */}
                                        {!output.stdout && !output.stderr && (
                                            <Typography variant="body2" color="text.secondary">
                                                Execution completed. Review the test case results for details.
                                            </Typography>
                                        )}
                                    </Box>
                                ) : (
                                    <Box sx={{ p: 4, textAlign: 'center' }}>
                                        <Typography color="text.secondary">Run code to see results.</Typography>
                                    </Box>
                                )}
                            </TabPanel>
                        </Box>
                        <Box sx={{ px: 2, borderTop: 1, borderColor: 'divider', bgcolor: 'background.default' }} />
                    </>
                )}

                {/* Footer / Run Button */}
                <Box sx={{ p: 1.5, borderTop: 1, borderColor: 'divider', display: 'flex', justifyContent: 'space-between', bgcolor: 'background.paper' }}>
                    <Button
                        variant="outlined"
                        onClick={handleOpenFinalDialog}
                        disabled={isRunningCode || isFetchingBest || isFinalizing}
                        sx={{
                            textTransform: 'none',
                            color: 'primary.main',
                            borderColor: 'primary.main',
                            '&:hover': {
                                borderColor: 'primary.dark',
                                color: 'primary.dark'
                            }
                        }}
                    >
                        Submit Interview
                    </Button>
                    <Button
                        variant="contained"
                        color="success"
                        onClick={() => {
                            handleSubmit();
                        }}
                        sx={{
                            borderRadius: 1,
                            textTransform: 'none',
                            fontWeight: 'bold',
                            px: 3,
                            boxShadow: 'none',
                            '&:hover': { boxShadow: 'none', bgcolor: 'success.dark' }
                        }}
                        startIcon={isRunningCode ? <CircularProgress size={16} color="inherit" /> : <PlayArrowIcon />}
                        disabled={isRunningCode || isFinalizing}
                    >
                        {isRunningCode ? 'Running...' : 'Run Code'}
                    </Button>
                </Box>
            </Box>

            {/* Final Submission Dialog */}
            <Dialog
                open={openConfirmDialog}
                onClose={() => setOpenConfirmDialog(false)}
                PaperProps={{
                    sx: { bgcolor: 'background.paper', color: 'text.primary', minWidth: 400 }
                }}
            >
                <DialogTitle sx={{ borderBottom: 1, borderColor: 'divider', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Typography variant="h6">Submit Interview?</Typography>
                    <IconButton onClick={() => setOpenConfirmDialog(false)} sx={{ color: 'text.secondary', padding: 0.5 }}>
                        <CloseIcon />
                    </IconButton>
                </DialogTitle>
                <DialogContent sx={{ mt: 2 }}>

                    {bestSubmission ? (
                        <>
                            <DialogContentText sx={{ color: 'text.secondary', mb: 2 }}>
                                Your best submission will be marked as final and the interview will end.
                            </DialogContentText>
                            <Paper variant="outlined" sx={{ p: 2, bgcolor: 'action.hover', borderColor: 'divider' }}>
                                <Typography variant="subtitle2" sx={{ color: 'text.primary', mb: 1 }}>Best Submission Found:</Typography>
                                <Typography variant="body2" sx={{ color: 'success.main', display: 'flex', alignItems: 'center', gap: 1 }}>
                                    <CheckCircleIcon fontSize="small" />
                                    {bestSubmission.passedTestCases} / {bestSubmission.totalTestCases} Test Cases Passed
                                </Typography>
                                <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 1 }}>
                                    Submitted: {new Date(bestSubmission.createdAt).toLocaleString()}
                                </Typography>
                            </Paper>
                        </>
                    ) : (
                        <Box sx={{ p: 2, bgcolor: (theme) => alpha(theme.palette.info.main, theme.palette.mode === 'dark' ? 0.2 : 0.12), border: '1px solid', borderColor: 'info.main', borderRadius: 1 }}>
                            <Typography variant="subtitle1" color="info.main" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <CheckCircleIcon fontSize="small" />
                                Ready To Submit
                            </Typography>
                            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                                No previous run found. We will run your current code now and submit the best completed result automatically.
                            </Typography>
                        </Box>
                    )}
                </DialogContent>
                <DialogActions sx={{ p: 2, borderTop: 1, borderColor: 'divider' }}>
                    <Button onClick={handleCancelSubmission} sx={{ color: 'text.secondary' }}>
                        Cancel
                    </Button>
                    <Button
                        onClick={handleConfirmFinalSubmit}
                        variant="contained"
                        color="primary"
                        disabled={isFinalizing || isRunningCode || isFetchingBest}
                        startIcon={isFinalizing || isRunningCode || isFetchingBest ? <CircularProgress size={16} color="inherit" /> : null}
                    >
                        {isFinalizing || isRunningCode || isFetchingBest ? 'Running & Submitting...' : 'Run & Submit'}
                    </Button>
                </DialogActions>
            </Dialog>
        </Paper>
    );
}
