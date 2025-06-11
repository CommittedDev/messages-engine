import { IForeignTableRecord, IObject, IUserRecord } from "../types";
import https from "https";
import {
  BatchGetItemCommand,
  BatchWriteItemCommand,
  CreateTableCommand,
  DeleteItemCommand,
  DynamoDBClient,
  GetItemCommand,
  PutItemCommand,
  ScanCommand,
  ScanCommandInput,
  UpdateItemCommand,
} from "@aws-sdk/client-dynamodb";
import { isForeignersDataArray, parseDate } from "../utils";
import { unmarshall } from "@aws-sdk/util-dynamodb";
import { NodeHttpHandler } from "@smithy/node-http-handler";
import { logger } from "../logger";
import { marshall } from "@aws-sdk/util-dynamodb";
import { MessageStatus } from "../../types";
// const { marshall } = require("@aws-sdk/util-dynamodb");

type AppStateKeys =
  | "lastFileName" // The last foreigners zip that was processed
  | "currentProcessFileName" // The current foreigners zip that is being processed
  | "depositsFiles" // The deposits zip files that were processed
  | "custom"; // Allow to set custom key

const getForeignerKey = (data: IObject): string => {
  // This function should return a unique key for each foreigner
  // The key is nationalityCode_passport_num
  return `${data.General_details.nationalityCode}_${data.General_details.passport_num}`.toLowerCase();
};

let agent = new https.Agent({
  maxSockets: 25, // https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/node-configuring-maxsockets.html
});

export const isErrorOfItemLimitSize = (error: any) =>
  error.name === "ValidationException" &&
  error.message.includes("Item size has exceeded the maximum allowed size");

const getStartOfDayISOString = () => {
  const now = new Date();
  now.setHours(0, 0, 0, 0); // Set hours to 00:00:00.000
  return now.toISOString();
};
const getNowISOString = () => {
  const now = new Date();
  return now.toISOString();
};

export class DynamoDbProvider {
  foreignTableName: string;
  usersTableName: string;
  signUpsTableName: string;
  appStateTableName: string;
  disablePassportValidation: boolean;
  dynamodbClient: DynamoDBClient;

  public newDataCounters: { [key: string]: number } = {
    runs: 0,
    initial: 0,
    duplicate: 0,
    unique: 0,
    notValidStructure: 0,
    notValidArrival: 0,
    notValidInIsrael: 0,
    notValidPassportExpiry: 0,
    notValidLastVisaValidToDate: 0,
    totalNotValid: 0,
    valid: 0,
    deletedFromForeignsTable: 0,
    deletedFromUsersTable: 0,
  };

  static WRITE_CAPACITY_PER_SECONDE = 50;
  static WRITE_BATCH = 25;
  static MAX_CONCURRENT_BATCHES = 5;

  constructor(args: {
    foreignTableName: string;
    usersTableName: string;
    signUpsTableName: string;
    appStateTableName: string;
    disablePassportValidation: boolean;
  }) {
    this.foreignTableName = args.foreignTableName;
    this.usersTableName = args.usersTableName;
    this.signUpsTableName = args.signUpsTableName;
    this.disablePassportValidation = args.disablePassportValidation;
    this.appStateTableName = args.appStateTableName;

    this.dynamodbClient = new DynamoDBClient({
      region: "il-central-1",
      requestHandler: new NodeHttpHandler({
        requestTimeout: 0,
        httpsAgent: agent,
      }),
    });
  }

  initial = async () => {
    logger.info("Initializing DynamoDB");
  };

