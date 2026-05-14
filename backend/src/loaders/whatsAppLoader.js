import WhatsAppUtils from "../utils/whatsAppUtils.js";

export const initWhatsApp = () => {
    return new WhatsAppUtils({
        token: process.env.WHATSAPP_TOKEN,
        phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
        verifyToken: process.env.WHATSAPP_VERIFY_TOKEN,
        apiVersion: process.env.WHATSAPP_API_VERSION
    });
};
