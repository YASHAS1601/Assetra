import os
import docx
from docx.shared import Inches, Pt, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_ALIGN_VERTICAL
from docx.oxml import parse_xml, OxmlElement
from docx.oxml.ns import nsdecls, qn
from PIL import Image

def generate_report():
    doc = docx.Document()

    # 1. Page Setup: Standard Letter (8.5 x 11.0 in) with 1.0 inch margins
    for section in doc.sections:
        section.top_margin = Inches(1.0)
        section.bottom_margin = Inches(1.0)
        section.left_margin = Inches(1.0)
        section.right_margin = Inches(1.0)
        section.page_width = Inches(8.5)
        section.page_height = Inches(11.0)

        # Running Academic Header
        header = section.header
        hp = header.paragraphs[0]
        hp.alignment = WD_ALIGN_PARAGRAPH.RIGHT
        hrun = hp.add_run("ASSETRA: Blockchain-Based Real-World Asset Tokenization Platform")
        hrun.font.name = "Times New Roman"
        hrun.font.size = Pt(8.5)
        hrun.font.color.rgb = RGBColor(100, 116, 139)

        # Running Academic Footer with dynamic Word page numbers (Page X of Y)
        footer = section.footer
        fp = footer.paragraphs[0]
        fp.alignment = WD_ALIGN_PARAGRAPH.RIGHT
        
        frun1 = fp.add_run("Final Academic Project Report | Page ")
        frun1.font.name = "Times New Roman"
        frun1.font.size = Pt(9.5)
        frun1.font.color.rgb = RGBColor(71, 85, 105)

        run_page = fp.add_run()
        run_page.font.name = "Times New Roman"
        run_page.font.size = Pt(9.5)
        run_page.font.color.rgb = RGBColor(71, 85, 105)
        fld_page = parse_xml(r'<w:fldSimple %s w:instr="PAGE"/>' % nsdecls('w'))
        run_page._r.append(fld_page)

        frun2 = fp.add_run(" of ")
        frun2.font.name = "Times New Roman"
        frun2.font.size = Pt(9.5)
        frun2.font.color.rgb = RGBColor(71, 85, 105)

        run_total = fp.add_run()
        run_total.font.name = "Times New Roman"
        run_total.font.size = Pt(9.5)
        run_total.font.color.rgb = RGBColor(71, 85, 105)
        fld_total = parse_xml(r'<w:fldSimple %s w:instr="NUMPAGES"/>' % nsdecls('w'))
        run_total._r.append(fld_total)

    # 2. Styling Helpers (NO blue headings, NO collapsible headings, all pure black Times New Roman)
    def add_title(text, subtitle=None):
        p = doc.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p.paragraph_format.space_before = Pt(0)
        p.paragraph_format.space_after = Pt(4)
        run = p.add_run(text)
        run.font.name = "Times New Roman"
        run.font.size = Pt(16.5)
        run.bold = True
        run.font.color.rgb = RGBColor(0, 0, 0)

        if subtitle:
            p2 = doc.add_paragraph()
            p2.alignment = WD_ALIGN_PARAGRAPH.CENTER
            p2.paragraph_format.space_before = Pt(0)
            p2.paragraph_format.space_after = Pt(14)
            run2 = p2.add_run(subtitle)
            run2.font.name = "Times New Roman"
            run2.font.size = Pt(11)
            run2.italic = True
            run2.font.color.rgb = RGBColor(40, 40, 40)

    def add_heading_1(text):
        p = doc.add_paragraph()
        p.paragraph_format.keep_with_next = True
        p.paragraph_format.space_before = Pt(13)
        p.paragraph_format.space_after = Pt(4)
        p.paragraph_format.line_spacing = 1.15
        run = p.add_run(text)
        run.font.name = "Times New Roman"
        run.font.size = Pt(13.5)
        run.bold = True
        run.font.color.rgb = RGBColor(0, 0, 0)
        return p

    def add_heading_2(text):
        p = doc.add_paragraph()
        p.paragraph_format.keep_with_next = True
        p.paragraph_format.space_before = Pt(10)
        p.paragraph_format.space_after = Pt(3)
        p.paragraph_format.line_spacing = 1.15
        run = p.add_run(text)
        run.font.name = "Times New Roman"
        run.font.size = Pt(12)
        run.bold = True
        run.font.color.rgb = RGBColor(0, 0, 0)
        return p

    def add_heading_3(text):
        p = doc.add_paragraph()
        p.paragraph_format.keep_with_next = True
        p.paragraph_format.space_before = Pt(7)
        p.paragraph_format.space_after = Pt(2)
        p.paragraph_format.line_spacing = 1.15
        run = p.add_run(text)
        run.font.name = "Times New Roman"
        run.font.size = Pt(11.5)
        run.bold = True
        run.font.color.rgb = RGBColor(0, 0, 0)
        return p

    def add_p(text):
        p = doc.add_paragraph()
        p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
        p.paragraph_format.space_before = Pt(0)
        p.paragraph_format.space_after = Pt(5)
        p.paragraph_format.line_spacing = 1.15
        run = p.add_run(text)
        run.font.name = "Times New Roman"
        run.font.size = Pt(11)
        run.font.color.rgb = RGBColor(0, 0, 0)
        return p

    def add_bullet(bold_prefix, text):
        p = doc.add_paragraph(style='List Bullet')
        p.alignment = WD_ALIGN_PARAGRAPH.JUSTIFY
        p.paragraph_format.space_before = Pt(0)
        p.paragraph_format.space_after = Pt(3)
        p.paragraph_format.line_spacing = 1.15
        r_bold = p.add_run(bold_prefix + " ")
        r_bold.font.name = "Times New Roman"
        r_bold.font.size = Pt(11)
        r_bold.bold = True
        r_bold.font.color.rgb = RGBColor(0, 0, 0)
        
        r_text = p.add_run(text)
        r_text.font.name = "Times New Roman"
        r_text.font.size = Pt(11)
        r_text.font.color.rgb = RGBColor(0, 0, 0)
        return p

    def set_cell_margins(cell, top=100, bottom=100, left=140, right=140):
        tcPr = cell._tc.get_or_add_tcPr()
        tcMar = parse_xml(
            f'<w:tcMar {nsdecls("w")}>'
            f'<w:top w:w="{top}" w:type="dxa"/>'
            f'<w:bottom w:w="{bottom}" w:type="dxa"/>'
            f'<w:left w:w="{left}" w:type="dxa"/>'
            f'<w:right w:w="{right}" w:type="dxa"/>'
            f'</w:tcMar>'
        )
        tcPr.append(tcMar)

    def set_cell_border(cell, **kwargs):
        tcPr = cell._tc.get_or_add_tcPr()
        borders = parse_xml(
            f'<w:tcBorders {nsdecls("w")}>'
            f'<w:top w:val="{kwargs.get("top", {}).get("val", "single")}" w:sz="{kwargs.get("top", {}).get("sz", 4)}" w:space="0" w:color="{kwargs.get("top", {}).get("color", "CBD5E1")}"/>'
            f'<w:bottom w:val="{kwargs.get("bottom", {}).get("val", "single")}" w:sz="{kwargs.get("bottom", {}).get("sz", 4)}" w:space="0" w:color="{kwargs.get("bottom", {}).get("color", "CBD5E1")}"/>'
            f'<w:left w:val="{kwargs.get("left", {}).get("val", "single")}" w:sz="{kwargs.get("left", {}).get("sz", 4)}" w:space="0" w:color="{kwargs.get("left", {}).get("color", "CBD5E1")}"/>'
            f'<w:right w:val="{kwargs.get("right", {}).get("val", "single")}" w:sz="{kwargs.get("right", {}).get("sz", 4)}" w:space="0" w:color="{kwargs.get("right", {}).get("color", "CBD5E1")}"/>'
            f'</w:tcBorders>'
        )
        tcPr.append(borders)

    def set_cell_shading(cell, color_hex="F1F5F9"):
        tcPr = cell._tc.get_or_add_tcPr()
        shd = parse_xml(f'<w:shd {nsdecls("w")} w:fill="{color_hex}"/>')
        tcPr.append(shd)

    def create_table(headers, rows_data, col_widths=None):
        table = doc.add_table(rows=len(rows_data) + 1, cols=len(headers))
        table.alignment = WD_TABLE_ALIGNMENT.CENTER
        table.autofit = False

        # Header Row
        hdr_cells = table.rows[0].cells
        for i, header_text in enumerate(headers):
            hdr_cells[i].text = header_text
            set_cell_shading(hdr_cells[i], "E2E8F0")
            set_cell_margins(hdr_cells[i], top=120, bottom=120, left=140, right=140)
            set_cell_border(hdr_cells[i])
            for p in hdr_cells[i].paragraphs:
                p.alignment = WD_ALIGN_PARAGRAPH.LEFT
                p.paragraph_format.space_before = Pt(0)
                p.paragraph_format.space_after = Pt(0)
                for run in p.runs:
                    run.font.name = "Times New Roman"
                    run.font.size = Pt(9.5)
                    run.bold = True
                    run.font.color.rgb = RGBColor(15, 23, 42)

        # Body Rows
        for r_idx, row_values in enumerate(rows_data):
            row_cells = table.rows[r_idx + 1].cells
            shd_color = "F8FAFC" if r_idx % 2 == 1 else "FFFFFF"
            for c_idx, cell_value in enumerate(row_values):
                row_cells[c_idx].text = str(cell_value)
                set_cell_shading(row_cells[c_idx], shd_color)
                set_cell_margins(row_cells[c_idx], top=90, bottom=90, left=140, right=140)
                set_cell_border(row_cells[c_idx])
                for p in row_cells[c_idx].paragraphs:
                    p.alignment = WD_ALIGN_PARAGRAPH.LEFT
                    p.paragraph_format.space_before = Pt(0)
                    p.paragraph_format.space_after = Pt(0)
                    for run in p.runs:
                        run.font.name = "Times New Roman"
                        run.font.size = Pt(9)
                        run.font.color.rgb = RGBColor(15, 23, 42)

        if col_widths:
            for row in table.rows:
                for idx, w in enumerate(col_widths):
                    row.cells[idx].width = Inches(w)

        p_space = doc.add_paragraph()
        p_space.paragraph_format.space_before = Pt(2)
        p_space.paragraph_format.space_after = Pt(4)
        return table

    # ==========================================
    # 3. DOCUMENT BODY SECTIONS (Strictly Sections 1 to 12)
    # ==========================================

    # TITLE & SUBTITLE
    add_title(
        "ASSETRA — BLOCKCHAIN-BASED REAL-WORLD ASSET TOKENIZATION AND INVESTMENT PLATFORM",
        "A Decentralized Protocol for Audited Real-World Asset Custody, Non-Fungible Deed Tokenization, and Atomic Marketplace Settlement"
    )

    # 1.0 PROJECT TITLE AND TEAM DETAILS
    add_heading_1("1.0 PROJECT TITLE AND TEAM DETAILS")
    add_p(
        "Assetra is an institutional real-world asset (RWA) tokenization and decentralized investment platform designed to bridge physical property provenance with verifiable Ethereum blockchain infrastructure. The system incorporates an off-chain compliance verification workflow, secure private document vaults, single-transaction ERC-721 deed tokenization, and an atomic peer-to-peer marketplace."
    )

    meta_headers = ["Project Parameter", "Technical Specification / Institutional Record"]
    meta_rows = [
        ["Project Title", "ASSETRA — Blockchain-Based Real-World Asset Tokenization and Investment Platform"],
        ["Project Category", "Blockchain / Web3 / Real-World Asset (RWA) Tokenization & FinTech"],
        ["Target Blockchain Network", "Ethereum Sepolia Testnet (Chain ID: 11155111 / Hex: 0xaa36a7)"],
        ["Team Members", "[TO BE FILLED - Student Name 1, Reg No: _________ | Student Name 2, Reg No: _________]"],
        ["Department", "[TO BE FILLED - Department of Computer Science and Engineering]"],
        ["Institution", "[TO BE FILLED - College / University Name]"],
        ["Faculty Supervisor / Guide", "[TO BE FILLED - Guide Name, Designation, Department]"],
        ["Academic Year / Submission Date", "2025–2026 Academic Year / November 2026"]
    ]
    create_table(meta_headers, meta_rows, col_widths=[2.3, 4.2])

    # TABLE OF CONTENTS
    add_heading_2("Table of Contents")
    toc_headers = ["Section Number & Heading", "Description / Sub-Modules"]
    toc_rows = [
        ["1.0 Project Title and Team Details", "Institutional metadata, category, network parameters, and academic credentials."],
        ["2.0 Abstract and Problem Definition", "Abstract, real-world asset illiquidity, fragmented provenance, and legal reality."],
        ["3.0 Need for Blockchain and Storage Architecture", "Distributed ledger, tamper resistance, wallet custody, and Storage Separation Protocol."],
        ["4.0 Project Links and Repository Information", "YouTube demo, live deployment, backend API, GitHub, and Sepolia contracts."],
        ["5.0 Softwares and Technologies Used", "Exact stack versions across React, Vite, Node.js, Express, Supabase, and Hardhat."],
        ["6.0 AI Models Used and Developer Tool Declaration", "Runtime zero-AI verification and Google Antigravity/Gemini engineering tool statement."],
        ["7.0 Detailed System Architecture", "Multi-tier architecture breakdown, off-chain/on-chain flow, and system diagram."],
        ["8.0 Blockchain Components and Smart Contracts", "EVM execution, gas mechanics, and deployed AssetToken, Registry, and Marketplace specs."],
        ["9.0 Complete Application Workflow", "Step-by-step lifecycles for Asset Owner, Compliance Administrator, and Buyer/Investor."],
        ["10.0 Fractional Investment Implementation", "Mathematical off-chain share calculations vs on-chain whole ERC-721 token reality."],
        ["11.0 Sample Screenshots and System Exhibits", "Genuine interface exhibits covering registration, admin review, minting, and trading."],
        ["12.0 Conclusion and Future Enhancements", "Protocol achievements, technical constraints, and multi-signature/fractional roadmap."]
    ]
    create_table(toc_headers, toc_rows, col_widths=[2.7, 3.8])

    # 2.0 ABSTRACT AND PROBLEM DEFINITION
    add_heading_1("2.0 ABSTRACT AND PROBLEM DEFINITION")
    add_heading_2("2.1 Abstract")
    add_p(
        "High-value physical assets—including commercial real estate, residential parcels, infrastructure, and fine art—represent the largest store of global wealth, yet they remain fundamentally illiquid, geographically restricted, and administratively opaque. Conventional title registries rely heavily on fragmented paper documents, localized bureaucratic verification, and manual escrow agents, creating significant counterparty risks, transaction delays, and high intermediation costs. Furthermore, high capital requirements systematically exclude retail and institutional investors from participating in secure asset-backed wealth generation."
    )
    add_p(
        "Assetra resolves these systemic barriers by introducing a decentralized, hybrid Web2/Web3 architecture for real-world asset lifecycle management. Under Assetra, physical asset submissions are verified through off-chain administrative compliance desks backed by encrypted private cloud vaults before any blockchain interaction occurs. Upon formal compliance approval, an accredited asset deed is cryptographically anchored onto the Ethereum Sepolia blockchain as a unique ERC-721 Non-Fungible Token (NFT). Using an atomic, non-custodial smart contract marketplace, verified buyers execute trustless purchases using Sepolia ETH, transferring tokenized deed ownership and routing funds instantaneously without centralized intermediaries. A public, real-time blockchain verification engine audits live smart contract storage against application records, guaranteeing 100% cryptographic transparency."
    )

    add_heading_2("2.2 Problem Definition")
    add_p(
        "The traditional management and trade of real-world physical assets suffer from several severe technical and economic vulnerabilities:"
    )
    add_bullet("Severe Asset Illiquidity:", "Physical property transactions typically require weeks or months to finalize due to repetitive manual verification, title searches, and complex escrow arrangements.")
    add_bullet("Fragmented Title Provenance & Double-Spending Risk:", "Paper-based or siloed electronic deed registries permit fraudulent duplicate pledges, forged property papers, and conflicting ownership claims that cannot be independently audited in real time.")
    add_bullet("Prohibitive Capital Thresholds:", "High unit costs prevent smaller investors from acquiring asset exposure, concentrating prime yield-generating assets among institutional conglomerates.")
    add_bullet("Counterparty & Settlement Risk:", "Traditional delivery-versus-payment (DvP) mechanisms depend on third-party legal escrows that introduce substantial processing fees, custodial counterparty failure risks, and settlement latency.")
    add_bullet("Legal and Architectural Reality of Tokenized Deeds:", "It is critical to establish that an on-chain NFT deed does not automatically override local sovereign land jurisdiction laws by itself. Instead, Assetra implements a legally compliant dual-record model where the ERC-721 token serves as a cryptographically sealed digital deed certificate tied to custodial vault affidavits, surveyor blueprints, and beneficial ownership roots recorded off-chain.")

    # 3.0 NEED FOR BLOCKCHAIN
    add_heading_1("3.0 NEED FOR BLOCKCHAIN AND STORAGE ARCHITECTURE")
    add_p(
        "Integrating public blockchain infrastructure into real-world asset lifecycle management addresses fundamental trust, provenance, and settlement challenges that conventional relational databases cannot solve:"
    )
    add_bullet("Immutable Distributed Ledger:", "Once an asset deed is tokenized on Ethereum Sepolia, its record cannot be altered, forged, or deleted by any single centralized party, database administrator, or malicious actor.")
    add_bullet("Tamper-Evident Provenance Tracking:", "Every issuance, administrative verification signature, price update, and ownership transfer is permanently sealed into Ethereum blocks, providing a complete historical ledger of title provenance.")
    add_bullet("Self-Sovereign Wallet Ownership:", "Ownership is tied directly to cryptographic public/private key pairs (MetaMask). Possession of the asset deed is governed by public-key cryptography rather than platform-managed database credentials.")
    add_bullet("Trustless Atomic Marketplace Settlement:", "Through smart contracts, payment in ETH and transfer of the ERC-721 NFT occur in a single, atomic EVM transaction. It is mathematically impossible for the seller to receive payment without transferring the deed, or for the buyer to receive the deed without delivering full payment.")
    add_bullet("Public Auditability via Sepolia Etherscan:", "Anyone can independently inspect deployed smart contracts, verified bytecode, event logs, and token ownership using public blockchain explorers, eliminating reliance on proprietary corporate platforms.")

    add_heading_2("3.1 The Necessity of Hybrid Architecture (Storage Separation Protocol)")
    add_p(
        "A critical engineering requirement of the Assetra platform is the strict separation between on-chain cryptographic state and off-chain binary document storage (Storage Architecture Separation Protocol):"
    )
    add_bullet("Block Gas Limits and Prohibitive Storage Costs:", "Ethereum is designed for execution consensus and lightweight state storage. Storing multi-megabyte surveyor maps, legal title deeds, and high-resolution site photographs directly on-chain would exceed block gas limits and cost thousands of dollars per asset.")
    add_bullet("Privacy, Compliance, and Data Protection:", "Physical asset deeds contain sensitive personal identifiable information (PII), national tax identifiers, and surveyor signatures that cannot be placed unencrypted on a public ledger under global privacy regulations.")
    add_bullet("The Hybrid Solution:", "Assetra maintains binary PDFs and surveyor blueprints inside private, encrypted cloud storage (Supabase Storage Vault). The Ethereum smart contract stores only the verified metadata, appraised valuation, verifier signature, token ID, and a cryptographic URI pointer (ipfsHash). Having an IPFS or URI pointer on-chain validates proof-of-existence without burdening the blockchain.")

    # 4.0 PROJECT LINKS
    add_heading_1("4.0 PROJECT LINKS AND REPOSITORY INFORMATION")
    add_p(
        "The project repository, deployed smart contract interfaces, and demonstration artifacts are documented below. All links correspond to the live codebase and Sepolia deployment."
    )

    links_headers = ["Project Deliverable", "Access Point / Deployed Identifier"]
    links_rows = [
        ["YouTube Demonstration Video", "YouTube Demonstration Link: [PASTE YOUTUBE URL HERE]"],
        ["Live Project Launch URL", "Live Project Launch Link: [PASTE DEPLOYED URL HERE / http://localhost:5173]"],
        ["Backend REST API Service", "Backend API Link: [PASTE URL IF APPLICABLE / http://localhost:5000]"],
        ["GitHub Code Repository", "GitHub Repository Link: [PASTE GITHUB REPOSITORY URL HERE]"],
        ["AssetToken ERC-721 Contract", "https://sepolia.etherscan.io/address/0x2F0d80D15773A473A00bE3B732D4B46974732501"],
        ["AssetRegistry Contract", "https://sepolia.etherscan.io/address/0x525E82f822E004838004ffd6Fe1366Be244EC671"],
        ["AssetMarketplace Contract", "https://sepolia.etherscan.io/address/0x517082aA429ED926BDbeC904a1879BaE1aFd05f7"]
    ]
    create_table(links_headers, links_rows, col_widths=[2.4, 4.1])

    # 5.0 SOFTWARES AND TECHNOLOGIES USED
    add_heading_1("5.0 SOFTWARES AND TECHNOLOGIES USED")
    add_p(
        "Assetra is engineered as a decoupled full-stack architecture comprising a React Single Page Application (SPA), a Node.js/Express service, a Supabase managed cloud database, and Solidity smart contracts compiled and deployed via Hardhat."
    )

    tech_headers = ["Tier / Domain", "Technology & Package", "Version", "Role in Assetra Protocol"]
    tech_rows = [
        ["Frontend UI", "React.js", "19.2.8", "Core component-driven user and administrator interfaces."],
        ["Frontend Build", "Vite", "8.3.0", "Next-generation ES modules frontend bundler and dev server."],
        ["Frontend Routing", "React Router DOM", "7.18.4", "Declarative client-side routing, protected routes, and layouts."],
        ["Web3 Client", "Ethers.js", "6.17.0", "Ethereum wallet provider, contract abstraction, wei conversion."],
        ["Database SDK", "@supabase/supabase-js", "2.117.3", "Supabase client for Auth sessions, RLS queries, and Storage."],
        ["Icons & UI", "Lucide React", "1.55.0", "Consistent institutional icons for dashboards and metrics."],
        ["Visualizations", "Recharts", "3.10.1", "Responsive SVG charts for asset valuation and portfolio distribution."],
        ["Linter & QA", "Oxlint", "1.81.0", "High-performance Rust-based JavaScript and React linter."],
        ["Backend Runtime", "Node.js (CommonJS)", "v20+ / v24", "Server runtime environment for REST API microservice."],
        ["Backend Server", "Express.js", "4.19.2", "REST API routing for admin verification, receipts, and health."],
        ["Security Middleware", "Express Rate Limit", "7.2.0", "Brute-force protection for authentication endpoints."],
        ["File Uploads", "Multer", "1.4.5-lts", "Multipart/form-data handler for asset document streaming."],
        ["Direct DB Driver", "pg (node-postgres)", "8.11.5", "Direct PostgreSQL connection pool for event indexing."],
        ["Cloud Database", "PostgreSQL (Supabase)", "15.0+", "Relational engine with Row Level Security and triggers."],
        ["Authentication", "Supabase Auth (GoTrue)", "Cloud", "Secure JWT token management, encrypted credential storage."],
        ["Private Storage", "Supabase S3 Storage", "Cloud", "Encrypted bucket asset-documents with 5-minute signed URLs."],
        ["Smart Contracts", "Solidity", "^0.8.24", "High-level contract language with EVM Shanghai/Cancun target."],
        ["Blockchain Dev", "Hardhat", "2.22.2", "Ethereum development environment, compiling, and testing."],
        ["Contract Standards", "OpenZeppelin Contracts", "5.0.2", "Audited implementations of ERC721, Ownable, ReentrancyGuard."],
        ["Wallet Extension", "MetaMask (EIP-1193)", "Browser", "Non-custodial key custody, signature signing, gas payment."],
        ["Target Network", "Ethereum Sepolia", "11155111", "Proof-of-Stake Ethereum public testnet for on-chain execution."]
    ]
    create_table(tech_headers, tech_rows, col_widths=[1.3, 1.8, 0.8, 2.6])

    # 6.0 AI MODELS USED
    add_heading_1("6.0 AI MODELS USED AND DEVELOPER TOOL DECLARATION")
    add_p(
        "A rigorous inspection of the Assetra codebase confirms the following regarding Artificial Intelligence integration:"
    )
    add_bullet("Application Runtime Features (Zero AI Dependencies):", "No AI models, machine learning algorithms, or external Large Language Model (LLM) APIs (such as OpenAI GPT, Google Gemini, Anthropic Claude, HuggingFace, or LangChain) are integrated into Assetra's production application logic. The application does not use AI for asset valuation, legal deed parsing, investment advice, or automated smart contract auditing.")
    add_bullet("Deterministic Protocol Execution:", "All asset valuations are entered directly from accredited human appraisal firms. Compliance reviews are conducted by authorized administrative auditors, and blockchain transactions execute through deterministic, immutable Solidity smart contracts.")
    add_bullet("Development Assistance Tool Declaration:", "Google Antigravity (powered by Gemini) was utilized exclusively as an agentic AI developer tool during engineering. It assisted with rapid scaffolding, architecture design, test-driven development, code refactoring, and debugging across the React frontend, Express backend, and Hardhat test suites.")

    # 7.0 DETAILED SYSTEM ARCHITECTURE
    add_heading_1("7.0 DETAILED SYSTEM ARCHITECTURE")
    add_p(
        "Assetra's architecture is structured across four primary tiers: User Presentation, Client Integration, Off-Chain Storage & Backend, and the On-Chain Smart Contract Suite. The system avoids the fragile bottleneck of routing all Web3 transactions through a backend proxy; instead, the frontend directly interfaces with Supabase for data queries and directly with Ethereum Sepolia for cryptographic operations."
    )

    # Insert Architecture Diagram Image
    arch_img_path = "C:/Assetra/docs/assetra_architecture_diagram.png"
    if os.path.exists(arch_img_path):
        p_img = doc.add_paragraph()
        p_img.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p_img.paragraph_format.space_before = Pt(8)
        p_img.paragraph_format.space_after = Pt(4)
        run_img = p_img.add_run()
        run_img.add_picture(arch_img_path, width=Inches(6.2))

        p_cap = doc.add_paragraph()
        p_cap.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p_cap.paragraph_format.space_before = Pt(0)
        p_cap.paragraph_format.space_after = Pt(10)
        r_cap = p_cap.add_run("Figure 7.1: Detailed Assetra Platform Architecture and Data Flow Diagram")
        r_cap.font.name = "Times New Roman"
        r_cap.font.size = Pt(9.5)
        r_cap.italic = True
        r_cap.font.color.rgb = RGBColor(71, 85, 105)

    add_heading_2("7.1 Architectural Layers")
    add_bullet("1. User Presentation Layer:", "A React 19 SPA providing isolated user portals: the Asset Owner Portal for registration, tokenization, and portfolio management; the Compliance Administrator Desk for auditing and approving dossiers; and the Investor Marketplace for asset discovery and purchasing.")
    add_bullet("2. Client Integration & Security Gateway:", "Incorporates Ethers.js v6 communicating directly with MetaMask over the EIP-1193 provider standard, handling chain ID validation (11155111) and gas estimation. Concurrently, the Supabase Client SDK manages GoTrue JWT sessions and real-time database subscriptions.")
    add_bullet("3. Off-Chain Storage & Backend Microservice:", "Consists of Supabase PostgreSQL v15+ enforcing Row Level Security (RLS) policies on all tables, automated SQL triggers (handle_new_user, prevent_role_escalation), private S3-compatible document storage (asset-documents), and an Express.js microservice supporting administrative health monitoring and receipt generation.")
    add_bullet("4. On-Chain Smart Contract Suite:", "Deployed on Ethereum Sepolia, consisting of AssetRegistry.sol (central registry and compliance gate), AssetToken.sol (ERC-721 tokenized deed certificates), and AssetMarketplace.sol (non-custodial atomic escrow marketplace).")

    add_heading_2("7.2 Off-Chain / On-Chain Data Flow")
    add_p(
        "The lifecycle begins completely off-chain to eliminate gas fees during initial asset registration and administrative auditing. When an approved asset is tokenized, the frontend sends a signed transaction directly to the AssetToken contract on Sepolia. Upon block confirmation, the minted Token ID and transaction receipt are passed to Supabase via an atomic stored procedure (record_token_purchase), ensuring strict data consistency across Web2 and Web3 storage."
    )

    # 8.0 BLOCKCHAIN COMPONENTS AND SMART CONTRACTS
    add_heading_1("8.0 BLOCKCHAIN COMPONENTS AND SMART CONTRACT SPECIFICATIONS")
    add_p(
        "Ethereum execution requires understanding Externally Owned Accounts (EOAs), contract accounts, gas mechanics, and EVM state storage. In Assetra, users interact via MetaMask EOAs, signing transactions with secp256k1 private keys. Gas fees are calculated dynamically using Sepolia EIP-1559 fee data (maxFeePerGas and maxPriorityFeePerGas)."
    )

    add_heading_2("8.1 Deployed Smart Contract Specifications")

    add_heading_3("1. AssetToken.sol (ERC-721 Tokenized Deed Certificate)")
    add_p(
        "Address: 0x2F0d80D15773A473A00bE3B732D4B46974732501 | Compiler: Solidity ^0.8.24 | Standard: ERC-721 URIStorage, Ownable"
    )
    add_bullet("Purpose:", "Represents individual, non-fungible real-world asset title deeds on Ethereum Sepolia. Exactly one token is minted for each physical asset dossier (1 Token = 1 Physical Property Deed).")
    add_bullet("Key Functions:", "")
    add_bullet("mintAssetToken(address to, string metadataURI):", "Mints a new ERC-721 token with an auto-incrementing ID, assigns ownership to recipient, sets the metadata URI pointer, and emits TokenMinted. Restricted to contract owner or authorized registry.")
    add_bullet("setRegistryContract(address _registry):", "One-time authorization granting the AssetRegistry contract minter permissions.")
    add_bullet("getCurrentTokenId():", "Returns total number of minted asset tokens.")
    add_bullet("Standard ERC-721 Inherited Functions:", "ownerOf(tokenId), tokenURI(tokenId), approve(to, tokenId), setApprovalForAll(operator, approved), safeTransferFrom(from, to, tokenId).")

    add_heading_3("2. AssetRegistry.sol (On-Chain Compliance & State-Machine Registry)")
    add_p(
        "Address: 0x525E82f822E004838004ffd6Fe1366Be244EC671 | Compiler: Solidity ^0.8.24 | Standard: Ownable"
    )
    add_bullet("Purpose:", "Acts as an on-chain anchor for asset dossiers, valuation benchmarks, verifier signatures, and the compliance gating mechanism that prevents unauthorized minting.")
    add_bullet("Key Functions:", "")
    add_bullet("registerAsset(assetId, name, category, location, valuationUSD, custodian, ipfsHash):", "Records asset specifications on-chain under Submitted status.")
    add_bullet("approveAssetOnChain(string assetId):", "Verifier-only access gate. Marks isApproved = true, sets status to Approved, and records verifier address and block timestamp.")
    add_bullet("rejectAssetOnChain(string assetId, string reason):", "Verifier-only gate marking asset as Rejected.")
    add_bullet("tokenizeAsset(string assetId):", "Verifies caller is owner and isApproved == true, invokes AssetToken.mintAssetToken, marks status as Tokenized, and binds the minted Token ID.")
    add_bullet("getAsset(string assetId) / isRegistered(string assetId):", "Read-only view functions returning full on-chain asset records and registration state.")

    add_heading_3("3. AssetMarketplace.sol (Trustless Atomic Settlement Marketplace)")
    add_p(
        "Address: 0x517082aA429ED926BDbeC904a1879BaE1aFd05f7 | Compiler: Solidity ^0.8.24 | Standard: ReentrancyGuard, Ownable"
    )
    add_bullet("Purpose:", "Provides non-custodial peer-to-peer listing, escrow, and atomic settlement for tokenized ERC-721 assets, eliminating counterparty settlement risk.")
    add_bullet("Key Functions:", "")
    add_bullet("listItem(address tokenContract, uint256 tokenId, uint256 price, string assetId):", "Verifies token ownership and contract approval, locks listing details, and emits ItemListed.")
    add_bullet("buyItem(address tokenContract, uint256 tokenId) payable nonReentrant:", "Enforces Checks-Effects-Interactions pattern: validates active listing, verifies msg.value >= price, prevents self-purchases, forwards exact ETH payment to seller, refunds excess payment, safeTransfers the ERC-721 token to buyer, and deactivates listing.")
    add_bullet("delistItem(address tokenContract, uint256 tokenId):", "Allows active seller or admin to deactivate a listing.")
    add_bullet("updatePrice(address tokenContract, uint256 tokenId, uint256 newPrice):", "Allows seller to modify listing price in wei.")
    add_bullet("getListing(tokenContract, tokenId) / isAvailableForPurchase(tokenContract, tokenId):", "Authoritative view functions confirming listing activity, price, and current token ownership.")

    # 9.0 COMPLETE APPLICATION WORKFLOW
    add_heading_1("9.0 COMPLETE APPLICATION WORKFLOW")

    add_heading_2("9.1 Asset Owner Workflow")
    add_p(
        "1. Registration: The asset owner registers and authenticates through /user/register. They navigate to /register and submit the property dossier (name, category, location, INR valuation, valuation firm, appraisal date, token standard, and supply). They upload legal title deeds and survey maps to private cloud storage. This step is 100% off-chain and costs zero gas."
    )
    add_p(
        "2. Status Tracking: The owner monitors the asset on /verification. If the auditor requests clarification, the asset enters MORE_INFO_REQUESTED, allowing the owner to revise details and upload additional documents."
    )
    add_p(
        "3. Tokenization with ETH Price: Once the asset is APPROVED, the owner opens the Tokenize modal on /user/dashboard. They specify the selling price in Sepolia ETH (e.g. 0.0101 Sepolia ETH). The interface validates positive decimal precision, calculates wei via ethers.parseEther, and displays real-time gas estimates."
    )
    add_p(
        "4. Single On-Chain Minting: The owner signs one transaction in MetaMask, executing AssetToken.mintAssetToken on Sepolia. Upon confirmation, the asset becomes TOKENIZED with Token ID #N, and the proposed ETH selling price is activated."
    )

    add_heading_2("9.2 Administrator Workflow")
    add_p(
        "1. Compliance Queue: The administrator logs into /admin/login. They access the compliance desk at /admin/pending-reviews, filtering assets in PENDING_REVIEW or UNDER_REVIEW."
    )
    add_p(
        "2. Secure Document Inspection: The administrator inspects submitted title deeds and valuation reports via 5-minute ephemeral signed URLs generated from private Supabase Storage, preserving document confidentiality."
    )
    add_p(
        "3. Audit Decision: The admin executes Start Review, Approve, Reject (with reason), or Request More Info. Approving sets is_verified = true and approved_at = now(). Every administrative decision generates an immutable entry in public.audit_logs."
    )
    add_p(
        "4. Custody & Telemetry Auditing: The admin monitors approved assets, verifies live ERC-721 token holders across secondary transfers on /admin/token-owners, and tracks smart contract block metrics on /admin/blockchain."
    )

    add_heading_2("9.3 Buyer / Investor Workflow")
    add_p(
        "1. Marketplace Discovery: The investor explores verified assets on /explore, filtering by category and location. Each card displays property photos, audited INR valuation, and the live Sepolia ETH price."
    )
    add_p(
        "2. Dossier Inspection: The investor views /asset/:id, reviewing custodial specifications, tokenomics, and smart contract addresses."
    )
    add_p(
        "3. Pre-Flight Verification & MetaMask Purchase: The investor clicks 'Buy Token'. The system verifies MetaMask is connected to Sepolia (11155111), queries AssetMarketplace.sol for the authoritative price in wei, and confirms the listing is active. The buyer signs the transaction, sending exact ETH plus network gas."
    )
    add_p(
        "4. Atomic Settlement & Receipt Generation: The smart contract atomically transfers ETH to the seller and the ERC-721 token to the buyer. Frontend calls record_token_purchase RPC to update database ownership to the buyer's wallet, delist the asset, and log an immutable acquisition receipt."
    )
    add_p(
        "5. Portfolio & Public Verification: The buyer views the acquired deed under /portfolio, downloads a verifiable Acquisition Receipt PDF with cryptographic hashes, and uses /blockchain-verification to audit 16 on-chain fields against Sepolia RPC with 100% verified match."
    )

    # 10.0 FRACTIONAL INVESTMENT
    add_heading_1("10.0 FRACTIONAL INVESTMENT (TECHNICAL IMPLEMENTATION ANALYSIS)")
    add_p(
        "A rigorous, academically honest evaluation of the Assetra platform requires distinguishing between implemented off-chain financial calculations and the actual on-chain smart contract architecture:"
    )
    add_heading_2("10.1 Implemented Off-Chain Fractional Calculations")
    add_p(
        "In the registration interface (/register) and asset details pages (/asset/:id), the platform supports fractional unit representations. Users can select ERC-1155 (Fractional Token Shares) and define a total supply (e.g. 100 or 1,000 shares). The frontend dynamically calculates fractional share price using the formula:"
    )
    add_p(
        "Unit Share Price = (Total Appraised Valuation) / (Total Supply)"
    )
    add_p(
        "For example, a commercial parcel valued at ₹10,00,00,000 with a total supply of 1,000 shares displays an audited unit price of ₹1,00,000 per share. This enables prospective investors to evaluate proportional asset exposure and yield distribution mathematically."
    )

    add_heading_2("10.2 On-Chain Reality: Whole ERC-721 Non-Fungible Ownership")
    add_p(
        "Crucially, the deployed smart contracts on Ethereum Sepolia (AssetToken.sol, AssetRegistry.sol, and AssetMarketplace.sol) currently enforce whole ERC-721 token ownership. Each physical asset is minted as exactly one non-fungible deed certificate (1 NFT = 1 Asset Deed). When an investor buys an asset on the marketplace, they pay the full listed Sepolia ETH price (e.g. 0.0101 ETH) and receive the entire ERC-721 token."
    )
    add_p(
        "Fractional ERC-1155 tokens or ERC-20 vault shares are not currently deployed or traded on-chain. The share count in the current prototype functions as an off-chain financial projection model. Implementing multi-owner on-chain fractional vaults (where an ERC-721 deed is locked in an escrow contract that mints fractional ERC-20 governance shares) is formally scheduled for Phase 2."
    )

    # 11.0 SAMPLE SCREENSHOTS
    add_heading_1("11.0 SAMPLE SCREENSHOTS AND SYSTEM INTERFACE EXHIBITS")
    add_p(
        "The following figures present genuine photographic exhibits captured directly from the live running Assetra platform, showcasing core workflows across user registration, administrative compliance, on-chain tokenization, verified marketplace trading, and blockchain auditing."
    )

    user_uploaded_dir = "C:/Users/Yashas Kiran.AN/.gemini/antigravity/brain/29d24f87-a39b-48ea-8f74-ad82362c188a/.user_uploaded"
    screenshots_cache_dir = "C:/Assetra/docs/screenshots"
    os.makedirs(screenshots_cache_dir, exist_ok=True)
    
    # 8 Required Screenshots / Exhibits
    exhibits = [
        {
            "fig": "Figure 11.1",
            "title": "Asset Owner Dashboard & Active Vault Holdings Ledger (/user/dashboard)",
            "desc": "Real-time owner dashboard showing total audited vault appraisal, cryptographically minted certificate counts, and the Active Vault Holdings ledger with token standard badges.",
            "file": "media_1793560184871_1a8e7882.jpg"
        },
        {
            "fig": "Figure 11.2",
            "title": "Real-World Asset Registration Form with Private Document Vault (/register)",
            "desc": "Asset registration interface capturing property specifications, audited valuation, accredited appraiser credentials, and multi-file title deed upload to encrypted cloud storage.",
            "file": None,
            "placeholder_text": "[INSERT SCREENSHOT: Asset Registration Form showing Asset Name, Valuation, Location, and Document Upload Dropzone]"
        },
        {
            "fig": "Figure 11.3",
            "title": "Administrator Compliance Review Desk (/admin/pending-reviews)",
            "desc": "Compliance auditor desk displaying the queue of assets awaiting review, with tools to generate 5-minute ephemeral signed URLs for private title deed inspection.",
            "file": None,
            "placeholder_text": "[INSERT SCREENSHOT: Admin Pending Reviews Desk with Asset Queue and Review Action Buttons]"
        },
        {
            "fig": "Figure 11.4",
            "title": "Administrative Compliance Approval & Status Progression Desk",
            "desc": "Administrative interface showing the execution of compliance clearance (Approve, Reject with reason, or Request More Info), creating an immutable audit log entry.",
            "file": None,
            "placeholder_text": "[INSERT SCREENSHOT: Asset Approval Modal showing verifier address, approval timestamp, and compliance certification]"
        },
        {
            "fig": "Figure 11.5",
            "title": "On-Chain Tokenization Desk with Sepolia ETH Price & MetaMask Prompt",
            "desc": "Asset owner initiating single-transaction ERC-721 tokenization on Ethereum Sepolia, setting the token selling price in Sepolia ETH with MetaMask gas confirmation.",
            "file": "media_1793528680017_f15128f0.jpg"
        },
        {
            "fig": "Figure 11.6",
            "title": "Institutional Verified Asset Marketplace (/explore)",
            "desc": "Marketplace discovery interface where prospective investors explore verified assets, inspect audited valuations, and review on-chain title holder wallet addresses.",
            "file": "media_1793549884708_0a3d0b61.jpg"
        },
        {
            "fig": "Figure 11.7",
            "title": "Trustless On-Chain Token Purchase Modal with Sepolia ETH Settlement",
            "desc": "Buyer purchasing a tokenized asset via MetaMask: smart contract executes atomic swap of Sepolia ETH to seller and ERC-721 NFT deed to buyer.",
            "file": "media_1793550623841_5d262cbc.jpg"
        },
        {
            "fig": "Figure 11.8",
            "title": "Investor Portfolio, Acquisition Receipts & Live Blockchain Verification Desk",
            "desc": "Live cryptographic verification engine auditing deployed Ethereum Sepolia contract state against database records across 16 fields, confirming 100% alignment.",
            "file": "media_1793561309454_b485240a.jpg"
        }
    ]

    for exh in exhibits:
        has_image = False
        if exh["file"]:
            src_path = os.path.join(user_uploaded_dir, exh["file"])
            if os.path.exists(src_path):
                try:
                    dst_path = os.path.join(screenshots_cache_dir, exh["file"].replace('.jpg', '.png'))
                    if not os.path.exists(dst_path):
                        im = Image.open(src_path).convert('RGB')
                        im.save(dst_path, format='PNG')
                    
                    p_img = doc.add_paragraph()
                    p_img.alignment = WD_ALIGN_PARAGRAPH.CENTER
                    p_img.paragraph_format.space_before = Pt(6)
                    p_img.paragraph_format.space_after = Pt(2)
                    run_img = p_img.add_run()
                    run_img.add_picture(dst_path, width=Inches(5.7))
                    has_image = True
                except Exception as e:
                    print(f"Notice processing {exh['file']}: {e}")
                    has_image = False

        if not has_image:
            # Create a clearly labeled academic placeholder frame
            p_box = doc.add_paragraph()
            p_box.alignment = WD_ALIGN_PARAGRAPH.CENTER
            p_box.paragraph_format.space_before = Pt(6)
            p_box.paragraph_format.space_after = Pt(2)
            
            # Use a clean 1-cell table as a placeholder box
            tbl = doc.add_table(rows=1, cols=1)
            tbl.alignment = WD_TABLE_ALIGNMENT.CENTER
            c = tbl.cell(0, 0)
            c.width = Inches(5.7)
            set_cell_shading(c, "F8FAFC")
            set_cell_margins(c, top=200, bottom=200, left=200, right=200)
            set_cell_border(c, top=dict(val='dashed', sz=6, color='94A3B8'),
                               bottom=dict(val='dashed', sz=6, color='94A3B8'),
                               left=dict(val='dashed', sz=6, color='94A3B8'),
                               right=dict(val='dashed', sz=6, color='94A3B8'))
            cp = c.paragraphs[0]
            cp.alignment = WD_ALIGN_PARAGRAPH.CENTER
            c_run = cp.add_run(exh.get("placeholder_text", f"[INSERT SCREENSHOT: {exh['title']}]"))
            c_run.font.name = "Times New Roman"
            c_run.font.size = Pt(10)
            c_run.italic = True
            c_run.font.color.rgb = RGBColor(100, 116, 139)

        # Caption
        p_cap = doc.add_paragraph()
        p_cap.alignment = WD_ALIGN_PARAGRAPH.CENTER
        p_cap.paragraph_format.space_before = Pt(2)
        p_cap.paragraph_format.space_after = Pt(8)
        r_cap = p_cap.add_run(f"{exh['fig']}: {exh['title']}\n")
        r_cap.font.name = "Times New Roman"
        r_cap.font.size = Pt(9.5)
        r_cap.bold = True
        r_cap.font.color.rgb = RGBColor(15, 23, 42)

        r_sub = p_cap.add_run(exh["desc"])
        r_sub.font.name = "Times New Roman"
        r_sub.font.size = Pt(8.5)
        r_sub.italic = True
        r_sub.font.color.rgb = RGBColor(71, 85, 105)

    # 12.0 CONCLUSION
    add_heading_1("12.0 CONCLUSION AND FUTURE ENHANCEMENTS")
    add_p(
        "The Assetra project successfully demonstrates a production-grade, functional prototype for institutional real-world asset tokenization and trustless decentralized secondary market trading. By uniting gasless off-chain compliance auditing in Supabase with non-fungible ERC-721 deed tokenization on Ethereum Sepolia, Assetra overcomes the historical trilemma of asset illiquidity, transaction cost, and regulatory auditability."
    )

    add_heading_2("12.1 Key Achievements")
    add_bullet("Decoupled Hybrid Architecture:", "Off-chain administrative compliance desks prevent unverified assets from touching the blockchain, preserving protocol integrity while eliminating gas costs during registration.")
    add_bullet("Confidentiality-Preserving Document Vault:", "Physical title deeds and surveyor blueprints remain encrypted in private cloud storage with 5-minute ephemeral signed URLs, anchoring only cryptographic hash pointers on-chain.")
    add_bullet("Single-Transaction Tokenization:", "Asset owners mint ERC-721 tokens and set custom Sepolia ETH selling prices in a single gas transaction, avoiding redundant multi-step contract calls.")
    add_bullet("Atomic Non-Custodial Marketplace:", "The AssetMarketplace contract guarantees atomic settlement using the Checks-Effects-Interactions pattern and ReentrancyGuard, routing ETH to sellers and NFT deeds to buyers without intermediary counterparty risk.")
    add_bullet("Public Auditability & 100% Cryptographic Alignment:", "The Blockchain Verification engine allows any independent auditor to verify 16 live contract parameters directly against Ethereum Sepolia RPC.")

    add_heading_2("12.2 Limitations and Future Roadmap")
    add_bullet("Phase 2 On-Chain Fractionalization:", "Deploying ERC-1155 multi-tokens or ERC-20 fractional vault smart contracts that partition locked ERC-721 deeds into tradable shares, allowing fractional co-ownership on-chain.")
    add_bullet("Decentralized Valuation Oracles:", "Integrating Chainlink or API3 oracle feeds to stream real-time fiat and real estate price indices onto smart contracts, reducing dependence on static appraisal dates.")
    add_bullet("Multi-Signature Governance:", "Expanding single-admin compliance approvals into a multi-signature consortium requiring consensus among multiple certified surveyor firms before unlocking tokenization.")

    # Save Output
    output_path = "C:/Assetra/ASSETRA_Final_Project_Report.docx"
    doc.save(output_path)
    print(f"Report generated successfully: {output_path}")

    # Calculate Word & Paragraph Stats
    total_words = 0
    for p in doc.paragraphs:
        total_words += len(p.text.split())
    for t in doc.tables:
        for r in t.rows:
            for cell in r.cells:
                for cp in cell.paragraphs:
                    total_words += len(cp.text.split())

    print(f"Total Word Count: {total_words} words")
    return output_path, total_words

if __name__ == "__main__":
    generate_report()
