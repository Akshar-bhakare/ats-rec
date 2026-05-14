import {
    AttachFileRounded,
    ChatRounded,
    CloseRounded,
    DescriptionOutlined,
    FactCheckOutlined,
    GroupsRounded,
    MicOffRounded,
    MicRounded,
    ScreenShareRounded,
    SendRounded,
    StopScreenShareRounded,
    VideocamOffRounded,
    VideocamRounded
} from "@mui/icons-material";

const formatChatTime = (value) => {
    if (!value) return "";

    try {
        return new Date(value).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit"
        });
    } catch {
        return "";
    }
};

const formatFileSize = (size) => {
    const bytes = Number(size) || 0;
    if (bytes <= 0) return "0 KB";
    if (bytes >= 1024 * 1024) {
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
};

export default function WebRTCHumanView({
    title,
    interviewerType,
    candidateName,
    userRole,
    currentUserDisplayName,
    videoRef,
    cameraStreamRef,
    screenStreamRef,
    remoteStreams,
    remoteScreenStreams = [],
    remoteScreenSharingPeers = new Set(),
    isXs,
    isSm,
    displayTime,
    roomParticipantCount,
    isInterviewActive,
    isMicOn,
    toggleMic,
    isCameraOn,
    toggleCamera,
    isScreenSharing,
    toggleScreenShare,
    endCall,
    conversation,
    isChatOpen,
    onToggleChat,
    onCloseChat,
    chatDrawerAnchor,
    chatMessages,
    chatDraft,
    onChatDraftChange,
    onSendChatMessage,
    onSendChatFile,
    chatError,
    peerNamesMap = {}
}) {
    const localSpeakerLabel = userRole === "interviewer"
        ? `Interviewer${currentUserDisplayName ? ` (${currentUserDisplayName})` : ""}`
        : `Candidate${candidateName ? ` (${candidateName})` : ""}`;
    const isHybridInterview = interviewerType === "Human+AI";
    const roomCount = Math.max(Number(roomParticipantCount) || 0, remoteStreams.length + 1, 1);

    // Presenter mode: local screen share or remote screen share
    const activeRemotePresenter =
        remoteScreenStreams.find((entry) => remoteScreenSharingPeers.has(entry.id)) ||
        remoteScreenStreams[0] ||
        null;
    const someoneIsPresenting = isScreenSharing || !!activeRemotePresenter;
    const participantsReady = roomCount > 1 || remoteStreams.length > 0;
    const participantStatusText = participantsReady
        ? `${roomCount} participant${roomCount === 1 ? "" : "s"} connected`
        : "Waiting for the other participant to join";
    const modeTitle = isHybridInterview ? "Human + AI assisted" : "Human led";
    const modeSummary = isHybridInterview
        ? "A live interviewer leads the discussion while AI keeps transcript and evaluation support in the background."
        : "A live interviewer leads the discussion and the room records transcript and media continuously.";
    const transcriptEmptyText = isHybridInterview
        ? "Transcript entries appear automatically as the conversation progresses. AI support stays in the background, so there is no separate Start Answering button."
        : "Transcript entries appear automatically as the conversation progresses. There is no separate Start Answering button in this human-led room.";
    const drawerSideClass = chatDrawerAnchor === "left" ? "is-left" : "is-right";

    const handleChatKeyDown = (event) => {
        if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            onSendChatMessage();
        }
    };

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
                        {title}
                    </div>
                    {candidateName ? (
                        <div className="webrtc-topbar-subtitle">
                            Candidate:{" "}
                            <span className="webrtc-candidate-name">
                                {candidateName}
                            </span>
                        </div>
                    ) : null}
                </div>
                <div className="webrtc-topbar-right webrtc-topbar-actions">
                    <div className="webrtc-topbar-chip">
                        {modeTitle}
                    </div>
                    <div className="webrtc-topbar-chip">
                        {roomCount} joined
                    </div>
                    <button
                        type="button"
                        className="webrtc-chat-launch"
                        onClick={onToggleChat}
                    >
                        <ChatRounded className="webrtc-chat-launch-icon" />
                        <span>Chat & Docs</span>
                    </button>
                </div>
            </div>

            <div className="webrtc-shell">
                <div className="webrtc-human">
                    <div className={`webrtc-human-stage ${someoneIsPresenting ? "is-presenting" : ""}`}>
                        <div className="webrtc-human-stage-main">
                            {someoneIsPresenting ? (
                                /* ── Presenter / Screen-share layout ── */
                                <div className="webrtc-presenter-stage">
                                    {/* Large main view: screen share */}
                                    <div className="webrtc-presenter-main">
                                        {isScreenSharing ? (
                                            <>
                                                <video
                                                    autoPlay
                                                    muted
                                                    playsInline
                                                    className="webrtc-video webrtc-video--screen"
                                                    ref={(el) => {
                                                        if (el && screenStreamRef?.current && el.srcObject !== screenStreamRef.current) {
                                                            el.srcObject = screenStreamRef.current;
                                                        }
                                                    }}
                                                />
                                                <div className="webrtc-video-label">
                                                    {localSpeakerLabel} - Screen
                                                </div>
                                            </>
                                        ) : activeRemotePresenter ? (
                                            <>
                                                <video
                                                    autoPlay
                                                    muted
                                                    playsInline
                                                    className="webrtc-video webrtc-video--screen"
                                                    ref={(el) => {
                                                        if (el && activeRemotePresenter.stream && el.srcObject !== activeRemotePresenter.stream) {
                                                            el.srcObject = activeRemotePresenter.stream;
                                                        }
                                                    }}
                                                />
                                                <div className="webrtc-video-label">
                                                    {(peerNamesMap[activeRemotePresenter.id] || "Participant")} - Screen
                                                </div>
                                            </>
                                        ) : null}
                                    </div>

                                    {/* Thumbnail strip: cameras */}
                                    <div className="webrtc-presenter-thumbnails">
                                        {/* Local camera thumbnail */}
                                        <div className="webrtc-thumb webrtc-thumb--camera">
                                            <video
                                                autoPlay
                                                muted
                                                playsInline
                                                className="webrtc-video webrtc-video--local"
                                                ref={(el) => {
                                                    const localCameraStream = cameraStreamRef?.current || videoRef?.current?.srcObject || null;
                                                    if (el && localCameraStream && el.srcObject !== localCameraStream) {
                                                        el.srcObject = localCameraStream;
                                                    }
                                                }}
                                            />
                                            <div className="webrtc-video-label">{localSpeakerLabel}</div>
                                        </div>

                                        {/* Remote cameras (non-presenter or all remotes when local is presenting) */}
                                        {remoteStreams
                                            .map((rs) => (
                                                <div key={rs.id} className="webrtc-thumb">
                                                    <video
                                                        autoPlay
                                                        playsInline
                                                        className="webrtc-video"
                                                        ref={(el) => {
                                                            if (el && rs.stream && el.srcObject !== rs.stream) {
                                                                el.srcObject = rs.stream;
                                                            }
                                                        }}
                                                    />
                                                    <div className="webrtc-video-label">
                                                        {peerNamesMap[rs.id] || "Participant"}
                                                    </div>
                                                </div>
                                            ))}
                                    </div>
                                </div>
                            ) : (
                                /* ── Normal grid layout ── */
                                <div
                                    className="webrtc-human-grid"
                                    style={{
                                        gridTemplateColumns: isXs
                                            ? "1fr"
                                            : remoteStreams.length > 0
                                                ? "1fr 1fr"
                                                : "1fr"
                                    }}
                                >
                                    <div className="webrtc-video-frame">
                                        <video
                                            ref={videoRef}
                                            muted
                                            autoPlay
                                            playsInline
                                            className="webrtc-video webrtc-video--local"
                                        />
                                        <div className="webrtc-video-label">{localSpeakerLabel}</div>
                                    </div>

                                    {remoteStreams.map((rs) => (
                                        <div key={rs.id} className="webrtc-video-frame">
                                            <video
                                                autoPlay
                                                playsInline
                                                className="webrtc-video"
                                                ref={(el) => {
                                                    if (el && rs.stream && el.srcObject !== rs.stream) {
                                                        el.srcObject = rs.stream;
                                                    }
                                                }}
                                            />
                                            <div className="webrtc-video-label">
                                                {peerNamesMap[rs.id] || "Participant"}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {!participantsReady ? (
                                <div className="webrtc-waiting">
                                    Waiting for the other participant to join this interview room...
                                </div>
                            ) : null}
                        </div>

                        {!someoneIsPresenting ? (
                            <div className="webrtc-human-side-panel">
                                <div className="webrtc-human-side-card">
                                    <div className="webrtc-human-side-card-title">
                                        <GroupsRounded className="webrtc-human-side-card-icon" />
                                        <span>Room Status</span>
                                    </div>
                                    <div className="webrtc-human-status-row">
                                        <span
                                            className={`webrtc-human-status-dot ${participantsReady ? "is-ready" : ""}`}
                                        />
                                        <div>
                                            <div className="webrtc-human-side-value">
                                                {participantStatusText}
                                            </div>
                                            <div className="webrtc-human-side-text">
                                                {isInterviewActive
                                                    ? "The live room is active and recording is already handled automatically."
                                                    : "The room activates as soon as you continue from consent and system checks."}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="webrtc-human-side-card">
                                    <div className="webrtc-human-side-card-title">
                                        <FactCheckOutlined className="webrtc-human-side-card-icon" />
                                        <span>Interview Mode</span>
                                    </div>
                                    <div className="webrtc-human-side-value">
                                        {modeTitle}
                                    </div>
                                    <div className="webrtc-human-side-text">
                                        {modeSummary}
                                    </div>
                                </div>
                            </div>
                        ) : null}
                    </div>
                </div>

                <div className="webrtc-transcript-bottom">
                    <div className="webrtc-transcript-header">
                        <h3>Live Transcript</h3>
                        <span className="webrtc-transcript-meta">
                            Saved automatically
                        </span>
                    </div>

                    {conversation.length === 0 ? (
                        <p>
                            {transcriptEmptyText}
                        </p>
                    ) : null}

                    {conversation.map((c, i) => (
                        <div
                            key={i}
                            className="webrtc-transcript-item-bottom"
                        >
                            {c.user ? (
                                <p className="webrtc-transcript-line">
                                    <strong>{localSpeakerLabel}:</strong> {c.user}
                                </p>
                            ) : null}
                            {c.remote ? (
                                <p className="webrtc-transcript-line webrtc-transcript-line--remote">
                                    <strong>
                                        {c.remoteRole === "interviewer"
                                            ? `Interviewer${c.remoteName ? ` (${c.remoteName})` : ""}`
                                            : `Candidate${c.remoteName ? ` (${c.remoteName})` : ""}`
                                        }:
                                    </strong> {c.remote}
                                </p>
                            ) : null}
                            {c.ai ? (
                                <p className="webrtc-transcript-line webrtc-transcript-line--assistant">
                                    <strong>AI Assistant:</strong> {c.ai}
                                </p>
                            ) : null}
                        </div>
                    ))}
                </div>

                <div
                    className={`webrtc-bottom-bar webrtc-bottom-bar--human ${isSm ? "webrtc-bottom-bar--stacked" : ""}`}
                >
                    <div className="webrtc-timer">
                        Time {displayTime}
                    </div>

                    <div className="webrtc-controls">
                        <div className="webrtc-controls-group">
                            <button
                                onClick={toggleMic}
                                className="webrtc-control-button"
                            >
                                <div className="webrtc-control-stack">
                                    <div
                                        className={`webrtc-control webrtc-control--mic ${isMicOn ? "is-on" : "is-off"}`}
                                    >
                                        <span className="webrtc-control-icon">
                                            {isMicOn ? (
                                                <MicRounded className="webrtc-icon" />
                                            ) : (
                                                <MicOffRounded className="webrtc-icon" />
                                            )}
                                        </span>
                                    </div>
                                    <span className="webrtc-control-label webrtc-control-label--dynamic">
                                        Mic
                                    </span>
                                </div>
                            </button>

                            <button
                                onClick={toggleCamera}
                                className="webrtc-control-button"
                            >
                                <div className="webrtc-control-stack">
                                    <div
                                        className={`webrtc-control webrtc-control--camera ${isCameraOn ? "is-on" : "is-off"}`}
                                    >
                                        <span className="webrtc-control-icon">
                                            {isCameraOn ? (
                                                <VideocamRounded className="webrtc-icon" />
                                            ) : (
                                                <VideocamOffRounded className="webrtc-icon" />
                                            )}
                                        </span>
                                    </div>
                                    <span className="webrtc-control-label">
                                        Camera
                                    </span>
                                </div>
                            </button>

                            <button
                                onClick={toggleScreenShare}
                                className="webrtc-control-button"
                            >
                                <div className="webrtc-control-stack">
                                    <div
                                        className={`webrtc-control webrtc-control--share ${isScreenSharing ? "is-on" : "is-off"}`}
                                    >
                                        <span className="webrtc-control-icon">
                                            {isScreenSharing ? (
                                                <ScreenShareRounded className="webrtc-icon" />
                                            ) : (
                                                <StopScreenShareRounded className="webrtc-icon" />
                                            )}
                                        </span>
                                    </div>
                                    <span className="webrtc-control-label">
                                        Share
                                    </span>
                                </div>
                            </button>

                            <button
                                type="button"
                                onClick={onToggleChat}
                                className="webrtc-control-button"
                                aria-label={isChatOpen ? "Close chat drawer" : "Open chat drawer"}
                            >
                                <div className="webrtc-control-stack">
                                    <div
                                        className={`webrtc-control webrtc-control--chat ${isChatOpen ? "is-on" : "is-off"}`}
                                    >
                                        <span className="webrtc-control-icon">
                                            <ChatRounded className="webrtc-icon" />
                                        </span>
                                    </div>
                                    <span className="webrtc-control-label">
                                        Chat
                                    </span>
                                </div>
                            </button>
                        </div>

                        <div className="webrtc-control-area">
                            <div className="webrtc-recording-pill">
                                <span className="webrtc-recording-dot" />
                                Recording and transcript are live
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={endCall}
                        className="webrtc-end-call"
                    >
                        End Call
                    </button>
                </div>
            </div>

            {isChatOpen ? (
                <button
                    type="button"
                    className="webrtc-chat-backdrop"
                    onClick={onCloseChat}
                    aria-label="Close chat drawer"
                />
            ) : null}

            <aside
                className={`webrtc-chat-drawer ${drawerSideClass} ${isChatOpen ? "is-open" : ""}`}
                aria-hidden={!isChatOpen}
            >
                <div className="webrtc-chat-drawer-head">
                    <div className="webrtc-chat-drawer-title">
                        <ChatRounded className="webrtc-chat-launch-icon" />
                        <span>Interview Chat & Documents</span>
                    </div>
                    <button
                        type="button"
                        className="webrtc-chat-close"
                        onClick={onCloseChat}
                        aria-label="Close chat"
                    >
                        <CloseRounded />
                    </button>
                </div>

                <div className="webrtc-chat-thread">
                    {chatMessages.length === 0 ? (
                        <div className="webrtc-chat-empty">
                            Use this drawer to exchange short messages and share documents during the live interview.
                        </div>
                    ) : null}

                    {chatMessages.map((message) => (
                        <div
                            key={message.id}
                            className={`webrtc-chat-message ${message.isOwn ? "is-own" : ""}`}
                        >
                            <div className="webrtc-chat-meta">
                                <span>
                                    {message.senderRole === "interviewer"
                                        ? `Interviewer${message.senderName ? ` (${message.senderName})` : ""}`
                                        : `Candidate${message.senderName ? ` (${message.senderName})` : ""}`
                                    }
                                </span>
                                <span>{formatChatTime(message.createdAt)}</span>
                            </div>
                            <div className="webrtc-chat-bubble">
                                {message.text ? (
                                    <p className="webrtc-chat-text">
                                        {message.text}
                                    </p>
                                ) : null}

                                {message.kind === "file" && message.file ? (
                                    <div className="webrtc-chat-bubble-file">
                                        <DescriptionOutlined className="webrtc-human-side-card-icon" />
                                        <div className="webrtc-chat-file-body">
                                            <div className="webrtc-chat-file-name">
                                                {message.file.name}
                                            </div>
                                            <div className="webrtc-chat-file-meta">
                                                {formatFileSize(message.file.size)}
                                            </div>
                                        </div>
                                        <a
                                            href={message.file.dataUrl}
                                            download={message.file.name}
                                            className="webrtc-chat-download"
                                        >
                                            Download
                                        </a>
                                    </div>
                                ) : null}
                            </div>
                        </div>
                    ))}
                </div>

                {chatError ? (
                    <div className="webrtc-chat-error" role="alert">
                        {chatError}
                    </div>
                ) : null}

                <div className="webrtc-chat-composer">
                    <label className="webrtc-chat-upload">
                        <AttachFileRounded className="webrtc-chat-launch-icon" />
                        <span>Upload document</span>
                        <input
                            type="file"
                            accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg"
                            hidden
                            onChange={(event) => {
                                const nextFile = event.target.files?.[0] || null;
                                onSendChatFile(nextFile);
                                event.target.value = "";
                            }}
                        />
                    </label>

                    <textarea
                        value={chatDraft}
                        onChange={(event) =>
                            onChatDraftChange(event.target.value)
                        }
                        onKeyDown={handleChatKeyDown}
                        className="webrtc-chat-textarea"
                        rows={isXs ? 3 : 4}
                        placeholder="Type a message and press Enter to send"
                    />

                    <button
                        type="button"
                        className="webrtc-chat-send"
                        onClick={onSendChatMessage}
                    >
                        <SendRounded className="webrtc-chat-launch-icon" />
                        <span>Send</span>
                    </button>
                </div>
            </aside>
        </>
    );
}
