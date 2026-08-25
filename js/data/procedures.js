// 災害別・段階別の行動手順データ(静的データのみ。ロジック・DOM禁止)。
// 内閣府・消防庁・気象庁が一般に案内している防災行動の範囲で、命令形の短文にまとめている。
// このアプリの手順は公的な指示の代替ではなく、事前の備忘録として使う前提。

export const PROCEDURES = [
  // ---------- earthquake(地震) ----------
  { id: "eq-prep-furniture", hazard: "earthquake", phase: "prepare", title: "寝室・寝床の家具を固定し倒れない配置にする", body: "タンスや棚はL字金具や突っ張り棒で固定し、寝ている場所に倒れてこない配置にします。ガラスには飛散防止フィルムを貼りましょう。", keywords: ["家具固定", "転倒防止", "寝室"] },
  { id: "eq-prep-stock", hazard: "earthquake", phase: "prepare", title: "備蓄と持ち出し袋を定期的に点検する", body: "水・食料・懐中電灯・電池などの使用期限と動作を確認し、家族構成や季節の変化に合わせて中身を入れ替えます。", keywords: ["備蓄", "持ち出し袋", "点検"] },
  { id: "eq-alert-warning", hazard: "earthquake", phase: "alert", title: "緊急地震速報が鳴ったらすぐ身を守る姿勢を取る", body: "速報から強い揺れが来るまでの時間はごくわずかです。音が鳴ったら低い姿勢になり、頭を守れる場所へすぐ移動します。", keywords: ["緊急地震速報", "身を守る"] },
  { id: "eq-now-cover", hazard: "earthquake", phase: "now", title: "頭を守り、揺れが収まるまでその場で待つ", body: "机の下などに入り頭と首を守ります。無理に動くと倒れてくる物でけがをする危険があります。", keywords: ["頭を守る", "机の下", "揺れ"] },
  { id: "eq-now-nodash", hazard: "earthquake", phase: "now", title: "揺れている最中はあわてて外へ飛び出さない", body: "外壁やガラス、看板の落下で大けがをする危険があります。屋内の安全な場所で揺れが収まるのを待ちます。", keywords: ["外に出ない", "落下物"] },
  { id: "eq-now-fire", hazard: "earthquake", phase: "now", title: "揺れの最中は火を消しに行かず身の安全を優先する", body: "コンロへ無理に近づくとやけどや転倒の危険があります。多くのガス機器は大きな揺れを感知すると自動的に止まります。", keywords: ["火の始末", "コンロ", "安全優先"] },
  { id: "eq-now-coast", hazard: "earthquake", phase: "now", title: "海の近くにいたら津波を警戒してすぐ高い場所へ", body: "強い揺れや長くゆっくりした揺れを感じたら、警報を待たずに高台や津波避難ビルへ移動します。", keywords: ["津波", "高台", "海岸"] },
  { id: "eq-after-exit", hazard: "earthquake", phase: "after", title: "揺れが収まったら火元を確かめ逃げ道を確保する", body: "コンロやストーブの火を消し、ドアや窓を開けて避難経路を確保します。ガス臭がしたら元栓を閉めて窓を開け換気します。火気は使わず、電気のスイッチにも触れないでください。", keywords: ["火元確認", "出口確保", "ガス"] },
  { id: "eq-after-shoes", hazard: "earthquake", phase: "after", title: "室内は厚底の靴を履いてガラス片から足を守る", body: "割れた食器やガラスが床に散らばっています。スリッパではなく靴を履いてから移動しましょう。", keywords: ["靴", "ガラス片", "けが防止"] },
  { id: "eq-after-shock", hazard: "earthquake", phase: "after", title: "同程度の余震が続く前提で警戒を続ける", body: "大きな地震のあとは同規模の揺れが繰り返し起こることがあります。傾いた建物や家具には近づかないでください。", keywords: ["余震", "警戒"] },
  { id: "eq-after-breaker", hazard: "earthquake", phase: "after", title: "避難するときはブレーカーを落としてから離れる", body: "破損した配線や電気製品に電気が戻ると通電火災の原因になります。家を離れるときは必ずブレーカーを切ってください。", keywords: ["通電火災", "ブレーカー", "避難"] },
  { id: "eq-recover-breaker", hazard: "earthquake", phase: "recover", title: "電気を再び通す前に配線や家電を点検する", body: "焦げ跡やコードの損傷がないか確認してからブレーカーを上げます。不安があれば電気工事業者に相談してください。", keywords: ["通電火災", "点検", "復電"] },
  { id: "eq-recover-photo", hazard: "earthquake", phase: "recover", title: "片付ける前に被害箇所を写真で記録する", body: "罹災証明書の申請には被害状況の写真が必要です。建物全体・被害箇所・品目の順に撮影してから片付けます。", keywords: ["罹災証明", "写真記録"] },

  // ---------- tsunami(津波)※承認済みの完全実例、そのまま採用 ----------
  { id: "ts-prep-route", hazard: "tsunami", phase: "prepare", title: "高台への避難経路を家族で歩いて確認する", body: "自宅・職場・学校から最寄りの高台や津波避難ビルまで、実際に歩いて時間を測っておきます。夜間の経路も確認しましょう。", keywords: ["高台", "経路", "避難ビル"] },
  { id: "ts-prep-map", hazard: "tsunami", phase: "prepare", title: "ハザードマップで浸水想定を確認する", body: "自治体のハザードマップで自宅の浸水想定と避難先を確認し、家族カードの集合場所に反映しておきます。", keywords: ["ハザードマップ", "浸水"] },
  { id: "ts-alert-info", hazard: "tsunami", phase: "alert", title: "津波警報・注意報をすぐ確認する", body: "強い揺れや長い揺れを感じたら、テレビ・ラジオ・防災無線で津波情報を確認します。揺れが小さくても油断しないでください。", keywords: ["警報", "揺れ"] },
  { id: "ts-now-run", hazard: "tsunami", phase: "now", title: "ためらわず、より高い場所へすぐ避難する", body: "津波警報が出たら、荷物より避難を優先し、高台や津波避難ビルへ移動します。「遠く」より「高く」が原則です。", keywords: ["高台", "すぐ", "避難"] },
  { id: "ts-now-nocar", hazard: "tsunami", phase: "now", title: "原則、車を使わず徒歩で避難する", body: "渋滞に巻き込まれると逃げ遅れます。原則徒歩で、海や川から離れる方向へ避難してください。", keywords: ["車", "徒歩", "渋滞"] },
  { id: "ts-now-river", hazard: "tsunami", phase: "now", title: "川沿いから離れる", body: "津波は川をさかのぼります。海だけでなく川からも直角に離れる方向へ避難してください。", keywords: ["川", "遡上"] },
  { id: "ts-after-stay", hazard: "tsunami", phase: "after", title: "警報解除まで絶対に戻らない", body: "津波は繰り返し襲来し、第2波以降が高いこともあります。警報・注意報が解除されるまで高い場所にとどまります。", keywords: ["第2波", "戻らない"] },
  { id: "ts-after-family", hazard: "tsunami", phase: "after", title: "家族の安否を伝言サービスで確認する", body: "直接会えないときは171(災害用伝言ダイヤル)やSNSで安否を残します。集合場所は家族カードで確認できます。", keywords: ["安否", "171"] },
  { id: "ts-recover-check", hazard: "tsunami", phase: "recover", title: "建物の安全を確認してから片付ける", body: "浸水した家屋は感電や衛生面の危険があります。ブレーカーを切り、写真で被害を記録してから片付けを始めます。", keywords: ["浸水", "記録", "ブレーカー"] },

  // ---------- typhoon(台風) ----------
  { id: "ty-prep-window", hazard: "typhoon", phase: "prepare", title: "窓に飛散防止フィルムを貼り雨戸を閉める準備をする", body: "強風で窓ガラスが割れると危険です。飛散防止フィルムや養生テープ、雨戸・シャッターで補強しておきます。", keywords: ["窓", "飛散防止", "雨戸"] },
  { id: "ty-prep-outdoor", hazard: "typhoon", phase: "prepare", title: "ベランダや庭の物を台風前に屋内へしまう", body: "物干し竿や植木鉢は強風で飛ばされ凶器になります。台風が来る前に屋内や物置に移しておきます。", keywords: ["飛散物", "ベランダ", "片付け"] },
  { id: "ty-alert-power", hazard: "typhoon", phase: "alert", title: "停電・断水に備えて水と電源を確保しておく", body: "台風接近前にスマホの充電を満たし、水や食料、モバイルバッテリーを準備しておきます。", keywords: ["停電", "断水", "充電"] },
  { id: "ty-alert-evacuate", hazard: "typhoon", phase: "alert", title: "暴風域に入る前、明るいうちに避難を判断する", body: "夜間や暴風の中の移動は危険です。ハザードマップで自宅の危険度を確認し、早めに避難先を決めます。", keywords: ["早めの避難", "暴風域"] },
  { id: "ty-now-stayin", hazard: "typhoon", phase: "now", title: "暴風のときは不要な外出をせず屋内で過ごす", body: "屋外は看板や瓦、街路樹の落下・倒壊の危険があります。台風が最も近づく間は屋内の安全な場所にとどまります。", keywords: ["外出禁止", "暴風"] },
  { id: "ty-now-window", hazard: "typhoon", phase: "now", title: "強風のときは窓から離れた部屋で過ごす", body: "窓ガラスが割れて破片が飛ぶ危険があります。カーテンを閉め、窓から離れた部屋で過ごしてください。", keywords: ["窓から離れる", "ガラス"] },
  { id: "ty-now-upstairs", hazard: "typhoon", phase: "now", title: "浸水が始まったらためらわず上の階へ移動する", body: "外への避難がかえって危険なときは、自宅や近くの建物の高い階へ移動する垂直避難を選びます。", keywords: ["浸水", "上階", "垂直避難"] },
  { id: "ty-after-hazard", hazard: "typhoon", phase: "after", title: "通過後も倒木・垂れた電線に近づかない", body: "切れた電線は感電の危険があります。倒木や飛来物で見えにくい危険もあるため、周囲を確認しながら移動します。", keywords: ["倒木", "電線", "感電"] },
  { id: "ty-recover-insurance", hazard: "typhoon", phase: "recover", title: "修理前に被害箇所を写真で記録し保険に備える", body: "屋根や外壁の被害は火災保険・共済の対象になることがあります。片付け前に複数の角度から撮影しておきます。", keywords: ["保険", "被害記録", "写真"] },
  { id: "ty-recover-repair", hazard: "typhoon", phase: "recover", title: "壊れた屋根や外壁は自分で直そうとしない", body: "高所作業は転落の危険があります。応急処置はブルーシート程度にとどめ、修理は業者に依頼しましょう。", keywords: ["屋根", "応急処置", "業者"] },

  // ---------- heavyRain(豪雨) ----------
  { id: "rain-prep-level", hazard: "heavyRain", phase: "prepare", title: "警戒レベル1〜5の意味を家族で理解しておく", body: "レベル3で高齢者等は避難、レベル4で全員避難が原則です。レベル5はすでに避難が難しく、その場で命を守る行動をとる段階です。", keywords: ["警戒レベル", "避難情報"] },
  { id: "rain-prep-info", hazard: "heavyRain", phase: "prepare", title: "避難情報を受け取る手段を複数用意しておく", body: "自治体の防災アプリ・防災無線・テレビなど、停電時も使える手段を含めて複数確保しておきます。", keywords: ["避難情報", "入手手段"] },
  { id: "rain-alert-kikukuru", hazard: "heavyRain", phase: "alert", title: "気象庁の危険度分布で自宅周辺の危険を確認する", body: "「キキクル」では土砂災害・浸水・洪水の危険度が地図上で色分け表示されます。こまめに確認しましょう。", keywords: ["危険度分布", "キキクル"] },
  { id: "rain-alert-level4", hazard: "heavyRain", phase: "alert", title: "警戒レベル4が出たら全員が避難を終える", body: "レベル4は避難指示です。周囲が暗くなる前、雨や風が強まる前に避難を完了させてください。", keywords: ["警戒レベル4", "避難指示"] },
  { id: "rain-now-lowland", hazard: "heavyRain", phase: "now", title: "低い土地や半地下・地下から離れる", body: "地下は数分で水没することがあります。低地や地下にいるときは速やかに高い場所へ移動してください。", keywords: ["低地", "地下", "浸水"] },
  { id: "rain-now-noflood", hazard: "heavyRain", phase: "now", title: "冠水した道路には絶対入らない", body: "水面下でマンホールが外れていたり側溝が見えなくなっていることがあります。深さが分からない道は避けます。", keywords: ["冠水", "道路", "側溝"] },
  { id: "rain-now-vertical", hazard: "heavyRain", phase: "now", title: "外が危険なら自宅の高い階にとどまる判断をする", body: "避難所への移動がかえって危険なときは、無理をせず建物の2階以上へ移動する垂直避難を選びます。", keywords: ["垂直避難", "判断"] },
  { id: "rain-now-noriver", hazard: "heavyRain", phase: "now", title: "増水した川や用水路を見に行かない", body: "様子を見に行って流されてしまう事故が毎年起きています。危険を確認する行動そのものが危険です。", keywords: ["川", "用水路", "見に行かない"] },
  { id: "rain-after-ground", hazard: "heavyRain", phase: "after", title: "雨がやんでも地盤が緩んでいることを忘れない", body: "雨がやんだ直後も土砂災害の危険は残ります。斜面や崖の近くでは数日間注意を続けてください。", keywords: ["地盤", "土砂災害", "注意継続"] },

  // ---------- flood(洪水) ----------
  { id: "fl-prep-map", hazard: "flood", phase: "prepare", title: "ハザードマップで浸水想定と避難先を確認する", body: "自治体の洪水ハザードマップで自宅の浸水深と避難所までの経路を確認し、家族で共有しておきます。", keywords: ["ハザードマップ", "浸水想定"] },
  { id: "fl-prep-car", hazard: "flood", phase: "prepare", title: "浸水前に車を高台や立体駐車場へ移動しておく", body: "水没すると修理費が高額になり避難の妨げにもなります。浸水想定区域内の車は早めに高い場所へ移動します。", keywords: ["車", "移動", "浸水前"] },
  { id: "fl-alert-sandbag", hazard: "flood", phase: "alert", title: "浸水のおそれが出たら土のうや止水板を設置する", body: "玄関や低い開口部に土のうを積み水の侵入を防ぎます。ゴミ袋と水で作る簡易土のうでも代用できます。", keywords: ["土のう", "止水", "浸水対策"] },
  { id: "fl-alert-info", hazard: "flood", phase: "alert", title: "川の水位情報をこまめに確認する", body: "国や都道府県の川の防災情報で近くの河川水位を確認し、上昇の兆候があれば早めに避難します。", keywords: ["水位情報", "河川"] },
  { id: "fl-now-vertical", hazard: "flood", phase: "now", title: "水位が上がったらためらわず上の階へ避難する", body: "外への移動が危険なときは無理をせず、自宅や近くの建物の高い階へ移動する垂直避難を選びます。", keywords: ["垂直避難", "上階"] },
  { id: "fl-now-noflow", hazard: "flood", phase: "now", title: "流れのある水の中を歩かない", body: "水深がひざ下でも流れがあれば転倒し流されます。やむを得ず移動するときだけ、長い棒で足元を確かめながら進んでください。", keywords: ["流れる水", "歩行危険"] },
  { id: "fl-now-car", hazard: "flood", phase: "now", title: "冠水した道路や地下道を車で通らない", body: "浅い水深でもエンジンが停止し、車内に閉じ込められる事故が起きています。危険を感じたら迂回し、ドアが開かないときはサイドガラスを脱出用ハンマーやヘッドレストの金具で割って脱出します(フロントガラスは割れません)。", keywords: ["車", "冠水路", "スタック"] },
  { id: "fl-after-electric", hazard: "flood", phase: "after", title: "水に浸かった電気設備には近づかない", body: "感電の危険があるため、浸水した分電盤やコンセント、家電製品には点検が済むまで触れないでください。", keywords: ["電気設備", "感電"] },
  { id: "fl-recover-clean", hazard: "flood", phase: "recover", title: "浸水した室内は消毒してから十分に乾燥させる", body: "泥や汚水にはさまざまな菌が含まれます。手袋・長靴を着け、消毒と換気・乾燥をしっかり行ってから使用します。", keywords: ["消毒", "乾燥", "衛生"] },
  { id: "fl-recover-photo", hazard: "flood", phase: "recover", title: "片付け前に浸水の高さと被害を写真で記録する", body: "壁の浸水線や被害品を撮影しておくと、罹災証明書や保険の申請に使えます。片付けは記録の後にします。", keywords: ["浸水線", "写真記録", "罹災証明"] },

  // ---------- landslide(土砂災害) ----------
  { id: "ls-prep-signs", hazard: "landslide", phase: "prepare", title: "前兆現象(小石の落下・湧き水・地鳴り)を知っておく", body: "斜面からの小石の落下、わき水の濁り、山鳴りのような音は土砂災害の前兆のことがあります。知識として備えます。", keywords: ["前兆現象", "土砂災害"] },
  { id: "ls-prep-zone", hazard: "landslide", phase: "prepare", title: "自宅が土砂災害警戒区域かどうか確認しておく", body: "自治体のハザードマップで警戒区域・特別警戒区域に該当するか確認し、避難先を決めておきます。", keywords: ["警戒区域", "ハザードマップ"] },
  { id: "ls-prep-drain", hazard: "landslide", phase: "prepare", title: "敷地内の側溝や排水路を掃除し水はけを保つ", body: "落ち葉や土で排水路がふさがると雨水が斜面にたまりやすくなります。日頃から掃除しておきます。", keywords: ["側溝", "排水", "掃除"] },
  { id: "ls-alert-early", hazard: "landslide", phase: "alert", title: "大雨が続くときは崖や斜面から離れて早めに避難する", body: "自治体が出す土砂災害警戒情報(警戒レベル4相当)が早めに避難する合図です。雨がやんでいても土中の水分は増え続けています。", keywords: ["大雨", "土砂災害警戒情報", "早めの避難"] },
  { id: "ls-alert-shelter", hazard: "landslide", phase: "prepare", title: "早めの避難先を親戚・知人宅も含め複数考えておく", body: "指定避難所以外にも、警戒区域外の親戚や知人宅など避難先の選択肢を事前に決めておくと安心です。", keywords: ["避難先", "事前準備"] },
  { id: "ls-now-sign", hazard: "landslide", phase: "now", title: "前兆を感じたらためらわず直ちにその場を離れる", body: "小石の落下や地鳴り、斜面のひび割れに気づいたら、確認する時間を惜しんですぐ離れてください。", keywords: ["前兆", "直ちに離れる"] },
  { id: "ls-now-upstairs", hazard: "landslide", phase: "now", title: "逃げ遅れたら斜面と反対側の2階以上へ移動する", body: "外への避難が間に合わないときは、家の中でも斜面から最も遠い、高い部屋へ移動します。", keywords: ["垂直避難", "斜面反対側"] },
  { id: "ls-after-secondary", hazard: "landslide", phase: "after", title: "二次崩壊の危険がある現場には近づかない", body: "一度崩れた斜面はさらに崩れやすくなっています。自治体の安全確認が終わるまで立ち入らないでください。", keywords: ["二次崩壊", "立入禁止"] },
  { id: "ls-recover-photo", hazard: "landslide", phase: "recover", title: "片付け前に被害状況を写真で記録する", body: "罹災証明書や保険の申請に使うため、土砂の状況や被害箇所を片付ける前に撮影しておきます。", keywords: ["写真記録", "罹災証明"] },

  // ---------- heavySnow(大雪) ----------
  { id: "snow-prep-tools", hazard: "heavySnow", phase: "prepare", title: "除雪道具とすべり止めを準備しておく", body: "スコップや融雪剤、靴の滑り止めを早めに用意します。雪かきで転倒・けがをする事故は毎年多発しています。", keywords: ["除雪道具", "滑り止め"] },
  { id: "snow-prep-tires", hazard: "heavySnow", phase: "prepare", title: "冬タイヤやチェーンを早めに準備する", body: "初雪の前にタイヤ交換を済ませておきます。積雪後の交換作業は路上で危険を伴います。", keywords: ["冬タイヤ", "チェーン"] },
  { id: "snow-alert-supply", hazard: "heavySnow", phase: "alert", title: "大雪予報が出たら燃料と食料を早めに確保する", body: "灯油やガソリン、数日分の食料を大雪の前に確保しておきます。積雪で外出できなくなる場合に備えます。", keywords: ["燃料", "食料", "大雪予報"] },
  { id: "snow-now-stayhome", hazard: "heavySnow", phase: "now", title: "大雪のときは不要不急の外出を控える", body: "視界不良や路面凍結で事故や遭難の危険が高まります。外出は必要なときだけにしましょう。", keywords: ["外出自粛", "視界不良"] },
  { id: "snow-now-roofwork", hazard: "heavySnow", phase: "now", title: "雪下ろしは必ず2人以上、命綱をつけて行う", body: "屋根からの転落死亡事故が毎年起きています。1人での作業は避け、命綱とヘルメットを着用します。", keywords: ["雪下ろし", "命綱", "転落防止"] },
  { id: "snow-now-car", hazard: "heavySnow", phase: "now", title: "車中で待機するときはマフラー周りの雪を確認する", body: "積雪でマフラーがふさがれると排気ガスが車内にたまり、一酸化炭素中毒になる危険があります。", keywords: ["車中泊", "マフラー", "一酸化炭素"] },
  { id: "snow-now-ff", hazard: "heavySnow", phase: "now", title: "FF式暖房の給排気口を雪でふさがない", body: "給排気口が雪で埋まると不完全燃焼を起こし、一酸化炭素中毒の原因になります。こまめに除雪してください。", keywords: ["FF式暖房", "給排気口", "一酸化炭素"] },
  { id: "snow-after-pipe", hazard: "heavySnow", phase: "after", title: "冷え込みが続くときは水道管の凍結対策をする", body: "水道管に保温材を巻く、少量の水を出し続けるなどして凍結・破裂を防ぎます。", keywords: ["水道管", "凍結対策"] },
  { id: "snow-after-roof", hazard: "heavySnow", phase: "after", title: "屋根や庇からの落雪・つららに注意する", body: "気温が上がる日中は屋根の雪が滑り落ちやすくなります。軒下を歩くときは上を確認してください。", keywords: ["落雪", "つらら"] },

  // ---------- powerOutage(停電) ----------
  { id: "pw-prep-battery", hazard: "powerOutage", phase: "prepare", title: "モバイルバッテリーと乾電池を備蓄しておく", body: "スマートフォンや懐中電灯用に、複数回充電できるモバイルバッテリーと予備の乾電池を用意します。", keywords: ["モバイルバッテリー", "乾電池"] },
  { id: "pw-prep-medical", hazard: "powerOutage", phase: "prepare", title: "医療機器を使う人は電源確保の方法を決めておく", body: "在宅酸素や人工呼吸器などを使う場合、非常用電源やかかりつけ医への連絡方法を事前に確認しておきます。", keywords: ["医療機器", "電源確保"] },
  { id: "pw-prep-radio", hazard: "powerOutage", phase: "prepare", title: "停電時の情報収集用に電池式ラジオを備える", body: "スマホの電池が切れても情報を得られるよう、乾電池で使えるラジオを用意しておきます。", keywords: ["ラジオ", "情報収集"] },
  { id: "pw-now-light", hazard: "powerOutage", phase: "now", title: "明かりは懐中電灯を使い、ろうそくは避ける", body: "停電中はろうそくが倒れて火災になる危険があります。LEDライトや懐中電灯を使ってください。", keywords: ["懐中電灯", "ろうそく厳禁"] },
  { id: "pw-now-fridge", hazard: "powerOutage", phase: "now", title: "冷蔵庫の開け閉めを減らして庫内を保冷する", body: "扉を開ける回数を減らすほど冷気が長く保たれます。中身の確認はまとめて手早く行いましょう。", keywords: ["冷蔵庫", "保冷"] },
  { id: "pw-now-unplug", hazard: "powerOutage", phase: "now", title: "電気ストーブなど発熱する器具のプラグを抜く", body: "停電が復旧した瞬間に通電し、無人のまま作動して火災になる危険があります。使っていた器具は必ず抜きます。", keywords: ["電熱器具", "プラグ", "通電火災"] },
  { id: "pw-now-breaker", hazard: "powerOutage", phase: "now", title: "避難するときはブレーカーを切ってから離れる", body: "停電中でも避難で家を空けるときはブレーカーを落とし、復旧時の通電火災を防ぎます。", keywords: ["ブレーカー", "通電火災"] },
  { id: "pw-now-co", hazard: "powerOutage", phase: "now", title: "発電機や炭・七輪を屋内や車庫で使わない", body: "屋内で使うと一酸化炭素中毒で命に関わります。発電機は必ず屋外の風通しのよい場所で運転してください。", keywords: ["発電機", "一酸化炭素", "屋外使用"] },
  { id: "pw-after-battery", hazard: "powerOutage", phase: "after", title: "スマートフォンは電池を節約する設定にする", body: "画面の明るさを下げ、不要な通信機能を切ることでバッテリーの消費を抑えられます。", keywords: ["電池節約", "スマホ設定"] },
  { id: "pw-after-food", hazard: "powerOutage", phase: "after", title: "停電が長引いたら冷蔵庫の中身の安全を確認する", body: "長時間の停電後は食品が傷んでいる可能性があります。におい・見た目に異常があれば口にしないでください。", keywords: ["食品の安全", "冷蔵庫"] },

  // ---------- waterOutage(断水) ----------
  { id: "wt-prep-drink", hazard: "waterOutage", phase: "prepare", title: "飲料水を1人1日3リットルを目安に備蓄する", body: "最低3日分、できれば7日分の飲料水をペットボトルなどで備えておきます。", keywords: ["飲料水備蓄", "3リットル"] },
  { id: "wt-prep-bath", hazard: "waterOutage", phase: "prepare", title: "普段から浴槽に生活用水をためておく習慣をつける", body: "トイレを流す水や洗い物に使える生活用水を、入浴後の浴槽にためておくと断水時に役立ちます。", keywords: ["生活用水", "浴槽"] },
  { id: "wt-prep-container", hazard: "waterOutage", phase: "prepare", title: "給水を受け取るポリタンクや給水袋を備えておく", body: "断水時は給水車や給水拠点で水を受け取ります。運びやすい容量のポリタンクを用意しておきましょう。", keywords: ["ポリタンク", "給水袋"] },
  { id: "wt-alert-fill", hazard: "waterOutage", phase: "alert", title: "断水予告が出たら風呂や容器に水をためる", body: "断水開始前は水道が使える最後の機会です。飲料水・生活用水の両方をできるだけためておきます。", keywords: ["断水予告", "水をためる"] },
  { id: "wt-now-tap", hazard: "waterOutage", phase: "now", title: "断水したら蛇口を閉め漏水を防ぐ", body: "開けたままの蛇口は復旧時に水が噴き出し、部屋を水浸しにする原因になります。忘れず閉めてください。", keywords: ["蛇口", "漏水防止"] },
  { id: "wt-now-priority", hazard: "waterOutage", phase: "now", title: "飲料水と生活用水を使い分けて優先的に使う", body: "飲む・料理用の水は備蓄の飲料水を、トイレや洗い物には浴槽やためた生活用水を使い分けます。", keywords: ["使い分け", "優先順位"] },
  { id: "wt-now-toilet", hazard: "waterOutage", phase: "now", title: "便器にポリ袋を二重にかぶせてトイレを使う", body: "便器を袋で覆い、凝固剤か新聞紙・ペットシーツを入れて使います。使用後は口を縛り、自治体の指示に従って処分します。", keywords: ["簡易トイレ", "凝固剤"] },
  { id: "wt-after-station", hazard: "waterOutage", phase: "after", title: "給水拠点の場所と時間を自治体の発表で確認する", body: "自治体の防災無線やSNSで給水車の巡回場所・時間を確認し、容器を持って受け取りに行きます。", keywords: ["給水拠点", "給水車"] },
  { id: "wt-after-flush", hazard: "waterOutage", phase: "after", title: "復旧直後は濁り水を出し切ってから使う", body: "水道再開直後は配管内の濁りが出ることがあります。しばらく水を流し、透明になってから飲用に使います。", keywords: ["濁り水", "復旧直後"] },

  // ---------- fire(火災) ----------
  { id: "fire-prep-alarm", hazard: "fire", phase: "prepare", title: "住宅用火災警報器と消火器を定期的に点検する", body: "警報器の電池切れやセンサーの汚れは作動不良の原因になります。年に一度は動作確認をしましょう。", keywords: ["火災警報器", "消火器", "点検"] },
  { id: "fire-prep-stove", hazard: "fire", phase: "prepare", title: "コンロ周りとたこ足配線の火災リスクを減らす", body: "コンロ周りに燃えやすい物を置かない、一つのコンセントに電源タップを重ねないなど日頃から予防します。", keywords: ["コンロ", "たこ足配線"] },
  { id: "fire-prep-plan", hazard: "fire", phase: "prepare", title: "家族で逃げ道と外の集合場所を決めておく", body: "部屋ごとの避難経路と、家の外で落ち合う集合場所をあらかじめ家族で共有しておきます。", keywords: ["避難経路", "集合場所"] },
  { id: "fire-now-call", hazard: "fire", phase: "now", title: "火事に気づいたら大声で知らせ119番通報する", body: "「火事だ」と大声で周囲に知らせてから、または知らせながら119番に通報し、正確な住所を伝えます。", keywords: ["119番", "大声で知らせる"] },
  { id: "fire-now-extinguish", hazard: "fire", phase: "now", title: "初期消火は炎が天井に届く前までを目安にする", body: "炎が天井まで達したら消火は困難です。その前なら消火器で消火を試み、無理なら避難を優先します。天ぷら油の火に水は厳禁、鍋のふたか消火器で消してください。", keywords: ["初期消火", "天井", "消火器"] },
  { id: "fire-now-smoke", hazard: "fire", phase: "now", title: "煙の中は姿勢を低くして避難する", body: "煙は天井付近にたまり有毒です。ハンカチなどで口と鼻を覆い、壁づたいに低い姿勢で出口へ向かいます。", keywords: ["煙", "低い姿勢", "避難"] },
  { id: "fire-now-noreturn", hazard: "fire", phase: "now", title: "一度外に逃げたら忘れ物を取りに戻らない", body: "戻る数秒の間に火や煙が急激に広がることがあります。貴重品より命を優先してください。", keywords: ["戻らない", "命優先"] },
  { id: "fire-after-neighbor", hazard: "fire", phase: "after", title: "火が収まったら隣近所にも状況を知らせる", body: "延焼のおそれや再出火の可能性があるため、消防の指示に従いながら周囲にも状況を共有します。", keywords: ["隣家", "延焼", "再出火"] },
  { id: "fire-after-report", hazard: "fire", phase: "after", title: "消防の現場検証が終わるまで現場に入らない", body: "出火原因の調査が行われるまでは、消防や警察の指示に従い、勝手に片付けを始めないでください。", keywords: ["現場検証", "立入禁止"] },

  // ---------- heatwave(猛暑) ----------
  { id: "heat-prep-aircon", hazard: "heatwave", phase: "prepare", title: "エアコンを点検し窓に遮光・断熱対策をする", body: "夏本番前にエアコンの動作と室外機の周りを確認します。遮光カーテンやすだれで室温上昇も抑えます。", keywords: ["エアコン点検", "遮光"] },
  { id: "heat-prep-supply", hazard: "heatwave", phase: "prepare", title: "水分と塩分をとれる飲料・食品を備えておく", body: "経口補水液やスポーツドリンク、塩分補給用のタブレットなどを普段から用意しておきます。", keywords: ["水分補給", "塩分"] },
  { id: "heat-prep-checkin", hazard: "heatwave", phase: "prepare", title: "高齢の家族や一人暮らしの親族に定期的に連絡する", body: "高齢者は暑さやのどの渇きを感じにくく、屋内でも熱中症になります。電話などで日頃から様子を確認します。", keywords: ["高齢者", "見守り"] },
  { id: "heat-alert-warning", hazard: "heatwave", phase: "alert", title: "熱中症警戒アラートが出たら特に警戒する", body: "環境省・気象庁が発表する熱中症警戒アラートは危険な暑さの合図です。不要な外出を控え、エアコンを使いましょう。", keywords: ["熱中症警戒アラート", "暑さ指数"] },
  { id: "heat-now-drink", hazard: "heatwave", phase: "now", title: "のどが渇く前にこまめに水分補給する", body: "のどの渇きを感じたときにはすでに脱水が始まっています。時間を決めて定期的に水分をとりましょう。", keywords: ["水分補給", "脱水予防"] },
  { id: "heat-now-wbgt", hazard: "heatwave", phase: "now", title: "暑さ指数を確認して外出するかどうか判断する", body: "気温だけでなく湿度も加味した暑さ指数(WBGT)が高い日は、屋外での運動や作業を控えます。", keywords: ["暑さ指数", "WBGT", "外出判断"] },
  { id: "heat-now-care", hazard: "heatwave", phase: "now", title: "高齢者や子どもに積極的に声をかける", body: "自分では異変に気づきにくい人がいます。顔色や汗の様子を見て、無理をしていないか声をかけましょう。", keywords: ["高齢者", "子ども", "声かけ"] },
  { id: "heat-now-firstaid", hazard: "heatwave", phase: "now", title: "熱中症のサインに気づいたらすぐ体を冷やす", body: "めまいや大量の汗、頭痛は初期のサインです。涼しい場所へ移動し、首・脇・脚の付け根を冷やして水分をとります。反応がおかしい、自力で水が飲めないときは飲ませず、すぐ119番。", keywords: ["熱中症", "応急処置", "冷やす"] },
  { id: "heat-now-night", hazard: "heatwave", phase: "now", title: "夜間もエアコンを使い我慢せず室温を下げる", body: "熱中症は屋内でも夜間でも起こります。我慢して電源を切らず、設定温度を調整して眠りましょう。", keywords: ["夜間", "エアコン", "室温"] },
  { id: "heat-after-power", hazard: "heatwave", phase: "after", title: "停電時は保冷剤や濡れタオルで体を冷やす", body: "エアコンが使えないときは、風通しを良くし、保冷剤や濡らしたタオルを首や脇に当てて体温の上昇を防ぎます。", keywords: ["停電", "保冷剤", "体を冷やす"] },
];
