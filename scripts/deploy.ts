import { ethers, upgrades } from "hardhat";
import * as fs from "fs";
import * as path from "path";

interface DeploymentAddresses {
  wrappedTON: string;
  wrappedTONProxy: string;
  polygonBridge: string;
  polygonBridgeProxy: string;
  bridgeDAO: string;
  bridgeDAOProxy: string;
  deployer: string;
  network: string;
  timestamp: string;
}

async function main() {
  console.log("🚀 Starting Polygon-TON Bridge deployment...\n");

  const [deployer] = await ethers.getSigners();
  console.log("📍 Deploying contracts with account:", deployer.address);
  console.log("💰 Account balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)), "ETH\n");

  // Get network info
  const network = await ethers.provider.getNetwork();
  console.log("🌐 Network:", network.name, "Chain ID:", network.chainId.toString(), "\n");

  // ============================================
  // Step 1: Deploy WrappedTON
  // ============================================
  console.log("📦 Step 1: Deploying WrappedTON...");
  const WrappedTONFactory = await ethers.getContractFactory("WrappedTON");
  
  const wrappedTON = await upgrades.deployProxy(
    WrappedTONFactory,
    [deployer.address, ethers.ZeroAddress], // Admin and temporary bridge
    { 
      initializer: "initialize",
      kind: "uups"
    }
  );
  await wrappedTON.waitForDeployment();
  
  const wrappedTONAddress = await wrappedTON.getAddress();
  console.log("✅ WrappedTON Proxy deployed to:", wrappedTONAddress);
  
  const wrappedTONImplAddress = await upgrades.erc1967.getImplementationAddress(wrappedTONAddress);
  console.log("   Implementation at:", wrappedTONImplAddress, "\n");

  // ============================================
  // Step 2: Deploy PolygonBridge
  // ============================================
  console.log("📦 Step 2: Deploying PolygonBridge...");
  
  const config = {
    minBridgeAmount: ethers.parseEther("0.1"),      // 0.1 POL minimum
    maxBridgeAmount: ethers.parseEther("1000"),     // 1000 POL maximum
    feeBasisPoints: 30,                              // 0.3% fee
    relayerThreshold: 1,                             // 1 relayer confirmation required
    enabled: true
  };

  const PolygonBridgeFactory = await ethers.getContractFactory("PolygonBridge");
  
  const bridge = await upgrades.deployProxy(
    PolygonBridgeFactory,
    [deployer.address, wrappedTONAddress, config],
    { 
      initializer: "initialize",
      kind: "uups"
    }
  );
  await bridge.waitForDeployment();
  
  const bridgeAddress = await bridge.getAddress();
  console.log("✅ PolygonBridge Proxy deployed to:", bridgeAddress);
  
  const bridgeImplAddress = await upgrades.erc1967.getImplementationAddress(bridgeAddress);
  console.log("   Implementation at:", bridgeImplAddress, "\n");

  // ============================================
  // Step 3: Update WrappedTON with Bridge address
  // ============================================
  console.log("🔗 Step 3: Connecting WrappedTON to Bridge...");
  const updateTx = await wrappedTON.updateBridge(bridgeAddress);
  await updateTx.wait();
  console.log("✅ WrappedTON connected to Bridge\n");

  // ============================================
  // Step 4: Deploy BridgeDAO
  // ============================================
  console.log("📦 Step 4: Deploying BridgeDAO...");
  
  const BridgeDAOFactory = await ethers.getContractFactory("BridgeDAO");
  
  const dao = await upgrades.deployProxy(
    BridgeDAOFactory,
    [bridgeAddress, wrappedTONAddress],
    { 
      initializer: "initialize",
      kind: "uups"
    }
  );
  await dao.waitForDeployment();
  
  const daoAddress = await dao.getAddress();
  console.log("✅ BridgeDAO Proxy deployed to:", daoAddress);
  
  const daoImplAddress = await upgrades.erc1967.getImplementationAddress(daoAddress);
  console.log("   Implementation at:", daoImplAddress, "\n");

  // ============================================
  // Step 5: Setup Roles
  // ============================================
  console.log("🔐 Step 5: Setting up roles...");
  
  // Grant deployer relayer role for testing
  const RELAYER_ROLE = await bridge.RELAYER_ROLE();
  const grantTx = await bridge.grantRole(RELAYER_ROLE, deployer.address);
  await grantTx.wait();
  console.log("✅ Granted RELAYER_ROLE to deployer\n");

  // ============================================
  // Step 6: Save Deployment Info
  // ============================================
  console.log("�� Step 6: Saving deployment info...");
  
  const deploymentInfo: DeploymentAddresses = {
    wrappedTON: wrappedTONImplAddress,
    wrappedTONProxy: wrappedTONAddress,
    polygonBridge: bridgeImplAddress,
    polygonBridgeProxy: bridgeAddress,
    bridgeDAO: daoImplAddress,
    bridgeDAOProxy: daoAddress,
    deployer: deployer.address,
    network: network.name,
    timestamp: new Date().toISOString()
  };

  const deploymentsDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  const filename = `${network.name}-${network.chainId}.json`;
  const filepath = path.join(deploymentsDir, filename);
  
  fs.writeFileSync(filepath, JSON.stringify(deploymentInfo, null, 2));
  console.log("✅ Deployment info saved to:", filepath, "\n");

  // ============================================
  // Summary
  // ============================================
  console.log("═══════════════════════════════════════════════════════");
  console.log("🎉 DEPLOYMENT COMPLETE!");
  console.log("═══════════════════════════════════════════════════════");
  console.log("\n📋 Contract Addresses:\n");
  console.log("  WrappedTON Proxy:      ", wrappedTONAddress);
  console.log("  PolygonBridge Proxy:   ", bridgeAddress);
  console.log("  BridgeDAO Proxy:       ", daoAddress);
  console.log("\n📝 Next Steps:\n");
  console.log("  1. Verify contracts on PolygonScan");
  console.log("  2. Add additional relayers via grantRole()");
  console.log("  3. Configure bridge parameters via DAO");
  console.log("  4. Test bridging with small amounts");
  console.log("  5. Set up monitoring and alerts");
  console.log("\n═══════════════════════════════════════════════════════\n");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });
