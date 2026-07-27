(() => {
  'use strict';

  const GUIDES = Object.freeze({
    'jan-scanner': {
      title: 'JANスキャンメモ',
      steps: [
        '画面下の「カメラでスキャン」を押し、バーコードを枠内へ入れます。',
        '必要に応じてリストを切り替え、商品ごとのメモを入力します。',
        '会計時は表示されたバーコードを提示し、終わったリストだけ消去します。'
      ],
      note: '手入力する場合は8桁または13桁のJANコードを入力してください。読み取り後はカメラが自動で閉じます。'
    },
    'pesticide-search': {
      title: '農薬適用検索',
      steps: [
        '農薬名が分かる場合は上の検索欄、分からない場合は作物から選びます。',
        '作物を選んだ場合は、続けて病害虫・雑草名を選びます。',
        '結果の使用方法・希釈量などを確認し、使用前に製品ラベルも確認します。'
      ],
      note: '初期状態は園芸グループ掲載品のみです。必要な場合だけ「すべての農薬を表示」をオンにしてください。'
    },
    'chainsaw-parts-search': {
      title: 'チェーンソー部品検索',
      steps: [
        '本体メーカーを選びます。',
        '本体型式を入力または候補から選びます。',
        'バー・チェーン仕様を選び、表示された品番と現物仕様を照合します。'
      ],
      note: '同じ型式でもバー長や交換歴で仕様が異なる場合があります。ピッチ・ゲージ・ドライブリンク数を現物で確認してください。'
    },
    'power-tool-blade-search': {
      title: '替刃・互換検索',
      steps: [
        '本体メーカーを選びます。',
        '本体型番を入力または候補から選びます。',
        '表示された替刃型番を、本体と商品の表示で照合します。'
      ],
      note: '型番が似ていても互換性が異なる場合があります。購入前に本体銘板と替刃の適合表示を確認してください。'
    },
    'hose-length': {
      title: 'ホース長さ計算',
      steps: [
        'ホースを巻いた状態の全重量を入力します。',
        '空ドラム重量と、ホース1 m当たりの重量を入力します。',
        '表示された推定長を確認し、必要なら実測で補正します。'
      ],
      note: '泥や水分が付着していると結果がずれます。重量は同じ条件で測定してください。'
    },
    'markup-calculator': {
      title: '値入率計算',
      steps: [
        '仕入値の入力欄をタップし、テンキーで金額を入力します。',
        '値入率の入力欄をタップし、百分率を入力します。',
        '計算された販売価格を確認します。結果は1円単位で切り上げます。'
      ],
      note: '仕入値・値入率とも小数点以下2桁まで入力できます。値入率は100%未満で入力してください。'
    },
    'wood-cut-planner': {
      title: '木材カット図',
      steps: [
        '「材料を追加」から登録材料を選ぶか、JANを読み取ります。',
        '図面で切りたい領域をタップします。',
        '基準辺・残す寸法・刃厚を入力し、「カットを追加」を押します。'
      ],
      note: '試作版です。加工前に材料寸法、刃厚、カット順を現物と設備の条件で確認してください。'
    },
    'qualification-study': {
      title: '社内資格トレーニング',
      steps: [
        'Anki用CSVを選び、推定された資格名を確認して登録します。',
        '登録した資格を選び、「学習を始める」を押して問題へ回答します。',
        '解答後に「もう一度・難しい・普通・簡単」から感覚に近い評価を選びます。'
      ],
      note: '問題と学習履歴はこの端末内だけに保存されます。ブラウザのデータを消去する前に、元のCSVを保管してください。'
    }
  });

  const match = location.pathname.match(/\/tools\/([^/]+)\/?(?:index\.html)?$/);
  const toolId = match?.[1];
  const guide = toolId ? GUIDES[toolId] : null;
  if (!guide || document.querySelector('[data-quick-guide]')) return;

  document.body.dataset.toolGuide = toolId;

  const section = document.createElement('section');
  section.className = 'quick-guide';
  section.id = 'toolQuickGuide';
  section.dataset.quickGuide = toolId;
  section.setAttribute('aria-label', `${guide.title}の使い方`);

  const heading = document.createElement('div');
  heading.className = 'quick-guide-heading';
  const headingText = document.createElement('strong');
  headingText.textContent = '使い方';
  const headingHint = document.createElement('span');
  headingHint.textContent = '左から順に操作';
  heading.append(headingText, headingHint);

  const list = document.createElement('ol');
  list.className = 'quick-guide-steps';
  guide.steps.forEach((text, index) => {
    const item = document.createElement('li');
    const number = document.createElement('span');
    number.className = 'quick-guide-number';
    number.textContent = String(index + 1);
    const description = document.createElement('span');
    description.textContent = text;
    item.append(number, description);
    list.append(item);
  });

  const details = document.createElement('details');
  details.className = 'quick-guide-note';
  const summary = document.createElement('summary');
  summary.textContent = '注意事項を確認';
  const note = document.createElement('p');
  note.textContent = guide.note;
  details.append(summary, note);

  section.append(heading, list, details);

  const header = document.querySelector('header');
  const guideLink = document.createElement('a');
  guideLink.className = 'quick-guide-link';
  guideLink.href = `#${section.id}`;
  guideLink.textContent = '使い方はこちら';
  guideLink.setAttribute('aria-label', `${guide.title}の使い方へ移動`);

  let navigation = header?.querySelector('.tool-nav, .tool-top-actions');
  if (!navigation) {
    const backLink = header?.querySelector('a[href^="../../"]');
    if (backLink) {
      navigation = document.createElement('nav');
      navigation.setAttribute('aria-label', 'ページ移動');
      backLink.before(navigation);
      navigation.append(backLink);
    }
  }

  if (navigation) {
    navigation.classList.add('quick-guide-nav-host');
    navigation.append(guideLink);
  } else {
    header?.append(guideLink);
  }

  const contentRoot = toolId === 'hose-length'
    ? document.body
    : document.querySelector('main:not(.workspace)')
      || document.querySelector('.app-shell, .app')
      || document.body;
  contentRoot.append(section);
})();
