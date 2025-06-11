"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GET_APP_RELEVANT_ENV = exports.FOREIGNERS_ZIP_PREFIX_NAME = exports.DEPOSIT_FOLDER_TARGET = exports.META_DATA_FILE_NAME = void 0;
const configuration_provider_1 = require("./configuration_provider");
exports.META_DATA_FILE_NAME = 'zarim_MetaData.json';
exports.DEPOSIT_FOLDER_TARGET = 'deposits';
exports.FOREIGNERS_ZIP_PREFIX_NAME = 'zarim_';
const GET_APP_RELEVANT_ENV = () => {
    const SQS_QUEUE_URL = configuration_provider_1.configurationProvider.getRequiredValue('SQS_QUEUE_URL');
    const FOREIGNS_TABLE_NAME = configuration_provider_1.configurationProvider.getRequiredValue('FOREIGNS_TABLE_NAME');
    const APP_STATE_TABLE_NAME = configuration_provider_1.configurationProvider.getRequiredValue('APP_STATE_TABLE_NAME');
    const USERS_TABLE_NAME = configuration_provider_1.configurationProvider.getRequiredValue('USERS_TABLE_NAME');
    const GMAIL_SENDER_EMAIL_USER = configuration_provider_1.configurationProvider.getRequiredValue('GMAIL_SENDER_EMAIL_USER');
    const GMAIL_SENDER_EMAIL_PASSWORD = configuration_provider_1.configurationProvider.getRequiredValue('GMAIL_SENDER_EMAIL_PASSWORD');
    const ADMIN_EMAILS = configuration_provider_1.configurationProvider
        .getRequiredValue('ADMIN_EMAILS')
        .split(',');
    const S3_ROLE_ARN = configuration_provider_1.configurationProvider.getRequiredValue('S3_ARN');
    const COGNITO_ROLE_ARN = configuration_provider_1.configurationProvider.getRequiredValue('COGNITO_ROLE_ARN');
    const AWS_COGNITO_USER_POOL_ID = configuration_provider_1.configurationProvider.getRequiredValue('AWS_COGNITO_USER_POOL_ID');
    const SIGN_UP_ATTEMPTS_TABLE_NAME = configuration_provider_1.configurationProvider.getRequiredValue('SIGN_UP_ATTEMPTS_TABLE_NAME');
    const DISABLE_PASSPORT_VALIDATION = configuration_provider_1.configurationProvider.getValue('DISABLE_PASSPORT_VALIDATION') == 'true';
    const TIME_BETWEEN_POLLS = parseInt(configuration_provider_1.configurationProvider.getRequiredValue('TIME_BETWEEN_POLLS') || '30000');
    const BUCKET_NAME = configuration_provider_1.configurationProvider.getRequiredValue('S3_BUCKET_NAME');
    const VERIFIED_SES_EMAIL_ADDRESS = configuration_provider_1.configurationProvider.getRequiredValue('VERIFIED_SES_EMAIL_ADDRESS');
    return {
        SQS_QUEUE_URL,
        FOREIGNS_TABLE_NAME,
        USERS_TABLE_NAME,
        GMAIL_SENDER_EMAIL_USER,
        GMAIL_SENDER_EMAIL_PASSWORD,
        ADMIN_EMAILS,
        S3_ROLE_ARN,
        COGNITO_ROLE_ARN,
        AWS_COGNITO_USER_POOL_ID,
        SIGN_UP_ATTEMPTS_TABLE_NAME,
        DISABLE_PASSPORT_VALIDATION,
        TIME_BETWEEN_POLLS,
        BUCKET_NAME,
        APP_STATE_TABLE_NAME,
        VERIFIED_SES_EMAIL_ADDRESS,
    };
};
exports.GET_APP_RELEVANT_ENV = GET_APP_RELEVANT_ENV;
