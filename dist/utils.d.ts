import { IObject } from "./types";
export declare const isForeignersDataArray: (data: IObject[]) => any;
export declare function isNewerForeignerZipFile(currentFileName: string, prevFileName?: string): boolean;
export declare function extractDateFromForeignerZipFileFileName(fileName: string): Date;
export declare const getFormattedDateAndTimeOfToday: () => string;
export interface IAssumeRoleResponse {
    accessKeyId: string;
    secretAccessKey: string;
    sessionToken: string;
}
export declare function assumeRole(roleArn: string, sessionName: string): Promise<IAssumeRoleResponse>;
export declare function safeParseString<T>(val?: string): T | undefined;
export declare const arrayRemoveDuplicates: (arr: any[]) => any[];
export declare const delay: (ms: number) => Promise<unknown>;
//# sourceMappingURL=utils.d.ts.map