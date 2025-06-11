import { Channel, ConsumeMessage } from "amqplib";
import { handleUsersNotification } from "../usersNotification/notificationHandler";
import { DynamoDbProvider } from "../dynamodb-provider/dynamodb_provider";
import { CognitoProvider } from "../cognito_providers";
import { saveFailedMessage, saveNewMessage } from "./message_storage";
import { logger } from "../logger";
import { MessageStatus } from "../../types";

export async function processMessage(
  channel: Channel,
  message: ConsumeMessage | null,
  dynamodbProvider: DynamoDbProvider,
  cognitoProvider: CognitoProvider
): Promise<void> {
  if (!message) return;
  const devMode = process.env.DEV_MODE === "true";
  try {
    logger.info("Start processing message...");
    const messageContent = message.content.toString();
    //Handle the message content
    const response = await handleUsersNotification(
      messageContent,
      dynamodbProvider,
      cognitoProvider
    );
    //save message on file - for testing purposes
    //add env on local
    if (devMode) await saveNewMessage(messageContent);
    logger.info(
      `processMessage handleUsersNotification - Message processed: ${response}`
    );
    // Check the response and update DynamoDB counters accordingly
    // If response is true, it means the message was processed successfully
    // If response is false, it means the message processing failed

    if (response === MessageStatus.SUCCESS) {
      await dynamodbProvider.updateMessageCounters({
        done: 1,
        error: 0,
        skipped: 0,
      });
      channel.ack(message);
    } else if (response === MessageStatus.FAILED) {
      await dynamodbProvider.updateMessageCounters({
        done: 0,
        error: 1,
        skipped: 0,
      });
      await saveFailedMessage(
        messageContent,
        "Message processing not completed successfully"
      );
      logger.info("Message processing failed, saving to failed messages");
      channel.ack(message);
    } else {
      //if response is skipped
      await dynamodbProvider.updateMessageCounters({
        done: 0,
        error: 0,
        skipped: 1,
      });
      channel.ack(message);
    }
  } catch (error: any) {
    await dynamodbProvider.updateMessageCounters({
      done: 0,
      error: 1,
      skipped: 0,
    });
    if (devMode)
      await saveFailedMessage(message?.content.toString() || "", error.message);
    logger.error("Error processing message:" + error);
    channel.ack(message);
  }
}
