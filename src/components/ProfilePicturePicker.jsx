import { memo, useCallback, useEffect, useRef, useState } from 'react';

const PROFILE_IMAGES = Object.values(
  import.meta.glob('../../Textures/ProfilePicture/*.{png,jpg,jpeg,webp,gif}', {
    eager: true,
    import: 'default',
  })
).sort((a, b) => a.localeCompare(b));

const FALLBACK_ICON = '/textures/icon/Player.png';
const STORAGE_KEY = 'ludo_profile_pic';

const MAX_DIM = 128;
const JPEG_QUALITY = 0.72;

function readImageAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('Could not read image file'));
    reader.readAsDataURL(file);
  });
}

function compressImage(dataUrl) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, MAX_DIM / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', JPEG_QUALITY));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

function ProfilePicturePicker({ value, onChange, disabled = false }) {
  const [open, setOpen] = useState(false);
  const [internal, setInternal] = useState(null);
  const [uploaded, setUploaded] = useState(() => localStorage.getItem(STORAGE_KEY) || null);
  const fileInputRef = useRef(null);
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

  const handleUpload = useCallback(async (file) => {
    if (!file || !file.type?.startsWith('image/')) return;
    try {
      const raw = await readImageAsDataUrl(file);
      const compressed = await compressImage(raw);
      setUploaded(compressed);
      localStorage.setItem(STORAGE_KEY, compressed);
      if (value !== undefined) {
        onChange?.(compressed);
      } else {
        setInternal(compressed);
        onChange?.(compressed);
      }
      setOpen(false);
    } catch {
      // ignore invalid upload
    }
  }, [value, onChange]);

  const allImages = uploaded
    ? [uploaded, ...PROFILE_IMAGES.filter((src) => src !== uploaded)]
    : PROFILE_IMAGES;

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
          src={selected || uploaded || FALLBACK_ICON}
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

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleUpload(file);
          e.target.value = '';
        }}
      />

      {open && (
        <div className="profile-picker-popover">
          <div className="profile-picker-panel">
            <div className="profile-picker-upload-row">
              <button
                type="button"
                className="profile-picker-upload-btn"
                onClick={() => fileInputRef.current?.click()}
              >
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                Upload your own
              </button>
            </div>
            {allImages.length === 0 ? (
              <div className="profile-picker-empty">
                No profile pictures yet.
                <br />
                Add images to <b>Textures/ProfilePicture</b>.
              </div>
            ) : (
              <div className="profile-picker-grid" role="grid">
                {allImages.map((src) => (
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
