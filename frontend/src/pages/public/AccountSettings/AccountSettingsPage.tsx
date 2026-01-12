import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

type ConsumerIdentity = {
  is_logged_in: boolean;
  email: string | null;
};

export default function AccountSettingsPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // ★ ログアウト確認モーダル
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  /**
   * 初期表示時に consumer identity を取得
   */
  useEffect(() => {
    let canceled = false;

    (async () => {
      try {
        const res = await fetch("/api/consumers/identity", {
          credentials: "include",
        });

        if (!res.ok) return;

        const data: ConsumerIdentity = await res.json();

        if (!canceled) {
          setEmail(data.email ?? null);
        }
      } catch {
        // 失敗時は何もしない
      } finally {
        if (!canceled) setLoading(false);
      }
    })();

    return () => {
      canceled = true;
    };
  }, []);

  /**
   * ログアウト処理（consumer 用）
   */
  const handleLogout = async () => {
    try {
      await fetch(
        "/api/auth/consumer/logout",
        {
          method: "POST",
          credentials: "include",
        }
      );
    } finally {
      navigate("/", { replace: true });
    }
  };

  return (
    <div
      style={{
        padding: "24px 16px",
        maxWidth: 640,
        margin: "0 auto",
      }}
    >
      {/* ===== タイトル ===== */}
      <h1
        style={{
          fontSize: 20,
          fontWeight: 600,
          marginBottom: 24,
        }}
      >
        アカウント設定
      </h1>

      {/* ===== ログイン中情報 ===== */}
      <div
        style={{
          backgroundColor: "#F9FAFB",
          borderRadius: 12,
          padding: 16,
          marginBottom: 24,
        }}
      >
        <div
          style={{
            fontSize: 13,
            color: "#6B7280",
            marginBottom: 4,
          }}
        >
          ログイン中
        </div>

        <div
          style={{
            fontSize: 15,
            fontWeight: 500,
            color: "#111827",
            wordBreak: "break-all",
          }}
        >
          {loading
            ? "読み込み中…"
            : email
            ? email
            : "（email 未取得）"}
        </div>
      </div>

      {/* ===== ログアウト ===== */}
      <div>
        <button
          onClick={() => setShowLogoutModal(true)}
          style={{
            width: "100%",
            padding: "14px 0",
            fontSize: 16,
            backgroundColor: "#FFFFFF",
            border: "1px solid #E5E7EB",
            borderRadius: 12,
            cursor: "pointer",
            textAlign: "center",
          }}
        >
          ログアウト
        </button>
      </div>

      {/* ===== ログアウト確認モーダル ===== */}
      {showLogoutModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0,0,0,0.4)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 2000,
          }}
        >
          <div
            style={{
              backgroundColor: "#FFFFFF",
              borderRadius: 16,
              padding: 20,
              width: "90%",
              maxWidth: 360,
            }}
          >
            <div
              style={{
                fontSize: 16,
                fontWeight: 600,
                marginBottom: 12,
              }}
            >
              本当にログアウトしますか？
            </div>

            <div
              style={{
                fontSize: 14,
                color: "#6B7280",
                marginBottom: 20,
              }}
            >
              購入の際に再度ログインが必要になります。
            </div>

            <div style={{ display: "flex", gap: 12 }}>
              <button
                onClick={() => setShowLogoutModal(false)}
                style={{
                  flex: 1,
                  padding: "10px 0",
                  borderRadius: 10,
                  border: "1px solid #E5E7EB",
                  backgroundColor: "#FFFFFF",
                  cursor: "pointer",
                }}
              >
                キャンセル
              </button>

              <button
                onClick={handleLogout}
                style={{
                  flex: 1,
                  padding: "10px 0",
                  borderRadius: 10,
                  border: "none",
                  backgroundColor: "#111827",
                  color: "#FFFFFF",
                  cursor: "pointer",
                }}
              >
                ログアウトする
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
