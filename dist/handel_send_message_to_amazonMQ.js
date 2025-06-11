"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
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
const amqp = __importStar(require("amqplib"));
const AWS = __importStar(require("aws-sdk"));
const fs = __importStar(require("fs"));
// Configure AWS SDK
AWS.config.update({
    region: "il-central-1", // The region where your broker is located
});
// Define variables
const RABBITMQ_URL = process.env.RABBITMQ_URL ||
    "amqps://admin:asdfgh123456@localhost:5671?verify=verify_none"; // RabbitMQ URL
const QUEUE_NAME = "MyQueue1"; // RabbitMQ queue name
const EC2_INSTANCE_ID = process.env.EC2_INSTANCE_ID || "i-0e752dc58892b6474"; // Replace with your EC2 instance ID
function sendMessageToQueueFromFile(filePath) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // Read the JSON file
            const fileContent = fs.readFileSync(filePath, "utf8");
            const messages = JSON.parse(fileContent); // Parse the JSON content
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
            // Send each message from the JSON file to the queue
            messages.forEach((message) => {
                channel.sendToQueue(QUEUE_NAME, Buffer.from(JSON.stringify(message)), {
                    persistent: true, // Ensure the message is saved to disk
                });
                console.log(`Message sent to queue: ${QUEUE_NAME}`, message);
            });
            // Close the connection
            yield channel.close();
            yield connection.close();
        }
        catch (error) {
            console.error("Error sending messages to queue:", error);
        }
    });
}
// Example usage
(() => __awaiter(void 0, void 0, void 0, function* () {
    const filePath = "message.json"; // Path to the JSON file
    yield sendMessageToQueueFromFile(filePath);
}))();
