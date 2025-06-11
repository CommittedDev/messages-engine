import path from "path";
import { IObject } from "./types";
import { logger } from "./logger";
import {
  SecretsManagerClient,
  GetSecretValueCommand,
  PutSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";

const client = new SecretsManagerClient({
  region: "il-central-1",
});

class ConfigurationProvider {
  private secrets: IObject = {};
  private fromAwsSecretsManager: boolean = false;
  private awsSecretName: string = "";

  static getSecret = async (secretName: string): Promise<IObject> => {
    console.log("Getting secret:", secretName);
    const command = new GetSecretValueCommand({
      SecretId: secretName,
      VersionStage: "AWSCURRENT",
    });
    const response = await client.send(command);
    if (response.SecretString === undefined) {
      throw new Error("SecretString is undefined");
    }
    return JSON.parse(response.SecretString);
  };

  static getMultiSecrets = async (secrets: string): Promise<IObject> => {
    const secretsArr = secrets.split(",");
    try {
      const secretPromises = secretsArr.map((secretName) =>
        ConfigurationProvider.getSecret(secretName.replace(/\s/g, ""))
      );
      const secrets = await Promise.all(secretPromises);

      return secrets.reduce((acc, secret) => ({ ...acc, ...secret }), {});
    } catch (error) {
      console.error("Error retrieving secrets:", +JSON.stringify(error));
      throw error;
    }
  };

  initialize = async ({
    fromAwsSecretsManager,
    awsSecretName,
  }: {
    fromAwsSecretsManager: boolean;
    awsSecretName?: string;
  }) => {
    this.fromAwsSecretsManager = fromAwsSecretsManager;
    this.awsSecretName = awsSecretName || "";
    try {
      await this.fetchSecrets();
    } catch (error) {
      logger.info(
        "Configuration provider initialized from AWS Secrets Manager"
      );
      throw error;
    }
  };

  refresh = async () => {
    try {
      this.fetchSecrets();
    } catch (error) {
      logger.error(
        "Configuration provider - Error refreshing configuration provider from AWS Secrets Manager" +
          JSON.stringify(error as any)
      );
      throw error;
    }
  };

  fetchSecrets = async () => {
    if (this.fromAwsSecretsManager) {
      this.fromAwsSecretsManager = true;
      try {
        if (!this.awsSecretName) {
          throw new Error("AWS Secret Name is required");
        }
        this.secrets = await ConfigurationProvider.getMultiSecrets(
          this.awsSecretName
        );
        logger.info("fetchSecrets from AWS Secrets Manager");
      } catch (error) {
        logger.error(
          "Configuration provider - Error fetchSecrets AWS Secrets Manager" +
            JSON.stringify(error as any)
        );
        // For a list of exceptions thrown, see
        // https://docs.aws.amazon.com/secretsmanager/latest/apireference/API_GetSecretValue.html
        throw error;
      }
    } else {
      require("@dotenvx/dotenvx").config({
        path: path.join(__dirname, "../.env"),
      });
      require("dotenv").config();
      logger.info("Environment variables:" + process.env.RABBITMQ_URL);
      logger.info(
        "Configuration provider initialized from environment variables"
      );
    }
  };

  getValue = (key: string): string | undefined => {
    return this.fromAwsSecretsManager ? this.secrets[key] : process.env[key];
  };

  getRequiredValue = (key: string): string => {
    const value = this.fromAwsSecretsManager
      ? this.secrets[key]
      : process.env[key];
    if (value === undefined) {
      throw new Error(
        `Configuration provider - Required value ${key} is undefined`
      );
    }
    return value;
  };

  getUpdatedValue = async (
    key: string,
    required: boolean
  ): Promise<string | undefined> => {
    await this.refresh();
    if (required) {
      return this.getRequiredValue(key);
    }
    return this.getValue(key);
  };

  setValue = async (
    secretKey: string,
    secretValue: string,
    throwErrorIfFailed: boolean
  ) => {
    if (!this.fromAwsSecretsManager) {
      this.secrets[secretKey] = secretValue;
      return;
    }
    const secretName = this.awsSecretName
      .split(",")
      .find((item) => !item.includes("-readonly"))
      ?.replace(/\s/g, "");
    if (!secretName) {
      if (throwErrorIfFailed) {
        throw new Error("Secret name not found");
      } else {
        console.log(
          `Secret name not found - Error adding new key-value to secret: ${secretKey}`
        );
        return;
      }
    }
    try {
      // Step 1: Retrieve the existing secret
      const getSecretParams = {
        SecretId: secretName,
      };
      const getSecretResponse = await client.send(
        new GetSecretValueCommand(getSecretParams)
      );
      if (!getSecretResponse.SecretString) {
        if (throwErrorIfFailed) {
          throw new Error("SecretString is undefined");
        } else {
          console.log(
            `SecretString is undefined - Error adding new key-value to secret: ${secretKey}`
          );
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
      await client.send(new PutSecretValueCommand(putSecretParams));

      // Update local useDebugValue
      this.secrets[secretKey] = secretValue;

      console.log(`Successfully added new key-value to secret: ${secretKey}`);
    } catch (err) {
      console.error(
        "Error adding new key-value to secret:" + JSON.stringify(err)
      );
    }
  };
}

export const configurationProvider = new ConfigurationProvider();
