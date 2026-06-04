type Particle = '이/가' | '은/는' | '을/를' | '와/과' | '로/으로'

/**
 * 단어의 마지막 음절이 종성(받침)을 가지는지 판별.
 * - 한글: Unicode 블록 계산으로 정확히 판단
 * - 영문: 마지막 글자 휴리스틱
 *   - ng/n/m/l 끝 → 종성 있음 (코딩→딩, 인→ㄴ, 메일→ㄹ ...)
 *   - 그 외 → 종성 없음 (영문 자음 끝이 한글 표기 시 으/르/스가 붙어 사라지는 경우가 다수.
 *     예: Frontend→프론트엔드(가), Retrospect→레트로스펙트(가), Test→테스트(가))
 * - 숫자: 한글 발음 기준 (일/삼/육/칠/팔/영은 받침 있음)
 *
 * 한계: 영문 휴리스틱은 100% 정확하지 않다.
 * 예) "Internship"은 실제 인턴십(ㅂ 받침)이지만 'p' 끝 → 받침 없음으로 잘못 판단.
 * 이런 케이스는 카테고리명에 따라 수동 보정 필요.
 */
function hasJongseong(word: string): boolean {
  if (!word) return false
  const last = word[word.length - 1]
  const code = last.charCodeAt(0)

  // 한글 syllable block (가~힣)
  if (code >= 0xac00 && code <= 0xd7a3) {
    return (code - 0xac00) % 28 !== 0
  }

  if (/[a-zA-Z]/.test(last)) {
    const lower = word.toLowerCase()
    return /(ng|[lmn])$/.test(lower)
  }

  if (/\d/.test(last)) {
    return ['0', '1', '3', '6', '7', '8'].includes(last)
  }

  return false
}

function isRieulJongseong(word: string): boolean {
  if (!word) return false
  const last = word[word.length - 1]
  const code = last.charCodeAt(0)
  if (code >= 0xac00 && code <= 0xd7a3) {
    return (code - 0xac00) % 28 === 8 // ㄹ
  }
  if (/[lL]/.test(last)) return true
  return last === '1' || last === '7' || last === '8' // 일/칠/팔
}

export function attach(word: string, particle: Particle): string {
  const has = hasJongseong(word)
  switch (particle) {
    case '이/가':
      return word + (has ? '이' : '가')
    case '은/는':
      return word + (has ? '은' : '는')
    case '을/를':
      return word + (has ? '을' : '를')
    case '와/과':
      return word + (has ? '과' : '와')
    case '로/으로':
      return word + (has && !isRieulJongseong(word) ? '으로' : '로')
  }
}
