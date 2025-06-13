import Mailjet from "node-mailjet";
import { config } from "./config";
import { logger } from "./logger";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const mailjet = new Mailjet({
    apiKey: config.MJ_APIKEY_PUBLIC,
    apiSecret: config. MJ_APIKEY_PRIVATE
});

export async function Mailer(email: String, otp:String) {
    try {
        const request = await mailjet
            .post("send", { version: "v3.1" })
            .request({
                Messages: [
                    {
                        From: {
                            Email: 'bugkhoji@gmail.com',
                            Name: "Bugkhoji"
                        },
                        To: [
                            {
                                Email: email
                            }
                        ],
                        Subject: "Your OTP Code for Bugkhoji",
                        TextPart: `Your OTP Code is ${otp}. It will expire in 5 minutes.`,
                        HTMLPart: `
                            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                                <h2 style="color: #333;">Your OTP Code</h2>
                                <p>Your OTP Code is: <strong style="color: #007bff; font-size: 18px;">${otp}</strong></p>
                                <p style="color: #666;">This code will expire in 5 minutes.</p>
                                <p style="color: #999; font-size: 12px;">If you didn't request this code, please ignore this email.</p>
                            </div>
                        `
                    }
                ]
            });

        logger.info("Email sent successfully", { 
            email: email, 
        });
        
        return {
            success: true,
        };

    } catch (error) {
        logger.error("Error sending email with Mailjet", {
            error: error instanceof Error ? error.message : String(error),
            email: email,
            stack: error instanceof Error ? error.stack : undefined
        });
        
        return {
            success: false,
            error: error instanceof Error ? error.message : String(error)
        };
    }
}