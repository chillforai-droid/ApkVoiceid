
import React from 'react';

interface AvatarProps {
  url?: string | null;
  displayName?: string | null;
  className?: string;
}

export const Avatar: React.FC<AvatarProps> = ({ url, displayName, className = "w-10 h-10" }) => {
  if (url) {
    return <img src={url} alt={displayName || 'Avatar'} loading="lazy" decoding="async" className={`${className} rounded-full object-cover`} />;
  }

  const initials = displayName
    ? displayName.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
    : '?';

  return (
    <div className={`${className} rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold`}>
      {initials}
    </div>
  );
};
