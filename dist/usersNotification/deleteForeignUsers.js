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
Object.defineProperty(exports, "__esModule", { value: true });
exports.processDeleteForeignUsers = processDeleteForeignUsers;
function processDeleteForeignUsers(data, cognitoProvider, dynamoDBProvider) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        if (!data || !Array.isArray(data)) {
            console.error("Invalid data structure: 'msg_data' array not found.");
            return;
        }
        for (const record of data) {
            const foreignKey = `${(_a = record.General_details) === null || _a === void 0 ? void 0 : _a.nationalityCode}_${(_b = record.General_details) === null || _b === void 0 ? void 0 : _b.passport_num.toLowerCase()}`;
            if (foreignKey) {
                try {
                    // Get user details from users table using the foreignKey
                    const usersFound = yield dynamoDBProvider.getUsersByForeignKeys({
                        foreignKeys: [foreignKey],
                        onChunkOfUsers: () => { },
                    });
                    // Proceed to delete records from the foreign table
                    try {
                        yield dynamoDBProvider.deleteForeign(foreignKey);
                    }
                    catch (error) {
                        console.error(`Error deleting foreign record for passport ${foreignKey}: `, error);
                    }
                    if (usersFound.length > 0) {
                        // Use cognito_user_name from the returned record(s) for deletion in Cognito
                        const cognitoUserName = usersFound[0].cognito_user_name;
                        try {
                            yield cognitoProvider.deleteUser(cognitoUserName.S);
                        }
                        catch (error) {
                            console.error(`Error deleting Cognito user for cognito_user_name ${cognitoUserName}: `, error);
                        }
                        // Proceed to delete the user record from DynamoDB
                        try {
                            yield dynamoDBProvider.deleteUser(foreignKey);
                        }
                        catch (error) {
                            console.error(`Error deleting user record for passport ${foreignKey}: `, error);
                        }
                    }
                    else {
                        console.warn(`User with passport ${foreignKey} does not exist in the users table.`);
                    }
                }
                catch (error) {
                    console.error(`Error checking existence of user for passport ${foreignKey}: `, error);
                }
            }
            else {
                console.warn("Passport number not found in record:", record);
            }
        }
    });
}
