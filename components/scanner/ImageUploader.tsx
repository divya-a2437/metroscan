"use client";

import { useCallback, useRef, useState } from "react";
import {
  UploadCloud,
  X,
  ImageIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type ImageRole =
  | "front"
  | "back"
  | "side"
  | "top"
  | "bottom"
  | "unspecified";

export interface UploadedImage {
  id: string;
  file: File;
  previewUrl: string;
  role: ImageRole;
}

const ROLE_OPTIONS: ImageRole[] = [
  "front",
  "back",
  "side",
  "top",
  "bottom",
  "unspecified",
];

interface ImageUploaderProps {
  images: UploadedImage[];
  onChange: (images: UploadedImage[]) => void;
}

export function ImageUploader({
  images,
  onChange,
}: ImageUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback(
    (fileList: FileList | null) => {
      if (!fileList) return;

      const newImages: UploadedImage[] = Array.from(fileList)
        .filter((file) => file.type.startsWith("image/"))
        .map((file) => ({
          id: `${file.name}-${file.lastModified}-${Math.random()
            .toString(36)
            .slice(2, 8)}`,
          file,
          previewUrl: URL.createObjectURL(file),
          role: "unspecified" as ImageRole,
        }));

      if (newImages.length === 0) return;

      onChange([...images, ...newImages]);
    },
    [images, onChange]
  );

  const removeImage = (id: string) => {
    const target = images.find((image) => image.id === id);

    if (target) {
      URL.revokeObjectURL(target.previewUrl);
    }

    onChange(images.filter((image) => image.id !== id));
  };

  const setRole = (id: string, role: ImageRole) => {
    onChange(
      images.map((image) =>
        image.id === id
          ? { ...image, role }
          : image
      )
    );
  };

  return (
    <div className="space-y-4">
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => {
          setIsDragging(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setIsDragging(false);
          addFiles(event.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "border border-dashed rounded cursor-pointer",
          "flex flex-col items-center justify-center",
          "gap-2 py-10 px-6 text-center",
          "transition-colors",
          isDragging
            ? "border-ink bg-ink/5"
            : "border-border bg-surface hover:border-ink-muted"
        )}
      >
        <UploadCloud
          className="w-6 h-6 text-ink-muted"
          strokeWidth={1.5}
        />

        <div className="text-sm text-ink">
          Drop package images here, or click to browse
        </div>

        <div className="text-xs text-ink-muted font-mono">
          JPG, PNG — multiple images supported
        </div>

        <div className="text-[11px] text-ink-muted font-mono">
          FRONT / BACK / SIDE / TOP / BOTTOM
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(event) => {
            addFiles(event.target.files);

            if (inputRef.current) {
              inputRef.current.value = "";
            }
          }}
        />
      </div>

      {images.length > 0 && (
        <div className="border border-border rounded bg-surface">
          <div className="px-4 py-2 border-b border-border flex items-center justify-between">
            <span className="text-xs font-medium text-ink-muted uppercase tracking-wide">
              Submitted Images
            </span>

            <span className="text-xs font-mono text-ink-muted">
              {images.length} file{images.length !== 1 ? "s" : ""}
            </span>
          </div>

          <ul className="divide-y divide-border">
            {images.map((image) => (
              <li
                key={image.id}
                className="flex items-center gap-3 px-4 py-3"
              >
                <div className="w-14 h-14 shrink-0 rounded border border-border overflow-hidden bg-bg flex items-center justify-center">
                  {image.previewUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={image.previewUrl}
                      alt={image.file.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <ImageIcon
                      className="w-5 h-5 text-ink-muted"
                    />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="text-sm text-ink truncate">
                    {image.file.name}
                  </div>

                  <div className="text-xs text-ink-muted font-mono mt-0.5">
                    {(image.file.size / 1024).toFixed(0)} KB
                  </div>
                </div>

                <select
                  value={image.role}
                  onChange={(event) =>
                    setRole(
                      image.id,
                      event.target.value as ImageRole
                    )
                  }
                  onClick={(event) => event.stopPropagation()}
                  className="text-xs border border-border rounded px-2 py-1.5 bg-surface text-ink font-mono"
                >
                  {ROLE_OPTIONS.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation();
                    removeImage(image.id);
                  }}
                  className="text-ink-muted hover:text-status-fail transition-colors p-1"
                  aria-label={`Remove ${image.file.name}`}
                >
                  <X className="w-4 h-4" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}