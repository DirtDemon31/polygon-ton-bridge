/** @type {import('hardhat/config').HardhatUserConfig} */
export default {
  solidity: {
    version: "0.8.27",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200000,
      },
    },
  },
  paths: {
    sources: "./contracts/polygon",
    tests: "./tests",
    cache: "./cache",
    artifacts: "./artifacts",
  },
};
