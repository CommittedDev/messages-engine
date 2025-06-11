import { configurationProvider } from "./configuration_provider";

export const GET_APP_RELEVANT_ENV = () => {
  const APP_STATE_TABLE_NAME = configurationProvider.getRequiredValue(
    "APP_STATE_TABLE_NAME"
  );
  // const SQS_QUEUE_URL = configurationProvider.getRequiredValue("SQS_QUEUE_URL");
  const FOREIGNS_TABLE_NAME = configurationProvider.getRequiredValue(
    "FOREIGNS_TABLE_NAME"
  );
  const USERS_TABLE_NAME =
    configurationProvider.getRequiredValue("USERS_TABLE_NAME");

  const GMAIL_SENDER_EMAIL_USER = configurationProvider.getRequiredValue(
    "GMAIL_SENDER_EMAIL_USER"
  );
  const GMAIL_SENDER_EMAIL_PASSWORD = configurationProvider.getRequiredValue(
    "GMAIL_SENDER_EMAIL_PASSWORD"
  );

  const ADMIN_EMAILS = configurationProvider
    .getRequiredValue("ADMIN_EMAILS")
    .split(",");
  const S3_ROLE_ARN = configurationProvider.getRequiredValue("S3_ARN");
  const COGNITO_ROLE_ARN =
    configurationProvider.getRequiredValue("COGNITO_ROLE_ARN");
  const AWS_COGNITO_USER_POOL_ID = configurationProvider.getRequiredValue(
    "AWS_COGNITO_USER_POOL_ID"
  );
  const SIGN_UP_ATTEMPTS_TABLE_NAME = configurationProvider.getRequiredValue(
    "SIGN_UP_ATTEMPTS_TABLE_NAME"
  );
  const DISABLE_PASSPORT_VALIDATION =
    configurationProvider.getValue("DISABLE_PASSPORT_VALIDATION") == "true";

  const TIME_BETWEEN_POLLS = parseInt(
    configurationProvider.getRequiredValue("TIME_BETWEEN_POLLS") || "30000"
  );

  const BUCKET_NAME = configurationProvider.getRequiredValue("S3_BUCKET_NAME");
  const VERIFIED_SES_EMAIL_ADDRESS = configurationProvider.getRequiredValue(
    "VERIFIED_SES_EMAIL_ADDRESS"
  );

  const PREFETCH_MESSAGES_COUNT = configurationProvider.getRequiredValue(
    "PREFETCH_MESSAGES_COUNT"
  );

  const RABBITMQ_URL = configurationProvider.getRequiredValue("RABBITMQ_URL");
  const QUEUE_NAME = configurationProvider.getRequiredValue("QUEUE_NAME");
  const USE_LOCAL_FILE_ENV =
    configurationProvider.getValue("USE_LOCAL_FILE_ENV") == "true";
  return {
    // SQS_QUEUE_URL,
    FOREIGNS_TABLE_NAME,
    USERS_TABLE_NAME,
    GMAIL_SENDER_EMAIL_USER,
    GMAIL_SENDER_EMAIL_PASSWORD,
    ADMIN_EMAILS,
    S3_ROLE_ARN,
    COGNITO_ROLE_ARN,
    AWS_COGNITO_USER_POOL_ID,
    SIGN_UP_ATTEMPTS_TABLE_NAME,
    DISABLE_PASSPORT_VALIDATION,
    TIME_BETWEEN_POLLS,
    BUCKET_NAME,
    APP_STATE_TABLE_NAME,
    VERIFIED_SES_EMAIL_ADDRESS,
    USE_LOCAL_FILE_ENV,
    PREFETCH_MESSAGES_COUNT,
    QUEUE_NAME,
    RABBITMQ_URL,
  };
};
