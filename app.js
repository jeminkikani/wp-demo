const express = require("express");
const makeWASocket = require("@whiskeysockets/baileys").default;
const { useMultiFileAuthState } = require("@whiskeysockets/baileys");
const QRCode = require("qrcode");

const app = express();
const PORT = 3000;

let qrCodeUrl = "";
let sock;

// Function to start WhatsApp session
async function startWhatsApp() {
    try {
        const { state, saveCreds } = await useMultiFileAuthState("./sessions");

        sock = makeWASocket({
            auth: state,
            browser: ["Clicfly AI", "Chrome", "120.0"],
            printQRInTerminal: true, // Show QR in terminal
        });

        // Generate and store QR Code
        sock.ev.on("connection.update", async ({ qr, connection }) => {
            if (qr) {
                console.log("New QR Code generated!");
                qrCodeUrl = await QRCode.toDataURL(qr);
            }
            if (connection === "open") {
                console.log("WhatsApp Connected!");
                qrCodeUrl = ""; // Clear QR after connection
            }
        });

        sock.ev.on("creds.update", saveCreds);
    } catch (error) {
        console.error("Error starting WhatsApp:", error);
    }
}

// API route to get QR code
app.get("/qr", (req, res) => {
    if (qrCodeUrl) {
        res.send(<img src="${qrCodeUrl}" alt="Scan QR Code" />);
    } else {
        res.send("QR Code not available or already scanned.");
    }
});

// Start the server and WhatsApp session
app.listen(PORT, async () => {
    console.log(`Server running on http://localhost:${PORT}`);
    await startWhatsApp();
});
