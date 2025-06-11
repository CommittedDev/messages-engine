import {
  getFormattedDateAndTimeOfToday,
  safeParseString,
} from "../../dist/utils";
import { CognitoProvider } from "../cognito_providers";
import { configurationProvider } from "../configuration_provider";
import { DynamoDbProvider } from "../dynamodb-provider/dynamodb_provider";
import { GET_APP_RELEVANT_ENV } from "../env_and_consts";
import { processDeleteForeignUsers } from "./deleteForeignUsers";
import { processUpdateForeignUsers } from "./upsertForeignUsers";
import path from "path";
import { IObject } from "../types";
import { AppStateStatus } from "../../types";
require("@dotenvx/dotenvx").config({
  path: path.join(__dirname, "../.env"),
});
export async function handleUsersNotification(
  notification: any,
  dynamoDbProvider: DynamoDbProvider,
  cognitoProvider: CognitoProvider
): Promise<boolean | string | undefined> {
  try {
    const parseNot = safeParseString(notification);
    if (!parseNot) {
      console.error("Invalid notification format:", notification);
      return false;
    }
    //move parse notfi to new function - try and catch
    const parsedNotification: IObject = JSON.parse(notification);
    const { msg_type, msg_data, msg_date } = parsedNotification;
    const foreignKey = `${
      msg_data[0].General_details?.nationalityCode
    }_${msg_data[0].General_details?.passport_num.toLowerCase()}`;

    const appStateKey = `notification_${getFormattedDateAndTimeOfToday()}_${foreignKey}`;
    const updateCounter = msg_data.length;
    /// Check if the notification is relevant
    const response = await processNotification(
      dynamoDbProvider,
      cognitoProvider,
      msg_type,
      msg_data,
      msg_date,
      appStateKey,
      updateCounter
    );
    return response;
  } catch (error: any) {
    console.error("Error handling user notification:", error.message);
    return false;
  }
}

async function processNotification(
  dynamodbProvider: DynamoDbProvider,
  cognitoProvider: CognitoProvider,
  msg_type: string,
  msg_data: any[],
  msg_date: string,
  appStateKey: string,
  updateCounter: number
): Promise<boolean | string | undefined> {
  const foreignKey = `${
    msg_data[0].General_details?.nationalityCode
  }_${msg_data[0].General_details?.passport_num.toLowerCase()}`;
  try {
    /// if it upsert check if the data is valid
    if (msg_type == "UPSERT") {
      // Removed at Miriam's request
      // const isValid = await checkValidData(
      //   dynamodbProvider,
      //   msg_date,
      //   msg_data,
      //   msg_type
      // );
      // if (!isValid) {
      //   console.log("Message is not valid. Skipping...", foreignKey);
      //   return false;
      // }

      /// Process the upsert foreign users
      const response = await processUpdateForeignUsers(
        msg_data,
        msg_date,
        dynamodbProvider
      );
      return response;
    }

    // Process the delete foreign users
    //add logs
    if (msg_type === "DELETE") {
      const response = await processDeleteForeignUsers(
        msg_data,
        cognitoProvider,
        dynamodbProvider,
        msg_date
      );
      return response;
    }

    return true;
  } catch (error: any) {
    console.error("Error processing notification:", error.message);
    return false;
  }
}

// Check if the date of last update or delete is valid
export async function checkValidData(
  dynamodbProvider: DynamoDbProvider,
  msg_date: string,
  msg_data: any[],
  msg_type: string
): Promise<boolean> {
  const validData = dynamodbProvider.isMsgDataValid(msg_data);
  return validData;
}
