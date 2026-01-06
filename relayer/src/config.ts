// relayer/src/config.ts
import dotenv from "dotenv";
import path from "path";

// Load the ROOT .env (one level above /relayer)
dotenv.config({ path: path.join(__dirname, "..", "..", ".env") });

// Polygon Amoy RPC (on‑chain network)
export const POLYGON_RPC =
    process.env.POLYGON_AMOY_RPC_URL || "https://rpc-amoy.polygon.technology";

// Deployed PolygonBridge proxy on Amoy
export const BRIDGE_ADDRESS =
    process.env.BRIDGE_ADDRESS_AMOY ||
    "0x0855Ea23Bdec73dE3741F3A34259DCb8b400930B"; // your Amoy PolygonBridge proxy

// Relayer EVM private key
export const RELAYER_PRIVATE_KEY = process.env.PRIVATE_KEY || "";

// Optional: starting block (can be set in .env: RELAYER_START_BLOCK=31821900)
const START_BLOCK_ENV = process.env.RELAYER_START_BLOCK
    ? parseInt(process.env.RELAYER_START_BLOCK, 10)
    : NaN;

// If RELAYER_START_BLOCK not set or invalid, the relayer will start from "latest" on first run.
export const RELAYER_START_BLOCK = Number.isNaN(START_BLOCK_ENV)
    ? undefined
    : START_BLOCK_ENV;

// Polling interval in ms
export const POLL_INTERVAL = 10_000;
