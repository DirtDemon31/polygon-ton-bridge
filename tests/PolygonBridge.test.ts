import { expect } from "chai";
import { ethers } from "hardhat";
import { PolygonBridge, WrappedTON } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

describe("PolygonBridge", function () {
  async function deployBridgeFixture() {
    const [owner, relayer, user] = await ethers.getSigners();

    // Deploy WrappedTON
    const WrappedTON = await ethers.getContractFactory("WrappedTON");
    const wrappedTON = await WrappedTON.deploy();
    await wrappedTON.waitForDeployment();
    await wrappedTON.initialize(owner.address, ethers.ZeroAddress);

    // Deploy Bridge
    const PolygonBridge = await ethers.getContractFactory("PolygonBridge");
    const config = {
      minBridgeAmount: ethers.parseEther("0.1"),
      maxBridgeAmount: ethers.parseEther("1000"),
      feeBasisPoints: 30,
      relayerThreshold: 1,
      enabled: true
    };

    const bridge = await PolygonBridge.deploy();
    await bridge.waitForDeployment();
    await bridge.initialize(owner.address, owner.address, config);

    // Setup
    await wrappedTON.updateBridge(await bridge.getAddress());
    const RELAYER_ROLE = await bridge.RELAYER_ROLE();
    await bridge.grantRole(RELAYER_ROLE, relayer.address);

    return { bridge, wrappedTON, owner, relayer, user };
  }

  describe("Deployment", function () {
    it("Should initialize with correct config", async function () {
      const { bridge } = await loadFixture(deployBridgeFixture);
      const config = await bridge.config();
      expect(config.minBridgeAmount).to.equal(ethers.parseEther("0.1"));
      expect(config.feeBasisPoints).to.equal(30);
    });

    it("Should set correct roles", async function () {
      const { bridge, owner, relayer } = await loadFixture(deployBridgeFixture);
      const RELAYER_ROLE = await bridge.RELAYER_ROLE();
      expect(await bridge.hasRole(RELAYER_ROLE, relayer.address)).to.be.true;
    });
  });

  describe("Bridging", function () {
    it("Should bridge POL to TON", async function () {
      const { bridge, user } = await loadFixture(deployBridgeFixture);
      const amount = ethers.parseEther("1");
      const tonRecipient = "EQD...test-ton-address";

      await expect(
        bridge.connect(user).bridgeToTON(
          tonRecipient,
          ethers.ZeroAddress,
          amount,
          { value: amount }
        )
      ).to.emit(bridge, "BridgeInitiated");
    });

    it("Should reject amount below minimum", async function () {
      const { bridge, user } = await loadFixture(deployBridgeFixture);
      const amount = ethers.parseEther("0.01");
      
      await expect(
        bridge.connect(user).bridgeToTON(
          "EQD...test",
          ethers.ZeroAddress,
          amount,
          { value: amount }
        )
      ).to.be.revertedWithCustomError(bridge, "InsufficientAmount");
    });

    it("Should calculate fees correctly", async function () {
      const { bridge, user } = await loadFixture(deployBridgeFixture);
      const amount = ethers.parseEther("1");
      const tonRecipient = "EQD...test";

      const tx = await bridge.connect(user).bridgeToTON(
        tonRecipient,
        ethers.ZeroAddress,
        amount,
        { value: amount }
      );

      const receipt = await tx.wait();
      const event = receipt?.logs.find((log: any) => {
        try {
          const parsed = bridge.interface.parseLog(log);
          return parsed?.name === "BridgeInitiated";
        } catch {
          return false;
        }
      });

      if (event) {
        const parsed = bridge.interface.parseLog(event);
        const fee = parsed?.args[5];
        // Fee should be 0.3% = 0.003 ETH
        expect(fee).to.equal(ethers.parseEther("0.003"));
      }
    });
  });
});
