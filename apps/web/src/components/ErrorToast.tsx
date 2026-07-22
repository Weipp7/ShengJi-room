import type { VisibleError } from '../store';

type Props = {
  error: VisibleError;
  onDismiss: () => void;
};

export default function ErrorToast({ error, onDismiss }: Props) {
  return (
    <div className="toast" role="alert" data-error-code={error.code}>
      <div className="toast-copy">
        <strong>{error.title}</strong>
        {error.hint && <span>{error.hint}</span>}
      </div>
      <button className="toast-close" type="button" aria-label="关闭错误提示" onClick={onDismiss}>
        ×
      </button>
    </div>
  );
}
