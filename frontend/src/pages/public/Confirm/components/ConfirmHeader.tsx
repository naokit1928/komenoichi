import { Link } from "react-router-dom";

type Props = {
  farmId: string;
};

export function ConfirmHeader({ farmId }: Props) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        marginBottom: 16,
        position: "relative",
      }}
    >
      {/* 左の戻るボタン */}
      <Link
        to={`/farms/${farmId}`}
        style={{
          width: 80,
          display: "inline-block",
          textDecoration: "none",
        }}
      >
        ← 戻る
      </Link>

      {/* タイトル */}
      <div style={{ flex: 1, textAlign: "center" }}>
        <h1
          style={{
            fontSize: 20,
            fontWeight: 800,
            margin: 0,
          }}
        >
          予約内容の確認
        </h1>
      </div>

      {/* 右ダミー */}
      <div style={{ width: 80 }} />
    </div>
  );
}
