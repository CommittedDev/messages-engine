import { MessageStatus, UserData } from "../../types";
import { DynamoDbProvider } from "../dynamodb-provider/dynamodb_provider";
import { getForeignKey } from "../utils";

export async function processUpdateForeignUsers(
  data: any,
  msg_date: string,
  dynamodbProvider: DynamoDbProvider
): Promise<MessageStatus | undefined> {
  for (const record of data) {
    const foreignKey = getForeignKey(record as UserData);

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
