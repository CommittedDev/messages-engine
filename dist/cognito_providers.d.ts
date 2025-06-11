import { IAssumeRoleResponse } from './utils';
import { CognitoIdentityProviderClient } from '@aws-sdk/client-cognito-identity-provider';
export declare class CognitoProvider {
    cognitoClient: CognitoIdentityProviderClient | undefined;
    userPoolId: string | undefined;
    credentials: IAssumeRoleResponse | undefined;
    withCredentials: boolean;
    isReady: boolean;
    constructor();
    init: ({ withCredentials, roleArn, userPoolId, }: {
        withCredentials: boolean;
        userPoolId: string;
        roleArn?: string;
    }) => Promise<void>;
    deleteUser: (userName: string) => Promise<void>;
    private deleteUsersByUsersName;
    createUser: (userData: {
        foreign_key: string;
        passport_num: string;
        email: string;
        nationality_code: number;
        visa_expiry: string;
        arrival: number;
        email_verified: string;
    }) => Promise<{
        email: string;
        passport_num: string;
        foreign_key: string;
        cognito_user_name: string | undefined;
    } | undefined>;
}
//# sourceMappingURL=cognito_providers.d.ts.map