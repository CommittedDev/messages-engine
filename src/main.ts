import { connectToRabbitMQ, setupChannel } from "./rabbitmq/rabbitmq";
import { processMessage } from "./rabbitmq/message_processor";
import { initializeProviders } from "./rabbitmq/initial_provider";
import { logger } from "./logger";
import { configurationProvider } from "./configuration_provider";
import { alertsProvider } from "./alerts_provider";
const MAX_RETRIES = 3;
const MAX_MESSAGES = 100;
const DEV_MAX_MESSAGES = 6;
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
        await alertsProvider.sendAlertError(error as string); // שליחת מייל במקרה של נפילה סופית

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

  let processedMessages = 0;
  logger.info(`Waiting for messages in queue: ${QUEUE_NAME}`);
  channel.prefetch(MAX_MESSAGES); // Set prefetch count to limit the number of unacknowledged messages

  channel.consume(
    QUEUE_NAME,
    async (message) => {
      processedMessages++;
      if (!message) {
        console.log("No message received, exiting consumer.");
        //check when to send this email

        return;
      }
      if (DEV_MODE == "true") {
        if (processedMessages >= 10) {
          logger.info(
            "Maximum number of messages processed. Stopping consumer."
          );
          return;
        }
      }
      (async () => {
        const startTime = Date.now();

        await processMessage(channel, message);
        const duration = Date.now() - startTime;
        logger.info(`Message processed in ${duration}ms by PID ${process.pid}`);
      })();
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
