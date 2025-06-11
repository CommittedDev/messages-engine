import { DynamoDbProvider } from "../dynamodb-provider/dynamodb_provider";

export async function processUpdateForeignUsers(
  data: any,
  msg_date: string,
  dynamodbProvider: DynamoDbProvider
) {
  for (const record of data) {
    const foreignKey = `${
      record.General_details?.nationalityCode
    }_${record.General_details?.passport_num.toLowerCase()}`;

    if (foreignKey) {
      const response = await dynamodbProvider.upsertForeignRecord(
        foreignKey,
        record,
        msg_date
      );
      return response;
    }
  }
}
