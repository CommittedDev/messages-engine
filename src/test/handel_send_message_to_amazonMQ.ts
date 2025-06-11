const amqp = require("amqplib");
const fs = require("fs");
import * as AWS from "aws-sdk";

// Configure AWS SDK
AWS.config.update({
  region: "il-central-1", // The region where your broker is located
});

// Define variables
const RABBITMQ_URL =
  process.env.RABBITMQ_URL ||
  "amqps://admin:asdfgh123456@localhost:5671?verify=verify_none"; // RabbitMQ URL
const QUEUE_NAME = "MyQueue1"; // RabbitMQ queue name
const EC2_INSTANCE_ID = process.env.EC2_INSTANCE_ID || "i-0e752dc58892b6474"; // Replace with your EC2 instance ID

async function sendMessageToQueueFromFile(filePath: string) {
  try {
    // Read the JSON file
    const fileContent = fs.readFileSync(filePath, "utf8");
    const messages = JSON.parse(fileContent); // Parse the JSON content

    // Connect to RabbitMQ
    var opts = {
      rejectUnauthorized: false,
    };
    const connection = await amqp.connect(RABBITMQ_URL, opts);
    console.log("Connected to RabbitMQ");

    // Create a channel
    const channel = await connection.createChannel();

    // Ensure the queue exists
    await channel.assertQueue(QUEUE_NAME, { durable: true });

    // Send each message once
    for (const message of messages) {
      channel.sendToQueue(QUEUE_NAME, Buffer.from(JSON.stringify(message)), {
        persistent: true,
      });
      console.log(`Message sent to queue: ${QUEUE_NAME}`, message);
    }

    // Close the connection
    await channel.close();
    await connection.close();
    console.log("All messages sent successfully.");
  } catch (error) {
    console.error("Error sending messages to queue:", error);
  }
}

// Example usage
(async () => {
  const filePath = "./LotMessages.json"; // Path to the JSON file
  await sendMessageToQueueFromFile(filePath);
})();
