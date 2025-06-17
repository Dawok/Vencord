import definePlugin from "@utils/types";
import { Devs } from "@utils/constants";
import { findByPropsLazy } from "@webpack";
import { settings } from "@api";

const MessageActions = findByPropsLazy("sendMessage");

const [useSettings, Settings] = settings({
    enabled: true
});

function convertToMonospace(text: string): string {
    return text.split("").map(c => {
        if (c >= "a" && c <= "z") return String.fromCodePoint(c.charCodeAt(0) - 97 + 0x1D68A);
        if (c >= "A" && c <= "Z") return String.fromCodePoint(c.charCodeAt(0) - 65 + 0x1D670);
        if (c >= "0" && c <= "9") return String.fromCodePoint(c.charCodeAt(0) - 48 + 0x1D7F6);
        return c;
    }).join("");
}

export default definePlugin({
    name: "MonospaceTyper",
    description: "Converts all your messages into Unicode monospace characters.",
    authors: [Devs.Dawok],
    settings: Settings,

    start() {
        const opts = useSettings();
        const originalSendMessage = MessageActions.sendMessage;

        MessageActions.sendMessage = (channelId: string, message: any, ...args: any[]) => {
            if (opts.enabled && typeof message.content === "string") {
                message.content = convertToMonospace(message.content);
            }
            return originalSendMessage(channelId, message, ...args);
        };
    },

    stop() {
        // Reset sendMessage when the plugin stops
        if (MessageActions.sendMessage !== MessageActions.originalSendMessage) {
            MessageActions.sendMessage = MessageActions.originalSendMessage;
        }
    }
});
