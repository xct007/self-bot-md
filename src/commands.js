const { serialize } = require("./lib/serialize");
const config = require("../config.json");

exports.commands = async (sock, m) => {
	const Log = console.log;

	const prefix = config.prefix;
	const owner = config.owner;
	const mode = config.mode;
	const Debug = config.debug;

	try {
		if (m.type !== "notify") return;
		let msg = serialize(JSON.parse(JSON.stringify(m.messages[0])), sock);
		if (!msg.message) return;
		if (msg.key && msg.key.remoteJid === "status@broadcast") return;
		if (
			msg.type === "protocolMessage" ||
			msg.type === "senderKeyDistributionMessage" ||
			!msg.type ||
			msg.type === ""
		)
			return;

		let { body } = msg;

		const { pushName, isGroup, sender, from } = msg;
		const gcMeta = isGroup ? await sock.groupMetadata(from) : "";
		const gcName = isGroup ? gcMeta.subject : "";
		const isOwner = owner.includes(sender) || msg.isSelf;
		const name = pushName === undefined ? sender.split("@")[0] : pushName;

		if (mode == "self") {
			if (!isOwner) return;
		}

		const arg = body.substring(body.indexOf(" ") + 1);
		const args = body.trim().split(/ +/).slice(1);
		const text = args.join(" ");

		const isEval = body.startsWith("=>");
		const isExec = body.startsWith("$");

		// Evaluated
		if (isEval) {
			if (isOwner) {
				let evaled,
					text = arg,
					{ inspect } = require("util");
				try {
					if (text.endsWith("--sync")) {
						evaled = await eval(
							`(async () => { ${text.trim.replace("--sync", "")} })`
						);
						msg.reply(evaled);
					}
					evaled = await eval(text);
					if (typeof evaled !== "string") evaled = inspect(evaled);
					await sock.sendMessage(msg.from, { text: evaled }, { quoted: msg });
				} catch (e) {
					sock.sendMessage(msg.from, { text: String(e) }, { quoted: msg });
				}
			}
		}

		if (isExec) {
			if (isOwner) {
				const { exec } = require("child_process");
				exec(arg, async (err, stdout) => {
					if (err) msg.reply(err);
					if (stdout) msg.reply(stdout);
				});
			}
		}

		const msgType = msg.message.stickerMessage
			? "Sticker Message"
			: msg.message.imageMessage
			? "Image Message"
			: msg.message.videoMessage
			? "Video Message"
			: body;
		if (Debug) {
			if (isGroup) {
				Log(
					"===>".green +
						"\nDate : " +
						new Date().toLocaleString("id") +
						"\nFrom : " +
						`${name}`.brightWhite +
						"\nJid : " +
						sender +
						"\nGroup : " +
						`${gcName}`.brightWhite +
						"\nMessage: " +
						`${msgType}`.brightWhite +
						"\n<===".green
				);
			}
			if (!isGroup) {
				console.log(
					"===>".green +
						"\nDate : " +
						new Date().toLocaleString("id") +
						"\nFrom : " +
						`${name}`.brightWhite +
						"\nJid : " +
						sender +
						"\nMessage : " +
						`${msgType}`.brightWhite +
						"\n<===".green
				);
			}
		}

		const isCmd = body.startsWith(prefix);
		const CMD = body.replace(prefix, "").split(" ")[0]
			? body.replace(prefix, "").split(" ")[0]
			: body.replace(prefix, "");

		if (CMD.toLowerCase() == "menu") {
			console.log("[ RECEIVED ] UPTIME");
		}

		if (isCmd) {
			switch (CMD) {
				case "setfake":
					{
						const fs = require("fs");
						const genThumb = require("image-thumbnail");
						const { downloadMediaMessage } = require("@adiwajshing/baileys");

						let file = msg.quoted ? msg.quoted : msg,
							mime =
								(file.msg || file).message?.imageMessage?.mimetype ||
								file.mediaType ||
								"";
						if (!mime)
							return msg.reply(`Reply/Send the image with caption !${CMD}`);
						const buffer = await downloadMediaMessage(file, "buffer");
						const fakeThumb = await genThumb(buffer);
						fs.writeFileSync("../fake.jpeg", fakeThumb);
						return await sock.sendMessage(msg.from, {
							text: "Fake thumbail set !",
						});
					}
					break;
				case "setreal":
					{
						const fs = require("fs");
						const { downloadMediaMessage } = require("@adiwajshing/baileys");

						let file = msg.quoted ? msg.quoted : msg,
							mime =
								(file.msg || file).message?.imageMessage?.mimetype ||
								file.mediaType ||
								"";
						if (!mime)
							return msg.reply(`Reply/Send the image with caption !${CMD}`);
						const buffer = await downloadMediaMessage(file, "buffer");
						fs.writeFileSync("../real.jpeg", fakeThumb);
						return await sock.sendMessage(msg.from, {
							text: "Real image set !",
						});
					}
					break;
				case "send":
					{
						const fs = require("fs");
						if (!fs.existsSync("../thumbail/fake.jpeg")) {
							return msg.reply("Fake thumbnail not set!");
						} else if (!fs.existsSync("../thumbail/real.jpeg")) {
							return msg.reply("Real image not set!");
						}
						return await sock.sendMessage(
							msg.from,
							{
								image: fs.readFileSync("../thumbnail/real.jpeg"),
								jpegThumbnail: fs.readFileSync(
									"../thumbnail/fake.jpeg",
									"base64"
								),
							},
							{
								quoted: msg,
							}
						);
					}
					break;
			}
		}
	} catch (e) {
		console.log(e);
	}
};
