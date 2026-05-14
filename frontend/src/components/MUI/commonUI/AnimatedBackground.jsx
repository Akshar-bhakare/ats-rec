import { useEffect, useRef } from "react";

export default function AnimatedBackground() {
    const ref = useRef(null);

    useEffect(() => {
        const el = ref.current;

        const handleMouseMove = (e) => {
            const x = (e.clientX / window.innerWidth - 0.5) * 30;
            const y = (e.clientY / window.innerHeight - 0.5) * 30;
            el.style.transform = `translate(${x}px, ${y}px) scale(1.15)`;
        };

        window.addEventListener("mousemove", handleMouseMove);
        return () => window.removeEventListener("mousemove", handleMouseMove);
    }, []);

    return (
        <>
            <style>
                {`
	          @keyframes waterFlow {
	            0% { filter: blur(150px); opacity: 0.85; }
	            50% { filter: blur(172px); opacity: 0.95; }
	            100% { filter: blur(150px); opacity: 0.85; }
	          }
	        `}
            </style>

            <div
                ref={ref}
                style={{
                    position: "fixed",
                    inset: 0,
                    zIndex: -1,
                    pointerEvents: "none",
                    filter: "none",
                    opacity: 1,
                    transition: "none",
                    animation: "none",
                    background: "#F6F6F6",
                }}
            />
        </>
    );
}
