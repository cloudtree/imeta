const EMPTY = {
  username: '',
  password: '',
  password_confirm: '',
  user_nm: '',
  email: '',
  dept_nm: '',
  role_cd: 'USER',
  use_yn: 'Y',
}

export default function UserForm({ value, onChange, isEdit = false }) {
  const set = (field) => (e) => onChange({ ...value, [field]: e.target.value })

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <div className="form-group">
          <label className="form-label required">사용자 ID</label>
          <input
            className="form-control"
            value={value.username}
            onChange={set('username')}
            placeholder="예: hong.gildong"
            maxLength={50}
            autoComplete="off"
          />
          <span className="form-hint">영문, 숫자, . _ @ - 만 사용</span>
        </div>

        <div className="form-group">
          <label className="form-label required">사용자명</label>
          <input
            className="form-control"
            value={value.user_nm}
            onChange={set('user_nm')}
            placeholder="예: 홍길동"
            maxLength={100}
          />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <div className="form-group">
          <label className={`form-label${isEdit ? '' : ' required'}`}>
            비밀번호{isEdit ? ' (변경 시)' : ''}
          </label>
          <input
            type="password"
            className="form-control"
            value={value.password}
            onChange={set('password')}
            placeholder={isEdit ? '변경하지 않으면 비워두세요' : '4자 이상'}
            autoComplete="new-password"
          />
        </div>

        <div className="form-group">
          <label className={`form-label${isEdit ? '' : ' required'}`}>비밀번호 확인</label>
          <input
            type="password"
            className="form-control"
            value={value.password_confirm}
            onChange={set('password_confirm')}
            placeholder="비밀번호 재입력"
            autoComplete="new-password"
          />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <div className="form-group">
          <label className="form-label">이메일</label>
          <input
            type="email"
            className="form-control"
            value={value.email}
            onChange={set('email')}
            placeholder="예: user@company.com"
            maxLength={200}
          />
        </div>

        <div className="form-group">
          <label className="form-label">부서</label>
          <input
            className="form-control"
            value={value.dept_nm}
            onChange={set('dept_nm')}
            placeholder="예: 데이터관리팀"
            maxLength={100}
          />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <div className="form-group">
          <label className="form-label required">권한</label>
          <select className="form-control" value={value.role_cd} onChange={set('role_cd')}>
            <option value="USER">USER (일반)</option>
            <option value="ADMIN">ADMIN (관리자)</option>
          </select>
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

UserForm.EMPTY = EMPTY
