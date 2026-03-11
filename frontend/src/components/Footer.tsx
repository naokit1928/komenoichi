import React from "react";
import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer style={{ 
      backgroundColor: "#fdfcfa", 
      padding: "40px 16px calc(100px + env(safe-area-inset-bottom))", 
      marginTop: "auto", 
      borderTop: "1px solid #e8e2d8" 
    }}>
      <div style={{ maxWidth: 540, margin: "0 auto", textAlign: "center" }}>
        
        {/* リンク集 */}
        <div style={{ 
          display: "flex", 
          flexWrap: "wrap", 
          justifyContent: "center", 
          gap: "12px 24px", 
          marginBottom: 24 
        }}>
          <Link to="/law" style={{ color: "#7a6c58", fontSize: 12, textDecoration: "none" }}>特定商取引法に基づく表記</Link>
          <Link to="/terms" style={{ color: "#7a6c58", fontSize: 12, textDecoration: "none" }}>利用規約</Link>
          <Link to="/privacy" style={{ color: "#7a6c58", fontSize: 12, textDecoration: "none" }}>プライバシーポリシー</Link>
        </div>

        {/* コピーライト */}
        <div style={{ color: "#b8ac9e", fontSize: 11 }}>
          &copy; {new Date().getFullYear()} Komenoichi
        </div>
      </div>
    </footer>
  );
}