import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE } from "@/config/api";

export default function AuthEmailRegisterPage() {
  const navigate = useNavigate();

  const [step, setStep] = useState<"email" | "otp">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const requestOtp = async () => {
    try {
      setError("");
      setLoading(true);

      const res = await fetch(
        `${API_BASE}/api/auth/register-email/request-otp`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
          credentials: "include",
        }
      );

      if (!res.ok) throw new Error("OTP送信に失敗しました");

      setStep("otp");
    } catch (e: any) {
      setError(e.message ?? "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    try {
      setError("");
      setLoading(true);

      const res = await fetch(
        `${API_BASE}/api/auth/register-email/verify-otp`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, code }),
          credentials: "include",
        }
      );

      if (!res.ok) throw new Error("認証に失敗しました");

      navigate("/farmer/registration", { replace: true });
    } catch (e: any) {
      setError(e.message ?? "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        padding: "24px 16px",
        boxSizing: "border-box",
        display: "flex",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 360,
        }}
      >
        <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 12 }}>
          農家アカウント作成
        </h1>

        <p style={{ fontSize: 14, color: "#555", marginBottom: 20 }}>
          農家登録に使用するメールアドレスを入力してください。
        </p>

        {step === "email" && (
          <>
            <input
              type="email"
              placeholder="メールアドレス"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{
                width: "100%",
                padding: "12px 14px",
                borderRadius: 8,
                border: "1px solid #ccc",
                fontSize: 16,
                boxSizing: "border-box",
              }}
            />

            {error && (
              <div style={{ color: "#b91c1c", marginTop: 10 }}>
                {error}
              </div>
            )}

            <button
              onClick={requestOtp}
              disabled={loading || !email}
              style={{
                width: "92%",
                margin: "20px auto 0",
                display: "block",
                padding: "12px",
                borderRadius: 10,
                background: loading ? "#ddd" : "#111",
                color: "#fff",
                border: "none",
                fontWeight: 700,
                fontSize: 16,
              }}
            >
              {loading ? "送信中…" : "OTPを送信"}
            </button>
          </>
        )}

        {step === "otp" && (
          <>
            <input
              type="text"
              placeholder="6桁のコード"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              maxLength={6}
              style={{
                width: "100%",
                padding: "12px 14px",
                borderRadius: 8,
                border: "1px solid #ccc",
                fontSize: 16,
                boxSizing: "border-box",
              }}
            />

            {error && (
              <div style={{ color: "#b91c1c", marginTop: 10 }}>
                {error}
              </div>
            )}

            <button
              onClick={verifyOtp}
              disabled={loading || code.length !== 6}
              style={{
                width: "92%",
                margin: "20px auto 0",
                display: "block",
                padding: "12px",
                borderRadius: 10,
                background: loading ? "#ddd" : "#111",
                color: "#fff",
                border: "none",
                fontWeight: 700,
                fontSize: 16,
              }}
            >
              {loading ? "確認中…" : "登録へ進む"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
