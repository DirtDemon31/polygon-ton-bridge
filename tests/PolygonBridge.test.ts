import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import { PolygonBridge, WrappedTON } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("PolygonBridge", function () {
  let bridge: PolygonBridge;
  let wrappedTON: WrappedTON;
  let owner: SignerWithAddress;
  let relayer: SignerWithAddress;
  let user: SignerWithAddress;

  beforeEach(async function () {
    [owner, relayer, user] = await ethers.getSigners();

    // Deploy WrappedTON
    const WrappedTON = await ethers.getContractFactory("WrappedTON");
    wrappedTON = await upgrades.deployProxy(
      WrappedTON,
      [owner.address, ethers.ZeroAddress],
      { initializer: "initialize" }
    ) as unknown as WrappedTON;
    await wrappedTON.waitForDeployment();

    // Deploy Bridge
    const PolygonBridge = await ethers.getContractFactory("PolygonBridge");
    const config = {
      minBridgeAmount: ethers.parseEther("0.1"),
      maxBridgeAmount: ethers.parseEther("1000"),
      feeBasisPoints: 30,
      relayerThreshold: 1,
      enabled: true
    };

    bridge = await upgrades.deployProxy(
      PolygonBridge,
      [owner.address, owner.address, config],
      { initializer: "initialize" }
    ) as unknown as PolygonBridge;
    await bridge.waitForDeployment();

    // Setup
    await wrappedTON.updateBridge(await bridge.getAddress());
    const RELAYER_ROLE = await bridge.RELAYER_ROLE();
    await bridge.grantRole(RELAYER_ROLE, relayer.address);
  });

  it("Should initialize with correct config", async function () {
    const config = await bridge.config();
    expect(config.minBridgeAmount).to.equal(ethers.parseEther("0.1"));
    expect(config.feeBasisPoints).to.equal(30);
  });

  it("Should bridge POL to TON", async function () {
    const amount = ethers.parseEther("1");
    const tonRecipient = "EQD...test-ton-address";

    const tx = await bridge.connect(user).bridgeToTON(
      tonRecipient,
      ethers.ZeroAddress,
      amount,
      { value: amount }
    );

    await expect(tx).to.emit(bridge, "BridgeInitiated");
  });

  it("Should reject amount below minimum", async function () {
    const amount = ethers.parseEther("0.01");
    await expect(
      bridge.connect(user).bridgeToTON(
        "EQD...test",
        ethers.ZeroAddress,
        amount,
        { value: amount }
      )
    ).to.be.reverted;
  });
});
