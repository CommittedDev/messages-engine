import { MessageStatus, UserData } from "../../types";
import { dynamoDbProvider } from "../dynamodb-provider/dynamodb_provider";
import { getForeignKey } from "../utils";

export async function processUpdateForeignUsers(
  data: any,
  msg_date: string
): Promise<MessageStatus | undefined> {
  for (const record of data) {
    const foreignKey = getForeignKey(record as UserData);

    if (foreignKey) {
      const response = await dynamoDbProvider.upsertForeignRecord(
        foreignKey,
        record,
        msg_date
      );
      return response;
    }
  }
}
