import { WebSocketServer } from "ws";

const wss = new WebSocketServer({ port: process.env.PORT || 3000 });

const rooms = new Map();
/*
rooms = {
  roomId: {
    clients: Set(ws),
    host: ws,
    lastState: { type, time, url }
  }
}
*/

wss.on("connection", ws => {

    ws.on("message", msg => {
        let data;
        try {
            data = JSON.parse(msg);
        } catch {
            return;
        }

        const { type, room, name } = data;

        // 🔹 JOIN
        if (type === "join") {
            if (!rooms.has(room)) {
                rooms.set(room, {
                    clients: new Set(),
                    host: null,
                    lastState: null
                });
            }

            const r = rooms.get(room);
            ws.room = room;
            ws.name = name;

            r.clients.add(ws);
            if (data.host) r.host = ws;

            // mevcut state yeni gelene gönder
            if (r.lastState) {
                ws.send(JSON.stringify(r.lastState));
            }

            broadcast(room, {
                type: "system",
                text: `${name} odaya katıldı`
            });
        }

        // 🔹 STATE (play / pause / seek / load)
        if (["play", "pause", "seek", "load", "sync"].includes(type)) {
            const r = rooms.get(ws.room);
            if (!r) return;

            // son state sakla
            r.lastState = data;

            broadcast(ws.room, data, ws);
        }

        // 🔹 CHAT
        if (type === "chat") {
            broadcast(ws.room, data);
        }
    });

    ws.on("close", () => {
        const room = ws.room;
        if (!room || !rooms.has(room)) return;

        const r = rooms.get(room);
        r.clients.delete(ws);

        broadcast(room, {
            type: "system",
            text: `${ws.name} ayrıldı`
        });

        if (r.clients.size === 0) {
            rooms.delete(room);
        }
    });
});

function broadcast(room, data, except = null) {
    const r = rooms.get(room);
    if (!r) return;

    r.clients.forEach(c => {
        if (c !== except && c.readyState === 1) {
            c.send(JSON.stringify(data));
        }
    });
}

console.log("✅ WebSocket server çalışıyor");
