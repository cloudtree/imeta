export const EMPTY_PART = { code: 'P1', name: '', rulesText: '' }

export const EMPTY_RULE = {
  system_id: '',
  rule_title_nm: '',
  format_pattern_nm: '',
  parts: [{ ...EMPTY_PART }],
  examplesText: '',
  rule_desc: '',
  sort_ord: 0,
  use_yn: 'Y',
}

export const EMPTY_SYSTEM = {
  system_cd: '',
  system_nm: '',
  system_desc: '',
  use_yn: 'Y',
  copy_from_enterprise: true,
}

export function ruleToForm(rule) {
  const parts = Array.isArray(rule.parts) ? rule.parts : []
  return {
    system_id: rule.system_id ?? '',
    rule_title_nm: rule.rule_title_nm ?? '',
    format_pattern_nm: rule.format_pattern_nm ?? '',
    parts: parts.length
      ? parts.map((p) => ({
          code: p.code ?? '',
          name: p.name ?? '',
          rulesText: Array.isArray(p.rules) ? p.rules.join('\n') : (p.rulesText ?? ''),
        }))
      : [{ ...EMPTY_PART }],
    examplesText: Array.isArray(rule.examples) ? rule.examples.join('\n') : '',
    rule_desc: rule.rule_desc ?? '',
    sort_ord: rule.sort_ord ?? 0,
    use_yn: rule.use_yn ?? 'Y',
  }
}

export function formToPayload(form) {
  return {
    system_id: Number(form.system_id),
    rule_title_nm: form.rule_title_nm?.trim(),
    format_pattern_nm: form.format_pattern_nm?.trim() || null,
    parts: (form.parts || []).map((p) => ({
      code: p.code?.trim() || '',
      name: p.name?.trim() || '',
      rules: String(p.rulesText || '')
        .split('\n')
        .map((s) => s.trim())
        .filter(Boolean),
    })),
    examples: String(form.examplesText || '')
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean),
    rule_desc: form.rule_desc?.trim() || null,
    sort_ord: Number(form.sort_ord) || 0,
    use_yn: form.use_yn || 'Y',
  }
}

export function NamingRuleForm({ value, onChange, systems = [], lockSystem = false }) {
  const set = (field) => (e) => onChange({ ...value, [field]: e.target.value })

  const updatePart = (idx, field, val) => {
    const parts = value.parts.map((p, i) => (i === idx ? { ...p, [field]: val } : p))
    onChange({ ...value, parts })
  }

  const addPart = () => {
    const n = (value.parts?.length || 0) + 1
    onChange({
      ...value,
      parts: [...(value.parts || []), { code: `P${n}`, name: '', rulesText: '' }],
    })
  }

  const removePart = (idx) => {
    const parts = value.parts.filter((_, i) => i !== idx)
    onChange({ ...value, parts: parts.length ? parts : [{ ...EMPTY_PART }] })
  }

  return (
    <>
      <div className="form-group">
        <label className="form-label required">시스템</label>
        <select
          className="form-control"
          value={value.system_id}
          onChange={set('system_id')}
          disabled={lockSystem}
        >
          <option value="">시스템 선택</option>
          {systems.map((s) => (
            <option key={s.system_id} value={s.system_id}>
              {s.system_cd} – {s.system_nm}
            </option>
          ))}
        </select>
      </div>

      <div className="form-group">
        <label className="form-label required">규칙 제목</label>
        <input
          className="form-control"
          value={value.rule_title_nm}
          onChange={set('rule_title_nm')}
          placeholder="예: Table 명명규칙"
          maxLength={200}
        />
      </div>

      <div className="form-group">
        <label className="form-label">형식(Format)</label>
        <input
          className="form-control"
          value={value.format_pattern_nm}
          onChange={set('format_pattern_nm')}
          placeholder="예: 주제영역분류(P1) + '_' + 엔터티영문물리명(P2)"
        />
      </div>

      <div className="form-group">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <label className="form-label" style={{ margin: 0 }}>구성 요소 (P1, P2…)</label>
          <button type="button" className="btn btn-secondary btn-sm" onClick={addPart}>+ 요소 추가</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {(value.parts || []).map((part, idx) => (
            <div
              key={idx}
              style={{
                border: '1px solid #e5e5ea',
                borderRadius: 10,
                padding: 12,
                background: '#fafafa',
              }}
            >
              <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr auto', gap: 8, marginBottom: 8 }}>
                <input
                  className="form-control"
                  value={part.code}
                  onChange={(e) => updatePart(idx, 'code', e.target.value)}
                  placeholder="P1"
                />
                <input
                  className="form-control"
                  value={part.name}
                  onChange={(e) => updatePart(idx, 'name', e.target.value)}
                  placeholder="구성 요소명"
                />
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  onClick={() => removePart(idx)}
                  disabled={(value.parts || []).length <= 1}
                >
                  삭제
                </button>
              </div>
              <textarea
                className="form-control"
                rows={3}
                value={part.rulesText}
                onChange={(e) => updatePart(idx, 'rulesText', e.target.value)}
                placeholder="규칙 설명 (줄바꿈으로 구분)"
              />
            </div>
          ))}
        </div>
      </div>

      <div className="form-group">
        <label className="form-label">예시</label>
        <textarea
          className="form-control"
          rows={3}
          value={value.examplesText}
          onChange={set('examplesText')}
          placeholder="예시를 줄바꿈으로 입력"
        />
      </div>

      <div className="form-group">
        <label className="form-label">비고</label>
        <textarea
          className="form-control"
          rows={2}
          value={value.rule_desc}
          onChange={set('rule_desc')}
          placeholder="추가 안내"
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <div className="form-group">
          <label className="form-label">정렬 순서</label>
          <input
            className="form-control"
            type="number"
            value={value.sort_ord}
            onChange={set('sort_ord')}
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
    </>
  )
}

export function SystemForm({ value, onChange, isEdit = false }) {
  const set = (field) => (e) => {
    const v = e.target.type === 'checkbox' ? e.target.checked : e.target.value
    onChange({ ...value, [field]: v })
  }

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <div className="form-group">
          <label className="form-label required">시스템 코드</label>
          <input
            className="form-control"
            value={value.system_cd}
            onChange={set('system_cd')}
            placeholder="예: OM, BL"
            maxLength={50}
            disabled={isEdit && value.system_cd === 'ENTERPRISE'}
            style={{ textTransform: 'uppercase' }}
          />
        </div>
        <div className="form-group">
          <label className="form-label required">시스템명</label>
          <input
            className="form-control"
            value={value.system_nm}
            onChange={set('system_nm')}
            placeholder="예: 오더시스템"
            maxLength={200}
          />
        </div>
      </div>
      <div className="form-group">
        <label className="form-label">설명</label>
        <textarea
          className="form-control"
          rows={2}
          value={value.system_desc}
          onChange={set('system_desc')}
          placeholder="시스템 영역 설명"
        />
      </div>
      {!isEdit && (
        <label className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="checkbox"
            checked={!!value.copy_from_enterprise}
            onChange={set('copy_from_enterprise')}
          />
          <span className="form-label" style={{ margin: 0 }}>전사표준 명명규칙을 복사하여 시작</span>
        </label>
      )}
      <div className="form-group">
        <label className="form-label">사용 여부</label>
        <select className="form-control" value={value.use_yn} onChange={set('use_yn')}>
          <option value="Y">Y (사용)</option>
          <option value="N">N (미사용)</option>
        </select>
      </div>
    </>
  )
}
