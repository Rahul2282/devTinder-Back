import { MailtrapClient } from "mailtrap";
import dotenv from "dotenv";

dotenv.config();

export const mailtrapClient = new MailtrapClient({
	// endpoint: process.env.MAILTRAP_ENDPOINT,
	token: process.env.MAILTRAP_TOKEN,
	// testInboxId: process.env.MAILTRAP_ID,
});

export const  sender = {
	email: "hello@demomailtrap.co",
	name: "Mailtrap Test",
  };

