import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom";

export type SnsPlatform = "instagram" | "line" | "x" | "facebook" | "youtube" | "tiktok";

export type SnsLink = {
  platform: SnsPlatform;
  account_id: string;
};

type PlatformConfig = {
  name: string;
  inputLabel: string;
  placeholder: string;
  domain: string;
  helpText: string;
};

const PLATFORMS: Record<SnsPlatform, PlatformConfig> = {
  instagram: {
    name: "Instagram",
    inputLabel: "ユーザーネーム",
    placeholder: "例: kometokushima",
    domain: "instagram.com/",
    helpText: "Instagramプロフィール画面の @ の後に表示される英数字を入力してください。日本語の表示名は使えません。",
  },
  line: {
    name: "LINE",
    inputLabel: "LINE ID",
    placeholder: "個人: naokit1007 ／ 公式アカウント: @xxx",
    domain: "line.me/ti/p/~",
    helpText: "LINEアプリの「設定→プロフィール→ID」で確認できる英数字。LINE公式アカウントの場合は先頭に「@」を付けてください。日本語の表示名は使えません。",
  },
  x: {
    name: "X (旧Twitter)",
    inputLabel: "ユーザー名",
    placeholder: "例: kometokushima（@は不要）",
    domain: "x.com/",
    helpText: "プロフィール画面の「@xxx」の xxx 部分を入力してください。@は自動で付きます。日本語の表示名は使えません。",
  },
  facebook: {
    name: "Facebook",
    inputLabel: "FacebookページのID",
    placeholder: "例: kometokushima",
    domain: "facebook.com/",
    helpText: "FacebookページのURL（facebook.com/◯◯）の◯◯部分。個人プロフィールは対応していません。",
  },
  youtube: {
    name: "YouTube",
    inputLabel: "ハンドル名",
    placeholder: "例: kometokushima（@は不要）",
    domain: "youtube.com/@",
    helpText: "YouTubeチャンネル画面の「@xxx」の xxx 部分を入力してください。チャンネル名（日本語の表示名）は使えません。",
  },
  tiktok: {
    name: "TikTok",
    inputLabel: "ユーザー名",
    placeholder: "例: kometokushima（@は不要）",
    domain: "tiktok.com/@",
    helpText: "TikTokプロフィール画面の「@xxx」の xxx 部分を入力してください。",
  },
};

type Props = {
  links: SnsLink[];
  onSave: (next: SnsLink[]) => void | Promise<void>;
  saving?: boolean;
  disabled?: boolean;
};

function SnsLinkModal({ open, initialLinks, onClose, onConfirm, busy }: {
  open: boolean; initialLinks: SnsLink[]; onClose: () => void; onConfirm: (links: SnsLink[]) => void | Promise<void>; busy: boolean;
}) {
  const [draftLinks, setDraftLinks] = useState<SnsLink[]>([]);

  useEffect(() => {
    if (open) setDraftLinks([...initialLinks]);
  }, [open, initialLinks]);

  if (!open) return null;

  const addLink = () => {
    if (draftLinks.length < 3) {
      setDraftLinks([...draftLinks, { platform: "instagram", account_id: "" }]);
    }
  };

  const updateLink = (index: number, key: keyof SnsLink, value: string) => {
    const next = [...draftLinks];
    next[index] = { ...next[index], [key]: value as any };
    setDraftLinks(next);
  };

  const removeLink = (index: number) => {
    setDraftLinks(draftLinks.filter((_, i) => i !== index));
  };

  const isValid = draftLinks.every((l) => l.account_id.trim().length > 0);

  return ReactDOM.createPortal(
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 2147483646 }} />
      <div role="dialog" className="fixed left-1/2 z-[2147483647] -translate-x-1/2" style={{ top: "40px", width: "min(560px, 92vw)", borderRadius: 28, background: "#FFFFFF", padding: "22px 18px 18px", maxHeight: "calc(100vh - 80px)", overflowY: "auto" }}>
        <div className="flex items-start justify-between mb-4">
          <div style={{ fontSize: 16, fontWeight: 700 }}>SNS・連絡先リンクの設定</div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", cursor: "pointer" }}>
            <svg width="22" height="22" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12" fill="none" stroke="#111" strokeWidth="2" strokeLinecap="round" /></svg>
          </button>
        </div>

        <div className="space-y-6">
          {draftLinks.map((link, idx) => {
            const config = PLATFORMS[link.platform];
            return (
              <div key={idx} style={{ background: "#F9FAFB", padding: 16, borderRadius: 16, border: "1px solid #E5E7EB" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#4B5563" }}>リンク {idx + 1}</span>
                  <button onClick={() => removeLink(idx)} style={{ background: "none", border: "none", color: "#DC2626", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>削除</button>
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#6B7280" }}>種類</label>
                  <select value={link.platform} onChange={(e) => updateLink(idx, "platform", e.target.value)} style={{ width: "100%", padding: "10px", borderRadius: 8, border: "1px solid #D1D5DB", marginTop: 4, background: "#fff" }}>
                    {Object.entries(PLATFORMS).map(([k, v]) => (<option key={k} value={k}>{v.name}</option>))}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize: 12, fontWeight: 600, color: "#6B7280" }}>{config.inputLabel}</label>
                  <input
                    type="text"
                    value={link.account_id}
                    onChange={(e) => updateLink(idx, "account_id", e.target.value)}
                    placeholder={config.placeholder}
                    style={{ width: "100%", padding: "10px", borderRadius: 8, border: "1px solid #D1D5DB", marginTop: 4 }}
                  />
                  <div style={{ fontSize: 11, color: "#6B7280", marginTop: 6, lineHeight: 1.5 }}>
                    {config.helpText}
                  </div>
                </div>
              </div>
            );
          })}

          {draftLinks.length < 3 && (
            <button onClick={addLink} style={{ width: "100%", padding: "14px", border: "2px dashed #D1D5DB", borderRadius: 16, background: "transparent", color: "#4B5563", fontWeight: 600, cursor: "pointer" }}>＋ リンクを追加する</button>
          )}
        </div>

        <div style={{ marginTop: 24 }}>
          <button onClick={() => isValid && onConfirm(draftLinks)} disabled={busy || !isValid} style={{ width: "100%", height: 60, background: "#000", color: "#fff", borderRadius: 16, fontSize: 18, fontWeight: 700, opacity: isValid ? 1 : 0.5 }}>
            {busy ? "保存中..." : "保存"}
          </button>
        </div>
      </div>
    </>
    , document.body
  );
}

export default function SnsLinkEditor({ links, onSave, saving, disabled }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => !disabled && setOpen(true)} className="w-full text-left" style={{ background: "transparent", border: "none", padding: "12px 0", cursor: disabled ? "not-allowed" : "pointer" }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#4b3e2a", marginBottom: 8 }}>SNS・連絡先リンク</div>
        {links.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {links.map((l, i) => (
              <div key={i} style={{ fontSize: 14, color: "#2563EB", display: "flex", alignItems: "center", gap: 6 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path></svg>
                <span style={{ borderBottom: "1px solid rgba(37, 99, 235, 0.2)" }}>{PLATFORMS[l.platform]?.domain}{l.account_id}</span>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: 13, color: "#9CA3AF" }}>SNSを設定してDMでの相談などを受け付けられます。</div>
        )}
      </button>
      <SnsLinkModal open={open} initialLinks={links} onClose={() => !saving && setOpen(false)} onConfirm={async (nl) => { await onSave(nl); setOpen(false); }} busy={!!saving} />
    </>
  );
}