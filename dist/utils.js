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
exports.delay = exports.arrayRemoveDuplicates = exports.getFormattedDateAndTimeOfToday = exports.isForeignersDataArray = void 0;
exports.isNewerForeignerZipFile = isNewerForeignerZipFile;
exports.extractDateFromForeignerZipFileFileName = extractDateFromForeignerZipFileFileName;
exports.assumeRole = assumeRole;
exports.safeParseString = safeParseString;
// const { STSClient, AssumeRoleCommand } = require("@aws-sdk/client-sts");
const client_sts_1 = require("@aws-sdk/client-sts");
const isForeignersDataArray = (data) => {
    return (data &&
        Array.isArray(data) &&
        data.length > 0 &&
        data[0].General_details &&
        data[0].General_details.passport_num &&
        data[0].Last_visa_details &&
        data[0].Last_visa_details.valid_to);
};
exports.isForeignersDataArray = isForeignersDataArray;
function isNewerForeignerZipFile(currentFileName, prevFileName) {
    if (!prevFileName) {
        return true;
    }
    // Extract dates from filenames
    const currentDate = extractDateFromForeignerZipFileFileName(currentFileName);
    const prevDate = extractDateFromForeignerZipFileFileName(prevFileName);
    // Compare dates
    return currentDate >= prevDate; // Newer file has a later date or equal and then we can continue the process
}
function extractDateFromForeignerZipFileFileName(fileName) {
    const regex = /_(\d{8})\.zip$/;
    const match = fileName.match(regex);
    if (!match) {
        throw new Error("Invalid file name format");
    }
    const dateString = match[1];
    const year = parseInt(dateString.slice(0, 4));
    const month = parseInt(dateString.slice(4, 6)) - 1; // Month is 0-indexed in JavaScript Date
    const day = parseInt(dateString.slice(6, 8));
    return new Date(year, month, day);
}
const getFormattedDateAndTimeOfToday = () => {
    const today = new Date();
    const date = today.getFullYear() + "-" + (today.getMonth() + 1) + "-" + today.getDate();
    const time = today.getHours() + ":" + today.getMinutes() + ":" + today.getSeconds();
    return date + " " + time;
};
exports.getFormattedDateAndTimeOfToday = getFormattedDateAndTimeOfToday;
function assumeRole(roleArn, sessionName) {
    return __awaiter(this, void 0, void 0, function* () {
        const stsClient = new client_sts_1.STSClient({ region: "il-central-1" });
        const command = new client_sts_1.AssumeRoleCommand({
            RoleArn: roleArn,
            RoleSessionName: sessionName,
        });
        try {
            const response = yield stsClient.send(command);
            const credentials = {
                accessKeyId: response.Credentials.AccessKeyId,
                secretAccessKey: response.Credentials.SecretAccessKey,
                sessionToken: response.Credentials.SessionToken,
            };
            return credentials;
        }
        catch (error) {
            console.error("Error assuming role:" + JSON.stringify(error));
            throw error;
        }
    });
}
function safeParseString(val) {
    try {
        if (!val || val === "" || val.trim() === "") {
            return undefined;
        }
        return JSON.parse(val);
    }
    catch (error) {
        return undefined;
    }
}
const arrayRemoveDuplicates = (arr) => {
    return arr.filter((value, index) => arr.indexOf(value) === index);
};
exports.arrayRemoveDuplicates = arrayRemoveDuplicates;
const delay = (ms) => new Promise((res) => setTimeout(res, ms));
exports.delay = delay;
