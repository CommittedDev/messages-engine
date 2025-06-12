import express from "express";
import cron from "node-cron";

import { cognitoProvider } from "./cognito_providers";
import { configurationProvider } from "./configuration_provider";
import { dynamoDbProvider } from "./dynamodb-provider/dynamodb_provider";
import { GET_APP_RELEVANT_ENV } from "./env_and_consts";
import { logger } from "./logger";
import { runConsumerWithRetries } from "./main";
import { mailProvider } from "./mail_provider";
import { alertsProvider } from "./alerts_provider";
const { version } = require("../package.json");

const app = express();
const port = 8008;

app.get("/", (req, res) => {
  res.send(`Messages-engine version ${version} is running`);
});
app.get("/health", (req, res) => {
  res.send(`Server is healthy - version ${version}`);
});
// Set up a cron job to run daily at 9:00 AM
cron.schedule("0 9 * * *", () => {
  logger.info("⏰ Running daily email job at 9:00 AM");
  alertsProvider.sendAlertSummary();
});
const start = async () => {
  logger.info("Initializing Messages-engine start, version: " + version);

  if (
    process.env.USE_LOCAL_FILE_ENV != "true" &&
    !process.env.AWS_SECRET_NAME
  ) {
    throw new Error("Initializing Failed - AWS_SECRET_NAME is not defined");
  }

  /**
   * Initialize the configuration provider
   */
  await configurationProvider.initialize(
    process.env.USE_LOCAL_FILE_ENV
      ? { fromAwsSecretsManager: false }
      : {
          fromAwsSecretsManager: true,
          awsSecretName: process.env.AWS_SECRET_NAME, //  'population-registry/dev/config/pia',
        }
  );

  const {
    FOREIGNS_TABLE_NAME,
    USERS_TABLE_NAME,
    PREFETCH_MESSAGES_COUNT,
    COGNITO_ROLE_ARN,
    AWS_COGNITO_USER_POOL_ID,
    SIGN_UP_ATTEMPTS_TABLE_NAME,
    DISABLE_PASSPORT_VALIDATION,
    VERIFIED_SES_EMAIL_ADDRESS,
    TIME_BETWEEN_POLLS,
    APP_STATE_TABLE_NAME,
    BUCKET_NAME,
    QUEUE_NAME,
  } = GET_APP_RELEVANT_ENV();

  /**
   * Initialize the cognito provider
   */
  await cognitoProvider.init({
    withCredentials: true,
    roleArn: COGNITO_ROLE_ARN,
    userPoolId: AWS_COGNITO_USER_POOL_ID,
  });

  await dynamoDbProvider.initialize();
  console.log("Service is running");

  app.listen(port, () => {
    logger.info(
      `Express app listening on port ${port} - just to keep the process running and response to health checks`
    );
  });

  // await handleProcessProvider.onServerStart();

  console.log("Service is running - Start pulling");

  await runConsumerWithRetries();
};

start();
