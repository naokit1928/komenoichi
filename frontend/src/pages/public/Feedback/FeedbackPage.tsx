// frontend/src/pages/public/Feedback/FeedbackPage.tsx
import React, { useState } from "react";
import { API_BASE } from "@/config/api";


const MIN_LENGTH = 20;
const MAX_LENGTH = 500;

type SubmitStatus = "idle" | "submitting" | "success" | "error";

// このページ専用のスタイル（他ページに影響しないようプレフィックス付きクラス）
const feedbackStyles = `
  .feedback-title {
    font-size: 1.4rem;
    margin-bottom: 12px;
  }
  .feedback-text-main {
    font-size: 0.9rem;
    line-height: 1.7;
  }
  .feedback-counter {
    font-size: 0.75rem;
    color: #666666;
  }
  .feedback-error {
    color: #d00;
    font-size: 0.85rem;
    margin-top: 4px;
  }
  .feedback-note {
    font-size: 0.8rem;
    color: #555555;
  }
  .feedback-note-small {
    font-size: 0.75rem;
    color: #555555;
  }
`;

const FeedbackPage: React.FC = () => {
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [messageError, setMessageError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [status, setStatus] = useState<SubmitStatus>("idle");
  const [showErrors, setShowErrors] = useState(false); // ★ エラー表示トリガー

  const validateMessage = (value: string): string | null => {
    const length = value.trim().length;
    if (length < MIN_LENGTH) {
      return `${MIN_LENGTH}文字以上でご入力ください。`;
    }
    if (length > MAX_LENGTH) {
      return `${MAX_LENGTH}文字以内でご入力ください。`;
    }
    return null;
  };

  const validateEmail = (value: string): string | null => {
    const trimmed = value.trim();
    if (trimmed === "") {
      return null; // 任意項目
    }
    // 簡易チェックのみ
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(trimmed)) {
      return "正しいメールアドレスの形式で入力してください。";
    }
    return null;
  };

  const handleMessageChange = (
    e: React.ChangeEvent<HTMLTextAreaElement>
  ): void => {
    const value = e.target.value;
    setMessage(value);
    const err = validateMessage(value);
    setMessageError(err);
  };

  const handleEmailChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ): void => {
    const value = e.target.value;
    setEmail(value);
    const err = validateEmail(value);
    setEmailError(err);
  };

  const canSubmit =
    status !== "submitting" &&
    validateMessage(message) === null &&
    validateEmail(email) === null &&
    message.trim().length >= MIN_LENGTH;

  const handleSubmit = async (
    e: React.FormEvent<HTMLFormElement>
  ): Promise<void> => {
    e.preventDefault();

    // ここで初めてエラーを表示するフラグを立てる
    setShowErrors(true);

    const msgErr = validateMessage(message);
    const mailErr = validateEmail(email);

    setMessageError(msgErr);
    setEmailError(mailErr);
    setSubmitError(null);

    if (msgErr || mailErr) {
      return;
    }

    setStatus("submitting");
    try {
      const payload = {
        source: "feedback_page",
        message: message.trim(),
        email: email.trim() || null,
      };

      const res = await fetch(`${API_BASE}/api/feedback`, {
      method: "POST",
      headers: {
       "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });


      if (!res.ok) {
        throw new Error("Failed to submit feedback");
      }

      setStatus("success");
    } catch (err) {
      console.error(err);
      setSubmitError(
        "送信に失敗しました。時間をおいて再度お試しください。"
      );
      setStatus("error");
    }
  };

  // 送信完了後の表示
  if (status === "success") {
    return (
      <div className="page-root">
        <style>{feedbackStyles}</style>
        <div
          className="page-container"
          style={{ maxWidth: 640, margin: "0 auto", padding: "16px" }}
        >
          <div className="card">
            <h1 className="page-title feedback-title">
              フィードバックをお送りいただきありがとうございました
            </h1>
            <p className="page-text feedback-text-main">
              いただいた内容は、今後のサービス改善の参考にさせていただきます。
            </p>
            <p className="page-text feedback-note-small">
              このページは閉じていただいて問題ありません。
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-root">
      <style>{feedbackStyles}</style>
      <div
        className="page-container"
        style={{ maxWidth: 640, margin: "0 auto", padding: "16px" }}
      >
        <div className="card">
          <h1 className="page-title feedback-title">フィードバックの送信</h1>
          <p className="page-text feedback-text-main">
            ご意見・不具合のご連絡ありがとうございます。
            原則として個別のご返信は行っておりませんが、いただいた内容は今後のサービス改善の参考にさせていただきます。
          </p>

          {submitError && (
            <div className="alert alert-error feedback-error">
              {submitError}
            </div>
          )}

          <form onSubmit={handleSubmit} noValidate>
            {/* 内容 */}
            <div className="form-group" style={{ marginTop: 16 }}>
              <label className="form-label">内容（必須）</label>
              <textarea
                className="form-textarea"
                value={message}
                onChange={handleMessageChange}
                rows={6}
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                  minHeight: 160,
                }}
                placeholder={
                  "例）「◯◯のページでボタンを押しても反応しません」\n「予約確認画面のこの部分が分かりにくかったです」など、できるだけ具体的に教えてください。"
                }
              />
              <div
                className="form-helper-row"
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  marginTop: 4,
                }}
              >
                <span className="form-counter feedback-counter">
                  現在 {message.trim().length} / {MAX_LENGTH} 文字
                </span>
              </div>
              {showErrors && messageError && (
                <div className="feedback-error">{messageError}</div>
              )}
            </div>

            {/* メールアドレス（任意） */}
            <div className="form-group" style={{ marginTop: 24 }}>
              <label className="form-label">メールアドレス（任意）</label>
              <input
                type="email"
                className="form-input"
                value={email}
                onChange={handleEmailChange}
                placeholder="example@example.com"
                style={{
                  width: "100%",
                  boxSizing: "border-box",
                }}
              />
              <p className="form-note feedback-note">
                原則として個別のご返信は行っておりませんが、重大な不具合の際に詳細をお伺いするために使用させていただく場合があります。
              </p>
              {showErrors && emailError && (
                <div className="feedback-error">{emailError}</div>
              )}
            </div>

            {/* 送信ボタン */}
            <div className="form-actions" style={{ marginTop: 24 }}>
              <button
                type="submit"
                className="btn-primary"
                disabled={!canSubmit}
              >
                {status === "submitting" ? "送信中..." : "送信する"}
              </button>
            </div>

            <p
              className="form-note-small feedback-note-small"
              style={{ marginTop: 8 }}
            >
              ※ 原則として個別のご返信はいたしませんが、サービス改善の参考にさせていただきます。
            </p>
          </form>
        </div>
      </div>
    </div>
  );
};

export default FeedbackPage;
