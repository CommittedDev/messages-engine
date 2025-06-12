import { safeParseString } from "../../dist/utils";
import { CognitoProvider } from "../cognito_providers";
import { dynamoDbProvider } from "../dynamodb-provider/dynamodb_provider";
import { processDeleteForeignUsers } from "./deleteForeignUsers";
import { processUpdateForeignUsers } from "./upsertForeignUsers";
import path from "path";
import { Message, MessageStatus } from "../../types";
import { logger } from "../logger";
require("@dotenvx/dotenvx").config({
  path: path.join(__dirname, "../.env"),
});
export async function handleUsersNotification(
  notification: any
): Promise<MessageStatus | undefined> {
  try {
    const parsedNotification = safeParseString(notification) as Message;
    if (!parsedNotification) {
      logger.error("Invalid notification format:" + notification);
      return MessageStatus.FAILED;
    }
    //move parse notfi to new function - try and catch
    // const parsedNotification: Message = JSON.parse(notification);
    const { msg_type, msg_data, msg_date } = parsedNotification;

    /// Check if the notification is relevant
    const response = await processNotification(msg_type, msg_data, msg_date);
    return response;
  } catch (error: any) {
    logger.error("Error handling user notification:" + error.message);
    return MessageStatus.FAILED;
  }
}

async function processNotification(
  msg_type: string,
  msg_data: any[],
  msg_date: string
): Promise<MessageStatus | undefined> {
  try {
    /// if it upsert check if the data is valid
    if (msg_type == "UPSERT") {
      /// Process the upsert foreign users
      const response = await processUpdateForeignUsers(msg_data, msg_date);
      return response;
    }

    // Process the delete foreign users
    //add logs
    if (msg_type === "DELETE") {
      const response = await processDeleteForeignUsers(
        msg_data,

        msg_date
      );
      return response;
    }

    return MessageStatus.SUCCESS;
  } catch (error: any) {
    logger.error("Error processing notification:" + error.message);
    return MessageStatus.FAILED;
  }
}
