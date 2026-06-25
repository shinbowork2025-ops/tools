/**
 * JAN（EAN-13）バーコードの検証とSVG描画。
 * 検索ツール間で同じ実装を共有し、修正箇所を一か所に限定する。
 */
/* 軽量EAN-13バーコード生成。外部ライブラリ・画像ファイルは使用しない。 */
const EAN13_PATTERNS={
  L:['0001101','0011001','0010011','0111101','0100011','0110001','0101111','0111011','0110111','0001011'],
  G:['0100111','0110011','0011011','0100001','0011101','0111001','0000101','0010001','0001001','0010111'],
  R:['1110010','1100110','1101100','1000010','1011100','1001110','1010000','1000100','1001000','1110100']
};
const EAN13_PARITY=['LLLLLL','LLGLGG','LLGGLG','LLGGGL','LGLLGG','LGGLLG','LGGGLL','LGLGLG','LGLGGL','LGGLGL'];
function isValidJan13(value){
  const s=String(value||'');
  if(!/^\d{13}$/.test(s))return false;
  let sum=0;
  for(let i=0;i<12;i++)sum+=Number(s[i])*(i%2===0?1:3);
  return (10-sum%10)%10===Number(s[12]);
}
function ean13Bits(code){
  const parity=EAN13_PARITY[Number(code[0])];
  let bits='101';
  for(let i=1;i<=6;i++)bits+=EAN13_PATTERNS[parity[i-1]][Number(code[i])];
  bits+='01010';
  for(let i=7;i<=12;i++)bits+=EAN13_PATTERNS.R[Number(code[i])];
  return bits+'101';
}
function ean13BarcodeSvg(code){
  if(!isValidJan13(code))return '<div class="jan-barcode-note">有効な13桁のJANコードではないため、バーコードを生成できません。</div>';
  const bits=ean13Bits(code), quiet=11, barTop=4, barHeight=42;
  let path='';
  for(let i=0;i<bits.length;){
    if(bits[i]==='0'){i++;continue;}
    const start=i;
    while(i<bits.length&&bits[i]==='1')i++;
    path+=`M${quiet+start} ${barTop}h${i-start}v${barHeight}h-${i-start}z`;
  }
  const guards=[0,2,46,48,92,94].map(i=>`M${quiet+i} ${barTop+barHeight}h1v6h-1z`).join('');
  const first=code[0], left=code.slice(1,7), right=code.slice(7);
  return `<svg class="jan-barcode-svg" viewBox="0 0 117 70" role="img" aria-label="JANコード ${code} のバーコード" xmlns="http://www.w3.org/2000/svg"><rect width="117" height="70" fill="white"/><path d="${path}${guards}" fill="currentColor"/><g fill="currentColor" font-family="Arial,Helvetica,sans-serif" font-size="9"><text x="3.5" y="64" text-anchor="middle">${first}</text><text x="14.5" y="64" textLength="42" lengthAdjust="spacingAndGlyphs">${left}</text><text x="61.5" y="64" textLength="42" lengthAdjust="spacingAndGlyphs">${right}</text></g></svg><div class="jan-barcode-note">画面表示用です。読み取り時は画面の明るさと表示倍率を調整してください。</div>`;
}
function janBarcodeToggleHtml(jan){
  const code=String(jan||'').trim();
  if(!isValidJan13(code))return '';
  return `<details class="jan-barcode" data-jan="${code}"><summary onclick="renderJanBarcode(this.parentElement)">バーコードを表示</summary><div class="jan-barcode-box" aria-live="polite"></div></details>`;
}
function renderJanBarcode(details){
  const box=details&&details.querySelector('.jan-barcode-box');
  if(!box||box.dataset.rendered)return;
  box.innerHTML=ean13BarcodeSvg(details.dataset.jan||'');
  box.dataset.rendered='1';
}

/**
 * 3つの検索ツールに一覧へ戻るリンクを共通追加する。
 * 個別HTMLに同じ記述を重複させず、既にリンクがある場合は何もしない。
 */
function ensureToolListLink(){
  if(document.querySelector('a[href="../../index.html"]'))return;
  const heading=document.querySelector('h1');
  if(!heading)return;
  const link=document.createElement('a');
  link.href='../../index.html';
  link.textContent='← ツール一覧へ戻る';
  link.setAttribute('aria-label','ツール一覧へ戻る');
  Object.assign(link.style,{
    display:'inline-flex',alignItems:'center',minHeight:'36px',marginBottom:'8px',
    padding:'6px 10px',border:'1px solid #c8d3df',borderRadius:'8px',background:'#fff',
    color:'#194f88',textDecoration:'none',fontSize:'.78rem',fontWeight:'700'
  });
  heading.before(link);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',ensureToolListLink,{once:true});
else ensureToolListLink();
