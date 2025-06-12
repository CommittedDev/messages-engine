import nodemailer from "nodemailer";
import { IEmailMessage } from "./types";
import { logger } from "./logger";

class MailProvider {
  constructor() {}

  /*-------------sendEmailByNodeMailer - send email by nodemailer ---------------------*/
  async sendEmailByNodeMailer(message: IEmailMessage) {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_PASS,
      },
    });
    logger.info(
      "MailProvider - sendEmailByNodeMailer - Sending email via Nodemailer with the following options: " +
        JSON.stringify(message)
    );
    const mailOptions: {
      from?: string;
      to: string;
      subject: string;
      text: string;
      html: string;
      attachments?: Array<{
        filename: string;
        path: string;
        contentType: string;
      }>;
    } = {
      from: process.env.GMAIL_USER,
      to: message.to.join(", "),
      subject: message.subject,
      text: message.content,
      html: message.content,
    };
    if (message.files && message.files.length > 0) {
      mailOptions.attachments?.push({
        filename: "",
        path: message.files,
        contentType: "application/pdf",
      });
    }

    try {
      const info = await transporter.sendMail(mailOptions);
      logger.info(`Email sent successfully via Nodemailer: ${info.response}`);
      return true;
    } catch (error) {
      logger.error(`Error sending email via Nodemailer: ${error}`);
      return false;
    }
  }
}

export const mailProvider = new MailProvider();
