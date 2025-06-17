import { definePlugin, settings } from "vencord";
import { MessageEvents } from "vencord/api/MessageEvents";

const [useSettings, Settings] = settings({
  enabled: true,
});

function convertToMonospace(text: string): string {
  return text
    .split("")
    .map((c) => {
      if (c >= "a" && c <= "z") return String.fromCodePoint(c.charCodeAt(0) - 97 + 0x1D68A);
      if (c >= "A" && c <= "Z") return String.fromCodePoint(c.charCodeAt(0) - 65 + 0x1D670);
      if (c >= "0" && c <= "9") return String.fromCodePoint(c.charCodeAt(0) - 48 + 0x1D7F6);
      return c;
    })
    .join("");
}

export default definePlugin({
  name: "MonospaceTyper",
  description: "Automatically convert messages to Unicode monospace when sending.",
  settings: Settings,

  onLoad() {
    MessageEvents.sendMessage.prepend((args) => {
      const opts = useSettings();
      if (!opts.enabled) return args;

      const [channelId, messageObj] = args;
      messageObj.content = convertToMonospace(messageObj.content);
      return [channelId, messageObj];
    });
  },
});
