"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleUsersNotification = handleUsersNotification;
const cognito_providers_1 = require("../cognito_providers");
const configuration_provider_1 = require("../configuration_provider");
const dynamodb_provider_1 = require("../dynamodb_provider");
const env_and_consts_1 = require("../env_and_consts");
const deleteForeignUsers_1 = require("./deleteForeignUsers");
const upsertForeignUsers_1 = require("./upsertForeignUsers");
function handleUsersNotification(notification) {
    return __awaiter(this, void 0, void 0, function* () {
        const { msg_type, msg_data } = notification;
        yield configuration_provider_1.configurationProvider.initialize(process.env.USE_LOCAL_FILE_ENV
            ? { fromAwsSecretsManager: false }
            : {
                fromAwsSecretsManager: true,
                awsSecretName: process.env.AWS_SECRET_NAME,
            });
        const { COGNITO_ROLE_ARN, AWS_COGNITO_USER_POOL_ID, FOREIGNS_TABLE_NAME, USERS_TABLE_NAME, SIGN_UP_ATTEMPTS_TABLE_NAME, DISABLE_PASSPORT_VALIDATION, APP_STATE_TABLE_NAME, } = (0, env_and_consts_1.GET_APP_RELEVANT_ENV)();
        const cognitoProvider = new cognito_providers_1.CognitoProvider();
        yield cognitoProvider.init({
            withCredentials: true,
            roleArn: COGNITO_ROLE_ARN,
            userPoolId: AWS_COGNITO_USER_POOL_ID,
        });
        const dynamodbProvider = new dynamodb_provider_1.DynamoDbProvider({
            foreignTableName: FOREIGNS_TABLE_NAME,
            usersTableName: USERS_TABLE_NAME,
            appStateTableName: APP_STATE_TABLE_NAME,
            disablePassportValidation: DISABLE_PASSPORT_VALIDATION,
            signUpsTableName: SIGN_UP_ATTEMPTS_TABLE_NAME,
        });
        yield dynamodbProvider.initial();
        // יצירת מפתח ייחודי להודעה
        const appStateKey = `notification_${Date.now()}`;
        const updateCounter = msg_data.length;
        //Add record to tha AppState table
        // עדכון סטטוס ל-"recived"
        yield dynamodbProvider.setAppStateValuesByKey("custom", JSON.stringify(msg_data), appStateKey, msg_type, updateCounter, "recived");
        try {
            if (msg_type === "DELETE") {
                yield (0, deleteForeignUsers_1.processDeleteForeignUsers)(msg_data, cognitoProvider, dynamodbProvider);
                // עדכון סטטוס ל-"pass to handle delete"
                yield dynamodbProvider.setAppStateValuesByKey("custom", JSON.stringify(msg_data), appStateKey, msg_type, updateCounter, "pass to handle delete");
            }
            else if (msg_type === "UPSERT") {
                yield (0, upsertForeignUsers_1.processUpdateForeignUsers)(msg_data, dynamodbProvider);
                // עדכון סטטוס ל-"pass to handle upsert"
                yield dynamodbProvider.setAppStateValuesByKey("custom", JSON.stringify(msg_data), appStateKey, msg_type, updateCounter, "pass to handle upsert");
            }
        }
        catch (error) {
            // עדכון סטטוס ל-"error" במקרה של שגיאה
            yield dynamodbProvider.setAppStateValuesByKey("custom", JSON.stringify(msg_data), appStateKey, msg_type, updateCounter, "error", error.message);
        }
    });
}
