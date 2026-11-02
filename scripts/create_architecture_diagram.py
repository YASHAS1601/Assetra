import os
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patches as patches

os.environ['MPLCONFIGDIR'] = 'C:/Assetra/scratch/mpl'
os.makedirs('C:/Assetra/scratch/mpl', exist_ok=True)
os.makedirs('C:/Assetra/docs', exist_ok=True)

fig, ax = plt.subplots(figsize=(11, 8.5), dpi=300)
ax.set_xlim(0, 100)
ax.set_ylim(0, 100)
ax.axis('off')

# Background
fig.patch.set_facecolor('#FFFFFF')
ax.set_facecolor('#FFFFFF')

def draw_box(x, y, w, h, title, subtitle="", bg='#F8FAFC', border='#334155', title_color='#0F172A', sub_color='#475569', radius=1.5, title_size=10, sub_size=8):
    box = patches.FancyBboxPatch((x, y), w, h, boxstyle=f"round,pad=0.2,rounding_size={radius}",
                                fc=bg, ec=border, lw=1.5, zorder=2)
    ax.add_patch(box)
    if subtitle:
        ax.text(x + w/2, y + h*0.62, title, ha='center', va='center', fontsize=title_size, fontweight='bold', color=title_color, zorder=3)
        ax.text(x + w/2, y + h*0.32, subtitle, ha='center', va='center', fontsize=sub_size, color=sub_color, zorder=3)
    else:
        ax.text(x + w/2, y + h/2, title, ha='center', va='center', fontsize=title_size, fontweight='bold', color=title_color, zorder=3)

def draw_arrow(x1, y1, x2, y2, label="", color='#475569', label_offset=(0, 0), style='->'):
    ax.annotate('', xy=(x2, y2), xytext=(x1, y1),
                arrowprops=dict(arrowstyle=style, color=color, lw=1.5, shrinkA=3, shrinkB=3),
                zorder=4)
    if label:
        mx = (x1 + x2) / 2 + label_offset[0]
        my = (y1 + y2) / 2 + label_offset[1]
        ax.text(mx, my, label, ha='center', va='center', fontsize=7.5, fontweight='semibold',
                color=color, bbox=dict(boxstyle='square,pad=0.15', fc='white', ec='none'), zorder=5)

# Title Header
ax.text(50, 97, 'ASSETRA PLATFORM ARCHITECTURE & SYSTEM DATA FLOW', ha='center', va='center', fontsize=13, fontweight='bold', color='#0F172A')
ax.text(50, 94.5, 'Hybrid Web2 / Web3 Infrastructure for Real-World Asset Tokenization & Settlement', ha='center', va='center', fontsize=9, color='#475569')

# Layer 1: User Roles
draw_box(4, 84, 28, 7.5, 'Asset Owner (Issuer)', 'Dossier Registration, Document Upload, Token Minting', bg='#F1F5F9', border='#0F172A', radius=1.0)
draw_box(36, 84, 28, 7.5, 'Compliance Administrator', 'Dossier Verification, Document Audit, Review Approval', bg='#F1F5F9', border='#0F172A', radius=1.0)
draw_box(68, 84, 28, 7.5, 'Buyer / Investor', 'Marketplace Discovery, Etherscan Audit, Token Purchase', bg='#F1F5F9', border='#0F172A', radius=1.0)

# Connect Users to Frontend
draw_arrow(18, 84, 25, 76, color='#0F172A')
draw_arrow(50, 84, 50, 76, color='#0F172A')
draw_arrow(82, 84, 75, 76, color='#0F172A')

# Layer 2: Frontend Application
draw_box(4, 66, 92, 10, 'FRONTEND APPLICATION LAYER (React 19 + Vite)',
         'User Dashboard | Register Asset | Verification Desk | Admin Reviews | Marketplace | Portfolio | Blockchain Audit',
         bg='#E2E8F0', border='#0F172A', title_size=11, sub_size=8.5, radius=1.2)

# Sub-components / Connectors below frontend
draw_box(8, 54, 38, 7, 'Supabase Client SDK', 'GoTrue Auth, Real-Time Sessions, Ephemeral Signed URLs', bg='#F8FAFC', border='#334155', radius=0.8)
draw_box(54, 54, 38, 7, 'Web3 Provider (Ethers.js v6 + MetaMask)', 'EIP-1193 Signer, Gas Estimator, Sepolia RPC Interactor', bg='#F8FAFC', border='#334155', radius=0.8)

draw_arrow(27, 66, 27, 61, color='#334155')
draw_arrow(73, 66, 73, 61, color='#334155')

