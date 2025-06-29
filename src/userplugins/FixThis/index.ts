import { Devs } from "@utils/constants";
import definePlugin from "@utils/types";
import { findByPropsLazy } from "@webpack";
import { MessageObject } from "@webpack/common";

const MessageActions = findByPropsLazy("sendMessage");

const modifyUrls = (content: string): string => {
    if (typeof content !== "string") return content;

    const urlMap: { [key: string]: string } = {
        "tiktok.com": "tnktok.com",
        "instagram.com": "ddinstagram.com",
        "twitter.com": "fxtwitter.com",
        "x.com": "fxtwitter.com",
        "pixiv.net": "phixiv.net",
        "reddit.com": "rxddit.com"
    };

    const processUrl = (url: string): string => {
        const lowerUrl = url.toLowerCase();
        
        // Don't modify Twitter/X Spaces URLs
        if (lowerUrl.includes('twitter.com/i/spaces/') || lowerUrl.includes('x.com/i/spaces/')) {
            return url;
        }

        // Special handling for X.com profile URLs - convert to twitter.com instead of fxtwitter
        const xProfileRegex = /https?:\/\/(www\.)?x\.com\/([a-zA-Z0-9_]+)\/?$/i;
        const xProfileMatch = url.match(xProfileRegex);
        if (xProfileMatch) {
            return `https://twitter.com/${xProfileMatch[2]}`;
        }

        // Special handling for Reddit subdomains
        const redditRegex = /https?:\/\/(old\.|new\.)?reddit\.com(.*)/i;
        const redditMatch = url.match(redditRegex);
        if (redditMatch) {
            return `https://rxddit.com${redditMatch[2]}`;
        }

        // Process other domains (including tweet URLs)
        for (const [oldDomain, newDomain] of Object.entries(urlMap)) {
            const regex = new RegExp(`https?://([a-zA-Z0-9-]+\\.)?${oldDomain.replace('.', '\\.')}`, 'i');
            if (regex.test(lowerUrl)) {
                return url.replace(regex, (match, p1) => `https://${p1 || ''}${newDomain}`);
            }
        }

        return url;
    };

    const urlRegex = /https?:\/\/[^\s]+/gi;
    return content.replace(urlRegex, processUrl);
};

export default definePlugin({
    name: "FixThis",
    description: "Fixes the url for embed in discord for several sites",
    authors: [Devs.Dawok],
    
    patches: [
        {
            find: "sendMessage",
            replacement: {
                match: /function (\w+)\((\w+)\)\{/,
                replace: "function $1($2){if($2.content && typeof $2.content === 'string'){$2.content=$self.modifyUrls($2.content);}"
            }
        }
    ],

    modifyUrls,

    start() {
        // Store original function reference
        if (!MessageActions.originalSendMessage) {
            MessageActions.originalSendMessage = MessageActions.sendMessage;
        }
        
        // Override with our modified version
        MessageActions.sendMessage = (channelId: string, message: MessageObject, ...args: any[]) => {
            if (message.content && typeof message.content === "string") {
                message.content = modifyUrls(message.content);
            }
            return MessageActions.originalSendMessage(channelId, message, ...args);
        };
    },

    stop() {
        // Restore original function
        if (MessageActions.originalSendMessage) {
            MessageActions.sendMessage = MessageActions.originalSendMessage;
            delete MessageActions.originalSendMessage;
        }
    }
});
