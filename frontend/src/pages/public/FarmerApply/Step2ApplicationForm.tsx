// frontend/src/pages/public/FarmerApply/Step2ApplicationForm.tsx
import React, { useState, useEffect } from "react";

const C = {
  ink: "#1a1108", ink2: "#4b3e2a", ink3: "#5c4d3c",
  border: "#e8e2d8", bgBase: "#fdfcfa", bgPale: "#f4f1ed",
  red: "#C62828", gold: "#C49A1A", goldLight: "#FFF8E1",
} as const;

type AreaType = "in" | "out";

interface Props {
  areaType: AreaType;
  postal: string;
  onSuccess: () => void;
}

const getAvailableDates = () => {
  const dates = [];
  const daysStr = ["日", "月", "火", "水", "木", "金", "土"];
  
  for (let i = 1; i <= 10; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    const dayOfWeek = d.getDay();
    
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const day = String(d.getDate()).padStart(2, "0");
      
      dates.push({
        value: `${y}-${m}-${day}`,
        label: `${d.getMonth() + 1}月${d.getDate()}日 (${daysStr[dayOfWeek]})`
      });
    }
  }
  return dates;
};

export default function Step2ApplicationForm({ areaType, postal, onSuccess }: Props) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  
  const [addressBase, setAddressBase] = useState("");
  const [addressDetail, setAddressDetail] = useState("");
  
  const [date1, setDate1] = useState("");
  const [time1, setTime1] = useState("");
  const [date2, setDate2] = useState("");
  const [time2, setTime2] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const availableDates = getAvailableDates();

  useEffect(() => {
    if (areaType === "in" && postal.length === 7) {
      fetch(`https://zipcloud.ibsnet.co.jp/api/search?zipcode=${postal}`)
        .then(res => res.json())
        .then(data => {
          if (data.status === 200 && data.results && data.results[0]) {
            const r = data.results[0];
            setAddressBase(`${r.address1}${r.address2}${r.address3}`);
          }
        })
        .catch(e => console.error("住所取得エラー:", e));
    }
  }, [areaType, postal]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const fullAddress = areaType === "in" ? `${addressBase} ${addressDetail}` : "";
    const formData = {
      areaType, postal, name, email, phone, 
      address: fullAddress,
      date1, time1, date2, time2
    };

    // ★TODO: FastAPIへの送信処理
    console.log("送信データ:", formData);
    
    setTimeout(() => {
      setIsSubmitting(false);
      onSuccess();
    }, 1000);
  };

  const isFormValid = 
    name && email && phone && date1 && time1 && 
    (areaType === "out" || (addressBase && addressDetail));

  const inputStyle = { width: "100%", padding: "14px", borderRadius: 8, border: `1px solid ${C.border}`, fontSize: 16, outline: "none", boxSizing: "border-box" as const, backgroundColor: "#fff" };
  const rowStyle = { display: "flex", gap: "16px", flexWrap: "wrap" as const };
  const colStyle = { flex: "1 1 200px", display: "flex", flexDirection: "column" as const, gap: "8px" };

  return (
    <div style={{ animation: "fadeIn 0.4s ease" }}>
      <div style={{ marginBottom: 32 }}>
        {areaType === "in" ? (
          <div style={{ display: "inline-block", backgroundColor: "#E8F5E9", color: "#2E7D32", fontSize: 13, fontWeight: 700, padding: "6px 14px", borderRadius: 999, marginBottom: 16 }}>✓ 訪問サポートの対象エリアです</div>
        ) : (
          <div style={{ display: "inline-block", backgroundColor: "#E3F2FD", color: "#1565C0", fontSize: 13, fontWeight: 700, padding: "6px 14px", borderRadius: 999, marginBottom: 16 }}>📹 オンラインでサポートします</div>
        )}
        
        <h1 style={{ fontSize: 22, fontWeight: 800, color: C.ink, marginBottom: 12 }}>
          {areaType === "in" ? "訪問サポート（無料）のご予約" : "オンラインサポート（無料）のご予約"}
        </h1>
        
        <p style={{ fontSize: 14, color: C.ink3, lineHeight: 1.8 }}>
          {areaType === "in" 
            ? "徳島県内の対象エリア内なので、担当者が直接お伺いし、対面でしっかりサポートいたします！訪問先の住所と、ご都合の良い日時をお選びください。" 
            : "スマホのビデオ通話（Google Meet）で丁寧にサポートいたします！URLをお送りするための連絡先と、ご希望の日時をお選びください。"
          }
        </p>
      </div>

      <form onSubmit={handleSubmit} style={{ backgroundColor: "#fff", padding: "32px 24px", borderRadius: 16, border: `1px solid ${C.border}`, display: "flex", flexDirection: "column", gap: 28 }}>
        
        {/* =========================================
            希望日時
        ========================================= */}
        <div style={{ backgroundColor: C.bgPale, padding: "20px", borderRadius: 12, border: `1px solid ${C.border}` }}>
          <label style={{ display: "block", fontSize: 16, fontWeight: 800, color: C.ink, marginBottom: 12 }}>希望日時を選択してください <span style={{color: C.red}}>*</span></label>
          <p style={{ fontSize: 13, color: C.ink3, marginBottom: 16 }}>
            平日の 14:00 〜 18:00 の間で対応可能です。<br/>
            ※スケジュールが合わない場合はメールで調整させていただきます。
          </p>
          
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.ink2, marginBottom: 4 }}>第一希望 <span style={{color: C.red}}>*</span></div>
            <div style={{ display: "flex", gap: 8 }}>
              <select value={date1} onChange={(e) => setDate1(e.target.value)} style={{ ...inputStyle, flex: 3 }} required>
                <option value="">日付を選択</option>
                {availableDates.map(d => (
                  <option key={d.value} value={d.value}>{d.label}</option>
                ))}
              </select>
              <select value={time1} onChange={(e) => setTime1(e.target.value)} style={{ ...inputStyle, flex: 2 }} required>
                <option value="">時間</option>
                <option value="14:00">14:00</option>
                <option value="15:00">15:00</option>
                <option value="16:00">16:00</option>
                <option value="17:00">17:00</option>
                <option value="18:00">18:00</option>
              </select>
            </div>
          </div>

          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.ink2, marginBottom: 4 }}>第二希望（任意）</div>
            <div style={{ display: "flex", gap: 8 }}>
              <select value={date2} onChange={(e) => setDate2(e.target.value)} style={{ ...inputStyle, flex: 3 }}>
                <option value="">日付を選択</option>
                {availableDates.map(d => (
                  <option key={d.value} value={d.value}>{d.label}</option>
                ))}
              </select>
              <select value={time2} onChange={(e) => setTime2(e.target.value)} style={{ ...inputStyle, flex: 2 }}>
                <option value="">時間</option>
                <option value="14:00">14:00</option>
                <option value="15:00">15:00</option>
                <option value="16:00">16:00</option>
                <option value="17:00">17:00</option>
                <option value="18:00">18:00</option>
              </select>
            </div>
          </div>
        </div>

        {/* =========================================
            連絡先情報 (横並びで高さを圧縮)
        ========================================= */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          
          <div style={rowStyle}>
            <div style={colStyle}>
              <label style={{ fontSize: 14, fontWeight: 700, color: C.ink }}>お名前 <span style={{color: C.red}}>*</span></label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="例：山田 太郎" style={inputStyle} required />
            </div>
            <div style={colStyle}>
              <label style={{ fontSize: 14, fontWeight: 700, color: C.ink }}>電話番号（ハイフンなし可） <span style={{color: C.red}}>*</span></label>
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="例：09012345678" style={inputStyle} required />
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <div>
              <label style={{ fontSize: 14, fontWeight: 700, color: C.ink }}>メールアドレス <span style={{color: C.red}}>*</span></label>
              <span style={{ fontSize: 12, color: C.ink3, marginLeft: 8 }}>※キャリアメールは利用不可</span>
            </div>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="例：yamada@gmail.com" style={inputStyle} required />
          </div>

          {areaType === "in" && (
            <div style={{ backgroundColor: "#faf9f7", padding: "20px", borderRadius: 12, border: `1px solid ${C.border}` }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 16 }}>
                <label style={{ fontSize: 15, fontWeight: 800, color: C.ink }}>訪問先の住所 <span style={{color: C.red}}>*</span></label>
                <span style={{ fontSize: 14, fontWeight: 600, color: C.ink2 }}>〒{postal.slice(0,3)}-{postal.slice(3)}</span>
              </div>
              
              <div style={rowStyle}>
                <div style={colStyle}>
                  <label style={{ fontSize: 12, color: C.ink3 }}>市区町村まで（自動入力）</label>
                  <input type="text" value={addressBase} onChange={(e) => setAddressBase(e.target.value)} placeholder="例：徳島県徳島市〇〇町" style={inputStyle} required />
                </div>
                <div style={colStyle}>
                  <label style={{ fontSize: 12, color: C.ink3 }}>番地・建物名など <span style={{color: C.red}}>*</span></label>
                  <input type="text" value={addressDetail} onChange={(e) => setAddressDetail(e.target.value)} placeholder="例：1-2-3 コーポ農園101" style={{...inputStyle, border: addressDetail ? `1px solid ${C.border}` : `1px solid ${C.red}`}} required />
                </div>
              </div>
            </div>
          )}
        </div>

        <button type="submit" disabled={!isFormValid || isSubmitting} style={{ width: "100%", padding: "16px", borderRadius: 999, border: "none", backgroundColor: isFormValid ? C.ink : "#ccc", color: "#fff", fontSize: 16, fontWeight: 700, cursor: isFormValid ? "pointer" : "not-allowed", transition: "all 0.2s" }}>
          {isSubmitting ? "送信中..." : "この内容で申し込む"}
        </button>
      </form>
    </div>
  );
}