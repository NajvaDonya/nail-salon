const PERSIAN_MAP: Record<string, string> = {
  آ: 'a',
  ا: 'a',
  ب: 'b',
  پ: 'p',
  ت: 't',
  ث: 's',
  ج: 'j',
  چ: 'ch',
  ح: 'h',
  خ: 'kh',
  د: 'd',
  ذ: 'z',
  ر: 'r',
  ز: 'z',
  ژ: 'zh',
  س: 's',
  ش: 'sh',
  ص: 's',
  ض: 'z',
  ط: 't',
  ظ: 'z',
  ع: 'a',
  غ: 'gh',
  ف: 'f',
  ق: 'gh',
  ک: 'k',
  گ: 'g',
  ل: 'l',
  م: 'm',
  ن: 'n',
  و: 'v',
  ه: 'h',
  ی: 'y',
  ئ: 'y',
  ء: '',
  ' ': '-',
  '‌': '-',
}

export function slugifyTitle(title: string): string {
  const normalized = title.trim().toLowerCase()
  let out = ''
  for (const char of normalized) {
    if (/[a-z0-9]/.test(char)) {
      out += char
      continue
    }
    if (/[۰-۹]/.test(char)) {
      out += String('۰۱۲۳۴۵۶۷۸۹'.indexOf(char))
      continue
    }
    if (PERSIAN_MAP[char]) {
      out += PERSIAN_MAP[char]
      continue
    }
    if (char === '-' || char === '_') {
      out += '-'
    }
  }
  return out.replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 120) || 'post'
}
