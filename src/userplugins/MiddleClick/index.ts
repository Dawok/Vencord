import definePlugin from "@utils/types";

let isScrolling = false;
let startX = 0;
let startY = 0;
let scrollTarget: Element | null = null;
let animationFrameId: number | null = null;
let velocityX = 0;
let velocityY = 0;
let cursorOverlay: HTMLDivElement | null = null;

// --- Cursor overlay (Windows-style scroll indicator) ---

function createCursorOverlay(x: number, y: number) {
    removeCursorOverlay();
    cursorOverlay = document.createElement("div");
    cursorOverlay.id = "vc-middle-scroll-cursor";

    const size = 28;
    Object.assign(cursorOverlay.style, {
        position: "fixed",
        left: `${x - size / 2}px`,
        top: `${y - size / 2}px`,
        width: `${size}px`,
        height: `${size}px`,
        zIndex: "999999",
        pointerEvents: "none",
        userSelect: "none",
    });

    // SVG icon: circle with up/down arrows, like Windows auto-scroll cursor
    cursorOverlay.innerHTML = `
        <svg width="${size}" height="${size}" viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">
            <circle cx="14" cy="14" r="12" fill="rgba(30,30,30,0.75)" stroke="rgba(255,255,255,0.7)" stroke-width="1.5"/>
            <!-- Up arrow -->
            <polygon points="14,5 10,11 18,11" fill="white"/>
            <!-- Down arrow -->
            <polygon points="14,23 10,17 18,17" fill="white"/>
            <!-- Center dot -->
            <circle cx="14" cy="14" r="2" fill="white"/>
        </svg>
    `;

    document.body.appendChild(cursorOverlay);
}

function removeCursorOverlay() {
    if (cursorOverlay) {
        cursorOverlay.remove();
        cursorOverlay = null;
    }
}

// --- Find the nearest scrollable ancestor ---

function getScrollableParent(el: Element | null): Element | null {
    while (el && el !== document.body) {
        const style = window.getComputedStyle(el);
        const overflowY = style.overflowY;
        const overflowX = style.overflowX;
        const canScrollY = (overflowY === "auto" || overflowY === "scroll") && el.scrollHeight > el.clientHeight;
        const canScrollX = (overflowX === "auto" || overflowX === "scroll") && el.scrollWidth > el.clientWidth;
        if (canScrollY || canScrollX) return el;
        el = el.parentElement;
    }
    return document.documentElement;
}

// --- Scroll animation loop ---

const SPEED_FACTOR = 0.015; // Controls how sensitive scroll speed is to mouse distance
const DEADZONE = 8;          // Pixels from origin before scrolling starts

function scrollLoop() {
    if (!isScrolling || !scrollTarget) return;
    scrollTarget.scrollLeft += velocityX;
    scrollTarget.scrollTop += velocityY;
    animationFrameId = requestAnimationFrame(scrollLoop);
}

// --- Event handlers ---

function onMouseDown(e: MouseEvent) {
    // Middle mouse button = button 1
    if (e.button !== 1) return;

    // Prevent default (which on Linux X11 is "paste primary selection")
    e.preventDefault();
    e.stopPropagation();

    if (isScrolling) {
        stopScrolling();
        return;
    }

    isScrolling = true;
    startX = e.clientX;
    startY = e.clientY;
    scrollTarget = getScrollableParent(e.target as Element);

    createCursorOverlay(e.clientX, e.clientY);

    if (animationFrameId !== null) cancelAnimationFrame(animationFrameId);
    velocityX = 0;
    velocityY = 0;
    animationFrameId = requestAnimationFrame(scrollLoop);
}

function onMouseMove(e: MouseEvent) {
    if (!isScrolling) return;

    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    velocityX = Math.abs(dx) > DEADZONE ? dx * SPEED_FACTOR : 0;
    velocityY = Math.abs(dy) > DEADZONE ? dy * SPEED_FACTOR : 0;
}

function onMouseUp(e: MouseEvent) {
    // Clicking any button (except middle re-click, handled in mousedown) stops scroll
    if (!isScrolling) return;
    if (e.button === 1) return; // middle button handled in mousedown toggle
    stopScrolling();
}

function onKeyDown(e: KeyboardEvent) {
    if (isScrolling && e.key === "Escape") {
        stopScrolling();
    }
}

function onWheel(e: WheelEvent) {
    // If auto-scrolling, stop when the user uses the scroll wheel normally
    if (isScrolling) {
        stopScrolling();
    }
}

function onAuxClick(e: MouseEvent) {
    // Suppress the auxclick event on middle button to prevent any paste behaviour
    if (e.button === 1) {
        e.preventDefault();
        e.stopPropagation();
    }
}

function stopScrolling() {
    isScrolling = false;
    velocityX = 0;
    velocityY = 0;
    scrollTarget = null;
    if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
    removeCursorOverlay();
}

// --- Plugin definition ---

export default definePlugin({
    name: "MiddleClickScroll",
    description: "Disables middle-click paste (Linux) and replaces it with Windows-style auto-scroll. Click middle mouse to start, move mouse to scroll, click again (or press Esc) to stop.",
    authors: [{ name: "you", id: 0n }],

    start() {
        // Use capture phase so we intercept before Discord's own handlers
        document.addEventListener("mousedown", onMouseDown, { capture: true });
        document.addEventListener("mousemove", onMouseMove, { capture: true });
        document.addEventListener("mouseup", onMouseUp, { capture: true });
        document.addEventListener("auxclick", onAuxClick, { capture: true });
        document.addEventListener("keydown", onKeyDown, { capture: true });
        document.addEventListener("wheel", onWheel, { capture: true, passive: true });
    },

    stop() {
        stopScrolling();
        document.removeEventListener("mousedown", onMouseDown, { capture: true });
        document.removeEventListener("mousemove", onMouseMove, { capture: true });
        document.removeEventListener("mouseup", onMouseUp, { capture: true });
        document.removeEventListener("auxclick", onAuxClick, { capture: true });
        document.removeEventListener("keydown", onKeyDown, { capture: true });
        document.removeEventListener("wheel", onWheel, { capture: true });
    },
});
