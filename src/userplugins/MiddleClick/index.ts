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
const DEADZONE   = 10;   // px from origin before scrolling kicks in
const BASE_SPEED = 0.1;  // multiplier at the edge of the deadzone
const EXPONENT   = 1;    // >1 = faster the further you go (try 1.5–2.5)
const MAX_SPEED  = 60;   // max px per frame (safety cap)

// ─── Chat-only scroll zone ─────────────────────────────────────────────────
// Only the main chat message scroller triggers auto-scroll.
const CHAT_SELECTORS = [
    '[class*="messagesWrapper"]',
    '[class*="scroller"][class*="chat"]',
    '[class*="scrollerInner"]',
];

// ─── Elements that should keep default middle-click behaviour ──────────────
// Clicking these passes through so the browser can open links/images in a new tab.
function isPassthroughTarget(el: Element | null): boolean {
    if (!el) return false;
    if (el.closest("a[href]")) return true;
    if (el.closest("img")) return true;
    if (el.closest('[class*="imageWrapper"]')) return true;
    if (el.closest('[class*="attachmentWrapper"]')) return true;
    if (el.closest('[class*="videoWrapper"]')) return true;
    if (el.closest("video")) return true;
    return false;
}

// ─── Zone check ────────────────────────────────────────────────────────────
function isInChatZone(target: Element | null): boolean {
    if (!target) return false;
    return target.closest(CHAT_SELECTORS.join(", ")) !== null;
}

// ─── Cursor overlay ────────────────────────────────────────────────────────
function createCursorOverlay(x: number, y: number) {
    removeCursorOverlay();
    cursorOverlay = document.createElement("div");
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

// ─── Speed curve ───────────────────────────────────────────────────────────
function calcVelocity(delta: number): number {
    const sign = Math.sign(delta);
    const abs  = Math.abs(delta);
    if (abs <= DEADZONE) return 0;
    const speed = BASE_SPEED * Math.pow(abs - DEADZONE, EXPONENT);
    return sign * Math.min(speed, MAX_SPEED);
}

// ─── Scrollable ancestor ───────────────────────────────────────────────────
function getScrollableParent(el: Element | null): Element | null {
    while (el && el !== document.body) {
        const { overflowY, overflowX } = window.getComputedStyle(el);
        if (
            (overflowY === "auto" || overflowY === "scroll") && el.scrollHeight > el.clientHeight ||
            (overflowX === "auto" || overflowX === "scroll") && el.scrollWidth  > el.clientWidth
        ) return el;
        el = el.parentElement;
    }
    return document.documentElement;
}

// ─── Scroll loop ───────────────────────────────────────────────────────────
function scrollLoop() {
    if (!isScrolling || !scrollTarget) return;
    scrollTarget.scrollLeft += velocityX;
    scrollTarget.scrollTop  += velocityY;
    animationFrameId = requestAnimationFrame(scrollLoop);
}

// ─── Event handlers ────────────────────────────────────────────────────────
function onMouseDown(e: MouseEvent) {
    if (e.button !== 1) return;

    const target = e.target as Element;

    // Let links, images, videos keep their native middle-click behaviour
    if (isPassthroughTarget(target)) return;

    // Toggle off if already scrolling
    if (isScrolling) {
        e.preventDefault();
        e.stopPropagation();
        stopScrolling();
        return;
    }

    // Only intercept inside the chat message list
    if (!isInChatZone(target)) return;

    e.preventDefault();
    e.stopPropagation();

    isScrolling   = true;
    startX        = e.clientX;
    startY        = e.clientY;
    scrollTarget  = getScrollableParent(target);
    velocityX     = 0;
    velocityY     = 0;

    createCursorOverlay(e.clientX, e.clientY);
    if (animationFrameId !== null) cancelAnimationFrame(animationFrameId);
    animationFrameId = requestAnimationFrame(scrollLoop);
}

function onMouseMove(e: MouseEvent) {
    if (!isScrolling) return;
    velocityX = calcVelocity(e.clientX - startX);
    velocityY = calcVelocity(e.clientY - startY);
}

function onMouseUp(e: MouseEvent) {
    // Any non-middle click while auto-scrolling cancels it
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
    // Suppress auxclick (Linux primary-selection paste) on middle button —
    // but only inside the chat zone and not on passthrough targets.
    if (e.button !== 1) return;
    if (isPassthroughTarget(e.target as Element)) return;
    if (!isInChatZone(e.target as Element)) return;
    e.preventDefault();
    e.stopPropagation();
}

function stopScrolling() {
    isScrolling  = false;
    velocityX    = 0;
    velocityY    = 0;
    scrollTarget = null;
    if (animationFrameId !== null) { cancelAnimationFrame(animationFrameId); animationFrameId = null; }
    removeCursorOverlay();
}

// ─── Plugin ────────────────────────────────────────────────────────────────
export default definePlugin({
    name: "MiddleClickScroll",
    description: "Replaces middle-click paste (Linux X11) with Windows-style auto-scroll in the chat message list. Middle-clicking links, images, and videos still opens them normally.",
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
