/** 木材カット図の幾何モデル。ブラウザとNode.jsの両方で使用する。 */
(function attachWoodCutModel(globalObject){
  'use strict';

  const roundMm=value=>Math.round(Number(value)*10)/10;

  function uid(prefix='id'){
    if(globalObject.crypto?.randomUUID)return `${prefix}-${globalObject.crypto.randomUUID()}`;
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,10)}`;
  }

  function clone(value){
    return JSON.parse(JSON.stringify(value));
  }

  function createLeaf(){
    return {type:'leaf',id:uid('piece')};
  }

  function createSheet(material={}){
    const width=Number(material.width)||910;
    const height=Number(material.height)||1820;
    return {
      id:uid('sheet'),
      label:material.label||material.name||'材料',
      materialId:material.id||'',
      materialName:material.name||'手入力材料',
      jan:material.jan||'',
      width:roundMm(width),
      height:roundMm(height),
      thickness:material.thickness===''||material.thickness==null?'':roundMm(material.thickness),
      root:createLeaf()
    };
  }

  function findNode(node,predicate,parent=null,branch=null){
    if(predicate(node))return {node,parent,branch};
    if(node.type==='cut'){
      return findNode(node.low,predicate,node,'low')||findNode(node.high,predicate,node,'high');
    }
    return null;
  }

  function replaceNode(root,nodeId,replacement){
    if(root.id===nodeId)return replacement;
    const found=findNode(root,node=>node.id===nodeId);
    if(!found||!found.parent)return root;
    found.parent[found.branch]=replacement;
    return root;
  }

  function getSplitSizes(node,width,height){
    const kerf=Number(node.kerf)||0;
    const offset=Number(node.offset)||0;
    if(node.axis==='x'){
      if(node.from==='left')return {lowWidth:offset,highWidth:width-offset-kerf,lowHeight:height,highHeight:height};
      return {lowWidth:width-offset-kerf,highWidth:offset,lowHeight:height,highHeight:height};
    }
    if(node.from==='top')return {lowWidth:width,highWidth:width,lowHeight:offset,highHeight:height-offset-kerf};
    return {lowWidth:width,highWidth:width,lowHeight:height-offset-kerf,highHeight:offset};
  }

  function validateTree(root,width,height,minPiece=10){
    const errors=[];
    let leafCount=0;
    let cutCount=0;
    const minimum=Math.max(0,Number(minPiece)||0);

    function visit(node,w,h){
      if(!Number.isFinite(w)||!Number.isFinite(h)||w<=0||h<=0){
        errors.push('寸法が0以下になる領域があります。');
        return;
      }
      if(node.type==='leaf'){
        leafCount+=1;
        if(w<minimum||h<minimum)errors.push(`最小寸法 ${minimum} mm 未満の部材ができます。`);
        return;
      }
      cutCount+=1;
      const kerf=Number(node.kerf);
      const offset=Number(node.offset);
      if(!Number.isFinite(kerf)||kerf<0)errors.push('刃厚が不正です。');
      if(!Number.isFinite(offset)||offset<=0)errors.push('カット寸法は0より大きくしてください。');
      const s=getSplitSizes(node,w,h);
      visit(node.low,s.lowWidth,s.lowHeight);
      visit(node.high,s.highWidth,s.highHeight);
    }

    visit(root,Number(width),Number(height));
    return {ok:errors.length===0,error:errors[0]||'',errors:[...new Set(errors)],leafCount,cutCount};
  }

  function applyCut(root,leafId,options){
    const found=findNode(root,node=>node.id===leafId&&node.type==='leaf');
    if(!found)return {ok:false,error:'選択した領域が見つかりません。',root};
    const from=options.from;
    const axis=(from==='left'||from==='right')?'x':'y';
    const cutNode={
      type:'cut',
      id:uid('node'),
      cutId:uid('cut'),
      order:Number(options.order)||1,
      axis,
      from,
      offset:roundMm(options.offset),
      kerf:roundMm(options.kerf||0),
      low:createLeaf(),
      high:createLeaf()
    };
    const next=clone(root);
    const replaced=replaceNode(next,leafId,cutNode);
    return {ok:true,root:replaced,cutId:cutNode.cutId};
  }

  function updateCut(root,cutId,patch){
    const next=clone(root);
    const found=findNode(next,node=>node.type==='cut'&&node.cutId===cutId);
    if(!found)return {ok:false,error:'カット線が見つかりません。',root};
    if(patch.offset!=null)found.node.offset=roundMm(patch.offset);
    if(patch.kerf!=null)found.node.kerf=roundMm(patch.kerf);
    if(patch.from){
      found.node.from=patch.from;
      found.node.axis=(patch.from==='left'||patch.from==='right')?'x':'y';
    }
    return {ok:true,root:next};
  }

  function removeCut(root,cutId){
    const next=clone(root);
    const found=findNode(next,node=>node.type==='cut'&&node.cutId===cutId);
    if(!found)return {ok:false,error:'カット線が見つかりません。',root};
    const leaf=createLeaf();
    if(!found.parent)return {ok:true,root:leaf};
    found.parent[found.branch]=leaf;
    return {ok:true,root:next};
  }

  function layoutTree(root,width,height){
    const leaves=[];
    const cuts=[];
    function visit(node,x,y,w,h){
      if(node.type==='leaf'){
        leaves.push({nodeId:node.id,x,y,width:w,height:h});
        return;
      }
      const s=getSplitSizes(node,w,h);
      if(node.axis==='x'){
        const cutX=x+s.lowWidth;
        cuts.push({
          nodeId:node.id,cutId:node.cutId,order:node.order,axis:'x',from:node.from,offset:node.offset,kerf:node.kerf,
          x:cutX,y,width:node.kerf,height:h,parentX:x,parentY:y,parentWidth:w,parentHeight:h
        });
        visit(node.low,x,y,s.lowWidth,h);
        visit(node.high,cutX+node.kerf,y,s.highWidth,h);
      }else{
        const cutY=y+s.lowHeight;
        cuts.push({
          nodeId:node.id,cutId:node.cutId,order:node.order,axis:'y',from:node.from,offset:node.offset,kerf:node.kerf,
          x,y:cutY,width:w,height:node.kerf,parentX:x,parentY:y,parentWidth:w,parentHeight:h
        });
        visit(node.low,x,y,w,s.lowHeight);
        visit(node.high,x,cutY+node.kerf,w,s.highHeight);
      }
    }
    visit(root,0,0,Number(width),Number(height));
    leaves.sort((a,b)=>a.y-b.y||a.x-b.x);
    leaves.forEach((leaf,index)=>{leaf.label=pieceLabel(index);});
    cuts.sort((a,b)=>a.order-b.order);
    return {leaves,cuts};
  }

  function pieceLabel(index){
    let n=index+1;
    let label='';
    while(n>0){
      n-=1;
      label=String.fromCharCode(65+(n%26))+label;
      n=Math.floor(n/26);
    }
    return label;
  }

  function collectInstructions(root,width,height){
    const layout=layoutTree(root,width,height);
    return layout.cuts.map(cut=>({
      cutId:cut.cutId,
      order:cut.order,
      from:cut.from,
      axis:cut.axis,
      offset:cut.offset,
      kerf:cut.kerf,
      targetWidth:cut.parentWidth,
      targetHeight:cut.parentHeight,
      text:instructionText(cut)
    }));
  }

  function instructionText(cut){
    const edge={left:'左',right:'右',top:'上',bottom:'下'}[cut.from]||cut.from;
    const direction=cut.axis==='x'?'縦切り':'横切り';
    return `${edge}から ${formatMm(cut.offset)} mm（${direction}・対象 ${formatMm(cut.parentWidth)} × ${formatMm(cut.parentHeight)} mm）`;
  }

  function formatMm(value){
    const n=roundMm(value);
    return Number.isInteger(n)?String(n):n.toFixed(1);
  }

  function maxOrder(root){
    let max=0;
    (function visit(node){
      if(node.type!=='cut')return;
      max=Math.max(max,Number(node.order)||0);
      visit(node.low);visit(node.high);
    })(root);
    return max;
  }

  const api={
    uid,clone,createLeaf,createSheet,findNode,replaceNode,getSplitSizes,validateTree,
    applyCut,updateCut,removeCut,layoutTree,collectInstructions,instructionText,formatMm,maxOrder
  };
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  globalObject.WoodCutModel=api;
})(typeof window!=='undefined'?window:globalThis);
