import { connectToRabbitMQ, setupChannel } from "./rabbitmq/rabbitmq";
import { processMessage } from "./rabbitmq/message_processor";
import { initializeProviders } from "./rabbitmq/initial_provider";
import path from "path";
import { logger } from "./logger";
import { configurationProvider } from "./configuration_provider";

const MAX_RETRIES = 3;

export async function runConsumerWithRetries() {
  let retryCount = 0;
  const DEV_MODE = configurationProvider.getValue("DEV_MODE");

  while (retryCount < MAX_RETRIES) {
    try {
      await consumeAndProcessMessages();
      return;
    } catch (error) {
      retryCount++;
      logger.error(
        `Consumer failed (attempt ${retryCount}/${MAX_RETRIES}):` + error
      );

      if (retryCount >= MAX_RETRIES) {
        logger.error("Maximum retry attempts reached. Exiting process.");
        process.exit(1);
      }

      logger.info("Retrying in 10 seconds...");
      await new Promise((resolve) => setTimeout(resolve, 10000));
    }
  }
}
//Connect to RabbitMQ and set up the channel

export async function consumeAndProcessMessages(): Promise<void> {
  const QUEUE_NAME = configurationProvider.getRequiredValue("QUEUE_NAME");
  const DEV_MODE = configurationProvider.getValue("DEV_MODE");

  logger.info("Starting message consumer...");

  const connection = await connectToRabbitMQ();
  const channel = await setupChannel(connection);
  const { dynamodbProvider, cognitoProvider } = await initializeProviders();
  const MAX_MESSAGES = 6;
  let processedMessages = 0;
  logger.info(`Waiting for messages in queue: ${QUEUE_NAME}`);
  channel.prefetch(MAX_MESSAGES); // הגבלת מספר ההודעות שייכנסו לצרכן

  channel.consume(
    QUEUE_NAME,
    (message) => {
      if (DEV_MODE == "true") {
        if (processedMessages >= MAX_MESSAGES) {
          logger.info(
            "Maximum number of messages processed. Stopping consumer."
          );
          // channel.close(); // סגירת הצרכן לאחר עיבוד 5 הודעות
          // connection.close(); // סגירת החיבור ל-RabbitMQ
          return;
        }
      }
      processMessage(channel, message, dynamodbProvider, cognitoProvider),
        processedMessages++;
    },
    { noAck: false }
  );

  await new Promise<void>((resolve, reject) => {
    connection.on("close", () => {
      logger.warn("RabbitMQ connection closed.");
      reject(new Error("RabbitMQ connection closed."));
    });
    connection.on("error", (err) => {
      logger.error("RabbitMQ connection error" + err);
      reject(err);
    });
  });
}
// // Run the function
// (async () => {
//   await consumeAndProcessMessages();
// })();
