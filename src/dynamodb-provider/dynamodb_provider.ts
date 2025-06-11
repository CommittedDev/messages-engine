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
    console.log("Initializing DynamoDB");
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
        console.info(`User with foreign_key ${foreignKey} not found.`);
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
      console.info("SignUpAttempt deleted successfully");
      return true;
    } catch (error) {
      console.error(
        "Unable to delete FSignUpAttempt item. Error:" + JSON.stringify(error)
      );
      return false;
    }
  };
  ///change to putItem
  deleteForeignContent = async (
    foreignKey: string,
    msg_date: string
  ): Promise<boolean | string> => {
    try {
      const params = {
        TableName: this.foreignTableName,
        Key: {
          foreign_key: { S: foreignKey },
        },
        UpdateExpression: `
        REMOVE #field1, #field2, #field3, #field4, #field5, #field6, #field7, #field8, #field9, #field10, #field11, #field12, #field13
        SET #msg_date = :msg_date
      `,
        ConditionExpression:
          "attribute_exists(foreign_key) AND (attribute_not_exists(#msg_date) OR #msg_date < :msg_date)",
        ExpressionAttributeNames: {
          "#field1": "General_details",
          "#field2": "Employers",
          "#field3": "Passports",
          "#field4": "Visas",
          "#field5": "Work_permit",
          "#field6": "Deposits",
          "#field7": "Last_visa_details",
          "#field8": "Employers_per_visa",
          "#field9": "Entries_and_exits",
          "#field10": "updatedAt",
          "#field11": "updatedAtFullTime",
          "#field12": "deposit_files",
          "#field13": "alerts",
          "#msg_date": "msg_date",
        },
        ExpressionAttributeValues: {
          ":msg_date": { S: msg_date },
        },
      };

      await this.dynamodbClient!.send(new UpdateItemCommand(params));
      console.info("Foreign fields cleared successfully, msg_date updated.");
      return true;
    } catch (error: any) {
      if (error.name === "ConditionalCheckFailedException") {
        // If the condition is not met, we skip the deletion
        console.warn(
          `Deletion skipped for ${foreignKey}: msg_date condition not met.`
        );
        return "skipped"; // If the condition is not met, we skip the deletion
      }
      console.error(
        "Unable to clear Foreign fields. Error:" + JSON.stringify(error)
      );
      return false;
    }
  };

  deleteUser = async (foreignKey: string): Promise<boolean> => {
    try {
      await this.dynamodbClient!.send(
        new DeleteItemCommand({
          TableName: this.usersTableName,
          Key: {
            foreign_key: { S: foreignKey },
          },
        })
      );
      console.info("User deleted successfully");
      return true;
    } catch (error) {
      console.error(
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
  ): Promise<boolean | string> => {
    try {
      //remove it
      if (data.foreign_key) {
        data.foreign_key = data.foreign_key.toLowerCase();
      }

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
      console.log(
        "Marshalled item:",
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
      console.log(
        `Foreign record with key ${foreignKey} upserted successfully.`
      );
      return true;
    } catch (error: any) {
      if (error.name === "ConditionalCheckFailedException") {
        // If the condition is not met, we skip the upsert
        console.warn(
          `Upsert skipped for ${foreignKey}: msg_date condition not met.`
        );
        return "skipped"; // If the condition is not met, we skip the upsert
      }
      console.error("Error upserting foreign record: " + JSON.stringify(error));
      return false;
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
      console.error("Error validating msg_data:", error);
      return false;
    }
  };
  /// Update message counters in the app state table
  //change-all nters on one record
  public updateMessageCounters = async (
    successCount: number,
    failureCount: number,
    skipCount: number = 0,
    failedMessageDetails?: { msg_id: string; foreignKey: string; error: string }
  ): Promise<void> => {
    const todayDate = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
    const successKey = `MessagesSuccess-${todayDate}`;
    const failureKey = `MessagesFailure-${todayDate}`;
    const failedMessagesKey = `FailedMessages-${todayDate}`;
    const skipKey = `MessagesSkip-${todayDate}`;
    try {
      // update success count
      await this.dynamodbClient.send(
        new UpdateItemCommand({
          TableName: this.appStateTableName,
          Key: { id: { S: successKey } },
          UpdateExpression:
            "SET #value = if_not_exists(#value, :start) + :increment",
          ExpressionAttributeNames: {
            "#value": "value",
          },
          ExpressionAttributeValues: {
            ":start": { N: "0" }, // ערך התחלתי אם המפתח לא קיים
            ":increment": { N: successCount.toString() }, // הגדלה לפי מספר הצלחות
          },
        })
      );

      // Update failure count
      await this.dynamodbClient.send(
        new UpdateItemCommand({
          TableName: this.appStateTableName,
          Key: { id: { S: failureKey } },
          UpdateExpression:
            "SET #value = if_not_exists(#value, :start) + :increment",
          ExpressionAttributeNames: {
            "#value": "value",
          },
          ExpressionAttributeValues: {
            ":start": { N: "0" }, // ערך התחלתי אם המפתח לא קיים
            ":increment": { N: failureCount.toString() }, // הגדלה לפי מספר כשלונות
          },
        })
      );
      // Update skip count
      await this.dynamodbClient.send(
        new UpdateItemCommand({
          TableName: this.appStateTableName,
          Key: { id: { S: skipKey } },
          UpdateExpression:
            "SET #value = if_not_exists(#value, :start) + :increment",
          ExpressionAttributeNames: {
            "#value": "value",
          },
          ExpressionAttributeValues: {
            ":start": { N: "0" },
            ":increment": { N: skipCount.toString() },
          },
        })
      );
      // Update failed messages
      if (failedMessageDetails) {
        const existingFailedMessages =
          await this.getFailedMessages(failedMessagesKey);
        const updatedFailedMessages = [
          ...existingFailedMessages,
          {
            msg_id: failedMessageDetails.msg_id,
            foreignKey: failedMessageDetails.foreignKey,
            error: failedMessageDetails.error,
            timestamp: new Date().toISOString(),
          },
        ];

        await this.dynamodbClient.send(
          new PutItemCommand({
            TableName: this.appStateTableName,
            Item: marshall({
              id: failedMessagesKey,
              failedMessages: updatedFailedMessages,
            }),
          })
        );
        console.log(
          `Failed message saved: msg_id=${failedMessageDetails.msg_id}, foreignKey=${failedMessageDetails.foreignKey}`
        );
      }
    } catch (error) {
      console.error("Error updating message counters:", error);
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
      console.error("Error fetching failed messages:", error);
      return [];
    }
  }
}
