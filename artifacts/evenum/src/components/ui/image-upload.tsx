import React, { useCallback, useState, useRef } from 'react';
import { UploadCloud, X, Image as ImageIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './button';

export interface ImageUploadProps {
  value?: string;
  onChange: (value?: string) => void;
  label?: string;
  placeholder?: string;
  aspectRatio?: 'square' | 'banner';
  className?: string;
}

type PresignResponse = {
  uploadUrl: string;
  publicUrl: string;
};

export function ImageUpload({
  value,
  onChange,
  label = "Upload Image",
  placeholder = "Drop image here or click to upload",
  aspectRatio = 'square',
  className
}: ImageUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const processFile = async (file: File) => {
    setError(null);
    if (!file.type.startsWith('image/')) {
      setError("Please upload an image file (PNG, JPG, GIF, WebP).");
      return;
    }
    
    if (file.size > 2 * 1024 * 1024) {
      setError("Image size should be less than 2MB.");
      return;
    }

    const localPreviewUrl = URL.createObjectURL(file);
    setPreviewUrl(localPreviewUrl);
    setIsUploading(true);

    try {
      const basePath = (import.meta.env.BASE_URL ?? "/").replace(/\/$/, "");
      const presignResponse = await fetch(`${basePath}/api/uploads/presign`, {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ contentType: file.type, size: file.size }),
      });

      const presignBody = await presignResponse.json().catch(() => null) as PresignResponse | { error?: string } | null;
      if (!presignResponse.ok || !presignBody || !("uploadUrl" in presignBody) || !("publicUrl" in presignBody)) {
        throw new Error((presignBody && "error" in presignBody ? presignBody.error : undefined) || "Unable to prepare image upload");
      }

      const uploadResponse = await fetch(presignBody.uploadUrl, {
        method: "PUT",
        headers: { "content-type": file.type },
        body: file,
      });
      if (!uploadResponse.ok) {
        throw new Error("Image upload failed. Please try again.");
      }

      onChange(presignBody.publicUrl);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Failed to upload the file.");
      setPreviewUrl(null);
      URL.revokeObjectURL(localPreviewUrl);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      void processFile(e.dataTransfer.files[0]);
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      void processFile(e.target.files[0]);
    }
  };

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(undefined);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {label && <span className="text-sm font-medium">{label}</span>}
      
      <div 
        className={cn(
          "relative flex flex-col items-center justify-center border-2 border-dashed rounded-lg overflow-hidden transition-colors cursor-pointer",
          isDragging ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50 hover:border-primary/50",
          aspectRatio === 'square' ? "aspect-square w-full max-w-[240px]" : "aspect-[21/9] w-full",
          !value && "py-8"
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
      >
        <input 
          type="file" 
          ref={inputRef} 
          className="hidden" 
          accept="image/png, image/jpeg, image/jpg, image/gif, image/webp" 
          onChange={handleChange}
        />
        
        {value || previewUrl ? (
          <>
            <img src={previewUrl || value} alt="Upload preview" className={cn("w-full h-full object-cover", isUploading && "opacity-60")} />
            {isUploading ? (
              <div className="absolute inset-0 flex items-center justify-center bg-black/30 text-sm font-medium text-white">
                Uploading…
              </div>
            ) : (
            <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
              <Button 
                type="button" 
                variant="destructive" 
                size="sm" 
                className="rounded-full shadow-sm"
                onClick={handleRemove}
              >
                <X className="h-4 w-4 mr-1" /> Remove
              </Button>
            </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center text-center p-4">
            <div className="w-12 h-12 mb-3 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <UploadCloud className="h-6 w-6" />
            </div>
            <p className="text-sm font-medium">{placeholder}</p>
            <p className="text-xs text-muted-foreground mt-1">PNG, JPG up to 2MB</p>
          </div>
        )}
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
