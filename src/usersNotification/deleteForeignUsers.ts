import { DynamoDbProvider } from "../dynamodb-provider/dynamodb_provider";
import { CognitoProvider } from "../cognito_providers";

export async function processDeleteForeignUsers(
  data: any,
  cognitoProvider: CognitoProvider,
  dynamoDBProvider: DynamoDbProvider,
  msg_date: string
) {
  if (!data || !Array.isArray(data)) {
    console.error("Invalid data structure: 'msg_data' array not found.");
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
          console.error(
            `Error deleting foreign record for passport ${foreignKey}: `,
            error
          );
        }
        if (usersFound) {
          // Use cognito_user_name from the returned record(s) for deletion in Cognito
          const cognitoUserName = usersFound.cognito_user_name;
          try {
            // Delete the user from Cognito using the cognito_user_name
            await cognitoProvider.deleteUser(cognitoUserName);
          } catch (error) {
            console.error(
              `Error deleting Cognito user for cognito_user_name ${cognitoUserName}: `,
              error
            );
          }
          // Proceed to delete the user record from DynamoDB
          try {
            // Delete the user record from the users table
            await dynamoDBProvider.deleteUser(foreignKey);
          } catch (error) {
            console.error(
              `Error deleting user record for passport ${foreignKey}: `,
              error
            );
          }
        } else {
          console.warn(
            `User with passport ${foreignKey} does not exist in the users table.`
          );
        }
      } catch (error) {
        console.error(
          `Error checking existence of user for passport ${foreignKey}: `,
          error
        );
      }
    } else {
      console.warn("Passport number not found in record:", record);
    }
  }
}
