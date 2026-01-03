import hre from "hardhat";
const { run } = hre;
import * as fs from "fs";
import * as path from "path";

async function main() {
  console.log("🔍 Starting contract verification...\n");

  const network = process.env.HARDHAT_NETWORK || "polygonAmoy";
  
  const deploymentsDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(deploymentsDir)) {
    console.error("❌ No deployments directory found");
    return;
  }

  const files = fs.readdirSync(deploymentsDir);
  const deploymentFile = files.find(f => f.includes(network));
  
  if (!deploymentFile) {
    console.error("❌ No deployment file found for network:", network);
    return;
  }

  const deployment = JSON.parse(
    fs.readFileSync(path.join(deploymentsDir, deploymentFile), "utf-8")
  );

  console.log("📋 Verifying contracts from:", deploymentFile, "\n");

  // Verify WrappedTON Implementation
  console.log("1️⃣ Verifying WrappedTON...");
  try {
    await run("verify:verify", {
      address: deployment.wrappedTON,
      constructorArguments: []
    });
    console.log("✅ WrappedTON verified\n");
  } catch (error: any) {
    if (error.message.includes("Already Verified")) {
      console.log("✅ Already verified\n");
    } else {
      console.error("❌ Failed:", error.message, "\n");
    }
  }

  // Verify PolygonBridge Implementation
  console.log("2️⃣ Verifying PolygonBridge...");
  try {
    await run("verify:verify", {
      address: deployment.polygonBridge,
      constructorArguments: []
    });
    console.log("✅ PolygonBridge verified\n");
  } catch (error: any) {
    if (error.message.includes("Already Verified")) {
      console.log("✅ Already verified\n");
    } else {
      console.error("❌ Failed:", error.message, "\n");
    }
  }

  // Verify BridgeDAO Implementation
  console.log("3️⃣ Verifying BridgeDAO...");
  try {
    await run("verify:verify", {
      address: deployment.bridgeDAO,
      constructorArguments: []
    });
    console.log("✅ BridgeDAO verified\n");
  } catch (error: any) {
    if (error.message.includes("Already Verified")) {
      console.log("✅ Already verified\n");
    } else {
      console.error("❌ Failed:", error.message, "\n");
    }
  }

  console.log("🎉 Verification complete!\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  });
