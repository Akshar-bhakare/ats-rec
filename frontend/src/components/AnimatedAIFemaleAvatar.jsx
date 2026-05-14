import React from "react";

const AnimatedAIFemaleAvatar = ({ isSpeaking }) => {
    return (
        <>
            <style>{`
                .ai-female-wrapper {
                    width: 150px;
                    height: 150px;
                    border-radius: 999px;
                    background: radial-gradient(circle at 30% 20%, #ffe4ec 0%, #fb7185 40%, #020617 100%);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    position: relative;
                    overflow: hidden;
                    box-shadow: 0 0 22px rgba(251, 113, 133, 0.8);
                }

                .ai-female-root {
                    position: relative;
                    width: 120px;
                    height: 140px;
                }

                /* idle vs speaking */
                .ai-female-wrapper.idle .ai-female-root {
                    animation: ai-female-float 4s ease-in-out infinite;
                }

                .ai-female-wrapper.speaking .ai-female-head {
                    animation: ai-female-head-bob 0.45s ease-in-out infinite;
                }

                .ai-female-wrapper.speaking .ai-female-mouth-inner {
                    animation: ai-female-talk 0.18s ease-in-out infinite;
                }

                .ai-female-wrapper.speaking .ai-female-shoulders {
                    animation: ai-female-breathe 1.2s ease-in-out infinite;
                }

                .ai-female-shoulders {
                    position: absolute;
                    bottom: 0;
                    left: 50%;
                    transform: translateX(-50%);
                    width: 110px;
                    height: 70px;
                    background: linear-gradient(180deg, #1d4ed8 0%, #020617 100%);
                    border-radius: 80px 80px 20px 20px;
                }

                .ai-female-shoulders::after {
                    content: "";
                    position: absolute;
                    inset: 12px 18px auto;
                    height: 22px;
                    border-radius: 30px;
                    background: radial-gradient(circle at 50% 0, rgba(248, 250, 252, 0.16), transparent 70%);
                    opacity: 0.9;
                }

                .ai-female-neck {
                    position: absolute;
                    bottom: 54px;
                    left: 50%;
                    transform: translateX(-50%);
                    width: 26px;
                    height: 24px;
                    background: #fed7d7;
                    border-radius: 16px;
                    box-shadow: 0 0 4px rgba(0,0,0,0.4);
                }

                .ai-female-head {
                    position: absolute;
                    bottom: 82px;
                    left: 50%;
                    transform: translateX(-50%);
                    width: 80px;
                    height: 80px;
                    border-radius: 50%;
                    background: #fecaca;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.5);
                    overflow: visible;
                }

                /* hair behind head */
                .ai-female-hair-back {
                    position: absolute;
                    inset: -6px -4px 10px -4px;
                    border-radius: 60px;
                    background: #020617;
                    z-index: -1;
                    box-shadow: 0 12px 0 rgba(15,23,42,0.95);
                }

                /* long hair sides */
                .ai-female-hair-side {
                    position: absolute;
                    width: 20px;
                    height: 60px;
                    background: #020617;
                    bottom: 6px;
                    border-radius: 30px;
                }

                .ai-female-hair-side.left {
                    left: -4px;
                }

                .ai-female-hair-side.right {
                    right: -4px;
                }

                /* fringe */
                .ai-female-bangs {
                    position: absolute;
                    top: -4px;
                    left: 8px;
                    width: 64px;
                    height: 40px;
                    background: #020617;
                    border-radius: 60px 60px 30px 30px;
                    clip-path: polygon(0 0, 100% 0, 92% 40%, 70% 70%, 50% 60%, 30% 75%, 10% 55%);
                }

                /* ears */
                .ai-female-ears {
                    position: absolute;
                    top: 32px;
                    left: -5px;
                    right: -5px;
                    display: flex;
                    justify-content: space-between;
                    pointer-events: none;
                }

                .ai-female-ear {
                    position: relative;
                    width: 12px;
                    height: 18px;
                    background: #fecaca;
                    border-radius: 50% 50% 45% 45%;
                    box-shadow: 0 0 2px rgba(0,0,0,0.25);
                }

                .ai-female-ear::after {
                    content: "";
                    position: absolute;
                    bottom: -4px;
                    left: 50%;
                    transform: translateX(-50%);
                    width: 5px;
                    height: 5px;
                    border-radius: 999px;
                    background: #f97316;
                }

                /* eyes & brows */
                .ai-female-eye {
                    position: absolute;
                    top: 30px;
                    width: 13px;
                    height: 13px;
                    border-radius: 999px;
                    background: #111827;
                    overflow: hidden;
                    box-shadow: 0 0 0 2px rgba(248,250,252,0.85);
                }

                .ai-female-eye.left {
                    left: 20px;
                }

                .ai-female-eye.right {
                    right: 20px;
                }

                .ai-female-eye-ball {
                    position: absolute;
                    inset: 0;
                    background: #111827;
                    animation: ai-female-blink 5s ease-in-out infinite;
                    transform-origin: center;
                }

                .ai-female-brow {
                    position: absolute;
                    top: 22px;
                    width: 18px;
                    height: 4px;
                    border-radius: 999px;
                    background: #020617;
                }

                .ai-female-brow.left {
                    left: 16px;
                }

                .ai-female-brow.right {
                    right: 16px;
                }

                /* cheeks */
                .ai-female-cheek {
                    position: absolute;
                    top: 46px;
                    width: 16px;
                    height: 9px;
                    background: rgba(248, 113, 113, 0.7);
                    border-radius: 999px;
                    filter: blur(0.3px);
                }

                .ai-female-cheek.left {
                    left: 12px;
                }

                .ai-female-cheek.right {
                    right: 12px;
                }

                /* mouth */
                .ai-female-mouth {
                    position: absolute;
                    bottom: 16px;
                    left: 50%;
                    transform: translateX(-50%);
                    width: 32px;
                    height: 18px;
                    border-radius: 0 0 20px 20px;
                    overflow: hidden;
                }

                .ai-female-mouth-inner {
                    position: absolute;
                    bottom: -1px;
                    left: 50%;
                    transform: translateX(-50%);
                    width: 26px;
                    height: 10px;
                    background: #b91c1c;
                    border-radius: 0 0 18px 18px;
                    transform-origin: center top;
                }

                .ai-female-mouth-inner::before {
                    content: "";
                    position: absolute;
                    top: -4px;
                    left: 50%;
                    transform: translateX(-50%);
                    width: 24px;
                    height: 7px;
                    background: #fecaca;
                    border-radius: 0 0 14px 14px;
                }

                /* animations */
                @keyframes ai-female-float {
                    0% { transform: translateY(1px); }
                    50% { transform: translateY(-3px); }
                    100% { transform: translateY(1px); }
                }

                @keyframes ai-female-head-bob {
                    0% { transform: translate(-50%, 0); }
                    50% { transform: translate(-50%, -3px); }
                    100% { transform: translate(-50%, 0); }
                }

                @keyframes ai-female-talk {
                    0% { transform: translateX(-50%) scaleY(0.4); }
                    50% { transform: translateX(-50%) scaleY(1.15); }
                    100% { transform: translateX(-50%) scaleY(0.6); }
                }

                @keyframes ai-female-breathe {
                    0% { transform: translateX(-50%) scaleY(1); }
                    50% { transform: translateX(-50%) scaleY(1.05); }
                    100% { transform: translateX(-50%) scaleY(1); }
                }

                @keyframes ai-female-blink {
                    0%, 4%, 100% { transform: scaleY(1); }
                    2% { transform: scaleY(0.1); }
                }
            `}</style>

            <div
                className={
                    "ai-female-wrapper " + (isSpeaking ? "speaking" : "idle")
                }
            >
                <div className="ai-female-root">
                    <div className="ai-female-shoulders" />
                    <div className="ai-female-neck" />
                    <div className="ai-female-head">
                        <div className="ai-female-hair-back" />
                        <div className="ai-female-hair-side left" />
                        <div className="ai-female-hair-side right" />
                        <div className="ai-female-bangs" />

                        <div className="ai-female-ears">
                            <div className="ai-female-ear" />
                            <div className="ai-female-ear" />
                        </div>

                        <div className="ai-female-brow left" />
                        <div className="ai-female-brow right" />

                        <div className="ai-female-eye left">
                            <div className="ai-female-eye-ball" />
                        </div>
                        <div className="ai-female-eye right">
                            <div className="ai-female-eye-ball" />
                        </div>

                        <div className="ai-female-cheek left" />
                        <div className="ai-female-cheek right" />

                        <div className="ai-female-mouth">
                            <div className="ai-female-mouth-inner" />
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

export default AnimatedAIFemaleAvatar;
