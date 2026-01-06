# Polygon ↔ TON Personal Bridge

A self-hosted bridge prototype for moving assets between Polygon and TON for personal use and experimentation.

> ⚠️ Disclaimer  
> This project is provided as open-source software for educational and self-hosted use only.  
> It does not operate a public bridge, custody user funds, or provide financial services.  
> Users are solely responsible for deploying and operating their own instances and assume all risks.

## Overview

This repository contains:

- **Polygon contracts** (Solidity, upgradeable) for locking native POL or ERC‑20 tokens and emitting bridging events.
- A **relayer service** (TypeScript/Node.js) that listens to Polygon events and triggers corresponding actions on the TON side (currently via a stubbed TON service).
- Scripts for **local testing**, **Polygon Amoy testnet deployment**, and **contract verification**.

It is designed for technically inclined users who want a transparent, self-controlled bridge between an EVM wallet (e.g. OKX, MetaMask) and a TON wallet (e.g. TonKeeper) for their own funds.

## Features

- One-way bridge path implemented: Polygon → TON (native TON payout logic stubbed, ready to plug into real TON SDKs).
- Upgradeable `PolygonBridge` and `WrappedTON` contracts on Polygon.
- Event-driven relayer:
  - Watches `BridgeInitiated` events on Polygon.
  - Reads on-chain transfer state.
  - Simulates native TON transfers.
  - Calls `confirmTransfer` on Polygon when TON side is considered complete.
- Local Hardhat environment:
  - Local deployment script.
  - Local bridge smoke test script.
- Polygon Amoy support:
  - Deployment script.
  - Etherscan/Polygonscan verification script.

## Architecture

- **Polygon contracts**
  - `WrappedTON`: upgradeable ERC‑20 used as a wrapped representation on Polygon.
  - `PolygonBridge`: upgradeable bridge contract that:
    - Holds bridged assets.
    - Emits `BridgeInitiated`, `BridgeConfirmed`, `BridgeCompleted`.
    - Tracks per‑transfer state and relayer confirmations.

- **Relayer service**
  - Written in TypeScript, runs as a Node.js process.
  - Connects to Polygon Amoy (or mainnet) via JSON‑RPC.
  - Subscribes to `BridgeInitiated` logs from `PolygonBridge`.
  - Uses a pluggable TON service module (`tonService.ts`) to handle TON‑side actions.

- **TON side (work in progress)**
  - Currently a stubbed native TON transfer module for development.
  - Intended to be replaced by a real TON wallet/SDK integration that sends native TON to the `tonRecipient`.

## Intended Use

- Personal bridging of assets where **you**:
  - Deploy and own the Polygon contracts.
  - Run the relayer with your own private keys and RPC endpoints.
  - Integrate a TON wallet or service of your choice.

- Example personal workflow:
  - Receive MYST or POL on Polygon from your own nodes/wallets.
  - Use this bridge to move value to your TonKeeper wallet.
  - Trade on TON-native platforms (e.g. StormTrade) using your own funds.

This project is **not** a hosted or shared bridge; each user should deploy their own instance.

## Status

🚧 Active Development – Experimental, unaudited, and **not** production-ready.

- Contract logic and relayer behavior may change.
- No formal security review has been performed.
- Use only with amounts you can afford to lose.

## License

MIT