  getUserByForeignKey = async (
    foreignKey: string
  ): Promise<IUserRecord | null> => {
    try {
      const params = {
        TableName: this.usersTableName,
        Key: {
          foreign_key: { S: foreignKey.toLowerCase() },
        },
        ProjectionExpression: "user_name, foreign_key, cognito_user_name",
      };

      const command = new GetItemCommand(params);
      const response = await this.dynamodbClient.send(command);

      if (response.Item) {
        const user = unmarshall(response.Item) as IUserRecord;

        return unmarshall(response.Item) as IUserRecord;
      } else {
        logger.info(`User with foreign_key ${foreignKey} not found.`);
        return null;
      }
    } catch (error) {
      logger.error(
        `Error fetching user by foreign_key ${foreignKey}: ${JSON.stringify(error)}`
      );
      throw error;
    }
  };
  deleteSignUpAttempts = async (foreignKey: string) => {
    try {
      await this.dynamodbClient!.send(
        new DeleteItemCommand({
          TableName: this.signUpsTableName,
          Key: {
            foreign_key: { S: foreignKey },
          },
        })
      );
      logger.info("SignUpAttempt deleted successfully");
      return true;
    } catch (error) {
      logger.error(
        "Unable to delete FSignUpAttempt item. Error:" + JSON.stringify(error)
      );
      return false;
    }
  };
  ///change to putItem
  deleteForeignContent = async (
    foreignKey: string,
    msg_date: string
  ): Promise<MessageStatus> => {
    try {
      logger.info("starting to clear foreign fields for " + foreignKey);
      const params = {
        TableName: this.foreignTableName,
        Item: marshall({
          foreign_key: foreignKey.toLowerCase(),
          msg_date: msg_date,
        }),
        ConditionExpression:
          "attribute_exists(foreign_key) AND attribute_exists(msg_date) AND #msg_date < :msg_date",
        ExpressionAttributeNames: {
          "#msg_date": "msg_date",
        },
        ExpressionAttributeValues: {
          ":msg_date": { S: msg_date },
        },
      };

      await this.dynamodbClient!.send(new PutItemCommand(params));
      logger.info(
        "Foreign fields cleared successfully, msg_date updated." +
          msg_date +
          " for foreign_key: " +
          foreignKey
      );
      return MessageStatus.SUCCESS; // If the deletion is successful, we return success
    } catch (error: any) {
      if (error.name === "ConditionalCheckFailedException") {
        // If the condition is not met, we skip the deletion
        logger.warn(
          `Deletion skipped for ${foreignKey}: either foreign_key or msg_date condition not met.`
        );
        return MessageStatus.SKIPPED; // If the condition is not met, we skip the deletion
      }
      logger.error(
        "Unable to clear Foreign fields. Error:" + JSON.stringify(error)
      );
      return MessageStatus.FAILED; // If any other error occurs, we return failed
    }
  };

  deleteUser = async (foreignKey: string): Promise<boolean> => {
    try {
      logger.info("Starting to delete user with foreign_key: " + foreignKey);
      await this.dynamodbClient!.send(
        new DeleteItemCommand({
          TableName: this.usersTableName,
          Key: {
            foreign_key: { S: foreignKey },
          },
        })
      );
      logger.info(
        "User deleted successfully" + " with foreign_key: " + foreignKey
      );
      return true;
    } catch (error) {
      logger.error(
        "Unable to delete user item. Error:" + JSON.stringify(error)
      );
      return false;
    }
  };

  getAppStateValueByKey = async (
    key: AppStateKeys,
    customKey?: string
  ): Promise<string | undefined> => {
    if (key == "custom" && !customKey) {
      throw new Error("customKey is required for custom");
    }
    const params = {
      TableName: this.appStateTableName,
      Key: {
        id: { S: customKey || key },
      },
    };
    try {
      const data = await this.dynamodbClient.send(
        new BatchGetItemCommand({
          RequestItems: {
            [this.appStateTableName]: {
              Keys: [params.Key],
            },
          },
        })
      );
      if (data.Responses && data.Responses[this.appStateTableName]) {
        const item = data.Responses[this.appStateTableName][0];
        if (item) {
          return item["value"]["S"];
        }
      }
    } catch (error) {
      logger.error("Error getting last file name: " + JSON.stringify(error));
    }
  };

