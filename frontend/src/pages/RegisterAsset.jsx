import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAssets } from '../context/AssetContext';
import { useWeb3 } from '../context/Web3Context';
import { useAuth } from '../context/AuthContext';
import { Modal } from '../components/common/Modal';
import { SwipeToSubmit } from '../components/common/SwipeToSubmit';
import { CURRENCIES, DEFAULT_CURRENCY, formatCurrency } from '../constants/currencies';

import {
  ShieldCheck,
  Building2,
  DollarSign,
  Boxes,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  UploadCloud,
  FileText,
  Info,
  Lock,
  Layers,
  Image as ImageIcon,
  Trash2,
  Camera
} from 'lucide-react';

import {
  REGISTRY_CONTRACT_ADDRESS,
  getAssetRegistryContract,
  getEtherscanTxUrl,
  SEPOLIA_CHAIN_ID,
  isSepoliaOrLocalChainId
} from '../constants/contracts';

const CATEGORIES = [
  'Real Estate',
  'Commercial Real Estate',
  'Fine Art & Collectibles',
  'Infrastructure & Energy',
  'Precious Metals & Commodities',
  'Private Aviation & Logistics',
  'Private Equity & Debt'
];

export const RegisterAsset = () => {
  const navigate = useNavigate();
  const { registerAsset, uploadAssetDocument } = useAssets();
  const { user } = useAuth();
  const {
    account,
    chainId,
    isConnected,
    isSepolia,
    hasMetaMask,
    connectWallet,
    switchToSepolia,
    getSigner
  } = useWeb3();

  const [formData, setFormData] = useState({
    name: '',
    category: 'Real Estate',
    description: '',
    location: '',
    valuation: '',
    currency: DEFAULT_CURRENCY,
    appraisalDate: new Date().toISOString().split('T')[0],
    custodian: '',
    tokenSymbol: 'AST-TOK',
    tokenStandard: 'ERC-721',
    blockchainNetwork: 'Sepolia Testnet',
    totalSupply: '1',
    autoTokenize: false
  });

  const [selectedFile, setSelectedFile] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const [imageUrlInput, setImageUrlInput] = useState('');
  const [imageMode, setImageMode] = useState('file'); // 'file' | 'url'
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [showTxModal, setShowTxModal] = useState(false);
  const [txStep, setTxStep] = useState(1);
  const [createdAssetId, setCreatedAssetId] = useState(null);
  const [onChainTxHash, setOnChainTxHash] = useState('');
  const [onChainBlockNumber, setOnChainBlockNumber] = useState(null);
  const [onChainStatusText, setOnChainStatusText] = useState('');

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleImageFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 8 * 1024 * 1024) {
        setSubmitError('Asset image file exceeds maximum allowable size of 8MB.');
        return;
      }
      setImageFile(file);
      const reader = new FileReader();
      reader.onload = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleRemoveImage = () => {
    setImageFile(null);
    setImagePreview('');
    setImageUrlInput('');
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 10 * 1024 * 1024) {
        setSubmitError('File exceeds maximum size of 10MB.');
        return;
      }
      setSubmitError('');
      setSelectedFile(file);
    }
  };

  const formRef = useRef(null);

  const handleSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!formData.name || !formData.valuation) {
      setSubmitError('Please complete all required fields (Asset Title and Valuation are required).');
      return false;
    }

    setSubmitError('');
    setIsSubmitting(true);
    setShowTxModal(true);
    setTxStep(1);
    setOnChainTxHash('');
    setOnChainBlockNumber(null);
    setOnChainStatusText('Preparing real-world asset dossier...');

    try {
      // 1. Generate unique asset ID
      const uniqueSuffix = Date.now().toString(36).toUpperCase().slice(-4);
      const generatedId = `AST-${new Date().getFullYear()}-${uniqueSuffix}`;
      setCreatedAssetId(generatedId);

      // 2. Persist asset dossier into database with PENDING_REVIEW status (Off-chain, 0 gas)
      // Must be created first to satisfy asset_documents foreign key constraint
      setTxStep(1);
      setOnChainStatusText('Persisting compliance record in database vault...');
      const finalImageUrl = imagePreview || imageUrlInput.trim() || null;
      await registerAsset({
        id: generatedId,
        ...formData,
        imageUrl: finalImageUrl,
        ownerAddress: account || user?.walletAddress || '0x0000000000000000000000000000000000000000',
        userId: user?.id,
        txHash: null,
        blockNumber: null
      });

      // 3. Upload document to Supabase Storage private bucket if attached
      if (selectedFile) {
        setTxStep(2);
        setOnChainStatusText('Encrypting & uploading title deed dossier to secure vault...');
        try {
          await uploadAssetDocument(selectedFile, generatedId);
        } catch (docErr) {
          console.error('Storage upload failure:', docErr);
          setSubmitError(`Asset registered (${generatedId}), but document upload encountered an issue: ${docErr.message}`);
        }
      }

      // 4. Mark submission successful
      setTxStep(3);
      return true;
    } catch (err) {
      console.error('Asset submission failed:', err);
      const msg = err.reason || err.shortMessage || err.message || 'Asset submission failed.';
      setSubmitError(msg);
      setShowTxModal(false);
      return false;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSwipeSubmit = async () => {
    // 1. Trigger native HTML5 constraint validation on form fields
    if (formRef.current && formRef.current.reportValidity) {
      const isValid = formRef.current.reportValidity();
      if (!isValid) {
        return false; // Tells SwipeToSubmit to snap back handle
      }
    }

    // 2. Validate required fields
    if (!formData.name || !formData.valuation) {
      setSubmitError('Please complete all required fields (Asset Title and Valuation are required).');
      return false;
    }

    // 3. Execute existing submission workflow
    return await handleSubmit();
  };


  const calculatedUnitPrice =
    formData.valuation && parseInt(formData.totalSupply, 10) > 0
      ? formatCurrency(
          (parseFloat(formData.valuation) || 0) / (parseInt(formData.totalSupply, 10) || 1),
          formData.currency
        )
      : '—';

  return (
    <div style={{ maxWidth: '920px', margin: '0 auto', paddingBottom: '48px' }}>
      {/* Header */}
      <div className="page-header" style={{ marginBottom: '28px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 12px',
                borderRadius: '9999px',
                backgroundColor: 'var(--color-peach)',
                color: 'var(--color-copper)',
                fontSize: '11px',
                fontWeight: 700,
                letterSpacing: '0.06em',
                textTransform: 'uppercase'
              }}
            >
              Custodial Onboarding
            </span>
          </div>
          <h2
            className="font-serif"
            style={{
              fontSize: '34px',
              fontWeight: 600,
              color: 'var(--color-midnight-navy)',
              letterSpacing: '-0.02em',
              lineHeight: 1.2
            }}
          >
            Register Real-World Asset
          </h2>
          <p style={{ fontSize: '14.5px', color: 'var(--color-secondary-text)', marginTop: '6px' }}>
            Submit an audited physical or financial asset for institutional compliance review, custodial appraisal verification, and on-chain tokenization.
          </p>
        </div>
      </div>

      {/* Process Flow Progress Bar */}
      <div
        style={{
          padding: '20px 28px',
          marginBottom: '24px',
          backgroundColor: '#FFFFFF',
          borderRadius: '24px',
          boxShadow: 'var(--shadow-card)'
        }}
      >
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', position: 'relative' }}>
          {[
            { num: '01', title: 'Asset Identity', desc: 'Title, category, location' },
            { num: '02', title: 'Valuation', desc: 'Appraisal & custodian' },
            { num: '03', title: 'Custodial Proof', desc: 'Encrypted document deed' },
            { num: '04', title: 'Token Architecture', desc: 'Standards & supply' }
          ].map((step, idx) => (
            <div key={idx} style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 700,
                    letterSpacing: '0.04em',
                    color: 'var(--color-copper)',
                    padding: '2px 8px',
                    backgroundColor: 'var(--color-peach)',
                    borderRadius: '9999px',
                    fontFamily: 'monospace'
                  }}
                >
                  {step.num}
                </span>
                <span style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--color-midnight-navy)' }}>
                  {step.title}
                </span>
              </div>
              <span style={{ fontSize: '11.5px', color: 'var(--color-secondary-text)', lineHeight: 1.4 }}>
                {step.desc}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Institutional Legal & Regulatory Disclaimer */}
      <div
        style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '20px',
          padding: '18px 24px',
          marginBottom: '24px',
          fontSize: '13px',
          color: 'var(--color-midnight-navy)',
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          boxShadow: 'var(--shadow-card)'
        }}
      >
        <div
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            backgroundColor: 'var(--color-peach)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}
        >
          <Lock size={18} style={{ color: 'var(--color-copper)' }} />
        </div>
        <div style={{ lineHeight: 1.6 }}>
          <strong style={{ fontWeight: 600, color: 'var(--color-midnight-navy)' }}>Regulatory Title & Proof Notice:</strong> Submitting an asset to the Assetra registry initiates institutional compliance verification. An on-chain token represents beneficial interest and cryptographic proof-of-authenticity once custodial title deeds and legal custody agreements are reviewed and approved by platform administrators.
        </div>
      </div>

      {/* Submission Error Banner */}
      {submitError && (
        <div
          style={{
            backgroundColor: 'var(--color-error-bg)',
            border: '1px solid var(--color-error-border)',
            borderRadius: '16px',
            padding: '14px 20px',
            marginBottom: '20px',
            fontSize: '13.5px',
            color: 'var(--color-error)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px'
          }}
        >
          <AlertCircle size={18} style={{ flexShrink: 0 }} />
          <span>{submitError}</span>
        </div>
      )}

      {/* Main Registration Form */}
      <form
        ref={formRef}
        id="register-asset-form"
        onSubmit={handleSubmit}
        style={{
          padding: '36px',
          backgroundColor: '#FFFFFF',
          borderRadius: '26px',
          boxShadow: 'var(--shadow-card)'
        }}
      >

        {/* Section 1: Basic Information */}
        <div style={{ marginBottom: '32px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              marginBottom: '20px',
              borderBottom: '1px solid var(--color-subtle-border)',
              paddingBottom: '12px'
            }}
          >
            <Building2 size={18} style={{ color: 'var(--color-copper)' }} />
            <h3 className="font-serif" style={{ fontSize: '19px', fontWeight: 600, color: 'var(--color-charcoal)' }}>
              1. Asset Identification & Classification
            </h3>
          </div>

          <div className="input-group" style={{ marginBottom: '16px' }}>
            <label className="input-label" style={{ fontWeight: 600, color: 'var(--color-charcoal)' }}>
              Asset Title / Commercial Name <span style={{ color: 'var(--color-error)' }}>*</span>
            </label>
            <input
              type="text"
              name="name"
              required
              className="input-field"
              placeholder="e.g. One Vanderbilt Commercial Tower Suite 4200"
              value={formData.name}
              onChange={handleChange}
              style={{ height: '42px', fontSize: '13.5px' }}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <div className="input-group">
              <label className="input-label" style={{ fontWeight: 600, color: 'var(--color-charcoal)' }}>
                Asset Category <span style={{ color: 'var(--color-error)' }}>*</span>
              </label>
              <select
                name="category"
                className="input-field"
                value={formData.category}
                onChange={handleChange}
                style={{ height: '42px', fontSize: '13.5px' }}
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div className="input-group">
              <label className="input-label" style={{ fontWeight: 600, color: 'var(--color-charcoal)' }}>
                Physical Location / Jurisdiction
              </label>
              <input
                type="text"
                name="location"
                className="input-field"
                placeholder="e.g. Manhattan, New York, USA"
                value={formData.location}
                onChange={handleChange}
                style={{ height: '42px', fontSize: '13.5px' }}
              />
            </div>
          </div>

          <div className="input-group" style={{ marginBottom: '16px' }}>
            <label className="input-label" style={{ fontWeight: 600, color: 'var(--color-charcoal)' }}>
              Detailed Asset Description & Specifications
            </label>
            <textarea
              name="description"
              rows={3}
              className="input-field"
              placeholder="Specify structural details, architectural grade, occupancy profile, lease covenants, or custodial conditions..."
              value={formData.description}
              onChange={handleChange}
              style={{ fontSize: '13.5px', lineHeight: 1.5 }}
            />
          </div>

          {/* Asset Image Upload / Photograph */}
          <div className="input-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label className="input-label" style={{ fontWeight: 600, color: 'var(--color-charcoal)', margin: 0 }}>
                Asset Photograph / Visual Representation
              </label>
              <div style={{ display: 'flex', gap: '8px', fontSize: '11.5px' }}>
                <button
                  type="button"
                  onClick={() => setImageMode('file')}
                  style={{
                    border: 'none',
                    background: 'none',
                    cursor: 'pointer',
                    fontWeight: imageMode === 'file' ? 700 : 500,
                    color: imageMode === 'file' ? 'var(--color-copper)' : 'var(--color-secondary-text)',
                    textDecoration: imageMode === 'file' ? 'underline' : 'none'
                  }}
                >
                  Upload File
                </button>
                <span style={{ color: 'var(--color-subtle-border)' }}>|</span>
                <button
                  type="button"
                  onClick={() => setImageMode('url')}
                  style={{
                    border: 'none',
                    background: 'none',
                    cursor: 'pointer',
                    fontWeight: imageMode === 'url' ? 700 : 500,
                    color: imageMode === 'url' ? 'var(--color-copper)' : 'var(--color-secondary-text)',
                    textDecoration: imageMode === 'url' ? 'underline' : 'none'
                  }}
                >
                  Image URL
                </button>
              </div>
            </div>

            {imageMode === 'file' ? (
              <div
                style={{
                  border: imagePreview ? '1px solid var(--color-subtle-border)' : '2px dashed #E2E8F0',
                  backgroundColor: '#F8FAFC',
                  borderRadius: '16px',
                  padding: imagePreview ? '16px' : '24px 20px',
                  textAlign: 'center',
                  position: 'relative'
                }}
              >
                {imagePreview ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <img
                      src={imagePreview}
                      alt="Asset preview"
                      style={{
                        width: '90px',
                        height: '90px',
                        objectFit: 'cover',
                        borderRadius: '12px',
                        border: '1px solid #E2E8F0'
                      }}
                    />
                    <div style={{ textAlign: 'left', flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: '13.5px', color: 'var(--color-midnight-navy)' }}>
                        {imageFile ? imageFile.name : 'Asset Photograph Selected'}
                      </div>
                      <div style={{ fontSize: '12px', color: 'var(--color-secondary-text)', marginTop: '4px' }}>
                        {imageFile ? `${(imageFile.size / 1024).toFixed(1)} KB` : 'Image attached'} • Ready for showcase
                      </div>
                      <button
                        type="button"
                        onClick={handleRemoveImage}
                        style={{
                          marginTop: '8px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '11.5px',
                          color: 'var(--color-error)',
                          background: 'none',
                          border: 'none',
                          cursor: 'pointer',
                          padding: 0
                        }}
                      >
                        <Trash2 size={13} />
                        <span>Remove image</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/jpg,image/webp"
                      onChange={handleImageFileChange}
                      style={{
                        position: 'absolute',
                        inset: 0,
                        opacity: 0,
                        cursor: 'pointer',
                        width: '100%',
                        height: '100%'
                      }}
                    />
                    <div
                      style={{
                        width: '44px',
                        height: '44px',
                        borderRadius: '50%',
                        backgroundColor: 'var(--color-peach)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        margin: '0 auto 10px'
                      }}
                    >
                      <ImageIcon size={20} style={{ color: 'var(--color-copper)' }} />
                    </div>
                    <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--color-midnight-navy)' }}>
                      Click to choose or drop an asset photograph
                    </div>
                    <div style={{ fontSize: '11.5px', color: 'var(--color-secondary-text)', marginTop: '4px' }}>
                      PNG, JPG, JPEG, or WebP up to 8MB. Displays in marketplace directory and investor dossier.
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div>
                <input
                  type="url"
                  placeholder="https://example.com/images/asset.jpg"
                  className="input-field"
                  value={imageUrlInput}
                  onChange={(e) => setImageUrlInput(e.target.value)}
                  style={{ height: '42px', fontSize: '13.5px' }}
                />
                {imageUrlInput && (
                  <div style={{ marginTop: '10px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <img
                      src={imageUrlInput}
                      alt="URL preview"
                      onError={(e) => { e.target.style.display = 'none'; }}
                      style={{ width: '60px', height: '60px', objectFit: 'cover', borderRadius: '8px', border: '1px solid #E2E8F0' }}
                    />
                    <span style={{ fontSize: '12px', color: 'var(--color-secondary-text)' }}>
                      Previewing hosted asset image
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Section 2: Valuation & Custody */}
        <div style={{ marginBottom: '32px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              marginBottom: '20px',
              borderBottom: '1px solid var(--color-subtle-border)',
              paddingBottom: '12px'
            }}
          >
            <DollarSign size={18} style={{ color: 'var(--color-copper)' }} />
            <h3 className="font-serif" style={{ fontSize: '19px', fontWeight: 600, color: 'var(--color-charcoal)' }}>
              2. Valuation & Custodial Appraisal
            </h3>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <div className="input-group">
              <label className="input-label" style={{ fontWeight: 600, color: 'var(--color-charcoal)' }}>
                Appraised Valuation <span style={{ color: 'var(--color-error)' }}>*</span>
              </label>
              <input
                type="number"
                name="valuation"
                required
                min="1"
                className="input-field"
                placeholder="e.g. 7500000"
                value={formData.valuation}
                onChange={handleChange}
                style={{ height: '42px', fontSize: '13.5px' }}
              />
              {formData.valuation && !isNaN(Number(formData.valuation)) && (
                <span
                  style={{
                    color: 'var(--color-copper)',
                    fontWeight: 600,
                    marginTop: '6px',
                    display: 'block',
                    fontSize: '12px'
                  }}
                >
                  Audited valuation: {formatCurrency(formData.valuation, formData.currency)}
                </span>
              )}
            </div>

            <div className="input-group">
              <label className="input-label" style={{ fontWeight: 600, color: 'var(--color-charcoal)' }}>
                Denomination Currency
              </label>
              <select
                name="currency"
                className="input-field"
                value={formData.currency}
                onChange={handleChange}
                style={{ height: '42px', fontSize: '13.5px' }}
              >
                {CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div className="input-group">
              <label className="input-label" style={{ fontWeight: 600, color: 'var(--color-charcoal)' }}>
                Appraisal Audit Date
              </label>
              <input
                type="date"
                name="appraisalDate"
                className="input-field"
                value={formData.appraisalDate}
                onChange={handleChange}
                style={{ height: '42px', fontSize: '13.5px' }}
              />
            </div>

            <div className="input-group">
              <label className="input-label" style={{ fontWeight: 600, color: 'var(--color-charcoal)' }}>
                Custody / Appraisal Valuation Firm
              </label>
              <input
                type="text"
                name="custodian"
                className="input-field"
                placeholder="e.g. CBRE Valuation & Advisory Services"
                value={formData.custodian}
                onChange={handleChange}
                style={{ height: '42px', fontSize: '13.5px' }}
              />
            </div>
          </div>
        </div>

        {/* Section 3: Custodial Documents Vault */}
        <div style={{ marginBottom: '32px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              marginBottom: '20px',
              borderBottom: '1px solid var(--color-subtle-border)',
              paddingBottom: '12px'
            }}
          >
            <FileText size={18} style={{ color: 'var(--color-copper)' }} />
            <h3 className="font-serif" style={{ fontSize: '19px', fontWeight: 600, color: 'var(--color-charcoal)' }}>
              3. Custodial Proof & Document Vault
            </h3>
          </div>

          {/* Secure Upload Area */}
          <div className="input-group">
            <label className="input-label" style={{ fontWeight: 600, color: 'var(--color-charcoal)' }}>
              Upload Title Deed / Audit Certificate (Private Supabase Storage)
            </label>
            <div
              style={{
                border: '2px dashed #E2E8F0',
                backgroundColor: '#F8FAFC',
                borderRadius: '20px',
                padding: '32px 24px',
                textAlign: 'center',
                cursor: 'pointer',
                position: 'relative',
                transition: 'border-color 0.2s ease, background-color 0.2s ease'
              }}
            >
              <input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={handleFileChange}
                style={{
                  position: 'absolute',
                  inset: 0,
                  opacity: 0,
                  cursor: 'pointer',
                  width: '100%',
                  height: '100%'
                }}
              />
              <div
                style={{
                  width: '52px',
                  height: '52px',
                  borderRadius: '50%',
                  backgroundColor: 'var(--color-peach)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 14px'
                }}
              >
                <UploadCloud size={24} style={{ color: 'var(--color-copper)' }} />
              </div>
              <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--color-midnight-navy)' }}>
                {selectedFile ? selectedFile.name : 'Click to select or drag and drop official deed dossier'}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--color-secondary-text)', marginTop: '6px' }}>
                {selectedFile
                  ? `Selected size: ${(selectedFile.size / 1024 / 1024).toFixed(2)} MB — Ready for encrypted upload`
                  : 'PDF, PNG, JPG accepted (Maximum 10 MB). Stored securely in private asset-documents bucket.'}
              </div>
            </div>
          </div>
        </div>

        {/* Section 4: Tokenization Architecture */}
        <div style={{ marginBottom: '32px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              marginBottom: '20px',
              borderBottom: '1px solid var(--color-subtle-border)',
              paddingBottom: '12px'
            }}
          >
            <Boxes size={18} style={{ color: 'var(--color-copper)' }} />
            <h3 className="font-serif" style={{ fontSize: '19px', fontWeight: 600, color: 'var(--color-charcoal)' }}>
              4. Token Architecture & Issuance Strategy
            </h3>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <div className="input-group">
              <label className="input-label" style={{ fontWeight: 600, color: 'var(--color-charcoal)' }}>
                Token Standard
              </label>
              <select
                name="tokenStandard"
                className="input-field"
                value={formData.tokenStandard}
                onChange={handleChange}
                style={{ height: '42px', fontSize: '13.5px' }}
              >
                <option value="ERC-721">ERC-721 (Single Non-Fungible Deed)</option>
                <option value="ERC-1155">ERC-1155 (Fractional Token Shares)</option>
              </select>
            </div>

            <div className="input-group">
              <label className="input-label" style={{ fontWeight: 600, color: 'var(--color-charcoal)' }}>
                Blockchain Protocol Network
              </label>
              <input
                type="text"
                name="blockchainNetwork"
                className="input-field"
                disabled
                value={formData.blockchainNetwork}
                style={{ height: '42px', fontSize: '13.5px', backgroundColor: 'var(--color-warm-white)', color: 'var(--color-charcoal)' }}
              />
              <span className="input-helper" style={{ fontSize: '11.5px', color: 'var(--color-secondary-text)' }}>
                Deployed on Sepolia Testnet (Chain ID 11155111) / Hardhat Local.
              </span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <div className="input-group">
              <label className="input-label" style={{ fontWeight: 600, color: 'var(--color-charcoal)' }}>
                Proposed Token Supply
              </label>
              <input
                type="number"
                name="totalSupply"
                min="1"
                className="input-field"
                placeholder="e.g. 75000"
                value={formData.totalSupply}
                onChange={handleChange}
                style={{ height: '42px', fontSize: '13.5px' }}
              />
              <span className="input-helper" style={{ fontSize: '11.5px', color: 'var(--color-secondary-text)' }}>
                {parseInt(formData.totalSupply, 10) > 1
                  ? `Fractionalized: ${parseInt(formData.totalSupply, 10).toLocaleString()} token units`
                  : 'Single asset representation (1 NFT Deed)'}
              </span>
            </div>

            <div className="input-group">
              <label className="input-label" style={{ fontWeight: 600, color: 'var(--color-charcoal)' }}>
                Calculated Price Per Token Unit
              </label>
              <div
                className="input-field"
                style={{
                  height: '42px',
                  backgroundColor: '#F8FAFC',
                  borderRadius: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  fontWeight: 600,
                  color: 'var(--color-midnight-navy)',
                  fontSize: '14px',
                  border: 'none',
                  padding: '0 16px'
                }}
              >
                {calculatedUnitPrice}
              </div>
              <span className="input-helper" style={{ fontSize: '11.5px', color: 'var(--color-secondary-text)' }}>
                Computed from total appraised valuation and issued token supply.
              </span>
            </div>
          </div>

          {/* Lifecycle Guarantee */}
          <div
            style={{
              padding: '16px 20px',
              backgroundColor: 'var(--color-mint)',
              borderRadius: '18px',
              fontSize: '12.5px',
              color: 'var(--color-midnight-navy)',
              lineHeight: 1.6
            }}
          >
            <strong style={{ color: 'var(--color-midnight-navy)' }}>Lifecycle Assurance:</strong> Every registered asset enters the <strong style={{ color: 'var(--color-copper)' }}>Pending Review</strong> queue. Compliance administrators verify title records, custodial validity, and accredited appraisals. Smart contract minting is unlocked only upon formal administrator approval.
          </div>
        </div>

        {/* Form Actions with Interactive Swipe-To-Submit Control */}
        <div
          style={{
            borderTop: '1px solid rgba(0, 0, 0, 0.05)',
            paddingTop: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '18px'
          }}
        >
          {/* Header Row: Initial Status Note & Cancel Button */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px'
            }}
          >
            <div style={{ fontSize: '13px', color: 'var(--color-secondary-text)' }}>
              Initial Status: <span style={{ padding: '3px 10px', borderRadius: '9999px', backgroundColor: 'var(--color-peach)', color: 'var(--color-copper)', fontWeight: 600, fontSize: '12px' }}>Pending Administrative Review</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => navigate('/explore')}
                disabled={isSubmitting}
                style={{
                  borderRadius: '9999px',
                  padding: '8px 20px',
                  fontSize: '13px',
                  fontWeight: 600
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={isSubmitting}
                style={{
                  borderRadius: '9999px',
                  padding: '8px 24px',
                  fontSize: '13px',
                  fontWeight: 600,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <span>{isSubmitting ? 'Submitting...' : 'Submit Asset'}</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </div>

          {/* Interactive Wide Horizontal Swipe-To-Submit Control */}
          <SwipeToSubmit
            onSwipeComplete={handleSwipeSubmit}
            isSubmitting={isSubmitting}
            isSuccess={txStep === 3}
            formId="register-asset-form"
            label="Swipe to submit asset"
            activeLabel="Release to submit"
            submittingLabel="Submitting asset..."
            successLabel="Asset submitted successfully"
          />
        </div>

      </form>

      {/* Institutional Submission Progress Modal */}
      <Modal
        isOpen={showTxModal}
        onClose={() => {
          if (txStep === 3) setShowTxModal(false);
        }}
        title={txStep === 3 ? 'Asset Dossier Submitted' : 'Processing Dossier Submission'}
      >
        {txStep === 1 && (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '50%',
                border: '3px solid var(--color-subtle-border)',
                borderTopColor: 'var(--color-copper)',
                animation: 'spin 1s linear infinite',
                margin: '0 auto 16px'
              }}
            />
            <h4
              className="font-serif"
              style={{ fontSize: '18px', fontWeight: 600, color: 'var(--color-charcoal)', marginBottom: '6px' }}
            >
              Securing Title Deed Dossier...
            </h4>
            <p style={{ fontSize: '13px', color: 'var(--color-secondary-text)', marginBottom: '12px' }}>
              {onChainStatusText || 'Encrypting & uploading title deed dossier to private vault...'}
            </p>
          </div>
        )}

        {txStep === 2 && (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '50%',
                border: '3px solid var(--color-subtle-border)',
                borderTopColor: 'var(--color-copper)',
                animation: 'spin 1s linear infinite',
                margin: '0 auto 16px'
              }}
            />
            <h4
              className="font-serif"
              style={{ fontSize: '18px', fontWeight: 600, color: 'var(--color-charcoal)', marginBottom: '6px' }}
            >
              Recording in Compliance Vault...
            </h4>
            <p style={{ fontSize: '13px', color: 'var(--color-secondary-text)' }}>
              Persisting asset record with status PENDING_REVIEW (Off-chain submission, 0 gas).
            </p>
          </div>
        )}

        {txStep === 3 && (
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <div
              style={{
                width: '56px',
                height: '56px',
                borderRadius: '50%',
                backgroundColor: 'var(--color-success-bg, #E8F5E9)',
                color: 'var(--color-success, #2E7D32)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '16px',
                border: '1px solid var(--color-success-border, #A5D6A7)'
              }}
            >
              <CheckCircle2 size={32} />
            </div>

            <h4
              className="font-serif"
              style={{ fontSize: '20px', fontWeight: 600, color: 'var(--color-charcoal)', marginBottom: '8px' }}
            >
              Asset Dossier Submitted for Compliance Review
            </h4>
            <p style={{ fontSize: '13px', color: 'var(--color-secondary-text)', marginBottom: '18px', lineHeight: 1.6 }}>
              Asset ID <strong>{createdAssetId}</strong> has been securely recorded off-chain in the compliance vault. Initial status is <strong style={{ color: 'var(--color-copper)' }}>PENDING_REVIEW</strong>. No blockchain gas fees were charged.
            </p>

            <div
              style={{
                padding: '16px 20px',
                backgroundColor: '#F8FAFC',
                borderRadius: '20px',
                textAlign: 'left',
                marginBottom: '24px',
                fontSize: '12.5px'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: 'var(--color-secondary-text)' }}>Lifecycle Status:</span>
                <span style={{ fontWeight: 600, color: 'var(--color-copper)' }}>PENDING_REVIEW</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: 'var(--color-secondary-text)' }}>Registration Gas Fee:</span>
                <span style={{ fontWeight: 600, color: 'var(--color-success, #2E7D32)' }}>0.0000 ETH (Free Submission)</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ color: 'var(--color-secondary-text)' }}>Dossier Storage:</span>
                <span style={{ fontWeight: 600, color: 'var(--color-midnight-navy)' }}>Private Supabase Vault (Encrypted)</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--color-secondary-text)' }}>Next Stage:</span>
                <span style={{ color: 'var(--color-secondary-text)' }}>Institutional auditor compliance review. Once approved, you can tokenize on Sepolia.</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setShowTxModal(false);
                  navigate('/verification-status');
                }}
                style={{
                  borderRadius: '9999px',
                  padding: '10px 22px',
                  fontSize: '13px',
                  fontWeight: 600,
                  backgroundColor: 'var(--color-peach)',
                  color: 'var(--color-copper)',
                  borderColor: 'transparent'
                }}
              >
                Track Verification Status
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setShowTxModal(false);
                  navigate('/portfolio');
                }}
                style={{
                  borderRadius: '9999px',
                  padding: '10px 22px',
                  fontSize: '13px',
                  fontWeight: 600
                }}
              >
                View in My Portfolio
              </button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  setShowTxModal(false);
                  navigate(`/asset/${createdAssetId}`);
                }}
                style={{
                  borderRadius: '9999px',
                  padding: '10px 24px',
                  fontSize: '13px',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <span>View Asset Dossier</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        )}
      </Modal>

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default RegisterAsset;
