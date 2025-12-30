type Props = {
  isOn: boolean;
  disabled?: boolean;
  onToggle: (next: boolean) => void;
  className?: string;
};

export default function PublishToggleCard({
  isOn,
  disabled,
  onToggle,
  className = "",
}: Props) {
  const requestToggle = () => {
    if (disabled) return;
    const next = !isOn;
    const ok = window.confirm(
      next
        ? "公開を開始します。よろしいですか？"
        : "公開を一時停止します。既存の予約はキャンセルされません。よろしいですか？"
    );
    if (!ok) return;
    onToggle(next);
  };

  return (
    <div
      className={`w-full bg-white ${className}`}
      style={{
        backgroundColor: "#FFFFFF",
        border: "1px solid rgba(0,0,0,0.07)",
        borderRadius: 24,
        padding: "28px 20px",
        boxShadow: "0 2px 4px rgba(0,0,0,0.04)",
      }}
    >
      {/* ✅ このコンポーネント内だけで強制的に太字を適用するCSS */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            .pub-bold { font-weight: 800 !important; color: #111827 !important; }
          `,
        }}
      />

      <div className="w-full flex flex-col items-center">
        {/* ✅ タイトル：太字で必ず表示される */}
        <div className="text-[15px] sm:text-base tracking-wide pub-bold">
          予約受付
        </div>

        {/* ✅ トグルスイッチ */}
        <button
          type="button"
          aria-label={`公開を${isOn ? "オフ" : "オン"}にする`}
          aria-pressed={isOn}
          onClick={requestToggle}
          onKeyDown={(e) => {
            if (e.key === " " || e.key === "Enter") {
              e.preventDefault();
              requestToggle();
            }
          }}
          className="relative transition"
          style={{
            marginTop: 12,
            width: 76,
            height: 40,
            borderRadius: 9999,
            cursor: disabled ? "not-allowed" : "pointer",
            background: isOn ? "#10B981" : "#E5E7EB",
            opacity: disabled ? 0.6 : 1,
            border: "none",
            outline: "0",
            appearance: "none",
            WebkitAppearance: "none",
            overflow: "hidden",
            boxShadow: "0 1px 0 rgba(0,0,0,.02)",
          }}
          disabled={disabled}
        >
          <span
            aria-hidden="true"
            className="absolute transition-transform"
            style={{
              top: 2,
              left: 2,
              width: 36,
              height: 36,
              borderRadius: 9999,
              background: "#FFFFFF",
              transform: `translateX(${isOn ? 36 : 0}px)`,
              boxShadow: "0 2px 6px rgba(0,0,0,.18)",
            }}
          />
        </button>

        {/* ✅ 状態メッセージ（現在 + 太字の公開中/非公開） */}
        <div
          className="text-[12.5px] text-center leading-relaxed"
          style={{ marginTop: 12 }}
        >
          {isOn ? (
            <>
              現在 <span className="pub-bold">公開中</span> です。いつでも停止できます。
              <br />
              既存の予約はキャンセルされません。
            </>
          ) : (
            <>
              現在 <span className="pub-bold">非公開</span> です。いつでも公開にできます。
              <br />
              既存の予約はキャンセルされません。
            </>
          )}
        </div>
      </div>
    </div>
  );
}
