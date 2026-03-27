import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Footer from "@/components/Footer";

// 切り出したコンポーネントをインポート
import Step1AreaCheck from "./Step1AreaCheck";
import Step2ApplicationForm from "./Step2ApplicationForm";

const C = {
  ink: "#1a1108", ink2: "#4b3e2a", ink3: "#5c4d3c",
  border: "#e8e2d8", bgBase: "#fdfcfa", bgPale: "#f4f1ed",
  red: "#C62828", gold: "#C49A1A", goldLight: "#FFF8E1",
} as const;

type Step = "step1" | "step2" | "success";
type AreaType = "in" | "out";

export default function FarmerApplyPage() {
  const navigate = useNavigate();

  const [step, setStep] = useState<Step>("step1");
  const [areaType, setAreaType] = useState<AreaType>("in");
  const [postal, setPostal] = useState("");

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [step]);

  return (
    <div style={{ minHeight: "100vh", backgroundColor: C.bgBase, display: "flex", flexDirection: "column", fontFamily: "'Noto Sans JP', 'Hiragino Sans', sans-serif" }}>
      <header style={{ padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: `1px solid ${C.border}`, backgroundColor: "#fff" }}>
        <div onClick={() => navigate("/about-farmer")} style={{ fontSize: 18, fontWeight: 800, color: C.ink, letterSpacing: "0.05em", cursor: "pointer" }}>
          Komenoichi
        </div>
      </header>

      <main style={{ flexGrow: 1, padding: "40px 20px 80px", maxWidth: 600, margin: "0 auto", width: "100%" }}>
        
        {step === "step1" && (
          <Step1AreaCheck 
            onNext={(area, zip) => {
              setAreaType(area);
              setPostal(zip);
              setStep("step2");
            }} 
          />
        )}

        {step === "step2" && (
          <Step2ApplicationForm 
            areaType={areaType} 
            postal={postal} 
            onSuccess={() => setStep("success")} 
          />
        )}

        {step === "success" && (
          <div style={{ textAlign: "center", animation: "fadeIn 0.5s ease" }}>
            <div style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: C.goldLight, color: C.gold, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 32px" }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: C.ink, marginBottom: 16 }}>お申し込みありがとうございます</h1>
            <p style={{ fontSize: 15, color: C.ink3, lineHeight: 1.8, marginBottom: 32, textAlign: "left", backgroundColor: "#fff", padding: "24px", borderRadius: 16, border: `1px solid ${C.border}` }}>
              日程を調整の上、ご記入いただいたメールアドレス宛にご連絡いたします。<br/><br/>
              {areaType === "in" 
                ? "（※当日、お伺いする前に確認のお電話を差し上げる場合がございます）"
                : "（※オンライン面談用のGoogle MeetのURLをメールでお送りしますので、ご確認ください）"
              }
            </p>
            <button onClick={() => navigate("/")} style={{ padding: "14px 32px", borderRadius: 999, border: `1px solid ${C.border}`, backgroundColor: "#fff", color: C.ink, fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
              トップページへ戻る
            </button>
          </div>
        )}

      </main>
      <Footer />
    </div>
  );
}