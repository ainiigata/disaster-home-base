export const STOCK_GUIDE = [
  { key: "water",          name: "飲料水",                 category: "water",     unit: "L",   perPerson: true,  perDay: true,  rate: 3,   isGoBag: false, note: "1人1日3Lが目安。ペットボトルで備蓄" },
  { key: "mainFood",       name: "主食(ご飯・麺など)",     category: "food",      unit: "食",  perPerson: true,  perDay: true,  rate: 3,   isGoBag: false, note: "アルファ米・レトルト・缶詰など" },
  { key: "cassetteStove",  name: "カセットコンロ",         category: "food",      unit: "台",  perPerson: false, perDay: false, rate: 1,   isGoBag: false, note: "温かい食事は体力と気力を保つ" },
  { key: "gasCanister",    name: "カセットボンベ",         category: "food",      unit: "本",  perPerson: true,  perDay: true,  rate: 0.5, isGoBag: false, note: "1人1日約1/2本が目安" },
  { key: "mobileBattery",  name: "モバイルバッテリー",     category: "light",     unit: "個",  perPerson: true,  perDay: false, rate: 1,   isGoBag: true,  note: "満充電にしておく" },
  { key: "flashlight",     name: "懐中電灯・ランタン",     category: "light",     unit: "個",  perPerson: true,  perDay: false, rate: 1,   isGoBag: true,  note: "1人1灯。ろうそくは火災の危険" },
  { key: "batteries",      name: "乾電池(予備)",           category: "light",     unit: "セット", perPerson: false, perDay: false, rate: 2, isGoBag: false, note: "使う機器に合うサイズを確認" },
  { key: "radio",          name: "携帯ラジオ",             category: "light",     unit: "台",  perPerson: false, perDay: false, rate: 1,   isGoBag: true,  note: "停電時の情報源" },
  { key: "simpleToilet",   name: "簡易トイレ",             category: "hygiene",   unit: "回分", perPerson: true, perDay: true,  rate: 5,   isGoBag: false, note: "断水時に必須。1人1日5回分" },
  { key: "wetTissue",      name: "ウェットティッシュ",     category: "hygiene",   unit: "個",  perPerson: true,  perDay: false, rate: 1,   isGoBag: true,  note: "断水時の清拭・手指衛生に" },
  { key: "firstAid",       name: "救急セット",             category: "medical",   unit: "式",  perPerson: false, perDay: false, rate: 1,   isGoBag: true,  note: "絆創膏・消毒・常備薬など" },
  { key: "medicine",       name: "常備薬・お薬手帳の控え", category: "medical",   unit: "式",  perPerson: false, perDay: false, rate: 1,   isGoBag: true,  note: "処方薬は1週間分を目安に" },
  { key: "importantCopies", name: "重要書類のコピー",      category: "documents", unit: "式",  perPerson: false, perDay: false, rate: 1,   isGoBag: true,  note: "保険証・免許証など。原本は保管場所に" },
  { key: "cash",           name: "現金(小銭含む)",         category: "documents", unit: "式",  perPerson: false, perDay: false, rate: 1,   isGoBag: true,  note: "停電時はカードが使えないことがある" },
];

export function requiredQuantity(item, { adults = 0, children = 0, stockDays = 3 } = {}) {
  const persons = adults + children;
  let q = item.rate;
  if (item.perPerson) q *= persons;
  if (item.perDay) q *= stockDays;
  return Math.ceil(q);
}
