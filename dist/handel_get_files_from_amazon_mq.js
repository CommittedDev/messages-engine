"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const { execSync } = require("child_process");
const amqp = require("amqplib");
const AWS = require("aws-sdk");
const fs = require("fs");
const notificationHandler_1 = require("./usersNotification/notificationHandler");
// Configure AWS SDK
AWS.config.update({
    region: "il-central-1", // The region where your broker is located
});
// Define variables
const RABBITMQ_URL = process.env.RABBITMQ_URL ||
    "amqps://admin:asdfgh123456@localhost:5671?verify=verify_none"; // RabbitMQ URL
const QUEUE_NAME = "MyQueue1"; // RabbitMQ queue name
const EC2_INSTANCE_ID = process.env.EC2_INSTANCE_ID || "i-0e752dc58892b6474"; // Replace with your EC2 instance ID
function consumeAndProcessMessages() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // Connect to RabbitMQ
            var opts = {
                rejectUnauthorized: false,
            };
            const connection = yield amqp.connect(RABBITMQ_URL, opts);
            console.log("Connected to RabbitMQ");
            // Create a channel
            const channel = yield connection.createChannel();
            // Ensure the queue exists
            yield channel.assertQueue(QUEUE_NAME, { durable: true });
            console.log(`Waiting for messages in queue: ${QUEUE_NAME}`);
            // Listen for messages in the queue
            channel.consume(QUEUE_NAME, (message) => __awaiter(this, void 0, void 0, function* () {
                if (message) {
                    try {
                        // Decode the message
                        const messageContent = message.content.toString();
                        console.log(`Received message: ${messageContent}`);
                        yield (0, notificationHandler_1.handleUsersNotification)(messageContent);
                        // Parse the message as JSON
                        const parsedMessage = JSON.parse(messageContent);
                        // Save the message to a JSON file
                        fs.appendFileSync("messages.json", JSON.stringify(parsedMessage, null, 2) + ",\n");
                        console.log("Message saved to messages.json");
                        // Acknowledge the message
                        channel.ack(message);
                    }
                    catch (error) {
                        console.error("Error processing message:", error);
                        // Do not acknowledge the message to keep it in the queue
                    }
                }
            }), { noAck: false } // Requires manual acknowledgment (ack)
            );
        }
        catch (error) {
            console.error("Error consuming messages:", error);
        }
    });
}
// Run the functions
(() => __awaiter(void 0, void 0, void 0, function* () {
    yield consumeAndProcessMessages(); // Connect to RabbitMQ
}))();
