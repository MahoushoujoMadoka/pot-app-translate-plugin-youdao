const BASE_URL = 'https://dict.youdao.com/jsonapi_s?doctype=json&jsonversion=4'
const SIGN_KEY = 'Mk6hqtUp33DGGtoS63tTJbMUYjRrG1Lu'
const LE_BY_LANG = {
  auto: 'auto',
  'zh-CHS': 'zh',
  'zh-CHT': 'zh',
  zh_cn: 'zh',
  zh_tw: 'zh',
  zh: 'zh',
  en: 'en',
  ja: 'ja',
  ko: 'ko',
  fr: 'fr',
  de: 'de',
  es: 'es',
  ru: 'ru',
  pt: 'pt',
  pt_pt: 'pt',
  pt_br: 'pt',
}
function tokenizeText(text) {
  const words = text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 0)

  const stopWords = new Set([
    'a',
    'an',
    'the',
    'is',
    'are',
    'was',
    'were',
    'be',
    'been',
    'being',
    'have',
    'has',
    'had',
    'do',
    'does',
    'did',
    'will',
    'would',
    'could',
    'should',
    'may',
    'might',
    'can',
    'to',
    'of',
    'in',
    'on',
    'at',
    'by',
    'for',
    'with',
    'from',
    'as',
    'and',
    'or',
    'but',
    'so',
    'if',
    'then',
    'than',
    'that',
    'this',
    'these',
    'those',
    'i',
    'you',
    'he',
    'she',
    'it',
    'we',
    'they',
    'me',
    'him',
    'her',
    'us',
    'them',
    'my',
    'your',
    'his',
    'her',
    'its',
    'our',
    'their',
  ])

  return words.filter((word) => !stopWords.has(word) && word.length > 1)
}

function createHeaders() {
  return {
    'user-agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    origin: 'https://www.youdao.com',
    referer: 'https://www.youdao.com/',
  }
}

function generateSign(text, CryptoJS) {
  const keyfrom = 'webdict'
  const client = 'web'

  const time = `${text}${keyfrom}`.length % 10

  const r = `${text}${keyfrom}`
  const o = CryptoJS.MD5(r).toString(CryptoJS.enc.Hex)

  const n = `${client}${text}${time}${SIGN_KEY}${o}`
  const sign = CryptoJS.MD5(n).toString(CryptoJS.enc.Hex)

  return { sign, time }
}

function normalizeLang(lang) {
  if (!lang) {
    return 'auto'
  }
  return LE_BY_LANG[lang] ? lang : lang.toLowerCase()
}

function toLe(lang) {
  return LE_BY_LANG[normalizeLang(lang)]
}

function inferLeFromText(text) {
  if (/[\u3040-\u30ff]/.test(text)) {
    return 'ja'
  }
  if (/[\uac00-\ud7af]/.test(text)) {
    return 'ko'
  }
  if (/[\u4e00-\u9fff]/.test(text)) {
    return 'zh'
  }
  if (/[a-zA-Z]/.test(text)) {
    return 'en'
  }
  return null
}

function resolveLe(text, from, to) {
  const normalizedSource = normalizeLang(from)
  const normalizedTarget = normalizeLang(to)
  const source = toLe(from)
  const target = toLe(to)

  if (normalizedTarget !== 'auto' && !target) {
    throw `不支持目标语言: ${to}`
  }
  if (normalizedSource !== 'auto' && !source) {
    throw `不支持源语言: ${from}`
  }

  const inferredSource = source === 'auto' ? inferLeFromText(text) : source
  const resolvedTarget = target === 'auto' ? null : target

  if (inferredSource && resolvedTarget && inferredSource !== 'zh' && resolvedTarget !== 'zh' && inferredSource !== resolvedTarget) {
    throw `当前接口不支持 ${from || 'auto'} 到 ${to || 'auto'} 的翻译`
  }

  if (inferredSource === 'zh' && resolvedTarget && resolvedTarget !== 'zh') {
    return resolvedTarget
  }
  if (inferredSource && inferredSource !== 'zh' && (!resolvedTarget || resolvedTarget === 'zh' || resolvedTarget === inferredSource)) {
    return inferredSource
  }
  if (resolvedTarget && resolvedTarget !== 'zh') {
    return resolvedTarget
  }
  if (resolvedTarget === 'zh' && inferredSource && inferredSource !== 'zh') {
    return inferredSource
  }
  if (inferredSource && inferredSource !== 'auto') {
    return inferredSource
  }
  return 'en'
}

