import fs from "fs";
import path from "path";

export async function saveFailedMessage(
  messageContent: string,
  errorMessage: string
): Promise<void> {
  const filePath = path.join(__dirname, "../failed_messages.json");
  let failedMessages = [];

  if (fs.existsSync(filePath)) {
    const fileContent = fs.readFileSync(filePath, "utf-8");
    failedMessages = JSON.parse(fileContent);
  }

  failedMessages.push({
    message: messageContent,
    error: errorMessage,
    timestamp: new Date().toISOString(),
  });

  fs.writeFileSync(filePath, JSON.stringify(failedMessages, null, 2), "utf-8");
}

export async function saveNewMessage(messageContent: string): Promise<void> {
  const filePath = path.join(__dirname, "../new_messages.json");
  let newMessages = [];

  if (fs.existsSync(filePath)) {
    const fileContent = fs.readFileSync(filePath, "utf-8");
    newMessages = JSON.parse(fileContent);
  }

  newMessages.push({
    message: messageContent,
    timestamp: new Date().toISOString(),
  });

  fs.writeFileSync(filePath, JSON.stringify(newMessages, null, 2), "utf-8");
}
