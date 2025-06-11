import amqp, { ConsumeMessage, Connection, Channel } from "amqplib";

import AWS from "aws-sdk";
import fs from "fs";
import path from "path";
import { handleUsersNotification } from "./usersNotification/notificationHandler";
import { DynamoDbProvider } from "../src/dynamodb-provider/dynamodb_provider";
import { CognitoProvider } from "./cognito_providers";
import { GET_APP_RELEVANT_ENV } from "./env_and_consts";
import { configurationProvider } from "./configuration_provider";

// Configure AWS SDK
AWS.config.update({ region: "il-central-1" }); // The region where your broker is located
require("@dotenvx/dotenvx").config({ path: path.join(__dirname, "../.env") });
require("dotenv").config();

// Constants
const RABBITMQ_URL =
  process.env.RABBITMQ_URL ||
  "amqps://admin:asdfgh123456@localhost:5671?verify=verify_none";
const QUEUE_NAME = "MyQueue1";

// Main function to consume and process messages
async function consumeAndProcessMessages(): Promise<void> {
  try {
    const connection = await connectToRabbitMQ();
    const channel = await setupChannel(connection);

    console.log(`Waiting for messages in queue: ${QUEUE_NAME}`);
    channel.consume(QUEUE_NAME, (message) => processMessage(channel, message), {
      noAck: false,
    });
  } catch (error) {
    console.error("Error consuming messages:", error);
  }
}

// Connect to RabbitMQ
async function connectToRabbitMQ(): Promise<amqp.ChannelModel> {
  const opts = { rejectUnauthorized: false };
  const connection: amqp.ChannelModel = await amqp.connect(RABBITMQ_URL, opts);
  console.log("Connected to RabbitMQ");
  return connection;
}

async function setupChannel(
  connection: amqp.ChannelModel
): Promise<amqp.Channel> {
  const channel: amqp.Channel = await connection.createChannel();
  await channel.assertQueue("MyQueue1", { durable: true });
  channel.prefetch(500);
  return channel;
}

// Process a single message
async function processMessage(
  channel: amqp.Channel,
  message: ConsumeMessage | null
): Promise<void> {
  if (!message) return;
  const { dynamodbProvider, cognitoProvider } = await initializeProviders();

  try {
    const messageContent = message.content.toString();
    const isValid = await handleUsersNotification(
      messageContent,
      dynamodbProvider,
      cognitoProvider
    );
    await saveNewMessage(messageContent);
    if (isValid) {
      await dynamodbProvider.updateMessageCounters(1, 0); // עדכון הצלחה

      channel.ack(message);
    } else {
      console.log(
        "Message processing Not completed successfully, requeuing message"
      );
      await dynamodbProvider.updateMessageCounters(1, 0); // עדכון הצלחה
      await saveFailedMessage(
        messageContent,
        "Message processing not completed successfully- not actual date or not valid data "
      );
      //Close the message on queue
      channel.ack(message);
    }
  } catch (error: any) {
    await saveFailedMessage(message?.content.toString() || "", error.message);
    console.error("Error processing message:", error);
    await dynamodbProvider.updateMessageCounters(0, 1); // עדכון כשלון

    //Only for dev if message processing fails
    channel.ack(message);
    // channel.nack(message, false, true); // Requeue the message
  }
}

// Save failed message to a file

async function saveFailedMessage(
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
async function saveNewMessage(messageContent: string): Promise<void> {
  const filePath = path.join(__dirname, "../new_messages.json");
  let newMessages = [];

  if (fs.existsSync(filePath)) {
    const fileContent = fs.readFileSync(filePath, "utf-8");
    newMessages = JSON.parse(fileContent);
  }

  fs.writeFileSync(filePath, JSON.stringify(newMessages, null, 2), "utf-8");
}

async function initializeProviders(): Promise<{
  dynamodbProvider: DynamoDbProvider;
  cognitoProvider: CognitoProvider;
}> {
  const {
    COGNITO_ROLE_ARN,
    AWS_COGNITO_USER_POOL_ID,
    FOREIGNS_TABLE_NAME,
    USERS_TABLE_NAME,
    SIGN_UP_ATTEMPTS_TABLE_NAME,
    DISABLE_PASSPORT_VALIDATION,
    APP_STATE_TABLE_NAME,
    USE_LOCAL_FILE_ENV,
  } = GET_APP_RELEVANT_ENV();

  await configurationProvider.initialize(
    USE_LOCAL_FILE_ENV
      ? { fromAwsSecretsManager: false }
      : {
          fromAwsSecretsManager: true,
          awsSecretName: process.env.AWS_SECRET_NAME,
        }
  );

  const cognitoProvider = new CognitoProvider();
  await cognitoProvider.init({
    withCredentials: true,
    roleArn: COGNITO_ROLE_ARN,
    userPoolId: AWS_COGNITO_USER_POOL_ID,
  });

  const dynamodbProvider = new DynamoDbProvider({
    foreignTableName: FOREIGNS_TABLE_NAME,
    usersTableName: USERS_TABLE_NAME,
    appStateTableName: APP_STATE_TABLE_NAME,
    disablePassportValidation: DISABLE_PASSPORT_VALIDATION,
    signUpsTableName: SIGN_UP_ATTEMPTS_TABLE_NAME,
  });
  await dynamodbProvider.initial();

  return { dynamodbProvider, cognitoProvider };
}

// Run the functions
(async () => {
  await consumeAndProcessMessages(); // Connect to RabbitMQ
})();