  setAppStateValuesByKey = async (
    key: AppStateKeys,
    value: string,
    customKey?: string,
    type?: string,
    foreign_key?: string,
    updateCounter?: number,
    currentStatus?: string,
    error?: string
  ) => {
    if (key == "custom" && !customKey) {
      throw new Error("customKey is required for custom");
    }

    const item = {
      id: customKey || key,
      value: value,
      type: type || undefined,
      foreign_key: foreign_key ? foreign_key.toLowerCase() : undefined,
      updateCounter: updateCounter !== undefined ? updateCounter : undefined,
      currentStatus: currentStatus || undefined,
      error: error || undefined,
    };

    // Use marshall to convert the item to DynamoDB format
    const marshalledItem = marshall(item, { removeUndefinedValues: true });

    const params = {
      TableName: this.appStateTableName,
      Item: marshalledItem,
    };

    try {
      await this.dynamodbClient.send(
        new BatchWriteItemCommand({
          RequestItems: {
            [this.appStateTableName]: [
              {
                PutRequest: {
                  Item: marshalledItem,
                },
              },
            ],
          },
        })
      );
    } catch (error) {
      logger.error("Error setting app state value: " + JSON.stringify(error));
    }
  };

  /**
   * Upsert (updates or creates) a foreign record with the given foreignKey.
   *
   * @param foreignKey - The key to check in the foreign table.
   * @param data - The record data to update or insert.
   */
  public upsertForeignRecord = async (
    foreignKey: string,
    data: IObject,
    msg_date: string
  ): Promise<MessageStatus> => {
    try {
      logger.info(
        `Starting upsert for foreign record with key ${foreignKey}  at ${getNowISOString()}`
      );

      const fullRecord = {
        msg_date: msg_date,
        foreign_key: foreignKey.toLowerCase(),
        ...data,
        updatedAt: getStartOfDayISOString(),
        updatedAtFullTime: getNowISOString(),
      };

      logger.info(
        `Upserting foreign record with key ${foreignKey} at ${getNowISOString()}`
      );
      logger.info(
        "Marshalled item:" +
          marshall(fullRecord, { removeUndefinedValues: false })
      );
      // Prepare the parameters for the PutItem command
      const putParams = {
        TableName: this.foreignTableName,
        Item: marshall(fullRecord, { removeUndefinedValues: false }),
        ConditionExpression:
          "attribute_not_exists(#msg_date) OR #msg_date < :msg_date",
        ExpressionAttributeNames: {
          "#msg_date": "msg_date",
        },
        ExpressionAttributeValues: {
          ":msg_date": { S: msg_date },
        },
      };

      await this.dynamodbClient.send(new PutItemCommand(putParams));
      logger.info(
        `Foreign record with key ${foreignKey} upserted successfully.`
      );
      return MessageStatus.SUCCESS; // If the upsert is successful, we return success
    } catch (error: any) {
      if (error.name === "ConditionalCheckFailedException") {
        // If the condition is not met, we skip the upsert
        logger.warn(`Upsert skipped for ${foreignKey}: condition not met.`);
        return MessageStatus.SKIPPED; // If the condition is not met, we skip the upsert
      }
      logger.error("Error upserting foreign record: " + JSON.stringify(error));
      return MessageStatus.FAILED; // If any other error occurs, we return failed
    }
  };

  // checkLastMessageDate = async (
  //   msg_type: string,
  //   msg_data: any[],
  //   lastMessageDate: string
  // ): Promise<boolean> => {
  //   const foreignKey = msg_data[0]?.General_details
  //     ? `${msg_data[0].General_details.nationalityCode}_${msg_data[0].General_details.passport_num.toLowerCase()}`
  //     : "";
  //   const params = {
  //     TableName: this.foreignTableName,
  //     Key: {
  //       foreign_key: { S: foreignKey },
  //     },
  //   };

  //   try {
  //     const data = await this.dynamodbClient.send(
  //       new BatchGetItemCommand({
  //         RequestItems: {
  //           [this.foreignTableName]: {
  //             Keys: [params.Key],
  //             ProjectionExpression: "msg_date",
  //           },
  //         },
  //       })
  //     );

