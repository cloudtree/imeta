import { useEffect, useMemo, useState } from 'react'
import { domainsApi } from '../../api/domains'
import { wordsApi } from '../../api/words'
import SubjectAreaSelect, { DEFAULT_SUBJECT_ID } from '../../components/common/SubjectAreaSelect'
import {
  normalizeLogicalTerm,
  findHomonyms,
  findDomainsByClassifier,
  findSimilarDomains,
  suggestDomainFromClassifier,
  resolveLogicalSegments,
} from '../../utils/termValidation'

const EMPTY = {
  logical_term_nm:  '',
  physical_term_nm: '',
  domain_group_nm: '',
  std_domain_id:     '',
  data_type_nm:     'VARCHAR',
  data_len:      '',
  std_term_desc:     '',
  use_yn:        'Y',
  subject_area_id:    DEFAULT_SUBJECT_ID,
}

const DATA_TYPES = ['VARCHAR', 'CHAR', 'NUMBER', 'DATE', 'TIMESTAMP', 'BOOLEAN', 'CLOB']

export default function TermForm({ value, onChange, words: wordsProp, domains: domainsProp }) {
  const [domainsLocal, setDomainsLocal] = useState([])
  const [wordsLocal,   setWordsLocal]   = useState([])

  const words   = wordsProp   ?? wordsLocal
  const domains = domainsProp ?? domainsLocal

  useEffect(() => {
    if (wordsProp != null && domainsProp != null) return

    domainsApi.getAll({ limit: 10000 })
      .then((res) => setDomainsLocal(Array.isArray(res) ? res : (res.items ?? [])))
      .catch(() => {})
    wordsApi.dictionary()
      .then((res) => setWordsLocal(Array.isArray(res) ? res : (res.items ?? [])))
      .catch(() => {})
  }, [wordsProp, domainsProp])

  const set = (field) => (e) => onChange({ ...value, [field]: e.target.value })

  const applyDomainSuggestion = (last, prev = value) => {
    const suggestion = suggestDomainFromClassifier(last, domains)
    const patch = { _domainTouched: false }
    if (suggestion.autoSelected === true) {
      if (suggestion.domain_group_nm !== undefined) patch.domain_group_nm = suggestion.domain_group_nm
      if (suggestion.std_domain_id     !== undefined) patch.std_domain_id     = suggestion.std_domain_id
      if (suggestion.data_type_nm     !== undefined) patch.data_type_nm     = suggestion.data_type_nm
      if (suggestion.data_len      !== undefined) patch.data_len      = suggestion.data_len
    } else if (suggestion.autoSelected === 'partial') {
      patch.domain_group_nm = suggestion.domain_group_nm
      patch.std_domain_id     = ''
    } else if (last?.std_word_nm !== '코드') {
      patch.domain_group_nm = ''
      patch.std_domain_id     = ''
    }
    return { ...prev, ...patch }
  }

  const selectSuggestedDomain = (dom) => {
    onChange({
      ...value,
      _domainTouched: true,
      domain_group_nm:  dom.domain_group_nm ?? '',
      std_domain_id:      String(dom.std_domain_id),
      data_type_nm:      dom.data_type_nm ?? value.data_type_nm,
      data_len:       dom.data_len != null ? String(dom.data_len) : '',
    })
  }

  // 논리명·동음이의어 선택 반영 → 매칭·물리명·도메인 재계산
  const recomputeFromLogical = (logical, selections, prev = value) => {
    const { segments, physForward: physical } = resolveLogicalSegments(logical, words, selections)
    const matched   = segments.filter((s) => s.matched).map((s) => s.word)
    const last      = matched[matched.length - 1]
    const unmatched = segments.some((s) => !s.matched)

    let next = {
      ...prev,
      logical_term_nm:   logical,
      physical_term_nm:  physical,
      _segments:      segments,
      _wordSelections: selections,
      _domainTouched: false,
    }

    if (last?.taxon_yn === 'Y' && !unmatched) {
      next = applyDomainSuggestion(last, next)
    } else {
      next.domain_group_nm = next.domain_group_nm ?? ''
      next.std_domain_id     = next.std_domain_id ?? ''
    }

    return next
  }

  const handleLogicalTerm = (e) => {
    onChange(recomputeFromLogical(e.target.value, value._wordSelections ?? {}))
  }

  // 동음이의어 후보 중 하나를 선택 — 해당 단어명의 선택을 기억해 재매칭
  const handleSelectHomonym = (stdWordNm, stdWordId) => {
    const selections = { ...(value._wordSelections ?? {}), [stdWordNm]: stdWordId }
    onChange(recomputeFromLogical(value.logical_term_nm, selections))
  }

  const normalizedLogical = normalizeLogicalTerm(value.logical_term_nm)

  const wordSelections = value._wordSelections ?? {}

  const resolved = useMemo(() => {
    if (value._segments && value.logical_term_nm != null) {
      const base = resolveLogicalSegments(value.logical_term_nm, words, wordSelections)
      return { ...base, segments: value._segments }
    }
    if (!normalizedLogical || words.length === 0) {
      return {
        segments: [], segmentsRev: [], hasBounds: false,
        isAmbiguous: false, physForward: '', physReverse: '',
      }
    }
    return resolveLogicalSegments(value.logical_term_nm, words, wordSelections)
  }, [value._segments, value.logical_term_nm, normalizedLogical, words, wordSelections])

  const {
    segments, segmentsRev, hasBounds, isAmbiguous, physForward, physReverse,
  } = resolved

  const matchedWords    = segments.filter((s) => s.matched).map((s) => s.word)
  const unmatchedParts  = segments.filter((s) => !s.matched)
  const lastWord        = matchedWords[matchedWords.length - 1]
  const hasUnmatched    = unmatchedParts.length > 0

  // VB 비교: 앞/뒤 파싱 결과 다르면 모호 (공백으로 경계 지정 시 제외)

  // VB HasDup: 동음이의어 목록
  const homonymWords    = useMemo(
    () => findHomonyms(matchedWords, words),
    [matchedWords, words]  // eslint-disable-line
  )

  // 분류어 기준 도메인 인포타입 제안 목록
  const domainSuggestions = useMemo(() => {
    if (!lastWord || lastWord.taxon_yn !== 'Y') return []
    return findDomainsByClassifier(lastWord.std_word_nm, domains)
  }, [lastWord, domains])

  const similarDomains = useMemo(() => {
    if (!lastWord || lastWord.taxon_yn !== 'Y') return []
    const exclude = new Set(domainSuggestions.map((d) => d.std_domain_id))
    return findSimilarDomains(lastWord.std_word_nm, domains, exclude)
  }, [lastWord, domains, domainSuggestions])

  const formatDomainLabel = (d, showGroup = false) => {
    const label = d.info_type_nm || d.std_domain_nm
    const group = showGroup && d.domain_group_nm ? ` [${d.domain_group_nm}]` : ''
    return `${label}${group}`
  }

  // 인포타입 드롭다운 — 추천 / 유사 / 기타 구분
  const infotypeOptionGroups = useMemo(() => {
    const pool = value.domain_group_nm
      ? domains.filter((d) => d.domain_group_nm === value.domain_group_nm)
      : domains

    const suggestedIds = new Set(domainSuggestions.map((d) => d.std_domain_id))
    const suggested = domainSuggestions.filter(
      (d) => !value.domain_group_nm || d.domain_group_nm === value.domain_group_nm
    )
    const similar = similarDomains.filter(
      (d) => (!value.domain_group_nm || d.domain_group_nm === value.domain_group_nm) && !suggestedIds.has(d.std_domain_id)
    )
    const listedIds = new Set([...suggested, ...similar].map((d) => d.std_domain_id))
    const rest = pool.filter((d) => !listedIds.has(d.std_domain_id))

    return { suggested, similar, rest }
  }, [domains, value.domain_group_nm, domainSuggestions, similarDomains])

  const infotypePlaceholder = useMemo(() => {
    const { suggested, similar } = infotypeOptionGroups
    const hints = [...suggested, ...similar]
      .slice(0, 4)
      .map((d) => d.info_type_nm || d.std_domain_nm)
    if (hints.length === 0) return '— 선택하세요 —'
    const total = suggested.length + similar.length
    const suffix = total > hints.length ? ` 외 ${total - hints.length}건` : ''
    return `— ${hints.join(', ')}${suffix} —`
  }, [infotypeOptionGroups])

  const suggestedGroupNames = useMemo(
    () => [...new Set([...domainSuggestions, ...similarDomains].map((d) => d.domain_group_nm).filter(Boolean))],
    [domainSuggestions, similarDomains]
  )

  const groupPlaceholder = useMemo(() => {
    if (suggestedGroupNames.length === 0) return '— 선택하세요 —'
    const suffix = suggestedGroupNames.length > 3
      ? ` 외 ${suggestedGroupNames.length - 3}건`
      : ''
    return `— ${suggestedGroupNames.slice(0, 3).join(', ')}${suffix} —`
  }, [suggestedGroupNames])

  // 도메인 목록 로드 후 — 논리명만 입력된 상태에서 자동 제안
  useEffect(() => {
    if (value._domainTouched || !lastWord || lastWord.taxon_yn !== 'Y' || hasUnmatched) return
    if (value.std_domain_id && value.domain_group_nm) return

    const suggestion = suggestDomainFromClassifier(lastWord, domains)
    if (suggestion.autoSelected !== true && suggestion.autoSelected !== 'partial') return

    const patch = {}
    if (!value.domain_group_nm && suggestion.domain_group_nm) patch.domain_group_nm = suggestion.domain_group_nm
    if (!value.std_domain_id && suggestion.std_domain_id)           patch.std_domain_id     = suggestion.std_domain_id
    if (!value.data_len && suggestion.data_len)             patch.data_len      = suggestion.data_len
    if (suggestion.data_type_nm && !value.std_domain_id)           patch.data_type_nm     = suggestion.data_type_nm
    if (Object.keys(patch).length === 0) return

    onChange({ ...value, ...patch })
  }, [lastWord, domains, hasUnmatched, value._domainTouched, value.std_domain_id, value.domain_group_nm]) // eslint-disable-line

  // 물리명 30자 초과 (VB: Len(engAtt) > 30)
  const physTooLong     = (value.physical_term_nm || '').length > 30

  // 도메인 구분 코드 = 표준도메인의 '도메인 그룹명(domain_group_nm)' 고유 목록
  const divCdOptions = useMemo(() => {
    const seen = new Set()
    const all = domains
      .filter((d) => d.domain_group_nm && !seen.has(d.domain_group_nm) && seen.add(d.domain_group_nm))
      .map((d) => ({ label: d.domain_group_nm, value: d.domain_group_nm }))

    if (suggestedGroupNames.length === 0) return all

    const suggestedSet = new Set(suggestedGroupNames)
    const suggested = suggestedGroupNames.map((g) => ({ label: `${g} ★`, value: g }))
    const rest = all.filter((o) => !suggestedSet.has(o.value))
    return [...suggested, ...rest]
  }, [domains, suggestedGroupNames])

  const { suggested: suggestedOpts, similar: similarOpts, rest: restOpts } = infotypeOptionGroups

  const handleDivCd = (e) => {
    onChange({ ...value, _domainTouched: true, domain_group_nm: e.target.value, std_domain_id: '', data_type_nm: 'VARCHAR', data_len: '' })
  }

  const handleDomainId = (e) => {
    const id  = e.target.value
    const dom = domains.find((d) => String(d.std_domain_id) === id)
    onChange({
      ...value,
      _domainTouched: true,
      std_domain_id: id,
      domain_group_nm: dom?.domain_group_nm ?? value.domain_group_nm,
      data_type_nm: dom?.data_type_nm  ?? value.data_type_nm,
      data_len:  dom?.data_len != null ? String(dom.data_len) : '',
    })
  }

  return (
    <>
      {/* 주제영역 */}
      <div className="form-group">
        <label className="form-label required">주제영역</label>
        <SubjectAreaSelect
          value={value.subject_area_id}
          onChange={(v) => onChange({ ...value, subject_area_id: v })}
        />
      </div>

      {/* 논리명 */}
      <div className="form-group">
        <label className="form-label required">논리명</label>
        <input
          className="form-control"
          value={value.logical_term_nm}
          onChange={handleLogicalTerm}
          placeholder="예: 고객번호  (모호할 때 공백으로 구분: 1학년 신청제한여부)"
          maxLength={200}
        />

        {/* 매칭 결과 시각화 (왼쪽 파싱) */}
        {segments.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '6px' }}>
            {segments.map((seg, i) =>
              seg.matched ? (
                <span key={i} style={{
                  display: 'inline-flex', alignItems: 'center', gap: '4px',
                  background: seg.candidates ? '#fffbeb' : (seg.word.taxon_yn === 'Y' ? '#dbeafe' : '#f0fdf4'),
                  border: `1px solid ${seg.candidates ? '#fcd34d' : (seg.word.taxon_yn === 'Y' ? '#93c5fd' : '#86efac')}`,
                  borderRadius: '4px', padding: '2px 7px', fontSize: '12px',
                }}>
                  <span style={{ fontWeight: 600, color: '#1e40af' }}>{seg.word.std_word_nm}</span>
                  <span style={{ color: '#6b7280' }}>→</span>
                  <span style={{ fontFamily: 'monospace', color: '#059669', fontWeight: 600 }}>{seg.word.abb_word_nm}</span>
                  {seg.word.taxon_yn === 'Y' && <span style={{ color: '#2563eb', fontSize: '10px' }}>★분류어</span>}
                  {seg.candidates && (
                    <select
                      value={String(seg.word.std_word_id)}
                      onChange={(e) => handleSelectHomonym(seg.word.std_word_nm, e.target.value)}
                      title="동일한 단어명이 여러 건 등록되어 있습니다. 사용할 항목을 선택하세요."
                      style={{
                        fontSize: '11px', border: '1px solid #f59e0b', borderRadius: '3px',
                        marginLeft: '2px', background: '#fff', color: '#92400e', cursor: 'pointer',
                      }}
                    >
                      {seg.candidates.map((c) => (
                        <option key={c.std_word_id} value={c.std_word_id}>
                          {c.abb_word_nm} · {c.full_eng_nm}
                        </option>
                      ))}
                    </select>
                  )}
                </span>
              ) : (
                <span key={i} style={{
                  background: '#fee2e2', border: '1px solid #fca5a5',
                  borderRadius: '4px', padding: '2px 7px', fontSize: '12px',
                  color: '#dc2626', fontWeight: 600,
                }}>
                  ⚠ "{seg.text}" 미등록
                </span>
              )
            )}
          </div>
        )}

        {/* 검증 메시지 */}
        <div style={{ marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
          {/* 마지막 단어 분류어 체크 */}
          {lastWord && lastWord.taxon_yn !== 'Y' && (
            <span style={{ color: '#dc2626', fontSize: '12px' }}>
              ✗ 마지막 단어 "{lastWord.std_word_nm}"은 분류어가 아닙니다.
            </span>
          )}
          {lastWord && lastWord.taxon_yn === 'Y' && !hasUnmatched && (
            <span style={{ color: '#059669', fontSize: '12px' }}>
              ✓ 모든 단어가 표준단어로 매칭됐습니다.
            </span>
          )}

          {/* 분류어 기준 도메인 인포타입 제안 */}
          {lastWord?.taxon_yn === 'Y' && !hasUnmatched && domainSuggestions.length > 0 && (
            <div style={{
              marginTop: '4px', padding: '8px 10px', background: '#eff6ff',
              border: '1px solid #bfdbfe', borderRadius: '6px',
            }}>
              <p style={{ margin: '0 0 6px', fontSize: '12px', fontWeight: 600, color: '#1e40af' }}>
                💡 분류어 "{lastWord.std_word_nm}"에 해당하는 도메인 인포타입
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                {domainSuggestions.map((d) => {
                  const selected = String(value.std_domain_id) === String(d.std_domain_id)
                  return (
                    <button
                      key={d.std_domain_id}
                      type="button"
                      onClick={() => selectSuggestedDomain(d)}
                      style={{
                        border: `1px solid ${selected ? '#2563eb' : '#93c5fd'}`,
                        background: selected ? '#dbeafe' : '#fff',
                        borderRadius: '4px', padding: '4px 10px', fontSize: '12px',
                        cursor: 'pointer', color: '#1e40af', fontWeight: selected ? 700 : 500,
                      }}
                    >
                      {d.info_type_nm || d.std_domain_nm}
                      {d.domain_group_nm ? ` (${d.domain_group_nm})` : ''}
                    </button>
                  )
                })}
              </div>
              {value.domain_group_nm && (
                <p style={{ margin: '6px 0 0', fontSize: '11px', color: '#3b82f6' }}>
                  도메인 그룹명: <strong>{value.domain_group_nm}</strong>
                  {value.std_domain_id ? '' : ' — 인포타입을 선택하면 데이터 타입·길이가 자동 설정됩니다.'}
                </p>
              )}
            </div>
          )}
          {lastWord?.taxon_yn === 'Y' && !hasUnmatched && domainSuggestions.length === 0 && lastWord.std_word_nm !== '코드' && (
            <span style={{ color: '#d97706', fontSize: '12px' }}>
              ⚠ 분류어 "{lastWord.std_word_nm}"에 해당하는 표준 도메인이 없습니다. 표준 도메인에 먼저 등록하세요.
            </span>
          )}
          {lastWord?.std_word_nm === '코드' && lastWord.taxon_yn === 'Y' && !hasUnmatched && (
            <span style={{ color: '#2563eb', fontSize: '12px' }}>
              ℹ "코드" 분류어 — 도메인 그룹명이 <strong>코드</strong>로 설정됩니다. 인포타입 미선택 시 저장 시 자동 등록됩니다.
            </span>
          )}

          {/* 물리명 30자 초과 (VB: Len(engAtt) > 30) */}
          {physTooLong && (
            <span style={{ color: '#dc2626', fontSize: '12px' }}>
              ✗ 물리명이 30자를 초과합니다. ({(value.physical_term_nm || '').length}자) — 단어 조합을 줄여주세요.
            </span>
          )}

          {/* 모호한 단어 분리 (VB: "D" 표시 — 앞파싱 ≠ 뒤파싱) */}
          {isAmbiguous && (
            <span style={{ color: '#d97706', fontSize: '12px' }}>
              ⚠ 단어 분리가 모호합니다. 앞→뒤: {physForward} / 뒤→앞: {physReverse}
              {' '}— 공백으로 구분해 보세요. (예: "1학년 신청제한여부")
            </span>
          )}
          {hasBounds && !hasUnmatched && (
            <span style={{ color: '#2563eb', fontSize: '12px' }}>
              ℹ 공백으로 지정한 구간별로 매칭했습니다.
            </span>
          )}

          {/* 동음이의어 경고 (VB HasDup) — 매칭 결과의 노란색 선택 상자에서 항목 선택 가능 */}
          {homonymWords.length > 0 && (
            <span style={{ color: '#d97706', fontSize: '12px' }}>
              ⚠ 동음이의어: {homonymWords.map((w) => `"${w.std_word_nm}"`).join(', ')} — 위 매칭 결과의 선택 상자에서 사용할 항목을 선택하세요.
            </span>
          )}
        </div>
      </div>

      {/* 물리명 (자동생성, 읽기 전용) */}
      <div className="form-group">
        <label className="form-label">
          물리명
          <span style={{ fontSize: '11px', color: '#888', fontWeight: 400, marginLeft: '6px' }}>(자동생성)</span>
          {physTooLong && (
            <span style={{ fontSize: '11px', color: '#dc2626', fontWeight: 600, marginLeft: '8px' }}>
              {(value.physical_term_nm || '').length}자 / 최대 30자
            </span>
          )}
        </label>
        <input
          className="form-control"
          value={value.physical_term_nm}
          readOnly
          style={{
            background: physTooLong ? '#fff1f2' : '#f3f4f6',
            cursor: 'default',
            fontFamily: 'monospace',
            fontWeight: 500,
            letterSpacing: '0.5px',
            border: physTooLong ? '1px solid #fca5a5' : undefined,
          }}
        />
      </div>

      {/* 도메인 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <div className="form-group">
          <label className="form-label required">도메인 그룹명</label>
          <select className="form-control" value={value.domain_group_nm} onChange={handleDivCd}>
            <option value="">{groupPlaceholder}</option>
            {divCdOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label className={`form-label${value.domain_group_nm === '코드' ? '' : ' required'}`}>
            도메인 인포타입
            {value.domain_group_nm === '코드' && (
              <span style={{ fontSize: '11px', color: '#6b7280', fontWeight: 400, marginLeft: '6px' }}>
                (코드 그룹은 선택사항 — 미선택 시 자동 등록)
              </span>
            )}
          </label>
          <select
            className="form-control"
            value={value.std_domain_id ?? ''}
            onChange={handleDomainId}
          >
            <option value="">{infotypePlaceholder}</option>
            {suggestedOpts.length > 0 && (
              <optgroup label={`★ 분류어 "${lastWord?.std_word_nm ?? ''}" 추천`}>
                {suggestedOpts.map((d) => (
                  <option key={d.std_domain_id} value={d.std_domain_id}>
                    {formatDomainLabel(d, !value.domain_group_nm)}
                  </option>
                ))}
              </optgroup>
            )}
            {similarOpts.length > 0 && (
              <optgroup label="유사 인포타입">
                {similarOpts.map((d) => (
                  <option key={d.std_domain_id} value={d.std_domain_id}>
                    {formatDomainLabel(d, !value.domain_group_nm)}
                  </option>
                ))}
              </optgroup>
            )}
            {restOpts.length > 0 && (
              <optgroup label={suggestedOpts.length + similarOpts.length > 0 ? '기타' : '전체'}>
                {restOpts.map((d) => (
                  <option key={d.std_domain_id} value={d.std_domain_id}>
                    {formatDomainLabel(d, !value.domain_group_nm)}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
          {value.domain_group_nm && suggestedOpts.length + similarOpts.length + restOpts.length === 0 && (
            <span className="form-hint" style={{ color: '#f59e0b' }}>
              해당 도메인 구분 코드에 등록된 도메인이 없습니다.
            </span>
          )}
          {!value.domain_group_nm && suggestedOpts.length + similarOpts.length === 0 && lastWord?.taxon_yn === 'Y' && (
            <span className="form-hint" style={{ color: '#f59e0b' }}>
              분류어에 맞는 인포타입이 없습니다. 위 목록에서 선택하거나 표준 도메인을 등록하세요.
            </span>
          )}
        </div>
      </div>

      {/* 데이터 속성 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
        <div className="form-group">
          <label className="form-label required">
            데이터 타입
            {value.std_domain_id && <span style={{ fontSize: '11px', color: '#2563eb', fontWeight: 400, marginLeft: '6px' }}>(도메인 자동설정)</span>}
          </label>
          <select
            className="form-control"
            value={value.data_type_nm}
            onChange={set('data_type_nm')}
            disabled={!!value.std_domain_id}
            style={value.std_domain_id ? { background: '#f0f7ff', color: '#1e40af', fontWeight: 500 } : {}}
          >
            {DATA_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label required">
            데이터 길이
            {value.std_domain_id && <span style={{ fontSize: '11px', color: '#2563eb', fontWeight: 400, marginLeft: '6px' }}>(도메인 자동설정)</span>}
          </label>
          <input
            className="form-control"
            value={value.data_len}
            onChange={set('data_len')}
            placeholder="예: 100, 111,111, 7,2"
            maxLength={100}
            readOnly={!!value.std_domain_id}
            style={value.std_domain_id ? { background: '#f0f7ff', color: '#1e40af', fontWeight: 500, cursor: 'default' } : {}}
          />
        </div>
        <div className="form-group">
          <label className="form-label">사용 여부</label>
          <select className="form-control" value={value.use_yn} onChange={set('use_yn')}>
            <option value="Y">Y (사용)</option>
            <option value="N">N (미사용)</option>
          </select>
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">설명</label>
        <textarea className="form-control" value={value.std_term_desc} onChange={set('std_term_desc')} placeholder="용어 설명을 입력하세요." rows={3} />
      </div>
    </>
  )
}

TermForm.EMPTY = EMPTY
