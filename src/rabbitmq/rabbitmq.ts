import amqp, { ConsumeMessage, Channel, Connection } from "amqplib";

const RABBITMQ_URL =
  process.env.RABBITMQ_URL ||
  "amqps://admin:asdfgh123456@localhost:5671?verify=verify_none";
const QUEUE_NAME = "MyQueue1";

export async function connectToRabbitMQ(): Promise<amqp.ChannelModel> {
  //להוריד
  const opts = { rejectUnauthorized: false };
  const connection: amqp.ChannelModel = await amqp.connect(RABBITMQ_URL, opts);
  console.log("Connected to RabbitMQ");
  return connection;
}

export async function setupChannel(
  connection: amqp.ChannelModel
): Promise<amqp.Channel> {
  const channel: amqp.Channel = await connection.createChannel();
  await channel.assertQueue(QUEUE_NAME, { durable: true });
  //add env prefetch
  channel.prefetch(1000);
  return channel;
}
