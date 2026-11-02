require("@nomicfoundation/hardhat-toolbox");
const path = require("path");

// Load environment variables from .env file inside smart-contracts/ directory
require("dotenv").config({ path: path.resolve(__dirname, ".env") });

// Determine if the caller requested the Sepolia network
const isSepoliaTargeted =
  process.argv.includes("sepolia") ||
  process.env.HARDHAT_NETWORK === "sepolia";

function getSepoliaNetworkConfig() {
  const rpcUrl = (process.env.SEPOLIA_RPC_URL || "").trim();
  let privateKey = (process.env.SEPOLIA_PRIVATE_KEY || "").trim();

  // Enforce clear validation error when targeting Sepolia without credentials
  if (isSepoliaTargeted) {
    if (!rpcUrl) {
      throw new Error(
        "\n[Assetra Hardhat Configuration Error] Missing 'SEPOLIA_RPC_URL' in environment.\n" +
        "Please specify your Sepolia RPC endpoint in smart-contracts/.env (e.g. Infura, Alchemy, or QuickNode).\n"
      );
    }
    if (!privateKey) {
      throw new Error(
        "\n[Assetra Hardhat Configuration Error] Missing 'SEPOLIA_PRIVATE_KEY' in environment.\n" +
        "Please specify your deployer wallet private key in smart-contracts/.env.\n"
      );
    }
  }

  // Format private key with 0x prefix if omitted
  if (privateKey && !privateKey.startsWith("0x")) {
    privateKey = `0x${privateKey}`;
  }

  return {
    url: rpcUrl || "https://rpc.sepolia.org",
    chainId: 11155111,
    accounts: privateKey ? [privateKey] : []
  };
}

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.24",
    settings: {
      viaIR: true,
      evmVersion: "cancun",
      optimizer: {
        enabled: true,
        runs: 200
      }
    }
  },
  networks: {
    hardhat: {
      chainId: 31337
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 31337
    },
    sepolia: getSepoliaNetworkConfig()
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  }
};
