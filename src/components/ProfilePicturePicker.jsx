import { memo, useCallback, useEffect, useRef, useState } from 'react';

const PROFILE_IMAGES = Object.values(
  import.meta.glob('../../Textures/ProfilePicture/*.{png,jpg,jpeg,webp,gif}', {
    eager: true,
    import: 'default',
  })
).sort((a, b) => a.localeCompare(b));

const FALLBACK_ICON = '/textures/icon/Player.png';

function ProfilePicturePicker({ value, onChange, disabled = false }) {
  const [open, setOpen] = useState(false);
  const [internal, setInternal] = useState(null);
  const rootRef = useRef(null);

  const selected = value !== undefined && value !== null ? value : internal;

  useEffect(() => {
    if (selected === null && PROFILE_IMAGES.length > 0) {
      setInternal(PROFILE_IMAGES[Math.floor(Math.random() * PROFILE_IMAGES.length)]);
    }
  }, [selected]);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [open]);

  const handleSelect = useCallback((src) => {
    if (value !== undefined) {
      onChange?.(src);
    } else {
      setInternal(src);
      onChange?.(src);
    }
    setOpen(false);
  }, [value, onChange]);

  return (
    <div className="profile-picker" ref={rootRef}>
      <button
        type="button"
        className={`profile-avatar-btn${disabled ? ' disabled' : ''}`}
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        title="Choose profile picture"
        aria-haspopup="grid"
        aria-expanded={open}
      >
        <img
          src={selected || FALLBACK_ICON}
          alt="Profile"
          className="profile-avatar-img"
          draggable={false}
        />
        <span className="profile-avatar-badge">
          <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
            <path d="M5 12h14M12 5v14" />
          </svg>
        </span>
      </button>

      {open && (
        <div className="profile-picker-popover">
          <div className="profile-picker-panel">
            {PROFILE_IMAGES.length === 0 ? (
              <div className="profile-picker-empty">
                No profile pictures yet.
                <br />
                Add images to <b>Textures/ProfilePicture</b>.
              </div>
            ) : (
              <div className="profile-picker-grid" role="grid">
                {PROFILE_IMAGES.map((src) => (
                  <button
                    key={src}
                    type="button"
                    className={`profile-picker-option${src === selected ? ' selected' : ''}`}
                    onClick={() => handleSelect(src)}
                    role="gridcell"
                  >
                    <img src={src} alt="" draggable={false} />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default memo(ProfilePicturePicker);
