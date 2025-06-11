import { DynamoDbProvider } from "../dynamodb-provider/dynamodb_provider";
import { CognitoProvider } from "../cognito_providers";
import { logger } from "../logger";
import { MessageStatus } from "../../types";

export async function processDeleteForeignUsers(
  data: any,
  cognitoProvider: CognitoProvider,
  dynamoDBProvider: DynamoDbProvider,
  msg_date: string
): Promise<MessageStatus | undefined> {
  if (!data || !Array.isArray(data)) {
    logger.error("Invalid data structure: 'msg_data' array not found.");
    return;
  }
  // Check if the data array is empty
  for (const record of data) {
    const foreignKey = `${
      record.General_details?.nationalityCode
    }_${record.General_details?.passport_num.toLowerCase()}`;
    if (foreignKey) {
      try {
        // Get user details from users table using the foreignKey
        const usersFound =
          await dynamoDBProvider.getUserByForeignKey(foreignKey);
        // Proceed to delete records from the foreign table
        try {
          const response = await dynamoDBProvider.deleteForeignContent(
            foreignKey,
            msg_date
          );
          return response;
        } catch (error) {
          logger.error(
            `Error deleting foreign record for passport ${foreignKey}: ` + error
          );
        }
        if (usersFound) {
          // Use cognito_user_name from the returned record(s) for deletion in Cognito
          const cognitoUserName = usersFound.cognito_user_name;
          try {
            // Delete the user from Cognito using the cognito_user_name
            await cognitoProvider.deleteUser(cognitoUserName);
          } catch (error) {
            logger.error(
              `Error deleting Cognito user for cognito_user_name ${cognitoUserName}: ` +
                error
            );
          }
          // Proceed to delete the user record from DynamoDB
          try {
            // Delete the user record from the users table
            await dynamoDBProvider.deleteUser(foreignKey);
          } catch (error) {
            logger.error(
              `Error deleting user record for passport ${foreignKey}: ` + error
            );
          }
        } else {
          logger.warn(
            `User with passport ${foreignKey} does not exist in the users table.`
          );
        }
      } catch (error) {
        logger.error(
          `Error checking existence of user for passport ${foreignKey}: ` +
            error
        );
      }
    } else {
      logger.warn("Passport number not found in record:" + record);
    }
  }
}
