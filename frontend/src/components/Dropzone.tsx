import { useRef, useState, type DragEvent } from "react";
import { FileUp, UploadCloud } from "lucide-react";
import { cn } from "../lib/utils";

const ACCEPTED = [".pdf", ".png", ".jpg", ".jpeg", ".webp"];

export function Dropzone({
  onFiles,
  maxMb = 25,
  disabled = false,
}: {
  onFiles: (files: File[]) => void;
  maxMb?: number;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [rejected, setRejected] = useState<string | null>(null);

  const accept = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const accepted: File[] = [];
    const rejectedNames: string[] = [];
    for (const file of Array.from(fileList)) {
      const lower = file.name.toLowerCase();
      const typeOk = ACCEPTED.some((extension) => lower.endsWith(extension));
      const sizeOk = file.size <= maxMb * 1024 * 1024;
      if (typeOk && sizeOk) accepted.push(file);
      else {
        rejectedNames.push(
          !typeOk
            ? `${file.name} — unsupported type`
            : `${file.name} — larger than ${maxMb} MB`,
        );
      }
    }
    setRejected(rejectedNames.length ? rejectedNames.join(", ") : null);
    if (accepted.length) onFiles(accepted);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    if (!disabled) accept(event.dataTransfer.files);
  };

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        aria-label="Drop documents here or browse files"
        onClick={() => !disabled && inputRef.current?.click()}
        onKeyDown={(event) => {
          if ((event.key === "Enter" || event.key === " ") && !disabled) {
            event.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(event) => {
          event.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-14 text-center transition-all",
          "hover:border-primary/60 hover:bg-accent/40",
          dragging && "border-primary bg-accent/60 scale-[1.01]",
          disabled && "pointer-events-none opacity-60",
        )}
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-accent-foreground">
          {dragging ? (
            <FileUp className="h-6 w-6" aria-hidden="true" />
          ) : (
            <UploadCloud className="h-6 w-6" aria-hidden="true" />
          )}
        </div>
        <div className="space-y-1">
          <p className="text-base font-medium">Drop documents here</p>
          <p className="text-sm text-muted-foreground">or</p>
        </div>
        <span className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
          Browse Files
        </span>
        <p className="text-xs text-muted-foreground">
          PDF · PNG · JPG · JPEG · WebP — up to {maxMb} MB
        </p>
        <p className="text-[11px] text-muted-foreground/80">
          Files are stored on this device only.
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept=".pdf,.png,.jpg,.jpeg,.webp"
          className="hidden"
          onChange={(event) => {
            accept(event.target.files);
            event.target.value = "";
          }}
        />
      </div>
      {rejected && (
        <p className="mt-3 rounded-lg border border-amber-500/25 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400" role="alert">
          {rejected}
        </p>
      )}
    </div>
  );
}
