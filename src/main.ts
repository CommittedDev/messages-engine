import { connectToRabbitMQ, setupChannel } from "./rabbitmq/rabbitmq";
import { processMessage } from "./rabbitmq/message_processor";
import { initializeProviders } from "./rabbitmq/initial_provider";
import path from "path";

require("@dotenvx/dotenvx").config({ path: path.join(__dirname, "../.env") });
require("dotenv").config();
const QUEUE_NAME = "MyQueue1";

//Connect to RabbitMQ and set up the channel
async function consumeAndProcessMessages(): Promise<void> {
  try {
    console.log("Starting message consumer...");
    // Initialize RabbitMQ connection and channel
    const connection = await connectToRabbitMQ();
    const channel = await setupChannel(connection);
    const { dynamodbProvider, cognitoProvider } = await initializeProviders();

    console.log(`Waiting for messages in queue: ${QUEUE_NAME}`);
    channel.consume(
      QUEUE_NAME,
      (message) =>
        processMessage(channel, message, dynamodbProvider, cognitoProvider),
      { noAck: false }
    );
  } catch (error) {
    console.error("Error consuming messages:", error);
    //delay before retrying
  }
}

// Run the function
(async () => {
  await consumeAndProcessMessages();
})();
