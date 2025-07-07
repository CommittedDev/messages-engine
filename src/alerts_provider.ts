import { configurationProvider } from "./configuration_provider";
import { dynamoDbProvider } from "./dynamodb-provider/dynamodb_provider";
import { logger } from "./logger";
import { mailProvider } from "./mail_provider";
import { IEmailMessage } from "./types";
export interface AlertMessage {
  type: "error" | "summary";
  content: string;
}

export class AlertsProvider {
  listAddressEmail: string[] = [];
  fromAddressEmail: string = "";
  fromAddressEmailPassword: string = "";
  constructor() {
    logger.info("AlertsProvider - initialized");
  }
  init = async ({
    listAddressEmail,
    fromAddressEmail,
    fromAddressEmailPassword,
  }: {
    listAddressEmail: string[];
    fromAddressEmail: string;
    fromAddressEmailPassword: string;
  }) => {
    try {
      this.listAddressEmail = listAddressEmail;
      this.fromAddressEmail = fromAddressEmail;
      this.fromAddressEmailPassword = fromAddressEmailPassword;
    } catch (error) {
      logger.error("AlertsProvider - init - error: " + JSON.stringify(error));
      throw error;
    }
  };
  createErrorMessage(errorDetails: string): AlertMessage {
    return {
      type: "error",
      content: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #D8000C; background-color: #FFD2D2; padding: 10px; border-radius: 5px;">
          <h2 style="margin: 0;">🚨 Error Alert On RabbitMq Service</h2>
          <p style="margin: 10px 0;">An error has occurred in the RabbitMQ Messages Engine:</p>
          <p style="font-weight: bold; margin: 10px 0;">${errorDetails}</p>
          <p style="color: #888; font-size: 0.9em; margin: 10px 0;">Please check the system logs for more details.</p>
        </div>
      `,
    };
  }

  async createSummaryMessage(): Promise<AlertMessage> {
    const dailySummary = await dynamoDbProvider.getMessageCounters();
    return {
      type: "summary",
      content: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6;">
          <h2 style="color: #4CAF50;">Daily Summary</h2>
          <p>Here is the summary of today's RabbitMQ Messages Engine activity:</p>
          <ul>
            <li><strong>Messages Processed Successfully:</strong> ${dailySummary.done}</li>
            <li><strong>Errors Encountered:</strong> ${dailySummary.error}</li>
            <li><strong>Messages Skipped:</strong> ${dailySummary.skipped}</li>
          </ul>
          <p style="color: #888;">Thank you for using our service!</p>
        </div>
      `,
    };
  }

  public sendAlertSummary = async (): Promise<void> => {
    try {
      const alertMessage = await this.createSummaryMessage();
      const emailMessage: IEmailMessage = {
        to: this.listAddressEmail,
        subject: "Daily Summary - RabbitMQ Messages Engine",
        content: alertMessage.content,
        tagName: "summary",
        files: undefined,
        from: this.fromAddressEmail,
      };
      await mailProvider.sendEmailByNodeMailer(
        emailMessage,
        this.fromAddressEmailPassword
      );
    } catch (error) {
      logger.error("Failed to send alert:" + error);
    }
  };
  public sendAlertError = async (error: string): Promise<void> => {
    try {
      const alertMessage = await this.createErrorMessage(error);
      const listAddressEmail = this.listAddressEmail;

      const emailMessage: IEmailMessage = {
        to: listAddressEmail,
        subject: "Error Alert - RabbitMQ Messages Engine",
        content: alertMessage.content,
        tagName: "error",
        files: undefined,
        from: this.fromAddressEmail,
      };
      await mailProvider.sendEmailByNodeMailer(
        emailMessage,
        this.fromAddressEmailPassword
      );
    } catch (error) {
      logger.error("Failed to send alert:" + error);
    }
  };
}

export const alertsProvider = new AlertsProvider();
