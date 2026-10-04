import React, { useState, useEffect } from "react";

export const UserAvatar = ({
  src,
  name = "",
  email = "",
  size = "w-9 h-9",
  textSize = "text-xs",
  className = "",
}) => {
  const [imgError, setImgError] = useState(false);

  // Reset error state if src changes
  useEffect(() => {
    setImgError(false);
  }, [src]);

  const initial = (name || email || "U").trim()[0]?.toUpperCase() || "U";

  if (src && !imgError) {
    return (
      <img
        src={src}
        alt={name || "User Avatar"}
        referrerPolicy="no-referrer"
        onError={() => setImgError(true)}
        className={`${size} rounded-full object-cover shrink-0 ${className}`}
      />
    );
  }

  return (
    <div
      className={`${size} rounded-full bg-gradient-to-tr from-sky-500 to-indigo-500 text-white font-bold flex items-center justify-center ${textSize} shrink-0 select-none shadow-xs ${className}`}
      title={name || email}
    >
      {initial}
    </div>
  );
};

export default UserAvatar;
