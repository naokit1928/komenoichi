import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

/**
 * email を n***t@gmail.com 形式にマスク
 */
function maskEmail(email: string) {
  const [local, domain] = email.split("@");
  if (!domain || local.length < 2) return email;
  return `${local[0]}***${local[local.length - 1]}@${domain}`;
}

type FarmerMeResponse = {
  farm_id: number;
  is_registered: boolean;
  email: string | null;
};

export default function FarmerMenu() {
  const navigate = useNavigate();
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // ★ モーダル表示制御
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  /**
   * ページ初期表示時に /api/farmer/me から email を取得
   */
  useEffect(() => {
    let canceled = false;

    (async () => {
      try {
        const res = await fetch("/api/farmer/me", {
          credentials: "include",
        });
        if (!res.ok) return;

        const data: FarmerMeResponse = await res.json();
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
   * ログアウト処理（既存ロジックそのまま）
   */
  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "include",
      });
    } finally {
      navigate("/auth/login", { replace: true });
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
        メニュー
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
          }}
        >
          {loading
            ? "読み込み中…"
            : email
            ? maskEmail(email)
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
              ログアウトしますか？
            </div>

            <div
              style={{
                fontSize: 14,
                color: "#6B7280",
                marginBottom: 20,
              }}
            >
              再度ログインが必要になります。
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
