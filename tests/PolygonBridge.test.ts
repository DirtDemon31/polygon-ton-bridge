import { expect } from "chai";
import hre from "hardhat";
const { ethers, upgrades } = hre;
import { PolygonBridge, WrappedTON } from "../typechain-types";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

describe("PolygonBridge", function () {
  async function deployBridgeFixture() {
    const [owner, relayer, user] = await ethers.getSigners();

    // Deploy WrappedTON with proxy
    const WrappedTONFactory = await ethers.getContractFactory("WrappedTON");
    const wrappedTON = await upgrades.deployProxy(
      WrappedTONFactory,
      [owner.address, ethers.ZeroAddress], // Temporary bridge address
      { initializer: "initialize" }
    ) as unknown as WrappedTON;
    await wrappedTON.waitForDeployment();

    // Deploy Bridge with proxy
    const PolygonBridgeFactory = await ethers.getContractFactory("PolygonBridge");
    const config = {
      minBridgeAmount: ethers.parseEther("0.1"),
      maxBridgeAmount: ethers.parseEther("1000"),
      feeBasisPoints: 30,
      relayerThreshold: 1,
      enabled: true
    };

    const bridge = await upgrades.deployProxy(
      PolygonBridgeFactory,
      [owner.address, owner.address, config],
      { initializer: "initialize" }
    ) as unknown as PolygonBridge;
    await bridge.waitForDeployment();

    // Update wrappedTON to use actual bridge
    await wrappedTON.updateBridge(await bridge.getAddress());

    // Grant relayer role
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
      expect(config.relayerThreshold).to.equal(1);
    });

    it("Should set correct roles", async function () {
      const { bridge, relayer } = await loadFixture(deployBridgeFixture);
      const RELAYER_ROLE = await bridge.RELAYER_ROLE();
      expect(await bridge.hasRole(RELAYER_ROLE, relayer.address)).to.be.true;
    });

    it("Should support POL by default", async function () {
      const { bridge } = await loadFixture(deployBridgeFixture);
      expect(await bridge.supportedTokens(ethers.ZeroAddress)).to.be.true;
    });
  });

  describe("Bridging", function () {
    it("Should bridge POL to TON", async function () {
      const { bridge, user } = await loadFixture(deployBridgeFixture);
      const amount = ethers.parseEther("1");
      const tonRecipient = "EQD4nS9m7Ghs9Rj8Q5JoRB9vYiYbKkT4pKQT9U_test_address";

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
          "EQD4nS9m7test",
          ethers.ZeroAddress,
          amount,
          { value: amount }
        )
      ).to.be.revertedWithCustomError(bridge, "InsufficientAmount");
    });

    it("Should reject amount above maximum", async function () {
      const { bridge, user } = await loadFixture(deployBridgeFixture);
      const amount = ethers.parseEther("1001"); // Just above max
      
      await expect(
        bridge.connect(user).bridgeToTON(
          "EQD4nS9m7test",
          ethers.ZeroAddress,
          amount,
          { value: amount }
        )
      ).to.be.revertedWithCustomError(bridge, "ExceedsMaxAmount");
    });

    it("Should calculate fees correctly", async function () {
      const { bridge, user } = await loadFixture(deployBridgeFixture);
      const amount = ethers.parseEther("1");
      const tonRecipient = "EQD4nS9m7test";

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

    it("Should reject unsupported tokens", async function () {
      const { bridge, user } = await loadFixture(deployBridgeFixture);
      const fakeTokenAddress = "0x1111111111111111111111111111111111111111";
      
      await expect(
        bridge.connect(user).bridgeToTON(
          "EQD4nS9m7test",
          fakeTokenAddress,
          ethers.parseEther("1")
        )
      ).to.be.revertedWithCustomError(bridge, "UnsupportedToken");
    });
  });

  describe("Relayer Operations", function () {
    it("Should allow relayer to confirm transfer", async function () {
      const { bridge, user, relayer } = await loadFixture(deployBridgeFixture);
      const amount = ethers.parseEther("1");

      const tx = await bridge.connect(user).bridgeToTON(
        "EQD4test",
        ethers.ZeroAddress,
        amount,
        { value: amount }
      );

      const receipt = await tx.wait();
      const event = receipt?.logs.find((log: any) => {
        try {
          return bridge.interface.parseLog(log)?.name === "BridgeInitiated";
        } catch {
          return false;
        }
      });

      if (event) {
        const parsed = bridge.interface.parseLog(event);
        const transferId = parsed?.args[0];

        await expect(
          bridge.connect(relayer).confirmTransfer(transferId)
        ).to.emit(bridge, "BridgeConfirmed");

        const transfer = await bridge.getTransfer(transferId);
        expect(transfer.confirmations).to.equal(1);
      }
    });
  });
});
