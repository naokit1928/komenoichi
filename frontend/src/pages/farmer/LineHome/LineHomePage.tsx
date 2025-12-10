// frontend/src/pages/LineHomePage.tsx
import React, { useEffect, useState } from "react";

interface DevResult {
  ok: boolean;
  user_id?: number;
  farm_id?: number;
  line_user_id?: string;
  next?: string;
  note?: string;
  detail?: string;
}

export default function LineHomePage() {
  const apiBase = import.meta.env.VITE_API_BASE || "";
  const devMode = import.meta.env.VITE_DEV_MODE === "1";
  const [farmId, setFarmId] = useState<string | null>(null);
  const [message, setMessage] = useState<string>("");

  // 初回ロード：localStorage から farm_id を取得
  useEffect(() => {
    const saved = localStorage.getItem("last_farm_id");
    if (saved) setFarmId(saved);
  }, []);

  // 共通：POSTユーティリティ（DEV専用）
  const callDevAPI = async (endpoint: string, body: any) => {
    const res = await fetch(`${apiBase}${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.detail || `APIエラー: ${endpoint}`);
    setMessage(`${endpoint} OK: ${JSON.stringify(data)}`);
    return data as DevResult;
  };

  // DEV：初期化系
  const handleResetUser = async () => {
    try {
      await callDevAPI("/dev/reset_user", { line_user_id: "test_001" });
      setMessage("ユーザー初期化完了");
    } catch (e: any) {
      setMessage(`Error: ${e.message}`);
    }
  };
  const handleTestLogin = async () => {
    try {
      await callDevAPI("/dev/test_login", { line_user_id: "test_001" });
    } catch (e: any) {
      setMessage(`Error: ${e.message}`);
    }
  };
  const handleFriendship = async () => {
    try {
      await callDevAPI("/dev/friendship_override", {
        line_user_id: "test_001",
        is_friend: true,
      });
    } catch (e: any) {
      setMessage(`Error: ${e.message}`);
    }
  };
  const handleFinishRegistration = async () => {
    try {
      const res = await fetch(`${apiBase}/api/farms/finish_registration`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          line_user_id: "test_001",
          farm_name: "テスト農家",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 409) {
        const existingId = res.headers.get("X-Existing-Farm-Id");
        if (existingId) {
          localStorage.setItem("last_farm_id", existingId);
          setFarmId(existingId);
        }
        setMessage("409 Conflict: 既存farmを使用します");
        window.location.href = "/line/home";
        return;
      }
      if (!res.ok) throw new Error(data?.detail || "登録失敗");
      if (data?.farm_id) {
        localStorage.setItem("last_farm_id", String(data.farm_id));
        setFarmId(String(data.farm_id));
      }
      setMessage(`登録成功: ${JSON.stringify(data)}`);
      window.location.href = "/line/home";
    } catch (e: any) {
      setMessage(`Error: ${e.message}`);
    }
  };

  // DEV一括：友だち追加→登録まで
  const handleDevAllInOne = async () => {
    try {
      setMessage("DEV一括: login→friend→registration 実行中…");
      await callDevAPI("/dev/test_login", { line_user_id: "test_001" });
      await callDevAPI("/dev/friendship_override", {
        line_user_id: "test_001",
        is_friend: true,
      });
      await handleFinishRegistration();
    } catch (e: any) {
      setMessage(`Error: ${e.message}`);
    }
  };

  // フロント側の farm 選択をクリア（未登録状態を再現）
  const handleClearLastFarm = () => {
    localStorage.removeItem("last_farm_id");
    setFarmId(null);
    setMessage("last_farm_id をクリアしました（未登録状態の挙動を確認できます）");
  };

  const hasFarm = !!farmId;

  // 常時表示3ボタンのリンク（未登録時は登録ページへフォールバック）
  // ① 受け取り場所設定：登録済みなら /line/farmer-pickup?farm_id=XX、未登録なら /farmer/registration
  const profileHref = hasFarm
    ? `/line/farmer-pickup?farm_id=${farmId}`
    : "/farmer/registration";
  // ② 公開プロフィール設定：従来どおり
  const settingsHref = hasFarm
    ? `/farmer/settings?farm_id=${farmId}`
    : "/farmer/registration";
  // ③ 予約一覧：従来どおり
  const reservationsHref = hasFarm
  ? `/farmer/reservations?farm_id=${farmId}`
  : "/farmer/registration";


  return (
    <div className="mx-auto max-w-md min-h-screen flex flex-col bg-white">
      {/* ヘッダー：リンクは一切置かない */}
      <header className="px-4 py-4 border-b bg-white/80 backdrop-blur relative z-10">
        <h1 className="text-lg font-semibold">LINEハブ（テスト）</h1>
        <p className="text-sm text-gray-500">本人登録・設定・予約確認の入口</p>
      </header>

      {/* ヘッダー直下に少し余白（固定ボトムCTAの重なり誤表示対策） */}
      <div className="h-1" />

      <main className="flex-1 px-4 py-4">
        {/* 状態表示 */}
        <section className="mb-4">
          {hasFarm ? (
            <div className="p-3 text-sm text-gray-700 border rounded-xl">
              <div>
                <span className="font-semibold">現在の farm_id:</span> {farmId}
              </div>
              <div className="text-xs text-gray-500 mt-1">
                localStorage.last_farm_id に保存されています
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-700">
              未登録状態です。下の3ボタンは常時表示され、未登録時は本人登録ページへ誘導します。
            </p>
          )}
        </section>

        {/* 常時：縦3ボタン（中央上） */}
        <section className="mb-6 flex flex-col gap-3">
          <a href={profileHref} className="block w-full text-center rounded-xl py-3 border bg-white">
            受け取り場所設定
          </a>
          <a href={settingsHref} className="block w-full text-center rounded-xl py-3 border bg-white">
            公開プロフィール設定
          </a>
          <a
            href={reservationsHref}
            className="block w-full text-center rounded-xl py-3 border bg-white"
          >
            予約一覧
          </a>
        </section>

        {/* DEVツール（本番では VITE_DEV_MODE=0 に） */}
        {devMode && (
          <section className="mb-6 border rounded-2xl p-4 bg-gray-50">
            <h2 className="font-semibold text-sm mb-2">DEVツール（開発専用）</h2>
            <div className="flex flex-col gap-2 text-sm">
              <button onClick={handleResetUser} className="px-3 py-2 rounded bg-gray-200 hover:bg-gray-300">
                /dev/reset_user
              </button>
              <button onClick={handleTestLogin} className="px-3 py-2 rounded bg-gray-200 hover:bg-gray-300">
                /dev/test_login
              </button>
              <button onClick={handleFriendship} className="px-3 py-2 rounded bg-gray-200 hover:bg-gray-300">
                /dev/friendship_override
              </button>
              <button
                onClick={handleFinishRegistration}
                className="px-3 py-2 rounded bg-green-200 hover:bg-green-300 font-medium"
              >
                登録して設定をはじめる（finish_registration）
              </button>
              <button
                onClick={handleDevAllInOne}
                className="px-3 py-2 rounded bg-indigo-200 hover:bg-indigo-300 font-medium"
              >
                友だち追加→登録まで（DEV一括）
              </button>
              <button
                onClick={handleClearLastFarm}
                className="px-3 py-2 rounded bg-red-200 hover:bg-red-300 font-medium"
              >
                last_farm_id をクリア（未登録状態にする）
              </button>
            </div>
          </section>
        )}

        {message && (
          <div className="mt-2 text-xs text-gray-600 whitespace-pre-wrap">{message}</div>
        )}
      </main>
    </div>
  );
}
