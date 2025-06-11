import { DynamoDbProvider } from "../dynamodb-provider/dynamodb_provider";
import { CognitoProvider } from "../cognito_providers";
export declare function processDeleteForeignUsers(
  data: any,
  cognitoProvider: CognitoProvider,
  dynamoDBProvider: DynamoDbProvider
): Promise<void>;
//# sourceMappingURL=deleteForeignUsers.d.ts.map
