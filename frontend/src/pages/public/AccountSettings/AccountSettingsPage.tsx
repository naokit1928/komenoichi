import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE } from "@/config/api";

type ConsumerIdentity = {
  is_logged_in: boolean;
  email: string | null;
};

export default function AccountSettingsPage() {
  const navigate = useNavigate();

  const [identity, setIdentity] = useState<ConsumerIdentity | null>(null);
  const [loading, setLoading] = useState(true);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  useEffect(() => {
    let canceled = false;

    (async () => {
      try {
        const res = await fetch(
          `${API_BASE}/api/consumers/identity`,
          { credentials: "include" }
        );

        if (!res.ok) {
          if (!canceled) {
            setIdentity({ is_logged_in: false, email: null });
          }
          return;
        }

        const data: ConsumerIdentity = await res.json();
        if (!canceled) {
          setIdentity(data);
        }
      } catch {
        if (!canceled) {
          setIdentity({ is_logged_in: false, email: null });
        }
      } finally {
        if (!canceled) setLoading(false);
      }
    })();

    return () => {
      canceled = true;
    };
  }, []);

  const handleLogout = async () => {
    try {
      await fetch(
        `${API_BASE}/api/auth/consumer/logout`,
        { method: "POST", credentials: "include" }
      );
    } finally {
      navigate("/", { replace: true });
    }
  };

  /* ===== ローディング中 ===== */
  if (loading) {
    return (
      <div style={{ padding: "24px 16px", maxWidth: 640, margin: "0 auto" }}>
        読み込み中…
      </div>
    );
  }

  /* ===== 未ログイン時 ===== */
  if (!identity || !identity.is_logged_in) {
    return (
      <div style={{ padding: "24px 16px", maxWidth: 480, margin: "0 auto" }}>
        <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 16 }}>
          アカウント設定
        </h1>

        <div
          style={{
            backgroundColor: "#F9FAFB",
            borderRadius: 12,
            padding: 16,
            color: "#374151",
            fontSize: 14,
          }}
        >
          現在ログインされていません。
        </div>
      </div>
    );
  }

  /* ===== ログイン時 ===== */
  return (
    <div style={{ padding: "24px 16px", maxWidth: 640, margin: "0 auto" }}>
      <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 24 }}>
        アカウント設定
      </h1>

      <div
        style={{
          backgroundColor: "#F9FAFB",
          borderRadius: 12,
          padding: 16,
          marginBottom: 24,
        }}
      >
        <div style={{ fontSize: 13, color: "#6B7280", marginBottom: 4 }}>
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
          {identity.email}
        </div>
      </div>

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
        }}
      >
        ログアウト
      </button>

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
