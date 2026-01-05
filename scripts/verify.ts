// scripts/verify.ts
import hre from "hardhat";
const { run } = hre;
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

async function main() {
  console.log("🔍 Starting contract verification...\n");

  const network = process.env.HARDHAT_NETWORK || hre.network.name;

  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  const deploymentsDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(deploymentsDir)) {
    throw new Error("No deployments directory found");
  }

  const deploymentFile = fs
    .readdirSync(deploymentsDir)
    .find((f) => f.includes(network));

  if (!deploymentFile) {
    throw new Error(`No deployment file found for network: ${network}`);
  }

  const deploymentPath = path.join(deploymentsDir, deploymentFile);
  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf-8"));

  console.log(`📄 Using deployment file: ${deploymentFile}\n`);

  if (deployment.wrappedTON) {
    console.log("1️⃣ Verifying WrappedTON implementation:", deployment.wrappedTON);
    try {
      await run("verify:verify", {
        address: deployment.wrappedTON,
        constructorArguments: [],
      });
      console.log("✅ WrappedTON implementation verified\n");
    } catch (e: any) {
      console.error("❌ WrappedTON verify failed:", e.message);
    }
  }

  if (deployment.polygonBridge) {
    console.log(
      "2️⃣ Verifying PolygonBridge implementation:",
      deployment.polygonBridge
    );
    try {
      await run("verify:verify", {
        address: deployment.polygonBridge,
        constructorArguments: [],
      });
      console.log("✅ PolygonBridge implementation verified\n");
    } catch (e: any) {
      console.error("❌ PolygonBridge verify failed:", e.message);
    }
  }

  console.log("🎉 Verification script finished.\n");
}

main().catch((err) => {
  console.error("❌ Error in verify script:", err);
  process.exit(1);
});
