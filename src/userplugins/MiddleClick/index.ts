/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import definePlugin from "@utils/types";

let isScrolling = false;
let startX = 0;
let startY = 0;
let scrollTarget: Element | null = null;
let animationFrameId: number | null = null;
let velocityX = 0;
let velocityY = 0;
let cursorOverlay: HTMLDivElement | null = null;

// Track whether the mouseup immediately following our activating mousedown
// has been consumed yet. Without this the sequence mousedown→mouseup
// would start AND stop scrolling in the same click.
let ignoreNextMiddleUp = false;

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

    cursorOverlay.innerHTML = `
        <svg width="${size}" height="${size}" viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">
            <circle cx="14" cy="14" r="12" fill="rgba(30,30,30,0.75)" stroke="rgba(255,255,255,0.7)" stroke-width="1.5"/>
            <polygon points="14,5 10,11 18,11" fill="white"/>
            <polygon points="14,23 10,17 18,17" fill="white"/>
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

const SPEED_FACTOR = 0.015;
const DEADZONE = 8;

function scrollLoop() {
    if (!isScrolling || !scrollTarget) return;
    scrollTarget.scrollLeft += velocityX;
    scrollTarget.scrollTop += velocityY;
    animationFrameId = requestAnimationFrame(scrollLoop);
}

// --- Event handlers ---

function onMouseDown(e: MouseEvent) {
    if (e.button !== 1) return;

    e.preventDefault();
    e.stopPropagation();

    if (isScrolling) {
        // Second middle click: stop scrolling.
        // Swallow the paired mouseup for this click too.
        ignoreNextMiddleUp = true;
        stopScrolling();
        return;
    }

    // First middle click: start scrolling.
    // The paired mouseup is just the button release — ignore it.
    ignoreNextMiddleUp = true;

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

function onMouseUp(e: MouseEvent) {
    if (e.button === 1) {
        e.preventDefault();
        e.stopPropagation();

        if (ignoreNextMiddleUp) {
            // Release from the click that toggled state — consume and ignore.
            ignoreNextMiddleUp = false;
            return;
        }

        // A distinct middle release while scrolling = stop.
        if (isScrolling) stopScrolling();
        return;
    }

    // Any other button click while scrolling also stops.
    if (isScrolling) stopScrolling();
}

function onMouseMove(e: MouseEvent) {
    if (!isScrolling) return;

    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    velocityX = Math.abs(dx) > DEADZONE ? dx * SPEED_FACTOR : 0;
    velocityY = Math.abs(dy) > DEADZONE ? dy * SPEED_FACTOR : 0;
}

function onKeyDown(e: KeyboardEvent) {
    if (isScrolling && e.key === "Escape") stopScrolling();
}

function onWheel(e: WheelEvent) {
    if (isScrolling) stopScrolling();
}

function onAuxClick(e: MouseEvent) {
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
        document.addEventListener("mousedown", onMouseDown, { capture: true });
        document.addEventListener("mouseup",   onMouseUp,   { capture: true });
        document.addEventListener("mousemove", onMouseMove, { capture: true });
        document.addEventListener("auxclick",  onAuxClick,  { capture: true });
        document.addEventListener("keydown",   onKeyDown,   { capture: true });
        document.addEventListener("wheel",     onWheel,     { capture: true, passive: true });
    },

    stop() {
        stopScrolling();
        ignoreNextMiddleUp = false;
        document.removeEventListener("mousedown", onMouseDown, { capture: true });
        document.removeEventListener("mouseup",   onMouseUp,   { capture: true });
        document.removeEventListener("mousemove", onMouseMove, { capture: true });
        document.removeEventListener("auxclick",  onAuxClick,  { capture: true });
        document.removeEventListener("keydown",   onKeyDown,   { capture: true });
        document.removeEventListener("wheel",     onWheel,     { capture: true });
    },
});
