export interface Notification {
  msg_type: "DELETE" | "UPSERT";
  msg_data: any[];
  msg_date: string;
}
export enum MessageType {
  DELETE = "DELETE",
  UPSERT = "UPSERT",
}
export enum MessageStatus {
  SKIPPED = "skipped",
  SUCCESS = "success",
  FAILED = "failed",
}
export enum AppStateStatus {
  RECEIVED = "received",
  NOT_RELEVANT = "not relevant",
  ERROR = "error",
  PASS_TO_DELETE = "pass to handle delete",
  PASS_TO_UPSERT = "pass to handle upsert",
}
export interface UserData {
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
export interface Message {
  msg_id: string;
  msg_ver: number;
  msg_type: string;
  msg_date: string;
  msg_hash: string | null;
  msg_data: UserData[];
}