function extractWebTranslations(webTrans) {
  if (Array.isArray(webTrans)) {
    return webTrans.map((item) => String(item)).filter(Boolean)
  }

  const entries = webTrans?.['web-translation']
  if (!Array.isArray(entries)) {
    return []
  }

  return entries
    .flatMap((entry) => Array.isArray(entry.trans) ? entry.trans : [])
    .map((item) => item?.value)
    .filter(Boolean)
}

async function processWordResult(data, fetch, headers) {
  let pronunciations = []
  let explanations = []
  let associations = []
  let sentence = []

  if (data.ec && data.ec.word) {
    const word = data.ec.word

    if (word.usphone) {
      try {
        let speechRes = await fetch(`https://dict.youdao.com/dictvoice?audio=${word.usspeech}`, {
          method: 'GET',
          headers: headers,
          responseType: 3,
        })
        if (speechRes.ok) {
          pronunciations.push({
            region: 'US',
            symbol: `/${word.usphone}/`,
            voice: speechRes.data,
          })
        } else {
          pronunciations.push({
            region: 'US',
            symbol: `/${word.usphone}/`,
          })
        }
      } catch {
        pronunciations.push({
          region: 'US',
          symbol: `/${word.usphone}/`,
        })
      }
    }

    if (word.ukphone) {
      try {
        let speechRes = await fetch(`https://dict.youdao.com/dictvoice?audio=${word.ukspeech}`, {
          method: 'GET',
          headers: headers,
          responseType: 3,
        })
        if (speechRes.ok) {
          pronunciations.push({
            region: 'UK',
            symbol: `/${word.ukphone}/`,
            voice: speechRes.data,
          })
        } else {
          pronunciations.push({
            region: 'UK',
            symbol: `/${word.ukphone}/`,
          })
        }
      } catch {
        pronunciations.push({
          region: 'UK',
          symbol: `/${word.ukphone}/`,
        })
      }
    }

    if (word.trs && word.trs.length > 0) {
      for (let tr of word.trs) {
        let pos = tr.pos || ''
        let tran = (tr.tran || '').split('；')
        explanations.push({
          trait: pos,
          explains: tran,
        })
      }
    }

    if (word.wfs && word.wfs.length > 0) {
      for (let wf of word.wfs) {
        associations.push(`${wf.wf.name}: ${wf.wf.value}`)
      }
    }

    if (data.ec.exam_type) {
      associations.push('')
      associations.push(data.ec.exam_type.join(' '))
    }
  }

  if (data.collins && data.collins.collins_entries) {
    const entries = data.collins.collins_entries
    for (const entry of entries) {
      if (entry.entries && entry.entries.entry) {
        for (const item of entry.entries.entry) {
          if (item.tran_entry) {
            for (const trans of item.tran_entry) {
              if (trans.exam_sents && trans.exam_sents.sent) {
                for (const sent of trans.exam_sents.sent) {
                  if (sent.eng_sent && sent.chn_sent) {
                    sentence.push({
                      source: sent.eng_sent,
                      target: sent.chn_sent,
                    })
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  if (data.phrs && data.phrs.phrs && data.phrs.phrs.length > 0) {
    associations.push('')
    associations.push('【常用词组】')
    const maxPhrs = Math.min(5, data.phrs.phrs.length)
    for (let i = 0; i < maxPhrs; i++) {
      const phr = data.phrs.phrs[i]
      if (phr.headword && phr.translation) {
        associations.push(`${phr.headword}: ${phr.translation}`)
      }
    }
  }

  if (data.syno && data.syno.synos && data.syno.synos.length > 0) {
    associations.push('')
    associations.push('【同近义词】')
    for (const syno of data.syno.synos) {
      if (syno.pos && syno.ws) {
        const words = syno.ws.map((w) => w.w).join(', ')
        associations.push(`${syno.pos} ${words}`)
      }
    }
  }

  if (data.rel_word && data.rel_word.rels && data.rel_word.rels.length > 0) {
    associations.push('')
    associations.push('【相关词】')
    for (const rel of data.rel_word.rels) {
      if (rel.rel && rel.rel.words) {
        const pos = rel.rel.pos || ''
        const words = rel.rel.words.map((w) => `${w.word}(${w.tran})`).join(', ')
        associations.push(`${pos} ${words}`)
      }
    }
  }

  return { pronunciations, explanations, associations, sentence }
}

async function translateSingleWord(word, options, le) {
  const { utils } = options
  const { tauriFetch: fetch, CryptoJS } = utils

  const headers = createHeaders()
  const { sign, time } = generateSign(word, CryptoJS)

  const queryParams = new URLSearchParams({
    q: word,
    keyfrom: 'webdict',
    sign: sign,
    client: 'web',
    t: time.toString(),
    le,
  })

  const url = `${BASE_URL}&${queryParams.toString()}`

  let res = await fetch(url, {
    method: 'GET',
    headers: headers,
    responseType: 2,
  })

  if (res.ok) {
    let data
    if (typeof res.data === 'string') {
      data = JSON.parse(res.data)
    } else {
      data = res.data
    }
    return await processWordResult(data, fetch, headers)
  }
  return null
}

function processSentenceResult(data) {
  if (data.fanyi && data.fanyi.tran) {
    return data.fanyi.tran
  }

  if (data.ce && data.ce.word && data.ce.word.trs) {
    return data.ce.word.trs.map((w) => w['#text']).join('、')
  }

  const webTranslations = [
    ...extractWebTranslations(data.ec?.web_trans),
    ...extractWebTranslations(data.web_trans),
  ]
  if (webTranslations.length > 0) {
    return webTranslations.slice(0, 5).join('、')
  }

  return null
}

async function translate(text, from, to, options) {
  const { utils } = options
  const { tauriFetch: fetch, CryptoJS } = utils

  const headers = createHeaders()
  const le = resolveLe(text, from, to)

  const { sign, time } = generateSign(text, CryptoJS)

  const queryParams = new URLSearchParams({
    q: text,
    keyfrom: 'webdict',
    sign: sign,
    client: 'web',
    t: time.toString(),
    le,
  })

  const url = `${BASE_URL}&${queryParams.toString()}`

  let res = await fetch(url, {
    method: 'GET',
    headers: headers,
    responseType: 2,
  })

  if (res.ok) {
    let data
    if (typeof res.data === 'string') {
      data = JSON.parse(res.data)
    } else {
      data = res.data
    }

    if (data.ec && data.ec.word && data.ec.word.trs && data.ec.word.trs.length > 0) {
      const wordResult = await processWordResult(data, fetch, headers)
      return wordResult
    }

    const sentenceResult = processSentenceResult(data)
    if (sentenceResult) {
      return sentenceResult
    }
  }

  const words = tokenizeText(text)
  if (words.length > 1) {
    const batchSize = 2
    const allPronunciations = []
    const allExplanations = []
    const allAssociations = []

    for (let i = 0; i < words.length; i += batchSize) {
      const batch = words.slice(i, i + batchSize)

      for (const word of batch) {
        try {
          const result = await translateSingleWord(word, { utils }, le)
          if (result && result.pronunciations) {
            if (result.pronunciations.length > 0) {
              allPronunciations.push(
                ...result.pronunciations.map((p) => ({
                  ...p,
                  word: word,
                }))
              )
            }
            if (result.explanations.length > 0) {
              allExplanations.push(
                ...result.explanations.map((e) => ({
                  ...e,
                  word: word,
                }))
              )
            }
            if (result.associations.length > 0) {
              allAssociations.push(`${word}: ${result.associations.join(', ')}`)
            }
          }
        } catch {
        }
      }
    }

    if (allPronunciations.length > 0 || allExplanations.length > 0) {
      return {
        pronunciations: allPronunciations,
        explanations: allExplanations,
        associations: allAssociations,
      }
    }
  }

  throw `未找到翻译结果`
}
