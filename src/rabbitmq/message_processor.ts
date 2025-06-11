import { Channel, ConsumeMessage } from "amqplib";
import { handleUsersNotification } from "../usersNotification/notificationHandler";
import { DynamoDbProvider } from "../dynamodb-provider/dynamodb_provider";
import { CognitoProvider } from "../cognito_providers";
import { saveFailedMessage, saveNewMessage } from "./message_storage";

export async function processMessage(
  channel: Channel,
  message: ConsumeMessage | null,
  dynamodbProvider: DynamoDbProvider,
  cognitoProvider: CognitoProvider
): Promise<void> {
  if (!message) return;

  try {
    const messageContent = message.content.toString();
    //Handle the message content
    const response = await handleUsersNotification(
      messageContent,
      dynamodbProvider,
      cognitoProvider
    );
    //save message on file - for testing purposes
    //add env on local
    await saveNewMessage(messageContent);
    console.log(response);
    // Check the response and update DynamoDB counters accordingly
    // If response is true, it means the message was processed successfully
    // If response is false, it means the message processing failed

    if (response === true) {
      await dynamodbProvider.updateMessageCounters(1, 0, 0);
      channel.ack(message);
    } else if (response === false) {
      await dynamodbProvider.updateMessageCounters(0, 1);
      await saveFailedMessage(
        messageContent,
        "Message processing not completed successfully"
      );
      channel.ack(message);
    } else {
      //if response is skipped
      await dynamodbProvider.updateMessageCounters(0, 0, 1);
      channel.ack(message);
    }
  } catch (error: any) {
    await dynamodbProvider.updateMessageCounters(0, 1);
    await saveFailedMessage(message?.content.toString() || "", error.message);
    console.error("Error processing message:", error);
    channel.ack(message);
  }
}
