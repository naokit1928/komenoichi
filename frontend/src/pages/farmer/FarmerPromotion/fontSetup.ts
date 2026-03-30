import { Font } from "@react-pdf/renderer";
import NotoRegularUrl from "@fontsource/noto-sans-jp/files/noto-sans-jp-japanese-400-normal.woff?url";
import NotoBoldUrl from "@fontsource/noto-sans-jp/files/noto-sans-jp-japanese-700-normal.woff?url";
import NotoBlackUrl from "@fontsource/noto-sans-jp/files/noto-sans-jp-japanese-900-normal.woff?url";

let registered = false;

export function registerNotoSansJP() {
  if (registered) return;
  registered = true;
  Font.register({
    family: "NotoSansJP",
    fonts: [
      { src: NotoRegularUrl, fontWeight: 400 },
      { src: NotoBoldUrl,    fontWeight: 700 },
      { src: NotoBlackUrl,   fontWeight: 900 },
    ],
  });
  Font.registerHyphenationCallback((word) => [word]);
}
