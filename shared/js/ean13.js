/** JAN（EAN-13）バーコードの検証・遅延生成・コピーを共通管理する。 */
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
  if(!isValidJan13(code))return '';
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
  return `<svg class="jan-barcode-svg" viewBox="0 0 117 70" role="img" aria-label="JANコード ${code} のバーコード" xmlns="http://www.w3.org/2000/svg"><rect width="117" height="70" fill="white"/><path d="${path}${guards}" fill="currentColor"/><g fill="currentColor" font-family="Arial,Helvetica,sans-serif" font-size="9"><text x="3.5" y="64" text-anchor="middle">${first}</text><text x="14.5" y="64" textLength="42" lengthAdjust="spacingAndGlyphs">${left}</text><text x="61.5" y="64" textLength="42" lengthAdjust="spacingAndGlyphs">${right}</text></g></svg>`;
}

const JAN_BARCODE_SVG_CACHE=new Map();
let janBarcodeObserver=null;
let janBarcodeMutationObserver=null;

function cachedJanBarcodeSvg(jan){
  if(!JAN_BARCODE_SVG_CACHE.has(jan))JAN_BARCODE_SVG_CACHE.set(jan,ean13BarcodeSvg(jan));
  return JAN_BARCODE_SVG_CACHE.get(jan);
}

function janBarcodeToggleHtml(jan){
  const code=String(jan||'').trim();
  if(!isValidJan13(code))return '';
  return `<div class="jan-barcode" data-jan="${code}"><div class="jan-barcode-box" role="button" tabindex="0" aria-label="JAN ${code}。タップすると番号をコピーします"></div></div>`;
}

function renderLazyJanBarcode(element){
  if(!element||element.dataset.rendered==='1')return;
  const jan=String(element.dataset.jan||'').trim();
  const box=element.querySelector('.jan-barcode-box');
  if(!box||!isValidJan13(jan))return;
  box.innerHTML=cachedJanBarcodeSvg(jan);
  element.dataset.rendered='1';
}

function observeJanBarcodes(root=document){
  const elements=root.querySelectorAll?.('.jan-barcode[data-jan]:not([data-observed])')||[];
  for(const element of elements){
    element.dataset.observed='1';
    if(janBarcodeObserver)janBarcodeObserver.observe(element);
    else renderLazyJanBarcode(element);
  }
}

async function copyJanFromBarcode(element){
  const jan=String(element?.dataset.jan||'').trim();
  if(!jan)return;
  try{
    await navigator.clipboard.writeText(jan);
  }catch{
    const textarea=document.createElement('textarea');
    textarea.value=jan;textarea.style.position='fixed';textarea.style.opacity='0';
    document.body.appendChild(textarea);textarea.select();document.execCommand('copy');textarea.remove();
  }
  let toast=document.getElementById('janBarcodeCopyToast');
  if(!toast){
    toast=document.createElement('div');toast.id='janBarcodeCopyToast';toast.className='jan-copy-toast';document.body.appendChild(toast);
  }
  toast.textContent=`JAN ${jan} をコピーしました`;
  toast.classList.add('show');
  clearTimeout(copyJanFromBarcode.timer);
  copyJanFromBarcode.timer=setTimeout(()=>toast.classList.remove('show'),1600);
}

function installJanBarcodeStyles(){
  if(document.getElementById('janBarcodeStyles'))return;
  const style=document.createElement('style');
  style.id='janBarcodeStyles';
  style.textContent=`
    .jan-code{display:none!important}
    .jan-barcode{width:min(100%,270px);margin-top:6px}
    .jan-barcode-box{display:flex;align-items:center;justify-content:center;width:100%;min-height:162px;padding:6px 8px 4px;border:1px solid #d8dee7;border-radius:6px;background:#fff;cursor:pointer;overflow:hidden}
    .jan-barcode-box:focus-visible{outline:3px solid rgba(37,99,168,.28);outline-offset:2px}
    .jan-barcode-svg{display:block;width:100%;height:auto;color:#111;background:#fff}
    .jan-copy-toast{position:fixed;left:50%;bottom:max(20px,env(safe-area-inset-bottom));z-index:10020;transform:translateX(-50%);padding:9px 14px;border-radius:999px;background:#17202a;color:#fff;font-size:.78rem;opacity:0;pointer-events:none;transition:.18s;white-space:nowrap}
    .jan-copy-toast.show{opacity:1}
  `;
  document.head.appendChild(style);
}

function setupJanBarcodeLazyRendering(){
  installJanBarcodeStyles();
  if('IntersectionObserver'in window){
    janBarcodeObserver=new IntersectionObserver(entries=>{
      for(const entry of entries){
        if(!entry.isIntersecting)continue;
        renderLazyJanBarcode(entry.target);
        janBarcodeObserver.unobserve(entry.target);
      }
    },{rootMargin:'500px 0px'});
  }
  observeJanBarcodes(document);
  janBarcodeMutationObserver=new MutationObserver(records=>{
    for(const record of records){
      for(const node of record.addedNodes){
        if(node.nodeType!==Node.ELEMENT_NODE)continue;
        if(node.matches?.('.jan-barcode[data-jan]'))observeJanBarcodes(node.parentElement||document);
        else observeJanBarcodes(node);
      }
    }
  });
  janBarcodeMutationObserver.observe(document.body,{childList:true,subtree:true});
  document.addEventListener('click',event=>{
    const barcode=event.target.closest?.('.jan-barcode[data-jan]');
    if(barcode)copyJanFromBarcode(barcode);
  });
  document.addEventListener('keydown',event=>{
    if(event.key!=='Enter'&&event.key!==' ')return;
    const box=event.target.closest?.('.jan-barcode-box');
    if(!box)return;
    event.preventDefault();copyJanFromBarcode(box.closest('.jan-barcode'));
  });
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setupJanBarcodeLazyRendering,{once:true});
else setupJanBarcodeLazyRendering();
