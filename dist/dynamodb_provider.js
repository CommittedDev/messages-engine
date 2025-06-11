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
exports.DynamoDbProvider = exports.isErrorOfItemLimitSize = void 0;
const https_1 = __importDefault(require("https"));
const client_dynamodb_1 = require("@aws-sdk/client-dynamodb");
const utils_1 = require("./utils");
const util_dynamodb_1 = require("@aws-sdk/util-dynamodb");
const node_http_handler_1 = require("@smithy/node-http-handler");
const logger_1 = require("./logger");
const util_dynamodb_2 = require("@aws-sdk/util-dynamodb");
const getForeignerKey = (data) => {
    // This function should return a unique key for each foreigner
    // The key is nationalityCode_passport_num
    return `${data.General_details.nationalityCode}_${data.General_details.passport_num}`.toLowerCase();
};
let agent = new https_1.default.Agent({
    maxSockets: 25, // https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/node-configuring-maxsockets.html
});
const isErrorOfItemLimitSize = (error) => error.name === "ValidationException" &&
    error.message.includes("Item size has exceeded the maximum allowed size");
exports.isErrorOfItemLimitSize = isErrorOfItemLimitSize;
const getStartOfDayISOString = () => {
    const now = new Date();
    now.setHours(0, 0, 0, 0); // Set hours to 00:00:00.000
    return now.toISOString();
};
const getNowISOString = () => {
    const now = new Date();
    return now.toISOString();
};
const delay = (ms) => {
    return new Promise((resolve) => setTimeout(resolve, ms));
};
class DynamoDbProvider {
    constructor(args) {
        this.newDataCounters = {
            runs: 0,
            initial: 0,
            duplicate: 0,
            unique: 0,
            notValidStructure: 0,
            notValidArrival: 0,
            notValidInIsrael: 0,
            notValidPassportExpiry: 0,
            notValidLastVisaValidToDate: 0,
            totalNotValid: 0,
            valid: 0,
            deletedFromForeignsTable: 0,
            deletedFromUsersTable: 0,
        };
        this.initial = () => __awaiter(this, void 0, void 0, function* () {
            console.log("Initializing DynamoDB");
        });
        this.resetNewDataCounters = () => {
            Object.keys(this.newDataCounters).forEach((key) => {
                this.newDataCounters[key] = 0;
            });
        };
        this.setCounters = (val) => {
            this.newDataCounters = val;
        };
        this.addToCounter = (key, value) => {
            this.newDataCounters[key] = this.newDataCounters[key] + value;
        };
        this.insertForeignersData = (args) => __awaiter(this, void 0, void 0, function* () {
            const { logError } = args;
            try {
                this.addToCounter("runs", 1);
                if (!(0, utils_1.isForeignersDataArray)(args.data)) {
                    logError("Data is not an valid Foreigners Data");
                    this.addToCounter("notValidStructure", 1);
                    return;
                }
                const data = args.data.map((item) => (Object.assign({ foreign_key: getForeignerKey(item) }, item)));
                const originalDataLength = data.length;
                this.addToCounter("initial", originalDataLength);
                // Remove duplicated data
                const uniqueData = data.filter((item, index, self) => self.findIndex((t) => t.foreign_key === item.foreign_key) === index);
                const uniqueDataLength = uniqueData.length;
                this.addToCounter("duplicate", originalDataLength - uniqueDataLength);
                this.addToCounter("unique", uniqueData.length);
                const validData = uniqueData.filter((item) => {
                    const hasValidArrival = item.General_details.arrival != 0;
                    if (!hasValidArrival) {
                        this.addToCounter("notValidArrival", 1);
                    }
                    const hasValidInIsrael = item.General_details.in_israel == true;
                    if (!hasValidInIsrael) {
                        this.addToCounter("notValidInIsrael", 1);
                    }
                    const hasInvalidLastVisaValidToDate = item.Last_visa_details.valid_to != "0001-01-01T00:00:00";
                    if (!hasInvalidLastVisaValidToDate) {
                        this.addToCounter("notValidLastVisaValidToDate", 1);
                    }
                    const isValidPassportExpiry = this.disablePassportValidation ||
                        (Array.isArray(item.Passports) &&
                            item.Passports.some((passport) => {
                                return (passport.passport_num === item.General_details.passport_num &&
                                    passport.valid_until !== null &&
                                    new Date(passport.valid_until) >= new Date());
                            }));
                    if (!isValidPassportExpiry) {
                        this.addToCounter("notValidPassportExpiry", 1);
                    }
                    const isValid = hasValidArrival &&
                        hasValidInIsrael &&
                        hasInvalidLastVisaValidToDate &&
                        isValidPassportExpiry;
                    if (isValid) {
                        return true;
                    }
                    this.addToCounter("totalNotValid", 1);
                    return false;
                });
                // Divide the data into batches of BATCH_SIZE
                this.addToCounter("valid", validData.length);
                for (let i = 0; i < validData.length; i += DynamoDbProvider.WRITE_BATCH) {
                    const batch = validData.slice(i, i + DynamoDbProvider.WRITE_BATCH);
                    const buildCommand = (dataToUpload) => {
                        const putRequests = dataToUpload.map((item) => ({
                            PutRequest: {
                                Item: (0, util_dynamodb_2.marshall)(Object.assign(Object.assign({}, item), { updatedAt: getStartOfDayISOString(), updatedAtFullTime: getNowISOString(), source: args.source }), {
                                    removeUndefinedValues: false,
                                }),
                            },
                        }));
                        // Define the parameters for BatchWriteItem operation
                        const params = {
                            RequestItems: {
                                [this.foreignTableName]: putRequests,
                            },
                        };
                        const command = new client_dynamodb_1.BatchWriteItemCommand(params);
                        return command;
                    };
                    try {
                        // Perform the batch write operation
                        yield this.dynamodbClient.send(buildCommand(batch));
                    }
                    catch (error) {
                        if ((0, exports.isErrorOfItemLimitSize)(error)) {
                            // Seconde try to split the batch into two
                            const third = Math.floor(batch.length / 3);
                            const firstThird = batch.slice(0, third);
                            const secondThird = batch.slice(third, 2 * third);
                            const thirdThird = batch.slice(2 * third);
                            const uploadPart = (part) => __awaiter(this, void 0, void 0, function* () {
                                try {
                                    yield this.dynamodbClient.send(buildCommand(part));
                                }
                                catch (error) {
                                    if ((0, exports.isErrorOfItemLimitSize)(error)) {
                                        let firstHalfDataWithoutImages;
                                        firstHalfDataWithoutImages = part.map((item) => {
                                            return Object.assign(Object.assign({}, item), { General_details: Object.assign(Object.assign({}, item.General_details), { image: undefined }) });
                                        });
                                        try {
                                            yield this.dynamodbClient.send(buildCommand(firstHalfDataWithoutImages));
                                        }
                                        catch (error) {
                                            logError("Error inserting data even after removing image" +
                                                JSON.stringify(firstHalfDataWithoutImages || {}));
                                        }
                                    }
                                }
                            });
                            yield uploadPart(firstThird);
                            yield uploadPart(secondThird);
                            yield uploadPart(thirdThird);
                        }
                        else {
                            throw error;
                        }
                    }
                }
            }
            catch (error) {
                logError("Error inserting data:" + JSON.stringify(error));
                throw error;
            }
        });
        this.deleteOldItems = (args) => __awaiter(this, void 0, void 0, function* () {
            var _a;
            const startOfToday = getStartOfDayISOString();
            // Scan for items with updatedAt older than today
            const scanParams = {
                TableName: this.foreignTableName,
                FilterExpression: "updatedAt < :startOfToday",
                ExpressionAttributeValues: {
                    ":startOfToday": { S: startOfToday },
                },
            };
            let scanCommand = new client_dynamodb_1.ScanCommand(scanParams);
            let data;
            /**
             * Find all items to delete
             */
            do {
                data = yield this.dynamodbClient.send(scanCommand);
                console.log("Scanning for items to delete: " + ((_a = data.Items) === null || _a === void 0 ? void 0 : _a.length));
                if (data.Items && data.Items.length > 0) {
                    // We are deleting users without awaiting for the delete operation to complete
                    this.deleteUsers({
                        itemsFromForeignTable: data.Items.map((item) => (0, util_dynamodb_1.unmarshall)(item)),
                        onUserDeleting: args.onUserDeleting,
                    }).catch((err) => {
                        args.logError("Error deleting users from users table: " + JSON.stringify(err));
                    });
                    // We are deleting users without awaiting for the delete operation to complete
                    this.deleteRecordsFromForeignTable({ itemsToDelete: data.Items }).catch((err) => {
                        args.logError("Error deleting user from main table: " + JSON.stringify(err));
                    });
                    //  Delay to avoid exceeding write capacity
                    yield delay(350); // Delay to avoid exceeding write capacity
                }
                if (data.LastEvaluatedKey) {
                    scanParams.ExclusiveStartKey = data.LastEvaluatedKey;
                    scanCommand = new client_dynamodb_1.ScanCommand(scanParams);
                }
            } while (data.LastEvaluatedKey);
        });
        this.deleteRecordsFromForeignTable = (args) => __awaiter(this, void 0, void 0, function* () {
            const { itemsToDelete } = args;
            /**
             * Delete all items
             */
            for (let i = 0; i < itemsToDelete.length; i += DynamoDbProvider.WRITE_BATCH) {
                const batch = itemsToDelete.slice(i, i + DynamoDbProvider.WRITE_BATCH);
                const deleteRequests = batch.map((item) => ({
                    DeleteRequest: {
                        Key: {
                            ["foreign_key"]: item["foreign_key"],
                        },
                    },
                }));
                this.addToCounter("deletedFromForeignsTable", batch.length);
                const deleteParams = {
                    RequestItems: {
                        [this.foreignTableName]: deleteRequests,
                    },
                };
                const deleteCommand = new client_dynamodb_1.BatchWriteItemCommand(deleteParams);
                console.log("Deleting batch of items from DynamoDB: " +
                    deleteParams.RequestItems[this.foreignTableName].length);
                yield this.dynamodbClient.send(deleteCommand);
            }
        });
        this.getUsersByForeignKeys = (args) => __awaiter(this, void 0, void 0, function* () {
            const { foreignKeys, onChunkOfUsers } = args;
            const chunkSize = 100;
            let allUsers = [];
            // Function to process each chunk
            const processChunk = (chunk) => __awaiter(this, void 0, void 0, function* () {
                var _a;
                const params = {
                    RequestItems: {
                        [this.usersTableName]: {
                            Keys: chunk.map((keys) => ({
                                foreign_key: { S: keys },
                            })),
                            ProjectionExpression: "user_name, foreign_key, cognito_user_name",
                        },
                    },
                };
                const command = new client_dynamodb_1.BatchGetItemCommand(params);
                const response = yield this.dynamodbClient.send(command);
                const users = ((_a = response === null || response === void 0 ? void 0 : response.Responses) === null || _a === void 0 ? void 0 : _a[this.usersTableName]) || [];
                if (users.length > 0) {
                    const data = users.map((item) => (0, util_dynamodb_1.unmarshall)(item));
                    onChunkOfUsers(data);
                }
                allUsers = allUsers.concat(users);
            });
            // Split passport numbers into chunks and process each chunk
            for (let i = 0; i < foreignKeys.length; i += chunkSize) {
                const chunk = foreignKeys.slice(i, i + chunkSize);
                yield processChunk(chunk);
            }
            return allUsers;
        });
        this.deleteUsers = (args) => __awaiter(this, void 0, void 0, function* () {
            console.log("Deleting users from users table, based on deleting items from main table");
            const tableRecordToDelete = yield this.getUsersByForeignKeys({
                foreignKeys: args.itemsFromForeignTable.map((item) => item.foreign_key),
                onChunkOfUsers: (data) => {
                    data.forEach((userRecord) => {
                        args.onUserDeleting(Object.assign({}, userRecord));
                    });
                },
            });
            // Delete all items
            for (let i = 0; i < tableRecordToDelete.length; i += DynamoDbProvider.WRITE_BATCH) {
                const batch = tableRecordToDelete.slice(i, i + DynamoDbProvider.WRITE_BATCH);
                this.addToCounter("deletedFromUsersTable", batch.length);
                const deleteRequests = batch.map((item) => ({
                    DeleteRequest: {
                        Key: {
                            foreign_key: item["foreign_key"],
                        },
                    },
                }));
                const deleteParams = {
                    RequestItems: {
                        [this.usersTableName]: deleteRequests,
                    },
                };
                console.log("Deleting batch of items from users table: " +
                    deleteParams.RequestItems[this.usersTableName].length);
                const deleteCommand = new client_dynamodb_1.BatchWriteItemCommand(deleteParams);
                console.log("Deleting batch of items from DynamoDB: " +
                    deleteParams.RequestItems[this.usersTableName].length);
                yield this.dynamodbClient.send(deleteCommand);
            }
        });
        this.deleteSignUpAttempts = (foreignKey) => __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.dynamodbClient.send(new client_dynamodb_1.DeleteItemCommand({
                    TableName: this.signUpsTableName,
                    Key: {
                        foreign_key: { S: foreignKey },
                    },
                }));
                console.info("SignUpAttempt deleted successfully");
                return true;
            }
            catch (error) {
                console.error("Unable to delete FSignUpAttempt item. Error:" + JSON.stringify(error));
                return false;
            }
        });
        this.deleteForeign = (foreignKey) => __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.dynamodbClient.send(new client_dynamodb_1.DeleteItemCommand({
                    TableName: this.foreignTableName,
                    Key: {
                        foreign_key: { S: foreignKey },
                    },
                }));
                console.info("Foreign deleted successfully");
                return true;
            }
            catch (error) {
                console.error("Unable to delete Foreign item. Error:" + JSON.stringify(error));
                return false;
            }
        });
        this.deleteUser = (foreignKey) => __awaiter(this, void 0, void 0, function* () {
            try {
                yield this.dynamodbClient.send(new client_dynamodb_1.DeleteItemCommand({
                    TableName: this.usersTableName,
                    Key: {
                        foreign_key: { S: foreignKey },
                    },
                }));
                console.info("User deleted successfully");
                return true;
            }
            catch (error) {
                console.error("Unable to delete user item. Error:" + JSON.stringify(error));
                return false;
            }
        });
        this.getAppStateValueByKey = (key, customKey) => __awaiter(this, void 0, void 0, function* () {
            if (key == "custom" && !customKey) {
                throw new Error("customKey is required for custom");
            }
            const params = {
                TableName: this.appStateTableName,
                Key: {
                    id: { S: customKey || key },
                },
            };
            try {
                const data = yield this.dynamodbClient.send(new client_dynamodb_1.BatchGetItemCommand({
                    RequestItems: {
                        [this.appStateTableName]: {
                            Keys: [params.Key],
                        },
                    },
                }));
                if (data.Responses && data.Responses[this.appStateTableName]) {
                    const item = data.Responses[this.appStateTableName][0];
                    if (item) {
                        return item["value"]["S"];
                    }
                }
            }
            catch (error) {
                logger_1.logger.error("Error getting last file name: " + JSON.stringify(error));
            }
        });
        this.setAppStateValueByKey = (key, value, customKey) => __awaiter(this, void 0, void 0, function* () {
            if (key == "custom" && !customKey) {
                throw new Error("customKey is required for custom");
            }
            const params = {
                TableName: this.appStateTableName,
                Item: {
                    id: { S: customKey || key },
                    value: { S: value },
                },
            };
            try {
                yield this.dynamodbClient.send(new client_dynamodb_1.BatchWriteItemCommand({
                    RequestItems: {
                        [this.appStateTableName]: [
                            {
                                PutRequest: {
                                    Item: params.Item,
                                },
                            },
                        ],
                    },
                }));
            }
            catch (error) {
                logger_1.logger.error("Error setting last file name: " + JSON.stringify(error));
            }
        });
        this.setAppStateValuesByKey = (key, value, customKey, type, updateCounter, currentStatus, error) => __awaiter(this, void 0, void 0, function* () {
            if (key == "custom" && !customKey) {
                throw new Error("customKey is required for custom");
            }
            const item = {
                id: customKey || key,
                value: value,
                type: type || undefined,
                updateCounter: updateCounter !== undefined ? updateCounter : undefined,
                currentStatus: currentStatus || undefined,
                error: error || undefined,
            };
            // Use marshall to convert the item to DynamoDB format
            const marshalledItem = (0, util_dynamodb_2.marshall)(item, { removeUndefinedValues: true });
            const params = {
                TableName: this.appStateTableName,
                Item: marshalledItem,
            };
            try {
                yield this.dynamodbClient.send(new client_dynamodb_1.BatchWriteItemCommand({
                    RequestItems: {
                        [this.appStateTableName]: [
                            {
                                PutRequest: {
                                    Item: marshalledItem,
                                },
                            },
                        ],
                    },
                }));
            }
            catch (error) {
                logger_1.logger.error("Error setting app state value: " + JSON.stringify(error));
            }
        });
        /**
         * Upsert (updates or creates) a foreign record with the given foreignKey.
         *
         * @param foreignKey - The key to check in the foreign table.
         * @param data - The record data to update or insert.
         */
        this.upsertForeignRecord = (foreignKey, data) => __awaiter(this, void 0, void 0, function* () {
            try {
                const fullRecord = Object.assign(Object.assign({ foreign_key: foreignKey }, data), { updatedAt: getStartOfDayISOString(), updatedAtFullTime: getNowISOString() });
                const putParams = {
                    TableName: this.foreignTableName,
                    Item: (0, util_dynamodb_2.marshall)(fullRecord, { removeUndefinedValues: false }),
                };
                yield this.dynamodbClient.send(new client_dynamodb_1.PutItemCommand(putParams));
                console.log(`Foreign record with key ${foreignKey} upserted successfully.`);
            }
            catch (error) {
                console.error("Error upserting foreign record: " + JSON.stringify(error));
                throw error;
            }
        });
        this.foreignTableName = args.foreignTableName;
        this.usersTableName = args.usersTableName;
        this.signUpsTableName = args.signUpsTableName;
        this.disablePassportValidation = args.disablePassportValidation;
        this.appStateTableName = args.appStateTableName;
        this.dynamodbClient = new client_dynamodb_1.DynamoDBClient({
            region: "il-central-1",
            requestHandler: new node_http_handler_1.NodeHttpHandler({
                requestTimeout: 0,
                httpsAgent: agent,
            }),
        });
    }
}
exports.DynamoDbProvider = DynamoDbProvider;
DynamoDbProvider.WRITE_CAPACITY_PER_SECONDE = 50;
DynamoDbProvider.WRITE_BATCH = 25;
DynamoDbProvider.MAX_CONCURRENT_BATCHES = 5;
