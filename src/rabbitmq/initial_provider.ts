import { dynamoDbProvider } from "../dynamodb-provider/dynamodb_provider";
import { CognitoProvider } from "../cognito_providers";
import { GET_APP_RELEVANT_ENV } from "../env_and_consts";
import { configurationProvider } from "../configuration_provider";

export async function initializeProviders(): Promise<{
  cognitoProvider: CognitoProvider;
}> {
  const {
    COGNITO_ROLE_ARN,
    AWS_COGNITO_USER_POOL_ID,
    FOREIGNS_TABLE_NAME,
    USERS_TABLE_NAME,
    SIGN_UP_ATTEMPTS_TABLE_NAME,
    DISABLE_PASSPORT_VALIDATION,
    APP_STATE_TABLE_NAME,
    USE_LOCAL_FILE_ENV,
  } = GET_APP_RELEVANT_ENV();

  await configurationProvider.initialize(
    USE_LOCAL_FILE_ENV
      ? { fromAwsSecretsManager: false }
      : {
          fromAwsSecretsManager: true,
          awsSecretName: process.env.AWS_SECRET_NAME,
        }
  );

  const cognitoProvider = new CognitoProvider();
  await cognitoProvider.init({
    withCredentials: true,
    roleArn: COGNITO_ROLE_ARN,
    userPoolId: AWS_COGNITO_USER_POOL_ID,
  });

  // const dynamodbProvider = new DynamoDbProvider({
  //   foreignTableName: FOREIGNS_TABLE_NAME,
  //   usersTableName: USERS_TABLE_NAME,
  //   appStateTableName: APP_STATE_TABLE_NAME,
  //   disablePassportValidation: DISABLE_PASSPORT_VALIDATION,
  //   signUpsTableName: SIGN_UP_ATTEMPTS_TABLE_NAME,
  // });
  // await dynamodbProvider.initial();

  return { cognitoProvider };
}
