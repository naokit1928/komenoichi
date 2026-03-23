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
    onToggle(!isOn);
  };

  const boldStyle: React.CSSProperties = {
    fontWeight: 800,
    color: "#111827",
  };

  return (
    <section className={`w-full ${className}`} style={{ marginTop: 24 }}>
      <button
        type="button"
        onClick={requestToggle}
        disabled={disabled}
        className="w-full bg-white"
        aria-label="予約受付の状態を切り替える"
        style={{
          backgroundColor: "#FFFFFF",
          border: "1px solid rgba(0,0,0,0.07)",
          borderRadius: 24,
          padding: "36px 24px", // テキストが左揃えになっても綺麗に見えるように左右の余白を少し調整
          boxShadow: "0 2px 4px rgba(0,0,0,0.04)",
          cursor: disabled ? "not-allowed" : "pointer",
        }}
      >
        <div className="w-full flex flex-col items-center">
          <div className="text-[15px] sm:text-base tracking-wide" style={boldStyle}>
            予約の受付状態
          </div>

          <div
            role="button"
            tabIndex={disabled ? -1 : 0}
            aria-label={`受付を${isOn ? "オフ" : "オン"}にする`}
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
              marginTop: 16,
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

          {/* ★ 変更箇所: 左揃え (textAlign: "left") にし、幅を 100% にして自然に折り返させる */}
          <div 
            style={{ 
              marginTop: 20, 
              fontSize: 13, 
              lineHeight: 1.6, 
              color: "#475569",
              textAlign: "left",
              width: "100%"
            }}
          >
            {isOn ? (
              <>
                現在<span style={boldStyle}>予約受付中</span>です。いつでも停止できます。既存の予約はキャンセルされません。
              </>
            ) : (
              <>
                現在<span style={boldStyle}>受付停止中</span>です。いつでも再開できます。一覧からは非表示になり、新規予約は入りません。
              </>
            )}
          </div>
        </div>
      </button>
    </section>
  );
}