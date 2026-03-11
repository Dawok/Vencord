/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import definePlugin from "@utils/types";

function onMouseDown(e: MouseEvent) {
    if (e.button === 1) {
        e.preventDefault();
        e.stopPropagation();
    }
}

function onAuxClick(e: MouseEvent) {
    if (e.button === 1) {
        e.preventDefault();
        e.stopPropagation();
    }
}

export default definePlugin({
    name: "NoMiddleClickPaste",
    description: "Blocks middle-click paste on Linux (X11 primary selection).",
    authors: [{ name: "you", id: 0n }],

    start() {
        document.addEventListener("mousedown", onMouseDown, { capture: true });
        document.addEventListener("auxclick",  onAuxClick,  { capture: true });
    },

    stop() {
        document.removeEventListener("mousedown", onMouseDown, { capture: true });
        document.removeEventListener("auxclick",  onAuxClick,  { capture: true });
    },
});
