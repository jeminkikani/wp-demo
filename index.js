const express = require("express");
const {
    default: makeWASocket,
    useMultiFileAuthState,
} = require("@whiskeysockets/baileys");
const QRCode = require("qrcode");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");

const app = express();
const PORT = 3000;
app.set("view engine", "ejs");
app.use(express.urlencoded({ extended: true }));

let sessions = {}; // Store active sessions

// Function to start a new WhatsApp session
async function startWhatsApp(sessionId, res) {
    try {
        const sessionPath = `./sessions/${sessionId}`;
        if (!fs.existsSync(sessionPath))
            fs.mkdirSync(sessionPath, { recursive: true });

        const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

        const sock = makeWASocket({
            auth: state,
            browser: ["Clicfly AI", "Chrome", "120.0"],
            printQRInTerminal: true,
        });

        sessions[sessionId] = { sock, qrCodeUrl: "" };

        sock.ev.on(
            "connection.update",
            async ({ connection, lastDisconnect }) => {
                if (connection === "open") {
                    console.log(`✅ WhatsApp Connected: ${sessionId}`);
                    sessions[sessionId].qrCodeUrl = "";
                } else if (connection === "close") {
                    const shouldReconnect =
                        lastDisconnect?.error?.output?.statusCode !== 401;
                    console.log(
                        `⚠️ Connection closed. Reconnecting: ${shouldReconnect}`
                    );

                    if (shouldReconnect) {
                        delete sessions[sessionId];
                        startWhatsApp(sessionId);
                    }
                }
            }
        );


        sock.ev.on("creds.update", saveCreds);

        if (res) {
            res.redirect("/");
        }
    } catch (error) {
        console.error("Error starting WhatsApp:", error);
    }
}

// Route to get QR codes
app.get("/qr/:sessionId", (req, res) => {
    const { sessionId } = req.params;
    const session = sessions[sessionId];
    if (session && session.qrCodeUrl) {
        res.send(`<img src="${session.qrCodeUrl}" alt="Scan QR Code" />`);
    } else {
        res.send("QR Code not available or already scanned.");
    }
});

// Route to send a message
app.post("/send", async (req, res) => {
    const { sessionId, number, message } = req.body;
    if (!sessions[sessionId]) return res.status(400).send("Invalid session.");

    try {
        const sock = sessions[sessionId].sock;
        await sock.sendMessage(`${number}@s.whatsapp.net`, { text: message });
        res.send("Message sent successfully!");
    } catch (error) {
        res.status(500).send("Failed to send message: " + error);
    }
});

// Homepage to list all sessions
app.get("/", (req, res) => {
    res.render("index", { sessions: Object.keys(sessions) });
});

// Route to create a new session
app.post("/new-session", (req, res) => {
    const phoneNumber = req.body.phoneNumber;
    const sessionId = `${uuidv4()}-${phoneNumber}`;
    startWhatsApp(sessionId, res);
});

// Start the server
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});
