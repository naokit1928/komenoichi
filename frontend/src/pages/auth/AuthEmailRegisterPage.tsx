import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE } from "@/config/api";

export default function AuthEmailRegisterPage() {
  const navigate = useNavigate();

  const [step, setStep] = useState<"email" | "otp">("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ---------------------------
  // OTP 発行
  // ---------------------------
  const requestOtp = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `${API_BASE}/api/auth/register-email/request-otp`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
          credentials: "include",
        }
      );

      if (!res.ok) {
        throw new Error("OTP送信に失敗しました");
      }

      setStep("otp");
    } catch (e: any) {
      setError(e.message ?? "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  // ---------------------------
  // OTP 検証
  // ---------------------------
  const verifyOtp = async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(
        `${API_BASE}/api/auth/register-email/verify-otp`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, code }),
          credentials: "include",
        }
      );

      if (!res.ok) {
        throw new Error("認証に失敗しました");
      }

      // ✅ farm_id セッション確立済み
      navigate("/farmer/registration", { replace: true });
    } catch (e: any) {
      setError(e.message ?? "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 24, maxWidth: 360 }}>
      <h1 style={{ fontSize: 20, fontWeight: 700 }}>
        農家登録（メール認証）
      </h1>

      {step === "email" && (
        <>
          <p style={{ marginTop: 12 }}>
            農家登録に使用するメールアドレスを入力してください
          </p>

          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="example@example.com"
            style={{ width: "100%", marginTop: 12 }}
          />

          <button
            onClick={requestOtp}
            disabled={loading || !email}
            style={{ marginTop: 16 }}
          >
            {loading ? "送信中…" : "OTPを送信"}
          </button>
        </>
      )}

      {step === "otp" && (
        <>
          <p style={{ marginTop: 12 }}>
            メールに届いた6桁コードを入力してください
          </p>

          <input
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="123456"
            maxLength={6}
            style={{ width: "100%", marginTop: 12 }}
          />

          <button
            onClick={verifyOtp}
            disabled={loading || code.length !== 6}
            style={{ marginTop: 16 }}
          >
            {loading ? "確認中…" : "認証して登録へ進む"}
          </button>
        </>
      )}

      {error && (
        <p style={{ marginTop: 12, color: "red" }}>
          {error}
        </p>
      )}
    </div>
  );
}
