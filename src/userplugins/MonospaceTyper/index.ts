import definePlugin from "@utils/types";
import { Devs } from "@utils/constants";
import { findByPropsLazy } from "@webpack";

const MessageActions = findByPropsLazy("sendMessage");

function convertToMonospace(text: string): string {
    return text.split("").map(c => {
        if (c >= "a" && c <= "z") return String.fromCodePoint(c.charCodeAt(0) - 97 + 0x1D68A);
        if (c >= "A" && c <= "Z") return String.fromCodePoint(c.charCodeAt(0) - 65 + 0x1D670);
        if (c >= "0" && c <= "9") return String.fromCodePoint(c.charCodeAt(0) - 48 + 0x1D7F6);
        return c;
    }).join("");
}

let originalSendMessage: any;

export default definePlugin({
    name: "MonospaceTyper",
    description: "Converts all your messages into Unicode monospace characters.",
    authors: [Devs.Dawok],
    
    start() {
        originalSendMessage = MessageActions.sendMessage;
        MessageActions.sendMessage = (channelId: string, message: any, ...args: any[]) => {
            if (typeof message.content === "string") {
                message.content = convertToMonospace(message.content);
            }
            return originalSendMessage(channelId, message, ...args);
        };
    },
    
    stop() {
        if (originalSendMessage) {
            MessageActions.sendMessage = originalSendMessage;
        }
    }
});
