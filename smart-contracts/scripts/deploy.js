const hre = require("hardhat");

async function main() {
  const network = await hre.ethers.provider.getNetwork();
  console.log("============================================================");
  console.log("  Assetra Protocol Smart Contract Deployment");
  console.log("============================================================");
  console.log(`Network Name:  ${hre.network.name}`);
  console.log(`Chain ID:      ${network.chainId}`);

  const signers = await hre.ethers.getSigners();
  if (!signers || signers.length === 0) {
    throw new Error(
      `[Assetra Deployment Error] No signer accounts available for network '${hre.network.name}'. ` +
      `Check your SEPOLIA_PRIVATE_KEY configuration in smart-contracts/.env.`
    );
  }

  const deployer = signers[0];
  console.log(`Deployer:      ${deployer.address}`);

  try {
    const balanceWei = await hre.ethers.provider.getBalance(deployer.address);
    const balanceEth = hre.ethers.formatEther(balanceWei);
    console.log(`Account Funds: ${balanceEth} ETH`);
  } catch (balErr) {
    console.log("Account Funds: (Unable to fetch balance)");
  }
  console.log("------------------------------------------------------------");

  // Step 1: Deploy AssetToken ERC-721
  console.log("\n[1/4] Deploying AssetToken (ERC-721)...");
  const AssetToken = await hre.ethers.getContractFactory("AssetToken");
  const assetToken = await AssetToken.deploy(deployer.address);
  await assetToken.waitForDeployment();
  const tokenAddress = await assetToken.getAddress();
  const tokenTx = assetToken.deploymentTransaction();
  console.log(`  -> Deployed Address: ${tokenAddress}`);
  if (tokenTx) console.log(`  -> Transaction Hash: ${tokenTx.hash}`);

  // Step 2: Deploy AssetRegistry
  console.log("\n[2/4] Deploying AssetRegistry...");
  const AssetRegistry = await hre.ethers.getContractFactory("AssetRegistry");
  const assetRegistry = await AssetRegistry.deploy(tokenAddress);
  await assetRegistry.waitForDeployment();
  const registryAddress = await assetRegistry.getAddress();
  const registryTx = assetRegistry.deploymentTransaction();
  console.log(`  -> Deployed Address: ${registryAddress}`);
  if (registryTx) console.log(`  -> Transaction Hash: ${registryTx.hash}`);

  // Step 3: Grant registry contract Minter permissions on AssetToken
  console.log("\n[3/4] Authorizing AssetRegistry on AssetToken (setRegistryContract)...");
  const linkTx = await assetToken.setRegistryContract(registryAddress);
  await linkTx.wait();
  console.log(`  -> Permissions Granted (Registry authorized as minter)`);
  console.log(`  -> Transaction Hash: ${linkTx.hash}`);

  // Step 4: Deploy AssetMarketplace
  console.log("\n[4/4] Deploying AssetMarketplace...");
  const AssetMarketplace = await hre.ethers.getContractFactory("AssetMarketplace");
  const assetMarketplace = await AssetMarketplace.deploy();
  await assetMarketplace.waitForDeployment();
  const marketplaceAddress = await assetMarketplace.getAddress();
  const marketplaceTx = assetMarketplace.deploymentTransaction();
  console.log(`  -> Deployed Address: ${marketplaceAddress}`);
  if (marketplaceTx) console.log(`  -> Transaction Hash: ${marketplaceTx.hash}`);

  console.log("\n============================================================");
  console.log("  Assetra Protocol Contracts Deployed Successfully!");
  console.log("============================================================");
  console.log(`NETWORK=${hre.network.name}`);
  console.log(`CHAIN_ID=${network.chainId}`);
  console.log(`DEPLOYER_ADDRESS=${deployer.address}`);
  console.log(`TOKEN_CONTRACT_ADDRESS=${tokenAddress}`);
  console.log(`REGISTRY_CONTRACT_ADDRESS=${registryAddress}`);
  console.log(`MARKETPLACE_CONTRACT_ADDRESS=${marketplaceAddress}`);
  console.log("============================================================\n");
}

main().catch((error) => {
  console.error("\n[Assetra Deployment Failed]:", error.message || error);
  process.exitCode = 1;
});
