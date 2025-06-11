export interface Notification {
  msg_type: "DELETE" | "UPSERT";
  msg_data: any[];
  msg_date: string;
}
export enum MessageType {
  DELETE = "DELETE",
  UPSERT = "UPSERT",
}

export enum AppStateStatus {
  RECEIVED = "received",
  NOT_RELEVANT = "not relevant",
  ERROR = "error",
  PASS_TO_DELETE = "pass to handle delete",
  PASS_TO_UPSERT = "pass to handle upsert",
}
