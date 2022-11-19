const Pino = require("pino");

const { Boom } = require("@hapi/boom");

const {
	default: makeWASocket,
	delay,
	DisconnectReason,
	fetchLatestBaileysVersion,
	makeInMemoryStore,
	useMultiFileAuthState,
	isJidBroadcast,
	jidNormalizedUser,
	makeCacheableSignalKeyStore,
} = require("@adiwajshing/baileys");

const { commands } = require("./src/commands");

const colors = require("colors");
colors.enable();

const logger = Pino().child({ level: "silent", stream: "store" });
const store = makeInMemoryStore({ logger });

store?.readFromFile(`data.store.json`);

setInterval(() => {
	store?.writeToFile(`data.store.json`);
}, 10_000);

const connect = async () => {
	const Log = console.log;

	// TODO
	// MONGODB
	let { state, saveCreds } = await useMultiFileAuthState("./session");

	let { version } = await fetchLatestBaileysVersion();

	const sock = makeWASocket({
		version,
		printQRInTerminal: true,
		logger: Pino({ level: "silent" }),
		auth: {
			creds: state.creds,
			keys: state.keys,
		},
		generateHighQualityLinkPreview: true,
		syncFullHistory: true,
	});

	//store?.bind(sock.ev)

	Log("Connection Status : " + "Connecting");
	sock.ev.process(async (events) => {
		if (events["connection.update"]) {
			const update = events["connection.update"];
			const { connection, lastDisconnect } = update;
			const reason = new Boom(lastDisconnect?.error)?.output.statusCode;
			if (connection == "close") {
				if (reason !== DisconnectReason.loggedOut) {
					connect();
				} else {
					Log("Connection closed. You are logged out".red);
				}
			}
			if (connection == "open") {
				Log("Connection Status : " + "Connected!".green);
			}
		}

		if (events["creds.update"]) {
			await saveCreds();
		}

		if (events.call) {
			Log("Received call !!");
		}

		if (events["messages.upsert"]) {
			const upsert = events["messages.upsert"];
			if (upsert.type == "notify") {
				await commands(sock, upsert);
			}
		}
	});
	if (sock.user && sock.user?.id)
		sock.user.jid = jidNormalizedUser(sock.user?.id);

	return sock;
};
connect();
