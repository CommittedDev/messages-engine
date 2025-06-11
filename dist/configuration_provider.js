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
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.configurationProvider = void 0;
const path_1 = __importDefault(require("path"));
const logger_1 = require("./logger");
const client_secrets_manager_1 = require("@aws-sdk/client-secrets-manager");
const client = new client_secrets_manager_1.SecretsManagerClient({
    region: 'il-central-1',
});
class ConfigurationProvider {
    constructor() {
        this.secrets = {};
        this.fromAwsSecretsManager = false;
        this.awsSecretName = '';
        this.initialize = (_b) => __awaiter(this, [_b], void 0, function* ({ fromAwsSecretsManager, awsSecretName, }) {
            this.fromAwsSecretsManager = fromAwsSecretsManager;
            this.awsSecretName = awsSecretName || "";
            try {
                yield this.fetchSecrets();
            }
            catch (error) {
                logger_1.logger.info('Configuration provider initialized from AWS Secrets Manager');
                throw error;
            }
        });
        this.refresh = () => __awaiter(this, void 0, void 0, function* () {
            try {
                this.fetchSecrets();
            }
            catch (error) {
                logger_1.logger.error('Configuration provider - Error refreshing configuration provider from AWS Secrets Manager' +
                    JSON.stringify(error));
                throw error;
            }
        });
        this.fetchSecrets = () => __awaiter(this, void 0, void 0, function* () {
            if (this.fromAwsSecretsManager) {
                this.fromAwsSecretsManager = true;
                try {
                    if (!this.awsSecretName) {
                        throw new Error('AWS Secret Name is required');
                    }
                    this.secrets = yield _a.getMultiSecrets(this.awsSecretName);
                    logger_1.logger.info('fetchSecrets from AWS Secrets Manager');
                }
                catch (error) {
                    logger_1.logger.error('Configuration provider - Error fetchSecrets AWS Secrets Manager' +
                        JSON.stringify(error));
                    console.log(error);
                    // For a list of exceptions thrown, see
                    // https://docs.aws.amazon.com/secretsmanager/latest/apireference/API_GetSecretValue.html
                    throw error;
                }
            }
            else {
                require('@dotenvx/dotenvx').config({
                    path: path_1.default.join(__dirname, '../.env'),
                });
                logger_1.logger.info('Configuration provider initialized from environment variables');
            }
        });
        this.getValue = (key) => {
            return this.fromAwsSecretsManager ? this.secrets[key] : process.env[key];
        };
        this.getRequiredValue = (key) => {
            const value = this.fromAwsSecretsManager
                ? this.secrets[key]
                : process.env[key];
            if (value === undefined) {
                throw new Error(`Configuration provider - Required value ${key} is undefined`);
            }
            return value;
        };
        this.getUpdatedValue = (key, required) => __awaiter(this, void 0, void 0, function* () {
            yield this.refresh();
            if (required) {
                return this.getRequiredValue(key);
            }
            return this.getValue(key);
        });
        this.setValue = (secretKey, secretValue, throwErrorIfFailed) => __awaiter(this, void 0, void 0, function* () {
            var _b;
            if (!this.fromAwsSecretsManager) {
                this.secrets[secretKey] = secretValue;
                return;
            }
            const secretName = (_b = this.awsSecretName
                .split(',')
                .find((item) => !item.includes('-readonly'))) === null || _b === void 0 ? void 0 : _b.replace(/\s/g, '');
            if (!secretName) {
                if (throwErrorIfFailed) {
                    throw new Error('Secret name not found');
                }
                else {
                    console.log(`Secret name not found - Error adding new key-value to secret: ${secretKey}`);
                    return;
                }
            }
            try {
                // Step 1: Retrieve the existing secret
                const getSecretParams = {
                    SecretId: secretName,
                };
                const getSecretResponse = yield client.send(new client_secrets_manager_1.GetSecretValueCommand(getSecretParams));
                if (!getSecretResponse.SecretString) {
                    if (throwErrorIfFailed) {
                        throw new Error('SecretString is undefined');
                    }
                    else {
                        console.log(`SecretString is undefined - Error adding new key-value to secret: ${secretKey}`);
                        return;
                    }
                }
                // Parse the existing secret string (assuming it's in JSON format)
                let secretObject = JSON.parse(getSecretResponse.SecretString);
                // Step 2: Add the new key-value pair
                secretObject[secretKey] = secretValue;
                // Step 3: Update the secret with the modified content
                const putSecretParams = {
                    SecretId: secretName,
                    SecretString: JSON.stringify(secretObject),
                };
                yield client.send(new client_secrets_manager_1.PutSecretValueCommand(putSecretParams));
                // Update local useDebugValue
                this.secrets[secretKey] = secretValue;
                console.log(`Successfully added new key-value to secret: ${secretKey}`);
            }
            catch (err) {
                console.error('Error adding new key-value to secret:' + JSON.stringify(err));
            }
        });
    }
}
_a = ConfigurationProvider;
ConfigurationProvider.getSecret = (secretName) => __awaiter(void 0, void 0, void 0, function* () {
    console.log('Getting secret:', secretName);
    const command = new client_secrets_manager_1.GetSecretValueCommand({
        SecretId: secretName,
        VersionStage: 'AWSCURRENT',
    });
    const response = yield client.send(command);
    if (response.SecretString === undefined) {
        throw new Error('SecretString is undefined');
    }
    return JSON.parse(response.SecretString);
});
ConfigurationProvider.getMultiSecrets = (secrets) => __awaiter(void 0, void 0, void 0, function* () {
    const secretsArr = secrets.split(',');
    try {
        const secretPromises = secretsArr.map((secretName) => _a.getSecret(secretName.replace(/\s/g, '')));
        const secrets = yield Promise.all(secretPromises);
        return secrets.reduce((acc, secret) => (Object.assign(Object.assign({}, acc), secret)), {});
    }
    catch (error) {
        console.error('Error retrieving secrets:', +JSON.stringify(error));
        throw error;
    }
});
exports.configurationProvider = new ConfigurationProvider();
