import { NodeHttpHandler } from "@smithy/node-http-handler";
import https from "https";
import { logger } from "./logger";
import { assumeRole, IAssumeRoleResponse } from "./utils";
import {
  AdminCreateUserCommand,
  AdminDeleteUserCommand,
  CognitoIdentityProviderClient,
} from "@aws-sdk/client-cognito-identity-provider";
import { v4 as uuidv4 } from "uuid";

let agent = new https.Agent({
  maxSockets: 25, // https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/node-configuring-maxsockets.html
});

interface ICognitoUser {
  username: string;
  password: string;
  email: string;
  phone_number: string;
  // Custom attributes
  "custom:passport_num": string;
  "custom:nationality_code": string;
  "custom:foreign_key": string;
  "custom:visa_expiry": string;
  "custom:arrival": string;
}

export class CognitoProvider {
  cognitoClient: CognitoIdentityProviderClient | undefined;
  userPoolId: string | undefined;
  credentials: IAssumeRoleResponse | undefined;
  withCredentials: boolean = true;
  isReady: boolean = false;
  constructor() {}

  init = async ({
    withCredentials,
    roleArn,
    userPoolId,
  }: {
    withCredentials: boolean;
    userPoolId: string;
    roleArn?: string;
  }) => {
    try {
      this.userPoolId = userPoolId;
      logger.info("CognitoProvider - initializing..");
      if (withCredentials) {
        if (!roleArn) {
          throw new Error(
            "Role ARN is required for initializing with credentials"
          );
        }
        this.credentials = await assumeRole(roleArn, "s3-role");
        this.cognitoClient = new CognitoIdentityProviderClient({
          region: "il-central-1",
          credentials: {
            accessKeyId: this.credentials.accessKeyId,
            secretAccessKey: this.credentials.secretAccessKey,
            sessionToken: this.credentials.sessionToken,
          },
          requestHandler: new NodeHttpHandler({
            requestTimeout: 6_000,
            httpsAgent: agent,
          }),
        });
        this.isReady = true;
        logger.info(
          "CognitoProvider - initialization completed with credentials."
        );
      } else {
        this.cognitoClient = new CognitoIdentityProviderClient({
          region: "il-central-1",
        });
        this.isReady = true;
        logger.info(
          "CognitoProvider - initialization completed - without credentials."
        );
      }
    } catch (error) {
      logger.error(`CognitoProvider - init - error: ${JSON.stringify(error)}`);
      throw error;
    }
  };

  deleteUser = async (userName: string) => {
    await this.deleteUsersByUsersName(userName);
  };
  private deleteUsersByUsersName = async (userName: string) => {
    if (!this.cognitoClient || !this.userPoolId || !this.isReady) {
      throw new Error("Cognito client is not initialized");
    }

    const deleteUserParams = {
      Username: userName,
      UserPoolId: this.userPoolId,
    };
    const deleteUserCommand = new AdminDeleteUserCommand(deleteUserParams);
    console.log(`Cognito Provider - Deleting user ${userName}`);
    try {
      await this.cognitoClient.send(deleteUserCommand);
      console.log(`Cognito Provider - Deleting user ${userName} - Success`);
    } catch (error) {
      const isNotFoundError = (error as any).name === "UserNotFoundException";
      if (isNotFoundError) {
        console.error(
          `Cognito Provider - Deleting user Error - User ${userName} not found`
        );
      } else {
        console.error(
          `Cognito Provider - Deleting user Error - deleting user ${userName}:` +
            JSON.stringify(error)
        );
      }
    }
  };

  createUser = async (userData: {
    foreign_key: string;
    passport_num: string;
    email: string;
    nationality_code: number;
    visa_expiry: string;
    arrival: number;
    email_verified: string;
  }) => {
    if (!this.cognitoClient || !this.userPoolId || !this.isReady) {
      throw new Error("Cognito client is not initialized");
    }
    const command = new AdminCreateUserCommand({
      UserPoolId: this.userPoolId!,
      Username: userData.email,
      UserAttributes: [
        { Name: "custom:passport_num", Value: userData.passport_num },
        {
          Name: "custom:nationality_code",
          Value: userData.nationality_code.toString(),
        },
        {
          Name: "custom:foreign_key",
          Value: userData.foreign_key,
        },
        { Name: "custom:visa_expiry", Value: userData.visa_expiry },
        { Name: "custom:arrival", Value: userData.arrival.toString() },
        { Name: "email", Value: userData.email },
        { Name: "email_verified", Value: "true" },
      ],
      TemporaryPassword: "TempPassword123!", // You can set this to any temporary password you like
      MessageAction: "SUPPRESS", // Suppress sending the welcome email
    });
    try {
      const response = await this.cognitoClient?.send(command);
      console.log(`User ${userData.email} created successfully`);
      return {
        email: userData.email,
        passport_num: userData.passport_num,
        foreign_key: userData.foreign_key,
        cognito_user_name: response?.User?.Username,
      };
    } catch (error) {
      console.error(
        `Error creating user ${userData.email}:`,
        +JSON.stringify(error)
      );
    }
  };

  // createMockUserRecords = async (count: number) => {
  //   const newUsers = [];
  //   if(!this.cognitoClient || !this.userPoolId || !this.isReady){
  //     throw new Error('Cognito client is not initialized');
  //   }
  //   for (let i = 0; i < count; i++) {
  //     const username = `user-${uuidv4().substring(0, 8)}`;
  //     try {
  //       const newUser = await this.createMockUser(username, this.userPoolId);
  //       newUsers.push(newUser);
  //     } catch (error) {
  //       console.error(`Error creating mock user ${username}:`, error);
  //     }
  //   }
  // }

  // createMockUser = async (username: string, userPoolId: string) => {
  //   const passportNumber = `P${Math.floor(Math.random() * 10000000)}`;
  //   const email = `${username}@example.com`;
  //   const command = new AdminCreateUserCommand({
  //     UserPoolId: userPoolId,
  //     Username: email,
  //     UserAttributes: [
  //       { Name: "custom:passport_num", Value: passportNumber },
  //       { Name: "custom:nationality_code", Value: `Country-${Math.floor(Math.random() * 100)}` },
  //       { Name: "custom:visa_expiry", Value: new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString() },
  //       { Name: "custom:arrival", Value: new Date().toISOString() },
  //       { Name: "email", Value: email },
  //       { Name: "email_verified", Value: "true" },
  //     ],
  //     TemporaryPassword: "TempPassword123!", // You can set this to any temporary password you like
  //     MessageAction: "SUPPRESS", // Suppress sending the welcome email
  //   });

  //   try {
  //     const response = await this.cognitoClient?.send(command);
  //     console.log(`User ${username} created successfully`);
  //     const newUserName = response?.User?.Username;
  //     return {
  //       email,
  //       passport_num: passportNumber,
  //       cognito_user_name: response?.User?.Username,
  //     };
  //   } catch (error) {
  //     console.error(`Error creating user ${username}:`, error);
  //   }
  // }
}
export const cognitoProvider = new CognitoProvider();
