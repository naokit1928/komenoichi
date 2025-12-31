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
    <section className={`w-full ${className}`} style={{ marginTop: 24 }}>
      {/* TitleEditor と同一の card 構造 */}
      <button
        type="button"
        onClick={requestToggle}
        disabled={disabled}
        className="w-full bg-white"
        aria-label="予約受付の公開状態を切り替える"
        style={{
          backgroundColor: "#FFFFFF",
          border: "1px solid rgba(0,0,0,0.07)",
          borderRadius: 24,
          padding: "44px 46px", // TitleEditor と完全一致
          boxShadow: "0 2px 4px rgba(0,0,0,0.04)",
          cursor: disabled ? "not-allowed" : "pointer",
          textAlign: "center",
        }}
      >
        {/* このコンポーネント内だけで使う太字指定 */}
        <style
          dangerouslySetInnerHTML={{
            __html: `
              .pub-bold {
                font-weight: 800 !important;
                color: #111827 !important;
              }
            `,
          }}
        />

        <div className="w-full flex flex-col items-center">
          {/* タイトル */}
          <div className="text-[15px] sm:text-base tracking-wide pub-bold">
            予約受付
          </div>

          {/* トグル（※ button ではない） */}
          <div
            role="button"
            tabIndex={disabled ? -1 : 0}
            aria-label={`公開を${isOn ? "オフ" : "オン"}にする`}
            aria-pressed={isOn}
            onClick={(e) => {
              e.stopPropagation();
              requestToggle();
            }}
            onKeyDown={(e) => {
              if (e.key === " " || e.key === "Enter") {
                e.preventDefault();
                e.stopPropagation();
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
              outline: "0",
              overflow: "hidden",
              boxShadow: "0 1px 0 rgba(0,0,0,.02)",
            }}
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
          </div>

          {/* 状態メッセージ */}
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
      </button>
    </section>
  );
}
