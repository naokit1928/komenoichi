// frontend/src/pages/public/FarmerApply/Step1AreaCheck.tsx
import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";

const C = {
  ink: "#1a1108", ink2: "#4b3e2a", ink3: "#5c4d3c",
  border: "#e8e2d8", bgBase: "#fdfcfa", bgPale: "#f4f1ed",
  red: "#C62828", gold: "#C49A1A", goldLight: "#FFF8E1",
} as const;

type PostalStatus = "idle" | "checking" | "ok" | "invalid" | "error";
type AreaType = "in" | "out";

function isInTargetArea(digits7: string): boolean {
  if (digits7.length !== 7) return false;
  const p3 = digits7.slice(0, 3);
  const p4 = digits7.slice(0, 4);
  if (["770", "771", "772", "773", "774", "776"].includes(p3)) return true;
  if (p4 === "7790") return true;
  return false;
}

interface Props {
  onNext: (areaType: AreaType, postal: string) => void;
}

export default function Step1AreaCheck({ onNext }: Props) {
  const navigate = useNavigate();
  const [postal1, setPostal1] = useState("");
  const [postal2, setPostal2] = useState("");
  const [postalStatus, setPostalStatus] = useState<PostalStatus>("idle");
  const [postalMsg, setPostalMsg] = useState("");
  const [isFarmer, setIsFarmer] = useState<boolean | null>(null);
  const [hasEmail, setHasEmail] = useState<boolean | null>(null);

  const postal2Ref = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const digits7 = postal1 + postal2;
  useEffect(() => {
    if (digits7.length !== 7) {
      setPostalStatus("idle"); setPostalMsg(""); return;
    }
    if (abortRef.current) abortRef.current.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    setPostalStatus("checking");
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`https://zipcloud.ibsnet.co.jp/api/search?zipcode=${digits7}`, { signal: ac.signal });
        const data = await res.json();
        if (ac.signal.aborted) return;
        if (data.status !== 200 || !Array.isArray(data.results) || !data.results[0]) {
          setPostalStatus("invalid"); setPostalMsg("存在しない郵便番号です");
        } else {
          setPostalStatus("ok"); setPostalMsg("");
        }
      } catch (e: any) {
        if (e?.name === "AbortError") return;
        setPostalStatus("error"); setPostalMsg("郵便番号の確認に失敗しました");
      }
    }, 350);
    return () => { clearTimeout(timer); ac.abort(); };
  }, [digits7]);

  const postalInvalid = (postal1.length > 0 && /[^0-9]/.test(postal1)) || (postal2.length > 0 && /[^0-9]/.test(postal2));
  const isStep1Valid = postalStatus === "ok" && !postalInvalid && isFarmer === true && hasEmail === true;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isStep1Valid) return;
    const area = isInTargetArea(digits7) ? "in" : "out";
    onNext(area, digits7);
  };

  const postalBorderColor = postalInvalid || postalStatus === "invalid" || postalStatus === "error" ? C.red : postalStatus === "ok" ? "#4CAF50" : C.border;
  const boxBase: React.CSSProperties = { padding: "13px 14px", borderRadius: 8, fontSize: 20, outline: "none", backgroundColor: C.bgBase, textAlign: "center", letterSpacing: "0.12em", fontWeight: 600, boxSizing: "border-box" };

  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: C.ink, marginBottom: 16 }}>無料開設サポートのお申し込み</h1>
        <p style={{ fontSize: 14, color: C.ink3, lineHeight: 1.8 }}>
          まずは面談で、ささいな疑問やご不安を解消しましょう。<br/>
          ご希望であれば、そのまま<strong style={{color: C.ink}}>最短その日のうちに「あなた専用の販売ページ」を完成</strong>させることも可能です！<br/><br/>
          ご相談をご希望の方は、まずは以下の項目をご記入ください。
        </p>
      </div>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 28, backgroundColor: "#fff", padding: "32px 24px", borderRadius: 16, border: `1px solid ${C.border}` }}>
        {/* 郵便番号 */}
        <div>
          <label style={{ display: "block", fontSize: 14, fontWeight: 700, color: C.ink, marginBottom: 6 }}>農地またはご自宅の郵便番号</label>
          <p style={{ fontSize: 12, color: C.ink3, marginBottom: 12, lineHeight: 1.5 }}>訪問またはオンラインサポートのエリア確認に使用します。</p>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input type="text" inputMode="numeric" value={postal1} maxLength={3} onChange={(e) => { const v = e.target.value.replace(/\D/g, "").slice(0, 3); setPostal1(v); if (v.length === 3) postal2Ref.current?.focus(); }} placeholder="123" style={{ ...boxBase, width: 80, border: `1px solid ${postalBorderColor}` }} />
            <span style={{ fontSize: 20, color: C.ink3, userSelect: "none" }}>−</span>
            <input ref={postal2Ref} type="text" inputMode="numeric" value={postal2} maxLength={4} onChange={(e) => { const v = e.target.value.replace(/\D/g, "").slice(0, 4); setPostal2(v); }} onKeyDown={(e) => { if (e.key === "Backspace" && postal2 === "") { setPostal1((prev) => prev.slice(0, -1)); } }} placeholder="4567" style={{ ...boxBase, width: 100, border: `1px solid ${postalBorderColor}` }} />
            {postalStatus === "checking" && <span style={{ fontSize: 12, color: C.ink3, marginLeft: 6 }}>確認中…</span>}
            {postalStatus === "ok" && <span style={{ fontSize: 18, color: "#4CAF50", marginLeft: 6 }}>✓</span>}
          </div>
          {(postalInvalid || postalStatus === "invalid" || postalStatus === "error") && (
            <p style={{ color: C.red, fontSize: 13, marginTop: 8, fontWeight: 600 }}>{postalInvalid ? "※半角数字のみで入力してください" : postalMsg}</p>
          )}
        </div>

        {/* 農家か */}
        <div>
          <label style={{ display: "block", fontSize: 14, fontWeight: 700, color: C.ink, marginBottom: 12 }}>ご自身でお米を生産している農家様ですか？</label>
          <div style={{ display: "flex", gap: 12 }}>
            <button type="button" onClick={() => setIsFarmer(true)} style={{ flex: 1, padding: "12px", borderRadius: 8, border: `1px solid ${isFarmer === true ? C.gold : C.border}`, backgroundColor: isFarmer === true ? C.goldLight : "#fff", color: isFarmer === true ? C.gold : C.ink, fontWeight: isFarmer === true ? 700 : 500, cursor: "pointer", fontSize: 15 }}>はい</button>
            <button type="button" onClick={() => setIsFarmer(false)} style={{ flex: 1, padding: "12px", borderRadius: 8, border: `1px solid ${isFarmer === false ? C.ink : C.border}`, backgroundColor: isFarmer === false ? C.bgPale : "#fff", color: C.ink, fontWeight: isFarmer === false ? 700 : 500, cursor: "pointer", fontSize: 15 }}>いいえ</button>
          </div>
          {isFarmer === false && (
            <div style={{ marginTop: 16, backgroundColor: C.bgPale, padding: "20px", borderRadius: 12, textAlign: "center" }}>
              <div style={{ fontWeight: 800, color: C.ink, marginBottom: 10, fontSize: 15 }}>農家様向けのページです</div>
              <button type="button" onClick={() => navigate("/farms")} style={{ background: C.ink, color: "#fff", border: "none", padding: "10px 24px", borderRadius: 999, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>お米を買いに行く</button>
            </div>
          )}
        </div>

        {/* メール有無 */}
        {isFarmer !== false && (
          <div>
            <label style={{ display: "block", fontSize: 14, fontWeight: 700, color: C.ink, marginBottom: 8 }}>GmailやYahoo!メールなどをお持ちですか？</label>
            <div style={{ display: "flex", gap: 12 }}>
              <button type="button" onClick={() => setHasEmail(true)} style={{ flex: 1, padding: "12px", borderRadius: 8, border: `1px solid ${hasEmail === true ? C.gold : C.border}`, backgroundColor: hasEmail === true ? C.goldLight : "#fff", color: hasEmail === true ? C.gold : C.ink, fontWeight: hasEmail === true ? 700 : 500, cursor: "pointer", fontSize: 15 }}>持っている</button>
              <button type="button" onClick={() => setHasEmail(false)} style={{ flex: 1, padding: "12px", borderRadius: 8, border: `1px solid ${hasEmail === false ? C.ink : C.border}`, backgroundColor: hasEmail === false ? C.bgPale : "#fff", color: C.ink, fontWeight: hasEmail === false ? 700 : 500, cursor: "pointer", fontSize: 15 }}>持っていない</button>
            </div>
            {hasEmail === false && (
              <div style={{ marginTop: 16, backgroundColor: C.bgPale, padding: "20px", borderRadius: 12 }}>
                <div style={{ fontWeight: 800, color: C.ink, marginBottom: 10, fontSize: 15 }}>メールアドレスが必要です</div>
                <p style={{ fontSize: 13, color: C.ink3 }}>まずスマホにGmailアプリを入れてアカウントを作成してから、改めてお申し込みください。</p>
              </div>
            )}
          </div>
        )}

        {isFarmer !== false && hasEmail !== false && (
          <div style={{ marginTop: 8 }}>
            <button type="submit" disabled={!isStep1Valid} style={{ width: "100%", padding: "16px", borderRadius: 999, border: "none", backgroundColor: isStep1Valid ? C.ink : "#ccc", color: "#fff", fontSize: 16, fontWeight: 700, cursor: isStep1Valid ? "pointer" : "not-allowed", transition: "all 0.2s" }}>
              次へ進む
            </button>
          </div>
        )}
      </form>
    </div>
  );
}