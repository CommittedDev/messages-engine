import { UserData } from "../types";
import { IObject } from "./types";

// const { STSClient, AssumeRoleCommand } = require("@aws-sdk/client-sts");
import { STSClient, AssumeRoleCommand } from "@aws-sdk/client-sts";

export const isForeignersDataArray = (data: IObject[]) => {
  return (
    data &&
    Array.isArray(data) &&
    data.length > 0 &&
    data[0].General_details &&
    data[0].General_details.passport_num &&
    data[0].Last_visa_details &&
    data[0].Last_visa_details.valid_to
  );
};

export function isNewerForeignerZipFile(
  currentFileName: string,
  prevFileName?: string
): boolean {
  if (!prevFileName) {
    return true;
  }
  // Extract dates from filenames
  const currentDate = extractDateFromForeignerZipFileFileName(currentFileName);
  const prevDate = extractDateFromForeignerZipFileFileName(prevFileName);

  // Compare dates
  return currentDate >= prevDate; // Newer file has a later date or equal and then we can continue the process
}

export function extractDateFromForeignerZipFileFileName(
  fileName: string
): Date {
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

export const getFormattedDateAndTimeOfToday = () => {
  const today = new Date();
  const date =
    today.getFullYear() + "-" + (today.getMonth() + 1) + "-" + today.getDate();
  const time =
    today.getHours() + ":" + today.getMinutes() + ":" + today.getSeconds();
  return date + " " + time;
};

export interface IAssumeRoleResponse {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken: string;
}

export async function assumeRole(
  roleArn: string,
  sessionName: string
): Promise<IAssumeRoleResponse> {
  const stsClient = new STSClient({ region: "il-central-1" });

  const command = new AssumeRoleCommand({
    RoleArn: roleArn,
    RoleSessionName: sessionName,
  });

  try {
    const response = await stsClient.send(command);
    const credentials: IAssumeRoleResponse = {
      accessKeyId: response.Credentials?.AccessKeyId || "",
      secretAccessKey: response.Credentials?.SecretAccessKey || "",
      sessionToken: response.Credentials?.SessionToken || "",
    };
    return credentials;
  } catch (error) {
    console.error("Error assuming role:" + JSON.stringify(error));
    throw error;
  }
}

export function safeParseString<T>(val?: string): T | undefined {
  try {
    if (!val || val === "" || val.trim() === "") {
      return undefined;
    }
    return JSON.parse(val);
  } catch (error) {
    return undefined;
  }
}

export const arrayRemoveDuplicates = (arr: any[]) => {
  return arr.filter((value, index) => arr.indexOf(value) === index);
};

export const parseDate = (dateStr: string): Date => {
  const [datePart, timePart] = dateStr.split(" ");
  const [day, month, year] = datePart.split("/");
  return new Date(`${year}-${month}-${day}T${timePart}`);
};

export const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

export function getForeignKey(msg_data: UserData): string | null {
  if (!msg_data) return null;

  const details = msg_data.General_details;

  if (!details?.nationalityCode || !details?.passport_num) return null;

  return `${details.nationalityCode}_${details.passport_num.toLowerCase()}`;
}