# Middle Layer Left: Database & Backend (Off-Chain)
# Outer box for Off-Chain
rect_offchain = patches.FancyBboxPatch((4, 22), 44, 28, boxstyle="round,pad=0.2,rounding_size=1.5",
                                      fc='#F8FAFC', ec='#64748B', lw=1.2, ls='--', zorder=1)
ax.add_patch(rect_offchain)
ax.text(26, 48.5, 'OFF-CHAIN STORAGE & BACKEND LAYER', ha='center', va='center', fontsize=9, fontweight='bold', color='#1E293B', zorder=2)

draw_box(6, 37.5, 40, 9.5, 'Supabase Cloud PostgreSQL (v15+)',
         'Tables: profiles, assets, asset_documents, audit_logs, receipts\nRow-Level Security (RLS) & Triggers (is_admin, prevent_role_escalation)',
         bg='#FFFFFF', border='#0F172A', title_size=8.5, sub_size=7, radius=0.8)

draw_box(6, 24, 19, 11, 'Private S3 Storage\n(asset-documents)', '10MB MIME Limits\n5-Min Signed URLs\nTitle Deeds & Audits',
         bg='#FFFFFF', border='#334155', title_size=8, sub_size=6.5, radius=0.8)

draw_box(27, 24, 19, 11, 'Node.js / Express API\n(REST Microservice)', 'Admin Management\nBlockchain Indexer\nReceipt Processing',
         bg='#FFFFFF', border='#334155', title_size=8, sub_size=6.5, radius=0.8)

# Middle Layer Right: Blockchain Layer (On-Chain)
# Outer box for On-Chain
rect_onchain = patches.FancyBboxPatch((52, 22), 44, 28, boxstyle="round,pad=0.2,rounding_size=1.5",
                                     fc='#F8FAFC', ec='#64748B', lw=1.2, ls='--', zorder=1)
ax.add_patch(rect_onchain)
ax.text(74, 48.5, 'ON-CHAIN SMART CONTRACT SUITE (Ethereum Sepolia)', ha='center', va='center', fontsize=9, fontweight='bold', color='#1E293B', zorder=2)

draw_box(54, 38, 40, 9, 'AssetRegistry.sol (0x525E8...EC671)',
         'Asset Dossier Registry, Valuations, Verifier Signatures\nOn-Chain Compliance Gating for Tokenization',
         bg='#FFFFFF', border='#0F172A', title_size=8.5, sub_size=7, radius=0.8)

draw_box(54, 24, 19, 12, 'AssetToken.sol\n(0x2F0d8...32501)', 'ERC-721 Deed Token\nOwnable, URIStorage\nmintAssetToken()\n1 Token = 1 Deed',
         bg='#FFFFFF', border='#334155', title_size=8, sub_size=6.5, radius=0.8)

draw_box(75, 24, 19, 12, 'AssetMarketplace.sol\n(0x51708...05f7)', 'Trustless Atomic Escrow\nReentrancyGuard\nlistItem(), buyItem()\nAtomic ETH / NFT Swap',
         bg='#FFFFFF', border='#334155', title_size=8, sub_size=6.5, radius=0.8)

# Connect Client to Layers
draw_arrow(27, 54, 27, 47, label='Direct Auth & RLS Queries', label_offset=(0, 0.5), color='#0F172A')
draw_arrow(73, 54, 73, 47, label='MetaMask Signatures & Calls', label_offset=(0, 0.5), color='#0F172A')

# Internal connections between on-chain contracts
draw_arrow(64, 38, 64, 36, label='Authorize Mint', label_offset=(-5, 0), color='#475569')
draw_arrow(73, 30, 75, 30, label='Escrow Transfer', label_offset=(0, 1.2), color='#475569')

# Bottom Settlement Reconciliation Arrow
draw_box(18, 5, 64, 11, 'POST-PURCHASE STATE SYNCHRONIZATION & RECONCILIATION',
         '1. Buyer calls buyItem() with Sepolia ETH -> 2. Smart Contract atomically swaps ETH & NFT deed\n'
         '3. Frontend invokes record_token_purchase RPC -> 4. Supabase updates ownership & creates purchase receipt\n'
         '5. Real-Time Blockchain Verification audits 16 on-chain fields against Sepolia RPC with 100% alignment',
         bg='#F1F5F9', border='#0F172A', title_size=9, sub_size=7.5, radius=1.0)

draw_arrow(36, 22, 36, 16, color='#334155')
draw_arrow(64, 22, 64, 16, color='#334155')

fig.savefig('C:/Assetra/docs/assetra_architecture_diagram.png', bbox_inches='tight', facecolor='white')
print('Successfully generated assetra_architecture_diagram.png')

