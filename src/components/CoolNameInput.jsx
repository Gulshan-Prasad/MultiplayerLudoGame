import { memo } from 'react';
import ProfilePicturePicker from './ProfilePicturePicker';

const PLAYER_ICON = '/textures/icon/Player.png';

function CoolNameInput({
  label = 'Your Name',
  value,
  onChange,
  profilePic = null,
  onProfilePicChange,
  placeholder = 'Enter your name',
  maxLength = 20,
  disabled = false,
  variant = 'gold',
}) {
  const accent = {
    gold: {
      ring: '#d4a017',
      glow: 'rgba(212,160,23,0.5)',
      text: '#5b3a1e',
      border: '#8a6a45',
      top: '#fff3d6',
      bottom: '#e8c888',
    },
    green: {
      ring: '#2f9e44',
      glow: 'rgba(47,158,68,0.5)',
      text: '#1b3a1f',
      border: '#2f7a3a',
      top: '#eaffea',
      bottom: '#c2e8c4',
    },
  }[variant] || {
    ring: '#d4a017',
    glow: 'rgba(212,160,23,0.5)',
    text: '#5b3a1e',
    border: '#8a6a45',
    top: '#fff3d6',
    bottom: '#e8c888',
  };

  return (
    <div>
      {label && (
        <label
          className="flex items-center gap-1.5 text-sm font-bold uppercase tracking-wide mb-1.5"
          style={{ color: accent.text }}
        >
          <img src={PLAYER_ICON} alt="" className="w-4 h-4 object-contain" draggable={false} />
          {label}
        </label>
      )}
      <div className="flex items-stretch gap-3">
        <ProfilePicturePicker
          disabled={disabled}
          value={profilePic}
          onChange={onProfilePicChange}
        />
        <div
          className="relative rounded-xl flex-1"
          style={{
            boxShadow: `0 4px 0 ${accent.border}, 0 6px 12px rgba(0,0,0,0.25)`,
          }}
        >
          <div
            className="absolute inset-0 rounded-xl pointer-events-none"
            style={{
              background: `linear-gradient(180deg, ${accent.top} 0%, ${accent.bottom} 100%)`,
              border: '2px solid rgba(255,255,255,0.4)',
            }}
          />
          <input
            type="text"
            value={value}
            onChange={(e) => { onChange?.(e.target.value); }}
            placeholder={placeholder}
            maxLength={maxLength}
            disabled={disabled}
            className="cool-name-input"
            style={{ color: '#3e2416' }}
          />
        </div>
      </div>
    </div>
  );
}

export default memo(CoolNameInput);
