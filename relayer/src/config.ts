// relayer/src/config.ts
import dotenv from "dotenv";
import path from "path";

// Load the ROOT .env (one level above /relayer) [web:278][web:280]
dotenv.config({ path: path.join(__dirname, "..", "..", ".env") });

export const POLYGON_RPC =
    process.env.POLYGON_AMOY_RPC_URL || "https://rpc-amoy.polygon.technology";

export const BRIDGE_ADDRESS =
    process.env.POLYGON_BRIDGE_AMOY ||
    "0x0855Ea23Bdec73dE3741F3A34259DCb8b400930B"; // your Amoy PolygonBridge proxy

export const RELAYER_PRIVATE_KEY = process.env.PRIVATE_KEY || "";

// polling interval in ms
export const POLL_INTERVAL = 10_000;
