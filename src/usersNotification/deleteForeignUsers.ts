import { dynamoDbProvider } from "../dynamodb-provider/dynamodb_provider";
import { cognitoProvider, CognitoProvider } from "../cognito_providers";
import { logger } from "../logger";
import { MessageStatus } from "../../types";
import { getForeignKey } from "../utils";

export async function processDeleteForeignUsers(
  data: any,
  msg_date: string
): Promise<MessageStatus | undefined> {
  if (!data || !Array.isArray(data) || data.length > 1) {
    logger.error("Invalid data structure: 'msg_data' " + data.length);
    return;
  }
  let response: MessageStatus | undefined = undefined;
  // Check if the data array is empty
  for (const record of data) {
    const foreignKey = getForeignKey(record);
    if (foreignKey) {
      try {
        logger.info(
          `Starting - Processing deletion for foreignKey: ${foreignKey} at date: ${msg_date}`
        );
        // Get user details from users table using the foreignKey
        const usersFound =
          await dynamoDbProvider.getUserByForeignKey(foreignKey);
        // Proceed to delete records from the foreign table
        try {
          response = await dynamoDbProvider.deleteForeignContent(
            foreignKey,
            msg_date
          );
          logger.info(
            `Foreign record deleted successfully for passport ${foreignKey}-${response}`
          );
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
            logger.info(
              `Cognito user deleted successfully for cognito_user_name ${cognitoUserName}`
            );
          } catch (error) {
            logger.error(
              `Error deleting Cognito user for cognito_user_name ${cognitoUserName}: ` +
                error
            );
          }
          // Proceed to delete the user record from DynamoDB
          try {
            // Delete the user record from the users table
            await dynamoDbProvider.deleteUser(foreignKey);
            logger.info(
              `User from users record deleted successfully for passport ${foreignKey}`
            );
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
  return response;
}
