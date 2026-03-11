import definePlugin from "@utils/types";

let isScrolling = false;
let startX = 0;
let startY = 0;
let scrollTarget: Element | null = null;
let animationFrameId: number | null = null;
let velocityX = 0;
let velocityY = 0;
let cursorOverlay: HTMLDivElement | null = null;

// ─── Scroll speed config ───────────────────────────────────────────────────
const DEADZONE = 10;        // px from origin before scrolling kicks in
const BASE_SPEED = 0.12;    // multiplier at the edge of the deadzone
const EXPONENT = 1.7;       // >1 = faster the further you go (try 1.5–2.5)
const MAX_SPEED = 60;       // max px per frame (safety cap)

// ─── Discord scroll zones ──────────────────────────────────────────────────
// These CSS selectors cover the main areas users actually want to scroll.
const SCROLL_ZONE_SELECTORS = [
    // Main chat message list
    '[class*="messagesWrapper"]',
    '[class*="scroller"][class*="chat"]',
    '[class*="scroller-"]',          // generic Discord scroller
    // Member list sidebar
    '[class*="members"]',
    '[class*="membersList"]',
    // Server / DM list
    '[class*="guilds"]',
    '[class*="privateChannels"]',
    // Channel list sidebar
    '[class*="sidebar"]',
    '[class*="channels"]',
    // Threads / forum / search results
    '[class*="threadSidebar"]',
    '[class*="searchResultsWrap"]',
    // Inbox / notifications panel
    '[class*="container"][class*="inbox"]',
];

// ─── Cursor overlay ────────────────────────────────────────────────────────

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
        transition: "opacity 0.1s",
    });
    cursorOverlay.innerHTML = `
        <svg width="${size}" height="${size}" viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">
            <circle cx="14" cy="14" r="12" fill="rgba(20,20,20,0.82)" stroke="rgba(255,255,255,0.65)" stroke-width="1.5"/>
            <polygon points="14,5 10,11 18,11" fill="white"/>
            <polygon points="14,23 10,17 18,17" fill="white"/>
            <circle cx="14" cy="14" r="2" fill="white"/>
        </svg>`;
    document.body.appendChild(cursorOverlay);
}

function removeCursorOverlay() {
    cursorOverlay?.remove();
    cursorOverlay = null;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

/** Exponential speed curve: dead zone near origin, accelerates fast further out */
function calcVelocity(delta: number): number {
    const sign = Math.sign(delta);
    const abs = Math.abs(delta);
    if (abs <= DEADZONE) return 0;
    const adjusted = abs - DEADZONE;
    const speed = BASE_SPEED * Math.pow(adjusted, EXPONENT);
    return sign * Math.min(speed, MAX_SPEED);
}

/** Walk up the DOM and return the nearest scrollable ancestor */
function getScrollableParent(el: Element | null): Element | null {
    while (el && el !== document.body) {
        const { overflowY, overflowX } = window.getComputedStyle(el);
        if (
            (overflowY === "auto" || overflowY === "scroll") && el.scrollHeight > el.clientHeight ||
            (overflowX === "auto" || overflowX === "scroll") && el.scrollWidth > el.clientWidth
        ) return el;
        el = el.parentElement;
    }
    return document.documentElement;
}

/**
 * Return true only if the click happened inside one of our allowed scroll zones.
 * We check the target and all its ancestors so clicking on a message bubble
 * (which is inside the scroller) still triggers auto-scroll.
 */
function isInScrollZone(target: Element | null): boolean {
    if (!target) return false;
    // Build a combined selector
    const combined = SCROLL_ZONE_SELECTORS.join(", ");
    return target.closest(combined) !== null;
}

// ─── Scroll loop ───────────────────────────────────────────────────────────

function scrollLoop() {
    if (!isScrolling || !scrollTarget) return;
    scrollTarget.scrollLeft += velocityX;
    scrollTarget.scrollTop += velocityY;
    animationFrameId = requestAnimationFrame(scrollLoop);
}

// ─── Event handlers ────────────────────────────────────────────────────────

function onMouseDown(e: MouseEvent) {
    if (e.button !== 1) return;
    e.preventDefault();
    e.stopPropagation();

    // Toggle off if already scrolling
    if (isScrolling) { stopScrolling(); return; }

    // Only activate inside designated Discord scroll zones
    if (!isInScrollZone(e.target as Element)) return;

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
    velocityX = calcVelocity(e.clientX - startX);
    velocityY = calcVelocity(e.clientY - startY);
}

function onMouseUp(e: MouseEvent) {
    // Any non-middle click while scrolling cancels it
    if (!isScrolling || e.button === 1) return;
    stopScrolling();
}

function onKeyDown(e: KeyboardEvent) {
    if (isScrolling && e.key === "Escape") stopScrolling();
}

function onWheel() {
    if (isScrolling) stopScrolling();
}

function onAuxClick(e: MouseEvent) {
    if (e.button === 1) { e.preventDefault(); e.stopPropagation(); }
}

function stopScrolling() {
    isScrolling = false;
    velocityX = 0;
    velocityY = 0;
    scrollTarget = null;
    if (animationFrameId !== null) { cancelAnimationFrame(animationFrameId); animationFrameId = null; }
    removeCursorOverlay();
}

// ─── Plugin ────────────────────────────────────────────────────────────────

export default definePlugin({
    name: "MiddleClickScroll",
    description: "Disables middle-click paste (Linux X11) and replaces it with Windows-style auto-scroll inside Discord's chat, sidebars, and member lists. Speed scales exponentially with mouse distance.",
    authors: [{ name: "you", id: 0n }],

    start() {
        document.addEventListener("mousedown", onMouseDown, { capture: true });
        document.addEventListener("mousemove", onMouseMove, { capture: true });
        document.addEventListener("mouseup",   onMouseUp,   { capture: true });
        document.addEventListener("auxclick",  onAuxClick,  { capture: true });
        document.addEventListener("keydown",   onKeyDown,   { capture: true });
        document.addEventListener("wheel",     onWheel,     { capture: true, passive: true });
    },

    stop() {
        stopScrolling();
        document.removeEventListener("mousedown", onMouseDown, { capture: true });
        document.removeEventListener("mousemove", onMouseMove, { capture: true });
        document.removeEventListener("mouseup",   onMouseUp,   { capture: true });
        document.removeEventListener("auxclick",  onAuxClick,  { capture: true });
        document.removeEventListener("keydown",   onKeyDown,   { capture: true });
        document.removeEventListener("wheel",     onWheel,     { capture: true });
    },
});
