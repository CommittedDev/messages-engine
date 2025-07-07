export type IObject = { [key: string]: any };

export interface IUserRecord {
  // User in Users Table that created by cognito/lambda-container/post-sign-up/index.mjs
  user_name: string;
  passport_num: string;
  nationality_code: string;
  foreign_key: string;
  visa_expiry: string;
  arrival: string;
  email: string | undefined;
  phone_number: string | undefined;
  createdAt: string;
  version: string;
  cognito_user_name: string;
  cognito_pool: string;
}

export interface IForeignTableRecord {
  // Full Interface can be found in server/src/services/users/user.types.ts
  foreign_key: string;
  General_details: {
    nationality: string;
    nationalityCode: string;
    in_israel: boolean;
    passport_num: string;
    arrival: number;
  };
  Last_visa_details: {
    valid_to: string;
  };
  Passports: {
    passport_num: string;
    valid_until: string | number | null;
  }[];
}

export interface IForeignerZipProcessResult {
  adminLogs: string[];
  allContentIsUploaded: Boolean;
  oldDataDeleted: Boolean;
  zipFileDeleted: Boolean;
  zip2DaysAgoFileDeleted: Boolean;
  processDone: Boolean;
  cognitoUsersIsDeleted: false;
  lastJSONFileName?: string;
  failedFiles: string[];
  metaDataFile?: IObject;
  dataCounters?: IObject;
}

export interface ICurrentForeignersFileInfo {
  fileName: string;
  timestamp: string;
  severalAttempts: number;
  processResult?: IForeignerZipProcessResult;
  version: string;
  history?: string[];
}

export interface IDepositsFileInfo {
  fileName: string;
  timestamp: string;
  severalAttempts: number;
  version: string;
  isDone: boolean;
  failedFiles: string[];
  lastPdfFileName?: string;
}
export interface IDepositsFilesInfo {
  [fileName: string]: IDepositsFileInfo;
}

export interface IUploadZipFileResult {
  isDone: boolean;
  failedFiles: string[];
  lastFileName?: string;
  error?: string;
}

export interface IEmailMessage {
  to: string[];
  subject: string;
  content: string;
  attachments?: [{ fileId: string }];
  tagName: string;
  files?: string;
  from?: string; // Optional, if not provided, will use the default email address
}
