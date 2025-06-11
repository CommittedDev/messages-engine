export declare const META_DATA_FILE_NAME = "zarim_MetaData.json";
export declare const DEPOSIT_FOLDER_TARGET = "deposits";
export declare const FOREIGNERS_ZIP_PREFIX_NAME = "zarim_";
export declare const GET_APP_RELEVANT_ENV: () => {
    SQS_QUEUE_URL: string;
    FOREIGNS_TABLE_NAME: string;
    USERS_TABLE_NAME: string;
    GMAIL_SENDER_EMAIL_USER: string;
    GMAIL_SENDER_EMAIL_PASSWORD: string;
    ADMIN_EMAILS: string[];
    S3_ROLE_ARN: string;
    COGNITO_ROLE_ARN: string;
    AWS_COGNITO_USER_POOL_ID: string;
    SIGN_UP_ATTEMPTS_TABLE_NAME: string;
    DISABLE_PASSPORT_VALIDATION: boolean;
    TIME_BETWEEN_POLLS: number;
    BUCKET_NAME: string;
    APP_STATE_TABLE_NAME: string;
    VERIFIED_SES_EMAIL_ADDRESS: string;
};
//# sourceMappingURL=env_and_consts.d.ts.map