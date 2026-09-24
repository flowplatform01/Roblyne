import { useState } from "react";

interface PublicHeroBackdropProps {
  imageUrl?: string | null;
}

export function PublicHeroBackdrop({ imageUrl }: PublicHeroBackdropProps) {
  const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null);
  const source = imageUrl?.trim() || null;
  const hasImage = Boolean(source && source !== failedImageUrl);

  return (
    <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden="true">
      {hasImage ? (
        <>
          <img
            src={source!}
            alt=""
            loading="eager"
            decoding="async"
            onError={() => setFailedImageUrl(source)}
            className="absolute inset-0 h-full w-full object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#0A1628]/25 via-[#0A1628]/50 to-[#0A1628]/85" />
        </>
      ) : (
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(49,93,148,0.28),transparent_62%),linear-gradient(155deg,#10233b,#07111f_78%)]" />
      )}
    </div>
  );
}