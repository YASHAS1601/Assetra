import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ArrowRight, Check, Loader2, ChevronRight, ShieldCheck } from 'lucide-react';

/**
 * SwipeToSubmit
 * A premium, horizontal swipe-to-submit control inspired by mobile banking & fintech interactions.
 * Matches Assetra's Modern Luxury brand palette:
 * - Track: Warm ivory (#F8F5EE) with thin burnt-copper border (#B8734E).
 * - Handle: Solid burnt copper (#B8734E) with white ArrowRight icon.
 * - Fill: Subtle copper progress reveal.
 * - States: Idle ("Swipe to submit asset"), Ready ("Release to submit"), Submitting ("Submitting asset...").
 */
export const SwipeToSubmit = ({
  onSwipeComplete,
  isSubmitting = false,
  isSuccess = false,
  disabled = false,
  label = 'Swipe to submit asset',
  activeLabel = 'Release to submit',
  submittingLabel = 'Submitting asset...',
  successLabel = 'Asset submitted successfully',
  formId,
  className = '',
  style = {}
}) => {
  const [dragX, setDragX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isReady, setIsReady] = useState(false);

  const trackRef = useRef(null);
  const handleRef = useRef(null);
  const startXRef = useRef(0);
  const maxDistanceRef = useRef(0);

  // Calculate available horizontal travel distance
  const calculateMaxDistance = useCallback(() => {
    if (!trackRef.current || !handleRef.current) return 0;
    const trackWidth = trackRef.current.clientWidth;
    const handleWidth = handleRef.current.offsetWidth || 44;
    const padding = 4; // 4px padding on left/right
    const max = Math.max(0, trackWidth - handleWidth - (padding * 2));
    maxDistanceRef.current = max;
    return max;
  }, []);

  useEffect(() => {
    calculateMaxDistance();
  }, [calculateMaxDistance]);

  // Recalculate on window resize
  useEffect(() => {
    const handleResize = () => {
      const max = calculateMaxDistance();
      if (!isSubmitting && !isSuccess) {
        setDragX(0);
        setIsReady(false);
      } else if (isSubmitting || isSuccess) {
        setDragX(max);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [calculateMaxDistance, isSubmitting, isSuccess]);

  // Reset handle position if submission completes or fails
  useEffect(() => {
    if (!isSubmitting && !isSuccess) {
      setDragX(0);
      setIsReady(false);
    } else if (isSubmitting || isSuccess) {
      const max = maxDistanceRef.current || calculateMaxDistance();
      setDragX(max);
      setIsReady(true);
    }
  }, [isSubmitting, isSuccess, calculateMaxDistance]);

  // Pointer event handlers (works uniformly for mouse, touch, and stylus)
  const handlePointerDown = (e) => {
    if (disabled || isSubmitting || isSuccess) return;
    if (e.button !== undefined && e.button !== 0) return; // Only main button

    const max = calculateMaxDistance();
    if (max <= 0) return;

    setIsDragging(true);
    startXRef.current = e.clientX - dragX;

    if (e.currentTarget && e.currentTarget.setPointerCapture) {
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch (err) {
        // Fallback for browsers that don't support pointer capture
      }
    }
  };

  const handlePointerMove = (e) => {
    if (!isDragging) return;
    const max = maxDistanceRef.current || calculateMaxDistance();
    const currentX = e.clientX - startXRef.current;
    const clampedX = Math.max(0, Math.min(currentX, max));

    setDragX(clampedX);
    const progress = max > 0 ? clampedX / max : 0;
    setIsReady(progress >= 0.9);
  };

  const handlePointerUp = async (e) => {
    if (!isDragging) return;
    setIsDragging(false);

    if (e.currentTarget && e.currentTarget.releasePointerCapture) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch (err) {}
    }

    const max = maxDistanceRef.current || calculateMaxDistance();
    const progress = max > 0 ? dragX / max : 0;

    // Trigger submission only if 90% or more threshold reached upon release
    if (progress >= 0.9) {
      setDragX(max);
      setIsReady(true);

      if (onSwipeComplete) {
        const result = await onSwipeComplete();
        // If validation failed or handler rejected, snap back smoothly
        if (result === false) {
          setDragX(0);
          setIsReady(false);
        }
      }
    } else {
      // Released before 90%: smoothly return to start
      setDragX(0);
      setIsReady(false);
    }
  };

  const handlePointerCancel = (e) => {
    if (!isDragging) return;
    setIsDragging(false);
    setDragX(0);
    setIsReady(false);

    if (e.currentTarget && e.currentTarget.releasePointerCapture) {
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch (err) {}
    }
  };

  // Keyboard accessibility (Arrow keys, Space, Enter)
  const handleKeyDown = async (e) => {
    if (disabled || isSubmitting || isSuccess) return;
    const max = calculateMaxDistance();

    if (e.key === 'ArrowRight') {
      e.preventDefault();
      const nextX = Math.min(dragX + (max * 0.25), max);
      setDragX(nextX);
      setIsReady(nextX / max >= 0.9);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      const prevX = Math.max(dragX - (max * 0.25), 0);
      setDragX(prevX);
      setIsReady(prevX / max >= 0.9);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setDragX(max);
      setIsReady(true);
      if (onSwipeComplete) {
        const result = await onSwipeComplete();
        if (result === false) {
          setDragX(0);
          setIsReady(false);
        }
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setDragX(0);
      setIsReady(false);
    }
  };

  const progressPercent = maxDistanceRef.current > 0 ? (dragX / maxDistanceRef.current) * 100 : 0;

  return (
    <div className={`assetra-swipe-container ${className}`} style={{ width: '100%', ...style }}>
      {/* Horizontal Swipe Track */}
      <div
        ref={trackRef}
        role="slider"
        aria-label="Swipe to submit asset"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progressPercent)}
        aria-valuetext={
          isSuccess
            ? successLabel
            : isSubmitting
            ? submittingLabel
            : isReady
            ? activeLabel
            : label
        }
        aria-disabled={disabled || isSubmitting || isSuccess}
        tabIndex={disabled || isSubmitting || isSuccess ? -1 : 0}
        onKeyDown={handleKeyDown}
        style={{
          width: '100%',
          height: '54px',
          backgroundColor: '#F8FAFC',
          border: `1.5px solid ${isReady ? 'var(--color-copper-highlight)' : 'rgba(185, 101, 58, 0.25)'}`,
          borderRadius: 'var(--radius-pill)',
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          userSelect: 'none',
          WebkitUserSelect: 'none',
          touchAction: 'none',
          boxShadow: isReady
            ? '0 0 0 4px rgba(185, 101, 58, 0.18), inset 0 1px 3px rgba(16, 27, 45, 0.04)'
            : 'inset 0 1px 3px rgba(16, 27, 45, 0.04)',
          cursor: disabled || isSubmitting || isSuccess ? 'not-allowed' : 'default',
          transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
          outline: 'none'
        }}
      >
        {/* Copper Progress Fill */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            bottom: 0,
            width: `${dragX + 44}px`,
            maxWidth: '100%',
            background: isSuccess
              ? 'linear-gradient(90deg, rgba(16, 185, 129, 0.2), rgba(16, 185, 129, 0.35))'
              : 'linear-gradient(90deg, rgba(185, 101, 58, 0.12) 0%, rgba(185, 101, 58, 0.28) 100%)',
            borderRadius: 'var(--radius-pill)',
            pointerEvents: 'none',
            transition: isDragging ? 'none' : 'width 0.28s cubic-bezier(0.2, 0.8, 0.2, 1)'
          }}
        />

        {/* Centered Track Label */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            pointerEvents: 'none',
            padding: '0 54px',
            zIndex: 1
          }}
        >
          {isSuccess ? (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: 'var(--color-success, #35765A)', fontWeight: 600, fontSize: '13.5px' }}>
              <Check size={16} strokeWidth={2.6} />
              <span>{successLabel}</span>
            </div>
          ) : isSubmitting ? (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: 'var(--color-charcoal, #20211F)', fontWeight: 600, fontSize: '13.5px' }}>
              <Check size={16} strokeWidth={2.8} style={{ color: 'var(--color-copper, #B8734E)' }} />
              <span>{submittingLabel}</span>
            </div>

          ) : isReady ? (
            <span
              style={{
                color: 'var(--color-copper, #B8734E)',
                fontWeight: 700,
                fontSize: '13.5px',
                letterSpacing: '0.02em',
                animation: 'pulseReady 1.2s ease infinite'
              }}
            >
              {activeLabel}
            </span>
          ) : (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                color: 'var(--color-charcoal, #20211F)',
                fontWeight: 600,
                fontSize: '13.5px',
                letterSpacing: '0.015em',
                opacity: Math.max(0.2, 1 - (progressPercent / 80))
              }}
            >
              <span>{label}</span>
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  color: 'var(--color-copper, #B8734E)',
                  opacity: 0.7,
                  marginLeft: '4px'
                }}
              >
                <ChevronRight size={14} strokeWidth={2.4} />
                <ChevronRight size={14} strokeWidth={2.4} style={{ marginLeft: '-8px' }} />
                <ChevronRight size={14} strokeWidth={2.4} style={{ marginLeft: '-8px' }} />
              </span>
            </div>
          )}
        </div>

        {/* Draggable Burnt-Copper Handle */}
        <div
          ref={handleRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
          style={{
            width: '44px',
            height: '44px',
            borderRadius: '50%',
            background: isSuccess
              ? 'var(--color-success)'
              : 'var(--gradient-copper)',
            color: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'absolute',
            left: '4px',
            top: '4px',
            transform: `translateX(${dragX}px)`,
            cursor: disabled || isSubmitting || isSuccess ? 'not-allowed' : (isDragging ? 'grabbing' : 'grab'),
            boxShadow: isReady
              ? '0 0 0 4px rgba(185, 101, 58, 0.28), 0 6px 18px rgba(185, 101, 58, 0.45)'
              : 'var(--shadow-copper)',
            transition: isDragging
              ? 'none'
              : 'transform 0.28s cubic-bezier(0.2, 0.8, 0.2, 1), box-shadow 0.2s ease, background-color 0.2s ease',
            zIndex: 2,
            touchAction: 'none'
          }}
          aria-hidden="true"
        >
          {isSuccess || isSubmitting ? (
            <Check size={20} strokeWidth={2.8} />
          ) : (

            <ArrowRight
              size={19}
              strokeWidth={2.5}
              style={{
                transform: isReady ? 'scale(1.15)' : 'none',
                transition: 'transform 0.15s ease'
              }}
            />
          )}
        </div>
      </div>

      {/* Sub-label instructions & accessible controls */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: '8px',
          padding: '0 8px',
          fontSize: '11.5px',
          color: 'var(--color-secondary-text, #77766F)'
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
          <ShieldCheck size={13} style={{ color: 'var(--color-copper)' }} />
          <span>Slide to confirm compliance audit & custodial registration</span>
        </span>

        {/* Accessible keyboard trigger note & fallback button */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ opacity: 0.8 }}>Keyboard: [→] or [Enter]</span>
          {/* Accessible fallback submit button for screen readers & click preference */}
          <button
            type="submit"
            form={formId}
            disabled={disabled || isSubmitting || isSuccess}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              fontSize: '11.5px',
              color: 'var(--color-copper, #B8734E)',
              textDecoration: 'underline',
              cursor: disabled || isSubmitting ? 'not-allowed' : 'pointer'
            }}
          >
            Click to submit
          </button>
        </div>
      </div>

      <style>{`
        @keyframes pulseReady {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.85; transform: scale(1.02); }
        }
        .assetra-spin {
          animation: assetraSpin 0.9s linear infinite;
        }
        @keyframes assetraSpin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @media (prefers-reduced-motion: reduce) {
          .assetra-spin {
            animation-duration: 2s;
          }
          @keyframes pulseReady {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.9; }
          }
        }
      `}</style>
    </div>
  );
};

export default SwipeToSubmit;
