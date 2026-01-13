import React, { useEffect, useRef, useState } from 'react';

const GlitchLogo: React.FC = () => {
    const overlayRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [isGlitching, setIsGlitching] = useState(false);

    // Configuration
    const colors = ['#00f2ff', '#7000ff', '#ffffff']; // Cyan, Purple, White

    useEffect(() => {
        let timeoutId: ReturnType<typeof setTimeout>;

        const createBolt = () => {
            if (!overlayRef.current) return;

            // 1. Setup SVG
            const svgNS = "http://www.w3.org/2000/svg";
            const svg = document.createElementNS(svgNS, "svg");
            svg.setAttribute("class", "absolute w-full h-full overflow-visible");
            
            // 2. Generate Random Points (Jagged Line)
            // Start from top area (random X)
            const startX = Math.random() * 100; 
            const startY = -10; // Start slightly above
            let pathData = `M ${startX}% ${startY}%`;
            
            let currentX = startX;
            let currentY = startY;
            const steps = 10 + Math.random() * 10; // Jaggedness

            for (let i = 0; i < steps; i++) {
                currentY += (120 / steps); // Go down past bottom
                currentX += (Math.random() - 0.5) * 30; // Jagged left/right
                pathData += ` L ${currentX}% ${currentY}%`;
            }

            // 3. Create Path Element
            const path = document.createElementNS(svgNS, "path");
            path.setAttribute("d", pathData);
            path.style.fill = "none";
            path.style.strokeLinecap = "round";
            path.style.strokeLinejoin = "round";
            path.style.opacity = "0";
            path.style.animation = "flash 0.15s ease-out forwards";

            // 4. Style: Color & Glow
            const color = colors[Math.floor(Math.random() * colors.length)];
            path.style.stroke = color;
            path.style.strokeWidth = Math.random() > 0.5 ? "2px" : "1px";
            path.style.filter = `drop-shadow(0 0 5px ${color})`;
            
            // 5. Append
            svg.appendChild(path);
            overlayRef.current.appendChild(svg);

            // 6. Trigger Glitch on Logo
            setIsGlitching(true);

            // 7. Cleanup
            setTimeout(() => setIsGlitching(false), 200);
            setTimeout(() => {
                if (overlayRef.current && overlayRef.current.contains(svg)) {
                    overlayRef.current.removeChild(svg);
                }
            }, 250);
        };

        const loop = () => {
            // Random delay between 0.5s and 4s
            const delay = Math.random() * 3500 + 500; 
            
            timeoutId = setTimeout(() => {
                createBolt();
                // Random chance for double strike
                if(Math.random() > 0.7) {
                    setTimeout(createBolt, 100);
                }
                loop();
            }, delay);
        };

        loop();

        return () => clearTimeout(timeoutId);
    }, []);

    return (
        <div className="relative w-full flex justify-center py-2">
            <style>{`
                @keyframes flash {
                    0% { opacity: 0; }
                    10% { opacity: 1; stroke-width: 3px; }
                    50% { opacity: 0.8; stroke-width: 1px; }
                    100% { opacity: 0; }
                }
                
                @keyframes glitch-anim-1 {
                    0% { clip-path: inset(20% 0 80% 0); transform: translate(-2px, 1px); }
                    20% { clip-path: inset(60% 0 10% 0); transform: translate(2px, -1px); }
                    40% { clip-path: inset(10% 0 50% 0); transform: translate(-2px, 2px); }
                    60% { clip-path: inset(80% 0 5% 0); transform: translate(2px, -2px); }
                    80% { clip-path: inset(30% 0 40% 0); transform: translate(-1px, 1px); }
                    100% { clip-path: inset(50% 0 30% 0); transform: translate(1px, -1px); }
                }

                @keyframes glitch-anim-2 {
                    0% { clip-path: inset(10% 0 60% 0); transform: translate(2px, -1px); }
                    20% { clip-path: inset(30% 0 20% 0); transform: translate(-2px, 1px); }
                    40% { clip-path: inset(70% 0 10% 0); transform: translate(2px, -2px); }
                    60% { clip-path: inset(20% 0 50% 0); transform: translate(-2px, 2px); }
                    80% { clip-path: inset(50% 0 30% 0); transform: translate(1px, -1px); }
                    100% { clip-path: inset(5% 0 80% 0); transform: translate(-1px, 1px); }
                }

                @keyframes shake {
                    0%, 100% { transform: translate(0, 0); }
                    25% { transform: translate(-1px, 1px); }
                    50% { transform: translate(1px, -1px); }
                    75% { transform: translate(-1px, 1px); }
                }

                .glitch-container.active .logo-content {
                    animation: shake 0.2s cubic-bezier(.36,.07,.19,.97) both;
                    filter: brightness(1.2) contrast(1.1);
                }

                .glitch-container.active::before,
                .glitch-container.active::after {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: inherit;
                    border-radius: inherit;
                    opacity: 0.5;
                }

                .glitch-container.active::before {
                    background-color: #00f2ff;
                    animation: glitch-anim-1 0.2s infinite linear alternate-reverse;
                    mix-blend-mode: hard-light;
                    z-index: -1;
                }

                .glitch-container.active::after {
                    background-color: #7000ff;
                    animation: glitch-anim-2 0.2s infinite linear alternate-reverse;
                    mix-blend-mode: hard-light;
                    z-index: -2;
                }
            `}</style>

            {/* Lightning Overlay Container */}
            <div 
                ref={overlayRef} 
                className="absolute top-[-40px] left-[-40px] right-[-40px] bottom-[-40px] pointer-events-none z-30"
            />

            {/* Logo Container */}
            <div 
                ref={containerRef}
                className={`glitch-container relative bg-white p-2 rounded-lg w-full flex justify-center shadow-lg shadow-orange-900/10 transition-all duration-100 ${isGlitching ? 'active' : ''}`}
            >
                <img 
                    src="https://images.seeklogo.com/logo-png/19/1/applus-velosi-logo-png_seeklogo-193943.png" 
                    alt="Applus Velosi" 
                    className="logo-content h-10 object-contain relative z-10"
                />
            </div>
        </div>
    );
};

export default GlitchLogo;