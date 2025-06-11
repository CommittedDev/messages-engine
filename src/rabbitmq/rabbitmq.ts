import amqp, { ConsumeMessage, Channel, Connection } from "amqplib";
import { logger } from "../logger";
import { configurationProvider } from "../configuration_provider";

export async function connectToRabbitMQ(): Promise<amqp.ChannelModel> {
  const RABBITMQ_URL = configurationProvider.getRequiredValue("RABBITMQ_URL");

  try {
    logger.info("Start to connecting to RabbitMQ...");

    const opts = { rejectUnauthorized: false };

    const connection: amqp.ChannelModel = await amqp.connect(
      RABBITMQ_URL,
      opts
    );
    logger.info("Connected to RabbitMQ successfully");
    return connection;
  } catch (error: any) {
    logger.error("Failed to connect to RabbitMQ" + error);
    throw error;
  }
}

export async function setupChannel(
  connection: amqp.ChannelModel
): Promise<amqp.Channel> {
  const QUEUE_NAME = configurationProvider.getRequiredValue("QUEUE_NAME");
  const PREFETCH_MESSAGES_COUNT = configurationProvider.getRequiredValue(
    "PREFETCH_MESSAGES_COUNT"
  );
  try {
    logger.info("starting Setting up RabbitMQ channel...");
    const channel: amqp.Channel = await connection.createChannel();
    await channel.assertQueue(QUEUE_NAME, { durable: true });

    channel.prefetch(parseInt(PREFETCH_MESSAGES_COUNT, 10));
    logger.info("RabbitMQ channel setup successfully");
    return channel;
  } catch (error: any) {
    logger.error("Failed to set up RabbitMQ channel: " + error);
    throw error;
  }
}
