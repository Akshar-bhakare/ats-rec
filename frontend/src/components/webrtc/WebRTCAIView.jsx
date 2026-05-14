import React, { Suspense, lazy } from "react";
import {
    MicRounded,
    PauseRounded,
    ReplayRounded,
    SlowMotionVideoRounded
} from "@mui/icons-material";

const LipSyncAvatar = lazy(() => import("../LipSyncAvatar"));

export default function WebRTCAIView({
    topBarTitle,
    candidateName,
    questionNumber,
    displayTime,
    videoRef,
    remoteStreams,
    isXs,
    isSm,
    aiGridTemplateColumns,
    aiGridTemplateAreas,
    showTranscript,
    onToggleTranscript,
    transcriptRef,
    conversation,
    questionText,
    answerStatus,
    isRecording,
    clickedAction,
    isInterviewPaused,
    isSlowMode,
    onRepeatQuestion,
    onPauseQuestion,
    onSlowDownQuestion,
    onStartRecording,
    onStopRecording,
    mediaReady,
    startRecordingBusy,
    startRecordingError,
    endCall,
    aiSpeaking,
    aiStatus,
    audioRef,
    avatarSize,
    isAntiCheatActive,
    antiCheatState,
    antiCheatWarningText,
    onDismissAntiCheat
}) {
    return (
        <>
            <div className="webrtc-topbar">
                {!isXs && !isSm ? (
                    <div
                        className="webrtc-topbar-left"
                        aria-hidden="true"
                    />
                ) : null}
                <div className="webrtc-topbar-center">
                    <div className="webrtc-topbar-title">
                        {topBarTitle}
                    </div>
                    {candidateName && (
                        <div className="webrtc-topbar-subtitle">
                            Candidate:{" "}
                            <span className="webrtc-candidate-name">
                                {candidateName}
                            </span>
                        </div>
                    )}
                </div>
                <div className="webrtc-topbar-right">
                    <div className="webrtc-topbar-chip">
                        Question {questionNumber}
                    </div>
                    <div className="webrtc-topbar-timer">
                        {displayTime}
                    </div>
                </div>
            </div>

            <div className="webrtc-shell">
                <div
                    className="webrtc-ai-grid"
                    style={{
                        gridTemplateColumns: aiGridTemplateColumns,
                        gridTemplateAreas: aiGridTemplateAreas
                    }}
                >
                    <div className="webrtc-panel webrtc-panel--video">
                        <div
                            className={`webrtc-video-frame ${remoteStreams.length === 0
                                ? "webrtc-video-frame--full"
                                : ""
                                }`}
                        >
                            <video
                                ref={videoRef}
                                muted
                                autoPlay
                                playsInline
                                className="webrtc-video webrtc-video--local"
                            />
                            <div className="webrtc-video-label">You</div>
                        </div>

                        {remoteStreams.length > 0 && (
                            <div
                                className="webrtc-remote-grid"
                                style={{
                                    gridTemplateColumns: isXs
                                        ? "1fr"
                                        : remoteStreams.length > 1
                                            ? "1fr 1fr"
                                            : "1fr"
                                }}
                            >
                                {remoteStreams.map((rs) => (
                                    <video
                                        key={rs.id}
                                        autoPlay
                                        playsInline
                                        className="webrtc-remote-video"
                                        ref={(el) => {
                                            if (
                                                el &&
                                                rs.stream &&
                                                el.srcObject !== rs.stream
                                            ) {
                                                el.srcObject = rs.stream;
                                            }
                                        }}
                                    />
                                ))}
                            </div>
                        )}
                    </div>

                    <div
                        className={`webrtc-panel webrtc-panel--question ${showTranscript ? "is-transcript-open" : ""}`}
                    >
                        <div className="webrtc-question-head">
                            <div className="webrtc-question-meta">
                                <span className="webrtc-question-label">
                                    Question {questionNumber}
                                </span>
                                <span
                                    className={`webrtc-question-badge ${isRecording ? "is-live" : ""}`}
                                >
                                    {answerStatus}
                                </span>
                            </div>
                            <div className="webrtc-question-scroll">
                                <p className="webrtc-question-text">
                                    {questionText}
                                </p>
                            </div>
                        </div>
                        <div
                            className={`webrtc-question-progress ${isRecording ? "is-active" : ""}`}
                        >
                            <span className="webrtc-question-progress-bar" />
                        </div>
                        <div className="webrtc-question-actions">
                            <div className="webrtc-question-quick-actions">
                                <button
                                    type="button"
                                    className={`webrtc-transcript-btn webrtc-quick-btn ${clickedAction === "repeat" ? "is-active" : ""}`}
                                    onClick={onRepeatQuestion}
                                    disabled={isInterviewPaused}
                                >
                                    <ReplayRounded className="webrtc-quick-btn-icon" />
                                    <span>Repeat Question</span>
                                </button>
                                <button
                                    type="button"
                                    className={`webrtc-transcript-btn webrtc-quick-btn ${isInterviewPaused ? "is-active" : ""}`}
                                    onClick={onPauseQuestion}
                                    aria-pressed={isInterviewPaused}
                                >
                                    <PauseRounded className="webrtc-quick-btn-icon" />
                                    <span>Pause</span>
                                </button>
                                <button
                                    type="button"
                                    className={`webrtc-transcript-btn webrtc-quick-btn ${(isSlowMode || clickedAction === "slow") ? "is-active" : ""}`}
                                    onClick={onSlowDownQuestion}
                                    disabled={isInterviewPaused}
                                    aria-pressed={isSlowMode}
                                >
                                    <SlowMotionVideoRounded className="webrtc-quick-btn-icon" />
                                    <span>Slow Down</span>
                                </button>
                            </div>
                            {!isRecording ? (
                                <button
                                    onClick={onStartRecording}
                                    disabled={!mediaReady || isInterviewPaused || startRecordingBusy}
                                    className={`webrtc-start-btn webrtc-start-btn--question ${(mediaReady && !isInterviewPaused && !startRecordingBusy) ? "" : "is-disabled"}`}
                                >
                                    <MicRounded className="webrtc-start-icon" />
                                    <span>
                                        {startRecordingBusy ? "Starting..." : "Start Answering"}
                                    </span>
                                </button>
                            ) : (
                                <button
                                    onClick={onStopRecording}
                                    className="webrtc-stop-btn webrtc-stop-btn--question"
                                >
                                    Stop
                                </button>
                            )}
                        </div>
                        {startRecordingError ? (
                            <p className="webrtc-start-error" role="alert">
                                {startRecordingError}
                            </p>
                        ) : null}
                        <div className="webrtc-question-utility">
                            <button
                                type="button"
                                className="webrtc-transcript-btn"
                                onClick={onToggleTranscript}
                            >
                                {showTranscript ? "Hide Transcript" : "View Transcript"}
                            </button>
                            <button
                                type="button"
                                className="webrtc-end-interview-btn"
                                onClick={endCall}
                            >
                                End Interview
                            </button>
                        </div>
                        {showTranscript && (
                            <div
                                className="webrtc-question-transcript"
                                ref={transcriptRef}
                            >
                                <h3 className="webrtc-transcript-title">
                                    Transcript
                                </h3>

                                {conversation.length === 0 && (
                                    <p className="webrtc-transcript-empty">
                                        The transcript of your AI-led answers
                                        will appear here.
                                    </p>
                                )}

                                {conversation.map((c, i) => (
                                    <div
                                        key={i}
                                        className="webrtc-transcript-item"
                                    >
                                        {c.user ? (
                                            <p className="webrtc-transcript-text">
                                                <strong>You:</strong> {c.user}
                                            </p>
                                        ) : null}
                                        {c.ai ? (
                                            <p className="webrtc-transcript-ai">
                                                <strong>AI:</strong> {c.ai}
                                            </p>
                                        ) : null}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="webrtc-panel webrtc-panel--avatar">
                        <Suspense fallback={<div style={{ width: avatarSize, height: avatarSize }} />}>
                            <LipSyncAvatar
                                isAiSpeaking={aiSpeaking}
                                audioRef={audioRef}
                                width={avatarSize}
                                height={avatarSize}
                            />
                        </Suspense>
                        <div className="webrtc-avatar-status">
                            <span
                                className={`webrtc-avatar-dot ${aiSpeaking ? "is-speaking" : isRecording ? "is-listening" : ""}`}
                            />
                            {aiStatus}
                        </div>
                    </div>
                </div>

                <div className="webrtc-smart-proctoring">
                    <div className="webrtc-smart-proctoring-left">
                        <div className="webrtc-smart-proctoring-title">
                            Smart Proctoring enabled
                        </div>
                        <div className="webrtc-smart-proctoring-text">
                            Your camera, mic, and environment are monitored to
                            ensure test integrity.
                        </div>
                        {isAntiCheatActive && (
                            <div className="webrtc-smart-proctoring-warning">
                                <strong>Anti-cheat active:</strong> Camera is
                                mandatory and this tab must stay in focus. Tab
                                switches, camera interruptions, multiple faces
                                and abnormal audio are monitored.
                                {antiCheatState?.hasActiveViolationBanner && (
                                    <div className="webrtc-smart-proctoring-alert">
                                        <span>
                                            <strong>Warning:</strong>{" "}
                                            {antiCheatWarningText} Violations so
                                            far: {antiCheatState?.violationCount || 0}.
                                        </span>
                                        <button
                                            onClick={onDismissAntiCheat}
                                            className="webrtc-smart-proctoring-dismiss"
                                        >
                                            Got it
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                    <div className="webrtc-smart-proctoring-right">
                        <button
                            type="button"
                            className="webrtc-smart-proctoring-link"
                        >
                            What is monitored?
                        </button>
                    </div>
                </div>

                <div className={`webrtc-bottom-bar webrtc-bottom-bar--ai ${isSm ? "webrtc-bottom-bar--stacked" : ""}`}>
                    <div className="webrtc-controls webrtc-controls--ai">
                        {isRecording && (
                            <div className="webrtc-recording-pill">
                                <span className="webrtc-recording-dot" />
                                Recording answer...
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}
