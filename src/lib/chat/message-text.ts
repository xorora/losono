import type { UIMessage } from "ai";

export function getMessageText(message: UIMessage | undefined): string {
  if (!message) {
    return "";
  }

  return message.parts
    .flatMap((part) => (part.type === "text" ? [part.text] : []))
    .join("");
}
