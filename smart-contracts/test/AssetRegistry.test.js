const { expect } = require("chai");
const { ethers } = require("hardhat");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");

describe("Assetra Protocol Approval-Gated Smart Contracts", function () {
  let assetToken;
  let assetRegistry;
  let owner;
  let verifier;
  let user1;
  let user2;

  beforeEach(async function () {
    [owner, verifier, user1, user2] = await ethers.getSigners();

    const AssetToken = await ethers.getContractFactory("AssetToken");
    assetToken = await AssetToken.deploy(owner.address);
    await assetToken.waitForDeployment();

    const AssetRegistry = await ethers.getContractFactory("AssetRegistry");
    assetRegistry = await AssetRegistry.deploy(await assetToken.getAddress());
    await assetRegistry.waitForDeployment();

    await assetToken.setRegistryContract(await assetRegistry.getAddress());
    await assetRegistry.setVerifierAddress(verifier.address);
  });

  describe("Asset Submission & Verification Flow", function () {
    it("Should register an asset in Submitted state with isApproved = false", async function () {
      await assetRegistry.connect(user1).registerAsset(
        "AST-2026-SUB",
        "Paris Office Suite",
        "Commercial Real Estate",
        "Paris, France",
        5500000,
        "BNP Custody",
        "ipfs://QmParisDeed"
      );

      const record = await assetRegistry.getAsset("AST-2026-SUB");
      expect(record.name).to.equal("Paris Office Suite");
      expect(record.isApproved).to.be.false;
      expect(record.status).to.equal(0); // Status.Submitted
    });

    it("Should REJECT tokenization of an unapproved asset", async function () {
      await assetRegistry.connect(user1).registerAsset(
        "AST-UNAPPROVED",
        "Unapproved Fine Art",
        "Fine Art",
        "Zurich",
        2000000,
        "Sotheby",
        "ipfs://QmUnapproved"
      );

      await expect(
        assetRegistry.connect(user1).tokenizeAsset("AST-UNAPPROVED")
      ).to.be.revertedWith("Asset must be approved on-chain before tokenization");
    });

    it("Should allow authorized verifier to approve an asset on-chain", async function () {
      await assetRegistry.connect(user1).registerAsset(
        "AST-APPROVE-TEST",
        "London Commercial Tower",
        "Real Estate",
        "London, UK",
        15000000,
        "Savills",
        "ipfs://QmLondonDeed"
      );

      await expect(assetRegistry.connect(verifier).approveAssetOnChain("AST-APPROVE-TEST"))
        .to.emit(assetRegistry, "AssetApproved")
        .withArgs("AST-APPROVE-TEST", verifier.address, anyValue);

      const record = await assetRegistry.getAsset("AST-APPROVE-TEST");
      expect(record.isApproved).to.be.true;
      expect(record.approvedBy).to.equal(verifier.address);
      expect(record.status).to.equal(2); // Status.Approved
    });

    it("Should REJECT on-chain approval from unauthorized caller", async function () {
      await assetRegistry.connect(user1).registerAsset(
        "AST-UNAUTH-APP",
        "Commercial Asset",
        "Real Estate",
        "NY",
        3000000,
        "CBRE",
        "ipfs://Qm1"
      );

      await expect(
        assetRegistry.connect(user2).approveAssetOnChain("AST-UNAUTH-APP")
      ).to.be.revertedWith("AssetRegistry: Caller is not an authorized verifier");
    });

    it("Should ALLOW tokenization ONLY AFTER on-chain approval", async function () {
      await assetRegistry.connect(user1).registerAsset(
        "AST-APPROVED-MINT",
        "Tokyo Technology Park",
        "Infrastructure",
        "Tokyo, Japan",
        25000000,
        "Mizuho Trust",
        "ipfs://QmTokyoPark"
      );

      // Verifier approves asset on-chain
      await assetRegistry.connect(verifier).approveAssetOnChain("AST-APPROVED-MINT");

      // User tokenizes approved asset
      await expect(assetRegistry.connect(user1).tokenizeAsset("AST-APPROVED-MINT"))
        .to.emit(assetRegistry, "AssetTokenized")
        .withArgs("AST-APPROVED-MINT", 1, user1.address, await assetToken.getAddress());

      const record = await assetRegistry.getAsset("AST-APPROVED-MINT");
      expect(record.status).to.equal(4); // Status.Tokenized
      expect(await assetToken.ownerOf(1)).to.equal(user1.address);
    });

    it("Should allow verifier to reject an asset with a reason", async function () {
      await assetRegistry.connect(user1).registerAsset(
        "AST-REJECT-TEST",
        "Suspicious Asset Claim",
        "Commodities",
        "Unknown",
        100000,
        "None",
        "ipfs://QmFake"
      );

      await expect(
        assetRegistry.connect(verifier).rejectAssetOnChain("AST-REJECT-TEST", "Insufficient proof of legal title")
      )
        .to.emit(assetRegistry, "AssetRejected")
        .withArgs("AST-REJECT-TEST", verifier.address, "Insufficient proof of legal title", anyValue);

      const record = await assetRegistry.getAsset("AST-REJECT-TEST");
      expect(record.status).to.equal(3); // Status.Rejected
      expect(record.isApproved).to.be.false;
    });
  });
});
