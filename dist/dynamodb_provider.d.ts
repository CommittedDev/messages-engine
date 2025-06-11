import { IObject, IUserRecord } from "../types";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
type AppStateKeys =
  | "lastFileName"
  | "currentProcessFileName"
  | "depositsFiles"
  | "custom";
export declare const isErrorOfItemLimitSize: (error: any) => any;
export declare class DynamoDbProvider {
  foreignTableName: string;
  usersTableName: string;
  signUpsTableName: string;
  appStateTableName: string;
  disablePassportValidation: boolean;
  dynamodbClient: DynamoDBClient;
  newDataCounters: {
    [key: string]: number;
  };
  static WRITE_CAPACITY_PER_SECONDE: number;
  static WRITE_BATCH: number;
  static MAX_CONCURRENT_BATCHES: number;
  constructor(args: {
    foreignTableName: string;
    usersTableName: string;
    signUpsTableName: string;
    appStateTableName: string;
    disablePassportValidation: boolean;
  });
  initial: () => Promise<void>;
  resetNewDataCounters: () => void;
  setCounters: (val: IObject) => void;
  addToCounter: (
    key:
      | "runs"
      | "initial"
      | "duplicate"
      | "unique"
      | "notValidStructure"
      | "notValidArrival"
      | "notValidPassportExpiry"
      | "notValidInIsrael"
      | "notValidLastVisaValidToDate"
      | "totalNotValid"
      | "valid"
      | "deletedFromForeignsTable"
      | "deletedFromUsersTable",
    value: number
  ) => void;
  insertForeignersData: (args: {
    data: IObject[];
    logError: (val: string) => void;
    source: string;
  }) => Promise<void>;
  deleteOldItems: (args: {
    onUserDeleting: (record: IUserRecord) => Promise<void>;
    logError: (val: string) => void;
  }) => Promise<void>;
  deleteRecordsFromForeignTable: (args: {
    itemsToDelete: any[];
  }) => Promise<void>;
  getUsersByForeignKeys: (args: {
    foreignKeys: string[];
    onChunkOfUsers: (data: IUserRecord[]) => void;
  }) => Promise<
    {
      user_name: {
        S: string;
      };
      foreign_key: {
        S: string;
      };
      cognito_user_name: {
        S: string;
      };
    }[]
  >;
  private deleteUsers;
  deleteSignUpAttempts: (foreignKey: string) => Promise<boolean>;
  deleteForeign: (foreignKey: string) => Promise<boolean>;
  deleteUser: (foreignKey: string) => Promise<boolean>;
  getAppStateValueByKey: (
    key: AppStateKeys,
    customKey?: string
  ) => Promise<string | undefined>;
  setAppStateValueByKey: (
    key: AppStateKeys,
    value: string,
    customKey?: string
  ) => Promise<void>;
  setAppStateValuesByKey: (
    key: AppStateKeys,
    value: string,
    customKey?: string,
    type?: string,
    updateCounter?: number,
    currentStatus?: string,
    error?: string
  ) => Promise<void>;
  /**
   * Upsert (updates or creates) a foreign record with the given foreignKey.
   *
   * @param foreignKey - The key to check in the foreign table.
   * @param data - The record data to update or insert.
   */
  upsertForeignRecord: (foreignKey: string, data: IObject) => Promise<void>;
}
export {};
//# sourceMappingURL=dynamodb_provider.d.ts.map
