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
exports.processUpdateForeignUsers = processUpdateForeignUsers;
function processUpdateForeignUsers(data, dynamodbProvider) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        for (const record of data) {
            const foreignKey = `${(_a = record.General_details) === null || _a === void 0 ? void 0 : _a.nationalityCode}_${(_b = record.General_details) === null || _b === void 0 ? void 0 : _b.passport_num.toLowerCase()}`;
            if (foreignKey) {
                yield dynamodbProvider.upsertForeignRecord(foreignKey, record);
            }
        }
    });
}
