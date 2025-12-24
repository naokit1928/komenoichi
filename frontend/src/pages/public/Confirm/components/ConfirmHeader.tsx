import { Link } from "react-router-dom";

type Props = {
  farmId: string;
};

export function ConfirmHeader({ farmId }: Props) {
  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        marginBottom: 16,
        minHeight: 40,
      }}
    >
      {/* 左の戻るボタン（absolute） */}
      <Link
        to={`/farms/${farmId}`}
        style={{
          position: "absolute",
          left: 0,
          textDecoration: "none",
        }}
      >
        ← 戻る
      </Link>

      {/* タイトル */}
      <h1
        style={{
          fontSize: 20,
          fontWeight: 800,
          margin: 0,
          textAlign: "center",
          lineHeight: 1.2,
        }}
      >
        予約内容の確認
      </h1>
    </div>
  );
}
