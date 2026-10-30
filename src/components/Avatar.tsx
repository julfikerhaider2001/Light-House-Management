import { useEffect, useMemo, useState } from 'react';
import { Camera } from 'lucide-react';
import { initials } from '../lib/format';

/** Photo when we have one, initials otherwise. */
export function Avatar({
  name,
  url,
  size = 32,
  dashed = false,
}: {
  name: string;
  url?: string | undefined;
  size?: number;
  dashed?: boolean;
}) {
  const [broken, setBroken] = useState(false);
  return (
    <span
      className={`avatar mono${dashed ? ' avatar--dashed' : ''}`}
      style={{ width: size, height: size, fontSize: Math.max(10, size * 0.34) }}
      aria-hidden="true"
    >
      {url && !broken ? (
        <img src={url} alt="" loading="lazy" decoding="async" onError={() => setBroken(true)} />
      ) : (
        initials(name)
      )}
    </span>
  );
}

/** Circular photo picker with a live preview. */
export function PhotoPicker({
  id,
  label,
  file,
  currentUrl,
  name,
  onChange,
  error,
}: {
  id: string;
  label: string;
  file: File | null;
  currentUrl?: string | undefined;
  name: string;
  onChange: (file: File | null) => void;
  error?: string | undefined;
}) {
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : undefined), [file]);
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview],
  );

  return (
    <div className={`photo-picker${error ? ' photo-picker--error' : ''}`}>
      <label htmlFor={id} className="photo-picker__target">
        <Avatar
          name={name || '?'}
          url={preview ?? currentUrl}
          size={88}
          dashed={!preview && !currentUrl}
        />
        <span className="photo-picker__badge" aria-hidden="true">
          <Camera size={16} strokeWidth={1.75} />
        </span>
      </label>
      <div className="stack-tight">
        <label htmlFor={id} className="photo-picker__label">
          {label}
        </label>
        <input
          id={id}
          type="file"
          accept="image/*"
          className="sr-only"
          aria-invalid={Boolean(error)}
          aria-describedby={error ? `${id}-msg` : undefined}
          onChange={(e) => onChange(e.target.files?.[0] ?? null)}
        />
        {error ? (
          <span className="field__msg" id={`${id}-msg`} role="alert">
            {error}
          </span>
        ) : null}
      </div>
    </div>
  );
}
