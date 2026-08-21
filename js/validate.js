// 入力検証(純粋関数のみ)。DOM・ストレージ・外部通信には触れない。

export const CATEGORIES = ["water", "food", "medical", "light", "hygiene", "documents", "other"];

// YYYY-MM-DD形式かつ実在する日付かを検証する。null は「未設定」として許可する。
export function validDate(v) {
  if (v === null) return true;
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const [y, m, d] = v.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

// 呼び出すたびに一意なIDを生成する(タイムスタンプ + ランダム文字列)。
export function uid(now = Date.now()) {
  return `${now}-${Math.random().toString(36).slice(2, 9)}`;
}

export function validateSupply(input, locationIds = []) {
  const errors = {};
  const name = String(input.name ?? "").trim();
  const quantity = Number(input.quantity);
  const minimumQuantity = Number(input.minimumQuantity);
  const unit = String(input.unit ?? "").trim();
  const note = String(input.note ?? "").trim();
  const expiresOn = input.expiresOn || null;
  const locationId = input.locationId || null;
  const recommendedKey = typeof input.recommendedKey === "string" && input.recommendedKey.length <= 30 ? input.recommendedKey : null;

  if (!name) errors.name = "品名を入力してください。";
  else if (name.length > 40) errors.name = "品名は40文字以内で入力してください。";

  if (!Number.isInteger(quantity) || quantity < 0 || quantity > 9999) {
    errors.quantity = "数量は0〜9999の整数で入力してください。";
  }
  if (!Number.isInteger(minimumQuantity) || minimumQuantity < 0 || minimumQuantity > 9999) {
    errors.minimumQuantity = "必要数は0〜9999の整数で入力してください。";
  }
  if (!unit || unit.length > 12) errors.unit = "単位は1〜12文字で入力してください。";
  if (!validDate(expiresOn)) errors.expiresOn = "実在する日付を入力してください。";
  if (locationId && !locationIds.includes(locationId)) errors.locationId = "登録済みの保管場所を選んでください。";
  if (note.length > 300) errors.note = "メモは300文字以内で入力してください。";

  return {
    valid: !Object.keys(errors).length,
    errors,
    value: {
      name,
      category: CATEGORIES.includes(input.category) ? input.category : "other",
      quantity,
      minimumQuantity,
      unit,
      expiresOn,
      locationId,
      isGoBag: Boolean(input.isGoBag),
      isReady: Boolean(input.isReady),
      note,
      recommendedKey,
    },
  };
}

export function validateLocation(input) {
  const name = String(input.name ?? "").trim();
  const note = String(input.note ?? "").trim();
  const errors = {};

  if (!name) errors.name = "場所名を入力してください。";
  else if (name.length > 30) errors.name = "場所名は30文字以内で入力してください。";
  if (note.length > 200) errors.note = "メモは200文字以内で入力してください。";

  return { valid: !Object.keys(errors).length, errors, value: { name, note } };
}

export function validateFamily(input) {
  const label = String(input.label ?? "").trim();
  const contactNote = String(input.contactNote ?? "").trim();
  const meetingPlace = String(input.meetingPlace ?? "").trim();
  const considerations = String(input.considerations ?? "").trim();
  const errors = {};

  if (!label) errors.label = "呼び名を入力してください。";
  else if (label.length > 30) errors.label = "呼び名は30文字以内で入力してください。";
  for (const [key, value] of Object.entries({ contactNote, meetingPlace, considerations })) {
    if (value.length > 300) errors[key] = "300文字以内で入力してください。";
  }

  return { valid: !Object.keys(errors).length, errors, value: { label, contactNote, meetingPlace, considerations } };
}

export function validateInsurance(input) {
  const errors = {};
  const status = ["unknown", "none", "insured"].includes(input.status) ? input.status : "unknown";
  const policyLocation = String(input.policyLocation ?? "").trim();
  const note = String(input.note ?? "").trim();
  const renewalOn = input.renewalOn || null;
  const lastCheckedOn = input.lastCheckedOn || null;

  if (policyLocation.length > 100) errors.policyLocation = "保管場所は100文字以内で入力してください。";
  if (note.length > 300) errors.note = "メモは300文字以内で入力してください。";
  if (!validDate(renewalOn)) errors.renewalOn = "実在する日付を入力してください。";
  if (!validDate(lastCheckedOn)) errors.lastCheckedOn = "実在する日付を入力してください。";

  return {
    valid: !Object.keys(errors).length,
    errors,
    value: {
      status,
      coverages: {
        earthquake: Boolean(input.coverages?.earthquake),
        stormFlood: Boolean(input.coverages?.stormFlood),
        household: Boolean(input.coverages?.household),
      },
      policyLocation,
      renewalOn,
      lastCheckedOn,
      note,
    },
  };
}

export function validateHousehold(input) {
  const errors = {};
  const adults = Number(input.adults);
  const children = Number(input.children);
  const stockDays = Number(input.stockDays);
  const emergencyContacts = String(input.emergencyContacts ?? "").trim();

  if (!Number.isInteger(adults) || adults < 0 || adults > 20) errors.adults = "大人の人数は0〜20で入力してください。";
  if (!Number.isInteger(children) || children < 0 || children > 20) errors.children = "子どもの人数は0〜20で入力してください。";
  if (!errors.adults && !errors.children && adults + children < 1) errors.adults = "家族の人数を1人以上にしてください。";
  if (![3, 7].includes(stockDays)) errors.stockDays = "備蓄日数は3日か7日を選んでください。";
  if (emergencyContacts.length > 500) errors.emergencyContacts = "緊急連絡メモは500文字以内で入力してください。";

  return { valid: !Object.keys(errors).length, errors, value: { adults, children, stockDays, emergencyContacts } };
}
