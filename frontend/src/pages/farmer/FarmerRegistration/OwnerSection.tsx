import { useEffect, useMemo, useRef, useState } from "react";

type Props = {
  lastName: string;
  setLastName: (v: string) => void;

  firstName: string;
  setFirstName: (v: string) => void;

  lastKana: string;
  setLastKana: (v: string) => void;

  firstKana: string;
  setFirstKana: (v: string) => void;

  phone: string;
  setPhone: (v: string) => void;

  pref: string;
  setPref: (v: string) => void;

  city: string;
  setCity: (v: string) => void;

  ownerPostal: string;
  setOwnerPostal: (v: string) => void;

  addr1: string;
  setAddr1: (v: string) => void;

  // 郵便番号が「存在しているかどうか」のフラグ（親管理）
  postalValid: boolean | null;
  setPostalValid: (v: boolean | null) => void;
};

export default function OwnerSection(props: Props) {
  const {
    lastName,
    setLastName,
    firstName,
    setFirstName,
    lastKana,
    setLastKana,
    firstKana,
    setFirstKana,
    phone,
    setPhone,
    pref,
    setPref,
    city,
    setCity,
    ownerPostal,
    setOwnerPostal,
    addr1,
    setAddr1,
    // postalValid はここでは表示に使わないので名前だけ受け取る
    postalValid: _postalValid,
    setPostalValid,
  } = props;

  const [busy, setBusy] = useState(false);
  const [postalMsg, setPostalMsg] = useState("");
  const [phoneMsg, setPhoneMsg] = useState("");

  const digits = useMemo(
    () => (ownerPostal || "").replace(/[^\d]/g, ""),
    [ownerPostal]
  );

  const abortRef = useRef<AbortController | null>(null);

  async function fetchZip(zip7: string) {
    if (!zip7 || zip7.length !== 7) {
      setPostalValid(null);
      setPostalMsg("郵便番号は7桁で入力してください");
      return;
    }
    if (abortRef.current) abortRef.current.abort();

    const ac = new AbortController();
    abortRef.current = ac;

    setBusy(true);
    setPostalMsg("");

    try {
      const res = await fetch(
        `https://zipcloud.ibsnet.co.jp/api/search?zipcode=${zip7}`,
        { signal: ac.signal }
      );
      const data = await res.json();
      if (data.status !== 200) {
        setPostalValid(false);
        setPostalMsg(String(data.message || "検索に失敗しました"));
        return;
      }
      const r = Array.isArray(data.results) ? data.results[0] : null;
      if (!r) {
        setPostalValid(false);
        setPostalMsg("該当する住所が見つかりませんでした");
        return;
      }

      setPref(r.address1 || "");
      setCity(r.address2 || "");
      setAddr1(r.address3 || "");
      setPostalValid(true);
      setPostalMsg("郵便番号から住所を自動入力しました");
    } catch (e: any) {
      if (e?.name !== "AbortError") {
        setPostalValid(false);
        setPostalMsg("郵便番号検索エラー: " + (e?.message || String(e)));
      }
    } finally {
      setBusy(false);
    }
  }

  // 郵便番号7桁そろったら自動で住所取得
  useEffect(() => {
    if (!digits) {
      setPostalValid(null);
      return;
    }
    const t = setTimeout(() => {
      if (digits.length === 7) {
        fetchZip(digits);
      } else {
        setPostalValid(null);
      }
    }, 350);
    return () => clearTimeout(t);
  }, [digits]);

  // 共通 input スタイル
  const inputClass =
    "border rounded w-full px-3 py-2 h-12 text-[17px] leading-tight";

  const postalInputClass = `${inputClass} max-w-[10ch]`; // 7桁＋少し余白
  const phoneInputClass = `${inputClass} max-w-[13ch]`; // 11桁＋少し余白

  // ラベル共通スタイル：かなり小さめ＋薄いグレー
  const labelClass = "block text-[11px] text-gray-500 font-normal";

  // 行間用 margin（px）
  const BLOCK_MB = 10;

  // 携帯番号のバリデーション（070/080/090/060 から始まる11桁かどうか）
  const validatePhone = (digits: string) => {
    if (digits.length === 11) {
      if (/^(070|080|090|060)\d{8}$/.test(digits)) {
        setPhoneMsg("");
      } else {
        setPhoneMsg("無効な携帯電話番号です");
      }
    } else {
      setPhoneMsg("");
    }
  };

  return (
    // ★ 線を消すため border-t を外す
    <section className="pt-4">
      {/* 左右スペースをインラインで強制（約14px） */}
      <div
        style={{
          paddingLeft: 14,
          paddingRight: 14,
        }}
      >
        {/* 「農家の基本情報」を少し控えめ */}
        <h3
          className="text-xs font-medium text-gray-700"
          style={{ marginBottom: BLOCK_MB }}
        >
          農家の基本情報
        </h3>

        {/* 姓・名 */}
        <div
          className="grid grid-cols-2 gap-4"
          style={{ marginBottom: BLOCK_MB }}
        >
          <div>
            <label className={labelClass}>姓</label>
            <input
              className={inputClass}
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="山田"
              required
            />
          </div>

          <div>
            <label className={labelClass}>名</label>
            <input
              className={inputClass}
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="太郎"
              required
            />
          </div>
        </div>

        {/* せい・めい（ふりがな） */}
        <div
          className="grid grid-cols-2 gap-4"
          style={{ marginBottom: BLOCK_MB }}
        >
          <div>
            <label className={labelClass}>
              せい（ふりがな・ひらがな）
            </label>
            <input
              className={inputClass}
              value={lastKana}
              onChange={(e) => setLastKana(e.target.value)}
              placeholder="やまだ"
              required
            />
          </div>

          <div>
            <label className={labelClass}>
              めい（ふりがな・ひらがな）
            </label>
            <input
              className={inputClass}
              value={firstKana}
              onChange={(e) => setFirstKana(e.target.value)}
              placeholder="たろう"
              required
            />
          </div>
        </div>

        {/* 郵便番号（右側にステータス表示） */}
        <div style={{ marginBottom: BLOCK_MB }}>
          <label className={labelClass}>
            郵便番号（必須・半角数字7桁・ハイフンなし）
          </label>
          <div className="flex items-center">
            <input
              className={postalInputClass}
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="7780001"
              value={ownerPostal}
              onChange={(e) => {
                const onlyDigits = e.target.value
                  .replace(/[^\d]/g, "")
                  .slice(0, 7);
                setOwnerPostal(onlyDigits);
              }}
              required
            />
            {postalMsg && (
              <span
                className="text-[11px] text-gray-500"
                style={{ marginLeft: 8 }}
              >
                {busy ? "住所を取得中…" : postalMsg}
              </span>
            )}
          </div>
        </div>

        {/* 都道府県・市区町村 */}
        <div
          className="grid grid-cols-2 gap-4"
          style={{ marginBottom: BLOCK_MB }}
        >
          <div>
            <label className={labelClass}>都道府県</label>
            <select
              className={inputClass}
              value={pref}
              onChange={(e) => setPref(e.target.value)}
              required
            >
              <option value="">選択してください</option>
              <option value="北海道">北海道</option>
              <option value="青森県">青森県</option>
              <option value="岩手県">岩手県</option>
              <option value="宮城県">宮城県</option>
              <option value="秋田県">秋田県</option>
              <option value="山形県">山形県</option>
              <option value="福島県">福島県</option>
              <option value="茨城県">茨城県</option>
              <option value="栃木県">栃木県</option>
              <option value="群馬県">群馬県</option>
              <option value="埼玉県">埼玉県</option>
              <option value="千葉県">千葉県</option>
              <option value="東京都">東京都</option>
              <option value="神奈川県">神奈川県</option>
              <option value="新潟県">新潟県</option>
              <option value="富山県">富山県</option>
              <option value="石川県">石川県</option>
              <option value="福井県">福井県</option>
              <option value="山梨県">山梨県</option>
              <option value="長野県">長野県</option>
              <option value="岐阜県">岐阜県</option>
              <option value="静岡県">静岡県</option>
              <option value="愛知県">愛知県</option>
              <option value="三重県">三重県</option>
              <option value="滋賀県">滋賀県</option>
              <option value="京都府">京都府</option>
              <option value="大阪府">大阪府</option>
              <option value="兵庫県">兵庫県</option>
              <option value="奈良県">奈良県</option>
              <option value="和歌山県">和歌山県</option>
              <option value="鳥取県">鳥取県</option>
              <option value="島根県">島根県</option>
              <option value="岡山県">岡山県</option>
              <option value="広島県">広島県</option>
              <option value="山口県">山口県</option>
              <option value="徳島県">徳島県</option>
              <option value="香川県">香川県</option>
              <option value="愛媛県">愛媛県</option>
              <option value="高知県">高知県</option>
              <option value="福岡県">福岡県</option>
              <option value="佐賀県">佐賀県</option>
              <option value="長崎県">長崎県</option>
              <option value="熊本県">熊本県</option>
              <option value="大分県">大分県</option>
              <option value="宮崎県">宮崎県</option>
              <option value="鹿児島県">鹿児島県</option>
              <option value="沖縄県">沖縄県</option>
            </select>
          </div>

          <div>
            <label className={labelClass}>市区町村</label>
            <input
              className={inputClass}
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="三好市池田町"
              required
            />
          </div>
        </div>

        {/* 番地・建物名 */}
        <div style={{ marginBottom: BLOCK_MB }}>
          <label className={labelClass}>番地・建物名（必須）</label>
          <input
            className={inputClass}
            value={addr1}
            onChange={(e) => setAddr1(e.target.value)}
            placeholder="西山123"
            required
          />
        </div>

        {/* 携帯電話番号 */}
        <div style={{ marginBottom: 6 }}>
          <label className={labelClass}>
            携帯電話番号（必須・半角数字11桁・ハイフンなし）
          </label>
          <div className="flex flex-col">
            <input
              className={phoneInputClass}
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="09012345678"
              value={phone}
              onChange={(e) => {
                const onlyDigits = e.target.value
                  .replace(/[^\d]/g, "")
                  .slice(0, 11);
                setPhone(onlyDigits);
                validatePhone(onlyDigits);
              }}
              required
            />
            {phoneMsg && (
              <span className="text-[11px] text-red-500 mt-1">
                {phoneMsg}
              </span>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
