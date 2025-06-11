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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CognitoProvider = void 0;
const node_http_handler_1 = require("@smithy/node-http-handler");
const https_1 = __importDefault(require("https"));
const logger_1 = require("./logger");
const utils_1 = require("./utils");
const client_cognito_identity_provider_1 = require("@aws-sdk/client-cognito-identity-provider");
let agent = new https_1.default.Agent({
    maxSockets: 25, // https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/node-configuring-maxsockets.html
});
class CognitoProvider {
    constructor() {
        this.withCredentials = true;
        this.isReady = false;
        this.init = (_a) => __awaiter(this, [_a], void 0, function* ({ withCredentials, roleArn, userPoolId, }) {
            try {
                this.userPoolId = userPoolId;
                logger_1.logger.info('CognitoProvider - initializing..');
                if (withCredentials) {
                    if (!roleArn) {
                        throw new Error('Role ARN is required for initializing with credentials');
                    }
                    this.credentials = yield (0, utils_1.assumeRole)(roleArn, 's3-role');
                    this.cognitoClient = new client_cognito_identity_provider_1.CognitoIdentityProviderClient({
                        region: 'il-central-1',
                        credentials: {
                            accessKeyId: this.credentials.accessKeyId,
                            secretAccessKey: this.credentials.secretAccessKey,
                            sessionToken: this.credentials.sessionToken,
                        },
                        requestHandler: new node_http_handler_1.NodeHttpHandler({
                            requestTimeout: 6000,
                            httpsAgent: agent,
                        }),
                    });
                    this.isReady = true;
                    logger_1.logger.info('CognitoProvider - initialization completed with credentials.');
                }
                else {
                    this.cognitoClient = new client_cognito_identity_provider_1.CognitoIdentityProviderClient({
                        region: 'il-central-1',
                    });
                    this.isReady = true;
                    logger_1.logger.info('CognitoProvider - initialization completed - without credentials.');
                }
            }
            catch (error) {
                logger_1.logger.error(`CognitoProvider - init - error: ${JSON.stringify(error)}`);
                throw error;
            }
        });
        this.deleteUser = (userName) => __awaiter(this, void 0, void 0, function* () {
            yield this.deleteUsersByUsersName(userName);
        });
        this.deleteUsersByUsersName = (userName) => __awaiter(this, void 0, void 0, function* () {
            if (!this.cognitoClient || !this.userPoolId || !this.isReady) {
                throw new Error('Cognito client is not initialized');
            }
            const deleteUserParams = {
                Username: userName,
                UserPoolId: this.userPoolId,
            };
            const deleteUserCommand = new client_cognito_identity_provider_1.AdminDeleteUserCommand(deleteUserParams);
            console.log(`Cognito Provider - Deleting user ${userName}`);
            try {
                yield this.cognitoClient.send(deleteUserCommand);
                console.log(`Cognito Provider - Deleting user ${userName} - Success`);
            }
            catch (error) {
                const isNotFoundError = error.name === 'UserNotFoundException';
                if (isNotFoundError) {
                    console.error(`Cognito Provider - Deleting user Error - User ${userName} not found`);
                }
                else {
                    console.error(`Cognito Provider - Deleting user Error - deleting user ${userName}:` + JSON.stringify(error));
                }
            }
        });
        this.createUser = (userData) => __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            if (!this.cognitoClient || !this.userPoolId || !this.isReady) {
                throw new Error('Cognito client is not initialized');
            }
            const command = new client_cognito_identity_provider_1.AdminCreateUserCommand({
                UserPoolId: this.userPoolId,
                Username: userData.email,
                UserAttributes: [
                    { Name: 'custom:passport_num', Value: userData.passport_num },
                    {
                        Name: 'custom:nationality_code',
                        Value: userData.nationality_code.toString(),
                    },
                    {
                        Name: 'custom:foreign_key',
                        Value: userData.foreign_key,
                    },
                    { Name: 'custom:visa_expiry', Value: userData.visa_expiry },
                    { Name: 'custom:arrival', Value: userData.arrival.toString() },
                    { Name: 'email', Value: userData.email },
                    { Name: 'email_verified', Value: 'true' },
                ],
                TemporaryPassword: 'TempPassword123!', // You can set this to any temporary password you like
                MessageAction: 'SUPPRESS', // Suppress sending the welcome email
            });
            try {
                const response = yield ((_a = this.cognitoClient) === null || _a === void 0 ? void 0 : _a.send(command));
                console.log(`User ${userData.email} created successfully`);
                return {
                    email: userData.email,
                    passport_num: userData.passport_num,
                    foreign_key: userData.foreign_key,
                    cognito_user_name: (_b = response === null || response === void 0 ? void 0 : response.User) === null || _b === void 0 ? void 0 : _b.Username,
                };
            }
            catch (error) {
                console.error(`Error creating user ${userData.email}:`, +JSON.stringify(error));
            }
        });
    }
}
exports.CognitoProvider = CognitoProvider;