  //     if (data.Responses && data.Responses[this.foreignTableName].length > 0) {
  //       // If an item is found, check the msg_date
  //       const item = data.Responses[this.foreignTableName][0];
  //       if (item && item["msg_date"] && item["msg_date"]["S"]) {
  //         const itemDate = parseDate(item["msg_date"]["S"]);
  //         const lastDate = parseDate(lastMessageDate);
  //         return itemDate < lastDate;
  //       }
  //     } else if (msg_type == "UPSERT") {
  //       // If no item found and the message type is UPSERT, we consider it valid
  //       return true;
  //     }
  //     const reason = "Message - the item to delete is not Exists.";
  //     const logEntry = `Type: ${msg_type}, Date: ${lastMessageDate}, Reason: ${reason}\n`;
  //     require("fs").appendFileSync("invalid_messages.log", logEntry);
  //     return false; // If no item found, return false
  //   } catch (error) {
  //     logger.error(
  //       "Error checking last message date: " + JSON.stringify(error)
  //     );
  //     throw error;
  //   }
  // };

  public isMsgDataValid = (msg_data: IObject): boolean => {
    try {
      // Validate General_details
      const hasValidArrival = msg_data[0].General_details?.arrival != 0;
      const hasValidInIsrael = msg_data[0].General_details?.in_israel === true;

      // Validate Last_visa_details
      const hasValidLastVisaValidToDate =
        msg_data[0].Last_visa_details?.valid_to != "0001-01-01T00:00:00";

      // Validate Passports
      const isValidPassportExpiry =
        this.disablePassportValidation ||
        (Array.isArray(msg_data[0].Passports) &&
          msg_data[0].Passports.some(
            (passport: {
              passport_num: any;
              valid_until: string | number | Date | null;
            }) => {
              return (
                passport.passport_num ===
                  msg_data[0].General_details?.passport_num &&
                passport.valid_until !== null &&
                new Date(passport.valid_until) >= new Date()
              );
            }
          ));

      // Combine all validations
      const isValid =
        hasValidArrival &&
        hasValidInIsrael &&
        hasValidLastVisaValidToDate &&
        isValidPassportExpiry;

      return isValid;
    } catch (error) {
      logger.error("Error validating msg_data:" + error);
      return false;
    }
  };
  /// Update message counters in the app state table

  public updateMessageCounters = async (counters: {
    done: number;
    error: number;
    skipped: number;
  }): Promise<void> => {
    const todayDate = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
    const dailyKey = `MessagesDaily-${todayDate}`; // מפתח יומי עבור הרשומה

    try {
      logger.info(
        `Starting - Updating message counters: done=${counters.done}, error=${counters.error}, skipped=${counters.skipped}`
      );

      // עדכון הרשומה היומית עם כל הערכים
      await this.dynamodbClient.send(
        new UpdateItemCommand({
          TableName: this.appStateTableName,
          Key: { id: { S: dailyKey } },
          UpdateExpression: `
          SET #done = if_not_exists(#done, :start) + :done,
              #error = if_not_exists(#error, :start) + :error,
              #skipped = if_not_exists(#skipped, :start) + :skipped,
              #total = if_not_exists(#total, :start) + :total
        `,
          ExpressionAttributeNames: {
            "#done": "done",
            "#error": "error",
            "#skipped": "skipped",
            "#total": "total",
          },
          ExpressionAttributeValues: {
            ":start": { N: "0" }, // ערך התחלתי אם המפתח לא קיים
            ":done": { N: counters.done.toString() },
            ":error": { N: counters.error.toString() },
            ":skipped": { N: counters.skipped.toString() },
            ":total": {
              N: (counters.done + counters.error + counters.skipped).toString(),
            },
          },
        })
      );

      logger.info(
        `Message counters updated successfully for ${dailyKey}: done=${counters.done}, error=${counters.error}, skipped=${counters.skipped}`
      );
    } catch (error) {
      logger.error("Error updating message counters:" + error);
      throw error;
    }
  };

  // Fetches failed messages from the app state table
  private async getFailedMessages(failedMessagesKey: string): Promise<any[]> {
    try {
      const response = await this.dynamodbClient.send(
        new GetItemCommand({
          TableName: this.appStateTableName,
          Key: { id: { S: failedMessagesKey } },
        })
      );

      if (response.Item) {
        const unmarshalledItem = unmarshall(response.Item);
        return unmarshalledItem.failedMessages || [];
      }
      return [];
    } catch (error) {
      logger.error("Error fetching failed messages:" + error);
      return [];
    }
  }
}
